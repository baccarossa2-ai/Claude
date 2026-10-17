// Timeline multitraccia di Salto Studio: clip trascinabili tra le tracce, taglio dei bordi,
// aggancio magnetico, transizioni tra clip, miniature dei video e forme d'onda dell'audio.
import { S, emit, on as onState, select, selectedClip, clip, track, end, duration, beginChange, commit, setTime, splitAt, duplicate, removeClip, freeTrack, nid, fmtTime, visualTracks, audioTracks } from './state.js';
import { peaks } from './audio.js';
import { icon, popMenu, toast, promptDialog } from '../lib/ui.js';
import { esc } from '../lib/format.js';

const COLORS = { video: '#4F46E5', image: '#0284C7', text: '#DB2777', shape: '#EA580C', sticker: '#CA8A04', icon: '#D97706', color: '#7C3AED', audio: '#059669' };
const TYPE_ICON = { video: 'film', image: 'image', text: 'type', shape: 'shapes', sticker: 'smile', icon: 'star', color: 'square', audio: 'music' };
const TRACK_H = 54;
const RULER_H = 28;

let root, scroll, lanes, heads, rulerCv, playhead;
let magnet = true;
let clipboard = null;
let openTransition = () => {};
let recordVoice = () => {};
const thumbCache = new Map();

export function mountTimeline(container, hooks = {}) {
  openTransition = hooks.openTransition || openTransition;
  recordVoice = hooks.recordVoice || recordVoice;
  root = container;
  root.innerHTML = `
    <div class="st-tl-bar">
      <button class="st-ibtn" data-act="start" data-tip="Inizio (Home)">${icon('skip-back', 17)}</button>
      <button class="st-bigplay" data-act="play" id="playBtn" data-tip="Riproduci (Spazio)">${icon('play', 18)}</button>
      <button class="st-ibtn" data-act="end" data-tip="Fine (End)">${icon('skip-forward', 17)}</button>
      <div class="st-time" id="tlTime"></div>
      <span style="width:1px;height:22px;background:var(--st-line)"></span>
      <button class="st-ibtn" data-act="split" data-tip="Dividi al cursore (S)">${icon('scissors', 17)}</button>
      <button class="st-ibtn" data-act="dup" data-tip="Duplica (Ctrl+D)">${icon('copy-plus', 17)}</button>
      <button class="st-ibtn" data-act="del" data-tip="Elimina (Canc)">${icon('trash-2', 17)}</button>
      <button class="st-ibtn" data-act="extract" data-tip="Estrai l'audio dal video">${icon('audio-lines', 17)}</button>
      <span style="width:1px;height:22px;background:var(--st-line)"></span>
      <button class="st-ibtn" data-act="voice" data-tip="Registra voce fuori campo">${icon('mic', 17)}</button>
      <button class="st-ibtn" data-act="addtrack" data-tip="Nuova traccia">${icon('layers', 17)}</button>
      <button class="st-ibtn ${magnet ? 'on' : ''}" data-act="magnet" data-tip="Aggancio magnetico">${icon('magnet', 17)}</button>
      <div style="flex:1"></div>
      ${icon('zoom-out', 15)}<input type="range" class="st-zoom" id="tlZoom" min="10" max="400" value="${S.zoom}">${icon('zoom-in', 15)}
      <button class="st-ibtn" data-act="fit" data-tip="Adatta la timeline">${icon('maximize', 16)}</button>
    </div>
    <div class="st-tl-body">
      <div class="st-heads"><div class="st-heads-inner" id="tlHeads"></div></div>
      <div class="st-scroll" id="tlScroll"><div class="st-lane-wrap" id="tlLanes"></div></div>
    </div>`;
  scroll = root.querySelector('#tlScroll');
  lanes = root.querySelector('#tlLanes');
  heads = root.querySelector('#tlHeads');
  scroll.addEventListener('scroll', () => { heads.parentElement.scrollTop = scroll.scrollTop; drawRuler(); });
  scroll.addEventListener('wheel', e => {
    if (e.ctrlKey) { e.preventDefault(); zoomTo(S.zoom * (e.deltaY < 0 ? 1.15 : 0.87), e); } else if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.target.closest('.st-ruler')) { e.preventDefault(); scroll.scrollLeft += e.deltaY; }
  }, { passive: false });
  root.querySelector('#tlZoom').addEventListener('input', e => zoomTo(Number(e.target.value)));
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b) action(b.dataset.act);
  });
  onState(what => {
    if (what === 'time') { updatePlayhead(); return; }
    if (what === 'live') return;
    if (what === 'play') { updatePlayButton(); return; }
    render();
  });
  render();
}

