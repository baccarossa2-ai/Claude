// Salto Studio — avvio dell'editor, schermata iniziale, riproduzione, scorciatoie,
// salvataggio dei progetti, registrazione della voce e importazione per trascinamento.
import { S, on as onState, emit, newProject, loadProject, FORMATS, duration, setTime, undo, redo, selectedClip, removeClip, duplicate, splitAt, updateClip, addClip, baseClip, textClip, freeTrack, end, fmtTime, beginChange, commit } from './state.js';
import { renderFrame, syncMedia, pauseAll, settle, loadImage, dropUnusedElements } from './engine.js';
import { resume, updateMix, startRecording, stopRecording, micLevel } from './audio.js';
import { mountStage, draw, layout, isEditingText, startTextEdit } from './stage.js';
import { mountTimeline, action as tlAction, copySelected, paste } from './timeline.js';
import { mountPanels, importFiles, saveBlobToProject, show as showPanel } from './panels.js';
import { mountInspector } from './inspector.js';
import { openExport } from './export.js';
import { TEMPLATES, brandFrom, buildTemplate } from './templates.js';
import { icon, el, $, $$, toast, modal, confirmDialog, on, ripple } from '../lib/ui.js';
import { esc, relTime } from '../lib/format.js';

let appData = { company: {}, disciplines: [] };
let lastFrame = 0;
let playStartWall = 0;
let playStartTime = 0;
let loop = false;
let recording = null;

// ------------------------------------------------------------------ layout
const phone = () => matchMedia('(max-width: 760px)').matches;

// Telefono: strumenti e proprietà si aprono come fogli dal basso sopra la timeline
function phoneSheets() {
  const panel = $('#panel');
  const insp = $('#insp');
  let lastTab = null;
  const open = node => {
    for (const n of [panel, insp]) n.classList.toggle('m-sheet-open', n === node);
  };
  $('#rail').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b || !phone()) return;
    const again = panel.classList.contains('m-sheet-open') && lastTab === b.dataset.tab;
    lastTab = b.dataset.tab;
    open(again ? null : panel);
  });
  $('#sheetX').onclick = () => open(null);
  onState(what => {
    if (what !== 'select' || !phone()) return;
    if (S.selected) open(insp);
    else if (insp.classList.contains('m-sheet-open')) open(null);
  });
}

