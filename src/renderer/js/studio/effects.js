// Catalogo creativo di Salto Studio: filtri, effetti video, animazioni, transizioni,
// stili di testo, forme, adesivi e sfondi. Ogni voce è disegnata in tempo reale sul canvas.

// ------------------------------------------------------------------ filtri colore
export const FILTERS = [
  { id: 'none', name: 'Originale', css: '' },
  { id: 'vivid', name: 'Vivace', css: 'saturate(1.45) contrast(1.08)' },
  { id: 'hdr', name: 'HDR', css: 'contrast(1.3) saturate(1.35) brightness(1.04)' },
  { id: 'drama', name: 'Drammatico', css: 'contrast(1.45) saturate(1.15) brightness(.9)' },
  { id: 'sport', name: 'Sport', css: 'contrast(1.35) saturate(1.25) brightness(1.02)', overlay: ['#ff6a00', 0.08, 'soft-light'] },
  { id: 'cinema', name: 'Cinema', css: 'contrast(1.18) saturate(1.05)', overlay: ['#00a3a3', 0.18, 'soft-light'], vignette: 0.35 },
  { id: 'warm', name: 'Caldo', css: 'saturate(1.2) sepia(.18)', overlay: ['#ff8a3d', 0.16, 'soft-light'] },
  { id: 'cool', name: 'Freddo', css: 'saturate(1.08) brightness(1.03)', overlay: ['#3d8bff', 0.2, 'soft-light'] },
  { id: 'athlos', name: 'Viola Athlos', css: 'contrast(1.1) saturate(1.2)', overlay: ['#8B3DF0', 0.3, 'soft-light'] },
  { id: 'pink', name: 'Rosa ritmica', css: 'saturate(1.2)', overlay: ['#ff4fa3', 0.28, 'soft-light'] },
  { id: 'sunset', name: 'Tramonto', css: 'saturate(1.3) contrast(1.05)', overlay: ['#ff5e62', 0.26, 'soft-light'] },
  { id: 'gold', name: 'Oro', css: 'sepia(.35) saturate(1.5) contrast(1.05)', overlay: ['#ffc94d', 0.2, 'soft-light'] },
  { id: 'ocean', name: 'Oceano', css: 'saturate(1.1)', overlay: ['#00b4db', 0.28, 'soft-light'] },
  { id: 'forest', name: 'Foresta', css: 'saturate(1.1) contrast(1.05)', overlay: ['#2fbf71', 0.2, 'soft-light'] },
  { id: 'pastel', name: 'Pastello', css: 'saturate(.7) brightness(1.12) contrast(.88)' },
  { id: 'dream', name: 'Sogno', css: 'saturate(1.15) brightness(1.08) blur(.6px)', overlay: ['#ffb3e6', 0.16, 'screen'] },
  { id: 'fade', name: 'Sbiadito', css: 'contrast(.8) brightness(1.1) saturate(.75)' },
  { id: 'matte', name: 'Opaco', css: 'contrast(.86) brightness(1.06) saturate(.9)', overlay: ['#2a2540', 0.18, 'lighten'] },
  { id: 'vintage', name: 'Vintage', css: 'sepia(.35) contrast(.92) brightness(1.04) saturate(.85)', overlay: ['#f5d0a9', 0.2, 'multiply'], vignette: 0.3 },
  { id: 'polaroid', name: 'Polaroid', css: 'sepia(.18) contrast(1.08) brightness(1.08) saturate(1.1)' },
  { id: 'lomo', name: 'Lomo', css: 'saturate(1.5) contrast(1.3)', vignette: 0.6 },
  { id: 'film', name: 'Pellicola', css: 'contrast(1.1) saturate(.9) sepia(.12)', grain: 0.35 },
  { id: 'kodak', name: 'Kodak', css: 'contrast(1.12) saturate(1.2) sepia(.1)', overlay: ['#ffd27a', 0.12, 'soft-light'] },
  { id: 'fuji', name: 'Fuji', css: 'contrast(1.05) saturate(1.1) hue-rotate(-6deg)', overlay: ['#7affc1', 0.08, 'soft-light'] },
  { id: 'bw', name: 'Bianco e nero', css: 'grayscale(1) contrast(1.12)' },
  { id: 'noir', name: 'Noir', css: 'grayscale(1) contrast(1.6) brightness(.88)', vignette: 0.5 },
  { id: 'sepia', name: 'Seppia', css: 'sepia(.85) contrast(1.05)' },
  { id: 'duo-blue', name: 'Duotone blu', css: 'grayscale(1) contrast(1.15)', overlay: ['#2b5cff', 0.85, 'color'] },
  { id: 'duo-pink', name: 'Duotone rosa', css: 'grayscale(1) contrast(1.15)', overlay: ['#ff2e88', 0.85, 'color'] },
  { id: 'duo-purple', name: 'Duotone viola', css: 'grayscale(1) contrast(1.2)', overlay: ['#7b4bff', 0.85, 'color'] },
  { id: 'neon', name: 'Neon', css: 'saturate(2) contrast(1.2) hue-rotate(-15deg)' },
  { id: 'cyber', name: 'Cyber', css: 'hue-rotate(-40deg) saturate(1.8) contrast(1.2)', overlay: ['#00f0ff', 0.12, 'screen'] },
  { id: 'retro80', name: 'Anni 80', css: 'saturate(1.5) contrast(1.1)', overlay: ['#ff00cc', 0.18, 'screen'] },
  { id: 'night', name: 'Notte', css: 'brightness(.72) saturate(.85) contrast(1.15)', overlay: ['#1c3cff', 0.25, 'soft-light'] },
  { id: 'summer', name: 'Estate', css: 'saturate(1.35) brightness(1.06)', overlay: ['#ffd84d', 0.14, 'soft-light'] },
  { id: 'winter', name: 'Inverno', css: 'saturate(.8) brightness(1.08)', overlay: ['#bfe3ff', 0.22, 'soft-light'] },
  { id: 'autumn', name: 'Autunno', css: 'saturate(1.2) sepia(.2)', overlay: ['#d9531e', 0.18, 'soft-light'] },
  { id: 'thermal', name: 'Termico', css: 'invert(1) hue-rotate(180deg) saturate(3)' },
  { id: 'invert', name: 'Negativo', css: 'invert(1)' },
  { id: 'glow', name: 'Bagliore', css: 'brightness(1.1) saturate(1.2)', overlay: ['#ffffff', 0.12, 'screen'] },
];
export const filterById = id => FILTERS.find(f => f.id === id) || FILTERS[0];

