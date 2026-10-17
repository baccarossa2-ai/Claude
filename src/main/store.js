/*
 * Archivio locale di Athlos: un unico file JSON nella cartella dati dell'utente,
 * scritto in modo atomico (file temporaneo + rename) con copia .bak della versione
 * precedente e backup giornalieri automatici. Le immagini (foto atleti, logo)
 * vivono in una cartella "media" separata per tenere il JSON leggero.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_VERSION = 1;
const MAX_DAILY_BACKUPS = 30;

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'athlos-db.json');
    this.mediaDir = path.join(dir, 'media');
    this.backupDir = path.join(dir, 'backup');
    fs.mkdirSync(this.mediaDir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.data = this.load();
    this.timer = null;
    this.dirty = false;
  }

  load() {
    for (const f of [this.file, this.file + '.bak']) {
      try {
        if (!fs.existsSync(f)) continue;
        const parsed = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (err) {
        console.error('Archivio non leggibile:', f, err.message);
      }
    }
    return { version: DB_VERSION, createdAt: new Date().toISOString() };
  }

  get(collection) {
    return this.data[collection];
  }

  set(collection, value) {
    this.data[collection] = value;
    this.scheduleWrite();
  }

  scheduleWrite() {
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
  }

  flush() {
    clearTimeout(this.timer);
    if (!this.dirty) return;
    this.data.version = DB_VERSION;
    this.data.updatedAt = new Date().toISOString();
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.file + '.bak');
    fs.renameSync(tmp, this.file);
    this.dirty = false;
  }

  // ---------- backup ----------
  dailyBackup() {
    if (!fs.existsSync(this.file)) return null;
    const target = path.join(this.backupDir, `athlos-${today()}.json`);
    if (fs.existsSync(target)) return null;
    fs.copyFileSync(this.file, target);
    const all = this.listBackups();
    for (const old of all.slice(MAX_DAILY_BACKUPS)) {
      try { fs.unlinkSync(path.join(this.backupDir, old.name)); } catch { /* ignora */ }
    }
    return target;
  }

  backupNow() {
    this.flush();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const target = path.join(this.backupDir, `athlos-manuale-${stamp}.json`);
    fs.writeFileSync(target, JSON.stringify(this.data));
    return target;
  }

  listBackups() {
    return fs.readdirSync(this.backupDir)
      .filter(n => n.endsWith('.json'))
      .map(name => {
        const st = fs.statSync(path.join(this.backupDir, name));
        return { name, size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  }

  restoreBackup(name) {
    const src = path.join(this.backupDir, path.basename(name));
    const parsed = JSON.parse(fs.readFileSync(src, 'utf8'));
    this.backupNow();
    this.data = parsed;
    this.dirty = true;
    this.flush();
    return true;
  }

  // Esporta archivio + media in un unico file portabile
  exportBundle() {
    this.flush();
    const media = {};
    for (const name of fs.readdirSync(this.mediaDir)) {
      media[name] = fs.readFileSync(path.join(this.mediaDir, name)).toString('base64');
    }
    return JSON.stringify({ athlosBundle: 1, exportedAt: new Date().toISOString(), data: this.data, media });
  }

  importBundle(text) {
    const bundle = JSON.parse(text);
    const data = bundle.athlosBundle ? bundle.data : bundle;
    if (!data || typeof data !== 'object') throw new Error('File di backup non valido');
    this.backupNow();
    if (bundle.media) {
      for (const [name, b64] of Object.entries(bundle.media)) {
        fs.writeFileSync(path.join(this.mediaDir, path.basename(name)), Buffer.from(b64, 'base64'));
      }
    }
    this.data = data;
    this.dirty = true;
    this.flush();
  }

  // ---------- media ----------
  saveMedia(buffer, ext) {
    const safeExt = String(ext || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin';
    const name = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.${safeExt}`;
    fs.writeFileSync(path.join(this.mediaDir, name), buffer);
    return name;
  }

  deleteMedia(name) {
    const f = path.join(this.mediaDir, path.basename(name));
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  mediaPath(name) {
    return path.join(this.mediaDir, path.basename(name));
  }
}

module.exports = { Store };
