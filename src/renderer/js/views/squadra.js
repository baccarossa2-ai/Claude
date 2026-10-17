// Squadra: chat di lavoro tra le postazioni della palestra (rete locale), con canali,
// messaggi diretti, conferme di lettura, reazioni, risposte, messaggi fissati, compiti e immagini.
import { db } from '../lib/db.js';
import { icon, on, $, $$, toast, modal, avatar, el, popMenu, promptDialog, confirmDialog, loadImage } from '../lib/ui.js';
import { esc, time, date, toISO, todayISO, colorFor, relTime, normalize } from '../lib/format.js';
import { chatState, onChat, startChat, ensureProfile, unreadCount, profile } from '../lib/chatstate.js';

const REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '🔥', '✅', '🎉'];
const QUICK = ['👍 Ricevuto', 'Arrivo subito!', 'Ci penso io', 'Grazie mille! 🙏', 'Lezione coperta ✅', 'Chi può sostituire?', 'Ne parliamo dopo', 'Fatto! ✔️'];
const EMOJI = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😴', '😅', '👍', '👏', '🙏', '💪', '🔥', '🎉', '❤️', '💜', '✅', '❌', '⚠️', '📅', '⏰', '📍', '🏆', '🥇', '🤸‍♀️', '🥋', '🎪', '🎀', '☕', '🍕', '🚗', '📸'];

let active = 'generale';
let replyTo = null;
let showInfo = false;
let asTask = false;

