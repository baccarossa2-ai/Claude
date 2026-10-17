// Scheda atleta: dati completi, certificato, situazione pagamenti mese per mese, ricevute e tessera.
import { db } from '../lib/db.js';
import { icon, avatar, on, $, $$, popMenu, toast } from '../lib/ui.js';
import { go } from '../lib/router.js';
import { esc, age, date, daysUntil, euro, address, MESI_BREVI, phoneIntl, relDays, todayISO, fullNameNC } from '../lib/format.js';
import { certBadge, discChips, removeClient } from './atleti.js';
import { sendReminder, sendBirthday } from './dashboard.js';
import { receiptHTML, monthLabel, companyName } from '../print/receipt.js';
import { printDocument, docShell } from '../print/documents.js';
import { mediaToDataUrl } from '../lib/ui.js';

export default {
  title: 'Scheda atleta',
  async render(root, params, query) {
    const c = db.client(params.id);
    if (!c) { go('/atleti'); return; }
    let tab = query.tab || 'panoramica';
    const a = age(c.dataNascita);
    const recs = db.receiptsOf(c.id);
    const phone = phoneIntl((c.genitore && c.genitore.telefono) || c.telefono);

    root.innerHTML = `
      <div class="crumbs"><a data-go="/atleti">Anagrafiche</a>${icon('chevron-right', 14)}<span>${esc(fullNameNC(c))}</span></div>
      <div class="athlete-head">
        ${avatar(c, 116)}
        <div class="ah-info">
          <h1>${esc(fullNameNC(c))} ${c.stato === 'sospeso' ? '<span class="badge">Sospeso</span>' : ''}</h1>
          <p class="muted">${a !== null ? `${a} anni · ` : ''}Tessera n. ${esc(c.tessera || '—')} · Iscritto dal ${date(c.dataIscrizione)}</p>
          <div class="chips" style="margin-top:10px">${discChips(c, 6)} ${certBadge(c)}</div>
        </div>
        <div class="ah-actions">
          <button class="btn" data-go="/atleti/${c.id}/modifica">${icon('pencil', 16)}Modifica</button>
          ${phone ? `<button class="btn whatsapp" id="waBtn">${icon('brand-whatsapp', 16)}WhatsApp</button>` : ''}
          <button class="btn primary" id="recBtn">${icon('receipt-text', 16)}Nuova ricevuta${icon('chevron-down', 14)}</button>
          <button class="btn icon" id="moreBtn">${icon('ellipsis-vertical', 18)}</button>
        </div>
      </div>
      <div class="tabs" id="tabs">
        <button class="tab" data-tab="panoramica">${icon('user', 16)}Panoramica</button>
        <button class="tab" data-tab="ricevute">${icon('receipt-text', 16)}Ricevute <span class="count">${recs.length}</span></button>
        <button class="tab" data-tab="tessera">${icon('id-card', 16)}Tessera</button>
        <button class="tab" data-tab="storico">${icon('history', 16)}Storico</button>
      </div>
      <div id="tabBody"></div>`;

    const renderTab = async () => {
      $$('#tabs .tab', root).forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      const body = $('#tabBody', root);
      if (tab === 'panoramica') body.innerHTML = overview(c, recs);
      if (tab === 'ricevute') body.innerHTML = receiptsTab(c, recs);
      if (tab === 'storico') body.innerHTML = historyTab(c);
      if (tab === 'tessera') {
        body.innerHTML = `<div class="card pad"><div class="row" style="gap:30px;align-items:flex-start;flex-wrap:wrap">
          <div id="card"></div>
          <div class="col" style="max-width:360px"><h3>Tessera atleta</h3><p class="muted">Formato carta di credito (85,6 × 54 mm). Il QR contiene numero di tessera, nome e scadenza del certificato, per un riconoscimento rapido all'ingresso o in gara.</p>
            <div class="row mt"><button class="btn primary" id="printCard">${icon('printer', 16)}Stampa tessera</button><button class="btn" id="pdfCard">${icon('file-down', 16)}PDF</button></div></div></div></div>`;
        const html = await cardHTML(c);
        $('#card', body).innerHTML = html.preview;
        $('#printCard', body).onclick = () => printDocument(html.doc, { title: `Tessera ${fullNameNC(c)}`, pageSize: 'A4' });
        $('#pdfCard', body).onclick = () => window.athlos.print.pdf({ html: html.doc, defaultName: `Tessera ${c.cognome} ${c.nome}` });
      }
      body.classList.remove('enter'); void body.offsetWidth;
    };

    on(root, 'click', '[data-go]', (e, t) => go(t.dataset.go));
    on(root, 'click', '[data-tab]', (e, t) => { tab = t.dataset.tab; renderTab(); });
    on(root, 'click', '[data-print]', async (e, t) => {
      const r = db.receipts.find(x => x.id === t.dataset.print);
      printDocument(await receiptHTML(r), { title: `Ricevuta ${r.tipo} n. ${r.numero}/${r.anno}`, fileName: `Ricevuta ${r.tipo} ${r.numero}-${r.anno}` });
    });
    on(root, 'click', '[data-pdf]', async (e, t) => {
      const r = db.receipts.find(x => x.id === t.dataset.pdf);
      window.athlos.print.pdf({ html: await receiptHTML(r), defaultName: `Ricevuta ${r.tipo} ${r.numero}-${r.anno} ${c.cognome}`, pageSize: db.settings.printer.formato });
    });
    on(root, 'click', '[data-month]', (e, t) => go(`/ricevute/nuova?cliente=${c.id}&tipo=generale&mese=${t.dataset.month}`));
    on(root, 'click', '[data-remind]', () => sendReminder(c));
    on(root, 'click', '[data-call]', (e, t) => window.athlos.system.open(`tel:${t.dataset.call}`));
    on(root, 'click', '[data-mail]', (e, t) => window.athlos.system.open(`mailto:${t.dataset.mail}`));
    on(root, 'click', '[data-copy]', (e, t) => { window.athlos.system.copy(t.dataset.copy); toast('Copiato negli appunti'); });

    if ($('#waBtn', root)) $('#waBtn', root).onclick = () => window.athlos.system.open(`https://wa.me/${phone}`);
    $('#recBtn', root).onclick = e => popMenu(e.currentTarget, [
      { label: 'Ricevuta generale', icon: 'receipt-text', fn: () => go(`/ricevute/nuova?cliente=${c.id}&tipo=generale`) },
      { label: 'Ricevuta commerciale', icon: 'receipt', fn: () => go(`/ricevute/nuova?cliente=${c.id}&tipo=commerciale`) },
    ]);
    $('#moreBtn', root).onclick = e => popMenu(e.currentTarget, [
      { label: 'Promemoria certificato (WhatsApp)', icon: 'bell-ring', fn: () => sendReminder(c) },
      { label: 'Manda gli auguri di compleanno', icon: 'cake', fn: () => sendBirthday(c) },
      { label: 'Scrivi un messaggio social', icon: 'megaphone', fn: () => go(`/comunica?destinatari=${c.id}`) },
      { label: 'Stampa scheda anagrafica', icon: 'printer', fn: () => printSheet(c) },
      '-',
      { label: c.stato === 'sospeso' ? 'Riattiva' : 'Sospendi', icon: c.stato === 'sospeso' ? 'user-check' : 'user-x', fn: async () => { await db.upsertClient({ id: c.id, stato: c.stato === 'sospeso' ? 'attivo' : 'sospeso' }); go(`/atleti/${c.id}?t=${Date.now()}`); } },
      { label: 'Elimina anagrafica', icon: 'trash-2', danger: true, fn: () => removeClient(c, () => go('/atleti')) },
    ]);
    await renderTab();
  },
};

