/*
 * Pacchetto .athlos completo (versione 2): archivio, foto, chiusure di cassa, progetti di
 * Salto Studio con i loro file e chat Squadra. Lo stesso formato si apre sul PC e sul telefono:
 * gli indirizzi dei file nei progetti vengono tradotti in segnaposto neutri (app:, media:, file:).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_FILE = 60 * 1024 * 1024;   // file oltre questa dimensione restano fuori dal pacchetto
const MAX_TOTAL = 300 * 1024 * 1024;

function walkSrc(obj, fn) {
  if (Array.isArray(obj)) { obj.forEach((v, i) => { if (typeof v === 'object' && v) walkSrc(v, fn); }); return; }
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'src' && typeof v === 'string') obj[k] = fn(v);
    else if (v && typeof v === 'object') walkSrc(v, fn);
  }
}

function exportAll({ store, studioDir, chatFile, version }) {
  const base = JSON.parse(store.exportBundle());
  const files = {};
  const skipped = [];
  let total = 0;
  const projects = [];
  const dir = studioDir();
  for (const n of fs.readdirSync(dir).filter(x => x.endsWith('.salto'))) {
    const p = path.join(dir, n);
    let proj;
    try { proj = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    walkSrc(proj, src => {
      let m = /^athlos:\/\/app\/(.+)$/.exec(src);
      if (m) return 'app:' + m[1];
      m = /^athlos:\/\/media\/(.+)$/.exec(src);
      if (m) return 'media:' + decodeURIComponent(m[1]);
      m = /^athlos:\/\/file\/([^?]+)/.exec(src);
      if (!m) return src;
      const fp = decodeURIComponent(m[1]);
      try {
        const st = fs.statSync(fp);
        if (st.size > MAX_FILE || total + st.size > MAX_TOTAL) { skipped.push(path.basename(fp)); return src; }
        const id = crypto.createHash('sha1').update(fp).digest('hex').slice(0, 16) + path.extname(fp).toLowerCase();
        if (!files[id]) { files[id] = fs.readFileSync(fp).toString('base64'); total += st.size; }
        return 'file:' + id;
      } catch {
        return src;
      }
    });
    const thumb = p + '.jpg';
    projects.push({ name: n.replace(/\.salto$/, ''), json: JSON.stringify(proj), thumb: fs.existsSync(thumb) ? fs.readFileSync(thumb).toString('base64') : '' });
  }
  let chat = null;
  try { chat = JSON.parse(fs.readFileSync(chatFile, 'utf8')); } catch { /* nessuna chat */ }
  return JSON.stringify({ ...base, athlosBundle: 2, app: 'Athlos', version, platform: process.platform, studio: { projects, files, skipped }, chat });
}

function importAll(text, { store, studioDir, chatFile }) {
  const bundle = JSON.parse(text);
  store.importBundle(text);
  if (!bundle.athlosBundle || bundle.athlosBundle < 2) return { projects: 0 };
  const dir = studioDir();
  const mediaDir = path.join(dir, 'media');
  fs.mkdirSync(mediaDir, { recursive: true });
  const st = bundle.studio || {};
  const written = {};
  const fileUrl = p => 'athlos://file/' + encodeURIComponent(p);
  let count = 0;
  for (const pr of st.projects || []) {
    let proj;
    try { proj = JSON.parse(pr.json); } catch { continue; }
    walkSrc(proj, src => {
      if (src.startsWith('app:')) return 'athlos://app/' + src.slice(4);
      if (src.startsWith('media:')) return 'athlos://media/' + encodeURIComponent(src.slice(6));
      if (src.startsWith('file:')) {
        const id = path.basename(src.slice(5));
        const target = path.join(mediaDir, id);
        if (!written[id] && st.files && st.files[id]) { fs.writeFileSync(target, Buffer.from(st.files[id], 'base64')); written[id] = true; }
        return fileUrl(target);
      }
      return src;
    });
    const safe = String(pr.name || 'Progetto').replace(/[\\/:*?"<>|]/g, '').trim() || 'Progetto';
    let target = path.join(dir, safe + '.salto');
    let i = 2;
    while (fs.existsSync(target)) target = path.join(dir, `${safe} (${i++}).salto`);
    fs.writeFileSync(target, JSON.stringify(proj));
    if (pr.thumb) fs.writeFileSync(target + '.jpg', Buffer.from(pr.thumb, 'base64'));
    count++;
  }
  if (bundle.chat && typeof bundle.chat === 'object') fs.writeFileSync(chatFile, JSON.stringify(bundle.chat));
  return { projects: count };
}

module.exports = { exportAll, importAll };
