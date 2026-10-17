// Impostazioni: stampanti reali, ricevute, promemoria, aspetto, sicurezza, chat, dati e backup.
import { db, DEFAULT_CAUSALI } from '../lib/db.js';
import { icon, on, $, $$, toast, confirmDialog, modal, promptDialog } from '../lib/ui.js';
import { esc, euro, uid, colorFor, date } from '../lib/format.js';
import { docShell } from '../print/documents.js';
import { applyTheme } from '../app.js';
import { ensureProfile, startChat } from '../lib/chatstate.js';
import { createDemoData, removeDemoData } from '../data/demo.js';
import { companyName } from '../print/receipt.js';

const SECTIONS = [
  ['stampanti', 'Stampanti', 'printer'],
  ['ricevute', 'Ricevute', 'receipt-text'],
  ['promemoria', 'Promemoria e notifiche', 'bell-ring'],
  ['aspetto', 'Aspetto', 'palette'],
  ['sicurezza', 'Sicurezza e PIN', 'lock'],
  ['chat', 'Chat Squadra', 'messages-square'],
  ['dati', 'Dati e backup', 'hard-drive'],
  ['info', 'Informazioni', 'info'],
];

let current = 'stampanti';
let rerender = () => {};

export default {
  title: 'Impostazioni',
  render(root, params, query) {
    if (query.sezione) current = query.sezione;
    root.innerHTML = `
      <div class="page-head"><div><div class="eyebrow">Configurazione</div><h1>Impostazioni</h1><p>Tutto si salva in automatico.</p></div></div>
      <div class="settings-grid">
        <nav class="settings-nav">${SECTIONS.map(([k, l, ic]) => `<button data-sec="${k}">${icon(ic, 18)}${l}</button>`).join('')}</nav>
        <div id="sec"></div>
      </div>`;
    const show = () => {
      $$('[data-sec]', root).forEach(b => b.classList.toggle('active', b.dataset.sec === current));
      const box = document.createElement('div');
      $('#sec', root).replaceChildren(box);
      ({ stampanti, ricevute, promemoria, aspetto, sicurezza, chat, dati, info })[current](box);
      box.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
    };
    on(root, 'click', '[data-sec]', (e, t) => { current = t.dataset.sec; show(); });
    rerender = show;
    show();
  },
};

const S = () => db.settings;
const save = async msg => { await db.save('settings'); if (msg) toast(msg); };

function card(title, sub, body, ic) {
  return `<div class="card pad" style="margin-bottom:18px"><div class="form-section" style="margin:0"><h3><span class="ico-box">${icon(ic || 'settings', 17)}</span><div>${esc(title)}${sub ? `<div class="muted small" style="font-family:var(--font);font-weight:500">${esc(sub)}</div>` : ''}</div></h3>${body}</div></div>`;
}

