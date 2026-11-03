/* Strumenti — quick utilities: background removal, converter, palettes, QR, gradients, music, OCR, collage, icons, voice, naming */
(function () {
  'use strict';
  const B = window.B;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  const TOOLS = [
    ['bg', 'Rimuovi sfondo', 'Scissors', 'Scontorna soggetti e prodotti in un clic, con PNG trasparente.'],
    ['convert', 'Converti e comprimi', 'ImageDown', 'PNG, JPG e WebP, ridimensiona e alleggerisci anche in blocco.'],
    ['palette', 'Palette da foto', 'Palette', 'Estrai i colori dominanti di un’immagine con codici HEX.'],
    ['aipalette', 'Palette AI', 'Sparkles', 'Descrivi un’atmosfera: Thorion crea la palette perfetta.'],
    ['qr', 'Codice QR', 'QrCode', 'QR per link, Wi-Fi e contatti, con i colori del tuo brand.'],
    ['gradient', 'Gradienti', 'Blend', 'Crea sfondi sfumati e copia il CSS pronto.'],
    ['music', 'Musica AI', 'Music', 'Componi colonne sonore originali senza copyright.'],
    ['ocr', 'Testo da immagine', 'ScanFace', 'Estrai il testo da foto, screenshot e scansioni con l’AI.'],
    ['collage', 'Collage', 'Grid3x3', 'Unisci più foto in una griglia elegante.'],
    ['icons', 'Icone app e favicon', 'Gem', 'Da un’immagine a tutte le dimensioni per web e app.'],
    ['voice', 'Lettura vocale', 'Volume2', 'Fai leggere un testo dalle voci del tuo dispositivo.'],
    ['naming', 'Nomi e slogan', 'Lightbulb', 'Idee di nomi, slogan e claim per il tuo progetto.']
  ];

  B.view('tools', {
    title: 'Strumenti', icon: 'Wand2', group: 'more', desc: 'Utilità creative rapide',
    mount(el) {
      const page = B.h('div', { class: 'page' }), inner = B.h('div', { class: 'page-in' });
      page.append(inner); el.append(page);
      inner.append(B.h('div', { class: 'page-head' }, B.h('div', null, B.h('span', { class: 'eyebrow', text: 'Cassetta degli attrezzi' }), B.h('h1', { text: 'Strumenti' }), B.h('p', { text: 'Piccole utilità che fanno risparmiare tempo. Tutto gira nel browser, l’AI interviene solo dove serve.' }))));
      const g = B.h('div', { class: 'home-grid' });
      TOOLS.forEach(([k, t, ic, d], i) => g.append(B.h('button', { class: 'tool-card', type: 'button', style: { '--tc': 'linear-gradient(140deg,#c98a2e,#4a2c1a)', animationDelay: i * 35 + 'ms', minHeight: '150px' }, onclick: () => open(k) }, B.h('span', { class: 'tc-ic', 'data-i': ic }), B.h('h3', { text: t }), B.h('p', { text: d }))));
      inner.append(g);
      function open(k) { ({ bg: tBg, convert: tConvert, palette: tPalette, aipalette: tAiPalette, qr: tQr, gradient: tGradient, music: tMusic, ocr: tOcr, collage: tCollage, icons: tIcons, voice: tVoice, naming: tNaming })[k](); }
      this.open = open;
    },
    onShow(p) { if (p && p.tool) this.open(p.tool); }
  });

  function pick(accept, multiple) { return B.pickFiles(accept || 'image/*', multiple); }
  function zone(label, accept, multiple, cb) { const z = B.h('div', { class: 'dropzone' }, B.h('span', { 'data-i': 'Upload' }), B.h('b', { text: label }), B.h('small', { text: 'Clicca o trascina qui' })); z.addEventListener('click', async () => { const fs = await pick(accept, multiple); if (fs.length) cb(fs); }); B.dropzone(z, cb, accept); return z; }

  /* ---------- remove background ---------- */
  function tBg() {
    const body = B.h('div', { class: 'tl-box' });
    let src = null, out = null;
    const prev = B.h('div', { class: 'tl-compare', hidden: true });
    const tol = B.slider({ label: 'Tolleranza sfondo', min: 10, max: 90, value: 38, onChange: () => run() });
    const actions = B.h('div', { class: 'chips', hidden: true },
      B.h('button', { class: 'btn gold', type: 'button', onclick: async () => B.save(await B.canvasToBlob(out), 'scontornato.png') }, B.h('span', { 'data-i': 'Download' }), 'Scarica PNG'),
      B.h('button', { class: 'btn', type: 'button', onclick: () => { m.close(); B.go('photo', { imageURL: out.toDataURL('image/png') }); } }, B.h('span', { 'data-i': 'Aperture' }), 'Rifinisci nel Foto Studio'),
      B.h('button', { class: 'btn', type: 'button', onclick: () => { m.close(); B.go('design', { imageURL: out.toDataURL('image/png') }); } }, B.h('span', { 'data-i': 'LayoutTemplate' }), 'Usa in un design'));
    body.append(zone('Scegli una foto', 'image/*', false, async (fs) => { const im = await B.loadImage(fs[0]); src = mk(im.naturalWidth, im.naturalHeight); src.getContext('2d').drawImage(im, 0, 0); run(); }), tol, prev, actions);
    async function run() {
      if (!src) return; prev.hidden = false; prev.innerHTML = '<div class="iris-spin"></div>';
      await B.sleep(30);
      out = await B.removeBackground(src, { tolerance: +tol.input.value });
      prev.innerHTML = ''; const a = B.h('img', { src: src.toDataURL('image/jpeg', 0.85), alt: 'Prima' }), b = B.h('img', { src: out.toDataURL('image/png'), alt: 'Dopo', class: 'after' });
      const r = B.h('input', { type: 'range', class: 'range', min: 0, max: 100, value: 50, 'aria-label': 'Confronta' });
      r.addEventListener('input', () => { b.style.clipPath = 'inset(0 0 0 ' + r.value + '%)'; }); b.style.clipPath = 'inset(0 0 0 50%)';
      prev.append(B.h('div', { class: 'tl-cmp' }, a, b), r); actions.hidden = false; B.hydrateIcons(actions); B.rangeFill(r);
    }
    const m = B.modal({ title: 'Rimuovi sfondo', icon: 'Scissors', body, wide: true });
    B.hydrateIcons(body);
  }

  /* ---------- converter ---------- */
  function tConvert() {
    const body = B.h('div', { class: 'tl-box' });
    let files = [];
    const fmt = B.h('select', { class: 'select sm', 'aria-label': 'Formato' }, [['image/webp', 'WebP (leggero)'], ['image/jpeg', 'JPG'], ['image/png', 'PNG']].map(([v, l]) => B.h('option', { value: v }, l)));
    const q = B.slider({ label: 'Qualità', min: 30, max: 100, value: 82, unit: '%' });
    const maxw = B.h('input', { class: 'input sm', type: 'number', placeholder: 'Larghezza max (px)', 'aria-label': 'Larghezza massima' });
    const list = B.h('div', { class: 'tl-list' });
    const go = B.h('button', { class: 'btn gold', type: 'button', onclick: convert }, B.h('span', { 'data-i': 'Zap' }), 'Converti');
    body.append(zone('Scegli una o più immagini', 'image/*', true, (fs) => { files = fs; list.innerHTML = ''; fs.forEach((f) => list.append(B.h('div', { class: 'tl-row2' }, B.h('span', { text: f.name }), B.h('span', { class: 'muted', text: B.fmtBytes(f.size) })))); }), B.h('div', { class: 'grid2' }, fmt, maxw), q, list, go);
    async function convert() {
      if (!files.length) return B.toast('Scegli prima le immagini');
      go.disabled = true; const outs = [];
      list.innerHTML = '';
      for (const f of files) {
        const im = await B.loadImage(f); let w = im.naturalWidth, h = im.naturalHeight; const mw = +maxw.value; if (mw && w > mw) { h = Math.round(h * mw / w); w = mw; }
        const c = mk(w, h), x = c.getContext('2d'); if (fmt.value === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); } x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, w, h);
        const b = await B.canvasToBlob(c, fmt.value, +q.input.value / 100); const name = f.name.replace(/\.[^.]+$/, '') + '.' + (fmt.value.split('/')[1] === 'jpeg' ? 'jpg' : fmt.value.split('/')[1]);
        outs.push([name, b]);
        const pct = Math.round((1 - b.size / f.size) * 100);
        list.append(B.h('div', { class: 'tl-row2' }, B.h('span', { text: name }), B.h('span', { class: pct > 0 ? 'badge ok' : 'badge', text: B.fmtBytes(f.size) + ' → ' + B.fmtBytes(b.size) + (pct > 0 ? ' (−' + pct + '%)' : '') }), B.h('button', { class: 'btn sm', type: 'button', onclick: () => B.save(b, name) }, 'Scarica')));
      }
      if (outs.length > 1) { await B.need('jszip'); const z = new window.JSZip(); outs.forEach(([n, b]) => z.file(n, b)); list.append(B.h('button', { class: 'btn gold', type: 'button', onclick: async () => B.save(await z.generateAsync({ type: 'blob' }), 'immagini-convertite.zip') }, 'Scarica tutte (ZIP)')); }
      go.disabled = false;
    }
    B.modal({ title: 'Converti e comprimi immagini', icon: 'ImageDown', body, wide: true }); B.hydrateIcons(body);
  }

  /* ---------- palette from image ---------- */
  B.extractPalette = function (img, k = 6) {
    const c = mk(120, 120 * img.naturalHeight / img.naturalWidth), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height).data, px = [];
    for (let i = 0; i < d.length; i += 8) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
    let cents = Array.from({ length: k }, (_, i) => px[Math.floor(i / k * px.length)] || [0, 0, 0]);
    for (let it = 0; it < 10; it++) {
      const acc = cents.map(() => [0, 0, 0, 0]);
      px.forEach((p) => { let bi = 0, bd = 1e9; cents.forEach((c2, j) => { const dd = (p[0] - c2[0]) ** 2 + (p[1] - c2[1]) ** 2 + (p[2] - c2[2]) ** 2; if (dd < bd) { bd = dd; bi = j; } }); const a = acc[bi]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++; });
      cents = acc.map((a, j) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3], a[3]] : cents[j]));
    }
    return cents.sort((a, b) => (b[3] || 0) - (a[3] || 0)).map((c2) => B.rgbToHex(c2[0], c2[1], c2[2]));
  };
  function swatchRow(cols) {
    const row = B.h('div', { class: 'tl-pal' });
    cols.forEach((c) => row.append(B.h('button', { class: 'tl-sw', type: 'button', style: { background: c, color: lum(c) > 140 ? '#22140b' : '#fffaf1' }, onclick: () => B.copy(c) }, B.h('span', { text: c.toUpperCase() }))));
    return row;
  }
  function lum(c) { const [r, g, b] = B.hexToRgb(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  function tPalette() {
    const body = B.h('div', { class: 'tl-box' }); const res = B.h('div');
    body.append(zone('Scegli un’immagine', 'image/*', false, async (fs) => {
      const im = await B.loadImage(fs[0]); const cols = B.extractPalette(im, 6);
      res.innerHTML = ''; res.append(B.h('img', { src: im.src, alt: '', class: 'tl-img' }), swatchRow(cols),
        B.h('div', { class: 'chips' }, B.h('button', { class: 'btn sm', type: 'button', onclick: () => B.copy(':root {\n' + cols.map((c, i) => '  --colore-' + (i + 1) + ': ' + c + ';').join('\n') + '\n}') }, B.h('span', { 'data-i': 'Code2' }), 'Copia come CSS'), B.h('button', { class: 'btn sm', type: 'button', onclick: () => B.copy(cols.join(', ')) }, B.h('span', { 'data-i': 'Copy' }), 'Copia HEX')));
      B.hydrateIcons(res);
    }), res);
    B.modal({ title: 'Palette da foto', icon: 'Palette', body, wide: true }); B.hydrateIcons(body);
  }
  function tAiPalette() {
    const body = B.h('div', { class: 'tl-box' }); const res = B.h('div', { class: 'tl-box' });
    const inp = B.h('input', { class: 'input', id: 'tlPalIn', placeholder: 'es. “caffetteria scandinava al tramonto”' });
    const go = B.h('button', { class: 'btn gold', type: 'button', onclick: async () => {
      if (!inp.value.trim()) return; go.disabled = true; res.innerHTML = '<div class="iris-spin"></div>';
      try { const r = await B.ai.json('Crea 3 palette di 5 colori HEX ispirate a: "' + inp.value + '". Rispondi solo con JSON: {"palettes":[{"name":"nome evocativo","colors":["#..."],"uso":"breve consiglio d’uso"}]}', { system: false, tier: 'quick' }); res.innerHTML = ''; (r.palettes || []).forEach((p) => res.append(B.h('div', null, B.h('b', { text: p.name }), B.h('div', { class: 'mini-note', text: p.uso || '' }), swatchRow((p.colors || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)))))); }
      catch (e) { res.textContent = B.ai.errorText(e); }
      go.disabled = false;
    } }, B.h('span', { 'data-i': 'Sparkles' }), 'Crea palette');
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
    body.append(B.h('div', { class: 'row' }, inp, go), res);
    B.modal({ title: 'Palette AI', icon: 'Sparkles', body, wide: true }); B.hydrateIcons(body);
  }

  /* ---------- QR ---------- */
  function tQr() {
    const body = B.h('div', { class: 'tl-box tl-split' });
    const type = B.h('select', { class: 'select sm', 'aria-label': 'Tipo' }, [['url', 'Link / testo'], ['wifi', 'Rete Wi-Fi'], ['vcard', 'Contatto'], ['mail', 'Email']].map(([v, l]) => B.h('option', { value: v }, l)));
    const a = B.h('input', { class: 'input sm', id: 'qrA', value: 'https://breye.studio', 'aria-label': 'Contenuto' });
    const b2 = B.h('input', { class: 'input sm', id: 'qrB', placeholder: 'Password / telefono', 'aria-label': 'Secondo campo', hidden: true });
    const fg = B.h('input', { type: 'color', class: 'swatch-in', value: '#3b2314', 'aria-label': 'Colore' }), bg = B.h('input', { type: 'color', class: 'swatch-in', value: '#fffaf1', 'aria-label': 'Sfondo' });
    const logo = B.h('input', { type: 'checkbox', checked: true, 'aria-label': 'Logo al centro' });
    const cv = mk(600, 600); cv.className = 'tl-qr';
    const draw = B.debounce(async () => {
      try {
        await B.need('qr');
        let v = a.value;
        if (type.value === 'wifi') v = 'WIFI:T:WPA;S:' + a.value + ';P:' + b2.value + ';;';
        if (type.value === 'vcard') v = 'BEGIN:VCARD\nVERSION:3.0\nFN:' + a.value + '\nTEL:' + b2.value + '\nEND:VCARD';
        if (type.value === 'mail') v = 'mailto:' + a.value;
        const q = new window.QRious({ value: v || ' ', size: 600, level: 'H', foreground: fg.value, background: bg.value, padding: 30 });
        const x = cv.getContext('2d'); x.clearRect(0, 0, 600, 600); x.drawImage(q.canvas || q.image, 0, 0, 600, 600);
        if (logo.checked) { const im = await B.loadImage('assets/thorion-logo-256.webp').catch(() => null); if (im) { x.fillStyle = bg.value; x.beginPath(); x.arc(300, 300, 70, 0, 7); x.fill(); x.drawImage(im, 240, 240, 120, 120); } }
      } catch (e) { B.err(e); }
    }, 120);
    [type, a, b2, fg, bg, logo].forEach((i) => i.addEventListener('input', () => { b2.hidden = !['wifi', 'vcard'].includes(type.value); a.placeholder = type.value === 'wifi' ? 'Nome rete' : type.value === 'vcard' ? 'Nome e cognome' : type.value === 'mail' ? 'indirizzo@email.it' : 'https://'; draw(); }));
    body.append(B.h('div', { class: 'tl-box' }, type, a, b2, B.h('div', { class: 'row' }, fg, B.h('span', { class: 'mini-note', text: 'Colore' }), bg, B.h('span', { class: 'mini-note', text: 'Sfondo' })), B.h('label', { class: 'row', style: 'gap:8px;font-size:13px' }, B.h('span', { class: 'switch' }, logo, B.h('span')), 'Occhio Thorion al centro'),
      B.h('button', { class: 'btn gold', type: 'button', onclick: async () => B.save(await B.canvasToBlob(cv), 'qr-breye.png') }, B.h('span', { 'data-i': 'Download' }), 'Scarica PNG')), cv);
    B.modal({ title: 'Codice QR', icon: 'QrCode', body, wide: true }); B.hydrateIcons(body); draw();
  }

  /* ---------- gradient ---------- */
  function tGradient() {
    const body = B.h('div', { class: 'tl-box' });
    const cols = ['#3b2314', '#c98a2e', '#f3d088'];
    const ins = cols.map((c, i) => B.h('input', { type: 'color', class: 'swatch-in', value: c, 'aria-label': 'Colore ' + (i + 1) }));
    const kind = B.h('select', { class: 'select sm', 'aria-label': 'Tipo' }, [['linear', 'Lineare'], ['radial', 'Radiale'], ['conic', 'Conico']].map(([v, l]) => B.h('option', { value: v }, l)));
    const ang = B.slider({ label: 'Angolo', min: 0, max: 360, value: 135, unit: '°' });
    const prev = B.h('div', { class: 'tl-grad' }); const code = B.h('pre', { class: 'tl-code mono' });
    const css = () => { const c = ins.map((i) => i.value).join(', '); return kind.value === 'linear' ? 'linear-gradient(' + ang.input.value + 'deg, ' + c + ')' : kind.value === 'radial' ? 'radial-gradient(circle at 50% 40%, ' + c + ')' : 'conic-gradient(from ' + ang.input.value + 'deg, ' + c + ', ' + ins[0].value + ')'; };
    const upd = () => { prev.style.background = css(); code.textContent = 'background: ' + css() + ';'; };
    [...ins, kind, ang.input].forEach((i) => i.addEventListener('input', upd));
    body.append(prev, B.h('div', { class: 'row' }, ...ins, kind), ang, code, B.h('div', { class: 'chips' },
      B.h('button', { class: 'btn', type: 'button', onclick: () => B.copy('background: ' + css() + ';') }, B.h('span', { 'data-i': 'Copy' }), 'Copia CSS'),
      B.h('button', { class: 'btn gold', type: 'button', onclick: async () => { const c = mk(1920, 1080), x = c.getContext('2d'); const v = ins.map((i) => i.value); let g; if (kind.value === 'radial') g = x.createRadialGradient(960, 432, 0, 960, 432, 1100); else if (kind.value === 'conic' && x.createConicGradient) g = x.createConicGradient(+ang.input.value * Math.PI / 180, 960, 540); else { const a = (+ang.input.value - 90) * Math.PI / 180; g = x.createLinearGradient(960 - Math.cos(a) * 1100, 540 - Math.sin(a) * 1100, 960 + Math.cos(a) * 1100, 540 + Math.sin(a) * 1100); } v.forEach((c2, i) => g.addColorStop(i / (v.length - 1), c2)); x.fillStyle = g; x.fillRect(0, 0, 1920, 1080); B.save(await B.canvasToBlob(c), 'gradiente.png'); } }, B.h('span', { 'data-i': 'Download' }), 'Scarica 1920×1080')));
    upd(); B.modal({ title: 'Gradienti', icon: 'Blend', body, wide: true }); B.hydrateIcons(body);
  }

  /* ---------- music ---------- */
  function tMusic() {
    const body = B.h('div', { class: 'tl-box' });
    const mood = B.h('div', { class: 'chips' }); let cur = 'cinematic';
    Object.entries(B.music.MOODS).filter(([k]) => k !== 'none').forEach(([k, m]) => mood.append(B.h('button', { class: 'chip' + (k === cur ? ' on' : ''), type: 'button', 'data-k': k, onclick: () => { cur = k; B.$$('.chip', mood).forEach((c) => c.classList.toggle('on', c.dataset.k === k)); } }, m.label)));
    const dur = B.slider({ label: 'Durata', min: 5, max: 180, value: 30, unit: ' s' });
    const player = B.h('audio', { controls: true, class: 'tl-audio', hidden: true });
    let blob = null;
    const acts = B.h('div', { class: 'chips', hidden: true }, B.h('button', { class: 'btn', type: 'button', onclick: () => B.save(blob, 'musica-breye-' + cur + '.wav') }, B.h('span', { 'data-i': 'Download' }), 'Scarica WAV'), B.h('button', { class: 'btn', type: 'button', onclick: () => { m.close(); B.go('video', { importBlob: blob, name: 'Musica ' + cur + '.wav' }); } }, B.h('span', { 'data-i': 'Clapperboard' }), 'Usa nel Video Editor'));
    const go = B.h('button', { class: 'btn gold', type: 'button', onclick: async () => { go.disabled = true; go.textContent = 'Compongo…'; try { const buf = await B.music.render({ mood: cur, duration: +dur.input.value, seed: Math.floor(Math.random() * 9999) }); blob = B.music.toWav(buf); player.src = URL.createObjectURL(blob); player.hidden = false; acts.hidden = false; player.play().catch(() => {}); } catch (e) { B.err(e); } go.disabled = false; go.textContent = 'Componi di nuovo'; } }, 'Componi');
    body.append(B.h('p', { class: 'mini-note', text: 'Ogni brano è unico, generato al momento dal sintetizzatore di Thorion: puoi usarlo liberamente nei tuoi video.' }), mood, dur, go, player, acts);
    const m = B.modal({ title: 'Musica AI', icon: 'Music', body, wide: true }); B.hydrateIcons(body);
  }

  /* ---------- OCR ---------- */
  function tOcr() {
    const body = B.h('div', { class: 'tl-box' }); const out = B.h('textarea', { class: 'textarea', rows: 10, id: 'tlOcrOut', placeholder: 'Il testo estratto comparirà qui', hidden: true });
    // Claude reads the pixels; elsewhere Tesseract runs locally in the browser (Italian + English), free and unlimited
    const note = B.h('p', { class: 'mini-note', text: B.ai.canRead() ? 'Thorion legge il testo dall’immagine mantenendo paragrafi ed elenchi.' : 'Lettura locale con Tesseract (italiano e inglese): gratuita, illimitata, la foto non lascia il tuo dispositivo. Al primo uso scarica circa 6 MB.' });
    body.append(note, zone('Scegli una foto, uno screenshot o una scansione', 'image/*', false, async (fs) => {
      out.hidden = false; out.value = 'Lettura in corso…';
      try {
        const im = await B.loadImage(fs[0]);
        if (B.ai.canRead()) { const s = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)); const c = mk(im.naturalWidth * s, im.naturalHeight * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); out.value = await B.ai.text('Trascrivi fedelmente tutto il testo presente in questa immagine, mantenendo la struttura (paragrafi, elenchi, tabelle in Markdown). Rispondi solo con il testo trascritto.', { system: false, images: [await B.canvasToBlob(c, 'image/jpeg', 0.9)], tier: 'default' }); }
        else {
          await B.need('tesseract');
          const s = Math.min(2, 2400 / Math.max(im.naturalWidth, im.naturalHeight)); const c = mk(im.naturalWidth * s, im.naturalHeight * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          const worker = await window.Tesseract.createWorker(['ita', 'eng'], 1, { logger: (m) => { if (m.status === 'recognizing text') out.value = 'Lettura in corso… ' + Math.round(m.progress * 100) + '%'; else if (/load/.test(m.status)) out.value = 'Preparo il lettore (solo la prima volta)…'; } });
          try { const r = await worker.recognize(c); out.value = (r.data.text || '').trim() || 'Nessun testo riconosciuto.'; } finally { worker.terminate(); }
        }
      } catch (e) { out.value = B.ai.errorText(e); }
    }), out, B.h('div', { class: 'chips' }, B.h('button', { class: 'btn', type: 'button', onclick: () => B.copy(out.value) }, B.h('span', { 'data-i': 'Copy' }), 'Copia'), B.h('button', { class: 'btn', type: 'button', onclick: () => { m.close(); B.go('docs', { markdown: out.value }); } }, B.h('span', { 'data-i': 'FileText' }), 'Apri nei Documenti')));
    const m = B.modal({ title: 'Testo da immagine', icon: 'ScanFace', body, wide: true }); B.hydrateIcons(body);
  }

  /* ---------- collage ---------- */
  function tCollage() {
    const body = B.h('div', { class: 'tl-box tl-split' }); let imgs = [];
    const cv = mk(1080, 1080); cv.className = 'tl-qr';
    const gap = B.slider({ label: 'Spazio', min: 0, max: 60, value: 16, onInput: () => draw() });
    const rad = B.slider({ label: 'Arrotondamento', min: 0, max: 80, value: 20, onInput: () => draw() });
    const bg = B.h('input', { type: 'color', class: 'swatch-in', value: '#fffaf1', 'aria-label': 'Sfondo', oninput: () => draw() });
    const fmt = B.h('select', { class: 'select sm', 'aria-label': 'Formato', onchange: () => draw() }, [['1080x1080', 'Quadrato'], ['1080x1350', 'Verticale 4:5'], ['1080x1920', 'Storia 9:16'], ['1920x1080', 'Orizzontale']].map(([v, l]) => B.h('option', { value: v }, l)));
    function draw() {
      const [W, H] = fmt.value.split('x').map(Number); cv.width = W; cv.height = H; const x = cv.getContext('2d'); x.fillStyle = bg.value; x.fillRect(0, 0, W, H);
      const n = imgs.length; if (!n) return;
      const cols = Math.ceil(Math.sqrt(n * W / H)), rows = Math.ceil(n / cols), g = +gap.input.value, r = +rad.input.value;
      const cw = (W - g * (cols + 1)) / cols, ch = (H - g * (rows + 1)) / rows;
      imgs.forEach((im, i) => { const cx = g + (i % cols) * (cw + g), cy = g + Math.floor(i / cols) * (ch + g); x.save(); x.beginPath(); x.roundRect ? x.roundRect(cx, cy, cw, ch, r) : x.rect(cx, cy, cw, ch); x.clip(); const s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight); x.drawImage(im, cx + (cw - im.naturalWidth * s) / 2, cy + (ch - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s); x.restore(); });
    }
    body.append(B.h('div', { class: 'tl-box' }, zone('Scegli da 2 a 12 foto', 'image/*', true, async (fs) => { imgs = []; for (const f of fs.slice(0, 12)) imgs.push(await B.loadImage(f)); draw(); }), fmt, gap, rad, B.h('div', { class: 'row' }, bg, B.h('span', { class: 'mini-note', text: 'Sfondo' })),
      B.h('button', { class: 'btn gold', type: 'button', onclick: async () => B.save(await B.canvasToBlob(cv, 'image/jpeg', 0.92), 'collage.jpg') }, B.h('span', { 'data-i': 'Download' }), 'Scarica')), cv);
    B.modal({ title: 'Collage', icon: 'Grid3x3', body, wide: true }); B.hydrateIcons(body); draw();
  }

  /* ---------- icons ---------- */
  function tIcons() {
    const body = B.h('div', { class: 'tl-box' }); const prev = B.h('div', { class: 'chips' });
    const round = B.h('input', { type: 'checkbox', 'aria-label': 'Angoli arrotondati' });
    body.append(zone('Scegli un’immagine quadrata (almeno 512 px)', 'image/*', false, async (fs) => {
      const im = await B.loadImage(fs[0]); const sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512]; await B.need('jszip'); const z = new window.JSZip(); prev.innerHTML = '';
      for (const s of sizes) { const c = mk(s, s), x = c.getContext('2d'); if (round.checked) { x.beginPath(); x.roundRect ? x.roundRect(0, 0, s, s, s * 0.22) : x.rect(0, 0, s, s); x.clip(); } const m2 = Math.min(im.naturalWidth, im.naturalHeight); x.imageSmoothingQuality = 'high'; x.drawImage(im, (im.naturalWidth - m2) / 2, (im.naturalHeight - m2) / 2, m2, m2, 0, 0, s, s); const b = await B.canvasToBlob(c); z.file((s === 180 ? 'apple-touch-icon' : 'icon-' + s) + '.png', b); if (s >= 32 && s <= 128) prev.append(B.h('img', { src: URL.createObjectURL(b), width: Math.min(64, s), height: Math.min(64, s), alt: s + 'px' })); }
      z.file('manifest-icons.json', JSON.stringify({ icons: sizes.filter((s) => s >= 192).map((s) => ({ src: 'icon-' + s + '.png', sizes: s + 'x' + s, type: 'image/png' })) }, null, 2));
      B.save(await z.generateAsync({ type: 'blob' }), 'icone-app.zip');
    }), B.h('label', { class: 'row', style: 'gap:8px;font-size:13px' }, B.h('span', { class: 'switch' }, round, B.h('span')), 'Angoli arrotondati (stile app)'), prev);
    B.modal({ title: 'Icone app e favicon', icon: 'Gem', body, wide: true }); B.hydrateIcons(body);
  }

  /* ---------- voice ---------- */
  function tVoice() {
    const body = B.h('div', { class: 'tl-box' });
    const ta = B.h('textarea', { class: 'textarea', id: 'tlVoiceT', rows: 5 }); ta.value = 'Ciao! Sono Thorion. Da oggi leggo i tuoi testi con una voce naturale, generata direttamente sul tuo dispositivo.';
    const vs = B.h('select', { class: 'select sm', 'aria-label': 'Voce' });
    B.voice.list.forEach((v) => vs.append(B.h('option', { value: v.id }, v.name + ' · ' + v.desc + ' (' + v.mb + ' MB)')));
    vs.append(B.h('option', { value: 'system' }, 'Voce del dispositivo (immediata)'));
    vs.value = B.ls.get('voice:sys', false) ? 'system' : B.voice.current('it').id;
    vs.addEventListener('change', () => { B.ls.set('voice:sys', vs.value === 'system'); if (vs.value !== 'system') B.voice.setVoice(vs.value); });
    const rate = B.slider({ label: 'Velocità (voce del dispositivo)', min: 50, max: 200, value: 100, unit: '%' });
    body.append(ta, vs, rate, B.h('div', { class: 'chips' },
      B.h('button', { class: 'btn gold', type: 'button', onclick: () => { const sys = vs.value === 'system'; const v = !sys && B.voice.list.find((x) => x.id === vs.value); B.voice.speak(ta.value, { system: sys, voice: v && v.id, lang: v ? v.lang : undefined, rate: +rate.input.value / 100 }).catch((e) => B.err(e)); } }, B.h('span', { 'data-i': 'Play' }), 'Leggi'),
      B.h('button', { class: 'btn', type: 'button', onclick: () => B.voice.stop() }, B.h('span', { 'data-i': 'StopCircle' }), 'Ferma')),
      B.h('p', { class: 'mini-note', text: 'Le voci neurali (Piper) vengono scaricate una sola volta e poi parlano direttamente sul tuo dispositivo: naturali, senza limiti e senza inviare il testo a nessun server.' }));
    B.modal({ title: 'Voce di lettura', icon: 'Volume2', body, wide: true, onClose: () => B.voice.stop() }); B.hydrateIcons(body);
  }
  B.voicePicker = tVoice;

  /* ---------- naming ---------- */
  function tNaming() {
    const body = B.h('div', { class: 'tl-box' }); const out = B.h('div', { class: 'tl-names' });
    const inp = B.h('textarea', { class: 'textarea', id: 'tlNameIn', rows: 3, placeholder: 'Descrivi il progetto: es. “app per prenotare lezioni di yoga all’aperto, pubblico 25-40 anni, tono rilassato”' });
    const go = B.h('button', { class: 'btn gold', type: 'button', onclick: async () => {
      if (!inp.value.trim()) return; go.disabled = true; out.innerHTML = '<div class="iris-spin"></div>';
      try { const r = await B.ai.json('Proponi 8 nomi brevi e memorabili (max 2 parole, preferibilmente inventati) e 4 slogan per: "' + inp.value + '". Rispondi solo con JSON: {"names":[{"name":"...","why":"perché funziona, 1 frase"}],"slogans":["..."]}', { system: false, tier: 'default' }); out.innerHTML = ''; (r.names || []).forEach((n) => out.append(B.h('button', { class: 'tl-name', type: 'button', onclick: () => B.copy(n.name) }, B.h('b', { text: n.name }), B.h('small', { text: n.why || '' })))); if (r.slogans) out.append(B.h('div', { class: 'tl-box', style: 'grid-column:1/-1' }, B.h('span', { class: 'lbl', text: 'Slogan' }), ...r.slogans.map((s) => B.h('div', { class: 'tl-row2' }, B.h('span', { text: '“' + s + '”' }), B.h('button', { class: 'btn sm ghost', type: 'button', onclick: () => B.copy(s) }, 'Copia'))))); }
      catch (e) { out.textContent = B.ai.errorText(e); }
      go.disabled = false;
    } }, B.h('span', { 'data-i': 'Lightbulb' }), 'Genera idee');
    body.append(inp, go, out);
    B.modal({ title: 'Nomi e slogan', icon: 'Lightbulb', body, wide: true }); B.hydrateIcons(body);
  }
})();
