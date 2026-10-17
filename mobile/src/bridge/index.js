// window.athlos per Android: stessi metodi e stessi risultati del preload desktop,
// così l'interfaccia di Athlos gira sul telefono senza modifiche.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { AppLauncher } from '@capacitor/app-launcher';
import { Clipboard } from '@capacitor/clipboard';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import QRCode from 'qrcode';
import scrypt from 'scrypt-js';
import * as fsx from './fsx.js';
import * as store from './store.js';
import * as print from './print.js';
import { scheduleReminders, ensurePermission } from './reminders.js';
import { createChatApi } from './chat-api.js';

const VERSION = '1.0.1';
const STUDIO = 'athlos/studio';
const FILES = 'athlos/files';
const MEDIA_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'ogg', 'opus', 'm4a', 'aac', 'flac', 'salto']);

document.documentElement.classList.add('is-mobile', 'platform-android');

// ------------------------------------------------------------------ eventi
const ALLOWED = ['chat:event', 'db:changed', 'navigate', 'notify:click', 'studio:open'];
const bus = new Map();
function emit(channel, payload) {
  for (const cb of bus.get(channel) || []) { try { cb(payload); } catch (err) { console.error(err); } }
}
function on(channel, cb) {
  if (!ALLOWED.includes(channel)) throw new Error('Canale non consentito: ' + channel);
  if (!bus.has(channel)) bus.set(channel, new Set());
  bus.get(channel).add(cb);
  return () => bus.get(channel).delete(cb);
}

// ------------------------------------------------------------------ attesa con velo
function busy(text) {
  let node = null;
  const t = setTimeout(() => {
    node = document.createElement('div');
    node.className = 'm-busy';
    node.innerHTML = '<div><i></i><span></span></div>';
    node.querySelector('span').textContent = text;
    document.body.appendChild(node);
  }, 350);
  return {
    set(p) { if (node) node.querySelector('span').textContent = `${text} ${Math.round(p * 100)}%`; },
    done() { clearTimeout(t); if (node) node.remove(); },
  };
}

// ------------------------------------------------------------------ selettore file
function acceptFor(filters = []) {
  const exts = filters.flatMap(f => f.extensions || []).map(e => e.toLowerCase());
  if (!exts.length || exts.includes('*')) return '';
  const types = new Set();
  for (const e of exts) {
    const mime = fsx.mimeOf('x.' + e);
    if (mime === 'application/octet-stream') return '';   // estensione sconosciuta ad Android: mostra tutti i file
    types.add(mime.split('/')[0] === 'image' || mime.split('/')[0] === 'video' || mime.split('/')[0] === 'audio' ? mime.split('/')[0] + '/*' : mime);
    types.add('.' + e);
  }
  if (exts.includes('csv')) types.add('text/comma-separated-values').add('text/plain');
  return [...types].join(',');
}

function pickFiles({ filters, multiple } = {}) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = acceptFor(filters);
    input.multiple = !!multiple;
    input.style.display = 'none';
    let done = false;
    const finish = list => { if (done) return; done = true; input.remove(); resolve(list); };
    input.addEventListener('change', () => finish([...(input.files || [])]));
    input.addEventListener('cancel', () => finish([]));
    document.body.appendChild(input);
    input.click();
  });
}

async function importPicked(f, opts) {
  const ext = fsx.extOf(f.name);
  const out = { path: '', name: f.name, size: f.size, url: '' };
  if (opts.readText) out.text = await f.text();
  if (opts.readBase64) out.base64 = fsx.bytesToBase64(new Uint8Array(await f.arrayBuffer()));
  if (MEDIA_EXT.has(ext)) {
    const rel = `${FILES}/${Date.now().toString(36)}-${fsx.safeName(f.name)}`;
    const b = busy('Importazione…');
    try {
      await fsx.writeBlob(rel, f, fsx.Directory.Data, p => b.set(p));
    } finally {
      b.done();
    }
    out.path = fsx.abs(rel);
    if (!fsx.native) await fsx.primeWebUrl(rel, f.type);
    out.url = fsx.urlOf(out.path);
  } else {
    out.path = 'picked:' + f.name;
  }
  return out;
}

function dataOf(opts) {
  if (opts.base64 != null) return { bytes: fsx.base64ToBytes(opts.base64) };
  if (opts.bytes != null) return { bytes: opts.bytes instanceof Uint8Array ? opts.bytes : new Uint8Array(opts.bytes) };
  return { text: String(opts.text ?? '') };
}