// ------------------------------------------------------------------ stampanti
async function stampanti(box) {
  const p = S().printer;
  box.innerHTML = card('Stampanti installate', 'Athlos usa le stampanti di Windows: USB, di rete, Wi-Fi, termiche e virtuali (PDF).', `<div id="plist" class="col" style="gap:10px">${'<div class="skeleton"></div>'.repeat(3)}</div>
      <div class="row mt"><button class="btn sm" id="reload">${icon('refresh-cw', 15)}Aggiorna elenco</button><button class="btn sm" id="test">${icon('printer-check', 15)}Stampa pagina di prova</button></div>`, 'printer')
    + card('Formato e copie', 'Valori proposti ogni volta che stampi una ricevuta.', `<div class="grid g3">
      <label class="field"><span>Formato carta</span><select id="fmt"></select></label>
      <label class="field"><span>Copie</span><input id="cop" type="number" min="1" max="10" value="${p.copie}"></label>
      <div class="field"><span>Ricevuta A4</span><label class="switch" style="height:42px"><input type="checkbox" id="dbl" ${p.doppiaCopia ? 'checked' : ''}><i></i>Originale + copia sullo stesso foglio</label></div>
      </div>
      <label class="switch mt"><input type="checkbox" id="sil" ${p.silent ? 'checked' : ''}><i></i>“Salva e stampa” invia direttamente alla stampante scelta, senza finestra di Windows</label>`, 'file-text');

  const fmts = await window.athlos.print.formats();
  $('#fmt', box).innerHTML = fmts.map(f => `<option ${f === p.formato ? 'selected' : ''}>${f}</option>`).join('');
  const load = async () => {
    const list = await window.athlos.print.printers();
    const el = $('#plist', box);
    if (!list.length) {
      el.innerHTML = `<div class="alert" style="--ac:var(--warn)"><span class="a-ico">${icon('triangle-alert', 18)}</span><div><b>Nessuna stampante trovata</b><small>Installa la stampante in Windows (Impostazioni › Bluetooth e dispositivi › Stampanti) e premi “Aggiorna elenco”. Puoi sempre salvare in PDF.</small></div></div>`;
      return;
    }
    el.innerHTML = list.map(x => `<div class="printer-card ${x.name === p.deviceName || (!p.deviceName && x.isDefault) ? 'sel' : ''}" data-prn="${esc(x.name)}">
      <span class="p-ico">${icon(/pdf|xps|onenote|fax/i.test(x.name) ? 'file-down' : /pos|therm|80|58|epson tm|star|bixolon/i.test(x.name) ? 'receipt' : 'printer', 20)}</span>
      <div class="grow"><b>${esc(x.displayName)}</b><div class="small muted">${esc(x.description || x.name)}${x.isDefault ? ' · predefinita di Windows' : ''}</div></div>
      ${x.name === p.deviceName ? `<span class="badge accent">${icon('check', 12)}Scelta per Athlos</span>` : ''}</div>`).join('');
  };
  await load();
  on(box, 'click', '[data-prn]', async (e, t) => { p.deviceName = t.dataset.prn; await save('Stampante predefinita impostata'); load(); });
  $('#reload', box).onclick = load;
  $('#fmt', box).onchange = e => { p.formato = e.target.value; save(); };
  $('#cop', box).onchange = e => { p.copie = Math.max(1, Number(e.target.value) || 1); save(); };
  $('#dbl', box).onchange = e => { p.doppiaCopia = e.target.checked; save(); };
  $('#sil', box).onchange = e => { p.silent = e.target.checked; save(); };
  $('#test', box).onclick = async () => {
    const html = docShell({
      title: 'Pagina di prova', page: p.formato,
      body: `<div style="text-align:center;padding:10mm"><h1 style="font-size:24pt">Athlos · pagina di prova</h1><p>${esc(companyName())}</p><p>Stampante: <b>${esc(p.deviceName || 'predefinita')}</b> · formato ${esc(p.formato)}</p>
        <div style="margin:8mm auto;width:60mm;height:20mm;border-radius:4mm;background:linear-gradient(135deg,#5B5BF6,#8B3DF0,#E9468F)"></div><p>Se leggi questo testo e vedi la barra colorata, la stampante funziona. ✓</p><p style="font-size:9pt;color:#888">${new Date().toLocaleString('it-IT')}</p></div>`,
    });
    const r = await window.athlos.print.html({ html, deviceName: p.deviceName || undefined, silent: false, copies: 1, pageSize: p.formato });
    if (r.success) toast('Pagina di prova inviata'); else if (r.failureReason && !/cancel/i.test(r.failureReason)) toast('Errore: ' + r.failureReason, { type: 'error' });
  };
}

