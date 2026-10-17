// Motore di Salto Studio: carica i media, sincronizza video e audio con il tempo
// e disegna ogni fotogramma (anteprima ed esportazione) con filtri, effetti e transizioni.
import { S, end, track } from './state.js';
import { filterById, ANIMS, LOOPS, drawTransition, drawShape, scratch } from './effects.js';
import { ICONS } from '../lib/icons.js';

const images = new Map(); // src -> HTMLImageElement
const clipEls = new Map(); // clip.id -> HTMLVideoElement | HTMLAudioElement
const iconCache = new Map();
const layoutCache = new Map();
let elHook = null;

export function onMediaElement(fn) { elHook = fn; }

// ------------------------------------------------------------------ media
export function loadImage(src) {
  if (images.has(src)) return Promise.resolve(images.get(src));
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    img.onload = () => { images.set(src, img); res(img); };
    img.onerror = () => rej(new Error('Immagine non leggibile'));
    img.src = src;
  });
}

export function probeMedia(src, kind) {
  return new Promise((res, rej) => {
    if (kind === 'image') { loadImage(src).then(img => res({ kind, width: img.naturalWidth, height: img.naturalHeight, duration: 5 })).catch(rej); return; }
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.preload = 'metadata';
    el.crossOrigin = 'anonymous';
    el.muted = true;
    el.onloadedmetadata = () => res({ kind, width: el.videoWidth || 0, height: el.videoHeight || 0, duration: Number.isFinite(el.duration) ? el.duration : 10 });
    el.onerror = () => rej(new Error('File non supportato'));
    el.src = src;
  });
}

export function elFor(c) {
  let el = clipEls.get(c.id);
  if (el && el.dataset.src === c.src) return el;
  if (el) { el.pause(); el.removeAttribute('src'); el.load(); }
  el = document.createElement(c.type === 'video' ? 'video' : 'audio');
  el.preload = 'auto';
  el.playsInline = true;
  el.crossOrigin = 'anonymous';
  el.dataset.src = c.src;
  el.src = c.src;
  el.currentTime = c.in || 0;
  clipEls.set(c.id, el);
  if (elHook) elHook(el, c);
  return el;
}

export function dropUnusedElements() {
  const ids = new Set(S.project.clips.map(c => c.id));
  for (const [id, el] of clipEls) {
    if (!ids.has(id)) { el.pause(); el.removeAttribute('src'); el.load(); clipEls.delete(id); }
  }
}

export function allElements() { return clipEls; }

// ------------------------------------------------------------------ sincronizzazione
export function syncMedia(t, playing) {
  for (const c of S.project.clips) {
    if (c.type !== 'video' && c.type !== 'audio') continue;
    const el = elFor(c);
    const tr = track(c.trackId);
    const active = t >= c.start && t < end(c);
    const target = (c.in || 0) + (t - c.start) * (c.speed || 1);
    el.playbackRate = Math.max(0.0625, Math.min(16, c.speed || 1));
    el.preservesPitch = !['chipmunk', 'monster'].includes(c.voiceFx);
    if (active) {
      if (playing) {
        if (el.paused) { safeSeek(el, target); el.play().catch(() => {}); } else if (Math.abs(el.currentTime - target) > 0.3) safeSeek(el, target);
      } else {
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - target) > 0.03) safeSeek(el, target);
      }
    } else {
      if (!el.paused) el.pause();
      if (t < c.start && c.start - t < 2 && Math.abs(el.currentTime - (c.in || 0)) > 0.1) safeSeek(el, c.in || 0);
    }
    el.muted = !!(c.muted || (tr && tr.muted));
  }
}

function safeSeek(el, t) {
  if (!Number.isFinite(t)) return;
  try { el.currentTime = Math.max(0, Math.min(t, (el.duration || t + 1) - 0.01)); } catch { /* non ancora pronto */ }
}

export function pauseAll() { for (const el of clipEls.values()) if (!el.paused) el.pause(); }

// attende che i video attivi abbiano completato il posizionamento (anteprima precisa)
export function settle(t) {
  const waits = [];
  for (const c of S.project.clips) {
    if (c.type !== 'video') continue;
    if (t < c.start || t >= end(c)) continue;
    const el = elFor(c);
    if (el.seeking || el.readyState < 2) {
      waits.push(new Promise(r => {
        const done = () => { el.removeEventListener('seeked', done); el.removeEventListener('loadeddata', done); r(); };
        el.addEventListener('seeked', done);
        el.addEventListener('loadeddata', done);
        setTimeout(done, 600);
      }));
    }
  }
  return Promise.all(waits);
}

