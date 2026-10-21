/* Thorion Forge — the strong model's workshop. Charts, music composed by a real AI model (MusicGen),
   natural voices, and real 3D models (GLB/STL/OBJ) from a photo, an attachment, a sentence or code.
   Everything is free and unlimited: the models are downloaded once and run on this device. */
(function () {
  'use strict';
  const B = window.B;
  const TJS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
  const THREE_V = '0.160.0';
  const T3 = 'https://cdn.jsdelivr.net/npm/three@' + THREE_V + '/+esm';
  const ADD = (p) => 'https://cdn.jsdelivr.net/npm/three@' + THREE_V + '/examples/jsm/' + p + '/+esm';
  const MV = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
  const CHART = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  async function toCanvas(src) {
    if (src instanceof HTMLCanvasElement) return src;
    const im = await B.loadImage(src); const c = mk(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); return c;
  }

  /* ================= subject cut-out: ORMBG (Apache-2.0) on the device ================= */
  let segP = null;
  function loadSeg() {
    if (!segP) segP = (async () => {
      const T = await import(TJS); T.env.allowLocalModels = false;
      return { T, pipe: await T.pipeline('background-removal', 'onnx-community/ormbg-ONNX', { device: 'wasm', dtype: 'q8' }) };
    })();
    segP.catch(() => { segP = null; });
    return segP;
  }
  // returns the image with a transparent background, or null when no clear subject was found
  B.neuralCut = async function (src) {
    const c = await toCanvas(src), s = Math.min(1, 1024 / Math.max(c.width, c.height));
    const small = mk(c.width * s, c.height * s); small.getContext('2d').drawImage(c, 0, 0, small.width, small.height);
    const { T, pipe } = await loadSeg();
    const out = await pipe(T.RawImage.fromCanvas(small)); const m = (Array.isArray(out) ? out[0] : out).toCanvas();
    const d = m.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, m.width, m.height).data; let fg = 0; for (let i = 3; i < d.length; i += 4) fg += d[i] > 127;
    const f = fg / (m.width * m.height); if (f < 0.005 || f > 0.97) return null;
    const res = mk(c.width, c.height), x = res.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'destination-in'; x.imageSmoothingQuality = 'high'; x.drawImage(m, 0, 0, c.width, c.height);
    return res;
  };
  // every background removal in Thorion tries the neural cut first, then the local colour flood
  addEventListener('DOMContentLoaded', () => {
    const flood = B.removeBackground; if (!flood || flood.neural) return;
    B.removeBackground = Object.assign(async function (src, opts = {}) {
      if (opts.neural !== false) { try { const c = await B.neuralCut(src); if (c) return c; } catch (e) { console.warn('scontorno neurale non disponibile', e); } }
      return flood(src, opts);
    }, { neural: true });
  });

  /* ================= charts ================= */
  const PAL = ['#c8902e', '#3f6e8c', '#b5543c', '#5d8a4e', '#8a5fa8', '#d9b45f', '#2f8f8a', '#9a6a4a', '#c76b98', '#6b7a8f'];
  const MATH = { sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, sinh: 1, cosh: 1, tanh: 1, sqrt: 1, cbrt: 1, abs: 1, exp: 1, floor: 1, ceil: 1, round: 1, sign: 1, min: 1, max: 1, pow: 1, log: 'log10', ln: 'log', log10: 1, log2: 1, pi: 'PI', e: 'E', sen: 'sin', tg: 'tan', arcsin: 'asin', arccos: 'acos', arctan: 'atan' };
  // a tiny safe expression compiler: numbers, x, + - * / ^, parentheses and Math functions; "2x" means 2*x
  function compile(expr) {
    const src = String(expr).toLowerCase().replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=\s*/, '').replace(/π/g, 'pi').replace(/×|·/g, '*').replace(/÷|:/g, '/').replace(/−/g, '-').replace(/²/g, '^2').replace(/³/g, '^3');
    const toks = src.match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[a-z_][a-z0-9_]*|\*\*|\S/g) || [];
    let out = '', prev = '';
    for (const t of toks) {
      let k = null;
      if (/^[\d.]/.test(t)) k = 'num';
      else if (/^[a-z_]/.test(t)) k = t === 'x' ? 'x' : MATH[t] ? (/^(PI|E)$/.test(MATH[t]) ? 'const' : 'fn') : null;
      else if (t === '(') k = 'open'; else if (t === ')') k = 'close'; else if (/^(\*\*|[-+*/^,])$/.test(t)) k = 'op';
      if (!k) throw new Error('simbolo non valido nella funzione: ' + t);
      if (/^(num|x|const|close)$/.test(prev) && /^(num|x|const|fn|open)$/.test(k)) out += '*';
      out += k === 'fn' || k === 'const' ? 'Math.' + (typeof MATH[t] === 'string' ? MATH[t] : t) : t === '^' ? '**' : t;
      prev = k;
    }
    const f = new Function('x', '"use strict";return (' + out + ');');
    f(1); return f;
  }
  async function chart(spec) {
    if (!window.Chart) await B.loadScript(CHART);
    const Chart = window.Chart;
    let type = String(spec.type || 'bar').toLowerCase(); let indexAxis, fill = false, stacked = !!spec.stacked;
    if (type === 'area') { type = 'line'; fill = true; }
    if (/^(hbar|horizontal_?bar)$/.test(type)) { type = 'bar'; indexAxis = 'y'; }
    if (type === 'polar') type = 'polarArea';
    if (!['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', 'scatter', 'bubble'].includes(type)) type = 'bar';
    const round = /^(pie|doughnut|polarArea)$/.test(type);
    let labels = (spec.labels || []).map(String), datasets = (spec.datasets || []).filter((d) => d && Array.isArray(d.data));
    const fns = [].concat(spec.functions || [], spec.function || []).filter(Boolean);
    if (fns.length) {
      const [x0, x1] = Array.isArray(spec.x_range) && spec.x_range.length === 2 ? spec.x_range.map(Number) : [-10, 10];
      const n = 480; type = 'scatter';
      datasets = fns.slice(0, 6).map((ex) => {
        const f = compile(ex); const pts = [];
        for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; let y; try { y = f(x); } catch (e) { y = NaN; } pts.push({ x, y: Number.isFinite(y) ? y : null }); }
        return { label: 'y = ' + ex, data: pts, showLine: true, pointRadius: 0, borderWidth: 5, spanGaps: false };
      });
      // keep asymptotes (tan, 1/x) from flattening the useful part of the plot
      const ys = datasets.flatMap((d) => d.data.map((p) => p.y)).filter((v) => v != null).sort((a, b) => a - b);
      if (ys.length > 10) { const lo = ys[Math.floor(ys.length * 0.03)], hi = ys[Math.floor(ys.length * 0.97)], pad = (hi - lo) * 0.25 || 1; datasets.forEach((d) => d.data.forEach((p) => { if (p.y != null && (p.y < lo - pad || p.y > hi + pad)) p.y = null; })); const st = Math.pow(10, Math.floor(Math.log10((hi - lo + 2 * pad) || 1))) / 2; spec.y_min = spec.y_min ?? Math.floor((lo - pad) / st) * st; spec.y_max = spec.y_max ?? Math.ceil((hi + pad) / st) * st; }
    }
    if (!datasets.length) throw new Error('servono dati (labels + datasets) oppure una funzione');
    const colors = spec.colors && spec.colors.length ? spec.colors : PAL;
    datasets = datasets.slice(0, 10).map((d, i) => {
      const col = d.color || colors[i % colors.length];
      const base = { label: d.label || ('Serie ' + (i + 1)), data: d.data, borderColor: col, backgroundColor: col, borderWidth: 4, tension: 0.3 };
      if (round) Object.assign(base, { backgroundColor: d.data.map((_, k) => colors[k % colors.length]), borderColor: '#fffaf2', borderWidth: 6 });
      else if (type === 'line') Object.assign(base, { backgroundColor: col + (fill ? '55' : 'ff'), fill, pointRadius: 6, pointHoverRadius: 8 });
      else if (type === 'radar') Object.assign(base, { backgroundColor: col + '44', pointRadius: 5 });
      else if (type === 'bar') Object.assign(base, { borderRadius: 10, borderWidth: 0, maxBarThickness: 120 });
      return Object.assign(base, d.showLine != null ? { showLine: d.showLine, pointRadius: d.pointRadius, borderWidth: d.borderWidth, spanGaps: d.spanGaps } : {});
    });
    const W = 1600, H = round || type === 'radar' ? 1200 : 1000;
    const c = mk(W, H);
    const font = { family: 'Figtree, system-ui, sans-serif' };
    const ink = '#2b2118', grid = 'rgba(80,60,40,.14)';
    const axis = (title, min, max, cat) => ({ title: { display: !!title, text: title || '', color: ink, font: Object.assign({ size: 28, weight: '600' }, font) }, min, max, stacked: cat ? stacked : stacked || undefined, grid: { color: grid }, border: { color: grid }, ticks: { color: '#5a4a3a', font: Object.assign({ size: 27 }, font), maxTicksLimit: 12 } });
    const cfg = {
      type, data: { labels: fns.length ? undefined : labels, datasets },
      options: {
        responsive: false, animation: false, devicePixelRatio: 1, indexAxis,
        layout: { padding: { left: 36, right: 48, top: 28, bottom: 28 } },
        plugins: {
          title: { display: !!spec.title, text: spec.title || '', color: ink, font: Object.assign({ size: 52, weight: '700' }, font), padding: { bottom: spec.subtitle ? 8 : 28 } },
          subtitle: { display: !!spec.subtitle, text: spec.subtitle || '', color: '#7a6450', font: Object.assign({ size: 30 }, font), padding: { bottom: 28 } },
          legend: { display: datasets.length > 1 || round, position: round ? 'right' : 'top', labels: { color: ink, font: Object.assign({ size: round ? 36 : 28 }, font), boxWidth: round ? 40 : 30, padding: round ? 30 : 22 } },
          tooltip: { enabled: false }
        },
        scales: round ? undefined : type === 'radar' ? { r: { grid: { color: grid }, angleLines: { color: grid }, pointLabels: { color: ink, font: Object.assign({ size: 24 }, font) }, ticks: { backdropColor: 'transparent', color: '#7a6450', font: Object.assign({ size: 18 }, font) } } }
          : { x: Object.assign(axis(spec.x_label, fns.length ? undefined : undefined, undefined, true), fns.length ? { type: 'linear' } : {}), y: axis(spec.y_label, spec.y_min, spec.y_max) }
      },
      plugins: [{ id: 'paper', beforeDraw: (ch) => { const x = ch.ctx; x.save(); x.fillStyle = '#fffaf2'; x.fillRect(0, 0, ch.width, ch.height); x.restore(); } },
        // percentages written on the slices of round charts
        { id: 'slices', afterDatasetsDraw: (ch) => { if (!/^(pie|doughnut)$/.test(type)) return; const x = ch.ctx; x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 36px Figtree, system-ui, sans-serif'; x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 6;
          ch.data.datasets.forEach((d, i) => { const vals = d.data.map(Number), tot = vals.reduce((a, b) => a + (b > 0 ? b : 0), 0) || 1; ch.getDatasetMeta(i).data.forEach((arc, k) => { const f = vals[k] / tot; if (f < 0.04) return; const pt = arc.tooltipPosition(); x.fillText((f * 100).toFixed(f < 0.1 ? 1 : 0).replace('.', ',') + '%', pt.x, pt.y); }); }); x.restore(); } }]
    };
    const ch = new Chart(c, cfg); ch.update('none');
    await new Promise((r) => requestAnimationFrame(() => r()));
    const out = mk(W, H); out.getContext('2d').drawImage(c, 0, 0); ch.destroy();
    if (spec.source) { const x = out.getContext('2d'); x.font = '22px Figtree, system-ui, sans-serif'; x.fillStyle = '#8a7660'; x.textAlign = 'right'; x.fillText('Fonte: ' + String(spec.source).slice(0, 110), W - 40, H - 18); }
    return out;
  }

  /* ================= music: MusicGen on the device ================= */
  let mg = null;
  function loadMusicGen(onLoad) {
    if (!mg) mg = (async () => {
      const T = await import(TJS); T.env.allowLocalModels = false;
      const tok = await T.AutoTokenizer.from_pretrained('Xenova/musicgen-small');
      let last = 0; const files = {};
      const progress_callback = (x) => { if (x.status !== 'progress' || !onLoad) return; files[x.file] = x.progress || 0; if (performance.now() - last < 700) return; last = performance.now(); const v = Object.values(files); onLoad(Math.round(v.reduce((a, b) => a + b, 0) / Math.max(3, v.length))); };
      const gpu = !!(navigator.gpu && await navigator.gpu.requestAdapter().catch(() => null));
      let model = null, device = 'wasm';
      if (gpu) { try { model = await T.MusicgenForConditionalGeneration.from_pretrained('Xenova/musicgen-small', { device: 'webgpu', dtype: { text_encoder: 'q4', decoder_model_merged: 'q4', encodec_decode: 'fp32' }, progress_callback }); device = 'webgpu'; } catch (e) { console.warn('MusicGen WebGPU non disponibile, uso WASM', e); } }
      if (!model) model = await T.MusicgenForConditionalGeneration.from_pretrained('Xenova/musicgen-small', { device: 'wasm', dtype: { text_encoder: 'q8', decoder_model_merged: 'q8', encodec_decode: 'fp32' }, progress_callback });
      return { T, tok, model, device, sr: model.config.audio_encoder.sampling_rate || 32000 };
    })();
    mg.catch(() => { mg = null; });
    return mg;
  }
  // stretch an AI loop to any length with equal-power crossfades, then fade out
  function extend(src, sr, seconds) {
    const n = Math.round(seconds * sr); if (src.length >= n) return fadeOut(src.slice(0, n), sr);
    const xf = Math.min(Math.round(sr * 1.5), Math.floor(src.length / 3)), hop = src.length - xf, out = new Float32Array(n);
    for (let at = 0; at < n; at += hop) {
      for (let i = 0; i < src.length && at + i < n; i++) {
        let g = 1;
        if (at > 0 && i < xf) g = Math.sin(i / xf * Math.PI / 2);
        if (i >= hop && at + hop < n) g *= Math.cos((i - hop) / xf * Math.PI / 2);
        out[at + i] += src[i] * g;
      }
    }
    return fadeOut(out, sr);
  }
  function fadeOut(a, sr, s = 2.5) { const f = Math.min(a.length, Math.round(sr * s)); for (let i = 0; i < f; i++) a[a.length - 1 - i] *= i / f; const fi = Math.min(a.length, Math.round(sr * 0.04)); for (let i = 0; i < fi; i++) a[i] *= i / fi; return a; }
  function normalize(a, peak = 0.89) { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i])); if (m > 1e-4) { const g = peak / m; for (let i = 0; i < a.length; i++) a[i] *= g; } return a; }
  function wavOf(chans, sr) { return B.music.toWav({ numberOfChannels: chans.length, length: chans[0].length, sampleRate: sr, getChannelData: (c) => chans[c] }); }
  async function music(o, step, signal) {
    const want = B.clamp(+o.seconds || 20, 4, 180);
    try {
      step('Carico il compositore AI MusicGen (si scarica una volta, poi resta sul dispositivo)', 'run');
      const M = await loadMusicGen((p) => step('Scarico il compositore AI MusicGen (circa 650 MB, solo la prima volta) · ' + p + '%', 'run'));
      if (signal && signal.aborted) throw Object.assign(new Error('annullato'), { code: 'cancelled' });
      const aiSec = Math.min(want, M.device === 'webgpu' ? 30 : (o.fast ? 6 : 10));
      const tokens = Math.round(aiSec * 50) + 4;
      let n = 0, t0 = performance.now();
      const streamer = { put() { n++; if (n % 25 === 0) { const el = (performance.now() - t0) / 1000, eta = Math.max(1, Math.round(el / n * (tokens - n))); step('Compongo con MusicGen · ' + Math.min(99, Math.round(n / tokens * 100)) + '% (circa ' + eta + ' s)', 'run'); } if (signal && signal.aborted) throw Object.assign(new Error('annullato'), { code: 'cancelled' }); }, end() {} };
      const inputs = M.tok(String(o.prompt || 'cinematic orchestral music').slice(0, 400));
      const audio = await M.model.generate(Object.assign({}, inputs, { max_new_tokens: tokens, do_sample: true, guidance_scale: 3, temperature: 1, streamer }));
      let pcm = new Float32Array(audio.data);
      pcm = normalize(want > aiSec + 0.5 ? extend(pcm, M.sr, want) : fadeOut(pcm, M.sr, Math.min(2.5, want / 4)));
      step(want > aiSec + 0.5 ? 'Brano AI di ' + Math.round(aiSec) + ' s esteso a ' + Math.round(want) + ' s' : 'Brano pronto', 'done');
      return { blob: wavOf([pcm, pcm], M.sr), seconds: pcm.length / M.sr, engine: 'MusicGen (Meta) · ' + M.device, pcm, sr: M.sr };
    } catch (e) {
      if (e.code === 'cancelled' || (signal && signal.aborted)) throw e;
      console.warn('MusicGen non disponibile, uso il compositore procedurale', e);
      const mood = B.music.MOODS[o.mood] && o.mood !== 'none' ? o.mood : pickMood(o.prompt);
      step('Compongo con il sintetizzatore di Thorion (' + B.music.MOODS[mood].label + ')', 'run');
      const buf = await B.music.render({ mood, duration: want, seed: Math.floor(Math.random() * 9999) });
      step('Brano pronto', 'done');
      const L = buf.getChannelData(0);
      return { blob: B.music.toWav(buf), seconds: buf.duration, engine: 'sintetizzatore Thorion', pcm: L, sr: buf.sampleRate };
    }
  }
  const pickMood = (p) => { p = String(p || ''); return /lo-?fi|chill|study|relax/i.test(p) ? 'lofi' : /epic|trailer|battle|epica/i.test(p) ? 'epic' : /ambient|calm|meditat|sleep/i.test(p) ? 'ambient' : /pop|dance|upbeat|energ|happy|edm|rock/i.test(p) ? 'upbeat' : /corporate|business|presentation/i.test(p) ? 'corporate' : 'cinematic'; };

  /* ================= voice ================= */
  function resample(a, from, to) { if (from === to) return a; const n = Math.round(a.length * to / from), o = new Float32Array(n), r = from / to; for (let i = 0; i < n; i++) { const x = i * r, k = Math.floor(x), f = x - k; o[i] = (a[k] || 0) * (1 - f) + (a[k + 1] || 0) * f; } return o; }
  async function voice(o, step, bed) {
    if (!B.voice || !B.voice.synthesize) throw new Error('voce neurale non disponibile');
    const vv = B.voice.list.find((v) => v.id === o.voice) || B.voice.current(o.lang || 'it');
    step('Sintetizzo la voce di ' + vv.name + ' (Piper, sul tuo dispositivo)', 'run');
    const r = await B.voice.synthesize(o.text, { voice: o.voice, lang: o.lang });
    let sr = r.sampleRate, v = r.samples;
    if (bed && bed.pcm) {
      // voice over a music bed: the bed ducks under the words, starts a little before and rings out after
      const pre = Math.round(sr * 1.2), post = Math.round(sr * 2.5), n = pre + v.length + post;
      const m = resample(bed.pcm, bed.sr, sr), out = new Float32Array(n);
      const env = new Float32Array(n); for (let i = 0; i < v.length; i++) env[pre + i] = Math.abs(v[i]);
      let g = 0; const att = 1 - Math.exp(-1 / (sr * 0.02)), rel = 1 - Math.exp(-1 / (sr * 0.4));
      for (let i = 0; i < n; i++) { const lv = env[i] > 0.02 ? 1 : 0; g += (lv - g) * (lv > g ? att : rel); const duck = 0.42 - 0.27 * g; out[i] = (m[i % m.length] || 0) * duck * (o.bed_volume != null ? B.clamp(+o.bed_volume, 0, 1) / 0.5 : 1) + (i >= pre && i < pre + v.length ? v[i - pre] : 0); }
      v = normalize(fadeOut(out, sr, 2));
    }
    step('Voce pronta', 'done');
    return { blob: wavOf([v], sr), seconds: v.length / sr, voice: r.voice, pcm: v, sr };
  }

  /* ================= 3D: three.js on demand ================= */
  let three = null;
  B.three = function () {
    if (!three) three = Promise.all([import(T3), import(ADD('exporters/GLTFExporter.js')), import(ADD('exporters/STLExporter.js')), import(ADD('exporters/OBJExporter.js')), import(ADD('loaders/GLTFLoader.js')), import(ADD('loaders/STLLoader.js')), import(ADD('loaders/OBJLoader.js')), import(ADD('loaders/DRACOLoader.js'))])
      .then(([THREE, a, b, c, d, e, f, g]) => ({ THREE, GLTFExporter: a.GLTFExporter, STLExporter: b.STLExporter, OBJExporter: c.OBJExporter, GLTFLoader: d.GLTFLoader, STLLoader: e.STLLoader, OBJLoader: f.OBJLoader, DRACOLoader: g.DRACOLoader }));
    three.catch(() => { three = null; });
    return three;
  };
  let mvReady = null;
  B.modelViewer = () => { if (!mvReady) { mvReady = import(MV).then(() => customElements.whenDefined('model-viewer')); mvReady.catch(() => { mvReady = null; }); } return mvReady; };

  // any model the user attaches (GLB, glTF, STL, OBJ) becomes a three.js object
  async function loadObject(blob, name) {
    const X = await B.three(), THREE = X.THREE, ext = String(name || '').split('.').pop().toLowerCase();
    const buf = await blob.arrayBuffer();
    if (ext === 'stl') { const g = new X.STLLoader().parse(buf); g.computeVertexNormals(); return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xb8b2a8, roughness: 0.55, metalness: 0.05 })); }
    if (ext === 'obj') { const o = new X.OBJLoader().parse(new TextDecoder().decode(buf)); o.traverse((n) => { if (n.isMesh && (!n.material || !n.material.map)) n.material = new THREE.MeshStandardMaterial({ color: 0xb8b2a8, roughness: 0.6 }); }); return o; }
    const L = new X.GLTFLoader(); const d = new X.DRACOLoader(); d.setDecoderPath('https://cdn.jsdelivr.net/npm/three@' + THREE_V + '/examples/jsm/libs/draco/gltf/'); L.setDRACOLoader(d);
    const g = await new Promise((res, rej) => L.parse(buf, '', res, rej));
    return g.scene;
  }
  async function exportAs(obj, fmt) {
    const X = await B.three();
    if (fmt === 'stl') {
      // millimetres for slicers: the longest side becomes 100 mm
      const c = obj.clone(true); const bb = new X.THREE.Box3().setFromObject(c), s = bb.getSize(new X.THREE.Vector3()); const k = 100 / Math.max(s.x, s.y, s.z, 1e-6);
      c.scale.multiplyScalar(k); c.updateMatrixWorld(true);
      return new Blob([new X.STLExporter().parse(c, { binary: true })], { type: 'model/stl' });
    }
    if (fmt === 'obj') return new Blob([new X.OBJExporter().parse(obj)], { type: 'model/obj' });
    const ab = await new X.GLTFExporter().parseAsync(obj, { binary: true, maxTextureSize: 2048 });
    return new Blob([ab], { type: 'model/gltf-binary' });
  }
  B.convertModel = async function (blob, name, fmt) { return exportAs(await loadObject(blob, name), fmt); };

  /* photo -> solid 3D: subject mask, Poisson inflation (round cross-sections) + neural depth detail */
  function otsu(v) {
    const h = new Float64Array(256); v.forEach((x) => h[Math.min(255, Math.max(0, x | 0))]++);
    let sum = 0, tot = v.length; for (let i = 0; i < 256; i++) sum += i * h[i];
    let sB = 0, wB = 0, best = 0, th = 128;
    for (let i = 0; i < 256; i++) { wB += h[i]; if (!wB) continue; const wF = tot - wB; if (!wF) break; sB += i * h[i]; const mB = sB / wB, mF = (sum - sB) / wF, b = wB * wF * (mB - mF) ** 2; if (b > best) { best = b; th = i; } }
    return th;
  }
  function largest(mask, w, h) {
    const lab = new Int32Array(w * h), st = []; let bestId = 0, bestN = 0, id = 0;
    for (let p = 0; p < w * h; p++) {
      if (!mask[p] || lab[p]) continue; id++; let n = 0; st.push(p); lab[p] = id;
      while (st.length) { const q = st.pop(); n++; const x = q % w, y = (q / w) | 0; const nb = [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1]; for (const r of nb) if (r >= 0 && mask[r] && !lab[r]) { lab[r] = id; st.push(r); } }
      if (n > bestN) { bestN = n; bestId = id; }
    }
    const out = new Uint8Array(w * h); for (let p = 0; p < w * h; p++) out[p] = lab[p] === bestId ? 1 : 0;
    // fill holes: whatever the outside can't reach belongs to the object
    const outside = new Uint8Array(w * h); const s2 = [];
    for (let x = 0; x < w; x++) s2.push(x, (h - 1) * w + x); for (let y = 0; y < h; y++) s2.push(y * w, y * w + w - 1);
    while (s2.length) { const q = s2.pop(); if (outside[q] || out[q]) continue; outside[q] = 1; const x = q % w, y = (q / w) | 0; if (x > 0) s2.push(q - 1); if (x < w - 1) s2.push(q + 1); if (y > 0) s2.push(q - w); if (y < h - 1) s2.push(q + w); }
    for (let p = 0; p < w * h; p++) if (!outside[p]) out[p] = 1;
    return { mask: out, count: bestN };
  }
  function morph(m, w, h, grow) { const o = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = grow ? 0 : 1; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; const q = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : m[yy * w + xx]; if (grow ? q : !q) { v = grow ? 1 : 0; } } o[y * w + x] = v; } return o; }
  function blurF(a, w, h, r) {
    if (r < 1) return a; const t = new Float32Array(w * h), o = new Float32Array(w * h), k = 2 * r + 1;
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { t[y * w + x] = s / k; s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { o[y * w + x] = s / k; s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
    return o;
  }
  function inflate(mask, w, h, iters) {
    // ∇²u = -2 inside, u = 0 outside: sqrt(u) gives circular cross-sections for tubes of any width (Teddy-style)
    const u = new Float32Array(w * h);
    // warm start from a chamfer distance so SOR converges in a few hundred sweeps
    const d = new Float32Array(w * h).fill(1e9);
    for (let p = 0; p < w * h; p++) if (!mask[p]) d[p] = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = y * w + x; if (!d[p]) continue; let m = d[p]; if (x > 0) m = Math.min(m, d[p - 1] + 1); if (y > 0) m = Math.min(m, d[p - w] + 1); if (x > 0 && y > 0) m = Math.min(m, d[p - w - 1] + 1.414); if (x < w - 1 && y > 0) m = Math.min(m, d[p - w + 1] + 1.414); if (x === 0 || y === 0 || x === w - 1 || y === h - 1) m = Math.min(m, 1); d[p] = m; }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const p = y * w + x; if (!d[p]) continue; let m = d[p]; if (x < w - 1) m = Math.min(m, d[p + 1] + 1); if (y < h - 1) m = Math.min(m, d[p + w] + 1); if (x < w - 1 && y < h - 1) m = Math.min(m, d[p + w + 1] + 1.414); if (x > 0 && y < h - 1) m = Math.min(m, d[p + w - 1] + 1.414); d[p] = m; }
    let dmax = 0; for (let p = 0; p < w * h; p++) if (d[p] > dmax) dmax = d[p];
    for (let p = 0; p < w * h; p++) if (mask[p]) u[p] = d[p] * Math.max(1, 1.2 * dmax - d[p]) * 0.9;
    const om = 1.9;
    for (let it = 0; it < iters; it++) for (let par = 0; par < 2; par++) for (let y = 1; y < h - 1; y++) for (let x = 1 + ((y + par) & 1); x < w - 1; x += 2) {
      const p = y * w + x; if (!mask[p]) continue;
      const g = (u[p - 1] + u[p + 1] + u[p - w] + u[p + w] + 2) * 0.25; u[p] += om * (g - u[p]);
    }
    const hgt = new Float32Array(w * h); let hmax = 0;
    for (let p = 0; p < w * h; p++) { hgt[p] = mask[p] ? Math.sqrt(Math.max(0, u[p])) : 0; if (hgt[p] > hmax) hmax = hgt[p]; }
    return { h: hgt, hmax, dmax, d };
  }
  async function photoTo3D(src, o, step) {
    const X = await B.three(), THREE = X.THREE;
    const canvas = await toCanvas(src);
    const N = o.detail === 'high' ? 300 : o.detail === 'low' ? 160 : 240;
    const s = N / Math.max(canvas.width, canvas.height), w = Math.max(16, Math.round(canvas.width * s)), h = Math.max(16, Math.round(canvas.height * s));
    step('Separo il soggetto dallo sfondo (rete neurale ORMBG, sul tuo dispositivo)', 'run');
    let cut = null; try { cut = await B.neuralCut(canvas); } catch (e) { console.warn('scontorno neurale non disponibile', e); }
    if (!cut) cut = await B.removeBackground(canvas, { neural: false });
    const cs = mk(w, h), cx = cs.getContext('2d', { willReadFrequently: true }); cx.drawImage(cut, 0, 0, w, h);
    const ad = cx.getImageData(0, 0, w, h).data;
    let mA = new Uint8Array(w * h), fa = 0; for (let p = 0; p < w * h; p++) { mA[p] = ad[p * 4 + 3] > 127 ? 1 : 0; fa += mA[p]; } fa /= w * h;
    const dep = B.cinema && B.cinema.depthOf ? await B.cinema.depthOf(canvas, (l) => step(l, 'run')) : null;
    const dd = new Float32Array(w * h);
    if (dep) { const dc = mk(w, h), dx = dc.getContext('2d', { willReadFrequently: true }); dx.drawImage(dep.canvas, 0, 0, w, h); const px = dx.getImageData(0, 0, w, h).data; for (let p = 0; p < w * h; p++) dd[p] = px[p * 4]; }
    let mask = null, how = 'oggetto';
    if (o.mode !== 'relief') {
      if (fa > 0.03 && fa < 0.9) mask = mA;
      else if (dep) { const th = otsu(dd); const mD = new Uint8Array(w * h); let fd = 0; for (let p = 0; p < w * h; p++) { mD[p] = dd[p] > th ? 1 : 0; fd += mD[p]; } fd /= w * h; if (fd > 0.03 && fd < 0.9) mask = mD; }
    }
    if (mask) { mask = morph(morph(mask, w, h, false), w, h, true); const L = largest(mask, w, h); mask = L.count > w * h * 0.02 ? L.mask : null; }
    if (!mask) { how = 'rilievo'; mask = new Uint8Array(w * h).fill(1); for (let x = 0; x < w; x++) { mask[x] = mask[(h - 1) * w + x] = 0; } for (let y = 0; y < h; y++) { mask[y * w] = mask[y * w + w - 1] = 0; } }
    step(how === 'rilievo' ? 'Nessun soggetto isolato: creo un bassorilievo dell’immagine' : 'Gonfio la sagoma in un volume pieno e scolpisco i dettagli dalla profondità', 'run');
    await B.sleep(10);
    const thick = B.clamp(o.thickness == null ? 1 : +o.thickness, 0.15, 1.6);
    let H, hmax, D = null;
    if (how === 'rilievo') { H = new Float32Array(w * h); for (let p = 0; p < w * h; p++) H[p] = mask[p] ? 1 : 0; hmax = 1; }
    else { const I = inflate(mask, w, h, Math.min(500, Math.round(Math.max(w, h) * 1.6))); H = I.h; hmax = I.hmax || 1; D = I.d; }
    // depth detail: band-pass of the neural depth, faded at the silhouette
    const det = new Float32Array(w * h);
    if (dep) {
      const fine = blurF(dd, w, h, 1), coarse = blurF(dd, w, h, Math.max(3, Math.round(Math.max(w, h) / 14)));
      const vals = []; for (let p = 0; p < w * h; p++) if (mask[p]) vals.push(Math.abs(fine[p] - coarse[p]));
      vals.sort((a, b) => a - b); const q = vals[Math.floor(vals.length * 0.97)] || 1;
      for (let p = 0; p < w * h; p++) det[p] = mask[p] ? B.clamp((fine[p] - coarse[p]) / q, -1.4, 1.4) : 0;
    }
    const detAmt = (o.relief_detail == null ? 1 : B.clamp(+o.relief_detail, 0, 3));
    // grid -> mesh. Boundary pixels (touching the outside) are shared by front and back, so the solid is closed
    const S = Math.max(w, h); let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const bw = maxX - minX + 1, bh = maxY - minY + 1, span = Math.max(bw, bh);
    const cxm = (minX + maxX) / 2;
    const edge = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h || !mask[yy * w + xx]) return true; } return false; };
    const F = new Int32Array(w * h).fill(-1), Bk = new Int32Array(w * h).fill(-1);
    const pos = [], uv = [];
    const Hs = blurF(H, w, h, 1);
    const zf = (p) => { const hv = Hs[p] / hmax; const fade = Math.min(1, hv * 3); return (how === 'rilievo' ? 0.04 : hv * thick * 0.5 * (hmax * 2 / span)) + det[p] * detAmt * fade * (how === 'rilievo' ? 0.06 : 0.035); };
    const zb = (p) => how === 'rilievo' ? -0.02 : -(Hs[p] / hmax) * thick * 0.5 * (hmax * 2 / span) * B.clamp(o.back == null ? 0.9 : +o.back, 0.1, 1.5);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const p = y * w + x; if (!mask[p]) continue;
      const X0 = (x - cxm) / span, Y0 = (maxY - y) / span;
      // the steep sides take their colour from just inside the silhouette, so the texture never streaks
      let ox = 0, oy = 0;
      if (D && D[p] < 4.5) { const gx = (D[p + (x < w - 1 ? 1 : 0)] || 0) - (D[p - (x > 0 ? 1 : 0)] || 0), gy = (D[p + (y < h - 1 ? w : 0)] || 0) - (D[p - (y > 0 ? w : 0)] || 0), gl = Math.hypot(gx, gy) || 1, k = (4.5 - D[p]) * 0.9; ox = gx / gl * k; oy = gy / gl * k; }
      const U = (x + 0.5 + ox) / w, V = 1 - (y + 0.5 + oy) / h;
      if (how !== 'rilievo' && edge(x, y)) { F[p] = Bk[p] = pos.length / 3; pos.push(X0, Y0, 0); uv.push(U, V); }
      else { F[p] = pos.length / 3; pos.push(X0, Y0, zf(p)); uv.push(U, V); Bk[p] = pos.length / 3; pos.push(X0, Y0, zb(p)); uv.push(U, V); }
    }
    // the silhouette comes from a pixel grid: relax the outer rings in XY so the sides are smooth, not stepped
    if (D) {
      const ring = []; for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) { const p = y * w + x; if (mask[p] && D[p] < 6) ring.push(p); }
      const PX = new Float32Array(w * h), PY = new Float32Array(w * h);
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) { const p = y * w + x; if (mask[p]) { PX[p] = pos[F[p] * 3]; PY[p] = pos[F[p] * 3 + 1]; } }
      for (let it = 0; it < 8; it++) {
        const nx = new Float32Array(ring.length), ny = new Float32Array(ring.length);
        ring.forEach((p, i) => { const x = p % w, y = (p / w) | 0, edgeP = D[p] < 1.5; let sx = 0, sy = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const q = yy * w + xx; if (!mask[q] || (edgeP && D[q] >= 1.5)) continue; sx += PX[q]; sy += PY[q]; n++; } nx[i] = n ? PX[p] * 0.5 + sx / n * 0.5 : PX[p]; ny[i] = n ? PY[p] * 0.5 + sy / n * 0.5 : PY[p]; });
        ring.forEach((p, i) => { PX[p] = nx[i]; PY[p] = ny[i]; });
      }
      ring.forEach((p) => { for (const v of [F[p], Bk[p]]) { pos[v * 3] = PX[p]; pos[v * 3 + 1] = PY[p]; } });
    }
    const idx = [];
    for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
      const a = y * w + x, b = a + 1, c = a + w, d = c + 1;
      if (!(mask[a] && mask[b] && mask[c] && mask[d])) continue;
      idx.push(F[a], F[c], F[b], F[b], F[c], F[d]);
      idx.push(Bk[a], Bk[b], Bk[c], Bk[b], Bk[d], Bk[c]);
    }
    if (how === 'rilievo') {
      // close the plate with side walls between the front and back rims
      const ring = (x0, y0, x1, y1) => { const a = y0 * w + x0, b = y1 * w + x1; idx.push(F[a], Bk[a], F[b], F[b], Bk[a], Bk[b]); };
      for (let x = minX; x < maxX; x++) { ring(x + 1, minY, x, minY); ring(x, maxY, x + 1, maxY); }
      for (let y = minY; y < maxY; y++) { ring(minX, y, minX, y + 1); ring(maxX, y + 1, maxX, y); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    // texture: the photo with the subject's colours bled past the silhouette, so edges never pick up the background
    step('Applico la texture fotografica', 'run');
    const T = Math.min(2048, Math.max(canvas.width, canvas.height)), ts = T / Math.max(canvas.width, canvas.height);
    const tex = mk(canvas.width * ts, canvas.height * ts), tx = tex.getContext('2d');
    if (how === 'rilievo') tx.drawImage(canvas, 0, 0, tex.width, tex.height);
    else {
      const mc = mk(w, h), mx = mc.getContext('2d'), md = mx.createImageData(w, h); for (let p = 0; p < w * h; p++) { md.data[p * 4 + 3] = mask[p] ? 255 : 0; } mx.putImageData(md, 0, 0);
      const fg = mk(tex.width, tex.height), fx = fg.getContext('2d'); fx.drawImage(canvas, 0, 0, tex.width, tex.height); fx.globalCompositeOperation = 'destination-in'; fx.imageSmoothingEnabled = true; fx.drawImage(mc, 0, 0, tex.width, tex.height);
      tx.fillStyle = avgColor(fg); tx.fillRect(0, 0, tex.width, tex.height);
      const pad = Math.max(2, Math.round(tex.width / 90));
      for (let k = pad * 4; k >= 1; k = Math.floor(k * 0.6)) { for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k], [k, k], [-k, -k], [k, -k], [-k, k]]) tx.drawImage(fg, dx, dy); }
      tx.drawImage(fg, 0, 0);
    }
    const map = new THREE.CanvasTexture(tex); map.colorSpace = THREE.SRGBColorSpace; map.flipY = true; map.userData.mimeType = 'image/jpeg';
    const mat = new THREE.MeshStandardMaterial({ map, roughness: B.clamp(o.roughness == null ? 0.72 : +o.roughness, 0, 1), metalness: B.clamp(+o.metalness || 0, 0, 1) });
    const mesh = new THREE.Mesh(geo, mat); mesh.name = String(o.name || 'Thorion model').slice(0, 60);
    const size = B.clamp(+o.size_m || 1, 0.05, 100); mesh.scale.setScalar(size);
    const root = new THREE.Group(); root.name = mesh.name; root.add(mesh);
    step('Modello pronto · ' + Math.round(idx.length / 3).toLocaleString('it-IT') + ' triangoli', 'done');
    return { object: root, tris: idx.length / 3, kind: how };
  }
  function avgColor(c) { const s = mk(16, 16), x = s.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 16, 16); const d = x.getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } n = n || 1; return 'rgb(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ')'; }

  /* code -> 3D: the strong model's three.js code runs in a sandboxed frame and comes back as a GLB */
  function buildFromCode(code, signal) {
    return new Promise((resolve, reject) => {
      const nonce = Math.random().toString(36).slice(2);
      const html = '<!doctype html><html><head><meta charset="utf-8"><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@' + THREE_V + '/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@' + THREE_V + '/examples/jsm/"}}</' + 'script></head><body><script type="module">\n'
        + 'import * as THREE from "three"; import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js"; import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js"; import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";\n'
        + 'const N=' + JSON.stringify(nonce) + '; const send=(m,t)=>parent.postMessage(Object.assign({thorion3d:N},m),"*",t);\n'
        + 'try { const build = (function(THREE, BufferGeometryUtils, RoundedBoxGeometry){ ' + String(code).replace(/<\/script/gi, '<\\/script') + '\n; return typeof build==="function"?build:null; })(THREE, BufferGeometryUtils, RoundedBoxGeometry);\n'
        + 'if(!build) throw new Error("il codice deve definire function build(THREE) che restituisce un oggetto 3D");\n'
        + 'let obj = await build(THREE, { BufferGeometryUtils, RoundedBoxGeometry }); if(!obj||!obj.isObject3D) throw new Error("build() deve restituire un THREE.Object3D (Mesh o Group)");\n'
        + 'let tris=0; obj.traverse(n=>{ if(n.isMesh&&n.geometry){ const g=n.geometry; tris+=(g.index?g.index.count:g.attributes.position.count)/3; } });\n'
        + 'const ab = await new GLTFExporter().parseAsync(obj,{binary:true}); send({ok:true,glb:ab,tris:Math.round(tris)},[ab]);\n'
        + '} catch(e) { send({ok:false,error:String(e&&e.message||e)}); }\n</' + 'script></body></html>';
      const fr = document.createElement('iframe'); fr.setAttribute('sandbox', 'allow-scripts'); fr.style.cssText = 'position:fixed;width:2px;height:2px;left:-9px;top:-9px;opacity:0;pointer-events:none'; fr.srcdoc = html;
      const done = (fn, v) => { removeEventListener('message', on); clearTimeout(tm); fr.remove(); fn(v); };
      const on = (e) => { const d = e.data; if (!d || d.thorion3d !== nonce || e.source !== fr.contentWindow) return; if (d.ok) done(resolve, { blob: new Blob([d.glb], { type: 'model/gltf-binary' }), tris: d.tris }); else done(reject, new Error(d.error)); };
      addEventListener('message', on);
      const tm = setTimeout(() => done(reject, new Error('il codice 3D non ha risposto entro 60 s')), 60000);
      if (signal) signal.addEventListener('abort', () => done(reject, Object.assign(new Error('annullato'), { code: 'cancelled' })), { once: true });
      document.body.append(fr);
    });
  }

  /* ================= tools for the agent ================= */
  const baseTools = B.irisTools;
  B.irisTools = function (ctx) {
    const tools = baseTools(ctx);
    const store = ctx.images || (ctx.images = new Map());
    const models = ctx.models || (ctx.models = new Map());
    const audio = ctx.audio || (ctx.audio = new Map());
    const step = (label, status) => ctx.onStep && ctx.onStep({ label, status });
    const putImage = async (blob, label, meta) => { const id = 'img' + (store.size + 1); const c = await toCanvas(blob); store.set(id, Object.assign({ blob, canvas: c, label }, meta || {})); if (ctx.onImage) await ctx.onImage(id, blob, label); return { image_id: id, width: c.width, height: c.height }; };
    const putModel = async (blob, label, meta) => { const id = 'model' + (models.size + 1); models.set(id, Object.assign({ blob, name: (label || 'modello') + '.glb', label }, meta || {})); if (ctx.onModel) await ctx.onModel(id, blob, label, meta || {}); return id; };
    const putAudio = async (r, label, kind) => { const id = 'audio' + (audio.size + 1); audio.set(id, { pcm: r.pcm, sr: r.sr, label, kind }); if (ctx.onAudio) await ctx.onAudio(id, r.blob, label, { seconds: r.seconds, kind, engine: r.engine }); return id; };
    const getImg = (id) => { const it = store.get(String(id)); if (!it) throw new Error('image_id sconosciuto: ' + id); return it; };

    tools.push({ name: 'make_chart', description: 'Crea un grafico nitido (PNG 1600 px) da dati o da funzioni matematiche: bar, hbar, line, area, pie, doughnut, radar, polarArea, scatter, bubble. Per i grafici di funzioni passa "functions" (es. ["x^2-3x+2","sin(x)"]) e x_range. Restituisce image_id.', schema: { type: 'object', properties: {
      type: { type: 'string', enum: ['bar', 'hbar', 'line', 'area', 'pie', 'doughnut', 'radar', 'polarArea', 'scatter', 'bubble'] },
      title: { type: 'string' }, subtitle: { type: 'string' },
      labels: { type: 'array', items: { type: 'string' }, description: 'etichette dell’asse X o delle fette' },
      datasets: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, data: { type: 'array', items: {} }, color: { type: 'string' } } }, description: 'serie di valori, una per colonna/linea (per scatter: [{x,y}])' },
      functions: { type: 'array', items: { type: 'string' }, description: 'funzioni di x da disegnare' },
      x_range: { type: 'array', items: { type: 'number' } }, x_label: { type: 'string' }, y_label: { type: 'string' }, y_min: { type: 'number' }, y_max: { type: 'number' },
      stacked: { type: 'boolean' }, source: { type: 'string', description: 'fonte dei dati (facoltativa)' }
    } },
      execute: async (a) => { step('Disegno il grafico', 'run'); const c = await chart(a); step('Grafico pronto', 'done'); return putImage(await B.canvasToBlob(c, 'image/png'), a.title || 'Grafico', { prompt: a.title }); } });

    tools.push({ name: 'make_music', description: 'Compone musica originale con un vero modello AI musicale (MusicGen di Meta, sul dispositivo, gratis e illimitato): strumentale di qualsiasi genere, colonne sonore, jingle, beat, loop. Restituisce audio_id (WAV stereo).', schema: { type: 'object', properties: {
      prompt: { type: 'string', description: 'In inglese: genere, strumenti, tempo/BPM, atmosfera, es. "uplifting cinematic orchestral, strings and piano, 90 bpm, hopeful"' },
      seconds: { type: 'number', description: 'durata in secondi (4-180, default 20)' },
      mood: { type: 'string', enum: Object.keys(B.music.MOODS).filter((k) => k !== 'none'), description: 'solo per il sintetizzatore di riserva' },
      title: { type: 'string' }
    }, required: ['prompt'] },
      execute: async (a, c) => { const r = await music(a, step, c && c.signal); const id = await putAudio(r, a.title || 'Musica', 'music'); return { audio_id: id, seconds: Math.round(r.seconds), engine: r.engine }; } });

    tools.push({ name: 'make_voice', description: 'Legge un testo con una voce neurale naturale (Piper, sul dispositivo): voiceover, podcast, audiolibri, annunci, messaggi. Può mettere sotto la voce una musica creata con make_music (bed_audio_id). Restituisce audio_id (WAV).', schema: { type: 'object', properties: {
      text: { type: 'string', description: 'testo da leggere (max ~3000 caratteri)' },
      voice: { type: 'string', enum: B.voice ? B.voice.list.map((v) => v.id) : [], description: B.voice ? B.voice.list.map((v) => v.id + ' = ' + v.name + ' (' + v.desc + ')').join('; ') : '' },
      lang: { type: 'string', enum: ['it', 'en', 'es', 'fr', 'de'] },
      bed_audio_id: { type: 'string', description: 'audio_id di una musica da mettere sotto la voce (facoltativo)' },
      bed_volume: { type: 'number', description: '0-1, default 0.5' },
      title: { type: 'string' }
    }, required: ['text'] },
      execute: async (a) => { const bed = a.bed_audio_id ? audio.get(String(a.bed_audio_id)) : null; const r = await voice({ text: String(a.text || '').slice(0, 6000), voice: a.voice, lang: a.lang, bed_volume: a.bed_volume }, step, bed); const id = await putAudio(r, a.title || 'Voce', 'voice'); return { audio_id: id, seconds: Math.round(r.seconds), voice: r.voice, with_music: !!bed }; } });

    tools.push({ name: 'make_3d_model', description: 'Crea un vero modello 3D solido e texturizzato (GLB, scaricabile anche in STL per la stampa 3D e OBJ) da una foto: allegato, foto creata, oppure da un testo (genera prima la foto del soggetto). Separa il soggetto, ne ricostruisce il volume a 360° e scolpisce i dettagli con la profondità neurale. Ideale per oggetti, personaggi, giocattoli, statue, prodotti, animali. Restituisce model_id.', schema: { type: 'object', properties: {
      image_id: { type: 'string', description: 'foto di partenza (allegata o creata)' },
      prompt: { type: 'string', description: 'se non c’è image_id: il soggetto in inglese, es. "a vintage brass robot toy"' },
      mode: { type: 'string', enum: ['object', 'relief'], description: 'object = volume pieno (default); relief = bassorilievo/targa dell’intera immagine' },
      thickness: { type: 'number', description: '0.2 piatto – 1.6 molto tondo, default 1' },
      relief_detail: { type: 'number', description: '0-3 quanto scolpire i dettagli, default 1' },
      detail: { type: 'string', enum: ['low', 'medium', 'high'] },
      metalness: { type: 'number' }, roughness: { type: 'number' },
      size_m: { type: 'number', description: 'altezza/lato maggiore in metri (default 1)' },
      name: { type: 'string' }
    } },
      execute: async (a, c) => {
        let id = a.image_id && store.has(String(a.image_id)) ? String(a.image_id) : null;
        if (!id) {
          if (!a.prompt) throw new Error('serve image_id oppure prompt');
          const gp = tools.find((t) => t.name === 'generate_photo');
          const p = String(a.prompt) + ', single object, centered, whole subject fully visible with margin, front view, isolated on a plain light grey seamless studio background, soft even diffuse lighting, no shadows on the background, sharp focus, product photography';
          if (gp) { const r = await gp.execute({ prompt: p, aspect: '1:1', quality: 'high', kind: 'photo' }, c); id = r.image_id; }
          else { step('Creo la foto del soggetto', 'run'); const b = await B.quickPreview(p, 1024, 1024, c && c.signal); if (!b) throw new Error('non riesco a creare la foto del soggetto'); id = (await putImage(b, a.prompt, { prompt: a.prompt })).image_id; }
        }
        step('Costruisco il modello 3D', 'run');
        const r = await photoTo3D(getImg(id).canvas, a, step);
        const blob = await exportAs(r.object, 'glb');
        const mid = await putModel(blob, a.name || getImg(id).label || 'Modello 3D', { tris: Math.round(r.tris), kind: r.kind });
        return { model_id: mid, triangles: Math.round(r.tris), type: r.kind === 'rilievo' ? 'relief' : 'solid', from_image: id };
      } });

    tools.push({ name: 'build_3d_model', description: 'Costruisce un modello 3D preciso scrivendo codice three.js (oggetti geometrici, architettura, mobili, veicoli, armi giocattolo, asset low-poly per giochi). Il codice gira isolato e diventa un GLB scaricabile. Restituisce model_id.', schema: { type: 'object', properties: {
      code: { type: 'string', description: 'JavaScript che definisce function build(THREE, X){ … return group; } (X.BufferGeometryUtils, X.RoundedBoxGeometry disponibili). Usa MeshStandardMaterial con color/metalness/roughness realistici, unità in metri, base a y=0. Niente texture esterne.' },
      name: { type: 'string' }
    }, required: ['code'] },
      execute: async (a, c) => { step('Costruisco il modello con il codice 3D', 'run'); const r = await buildFromCode(a.code, c && c.signal); const mid = await putModel(r.blob, a.name || 'Modello 3D', { tris: r.tris, kind: 'code' }); step('Modello pronto · ' + r.tris.toLocaleString('it-IT') + ' triangoli', 'done'); return { model_id: mid, triangles: r.tris }; } });

    tools.push({ name: 'stage_3d_model', description: 'Mette un modello 3D (creato o allegato) dentro un mondo Thorion Engine giocabile: vetrina con luce da studio e piattaforma girevole, natura o città. Restituisce scene_id.', schema: { type: 'object', properties: {
      model_id: { type: 'string' }, preset: { type: 'string', enum: ['studio', 'nature', 'open_world_city'] },
      size_m: { type: 'number', description: 'dimensione maggiore nella scena in metri (default 2)' }, spin: { type: 'boolean', description: 'piattaforma girevole (default true in studio)' },
      time_of_day: { type: 'string' }, weather: { type: 'string', enum: ['clear', 'rain', 'fog', 'snow'] }, title: { type: 'string' }
    }, required: ['model_id'] },
      execute: async (a) => {
        const m = models.get(String(a.model_id)); if (!m) throw new Error('model_id sconosciuto: ' + a.model_id);
        step('Preparo la scena 3D', 'run');
        const glb = /\.glb$/i.test(m.name) ? m.blob : await B.convertModel(m.blob, m.name, 'glb');
        const src = await B.blobToDataURL(new Blob([glb], { type: 'model/gltf-binary' }));
        const preset = a.preset || 'studio';
        const html = B.engine.buildHTML({ preset, title: a.title || m.label || 'Modello 3D', time_of_day: a.time_of_day, weather: a.weather, player: preset === 'studio' ? 'orbit' : undefined, models: [{ src, fit: B.clamp(+a.size_m || 2, 0.1, 40), spin: a.spin != null ? !!a.spin : preset === 'studio' ? 0.35 : 0, pos: preset === 'studio' ? [0, 0.12, 0] : [3, 0, -4] }] });
        const sid = 'scene' + ((ctx.scenes = (ctx.scenes || 0) + 1));
        if (ctx.onScene) await ctx.onScene(sid, new Blob([html], { type: 'text/html' }), a.title || m.label || 'Modello 3D');
        step('Scena pronta', 'done');
        return { scene_id: sid, preset };
      } });
    return tools;
  };

  B.agentSystem += ' GRAFICI: make_chart con dati veri (cerca o usa i dati dell’utente; non inventare numeri senza dirlo) o con "functions" per i grafici di funzioni; poi commenta in breve cosa mostra. ' +
    'MUSICA: make_music con un prompt in inglese ricco (genere, strumenti, BPM, atmosfera) e seconds dal messaggio; è strumentale (il modello non canta): per una canzone con testo crea la base con make_music e la voce parlata con make_voice usando bed_audio_id. ' +
    'VOCI/PODCAST/AUDIOLIBRI: make_voice con il testo completo già scritto da te, voce adatta (Paola/Serena per l’italiano femminile, Riccardo maschile; Emma/Ryan/Alan in inglese; Davefx spagnolo, Siwis francese, Thorsten tedesco) e lang. ' +
    'MODELLI 3D: da foto o allegato make_3d_model(image_id); da testo make_3d_model(prompt) per soggetti organici/realistici (personaggi, animali, statue, cibo, giocattoli) oppure build_3d_model con codice three.js per oggetti geometrici precisi (mobili, edifici, veicoli, utensili, asset di gioco); per mostrarlo in un mondo usa stage_3d_model. I modelli si scaricano in GLB, STL (stampa 3D) e OBJ. ' +
    'Modelli 3D allegati dall’utente hanno un model_id: puoi metterli in scena (stage_3d_model).';
})();
