// Componenti di interfaccia: icone, notifiche a comparsa, finestre modali, menu, animazioni.
import { ICONS } from './icons.js';
import { esc, initials, colorFor } from './format.js';

export function icon(name, size = 18, extra = '') {
  const inner = ICONS[name] || ICONS['circle'];
  const brand = name.startsWith('brand-');
  return `<svg class="ico ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${brand ? 0 : 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// Delegazione eventi: on(root, 'click', '[data-act]', (e, target) => ...)
export function on(root, type, selector, fn) {
  const h = e => {
    const t = e.target.closest(selector);
    if (t && root.contains(t)) fn(e, t);
  };
  root.addEventListener(type, h);
  return () => root.removeEventListener(type, h);
}

export function avatar(p, size = 40, photoUrl) {
  const name = `${p?.nome || ''} ${p?.cognome || ''}`;
  const c = p?.colore || colorFor(name);
  const url = photoUrl || (p?.foto ? window.athlos.media.url(p.foto) : '');
  if (url) return `<span class="avatar" style="--s:${size}px"><img src="${url}" alt=""></span>`;
  return `<span class="avatar" style="--s:${size}px;--c:${c}">${esc(initials(p?.nome, p?.cognome).toUpperCase())}</span>`;
}

// ------------------------------------------------------------------ toast
let toastHost;
export function toast(message, { type = 'success', duration = 3600, action } = {}) {
  if (!toastHost) {
    toastHost = el('<div class="toast-host"></div>');
    document.body.appendChild(toastHost);
  }
  const icons = { success: 'circle-check', error: 'circle-x', warning: 'triangle-alert', info: 'info' };
  const t = el(`<div class="toast ${type}">
      <span class="toast-ico">${icon(icons[type] || 'info', 20)}</span>
      <span class="toast-msg">${esc(message)}</span>
      ${action ? `<button class="toast-act">${esc(action.label)}</button>` : ''}
      <button class="toast-x" aria-label="Chiudi">${icon('x', 16)}</button>
      <span class="toast-bar" style="animation-duration:${duration}ms"></span>
    </div>`);
  toastHost.appendChild(t);
  const close = () => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  };
  const timer = setTimeout(close, duration);
  t.querySelector('.toast-x').onclick = () => { clearTimeout(timer); close(); };
  if (action) t.querySelector('.toast-act').onclick = () => { clearTimeout(timer); close(); action.fn(); };
  return close;
}

// ------------------------------------------------------------------ modale
const modalStack = [];
export function modal({ title, subtitle, body = '', actions = [], size = 'md', onOpen, onClose, icon: ic, className = '', dismissable = true }) {
  const back = el(`<div class="modal-back ${className}">
    <div class="modal ${size}" role="dialog" aria-modal="true">
      ${title ? `<header class="modal-head">
        ${ic ? `<span class="modal-ico">${icon(ic, 22)}</span>` : ''}
        <div><h3>${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
        ${dismissable ? `<button class="btn icon ghost modal-x" aria-label="Chiudi">${icon('x', 18)}</button>` : ''}
      </header>` : ''}
      <div class="modal-body"></div>
      ${actions.length ? '<footer class="modal-foot"></footer>' : ''}
    </div>
  </div>`);
  const bodyEl = back.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
  let closed = false;
  const api = {
    el: back.querySelector('.modal'),
    body: bodyEl,
    close(result) {
      if (closed) return;
      closed = true;
      back.classList.add('out');
      const i = modalStack.indexOf(api);
      if (i >= 0) modalStack.splice(i, 1);
      setTimeout(() => back.remove(), 220);
      onClose && onClose(result);
    },
  };
  const foot = back.querySelector('.modal-foot');
  for (const a of actions) {
    const b = el(`<button class="btn ${a.kind || ''}">${a.icon ? icon(a.icon, 16) : ''}<span>${esc(a.label)}</span></button>`);
    b.onclick = async () => {
      if (a.fn) {
        b.disabled = true;
        try {
          const r = await a.fn(api);
          if (r !== false) api.close(r);
        } finally {
          b.disabled = false;
        }
      } else api.close();
    };
    if (a.left) b.style.marginRight = 'auto';
    foot.appendChild(b);
  }
  if (dismissable) {
    back.addEventListener('mousedown', e => { if (e.target === back) api.close(); });
    const x = back.querySelector('.modal-x');
    if (x) x.onclick = () => api.close();
  }
  document.body.appendChild(back);
  modalStack.push(api);
  requestAnimationFrame(() => back.classList.add('in'));
  onOpen && onOpen(api);
  const first = bodyEl.querySelector('input:not([type=hidden]):not([disabled]), textarea, select');
  if (first) setTimeout(() => first.focus(), 60);
  return api;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalStack.length) {
    const top = modalStack[modalStack.length - 1];
    if (!top.el.closest('.modal-back').classList.contains('locked')) top.close();
  }
});

export function confirmDialog(message, { title = 'Sei sicuro?', okLabel = 'Conferma', danger = false, icon: ic } = {}) {
  return new Promise(resolve => {
    modal({
      title,
      icon: ic || (danger ? 'triangle-alert' : 'circle-help'),
      size: 'sm',
      body: `<p class="lead">${esc(message)}</p>`,
      onClose: r => resolve(!!r),
      actions: [
        { label: 'Annulla', kind: 'ghost', fn: m => { m.close(false); return false; } },
        { label: okLabel, kind: danger ? 'danger' : 'primary', fn: () => true },
      ],
    });
  });
}

export function promptDialog({ title, label, value = '', placeholder = '', okLabel = 'Salva', type = 'text' }) {
  return new Promise(resolve => {
    modal({
      title,
      size: 'sm',
      body: `<label class="field"><span>${esc(label)}</span><input type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`,
      onClose: r => resolve(r ?? null),
      onOpen: m => {
        const inp = m.body.querySelector('input');
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') m.close(inp.value); });
      },
      actions: [
        { label: 'Annulla', kind: 'ghost', fn: m => { m.close(null); return false; } },
        { label: okLabel, kind: 'primary', fn: m => m.body.querySelector('input').value },
      ],
    });
  });
}

// ------------------------------------------------------------------ menu a comparsa
export function popMenu(anchor, items, { align = 'right' } = {}) {
  document.querySelectorAll('.popmenu').forEach(m => m.remove());
  const m = el(`<div class="popmenu" role="menu"></div>`);
  for (const it of items) {
    if (it === '-') { m.appendChild(el('<div class="popmenu-sep"></div>')); continue; }
    if (it.header) { m.appendChild(el(`<div class="popmenu-head">${esc(it.header)}</div>`)); continue; }
    const b = el(`<button class="popmenu-item ${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled' : ''}>${it.icon ? icon(it.icon, 16) : ''}<span>${esc(it.label)}</span>${it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ''}</button>`);
    b.onclick = () => { m.remove(); it.fn && it.fn(); };
    m.appendChild(b);
  }
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const mw = m.offsetWidth;
  const mh = m.offsetHeight;
  let left = align === 'right' ? r.right - mw : r.left;
  let top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = r.top - mh - 6;
  left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
  m.style.left = left + 'px';
  m.style.top = Math.max(8, top) + 'px';
  setTimeout(() => {
    const close = e => {
      if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', close); }
    };
    document.addEventListener('mousedown', close);
  });
  return m;
}

