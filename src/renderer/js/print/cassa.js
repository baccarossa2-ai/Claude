// Stampa della chiusura di cassa giornaliera (come il foglio della palestra) e del riepilogo mensile.
import { esc, MESI, date, currencySymbol, amount } from '../lib/format.js';
import { docShell } from './documents.js';
import { sedeLabel } from '../lib/cassa.js';
import { companyName } from './receipt.js';

// "€ 325,00" con il simbolo a sinistra; zero = "€ -" come sul foglio
function money(n, empty = '-') {
  const v = Number(n) || 0;
  const t = v ? amount(v) : empty;
  return `<span class="m"><i>${currencySymbol()}</i><b>${t}</b></span>`;
}
const cell = v => (Number(v) ? money(v) : '');

const CSS = `
  body{font-family:Calibri,'Plus Jakarta Sans',Arial,sans-serif;color:#111;font-size:8.6pt}
  .hd{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;align-items:end;margin:0 0 2mm;font:700 11pt 'Times New Roman',serif}
  .hd span:nth-child(2){text-align:center}.hd span:nth-child(3){text-align:center}.hd span:nth-child(4){text-align:right}
  table.sh{width:100%;border-collapse:collapse;table-layout:fixed}
  .sh th,.sh td{border:1px solid #222;padding:.6mm 1.2mm;height:5.4mm;vertical-align:middle;overflow:hidden;white-space:nowrap}
  .sh th{font-size:7.4pt;font-weight:700;text-align:center;line-height:1.1;height:9mm;white-space:normal}
  .sh td.n{text-align:right;width:6mm}
  .sh td.t{font-size:8pt}
  .sh tr.tot td{font-weight:700;background:#f3f3f3}
  .m{display:flex;justify-content:space-between;gap:2mm}.m i{font-style:normal}.m b{font-weight:inherit}
  .rp{display:grid;grid-template-columns:1fr 1fr;gap:18mm;margin-top:5mm;page-break-inside:avoid}
  .rp table{width:100%;border-collapse:collapse}
  .rp td{border:1px solid #222;padding:1mm 2mm;height:7.5mm;font-size:8.4pt;text-align:center}
  .rp td.k{width:16mm}
  .rp td.v{width:32mm}
  .rp td.lab{font-weight:400}
  .rp td.lab b{font-weight:700}
  .rp caption{font-weight:700;padding-bottom:1.5mm;text-align:center;font-size:8.6pt;letter-spacing:.02em}
  .ex{margin-top:4mm;page-break-inside:avoid;font-size:8.4pt}
  .ex table{border-collapse:collapse;min-width:120mm}.ex td{border:1px solid #222;padding:1mm 2mm}
  .ex .nt{border:1px solid #222;padding:2mm;min-height:12mm;white-space:pre-wrap}
  .foot{margin-top:3mm;font-size:7pt;color:#777;text-align:right}
  h2{font:700 12pt 'Times New Roman',serif;margin:0 0 2mm}
`;

const COLS = [
  ['N.', 7], ['COGNOME E NOME', 44], ['BONIFICO', 19], ['CONTANTE', 19], ['POS', 19], ['QUOTE CORSO', 19], ['QUOTA SAGGIO/GARE', 19],
  ['QUOTE ISCRIZIONE', 19], ['QUOTE TESSERAM.', 18], ['CORRISP COMM', 18], ['NOTE', 18], ['RICEVUTE', 19],
];

function riepilogo(s) {
  const L = [
    ['a)', 'TOTALE CONTANTE', s.a], ['b)', 'TOTALE POS', s.b], ['c = (a + b)', '<b>TOTALE RICAVI DEL GIORNO</b>', s.c],
    ['d)', 'TOTALE QUOTA CORSO', s.d], ['e)', 'TOTALE QUOTA SAGGIO', s.e], ['f=(d+e)', '<b>TOT CORRISP ISTITUZ</b>', s.f],
  ];
  const R = [
    ['g)', 'TOT.QUOTE ISCRIZIONE', s.g], ['h)', 'TOTALE QUOTE TESSERAM.', s.h], ['i)=(g+h)', '<b>TOT.QUOTE ISCRIZ. E TESS.</b>', s.i],
    ['l)', '<b>TOTALE CORRISP COMM</b>', s.l], ['m)', 'TOTALE USCITE', s.m], ['n)=(a-m)', '<b>TOTALE CASSA CONTANTI</b>', s.n],
  ];
  const tb = (rows, cap) => `<table>${cap ? `<caption>${cap}</caption>` : '<caption>&nbsp;</caption>'}${rows.map(([k, l, v]) => `<tr><td class="k">${k}</td><td class="lab">${l}</td><td class="v">${money(v)}</td></tr>`).join('')}</table>`;
  return `<div class="rp">${tb(L, 'RIEPILOGO COMPLESSIVO')}${tb(R, '')}</div>`;
}

function extras(closure) {
  const us = closure.uscite || [];
  if (!us.length && !closure.note) return '';
  return `<div class="ex">
    ${us.length ? `<b>USCITE DEL GIORNO</b><table>${us.map(u => `<tr><td>${esc(u.descrizione || '')}</td><td style="width:32mm">${money(u.importo)}</td></tr>`).join('')}</table>` : ''}
    ${closure.note ? `<p style="margin:3mm 0 1mm"><b>NOTE</b></p><div class="nt">${esc(closure.note)}</div>` : ''}
  </div>`;
}

