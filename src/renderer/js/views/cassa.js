// Chiusura di cassa giornaliera e riepilogo mensile, per sede, con uscite e note scritte a mano.
import { db } from '../lib/db.js';
import { icon, on, $, toast, countUp, emptyState, confirmDialog } from '../lib/ui.js';
import { go } from '../lib/router.js';
import { esc, euro, date, todayISO, MESI, debounce, uid } from '../lib/format.js';
import { day, month, sedeLabel } from '../lib/cassa.js';
import { dailyHTML, monthlyHTML } from '../print/cassa.js';
import { printDocument } from '../print/documents.js';
import { toCSV } from '../lib/csv.js';

const st = { mode: 'giorno', data: todayISO(), mese: todayISO().slice(0, 7), sede: null };

const v = n => (Number(n) ? euro(n) : '<span class="muted">–</span>');

export default {
  title: 'Chiusura di cassa',
  render(root, params, query) {
    if (st.sede === null) st.sede = (db.mainSede() || {}).id || '';
    if (query.data) { st.data = query.data; st.mode = 'giorno'; }
    const sedi = db.sedi();

    root.innerHTML = `
      <div class="page-head">
        <div><div class="eyebrow">Cassa</div><h1>Chiusura di cassa</h1><p>Il foglio di fine giornata si compila da solo con le ricevute: aggiungi solo uscite e note.</p></div>
        <div class="actions">
          <button class="btn" id="csv">${icon('file-spreadsheet', 16)}Esporta</button>
          <button class="btn" id="pdf">${icon('file-down', 16)}PDF</button>
          <button class="btn primary" id="prt">${icon('printer', 16)}Stampa</button>
        </div>
      </div>
      <div class="toolbar cassa-bar">
        <div class="seg" id="mode"><button data-m="giorno">${icon('calendar-days', 15)}Giornaliera</button><button data-m="mese">${icon('calendar-days', 15)}Mensile</button></div>
        <select class="input" id="sede" style="width:auto">${sedi.length > 1 ? '<option value="">Tutte le sedi</option>' : ''}${sedi.map(s => `<option value="${s.id}">${esc(s.nome || s.comune)}${s.comune && s.nome ? ` · ${esc(s.comune)}` : ''}</option>`).join('') || '<option value="">Sede principale</option>'}</select>
        <div class="row" style="gap:6px"><button class="btn icon" id="prev">${icon('chevron-left', 18)}</button><input class="input" id="when" style="width:auto"><button class="btn icon" id="next">${icon('chevron-right', 18)}</button><button class="btn ghost" id="today">Oggi</button></div>
      </div>
      <div id="body"></div>`;

    const body = $('#body', root);

    const draw = () => {
      root.querySelectorAll('#mode [data-m]').forEach(b => b.classList.toggle('active', b.dataset.m === st.mode));
      const when = $('#when', root);
      when.type = st.mode === 'giorno' ? 'date' : 'month';
      when.value = st.mode === 'giorno' ? st.data : st.mese;
      $('#sede', root).value = st.sede;
      if (st.mode === 'giorno') drawDay(); else drawMonth();
    };

    const tiles = s => `<div class="grid g5 cassa-tiles">
      ${[['Contante (a)', s.a, 'banknote', '#10B981'], ['POS (b)', s.b, 'credit-card', '#6366F1'], ['Bonifico', s.bonifico, 'landmark', '#0EA5E9'], ['Ricavi del giorno (c)', s.c, 'trending-up', '#8B5CF6'], ['Cassa contanti (n)', s.n, 'wallet', '#F97316']]
        .map(([l, n, ic, col]) => `<div class="stat" style="--g:${col}"><div class="stat-ico" style="background:${col}">${icon(ic, 18)}</div><div class="stat-val" data-money="${n}">${euro(n)}</div><div class="stat-lbl">${l}</div></div>`).join('')}</div>`;

    const riepilogo = s => `<div class="card pad"><div class="card-head"><h3>Riepilogo complessivo</h3></div>
      <div class="grid g2 cassa-sum">
        <div>${[['a)', 'Totale contante', s.a], ['b)', 'Totale POS', s.b], ['c = (a + b)', 'Totale ricavi del giorno', s.c, 1], ['d)', 'Totale quota corso', s.d], ['e)', 'Totale quota saggio', s.e], ['f = (d + e)', 'Tot. corrispettivi istituzionali', s.f, 1]].map(row).join('')}</div>
        <div>${[['g)', 'Tot. quote iscrizione', s.g], ['h)', 'Totale quote tesseramento', s.h], ['i = (g + h)', 'Tot. quote iscriz. e tess.', s.i, 1], ['l)', 'Totale corrispettivi commerciali', s.l, 1], ['m)', 'Totale uscite', s.m], ['n = (a − m)', 'Totale cassa contanti', s.n, 1]].map(row).join('')}</div>
      </div></div>`;
    const row = ([k, l, n, strong]) => `<div class="cs-row ${strong ? 'strong' : ''}"><span class="k">${k}</span><span class="l">${l}</span><b>${v(n)}</b></div>`;

    const drawDay = () => {
      const d = day(st.data, st.sede);
      const s = d.sum;
      const cl = d.closure;
      body.innerHTML = `
        ${tiles(s)}
        <div class="card cassa-sheet mt-lg">
          <div class="card-head" style="padding:16px 18px 6px"><h3>Sede: ${esc(sedeLabel(st.sede))} · ${date(st.data, 'long')}</h3><span class="muted small">${d.rows.length} ricevute</span></div>
          ${d.rows.length ? `<div class="table-wrap"><table class="table cassa-table"><thead><tr><th>N.</th><th>Cognome e nome</th><th class="num">Bonifico</th><th class="num">Contante</th><th class="num">POS</th><th class="num">Quote corso</th><th class="num">Saggio/gare</th><th class="num">Iscrizione</th><th class="num">Tesseram.</th><th class="num">Corrisp. comm.</th><th>Note</th><th>Ricevuta</th></tr></thead>
            <tbody>${d.rows.map(r => `<tr class="click" data-rec="${r.id}"><td>${r.n}</td><td><b>${esc(r.nome)}</b></td><td class="num">${v(r.bonifico)}</td><td class="num">${v(r.contante)}</td><td class="num">${v(r.pos)}</td><td class="num">${v(r.corso)}</td><td class="num">${v(r.saggio)}</td><td class="num">${v(r.iscrizione)}</td><td class="num">${v(r.tesseramento)}</td><td class="num">${v(r.commerciale)}</td><td class="small">${esc(r.note)}</td><td><span class="badge ${r.tipo === 'commerciale' ? 'info' : 'accent'}">${esc(r.ricevuta)}</span></td></tr>`).join('')}</tbody>
            <tfoot><tr><td></td><td><b>Totale</b></td>${['bonifico', 'contante', 'pos', 'corso', 'saggio', 'iscrizione', 'tesseramento', 'commerciale'].map(k => `<td class="num"><b>${v(s.totals[k])}</b></td>`).join('')}<td></td><td></td></tr></tfoot></table></div>`
            : `<div style="padding:10px 18px 22px">${emptyState({ icon: 'receipt-text', title: 'Nessuna ricevuta in questa giornata', text: 'Le ricevute emesse oggi compaiono qui da sole, divise per metodo di pagamento e tipo di quota.', action: { label: 'Nuova ricevuta', icon: 'plus' } })}</div>`}
        </div>
        <div class="grid cassa-cols mt-lg">
          ${riepilogo(s)}
          <div class="card pad"><div class="card-head"><h3>Uscite e note del giorno</h3><span class="muted small">Si scrivono a mano</span></div>
            <div class="col" style="gap:8px" id="usc">${(cl.uscite || []).map(u => `<div class="cs-out"><span>${esc(u.descrizione || 'Uscita')}</span><b>${euro(u.importo)}</b><button class="btn icon sm ghost" data-delu="${u.id}">${icon('trash-2', 15)}</button></div>`).join('') || '<p class="muted small">Nessuna uscita registrata.</p>'}</div>
            <div class="cs-add mt"><input class="input" id="ud" placeholder="Descrizione (es. acquisto gessetti)"><div class="input-icon">${icon('euro', 15)}<input class="input" id="ui" type="number" step="0.01" min="0" placeholder="0,00"></div><button class="btn" id="uadd">${icon('plus', 15)}Aggiungi</button></div>
            <label class="field mt"><span>Note del giorno</span><textarea id="note" placeholder="Annotazioni sulla chiusura di cassa">${esc(cl.note || '')}</textarea></label>
          </div>
        </div>`;
      body.querySelectorAll('[data-money]').forEach(e => countUp(e, Number(e.dataset.money), { format: x => euro(x) }));
      const add = async () => {
        const descrizione = $('#ud', body).value.trim();
        const importo = Number($('#ui', body).value) || 0;
        if (!importo) { toast('Scrivi l\'importo dell\'uscita', { type: 'warning' }); return; }
        await db.saveClosure(st.data, st.sede, { uscite: [...(cl.uscite || []), { id: uid('u-'), descrizione, importo }] });
        toast('Uscita registrata');
        drawDay();
      };
      $('#uadd', body).onclick = add;
      $('#ui', body).addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
      $('#note', body).addEventListener('input', debounce(e => db.saveClosure(st.data, st.sede, { note: e.target.value }), 400));
      on(body, 'click', '[data-delu]', async (e, t) => {
        if (!(await confirmDialog('Eliminare questa uscita?', { danger: true, okLabel: 'Elimina' }))) return;
        await db.saveClosure(st.data, st.sede, { uscite: (cl.uscite || []).filter(u => u.id !== t.dataset.delu) });
        drawDay();
      });
      on(body, 'click', '[data-rec]', (e, t) => go(`/ricevute?apri=${t.dataset.rec}`));
      const ea = body.querySelector('[data-empty-act]');
      if (ea) ea.onclick = () => go('/ricevute/nuova');
    };

    const drawMonth = () => {
      const [y, m] = st.mese.split('-').map(Number);
      const d = month(y, m, st.sede);
      const s = d.sum;
      body.innerHTML = `
        ${tiles(s)}
        <div class="card cassa-sheet mt-lg">
          <div class="card-head" style="padding:16px 18px 6px"><h3>Sede: ${esc(sedeLabel(st.sede))} · ${MESI[m - 1]} ${y}</h3><span class="muted small">${d.count} ricevute in ${d.days.length} giorni</span></div>
          ${d.days.length ? `<div class="table-wrap"><table class="table cassa-table"><thead><tr><th>Giorno</th><th class="num">Ricevute</th><th class="num">Bonifico</th><th class="num">Contante</th><th class="num">POS</th><th class="num">Quote corso</th><th class="num">Saggio/gare</th><th class="num">Iscrizioni</th><th class="num">Tesseram.</th><th class="num">Corrisp. comm.</th><th class="num">Uscite</th><th class="num">Cassa contanti</th></tr></thead>
            <tbody>${d.days.map(g => `<tr class="click" data-day="${g.iso}"><td><b>${date(g.iso)}</b>${g.note ? ` <span class="badge" title="${esc(g.note)}">nota</span>` : ''}</td><td class="num">${g.count}</td><td class="num">${v(g.sum.bonifico)}</td><td class="num">${v(g.sum.a)}</td><td class="num">${v(g.sum.b)}</td><td class="num">${v(g.sum.d)}</td><td class="num">${v(g.sum.e)}</td><td class="num">${v(g.sum.g)}</td><td class="num">${v(g.sum.h)}</td><td class="num">${v(g.sum.l)}</td><td class="num">${v(g.sum.m)}</td><td class="num"><b>${euro(g.sum.n)}</b></td></tr>`).join('')}</tbody>
            <tfoot><tr><td><b>Totale mese</b></td><td class="num"><b>${d.count}</b></td>${[s.bonifico, s.a, s.b, s.d, s.e, s.g, s.h, s.l, s.m, s.n].map(n => `<td class="num"><b>${v(n)}</b></td>`).join('')}</tr></tfoot></table></div>`
            : `<div style="padding:10px 18px 22px">${emptyState({ icon: 'calendar-days', title: 'Nessun movimento nel mese', text: 'Scegli un altro mese o un\'altra sede.' })}</div>`}
        </div>
        <div class="grid cassa-cols mt-lg">${riepilogo(s)}
          <div class="card pad"><div class="card-head"><h3>Uscite del mese</h3></div>
            ${d.uscite.length ? `<div class="col" style="gap:8px">${d.uscite.map(u => `<div class="cs-out"><span><b>${date(u.iso)}</b> · ${esc(u.descrizione || 'Uscita')}</span><b>${euro(u.importo)}</b></div>`).join('')}</div>` : '<p class="muted small">Nessuna uscita nel mese.</p>'}
          </div></div>`;
      body.querySelectorAll('[data-money]').forEach(e => countUp(e, Number(e.dataset.money), { format: x => euro(x) }));
      on(body, 'click', '[data-day]', (e, t) => { st.mode = 'giorno'; st.data = t.dataset.day; draw(); });
    };

    const html = () => {
      if (st.mode === 'giorno') return dailyHTML(st.data, st.sede, day(st.data, st.sede));
      const [y, m] = st.mese.split('-').map(Number);
      return monthlyHTML(y, m, st.sede, month(y, m, st.sede));
    };
    const title = () => (st.mode === 'giorno' ? `Chiusura di cassa ${date(st.data)}` : `Riepilogo cassa ${st.mese}`);

    on(root, 'click', '#mode [data-m]', (e, t) => { st.mode = t.dataset.m; draw(); });
    $('#sede', root).onchange = e => { st.sede = e.target.value; draw(); };
    $('#when', root).onchange = e => { if (!e.target.value) return; if (st.mode === 'giorno') st.data = e.target.value; else st.mese = e.target.value; draw(); };
    const shift = k => {
      if (st.mode === 'giorno') { const d = new Date(st.data + 'T00:00:00'); d.setDate(d.getDate() + k); st.data = d.toISOString().slice(0, 10) === st.data ? st.data : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
      else { const [y, m] = st.mese.split('-').map(Number); const d = new Date(y, m - 1 + k, 1); st.mese = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
      draw();
    };
    $('#prev', root).onclick = () => shift(-1);
    $('#next', root).onclick = () => shift(1);
    $('#today', root).onclick = () => { st.data = todayISO(); st.mese = st.data.slice(0, 7); draw(); };
    $('#prt', root).onclick = () => printDocument(html(), { title: title(), landscape: true, pageSize: 'A4' });
    $('#pdf', root).onclick = () => window.athlos.print.pdf({ html: html(), defaultName: title(), pageSize: 'A4', landscape: true });
    $('#csv', root).onclick = async () => {
      let rows;
      if (st.mode === 'giorno') {
        const d = day(st.data, st.sede);
        rows = [['N.', 'Cognome e nome', 'Bonifico', 'Contante', 'POS', 'Quote corso', 'Quota saggio/gare', 'Quote iscrizione', 'Quote tesseram.', 'Corrisp. comm.', 'Note', 'Ricevuta'],
          ...d.rows.map(r => [r.n, r.nome, r.bonifico, r.contante, r.pos, r.corso, r.saggio, r.iscrizione, r.tesseramento, r.commerciale, r.note, r.ricevuta].map(x => (typeof x === 'number' ? String(x).replace('.', ',') : x)))];
      } else {
        const [y, m] = st.mese.split('-').map(Number);
        const d = month(y, m, st.sede);
        rows = [['Data', 'Ricevute', 'Bonifico', 'Contante', 'POS', 'Quote corso', 'Saggio/gare', 'Iscrizioni', 'Tesseram.', 'Corrisp. comm.', 'Uscite', 'Cassa contanti'],
          ...d.days.map(g => [date(g.iso), g.count, g.sum.bonifico, g.sum.a, g.sum.b, g.sum.d, g.sum.e, g.sum.g, g.sum.h, g.sum.l, g.sum.m, g.sum.n].map(x => (typeof x === 'number' ? String(x).replace('.', ',') : x)))];
      }
      const p = await window.athlos.file.save({ defaultName: `${title()}.csv`, filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }], text: toCSV(rows), reveal: true });
      if (p) toast('Esportato: si apre con Excel');
    };

    draw();
  },
};
