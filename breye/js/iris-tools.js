/* Thorion tools — unlimited photoreal generation on the AI Horde community GPU network (free, no account),
   local realism finishing, tiled detail refinement and a tool-using agent.
   Low GPU by design: the network renders small images (≤ 576×576, the free tier's cheapest size) and the
   browser does the rest — upscaling, film finishing and blending the detail tiles. */
(function () {
  'use strict';
  const B = window.B;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const toCanvas = async (src) => { if (src instanceof HTMLCanvasElement) return src; const im = await B.loadImage(src); const c = mk(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); return c; };
  const b64 = (c, q = 0.94) => c.toDataURL('image/webp', q).split(',')[1];
  const userErr = (msg, code) => Object.assign(new Error(msg), { userMessage: msg, code });
  B.PUBLIC_URL = 'https://raw.githack.com/baccarossa2-ai/Claude/claude/dreamy-franklin-jo2f3m/breye/index.html';

  /* ================= AI Horde ================= */
  B.horde = (function () {
    const API = 'https://aihorde.net/api/v2';
    const AGENT = 'breye-studio:1.1:github.com/baccarossa2-ai/Claude';
    const HEAD = { 'Content-Type': 'application/json', apikey: '0000000000', 'Client-Agent': AGENT };
    const BUDGET = 576 * 576;
    const MODELS = {
      photo: ["ICBINP - I Can't Believe It's Not Photography", 'Realistic Vision', 'AbsoluteReality', 'Edge Of Realism', 'Analog Madness', 'NatViS', 'Deliberate', 'Dreamshaper', 'stable_diffusion'],
      art: ['Dreamshaper', 'Deliberate', 'Rev Animated', 'AbsoluteReality', 'stable_diffusion'],
      anime: ['Rev Animated', 'Counterfeit', 'Abyss OrangeMix', 'Dreamshaper', 'stable_diffusion'],
      inpaint: ['Deliberate Inpainting', 'stable_diffusion_inpainting', 'Realistic Vision Inpainting', 'Dreamshaper Inpainting']
    };
    let stat = null, statT = 0;
    async function status() {
      if (stat && Date.now() - statT < 120000) return stat;
      try { const r = await fetch(API + '/status/models?type=image', { headers: { 'Client-Agent': AGENT } }); if (r.ok) { stat = await r.json(); statT = Date.now(); } } catch (e) { /* offline */ }
      return stat || [];
    }
    // every live model of the family, most workers first: any idle GPU running one of them can take the job
    async function pickMany(kind, exclude = []) {
      const st = await status(), list = MODELS[kind] || MODELS.photo;
      const live = list.filter((n) => !exclude.includes(n)).map((n, i) => { const m = st.find((x) => x.name === n); return { n, i, c: m ? m.count : 0 }; }).filter((x) => x.c > 0);
      if (!live.length) return list.filter((n) => !exclude.includes(n)).slice(0, 3);
      live.sort((a, b) => (b.c - a.c) || (a.i - b.i));
      return live.slice(0, 6).map((x) => x.n);
    }
    async function pick(kind, exclude = []) {
      const st = await status(), list = MODELS[kind] || MODELS.photo;
      const scored = list.filter((n) => !exclude.includes(n)).map((n, i) => { const m = st.find((x) => x.name === n); return { n, i, ok: !!(m && m.count > 0), eta: m ? m.eta : 9999 }; });
      const live = scored.filter((x) => x.ok);
      if (!live.length) return (scored[0] || {}).n || list[0];
      live.sort((a, b) => (Math.round(a.eta / 20) - Math.round(b.eta / 20)) || (a.i - b.i));
      return live[0].n;
    }
    function fit(w, h, budget = BUDGET) {
      const r = w / h;
      let W = Math.floor(Math.sqrt(budget * r) / 64) * 64, H = Math.floor(W / r / 64) * 64;
      while (W * H > budget) { if (W >= H) W -= 64; else H -= 64; }
      if (H < 256) { H = 256; W = Math.min(W, Math.floor(budget / 256 / 64) * 64); }
      if (W < 256) { W = 256; H = Math.min(H, Math.floor(budget / 256 / 64) * 64); }
      return [W, H];
    }
    async function call(method, path, body, signal) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const r = await fetch(API + path, { method, headers: HEAD, body: body ? JSON.stringify(body) : undefined, signal });
        if (r.status === 429) { const ra = +(r.headers.get('Retry-After') || 0); await B.sleep(Math.max(3, Math.min(20, ra || 3 * (attempt + 1))) * 1000); continue; }
        let j = null; try { j = await r.json(); } catch (e) { /* empty */ }
        if (!r.ok) { const e = new Error((j && j.message) || 'HTTP ' + r.status); e.status = r.status; e.rc = j && j.rc; throw e; }
        return j;
      }
      throw userErr('La rete GPU comunitaria sta limitando le richieste. Riprova tra qualche secondo.', 'rate_limited');
    }
    // a few jobs at a time per browser: the network stays fair and anonymous requests are not refused
    let inflight = 0; const waiting = [];
    const acquire = () => new Promise((res) => { if (inflight < 4) { inflight++; res(); } else waiting.push(res); });
    const release = () => { const n = waiting.shift(); if (n) n(); else inflight--; };
    async function generate(o) {
      await acquire();
      try { return await generateOne(o); } finally { release(); }
    }
    async function generateOne(o) {
      const kind = o.kind || 'photo';
      const fam = o.source && o.processing && o.processing !== 'img2img' ? 'inpaint' : kind;
      let models = o.models || (o.model ? [o.model] : await pickMany(fam));
      let [w, h] = o.size || fit(o.w || 1, o.h || 1);
      const tried = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        const body = {
          prompt: o.prompt + (o.negative ? ' ### ' + o.negative : ''),
          params: { width: w, height: h, steps: o.steps || 24, cfg_scale: o.cfg || 5.5, sampler_name: 'k_dpmpp_2m', karras: true, n: 1 },
          nsfw: false, censor_nsfw: true, models, r2: false, shared: false, slow_workers: true, extra_slow_workers: true, allow_downgrade: !o.size, trusted_workers: false
        };
        if (o.seed != null) body.params.seed = String(o.seed);
        if (o.source) { body.source_image = o.source; body.source_processing = o.processing || 'img2img'; body.params.denoising_strength = o.denoise ?? 0.5; }
        let id;
        try { id = (await call('POST', '/generate/async', body, o.signal)).id; }
        catch (e) {
          if (e.rc === 'KudosUpfront' || /576x576|kudos/i.test(e.message)) { w = Math.max(256, w - 64); h = Math.max(256, h - 64); continue; }
          if ((e.rc === 'TooManyPrompts' || /too many|parallel/i.test(e.message)) && (o._waits = (o._waits || 0) + 1) < 30 && !(o.signal && o.signal.aborted)) { await B.sleep(8000); attempt--; continue; }
          if (e.name === 'AbortError') throw Object.assign(new Error('Interrotto'), { code: 'cancelled', name: 'AbortError' });
          throw userErr(e.userMessage || 'La rete GPU comunitaria non ha accettato la richiesta: ' + e.message, 'upstream_error');
        }
        const t0 = Date.now(), maxWait = (o.maxWait || 1200) * 1000;
        let done = false, chk = {};
        while (Date.now() - t0 < maxWait) {
          if (o.signal && o.signal.aborted) { call('DELETE', '/generate/status/' + id).catch(() => {}); throw Object.assign(new Error('Interrotto'), { code: 'cancelled' }); }
          await B.sleep(2200);
          try { chk = await call('GET', '/generate/check/' + id); } catch (e) { continue; }
          o.onProgress && o.onProgress({ queue: chk.queue_position, processing: chk.processing, model: models.length > 1 ? 'GPU comunitaria' : models[0], elapsed: Math.round((Date.now() - t0) / 1000) });
          if (chk.faulted || chk.is_possible === false) break;
          if (chk.done) { done = true; break; }
        }
        if (!done) {
          call('DELETE', '/generate/status/' + id).catch(() => {});
          // only resubmit when no worker can serve these models: resubmitting otherwise would lose the queue position
          if ((chk.faulted || chk.is_possible === false) && attempt < 2) { tried.push(...models); const alt = await pickMany(fam, tried); if (alt.length) { models = alt; continue; } }
          throw userErr(chk.faulted ? B.ai.MSG.horde_error : B.ai.MSG.horde_busy, 'upstream_error');
        }
        const res = await call('GET', '/generate/status/' + id);
        const g = (res.generations || [])[0];
        if (!g || !g.img) continue;
        if (g.censored) throw userErr('Il filtro di sicurezza della rete ha bloccato questa immagine. Riformula la richiesta.', 'refused');
        const blob = /^https?:/.test(g.img) ? await (await fetch(g.img)).blob() : B.dataURLToBlob('data:image/webp;base64,' + g.img);
        return { blob, w, h, model: g.model || models[0], seed: g.seed, worker: g.worker_name };
      }
      throw userErr(B.ai.MSG.horde_busy, 'upstream_error');
    }
    return { generate, pick, pickMany, fit, status, MODELS, BUDGET };
  })();

  /* ================= local realism toolkit ================= */
  const LOOKS = {
    natural: { label: 'Naturale', curve: 0.18, sat: 1.0, warm: 0.0, sh: [0, 0, 0], hi: [0, 0, 0], grain: 0.35, vig: 0.18, clarity: 0.35, fade: 0 },
    portra: { label: 'Portra 400', curve: 0.14, sat: 0.92, warm: 0.035, sh: [0.01, 0.0, -0.01], hi: [0.025, 0.012, -0.02], grain: 0.5, vig: 0.22, clarity: 0.25, fade: 0.025 },
    cinestill: { label: 'Cinestill', curve: 0.26, sat: 1.05, warm: 0.02, sh: [-0.01, 0.005, 0.02], hi: [0.03, 0.0, -0.02], grain: 0.55, vig: 0.3, clarity: 0.3, fade: 0.01, halation: 0.35 },
    gold: { label: 'Ora d’oro', curve: 0.2, sat: 1.06, warm: 0.07, sh: [0.015, 0.0, -0.015], hi: [0.04, 0.02, -0.03], grain: 0.4, vig: 0.28, clarity: 0.3, fade: 0.015 },
    cinema: { label: 'Cinema', curve: 0.3, sat: 0.9, warm: 0.0, sh: [-0.02, 0.01, 0.03], hi: [0.035, 0.01, -0.025], grain: 0.45, vig: 0.35, clarity: 0.35, fade: 0.02 },
    noir: { label: 'Noir', curve: 0.38, sat: 0.0, warm: 0.0, sh: [0, 0, 0], hi: [0, 0, 0], grain: 0.7, vig: 0.45, clarity: 0.45, fade: 0.0 },
    crisp: { label: 'Nitida', curve: 0.16, sat: 1.04, warm: 0.0, sh: [0, 0, 0], hi: [0, 0, 0], grain: 0.18, vig: 0.1, clarity: 0.55, fade: 0 }
  };
  B.realism = {
    LOOKS,
    upscale(src, factor) {
      let c = src; let cur = 1;
      while (cur < factor - 1e-3) { const f = Math.min(1.5, factor / cur); const n = mk(c.width * f, c.height * f); const x = n.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, n.width, n.height); c = n; cur *= f; }
      if (factor < 1) { const n = mk(src.width * factor, src.height * factor); const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, n.width, n.height); c = n; }
      return c;
    },
    finish(src, lookName = 'natural', o = {}) {
      const L = Object.assign({}, LOOKS[lookName] || LOOKS.natural);
      if (o.grain != null) L.grain = o.grain; if (o.vignette != null) L.vig = o.vignette;
      const w = src.width, h = src.height;
      const out = mk(w, h), ctx = out.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(src, 0, 0);
      const id = ctx.getImageData(0, 0, w, h), d = id.data, orig = new Uint8ClampedArray(d);
      // low-pass copy for local contrast and halation
      const r = Math.max(1.5, Math.min(w, h) / 360);
      const bl = mk(w, h), bx = bl.getContext('2d', { willReadFrequently: true }); bx.filter = 'blur(' + r.toFixed(1) + 'px)'; bx.drawImage(src, 0, 0); bx.filter = 'none';
      const bd = bx.getImageData(0, 0, w, h).data;
      // filmic tone curve LUT
      const lut = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 255; const s = x + L.curve * (x - 0.5) * (1 - Math.abs(2 * x - 1)) * 2 * 0.5; const shoulder = s > 0.82 ? 0.82 + (s - 0.82) * (1 - (s - 0.82) * 1.6) : s; lut[i] = Math.min(1, Math.max(0, shoulder * (1 - L.fade) + L.fade)); }
      const cx = w / 2, cy = h / 2, maxD = Math.hypot(cx, cy), ca = (o.ca ?? 0.0011);
      const gAmp = L.grain * 0.055;
      for (let y = 0, i = 0; y < h; y++) {
        for (let x = 0; x < w; x++, i += 4) {
          if (orig[i + 3] === 0) continue;
          // chromatic aberration: sample red outward, blue inward
          const dx = (x - cx) * ca, dy = (y - cy) * ca;
          const xr = Math.min(w - 1, Math.max(0, Math.round(x + dx))), yr = Math.min(h - 1, Math.max(0, Math.round(y + dy)));
          const xb = Math.min(w - 1, Math.max(0, Math.round(x - dx))), yb = Math.min(h - 1, Math.max(0, Math.round(y - dy)));
          let R = orig[(yr * w + xr) * 4] / 255, G = orig[i + 1] / 255, Bb = orig[(yb * w + xb) * 4 + 2] / 255;
          // local contrast (clarity) on midtones
          const lum0 = 0.2126 * R + 0.7152 * G + 0.0722 * Bb, mid = 1 - Math.abs(lum0 - 0.5) * 2;
          const k = L.clarity * (0.4 + 0.6 * mid);
          R += (R - bd[i] / 255) * k; G += (G - bd[i + 1] / 255) * k; Bb += (Bb - bd[i + 2] / 255) * k;
          // halation: warm glow around highlights
          if (L.halation) { const bh = Math.max(0, (bd[i] / 255) - 0.7) * L.halation; R += bh * 0.9; G += bh * 0.3; }
          // tone curve
          R = lut[Math.max(0, Math.min(255, R * 255 | 0))]; G = lut[Math.max(0, Math.min(255, G * 255 | 0))]; Bb = lut[Math.max(0, Math.min(255, Bb * 255 | 0))];
          // split toning + warmth + saturation
          const lum = 0.2126 * R + 0.7152 * G + 0.0722 * Bb, shw = (1 - lum) * (1 - lum), hiw = lum * lum;
          R += L.sh[0] * shw + L.hi[0] * hiw + L.warm; G += L.sh[1] * shw + L.hi[1] * hiw + L.warm * 0.35; Bb += L.sh[2] * shw + L.hi[2] * hiw - L.warm * 0.8;
          R = lum + (R - lum) * L.sat; G = lum + (G - lum) * L.sat; Bb = lum + (Bb - lum) * L.sat;
          // vignette
          if (L.vig) { const dd = Math.hypot(x - cx, y - cy) / maxD; const v = 1 - L.vig * Math.pow(dd, 2.4); R *= v; G *= v; Bb *= v; }
          // film grain, stronger in midtones, monochrome
          if (gAmp) { const n = (Math.random() + Math.random() + Math.random() - 1.5) * gAmp * (0.35 + mid); R += n; G += n; Bb += n; }
          d[i] = R <= 0 ? 0 : R >= 1 ? 255 : R * 255; d[i + 1] = G <= 0 ? 0 : G >= 1 ? 255 : G * 255; d[i + 2] = Bb <= 0 ? 0 : Bb >= 1 ? 255 : Bb * 255;
        }
      }
      ctx.putImageData(id, 0, 0);
      return out;
    }
  };

  /* ================= tiled detail refinement ================= */
  const TILE = 576, OVER = 96, MAXLONG = 2 * TILE - OVER; // 1056
  function positions(L) { if (L <= TILE) return [0]; const n = Math.ceil((L - OVER) / (TILE - OVER)); const out = []; for (let i = 0; i < n; i++) out.push(Math.round(i * (L - TILE) / (n - 1))); return out; }
  function feather(tw, th, left, top, right, bottom) {
    const m = mk(tw, th), x = m.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, tw, th);
    x.globalCompositeOperation = 'destination-in';
    const edge = (x0, y0, x1, y1) => { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); return g; };
    // destination-in keeps only what the fill covers: each edge fills the whole tile, transparent → opaque over OVER px
    if (left) { x.fillStyle = edge(0, 0, OVER, 0); x.fillRect(0, 0, tw, th); }
    if (top) { x.fillStyle = edge(0, 0, 0, OVER); x.fillRect(0, 0, tw, th); }
    void right; void bottom;
    return m;
  }
  /* frequency separation: keep colour and light from the base, take only fine detail from the refined pass */
  function detailTransfer(base, refined, radius = 3, amount = 0.9) {
    const w = base.width, h = base.height;
    const blurOf = (c) => { const b = mk(w, h), x = b.getContext('2d', { willReadFrequently: true }); x.filter = 'blur(' + radius + 'px)'; x.drawImage(c, 0, 0, w, h); x.filter = 'none'; return x.getImageData(0, 0, w, h).data; };
    const rb = blurOf(refined), bb = blurOf(base);
    const out = mk(w, h), ox = out.getContext('2d', { willReadFrequently: true }); ox.drawImage(refined, 0, 0, w, h);
    const id = ox.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) { const v = bb[i + k] + (d[i + k] - rb[i + k]) * amount; d[i + k] = v < 0 ? 0 : v > 255 ? 255 : v; }
    ox.putImageData(id, 0, 0);
    return out;
  }
  B.irisRefine = async function (srcIn, o = {}) {
    let src = await toCanvas(srcIn);
    const long = Math.max(src.width, src.height), BIG = 3 * TILE - 2 * OVER;
    if (long > BIG) throw userErr('La rifinitura lavora su immagini fino a ' + BIG + ' px sul lato lungo: riducila prima o usa la finitura pellicola.');
    const maxLong = o.maxLong || (o.tiles === 9 || long > MAXLONG ? BIG : MAXLONG);
    const f = Math.min(o.factor || 2, maxLong / long);
    const up = B.realism.upscale(src, f);
    const xs = positions(up.width), ys = positions(up.height);
    const out = mk(up.width, up.height), ox = out.getContext('2d'); ox.drawImage(up, 0, 0);
    const jobs = [];
    ys.forEach((ty, yi) => xs.forEach((tx, xi) => jobs.push({ tx, ty, xi, yi })));
    let doneN = 0;
    const models = [...new Set([o.model].concat(await B.horde.pickMany(o.kind || 'photo')).filter(Boolean))].slice(0, 6);
    const runOne = async (j) => {
      const tw = Math.min(TILE, up.width), th = Math.min(TILE, up.height);
      const tile = mk(tw, th); tile.getContext('2d').drawImage(up, j.tx, j.ty, tw, th, 0, 0, tw, th);
      try {
        const r = await B.horde.generate({ prompt: o.prompt + ', highly detailed, sharp focus, fine texture', negative: o.negative, source: b64(tile), denoise: o.strength ?? 0.34, size: [Math.floor(tw / 64) * 64, Math.floor(th / 64) * 64], models, kind: o.kind, steps: 22, signal: o.signal, maxWait: 900 });
        const im = await B.loadImage(r.blob);
        const t2 = detailTransfer(tile, im, Math.max(2, Math.round(tw / 190)), 0.92), t2x = t2.getContext('2d');
        t2x.globalCompositeOperation = 'destination-in'; t2x.drawImage(feather(tw, th, j.xi > 0, j.yi > 0), 0, 0);
        return { j, t2 };
      } catch (e) { if (e.code === 'cancelled') throw e; return { j, t2: null, err: e }; }
      finally { doneN++; o.onProgress && o.onProgress(doneN / jobs.length); }
    };
    const results = [];
    const limit = 4; let k = 0;
    await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, async () => { while (k < jobs.length) { const j = jobs[k++]; results.push(await runOne(j)); } }));
    results.sort((a, b) => (a.j.yi - b.j.yi) || (a.j.xi - b.j.xi)).forEach((r) => { if (r.t2) ox.drawImage(r.t2, r.j.tx, r.j.ty); });
    const ok = results.filter((r) => r.t2).length;
    if (!ok) throw results[0] && results[0].err || userErr(B.ai.MSG.horde_busy);
    return { canvas: out, refined: ok, total: jobs.length };
  };

  /* ================= prompt craft ================= */
  const KIND_OF_STYLE = { anime: 'anime', watercolor: 'art', oil: 'art', flat: 'art', logo: 'art', pixel: 'art', render3d: 'art' };
  B.craftPrompt = async function (idea, style, signal) {
    const base = { prompt: idea, negative: 'cartoon, painting, illustration, 3d render, cgi, plastic skin, waxy, blurry, deformed, extra fingers, watermark, text, logo, oversaturated', look: 'natural', kind: KIND_OF_STYLE[style] || 'photo' };
    const styleAdd = style && B.ai.STYLES[style] ? B.ai.STYLES[style].add : '';
    if (B.ai.textEngine()) {
      try {
        const r = await B.ai.json('Sei un direttore della fotografia. Trasforma questa idea in un prompt per un modello Stable Diffusion fotorealistico.\nIdea: "' + idea + '"' + (styleAdd ? '\nStile richiesto: ' + styleAdd : '') + '\nRispondi SOLO con JSON: {"prompt":"in inglese, max 60 parole: inizia con RAW photo (se fotografia), poi soggetto preciso, azione, ambiente, luce (direzione e qualità), obiettivo e diaframma, pellicola o sensore, dettagli di texture","negative":"in inglese, difetti da evitare","look":"natural|portra|cinestill|gold|cinema|noir|crisp","kind":"photo|art|anime"}', { system: false, tier: 'quick', cache: true, signal });
        if (r && r.prompt) return { prompt: String(r.prompt).slice(0, 600), negative: r.negative || base.negative, look: LOOKS[r.look] ? r.look : 'natural', kind: ['photo', 'art', 'anime'].includes(r.kind) ? r.kind : base.kind };
      } catch (e) { if (e.code === 'cancelled') throw e; /* fall back */ }
    }
    base.prompt = (base.kind === 'photo' ? 'RAW photo, ' : '') + idea + (styleAdd ? ', ' + styleAdd : ', natural light, 50mm lens, high detail, film grain');
    return base;
  };

  /* ================= Thorion Pro pipeline ================= */
  B.irisPro = async function (o) {
    const step = (id, label, status, extra) => o.onStep && o.onStep(Object.assign({ id, label, status }, extra || {}));
    let plan;
    if (o.rawPrompt) plan = { prompt: o.prompt, negative: o.negative || 'blurry, deformed, watermark, text', look: o.look || 'natural', kind: KIND_OF_STYLE[o.style] || 'photo' };
    else { step('plan', 'Thorion scrive lo scatto (luce, obiettivo, pellicola)', 'run'); plan = await B.craftPrompt(o.prompt, o.style, o.signal); step('plan', 'Scatto pianificato', 'done', { detail: plan.prompt }); }
    if (o.negative && !o.rawPrompt) plan.negative += ', ' + o.negative;
    const look = o.look || plan.look;
    if (o.signal && o.signal.aborted) throw Object.assign(new Error('Interrotto'), { code: 'cancelled' });
    step('shot', 'Scatto sulla rete GPU comunitaria', 'run');
    const shot = await B.horde.generate({ prompt: plan.prompt, negative: plan.negative, w: o.w || 1, h: o.h || 1, kind: plan.kind, seed: o.seed, signal: o.signal, onProgress: (p) => step('shot', 'Scatto sulla rete GPU comunitaria', 'run', { detail: p.processing ? 'in elaborazione su ' + p.model + ' · ' + p.elapsed + ' s' : 'in coda da ' + p.elapsed + ' s · di solito 1–3 minuti' }) });
    step('shot', 'Scatto pronto · ' + shot.model, 'done', { preview: shot.blob });
    let canvas = await toCanvas(shot.blob);
    if (o.quality === 'ultra') {
      step('refine', 'Rifinisco il dettaglio in tasselli', 'run');
      try {
        const r = await B.irisRefine(canvas, { prompt: plan.prompt, negative: plan.negative, kind: plan.kind, model: shot.model, signal: o.signal, onProgress: (p) => step('refine', 'Rifinisco il dettaglio in tasselli', 'run', { detail: Math.round(p * 100) + '%' }) });
        canvas = r.canvas; step('refine', 'Dettaglio rifinito (' + r.refined + '/' + r.total + ' tasselli)', 'done', { preview: await B.canvasToBlob(canvas, 'image/jpeg', 0.85) });
      } catch (e) {
        if (e.code === 'cancelled') throw e;
        canvas = B.realism.upscale(canvas, Math.min(2, 1056 / Math.max(canvas.width, canvas.height)));
        step('refine', 'Rete occupata: ingrandimento locale', 'done');
      }
    } else canvas = B.realism.upscale(canvas, Math.min(2, 1056 / Math.max(canvas.width, canvas.height)));
    step('finish', 'Finitura pellicola: ' + LOOKS[look].label, 'run');
    await B.sleep(16);
    canvas = B.realism.finish(canvas, plan.kind === 'photo' ? look : 'crisp', plan.kind === 'photo' ? {} : { grain: 0.1, vignette: 0.05, ca: 0 });
    const blob = await B.canvasToBlob(canvas, 'image/jpeg', 0.94);
    step('finish', 'Pronta · ' + canvas.width + '×' + canvas.height, 'done');
    return { blob, w: canvas.width, h: canvas.height, model: shot.model, seed: shot.seed, prompt: plan.prompt, look };
  };

  /* edit / inpaint / outpaint an existing image */
  B.irisEdit = async function (srcIn, instruction, o = {}) {
    const src = await toCanvas(srcIn);
    const [W, H] = B.horde.fit(src.width, src.height);
    const small = mk(W, H); small.getContext('2d').drawImage(src, 0, 0, W, H);
    let prompt = instruction;
    if (B.ai.textEngine() && !o.rawPrompt) {
      try { prompt = (await B.ai.text('Trasforma questa richiesta di modifica di una foto in un prompt in inglese che descriva il risultato finale desiderato (max 40 parole, stile fotografico realistico). Rispondi solo con il prompt.\nRichiesta: ' + instruction, { system: false, tier: 'quick', cache: true })).replace(/^["'\s]+|["'\s]+$/g, '').split('\n')[0]; } catch (e) { /* keep */ }
    }
    let source = b64(small), processing = 'img2img';
    if (o.mask) {
      const m = mk(W, H), mx = m.getContext('2d'); mx.drawImage(small, 0, 0); mx.globalCompositeOperation = 'destination-out'; mx.drawImage(o.mask, 0, 0, W, H);
      source = b64(m); processing = o.outpaint ? 'outpainting' : 'inpainting';
    }
    const r = await B.horde.generate({ prompt: 'RAW photo, ' + prompt, negative: 'blurry, deformed, watermark, text, cartoon', source, processing, denoise: o.mask ? 1 : (o.strength ?? 0.55), size: [W, H], kind: o.mask ? 'inpaint' : 'photo', signal: o.signal, onProgress: o.onProgress, maxWait: 240 });
    const im = await B.loadImage(r.blob);
    const out = mk(src.width, src.height), x = out.getContext('2d');
    if (o.mask) {
      x.drawImage(src, 0, 0);
      const patch = mk(src.width, src.height), px = patch.getContext('2d'); px.imageSmoothingQuality = 'high'; px.drawImage(im, 0, 0, src.width, src.height);
      px.globalCompositeOperation = 'destination-in'; px.filter = 'blur(' + Math.max(1, Math.round(Math.max(src.width, src.height) / 400)) + 'px)'; px.drawImage(o.mask, 0, 0, src.width, src.height); px.filter = 'none';
      x.drawImage(patch, 0, 0);
    } else { x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, src.width, src.height); }
    return B.canvasToBlob(out, 'image/png');
  };

  /* ================= tools for the agent ================= */
  const ASPECTS = { '1:1': [1, 1], '3:2': [3, 2], '2:3': [2, 3], '16:9': [16, 9], '9:16': [9, 16], '4:5': [4, 5], '5:4': [5, 4] };
  B.irisTools = function (ctx) {
    const store = ctx.images || (ctx.images = new Map());
    const put = async (blob, label, meta) => { const id = 'img' + (store.size + 1); const c = await toCanvas(blob); store.set(id, Object.assign({ blob, canvas: c, label }, meta || {})); if (ctx.onImage) await ctx.onImage(id, blob, label); return { image_id: id, width: c.width, height: c.height }; };
    const get = (id) => { const it = store.get(String(id)); if (!it) throw new Error('image_id sconosciuto: ' + id); return it; };
    const step = (label, status) => ctx.onStep && ctx.onStep({ label, status });
    const tools = [];
    if (B.ai.engines.horde) {
      tools.push({ name: 'generate_photo', description: 'Scatta una foto fotorealistica (bassa risoluzione, veloce e a basso consumo di GPU). Scrivi tu un prompt fotografico dettagliato in inglese. Restituisce image_id, width, height.', schema: { type: 'object', properties: { prompt: { type: 'string', description: 'Prompt in inglese: RAW photo, soggetto, ambiente, luce, obiettivo, pellicola, texture' }, negative: { type: 'string', description: 'Difetti da evitare, in inglese' }, aspect: { type: 'string', enum: Object.keys(ASPECTS) }, kind: { type: 'string', enum: ['photo', 'art', 'anime'] } }, required: ['prompt'] },
        execute: async (a, c) => { step('Scatto: ' + String(a.prompt).slice(0, 70), 'run'); const [aw, ah] = ASPECTS[a.aspect] || [1, 1]; const r = await B.horde.generate({ prompt: a.prompt, negative: a.negative || 'blurry, deformed, watermark, text, plastic skin', w: aw, h: ah, kind: a.kind || 'photo', signal: c && c.signal }); step('Scatto pronto', 'done'); return Object.assign(await put(r.blob, a.prompt, { prompt: a.prompt, negative: a.negative, kind: a.kind || 'photo', model: r.model }), { model: r.model }); } });
      tools.push({ name: 'refine_detail', description: 'Raddoppia la risoluzione e aggiunge dettaglio reale (pelle, tessuti, materiali) rigenerando l’immagine a tasselli con bassa intensità. Usalo dopo generate_photo per il realismo massimo.', schema: { type: 'object', properties: { image_id: { type: 'string' }, strength: { type: 'number', description: '0.2 delicato – 0.45 marcato, default 0.32' } }, required: ['image_id'] },
        execute: async (a, c) => { const it = get(a.image_id); step('Rifinisco il dettaglio', 'run'); const r = await B.irisRefine(it.canvas, { prompt: it.prompt || it.label || 'photo', negative: it.negative, kind: it.kind, model: it.model, strength: B.clamp(+a.strength || 0.32, 0.15, 0.5), signal: c && c.signal }); step('Dettaglio rifinito', 'done'); return put(await B.canvasToBlob(r.canvas, 'image/jpeg', 0.95), 'Rifinita', { prompt: it.prompt, kind: it.kind, model: it.model }); } });
      tools.push({ name: 'edit_photo', description: 'Modifica una foto esistente secondo un prompt (img2img): cambia stile, luce, stagione, abiti, sfondo. Restituisce un nuovo image_id.', schema: { type: 'object', properties: { image_id: { type: 'string' }, prompt: { type: 'string', description: 'Descrizione in inglese del risultato desiderato' }, strength: { type: 'number', description: '0.3 leggero – 0.75 forte' } }, required: ['image_id', 'prompt'] },
        execute: async (a, c) => { const it = get(a.image_id); step('Modifico la foto', 'run'); const blob = await B.irisEdit(it.canvas, a.prompt, { strength: B.clamp(+a.strength || 0.5, 0.2, 0.85), rawPrompt: true, signal: c && c.signal }); step('Modifica pronta', 'done'); return put(blob, a.prompt, { prompt: a.prompt, kind: it.kind }); } });
    }
    tools.push({ name: 'finish_photo', description: 'Finitura fotografica locale (nessuna GPU remota): curva filmica, micro-contrasto, grana, vignettatura, aberrazione cromatica e color grading. Rende le immagini meno “AI” e più fotografiche.', schema: { type: 'object', properties: { image_id: { type: 'string' }, look: { type: 'string', enum: Object.keys(LOOKS) }, grain: { type: 'number', description: '0-1' }, vignette: { type: 'number', description: '0-1' } }, required: ['image_id'] },
      execute: async (a) => { const it = get(a.image_id); step('Finitura ' + ((LOOKS[a.look] || LOOKS.natural).label), 'run'); await B.sleep(10); const out = B.realism.finish(it.canvas, a.look || 'natural', { grain: a.grain, vignette: a.vignette }); step('Finitura applicata', 'done'); return put(await B.canvasToBlob(out, 'image/jpeg', 0.95), 'Finitura ' + (a.look || 'natural'), { prompt: it.prompt, kind: it.kind, model: it.model }); } });
    tools.push({ name: 'upscale_photo', description: 'Ingrandisce localmente un’immagine (1.5× o 2×) con ricampionamento di qualità.', schema: { type: 'object', properties: { image_id: { type: 'string' }, factor: { type: 'number' } }, required: ['image_id'] },
      execute: async (a) => { const it = get(a.image_id); const f = B.clamp(+a.factor || 2, 1.1, 2); if (it.canvas.width * f > 4096) throw new Error('immagine già grande'); const up = B.realism.upscale(it.canvas, f); const sharp = B.px && B.px.adjust ? B.px.adjust(up, Object.assign({}, B.px.ADJ0, { sharpen: 25 })) : up; return put(await B.canvasToBlob(sharp, 'image/jpeg', 0.95), 'Ingrandita', { prompt: it.prompt, kind: it.kind, model: it.model }); } });
    tools.push({ name: 'remove_background', description: 'Scontorna il soggetto e restituisce un PNG trasparente (locale).', schema: { type: 'object', properties: { image_id: { type: 'string' } }, required: ['image_id'] },
      execute: async (a) => { const it = get(a.image_id); step('Scontorno il soggetto', 'run'); const out = await B.removeBackground(it.canvas); step('Sfondo rimosso', 'done'); return put(await B.canvasToBlob(out, 'image/png'), 'Scontornata', { prompt: it.prompt }); } });
    if (B.ai.textEngine()) tools.push({ name: 'create_vector', description: 'Crea un’illustrazione vettoriale SVG (loghi, icone, poster grafici). Restituisce image_id.', schema: { type: 'object', properties: { prompt: { type: 'string' }, aspect: { type: 'string', enum: Object.keys(ASPECTS) } }, required: ['prompt'] },
      execute: async (a, c) => { step('Disegno il vettoriale', 'run'); const [aw, ah] = ASPECTS[a.aspect] || [1, 1]; const W = 1024, H = Math.round(1024 * ah / aw); const svg = await B.ai.svg(a.prompt, { w: W, h: H, signal: c && c.signal }); step('Vettoriale pronto', 'done'); return put(await B.ai.svgToBlob(svg, W, H), a.prompt, { svg }); } });
    tools.push({ name: 'make_video', description: 'Crea un breve video cinematografico (MP4) animando una o più immagini con movimenti di camera, particelle, transizioni e musica originale. Basso consumo: tutto nel browser.', schema: { type: 'object', properties: { image_ids: { type: 'array', items: { type: 'string' } }, title: { type: 'string', description: 'Testo a schermo, breve' }, seconds: { type: 'number' }, camera: { type: 'string', enum: ['zoomIn', 'zoomOut', 'panLeft', 'panRight', 'orbit'] }, particles: { type: 'string', enum: ['none', 'dust', 'bokeh', 'sparks', 'snow', 'rain', 'stars'] }, music: { type: 'string', enum: ['none', 'cinematic', 'upbeat', 'lofi', 'ambient', 'epic', 'corporate'] }, aspect: { type: 'string', enum: ['9:16', '16:9', '1:1'] } }, required: ['image_ids'] },
      execute: async (a, c) => {
        const ids = (a.image_ids || []).filter((id) => store.has(String(id))).slice(0, 6); if (!ids.length) throw new Error('nessuna immagine valida');
        step('Monto il video', 'run');
        const [aw, ah] = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080] }[a.aspect || '9:16'];
        const total = B.clamp(+a.seconds || Math.max(6, 4 * ids.length), 3, 120); // seconds from the prompt; default well above 0
        const per = B.clamp(total / ids.length, 2.5, 20);
        const cams = ['zoomIn', 'panRight', 'orbit', 'zoomOut', 'panLeft'], trans = ['iris', 'fade', 'blink', 'zoom'];
        const story = { w: aw, h: ah, music: a.music || 'cinematic', seed: 9, title: a.title || 'Thorion', lightLeak: true, scenes: ids.map((id, i) => ({ dur: per, title: i === 0 ? (a.title || '') : '', subtitle: '', text: 'cinematic', camera: a.camera || cams[i % cams.length], particles: a.particles || 'dust', transition: trans[i % trans.length], bg: { type: 'image', blob: get(id).blob } })) };
        await B.prepareStory(story);
        const audio = story.music !== 'none' ? await B.music.render({ mood: story.music, duration: B.storyDuration(story), seed: 9 }) : null;
        const res = await B.exportVideo({ w: aw, h: ah, fps: 30, duration: B.storyDuration(story), audio, signal: c && c.signal, draw: (cx, t) => B.renderStory(cx, story, t, false) });
        const vid = 'vid' + ((ctx.videos = (ctx.videos || 0) + 1));
        if (ctx.onVideo) await ctx.onVideo(vid, res.blob, story);
        step('Video pronto', 'done');
        return { video_id: vid, seconds: B.storyDuration(story), format: res.ext };
      } });
    tools.push({ name: 'make_3d', description: 'Costruisce una scena 3D reale, interattiva ed esplorabile (Three.js/WebGL) con luci, ombre e materiali PBR. Usa come texture le foto già create (passa i loro image_id) per un look ultra realistico. Modalità "fps" per un piccolo gioco esplorabile con WASD e mouse, "orbit" per ruotare un oggetto/scena. Restituisce scene_id.', schema: { type: 'object', properties: {
        mode: { type: 'string', enum: ['orbit', 'fps'], description: 'orbit = ruoti attorno; fps = cammini dentro la scena (gioco)' },
        sky: { type: 'string', enum: ['day', 'sunset', 'night', 'studio', 'space'] },
        ground: { type: 'object', description: 'pavimento: color (#hex) o texture (image_id di una foto, es. di pietra/erba/legno)', properties: { color: { type: 'string' }, texture: { type: 'string' }, tiles: { type: 'number' }, size: { type: 'number' } } },
        fog: { type: 'boolean' },
        objects: { type: 'array', description: 'da 1 a 24 oggetti', items: { type: 'object', properties: { shape: { type: 'string', enum: ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane'] }, pos: { type: 'array', items: { type: 'number' }, description: '[x,y,z]' }, size: { type: 'array', items: { type: 'number' }, description: 'dimensioni o [raggio]' }, color: { type: 'string' }, texture: { type: 'string', description: 'image_id di una foto da usare come texture' }, metal: { type: 'number' }, rough: { type: 'number' }, spin: { type: 'number', description: 'rotazione automatica, 0 = ferma' } }, required: ['shape', 'pos'] } },
        title: { type: 'string' }
      }, required: ['objects'] },
      execute: async (a, c) => {
        step('Costruisco la scena 3D', 'run'); await B.sleep(10);
        const assets = {}; const want = new Set();
        (a.objects || []).forEach((o) => o && o.texture && want.add(String(o.texture)));
        if (a.ground && a.ground.texture) want.add(String(a.ground.texture));
        for (const id of want) { const it = store.get(id); if (it) { try { assets[id] = texData(it.canvas); } catch (e) { /* skip */ } } }
        const html = B.scene3d(a, assets);
        const vid = 'scene' + ((ctx.scenes = (ctx.scenes || 0) + 1));
        if (ctx.onScene) await ctx.onScene(vid, new Blob([html], { type: 'text/html' }), a.title || 'Scena 3D');
        step('Scena 3D pronta', 'done');
        return { scene_id: vid, mode: a.mode || 'orbit', objects: (a.objects || []).length };
      } });
    return tools;
  };
  // downscale a texture canvas and return a data URL small enough to inline in the scene HTML
  function texData(canvas) {
    const L = Math.max(canvas.width, canvas.height), f = Math.min(1, 512 / L);
    const c = mk(Math.round(canvas.width * f), Math.round(canvas.height * f));
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  }

  /* ================= real 3D scenes (Three.js) ================= */
  B.scene3d = function (spec, assets) {
    const data = JSON.stringify({ spec: spec || {}, assets: assets || {} }).replace(/</g, '\\u003c');
    return '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + String(spec && spec.title || 'Scena 3D Thorion').replace(/[<>&]/g, '') + '</title>'
      + '<style>html,body{margin:0;height:100%;overflow:hidden;background:#05070b;font-family:system-ui,sans-serif}#c{display:block;width:100%;height:100%}'
      + '#hint{position:fixed;left:14px;bottom:14px;color:#ffffffcc;font-size:13px;background:#0008;padding:7px 11px;border-radius:10px;pointer-events:none;backdrop-filter:blur(6px)}'
      + '#play{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#05070bcc;color:#fff;cursor:pointer;font-size:18px;font-weight:600;letter-spacing:.3px}</style></head>'
      + '<body><canvas id="c"></canvas><div id="hint"></div>'
      + '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</' + 'script>'
      + '<script type="module">' + SCENE_JS + '\nboot(' + data + ');</' + 'script></body></html>';
  };
  const SCENE_JS = `
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
function boot(D){
  const spec=D.spec||{}, A=D.assets||{};
  const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05; renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();
  const SKY={day:['#bfe3ff','#7fb2e6','#f6f2e8'],sunset:['#2a1830','#ff9a52','#ffd9a0'],night:['#05070f','#0b1026','#1b2550'],studio:['#1a1a1e','#2a2a30','#3a3a42'],space:['#02030a','#05030f','#0a0820']}[spec.sky||'day'];
  scene.background=new THREE.Color(SKY[1]);
  if(spec.fog) scene.fog=new THREE.Fog(new THREE.Color(SKY[1]), 14, 90);
  const hemi=new THREE.HemisphereLight(new THREE.Color(SKY[0]), new THREE.Color('#2a2016'), 1.05); scene.add(hemi);
  const sun=new THREE.DirectionalLight(new THREE.Color(SKY[2]), spec.sky==='night'?1.1:2.2);
  sun.position.set(18,26,12); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
  const sc=sun.shadow.camera; sc.near=1; sc.far=140; sc.left=sc.bottom=-40; sc.right=sc.top=40; scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff,0.18));
  const L=new THREE.TextureLoader(); const T={};
  for(const k in A){ try{const t=L.load(A[k]); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; T[k]=t;}catch(e){} }
  // ground
  const g=spec.ground||{}; const gsize=Math.max(10, +g.size||60);
  const gmat=new THREE.MeshStandardMaterial({color:new THREE.Color(g.color||'#6b6b72'), roughness:0.95, metalness:0.0});
  if(g.texture&&T[g.texture]){ const tt=T[g.texture].clone(); tt.needsUpdate=true; tt.repeat.set(+g.tiles||8,+g.tiles||8); gmat.map=tt; gmat.color.set('#ffffff'); }
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(gsize,gsize), gmat); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
  // objects
  const spinners=[];
  (spec.objects||[]).slice(0,24).forEach((o)=>{ if(!o) return; let geo; const s=o.size||[];
    if(o.shape==='sphere') geo=new THREE.SphereGeometry(s[0]||1,48,32);
    else if(o.shape==='cylinder') geo=new THREE.CylinderGeometry(s[0]||1,s[1]||s[0]||1,s[2]||2,40);
    else if(o.shape==='cone') geo=new THREE.ConeGeometry(s[0]||1,s[1]||2,40);
    else if(o.shape==='torus') geo=new THREE.TorusGeometry(s[0]||1,s[1]||0.35,24,80);
    else if(o.shape==='plane') geo=new THREE.PlaneGeometry(s[0]||2,s[1]||2);
    else geo=new THREE.BoxGeometry(s[0]||1,s[1]||1,s[2]||1);
    const m=new THREE.MeshStandardMaterial({color:new THREE.Color(o.color||'#d9a05a'), metalness:o.metal==null?0.1:+o.metal, roughness:o.rough==null?0.7:+o.rough});
    if(o.texture&&T[o.texture]){ m.map=T[o.texture]; m.color.set('#ffffff'); }
    const mesh=new THREE.Mesh(geo,m); const p=o.pos||[0,1,0]; mesh.position.set(p[0]||0,p[1]||0,p[2]||0); mesh.castShadow=true; mesh.receiveShadow=true;
    if(o.shape==='plane') mesh.rotation.x=-Math.PI/2; scene.add(mesh); if(+o.spin) spinners.push([mesh,+o.spin]);
  });
  // camera + controls
  const camera=new THREE.PerspectiveCamera(58, innerWidth/innerHeight, 0.05, 2000);
  function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
  addEventListener('resize',resize); resize();
  const hint=document.getElementById('hint');
  let fps=spec.mode==='fps', controls, pl, vel=new THREE.Vector3(), keys={};
  if(fps){
    camera.position.set(0,1.7,6); pl=new PointerLockControls(camera, renderer.domElement);
    const ov=document.createElement('div'); ov.id='play'; ov.textContent='▶  Clicca per esplorare (WASD + mouse)'; document.body.appendChild(ov);
    ov.addEventListener('click',()=>pl.lock()); pl.addEventListener('lock',()=>ov.style.display='none'); pl.addEventListener('unlock',()=>ov.style.display='flex');
    addEventListener('keydown',e=>keys[e.code]=true); addEventListener('keyup',e=>keys[e.code]=false);
    hint.textContent='WASD per muoverti · Mouse per guardarti attorno';
  } else {
    camera.position.set(5,4,8); controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.target.set(0,1,0); controls.maxPolarAngle=Math.PI*0.495;
    hint.textContent='Trascina per ruotare · scorri per lo zoom';
  }
  const clock=new THREE.Clock();
  (function loop(){ requestAnimationFrame(loop); const dt=Math.min(0.05,clock.getDelta());
    spinners.forEach(([m,sp])=>m.rotation.y+=sp*dt);
    if(fps&&pl&&pl.isLocked){ const sp=6; const d=new THREE.Vector3((keys.KeyD?1:0)-(keys.KeyA?1:0),0,(keys.KeyS?1:0)-(keys.KeyW?1:0)); vel.x=d.x*sp; vel.z=d.z*sp; pl.moveRight(vel.x*dt); pl.moveForward(-vel.z*dt); camera.position.y=1.7; }
    controls&&controls.update(); renderer.render(scene,camera);
  })();
}
`;

  B.agentSystem = 'Sei Thorion Three 3.3: regista, fotografa, montatrice e artista 3D con strumenti reali che producono foto, video, scene 3D e grafica. ' +
    'Ragiona SEMPRE prima di agire: in poche righe pensa a cosa serve davvero (soggetto, luce, inquadratura, durata, texture, materiali) e scegli gli strumenti giusti; poi agisci. Punta sempre al massimo realismo. ' +
    'FOTO ultra realistica: 1) generate_photo con un prompt in inglese molto dettagliato (inizia con "RAW photo", poi soggetto, azione, ambiente, luce con direzione e qualità, obiettivo e diaframma, pellicola o sensore, texture di pelle/materiali, "photorealistic, sharp focus, high detail"); 2) refine_detail sull’image_id; 3) finish_photo con il look adatto. Per una texture da usare in 3D, chiedi "seamless tileable PBR texture of …". ' +
    'VIDEO: crea prima 1–4 foto realistiche (con refine_detail), poi make_video con i loro image_id. Leggi dal messaggio quanti secondi vuole l’utente e passali in "seconds"; se non lo dice, usa circa 8–12 secondi. Il video ha già musica/audio: scegli il "music" più adatto. ' +
    'SCENE/GIOCHI 3D: usa make_3d. Per oggetti o materiali realistici genera prima le texture con generate_photo (es. pietra, legno, metallo, erba) e passa i loro image_id nel campo "texture" degli oggetti o del pavimento. Usa mode "fps" per un piccolo gioco esplorabile (WASD + mouse), "orbit" per mostrare un oggetto. ' +
    'GRAFICA/loghi/icone: create_vector. MODIFICHE a una foto: edit_photo. Scontorno: remove_background. ' +
    'CODICE e app/giochi web: scrivi tu codice completo e funzionante in un unico file (HTML+CSS+JS), moderno e animato; per il 3D nel codice usa Three.js via importmap. Non chiamare strumenti per il puro codice: scrivilo direttamente nel blocco ```html. ' +
    'Non generare più di 3 foto per richiesta salvo richiesta esplicita. Foto, video e scene creati vengono mostrati automaticamente: alla fine rispondi in italiano con 1-3 frasi su cosa hai creato e un consiglio per migliorarlo, senza elencare gli id.';
})();
