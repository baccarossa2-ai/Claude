// Audio di Salto Studio: mixer con volumi e dissolvenze, effetti voce, registrazione della
// voce fuori campo, effetti sonori e basi musicali generate al momento (senza diritti d'autore).
import { S, end } from './state.js';
import { allElements, onMediaElement } from './engine.js';

let ctx;
let master;
let streamDest;
const chains = new Map(); // clip.id -> {src, gain, fxIn, fxOut, fx}

export function audioCtx() {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    streamDest = ctx.createMediaStreamDestination();
    master.connect(streamDest);
  }
  return ctx;
}

export function masterStream() { audioCtx(); return streamDest.stream; }
export function resume() { audioCtx(); if (ctx.state !== 'running') return ctx.resume(); return Promise.resolve(); }
export function setMasterVolume(v) { audioCtx(); master.gain.value = v; }

// ogni elemento video/audio passa dal mixer
onMediaElement((el, c) => {
  const a = audioCtx();
  try {
    const src = a.createMediaElementSource(el);
    const gain = a.createGain();
    src.connect(gain);
    const chain = { src, gain, fx: 'none', nodes: [] };
    chains.set(c.id, chain);
    buildFx(chain, c.voiceFx || 'none');
  } catch (err) {
    console.warn('Audio non collegato', err);
  }
});

function impulse(ac, seconds = 2.8, decay = 3) {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function distortionCurve(k = 30) {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; curve[i] = ((3 + k) * x * 20 * Math.PI / 180) / (Math.PI + k * Math.abs(x)); }
  return curve;
}

export const VOICE_FX = [
  ['none', 'Naturale', '🎙️'], ['robot', 'Robot', '🤖'], ['echo', 'Eco', '🏔️'], ['cathedral', 'Cattedrale', '⛪'],
  ['radio', 'Radio', '📻'], ['phone', 'Telefono', '📞'], ['megaphone', 'Megafono', '📣'], ['deep', 'Voce cupa', '🐻'],
  ['chipmunk', 'Scoiattolo', '🐿️'], ['monster', 'Mostro', '👹'], ['stadium', 'Stadio', '🏟️'], ['underwater', 'Sott\'acqua', '🌊'],
];

// costruisce la catena dell'effetto voce su qualsiasi contesto audio (anteprima o esportazione)
export function createFxGraph(ac, fx) {
  const input = ac.createGain();
  const output = ac.createGain();
  const nodes = [input, output];
  const link = (...list) => { let prev = input; for (const n of list) { prev.connect(n); prev = n; nodes.push(n); } prev.connect(output); };
  switch (fx) {
    case 'robot': {
      const ring = ac.createGain(); ring.gain.value = 0;
      const osc = ac.createOscillator(); osc.frequency.value = 55; osc.connect(ring.gain); osc.start();
      nodes.push(osc);
      link(ring, ac.createDynamicsCompressor());
      break;
    }
    case 'echo': {
      const delay = ac.createDelay(1); delay.delayTime.value = 0.28;
      const fb = ac.createGain(); fb.gain.value = 0.42;
      delay.connect(fb); fb.connect(delay);
      input.connect(output); input.connect(delay); delay.connect(output);
      nodes.push(delay, fb);
      break;
    }
    case 'cathedral':
    case 'stadium': {
      const conv = ac.createConvolver(); conv.buffer = impulse(ac, fx === 'stadium' ? 1.6 : 3.4, fx === 'stadium' ? 2 : 2.6);
      const wet = ac.createGain(); wet.gain.value = fx === 'stadium' ? 0.5 : 0.75;
      input.connect(output); input.connect(conv); conv.connect(wet); wet.connect(output);
      nodes.push(conv, wet);
      break;
    }
    case 'radio':
    case 'megaphone': {
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = fx === 'radio' ? 500 : 700;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = fx === 'radio' ? 3200 : 2600;
      const ws = ac.createWaveShaper(); ws.curve = distortionCurve(fx === 'radio' ? 20 : 60);
      link(hp, lp, ws);
      break;
    }
    case 'phone': {
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
      link(bp);
      break;
    }
    case 'deep': {
      const ls = ac.createBiquadFilter(); ls.type = 'lowshelf'; ls.frequency.value = 220; ls.gain.value = 9;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      link(ls, lp);
      break;
    }
    case 'underwater': {
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 4;
      link(lp);
      break;
    }
    default:
      input.connect(output);
  }
  return { input, output, nodes };
}

