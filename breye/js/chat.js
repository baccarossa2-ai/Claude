/* Thorion — the whole app is this chat. Three 3.3 reasons, then uses real tools:
   text, code, ultra-real photos, video with audio, 3D scenes. Conversations saved locally. */
(function () {
  'use strict';
  const B = window.B;

  const CHIPS = [
    ['Code2', 'Codice', 'Scrivi un’app web completa in un solo file, elegante e animata, per '],
    ['Feather', 'Scrivi', 'Scrivimi '],
    ['Lightbulb', 'Idee', 'Dammi 7 idee originali per '],
    ['Globe', 'Cerca', 'Spiegami in modo approfondito e ragionato '],
    ['Coffee', 'Vita quotidiana', 'Aiutami con '],
    ['Sparkles', 'Creatività', 'Crea una foto ultra realistica di ']
  ];

  B.view('chat', {
    title: 'Thorion', icon: 'Aperture', group: 'ai', desc: 'Parla con Thorion',
    mount(el) {
      let chats = [], cur = null, ctl = null;
      let attachments = []; // {kind:'image'|'text', name, blob?, text?}
      el.classList.add('chat-view', 'solo-chat');
      const side = B.h('aside', { class: 'chat-side' });
      const main = B.h('div', { class: 'chat-main' });
      el.append(side, main);

      /* ---- sidebar: conversations ---- */
      const sideHead = B.h('div', { class: 'cs-head' }, B.h('span', { class: 'cs-logo' }), B.h('b', { text: 'Thorion' }), B.h('button', { class: 'btn icon ghost sm cs-x', type: 'button', 'aria-label': 'Chiudi', 'data-i': 'X', onclick: () => el.classList.remove('side-open') }));
      const newBtn = B.h('button', { class: 'btn gold block', type: 'button', onclick: () => newChat() }, B.h('span', { 'data-i': 'MessageCirclePlus' }), 'Nuova chat');
      const search = B.h('input', { class: 'input sm', id: 'chatSearch', placeholder: 'Cerca nelle chat' });
      const list = B.h('div', { class: 'chat-list scroll' });
      const acct = B.h('button', { class: 'cs-acct', type: 'button', onclick: () => B.account && B.account.open() });
      const paintAcct = () => {
        const u = B.account && B.account.signedIn && B.account.user;
        acct.replaceChildren(u ? B.h('span', { class: 'acct-av', text: u.name.slice(0, 1).toUpperCase() }) : B.h('span', { class: 'acct-av g', html: '<svg viewBox="0 0 48 48" width="16" height="16"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>' }),
          B.h('span', { class: 'acct-tx' }, B.h('b', { text: u ? u.name.replace(/#\d+$/, '') : 'Accedi con Google' }), B.h('small', { text: u ? ({ sync: 'Sincronizzo le chat…', ok: 'Chat nel cloud · priorità attiva', offline: 'Offline: chat sul dispositivo' }[B.cloud && B.cloud.status] || 'Priorità attiva · ' + u.kudos + ' kudos') : 'Chat nel cloud e immagini più veloci' })));
      };
      paintAcct(); B.on('account', paintAcct); B.on('cloud', paintAcct);
      // chats synced from another device: refresh the list, and the open chat if it changed there and is idle here
      B.on('cloud:pulled', async () => { const fresh = (await B.db.all('chats')).sort((a, b) => b.updated - a.updated); const same = cur && fresh.find((c) => c.id === cur.id); chats = fresh; if (cur && !same && cur.messages.length) chats.unshift(cur); if (same && !ctl && (same.updated || 0) > (cur.updated || 0)) { cur = same; renderThread(true); } else if (same) chats[chats.indexOf(same)] = cur; renderList(); });
      side.append(sideHead, newBtn, search, list, acct, B.h('div', { class: 'cs-foot', html: 'Powered by <b>Thorion Three&nbsp;3.3</b> ✦' }));
      search.addEventListener('input', renderList);
      logoInto(sideHead.querySelector('.cs-logo'), 22);

      /* ---- top bar ---- */
      const toggleSide = B.h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Conversazioni', 'data-i': 'Menu', onclick: () => el.classList.toggle('side-open') });
      const brand = B.h('div', { class: 'chat-brand' }, B.h('span', { class: 'cb-logo' }), B.h('b', { text: 'Thorion' }));
      logoInto(brand.querySelector('.cb-logo'), 26);
      const newTop = B.h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Nuova chat', 'data-i': 'Plus', onclick: () => newChat() });
      const moreBtn = B.h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Altre azioni', 'data-i': 'MoreHorizontal', onclick: (e) => B.menu(e.currentTarget, [
        { label: 'Rinomina', icon: 'Pencil', fn: rename },
        { label: 'Esporta in Markdown', icon: 'Download', fn: exportMd },
        { label: 'Copia tutta la chat', icon: 'Copy', fn: () => cur && B.copy(cur.messages.map((m) => (m.role === 'user' ? 'Tu: ' : 'Thorion: ') + m.content).join('\n\n')) },
        { label: 'Voce di lettura…', icon: 'Volume2', fn: () => B.voicePicker && B.voicePicker() },
        { label: 'Account e priorità…', icon: 'User', fn: () => B.account && B.account.open() },
        { label: 'Esporta tutte le chat', icon: 'Download', fn: exportAll },
        { label: 'Ripristina chat da file', icon: 'Upload', fn: importAll },
        '-', { label: 'Tema chiaro / scuro', icon: 'Moon', fn: () => B.theme.toggle() },
        { label: 'Elimina chat', icon: 'Trash2', fn: () => cur && delChat(cur) }
      ], { align: 'right' }) });
      const head = B.h('div', { class: 'bar chat-head' }, toggleSide, B.h('div', { class: 'bar-sp' }), brand, B.h('div', { class: 'bar-sp' }), newTop, moreBtn);

      /* ---- messages ---- */
      const scroller = B.h('div', { class: 'chat-scroll scroll' });
      const thread = B.h('div', { class: 'chat-thread' });
      scroller.append(thread);
      // only the thread scrolls; it follows new content while the reader is at the bottom
      let near = true;
      const toBottom = (smooth) => scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      const downBtn = B.h('button', { class: 'to-bottom', type: 'button', 'aria-label': 'Vai all’ultimo messaggio', 'data-i': 'ArrowDown', hidden: true, onclick: () => { near = true; toBottom(true); } });
      scroller.addEventListener('scroll', () => { near = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120; downBtn.hidden = near; }, { passive: true });
      if (window.ResizeObserver) new ResizeObserver(() => { if (near) toBottom(); }).observe(thread);

      /* ---- composer ---- */
      const ta = B.h('textarea', { id: 'chatInput', rows: 1, placeholder: 'Scrivi un messaggio…' });
      const attBar = B.h('div', { class: 'att-bar' });
      const sendBtn = B.h('button', { class: 'btn gold icon', type: 'button', 'aria-label': 'Invia', 'data-i': 'ArrowRight', onclick: () => send() });
      const stopBtn = B.h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Ferma', 'data-i': 'StopCircle', hidden: true, onclick: () => ctl && ctl.abort() });
      const attachBtn = B.h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Allega file', 'data-tip': 'Allega immagini, testi, codice o PDF', 'data-i': 'Paperclip', onclick: async () => addFiles(await B.pickFiles('image/*,.txt,.md,.csv,.json,.js,.ts,.py,.html,.css,.pdf', true)) });
      const plusBtn = B.h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Nuova chat', 'data-i': 'Plus', onclick: () => newChat() });
      const focusPill = B.h('button', { class: 'focus-pill', type: 'button', 'data-tip': 'Thorion ragiona sempre al massimo prima di rispondere', onclick: (e) => e.preventDefault() }, B.h('span', { 'data-i': 'Star' }), B.h('span', { class: 'fp-tx', text: 'Three 3.3 · Focus' }));
      const composer = B.h('div', { class: 'composer' }, attBar, ta, B.h('div', { class: 'composer-row' }, plusBtn, attachBtn, B.h('div', { class: 'bar-sp' }), focusPill, stopBtn, sendBtn));
      const composerWrap = B.h('div', { class: 'composer-wrap' }, downBtn, composer, B.h('div', { class: 'composer-note', text: 'Thorion può sbagliare: verifica le informazioni importanti.' }));
      main.append(head, scroller, composerWrap);
      B.dropzone(composer, addFiles);
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
      ta.addEventListener('input', grow);
      ta.addEventListener('paste', (e) => { const fs = Array.from(e.clipboardData.files || []); if (fs.length) { e.preventDefault(); addFiles(fs); } });
      function grow() { ta.style.height = 'auto'; ta.style.height = Math.min(220, ta.scrollHeight) + 'px'; }

      async function addFiles(files) {
        for (const f of files) {
          if (f.type.startsWith('image/')) attachments.push({ kind: 'image', name: f.name, blob: f });
          else if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
            try { const txt = await B.pdfText(f); attachments.push({ kind: 'text', name: f.name, text: txt.slice(0, 120000) }); } catch (e) { B.toast('Non riesco a leggere il PDF ' + f.name, 'err'); }
          } else { try { attachments.push({ kind: 'text', name: f.name, text: (await f.text()).slice(0, 120000) }); } catch (e) { /* ignore */ } }
        }
        paintAtt();
      }
      function paintAtt() {
        attBar.innerHTML = '';
        attachments.forEach((a, i) => {
          const chip = B.h('div', { class: 'att' }, a.kind === 'image' ? B.h('img', { src: URL.createObjectURL(a.blob), alt: '' }) : B.h('span', { 'data-i': 'FileText' }), B.h('span', { class: 'att-n', text: a.name }), B.h('button', { type: 'button', 'aria-label': 'Rimuovi', 'data-i': 'X', onclick: () => { attachments.splice(i, 1); paintAtt(); } }));
          attBar.append(chip);
        });
        attBar.hidden = !attachments.length; B.hydrateIcons(attBar);
      }

      /* ---- data ---- */
      async function load() {
        chats = (await B.db.all('chats')).sort((a, b) => b.updated - a.updated);
        renderList();
        if (!cur) { if (chats[0] && !chats[0].messages.length) open(chats[0]); else newChat(true); }
      }
      const holdSwitch = () => { if (!ctl) return false; B.toast('Thorion sta ancora lavorando: attendi o premi Ferma'); return true; };
      function newChat(silent) {
        if (holdSwitch()) return;
        if (cur && !cur.messages.length) { open(cur); ta.focus(); return; }
        cur = { id: B.uid('c'), title: 'Nuova chat', messages: [], updated: Date.now() };
        chats.unshift(cur); renderList(); renderThread(true); if (!silent) ta.focus();
      }
      const SKIP = new Set(['blob', '_store', 'preview']);
      async function persist() { if (!cur) return; cur.updated = Date.now(); if (cur.messages.length) { const snap = JSON.parse(JSON.stringify(cur, (k, v) => (SKIP.has(k) ? undefined : v))); await B.db.put('chats', snap); B.cloud && B.cloud.push(snap); } renderList(); }
      function open(c) { if (c !== cur && holdSwitch()) return; cur = c; el.classList.remove('side-open'); renderList(); renderThread(true); }
      const dropVideos = (msgs) => msgs.forEach((m) => (m.media || []).forEach((x) => { if (x.key) { B.db.del('blobs', x.key).catch(() => {}); vidCache.delete(x.key); } }));
      async function delChat(c) { if (c === cur && holdSwitch()) return; if (!(await B.confirm('Eliminare questa chat?', '“' + c.title + '” verrà eliminata.', 'Elimina', true))) return; dropVideos(c.messages); await B.db.del('chats', c.id); B.cloud && B.cloud.remove(c.id); chats = chats.filter((x) => x !== c); if (c === cur) { cur = null; if (chats[0]) open(chats[0]); else newChat(); } else renderList(); }
      async function rename() { if (!cur) return; const n = await B.prompt('Rinomina chat', cur.title); if (n) { cur.title = n; persist(); } }
      function renderList() {
        const q = search.value.trim().toLowerCase();
        list.innerHTML = '';
        const groups = {};
        chats.filter((c) => c.messages.length || c === cur).filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q))).forEach((c) => {
          const d = (Date.now() - c.updated) / 86400000; const g = d < 1 ? 'Oggi' : d < 7 ? 'Questa settimana' : 'Prima';
          (groups[g] = groups[g] || []).push(c);
        });
        ['Oggi', 'Questa settimana', 'Prima'].forEach((g) => {
          if (!groups[g]) return;
          list.append(B.h('div', { class: 'cl-g', text: g.toUpperCase() }));
          groups[g].forEach((c) => list.append(B.h('button', { type: 'button', class: 'cl-item' + (c === cur ? ' on' : ''), onclick: () => open(c) }, B.h('span', { 'data-i': 'MessageSquare' }), B.h('span', { class: 'cl-t', text: c.title }))));
        });
        B.hydrateIcons(list);
      }
      function renderThread(force) {
        if (force) near = true;
        thread.innerHTML = '';
        el.classList.toggle('is-empty', !cur || !cur.messages.length);
        if (!cur || !cur.messages.length) { thread.append(emptyState()); B.hydrateIcons(thread); return; }
        cur.messages.forEach((m, i) => thread.append(bubble(m, i)));
        B.hydrateIcons(thread);
        if (near) toBottom();
      }
      function emptyState() {
        const wrap = B.h('div', { class: 'chat-empty' });
        const logo = B.h('div', { class: 'ce-logo' }); logoInto(logo, 88);
        const g = B.h('div', { class: 'ce-chips' });
        CHIPS.forEach(([ic, t, starter]) => g.append(B.h('button', { type: 'button', class: 'ce-chip', onclick: () => { ta.value = starter; grow(); ta.focus(); } }, B.h('span', { 'data-i': ic }), t)));
        wrap.append(logo, B.h('h1', { class: 'ce-title serif', text: 'Cosa hai in mente oggi?' }), B.h('p', { class: 'ce-sub', text: 'Sono qui per aiutarti. Fai una domanda, scrivi, crea immagini, video, modelli 3D e codice.' }), g);
        return wrap;
      }
      function bubble(m, i) {
        const isUser = m.role === 'user';
        const b = B.h('div', { class: 'msg ' + (isUser ? 'me' : 'ai') + (m.error ? ' error' : '') });
        const body = B.h('div', { class: 'msg-body' });
        if (m.images && m.images.length) body.append(B.h('div', { class: 'msg-imgs' }, m.images.map((src) => B.h('img', { src, alt: 'Immagine allegata' }))));
        if (m.files && m.files.length) body.append(B.h('div', { class: 'msg-files' }, m.files.map((n) => B.h('span', { class: 'chip' }, B.h('span', { 'data-i': 'FileText' }), n))));
        const content = B.h('div', { class: 'msg-content md' });
        if (isUser) content.textContent = m.content; else if (m.pending) renderMd(content, m.content); else mdNow(content, m.content);
        body.append(content);
        if (m.steps && m.steps.length) body.append(stepsBlock(m));
        if (m.media && m.media.length) body.append(mediaBlock(m));
        if (m.gen) body.append(genBlock(m.gen));
        if (!isUser && !m.pending) body.append(actions(m, i));
        b.append(body);
        return b;
      }
      function stepsBlock(m) {
        const box = B.h('ol', { class: 'agent-steps' + (m.pending ? ' live' : '') });
        m.steps.forEach((s) => box.append(B.h('li', { class: 'as-' + s.status }, B.h('span', { class: 'as-dot' }), B.h('span', { class: 'as-l', text: s.label }), s.detail ? B.h('small', { text: s.detail }) : null, s.preview ? B.h('img', { src: s.preview, alt: '' }) : null)));
        return box;
      }
      function mediaBlock(m) {
        const box = B.h('div', { class: 'agent-media' });
        const finals = m.media.filter((x) => !x.draft), drafts = m.media.filter((x) => x.draft && x.type === 'image');
        finals.forEach((x) => {
          if (x.type === 'video') {
            const v = B.h('video', { controls: true, playsinline: true, loop: true, preload: 'metadata' });
            const card = B.h('div', { class: 'gen-img vid' }, v, B.h('div', { class: 'gen-acts' },
              B.h('button', { class: 'btn sm', type: 'button', onclick: async () => { const b = await mediaBlobOf(x); if (b) B.save(b, 'thorion-video.' + (x.ext || 'mp4')); } }, B.h('span', { 'data-i': 'Download' }), 'Scarica video')));
            mediaBlobOf(x).then((b) => { if (b) v.src = URL.createObjectURL(b); else card.replaceChildren(B.h('div', { class: 'muted', text: 'Video non più disponibile in questa sessione.' })); });
            box.append(card);
          } else if (x.type === 'scene') {
            const frame = B.h('iframe', { class: 'gen-3d', loading: 'lazy', sandbox: 'allow-scripts allow-pointer-lock', title: x.label || 'Scena 3D' });
            const card = B.h('div', { class: 'gen-img d3' }, frame, B.h('div', { class: 'gen-acts' },
              B.h('button', { class: 'btn sm', type: 'button', onclick: async () => { const b = await mediaBlobOf(x); if (b) B.save(b, B.slug(x.label || 'thorion-3d') + '.html'); } }, B.h('span', { 'data-i': 'Download' }), 'Scarica (HTML)'),
              B.h('button', { class: 'btn sm', type: 'button', onclick: async () => { const b = await mediaBlobOf(x); if (b) window.open(URL.createObjectURL(b), '_blank'); } }, B.h('span', { 'data-i': 'Maximize2' }), 'A tutto schermo')));
            mediaBlobOf(x).then(async (b) => { if (b) frame.srcdoc = await b.text(); else card.replaceChildren(B.h('div', { class: 'muted', text: 'Scena non più disponibile in questa sessione.' })); });
            box.append(card);
          } else box.append(genBlock({ status: 'done', src: x.src, prompt: x.label || 'Immagine di Thorion' }));
        });
        if (drafts.length) box.append(B.h('details', { class: 'agent-drafts' }, B.h('summary', { text: 'Passaggi intermedi (' + drafts.length + ')' }), B.h('div', { class: 'ad-row' }, drafts.map((d) => B.h('img', { src: d.src, alt: d.label || '', title: d.label || '', onclick: () => lightImg(d.src) })))));
        return box;
      }
      const vidCache = new Map();
      async function mediaBlobOf(x) { if (vidCache.has(x.key)) return vidCache.get(x.key); try { const r = await B.db.get('blobs', x.key); if (r && r.blob) { vidCache.set(x.key, r.blob); return r.blob; } } catch (e) { /* gone */ } return null; }
      function lightImg(src) { B.modal({ title: '', body: B.h('div', { class: 'lightbox' }, B.h('img', { src, alt: '' })), xwide: true, actions: [{ label: 'Scarica', kind: 'gold', icon: 'Download', fn: () => B.save(B.dataURLToBlob(src), 'thorion.png') }] }); }
      function genBlock(g) {
        const box = B.h('div', { class: 'gen-img' });
        if (g.status === 'loading') { box.append(B.h('div', { class: 'gen-load' }, B.h('div', { class: 'iris-spin' }), B.h('span', { text: g.label || 'Thorion sta creando…' }))); return box; }
        if (g.status === 'error') { box.append(B.h('div', { class: 'muted', text: g.error })); if (g.link) box.append(B.h('a', { class: 'btn sm gold', href: g.link, target: '_blank', rel: 'noopener' }, B.h('span', { 'data-i': 'ExternalLink' }), 'Apri Thorion sul web')); return box; }
        const img = B.h('img', { src: g.src, alt: g.prompt, onclick: () => lightImg(g.src) });
        box.append(img, B.h('div', { class: 'gen-acts' },
          B.h('button', { class: 'btn sm', type: 'button', onclick: () => B.save(B.dataURLToBlob(g.src), B.slug(g.prompt) + '.png') }, B.h('span', { 'data-i': 'Download' }), 'Scarica')));
        return box;
      }
      const mdNow = async (node, text) => { node.innerHTML = await B.md(text || ''); B.enhanceCode(node, codeExtras); B.hydrateIcons(node); };
      const mdLive = new WeakMap();
      const renderMd = (node, text) => { let f = mdLive.get(node); if (!f) mdLive.set(node, (f = B.throttle(mdNow, 90))); f(node, text); };
      function codeExtras(acts, code, lang) {
        if (/^(html|xml|svg)$/i.test(lang) || (/<!doctype|<html|<svg/i.test(code) && /<\/(body|html|svg)>/i.test(code))) {
          acts.append(B.h('button', { class: 'btn ghost sm', type: 'button', onclick: () => runCode(code) }, B.h('span', { 'data-i': 'Play' }), 'Anteprima'));
        }
      }
      function runCode(code) {
        const frame = B.h('iframe', { class: 'run-frame', sandbox: 'allow-scripts allow-pointer-lock allow-forms allow-modals', srcdoc: code });
        B.modal({ title: 'Anteprima', body: B.h('div', { class: 'run-wrap' }, frame), xwide: true, actions: [{ label: 'Scarica HTML', icon: 'Download', fn: () => { B.save(new Blob([code], { type: 'text/html' }), 'thorion-app.html'); return false; } }, { label: 'Apri in una scheda', kind: 'gold', icon: 'ExternalLink', fn: () => { window.open(URL.createObjectURL(new Blob([code], { type: 'text/html' })), '_blank'); } }] });
      }
      function actions(m, i) {
        const a = B.h('div', { class: 'msg-acts' });
        a.append(B.h('button', { class: 'btn ghost sm icon', type: 'button', 'data-tip': 'Copia', 'aria-label': 'Copia', 'data-i': 'Copy', onclick: () => B.copy(m.content) }));
        a.append(B.h('button', { class: 'btn ghost sm icon', type: 'button', 'data-tip': 'Leggi ad alta voce (premi di nuovo per fermare)', 'aria-label': 'Leggi', 'data-i': 'Volume2', onclick: (e) => speak(m.content, e.currentTarget) }));
        if (i === cur.messages.length - 1) a.append(B.h('button', { class: 'btn ghost sm icon', type: 'button', 'data-tip': 'Rigenera', 'aria-label': 'Rigenera', 'data-i': 'RefreshCw', onclick: regenerate }));
        return a;
      }
      let reading = null;
      function speak(text, btn) {
        const again = reading === btn && B.voice.speaking();
        B.voice.stop(); if (reading) reading.classList.remove('on'); reading = null;
        if (again) return;
        reading = btn; if (btn) btn.classList.add('on');
        B.voice.speak(text).catch((e) => B.err(e, 'Non riesco a leggere ad alta voce')).finally(() => { if (reading === btn) { if (btn) btn.classList.remove('on'); reading = null; } });
      }

      /* ---- sending ---- */
      async function send(textArg) {
        if (ctl) return;
        let text = (textArg ?? ta.value).trim();
        if (!text && !attachments.length) return;
        if (!cur) newChat(true);
        ta.value = ''; grow();
        const imgCmd = text.match(/^\/(immagine|img|image|disegna)\s+([\s\S]+)/i);
        const atts = attachments; attachments = []; paintAtt();
        const userMsg = { role: 'user', content: text || '(allegati)', images: [], files: [] };
        for (const a of atts) { if (a.kind === 'image') userMsg.images.push(await B.blobToDataURL(a.blob)); else userMsg.files.push(a.name); }
        userMsg._atts = atts;
        cur.messages.push(userMsg);
        if (cur.messages.length === 1) cur.title = (imgCmd ? '🖼 ' + imgCmd[2] : text).slice(0, 48) || 'Chat';
        renderThread(true);
        if (imgCmd) return genImage(imgCmd[2]);
        await answer();
      }
      function repaintLast() {
        const i = cur.messages.length - 1, node = thread.lastElementChild;
        if (!node || i < 0) return renderThread();
        const nb = bubble(cur.messages[i], i); node.replaceWith(nb); B.hydrateIcons(nb); stick();
      }
      const stepper = (msg) => (s) => {
        msg.steps = msg.steps || [];
        const last = [...msg.steps].reverse().find((x) => x.id ? x.id === s.id : x.status === 'run');
        const prev = s.preview ? URL.createObjectURL(s.preview) : null;
        if (s.status === 'run' && (!last || last.status !== 'run' || (s.id && last.id !== s.id))) msg.steps.push({ id: s.id, label: s.label, status: 'run', detail: s.detail });
        else if (last) Object.assign(last, { label: s.label, status: s.status, detail: s.detail || (s.status === 'run' ? last.detail : ''), preview: prev || last.preview });
        repaintLast();
      };
      async function genImage(prompt) {
        await B.ai.init();
        const engine = B.ai.photoEngine(false) || 'vector';
        const msg = { role: 'assistant', content: 'Ecco l’immagine per: *' + prompt + '*', pending: true, steps: [] };
        if (engine === 'vector') msg.gen = { status: 'loading', prompt, label: 'Thorion disegna in vettoriale…' };
        cur.messages.push(msg); renderThread(); busy(true);
        ctl = new AbortController();
        try {
          const r = await B.ai.image(prompt, { engine, w: 1024, h: 1024, style: 'photo', signal: ctl.signal, onStep: stepper(msg) });
          const src = await B.blobToDataURL(r.blob);
          msg.gen = { status: 'done', src, prompt };
          if (r.engine === 'vector') msg.content += '\n\n_Disegnata in vettoriale. Le foto ultra realistiche sono nella [versione web di Thorion](' + B.PUBLIC_URL + '?p=' + encodeURIComponent(prompt) + ') (illimitata)._';
          else msg.content += '\n\n_Scatto ' + r.w + '×' + r.h + ' · ' + (r.model || 'Thorion') + ' · rifinito e finito in pellicola._';
          B.gallery && B.gallery.add({ blob: r.blob, prompt, engine: r.engine, kind: 'raster', w: r.w || 1024, h: r.h || 1024, svg: r.svg });
        } catch (e) { msg.gen = { status: 'error', error: B.ai.errorText(e), link: !B.ai.engines.horde ? B.PUBLIC_URL + '?p=' + encodeURIComponent(prompt) : null }; if (e.code !== 'cancelled') msg.error = true; }
        (msg.steps || []).forEach((s) => { if (s.status === 'run') s.status = msg.error || (msg.gen && msg.gen.status === 'error') ? 'err' : 'done'; });
        delete msg.pending; ctl = null; busy(false); renderThread(); persist();
      }

      /* Thorion reasons first, then picks the right tools (photo, video, 3D, vector, edits). */
      const PLAIN = /^\s*(ciao|salve|buongiorno|buonasera|hey|ehi|grazie|ok|okay|va bene|perfetto|👍|🙏|come stai|come va|chi sei|come ti chiami)[\s!?.…]*$/i;
      const CREATIVE = /\b(foto|fotograf|immagin|ritratt|scatt|logo|icon[ae]|poster|locandin|illustr|disegn|dipin|wallpaper|sfond|copertin|banner|mockup|render|video|reel|clip|anim|scontorn|ingrand|ritocc|rifinis|pellicol|3d|modell|scena|gioco|game|three\.?js|webgl|picture|photo|image|draw|paint|selfie|paesagg|tramonto|app|sito|landing|pagina web|html)\w*/i;
      function wantsAgent(text, atts) {
        if (!B.ai.canUseTools()) return false;
        if (PLAIN.test(text) && !atts.length) return false;
        return CREATIVE.test(text) || (atts.some((a) => a.kind === 'image') && /\b(rend[ia]|trasform|cambia|modific|aggiung|togli|rimuov|miglior|sistem|fai|anima|descrivi)\w*/i.test(text));
      }
      async function agentAnswer(history, atts, system) {
        const pend = { role: 'assistant', content: '', pending: true, steps: [], media: [] };
        cur.messages.push(pend); renderThread();
        const node0 = B.$('.msg:last-child .msg-content', thread); if (node0) node0.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
        busy(true); ctl = new AbortController();
        try {
          const store = cur._store instanceof Map ? cur._store : (cur._store = new Map());
          const note = [];
          for (const a of atts) {
            if (a.kind !== 'image' || !a.blob) continue;
            try { const im = await B.loadImage(a.blob); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); const id = 'img' + (store.size + 1); store.set(id, { blob: a.blob, canvas: c, label: a.name }); note.push(id + ' (allegato “' + a.name + '”)'); }
            catch (e) { B.toast('Non riesco ad aprire ' + a.name + ': usa JPG, PNG o WebP'); }
          }
          const known = [...store.entries()].filter(([id]) => !note.some((n) => n.startsWith(id + ' '))).slice(-6).map(([id, v]) => id + ' (' + String(v.label || '').slice(0, 50) + ')');
          const ctx = {
            images: store,
            onImage: async (id, blob, label) => { pend.media.push({ id, type: 'image', src: await B.blobToDataURL(blob), label }); repaintLast(); },
            onVideo: async (id, blob, story) => { const key = B.uid('v'); try { await B.db.put('blobs', { id: key, blob }); } catch (e) { /* memory only */ } vidCache.set(key, blob); pend.media.push({ id, type: 'video', key, ext: /webm/.test(blob.type) ? 'webm' : 'mp4', w: story.w, h: story.h }); repaintLast(); },
            onScene: async (id, blob, label) => { const key = B.uid('s'); try { await B.db.put('blobs', { id: key, blob }); } catch (e) { /* memory only */ } vidCache.set(key, blob); pend.media.push({ id, type: 'scene', key, label }); repaintLast(); },
            onStep: stepper(pend)
          };
          const madeBy = {};
          const tools = B.irisTools(ctx).map((t) => Object.assign({}, t, { execute: async (a) => {
            try {
              const r = await t.execute(a, { signal: ctl.signal });
              if (r && r.image_id) madeBy[r.image_id] = t.name;
              if (/^(refine_detail|finish_photo|upscale_photo)$/.test(t.name) && a.image_id) { const md = pend.media.find((x) => x.id === a.image_id); if (md) md.draft = true; }
              return r;
            }
            catch (e) { const s = [...pend.steps].reverse().find((x) => x.status === 'run'); if (s) { s.status = 'err'; s.detail = B.ai.errorText(e); repaintLast(); } throw e; }
          } }));
          const msgs = history.map((m) => ({ role: m.role, content: m.content || ' ' }));
          const extra = (note.length ? '\n\n[Immagini allegate disponibili per gli strumenti: ' + note.join(', ') + ']' : '') + (known.length ? '\n[Immagini già create in questa chat: ' + known.join(', ') + ']' : '');
          msgs[msgs.length - 1].content += extra;
          const sys = system + '\n\n' + B.agentSystem + (B.ai.engines.horde ? '' : '\nIn questa versione (dentro un Artifact) le foto, i video e i modelli 3D ultra realistici non sono raggiungibili: per le immagini usa create_vector e ricorda in una frase che la versione completa, con foto e video reali illimitati, è sul web: ' + B.PUBLIC_URL);
          const text = await B.ai.toolChat(msgs, { system: sys, tools, signal: ctl.signal, tier: 'complex', images: B.ai.canSee() ? atts.filter((a) => a.kind === 'image').map((a) => a.blob) : null, onText: ({ text: t }) => { pend.content = t; const n = B.$('.msg:last-child .msg-content', thread); if (n) renderMd(n, t); stick(); } });
          pend.content = text || (pend.media.length ? 'Fatto.' : '');
          // the realism pipeline always ends with the film finish, even if a smaller model forgets the last step
          const last = [...pend.media].reverse().find((x) => x.type === 'image' && !x.draft);
          const fin = tools.find((t) => t.name === 'finish_photo');
          if (last && fin && /^(generate_photo|refine_detail|edit_photo|upscale_photo)$/.test(madeBy[last.id] || '') && !ctl.signal.aborted) {
            const u = (history[history.length - 1] || {}).content || '';
            const look = /portra/i.test(u) ? 'portra' : /cinestill/i.test(u) ? 'cinestill' : /noir|bianco e nero|b\/n/i.test(u) ? 'noir' : /cinema|film|cinematic/i.test(u) ? 'cinema' : /oro|golden|tramonto|sunset/i.test(u) ? 'gold' : /nitid|crisp/i.test(u) ? 'crisp' : 'natural';
            try { await fin.execute({ image_id: last.id, look }); } catch (e) { /* keep the unfinished photo */ }
          }
        } catch (e) {
          if (e.code === 'cancelled') pend.content = (pend.content || '') + '\n\n_— interrotto_';
          else { pend.content = (pend.content || '') + (pend.content ? '\n\n' : '') + '⚠️ ' + (e.userMessage || 'Errore'); pend.error = !pend.media.length; }
        }
        pend.steps.forEach((s) => { if (s.status === 'run') s.status = ctl && ctl.signal.aborted ? 'err' : 'done'; });
        const finals = pend.media.filter((x) => x.type === 'image' && !x.draft);
        for (const f of finals) { try { B.gallery && B.gallery.add({ blob: B.dataURLToBlob(f.src), prompt: f.label || 'Thorion', engine: 'iris', kind: 'raster', w: 0, h: 0 }); } catch (e) { /* ignore */ } }
        delete pend.pending; ctl = null; busy(false);
        renderThread(); persist();
        if (cur.messages.length === 2 && B.ai.textEngine()) autoTitle();
      }
      // guaranteed-correct answers for the two things everyone tests first: who it is, and exact arithmetic
      function quickReply(text) {
        const t = String(text || '').trim();
        if (/^(chi\s*(sei|6)|come\s+ti\s+chiami|qual['’ ]?\s*è\s+il\s+tuo\s+nome|che\s+modello\s+sei|chi\s+ti\s+ha\s+(creato|fatto|sviluppato)|presentati|chi\s+c'?è)\b[\s?!.]*$/i.test(t))
          return 'Sono **Thorion Three 3.3**, il modello di frontiera di Thorion. Ragiono a fondo prima di rispondere e posso creare testo, codice, foto e video ultra realistici, scene e giochi 3D. Come posso aiutarti?';
        let e = t.replace(/^(quanto\s+(fa|è|vale|fanno)|calcola(mi)?|risultato\s+di|quant['’]?\s*è)\s*/i, '').replace(/[?!.\s]+$/, '').trim();
        e = e.replace(/\b(moltiplicato\s+per|moltiplicato|per|volte)\b/gi, '*').replace(/\bpi[ùu](?![a-zàèéìòù])/gi, '+').replace(/\bmeno\b/gi, '-').replace(/\bdiviso(\s+per)?\b/gi, '/');
        if (e && /^[-+*/()^%.,\d\sxX×÷·]+$/.test(e) && /\d/.test(e) && /[-+*/^×÷x·]/i.test(e)) {
          const ex = e.replace(/[×x·]/gi, '*').replace(/÷/g, '/').replace(/\^/g, '**').replace(/,(\d)/g, '.$1');
          try { const r = Function('"use strict";return(' + ex + ')')(); if (typeof r === 'number' && isFinite(r)) { const out = Number.isInteger(r) ? r : Math.round(r * 1e10) / 1e10; return '**' + out + '**'; } } catch (err) { /* not math */ }
        }
        return null;
      }
      async function answer() {
        const history = cur.messages.slice(-24);
        const lastUser = history[history.length - 1];
        const today = new Date().toLocaleDateString('it-IT', { dateStyle: 'full' });
        const system = B.ai.persona + '\nData di oggi: ' + today + '.';
        const quick = quickReply(lastUser.content || '');
        if (quick && !(lastUser._atts || []).length) {
          cur.messages.push({ role: 'assistant', content: quick });
          renderThread(); persist();
          if (cur.messages.length === 2 && B.ai.textEngine()) autoTitle();
          return;
        }
        if (wantsAgent(lastUser.content || '', lastUser._atts || [])) {
          let fileText2 = '';
          (lastUser._atts || []).forEach((a) => { if (a.kind !== 'image') fileText2 += '\n\n[File allegato: ' + a.name + ']\n' + a.text; });
          const h2 = history.map((m, idx) => ({ role: m.role, content: (m.content || ' ') + (idx === history.length - 1 ? fileText2 : '') }));
          return agentAnswer(h2, lastUser._atts || [], system);
        }
        const pend = { role: 'assistant', content: '', pending: true };
        cur.messages.push(pend);
        renderThread();
        const node = B.$('.msg:last-child .msg-content', thread);
        node.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
        busy(true);
        ctl = new AbortController();
        const images = [];
        let fileText = '';
        (lastUser._atts || []).forEach((a) => { if (a.kind === 'image') images.push(a.blob); else fileText += '\n\n[File allegato: ' + a.name + ']\n' + a.text; });
        const msgs = history.map((m, idx) => ({ role: m.role, content: (m.content || ' ') + (idx === history.length - 1 ? fileText : '') }));
        try {
          if (images.length && !B.ai.canSee()) B.toast('Questo motore non può vedere le immagini: invio solo il testo');
          const text = await B.ai.text(msgs, { system, tier: 'complex', signal: ctl.signal, images: B.ai.canSee() ? images : null, onText: ({ text: t }) => { pend.content = t; renderMd(node, t); stick(); } });
          pend.content = text;
        } catch (e) {
          if (e.code === 'cancelled') pend.content = (pend.content || '') + '\n\n_— interrotto_';
          else { pend.content = (e.partial || pend.content || '') + (pend.content ? '\n\n' : '') + '⚠️ ' + (e.userMessage || 'Errore'); pend.error = true; }
        }
        delete pend.pending; ctl = null; busy(false);
        renderThread(); persist();
        if (cur.messages.length === 2 && B.ai.textEngine()) autoTitle();
      }
      async function autoTitle() {
        try {
          const t = await B.ai.text('Dai un titolo di massimo 5 parole, senza virgolette, a questa conversazione:\n' + cur.messages[0].content.slice(0, 600), { system: false, tier: 'quick', cache: true });
          cur.title = t.replace(/["“”.]/g, '').trim().slice(0, 48) || cur.title; persist();
        } catch (e) { /* ignore */ }
      }
      function stick() { if (near) toBottom(); }
      function busy(on) { sendBtn.hidden = on; stopBtn.hidden = !on; ta.classList.toggle('busy', on); }
      async function regenerate() {
        if (ctl || !cur) return;
        while (cur.messages.length && cur.messages[cur.messages.length - 1].role === 'assistant') dropVideos([cur.messages.pop()]);
        const last = cur.messages[cur.messages.length - 1];
        const cmd = last && last.content.match(/^\/(immagine|img|image|disegna)\s+([\s\S]+)/i);
        renderThread();
        if (cmd) genImage(cmd[2]); else answer();
      }
      async function exportAll() {
        const all = (await B.db.all('chats')).filter((c) => c.messages && c.messages.length);
        if (!all.length) return B.toast('Non ci sono ancora chat da esportare');
        B.save(new Blob([JSON.stringify({ app: 'thorion', version: 1, exported: new Date().toISOString(), chats: all })], { type: 'application/json' }), 'thorion-chat-' + new Date().toISOString().slice(0, 10) + '.json');
      }
      async function importAll() {
        const [f] = await B.pickFiles('.json,application/json'); if (!f) return;
        let data; try { data = JSON.parse(await f.text()); } catch (e) { return B.toast('Il file non è un backup di Thorion', 'err'); }
        const list2 = Array.isArray(data) ? data : data && data.chats; if (!Array.isArray(list2)) return B.toast('Il file non è un backup di Thorion', 'err');
        let n = 0;
        for (const c of list2) { if (!c || !c.id || !Array.isArray(c.messages)) continue; const old = chats.find((x) => x.id === c.id); if (old && old.updated >= c.updated) continue; await B.db.put('chats', c); n++; }
        chats = (await B.db.all('chats')).sort((a, b) => b.updated - a.updated); renderList();
        B.toast(n ? n + (n === 1 ? ' chat ripristinata' : ' chat ripristinate') : 'Le chat del file sono già presenti', n ? 'ok' : undefined);
      }
      function exportMd() { if (!cur) return; const md = '# ' + cur.title + '\n\n' + cur.messages.map((m) => '**' + (m.role === 'user' ? 'Tu' : 'Thorion') + ':**\n\n' + m.content).join('\n\n---\n\n'); B.save(new Blob([md], { type: 'text/markdown' }), B.slug(cur.title) + '.md'); }

      B.on('ai:wait', () => { const n = B.$('.msg:last-child .msg-content .typing', thread); if (n && !B.$('.wait-note', n.parentNode)) n.after(B.h('small', { class: 'muted wait-note', text: ' ragiono e lavoro sulla rete GPU comunitaria…' })); });
      B.ai.init();
      this.ask = (q) => { if (cur && cur.messages.length) newChat(true); ta.value = q; grow(); send(); };
      this.focus = () => ta.focus();
      load();
    },
    onShow(params) { if (params && params.ask) setTimeout(() => this.ask(params.ask), 50); else setTimeout(() => this.focus && innerWidth > 760 && this.focus(), 60); }
  });

  /* render the Thorion solar logo into a box */
  function logoInto(box, size) {
    if (!box) return;
    box.style.width = box.style.height = (size || 28) + 'px';
    const img = new Image(); img.src = 'assets/thorion-logo-256.webp'; img.alt = ''; img.style.cssText = 'width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 10px rgba(243,208,136,.5))';
    box.appendChild(img);
  }

  /* shared: extract text from PDF */
  B.pdfText = async function (file) {
    await B.need('pdfjs');
    await B.loadScript(B.lib.pdfjsWorker);
    const pdfjs = window.pdfjsLib;
    if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = B.lib.pdfjsWorker;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;
    let out = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i); const tc = await page.getTextContent();
      out += '\n\n--- Pagina ' + i + ' ---\n' + tc.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('');
    }
    return out.trim();
  };
})();
