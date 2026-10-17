// Discipline praticate: colori, icone, immagini di copertina, quote e numero di iscritti.
import { db } from '../lib/db.js';
import { icon, on, $, $$, modal, toast, confirmDialog, pickImage } from '../lib/ui.js';
import { go } from '../lib/router.js';
import { esc, euro, uid } from '../lib/format.js';

const COLORS = ['#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#E11D48', '#F97316', '#EAB308', '#10B981', '#14B8A6', '#0EA5E9', '#3B82F6', '#64748B'];
const ICONS = ['medal', 'trophy', 'sparkles', 'shield', 'wand-sparkles', 'heart-pulse', 'dumbbell', 'activity', 'flame', 'zap', 'star', 'award', 'gem', 'crown', 'music', 'waves', 'baby', 'users', 'rocket', 'infinity', 'circle-dot', 'target', 'timer', 'sun'];
const IMAGES = ['artistica', 'ritmica', 'judo', 'aerea', 'fitness', 'palestra', 'team', 'studio'];

function cover(d) {
  if (d.immagineCustom) return window.athlos.media.url(d.immagineCustom);
  return `assets/images/${d.immagine || 'palestra'}.webp`;
}

export default {
  title: 'Discipline',
  render(root) {
    const draw = () => {
      root.innerHTML = `
        <div class="page-head"><div><div class="eyebrow">Corsi e attività</div><h1>Discipline</h1><p>Le discipline praticate dalla società. Le quote vengono proposte in automatico nelle ricevute.</p></div>
          <div class="actions"><button class="btn primary" id="add">${icon('plus', 16)}Nuova disciplina</button></div></div>
        <div class="disc-grid">
          ${db.disciplines.map((d, i) => {
            const n = db.clients.filter(c => (c.discipline || []).includes(d.id) && c.stato !== 'sospeso').length;
            return `<div class="card disc-card hoverable ${d.attiva === false ? 'off' : ''}" style="--dc:${d.colore};animation-delay:${i * 0.05}s;${d.attiva === false ? 'opacity:.55' : ''}" data-edit="${d.id}">
              <div class="disc-cover"><div class="disc-img"><img src="${cover(d)}" alt=""></div><span class="disc-count">${n} ${n === 1 ? 'atleta' : 'atleti'}</span><span class="disc-ico">${icon(d.icona || 'trophy', 24)}</span></div>
              <div class="disc-body">
                <div class="row between"><h3>${esc(d.nome)}</h3>${d.attiva === false ? '<span class="badge">Disattivata</span>' : ''}</div>
                <p>${esc(d.descrizione || '')}</p>
                <div class="disc-meta">
                  <span class="badge accent">${icon('euro', 12)}${euro(d.quotaMensile)} / mese</span>
                  <span class="badge">${icon('id-card', 12)}Iscrizione ${euro(d.quotaIscrizione)}</span>
                  ${d.federazione ? `<span class="badge info">${esc(d.federazione)}</span>` : ''}
                </div>
                <div class="row mt" style="gap:8px"><button class="btn sm" data-athletes="${d.id}">${icon('users', 15)}Vedi atleti</button><button class="btn sm ghost" data-edit="${d.id}">${icon('pencil', 15)}Modifica</button></div>
              </div>
            </div>`;
          }).join('')}
          <button class="card disc-add" id="add2"><div style="text-align:center">${icon('circle-plus', 40)}<h3 style="margin-top:10px">Aggiungi disciplina</h3><p class="small">Es. Pilates, Parkour, Danza</p></div></button>
        </div>`;
      $('#add', root).onclick = () => edit(null, draw);
      $('#add2', root).onclick = () => edit(null, draw);
    };
    on(root, 'click', '[data-athletes]', (e, t) => { e.stopPropagation(); go(`/atleti?disciplina=${t.dataset.athletes}`); });
    on(root, 'click', '[data-edit]', (e, t) => { if (e.target.closest('[data-athletes]')) return; edit(db.discipline(t.dataset.edit), draw); });
    draw();
    return db.on('disciplines', draw);
  },
};

