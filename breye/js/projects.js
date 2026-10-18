/* Projects library */
(function () {
  'use strict';
  const B = window.B;
  B.view('projects', {
    title: 'Progetti', icon: 'FolderOpen', group: 'more', desc: 'Tutto quello che hai creato',
    mount(el) {
      let filter = 'all', q = '';
      const page = B.h('div', { class: 'page' }), inner = B.h('div', { class: 'page-in' });
      page.append(inner); el.append(page);
      const search = B.h('input', { class: 'input', id: 'projSearch', placeholder: 'Cerca nei progetti', style: 'max-width:280px' });
      const seg = B.h('div', { class: 'seg' });
      [['all', 'Tutti']].concat(Object.entries(B.projects.TYPES).map(([k, v]) => [k, v[0]])).forEach(([k, l]) => seg.append(B.h('button', { class: k === filter ? 'on' : '', 'data-f': k, type: 'button', onclick: () => { filter = k; B.$$('button', seg).forEach((b) => b.classList.toggle('on', b.dataset.f === k)); render(); } }, l)));
      inner.append(B.h('div', { class: 'page-head' }, B.h('div', null, B.h('span', { class: 'eyebrow', text: 'Libreria' }), B.h('h1', { text: 'Progetti' }), B.h('p', { text: 'Design, foto, video, codice e documenti salvati in questo browser. Esporta i progetti importanti per conservarli.' })), search));
      inner.append(B.h('div', { style: 'overflow-x:auto' }, seg));
      const list = B.h('div'); inner.append(list);
      search.addEventListener('input', () => { q = search.value.toLowerCase(); render(); });
      async function render() {
        const all = (await B.projects.list()).filter((p) => (filter === 'all' || p.type === filter) && (!q || (p.name || '').toLowerCase().includes(q)));
        list.innerHTML = '';
        if (!all.length) { list.append(B.h('div', { class: 'card empty' }, B.h('span', { 'data-i': 'FolderOpen' }), B.h('b', { text: 'Nessun progetto' }), B.h('span', { text: 'Crea un design, una foto o un video: li ritroverai qui.' }))); B.hydrateIcons(list); return; }
        const g = B.h('div', { class: 'recent-grid' });
        all.forEach((p) => {
          const card = B.projectCard(p);
          card.addEventListener('contextmenu', (e) => { e.preventDefault(); menu(p, { x: e.clientX, y: e.clientY }); });
          const more = B.h('button', { class: 'btn icon sm ghost', 'aria-label': 'Altre azioni', style: 'position:absolute;top:8px;right:8px;background:var(--panel)', 'data-i': 'MoreHorizontal', onclick: (e) => { e.stopPropagation(); menu(p, e.currentTarget); } });
          const wrap = B.h('div', { style: 'position:relative' }, card, more);
          g.append(wrap);
        });
        list.append(g); B.hydrateIcons(list);
      }
      function menu(p, at) {
        B.menu(at, [
          { label: 'Apri', icon: 'FolderOpen', fn: () => B.projects.open(p) },
          { label: 'Rinomina', icon: 'Pencil', fn: async () => { const n = await B.prompt('Rinomina progetto', p.name); if (n) { p.name = n; await B.projects.save(p); } } },
          { label: 'Duplica', icon: 'Copy', fn: async () => { const c = JSON.parse(JSON.stringify(p)); c.id = B.uid('p'); c.name = p.name + ' (copia)'; c.created = 0; await B.projects.save(c); B.toast('Progetto duplicato', 'ok'); } },
          { label: 'Esporta file progetto', icon: 'Download', fn: () => B.save(new Blob([JSON.stringify(p)], { type: 'application/json' }), B.slug(p.name) + '.breye.json') },
          '-',
          { label: 'Elimina', icon: 'Trash2', fn: async () => { if (await B.confirm('Eliminare “' + p.name + '”?', 'Il progetto verrà rimosso da questo browser. Non si può annullare.', 'Elimina', true)) { await B.projects.remove(p.id); B.toast('Progetto eliminato'); } } }
        ]);
      }
      inner.append(B.h('div', { class: 'chips' },
        B.h('button', { class: 'btn', type: 'button', onclick: importProj }, B.h('span', { 'data-i': 'Upload' }), 'Importa file progetto')));
      async function importProj() {
        const [f] = await B.pickFiles('.json,application/json'); if (!f) return;
        try { const p = JSON.parse(await f.text()); if (!p.type || !p.data) throw new Error('formato'); p.id = B.uid('p'); await B.projects.save(p); B.toast('Progetto importato', 'ok'); } catch (e) { B.toast('File non valido: serve un .breye.json esportato da Breye', 'err'); }
      }
      B.on('projects', render); render();
    }
  });
})();