// ------------------------------------------------------------------ effetti dinamici
export const EFFECTS = [
  ['none', 'Nessuno', 'circle-dot'], ['shake', 'Tremolio', 'activity'], ['glitch', 'Glitch', 'zap'], ['vhs', 'VHS', 'disc-3'],
  ['rgb', 'RGB split', 'layers'], ['pixel', 'Pixel', 'grid-3x3'], ['mirror', 'Specchio', 'flip-horizontal'], ['kaleido', 'Caleidoscopio', 'sparkle'],
  ['zoompulse', 'Pulsazione', 'zoom-in'], ['flash', 'Flash', 'sun'], ['blurpulse', 'Sfocatura ritmica', 'droplet'], ['scanlines', 'Linee TV', 'monitor'],
  ['lightleak', 'Luce calda', 'flame'], ['confetti', 'Coriandoli', 'party-popper'], ['sparkles', 'Stelline', 'sparkles'], ['hearts', 'Cuori', 'heart'],
  ['snow', 'Neve', 'cloud'], ['bokeh', 'Bokeh', 'aperture'], ['rain', 'Pioggia', 'waves'], ['spotlight', 'Riflettore', 'focus'],
];

// ------------------------------------------------------------------ animazioni
const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeIn = p => p * p * p;
const easeOutBack = p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const easeOutElastic = p => (p === 0 || p === 1 ? p : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * (2 * Math.PI) / 3) + 1);
const easeOutBounce = p => {
  const n1 = 7.5625, d1 = 2.75;
  if (p < 1 / d1) return n1 * p * p;
  if (p < 2 / d1) return n1 * (p -= 1.5 / d1) * p + 0.75;
  if (p < 2.5 / d1) return n1 * (p -= 2.25 / d1) * p + 0.9375;
  return n1 * (p -= 2.625 / d1) * p + 0.984375;
};

