// Scadenzario dei certificati medici: avvisi N giorni prima, invio guidato dei promemoria su WhatsApp,
// aggiornamento rapido del certificato e calendario delle scadenze.
import { db } from '../lib/db.js';
import { icon, avatar, on, $, $$, modal, toast, countUp } from '../lib/ui.js';
import { go } from '../lib/router.js';
import { esc, date, daysUntil, fullName, MESI_BREVI, toISO, todayISO, phoneIntl, relDays, MESI } from '../lib/format.js';
import { reminderText, contactPhone, sendReminder } from './dashboard.js';
import { discChips } from './atleti.js';

let section = 'urgenti';
let monthFilter = null;

function lastReminder(c) {
  const list = db.reminders.filter(r => r.clientId === c.id && r.kind === 'certificato' && r.scadenza === (c.certificato && c.certificato.scadenza));
  return list.sort((a, b) => b.ts - a.ts)[0] || null;
}

function groups() {
  const days = db.settings.reminderDays || 30;
  const active = db.clients.filter(c => c.stato !== 'sospeso');
  const withD = active.map(c => ({ c, d: daysUntil(c.certificato && c.certificato.scadenza) }));
  return {
    days,
    scaduti: withD.filter(x => x.d !== null && x.d < 0).sort((a, b) => a.d - b.d),
    urgenti: withD.filter(x => x.d !== null && x.d >= 0 && x.d <= days).sort((a, b) => a.d - b.d),
    prossimi: withD.filter(x => x.d !== null && x.d > days && x.d <= 90).sort((a, b) => a.d - b.d),
    tutti: withD.filter(x => x.d !== null).sort((a, b) => a.d - b.d),
    mancanti: withD.filter(x => x.d === null).sort((a, b) => fullName(a.c).localeCompare(fullName(b.c))),
  };
}

