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

// Persone sulla ricevuta: dai dati salvati, con ripiego sull'anagrafica per le ricevute delle versioni precedenti
function people(r) {
  const c = r.clientId ? db.client(r.clientId) : null;
  const ath = { ...(c ? { nome: c.nome, cognome: c.cognome, codiceFiscale: c.codiceFiscale, residenza: c.residenza, telefono: c.telefono } : {}), ...(r.atleta || {}) };
  if (!ath.residenza && c) ath.residenza = c.residenza;
  if (!ath.telefono && c) ath.telefono = c.telefono || (c.genitore && c.genitore.telefono);
  const payer = { ...(r.intestatario || {}) };
  const g = c && c.genitore;
  if (g && payer.nome === g.nome && payer.cognome === g.cognome) {
    if (!payer.residenza) payer.residenza = g.residenza && g.residenza.indirizzo ? g.residenza : c.residenza;
    if (!payer.telefono) payer.telefono = g.telefono || c.telefono;
    if (!payer.codiceFiscale) payer.codiceFiscale = g.codiceFiscale;
  }
  const same = (payer.codiceFiscale && ath.codiceFiscale && payer.codiceFiscale === ath.codiceFiscale)
    || (`${payer.nome} ${payer.cognome}`.trim().toLowerCase() === `${ath.nome || ''} ${ath.cognome || ''}`.trim().toLowerCase());
  if (same && !payer.residenza) { payer.residenza = ath.residenza; payer.telefono = payer.telefono || ath.telefono; }
  return { payer, ath, same: same || !(ath.nome || ath.cognome) };
}

function personBlock(title, p) {
  const a = p.residenza || {};
  const via = [a.indirizzo, a.civico].filter(Boolean).join(', ');
  const city = [a.cap, a.comune, a.provincia ? `(${a.provincia})` : ''].filter(Boolean).join(' ');
  return `<div class="rp-person"><h3>${esc(title)}</h3>
    <p>${esc(p.cognome || '')}</p>
    <p>${esc(p.nome || '')}</p>
    <p>${esc(via)}</p>
    <p class="tight">${esc(city)}<br>${esc(p.telefono || '')}</p>
    <p>${esc(p.codiceFiscale || '')}</p></div>`;
}

// "S.S.D. a r.l." + "Athletic Club" -> "S.S.D. Athletic Club a r.l."
export function companyLegalName(c = db.company) {
  const n = companyName(c);
  const f = String(c.formaGiuridica || '').trim();
  if (c.tipoSoggetto === 'persona' || !f || n.toLowerCase().includes(f.toLowerCase())) return n;
  const m = /^(.*?)\s*(a\s*r\.?\s*l\.?)$/i.exec(f);
  return m && m[1] ? `${m[1]} ${n} ${m[2]}` : `${f} ${n}`;
}