function buildFx(chain, fx) {
  try { chain.gain.disconnect(); } catch { /* già scollegato */ }
  for (const n of chain.nodes) { try { n.disconnect(); } catch { /* ok */ } if (n.stop) try { n.stop(); } catch { /* ok */ } }
  const g = createFxGraph(audioCtx(), fx);
  chain.nodes = g.nodes;
  chain.fx = fx;
  chain.gain.connect(g.input);
  g.output.connect(master);
}

// mix completo dell'audio del progetto, calcolato fuori tempo reale (per l'esportazione precisa)
const decoded = new Map();
export async function renderMixdown(project, dur, sampleRate = 48000, onProgress) {
  const ac = new OfflineAudioContext(2, Math.max(1, Math.ceil(dur * sampleRate)), sampleRate);
  const clips = project.clips.filter(c => (c.type === 'audio' || c.type === 'video') && !c.muted && !(project.tracks.find(t => t.id === c.trackId) || {}).muted);
  let i = 0;
  for (const c of clips) {
    onProgress && onProgress(i++ / Math.max(1, clips.length));
    let buf = decoded.get(c.src);
    if (buf === undefined) {
      try {
        const ab = await (await fetch(c.src)).arrayBuffer();
        buf = await audioCtx().decodeAudioData(ab);
      } catch { buf = null; }
      decoded.set(c.src, buf);
    }
    if (!buf) continue;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = c.speed || 1;
    const g = ac.createGain();
    const v = c.volume ?? 1;
    const st = c.start;
    const en = c.start + c.duration;
    g.gain.setValueAtTime(c.fadeIn > 0 ? 0 : v, st);
    if (c.fadeIn > 0) g.gain.linearRampToValueAtTime(v, st + Math.min(c.fadeIn, c.duration));
    if (c.fadeOut > 0) { g.gain.setValueAtTime(v, Math.max(st, en - c.fadeOut)); g.gain.linearRampToValueAtTime(0, en); }
    const fx = createFxGraph(ac, c.voiceFx || 'none');
    src.connect(g);
    g.connect(fx.input);
    fx.output.connect(ac.destination);
    const offset = Math.min(c.in || 0, buf.duration);
    src.start(st, offset, Math.max(0, Math.min(c.duration * (c.speed || 1), buf.duration - offset)));
  }
  onProgress && onProgress(1);
  return ac.startRendering();
}

// aggiorna volumi, dissolvenze ed effetti a ogni fotogramma
export function updateMix(t) {
  if (!ctx) return;
  for (const c of S.project.clips) {
    const ch = chains.get(c.id);
    if (!ch) continue;
    if ((c.voiceFx || 'none') !== ch.fx) buildFx(ch, c.voiceFx || 'none');
    let v = c.muted ? 0 : (c.volume ?? 1);
    const local = t - c.start;
    if (c.fadeIn > 0 && local < c.fadeIn) v *= Math.max(0, local / c.fadeIn);
    if (c.fadeOut > 0 && end(c) - t < c.fadeOut) v *= Math.max(0, (end(c) - t) / c.fadeOut);
    ch.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.015);
  }
}

// ------------------------------------------------------------------ registrazione voce
let recorder = null;
let recChunks = [];
let recStream = null;

