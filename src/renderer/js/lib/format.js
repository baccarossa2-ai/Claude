// Formattazione all'italiana: date, valuta, età, iniziali e piccoli aiuti.

export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

const euroFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const numFmt = new Intl.NumberFormat('it-IT');

export const euro = n => euroFmt.format(Number(n) || 0);
export const num = n => numFmt.format(Number(n) || 0);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function todayISO() {
  const d = new Date();
  return toISO(d);
}

export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseISO(s) {
  if (!s) return null;
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

export function date(s, opts) {
  const d = parseISO(s);
  if (!d) return '—';
  if (opts === 'long') return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
  if (opts === 'short') return `${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function dateTime(ts) {
  const d = new Date(ts);
  return `${date(toISO(d))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function time(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function daysUntil(s) {
  const d = parseISO(s);
  if (!d) return null;
  const t = parseISO(todayISO());
  return Math.round((d - t) / 86400000);
}

export function age(birth, at) {
  const b = parseISO(birth);
  if (!b) return null;
  const now = at ? parseISO(at) : new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

export function relDays(n) {
  if (n === null || n === undefined) return '';
  if (n === 0) return 'oggi';
  if (n === 1) return 'domani';
  if (n === -1) return 'ieri';
  if (n > 0) return `tra ${n} giorni`;
  return `${-n} giorni fa`;
}

export function relTime(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 45) return 'adesso';
  if (diff < 3600) return `${Math.round(diff / 60)} min fa`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h fa`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} g fa`;
  return date(toISO(new Date(ts)));
}

export function initials(nome, cognome) {
  return ((nome || '').trim()[0] || '') + ((cognome || '').trim()[0] || '') || '?';
}

export function fullName(p) {
  if (!p) return '';
  return [p.cognome, p.nome].filter(Boolean).join(' ');
}

export function fullNameNC(p) {
  if (!p) return '';
  return [p.nome, p.cognome].filter(Boolean).join(' ');
}

export function titleCase(s) {
  return String(s || '').toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

const PALETTE = ['#6366F1', '#8B5CF6', '#EC4899', '#F97316', '#10B981', '#0EA5E9', '#EAB308', '#14B8A6', '#E11D48', '#A855F7', '#22C55E', '#3B82F6'];
export function colorFor(str) {
  let h = 0;
  for (const ch of String(str || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function address(a) {
  if (!a) return '';
  const l1 = [a.indirizzo, a.civico].filter(Boolean).join(', ');
  const l2 = [a.cap, a.comune, a.provincia ? `(${a.provincia})` : ''].filter(Boolean).join(' ');
  return [l1, l2].filter(Boolean).join(' – ');
}

export function phoneIntl(p) {
  let n = String(p || '').replace(/[^\d+]/g, '');
  if (!n) return '';
  if (n.startsWith('+')) return n.slice(1);
  if (n.startsWith('00')) return n.slice(2);
  if (n.startsWith('3') && n.length >= 9) return '39' + n;
  if (n.startsWith('0')) return '39' + n;
  return n;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function fillTemplate(text, vars) {
  return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null && vars[k] !== '' ? vars[k] : m));
}