function zoomTo(z, e) {
  const old = S.zoom;
  S.zoom = Math.max(10, Math.min(400, z));
  const anchor = e ? (e.clientX - scroll.getBoundingClientRect().left + scroll.scrollLeft) / old : S.time;
  render();
  scroll.scrollLeft = anchor * S.zoom - (e ? e.clientX - scroll.getBoundingClientRect().left : scroll.clientWidth / 2);
  root.querySelector('#tlZoom').value = S.zoom;
}

export function action(a) {
  const c = selectedClip();
  switch (a) {
    case 'play': emit('toggle-play'); break;
    case 'start': setTime(0); break;
    case 'end': setTime(duration()); break;
    case 'split': {
      const target = c && S.time > c.start && S.time < end(c) ? c : S.project.clips.find(x => S.time > x.start + 0.05 && S.time < end(x) - 0.05 && (!c || x.trackId === c.trackId));
      if (!target) { toast('Posiziona il cursore sopra una clip per dividerla', { type: 'info' }); return; }
      splitAt(target.id, S.time);
      break;
    }
    case 'dup': if (c) duplicate(c.id); break;
    case 'del': if (c) removeClip(c.id); break;
    case 'extract': {
      if (!c || c.type !== 'video') { toast('Seleziona una clip video', { type: 'info' }); return; }
      beginChange();
      const a2 = { ...JSON.parse(JSON.stringify(c)), id: nid(), type: 'audio', name: `Audio · ${c.name || 'video'}`, trackId: freeTrack('audio', c.start, c.duration) };
      S.project.clips.push(a2);
      c.muted = true;
      commit('extract');
      toast('Audio estratto su una traccia separata');
      break;
    }
    case 'voice': recordVoice(); break;
    case 'addtrack': {
      popMenu(root.querySelector('[data-act=addtrack]'), [
        { label: 'Traccia video / livello', icon: 'layers', fn: () => { beginChange(); const lastV = S.project.tracks.map(t => t.kind).lastIndexOf('visual'); S.project.tracks.splice(lastV + 1, 0, { id: nid('t'), kind: 'visual', name: `Livello ${visualTracks().length + 1}` }); commit('track'); } },
        { label: 'Traccia audio', icon: 'music', fn: () => { beginChange(); S.project.tracks.push({ id: nid('t'), kind: 'audio', name: `Audio ${audioTracks().length + 1}` }); commit('track'); } },
      ], { align: 'left' });
      break;
    }
    case 'magnet': magnet = !magnet; root.querySelector('[data-act=magnet]').classList.toggle('on', magnet); break;
    case 'fit': zoomTo((scroll.clientWidth - 60) / Math.max(1, duration())); scroll.scrollLeft = 0; break;
    default: break;
  }
}

export function copySelected() { const c = selectedClip(); if (c) { clipboard = JSON.parse(JSON.stringify(c)); toast('Clip copiata'); } }
export function paste() {
  if (!clipboard) return;
  beginChange();
  const c = { ...JSON.parse(JSON.stringify(clipboard)), id: nid(), start: S.time };
  c.trackId = freeTrack(c.type === 'audio' ? 'audio' : 'visual', c.start, c.duration, c.trackId);
  S.project.clips.push(c);
  S.selected = c.id;
  commit('paste');
}

function updatePlayButton() {
  const b = root.querySelector('#playBtn');
  if (b) b.innerHTML = icon(S.playing ? 'pause' : 'play', 18);
}

function orderedTracks() {
  return [...visualTracks().slice().reverse(), ...audioTracks()];
}

