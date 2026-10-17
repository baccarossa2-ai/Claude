// Importi in lettere, come richiesto sulle ricevute ("centocinquanta/00").

const U = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici',
  'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
const T = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];

function below100(n) {
  if (n < 20) return U[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  let w = T[t];
  if (u === 1 || u === 8) w = w.slice(0, -1);
  return w + (u ? U[u] : '');
}

function below1000(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let w = h === 0 ? '' : h === 1 ? 'cento' : U[h] + 'cento';
  if (r) {
    const rw = below100(r);
    if (h && rw.startsWith('ott')) w = w.slice(0, -1);
    w += rw;
  }
  return w;
}

export function numberToWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return 'zero';
  const parts = [];
  const billions = Math.floor(n / 1e9); n %= 1e9;
  const millions = Math.floor(n / 1e6); n %= 1e6;
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const shorten = w => (w.endsWith('uno') ? w.slice(0, -1) : w);
  if (billions) parts.push(billions === 1 ? 'unmiliardo' : shorten(below1000(billions)) + 'miliardi');
  if (millions) parts.push(millions === 1 ? 'unmilione' : shorten(below1000(millions)) + 'milioni');
  if (thousands) parts.push(thousands === 1 ? 'mille' : shorten(below1000(thousands)) + 'mila');
  if (rest) parts.push(below1000(rest));
  let out = parts.join('');
  if (out.length > 3 && out.endsWith('tre')) out = out.slice(0, -3) + 'tré';
  return out;
}

export function euroInWords(amount) {
  const cents = Math.round((Number(amount) || 0) * 100);
  const intPart = Math.floor(cents / 100);
  const dec = String(cents % 100).padStart(2, '0');
  return `${numberToWords(intPart)}/${dec}`;
}
