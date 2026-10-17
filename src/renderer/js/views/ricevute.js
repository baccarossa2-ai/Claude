// Registro ricevute: due serie numerate per anno, filtri, ristampa, PDF, annullamento ed esportazione.
import { db, PAYMENT_METHODS } from '../lib/db.js';
import { icon, on, $, $$, popMenu, modal, toast, confirmDialog, emptyState, countUp } from '../lib/ui.js';
import { go } from '../lib/router.js';
import { esc, euro, date, normalize, debounce, MESI, phoneIntl } from '../lib/format.js';
import { receiptHTML, monthLabel } from '../print/receipt.js';
import { printDocument, listDocument } from '../print/documents.js';
import { toCSV } from '../lib/csv.js';
import { receiptMessage } from './ricevuta-editor.js';

const st = { year: new Date().getFullYear(), tipo: 'tutte', month: '', metodo: '', q: '', showVoid: true };

function list() {
  const q = normalize(st.q);
  return db.receipts.filter(r => {
    if (r.anno !== st.year) return false;
    if (st.tipo !== 'tutte' && r.tipo !== st.tipo) return false;
    if (st.month && r.data.slice(5, 7) !== st.month) return false;
    if (st.metodo && r.metodo !== st.metodo) return false;
    if (!st.showVoid && r.annullata) return false;
    if (q) {
      const hay = normalize(`${r.numero} ${r.intestatario?.nome} ${r.intestatario?.cognome} ${r.atleta?.nome} ${r.atleta?.cognome} ${(r.righe || []).map(l => l.descrizione).join(' ')} ${r.disciplina}`);
      if (!q.split(/\s+/).every(t => hay.includes(t))) return false;
    }
    return true;
  }).sort((a, b) => b.data.localeCompare(a.data) || (a.tipo === b.tipo ? b.numero - a.numero : a.tipo.localeCompare(b.tipo)));
}

