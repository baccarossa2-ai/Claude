// Anagrafiche: ricerca per nome, cognome, disciplina; filtri, import/export CSV e stampa elenco.
import { db } from '../lib/db.js';
import { icon, avatar, on, $, $$, emptyState, popMenu, modal, toast, confirmDialog } from '../lib/ui.js';
import { go } from '../lib/router.js';
import { esc, age, daysUntil, date, fullName, normalize, debounce, uid, titleCase } from '../lib/format.js';
import { toCSV, parseCSV, parseDateIT } from '../lib/csv.js';
import { decodeCF, validateCF } from '../lib/cf.js';
import { printDocument, listDocument } from '../print/documents.js';
import { sendReminder } from './dashboard.js';

const state = { q: '', disc: null, cert: 'tutti', eta: 'tutti', stato: 'attivi', sort: 'nome', view: matchMedia('(max-width: 760px)').matches ? 'cards' : 'table', selected: new Set() };

export function certBadge(c) {
  const days = db.settings.reminderDays || 30;
  const d = daysUntil(c.certificato && c.certificato.scadenza);
  if (d === null) return '<span class="badge">Mancante</span>';
  if (d < 0) return `<span class="badge danger pulse">Scaduto</span>`;
  if (d <= days) return `<span class="badge warn">Scade ${d === 0 ? 'oggi' : `in ${d} gg`}</span>`;
  return `<span class="badge ok">Valido · ${date(c.certificato.scadenza)}</span>`;
}

export function discChips(c, max = 3) {
  const ds = (c.discipline || []).map(id => db.discipline(id)).filter(Boolean);
  const shown = ds.slice(0, max).map(d => `<span class="chip" style="--dc:${d.colore}">${esc(d.nome)}</span>`).join('');
  return shown + (ds.length > max ? `<span class="chip plain">+${ds.length - max}</span>` : '');
}

function filtered() {
  const days = db.settings.reminderDays || 30;
  const list = db.searchClients(state.q, {
    discipline: state.disc,
    filter: c => {
      if (state.stato === 'attivi' && c.stato === 'sospeso') return false;
      if (state.stato === 'sospesi' && c.stato !== 'sospeso') return false;
      const a = age(c.dataNascita);
      if (state.eta === 'minori' && !(a !== null && a < 18)) return false;
      if (state.eta === 'adulti' && !(a !== null && a >= 18)) return false;
      const d = daysUntil(c.certificato && c.certificato.scadenza);
      if (state.cert === 'validi' && !(d !== null && d > days)) return false;
      if (state.cert === 'scadenza' && !(d !== null && d >= 0 && d <= days)) return false;
      if (state.cert === 'scaduti' && !(d !== null && d < 0)) return false;
      if (state.cert === 'mancanti' && d !== null) return false;
      return true;
    },
  });
  if (state.sort === 'eta') list.sort((a, b) => (a.dataNascita || '').localeCompare(b.dataNascita || '') * -1);
  if (state.sort === 'cert') list.sort((a, b) => (a.certificato?.scadenza || '9999').localeCompare(b.certificato?.scadenza || '9999'));
  if (state.sort === 'recenti') list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return list;
}

