// Pannelli a sinistra di Salto Studio: media, modelli, testi, elementi, audio, effetti,
// transizioni, animazioni, sfondi e kit grafico della società.
import { S, emit, on as onState, addClip, baseClip, textClip, selectedClip, updateClip, duration, nid, beginChange, commit, loadProject, end } from './state.js';
import { probeMedia, loadImage } from './engine.js';
import { FILTERS, EFFECTS, TRANSITIONS, ANIM_LIST, LOOP_LIST, TEXT_STYLES, SHAPES, STICKERS, ICON_STICKERS, GRADIENTS, SOLIDS, drawShape } from './effects.js';
import { SFX, MUSIC, renderSfx, renderMusic, previewBuffer, stopPreview, encodeWav } from './audio.js';
import { TEMPLATES, brandFrom, buildTemplate } from './templates.js';
import { icon, toast, confirmDialog, $, $$ } from '../lib/ui.js';
import { esc } from '../lib/format.js';

export const TABS = [
  ['media', 'Media', 'image-plus'], ['modelli', 'Modelli', 'layout-template'], ['testo', 'Testo', 'type'], ['elementi', 'Elementi', 'shapes'],
  ['audio', 'Audio', 'music'], ['effetti', 'Effetti', 'wand-sparkles'], ['transizioni', 'Transizioni', 'blend'], ['animazioni', 'Animazioni', 'sparkles'],
  ['sfondo', 'Sfondo', 'palette'], ['brand', 'Brand', 'badge-check'],
];

const ATHLOS_IMAGES = ['palestra', 'artistica', 'ritmica', 'judo', 'aerea', 'fitness', 'team', 'studio'];
let current = 'modelli';
let host;
let appData = { company: {}, disciplines: [] };
let hooks = {};

export function mountPanels(rail, panel, data, h = {}) {
  appData = data;
  hooks = h;
  host = panel;
  rail.innerHTML = TABS.map(([k, l, ic]) => `<button data-tab="${k}">${icon(ic, 21)}<span>${l}</span></button>`).join('');
  rail.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (b) show(b.dataset.tab);
  });
  onState(what => { if (['select', 'project', 'load'].includes(what) && ['effetti', 'transizioni', 'animazioni', 'media'].includes(current)) show(current, true); });
  show(current);
}

export function show(tab, quiet) {
  current = tab;
  document.querySelectorAll('.st-rail [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const [, label] = TABS.find(t => t[0] === tab);
  const scrollTop = quiet ? host.querySelector('.st-panel-body')?.scrollTop || 0 : 0;
  host.innerHTML = `<div class="st-panel-head"><h3>${label}</h3><p>${SUBS[tab] || ''}</p></div><div class="st-panel-body" id="pb"></div>`;
  const body = host.querySelector('#pb');
  RENDER[tab](body);
  body.scrollTop = scrollTop;
}

const SUBS = {
  media: 'Importa video, foto e musica o trascinali nella finestra.',
  modelli: 'Grafiche e video pronti, già con i dati della società.',
  testo: 'Titoli, sottotitoli e oltre 35 stili animabili.',
  elementi: 'Forme, adesivi e icone da trascinare sul progetto.',
  audio: 'Voce fuori campo, musica ed effetti sonori senza diritti.',
  effetti: 'Filtri colore ed effetti dinamici per la clip selezionata.',
  transizioni: 'Passaggi tra clip consecutive sulla stessa traccia.',
  animazioni: 'Entrata, uscita e movimento continuo della clip.',
  sfondo: 'Colori, sfumature e immagini di sfondo del progetto.',
  brand: 'Logo, nome e colori della società in un clic.',
};

// ------------------------------------------------------------------ helper aggiunta
function placeTime() {
  return S.time >= duration() - 0.05 && S.project.clips.length ? 0 : S.time;
}
function defaultDur() {
  const hasVideo = S.project.clips.some(c => c.type === 'video');
  return hasVideo ? 4 : Math.max(2, (S.project.designDuration || 6) - placeTime());
}

export async function addMedia(src, kind, name) {
  const info = await probeMedia(src, kind).catch(err => { toast(err.message, { type: 'error' }); return null; });
  if (!info) return null;
  if (!S.project.media.some(m => m.src === src)) S.project.media.push({ id: nid('m'), src, kind, name, duration: info.duration, width: info.width, height: info.height });
  const W = S.project.width;
  const H = S.project.height;
  const t = placeTime();
  if (kind === 'audio') return addClip(baseClip('audio', { src, name, start: t, duration: Math.max(0.5, info.duration), x: 0, y: 0, w: 0, h: 0 }));
  const first = !S.project.clips.some(c => c.type === 'video' || c.type === 'image');
  let w;
  let h;
  const ar = (info.width || 16) / (info.height || 9);
  if (first || kind === 'video') { w = W; h = H; } else {
    w = W * 0.7; h = w / ar;
    if (h > H * 0.7) { h = H * 0.7; w = h * ar; }
  }
  if (kind === 'image') await loadImage(src).catch(() => {});
  return addClip(baseClip(kind, { src, name, start: t, duration: kind === 'video' ? info.duration : defaultDur(), x: W / 2, y: H / 2, w: Math.round(w), h: Math.round(h), fit: first || kind === 'video' ? 'cover' : 'fill' }));
}

export async function importFiles(list) {
  for (const f of list) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const kind = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'].includes(ext) ? 'video' : ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'].includes(ext) ? 'audio' : 'image';
    await addMedia(f.url, kind, f.name);
  }
  if (current === 'media') show('media', true);
}