// ------------------------------------------------------------------ ricevute
function ricevute(box) {
  const r = S().receipts;
  r.diciture = r.diciture || { generale: '', commerciale: '' };
  const year = new Date().getFullYear();
  const sn = (r.startNumbers[year] = r.startNumbers[year] || {});
  box.innerHTML = card('Numerazione', `Ogni anno le due serie ripartono da 1. Se nel ${year} hai già emesso ricevute con un altro programma, indica da che numero continuare.`, `<div class="grid g2">
      <label class="field"><span>Primo numero serie generale ${year}</span><input type="number" min="1" id="sg" value="${sn.generale || 1}"><small class="hint">Prossima: n. ${db.nextReceiptNumber('generale', year)}</small></label>
      <label class="field"><span>Primo numero serie commerciale ${year}</span><input type="number" min="1" id="sc" value="${sn.commerciale || 1}"><small class="hint">Prossima: n. ${db.nextReceiptNumber('commerciale', year)}</small></label></div>`, 'hash')
    + card('Testi della ricevuta', '', `<div class="col" style="gap:14px">
      <label class="field"><span>Dicitura fissa per le ricevute generali</span><textarea id="dg" placeholder="Es. regime fiscale applicato, indicato dal tuo commercialista">${esc(r.diciture.generale)}</textarea></label>
      <label class="field"><span>Dicitura fissa per le ricevute commerciali</span><textarea id="dc" placeholder="Es. dicitura IVA indicata dal tuo commercialista">${esc(r.diciture.commerciale)}</textarea></label>
      <div class="grid g2"><label class="field"><span>Testo sotto la firma</span><input id="fi" value="${esc(r.firma || '')}" placeholder="Timbro e firma"></label>
      <label class="field"><span>Messaggio in fondo</span><input id="fo" value="${esc(r.footer || '')}"></label></div></div>`, 'file-text')
    + card('Automatismi', '', `<div class="col" style="gap:12px">
      <label class="switch"><input type="checkbox" id="da" ${r.detrazioneAuto ? 'checked' : ''}><i></i>Aggiungi la dicitura per la detrazione fiscale agli atleti dai 5 ai 18 anni</label>
      <label class="switch"><input type="checkbox" id="ba" ${r.bolloAuto ? 'checked' : ''}><i></i>Proponi la marca da bollo oltre la soglia</label>
      <div class="grid g2"><label class="field"><span>Soglia bollo (€)</span><input type="number" step="0.01" id="bt" value="${r.bolloThreshold}"></label><label class="field"><span>Importo marca (€)</span><input type="number" step="0.01" id="bm" value="${r.bolloAmount}"></label></div></div>`, 'wand-sparkles')
    + card('Causali rapide', 'Pulsanti che compaiono nella nuova ricevuta. Con “quota disciplina” l\'importo è la quota mensile × i mesi scelti.', `<div id="caus" class="col" style="gap:8px"></div>
      <div class="row mt"><button class="btn sm" id="addC">${icon('plus', 15)}Aggiungi causale</button><button class="btn sm ghost" id="resetC">${icon('rotate-ccw', 15)}Ripristina predefinite</button></div>`, 'list');

  const drawC = () => {
    $('#caus', box).innerHTML = r.causali.map((c, i) => `<div class="grid" style="grid-template-columns:1fr 150px 110px 150px 36px;gap:8px;align-items:center">
      <input class="input" data-c="${i}" data-k="descrizione" value="${esc(c.descrizione)}">
      <select class="input" data-c="${i}" data-k="tipo"><option value="generale" ${c.tipo === 'generale' ? 'selected' : ''}>Generale</option><option value="commerciale" ${c.tipo === 'commerciale' ? 'selected' : ''}>Commerciale</option></select>
      <input class="input" type="number" step="0.5" data-c="${i}" data-k="importo" value="${c.importo}" ${c.usaQuotaDisciplina ? 'disabled' : ''}>
      <label class="check small"><input type="checkbox" data-c="${i}" data-k="usaQuotaDisciplina" ${c.usaQuotaDisciplina ? 'checked' : ''}>Quota disciplina</label>
      <button class="btn icon sm ghost" data-delc="${i}">${icon('trash-2', 15)}</button></div>`).join('');
  };
  drawC();
  on(box, 'change', '[data-c]', (e, t) => {
    const c = r.causali[Number(t.dataset.c)];
    c[t.dataset.k] = t.type === 'checkbox' ? t.checked : t.dataset.k === 'importo' ? Number(t.value) || 0 : t.value;
    save(); if (t.type === 'checkbox') drawC();
  });
  on(box, 'click', '[data-delc]', (e, t) => { r.causali.splice(Number(t.dataset.delc), 1); save(); drawC(); });
  $('#addC', box).onclick = () => { r.causali.push({ id: uid('c-'), descrizione: 'Nuova causale', tipo: 'generale', importo: 0 }); save(); drawC(); };
  $('#resetC', box).onclick = async () => { if (await confirmDialog('Ripristinare le causali predefinite?')) { r.causali = DEFAULT_CAUSALI.map(c => ({ ...c })); save('Causali ripristinate'); drawC(); } };
  $('#sg', box).onchange = e => { sn.generale = Math.max(1, Number(e.target.value) || 1); save('Numerazione aggiornata'); rerender(); };
  $('#sc', box).onchange = e => { sn.commerciale = Math.max(1, Number(e.target.value) || 1); save('Numerazione aggiornata'); rerender(); };
  $('#dg', box).onchange = e => { r.diciture.generale = e.target.value; save(); };
  $('#dc', box).onchange = e => { r.diciture.commerciale = e.target.value; save(); };
  $('#fi', box).onchange = e => { r.firma = e.target.value; save(); };
  $('#fo', box).onchange = e => { r.footer = e.target.value; save(); };
  $('#da', box).onchange = e => { r.detrazioneAuto = e.target.checked; save(); };
  $('#ba', box).onchange = e => { r.bolloAuto = e.target.checked; save(); };
  $('#bt', box).onchange = e => { r.bolloThreshold = Number(e.target.value) || 77.47; save(); };
  $('#bm', box).onchange = e => { r.bolloAmount = Number(e.target.value) || 2; save(); };
}

