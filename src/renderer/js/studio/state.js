// Stato del progetto di Salto Studio: tracce, clip, selezione, tempo, annulla/ripeti.

export const FORMATS = [
  { id: 'reel', name: 'Reel / TikTok', sub: '9:16 · 1080×1920', w: 1080, h: 1920, icon: 'smartphone' },
  { id: 'story', name: 'Storia', sub: '9:16 · 1080×1920', w: 1080, h: 1920, icon: 'circle-dot' },
  { id: 'post', name: 'Post quadrato', sub: '1:1 · 1080×1080', w: 1080, h: 1080, icon: 'square' },
  { id: 'portrait', name: 'Post verticale', sub: '4:5 · 1080×1350', w: 1080, h: 1350, icon: 'frame' },
  { id: 'youtube', name: 'YouTube / TV', sub: '16:9 · 1920×1080', w: 1920, h: 1080, icon: 'monitor-play' },
  { id: 'a4', name: 'Locandina A4', sub: 'Stampa · 1240×1754', w: 1240, h: 1754, icon: 'file-text' },
];

let seq = 0;
export const nid = (p = 'c') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function newProject(fmt = FORMATS[0]) {
  return {
    version: 1,
    name: 'Progetto senza titolo',
    format: fmt.id,
    width: fmt.w,
    height: fmt.h,
    fps: 30,
    designDuration: 6,
    background: { type: 'gradient', color: '#14102B', colors: ['#1B1440', '#4B1E6E'], angle: 160 },
    tracks: [
      { id: 'tv1', kind: 'visual', name: 'Video 1' },
      { id: 'tv2', kind: 'visual', name: 'Livello 2' },
      { id: 'tv3', kind: 'visual', name: 'Testi' },
      { id: 'ta1', kind: 'audio', name: 'Musica' },
      { id: 'ta2', kind: 'audio', name: 'Voce' },
    ],
    clips: [],
    media: [],
  };
}

export const DEFAULT_ADJUST = { brightness: 0, contrast: 0, saturate: 0, hue: 0, blur: 0, temperature: 0, vignette: 0, grain: 0, sharpen: 0, exposure: 0 };

export function baseClip(type, props = {}) {
  return {
    id: nid(),
    type,
    trackId: null,
    start: 0,
    duration: 5,
    in: 0,
    speed: 1,
    x: 0, y: 0, w: 400, h: 400,
    rotation: 0,
    opacity: 1,
    flipH: false,
    flipV: false,
    fit: 'cover',
    blend: 'source-over',
    filter: 'none',
    filterAmount: 1,
    adjust: { ...DEFAULT_ADJUST },
    effect: 'none',
    chroma: { enabled: false, color: '#00ff00', tolerance: 0.35, smooth: 0.08 },
    animIn: { type: 'none', duration: 0.6 },
    animOut: { type: 'none', duration: 0.5 },
    loop: { type: 'none', speed: 1 },
    transition: { type: 'none', duration: 0.6 },
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    voiceFx: 'none',
    muted: false,
    locked: false,
    radius: 0,
    border: { width: 0, color: '#ffffff' },
    shadow: { enabled: false, color: 'rgba(0,0,0,.5)', blur: 30, x: 0, y: 12 },
    ...props,
  };
}

export function textClip(props = {}) {
  return baseClip('text', {
    text: 'Scrivi qui',
    font: 'Montserrat',
    size: 96,
    weight: 800,
    italic: false,
    color: '#FFFFFF',
    gradient: null,
    align: 'center',
    lineHeight: 1.1,
    letterSpacing: 0,
    uppercase: false,
    stroke: { width: 0, color: '#000000' },
    textShadow: { enabled: false, color: 'rgba(0,0,0,.6)', blur: 18, x: 0, y: 6 },
    bg: { enabled: false, color: '#7C4DFF', padding: 24, radius: 18 },
    w: 900, h: 220,
    ...props,
  });
}

// ------------------------------------------------------------------ store con storico
const listeners = new Set();
export const S = {
  project: newProject(),
  time: 0,
  playing: false,
  selected: null,
  zoom: 80, // pixel per secondo nella timeline
  filePath: null,
  dirty: false,
  past: [],
  future: [],
};

export function on(cb) { listeners.add(cb); return () => listeners.delete(cb); }
export function emit(what = 'all') { for (const cb of listeners) cb(what); }

export function snapshot() {
  return JSON.stringify(S.project);
}

let pending = null;
export function commit(label = '', { merge = false } = {}) {
  // salva lo stato precedente per annulla; "merge" unisce modifiche continue (es. trascinamenti)
  const snap = S._before || snapshot();
  S._before = null;
  if (merge && pending === label && S.past.length) { /* stessa operazione continua: non duplicare */ } else {
    S.past.push(snap);
    if (S.past.length > 120) S.past.shift();
  }
  pending = merge ? label : null;
  S.future = [];
  S.dirty = true;
  emit('project');
}

export function beginChange() {
  if (!S._before) S._before = snapshot();
}

export function undo() {
  if (!S.past.length) return;
  S.future.push(snapshot());
  S.project = JSON.parse(S.past.pop());
  pending = null;
  if (S.selected && !S.project.clips.find(c => c.id === S.selected)) S.selected = null;
  S.dirty = true;
  emit('project');
}