function buildUI() {
  const root = $('#studio');
  root.innerHTML = `<div class="studio" id="st">
    <header class="st-top">
      <div class="st-brand"><img src="assets/studio-logo.svg" alt=""><span>Salto Studio</span></div>
      <button class="st-ibtn" id="homeBtn" data-tip="Home" data-tip-pos="bottom">${icon('house', 17)}</button>
      <input class="st-name" id="pname" value="">
      <button class="st-chip" id="fmtChip"></button>
      <button class="st-ibtn" id="undoBtn" data-tip="Annulla (Ctrl+Z)" data-tip-pos="bottom">${icon('undo-2', 17)}</button>
      <button class="st-ibtn" id="redoBtn" data-tip="Ripeti (Ctrl+Y)" data-tip-pos="bottom">${icon('redo-2', 17)}</button>
      <div class="st-spacer"></div>
      <span class="st-save-state" id="saveState"></span>
      <button class="st-ibtn" id="openBtn" data-tip="Apri progetto" data-tip-pos="bottom">${icon('folder-open', 17)}</button>
      <button class="st-ibtn" id="saveBtn" data-tip="Salva (Ctrl+S)" data-tip-pos="bottom">${icon('save', 17)}</button>
      <button class="btn sm" id="athlosBtn">${icon('layout-dashboard', 15)}Athlos</button>
      <button class="btn primary sm" id="exportBtn">${icon('download', 15)}Esporta</button>
    </header>
    <div class="st-mid">
      <nav class="st-rail" id="rail"></nav>
      <aside class="st-panel" id="panel"></aside>
      <section class="st-stage-wrap" id="stageWrap"></section>
      <aside class="st-insp" id="insp"></aside>
      <button class="st-sheet-close" id="sheetX" aria-label="Chiudi">${icon('chevron-down', 22)}</button>
    </div>
    <div class="st-resizer" id="resizer"></div>
    <div class="st-tl" id="tl"></div>
  </div>`;

  mountStage($('#stageWrap'));
  mountTimeline($('#tl'), { openTransition: () => showPanel('transizioni'), recordVoice });
  mountPanels($('#rail'), $('#panel'), appData, { recordVoice, thumb: renderThumb, afterTemplate: () => { setTime(0); layout(); } });
  mountInspector($('#insp'));
  phoneSheets();

  $('#pname').addEventListener('input', e => { S.project.name = e.target.value; S.dirty = true; updateTitle(); });
  $('#undoBtn').onclick = undo;
  $('#redoBtn').onclick = redo;
  $('#saveBtn').onclick = () => saveProject();
  $('#openBtn').onclick = openProjectDialog;
  $('#homeBtn').onclick = () => showHome();
  $('#exportBtn').onclick = () => openExport({ getPreviewCanvas: () => null, stopPlayback: stop });
  $('#athlosBtn').onclick = () => window.athlos.system.focusMain('/dashboard');
  $('#fmtChip').onclick = () => { emit('select'); S.selected = null; emit('select'); };

  // ridimensionamento timeline
  const rs = $('#resizer');
  rs.addEventListener('pointerdown', e => {
    try { rs.setPointerCapture(e.pointerId); } catch { /* ok */ }
    const st = $('#st');
    const startY = e.clientY;
    const h0 = $('#tl').offsetHeight;
    const move = ev => { st.style.setProperty('--tl-h', Math.max(160, Math.min(window.innerHeight * 0.65, h0 - (ev.clientY - startY))) + 'px'); layout(); };
    const up = () => { rs.removeEventListener('pointermove', move); rs.removeEventListener('pointerup', up); };
    rs.addEventListener('pointermove', move);
    rs.addEventListener('pointerup', up);
  });

  onState(what => {
    if (what === 'toggle-play') togglePlay();
    if (['project', 'load', 'name', 'format'].includes(what)) refreshChrome();
    if (what === 'preview-anim') previewSelection();
    if (what === 'project' || what === 'load') dropUnusedElements();
  });
  refreshChrome();
}

function refreshChrome() {
  const f = FORMATS.find(x => x.id === S.project.format) || { name: 'Personalizzato' };
  $('#fmtChip').innerHTML = `${icon('ratio', 14)}${esc(f.name)} · ${S.project.width}×${S.project.height}`;
  if (document.activeElement !== $('#pname')) $('#pname').value = S.project.name;
  $('#undoBtn').disabled = !S.past.length;
  $('#redoBtn').disabled = !S.future.length;
  updateTitle();
}

function updateTitle() {
  document.title = `${S.dirty ? '● ' : ''}${S.project.name} · Salto Studio`;
  const st = $('#saveState');
  if (st) st.innerHTML = S.filePath ? (S.dirty ? `${icon('circle-dot', 12)}Modifiche non salvate` : `${icon('check-check', 13)}Salvato`) : S.project.clips.length ? `${icon('circle-dot', 12)}Non ancora salvato` : '';
}

// ------------------------------------------------------------------ riproduzione
function togglePlay() { if (S.playing) stop(); else play(); }

async function play() {
  if (S.exporting) return;
  await resume();
  if (S.time >= duration() - 0.05) S.time = 0;
  S.playing = true;
  playStartWall = performance.now();
  playStartTime = S.time;
  emit('play');
}

function stop() {
  S.playing = false;
  pauseAll();
  emit('play');
}

let previewUntil = 0;
function previewSelection() {
  const c = selectedClip();
  if (!c || S.playing) return;
  setTime(c.start);
  previewUntil = Math.min(end(c), c.start + Math.max(c.animIn?.duration || 0.6, 0.6) + 0.2);
  play();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (S.exporting) return;
  if (S.playing) {
    let t = playStartTime + (now - playStartWall) / 1000;
    const d = duration();
    if (previewUntil && t >= previewUntil) { previewUntil = 0; stop(); t = Math.min(t, d); }
    if (t >= d) {
      if (loop) { playStartWall = now; playStartTime = 0; t = 0; } else { t = d; stop(); }
    }
    S.time = t;
    syncMedia(t, S.playing);
    updateMix(t);
    emit('time');
    draw();
    return;
  }
  // a riposo: ridisegna a ~30 fps per mostrare i fotogrammi dei video appena posizionati
  if (now - lastFrame > 33) {
    lastFrame = now;
    syncMedia(S.time, false);
    draw();
  }
}

