// Archivio su telefono: stesso formato del PC (athlos-db.json, media, backup giornalieri),
// così i backup .athlos passano dal telefono al computer e viceversa.
import * as fsx from './fsx.js';

const DB = 'athlos/athlos-db.json';
const MEDIA = 'athlos/media';
const BACKUP = 'athlos/backup';
const MAX_DAILY_BACKUPS = 30;

let data = {};
let dirty = false;
let timer = null;
let writing = Promise.resolve();
const listeners = new Set();

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function initStore() {
  data = await loadFile();
  if (!fsx.native) {
    for (const f of await fsx.list(MEDIA)) await fsx.primeWebUrl(`${MEDIA}/${f.name}`);
  }
  try { await dailyBackup(); } catch (err) { console.error('Backup giornaliero non riuscito:', err); }
}

async function loadFile() {
  for (const f of [DB, DB + '.tmp', DB + '.bak']) {
    try {
      const parsed = JSON.parse(await fsx.readText(f));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch { /* prova la copia successiva */ }
  }
  return { version: 1, createdAt: new Date().toISOString() };
}

export const getAll = () => data;
export const get = col => data[col];
export const onSet = cb => { listeners.add(cb); return () => listeners.delete(cb); };

export function set(col, value) {
  data[col] = value;
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
  for (const cb of listeners) { try { cb(col, value); } catch (err) { console.error(err); } }
}

export function flush() {
  clearTimeout(timer);
  if (!dirty) return writing;
  dirty = false;
  data.version = 1;
  data.updatedAt = new Date().toISOString();
  const text = JSON.stringify(data);
  writing = writing.then(async () => {
    await fsx.writeText(DB + '.tmp', text);
    if (await fsx.stat(DB)) await fsx.copy(DB, DB + '.bak');
    await fsx.move(DB + '.tmp', DB);
  }).catch(err => { console.error('Salvataggio archivio non riuscito:', err); dirty = true; });
  return writing;
}

export function paths() {
  return { data: fsx.abs('athlos'), file: fsx.abs(DB), media: fsx.abs(MEDIA), backup: fsx.abs(BACKUP) };
}

// ---------- media
export async function saveMedia(bytes, ext) {
  const safeExt = String(ext || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin';
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join('');
  const name = `${Date.now().toString(36)}-${rnd}.${safeExt}`;
  await fsx.writeBytes(`${MEDIA}/${name}`, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  await fsx.primeWebUrl(`${MEDIA}/${name}`);
  return name;
}

export async function deleteMedia(name) {
  await fsx.remove(`${MEDIA}/${String(name).split('/').pop()}`);
  return true;
}

export const mediaUrl = name => (name ? fsx.urlOf(fsx.abs(`${MEDIA}/${String(name).split('/').pop()}`)) : '');

// ---------- backup
async function dailyBackup() {
  if (!(await fsx.stat(DB))) return null;
  const target = `${BACKUP}/athlos-${today()}.json`;
  if (await fsx.stat(target)) return null;
  await fsx.copy(DB, target);
  for (const old of (await listBackups()).slice(MAX_DAILY_BACKUPS)) await fsx.remove(`${BACKUP}/${old.name}`);
  return fsx.abs(target);
}

export async function backupNow() {
  dirty = true;
  await flush();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const target = `${BACKUP}/athlos-manuale-${stamp}.json`;
  await fsx.writeText(target, JSON.stringify(data));
  return fsx.abs(target);
}

export async function listBackups() {
  return (await fsx.list(BACKUP))
    .filter(f => f.name.endsWith('.json'))
    .map(f => ({ name: f.name, size: f.size || 0, mtime: Number(f.mtime) || 0 }))
    .sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name));
}

export async function restoreBackup(name) {
  const parsed = JSON.parse(await fsx.readText(`${BACKUP}/${String(name).split('/').pop()}`));
  await backupNow();
  data = parsed;
  dirty = true;
  await flush();
  return true;
}

export async function latestBackupPath() {
  const [b] = await listBackups();
  return b ? `${BACKUP}/${b.name}` : null;
}

// Archivio + media in un unico file portabile (identico al PC)
export async function exportBundle() {
  dirty = true;
  await flush();
  const media = {};
  for (const f of await fsx.list(MEDIA)) {
    try { media[f.name] = await fsx.readBase64(`${MEDIA}/${f.name}`); } catch { /* file illeggibile */ }
  }
  return JSON.stringify({ athlosBundle: 1, exportedAt: new Date().toISOString(), data, media });
}

export async function importBundle(text) {
  const bundle = JSON.parse(text);
  const imported = bundle.athlosBundle ? bundle.data : bundle;
  if (!imported || typeof imported !== 'object') throw new Error('File di backup non valido');
  await backupNow();
  if (bundle.media) {
    for (const [name, b64] of Object.entries(bundle.media)) {
      await fsx.writeBytes(`${MEDIA}/${String(name).split(/[\\/]/).pop()}`, fsx.base64ToBytes(b64));
    }
  }
  data = imported;
  dirty = true;
  await flush();
}