// ------------------------------------------------------------------ disegno
export function render() {
  if (!lanes) return;
  const dur = duration();
  const width = Math.max(scroll.clientWidth, (dur + 8) * S.zoom);
  const tracks = orderedTracks();
  heads.innerHTML = tracks.map(t => `<div class="st-thead" style="--th:${TRACK_H}px" data-track="${t.id}">
      <span class="ico-k">${icon(t.kind === 'audio' ? 'music' : 'layers', 14)}</span>
      <span class="grow" title="${esc(t.name)}">${esc(t.name)}</span>
      ${t.kind === 'visual' ? `<button data-hide="${t.id}" class="${t.hidden ? 'off' : ''}" title="Mostra/nascondi">${icon(t.hidden ? 'eye-off' : 'eye', 14)}</button>` : `<button data-mute="${t.id}" class="${t.muted ? 'off' : ''}" title="Audio on/off">${icon(t.muted ? 'volume-x' : 'volume-2', 14)}</button>`}
      <button data-tmenu="${t.id}">${icon('ellipsis-vertical', 14)}</button></div>`).join('');
  lanes.style.width = width + 'px';
  lanes.innerHTML = `<div class="st-ruler" id="tlRuler"><canvas id="rulerCv"></canvas></div>`
    + tracks.map(t => `<div class="st-lane ${t.kind}" style="--th:${TRACK_H}px" data-lane="${t.id}" data-kind="${t.kind}">${laneClips(t)}</div>`).join('')
    + `<div class="st-playhead" id="tlPlayhead"></div>`
    + (S.project.clips.length ? '' : `<div class="st-tl-empty">Trascina qui foto, video e musica oppure scegli un modello a sinistra ✨</div>`);
  rulerCv = lanes.querySelector('#rulerCv');
  playhead = lanes.querySelector('#tlPlayhead');
  drawRuler();
  updatePlayhead();
  updatePlayButton();
  bindLaneEvents();
  hydrateVisuals();
}

function laneClips(t) {
  const list = S.project.clips.filter(c => c.trackId === t.id).sort((a, b) => a.start - b.start);
  return list.map((c, i) => {
    const prev = list[i - 1];
    const adj = prev && Math.abs(end(prev) - c.start) < 0.08 && t.kind === 'visual';
    const fx = [c.filter !== 'none' && 'FX', c.effect && c.effect !== 'none' && '✦', c.speed && c.speed !== 1 && `${c.speed}×`, c.animIn?.type !== 'none' && '↗', c.voiceFx && c.voiceFx !== 'none' && '🎙', c.muted && '🔇'].filter(Boolean);
    const label = c.type === 'text' ? c.text : c.name || c.emoji || c.type;
    return `<div class="st-clip ${S.selected === c.id ? 'sel' : ''}" data-clip="${c.id}" style="left:${c.start * S.zoom}px;width:${Math.max(6, c.duration * S.zoom)}px;--cc:${COLORS[c.type] || '#7C4DFF'}">
        <div class="thumbs" data-thumbs="${c.id}"></div>
        ${c.type === 'audio' || (c.type === 'video' && !c.muted) ? `<canvas class="wave" data-wave="${c.id}"></canvas>` : ''}
        <span class="lbl">${icon(TYPE_ICON[c.type] || 'circle', 12)}${esc(String(label).slice(0, 60))}</span>
        ${fx.length ? `<span class="fx-badges">${fx.map(x => `<i>${esc(x)}</i>`).join('')}</span>` : ''}
        <span class="trim l" data-trim="l"></span><span class="trim r" data-trim="r"></span>
      </div>${adj ? `<button class="st-trans ${c.transition?.type !== 'none' ? 'has' : ''}" style="left:${c.start * S.zoom}px" data-trans="${c.id}" title="Transizione">${icon(c.transition?.type !== 'none' ? 'blend' : 'plus', 13)}</button>` : ''}`;
  }).join('');
}

function drawRuler() {
  if (!rulerCv) return;
  const w = scroll.clientWidth;
  const dpr = window.devicePixelRatio || 1;
  rulerCv.width = w * dpr;
  rulerCv.height = RULER_H * dpr;
  rulerCv.style.width = w + 'px';
  rulerCv.style.height = RULER_H + 'px';
  rulerCv.style.transform = `translateX(${scroll.scrollLeft}px)`;
  const c = rulerCv.getContext('2d');
  c.scale(dpr, dpr);
  c.fillStyle = '#8E88B4';
  c.strokeStyle = '#3a3462';
  c.font = '10px JetBrains Mono, monospace';
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
  const major = steps.find(s => s * S.zoom >= 70) || 60;
  const minor = major / 5;
  const t0 = scroll.scrollLeft / S.zoom;
  const t1 = (scroll.scrollLeft + w) / S.zoom;
  for (let t = Math.floor(t0 / minor) * minor; t <= t1; t += minor) {
    const x = (t - t0) * S.zoom;
    const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
    c.beginPath();
    c.moveTo(x + 0.5, isMajor ? 10 : 19);
    c.lineTo(x + 0.5, RULER_H);
    c.stroke();
    if (isMajor) c.fillText(major < 1 ? `${t.toFixed(1)}s` : fmtTime(t, false), x + 4, 11);
  }
}