// ------------------------------------------------------------------ tastiera
function keys(e) {
  if (e.target.matches('input, textarea, select') || isEditingText()) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); }
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  const c = selectedClip();
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); togglePlay(); return; }
  if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((mod && k === 'y') || (mod && e.shiftKey && k === 'z')) { e.preventDefault(); redo(); return; }
  if (mod && k === 's') { e.preventDefault(); saveProject(); return; }
  if (mod && k === 'o') { e.preventDefault(); openProjectDialog(); return; }
  if (mod && k === 'e') { e.preventDefault(); $('#exportBtn').click(); return; }
  if (mod && k === 'd') { e.preventDefault(); if (c) duplicate(c.id); return; }
  if (mod && k === 'c') { copySelected(); return; }
  if (mod && k === 'v') { paste(); return; }
  if (k === 'delete' || k === 'backspace') { if (c) { e.preventDefault(); removeClip(c.id); } return; }
  if (k === 's' && !mod) { tlAction('split'); return; }
  if (k === 'home') { setTime(0); return; }
  if (k === 'end') { setTime(duration()); return; }
  if (k === 'l' && !mod) { loop = !loop; toast(loop ? 'Riproduzione in ciclo attiva' : 'Ciclo disattivato', { type: 'info', duration: 1500 }); return; }
  if (k === 'escape') { S.selected = null; emit('select'); return; }
  if (k === 'enter' && c && c.type === 'text') { e.preventDefault(); startTextEdit(c); return; }
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    if (c && c.type !== 'audio' && !c.locked) {
      const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0;
      const dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0;
      updateClip(c.id, { x: c.x + dx, y: c.y + dy }, { merge: true, label: 'nudge' });
    } else if (k === 'arrowleft' || k === 'arrowright') {
      setTime(S.time + (k === 'arrowleft' ? -1 : 1) / (S.project.fps || 30) * (e.shiftKey ? 10 : 1));
    }
  }
}

// ------------------------------------------------------------------ salvataggio
async function projectThumb() {
  const W = S.project.width;
  const H = S.project.height;
  const k = 360 / Math.max(W, H);
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * k);
  cv.height = Math.round(H * k);
  renderFrame(cv.getContext('2d'), Math.min(S.time || 1.5, duration() - 0.01), { scale: k });
  return cv.toDataURL('image/jpeg', 0.8);
}

async function saveProject() {
  try {
    const thumb = await projectThumb();
    const json = JSON.stringify({ ...S.project, savedAt: new Date().toISOString(), app: 'Salto Studio' });
    S.filePath = await window.athlos.studio.save({ filePath: S.filePath, name: S.project.name, json, thumb });
    S.dirty = false;
    updateTitle();
    toast('Progetto salvato in Documenti › Salto Studio');
  } catch (err) {
    toast('Salvataggio non riuscito: ' + err.message, { type: 'error' });
  }
}

async function openProjectFile(p) {
  try {
    const data = JSON.parse(await window.athlos.studio.load(p));
    await preloadImages(data);
    loadProject(data, p);
    hideHome();
    setTime(0);
    layout();
    toast(`Aperto “${data.name}”`);
  } catch (err) {
    toast('Impossibile aprire il progetto: ' + err.message, { type: 'error' });
  }
}

async function openProjectDialog() {
  const files = await window.athlos.file.open({ title: 'Apri progetto Salto Studio', filters: [{ name: 'Progetti Salto Studio', extensions: ['salto'] }] });
  if (files.length) openProjectFile(files[0].path);
}

async function preloadImages(p) {
  const srcs = new Set();
  for (const c of p.clips || []) if (c.type === 'image' && c.src) srcs.add(c.src);
  if (p.background && p.background.src) srcs.add(p.background.src);
  await Promise.all([...srcs].map(s => loadImage(s).catch(() => null)));
}

setInterval(() => { if (S.dirty && S.filePath && !S.playing && !S.exporting) saveProject().catch(() => {}); }, 90000);