async function writeData(rel, d, directory) {
  if (d.bytes) await fsx.writeBytes(rel, d.bytes, directory);
  else await fsx.writeText(rel, d.text, directory);
}

// Su telefono "salva" significa: scrivi il file e scegli dove mandarlo (Drive, WhatsApp, Download…)
async function shareFile(rel, directory, title) {
  const uri = await fsx.uriOf(rel, directory);
  try {
    await Share.share({ title, files: [uri], dialogTitle: title });
    return true;
  } catch (err) {
    if (/cancel/i.test(String(err && err.message))) return false;
    throw err;
  }
}

async function saveFile(opts = {}) {
  const d = dataOf(opts);
  const own = opts.filePath && fsx.relOf(opts.filePath);
  if (own) {
    await writeData(own, d, fsx.Directory.Data);
    if (!fsx.native) await fsx.primeWebUrl(own);
    return opts.filePath;
  }
  const name = fsx.safeName(opts.defaultName || 'file');
  const rel = `export/${name}`;
  const b = busy('Preparazione del file…');
  try {
    await writeData(rel, d, fsx.Directory.Cache);
  } finally {
    b.done();
  }
  if (!fsx.native) {
    const blob = new Blob([d.bytes || d.text], { type: fsx.mimeOf(name) });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    a.click();
    return name;
  }
  return (await shareFile(rel, fsx.Directory.Cache, name)) ? `${(await fsx.uriOf(rel, fsx.Directory.Cache)).replace(/^file:\/\//, '')}` : null;
}

// ------------------------------------------------------------------ Salto Studio
async function studioRecent() {
  const files = await fsx.list(STUDIO);
  const names = new Set(files.map(f => f.name));
  const out = [];
  for (const f of files.filter(x => x.name.endsWith('.salto'))) {
    const rel = `${STUDIO}/${f.name}`;
    const thumbRel = rel + '.jpg';
    let thumb = '';
    if (names.has(f.name + '.jpg')) {
      await fsx.primeWebUrl(thumbRel, 'image/jpeg');
      thumb = fsx.urlOf(fsx.abs(thumbRel));
      if (fsx.native) thumb += '?t=' + Math.round(Number(files.find(x => x.name === f.name + '.jpg').mtime) || Date.now());
    }
    out.push({ name: f.name.replace(/\.salto$/, ''), path: fsx.abs(rel), mtime: Number(f.mtime) || 0, thumb });
  }
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, 24);
}

async function studioSave({ filePath, name, json, thumb }) {
  let rel = filePath && fsx.relOf(filePath);
  if (!rel) {
    const safe = String(name || 'Progetto').replace(/[\\/:*?"<>|]/g, '').trim() || 'Progetto';
    rel = `${STUDIO}/${safe}.salto`;
    let i = 2;
    while (await fsx.stat(rel)) rel = `${STUDIO}/${safe} (${i++}).salto`;
  }
  await fsx.writeText(rel, json);
  if (thumb) {
    await fsx.writeBytes(rel + '.jpg', fsx.base64ToBytes(thumb.split(',')[1]));
    if (!fsx.native) await fsx.primeWebUrl(rel + '.jpg', 'image/jpeg');
  }
  return fsx.abs(rel);
}

// I file dei progetti (foto, video, audio) vanno resi visibili anche sul web di prova
async function primeProject(json) {
  if (fsx.native) return;
  for (const m of json.matchAll(/"src":"([^"]+)"/g)) {
    const rel = fsx.relOf(m[1]);
    if (rel) await fsx.primeWebUrl(rel);
  }
}

// ------------------------------------------------------------------ PIN
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const unhex = s => new Uint8Array((s.match(/../g) || []).map(h => parseInt(h, 16)));
const enc = new TextEncoder();

async function pbkdf2(pin, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: iter }, key, 256));
}

function same(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

const security = {
  async hashPin(pin) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    return `pbkdf2$210000$${salt}$${hex(await pbkdf2(pin, salt, 210000))}`;
  },
  async verifyPin(pin, stored) {
    if (!stored) return false;
    if (stored.startsWith('pbkdf2$')) {
      const [, iter, salt, hash] = stored.split('$');
      return same(await pbkdf2(pin, salt, Number(iter)), unhex(hash));
    }
    // PIN creato sul PC (scrypt di Node: N=16384, r=8, p=1, 32 byte)
    if (!stored.includes(':')) return false;
    const [salt, hash] = stored.split(':');
    const test = await scrypt.scrypt(enc.encode(String(pin)), enc.encode(salt), 16384, 8, 1, 32);
    return same(test, unhex(hash));
  },
};

