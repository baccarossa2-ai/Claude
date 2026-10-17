// Anteprima di Salto Studio: disegno del fotogramma corrente e modifica diretta sul canvas
// (seleziona, sposta, ridimensiona, ruota, guide magnetiche, testo modificabile in linea).
import { S, emit, on as onState, selectedClip, select, beginChange, commit, clipsAt, end } from './state.js';
import { renderFrame, hitTest, layoutText, clearLayout } from './engine.js';
import { icon } from '../lib/ui.js';

let cv, ctx, box, ov, stage;
let viewZoom = 1;
let showSafe = false;
let quality = 'auto';
let textEditing = null;

export function mountStage(container) {
  container.innerHTML = `
    <div class="st-stage" id="stage"><div class="st-canvas-box" id="cbox"><canvas id="cv"></canvas><div class="st-overlay" id="ov"></div></div></div>
    <div class="st-stage-bar">
      <button class="st-ibtn" id="zOut" data-tip="Riduci">${icon('zoom-out', 16)}</button>
      <span id="zLbl" style="min-width:46px;text-align:center">100%</span>
      <button class="st-ibtn" id="zIn" data-tip="Ingrandisci">${icon('zoom-in', 16)}</button>
      <button class="st-ibtn" id="zFit" data-tip="Adatta">${icon('maximize', 16)}</button>
      <span style="width:1px;height:18px;background:var(--st-line);margin:0 6px"></span>
      <button class="st-ibtn" id="safe" data-tip="Zone sicure social">${icon('square-dashed', 16)}</button>
      <select class="st-sel-in" id="qual" style="width:auto;height:28px"><option value="auto">Anteprima: automatica</option><option value="high">Anteprima: alta</option><option value="low">Anteprima: veloce</option></select>
    </div>`;
  stage = container.querySelector('#stage');
  box = container.querySelector('#cbox');
  cv = container.querySelector('#cv');
  ov = container.querySelector('#ov');
  ctx = cv.getContext('2d');
  container.querySelector('#zIn').onclick = () => { viewZoom = Math.min(3, viewZoom * 1.2); layout(); };
  container.querySelector('#zOut').onclick = () => { viewZoom = Math.max(0.2, viewZoom / 1.2); layout(); };
  container.querySelector('#zFit').onclick = () => { viewZoom = 1; layout(); };
  container.querySelector('#safe').onclick = e => { showSafe = !showSafe; e.currentTarget.classList.toggle('on', showSafe); overlay(); };
  container.querySelector('#qual').onchange = e => { quality = e.target.value; layout(); };
  new ResizeObserver(() => layout()).observe(stage);
  box.addEventListener('pointerdown', onPointerDown);
  box.addEventListener('dblclick', onDblClick);
  stage.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); viewZoom = Math.max(0.2, Math.min(3, viewZoom * (e.deltaY < 0 ? 1.1 : 0.9))); layout(); } }, { passive: false });
  stage.addEventListener('pointerdown', e => { if (e.target === stage) { select(null); } });
  onState(what => { if (what === 'load' || what === 'format') layout(); overlay(); });
  layout();
}

export function viewScale() { return box ? box.clientWidth / S.project.width : 1; }

export function layout() {
  if (!stage) return;
  const W = S.project.width;
  const H = S.project.height;
  const aw = stage.clientWidth - 48;
  const ah = stage.clientHeight - 40;
  const s = Math.max(0.05, Math.min(aw / W, ah / H)) * viewZoom;
  box.style.width = Math.round(W * s) + 'px';
  box.style.height = Math.round(H * s) + 'px';
  const dpr = window.devicePixelRatio || 1;
  const cap = quality === 'high' ? 2400 : quality === 'low' ? 640 : 1280;
  const k = Math.min(s * dpr, cap / Math.max(W, H));
  cv.width = Math.max(2, Math.round(W * k));
  cv.height = Math.max(2, Math.round(H * k));
  const lbl = document.getElementById('zLbl');
  if (lbl) lbl.textContent = Math.round(viewZoom * 100) + '%';
  draw();
  overlay();
}

export function draw() {
  if (!ctx) return;
  renderFrame(ctx, S.time, { scale: cv.width / S.project.width });
}

export function stageCanvas() { return cv; }