export async function saveBlobToProject(blob, name) {
  const dir = await window.athlos.file.studioDir();
  const sep = window.athlos.platform === 'win32' ? '\\' : '/';
  const filePath = `${dir}${sep}media${sep}${name}`;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const p = await window.athlos.file.save({ filePath, bytes });
  return window.athlos.file.urlOf(p);
}

function addText(props) {
  const W = S.project.width;
  const H = S.project.height;
  const c = textClip({ x: W / 2, y: H / 2, w: Math.round(W * 0.84), start: placeTime(), duration: defaultDur(), animIn: { type: 'pop', duration: 0.6 }, ...props });
  c.name = 'Testo';
  addClip(c);
  emit('preview-anim');
  return c;
}

// ------------------------------------------------------------------ pannelli
const RENDER = {
  media(b) {
    const list = S.project.media || [];
    b.innerHTML = `<button class="st-big-btn" id="imp">${icon('upload', 18)}Importa video, foto o musica</button>
      <p class="tiny" style="color:var(--st-muted);margin-top:8px;text-align:center">Puoi anche trascinare i file da Esplora risorse.</p>
      ${list.length ? `<div class="st-sec">Nel progetto <span>${list.length}</span></div><div class="st-grid">${list.map(m => `<button class="st-tile" data-media="${esc(m.src)}" data-kind="${m.kind}" data-name="${esc(m.name)}" style="aspect-ratio:16/10">
          ${m.kind === 'image' ? `<img src="${esc(m.src)}">` : m.kind === 'video' ? `<video src="${esc(m.src)}#t=0.5" muted preload="metadata"></video>` : `<div style="display:grid;place-items:center;height:100%;background:linear-gradient(135deg,#059669,#0EA5E9)">${icon('music', 26)}</div>`}
          <span class="st-tile-badge">${m.kind === 'image' ? 'FOTO' : fmtDur(m.duration)}</span><span class="st-tile-lbl">${esc(m.name)}</span><span class="st-add">${icon('plus', 14)}</span></button>`).join('')}</div>` : ''}
      <div class="st-sec">Immagini Athlos</div>
      <div class="st-grid">${ATHLOS_IMAGES.map(i => `<button class="st-tile" data-media="athlos://app/assets/images/${i}.webp" data-kind="image" data-name="${i}" style="aspect-ratio:16/10"><img src="assets/images/${i}.webp"><span class="st-tile-lbl">${i}</span><span class="st-add">${icon('plus', 14)}</span></button>`).join('')}</div>`;
    b.querySelector('#imp').onclick = async () => {
      const files = await window.athlos.file.open({ title: 'Importa media', multiple: true, filters: [{ name: 'Video, foto e audio', extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] }] });
      if (files.length) importFiles(files);
    };
    b.addEventListener('click', e => {
      const t = e.target.closest('[data-media]');
      if (t) addMedia(t.dataset.media, t.dataset.kind, t.dataset.name);
    });
  },

  async modelli(b) {
    const cats = [...new Set(TEMPLATES.map(t => t.cat))];
    b.innerHTML = cats.map(cat => `<div class="st-sec">${esc(cat)}</div><div class="st-grid">${TEMPLATES.filter(t => t.cat === cat).map(t => `<button class="st-tile" data-tpl="${t.id}"><canvas data-thumb="${t.id}"></canvas><span class="st-tile-lbl">${esc(t.name)}</span></button>`).join('')}</div>`).join('');
    b.addEventListener('click', async e => {
      const el = e.target.closest('[data-tpl]');
      if (!el) return;
      const t = TEMPLATES.find(x => x.id === el.dataset.tpl);
      if (S.project.clips.length && !(await confirmDialog('Il modello sostituisce il progetto aperto. Le modifiche non salvate andranno perse.', { title: `Usare “${t.name}”?`, okLabel: 'Usa il modello' }))) return;
      const p = buildTemplate(t, brandFrom(appData));
      loadProject(p);
      hooks.afterTemplate && hooks.afterTemplate();
      toast(`Modello “${t.name}” pronto: clicca sui testi per modificarli`);
    });
    for (const cv of b.querySelectorAll('[data-thumb]')) hooks.thumb && hooks.thumb(cv, TEMPLATES.find(x => x.id === cv.dataset.thumb));
  },

  testo(b) {
    b.innerHTML = `<div class="col" style="gap:8px">
        <button class="st-row-btn" data-add="title"><span class="ico-c">${icon('type', 18)}</span><div><b style="font-size:17px;font-family:Montserrat;font-weight:900">Aggiungi un titolo</b></div></button>
        <button class="st-row-btn" data-add="sub"><span class="ico-c" style="--g:var(--grad-cool)">${icon('text', 18)}</span><div><b style="font-family:Poppins">Aggiungi un sottotitolo</b></div></button>
        <button class="st-row-btn" data-add="body"><span class="ico-c" style="--g:var(--grad-green)">${icon('align-left', 18)}</span><div>Aggiungi un testo</div></button>
        <button class="st-row-btn" data-add="caption"><span class="ico-c" style="--g:var(--grad-warm)">${icon('message-square-quote', 18)}</span><div>Sottotitolo video<small>Barra scura in basso, stile social</small></div></button>
      </div>
      <div class="st-sec">Stili di testo <span>${TEXT_STYLES.length}</span></div>
      <div class="st-grid">${TEXT_STYLES.map((s, i) => `<button class="st-tile st-textstyle" data-style="${i}" style="${cssPreview(s.p)}">${esc(s.name)}</button>`).join('')}</div>`;
    b.addEventListener('click', e => {
      const a = e.target.closest('[data-add]');
      if (a) {
        const k = a.dataset.add;
        if (k === 'title') addText({ text: 'Il tuo titolo', size: 120, font: 'Montserrat', weight: 900 });
        if (k === 'sub') addText({ text: 'Sottotitolo', size: 64, font: 'Poppins', weight: 700 });
        if (k === 'body') addText({ text: 'Scrivi qui il tuo testo', size: 44, font: 'Plus Jakarta Sans', weight: 500, animIn: { type: 'fade', duration: 0.5 } });
        if (k === 'caption') addText({ text: 'Sottotitolo del video', size: 52, font: 'Poppins', weight: 700, y: S.project.height * 0.82, bg: { enabled: true, color: 'rgba(0,0,0,.65)', padding: 18, radius: 12 }, animIn: { type: 'typewriter', duration: 0.8 } });
        return;
      }
      const s = e.target.closest('[data-style]');
      if (!s) return;
      const st = TEXT_STYLES[Number(s.dataset.style)];
      const sel = selectedClip();
      if (sel && sel.type === 'text') {
        updateClip(sel.id, { gradient: null, bg: { enabled: false }, stroke: { width: 0 }, textShadow: { enabled: false }, italic: false, uppercase: false, letterSpacing: 0, ...JSON.parse(JSON.stringify(st.p)) });
        toast(`Stile “${st.name}” applicato`);
      } else addText({ text: st.name, size: st.p.size || 110, ...JSON.parse(JSON.stringify(st.p)) });
    });
  },

  elementi(b) {
    b.innerHTML = `<div class="st-sec">Forme</div><div class="st-grid g4">${SHAPES.map(([k, n]) => `<button class="st-tile st-shape" data-shape="${k}" title="${n}"><canvas width="80" height="60" data-sh="${k}"></canvas></button>`).join('')}</div>
      ${Object.entries(STICKERS).map(([cat, list]) => `<div class="st-sec">Adesivi · ${esc(cat)}</div><div class="st-grid g6">${list.map(e => `<button class="st-emoji" data-emoji="${e}">${e}</button>`).join('')}</div>`).join('')}
      <div class="st-sec">Icone</div><div class="st-grid g6">${ICON_STICKERS.map(i => `<button class="st-emoji" data-icon="${i}" style="color:#fff">${icon(i, 22)}</button>`).join('')}</div>`;
    for (const cv of b.querySelectorAll('[data-sh]')) {
      const g = cv.getContext('2d');
      g.translate(40, 30);
      g.fillStyle = '#9B7BFF';
      drawShape(g, { shape: cv.dataset.sh }, 54, 44);
      g.fill('evenodd');
    }
    b.addEventListener('click', e => {
      const W = S.project.width;
      const H = S.project.height;
      const base = { start: placeTime(), duration: defaultDur(), x: W / 2, y: H / 2, animIn: { type: 'pop', duration: 0.5 } };
      const sh = e.target.closest('[data-shape]');
      if (sh) {
        const k = sh.dataset.shape;
        const s = Math.min(W, H) * 0.4;
        addClip(baseClip('shape', { ...base, name: 'Forma', shape: k, w: k === 'line' ? W * 0.6 : s, h: k === 'line' ? 40 : k === 'rect' || k === 'rounded' ? s * 0.6 : s, fill: '#7C4DFF', strokeWidth: 0, strokeColor: '#ffffff' }));
      }
      const em = e.target.closest('[data-emoji]');
      if (em) { const s = Math.min(W, H) * 0.22; addClip(baseClip('sticker', { ...base, name: 'Adesivo ' + em.dataset.emoji, emoji: em.dataset.emoji, w: s, h: s, loop: { type: 'float', speed: 0.6 } })); }
      const ic = e.target.closest('[data-icon]');
      if (ic) { const s = Math.min(W, H) * 0.2; addClip(baseClip('icon', { ...base, name: 'Icona', icon: ic.dataset.icon, color: '#FFFFFF', w: s, h: s })); }
      if (sh || em || ic) emit('preview-anim');
    });
  },

  audio(b) {
    b.innerHTML = `<button class="st-big-btn" id="rec" style="border-color:#EF4444;background:rgba(239,68,68,.1)">${icon('mic', 18)}Registra la voce fuori campo</button>
      <p class="tiny" style="color:var(--st-muted);margin:8px 0 0;text-align:center">Il video scorre mentre parli: la voce viene inserita al punto giusto.</p>
      <button class="st-row-btn mt" id="impA" style="margin-top:12px"><span class="ico-c" style="--g:var(--grad-cool)">${icon('upload', 17)}</span><div>Importa musica<small>MP3, WAV, M4A, OGG…</small></div></button>
      <div class="st-sec">Basi musicali generate</div>
      ${MUSIC.map(m => `<div class="st-row-btn" data-music="${m.id}"><button class="st-play" data-prev-music="${m.id}">${icon('play', 14)}</button><div class="grow"><b>${m.emoji} ${esc(m.name)}</b><small>${esc(m.desc)}</small></div><button class="st-ibtn" data-add-music="${m.id}" title="Aggiungi">${icon('plus', 17)}</button></div>`).join('')}
      <div class="st-sec">Effetti sonori</div>
      <div class="st-grid">${SFX.map(s => `<div class="st-row-btn" style="margin:0;padding:8px" data-sfx="${s.id}"><button class="st-play" data-prev-sfx="${s.id}">${icon('play', 13)}</button><div class="grow" style="font-size:12px">${s.emoji} ${esc(s.name)}</div><button class="st-ibtn" style="width:26px;height:26px" data-add-sfx="${s.id}">${icon('plus', 15)}</button></div>`).join('')}</div>`;
    b.querySelector('#rec').onclick = () => hooks.recordVoice && hooks.recordVoice();
    b.querySelector('#impA').onclick = async () => {
      const files = await window.athlos.file.open({ title: 'Importa audio', multiple: true, filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'] }] });
      if (files.length) importFiles(files);
    };
    const cache = new Map();
    const getBuf = async (kind, id) => {
      const key = kind + id;
      if (!cache.has(key)) cache.set(key, kind === 'music' ? renderMusic(MUSIC.find(m => m.id === id)) : renderSfx(SFX.find(s => s.id === id)));
      return cache.get(key);
    };
    b.addEventListener('click', async e => {
      const pm = e.target.closest('[data-prev-music],[data-prev-sfx]');
      if (pm) {
        const kind = pm.dataset.prevMusic ? 'music' : 'sfx';
        const id = pm.dataset.prevMusic || pm.dataset.prevSfx;
        if (pm.classList.contains('on')) { stopPreview(); pm.classList.remove('on'); pm.innerHTML = icon('play', 14); return; }
        b.querySelectorAll('.st-play.on').forEach(x => { x.classList.remove('on'); x.innerHTML = icon('play', 14); });
        pm.classList.add('on'); pm.innerHTML = icon('pause', 14);
        await previewBuffer(await getBuf(kind, id));
        pm.classList.remove('on'); pm.innerHTML = icon('play', 14);
        return;
      }
      const am = e.target.closest('[data-add-music],[data-add-sfx]');
      if (am) {
        const kind = am.dataset.addMusic ? 'music' : 'sfx';
        const id = am.dataset.addMusic || am.dataset.addSfx;
        const item = kind === 'music' ? MUSIC.find(m => m.id === id) : SFX.find(s => s.id === id);
        am.innerHTML = `<span class="spin">${icon('refresh-cw', 15)}</span>`;
        const buf = await getBuf(kind, id);
        const url = await saveBlobToProject(encodeWav(buf), `${kind === 'music' ? 'Base' : 'Effetto'} ${item.name} ${Date.now().toString(36)}.wav`);
        await addMedia(url, 'audio', `${item.emoji} ${item.name}`);
        am.innerHTML = icon('check', 15);
        toast(`${item.name} aggiunto alla timeline`);
      }
    });
  },

  effetti(b) {
    const c = selectedClip();
    const visual = c && c.type !== 'audio';
    b.innerHTML = `${visual ? '' : `<div class="st-row-btn" style="cursor:default"><span class="ico-c">${icon('info', 16)}</span><div>Seleziona una clip sulla timeline o sull'anteprima per applicare filtri ed effetti.</div></div>`}
      <div class="st-sec">Effetti dinamici</div>
      <div class="st-opt-grid">${EFFECTS.map(([k, n, ic]) => `<button class="st-opt ${c && c.effect === k ? 'sel' : ''}" data-effect="${k}"><span class="st-anim-ico">${icon(ic, 18)}</span>${esc(n)}</button>`).join('')}</div>
      <div class="st-sec">Filtri colore <span>${FILTERS.length}</span></div>
      <div class="st-opt-grid">${FILTERS.map(f => `<button class="st-opt ${c && c.filter === f.id ? 'sel' : ''}" data-filter="${f.id}"><canvas width="90" height="90" data-fprev="${f.id}"></canvas>${esc(f.name)}</button>`).join('')}</div>`;
    const src = c && c.type === 'image' ? c.src : 'athlos://app/assets/images/ritmica.webp';
    loadImage(src).then(img => {
      for (const cv of b.querySelectorAll('[data-fprev]')) {
        const f = FILTERS.find(x => x.id === cv.dataset.fprev);
        const g = cv.getContext('2d');
        g.filter = f.css || 'none';
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 90, 90);
        g.filter = 'none';
        if (f.overlay) { g.globalCompositeOperation = f.overlay[2]; g.globalAlpha = f.overlay[1]; g.fillStyle = f.overlay[0]; g.fillRect(0, 0, 90, 90); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
        if (f.vignette) { const gr = g.createRadialGradient(45, 45, 20, 45, 45, 64); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${f.vignette})`); g.fillStyle = gr; g.fillRect(0, 0, 90, 90); }
      }
    }).catch(() => {});
    b.addEventListener('click', e => {
      const sel = selectedClip();
      const ef = e.target.closest('[data-effect]');
      const fi = e.target.closest('[data-filter]');
      if ((ef || fi) && (!sel || sel.type === 'audio')) { toast('Seleziona prima una clip visiva', { type: 'info' }); return; }
      if (ef) updateClip(sel.id, { effect: ef.dataset.effect });
      if (fi) updateClip(sel.id, { filter: fi.dataset.filter });
    });
  },

  transizioni(b) {
    const c = selectedClip();
    b.innerHTML = `<div class="st-row-btn" style="cursor:default"><span class="ico-c">${icon('info', 16)}</span><div>${c ? 'La transizione si applica all\'inizio della clip selezionata, se è attaccata alla precedente sulla stessa traccia.' : 'Seleziona una clip (oppure premi il pulsante + tra due clip sulla timeline).'}</div></div>
      <div class="st-f mt" style="margin-top:12px"><span>Durata</span><div class="st-range"><input type="range" min="0.2" max="2" step="0.1" id="trD" value="${c?.transition?.duration || 0.6}"><output id="trDo">${(c?.transition?.duration || 0.6).toFixed(1)}s</output></div></div>
      <div class="st-opt-grid">${TRANSITIONS.map(([k, n]) => `<button class="st-opt ${c && c.transition?.type === k ? 'sel' : ''}" data-tr="${k}"><span class="st-anim-ico">${icon(trIcon(k), 18)}</span>${esc(n)}</button>`).join('')}</div>
      <button class="st-big-btn mt" id="trAll" style="margin-top:14px">${icon('wand-sparkles', 16)}Applica a tutte le clip consecutive</button>`;
    b.querySelector('#trD').addEventListener('input', e => {
      b.querySelector('#trDo').textContent = Number(e.target.value).toFixed(1) + 's';
      const sel = selectedClip();
      if (sel) updateClip(sel.id, { transition: { duration: Number(e.target.value) } }, { merge: true, label: 'trd' });
    });
    b.addEventListener('click', e => {
      const t = e.target.closest('[data-tr]');
      const sel = selectedClip();
      if (t) {
        if (!sel) { toast('Seleziona prima una clip', { type: 'info' }); return; }
        updateClip(sel.id, { transition: { type: t.dataset.tr, duration: Number(b.querySelector('#trD').value) } });
      }
      if (e.target.closest('#trAll')) {
        const type = sel?.transition?.type && sel.transition.type !== 'none' ? sel.transition.type : 'fade';
        beginChange();
        let n = 0;
        for (const cl of S.project.clips) {
          const prev = S.project.clips.find(o => o.trackId === cl.trackId && o.id !== cl.id && Math.abs(end(o) - cl.start) < 0.08);
          if (prev && cl.type !== 'audio') { cl.transition = { type, duration: Number(b.querySelector('#trD').value) }; n++; }
        }
        commit('trall');
        toast(n ? `Transizione applicata a ${n} passaggi` : 'Non ci sono clip consecutive', { type: n ? 'success' : 'info' });
      }
    });
  },

  animazioni(b) {
    const c = selectedClip();
    const grid = (key, list, cur) => `<div class="st-opt-grid">${list.map(([k, n]) => `<button class="st-opt ${cur === k ? 'sel' : ''}" data-${key}="${k}"><span class="st-anim-ico" style="--demo:${demoAnim(k)}">${icon(animIcon(k), 18)}</span>${esc(n)}</button>`).join('')}</div>`;
    b.innerHTML = `${c ? '' : `<div class="st-row-btn" style="cursor:default"><span class="ico-c">${icon('info', 16)}</span><div>Seleziona una clip per animarla.</div></div>`}
      <div class="st-sec">Entrata</div><div class="st-f"><span>Durata</span><div class="st-range"><input type="range" min="0.1" max="3" step="0.1" data-dur="animIn" value="${c?.animIn?.duration || 0.6}"><output>${(c?.animIn?.duration || 0.6).toFixed(1)}s</output></div></div>${grid('in', ANIM_LIST, c?.animIn?.type)}
      <div class="st-sec">Uscita</div><div class="st-f"><span>Durata</span><div class="st-range"><input type="range" min="0.1" max="3" step="0.1" data-dur="animOut" value="${c?.animOut?.duration || 0.5}"><output>${(c?.animOut?.duration || 0.5).toFixed(1)}s</output></div></div>${grid('out', ANIM_LIST, c?.animOut?.type)}
      <div class="st-sec">Movimento continuo</div><div class="st-f"><span>Velocità</span><div class="st-range"><input type="range" min="0.1" max="3" step="0.1" data-dur="loop" value="${c?.loop?.speed || 1}"><output>${(c?.loop?.speed || 1).toFixed(1)}×</output></div></div>${grid('loop', LOOP_LIST, c?.loop?.type)}`;
    b.addEventListener('click', e => {
      const sel = selectedClip();
      const i = e.target.closest('[data-in],[data-out],[data-loop]');
      if (!i) return;
      if (!sel || sel.type === 'audio') { toast('Seleziona prima una clip visiva', { type: 'info' }); return; }
      if (i.dataset.in) updateClip(sel.id, { animIn: { type: i.dataset.in } });
      if (i.dataset.out) updateClip(sel.id, { animOut: { type: i.dataset.out } });
      if (i.dataset.loop) updateClip(sel.id, { loop: { type: i.dataset.loop } });
      if (i.dataset.in || i.dataset.out) emit('preview-anim');
    });
    b.addEventListener('input', e => {
      const r = e.target.closest('[data-dur]');
      const sel = selectedClip();
      if (!r || !sel) return;
      r.nextElementSibling.textContent = Number(r.value).toFixed(1) + (r.dataset.dur === 'loop' ? '×' : 's');
      const k = r.dataset.dur;
      updateClip(sel.id, k === 'loop' ? { loop: { speed: Number(r.value) } } : { [k]: { duration: Number(r.value) } }, { merge: true, label: 'anim' + k });
    });
  },

  sfondo(b) {
    const bg = S.project.background || {};
    b.innerHTML = `<div class="st-sec">Tinta unita</div><div class="st-grid g6">${SOLIDS.map(c => `<button class="st-emoji" style="background:${c};border:1px solid rgba(255,255,255,.15)" data-solid="${c}"></button>`).join('')}</div>
      <div class="st-f mt" style="margin-top:10px"><span>Colore</span><div class="st-color"><input type="color" id="bgc" value="${bg.color && bg.color.startsWith('#') && bg.color.length === 7 ? bg.color : '#14102b'}"><span class="tiny" style="color:var(--st-muted)">Scegli qualsiasi colore</span></div></div>
      <div class="st-sec">Sfumature</div><div class="st-grid g4">${GRADIENTS.map((g, i) => `<button class="st-emoji" style="background:linear-gradient(135deg,${g.join(',')})" data-grad="${i}"></button>`).join('')}</div>
      <div class="st-f mt" style="margin-top:10px"><span>Angolo</span><div class="st-range"><input type="range" min="0" max="360" id="bga" value="${bg.angle ?? 135}"><output id="bgao">${bg.angle ?? 135}°</output></div></div>
      <div class="st-sec">Immagine di sfondo</div><div class="st-grid">${ATHLOS_IMAGES.map(i => `<button class="st-tile" style="aspect-ratio:16/10" data-bgimg="athlos://app/assets/images/${i}.webp"><img src="assets/images/${i}.webp"></button>`).join('')}</div>
      <label class="st-f mt" style="margin-top:10px"><span>Sfocatura</span><div class="st-range"><input type="range" min="0" max="40" id="bgb" value="${bg.blur || 0}"><output id="bgbo">${bg.blur || 0}px</output></div></label>
      <button class="st-big-btn" id="bgImp" style="margin-top:8px">${icon('image-plus', 16)}Usa una tua foto come sfondo</button>`;
    const setBg = patch => { beginChange(); S.project.background = { ...S.project.background, ...patch }; commit('bg'); };
    b.addEventListener('click', async e => {
      const s = e.target.closest('[data-solid]');
      if (s) setBg({ type: 'color', color: s.dataset.solid });
      const g = e.target.closest('[data-grad]');
      if (g) setBg({ type: 'gradient', colors: GRADIENTS[Number(g.dataset.grad)] });
      const im = e.target.closest('[data-bgimg]');
      if (im) { await loadImage(im.dataset.bgimg); setBg({ type: 'image', src: im.dataset.bgimg }); }
      if (e.target.closest('#bgImp')) {
        const f = await window.athlos.file.open({ title: 'Immagine di sfondo', filters: [{ name: 'Immagini', extensions: ['jpg', 'jpeg', 'png', 'webp'] }] });
        if (f.length) { await loadImage(f[0].url); setBg({ type: 'image', src: f[0].url }); }
      }
    });
    b.querySelector('#bgc').addEventListener('input', e => { S.project.background = { ...S.project.background, type: 'color', color: e.target.value }; emit('live'); });
    b.querySelector('#bgc').addEventListener('change', () => commit('bgc'));
    b.querySelector('#bga').addEventListener('input', e => { b.querySelector('#bgao').textContent = e.target.value + '°'; S.project.background.angle = Number(e.target.value); emit('live'); });
    b.querySelector('#bga').addEventListener('change', () => commit('bga'));
    b.querySelector('#bgb').addEventListener('input', e => { b.querySelector('#bgbo').textContent = e.target.value + 'px'; S.project.background.blur = Number(e.target.value); emit('live'); });
    b.querySelector('#bgb').addEventListener('change', () => commit('bgb'));
  },

  brand(b) {
    const br = brandFrom(appData);
    const colors = ['#5B5BF6', '#8B3DF0', '#E9468F', '#1B1440', '#FFFFFF', ...(appData.disciplines || []).map(d => d.colore)];
    b.innerHTML = `<div class="st-row-btn" style="cursor:default"><span class="ico-c">${br.logo ? `<img src="${esc(br.logo)}" style="width:100%;height:100%;object-fit:contain;background:#fff;border-radius:10px">` : icon('building-2', 17)}</span><div><b>${esc(br.name)}</b><small>Dati presi da Athlos › Dati società</small></div></div>
      ${br.logo ? `<button class="st-big-btn mt" style="margin-top:10px" id="addLogo">${icon('image-plus', 16)}Aggiungi il logo</button>` : '<p class="tiny" style="color:var(--st-muted);margin-top:8px">Carica il logo in Athlos › Dati società per usarlo qui.</p>'}
      <button class="st-row-btn mt" style="margin-top:10px" id="addName"><span class="ico-c">${icon('type', 17)}</span><div>Nome della società<small>Come testo</small></div></button>
      ${br.phone || br.instagram ? `<button class="st-row-btn" id="addContacts"><span class="ico-c" style="--g:var(--grad-cool)">${icon('phone', 17)}</span><div>Contatti<small>${esc([br.phone, br.instagram].filter(Boolean).join(' · '))}</small></div></button>` : ''}
      <button class="st-row-btn" id="addWatermark"><span class="ico-c" style="--g:var(--grad-warm)">${icon('stamp', 17)}</span><div>Filigrana<small>Nome in basso, semitrasparente, per tutto il video</small></div></button>
      <div class="st-sec">Colori della società</div><div class="st-grid g6">${colors.map(c => `<button class="st-emoji" style="background:${c}" data-bcol="${c}" title="Applica al testo o alla forma selezionata"></button>`).join('')}</div>
      <div class="st-sec">Discipline</div>${(appData.disciplines || []).map(d => `<button class="st-row-btn" data-disc="${esc(d.nome)}" data-col="${d.colore}"><span class="ico-c" style="--g:${d.colore}">${icon('trophy', 16)}</span><div>${esc(d.nome)}<small>Etichetta colorata</small></div></button>`).join('')}`;
    const W = S.project.width;
    const H = S.project.height;
    b.addEventListener('click', e => {
      if (e.target.closest('#addLogo')) addClip(baseClip('image', { src: br.logo, name: 'Logo', fit: 'contain', x: W - W * 0.12, y: H * 0.08, w: W * 0.16, h: W * 0.16, start: placeTime(), duration: Math.max(defaultDur(), duration() - placeTime()), animIn: { type: 'pop', duration: 0.5 } }));
      if (e.target.closest('#addName')) addText({ text: br.name, font: 'Montserrat', weight: 900, size: Math.round(W / 12) });
      if (e.target.closest('#addContacts')) addText({ text: [br.phone && `📞 ${br.phone}`, br.instagram && `📸 ${br.instagram}`].filter(Boolean).join('   '), font: 'Poppins', weight: 600, size: Math.round(W / 28), y: H * 0.92 });
      if (e.target.closest('#addWatermark')) addText({ text: br.name, font: 'Montserrat', weight: 800, size: Math.round(W / 34), opacity: 0.55, x: W / 2, y: H * 0.95, start: 0, duration: Math.max(defaultDur(), duration()), animIn: { type: 'none', duration: 0.3 }, letterSpacing: 3, uppercase: true });
      const col = e.target.closest('[data-bcol]');
      if (col) {
        const sel = selectedClip();
        if (!sel) { toast('Seleziona un testo o una forma', { type: 'info' }); return; }
        if (sel.type === 'text') updateClip(sel.id, { color: col.dataset.bcol, gradient: null });
        else if (sel.type === 'shape') updateClip(sel.id, { fill: col.dataset.bcol, fillGradient: null });
        else if (sel.type === 'icon') updateClip(sel.id, { color: col.dataset.bcol });
        else if (sel.type === 'color') updateClip(sel.id, { fill: col.dataset.bcol, colors: null });
      }
      const d = e.target.closest('[data-disc]');
      if (d) addText({ text: d.dataset.disc, font: 'Poppins', weight: 700, size: Math.round(W / 18), bg: { enabled: true, color: d.dataset.col, padding: 22, radius: 999 } });
    });
  },
};