function overview(c, recs) {
  const a = age(c.dataNascita);
  const d = daysUntil(c.certificato && c.certificato.scadenza);
  const pct = d === null ? 0 : Math.max(0, Math.min(1, d / 365));
  const ringColor = d === null ? 'var(--muted)' : d < 0 ? 'var(--danger)' : d <= (db.settings.reminderDays || 30) ? 'var(--warn)' : 'var(--ok)';
  const year = new Date().getFullYear();
  const valid = recs.filter(r => !r.annullata);
  const paidMonths = new Set(valid.flatMap(r => r.mesi || []));
  const totYear = valid.filter(r => r.anno === year).reduce((s, r) => s + Number(r.totale || 0), 0);
  const last = valid[0];
  const nowKey = todayISO().slice(0, 7);
  const startKey = (c.dataIscrizione || '').slice(0, 7);
  const sentReminders = db.reminders.filter(x => x.clientId === c.id).sort((x, y) => y.ts - x.ts);
  const discs = (c.discipline || []).map(id => db.discipline(id)).filter(Boolean);
  const quota = discs.reduce((s, x) => s + Number(x.quotaMensile || 0), 0);
  const g = c.genitore;
  return `<div class="dash-grid" style="margin-top:0">
    <div class="card c8"><div class="card-head"><h3>Dati anagrafici</h3></div><div class="card-body"><div class="info-grid">
      ${info('Nome e cognome', fullNameNC(c))}
      ${info('Sesso', c.sesso === 'F' ? 'Femmina' : c.sesso === 'M' ? 'Maschio' : '—')}
      ${info('Data di nascita', c.dataNascita ? `${date(c.dataNascita, 'long')}${a !== null ? ` (${a} anni)` : ''}` : '—')}
      ${info('Luogo di nascita', [c.luogoNascita, c.provinciaNascita && `(${c.provinciaNascita})`].filter(Boolean).join(' ') || '—')}
      <div><span>Codice fiscale</span><b class="mono">${esc(c.codiceFiscale || '—')}</b>${c.codiceFiscale ? ` <button class="btn icon sm ghost" data-copy="${esc(c.codiceFiscale)}" data-tip="Copia">${icon('copy', 14)}</button>` : ''}</div>
      ${info('Residenza', address(c.residenza) || '—')}
      <div><span>Telefono</span><b>${c.telefono ? `<a data-call="${esc(c.telefono)}">${esc(c.telefono)}</a>` : '—'}</b></div>
      <div><span>Email</span><b>${c.email ? `<a data-mail="${esc(c.email)}">${esc(c.email)}</a>` : '—'}</b></div>
      ${info('Sede', (db.company.sedi || []).find(s => s.id === c.sedeId)?.nome || '—')}
      ${info('Consensi', `${c.consensoPrivacy ? '✓ Privacy' : '✗ Privacy'} · ${c.consensoFoto ? '✓ Foto/video' : '✗ Foto/video'}`)}
    </div>${c.note ? `<div class="sep"></div><div class="small"><b>Note</b><p class="muted" style="white-space:pre-wrap">${esc(c.note)}</p></div>` : ''}</div></div>

    <div class="card c4"><div class="card-head"><h3>Certificato medico</h3></div><div class="card-body">
      <div class="cert-box">
        <div class="cert-ring"><svg width="64" height="64"><circle cx="32" cy="32" r="27" fill="none" stroke="var(--surface-3)" stroke-width="7"/><circle cx="32" cy="32" r="27" fill="none" stroke="${ringColor}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 27}" stroke-dashoffset="${2 * Math.PI * 27 * (1 - pct)}"/></svg><b>${d === null ? '?' : d < 0 ? '!' : d}</b></div>
        <div><b>${esc((c.certificato?.tipo || 'non agonistico').replace(/^./, x => x.toUpperCase()))}</b><div class="small muted">${d === null ? 'Scadenza non inserita' : `Scade il ${date(c.certificato.scadenza)} · ${relDays(d)}`}</div>${c.certificato?.medico ? `<div class="tiny muted">${esc(c.certificato.medico)}</div>` : ''}</div>
      </div>
      <button class="btn block mt" data-remind>${icon('brand-whatsapp', 16)}Invia promemoria</button>
      ${sentReminders.length ? `<p class="tiny muted mt">Ultimo promemoria: ${date(new Date(sentReminders[0].ts).toISOString().slice(0, 10))}</p>` : ''}
    </div></div>

    <div class="card c8"><div class="card-head"><div><h3>Situazione pagamenti ${year}</h3><p>Mesi coperti dalle ricevute · clicca un mese scoperto per emettere la ricevuta</p></div></div><div class="card-body">
      <div class="month-pick" style="grid-template-columns:repeat(12,1fr)">${MESI_BREVI.map((m, i) => {
        const key = `${year}-${String(i + 1).padStart(2, '0')}`;
        const paid = paidMonths.has(key);
        const due = !paid && key <= nowKey && (!startKey || key >= startKey);
        return `<button ${paid ? '' : `data-month="${key}"`} class="${paid ? 'sel' : ''}" style="${due ? 'border-color:var(--danger);color:var(--danger)' : ''}" data-tip="${paid ? 'Pagato' : due ? 'Da pagare' : 'Futuro'}">${m}${paid ? ' ✓' : ''}</button>`;
      }).join('')}</div>
      <div class="grid g3 mt">
        <div class="stat" style="padding:14px"><div class="stat-lbl">Pagato nel ${year}</div><div class="stat-val" style="margin-top:4px;font-size:24px">${euro(totYear)}</div></div>
        <div class="stat" style="padding:14px"><div class="stat-lbl">Ultimo pagamento</div><div class="stat-val" style="margin-top:4px;font-size:18px">${last ? `${euro(last.totale)} · ${date(last.data)}` : '—'}</div></div>
        <div class="stat" style="padding:14px"><div class="stat-lbl">Quota mensile prevista</div><div class="stat-val" style="margin-top:4px;font-size:24px">${euro(quota)}</div></div>
      </div>
    </div></div>

    <div class="card c4"><div class="card-head"><h3>Genitore / tutore</h3></div><div class="card-body">
      ${g && (g.nome || g.cognome) ? `<div class="person">${avatar(g, 44)}<div><b>${esc(`${g.nome} ${g.cognome}`)}</b><small>${esc(g.relazione || 'Genitore')}</small></div></div>
        <div class="info-grid mt" style="grid-template-columns:1fr">
          ${info('Codice fiscale', g.codiceFiscale || '—', true)}
          <div><span>Telefono</span><b>${g.telefono ? `<a data-call="${esc(g.telefono)}">${esc(g.telefono)}</a>` : '—'}</b></div>
          <div><span>Email</span><b>${g.email ? `<a data-mail="${esc(g.email)}">${esc(g.email)}</a>` : '—'}</b></div>
        </div>` : `<p class="muted small">Nessun genitore o tutore inserito.${a !== null && a < 18 ? ' Per i minorenni è consigliato: sarà l\'intestatario delle ricevute.' : ''}</p><button class="btn sm mt" data-go="/atleti/${c.id}/modifica">${icon('user-plus', 15)}Aggiungi</button>`}
    </div></div>
  </div>`;
}

