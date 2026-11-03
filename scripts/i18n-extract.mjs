// Estrae i testi italiani dell'interfaccia (stringhe e testi dei modelli HTML) in i18n/strings.json.
// Le parti dinamiche ${...} diventano {0}, {1}… così la traduzione funziona anche sui testi composti.
// Uso: node scripts/i18n-extract.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'renderer');
const SKIP = new Set(['icons.js', 'comuni.js', 'stati.js', 'mp4-muxer.js', 'region.js', 'i18n.js', 'demo.js', 'words.js']);
// oltre all'interfaccia: chat e finestre del processo principale, ponte del telefono
const EXTRA = [path.join(ROOT, 'src', 'main', 'main.js'), path.join(ROOT, 'src', 'main', 'chat.js'), ...fs.readdirSync(path.join(ROOT, 'mobile', 'src', 'bridge')).map(f => path.join(ROOT, 'mobile', 'src', 'bridge', f))];
const ATTRS = ['placeholder', 'title', 'data-tip', 'alt', 'aria-label'];

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? (['vendor', 'i18n', 'fonts'].includes(e.name) ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]));

// tokenizzatore minimo di JS: stringhe '…', "…" e template `…${…}…` (anche annidati)
function scan(code) {
  const out = [];
  let i = 0;
  const readTemplate = () => {
    const parts = [''];
    const exprs = [];
    i++;
    while (i < code.length) {
      const ch = code[i];
      if (ch === '\\') { parts[parts.length - 1] += code[i + 1]; i += 2; continue; }
      if (ch === '`') { i++; break; }
      if (ch === '$' && code[i + 1] === '{') {
        i += 2;
        let depth = 1;
        const start = i;
        while (i < code.length && depth) {
          const c = code[i];
          if (c === '`') { readTemplate(); continue; }
          if (c === '\'' || c === '"') { readString(c); continue; }
          if (c === '{') depth++;
          else if (c === '}') depth--;
          i++;
        }
        exprs.push(code.slice(start, i - 1));
        parts.push('');
        continue;
      }
      parts[parts.length - 1] += ch;
      i++;
    }
    out.push({ kind: 'tpl', parts });
  };
  const readString = q => {
    let s = '';
    i++;
    while (i < code.length && code[i] !== q) {
      if (code[i] === '\\') { s += code[i + 1] === 'n' ? '\n' : code[i + 1]; i += 2; continue; }
      if (code[i] === '\n') break;
      s += code[i++];
    }
    i++;
    out.push({ kind: 'str', s });
  };
  while (i < code.length) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '/') { while (i < code.length && code[i] !== '\n') i++; continue; }
    if (c === '/' && code[i + 1] === '*') { i = code.indexOf('*/', i + 2); i = i < 0 ? code.length : i + 2; continue; }
    if (c === '`') { readTemplate(); continue; }
    if (c === '\'' || c === '"') { readString(c); continue; }
    i++;
  }
  return out;
}

const norm = s => s.replace(/\s+/g, ' ').trim();
const looksText = s => {
  if (!/[A-Za-zÀ-ÿ]{2}/.test(s)) return false;
  if (/^[a-z0-9_\-:.#\[\]=/@?&%+*,]+$/.test(s)) return false;           // codice, selettori, percorsi
  if (/^[\w-]+\.(js|css|png|svg|webp|json|html)$/i.test(s)) return false;
  if (/[{;}]/.test(s.replace(/\{\d+\}/g, '')) && /:/.test(s)) return false; // CSS
  if (/^(https?:|mailto:|tel:|data:|athlos:)/.test(s)) return false;
  if (/^[A-Z][A-Z0-9_]+$/.test(s) && s.length < 4) return false;
  if (/^\{\d+\}$/.test(s)) return false;
  if (/=>|\.test\(|\breturn\b|`|\\|\(max-width|\(prefers|^[.#\[(;’]|\[data-|\bfunction\b|\bconst\b/.test(s)) return false;
  if (/^[\w-]+(\s+[\w-]+)*$/.test(s) && /-/.test(s) && !/\s/.test(s)) return false;
  return /\s/.test(s) || /^[A-ZÀ-Ý][a-zà-ÿ]/.test(s) || /[à-ÿ]/.test(s);
};

const found = new Map();
const add = (s, file) => {
  const t = norm(s);
  if (!t || t.length > 600 || !looksText(t)) return;
  if (!found.has(t)) found.set(t, new Set());
  found.get(t).add(path.relative(SRC, file));
};

// testi tra i tag e attributi visibili di un frammento HTML con segnaposto {n}
function fromHtml(html, file) {
  html = html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ');
  for (const a of ATTRS) {
    const re = new RegExp(`${a}="([^"]*)"`, 'g');
    let m;
    while ((m = re.exec(html))) add(m[1], file);
  }
  const text = html.replace(/<[^>]*>/g, '\u0000');
  for (const chunk of text.split('\u0000')) add(chunk.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'), file);
}

for (const file of [...walk(SRC).filter(f => /\.(js|html)$/.test(f) && !SKIP.has(path.basename(f))), ...EXTRA.filter(f => f.endsWith('.js'))]) {
  const code = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.html')) { fromHtml(code, file); continue; }
  for (const tok of scan(code)) {
    if (tok.kind === 'str') {
      if (/<[a-z][^>]*>/i.test(tok.s)) fromHtml(tok.s, file); else add(tok.s, file);
      continue;
    }
    const joined = tok.parts.map((p, k) => (k ? `{${k - 1}}` : '') + p).join('');
    if (/<[a-z/][^>]*>/i.test(joined)) {
      // i segnaposto dentro i tag non servono: si rinumerano per ogni pezzo di testo
      const pieces = joined.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, '\u0000').split('\u0000');
      for (const a of ATTRS) {
        const re = new RegExp(`${a}="([^"]*)"`, 'g');
        let m;
        while ((m = re.exec(joined))) pieces.push(m[1]);
      }
      for (const p of pieces) {
        let n = 0;
        const renum = p.replace(/\{\d+\}/g, () => `{${n++}}`);
        if (!renum.replace(/\{\d+\}/g, '').trim()) continue;
        // un'icona attaccata al testo ("{0}Salva") nel DOM è un elemento a parte: serve anche il testo da solo
        const bare = renum.replace(/^\s*\{\d+\}\s*(?=[A-Za-zÀ-ÿ])/, '').replace(/(?<=[A-Za-zÀ-ÿ.!?)…])\s*\{\d+\}\s*$/, '');
        if (bare !== renum) { let k = 0; add(bare.replace(/\{\d+\}/g, () => `{${k++}}`), file); }
        else add(renum, file);
      }
    } else add(joined, file);
  }
}

const list = [...found.keys()].sort((a, b) => a.localeCompare(b, 'it'));
const outDir = path.join(ROOT, 'i18n');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'strings.json'), JSON.stringify(list, null, 1));
console.log(`${list.length} testi estratti in i18n/strings.json`);
