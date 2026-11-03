// Traduzione dell'interfaccia. Il codice è scritto in italiano: con un'altra lingua i testi
// visibili (nodi di testo e attributi come placeholder e title) vengono sostituiti al volo
// con il dizionario js/i18n/<lingua>.js. I testi con parti variabili usano segnaposto {0}, {1}…
export let LANG = 'it';
let table = null;
let pats = [];
const ATTRS = ['placeholder', 'title', 'aria-label', 'data-tip', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'CANVAS', 'svg', 'SVG', 'path']);
const written = new WeakMap();
let observer = null;

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compile(key, out) {
  const parts = key.split(/(\{\d+\})/).filter(p => p !== '');
  let re = '^';
  const order = [];
  for (const p of parts) {
    const m = /^\{(\d+)\}$/.exec(p);
    if (m) { re += '(.+?)'; order.push(Number(m[1])); } else re += escRe(p);
  }
  const lit = parts.filter(p => !/^\{\d+\}$/.test(p)).map(p => p.trim()).sort((a, b) => b.length - a.length)[0] || '';
  return { re: new RegExp(re + '$', 's'), order, out, len: lit.length, lit };
}

export async function setLanguage(code) {
  LANG = code || 'it';
  document.documentElement.lang = LANG;
  table = null;
  reverse = null;
  pats = [];
  if (LANG === 'it') return;
  let dict = {};
  try { dict = (await import(`../i18n/${LANG}.js`)).default; } catch (err) { console.warn('Lingua non disponibile:', LANG, err); return; }
  table = new Map();
  for (const [k, v] of Object.entries(dict)) {
    if (!v) continue;
    if (/\{\d+\}/.test(k)) pats.push(compile(k, v)); else table.set(k, v);
  }
  // i modelli più specifici (con più testo fisso) hanno la precedenza
  pats.sort((a, b) => b.len - a.len);
  window.__athlosT = t;
}

const keepSpaces = (v, out) => v.match(/^\s*/)[0] + out + v.match(/\s*$/)[0];

// "iscrizioni" trova "Iscrizioni", "DATA" trova "Data" (con la stessa forma nel risultato)
function caseVariant(text) {
  if (/^[a-zà-ÿ]/.test(text)) {
    const hit = table.get(text[0].toUpperCase() + text.slice(1));
    if (hit !== undefined) return LANG === 'de' ? hit : hit[0].toLowerCase() + hit.slice(1);
  }
  if (text.length > 2 && text === text.toUpperCase() && /[A-ZÀ-Ý]{2}/.test(text)) {
    const hit = table.get(text[0] + text.slice(1).toLowerCase());
    if (hit !== undefined) return hit.toUpperCase();
  }
  return null;
}

function lookup(text, depth = 0) {
  if (!table || !text) return null;
  const hit = table.get(text);
  if (hit !== undefined) return hit;
  const cv = caseVariant(text);
  if (cv != null) return cv;
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
      return tv == null ? v : keepSpaces(v, tv);
    });
  }
  return null;
}

// dal testo tradotto all'originale italiano (per riconoscere le colonne dei CSV esportati)
let reverse = null;
export function untranslate(text) {
  if (!table) return text;
  if (!reverse) { reverse = new Map(); for (const [k, v] of table) if (!reverse.has(v.toLowerCase())) reverse.set(v.toLowerCase(), k); }
  return reverse.get(String(text).trim().toLowerCase()) || text;
}

// t('Salva'), t('{0} atleti', [12]) e t('Ciao {nome}', { nome }) per i testi che non passano dal DOM
export function t(text, vars) {
  const s = String(text ?? '');
  let out = s;
  if (table) {
    const key = s.replace(/\s+/g, ' ').trim();
    const r = lookup(key);
    if (r != null) out = r;
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return out;
}

function trText(node) {
  const raw = node.nodeValue;
  if (!raw || written.get(node) === raw || !/[A-Za-zÀ-ÿ]/.test(raw)) return;
  const key = raw.replace(/\s+/g, ' ').trim();
  const out = lookup(key);
  if (out == null || out === key) return;
  const val = (/^\s/.test(raw) ? ' ' : '') + out + (/\s$/.test(raw) ? ' ' : '');
  written.set(node, val);
  node.nodeValue = val;
}

function trAttr(el, a) {
  const v = el.getAttribute(a);
  if (!v || !/[A-Za-zÀ-ÿ]/.test(v)) return;
  const out = lookup(v.replace(/\s+/g, ' ').trim());
  if (out != null && out !== v) el.setAttribute(a, out);
}

function skipped(el) {
  return el && (SKIP.has(el.nodeName) || (el.closest && el.closest('[data-no-tr],[contenteditable="true"]')));
}

export function translateTree(root) {
  if (!table || !root) return;
  if (root.nodeType === 3) { if (!skipped(root.parentNode)) trText(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if (root.nodeType === 1 && skipped(root)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.nodeType === 1 && skipped(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let n = root.nodeType === 1 ? root : w.nextNode();
  while (n) {
    if (n.nodeType === 3) trText(n);
    else for (const a of ATTRS) if (n.hasAttribute(a)) trAttr(n, a);
    n = w.nextNode();
  }
}

// traduce anche tutto ciò che compare dopo (schermate, finestre, menu, avvisi)
export function startTranslating(root = document.documentElement) {
  if (!table || observer) return;
  translateTree(root);
  observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') { if (!skipped(m.target.parentNode)) trText(m.target); }
      else if (m.type === 'attributes') { if (!skipped(m.target)) trAttr(m.target, m.attributeName); }
      else for (const n of m.addedNodes) translateTree(n);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// documenti da stampare (ricevute, report): stessa traduzione sull'HTML completo
export function translateHTML(html) {
  if (!table) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  translateTree(doc.documentElement);
  return '<!doctype html>' + doc.documentElement.outerHTML;
}
