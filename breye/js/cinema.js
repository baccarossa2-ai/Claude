/* Thorion Cinema — realistic video from photoreal stills, rendered locally.
   Depth Anything V2 (in the browser) turns each photo into a depth map; a WebGL ray-marched 2.5D camera
   then moves through it (dolly, truck, orbit, crane, rack focus, handheld), with depth of field, atmosphere
   and a film finish. The soundtrack is synthesized to match the scene (rain, sea, wind, city, birds…),
   with optional natural narration (Thorion voice) and music, and muxed into the MP4. */
(function () {
  'use strict';
  const B = window.B;
  const TJS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* ================= depth ================= */
  let depthPipe = null;
  function loadDepth() {
    if (!depthPipe) depthPipe = (async () => {
      const T = await import(TJS);
      T.env.allowLocalModels = false;
      const gpu = !!(navigator.gpu && await navigator.gpu.requestAdapter().catch(() => null));
      return T.pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', gpu ? { device: 'webgpu', dtype: 'fp16' } : { device: 'wasm', dtype: 'q8' });
    })();
    depthPipe.catch(() => { depthPipe = null; });
    return depthPipe;
  }
  // a plausible depth when the model can't load: sky/top far, ground/bottom near, centre subject a bit closer
  function heuristicDepth(src) {
    const w = 192, h = Math.round(192 * src.height / src.width);
    const c = mk(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h); const p = d.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4; const v = j / h, cx = (i / w - 0.5), cy = (v - 0.55);
      const sat = Math.max(p[k], p[k + 1], p[k + 2]) - Math.min(p[k], p[k + 1], p[k + 2]);
      const val = 0.15 + 0.6 * Math.pow(v, 1.3) + 0.25 * Math.exp(-(cx * cx + cy * cy) * 9) + sat / 2550;
      const g = Math.max(0, Math.min(255, val * 255)); p[k] = p[k + 1] = p[k + 2] = g;
    }
    x.putImageData(d, 0, 0);
    const out = mk(src.width > 768 ? 768 : src.width, Math.round((src.width > 768 ? 768 : src.width) * src.height / src.width)); const ox = out.getContext('2d'); ox.filter = 'blur(6px)'; ox.drawImage(c, 0, 0, out.width, out.height);
    return out;
  }
  // grow the foreground a little and soften: background stretches instead of the subject tearing
  function cleanDepth(dc) {
    const w = dc.width, h = dc.height, x = dc.getContext('2d', { willReadFrequently: true });
    const id = x.getImageData(0, 0, w, h), p = id.data, a = new Float32Array(w * h), b = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = p[i * 4];
    let lo = 255, hi = 0; for (let i = 0; i < a.length; i += 7) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); }
    const R = Math.max(1, Math.round(w / 300));
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let m = 0; for (let k = -R; k <= R; k++) { const v = a[j * w + Math.min(w - 1, Math.max(0, i + k))]; if (v > m) m = v; } b[j * w + i] = m; }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let m = 0; for (let k = -R; k <= R; k++) { const v = b[Math.min(h - 1, Math.max(0, j + k)) * w + i]; if (v > m) m = v; } a[j * w + i] = m; }
    const span = Math.max(1, hi - lo);
    for (let i = 0; i < w * h; i++) { const v = (a[i] - lo) / span * 255; p[i * 4] = p[i * 4 + 1] = p[i * 4 + 2] = v; p[i * 4 + 3] = 255; }
    x.putImageData(id, 0, 0);
    const out = mk(w, h), ox = out.getContext('2d'); ox.filter = 'blur(' + Math.max(1, Math.round(w / 500)) + 'px)'; ox.drawImage(dc, 0, 0);
    return out;
  }
  async function depthOf(src, onStep) {
    const long = Math.max(src.width, src.height), s = Math.min(1, 768 / long);
    const small = mk(src.width * s, src.height * s); small.getContext('2d').drawImage(src, 0, 0, small.width, small.height);
    try {
      onStep && onStep('Calcolo la profondità 3D della scena (Depth Anything V2, sul tuo dispositivo)');
      const pipe = await loadDepth();
      const r = await pipe(small.toDataURL('image/jpeg', 0.92));
      const raw = r.depth.toCanvas(); const dc = mk(raw.width, raw.height); dc.getContext('2d').drawImage(raw, 0, 0);
      return { canvas: cleanDepth(dc), real: true };
    } catch (e) {
      console.warn('profondità neurale non disponibile, uso una stima', e);
      return { canvas: cleanDepth(heuristicDepth(small)), real: false };
    }
  }
  function focusOf(dc, mode) {
    const w = dc.width, h = dc.height, p = dc.getContext('2d', { willReadFrequently: true }).getImageData(Math.round(w * 0.3), Math.round(h * 0.25), Math.round(w * 0.4), Math.round(h * 0.5)).data;
    const v = []; for (let i = 0; i < p.length; i += 16) v.push(p[i] / 255);
    v.sort((a, b) => a - b);
    return v[Math.floor(v.length * (mode === 'near' ? 0.85 : 0.6))] || 0.6;
  }

  /* ================= WebGL 2.5D camera ================= */
  const VS = '#version 300 es\nin vec2 p;out vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const FS = `#version 300 es
