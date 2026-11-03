// Pacchetto .athlos completo sul telefono: stesso formato del PC (versione 2), così i dati
// passano dal computer al telefono e ritorno senza rifare nulla.
import * as fsx from './fsx.js';
import * as store from './store.js';

const STUDIO = 'athlos/studio';
const MAX_FILE = 60 * 1024 * 1024;
const MAX_TOTAL = 200 * 1024 * 1024;

function walkSrc(obj, fn) {
  if (Array.isArray(obj)) { for (const v of obj) if (v && typeof v === 'object') walkSrc(v, fn); return; }
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'src' && typeof v === 'string') obj[k] = fn(v);
    else if (v && typeof v === 'object') walkSrc(v, fn);
  }
}

async function hashId(s) {
  const h = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h).slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
}

export async function exportAll(version) {
  const base = JSON.parse(await store.exportBundle());
  const files = {};
  const skipped = [];
  let total = 0;
  const projects = [];
  const list = await fsx.list(STUDIO);
  const names = new Set(list.map(f => f.name));
  for (const f of list.filter(x => x.name.endsWith('.salto'))) {
    let proj;
    try { proj = JSON.parse(await fsx.readText(`${STUDIO}/${f.name}`)); } catch { continue; }
    const jobs = [];
    walkSrc(proj, src => {
      const m = /_capacitor_file_([^?]+)/.exec(src);
      if (m) {
        const abs = decodeURI(m[1]);
        if (abs.includes('/athlos/media/')) return 'media:' + abs.split('/').pop();
        const rel = fsx.relOf(abs);
        if (!rel) return src;
        const token = { v: src };
        jobs.push(async () => {
          const st = await fsx.stat(rel);
          if (!st || st.size > MAX_FILE || total + st.size > MAX_TOTAL) { skipped.push(abs.split('/').pop()); return; }
          const id = (await hashId(abs)) + '.' + (fsx.extOf(abs) || 'bin');
          if (!files[id]) { files[id] = await fsx.readBase64(rel); total += st.size; }
          token.v = 'file:' + id;
        });
        return token;
      }
      const a = /(?:^|https?:\/\/localhost)\/(assets\/[^?]+)/.exec(src);
      if (a) return 'app:' + a[1];
      return src;
    });
    for (const j of jobs) await j();
    const json = JSON.stringify(proj, (k, v) => (k === 'src' && v && typeof v === 'object' && 'v' in v ? v.v : v));
    const thumb = names.has(f.name + '.jpg') ? await fsx.readBase64(`${STUDIO}/${f.name}.jpg`).catch(() => '') : '';
    projects.push({ name: f.name.replace(/\.salto$/, ''), json, thumb });
  }
  let chat = null;
  try { chat = JSON.parse(await fsx.readText('athlos/chat.json')); } catch { /* nessuna chat */ }
  return JSON.stringify({ ...base, athlosBundle: 2, app: 'Athlos', version, platform: 'android', studio: { projects, files, skipped }, chat });
}

export async function importAll(text) {
  const bundle = JSON.parse(text);
  await store.importBundle(text);
  if (!bundle.athlosBundle || bundle.athlosBundle < 2) return { projects: 0 };
  const st = bundle.studio || {};
  const written = {};
  let count = 0;
  for (const pr of st.projects || []) {
    let proj;
    try { proj = JSON.parse(pr.json); } catch { continue; }
    const writes = [];
    walkSrc(proj, src => {
      if (src.startsWith('app:')) return '/' + src.slice(4);
      if (src.startsWith('media:')) return store.mediaUrl(src.slice(6));
      if (src.startsWith('file:')) {
        const id = src.slice(5).split('/').pop();
        const rel = `${STUDIO}/media/${id}`;
        if (!written[id] && st.files && st.files[id]) { written[id] = true; writes.push(fsx.writeBytes(rel, fsx.base64ToBytes(st.files[id]))); }
        return fsx.urlOf(fsx.abs(rel));
      }
      return src;
    });
    await Promise.all(writes);
    const safe = String(pr.name || 'Progetto').replace(/[\\/:*?"<>|]/g, '').trim() || 'Progetto';
    let rel = `${STUDIO}/${safe}.salto`;
    let i = 2;
    while (await fsx.stat(rel)) rel = `${STUDIO}/${safe} (${i++}).salto`;
    await fsx.writeText(rel, JSON.stringify(proj));
    if (pr.thumb) await fsx.writeBytes(rel + '.jpg', fsx.base64ToBytes(pr.thumb));
    count++;
  }
  if (bundle.chat && typeof bundle.chat === 'object') await fsx.writeText('athlos/chat.json', JSON.stringify(bundle.chat));
  return { projects: count };
}