// ------------------------------------------------------------------ promemoria
function promemoria(box) {
  const s = S();
  box.innerHTML = card('Certificati medici', '', `<div class="col" style="gap:14px">
      <div class="field"><span>Avvisa le famiglie</span><div class="seg" id="days">${[15, 30, 45, 60].map(n => `<button data-v="${n}" class="${s.reminderDays === n ? 'active' : ''}">${n} giorni prima</button>`).join('')}</div></div>
      <label class="switch"><input type="checkbox" id="nos" ${s.notifyOnStart ? 'checked' : ''}><i></i>All'avvio mostra una notifica di Windows con certificati e compleanni del giorno</label>
      <label class="field"><span>Messaggio promemoria certificato</span><textarea id="rt" style="min-height:120px">${esc(s.reminderTemplate)}</textarea><small class="hint">Variabili: {nome} {atleta} {frase} {scadenza} {giorni} {societa}</small></label>
      <label class="field"><span>Messaggio di auguri</span><textarea id="bt">${esc(s.birthdayTemplate)}</textarea><small class="hint">Variabili: {nome} {societa}</small></label>
      <button class="btn sm" id="testN" style="align-self:flex-start">${icon('bell', 15)}Prova una notifica</button></div>`, 'bell-ring')
    + card('Invio automatico', 'Prossimo passo', `<p class="small" style="color:var(--text-2)">Oggi i promemoria si inviano con un clic (anche in sequenza guidata dallo Scadenzario). L'invio completamente automatico, senza aprire WhatsApp, richiede un account <b>WhatsApp Business Platform</b> con modelli di messaggio approvati da Meta: quando avrai le credenziali, potranno essere collegate qui.</p>`, 'rocket');
  on(box, 'click', '#days button', (e, t) => { s.reminderDays = Number(t.dataset.v); $$('#days button', box).forEach(b => b.classList.toggle('active', b === t)); save('Preavviso aggiornato'); });
  $('#nos', box).onchange = e => { s.notifyOnStart = e.target.checked; save(); };
  $('#rt', box).onchange = e => { s.reminderTemplate = e.target.value; save('Messaggio salvato'); };
  $('#bt', box).onchange = e => { s.birthdayTemplate = e.target.value; save('Messaggio salvato'); };
  $('#testN', box).onclick = () => window.athlos.system.notify({ title: 'Athlos · notifica di prova', body: 'Le notifiche di Windows funzionano correttamente ✓' });
}

