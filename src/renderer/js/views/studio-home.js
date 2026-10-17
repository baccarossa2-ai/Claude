// Pagina di Salto Studio dentro Athlos: presentazione, formati, modelli e progetti recenti.
import { icon, on } from '../lib/ui.js';
import { esc, relTime } from '../lib/format.js';

const FORMATS = [
  ['reel', 'Reel / TikTok', '9:16', 'smartphone'], ['story', 'Storia', '9:16', 'circle-dot'], ['post', 'Post quadrato', '1:1', 'square'],
  ['portrait', 'Post verticale', '4:5', 'frame'], ['youtube', 'YouTube', '16:9', 'monitor-play'], ['a4', 'Locandina A4', 'stampa', 'file-text'],
];
const TEMPLATES = [
  ['iscrizioni', 'Iscrizioni aperte', 'ritmica'], ['risultati', 'Risultati di gara', 'artistica'], ['saggio', 'Saggio di fine anno', 'ritmica'],
  ['reel', 'Reel highlight', 'judo'], ['compleanno', 'Buon compleanno', 'fitness'], ['openday', 'Open day', 'palestra'],
];
const FEATURES = [
  ['film', 'Timeline multitraccia', 'Taglia, dividi, sposta e velocizza clip video, foto, testi e audio.'],
  ['wand-sparkles', '40 filtri e 20 effetti', 'Glitch, VHS, coriandoli, stelline, chroma key per il green screen.'],
  ['blend', '32 transizioni', 'Dissolvenze, tendine, cerchio, cuore, vortice, porte, pixel e glitch.'],
  ['type', '36 stili di testo', 'Neon, oro, fumetto, gradiente, con animazioni parola per parola.'],
  ['mic', 'Voce fuori campo', 'Registra mentre il video scorre e applica 12 effetti voce.'],
  ['music', 'Musica ed effetti sonori', '6 basi musicali e 18 effetti generati, senza diritti d\'autore.'],
  ['layout-template', 'Modelli pronti', 'Grafiche con nome, logo e contatti della società già inseriti.'],
  ['download', 'Esporta per i social', 'MP4 per Instagram, TikTok, WhatsApp e YouTube; PNG, JPG e PDF.'],
];

export default {
  title: 'Salto Studio',
  async render(root) {
    const open = payload => window.athlos.system.openStudio(payload);
    const recent = await window.athlos.studio.recent().catch(() => []);
    root.innerHTML = `
      <section class="hero" style="min-height:260px">
        <div class="hero-bg" style="background-image:url('assets/images/studio.webp')"></div>
        <div><div class="hero-date">Salto Studio · editor video e grafica</div><h1>Video e grafiche<br>da far invidia ✨</h1>
          <p>Montaggio a timeline come CapCut e design di post come Canva, in un'unica finestra. Tutto in locale, senza abbonamenti e senza filigrane.</p>
          <div class="actions"><button class="btn primary lg" id="openSt">${icon('clapperboard', 18)}Apri Salto Studio</button></div></div>
        <div class="hero-side"><div class="hero-pill"><b>14</b><span>Modelli pronti</span></div><div class="hero-pill"><b>10.000+</b><span>Combinazioni creative</span></div></div>
      </section>
      <h2 class="section-title" style="margin-top:30px">${icon('plus', 20)}Crea un nuovo progetto</h2>
      <div class="grid g6">${FORMATS.map(([id, n, r, ic]) => `<button class="quick" data-fmt="${id}" style="--g:var(--grad);align-items:center;text-align:center"><span class="q-ico">${icon(ic, 18)}</span><b>${esc(n)}</b><small>${esc(r)}</small></button>`).join('')}</div>
      <h2 class="section-title mt-lg">${icon('layout-template', 20)}Parti da un modello</h2>
      <div class="grid g3">${TEMPLATES.map(([id, n, img]) => `<div class="card module-tile hoverable" data-tpl="${id}"><div class="mt-img"><img src="assets/images/${img}.webp" alt=""><span class="chip plain">${icon('sparkles', 13)} Modello</span></div><div class="mt-body"><h3>${esc(n)}</h3><p>Con il nome e il logo della tua società</p></div></div>`).join('')}</div>
      ${recent.length ? `<h2 class="section-title mt-lg">${icon('history', 20)}Progetti recenti</h2>
        <div class="grid g4">${recent.slice(0, 8).map(p => `<div class="card hoverable" style="overflow:hidden" data-open="${esc(p.path)}">${p.thumb ? `<img src="${esc(p.thumb)}" style="width:100%;aspect-ratio:16/10;object-fit:cover;background:#000">` : '<div style="aspect-ratio:16/10;background:var(--surface-3)"></div>'}<div style="padding:12px 14px"><b>${esc(p.name)}</b><div class="small muted">${relTime(p.mtime)}</div></div></div>`).join('')}</div>` : ''}
      <h2 class="section-title mt-lg">${icon('star', 20)}Cosa puoi fare</h2>
      <div class="grid g4">${FEATURES.map(([ic, t, d]) => `<div class="card pad-sm"><div class="row"><span class="modal-ico" style="width:38px;height:38px">${icon(ic, 18)}</span><b>${esc(t)}</b></div><p class="small muted" style="margin-top:8px">${esc(d)}</p></div>`).join('')}</div>`;
    root.querySelector('#openSt').onclick = () => open();
    on(root, 'click', '[data-fmt]', (e, t) => open({ newFormat: t.dataset.fmt }));
    on(root, 'click', '[data-tpl]', (e, t) => open({ template: t.dataset.tpl }));
    on(root, 'click', '[data-open]', (e, t) => open({ open: t.dataset.open }));
  },
};