// ogni animazione restituisce {o, tx, ty, s, sx, sy, r, blur, reveal} dato il progresso p (0 → 1 = visibile)
export const ANIMS = {
  none: () => ({}),
  fade: p => ({ o: easeOut(p) }),
  'slide-left': (p, c, W) => ({ tx: (1 - easeOut(p)) * W * 0.6, o: easeOut(p) }),
  'slide-right': (p, c, W) => ({ tx: -(1 - easeOut(p)) * W * 0.6, o: easeOut(p) }),
  'slide-up': (p, c, W, H) => ({ ty: (1 - easeOut(p)) * H * 0.4, o: easeOut(p) }),
  'slide-down': (p, c, W, H) => ({ ty: -(1 - easeOut(p)) * H * 0.4, o: easeOut(p) }),
  'zoom-in': p => ({ s: 0.4 + 0.6 * easeOut(p), o: easeOut(p) }),
  'zoom-out': p => ({ s: 1.8 - 0.8 * easeOut(p), o: easeOut(p) }),
  pop: p => ({ s: Math.max(0.01, easeOutBack(p)), o: Math.min(1, p * 3) }),
  elastic: p => ({ s: Math.max(0.01, easeOutElastic(p)), o: Math.min(1, p * 4) }),
  bounce: (p, c, W, H) => ({ ty: -(1 - easeOutBounce(p)) * H * 0.5, o: Math.min(1, p * 4) }),
  drop: (p, c, W, H) => ({ ty: -(1 - easeOutBack(p)) * H * 0.3, o: Math.min(1, p * 3) }),
  rise: (p, c) => ({ ty: (1 - easeOut(p)) * c.h * 0.6, o: easeOut(p), blur: (1 - p) * 8 }),
  spin: p => ({ r: (1 - easeOut(p)) * -360, s: 0.3 + 0.7 * easeOut(p), o: easeOut(p) }),
  swing: p => ({ r: Math.sin((1 - p) * Math.PI * 3) * 25 * (1 - p), o: easeOut(p) }),
  'flip-x': p => ({ sx: Math.max(0.01, easeOutBack(p)), o: Math.min(1, p * 3) }),
  'flip-y': p => ({ sy: Math.max(0.01, easeOutBack(p)), o: Math.min(1, p * 3) }),
  'blur-in': p => ({ blur: (1 - p) * 30, o: easeOut(p) }),
  stretch: p => ({ sx: 1 + (1 - easeOutElastic(p)) * 0.8, sy: Math.max(0.01, easeOutElastic(p)), o: Math.min(1, p * 4) }),
  typewriter: p => ({ reveal: p, mode: 'chars' }),
  'word-pop': p => ({ reveal: p, mode: 'words' }),
  'letters-rise': p => ({ reveal: p, mode: 'rise' }),
};
export const ANIM_LIST = [
  ['none', 'Nessuna'], ['fade', 'Dissolvenza'], ['pop', 'Pop'], ['zoom-in', 'Zoom avanti'], ['zoom-out', 'Zoom indietro'],
  ['slide-left', 'Da destra'], ['slide-right', 'Da sinistra'], ['slide-up', 'Dal basso'], ['slide-down', 'Dall\'alto'],
  ['bounce', 'Rimbalzo'], ['drop', 'Caduta'], ['rise', 'Emersione'], ['elastic', 'Elastico'], ['spin', 'Giravolta'],
  ['swing', 'Altalena'], ['flip-x', 'Capovolta X'], ['flip-y', 'Capovolta Y'], ['blur-in', 'Messa a fuoco'], ['stretch', 'Molla'],
  ['typewriter', 'Macchina da scrivere'], ['word-pop', 'Parole pop'], ['letters-rise', 'Lettere in salita'],
];
export const LOOPS = {
  none: () => ({}),
  pulse: t => ({ s: 1 + Math.sin(t * Math.PI * 2) * 0.06 }),
  heartbeat: t => { const k = t % 1; return { s: 1 + (k < 0.15 ? Math.sin(k / 0.15 * Math.PI) * 0.12 : k < 0.3 ? Math.sin((k - 0.15) / 0.15 * Math.PI) * 0.08 : 0) }; },
  float: t => ({ ty: Math.sin(t * Math.PI * 1.2) * 18 }),
  sway: t => ({ r: Math.sin(t * Math.PI * 1.2) * 6 }),
  spin: t => ({ r: (t * 120) % 360 }),
  shake: t => ({ tx: Math.sin(t * 60) * 6, r: Math.sin(t * 45) * 2 }),
  wiggle: t => ({ r: Math.sin(t * 18) * 5 * (Math.sin(t * 2) > 0.3 ? 1 : 0) }),
  blink: t => ({ o: Math.sin(t * Math.PI * 2) > -0.6 ? 1 : 0.15 }),
  kenburns: (t, c) => ({ s: 1 + Math.min(1, t / Math.max(1, c.duration)) * 0.18 }),
  rainbow: t => ({ hue: (t * 120) % 360 }),
};
export const LOOP_LIST = [['none', 'Nessuna'], ['pulse', 'Pulsazione'], ['heartbeat', 'Battito'], ['float', 'Fluttua'], ['sway', 'Oscilla'], ['spin', 'Ruota'], ['shake', 'Trema'], ['wiggle', 'Scodinzola'], ['blink', 'Lampeggia'], ['kenburns', 'Zoom lento'], ['rainbow', 'Arcobaleno']];

// ------------------------------------------------------------------ transizioni
export const TRANSITIONS = [
  ['none', 'Nessuna'], ['fade', 'Dissolvenza'], ['fade-black', 'Nero'], ['fade-white', 'Bianco'], ['flash', 'Flash'],
  ['slide-left', 'Scorri ←'], ['slide-right', 'Scorri →'], ['slide-up', 'Scorri ↑'], ['slide-down', 'Scorri ↓'],
  ['push-left', 'Spingi ←'], ['push-right', 'Spingi →'], ['push-up', 'Spingi ↑'], ['push-down', 'Spingi ↓'],
  ['wipe-left', 'Tendina ←'], ['wipe-right', 'Tendina →'], ['wipe-up', 'Tendina ↑'], ['wipe-down', 'Tendina ↓'],
  ['zoom-in', 'Zoom avanti'], ['zoom-out', 'Zoom indietro'], ['spin', 'Vortice'], ['circle', 'Cerchio'], ['heart', 'Cuore'],
  ['diamond', 'Rombo'], ['star', 'Stella'], ['blinds', 'Veneziane'], ['split', 'Porte'], ['clock', 'Orologio'], ['diagonal', 'Diagonale'],
  ['blur', 'Sfocatura'], ['pixelate', 'Pixel'], ['glitch', 'Glitch'], ['cube', 'Cubo'],
];

