/* Home: the eye, the prompt, every studio one click away */
(function () {
  'use strict';
  const B = window.B;

  B.FORMATS = [
    { id: 'ig-post', label: 'Post Instagram', w: 1080, h: 1080 },
    { id: 'ig-story', label: 'Storia / Reel', w: 1080, h: 1920 },
    { id: 'ig-portrait', label: 'Post verticale', w: 1080, h: 1350 },
    { id: 'yt-thumb', label: 'Miniatura YouTube', w: 1280, h: 720 },
    { id: 'presentation', label: 'Presentazione', w: 1920, h: 1080 },
    { id: 'poster', label: 'Poster A4', w: 2480, h: 3508 },
    { id: 'flyer', label: 'Volantino A5', w: 1748, h: 2480 },
    { id: 'logo', label: 'Logo', w: 1000, h: 1000 },
    { id: 'card', label: 'Biglietto da visita', w: 1050, h: 600 },
    { id: 'banner', label: 'Banner web', w: 1500, h: 500 },
    { id: 'fb-cover', label: 'Copertina Facebook', w: 1640, h: 624 },
    { id: 'li-post', label: 'Post LinkedIn', w: 1200, h: 627 },
    { id: 'invite', label: 'Invito', w: 1500, h: 2100 },
    { id: 'menu', label: 'Menù', w: 1748, h: 2480 }
  ];

  const TOOLS = [
    { v: 'chat', t: 'Thorion Chat', d: 'Domande, testi, traduzioni, analisi di immagini e file.', like: 'ChatGPT', ic: 'MessagesSquare', c: 'linear-gradient(140deg,#c98a2e,#7a3d16)' },
    { v: 'imagine', t: 'Immagini AI', d: 'Foto realistiche, illustrazioni vettoriali e scene 3D da una frase.', like: 'Firefly, Midjourney', ic: 'ImagePlus', c: 'linear-gradient(140deg,#f3d088,#c98a2e)' },
    { v: 'motion', t: 'Video AI', d: 'Video da testo: scene cinematiche, foto animate, spot con musica.', like: 'Sora, Runway', ic: 'Film', c: 'linear-gradient(140deg,#a8642a,#3b2314)' },
    { v: 'design', t: 'Design Studio', d: 'Post, poster, loghi e presentazioni con modelli e Magic Design.', like: 'Canva, Express', ic: 'LayoutTemplate', c: 'linear-gradient(140deg,#e3a94a,#a8642a)' },
    { v: 'photo', t: 'Foto Studio', d: 'Livelli, pennelli, selezioni, regolazioni e ritocco con AI.', like: 'Photoshop, Lightroom', ic: 'Aperture', c: 'linear-gradient(140deg,#7a3d16,#1a0f08)' },
    { v: 'video', t: 'Video Editor', d: 'Timeline multitraccia, tagli, testi, transizioni, musica, export.', like: 'CapCut, Premiere', ic: 'Clapperboard', c: 'linear-gradient(140deg,#c98a2e,#4a2c1a)' },
    { v: 'code', t: 'Code Studio', d: 'Scrivi, genera e prova siti e app con anteprima dal vivo.', like: 'Copilot, Replit', ic: 'Code2', c: 'linear-gradient(140deg,#3b2314,#0a0604)' },
    { v: 'docs', t: 'Documenti & PDF', d: 'Scrittura con AI, unisci e dividi PDF, chatta con un PDF.', like: 'Acrobat, Word', ic: 'FileText', c: 'linear-gradient(140deg,#f3d088,#a8642a)' },
    { v: 'tools', t: 'Strumenti', d: 'Rimuovi sfondo, palette, QR, converti immagini, musica AI.', like: 'Toolbox', ic: 'Wand2', c: 'linear-gradient(140deg,#e3a94a,#7a3d16)' }
  ];

  function route(text, mode) {
    const s = text.toLowerCase();
    if (mode && mode !== 'auto') return mode;
    if (/(video|clip|reel|tiktok|filmato|animazion|spot|trailer|cortometraggio)/.test(s)) return 'motion';
    if (/(logo|post|poster|locandina|volantino|flyer|banner|biglietto|presentazion|slide|copertina|miniatura|thumbnail|instagram|storia|invito|menù|menu|brochure|infografica)/.test(s)) return 'design';
    if (/(sito|web app|app |applicazione|codice|html|css|javascript|python|script|funzione|gioco|landing|api|bug)/.test(s)) return 'code';
    if (/(ritocc|rimuovi lo sfondo|scontorna|migliora (la|questa) foto|correggi (la|questa) foto)/.test(s)) return 'photo';
    if (/(immagine|foto|disegna|illustrazion|ritratto|paesaggio|dipinto|render|wallpaper|sfondo per)/.test(s)) return 'imagine';
    if (/(documento|lettera|articolo|saggio|relazione|curriculum|cv |email|riassunt|pdf|contratto|tesi)/.test(s)) return 'docs';
    return 'chat';
  }
  const MODES = [['auto', 'Automatico', 'Sparkles'], ['chat', 'Chiedi', 'MessageSquare'], ['imagine', 'Immagine', 'Image'], ['motion', 'Video', 'Film'], ['design', 'Design', 'LayoutTemplate'], ['code', 'Codice', 'Code2'], ['docs', 'Documento', 'FileText']];

  B.view('home', {
    title: 'Home', icon: 'Home', group: 'main', desc: 'Panoramica e avvio rapido',
    mount(el) {
      let mode = 'auto';
      const page = B.h('div', { class: 'page' });
      const inner = B.h('div', { class: 'page-in' });
      page.append(inner); el.append(page);

      /* hero */
      const hero = B.h('section', { class: 'home-hero' });
      const fib = B.h('canvas', { class: 'fibers', 'aria-hidden': 'true' });
      const copy = B.h('div', { class: 'hero-copy' });
      const ta = B.h('textarea', { id: 'homePrompt', rows: 2, placeholder: 'Descrivi cosa vuoi creare… es. “un post Instagram per la mia pasticceria”, “un video di un faro nella tempesta”, “una landing page per un’app di fitness”' });
      const modeRow = B.h('div', { class: 'prompt-row' });
      MODES.forEach(([id, label, ic]) => modeRow.append(B.h('button', { class: 'chip' + (id === mode ? ' on' : ''), type: 'button', 'data-mode': id, onclick: (e) => { mode = id; B.$$('[data-mode]', modeRow).forEach((c) => c.classList.toggle('on', c.dataset.mode === id)); } }, B.h('span', { 'data-i': ic }), label)));
      const go = B.h('button', { class: 'btn gold', type: 'button', onclick: submit }, B.h('span', { 'data-i': 'Sparkles' }), 'Crea');
      modeRow.append(go);
      copy.append(
        B.h('span', { class: 'eyebrow', text: 'Thorion · Thorion AI' }),
        B.h('h1', { html: 'Guarda. Immagina.<br><span class="serif">Crea.</span>' }),
        B.h('p', { text: 'Design, foto, video, immagini, codice e documenti in un solo studio, guidato da Thorion: l’intelligenza artificiale che vede quello che immagini.' }),
        B.h('div', { class: 'prompt-box' }, ta, modeRow)
      );
      const eyeHost = B.h('div', { class: 'hero-eye' });
      hero.append(fib, copy, eyeHost);
      inner.append(hero);
      B.eye(eyeHost, { range: 0.09 });
      B.fibers(fib);
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
      ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(180, ta.scrollHeight) + 'px'; });

      function submit() {
        const text = ta.value.trim();
        if (!text) { ta.focus(); B.toast('Scrivi prima cosa vuoi creare'); return; }
        const dest = route(text, mode);
        const params = { prompt: text, auto: true };
        if (dest === 'chat') B.go('chat', { ask: text });
        else B.go(dest, params);
        ta.value = '';
      }

      /* studios */
      const grid = B.h('div', { class: 'home-grid' });
      TOOLS.forEach((t, i) => {
        const card = B.h('button', { class: 'tool-card', type: 'button', style: { '--tc': t.c, animationDelay: (i * 45) + 'ms' }, onclick: () => B.go(t.v) },
          B.h('span', { class: 'tc-ic', 'data-i': t.ic }), B.h('h3', { text: t.t }), B.h('p', { text: t.d }), B.h('span', { class: 'tc-like', html: 'Al posto di <b>' + B.esc(t.like) + '</b>' }));
        grid.append(card);
      });
      inner.append(B.h('div', { class: 'section-title' }, B.h('h2', { text: 'I tuoi studi' }), B.h('span', { class: 'muted', html: 'Premi <kbd>Ctrl</kbd> <kbd>K</kbd> per cercare qualsiasi strumento' })), grid);

      /* formats */
      const fr = B.h('div', { class: 'format-row' });
      B.FORMATS.slice(0, 12).forEach((f) => {
        const max = 62, sc = max / Math.max(f.w, f.h);
        fr.append(B.h('button', { class: 'format', type: 'button', onclick: () => B.go('design', { format: f.id }) },
          B.h('span', { class: 'f-shape' }, B.h('i', { style: { width: Math.round(f.w * sc) + 'px', height: Math.round(f.h * sc) + 'px' } })), B.h('b', { text: f.label }), B.h('small', { text: f.w + '×' + f.h })));
      });
      [['Reel 9:16', 1080, 1920], ['Video 16:9', 1920, 1080], ['Quadrato 1:1', 1080, 1080]].forEach(([l, w, h]) => {
        const sc = 62 / Math.max(w, h);
        fr.append(B.h('button', { class: 'format', type: 'button', onclick: () => B.go('video', { ratio: w + 'x' + h }) },
          B.h('span', { class: 'f-shape' }, B.h('i', { style: { width: Math.round(w * sc) + 'px', height: Math.round(h * sc) + 'px', background: 'linear-gradient(140deg,#3b2314,#0a0604)' } })), B.h('b', { text: l }), B.h('small', { text: 'Video Editor' })));
      });
      inner.append(B.h('div', { class: 'section-title' }, B.h('h2', { text: 'Inizia da un formato' })), fr);

      /* recent */
      const recentWrap = B.h('div');
      inner.append(B.h('div', { class: 'section-title' }, B.h('h2', { text: 'Progetti recenti' }), B.h('a', { href: '#projects', onclick: (e) => { e.preventDefault(); B.go('projects'); }, text: 'Tutti i progetti' })), recentWrap);
      async function renderRecent() {
        const list = (await B.projects.list()).slice(0, 8);
        recentWrap.innerHTML = '';
        if (!list.length) { recentWrap.append(B.h('div', { class: 'card empty' }, B.h('span', { 'data-i': 'FolderOpen' }), B.h('b', { text: 'Nessun progetto ancora' }), B.h('span', { text: 'Quello che crei viene salvato qui, nel tuo browser.' }))); B.hydrateIcons(recentWrap); return; }
        const g = B.h('div', { class: 'recent-grid' });
        list.forEach((p) => g.append(B.projectCard(p)));
        recentWrap.append(g); B.hydrateIcons(recentWrap);
      }
      renderRecent(); B.on('projects', renderRecent);

      /* engines */
      const eng = B.h('div', { class: 'stat-strip' });
      inner.append(B.h('div', { class: 'section-title' }, B.h('h2', { text: 'Motori di Thorion' }), B.h('a', { href: '#settings', onclick: (e) => { e.preventDefault(); B.go('settings'); }, text: 'Dettagli' })), eng);
      function renderEng() {
        const e = B.ai.engines;
        const items = [
          ['Brain', 'Testo, codice e visione', e.claude ? 'Attivo con Claude: nessuna chiave, nessun costo extra.' : e.web ? 'Skyfall 31B e altri modelli aperti sulla rete GPU comunitaria: senza chiave, illimitato.' : 'In attesa di connessione…', e.claude || e.web],
          ['Camera', 'Foto ultra realistiche', e.horde ? 'Rete GPU comunitaria AI Horde + finitura locale: illimitata, senza chiave.' : 'Disponibili nella versione web di Thorion (rete GPU comunitaria, illimitata).', e.horde],
          ['PenTool', 'Vettoriale e 3D procedurale', 'Disegni SVG e scene GPU scritte da Thorion: illimitati.', e.claude || e.web],
          ['Cpu', 'Strumenti locali', 'Ritocco, montaggio, export, PDF e musica girano nel tuo browser.', true]
        ];
        eng.innerHTML = '';
        items.forEach(([ic, t, s, ok]) => eng.append(B.h('div', { class: 'engine-card' }, B.h('span', { class: 'ec-ic', 'data-i': ic }), B.h('div', null, B.h('b', { text: t }), B.h('small', { text: s }), B.h('span', { class: 'badge ' + (ok ? 'ok' : ''), style: 'margin-top:8px', text: ok ? 'Pronto' : 'Non attivo' })))));
        B.hydrateIcons(eng);
      }
      renderEng(); B.on('ai:ready', renderEng);
    },
    onShow() { setTimeout(() => { const t = B.$('#homePrompt'); if (t && innerWidth > 760) t.focus({ preventScroll: true }); }, 200); }
  });

  B.projectCard = function (p) {
    const t = B.projects.TYPES[p.type] || ['Progetto', 'Folder'];
    const th = B.h('span', { class: 'pc-th' });
    if (p.thumb) th.append(B.h('img', { src: p.thumb, alt: '', loading: 'lazy' })); else th.append(B.h('span', { 'data-i': t[1] }));
    return B.h('button', { class: 'proj-card', type: 'button', onclick: () => B.projects.open(p) }, th, B.h('span', { class: 'pc-b' }, B.h('b', { text: p.name || 'Senza titolo' }), B.h('small', { text: t[0] + ' · ' + B.fmtDate(p.updated) })));
  };
})();