export default {
  title: 'Ricevute',
  render(root, params, query) {
    const years = [...new Set([new Date().getFullYear(), ...db.receipts.map(r => r.anno)])].sort((a, b) => b - a);
    root.innerHTML = `
      <div class="page-head">
        <div><div class="eyebrow">Registro ricevute</div><h1>Ricevute</h1><p>Generali e commerciali hanno numerazioni separate che ripartono da 1 ogni 1° gennaio.</p></div>
        <div class="actions">
          <select class="input" id="year" style="width:auto;height:40px">${years.map(y => `<option ${y === st.year ? 'selected' : ''}>${y}</option>`).join('')}</select>
          <button class="btn" id="exp">${icon('file-spreadsheet', 16)}Esporta registro</button>
          <button class="btn" id="prt">${icon('printer', 16)}Stampa registro</button>
          <button class="btn primary" id="newRec">${icon('plus', 16)}Nuova ricevuta${icon('chevron-down', 14)}</button>
        </div>
      </div>
      <div class="dash-grid" style="margin:0 0 20px" id="tiles"></div>
      <div class="toolbar">
        <div class="input-icon">${icon('search', 18)}<input id="q" placeholder="Cerca per numero, nome, causale…" value="${esc(st.q)}"></div>
        <div class="seg" id="tipoSeg">${[['tutte', 'Tutte'], ['generale', 'Generali'], ['commerciale', 'Commerciali']].map(([v, l]) => `<button data-v="${v}" class="${st.tipo === v ? 'active' : ''}">${l}</button>`).join('')}</div>
        <select class="input" id="month" style="width:auto;height:44px"><option value="">Tutti i mesi</option>${MESI.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}" ${st.month === String(i + 1).padStart(2, '0') ? 'selected' : ''}>${m}</option>`).join('')}</select>
        <select class="input" id="metodo" style="width:auto;height:44px"><option value="">Tutti i pagamenti</option>${PAYMENT_METHODS.map(m => `<option ${st.metodo === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
      </div>
      <div id="tbl"></div>`;

    const renderTiles = () => {
      const yr = db.receipts.filter(r => r.anno === st.year);
      const ok = yr.filter(r => !r.annullata);
      const sum = arr => arr.reduce((s, r) => s + Number(r.totale || 0), 0);
      const g = ok.filter(r => r.tipo === 'generale');
      const c = ok.filter(r => r.tipo === 'commerciale');
      const cur = ok.filter(r => r.data.slice(0, 7) === new Date().toISOString().slice(0, 7));
      $('#tiles', root).innerHTML = `
        ${tile('wallet', `Incassato nel ${st.year}`, sum(ok), `${ok.length} ricevute valide · ${yr.length - ok.length} annullate`, 'var(--grad)')}
        ${tile('receipt-text', 'Serie generale', sum(g), `${g.length} ricevute · prossima n. ${db.nextReceiptNumber('generale', st.year)}`, 'linear-gradient(135deg,#6366F1,#8B5CF6)')}
        ${tile('receipt', 'Serie commerciale', sum(c), `${c.length} ricevute · prossima n. ${db.nextReceiptNumber('commerciale', st.year)}`, 'var(--grad-cool)')}
        ${tile('calendar-check', 'Questo mese', sum(cur), `${cur.length} ricevute emesse`, 'var(--grad-green)')}`;
      $$('[data-money]', root).forEach(n => countUp(n, Number(n.dataset.money), { format: v => euro(v) }));
    };

    const renderTable = () => {
      const rows = list();
      const tbl = $('#tbl', root);
      if (!rows.length) {
        tbl.innerHTML = `<div class="card">${emptyState({ icon: 'receipt-text', title: db.receipts.length ? 'Nessuna ricevuta con questi filtri' : 'Nessuna ricevuta emessa', text: 'Le ricevute si creano dalla scheda dell\'atleta o con il pulsante “Nuova ricevuta”.', action: { label: 'Nuova ricevuta', icon: 'plus' } })}</div>`;
        $('[data-empty-act]', tbl).onclick = () => go('/ricevute/nuova');
        return;
      }
      const tot = rows.filter(r => !r.annullata).reduce((s, r) => s + Number(r.totale || 0), 0);
      tbl.innerHTML = `<div class="card table-wrap"><table class="table">
        <thead><tr><th>N.</th><th>Tipo</th><th>Data</th><th>Intestatario</th><th>Causale</th><th>Pagamento</th><th class="num">Importo</th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr class="click ${r.annullata ? 'annullata' : ''}" data-open="${r.id}">
          <td><span class="series-num">${r.numero}<span class="muted small">/${r.anno}</span></span></td>
          <td><span class="badge ${r.tipo === 'generale' ? 'accent' : 'info'}">${r.tipo === 'generale' ? 'Generale' : 'Commerciale'}</span>${r.annullata ? ' <span class="badge danger">Annullata</span>' : ''}</td>
          <td class="nowrap">${date(r.data)}</td>
          <td><b>${esc(`${r.intestatario?.nome || ''} ${r.intestatario?.cognome || ''}`)}</b>${r.atleta?.nome && `${r.atleta.nome} ${r.atleta.cognome}` !== `${r.intestatario?.nome} ${r.intestatario?.cognome}` ? `<div class="tiny muted">per ${esc(`${r.atleta.nome} ${r.atleta.cognome}`)}</div>` : ''}</td>
          <td class="ellipsis" style="max-width:280px">${esc((r.righe || []).map(l => l.descrizione).join(', '))}${(r.mesi || []).length ? `<div class="tiny muted">${esc(r.mesi.map(monthLabel).join(', '))}</div>` : ''}</td>
          <td class="small">${esc(r.metodo || '')}</td>
          <td class="num"><b>${euro(r.totale)}</b></td>
          <td class="right nowrap" data-stop>
            <button class="btn icon sm ghost" data-print="${r.id}" data-tip="Stampa">${icon('printer', 15)}</button>
            <button class="btn icon sm ghost" data-menu="${r.id}">${icon('ellipsis-vertical', 15)}</button>
          </td></tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="6" class="right muted" style="padding:14px 16px">Totale (escluse annullate) · ${rows.length} ricevute</td><td class="num" style="padding:14px 16px"><b style="font-size:16px">${euro(tot)}</b></td><td></td></tr></tfoot>
        </table></div>`;
    };

    const refresh = () => { renderTiles(); renderTable(); };

    $('#year', root).onchange = e => { st.year = Number(e.target.value); refresh(); };
    $('#month', root).onchange = e => { st.month = e.target.value; renderTable(); };
    $('#metodo', root).onchange = e => { st.metodo = e.target.value; renderTable(); };
    $('#q', root).addEventListener('input', debounce(e => { st.q = e.target.value; renderTable(); }, 120));
    on($('#tipoSeg', root), 'click', 'button', (e, t) => { st.tipo = t.dataset.v; $$('#tipoSeg button', root).forEach(b => b.classList.toggle('active', b === t)); renderTable(); });
    $('#newRec', root).onclick = e => popMenu(e.currentTarget, [
      { label: 'Ricevuta generale', icon: 'receipt-text', fn: () => go('/ricevute/nuova?tipo=generale') },
      { label: 'Ricevuta commerciale', icon: 'receipt', fn: () => go('/ricevute/nuova?tipo=commerciale') },
    ]);
    on(root, 'click', '[data-open]', (e, t) => { if (!e.target.closest('[data-stop]')) openReceipt(t.dataset.open, refresh); });
    on(root, 'click', '[data-print]', async (e, t) => {
      const r = db.receipts.find(x => x.id === t.dataset.print);
      printDocument(await receiptHTML(r), { title: `Ricevuta ${r.tipo} n. ${r.numero}/${r.anno}`, fileName: `Ricevuta ${r.tipo} ${r.numero}-${r.anno}` });
    });
    on(root, 'click', '[data-menu]', (e, t) => receiptMenu(t, db.receipts.find(x => x.id === t.dataset.menu), refresh));
    $('#exp', root).onclick = () => exportRegister(list());
    $('#prt', root).onclick = () => printRegister(list());

    refresh();
    if (query.apri) openReceipt(query.apri, refresh);
    return db.on('receipts', refresh);
  },
};