// ------------------------------------------------------------------ testo
function fontString(c, size = c.size) {
  return `${c.italic ? 'italic ' : ''}${c.weight || 700} ${size}px "${c.font}", "Plus Jakarta Sans", sans-serif`;
}

export function layoutText(ctx, c) {
  const text = c.uppercase ? String(c.text || '').toUpperCase() : String(c.text || '');
  const key = [text, c.font, c.size, c.weight, c.italic, c.w, c.letterSpacing, c.lineHeight, c.bg?.enabled, c.bg?.padding].join('|');
  const hit = layoutCache.get(c.id);
  if (hit && hit.key === key) return hit;
  ctx.save();
  ctx.font = fontString(c);
  ctx.letterSpacing = `${c.letterSpacing || 0}px`;
  const pad = c.bg?.enabled ? c.bg.padding || 0 : 0;
  const maxW = Math.max(40, c.w - pad * 2);
  const lines = [];
  for (const para of text.split('\n')) {
    const words = para.split(/(\s+)/);
    let line = '';
    for (const w of words) {
      const test = line + w;
      if (ctx.measureText(test).width > maxW && line.trim()) { lines.push(line.trimEnd()); line = w.trimStart(); } else line = test;
    }
    lines.push(line);
  }
  const lineH = c.size * (c.lineHeight || 1.15);
  const widths = lines.map(l => ctx.measureText(l).width);
  ctx.restore();
  const out = { key, lines, widths, lineH, width: Math.max(...widths, 10), height: lines.length * lineH, pad };
  layoutCache.set(c.id, out);
  return out;
}

function drawText(ctx, c, st) {
  const L = layoutText(ctx, c);
  const h = L.height + L.pad * 2;
  c.h = Math.round(h);
  ctx.font = fontString(c);
  ctx.letterSpacing = `${c.letterSpacing || 0}px`;
  ctx.textBaseline = 'middle';
  const W = c.w;
  if (c.bg?.enabled) {
    const bw = c.bg.radius >= 999 ? L.width + L.pad * 2 : W;
    ctx.save();
    ctx.fillStyle = c.bg.color;
    ctx.beginPath();
    const r = Math.min(c.bg.radius || 0, h / 2);
    const bx = c.align === 'left' ? -W / 2 : c.align === 'right' ? W / 2 - bw : -bw / 2;
    ctx.roundRect(bx, -h / 2, bw, h, r);
    ctx.fill();
    ctx.restore();
  }
  let fill = c.color;
  if (c.gradient && c.gradient.length > 1) {
    const g = ctx.createLinearGradient(-L.width / 2, -h / 2, L.width / 2, h / 2);
    c.gradient.forEach((col, i) => g.addColorStop(i / (c.gradient.length - 1), col));
    fill = g;
  }
  const total = L.lines.join('').length;
  const reveal = st.reveal ?? 1;
  const mode = st.mode;
  let shown = Math.floor(total * reveal + 1e-6);
  let wordIndex = 0;
  const wordCount = L.lines.join(' ').split(/\s+/).filter(Boolean).length;
  L.lines.forEach((line, i) => {
    const y = -h / 2 + L.pad + L.lineH * (i + 0.5);
    const lw = L.widths[i];
    const x0 = c.align === 'left' ? -W / 2 + L.pad : c.align === 'right' ? W / 2 - L.pad - lw : -lw / 2;
    const paint = (txt, x, yy) => {
      if (c.textShadow?.enabled) { ctx.shadowColor = c.textShadow.color; ctx.shadowBlur = c.textShadow.blur; ctx.shadowOffsetX = c.textShadow.x; ctx.shadowOffsetY = c.textShadow.y; }
      if (c.stroke?.width > 0) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = c.stroke.width * 2;
        ctx.strokeStyle = c.stroke.color;
        ctx.strokeText(txt, x, yy);
        ctx.shadowColor = 'transparent';
      }
      ctx.fillStyle = fill;
      ctx.fillText(txt, x, yy);
      ctx.shadowColor = 'transparent';
    };
    ctx.textAlign = 'left';
    if (!mode || reveal >= 1) { paint(line, x0, y); return; }
    if (mode === 'chars') {
      const part = line.slice(0, Math.max(0, shown));
      shown -= line.length;
      if (part) paint(part, x0, y);
      return;
    }
    // parole o lettere animate una alla volta
    const units = mode === 'words' ? line.split(/(\s+)/) : [...line];
    let x = x0;
    const n = mode === 'words' ? wordCount : total;
    for (const u of units) {
      const uw = ctx.measureText(u).width;
      if (!u.trim()) { x += uw; continue; }
      const idx = mode === 'words' ? wordIndex++ : wordIndex++;
      const local = Math.min(1, Math.max(0, reveal * (n + 2) - idx));
      if (local > 0) {
        ctx.save();
        if (mode === 'words') {
          const s = local < 1 ? 0.3 + 0.7 * (1 + 2.7 * Math.pow(local - 1, 3) + 1.7 * Math.pow(local - 1, 2)) : 1;
          ctx.translate(x + uw / 2, y);
          ctx.scale(s, s);
          ctx.globalAlpha *= Math.min(1, local * 2);
          paint(u, -uw / 2, 0);
        } else {
          ctx.globalAlpha *= local;
          paint(u, x, y + (1 - local) * c.size * 0.6);
        }
        ctx.restore();
      }
      x += uw;
    }
  });
}