// ------------------------------------------------------------------ selezione
export function overlay() {
  if (!ov) return;
  const c = selectedClip();
  const vs = viewScale();
  let html = '';
  if (showSafe) {
    const W = S.project.width * vs;
    const H = S.project.height * vs;
    const vertical = S.project.height > S.project.width;
    html += `<div style="position:absolute;left:${W * 0.06}px;right:${W * (vertical ? 0.16 : 0.06)}px;top:${H * (vertical ? 0.12 : 0.06)}px;bottom:${H * (vertical ? 0.2 : 0.06)}px;border:1.5px dashed rgba(255,227,138,.8);border-radius:8px;pointer-events:none"><span style="position:absolute;left:6px;top:4px;font-size:10px;color:#FFE38A;font-weight:700">Zona sicura${vertical ? ' (interfaccia Reel/TikTok)' : ''}</span></div>`;
  }
  if (c && c.type !== 'audio' && S.time >= c.start && S.time < end(c) && !textEditing) {
    const isText = c.type === 'text';
    const handles = isText ? ['nw', 'ne', 'sw', 'se', 'e', 'w'] : ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
    html += `<div class="st-sel ${c.locked ? 'locked' : ''}" data-move style="left:${(c.x - c.w / 2) * vs}px;top:${(c.y - c.h / 2) * vs}px;width:${c.w * vs}px;height:${c.h * vs}px;transform:rotate(${c.rotation || 0}deg)">
      <span class="st-sel-tag">${labelOf(c)}${c.locked ? ' 🔒' : ''}</span>
      ${c.locked ? '' : handles.map(h => `<span class="st-h ${h}" data-h="${h}"></span>`).join('') + `<span class="st-h rot" data-h="rot"></span>`}
    </div>`;
  }
  ov.innerHTML = html;
}

function labelOf(c) {
  if (c.type === 'text') return 'Testo';
  if (c.type === 'video') return 'Video';
  if (c.type === 'image') return 'Immagine';
  if (c.type === 'shape') return 'Forma';
  if (c.type === 'sticker') return 'Adesivo';
  if (c.type === 'icon') return 'Icona';
  if (c.type === 'color') return 'Riquadro';
  return c.type;
}

function toProject(e) {
  const r = box.getBoundingClientRect();
  const vs = r.width / S.project.width;
  return { x: (e.clientX - r.left) / vs, y: (e.clientY - r.top) / vs, vs };
}

function onPointerDown(e) {
  if (textEditing) return;
  const hEl = e.target.closest('[data-h]');
  const p = toProject(e);
  let c = selectedClip();
  if (!hEl) {
    const hit = hitTest(p.x, p.y, S.time);
    if (!hit) { select(null); return; }
    if (!c || hit.id !== c.id) {
      // clic su un elemento sovrapposto alla selezione: mantieni la selezione se il clic cade dentro di essa
      const inside = c && e.target.closest('[data-move]');
      if (!inside) { select(hit.id); c = hit; }
    }
  }
  if (!c || c.locked) return;
  e.preventDefault();
  try { box.setPointerCapture(e.pointerId); } catch { /* puntatore non più attivo */ }
  const start = { ...p, x0: c.x, y0: c.y, w0: c.w, h0: c.h, r0: c.rotation || 0, size0: c.size };
  const mode = hEl ? hEl.dataset.h : 'move';
  let moved = false;
  const keepRatioDefault = ['image', 'video', 'sticker', 'icon'].includes(c.type);

  const move = ev => {
    const q = toProject(ev);
    const dx = q.x - start.x;
    const dy = q.y - start.y;
    if (!moved && Math.hypot(dx, dy) * q.vs < 3) return;
    if (!moved) { beginChange(); moved = true; }
    clearGuides();
    if (mode === 'move') {
      let nx = start.x0 + dx;
      let ny = start.y0 + dy;
      if (!ev.altKey) [nx, ny] = snapMove(c, nx, ny, q.vs);
      c.x = Math.round(nx);
      c.y = Math.round(ny);
    } else if (mode === 'rot') {
      let a = Math.atan2(q.y - c.y, q.x - c.x) * 180 / Math.PI + 90;
      if (ev.shiftKey) a = Math.round(a / 15) * 15;
      else for (const s of [0, 90, 180, 270, 360, -90]) if (Math.abs(a - s) < 4) a = s;
      c.rotation = Math.round(((a % 360) + 360) % 360 * 10) / 10;
      if (c.rotation > 180) c.rotation -= 360;
    } else {
      const rad = start.r0 * Math.PI / 180;
      const lx = dx * Math.cos(-rad) - dy * Math.sin(-rad);
      const ly = dx * Math.sin(-rad) + dy * Math.cos(-rad);
      const sx = mode.includes('e') ? 1 : mode.includes('w') ? -1 : 0;
      const sy = mode.includes('s') ? 1 : mode.includes('n') ? -1 : 0;
      let w = start.w0 + lx * sx;
      let h = start.h0 + ly * sy;
      const corner = sx && sy;
      if (c.type === 'text') {
        if (corner) {
          const k = Math.max(0.1, (start.w0 + lx * sx) / start.w0);
          c.size = Math.max(8, Math.round(start.size0 * k));
          w = start.w0 * k;
        }
        h = c.h;
        c.w = Math.max(60, Math.round(w));
        clearLayout(c.id);
        layoutText(document.createElement('canvas').getContext('2d'), c);
      } else {
        if (corner && (keepRatioDefault !== ev.shiftKey)) {
          const k = Math.max(Math.abs(w / start.w0), Math.abs(h / start.h0));
          w = start.w0 * k;
          h = start.h0 * k;
        }
        c.w = Math.max(10, Math.round(Math.abs(w)));
        c.h = Math.max(10, Math.round(Math.abs(h)));
      }
      const dw = (c.w - start.w0) / 2 * sx;
      const dh = (c.type === 'text' ? 0 : (c.h - start.h0) / 2) * sy;
      c.x = Math.round(start.x0 + dw * Math.cos(rad) - dh * Math.sin(rad));
      c.y = Math.round(start.y0 + dw * Math.sin(rad) + dh * Math.cos(rad));
    }
    emit('live');
  };
  const up = () => {
    box.removeEventListener('pointermove', move);
    box.removeEventListener('pointerup', up);
    box.removeEventListener('pointercancel', up);
    clearGuides();
    if (moved) commit('stage');
  };
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
}