function updatePlayhead() {
  if (!playhead) return;
  const x = S.time * S.zoom;
  playhead.style.left = x + 'px';
  const tt = root.querySelector('#tlTime');
  if (tt) tt.innerHTML = `${fmtTime(S.time)} <small>/ ${fmtTime(duration())}</small>`;
  if (S.playing) {
    if (x > scroll.scrollLeft + scroll.clientWidth - 60) scroll.scrollLeft = x - 80;
    else if (x < scroll.scrollLeft) scroll.scrollLeft = Math.max(0, x - 80);
  }
}

// ------------------------------------------------------------------ miniature e onde
async function hydrateVisuals() {
  for (const el of lanes.querySelectorAll('[data-thumbs]')) {
    const c = clip(el.dataset.thumbs);
    if (!c) continue;
    const w = c.duration * S.zoom;
    const hgt = TRACK_H - 10;
    if (c.type === 'image') {
      const n = Math.max(1, Math.ceil(w / (hgt * 1.4)));
      el.innerHTML = Array.from({ length: Math.min(n, 40) }, () => `<img src="${c.src}" style="width:${hgt * 1.4}px">`).join('');
    } else if (c.type === 'video') {
      const frames = await videoThumbs(c.src);
      if (!frames.length) continue;
      const tw = hgt * 16 / 9;
      const n = Math.max(1, Math.min(60, Math.ceil(w / tw)));
      el.innerHTML = Array.from({ length: n }, (_, i) => {
        const tt = (c.in || 0) + (i / n) * c.duration * (c.speed || 1);
        const f = frames[Math.min(frames.length - 1, Math.floor(tt / frames.step))] || frames[frames.length - 1];
        return `<img src="${f}" style="width:${tw}px">`;
      }).join('');
    } else if (c.type === 'color') {
      el.style.background = c.colors && c.colors.length > 1 ? `linear-gradient(90deg, ${c.colors.join(',')})` : c.fill;
      el.style.opacity = 0.5;
    }
  }
  for (const cv of lanes.querySelectorAll('[data-wave]')) {
    const c = clip(cv.dataset.wave);
    if (!c) continue;
    const pk = await peaks(c.src, 600);
    if (!pk.peaks.length) continue;
    const w = Math.max(2, c.duration * S.zoom);
    const h = 30;
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,.75)';
    const per = pk.duration / pk.peaks.length;
    for (let x = 0; x < w; x += 2) {
      const tt = (c.in || 0) + (x / S.zoom) * (c.speed || 1);
      const v = pk.peaks[Math.floor(tt / per)] || 0;
      const vh = Math.max(1, v * h * (c.volume ?? 1));
      g.fillRect(x, h - vh, 1.4, vh);
    }
  }
}

function videoThumbs(src) {
  if (thumbCache.has(src)) return thumbCache.get(src);
  const p = new Promise(resolve => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.preload = 'auto';
    v.src = src;
    const out = [];
    v.onloadedmetadata = async () => {
      const dur = v.duration || 1;
      const n = Math.min(24, Math.max(4, Math.ceil(dur / 2)));
      out.step = dur / n;
      const cvs = document.createElement('canvas');
      cvs.height = 60;
      cvs.width = Math.round(60 * (v.videoWidth / Math.max(1, v.videoHeight)));
      const g = cvs.getContext('2d');
      for (let i = 0; i < n; i++) {
        await new Promise(r => { v.onseeked = r; v.currentTime = Math.min(dur - 0.05, i * out.step + 0.01); setTimeout(r, 1500); });
        g.drawImage(v, 0, 0, cvs.width, cvs.height);
        out.push(cvs.toDataURL('image/jpeg', 0.6));
      }
      v.removeAttribute('src');
      v.load();
      resolve(out);
    };
    v.onerror = () => resolve(out);
  });
  thumbCache.set(src, p);
  return p;
}

