/* Iris Chat — conversations, streaming, vision, files, images in chat */
(function () {
  'use strict';
  const B = window.B;

  const PERSONAS = {
    iris: { label: 'Iris', icon: 'Eye', add: '' },
    writer: { label: 'Scrittrice', icon: 'Feather', add: 'Agisci come scrittrice e copywriter senior: testi vivi, chiari, adatti al pubblico; proponi titoli e varianti.' },
    coder: { label: 'Sviluppatrice', icon: 'Code2', add: 'Agisci come ingegnere software senior: codice completo, moderno, commentato quanto serve; spiega le scelte e i passi per eseguirlo.' },
    translator: { label: 'Traduttrice', icon: 'Languages', add: 'Agisci come traduttrice professionista: traduzioni fedeli e naturali; se la lingua di arrivo non è chiara, traduci in inglese se il testo è in italiano e viceversa.' },
    marketing: { label: 'Marketing', icon: 'Megaphone', add: 'Agisci come strategist di marketing e social media: idee concrete, calendari editoriali, copy per post, hashtag, call to action.' },
    tutor: { label: 'Tutor', icon: 'GraduationCap', add: 'Agisci come insegnante paziente: spiega passo per passo, con esempi, e verifica la comprensione con una domanda finale.' },
    designer: { label: 'Art director', icon: 'Palette', add: 'Agisci come art director: palette, tipografia, composizione, moodboard testuali e prompt per immagini.' }
  };
  const TIERS = [['quick', 'Rapido', 'Zap'], ['default', 'Bilanciato', 'Gauge'], ['complex', 'Profondo', 'Brain']];
  const SUGGEST = [
    ['Feather', 'Scrivi una caption', 'Scrivi 3 caption Instagram per il lancio di una nuova collezione di borse in pelle color cioccolato, con hashtag.'],
    ['Code2', 'Crea una pagina web', 'Crea una landing page HTML completa (un solo file con CSS e JS) per una caffetteria artigianale, elegante e animata.'],
    ['ImagePlus', 'Genera un’immagine', '/immagine ritratto cinematografico di una donna con occhi marroni, luce dorata del tramonto'],
    ['Lightbulb', 'Idee per un video', 'Dammi 5 idee per Reel di 15 secondi per promuovere una palestra, con hook iniziale e struttura scena per scena.'],
    ['Languages', 'Traduci e migliora', 'Traduci in inglese professionale: “Siamo felici di presentarvi il nostro nuovo servizio di consegna a domicilio.”'],
    ['Table', 'Organizza dati', 'Crea una tabella con un piano di allenamento settimanale per principianti, 3 giorni a settimana.']
  ];

  B.view('chat', {
    title: 'Iris Chat', icon: 'MessagesSquare', group: 'ai', desc: 'Chatta con l’AI: testi, codice, visione',
    mount(el) {
      let chats = [], cur = null, ctl = null, persona = B.ls.get('chat.persona', 'iris'), tier = B.ls.get('chat.tier', 'default');
      let attachments = []; // {kind:'image'|'text', name, blob?, text?}
      el.classList.add('chat-view');
      const side = B.h('aside', { class: 'chat-side' });
      const main = B.h('div', { class: 'chat-main' });
      el.append(side, main);

      /* sidebar */
      const newBtn = B.h('button', { class: 'btn gold block', type: 'button', onclick: () => newChat() }, B.h('span', { 'data-i': 'MessageCirclePlus' }), 'Nuova chat');
      const search = B.h('input', { class: 'input sm', id: 'chatSearch', placeholder: 'Cerca nelle chat' });
      const list = B.h('div', { class: 'chat-list scroll' });
      side.append(newBtn, search, list);
      search.addEventListener('input', renderList);

      /* header */
      const title = B.h('div', { class: 'chat-title', text: 'Nuova chat' });
      const personaBtn = B.h('button', { class: 'btn sm', type: 'button', onclick: (e) => B.menu(e.currentTarget, Object.entries(PERSONAS).map(([k, p]) => ({ label: p.label, icon: p.icon, active: k === persona, fn: () => { persona = k; B.ls.set('chat.persona', k); paintHead(); } }))) });
      const tierSeg = B.h('div', { class: 'seg' });
      TIERS.forEach(([k, l, ic]) => tierSeg.append(B.h('button', { type: 'button', 'data-t': k, 'data-tip': k === 'quick' ? 'Risposte immediate' : k === 'complex' ? 'Ragionamento più profondo, più lento' : 'Equilibrio tra velocità e qualità', onclick: () => { tier = k; B.ls.set('chat.tier', k); paintHead(); } }, B.h('span', { 'data-i': ic }), l)));
      const toggleSide = B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Mostra o nascondi le chat', 'data-i': 'PanelLeft', onclick: () => el.classList.toggle(innerWidth <= 760 ? 'side-open' : 'side-off') });
      const moreBtn = B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Altre azioni', 'data-i': 'MoreHorizontal', onclick: (e) => B.menu(e.currentTarget, [
        { label: 'Esporta in Markdown', icon: 'Download', fn: exportMd },
        { label: 'Copia tutta la chat', icon: 'Copy', fn: () => cur && B.copy(cur.messages.map((m) => (m.role === 'user' ? 'Tu: ' : 'Iris: ') + m.content).join('\n\n')) },
        { label: 'Rinomina', icon: 'Pencil', fn: rename },
        '-', { label: 'Elimina chat', icon: 'Trash2', fn: () => cur && delChat(cur) }
      ], { align: 'right' }) });
      const head = B.h('div', { class: 'bar chat-head' }, toggleSide, title, B.h('div', { class: 'bar-sp' }), personaBtn, tierSeg, moreBtn);
      function paintHead() {
        const p = PERSONAS[persona] || PERSONAS.iris;
        personaBtn.innerHTML = ''; personaBtn.append(B.h('span', { 'data-i': p.icon }), p.label, B.h('span', { 'data-i': 'ChevronDown' }));
        B.$$('button', tierSeg).forEach((b) => b.classList.toggle('on', b.dataset.t === tier));
        tierSeg.hidden = !B.ai.engines.claude;
        B.hydrateIcons(head);
      }

      /* messages */
      const scroller = B.h('div', { class: 'chat-scroll scroll' });
      const thread = B.h('div', { class: 'chat-thread' });
      scroller.append(thread);

      /* composer */
      const ta = B.h('textarea', { id: 'chatInput', rows: 1, placeholder: 'Scrivi a Iris… (/immagine per generare un’immagine, Maiusc+Invio per andare a capo)' });
      const attBar = B.h('div', { class: 'att-bar' });
      const sendBtn = B.h('button', { class: 'btn gold icon', type: 'button', 'aria-label': 'Invia', 'data-i': 'Send', onclick: () => send() });
      const stopBtn = B.h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Ferma', 'data-i': 'StopCircle', hidden: true, onclick: () => ctl && ctl.abort() });
      const attachBtn = B.h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Allega file', 'data-tip': 'Allega immagini, testi, codice o PDF', 'data-i': 'Paperclip', onclick: async () => addFiles(await B.pickFiles('image/*,.txt,.md,.csv,.json,.js,.ts,.py,.html,.css,.pdf', true)) });
      const imgBtn = B.h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Genera immagine', 'data-tip': 'Genera un’immagine', 'data-i': 'ImagePlus', onclick: () => { if (!ta.value.startsWith('/immagine ')) ta.value = '/immagine ' + ta.value; ta.focus(); } });
      const micNote = B.h('span', { class: 'muted chat-engine' });
      const composer = B.h('div', { class: 'composer' }, attBar, ta, B.h('div', { class: 'composer-row' }, attachBtn, imgBtn, micNote, B.h('div', { class: 'bar-sp' }), stopBtn, sendBtn));
      const composerWrap = B.h('div', { class: 'composer-wrap' }, composer, B.h('div', { class: 'composer-note', text: 'Iris può sbagliare: verifica le informazioni importanti.' }));
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

      /* data */
      async function load() {
        chats = (await B.db.all('chats')).sort((a, b) => b.updated - a.updated);
        renderList();
        if (!cur) { if (chats[0] && !chats[0].messages.length) open(chats[0]); else newChat(true); }
      }
      function newChat(silent) {
        if (cur && !cur.messages.length) { open(cur); ta.focus(); return; }
        cur = { id: B.uid('c'), title: 'Nuova chat', messages: [], updated: Date.now() };
        chats.unshift(cur); renderList(); renderThread(); if (!silent) ta.focus();
      }
      async function persist() { if (!cur) return; cur.updated = Date.now(); if (cur.messages.length) await B.db.put('chats', JSON.parse(JSON.stringify(cur, (k, v) => (k === 'blob' ? undefined : v)))); renderList(); }
      function open(c) { cur = c; el.classList.remove('side-open'); renderList(); renderThread(); }
      async function delChat(c) { if (!(await B.confirm('Eliminare questa chat?', '“' + c.title + '” verrà eliminata.', 'Elimina', true))) return; await B.db.del('chats', c.id); chats = chats.filter((x) => x !== c); cur = null; if (chats[0]) open(chats[0]); else newChat(); }
      async function rename() { if (!cur) return; const n = await B.prompt('Rinomina chat', cur.title); if (n) { cur.title = n; title.textContent = n; persist(); } }
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
          list.append(B.h('div', { class: 'cl-g', text: g }));
          groups[g].forEach((c) => list.append(B.h('button', { type: 'button', class: 'cl-item' + (c === cur ? ' on' : ''), onclick: () => open(c) }, B.h('span', { 'data-i': 'MessageSquare' }), B.h('span', { class: 'cl-t', text: c.title }))));
        });
        B.hydrateIcons(list);
      }
      function renderThread() {
        thread.innerHTML = '';
        title.textContent = cur ? cur.title : 'Nuova chat';
        if (!cur || !cur.messages.length) { thread.append(emptyState()); B.hydrateIcons(thread); return; }
        cur.messages.forEach((m, i) => thread.append(bubble(m, i)));
        B.hydrateIcons(thread);
        scroller.scrollTop = scroller.scrollHeight;
      }
      function emptyState() {
        const wrap = B.h('div', { class: 'chat-empty' });
        const eh = B.h('div', { class: 'ce-eye' }); B.eye(eh, { range: 0.12 });
        const g = B.h('div', { class: 'ce-grid' });
        SUGGEST.forEach(([ic, t, p]) => g.append(B.h('button', { type: 'button', class: 'ce-card', onclick: () => { ta.value = p; grow(); send(); } }, B.h('span', { 'data-i': ic }), B.h('b', { text: t }), B.h('small', { text: p.replace(/^\/immagine /, '') }))));
        wrap.append(eh, B.h('h2', { html: 'Ciao, sono <span class="serif">Iris</span>.' }), B.h('p', { class: 'muted', text: 'Chiedimi testi, idee, codice, traduzioni o analisi. Allega foto e documenti, oppure scrivi /immagine per generarne una.' }), g);
        return wrap;
      }
      function bubble(m, i) {
        const isUser = m.role === 'user';
        const b = B.h('div', { class: 'msg ' + (isUser ? 'me' : 'ai') + (m.error ? ' error' : '') });
        if (!isUser) { const av = B.h('div', { class: 'msg-av' }); B.eye(av, { blink: false, range: 0.05 }); b.append(av); }
        const body = B.h('div', { class: 'msg-body' });
        if (m.images && m.images.length) body.append(B.h('div', { class: 'msg-imgs' }, m.images.map((src) => B.h('img', { src, alt: 'Immagine allegata' }))));
        if (m.files && m.files.length) body.append(B.h('div', { class: 'msg-files' }, m.files.map((n) => B.h('span', { class: 'chip' }, B.h('span', { 'data-i': 'FileText' }), n))));
        const content = B.h('div', { class: 'msg-content md' });
        if (isUser) content.textContent = m.content; else renderMd(content, m.content);
        body.append(content);
        if (m.gen) body.append(genBlock(m.gen));
        if (!isUser && !m.pending) body.append(actions(m, i));
        b.append(body);
        return b;
      }
      function genBlock(g) {
        const box = B.h('div', { class: 'gen-img' });
        if (g.status === 'loading') { box.append(B.h('div', { class: 'gen-load' }, B.h('div', { class: 'iris-spin' }), B.h('span', { text: 'Iris sta dipingendo…' }))); return box; }
        if (g.status === 'error') { box.append(B.h('div', { class: 'muted', text: g.error })); return box; }
        const img = B.h('img', { src: g.src, alt: g.prompt });
        box.append(img, B.h('div', { class: 'gen-acts' },
          B.h('button', { class: 'btn sm', type: 'button', onclick: () => B.save(B.dataURLToBlob(g.src), B.slug(g.prompt) + '.png') }, B.h('span', { 'data-i': 'Download' }), 'Scarica'),
          B.h('button', { class: 'btn sm', type: 'button', onclick: () => B.go('photo', { imageURL: g.src }) }, B.h('span', { 'data-i': 'Aperture' }), 'Ritocca'),
          B.h('button', { class: 'btn sm', type: 'button', onclick: () => B.go('design', { imageURL: g.src }) }, B.h('span', { 'data-i': 'LayoutTemplate' }), 'Usa in un design'),
          B.h('button', { class: 'btn sm', type: 'button', onclick: () => B.go('motion', { imageURL: g.src, prompt: g.prompt }) }, B.h('span', { 'data-i': 'Film' }), 'Anima')));
        return box;
      }
      const renderMd = B.throttle(async (node, text) => { node.innerHTML = await B.md(text || ''); B.enhanceCode(node, codeExtras); }, 90);
      function codeExtras(acts, code, lang) {
        if (/html|javascript|js|css|xml|svg/.test(lang)) acts.append(B.h('button', { class: 'btn ghost sm', type: 'button', onclick: () => B.go('code', { code, lang }) }, B.h('span', { 'data-i': 'Play' }), 'Apri in Code Studio'));
      }
      function actions(m, i) {
        const a = B.h('div', { class: 'msg-acts' });
        a.append(B.h('button', { class: 'btn ghost sm icon', type: 'button', 'data-tip': 'Copia', 'aria-label': 'Copia', 'data-i': 'Copy', onclick: () => B.copy(m.content) }));
        a.append(B.h('button', { class: 'btn ghost sm icon', type: 'button', 'data-tip': 'Leggi ad alta voce', 'aria-label': 'Leggi', 'data-i': 'Volume2', onclick: () => speak(m.content) }));
        if (i === cur.messages.length - 1) a.append(B.h('button', { class: 'btn ghost sm icon', type: 'button', 'data-tip': 'Rigenera', 'aria-label': 'Rigenera', 'data-i': 'RefreshCw', onclick: regenerate }));
        a.append(B.h('button', { class: 'btn ghost sm icon', type: 'button', 'data-tip': 'Apri nell’editor documenti', 'aria-label': 'Documento', 'data-i': 'FileText', onclick: () => B.go('docs', { markdown: m.content }) }));
        return a;
      }
      function speak(text) {
        if (!('speechSynthesis' in window)) return B.toast('Sintesi vocale non disponibile in questo browser');
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/[#*`>_|-]/g, ' ').slice(0, 4000));
        u.lang = /[àèéìòù]|\b(il|la|che|non|per)\b/i.test(text) ? 'it-IT' : 'en-US';
        speechSynthesis.speak(u);
      }

      /* sending */
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
        renderThread();
        if (imgCmd) return genImage(imgCmd[2]);
        await answer();
      }
      async function genImage(prompt) {
        const msg = { role: 'assistant', content: 'Ecco l’immagine per: *' + prompt + '*', gen: { status: 'loading', prompt } };
        cur.messages.push(msg); renderThread(); busy(true);
        try {
          await B.ai.init();
          const engine = B.ai.engines.web ? 'web' : B.ai.engines.hf ? 'hf' : 'vector';
          let r;
          try { r = await B.ai.image(prompt, { engine, w: 1024, h: 1024, style: 'photo' }); }
          catch (e) { if (engine === 'hf') { B.toast(e.userMessage || 'Hugging Face non disponibile: passo al motore vettoriale'); r = await B.ai.image(prompt, { engine: 'vector', w: 1024, h: 1024 }); } else throw e; }
          const src = await B.blobToDataURL(r.blob);
          msg.gen = { status: 'done', src, prompt };
          if (r.engine === 'vector') msg.content += '\n\n_Disegnata con il motore vettoriale di Iris._';
          B.gallery && B.gallery.add({ blob: r.blob, prompt, engine: r.engine, w: 1024, h: 1024, svg: r.svg });
        } catch (e) { msg.gen = { status: 'error', error: B.ai.errorText(e) }; msg.error = true; }
        busy(false); renderThread(); persist();
      }
      async function answer() {
        const pend = { role: 'assistant', content: '', pending: true };
        cur.messages.push(pend);
        renderThread();
        const node = B.$('.msg:last-child .msg-content', thread);
        node.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
        busy(true);
        ctl = new AbortController();
        const history = cur.messages.slice(0, -1).slice(-24);
        const lastUser = history[history.length - 1];
        const images = [];
        let fileText = '';
        (lastUser._atts || []).forEach((a) => { if (a.kind === 'image') images.push(a.blob); else fileText += '\n\n[File allegato: ' + a.name + ']\n' + a.text; });
        const msgs = history.map((m, idx) => ({ role: m.role, content: (m.content || ' ') + (idx === history.length - 1 ? fileText : '') }));
        const p = PERSONAS[persona] || PERSONAS.iris;
        const system = B.ai.persona + (p.add ? '\n' + p.add : '') + '\nData di oggi: ' + new Date().toLocaleDateString('it-IT', { dateStyle: 'full' }) + '.';
        try {
          if (images.length && !B.ai.canSee()) B.toast('Questo motore non può vedere le immagini: invio solo il testo');
          const text = await B.ai.text(msgs, { system, tier, signal: ctl.signal, images: B.ai.canSee() ? images : null, onText: ({ text: t }) => { pend.content = t; renderMd(node, t); stick(); } });
          pend.content = text;
        } catch (e) {
          if (e.code === 'cancelled') pend.content = (pend.content || '') + '\n\n_— interrotto_';
          else { pend.content = (e.partial || pend.content || '') + (pend.content ? '\n\n' : '') + '⚠️ ' + (e.userMessage || 'Errore'); pend.error = true; }
        }
        delete pend.pending; ctl = null; busy(false);
        renderThread(); persist();
        if (cur.messages.length === 2 && B.ai.engines.claude) autoTitle();
      }
      async function autoTitle() {
        try {
          const t = await B.ai.text('Dai un titolo di massimo 5 parole, senza virgolette, a questa conversazione:\n' + cur.messages[0].content.slice(0, 600), { system: false, tier: 'quick', cache: true });
          cur.title = t.replace(/["“”.]/g, '').trim().slice(0, 48) || cur.title; title.textContent = cur.title; persist();
        } catch (e) { /* ignore */ }
      }
      function stick() { if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 160) scroller.scrollTop = scroller.scrollHeight; }
      function busy(on) { sendBtn.hidden = on; stopBtn.hidden = !on; ta.classList.toggle('busy', on); }
      async function regenerate() {
        if (ctl || !cur) return;
        while (cur.messages.length && cur.messages[cur.messages.length - 1].role === 'assistant') cur.messages.pop();
        const last = cur.messages[cur.messages.length - 1];
        const cmd = last && last.content.match(/^\/(immagine|img|image|disegna)\s+([\s\S]+)/i);
        renderThread();
        if (cmd) genImage(cmd[2]); else answer();
      }
      function exportMd() { if (!cur) return; const md = '# ' + cur.title + '\n\n' + cur.messages.map((m) => '**' + (m.role === 'user' ? 'Tu' : 'Iris') + ':**\n\n' + m.content).join('\n\n---\n\n'); B.save(new Blob([md], { type: 'text/markdown' }), B.slug(cur.title) + '.md'); }

      B.on('ai:ready', (e) => { micNote.textContent = B.ai.engineLabel(); paintHead(); });
      micNote.textContent = 'Connessione a Iris…';
      B.ai.init().then(() => { micNote.textContent = B.ai.engineLabel(); paintHead(); });
      paintHead();
      this.ask = (q) => { if (cur && cur.messages.length) newChat(true); ta.value = q; grow(); send(); };
      this.focus = () => ta.focus();
      load();
    },
    onShow(params) { if (params && params.ask) setTimeout(() => this.ask(params.ask), 50); else setTimeout(() => this.focus && innerWidth > 760 && this.focus(), 60); }
  });

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