export default {
  title: 'Scadenzario',
  render(root) {
    root.innerHTML = `
      <div class="page-head">
        <div><div class="eyebrow">Certificati medici</div><h1>Scadenzario</h1><p>Il promemoria parte <b id="dLbl"></b> giorni prima della scadenza. Le famiglie ricevono il messaggio su WhatsApp con un clic.</p></div>
        <div class="actions"><button class="btn" id="setDays">${icon('alarm-clock', 16)}Giorni di preavviso</button><button class="btn" id="editTpl">${icon('message-square-text', 16)}Testo del promemoria</button></div>
      </div>
      <div class="dash-grid" style="margin:0 0 18px" id="kpi"></div>
      <div class="card pad" id="queue" style="margin-bottom:18px"></div>
      <div class="card pad" style="margin-bottom:18px"><div class="row between"><h3 class="section-title" style="margin:0">${icon('calendar-days', 18)}Calendario delle scadenze</h3><span class="muted small" id="calHint">Clicca un mese per vedere chi scade</span></div><div class="chart-bars" id="cal" style="height:150px;margin-top:10px"></div></div>
      <div class="tabs" id="tabs"></div>
      <div class="timeline" id="rows"></div>`;

    const render = () => {
      const g = groups();
      $('#dLbl', root).textContent = g.days;
      $('#kpi', root).innerHTML = [
        ['circle-alert', 'Scaduti', g.scaduti.length, 'linear-gradient(135deg,#EF4444,#EC4899)', 'scaduti'],
        ['alarm-clock', `Entro ${g.days} giorni`, g.urgenti.length, 'linear-gradient(135deg,#F59E0B,#F97316)', 'urgenti'],
        ['calendar-clock', 'Entro 90 giorni', g.prossimi.length, 'var(--grad-cool)', 'prossimi'],
        ['file-text', 'Senza certificato', g.mancanti.length, 'linear-gradient(135deg,#8A86A6,#6B6888)', 'mancanti'],
      ].map(([ic, l, n, gr, sec]) => `<button class="stat c3" style="--g:${gr};text-align:left;cursor:pointer;font:inherit;color:inherit" data-sec="${sec}"><div class="row"><div class="stat-ico" style="width:38px;height:38px">${icon(ic, 18)}</div><div class="stat-lbl">${l}</div></div><div class="stat-val" data-n="${n}">0</div></button>`).join('');
      $$('[data-n]', root).forEach(n => countUp(n, Number(n.dataset.n)));

      // coda promemoria
      const todo = [...g.scaduti, ...g.urgenti].filter(x => !lastReminder(x.c) || Date.now() - lastReminder(x.c).ts > 7 * 86400000);
      const done = [...g.scaduti, ...g.urgenti].length - todo.length;
      const tot = todo.length + done;
      $('#queue', root).innerHTML = `<div class="queue-card">
        <div class="empty-art" style="margin:0;width:70px;height:70px;border-radius:22px;flex:none;${todo.length ? '' : 'background:var(--grad-green)'}">${icon(todo.length ? 'bell-ring' : 'shield-check', 30)}</div>
        <div class="grow">
          <h3 style="font-size:19px">${todo.length ? `${todo.length} ${todo.length === 1 ? 'famiglia da avvisare' : 'famiglie da avvisare'}` : 'Nessun promemoria in sospeso'}</h3>
          <p class="muted small">${todo.length ? 'Invio guidato: Athlos apre WhatsApp con il messaggio già scritto, tu premi invio e passi al successivo.' : 'Tutti gli atleti con certificato scaduto o in scadenza sono stati avvisati negli ultimi 7 giorni.'}</p>
          ${tot ? `<div class="row mt" style="gap:12px"><div class="progress grow"><i style="width:${(done / tot) * 100}%"></i></div><span class="small strong">${done}/${tot} avvisati</span></div>` : ''}
        </div>
        ${todo.length ? `<button class="btn primary lg" id="startQueue">${icon('send', 17)}Avvia invio guidato</button>` : ''}
      </div>`;
      if ($('#startQueue', root)) $('#startQueue', root).onclick = () => runQueue(todo.map(x => x.c), render);

      // calendario 12 mesi
      const now = new Date();
      const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const key = toISO(d).slice(0, 7);
        return { key, label: MESI_BREVI[d.getMonth()], n: g.tutti.filter(x => x.c.certificato.scadenza.startsWith(key)).length };
      });
      const max = Math.max(1, ...months.map(m => m.n));
      $('#cal', root).innerHTML = months.map((m, i) => `<div class="chart-bar" data-month="${m.key}" style="cursor:pointer">
        <b class="small">${m.n || ''}</b><div class="bar ${m.n ? '' : 'dim'}" data-v="${m.n} certificati" style="height:${Math.max(4, (m.n / max) * 100)}%;animation-delay:${i * 0.03}s;${monthFilter === m.key ? 'outline:3px solid var(--accent);outline-offset:2px' : ''}"></div><small>${m.label}</small></div>`).join('');

      const tabs = [['urgenti', `Entro ${g.days} giorni`, g.urgenti.length], ['scaduti', 'Scaduti', g.scaduti.length], ['prossimi', 'Entro 90 giorni', g.prossimi.length], ['tutti', 'Tutti', g.tutti.length], ['mancanti', 'Mancanti', g.mancanti.length]];
      $('#tabs', root).innerHTML = tabs.map(([k, l, n]) => `<button class="tab ${section === k && !monthFilter ? 'active' : ''}" data-tab="${k}">${l} <span class="count">${n}</span></button>`).join('') +
        (monthFilter ? `<button class="tab active" data-tab="${section}">${MESI[Number(monthFilter.slice(5)) - 1]} ${monthFilter.slice(0, 4)} ${icon('x', 14)}</button>` : '');

      const rows = monthFilter ? g.tutti.filter(x => x.c.certificato.scadenza.startsWith(monthFilter)) : g[section];
      $('#rows', root).innerHTML = rows.length ? rows.map(({ c, d }) => row(c, d, g.days)).join('')
        : `<div class="card"><div class="empty"><div class="empty-art" style="background:var(--grad-green)">${icon('circle-check', 32)}</div><h3>Niente da mostrare qui</h3><p>${section === 'mancanti' ? 'Tutti gli atleti hanno la data di scadenza del certificato.' : 'Nessun certificato in questa sezione.'}</p></div></div>`;
    };

    on(root, 'click', '[data-tab]', (e, t) => { section = t.dataset.tab; monthFilter = null; render(); });
    on(root, 'click', '[data-sec]', (e, t) => { section = t.dataset.sec; monthFilter = null; render(); $('#tabs', root).scrollIntoView({ behavior: 'smooth' }); });
    on(root, 'click', '[data-month]', (e, t) => { monthFilter = monthFilter === t.dataset.month ? null : t.dataset.month; render(); });
    on(root, 'click', '[data-open]', (e, t) => go(`/atleti/${t.dataset.open}`));
    on(root, 'click', '[data-wa]', async (e, t) => { await sendReminder(db.client(t.dataset.wa)); render(); });
    on(root, 'click', '[data-mail]', (e, t) => {
      const c = db.client(t.dataset.mail);
      const to = (c.genitore && c.genitore.email) || c.email;
      window.athlos.system.open(`mailto:${to}?subject=${encodeURIComponent(`Certificato medico di ${c.nome} ${c.cognome}`)}&body=${encodeURIComponent(reminderText(c))}`);
      db.all.reminders.push({ id: 'rm-' + Date.now(), clientId: c.id, kind: 'certificato', scadenza: c.certificato?.scadenza, ts: Date.now(), canale: 'email' });
      db.save('reminders').then(render);
    });
    on(root, 'click', '[data-renew]', (e, t) => renewCert(db.client(t.dataset.renew), render));
    $('#setDays', root).onclick = () => {
      modal({
        title: 'Giorni di preavviso', icon: 'alarm-clock', size: 'sm',
        body: `<p class="muted small">Quanti giorni prima della scadenza vuoi avvisare la famiglia?</p><div class="seg mt" id="dd">${[15, 30, 45, 60].map(n => `<button data-v="${n}" class="${db.settings.reminderDays === n ? 'active' : ''}">${n} giorni</button>`).join('')}</div>`,
        onOpen: m => on(m.body, 'click', '[data-v]', async (e, b) => { db.settings.reminderDays = Number(b.dataset.v); await db.save('settings'); m.close(); render(); toast(`Preavviso impostato a ${b.dataset.v} giorni`); }),
      });
    };
    $('#editTpl', root).onclick = () => editTemplate(render);

    render();
    return db.on('clients', render);
  },
};

