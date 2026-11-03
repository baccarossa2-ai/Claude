// Traduzione dei testi del processo principale (finestre Salva/Apri, notifiche, menu del tasto destro)
// con lo stesso dizionario dell'interfaccia: src/renderer/js/i18n/<lingua>.js.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'renderer', 'js', 'i18n');
let loaded = null;
let table = new Map();
let pats = [];

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function load(code) {
  loaded = code;
  table = new Map();
  pats = [];
  if (!code || code === 'it') return;
  try {
    const src = fs.readFileSync(path.join(DIR, `${code}.js`), 'utf8');
    const json = src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1);
    for (const [k, v] of Object.entries(JSON.parse(json))) {
      if (!v) continue;
      if (!/\{\d+\}/.test(k)) { table.set(k, v); continue; }
      const parts = k.split(/(\{\d+\})/).filter(Boolean);
      const order = [];
      const re = parts.map(p => { const m = /^\{(\d+)\}$/.exec(p); if (m) { order.push(Number(m[1])); return '(.+?)'; } return escRe(p); }).join('');
      const lit = parts.filter(p => !/^\{\d+\}$/.test(p)).sort((a, b) => b.length - a.length)[0] || '';
      pats.push({ re: new RegExp(`^${re}$`, 's'), order, out: v, lit: lit.trim() });
    }
    pats.sort((a, b) => b.lit.length - a.lit.length);
  } catch (err) {
    console.warn('Dizionario non disponibile:', code, err.message);
  }
}

function lookup(text, depth = 0) {
  const hit = table.get(text);
  if (hit !== undefined) return hit;
  if (depth > 2) return null;
  for (const p of pats) {
    if (p.lit && !text.includes(p.lit)) continue;
    const m = p.re.exec(text);
    if (!m) continue;
    const vals = [];
    p.order.forEach((n, i) => { vals[n] = m[i + 1]; });
    return p.out.replace(/\{(\d+)\}/g, (_, n) => {
      const v = vals[Number(n)] ?? '';
      const tv = v.trim() ? lookup(v.trim(), depth + 1) : null;
      return tv == null ? v : v.match(/^\s*/)[0] + tv + v.match(/\s*$/)[0];
    });
  }
  return null;
}

// lingua scelta al primo avvio (salvata nelle impostazioni)
function languageOf(store) {
  try { return ((store.get('settings') || {}).region || {}).language || 'it'; } catch { return 'it'; }
}

function makeT(store) {
  return text => {
    if (text == null || text === '') return text;
    const code = languageOf(store);
    if (code !== loaded) load(code);
    if (!table.size && !pats.length) return text;
    const key = String(text).replace(/\s+/g, ' ').trim();
    return lookup(key) ?? text;
  };
}

module.exports = { makeT, languageOf };
