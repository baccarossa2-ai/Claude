// Chiusura di cassa: righe del giorno (una per ricevuta) e riepilogo complessivo,
// con le stesse voci del foglio cartaceo della palestra (a…n).
import { db, payKind, lineCategory } from './db.js';
import { toISO, parseISO } from './format.js';

const CATS = ['corso', 'saggio', 'iscrizione', 'tesseramento', 'commerciale'];
const round = n => Math.round(n * 100) / 100;

function inSede(r, sedeId) {
  if (!sedeId) return true;
  const main = db.mainSede();
  return (r.sedeId || (main ? main.id : '')) === sedeId;
}

function athleteName(r) {
  const a = r.atleta && (r.atleta.nome || r.atleta.cognome) ? r.atleta : r.intestatario || {};
  return `${a.cognome || ''} ${a.nome || ''}`.trim().toUpperCase();
}

// "Mezze punte" -> "MEZZEP.", "Body" -> "BODY": note brevi come sul foglio
export function shortNote(d) {
  const w = String(d || '').trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!w.length) return '';
  if (w.length === 1) return w[0].length > 9 ? w[0].slice(0, 8) + '.' : w[0];
  if (w[0].length <= 6 && w[1]) return (w[0] + w[1].slice(0, 1) + '.').slice(0, 9);
  return w[0].slice(0, 8) + '.';
}

export function receiptsOfDay(dateISO, sedeId) {
  return db.receipts
    .filter(r => r.data === dateISO && !r.annullata && inSede(r, sedeId))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.numero - b.numero);
}

export function rowOf(r, i) {
  const kind = payKind(r.metodo);
  const row = { n: i + 1, nome: athleteName(r), bonifico: 0, contante: 0, pos: 0, note: [], ricevuta: `RIC. ${r.numero}`, id: r.id, tipo: r.tipo };
  for (const c of CATS) row[c] = 0;
  for (const l of r.righe || []) {
    const c = lineCategory(r, l);
    row[CATS.includes(c) ? c : 'corso'] += Number(l.importo) || 0;
    if (c === 'commerciale') row.note.push(shortNote(l.descrizione));
  }
  row[kind] = Number(r.totale) || 0;
  row.note = row.note.filter(Boolean).join(', ');
  for (const k of ['bonifico', 'contante', 'pos', ...CATS]) row[k] = round(row[k]);
  return row;
}

function sum(rows, k) { return round(rows.reduce((t, r) => t + (Number(r[k]) || 0), 0)); }

export function summary(rows, uscite = []) {
  const a = sum(rows, 'contante');
  const b = sum(rows, 'pos');
  const d = sum(rows, 'corso');
  const e = sum(rows, 'saggio');
  const g = sum(rows, 'iscrizione');
  const h = sum(rows, 'tesseramento');
  const l = sum(rows, 'commerciale');
  const m = round(uscite.reduce((t, u) => t + (Number(u.importo) || 0), 0));
  return {
    a, b, c: round(a + b), d, e, f: round(d + e), g, h, i: round(g + h), l, m, n: round(a - m),
    bonifico: sum(rows, 'bonifico'),
    totals: Object.fromEntries(['bonifico', 'contante', 'pos', ...CATS].map(k => [k, sum(rows, k)])),
  };
}

export function day(dateISO, sedeId) {
  const rows = receiptsOfDay(dateISO, sedeId).map(rowOf);
  const closure = db.closure(dateISO, sedeId);
  return { rows, closure, sum: summary(rows, closure.uscite || []) };
}

export function month(year, month1, sedeId) {
  const days = [];
  const last = new Date(year, month1, 0).getDate();
  const all = [];
  const uscite = [];
  for (let g = 1; g <= last; g++) {
    const iso = toISO(new Date(year, month1 - 1, g));
    const dd = day(iso, sedeId);
    if (dd.rows.length || (dd.closure.uscite || []).length || dd.closure.note) {
      days.push({ iso, giorno: g, count: dd.rows.length, sum: dd.sum, note: dd.closure.note || '' });
      for (const u of dd.closure.uscite || []) uscite.push({ ...u, iso });
    }
    all.push(...dd.rows);
  }
  return { days, sum: summary(all, uscite), uscite, count: all.length };
}

export function sedeName(sedeId) {
  const s = db.sedi().find(x => x.id === sedeId);
  return s ? (s.nome || s.comune || '') : '';
}

export function sedeLabel(sedeId) {
  const s = db.sedi().find(x => x.id === sedeId);
  if (!s) return 'TUTTE LE SEDI';
  return (s.comune || s.nome || '').toUpperCase();
}

export const isValidDay = iso => !!parseISO(iso);
