// Suggerimenti dei comuni italiani (e stati esteri) con compilazione automatica di provincia e CAP.
import { COMUNI } from '../data/comuni.js';
import { STATI_ESTERI } from '../data/stati.js';
import { normalize, esc } from './format.js';
import { el } from './ui.js';

const INDEX = COMUNI.map(c => ({ n: normalize(c[0]), nome: c[0], prov: c[1], code: c[2], cap: c[3] }));
const ESTERI = STATI_ESTERI.map(s => ({ n: normalize(s[0]), nome: s[0], prov: 'EE', code: s[1], cap: '', estero: true }));

export function searchPlaces(q, { esteri = false, limit = 8 } = {}) {
  const n = normalize(q).trim();
  if (!n) return [];
  const pool = esteri ? INDEX.concat(ESTERI) : INDEX;
  const starts = [];
  const contains = [];
  for (const p of pool) {
    if (p.n.startsWith(n)) starts.push(p);
    else if (n.length > 2 && p.n.includes(n)) contains.push(p);
    if (starts.length >= limit) break;
  }
  return starts.concat(contains).slice(0, limit);
}

// Collega l'autocompletamento a un campo di testo
export function placeAutocomplete(input, { esteri = false, onPick } = {}) {
  const wrap = input.parentElement;
  wrap.classList.add('rel');
  const list = el('<div class="ac-list hidden"></div>');
  wrap.appendChild(list);
  let items = [];
  let sel = 0;
  const draw = () => {
    items = searchPlaces(input.value, { esteri });
    list.classList.toggle('hidden', !items.length || document.activeElement !== input);
    list.innerHTML = items.map((p, i) => `<div class="ac-item ${i === sel ? 'sel' : ''}" data-i="${i}"><b>${esc(p.nome)}</b><small>${p.estero ? 'Stato estero' : `${esc(p.prov)}${p.cap ? ' · ' + esc(p.cap) : ''}`}</small></div>`).join('');
  };
  const pick = i => {
    const p = items[i];
    if (!p) return;
    input.value = p.nome;
    list.classList.add('hidden');
    onPick && onPick(p);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  input.setAttribute('autocomplete', 'off');
  input.addEventListener('input', () => { sel = 0; draw(); });
  input.addEventListener('focus', draw);
  input.addEventListener('blur', () => setTimeout(() => list.classList.add('hidden'), 150));
  input.addEventListener('keydown', e => {
    if (list.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
    if (e.key === 'Enter') { pick(sel); e.preventDefault(); }
    if (e.key === 'Escape') list.classList.add('hidden');
  });
  list.addEventListener('mousedown', e => {
    const it = e.target.closest('[data-i]');
    if (it) { e.preventDefault(); pick(Number(it.dataset.i)); }
  });
}