// ------------------------------------------------------------------ guide magnetiche
function snapMove(c, nx, ny, vs) {
  const W = S.project.width;
  const H = S.project.height;
  const th = 8 / vs;
  const xs = [W / 2, 0 + c.w / 2, W - c.w / 2];
  const ys = [H / 2, 0 + c.h / 2, H - c.h / 2];
  for (const o of clipsAt(S.time)) {
    if (o.id === c.id || o.type === 'audio') continue;
    xs.push(o.x, o.x - o.w / 2 - c.w / 2, o.x + o.w / 2 + c.w / 2, o.x - o.w / 2 + c.w / 2, o.x + o.w / 2 - c.w / 2);
    ys.push(o.y, o.y - o.h / 2 - c.h / 2, o.y + o.h / 2 + c.h / 2, o.y - o.h / 2 + c.h / 2, o.y + o.h / 2 - c.h / 2);
  }
  let gx = null;
  let gy = null;
  for (const x of xs) if (Math.abs(nx - x) < th) { nx = x; gx = x; break; }
  for (const y of ys) if (Math.abs(ny - y) < th) { ny = y; gy = y; break; }
  if (gx !== null) guide('v', gx === W / 2 ? W / 2 : nx, vs);
  if (gy !== null) guide('h', gy === H / 2 ? H / 2 : ny, vs);
  return [nx, ny];
}

function guide(dir, v, vs) {
  const g = document.createElement('div');
  g.className = `st-guide ${dir} st-g`;
  if (dir === 'v') g.style.left = v * vs + 'px'; else g.style.top = v * vs + 'px';
  ov.appendChild(g);
}

function clearGuides() { ov.querySelectorAll('.st-g').forEach(g => g.remove()); }

// ------------------------------------------------------------------ testo in linea
function onDblClick(e) {
  const p = toProject(e);
  const hit = hitTest(p.x, p.y, S.time);
  if (!hit || hit.type !== 'text' || hit.locked) return;
  select(hit.id);
  startTextEdit(hit);
}

export function startTextEdit(c) {
  const vs = viewScale();
  textEditing = c.id;
  overlay();
  const ta = document.createElement('textarea');
  ta.className = 'st-text-edit';
  ta.value = c.text;
  Object.assign(ta.style, {
    left: (c.x - c.w / 2) * vs + 'px', top: (c.y - c.h / 2) * vs + 'px', width: c.w * vs + 'px', height: Math.max(c.h, c.size * 1.3) * vs + 'px',
    transform: `rotate(${c.rotation || 0}deg)`, font: `${c.italic ? 'italic ' : ''}${c.weight} ${c.size * vs}px "${c.font}"`, textAlign: c.align,
    lineHeight: String(c.lineHeight || 1.15), letterSpacing: `${(c.letterSpacing || 0) * vs}px`, textTransform: c.uppercase ? 'uppercase' : 'none',
  });
  ov.appendChild(ta);
  ta.focus();
  ta.select();
  beginChange();
  const sync = () => {
    c.text = ta.value;
    clearLayout(c.id);
    emit('live');
    ta.style.height = Math.max(c.h, c.size * 1.3) * vs + 'px';
    ta.style.top = (c.y - c.h / 2) * vs + 'px';
  };
  ta.addEventListener('input', sync);
  const finish = () => {
    if (!textEditing) return;
    textEditing = null;
    ta.remove();
    if (c.text.trim() === '') c.text = 'Testo';
    commit('text');
  };
  ta.addEventListener('blur', finish);
  ta.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Escape' || (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey))) ta.blur();
  });
}

export function isEditingText() { return !!textEditing; }