// ------------------------------------------------------------------ sistema
const SAFE = ['https:', 'http:', 'mailto:', 'tel:', 'whatsapp:', 'fb-messenger:', 'sms:'];

async function openExternal(url) {
  try {
    if (!SAFE.includes(new URL(url).protocol)) return false;
  } catch {
    return false;
  }
  if (!fsx.native) { window.open(url, '_blank', 'noopener'); return true; }
  const { completed } = await AppLauncher.openUrl({ url });
  return completed !== false;
}

let notifySeq = Math.floor(Date.now() / 1000) % 100000;
async function notify({ title, body }) {
  if (!fsx.native) return false;
  if (!(await ensurePermission())) return false;
  await LocalNotifications.schedule({ notifications: [{ id: 1000000 + (notifySeq++ % 900000), title, body, smallIcon: 'ic_stat_athlos', iconColor: '#7C5CFF', extra: { kind: 'info' } }] });
  return true;
}

let lastDark = null;
async function setTheme(mode) {
  const dark = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  lastDark = dark;
  if (fsx.native) {
    try { await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }); } catch { /* barra non disponibile */ }
  }
  return dark;
}

function gotoMain(route) {
  const target = 'index.html' + (route ? '#' + route : '');
  if (/\/index\.html$|\/$/.test(location.pathname)) { if (route) location.hash = route; return; }
  location.href = target;
}

const system = {
  open: openExternal,
  copy: async text => { await Clipboard.write({ string: String(text) }); return true; },
  copyImage: async dataUrl => { await Clipboard.write({ image: dataUrl }); return true; },
  notify,
  qr: (text, opts = {}) => QRCode.toString(String(text), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: opts.dark || '#14112B', light: opts.light || '#FFFFFF' } }),
  info: async () => ({
    version: VERSION,
    name: 'Athlos',
    electron: 'Capacitor ' + (Capacitor.getPlatform() === 'android' ? 'Android' : 'web'),
    chrome: ((/Chrome\/([\d.]+)/.exec(navigator.userAgent) || [])[1]) || '',
    platform: 'android',
    arch: '',
    dataDir: fsx.abs('athlos'),
    isDev: false,
  }),
  setTheme,
  systemDark: async () => matchMedia('(prefers-color-scheme: dark)').matches,
  relaunch: async () => { await store.flush(); location.href = 'index.html'; },
  openStudio: async payload => {
    await store.flush();
    try { sessionStorage.setItem('athlos:studio', JSON.stringify(payload || null)); } catch { /* spazio pieno */ }
    location.href = 'studio.html';
    return true;
  },
  focusMain: async route => { await store.flush(); gotoMain(route); return true; },
};