export default {
  title: 'Anagrafiche',
  render(root, params, query) {
    if (query.disciplina) state.disc = query.disciplina;
    if (query.q) state.q = query.q;
    if (query.cert) state.cert = query.cert;
    state.selected.clear();

    root.innerHTML = `
      <div class="page-head">
        <div><div class="eyebrow">Anagrafica clienti</div><h1>Atleti e clienti</h1><p id="countLine"></p></div>
        <div class="actions">
          <button class="btn" id="importBtn">${icon('upload', 16)}Importa</button>
          <button class="btn" id="exportBtn">${icon('download', 16)}Esporta</button>
          <button class="btn" id="printBtn">${icon('printer', 16)}Stampa elenco</button>
          <button class="btn primary" data-go="/atleti/nuovo">${icon('user-plus', 16)}Nuovo atleta</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="input-icon">${icon('search', 18)}<input id="q" placeholder="Cerca per nome, cognome, codice fiscale, telefono, genitore…" value="${esc(state.q)}"></div>
        <div class="seg" id="certSeg">
          ${[['tutti', 'Tutti'], ['validi', 'In regola'], ['scadenza', 'In scadenza'], ['scaduti', 'Scaduti'], ['mancanti', 'Senza cert.']].map(([v, l]) => `<button data-v="${v}" class="${state.cert === v ? 'active' : ''}">${l}</button>`).join('')}
        </div>
        <button class="btn" id="moreFilters">${icon('sliders-horizontal', 16)}Filtri</button>
        <div class="seg" id="viewSeg"><button data-v="table" class="${state.view === 'table' ? 'active' : ''}" data-tip="Tabella">${icon('list', 16)}</button><button data-v="cards" class="${state.view === 'cards' ? 'active' : ''}" data-tip="Schede">${icon('layout-grid', 16)}</button></div>
      </div>
      <div class="filters" id="discFilters" style="margin-bottom:16px"></div>
      <div id="bulk" class="alert hidden" style="--ac:var(--accent);margin-bottom:14px"></div>
      <div id="list"></div>`;

    const renderDiscs = () => {
      $('#discFilters', root).innerHTML = `<button class="chip plain ${state.disc ? 'off' : ''}" data-disc="">Tutte le discipline</button>` +
        db.disciplines.map(d => `<button class="chip ${state.disc && state.disc !== d.id ? 'off' : ''}" style="--dc:${d.colore}" data-disc="${d.id}">${esc(d.nome)} <b style="opacity:.7">${db.clients.filter(c => (c.discipline || []).includes(d.id) && c.stato !== 'sospeso').length}</b></button>`).join('');
    };

    const renderList = () => {
      const list = filtered();
      $('#countLine', root).textContent = `${list.length} di ${db.clients.length} anagrafiche${state.disc ? ` · ${db.discipline(state.disc)?.nome}` : ''}${state.q ? ` · ricerca “${state.q}”` : ''}`;
      const el = $('#list', root);
      if (!db.clients.length) {
        el.innerHTML = `<div class="card">${emptyState({ icon: 'users', title: 'Nessun atleta ancora', text: 'Aggiungi il primo atleta o importa il tuo elenco da Excel (CSV). Il codice fiscale si calcola da solo.', action: { label: 'Aggiungi il primo atleta', icon: 'user-plus' } })}</div>`;
        $('[data-empty-act]', el).onclick = () => go('/atleti/nuovo');
        return;
      }
      if (!list.length) {
        el.innerHTML = `<div class="card">${emptyState({ icon: 'search', title: 'Nessun risultato', text: 'Prova a cambiare la ricerca o i filtri.' })}</div>`;
        return;
      }
      if (state.view === 'cards') {
        el.innerHTML = `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${list.map(c => `
          <div class="card hoverable pad-sm" data-open="${c.id}">
            <div class="row">${avatar(c, 50)}<div class="person grow"><div><b>${esc(fullName(c))}</b><small>${age(c.dataNascita) ?? '–'} anni · Tessera ${esc(c.tessera || '')}</small></div></div></div>
            <div class="chips" style="margin:12px 0 10px">${discChips(c)}</div>
            <div class="row between">${certBadge(c)}<span class="muted small">${esc(c.telefono || c.genitore?.telefono || '')}</span></div>
          </div>`).join('')}</div>`;
        return;
      }
      el.innerHTML = `<div class="card table-wrap"><table class="table">
        <thead><tr><th style="width:36px"><input type="checkbox" id="selAll"></th><th>Atleta</th><th>Età</th><th>Discipline</th><th>Certificato medico</th><th>Contatto</th><th></th></tr></thead>
        <tbody>${list.map(c => {
          const a = age(c.dataNascita);
          return `<tr class="click" data-open="${c.id}">
            <td data-stop><input type="checkbox" data-sel="${c.id}" ${state.selected.has(c.id) ? 'checked' : ''}></td>
            <td><div class="person">${avatar(c, 38)}<div><b>${esc(fullName(c))}${c.stato === 'sospeso' ? ' <span class="badge">Sospeso</span>' : ''}</b><small class="mono">${esc(c.codiceFiscale || 'Codice fiscale mancante')}</small></div></div></td>
            <td class="nowrap">${a === null ? '–' : `${a} <span class="muted small">anni</span>`}${a !== null && a < 18 ? ' <span class="badge info">Minore</span>' : ''}</td>
            <td><div class="chips">${discChips(c, 2)}</div></td>
            <td>${certBadge(c)}</td>
            <td class="small nowrap">${esc(c.telefono || '')}${c.genitore?.telefono ? `<div class="muted tiny">Gen.: ${esc(c.genitore.telefono)}</div>` : ''}</td>
            <td class="right nowrap" data-stop>
              <button class="btn icon sm ghost" data-receipt="${c.id}" data-tip="Nuova ricevuta">${icon('receipt-text', 16)}</button>
              <button class="btn icon sm ghost" data-menu="${c.id}">${icon('ellipsis-vertical', 16)}</button>
            </td>
          </tr>`;
        }).join('')}</tbody></table></div>`;
    };

    const renderBulk = () => {
      const b = $('#bulk', root);
      const n = state.selected.size;
      b.classList.toggle('hidden', !n);
      if (!n) return;
      b.innerHTML = `<span class="a-ico">${icon('list-checks', 18)}</span><div class="grow"><b>${n} selezionati</b><small>Azioni sull'insieme degli atleti scelti</small></div>
        <button class="btn sm" data-bulk="export">${icon('download', 15)}Esporta</button>
        <button class="btn sm" data-bulk="print">${icon('printer', 15)}Stampa</button>
        <button class="btn sm" data-bulk="msg">${icon('megaphone', 15)}Messaggio</button>
        <button class="btn sm ghost" data-bulk="clear">${icon('x', 15)}</button>`;
    };

    renderDiscs();
    renderList();

    const qInput = $('#q', root);
    qInput.addEventListener('input', debounce(() => { state.q = qInput.value; renderList(); }, 120));
    setTimeout(() => qInput.focus(), 50);

    on(root, 'click', '[data-go]', (e, t) => go(t.dataset.go));
    on(root, 'click', '[data-disc]', (e, t) => { state.disc = t.dataset.disc || null; renderDiscs(); renderList(); });
    on($('#certSeg', root), 'click', 'button', (e, t) => { state.cert = t.dataset.v; $$('#certSeg button', root).forEach(b => b.classList.toggle('active', b === t)); renderList(); });
    on($('#viewSeg', root), 'click', 'button', (e, t) => { state.view = t.dataset.v; $$('#viewSeg button', root).forEach(b => b.classList.toggle('active', b === t)); renderList(); });
    on(root, 'click', '[data-open]', (e, t) => { if (e.target.closest('[data-stop]')) return; go(`/atleti/${t.dataset.open}`); });
    on(root, 'click', '[data-receipt]', (e, t) => go(`/ricevute/nuova?cliente=${t.dataset.receipt}`));
    on(root, 'change', '[data-sel]', (e, t) => { if (t.checked) state.selected.add(t.dataset.sel); else state.selected.delete(t.dataset.sel); renderBulk(); });
    on(root, 'change', '#selAll', (e, t) => {
      for (const c of filtered()) if (t.checked) state.selected.add(c.id); else state.selected.delete(c.id);
      renderList(); renderBulk();
    });
    on(root, 'click', '[data-menu]', (e, t) => {
      const c = db.client(t.dataset.menu);
      popMenu(t, [
        { label: 'Apri scheda', icon: 'user', fn: () => go(`/atleti/${c.id}`) },
        { label: 'Modifica', icon: 'pencil', fn: () => go(`/atleti/${c.id}/modifica`) },
        { label: 'Ricevuta generale', icon: 'receipt-text', fn: () => go(`/ricevute/nuova?cliente=${c.id}&tipo=generale`) },
        { label: 'Ricevuta commerciale', icon: 'receipt', fn: () => go(`/ricevute/nuova?cliente=${c.id}&tipo=commerciale`) },
        { label: 'Promemoria certificato su WhatsApp', icon: 'brand-whatsapp', fn: () => sendReminder(c) },
        '-',
        { label: c.stato === 'sospeso' ? 'Riattiva' : 'Sospendi', icon: c.stato === 'sospeso' ? 'user-check' : 'user-x', fn: async () => { await db.upsertClient({ id: c.id, stato: c.stato === 'sospeso' ? 'attivo' : 'sospeso' }); renderList(); } },
        { label: 'Elimina', icon: 'trash-2', danger: true, fn: () => removeClient(c, renderList) },
      ]);
    });
    $('#moreFilters', root).onclick = e => popMenu(e.currentTarget, [
      { header: 'Età' },
      ...[['tutti', 'Tutte le età'], ['minori', 'Solo minorenni'], ['adulti', 'Solo maggiorenni']].map(([v, l]) => ({ label: (state.eta === v ? '✓ ' : '') + l, fn: () => { state.eta = v; renderList(); } })),
      { header: 'Stato' },
      ...[['attivi', 'Attivi'], ['sospesi', 'Sospesi'], ['tutti', 'Tutti']].map(([v, l]) => ({ label: (state.stato === v ? '✓ ' : '') + l, fn: () => { state.stato = v; renderList(); } })),
      { header: 'Ordina per' },
      ...[['nome', 'Cognome e nome'], ['eta', 'Età (dal più giovane)'], ['cert', 'Scadenza certificato'], ['recenti', 'Iscrizione più recente']].map(([v, l]) => ({ label: (state.sort === v ? '✓ ' : '') + l, fn: () => { state.sort = v; renderList(); } })),
    ], { align: 'left' });

    on(root, 'click', '[data-bulk]', (e, t) => {
      const sel = db.clients.filter(c => state.selected.has(c.id));
      const a = t.dataset.bulk;
      if (a === 'clear') { state.selected.clear(); renderList(); renderBulk(); }
      if (a === 'export') exportCSV(sel);
      if (a === 'print') printList(sel);
      if (a === 'msg') go(`/comunica?destinatari=${sel.map(c => c.id).join(',')}`);
    });

    $('#exportBtn', root).onclick = () => exportCSV(filtered());
    $('#printBtn', root).onclick = () => printList(filtered());
    $('#importBtn', root).onclick = () => importCSV(() => { renderDiscs(); renderList(); });

    return db.on('clients', () => { renderDiscs(); renderList(); });
  },
};

