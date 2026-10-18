/* Immagini AI — text to image with three engines, gallery, lightbox */
(function () {
  'use strict';
  const B = window.B;

  B.gallery = {
    async add(it) { const item = Object.assign({ id: B.uid('g'), created: Date.now() }, it); await B.db.put('gallery', item); B.emit('gallery'); return item; },
    async list() { return (await B.db.all('gallery')).sort((a, b) => b.created - a.created); },
    async remove(id) { await B.db.del('gallery', id); B.emit('gallery'); }
  };

  const RATIOS = [['1:1', 1, 1], ['4:5', 4, 5], ['3:4', 3, 4], ['9:16', 9, 16], ['16:9', 16, 9], ['3:2', 3, 2], ['21:9', 21, 9]];
  const IDEAS = [
    'Una tazza di espresso su un tavolo di legno scuro, vapore, luce del mattino dalla finestra, fotografia',
    'Ritratto ravvicinato di un anziano pescatore con occhi marroni intensi, rughe, luce dorata',
    'Una biblioteca antica dentro una cattedrale gotica, raggi di luce, polvere sospesa',
    'Logo minimale per una torrefazione chiamata “Ambra”, chicco di caffè e occhio stilizzato',
    'Città futuristica nel deserto al tramonto, architetture in rame, atmosfera cinematografica',
    'Gatto rosso addormentato su un davanzale, pioggia sul vetro, toni caldi'
  ];

  B.view('imagine', {
    title: 'Immagini AI', icon: 'ImagePlus', group: 'ai', desc: 'Genera foto, illustrazioni e scene 3D', badge: 'AI',
    mount(el) {
      const st = { engine: null, style: 'photo', ratio: '1:1', count: 1, busy: false };
      el.classList.add('imagine-view');
      const left = B.h('aside', { class: 'gen-panel scroll' });
      const right = B.h('div', { class: 'gen-results scroll' });
      el.append(B.h('div', { class: 'gen-layout' }, left, right));

      /* controls */
      const ta = B.h('textarea', { class: 'textarea', id: 'imgPrompt', rows: 5, placeholder: 'Descrivi l’immagine: soggetto, luogo, luce, stile… Più dettagli dai, più sarà fedele.' });
      const enh = B.h('button', { class: 'btn sm ghost', type: 'button', onclick: enhance }, B.h('span', { 'data-i': 'Wand2' }), 'Migliora il prompt');
      const ideaBtn = B.h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { ta.value = B.pick(IDEAS); } }, B.h('span', { 'data-i': 'Dice5' }), 'Ispirami');
      const engWrap = B.h('div', { class: 'eng-list' });
      const styleWrap = B.h('div', { class: 'chips' });
      Object.entries(B.ai.STYLES).forEach(([k, s]) => styleWrap.append(B.h('button', { class: 'chip' + (k === st.style ? ' on' : ''), type: 'button', 'data-s': k, onclick: () => { st.style = k; B.$$('[data-s]', styleWrap).forEach((c) => c.classList.toggle('on', c.dataset.s === k)); } }, s.label)));
      const ratioWrap = B.h('div', { class: 'ratio-row' });
      RATIOS.forEach(([k, a, b]) => {
        const sc = 22 / Math.max(a, b);
        ratioWrap.append(B.h('button', { class: 'ratio' + (k === st.ratio ? ' on' : ''), type: 'button', 'data-r': k, onclick: () => { st.ratio = k; B.$$('[data-r]', ratioWrap).forEach((c) => c.classList.toggle('on', c.dataset.r === k)); } }, B.h('i', { style: { width: a * sc + 'px', height: b * sc + 'px' } }), k));
      });
      const countSeg = B.h('div', { class: 'seg' });
      [1, 2, 4].forEach((n) => countSeg.append(B.h('button', { type: 'button', class: n === st.count ? 'on' : '', 'data-n': n, onclick: () => { st.count = n; B.$$('button', countSeg).forEach((c) => c.classList.toggle('on', +c.dataset.n === n)); } }, String(n))));
      const neg = B.h('input', { class: 'input sm', id: 'imgNeg', placeholder: 'Da evitare (es. testo, mani deformi)' });
      const goBtn = B.h('button', { class: 'btn gold lg block', type: 'button', onclick: generate }, B.h('span', { 'data-i': 'Sparkles' }), 'Genera');
      left.append(
        B.h('div', { class: 'gen-head' }, B.h('span', { class: 'eyebrow', text: 'Iris Vision' }), B.h('h1', { text: 'Immagini AI' })),
        B.h('div', { class: 'field' }, B.h('label', { for: 'imgPrompt', text: 'Prompt' }), ta, B.h('div', { class: 'row' }, enh, ideaBtn)),
        B.h('div', { class: 'field' }, B.h('span', { class: 'lbl', text: 'Motore' }), engWrap),
        B.h('div', { class: 'field' }, B.h('span', { class: 'lbl', text: 'Stile' }), styleWrap),
        B.h('div', { class: 'field' }, B.h('span', { class: 'lbl', text: 'Formato' }), ratioWrap),
        B.h('div', { class: 'row', style: 'justify-content:space-between' }, B.h('span', { class: 'lbl', text: 'Varianti' }), countSeg),
        B.h('div', { class: 'field' }, B.h('label', { for: 'imgNeg', text: 'Prompt negativo' }), neg),
        goBtn
      );
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate(); });

      function paintEngines() {
        const list = B.ai.imageEngines();
        engWrap.innerHTML = '';
        if (!list.length) { engWrap.append(B.h('div', { class: 'mini-note', text: 'Connessione ai motori in corso…' })); return; }
        if (!st.engine || !list.find((x) => x.id === st.engine)) st.engine = list[0].id;
        list.forEach((e) => engWrap.append(B.h('button', { class: 'eng' + (e.id === st.engine ? ' on' : ''), type: 'button', 'data-e': e.id, onclick: () => { st.engine = e.id; paintEngines(); } }, B.h('span', { class: 'eng-ic', 'data-i': e.icon }), B.h('span', null, B.h('b', { text: e.label }), B.h('small', { text: e.sub })))));
        B.hydrateIcons(engWrap);
      }
      B.ai.init().then(paintEngines); paintEngines();

      async function enhance() {
        const p = ta.value.trim(); if (!p) return B.toast('Scrivi prima un’idea da migliorare');
        enh.disabled = true;
        try { ta.value = await B.ai.enhancePrompt(p); B.toast('Prompt arricchito', 'ok'); } catch (e) { B.err(e); }
        enh.disabled = false;
      }

      /* results */
      const batch = B.h('div', { class: 'gen-batch' });
      const galHead = B.h('div', { class: 'section-title' }, B.h('h2', { text: 'Galleria' }), B.h('span', { class: 'muted', text: 'Le immagini restano nel tuo browser' }));
      const gal = B.h('div', { class: 'gal-grid' });
      const inspo = B.h('div', { class: 'inspo' });
      right.append(batch, inspo, galHead, gal);

      function renderInspo() {
        inspo.innerHTML = '';
        inspo.append(B.h('div', { class: 'section-title' }, B.h('h2', { text: 'Scene dal vivo' }), B.h('span', { class: 'muted', text: 'Generate in tempo reale dalla GPU' })));
        const g = B.h('div', { class: 'inspo-grid' });
        Object.entries(B.shader.presets).forEach(([k, p]) => {
          const card = B.h('div', { class: 'inspo-card' });
          const cv = B.h('canvas', { width: 480, height: 300 });
          card.append(cv, B.h('div', { class: 'inspo-lbl' }, B.h('b', { text: p.label }), B.h('button', { class: 'btn sm', type: 'button', onclick: async () => { const blob = await B.shader.still(p.code, 1920, 1080, 4); await B.gallery.add({ blob, prompt: p.label, engine: 'shader', kind: 'shader', code: p.code, w: 1920, h: 1080 }); B.toast('Salvata in galleria', 'ok'); } }, B.h('span', { 'data-i': 'Download' }), 'Salva 4K')));
          g.append(card);
          liveShader(cv, p.code);
        });
        inspo.append(g); B.hydrateIcons(inspo);
      }
      renderInspo();

      async function generate() {
        if (st.busy) return;
        const prompt = ta.value.trim();
        if (!prompt) { ta.focus(); return B.toast('Scrivi cosa vuoi vedere'); }
        await B.ai.init();
        if (!st.engine) return B.toast('Nessun motore disponibile in questo momento', 'err');
        const r = RATIOS.find((x) => x[0] === st.ratio);
        const base = 1024, w = r[1] >= r[2] ? base : Math.round(base * r[1] / r[2] / 8) * 8, h = r[2] >= r[1] ? base : Math.round(base * r[2] / r[1] / 8) * 8;
        const W = r[1] > r[2] ? Math.round(base * r[1] / r[2] / 8) * 8 : w, H = r[2] > r[1] ? Math.round(base * r[2] / r[1] / 8) * 8 : h;
        st.busy = true; goBtn.disabled = true; inspo.hidden = true;
        const n = st.engine === 'shader' || st.engine === 'vector' ? Math.min(st.count, 2) : st.count;
        batch.innerHTML = '';
        batch.append(B.h('div', { class: 'batch-head' }, B.h('b', { text: prompt }), B.h('span', { class: 'badge gold', text: (B.ai.imageEngines().find((e) => e.id === st.engine) || {}).label || st.engine })));
        const grid = B.h('div', { class: 'batch-grid n' + n });
        batch.append(grid);
        const slots = [];
        for (let i = 0; i < n; i++) { const s = B.h('div', { class: 'slot', style: { aspectRatio: W + '/' + H } }, B.h('div', { class: 'slot-load' }, B.h('div', { class: 'iris-spin' }), B.h('span', { text: n > 1 ? 'Variante ' + (i + 1) : 'Iris sta creando…' }))); slots.push(s); grid.append(s); }
        for (let i = 0; i < n; i++) {
          try {
            const res = await B.ai.image(prompt, { engine: st.engine, style: st.style, w: W, h: H, negative: neg.value.trim() || null });
            const item = await B.gallery.add({ blob: res.blob, prompt, engine: res.engine, kind: res.kind, svg: res.svg, code: res.code, remoteUrl: res.remoteUrl, w: W, h: H, style: st.style });
            slots[i].replaceWith(resultCard(item, true));
          } catch (e) {
            slots[i].innerHTML = '';
            slots[i].append(B.h('div', { class: 'slot-err' }, B.h('span', { 'data-i': 'AlertTriangle' }), B.h('span', { text: B.ai.errorText(e) })));
            B.hydrateIcons(slots[i]);
            if (st.engine === 'hf') B.toast('Puoi passare al motore Vettoriale o Procedurale: sono illimitati.');
            break;
          }
        }
        st.busy = false; goBtn.disabled = false;
      }

      function resultCard(item, big) {
        const card = B.h('figure', { class: 'res' + (big ? ' big' : '') });
        let media;
        if (item.kind === 'shader' && item.code) { media = B.h('canvas', { width: Math.min(960, item.w), height: Math.round(Math.min(960, item.w) * item.h / item.w) }); liveShader(media, item.code); }
        else if (item.blob) media = B.h('img', { src: URL.createObjectURL(item.blob), alt: item.prompt, loading: 'lazy' });
        else media = B.h('div', { class: 'slot-err' }, 'Anteprima non disponibile', item.remoteUrl ? B.h('a', { href: item.remoteUrl, target: '_blank', rel: 'noopener', text: 'Apri l’immagine' }) : null);
        media.addEventListener('click', () => lightbox(item));
        const acts = B.h('div', { class: 'res-acts' },
          iconBtn('Download', 'Scarica', (e) => downloadMenu(item, e.currentTarget)),
          iconBtn('Aperture', 'Ritocca in Foto Studio', () => openIn('photo', item)),
          iconBtn('LayoutTemplate', 'Usa in un design', () => openIn('design', item)),
          iconBtn('Film', 'Anima in video', () => B.go('motion', { galleryId: item.id, prompt: item.prompt })),
          iconBtn('RefreshCw', 'Altre varianti', () => { ta.value = item.prompt; generate(); }),
          iconBtn('Trash2', 'Elimina', async () => { await B.gallery.remove(item.id); card.remove(); }));
        card.append(media, B.h('figcaption', null, B.h('span', { class: 'res-p', text: item.prompt }), B.h('span', { class: 'badge', text: { web: 'Flux', hf: 'Z-Image', vector: 'SVG', shader: 'GPU' }[item.engine] || item.engine })), acts);
        B.hydrateIcons(card);
        return card;
      }
      function iconBtn(ic, tip, fn) { return B.h('button', { class: 'btn icon sm', type: 'button', 'data-tip': tip, 'aria-label': tip, 'data-i': ic, onclick: (e) => { e.stopPropagation(); fn(e); } }); }
      async function openIn(view, item) { const url = item.blob ? await B.blobToDataURL(item.blob) : null; if (!url) return B.toast('Immagine non disponibile'); B.go(view, { imageURL: url, svg: item.svg }); }
      function downloadMenu(item, at) {
        const base = B.slug(item.prompt);
        const items = [{ label: 'PNG', icon: 'FileImage', fn: () => B.save(item.blob, base + '.png') },
          { label: 'JPG', icon: 'FileImage', fn: async () => { const im = await B.loadImage(item.blob); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0); B.save(await B.canvasToBlob(c, 'image/jpeg', 0.92), base + '.jpg'); } }];
        if (item.svg) items.push({ label: 'SVG vettoriale', icon: 'PenTool', fn: () => B.save(new Blob([item.svg], { type: 'image/svg+xml' }), base + '.svg') });
        if (item.code) items.push({ label: 'Codice shader (GLSL)', icon: 'Code2', fn: () => B.save(new Blob([item.code], { type: 'text/plain' }), base + '.glsl') }, { label: 'Video 8 s (WebM/MP4)', icon: 'Film', fn: () => B.go('motion', { shader: item.code, prompt: item.prompt }) });
        B.menu(at, items);
      }
      function lightbox(item) {
        const body = B.h('div', { class: 'lightbox' });
        if (item.kind === 'shader' && item.code) { const c = B.h('canvas', { width: 1280, height: Math.round(1280 * item.h / item.w) }); liveShader(c, item.code); body.append(c); }
        else if (item.blob) body.append(B.h('img', { src: URL.createObjectURL(item.blob), alt: item.prompt }));
        body.append(B.h('p', { class: 'muted', text: item.prompt + ' · ' + item.w + '×' + item.h }));
        B.modal({ title: 'Anteprima', body, xwide: true, actions: [{ label: 'Copia prompt', icon: 'Copy', fn: () => { B.copy(item.prompt); return false; } }, { label: 'Ritocca', icon: 'Aperture', fn: () => openIn('photo', item) }, { label: 'Scarica PNG', kind: 'gold', icon: 'Download', fn: () => B.save(item.blob, B.slug(item.prompt) + '.png') }] });
      }

      async function renderGallery() {
        const list = await B.gallery.list();
        gal.innerHTML = '';
        galHead.hidden = !list.length;
        list.slice(0, 120).forEach((it) => gal.append(resultCard(it)));
      }
      B.on('gallery', B.debounce(renderGallery, 120)); renderGallery();
      this.run = (p) => { ta.value = p.prompt || ''; if (p.auto && ta.value) generate(); };
    },
    onShow(p) { if (p && p.prompt) this.run(p); }
  });

  /* live shader preview that pauses when off-screen */
  const live = new Set();
  function liveShader(canvas, code) {
    try { B.shader.pool.program(code); } catch (e) { const x = canvas.getContext('2d'); if (x) { x.fillStyle = '#1b110b'; x.fillRect(0, 0, canvas.width, canvas.height); } return; }
    const t0 = performance.now() - Math.random() * 4000;
    const o = { canvas, vis: true, last: 0 };
    live.add(o);
    const io = new IntersectionObserver((en) => { o.vis = en[0].isIntersecting; });
    io.observe(canvas);
    let attached = false;
    function loop(now) {
      if (!canvas.isConnected && attached) { live.delete(o); io.disconnect(); return; }
      if (canvas.isConnected) attached = true;
      if (o.vis && !document.hidden && canvas.offsetParent && now - o.last > 33) {
        o.last = now;
        try { B.shader.pool.draw(code, canvas, (now - t0) / 1000); } catch (e) { live.delete(o); io.disconnect(); return; }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }
  B.liveShader = liveShader;
})();