function row(c, d, days) {
  const cls = d === null ? 'missing' : d < 0 ? 'expired' : d <= days ? 'soon' : 'ok';
  const s = c.certificato && c.certificato.scadenza;
  const dt = s ? new Date(s + 'T00:00:00') : null;
  const rem = lastReminder(c);
  const phone = contactPhone(c);
  return `<div class="due-row ${cls}">
    <div class="due-date">${dt ? `<b>${dt.getDate()}</b><span>${MESI_BREVI[dt.getMonth()]} ${String(dt.getFullYear()).slice(2)}</span>` : `<b>?</b><span>manca</span>`}</div>
    <div class="person" style="cursor:pointer" data-open="${c.id}">${avatar(c, 40)}<div><b>${esc(fullName(c))}</b><small>${d === null ? 'Scadenza non inserita' : `${esc(c.certificato.tipo || '')} · ${relDays(d)}`}</small><div class="chips" style="margin-top:4px">${discChips(c, 2)}</div></div></div>
    <div class="small">${phone ? `${icon('phone', 13)} ${esc(phone)}` : '<span class="muted">Nessun telefono</span>'}${c.genitore?.nome ? `<div class="tiny muted">${esc(c.genitore.relazione || 'Genitore')}: ${esc(c.genitore.nome)}</div>` : ''}
      ${rem ? `<div class="tiny" style="color:var(--ok);font-weight:700;margin-top:3px">${icon('check-check', 13)} Avvisato il ${date(toISO(new Date(rem.ts)))} (${esc(rem.canale)})</div>` : ''}</div>
    <div class="due-actions">
      ${phone ? `<button class="btn sm whatsapp" data-wa="${c.id}">${icon('brand-whatsapp', 15)}${rem ? 'Ricorda' : 'Avvisa'}</button>` : ''}
      ${(c.genitore && c.genitore.email) || c.email ? `<button class="btn icon sm" data-mail="${c.id}" data-tip="Email">${icon('mail', 15)}</button>` : ''}
      <button class="btn sm" data-renew="${c.id}">${icon('calendar-check', 15)}Rinnovato</button>
    </div>
  </div>`;
}