export async function removeClient(c, after) {
  const recs = db.receiptsOf(c.id).length;
  const ok = await confirmDialog(`Eliminare l'anagrafica di ${c.nome} ${c.cognome}?${recs ? ` Le sue ${recs} ricevute resteranno archiviate.` : ''}`, { title: 'Elimina atleta', danger: true, okLabel: 'Elimina' });
  if (!ok) return;
  const removed = await db.removeClient(c.id);
  db.log('client', `Eliminata l'anagrafica di ${c.nome} ${c.cognome}`);
  toast(`${c.nome} ${c.cognome} eliminato`, {
    type: 'info',
    action: { label: 'Annulla', fn: async () => { db.clients.push(removed); await db.save('clients'); toast('Anagrafica ripristinata'); after && after(); } },
  });
  after && after();
}

const HEAD = ['Tessera', 'Cognome', 'Nome', 'Sesso', 'Data di nascita', 'Luogo di nascita', 'Prov. nascita', 'Codice fiscale', 'Indirizzo', 'Civico', 'CAP', 'Comune', 'Provincia', 'Telefono', 'Email', 'Discipline', 'Tipo certificato', 'Scadenza certificato', 'Genitore nome', 'Genitore cognome', 'Genitore codice fiscale', 'Genitore telefono', 'Genitore email', 'Stato', 'Note'];