function info(label, value, mono) {
  return `<div><span>${esc(label)}</span><b class="${mono ? 'mono' : ''}">${esc(value)}</b></div>`;
}

function receiptsTab(c, recs) {
  if (!recs.length) {
    return `<div class="card"><div class="empty"><div class="empty-art">${icon('receipt-text', 32)}</div><h3>Nessuna ricevuta</h3><p>Emetti la prima ricevuta per ${esc(c.nome)}.</p>
      <button class="btn primary" data-go="/ricevute/nuova?cliente=${c.id}">${icon('plus', 16)}Nuova ricevuta</button></div></div>`;
  }
  return `<div class="card table-wrap"><table class="table"><thead><tr><th>Numero</th><th>Tipo</th><th>Data</th><th>Causale</th><th>Periodo</th><th>Metodo</th><th class="num">Importo</th><th></th></tr></thead>
    <tbody>${recs.map(r => `<tr class="${r.annullata ? 'annullata' : ''}">
      <td><b>${r.numero}/${r.anno}</b></td>
      <td><span class="badge ${r.tipo === 'generale' ? 'accent' : 'info'}">${r.tipo === 'generale' ? 'Generale' : 'Commerciale'}</span></td>
      <td>${date(r.data)}</td>
      <td class="ellipsis" style="max-width:260px">${esc((r.righe || []).map(l => l.descrizione).join(', '))}</td>
      <td class="small">${esc((r.mesi || []).map(monthLabel).join(', ') || '—')}</td>
      <td class="small">${esc(r.metodo || '')}</td>
      <td class="num"><b>${euro(r.totale)}</b></td>
      <td class="right nowrap"><button class="btn icon sm ghost" data-print="${r.id}" data-tip="Stampa">${icon('printer', 15)}</button><button class="btn icon sm ghost" data-pdf="${r.id}" data-tip="PDF">${icon('file-down', 15)}</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}