function shapePath(ctx, kind, cx, cy, r) {
  ctx.beginPath();
  if (kind === 'circle') ctx.arc(cx, cy, r, 0, Math.PI * 2);
  else if (kind === 'diamond') { ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); } else if (kind === 'star') starPath(ctx, cx, cy, r, r * 0.45, 5);
  else if (kind === 'heart') heartPath(ctx, cx, cy, r);
}

// drawA: clip uscente, drawB: clip entrante (funzioni che disegnano sul ctx corrente)
export function drawTransition(ctx, type, p, drawA, drawB, W, H) {
  const e = easeOut(Math.min(1, Math.max(0, p)));
  const save = fn => { ctx.save(); fn(); ctx.restore(); };
  switch (type) {
    case 'fade': save(drawA); save(() => { ctx.globalAlpha *= e; drawB(); }); break;
    case 'fade-black':
    case 'fade-white': {
      const col = type === 'fade-black' ? '#000' : '#fff';
      if (p < 0.5) { save(drawA); ctx.save(); ctx.globalAlpha = p * 2; ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); ctx.restore(); } else { save(drawB); ctx.save(); ctx.globalAlpha = (1 - p) * 2; ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      break;
    }
    case 'flash': save(p < 0.5 ? drawA : drawB); ctx.save(); ctx.globalAlpha = 1 - Math.abs(p - 0.5) * 2; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); break;
    case 'slide-left': save(drawA); save(() => { ctx.translate((1 - e) * W, 0); drawB(); }); break;
    case 'slide-right': save(drawA); save(() => { ctx.translate(-(1 - e) * W, 0); drawB(); }); break;
    case 'slide-up': save(drawA); save(() => { ctx.translate(0, (1 - e) * H); drawB(); }); break;
    case 'slide-down': save(drawA); save(() => { ctx.translate(0, -(1 - e) * H); drawB(); }); break;
    case 'push-left': save(() => { ctx.translate(-e * W, 0); drawA(); }); save(() => { ctx.translate((1 - e) * W, 0); drawB(); }); break;
    case 'push-right': save(() => { ctx.translate(e * W, 0); drawA(); }); save(() => { ctx.translate(-(1 - e) * W, 0); drawB(); }); break;
    case 'push-up': save(() => { ctx.translate(0, -e * H); drawA(); }); save(() => { ctx.translate(0, (1 - e) * H); drawB(); }); break;
    case 'push-down': save(() => { ctx.translate(0, e * H); drawA(); }); save(() => { ctx.translate(0, -(1 - e) * H); drawB(); }); break;
    case 'wipe-left': save(drawA); save(() => { ctx.beginPath(); ctx.rect(W * (1 - e), 0, W * e, H); ctx.clip(); drawB(); }); break;
    case 'wipe-right': save(drawA); save(() => { ctx.beginPath(); ctx.rect(0, 0, W * e, H); ctx.clip(); drawB(); }); break;
    case 'wipe-up': save(drawA); save(() => { ctx.beginPath(); ctx.rect(0, H * (1 - e), W, H * e); ctx.clip(); drawB(); }); break;
    case 'wipe-down': save(drawA); save(() => { ctx.beginPath(); ctx.rect(0, 0, W, H * e); ctx.clip(); drawB(); }); break;
    case 'zoom-in': save(() => { ctx.globalAlpha *= 1 - e; ctx.translate(W / 2, H / 2); ctx.scale(1 + e * 0.6, 1 + e * 0.6); ctx.translate(-W / 2, -H / 2); drawA(); }); save(() => { ctx.globalAlpha *= e; ctx.translate(W / 2, H / 2); ctx.scale(0.6 + 0.4 * e, 0.6 + 0.4 * e); ctx.translate(-W / 2, -H / 2); drawB(); }); break;
    case 'zoom-out': save(() => { ctx.globalAlpha *= 1 - e; ctx.translate(W / 2, H / 2); ctx.scale(1 - e * 0.5, 1 - e * 0.5); ctx.translate(-W / 2, -H / 2); drawA(); }); save(() => { ctx.globalAlpha *= e; ctx.translate(W / 2, H / 2); ctx.scale(1.5 - 0.5 * e, 1.5 - 0.5 * e); ctx.translate(-W / 2, -H / 2); drawB(); }); break;
    case 'spin': {
      const k = p < 0.5 ? p * 2 : (1 - p) * 2;
      save(() => { ctx.translate(W / 2, H / 2); ctx.rotate((p < 0.5 ? p : p - 1) * Math.PI); ctx.scale(1 - k * 0.6, 1 - k * 0.6); ctx.translate(-W / 2, -H / 2); (p < 0.5 ? drawA : drawB)(); });
      break;
    }
    case 'circle': case 'heart': case 'diamond': case 'star': {
      save(drawA);
      const R = Math.hypot(W, H) * (type === 'heart' ? 0.9 : type === 'star' ? 1.25 : 0.62) * e;
      save(() => { shapePath(ctx, type, W / 2, H / 2, Math.max(0.1, R)); ctx.clip(); drawB(); });
      break;
    }
    case 'blinds': {
      save(drawA);
      const n = 10;
      save(() => { ctx.beginPath(); for (let i = 0; i < n; i++) ctx.rect(0, (H / n) * i, W, (H / n) * e); ctx.clip(); drawB(); });
      break;
    }
    case 'split': save(drawB); save(() => { ctx.beginPath(); ctx.rect(-e * W / 2, 0, W / 2, H); ctx.clip(); ctx.translate(-e * W / 2, 0); drawA(); }); save(() => { ctx.beginPath(); ctx.rect(W / 2 + e * W / 2, 0, W / 2, H); ctx.clip(); ctx.translate(e * W / 2, 0); drawA(); }); break;
    case 'clock': save(drawA); save(() => { ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.arc(W / 2, H / 2, Math.hypot(W, H), -Math.PI / 2, -Math.PI / 2 + e * Math.PI * 2); ctx.closePath(); ctx.clip(); drawB(); }); break;
    case 'diagonal': save(drawA); save(() => { ctx.beginPath(); const k = e * (W + H) * 1.05; ctx.moveTo(0, 0); ctx.lineTo(k, 0); ctx.lineTo(0, k); ctx.closePath(); ctx.clip(); drawB(); }); break;
    case 'blur': {
      const b = Math.sin(p * Math.PI) * 24;
      save(() => { ctx.filter = `blur(${b}px)`; (p < 0.5 ? drawA : drawB)(); });
      break;
    }
    case 'pixelate': {
      const k = Math.sin(p * Math.PI);
      const size = Math.max(1, Math.round(k * 60));
      const tmp = scratch(W, H);
      const tctx = tmp.getContext('2d');
      tctx.clearRect(0, 0, W, H);
      const prev = ctxSwap(ctx, tctx, p < 0.5 ? drawA : drawB);
      prev();
      const sw = Math.max(1, Math.round(W / size));
      const sh = Math.max(1, Math.round(H / size));
      const small = scratch(sw, sh, 6);
      const sctx = small.getContext('2d');
      sctx.clearRect(0, 0, sw, sh);
      sctx.drawImage(tmp, 0, 0, sw, sh);
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, sw, sh, 0, 0, W, H); ctx.restore();
      break;
    }
    case 'glitch': {
      save(p < 0.5 ? drawA : drawB);
      const k = Math.sin(p * Math.PI);
      ctx.save();
      for (let i = 0; i < 8; i++) {
        const y = ((i * 97 + Math.floor(p * 30) * 53) % 100) / 100 * H;
        const h = H * 0.04 * k;
        ctx.globalAlpha = 0.85;
        ctx.globalCompositeOperation = i % 2 ? 'screen' : 'difference';
        ctx.fillStyle = i % 3 === 0 ? '#ff00aa' : i % 3 === 1 ? '#00e5ff' : '#ffffff';
        ctx.fillRect(0, y, W, h * (0.5 + (i % 3) * 0.4));
      }
      ctx.restore();
      break;
    }
    case 'cube': {
      save(() => { ctx.translate(-e * W * 0.5, 0); ctx.transform(1 - e, 0, 0, 1, 0, 0); ctx.globalAlpha *= 1 - e * 0.5; drawA(); });
      save(() => { ctx.translate(W - W * e, 0); ctx.transform(Math.max(0.01, e), 0, 0, 1, 0, 0); drawB(); });
      break;
    }
    default: save(drawB);
  }
}