function edit(d, after) {
  const x = d ? JSON.parse(JSON.stringify(d)) : { id: uid('d-'), nome: '', descrizione: '', colore: COLORS[Math.floor(Math.random() * COLORS.length)], icona: 'trophy', immagine: 'palestra', federazione: '', quotaMensile: 40, quotaIscrizione: 25, attiva: true };
  const m = modal({
    title: d ? `Modifica ${d.nome}` : 'Nuova disciplina', icon: x.icona, size: 'lg',
    body: `<div class="grid" style="grid-template-columns:1fr 300px;gap:22px">
      <div class="col" style="gap:14px">
        <label class="field"><span>Nome</span><input id="n" value="${esc(x.nome)}" placeholder="Es. Ginnastica artistica"></label>
        <label class="field"><span>Descrizione</span><input id="ds" value="${esc(x.descrizione)}" placeholder="Breve descrizione"></label>
        <div class="grid g3">
          <label class="field"><span>Quota mensile €</span><input id="qm" type="number" step="0.5" value="${x.quotaMensile}"></label>
          <label class="field"><span>Quota iscrizione €</span><input id="qi" type="number" step="0.5" value="${x.quotaIscrizione}"></label>
          <label class="field"><span>Federazione / ente</span><input id="fe" value="${esc(x.federazione || '')}"></label>
        </div>
        <div class="field"><span>Colore</span><div class="color-swatches" id="cols">${COLORS.map(c => `<button style="background:${c}" data-c="${c}" class="${c === x.colore ? 'sel' : ''}"></button>`).join('')}</div></div>
        <div class="field"><span>Icona</span><div class="icon-picker" id="icos">${ICONS.map(i => `<button data-i="${i}" class="${i === x.icona ? 'sel' : ''}">${icon(i, 18)}</button>`).join('')}</div></div>
        <label class="switch"><input type="checkbox" id="att" ${x.attiva !== false ? 'checked' : ''}><i></i>Disciplina attiva</label>
      </div>
      <div class="col" style="gap:10px">
        <div class="field"><span>Immagine di copertina</span></div>
        <div class="disc-cover" style="height:170px;border-radius:16px;--dc:${x.colore}" id="cv"><img src="${cover(x)}" alt=""></div>
        <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:6px" id="imgs">${IMAGES.map(i => `<button data-img="${i}" style="height:44px;border-radius:9px;overflow:hidden;border:2px solid ${!x.immagineCustom && x.immagine === i ? 'var(--accent)' : 'transparent'};padding:0;cursor:pointer"><img src="assets/images/${i}.webp" style="width:100%;height:100%;object-fit:cover"></button>`).join('')}</div>
        <button class="btn sm" id="up">${icon('upload', 15)}Carica la tua foto</button>
      </div>
    </div>`,
    actions: [
      d ? { label: 'Elimina', kind: 'ghost', icon: 'trash-2', left: true, fn: async () => {
        const n = db.clients.filter(c => (c.discipline || []).includes(d.id)).length;
        const ok = await confirmDialog(n ? `${n} atleti sono iscritti a ${d.nome}: verranno tolti da questa disciplina. In alternativa puoi solo disattivarla.` : `Eliminare la disciplina ${d.nome}?`, { danger: true, okLabel: 'Elimina' });
        if (!ok) return false;
        db.all.disciplines = db.disciplines.filter(z => z.id !== d.id);
        db.clients.forEach(c => { c.discipline = (c.discipline || []).filter(id => id !== d.id); });
        await db.save('clients');
        await db.save('disciplines');
        toast('Disciplina eliminata', { type: 'info' });
        after();
        return true;
      } } : null,
      { label: 'Annulla', kind: 'ghost' },
      { label: 'Salva', kind: 'primary', icon: 'save', fn: async () => {
        x.nome = $('#n', m.body).value.trim();
        if (!x.nome) { toast('Dai un nome alla disciplina', { type: 'warning' }); return false; }
        x.descrizione = $('#ds', m.body).value.trim();
        x.quotaMensile = Number($('#qm', m.body).value) || 0;
        x.quotaIscrizione = Number($('#qi', m.body).value) || 0;
        x.federazione = $('#fe', m.body).value.trim();
        x.attiva = $('#att', m.body).checked;
        const i = db.disciplines.findIndex(z => z.id === x.id);
        if (i >= 0) db.disciplines[i] = x; else db.disciplines.push({ ...x, createdAt: new Date().toISOString() });
        await db.save('disciplines');
        db.log('discipline', `${d ? 'Aggiornata' : 'Aggiunta'} la disciplina ${x.nome}`);
        toast('Disciplina salvata');
        after();
        return true;
      } },
    ].filter(Boolean),
  });
  const refreshCover = () => { $('#cv', m.body).style.setProperty('--dc', x.colore); $('#cv img', m.body).src = cover(x); };
  on(m.body, 'click', '[data-c]', (e, t) => { x.colore = t.dataset.c; $$('[data-c]', m.body).forEach(b => b.classList.toggle('sel', b === t)); refreshCover(); });
  on(m.body, 'click', '[data-i]', (e, t) => { x.icona = t.dataset.i; $$('[data-i]', m.body).forEach(b => b.classList.toggle('sel', b === t)); });
  on(m.body, 'click', '[data-img]', (e, t) => { x.immagine = t.dataset.img; x.immagineCustom = ''; $$('[data-img]', m.body).forEach(b => { b.style.borderColor = b === t ? 'var(--accent)' : 'transparent'; }); refreshCover(); });
  $('#up', m.body).onclick = async () => { const n = await pickImage({ max: 1200, type: 'image/jpeg', quality: 0.85 }).catch(() => null); if (n) { x.immagineCustom = n; refreshCover(); } };
}