// ------------------------------------------------------------------ interazioni
function bindLaneEvents() {
  lanes.querySelector('#tlRuler').addEventListener('pointerdown', scrubStart);
  lanes.addEventListener('pointerdown', e => {
    if (e.target.closest('.st-clip') || e.target.closest('.st-trans') || e.target.closest('#tlRuler')) return;
    if (e.target.closest('.st-lane')) { select(null); scrubStart(e); }
  });
  for (const el of lanes.querySelectorAll('.st-clip')) el.addEventListener('pointerdown', clipDown);
  for (const el of lanes.querySelectorAll('.st-clip')) el.addEventListener('contextmenu', e => { e.preventDefault(); select(el.dataset.clip); clipMenu(e); });
  for (const b of lanes.querySelectorAll('[data-trans]')) b.addEventListener('click', () => { select(b.dataset.trans); openTransition(b.dataset.trans); });
  heads.querySelectorAll('[data-hide]').forEach(b => b.onclick = () => { const t = track(b.dataset.hide); beginChange(); t.hidden = !t.hidden; commit('track'); });
  heads.querySelectorAll('[data-mute]').forEach(b => b.onclick = () => { const t = track(b.dataset.mute); beginChange(); t.muted = !t.muted; commit('track'); });
  heads.querySelectorAll('[data-tmenu]').forEach(b => b.onclick = () => trackMenu(b, track(b.dataset.tmenu)));
}