const scratchPool = new Map();
export function scratch(w, h, slot = 0) {
  const key = slot;
  let c = scratchPool.get(key);
  if (!c) { c = document.createElement('canvas'); scratchPool.set(key, c); }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}

// esegue fn disegnando su un altro contesto (per le transizioni che lavorano sui pixel)
function ctxSwap(main, other, fn) {
  return () => { other.save(); other.setTransform(1, 0, 0, 1, 0, 0); fn.call(null, other); other.restore(); };
}

// ------------------------------------------------------------------ forme
export function starPath(ctx, cx, cy, r1, r2, n) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (Math.PI / n) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

export function heartPath(ctx, cx, cy, r) {
  ctx.beginPath();
  const s = r / 1.1;
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.1, cx - s * 0.9, cy - s * 1.25, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.9, cy - s * 1.25, cx + s * 1.6, cy - s * 0.1, cx, cy + s * 0.9);
  ctx.closePath();
}

export const SHAPES = [
  ['rect', 'Rettangolo'], ['rounded', 'Arrotondato'], ['circle', 'Cerchio'], ['triangle', 'Triangolo'], ['star', 'Stella'],
  ['heart', 'Cuore'], ['hexagon', 'Esagono'], ['pentagon', 'Pentagono'], ['diamond', 'Rombo'], ['burst', 'Esplosione'],
  ['arrow', 'Freccia'], ['line', 'Linea'], ['ring', 'Anello'], ['bubble', 'Fumetto'], ['blob', 'Macchia'], ['ribbon', 'Nastro'],
];