function renewCert(c, after) {
  const base = new Date();
  const exp = new Date(base); exp.setFullYear(exp.getFullYear() + 1); exp.setDate(exp.getDate() - 1);
  modal({
    title: `Nuovo certificato di ${c.nome}`, icon: 'heart-pulse', size: 'sm',
    body: `<div class="col"><div class="seg" id="tipo">${['non agonistico', 'agonistico', 'ludico-motorio'].map(t => `<button data-v="${t}" class="${(c.certificato?.tipo || 'non agonistico') === t ? 'active' : ''}">${t}</button>`).join('')}</div>
      <label class="field"><span>Data di rilascio</span><input type="date" id="ril" value="${todayISO()}"></label>
      <label class="field"><span>Nuova scadenza</span><input type="date" id="sca" value="${toISO(exp)}"></label></div>`,
    onOpen: m => {
      on(m.body, 'click', '#tipo button', (e, b) => $$('#tipo button', m.body).forEach(x => x.classList.toggle('active', x === b)));
      $('#ril', m.body).addEventListener('change', e => {
        const d = new Date(e.target.value + 'T00:00:00'); d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1);
        $('#sca', m.body).value = toISO(d);
      });
    },
    actions: [
      { label: 'Annulla', kind: 'ghost' },
      {
        label: 'Salva certificato', kind: 'primary', icon: 'save', fn: async m => {
          const tipo = $('#tipo .active', m.body)?.dataset.v || 'non agonistico';
          await db.upsertClient({ id: c.id, certificato: { ...(c.certificato || {}), tipo, rilascio: $('#ril', m.body).value, scadenza: $('#sca', m.body).value } });
          db.log('client', `Certificato rinnovato per ${c.nome} ${c.cognome} fino al ${date($('#sca', m.body).value)}`, c.id);
          toast('Certificato aggiornato');
          after();
        },
      },
    ],
  });
}

function editTemplate(after) {
  modal({
    title: 'Testo del promemoria', icon: 'message-square-text', size: 'md',
    body: `<label class="field"><span>Messaggio WhatsApp / email</span><textarea id="tpl" style="min-height:150px">${esc(db.settings.reminderTemplate)}</textarea></label>
      <p class="muted small mt">Variabili disponibili: <code>{nome}</code> (genitore o atleta), <code>{atleta}</code>, <code>{frase}</code> (es. “scade il 05/11 (tra 19 giorni)”), <code>{scadenza}</code>, <code>{giorni}</code>, <code>{societa}</code>.</p>`,
    actions: [
      { label: 'Annulla', kind: 'ghost' },
      { label: 'Salva', kind: 'primary', fn: async m => { db.settings.reminderTemplate = $('#tpl', m.body).value; await db.save('settings'); toast('Testo salvato'); after(); } },
    ],
  });
}

function runQueue(list, after) {
  let i = 0;
  let sent = 0;
  const m = modal({
    title: 'Invio guidato dei promemoria', icon: 'send', size: 'md',
    body: '<div id="q"></div>',
    onClose: () => { if (sent) toast(`${sent} promemoria inviati`); after(); },
  });
  const draw = () => {
    if (i >= list.length) {
      $('#q', m.body).innerHTML = `<div class="empty" style="padding:20px"><div class="empty-art" style="background:var(--grad-green)">${icon('party-popper', 32)}</div><h3>Fatto!</h3><p>Hai inviato ${sent} promemoria su ${list.length}.</p><button class="btn primary" id="end">Chiudi</button></div>`;
      $('#end', m.body).onclick = () => m.close();
      return;
    }
    const c = list[i];
    const d = daysUntil(c.certificato.scadenza);
    const phone = contactPhone(c);
    $('#q', m.body).innerHTML = `
      <div class="row between"><span class="badge accent">${i + 1} di ${list.length}</span><div class="progress" style="width:200px"><i style="width:${(i / list.length) * 100}%"></i></div></div>
      <div class="row mt">${avatar(c, 52)}<div class="person grow"><div><b style="font-size:16px">${esc(fullName(c))}</b><small>Certificato ${d < 0 ? `scaduto da ${-d} giorni` : `in scadenza ${relDays(d)}`} · ${date(c.certificato.scadenza)}</small></div></div></div>
      <label class="field mt"><span>Messaggio per ${esc(phone || 'nessun numero')}</span><textarea id="msg" style="min-height:130px">${esc(reminderText(c))}</textarea></label>
      <div class="row mt" style="justify-content:flex-end">
        <button class="btn ghost" id="skip">Salta</button>
        <button class="btn whatsapp lg" id="send" ${phone ? '' : 'disabled'}>${icon('brand-whatsapp', 18)}Apri WhatsApp e segna inviato</button>
      </div>`;
    $('#skip', m.body).onclick = () => { i++; draw(); };
    $('#send', m.body).onclick = async () => {
      const text = $('#msg', m.body).value;
      await window.athlos.system.open(`https://wa.me/${phoneIntl(phone)}?text=${encodeURIComponent(text)}`);
      db.all.reminders.push({ id: 'rm-' + Date.now(), clientId: c.id, kind: 'certificato', scadenza: c.certificato?.scadenza, ts: Date.now(), canale: 'whatsapp' });
      await db.save('reminders');
      db.log('reminder', `Promemoria certificato inviato a ${c.nome} ${c.cognome}`, c.id);
      sent++;
      i++;
      draw();
    };
  };
  draw();
}