function tile(ic, label, value, foot, g) {
  return `<div class="stat c3" style="--g:${g}"><div class="row"><div class="stat-ico" style="width:36px;height:36px">${icon(ic, 17)}</div><div class="stat-lbl">${esc(label)}</div></div>
    <div class="stat-val" style="margin-top:10px;font-size:26px" data-money="${value}">0</div><div class="stat-foot muted">${esc(foot)}</div></div>`;
}

function receiptMenu(anchor, r, after) {
  const c = r.clientId ? db.client(r.clientId) : null;
  const last = db.isLastOfSeries(r);
  popMenu(anchor, [
    { label: 'Apri anteprima', icon: 'eye', fn: () => openReceipt(r.id, after) },
    { label: 'Salva PDF', icon: 'file-down', fn: async () => window.athlos.print.pdf({ html: await receiptHTML(r), defaultName: `Ricevuta ${r.tipo} ${r.numero}-${r.anno} ${r.intestatario?.cognome || ''}`, pageSize: db.settings.printer.formato }) },
    c ? { label: 'Conferma pagamento su WhatsApp', icon: 'brand-whatsapp', fn: () => window.athlos.system.open(`https://wa.me/${phoneIntl((c.genitore && c.genitore.telefono) || c.telefono)}?text=${encodeURIComponent(receiptMessage(r))}`) } : null,
    c ? { label: 'Vai alla scheda atleta', icon: 'user', fn: () => go(`/atleti/${c.id}?tab=ricevute`) } : null,
    '-',
    r.annullata
      ? { label: 'Ripristina ricevuta', icon: 'rotate-ccw', fn: async () => { await db.updateReceipt(r.id, { annullata: false }); toast('Ricevuta ripristinata'); after(); } }
      : { label: 'Annulla ricevuta (mantiene il numero)', icon: 'circle-x', danger: true, fn: () => voidReceipt(r, after) },
    { label: last ? 'Elimina (ultima della serie)' : 'Elimina: solo l\'ultima della serie', icon: 'trash-2', danger: true, disabled: !last, fn: () => deleteReceipt(r, after) },
  ].filter(Boolean));
}

async function voidReceipt(r, after) {
  const ok = await confirmDialog(`La ricevuta n. ${r.numero}/${r.anno} resterà nel registro con la scritta ANNULLATA e il suo numero non verrà riutilizzato.`, { title: 'Annullare la ricevuta?', danger: true, okLabel: 'Annulla ricevuta' });
  if (!ok) return;
  await db.updateReceipt(r.id, { annullata: true, annullataIl: new Date().toISOString() });
  db.log('receipt', `Annullata la ricevuta ${r.tipo} n. ${r.numero}/${r.anno}`, r.clientId);
  toast('Ricevuta annullata', { type: 'info' });
  after();
}