export function drawShape(ctx, c, w, h) {
  const k = c.shape;
  const x = -w / 2;
  const y = -h / 2;
  ctx.beginPath();
  if (k === 'rect') ctx.rect(x, y, w, h);
  else if (k === 'rounded') ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.18);
  else if (k === 'circle') ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (k === 'triangle') { ctx.moveTo(0, y); ctx.lineTo(w / 2, h / 2); ctx.lineTo(x, h / 2); ctx.closePath(); } else if (k === 'star') { ctx.save(); ctx.scale(w / Math.max(w, h), h / Math.max(w, h)); starPath(ctx, 0, 0, Math.max(w, h) / 2, Math.max(w, h) / 4.6, 5); ctx.restore(); } else if (k === 'burst') { ctx.save(); ctx.scale(w / Math.max(w, h), h / Math.max(w, h)); starPath(ctx, 0, 0, Math.max(w, h) / 2, Math.max(w, h) / 2.6, 14); ctx.restore(); } else if (k === 'heart') { ctx.save(); ctx.scale(w / Math.max(w, h), h / Math.max(w, h)); heartPath(ctx, 0, Math.max(w, h) * 0.05, Math.max(w, h) * 0.5); ctx.restore(); } else if (k === 'hexagon' || k === 'pentagon') {
    const n = k === 'hexagon' ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 / n) * i - Math.PI / 2;
      const px = Math.cos(a) * w / 2;
      const py = Math.sin(a) * h / 2;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else if (k === 'diamond') { ctx.moveTo(0, y); ctx.lineTo(w / 2, 0); ctx.lineTo(0, h / 2); ctx.lineTo(x, 0); ctx.closePath(); } else if (k === 'arrow') {
    ctx.moveTo(x, -h * 0.18); ctx.lineTo(w * 0.15, -h * 0.18); ctx.lineTo(w * 0.15, y); ctx.lineTo(w / 2, 0); ctx.lineTo(w * 0.15, h / 2); ctx.lineTo(w * 0.15, h * 0.18); ctx.lineTo(x, h * 0.18); ctx.closePath();
  } else if (k === 'line') ctx.roundRect(x, -Math.max(4, h * 0.06), w, Math.max(8, h * 0.12), 6);
  else if (k === 'ring') { ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.ellipse(0, 0, w / 2 * 0.72, h / 2 * 0.72, 0, 0, Math.PI * 2, true); } else if (k === 'bubble') {
    ctx.roundRect(x, y, w, h * 0.8, Math.min(w, h) * 0.2);
    ctx.moveTo(x + w * 0.2, y + h * 0.78); ctx.lineTo(x + w * 0.16, h / 2); ctx.lineTo(x + w * 0.38, y + h * 0.78);
  } else if (k === 'blob') {
    const pts = 8;
    const R = [1, 0.82, 0.95, 0.78, 1.02, 0.85, 0.97, 0.8];
    const P = R.map((r, i) => { const a = (Math.PI * 2 / pts) * i; return [Math.cos(a) * w / 2 * r, Math.sin(a) * h / 2 * r]; });
    ctx.moveTo((P[0][0] + P[pts - 1][0]) / 2, (P[0][1] + P[pts - 1][1]) / 2);
    for (let i = 0; i < pts; i++) { const a = P[i]; const b = P[(i + 1) % pts]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    ctx.closePath();
  } else if (k === 'ribbon') {
    ctx.moveTo(x, y); ctx.lineTo(w / 2, y); ctx.lineTo(w / 2 - h * 0.35, 0); ctx.lineTo(w / 2, h / 2); ctx.lineTo(x, h / 2); ctx.lineTo(x + h * 0.35, 0); ctx.closePath();
  } else ctx.rect(x, y, w, h);
}

// ------------------------------------------------------------------ adesivi
export const STICKERS = {
  'Sport': ['🤸‍♀️', '🤸‍♂️', '🤸', '🥋', '🎽', '🏅', '🥇', '🥈', '🥉', '🏆', '🎖️', '💪', '🧘‍♀️', '🏃‍♀️', '⛹️‍♀️', '🤾‍♀️', '🏋️‍♀️', '🎯', '⚡', '🔥', '⏱️', '📣', '🎀', '🩰'],
  'Festa': ['🎉', '🎊', '🎈', '🎂', '🍰', '🎁', '🥳', '✨', '🌟', '⭐', '💫', '🎆', '🎇', '🪅', '🍾', '🥂', '🎶', '🎵'],
  'Cuori': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🖤', '💖', '💕', '💞', '💓', '💗', '💝', '❣️', '🫶'],
  'Facce': ['😀', '😁', '😂', '🤩', '😍', '🥰', '😎', '🤗', '😮', '😱', '🥹', '😇', '🤭', '😜', '🙌', '👏', '👍', '✌️', '🤞', '🫡'],
  'Simboli': ['✅', '❌', '⚠️', '📍', '📅', '⏰', '🔔', '💯', '🆕', '🆒', '🔝', '➡️', '⬅️', '⬆️', '⬇️', '❗', '❓', '💬', '📸', '🎬'],
  'Natura': ['🌸', '🌺', '🌻', '🌈', '☀️', '🌙', '❄️', '🍀', '🌊', '🦋', '🌴', '🍂', '⛄', '🎄', '🐣', '🌷'],
};

