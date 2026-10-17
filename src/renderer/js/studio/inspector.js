// Pannello proprietà di Salto Studio: progetto, posizione e tempi, testo, forme,
// regolazioni colore, chroma key, audio ed effetti voce della clip selezionata.
import { S, emit, on as onState, selectedClip, updateClip, beginChange, commit, FORMATS, removeClip, duplicate, track, visualTracks, freeTrack, end, DEFAULT_ADJUST } from './state.js';
import { FONTS, filterById } from './effects.js';
import { VOICE_FX } from './audio.js';
import { clearLayout, probeMedia, loadImage } from './engine.js';
import { show as showPanel } from './panels.js';
import { startTextEdit } from './stage.js';
import { icon, toast } from '../lib/ui.js';
import { esc } from '../lib/format.js';

let host;
let tab = 'base';
const SW = ['#FFFFFF', '#000000', '#1B1440', '#7C4DFF', '#E9468F', '#F97316', '#FACC15', '#10B981', '#0EA5E9', '#E11D48', '#FFE14D', '#FFD1E8'];
const BLENDS = [['source-over', 'Normale'], ['multiply', 'Moltiplica'], ['screen', 'Scherma'], ['overlay', 'Sovrapponi'], ['soft-light', 'Luce soffusa'], ['hard-light', 'Luce intensa'], ['color-dodge', 'Colore schiarito'], ['lighten', 'Schiarisci'], ['darken', 'Scurisci'], ['difference', 'Differenza'], ['luminosity', 'Luminosità']];

export function mountInspector(el) {
  host = el;
  onState(what => {
    if (what === 'time' || what === 'play') return;
    if (what === 'live' && host.contains(document.activeElement)) return;
    if (host.contains(document.activeElement) && what === 'project') return;
    render();
  });
  host.addEventListener('input', onInput);
  host.addEventListener('change', onChange);
  host.addEventListener('click', onClick);
  render();
}

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const r1 = v => Math.round(v * 10) / 10;

function field(label, inner) { return `<div class="st-f"><span>${label}</span>${inner}</div>`; }
function range(path, val, min, max, step = 1, unit = '') {
  return `<div class="st-range"><input type="range" data-k="${path}" min="${min}" max="${max}" step="${step}" value="${val}"><output>${r1(val)}${unit}</output></div>`;
}
function colorIn(path, val) {
  const v = /^#[0-9a-f]{6}$/i.test(val || '') ? val : '#ffffff';
  return `<div class="st-color"><input type="color" data-k="${path}" value="${v}"><div class="st-swatches">${SW.slice(0, 8).map(c => `<button style="background:${c}" data-sw="${path}" data-c="${c}"></button>`).join('')}</div></div>`;
}
function toggle(path, val, label) { return `<label class="switch small"><input type="checkbox" data-k="${path}" ${val ? 'checked' : ''}><i></i>${label}</label>`; }

function render() {
  if (!host) return;
  const c = selectedClip();
  if (!c) { host.innerHTML = projectPanel(); return; }
  const tabs = [['base', 'Base']];
  if (c.type === 'text') tabs.push(['testo', 'Testo']);
  if (c.type === 'shape' || c.type === 'icon' || c.type === 'color') tabs.push(['stile', 'Stile']);
  if (c.type !== 'audio') tabs.push(['regola', 'Regola']);
  if (c.type === 'video' || c.type === 'image') tabs.push(['chroma', 'Chroma']);
  if (c.type === 'video' || c.type === 'audio') tabs.push(['audio', 'Audio']);
  if (!tabs.find(t => t[0] === tab)) tab = tabs[1] ? tabs[1][0] : 'base';
  if (c.type === 'audio' && tab === 'base') tab = 'audio';
  const names = { video: 'Video', image: 'Immagine', text: 'Testo', shape: 'Forma', sticker: 'Adesivo', icon: 'Icona', color: 'Riquadro', audio: 'Audio' };
  host.innerHTML = `<div class="st-insp-head"><span class="ico-c">${icon({ video: 'film', image: 'image', text: 'type', shape: 'shapes', sticker: 'smile', icon: 'star', color: 'square', audio: 'music' }[c.type], 17)}</span>
      <div class="grow" style="min-width:0"><b class="ellipsis">${esc(names[c.type])}</b><small>${r1(c.start)}s → ${r1(end(c))}s · ${r1(c.duration)}s</small></div>
      <button class="st-ibtn" data-act="dup" title="Duplica">${icon('copy-plus', 16)}</button><button class="st-ibtn" data-act="del" title="Elimina">${icon('trash-2', 16)}</button></div>
    <div class="st-tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    ${({ base: basePanel, testo: textPanel, stile: stylePanel, regola: adjustPanel, chroma: chromaPanel, audio: audioPanel })[tab](c)}`;
}

