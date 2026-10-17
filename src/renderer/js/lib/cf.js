// Codice fiscale italiano: calcolo, verifica e decodifica (DM 23/12/1976).
import { COMUNI } from '../data/comuni.js';
import { STATI_ESTERI } from '../data/stati.js';

const MESI = 'ABCDEHLMPRST';
const ODD = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8,
  S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
const OMOCODIA = 'LMNPQRSTUV';

const strip = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, '');
const cons = s => strip(s).replace(/[AEIOU]/g, '');
const vow = s => strip(s).replace(/[^AEIOU]/g, '');

function codeSurname(s) {
  return (cons(s) + vow(s) + 'XXX').slice(0, 3);
}

function codeName(s) {
  const c = cons(s);
  if (c.length >= 4) return c[0] + c[2] + c[3];
  return (c + vow(s) + 'XXX').slice(0, 3);
}

export function checkChar(code15) {
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const ch = code15[i];
    if (i % 2 === 0) sum += ODD[ch];
    else sum += /\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 65;
  }
  return String.fromCharCode(65 + (sum % 26));
}

// Cerca il codice catastale di un comune italiano o di uno stato estero
export function placeCode(luogo, provincia) {
  const name = String(luogo || '').trim().toLowerCase();
  if (!name) return null;
  const norm = x => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const n = norm(name);
  const prov = String(provincia || '').trim().toUpperCase();
  const hits = COMUNI.filter(c => norm(c[0]) === n);
  const hit = hits.find(c => !prov || c[1] === prov) || hits[0];
  if (hit) return hit[2];
  const estero = STATI_ESTERI.find(s => norm(s[0]) === n);
  return estero ? estero[1] : null;
}

export function computeCF({ nome, cognome, dataNascita, sesso, luogoNascita, provinciaNascita }) {
  if (!nome || !cognome || !dataNascita || !sesso || !luogoNascita) {
    return { ok: false, error: 'Servono nome, cognome, sesso, data e luogo di nascita.' };
  }
  const d = new Date(dataNascita + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return { ok: false, error: 'Data di nascita non valida.' };
  const place = placeCode(luogoNascita, provinciaNascita);
  if (!place) return { ok: false, error: `Comune o stato "${luogoNascita}" non trovato.` };
  const yy = String(d.getFullYear()).slice(-2);
  const mm = MESI[d.getMonth()];
  const dd = String(d.getDate() + (sesso === 'F' ? 40 : 0)).padStart(2, '0');
  const code15 = codeSurname(cognome) + codeName(nome) + yy + mm + dd + place;
  return { ok: true, value: code15 + checkChar(code15) };
}

export function validateCF(cf) {
  const v = String(cf || '').toUpperCase().replace(/\s/g, '');
  if (!v) return { ok: false, error: 'Vuoto' };
  if (/^\d{11}$/.test(v)) return validatePIVA(v); // CF numerico di società/associazioni
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(v)) {
    return { ok: false, error: 'Formato non valido' };
  }
  if (checkChar(v.slice(0, 15)) !== v[15]) return { ok: false, error: 'Carattere di controllo errato' };
  return { ok: true, value: v };
}

export function validatePIVA(p) {
  const v = String(p || '').replace(/\s/g, '').replace(/^IT/i, '');
  if (!/^\d{11}$/.test(v)) return { ok: false, error: 'Deve avere 11 cifre' };
  let s = 0;
  for (let i = 0; i < 11; i++) {
    let n = Number(v[i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    s += n;
  }
  return s % 10 === 0 ? { ok: true, value: v } : { ok: false, error: 'Cifra di controllo errata' };
}

// Ricava data di nascita, sesso e luogo da un codice fiscale valido
export function decodeCF(cf) {
  const r = validateCF(cf);
  if (!r.ok || /^\d+$/.test(r.value)) return null;
  const v = r.value.split('');
  for (const i of [6, 7, 9, 10, 12, 13, 14]) {
    const k = OMOCODIA.indexOf(v[i]);
    if (k >= 0) v[i] = String(k);
  }
  const s = v.join('');
  let yy = Number(s.slice(6, 8));
  const month = MESI.indexOf(s[8]);
  let day = Number(s.slice(9, 11));
  const sesso = day > 40 ? 'F' : 'M';
  if (day > 40) day -= 40;
  const nowYY = new Date().getFullYear() % 100;
  yy += yy > nowYY ? 1900 : 2000;
  const code = s.slice(11, 15);
  const comune = COMUNI.find(c => c[2] === code);
  const estero = !comune && STATI_ESTERI.find(x => x[1] === code);
  return {
    dataNascita: `${yy}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    sesso,
    luogoNascita: comune ? comune[0] : estero ? estero[0] : '',
    provinciaNascita: comune ? comune[1] : estero ? 'EE' : '',
  };
}