// ------------------------------------------------------------------ aspetto
function aspetto(box) {
  const s = S();
  const prev = (bg, side, surface) => `<div class="tp-prev" style="background:${bg}"><i style="background:${side}"></i><s style="padding:10px;display:flex;flex-direction:column;gap:6px"><b style="display:block;height:10px;width:60%;border-radius:4px;background:${surface}"></b><b style="display:block;height:22px;border-radius:6px;background:${surface}"></b><b style="display:block;height:8px;width:40%;border-radius:4px;background:linear-gradient(90deg,#5B5BF6,#E9468F)"></b></s></div>`;
  box.innerHTML = card('Tema', 'Il tema automatico segue l\'impostazione chiaro/scuro di Windows.', `<div class="theme-pick">
      <button data-th="light" class="${s.theme === 'light' ? 'sel' : ''}">${prev('#F5F4FB', '#151231', '#fff')}${icon('sun', 15)} Chiaro</button>
      <button data-th="dark" class="${s.theme === 'dark' ? 'sel' : ''}">${prev('#0D0B1A', '#151231', '#1D1936')}${icon('moon', 15)} Scuro</button>
      <button data-th="auto" class="${s.theme === 'auto' ? 'sel' : ''}">${prev('linear-gradient(90deg,#F5F4FB 50%,#0D0B1A 50%)', '#151231', '#888')}${icon('monitor', 15)} Automatico</button></div>
      <label class="switch mt"><input type="checkbox" id="col" ${s.sidebarCollapsed ? 'checked' : ''}><i></i>Menu laterale compatto (solo icone)</label>`, 'palette')
    + card('Anteprima di benvenuto', '', `<p class="small muted">Rivedi la presentazione iniziale con le immagini e la configurazione guidata.</p><button class="btn sm mt" id="onb">${icon('presentation', 15)}Rivedi l'anteprima</button>`, 'sparkles');
  on(box, 'click', '[data-th]', async (e, t) => { s.theme = t.dataset.th; await save(); await applyTheme(); rerender(); });
  $('#col', box).onchange = e => { s.sidebarCollapsed = e.target.checked; document.getElementById('app').classList.toggle('collapsed', s.sidebarCollapsed); save(); };
  $('#onb', box).onclick = async () => { const { runOnboarding } = await import('./onboarding.js'); await runOnboarding(); location.reload(); };
}

// ------------------------------------------------------------------ sicurezza
function sicurezza(box) {
  const s = S();
  box.innerHTML = card('PIN di accesso', 'Protegge i dati personali degli atleti (GDPR) quando il PC è condiviso.', `<div class="col" style="gap:12px">
      <div class="row"><span class="badge ${s.pin ? 'ok' : ''}">${icon(s.pin ? 'lock' : 'lock-keyhole', 13)}${s.pin ? 'PIN attivo' : 'Nessun PIN'}</span></div>
      <div class="row"><button class="btn" id="setPin">${icon('key-round', 16)}${s.pin ? 'Cambia PIN' : 'Imposta PIN'}</button>${s.pin ? `<button class="btn ghost" id="delPin">${icon('trash-2', 16)}Rimuovi PIN</button>` : ''}</div>
      <label class="switch"><input type="checkbox" id="los" ${s.lockOnStart ? 'checked' : ''} ${s.pin ? '' : 'disabled'}><i></i>Chiedi il PIN all'apertura di Athlos</label></div>`, 'lock')
    + card('Privacy', '', `<p class="small" style="color:var(--text-2)">I dati restano sul computer, nella cartella dell'utente di Windows. Nessun dato viene inviato a server esterni: WhatsApp, email e social si aprono solo quando premi un pulsante. Le chat Squadra viaggiano solo nella rete locale della palestra.</p>`, 'shield-check');
  $('#setPin', box).onclick = async () => {
    const pin = await promptDialog({ title: 'Nuovo PIN', label: 'PIN di 6 cifre', type: 'password', placeholder: '••••••' });
    if (pin === null) return;
    if (!/^\d{6}$/.test(pin)) { toast('Il PIN deve avere esattamente 6 cifre', { type: 'warning' }); return; }
    const again = await promptDialog({ title: 'Conferma PIN', label: 'Ripeti il PIN', type: 'password' });
    if (again !== pin) { toast('I due PIN non coincidono', { type: 'error' }); return; }
    s.pin = await window.athlos.security.hashPin(pin);
    s.lockOnStart = true;
    await save('PIN impostato');
    rerender();
  };
  if ($('#delPin', box)) $('#delPin', box).onclick = async () => { if (await confirmDialog('Rimuovere il PIN?', { danger: true })) { s.pin = ''; s.lockOnStart = false; await save('PIN rimosso'); rerender(); } };
  $('#los', box).onchange = e => { s.lockOnStart = e.target.checked; save(); };
}