function projectPanel() {
  const p = S.project;
  const hasVideo = p.clips.some(c => c.type === 'video' || c.type === 'audio');
  return `<div class="st-insp-head"><span class="ico-c">${icon('settings', 17)}</span><div><b>Progetto</b><small>Nessun elemento selezionato</small></div></div>
    <div class="st-group"><h5>Formato</h5>
      <div class="st-opt-grid">${FORMATS.map(f => `<button class="st-opt ${p.format === f.id ? 'sel' : ''}" data-format="${f.id}"><span class="st-anim-ico">${icon(f.icon, 17)}</span>${esc(f.name)}<span style="color:var(--st-muted);font-size:10px">${f.w}×${f.h}</span></button>`).join('')}</div>
    </div>
    <div class="st-group"><h5>Impostazioni</h5>
      ${field('Nome', `<input class="st-in" data-p="name" value="${esc(p.name)}">`)}
      ${field('Fotogrammi', `<select class="st-sel-in" data-p="fps">${[24, 25, 30, 50, 60].map(f => `<option ${p.fps === f ? 'selected' : ''}>${f}</option>`).join('')}</select>`)}
      ${hasVideo ? '' : field('Durata grafica', `<div class="st-range"><input type="range" data-p="designDuration" min="1" max="30" step="0.5" value="${p.designDuration || 6}"><output>${p.designDuration || 6}s</output></div>`)}
    </div>
    <div class="st-group"><h5>Suggerimenti</h5>
      <p class="tiny" style="color:var(--st-muted);line-height:1.6">• Doppio clic su un testo per scriverci sopra<br>• <kbd>Spazio</kbd> riproduci · <kbd>S</kbd> dividi · <kbd>Canc</kbd> elimina<br>• <kbd>Ctrl Z</kbd> annulla · <kbd>Ctrl D</kbd> duplica<br>• Frecce per spostare di 1 px, con <kbd>Maiusc</kbd> di 10 px<br>• <kbd>Alt</kbd> durante il trascinamento disattiva le guide</p>
    </div>`;
}

