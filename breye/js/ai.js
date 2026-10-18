/* Iris — the Breye AI engine.
   Text, code and vision: Claude (inside claude.ai, no key) or the open Pollinations gateway (public web, no key).
   Images: photoreal (Pollinations Flux / Hugging Face Z-Image), vector (SVG written by the language model),
   procedural (GLSL shaders written by the language model, rendered on the GPU). Video: see motion.js. */
(function () {
  'use strict';
  const B = window.B;
  const HF = 'Huggingface GPU';
  const WEB_TEXT = 'https://text.pollinations.ai/openai';
  const WEB_IMG = 'https://image.pollinations.ai/prompt/';

  const ai = (B.ai = {
    engines: { claude: false, hf: false, web: false, vision: false, tools: false },
    ready: null,
    busy: 0,
    persona: 'Sei Iris, l’intelligenza artificiale di Breye Studio, uno studio creativo tutto-in-uno (design grafico, fotoritocco, montaggio video, generazione di immagini e video, codice, documenti e PDF). Rispondi nella lingua dell’utente (di default in italiano), con tono caldo, preciso e professionale. Usa Markdown quando aiuta: titoli brevi, elenchi, tabelle e blocchi di codice con il linguaggio indicato. Quando scrivi codice, scrivilo completo e funzionante. Non inventare fatti: se non sei sicuro, dillo.'
  });

  let sample = null, mcp = null;

  function setBusy(d) {
    ai.busy = Math.max(0, ai.busy + d);
    B.emit('ai:busy', ai.busy);
  }

  ai.init = function () {
    if (ai.ready) return ai.ready;
    ai.ready = (async () => {
      const inClaude = !!(window.claude && typeof window.claude.use === 'function');
      if (inClaude) {
        const safe = (n) => window.claude.use(n).catch(() => null);
        const [s, m, d] = await Promise.all([safe('sample'), safe('mcp'), safe('downloads')]);
        sample = s; mcp = m; B.cap.downloads = d; B.cap.sample = s; B.cap.mcp = m;
        ai.engines.claude = !!s;
        if (s && s.limits) {
          try { const lim = await s.limits(); ai.engines.vision = !!(lim && lim.images); ai.engines.tools = !!(lim && lim.tools); ai.limits = lim; } catch (e) { /* ignore */ }
        }
        if (m) {
          try { const lt = await m.listTools(HF); ai.engines.hf = !!(lt && lt.servers && lt.servers.some((sv) => sv.server === HF)); } catch (e) { ai.engines.hf = false; }
        }
        ai.engines.web = false;
      } else {
        ai.engines.web = typeof fetch === 'function' && location.protocol !== 'file:' ? true : !!navigator.onLine;
        ai.engines.vision = ai.engines.web;
      }
      B.emit('ai:ready', ai.engines);
      return ai.engines;
    })();
    return ai.ready;
  };

  ai.textEngine = () => (ai.engines.claude ? 'claude' : ai.engines.web ? 'web' : null);
  ai.engineLabel = () => ai.engines.claude ? 'Iris · motore Claude' : ai.engines.web ? 'Iris · motore web aperto' : 'Iris non collegata';

  /* ---------- errors ---------- */
  const MSG = {
    not_granted: 'Iris non ha il permesso di usare l’AI in questa pagina. Riapri l’app e consenti l’accesso quando richiesto.',
    sampling_disabled: 'L’AI non è disponibile per questo account.',
    rate_limited: 'Troppe richieste ravvicinate. Attendi qualche secondo e riprova.',
    session_expired: 'Sessione scaduta: accedi di nuovo a Claude e ricarica.',
    refused: 'Iris non può aiutarti con questa richiesta. Prova a riformularla.',
    empty_completion: 'Iris non ha prodotto testo. Prova a semplificare la richiesta.',
    invalid_json: 'La risposta non era nel formato atteso. Riprova.',
    prompt_too_large: 'Il testo è troppo lungo: inviane una parte più breve.',
    images_unavailable: 'L’invio di immagini non è disponibile qui.',
    image_rejected: 'Immagine non accettata: usa JPG, PNG, WebP o GIF più piccola.',
    upstream_error: 'Il servizio AI non ha risposto. Riprova tra poco.',
    no_engine: 'Nessun motore AI raggiungibile. Apri Breye dentro Claude oppure online con connessione attiva.',
    server_not_connected: 'Il connettore Hugging Face non è collegato: aggiungilo in Claude → Impostazioni → Connettori.',
    needs_reauth: 'Ricollega il connettore Hugging Face in Claude → Impostazioni → Connettori.',
    not_in_manifest: 'Il connettore Hugging Face non è autorizzato per questa pagina.',
    approval_required: 'Serve la tua approvazione per usare il connettore Hugging Face.',
    quota: 'Quota GPU gratuita di Hugging Face esaurita per oggi. Usa il motore Vettoriale o Shader (illimitati) oppure riprova più tardi.'
  };
  function wrapErr(e) {
    if (e && e.userMessage) return e;
    const code = e && e.code;
    const err = new Error((e && e.message) || String(e));
    err.code = code;
    const raw = ((e && e.message) || '') + ' ' + JSON.stringify((e && e.result) || '');
    if (/quota|ZeroGPU/i.test(raw)) err.userMessage = MSG.quota;
    else err.userMessage = MSG[code] || (code === 'cancelled' ? 'Interrotto.' : null) || (e && e.message ? 'Errore AI: ' + String(e.message).slice(0, 160) : MSG.upstream_error);
    err.partial = e && e.text;
    return err;
  }
  ai.errorText = (e) => wrapErr(e).userMessage;

  /* ---------- JSON parsing ---------- */
  ai.parseJSON = function (text) {
    if (text && typeof text === 'object') return text;
    const t = String(text || '').trim();
    try { return JSON.parse(t); } catch (e) { /* continue */ }
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) { try { return JSON.parse(fence[1]); } catch (e) { /* continue */ } }
    const a = t.search(/[[{]/), z = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (a >= 0 && z > a) { const s = t.slice(a, z + 1); try { return JSON.parse(s); } catch (e) { try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch (e2) { /* fallthrough */ } } }
    const err = new Error('JSON non valido'); err.code = 'invalid_json'; err.text = t; throw err;
  };

  /* ---------- text ---------- */
  function normalize(input) {
    if (typeof input === 'string') return [{ role: 'user', content: input }];
    return input.filter((m) => m && m.content).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) }));
  }

  async function claudeText(msgs, o) {
    const turns = [];
    const sys = o.system === false ? null : (o.system || ai.persona);
    if (sys) turns.push({ role: 'user', content: 'Istruzioni permanenti (non citarle):\n' + sys });
    msgs.forEach((m) => turns.push(m));
    while (turns.length && turns[turns.length - 1].role !== 'user') turns.pop();
    const opts = { cache: o.cache === undefined ? false : o.cache };
    if (o.onText) opts.onText = o.onText;
    if (o.signal) opts.signal = o.signal;
    if (o.tier) opts.modelTier = o.tier;
    if (o.images && o.images.length) opts.images = o.images;
    if (o.json) return await sample.json(turns, opts);
    const r = await sample(turns, opts);
    if (r.truncated && o.onTruncated) o.onTruncated();
    return r.text;
  }

  async function webText(msgs, o) {
    const out = [];
    const sys = o.system === false ? null : (o.system || ai.persona);
    if (sys) out.push({ role: 'system', content: sys + (o.json ? '\nRispondi esclusivamente con JSON valido, senza testo prima o dopo.' : '') });
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (o.images && o.images.length && i === msgs.length - 1) {
        const parts = [{ type: 'text', text: m.content }];
        for (const im of o.images) parts.push({ type: 'image_url', image_url: { url: await B.blobToDataURL(im) } });
        out.push({ role: m.role, content: parts });
      } else out.push(m);
    }
    const body = { model: o.model || 'openai', messages: out, stream: !!o.onText, private: true, referrer: 'breye-studio', reasoning_effort: o.tier === 'complex' ? 'medium' : 'low', max_tokens: o.tier === 'complex' ? 16000 : 8000 };
    let res;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch(WEB_TEXT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: o.signal });
      if ((res.status === 429 || res.status === 402 || res.status === 503) && attempt < 3) { const ra = +(res.headers.get('Retry-After') || 0); await B.sleep(Math.min(20, Math.max(4 * (attempt + 1), ra)) * 1000); continue; }
      if (res.status === 400 && (body.reasoning_effort || body.max_tokens)) { delete body.reasoning_effort; delete body.max_tokens; continue; }
      break;
    }
    if (!res.ok) { const e = new Error('HTTP ' + res.status); e.code = res.status === 429 || res.status === 402 ? 'rate_limited' : 'upstream_error'; throw e; }
    let text = '';
    if (!o.onText) {
      const j = await res.json();
      text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    } else {
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          const l = line.trim(); if (!l.startsWith('data:')) continue;
          const d = l.slice(5).trim(); if (d === '[DONE]') continue;
          try { const j = JSON.parse(d); const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content; if (delta) { text += delta; o.onText({ text, delta }); } } catch (e) { /* partial line */ }
        }
      }
    }
    if (!text.trim()) { const e = new Error('vuoto'); e.code = 'empty_completion'; throw e; }
    if (o.json) return ai.parseJSON(text);
    return text;
  }

  ai.text = async function (input, o = {}) {
    await ai.init();
    const msgs = normalize(input);
    const eng = ai.textEngine();
    if (!eng) throw wrapErr({ code: 'no_engine' });
    setBusy(1);
    try {
      if (eng === 'claude') {
        try { return await claudeText(msgs, o); }
        catch (e) {
          if (o.json && e && e.code === 'invalid_json' && e.text) { try { return ai.parseJSON(e.text); } catch (e2) { /* fall */ } }
          throw e;
        }
      }
      return await webText(msgs, o);
    } catch (e) { throw wrapErr(e); }
    finally { setBusy(-1); }
  };
  ai.json = (input, o = {}) => ai.text(input, Object.assign({}, o, { json: true }));
  ai.canSee = () => ai.engines.vision;

  /* ---------- image helpers ---------- */
  const ZRES = [[1024, 1024, '1024x1024 ( 1:1 )'], [1152, 896, '1152x896 ( 9:7 )'], [896, 1152, '896x1152 ( 7:9 )'], [1152, 864, '1152x864 ( 4:3 )'], [864, 1152, '864x1152 ( 3:4 )'], [1248, 832, '1248x832 ( 3:2 )'], [832, 1248, '832x1248 ( 2:3 )'], [1280, 720, '1280x720 ( 16:9 )'], [720, 1280, '720x1280 ( 9:16 )'], [1344, 576, '1344x576 ( 21:9 )'], [576, 1344, '576x1344 ( 9:21 )']];
  function nearestRes(w, h) { const r = w / h; let best = ZRES[0], bd = 9; ZRES.forEach((z) => { const d = Math.abs(Math.log((z[0] / z[1]) / r)); if (d < bd) { bd = d; best = z; } }); return best; }

  ai.STYLES = {
    none: { label: 'Libero', add: '' },
    photo: { label: 'Fotorealistico', add: 'ultra realistic photograph, natural light, 85mm lens, high detail, sharp focus, true-to-life colors' },
    cinema: { label: 'Cinematico', add: 'cinematic film still, anamorphic lens, dramatic lighting, color graded, shallow depth of field, 35mm film grain' },
    portrait: { label: 'Ritratto', add: 'professional studio portrait, soft key light, rim light, detailed skin texture, bokeh background' },
    product: { label: 'Prodotto', add: 'premium product photography, studio lighting, clean background, soft reflections, commercial look' },
    anime: { label: 'Anime', add: 'anime illustration, cel shading, vibrant colors, detailed background, studio quality' },
    render3d: { label: '3D', add: '3D render, octane, soft global illumination, subsurface scattering, highly detailed, physically based materials' },
    watercolor: { label: 'Acquerello', add: 'watercolor painting, soft washes, paper texture, delicate edges' },
    oil: { label: 'Pittura a olio', add: 'oil painting, visible brush strokes, rich impasto, classical composition' },
    flat: { label: 'Illustrazione', add: 'flat vector illustration, clean shapes, harmonious palette, modern editorial style' },
    logo: { label: 'Logo', add: 'minimal logo mark, vector, centered, simple geometric shapes, flat colors, white background' },
    pixel: { label: 'Pixel art', add: 'pixel art, 16-bit, crisp pixels, limited palette' },
    neon: { label: 'Neon', add: 'neon cyberpunk, glowing lights, night city, reflections, high contrast' }
  };

  ai.enhancePrompt = async function (prompt, kind = 'image') {
    const txt = await ai.text('Riscrivi questa idea come prompt per un generatore di ' + (kind === 'video' ? 'video' : 'immagini') + ' di alta qualità. Scrivi in inglese, una sola frase lunga e ricca di dettagli visivi (soggetto, ambientazione, luce, inquadratura, materiali, atmosfera). Rispondi solo con il prompt, senza virgolette.\n\nIdea: ' + prompt, { system: false, tier: 'quick', cache: true });
    return txt.replace(/^["'\s]+|["'\s]+$/g, '').split('\n')[0];
  };

  async function webImage(prompt, w, h, seed, model) {
    const scale = Math.min(1, 1536 / Math.max(w, h));
    const W = Math.round(w * scale / 8) * 8, H = Math.round(h * scale / 8) * 8;
    const q = 'width=' + W + '&height=' + H + '&seed=' + seed + '&nologo=true&private=true&enhance=false&referrer=breye-studio' + (model ? '&model=' + model : '');
    const url = WEB_IMG + encodeURIComponent(prompt.slice(0, 1500)) + '?' + q;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url);
      if (res.ok && /^image\//.test(res.headers.get('content-type') || '')) return { blob: await res.blob(), remoteUrl: url };
      if (res.status === 429 || res.status === 503 || res.status === 402) { await B.sleep((attempt + 1) * 7000); continue; }
      if (model && attempt === 0) return webImage(prompt, w, h, seed, null);
      const e = new Error('HTTP ' + res.status); e.code = 'upstream_error'; throw e;
    }
    const e = new Error('Servizio immagini occupato'); e.code = 'rate_limited'; throw e;
  }

  function extractFromResult(res) {
    const out = { images: [], urls: [], text: '' };
    const blocks = (res && res.content) || [];
    for (const b of blocks) {
      if (b.type === 'image' && b.data) out.images.push(B.dataURLToBlob('data:' + (b.mimeType || 'image/png') + ';base64,' + b.data));
      else if (b.type === 'text' && b.text) { out.text += b.text + '\n'; }
      else if (b.type === 'resource' && b.resource) { if (b.resource.blob) out.images.push(B.dataURLToBlob('data:' + (b.resource.mimeType || 'application/octet-stream') + ';base64,' + b.resource.blob)); if (b.resource.uri) out.urls.push(b.resource.uri); }
    }
    const scan = out.text + ' ' + JSON.stringify(res && res.structuredContent || '');
    (scan.match(/https?:\/\/[^\s"'<>)\]]+/g) || []).forEach((u) => out.urls.push(u.replace(/[.,]+$/, '')));
    const b64 = scan.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/);
    if (b64 && !out.images.length) out.images.push(B.dataURLToBlob(b64[0]));
    return out;
  }

  async function hfCall(tool, input) {
    await ai.init();
    if (!mcp) throw wrapErr({ code: 'server_not_connected' });
    setBusy(1);
    try { return await mcp.callTool(HF, tool, input); }
    catch (e) { throw wrapErr(e); }
    finally { setBusy(-1); }
  }
  ai.hfSpace = (space, params, tool) => hfCall('dynamic_space', Object.assign({ operation: 'invoke', space_name: space, parameters: JSON.stringify(params) }, tool ? { tool_name: tool } : {}));
  ai.hfExtract = extractFromResult;

  async function hfImage(prompt, w, h) {
    const res = nearestRes(w, h);
    let r;
    try { r = await hfCall('gr1_z_image_turbo_generate', { prompt, resolution: res[2], random_seed: true, steps: 8 }); }
    catch (e) {
      if (e.code === 'tool_error' || e.userMessage === MSG.quota) {
        try { r = await ai.hfSpace('evalstate/flux1_schnell', { prompt }); } catch (e2) { throw e; }
      } else throw e;
    }
    const ex = extractFromResult(r);
    const imgUrl = ex.urls.find((u) => /\.(png|jpe?g|webp)(\?|$)/i.test(u) || /gradio_api\/file=/.test(u));
    if (ex.images.length) return { blob: ex.images[0], remoteUrl: imgUrl };
    if (imgUrl) return { blob: null, remoteUrl: imgUrl };
    const e = new Error('Nessuna immagine ricevuta'); e.code = 'upstream_error'; throw e;
  }

  /* SVG generation */
  ai.svg = async function (prompt, o = {}) {
    const w = o.w || 1024, h = o.h || 1024;
    const style = o.style && ai.STYLES[o.style] ? ai.STYLES[o.style].label : 'illustrazione vettoriale moderna';
    const req = 'Disegna in SVG: ' + prompt + '\n\nRequisiti:\n- Un solo elemento <svg> con xmlns="http://www.w3.org/2000/svg" e viewBox="0 0 ' + w + ' ' + h + '".\n- Stile: ' + style + '. Composizione ricca e curata: sfondo pieno, profondità con sfumature (linearGradient/radialGradient), luci e ombre morbide, dettagli, filtri leggeri ammessi (feGaussianBlur, feDropShadow).\n- Niente <script>, niente immagini esterne, niente <foreignObject>, testo solo se richiesto.\n- Rispondi SOLO con il codice SVG completo.';
    const txt = await ai.text(req, { system: 'Sei un illustratore e designer vettoriale esperto. Produci SVG validi, eleganti e dettagliati.', tier: o.tier || 'default', signal: o.signal, onText: o.onText });
    const m = String(txt).match(/<svg[\s\S]*<\/svg>/i);
    if (!m) { const e = new Error('Nessun SVG'); e.userMessage = 'Iris non ha restituito un disegno valido. Riprova.'; throw e; }
    return ai.cleanSVG(m[0], w, h);
  };
  ai.cleanSVG = function (svg, w, h) {
    let s = svg.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
    if (window.DOMPurify) s = window.DOMPurify.sanitize(s, { USE_PROFILES: { svg: true, svgFilters: true } });
    if (!/xmlns=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    if (w && !/\swidth=/.test(s.slice(0, 300))) s = s.replace('<svg', '<svg width="' + w + '" height="' + h + '"');
    return s;
  };
  ai.svgToBlob = async function (svg, w, h, type = 'image/png') {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const im = await B.loadImage(url);
      const c = document.createElement('canvas'); c.width = w || im.naturalWidth || 1024; c.height = h || im.naturalHeight || 1024;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      return await B.canvasToBlob(c, type);
    } finally { URL.revokeObjectURL(url); }
  };

  /* GLSL shader generation (Shadertoy-style mainImage) */
  ai.shaderPrompt = 'Scrivi un fragment shader GLSL ES 3.0 in stile Shadertoy che rappresenti in modo realistico e cinematografico la scena richiesta. Regole: definisci SOLO la funzione `void mainImage(out vec4 fragColor, in vec2 fragCoord)` e le funzioni di supporto che ti servono; usa le uniform già dichiarate iTime (float, secondi), iResolution (vec3) e iMouse (vec4); nessuna texture, nessun #version, nessuna dichiarazione di uniform o di out. Usa tecniche come raymarching, fbm noise, nebbia atmosferica, illuminazione fisica, tonemapping e correzione gamma. Il movimento deve essere fluido e lento. Codice compatto (max 150 righe) e sicuramente compilabile. Rispondi solo con il codice dentro un blocco ```glsl.';
  ai.shader = async function (prompt, o = {}) {
    let txt = await ai.text(ai.shaderPrompt + '\n\nScena: ' + prompt, { system: 'Sei un maestro di computer graphics e shader GLSL (stile Inigo Quilez).', tier: o.tier || 'default', signal: o.signal, onText: o.onText });
    let code = extractGLSL(txt);
    let err = B.shader.check(code);
    if (err) {
      txt = await ai.text('Questo shader GLSL non compila. Errore del compilatore:\n' + err.slice(0, 1500) + '\n\nCodice:\n```glsl\n' + code + '\n```\nCorreggilo rispettando le stesse regole (solo mainImage e funzioni di supporto, uniform iTime/iResolution/iMouse già dichiarate). Rispondi solo con il codice corretto in un blocco ```glsl.', { system: 'Sei un esperto di GLSL ES 3.0.', tier: o.tier || 'default', signal: o.signal });
      code = extractGLSL(txt);
      err = B.shader.check(code);
      if (err) { const e = new Error(err); e.userMessage = 'Lo shader generato non compila. Riprova con una descrizione più semplice.'; throw e; }
    }
    return code;
  };
  function extractGLSL(t) {
    const m = String(t).match(/```(?:glsl|c|cpp|hlsl)?\s*([\s\S]*?)```/i);
    let code = (m ? m[1] : String(t)).trim();
    code = code.replace(/#version[^\n]*\n/g, '').replace(/^\s*precision[^\n]*\n/gm, '').replace(/^\s*uniform\s+[^\n]*\n/gm, '').replace(/^\s*out\s+vec4[^\n]*\n/gm, '');
    return code;
  }

  /* unified image generation */
  ai.imageEngines = function () {
    const list = [];
    if (ai.engines.web) list.push({ id: 'web', label: 'Foto realistica', sub: 'Flux · illimitato', icon: 'Camera' });
    if (ai.engines.hf) list.push({ id: 'hf', label: 'Foto realistica', sub: 'Z-Image · Hugging Face', icon: 'Camera' });
    if (ai.textEngine()) {
      list.push({ id: 'vector', label: 'Vettoriale', sub: 'SVG modificabile · illimitato', icon: 'PenTool' });
      list.push({ id: 'shader', label: 'Procedurale 3D', sub: 'Shader GPU animabile · illimitato', icon: 'Aperture' });
    }
    return list;
  };
  ai.image = async function (prompt, o = {}) {
    await ai.init();
    const w = o.w || 1024, h = o.h || 1024;
    const engine = o.engine || (ai.engines.web ? 'web' : ai.engines.hf ? 'hf' : 'vector');
    const styled = o.style && ai.STYLES[o.style] && ai.STYLES[o.style].add ? prompt + ', ' + ai.STYLES[o.style].add : prompt;
    const seed = o.seed ?? Math.floor(Math.random() * 1e9);
    setBusy(1);
    try {
      if (engine === 'web') { const r = await webImage(styled + (o.negative ? ' | avoid: ' + o.negative : ''), w, h, seed, 'flux'); return { blob: r.blob, remoteUrl: r.remoteUrl, kind: 'raster', engine, seed, prompt, w, h }; }
      if (engine === 'hf') { const r = await hfImage(styled, w, h); return { blob: r.blob, remoteUrl: r.remoteUrl, kind: 'raster', engine, seed, prompt, w, h }; }
      if (engine === 'vector') { const svg = await ai.svg(prompt, { w, h, style: o.style, signal: o.signal, onText: o.onText }); const blob = await ai.svgToBlob(svg, w, h); return { blob, svg, kind: 'svg', engine, prompt, w, h }; }
      if (engine === 'shader') { const code = await ai.shader(styled, { signal: o.signal, onText: o.onText }); const blob = await B.shader.still(code, w, h, o.time ?? 3); return { blob, code, kind: 'shader', engine, prompt, w, h }; }
      throw new Error('Motore sconosciuto');
    } catch (e) { throw wrapErr(e); }
    finally { setBusy(-1); }
  };

  /* AI edit of an existing image (Hugging Face) */
  ai.editImage = async function (blob, instruction, w, h) {
    const dataURL = await B.blobToDataURL(blob);
    const b64 = dataURL.split(',')[1];
    const r = await ai.hfSpace('prithivMLmods/Flux.2-Klein-Edit-Ultra-Fast', { images_b64_json: JSON.stringify([b64]), prompt: instruction, seed: 0, randomize_seed: true, width: Math.round((w || 1024) / 16) * 16, height: Math.round((h || 1024) / 16) * 16, steps: 4, guidance_scale: 1 }, 'Flux_2_Klein_Edit_Ultra_Fast_infer');
    const ex = extractFromResult(r);
    if (ex.images.length) return ex.images[0];
    const m = (ex.text || '').match(/[A-Za-z0-9+/]{2000,}={0,2}/);
    if (m) return B.dataURLToBlob('data:image/png;base64,' + m[0]);
    const e = new Error('Nessuna immagine'); e.userMessage = 'Il modello di modifica non ha restituito un’immagine.'; throw e;
  };

  /* photoreal video (Hugging Face Wan 2.2): image URL -> mp4 URL */
  ai.realVideo = async function ({ prompt, imageUrl, seconds = 3.5 }) {
    const r = await ai.hfSpace('zerogpu-aoti/wan2-2-fp8da-aoti-faster', { input_image: imageUrl, prompt: prompt || 'make this image come alive, cinematic motion, smooth animation', duration_seconds: seconds, steps: 6 });
    const ex = extractFromResult(r);
    const url = ex.urls.find((u) => /\.(mp4|webm|mov)(\?|$)/i.test(u)) || ex.urls.find((u) => /gradio_api\/file=/.test(u));
    if (!url) { const e = new Error('Nessun video'); e.userMessage = 'Il generatore video non ha restituito un file. Riprova.'; throw e; }
    return { url };
  };

  /* ---------- WebGL shader runner (used by images, motion and video) ---------- */
  const VERT = '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const HEAD = '#version 300 es\nprecision highp float;\nuniform float iTime;uniform vec3 iResolution;uniform vec4 iMouse;uniform float iFrame;out vec4 breyeOut;\n';
  const TAIL = '\nvoid main(){vec4 c=vec4(0.);mainImage(c,gl_FragCoord.xy);breyeOut=vec4(c.rgb,1.);}';
  B.shader = {
    create(w, h, code) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const gl = c.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
      if (!gl) throw Object.assign(new Error('WebGL2 non disponibile'), { userMessage: 'Il tuo browser non supporta WebGL2, necessario per le scene procedurali.' });
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw Object.assign(new Error(log), { glsl: true }); } return s; };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, HEAD + code + TAIL));
      gl.bindAttribLocation(prog, 0, 'p'); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Object.assign(new Error(gl.getProgramInfoLog(prog)), { glsl: true });
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(prog);
      const u = { t: gl.getUniformLocation(prog, 'iTime'), r: gl.getUniformLocation(prog, 'iResolution'), m: gl.getUniformLocation(prog, 'iMouse'), f: gl.getUniformLocation(prog, 'iFrame') };
      let frame = 0;
      return {
        canvas: c, gl,
        render(t, mouse) { gl.viewport(0, 0, c.width, c.height); gl.uniform1f(u.t, t); gl.uniform3f(u.r, c.width, c.height, 1); gl.uniform4f(u.m, mouse ? mouse[0] : 0, mouse ? mouse[1] : 0, 0, 0); gl.uniform1f(u.f, frame++); gl.drawArrays(gl.TRIANGLES, 0, 3); return c; },
        resize(w2, h2) { c.width = w2; c.height = h2; },
        dispose() { try { gl.getExtension('WEBGL_lose_context') && gl.getExtension('WEBGL_lose_context').loseContext(); } catch (e) { /* ignore */ } }
      };
    },
    check(code) {
      try { B.shader.pool.program(code); return null; }
      catch (e) { if (e.glsl) return e.message || 'errore'; try { const r = B.shader.create(8, 8, code); r.render(1); r.dispose(); return null; } catch (e2) { return e2.message || 'errore'; } }
    },
    /* one shared WebGL2 context for every live preview (browsers cap active contexts) */
    pool: (function () {
      let c = null, gl = null; const progs = new Map();
      function init() {
        c = document.createElement('canvas'); c.width = 8; c.height = 8;
        gl = c.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
        if (!gl) throw Object.assign(new Error('WebGL2 non disponibile'), { userMessage: 'Il tuo browser non supporta WebGL2.' });
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        c.addEventListener('webglcontextlost', () => { gl = null; progs.clear(); });
      }
      function program(code) {
        if (!gl) init();
        if (progs.has(code)) return progs.get(code);
        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw Object.assign(new Error(log), { glsl: true }); } return s; };
        const p = gl.createProgram();
        gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, HEAD + code + TAIL));
        gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Object.assign(new Error(gl.getProgramInfoLog(p)), { glsl: true });
        const P = { p, t: gl.getUniformLocation(p, 'iTime'), r: gl.getUniformLocation(p, 'iResolution'), m: gl.getUniformLocation(p, 'iMouse'), f: gl.getUniformLocation(p, 'iFrame') };
        progs.set(code, P);
        if (progs.size > 40) { const k = progs.keys().next().value; gl.deleteProgram(progs.get(k).p); progs.delete(k); }
        return P;
      }
      return {
        program,
        draw(code, target, t) {
          const P = program(code);
          const w = target.width, h = target.height;
          if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
          gl.viewport(0, 0, w, h); gl.useProgram(P.p);
          gl.uniform1f(P.t, t); gl.uniform3f(P.r, w, h, 1); gl.uniform4f(P.m, 0, 0, 0, 0); gl.uniform1f(P.f, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          const x = target.getContext('2d'); x.drawImage(c, 0, 0);
        }
      };
    })(),
    async still(code, w, h, t = 3) { const r = B.shader.create(w, h, code); r.render(t); const b = await B.canvasToBlob(r.canvas, 'image/png'); r.dispose(); return b; }
  };

  /* built-in scenes, always available even without AI */
  B.shader.presets = {
    iris: { label: 'Iride d’oro', code: 'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}\nvoid mainImage(out vec4 o,in vec2 fc){vec2 uv=(fc-.5*iResolution.xy)/iResolution.y;float r=length(uv),a=atan(uv.y,uv.x);float t=iTime*.15;float fib=fbm(vec2(a*6.+sin(t)*.3,r*9.-t));float fib2=fbm(vec2(a*14.,r*24.+t*.5));vec3 col=mix(vec3(.18,.08,.03),vec3(.85,.52,.16),fib);col=mix(col,vec3(1.,.82,.45),pow(fib2,3.)*1.6);float pupil=smoothstep(.13+.01*sin(iTime),.11,r);float iris=smoothstep(.47,.44,r);col*=iris;col=mix(col,vec3(.01),pupil);col+=vec3(.9,.6,.25)*.25*exp(-abs(r-.46)*40.);col+=pow(max(0.,1.-length(uv-vec2(-.15,.17))*6.),3.)*.8;col=mix(vec3(.03,.015,.01),col,smoothstep(.62,.45,r)+iris);o=vec4(pow(col,vec3(.9)),1.);}' },
    dunes: { label: 'Dune al tramonto', code: 'float h(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}float terr(vec2 p){float v=0.,a=.5;p*=.25;for(int i=0;i<5;i++){v+=a*(1.-abs(n(p)*2.-1.));p*=2.1;a*=.45;}return v*2.2;}\nvoid mainImage(out vec4 o,in vec2 fc){vec2 uv=(fc-.5*iResolution.xy)/iResolution.y;vec3 ro=vec3(iTime*.6,2.2,0.),rd=normalize(vec3(uv.x,uv.y-.18,1.));vec3 sun=normalize(vec3(.2,.12,1.));float t=0.;bool hit=false;for(int i=0;i<120;i++){vec3 p=ro+rd*t;float d=p.y-terr(p.xz);if(d<.002*t){hit=true;break;}t+=d*.5;if(t>60.)break;}vec3 sky=mix(vec3(.98,.62,.32),vec3(.22,.12,.18),pow(max(rd.y+.1,0.),.6));sky+=vec3(1.,.7,.35)*pow(max(dot(rd,sun),0.),40.)*1.5;vec3 col=sky;if(hit){vec3 p=ro+rd*t;vec2 e=vec2(.01,0);vec3 nn=normalize(vec3(terr(p.xz-e.xy)-terr(p.xz+e.xy),2.*e.x,terr(p.xz-e.yx)-terr(p.xz+e.yx)));float dif=max(dot(nn,sun),0.);col=vec3(.78,.46,.22)*(.25+dif*1.1);col=mix(col,sky,1.-exp(-t*.035));}col=col/(1.+col);o=vec4(pow(col,vec3(.85)),1.);}' },
    ocean: { label: 'Oceano notturno', code: 'float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}float sea(vec2 p){float v=0.,a=.6;for(int i=0;i<5;i++){v+=a*n(p+iTime*.4*float(i+1));p*=1.9;a*=.5;}return v*.6;}\nvoid mainImage(out vec4 o,in vec2 fc){vec2 uv=(fc-.5*iResolution.xy)/iResolution.y;vec3 rd=normalize(vec3(uv,1.2));vec3 moon=normalize(vec3(0.,.25,1.));vec3 sky=mix(vec3(.04,.03,.05),vec3(.16,.1,.08),1.-uv.y);sky+=vec3(1.,.85,.6)*smoothstep(.035,.03,length(uv-vec2(0.,.25)));sky+=vec3(.8,.55,.3)*.25*exp(-length(uv-vec2(0.,.25))*5.);vec3 col=sky;if(rd.y<0.){float t=-1./rd.y;vec2 p=vec2(rd.x,1.)*t;float w=sea(p*1.5);vec3 nrm=normalize(vec3(sea(p*1.5+vec2(.05,0))-w,.06,sea(p*1.5+vec2(0,.05))-w));vec3 r=reflect(rd,nrm);float spec=pow(max(dot(r,moon),0.),60.);col=vec3(.02,.02,.03)+vec3(1.,.75,.45)*spec*1.6+vec3(.25,.15,.08)*.2;col=mix(col,sky,exp(-t*.2)*.3);}o=vec4(pow(col,vec3(.9)),1.);}' },
    nebula: { label: 'Nebulosa', code: 'float h(vec3 p){return fract(sin(dot(p,vec3(17.1,31.7,11.3)))*43758.5);}float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}\nvoid mainImage(out vec4 o,in vec2 fc){vec2 uv=(fc-.5*iResolution.xy)/iResolution.y;vec3 col=vec3(0.);float t=iTime*.05;for(int i=0;i<3;i++){float z=float(i)*.6+1.;float d=fbm(vec3(uv*z*1.6,t+float(i)));col+=mix(vec3(.5,.18,.05),vec3(1.,.72,.35),d)*pow(d,3.)*1.1/z;}col+=vec3(1.)*pow(h(vec3(floor(fc*.5),1.)),400.)*1.5;col=col/(1.+col*.6);o=vec4(pow(col,vec3(.85)),1.);}' },
    silk: { label: 'Seta liquida', code: 'void mainImage(out vec4 o,in vec2 fc){vec2 uv=fc/iResolution.xy;vec2 p=(fc-.5*iResolution.xy)/iResolution.y;float t=iTime*.25;for(int i=1;i<7;i++){p.x+=.3/float(i)*sin(float(i)*2.5*p.y+t+float(i));p.y+=.3/float(i)*cos(float(i)*2.*p.x+t*1.3);}float v=.5+.5*sin(p.x*2.+p.y*1.5);vec3 a=vec3(.12,.06,.03),b=vec3(.72,.42,.16),c=vec3(1.,.86,.55);vec3 col=mix(a,b,smoothstep(0.,.6,v));col=mix(col,c,smoothstep(.75,1.,v));col*=.8+.2*uv.y;o=vec4(col,1.);}' }
  };
})();