function historyTab(c) {
  const ev = db.activity.filter(a => a.ref === c.id || (a.text || '').includes(`${c.nome} ${c.cognome}`));
  const rem = db.reminders.filter(x => x.clientId === c.id);
  const items = [
    ...ev.map(e => ({ ts: e.ts, text: e.text, icon: 'activity' })),
    ...rem.map(r => ({ ts: r.ts, text: `Promemoria certificato inviato via ${r.canale}`, icon: 'bell-ring' })),
    { ts: new Date(c.createdAt || Date.now()).getTime(), text: 'Anagrafica creata', icon: 'user-plus' },
  ].sort((a, b) => b.ts - a.ts);
  return `<div class="card pad">${items.map(i => `<div class="list-item"><span class="pi-ico" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--surface-3);color:var(--accent)">${icon(i.icon, 16)}</span><div class="grow">${esc(i.text)}</div><small class="muted">${new Date(i.ts).toLocaleString('it-IT')}</small></div>`).join('')}</div>`;
}

async function cardHTML(c) {
  const logo = await mediaToDataUrl(db.company.logo).catch(() => '');
  const photo = await mediaToDataUrl(c.foto).catch(() => '');
  const qr = await window.athlos.system.qr(`${companyName()}\nTessera n. ${c.tessera}\n${c.nome} ${c.cognome}\nC.F. ${c.codiceFiscale || '-'}\nCertificato: ${date(c.certificato?.scadenza)}`, { dark: '#1B1440' });
  const discs = (c.discipline || []).map(id => db.discipline(id)?.nome).filter(Boolean).join(' · ');
  const year = new Date().getFullYear();
  const season = new Date().getMonth() >= 8 ? `${year}/${String(year + 1).slice(2)}` : `${year - 1}/${String(year).slice(2)}`;
  const inner = (scale) => `<div style="width:${85.6 * scale}px;height:${54 * scale}px;border-radius:${3.2 * scale}px;position:relative;overflow:hidden;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;
      background:radial-gradient(120% 120% at 100% 0%, rgba(233,70,143,.95), transparent 55%), linear-gradient(135deg,#2B1B6E,#5B2BD6 60%,#8B3DF0);box-shadow:0 20px 40px -18px rgba(91,43,214,.7)">
    <div style="position:absolute;right:${-12 * scale}px;bottom:${-16 * scale}px;width:${52 * scale}px;height:${52 * scale}px;border-radius:50%;border:${8 * scale}px solid rgba(255,255,255,.07)"></div>
    <div style="position:absolute;left:${5 * scale}px;top:${4.5 * scale}px;display:flex;align-items:center;gap:${2 * scale}px">
      ${logo ? `<img src="${logo}" style="width:${8 * scale}px;height:${8 * scale}px;border-radius:${2 * scale}px;background:#fff;object-fit:contain">` : ''}
      <div><div style="font:700 ${3.6 * scale}px Outfit,sans-serif;line-height:1">${esc(companyName())}</div><div style="font-size:${2 * scale}px;opacity:.75;letter-spacing:.12em;text-transform:uppercase;margin-top:${.6 * scale}px">Tessera atleta · stagione ${season}</div></div></div>
    <div style="position:absolute;left:${5 * scale}px;bottom:${5 * scale}px;display:flex;gap:${3 * scale}px;align-items:flex-end">
      <div style="width:${17 * scale}px;height:${20 * scale}px;border-radius:${2 * scale}px;overflow:hidden;background:rgba(255,255,255,.15);display:grid;place-items:center;font:700 ${6 * scale}px Outfit">${photo ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover">` : esc((c.nome[0] || '') + (c.cognome[0] || ''))}</div>
      <div><div style="font:700 ${4.4 * scale}px Outfit,sans-serif;line-height:1.05">${esc(c.nome)}<br>${esc(c.cognome)}</div>
        <div style="font-size:${2.2 * scale}px;opacity:.85;margin-top:${1 * scale}px">${esc(discs)}</div>
        <div style="font-size:${2.2 * scale}px;opacity:.85">N. ${esc(c.tessera)} · Nato/a il ${date(c.dataNascita)}</div></div></div>
    <div style="position:absolute;right:${4.5 * scale}px;bottom:${4.5 * scale}px;width:${17 * scale}px;height:${17 * scale}px;background:#fff;border-radius:${1.6 * scale}px;padding:${.8 * scale}px">${qr.replace('<svg', '<svg style="width:100%;height:100%;display:block"')}</div>
  </div>`;
  const preview = inner(5);
  const doc = docShell({
    title: 'Tessera',
    css: '.wrap{display:flex;gap:10mm;flex-wrap:wrap;padding:6mm}',
    body: `<div class="wrap">${inner(3.7795).replace(/(\d+(\.\d+)?)px/g, (m, n) => `${(Number(n) / 3.7795).toFixed(2)}mm`)}</div>`,
  });
  return { preview, doc };
}

async function printSheet(c) {
  const rows = [
    ['Nome e cognome', fullNameNC(c)], ['Sesso', c.sesso || ''], ['Nato/a il', date(c.dataNascita)], ['Luogo di nascita', `${c.luogoNascita || ''} ${c.provinciaNascita ? `(${c.provinciaNascita})` : ''}`],
    ['Codice fiscale', c.codiceFiscale || ''], ['Residenza', address(c.residenza)], ['Telefono', c.telefono || ''], ['Email', c.email || ''],
    ['Discipline', (c.discipline || []).map(id => db.discipline(id)?.nome).filter(Boolean).join(', ')], ['Certificato', `${c.certificato?.tipo || ''} · scadenza ${date(c.certificato?.scadenza)}`],
    ['Genitore/tutore', c.genitore ? `${c.genitore.nome} ${c.genitore.cognome} · ${c.genitore.codiceFiscale || ''} · ${c.genitore.telefono || ''}` : '—'],
    ['Tessera', c.tessera], ['Iscrizione', date(c.dataIscrizione)], ['Note', c.note || ''],
  ];
  const html = docShell({
    title: 'Scheda anagrafica',
    css: 'h1{font-size:20pt;border-bottom:3px solid #7C4DFF;padding-bottom:6px}table{width:100%;border-collapse:collapse;margin-top:12px}td{padding:7px 8px;border-bottom:1px solid #e7e4f3;vertical-align:top}td:first-child{width:34%;color:#6b6890;font-size:9.5pt;text-transform:uppercase;letter-spacing:.05em}.sig{margin-top:30mm;display:flex;justify-content:space-between}.sig div{width:70mm;border-top:1px solid #888;padding-top:4px;font-size:9pt;color:#666;text-align:center}',
    body: `<p style="color:#6b6890;margin:0">${esc(companyName())}</p><h1>Scheda anagrafica atleta</h1><table>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>
      <div class="sig"><div>Data</div><div>Firma ${c.genitore ? 'del genitore/tutore' : 'dell\'atleta'}</div></div>`,
  });
  printDocument(html, { title: `Scheda ${fullNameNC(c)}` });
}