// ------------------------------------------------------------------ icone come immagini
function iconImage(name, color) {
  const key = name + color;
  if (iconCache.has(key)) return iconCache.get(key);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  iconCache.set(key, img);
  return img;
}

// ------------------------------------------------------------------ filtri css
function cssFilter(c, st) {
  const f = filterById(c.filter);
  const a = c.adjust || {};
  const parts = [];
  if (f.css && (c.filterAmount ?? 1) > 0) parts.push(f.css);
  const exp = (a.exposure || 0) / 100;
  if (a.brightness || exp) parts.push(`brightness(${(1 + (a.brightness || 0) / 100) * (1 + exp)})`);
  if (a.contrast) parts.push(`contrast(${1 + a.contrast / 100})`);
  if (a.saturate) parts.push(`saturate(${1 + a.saturate / 100})`);
  const hue = (a.hue || 0) + (st.hue || 0);
  if (hue) parts.push(`hue-rotate(${hue}deg)`);
  const blur = (a.blur || 0) + (st.blur || 0) + (st.fxBlur || 0);
  if (blur > 0.05) parts.push(`blur(${blur}px)`);
  return parts.join(' ') || 'none';
}

function needsOffscreen(c) {
  const f = filterById(c.filter);
  const a = c.adjust || {};
  return c.chroma?.enabled || f.overlay || f.vignette || f.grain || a.temperature || a.vignette || a.grain || a.sharpen || ['glitch', 'vhs', 'rgb', 'pixel', 'mirror', 'kaleido', 'scanlines'].includes(c.effect);
}

// ------------------------------------------------------------------ disegno clip
function animState(c, t, W, H) {
  const local = t - c.start;
  const st = { o: 1, tx: 0, ty: 0, s: 1, sx: 1, sy: 1, r: 0, blur: 0, hue: 0, reveal: undefined, mode: undefined };
  const merge = a => {
    if (!a) return;
    if (a.o !== undefined) st.o *= a.o;
    if (a.tx) st.tx += a.tx;
    if (a.ty) st.ty += a.ty;
    if (a.s !== undefined) st.s *= a.s;
    if (a.sx !== undefined) st.sx *= a.sx;
    if (a.sy !== undefined) st.sy *= a.sy;
    if (a.r) st.r += a.r;
    if (a.blur) st.blur += a.blur;
    if (a.hue) st.hue += a.hue;
    if (a.reveal !== undefined) { st.reveal = Math.min(st.reveal ?? 1, a.reveal); st.mode = a.mode; }
  };
  const ai = c.animIn || {};
  if (ai.type && ai.type !== 'none' && local < ai.duration) merge(ANIMS[ai.type]?.(Math.max(0, local / ai.duration), c, W, H));
  const ao = c.animOut || {};
  if (ao.type && ao.type !== 'none' && local > c.duration - ao.duration) merge(ANIMS[ao.type]?.(Math.max(0, (c.duration - local) / ao.duration), c, W, H));
  const lp = c.loop || {};
  if (lp.type && lp.type !== 'none') merge(LOOPS[lp.type]?.(local * (lp.speed || 1), c));
  // effetti di movimento
  const e = c.effect;
  if (e === 'shake') { st.tx += Math.sin(local * 53) * 9 + Math.sin(local * 31) * 5; st.ty += Math.cos(local * 47) * 8; st.r += Math.sin(local * 29) * 1.2; }
  if (e === 'zoompulse') st.s *= 1 + Math.max(0, Math.sin(local * Math.PI * 4)) * 0.06;
  if (e === 'blurpulse') st.fxBlur = Math.max(0, Math.sin(local * Math.PI * 2)) * 10;
  return st;
}