function scrubStart(e) {
  const rect = lanes.getBoundingClientRect();
  const go = ev => setTime(Math.max(0, (ev.clientX - rect.left) / S.zoom));
  go(e);
  if (S.playing) emit('toggle-play');
  const move = ev => go(ev);
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function snapPoints(exceptId) {
  const pts = [0, S.time];
  for (const c of S.project.clips) if (c.id !== exceptId) pts.push(c.start, end(c));
  return pts;
}

function snap(t, pts, el) {
  if (!magnet) return t;
  const th = 8 / S.zoom;
  for (const p of pts) {
    if (Math.abs(t - p) < th) {
      showSnap(p, el);
      return p;
    }
  }
  return t;
}

function showSnap(t) {
  let s = lanes.querySelector('.st-snap');
  if (!s) { s = document.createElement('div'); s.className = 'st-snap'; lanes.appendChild(s); }
  s.style.left = t * S.zoom + 'px';
}
function hideSnap() { lanes.querySelectorAll('.st-snap').forEach(s => s.remove()); }

function clipDown(e) {
  if (e.button !== 0) return;
  const el = e.currentTarget;
  const c = clip(el.dataset.clip);
  if (!c) return;
  select(c.id);
  lanes.querySelectorAll('.st-clip.sel').forEach(x => x.classList.toggle('sel', x === el));
  const trim = e.target.dataset.trim;
  const startX = e.clientX;
  const s0 = { start: c.start, duration: c.duration, in: c.in || 0, trackId: c.trackId };
  const pts = snapPoints(c.id);
  let moved = false;
  let mediaDur = Infinity;
  if (c.type === 'video' || c.type === 'audio') {
    const probe = document.createElement(c.type === 'video' ? 'video' : 'audio');
    probe.preload = 'metadata';
    probe.src = c.src;
    probe.onloadedmetadata = () => { mediaDur = probe.duration || Infinity; };
  }
  try { el.setPointerCapture(e.pointerId); } catch { /* puntatore non più attivo */ }
  const move = ev => {
    const dx = (ev.clientX - startX) / S.zoom;
    if (!moved && Math.abs(ev.clientX - startX) < 3 && !trim) return;
    if (!moved) { beginChange(); moved = true; }
    hideSnap();
    if (trim === 'l') {
      let ns = snap(s0.start + dx, pts);
      ns = Math.max(0, Math.min(ns, s0.start + s0.duration - 0.1));
      let d = ns - s0.start;
      if ((c.type === 'video' || c.type === 'audio') && s0.in + d * (c.speed || 1) < 0) d = -s0.in / (c.speed || 1);
      c.start = s0.start + d;
      c.duration = s0.duration - d;
      if (c.type === 'video' || c.type === 'audio') c.in = s0.in + d * (c.speed || 1);
    } else if (trim === 'r') {
      let ne = snap(s0.start + s0.duration + dx, pts);
      let nd = Math.max(0.1, ne - s0.start);
      if ((c.type === 'video' || c.type === 'audio') && Number.isFinite(mediaDur)) nd = Math.min(nd, (mediaDur - (c.in || 0)) / (c.speed || 1));
      c.duration = nd;
    } else {
      let ns = Math.max(0, s0.start + dx);
      const sEnd = snap(ns + c.duration, pts);
      const sStart = snap(ns, pts);
      if (sStart !== ns) ns = sStart; else if (sEnd !== ns + c.duration) ns = sEnd - c.duration;
      c.start = Math.max(0, ns);
      // cambio traccia
      const laneEl = document.elementsFromPoint(ev.clientX, ev.clientY).find(x => x.dataset && x.dataset.lane);
      const kind = c.type === 'audio' ? 'audio' : 'visual';
      if (laneEl && laneEl.dataset.kind === kind && laneEl.dataset.lane !== c.trackId) {
        c.trackId = laneEl.dataset.lane;
        laneEl.appendChild(el);
      }
    }
    el.style.left = c.start * S.zoom + 'px';
    el.style.width = Math.max(6, c.duration * S.zoom) + 'px';
    emit('live');
  };
  const up = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    hideSnap();
    if (!moved) return;
    // evita sovrapposizioni sulla stessa traccia
    const overlap = S.project.clips.some(o => o.id !== c.id && o.trackId === c.trackId && o.start < end(c) - 1e-3 && end(o) > c.start + 1e-3);
    if (overlap) c.trackId = freeTrack(c.type === 'audio' ? 'audio' : 'visual', c.start, c.duration, s0.trackId === c.trackId ? undefined : s0.trackId);
    commit('timeline');
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
}

function clipMenu(e) {
  const c = selectedClip();
  if (!c) return;
  const anchor = { getBoundingClientRect: () => ({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }) };
  popMenu(anchor, [
    { label: 'Dividi al cursore', icon: 'scissors', hint: 'S', fn: () => action('split') },
    { label: 'Duplica', icon: 'copy-plus', hint: 'Ctrl D', fn: () => action('dup') },
    { label: 'Copia', icon: 'copy', hint: 'Ctrl C', fn: copySelected },
    { label: 'Incolla al cursore', icon: 'clipboard-paste', hint: 'Ctrl V', disabled: !clipboard, fn: paste },
    c.type === 'video' ? { label: 'Estrai audio', icon: 'audio-lines', fn: () => action('extract') } : null,
    { label: 'Porta il cursore all\'inizio della clip', icon: 'skip-back', fn: () => setTime(c.start) },
    { label: c.locked ? 'Sblocca' : 'Blocca posizione', icon: c.locked ? 'lock-open' : 'lock', fn: () => { beginChange(); c.locked = !c.locked; commit('lock'); } },
    '-',
    { label: 'Elimina', icon: 'trash-2', danger: true, hint: 'Canc', fn: () => removeClip(c.id) },
  ].filter(Boolean), { align: 'left' });
}

function trackMenu(anchor, t) {
  const empty = !S.project.clips.some(c => c.trackId === t.id);
  popMenu(anchor, [
    { label: 'Rinomina', icon: 'pencil', fn: async () => { const n = await promptDialog({ title: 'Rinomina traccia', label: 'Nome della traccia', value: t.name }); if (n) { beginChange(); t.name = n; commit('track'); } } },
    t.kind === 'visual' ? { label: 'Sposta più in alto (sopra)', icon: 'arrow-up', fn: () => moveTrack(t, 1) } : null,
    t.kind === 'visual' ? { label: 'Sposta più in basso (sotto)', icon: 'arrow-down', fn: () => moveTrack(t, -1) } : null,
    { label: empty ? 'Elimina traccia' : 'Elimina traccia e clip', icon: 'trash-2', danger: true, fn: () => { beginChange(); S.project.clips = S.project.clips.filter(c => c.trackId !== t.id); S.project.tracks = S.project.tracks.filter(x => x.id !== t.id); commit('track'); } },
  ].filter(Boolean), { align: 'left' });
}

function moveTrack(t, dir) {
  const arr = S.project.tracks;
  const i = arr.indexOf(t);
  let j = i + dir;
  while (arr[j] && arr[j].kind !== 'visual') j += dir;
  if (!arr[j]) return;
  beginChange();
  arr.splice(i, 1);
  arr.splice(j, 0, t);
  commit('track');
}