// ------------------------------------------------------------------ API pubblica
window.athlos = {
  platform: 'android',
  db: {
    load: async () => store.getAll(),
    put: async (collection, value) => {
      if (typeof collection !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(collection)) throw new Error('Collezione non valida');
      store.set(collection, value);
      return true;
    },
    paths: async () => store.paths(),
  },
  media: {
    save: (bytes, ext) => store.saveMedia(bytes, ext),
    remove: name => store.deleteMedia(name),
    url: name => store.mediaUrl(name),
  },
  backup: {
    list: () => store.listBackups(),
    now: () => store.backupNow(),
    restore: name => store.restoreBackup(name),
    exportFile: async () => {
      const b = busy('Preparazione del backup…');
      let text;
      try { text = await store.exportBundle(); } finally { b.done(); }
      return saveFile({ defaultName: `Athlos-backup-${new Date().toISOString().slice(0, 10)}.athlos`, text });
    },
    importFile: async () => {
      const [f] = await pickFiles({});
      if (!f) return false;
      const b = busy('Importazione del backup…');
      try { await store.importBundle(await f.text()); } finally { b.done(); }
      return true;
    },
    openFolder: async () => {
      const rel = await store.latestBackupPath();
      if (!rel || !fsx.native) return false;
      return shareFile(rel, fsx.Directory.Data, 'Ultimo backup di Athlos');
    },
  },
  print: {
    printers: print.printers,
    formats: async () => print.FORMATS,
    html: opts => print.printHtml(opts || {}),
    pdf: opts => print.pdf(opts || {}),
  },
  file: {
    open: async (opts = {}) => {
      const files = await pickFiles(opts);
      const out = [];
      for (const f of files) out.push(await importPicked(f, opts));
      return out;
    },
    save: opts => saveFile(opts || {}),
    reveal: async p => { const rel = fsx.relOf(p); return rel && fsx.native ? shareFile(rel, fsx.Directory.Data, p.split('/').pop()) : false; },
    toUrl: async p => fsx.urlOf(p),
    exists: async p => { const rel = fsx.relOf(p); return !!(rel && (await fsx.stat(rel))); },
    pathOf: () => '',
    urlOf: p => fsx.urlOf(p),
    studioDir: async () => fsx.abs(STUDIO),
  },
  studio: {
    recent: studioRecent,
    save: studioSave,
    load: async p => {
      const rel = fsx.relOf(p);
      if (!rel) throw new Error('Progetto non trovato');
      const json = await fsx.readText(rel);
      await primeProject(json);
      return json;
    },
    remove: async p => {
      const rel = fsx.relOf(p);
      if (!rel || !rel.endsWith('.salto')) return false;
      await fsx.remove(rel);
      await fsx.remove(rel + '.jpg');
      return true;
    },
    pending: async () => {
      try {
        const v = sessionStorage.getItem('athlos:studio');
        sessionStorage.removeItem('athlos:studio');
        return v ? JSON.parse(v) : null;
      } catch {
        return null;
      }
    },
  },
  system,
  security,
  chat: createChatApi(emit),
  on,
};

// ------------------------------------------------------------------ Android
function topOverlayOpen() {
  const menu = document.querySelector('.popmenu');
  if (menu) { menu.remove(); return true; }
  if (document.querySelector('.modal-back:not(.out)') || document.querySelector('.st-modal-back:not(.out)')) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return true;
  }
  if (document.documentElement.classList.contains('drawer-open')) {
    document.documentElement.classList.remove('drawer-open');
    return true;
  }
  const conv = document.querySelector('.chat.m-conv');
  if (conv) { conv.classList.remove('m-conv'); return true; }
  const sheet = document.querySelector('.m-sheet-open');
  if (sheet) { sheet.classList.remove('m-sheet-open'); return true; }
  return false;
}

function onBack() {
  if (topOverlayOpen()) return;
  const inStudio = /studio\.html$/.test(location.pathname);
  if (inStudio) {
    document.dispatchEvent(new CustomEvent('athlos:back', { cancelable: true }))
      && system.focusMain('/studio');
    return;
  }
  const path = (location.hash.replace(/^#/, '') || '/dashboard').split('?')[0];
  if (path === '/dashboard' || path === '') App.minimizeApp();
  else history.back();
}

async function initAndroid() {
  App.addListener('backButton', onBack);
  App.addListener('pause', () => { store.flush(); });
  LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
    const extra = notification && notification.extra;
    emit('notify:click', { title: notification && notification.title });
    if (extra && extra.route) {
      if (/studio\.html$/.test(location.pathname)) system.focusMain(extra.route);
      else location.hash = extra.route;
    }
  });
  try {
    await LocalNotifications.createChannel({ id: 'athlos', name: 'Athlos', description: 'Scadenze dei certificati e avvisi', importance: 4, visibility: 1 });
  } catch { /* canale già presente */ }
}

// Nasconde lo splash appena l'interfaccia ha disegnato qualcosa
function hideSplashWhenReady() {
  if (!fsx.native) return;
  const done = () => SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
  const obs = new MutationObserver(() => {
    if (document.querySelector('#root > *, .onboarding, .st-app, #home')) { obs.disconnect(); setTimeout(done, 120); }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(done, 4000);
}

window.athlosReady = (async () => {
  await fsx.initFs(['athlos', 'athlos/media', 'athlos/backup', FILES, STUDIO, `${STUDIO}/media`]);
  await store.initStore();
  if (fsx.native) await initAndroid();
  store.onSet(col => { if (col === 'clients' || col === 'settings') scheduleReminders(store.getAll); });
  scheduleReminders(store.getAll);
  hideSplashWhenReady();
})().catch(err => {
  console.error('Avvio non riuscito:', err);
  document.body.insertAdjacentHTML('beforeend', `<div class="m-fatal"><b>Athlos non è riuscito ad avviarsi</b><span>${String(err && err.message || err)}</span></div>`);
  throw err;
});