function drawSource(ctx, src, sw, sh, w, h, fit) {
  if (!sw || !sh) return;
  if (fit === 'fill') { ctx.drawImage(src, -w / 2, -h / 2, w, h); return; }
  const rs = sw / sh;
  const rd = w / h;
  if ((fit === 'cover' && rs > rd) || (fit === 'contain' && rs < rd)) {
    if (fit === 'cover') { const cw = sh * rd; ctx.drawImage(src, (sw - cw) / 2, 0, cw, sh, -w / 2, -h / 2, w, h); } else { const dw = h * rs; ctx.drawImage(src, -dw / 2, -h / 2, dw, h); }
  } else if (fit === 'cover') { const ch = sw / rd; ctx.drawImage(src, 0, (sh - ch) / 2, sw, ch, -w / 2, -h / 2, w, h); } else { const dh = w / rs; ctx.drawImage(src, -w / 2, -dh / 2, w, dh); }
}

function drawContent(ctx, c, t, st) {
  const w = c.w;
  const h = c.h;
  if (c.type === 'video') {
    const el = elFor(c);
    if (el.readyState >= 2) drawSource(ctx, el, el.videoWidth, el.videoHeight, w, h, c.fit);
  } else if (c.type === 'image') {
    const img = images.get(c.src);
    if (img) drawSource(ctx, img, img.naturalWidth, img.naturalHeight, w, h, c.fit);
    else loadImage(c.src).catch(() => {});
  } else if (c.type === 'text') {
    drawText(ctx, c, st);
  } else if (c.type === 'shape') {
    drawShape(ctx, c, w, h);
    if (c.fillGradient && c.fillGradient.length > 1) {
      const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      c.fillGradient.forEach((col, i) => g.addColorStop(i / (c.fillGradient.length - 1), col));
      ctx.fillStyle = g;
    } else ctx.fillStyle = c.fill || '#7C4DFF';
    if (c.fill !== 'transparent') ctx.fill('evenodd');
    if (c.strokeWidth > 0) { ctx.lineWidth = c.strokeWidth; ctx.strokeStyle = c.strokeColor || '#fff'; ctx.lineJoin = 'round'; ctx.stroke(); }
  } else if (c.type === 'sticker') {
    ctx.font = `${Math.min(w, h) * 0.86}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.emoji || '⭐', 0, Math.min(w, h) * 0.06);
  } else if (c.type === 'icon') {
    const img = iconImage(c.icon, c.color || '#fff');
    if (img.complete) ctx.drawImage(img, -w / 2, -h / 2, w, h);
  } else if (c.type === 'color') {
    if (c.colors && c.colors.length > 1) {
      const a = ((c.angle ?? 135) - 90) * Math.PI / 180;
      const g = ctx.createLinearGradient(-Math.cos(a) * w / 2, -Math.sin(a) * h / 2, Math.cos(a) * w / 2, Math.sin(a) * h / 2);
      c.colors.forEach((col, i) => g.addColorStop(i / (c.colors.length - 1), col));
      ctx.fillStyle = g;
    } else ctx.fillStyle = c.fill || '#000';
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
}

function postProcess(octx, c, ow, oh, t) {
  const f = filterById(c.filter);
  const a = c.adjust || {};
  const local = t - c.start;
  octx.save();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  // chroma key (green screen)
  if (c.chroma?.enabled) {
    const img = octx.getImageData(0, 0, ow, oh);
    const d = img.data;
    const kc = hexToRgb(c.chroma.color);
    const tol = (c.chroma.tolerance ?? 0.35) * 441;
    const smooth = Math.max(1, (c.chroma.smooth ?? 0.08) * 441);
    for (let i = 0; i < d.length; i += 4) {
      const dist = Math.hypot(d[i] - kc[0], d[i + 1] - kc[1], d[i + 2] - kc[2]);
      if (dist < tol) d[i + 3] = 0;
      else if (dist < tol + smooth) d[i + 3] *= (dist - tol) / smooth;
    }
    octx.putImageData(img, 0, 0);
  }
  // copia della forma originale: i ritocchi di colore restano dentro i pixel visibili
  const mask = scratch(ow, oh, 5);
  const mctx = mask.getContext('2d');
  mctx.clearRect(0, 0, ow, oh);
  mctx.drawImage(octx.canvas, 0, 0);
  if (f.overlay && (c.filterAmount ?? 1) > 0) {
    octx.globalCompositeOperation = f.overlay[2];
    octx.globalAlpha = f.overlay[1] * (c.filterAmount ?? 1);
    octx.fillStyle = f.overlay[0];
    octx.fillRect(0, 0, ow, oh);
    octx.globalAlpha = 1;
  }
  if (a.temperature) {
    octx.globalCompositeOperation = 'soft-light';
    octx.globalAlpha = Math.min(1, Math.abs(a.temperature) / 100) * 0.6;
    octx.fillStyle = a.temperature > 0 ? '#ff8a00' : '#0080ff';
    octx.fillRect(0, 0, ow, oh);
    octx.globalAlpha = 1;
  }
  const vig = (a.vignette || 0) / 100 + (f.vignette || 0);
  if (vig > 0) {
    octx.globalCompositeOperation = 'source-over';
    const g = octx.createRadialGradient(ow / 2, oh / 2, Math.min(ow, oh) * 0.25, ow / 2, oh / 2, Math.hypot(ow, oh) * 0.55);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, vig)})`);
    octx.fillStyle = g;
    octx.fillRect(0, 0, ow, oh);
  }
  const grain = (a.grain || 0) / 100 + (f.grain || 0);
  if (grain > 0) {
    octx.globalCompositeOperation = 'overlay';
    octx.globalAlpha = Math.min(1, grain);
    const n = noiseCanvas();
    const ox = Math.floor(Math.random() * 128);
    const oy = Math.floor(Math.random() * 128);
    octx.fillStyle = octx.createPattern(n, 'repeat');
    octx.translate(-ox, -oy);
    octx.fillRect(ox, oy, ow, oh);
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.globalAlpha = 1;
  }
  if (a.sharpen > 0) {
    octx.globalCompositeOperation = 'overlay';
    octx.globalAlpha = Math.min(0.6, a.sharpen / 160);
    octx.filter = 'contrast(2) grayscale(1)';
    octx.drawImage(mask, 0, 0);
    octx.filter = 'none';
    octx.globalAlpha = 1;
  }
  octx.globalCompositeOperation = 'destination-in';
  octx.drawImage(mask, 0, 0);
  octx.globalCompositeOperation = 'source-over';
  const e = c.effect;
  if (e === 'rgb' || e === 'glitch' || e === 'vhs') {
    const amt = e === 'rgb' ? Math.max(4, ow * 0.008) : (Math.sin(local * 13) > 0.6 ? ow * 0.02 : ow * 0.004);
    const tmp = scratch(ow, oh, 2);
    const t2 = tmp.getContext('2d');
    t2.clearRect(0, 0, ow, oh);
    t2.drawImage(octx.canvas, 0, 0);
    octx.clearRect(0, 0, ow, oh);
    octx.globalCompositeOperation = 'lighter';
    for (const [col, dx] of [['#ff0000', -amt], ['#00ff00', 0], ['#0000ff', amt]]) {
      const ch = scratch(ow, oh, 3);
      const cctx = ch.getContext('2d');
      cctx.globalCompositeOperation = 'source-over';
      cctx.clearRect(0, 0, ow, oh);
      cctx.drawImage(tmp, 0, 0);
      cctx.globalCompositeOperation = 'multiply';
      cctx.fillStyle = col;
      cctx.fillRect(0, 0, ow, oh);
      cctx.globalCompositeOperation = 'destination-in';
      cctx.drawImage(tmp, 0, 0);
      octx.drawImage(ch, dx, 0);
    }
    octx.globalCompositeOperation = 'source-over';
    if (e === 'glitch' && Math.sin(local * 7) > 0.2) {
      for (let i = 0; i < 6; i++) {
        const y = ((Math.sin(local * 91 + i * 17) + 1) / 2) * oh;
        const hh = oh * 0.03;
        const dx = Math.sin(local * 57 + i) * ow * 0.06;
        octx.drawImage(tmp, 0, y, ow, hh, dx, y, ow, hh);
      }
    }
  }
  if (e === 'vhs' || e === 'scanlines') {
    octx.globalCompositeOperation = 'source-atop';
    octx.fillStyle = 'rgba(0,0,0,.22)';
    const step = Math.max(2, Math.round(oh / 240));
    for (let y = (Math.floor(local * 60) % step); y < oh; y += step * 2) octx.fillRect(0, y, ow, step);
    if (e === 'vhs') {
      octx.globalCompositeOperation = 'source-atop';
      octx.fillStyle = 'rgba(255,255,255,.08)';
      const by = ((local * 0.4) % 1) * oh;
      octx.fillRect(0, by, ow, oh * 0.05);
    }
  }
  if (e === 'pixel') {
    const s = Math.max(2, Math.round(Math.min(ow, oh) / 48));
    const sw = Math.max(1, Math.round(ow / s));
    const sh = Math.max(1, Math.round(oh / s));
    const small = scratch(sw, sh, 4);
    const sctx = small.getContext('2d');
    sctx.clearRect(0, 0, sw, sh);
    sctx.drawImage(octx.canvas, 0, 0, sw, sh);
    octx.clearRect(0, 0, ow, oh);
    octx.imageSmoothingEnabled = false;
    octx.drawImage(small, 0, 0, sw, sh, 0, 0, ow, oh);
    octx.imageSmoothingEnabled = true;
  }
  if (e === 'mirror' || e === 'kaleido') {
    const tmp = scratch(ow, oh, 2);
    const t2 = tmp.getContext('2d');
    t2.clearRect(0, 0, ow, oh);
    t2.drawImage(octx.canvas, 0, 0);
    octx.clearRect(0, 0, ow, oh);
    octx.drawImage(tmp, 0, 0, ow / 2, oh, 0, 0, ow / 2, oh);
    octx.save(); octx.translate(ow, 0); octx.scale(-1, 1); octx.drawImage(tmp, 0, 0, ow / 2, oh, 0, 0, ow / 2, oh); octx.restore();
    if (e === 'kaleido') {
      t2.clearRect(0, 0, ow, oh);
      t2.drawImage(octx.canvas, 0, 0);
      octx.clearRect(0, 0, ow, oh);
      octx.drawImage(tmp, 0, 0, ow, oh / 2, 0, 0, ow, oh / 2);
      octx.save(); octx.translate(0, oh); octx.scale(1, -1); octx.drawImage(tmp, 0, 0, ow, oh / 2, 0, 0, ow, oh / 2); octx.restore();
    }
  }
  octx.restore();
}