export function dailyHTML(dateISO, sedeId, data) {
  const d = new Date(dateISO + 'T00:00:00');
  const rows = data.rows;
  const min = Math.max(14, rows.length + 2);
  const body = [];
  for (let i = 0; i < min; i++) {
    const r = rows[i];
    body.push(r ? `<tr><td class="n">${r.n}</td><td class="t">${esc(r.nome)}</td><td>${cell(r.bonifico)}</td><td>${cell(r.contante)}</td><td>${cell(r.pos)}</td><td>${cell(r.corso)}</td><td>${cell(r.saggio)}</td><td>${cell(r.iscrizione)}</td><td>${cell(r.tesseramento)}</td><td>${cell(r.commerciale)}</td><td class="t">${esc(r.note)}</td><td class="t">${esc(r.ricevuta)}</td></tr>`
      : `<tr><td class="n">${i < rows.length + 1 ? '' : ''}</td>${'<td></td>'.repeat(11)}</tr>`);
  }
  const t = data.sum.totals;
  const html = `
    <div class="hd"><span>SEDE: ${esc(sedeLabel(sedeId))}</span><span>MESE DI: ${MESI[d.getMonth()].toUpperCase()}</span><span>ANNO ${d.getFullYear()}</span><span>GIORNO: ${d.getDate()}</span></div>
    <table class="sh"><colgroup>${COLS.map(([, w]) => `<col style="width:${w}mm">`).join('')}</colgroup>
      <thead><tr>${COLS.map(([h]) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${body.join('')}
        <tr class="tot"><td></td><td></td><td>${money(t.bonifico)}</td><td>${money(t.contante)}</td><td>${money(t.pos)}</td><td>${money(t.corso)}</td><td>${money(t.saggio)}</td><td>${money(t.iscrizione)}</td><td>${money(t.tesseramento)}</td><td>${money(t.commerciale)}</td><td></td><td></td></tr>
      </tbody></table>
    ${riepilogo(data.sum)}
    ${extras(data.closure)}
    <div class="foot">${esc(companyName())} · chiusura del ${date(dateISO)}</div>`;
  return docShell({ title: `Chiusura di cassa ${date(dateISO)}`, landscape: true, css: CSS, body: html });
}

export function monthlyHTML(year, month1, sedeId, data) {
  const rows = data.days.map(g => `<tr><td class="n">${g.giorno}</td><td class="t">${date(g.iso)}</td><td style="text-align:center">${g.count}</td><td>${cell(g.sum.bonifico)}</td><td>${cell(g.sum.a)}</td><td>${cell(g.sum.b)}</td><td>${cell(g.sum.d)}</td><td>${cell(g.sum.e)}</td><td>${cell(g.sum.g)}</td><td>${cell(g.sum.h)}</td><td>${cell(g.sum.l)}</td><td>${cell(g.sum.m)}</td><td>${money(g.sum.n)}</td></tr>`).join('');
  const s = data.sum;
  const head = [['G.', 7], ['DATA', 22], ['RIC.', 11], ['BONIFICO', 22], ['CONTANTE', 22], ['POS', 22], ['QUOTE CORSO', 22], ['SAGGIO/GARE', 22], ['ISCRIZIONI', 22], ['TESSERAM.', 22], ['CORRISP COMM', 22], ['USCITE', 22], ['CASSA CONTANTI', 24]];
  const html = `
    <div class="hd"><span>SEDE: ${esc(sedeLabel(sedeId))}</span><span>MESE DI: ${MESI[month1 - 1].toUpperCase()}</span><span>ANNO ${year}</span><span>RIEPILOGO MENSILE</span></div>
    <table class="sh"><colgroup>${head.map(([, w]) => `<col style="width:${w}mm">`).join('')}</colgroup>
      <thead><tr>${head.map(([h]) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows || `<tr><td colspan="13" style="text-align:center">Nessun movimento nel mese</td></tr>`}
        <tr class="tot"><td></td><td>TOTALE</td><td style="text-align:center">${data.count}</td><td>${money(s.bonifico)}</td><td>${money(s.a)}</td><td>${money(s.b)}</td><td>${money(s.d)}</td><td>${money(s.e)}</td><td>${money(s.g)}</td><td>${money(s.h)}</td><td>${money(s.l)}</td><td>${money(s.m)}</td><td>${money(s.n)}</td></tr>
      </tbody></table>
    ${riepilogo(s)}
    ${data.uscite.length ? `<div class="ex"><b>USCITE DEL MESE</b><table>${data.uscite.map(u => `<tr><td style="width:24mm">${date(u.iso)}</td><td>${esc(u.descrizione || '')}</td><td style="width:32mm">${money(u.importo)}</td></tr>`).join('')}</table></div>` : ''}
    <div class="foot">${esc(companyName())} · riepilogo di ${MESI[month1 - 1]} ${year}</div>`;
  return docShell({ title: `Riepilogo cassa ${MESI[month1 - 1]} ${year}`, landscape: true, css: CSS, body: html });
}