async function deleteReceipt(r, after) {
  const ok = await confirmDialog(`Eliminando la ricevuta n. ${r.numero}/${r.anno} il prossimo numero della serie ${r.tipo} tornerà ${r.numero}. Usalo solo per correggere un errore appena commesso.`, { title: 'Eliminare la ricevuta?', danger: true, okLabel: 'Elimina' });
  if (!ok) return;
  await db.removeReceipt(r.id);
  db.log('receipt', `Eliminata la ricevuta ${r.tipo} n. ${r.numero}/${r.anno}`);
  toast('Ricevuta eliminata', { type: 'info' });
  after();
}

export async function openReceipt(id, after = () => {}) {
  const r = db.receipts.find(x => x.id === id);
  if (!r) return;
  const html = await receiptHTML(r);
  const m = modal({
    title: `Ricevuta ${r.tipo} n. ${r.numero}/${r.anno}`,
    subtitle: `${date(r.data, 'long')} · ${euro(r.totale)} · ${r.metodo}${r.annullata ? ' · ANNULLATA' : ''}`,
    icon: 'receipt-text',
    size: 'lg',
    body: `<div class="paper" style="background:#E9E7F3;padding:16px;border-radius:14px"><div class="paper"><iframe style="height:62vh" id="rf"></iframe></div></div>`,
    actions: [
      { label: 'Altre azioni', kind: 'ghost', icon: 'ellipsis', left: true, fn: mm => { receiptMenu(mm.el.querySelector('.modal-foot .btn'), r, () => { mm.close(); after(); }); return false; } },
      { label: 'PDF', icon: 'file-down', fn: () => { window.athlos.print.pdf({ html, defaultName: `Ricevuta ${r.tipo} ${r.numero}-${r.anno}`, pageSize: db.settings.printer.formato }); return false; } },
      { label: 'Stampa', kind: 'primary', icon: 'printer', fn: () => { printDocument(html, { title: `Ricevuta ${r.tipo} n. ${r.numero}/${r.anno}` }); return false; } },
    ],
  });
  $('#rf', m.body).srcdoc = html;
}

async function exportRegister(rows) {
  const data = [['Serie', 'Numero', 'Anno', 'Data', 'Intestatario', 'C.F. intestatario', 'Atleta', 'C.F. atleta', 'Causali', 'Disciplina', 'Periodo', 'Metodo', 'Importo', 'Detrazione', 'Bollo', 'Annullata', 'Note'],
    ...rows.slice().reverse().map(r => [r.tipo, r.numero, r.anno, date(r.data), `${r.intestatario?.nome || ''} ${r.intestatario?.cognome || ''}`, r.intestatario?.codiceFiscale || '',
      `${r.atleta?.nome || ''} ${r.atleta?.cognome || ''}`, r.atleta?.codiceFiscale || '', (r.righe || []).map(l => `${l.descrizione} (${String(l.importo).replace('.', ',')})`).join(' | '),
      r.disciplina || '', (r.mesi || []).map(monthLabel).join(', '), r.metodo, String(r.totale).replace('.', ','), r.detrazione ? 'sì' : '', r.bollo ? 'sì' : '', r.annullata ? 'sì' : '', r.note || ''])];
  const p = await window.athlos.file.save({ defaultName: `Registro ricevute ${st.year}.csv`, filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }], text: toCSV(data), reveal: true });
  if (p) toast('Registro esportato: si apre con Excel');
}

function printRegister(rows) {
  const ordered = rows.slice().sort((a, b) => a.tipo.localeCompare(b.tipo) || a.numero - b.numero);
  const html = listDocument({
    title: `Registro ricevute ${st.year}`,
    subtitle: `${ordered.length} ricevute · totale ${euro(ordered.filter(r => !r.annullata).reduce((s, r) => s + Number(r.totale || 0), 0))}`,
    head: ['Serie', 'N.', 'Data', 'Intestatario', 'Atleta', 'Causale', 'Pagamento', 'Importo'],
    rows: ordered.map(r => [r.tipo === 'generale' ? 'Gen.' : 'Comm.', `${r.numero}${r.annullata ? ' (ANN.)' : ''}`, date(r.data), `${r.intestatario?.nome || ''} ${r.intestatario?.cognome || ''}`, `${r.atleta?.nome || ''} ${r.atleta?.cognome || ''}`, (r.righe || []).map(l => l.descrizione).join(', '), r.metodo, euro(r.totale)]),
  });
  printDocument(html, { title: `Registro ricevute ${st.year}`, landscape: true });
}