export const ICON_STICKERS = ['trophy', 'medal', 'award', 'crown', 'star', 'heart', 'sparkles', 'zap', 'flame', 'dumbbell', 'heart-pulse', 'activity', 'timer', 'calendar', 'map-pin', 'phone', 'megaphone', 'camera', 'music', 'party-popper', 'gift', 'rocket', 'thumbs-up', 'check'];

// ------------------------------------------------------------------ stili di testo
export const TEXT_STYLES = [
  { name: 'Titolo sport', p: { font: 'Anton', weight: 400, uppercase: true, letterSpacing: 2, color: '#FFFFFF', textShadow: { enabled: true, color: '#7B4BFF', blur: 0, x: 6, y: 6 } } },
  { name: 'Neon rosa', p: { font: 'Righteous', weight: 400, color: '#FFFFFF', textShadow: { enabled: true, color: '#FF4FA3', blur: 28, x: 0, y: 0 }, stroke: { width: 0, color: '#000' } } },
  { name: 'Neon blu', p: { font: 'Russo One', weight: 400, color: '#E0FBFF', textShadow: { enabled: true, color: '#00D4FF', blur: 30, x: 0, y: 0 } } },
  { name: 'Gradiente', p: { font: 'Montserrat', weight: 900, gradient: ['#FFB86B', '#FF4FA3', '#8B5CF6'], uppercase: true } },
  { name: 'Oro', p: { font: 'Abril Fatface', weight: 400, gradient: ['#FFF3B0', '#F5C04A', '#B8860B'], textShadow: { enabled: true, color: 'rgba(0,0,0,.45)', blur: 12, x: 0, y: 6 } } },
  { name: 'Contorno', p: { font: 'Archivo Black', weight: 400, color: 'rgba(0,0,0,0)', stroke: { width: 5, color: '#FFFFFF' }, uppercase: true } },
  { name: 'Etichetta', p: { font: 'Poppins', weight: 700, color: '#FFFFFF', bg: { enabled: true, color: '#7C4DFF', padding: 26, radius: 999 } } },
  { name: 'Etichetta bianca', p: { font: 'Poppins', weight: 700, color: '#1B1440', bg: { enabled: true, color: '#FFFFFF', padding: 24, radius: 16 } } },
  { name: 'Sottotitolo', p: { font: 'Poppins', weight: 700, size: 54, color: '#FFFFFF', bg: { enabled: true, color: 'rgba(0,0,0,.6)', padding: 18, radius: 12 } } },
  { name: 'Fumetto', p: { font: 'Bangers', weight: 400, color: '#FFE14D', stroke: { width: 8, color: '#1B1440' }, letterSpacing: 2, textShadow: { enabled: true, color: '#1B1440', blur: 0, x: 6, y: 6 } } },
  { name: 'Allegro', p: { font: 'Luckiest Guy', weight: 400, color: '#FFFFFF', stroke: { width: 7, color: '#FF4FA3' } } },
  { name: 'Bolla', p: { font: 'Fredoka', weight: 700, color: '#FFFFFF', stroke: { width: 6, color: '#0EA5E9' } } },
  { name: 'Retrò', p: { font: 'Lobster', weight: 400, color: '#FFD84D', textShadow: { enabled: true, color: '#E9468F', blur: 0, x: 5, y: 5 } } },
  { name: 'Elegante', p: { font: 'Playfair Display', weight: 700, italic: true, color: '#FFFFFF' } },
  { name: 'Corsivo', p: { font: 'Great Vibes', weight: 400, size: 130, color: '#FFFFFF', textShadow: { enabled: true, color: 'rgba(0,0,0,.4)', blur: 10, x: 0, y: 4 } } },
  { name: 'Firma', p: { font: 'Dancing Script', weight: 700, color: '#FFE38A' } },
  { name: 'Pennarello', p: { font: 'Permanent Marker', weight: 400, color: '#FFFFFF' } },
  { name: 'Appunti', p: { font: 'Caveat', weight: 700, size: 110, color: '#FFF3B0' } },
  { name: 'Pixel', p: { font: 'Press Start 2P', weight: 400, size: 54, color: '#7CFFB2', textShadow: { enabled: true, color: '#00381A', blur: 0, x: 5, y: 5 } } },
  { name: 'Militare', p: { font: 'Black Ops One', weight: 400, color: '#FFFFFF', uppercase: true } },
  { name: 'Moderno', p: { font: 'Bebas Neue', weight: 400, size: 130, letterSpacing: 6, color: '#FFFFFF' } },
  { name: 'Condensato', p: { font: 'Oswald', weight: 700, uppercase: true, letterSpacing: 3, color: '#FFFFFF' } },
  { name: 'Sottile', p: { font: 'Raleway', weight: 300, letterSpacing: 10, uppercase: true, color: '#FFFFFF' } },
  { name: 'Editoriale', p: { font: 'Roboto Slab', weight: 700, color: '#FFFFFF' } },
  { name: 'Morbido', p: { font: 'Lilita One', weight: 400, color: '#FFFFFF', textShadow: { enabled: true, color: 'rgba(123,75,255,.8)', blur: 0, x: 0, y: 8 } } },
  { name: 'Hawaii', p: { font: 'Pacifico', weight: 400, color: '#FFFFFF', textShadow: { enabled: true, color: '#F97316', blur: 0, x: 4, y: 4 } } },
  { name: 'Romantico', p: { font: 'Satisfy', weight: 400, color: '#FFD1E8' } },
  { name: 'Impatto', p: { font: 'Archivo Black', weight: 400, uppercase: true, color: '#FFFFFF', bg: { enabled: true, color: '#E11D48', padding: 20, radius: 0 } } },
  { name: 'Prezzo', p: { font: 'Montserrat', weight: 900, color: '#1B1440', bg: { enabled: true, color: '#FFE14D', padding: 22, radius: 999 } } },
  { name: 'Ombra lunga', p: { font: 'Montserrat', weight: 900, color: '#FFFFFF', textShadow: { enabled: true, color: 'rgba(0,0,0,.55)', blur: 0, x: 10, y: 10 } } },
  { name: 'Brillante', p: { font: 'Montserrat', weight: 800, color: '#FFFFFF', textShadow: { enabled: true, color: '#FFFFFF', blur: 22, x: 0, y: 0 } } },
  { name: 'Citazione', p: { font: 'Playfair Display', weight: 400, italic: true, size: 72, color: '#FFFFFF', bg: { enabled: true, color: 'rgba(255,255,255,.12)', padding: 30, radius: 24 } } },
  { name: 'Arcobaleno', p: { font: 'Fredoka', weight: 700, gradient: ['#FF5E62', '#FFD84D', '#2FBF71', '#00B4DB', '#8B5CF6'] } },
  { name: 'Ghiaccio', p: { font: 'Russo One', weight: 400, gradient: ['#FFFFFF', '#A5E8FF', '#3D8BFF'], stroke: { width: 2, color: '#E0FBFF' } } },
  { name: 'Fuoco', p: { font: 'Anton', weight: 400, uppercase: true, gradient: ['#FFE14D', '#FF7A3D', '#E11D48'], textShadow: { enabled: true, color: '#FF7A3D', blur: 24, x: 0, y: 0 } } },
  { name: 'Classico', p: { font: 'Montserrat', weight: 800, color: '#FFFFFF' } },
];