// ------------------------------------------------------------------ animazioni
export function countUp(node, to, { duration = 900, format = v => Math.round(v).toLocaleString('it-IT') } = {}) {
  const from = 0;
  const start = performance.now();
  const step = now => {
    const p = Math.min(1, (now - start) / duration);
    const e = 1 - Math.pow(1 - p, 3);
    node.textContent = format(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function confetti({ count = 160, origin = { x: 0.5, y: 0.35 } } = {}) {
  const c = el('<canvas class="confetti"></canvas>');
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const W = (c.width = window.innerWidth * devicePixelRatio);
  const H = (c.height = window.innerHeight * devicePixelRatio);
  const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F97316', '#FACC15', '#10B981', '#0EA5E9'];
  const parts = Array.from({ length: count }, () => ({
    x: origin.x * W,
    y: origin.y * H,
    vx: (Math.random() - 0.5) * 22 * devicePixelRatio,
    vy: (Math.random() * -16 - 6) * devicePixelRatio,
    s: (Math.random() * 7 + 5) * devicePixelRatio,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    c: colors[(Math.random() * colors.length) | 0],
    shape: Math.random() < 0.3 ? 'c' : 'r',
  }));
  let frame = 0;
  const tick = () => {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.45 * devicePixelRatio;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.max(0, 1 - frame / 170);
      if (p.shape === 'c') { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (++frame < 180) requestAnimationFrame(tick); else c.remove();
  };
  tick();
}

export function ripple(e) {
  const b = e.target.closest('.btn');
  if (!b || b.disabled) return;
  const r = b.getBoundingClientRect();
  const s = el('<span class="ripple"></span>');
  const d = Math.max(r.width, r.height) * 2;
  s.style.width = s.style.height = d + 'px';
  s.style.left = e.clientX - r.left - d / 2 + 'px';
  s.style.top = e.clientY - r.top - d / 2 + 'px';
  b.appendChild(s);
  setTimeout(() => s.remove(), 600);
}

export function emptyState({ icon: ic = 'inbox', title, text, action }) {
  return `<div class="empty">
    <div class="empty-art">${icon(ic, 34)}</div>
    <h3>${esc(title)}</h3>
    ${text ? `<p>${esc(text)}</p>` : ''}
    ${action ? `<button class="btn primary" data-empty-act>${action.icon ? icon(action.icon, 16) : ''}<span>${esc(action.label)}</span></button>` : ''}
  </div>`;
}

// Ridimensiona un'immagine scelta dall'utente e la salva nell'archivio media
export async function pickImage({ max = 512, quality = 0.88, square = false } = {}) {
  const files = await window.athlos.file.open({
    title: 'Scegli un\'immagine',
    filters: [{ name: 'Immagini', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] }],
  });
  if (!files.length) return null;
  return resizeToMedia(files[0].url, { max, quality, square });
}

export async function resizeToMedia(url, { max = 512, quality = 0.88, square = false, type = 'image/png' } = {}) {
  const img = await loadImage(url);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  let sx = 0, sy = 0, sw = w, sh = h;
  if (square) {
    const s = Math.min(w, h);
    sx = (w - s) / 2; sy = (h - s) / 2; sw = sh = s; w = h = s;
  }
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, type, quality));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return window.athlos.media.save(bytes, type === 'image/png' ? 'png' : 'jpg');
}

export function loadImage(url) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
}

export async function mediaToDataUrl(name) {
  if (!name) return '';
  const res = await fetch(window.athlos.media.url(name));
  const blob = await res.blob();
  return new Promise(r => {
    const fr = new FileReader();
    fr.onload = () => r(fr.result);
    fr.readAsDataURL(blob);
  });
}

export function skeleton(rows = 4) {
  return `<div class="skeleton-list">${Array.from({ length: rows }, () => '<div class="skeleton"></div>').join('')}</div>`;
}