export function redo() {
  if (!S.future.length) return;
  S.past.push(snapshot());
  S.project = JSON.parse(S.future.pop());
  pending = null;
  S.dirty = true;
  emit('project');
}

export function loadProject(p, filePath = null) {
  S.project = { ...newProject(), ...p };
  S.project.clips = (S.project.clips || []).map(c => ({ ...baseClip(c.type), ...c, adjust: { ...DEFAULT_ADJUST, ...(c.adjust || {}) } }));
  S.filePath = filePath;
  S.past = [];
  S.future = [];
  S.selected = null;
  S.time = 0;
  S.dirty = false;
  emit('load');
}

// ------------------------------------------------------------------ utilità
export const clip = id => S.project.clips.find(c => c.id === id);
export const selectedClip = () => (S.selected ? clip(S.selected) : null);
export const track = id => S.project.tracks.find(t => t.id === id);
export const end = c => c.start + c.duration;

export function duration() {
  const last = S.project.clips.reduce((m, c) => Math.max(m, end(c)), 0);
  return Math.max(last, S.project.clips.length ? 0.5 : S.project.designDuration || 6);
}

export function clipsAt(t) {
  return S.project.clips.filter(c => t >= c.start && t < end(c) - 1e-6);
}

export function select(id) {
  S.selected = id;
  emit('select');
}

export function setTime(t) {
  S.time = Math.max(0, Math.min(t, duration()));
  emit('time');
}

export function visualTracks() { return S.project.tracks.filter(t => t.kind === 'visual'); }
export function audioTracks() { return S.project.tracks.filter(t => t.kind === 'audio'); }

export function ensureTrack(kind, preferId) {
  if (preferId && track(preferId)) return preferId;
  const t = S.project.tracks.find(x => x.kind === kind);
  if (t) return t.id;
  const nt = { id: nid('t'), kind, name: kind === 'audio' ? 'Audio' : 'Livello' };
  S.project.tracks.push(nt);
  return nt.id;
}

// Trova una traccia libera nell'intervallo [start, start+dur) o ne crea una nuova
export function freeTrack(kind, start, dur, prefer, fromBottom = false) {
  const tracks = kind === 'visual' ? (fromBottom ? visualTracks() : visualTracks().slice().reverse()) : audioTracks();
  const order = prefer ? [track(prefer), ...tracks.filter(t => t.id !== prefer)].filter(Boolean) : tracks;
  for (const t of order) {
    const busy = S.project.clips.some(c => c.trackId === t.id && c.start < start + dur - 1e-6 && end(c) > start + 1e-6);
    if (!busy) return t.id;
  }
  const nt = { id: nid('t'), kind, name: kind === 'audio' ? `Audio ${audioTracks().length + 1}` : `Livello ${visualTracks().length + 1}` };
  if (kind === 'visual') {
    const lastVisual = S.project.tracks.map(t => t.kind).lastIndexOf('visual');
    S.project.tracks.splice(lastVisual + 1, 0, nt);
  } else S.project.tracks.push(nt);
  return nt.id;
}

export function addClip(c, { select: sel = true } = {}) {
  beginChange();
  const kind = c.type === 'audio' ? 'audio' : 'visual';
  if (!c.trackId || !track(c.trackId)) c.trackId = freeTrack(kind, c.start, c.duration, undefined, ['video', 'image'].includes(c.type));
  S.project.clips.push(c);
  if (sel) S.selected = c.id;
  commit('add');
  return c;
}

export function removeClip(id) {
  beginChange();
  S.project.clips = S.project.clips.filter(c => c.id !== id);
  if (S.selected === id) S.selected = null;
  commit('remove');
}

export function updateClip(id, patch, { merge = false, label = 'edit' } = {}) {
  const c = clip(id);
  if (!c) return;
  beginChange();
  deepAssign(c, patch);
  commit(label + ':' + id, { merge });
}

export function deepAssign(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) deepAssign(target[k], v);
    else target[k] = v;
  }
  return target;
}

export function splitAt(id, t) {
  const c = clip(id);
  if (!c || t <= c.start + 0.05 || t >= end(c) - 0.05) return null;
  beginChange();
  const left = t - c.start;
  const b = JSON.parse(JSON.stringify(c));
  b.id = nid();
  b.start = t;
  b.duration = c.duration - left;
  b.in = (c.in || 0) + left * (c.speed || 1);
  b.animIn = { type: 'none', duration: 0.5 };
  b.transition = { type: 'none', duration: 0.6 };
  c.duration = left;
  c.animOut = { type: 'none', duration: 0.5 };
  S.project.clips.push(b);
  S.selected = b.id;
  commit('split');
  return b;
}

export function duplicate(id) {
  const c = clip(id);
  if (!c) return null;
  const b = JSON.parse(JSON.stringify(c));
  b.id = nid();
  b.start = end(c);
  b.trackId = freeTrack(c.type === 'audio' ? 'audio' : 'visual', b.start, b.duration, c.trackId);
  return addClip(b);
}

export function fmtTime(t, withFrames = true) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const f = Math.floor((t % 1) * (S.project.fps || 30));
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${withFrames ? `.${String(f).padStart(2, '0')}` : ''}`;
}