export async function startRecording() {
  recStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
  recorder = new MediaRecorder(recStream, mime ? { mimeType: mime } : undefined);
  recChunks = [];
  recorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
  recorder.start(250);
  return recStream;
}

export function stopRecording() {
  return new Promise(resolve => {
    if (!recorder) { resolve(null); return; }
    recorder.onstop = () => {
      const blob = new Blob(recChunks, { type: recorder.mimeType || 'audio/webm' });
      recStream.getTracks().forEach(tr => tr.stop());
      recorder = null;
      resolve(blob);
    };
    recorder.stop();
  });
}

export function micLevel(stream, cb) {
  const a = audioCtx();
  const an = a.createAnalyser();
  an.fftSize = 512;
  a.createMediaStreamSource(stream).connect(an);
  const data = new Uint8Array(an.fftSize);
  let alive = true;
  const tick = () => {
    if (!alive) return;
    an.getByteTimeDomainData(data);
    let m = 0;
    for (const v of data) m = Math.max(m, Math.abs(v - 128));
    cb(m / 128);
    requestAnimationFrame(tick);
  };
  tick();
  return () => { alive = false; };
}

// ------------------------------------------------------------------ WAV
export function encodeWav(buffer) {
  const ch = buffer.numberOfChannels;
  const len = buffer.length * ch * 2 + 44;
  const out = new DataView(new ArrayBuffer(len));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, len - 8, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, buffer.sampleRate, true); out.setUint32(28, buffer.sampleRate * ch * 2, true);
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, len - 44, true);
  const chans = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i));
  let o = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      o += 2;
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}

