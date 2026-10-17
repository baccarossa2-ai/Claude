// Modello di stampa delle ricevute (generali e commerciali) per A4, A5 e stampanti termiche.
import { db } from '../lib/db.js';
import { esc, euro, date, address, MESI } from '../lib/format.js';
import { euroInWords } from '../lib/words.js';
import { docShell } from './documents.js';
import { mediaToDataUrl } from '../lib/ui.js';

export const DETRAZIONE_TEXT = 'Ricevuta valida ai fini della detrazione IRPEF del 19% per le spese sostenute per la pratica sportiva dilettantistica di ragazzi di età compresa tra 5 e 18 anni (art. 15, comma 1, lett. i-quinquies, TUIR – D.M. 28/03/2007).';

export function companyName(c = db.company) {
  return c.tipoSoggetto === 'persona' ? `${c.nome || ''} ${c.cognome || ''}`.trim() : c.denominazione || '';
}

export function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MESI[Number(m) - 1]} ${y}`;
}

export function needsBollo(r) {
  const s = db.settings.receipts;
  return Number(r.totale || 0) > Number(s.bolloThreshold || 77.47);
}

function one(r, logo, label, compact) {
  const c = db.company;
  const sede = (c.sedi || []).find(s => s.principale) || (c.sedi || [])[0];
  const legal = address(c.fatturazione) || address(sede);
  const tipoLabel = r.tipo === 'commerciale' ? 'Ricevuta commerciale' : 'Ricevuta generale';
  const payer = r.intestatario || {};
  const ath = r.atleta || {};
  const samePerson = payer.codiceFiscale && ath.codiceFiscale ? payer.codiceFiscale === ath.codiceFiscale : `${payer.nome} ${payer.cognome}` === `${ath.nome} ${ath.cognome}`;
  const s = db.settings.receipts;
  const dicitura = (s.diciture && s.diciture[r.tipo]) || '';
  const mesi = (r.mesi || []).map(monthLabel).join(', ');
  return `<section class="rc ${compact ? 'compact' : ''} ${r.annullata ? 'void' : ''}">
    ${r.annullata ? '<div class="stamp">ANNULLATA</div>' : ''}
    <header>
      <div class="brand">
        ${logo ? `<img src="${logo}" alt="">` : `<div class="mono-logo">${esc(companyName().slice(0, 1))}</div>`}
        <div>
          <h1>${esc(companyName())}</h1>
          <p>${esc([c.tipoSoggetto !== 'persona' ? c.formaGiuridica : '', legal].filter(Boolean).join(' · '))}</p>
          <p>${esc([c.partitaIva ? `P.IVA ${c.partitaIva}` : '', c.codiceFiscale ? `C.F. ${c.codiceFiscale}` : ''].filter(Boolean).join(' · '))}</p>
          <p>${esc([c.telefono || c.cellulare, c.email, c.sito].filter(Boolean).join(' · '))}</p>
        </div>
      </div>
      <div class="num">
        <span class="kind ${r.tipo}">${tipoLabel}</span>
        <b>N. ${esc(r.numero)}<small>/${esc(r.anno)}</small></b>
        <span>del ${date(r.data)}</span>
        ${label ? `<em>${esc(label)}</em>` : ''}
      </div>
    </header>
    <div class="parties">
      <div><span>Ricevuto da</span><b>${esc(`${payer.nome || ''} ${payer.cognome || ''}`.trim() || '—')}</b>
        ${payer.codiceFiscale ? `<small>C.F. ${esc(payer.codiceFiscale)}</small>` : ''}
        ${payer.residenza && address(payer.residenza) ? `<small>${esc(address(payer.residenza))}</small>` : ''}</div>
      ${!samePerson && (ath.nome || ath.cognome) ? `<div><span>Per l'atleta</span><b>${esc(`${ath.nome || ''} ${ath.cognome || ''}`)}</b>
        <small>${esc([ath.luogoNascita ? `nato/a a ${ath.luogoNascita}` : '', ath.dataNascita ? `il ${date(ath.dataNascita)}` : ''].filter(Boolean).join(' '))}</small>
        ${ath.codiceFiscale ? `<small>C.F. ${esc(ath.codiceFiscale)}</small>` : ''}</div>` : ''}
    </div>
    <table class="lines">
      <thead><tr><th>Causale</th><th class="r">Importo</th></tr></thead>
      <tbody>${(r.righe || []).map(l => `<tr><td>${esc(l.descrizione)}${l === r.righe[0] && (r.disciplina || mesi) ? `<div class="sub">${esc([r.disciplina, mesi ? `Periodo: ${mesi}` : ''].filter(Boolean).join(' · '))}</div>` : ''}</td><td class="r">${euro(l.importo)}</td></tr>`).join('')}</tbody>
    </table>
    <div class="total">
      <div class="words">Importo in lettere: <b>euro ${esc(euroInWords(r.totale))}</b><br>Pagamento: <b>${esc(r.metodo || '—')}</b></div>
      <div class="sum"><span>Totale</span><b>${euro(r.totale)}</b></div>
    </div>
    ${r.detrazione ? `<p class="note detr">${esc(DETRAZIONE_TEXT)}</p>` : ''}
    ${dicitura ? `<p class="note">${esc(dicitura)}</p>` : ''}
    ${r.note ? `<p class="note">Note: ${esc(r.note)}</p>` : ''}
    <footer>
      ${r.bollo ? `<div class="bollo">Marca da bollo<br><b>€ ${Number(s.bolloAmount || 2).toFixed(2).replace('.', ',')}</b></div>` : '<div></div>'}
      <div class="sign"><div class="line"></div><span>${esc(s.firma || 'Timbro e firma')}</span></div>
    </footer>
    ${s.footer && !compact ? `<p class="thanks">${esc(s.footer)}</p>` : ''}
  </section>`;
}

const CSS = `
  .rc{position:relative;padding:8mm 9mm;border:1.2px solid #ddd8f0;border-radius:10px;overflow:hidden}
  .rc+.rc{margin-top:0}
  .cut{border-top:1.5px dashed #b9b4d4;margin:7mm 0;position:relative}
  .cut::after{content:'✂';position:absolute;left:8px;top:-11px;background:#fff;padding:0 4px;color:#8a86a6;font-size:12pt}
  header{display:flex;justify-content:space-between;gap:10mm;padding-bottom:5mm;border-bottom:2.5px solid #7C4DFF}
  .brand{display:flex;gap:4mm;align-items:flex-start}
  .brand img{width:20mm;height:20mm;object-fit:contain;border-radius:3mm}
  .mono-logo{width:18mm;height:18mm;border-radius:4mm;background:linear-gradient(135deg,#5B5BF6,#8B3DF0,#E9468F);color:#fff;display:grid;place-items:center;font:700 22pt Outfit,sans-serif}
  .brand h1{font-size:17pt;line-height:1.1;color:#1b1838}
  .brand p{margin:1mm 0 0;font-size:8.6pt;color:#5d5980}
  .num{text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:1mm;white-space:nowrap}
  .num .kind{font-size:8pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:1.2mm 3mm;border-radius:20mm;background:#F1EEFF;color:#5B2BD6}
  .num .kind.commerciale{background:#E6F6FF;color:#0369A1}
  .num b{font:700 22pt Outfit,sans-serif;color:#1b1838}
  .num b small{font-size:12pt;color:#8a86a6}
  .num span{font-size:9.5pt;color:#5d5980}
  .num em{font-style:normal;font-size:7.5pt;font-weight:800;letter-spacing:.1em;color:#E9468F;text-transform:uppercase}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin:5mm 0 4mm}
  .parties div{background:#FAF9FE;border:1px solid #ece9f7;border-radius:3mm;padding:3mm 4mm}
  .parties span{display:block;font-size:7.5pt;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a86a6}
  .parties b{display:block;font-size:11.5pt;margin:.5mm 0}
  .parties small{display:block;font-size:8.6pt;color:#5d5980}
  table.lines{width:100%;border-collapse:collapse;font-size:10pt}
  .lines th{text-align:left;font-size:7.5pt;letter-spacing:.1em;text-transform:uppercase;color:#8a86a6;border-bottom:1px solid #e3e0f0;padding:1.5mm 0}
  .lines td{padding:2.2mm 0;border-bottom:1px solid #f0eef8;vertical-align:top}
  .lines .sub{font-size:8.5pt;color:#8a86a6;margin-top:.5mm}
  .r{text-align:right;white-space:nowrap}
  .total{display:flex;justify-content:space-between;align-items:center;gap:8mm;margin-top:4mm}
  .words{font-size:9.2pt;color:#3c3860;line-height:1.6}
  .sum{background:linear-gradient(135deg,#5B5BF6,#8B3DF0 60%,#E9468F);color:#fff;border-radius:3mm;padding:3mm 6mm;text-align:right;min-width:48mm}
  .sum span{display:block;font-size:7.5pt;letter-spacing:.14em;text-transform:uppercase;opacity:.85}
  .sum b{font:700 18pt Outfit,sans-serif}
  .note{font-size:8.2pt;color:#5d5980;margin:3mm 0 0;line-height:1.45}
  .note.detr{background:#F6FFF9;border-left:3px solid #10B981;padding:2mm 3mm;border-radius:1.5mm;color:#1f5d45}
  footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:6mm}
  .bollo{width:24mm;height:28mm;border:1.5px dashed #b9b4d4;border-radius:2mm;display:grid;place-items:center;text-align:center;font-size:7.5pt;color:#8a86a6;line-height:1.4}
  .sign{width:68mm;text-align:center;font-size:8.5pt;color:#8a86a6}
  .sign .line{border-bottom:1px solid #8a86a6;height:12mm;margin-bottom:1.5mm}
  .thanks{text-align:center;font-size:8.5pt;color:#8a86a6;margin:4mm 0 0}
  .void .stamp{position:absolute;inset:0;display:grid;place-items:center;font:800 54pt Outfit,sans-serif;color:rgba(239,68,68,.22);transform:rotate(-18deg);pointer-events:none;letter-spacing:.1em}
  .compact{padding:5mm 7mm}
  .compact header{padding-bottom:3mm}
  .compact .brand img{width:15mm;height:15mm}
  .compact .brand h1{font-size:14pt}
  .compact .parties{margin:3mm 0}
  .compact footer{margin-top:3mm}
  .compact .bollo{height:20mm}
  .compact .sign .line{height:8mm}
`;

const THERMAL_CSS = `
  body{font-size:9pt;width:100%}
  .t{padding:1mm}
  .t img{width:22mm;height:22mm;object-fit:contain;margin:0 auto 1mm;display:block}
  .t h1{font-size:12pt;text-align:center}
  .t .c{text-align:center;font-size:8pt;margin:.5mm 0}
  .t hr{border:0;border-top:1px dashed #000;margin:2mm 0}
  .t .row{display:flex;justify-content:space-between;gap:2mm}
  .t .big{font-size:13pt;font-weight:800}
  .t .k{font-size:7.5pt;text-transform:uppercase;letter-spacing:.06em}
  .t p{margin:1mm 0}
`;

function thermal(r, logo) {
  const c = db.company;
  const payer = r.intestatario || {};
  const ath = r.atleta || {};
  const s = db.settings.receipts;
  return `<div class="t">
    ${logo ? `<img src="${logo}" alt="">` : ''}
    <h1>${esc(companyName())}</h1>
    <p class="c">${esc(address(c.fatturazione))}</p>
    <p class="c">${esc([c.partitaIva ? `P.IVA ${c.partitaIva}` : '', c.codiceFiscale ? `C.F. ${c.codiceFiscale}` : ''].filter(Boolean).join(' '))}</p>
    <hr><p class="c big">${r.tipo === 'commerciale' ? 'RICEVUTA COMMERCIALE' : 'RICEVUTA GENERALE'}</p>
    <div class="row"><span>N. ${r.numero}/${r.anno}</span><span>${date(r.data)}</span></div>
    ${r.annullata ? '<p class="c big">*** ANNULLATA ***</p>' : ''}
    <hr><p class="k">Ricevuto da</p><p><b>${esc(`${payer.nome || ''} ${payer.cognome || ''}`)}</b>${payer.codiceFiscale ? `<br>C.F. ${esc(payer.codiceFiscale)}` : ''}</p>
    ${ath.nome && `${ath.nome} ${ath.cognome}` !== `${payer.nome} ${payer.cognome}` ? `<p class="k">Atleta</p><p>${esc(`${ath.nome} ${ath.cognome}`)}${ath.codiceFiscale ? `<br>C.F. ${esc(ath.codiceFiscale)}` : ''}</p>` : ''}
    <hr>${(r.righe || []).map(l => `<div class="row"><span>${esc(l.descrizione)}</span><span>${euro(l.importo)}</span></div>`).join('')}
    ${(r.mesi || []).length ? `<p>Periodo: ${esc(r.mesi.map(monthLabel).join(', '))}</p>` : ''}
    <hr><div class="row big"><span>TOTALE</span><span>${euro(r.totale)}</span></div>
    <p>Euro ${esc(euroInWords(r.totale))}</p><p>Pagamento: ${esc(r.metodo || '')}</p>
    ${r.detrazione ? `<p style="font-size:7pt">${esc(DETRAZIONE_TEXT)}</p>` : ''}
    ${r.bollo ? `<p>Marca da bollo € ${Number(s.bolloAmount || 2).toFixed(2).replace('.', ',')}</p>` : ''}
    ${r.note ? `<p>Note: ${esc(r.note)}</p>` : ''}
    <hr><p class="c">${esc(s.footer || '')}</p><p class="c">Firma ____________________</p>
  </div>`;
}

export async function receiptHTML(r, { format = db.settings.printer.formato || 'A4', doppia = db.settings.printer.doppiaCopia } = {}) {
  const logo = await mediaToDataUrl(db.company.logo).catch(() => '');
  const title = `Ricevuta ${r.tipo} n. ${r.numero}/${r.anno}`;
  if (String(format).startsWith('Termica')) {
    return docShell({ title, page: format, css: THERMAL_CSS, body: thermal(r, logo) });
  }
  const compact = doppia && format === 'A4';
  const body = compact
    ? one(r, logo, 'Originale', true) + '<div class="cut"></div>' + one(r, logo, 'Copia per la società', true)
    : one(r, logo, '', format === 'A5');
  return docShell({ title, page: format, css: CSS + (format === 'A5' ? 'body{font-size:9.5pt}' : ''), body });
}
