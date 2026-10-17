// Nuova ricevuta: scelta atleta e intestatario, causali, mesi, anteprima in tempo reale, stampa e PDF.
import { db, PAYMENT_METHODS } from '../lib/db.js';
import { icon, avatar, on, $, $$, toast, modal, confetti } from '../lib/ui.js';
import { go } from '../lib/router.js';
import { esc, euro, todayISO, age, fullName, MESI_BREVI, debounce, date, phoneIntl } from '../lib/format.js';
import { euroInWords } from '../lib/words.js';
import { receiptHTML, needsBollo, monthLabel, companyName } from '../print/receipt.js';
import { printDocument, quickPrint } from '../print/documents.js';
import { discChips } from './atleti.js';

export default {
  title: 'Nuova ricevuta',
  render(root, params, query) {
    const r = {
      tipo: query.tipo === 'commerciale' ? 'commerciale' : 'generale',
      data: todayISO(),
      clientId: query.cliente || null,
      payerMode: 'auto',
      altro: { nome: '', cognome: '', codiceFiscale: '' },
      metodo: PAYMENT_METHODS[0],
      disciplinaId: '',
      mesi: [],
      righe: [],
      detrazione: false,
      bollo: false,
      note: '',
      bolloTouched: false,
      detrTouched: false,
    };
    let yearView = new Date().getFullYear();
    if (/^\d{4}-\d{2}$/.test(query.mese || '')) { r.mesi = [query.mese]; yearView = Number(query.mese.slice(0, 4)); }

    root.innerHTML = `
      <div class="crumbs"><a data-go="/ricevute">Ricevute</a>${icon('chevron-right', 14)}<span>Nuova</span></div>
      <div class="page-head"><div><h1>Nuova ricevuta</h1><p>Compila a sinistra, l'anteprima si aggiorna a destra in tempo reale.</p></div>
        <div class="actions"><button class="btn ghost" data-go="/ricevute">Annulla</button></div></div>
      <div class="receipt-editor">
        <div class="col" style="gap:16px">
          <div class="card pad">
            <div class="form-section"><h3><span class="ico-box">${icon('hash', 17)}</span>Tipo di ricevuta</h3>
              <div class="type-pick" id="typePick"></div>
            </div>
          </div>
          <div class="card pad">
            <div class="form-section"><h3><span class="ico-box">${icon('user', 17)}</span>Atleta e intestatario</h3>
              <div id="who"></div>
            </div>
          </div>
          <div class="card pad">
            <div class="form-section"><h3><span class="ico-box">${icon('calendar-days', 17)}</span>Data, pagamento e periodo</h3>
              <div class="grid g2">
                <label class="field"><span>Data ricevuta</span><input type="date" id="data" value="${r.data}"></label>
                <label class="field"><span>Metodo di pagamento</span><select id="metodo">${PAYMENT_METHODS.map(m => `<option>${m}</option>`).join('')}</select></label>
                <label class="field span-all"><span>Disciplina</span><select id="disc"></select></label>
              </div>
              <div class="row between mt"><b class="small">Mesi di riferimento</b>
                <div class="row"><button class="btn icon sm ghost" id="yPrev">${icon('chevron-left', 16)}</button><b id="yLbl"></b><button class="btn icon sm ghost" id="yNext">${icon('chevron-right', 16)}</button></div></div>
              <div class="month-pick mt" id="months" style="margin-top:8px"></div>
            </div>
          </div>
          <div class="card pad">
            <div class="form-section"><h3><span class="ico-box">${icon('receipt-text', 17)}</span>Causali e importi</h3>
              <div class="chips" id="presets" style="margin-bottom:12px"></div>
              <div class="receipt-lines" id="lines"></div>
              <button class="btn sm ghost mt" id="addLine">${icon('plus', 15)}Aggiungi riga</button>
              <div class="receipt-total"><div><div class="tiny" style="opacity:.8;letter-spacing:.1em;text-transform:uppercase;font-weight:800">Totale</div><div class="small" id="words" style="opacity:.9"></div></div><b id="tot">0,00 €</b></div>
            </div>
            <div class="col" style="gap:12px;margin-top:6px">
              <label class="switch"><input type="checkbox" id="detr"><i></i><span>Dicitura per detrazione fiscale 19% (atleti 5–18 anni)</span></label>
              <label class="switch"><input type="checkbox" id="bollo"><i></i><span id="bolloLbl">Marca da bollo</span></label>
              <label class="field"><span>Note (facoltative)</span><input id="note" placeholder="Es. saldo quota trimestrale"></label>
            </div>
          </div>
          <div class="row" style="justify-content:flex-end;gap:10px;flex-wrap:wrap">
            <button class="btn" data-save="pdf">${icon('file-down', 16)}Salva e PDF</button>
            <button class="btn" data-save="save">${icon('save', 16)}Salva</button>
            <button class="btn primary lg" data-save="print">${icon('printer', 18)}Salva e stampa</button>
          </div>
        </div>
        <div class="paper-wrap">
          <div class="row between" style="margin-bottom:10px"><b>Anteprima</b><span class="muted small" id="fmtLbl"></span></div>
          <div class="paper"><iframe id="preview" style="height:calc(100vh - 210px);min-height:640px"></iframe></div>
        </div>
      </div>`;

    $('#fmtLbl', root).textContent = `Formato ${db.settings.printer.formato}${db.settings.printer.doppiaCopia ? ' · originale + copia' : ''}`;

    const client = () => (r.clientId ? db.client(r.clientId) : null);

    const payer = () => {
      const c = client();
      if (r.payerMode === 'altro' || !c) return { ...r.altro };
      const useParent = r.payerMode === 'genitore' || (r.payerMode === 'auto' && c.genitore && c.genitore.nome && age(c.dataNascita) !== null && age(c.dataNascita) < 18);
      if (useParent && c.genitore) return { nome: c.genitore.nome, cognome: c.genitore.cognome, codiceFiscale: c.genitore.codiceFiscale, residenza: c.residenza };
      return { nome: c.nome, cognome: c.cognome, codiceFiscale: c.codiceFiscale, residenza: c.residenza };
    };

    const build = () => {
      const c = client();
      const disc = db.discipline(r.disciplinaId);
      const righe = r.righe.filter(l => l.descrizione || Number(l.importo));
      const totale = righe.reduce((s, l) => s + (Number(l.importo) || 0), 0);
      return {
        tipo: r.tipo,
        data: r.data,
        anno: Number(r.data.slice(0, 4)),
        numero: db.nextReceiptNumber(r.tipo, Number(r.data.slice(0, 4))),
        clientId: c ? c.id : null,
        intestatario: payer(),
        atleta: c ? { nome: c.nome, cognome: c.cognome, codiceFiscale: c.codiceFiscale, dataNascita: c.dataNascita, luogoNascita: c.luogoNascita } : {},
        righe: righe.map(l => ({ descrizione: l.descrizione, importo: Math.round((Number(l.importo) || 0) * 100) / 100 })),
        totale: Math.round(totale * 100) / 100,
        metodo: r.metodo,
        mesi: [...r.mesi].sort(),
        disciplina: disc ? disc.nome : '',
        detrazione: r.detrazione,
        bollo: r.bollo,
        note: r.note,
      };
    };

    const updatePreview = debounce(async () => {
      const rec = build();
      const html = await receiptHTML(rec);
      const f = $('#preview', root);
      if (f) f.srcdoc = html;
    }, 150);

    const autoFlags = () => {
      const c = client();
      const a = c ? age(c.dataNascita, r.data) : null;
      if (!r.detrTouched) r.detrazione = db.settings.receipts.detrazioneAuto && r.tipo === 'generale' && a !== null && a >= 5 && a <= 18;
      const tot = build().totale;
      if (!r.bolloTouched) r.bollo = db.settings.receipts.bolloAuto && tot > Number(db.settings.receipts.bolloThreshold || 77.47);
      $('#detr', root).checked = r.detrazione;
      $('#bollo', root).checked = r.bollo;
      $('#bolloLbl', root).innerHTML = `Marca da bollo da € ${Number(db.settings.receipts.bolloAmount || 2).toFixed(2).replace('.', ',')} ${tot > Number(db.settings.receipts.bolloThreshold || 77.47) ? '<span class="badge warn">importo oltre 77,47 €</span>' : ''}`;
    };

    const renderType = () => {
      const y = Number(r.data.slice(0, 4));
      $('#typePick', root).innerHTML = ['generale', 'commerciale'].map(t => `<button data-type="${t}" class="${r.tipo === t ? 'sel' : ''}">
        <b>${t === 'generale' ? 'Generale' : 'Commerciale'}</b>
        <small>Prossimo numero</small><div class="series-num">N. ${db.nextReceiptNumber(t, y)}<span class="muted small">/${y}</span></div></button>`).join('');
    };

    const renderWho = () => {
      const c = client();
      const box = $('#who', root);
      if (!c) {
        box.innerHTML = `<div class="rel"><div class="input-icon">${icon('search', 18)}<input class="input" id="pick" placeholder="Cerca l'atleta per nome, cognome o codice fiscale…" autocomplete="off"></div><div class="ac-list hidden" id="acl"></div></div>
          <p class="muted small mt">Oppure intesta la ricevuta a una persona non in anagrafica:</p>
          <div class="grid g3 mt" style="margin-top:8px">
            <label class="field"><span>Nome</span><input data-altro="nome" value="${esc(r.altro.nome)}"></label>
            <label class="field"><span>Cognome</span><input data-altro="cognome" value="${esc(r.altro.cognome)}"></label>
            <label class="field"><span>Codice fiscale</span><input data-altro="codiceFiscale" class="mono upper" value="${esc(r.altro.codiceFiscale)}"></label>
          </div>`;
        const inp = $('#pick', box);
        const acl = $('#acl', box);
        let sel = 0;
        let res = [];
        const draw = () => {
          res = db.searchClients(inp.value).slice(0, 8);
          acl.classList.toggle('hidden', !inp.value.trim() || !res.length);
          acl.innerHTML = res.map((x, i) => `<div class="ac-item ${i === sel ? 'sel' : ''}" data-pick="${x.id}"><span class="row">${avatar(x, 28)}<b>${esc(fullName(x))}</b></span><small>${esc((x.discipline || []).map(id => db.discipline(id)?.nome).join(', '))}</small></div>`).join('');
        };
        inp.addEventListener('input', () => { sel = 0; draw(); });
        inp.addEventListener('keydown', e => {
          if (e.key === 'ArrowDown') { sel = Math.min(res.length - 1, sel + 1); draw(); e.preventDefault(); }
          if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
          if (e.key === 'Enter' && res[sel]) choose(res[sel].id);
        });
        on(acl, 'mousedown', '[data-pick]', (e, t) => choose(t.dataset.pick));
        setTimeout(() => inp.focus(), 80);
        return;
      }
      const a = age(c.dataNascita);
      const hasParent = c.genitore && c.genitore.nome;
      const mode = r.payerMode === 'auto' ? (hasParent && a !== null && a < 18 ? 'genitore' : 'atleta') : r.payerMode;
      box.innerHTML = `<div class="row" style="padding:12px;border-radius:14px;background:var(--surface-2);border:1px solid var(--line)">
          ${avatar(c, 48)}<div class="person grow"><div><b>${esc(fullName(c))}</b><small>${a ?? '–'} anni · ${esc(c.codiceFiscale || 'CF mancante')}</small><div class="chips" style="margin-top:6px">${discChips(c)}</div></div></div>
          <button class="btn sm ghost" id="change">${icon('refresh-cw', 15)}Cambia</button></div>
        <div class="row mt" style="justify-content:space-between;flex-wrap:wrap"><b class="small">Intestare la ricevuta a</b>
          <div class="seg" id="payerSeg">
            ${hasParent ? `<button data-v="genitore" class="${mode === 'genitore' ? 'active' : ''}">${icon('users', 15)}${esc(c.genitore.relazione || 'Genitore')}: ${esc(c.genitore.nome)}</button>` : ''}
            <button data-v="atleta" class="${mode === 'atleta' ? 'active' : ''}">${icon('user', 15)}Atleta</button>
            <button data-v="altro" class="${mode === 'altro' ? 'active' : ''}">${icon('pencil', 15)}Altra persona</button>
          </div></div>
        ${mode === 'altro' ? `<div class="grid g3 mt">
            <label class="field"><span>Nome</span><input data-altro="nome" value="${esc(r.altro.nome)}"></label>
            <label class="field"><span>Cognome</span><input data-altro="cognome" value="${esc(r.altro.cognome)}"></label>
            <label class="field"><span>Codice fiscale</span><input data-altro="codiceFiscale" class="mono upper" value="${esc(r.altro.codiceFiscale)}"></label></div>` : ''}
        ${!hasParent && a !== null && a < 18 ? `<div class="alert mt" style="--ac:var(--warn)"><span class="a-ico">${icon('triangle-alert', 18)}</span><div><b>Atleta minorenne senza genitore in anagrafica</b><small>Per la detrazione fiscale la ricevuta va intestata a chi paga. <a data-go="/atleti/${c.id}/modifica">Aggiungi il genitore</a></small></div></div>` : ''}`;
      $('#change', box).onclick = () => { r.clientId = null; r.payerMode = 'auto'; renderWho(); renderDisc(); autoFlags(); updatePreview(); };
      on($('#payerSeg', box), 'click', 'button', (e, t) => { r.payerMode = t.dataset.v; renderWho(); updatePreview(); });
    };

    const choose = id => {
      r.clientId = id;
      r.payerMode = 'auto';
      const c = client();
      r.disciplinaId = (c.discipline || [])[0] || '';
      renderWho();
      renderDisc();
      if (!r.righe.some(l => l.descrizione)) applyPreset(db.settings.receipts.causali.find(x => x.tipo === r.tipo) || db.settings.receipts.causali[0]);
      autoFlags();
      updatePreview();
    };

    const renderDisc = () => {
      const c = client();
      const ids = c && (c.discipline || []).length ? c.discipline : db.disciplines.map(d => d.id);
      $('#disc', root).innerHTML = `<option value="">— Nessuna —</option>` + ids.map(id => db.discipline(id)).filter(Boolean).map(d => `<option value="${d.id}" ${d.id === r.disciplinaId ? 'selected' : ''}>${esc(d.nome)} · quota ${euro(d.quotaMensile)}</option>`).join('');
    };

    const renderMonths = () => {
      $('#yLbl', root).textContent = yearView;
      $('#months', root).innerHTML = MESI_BREVI.map((m, i) => {
        const key = `${yearView}-${String(i + 1).padStart(2, '0')}`;
        return `<button data-m="${key}" class="${r.mesi.includes(key) ? 'sel' : ''}">${m}</button>`;
      }).join('');
    };

    const renderPresets = () => {
      const list = db.settings.receipts.causali.filter(x => x.tipo === r.tipo);
      $('#presets', root).innerHTML = list.map(x => `<button class="chip" style="--dc:${r.tipo === 'generale' ? '#7C4DFF' : '#0EA5E9'}" data-preset="${x.id}">${icon('plus', 12)}${esc(x.descrizione)}</button>`).join('');
    };

    const renderLines = () => {
      if (!r.righe.length) r.righe.push({ descrizione: '', importo: '' });
      $('#lines', root).innerHTML = r.righe.map((l, i) => `<div class="receipt-line">
        <input class="input" data-l="${i}" data-k="descrizione" placeholder="Causale (es. Quota mensile)" value="${esc(l.descrizione)}">
        <div class="input-icon">${icon('euro', 15)}<input class="input" data-l="${i}" data-k="importo" type="number" step="0.01" min="0" placeholder="0,00" value="${l.importo}"></div>
        <button class="btn icon sm ghost" data-del="${i}" data-tip="Rimuovi">${icon('trash-2', 15)}</button></div>`).join('');
      totals();
    };

    const totals = () => {
      const t = r.righe.reduce((s, l) => s + (Number(l.importo) || 0), 0);
      $('#tot', root).textContent = euro(t);
      $('#words', root).textContent = `euro ${euroInWords(t)}`;
      autoFlags();
    };

    const applyPreset = p => {
      if (!p) return;
      const disc = db.discipline(r.disciplinaId);
      let importo = Number(p.importo) || 0;
      let desc = p.descrizione;
      if (p.usaQuotaDisciplina && disc) {
        importo = Number(disc.quotaMensile || 0) * Math.max(1, r.mesi.length);
        desc = `${p.descrizione} – ${disc.nome}`;
      }
      const empty = r.righe.findIndex(l => !l.descrizione && !Number(l.importo));
      const line = { descrizione: desc, importo: importo ? importo.toFixed(2) : '', preset: p.id };
      if (empty >= 0) r.righe[empty] = line; else r.righe.push(line);
      renderLines();
      updatePreview();
    };

    // eventi
    on(root, 'click', '[data-go]', (e, t) => go(t.dataset.go));
    on(root, 'click', '[data-type]', (e, t) => {
      r.tipo = t.dataset.type;
      r.detrTouched = false;
      renderType(); renderPresets(); autoFlags(); updatePreview();
    });
    on(root, 'input', '[data-altro]', (e, t) => { r.altro[t.dataset.altro] = t.dataset.altro === 'codiceFiscale' ? t.value.toUpperCase() : t.value; updatePreview(); });
    $('#data', root).addEventListener('change', e => { r.data = e.target.value || todayISO(); renderType(); autoFlags(); updatePreview(); });
    $('#metodo', root).addEventListener('change', e => { r.metodo = e.target.value; updatePreview(); });
    $('#disc', root).addEventListener('change', e => {
      r.disciplinaId = e.target.value;
      // aggiorna le righe nate dalla quota della disciplina
      r.righe.forEach((l, i) => {
        const p = db.settings.receipts.causali.find(x => x.id === l.preset);
        if (p && p.usaQuotaDisciplina) { r.righe.splice(i, 1, { descrizione: '', importo: '' }); applyPreset(p); }
      });
      updatePreview();
    });
    $('#yPrev', root).onclick = () => { yearView--; renderMonths(); };
    $('#yNext', root).onclick = () => { yearView++; renderMonths(); };
    on(root, 'click', '[data-m]', (e, t) => {
      const k = t.dataset.m;
      r.mesi = r.mesi.includes(k) ? r.mesi.filter(x => x !== k) : [...r.mesi, k];
      renderMonths();
      r.righe.forEach((l, i) => {
        const p = db.settings.receipts.causali.find(x => x.id === l.preset);
        if (p && p.usaQuotaDisciplina) {
          const disc = db.discipline(r.disciplinaId);
          if (disc) r.righe[i].importo = (Number(disc.quotaMensile || 0) * Math.max(1, r.mesi.length)).toFixed(2);
        }
      });
      renderLines();
      updatePreview();
    });
    on(root, 'click', '[data-preset]', (e, t) => applyPreset(db.settings.receipts.causali.find(x => x.id === t.dataset.preset)));
    on(root, 'input', '[data-l]', (e, t) => {
      const l = r.righe[Number(t.dataset.l)];
      l[t.dataset.k] = t.value;
      if (t.dataset.k === 'descrizione') delete l.preset;
      totals();
      updatePreview();
    });
    on(root, 'click', '[data-del]', (e, t) => { r.righe.splice(Number(t.dataset.del), 1); renderLines(); updatePreview(); });
    $('#addLine', root).onclick = () => { r.righe.push({ descrizione: '', importo: '' }); renderLines(); $$('[data-k=descrizione]', root).pop().focus(); };
    $('#detr', root).addEventListener('change', e => { r.detrazione = e.target.checked; r.detrTouched = true; updatePreview(); });
    $('#bollo', root).addEventListener('change', e => { r.bollo = e.target.checked; r.bolloTouched = true; updatePreview(); });
    $('#note', root).addEventListener('input', e => { r.note = e.target.value; updatePreview(); });

    on(root, 'click', '[data-save]', async (e, t) => {
      const rec = build();
      if (!rec.righe.length || rec.totale <= 0) { toast('Aggiungi almeno una causale con importo', { type: 'warning' }); return; }
      if (!rec.intestatario.nome && !rec.intestatario.cognome) { toast('Scegli l\'atleta o scrivi a chi intestare la ricevuta', { type: 'warning' }); return; }
      t.disabled = true;
      const saved = await db.addReceipt(rec);
      db.log('receipt', `Ricevuta ${saved.tipo} n. ${saved.numero}/${saved.anno} – ${saved.intestatario.nome} ${saved.intestatario.cognome} – ${euro(saved.totale)}`, saved.id);
      const html = await receiptHTML(saved);
      if (t.dataset.save === 'print') {
        if (db.settings.printer.silent && db.settings.printer.deviceName) await quickPrint(html);
        else await printDocument(html, { title: `Ricevuta ${saved.tipo} n. ${saved.numero}/${saved.anno}`, fileName: `Ricevuta ${saved.tipo} ${saved.numero}-${saved.anno}` });
      }
      if (t.dataset.save === 'pdf') await window.athlos.print.pdf({ html, defaultName: `Ricevuta ${saved.tipo} ${saved.numero}-${saved.anno} ${saved.intestatario.cognome}`, pageSize: db.settings.printer.formato });
      afterSave(saved);
    });

    renderType();
    renderWho();
    renderDisc();
    renderMonths();
    renderPresets();
    renderLines();
    $('#metodo', root).value = r.metodo;
    if (r.clientId && client()) choose(r.clientId);
    else { autoFlags(); updatePreview(); }
  },
};