// ------------------------------------------------------------------ effetti sonori sintetizzati
const SR = 44100;
function off(seconds) { return new OfflineAudioContext(2, Math.ceil(SR * seconds), SR); }
function noiseBuf(o, seconds) {
  const b = o.createBuffer(1, Math.ceil(SR * seconds), SR);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function tone(o, { type = 'sine', f = 440, f2, t0 = 0, dur = 0.3, vol = 0.5, attack = 0.005, dest }) {
  const osc = o.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t0);
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = o.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(dest || o.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}
function noiseHit(o, { t0 = 0, dur = 0.2, vol = 0.4, type = 'highpass', f = 3000, f2, q = 0.8, dest }) {
  const src = o.createBufferSource();
  src.buffer = noiseBuf(o, dur + 0.05);
  const bq = o.createBiquadFilter(); bq.type = type; bq.frequency.setValueAtTime(f, t0); bq.Q.value = q;
  if (f2) bq.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = o.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bq); bq.connect(g); g.connect(dest || o.destination);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

export const SFX = [
  { id: 'whoosh', name: 'Whoosh', emoji: '💨', dur: 0.9, make: o => noiseHit(o, { dur: 0.85, vol: 0.7, type: 'bandpass', f: 300, f2: 4000, q: 1.5 }) },
  { id: 'swoosh-down', name: 'Swoosh giù', emoji: '⬇️', dur: 0.7, make: o => noiseHit(o, { dur: 0.65, vol: 0.7, type: 'bandpass', f: 5000, f2: 250, q: 1.5 }) },
  { id: 'pop', name: 'Pop', emoji: '🫧', dur: 0.25, make: o => tone(o, { f: 900, f2: 180, dur: 0.18, vol: 0.8 }) },
  { id: 'click', name: 'Click', emoji: '🖱️', dur: 0.1, make: o => noiseHit(o, { dur: 0.04, vol: 0.9, f: 2000 }) },
  { id: 'ding', name: 'Ding', emoji: '🔔', dur: 1.6, make: o => { tone(o, { f: 1318, dur: 1.5, vol: 0.5 }); tone(o, { f: 2636, dur: 0.9, vol: 0.18 }); tone(o, { f: 3954, dur: 0.5, vol: 0.08 }); } },
  { id: 'success', name: 'Successo', emoji: '🏆', dur: 1.4, make: o => [523, 659, 784, 1047].forEach((f, i) => tone(o, { type: 'triangle', f, t0: i * 0.12, dur: i === 3 ? 0.9 : 0.25, vol: 0.45 })) },
  { id: 'fail', name: 'Ops', emoji: '😬', dur: 1.2, make: o => [392, 370, 349, 330].forEach((f, i) => tone(o, { type: 'sawtooth', f, t0: i * 0.22, dur: i === 3 ? 0.6 : 0.2, vol: 0.2 })) },
  { id: 'applause', name: 'Applausi', emoji: '👏', dur: 3.2, make: o => { for (let i = 0; i < 90; i++) noiseHit(o, { t0: Math.random() * 2.8, dur: 0.06 + Math.random() * 0.05, vol: 0.12 + Math.random() * 0.15, type: 'bandpass', f: 1200 + Math.random() * 2500, q: 0.7 }); } },
  { id: 'drumroll', name: 'Rullo di tamburi', emoji: '🥁', dur: 2.6, make: o => { for (let i = 0; i < 60; i++) noiseHit(o, { t0: i * 0.035, dur: 0.05, vol: 0.12 + i / 300, type: 'bandpass', f: 1800, q: 0.6 }); noiseHit(o, { t0: 2.15, dur: 0.45, vol: 0.8, f: 4000 }); tone(o, { f: 70, f2: 40, t0: 2.15, dur: 0.4, vol: 0.9 }); } },
  { id: 'boing', name: 'Boing', emoji: '🦘', dur: 0.8, make: o => { const osc = o.createOscillator(); osc.frequency.setValueAtTime(150, 0); osc.frequency.exponentialRampToValueAtTime(600, 0.08); osc.frequency.exponentialRampToValueAtTime(220, 0.7); const lfo = o.createOscillator(); lfo.frequency.value = 22; const lg = o.createGain(); lg.gain.value = 30; lfo.connect(lg); lg.connect(osc.frequency); const g = o.createGain(); g.gain.setValueAtTime(0.5, 0); g.gain.exponentialRampToValueAtTime(0.001, 0.75); osc.connect(g); g.connect(o.destination); osc.start(); lfo.start(); osc.stop(0.8); lfo.stop(0.8); } },
  { id: 'whistle', name: 'Fischietto', emoji: '📯', dur: 1.0, make: o => { const osc = o.createOscillator(); osc.frequency.value = 2600; const lfo = o.createOscillator(); lfo.frequency.value = 30; const lg = o.createGain(); lg.gain.value = 140; lfo.connect(lg); lg.connect(osc.frequency); const g = o.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.35, 0.03); g.gain.setValueAtTime(0.35, 0.8); g.gain.exponentialRampToValueAtTime(0.0001, 0.95); osc.connect(g); g.connect(o.destination); osc.start(); lfo.start(); osc.stop(1); lfo.stop(1); } },
  { id: 'countdown', name: 'Conto alla rovescia', emoji: '⏱️', dur: 3.6, make: o => { [0, 1, 2].forEach(i => tone(o, { type: 'square', f: 880, t0: i, dur: 0.15, vol: 0.2 })); tone(o, { type: 'square', f: 1760, t0: 3, dur: 0.5, vol: 0.25 }); } },
  { id: 'laser', name: 'Laser', emoji: '⚡', dur: 0.4, make: o => tone(o, { type: 'sawtooth', f: 2400, f2: 120, dur: 0.35, vol: 0.3 }) },
  { id: 'heartbeat', name: 'Battito', emoji: '💓', dur: 2.0, make: o => [0, 0.22, 1, 1.22].forEach(t0 => tone(o, { f: 60, f2: 40, t0, dur: 0.18, vol: 0.9 })) },
  { id: 'magic', name: 'Magia', emoji: '✨', dur: 1.6, make: o => { for (let i = 0; i < 14; i++) tone(o, { f: 1200 + i * 180 + Math.random() * 80, t0: i * 0.06, dur: 0.6, vol: 0.12 }); } },
  { id: 'bell', name: 'Campanella', emoji: '🛎️', dur: 2.2, make: o => { tone(o, { f: 880, dur: 2, vol: 0.35 }); tone(o, { f: 2217, dur: 1.2, vol: 0.12 }); tone(o, { f: 3520, dur: 0.6, vol: 0.06 }); } },
  { id: 'camera', name: 'Scatto foto', emoji: '📸', dur: 0.4, make: o => { noiseHit(o, { dur: 0.05, vol: 0.9, f: 1500 }); noiseHit(o, { t0: 0.12, dur: 0.07, vol: 0.7, f: 2500 }); } },
  { id: 'impact', name: 'Impatto', emoji: '💥', dur: 1.4, make: o => { tone(o, { f: 90, f2: 30, dur: 1.2, vol: 1 }); noiseHit(o, { dur: 0.5, vol: 0.6, type: 'lowpass', f: 2500, f2: 200 }); } },
];