function basePanel(c) {
  const media = c.type === 'video' || c.type === 'audio';
  const visual = c.type !== 'audio';
  return `<div class="st-group"><h5>Tempo</h5>
      ${field('Inizio', `<input class="st-in" type="number" step="0.1" min="0" data-k="start" value="${r1(c.start)}">`)}
      ${field('Durata', `<input class="st-in" type="number" step="0.1" min="0.1" data-k="duration" value="${r1(c.duration)}">`)}
      ${media ? field('Velocità', `<div class="st-seg">${[0.25, 0.5, 1, 1.5, 2, 4].map(s => `<button class="${(c.speed || 1) === s ? 'active' : ''}" data-speed="${s}">${s}×</button>`).join('')}</div>`) : ''}
    </div>
    ${visual ? `<div class="st-group"><h5>Posizione e dimensioni <button class="st-ibtn" style="width:24px;height:24px" data-act="center" title="Centra">${icon('focus', 14)}</button></h5>
      <div class="st-pair" style="margin-bottom:8px"><label><i>X</i><input class="st-in" type="number" data-k="x" value="${Math.round(c.x)}"></label><label><i>Y</i><input class="st-in" type="number" data-k="y" value="${Math.round(c.y)}"></label></div>
      <div class="st-pair" style="margin-bottom:8px"><label><i>L</i><input class="st-in" type="number" data-k="w" value="${Math.round(c.w)}"></label><label><i>A</i><input class="st-in" type="number" data-k="h" value="${Math.round(c.h)}" ${c.type === 'text' ? 'disabled' : ''}></label></div>
      ${field('Rotazione', range('rotation', c.rotation || 0, -180, 180, 1, '°'))}
      ${field('Opacità', range('opacity', Math.round((c.opacity ?? 1) * 100), 0, 100, 1, '%'))}
      ${field('Specchia', `<div class="st-seg"><button class="${c.flipH ? 'active' : ''}" data-flip="flipH">${icon('flip-horizontal', 15)}</button><button class="${c.flipV ? 'active' : ''}" data-flip="flipV">${icon('flip-vertical', 15)}</button></div>`)}
      ${c.type === 'video' || c.type === 'image' ? field('Adatta', `<div class="st-seg">${[['cover', 'Riempi'], ['contain', 'Contieni'], ['fill', 'Stira']].map(([k, l]) => `<button class="${c.fit === k ? 'active' : ''}" data-fit="${k}">${l}</button>`).join('')}</div>`) : ''}
      <div class="st-pair" style="margin-top:6px"><button class="st-row-btn" style="padding:7px;justify-content:center" data-act="fill">${icon('maximize', 14)}Schermo intero</button><button class="st-row-btn" style="padding:7px;justify-content:center;margin:0" data-act="startEdit" ${c.type === 'text' ? '' : 'disabled'}>${icon('pencil', 14)}Scrivi</button></div>
    </div>
    <div class="st-group"><h5>Aspetto</h5>
      ${field('Fusione', `<select class="st-sel-in" data-k="blend">${BLENDS.map(([k, l]) => `<option value="${k}" ${c.blend === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${['video', 'image', 'color'].includes(c.type) ? field('Angoli', range('radius', c.radius || 0, 0, Math.round(Math.min(c.w, c.h) / 2), 1, 'px')) : ''}
      ${c.type !== 'text' && c.type !== 'sticker' ? field('Bordo', range('border.width', c.border?.width || 0, 0, 60, 1, 'px')) + (c.border?.width ? field('Colore bordo', colorIn('border.color', c.border.color)) : '') : ''}
      ${c.type !== 'text' ? `<div style="margin:6px 0">${toggle('shadow.enabled', c.shadow?.enabled, 'Ombra')}</div>` + (c.shadow?.enabled ? field('Sfocatura', range('shadow.blur', c.shadow.blur, 0, 120)) + field('Distanza', range('shadow.y', c.shadow.y, -80, 80)) : '') : ''}
      ${c.type === 'video' || c.type === 'image' ? `<button class="st-big-btn" style="margin-top:8px" data-act="replace">${icon('refresh-cw', 15)}Sostituisci ${c.type === 'video' ? 'video' : 'immagine'}</button>` : ''}
    </div>
    <div class="st-group"><h5>Livello</h5>
      <div class="st-pair"><button class="st-row-btn" style="padding:7px;justify-content:center" data-act="up">${icon('bring-to-front', 14)}Porta sopra</button><button class="st-row-btn" style="padding:7px;justify-content:center;margin:0" data-act="down">${icon('send-to-back', 14)}Porta sotto</button></div>
      <div style="margin-top:8px">${toggle('locked', c.locked, 'Blocca posizione')}</div>
      <button class="st-row-btn" style="margin-top:8px" data-act="anim"><span class="ico-c" style="--g:var(--grad-warm)">${icon('sparkles', 15)}</span><div>Animazioni<small>${esc([c.animIn?.type !== 'none' && 'entrata', c.animOut?.type !== 'none' && 'uscita', c.loop?.type !== 'none' && 'movimento'].filter(Boolean).join(', ') || 'nessuna')}</small></div></button>
      <button class="st-row-btn" data-act="fx"><span class="ico-c" style="--g:var(--grad-cool)">${icon('wand-sparkles', 15)}</span><div>Filtri ed effetti<small>${esc(filterById(c.filter).name)}${c.effect && c.effect !== 'none' ? ' · ' + c.effect : ''}</small></div></button>
    </div>` : ''}`;
}

function textPanel(c) {
  return `<div class="st-group"><h5>Contenuto</h5><textarea class="st-in" data-k="text" style="height:90px">${esc(c.text)}</textarea></div>
    <div class="st-group"><h5>Carattere</h5>
      ${field('Font', `<select class="st-sel-in" data-k="font" style="font-family:'${c.font}'">${FONTS.map(f => `<option value="${f}" style="font-family:'${f}'" ${c.font === f ? 'selected' : ''}>${f}</option>`).join('')}</select>`)}
      ${field('Dimensione', range('size', c.size, 10, 400, 1, 'px'))}
      ${field('Peso', `<select class="st-sel-in" data-k="weight">${[[300, 'Sottile'], [400, 'Normale'], [500, 'Medio'], [600, 'Semi'], [700, 'Grassetto'], [800, 'Extra'], [900, 'Nero']].map(([w, l]) => `<option value="${w}" ${Number(c.weight) === w ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${field('Stile', `<div class="st-seg"><button class="${c.italic ? 'active' : ''}" data-tog="italic">${icon('italic', 15)}</button><button class="${c.uppercase ? 'active' : ''}" data-tog="uppercase">${icon('case-sensitive', 15)}</button>${['left', 'center', 'right'].map(a => `<button class="${c.align === a ? 'active' : ''}" data-align="${a}">${icon('align-' + a, 15)}</button>`).join('')}</div>`)}
      ${field('Spaziatura', range('letterSpacing', c.letterSpacing || 0, -10, 40, 0.5, 'px'))}
      ${field('Interlinea', range('lineHeight', c.lineHeight || 1.1, 0.7, 2.5, 0.05))}
    </div>
    <div class="st-group"><h5>Colore <label class="switch small"><input type="checkbox" data-gradtoggle ${c.gradient ? 'checked' : ''}><i></i>Sfumato</label></h5>
      ${c.gradient ? c.gradient.map((g, i) => field(`Colore ${i + 1}`, colorIn(`gradient.${i}`, g))).join('') : field('Testo', colorIn('color', c.color))}
    </div>
    <div class="st-group"><h5>Contorno</h5>${field('Spessore', range('stroke.width', c.stroke?.width || 0, 0, 30, 0.5, 'px'))}${c.stroke?.width ? field('Colore', colorIn('stroke.color', c.stroke.color)) : ''}</div>
    <div class="st-group"><h5>Ombra / bagliore ${toggle('textShadow.enabled', c.textShadow?.enabled, '')}</h5>
      ${c.textShadow?.enabled ? field('Colore', colorIn('textShadow.color', c.textShadow.color)) + field('Sfocatura', range('textShadow.blur', c.textShadow.blur, 0, 80)) + field('Spost. X', range('textShadow.x', c.textShadow.x, -40, 40)) + field('Spost. Y', range('textShadow.y', c.textShadow.y, -40, 40)) : ''}</div>
    <div class="st-group"><h5>Sfondo etichetta ${toggle('bg.enabled', c.bg?.enabled, '')}</h5>
      ${c.bg?.enabled ? field('Colore', colorIn('bg.color', c.bg.color)) + field('Margine', range('bg.padding', c.bg.padding, 0, 120)) + field('Arrotondato', range('bg.radius', Math.min(c.bg.radius, 200), 0, 200)) + `<button class="st-row-btn" data-pill style="padding:6px;justify-content:center">${icon('circle', 13)}Pillola</button>` : ''}</div>`;
}

function stylePanel(c) {
  if (c.type === 'icon') return `<div class="st-group"><h5>Icona</h5>${field('Colore', colorIn('color', c.color))}</div>`;
  if (c.type === 'color') return `<div class="st-group"><h5>Riempimento <label class="switch small"><input type="checkbox" data-cgrad ${c.colors ? 'checked' : ''}><i></i>Sfumato</label></h5>
      ${c.colors ? c.colors.map((g, i) => field(`Colore ${i + 1}`, colorIn(`colors.${i}`, g))).join('') + field('Angolo', range('angle', c.angle ?? 135, 0, 360, 1, '°')) : field('Colore', colorIn('fill', c.fill))}</div>`;
  return `<div class="st-group"><h5>Riempimento <label class="switch small"><input type="checkbox" data-sgrad ${c.fillGradient ? 'checked' : ''}><i></i>Sfumato</label></h5>
      ${c.fillGradient ? c.fillGradient.map((g, i) => field(`Colore ${i + 1}`, colorIn(`fillGradient.${i}`, g))).join('') : field('Colore', colorIn('fill', c.fill))}
      <div style="margin-top:6px">${toggle('_transparentFill', c.fill === 'transparent', 'Solo contorno')}</div></div>
    <div class="st-group"><h5>Contorno</h5>${field('Spessore', range('strokeWidth', c.strokeWidth || 0, 0, 60))}${c.strokeWidth ? field('Colore', colorIn('strokeColor', c.strokeColor || '#ffffff')) : ''}</div>`;
}

function adjustPanel(c) {
  const a = { ...DEFAULT_ADJUST, ...(c.adjust || {}) };
  const rows = [['exposure', 'Esposizione', -100, 100], ['brightness', 'Luminosità', -100, 100], ['contrast', 'Contrasto', -100, 100], ['saturate', 'Saturazione', -100, 100], ['temperature', 'Temperatura', -100, 100], ['hue', 'Tonalità', -180, 180], ['sharpen', 'Nitidezza', 0, 100], ['blur', 'Sfocatura', 0, 40], ['vignette', 'Vignettatura', 0, 100], ['grain', 'Grana', 0, 100]];
  return `<div class="st-group"><h5>Regolazioni <button class="st-ibtn" style="width:auto;height:24px;padding:0 8px;font-size:11px" data-act="resetadj">Ripristina</button></h5>
      ${rows.map(([k, l, mi, ma]) => field(l, range(`adjust.${k}`, a[k] || 0, mi, ma))).join('')}</div>
    <div class="st-group"><h5>Filtro: ${esc(filterById(c.filter).name)}</h5>${c.filter !== 'none' ? field('Intensità', range('filterAmount', Math.round((c.filterAmount ?? 1) * 100), 0, 100, 1, '%')) : ''}
      <button class="st-row-btn" data-act="fx"><span class="ico-c" style="--g:var(--grad-cool)">${icon('wand-sparkles', 15)}</span><div>Scegli filtri ed effetti<small>Oltre 40 filtri e 20 effetti dinamici</small></div></button></div>`;
}

function chromaPanel(c) {
  const ch = c.chroma || {};
  return `<div class="st-group"><h5>Chroma key (green screen)</h5>
      <p class="tiny" style="color:var(--st-muted);margin:0 0 10px">Rende trasparente lo sfondo verde o blu: metti l'atleta davanti a qualsiasi sfondo.</p>
      ${toggle('chroma.enabled', ch.enabled, 'Attiva')}
      ${ch.enabled ? `<div class="st-pair" style="margin:10px 0"><button class="st-row-btn" style="padding:6px;justify-content:center" data-key="#00ff00"><i style="width:14px;height:14px;border-radius:4px;background:#00ff00"></i>Verde</button><button class="st-row-btn" style="padding:6px;justify-content:center;margin:0" data-key="#0047ff"><i style="width:14px;height:14px;border-radius:4px;background:#0047ff"></i>Blu</button></div>
        ${field('Colore', colorIn('chroma.color', ch.color))}${field('Tolleranza', range('chroma.tolerance', Math.round((ch.tolerance ?? 0.35) * 100), 1, 90, 1, '%'))}${field('Morbidezza', range('chroma.smooth', Math.round((ch.smooth ?? 0.08) * 100), 0, 40, 1, '%'))}` : ''}</div>`;
}

function audioPanel(c) {
  return `<div class="st-group"><h5>Volume</h5>
      ${field('Volume', range('volume', Math.round((c.volume ?? 1) * 100), 0, 200, 1, '%'))}
      ${field('Entrata', range('fadeIn', c.fadeIn || 0, 0, 5, 0.1, 's'))}
      ${field('Uscita', range('fadeOut', c.fadeOut || 0, 0, 5, 0.1, 's'))}
      <div style="margin-top:6px">${toggle('muted', c.muted, 'Silenzia questa clip')}</div>
      ${c.type === 'audio' ? `${field('Inizio', `<input class="st-in" type="number" step="0.1" min="0" data-k="start" value="${r1(c.start)}">`)}${field('Durata', `<input class="st-in" type="number" step="0.1" min="0.1" data-k="duration" value="${r1(c.duration)}">`)}
        ${field('Velocità', `<div class="st-seg">${[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => `<button class="${(c.speed || 1) === s ? 'active' : ''}" data-speed="${s}">${s}×</button>`).join('')}</div>`)}` : ''}
    </div>
    <div class="st-group"><h5>Effetti voce</h5><div class="st-opt-grid">${VOICE_FX.map(([k, n, e]) => `<button class="st-opt ${(c.voiceFx || 'none') === k ? 'sel' : ''}" data-vfx="${k}"><span style="font-size:22px">${e}</span>${esc(n)}</button>`).join('')}</div>
      <p class="tiny" style="color:var(--st-muted);margin-top:8px">“Scoiattolo” e “Mostro” cambiano anche la velocità della clip.</p></div>`;
}

// ------------------------------------------------------------------ eventi
function setPath(obj, path, value) {
  const keys = path.split('.');
  const patch = {};
  let cur = patch;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = value;
    else { cur[k] = Array.isArray(obj[k]) ? [...obj[k]] : {}; cur = cur[k]; obj = obj[k] || {}; }
  });
  return patch;
}

function valueFor(el, path) {
  if (el.type === 'checkbox') return el.checked;
  if (el.type === 'range' || el.type === 'number') {
    let v = num(el.value);
    if (['opacity', 'volume', 'filterAmount'].includes(path) || path.startsWith('chroma.tolerance') || path.startsWith('chroma.smooth')) v /= 100;
    return v;
  }
  return el.value;
}

function apply(path, value, merge) {
  const c = selectedClip();
  if (!c) return;
  if (path === '_transparentFill') { updateClip(c.id, { fill: value ? 'transparent' : '#7C4DFF', strokeWidth: value ? Math.max(6, c.strokeWidth || 0) : c.strokeWidth }); return; }
  if (/^(gradient|fillGradient|colors)\.\d+$/.test(path)) {
    const [k, i] = path.split('.');
    const arr = [...(c[k] || [])];
    arr[Number(i)] = value;
    updateClip(c.id, { [k]: arr }, { merge, label: path });
    return;
  }
  const patch = setPath(c, path, value);
  if (path === 'start') patch.start = Math.max(0, value);
  if (path === 'duration') patch.duration = Math.max(0.1, value);
  updateClip(c.id, patch, { merge, label: path });
  if (c.type === 'text') clearLayout(c.id);
}

function onInput(e) {
  const el = e.target;
  if (el.dataset.p) {
    const k = el.dataset.p;
    const v = el.type === 'range' ? num(el.value) : el.value;
    if (el.type === 'range') el.nextElementSibling.textContent = v + 's';
    beginChange();
    S.project[k] = k === 'fps' ? num(v, 30) : v;
    commit('p:' + k, { merge: true });
    if (k === 'name') emit('name');
    return;
  }
  const path = el.dataset.k;
  if (!path) return;
  const v = valueFor(el, path);
  if (el.type === 'range') {
    const out = el.parentElement.querySelector('output');
    if (out) out.textContent = r1(num(el.value)) + (out.textContent.replace(/^[-\d.]+/, '') || '');
  }
  if (el.type === 'checkbox' || el.tagName === 'SELECT') return;
  apply(path, v, true);
}

function onChange(e) {
  const el = e.target;
  const path = el.dataset.k;
  if (el.dataset.gradtoggle !== undefined) { const c = selectedClip(); updateClip(c.id, { gradient: el.checked ? [c.color === 'rgba(0,0,0,0)' ? '#FFFFFF' : c.color, '#E9468F'] : null }); return; }
  if (el.dataset.sgrad !== undefined) { const c = selectedClip(); updateClip(c.id, { fillGradient: el.checked ? [c.fill && c.fill !== 'transparent' ? c.fill : '#7C4DFF', '#E9468F'] : null }); return; }
  if (el.dataset.cgrad !== undefined) { const c = selectedClip(); updateClip(c.id, { colors: el.checked ? [c.fill || '#5B5BF6', '#E9468F'] : null }); return; }
  if (!path) return;
  if (el.type === 'checkbox' || el.tagName === 'SELECT') { apply(path, el.tagName === 'SELECT' && path === 'weight' ? num(el.value) : valueFor(el, path), false); render(); return; }
  if (el.type === 'number' || el.tagName === 'TEXTAREA' || el.type === 'text') render();
}

async function onClick(e) {
  const t = e.target.closest('button, [data-tab]');
  if (!t) return;
  const c = selectedClip();
  if (t.dataset.tab) { tab = t.dataset.tab; render(); return; }
  if (t.dataset.format) return changeFormat(t.dataset.format);
  if (t.dataset.sw) { apply(t.dataset.sw, t.dataset.c, false); render(); return; }
  if (!c) return;
  if (t.dataset.speed) {
    const s = num(t.dataset.speed, 1);
    const old = c.speed || 1;
    updateClip(c.id, { speed: s, duration: Math.max(0.1, c.duration * old / s) });
    render();
    return;
  }
  if (t.dataset.flip) { updateClip(c.id, { [t.dataset.flip]: !c[t.dataset.flip] }); render(); return; }
  if (t.dataset.fit) { updateClip(c.id, { fit: t.dataset.fit }); render(); return; }
  if (t.dataset.tog) { updateClip(c.id, { [t.dataset.tog]: !c[t.dataset.tog] }); clearLayout(c.id); render(); return; }
  if (t.dataset.align) { updateClip(c.id, { align: t.dataset.align }); clearLayout(c.id); render(); return; }
  if (t.dataset.key) { updateClip(c.id, { chroma: { color: t.dataset.key } }); render(); return; }
  if (t.dataset.pill !== undefined) { updateClip(c.id, { bg: { radius: 999 } }); render(); return; }
  if (t.dataset.vfx) {
    const k = t.dataset.vfx;
    const patch = { voiceFx: k };
    const target = k === 'chipmunk' ? 1.4 : k === 'monster' ? 0.75 : (['chipmunk', 'monster'].includes(c.voiceFx) ? 1 : null);
    if (target) { patch.duration = Math.max(0.1, c.duration * (c.speed || 1) / target); patch.speed = target; }
    updateClip(c.id, patch);
    render();
    return;
  }
  const W = S.project.width;
  const H = S.project.height;
  switch (t.dataset.act) {
    case 'del': removeClip(c.id); break;
    case 'dup': duplicate(c.id); break;
    case 'center': updateClip(c.id, { x: W / 2, y: H / 2 }); break;
    case 'fill': updateClip(c.id, c.type === 'text' ? { x: W / 2, y: H / 2, w: W * 0.9 } : { x: W / 2, y: H / 2, w: W, h: H, rotation: 0 }); clearLayout(c.id); break;
    case 'startEdit': startTextEdit(c); break;
    case 'anim': showPanel('animazioni'); break;
    case 'fx': showPanel('effetti'); break;
    case 'resetadj': updateClip(c.id, { adjust: { ...DEFAULT_ADJUST }, filter: 'none' }); render(); break;
    case 'up':
    case 'down': {
      const vt = visualTracks();
      const i = vt.findIndex(x => x.id === c.trackId);
      const target = vt[i + (t.dataset.act === 'up' ? 1 : -1)];
      beginChange();
      if (target && !S.project.clips.some(o => o.trackId === target.id && o.id !== c.id && o.start < end(c) && end(o) > c.start)) c.trackId = target.id;
      else if (t.dataset.act === 'up') { const nt = { id: 't' + Date.now().toString(36), kind: 'visual', name: `Livello ${vt.length + 1}` }; const idx = S.project.tracks.indexOf(vt[vt.length - 1]); S.project.tracks.splice(idx + 1, 0, nt); c.trackId = nt.id; } else { const nt = { id: 't' + Date.now().toString(36), kind: 'visual', name: 'Livello sotto' }; S.project.tracks.splice(S.project.tracks.indexOf(vt[0]), 0, nt); c.trackId = nt.id; }
      commit('layer');
      toast(t.dataset.act === 'up' ? 'Portato sopra' : 'Portato sotto');
      break;
    }
    case 'replace': {
      const files = await window.athlos.file.open({ title: 'Sostituisci', filters: [{ name: c.type === 'video' ? 'Video o immagine' : 'Immagini', extensions: c.type === 'video' ? ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'jpg', 'jpeg', 'png', 'webp'] : ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'mp4', 'mov', 'webm'] }] });
      if (!files.length) return;
      const f = files[0];
      const isVideo = /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name);
      const info = await probeMedia(f.url, isVideo ? 'video' : 'image').catch(() => null);
      if (!info) { toast('File non supportato', { type: 'error' }); return; }
      if (!isVideo) await loadImage(f.url);
      if (!S.project.media.some(m => m.src === f.url)) S.project.media.push({ id: 'm' + Date.now().toString(36), src: f.url, kind: isVideo ? 'video' : 'image', name: f.name, duration: info.duration, width: info.width, height: info.height });
      updateClip(c.id, { type: isVideo ? 'video' : 'image', src: f.url, name: f.name, in: 0, ...(isVideo ? { duration: Math.min(info.duration, Math.max(c.duration, 1)) } : {}) });
      toast('Media sostituito: animazioni, filtri e posizione restano gli stessi');
      break;
    }
    default: break;
  }
}

function changeFormat(id) {
  const f = FORMATS.find(x => x.id === id);
  const p = S.project;
  if (!f || (p.width === f.w && p.height === f.h && p.format === id)) { p.format = id; render(); return; }
  beginChange();
  const kx = f.w / p.width;
  const ky = f.h / p.height;
  const k = Math.min(kx, ky);
  for (const c of p.clips) {
    if (c.type === 'audio') continue;
    const full = Math.abs(c.w - p.width) < 2 && Math.abs(c.h - p.height) < 2;
    c.x *= kx;
    c.y *= ky;
    if (full) { c.w = f.w; c.h = f.h; } else { c.w *= k; c.h *= k; if (c.size) c.size = Math.round(c.size * k); }
    clearLayout(c.id);
  }
  p.width = f.w;
  p.height = f.h;
  p.format = id;
  commit('format');
  emit('format');
  toast(`Formato: ${f.name} (${f.w}×${f.h})`);
}