// ------------------------------------------------------------------ chat
async function chat(box) {
  const s = S();
  const p = s.chat.profile || {};
  const snap = await window.athlos.chat.snapshot();
  box.innerHTML = card('Il tuo profilo in Squadra', 'Come ti vedono le altre postazioni della palestra.', `<div class="grid g3">
      <label class="field"><span>Nome</span><input id="pn" value="${esc(p.nome || '')}"></label>
      <label class="field"><span>Ruolo</span><input id="pr" value="${esc(p.ruolo || '')}" placeholder="Es. Segreteria"></label>
      <label class="field"><span>Colore</span><input id="pc" type="color" value="${esc(p.colore || '#7C4DFF')}" style="height:42px;padding:4px"></label></div>
      <button class="btn primary mt" id="saveP">${icon('save', 15)}Salva profilo</button>`, 'user')
    + card('Rete', 'Le postazioni con la stessa chiave si trovano da sole sulla rete locale (Wi-Fi o cavo).', `<div class="grid g2">
      <label class="field"><span>Chiave di rete della squadra</span><input id="nk" value="${esc(s.chat.networkKey || db.company.denominazione || '')}"><small class="hint">Usa la stessa chiave su tutti i PC della società.</small></label>
      <div class="field"><span>Questa postazione</span><div class="input-like" style="display:flex;align-items:center;gap:8px"><i class="net-dot ${snap.running ? '' : 'off'}"></i>${esc((snap.addresses || []).join(', ') || 'Nessuna rete')}${snap.port ? ` · porta ${snap.port}` : ''}</div></div></div>
      <p class="small muted mt">Al primo avvio Windows può chiedere il permesso al firewall: scegli “Consenti” per le reti private.</p>
      <div class="row mt"><button class="btn" id="saveK">${icon('wifi', 15)}Applica chiave</button><button class="btn ghost" id="clr">${icon('trash-2', 15)}Svuota lo storico su questo PC</button></div>`, 'network');
  $('#saveP', box).onclick = async () => {
    const nome = $('#pn', box).value.trim();
    if (!nome) { toast('Inserisci il tuo nome', { type: 'warning' }); return; }
    await ensureProfile({ nome, ruolo: $('#pr', box).value.trim(), colore: $('#pc', box).value || colorFor(nome) });
    await startChat();
    toast('Profilo salvato');
  };
  $('#saveK', box).onclick = async () => { s.chat.networkKey = $('#nk', box).value.trim(); await save('Chiave di rete aggiornata: riavvio la chat'); await window.athlos.system.relaunch(); };
  $('#clr', box).onclick = async () => { if (await confirmDialog('Cancellare tutti i messaggi salvati su questo computer?', { danger: true })) { await window.athlos.chat.clear(); toast('Storico svuotato'); } };
}