// basi musicali generate: batteria, basso e accordi
export const MUSIC = [
  { id: 'energia', name: 'Energia', desc: '128 BPM · elettronica', emoji: '⚡', bpm: 128, bars: 8, style: 'edm', key: 0 },
  { id: 'chill', name: 'Relax', desc: '86 BPM · lo-fi', emoji: '☕', bpm: 86, bars: 6, style: 'lofi', key: 5 },
  { id: 'epico', name: 'Epico', desc: '100 BPM · cinematografica', emoji: '🏔️', bpm: 100, bars: 8, style: 'epic', key: 9 },
  { id: 'pop', name: 'Pop allegro', desc: '118 BPM · solare', emoji: '☀️', bpm: 118, bars: 8, style: 'pop', key: 7 },
  { id: 'ritmica', name: 'Valzer ritmica', desc: '150 BPM · 3/4 elegante', emoji: '🎀', bpm: 150, bars: 12, style: 'waltz', key: 2 },
  { id: 'gara', name: 'Giorno di gara', desc: '140 BPM · carica', emoji: '🏆', bpm: 140, bars: 8, style: 'drive', key: 4 },
];

function kick(o, t, v = 1) { tone(o, { f: 140, f2: 42, t0: t, dur: 0.32, vol: 0.95 * v }); }
function snare(o, t, v = 1) { noiseHit(o, { t0: t, dur: 0.18, vol: 0.4 * v, type: 'bandpass', f: 1900, q: 0.8 }); tone(o, { type: 'triangle', f: 210, f2: 160, t0: t, dur: 0.1, vol: 0.25 * v }); }
function hat(o, t, v = 1) { noiseHit(o, { t0: t, dur: 0.05, vol: 0.13 * v, f: 7500 }); }
function pluck(o, t, f, dur, vol, type = 'triangle') { tone(o, { type, f, t0: t, dur, vol, attack: 0.008 }); }
const note = (root, semi) => 220 * Math.pow(2, (root + semi) / 12);