// ------------------------------------------------------------------ voce fuori campo
async function recordVoice() {
  if (recording) { finishRecording(); return; }
  stop();
  const stageEl = $('#stage');
  let stream;
  try {
    stream = await startRecording();
  } catch (err) {
    toast('Microfono non disponibile: controlla che sia collegato e consentito in Windows', { type: 'error' });
    return;
  }
  // conto alla rovescia
  for (const n of ['3', '2', '1']) {
    const c = el(`<div class="st-count">${n}</div>`);
    stageEl.appendChild(c);
    await new Promise(r => setTimeout(r, 800));
    c.remove();
  }
  const bar = el(`<div class="st-rec"><i></i><span>REC</span><span id="recT">0:00</span><span id="lvl" style="display:inline-block;width:60px;height:6px;border-radius:4px;background:rgba(255,255,255,.3);overflow:hidden"><b style="display:block;height:100%;width:0;background:#fff"></b></span><button class="btn sm" id="recStop" style="height:28px">${icon('square', 13)}Ferma</button></div>`);
  stageEl.appendChild(bar);
  const stopLvl = micLevel(stream, v => { const b = bar.querySelector('#lvl b'); if (b) b.style.width = Math.min(100, v * 160) + '%'; });
  recording = { start: S.time, bar, stopLvl, t0: performance.now() };
  recording.timer = setInterval(() => { const s = (performance.now() - recording.t0) / 1000; const t = bar.querySelector('#recT'); if (t) t.textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }, 250);
  bar.querySelector('#recStop').onclick = finishRecording;
  // il video scorre (senza audio della voce in uscita per evitare l'eco)
  play();
}

async function finishRecording() {
  if (!recording) return;
  const r = recording;
  recording = null;
  clearInterval(r.timer);
  r.stopLvl();
  r.bar.remove();
  stop();
  const blob = await stopRecording();
  if (!blob || blob.size < 1000) { toast('Registrazione troppo breve', { type: 'warning' }); return; }
  const url = await saveBlobToProject(blob, `Voce ${new Date().toISOString().replace(/[:.]/g, '-')}.webm`);
  const dur = (performance.now() - r.t0) / 1000;
  const c = baseClip('audio', { src: url, name: '🎙️ Voce fuori campo', start: r.start, duration: Math.max(0.3, dur), x: 0, y: 0, w: 0, h: 0, volume: 1.2 });
  c.trackId = freeTrack('audio', c.start, c.duration, S.project.tracks.find(t => t.kind === 'audio' && /voce/i.test(t.name))?.id);
  addClip(c);
  toast('Voce fuori campo aggiunta: prova gli effetti voce nel pannello Audio');
}

