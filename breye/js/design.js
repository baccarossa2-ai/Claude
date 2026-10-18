/* Design Studio — Canva-style editor on Fabric.js */
(function () {
  'use strict';
  const B = window.B;

  const FONTS = [
    ['Bricolage Grotesque', 'Moderno'], ['Figtree', 'Moderno'], ['Montserrat', 'Moderno'], ['Poppins', 'Moderno'], ['Inter', 'Moderno'], ['Raleway', 'Moderno'], ['Nunito', 'Moderno'], ['Rubik', 'Moderno'], ['Josefin Sans', 'Moderno'], ['Syne', 'Moderno'], ['Unbounded', 'Moderno'], ['Space Grotesk', 'Moderno'],
    ['Instrument Serif', 'Elegante'], ['Playfair Display', 'Elegante'], ['DM Serif Display', 'Elegante'], ['Cormorant Garamond', 'Elegante'], ['Lora', 'Elegante'], ['Merriweather', 'Elegante'], ['Cinzel', 'Elegante'], ['Gloock', 'Elegante'], ['Fraunces', 'Elegante'], ['Libre Baskerville', 'Elegante'],
    ['Anton', 'Impatto'], ['Bebas Neue', 'Impatto'], ['Oswald', 'Impatto'], ['Archivo Black', 'Impatto'], ['Alfa Slab One', 'Impatto'], ['Bungee', 'Impatto'], ['Teko', 'Impatto'], ['Righteous', 'Impatto'], ['Abril Fatface', 'Impatto'],
    ['Great Vibes', 'Scritto a mano'], ['Dancing Script', 'Scritto a mano'], ['Pacifico', 'Scritto a mano'], ['Caveat', 'Scritto a mano'], ['Satisfy', 'Scritto a mano'], ['Permanent Marker', 'Scritto a mano'], ['Shadows Into Light', 'Scritto a mano'], ['Lobster', 'Scritto a mano'],
    ['Monoton', 'Decorativo'], ['Orbitron', 'Decorativo'], ['Comfortaa', 'Decorativo'], ['Fredoka', 'Decorativo'], ['Quicksand', 'Decorativo'], ['JetBrains Mono', 'Decorativo'], ['Space Mono', 'Decorativo']
  ];
  const PALETTES = [
    ['Iride', ['#120a06', '#4a2c1a', '#a8642a', '#e3a94a', '#f3d088', '#fffaf1']],
    ['Espresso', ['#1a0f08', '#3b2314', '#6b4226', '#c69c6d', '#ede0cf', '#ffffff']],
    ['Crema', ['#fbf5ec', '#f2e7d7', '#d9b48f', '#a8642a', '#3b2314', '#0b0705']],
    ['Terra', ['#2d1b12', '#8c3b1e', '#c8692c', '#e8b04a', '#f4e3c3', '#fffaf1']],
    ['Notte d’oro', ['#050302', '#16110c', '#2c2015', '#b88a3e', '#e9c46a', '#fdf6e3']],
    ['Cacao e menta', ['#2b1a12', '#6f4e37', '#c9a27e', '#a8d5ba', '#e9f5ee', '#ffffff']],
    ['Tramonto', ['#2b0f1a', '#7a2e3a', '#d9603b', '#f2a65a', '#f9dca8', '#fff8ee']],
    ['Bianco e nero', ['#000000', '#1c1c1c', '#555555', '#bdbdbd', '#efefef', '#ffffff']]
  ];
  const SWATCHES = ['#0b0705', '#2b1810', '#4a2c1a', '#7a3d16', '#a8642a', '#c98a2e', '#e3a94a', '#f3d088', '#fffaf1', '#ffffff', '#f2e7d7', '#d9b48f', '#8c3b1e', '#d9603b', '#2f4b3a', '#1f3a5f'];
  const STICKERS = ['✨', '⭐', '❤️', '🔥', '☕', '🎉', '🌿', '🌸', '👁️', '💡', '📍', '📸', '🎬', '🎵', '✅', '⚡', '🍂', '🥐', '🍫', '🏆', '💎', '🌙', '☀️', '🎁'];
  const EXTRA = ['id', 'name', 'bxType', 'locked', 'selectable', 'evented', 'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY', 'lockRotation', 'hasControls', 'editable', 'bxPrompt', 'bxIcon'];

  /* ---------------- templates ---------------- */
  function T(w, h) {
    const S = Math.min(w, h) / 1080, portrait = h / w > 1.2, land = w / h > 1.3;
    const px = (v) => v * S;
    const txt = (text, o) => Object.assign({ type: 'textbox', text, left: w * 0.08, top: h * 0.1, width: w * 0.84, fontSize: px(64), fontFamily: 'Figtree', fill: '#fffaf1', textAlign: 'left', lineHeight: 1.1, charSpacing: 0 }, o);
    return [
      { id: 'iris', name: 'Iride d’oro', bg: { type: 'linear', colors: ['#1a0f08', '#3b2314'], angle: 160 }, objs: [
        { type: 'circle', left: w * 0.62, top: portrait ? h * 0.55 : h * 0.18, radius: Math.min(w, h) * 0.32, fill: '', stroke: '#e3a94a', strokeWidth: px(3), opacity: 0.6 },
        { type: 'circle', left: w * 0.7, top: portrait ? h * 0.6 : h * 0.26, radius: Math.min(w, h) * 0.18, fill: { type: 'radial', colors: ['#f3d088', '#a8642a', '#3b2314'] } },
        txt('NUOVA COLLEZIONE', { top: h * 0.12, fontSize: px(26), fill: '#e3a94a', charSpacing: 400, fontWeight: 700 }),
        txt('Il colore dei tuoi occhi', { top: h * 0.17, fontSize: px(portrait ? 120 : 104), fontFamily: 'Instrument Serif', fontStyle: 'italic', width: w * (land ? 0.55 : 0.8), lineHeight: 1 }),
        txt('Scopri le tonalità calde della stagione. Disponibile dal 1° ottobre.', { top: portrait ? h * 0.42 : h * 0.62, fontSize: px(30), fill: '#cfb89d', width: w * (land ? 0.45 : 0.7), lineHeight: 1.4 }),
        { type: 'rect', left: w * 0.08, top: portrait ? h * 0.88 : h * 0.84, width: px(260), height: px(70), rx: px(35), ry: px(35), fill: '#e3a94a' },
        txt('Scopri di più', { left: w * 0.08, top: (portrait ? h * 0.88 : h * 0.84) + px(19), width: px(260), fontSize: px(26), fill: '#1a0f08', textAlign: 'center', fontWeight: 700 })
      ] },
      { id: 'crema', name: 'Minimal Crema', bg: { type: 'solid', color: '#f6eee2' }, objs: [
        txt('STUDIO BREYE · 2026', { fontSize: px(24), fill: '#a8642a', charSpacing: 300, fontWeight: 700 }),
        txt('Meno, ma meglio.', { top: h * 0.3, fontSize: px(150), fontFamily: 'Bricolage Grotesque', fontWeight: 800, fill: '#22140b', lineHeight: 0.95 }),
        { type: 'rect', left: w * 0.08, top: h * 0.82, width: w * 0.84, height: px(3), fill: '#22140b' },
        txt('Design essenziale per idee che durano.', { top: h * 0.85, fontSize: px(32), fill: '#5d4230' })
      ] },
      { id: 'sale', name: 'Promo saldi', bg: { type: 'linear', colors: ['#7a2e1a', '#d9603b'], angle: 135 }, objs: [
        { type: 'circle', left: -w * 0.15, top: h * 0.55, radius: Math.min(w, h) * 0.45, fill: '#e3a94a', opacity: 0.35 },
        txt('SOLO QUESTO WEEKEND', { top: h * 0.12, fontSize: px(32), fill: '#fff3d6', fontWeight: 700, charSpacing: 200, textAlign: 'center' }),
        txt('-50%', { top: h * 0.24, fontSize: px(portrait ? 300 : 260), fontFamily: 'Anton', fill: '#fffaf1', textAlign: 'center', lineHeight: 1 }),
        txt('SU TUTTA LA COLLEZIONE', { top: h * (portrait ? 0.5 : 0.62), fontSize: px(44), fontFamily: 'Bebas Neue', fill: '#2b0f08', textAlign: 'center', charSpacing: 150 }),
        txt('www.iltuonegozio.it', { top: h * 0.88, fontSize: px(28), fill: '#fff3d6', textAlign: 'center' })
      ] },
      { id: 'quote', name: 'Citazione', bg: { type: 'solid', color: '#120a06' }, objs: [
        txt('“', { top: h * 0.08, fontSize: px(320), fontFamily: 'Instrument Serif', fill: '#e3a94a', lineHeight: 1 }),
        txt('Gli occhi sono lo specchio dell’anima: guarda con attenzione e troverai ciò che cerchi.', { top: h * 0.33, fontSize: px(70), fontFamily: 'Instrument Serif', fontStyle: 'italic', fill: '#f6ead9', lineHeight: 1.15 }),
        { type: 'rect', left: w * 0.08, top: h * 0.8, width: px(80), height: px(4), fill: '#e3a94a' },
        txt('— Anonimo', { top: h * 0.83, fontSize: px(30), fill: '#cfb89d', fontWeight: 600 })
      ] },
      { id: 'event', name: 'Evento', bg: { type: 'linear', colors: ['#050302', '#2c2015'], angle: 180 }, objs: [
        { type: 'rect', left: w * 0.08, top: h * 0.1, width: px(170), height: px(190), rx: px(18), ry: px(18), fill: '#e9c46a' },
        txt('24', { left: w * 0.08, top: h * 0.1 + px(18), width: px(170), fontSize: px(96), fontFamily: 'Bricolage Grotesque', fontWeight: 800, fill: '#16110c', textAlign: 'center' }),
        txt('OTT', { left: w * 0.08, top: h * 0.1 + px(122), width: px(170), fontSize: px(36), fontWeight: 700, fill: '#16110c', textAlign: 'center', charSpacing: 200 }),
        txt('Serata di degustazione', { top: h * 0.42, fontSize: px(96), fontFamily: 'DM Serif Display', fill: '#fdf6e3', lineHeight: 1 }),
        txt('Caffè d’origine, cioccolato fondente e musica dal vivo', { top: h * (portrait ? 0.6 : 0.68), fontSize: px(32), fill: '#cdb79c', lineHeight: 1.35, width: w * 0.7 }),
        txt('ORE 20:30 · VIA ROMA 12, MILANO', { top: h * 0.88, fontSize: px(26), fill: '#e9c46a', fontWeight: 700, charSpacing: 200 })
      ] },
      { id: 'yt', name: 'Miniatura video', bg: { type: 'linear', colors: ['#2b0f08', '#a8642a'], angle: 120 }, objs: [
        txt('PROVATO PER 30 GIORNI', { top: h * 0.12, fontSize: px(land ? 90 : 110), fontFamily: 'Anton', fill: '#fffaf1', stroke: '#1a0f08', strokeWidth: px(4), width: w * (land ? 0.6 : 0.84), lineHeight: 1 }),
        txt('il risultato? 😱', { top: h * (land ? 0.62 : 0.5), fontSize: px(70), fontFamily: 'Permanent Marker', fill: '#f3d088', width: w * 0.6 }),
        { type: 'circle', left: w * (land ? 0.62 : 0.5), top: h * (land ? 0.12 : 0.62), radius: Math.min(w, h) * (land ? 0.36 : 0.25), fill: '#e3a94a', stroke: '#fffaf1', strokeWidth: px(10) }
      ] },
      { id: 'card', name: 'Biglietto da visita', bg: { type: 'solid', color: '#16110c' }, objs: [
        { type: 'rect', left: 0, top: 0, width: w * 0.035, height: h, fill: '#e9c46a' },
        txt('Giulia Bruni', { left: w * 0.1, top: h * 0.2, fontSize: px(84), fontFamily: 'Bricolage Grotesque', fontWeight: 800, fill: '#fdf6e3' }),
        txt('Art director & fotografa', { left: w * 0.1, top: h * 0.2 + px(110), fontSize: px(36), fill: '#e9c46a', fontStyle: 'italic', fontFamily: 'Instrument Serif' }),
        txt('+39 333 123 4567\nciao@giuliabruni.it\ngiuliabruni.it', { left: w * 0.1, top: h * 0.62, fontSize: px(28), fill: '#cdb79c', lineHeight: 1.5 })
      ] },
      { id: 'title-slide', name: 'Slide titolo', bg: { type: 'linear', colors: ['#120a06', '#3b2314'], angle: 100 }, objs: [
        txt('CAPITOLO 01', { top: h * 0.2, fontSize: px(26), fill: '#e3a94a', fontWeight: 700, charSpacing: 400 }),
        txt('Strategia creativa 2026', { top: h * 0.28, fontSize: px(land ? 120 : 110), fontFamily: 'Bricolage Grotesque', fontWeight: 800, fill: '#fffaf1', width: w * 0.8, lineHeight: 1 }),
        txt('Obiettivi, pubblico e piano editoriale', { top: h * (land ? 0.62 : 0.55), fontSize: px(38), fill: '#cfb89d' }),
        { type: 'rect', left: w * 0.08, top: h * 0.86, width: w * 0.84, height: px(2), fill: '#4f3523' },
        txt('Breye Studio', { top: h * 0.88, fontSize: px(24), fill: '#957c64' })
      ] },
      { id: 'menu', name: 'Menù', bg: { type: 'solid', color: '#f6eee2' }, objs: [
        txt('Caffetteria Ambra', { top: h * 0.07, fontSize: px(80), fontFamily: 'Great Vibes', fill: '#7a3d16', textAlign: 'center' }),
        txt('MENÙ DELLA COLAZIONE', { top: h * 0.07 + px(110), fontSize: px(24), fill: '#a8642a', textAlign: 'center', charSpacing: 400, fontWeight: 700 }),
        txt('Espresso\nCappuccino\nCornetto alla crema\nPain au chocolat\nSpremuta d’arancia\nToast avocado', { top: h * 0.3, width: w * 0.55, fontSize: px(38), fill: '#22140b', lineHeight: 1.8, fontFamily: 'Playfair Display' }),
        txt('1,20 €\n1,60 €\n1,50 €\n1,80 €\n3,50 €\n6,00 €', { left: w * 0.6, top: h * 0.3, width: w * 0.32, fontSize: px(38), fill: '#a8642a', lineHeight: 1.8, textAlign: 'right', fontFamily: 'Playfair Display' })
      ] },
      { id: 'logo', name: 'Logo', bg: { type: 'solid', color: '#fffaf1' }, objs: [
        { type: 'circle', left: w / 2 - Math.min(w, h) * 0.18, top: h * 0.2, radius: Math.min(w, h) * 0.18, fill: { type: 'radial', colors: ['#f3d088', '#c98a2e', '#4a2c1a'] }, stroke: '#3b2314', strokeWidth: px(6) },
        { type: 'circle', left: w / 2 - Math.min(w, h) * 0.06, top: h * 0.2 + Math.min(w, h) * 0.12, radius: Math.min(w, h) * 0.06, fill: '#0b0705' },
        txt('AMBRA', { top: h * 0.62, fontSize: px(110), fontFamily: 'Cinzel', fontWeight: 700, fill: '#3b2314', textAlign: 'center', charSpacing: 300 }),
        txt('TORREFAZIONE · DAL 1987', { top: h * 0.62 + px(140), fontSize: px(26), fill: '#a8642a', textAlign: 'center', charSpacing: 400, fontWeight: 700 })
      ] },
      { id: 'story', name: 'Storia gradiente', bg: { type: 'linear', colors: ['#f2a65a', '#7a2e3a'], angle: 200 }, objs: [
        txt('oggi', { top: h * 0.08, fontSize: px(90), fontFamily: 'Pacifico', fill: '#fff8ee' }),
        txt('3 cose che ho imparato sul colore', { top: h * 0.2, fontSize: px(96), fontFamily: 'Bricolage Grotesque', fontWeight: 800, fill: '#fff8ee', lineHeight: 1 }),
        { type: 'rect', left: w * 0.08, top: h * 0.58, width: w * 0.84, height: h * 0.26, rx: px(40), ry: px(40), fill: '#fff8ee', opacity: 0.92 },
        txt('1. Il marrone è caldo ma elegante\n2. L’oro va usato con misura\n3. Il nero dà profondità', { left: w * 0.13, top: h * 0.61, width: w * 0.74, fontSize: px(38), fill: '#2b0f1a', lineHeight: 1.6 })
      ] },
      { id: 'blank', name: 'Vuoto', bg: { type: 'solid', color: '#ffffff' }, objs: [] }
    ];
  }

  B.view('design', {
    title: 'Design Studio', icon: 'LayoutTemplate', group: 'studio', desc: 'Grafiche, post, poster, presentazioni',
    mount(el) {
      const st = { w: 1080, h: 1080, pages: [], cur: 0, zoom: 0.5, name: 'Design senza titolo', id: null, hist: [], fut: [], lock: false, clip: null, ready: false, panel: 'templates' };
      let cv = null; // fabric canvas
      el.classList.add('design-view');

      /* ---------- layout ---------- */
      const nameIn = B.h('input', { id: 'dsName', value: st.name, 'aria-label': 'Nome del design' });
      nameIn.addEventListener('change', () => { st.name = nameIn.value || 'Design'; });
      const undoB = B.h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Annulla', 'data-tip': 'Annulla (Ctrl Z)', 'data-i': 'Undo2', onclick: () => undo() });
      const redoB = B.h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Ripeti', 'data-tip': 'Ripeti (Ctrl Y)', 'data-i': 'Redo2', onclick: () => redo() });
      const sizeB = B.h('button', { class: 'btn sm', type: 'button', onclick: (e) => resizeMenu(e.currentTarget) }, B.h('span', { 'data-i': 'Ratio' }), B.h('span', { class: 'ds-size', text: '1080×1080' }));
      const saveB = B.h('button', { class: 'btn', type: 'button', onclick: () => saveProject() }, B.h('span', { 'data-i': 'Save' }), 'Salva');
      const dlB = B.h('button', { class: 'btn gold', type: 'button', onclick: (e) => exportMenu(e.currentTarget) }, B.h('span', { 'data-i': 'Download' }), 'Scarica');
      const magicB = B.h('button', { class: 'btn', type: 'button', onclick: () => openPanel('magic') }, B.h('span', { 'data-i': 'Sparkles' }), 'Magic');
      const bar = B.h('div', { class: 'bar' }, B.h('div', { class: 'bar-title' }, B.h('span', { class: 'bt-ic', 'data-i': 'LayoutTemplate' }), nameIn), undoB, redoB, B.h('div', { class: 'bar-sep' }), sizeB, B.h('div', { class: 'bar-sp' }), magicB, saveB, dlB);

      const rail = B.h('nav', { class: 'rail', 'aria-label': 'Pannelli' });
      const PANELS = [['templates', 'Modelli', 'LayoutTemplate'], ['elements', 'Elementi', 'Shapes'], ['text', 'Testo', 'Type'], ['photos', 'Foto', 'Image'], ['bg', 'Sfondo', 'Wallpaper'], ['brand', 'Brand', 'Palette'], ['magic', 'Magic', 'Sparkles'], ['layers', 'Livelli', 'Layers']];
      PANELS.forEach(([k, l, ic]) => rail.append(B.h('button', { class: 'rail-btn', type: 'button', 'data-p': k, onclick: () => openPanel(k) }, B.h('span', { 'data-i': ic }), l)));
      const drawer = B.h('aside', { class: 'drawer' });
      const dHead = B.h('div', { class: 'drawer-h' }, B.h('h3', { text: '' }), B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Chiudi pannello', 'data-i': 'ChevronLeft', onclick: () => { drawer.classList.add('closed'); B.$$('.rail-btn', rail).forEach((b) => b.classList.remove('on')); } }));
      const dBody = B.h('div', { class: 'drawer-b' });
      drawer.append(dHead, dBody);

      const stage = B.h('div', { class: 'stage-wrap grid-bg ds-stage' });
      const scroller = B.h('div', { class: 'ds-scroll' });
      const pageHost = B.h('div', { class: 'ds-page' });
      const canvasEl = B.h('canvas', { id: 'dsCanvas' });
      pageHost.append(canvasEl); scroller.append(pageHost); stage.append(scroller);
      const zoomLbl = B.h('span', { text: '50%' });
      stage.append(B.h('div', { class: 'zoom-ctl' }, B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Riduci', 'data-i': 'ZoomOut', onclick: () => setZoom(st.zoom / 1.2) }), zoomLbl, B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Ingrandisci', 'data-i': 'ZoomIn', onclick: () => setZoom(st.zoom * 1.2) }), B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Adatta', 'data-tip': 'Adatta allo schermo', 'data-i': 'Maximize2', onclick: () => fit() })));
      const pagesBar = B.h('div', { class: 'ds-pages' });
      const center = B.h('div', { class: 'ds-center' }, stage, pagesBar);
      const insp = B.h('aside', { class: 'inspector' });
      const inspB = B.h('div', { class: 'insp-b' });
      insp.append(inspB);
      const loading = B.h('div', { class: 'ds-loading' }, B.h('div', { class: 'iris-spin' }), B.h('span', { text: 'Preparo il Design Studio…' }));
      stage.append(loading);
      const body = B.h('div', { class: 'ds-body' }, rail, drawer, center, insp);
      el.append(bar, body);

      /* ---------- fabric init ---------- */
      B.need('fabric').then(init).catch((e) => { loading.innerHTML = ''; loading.append(B.h('span', { text: 'Impossibile caricare il motore grafico: controlla la connessione e ricarica.' })); B.err(e); });
      function init() {
        const f = window.fabric;
        // Fabric 5 sets textBaseline to the non-standard 'alphabetical'; map it to 'alphabetic' to keep the console clean
        const tbd = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'textBaseline');
        if (tbd && tbd.set && !CanvasRenderingContext2D.prototype.__breyeTB) {
          Object.defineProperty(CanvasRenderingContext2D.prototype, 'textBaseline', { configurable: true, get() { return tbd.get.call(this); }, set(v) { tbd.set.call(this, v === 'alphabetical' ? 'alphabetic' : v); } });
          CanvasRenderingContext2D.prototype.__breyeTB = true;
        }
        f.Object.prototype.set({ transparentCorners: false, cornerColor: '#fffaf1', cornerStrokeColor: '#c98a2e', borderColor: '#e3a94a', cornerSize: 11, cornerStyle: 'circle', borderScaleFactor: 1.6, padding: 4 });
        f.Textbox.prototype.set({ splitByGrapheme: false });
        cv = new f.Canvas(canvasEl, { preserveObjectStacking: true, backgroundColor: '#ffffff', selectionColor: 'rgba(227,169,74,.12)', selectionBorderColor: '#e3a94a', selectionLineWidth: 1.5, stopContextMenu: true, fireRightClick: true });
        st.ready = true; loading.remove();
        cv.on('selection:created', paintInspector); cv.on('selection:updated', paintInspector); cv.on('selection:cleared', paintInspector);
        cv.on('object:modified', () => { snap(); paintInspector(); });
        cv.on('text:changed', B.debounce(snap, 500));
        cv.on('object:moving', guides); cv.on('mouse:up', () => { st.guide = null; cv.requestRenderAll(); });
        cv.on('after:render', drawGuides);
        cv.on('mouse:dblclick', (o) => { if (o.target && o.target.type === 'image') imageMenu(o.target); });
        cv.on('mouse:down', (o) => { if (o.button === 3 && o.target) { cv.setActiveObject(o.target); cv.requestRenderAll(); ctxMenu(o.e); } });
        B.dropzone(stage, async (files) => { for (const file of files) if (file.type.startsWith('image/')) await addImage(await B.blobToDataURL(file)); }, 'image/*');
        newDesign(1080, 1080, 'iris');
        openPanel(st.panel);
        if (st.pendingLoad) { const p = st.pendingLoad; st.pendingLoad = null; handleParams(p); }
      }

      /* ---------- helpers ---------- */
      function uid() { return B.uid('o'); }
      function fill(def, w, h) {
        const f = window.fabric;
        if (!def || typeof def === 'string') return def;
        if (def.type === 'radial') return new f.Gradient({ type: 'radial', coords: { x1: w / 2, y1: h / 2, r1: 0, x2: w / 2, y2: h / 2, r2: Math.max(w, h) / 2 }, colorStops: def.colors.map((c, i) => ({ offset: i / (def.colors.length - 1), color: c })) });
        const a = ((def.angle ?? 135) - 90) * Math.PI / 180, cx = w / 2, cy = h / 2, r = Math.hypot(w, h) / 2;
        return new f.Gradient({ type: 'linear', coords: { x1: cx - Math.cos(a) * r, y1: cy - Math.sin(a) * r, x2: cx + Math.cos(a) * r, y2: cy + Math.sin(a) * r }, colorStops: def.colors.map((c, i) => ({ offset: i / (def.colors.length - 1), color: c })) });
      }
      function build(o) {
        const f = window.fabric;
        let obj;
        const base = Object.assign({}, o); delete base.type; delete base.text;
        if (o.type === 'textbox') { obj = new f.Textbox(o.text, base); B.loadFont(o.fontFamily).then(() => { obj.initDimensions && obj.initDimensions(); cv && cv.requestRenderAll(); }); }
        else if (o.type === 'rect') obj = new f.Rect(base);
        else if (o.type === 'circle') obj = new f.Circle(base);
        else if (o.type === 'triangle') obj = new f.Triangle(base);
        else if (o.type === 'line') obj = new f.Line([0, 0, o.width || 200, 0], Object.assign({ stroke: '#000', strokeWidth: 4 }, base));
        else return null;
        if (o.fill && typeof o.fill === 'object') obj.set('fill', fill(o.fill, obj.width || (o.radius || 0) * 2, obj.height || (o.radius || 0) * 2));
        obj.id = uid();
        return obj;
      }
      function setBg(def) {
        st.bg = def;
        if (!cv) return;
        if (def.type === 'solid') cv.setBackgroundColor(def.color, () => cv.requestRenderAll());
        else cv.setBackgroundColor(fill({ type: def.type === 'radial' ? 'radial' : 'linear', colors: def.colors, angle: def.angle }, st.w, st.h), () => cv.requestRenderAll());
      }
      function applyTemplate(tid, keepBg) {
        const tpl = T(st.w, st.h).find((t) => t.id === tid) || T(st.w, st.h)[0];
        cv.clear(); if (!keepBg) setBg(tpl.bg);
        tpl.objs.forEach((o) => { const obj = build(o); if (obj) cv.add(obj); });
        cv.discardActiveObject(); cv.requestRenderAll(); snap(); paintInspector(); renderPages();
      }
      function newDesign(w, h, tid) {
        st.w = w; st.h = h; st.pages = [{ json: null }]; st.cur = 0; st.hist = []; st.fut = []; st.id = null;
        cv.setDimensions({ width: w, height: h });
        applyTemplate(tid || 'blank'); fit(); updateSize();
      }
      function updateSize() { B.$('.ds-size', sizeB).textContent = st.w + '×' + st.h; }
      function json() { return cv.toJSON(EXTRA); }
      function snap() {
        if (st.lock || !cv) return;
        st.hist.push(JSON.stringify(json())); if (st.hist.length > 60) st.hist.shift(); st.fut = [];
        st.pages[st.cur].json = st.hist[st.hist.length - 1];
        renderPagesSoon();
      }
      function restore(s) { st.lock = true; cv.loadFromJSON(JSON.parse(s), () => { st.lock = false; cv.requestRenderAll(); paintInspector(); st.pages[st.cur].json = s; renderPagesSoon(); }); }
      function undo() { if (st.hist.length < 2) return; st.fut.push(st.hist.pop()); restore(st.hist[st.hist.length - 1]); }
      function redo() { if (!st.fut.length) return; const s = st.fut.pop(); st.hist.push(s); restore(s); }
      function setZoom(z) {
        if (!cv) return;
        st.zoom = B.clamp(z, 0.05, 4);
        cv.setZoom(st.zoom); cv.setDimensions({ width: st.w * st.zoom, height: st.h * st.zoom });
        zoomLbl.textContent = Math.round(st.zoom * 100) + '%';
        pageHost.style.width = st.w * st.zoom + 'px'; pageHost.style.height = st.h * st.zoom + 'px';
      }
      function fit() { const r = stage.getBoundingClientRect(); const z = Math.min((r.width - 80) / st.w, (r.height - 80) / st.h); setZoom(z > 0 ? z : 0.4); }
      new ResizeObserver(B.debounce(() => { if (cv && el.offsetParent) fit(); }, 150)).observe(stage);
      function add(obj, center = true) {
        if (center) { obj.set({ left: (st.w - obj.getScaledWidth()) / 2, top: (st.h - obj.getScaledHeight()) / 2 }); }
        if (!obj.id) obj.id = uid();
        cv.add(obj); cv.setActiveObject(obj); cv.requestRenderAll(); snap(); paintInspector();
        obj.animate && popIn(obj);
        return obj;
      }
      function popIn(obj) { const sx = obj.scaleX, sy = obj.scaleY, op = obj.opacity ?? 1; obj.set({ opacity: 0 }); obj.animate('opacity', op, { duration: 260, onChange: cv.requestRenderAll.bind(cv) }); obj.set({ scaleX: sx * 0.9, scaleY: sy * 0.9 }); obj.animate({ scaleX: sx, scaleY: sy }, { duration: 320, easing: window.fabric.util.ease.easeOutBack, onChange: cv.requestRenderAll.bind(cv) }); }
      const S = () => Math.min(st.w, st.h) / 1080;
      function addText(kind) {
        const f = window.fabric; const s = S();
        const presets = { h: ['Aggiungi un titolo', 96, 'Bricolage Grotesque', 800], s: ['Aggiungi un sottotitolo', 54, 'Figtree', 600], b: ['Aggiungi un po’ di testo per il corpo', 32, 'Figtree', 400] };
        const [t, size, fam, wt] = presets[kind] || presets.b;
        const tb = new f.Textbox(t, { width: st.w * 0.7, fontSize: size * s, fontFamily: fam, fontWeight: wt, fill: darkBg() ? '#fffaf1' : '#1a0f08', textAlign: 'center', lineHeight: 1.15 });
        B.loadFont(fam).then(() => { tb.initDimensions(); cv.requestRenderAll(); });
        add(tb);
      }
      function addCombo(c) {
        const f = window.fabric, s = S(), dark = darkBg(), col = dark ? '#fffaf1' : '#1a0f08';
        const a = new f.Textbox(c[0], { width: st.w * 0.7, fontSize: c[2] * s, fontFamily: c[1], fill: col, textAlign: 'center', fontWeight: c[3] || 400, lineHeight: 1 });
        const b = new f.Textbox(c[4], { width: st.w * 0.7, top: a.height + 16 * s, fontSize: c[6] * s, fontFamily: c[5], fill: '#c98a2e', textAlign: 'center', fontWeight: 700, charSpacing: 300 });
        Promise.all([B.loadFont(c[1]), B.loadFont(c[5])]).then(() => { a.initDimensions(); b.initDimensions(); b.set('top', a.height + 16 * s); g.addWithUpdate(); cv.requestRenderAll(); });
        const g = new f.Group([a, b], {}); add(g);
      }
      function darkBg() { const b = st.bg; const c = b ? (b.type === 'solid' ? b.color : b.colors[0]) : '#fff'; const [r, g, bl] = B.hexToRgb(c); return (r * 299 + g * 587 + bl * 114) / 1000 < 140; }
      function addShape(kind) {
        const f = window.fabric, s = S(), c = '#c98a2e', size = 300 * s;
        let o;
        if (kind === 'rect') o = new f.Rect({ width: size, height: size, fill: c });
        else if (kind === 'round') o = new f.Rect({ width: size * 1.3, height: size, rx: 40 * s, ry: 40 * s, fill: c });
        else if (kind === 'circle') o = new f.Circle({ radius: size / 2, fill: c });
        else if (kind === 'triangle') o = new f.Triangle({ width: size, height: size * 0.9, fill: c });
        else if (kind === 'line') o = new f.Line([0, 0, size * 1.6, 0], { stroke: '#1a0f08', strokeWidth: 6 * s, strokeLineCap: 'round' });
        else if (kind === 'dash') o = new f.Line([0, 0, size * 1.6, 0], { stroke: '#1a0f08', strokeWidth: 6 * s, strokeDashArray: [18 * s, 14 * s], strokeLineCap: 'round' });
        else if (kind === 'ring') o = new f.Circle({ radius: size / 2, fill: '', stroke: '#e3a94a', strokeWidth: 14 * s });
        else {
          const paths = {
            star: 'M50 3 L62 38 L98 38 L69 59 L80 95 L50 73 L20 95 L31 59 L2 38 L38 38 Z',
            heart: 'M50 88 C20 66 2 48 2 28 C2 13 14 3 28 3 C38 3 46 9 50 17 C54 9 62 3 72 3 C86 3 98 13 98 28 C98 48 80 66 50 88 Z',
            arrow: 'M2 38 L62 38 L62 14 L98 50 L62 86 L62 62 L2 62 Z',
            hex: 'M25 4 L75 4 L98 50 L75 96 L25 96 L2 50 Z',
            bubble: 'M10 6 H90 Q98 6 98 14 V60 Q98 68 90 68 H40 L20 90 L24 68 H10 Q2 68 2 60 V14 Q2 6 10 6 Z',
            blob: 'M60 4 C80 6 98 22 96 46 C94 70 78 96 50 96 C22 96 4 78 4 52 C4 26 30 2 60 4 Z',
            burst: 'M50 0 L58 30 L88 12 L70 42 L100 50 L70 58 L88 88 L58 70 L50 100 L42 70 L12 88 L30 58 L0 50 L30 42 L12 12 L42 30 Z',
            eye: 'M2 50 Q50 -6 98 50 Q50 106 2 50 Z'
          };
          o = new f.Path(paths[kind] || paths.star, { fill: c, scaleX: size / 100, scaleY: size / 100 });
        }
        o.bxType = kind; add(o);
      }
      function addIcon(name) {
        const f = window.fabric, svg = B.iconSVG(name, 24, 2, darkBg() ? '#f3d088' : '#3b2314');
        f.loadSVGFromString(svg, (objs, opts) => {
          const g = f.util.groupSVGElements(objs, opts); const s = 240 * S() / 24;
          g.set({ scaleX: s, scaleY: s }); g.bxType = 'icon'; g.bxIcon = name; add(g);
        });
      }
      function addSticker(ch) { const f = window.fabric; add(new f.Text(ch, { fontSize: 200 * S(), fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif' })); }
      async function addImage(src, opts = {}) {
        const f = window.fabric;
        return new Promise((res) => f.Image.fromURL(src, (img) => {
          if (!img || !img.width) { B.toast('Immagine non valida', 'err'); return res(null); }
          const sc = Math.min(st.w * 0.7 / img.width, st.h * 0.7 / img.height, 1.5);
          img.set({ scaleX: sc, scaleY: sc }); if (opts.prompt) img.bxPrompt = opts.prompt;
          if (opts.replace) { const r = opts.replace; img.set({ left: r.left, top: r.top, angle: r.angle }); const s2 = Math.max(r.getScaledWidth() / img.width, r.getScaledHeight() / img.height); img.set({ scaleX: s2, scaleY: s2 }); if (r.clipPath) img.clipPath = r.clipPath.type === 'circle' ? new window.fabric.Circle({ radius: r.clipPath.radius * (r.scaleX || 1) / s2, originX: 'center', originY: 'center' }) : r.clipPath; const idx = cv.getObjects().indexOf(r); cv.remove(r); if (idx >= 0) cv.insertAt(img, idx); else cv.add(img); cv.setActiveObject(img); snap(); }
          else add(img);
          res(img);
        }, { crossOrigin: 'anonymous' }));
      }
      function svgToCanvas(svg) {
        const f = window.fabric;
        f.loadSVGFromString(svg, (objs, opts) => { const g = f.util.groupSVGElements(objs, opts); const sc = Math.min(st.w * 0.8 / (g.width || 1), st.h * 0.8 / (g.height || 1)); g.set({ scaleX: sc, scaleY: sc }); g.bxType = 'svg'; add(g); });
      }

      /* ---------- guides ---------- */
      function guides(e) {
        const o = e.target, z = st.zoom, tol = 8 / z;
        const c = o.getCenterPoint(); st.guide = {};
        if (Math.abs(c.x - st.w / 2) < tol) { o.setPositionByOrigin(new window.fabric.Point(st.w / 2, c.y), 'center', 'center'); st.guide.v = true; }
        const c2 = o.getCenterPoint();
        if (Math.abs(c2.y - st.h / 2) < tol) { o.setPositionByOrigin(new window.fabric.Point(c2.x, st.h / 2), 'center', 'center'); st.guide.h = true; }
      }
      function drawGuides() {
        if (!cv || !cv.contextTop) return;
        const ctx = cv.contextTop;
        if (!st.guide || (!st.guide.v && !st.guide.h)) { if (st.guideDrawn) { cv.clearContext(ctx); st.guideDrawn = false; } return; }
        cv.clearContext(ctx); st.guideDrawn = true;
        const z = st.zoom; ctx.save(); ctx.strokeStyle = '#e3a94a'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1;
        if (st.guide.v) { ctx.beginPath(); ctx.moveTo(st.w / 2 * z, 0); ctx.lineTo(st.w / 2 * z, st.h * z); ctx.stroke(); }
        if (st.guide.h) { ctx.beginPath(); ctx.moveTo(0, st.h / 2 * z); ctx.lineTo(st.w * z, st.h / 2 * z); ctx.stroke(); }
        ctx.restore();
      }

      /* ---------- pages ---------- */
      const renderPagesSoon = B.debounce(renderPages, 400);
      async function renderPages() {
        if (!cv) return;
        pagesBar.innerHTML = '';
        st.pages.forEach((p, i) => {
          const th = B.h('button', { class: 'ds-pg' + (i === st.cur ? ' on' : ''), type: 'button', 'aria-label': 'Pagina ' + (i + 1), onclick: () => goPage(i), oncontextmenu: (e) => { e.preventDefault(); pageMenu(i, { x: e.clientX, y: e.clientY }); } });
          th.style.aspectRatio = st.w + '/' + st.h;
          th.append(B.h('span', { class: 'ds-pg-n', text: i + 1 }));
          pagesBar.append(th);
          thumbOf(i).then((url) => { if (url) th.style.backgroundImage = 'url(' + url + ')'; });
        });
        pagesBar.append(B.h('button', { class: 'ds-pg add', type: 'button', 'aria-label': 'Aggiungi pagina', 'data-tip': 'Aggiungi pagina', onclick: () => addPage() }, B.h('span', { 'data-i': 'Plus' })));
        B.hydrateIcons(pagesBar);
      }
      function thumbOf(i) {
        return new Promise((res) => {
          if (i === st.cur) return res(cv.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: 160 / (st.w * st.zoom) }));
          const j = st.pages[i].json; if (!j) return res(null);
          const tmp = document.createElement('canvas'); const sc = new window.fabric.StaticCanvas(tmp, { width: st.w, height: st.h });
          sc.loadFromJSON(JSON.parse(j), () => { const u = sc.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: 160 / st.w }); sc.dispose(); res(u); });
        });
      }
      function goPage(i) {
        if (i === st.cur) return;
        st.pages[st.cur].json = JSON.stringify(json());
        st.cur = i; st.hist = []; st.fut = [];
        const j = st.pages[i].json;
        if (j) restore(j); else { cv.clear(); setBg({ type: 'solid', color: '#ffffff' }); snap(); }
        if (j) st.hist.push(j);
        renderPages(); paintInspector();
      }
      function addPage(dup) {
        st.pages[st.cur].json = JSON.stringify(json());
        st.pages.splice(st.cur + 1, 0, { json: dup ? st.pages[st.cur].json : null });
        goPage(st.cur + 1);
        if (!dup) { setBg(st.bg && st.bg.type ? st.bg : { type: 'solid', color: '#ffffff' }); snap(); }
      }
      function pageMenu(i, at) {
        B.menu(at, [{ label: 'Duplica pagina', icon: 'Copy', fn: () => { goPage(i); addPage(true); } },
          { label: 'Elimina pagina', icon: 'Trash2', fn: () => { if (st.pages.length < 2) return; st.pages.splice(i, 1); st.cur = Math.min(st.cur, st.pages.length - 1); const j = st.pages[st.cur].json; st.hist = j ? [j] : []; if (j) restore(j); renderPages(); } }]);
      }

      /* ---------- panels ---------- */
      function openPanel(k) {
        st.panel = k; drawer.classList.remove('closed');
        B.$$('.rail-btn', rail).forEach((b) => b.classList.toggle('on', b.dataset.p === k));
        const title = (PANELS.find((p) => p[0] === k) || [0, ''])[1];
        B.$('h3', dHead).textContent = title; dBody.innerHTML = '';
        ({ templates: pTemplates, elements: pElements, text: pText, photos: pPhotos, bg: pBg, brand: pBrand, magic: pMagic, layers: pLayers })[k]();
        B.hydrateIcons(drawer);
      }
      function pTemplates() {
        dBody.append(B.h('p', { class: 'mini-note', text: 'I modelli si adattano al formato del design (' + st.w + '×' + st.h + '). Cliccane uno per sostituire la pagina corrente.' }));
        const g = B.h('div', { class: 'tile-grid' });
        T(st.w, st.h).forEach((t) => {
          const tile = B.h('button', { class: 'tile', type: 'button', style: { aspectRatio: st.w + '/' + st.h }, onclick: () => { applyTemplate(t.id); } }, B.h('span', { class: 'tile-lbl', text: t.name }));
          g.append(tile);
          tplThumb(t).then((u) => { if (u) { tile.style.backgroundImage = 'url(' + u + ')'; tile.style.backgroundSize = 'cover'; } });
        });
        dBody.append(g);
      }
      const tplCache = {};
      function tplThumb(t) {
        const key = t.id + st.w + 'x' + st.h; if (tplCache[key]) return Promise.resolve(tplCache[key]);
        return new Promise((res) => {
          const f = window.fabric; if (!f) return res(null);
          const tmp = document.createElement('canvas'); const sc = new f.StaticCanvas(tmp, { width: st.w, height: st.h });
          const bg = t.bg; sc.setBackgroundColor(bg.type === 'solid' ? bg.color : fill({ type: bg.type === 'radial' ? 'radial' : 'linear', colors: bg.colors, angle: bg.angle }, st.w, st.h), () => {});
          const fams = new Set(); t.objs.forEach((o) => { const ob = build(o); if (ob) sc.add(ob); if (o.fontFamily) fams.add(o.fontFamily); });
          Promise.all([...fams].map((fm) => B.loadFont(fm))).then(() => { sc.getObjects().forEach((o) => o.initDimensions && o.initDimensions()); sc.renderAll(); const u = sc.toDataURL({ format: 'jpeg', quality: 0.75, multiplier: 240 / st.w }); tplCache[key] = u; sc.dispose(); res(u); });
        });
      }
      function pElements() {
        const sec = (t) => dBody.append(B.h('div', { class: 'lbl', text: t }));
        sec('Forme');
        const g = B.h('div', { class: 'tile-grid three' });
        [['rect', 'Square'], ['round', 'Square'], ['circle', 'Circle'], ['triangle', 'Triangle'], ['star', 'Star'], ['heart', 'Heart'], ['hex', 'Hexagon'], ['arrow', 'ArrowRight'], ['bubble', 'MessageSquare'], ['blob', 'Circle'], ['burst', 'Sparkle'], ['eye', 'Eye'], ['ring', 'CircleDot'], ['line', 'Minus'], ['dash', 'Minus']].forEach(([k, ic]) => g.append(B.h('button', { class: 'tile', type: 'button', 'data-tip': k, onclick: () => addShape(k) }, B.h('span', { 'data-i': ic, 'data-size': 30 }))));
        dBody.append(g);
        sec('Adesivi');
        const s = B.h('div', { class: 'tile-grid', style: 'grid-template-columns:repeat(6,1fr)' });
        STICKERS.forEach((e) => s.append(B.h('button', { class: 'tile', type: 'button', style: 'font-size:24px', onclick: () => addSticker(e) }, e)));
        dBody.append(s);
        sec('Icone');
        const q = B.h('input', { class: 'input sm', placeholder: 'Cerca tra ' + B.iconNames.length + ' icone (in inglese)', id: 'dsIconQ' });
        const ig = B.h('div', { class: 'tile-grid', style: 'grid-template-columns:repeat(5,1fr)' });
        const paint = () => { ig.innerHTML = ''; B.iconNames.filter((n) => !q.value || n.toLowerCase().includes(q.value.toLowerCase())).slice(0, 150).forEach((n) => ig.append(B.h('button', { class: 'tile', type: 'button', 'data-tip': n, onclick: () => addIcon(n) }, B.h('span', { 'data-i': n, 'data-size': 22 })))); B.hydrateIcons(ig); };
        q.addEventListener('input', B.debounce(paint, 150)); dBody.append(q, ig); paint();
      }
      function pText() {
        dBody.append(B.h('button', { class: 'btn block lg', type: 'button', style: 'justify-content:flex-start;font:800 22px var(--f-display)', onclick: () => addText('h') }, 'Aggiungi un titolo'));
        dBody.append(B.h('button', { class: 'btn block', type: 'button', style: 'justify-content:flex-start;font-weight:650;height:44px', onclick: () => addText('s') }, 'Aggiungi un sottotitolo'));
        dBody.append(B.h('button', { class: 'btn block sm', type: 'button', style: 'justify-content:flex-start', onclick: () => addText('b') }, 'Aggiungi testo per il corpo'));
        dBody.append(B.h('div', { class: 'lbl', text: 'Abbinamenti di font' }));
        const combos = [['Grand Opening', 'Playfair Display', 90, 700, 'DAL 12 MAGGIO', 'Figtree', 26], ['Dolce Vita', 'Great Vibes', 110, 400, 'PASTICCERIA', 'Cinzel', 28], ['MEGA SALE', 'Anton', 120, 400, 'SOLO OGGI', 'Figtree', 30], ['Nuovo episodio', 'Bricolage Grotesque', 96, 800, 'PODCAST', 'JetBrains Mono', 24], ['Wedding', 'Instrument Serif', 110, 400, 'SAVE THE DATE', 'Montserrat', 24], ['Game Night', 'Bungee', 90, 400, 'VENERDÌ 21:00', 'Orbitron', 24]];
        const g = B.h('div', { class: 'tile-grid' });
        combos.forEach((c) => { B.loadFont(c[1]); g.append(B.h('button', { class: 'tile wide', type: 'button', onclick: () => addCombo(c), style: 'flex-direction:column;gap:4px;display:flex' }, B.h('span', { style: 'font-family:"' + c[1] + '";font-size:20px;line-height:1;color:var(--text)', text: c[0] }), B.h('span', { style: 'font-family:"' + c[5] + '";font-size:9px;letter-spacing:.2em;color:var(--gold)', text: c[4] }))); });
        dBody.append(g);
      }
      async function pPhotos() {
        const up = B.h('div', { class: 'dropzone' }, B.h('span', { 'data-i': 'Upload' }), B.h('b', { text: 'Carica immagini' }), B.h('small', { text: 'o trascinale sulla tela' }));
        up.addEventListener('click', async () => { for (const f of await B.pickFiles('image/*', true)) await addImage(await B.blobToDataURL(f)); });
        dBody.append(up);
        const ai = B.h('div', { class: 'ai-box' });
        const p = B.h('textarea', { class: 'textarea', id: 'dsImgP', placeholder: 'Genera un’immagine: es. “chicchi di caffè su sfondo scuro, luce calda”' });
        const engSel = B.h('select', { class: 'select sm', id: 'dsImgE' }, B.ai.imageEngines().map((e) => B.h('option', { value: e.id }, e.label + ' · ' + e.sub.split(' · ')[0])));
        const go = B.h('button', { class: 'btn gold block', type: 'button', onclick: async () => {
          if (!p.value.trim()) return;
          go.disabled = true; go.innerHTML = '<span class="spin"></span> Genero…';
          try { const raster = /^(iris|web)/.test(engSel.value); const r = await B.ai.image(p.value.trim(), { engine: engSel.value, w: 1024, h: 1024, style: raster ? 'photo' : 'none', onStep: (s) => { if (s.status === 'run') { go.innerHTML = '<span class="spin"></span> '; go.append(document.createTextNode(s.label.split(' (')[0] + (s.detail && s.id !== 'plan' ? ' · ' + s.detail.split(' · ')[0] : '') + '…')); } } }); B.gallery.add({ blob: r.blob, prompt: p.value.trim(), engine: r.engine, kind: r.kind, svg: r.svg, w: 1024, h: 1024 }); if (r.svg) svgToCanvas(r.svg); else await addImage(await B.blobToDataURL(r.blob), { prompt: p.value.trim() }); }
          catch (e) { B.err(e); }
          go.disabled = false; go.innerHTML = ''; go.append(B.h('span', { 'data-i': 'Sparkles' }), 'Genera e inserisci'); B.hydrateIcons(go);
        } }, B.h('span', { 'data-i': 'Sparkles' }), 'Genera e inserisci');
        ai.append(B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': 'Sparkles' }), 'Immagine con Iris'), p, engSel, go);
        dBody.append(ai);
        const list = await B.gallery.list();
        if (list.length) {
          dBody.append(B.h('div', { class: 'lbl', text: 'Dalla tua galleria' }));
          const g = B.h('div', { class: 'tile-grid' });
          list.slice(0, 40).forEach((it) => { if (!it.blob) return; const u = URL.createObjectURL(it.blob); g.append(B.h('button', { class: 'tile', type: 'button', style: { backgroundImage: 'url(' + u + ')', backgroundSize: 'cover' }, onclick: async () => { if (it.svg) svgToCanvas(it.svg); else addImage(await B.blobToDataURL(it.blob), { prompt: it.prompt }); } })); });
          dBody.append(g);
        }
        B.hydrateIcons(dBody);
      }
      function pBg() {
        dBody.append(B.h('div', { class: 'lbl', text: 'Colore' }));
        const sw = B.h('div', { class: 'swatches' });
        SWATCHES.forEach((c) => sw.append(B.h('button', { class: 'sw', type: 'button', style: { background: c }, 'aria-label': c, onclick: () => { setBg({ type: 'solid', color: c }); snap(); } })));
        const pick = B.h('input', { type: 'color', class: 'swatch-in', value: '#ffffff', 'aria-label': 'Colore personalizzato' });
        pick.addEventListener('input', () => { setBg({ type: 'solid', color: pick.value }); }); pick.addEventListener('change', snap);
        dBody.append(sw, B.h('div', { class: 'row' }, pick, B.h('span', { class: 'mini-note', text: 'Colore personalizzato' })));
        dBody.append(B.h('div', { class: 'lbl', text: 'Gradienti' }));
        const gg = B.h('div', { class: 'tile-grid three' });
        [['#1a0f08', '#7a3d16'], ['#f3d088', '#a8642a'], ['#2b0f1a', '#d9603b'], ['#050302', '#3b2314'], ['#f6eee2', '#d9b48f'], ['#120a06', '#e3a94a'], ['#7a2e3a', '#f2a65a'], ['#1f3a5f', '#0b0705'], ['#fffaf1', '#f3d088']].forEach((c) => gg.append(B.h('button', { class: 'tile', type: 'button', style: { background: 'linear-gradient(160deg,' + c[0] + ',' + c[1] + ')' }, onclick: () => { setBg({ type: 'linear', colors: c, angle: 160 }); snap(); } })));
        [['#f3d088', '#a8642a', '#3b2314'], ['#e3a94a', '#4a2c1a', '#0b0705']].forEach((c) => gg.append(B.h('button', { class: 'tile', type: 'button', style: { background: 'radial-gradient(circle,' + c.join(',') + ')' }, onclick: () => { setBg({ type: 'radial', colors: c }); snap(); } })));
        dBody.append(gg);
        dBody.append(B.h('div', { class: 'lbl', text: 'Immagine di sfondo' }));
        dBody.append(B.h('button', { class: 'btn block', type: 'button', onclick: async () => { const [f] = await B.pickFiles('image/*'); if (!f) return; const img = await addImage(await B.blobToDataURL(f)); if (img) fillPage(img); } }, B.h('span', { 'data-i': 'Upload' }), 'Carica e riempi la pagina'));
      }
      function fillPage(img) { const s = Math.max(st.w / img.width, st.h / img.height); img.set({ scaleX: s, scaleY: s, left: (st.w - img.width * s) / 2, top: (st.h - img.height * s) / 2 }); cv.sendToBack(img); img.setCoords(); cv.requestRenderAll(); snap(); }
      function pBrand() {
        dBody.append(B.h('p', { class: 'mini-note', text: 'Applica una palette a tutto il design: Iris ricolora sfondo, testi e forme mantenendo il contrasto.' }));
        PALETTES.forEach(([n, cols]) => dBody.append(B.h('button', { class: 'pal', type: 'button', onclick: () => applyPalette(cols) }, B.h('span', { class: 'pal-n', text: n }), B.h('span', { class: 'pal-c' }, cols.map((c) => B.h('i', { style: { background: c } }))))));
        const gen = B.h('div', { class: 'ai-box' });
        const p = B.h('input', { class: 'input sm', id: 'dsPalP', placeholder: 'es. “bosco autunnale”, “caffè e panna”' });
        const go = B.h('button', { class: 'btn gold sm', type: 'button', onclick: async () => { if (!p.value.trim()) return; go.disabled = true; try { const r = await B.ai.json('Crea una palette di 6 colori HEX ordinati dal più scuro al più chiaro ispirata a: "' + p.value + '". Rispondi solo con JSON: {"name":"nome","colors":["#..."]}', { system: false, tier: 'quick' }); if (r && r.colors) { PALETTES.unshift([r.name || p.value, r.colors.slice(0, 6)]); openPanel('brand'); } } catch (e) { B.err(e); } go.disabled = false; } }, 'Crea');
        gen.append(B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': 'Sparkles' }), 'Palette con Iris'), B.h('div', { class: 'row' }, p, go));
        dBody.append(gen);
      }
      function applyPalette(cols) {
        const sorted = cols.slice().sort((a, b) => lum(a) - lum(b));
        const dark = sorted[0], light = sorted[sorted.length - 1], accents = sorted.slice(1, -1);
        const bgDark = darkBg();
        setBg(st.bg && st.bg.type !== 'solid' ? { type: st.bg.type, colors: bgDark ? [dark, sorted[1]] : [light, sorted[sorted.length - 2]], angle: st.bg.angle } : { type: 'solid', color: bgDark ? dark : light });
        let k = 0;
        cv.getObjects().forEach((o) => {
          if (o.type === 'image') return;
          if (o.type === 'textbox' || o.type === 'text' || o.type === 'i-text') { const isAccent = (o.fontSize || 0) < 34 * S() && k++ % 2 === 0; o.set('fill', isAccent ? accents[accents.length - 1] : bgDark ? light : dark); }
          else if (typeof o.fill === 'string' && o.fill) o.set('fill', accents[(k++) % accents.length]);
          if (o.stroke && typeof o.stroke === 'string') o.set('stroke', accents[accents.length - 1]);
        });
        cv.requestRenderAll(); snap(); B.toast('Palette applicata', 'ok');
      }
      function lum(c) { const [r, g, b] = B.hexToRgb(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
      function pLayers() {
        const objs = cv.getObjects().slice().reverse();
        if (!objs.length) { dBody.append(B.h('div', { class: 'empty', text: 'La pagina è vuota' })); return; }
        const list = B.h('div', { class: 'layer-list' });
        objs.forEach((o) => {
          const label = o.type === 'textbox' || o.type === 'text' ? '“' + String(o.text).slice(0, 26) + '”' : o.type === 'image' ? 'Immagine' : o.bxType ? 'Forma: ' + o.bxType : o.type;
          const row = B.h('div', { class: 'layer' + (cv.getActiveObjects().includes(o) ? ' on' : ''), onclick: () => { cv.setActiveObject(o); cv.requestRenderAll(); paintInspector(); pLayersRefresh(); } },
            B.h('span', { 'data-i': o.type === 'image' ? 'Image' : /text/.test(o.type) ? 'Type' : 'Shapes' }), B.h('span', { class: 'layer-n', text: label }),
            B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': o.visible === false ? 'Mostra' : 'Nascondi', 'data-i': o.visible === false ? 'EyeOff' : 'Eye', onclick: (e) => { e.stopPropagation(); o.visible = o.visible === false; cv.requestRenderAll(); snap(); pLayersRefresh(); } }),
            B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': o.locked ? 'Sblocca' : 'Blocca', 'data-i': o.locked ? 'Lock' : 'Unlock', onclick: (e) => { e.stopPropagation(); setLock(o, !o.locked); pLayersRefresh(); } }));
          list.append(row);
        });
        dBody.append(list);
      }
      function pLayersRefresh() { if (st.panel === 'layers' && !drawer.classList.contains('closed')) { dBody.innerHTML = ''; pLayers(); B.hydrateIcons(dBody); } }
      function setLock(o, v) { o.locked = v; o.set({ lockMovementX: v, lockMovementY: v, lockScalingX: v, lockScalingY: v, lockRotation: v, hasControls: !v, editable: !v }); cv.requestRenderAll(); snap(); paintInspector(); }

      /* ---------- Magic (AI) ---------- */
      function pMagic() {
        const box = B.h('div', { class: 'ai-box' });
        const p = B.h('textarea', { class: 'textarea', id: 'dsMagicP', placeholder: 'Descrivi il design: es. “post per l’apertura di una gelateria artigianale a Napoli, colori pastello, tono allegro”' });
        const imgs = B.h('label', { class: 'row', style: 'gap:8px;font-size:13px' }, B.h('span', { class: 'switch' }, B.h('input', { type: 'checkbox', id: 'dsMagicImg', checked: true }), B.h('span')), 'Genera anche le immagini');
        const go = B.h('button', { class: 'btn gold block', type: 'button', onclick: () => magicDesign(p.value.trim(), go) }, B.h('span', { 'data-i': 'Wand2' }), 'Magic Design');
        box.append(B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': 'Wand2' }), 'Magic Design'), B.h('p', { class: 'mini-note', text: 'Iris impagina testi, colori, forme e immagini per il formato ' + st.w + '×' + st.h + '. Ogni elemento resta modificabile.' }), p, imgs, go);
        dBody.append(box);
        // agent
        const ag = B.h('div', { class: 'ai-box' });
        const log = B.h('div', { class: 'agent-log' });
        const q = B.h('input', { class: 'input sm', id: 'dsAgentQ', placeholder: 'es. “rendi il titolo più grande e dorato”' });
        const send = B.h('button', { class: 'btn gold sm icon', type: 'button', 'aria-label': 'Invia', 'data-i': 'Send', onclick: () => agent(q, log, send) });
        q.addEventListener('keydown', (e) => { if (e.key === 'Enter') agent(q, log, send); });
        ag.append(B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': 'Bot' }), 'Assistente di design'), B.h('p', { class: 'mini-note', text: 'Chiedi modifiche a parole: Iris sposta, ricolora, riscrive e aggiunge elementi per te.' }), log, B.h('div', { class: 'row' }, q, send));
        ['Rendi il design più elegante', 'Traduci i testi in inglese', 'Aggiungi un bottone “Prenota ora”', 'Usa colori più caldi'].forEach((s) => log.append(B.h('button', { class: 'chip', type: 'button', onclick: () => { q.value = s; agent(q, log, send); } }, s)));
        dBody.append(ag);
        // magic write
        const mw = B.h('div', { class: 'ai-box' });
        mw.append(B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': 'Feather' }), 'Magic Write'), B.h('p', { class: 'mini-note', text: 'Seleziona un testo sulla tela, poi scegli come riscriverlo.' }));
        const ch = B.h('div', { class: 'chips' });
        [['Più accattivante', 'rendilo più accattivante e d’impatto'], ['Più breve', 'accorcialo mantenendo il senso'], ['Più formale', 'rendilo più formale e professionale'], ['Divertente', 'rendilo più divertente e informale'], ['Correggi', 'correggi grammatica e punteggiatura'], ['Inglese', 'traducilo in inglese'], ['Con emoji', 'aggiungi 1-2 emoji adatte']].forEach(([l, ins]) => ch.append(B.h('button', { class: 'chip', type: 'button', onclick: () => magicWrite(ins) }, l)));
        mw.append(ch); dBody.append(mw);
      }
      async function magicWrite(ins) {
        const o = cv.getActiveObject();
        if (!o || !/text/.test(o.type)) return B.toast('Seleziona prima un testo sulla tela');
        try { const t = await B.ai.text('Riscrivi questo testo per un design grafico: ' + ins + '. Rispondi solo con il nuovo testo, senza virgolette.\n\nTesto: ' + o.text, { system: false, tier: 'quick' }); o.set('text', t.trim().replace(/^["“]|["”]$/g, '')); cv.requestRenderAll(); snap(); } catch (e) { B.err(e); }
      }
      function describe() {
        return cv.getObjects().map((o) => {
          const d = { id: o.id, type: o.type === 'textbox' || o.type === 'text' ? 'text' : o.type === 'image' ? 'image' : 'shape', x: Math.round(o.left), y: Math.round(o.top), w: Math.round(o.getScaledWidth()), h: Math.round(o.getScaledHeight()) };
          if (d.type === 'text') Object.assign(d, { text: o.text, fontSize: Math.round(o.fontSize * (o.scaleY || 1)), fontFamily: o.fontFamily, fill: typeof o.fill === 'string' ? o.fill : 'gradiente', fontWeight: o.fontWeight, textAlign: o.textAlign });
          else if (d.type === 'shape') Object.assign(d, { shape: o.bxType || o.type, fill: typeof o.fill === 'string' ? o.fill : 'gradiente', opacity: o.opacity });
          return d;
        });
      }
      const LAYOUT_SPEC = 'Coordinate in pixel nella tela {W}×{H} (origine in alto a sinistra). Elementi ammessi:\n- {"type":"text","text":"...","x":n,"y":n,"w":n,"fontSize":n,"fontFamily":"uno tra: ' + FONTS.map((f) => f[0]).join(', ') + '","fontWeight":400|600|700|800,"italic":bool,"color":"#hex","align":"left|center|right","letterSpacing":n (0-600),"lineHeight":n,"uppercase":bool}\n- {"type":"rect","x":n,"y":n,"w":n,"h":n,"color":"#hex","radius":n,"opacity":0-1,"stroke":"#hex","strokeWidth":n}\n- {"type":"circle","x":n,"y":n,"r":n,"color":"#hex","opacity":0-1,"stroke":"#hex","strokeWidth":n}\n- {"type":"line","x":n,"y":n,"w":n,"color":"#hex","strokeWidth":n}\n- {"type":"image","x":n,"y":n,"w":n,"h":n,"prompt":"descrizione in inglese della foto","shape":"rect|circle|rounded"}\n- {"type":"icon","name":"una icona Lucide in PascalCase (es. Coffee, Heart, Star, MapPin, Phone, Calendar, Sparkles)","x":n,"y":n,"size":n,"color":"#hex"}';
      async function magicDesign(prompt, btn) {
        if (!prompt) return B.toast('Descrivi il design che vuoi');
        btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Iris impagina…';
        try {
          const spec = LAYOUT_SPEC.replace('{W}', st.w).replace('{H}', st.h);
          const r = await B.ai.json('Sei un art director di livello mondiale. Progetta un design grafico per: "' + prompt + '".\nTela: ' + st.w + '×' + st.h + ' px.\nRispondi SOLO con JSON: {"background":{"type":"solid|linear|radial","colors":["#hex",...],"angle":gradi},"elements":[...]}\n' + spec + '\nRegole: i testi non devono MAI sovrapporsi tra loro (la y di ogni testo deve essere maggiore della y del testo precedente più fontSize × numero di righe × lineHeight più uno spazio); gerarchia tipografica forte (un titolo grande), margini di almeno il 7% della larghezza, tutti i testi scritti in ' + (/[àèéìòù]|\b(il|lo|la|per|con|una|di|che|del|della)\b/i.test(prompt) ? 'italiano' : 'nella lingua della richiesta') + ', contrasto leggibile, massimo 12 elementi, al massimo 2 immagini, composizione bilanciata e moderna. Ordina gli elementi dal fondo al primo piano.', { system: false, tier: 'complex' });
          await renderLayout(r, B.$('#dsMagicImg') ? B.$('#dsMagicImg').checked : true);
          B.toast('Design creato. Ogni elemento è modificabile.', 'ok');
        } catch (e) { B.err(e); }
        btn.disabled = false; btn.innerHTML = ''; btn.append(B.h('span', { 'data-i': 'Wand2' }), 'Magic Design'); B.hydrateIcons(btn);
      }
      function elementToObj(e) {
        const f = window.fabric;
        if (e.type === 'text') {
          const tb = new f.Textbox(e.uppercase ? String(e.text || '').toUpperCase() : String(e.text || ''), { left: +e.x || 0, top: +e.y || 0, width: +e.w || st.w * 0.8, fontSize: +e.fontSize || 48, fontFamily: e.fontFamily || 'Figtree', fontWeight: e.fontWeight || 400, fontStyle: e.italic ? 'italic' : 'normal', fill: e.color || '#1a0f08', textAlign: e.align || 'left', charSpacing: +e.letterSpacing || 0, lineHeight: +e.lineHeight || 1.15 });
          B.loadFont(tb.fontFamily, '400;600;700;800').then(() => { tb.initDimensions(); cv.requestRenderAll(); });
          return tb;
        }
        if (e.type === 'rect') return new f.Rect({ left: +e.x, top: +e.y, width: +e.w || 100, height: +e.h || 100, fill: e.color || '#c98a2e', rx: +e.radius || 0, ry: +e.radius || 0, opacity: e.opacity ?? 1, stroke: e.stroke || null, strokeWidth: +e.strokeWidth || 0 });
        if (e.type === 'circle') return new f.Circle({ left: +e.x, top: +e.y, radius: +e.r || 50, fill: e.color || '#c98a2e', opacity: e.opacity ?? 1, stroke: e.stroke || null, strokeWidth: +e.strokeWidth || 0 });
        if (e.type === 'line') return new f.Line([0, 0, +e.w || 200, 0], { left: +e.x, top: +e.y, stroke: e.color || '#1a0f08', strokeWidth: +e.strokeWidth || 3 });
        return null;
      }
      async function renderLayout(r, withImages) {
        if (!r || !Array.isArray(r.elements)) throw Object.assign(new Error('layout'), { userMessage: 'Iris non ha restituito un layout valido. Riprova.' });
        cv.clear();
        const bg = r.background || {};
        const cols = (bg.colors || []).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c));
        setBg(cols.length > 1 ? { type: bg.type === 'radial' ? 'radial' : 'linear', colors: cols, angle: +bg.angle || 160 } : { type: 'solid', color: cols[0] || '#fffaf1' });
        const pending = [];
        for (const e of r.elements.slice(0, 16)) {
          if (e.type === 'image') { const ph = new window.fabric.Rect({ left: +e.x, top: +e.y, width: +e.w || 400, height: +e.h || 400, fill: '#d9b48f', opacity: 0.5, rx: e.shape === 'rounded' ? 30 : 0, ry: e.shape === 'rounded' ? 30 : 0 }); ph.id = uid(); ph.bxType = 'placeholder'; ph.bxPrompt = e.prompt; if (e.shape === 'circle') ph.clipPath = new window.fabric.Circle({ radius: Math.min(ph.width, ph.height) / 2, originX: 'center', originY: 'center' }); cv.add(ph); if (withImages && e.prompt) pending.push(ph); continue; }
          if (e.type === 'icon' && e.name) { const name = B.iconNames.find((n) => n.toLowerCase() === String(e.name).toLowerCase()) || 'Sparkles'; await new Promise((res) => window.fabric.loadSVGFromString(B.iconSVG(name, 24, 2, e.color || '#c98a2e'), (objs, opts) => { const g = window.fabric.util.groupSVGElements(objs, opts); const s = (+e.size || 80) / 24; g.set({ left: +e.x, top: +e.y, scaleX: s, scaleY: s }); g.id = uid(); g.bxType = 'icon'; cv.add(g); res(); })); continue; }
          const o = elementToObj(e); if (o) { o.id = uid(); cv.add(o); }
        }
        await Promise.all(cv.getObjects().filter((o) => o.fontFamily).map((o) => B.loadFont(o.fontFamily, '400;600;700;800').then(() => o.initDimensions && o.initDimensions())));
        fitInside(); fixOverlaps(); clearTexts();
        cv.requestRenderAll(); snap();
        const eng = B.ai.photoEngine(true);
        if (pending.length && !eng) B.toast('Le foto dei segnaposto arrivano dalla rete GPU comunitaria, disponibile nella versione web di Breye. Puoi sostituirle con le tue immagini.');
        if (pending.length && eng) {
          let warned = false;
          B.toast('Iris sta scattando ' + (pending.length === 1 ? 'la foto' : 'le ' + pending.length + ' foto') + ' del design sulla rete GPU comunitaria: compariranno da sole (1–3 minuti).');
          await Promise.all(pending.map(async (ph) => {
            try {
              const res = await B.ai.image(ph.bxPrompt, { engine: eng, w: ph.width || 1024, h: ph.height || 1024, style: 'photo' });
              if (ph.canvas) await addImage(await B.blobToDataURL(res.blob), { replace: ph, prompt: ph.bxPrompt });
            } catch (e) { if (!warned) { warned = true; B.toast(B.ai.errorText(e)); } }
          }));
        }
      }
      // keeps the AI's layout on the page: texts always inside the margins, objects mostly off-canvas pulled back in
      function fitInside() {
        const W = st.w, H = st.h, m = Math.round(Math.min(W, H) * 0.06);
        cv.getObjects().forEach((o) => {
          let b = o.getBoundingRect(true, true);
          if (!b.width || !b.height) return;
          const isText = /text/.test(o.type);
          if (!isText) {
            const ix = Math.max(0, Math.min(b.left + b.width, W) - Math.max(b.left, 0)), iy = Math.max(0, Math.min(b.top + b.height, H) - Math.max(b.top, 0));
            if (ix * iy / (b.width * b.height) > 0.65) return; // decorations may bleed off the edge
            if (b.width > W - 2 * m || b.height > H - 2 * m) { const k = Math.min((W - 2 * m) / b.width, (H - 2 * m) / b.height); o.set({ scaleX: (o.scaleX || 1) * k, scaleY: (o.scaleY || 1) * k }); o.setCoords(); b = o.getBoundingRect(true, true); }
          } else if (b.width > W - 2 * m) {
            if (o.type === 'textbox') { o.set('width', (W - 2 * m) / (o.scaleX || 1)); if (o.initDimensions) o.initDimensions(); }
            else { const k = (W - 2 * m) / b.width; o.set({ scaleX: (o.scaleX || 1) * k, scaleY: (o.scaleY || 1) * k }); }
            o.setCoords(); b = o.getBoundingRect(true, true);
          }
          let dx = 0, dy = 0;
          if (b.left < m) dx = m - b.left; else if (b.left + b.width > W - m) dx = W - m - b.left - b.width;
          if (b.top < m * 0.6) dy = m * 0.6 - b.top; else if (b.top + b.height > H - m * 0.6) dy = Math.max(m * 0.6 - b.top, H - m * 0.6 - b.top - b.height);
          if (dx || dy) { o.set({ left: o.left + dx, top: o.top + dy }); o.setCoords(); }
        });
      }
      // pictures never hide the words: a large picture becomes the backdrop, a small one moves clear of the text
      function clearTexts() {
        const m = Math.round(Math.min(st.w, st.h) * 0.06), gap = 18 * S();
        const texts = cv.getObjects().filter((o) => /text/.test(o.type)).sort((a, b) => a.top - b.top);
        cv.getObjects().filter((o) => o.type === 'image' || o.bxType === 'placeholder').forEach((p) => {
          let pb = p.getBoundingRect(true, true);
          if (pb.width * pb.height > st.w * st.h * 0.5) { cv.sendToBack(p); return; }
          for (const t of texts) {
            const tb = t.getBoundingRect(true, true);
            if (!(pb.left < tb.left + tb.width && tb.left < pb.left + pb.width && pb.top < tb.top + tb.height && tb.top < pb.top + pb.height)) continue;
            const below = tb.top + tb.height + gap, above = tb.top - gap - pb.height;
            if (below + pb.height <= st.h - m) p.set('top', p.top + (below - pb.top));
            else if (above >= m) p.set('top', p.top + (above - pb.top));
            else { cv.sendToBack(p); break; }
            p.setCoords(); pb = p.getBoundingRect(true, true);
          }
        });
      }
      function fixOverlaps() {
        const texts = cv.getObjects().filter((o) => /text/.test(o.type)).sort((a, b) => a.top - b.top);
        const gap = 14 * S();
        for (let i = 1; i < texts.length; i++) {
          const o = texts[i];
          for (let j = 0; j < i; j++) {
            const p = texts[j], pb = p.getBoundingRect(true, true), ob = o.getBoundingRect(true, true);
            const hOverlap = ob.left < pb.left + pb.width && pb.left < ob.left + ob.width;
            if (hOverlap && ob.top < pb.top + pb.height + gap && ob.top + ob.height > pb.top) { o.set('top', o.top + (pb.top + pb.height + gap - ob.top)); o.setCoords(); }
          }
        }
        const bottom = Math.max(0, ...texts.map((o) => o.getBoundingRect(true, true).top + o.getBoundingRect(true, true).height));
        if (bottom > st.h * 0.96 && texts.length) {
          const top0 = Math.min(...texts.map((o) => o.top)), k = (st.h * 0.94 - top0) / (bottom - top0);
          texts.forEach((o) => { o.set({ top: top0 + (o.top - top0) * k, scaleX: (o.scaleX || 1) * Math.max(0.7, k), scaleY: (o.scaleY || 1) * Math.max(0.7, k) }); o.setCoords(); });
        }
      }
      async function agent(q, log, btn) {
        const ask = q.value.trim(); if (!ask) return;
        q.value = ''; btn.disabled = true;
        log.append(B.h('div', { class: 'ag-me', text: ask }));
        const thinking = B.h('div', { class: 'ag-ai' }, B.h('span', { class: 'typing' }, B.h('i'), B.h('i'), B.h('i')));
        log.append(thinking); log.scrollTop = log.scrollHeight;
        try {
          const spec = LAYOUT_SPEC.replace('{W}', st.w).replace('{H}', st.h);
          const r = await B.ai.json('Sei l’assistente di un editor grafico. Tela ' + st.w + '×' + st.h + '. Sfondo attuale: ' + JSON.stringify(st.bg || {}) + '.\nElementi attuali (dal fondo al primo piano):\n' + JSON.stringify(describe()) + '\n\nRichiesta dell’utente: "' + ask + '"\n\nRispondi SOLO con JSON: {"reply":"breve risposta in italiano su cosa hai fatto","actions":[...]}\nAzioni possibili:\n{"op":"update","id":"...","props":{"text":"...","x":n,"y":n,"w":n,"fontSize":n,"fontFamily":"...","fontWeight":n,"color":"#hex","align":"...","opacity":n,"angle":n,"letterSpacing":n,"italic":bool}}\n{"op":"delete","id":"..."}\n{"op":"add","element":ELEMENTO}\n{"op":"background","background":{"type":"solid|linear|radial","colors":["#hex"],"angle":n}}\n{"op":"front","id":"..."} {"op":"back","id":"..."}\nDove ELEMENTO segue: ' + spec, { system: false, tier: 'default' });
          for (const a of (r.actions || [])) await runAction(a);
          cv.requestRenderAll(); snap(); paintInspector();
          thinking.innerHTML = ''; thinking.textContent = r.reply || 'Fatto.';
        } catch (e) { thinking.textContent = B.ai.errorText(e); }
        btn.disabled = false; log.scrollTop = log.scrollHeight;
      }
      async function runAction(a) {
        const f = window.fabric;
        const o = a.id ? cv.getObjects().find((x) => x.id === a.id) : null;
        if (a.op === 'update' && o) {
          const p = a.props || {}, set = {};
          if (p.text != null && 'text' in o) set.text = String(p.text);
          if (p.x != null) set.left = +p.x; if (p.y != null) set.top = +p.y;
          if (p.w != null) { if (/text/.test(o.type)) set.width = +p.w; else set.scaleX = +p.w / o.width; }
          if (p.fontSize != null) { set.fontSize = +p.fontSize; set.scaleX = 1; set.scaleY = 1; }
          if (p.fontFamily) { set.fontFamily = p.fontFamily; await B.loadFont(p.fontFamily, '400;600;700;800'); }
          if (p.fontWeight != null) set.fontWeight = p.fontWeight;
          if (p.italic != null) set.fontStyle = p.italic ? 'italic' : 'normal';
          if (p.color) set.fill = p.color; if (p.align) set.textAlign = p.align;
          if (p.opacity != null) set.opacity = +p.opacity; if (p.angle != null) set.angle = +p.angle;
          if (p.letterSpacing != null) set.charSpacing = +p.letterSpacing;
          o.set(set); o.initDimensions && o.initDimensions(); o.setCoords();
        } else if (a.op === 'delete' && o) cv.remove(o);
        else if (a.op === 'front' && o) cv.bringToFront(o);
        else if (a.op === 'back' && o) cv.sendToBack(o);
        else if (a.op === 'background' && a.background) { const bg = a.background; const cols = (bg.colors || []).filter(Boolean); setBg(cols.length > 1 ? { type: bg.type === 'radial' ? 'radial' : 'linear', colors: cols, angle: +bg.angle || 160 } : { type: 'solid', color: cols[0] || '#ffffff' }); }
        else if (a.op === 'add' && a.element) {
          const e = a.element;
          if (e.type === 'icon') { const name = B.iconNames.find((n) => n.toLowerCase() === String(e.name || '').toLowerCase()) || 'Sparkles'; await new Promise((res) => f.loadSVGFromString(B.iconSVG(name, 24, 2, e.color || '#c98a2e'), (objs, opts) => { const g = f.util.groupSVGElements(objs, opts); const s = (+e.size || 80) / 24; g.set({ left: +e.x, top: +e.y, scaleX: s, scaleY: s }); g.id = uid(); cv.add(g); res(); })); }
          else if (e.type === 'image') { try { const eng = B.ai.photoEngine(true) || 'vector'; const res = await B.ai.image(e.prompt || 'abstract', { engine: eng, w: +e.w || 1024, h: +e.h || 1024, style: 'photo' }); const img = await addImage(await B.blobToDataURL(res.blob)); if (img) { img.set({ left: +e.x || 0, top: +e.y || 0 }); const s = (+e.w || 400) / img.width; img.set({ scaleX: s, scaleY: s }); } } catch (er) { B.toast(B.ai.errorText(er)); } }
          else { const ob = elementToObj(e); if (ob) { ob.id = uid(); cv.add(ob); } }
        }
      }

      /* ---------- inspector ---------- */
      function paintInspector() {
        if (!cv) return;
        inspB.innerHTML = '';
        const o = cv.getActiveObject();
        if (!o) { pagePanel(); B.hydrateIcons(insp); pLayersRefresh(); return; }
        const multi = o.type === 'activeSelection';
        const sec = (title, ...kids) => { const s = B.h('div', { class: 'insp-sec' }, B.h('div', { class: 'lbl', text: title })); kids.forEach((k) => k && s.append(k)); inspB.append(s); return s; };
        const isText = /text/.test(o.type) && !multi;
        // quick actions
        sec('Azioni', B.h('div', { class: 'grid4' },
          ib('Copy', 'Duplica (Ctrl D)', duplicate), ib(o.locked ? 'Lock' : 'Unlock', o.locked ? 'Sblocca' : 'Blocca', () => setLock(o, !o.locked)),
          ib('BringToFront', 'Porta in primo piano', () => { cv.bringToFront(o); snap(); }), ib('SendToBack', 'Porta dietro', () => { cv.sendToBack(o); snap(); }),
          ib('ArrowUp', 'Avanti di un livello', () => { cv.bringForward(o); snap(); }), ib('ArrowDown', 'Indietro di un livello', () => { cv.sendBackwards(o); snap(); }),
          multi ? ib('Group', 'Raggruppa (Ctrl G)', group) : o.type === 'group' ? ib('Ungroup', 'Separa', ungroup) : ib('FlipHorizontal', 'Rifletti', () => { o.set('flipX', !o.flipX); cv.requestRenderAll(); snap(); }),
          ib('Trash2', 'Elimina (Canc)', del)));
        sec('Allinea alla pagina', B.h('div', { class: 'grid3' },
          ib('AlignStartVertical', 'A sinistra', () => align('l')), ib('AlignHorizontalJustifyCenter', 'Al centro', () => align('c')), ib('AlignEndVertical', 'A destra', () => align('r')),
          ib('AlignStartHorizontal', 'In alto', () => align('t')), ib('AlignVerticalJustifyCenter', 'Al centro verticale', () => align('m')), ib('AlignEndHorizontal', 'In basso', () => align('b'))));
        if (isText) {
          const fam = B.h('button', { class: 'btn sm block font-pick', type: 'button', style: { fontFamily: '"' + o.fontFamily + '"', justifyContent: 'space-between' }, onclick: (e) => fontMenu(o, e.currentTarget) }, o.fontFamily, B.h('span', { 'data-i': 'ChevronDown' }));
          const size = num('Dim', Math.round(o.fontSize * (o.scaleY || 1)), (v) => { o.set({ fontSize: v / (o.scaleY || 1) }); });
          const styleRow = B.h('div', { class: 'grid4' },
            tb('Bold', 'Grassetto', o.fontWeight >= 600 || o.fontWeight === 'bold', () => o.set('fontWeight', o.fontWeight >= 600 || o.fontWeight === 'bold' ? 400 : 700)),
            tb('Italic', 'Corsivo', o.fontStyle === 'italic', () => o.set('fontStyle', o.fontStyle === 'italic' ? 'normal' : 'italic')),
            tb('Underline', 'Sottolineato', o.underline, () => o.set('underline', !o.underline)),
            tb('CaseSensitive', 'Maiuscolo', o.text === o.text.toUpperCase(), () => o.set('text', o.text === o.text.toUpperCase() ? o.text.charAt(0) + o.text.slice(1).toLowerCase() : o.text.toUpperCase())),
            tb('AlignLeft', 'Allinea a sinistra', o.textAlign === 'left', () => o.set('textAlign', 'left')),
            tb('AlignCenter', 'Centra', o.textAlign === 'center', () => o.set('textAlign', 'center')),
            tb('AlignRight', 'Allinea a destra', o.textAlign === 'right', () => o.set('textAlign', 'right')),
            tb('AlignJustify', 'Giustifica', o.textAlign === 'justify', () => o.set('textAlign', 'justify')));
          sec('Testo', fam, B.h('div', { class: 'grid2' }, size, colorIn(o, 'fill')), styleRow,
            B.slider({ label: 'Spaziatura lettere', min: -100, max: 800, value: o.charSpacing || 0, onInput: (v) => { o.set('charSpacing', v); cv.requestRenderAll(); }, onChange: snap }),
            B.slider({ label: 'Interlinea', min: 0.7, max: 2.5, step: 0.05, value: o.lineHeight || 1.16, onInput: (v) => { o.set('lineHeight', v); cv.requestRenderAll(); }, onChange: snap }));
          const fx = sec('Effetti');
          const fxs = [['Nessuno', () => o.set({ shadow: null, stroke: null, strokeWidth: 0, textBackgroundColor: '' })], ['Ombra', () => o.set({ shadow: new window.fabric.Shadow({ color: 'rgba(0,0,0,.45)', blur: 18 * S(), offsetX: 6 * S(), offsetY: 8 * S() }) })], ['Bagliore', () => o.set({ shadow: new window.fabric.Shadow({ color: '#e3a94a', blur: 30 * S(), offsetX: 0, offsetY: 0 }) })], ['Contorno', () => o.set({ stroke: darkBg() ? '#0b0705' : '#fffaf1', strokeWidth: Math.max(1, 3 * S()), paintFirst: 'stroke' })], ['Evidenziato', () => o.set({ textBackgroundColor: '#f3d088' })], ['Oro', () => { const h = o.height || 100; o.set('fill', new window.fabric.Gradient({ type: 'linear', coords: { x1: 0, y1: 0, x2: 0, y2: h }, colorStops: [{ offset: 0, color: '#fff3d6' }, { offset: 0.5, color: '#e3a94a' }, { offset: 1, color: '#a8642a' }] })); }], ['Neon', () => o.set({ fill: '#fff7e6', shadow: new window.fabric.Shadow({ color: '#ff9d2e', blur: 40 * S(), offsetX: 0, offsetY: 0 }) })]];
          const fg = B.h('div', { class: 'chips' }); fxs.forEach(([l, fn]) => fg.append(B.h('button', { class: 'chip', type: 'button', onclick: () => { fn(); cv.requestRenderAll(); snap(); } }, l))); fx.append(fg);
        } else if (o.type === 'image') {
          const flt = sec('Regolazioni immagine');
          const F = window.fabric.Image.filters;
          const getF = (cls) => (o.filters || []).find((x) => x instanceof cls);
          const setF = (cls, key, v, make) => { let x = getF(cls); if (!x) { x = make(); o.filters.push(x); } x[key] = v; o.applyFilters(); cv.requestRenderAll(); };
          flt.append(
            B.slider({ label: 'Luminosità', min: -100, max: 100, value: Math.round(((getF(F.Brightness) || {}).brightness || 0) * 100), onInput: (v) => setF(F.Brightness, 'brightness', v / 100, () => new F.Brightness()), onChange: snap }),
            B.slider({ label: 'Contrasto', min: -100, max: 100, value: Math.round(((getF(F.Contrast) || {}).contrast || 0) * 100), onInput: (v) => setF(F.Contrast, 'contrast', v / 100, () => new F.Contrast()), onChange: snap }),
            B.slider({ label: 'Saturazione', min: -100, max: 100, value: Math.round(((getF(F.Saturation) || {}).saturation || 0) * 100), onInput: (v) => setF(F.Saturation, 'saturation', v / 100, () => new F.Saturation()), onChange: snap }),
            B.slider({ label: 'Sfocatura', min: 0, max: 100, value: Math.round(((getF(F.Blur) || {}).blur || 0) * 100), onInput: (v) => setF(F.Blur, 'blur', v / 100, () => new F.Blur()), onChange: snap }));
          const pre = B.h('div', { class: 'chips' });
          [['Originale', []], ['B/N', [new F.Grayscale()]], ['Seppia', [new F.Sepia()]], ['Vintage', [new F.Vintage()]], ['Caldo', [new F.BlendColor({ color: '#c98a2e', mode: 'overlay', alpha: 0.35 })]], ['Cinema', [new F.Contrast({ contrast: 0.15 }), new F.Saturation({ saturation: -0.15 }), new F.BlendColor({ color: '#3b2314', mode: 'multiply', alpha: 0.25 })]], ['Kodachrome', [new F.Kodachrome()]], ['Polaroid', [new F.Polaroid()]]].forEach(([l, fl]) => pre.append(B.h('button', { class: 'chip', type: 'button', onclick: () => { o.filters = fl.slice(); o.applyFilters(); cv.requestRenderAll(); snap(); paintInspector(); } }, l)));
          sec('Filtri', pre);
          const shapes = B.h('div', { class: 'chips' });
          [['Nessuna', null], ['Cerchio', 'circle'], ['Arrotondata', 'round'], ['Arco', 'arch']].forEach(([l, k]) => shapes.append(B.h('button', { class: 'chip', type: 'button', onclick: () => { frame(o, k); } }, l)));
          sec('Cornice', shapes);
          sec('Immagine', B.h('div', { class: 'grid2' },
            B.h('button', { class: 'btn sm', type: 'button', onclick: () => fillPage(o) }, B.h('span', { 'data-i': 'Expand' }), 'Riempi pagina'),
            B.h('button', { class: 'btn sm', type: 'button', onclick: async () => { const [f] = await B.pickFiles('image/*'); if (f) addImage(await B.blobToDataURL(f), { replace: o }); } }, B.h('span', { 'data-i': 'Replace' }), 'Sostituisci'),
            B.h('button', { class: 'btn sm', type: 'button', onclick: () => removeBg(o) }, B.h('span', { 'data-i': 'Scissors' }), 'Rimuovi sfondo'),
            B.h('button', { class: 'btn sm', type: 'button', onclick: async () => B.go('photo', { imageURL: o.toDataURL({ multiplier: 1 / (o.scaleX || 1) }) }) }, B.h('span', { 'data-i': 'Aperture' }), 'Foto Studio')));
        } else if (!multi) {
          const fillSec = sec('Colore');
          if (o.type !== 'line') fillSec.append(B.h('div', { class: 'row' }, colorIn(o, 'fill'), B.h('span', { class: 'mini-note', text: 'Riempimento' })));
          const sw = B.h('div', { class: 'swatches' }); SWATCHES.forEach((c) => sw.append(B.h('button', { class: 'sw', type: 'button', style: { background: c }, 'aria-label': c, onclick: () => { if (o.type === 'line') o.set('stroke', c); else if (o.type === 'group') o.getObjects().forEach((x) => { if (x.stroke) x.set('stroke', c); if (x.fill && x.fill !== 'none') x.set('fill', c); }); else o.set('fill', c); cv.requestRenderAll(); snap(); } })));
          fillSec.append(sw);
          if (o.type !== 'group') sec('Bordo', B.h('div', { class: 'row' }, colorIn(o, 'stroke'), num('Spess.', o.strokeWidth || 0, (v) => o.set('strokeWidth', v))));
          if (o.type === 'rect') sec('Angoli', B.slider({ label: 'Arrotondamento', min: 0, max: Math.round(Math.min(o.width, o.height) / 2), value: o.rx || 0, onInput: (v) => { o.set({ rx: v, ry: v }); cv.requestRenderAll(); }, onChange: snap }));
        }
        const tr = sec('Posizione e dimensione');
        tr.append(B.h('div', { class: 'grid2' }, num('X', Math.round(o.left), (v) => o.set('left', v)), num('Y', Math.round(o.top), (v) => o.set('top', v)), num('L', Math.round(o.getScaledWidth()), (v) => o.scaleToWidth(v)), num('A', Math.round(o.getScaledHeight()), (v) => o.scaleToHeight(v)), num('°', Math.round(o.angle || 0), (v) => o.rotate(v)), num('%', Math.round((o.opacity ?? 1) * 100), (v) => o.set('opacity', B.clamp(v, 0, 100) / 100))));
        B.hydrateIcons(insp); pLayersRefresh();
      }
      function pagePanel() {
        const s = B.h('div', { class: 'insp-sec' }, B.h('div', { class: 'lbl', text: 'Pagina ' + (st.cur + 1) + ' di ' + st.pages.length }));
        s.append(B.h('div', { class: 'mini-note', text: st.w + ' × ' + st.h + ' px. Seleziona un elemento per modificarlo, oppure fai doppio clic su un testo per scriverci dentro.' }));
        const c = B.h('input', { type: 'color', class: 'swatch-in', value: st.bg && st.bg.type === 'solid' ? st.bg.color : '#ffffff', 'aria-label': 'Colore di sfondo' });
        c.addEventListener('input', () => setBg({ type: 'solid', color: c.value })); c.addEventListener('change', snap);
        s.append(B.h('div', { class: 'row' }, c, B.h('span', { class: 'mini-note', text: 'Sfondo' }), B.h('div', { class: 'bar-sp' }), B.h('button', { class: 'btn sm', type: 'button', onclick: () => openPanel('bg') }, 'Altri sfondi')));
        inspB.append(s);
        const q = B.h('div', { class: 'insp-sec' }, B.h('div', { class: 'lbl', text: 'Aggiungi' }), B.h('div', { class: 'grid2' },
          B.h('button', { class: 'btn sm', type: 'button', onclick: () => addText('h') }, B.h('span', { 'data-i': 'Type' }), 'Titolo'),
          B.h('button', { class: 'btn sm', type: 'button', onclick: () => addShape('round') }, B.h('span', { 'data-i': 'Square' }), 'Forma'),
          B.h('button', { class: 'btn sm', type: 'button', onclick: async () => { const [f] = await B.pickFiles('image/*'); if (f) addImage(await B.blobToDataURL(f)); } }, B.h('span', { 'data-i': 'Image' }), 'Foto'),
          B.h('button', { class: 'btn sm', type: 'button', onclick: () => openPanel('magic') }, B.h('span', { 'data-i': 'Sparkles' }), 'Magic')));
        inspB.append(q);
        inspB.append(B.h('div', { class: 'insp-sec' }, B.h('div', { class: 'lbl', text: 'Scorciatoie' }), B.h('div', { class: 'mini-note', html: '<kbd>Ctrl</kbd> <kbd>D</kbd> duplica · <kbd>Canc</kbd> elimina · <kbd>Ctrl</kbd> <kbd>G</kbd> raggruppa · frecce per spostare · <kbd>Ctrl</kbd> <kbd>S</kbd> salva' })));
      }
      function ib(icon, tip, fn) { return B.h('button', { class: 'btn icon sm', type: 'button', 'data-tip': tip, 'aria-label': tip, 'data-i': icon, onclick: fn }); }
      function tb(icon, tip, on, fn) { return B.h('button', { class: 'btn icon sm' + (on ? ' on' : ''), type: 'button', 'data-tip': tip, 'aria-label': tip, 'data-i': icon, onclick: () => { fn(); const o = cv.getActiveObject(); o && o.initDimensions && o.initDimensions(); cv.requestRenderAll(); snap(); paintInspector(); } }); }
      function num(label, value, fn) { const i = B.h('input', { type: 'number', value, 'aria-label': label }); i.addEventListener('change', () => { const o = cv.getActiveObject(); if (!o) return; fn(+i.value); o.setCoords(); cv.requestRenderAll(); snap(); }); return B.h('label', { class: 'num' }, B.h('span', { text: label }), i); }
      function colorIn(o, prop) {
        const v = typeof o[prop] === 'string' && /^#/.test(o[prop]) ? o[prop].slice(0, 7) : prop === 'stroke' ? '#000000' : '#c98a2e';
        const i = B.h('input', { type: 'color', class: 'swatch-in', value: v.length === 4 ? '#' + v.slice(1).split('').map((c) => c + c).join('') : v, 'aria-label': prop === 'fill' ? 'Colore' : 'Colore del bordo' });
        i.addEventListener('input', () => { if (o.type === 'group' && prop === 'fill') o.getObjects().forEach((x) => { if (x.stroke) x.set('stroke', i.value); }); else o.set(prop, i.value); if (prop === 'stroke' && !o.strokeWidth) o.set('strokeWidth', Math.max(2, 4 * S())); cv.requestRenderAll(); });
        i.addEventListener('change', snap); return i;
      }
      function fontMenu(o, at) {
        const items = []; let cat = '';
        FONTS.forEach(([f, c]) => { if (c !== cat) { cat = c; items.push({ header: c }); } items.push({ label: f, active: o.fontFamily === f, fn: async () => { await B.loadFont(f, '400;600;700;800'); o.set('fontFamily', f); o.initDimensions(); cv.requestRenderAll(); snap(); paintInspector(); } }); });
        const m = B.menu(at, items);
        B.$$('button', m).forEach((b) => { const f = b.textContent; if (FONTS.find((x) => x[0] === f)) { B.loadFont(f); b.style.fontFamily = '"' + f + '", sans-serif'; b.style.fontSize = '15px'; } });
      }
      function align(k) {
        const o = cv.getActiveObject(); if (!o) return;
        const w = o.getScaledWidth(), h = o.getScaledHeight(), br = o.getBoundingRect(true, true);
        const dx = o.left - br.left, dy = o.top - br.top;
        if (k === 'l') o.set('left', dx); if (k === 'c') o.set('left', (st.w - br.width) / 2 + dx); if (k === 'r') o.set('left', st.w - br.width + dx);
        if (k === 't') o.set('top', dy); if (k === 'm') o.set('top', (st.h - br.height) / 2 + dy); if (k === 'b') o.set('top', st.h - br.height + dy);
        void w; void h; o.setCoords(); cv.requestRenderAll(); snap();
      }
      function frame(o, k) {
        const f = window.fabric, r = Math.min(o.width, o.height) / 2;
        if (!k) o.clipPath = null;
        else if (k === 'circle') o.clipPath = new f.Circle({ radius: r, originX: 'center', originY: 'center' });
        else if (k === 'round') o.clipPath = new f.Rect({ width: o.width, height: o.height, rx: o.width * 0.08, ry: o.width * 0.08, originX: 'center', originY: 'center' });
        else if (k === 'arch') o.clipPath = new f.Path('M0 ' + o.height / 2 + ' L0 ' + (-o.height / 2 + o.width / 2) + ' A' + o.width / 2 + ' ' + o.width / 2 + ' 0 0 1 ' + o.width + ' ' + (-o.height / 2 + o.width / 2) + ' L' + o.width + ' ' + o.height / 2 + ' Z', { left: -o.width / 2, top: -o.height / 2 });
        o.dirty = true; cv.requestRenderAll(); snap();
      }
      async function removeBg(o) {
        try {
          B.toast('Iris scontorna l’immagine…');
          const src = o.getElement(); const c = document.createElement('canvas'); c.width = src.naturalWidth || src.width; c.height = src.naturalHeight || src.height; c.getContext('2d').drawImage(src, 0, 0);
          const out = await B.removeBackground(c);
          const url = out.toDataURL('image/png');
          await new Promise((res) => o.setSrc(url, () => { o.applyFilters(); cv.requestRenderAll(); snap(); res(); }));
          B.toast('Sfondo rimosso', 'ok');
        } catch (e) { B.err(e); }
      }
      function duplicate() { const o = cv.getActiveObject(); if (!o) return; o.clone((c) => { c.set({ left: o.left + 30 * S(), top: o.top + 30 * S() }); if (c.type === 'activeSelection') { c.canvas = cv; c.forEachObject((x) => { x.id = uid(); cv.add(x); }); c.setCoords(); } else { c.id = uid(); cv.add(c); } cv.setActiveObject(c); cv.requestRenderAll(); snap(); }, EXTRA); }
      function del() { const objs = cv.getActiveObjects(); if (!objs.length) return; objs.forEach((o) => cv.remove(o)); cv.discardActiveObject(); cv.requestRenderAll(); snap(); paintInspector(); }
      function group() { const o = cv.getActiveObject(); if (!o || o.type !== 'activeSelection') return; const g = o.toGroup(); g.id = uid(); cv.requestRenderAll(); snap(); paintInspector(); }
      function ungroup() { const o = cv.getActiveObject(); if (!o || o.type !== 'group') return; o.toActiveSelection(); cv.requestRenderAll(); snap(); paintInspector(); }
      function imageMenu(o) { cv.setActiveObject(o); paintInspector(); }
      function ctxMenu(e) {
        B.menu({ x: e.clientX, y: e.clientY }, [{ label: 'Duplica', icon: 'Copy', kbd: 'Ctrl D', fn: duplicate }, { label: 'Copia', icon: 'Copy', kbd: 'Ctrl C', fn: copy }, { label: 'Incolla', icon: 'ClipboardPaste', kbd: 'Ctrl V', fn: paste }, '-', { label: 'Primo piano', icon: 'BringToFront', fn: () => { cv.bringToFront(cv.getActiveObject()); snap(); } }, { label: 'Sfondo', icon: 'SendToBack', fn: () => { cv.sendToBack(cv.getActiveObject()); snap(); } }, '-', { label: 'Elimina', icon: 'Trash2', kbd: 'Canc', fn: del }]);
      }
      function copy() { const o = cv.getActiveObject(); if (o) o.clone((c) => { st.clip = c; }, EXTRA); }
      function paste() { if (!st.clip) return; st.clip.clone((c) => { cv.discardActiveObject(); c.set({ left: c.left + 30 * S(), top: c.top + 30 * S(), evented: true }); if (c.type === 'activeSelection') { c.canvas = cv; c.forEachObject((x) => { x.id = uid(); cv.add(x); }); c.setCoords(); } else { c.id = uid(); cv.add(c); } st.clip.top += 30 * S(); st.clip.left += 30 * S(); cv.setActiveObject(c); cv.requestRenderAll(); snap(); }, EXTRA); }
      function nudge(dx, dy) { const o = cv.getActiveObject(); if (!o) return false; o.set({ left: o.left + dx, top: o.top + dy }); o.setCoords(); cv.requestRenderAll(); snapSoon(); return true; }
      const snapSoon = B.debounce(snap, 400);
      const editing = () => { const o = cv && cv.getActiveObject(); return o && o.isEditing; };
      B.key('delete', () => { if (editing()) return false; del(); }, 'design');
      B.key('backspace', () => { if (editing()) return false; del(); }, 'design');
      B.key('mod+z', () => { if (editing()) return false; undo(); }, 'design');
      B.key('mod+y', () => { if (editing()) return false; redo(); }, 'design');
      B.key('mod+shift+z', () => { if (editing()) return false; redo(); }, 'design');
      B.key('mod+d', () => { duplicate(); }, 'design');
      B.key('mod+c', () => { if (editing()) return false; copy(); return false; }, 'design');
      B.key('mod+v', () => { if (editing() || !st.clip) return false; paste(); }, 'design');
      B.key('mod+g', () => { group(); }, 'design');
      B.key('mod+shift+g', () => { ungroup(); }, 'design');
      B.key('mod+s', () => { saveProject(); }, 'design');
      B.key('escape', () => { if (!cv || editing()) return false; cv.discardActiveObject(); cv.requestRenderAll(); paintInspector(); }, 'design');
      [['arrowleft', -1, 0], ['arrowright', 1, 0], ['arrowup', 0, -1], ['arrowdown', 0, 1]].forEach(([k, x, y]) => { B.key(k, () => (editing() ? false : nudge(x, y)), 'design'); B.key('shift+' + k, () => (editing() ? false : nudge(x * 10, y * 10)), 'design'); });

      /* ---------- size & export ---------- */
      function resizeMenu(at) {
        const items = [{ header: 'Ridimensiona (Magic Resize)' }];
        B.FORMATS.forEach((f) => items.push({ label: f.label + '  ·  ' + f.w + '×' + f.h, active: f.w === st.w && f.h === st.h, fn: () => resizeTo(f.w, f.h) }));
        items.push('-', { label: 'Dimensione personalizzata…', icon: 'Ruler', fn: async () => { const v = await B.prompt('Dimensione in pixel (larghezza×altezza)', st.w + 'x' + st.h); const m = v && v.match(/(\d+)\s*[x×*]\s*(\d+)/); if (m) resizeTo(B.clamp(+m[1], 50, 8000), B.clamp(+m[2], 50, 8000)); } });
        B.menu(at, items);
      }
      function resizeTo(w, h) {
        const sx = w / st.w, sy = h / st.h, s = Math.min(sx, sy);
        st.pages[st.cur].json = JSON.stringify(json());
        cv.getObjects().forEach((o) => { const c = o.getCenterPoint(); o.set({ scaleX: o.scaleX * s, scaleY: o.scaleY * s }); o.setPositionByOrigin(new window.fabric.Point(c.x * sx, c.y * sy), 'center', 'center'); o.setCoords(); });
        st.w = w; st.h = h; if (st.bg) setBg(st.bg); updateSize(); fit(); snap();
        B.toast('Design adattato a ' + w + '×' + h, 'ok');
      }
      function exportMenu(at) {
        B.menu(at, [
          { header: 'Pagina corrente' },
          { label: 'PNG (alta qualità)', icon: 'FileImage', fn: () => exportImg('png') },
          { label: 'PNG trasparente', icon: 'FileImage', fn: () => exportImg('png', true) },
          { label: 'JPG', icon: 'FileImage', fn: () => exportImg('jpeg') },
          { label: 'SVG vettoriale', icon: 'PenTool', fn: exportSvg },
          { header: 'Tutte le pagine' },
          { label: 'PDF (' + st.pages.length + ' pagine)', icon: 'FileText', fn: exportPdf },
          { label: 'PNG in archivio ZIP', icon: 'Files', fn: exportZip },
          '-', { label: 'Apri nel Foto Studio', icon: 'Aperture', fn: async () => B.go('photo', { imageURL: await pageDataURL(st.cur, 'png') }) },
          { label: 'Anima nel Video AI', icon: 'Film', fn: async () => B.go('motion', { imageURL: await pageDataURL(st.cur, 'png') }) }
        ], { align: 'right' });
      }
      function pageDataURL(i, fmt, transparent) {
        st.pages[st.cur].json = JSON.stringify(json());
        return new Promise((res) => {
          const tmp = document.createElement('canvas'); const sc = new window.fabric.StaticCanvas(tmp, { width: st.w, height: st.h, enableRetinaScaling: false });
          sc.loadFromJSON(JSON.parse(st.pages[i].json || '{}'), () => { if (transparent) sc.setBackgroundColor(null); sc.renderAll(); const u = sc.toDataURL({ format: fmt, quality: 0.95, multiplier: 1 }); sc.dispose(); res(u); });
        });
      }
      async function exportImg(fmt, transparent) { const u = await pageDataURL(st.cur, fmt, transparent); B.save(u, B.slug(st.name) + (st.pages.length > 1 ? '-p' + (st.cur + 1) : '') + '.' + (fmt === 'jpeg' ? 'jpg' : 'png')); }
      function exportSvg() { const z = st.zoom; setZoom(1); const svg = cv.toSVG({ width: st.w, height: st.h, viewBox: { x: 0, y: 0, width: st.w, height: st.h } }); setZoom(z); B.save(new Blob([svg], { type: 'image/svg+xml' }), B.slug(st.name) + '.svg'); }
      async function exportPdf() {
        try {
          await B.need('jspdf');
          const { jsPDF } = window.jspdf; const pt = (v) => v * 0.75;
          const doc = new jsPDF({ orientation: st.w > st.h ? 'landscape' : 'portrait', unit: 'pt', format: [pt(st.w), pt(st.h)] });
          for (let i = 0; i < st.pages.length; i++) { if (i) doc.addPage([pt(st.w), pt(st.h)], st.w > st.h ? 'landscape' : 'portrait'); doc.addImage(await pageDataURL(i, 'jpeg'), 'JPEG', 0, 0, pt(st.w), pt(st.h)); }
          B.save(doc.output('blob'), B.slug(st.name) + '.pdf');
        } catch (e) { B.err(e); }
      }
      async function exportZip() {
        try { await B.need('jszip'); const zip = new window.JSZip(); for (let i = 0; i < st.pages.length; i++) zip.file(B.slug(st.name) + '-' + (i + 1) + '.png', (await pageDataURL(i, 'png')).split(',')[1], { base64: true }); B.save(await zip.generateAsync({ type: 'blob' }), B.slug(st.name) + '.zip'); } catch (e) { B.err(e); }
      }
      async function saveProject() {
        if (!cv) return;
        st.pages[st.cur].json = JSON.stringify(json());
        st.id = st.id || B.uid('p');
        await B.projects.save({ id: st.id, type: 'design', name: st.name, data: { w: st.w, h: st.h, pages: st.pages.map((p) => p.json), bg: st.bg }, thumb: cv.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: 320 / (st.w * st.zoom) }) });
        B.toast('Design salvato', 'ok');
      }
      async function loadProject(id) {
        const p = await B.projects.get(id); if (!p) return;
        st.id = p.id; st.name = nameIn.value = p.name; st.w = p.data.w; st.h = p.data.h; st.pages = p.data.pages.map((j) => ({ json: j })); st.cur = 0; st.bg = p.data.bg;
        updateSize(); fit(); st.hist = []; if (st.pages[0].json) { st.hist.push(st.pages[0].json); restore(st.pages[0].json); }
        const fams = new Set(); (st.pages[0].json || '').replace(/"fontFamily":"([^"]+)"/g, (_, f) => fams.add(f));
        await Promise.all([...fams].map((f) => B.loadFont(f, '400;600;700;800'))); cv.getObjects().forEach((o) => o.initDimensions && o.initDimensions()); cv.requestRenderAll();
        renderPages();
      }
      async function handleParams(p) {
        if (!st.ready) { st.pendingLoad = p; return; }
        if (p.project) return loadProject(p.project);
        if (p.format) { const f = B.FORMATS.find((x) => x.id === p.format); if (f) { st.name = nameIn.value = f.label; newDesign(f.w, f.h, ['ig-post', 'ig-story', 'ig-portrait'].includes(f.id) ? 'iris' : f.id === 'yt-thumb' ? 'yt' : f.id === 'presentation' ? 'title-slide' : f.id === 'card' ? 'card' : f.id === 'logo' ? 'logo' : f.id === 'menu' ? 'menu' : f.id === 'poster' || f.id === 'flyer' ? 'event' : 'crema'); openPanel('templates'); } }
        if (p.imageURL) { if (p.svg) svgToCanvas(p.svg); else addImage(p.imageURL); }
        if (p.prompt) {
          const s = p.prompt.toLowerCase();
          const f = /storia|story|reel|tiktok/.test(s) ? B.FORMATS[1] : /miniatura|thumbnail|youtube/.test(s) ? B.FORMATS[3] : /presentazion|slide/.test(s) ? B.FORMATS[4] : /poster|locandina/.test(s) ? B.FORMATS[5] : /volantino|flyer/.test(s) ? B.FORMATS[6] : /logo/.test(s) ? B.FORMATS[7] : /biglietto/.test(s) ? B.FORMATS[8] : /banner/.test(s) ? B.FORMATS[9] : B.FORMATS[0];
          newDesign(f.w, f.h, 'blank'); st.name = nameIn.value = p.prompt.slice(0, 40);
          openPanel('magic'); B.$('#dsMagicP').value = p.prompt;
          if (p.auto) magicDesign(p.prompt, B.$('.ai-box .btn.gold', dBody));
        }
      }
      this.params = handleParams;
      this.refit = () => cv && fit();
      openPanel('templates');
    },
    onShow(p) { if (p && Object.keys(p).length) this.params(p); setTimeout(() => this.refit && this.refit(), 60); }
  });
})();