// importi come sulle ricevute cartacee: "€ 55,00"
const eur = n => `€ ${(Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const OLD_FOOTER = 'Grazie per la fiducia! Conserva questa ricevuta.';

function paper(r, logo) {
  const c = db.company;
  const sede = (c.sedi || []).find(x => x.principale) || (c.sedi || [])[0] || {};
  const f = c.fatturazione && (c.fatturazione.indirizzo || c.fatturazione.comune) ? c.fatturazione : sede;
  const line1 = [[f.indirizzo, f.civico].filter(Boolean).join(' '), f.cap].filter(Boolean).join(' ');
  const line2 = [f.comune, c.partitaIva ? `P.IVA ${c.partitaIva}` : (c.codiceFiscale ? `C.F. ${c.codiceFiscale}` : '')].filter(Boolean).join(' - ');
  const { payer, ath, same } = people(r);
  const s = db.settings.receipts;
  const dicitura = (s.diciture && s.diciture[r.tipo]) || '';
  const rows = (r.righe || []).map(l => `<tr><td>${esc(l.descrizione)}</td><td class="eur">${eur(l.importo)}</td></tr>`).join('');
  const footer = !s.footer || s.footer === OLD_FOOTER ? 'Grazie per averci scelto.' : s.footer;
  return `<section class="rp ${r.annullata ? 'void' : ''}">
    ${r.annullata ? '<div class="stamp">ANNULLATA</div>' : ''}
    <header class="rp-head">
      <div class="rp-brand">
        ${logo ? `<img src="${logo}" alt="">` : `<div class="mono-logo">${esc(companyName().slice(0, 1))}</div>`}
        <b>${esc(companyLegalName())}</b>
        ${line1 ? `<small>sede legale: ${esc(line1)}</small>` : ''}
        ${line2 ? `<small>${esc(line2)}</small>` : ''}
      </div>
      <h1>${r.tipo === 'commerciale' ? 'Ricevuta commerciale' : 'Ricevuta'}</h1>
    </header>
    <div class="rp-meta">
      <span>Ricevuta N.</span><em>${esc(r.numero)}</em>
      <span>DATA</span><em>${date(r.data)}</em>
    </div>
    <div class="rp-parties">
      ${same ? personBlock('Anagrafica cliente', payer) + '<div></div>' : personBlock('Anagrafica genitore', payer) + personBlock('Anagrafica atleta', ath)}
    </div>
    <div class="rp-cols"><span>DESCRIZIONE</span><span>EURO</span></div>
    <div class="rp-box">
      <table><tbody>${rows}</tbody></table>
      <div class="rp-total"><span>TOTALE DA CORRISPONDERE</span><b>${eur(r.totale)}</b></div>
    </div>
    <p class="rp-pay">Metodo di pagamento: <b>${esc(r.metodo || '—')}</b></p>
    ${r.detrazione ? `<p class="rp-note">${esc(DETRAZIONE_TEXT)}</p>` : ''}
    ${dicitura ? `<p class="rp-note">${esc(dicitura)}</p>` : ''}
    ${r.note ? `<p class="rp-note">Note: ${esc(r.note)}</p>` : ''}
    ${r.bollo ? `<p class="rp-note">Marca da bollo da € ${Number(s.bolloAmount || 2).toFixed(2).replace('.', ',')} applicata sull'originale.</p>` : ''}
    <p class="rp-thanks">${esc(footer)}</p>
  </section>`;
}

const CSS = `
  body{font-family:'Outfit','Plus Jakarta Sans',Arial,sans-serif;color:#3a3a3a}
  .rp{position:relative;min-height:268mm;padding:4mm 4mm 0}
  .rp-head{display:flex;justify-content:space-between;align-items:flex-start}
  .rp-brand{display:flex;flex-direction:column;align-items:flex-start;max-width:105mm}
  .rp-brand img{max-width:48mm;max-height:26mm;object-fit:contain;margin:0 0 4mm 10mm}
  .mono-logo{width:20mm;height:20mm;border-radius:4mm;background:#333;color:#fff;display:grid;place-items:center;font:700 22pt Outfit,sans-serif;margin-bottom:4mm}
  .rp-brand b{font-size:13.5pt;font-weight:700;color:#2b2b2b;letter-spacing:.01em}
  .rp-brand small{font-size:8.6pt;font-weight:700;color:#3a3a3a;line-height:1.35}
  .rp-head h1{font-size:23pt;font-weight:600;color:#3a3a3a;margin-top:2mm;letter-spacing:.01em}
  .rp-meta{display:grid;grid-template-columns:auto auto;column-gap:16mm;row-gap:1.5mm;margin:-14mm 0 0 82mm;font-size:8.6pt;width:max-content}
  .rp-meta span{font-weight:700;text-align:center;color:#2b2b2b}
  .rp-meta em{font-style:normal;color:#666}
  .rp-meta span:nth-of-type(2){grid-row:2}
  .rp-parties{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin:16mm 0 0 8mm}
  .rp-person h3{font-size:9pt;font-weight:700;color:#2b2b2b;margin-bottom:5mm;font-family:inherit}
  .rp-person p{margin:0 0 5.2mm;font-size:9pt;color:#666;text-transform:uppercase;min-height:3.2mm;line-height:1.35}
  .rp-person p.tight{margin-bottom:4.2mm}
  .rp-person + .rp-person{border-bottom:1px solid #555;padding-bottom:2mm}
  .rp-cols{display:grid;grid-template-columns:1fr 50mm;margin:6mm 0 1.5mm;font-size:8.6pt;font-weight:700;color:#2b2b2b}
  .rp-cols span:first-child{text-align:center;padding-left:30mm}
  .rp-cols span:last-child{text-align:center;border-bottom:1px solid #555;padding-bottom:1mm}
  .rp-box{background:repeating-linear-gradient(180deg,#d9d9d9 0,#d9d9d9 6mm,#e1e1e1 6mm,#e1e1e1 12mm);min-height:95mm;position:relative;padding:2mm 3mm 12mm}
  .rp-box table{width:100%;border-collapse:collapse;font-size:8.6pt}
  .rp-box td{padding:1.4mm 0;vertical-align:top;color:#333}
  .rp-box td.eur{text-align:right;width:40mm;white-space:nowrap}
  .rp-total{position:absolute;left:3mm;right:3mm;bottom:2.5mm;display:flex;justify-content:flex-end;align-items:baseline;gap:40mm;font-size:8.6pt}
  .rp-total span{font-weight:700;color:#2b2b2b}
  .rp-total b{font-weight:500;color:#333}
  .rp-pay{font-size:8.6pt;margin:3mm 0 0;color:#444}
  .rp-note{font-size:7.6pt;color:#666;margin:2mm 0 0;line-height:1.4}
  .rp-thanks{text-align:center;font-style:italic;font-size:8.2pt;color:#555;margin:8mm 0 0;text-transform:uppercase}
  .void .stamp{position:absolute;inset:0;display:grid;place-items:center;font:800 54pt Outfit,sans-serif;color:rgba(239,68,68,.22);transform:rotate(-18deg);pointer-events:none;letter-spacing:.1em}
  .a5 .rp{min-height:0}
  .a5 .rp-box{min-height:45mm}
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

export async function receiptHTML(r, { format = db.settings.printer.formato || 'A4' } = {}) {
  const logo = await mediaToDataUrl(db.company.logo).catch(() => '');
  const title = `Ricevuta ${r.tipo} n. ${r.numero}/${r.anno}`;
  if (String(format).startsWith('Termica')) {
    return docShell({ title, page: format, css: THERMAL_CSS, body: thermal(r, logo) });
  }
  const body = format === 'A5' ? `<div class="a5">${paper(r, logo)}</div>` : paper(r, logo);
  return docShell({ title, page: format, css: CSS, body });
}
