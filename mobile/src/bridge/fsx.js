// Accesso ai file del telefono: tutto vive nella cartella privata dell'app (Directory.Data),
// i file da condividere passano dalla cache. Sul web (solo per prove) i file stanno in IndexedDB.
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export const native = Capacitor.isNativePlatform();
export { Directory };

let ROOT = '';
const webUrls = new Map();
const CHUNK = 3 * 1024 * 1024;

export async function initFs(dirs) {
  if (native) {
    const { uri } = await Filesystem.getUri({ directory: Directory.Data, path: '' });
    ROOT = decodeURIComponent(uri.replace(/^file:\/\//, '')).replace(/\/+$/, '');
  } else {
    ROOT = '/athlos-web';
  }
  for (const d of dirs) await mkdir(d);
}

export const root = () => ROOT;
export const abs = rel => `${ROOT}/${rel}`;
export const relOf = p => (p && p.startsWith(ROOT + '/') ? p.slice(ROOT.length + 1) : null);

export async function mkdir(path, directory = Directory.Data) {
  try { await Filesystem.mkdir({ path, directory, recursive: true }); } catch { /* esiste già */ }
}

export async function readText(path, directory = Directory.Data) {
  const r = await Filesystem.readFile({ path, directory, encoding: Encoding.UTF8 });
  return typeof r.data === 'string' ? r.data : await r.data.text();
}

export async function writeText(path, text, directory = Directory.Data) {
  await Filesystem.writeFile({ path, directory, data: text, encoding: Encoding.UTF8, recursive: true });
}

export async function readBase64(path, directory = Directory.Data) {
  const r = await Filesystem.readFile({ path, directory });
  if (typeof r.data === 'string') return r.data;
  return bytesToBase64(new Uint8Array(await r.data.arrayBuffer()));
}

// Scrittura binaria a blocchi: evita stringhe enormi sul ponte nativo con i video
export async function writeBytes(path, bytes, directory = Directory.Data) {
  if (!bytes.length) {
    await Filesystem.writeFile({ path, directory, data: '', recursive: true });
    return;
  }
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const data = bytesToBase64(bytes.subarray(i, i + CHUNK));
    if (i === 0) await Filesystem.writeFile({ path, directory, data, recursive: true });
    else await Filesystem.appendFile({ path, directory, data });
  }
}

export async function writeBlob(path, blob, directory = Directory.Data, onProgress) {
  if (!blob.size) return writeBytes(path, new Uint8Array(0), directory);
  for (let i = 0; i < blob.size; i += CHUNK) {
    const data = bytesToBase64(new Uint8Array(await blob.slice(i, i + CHUNK).arrayBuffer()));
    if (i === 0) await Filesystem.writeFile({ path, directory, data, recursive: true });
    else await Filesystem.appendFile({ path, directory, data });
    if (onProgress) onProgress(Math.min(1, (i + CHUNK) / blob.size));
  }
}

export async function stat(path, directory = Directory.Data) {
  try { return await Filesystem.stat({ path, directory }); } catch { return null; }
}

export async function list(path, directory = Directory.Data) {
  try {
    const { files } = await Filesystem.readdir({ path, directory });
    return files.map(f => (typeof f === 'string' ? { name: f, type: 'file', size: 0, mtime: 0 } : f));
  } catch {
    return [];
  }
}

export async function remove(path, directory = Directory.Data) {
  try { await Filesystem.deleteFile({ path, directory }); return true; } catch { return false; }
}

export async function copy(from, to, directory = Directory.Data, toDirectory = directory) {
  await remove(to, toDirectory);
  await Filesystem.copy({ from, to, directory, toDirectory });
}

export async function move(from, to, directory = Directory.Data) {
  await remove(to, directory);
  await Filesystem.rename({ from, to, directory, toDirectory: directory });
}

export async function uriOf(path, directory = Directory.Data) {
  return (await Filesystem.getUri({ path, directory })).uri;
}

// URL caricabile da <img>, <video> e canvas (stessa origine dell'app)
export function urlOf(absPath) {
  if (!absPath) return '';
  if (/^(https?|blob|data):/.test(absPath)) return absPath;
  if (!native) return webUrls.get(absPath) || '';
  return Capacitor.convertFileSrc('file://' + encodeURI(absPath));
}

// Web: i file in IndexedDB diventano blob: per poterli mostrare
export async function primeWebUrl(rel, mime) {
  if (native) return;
  const p = abs(rel);
  if (webUrls.has(p)) return;
  try {
    const b64 = await readBase64(rel);
    webUrls.set(p, URL.createObjectURL(new Blob([base64ToBytes(b64)], { type: mime || mimeOf(rel) })));
  } catch { /* file mancante */ }
}

export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
  pdf: 'application/pdf', csv: 'text/csv', json: 'application/json', txt: 'text/plain',
};

export function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

export function mimeOf(name) {
  return MIME[extOf(name)] || 'application/octet-stream';
}

export function safeName(name) {
  return String(name || 'file').normalize('NFKD').replace(/[^\w.\- ()]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file';
}
