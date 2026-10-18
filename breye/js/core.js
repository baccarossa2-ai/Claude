/* Breye core: helpers, storage, router, overlays, command palette */
(function () {
  'use strict';
  const B = (window.B = {});
  B.version = '1.0.0';

  /* ---------- DOM helpers ---------- */
  B.$ = (s, r = document) => r.querySelector(s);
  B.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  B.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  };
  B.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- icons (Lucide subset) ---------- */
  const ICONS = window.BREYE_ICONS || {};
  B.iconNames = Object.keys(ICONS);
  B.iconSVG = function (name, size = 18, stroke = 2, color = 'currentColor') {
    const nodes = ICONS[name] || ICONS.Sparkles || [];
    const inner = nodes.map(([t, a]) => '<' + t + ' ' + Object.entries(a).filter(([k]) => k !== 'key').map(([k, v]) => k + '="' + v + '"').join(' ') + '/>').join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  };
  B.icon = (name, size) => { const s = B.h('span', { class: 'ic', html: B.iconSVG(name, size || 18) }); return s; };
  B.hydrateIcons = function (root = document) {
    B.$$('[data-i]', root).forEach((el) => { if (!el.firstElementChild || el.dataset.iDone !== el.dataset.i) { el.innerHTML = B.iconSVG(el.dataset.i, +el.dataset.size || 18); el.dataset.iDone = el.dataset.i; } });
  };

  /* ---------- small utils ---------- */
  B.uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  B.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  B.lerp = (a, b, t) => a + (b - a) * t;
  B.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  B.debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  B.throttle = (fn, ms = 50) => { let last = 0, t; return (...a) => { const now = Date.now(); clearTimeout(t); if (now - last >= ms) { last = now; fn(...a); } else t = setTimeout(() => { last = Date.now(); fn(...a); }, ms - (now - last)); }; };
  B.fmtTime = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), sec = s - m * 60; return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(1); };
  B.fmtDate = (t) => { const d = new Date(t), now = Date.now(), diff = (now - t) / 1000; if (diff < 60) return 'adesso'; if (diff < 3600) return Math.floor(diff / 60) + ' min fa'; if (diff < 86400) return Math.floor(diff / 3600) + ' h fa'; return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }); };
  B.fmtBytes = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  B.slug = (s) => String(s || 'breye').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'breye';
  B.rand = (a, b) => a + Math.random() * (b - a);
  B.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  B.hexToRgb = (hex) => { hex = String(hex).replace('#', ''); if (hex.length === 3) hex = hex.split('').map((c) => c + c).join(''); const n = parseInt(hex.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  B.rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => B.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

  /* ---------- files & blobs ---------- */
  B.blobToDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  B.blobToText = (blob) => blob.text();
  B.dataURLToBlob = function (url) { const [h, d] = url.split(','); const mime = (h.match(/:(.*?);/) || [])[1] || 'application/octet-stream'; const bin = atob(d); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); };
  B.loadImage = (src) => new Promise((res, rej) => { const im = new Image(); if (typeof src === 'string' && /^https?:/.test(src)) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error('Immagine non leggibile')); im.src = src instanceof Blob ? URL.createObjectURL(src) : src; });
  B.canvasToBlob = (c, type = 'image/png', q = 0.92) => new Promise((res) => c.toBlob((b) => res(b), type, q));
  B.pickFiles = function (accept = '*/*', multiple = false) {
    return new Promise((res) => {
      const inp = B.h('input', { type: 'file', accept, style: 'position:fixed;left:-9999px' });
      if (multiple) inp.multiple = true;
      inp.onchange = () => { res(Array.from(inp.files || [])); inp.remove(); };
      document.body.append(inp); inp.click();
    });
  };
  B.dropzone = function (el, onFiles, accept) {
    const ok = (f) => !accept || accept.split(',').some((a) => { a = a.trim(); return a.endsWith('/*') ? f.type.startsWith(a.slice(0, -1)) : f.type === a || f.name.endsWith(a); });
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); const fs = Array.from(e.dataTransfer.files || []).filter(ok); if (fs.length) onFiles(fs); });
  };

  const scriptCache = {};
  B.loadScript = function (src) {
    if (!scriptCache[src]) scriptCache[src] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = () => res(); s.onerror = () => { delete scriptCache[src]; rej(new Error('Impossibile caricare ' + src.split('/').pop())); };
      document.head.append(s);
    });
    return scriptCache[src];
  };
  B.lib = {
    fabric: 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js',
    marked: 'https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js',
    purify: 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js',
    hljs: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
    cm: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js',
    cmMode: (m) => 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/' + m + '/' + m + '.min.js',
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    pdflib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
    pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfjsWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    qr: 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js',
    html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
  };
  B.need = async function (...names) { for (const n of names) await B.loadScript(B.lib[n]); };

  const fontsLoaded = new Set(['Bricolage Grotesque', 'Figtree', 'Instrument Serif', 'JetBrains Mono']);
  B.loadFont = function (family, weights = '400;700') {
    if (!family || fontsLoaded.has(family)) return Promise.resolve();
    fontsLoaded.add(family);
    const fam = family.replace(/ /g, '+');
    const link = B.h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=' + fam + ':wght@' + weights + '&display=swap' });
    document.head.append(link);
    return new Promise((res) => { link.onload = () => { (document.fonts ? document.fonts.load('400 20px "' + family + '"') : Promise.resolve()).then(res, res); }; link.onerror = res; setTimeout(res, 3500); });
  };

  /* ---------- storage ---------- */
  B.ls = {
    get(k, d) { try { const v = localStorage.getItem('breye:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('breye:' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem('breye:' + k); } catch (e) { /* ignore */ } }
  };
  const mem = { projects: new Map(), blobs: new Map(), gallery: new Map(), chats: new Map(), kv: new Map() };
  let dbp = null;
  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise((res) => {
      try {
        const req = indexedDB.open('breye', 1);
        req.onupgradeneeded = () => { const db = req.result; ['projects', 'blobs', 'gallery', 'chats', 'kv'].forEach((s) => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); }); };
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
        req.onblocked = () => res(null);
      } catch (e) { res(null); }
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return openDB().then((db) => {
      if (!db) return fn(null);
      return new Promise((res, rej) => {
        let out;
        try {
          const t = db.transaction(store, mode); const s = t.objectStore(store);
          out = fn(s);
          t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out);
          t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
        } catch (e) { rej(e); }
      });
    });
  }
  B.db = {
    async put(store, obj) { try { await tx(store, 'readwrite', (s) => s ? s.put(obj) : mem[store].set(obj.id, obj)); } catch (e) { mem[store].set(obj.id, obj); } return obj; },
    async get(store, id) { try { const r = await tx(store, 'readonly', (s) => s ? s.get(id) : null); return r || mem[store].get(id) || null; } catch (e) { return mem[store].get(id) || null; } },
    async del(store, id) { mem[store].delete(id); try { await tx(store, 'readwrite', (s) => s ? s.delete(id) : null); } catch (e) { /* ignore */ } },
    async all(store) { try { const r = await tx(store, 'readonly', (s) => s ? s.getAll() : null); const list = r || []; mem[store].forEach((v, k) => { if (!list.find((x) => x.id === k)) list.push(v); }); return list; } catch (e) { return Array.from(mem[store].values()); } },
    async clear(store) { mem[store].clear(); try { await tx(store, 'readwrite', (s) => s ? s.clear() : null); } catch (e) { /* ignore */ } }
  };

  /* projects */
  B.projects = {
    TYPES: { design: ['Design', 'LayoutTemplate', 'design'], photo: ['Foto', 'Aperture', 'photo'], video: ['Video', 'Clapperboard', 'video'], code: ['Codice', 'Code2', 'code'], doc: ['Documento', 'FileText', 'docs'], motion: ['Video AI', 'Film', 'motion'] },
    async save(p) { p.updated = Date.now(); p.created = p.created || p.updated; await B.db.put('projects', p); B.emit('projects'); return p; },
    async list() { return (await B.db.all('projects')).sort((a, b) => b.updated - a.updated); },
    get: (id) => B.db.get('projects', id),
    async remove(id) { await B.db.del('projects', id); B.emit('projects'); },
    open(p) { const t = B.projects.TYPES[p.type]; if (t) B.go(t[2], { project: p.id }); }
  };

  /* ---------- events ---------- */
  const handlers = {};
  B.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); return () => B.off(ev, fn); };
  B.off = (ev, fn) => { handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn); };
  B.emit = (ev, data) => (handlers[ev] || []).slice().forEach((f) => { try { f(data); } catch (e) { console.error(e); } });

  /* ---------- toasts ---------- */
  B.toast = function (msg, opts = {}) {
    if (typeof opts === 'string') opts = { type: opts };
    const type = opts.type || 'info';
    const ic = opts.icon || (type === 'ok' ? 'CheckCircle2' : type === 'err' ? 'AlertTriangle' : 'Sparkles');
    const el = B.h('div', { class: 'toast ' + type, role: type === 'err' ? 'alert' : 'status' },
      B.h('span', { class: 't-ic', html: B.iconSVG(ic, 17) }),
      B.h('div', { class: 't-tx', html: B.esc(msg) + (opts.sub ? '<small>' + B.esc(opts.sub) + '</small>' : '') }));
    if (opts.action) el.append(B.h('button', { class: 'btn sm', onclick: () => { opts.action.fn(); kill(); } }, opts.action.label));
    B.$('#toasts').append(el);
    let gone = false;
    function kill() { if (gone) return; gone = true; el.classList.add('out'); setTimeout(() => el.remove(), 320); }
    setTimeout(kill, opts.ms || (type === 'err' ? 6500 : 3600));
    el.addEventListener('click', (e) => { if (e.target === el) kill(); });
    return kill;
  };
  B.err = (e, fallback) => { console.warn(e); B.toast((e && e.userMessage) || fallback || (e && e.message) || 'Qualcosa non ha funzionato', { type: 'err' }); };

  /* ---------- modals ---------- */
  B.modal = function ({ title, body, wide, xwide, actions = [], onClose, icon, dismiss = true }) {
    const root = B.$('#modalRoot');
    const wrap = B.h('div', { class: 'modal-wrap' });
    const box = B.h('div', { class: 'modal' + (wide ? ' wide' : '') + (xwide ? ' xwide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Finestra' });
    const head = B.h('div', { class: 'modal-h' }, icon ? B.h('span', { class: 'bt-ic', 'data-i': icon, style: 'color:var(--gold)' }) : null, B.h('h3', { text: title || '' }), B.h('button', { class: 'btn icon ghost sm', 'aria-label': 'Chiudi', 'data-i': 'X', onclick: () => close() }));
    const b = B.h('div', { class: 'modal-b scroll' });
    if (typeof body === 'string') b.innerHTML = body; else if (body) b.append(body);
    box.append(head, b);
    let resolver;
    const done = new Promise((r) => (resolver = r));
    if (actions.length) {
      const f = B.h('div', { class: 'modal-f' });
      actions.forEach((a) => f.append(B.h('button', { class: 'btn ' + (a.kind || ''), onclick: async () => { if (a.fn) { const r = await a.fn(b); if (r === false) return; } close(a.value); } }, a.icon ? B.h('span', { 'data-i': a.icon }) : null, a.label)));
      box.append(f);
    }
    wrap.append(box); root.append(wrap); B.hydrateIcons(wrap);
    if (dismiss) wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
    const onKey = (e) => { if (e.key === 'Escape' && dismiss) { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    function close(v) { document.removeEventListener('keydown', onKey, true); wrap.style.animation = 'fadeIn .18s reverse forwards'; setTimeout(() => wrap.remove(), 170); if (onClose) onClose(v); resolver(v); }
    setTimeout(() => { const f = B.$('input, textarea, select', b); if (f) f.focus(); }, 60);
    return { el: b, box, close, done };
  };
  B.confirm = (title, text, okLabel = 'Conferma', danger) => B.modal({ title, body: B.h('p', { text, style: 'color:var(--text-2)' }), actions: [{ label: 'Annulla', value: false }, { label: okLabel, kind: danger ? 'danger' : 'gold', value: true }] }).done;
  B.prompt = (title, value = '', placeholder = '', okLabel = 'OK') => {
    const inp = B.h('input', { class: 'input', id: 'bPromptIn', value, placeholder });
    const m = B.modal({ title, body: inp, actions: [{ label: 'Annulla', value: null }, { label: okLabel, kind: 'gold', fn: () => { m._v = inp.value; } }] });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { m._v = inp.value; m.close(); } });
    return m.done.then((v) => v === null ? null : m._v ?? null);
  };

  /* ---------- menus ---------- */
  let openMenu = null;
  B.menu = function (anchor, items, opts = {}) {
    B.closeMenu();
    const m = B.h('div', { class: 'menu', role: 'menu' });
    items.forEach((it) => {
      if (it === '-') return m.append(B.h('hr'));
      if (it.header) return m.append(B.h('div', { class: 'm-h', text: it.header }));
      m.append(B.h('button', { type: 'button', role: 'menuitem', class: it.active ? 'act' : '', onclick: () => { B.closeMenu(); it.fn && it.fn(); } }, it.icon ? B.h('span', { 'data-i': it.icon }) : null, B.h('span', { text: it.label }), it.kbd ? B.h('span', { class: 'm-k', text: it.kbd }) : null));
    });
    document.body.append(m); B.hydrateIcons(m);
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, top: anchor.y, bottom: anchor.y, right: anchor.x, width: 0 };
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let x = opts.align === 'right' ? r.right - mw : r.left, y = r.bottom + 6;
    if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 6);
    x = B.clamp(x, 8, innerWidth - mw - 8);
    m.style.left = x + 'px'; m.style.top = y + 'px';
    openMenu = m;
    setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
    function outside(e) { if (!m.contains(e.target)) { B.closeMenu(); } }
    m._off = () => document.removeEventListener('mousedown', outside, true);
    return m;
  };
  B.closeMenu = () => { if (openMenu) { openMenu._off(); openMenu.remove(); openMenu = null; } };

  /* ---------- tooltips ---------- */
  (function () {
    let t, cur;
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (el === cur) return; cur = el; clearTimeout(t);
      const tip = B.$('#tip'); if (!tip) return; tip.hidden = true;
      if (!el) return;
      t = setTimeout(() => {
        if (!document.body.contains(el)) return;
        tip.textContent = el.dataset.tip; tip.hidden = false;
        const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
        let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
        if (el.closest('.side')) { x = r.right + 10; y = r.top + r.height / 2 - h / 2; }
        if (y + h > innerHeight - 6) y = r.top - h - 8;
        tip.style.left = B.clamp(x, 6, innerWidth - w - 6) + 'px'; tip.style.top = y + 'px';
      }, 420);
    });
    document.addEventListener('mousedown', () => { clearTimeout(t); const tip = B.$('#tip'); if (tip) tip.hidden = true; });
  })();

  /* ---------- saving files ---------- */
  B.save = async function (blob, filename) {
    if (typeof blob === 'string') blob = blob.startsWith('data:') ? B.dataURLToBlob(blob) : new Blob([blob], { type: 'text/plain' });
    try {
      const dl = B.cap && B.cap.downloads;
      if (dl) {
        await dl.save({ filename, data: blob });
        B.toast('File pronto: ' + filename, { type: 'ok', icon: 'Download' });
        return true;
      }
    } catch (e) {
      if (e && (e.code === 'cancelled' || e.code === 'declined')) return false;
      console.warn('downloads capability failed', e);
    }
    const url = URL.createObjectURL(blob);
    const a = B.h('a', { href: url, download: filename, style: 'display:none' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 20000);
    B.toast('Download avviato: ' + filename, { type: 'ok', icon: 'Download' });
    return true;
  };
  B.copy = async function (text) {
    try { await navigator.clipboard.writeText(text); B.toast('Copiato negli appunti', { type: 'ok', icon: 'Copy' }); return true; }
    catch (e) {
      const ta = B.h('textarea', { style: 'position:fixed;left:-9999px' }); ta.value = text; document.body.append(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (er) { /* ignore */ }
      ta.remove(); B.toast(ok ? 'Copiato negli appunti' : 'Seleziona il testo e copialo con Ctrl C', { type: ok ? 'ok' : 'info' }); return ok;
    }
  };

  /* ---------- range helper (filled track) ---------- */
  B.rangeFill = (r) => { const p = ((r.value - (r.min || 0)) / ((r.max || 100) - (r.min || 0))) * 100; r.style.setProperty('--p', p + '%'); };
  document.addEventListener('input', (e) => { if (e.target.classList && e.target.classList.contains('range')) B.rangeFill(e.target); });
  B.slider = function ({ label, min = 0, max = 100, step = 1, value = 0, unit = '', onInput, onChange, id }) {
    const wrap = B.h('div', { class: 'slider' });
    const v = B.h('span', { class: 's-v', text: value + unit });
    const r = B.h('input', { class: 'range', type: 'range', min, max, step, value, id: id || B.uid('r'), 'aria-label': label });
    r.addEventListener('input', () => { v.textContent = (+r.value) + unit; onInput && onInput(+r.value); });
    r.addEventListener('change', () => onChange && onChange(+r.value));
    r.addEventListener('dblclick', () => { r.value = value; B.rangeFill(r); v.textContent = value + unit; onInput && onInput(+value); onChange && onChange(+value); });
    wrap.append(B.h('span', { class: 's-l', text: label }), v, r);
    B.rangeFill(r);
    wrap.set = (val) => { r.value = val; v.textContent = (+val) + unit; B.rangeFill(r); };
    wrap.input = r;
    return wrap;
  };

  /* ---------- views & router ---------- */
  const views = {};
  const order = [];
  B.views = views;
  B.view = function (name, def) { views[name] = Object.assign({ name, mounted: false }, def); if (!def.hidden) order.push(name); };
  let current = null, pending = {};
  B.current = () => current;
  B.go = function (name, params) {
    if (!views[name]) name = 'home';
    pending[name] = params || null;
    if (location.hash.slice(1) !== name) { history.pushState(null, '', '#' + name); }
    show(name);
  };
  function show(name) {
    if (!views[name]) name = 'home';
    const v = views[name];
    if (current && current !== name && views[current].el) {
      const old = views[current];
      old.el.hidden = true; old.el.classList.remove('enter');
      old.onHide && old.onHide();
    }
    if (!v.mounted) {
      v.el = B.h('section', { class: 'view', 'data-view': name, 'aria-label': v.title });
      B.$('#views').append(v.el);
      try { v.mount(v.el); } catch (e) { console.error(e); v.el.append(B.h('div', { class: 'empty', text: 'Errore nel caricamento della sezione: ' + e.message })); }
      v.mounted = true;
      B.hydrateIcons(v.el);
    }
    v.el.hidden = false;
    void v.el.offsetWidth; v.el.classList.add('enter');
    const prev = current; current = name;
    B.$$('#nav .nav-item').forEach((n) => n.classList.toggle('on', n.dataset.nav === name));
    document.title = (v.title ? v.title + ' · ' : '') + 'Breye Studio';
    const params = pending[name]; pending[name] = null;
    try { v.onShow && v.onShow(params || {}, prev); } catch (e) { console.error(e); }
    B.hydrateIcons(v.el);
    B.closeMenu();
  }
  window.addEventListener('popstate', () => show(location.hash.slice(1) || 'home'));
  B.buildNav = function () {
    const nav = B.$('#nav'); nav.innerHTML = '';
    const groups = {};
    order.forEach((n) => { const v = views[n]; (groups[v.group || 'main'] = groups[v.group || 'main'] || []).push(v); });
    ['main', 'ai', 'studio', 'more'].forEach((g, gi) => {
      if (!groups[g]) return;
      if (gi > 0) nav.append(B.h('div', { class: 'nav-sep' }));
      groups[g].forEach((v) => nav.append(B.h('a', { class: 'nav-item', href: '#' + v.name, 'data-nav': v.name, 'data-tip': v.title, onclick: (e) => { e.preventDefault(); B.go(v.name); B.$('#side').classList.remove('open'); } },
        B.h('span', { class: 'ni-ic', 'data-i': v.icon }), B.h('span', { class: 'ni-tx', text: v.title }), v.badge ? B.h('span', { class: 'ni-new', text: v.badge }) : null)));
    });
    B.hydrateIcons(nav);
  };
  B.start = function () { B.buildNav(); show(location.hash.slice(1) || 'home'); };

  /* ---------- keyboard shortcuts ---------- */
  const keys = [];
  B.key = function (combo, fn, view) { keys.push({ combo: combo.toLowerCase(), fn, view }); };
  B.isTyping = (e) => { const t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) && !(t.type === 'range' || t.type === 'checkbox'); };
  document.addEventListener('keydown', (e) => {
    const combo = (e.ctrlKey || e.metaKey ? 'mod+' : '') + (e.shiftKey ? 'shift+' : '') + (e.altKey ? 'alt+' : '') + e.key.toLowerCase();
    for (const k of keys) {
      if (k.combo !== combo) continue;
      if (k.view && k.view !== current) continue;
      if (B.isTyping(e) && !/mod\+/.test(combo)) continue;
      const r = k.fn(e);
      if (r !== false) { e.preventDefault(); return; }
    }
  });

  /* ---------- command palette ---------- */
  const commands = [];
  B.command = (c) => commands.push(c);
  let cmdSel = 0, cmdItems = [];
  B.openCmdk = function (q = '') {
    const box = B.$('#cmdk'); box.hidden = false;
    const inp = B.$('#cmdkInput'); inp.value = q; renderCmd(); setTimeout(() => inp.focus(), 20);
  };
  B.closeCmdk = () => { B.$('#cmdk').hidden = true; };
  async function renderCmd() {
    const q = B.$('#cmdkInput').value.trim().toLowerCase();
    const list = B.$('#cmdkList'); list.innerHTML = '';
    const items = [];
    order.forEach((n) => { const v = views[n]; items.push({ group: 'Vai a', title: v.title, sub: v.desc || '', icon: v.icon, run: () => B.go(n) }); });
    commands.forEach((c) => items.push(Object.assign({ group: 'Azioni' }, c)));
    let projs = [];
    try { projs = (await B.projects.list()).slice(0, 30); } catch (e) { /* ignore */ }
    projs.forEach((p) => items.push({ group: 'Progetti', title: p.name, sub: (B.projects.TYPES[p.type] || ['Progetto'])[0] + ' · ' + B.fmtDate(p.updated), icon: (B.projects.TYPES[p.type] || [0, 'Folder'])[1], run: () => B.projects.open(p) }));
    cmdItems = items.filter((it) => !q || (it.title + ' ' + (it.sub || '') + ' ' + (it.keywords || '')).toLowerCase().includes(q));
    if (q) cmdItems.push({ group: 'Iris AI', title: 'Chiedi a Iris: “' + q + '”', sub: 'Apre la chat con questa domanda', icon: 'Sparkles', run: () => B.go('chat', { ask: B.$('#cmdkInput').value.trim() }) });
    cmdSel = B.clamp(cmdSel, 0, Math.max(0, cmdItems.length - 1));
    let g = null;
    cmdItems.forEach((it, i) => {
      if (it.group !== g) { g = it.group; list.append(B.h('div', { class: 'cmdk-group', text: g })); }
      list.append(B.h('div', { class: 'cmdk-item' + (i === cmdSel ? ' act' : ''), 'data-idx': i, onclick: () => { B.closeCmdk(); it.run(); }, onmousemove: () => { if (cmdSel !== i) { cmdSel = i; mark(); } } },
        B.h('span', { class: 'ck-ic', 'data-i': it.icon || 'Sparkles' }), B.h('div', null, B.h('div', { class: 'ck-t', text: it.title }), it.sub ? B.h('div', { class: 'ck-s', text: it.sub }) : null)));
    });
    B.hydrateIcons(list);
  }
  function mark() { B.$$('.cmdk-item').forEach((el) => el.classList.toggle('act', +el.dataset.idx === cmdSel)); const a = B.$('.cmdk-item.act'); a && a.scrollIntoView({ block: 'nearest' }); }
  document.addEventListener('DOMContentLoaded', () => {
    const inp = B.$('#cmdkInput');
    inp.addEventListener('input', () => { cmdSel = 0; renderCmd(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { cmdSel = Math.min(cmdItems.length - 1, cmdSel + 1); mark(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { cmdSel = Math.max(0, cmdSel - 1); mark(); e.preventDefault(); }
      else if (e.key === 'Enter') { const it = cmdItems[cmdSel]; if (it) { B.closeCmdk(); it.run(); } }
      else if (e.key === 'Escape') B.closeCmdk();
    });
    B.$('#cmdk').addEventListener('mousedown', (e) => { if (e.target.id === 'cmdk') B.closeCmdk(); });
  });
  B.key('mod+k', () => { B.$('#cmdk').hidden ? B.openCmdk() : B.closeCmdk(); });

  /* ---------- theme ---------- */
  B.theme = {
    get() { return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); },
    set(t) { document.documentElement.dataset.theme = t; B.ls.set('theme', t); const ic = B.$('#themeBtn [data-i]'); if (ic) { ic.dataset.i = t === 'light' ? 'Sun' : 'Moon'; B.hydrateIcons(ic.parentElement); } B.emit('theme', t); },
    toggle() { B.theme.set(B.theme.get() === 'light' ? 'dark' : 'light'); }
  };

  /* capability namespaces (filled by ai.js) */
  B.cap = {};

  /* ---------- markdown rendering ---------- */
  B.md = async function (text) {
    await B.need('marked', 'purify');
    try { await B.need('hljs'); } catch (e) { /* optional */ }
    const html = window.marked.parse(String(text || ''), { gfm: true, breaks: true });
    const clean = window.DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
    return clean;
  };
  B.enhanceCode = function (root, extra) {
    B.$$('pre > code', root).forEach((code) => {
      if (code.dataset.done) return; code.dataset.done = 1;
      if (window.hljs) { try { window.hljs.highlightElement(code); } catch (e) { /* ignore */ } }
      const pre = code.parentElement;
      const lang = ((code.className.match(/language-(\w+)/) || [])[1] || 'code');
      const head = B.h('div', { class: 'code-head' }, B.h('span', { class: 'mono', text: lang }));
      const actions = B.h('div', { class: 'code-acts' });
      actions.append(B.h('button', { class: 'btn ghost sm', onclick: () => B.copy(code.textContent) }, B.h('span', { 'data-i': 'Copy' }), 'Copia'));
      if (extra) extra(actions, code.textContent, lang);
      head.append(actions);
      const wrap = B.h('div', { class: 'code-wrap' }); pre.before(wrap); wrap.append(head, pre);
    });
    B.$$('a', root).forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
    B.hydrateIcons(root);
  };
})();
