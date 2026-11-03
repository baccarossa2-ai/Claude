/* Foto Studio — layered raster editor: tools, selections, adjustments, filters, AI retouch */
(function () {
  'use strict';
  const B = window.B;

  /* ================= pixel toolkit (shared) ================= */
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const clone = (c) => { const n = mk(c.width, c.height); n.getContext('2d').drawImage(c, 0, 0); return n; };
  B.px = { mk, clone };

  const ADJ0 = { exposure: 0, brightness: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temperature: 0, tint: 0, saturation: 0, vibrance: 0, hue: 0, fade: 0, vignette: 0, grain: 0, sharpen: 0, blur: 0, clarity: 0 };
  B.px.ADJ0 = ADJ0;
  B.px.adjust = function (src, p, out) {
    const w = src.width, h = src.height;
    out = out || mk(w, h);
    if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
    const ctx = out.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, w, h);
    if (p.blur > 0) { ctx.filter = 'blur(' + (p.blur / 100 * Math.max(w, h) * 0.02).toFixed(2) + 'px)'; }
    ctx.drawImage(src, 0, 0); ctx.filter = 'none';
    const id = ctx.getImageData(0, 0, w, h), d = id.data;
    const exp = Math.pow(2, p.exposure / 50), br = p.brightness / 250;
    const k = p.contrast >= 0 ? 1 + p.contrast / 60 : 1 + p.contrast / 110;
    const hi = p.highlights / 100 * 0.35, sh = p.shadows / 100 * 0.35, wh = p.whites / 100 * 0.2, bl = p.blacks / 100 * 0.2;
    const tr = p.temperature / 100 * 0.12, tg = p.tint / 100 * 0.08;
    const sat = 1 + p.saturation / 100, vib = p.vibrance / 100, fade = p.fade / 100 * 0.12;
    const hue = p.hue * Math.PI / 180, cosH = Math.cos(hue), sinH = Math.sin(hue);
    const vig = p.vignette / 100, grain = p.grain / 100 * 0.18;
    const cx = w / 2, cy = h / 2, maxD = Math.hypot(cx, cy);
    const doLum = hi || sh || wh || bl, doHue = Math.abs(p.hue) > 0.01;
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i += 4) {
        if (d[i + 3] === 0) continue;
        let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        r *= exp; g *= exp; b *= exp;
        r += br + tr; g += br - tg; b += br - tr;
        r = (r - 0.5) * k + 0.5; g = (g - 0.5) * k + 0.5; b = (b - 0.5) * k + 0.5;
        if (doLum) {
          const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const hw = L > 0.5 ? Math.min(1, (L - 0.5) * 2) : 0, sw = L < 0.5 ? Math.min(1, (0.5 - L) * 2) : 0;
          const ww = L > 0.8 ? (L - 0.8) * 5 : 0, bw = L < 0.2 ? (0.2 - L) * 5 : 0;
          const add = hi * hw + sh * sw + wh * ww + bl * bw;
          r += add; g += add; b += add;
        }
        if (doHue) {
          const Y = 0.299 * r + 0.587 * g + 0.114 * b, I = 0.596 * r - 0.274 * g - 0.322 * b, Q = 0.211 * r - 0.523 * g + 0.312 * b;
          const I2 = I * cosH - Q * sinH, Q2 = I * sinH + Q * cosH;
          r = Y + 0.956 * I2 + 0.621 * Q2; g = Y - 0.272 * I2 - 0.647 * Q2; b = Y - 1.106 * I2 + 1.703 * Q2;
        }
        if (sat !== 1 || vib) {
          const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), cs = mx - mn;
          const s2 = sat * (1 + vib * (1 - Math.min(1, cs * 1.6)));
          r = gray + (r - gray) * s2; g = gray + (g - gray) * s2; b = gray + (b - gray) * s2;
        }
        if (fade) { r = r * (1 - fade) + fade; g = g * (1 - fade) + fade * 0.92; b = b * (1 - fade) + fade * 0.8; }
        if (vig) { const dd = Math.hypot(x - cx, y - cy) / maxD; const f = 1 - vig * Math.pow(dd, 2.2) * (vig > 0 ? 0.9 : -0.6); r *= f; g *= f; b *= f; }
        if (grain) { const n = (Math.random() - 0.5) * grain; r += n; g += n; b += n; }
        d[i] = r <= 0 ? 0 : r >= 1 ? 255 : r * 255; d[i + 1] = g <= 0 ? 0 : g >= 1 ? 255 : g * 255; d[i + 2] = b <= 0 ? 0 : b >= 1 ? 255 : b * 255;
      }
    }
    if (p.sharpen > 0 || p.clarity) unsharp(id, w, h, p.sharpen / 100 * 1.2, p.clarity / 100);
    ctx.putImageData(id, 0, 0);
    return out;
  };
  function unsharp(id, w, h, amt, clarity) {
    const d = id.data, src = new Uint8ClampedArray(d);
    const R = clarity ? 3 : 1;
    for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const s = src[i - 4 * R + c] + src[i + 4 * R + c] + src[i - 4 * w * R + c] + src[i + 4 * w * R + c];
        const diff = src[i + c] - s / 4;
        d[i + c] = src[i + c] + diff * (amt + clarity * 0.6);
      }
    }
  }
  B.px.PRESETS = {
    original: ['Originale', {}],
    iris: ['Iride d’oro', { temperature: 28, contrast: 14, saturation: 8, vignette: 35, highlights: -10, shadows: 10 }],
    espresso: ['Espresso', { exposure: -8, contrast: 22, saturation: -18, temperature: 18, vignette: 45, fade: 10 }],
    ambra: ['Ambra', { temperature: 40, tint: 6, contrast: 8, saturation: 12, fade: 12 }],
    cinema: ['Cinema', { contrast: 18, saturation: -12, temperature: 10, shadows: 14, highlights: -18, vignette: 30, grain: 12 }],
    film: ['Pellicola', { fade: 35, grain: 30, contrast: -6, saturation: -10, temperature: 12 }],
    bw: ['Bianco e nero', { saturation: -100, contrast: 18 }],
    noir: ['Noir', { saturation: -100, contrast: 45, blacks: -30, vignette: 55, grain: 18 }],
    sepia: ['Seppia', { saturation: -70, temperature: 45, tint: 8, fade: 12 }],
    vivid: ['Vivido', { vibrance: 45, saturation: 12, contrast: 12, clarity: 25 }],
    soft: ['Morbido', { contrast: -18, highlights: 12, fade: 18, saturation: -6 }],
    cold: ['Freddo', { temperature: -35, tint: -4, contrast: 6 }],
    dramatic: ['Drammatico', { contrast: 40, clarity: 40, shadows: -12, highlights: -25, vignette: 40, saturation: -8 }]
  };

  /* flood fill / magic wand: returns mask canvas */
  B.px.flood = function (src, sx, sy, tol, contiguous = true) {
    const w = src.width, h = src.height, d = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const i0 = (sy * w + sx) * 4, r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2], a0 = d[i0 + 3];
    const T = tol * tol * 4;
    const m = new Uint8Array(w * h);
    const near = (i) => { const dr = d[i] - r0, dg = d[i + 1] - g0, db = d[i + 2] - b0, da = d[i + 3] - a0; return dr * dr + dg * dg + db * db + da * da <= T; };
    if (contiguous) {
      const stack = [sx + sy * w]; m[sx + sy * w] = 1;
      while (stack.length) {
        const p = stack.pop(), x = p % w, y = (p / w) | 0;
        const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
        for (const q of nb) if (q >= 0 && !m[q] && near(q * 4)) { m[q] = 1; stack.push(q); }
      }
    } else for (let p = 0; p < w * h; p++) if (near(p * 4)) m[p] = 1;
    const out = mk(w, h), oc = out.getContext('2d'), od = oc.createImageData(w, h);
    for (let p = 0; p < w * h; p++) if (m[p]) { od.data[p * 4] = od.data[p * 4 + 1] = od.data[p * 4 + 2] = 255; od.data[p * 4 + 3] = 255; }
    oc.putImageData(od, 0, 0);
    return out;
  };

  /* local background removal: border colour model + connected flood + feather */
  B.removeBackground = async function (srcCanvas, opts = {}) {
    const W = srcCanvas.width, H = srcCanvas.height;
    const sc = Math.min(1, 900 / Math.max(W, H));
    const w = Math.max(2, Math.round(W * sc)), h = Math.max(2, Math.round(H * sc));
    const small = mk(w, h); small.getContext('2d').drawImage(srcCanvas, 0, 0, w, h);
    const d = small.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const samples = [];
    for (let x = 0; x < w; x += 2) { samples.push((x) * 4, ((h - 1) * w + x) * 4); }
    for (let y = 0; y < h; y += 2) { samples.push((y * w) * 4, (y * w + w - 1) * 4); }
    let cents = [samples[0], samples[Math.floor(samples.length / 3)], samples[Math.floor(samples.length * 2 / 3)]].map((i) => [d[i], d[i + 1], d[i + 2]]);
    for (let it = 0; it < 8; it++) {
      const acc = cents.map(() => [0, 0, 0, 0]);
      samples.forEach((i) => { let bi = 0, bd = 1e9; cents.forEach((c, k) => { const dd = (d[i] - c[0]) ** 2 + (d[i + 1] - c[1]) ** 2 + (d[i + 2] - c[2]) ** 2; if (dd < bd) { bd = dd; bi = k; } }); const a = acc[bi]; a[0] += d[i]; a[1] += d[i + 1]; a[2] += d[i + 2]; a[3]++; });
      cents = acc.map((a, k) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : cents[k]));
    }
    const tol = opts.tolerance || 38, T = tol * tol * 3;
    const dist = (p) => { let bd = 1e9; const i = p * 4; for (const c of cents) { const dd = (d[i] - c[0]) ** 2 + (d[i + 1] - c[1]) ** 2 + (d[i + 2] - c[2]) ** 2; if (dd < bd) bd = dd; } return bd; };
    const bg = new Uint8Array(w * h), stack = [];
    for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
    for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
    while (stack.length) {
      const p = stack.pop(); if (bg[p]) continue;
      if (dist(p) > T) continue;
      bg[p] = 1; const x = p % w, y = (p / w) | 0;
      if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1); if (y > 0) stack.push(p - w); if (y < h - 1) stack.push(p + w);
    }
    const mask = mk(w, h), mc = mask.getContext('2d'), md = mc.createImageData(w, h);
    for (let p = 0; p < w * h; p++) { const v = bg[p] ? 0 : 255; md.data[p * 4] = md.data[p * 4 + 1] = md.data[p * 4 + 2] = 255; md.data[p * 4 + 3] = v; }
    mc.putImageData(md, 0, 0);
    const out = mk(W, H), oc = out.getContext('2d');
    oc.drawImage(srcCanvas, 0, 0);
    oc.globalCompositeOperation = 'destination-in';
    oc.filter = 'blur(' + Math.max(0.6, 1.2 / sc) + 'px)';
    oc.drawImage(mask, 0, 0, W, H);
    oc.filter = 'none'; oc.globalCompositeOperation = 'source-over';
    return out;
  };

  /* inpainting by diffusion (remove tool) */
  B.px.inpaint = function (canvas, maskCanvas, iterations = 120) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const id = ctx.getImageData(0, 0, w, h), d = id.data;
    const m = maskCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    let minx = w, miny = h, maxx = 0, maxy = 0; const idx = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[(y * w + x) * 4 + 3] > 10) { idx.push(y * w + x); if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    if (!idx.length) return;
    const span = Math.max(maxx - minx, maxy - miny);
    const its = Math.min(600, iterations + span * 2);
    const f = new Float32Array(d.length); for (let i = 0; i < d.length; i++) f[i] = d[i];
    // init masked pixels with border average
    for (let it = 0; it < its; it++) {
      for (const p of idx) {
        const x = p % w, y = (p / w) | 0; let n = 0; const acc = [0, 0, 0];
        const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1], [x - 2, y], [x + 2, y], [x, y - 2], [x, y + 2]];
        for (const [a, bb] of nb) { if (a < 0 || bb < 0 || a >= w || bb >= h) continue; const q = (bb * w + a) * 4; acc[0] += f[q]; acc[1] += f[q + 1]; acc[2] += f[q + 2]; n++; }
        if (n) { const q = p * 4; f[q] = acc[0] / n; f[q + 1] = acc[1] / n; f[q + 2] = acc[2] / n; f[q + 3] = 255; }
      }
    }
    for (const p of idx) { const q = p * 4; d[q] = f[q] + (Math.random() - 0.5) * 6; d[q + 1] = f[q + 1] + (Math.random() - 0.5) * 6; d[q + 2] = f[q + 2] + (Math.random() - 0.5) * 6; d[q + 3] = 255; }
    ctx.putImageData(id, 0, 0);
  };
  B.px.autoTune = function (canvas) {
    const sc = Math.min(1, 400 / Math.max(canvas.width, canvas.height));
    const s = mk(canvas.width * sc, canvas.height * sc); s.getContext('2d').drawImage(canvas, 0, 0, s.width, s.height);
    const d = s.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, s.width, s.height).data;
    let L = [], sr = 0, sg = 0, sb = 0, n = 0, satSum = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 10) continue; const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; L.push(l); sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++; satSum += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); }
    L.sort((a, b) => a - b);
    const p2 = L[Math.floor(L.length * 0.02)] || 0, p98 = L[Math.floor(L.length * 0.98)] || 255, mid = L[Math.floor(L.length / 2)] || 128;
    const out = Object.assign({}, ADJ0);
    out.exposure = B.clamp(Math.round((118 - mid) / 2.2), -40, 45);
    out.contrast = B.clamp(Math.round((200 - (p98 - p2)) / 5), -10, 30);
    out.shadows = p2 > 25 ? 0 : 12; out.highlights = p98 > 245 ? -18 : 0;
    const avg = (sr + sg + sb) / 3 / n;
    out.temperature = B.clamp(Math.round(((sb / n) - (sr / n)) / avg * 60), -30, 30);
    out.vibrance = satSum / n < 50 ? 25 : 10; out.clarity = 12; out.sharpen = 10;
    return out;
  };

  /* ================= view ================= */
  const TOOLS = [
    ['move', 'Sposta', 'Move', 'v'], ['marquee', 'Selezione rettangolare', 'Square', 'm'], ['ellipse', 'Selezione ellittica', 'Circle', ''], ['lasso', 'Lazo', 'Lasso', 'l'], ['wand', 'Bacchetta magica', 'Wand', 'w'],
    ['crop', 'Ritaglia', 'Crop', 'c'], ['brush', 'Pennello', 'Brush', 'b'], ['eraser', 'Gomma', 'Eraser', 'e'], ['fill', 'Secchiello', 'PaintBucket', 'g'], ['gradient', 'Sfumatura', 'Blend', ''],
    ['text', 'Testo', 'Type', 't'], ['shape', 'Forme', 'Shapes', 'u'], ['eyedropper', 'Contagocce', 'Pipette', 'i'], ['clone', 'Timbro clone (Alt+clic per l’origine)', 'Stamp', 's'], ['heal', 'Rimuovi oggetti', 'Sparkle', 'j'],
    ['blurbrush', 'Sfoca', 'Droplet', 'r'], ['dodge', 'Schiarisci', 'Sun', 'o'], ['burn', 'Brucia', 'Moon', ''], ['hand', 'Mano', 'Hand', 'h'], ['zoom', 'Zoom', 'ZoomIn', 'z']
  ];
  const BLENDS = [['source-over', 'Normale'], ['multiply', 'Moltiplica'], ['screen', 'Scolora'], ['overlay', 'Sovrapponi'], ['soft-light', 'Luce soffusa'], ['hard-light', 'Luce intensa'], ['darken', 'Scurisci'], ['lighten', 'Schiarisci'], ['color-dodge', 'Colore scherma'], ['color-burn', 'Colore brucia'], ['difference', 'Differenza'], ['exclusion', 'Esclusione'], ['hue', 'Tonalità'], ['saturation', 'Saturazione'], ['color', 'Colore'], ['luminosity', 'Luminosità']];

  B.view('photo', {
    title: 'Foto Studio', icon: 'Aperture', group: 'studio', desc: 'Ritocco foto con livelli e AI',
    mount(el) {
      const doc = { w: 0, h: 0, layers: [], active: null, sel: null, name: 'Foto', id: null };
      const view = { zoom: 1, px: 0, py: 0 };
      const st = { tool: 'brush', fg: '#e3a94a', bg: '#1a0f08', size: 40, hard: 70, opacity: 100, tol: 32, shape: 'rect', shapeFill: true, cloneSrc: null, adj: Object.assign({}, ADJ0), adjDirty: false, preview: null, hist: [], fut: [], panel: 'adjust', font: 'Bricolage Grotesque', fontSize: 120 };
      el.classList.add('photo-view');

      /* ---------- layout ---------- */
      const nameIn = B.h('input', { id: 'phName', value: 'Foto senza titolo', 'aria-label': 'Nome' });
      nameIn.addEventListener('change', () => (doc.name = nameIn.value));
      const undoB = B.h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Annulla', 'data-tip': 'Annulla (Ctrl Z)', 'data-i': 'Undo2', onclick: () => undo() });
      const redoB = B.h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Ripeti', 'data-tip': 'Ripeti (Ctrl Y)', 'data-i': 'Redo2', onclick: () => redo() });
      const openB = B.h('button', { class: 'btn', type: 'button', onclick: (e) => openMenu(e.currentTarget) }, B.h('span', { 'data-i': 'FolderOpen' }), 'Apri');
      const imgB = B.h('button', { class: 'btn', type: 'button', onclick: (e) => imageMenu(e.currentTarget) }, B.h('span', { 'data-i': 'Scaling' }), 'Immagine');
      const selB = B.h('button', { class: 'btn', type: 'button', onclick: (e) => selectMenu(e.currentTarget) }, B.h('span', { 'data-i': 'ScissorsLineDashed' }), 'Selezione');
      const saveB = B.h('button', { class: 'btn', type: 'button', onclick: () => saveProject() }, B.h('span', { 'data-i': 'Save' }), 'Salva');
      const expB = B.h('button', { class: 'btn gold', type: 'button', onclick: (e) => exportMenu(e.currentTarget) }, B.h('span', { 'data-i': 'Download' }), 'Esporta');
      const bar = B.h('div', { class: 'bar' }, B.h('div', { class: 'bar-title' }, B.h('span', { class: 'bt-ic', 'data-i': 'Aperture' }), nameIn), undoB, redoB, B.h('div', { class: 'bar-sep' }), openB, imgB, selB, B.h('div', { class: 'bar-sp' }), saveB, expB);
      const opts = B.h('div', { class: 'ph-opts' });
      const tools = B.h('nav', { class: 'rail tool-rail', 'aria-label': 'Strumenti' });
      TOOLS.forEach(([k, l, ic, key]) => tools.append(B.h('button', { class: 'rail-btn', type: 'button', 'data-t': k, 'data-tip': l + (key ? ' (' + key.toUpperCase() + ')' : ''), 'aria-label': l, onclick: () => setTool(k) }, B.h('span', { 'data-i': ic }))));
      const colors = B.h('div', { class: 'ph-colors' });
      const fgIn = B.h('input', { type: 'color', value: st.fg, 'aria-label': 'Colore primario', class: 'ph-fg' });
      const bgIn = B.h('input', { type: 'color', value: st.bg, 'aria-label': 'Colore secondario', class: 'ph-bg' });
      fgIn.addEventListener('input', () => (st.fg = fgIn.value)); bgIn.addEventListener('input', () => (st.bg = bgIn.value));
      colors.append(bgIn, fgIn, B.h('button', { class: 'ph-swap', type: 'button', 'aria-label': 'Scambia colori', 'data-i': 'Repeat', onclick: () => { [st.fg, st.bg] = [st.bg, st.fg]; fgIn.value = st.fg; bgIn.value = st.bg; } }));
      tools.append(colors);
      const stage = B.h('div', { class: 'stage-wrap ph-stage' });
      const view2d = B.h('canvas', { class: 'ph-canvas' });
      stage.append(view2d);
      const zoomLbl = B.h('span', { text: '100%' });
      stage.append(B.h('div', { class: 'zoom-ctl' }, B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Riduci', 'data-i': 'ZoomOut', onclick: () => zoomAt(view.zoom / 1.25) }), zoomLbl, B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Ingrandisci', 'data-i': 'ZoomIn', onclick: () => zoomAt(view.zoom * 1.25) }), B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Adatta', 'data-i': 'Maximize2', onclick: fit })));
      const welcome = B.h('div', { class: 'ph-welcome' });
      stage.append(welcome);
      const right = B.h('aside', { class: 'inspector' });
      const tabs = B.h('div', { class: 'seg ph-tabs' });
      [['adjust', 'Regola', 'SlidersHorizontal'], ['filters', 'Filtri', 'Sparkle'], ['ai', 'AI', 'Sparkles'], ['layers', 'Livelli', 'Layers']].forEach(([k, l, ic]) => tabs.append(B.h('button', { type: 'button', 'data-k': k, onclick: () => setPanel(k) }, B.h('span', { 'data-i': ic }), l)));
      const panel = B.h('div', { class: 'insp-b' });
      right.append(B.h('div', { style: 'padding:12px 12px 0' }, tabs), panel);
      el.append(bar, opts, B.h('div', { class: 'ph-body' }, tools, stage, right));

      /* ---------- welcome ---------- */
      function paintWelcome() {
        welcome.innerHTML = '';
        welcome.hidden = !!doc.layers.length;
        if (doc.layers.length) return;
        const dz = B.h('div', { class: 'dropzone ph-drop' }, B.h('span', { 'data-i': 'ImageUp' }), B.h('b', { text: 'Apri una foto da ritoccare' }), B.h('small', { text: 'Trascinala qui, incollala con Ctrl V o clicca. JPG, PNG, WebP, HEIC se supportato dal browser.' }));
        dz.addEventListener('click', async () => { const [f] = await B.pickFiles('image/*'); if (f) openFile(f); });
        const news = B.h('div', { class: 'chips', style: 'justify-content:center' });
        [['Nuova 1080×1080', 1080, 1080], ['Nuova 1920×1080', 1920, 1080], ['Nuova A4 300 dpi', 2480, 3508]].forEach(([l, w, h]) => news.append(B.h('button', { class: 'chip', type: 'button', onclick: () => newDoc(w, h, '#ffffff') }, B.h('span', { 'data-i': 'FilePlus' }), l)));
        news.append(B.h('button', { class: 'chip', type: 'button', onclick: demo }, B.h('span', { 'data-i': 'Sparkles' }), 'Prova con una foto d’esempio'));
        welcome.append(dz, news); B.hydrateIcons(welcome);
      }
      B.dropzone(stage, (fs) => openFile(fs[0]), 'image/*');
      document.addEventListener('paste', (e) => { if (B.current() !== 'photo') return; const f = Array.from(e.clipboardData.files || []).find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); if (doc.layers.length) addLayerFromImage(f, 'Incollato'); else openFile(f); } });

      /* ---------- document ---------- */
      function layer(name, canvas, props) { return Object.assign({ id: B.uid('l'), name, canvas, visible: true, opacity: 1, blend: 'source-over', x: 0, y: 0, locked: false }, props || {}); }
      function newDoc(w, h, fillColor) {
        doc.w = w; doc.h = h; const c = mk(w, h); if (fillColor) { const x = c.getContext('2d'); x.fillStyle = fillColor; x.fillRect(0, 0, w, h); }
        doc.layers = [layer('Sfondo', c)]; doc.active = doc.layers[0].id; doc.sel = null; st.hist = []; st.fut = []; st.adj = Object.assign({}, ADJ0); st.preview = null;
        paintWelcome(); fit(); setPanel(st.panel); dirty();
      }
      async function openFile(f) {
        try { const im = await B.loadImage(f); openImage(im, f.name ? f.name.replace(/\.[^.]+$/, '') : 'Foto'); } catch (e) { B.toast('Non riesco ad aprire questa immagine', 'err'); }
      }
      function openImage(im, name) {
        const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
        const c = mk(w, h); c.getContext('2d').drawImage(im, 0, 0);
        doc.w = w; doc.h = h; doc.layers = [layer('Sfondo', c)]; doc.active = doc.layers[0].id; doc.sel = null; doc.id = null;
        st.hist = []; st.fut = []; st.adj = Object.assign({}, ADJ0); st.preview = null;
        doc.name = name || 'Foto'; nameIn.value = doc.name;
        paintWelcome(); fit(); setPanel(st.panel); dirty();
      }
      async function addLayerFromImage(src, name) {
        const im = await B.loadImage(src); const sc = Math.min(1, doc.w / im.naturalWidth, doc.h / im.naturalHeight);
        const c = mk(doc.w, doc.h); const w = im.naturalWidth * sc, h = im.naturalHeight * sc;
        c.getContext('2d').drawImage(im, (doc.w - w) / 2, (doc.h - h) / 2, w, h);
        begin('Nuovo livello', [], true); const L = layer(name || 'Livello', c); insertLayer(L); commit();
      }
      async function demo() {
        const c = mk(1600, 1067); const x = c.getContext('2d');
        await B.ai.init();
        const r = B.shader.create(1600, 1067, B.shader.presets.dunes.code); r.render(6); x.drawImage(r.canvas, 0, 0); r.dispose();
        openImage(c, 'Dune al tramonto');
      }
      const active = () => doc.layers.find((l) => l.id === doc.active) || doc.layers[doc.layers.length - 1];
      function insertLayer(L) { const i = doc.layers.indexOf(active()); doc.layers.splice(i + 1, 0, L); doc.active = L.id; }

      /* ---------- history (swap based) ---------- */
      let pendingH = null;
      function begin(label, layerIds, structure) {
        pendingH = { label, changes: (layerIds || []).map((id) => { const L = doc.layers.find((l) => l.id === id); return L ? { id, canvas: clone(L.canvas), x: L.x, y: L.y } : null; }).filter(Boolean), structure: structure ? doc.layers.slice() : null, props: structure ? doc.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, locked: l.locked })) : null, size: [doc.w, doc.h], active: doc.active };
      }
      function commit() { if (!pendingH) return; st.hist.push(pendingH); if (st.hist.length > 30) st.hist.shift(); st.fut = []; pendingH = null; dirty(); paintPanelSoon(); }
      function swap(h) {
        h.changes.forEach((c) => { const L = doc.layers.find((l) => l.id === c.id) || (h.structure || []).find((l) => l.id === c.id); if (!L) return; const cur = L.canvas, cx = L.x, cy = L.y; L.canvas = c.canvas; L.x = c.x; L.y = c.y; c.canvas = cur; c.x = cx; c.y = cy; });
        if (h.structure) { const cur = doc.layers.slice(), curProps = doc.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, locked: l.locked })); doc.layers = h.structure; h.props.forEach((p) => { const L = doc.layers.find((l) => l.id === p.id); if (L) Object.assign(L, p); }); h.structure = cur; h.props = curProps; }
        const sz = [doc.w, doc.h]; [doc.w, doc.h] = h.size; h.size = sz;
        const a = doc.active; doc.active = doc.layers.find((l) => l.id === h.active) ? h.active : doc.layers[doc.layers.length - 1].id; h.active = a;
      }
      function undo() { const h = st.hist.pop(); if (!h) return; swap(h); st.fut.push(h); doc.sel = null; dirty(); paintPanelSoon(); B.toast('Annullato: ' + h.label); }
      function redo() { const h = st.fut.pop(); if (!h) return; swap(h); st.hist.push(h); dirty(); paintPanelSoon(); }

      /* ---------- rendering ---------- */
      const comp = mk(1, 1);
      let needComp = true, raf = 0, antsOff = 0;
      function dirty() { needComp = true; schedule(); }
      function schedule() { if (!raf) raf = requestAnimationFrame(render); }
      function composite() {
        if (comp.width !== doc.w || comp.height !== doc.h) { comp.width = doc.w; comp.height = doc.h; }
        const x = comp.getContext('2d'); x.clearRect(0, 0, doc.w, doc.h);
        doc.layers.forEach((L) => {
          if (!L.visible) return;
          x.globalAlpha = L.opacity; x.globalCompositeOperation = L.blend;
          const src = L.id === doc.active && st.preview ? st.preview : L.canvas;
          x.drawImage(src, 0, 0, src.width, src.height, L.x, L.y, L.canvas.width, L.canvas.height);
          if (L.id === doc.active && st.stroke) {
            const hidden = st.strokeMode === 'hidden';
            x.globalAlpha = hidden && st.tool !== 'clone' ? 0.3 : L.opacity * st.opacity / 100;
            x.globalCompositeOperation = hidden ? 'source-over' : st.strokeMode || 'source-over';
            x.drawImage(st.stroke, 0, 0);
          }
        });
        x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
        needComp = false;
      }
      function render() {
        raf = 0;
        const dpr = Math.min(2, devicePixelRatio || 1), r = stage.getBoundingClientRect();
        if (view2d.width !== Math.round(r.width * dpr) || view2d.height !== Math.round(r.height * dpr)) { view2d.width = Math.round(r.width * dpr); view2d.height = Math.round(r.height * dpr); }
        const ctx = view2d.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, view2d.width, view2d.height);
        if (!doc.layers.length) return;
        if (needComp) composite();
        ctx.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * view.px, dpr * view.py);
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 40 / view.zoom; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, doc.w, doc.h); ctx.restore();
        ctx.fillStyle = checker(ctx); ctx.fillRect(0, 0, doc.w, doc.h);
        ctx.imageSmoothingEnabled = view.zoom < 2; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(comp, 0, 0);
        const lw = 1 / view.zoom;
        if (doc.sel) {
          ctx.save(); ctx.lineWidth = lw;
          if (doc.sel.path) { ctx.strokeStyle = '#000'; ctx.setLineDash([5 * lw, 5 * lw]); ctx.lineDashOffset = -antsOff * lw; ctx.stroke(doc.sel.path); ctx.strokeStyle = '#fff'; ctx.lineDashOffset = -antsOff * lw + 5 * lw; ctx.stroke(doc.sel.path); }
          else if (doc.sel.edge) { ctx.globalAlpha = 0.9; ctx.drawImage(doc.sel.edge, 0, 0); }
          ctx.restore();
        }
        const o = st.overlay;
        if (o) {
          ctx.save(); ctx.lineWidth = lw * 1.5; ctx.strokeStyle = '#e3a94a'; ctx.setLineDash([6 * lw, 4 * lw]);
          if (o.type === 'rect' || o.type === 'crop') { const [x0, y0, x1, y1] = o.r; if (o.type === 'crop') { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.rect(0, 0, doc.w, doc.h); ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); ctx.fill('evenodd'); ctx.setLineDash([]); ctx.strokeStyle = '#f3d088'; for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(Math.min(x0, x1) + Math.abs(x1 - x0) * i / 3, Math.min(y0, y1)); ctx.lineTo(Math.min(x0, x1) + Math.abs(x1 - x0) * i / 3, Math.max(y0, y1)); ctx.moveTo(Math.min(x0, x1), Math.min(y0, y1) + Math.abs(y1 - y0) * i / 3); ctx.lineTo(Math.max(x0, x1), Math.min(y0, y1) + Math.abs(y1 - y0) * i / 3); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1; } } ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); }
          else if (o.type === 'ellipse') { const [x0, y0, x1, y1] = o.r; ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, 7); ctx.stroke(); }
          else if (o.type === 'path') { ctx.beginPath(); o.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
          else if (o.type === 'line') { ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(o.a[0], o.a[1]); ctx.lineTo(o.b[0], o.b[1]); ctx.stroke(); }
          ctx.restore();
        }
        if (st.cursor && ['brush', 'eraser', 'clone', 'heal', 'blurbrush', 'dodge', 'burn'].includes(st.tool)) {
          ctx.save(); ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(st.cursor[0], st.cursor[1], st.size / 2, 0, 7); ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.arc(st.cursor[0], st.cursor[1], st.size / 2 + lw, 0, 7); ctx.stroke();
          if (st.tool === 'clone' && st.cloneSrc) { const s = st.cloneSrc; const dx = st.cloneOff ? st.cursor[0] - st.cloneOff[0] : s[0], dy = st.cloneOff ? st.cursor[1] - st.cloneOff[1] : s[1]; ctx.strokeStyle = '#e3a94a'; ctx.beginPath(); ctx.moveTo(dx - 8 * lw, dy); ctx.lineTo(dx + 8 * lw, dy); ctx.moveTo(dx, dy - 8 * lw); ctx.lineTo(dx, dy + 8 * lw); ctx.stroke(); }
          ctx.restore();
        }
      }
      let checkerPat = null;
      function checker(ctx) { if (!checkerPat) { const c = mk(16, 16), x = c.getContext('2d'); x.fillStyle = '#e8e2d8'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#cfc6b8'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8); checkerPat = ctx.createPattern(c, 'repeat'); } return checkerPat; }
      setInterval(() => { if (doc.sel && doc.sel.path && B.current() === 'photo') { antsOff = (antsOff + 1) % 10; schedule(); } }, 90);
      new ResizeObserver(() => schedule()).observe(stage);
      function fit() { const r = stage.getBoundingClientRect(); if (!doc.w || !r.width) return; view.zoom = Math.min((r.width - 60) / doc.w, (r.height - 60) / doc.h, 4); view.px = (r.width - doc.w * view.zoom) / 2; view.py = (r.height - doc.h * view.zoom) / 2; zoomLbl.textContent = Math.round(view.zoom * 100) + '%'; schedule(); }
      function zoomAt(z, sx, sy) { const r = stage.getBoundingClientRect(); sx = sx ?? r.width / 2; sy = sy ?? r.height / 2; const dx = (sx - view.px) / view.zoom, dy = (sy - view.py) / view.zoom; view.zoom = B.clamp(z, 0.03, 32); view.px = sx - dx * view.zoom; view.py = sy - dy * view.zoom; zoomLbl.textContent = Math.round(view.zoom * 100) + '%'; schedule(); }
      const toDoc = (e) => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left - view.px) / view.zoom, (e.clientY - r.top - view.py) / view.zoom]; };

      /* ---------- selection ---------- */
      function selFromPath(path) {
        const m = mk(doc.w, doc.h), x = m.getContext('2d'); x.fillStyle = '#fff'; x.fill(path);
        doc.sel = { path, mask: m }; schedule();
      }
      function selFromMask(mask) {
        // edge overlay for display
        const w = doc.w, h = doc.h, md = mask.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
        const edge = mk(w, h), ec = edge.getContext('2d'), ed = ec.createImageData(w, h);
        for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) {
          const i = (y * w + xx) * 4; if (md[i + 3] < 128) continue;
          if (md[i + 3 - 4] < 128 || md[i + 3 + 4] < 128 || md[i + 3 - w * 4] < 128 || md[i + 3 + w * 4] < 128) { const on = ((xx + y) >> 2) & 1; ed.data[i] = ed.data[i + 1] = ed.data[i + 2] = on ? 255 : 0; ed.data[i + 3] = 255; }
        }
        ec.putImageData(ed, 0, 0);
        doc.sel = { mask, edge }; schedule();
      }
      function clearSel() { doc.sel = null; schedule(); }
      function invertSel() { if (!doc.sel) return; const m = mk(doc.w, doc.h), x = m.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, doc.w, doc.h); x.globalCompositeOperation = 'destination-out'; x.drawImage(doc.sel.mask, 0, 0); selFromMask(m); }
      function selectAll() { const p = new Path2D(); p.rect(0, 0, doc.w, doc.h); selFromPath(p); }
      function selMaskForLayer(L) { if (!doc.sel) return null; const m = mk(L.canvas.width, L.canvas.height); m.getContext('2d').drawImage(doc.sel.mask, -L.x, -L.y); return m; }

      /* ---------- tools ---------- */
      function setTool(k) {
        st.tool = k; st.overlay = null;
        B.$$('[data-t]', tools).forEach((b) => b.classList.toggle('on', b.dataset.t === k));
        stage.dataset.tool = k;
        paintOpts(); schedule();
      }
      function paintOpts() {
        opts.innerHTML = '';
        const t = TOOLS.find((x) => x[0] === st.tool);
        opts.append(B.h('span', { class: 'ph-tool-name', html: B.iconSVG(t[2], 16) + ' ' + B.esc(t[1]) }));
        const sl = (label, key, min, max, unit = '') => { const s = B.slider({ label, min, max, value: st[key], unit, onInput: (v) => { st[key] = v; schedule(); } }); s.classList.add('ph-sl'); return s; };
        if (['brush', 'eraser', 'clone', 'heal', 'blurbrush', 'dodge', 'burn'].includes(st.tool)) { opts.append(sl('Dimensione', 'size', 1, 600, 'px')); if (!['heal'].includes(st.tool)) opts.append(sl('Durezza', 'hard', 0, 100, '%'), sl('Opacità', 'opacity', 1, 100, '%')); }
        if (st.tool === 'wand' || st.tool === 'fill') opts.append(sl('Tolleranza', 'tol', 0, 255));
        if (st.tool === 'shape') { const seg = B.h('div', { class: 'seg' }); [['rect', 'Rettangolo'], ['ellipse', 'Ellisse'], ['line', 'Linea']].forEach(([k, l]) => seg.append(B.h('button', { type: 'button', class: st.shape === k ? 'on' : '', onclick: () => { st.shape = k; paintOpts(); } }, l))); opts.append(seg, B.h('label', { class: 'row', style: 'gap:6px;font-size:12.5px' }, B.h('span', { class: 'switch' }, B.h('input', { type: 'checkbox', checked: st.shapeFill, onchange: (e) => (st.shapeFill = e.target.checked) }), B.h('span')), 'Riempi'), sl('Spessore', 'size', 1, 120, 'px')); }
        if (st.tool === 'text') { const fs = B.h('select', { class: 'select sm', style: 'width:180px' }, ['Bricolage Grotesque', 'Figtree', 'Instrument Serif', 'Playfair Display', 'Montserrat', 'Anton', 'Bebas Neue', 'Great Vibes', 'Pacifico', 'Permanent Marker', 'JetBrains Mono'].map((f) => B.h('option', { value: f, selected: f === st.font }, f))); fs.addEventListener('change', () => { st.font = fs.value; B.loadFont(st.font, '400;700;800'); }); opts.append(fs, sl('Dimensione', 'fontSize', 8, 600, 'px'), B.h('span', { class: 'mini-note', text: 'Clicca sull’immagine per scrivere' })); }
        if (st.tool === 'crop') opts.append(B.h('button', { class: 'btn sm gold', type: 'button', onclick: applyCrop }, B.h('span', { 'data-i': 'Check' }), 'Applica ritaglio'), B.h('button', { class: 'btn sm', type: 'button', onclick: () => { st.overlay = null; schedule(); } }, 'Annulla'), B.h('span', { class: 'mini-note', text: 'Trascina per scegliere l’area, poi Invio' }));
        if (st.tool === 'clone') opts.append(B.h('span', { class: 'mini-note', text: st.cloneSrc ? 'Origine impostata. Dipingi per clonare.' : 'Alt+clic (o clic lungo) per scegliere l’origine' }));
        if (st.tool === 'heal') opts.append(B.h('span', { class: 'mini-note', text: 'Dipingi sopra un difetto o un oggetto: Thorion lo rimuove ricostruendo i pixel intorno.' }));
        if (['marquee', 'ellipse', 'lasso', 'wand'].includes(st.tool)) opts.append(B.h('button', { class: 'btn sm', type: 'button', onclick: selectAll }, 'Seleziona tutto'), B.h('button', { class: 'btn sm', type: 'button', onclick: invertSel }, 'Inverti'), B.h('button', { class: 'btn sm', type: 'button', onclick: clearSel }, 'Deseleziona'));
        B.hydrateIcons(opts);
      }

      let drag = null;
      stage.addEventListener('pointerdown', (e) => {
        if (!doc.layers.length || e.button === 2) return;
        if (e.target.closest('.zoom-ctl, .ph-welcome')) return;
        stage.setPointerCapture(e.pointerId);
        const p = toDoc(e);
        if (e.button === 1 || st.tool === 'hand' || st.space) { drag = { pan: true, sx: e.clientX, sy: e.clientY, px: view.px, py: view.py }; return; }
        if (st.tool === 'zoom') { const r = stage.getBoundingClientRect(); zoomAt(view.zoom * (e.altKey ? 0.7 : 1.4), e.clientX - r.left, e.clientY - r.top); return; }
        const L = active();
        if (!L) return;
        if (L.locked && !['marquee', 'ellipse', 'lasso', 'wand', 'eyedropper', 'crop'].includes(st.tool)) return B.toast('Il livello è bloccato');
        switch (st.tool) {
          case 'move': begin('Sposta', [L.id]); drag = { move: true, sx: p[0], sy: p[1], lx: L.x, ly: L.y }; break;
          case 'marquee': case 'ellipse': case 'crop': drag = { rect: true, a: p }; st.overlay = { type: st.tool === 'ellipse' ? 'ellipse' : st.tool === 'crop' ? 'crop' : 'rect', r: [p[0], p[1], p[0], p[1]] }; break;
          case 'lasso': drag = { lasso: true }; st.overlay = { type: 'path', pts: [p] }; break;
          case 'wand': { const x = Math.floor(p[0] - L.x), y = Math.floor(p[1] - L.y); if (x < 0 || y < 0 || x >= L.canvas.width || y >= L.canvas.height) return; const m0 = B.px.flood(L.canvas, x, y, st.tol, !e.shiftKey); const m = mk(doc.w, doc.h); m.getContext('2d').drawImage(m0, L.x, L.y); selFromMask(m); break; }
          case 'eyedropper': { if (needComp) composite(); const d = comp.getContext('2d').getImageData(B.clamp(Math.floor(p[0]), 0, doc.w - 1), B.clamp(Math.floor(p[1]), 0, doc.h - 1), 1, 1).data; st.fg = B.rgbToHex(d[0], d[1], d[2]); fgIn.value = st.fg; B.toast('Colore ' + st.fg, { icon: 'Pipette' }); break; }
          case 'fill': { const x = Math.floor(p[0] - L.x), y = Math.floor(p[1] - L.y); if (x < 0 || y < 0 || x >= L.canvas.width || y >= L.canvas.height) return; begin('Riempimento', [L.id]); const m = B.px.flood(L.canvas, x, y, st.tol, !e.shiftKey); const sm = selMaskForLayer(L); const tmp = mk(L.canvas.width, L.canvas.height), tx = tmp.getContext('2d'); tx.fillStyle = st.fg; tx.fillRect(0, 0, tmp.width, tmp.height); tx.globalCompositeOperation = 'destination-in'; tx.drawImage(m, 0, 0); if (sm) tx.drawImage(sm, 0, 0); L.canvas.getContext('2d').drawImage(tmp, 0, 0); commit(); break; }
          case 'gradient': drag = { grad: true, a: p }; st.overlay = { type: 'line', a: p, b: p }; break;
          case 'shape': drag = { shape: true, a: p }; st.overlay = { type: st.shape === 'ellipse' ? 'ellipse' : st.shape === 'line' ? 'line' : 'rect', r: [p[0], p[1], p[0], p[1]], a: p, b: p }; break;
          case 'text': placeText(p); break;
          case 'clone': if (e.altKey) { st.cloneSrc = p; st.cloneOff = null; paintOpts(); B.toast('Origine del timbro impostata', { icon: 'Stamp' }); return; } if (!st.cloneSrc) { st.cloneSrc = p; paintOpts(); B.toast('Origine impostata qui: ora dipingi altrove', { icon: 'Stamp' }); return; } // fallthrough to stroke
          // eslint-disable-next-line no-fallthrough
          case 'brush': case 'eraser': case 'heal': case 'blurbrush': case 'dodge': case 'burn': startStroke(L, p, e); break;
        }
        schedule();
      });
      stage.addEventListener('pointermove', (e) => {
        if (!doc.layers.length) return;
        const p = toDoc(e); st.cursor = p;
        if (!drag) { schedule(); return; }
        if (drag.pan) { view.px = drag.px + e.clientX - drag.sx; view.py = drag.py + e.clientY - drag.sy; schedule(); return; }
        const L = active();
        if (drag.move) { L.x = Math.round(drag.lx + p[0] - drag.sx); L.y = Math.round(drag.ly + p[1] - drag.sy); dirty(); return; }
        if (drag.rect) { let [x1, y1] = p; if (e.shiftKey) { const s = Math.max(Math.abs(x1 - drag.a[0]), Math.abs(y1 - drag.a[1])); x1 = drag.a[0] + Math.sign(x1 - drag.a[0]) * s; y1 = drag.a[1] + Math.sign(y1 - drag.a[1]) * s; } st.overlay.r = [drag.a[0], drag.a[1], x1, y1]; schedule(); return; }
        if (drag.lasso) { st.overlay.pts.push(p); schedule(); return; }
        if (drag.grad) { st.overlay.b = p; schedule(); return; }
        if (drag.shape) { st.overlay.r = [drag.a[0], drag.a[1], p[0], p[1]]; st.overlay.b = p; schedule(); return; }
        if (drag.stroke) { strokeTo(p, e); }
      });
      stage.addEventListener('pointerup', (e) => {
        const d = drag; drag = null; if (!d) return;
        const L = active();
        if (d.move) { commit(); return; }
        if (d.rect && st.tool !== 'crop') { const [x0, y0, x1, y1] = st.overlay.r; st.overlay = null; if (Math.abs(x1 - x0) < 2) { clearSel(); return; } const path = new Path2D(); if (st.tool === 'ellipse') path.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, 7); else path.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); selFromPath(path); return; }
        if (d.lasso) { const pts = st.overlay.pts; st.overlay = null; if (pts.length < 3) { clearSel(); return; } const path = new Path2D(); pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y))); path.closePath(); selFromPath(path); return; }
        if (d.grad) { const { a, b } = st.overlay; st.overlay = null; begin('Sfumatura', [L.id]); const tmp = mk(L.canvas.width, L.canvas.height), tx = tmp.getContext('2d'); const g = tx.createLinearGradient(a[0] - L.x, a[1] - L.y, b[0] - L.x, b[1] - L.y); g.addColorStop(0, st.fg); g.addColorStop(1, e.altKey ? 'rgba(0,0,0,0)' : st.bg); tx.fillStyle = g; tx.fillRect(0, 0, tmp.width, tmp.height); const sm = selMaskForLayer(L); if (sm) { tx.globalCompositeOperation = 'destination-in'; tx.drawImage(sm, 0, 0); } L.canvas.getContext('2d').drawImage(tmp, 0, 0); commit(); return; }
        if (d.shape) { const o = st.overlay; st.overlay = null; const [x0, y0, x1, y1] = o.r; if (Math.abs(x1 - x0) < 2 && Math.abs(y1 - y0) < 2) return; begin('Forma', [], true); const c = mk(doc.w, doc.h), x = c.getContext('2d'); x.fillStyle = st.fg; x.strokeStyle = st.fg; x.lineWidth = st.size; x.lineCap = 'round'; x.beginPath(); if (st.shape === 'rect') x.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); else if (st.shape === 'ellipse') x.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, 7); else { x.moveTo(x0, y0); x.lineTo(x1, y1); } if (st.shapeFill && st.shape !== 'line') x.fill(); else x.stroke(); insertLayer(layer('Forma', c)); commit(); return; }
        if (d.stroke) endStroke(L);
      });
      stage.addEventListener('pointerleave', () => { st.cursor = null; schedule(); });
      stage.addEventListener('wheel', (e) => {
        if (!doc.layers.length) return; e.preventDefault();
        const r = stage.getBoundingClientRect();
        if (e.ctrlKey || e.metaKey || e.altKey) zoomAt(view.zoom * Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
        else { view.px -= e.shiftKey ? e.deltaY : e.deltaX; view.py -= e.shiftKey ? 0 : e.deltaY; schedule(); }
      }, { passive: false });
      stage.addEventListener('dblclick', (e) => { if (st.tool === 'crop') applyCrop(); });

      /* strokes */
      function stamp(ctx, x, y, color) {
        const r = st.size / 2;
        if (st.hard >= 98) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); return; }
        const g = ctx.createRadialGradient(x, y, 0, x, y, r); const [R, G, Bc] = B.hexToRgb(color);
        g.addColorStop(0, 'rgba(' + R + ',' + G + ',' + Bc + ',1)'); g.addColorStop(B.clamp(st.hard / 100, 0, 0.99), 'rgba(' + R + ',' + G + ',' + Bc + ',1)'); g.addColorStop(1, 'rgba(' + R + ',' + G + ',' + Bc + ',0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
      function startStroke(L, p) {
        st.stroke = mk(doc.w, doc.h);
        st.strokeMode = st.tool === 'eraser' ? 'destination-out' : 'source-over';
        if (st.tool === 'clone') { if (needComp) composite(); st.cloneSnap = clone(comp); if (!st.cloneOff) st.cloneOff = [p[0] - st.cloneSrc[0], p[1] - st.cloneSrc[1]]; }
        drag = { stroke: true, last: p };
        if (['heal', 'blurbrush', 'dodge', 'burn', 'clone'].includes(st.tool)) st.strokeMode = 'hidden';
        paintAt(p);
      }
      function paintAt(p) {
        const x = st.stroke.getContext('2d');
        if (st.tool === 'clone') {
          const r = st.size / 2; x.save(); x.beginPath(); x.arc(p[0], p[1], r, 0, 7); x.clip();
          x.drawImage(st.cloneSnap, -st.cloneOff[0], -st.cloneOff[1]); x.restore();
        } else stamp(x, p[0], p[1], st.tool === 'eraser' || st.tool === 'heal' || st.tool === 'blurbrush' || st.tool === 'dodge' || st.tool === 'burn' ? '#ffffff' : st.fg);
      }
      function strokeTo(p) {
        const a = drag.last, dist = Math.hypot(p[0] - a[0], p[1] - a[1]), step = Math.max(1, st.size * 0.12);
        for (let t = step; t <= dist; t += step) paintAt([a[0] + (p[0] - a[0]) * t / dist, a[1] + (p[1] - a[1]) * t / dist]);
        drag.last = p;
        if (st.strokeMode === 'hidden') { st.overlayStroke = true; }
        dirty();
      }
      function endStroke(L) {
        const s = st.stroke; st.stroke = null; const mode = st.strokeMode;
        begin({ brush: 'Pennello', eraser: 'Gomma', clone: 'Timbro', heal: 'Rimuovi', blurbrush: 'Sfoca', dodge: 'Schiarisci', burn: 'Brucia' }[st.tool] || 'Pennello', [L.id]);
        const lc = L.canvas, lx = lc.getContext('2d');
        // stroke mask in layer coords, constrained by selection
        const m = mk(lc.width, lc.height), mx = m.getContext('2d'); mx.drawImage(s, -L.x, -L.y);
        const sm = selMaskForLayer(L); if (sm) { mx.globalCompositeOperation = 'destination-in'; mx.drawImage(sm, 0, 0); }
        if (st.tool === 'brush' || st.tool === 'eraser' || st.tool === 'clone') { lx.save(); lx.globalAlpha = st.opacity / 100; lx.globalCompositeOperation = mode === 'hidden' ? 'source-over' : mode; lx.drawImage(m, 0, 0); lx.restore(); }
        else if (st.tool === 'heal') { B.px.inpaint(lc, m); }
        else if (st.tool === 'blurbrush') { const b = mk(lc.width, lc.height), bx = b.getContext('2d'); bx.filter = 'blur(' + Math.max(2, st.size / 12) + 'px)'; bx.drawImage(lc, 0, 0); bx.filter = 'none'; bx.globalCompositeOperation = 'destination-in'; bx.drawImage(m, 0, 0); lx.save(); lx.globalAlpha = st.opacity / 100; lx.drawImage(b, 0, 0); lx.restore(); }
        else if (st.tool === 'dodge' || st.tool === 'burn') { const b = mk(lc.width, lc.height), bx = b.getContext('2d'); bx.fillStyle = st.tool === 'dodge' ? '#ffffff' : '#000000'; bx.fillRect(0, 0, b.width, b.height); bx.globalCompositeOperation = 'destination-in'; bx.drawImage(m, 0, 0); bx.globalCompositeOperation = 'destination-in'; bx.drawImage(lc, 0, 0); lx.save(); lx.globalAlpha = st.opacity / 100 * 0.35; lx.globalCompositeOperation = 'soft-light'; lx.drawImage(b, 0, 0); lx.restore(); }
        commit();
      }
      async function placeText(p) {
        const ta = B.h('textarea', { class: 'textarea', id: 'phTextIn', placeholder: 'Scrivi il testo', style: 'font-family:"' + st.font + '";font-size:22px' });
        const v = await B.modal({ title: 'Aggiungi testo', body: ta, actions: [{ label: 'Annulla', value: null }, { label: 'Inserisci', kind: 'gold', fn: () => { ta.dataset.ok = 1; } }] }).done;
        void v; if (!ta.dataset.ok || !ta.value.trim()) return;
        await B.loadFont(st.font, '400;700;800');
        begin('Testo', [], true);
        const c = mk(doc.w, doc.h), x = c.getContext('2d');
        x.font = '700 ' + st.fontSize + 'px "' + st.font + '"'; x.fillStyle = st.fg; x.textBaseline = 'top';
        x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = st.fontSize * 0.1;
        ta.value.split('\n').forEach((ln, i) => x.fillText(ln, p[0], p[1] + i * st.fontSize * 1.15));
        insertLayer(layer('Testo: ' + ta.value.slice(0, 20), c)); commit();
      }
      function applyCrop() {
        const o = st.overlay; if (!o || o.type !== 'crop') return B.toast('Trascina sull’immagine per scegliere l’area da tenere');
        let [x0, y0, x1, y1] = o.r; const x = Math.round(Math.max(0, Math.min(x0, x1))), y = Math.round(Math.max(0, Math.min(y0, y1))), w = Math.round(Math.min(doc.w, Math.max(x0, x1)) - x), h = Math.round(Math.min(doc.h, Math.max(y0, y1)) - y);
        if (w < 4 || h < 4) return;
        begin('Ritaglio', doc.layers.map((l) => l.id), true);
        doc.layers.forEach((L) => { const c = mk(w, h); c.getContext('2d').drawImage(L.canvas, L.x - x, L.y - y); L.canvas = c; L.x = 0; L.y = 0; });
        doc.w = w; doc.h = h; st.overlay = null; doc.sel = null; commit(); fit();
      }

      /* ---------- panels ---------- */
      function setPanel(k) { st.panel = k; B.$$('[data-k]', tabs).forEach((b) => b.classList.toggle('on', b.dataset.k === k)); paintPanel(); }
      const paintPanelSoon = B.debounce(() => paintPanel(), 60);
      function paintPanel() {
        panel.innerHTML = '';
        if (!doc.layers.length) { panel.append(B.h('div', { class: 'empty' }, B.h('span', { 'data-i': 'Aperture' }), B.h('span', { text: 'Apri una foto per iniziare' }))); B.hydrateIcons(panel); return; }
        ({ adjust: pAdjust, filters: pFilters, ai: pAI, layers: pLayers })[st.panel]();
        B.hydrateIcons(panel);
      }
      const ADJ_UI = [['Luce', [['exposure', 'Esposizione', -100, 100], ['brightness', 'Luminosità', -100, 100], ['contrast', 'Contrasto', -100, 100], ['highlights', 'Luci', -100, 100], ['shadows', 'Ombre', -100, 100], ['whites', 'Bianchi', -100, 100], ['blacks', 'Neri', -100, 100]]], ['Colore', [['temperature', 'Temperatura', -100, 100], ['tint', 'Tinta', -100, 100], ['vibrance', 'Vividezza', -100, 100], ['saturation', 'Saturazione', -100, 100], ['hue', 'Tonalità', -180, 180]]], ['Effetti', [['clarity', 'Chiarezza', -100, 100], ['sharpen', 'Nitidezza', 0, 100], ['blur', 'Sfocatura', 0, 100], ['vignette', 'Vignettatura', -100, 100], ['grain', 'Grana', 0, 100], ['fade', 'Dissolvenza', 0, 100]]]];
      function pAdjust() {
        const L = active();
        panel.append(B.h('div', { class: 'mini-note', html: 'Regolazioni sul livello <b>' + B.esc(L.name) + '</b>. Anteprima dal vivo; premi Applica per confermare. Doppio clic su un cursore lo azzera.' }));
        ADJ_UI.forEach(([title, list]) => {
          const sec = B.h('div', { class: 'insp-sec' }, B.h('div', { class: 'lbl', text: title }));
          list.forEach(([k, label, min, max]) => sec.append(B.slider({ label, min, max, value: st.adj[k], onInput: (v) => { st.adj[k] = v; previewAdj(); } })));
          panel.append(sec);
        });
        panel.append(B.h('div', { class: 'grid2', style: 'position:sticky;bottom:-24px;background:var(--panel);padding:10px 0' }, B.h('button', { class: 'btn', type: 'button', onclick: () => { st.adj = Object.assign({}, ADJ0); st.preview = null; dirty(); paintPanel(); } }, 'Azzera'), B.h('button', { class: 'btn gold', type: 'button', onclick: applyAdj }, B.h('span', { 'data-i': 'Check' }), 'Applica')));
      }
      let prevRaf = 0;
      function previewAdj() {
        if (prevRaf) return;
        prevRaf = requestAnimationFrame(() => {
          prevRaf = 0; const L = active(); if (!L) return;
          const isZero = Object.keys(ADJ0).every((k) => !st.adj[k]);
          if (isZero) { st.preview = null; dirty(); return; }
          const sc = Math.min(1, 1400 / Math.max(L.canvas.width, L.canvas.height));
          let src = L.canvas;
          if (sc < 1) { src = mk(L.canvas.width * sc, L.canvas.height * sc); src.getContext('2d').drawImage(L.canvas, 0, 0, src.width, src.height); }
          st.preview = B.px.adjust(src, st.adj, st.previewBuf || (st.previewBuf = mk(1, 1)));
          maskPreview(L, sc);
          dirty();
        });
      }
      function maskPreview(L, sc) {
        const sm = selMaskForLayer(L); if (!sm) return;
        const p = st.preview, x = p.getContext('2d');
        const orig = mk(p.width, p.height), ox = orig.getContext('2d'); ox.drawImage(L.canvas, 0, 0, p.width, p.height);
        const inv = mk(p.width, p.height), ix = inv.getContext('2d'); ix.drawImage(sm, 0, 0, p.width, p.height);
        x.save(); x.globalCompositeOperation = 'destination-in'; x.drawImage(inv, 0, 0); x.restore();
        ox.globalCompositeOperation = 'destination-out'; ox.drawImage(inv, 0, 0);
        x.drawImage(orig, 0, 0); void sc;
      }
      async function applyAdj() {
        const L = active(); if (!L) return;
        if (Object.keys(ADJ0).every((k) => !st.adj[k])) return B.toast('Nessuna regolazione da applicare');
        B.toast('Applico alla piena risoluzione…');
        await B.sleep(30);
        begin('Regolazioni', [L.id]);
        const out = B.px.adjust(L.canvas, st.adj);
        const sm = selMaskForLayer(L);
        if (sm) { const o = out.getContext('2d'); o.globalCompositeOperation = 'destination-in'; o.drawImage(sm, 0, 0); const base = L.canvas.getContext('2d'); base.save(); base.globalCompositeOperation = 'destination-out'; base.drawImage(sm, 0, 0); base.restore(); base.drawImage(out, 0, 0); }
        else L.canvas = out;
        st.adj = Object.assign({}, ADJ0); st.preview = null; commit(); paintPanel(); B.toast('Regolazioni applicate', 'ok');
      }
      function pFilters() {
        const L = active();
        const g = B.h('div', { class: 'tile-grid' });
        const thumb = mk(160, 160 * L.canvas.height / L.canvas.width); thumb.getContext('2d').drawImage(L.canvas, 0, 0, thumb.width, thumb.height);
        Object.entries(B.px.PRESETS).forEach(([k, [label, p]]) => {
          const t = B.px.adjust(thumb, Object.assign({}, ADJ0, p));
          const tile = B.h('button', { class: 'tile', type: 'button', onclick: () => { st.adj = Object.assign({}, ADJ0, p); previewAdj(); B.$$('.tile', g).forEach((x) => x.classList.remove('on')); tile.classList.add('on'); } }, t, B.h('span', { class: 'tile-lbl', text: label }));
          t.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px';
          g.append(tile);
        });
        panel.append(B.h('div', { class: 'mini-note', text: 'Clicca un filtro per l’anteprima, poi regola i dettagli nella scheda Regola o applicalo subito.' }), g, B.h('div', { class: 'grid2' }, B.h('button', { class: 'btn', type: 'button', onclick: () => setPanel('adjust') }, 'Rifinisci'), B.h('button', { class: 'btn gold', type: 'button', onclick: applyAdj }, 'Applica')));
      }
      function pAI() {
        const L = active();
        const card = (icon, title, text, btnLabel, fn, extra) => { const b = B.h('button', { class: 'btn gold sm', type: 'button' }, B.h('span', { 'data-i': 'Sparkles' }), btnLabel); b.addEventListener('click', async () => { b.disabled = true; const old = b.innerHTML; b.innerHTML = '<span class="spin"></span> Lavoro…'; try { await fn(); } catch (e) { B.err(e); } b.disabled = false; b.innerHTML = old; }); const c = B.h('div', { class: 'ai-box' }, B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': icon }), title), B.h('p', { class: 'mini-note', text }), extra || null, b); panel.append(c); return c; };
        card('Wand2', 'Auto-migliora', 'Thorion analizza la foto e regola luce, colore e nitidezza. Con un motore che vede le immagini, la regolazione è ragionata sul contenuto.', 'Migliora', async () => {
          let p = B.px.autoTune(L.canvas);
          if (B.ai.canSee()) {
            try {
              const small = mk(768 * Math.min(1, L.canvas.width / L.canvas.height), 768 * Math.min(1, L.canvas.height / L.canvas.width)); small.getContext('2d').drawImage(L.canvas, 0, 0, small.width, small.height);
              const blob = await B.canvasToBlob(small, 'image/jpeg', 0.85);
              const r = await B.ai.json('Sei un fotoritoccatore professionista. Guarda questa foto e proponi regolazioni per renderla splendida ma naturale. Rispondi SOLO con JSON con questi campi numerici (da -100 a 100, hue da -30 a 30, sharpen/grain/blur/fade da 0 a 100): ' + Object.keys(ADJ0).join(', ') + '. Aggiungi "note": breve spiegazione in italiano.', { system: false, images: [blob], tier: 'default' });
              p = Object.assign({}, ADJ0); Object.keys(ADJ0).forEach((k) => { if (typeof r[k] === 'number') p[k] = B.clamp(r[k], -100, 100); }); if (r.note) B.toast(r.note, { ms: 7000 });
            } catch (e) { B.toast('Uso l’auto-regolazione locale'); }
          }
          st.adj = p; previewAdj(); setPanel('adjust');
        });
        const gIn = B.h('input', { class: 'input sm', id: 'phGrade', placeholder: 'es. “luce dorata del tramonto”, “film anni ’70”' });
        card('Palette', 'Color grading da testo', 'Descrivi l’atmosfera: Thorion la traduce in regolazioni.', 'Applica atmosfera', async () => {
          if (!gIn.value.trim()) throw Object.assign(new Error(''), { userMessage: 'Descrivi prima l’atmosfera' });
          const r = await B.ai.json('Traduci questa atmosfera fotografica in regolazioni. Atmosfera: "' + gIn.value + '". Rispondi SOLO con JSON con campi numerici (-100..100; hue -30..30): ' + Object.keys(ADJ0).join(', '), { system: false, tier: 'quick' });
          st.adj = Object.assign({}, ADJ0); Object.keys(ADJ0).forEach((k) => { if (typeof r[k] === 'number') st.adj[k] = B.clamp(r[k], -100, 180); }); previewAdj(); setPanel('adjust');
        }, gIn);
        card('Scissors', 'Rimuovi sfondo', 'Scontorno automatico del soggetto. Ideale per prodotti e ritratti su sfondi uniformi.', 'Rimuovi sfondo', async () => {
          begin('Rimuovi sfondo', [L.id]); L.canvas = await B.removeBackground(L.canvas); commit(); B.toast('Sfondo rimosso', 'ok');
        });
        if (B.ai.canSee()) {
          const out = B.h('div', { class: 'md mini-note' });
          card('ScanFace', 'Descrivi la foto', 'Thorion descrive soggetto, luce e composizione e suggerisce come migliorarla.', 'Descrivi', async () => {
            const small = mk(1024 * Math.min(1, L.canvas.width / L.canvas.height), 1024 * Math.min(1, L.canvas.height / L.canvas.width)); small.getContext('2d').drawImage(L.canvas, 0, 0, small.width, small.height);
            const t = await B.ai.text('Descrivi questa foto in modo conciso (soggetto, luce, colori, composizione) e dai 3 consigli di ritocco.', { images: [await B.canvasToBlob(small, 'image/jpeg', 0.85)], tier: 'default' });
            out.innerHTML = await B.md(t);
          }, out);
        }
        const fIn = B.h('input', { class: 'input sm', id: 'phGen', placeholder: doc.sel ? 'Cosa mettere nella selezione?' : 'es. “aggiungi un cappello”, “cielo stellato”' });
        const progress = (b) => (p) => { if (b) b.lastChild && (b.lastChild.textContent = ' ' + (p.processing ? 'Sviluppo…' : 'In coda ' + (p.elapsed || 0) + ' s…')); };
        const noGPU = () => Object.assign(new Error(''), { userMessage: B.ai.MSG.no_photo });
        const genCard = card('Wand2', 'Riempimento generativo', B.ai.engines.horde ? 'Modifica la foto a parole sulla rete GPU comunitaria (gratuita, illimitata). Con una selezione Thorion rigenera solo quella zona (inpainting); senza selezione trasforma l’intera foto in modo realistico.' : 'Usa la rete GPU comunitaria della versione web di Thorion. Qui puoi usare lo strumento Rimuovi oggetti (J) e il Timbro clone.', 'Genera', async () => {
          if (!B.ai.engines.horde) throw noGPU();
          if (!fIn.value.trim()) throw Object.assign(new Error(''), { userMessage: 'Scrivi cosa generare' });
          if (needComp) composite();
          const btn = B.$('.btn.gold', genCard);
          const src = mk(doc.w, doc.h); src.getContext('2d').drawImage(comp, 0, 0);
          const blob = await B.irisEdit(src, fIn.value.trim(), { mask: doc.sel ? doc.sel.mask : null, strength: 0.55, onProgress: progress(btn) });
          const im = await B.loadImage(blob);
          begin('Riempimento generativo', [], true);
          const c = mk(doc.w, doc.h), x = c.getContext('2d'); x.drawImage(im, 0, 0, doc.w, doc.h);
          if (doc.sel) { x.globalCompositeOperation = 'destination-in'; x.filter = 'blur(2px)'; x.drawImage(doc.sel.mask, 0, 0); x.filter = 'none'; }
          insertLayer(layer('Generativo: ' + fIn.value.slice(0, 18), c)); commit(); B.toast('Nuovo livello generato', 'ok');
        }, fIn);
        const xIn = B.h('input', { class: 'input sm', id: 'phExp', placeholder: 'Cosa c’è oltre i bordi? (facoltativo)' });
        const expCard = card('Expand', 'Espandi immagine', B.ai.engines.horde ? 'Allarga la tela del 25%: la rete GPU comunitaria inventa i bordi mancanti (outpainting), il centro resta identico.' : 'Allarga la tela del 25% ricostruendo i bordi con uno specchio sfumato.', 'Espandi', async () => {
          const pad = Math.round(Math.max(doc.w, doc.h) * 0.125), W = doc.w + pad * 2, H = doc.h + pad * 2;
          if (needComp) composite();
          const c = mk(W, H), x = c.getContext('2d');
          x.filter = 'blur(' + Math.round(pad / 6) + 'px)'; x.drawImage(comp, -pad * 0.2, -pad * 0.2, W * 1.02, H * 1.02);
          x.save(); x.translate(pad, pad); x.scale(1, -1); x.drawImage(comp, 0, 0, doc.w, pad, 0, 0, doc.w, pad); x.restore();
          x.save(); x.translate(pad, pad + doc.h * 2); x.scale(1, -1); x.drawImage(comp, 0, doc.h - pad, doc.w, pad, 0, doc.h, doc.w, pad); x.restore();
          x.save(); x.translate(pad, pad); x.scale(-1, 1); x.drawImage(comp, 0, 0, pad, doc.h, 0, 0, pad, doc.h); x.restore();
          x.save(); x.translate(pad + doc.w * 2, pad); x.scale(-1, 1); x.drawImage(comp, doc.w - pad, 0, pad, doc.h, doc.w, 0, pad, doc.h); x.restore();
          x.filter = 'none'; x.drawImage(comp, pad, pad);
          let final = c;
          if (B.ai.engines.horde) {
            try {
              const m = mk(W, H), mx = m.getContext('2d'); mx.fillStyle = '#fff'; mx.fillRect(0, 0, W, H); mx.clearRect(pad + 6, pad + 6, doc.w - 12, doc.h - 12);
              let what = xIn.value.trim();
              const blob = await B.irisEdit(c, (what ? what + ', ' : '') + 'seamless continuation of the same scene, same light and perspective, photorealistic', { mask: m, outpaint: true, rawPrompt: !what, onProgress: progress(B.$('.btn.gold', expCard)) });
              const im = await B.loadImage(blob); const f = mk(W, H), fx = f.getContext('2d'); fx.drawImage(im, 0, 0, W, H); fx.drawImage(comp, pad, pad); final = f;
            } catch (e) { B.toast(B.ai.errorText(e) + ' Uso l’espansione locale.'); }
          }
          begin('Espandi', doc.layers.map((l) => l.id), true);
          doc.layers = [layer('Espansa', final)]; doc.active = doc.layers[0].id; doc.w = W; doc.h = H; doc.sel = null; commit(); fit();
        }, xIn);
        const lookSel = B.h('select', { class: 'select sm', id: 'phLook', 'aria-label': 'Look pellicola' }, Object.entries(B.realism.LOOKS).map(([k, l]) => B.h('option', { value: k }, l.label)));
        const relCard = card('Aperture', 'Realismo Pro', (B.ai.engines.horde ? 'Rifinisci il dettaglio: la rete GPU comunitaria rigenera la foto a tasselli (pelle, tessuti, materiali) e Thorion tiene colori e luce dell’originale. ' : '') + 'Finitura pellicola: curva filmica, micro-contrasto, grana, halation e vignettatura, calcolate sul tuo dispositivo.', 'Applica finitura', async () => {
          const L2 = active();
          begin('Finitura ' + B.realism.LOOKS[lookSel.value].label, [L2.id]);
          await B.sleep(20); L2.canvas = B.realism.finish(L2.canvas, lookSel.value); commit(); B.toast('Finitura applicata', 'ok');
        }, lookSel);
        if (B.ai.engines.horde) {
          const rb = B.h('button', { class: 'btn sm', type: 'button' }, B.h('span', { 'data-i': 'ScanFace' }), ' Rifinisci il dettaglio');
          rb.addEventListener('click', async () => {
            if (Math.max(doc.w, doc.h) > 1536) return B.toast('La rifinitura lavora fino a 1536 px: riduci l’immagine (Immagine › Ridimensiona) o usa la finitura pellicola.');
            rb.disabled = true; const old = rb.innerHTML; rb.innerHTML = '<span class="spin"></span> In coda…';
            try {
              if (needComp) composite();
              const src = mk(doc.w, doc.h); src.getContext('2d').drawImage(comp, 0, 0);
              const prompt = B.ai.canSee() ? await describeForRefine(src) : 'RAW photo, natural light, highly detailed, sharp focus, fine skin and material texture';
              const r = await B.irisRefine(src, { prompt, tiles: 9, onProgress: (p) => { rb.lastChild.textContent = ' ' + Math.round(p * 100) + '%'; } });
              begin('Rifinitura del dettaglio', doc.layers.map((l) => l.id), true);
              doc.layers = [layer('Rifinita', r.canvas)]; doc.active = doc.layers[0].id; doc.w = r.canvas.width; doc.h = r.canvas.height; doc.sel = null; commit(); fit();
              B.toast('Dettaglio rifinito: ' + r.refined + '/' + r.total + ' tasselli · ' + doc.w + '×' + doc.h, 'ok');
            } catch (e) { B.err(e); }
            rb.disabled = false; rb.innerHTML = old;
          });
          relCard.append(rb);
        }
        async function describeForRefine(c) {
          try {
            const s = mk(640 * Math.min(1, c.width / c.height), 640 * Math.min(1, c.height / c.width)); s.getContext('2d').drawImage(c, 0, 0, s.width, s.height);
            const t = await B.ai.text('Describe this photo as a Stable Diffusion prompt in English (max 40 words): start with "RAW photo", then subject, setting, light, lens, texture. Reply with the prompt only.', { system: false, tier: 'quick', images: [await B.canvasToBlob(s, 'image/jpeg', 0.85)] });
            return t.replace(/^["'\s]+|["'\s]+$/g, '').split('\n')[0] || 'RAW photo';
          } catch (e) { return 'RAW photo, natural light, detailed texture'; }
        }
        card('Scaling', 'Ingrandisci 2×', 'Raddoppia la risoluzione con ricampionamento di qualità e nitidezza adattiva.', 'Ingrandisci', async () => {
          if (doc.w * 2 > 8000 || doc.h * 2 > 8000) throw Object.assign(new Error(''), { userMessage: 'L’immagine è già molto grande (max 8000 px).' });
          begin('Ingrandisci 2×', doc.layers.map((l) => l.id), true);
          doc.layers.forEach((L2) => { const c = mk(L2.canvas.width * 2, L2.canvas.height * 2), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(L2.canvas, 0, 0, c.width, c.height); const sharp = B.px.adjust(c, Object.assign({}, ADJ0, { sharpen: 35 })); L2.canvas = sharp; L2.x *= 2; L2.y *= 2; });
          doc.w *= 2; doc.h *= 2; commit(); fit(); B.toast('Nuova dimensione: ' + doc.w + '×' + doc.h, 'ok');
        });
      }
      function pLayers() {
        const list = B.h('div', { class: 'ph-layers' });
        doc.layers.slice().reverse().forEach((L) => {
          const th = mk(48, 48); const x = th.getContext('2d'); const s = Math.min(48 / L.canvas.width, 48 / L.canvas.height); x.drawImage(L.canvas, (48 - L.canvas.width * s) / 2, (48 - L.canvas.height * s) / 2, L.canvas.width * s, L.canvas.height * s);
          th.className = 'ph-lth';
          const row = B.h('div', { class: 'ph-layer' + (L.id === doc.active ? ' on' : ''), onclick: () => { doc.active = L.id; st.adj = Object.assign({}, ADJ0); st.preview = null; dirty(); paintPanel(); } },
            B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Visibilità', 'data-i': L.visible ? 'Eye' : 'EyeOff', onclick: (e) => { e.stopPropagation(); begin('Visibilità', [], true); L.visible = !L.visible; commit(); } }),
            th, B.h('span', { class: 'ph-ln', text: L.name, ondblclick: async (e) => { e.stopPropagation(); const n = await B.prompt('Nome del livello', L.name); if (n) { begin('Rinomina', [], true); L.name = n; commit(); } } }),
            L.locked ? B.h('span', { 'data-i': 'Lock', style: 'color:var(--text-3)' }) : null);
          list.append(row);
        });
        const L = active();
        const blend = B.h('select', { class: 'select sm', 'aria-label': 'Fusione' }, BLENDS.map(([k, l]) => B.h('option', { value: k, selected: L.blend === k }, l)));
        blend.addEventListener('change', () => { begin('Fusione', [], true); L.blend = blend.value; commit(); });
        const op = B.slider({ label: 'Opacità', min: 0, max: 100, value: Math.round(L.opacity * 100), unit: '%', onInput: (v) => { L.opacity = v / 100; dirty(); }, onChange: () => {} });
        panel.append(
          B.h('div', { class: 'grid4' },
            ib('Plus', 'Nuovo livello', () => { begin('Nuovo livello', [], true); insertLayer(layer('Livello ' + (doc.layers.length + 1), mk(doc.w, doc.h))); commit(); }),
            ib('ImagePlus', 'Livello da immagine', async () => { const [f] = await B.pickFiles('image/*'); if (f) addLayerFromImage(f, f.name.replace(/\.[^.]+$/, '')); }),
            ib('Copy', 'Duplica livello', () => { begin('Duplica', [], true); insertLayer(layer(L.name + ' copia', clone(L.canvas), { x: L.x, y: L.y, opacity: L.opacity, blend: L.blend })); commit(); }),
            ib('Trash2', 'Elimina livello', () => { if (doc.layers.length < 2) return B.toast('Serve almeno un livello'); begin('Elimina livello', [], true); doc.layers = doc.layers.filter((x) => x !== L); doc.active = doc.layers[doc.layers.length - 1].id; commit(); }),
            ib('ArrowUp', 'Sposta su', () => moveLayer(1)), ib('ArrowDown', 'Sposta giù', () => moveLayer(-1)),
            ib('Merge', 'Unisci sotto', mergeDown), ib(L.locked ? 'Unlock' : 'Lock', L.locked ? 'Sblocca' : 'Blocca', () => { begin('Blocco', [], true); L.locked = !L.locked; commit(); })),
          B.h('div', { class: 'insp-sec' }, B.h('div', { class: 'lbl', text: 'Livello attivo' }), blend, op),
          list,
          B.h('button', { class: 'btn sm block', type: 'button', onclick: flatten }, B.h('span', { 'data-i': 'Layers' }), 'Unisci tutti i livelli'));
      }
      function ib(icon, tip, fn) { return B.h('button', { class: 'btn icon sm', type: 'button', 'data-tip': tip, 'aria-label': tip, 'data-i': icon, onclick: fn }); }
      function moveLayer(dir) { const L = active(), i = doc.layers.indexOf(L), j = i + dir; if (j < 0 || j >= doc.layers.length) return; begin('Ordine livelli', [], true); doc.layers.splice(i, 1); doc.layers.splice(j, 0, L); commit(); }
      function mergeDown() {
        const L = active(), i = doc.layers.indexOf(L); if (i < 1) return B.toast('Non c’è un livello sotto');
        const D = doc.layers[i - 1]; begin('Unisci sotto', [D.id], true);
        const c = mk(doc.w, doc.h), x = c.getContext('2d'); x.globalAlpha = D.opacity; x.drawImage(D.canvas, D.x, D.y); x.globalAlpha = L.opacity; x.globalCompositeOperation = L.blend; x.drawImage(L.canvas, L.x, L.y);
        D.canvas = c; D.x = 0; D.y = 0; D.opacity = 1; doc.layers.splice(i, 1); doc.active = D.id; commit();
      }
      function flatten() { if (doc.layers.length < 2) return; if (needComp) composite(); begin('Unisci tutti', doc.layers.map((l) => l.id), true); doc.layers = [layer('Sfondo', clone(comp))]; doc.active = doc.layers[0].id; commit(); }

      /* ---------- menus ---------- */
      function openMenu(at) {
        B.menu(at, [
          { label: 'Apri foto…', icon: 'FolderOpen', kbd: 'Ctrl O', fn: async () => { const [f] = await B.pickFiles('image/*'); if (f) openFile(f); } },
          { label: 'Nuova tela…', icon: 'FilePlus', fn: async () => { const v = await B.prompt('Dimensione (larghezza×altezza)', '1920x1080'); const m = v && v.match(/(\d+)\s*[x×*]\s*(\d+)/); if (m) newDoc(B.clamp(+m[1], 16, 8000), B.clamp(+m[2], 16, 8000), '#ffffff'); } },
          { label: 'Aggiungi come livello…', icon: 'ImagePlus', fn: async () => { const [f] = await B.pickFiles('image/*'); if (f) { if (doc.layers.length) addLayerFromImage(f, f.name); else openFile(f); } } },
          { label: 'Dalla galleria AI…', icon: 'Images', fn: galleryPick },
          '-', { label: 'Foto d’esempio', icon: 'Sparkles', fn: demo }
        ]);
      }
      async function galleryPick() {
        const list = (await B.gallery.list()).filter((g) => g.blob);
        if (!list.length) return B.toast('La galleria è vuota: genera un’immagine in Immagini AI');
        const g = B.h('div', { class: 'tile-grid three' });
        const m = B.modal({ title: 'Scegli dalla galleria', body: g, wide: true });
        list.slice(0, 60).forEach((it) => g.append(B.h('button', { class: 'tile', type: 'button', style: { backgroundImage: 'url(' + URL.createObjectURL(it.blob) + ')', backgroundSize: 'cover' }, onclick: async () => { m.close(); if (doc.layers.length) addLayerFromImage(it.blob, it.prompt.slice(0, 20)); else openImage(await B.loadImage(it.blob), it.prompt.slice(0, 30)); } })));
      }
      function imageMenu(at) {
        if (!doc.layers.length) return;
        B.menu(at, [
          { label: 'Dimensione immagine…', icon: 'Scaling', fn: resizeDoc },
          { label: 'Ruota 90° orario', icon: 'RotateCw', fn: () => rotateDoc(1) },
          { label: 'Ruota 90° antiorario', icon: 'RotateCcw', fn: () => rotateDoc(-1) },
          { label: 'Rifletti orizzontale', icon: 'FlipHorizontal', fn: () => flipDoc(true) },
          { label: 'Rifletti verticale', icon: 'FlipVertical', fn: () => flipDoc(false) },
          '-', { label: 'Rifila ai pixel visibili', icon: 'Crop', fn: trim },
          { label: 'Ritaglia alla selezione', icon: 'Crop', fn: () => { if (!doc.sel) return B.toast('Crea prima una selezione'); const b = maskBounds(doc.sel.mask); if (b) { st.overlay = { type: 'crop', r: [b[0], b[1], b[2], b[3]] }; applyCrop(); } } }
        ]);
      }
      function selectMenu(at) {
        if (!doc.layers.length) return;
        B.menu(at, [
          { label: 'Seleziona tutto', kbd: 'Ctrl A', icon: 'Square', fn: selectAll }, { label: 'Deseleziona', kbd: 'Ctrl D', icon: 'X', fn: clearSel }, { label: 'Inverti selezione', kbd: 'Ctrl Shift I', icon: 'Repeat', fn: invertSel },
          '-', { label: 'Elimina contenuto', icon: 'Eraser', kbd: 'Canc', fn: deleteSel }, { label: 'Riempi con colore primario', icon: 'PaintBucket', fn: fillSel },
          { label: 'Copia su nuovo livello', icon: 'Copy', kbd: 'Ctrl J', fn: copyToLayer },
          { label: 'Sfuma i bordi (feather)', icon: 'Droplet', fn: feather }
        ]);
      }
      function maskBounds(m) { const d = m.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, m.width, m.height).data; let x0 = m.width, y0 = m.height, x1 = -1, y1 = -1; for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (d[(y * m.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1]; }
      function deleteSel() { if (!doc.sel) return; const L = active(); begin('Elimina', [L.id]); const x = L.canvas.getContext('2d'); x.save(); x.globalCompositeOperation = 'destination-out'; x.drawImage(selMaskForLayer(L), 0, 0); x.restore(); commit(); }
      function fillSel() { if (!doc.sel) return; const L = active(); begin('Riempi', [L.id]); const t = mk(L.canvas.width, L.canvas.height), tx = t.getContext('2d'); tx.fillStyle = st.fg; tx.fillRect(0, 0, t.width, t.height); tx.globalCompositeOperation = 'destination-in'; tx.drawImage(selMaskForLayer(L), 0, 0); L.canvas.getContext('2d').drawImage(t, 0, 0); commit(); }
      function copyToLayer() { const L = active(); const t = clone(L.canvas); if (doc.sel) { const tx = t.getContext('2d'); tx.globalCompositeOperation = 'destination-in'; tx.drawImage(selMaskForLayer(L), 0, 0); } begin('Copia su livello', [], true); insertLayer(layer(L.name + ' (sel.)', t, { x: L.x, y: L.y })); commit(); }
      function feather() { if (!doc.sel) return; const m = mk(doc.w, doc.h), x = m.getContext('2d'); x.filter = 'blur(' + Math.max(2, Math.round(Math.max(doc.w, doc.h) / 300)) + 'px)'; x.drawImage(doc.sel.mask, 0, 0); selFromMask(m); B.toast('Bordi della selezione sfumati'); }
      async function resizeDoc() {
        const v = await B.prompt('Nuova dimensione in pixel (larghezza×altezza)', doc.w + 'x' + doc.h); const m = v && v.match(/(\d+)\s*[x×*]\s*(\d+)/); if (!m) return;
        const W = B.clamp(+m[1], 8, 8000), H = B.clamp(+m[2], 8, 8000), sx = W / doc.w, sy = H / doc.h;
        begin('Dimensione', doc.layers.map((l) => l.id), true);
        doc.layers.forEach((L) => { const c = mk(L.canvas.width * sx, L.canvas.height * sy), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(L.canvas, 0, 0, c.width, c.height); L.canvas = c; L.x *= sx; L.y *= sy; });
        doc.w = W; doc.h = H; doc.sel = null; commit(); fit();
      }
      function rotateDoc(dir) {
        begin('Ruota', doc.layers.map((l) => l.id), true);
        doc.layers.forEach((L) => { const full = mk(doc.w, doc.h); full.getContext('2d').drawImage(L.canvas, L.x, L.y); const c = mk(doc.h, doc.w), x = c.getContext('2d'); x.translate(dir > 0 ? doc.h : 0, dir > 0 ? 0 : doc.w); x.rotate(dir * Math.PI / 2); x.drawImage(full, 0, 0); L.canvas = c; L.x = 0; L.y = 0; });
        [doc.w, doc.h] = [doc.h, doc.w]; doc.sel = null; commit(); fit();
      }
      function flipDoc(h) {
        begin('Rifletti', doc.layers.map((l) => l.id), true);
        doc.layers.forEach((L) => { const full = mk(doc.w, doc.h); full.getContext('2d').drawImage(L.canvas, L.x, L.y); const c = mk(doc.w, doc.h), x = c.getContext('2d'); if (h) { x.translate(doc.w, 0); x.scale(-1, 1); } else { x.translate(0, doc.h); x.scale(1, -1); } x.drawImage(full, 0, 0); L.canvas = c; L.x = 0; L.y = 0; });
        commit();
      }
      function trim() { if (needComp) composite(); const b = maskBounds(comp); if (!b) return; st.overlay = { type: 'crop', r: b }; applyCrop(); }
      function exportMenu(at) {
        if (!doc.layers.length) return B.toast('Apri prima un’immagine');
        B.menu(at, [
          { label: 'PNG', icon: 'FileImage', fn: () => exportAs('image/png', 'png') },
          { label: 'JPG alta qualità', icon: 'FileImage', fn: () => exportAs('image/jpeg', 'jpg', 0.93) },
          { label: 'WebP', icon: 'FileImage', fn: () => exportAs('image/webp', 'webp', 0.9) },
          '-', { label: 'Usa nel Design Studio', icon: 'LayoutTemplate', fn: async () => { if (needComp) composite(); B.go('design', { imageURL: comp.toDataURL('image/png') }); } },
          { label: 'Anima nel Video AI', icon: 'Film', fn: async () => { if (needComp) composite(); B.go('motion', { imageURL: comp.toDataURL('image/jpeg', 0.92) }); } },
          { label: 'Salva nella galleria', icon: 'Images', fn: async () => { if (needComp) composite(); await B.gallery.add({ blob: await B.canvasToBlob(comp), prompt: doc.name, engine: 'photo', kind: 'raster', w: doc.w, h: doc.h }); B.toast('Salvata in galleria', 'ok'); } }
        ], { align: 'right' });
      }
      async function exportAs(type, ext, q) {
        if (needComp) composite();
        let src = comp;
        if (type === 'image/jpeg') { src = mk(doc.w, doc.h); const x = src.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, doc.w, doc.h); x.drawImage(comp, 0, 0); }
        B.save(await B.canvasToBlob(src, type, q), B.slug(doc.name) + '.' + ext);
      }
      async function saveProject() {
        if (!doc.layers.length) return;
        if (needComp) composite();
        doc.id = doc.id || B.uid('p');
        const th = mk(320, 320 * doc.h / doc.w); th.getContext('2d').drawImage(comp, 0, 0, th.width, th.height);
        await B.projects.save({ id: doc.id, type: 'photo', name: doc.name, thumb: th.toDataURL('image/jpeg', 0.7), data: { w: doc.w, h: doc.h, layers: doc.layers.map((L) => ({ name: L.name, visible: L.visible, opacity: L.opacity, blend: L.blend, x: L.x, y: L.y, locked: L.locked, src: L.canvas.toDataURL('image/png') })) } });
        B.toast('Foto salvata nei progetti', 'ok');
      }
      async function loadProject(id) {
        const p = await B.projects.get(id); if (!p) return;
        doc.id = p.id; doc.name = nameIn.value = p.name; doc.w = p.data.w; doc.h = p.data.h; doc.layers = [];
        for (const l of p.data.layers) { const im = await B.loadImage(l.src); const c = mk(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); doc.layers.push(layer(l.name, c, { visible: l.visible, opacity: l.opacity, blend: l.blend, x: l.x, y: l.y, locked: l.locked })); }
        doc.active = doc.layers[doc.layers.length - 1].id; st.hist = []; st.fut = []; paintWelcome(); fit(); setPanel(st.panel); dirty();
      }

      /* ---------- keys ---------- */
      TOOLS.forEach(([k, , , key]) => { if (key) B.key(key, () => { setTool(k); }, 'photo'); });
      B.key('[', () => { st.size = Math.max(1, Math.round(st.size * 0.85)); paintOpts(); schedule(); }, 'photo');
      B.key(']', () => { st.size = Math.min(600, Math.round(st.size * 1.18) + 1); paintOpts(); schedule(); }, 'photo');
      B.key('mod+z', () => { undo(); }, 'photo'); B.key('mod+y', () => { redo(); }, 'photo'); B.key('mod+shift+z', () => { redo(); }, 'photo');
      B.key('mod+a', () => { selectAll(); }, 'photo'); B.key('mod+d', () => { clearSel(); }, 'photo'); B.key('mod+shift+i', () => { invertSel(); }, 'photo');
      B.key('mod+j', () => { copyToLayer(); }, 'photo'); B.key('delete', () => { deleteSel(); }, 'photo'); B.key('backspace', () => { deleteSel(); }, 'photo');
      B.key('mod+s', () => { saveProject(); }, 'photo'); B.key('mod+o', async () => { const [f] = await B.pickFiles('image/*'); if (f) openFile(f); }, 'photo');
      B.key('enter', () => { if (st.tool === 'crop') applyCrop(); else return false; }, 'photo');
      B.key('x', () => { [st.fg, st.bg] = [st.bg, st.fg]; fgIn.value = st.fg; bgIn.value = st.bg; }, 'photo');
      B.key('mod+0', () => { fit(); }, 'photo'); B.key('mod+=', () => { zoomAt(view.zoom * 1.25); }, 'photo'); B.key('mod+-', () => { zoomAt(view.zoom / 1.25); }, 'photo');
      document.addEventListener('keydown', (e) => { if (e.code === 'Space' && B.current() === 'photo' && !B.isTyping(e)) { st.space = true; stage.dataset.tool = 'hand'; e.preventDefault(); } });
      document.addEventListener('keyup', (e) => { if (e.code === 'Space') { st.space = false; stage.dataset.tool = st.tool; } });

      this.load = async (p) => {
        if (p.project) return loadProject(p.project);
        if (p.imageURL) { const im = await B.loadImage(p.imageURL); if (doc.layers.length && p.asLayer) addLayerFromImage(p.imageURL, 'Importata'); else openImage(im, 'Immagine'); }
        if (p.prompt && !p.imageURL) { B.toast('Apri una foto: poi usa la scheda AI per ritoccarla con le parole'); }
      };
      setTool('brush'); setPanel('adjust'); paintWelcome();
    },
    onShow(p) { if (p && Object.keys(p).length) this.load(p); }
  });
})();