async function exportCSV(list) {
  const rows = [HEAD, ...list.map(c => [
    c.tessera, c.cognome, c.nome, c.sesso, date(c.dataNascita).replace('—', ''), c.luogoNascita, c.provinciaNascita, c.codiceFiscale,
    c.residenza?.indirizzo, c.residenza?.civico, c.residenza?.cap, c.residenza?.comune, c.residenza?.provincia, c.telefono, c.email,
    (c.discipline || []).map(id => db.discipline(id)?.nome).filter(Boolean).join(', '), c.certificato?.tipo, date(c.certificato?.scadenza).replace('—', ''),
    c.genitore?.nome, c.genitore?.cognome, c.genitore?.codiceFiscale, c.genitore?.telefono, c.genitore?.email, c.stato, c.note,
  ])];
  const p = await window.athlos.file.save({ defaultName: `Anagrafiche ${db.company.denominazione || ''} ${new Date().toISOString().slice(0, 10)}.csv`, filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }], text: toCSV(rows), reveal: true });
  if (p) toast(`Esportate ${list.length} anagrafiche`);
}

async function printList(list) {
  const html = listDocument({
    title: 'Elenco atleti',
    subtitle: `${list.length} anagrafiche · ${date(new Date().toISOString().slice(0, 10))}`,
    head: ['#', 'Cognome e nome', 'Nato/a il', 'Codice fiscale', 'Discipline', 'Certificato', 'Telefono'],
    rows: list.map((c, i) => [i + 1, fullName(c), date(c.dataNascita), c.codiceFiscale || '', (c.discipline || []).map(id => db.discipline(id)?.nome).filter(Boolean).join(', '), date(c.certificato?.scadenza), c.telefono || c.genitore?.telefono || '']),
  });
  await printDocument(html, { title: 'Elenco atleti', landscape: true });
}

