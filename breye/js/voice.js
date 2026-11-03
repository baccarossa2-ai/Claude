/* Thorion voice — natural neural speech (Piper VITS voices) synthesized locally in the browser.
   Models are static files cached after the first download; no server, no key, no limits.
   Falls back to the best voice installed on the device when the neural engine can't load. */
(function () {
  'use strict';
  const B = window.B;
  const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
  const PH = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
  const PH_JS = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/dist/piper-DeOu3H9E.js';
  const ORT = 'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/';
  const CACHE = 'thorion-voice-v1';
  const VOICES = [
    { id: 'it_IT-paola-medium', name: 'Paola', desc: 'italiano, calda e naturale', lang: 'it', espeak: 'it', path: 'it/it_IT/paola/medium/', mb: 61 },
    { id: 'it_IT-serena-high', name: 'Serena HD', desc: 'italiano, alta definizione', lang: 'it', espeak: 'it', path: 'it/it_IT/serena/high/', mb: 109 },
    { id: 'it_IT-serena-medium', name: 'Serena', desc: 'italiano, chiara', lang: 'it', espeak: 'it', path: 'it/it_IT/serena/medium/', mb: 61 },
    { id: 'it_IT-riccardo-x_low', name: 'Riccardo', desc: 'italiano, voce maschile leggera', lang: 'it', espeak: 'it', path: 'it/it_IT/riccardo/x_low/', mb: 27 },
    { id: 'en_US-hfc_female-medium', name: 'Emma', desc: 'English (US)', lang: 'en', espeak: 'en-us', path: 'en/en_US/hfc_female/medium/', mb: 60 },
    { id: 'en_US-ryan-high', name: 'Ryan HD', desc: 'English (US), male', lang: 'en', espeak: 'en-us', path: 'en/en_US/ryan/high/', mb: 115 },
    { id: 'en_GB-alan-medium', name: 'Alan', desc: 'English (UK), male', lang: 'en', espeak: 'en-gb-x-rp', path: 'en/en_GB/alan/medium/', mb: 61 },
    { id: 'es_ES-davefx-medium', name: 'Davefx', desc: 'español, voz masculina', lang: 'es', espeak: 'es', path: 'es/es_ES/davefx/medium/', mb: 61 },
    { id: 'fr_FR-siwis-medium', name: 'Siwis', desc: 'français, voix féminine', lang: 'fr', espeak: 'fr', path: 'fr/fr_FR/siwis/medium/', mb: 61 },
    { id: 'de_DE-thorsten-medium', name: 'Thorsten', desc: 'Deutsch, männlich', lang: 'de', espeak: 'de', path: 'de/de_DE/thorsten/medium/', mb: 61 }
  ];
  const byId = (id) => VOICES.find((v) => v.id === id);
  const pref = { it: B.ls.get('voice:it', 'it_IT-paola-medium'), en: B.ls.get('voice:en', 'en_US-hfc_female-medium') };

  /* ---- text: what a person would read aloud ---- */
  const ABBR = [[/\becc\./gi, 'eccetera'], [/\bes\./gi, 'ad esempio'], [/\bpag\./gi, 'pagina'], [/\bsig\.ra\b/gi, 'signora'], [/\bsig\./gi, 'signor'], [/\bdott\./gi, 'dottor'], [/\bn\.\s?(\d)/gi, 'numero $1'], [/\be\.g\./gi, 'for example'], [/\bi\.e\./gi, 'that is'], [/\betc\./gi, 'etcetera']];
  function clean(md) {
    let t = String(md || '');
    t = t.replace(/```[\s\S]*?```/g, (m) => (/^```\s*(html|js|javascript|css|python|py|ts|json|bash|sh|sql|java|c|cpp|xml|svg)?\s*\n/i.test(m) ? ' (codice) ' : ' '));
    t = t.replace(/`([^`]+)`/g, '$1').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, ' ');
    t = t.replace(/<[^>]+>/g, ' ').replace(/^\s{0,3}#{1,6}\s*/gm, '').replace(/^\s*[-*+•]\s+/gm, '').replace(/^\s*\d+[.)]\s+/gm, (m) => m.trim().replace(/[.)]$/, ',') + ' ');
    t = t.replace(/\|/g, ', ').replace(/^[\s:-]{3,}$/gm, '').replace(/[*_~#>]+/g, '').replace(/\p{Extended_Pictographic}|️|‍/gu, '');
    t = t.replace(/(\d)\s?%/g, '$1 per cento').replace(/€\s?(\d[\d.,]*)/g, '$1 euro').replace(/(\d[\d.,]*)\s?€/g, '$1 euro').replace(/\$\s?(\d[\d.,]*)/g, '$1 dollari').replace(/\s*→\s*/g, ', poi ').replace(/\s*[—–]\s*/g, ', ');
    ABBR.forEach(([re, s]) => { t = t.replace(re, s); });
    return t.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '.\n').trim();
  }
  const IT = /\b(il|lo|la|gli|le|di|che|non|per|una|sono|della|questo|anche|come|più|perché|ciao|grazie|è)\b/gi;
  const EN = /\b(the|and|is|are|you|with|this|that|for|not|of|to|what|hello|thanks|it's)\b/gi;
  const detect = (t) => ((t.match(EN) || []).length > (t.match(IT) || []).length * 1.3 ? 'en' : 'it');
  function sentences(text) {
    const out = [];
    text.split(/\n+/).forEach((para) => {
      const parts = para.match(/[^.!?;:]+[.!?;:]+["»”’)]*|[^.!?;:]+$/g) || [];
      let buf = '';
      parts.forEach((p) => {
        p = p.trim(); if (!p) return;
        if ((buf + ' ' + p).length < 60) { buf = (buf + ' ' + p).trim(); return; }
        if (buf) out.push(buf);
        buf = p;
        while (buf.length > 260) { const cut = Math.max(buf.lastIndexOf(',', 240), buf.lastIndexOf(' ', 240)); out.push(buf.slice(0, cut + 1).trim()); buf = buf.slice(cut + 1).trim(); }
      });
      if (buf) out.push(buf);
    });
    return out.filter((s) => /[\p{L}\d]/u.test(s));
  }

  /* ---- neural engine: phonemes (espeak-ng wasm) -> VITS (onnxruntime-web in a worker) ---- */
  let phMod = null, worker = null, wSeq = 0;
  const wWait = new Map(), sessions = new Map(), configs = new Map();
  let neuralBroken = false;
  async function phonemize(lines, espeak) {
    phMod = phMod || (await import(PH_JS));
    const ids = [];
    const m = await phMod.createPiperPhonemize({
      print: (l) => { try { ids.push(JSON.parse(l).phoneme_ids); } catch (e) { /* not ours */ } },
      printErr: () => {},
      locateFile: (f) => (f.endsWith('.wasm') ? PH + '.wasm' : f.endsWith('.data') ? PH + '.data' : f)
    });
    m.callMain(['-l', espeak, '--input', JSON.stringify(lines.map((text) => ({ text }))), '--espeak_data', '/espeak-ng-data']);
    if (ids.length !== lines.length) throw new Error('fonemi incompleti');
    return ids;
  }
  function startWorker() {
    if (worker) return worker;
    const src = "importScripts('" + ORT + "ort.min.js');ort.env.wasm.wasmPaths='" + ORT + "';ort.env.wasm.numThreads=1;const S={};" +
      "onmessage=async(e)=>{const d=e.data;try{if(d.t==='load'){if(!S[d.v])S[d.v]=await ort.InferenceSession.create(d.buf);postMessage({r:d.r,ok:1});}" +
      "else{const s=S[d.v];const ids=BigInt64Array.from(d.ids.map(BigInt));const f={input:new ort.Tensor('int64',ids,[1,ids.length]),input_lengths:new ort.Tensor('int64',BigInt64Array.from([BigInt(ids.length)]),[1]),scales:new ort.Tensor('float32',Float32Array.from(d.sc),[3])};" +
      "if(d.sid!=null)f.sid=new ort.Tensor('int64',BigInt64Array.from([BigInt(d.sid)]),[1]);const o=await s.run(f);const a=new Float32Array(o.output.data);postMessage({r:d.r,ok:1,a},[a.buffer]);}}" +
      "catch(err){postMessage({r:d.r,ok:0,e:String(err&&err.message||err)});}};";
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = (e) => { const w = wWait.get(e.data.r); if (!w) return; wWait.delete(e.data.r); if (e.data.ok) w.res(e.data); else w.rej(new Error(e.data.e)); };
    worker.onerror = (e) => { wWait.forEach((w) => w.rej(new Error('worker'))); wWait.clear(); worker = null; neuralBroken = true; e.preventDefault && e.preventDefault(); };
    return worker;
  }
  const ask = (msg, transfer) => new Promise((res, rej) => { const r = ++wSeq; wWait.set(r, { res, rej }); startWorker().postMessage(Object.assign({ r }, msg), transfer || []); });

  async function fetchCached(url, onProgress) {
    let cache = null;
    try { cache = await caches.open(CACHE); const hit = await cache.match(url); if (hit) return await hit.arrayBuffer(); } catch (e) { cache = null; }
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const total = +(r.headers.get('content-length') || 0);
    let buf;
    if (r.body && total && onProgress) {
      const rd = r.body.getReader(), parts = []; let got = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onProgress(got / total); }
      buf = await new Blob(parts).arrayBuffer();
    } else buf = await r.arrayBuffer();
    if (cache) cache.put(url, new Response(buf.slice(0), { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {});
    return buf;
  }
  async function isCached(v) { try { const c = await caches.open(CACHE); return !!(await c.match(HF + v.path + v.id + '.onnx')); } catch (e) { return false; } }
  const loading = new Map();
  function loadVoice(v) {
    if (sessions.has(v.id)) return Promise.resolve();
    if (loading.has(v.id)) return loading.get(v.id);
    const p = (async () => {
      const cfgP = fetchCached(HF + v.path + v.id + '.onnx.json').then((b) => JSON.parse(new TextDecoder().decode(b))).catch(() => null);
      let note = null;
      if (!(await isCached(v))) note = progressToast('Scarico la voce naturale ' + v.name + ' (' + v.mb + ' MB, solo la prima volta)…');
      try {
        const buf = await fetchCached(HF + v.path + v.id + '.onnx', note && note.set);
        const cfg = (await cfgP) || {};
        configs.set(v.id, { sr: (cfg.audio && cfg.audio.sample_rate) || (/x_low/.test(v.id) ? 16000 : 22050), sc: [(cfg.inference && cfg.inference.noise_scale) || 0.667, (cfg.inference && cfg.inference.length_scale) || 1, (cfg.inference && cfg.inference.noise_w) || 0.8], multi: cfg.num_speakers > 1 });
        await ask({ t: 'load', v: v.id, buf }, [buf]);
        sessions.set(v.id, true);
        if (note) note.done('Voce ' + v.name + ' pronta');
      } catch (e) { if (note) note.fail(); throw e; }
    })();
    loading.set(v.id, p);
    p.catch(() => loading.delete(v.id));
    return p;
  }
  function progressToast(msg) {
    const kill = B.toast(msg, { ms: 600000, icon: 'Volume2' });
    const tx = B.$('#toasts') && B.$('#toasts').lastElementChild && B.$('#toasts').lastElementChild.querySelector('.t-tx');
    let last = -1;
    return {
      set: (f) => { const pc = Math.floor(f * 100); if (tx && pc !== last) { last = pc; tx.textContent = msg + ' ' + pc + '%'; } },
      done: (m) => { kill(); B.toast(m, { type: 'ok', icon: 'Volume2' }); },
      fail: () => kill()
    };
  }
  async function synthLines(lines, v, onPart) {
    await loadVoice(v);
    const cfg = configs.get(v.id);
    const ids = await phonemize(lines, v.espeak);
    const parts = [];
    for (let i = 0; i < ids.length; i++) {
      if (playToken.stopped && onPart) break;
      const r = await ask({ t: 'run', v: v.id, ids: ids[i], sc: cfg.sc, sid: cfg.multi ? 0 : null });
      parts.push(r.a);
      if (onPart) onPart(r.a, cfg.sr, i);
    }
    return { parts, sr: cfg.sr };
  }

  /* ---- playback ---- */
  let ac = null, playToken = { stopped: true }, srcNodes = [], sysActive = false;
  function voiceFor(lang, id) { return byId(id) || byId(pref[lang]) || VOICES.find((v) => v.lang === lang) || VOICES[0]; }
  async function speakNeural(lines, v, token) {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') await ac.resume().catch(() => {});
    let at = ac.currentTime + 0.05, lastEnd = Promise.resolve();
    await synthLines(lines, v, (samples, sr, i) => {
      if (token.stopped) return;
      const buf = ac.createBuffer(1, samples.length, sr); buf.copyToChannel(samples, 0);
      const s = ac.createBufferSource(); s.buffer = buf; s.connect(ac.destination);
      at = Math.max(at, ac.currentTime + 0.02); s.start(at); srcNodes.push(s);
      at += buf.duration + (/[.!?]$/.test(lines[i]) ? 0.28 : 0.16);
      lastEnd = new Promise((res) => { s.onended = res; });
    });
    await lastEnd;
  }
  function bestSystemVoice(lang) {
    const all = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    const mine = all.filter((x) => x.lang && x.lang.toLowerCase().startsWith(lang));
    const score = (x) => (/natural|neural/i.test(x.name) ? 50 : 0) + (/online|premium|enhanced|plus/i.test(x.name) ? 25 : 0) + (/google/i.test(x.name) ? 20 : 0) + (/siri|elsa|isabella|diego|giuseppe|alice|federica|luca|aria|jenny|guy|samantha|daniel/i.test(x.name) ? 15 : 0) - (/espeak|compact|robot|novelty|eloquence|zarvox|trinoids|whisper|bells|bad news|boing|bubbles|cellos|albert|fred|junior|ralph|kathy/i.test(x.name) ? 60 : 0) + (x.localService ? 0 : 3) + (x.default ? 2 : 0);
    return mine.sort((a, b) => score(b) - score(a))[0] || null;
  }
  function speakSystem(lines, lang, token, opts) {
    if (!('speechSynthesis' in window)) return Promise.reject(Object.assign(new Error('Sintesi vocale non disponibile in questo browser'), { userMessage: 'Sintesi vocale non disponibile in questo browser' }));
    const v = bestSystemVoice(lang);
    sysActive = true;
    return new Promise((res) => {
      let i = 0;
      const next = () => {
        if (token.stopped || i >= lines.length) { sysActive = false; return res(); }
        const u = new SpeechSynthesisUtterance(lines[i++]);
        if (v) u.voice = v; u.lang = v ? v.lang : lang === 'en' ? 'en-US' : 'it-IT';
        u.rate = (opts && opts.rate) || 1; u.pitch = (opts && opts.pitch) || 1;
        u.onend = next; u.onerror = next;
        speechSynthesis.speak(u);
      };
      next();
    });
  }
  function stop() {
    playToken.stopped = true;
    srcNodes.forEach((s) => { try { s.stop(); } catch (e) { /* already done */ } }); srcNodes = [];
    if (sysActive && window.speechSynthesis) speechSynthesis.cancel();
    sysActive = false;
  }
  const canNeural = () => !neuralBroken && typeof Worker === 'function' && typeof WebAssembly === 'object' && !!window.fetch;

  B.voice = {
    list: VOICES,
    voices: () => VOICES.slice(),
    current: (lang) => voiceFor(lang || 'it'),
    setVoice(id) { const v = byId(id); if (!v) return; pref[v.lang] = id; B.ls.set('voice:' + v.lang, id); loadVoice(v).catch(() => {}); },
    speaking: () => !playToken.stopped,
    stop,
    clean,
    async ready() { if (!canNeural()) return false; try { await loadVoice(voiceFor('it')); return true; } catch (e) { return false; } },
    async speak(text, opts = {}) {
      stop();
      const token = (playToken = { stopped: false });
      const clean1 = clean(text).slice(0, opts.max || 12000);
      const lang = opts.lang || detect(clean1);
      const lines = sentences(clean1);
      if (!lines.length) { token.stopped = true; return; }
      try {
        if (opts.system === true || (opts.system == null && B.ls.get('voice:sys', false)) || !canNeural()) throw new Error('system');
        await speakNeural(lines, voiceFor(lang, opts.voice), token);
      } catch (e) {
        if (token.stopped) return;
        if (e.message !== 'system') { neuralBroken = neuralBroken || /worker|Failed to fetch|NetworkError|HTTP|import|script|CSP|Refused/i.test(String(e.message)); console.warn('voce neurale non disponibile', e); }
        await speakSystem(lines, lang, token, opts);
      } finally { if (playToken === token) token.stopped = true; }
    },
    async synthesize(text, opts = {}) {
      if (!canNeural()) throw new Error('voce neurale non disponibile');
      const c = clean(text); const lang = opts.lang || detect(c);
      const lines = sentences(c);
      if (!lines.length) throw new Error('testo vuoto');
      const v = voiceFor(lang, opts.voice);
      const { parts, sr } = await synthLines(lines, v);
      const gap = Math.round(sr * 0.25), n = parts.reduce((s, p) => s + p.length + gap, 0);
      const samples = new Float32Array(n); let o = 0;
      parts.forEach((p) => { samples.set(p, o); o += p.length + gap; });
      return { samples, sampleRate: sr, voice: v.id };
    }
  };
})();