// particelle e luci disegnate sopra la clip
function overlayFx(ctx, c, t) {
  const e = c.effect;
  const local = t - c.start;
  const w = c.w;
  const h = c.h;
  if (!['confetti', 'sparkles', 'hearts', 'snow', 'bokeh', 'rain', 'flash', 'lightleak', 'spotlight'].includes(e)) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  const seed = hash(c.id);
  const R = i => { const x = Math.sin(seed + i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  if (e === 'flash') {
    const k = Math.pow(Math.max(0, Math.sin(local * Math.PI * 2)), 12);
    ctx.fillStyle = `rgba(255,255,255,${k * 0.85})`;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  } else if (e === 'lightleak') {
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) {
      const x = Math.sin(local * 0.6 + i * 2) * w * 0.4;
      const y = Math.cos(local * 0.5 + i) * h * 0.3;
      const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.6);
      g.addColorStop(0, ['rgba(255,140,60,.55)', 'rgba(255,60,140,.45)', 'rgba(255,220,120,.4)'][i]);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
  } else if (e === 'spotlight') {
    const x = Math.sin(local * 0.9) * w * 0.25;
    const g = ctx.createRadialGradient(x, 0, Math.min(w, h) * 0.1, x, 0, Math.max(w, h) * 0.55);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.75)');
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  } else {
    const n = e === 'rain' ? 140 : e === 'snow' ? 110 : e === 'bokeh' ? 26 : 70;
    const colors = ['#FF4FA3', '#7B4BFF', '#FFD84D', '#2FBF71', '#00B4DB', '#FF7A3D', '#FFFFFF'];
    for (let i = 0; i < n; i++) {
      const sp = 0.25 + R(i) * 0.6;
      const px = (R(i + 100) - 0.5) * w + Math.sin(local * (1 + R(i)) + i) * w * 0.03;
      let py;
      if (e === 'bokeh') py = (R(i + 200) - 0.5) * h + Math.sin(local * 0.5 + i) * h * 0.05;
      else if (e === 'sparkles') py = (R(i + 200) - 0.5) * h;
      else py = ((R(i + 200) + local * sp * (e === 'rain' ? 1.8 : 0.35)) % 1.1 - 0.55) * h;
      ctx.save();
      ctx.translate(px, py);
      const size = Math.max(w, h) * (e === 'bokeh' ? 0.03 + R(i + 300) * 0.07 : 0.008 + R(i + 300) * 0.012);
      if (e === 'confetti') {
        ctx.rotate(local * (2 + R(i) * 4) + i);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(-size, -size / 2, size * 2, size);
      } else if (e === 'sparkles') {
        const tw = Math.max(0, Math.sin(local * (2 + R(i) * 3) + i * 3));
        ctx.globalAlpha = tw;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        for (let k = 0; k < 8; k++) { const a = (Math.PI / 4) * k; const r = k % 2 ? size * 0.35 : size * 1.6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill();
      } else if (e === 'hearts') {
        ctx.fillStyle = ['#FF4FA3', '#E11D48', '#FF8AC6'][i % 3];
        ctx.globalAlpha = 0.85;
        const s = size * 1.4;
        ctx.beginPath(); ctx.moveTo(0, s * 0.9);
        ctx.bezierCurveTo(-s * 1.6, -s * 0.1, -s * 0.9, -s * 1.25, 0, -s * 0.45);
        ctx.bezierCurveTo(s * 0.9, -s * 1.25, s * 1.6, -s * 0.1, 0, s * 0.9); ctx.fill();
      } else if (e === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.beginPath(); ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2); ctx.fill();
      } else if (e === 'rain') {
        ctx.strokeStyle = 'rgba(200,220,255,.55)';
        ctx.lineWidth = Math.max(1, size * 0.15);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-size * 0.3, size * 3); ctx.stroke();
      } else if (e === 'bokeh') {
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = 0.18 + R(i + 400) * 0.25;
        ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

let noise;
function noiseCanvas() {
  if (noise) return noise;
  noise = document.createElement('canvas');
  noise.width = noise.height = 256;
  const n = noise.getContext('2d');
  const img = n.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  n.putImageData(img, 0, 0);
  return noise;
}

function hexToRgb(h) {
  const v = String(h || '#00ff00').replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map(x => x + x).join('') : v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hash(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return h % 1000; }

export function drawClip(ctx, c, t) {
  const W = S.project.width;
  const H = S.project.height;
  const st = animState(c, t, W, H);
  if (c.type === 'text') layoutText(ctx, c);
  ctx.save();
  ctx.globalAlpha *= Math.max(0, Math.min(1, (c.opacity ?? 1) * st.o));
  if (c.blend && c.blend !== 'source-over') ctx.globalCompositeOperation = c.blend;
  ctx.translate(c.x + st.tx, c.y + st.ty);
  ctx.rotate(((c.rotation || 0) + st.r) * Math.PI / 180);
  ctx.scale(st.s * st.sx * (c.flipH ? -1 : 1), st.s * st.sy * (c.flipV ? -1 : 1));
  const w = c.w;
  const h = c.h;
  if (c.shadow?.enabled && c.type !== 'text') {
    ctx.shadowColor = c.shadow.color; ctx.shadowBlur = c.shadow.blur; ctx.shadowOffsetX = c.shadow.x; ctx.shadowOffsetY = c.shadow.y;
  }
  const filter = cssFilter(c, st);
  const rounded = (c.radius || 0) > 0 && ['video', 'image', 'color'].includes(c.type);
  if (needsOffscreen(c)) {
    const m = ctx.getTransform();
    const k = Math.min(1, Math.hypot(m.a, m.b) / Math.max(0.01, Math.abs(st.s * st.sx)) || 1);
    const ow = Math.max(1, Math.ceil(w * k));
    const oh = Math.max(1, Math.ceil(h * k));
    const off = scratch(ow, oh, 1);
    const octx = off.getContext('2d');
    octx.save();
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, ow, oh);
    octx.translate(ow / 2, oh / 2);
    octx.scale(k, k);
    octx.filter = filter;
    if (rounded) { octx.beginPath(); octx.roundRect(-w / 2, -h / 2, w, h, c.radius); octx.clip(); }
    drawContent(octx, c, t, st);
    octx.restore();
    postProcess(octx, c, ow, oh, t);
    ctx.drawImage(off, -w / 2, -h / 2, w, h);
  } else {
    ctx.filter = filter;
    if (rounded) {
      if (c.shadow?.enabled) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, c.radius); ctx.fill(); ctx.shadowColor = 'transparent'; }
      ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, c.radius); ctx.clip();
    }
    drawContent(ctx, c, t, st);
    ctx.filter = 'none';
  }
  ctx.shadowColor = 'transparent';
  overlayFx(ctx, c, t);
  if (c.border?.width > 0 && c.type !== 'text' && c.type !== 'sticker') {
    ctx.lineWidth = c.border.width;
    ctx.strokeStyle = c.border.color;
    ctx.beginPath();
    if (c.type === 'shape') drawShape(ctx, c, w, h); else ctx.roundRect(-w / 2, -h / 2, w, h, c.radius || 0);
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ fotogramma completo
export function drawBackground(ctx, W, H) {
  const bg = S.project.background || {};
  if (bg.type === 'gradient' && bg.colors && bg.colors.length > 1) {
    const a = ((bg.angle ?? 135) - 90) * Math.PI / 180;
    const g = ctx.createLinearGradient(W / 2 - Math.cos(a) * W / 2, H / 2 - Math.sin(a) * H / 2, W / 2 + Math.cos(a) * W / 2, H / 2 + Math.sin(a) * H / 2);
    bg.colors.forEach((col, i) => g.addColorStop(i / (bg.colors.length - 1), col));
    ctx.fillStyle = g;
  } else ctx.fillStyle = bg.color || '#000';
  ctx.fillRect(0, 0, W, H);
  if (bg.type === 'image' && bg.src) {
    const img = images.get(bg.src);
    if (img) {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      if (bg.blur) ctx.filter = `blur(${bg.blur}px) brightness(.8)`;
      drawSource(ctx, img, img.naturalWidth, img.naturalHeight, W * (bg.blur ? 1.1 : 1), H * (bg.blur ? 1.1 : 1), 'cover');
      ctx.restore();
    } else loadImage(bg.src).catch(() => {});
  }
}

export function renderFrame(ctx, t, { scale = 1 } = {}) {
  const W = S.project.width;
  const H = S.project.height;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  drawBackground(ctx, W, H);
  for (const tr of S.project.tracks) {
    if (tr.kind !== 'visual' || tr.hidden) continue;
    const list = S.project.clips.filter(c => c.trackId === tr.id).sort((a, b) => a.start - b.start);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (t < c.start || t >= end(c)) continue;
      const tr2 = c.transition || {};
      const prev = list[i - 1];
      if (tr2.type && tr2.type !== 'none' && prev && Math.abs(end(prev) - c.start) < 0.08 && t - c.start < tr2.duration) {
        const p = (t - c.start) / Math.max(0.05, tr2.duration);
        drawTransition(ctx, tr2.type, p, (cx = ctx) => drawClip(cx, prev, end(prev) - 0.001), (cx = ctx) => drawClip(cx, c, t), W, H);
      } else drawClip(ctx, c, t);
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ selezione
export function hitTest(x, y, t) {
  const order = S.project.tracks.filter(tr => tr.kind === 'visual' && !tr.hidden);
  for (let ti = order.length - 1; ti >= 0; ti--) {
    const list = S.project.clips.filter(c => c.trackId === order[ti].id && t >= c.start && t < end(c));
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i];
      const a = -(c.rotation || 0) * Math.PI / 180;
      const dx = x - c.x;
      const dy = y - c.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a);
      const ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= c.w / 2 && Math.abs(ly) <= c.h / 2) return c;
    }
  }
  return null;
}

export function clearLayout(id) { layoutCache.delete(id); }