export const FONTS = ['Montserrat', 'Poppins', 'Plus Jakarta Sans', 'Outfit', 'Anton', 'Bebas Neue', 'Oswald', 'Archivo Black', 'Russo One', 'Righteous', 'Bangers', 'Luckiest Guy', 'Lilita One', 'Fredoka', 'Lobster', 'Pacifico', 'Great Vibes', 'Dancing Script', 'Satisfy', 'Permanent Marker', 'Caveat', 'Playfair Display', 'Abril Fatface', 'Roboto Slab', 'Raleway', 'Black Ops One', 'Press Start 2P', 'JetBrains Mono'];

// ------------------------------------------------------------------ sfondi
export const GRADIENTS = [
  ['#5B5BF6', '#E9468F'], ['#1B1440', '#4B1E6E'], ['#0F2027', '#2C5364'], ['#FF7A3D', '#F0408F'], ['#00B4DB', '#0083B0'], ['#11998E', '#38EF7D'],
  ['#FC466B', '#3F5EFB'], ['#F7971E', '#FFD200'], ['#8E2DE2', '#4A00E0'], ['#FF5F6D', '#FFC371'], ['#232526', '#414345'], ['#E0EAFC', '#CFDEF3'],
  ['#FBD3E9', '#BB377D'], ['#43C6AC', '#191654'], ['#C33764', '#1D2671'], ['#FFAFBD', '#FFC3A0'], ['#000000', '#434343'], ['#56CCF2', '#2F80ED'],
  ['#F857A6', '#FF5858'], ['#4568DC', '#B06AB3'], ['#FFE000', '#799F0C'], ['#B993D6', '#8CA6DB'], ['#ED4264', '#FFEDBC'], ['#0B0A14', '#2A1A6B'],
];
export const SOLIDS = ['#FFFFFF', '#F5F4FB', '#000000', '#14102B', '#7C4DFF', '#E9468F', '#F97316', '#FACC15', '#10B981', '#0EA5E9', '#1E3A8A', '#E11D48', '#FDE68A', '#FBCFE8', '#C7D2FE', '#A7F3D0'];