const ALIASES = {
  nome: ['nome', 'first name', 'name'],
  cognome: ['cognome', 'last name', 'surname'],
  sesso: ['sesso', 'genere', 'sex'],
  dataNascita: ['data di nascita', 'data nascita', 'nato il', 'nascita', 'datanascita'],
  luogoNascita: ['luogo di nascita', 'luogo nascita', 'comune di nascita', 'nato a'],
  provinciaNascita: ['prov. nascita', 'provincia nascita', 'provincia di nascita'],
  codiceFiscale: ['codice fiscale', 'cf', 'cod. fiscale', 'codicefiscale'],
  indirizzo: ['indirizzo', 'via', 'residenza'],
  civico: ['civico', 'n. civico', 'numero civico'],
  cap: ['cap'],
  comune: ['comune', 'città', 'citta', 'comune di residenza'],
  provincia: ['provincia', 'prov', 'prov.'],
  telefono: ['telefono', 'cellulare', 'tel', 'cell'],
  email: ['email', 'e-mail', 'mail'],
  discipline: ['discipline', 'disciplina', 'corso', 'corsi'],
  certTipo: ['tipo certificato'],
  certScadenza: ['scadenza certificato', 'scadenza', 'certificato'],
  gNome: ['genitore nome', 'nome genitore'],
  gCognome: ['genitore cognome', 'cognome genitore'],
  gCf: ['genitore codice fiscale', 'cf genitore'],
  gTel: ['genitore telefono', 'telefono genitore', 'cellulare genitore'],
  gEmail: ['genitore email', 'email genitore'],
  note: ['note'],
};