function fmtDur(s) {
  const m = Math.floor((s || 0) / 60);
  return `${m}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;
}

function cssPreview(p) {
  const parts = [`font-family:'${p.font}'`, `font-weight:${p.weight || 700}`, `font-size:${Math.min(22, Math.max(12, (p.size || 100) / 5.5))}px`];
  if (p.italic) parts.push('font-style:italic');
  if (p.uppercase) parts.push('text-transform:uppercase');
  if (p.letterSpacing) parts.push(`letter-spacing:${Math.min(4, p.letterSpacing / 2)}px`);
  if (p.gradient) parts.push(`background-image:linear-gradient(90deg,${p.gradient.join(',')});-webkit-background-clip:text;background-clip:text;color:transparent`);
  else parts.push(`color:${p.color && p.color !== 'rgba(0,0,0,0)' ? p.color : 'transparent'}`);
  if (p.stroke?.width) parts.push(`-webkit-text-stroke:${Math.min(2, p.stroke.width / 3)}px ${p.stroke.color}`);
  if (p.textShadow?.enabled) parts.push(`text-shadow:${p.textShadow.x / 3}px ${p.textShadow.y / 3}px ${p.textShadow.blur / 3}px ${p.textShadow.color}`);
  if (p.bg?.enabled) parts.push(`background-color:${p.bg.color};border-radius:${p.bg.radius >= 999 ? 30 : p.bg.radius / 2}px;margin:12px 6px;height:auto;padding:4px 8px`);
  return parts.join(';');
}

function trIcon(k) {
  return { none: 'circle-dot', fade: 'blend', 'fade-black': 'moon', 'fade-white': 'sun', flash: 'zap', circle: 'circle', heart: 'heart', diamond: 'diamond', star: 'star', spin: 'rotate-cw', blur: 'droplet', pixelate: 'grid-3x3', glitch: 'activity', cube: 'square', blinds: 'menu', split: 'columns-3', clock: 'clock', diagonal: 'triangle', 'zoom-in': 'zoom-in', 'zoom-out': 'zoom-out' }[k]
    || (k.includes('left') ? 'arrow-left' : k.includes('right') ? 'arrow-right' : k.includes('up') ? 'arrow-up' : k.includes('down') ? 'arrow-down' : 'blend');
}
function animIcon(k) {
  return { none: 'circle-dot', fade: 'blend', pop: 'sparkle', 'zoom-in': 'zoom-in', 'zoom-out': 'zoom-out', bounce: 'activity', drop: 'arrow-down', rise: 'arrow-up', elastic: 'waves', spin: 'rotate-cw', swing: 'refresh-cw', 'flip-x': 'flip-horizontal', 'flip-y': 'flip-vertical', 'blur-in': 'droplet', stretch: 'move', typewriter: 'keyboard', 'word-pop': 'message-square-text', 'letters-rise': 'text', pulse: 'heart-pulse', heartbeat: 'heart', float: 'cloud', sway: 'waves', shake: 'zap', wiggle: 'activity', blink: 'eye', kenburns: 'focus', rainbow: 'palette' }[k]
    || (k.includes('left') ? 'arrow-left' : k.includes('right') ? 'arrow-right' : k.includes('up') ? 'arrow-up' : k.includes('down') ? 'arrow-down' : 'sparkles');
}
function demoAnim(k) {
  if (k === 'fade' || k === 'blur-in' || k === 'blink') return 'demoFade';
  if (k.startsWith('slide') || k === 'typewriter') return 'demoSlide';
  if (k.includes('zoom') || k === 'pop' || k === 'elastic' || k === 'pulse' || k === 'heartbeat') return 'demoZoom';
  if (k === 'spin') return 'demoSpin';
  if (k === 'none') return 'none';
  return 'demoBounce';
}