// ------------------------------------------------------------------ schermata iniziale
async function showHome() {
  let home = $('#home');
  if (!home) { home = el('<div class="st-home" id="home"></div>'); document.body.appendChild(home); }
  const recent = await window.athlos.studio.recent().catch(() => []);
  home.innerHTML = `<div class="st-home-in">
    <div class="row between" style="align-items:flex-start;-webkit-app-region:drag;margin-right:130px">
      <div><div class="eyebrow">Salto Studio</div><h1 style="margin-top:6px">Crea qualcosa di <em>straordinario</em></h1>
      <p style="color:var(--st-muted);margin-top:8px;max-width:640px">Montaggio video come CapCut, grafiche come Canva: un unico studio per Reel, storie, post e locandine di ${esc(brandFrom(appData).name)}.</p></div>
      <div class="row" style="-webkit-app-region:no-drag">${S.project.clips.length ? `<button class="btn" id="backEdit">${icon('arrow-left', 15)}Torna al progetto</button>` : ''}<button class="btn" id="hOpen">${icon('folder-open', 15)}Apri…</button></div>
    </div>
    <div class="st-sec" style="margin-top:28px">Nuovo progetto</div>
    <div class="st-formats">${FORMATS.map(f => {
      const s = 60 / Math.max(f.w, f.h);
      return `<button class="st-format" data-new="${f.id}"><div class="shape" style="width:${f.w * s}px;height:${f.h * s}px"></div><b>${esc(f.name)}</b><small>${esc(f.sub)}</small></button>`;
    }).join('')}</div>
    ${recent.length ? `<div class="st-sec" style="margin-top:30px">Progetti recenti</div><div class="st-tpl-grid">${recent.map(p => `<div class="st-tpl" data-open="${esc(p.path)}">${p.thumb ? `<img src="${esc(p.thumb)}" style="width:100%;aspect-ratio:16/10;object-fit:cover;background:#000">` : '<div style="aspect-ratio:16/10;background:var(--st-panel-3)"></div>'}<div>${esc(p.name)}<small>${relTime(p.mtime)}</small></div></div>`).join('')}</div>` : ''}
    <div class="st-sec" style="margin-top:30px">Modelli pronti <span>${TEMPLATES.length}</span></div>
    <div class="st-tpl-grid">${TEMPLATES.map(t => `<div class="st-tpl" data-tpl="${t.id}"><canvas data-thumb="${t.id}"></canvas><div>${esc(t.name)}<small>${esc(FORMATS.find(f => f.id === t.format).name)} · ${esc(t.cat)}</small></div></div>`).join('')}</div>
  </div>`;
  home.style.display = '';
  on(home, 'click', '[data-new]', (e, t) => { const p = newProject(FORMATS.find(f => f.id === t.dataset.new)); loadProject(p); hideHome(); layout(); });
  on(home, 'click', '[data-tpl]', async (e, t) => { const p = buildTemplate(TEMPLATES.find(x => x.id === t.dataset.tpl), brandFrom(appData)); await preloadImages(p); loadProject(p); hideHome(); setTime(0); layout(); play(); });
  on(home, 'click', '[data-open]', (e, t) => openProjectFile(t.dataset.open));
  if ($('#hOpen', home)) $('#hOpen', home).onclick = openProjectDialog;
  if ($('#backEdit', home)) $('#backEdit', home).onclick = hideHome;
  for (const cv of home.querySelectorAll('[data-thumb]')) renderThumb(cv, TEMPLATES.find(x => x.id === cv.dataset.thumb));
}

function hideHome() { const h = $('#home'); if (h) h.style.display = 'none'; }

// miniature dei modelli disegnate con il motore reale
const thumbQueue = [];
let thumbBusy = false;
function renderThumb(cv, t) {
  thumbQueue.push([cv, t]);
  if (!thumbBusy) pumpThumbs();
}
async function pumpThumbs() {
  thumbBusy = true;
  while (thumbQueue.length) {
    const [cv, t] = thumbQueue.shift();
    const p = buildTemplate(t, brandFrom(appData));
    await preloadImages(p);
    await document.fonts.ready;
    const k = 300 / Math.max(p.width, p.height);
    cv.width = Math.round(p.width * k);
    cv.height = Math.round(p.height * k);
    const keep = S.project;
    S.project = p;
    try { renderFrame(cv.getContext('2d'), Math.min(p.designDuration - 0.1, 2.2), { scale: k }); } finally { S.project = keep; }
    await new Promise(r => setTimeout(r, 0));
  }
  thumbBusy = false;
}

// ------------------------------------------------------------------ trascina file
function setupDrop() {
  let overlayEl = null;
  window.addEventListener('dragover', e => {
    e.preventDefault();
    if (!overlayEl) { overlayEl = el(`<div class="st-drop">${icon('upload', 28)} Rilascia qui video, foto e musica</div>`); ($('#stage') || document.body).appendChild(overlayEl); }
  });
  window.addEventListener('dragleave', e => { if (e.relatedTarget === null && overlayEl) { overlayEl.remove(); overlayEl = null; } });
  window.addEventListener('drop', async e => {
    e.preventDefault();
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    const files = [...e.dataTransfer.files].map(f => { const p = window.athlos.file.pathOf(f); return p ? { path: p, name: f.name, url: window.athlos.file.urlOf(p) } : null; }).filter(Boolean);
    const salto = files.find(f => f.name.endsWith('.salto'));
    if (salto) { openProjectFile(salto.path); return; }
    if (files.length) { hideHome(); await importFiles(files); toast(`${files.length} file importati`); }
  });
}