precision highp float;
uniform sampler2D uImg,uDep;uniform vec2 uRes,uAR,uOff;uniform float uZoom,uDolly,uFocus,uDof,uTime,uGrain,uVig,uFlow,uSeed,uWarm;
in vec2 vUv;out vec4 o;
float D(vec2 u){return texture(uDep,u).r;}
vec2 proj(vec2 s,float h){float k=h-uFocus;vec2 c=s-.5-uOff*k;c/=uZoom*(1.+uDolly*k);return c*uAR+.5;}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){
  vec2 s=vUv;const int N=48;vec2 uv=proj(s,0.);float hd=0.;float ph=1.;vec2 pu=proj(s,1.);
  for(int i=0;i<=N;i++){float h=1.-float(i)/float(N);vec2 u=proj(s,h);
    if(D(u)>=h){float a=ph,b=h;vec2 ub=u;for(int j=0;j<6;j++){float m=(a+b)*.5;vec2 um=proj(s,m);if(D(um)>=m){b=m;ub=um;}else{a=m;}}uv=ub;hd=b;break;}
    ph=h;pu=u;}
  // far field drift (clouds, haze) — very subtle
  float far=smoothstep(.09,.0,hd)*smoothstep(.5,.8,uv.y);uv.x+=uFlow*far;
  uv=clamp(uv,vec2(.001),vec2(.999));
  vec3 col=texture(uImg,uv).rgb;
  // depth of field: disc taps weighted by depth similarity
  float r=uDof*abs(hd-uFocus);
  if(r>.35){vec3 acc=col;float wsum=1.;vec2 px=1./uRes*uAR/uZoom;
    for(int i=0;i<16;i++){float a=float(i)*2.39996;float rr=sqrt((float(i)+.5)/16.)*r;vec2 o2=vec2(cos(a),sin(a))*rr*px;vec2 u2=clamp(uv+o2,vec2(.001),vec2(.999));
      float w=1.-smoothstep(.0,.25,abs(D(u2)-hd));acc+=texture(uImg,u2).rgb*w;wsum+=w;}
    col=acc/wsum;}
  // film: gentle tone, warmth, vignette, grain
  col=mix(col,col*col*(3.-2.*col),.12);col.r*=1.+uWarm;col.b*=1.-uWarm*.8;
  vec2 q=s-.5;col*=1.-uVig*pow(length(q*vec2(uRes.x/uRes.y,1.))*1.15,2.4);
  float g=hash(s*uRes+fract(uTime*7.13+uSeed)*311.)-.5;float l=dot(col,vec3(.299,.587,.114));col+=g*uGrain*(.55+.45*(1.-abs(l-.5)*2.));
  o=vec4(clamp(col,0.,1.),1.);
}`;
  function makeGL(w, h) {
    const cv = mk(w, h);
    const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (!gl) return null;
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['uImg', 'uDep', 'uRes', 'uAR', 'uOff', 'uZoom', 'uDolly', 'uFocus', 'uDof', 'uTime', 'uGrain', 'uVig', 'uFlow', 'uSeed', 'uWarm'].forEach((n) => { U[n] = gl.getUniformLocation(pr, n); });
    gl.uniform1i(U.uImg, 0); gl.uniform1i(U.uDep, 1); gl.uniform2f(U.uRes, w, h); gl.viewport(0, 0, w, h);
    const tex = (src) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    return {
      canvas: cv,
      shot(img, dep) { return { img: tex(img), dep: tex(dep), ar: img.width / img.height }; },
      draw(S, u) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.img); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, S.dep);
        const va = w / h, ia = S.ar; // cover crop
        gl.uniform2f(U.uAR, va > ia ? 1 : va / ia, va > ia ? ia / va : 1);
        gl.uniform2f(U.uOff, u.ox, u.oy); gl.uniform1f(U.uZoom, u.zoom); gl.uniform1f(U.uDolly, u.dolly); gl.uniform1f(U.uFocus, u.focus); gl.uniform1f(U.uDof, u.dof);
        gl.uniform1f(U.uTime, u.time); gl.uniform1f(U.uGrain, u.grain); gl.uniform1f(U.uVig, u.vig); gl.uniform1f(U.uFlow, u.flow); gl.uniform1f(U.uSeed, u.seed); gl.uniform1f(U.uWarm, u.warm || 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      free(S) { gl.deleteTexture(S.img); gl.deleteTexture(S.dep); }
    };
  }

  /* camera language: every move is a slow, eased, physically plausible path */
  const MOVES = {
    dolly_in: (t, m) => ({ ox: 0, oy: 0.006 * m * t, zoom: lerp(1.05, 1.1 + 0.06 * m, t), dolly: lerp(0, 0.38 * m, t) }),
    dolly_out: (t, m) => ({ ox: 0, oy: 0.006 * m * (1 - t), zoom: lerp(1.1 + 0.06 * m, 1.05, t), dolly: lerp(0.38 * m, 0, t) }),
    truck_left: (t, m) => ({ ox: lerp(0.045, -0.045, t) * m, oy: 0, zoom: 1.08 + 0.02 * m, dolly: 0.05 }),
    truck_right: (t, m) => ({ ox: lerp(-0.045, 0.045, t) * m, oy: 0, zoom: 1.08 + 0.02 * m, dolly: 0.05 }),
    crane_up: (t, m) => ({ ox: 0, oy: lerp(-0.04, 0.035, t) * m, zoom: 1.08 + 0.02 * m, dolly: lerp(0, 0.12, t) * m }),
    crane_down: (t, m) => ({ ox: 0, oy: lerp(0.035, -0.04, t) * m, zoom: 1.08 + 0.02 * m, dolly: lerp(0.12, 0, t) * m }),
    orbit_left: (t, m) => ({ ox: lerp(0.05, -0.05, t) * m, oy: 0.008 * m * Math.sin(Math.PI * t), zoom: 1.1, dolly: 0.12 * m * Math.sin(Math.PI * t) }),
    orbit_right: (t, m) => ({ ox: lerp(-0.05, 0.05, t) * m, oy: 0.008 * m * Math.sin(Math.PI * t), zoom: 1.1, dolly: 0.12 * m * Math.sin(Math.PI * t) }),
    push_in: (t, m) => ({ ox: 0, oy: 0, zoom: lerp(1.05, 1.16 + 0.08 * m, t), dolly: 0.04 }),
    static: () => ({ ox: 0, oy: 0, zoom: 1.07, dolly: 0.02 })
  };
  const CAM_ORDER = ['dolly_in', 'truck_right', 'orbit_left', 'crane_up', 'dolly_out', 'truck_left', 'orbit_right', 'push_in'];

  /* ================= soundscape ================= */
  const AMB = {
    rain: /\b(pioggi|piov|rain|drizzl|temporal|storm|tempest|acquazzon|umid|wet)/i,
    thunder: /\b(tuon|thunder|temporal|storm|tempest|fulmin|lightning)/i,
    ocean: /\b(mare|ocean|sea|beach|spiaggi|onde|wave|surf|costa|coast|scogli|faro|lighthouse|porto|harbor|harbour)/i,
    wind: /\b(vento|wind|montagn|mountain|desert|desert|vetta|peak|cliff|scogliera|neve|snow|inverno|winter|tundra|prateria|plain|ghiacc)/i,
    forest: /\b(forest|bosco|foresta|giungla|jungle|alberi|trees|parco|park|giardin|garden|prato|meadow|campagna|countryside|uccell|bird|primavera|spring|valle|valley)/i,
    city: /\b(città|citta|city|strad|street|traffic|traffico|metropol|downtown|avenue|new york|tokyo|roma|milano|napoli|london|paris|incrocio|crossroad|taxi|auto|car)\b/i,
    crowd: /\b(folla|crowd|mercat|market|stadio|stadium|piazza|square|festa|party|concert|fiera|fair|bazar|bazaar|ristorante|restaurant|bar|caff[eè]|cafe|pub)/i,
    fire: /\b(fuoco|fire|camino|fireplace|falò|falo|campfire|bonfire|brace|ember|candel|candle)/i,
    river: /\b(fium|river|ruscell|stream|torrent|cascat|waterfall|fontan|fountain|lago|lake|creek)/i,
    night: /\b(nott|night|sera|evening|stell|stars|luna|moon|crepuscol|dusk)/i,
    room: /\b(stanza|room|cucina|kitchen|ufficio|office|interno|interior|studio|biblioteca|library|casa|home|salotto|living)/i
  };
  function pickAmbience(text, explicit) {
    const want = new Set();
    String(explicit || '').toLowerCase().split(/[\s,;+]+/).forEach((k) => { const map = { pioggia: 'rain', temporale: 'thunder', mare: 'ocean', onde: 'ocean', vento: 'wind', bosco: 'forest', foresta: 'forest', uccelli: 'forest', birds: 'forest', città: 'city', traffico: 'city', folla: 'crowd', fuoco: 'fire', camino: 'fire', fiume: 'river', ruscello: 'river', grilli: 'night', crickets: 'night', notte: 'night', stanza: 'room', interno: 'room', storm: 'thunder', sea: 'ocean', waves: 'ocean', traffic: 'city', street: 'city', campfire: 'fire', stream: 'river' }; const v = AMB[k] ? k : map[k]; if (v) want.add(v); });
    if (!want.size) Object.keys(AMB).forEach((k) => { if (AMB[k].test(text)) want.add(k); });
    if (want.has('thunder')) want.add('rain');
    if (want.has('night') && (want.has('city') || want.has('room') || want.has('crowd'))) want.delete('night');
    if (['ocean', 'wind', 'forest', 'city', 'river', 'rain'].some((k) => want.has(k))) want.delete('room');
    if (!want.size) want.add(/\b(nott|night)/i.test(text) ? 'night' : 'wind');
    return [...want].slice(0, 4);
  }
  function noiseBuf(ctx, kind, secs, R) {
    const n = Math.ceil(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < n; i++) {
        const w = R() * 2 - 1;
        if (kind === 'pink') { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
        else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else d[i] = w;
      }
    }
    return b;
  }
  function loopSrc(ctx, buf, dest, gain) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const g = ctx.createGain(); g.gain.value = gain; s.connect(g); g.connect(dest); s.start(0, Math.random() * buf.duration); return g; }
  function filt(ctx, type, f, q) { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q != null) x.Q.value = q; return x; }
  function panner(ctx, v) { const p = ctx.createStereoPanner(); p.pan.value = v; return p; }
  const LAYERS = {
    rain(ctx, out, dur, R, N) {
      const hiss = filt(ctx, 'bandpass', 3800, 0.6); hiss.connect(out); loopSrc(ctx, N.pink, hiss, 0.55);
      const body = filt(ctx, 'lowpass', 900, 0.5); body.connect(out); loopSrc(ctx, N.brown, body, 0.35);
      // individual drops on nearby surfaces
      for (let t = 0; t < dur; t += 0.012 + R() * 0.05) {
        const s = ctx.createBufferSource(); s.buffer = N.white; const f = filt(ctx, 'bandpass', 1800 + R() * 5200, 4 + R() * 8); const g = ctx.createGain(); const p = panner(ctx, R() * 2 - 1);
        const a = 0.02 + R() * R() * 0.18; g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012 + R() * 0.03);
        s.connect(f); f.connect(g); g.connect(p); p.connect(out); s.start(t, R() * 0.9, 0.06);
      }
    },
    thunder(ctx, out, dur, R, N) {
      for (let t = 2 + R() * 4; t < dur - 1; t += 7 + R() * 9) {
        const s = ctx.createBufferSource(); s.buffer = N.brown; const f = filt(ctx, 'lowpass', 160 + R() * 160, 0.7); const g = ctx.createGain(); const len = 3 + R() * 4;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 + R() * 0.6, t + 0.08 + R() * 0.25); g.gain.setTargetAtTime(0.0001, t + 0.4, len / 3);
        f.frequency.setTargetAtTime(70, t + 0.3, 1.2);
        s.connect(f); f.connect(g); g.connect(out); s.start(t, R() * 0.5, len + 2);
      }
    },
    ocean(ctx, out, dur, R, N) {
      const f = filt(ctx, 'lowpass', 700, 0.4), g = loopSrc(ctx, N.brown, f, 0.0); f.connect(out);
      const hiss = filt(ctx, 'highpass', 1800, 0.3), hg = loopSrc(ctx, N.pink, hiss, 0.0); hiss.connect(out);
      let t = 0;
      while (t < dur + 2) {
        const period = 5.5 + R() * 4, peak = 0.55 + R() * 0.45;
        g.gain.setValueAtTime(0.12, t); g.gain.linearRampToValueAtTime(peak, t + period * 0.42); g.gain.linearRampToValueAtTime(0.18, t + period);
        hg.gain.setValueAtTime(0.02, t + period * 0.3); hg.gain.linearRampToValueAtTime(0.32 * peak, t + period * 0.5); hg.gain.linearRampToValueAtTime(0.03, t + period * 0.95);
        f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(1100, t + period * 0.45); f.frequency.linearRampToValueAtTime(420, t + period);
        t += period;
      }
    },
    wind(ctx, out, dur, R, N) {
      const f = filt(ctx, 'bandpass', 420, 0.9), g = loopSrc(ctx, N.pink, f, 0.4); f.connect(out);
      const f2 = filt(ctx, 'lowpass', 260, 0.5); f2.connect(out); loopSrc(ctx, N.brown, f2, 0.25);
      for (let t = 0; t < dur + 2; t += 2 + R() * 3) { f.frequency.linearRampToValueAtTime(260 + R() * 700, t); g.gain.linearRampToValueAtTime(0.15 + R() * 0.55, t); f.Q.linearRampToValueAtTime(0.6 + R() * 2.2, t); }
    },
    forest(ctx, out, dur, R, N) {
      const leaves = filt(ctx, 'bandpass', 2500, 0.5), lg = loopSrc(ctx, N.pink, leaves, 0.1); leaves.connect(out);
      for (let t = 0; t < dur + 2; t += 1.5 + R() * 2) lg.gain.linearRampToValueAtTime(0.05 + R() * 0.12, t);
      // songbirds: short frequency-modulated phrases at varied distances
      const species = Array.from({ length: 3 }, () => ({ base: 2600 + R() * 2600, span: 600 + R() * 1800, notes: 2 + Math.floor(R() * 5), len: 0.05 + R() * 0.12, pan: R() * 2 - 1, gap: 2 + R() * 5, vol: 0.05 + R() * 0.09 }));
      species.forEach((sp) => {
        for (let t = R() * 3; t < dur - 0.5; t += sp.gap * (0.6 + R() * 0.9)) {
          let tt = t; const p = panner(ctx, sp.pan); const lp = filt(ctx, 'lowpass', 9000 - R() * 3000); p.connect(lp); lp.connect(out);
          for (let k = 0; k < sp.notes; k++) {
            const o = ctx.createOscillator(); const g = ctx.createGain(); const f0 = sp.base + (R() - 0.5) * sp.span;
            o.frequency.setValueAtTime(f0, tt); o.frequency.exponentialRampToValueAtTime(Math.max(800, f0 + (R() - 0.4) * sp.span), tt + sp.len);
            const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 25 + R() * 40; vg.gain.value = 80 + R() * 200; vib.connect(vg); vg.connect(o.frequency);
            g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(sp.vol, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + sp.len);
            o.connect(g); g.connect(p); o.start(tt); o.stop(tt + sp.len + 0.02); vib.start(tt); vib.stop(tt + sp.len + 0.02);
            tt += sp.len + 0.02 + R() * 0.08;
          }
        }
      });
    },
    city(ctx, out, dur, R, N) {
      const rumble = filt(ctx, 'lowpass', 240, 0.6); rumble.connect(out); loopSrc(ctx, N.brown, rumble, 0.55);
      const far = filt(ctx, 'bandpass', 900, 0.4); far.connect(out); loopSrc(ctx, N.pink, far, 0.08);
      for (let t = R() * 2; t < dur; t += 2.2 + R() * 4) { // passing cars: a swept, panned tyre/engine noise
        const s = ctx.createBufferSource(); s.buffer = N.pink; const f = filt(ctx, 'bandpass', 500, 1.2); const g = ctx.createGain(); const p = ctx.createStereoPanner(); const len = 2.5 + R() * 2.5, dir = R() < 0.5 ? -1 : 1;
        p.pan.setValueAtTime(-0.95 * dir, t); p.pan.linearRampToValueAtTime(0.95 * dir, t + len);
        f.frequency.setValueAtTime(380 + R() * 200, t); f.frequency.linearRampToValueAtTime(900 + R() * 400, t + len / 2); f.frequency.linearRampToValueAtTime(320, t + len);
        const peak = 0.25 + R() * 0.45; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + len / 2); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        s.connect(f); f.connect(g); g.connect(p); p.connect(out); s.start(t, R() * 0.5, len + 0.1);
      }
      for (let t = 3 + R() * 8; t < dur - 1; t += 9 + R() * 12) { // a distant horn
        [349, 440].forEach((fr) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr * (0.97 + R() * 0.06); const g = ctx.createGain(); const lp = filt(ctx, 'lowpass', 1400); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.03); g.gain.setValueAtTime(0.03, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(lp); lp.connect(g); g.connect(panner(ctx, R() * 1.6 - 0.8)).connect(out); o.start(t); o.stop(t + 0.55); });
      }
    },
    crowd(ctx, out, dur, R, N) {
      // many talkers: noise through moving vowel formants, each with its own rhythm
      for (let v = 0; v < 9; v++) {
        const s = ctx.createBufferSource(); s.buffer = N.pink; s.loop = true;
        const f1 = filt(ctx, 'bandpass', 500, 6), f2 = filt(ctx, 'bandpass', 1500, 7), g = ctx.createGain(), p = panner(ctx, R() * 2 - 1), mix = ctx.createGain(); mix.gain.value = 0.18;
        s.connect(f1); s.connect(f2); f1.connect(g); f2.connect(g); g.connect(mix); mix.connect(p); p.connect(out);
        for (let t = 0; t < dur + 1; t += 0.12 + R() * 0.2) { f1.frequency.linearRampToValueAtTime(300 + R() * 600, t); f2.frequency.linearRampToValueAtTime(900 + R() * 1600, t); g.gain.linearRampToValueAtTime(R() < 0.25 ? 0.01 : 0.2 + R() * 0.6, t); }
        s.start(0, R());
      }
    },
    fire(ctx, out, dur, R, N) {
      const roar = filt(ctx, 'lowpass', 380, 0.5); roar.connect(out); const rg = loopSrc(ctx, N.brown, roar, 0.5);
      for (let t = 0; t < dur + 1; t += 0.4 + R() * 0.6) rg.gain.linearRampToValueAtTime(0.3 + R() * 0.4, t);
      for (let t = 0; t < dur; t += 0.03 + R() * R() * 0.35) {
        const s = ctx.createBufferSource(); s.buffer = N.white; const f = filt(ctx, 'highpass', 1200 + R() * 3000); const g = ctx.createGain(); const a = 0.05 + R() * R() * 0.5;
        g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.004 + R() * 0.02);
        s.connect(f); f.connect(g); g.connect(panner(ctx, R() * 0.8 - 0.4)).connect(out); s.start(t, R() * 0.9, 0.04);
      }
    },
    river(ctx, out, dur, R, N) {
      const f = filt(ctx, 'bandpass', 1200, 0.5), g = loopSrc(ctx, N.pink, f, 0.45); f.connect(out);
      const low = filt(ctx, 'lowpass', 500); low.connect(out); loopSrc(ctx, N.brown, low, 0.3);
      for (let t = 0; t < dur + 1; t += 0.05 + R() * 0.08) { f.frequency.linearRampToValueAtTime(700 + R() * 1600, t); g.gain.linearRampToValueAtTime(0.3 + R() * 0.25, t); }
      for (let t = 0; t < dur; t += 0.08 + R() * 0.3) { // bubbles
        const o = ctx.createOscillator(); const gg = ctx.createGain(); const f0 = 500 + R() * 1400; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * (1.6 + R()), t + 0.05);
        gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.02 + R() * 0.03, t + 0.005); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        o.connect(gg); gg.connect(panner(ctx, R() * 1.4 - 0.7)).connect(out); o.start(t); o.stop(t + 0.07);
      }
    },
    night(ctx, out, dur, R, N) {
      const air = filt(ctx, 'lowpass', 400); air.connect(out); loopSrc(ctx, N.brown, air, 0.12);
      for (let c = 0; c < 5; c++) { // crickets: pulsed high tones, each at its own rate and distance
        const f0 = 4200 + R() * 1400, rate = 0.5 + R() * 0.7, vol = 0.006 + R() * 0.02, p = panner(ctx, R() * 2 - 1); p.connect(out);
        for (let t = R(); t < dur; t += rate) {
          for (let k = 0; k < 3; k++) { const tt = t + k * 0.05; const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = f0; g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(vol, tt + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.035); o.connect(g); g.connect(p); o.start(tt); o.stop(tt + 0.04); }
        }
      }
    },
    room(ctx, out, dur, R, N) {
      const tone = filt(ctx, 'lowpass', 180); tone.connect(out); loopSrc(ctx, N.brown, tone, 0.18);
      const air = filt(ctx, 'bandpass', 600, 0.4); air.connect(out); loopSrc(ctx, N.pink, air, 0.025);
      const hum = ctx.createOscillator(); hum.frequency.value = 50; const hg = ctx.createGain(); hg.gain.value = 0.004; hum.connect(hg); hg.connect(out); hum.start();
    }
  };
  async function soundtrack({ duration, ambience, narration, music, seed, onStep }) {
    const SR = 48000, ctx = new OfflineAudioContext(2, Math.ceil(SR * duration), SR), R = rng(seed || 7);
    const master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ctx.destination);
    const amb = ctx.createGain(); amb.gain.value = 0.0; amb.connect(master);
    amb.gain.setValueAtTime(0, 0); amb.gain.linearRampToValueAtTime(0.85, Math.min(1.2, duration / 4)); amb.gain.setValueAtTime(0.85, Math.max(0, duration - 1.2)); amb.gain.linearRampToValueAtTime(0, duration);
    const N = { white: noiseBuf(ctx, 'white', 1, R), pink: noiseBuf(ctx, 'pink', 6, R), brown: noiseBuf(ctx, 'brown', 6, R) };
    ambience.forEach((k) => LAYERS[k] && LAYERS[k](ctx, amb, duration, R, N));
    let voiced = null;
    if (narration && B.voice && B.voice.synthesize) {
      try {
        onStep && onStep('Registro la voce narrante (voce naturale)');
        const v = await B.voice.synthesize(narration);
        const vb = ctx.createBuffer(1, v.samples.length, v.sampleRate); vb.copyToChannel(v.samples, 0);
        const s = ctx.createBufferSource(); s.buffer = vb; const vg = ctx.createGain(); vg.gain.value = 1.15; s.connect(vg); vg.connect(master);
        const t0 = 0.8; s.start(t0); voiced = [t0, t0 + vb.duration];
        // duck the ambience under the voice
        amb.gain.setValueAtTime(0.85, Math.max(0, t0 - 0.4)); amb.gain.linearRampToValueAtTime(0.38, t0); amb.gain.setValueAtTime(0.38, voiced[1]); amb.gain.linearRampToValueAtTime(0.85, Math.min(duration, voiced[1] + 0.8));
      } catch (e) { console.warn('narrazione non disponibile', e); }
    }
    if (music && music !== 'none' && B.music && B.music.MOODS[music]) {
      try {
        const mb = await B.music.render({ mood: music, duration, seed: seed || 7, sampleRate: SR });
        if (mb) { const s = ctx.createBufferSource(); s.buffer = mb; const g = ctx.createGain(); g.gain.value = voiced ? 0.22 : 0.42; s.connect(g); g.connect(master); s.start(0); }
      } catch (e) { /* ambience alone */ }
    }
    return { buffer: await ctx.startRendering(), voiced };
  }

  /* ================= atmosphere particles (2D, depth-placed) ================= */
  function particlesFor(amb, text) {
    if (amb.includes('rain')) return 'rain';
    if (/\b(neve|snow|nevica|snowing|blizzard)/i.test(text)) return 'snow';
    if (amb.includes('fire')) return 'embers';
    if (/\b(sole|sun|luce|light|polvere|dust|raggi|rays|interno|interior|stanza|room|chiesa|church|bosco|forest)/i.test(text)) return 'dust';
    return null;
  }
  function makeParticles(kind, W, H, R) {
    if (!kind) return null;
    const n = kind === 'rain' ? 260 : kind === 'snow' ? 180 : kind === 'embers' ? 60 : 70;
    const ps = Array.from({ length: n }, () => ({ x: R(), y: R(), z: R(), s: R(), ph: R() * 6.28 }));
    return function draw(ctx, t, cam, focus) {
      ctx.save();
      for (const p of ps) {
        const k = p.z - focus, px = cam.ox * k * W, py = -cam.oy * k * H, sz = (0.4 + p.z * 1.6) * Math.max(W, H) / 1080;
        if (kind === 'rain') {
          const sp = 1.6 + p.z * 1.6, y = ((p.y + t * sp) % 1) * (H + 80) - 40, x = ((p.x * W + px + t * 30 * p.z) % W + W) % W;
          ctx.strokeStyle = 'rgba(220,230,240,' + (0.05 + p.z * 0.16) + ')'; ctx.lineWidth = sz * 0.7; ctx.beginPath(); ctx.moveTo(x, y + py); ctx.lineTo(x - 3 * sz, y + py + 26 * sz); ctx.stroke();
        } else if (kind === 'snow') {
          const y = ((p.y + t * (0.05 + p.z * 0.08)) % 1) * H, x = ((p.x * W + px + Math.sin(t * 0.8 + p.ph) * 18 * sz) % W + W) % W;
          ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + p.z * 0.5) + ')'; ctx.beginPath(); ctx.arc(x, y + py, sz * 2.2, 0, 6.28); ctx.fill();
        } else if (kind === 'embers') {
          const y = H - ((p.y + t * (0.06 + p.z * 0.1)) % 1) * H, x = ((p.x * W + px + Math.sin(t * 1.4 + p.ph) * 22) % W + W) % W, fl = 0.5 + 0.5 * Math.sin(t * 9 + p.ph * 3);
          ctx.fillStyle = 'rgba(255,' + (140 + fl * 70 | 0) + ',60,' + (0.25 + fl * 0.5) * (0.4 + p.z * 0.6) + ')'; ctx.beginPath(); ctx.arc(x, y + py, sz * 1.4, 0, 6.28); ctx.fill();
        } else {
          const x = ((p.x * W + px + Math.sin(t * 0.25 + p.ph) * 30) % W + W) % W, y = ((p.y * H + py + Math.cos(t * 0.2 + p.ph) * 24 - t * 6 * p.z) % H + H) % H, tw = 0.5 + 0.5 * Math.sin(t * 1.3 + p.ph);
          ctx.fillStyle = 'rgba(255,244,220,' + (0.04 + tw * 0.16) * (0.3 + p.z) + ')'; ctx.beginPath(); ctx.arc(x, y, sz * (1 + p.s * 1.8), 0, 6.28); ctx.fill();
        }
      }
      ctx.restore();
    };
  }

  /* ================= render ================= */
  const SIZES = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };
  async function render(o) {
    const step = (label, status = 'run') => o.onStep && o.onStep({ label, status });
    const [W, H] = SIZES[o.aspect] || SIZES['16:9'];
    const text = [o.prompt, o.title, o.narration, ...(o.shots || []).map((s) => s.label)].filter(Boolean).join(' ');
    const ambience = pickAmbience(text, o.ambience);
    const motion = B.clamp(o.motion == null ? 0.7 : +o.motion, 0.1, 1);
    let total = B.clamp(+o.seconds || Math.max(6, 4 * o.shots.length), 3, 120);
    // the narration sets the minimum length
    let narr = o.narration ? String(o.narration).trim() : '';
    if (narr) total = Math.max(total, Math.min(120, 2 + narr.split(/\s+/).length / 2.6));
    const fps = o.fps || 24, xfade = o.shots.length > 1 ? 0.8 : 0;
    const per = (total + xfade * (o.shots.length - 1)) / o.shots.length;
    const gl = (() => { try { return makeGL(W, H); } catch (e) { console.warn(e); return null; } })();
    if (!gl) throw Object.assign(new Error('WebGL2 non disponibile'), { code: 'nogl' });
    const R = rng(o.seed || 11);
    const shots = [];
    for (let i = 0; i < o.shots.length; i++) {
      if (o.signal && o.signal.aborted) throw Object.assign(new Error('Interrotto'), { code: 'cancelled' });
      const src = o.shots[i].canvas;
      const d = await depthOf(src, i === 0 ? (l) => step(l) : null);
      const cam = MOVES[o.shots[i].camera] ? o.shots[i].camera : CAM_ORDER[i % CAM_ORDER.length];
      const portrait = /\b(ritratt|portrait|volto|face|primo piano|close-up|closeup)/i.test(o.shots[i].label || text);
      shots.push({ S: gl.shot(src, d.canvas), cam, focus: focusOf(d.canvas, portrait ? 'near' : 'mid'), rack: o.shots[i].camera === 'rack_focus' || (portrait && i === 0 && R() < 0.5), real: d.real, ph: [R() * 6.28, R() * 6.28, R() * 6.28] });
    }
    step(shots.some((s) => s.real) ? 'Profondità 3D pronta' : 'Profondità stimata (modello non raggiungibile)', 'done');
    step('Compongo il suono della scena: ' + ambience.map((a) => ({ rain: 'pioggia', thunder: 'tuoni', ocean: 'mare', wind: 'vento', forest: 'bosco e uccelli', city: 'città', crowd: 'voci', fire: 'fuoco', river: 'acqua corrente', night: 'notte e grilli', room: 'ambiente interno' }[a])).join(', '));
    const st = await soundtrack({ duration: total, ambience, narration: narr, music: o.music, seed: o.seed, onStep: (l) => step(l) });
    step('Suono pronto (stereo 48 kHz)', 'done');
    const pdraw = makeParticles(particlesFor(ambience, text), W, H, R);
    const warm = /\b(tramonto|sunset|golden|alba|sunrise|candel|fuoco|fire)/i.test(text) ? 0.035 : /\b(nott|night|pioggi|rain|inverno|winter|neve|snow)/i.test(text) ? -0.02 : 0.008;
    const camAt = (sh, u, t) => {
      const base = MOVES[sh.cam](smooth(B.clamp(u, 0, 1)), motion);
      const hand = 0.0016 * (0.6 + motion), ph = sh.ph; // handheld: layered slow sines
      base.ox += hand * (Math.sin(t * 0.9 + ph[0]) + 0.5 * Math.sin(t * 2.3 + ph[1]));
      base.oy += hand * (Math.sin(t * 0.7 + ph[1]) + 0.5 * Math.sin(t * 1.9 + ph[2]));
      return base;
    };
    const frame = (ctx, t) => {
      const fadeIn = B.clamp(t / 0.5, 0, 1), fadeOut = B.clamp((total - t) / 0.7, 0, 1);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < shots.length; i++) {
        const t0 = i * (per - xfade), t1 = t0 + per;
        if (t < t0 || t > t1) continue;
        const sh = shots[i], u = (t - t0) / per;
        const cam = camAt(sh, u, t);
        const focus = sh.rack ? lerp(sh.focus * 0.55, sh.focus, smooth(B.clamp((u - 0.15) / 0.5, 0, 1))) : sh.focus;
        gl.draw(sh.S, Object.assign(cam, { focus, dof: (W / 1080) * 9, time: t, grain: 0.045, vig: 0.22, flow: 0.012 * t / 10, seed: i * 0.37, warm }));
        let a = 1; if (xfade && i > 0 && t < t0 + xfade) a = (t - t0) / xfade;
        ctx.globalAlpha = a * Math.min(fadeIn, fadeOut); ctx.drawImage(gl.canvas, 0, 0); ctx.globalAlpha = 1;
        if (pdraw && a >= 1) pdraw(ctx, t, cam, focus);
      }
      if (o.title && t < 3.2) { ctx.save(); ctx.globalAlpha = B.clamp(Math.min(t / 0.6, (3.2 - t) / 0.6), 0, 1); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 18; ctx.font = '600 ' + Math.round(W / 22) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(o.title, W / 2, H * 0.86); ctx.restore(); }
    };
    step('Giro il video: ' + total.toFixed(0) + ' s, ' + fps + ' fps, ' + W + '×' + H);
    const res = await B.exportVideo({ w: W, h: H, fps, duration: total, audio: st.buffer, signal: o.signal, onProgress: (p) => o.onProgress && o.onProgress(p), draw: (ctx, t) => frame(ctx, t) });
    shots.forEach((s) => gl.free(s.S));
    step('Video pronto', 'done');
    return Object.assign(res, { seconds: total, w: W, h: H, ambience, narrated: !!st.voiced });
  }

  B.cinema = { render, depthOf, soundtrack, pickAmbience, MOVES: Object.keys(MOVES).concat('rack_focus'), SIZES };
})();
