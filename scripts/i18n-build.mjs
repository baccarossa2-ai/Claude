// Costruisce i dizionari delle lingue da i18n/src/*.txt (righe "indice¦en¦es¦fr¦de¦pt", indici di
// i18n/strings.json al momento della traduzione) e da i18n/<lingua>.json (già indicizzati per testo).
// Scrive src/renderer/js/i18n/<lingua>.js, letto sia dall'interfaccia sia dal processo principale.
// Uso: node scripts/i18n-build.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'es', 'fr', 'de', 'pt'];
const strings = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'strings.json'), 'utf8'));
const base = JSON.parse(fs.existsSync(path.join(ROOT, 'i18n', 'base.json')) ? fs.readFileSync(path.join(ROOT, 'i18n', 'base.json'), 'utf8') : '[]');
const src = base.length ? base : strings;

const dict = Object.fromEntries(LANGS.map(l => [l, {}]));
for (const l of LANGS) {
  const f = path.join(ROOT, 'i18n', `${l}.json`);
  if (fs.existsSync(f)) Object.assign(dict[l], JSON.parse(fs.readFileSync(f, 'utf8')));
}

const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(',');
const problems = [];
const dir = path.join(ROOT, 'i18n', 'src');
for (const file of fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort() : []) {
  const lines = fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const cols = line.split('¦');
    const idx = /^\d+$/.test(cols[0]) ? Number(cols[0]) : -1;
    const it = idx >= 0 ? src[idx] : cols[0];
    if (cols.length !== LANGS.length + 1 || it === undefined || it === '') { problems.push(`${file}: riga non valida: ${line.slice(0, 80)}`); continue; }
    LANGS.forEach((l, i) => {
      const v = cols[i + 1].trim();
      if (!v) return;
      if (ph(v) !== ph(it)) problems.push(`${file} #${idx} ${l}: segnaposto diversi «${it}» → «${v}»`);
      dict[l][it] = v;
    });
  }
}

// "Vedi ricevute" eredita da "Vedi ricevute {0}", "Salva" da "{0}Salva"…
for (const l of LANGS) {
  for (const s of strings) {
    if (dict[l][s]) continue;
    for (const k of [`${s} {0}`, `${s}{0}`, `{0}${s}`, `{0} ${s}`]) {
      const v = dict[l][k];
      if (v && (v.match(/\{\d+\}/g) || []).length === 1) { dict[l][s] = v.replace(/\s*\{0\}\s*/, ' ').trim(); break; }
    }
  }
}

const outDir = path.join(ROOT, 'src', 'renderer', 'js', 'i18n');
fs.mkdirSync(outDir, { recursive: true });
for (const l of LANGS) {
  const keys = Object.keys(dict[l]).sort((a, b) => a.localeCompare(b, 'it'));
  const obj = Object.fromEntries(keys.map(k => [k, dict[l][k]]));
  fs.writeFileSync(path.join(ROOT, 'i18n', `${l}.json`), JSON.stringify(obj, null, 1) + '\n');
  fs.writeFileSync(path.join(outDir, `${l}.js`), `// Generato da scripts/i18n-build.mjs: non modificare a mano.\nexport default ${JSON.stringify(obj)};\n`);
  const missing = strings.filter(s => !(s in obj)).length;
  console.log(`${l}: ${keys.length} testi tradotti, ${missing} senza traduzione`);
}
if (problems.length) { console.log(problems.join('\n')); process.exitCode = 1; }