// ------------------------------------------------------------------ dati
async function dati(box) {
  const paths = await window.athlos.db.paths();
  const backups = await window.athlos.backup.list();
  const demo = db.clients.filter(c => c.demo).length;
  box.innerHTML = card('Backup', 'Ogni giorno Athlos salva in automatico una copia dell\'archivio (ultimi 30 giorni).', `
      <div class="row wrap"><button class="btn primary" id="bnow">${icon('save', 15)}Backup adesso</button><button class="btn" id="bexp">${icon('download', 15)}Esporta backup completo (.athlos)</button><button class="btn" id="bimp">${icon('upload', 15)}Importa backup</button><button class="btn ghost" id="bdir">${icon('folder-open', 15)}Apri cartella</button></div>
      <div class="card table-wrap mt" style="max-height:300px"><table class="table"><thead><tr><th>Copia</th><th>Data</th><th class="num">Dimensione</th><th></th></tr></thead>
      <tbody>${backups.map(b => `<tr><td class="mono small">${esc(b.name)}</td><td>${new Date(b.mtime).toLocaleString('it-IT')}</td><td class="num">${(b.size / 1024).toFixed(0)} KB</td><td class="right"><button class="btn sm ghost" data-restore="${esc(b.name)}">${icon('rotate-ccw', 14)}Ripristina</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nessun backup ancora</td></tr>'}</tbody></table></div>
      <p class="tiny muted mt">Archivio: <span class="mono selectable">${esc(paths.file)}</span></p>`, 'hard-drive')
    + card('Dati di esempio', '', `<p class="small muted">${demo ? `Ci sono ${demo} atleti di esempio con le loro ricevute.` : 'Carica 24 atleti inventati per fare pratica con ricevute e scadenzario.'}</p>
      <div class="row mt">${demo ? `<button class="btn danger" id="rmDemo">${icon('trash-2', 15)}Elimina i dati di esempio</button>` : `<button class="btn" id="addDemo">${icon('sparkles', 15)}Carica dati di esempio</button>`}</div>`, 'sparkles')
    + card('Statistiche archivio', '', `<div class="grid g4">
      <div><span class="muted small">Anagrafiche</span><h2>${db.clients.length}</h2></div><div><span class="muted small">Ricevute</span><h2>${db.receipts.length}</h2></div>
      <div><span class="muted small">Discipline</span><h2>${db.disciplines.length}</h2></div><div><span class="muted small">Promemoria inviati</span><h2>${db.reminders.length}</h2></div></div>`, 'database');
  $('#bnow', box).onclick = async () => { await window.athlos.backup.now(); toast('Backup creato'); db.log('backup', 'Backup manuale'); rerender(); };
  $('#bexp', box).onclick = async () => { const p = await window.athlos.backup.exportFile(); if (p) toast('Backup esportato: conservalo su una chiavetta o nel cloud'); };
  $('#bimp', box).onclick = async () => {
    if (!(await confirmDialog('L\'archivio attuale verrà sostituito da quello del backup (prima ne salvo una copia di sicurezza).', { title: 'Importare un backup?', danger: true, okLabel: 'Scegli file' }))) return;
    if (await window.athlos.backup.importFile()) { toast('Backup importato: riavvio…'); setTimeout(() => window.athlos.system.relaunch(), 800); }
  };
  $('#bdir', box).onclick = () => window.athlos.backup.openFolder();
  on(box, 'click', '[data-restore]', async (e, t) => {
    if (!(await confirmDialog(`Ripristinare la copia ${t.dataset.restore}? I dati attuali verranno salvati in un backup prima della sostituzione.`, { danger: true, okLabel: 'Ripristina' }))) return;
    await window.athlos.backup.restore(t.dataset.restore);
    toast('Copia ripristinata: riavvio…');
    setTimeout(() => window.athlos.system.relaunch(), 800);
  });
  if ($('#rmDemo', box)) $('#rmDemo', box).onclick = async () => { if (await confirmDialog('Eliminare gli atleti di esempio e le loro ricevute?', { danger: true, okLabel: 'Elimina' })) { const n = await removeDemoData(); toast(`Eliminati ${n} atleti di esempio`); rerender(); } };
  if ($('#addDemo', box)) $('#addDemo', box).onclick = async () => { await createDemoData(); toast('Dati di esempio caricati'); rerender(); };
}

// ------------------------------------------------------------------ info
async function info(box) {
  const i = await window.athlos.system.info();
  box.innerHTML = card('Athlos Suite', `Versione ${i.version}`, `<div class="row" style="gap:18px"><img src="assets/logo.svg" style="width:72px;height:72px"><div>
      <p>Gestionale desktop per società sportive: anagrafiche, ricevute, scadenzario, stampa, Salto Studio, Comunica e Squadra.</p>
      <p class="small muted mt">Motore Electron ${esc(i.electron)} · Chromium ${esc(i.chrome)} · ${esc(i.platform)} ${esc(i.arch)}</p></div></div>`, 'info')
    + card('Scorciatoie da tastiera', '', `<div class="grid g2 small">${[
      ['Ctrl K', 'Ricerca globale e comandi'], ['Ctrl N', 'Nuovo atleta'], ['Ctrl R', 'Nuova ricevuta generale'], ['Ctrl S', 'Salva il modulo aperto'], ['Ctrl ,', 'Impostazioni'], ['Esc', 'Chiudi finestre e menu'],
    ].map(([k, d]) => `<div class="row"><kbd>${k}</kbd><span>${d}</span></div>`).join('')}</div>`, 'keyboard')
    + card('Crediti', '', `<ul class="small" style="margin:0;padding-left:18px;color:var(--text-2)">
      <li>Elenco comuni e codici catastali: ISTAT, tramite il progetto open source comuni-json.</li>
      <li>Icone: Lucide (licenza ISC).</li><li>Caratteri: Plus Jakarta Sans, Outfit e altri, licenza SIL Open Font.</li>
      <li>Immagini delle discipline generate con intelligenza artificiale per Athlos.</li></ul>`, 'heart');
}