async function importCSV(after) {
  const files = await window.athlos.file.open({ title: 'Importa anagrafiche (CSV)', filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }], readText: true });
  if (!files.length) return;
  const rows = parseCSV(files[0].text);
  if (rows.length < 2) { toast('Il file non contiene righe da importare', { type: 'warning' }); return; }
  const head = rows[0].map(h => normalize(h).trim());
  const idx = {};
  for (const [k, list] of Object.entries(ALIASES)) {
    const i = head.findIndex(h => list.includes(h));
    if (i >= 0) idx[k] = i;
  }
  if (idx.nome === undefined || idx.cognome === undefined) {
    toast('Servono almeno le colonne "Nome" e "Cognome"', { type: 'error' });
    return;
  }
  const g = (r, k) => (idx[k] !== undefined ? String(r[idx[k]] || '').trim() : '');
  const parsed = rows.slice(1).map(r => {
    const cf = g(r, 'codiceFiscale').toUpperCase();
    const dec = cf && validateCF(cf).ok ? decodeCF(cf) : null;
    const discNames = g(r, 'discipline').split(/[,|/]+/).map(s => normalize(s.trim())).filter(Boolean);
    const discipline = db.disciplines.filter(d => discNames.some(n => normalize(d.nome).includes(n) || n.includes(normalize(d.nome)))).map(d => d.id);
    const gn = g(r, 'gNome');
    return {
      id: uid('c-'),
      nome: titleCase(g(r, 'nome')),
      cognome: titleCase(g(r, 'cognome')),
      sesso: (g(r, 'sesso').toUpperCase()[0] || dec?.sesso || ''),
      dataNascita: parseDateIT(g(r, 'dataNascita')) || dec?.dataNascita || '',
      luogoNascita: titleCase(g(r, 'luogoNascita')) || dec?.luogoNascita || '',
      provinciaNascita: g(r, 'provinciaNascita').toUpperCase() || dec?.provinciaNascita || '',
      codiceFiscale: cf,
      residenza: { indirizzo: g(r, 'indirizzo'), civico: g(r, 'civico'), cap: g(r, 'cap'), comune: titleCase(g(r, 'comune')), provincia: g(r, 'provincia').toUpperCase() },
      telefono: g(r, 'telefono'),
      email: g(r, 'email'),
      discipline,
      certificato: { tipo: g(r, 'certTipo') || 'non agonistico', scadenza: parseDateIT(g(r, 'certScadenza')) },
      genitore: gn ? { nome: titleCase(gn), cognome: titleCase(g(r, 'gCognome')), codiceFiscale: g(r, 'gCf').toUpperCase(), telefono: g(r, 'gTel'), email: g(r, 'gEmail'), relazione: 'Genitore' } : null,
      note: g(r, 'note'),
    };
  }).filter(c => c.nome || c.cognome);
  const dup = parsed.filter(p => p.codiceFiscale && db.clients.some(c => c.codiceFiscale === p.codiceFiscale));
  modal({
    title: 'Importa anagrafiche',
    subtitle: files[0].name,
    icon: 'file-spreadsheet',
    size: 'lg',
    body: `<p class="lead">Trovate <b>${parsed.length}</b> righe. Colonne riconosciute: ${Object.keys(idx).length}.${dup.length ? ` <b>${dup.length}</b> hanno un codice fiscale già presente e verranno aggiornate.` : ''}</p>
      <div class="card table-wrap mt" style="max-height:340px"><table class="table"><thead><tr><th>Cognome e nome</th><th>Nascita</th><th>Codice fiscale</th><th>Discipline</th><th>Cert.</th></tr></thead>
      <tbody>${parsed.slice(0, 50).map(c => `<tr><td>${esc(fullName(c))}</td><td>${date(c.dataNascita)}</td><td class="mono small">${esc(c.codiceFiscale)}</td><td>${discChips(c, 2)}</td><td>${date(c.certificato.scadenza)}</td></tr>`).join('')}</tbody></table></div>
      ${parsed.length > 50 ? `<p class="muted small mt">…e altre ${parsed.length - 50} righe.</p>` : ''}`,
    actions: [
      { label: 'Annulla', kind: 'ghost' },
      {
        label: `Importa ${parsed.length} anagrafiche`, kind: 'primary', icon: 'upload', fn: async () => {
          for (const p of parsed) {
            const ex = p.codiceFiscale && db.clients.find(c => c.codiceFiscale === p.codiceFiscale);
            if (ex) { const { id, ...rest } = p; await db.upsertClient({ ...rest, id: ex.id }); } else await db.upsertClient({ ...p, id: undefined });
          }
          db.log('client', `Importate ${parsed.length} anagrafiche da CSV`);
          toast(`Importate ${parsed.length} anagrafiche`);
          after && after();
        },
      },
    ],
  });
}
