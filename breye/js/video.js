/* Video Editor — multitrack timeline, text, transitions, filters, AI tools, export */
(function () {
  'use strict';
  const B = window.B;

  const RATIOS = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };
  const FILTERS = {
    none: ['Originale', ''], iris: ['Iride d’oro', 'sepia(.25) saturate(1.25) contrast(1.08) brightness(1.03)'], espresso: ['Espresso', 'contrast(1.2) saturate(.85) sepia(.2) brightness(.92)'],
    cinema: ['Cinema', 'contrast(1.15) saturate(.9) brightness(.97)'], bw: ['Bianco e nero', 'grayscale(1) contrast(1.15)'], vintage: ['Vintage', 'sepia(.45) contrast(.95) saturate(.9) brightness(1.05)'],
    vivid: ['Vivido', 'saturate(1.5) contrast(1.1)'], cold: ['Freddo', 'hue-rotate(-12deg) saturate(1.05) brightness(1.02)'], warm: ['Caldo', 'sepia(.3) saturate(1.3) hue-rotate(-6deg)'],
    dream: ['Sogno', 'brightness(1.1) contrast(.9) saturate(1.2) blur(.6px)'], noir: ['Noir', 'grayscale(1) contrast(1.5) brightness(.85)']
  };
  const TRANS = { none: 'Nessuna', fade: 'Dissolvenza', black: 'Nero', white: 'Bianco', slide: 'Scorrimento', zoom: 'Zoom', wipe: 'Tendina', iris: 'Iride', blink: 'Battito di ciglia', spin: 'Rotazione' };
  const ANIMS = { none: 'Nessuna', fade: 'Dissolvenza', slideUp: 'Sale', slideLeft: 'Da destra', zoom: 'Zoom', pop: 'Pop', typewriter: 'Macchina da scrivere', wordPop: 'Parola per parola' };
  const TEXT_STYLES = {
    plain: ['Semplice', { color: '#ffffff', stroke: '', bg: '', shadow: true }],
    caption: ['Sottotitolo', { color: '#ffffff', stroke: '#000000', bg: '', shadow: false, weight: 800, size: 64 }],
    box: ['Riquadro', { color: '#1a0f08', bg: '#f3d088', stroke: '', shadow: false, weight: 800 }],
    gold: ['Oro', { color: '#f3d088', stroke: '', bg: '', shadow: true, gold: true, font: 'Instrument Serif', italic: true, weight: 400, size: 110 }],
    neon: ['Neon', { color: '#fff6e6', stroke: '', bg: '', glow: '#ff9d2e', weight: 700 }],
    bold: ['Impatto', { color: '#ffffff', stroke: '#1a0f08', bg: '', font: 'Anton', weight: 400, size: 120, upper: true }],
    tiktok: ['Social', { color: '#ffffff', bg: 'rgba(12,7,4,.75)', stroke: '', font: 'Figtree', weight: 800, size: 58 }]
  };
  const FONTS = ['Bricolage Grotesque', 'Figtree', 'Instrument Serif', 'Anton', 'Bebas Neue', 'Montserrat', 'Playfair Display', 'Permanent Marker', 'Pacifico', 'JetBrains Mono', 'Great Vibes', 'Oswald'];

  B.view('video', {
    title: 'Video Editor', icon: 'Clapperboard', group: 'studio', desc: 'Montaggio multitraccia ed export',
    mount(el) {
      const P = { w: 1080, h: 1920, fps: 30, ratio: '9:16', bg: '#000000', name: 'Video senza titolo', id: null,
        tracks: [{ id: 'tx', kind: 'text', name: 'Testo' }, { id: 'ov', kind: 'overlay', name: 'Sovrapposizioni' }, { id: 'v1', kind: 'video', name: 'Video' }, { id: 'a1', kind: 'audio', name: 'Audio' }, { id: 'mu', kind: 'audio', name: 'Musica' }],
        clips: [] };
      const media = new Map();
      const st = { t: 0, playing: false, sel: null, pxs: 60, snap: true, hist: [], fut: [], panel: 'media' };
      el.classList.add('video-view');

      /* ---------- layout ---------- */
      const nameIn = B.h('input', { id: 'vdName', value: P.name, 'aria-label': 'Nome del video' });
      nameIn.addEventListener('change', () => (P.name = nameIn.value || 'Video'));
      const ratioSel = B.h('select', { class: 'select sm', 'aria-label': 'Formato', style: 'width:150px' }, Object.keys(RATIOS).map((k) => B.h('option', { value: k, selected: k === P.ratio }, k + (k === '9:16' ? ' · Reel' : k === '16:9' ? ' · YouTube' : k === '1:1' ? ' · Quadrato' : ' · Feed'))));
      ratioSel.addEventListener('change', () => { setRatio(ratioSel.value); snap(); });
      const bar = B.h('div', { class: 'bar' }, B.h('div', { class: 'bar-title' }, B.h('span', { class: 'bt-ic', 'data-i': 'Clapperboard' }), nameIn),
        B.h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Annulla', 'data-tip': 'Annulla (Ctrl Z)', 'data-i': 'Undo2', onclick: () => undo() }),
        B.h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Ripeti', 'data-tip': 'Ripeti (Ctrl Y)', 'data-i': 'Redo2', onclick: () => redo() }),
        B.h('div', { class: 'bar-sep' }), ratioSel, B.h('div', { class: 'bar-sp' }),
        B.h('button', { class: 'btn', type: 'button', onclick: () => saveProject() }, B.h('span', { 'data-i': 'Save' }), 'Salva'),
        B.h('button', { class: 'btn gold', type: 'button', onclick: () => exportVideo() }, B.h('span', { 'data-i': 'Download' }), 'Esporta'));
      const rail = B.h('nav', { class: 'rail' });
      const PANELS = [['media', 'Media', 'FolderOpen'], ['text', 'Testo', 'Type'], ['audio', 'Audio', 'Music'], ['fx', 'Filtri', 'Sparkle'], ['trans', 'Transizioni', 'Blend'], ['ai', 'AI', 'Sparkles']];
      PANELS.forEach(([k, l, ic]) => rail.append(B.h('button', { class: 'rail-btn', type: 'button', 'data-p': k, onclick: () => openPanel(k) }, B.h('span', { 'data-i': ic }), l)));
      const drawer = B.h('aside', { class: 'drawer' });
      const dHead = B.h('div', { class: 'drawer-h' }, B.h('h3'));
      const dBody = B.h('div', { class: 'drawer-b' });
      drawer.append(dHead, dBody);
      const prevCanvas = B.h('canvas', { class: 'vd-canvas' });
      const prevBox = B.h('div', { class: 'vd-prev' }, prevCanvas);
      const playB = B.h('button', { class: 'btn gold icon', type: 'button', 'aria-label': 'Play', 'data-i': 'Play', onclick: () => togglePlay() });
      const timeL = B.h('span', { class: 'mono vd-time', text: '0:00.0 / 0:00.0' });
      const transport = B.h('div', { class: 'vd-transport' },
        B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Inizio', 'data-i': 'SkipBack', onclick: () => seek(0) }), playB,
        B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Fine', 'data-i': 'SkipForward', onclick: () => seek(duration()) }), timeL);
      const center = B.h('div', { class: 'vd-center stage-wrap' }, prevBox, transport);
      const insp = B.h('aside', { class: 'inspector' }); const inspB = B.h('div', { class: 'insp-b' }); insp.append(inspB);
      const top = B.h('div', { class: 'vd-top' }, rail, drawer, center, insp);

      /* timeline */
      const tlTools = B.h('div', { class: 'tl-tools' },
        tbtn('Scissors', 'Dividi al cursore (S)', () => split()), tbtn('Trash2', 'Elimina (Canc)', () => del()), tbtn('Copy', 'Duplica (Ctrl D)', () => dup()),
        tbtn('Gauge', 'Velocità', (e) => speedMenu(e.currentTarget)), tbtn('Magnet', 'Calamita', (e) => { st.snap = !st.snap; e.currentTarget.classList.toggle('on', st.snap); }),
        B.h('div', { class: 'bar-sp' }), B.h('span', { 'data-i': 'ZoomOut', class: 'muted' }));
      const zoomR = B.h('input', { class: 'range', type: 'range', min: 10, max: 300, value: st.pxs, style: 'width:140px', 'aria-label': 'Zoom timeline' });
      zoomR.addEventListener('input', () => { st.pxs = +zoomR.value; renderTL(); });
      tlTools.append(zoomR, B.h('span', { 'data-i': 'ZoomIn', class: 'muted' }));
      const tlHeads = B.h('div', { class: 'tl-heads' });
      const tlScroll = B.h('div', { class: 'tl-scroll scroll' });
      const tlInner = B.h('div', { class: 'tl-inner' });
      const ruler = B.h('canvas', { class: 'tl-ruler', height: 26 });
      const rows = B.h('div', { class: 'tl-rows' });
      const head = B.h('div', { class: 'tl-playhead' }, B.h('i'));
      tlInner.append(ruler, rows, head); tlScroll.append(tlInner);
      const tl = B.h('div', { class: 'vd-tl' }, tlTools, B.h('div', { class: 'tl-body' }, tlHeads, tlScroll));
      el.append(bar, top, tl);
      function tbtn(ic, tip, fn) { return B.h('button', { class: 'btn icon ghost sm', type: 'button', 'data-tip': tip, 'aria-label': tip, 'data-i': ic, onclick: fn }); }

      /* ---------- helpers ---------- */
      const trackOf = (c) => P.tracks.find((t) => t.id === c.track);
      const duration = () => Math.max(1, ...P.clips.map((c) => c.start + c.dur));
      const clipAt = (track, t) => P.clips.filter((c) => c.track === track && t >= c.start && t < c.start + c.dur);
      function snap() { st.hist.push(JSON.stringify(P)); if (st.hist.length > 80) st.hist.shift(); st.fut = []; }
      function restore(s) { P.clips.forEach((c) => c.el && c.el.pause()); const o = JSON.parse(s); Object.assign(P, o); st.sel = null; P.clips.forEach(ensureEl); renderTL(); paintInsp(); draw(); }
      function undo() { if (st.hist.length < 2) return; st.fut.push(st.hist.pop()); restore(st.hist[st.hist.length - 1]); }
      function redo() { const s = st.fut.pop(); if (!s) return; st.hist.push(s); restore(s); }
      function setRatio(k) { P.ratio = k; [P.w, P.h] = RATIOS[k]; ratioSel.value = k; sizePrev(); draw(); }
      function sizePrev() { const sc = Math.min(1, 720 / Math.max(P.w, P.h)); prevCanvas.width = Math.round(P.w * sc); prevCanvas.height = Math.round(P.h * sc); prevBox.style.setProperty('--ar', P.w + '/' + P.h); }
      sizePrev();

      /* ---------- media ---------- */
      async function addMedia(file, nameOverride) {
        const kind = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : file.type.startsWith('image') ? 'image' : null;
        if (!kind) { B.toast('Formato non supportato: ' + (file.name || file.type), 'err'); return null; }
        const m = { id: B.uid('m'), name: nameOverride || file.name || kind, kind, blob: file, url: URL.createObjectURL(file), duration: 5, w: 0, h: 0, thumbs: [] };
        if (kind === 'image') { const im = await B.loadImage(m.url); m.img = im; m.w = im.naturalWidth; m.h = im.naturalHeight; m.thumbs = [m.url]; }
        else {
          const elx = document.createElement(kind); elx.preload = 'auto'; elx.src = m.url; elx.muted = true; elx.playsInline = true;
          await new Promise((res) => { elx.onloadedmetadata = res; elx.onerror = res; setTimeout(res, 8000); });
          m.duration = isFinite(elx.duration) ? elx.duration : 10; m.w = elx.videoWidth || 0; m.h = elx.videoHeight || 0;
          if (kind === 'video') makeThumbs(m, elx);
          decodeAudio(m);
        }
        media.set(m.id, m);
        try { await B.db.put('blobs', { id: m.id, blob: file, name: m.name, kind }); } catch (e) { /* ignore */ }
        paintPanelSoon();
        return m;
      }
      async function makeThumbs(m, v) {
        const n = 8, c = document.createElement('canvas'); c.height = 60; c.width = Math.round(60 * (m.w / m.h || 16 / 9)); const x = c.getContext('2d');
        for (let i = 0; i < n; i++) {
          await new Promise((res) => { v.onseeked = res; v.currentTime = Math.min(m.duration - 0.05, (i + 0.5) / n * m.duration); setTimeout(res, 1500); });
          try { x.drawImage(v, 0, 0, c.width, c.height); m.thumbs.push(c.toDataURL('image/jpeg', 0.6)); } catch (e) { break; }
        }
        renderTL(); paintPanelSoon();
      }
      async function decodeAudio(m) {
        try {
          const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 44100, 44100);
          m.audio = await ac.decodeAudioData(await m.blob.arrayBuffer());
          const d = m.audio.getChannelData(0), n = 400, step = Math.floor(d.length / n), peaks = [];
          for (let i = 0; i < n; i++) { let mx = 0; for (let j = i * step; j < (i + 1) * step; j += 16) mx = Math.max(mx, Math.abs(d[j] || 0)); peaks.push(mx); }
          m.peaks = peaks; renderTL();
        } catch (e) { m.audio = null; }
      }
      function ensureEl(c) {
        const m = media.get(c.mediaId); if (!m || m.kind === 'image' || c.el) return;
        const e = document.createElement(m.kind); e.src = m.url; e.preload = 'auto'; e.playsInline = true; e.crossOrigin = 'anonymous';
        c.el = e; Object.defineProperty(c, 'el', { enumerable: false, writable: true, value: e });
      }
      function addClip(m, track, start) {
        const tr = track || (m.kind === 'audio' ? 'a1' : 'v1');
        const end = Math.max(0, ...P.clips.filter((c) => c.track === tr).map((c) => c.start + c.dur));
        const c = { id: B.uid('c'), track: tr, type: m.kind, mediaId: m.id, start: start ?? end, in: 0, dur: m.kind === 'image' ? 4 : m.duration, speed: 1, volume: 1, fadeIn: 0, fadeOut: 0, filter: 'none', adj: { b: 100, c: 100, s: 100, blur: 0 }, tf: { x: 0.5, y: 0.5, scale: 1, rot: 0, op: 1 }, fit: 'cover', animIn: 'none', animOut: 'none', trans: 'none', ken: m.kind === 'image' ? 'zoomIn' : 'none' };
        P.clips.push(c); ensureEl(c); snap(); select(c.id); renderTL(); draw(); return c;
      }
      function addText(style, text) {
        const s = TEXT_STYLES[style] || TEXT_STYLES.plain;
        const c = { id: B.uid('c'), track: 'tx', type: 'text', start: st.t, dur: 3, text: Object.assign({ content: text || 'Scrivi qui', font: s[1].font || 'Bricolage Grotesque', size: s[1].size || 84, weight: s[1].weight || 800, italic: !!s[1].italic, upper: !!s[1].upper, color: s[1].color, stroke: s[1].stroke, bg: s[1].bg, shadow: s[1].shadow, glow: s[1].glow || '', gold: !!s[1].gold, align: 'center' }, {}), tf: { x: 0.5, y: style === 'caption' || style === 'tiktok' ? 0.78 : 0.5, scale: 1, rot: 0, op: 1 }, animIn: 'pop', animOut: 'fade', trans: 'none' };
        B.loadFont(c.text.font, '400;700;800').then(draw);
        if (overlaps(c)) c.start = Math.max(0, ...P.clips.filter((x) => x.track === 'tx').map((x) => x.start + x.dur));
        P.clips.push(c); snap(); select(c.id); renderTL(); draw(); return c;
      }
      function overlaps(c) { return P.clips.some((x) => x !== c && x.track === c.track && x.start < c.start + c.dur && c.start < x.start + x.dur); }

      /* ---------- rendering ---------- */
      function alphaFor(c, t) {
        const lt = t - c.start; let a = c.tf ? c.tf.op : 1;
        if (c.fadeIn) a *= B.clamp(lt / c.fadeIn, 0, 1);
        if (c.fadeOut) a *= B.clamp((c.dur - lt) / c.fadeOut, 0, 1);
        return a;
      }
      function animState(c, t) {
        const lt = t - c.start, ai = 0.45, ao = 0.35;
        const pin = c.animIn && c.animIn !== 'none' ? B.ease.out(B.clamp(lt / ai, 0, 1)) : 1;
        const pout = c.animOut && c.animOut !== 'none' ? B.ease.out(B.clamp((c.dur - lt) / ao, 0, 1)) : 1;
        const s = { a: 1, dx: 0, dy: 0, sc: 1, chars: 1 };
        const ap = (k, p) => {
          if (k === 'fade') s.a *= p; else if (k === 'slideUp') { s.dy += (1 - p) * 0.08; s.a *= p; } else if (k === 'slideLeft') { s.dx += (1 - p) * 0.15; s.a *= p; }
          else if (k === 'zoom') { s.sc *= 0.6 + 0.4 * p; s.a *= p; } else if (k === 'pop') { s.sc *= B.ease.back(p); s.a *= Math.min(1, p * 2); }
          else if (k === 'typewriter') s.chars = Math.min(s.chars, B.clamp(lt / Math.max(0.6, c.dur * 0.5), 0, 1)); else if (k === 'wordPop') s.words = lt;
        };
        ap(c.animIn, pin); if (c.animOut !== 'typewriter' && c.animOut !== 'wordPop') ap(c.animOut, pout);
        return s;
      }
      function drawMedia(ctx, c, t, W, H) {
        const m = media.get(c.mediaId); if (!m) return;
        const src = m.kind === 'image' ? m.img : c.el; if (!src) return;
        const sw = m.kind === 'image' ? m.w : src.videoWidth, sh = m.kind === 'image' ? m.h : src.videoHeight; if (!sw || !sh) return;
        const lt = t - c.start, p = B.clamp(lt / c.dur, 0, 1);
        let kb = 1; if (c.ken === 'zoomIn') kb = 1 + 0.12 * B.ease.io(p); else if (c.ken === 'zoomOut') kb = 1.12 - 0.12 * B.ease.io(p);
        const base = c.fit === 'contain' ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh);
        const s = base * c.tf.scale * kb, an = animState(c, t);
        ctx.save();
        ctx.translate(c.tf.x * W + an.dx * W, c.tf.y * H + an.dy * H); ctx.rotate(c.tf.rot * Math.PI / 180); ctx.scale(an.sc, an.sc);
        const f = (FILTERS[c.filter] || FILTERS.none)[1] + (c.adj ? ' brightness(' + c.adj.b / 100 + ') contrast(' + c.adj.c / 100 + ') saturate(' + c.adj.s / 100 + ')' + (c.adj.blur ? ' blur(' + c.adj.blur * W / 1080 + 'px)' : '') : '');
        ctx.filter = f.trim() || 'none';
        if (c.fit === 'contain' && c.track === 'v1') { ctx.save(); ctx.filter = 'blur(' + Math.round(W / 30) + 'px) brightness(.6)'; const bs = Math.max(W / sw, H / sh) * 1.1; ctx.drawImage(src, -sw * bs / 2, -sh * bs / 2, sw * bs, sh * bs); ctx.restore(); ctx.filter = f.trim() || 'none'; }
        ctx.drawImage(src, -sw * s / 2, -sh * s / 2, sw * s, sh * s);
        ctx.restore();
      }
      function drawText(ctx, c, t, W, H) {
        const T = c.text, an = animState(c, t), S = W / 1080;
        let content = T.upper ? T.content.toUpperCase() : T.content;
        if (an.chars < 1) content = content.slice(0, Math.floor(content.length * an.chars));
        ctx.save();
        ctx.translate(c.tf.x * W + an.dx * W, c.tf.y * H + an.dy * H); ctx.rotate((c.tf.rot || 0) * Math.PI / 180); ctx.scale(an.sc * c.tf.scale, an.sc * c.tf.scale);
        const size = T.size * S;
        ctx.font = (T.italic ? 'italic ' : '') + T.weight + ' ' + size + 'px "' + T.font + '", sans-serif';
        ctx.textAlign = T.align || 'center'; ctx.textBaseline = 'middle';
        const maxW = W * 0.86, lines = [];
        content.split('\n').forEach((para) => { let cur = ''; para.split(' ').forEach((wd) => { const test = cur ? cur + ' ' + wd : wd; if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = test; }); lines.push(cur); });
        const lh = size * 1.15, total = lines.length * lh;
        const xOff = T.align === 'left' ? -maxW / 2 : T.align === 'right' ? maxW / 2 : 0;
        lines.forEach((ln, i) => {
          const y = -total / 2 + lh * (i + 0.5);
          if (T.bg) { const w = ctx.measureText(ln).width + size * 0.6; ctx.fillStyle = T.bg; const x0 = T.align === 'left' ? xOff - size * 0.3 : T.align === 'right' ? xOff - w + size * 0.3 : -w / 2; roundRect(ctx, x0, y - lh / 2, w, lh, size * 0.2); ctx.fill(); }
          if (T.shadow) { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = size * 0.25; ctx.shadowOffsetY = size * 0.06; }
          if (T.glow) { ctx.shadowColor = T.glow; ctx.shadowBlur = size * 0.6; }
          if (T.stroke) { ctx.lineWidth = size * 0.12; ctx.lineJoin = 'round'; ctx.strokeStyle = T.stroke; ctx.strokeText(ln, xOff, y); }
          if (T.gold) { const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2); g.addColorStop(0, '#fff3d6'); g.addColorStop(0.55, '#e3a94a'); g.addColorStop(1, '#a8642a'); ctx.fillStyle = g; } else ctx.fillStyle = T.color;
          if (an.words != null) {
            const words = ln.split(' '); let acc = ''; const full = ctx.measureText(ln).width; let x = xOff - (ctx.textAlign === 'center' ? full / 2 : 0);
            ctx.textAlign = 'left';
            words.forEach((wd, k) => { const idx = lines.slice(0, i).join(' ').split(' ').filter(Boolean).length + k; const wt = B.clamp((an.words - idx * 0.18) / 0.25, 0, 1); if (wt > 0) { ctx.save(); const ww = ctx.measureText(wd).width; ctx.translate(x + ww / 2, y); ctx.scale(B.ease.back(wt), B.ease.back(wt)); ctx.globalAlpha *= wt; ctx.fillText(wd, -ww / 2, 0); ctx.restore(); } x += ctx.measureText(wd + ' ').width; acc += wd; });
            ctx.textAlign = T.align || 'center';
          } else ctx.fillText(ln, xOff, y);
          ctx.shadowColor = 'transparent';
        });
        ctx.restore();
      }
      function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
      const layerBuf = { a: null, b: null };
      function buf(k, W, H) { let c = layerBuf[k]; if (!c || c.width !== W || c.height !== H) { c = layerBuf[k] = document.createElement('canvas'); c.width = W; c.height = H; } const x = c.getContext('2d'); x.clearRect(0, 0, W, H); return c; }
      function drawClip(ctx, c, t, W, H) {
        ctx.save(); ctx.globalAlpha *= alphaFor(c, t) * animState(c, t).a;
        if (c.type === 'text') drawText(ctx, c, t, W, H); else drawMedia(ctx, c, t, W, H);
        ctx.restore();
      }
      function renderFrame(ctx, t) {
        const W = ctx.canvas.width, H = ctx.canvas.height;
        ctx.save(); ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
        const visual = P.tracks.filter((tr) => tr.kind !== 'audio' && !tr.hidden).slice().reverse();
        visual.forEach((tr) => {
          const cs = P.clips.filter((c) => c.track === tr.id).sort((a, b) => a.start - b.start);
          cs.forEach((c, i) => {
            if (t < c.start || t >= c.start + c.dur) return;
            const prev = cs[i - 1];
            const td = Math.min(0.8, c.dur / 2);
            if (c.trans && c.trans !== 'none' && prev && Math.abs(prev.start + prev.dur - c.start) < 0.05 && t - c.start < td) {
              const p = B.ease.io((t - c.start) / td);
              const A = buf('a', W, H), Bb = buf('b', W, H);
              drawClip(A.getContext('2d'), prev, prev.start + prev.dur - 0.001, W, H); drawClip(Bb.getContext('2d'), c, t, W, H);
              transition(ctx, A, Bb, c.trans, p, W, H);
            } else drawClip(ctx, c, t, W, H);
          });
        });
        ctx.restore();
      }
      function transition(ctx, A, Bc, k, p, W, H) {
        if (k === 'black' || k === 'white') { const col = k === 'black' ? '0,0,0' : '255,250,241'; ctx.drawImage(p < 0.5 ? A : Bc, 0, 0); ctx.fillStyle = 'rgba(' + col + ',' + (1 - Math.abs(p - 0.5) * 2) + ')'; ctx.fillRect(0, 0, W, H); return; }
        if (k === 'slide') { ctx.drawImage(A, -W * p, 0); ctx.drawImage(Bc, W * (1 - p), 0); return; }
        if (k === 'zoom') { ctx.save(); ctx.globalAlpha = 1 - p; ctx.translate(W / 2, H / 2); ctx.scale(1 + p * 0.4, 1 + p * 0.4); ctx.drawImage(A, -W / 2, -H / 2); ctx.restore(); ctx.save(); ctx.globalAlpha = p; ctx.translate(W / 2, H / 2); ctx.scale(1.3 - p * 0.3, 1.3 - p * 0.3); ctx.drawImage(Bc, -W / 2, -H / 2); ctx.restore(); return; }
        if (k === 'wipe') { ctx.drawImage(A, 0, 0); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * p, H); ctx.clip(); ctx.drawImage(Bc, 0, 0); ctx.restore(); ctx.fillStyle = '#e3a94a'; ctx.fillRect(W * p - 2, 0, 4, H); return; }
        if (k === 'iris') { ctx.drawImage(A, 0, 0); const R = Math.hypot(W, H) / 2 * p; ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(0.1, R), 0, 7); ctx.clip(); ctx.drawImage(Bc, 0, 0); ctx.restore(); ctx.strokeStyle = 'rgba(227,169,74,' + (1 - p) + ')'; ctx.lineWidth = W * 0.015 * (1 - p) + 1; ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(0.1, R), 0, 7); ctx.stroke(); return; }
        if (k === 'blink') { const c = p < 0.5 ? p * 2 : (1 - p) * 2; ctx.drawImage(p < 0.5 ? A : Bc, 0, 0); const lid = H / 2 * B.ease.io(c); ctx.fillStyle = '#050302'; ctx.fillRect(0, 0, W, lid); ctx.fillRect(0, H - lid, W, lid); return; }
        if (k === 'spin') { ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate((1 - p) * -0.6); ctx.scale(0.6 + 0.4 * p, 0.6 + 0.4 * p); ctx.globalAlpha = p; ctx.drawImage(Bc, -W / 2, -H / 2); ctx.restore(); ctx.globalAlpha = 1 - p; ctx.drawImage(A, 0, 0); ctx.globalAlpha = 1; return; }
        ctx.drawImage(A, 0, 0); ctx.globalAlpha = p; ctx.drawImage(Bc, 0, 0); ctx.globalAlpha = 1;
      }

      /* ---------- playback ---------- */
      let raf = 0, lastNow = 0;
      function syncMedia(play) {
        P.clips.forEach((c) => {
          if (!c.el) return;
          const tr = trackOf(c);
          const active = st.t >= c.start && st.t < c.start + c.dur && !(tr && tr.hidden);
          const want = c.in + (st.t - c.start) * c.speed;
          if (active) {
            c.el.playbackRate = c.speed || 1;
            const fa = c.fadeIn ? B.clamp((st.t - c.start) / c.fadeIn, 0, 1) : 1, fo = c.fadeOut ? B.clamp((c.start + c.dur - st.t) / c.fadeOut, 0, 1) : 1;
            c.el.volume = B.clamp((c.volume ?? 1) * fa * fo, 0, 1); c.el.muted = !!(tr && tr.muted) || !play;
            if (play) { if (c.el.paused) { c.el.currentTime = want; c.el.play().catch(() => {}); } else if (Math.abs(c.el.currentTime - want) > 0.3) c.el.currentTime = want; }
            else { if (!c.el.paused) c.el.pause(); if (Math.abs(c.el.currentTime - want) > 0.04) c.el.currentTime = want; }
          } else if (!c.el.paused) c.el.pause();
        });
      }
      function draw() { renderFrame(prevCanvas.getContext('2d'), st.t); timeL.textContent = B.fmtTime(st.t) + ' / ' + B.fmtTime(duration()); placeHead(); }
      function loop(now) {
        if (!st.playing) return;
        st.t += (now - lastNow) / 1000; lastNow = now;
        if (st.t >= duration()) { st.t = duration(); togglePlay(false); }
        syncMedia(true); draw(); autoScroll();
        raf = requestAnimationFrame(loop);
      }
      function togglePlay(force) {
        st.playing = force ?? !st.playing;
        if (st.playing && st.t >= duration() - 0.05) st.t = 0;
        playB.dataset.i = st.playing ? 'Pause' : 'Play'; B.hydrateIcons(transport);
        if (st.playing) { lastNow = performance.now(); raf = requestAnimationFrame(loop); } else { cancelAnimationFrame(raf); syncMedia(false); draw(); }
      }
      function seek(t) { st.t = B.clamp(t, 0, duration()); syncMedia(st.playing); draw(); }
      P.clips.forEach(ensureEl);
      // redraw when paused media finishes seeking
      setInterval(() => { if (!st.playing && B.current() === 'video') draw(); }, 250);

      /* ---------- timeline UI ---------- */
      function renderTL() {
        const D = Math.max(duration() + 10, 30), W = D * st.pxs;
        tlInner.style.width = W + 'px';
        tlHeads.innerHTML = ''; rows.innerHTML = '';
        tlHeads.append(B.h('div', { class: 'tl-hd-ruler' }));
        P.tracks.forEach((tr) => {
          tlHeads.append(B.h('div', { class: 'tl-hd ' + tr.kind }, B.h('span', { 'data-i': tr.kind === 'text' ? 'Type' : tr.kind === 'audio' ? (tr.id === 'mu' ? 'Music' : 'AudioLines') : tr.kind === 'overlay' ? 'Layers' : 'Film' }), B.h('span', { class: 'tl-hd-n', text: tr.name }),
            B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': tr.kind === 'audio' ? 'Muto' : 'Nascondi', 'data-i': tr.kind === 'audio' ? (tr.muted ? 'VolumeX' : 'Volume2') : (tr.hidden ? 'EyeOff' : 'Eye'), onclick: () => { if (tr.kind === 'audio') tr.muted = !tr.muted; else tr.hidden = !tr.hidden; renderTL(); draw(); } })));
          const row = B.h('div', { class: 'tl-row ' + tr.kind, 'data-track': tr.id });
          P.clips.filter((c) => c.track === tr.id).forEach((c) => row.append(clipEl(c)));
          rows.append(row);
        });
        // ruler
        const dpr = Math.min(2, devicePixelRatio || 1);
        ruler.width = W * dpr; ruler.style.width = W + 'px'; ruler.height = 26 * dpr;
        const x = ruler.getContext('2d'); x.scale(dpr, dpr); x.fillStyle = getComputedStyle(el).getPropertyValue('--text-3') || '#957c64'; x.font = '10px JetBrains Mono, monospace';
        const step = st.pxs >= 120 ? 0.5 : st.pxs >= 50 ? 1 : st.pxs >= 25 ? 2 : 5;
        for (let s = 0; s <= D; s += step) { const px = s * st.pxs; const major = Math.abs(s % (step * 2)) < 1e-6; x.fillRect(px, major ? 14 : 19, 1, major ? 12 : 7); if (major) x.fillText(B.fmtTime(s).replace(/\.0$/, ''), px + 3, 11); }
        B.hydrateIcons(tl); placeHead();
      }
      function clipEl(c) {
        const m = media.get(c.mediaId);
        const elc = B.h('div', { class: 'tl-clip ' + c.type + (st.sel === c.id ? ' sel' : ''), 'data-id': c.id, style: { left: c.start * st.pxs + 'px', width: Math.max(6, c.dur * st.pxs) + 'px' } });
        if (m && m.thumbs && m.thumbs.length && c.type !== 'audio') { const th = B.h('div', { class: 'tl-thumbs' }); const n = Math.max(1, Math.ceil(c.dur * st.pxs / 60)); for (let i = 0; i < n; i++) th.append(B.h('img', { src: m.thumbs[Math.min(m.thumbs.length - 1, Math.floor(((c.in + i / n * c.dur * c.speed) / (m.duration || 1)) * m.thumbs.length))] || m.thumbs[0], alt: '' })); elc.append(th); }
        if (m && m.peaks && (c.type === 'audio' || c.type === 'video')) { const wv = B.h('canvas', { class: 'tl-wave', width: Math.max(6, Math.round(c.dur * st.pxs)), height: c.type === 'audio' ? 40 : 16 }); const x = wv.getContext('2d'); x.fillStyle = c.type === 'audio' ? 'rgba(243,208,136,.85)' : 'rgba(255,255,255,.55)'; const n = wv.width; for (let i = 0; i < n; i++) { const tt = c.in + i / n * c.dur * c.speed; const pk = m.peaks[Math.floor(tt / m.duration * m.peaks.length)] || 0; const hh = Math.max(1, pk * wv.height); x.fillRect(i, (wv.height - hh) / 2, 1, hh); } elc.append(wv); }
        elc.append(B.h('span', { class: 'tl-lbl', text: c.type === 'text' ? '“' + c.text.content + '”' : (m ? m.name : 'clip') + (c.speed !== 1 ? ' · ' + c.speed + '×' : '') }));
        if (c.trans && c.trans !== 'none') elc.append(B.h('span', { class: 'tl-tr', 'data-tip': 'Transizione: ' + TRANS[c.trans] }, '⧉'));
        elc.append(B.h('i', { class: 'tl-h l' }), B.h('i', { class: 'tl-h r' }));
        elc.addEventListener('pointerdown', (e) => clipDrag(e, c, elc));
        elc.addEventListener('contextmenu', (e) => { e.preventDefault(); select(c.id); B.menu({ x: e.clientX, y: e.clientY }, [{ label: 'Dividi al cursore', icon: 'Scissors', kbd: 'S', fn: split }, { label: 'Duplica', icon: 'Copy', fn: dup }, { label: 'Elimina', icon: 'Trash2', kbd: 'Canc', fn: del }]); });
        return elc;
      }
      function snapT(t, ex) {
        if (!st.snap) return t;
        const pts = [0, st.t]; P.clips.forEach((c) => { if (c.id !== ex) pts.push(c.start, c.start + c.dur); });
        let best = t, bd = 8 / st.pxs; pts.forEach((p) => { if (Math.abs(p - t) < bd) { bd = Math.abs(p - t); best = p; } }); return best;
      }
      function clipDrag(e, c, elc) {
        e.stopPropagation(); select(c.id);
        const mode = e.target.classList.contains('tl-h') ? (e.target.classList.contains('l') ? 'l' : 'r') : 'move';
        const x0 = e.clientX, s0 = c.start, d0 = c.dur, in0 = c.in || 0, m = media.get(c.mediaId);
        const maxDur = m && m.kind !== 'image' ? (m.duration - in0) / c.speed : 600;
        elc.setPointerCapture(e.pointerId);
        let moved = false;
        const mv = (ev) => {
          const dt = (ev.clientX - x0) / st.pxs; if (Math.abs(ev.clientX - x0) > 2) moved = true;
          if (mode === 'move') { c.start = Math.max(0, snapT(s0 + dt, c.id)); const hit = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n.classList && n.classList.contains('tl-row')); if (hit && hit !== elc.parentElement) { const tr = P.tracks.find((t) => t.id === hit.dataset.track); if (tr && compatible(c, tr)) { c.track = tr.id; hit.append(elc); } } }
          else if (mode === 'r') { c.dur = B.clamp(snapT(s0 + d0 + dt, c.id) - c.start, 0.2, m && m.kind !== 'image' ? (m.duration - c.in) / c.speed : 600); }
          else { const ns = B.clamp(snapT(s0 + dt, c.id), Math.max(0, s0 - in0 / c.speed), s0 + d0 - 0.2); const delta = ns - s0; c.start = ns; c.dur = d0 - delta; if (c.type !== 'text' && m && m.kind !== 'image') c.in = in0 + delta * c.speed; }
          void maxDur;
          elc.style.left = c.start * st.pxs + 'px'; elc.style.width = c.dur * st.pxs + 'px';
          draw();
        };
        const up = () => { elc.removeEventListener('pointermove', mv); elc.removeEventListener('pointerup', up); if (moved) { snap(); renderTL(); paintInsp(); } };
        elc.addEventListener('pointermove', mv); elc.addEventListener('pointerup', up);
      }
      function compatible(c, tr) { if (c.type === 'audio') return tr.kind === 'audio'; if (c.type === 'text') return tr.kind === 'text' || tr.kind === 'overlay'; return tr.kind === 'video' || tr.kind === 'overlay'; }
      function placeHead() { head.style.transform = 'translateX(' + st.t * st.pxs + 'px)'; }
      function autoScroll() { const x = st.t * st.pxs; if (x > tlScroll.scrollLeft + tlScroll.clientWidth - 60) tlScroll.scrollLeft = x - 120; }
      tlScroll.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.tl-clip')) return;
        const r = tlInner.getBoundingClientRect();
        const set = (ev) => seek((ev.clientX - r.left) / st.pxs);
        set(e); if (!e.target.closest('.tl-rows')) { /* ruler */ } else select(null);
        const mv = (ev) => set(ev); const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      });
      tlScroll.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); st.pxs = B.clamp(st.pxs * Math.exp(-e.deltaY * 0.002), 10, 300); zoomR.value = st.pxs; B.rangeFill(zoomR); renderTL(); } }, { passive: false });
      tlScroll.addEventListener('scroll', () => { tlHeads.scrollTop = tlScroll.scrollTop; });

      /* ---------- editing ops ---------- */
      function select(id) { st.sel = id; B.$$('.tl-clip', rows).forEach((x) => x.classList.toggle('sel', x.dataset.id === id)); paintInsp(); }
      const selClip = () => P.clips.find((c) => c.id === st.sel);
      function split() {
        const c = selClip() || P.clips.find((x) => x.track === 'v1' && st.t > x.start && st.t < x.start + x.dur);
        if (!c || st.t <= c.start + 0.05 || st.t >= c.start + c.dur - 0.05) return B.toast('Posiziona il cursore dentro una clip');
        const cut = st.t - c.start;
        const n = JSON.parse(JSON.stringify(c)); n.id = B.uid('c'); n.start = st.t; n.dur = c.dur - cut; n.in = (c.in || 0) + cut * (c.speed || 1); n.trans = 'none'; n.animIn = 'none';
        c.dur = cut; c.animOut = 'none';
        P.clips.push(n); ensureEl(n); snap(); renderTL(); select(n.id); B.toast('Clip divisa', { icon: 'Scissors' });
      }
      function del() { const c = selClip(); if (!c) return; if (c.el) c.el.pause(); P.clips = P.clips.filter((x) => x !== c); st.sel = null; snap(); renderTL(); paintInsp(); draw(); }
      function dup() { const c = selClip(); if (!c) return; const n = JSON.parse(JSON.stringify(c)); n.id = B.uid('c'); n.start = c.start + c.dur; P.clips.push(n); ensureEl(n); snap(); renderTL(); select(n.id); }
      function speedMenu(at) { const c = selClip(); if (!c || c.type === 'text') return B.toast('Seleziona una clip video o audio'); B.menu(at, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((s) => ({ label: s + '×', active: c.speed === s, fn: () => { const m = media.get(c.mediaId); const srcLen = c.dur * c.speed; c.speed = s; c.dur = m && m.kind !== 'image' ? Math.min(srcLen / s, (m.duration - c.in) / s) : c.dur; snap(); renderTL(); paintInsp(); draw(); } }))); }

      /* ---------- inspector ---------- */
      function paintInsp() {
        inspB.innerHTML = '';
        const c = selClip();
        if (!c) {
          inspB.append(B.h('div', { class: 'insp-sec' }, B.h('div', { class: 'lbl', text: 'Progetto' }), B.h('div', { class: 'mini-note', html: P.w + '×' + P.h + ' · ' + P.fps + ' fps · durata ' + B.fmtTime(duration()) + '<br>Seleziona una clip nella timeline per modificarla.' }),
            B.h('div', { class: 'row' }, B.h('input', { type: 'color', class: 'swatch-in', value: P.bg, 'aria-label': 'Colore di sfondo', oninput: (e) => { P.bg = e.target.value; draw(); }, onchange: snap }), B.h('span', { class: 'mini-note', text: 'Colore di sfondo' }))));
          inspB.append(B.h('div', { class: 'insp-sec' }, B.h('div', { class: 'lbl', text: 'Scorciatoie' }), B.h('div', { class: 'mini-note', html: '<kbd>Spazio</kbd> play · <kbd>S</kbd> dividi · <kbd>Canc</kbd> elimina · <kbd>Ctrl</kbd> <kbd>D</kbd> duplica · <kbd>←</kbd> <kbd>→</kbd> fotogramma · <kbd>Ctrl</kbd>+rotella zoom timeline' })));
          return;
        }
        const sec = (t, ...k) => { const s = B.h('div', { class: 'insp-sec' }, B.h('div', { class: 'lbl', text: t })); k.forEach((x) => x && s.append(x)); inspB.append(s); return s; };
        const ch = (fn) => () => { fn(); snap(); renderTL(); draw(); };
        if (c.type === 'text') {
          const ta = B.h('textarea', { class: 'textarea', id: 'vdTextC', rows: 3 }); ta.value = c.text.content;
          ta.addEventListener('input', () => { c.text.content = ta.value; draw(); }); ta.addEventListener('change', ch(() => {}));
          const fs = B.h('select', { class: 'select sm', 'aria-label': 'Font' }, FONTS.map((f) => B.h('option', { value: f, selected: c.text.font === f }, f)));
          fs.addEventListener('change', async () => { await B.loadFont(fs.value, '400;700;800'); c.text.font = fs.value; snap(); draw(); });
          const styles = B.h('div', { class: 'chips' }); Object.entries(TEXT_STYLES).forEach(([k, [l, s]]) => styles.append(B.h('button', { class: 'chip', type: 'button', onclick: async () => { Object.assign(c.text, { color: s.color, stroke: s.stroke, bg: s.bg, shadow: s.shadow, glow: s.glow || '', gold: !!s.gold, italic: !!s.italic, upper: !!s.upper }); if (s.font) { await B.loadFont(s.font, '400;700;800'); c.text.font = s.font; } if (s.weight) c.text.weight = s.weight; if (s.size) c.text.size = s.size; snap(); draw(); paintInsp(); } }, l)));
          sec('Testo', ta, fs, B.slider({ label: 'Dimensione', min: 20, max: 260, value: c.text.size, onInput: (v) => { c.text.size = v; draw(); }, onChange: snap }),
            B.h('div', { class: 'row' }, B.h('input', { type: 'color', class: 'swatch-in', value: /^#/.test(c.text.color) ? c.text.color : '#ffffff', 'aria-label': 'Colore testo', oninput: (e) => { c.text.color = e.target.value; c.text.gold = false; draw(); }, onchange: snap }), B.h('span', { class: 'mini-note', text: 'Colore' }), B.h('div', { class: 'bar-sp' }),
              B.h('div', { class: 'seg' }, ['left', 'center', 'right'].map((a) => B.h('button', { type: 'button', class: c.text.align === a ? 'on' : '', 'aria-label': a, onclick: () => { c.text.align = a; snap(); draw(); paintInsp(); } }, B.h('span', { 'data-i': a === 'left' ? 'AlignLeft' : a === 'right' ? 'AlignRight' : 'AlignCenter' }))))));
          sec('Stile', styles);
        } else {
          const m = media.get(c.mediaId);
          if (c.type !== 'audio') {
            const fl = B.h('div', { class: 'chips' }); Object.entries(FILTERS).forEach(([k, [l]]) => fl.append(B.h('button', { class: 'chip' + (c.filter === k ? ' on' : ''), type: 'button', onclick: () => { c.filter = k; snap(); draw(); paintInsp(); } }, l)));
            sec('Filtro', fl);
            sec('Regolazioni', B.slider({ label: 'Luminosità', min: 30, max: 170, value: c.adj.b, onInput: (v) => { c.adj.b = v; draw(); }, onChange: snap }), B.slider({ label: 'Contrasto', min: 30, max: 170, value: c.adj.c, onInput: (v) => { c.adj.c = v; draw(); }, onChange: snap }), B.slider({ label: 'Saturazione', min: 0, max: 200, value: c.adj.s, onInput: (v) => { c.adj.s = v; draw(); }, onChange: snap }), B.slider({ label: 'Sfocatura', min: 0, max: 20, value: c.adj.blur, onInput: (v) => { c.adj.blur = v; draw(); }, onChange: snap }));
            const fit = B.h('div', { class: 'seg' }, [['cover', 'Riempi'], ['contain', 'Adatta']].map(([k, l]) => B.h('button', { type: 'button', class: c.fit === k ? 'on' : '', onclick: () => { c.fit = k; snap(); draw(); paintInsp(); } }, l)));
            sec('Inquadratura', fit, m && m.kind === 'image' ? B.h('select', { class: 'select sm', 'aria-label': 'Movimento', onchange: (e) => { c.ken = e.target.value; snap(); draw(); } }, [['none', 'Fermo'], ['zoomIn', 'Zoom avanti lento'], ['zoomOut', 'Zoom indietro lento']].map(([k, l]) => B.h('option', { value: k, selected: c.ken === k }, l))) : null);
          }
          if (c.type !== 'image') sec('Audio', B.slider({ label: 'Volume', min: 0, max: 100, value: Math.round((c.volume ?? 1) * 100), unit: '%', onInput: (v) => { c.volume = v / 100; }, onChange: snap }), B.slider({ label: 'Dissolvenza in entrata', min: 0, max: 5, step: 0.1, value: c.fadeIn || 0, unit: 's', onInput: (v) => { c.fadeIn = v; draw(); }, onChange: snap }), B.slider({ label: 'Dissolvenza in uscita', min: 0, max: 5, step: 0.1, value: c.fadeOut || 0, unit: 's', onInput: (v) => { c.fadeOut = v; draw(); }, onChange: snap }));
        }
        if (c.type !== 'audio') {
          sec('Trasformazione', B.slider({ label: 'Scala', min: 10, max: 300, value: Math.round(c.tf.scale * 100), unit: '%', onInput: (v) => { c.tf.scale = v / 100; draw(); }, onChange: snap }), B.slider({ label: 'Posizione X', min: -50, max: 150, value: Math.round(c.tf.x * 100), unit: '%', onInput: (v) => { c.tf.x = v / 100; draw(); }, onChange: snap }), B.slider({ label: 'Posizione Y', min: -50, max: 150, value: Math.round(c.tf.y * 100), unit: '%', onInput: (v) => { c.tf.y = v / 100; draw(); }, onChange: snap }), B.slider({ label: 'Rotazione', min: -180, max: 180, value: c.tf.rot || 0, unit: '°', onInput: (v) => { c.tf.rot = v; draw(); }, onChange: snap }), B.slider({ label: 'Opacità', min: 0, max: 100, value: Math.round(c.tf.op * 100), unit: '%', onInput: (v) => { c.tf.op = v / 100; draw(); }, onChange: snap }));
          const anim = (key) => B.h('select', { class: 'select sm', 'aria-label': key, onchange: (e) => { c[key] = e.target.value; snap(); draw(); } }, Object.entries(ANIMS).filter(([k]) => c.type === 'text' || !['typewriter', 'wordPop'].includes(k)).map(([k, l]) => B.h('option', { value: k, selected: c[key] === k }, l)));
          sec('Animazione', B.h('div', { class: 'grid2' }, B.h('div', { class: 'field' }, B.h('span', { class: 'lbl', text: 'Entrata' }), anim('animIn')), B.h('div', { class: 'field' }, B.h('span', { class: 'lbl', text: 'Uscita' }), anim('animOut'))));
          if (c.type !== 'text') sec('Transizione d’ingresso', B.h('select', { class: 'select sm', 'aria-label': 'Transizione', onchange: (e) => { c.trans = e.target.value; snap(); renderTL(); draw(); } }, Object.entries(TRANS).map(([k, l]) => B.h('option', { value: k, selected: c.trans === k }, l))), B.h('div', { class: 'mini-note', text: 'Si vede quando la clip segue un’altra clip sulla stessa traccia.' }));
        }
        const timing = sec('Tempi');
        timing.append(B.h('div', { class: 'grid2' }, numIn('Inizio', c.start, (v) => (c.start = Math.max(0, v))), numIn('Durata', c.dur, (v) => (c.dur = Math.max(0.2, v)))));
        timing.append(B.h('div', { class: 'grid3' }, B.h('button', { class: 'btn sm', type: 'button', onclick: split }, B.h('span', { 'data-i': 'Scissors' }), 'Dividi'), B.h('button', { class: 'btn sm', type: 'button', onclick: dup }, B.h('span', { 'data-i': 'Copy' }), 'Duplica'), B.h('button', { class: 'btn sm danger', type: 'button', onclick: del }, B.h('span', { 'data-i': 'Trash2' }), 'Elimina')));
        B.hydrateIcons(inspB);
      }
      function numIn(label, v, fn) { const i = B.h('input', { type: 'number', step: 0.1, value: (+v).toFixed(2), 'aria-label': label }); i.addEventListener('change', () => { fn(+i.value); snap(); renderTL(); draw(); }); return B.h('label', { class: 'num' }, B.h('span', { text: label }), i); }

      /* ---------- panels ---------- */
      const paintPanelSoon = B.debounce(() => { if (st.panel === 'media') openPanel('media'); }, 120);
      function openPanel(k) {
        st.panel = k; drawer.classList.remove('closed');
        B.$$('.rail-btn', rail).forEach((b) => b.classList.toggle('on', b.dataset.p === k));
        B.$('h3', dHead).textContent = PANELS.find((p) => p[0] === k)[1]; dBody.innerHTML = '';
        ({ media: pMedia, text: pText, audio: pAudio, fx: pFx, trans: pTrans, ai: pAI })[k]();
        B.hydrateIcons(drawer);
      }
      function pMedia() {
        const dz = B.h('div', { class: 'dropzone' }, B.h('span', { 'data-i': 'Upload' }), B.h('b', { text: 'Importa video, foto e audio' }), B.h('small', { text: 'Trascina i file qui o clicca. MP4, MOV, WebM, JPG, PNG, MP3, WAV' }));
        dz.addEventListener('click', async () => { for (const f of await B.pickFiles('video/*,image/*,audio/*', true)) { const m = await addMedia(f); if (m) addClip(m); } });
        dBody.append(dz);
        dBody.append(B.h('button', { class: 'btn block sm', type: 'button', onclick: fromGallery }, B.h('span', { 'data-i': 'Image' }), 'Dalla galleria AI'));
        const list = B.h('div', { class: 'tile-grid' });
        media.forEach((m) => {
          const t = B.h('button', { class: 'tile wide vd-media', type: 'button', 'data-tip': 'Aggiungi alla timeline', onclick: () => addClip(m) }, B.h('span', { class: 'tile-lbl', text: m.name }), B.h('span', { class: 'vd-mdur', text: m.kind === 'image' ? 'FOTO' : B.fmtTime(m.duration) }));
          if (m.thumbs[0]) { t.style.backgroundImage = 'url(' + m.thumbs[0] + ')'; t.style.backgroundSize = 'cover'; } else t.prepend(B.h('span', { 'data-i': m.kind === 'audio' ? 'Music' : 'Film', 'data-size': 26 }));
          list.append(t);
        });
        if (media.size) dBody.append(B.h('div', { class: 'lbl', text: 'Nel progetto' }), list);
        dBody.append(B.h('div', { class: 'lbl', text: 'Colori e sfondi' }));
        const cg = B.h('div', { class: 'tile-grid three' });
        ['#000000', '#1a0f08', '#e3a94a', '#fffaf1', '#7a3d16', '#3b2314'].forEach((col) => cg.append(B.h('button', { class: 'tile', type: 'button', style: { background: col }, 'aria-label': 'Clip colore ' + col, onclick: async () => { const c = document.createElement('canvas'); c.width = P.w; c.height = P.h; const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, P.w, P.h); const m = await addMedia(new File([await B.canvasToBlob(c)], 'Colore ' + col + '.png', { type: 'image/png' })); if (m) addClip(m, 'v1'); } })));
        dBody.append(cg);
      }
      async function fromGallery() {
        const list = (await B.gallery.list()).filter((g) => g.blob);
        if (!list.length) return B.toast('La galleria è vuota');
        const g = B.h('div', { class: 'tile-grid three' }); const md = B.modal({ title: 'Galleria AI', body: g, wide: true });
        list.slice(0, 60).forEach((it) => g.append(B.h('button', { class: 'tile', type: 'button', style: { backgroundImage: 'url(' + URL.createObjectURL(it.blob) + ')', backgroundSize: 'cover' }, onclick: async () => { md.close(); const m = await addMedia(new File([it.blob], (it.prompt || 'immagine').slice(0, 30) + '.png', { type: it.blob.type || 'image/png' })); if (m) addClip(m); } })));
      }
      function pText() {
        dBody.append(B.h('p', { class: 'mini-note', text: 'Il testo viene aggiunto alla posizione del cursore nella timeline.' }));
        const g = B.h('div', { class: 'tile-grid' });
        Object.entries(TEXT_STYLES).forEach(([k, [l, s]]) => { if (s.font) B.loadFont(s.font, '400;700;800'); g.append(B.h('button', { class: 'tile wide vd-tstyle', type: 'button', onclick: () => addText(k, k === 'caption' ? 'Il tuo sottotitolo' : k === 'bold' ? 'WOW' : l) }, B.h('span', { style: { fontFamily: '"' + (s.font || 'Bricolage Grotesque') + '"', color: s.gold ? '#e3a94a' : s.color, background: s.bg || 'transparent', padding: '2px 8px', borderRadius: '6px', fontSize: '18px', fontWeight: s.weight || 800, fontStyle: s.italic ? 'italic' : 'normal', textShadow: s.glow ? '0 0 12px ' + s.glow : s.stroke ? '0 0 2px #000, 0 0 2px #000' : 'none' }, text: l }))); });
        dBody.append(g);
      }
      function pAudio() {
        const box = B.h('div', { class: 'ai-box' });
        const mood = B.h('select', { class: 'select sm', id: 'vdMood' }, Object.entries(B.music.MOODS).filter(([k]) => k !== 'none').map(([k, m]) => B.h('option', { value: k }, m.label)));
        const len = B.h('input', { class: 'input sm', type: 'number', id: 'vdMusicLen', min: 5, max: 300, value: Math.round(Math.max(15, duration())), 'aria-label': 'Durata in secondi' });
        const go = B.h('button', { class: 'btn gold block', type: 'button', onclick: async () => {
          go.disabled = true; go.innerHTML = '<span class="spin"></span> Compongo…';
          try { const buf = await B.music.render({ mood: mood.value, duration: +len.value || 20, seed: Math.floor(Math.random() * 999) }); const blob = B.music.toWav(buf); const m = await addMedia(new File([blob], 'Musica ' + B.music.MOODS[mood.value].label + '.wav', { type: 'audio/wav' })); if (m) { const c = addClip(m, 'mu', 0); c.fadeOut = 1.5; c.volume = 0.7; } B.toast('Colonna sonora pronta', 'ok'); }
          catch (e) { B.err(e); }
          go.disabled = false; go.innerHTML = ''; go.append(B.h('span', { 'data-i': 'Music' }), 'Componi musica'); B.hydrateIcons(go);
        } }, B.h('span', { 'data-i': 'Music' }), 'Componi musica');
        box.append(B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': 'Music' }), 'Musica AI originale'), B.h('p', { class: 'mini-note', text: 'Thorion compone una traccia senza diritti, sintetizzata nel tuo browser: libera da copyright.' }), B.h('div', { class: 'grid2' }, mood, len), go);
        dBody.append(box);
        const dz = B.h('div', { class: 'dropzone' }, B.h('span', { 'data-i': 'Upload' }), B.h('b', { text: 'Importa audio' }), B.h('small', { text: 'MP3, WAV, M4A, OGG' }));
        dz.addEventListener('click', async () => { for (const f of await B.pickFiles('audio/*', true)) { const m = await addMedia(f); if (m) addClip(m, 'a1'); } });
        dBody.append(dz);
      }
      function pFx() {
        dBody.append(B.h('p', { class: 'mini-note', text: 'Seleziona una clip video o foto e scegli un filtro.' }));
        const g = B.h('div', { class: 'tile-grid' });
        Object.entries(FILTERS).forEach(([k, [l, f]]) => g.append(B.h('button', { class: 'tile wide', type: 'button', style: { background: 'linear-gradient(135deg,#3b2314,#e3a94a 60%,#fffaf1)', filter: f || 'none' }, onclick: () => { const c = selClip(); if (!c || c.type === 'text' || c.type === 'audio') return B.toast('Seleziona una clip video o foto'); c.filter = k; snap(); draw(); paintInsp(); } }, B.h('span', { class: 'tile-lbl', text: l }))));
        dBody.append(g);
      }
      function pTrans() {
        dBody.append(B.h('p', { class: 'mini-note', text: 'Seleziona la seconda di due clip consecutive sulla stessa traccia e scegli la transizione.' }));
        const g = B.h('div', { class: 'tile-grid' });
        Object.entries(TRANS).forEach(([k, l]) => g.append(B.h('button', { class: 'tile wide', type: 'button', onclick: () => { const c = selClip(); if (!c || c.type === 'text' || c.type === 'audio') return B.toast('Seleziona una clip video o foto'); c.trans = k; snap(); renderTL(); draw(); paintInsp(); } }, B.h('span', { 'data-i': k === 'iris' ? 'Eye' : k === 'blink' ? 'EyeOff' : k === 'slide' ? 'ArrowRight' : k === 'zoom' ? 'ZoomIn' : k === 'wipe' ? 'Columns' : k === 'spin' ? 'RotateCw' : 'Blend', 'data-size': 22 }), B.h('span', { class: 'tile-lbl', text: l }))));
        dBody.append(g);
        dBody.append(B.h('button', { class: 'btn block sm', type: 'button', onclick: () => { const vs = P.clips.filter((c) => c.track === 'v1').sort((a, b) => a.start - b.start); const opts = ['iris', 'fade', 'zoom', 'blink', 'slide']; vs.forEach((c, i) => { if (i) c.trans = opts[i % opts.length]; }); snap(); renderTL(); draw(); B.toast('Transizioni applicate a tutte le clip', 'ok'); } }, B.h('span', { 'data-i': 'Sparkles' }), 'Applica a tutte le clip'));
      }
      function pAI() {
        const card = (ic, title, text, label, fn, extra) => { const b = B.h('button', { class: 'btn gold sm block', type: 'button' }, B.h('span', { 'data-i': 'Sparkles' }), label); b.addEventListener('click', async () => { b.disabled = true; const o = b.innerHTML; b.innerHTML = '<span class="spin"></span> Lavoro…'; try { await fn(); } catch (e) { B.err(e); } b.disabled = false; b.innerHTML = o; }); dBody.append(B.h('div', { class: 'ai-box' }, B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': ic }), title), B.h('p', { class: 'mini-note', text }), extra || null, b)); };
        card('Scissors', 'Taglia i silenzi', 'Analizza l’audio della clip selezionata e rimuove pause e silenzi, compattando il montaggio.', 'Taglia i silenzi', autoCut);
        const script = B.h('textarea', { class: 'textarea', id: 'vdScript', rows: 4, placeholder: 'Incolla qui il testo parlato o lo script: Thorion lo divide in sottotitoli sincronizzati sulla durata del video.' });
        card('Captions', 'Sottotitoli da script', 'Crea sottotitoli animati, parola per parola, in stile social.', 'Crea sottotitoli', () => captions(script.value), script);
        const idea = B.h('input', { class: 'input sm', id: 'vdIdea', placeholder: 'Tema del video, es. “3 consigli per un caffè perfetto”' });
        card('Feather', 'Script con AI', 'Thorion scrive lo script parlato (hook, contenuto, call to action) adatto alla durata del video.', 'Scrivi lo script', async () => { if (!idea.value.trim()) throw Object.assign(new Error(''), { userMessage: 'Scrivi il tema del video' }); const t = await B.ai.text('Scrivi lo script parlato per un video verticale di ' + Math.round(Math.max(15, duration())) + ' secondi su: "' + idea.value + '". Frasi brevi e incisive, inizia con un hook forte, chiudi con una call to action. Solo il testo da dire, senza titoli o indicazioni di regia.', { system: false, tier: 'default' }); script.value = t.trim(); }, idea);
        card('Film', 'Video da testo', 'Apri Video AI per generare scene, testi e musica da un’idea; poi torna qui per rifinire.', 'Apri Video AI', async () => B.go('motion'));
        card('Music', 'Colonna sonora AI', 'Componi musica originale della stessa durata del video.', 'Componi', async () => { const buf = await B.music.render({ mood: 'cinematic', duration: Math.max(8, duration()), seed: 11 }); const m = await addMedia(new File([B.music.toWav(buf)], 'Musica cinematica.wav', { type: 'audio/wav' })); if (m) { const c = addClip(m, 'mu', 0); c.volume = 0.6; c.fadeOut = 1.5; } });
      }
      async function autoCut() {
        const c = selClip() || P.clips.find((x) => x.track === 'v1' && x.type === 'video');
        if (!c || (c.type !== 'video' && c.type !== 'audio')) throw Object.assign(new Error(''), { userMessage: 'Seleziona una clip video o audio con parlato' });
        const m = media.get(c.mediaId); if (!m.audio) await decodeAudio(m);
        if (!m.audio) throw Object.assign(new Error(''), { userMessage: 'Non riesco a leggere l’audio di questa clip' });
        const a = m.audio, sr = a.sampleRate, d = a.getChannelData(0), win = Math.floor(sr * 0.05);
        const t0 = c.in, t1 = c.in + c.dur * c.speed, rms = [];
        for (let s = Math.floor(t0 * sr); s < Math.floor(t1 * sr); s += win) { let acc = 0; for (let j = 0; j < win; j += 4) { const v = d[s + j] || 0; acc += v * v; } rms.push(Math.sqrt(acc / (win / 4))); }
        const sorted = rms.slice().sort((x, y) => x - y), thr = Math.max(0.008, sorted[Math.floor(sorted.length * 0.25)] * 2.2, sorted[Math.floor(sorted.length * 0.9)] * 0.12);
        const keep = []; let cur = null;
        rms.forEach((v, i) => { const t = t0 + i * 0.05; if (v > thr) { if (!cur) cur = [t, t]; cur[1] = t + 0.05; } else if (cur && t - cur[1] > 0.45) { keep.push(cur); cur = null; } });
        if (cur) keep.push(cur);
        const segs = keep.map(([s, e]) => [Math.max(t0, s - 0.12), Math.min(t1, e + 0.15)]).filter(([s, e]) => e - s > 0.25);
        if (!segs.length) throw Object.assign(new Error(''), { userMessage: 'Non ho trovato parlato da tenere' });
        const removed = (t1 - t0) - segs.reduce((acc, [s, e]) => acc + e - s, 0);
        if (removed < 0.3) return B.toast('Nessun silenzio significativo da tagliare');
        const base = JSON.parse(JSON.stringify(c)); P.clips = P.clips.filter((x) => x !== c); if (c.el) c.el.pause();
        let pos = c.start; const fresh = new Set();
        segs.forEach(([s, e]) => { const n = JSON.parse(JSON.stringify(base)); n.id = B.uid('c'); n.start = pos; n.in = s; n.dur = (e - s) / c.speed; n.trans = 'none'; fresh.add(n.id); P.clips.push(n); ensureEl(n); pos += n.dur; });
        const shift = (t1 - t0) / c.speed - (pos - c.start);
        P.clips.forEach((x) => { if (!fresh.has(x.id) && x.track === c.track && x.start >= c.start + c.dur - 0.01) x.start -= shift; });
        snap(); renderTL(); draw(); B.toast('Rimossi ' + removed.toFixed(1) + ' s di silenzio in ' + (segs.length - 1) + ' tagli', 'ok');
      }
      async function captions(text) {
        text = (text || '').trim(); if (!text) throw Object.assign(new Error(''), { userMessage: 'Incolla prima lo script' });
        await B.loadFont('Figtree', '400;700;800');
        const words = text.replace(/\s+/g, ' ').split(' ');
        const chunks = []; let cur = [];
        words.forEach((w) => { cur.push(w); if (cur.length >= 5 || /[.!?;:]$/.test(w)) { chunks.push(cur.join(' ')); cur = []; } });
        if (cur.length) chunks.push(cur.join(' '));
        const D = P.clips.length ? duration() : Math.max(6, words.length / 2.6);
        const total = chunks.reduce((a, c) => a + c.length + 6, 0);
        P.clips = P.clips.filter((c) => !(c.track === 'tx' && c.caption));
        let t = 0;
        chunks.forEach((ch) => { const dur = D * (ch.length + 6) / total; const c = addText('tiktok', ch); c.start = t; c.dur = dur; c.caption = true; c.animIn = 'wordPop'; c.animOut = 'none'; t += dur; });
        snap(); renderTL(); draw(); B.toast(chunks.length + ' sottotitoli creati', 'ok');
      }

      /* ---------- export ---------- */
      async function mixAudio(D) {
        const sr = 44100; const ctx = new OfflineAudioContext(2, Math.ceil(sr * D), sr); let any = false;
        for (const c of P.clips) {
          const m = media.get(c.mediaId); if (!m || (m.kind !== 'audio' && m.kind !== 'video')) continue;
          const tr = trackOf(c); if (tr && tr.muted) continue;
          if (!m.audio) await decodeAudio(m); if (!m.audio) continue;
          const src = ctx.createBufferSource(); src.buffer = m.audio; src.playbackRate.value = c.speed || 1;
          const g = ctx.createGain(); const v = c.volume ?? 1;
          g.gain.setValueAtTime(c.fadeIn ? 0 : v, c.start); if (c.fadeIn) g.gain.linearRampToValueAtTime(v, c.start + c.fadeIn);
          if (c.fadeOut) { g.gain.setValueAtTime(v, Math.max(c.start, c.start + c.dur - c.fadeOut)); g.gain.linearRampToValueAtTime(0, c.start + c.dur); }
          src.connect(g); g.connect(ctx.destination); src.start(c.start, c.in || 0, c.dur * (c.speed || 1)); any = true;
        }
        return any ? await ctx.startRendering() : null;
      }
      function seekEl(e, t) { return new Promise((res) => { if (Math.abs(e.currentTime - t) < 0.01 && e.readyState >= 2) return res(); const done = () => { e.removeEventListener('seeked', done); res(); }; e.addEventListener('seeked', done); e.currentTime = t; setTimeout(done, 1200); }); }
      async function exportVideo() {
        if (!P.clips.length) return B.toast('La timeline è vuota: importa prima dei media');
        if (st.playing) togglePlay(false);
        const D = duration(), dlg = B.exportDialog('Esporto ' + P.w + '×' + P.h);
        try {
          await Promise.all(P.clips.filter((c) => c.text).map((c) => B.loadFont(c.text.font, '400;700;800')));
          const audio = await mixAudio(D);
          P.clips.forEach((c) => c.el && (c.el.muted = true, c.el.pause()));
          const res = await B.exportVideo({ w: P.w, h: P.h, fps: P.fps, duration: D, audio, signal: dlg.signal, onProgress: dlg.progress, draw: async (ctx, t, exact) => {
            if (exact) { for (const c of P.clips) if (c.el && t >= c.start && t < c.start + c.dur) await seekEl(c.el, c.in + (t - c.start) * c.speed); }
            else { st.t = t; syncMedia(true); P.clips.forEach((c) => c.el && (c.el.muted = true)); }
            renderFrame(ctx, t);
          } });
          dlg.close(); syncMedia(false);
          await B.save(res.blob, B.slug(P.name) + '.' + res.ext);
        } catch (e) { dlg.close(); if (e.code !== 'cancelled') B.err(e, 'Esportazione non riuscita'); }
      }
      async function saveProject() {
        P.id = P.id || B.uid('p');
        const th = document.createElement('canvas'); th.width = 320; th.height = Math.round(320 * P.h / P.w); renderFrame(th.getContext('2d'), Math.min(1, duration() / 3));
        await B.projects.save({ id: P.id, type: 'video', name: P.name, thumb: th.toDataURL('image/jpeg', 0.7), data: { P: JSON.parse(JSON.stringify(P)), media: Array.from(media.values()).map((m) => ({ id: m.id, name: m.name, kind: m.kind, duration: m.duration, w: m.w, h: m.h })) } });
        B.toast('Progetto video salvato', 'ok');
      }
      async function loadProject(id) {
        const p = await B.projects.get(id); if (!p) return;
        for (const mm of p.data.media) { const b = await B.db.get('blobs', mm.id); if (!b) continue; const file = new File([b.blob], mm.name, { type: b.blob.type }); const m = await addMedia(file, mm.name); if (m) { media.delete(m.id); m.id = mm.id; media.set(mm.id, m); } }
        Object.assign(P, p.data.P); P.id = p.id; nameIn.value = P.name; setRatio(P.ratio); P.clips.forEach(ensureEl); st.hist = [JSON.stringify(P)]; renderTL(); paintInsp(); draw(); openPanel('media');
      }

      /* ---------- keys ---------- */
      B.key(' ', () => { togglePlay(); }, 'video');
      B.key('s', () => { split(); }, 'video');
      B.key('delete', () => { del(); }, 'video'); B.key('backspace', () => { del(); }, 'video');
      B.key('mod+d', () => { dup(); }, 'video'); B.key('mod+z', () => { undo(); }, 'video'); B.key('mod+y', () => { redo(); }, 'video'); B.key('mod+shift+z', () => { redo(); }, 'video');
      B.key('arrowleft', () => { seek(st.t - 1 / P.fps); }, 'video'); B.key('arrowright', () => { seek(st.t + 1 / P.fps); }, 'video');
      B.key('shift+arrowleft', () => { seek(st.t - 1); }, 'video'); B.key('shift+arrowright', () => { seek(st.t + 1); }, 'video');
      B.key('mod+s', () => { saveProject(); }, 'video');
      B.dropzone(el, async (fs) => { for (const f of fs) { const m = await addMedia(f); if (m) addClip(m); } }, 'video/*,image/*,audio/*');

      this.load = async (p) => {
        if (p.project) return loadProject(p.project);
        if (p.ratio) { const [w, h] = p.ratio.split('x').map(Number); const k = Object.keys(RATIOS).find((r) => RATIOS[r][0] === w && RATIOS[r][1] === h); if (k) setRatio(k); }
        if (p.importBlob) { const m = await addMedia(new File([p.importBlob], p.name || 'Video AI.mp4', { type: p.importBlob.type || 'video/mp4' })); if (m) addClip(m, 'v1'); }
        draw();
      };
      snap(); openPanel('media'); renderTL(); paintInsp(); draw();
      this.onHideFn = () => { if (st.playing) togglePlay(false); };
    },
    onShow(p) { if (p && Object.keys(p).length) this.load(p); },
    onHide() { this.onHideFn && this.onHideFn(); }
  });
})();