export async function renderMusic(m) {
  const beat = 60 / m.bpm;
  const beatsPerBar = m.style === 'waltz' ? 3 : 4;
  const total = m.bars * beatsPerBar * beat + 1;
  const o = off(total);
  const comp = o.createDynamicsCompressor();
  comp.connect(o.destination);
  const prog = m.style === 'epic' ? [0, -4, 3, -2] : m.style === 'lofi' ? [0, 5, -3, 2] : [0, -3, 5, 3];
  for (let bar = 0; bar < m.bars; bar++) {
    const root = m.key + prog[bar % prog.length];
    for (let b = 0; b < beatsPerBar; b++) {
      const t = (bar * beatsPerBar + b) * beat;
      if (m.style === 'waltz') {
        if (b === 0) { pluck(o, t, note(root, -12), beat * 2.5, 0.3, 'sine'); }
        else [0, 4, 7].forEach(s => pluck(o, t, note(root, s), beat * 0.8, 0.09, 'triangle'));
        if (b === 0) pluck(o, t, note(root, 12 + [0, 4, 7, 12][bar % 4]), beat * 2.8, 0.12, 'sine');
        continue;
      }
      if (m.style === 'edm' || m.style === 'drive') {
        kick(o, t);
        hat(o, t + beat / 2, 1.2);
        if (b % 2 === 1) snare(o, t);
        pluck(o, t + beat / 2, note(root, -12), beat * 0.45, 0.32, 'sawtooth');
        if (m.style === 'drive') hat(o, t + beat / 4, 0.7), hat(o, t + beat * 3 / 4, 0.7);
      } else if (m.style === 'lofi') {
        if (b === 0 || b === 2.5) kick(o, t, 0.7);
        if (b === 2) kick(o, t + beat / 2, 0.6);
        if (b % 2 === 1) snare(o, t, 0.6);
        hat(o, t, 0.6); hat(o, t + beat * 0.55, 0.4);
        if (b === 0) [0, 3, 7, 10].forEach(s => pluck(o, t, note(root, s), beat * 3.6, 0.07, 'sine'));
        pluck(o, t, note(root, -12), beat * 0.9, 0.2, 'sine');
      } else if (m.style === 'epic') {
        if (b === 0 || b === 2) kick(o, t, 1.1);
        if (b === 0) { noiseHit(o, { t0: t, dur: 1.2, vol: 0.12, type: 'lowpass', f: 900 }); [0, 7, 12, 16].forEach(s => tone(o, { type: 'sawtooth', f: note(root, s - 12), t0: t, dur: beat * 3.9, vol: 0.06, attack: 0.4 })); }
        tone(o, { type: 'triangle', f: 80 + (b % 2) * 20, f2: 60, t0: t + beat / 2, dur: 0.2, vol: 0.4 });
      } else {
        kick(o, t, 0.9);
        if (b % 2 === 1) snare(o, t, 0.9);
        hat(o, t + beat / 2);
        [0, 4, 7].forEach((s, i) => pluck(o, t + (i * beat) / 6, note(root, s + 12), beat * 0.5, 0.1, 'triangle'));
        pluck(o, t, note(root, -12), beat * 0.8, 0.25, 'sine');
      }
    }
  }
  return o.startRendering();
}

export async function renderSfx(s) {
  const o = off(s.dur + 0.2);
  s.make(o);
  return o.startRendering();
}

let previewSrc = null;
export async function previewBuffer(buf) {
  await resume();
  stopPreview();
  previewSrc = audioCtx().createBufferSource();
  previewSrc.buffer = buf;
  previewSrc.connect(ctx.destination);
  previewSrc.start();
  return new Promise(r => { previewSrc.onended = r; });
}
export function stopPreview() { if (previewSrc) { try { previewSrc.stop(); } catch { /* già fermo */ } previewSrc = null; } }

// picchi della forma d'onda per la timeline
const peakCache = new Map();
export async function peaks(src, count = 400) {
  const key = src + count;
  if (peakCache.has(key)) return peakCache.get(key);
  const p = (async () => {
    const res = await fetch(src);
    const arr = await res.arrayBuffer();
    const buf = await audioCtx().decodeAudioData(arr);
    const d = buf.getChannelData(0);
    const step = Math.floor(d.length / count) || 1;
    const out = [];
    for (let i = 0; i < count; i++) {
      let m = 0;
      for (let j = i * step; j < (i + 1) * step && j < d.length; j += 16) m = Math.max(m, Math.abs(d[j]));
      out.push(m);
    }
    return { peaks: out, duration: buf.duration };
  })().catch(() => ({ peaks: [], duration: 0 }));
  peakCache.set(key, p);
  return p;
}

export function hasAudioChains() { return allElements().size > 0; }