export default {
  title: 'Squadra',
  full: true,
  async render(root) {
    if (!profile()) return setupProfile(root);
    if (!chatState.snap) await startChat();
    root.innerHTML = `<div class="chat ${showInfo ? 'with-info' : ''}" id="chat">
      <aside class="chat-side">
        <div class="chat-side-head">
          <h2>${icon('messages-square', 24)}Squadra</h2>
          <div class="chat-me" id="me"></div>
          <div class="input-icon mt" style="margin-top:12px">${icon('search', 16)}<input class="input" id="cs" placeholder="Cerca nei messaggi…"></div>
        </div>
        <div class="chat-list" id="clist"></div>
      </aside>
      <section class="chat-main" id="cmain"></section>
      <aside class="chat-info" id="cinfo"></aside>
    </div>`;

    const s = () => chatState.snap;
    const me = () => profile();
    let search = '';
    let typingTimer = 0;

    const channelOf = id => {
      if (id.startsWith('dm:')) {
        const other = id.slice(3).split('|').find(x => x !== me().id);
        const c = (s().contacts || {})[other] || { nome: 'Collega', colore: '#7C4DFF' };
        return { id, nome: c.nome, descrizione: c.ruolo || 'Messaggio diretto', dm: true, person: c, online: (s().online || []).some(o => o.id === other) };
      }
      return s().channels.find(c => c.id === id) || s().channels[0];
    };
    const msgsOf = id => s().messages.filter(m => m.channel === id);
    const lastOf = id => { const l = msgsOf(id); return l[l.length - 1]; };
    const dmId = otherId => 'dm:' + [me().id, otherId].sort().join('|');

    const renderMe = () => {
      const online = (s().online || []).length;
      $('#me', root).innerHTML = `${avatar({ nome: me().nome, cognome: '', colore: me().colore }, 36)}<div class="grow" style="min-width:0"><b class="ellipsis" style="display:block">${esc(me().nome)}</b><small class="muted">${esc(me().ruolo || '')}</small></div>
        <span class="row small" style="gap:6px" data-tip="${online ? `${online} colleghi collegati` : 'Nessun collega collegato'}"><i class="net-dot ${s().running ? '' : 'off'}"></i>${online}</span>`;
    };

    const renderList = () => {
      const q = normalize(search);
      const contacts = Object.values(s().contacts || {}).filter(c => c.id !== me().id);
      const onlineIds = new Set((s().online || []).map(o => o.id));
      contacts.sort((a, b) => (onlineIds.has(b.id) - onlineIds.has(a.id)) || a.nome.localeCompare(b.nome));
      const chanHtml = s().channels.map(c => {
        const last = lastOf(c.id);
        const u = unreadCount(c.id);
        return `<button class="chan ${active === c.id ? 'active' : ''}" data-ch="${c.id}"><span class="ch-ico" style="--cc:${c.colore}">${icon(c.icona || 'hash', 18)}</span>
          <span class="ch-txt"><b>${esc(c.nome)}</b><small>${last ? `${last.from === me().id ? 'Tu: ' : esc(last.fromName) + ': '}${esc(last.deleted ? 'messaggio eliminato' : last.text || '📷 Foto')}` : esc(c.descrizione || '')}</small></span>
          <span class="ch-meta">${last ? time(last.ts) : ''}${u ? `<span class="unread">${u}</span>` : ''}</span></button>`;
      }).join('');
      const dmHtml = contacts.map(c => {
        const id = dmId(c.id);
        const last = lastOf(id);
        const u = unreadCount(id);
        return `<button class="chan ${active === id ? 'active' : ''}" data-ch="${id}"><span class="presence ${onlineIds.has(c.id) ? 'on' : ''}">${avatar({ nome: c.nome, cognome: '', colore: c.colore }, 38)}</span>
          <span class="ch-txt"><b>${esc(c.nome)}</b><small>${last ? esc(last.deleted ? 'messaggio eliminato' : last.text || '📷 Foto') : esc(c.ruolo || (onlineIds.has(c.id) ? 'Online' : `Visto ${relTime(c.lastSeen || Date.now())}`))}</small></span>
          <span class="ch-meta">${last ? time(last.ts) : ''}${u ? `<span class="unread">${u}</span>` : ''}</span></button>`;
      }).join('');
      let results = '';
      if (q) {
        const found = s().messages.filter(m => !m.deleted && normalize(m.text).includes(q)).slice(-30).reverse();
        results = `<h4>Risultati (${found.length})</h4>` + found.map(m => `<button class="chan" data-ch="${m.channel}" data-jump="${m.id}"><span class="ch-txt"><b>${esc(m.fromName)} · ${esc(channelOf(m.channel).nome)}</b><small>${esc(m.text)}</small></span><span class="ch-meta">${date(toISO(new Date(m.ts)), 'short')}</span></button>`).join('');
      }
      $('#clist', root).innerHTML = results + `<h4>Canali <button data-addch data-tip="Nuovo canale">${icon('plus', 15)}</button></h4>${chanHtml}
        <h4>Messaggi diretti</h4>${dmHtml || `<p class="muted small" style="padding:4px 10px">Quando altri PC della palestra apriranno Athlos sulla stessa rete, i colleghi compariranno qui.</p>`}`;
    };

    const renderMain = () => {
      const ch = channelOf(active);
      chatState.activeChannel = active;
      const list = msgsOf(active);
      const pinned = list.filter(m => m.pinned && !m.deleted);
      const onlineN = (s().online || []).length;
      $('#cmain', root).innerHTML = `
        <header class="chat-head">
          <button class="btn icon sm ghost m-only" data-mback aria-label="Indietro">${icon('arrow-left', 20)}</button>
          ${ch.dm ? `<span class="presence ${ch.online ? 'on' : ''}">${avatar({ nome: ch.nome, cognome: '', colore: ch.person.colore }, 40)}</span>` : `<span class="ch-ico" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:#fff;background:${ch.colore}">${icon(ch.icona || 'hash', 19)}</span>`}
          <div><h3>${ch.dm ? '' : '# '}${esc(ch.nome)}</h3><small>${ch.dm ? (ch.online ? 'Online ora' : esc(ch.descrizione)) : `${esc(ch.descrizione || '')} · ${onlineN + 1} ${onlineN ? 'persone collegate' : 'persona collegata (tu)'}`}</small></div>
          <div class="actions">
            <button class="btn icon sm ghost" data-tasks data-tip="Compiti">${icon('list-checks', 18)}</button>
            <button class="btn icon sm ghost" data-info data-tip="Dettagli">${icon('panel-right', 18)}</button>
          </div>
        </header>
        ${pinned.length ? `<div class="pinned-bar" data-jump="${pinned[pinned.length - 1].id}">${icon('pin', 15)}<b>Fissato:</b><span class="ellipsis grow">${esc(pinned[pinned.length - 1].text || '📷 Foto')}</span>${pinned.length > 1 ? `<span class="badge">${pinned.length}</span>` : ''}</div>` : ''}
        <div class="chat-msgs" id="msgs">${list.length ? messagesHTML(list) : emptyChannel(ch)}</div>
        <div class="typing" id="typing"></div>
        <div class="composer">
          <div class="quick-replies">${QUICK.map(q => `<button data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div>
          ${replyTo ? `<div class="reply-bar">${icon('reply', 15)}<div class="grow ellipsis">Rispondi a <b>${esc(replyTo.fromName)}</b>: ${esc(replyTo.text || '📷 Foto')}</div><button class="btn icon sm ghost" data-cancelreply>${icon('x', 14)}</button></div>` : ''}
          <div class="composer-box">
            <button class="btn icon sm ghost" data-emoji data-tip="Emoji">${icon('smile-plus', 19)}</button>
            <button class="btn icon sm ghost" data-attach data-tip="Invia una foto">${icon('image-plus', 19)}</button>
            <button class="btn icon sm ${asTask ? 'soft' : 'ghost'}" data-astask data-tip="Invia come compito da spuntare">${icon('square-check-big', 19)}</button>
            <textarea id="inp" rows="1" placeholder="${asTask ? 'Descrivi il compito… (es. Chiamare la famiglia Rossi)' : `Scrivi a ${ch.dm ? esc(ch.nome) : '#' + esc(ch.nome)}…`}"></textarea>
            <button class="btn primary icon send" data-send>${icon('send-horizontal', 19)}</button>
          </div>
        </div>`;
      const box = $('#msgs', root);
      box.scrollTop = box.scrollHeight;
      const inp = $('#inp', root);
      inp.addEventListener('input', () => {
        inp.style.height = 'auto';
        inp.style.height = Math.min(160, inp.scrollHeight) + 'px';
        if (Date.now() - typingTimer > 2500) { typingTimer = Date.now(); window.athlos.chat.typing(active); }
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
      setTimeout(() => inp.focus(), 30);
      if (document.hasFocus()) window.athlos.chat.read(active);
      renderInfo();
    };

    const messagesHTML = list => {
      let out = '';
      let lastDay = '';
      let prev = null;
      for (const m of list) {
        const day = toISO(new Date(m.ts));
        if (day !== lastDay) { out += `<div class="day-sep">${day === todayISO() ? 'Oggi' : date(day, 'long')}</div>`; lastDay = day; prev = null; }
        const mine = m.from === me().id;
        const cont = prev && prev.from === m.from && m.ts - prev.ts < 5 * 60000;
        const quoted = m.replyTo ? s().messages.find(x => x.id === m.replyTo) : null;
        const reacts = Object.entries(m.reactions || {}).filter(([, v]) => v.length);
        const read = (m.readBy || []).some(x => x !== m.from);
        const delivered = (m.delivered || []).some(x => x !== m.from);
        out += `<div class="msg ${mine ? 'mine' : ''} ${cont ? 'cont' : ''}" data-mid="${m.id}" id="m-${m.id}">
          ${avatar({ nome: m.fromName, cognome: '', colore: m.fromColor }, 30)}
          <div>
            <div class="bubble-c">
              ${!mine && !cont && !active.startsWith('dm:') ? `<div class="who" style="color:${m.fromColor || colorFor(m.fromName)}">${esc(m.fromName)}</div>` : ''}
              ${quoted ? `<div class="reply-q"><b>${esc(quoted.fromName)}</b><br>${esc((quoted.text || '📷 Foto').slice(0, 120))}</div>` : ''}
              ${m.deleted ? '<div class="txt" style="opacity:.6;font-style:italic">🚫 Messaggio eliminato</div>' : `
                ${m.attachment && m.attachment.dataUrl ? `<img class="att" src="${m.attachment.dataUrl}" data-zoom alt="">` : ''}
                ${m.kind === 'task' && m.task ? `<div class="task-card ${m.task.done ? 'done' : ''}"><label><input type="checkbox" data-task="${m.id}" ${m.task.done ? 'checked' : ''}><span class="task-title">${linkify(m.text)}</span></label>${m.task.done ? `<div class="tiny" style="opacity:.8;margin-top:4px">✔ Completato da ${esc(m.task.doneBy || '')}</div>` : ''}</div>` : m.text ? `<div class="txt">${linkify(m.text)}</div>` : ''}`}
              <div class="meta">${m.pinned ? icon('pin', 11) : ''}${time(m.ts)}${mine ? icon(read || delivered ? 'check-check' : 'check', 14, read ? 'read' : '') : ''}</div>
            </div>
            ${reacts.length ? `<div class="reacts">${reacts.map(([e, who]) => `<button class="${who.includes(me().id) ? 'me' : ''}" data-react="${e}" data-rid="${m.id}" title="${esc(who.map(id => (s().contacts[id] || {}).nome || 'Tu').join(', '))}">${e} ${who.length}</button>`).join('')}</div>` : ''}
          </div>
          ${m.deleted ? '' : `<div class="msg-tools">${REACTIONS.slice(0, 4).map(e => `<button data-react="${e}" data-rid="${m.id}">${e}</button>`).join('')}<button data-more="${m.id}">${icon('ellipsis', 16)}</button></div>`}
        </div>`;
        prev = m;
      }
      return out;
    };

    const emptyChannel = ch => `<div class="chat-empty"><img src="assets/images/team.webp" alt="" style="width:100%;max-width:380px;aspect-ratio:16/9;object-fit:cover">
      <h3>${ch.dm ? `Inizia a scrivere a ${esc(ch.nome)}` : `Benvenuto in #${esc(ch.nome)}`}</h3>
      <p class="muted small" style="margin-top:6px">${ch.dm ? 'I messaggi diretti sono visibili solo a voi due.' : esc(ch.descrizione || '')} I messaggi viaggiano solo nella rete della palestra.</p></div>`;

    const renderInfo = () => {
      const ch = channelOf(active);
      const list = msgsOf(active);
      const tasks = list.filter(m => m.kind === 'task' && !m.deleted);
      const imgs = list.filter(m => m.attachment && m.attachment.dataUrl && !m.deleted).slice(-9).reverse();
      const pinned = list.filter(m => m.pinned && !m.deleted);
      $('#cinfo', root).innerHTML = showInfo ? `
        <div class="row between"><h3>Dettagli</h3><button class="btn icon sm ghost" data-info>${icon('x', 16)}</button></div>
        <p class="muted small mt">${esc(ch.descrizione || '')}</p>
        <h4 class="section-title mt-lg" style="font-size:14px">${icon('wifi', 15)}Online (${(s().online || []).length + 1})</h4>
        <div class="col" style="gap:6px"><div class="list-item">${avatar({ nome: me().nome, cognome: '' }, 30)}<b class="small">${esc(me().nome)} (tu)</b></div>
          ${(s().online || []).map(o => `<div class="list-item" style="cursor:pointer" data-dm="${o.id}"><span class="presence on">${avatar({ nome: o.nome, cognome: '' }, 30)}</span><div class="grow"><b class="small">${esc(o.nome)}</b><div class="tiny muted">${esc(o.ruolo || '')} · ${esc(o.address || '')}</div></div></div>`).join('')}</div>
        <h4 class="section-title mt-lg" style="font-size:14px">${icon('list-checks', 15)}Compiti (${tasks.filter(t => !t.task?.done).length} aperti)</h4>
        ${tasks.length ? tasks.slice().reverse().map(t => `<label class="check small" style="padding:6px 0;${t.task?.done ? 'text-decoration:line-through;opacity:.6' : ''}"><input type="checkbox" data-task="${t.id}" ${t.task?.done ? 'checked' : ''}>${esc(t.text)}</label>`).join('') : '<p class="muted small">Nessun compito. Usa il pulsante ☑ per inviarne uno.</p>'}
        <h4 class="section-title mt-lg" style="font-size:14px">${icon('pin', 15)}Fissati</h4>
        ${pinned.length ? pinned.map(p => `<div class="list-item small" style="cursor:pointer" data-jump="${p.id}">${esc((p.text || '📷 Foto').slice(0, 80))}</div>`).join('') : '<p class="muted small">Nessun messaggio fissato.</p>'}
        <h4 class="section-title mt-lg" style="font-size:14px">${icon('image', 15)}Foto condivise</h4>
        ${imgs.length ? `<div class="grid g3" style="gap:6px">${imgs.map(m => `<img src="${m.attachment.dataUrl}" data-zoom style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;cursor:zoom-in">`).join('')}</div>` : '<p class="muted small">Nessuna foto.</p>'}
        ${!ch.dm && !['generale', 'segreteria', 'istruttori', 'gare'].includes(ch.id) ? `<button class="btn sm ghost mt-lg" data-delch="${ch.id}">${icon('trash-2', 14)}Rimuovi canale</button>` : ''}` : '';
      $('#chat', root).classList.toggle('with-info', showInfo);
    };

    const renderTyping = () => {
      const t = chatState.typing[active];
      $('#typing', root).innerHTML = t && t.until > Date.now() ? `<i></i><i></i><i></i> ${esc(t.who)} sta scrivendo…` : '';
    };

    const send = async (textOverride, attachment) => {
      const inp = $('#inp', root);
      const text = (textOverride ?? inp.value).trim();
      if (!text && !attachment) return;
      const payload = { channel: active, text, replyTo: replyTo ? replyTo.id : null, attachment: attachment || null };
      if (asTask && text && !attachment) { payload.kind = 'task'; payload.task = { done: false }; asTask = false; }
      replyTo = null;
      inp.value = '';
      await window.athlos.chat.send(payload);
      renderMain();
    };

    const attach = async () => {
      const files = await window.athlos.file.open({ title: 'Invia una foto', filters: [{ name: 'Immagini', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }] });
      if (!files.length) return;
      const img = await loadImage(files[0].url);
      const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const caption = await promptDialog({ title: 'Invia foto', label: 'Didascalia (facoltativa)', okLabel: 'Invia' });
      if (caption === null) return;
      send(caption, { name: files[0].name, dataUrl: c.toDataURL('image/jpeg', 0.82) });
    };

    // eventi
    on(root, 'click', '[data-mback]', () => $('#chat', root).classList.remove('m-conv'));
    on(root, 'click', '[data-ch], [data-dm]', () => $('#chat', root).classList.add('m-conv'));
    on(root, 'click', '[data-ch]', (e, t) => {
      active = t.dataset.ch;
      replyTo = null;
      renderList(); renderMain();
      if (t.dataset.jump) setTimeout(() => jump(t.dataset.jump), 50);
    });
    on(root, 'click', '[data-dm]', (e, t) => { active = dmId(t.dataset.dm); renderList(); renderMain(); });
    on(root, 'click', '[data-send]', () => send());
    on(root, 'click', '[data-quick]', (e, t) => send(t.dataset.quick));
    on(root, 'click', '[data-attach]', attach);
    on(root, 'click', '[data-astask]', () => { asTask = !asTask; renderMain(); });
    on(root, 'click', '[data-cancelreply]', () => { replyTo = null; renderMain(); });
    on(root, 'click', '[data-info]', () => { showInfo = !showInfo; renderInfo(); });
    on(root, 'click', '[data-tasks]', () => { showInfo = true; renderInfo(); });
    on(root, 'click', '[data-react]', (e, t) => window.athlos.chat.react(t.dataset.rid, t.dataset.react));
    on(root, 'change', '[data-task]', (e, t) => {
      const m = s().messages.find(x => x.id === t.dataset.task);
      window.athlos.chat.update(m.id, { task: { ...(m.task || {}), done: t.checked, doneBy: t.checked ? me().nome : '', doneAt: Date.now() } });
    });
    on(root, 'click', '[data-jump]', (e, t) => jump(t.dataset.jump));
    on(root, 'click', '[data-zoom]', (e, t) => modal({ size: 'xl', body: `<img src="${t.src}" style="width:100%;border-radius:12px">` }));
    on(root, 'click', '.txt a, .task-title a', (e, t) => { e.preventDefault(); window.athlos.system.open(t.href); });
    on(root, 'click', '[data-emoji]', (e, t) => {
      const m = popMenu(t, [], { align: 'left' });
      m.innerHTML = `<div class="emoji-pop">${EMOJI.map(x => `<button>${x}</button>`).join('')}</div>`;
      m.style.top = (t.getBoundingClientRect().top - m.offsetHeight - 8) + 'px';
      on(m, 'click', 'button', (ev, b) => { const inp = $('#inp', root); inp.value += b.textContent; inp.focus(); });
    });
    on(root, 'click', '[data-more]', (e, t) => {
      const m = s().messages.find(x => x.id === t.dataset.more);
      const mine = m.from === me().id;
      popMenu(t, [
        { label: 'Rispondi', icon: 'reply', fn: () => { replyTo = m; renderMain(); } },
        { label: m.pinned ? 'Togli dai fissati' : 'Fissa in alto', icon: m.pinned ? 'pin-off' : 'pin', fn: () => window.athlos.chat.update(m.id, { pinned: !m.pinned }) },
        { label: 'Copia testo', icon: 'copy', fn: () => { window.athlos.system.copy(m.text); toast('Copiato'); } },
        m.kind !== 'task' ? { label: 'Trasforma in compito', icon: 'square-check-big', fn: () => window.athlos.chat.send({ channel: active, text: m.text, kind: 'task', task: { done: false }, replyTo: m.id }) } : null,
        { header: 'Reazioni' },
        { label: REACTIONS.join('  '), fn: () => {} },
        mine ? '-' : null,
        mine ? { label: 'Elimina per tutti', icon: 'trash-2', danger: true, fn: async () => { if (await confirmDialog('Eliminare il messaggio per tutti?', { danger: true })) window.athlos.chat.update(m.id, { deleted: true }); } } : null,
      ].filter(Boolean));
    });
    on(root, 'click', '[data-addch]', async () => {
      const nome = await promptDialog({ title: 'Nuovo canale', label: 'Nome del canale', placeholder: 'Es. Saggio di Natale' });
      if (!nome) return;
      const c = await window.athlos.chat.addChannel({ nome, descrizione: 'Canale creato da ' + me().nome, icona: 'hash', colore: colorFor(nome) });
      active = c.id;
      renderList(); renderMain();
    });
    on(root, 'click', '[data-delch]', async (e, t) => {
      if (!(await confirmDialog('Rimuovere il canale da questo computer?', { danger: true }))) return;
      await window.athlos.chat.removeChannel(t.dataset.delch);
      active = 'generale';
      renderList(); renderMain();
    });
    $('#cs', root).addEventListener('input', e => { search = e.target.value; renderList(); });

    const jump = id => {
      const n = $(`#m-${id}`, root);
      if (!n) return;
      n.scrollIntoView({ behavior: 'smooth', block: 'center' });
      n.querySelector('.bubble-c').animate([{ boxShadow: '0 0 0 0 rgba(124,77,255,.0)' }, { boxShadow: '0 0 0 6px rgba(124,77,255,.45)' }, { boxShadow: '0 0 0 0 rgba(124,77,255,0)' }], { duration: 1400 });
    };

    // aggiornamenti dal vivo
    const unsub = onChat(evt => {
      if (!document.body.contains(root.querySelector('#chat'))) return;
      if (evt.type === 'typing') { renderTyping(); setTimeout(renderTyping, 3600); return; }
      if (evt.type === 'message' || evt.type === 'update') {
        const msg = evt.message;
        if (msg.channel === active) {
          const box = $('#msgs', root);
          const nearBottom = box && box.scrollHeight - box.scrollTop - box.clientHeight < 160;
          const inp = $('#inp', root);
          const draft = inp ? inp.value : '';
          renderMain();
          const inp2 = $('#inp', root);
          if (inp2) inp2.value = draft;
          if (!nearBottom && box) $('#msgs', root).scrollTop = box.scrollTop;
          if (evt.incoming) chatState.typing[active] = null;
        }
        renderList();
        return;
      }
      renderMe(); renderList();
      if (evt.type === 'reset' || evt.type === 'channels') renderMain();
      else renderInfo();
    });
    const onFocus = () => window.athlos.chat.read(active);
    window.addEventListener('focus', onFocus);

    if (!s().channels.find(c => c.id === active) && !active.startsWith('dm:')) active = s().channels[0].id;
    renderMe(); renderList(); renderMain();
    return () => { unsub(); window.removeEventListener('focus', onFocus); chatState.activeChannel = null; };
  },
};

function linkify(text) {
  return esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\*([^*\n]+)\*/g, '<b>$1</b>');
}

function setupProfile(root) {
  root.innerHTML = `<div style="display:grid;grid-template-columns:1.1fr 1fr;width:100%;height:100%">
    <div style="position:relative;overflow:hidden"><img src="assets/images/team.webp" style="width:100%;height:100%;object-fit:cover"><div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent 40%,var(--bg))"></div></div>
    <div style="display:flex;flex-direction:column;justify-content:center;padding:60px">
      <div class="eyebrow">Squadra</div><h1 style="font-size:36px;margin-top:6px">La chat di lavoro<br>della tua palestra</h1>
      <p class="muted" style="margin-top:12px;max-width:440px">Canali per segreteria, istruttori e gare, messaggi diretti, compiti da spuntare e conferme di lettura. Funziona tra tutti i PC con Athlos collegati alla stessa rete, senza internet e senza account.</p>
      <div class="col mt-lg" style="max-width:420px;gap:14px">
        <label class="field"><span>Come ti chiami?</span><input id="pn" placeholder="Es. Giulia"></label>
        <label class="field"><span>Ruolo</span><select id="pr">${['Segreteria', 'Presidente', 'Direttore tecnico', 'Istruttore', 'Allenatrice', 'Amministrazione', 'Staff'].map(r => `<option>${r}</option>`).join('')}</select></label>
        <button class="btn primary lg" id="go">${icon('rocket', 18)}Entra in Squadra</button>
      </div>
    </div></div>`;
  $('#go', root).onclick = async () => {
    const nome = $('#pn', root).value.trim();
    if (!nome) { toast('Scrivi il tuo nome', { type: 'warning' }); return; }
    await ensureProfile({ nome, ruolo: $('#pr', root).value });
    await startChat();
    location.hash = '/squadra?r=' + Date.now();
  };
}