export function receiptMessage(rec) {
  const p = rec.intestatario || {};
  return `Gentile ${p.nome || ''}, ti confermiamo di aver ricevuto il pagamento di ${euro(rec.totale)}${rec.disciplina ? ` per ${rec.disciplina}` : ''}${(rec.mesi || []).length ? ` (${rec.mesi.map(monthLabel).join(', ')})` : ''}.\nRicevuta ${rec.tipo} n. ${rec.numero}/${rec.anno} del ${date(rec.data)}.\nGrazie! 💜 ${companyName()}`;
}

function afterSave(rec) {
  confetti({ count: 90 });
  const c = rec.clientId ? db.client(rec.clientId) : null;
  const phone = c ? phoneIntl((c.genitore && c.genitore.telefono) || c.telefono) : '';
  modal({
    title: `Ricevuta n. ${rec.numero}/${rec.anno} salvata`,
    subtitle: `${rec.tipo === 'generale' ? 'Ricevuta generale' : 'Ricevuta commerciale'} · ${euro(rec.totale)} · ${rec.intestatario.nome} ${rec.intestatario.cognome}`,
    icon: 'circle-check',
    size: 'md',
    body: `<div class="grid g2">
      <button class="quick" data-a="print" style="--g:var(--grad)"><span class="q-ico">${icon('printer', 18)}</span><b>Stampa</b><small>Scegli stampante e copie</small></button>
      <button class="quick" data-a="pdf" style="--g:var(--grad-cool)"><span class="q-ico">${icon('file-down', 18)}</span><b>Salva PDF</b><small>Da inviare o archiviare</small></button>
      <button class="quick" data-a="wa" style="--g:linear-gradient(135deg,#25D366,#128C7E)"><span class="q-ico">${icon('brand-whatsapp', 18)}</span><b>Conferma su WhatsApp</b><small>${phone ? 'Messaggio di conferma pagamento' : 'Nessun numero in anagrafica'}</small></button>
      <button class="quick" data-a="new" style="--g:var(--grad-warm)"><span class="q-ico">${icon('plus', 18)}</span><b>Nuova ricevuta</b><small>Per un altro pagamento</small></button>
    </div>`,
    onOpen: m => on(m.body, 'click', '[data-a]', async (e, t) => {
      const html = await receiptHTML(rec);
      if (t.dataset.a === 'print') printDocument(html, { title: `Ricevuta ${rec.tipo} n. ${rec.numero}/${rec.anno}`, fileName: `Ricevuta ${rec.tipo} ${rec.numero}-${rec.anno}` });
      if (t.dataset.a === 'pdf') window.athlos.print.pdf({ html, defaultName: `Ricevuta ${rec.tipo} ${rec.numero}-${rec.anno} ${rec.intestatario.cognome}`, pageSize: db.settings.printer.formato });
      if (t.dataset.a === 'wa') window.athlos.system.open(`https://wa.me/${phone}?text=${encodeURIComponent(receiptMessage(rec))}`);
      if (t.dataset.a === 'new') { m.close(); go(`/ricevute/nuova?tipo=${rec.tipo}&r=${Date.now()}`); }
    }),
    actions: [
      c ? { label: 'Vai alla scheda atleta', kind: 'ghost', icon: 'user', left: true, fn: () => go(`/atleti/${c.id}?tab=ricevute`) } : null,
      { label: 'Vai alle ricevute', kind: 'primary', fn: () => go('/ricevute') },
    ].filter(Boolean),
  });
}