// ------------------------------------------------------------------ apertura da Athlos (Comunica)
async function openFromAthlos(payload) {
  if (!payload) return;
  if (payload.open) { openProjectFile(payload.open); return; }
  if (payload.template) {
    const t = TEMPLATES.find(x => x.id === payload.template);
    if (t) { const p = buildTemplate(t, brandFrom(appData)); await preloadImages(p); loadProject(p); hideHome(); setTime(0); layout(); play(); }
    return;
  }
  if (payload.newFormat) { loadProject(newProject(FORMATS.find(f => f.id === payload.newFormat) || FORMATS[0])); hideHome(); layout(); return; }
  if (!payload.text) return;
  const fmt = FORMATS.find(f => f.id === (payload.format || 'post'));
  const p = newProject(fmt);
  p.name = payload.title || 'Post social';
  p.background = { type: 'color', color: '#0B0A14' };
  const W = p.width;
  const H = p.height;
  const img = `athlos://app/assets/images/${payload.image || 'palestra'}.webp`;
  await loadImage(img).catch(() => {});
  p.clips.push(baseClip('image', { src: img, name: 'Foto', trackId: 'tv1', x: W / 2, y: H / 2, w: W, h: H, duration: 6, filter: 'athlos', loop: { type: 'kenburns' } }));
  p.clips.push(baseClip('color', { name: 'Velatura', trackId: 'tv2', x: W / 2, y: H * 0.68, w: W, h: H * 0.64, duration: 6, colors: ['rgba(11,10,20,0)', 'rgba(11,10,20,.92)'], angle: 180 }));
  const first = String(payload.text || '').split('\n').find(l => l.trim()) || p.name;
  p.clips.push(textClip({ text: first.replace(/[*_]/g, ''), trackId: 'tv3', x: W / 2, y: H * 0.62, w: W * 0.86, size: Math.round(W / 11), font: 'Montserrat', weight: 900, duration: 6, animIn: { type: 'word-pop', duration: 1 } }));
  const rest = String(payload.text || '').split('\n').slice(1).filter(l => l.trim()).slice(0, 4).join('\n');
  if (rest) p.clips.push(textClip({ text: rest.replace(/[*_]/g, ''), trackId: 'tv3', x: W / 2, y: H * 0.82, w: W * 0.86, size: Math.round(W / 28), font: 'Poppins', weight: 600, duration: 6, animIn: { type: 'fade', duration: 1 }, lineHeight: 1.3 }));
  loadProject(p);
  hideHome();
  setTime(0);
  layout();
  play();
  toast('Grafica creata dal messaggio di Comunica: personalizzala come vuoi');
}

// ------------------------------------------------------------------ avvio
async function boot() {
  document.documentElement.dataset.theme = 'dark';
  try { appData = await window.athlos.db.load(); } catch { /* senza dati società */ }
  appData.company = appData.company || {};
  appData.disciplines = appData.disciplines || [];
  window.athlos.system.setTheme('dark');
  buildUI();
  document.addEventListener('keydown', keys);
  document.addEventListener('pointerdown', ripple);
  setupDrop();
  requestAnimationFrame(frame);
  window.athlos.on('studio:open', openFromAthlos);
  window.athlos.on('db:changed', async () => { try { Object.assign(appData, await window.athlos.db.load()); } catch { /* ignora */ } });
  await document.fonts.ready;
  await showHome();
  const pending = await window.athlos.studio.pending().catch(() => null);
  if (pending) await openFromAthlos(pending);
  const sp = $('#splash');
  sp.classList.add('out');
  setTimeout(() => sp.remove(), 700);
  window.addEventListener('beforeunload', e => {
    if (!S.dirty || !S.project.clips.length || S._closing) return;
    e.returnValue = false;
    modal({
      title: 'Salvare il progetto?', icon: 'save', size: 'sm',
      body: `<p class="lead">Ci sono modifiche non salvate in “${esc(S.project.name)}”.</p>`,
      actions: [
        { label: 'Non salvare', kind: 'ghost', fn: () => { S._closing = true; window.close(); } },
        { label: 'Salva e chiudi', kind: 'primary', fn: async () => { await saveProject(); S._closing = true; window.close(); } },
      ],
    });
  });
  setInterval(updateTitle, 5000);
}

window.addEventListener('error', e => console.error(e.error || e.message));
boot();
