/* Thorion — the Thorion AI engine.
   Text, code, tools and vision: Claude inside claude.ai (no key), or on the public web open models running on the
   AI Horde community GPU network (Skyfall 31B and its Mistral family, or a large Qwen whenever a volunteer hosts one):
   free, keyless, no quota.
   Images: photoreal (AI Horde as well, see iris-tools.js; Pollinations Sana as an instant fallback),
   vector (SVG written by the language model), procedural (GLSL shaders written by the language model). Video: see motion.js. */
(function () {
  'use strict';
  const B = window.B;
  const WEB_IMG = 'https://image.pollinations.ai/prompt/';

  const ai = (B.ai = {
    engines: { claude: false, web: false, horde: false, vision: false, tools: false },
    ready: null,
    busy: 0,
    persona: 'Sei Thorion Three 3.3, un modello di frontiera: ragioni in profondità prima di rispondere, sei fortissimo in matematica, scienze, ingegneria e programmazione, e sai creare foto e video ultra realistici, modelli e scene 3D. Ti presenti come "Thorion Three 3.3". Rispondi nella lingua dell’utente (di default in italiano), con tono caldo, preciso e sicuro. Prima pensa passo per passo al problema, poi dai una risposta chiara e completa. Usa Markdown quando aiuta: titoli brevi, elenchi, tabelle, formule e blocchi di codice con il linguaggio indicato; quando scrivi codice, scrivilo completo, moderno e funzionante in un unico file. Non inventare fatti: se non sei sicuro, dillo. Aiuti la ricerca scientifica e lo studio in modo responsabile e per fini legittimi; non fornisci istruzioni per creare armi, agenti patogeni o altro materiale pericoloso.'
  });

  let sample = null;

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
        const [s, d] = await Promise.all([safe('sample'), safe('downloads')]);
        sample = s; B.cap.downloads = d; B.cap.sample = s;
        ai.engines.claude = !!s;
        if (s && s.limits) {
          try { const lim = await s.limits(); ai.engines.vision = !!(lim && lim.images); ai.engines.tools = !!(lim && lim.tools); ai.limits = lim; } catch (e) { /* ignore */ }
        }
        ai.engines.web = false; ai.engines.horde = false;
      } else {
        ai.engines.web = typeof fetch === 'function' && location.protocol !== 'file:' ? true : !!navigator.onLine;
        ai.engines.horde = ai.engines.web;
        ai.engines.vision = false; // open models read captions instead (ai.caption); canSee() covers both
        ai.engines.caption = ai.engines.web;
        ai.engines.tools = ai.engines.web;
      }
      B.emit('ai:ready', ai.engines);
      return ai.engines;
    })();
    return ai.ready;
  };

  ai.textEngine = () => (ai.engines.claude ? 'claude' : ai.engines.web ? 'web' : null);
  ai.engineLabel = () => ai.engines.claude ? 'Thorion · motore Claude' : ai.engines.web ? 'Thorion · ' + (ai.gate ? ai.gate.label : 'GPU comunitaria') : 'Thorion non collegata';

  /* ---------- errors ---------- */
  const MSG = {
    not_granted: 'Thorion non ha il permesso di usare l’AI in questa pagina. Riapri l’app e consenti l’accesso quando richiesto.',
    sampling_disabled: 'L’AI non è disponibile per questo account.',
    rate_limited: 'Troppe richieste ravvicinate. Attendi qualche secondo e riprova.',
    session_expired: 'Sessione scaduta: accedi di nuovo a Claude e ricarica.',
    refused: 'Thorion non può aiutarti con questa richiesta. Prova a riformularla.',
    empty_completion: 'Thorion non ha prodotto testo. Prova a semplificare la richiesta.',
    invalid_json: 'La risposta non era nel formato atteso. Riprova.',
    prompt_too_large: 'Il testo è troppo lungo: inviane una parte più breve.',
    images_unavailable: 'L’invio di immagini non è disponibile qui.',
    image_rejected: 'Immagine non accettata: usa JPG, PNG, WebP o GIF più piccola.',
    upstream_error: 'Il servizio AI non ha risposto. Riprova tra poco.',
    no_engine: 'Nessun motore AI raggiungibile. Apri Thorion dentro Claude oppure online con connessione attiva.',
    no_photo: 'Le foto realistiche usano la rete GPU comunitaria, raggiungibile solo dalla versione web di Thorion. Qui puoi usare i motori Vettoriale e Procedurale.',
    horde_busy: 'La rete GPU comunitaria è molto occupata in questo momento. Riprova tra poco oppure usa la qualità Rapida.',
    horde_error: 'La rete GPU comunitaria non ha completato il lavoro. Riprova: verrà scelto un altro computer.'
  };
  function wrapErr(e) {
    if (e && e.userMessage) return e;
    const code = e && e.code;
    const err = new Error((e && e.message) || String(e));
    err.code = code;
    const raw = ((e && e.message) || '') + ' ' + JSON.stringify((e && e.result) || '');
    err.userMessage = MSG[code] || (code === 'cancelled' ? 'Interrotto.' : null) || (e && e.message ? 'Errore AI: ' + String(e.message).slice(0, 160) : MSG.upstream_error);
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

  /* ---------- AI Horde text: open models on volunteer GPUs, free and keyless ---------- */
  const HORDE = 'https://aihorde.net/api/v2';
  const HAGENT = 'thorion:2.0:github.com/baccarossa2-ai/Claude';
  const hh = () => ({ 'Content-Type': 'application/json', apikey: B.hordeKey ? B.hordeKey() : '0000000000', 'Client-Agent': HAGENT }); // a signed-in key gets priority over the anonymous queue
  const CHUNK = 512; // the most an anonymous request may ask for: longer answers continue in several chunks
  // model families on the network, best first. A request names a whole family: the first free GPU running any of
  // its models takes the job, so answers stay fast while the network stays fair (one prompt format per family)
  const FAMILIES = [
    { id: 'qwen', fmt: 'chatml', re: /qwen[\w.-]*?(max|14b|27b|30b|32b|72b|235b)/i, label: 'Qwen' },
    { id: 'mistral-big', fmt: 'mistral', re: /(skyfall|artemis)-31b|(cydonia|magidonia)-24b|mistral-small/i, label: 'Skyfall 31B' },
    { id: 'mistral', fmt: 'mistral', re: /rocinante|angelic_eclipse|mistral-nemo/i, label: 'Mistral Nemo 12B' },
    { id: 'chatml', fmt: 'chatml', re: /mini-magnum/i, label: 'Magnum 12B' },
    { id: 'llama', fmt: 'llama3', re: /stheno|super-nova/i, label: 'Llama 3 8B' }
  ];
  // excluded: uncensored builds, debug builds, a 128B model with a long queue, and a Gemma 4 bridge whose forced
  // reasoning restarts on every 512-token chunk and never reaches the answer for anonymous requests
  const TEXT_BAD = /heretic|uncensored|nsfw|debug|abliterat|aggressive|behemoth|thinking|^google\/gemma/i;
  const nap = (ms, signal) => new Promise((res, rej) => {
    if (signal && signal.aborted) return rej(Object.assign(new Error('Interrotto'), { code: 'cancelled', name: 'AbortError' }));
    const t = setTimeout(res, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('Interrotto'), { code: 'cancelled', name: 'AbortError' })); }, { once: true });
  });
  ai.modelLabel = (n) => { const b = String(n).split('/').pop().replace(/\.gguf$/i, '').replace(/[-_.](i1-)?I?Q\d[\w.]*$/i, '').replace(/[-_]/g, ' ').replace(/(\d+)b\b/gi, '$1B'); return b.charAt(0).toUpperCase() + b.slice(1); };
  let tstat = null, tstatT = 0;
  // live models and the limits of the GPUs that host them, grouped into families
  ai.textModels = async function () {
    if (tstat && tstat.length && Date.now() - tstatT < 180000) return tstat;
    try {
      const get = (p) => fetch(HORDE + p, { headers: { 'Client-Agent': HAGENT } }).then((r) => r.json());
      const [ms, ws] = await Promise.all([get('/status/models?type=text'), get('/workers?type=text').catch(() => [])]);
      const lim = {};
      (Array.isArray(ws) ? ws : []).forEach((w) => { if ((w.max_length || 0) < CHUNK) return; (w.models || []).forEach((n) => { const l = lim[n] || (lim[n] = { ctx: 0, n: 0 }); l.ctx = Math.max(l.ctx, w.max_context_length || 0); l.n++; }); });
      tstat = [];
      ms.filter((m) => m.count > 0 && !TEXT_BAD.test(m.name) && lim[m.name]).forEach((m) => {
        const fi = FAMILIES.findIndex((f) => f.re.test(m.name)); if (fi < 0) return;
        tstat.push({ name: m.name, label: ai.modelLabel(m.name), count: lim[m.name].n, ctx: lim[m.name].ctx, fam: FAMILIES[fi], rank: fi });
      });
      tstat.sort((a, b) => (a.rank - b.rank) || (b.ctx >= 8192) - (a.ctx >= 8192) || (b.count - a.count));
      tstatT = Date.now();
    } catch (e) { tstat = tstat || []; }
    return tstat;
  };
  // pools to try in order: the visitor's chosen model, then each family that is online
  async function textPools(complex) {
    const list = await ai.textModels();
    const pools = [];
    const add = (models, fam) => { models = models.filter((m) => m.ctx >= 2048); if (models.length) pools.push({ models, fam, ctx: Math.min(16384, Math.min(...models.map((m) => m.ctx))) }); };
    const pref = list.find((m) => m.name === B.ls.get('ai.textModel', 'auto'));
    if (pref) add([pref], pref.fam);
    FAMILIES.forEach((f) => {
      let ms = list.filter((m) => m.fam === f);
      if (f.id === 'mistral-big' && !complex) { ms = ms.concat(list.filter((m) => m.fam.id === 'mistral')); add(ms, f); return; } // chat: the first free Mistral GPU answers
      if (f.id === 'mistral' && !complex) return;
      add(ms, f);
    });
    if (!pools.length) pools.push({ models: [{ name: 'koboldcpp/Skyfall-31B-v4.2', ctx: 8192 }, { name: 'koboldcpp/Rocinante-X-12B', ctx: 8192 }], fam: FAMILIES[1], ctx: 8192 });
    return pools;
  }
  const TEMPLATES = {
    chatml: { head: '', sys: (s) => '<|im_start|>system\n' + s + '<|im_end|>\n', turn: (r, c) => '<|im_start|>' + r + '\n' + c + '<|im_end|>\n', open: '<|im_start|>assistant\n', stop: ['<|im_end|>', '<|im_start|>'] },
    mistral: { head: '', sys: (s) => '[SYSTEM_PROMPT]' + s + '[/SYSTEM_PROMPT]', turn: (r, c) => r === 'user' ? '[INST]' + c + '[/INST]' : c + '</s>', open: '', stop: ['[INST]', '</s>', '[/INST]', '[SYSTEM_PROMPT]'] },
    llama3: { head: '<|begin_of_text|>', sys: (s) => '<|start_header_id|>system<|end_header_id|>\n\n' + s + '<|eot_id|>', turn: (r, c) => '<|start_header_id|>' + r + '<|end_header_id|>\n\n' + c + '<|eot_id|>', open: '<|start_header_id|>assistant<|end_header_id|>\n\n', stop: ['<|eot_id|>', '<|start_header_id|>'] }
  };
  function buildPrompt(T, sys, msgs, ctx) {
    const budget = Math.max(2000, (ctx - CHUNK - 96) * 3.1); // characters that fit in the context window
    let used = sys.length; const kept = [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      let c = String(msgs[i].content || '');
      if (used + c.length > budget) { if (kept.length) break; const room = Math.max(400, budget - used); c = c.slice(0, Math.floor(room * 0.3)) + '\n[…]\n' + c.slice(-Math.floor(room * 0.7)); }
      kept.unshift({ role: msgs[i].role === 'assistant' ? 'assistant' : 'user', content: c }); used += c.length;
    }
    while (kept.length && kept[0].role === 'assistant') kept.shift();
    return T.head + T.sys(sys) + kept.map((x) => T.turn(x.role, x.content)).join('') + T.open;
  }
  const clean = (t) => String(t).replace(/<(think|thought)>[\s\S]*?<\/\1>/gi, '').replace(/<\|im_end\|>|<\|im_start\|>|<\|eot_id\|>|<end_of_turn>|<\/s>|\[\/?INST\]/g, '').replace(/^\s*(Thorion|assistant)\s*:\s*/i, '').trim();
  let tInflight = 0; const tWaiting = [];
  const tAcquire = () => new Promise((res) => { if (tInflight < 3) { tInflight++; res(); } else tWaiting.push(res); });
  const tRelease = () => { const n = tWaiting.shift(); if (n) n(); else tInflight--; };
  async function hordeOnce(prompt, pool, stop, signal) {
    await tAcquire();
    try {
      const body = { prompt, params: { n: 1, max_length: CHUNK, max_context_length: pool.ctx, temperature: 0.6, top_p: 0.92, rep_pen: 1.05, stop_sequence: stop }, models: pool.models.map((m) => m.name), trusted_workers: false, slow_workers: true };
      let j = null, r = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        r = await fetch(HORDE + '/generate/text/async', { method: 'POST', headers: hh(), body: JSON.stringify(body), signal });
        j = await r.json().catch(() => ({}));
        if (r.status === 429) { await nap(2500 * (attempt + 1), signal); continue; }
        break;
      }
      if (!r.ok) throw Object.assign(new Error((j && j.message) || 'HTTP ' + r.status), { code: r.status === 429 ? 'rate_limited' : 'upstream_error', retryOther: true });
      const id = j.id, t0 = Date.now();
      const drop = () => fetch(HORDE + '/generate/text/status/' + id, { method: 'DELETE', headers: hh() }).catch(() => {});
      for (;;) {
        try { await nap(1100, signal); } catch (e) { drop(); throw e; }
        let c;
        try { c = await (await fetch(HORDE + '/generate/text/status/' + id, { headers: hh(), signal })).json(); }
        catch (e) { if (e.name === 'AbortError') { drop(); throw Object.assign(new Error('Interrotto'), { code: 'cancelled', name: 'AbortError' }); } continue; }
        if (c.faulted || c.is_possible === false) { drop(); throw Object.assign(new Error('Il modello non è disponibile ora'), { code: 'upstream_error', retryOther: true }); }
        if (c.done) { const g = (c.generations || [])[0] || {}; return { text: g.text || '', model: g.model || pool.models[0].name }; }
        const secs = Math.round((Date.now() - t0) / 1000);
        if (!c.processing && secs >= 5) B.emit('ai:wait', secs);
        if (secs > 300) { drop(); throw Object.assign(new Error('Tempo scaduto'), { code: 'upstream_error', retryOther: true }); }
      }
    } finally { tRelease(); }
  }
  // no token count comes back: a short chunk, or a complete-looking ending outside any code block, means the model stopped
  const looksDone = (all, json) => { if (json) { try { ai.parseJSON(all); return true; } catch (e) { return false; } } return ((all.match(/```/g) || []).length % 2 === 0) && /[.!?…:)\]"'»*_`>]\s*$|\p{Extended_Pictographic}\s*$/u.test(all); };
  const finished = (chunk, all) => chunk.length < CHUNK * 1.6 || (chunk.length < CHUNK * 3.4 && ((all.match(/```/g) || []).length % 2 === 0) && /[.!?…:)\]"'»*_`>]\s*$|\p{Extended_Pictographic}\s*$/u.test(all));
  // the GPU network has no streaming: each chunk is revealed progressively so the answer still "types"
  async function reveal(prev, full, onText, signal) {
    const n = full.length - prev.length; if (n <= 0) return;
    const steps = Math.min(24, Math.ceil(n / 30));
    for (let i = 1; i <= steps; i++) { if (signal && signal.aborted) return; onText({ text: full.slice(0, prev.length + Math.round(n * i / steps)), delta: '' }); await B.sleep(16); }
  }
  /* vision: the network's interrogation workers caption the image, the language model reads the caption */
  ai.caption = async function (blob, signal) {
    const im = await B.loadImage(blob); const sc = Math.min(1, 768 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * sc)); c.height = Math.max(1, Math.round(im.naturalHeight * sc)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const r = await fetch(HORDE + '/interrogate/async', { method: 'POST', headers: hh(), body: JSON.stringify({ forms: [{ name: 'caption' }], source_image: c.toDataURL('image/webp', 0.9).split(',')[1], slow_workers: true }), signal });
    const j = await r.json().catch(() => ({})); if (!r.ok || !j.id) return '';
    const t0 = Date.now(), drop = () => fetch(HORDE + '/interrogate/status/' + j.id, { method: 'DELETE', headers: hh() }).catch(() => {});
    try {
      while (Date.now() - t0 < 120000) {
        await nap(1500, signal);
        try { const st = await (await fetch(HORDE + '/interrogate/status/' + j.id, { headers: hh(), signal })).json(); if (st.state === 'done') { const f = (st.forms || [])[0]; return (f && f.result && f.result.caption) || ''; } if (st.state === 'faulted') return ''; } catch (e) { if (e.name === 'AbortError') throw e; }
      }
      drop(); return '';
    } catch (e) { drop(); throw e; }
  };
  async function webText(msgs, o) {
    const pools = await textPools(o.tier === 'complex');
    let sys = (o.system === false ? 'Sei un assistente preciso.' : (o.system || ai.persona)) + '\nRispondi direttamente, senza mostrare il ragionamento.';
    if (o.json) sys += '\nRispondi esclusivamente con JSON valido, senza testo prima o dopo e senza blocchi di codice.';
    msgs = msgs.map((m) => Object.assign({}, m));
    if (o.images && o.images.length) {
      const caps = await Promise.all(o.images.map((im) => ai.caption(im, o.signal).catch(() => '')));
      const desc = caps.map((c, i) => (o.images.length > 1 ? (i + 1) + ') ' : '') + (c || 'descrizione non disponibile')).join('; ');
      sys += '\nNon vedi direttamente le immagini: ricevi una loro descrizione automatica (in inglese) e ragioni su quella.';
      msgs[msgs.length - 1].content += '\n\n[Immagine allegata — descrizione automatica: ' + desc + ']';
    }
    const maxTok = o.maxTokens || (o.tier === 'complex' ? 12000 : 4096);
    let lastErr = null;
    for (const pool of pools.slice(0, 4)) {
      const T = TEMPLATES[pool.fam.fmt], base = buildPrompt(T, sys, msgs, pool.ctx);
      let out = '';
      try {
        let empties = 0;
        for (let round = 0; round < Math.ceil(maxTok / CHUNK); round++) {
          out = out.replace(/[ \t]+$/, '');
          const res = await hordeOnce(base + out, pool, T.stop, o.signal);
          if (!res.text.trim() && out && !looksDone(clean(out), o.json) && ++empties < 2) { out = out.replace(/\s+$/, ''); continue; }
          const prev = clean(out); out += res.text;
          ai.gate = { label: ai.modelLabel(res.model) + ' · GPU comunitaria', model: res.model };
          if (o.onText) await reveal(prev, clean(out), o.onText, o.signal);
          if (!res.text.trim()) break;
          if (o.json) { try { ai.parseJSON(clean(out)); break; } catch (e) { continue; } } // JSON: keep going until it parses
          if (finished(res.text, clean(out))) break;
        }
        const text = clean(out);
        if (!text) throw Object.assign(new Error('vuoto'), { code: 'empty_completion', retryOther: true });
        return o.json ? ai.parseJSON(text) : text;
      } catch (e) {
        if (e.code === 'cancelled' || e.name === 'AbortError') throw Object.assign(new Error('Interrotto'), { code: 'cancelled', name: 'AbortError' });
        lastErr = e; // invalid JSON or an unavailable model: the next family gets a try
      }
    }
    throw lastErr || Object.assign(new Error('nessun modello'), { code: 'upstream_error' });
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

  /* ---------- tool use: the model calls page functions (Claude natively, the open gateway via OpenAI tools) ---------- */
  ai.canUseTools = () => ai.engines.claude ? !!ai.engines.tools : ai.engines.web;
  ai.toolChat = async function (input, o = {}) {
    await ai.init();
    const msgs = normalize(input);
    const tools = o.tools || [];
    const eng = ai.textEngine();
    if (!eng) throw wrapErr({ code: 'no_engine' });
    setBusy(1);
    try {
      if (eng === 'claude') {
        const turns = [];
        const sys = o.system || ai.persona;
        turns.push({ role: 'user', content: 'Istruzioni permanenti (non citarle):\n' + sys });
        msgs.forEach((m) => turns.push(m));
        const opts = { signal: o.signal, onText: o.onText, modelTier: o.tier || 'default' };
        if (tools.length && ai.engines.tools) opts.tools = tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.schema, execute: (inp, ctx) => t.execute(inp || {}, ctx) }));
        if (o.images && o.images.length && ai.engines.vision) opts.images = o.images;
        const r = await sample(turns, opts);
        return r.text;
      }
      // open models have no native tools: Thorion describes them in the prompt and reads <tool>{json}</tool> blocks
      const argDoc = (sc) => Object.entries((sc && sc.properties) || {}).map(([k, p]) => k + ((sc.required || []).includes(k) ? '' : '?') + ': ' + (p.enum ? p.enum.join('|') : p.type === 'array' ? 'array di ' + ((p.items && p.items.type) || 'valori') : p.type) + (p.description ? ' — ' + p.description : '')).join('; ');
      const sys = (o.system || ai.persona) + '\n\n## Strumenti\nPuoi usare questi strumenti reali. Per usarne uno rispondi SOLO con un blocco:\n<tool>{"name":"NOME","arguments":{...}}</tool>\nUn solo strumento per risposta, argomenti in JSON valido. Riceverai il risultato in un messaggio <tool_result>; poi usa un altro strumento oppure rispondi all’utente normalmente, senza blocchi <tool>.\n' + tools.map((t) => '- ' + t.name + ': ' + t.description + '\n  argomenti: ' + argDoc(t.schema)).join('\n');
      const conv = msgs.slice();
      let shown = '';
      for (let round = 0; round < (o.maxRounds || 8); round++) {
        const text = await webText(conv, { system: sys, signal: o.signal, images: round === 0 ? o.images : null, maxTokens: 2048, tier: 'complex' });
        const call = parseToolCall(text, tools);
        if (!call && /<tool>/i.test(text) && round < (o.maxRounds || 8) - 1) {
          conv.push({ role: 'assistant', content: text }, { role: 'user', content: '<tool_result name="errore">Blocco <tool> non valido o strumento sconosciuto. Strumenti validi: ' + tools.map((t) => t.name).join(', ') + '. Riprova con JSON valido oppure rispondi all’utente.</tool_result>' });
          continue;
        }
        if (!call) { const final = text.replace(/<tool>[\s\S]*?(<\/tool>|$)/gi, '').trim() || shown; if (o.onText) o.onText({ text: final, delta: final }); return final; }
        const before = text.slice(0, call.index).trim();
        if (before) { shown = before; if (o.onText) o.onText({ text: shown, delta: before }); } // live commentary, replaced by the final answer
        conv.push({ role: 'assistant', content: text.slice(0, call.end) });
        let result;
        try { result = await call.tool.execute(call.args || {}, { signal: o.signal }); }
        catch (e) { if (e && (e.code === 'cancelled' || e.name === 'AbortError')) throw e; result = { error: (e && (e.userMessage || e.message)) || 'errore' }; }
        conv.push({ role: 'user', content: '<tool_result name="' + call.tool.name + '">' + (typeof result === 'string' ? result : JSON.stringify(result)) + '</tool_result>\n(Messaggio automatico, non dell’utente. Se serve un altro strumento per completare la richiesta originale usalo ora con un blocco <tool>; altrimenti scrivi all’utente la risposta finale in 1-3 frasi.)' });
      }
      return shown || 'Ho completato le operazioni richieste.';
    } catch (e) { throw wrapErr(e); }
    finally { setBusy(-1); }
  };
  function parseToolCall(text, tools) {
    const m = /<tool>\s*([\s\S]*?)\s*(<\/tool>|$)/i.exec(text) || /```(?:json)?\s*(\{[\s\S]*?"name"[\s\S]*?\})\s*```/i.exec(text);
    if (!m) return null;
    let j; try { j = ai.parseJSON(m[1]); } catch (e) { return null; }
    const name = String((j && (j.name || j.tool)) || '').trim();
    const tool = tools.find((t) => t.name === name);
    if (!tool) return null;
    return { tool, args: j.arguments || j.args || j.parameters || {}, index: m.index, end: m.index + m[0].length };
  }
  ai.canSee = () => ai.engines.vision || !!ai.engines.caption;
  ai.canRead = () => ai.engines.vision; // reading text in images needs real pixel vision

  /* ---------- image helpers ---------- */
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

  /* SVG generation */
  ai.svg = async function (prompt, o = {}) {
    const w = o.w || 1024, h = o.h || 1024;
    const style = o.style && ai.STYLES[o.style] ? ai.STYLES[o.style].label : 'illustrazione vettoriale moderna';
    const req = 'Disegna in SVG: ' + prompt + '\n\nRequisiti:\n- Un solo elemento <svg> con xmlns="http://www.w3.org/2000/svg" e viewBox="0 0 ' + w + ' ' + h + '".\n- Stile: ' + style + '. Composizione ricca e curata: sfondo pieno, profondità con sfumature (linearGradient/radialGradient), luci e ombre morbide, dettagli, filtri leggeri ammessi (feGaussianBlur, feDropShadow).\n- Niente <script>, niente immagini esterne, niente <foreignObject>, testo solo se richiesto.\n- Rispondi SOLO con il codice SVG completo.';
    const txt = await ai.text(req, { system: 'Sei un illustratore e designer vettoriale esperto. Produci SVG validi, eleganti e dettagliati.', tier: o.tier || 'default', signal: o.signal, onText: o.onText });
    const m = String(txt).match(/<svg[\s\S]*<\/svg>/i);
    if (!m) { const e = new Error('Nessun SVG'); e.userMessage = 'Thorion non ha restituito un disegno valido. Riprova.'; throw e; }
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
    if (ai.engines.horde) {
      list.push({ id: 'iris', label: 'Thorion Pro · ultra realistico', sub: 'Scatto + rifinitura del dettaglio + finitura pellicola · illimitato', icon: 'Sparkles' });
      list.push({ id: 'iris-fast', label: 'Thorion Foto · rapido', sub: 'Uno scatto realistico in 1–3 minuti · illimitato', icon: 'Camera' });
    }
    if (ai.engines.web) list.push({ id: 'web', label: 'Lampo', sub: 'Modello Sana, istantaneo · con filigrana', icon: 'Zap' });
    if (ai.textEngine()) {
      list.push({ id: 'vector', label: 'Vettoriale', sub: 'SVG modificabile · illimitato', icon: 'PenTool' });
      list.push({ id: 'shader', label: 'Procedurale 3D', sub: 'Shader GPU animabile · illimitato', icon: 'Aperture' });
    }
    return list;
  };
  ai.defaultImageEngine = () => (ai.engines.horde ? 'iris' : ai.engines.web ? 'web' : 'vector');
  ai.photoEngine = (fast) => (ai.engines.horde ? (fast ? 'iris-fast' : 'iris') : ai.engines.web ? 'web' : null);
  ai.MSG = MSG;
  ai.image = async function (prompt, o = {}) {
    await ai.init();
    const w = o.w || 1024, h = o.h || 1024;
    const engine = o.engine || ai.defaultImageEngine();
    const styled = o.style && ai.STYLES[o.style] && ai.STYLES[o.style].add ? prompt + ', ' + ai.STYLES[o.style].add : prompt;
    const seed = o.seed ?? Math.floor(Math.random() * 1e9);
    setBusy(1);
    try {
      if (engine === 'iris' || engine === 'iris-fast') {
        if (!ai.engines.horde) throw Object.assign(new Error('no photo'), { userMessage: MSG.no_photo });
        const r = await B.irisPro({ prompt, style: o.style, w, h, negative: o.negative, quality: engine === 'iris' ? (o.quality || 'ultra') : 'fast', look: o.look, seed: o.seed, onStep: o.onStep, signal: o.signal, rawPrompt: o.rawPrompt });
        return { blob: r.blob, kind: 'raster', engine, seed: r.seed, prompt, w: r.w, h: r.h, model: r.model, finalPrompt: r.prompt };
      }
      if (engine === 'web') { const r = await webImage(styled + (o.negative ? ' | avoid: ' + o.negative : ''), w, h, seed, null); return { blob: r.blob, remoteUrl: r.remoteUrl, kind: 'raster', engine, seed, prompt, w, h }; }
      if (engine === 'vector') { const svg = await ai.svg(prompt, { w, h, style: o.style, signal: o.signal, onText: o.onText }); const blob = await ai.svgToBlob(svg, w, h); return { blob, svg, kind: 'svg', engine, prompt, w, h }; }
      if (engine === 'shader') { const code = await ai.shader(styled, { signal: o.signal, onText: o.onText }); const blob = await B.shader.still(code, w, h, o.time ?? 3); return { blob, code, kind: 'shader', engine, prompt, w, h }; }
      throw new Error('Motore sconosciuto');
    } catch (e) { throw wrapErr(e); }
    finally { setBusy(-1); }
  };

  /* AI edit of an existing image: img2img on the community GPU network (see iris-tools.js) */
  ai.editImage = async function (blob, instruction, opts = {}) {
    if (!ai.engines.horde) throw Object.assign(new Error('no photo'), { userMessage: MSG.no_photo });
    return B.irisEdit(blob, instruction, opts);
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
