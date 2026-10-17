// Comunica: messaggi pronti per WhatsApp, Messenger, Facebook, Instagram e X,
// con variabili, emoji, hashtag, anteprima realistica e invio a più famiglie.
import { db } from '../lib/db.js';
import { icon, on, $, $$, toast, modal, avatar, promptDialog, confirmDialog } from '../lib/ui.js';
import { esc, fillTemplate, euro, date, todayISO, MESI, normalize, phoneIntl, fullName, uid } from '../lib/format.js';
import { CATEGORIES, TEMPLATES, HASHTAGS, EMOJIS, PLATFORMS, adapt, xLength, shortenForX } from '../data/templates.js';
import { companyName } from '../print/receipt.js';

const st = { cat: 'tutti', q: '', tplId: TEMPLATES[0].id, platform: 'whatsapp', text: '', tags: new Set(), unicodeBold: true, image: 'palestra', imageCustom: '', vars: {} };

function allTemplates() {
  return [...(db.templates || []).map(t => ({ ...t, custom: true })), ...TEMPLATES];
}

function defaultVars() {
  const c = db.company;
  const sede = (c.sedi || []).find(s => s.principale) || (c.sedi || [])[0] || {};
  const now = new Date();
  return {
    societa: companyName(),
    telefono: c.cellulare || c.telefono || '',
    luogo: [sede.indirizzo, sede.civico, sede.comune].filter(Boolean).join(', '),
    sito: c.sito || '',
    instagram: c.social?.instagram || '',
    iban: c.iban || '',
    mese: MESI[now.getMonth()],
    anno: String(now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()),
    data: date(todayISO()),
    ora: '17:00',
    evento: 'Campionato regionale',
    disciplina: (db.disciplines[0] || {}).nome || '',
    importo: euro((db.disciplines[0] || {}).quotaMensile || 0),
    nome: '',
    atleta: '',
  };
}

export default {
  title: 'Comunica',
  render(root, params, query) {
    st.vars = { ...defaultVars(), ...st.vars, societa: companyName() };
    const recipients = new Set((query.destinatari || '').split(',').filter(id => db.client(id)));
    const tpl = () => allTemplates().find(t => t.id === st.tplId) || TEMPLATES[0];
    if (!st.text) st.text = tpl().text;

    root.innerHTML = `
      <div class="page-head"><div><div class="eyebrow">Comunicazione</div><h1>Comunica</h1><p>Messaggi pronti per famiglie e social: scegli un modello, personalizzalo e pubblicalo dove vuoi.</p></div>
        <div class="actions"><button class="btn" id="studio">${icon('clapperboard', 16)}Crea la grafica in Salto Studio</button></div></div>
      <div class="composer-grid">
        <div class="card pad-sm">
          <div class="input-icon" style="margin-bottom:10px">${icon('search', 16)}<input class="input" id="tq" placeholder="Cerca un modello…" value="${esc(st.q)}"></div>
          <div class="chips" id="cats" style="margin-bottom:10px"></div>
          <div class="tpl-list" id="tpls"></div>
        </div>
        <div class="col" style="gap:16px">
          <div class="card pad">
            <div class="row between wrap" style="margin-bottom:14px"><div class="platforms" id="plats"></div></div>
            <div class="row between" style="margin-bottom:8px"><b id="tplTitle"></b><span class="counter" id="count"></span></div>
            <textarea class="input" id="txt" style="height:240px;padding:14px;resize:vertical;line-height:1.55;font-size:14.5px"></textarea>
            <div class="emoji-bar mt" id="emo">${EMOJIS.map(e => `<button data-emo="${e}">${e}</button>`).join('')}</div>
            <div class="row wrap mt" style="gap:8px"><span class="small muted">Variabili:</span><div class="var-chips" id="vchips"></div></div>
            <div class="row wrap mt" id="xbar"></div>
          </div>
          <div class="card pad">
            <h3 class="section-title">${icon('sliders-horizontal', 17)}Dettagli del messaggio</h3>
            <div class="grid g2" id="vars"></div>
          </div>
          <div class="card pad" id="tagCard">
            <div class="row between"><h3 class="section-title" style="margin:0">${icon('hash', 17)}Hashtag</h3><label class="switch small"><input type="checkbox" id="ub" ${st.unicodeBold ? 'checked' : ''}><i></i>Grassetto per Instagram, Facebook e X</label></div>
            <div class="chips mt" id="tags"></div>
          </div>
          <div class="card pad" id="recCard">
            <div class="row between"><h3 class="section-title" style="margin:0">${icon('users', 17)}Invia a famiglie e atleti <span class="badge accent" id="recN"></span></h3><div class="row"><button class="btn sm" id="addRec">${icon('user-plus', 15)}Scegli destinatari</button><button class="btn sm ghost" id="clrRec">${icon('x', 15)}</button></div></div>
            <div class="chips mt" id="recs"></div>
          </div>
          <div class="row wrap" style="justify-content:flex-end;gap:10px">
            <button class="btn" id="saveTpl">${icon('bookmark', 16)}Salva come modello</button>
            <button class="btn" id="copy">${icon('copy', 16)}Copia testo</button>
            <button class="btn primary lg" id="go"></button>
          </div>
        </div>
        <div class="preview-col col" style="gap:14px;position:sticky;top:0">
          <div id="phone"></div>
          <div class="card pad-sm" id="imgPick"></div>
        </div>
      </div>`;

    const finalText = () => adapt(fillTemplate(st.text, st.vars), st.platform, { unicodeBold: st.unicodeBold, hashtags: ['instagram', 'facebook', 'x'].includes(st.platform) ? [...st.tags] : [] });

    const renderCats = () => {
      $('#cats', root).innerHTML = CATEGORIES.map(([k, l, e]) => `<button class="chip plain ${st.cat === k ? '' : 'off'}" style="--dc:#7C4DFF" data-cat="${k}">${e} ${l}</button>`).join('')
        + (db.templates.length ? `<button class="chip plain ${st.cat === 'miei' ? '' : 'off'}" data-cat="miei">⭐ I miei</button>` : '');
    };
    const renderTpls = () => {
      const q = normalize(st.q);
      const list = allTemplates().filter(t => (st.cat === 'tutti' || t.cat === st.cat || (st.cat === 'miei' && t.custom)) && (!q || normalize(t.title + ' ' + t.text).includes(q)));
      $('#tpls', root).innerHTML = list.map(t => `<div class="tpl-item ${t.id === st.tplId ? 'sel' : ''}" data-tpl="${t.id}"><span class="t-emoji">${t.emoji}</span><div class="grow" style="min-width:0"><b>${esc(t.title)}</b><small class="ellipsis" style="display:block">${esc(t.text.replace(/[*_]/g, '').slice(0, 60))}</small></div>${t.custom ? `<button class="btn icon sm ghost" data-deltpl="${t.id}">${icon('trash-2', 14)}</button>` : ''}</div>`).join('') || '<p class="muted small" style="padding:10px">Nessun modello trovato.</p>';
    };
    const renderPlats = () => {
      $('#plats', root).innerHTML = Object.entries(PLATFORMS).map(([k, p]) => `<button class="plat ${st.platform === k ? 'sel' : ''}" style="--pc:${p.color}" data-plat="${k}">${icon(p.icon, 16)}${p.name}</button>`).join('');
      const p = PLATFORMS[st.platform];
      $('#go', root).innerHTML = `${icon(p.icon, 18)}${st.platform === 'whatsapp' && recipients.size ? `Invia a ${recipients.size} su WhatsApp` : st.platform === 'x' ? 'Pubblica su X' : st.platform === 'whatsapp' ? 'Apri WhatsApp' : `Copia e apri ${p.name}`}`;
      $('#go', root).style.background = p.color === '#0F1419' ? '#0F1419' : p.color;
      $('#tagCard', root).classList.toggle('hidden', ['whatsapp', 'messenger'].includes(st.platform));
      $('#recCard', root).classList.toggle('hidden', st.platform !== 'whatsapp');
    };
    const renderVars = () => {
      const used = [...new Set([...st.text.matchAll(/\{(\w+)\}/g)].map(m => m[1]))];
      $('#vchips', root).innerHTML = Object.keys(defaultVars()).map(k => `<button data-var="${k}">{${k}}</button>`).join('');
      const labels = { nome: 'Nome (destinatario)', atleta: 'Atleta', societa: 'Società', disciplina: 'Disciplina', data: 'Data', ora: 'Ora', luogo: 'Luogo', evento: 'Evento / gara', importo: 'Importo', mese: 'Mese', anno: 'Anno', telefono: 'Telefono', sito: 'Sito', instagram: 'Instagram', iban: 'IBAN' };
      $('#vars', root).innerHTML = used.length ? used.map(k => k === 'disciplina'
        ? `<label class="field"><span>${labels[k] || k}</span><select data-v="${k}">${db.disciplines.map(d => `<option ${st.vars[k] === d.nome ? 'selected' : ''}>${esc(d.nome)}</option>`).join('')}</select></label>`
        : `<label class="field"><span>${labels[k] || k}</span><input data-v="${k}" value="${esc(st.vars[k] || '')}" placeholder="${k === 'nome' || k === 'atleta' ? 'Automatico per ogni destinatario' : ''}"></label>`).join('')
        : '<p class="muted small span-all">Questo messaggio non ha campi da compilare.</p>';
    };
    const renderTags = () => {
      const disc = db.disciplines.find(d => d.nome === st.vars.disciplina);
      const pool = [...new Set([normalize(companyName()).replace(/[^a-z0-9]/g, ''), ...(disc ? HASHTAGS[disc.nome] || [] : []), ...HASHTAGS.base, ...Object.values(HASHTAGS).flat()])].filter(Boolean).slice(0, 26);
      $('#tags', root).innerHTML = pool.map(h => `<button class="chip ${st.tags.has(h) ? '' : 'off'}" style="--dc:#0EA5E9" data-tag="${h}">#${esc(h)}</button>`).join('');
    };
    const renderRecs = () => {
      $('#recN', root).textContent = recipients.size || '';
      $('#recs', root).innerHTML = [...recipients].map(id => db.client(id)).filter(Boolean).map(c => `<span class="chip plain" style="padding:4px 6px 4px 4px">${avatar(c, 22)} ${esc(fullName(c))}<button class="btn icon sm ghost" style="width:22px;height:22px" data-unrec="${c.id}">${icon('x', 12)}</button></span>`).join('') || '<p class="muted small">Nessun destinatario: il messaggio si apre in WhatsApp e scegli tu il contatto o il gruppo.</p>';
      renderPlats();
    };
    const renderCount = () => {
      const t = finalText();
      const p = PLATFORMS[st.platform];
      const n = st.platform === 'x' ? xLength(t) : [...t].length;
      const c = $('#count', root);
      c.textContent = `${n} / ${p.limit} caratteri`;
      c.classList.toggle('over', n > p.limit);
      $('#xbar', root).innerHTML = st.platform === 'x' && n > 280 ? `<div class="alert" style="--ac:var(--warn);width:100%"><span class="a-ico">${icon('scissors', 17)}</span><div class="grow"><b>Troppo lungo per X</b><small>Il limite è 280 caratteri (emoji e simboli contano doppio).</small></div><button class="btn sm" id="short">${icon('wand-sparkles', 15)}Accorcia</button></div>` : '';
      if ($('#short', root)) $('#short', root).onclick = () => { st.text = shortenForX(fillTemplate(st.text, st.vars)); $('#txt', root).value = st.text; refresh(); };
    };
    const renderImgPick = () => {
      const imgs = ['palestra', 'artistica', 'ritmica', 'judo', 'aerea', 'fitness', 'team', 'studio'];
      $('#imgPick', root).innerHTML = ['instagram', 'facebook', 'x'].includes(st.platform) ? `<b class="small">Immagine del post</b><div class="grid" style="grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px">${imgs.map(i => `<button data-img="${i}" style="height:46px;border-radius:9px;overflow:hidden;padding:0;cursor:pointer;border:2px solid ${!st.imageCustom && st.image === i ? 'var(--accent)' : 'transparent'}"><img src="assets/images/${i}.webp" style="width:100%;height:100%;object-fit:cover"></button>`).join('')}</div>
        <p class="tiny muted mt">Per creare una grafica o un video su misura usa Salto Studio.</p>` : `<p class="small muted">${icon('info', 14)} Su ${PLATFORMS[st.platform].name} il messaggio si apre già scritto: devi solo premere invio.</p>`;
    };
    const renderPhone = () => {
      const t = finalText();
      const c = db.company;
      const logo = c.logo ? `<img src="${window.athlos.media.url(c.logo)}">` : esc(companyName().slice(0, 1));
      const name = esc(companyName());
      const img = `<div class="pv-img"><img src="assets/images/${st.image}.webp" alt=""><span>${esc((tpl().title || '').toUpperCase())}</span></div>`;
      const body = esc(t).replace(/#([\p{L}\p{N}_]+)/gu, '<span class="pv-tag">#$1</span>').replace(/(https?:\/\/\S+)/g, '<span class="pv-tag">$1</span>');
      const waBody = esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>');
      let screen = '';
      if (st.platform === 'whatsapp') {
        const first = [...recipients].map(id => db.client(id))[0];
        screen = `<div class="pv-head">${icon('arrow-left', 18)}<div class="pv-av">${first ? esc((first.nome[0] || '') + (first.cognome[0] || '')) : logo}</div><div>${first ? esc(fullName(first)) : 'Famiglie ' + name}<small>online</small></div></div>
          <div class="pv-body"><div class="bubble"><div class="pv-text">${waBody}</div><span class="meta">${new Date().toTimeString().slice(0, 5)} ${icon('check-check', 14)}</span></div></div>`;
      } else if (st.platform === 'messenger') {
        screen = `<div class="pv-head"><div class="pv-av">${logo}</div><div>${name}<small>Attivo ora</small></div></div><div class="pv-body"><div class="bubble"><div class="pv-text">${body}</div></div></div>`;
      } else if (st.platform === 'instagram') {
        screen = `<div class="pv-head" style="border-bottom:1px solid #eee"><b style="font-family:'Lobster',cursive;font-size:22px;font-weight:400">Instagram</b></div><div class="pv-body" style="padding:0">
          <div class="pv-post"><div class="pv-post-head"><div class="pv-av" style="width:32px;height:32px;border-radius:50%;background:var(--grad);display:grid;place-items:center;color:#fff;overflow:hidden;box-shadow:0 0 0 2px #fff,0 0 0 4px #E1306C">${logo}</div><div>${esc((c.social?.instagram || companyName()).replace(/^@/, ''))}<small>${esc(c.fatturazione?.comune || '')}</small></div></div>
          ${img}<div class="pv-actions">${icon('heart', 22)}${icon('message-circle', 22)}${icon('send', 22)}<span style="margin-left:auto">${icon('bookmark', 22)}</span></div>
          <div class="pv-caption"><b>${esc((c.social?.instagram || companyName()).replace(/^@/, ''))}</b> <span class="pv-text">${body}</span></div></div></div>`;
      } else if (st.platform === 'facebook') {
        screen = `<div class="pv-head" style="background:#fff;border-bottom:1px solid #eee"><b style="color:#1877F2;font-size:22px;letter-spacing:-.5px">facebook</b></div><div class="pv-body" style="padding:0">
          <div class="pv-post"><div class="pv-post-head"><div class="pv-av" style="width:38px;height:38px;border-radius:50%;background:var(--grad);display:grid;place-items:center;color:#fff;overflow:hidden">${logo}</div><div>${name}<small>Adesso · 🌍</small></div></div>
          <div class="pv-caption" style="padding-top:0"><span class="pv-text">${body}</span></div>${img}
          <div class="pv-actions" style="justify-content:space-around;border-top:1px solid #eee;padding:8px;color:#65676B;font-size:13px;font-weight:600"><span>👍 Mi piace</span><span>💬 Commenta</span><span>↗ Condividi</span></div></div></div>`;
      } else {
        screen = `<div class="pv-head" style="justify-content:center">${icon('brand-x', 22)}</div><div class="pv-body" style="padding:0">
          <div class="pv-post" style="display:flex;gap:10px;padding:12px"><div class="pv-av" style="width:38px;height:38px;flex:none;border-radius:50%;background:var(--grad);display:grid;place-items:center;color:#fff;overflow:hidden">${logo}</div>
          <div style="min-width:0"><div style="font-weight:700;font-size:14px">${name} <span style="color:#71767B;font-weight:400">@${esc((c.social?.x || companyName()).replace(/[^\w]/g, '').toLowerCase())} · ora</span></div>
          <div class="pv-text" style="margin-top:2px">${body}</div><div style="border-radius:16px;overflow:hidden;margin-top:10px;border:1px solid #2F3336">${img}</div>
          <div class="pv-actions" style="justify-content:space-between;color:#71767B;padding:10px 0 0">${icon('message-circle', 17)}${icon('refresh-cw', 17)}${icon('heart', 17)}${icon('chart-column', 17)}</div></div></div></div>`;
      }
      $('#phone', root).innerHTML = `<div class="phone pv-${{ whatsapp: 'wa', messenger: 'ms', instagram: 'ig', facebook: 'fb', x: 'x' }[st.platform]}"><div class="phone-screen"><div class="phone-notch"></div>${screen}</div></div>`;
    };

    const refresh = () => { renderCount(); renderPhone(); };
    const fullRender = () => {
      $('#tplTitle', root).textContent = `${tpl().emoji} ${tpl().title}`;
      $('#txt', root).value = st.text;
      renderCats(); renderTpls(); renderPlats(); renderVars(); renderTags(); renderRecs(); renderImgPick(); refresh();
    };

    // eventi
    $('#tq', root).addEventListener('input', e => { st.q = e.target.value; renderTpls(); });
    on(root, 'click', '[data-cat]', (e, t) => { st.cat = t.dataset.cat; renderCats(); renderTpls(); });
    on(root, 'click', '[data-tpl]', (e, t) => {
      if (e.target.closest('[data-deltpl]')) return;
      st.tplId = t.dataset.tpl; st.text = tpl().text; fullRender();
    });
    on(root, 'click', '[data-deltpl]', async (e, t) => {
      if (!(await confirmDialog('Eliminare questo modello personale?', { danger: true }))) return;
      db.all.templates = db.templates.filter(x => x.id !== t.dataset.deltpl);
      await db.save('templates');
      renderCats(); renderTpls();
    });
    on(root, 'click', '[data-plat]', (e, t) => { st.platform = t.dataset.plat; renderPlats(); renderImgPick(); refresh(); });
    $('#txt', root).addEventListener('input', e => { st.text = e.target.value; renderVars(); refresh(); });
    on(root, 'click', '[data-emo]', (e, t) => insertAtCursor(t.dataset.emo));
    on(root, 'click', '[data-var]', (e, t) => insertAtCursor(`{${t.dataset.var}}`));
    on(root, 'input', '[data-v]', (e, t) => { st.vars[t.dataset.v] = t.value; if (t.dataset.v === 'disciplina') renderTags(); refresh(); });
    on(root, 'change', 'select[data-v]', (e, t) => { st.vars[t.dataset.v] = t.value; renderTags(); refresh(); });
    on(root, 'click', '[data-tag]', (e, t) => { const h = t.dataset.tag; if (st.tags.has(h)) st.tags.delete(h); else st.tags.add(h); renderTags(); refresh(); });
    on(root, 'click', '[data-img]', (e, t) => { st.image = t.dataset.img; renderImgPick(); renderPhone(); });
    on(root, 'click', '[data-unrec]', (e, t) => { recipients.delete(t.dataset.unrec); renderRecs(); renderPhone(); });
    $('#ub', root).onchange = e => { st.unicodeBold = e.target.checked; refresh(); };
    $('#clrRec', root).onclick = () => { recipients.clear(); renderRecs(); renderPhone(); };
    $('#addRec', root).onclick = () => pickRecipients(recipients, () => { renderRecs(); renderPhone(); });
    $('#studio', root).onclick = () => window.athlos.system.openStudio({ text: fillTemplate(st.text, st.vars).replace(/[*_]/g, ''), title: tpl().title, image: st.image });
    $('#copy', root).onclick = async () => { await window.athlos.system.copy(finalText()); toast('Testo copiato negli appunti'); };
    $('#saveTpl', root).onclick = async () => {
      const title = await promptDialog({ title: 'Salva come modello', label: 'Nome del modello', value: tpl().title + ' (mio)' });
      if (!title) return;
      const t = { id: uid('tp-'), cat: tpl().cat || 'avvisi', emoji: '⭐', title, text: st.text };
      db.templates.unshift(t);
      await db.save('templates');
      st.tplId = t.id;
      fullRender();
      toast('Modello salvato tra “I miei”');
    };
    $('#go', root).onclick = async () => {
      const p = st.platform;
      if (p === 'whatsapp' && recipients.size) return sendQueue([...recipients].map(id => db.client(id)).filter(Boolean));
      const text = finalText();
      if (p === 'whatsapp') return window.athlos.system.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
      if (p === 'x') return window.athlos.system.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
      await window.athlos.system.copy(text);
      const urls = { messenger: 'https://www.messenger.com/', facebook: db.company.sito ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(db.company.sito)}` : 'https://www.facebook.com/', instagram: 'https://www.instagram.com/' };
      toast(`Testo copiato: incollalo in ${PLATFORMS[p].name} con Ctrl+V`, { type: 'info', duration: 6000 });
      window.athlos.system.open(urls[p]);
    };

    function insertAtCursor(s) {
      const ta = $('#txt', root);
      const a = ta.selectionStart;
      const b = ta.selectionEnd;
      ta.value = ta.value.slice(0, a) + s + ta.value.slice(b);
      ta.selectionStart = ta.selectionEnd = a + s.length;
      ta.focus();
      st.text = ta.value;
      renderVars(); refresh();
    }

    function sendQueue(list) {
      let i = 0;
      const m = modal({ title: 'Invio su WhatsApp', icon: 'send', size: 'md', body: '<div id="sq"></div>' });
      const step = () => {
        if (i >= list.length) { m.close(); toast(`Messaggi preparati per ${list.length} destinatari`); return; }
        const c = list[i];
        const parentName = c.genitore && c.genitore.nome;
        const text = adapt(fillTemplate(st.text, { ...st.vars, nome: parentName || c.nome, atleta: `${c.nome} ${c.cognome}` }), 'whatsapp');
        const phone = phoneIntl((c.genitore && c.genitore.telefono) || c.telefono);
        $('#sq', m.body).innerHTML = `<div class="row between"><span class="badge accent">${i + 1} di ${list.length}</span><div class="progress" style="width:200px"><i style="width:${(i / list.length) * 100}%"></i></div></div>
          <div class="row mt">${avatar(c, 46)}<div class="person"><div><b>${esc(fullName(c))}</b><small>${esc(phone ? '+' + phone : 'Nessun numero')}</small></div></div></div>
          <div class="card pad-sm mt" style="white-space:pre-wrap;max-height:220px;overflow:auto;background:#D9FDD3;color:#111">${esc(text)}</div>
          <div class="row mt" style="justify-content:flex-end"><button class="btn ghost" id="sk">Salta</button><button class="btn whatsapp" id="sd" ${phone ? '' : 'disabled'}>${icon('brand-whatsapp', 16)}Apri e passa al prossimo</button></div>`;
        $('#sk', m.body).onclick = () => { i++; step(); };
        $('#sd', m.body).onclick = async () => { await window.athlos.system.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`); i++; step(); };
      };
      step();
    }

    fullRender();
  },
};

function pickRecipients(set, after) {
  let disc = '';
  let q = '';
  const m = modal({
    title: 'Scegli i destinatari', icon: 'users', size: 'lg',
    body: `<div class="toolbar"><div class="input-icon">${icon('search', 16)}<input class="input" id="rq" placeholder="Cerca…"></div>
      <select class="input" id="rd" style="width:auto"><option value="">Tutte le discipline</option>${db.disciplines.map(d => `<option value="${d.id}">${esc(d.nome)}</option>`).join('')}</select>
      <button class="btn sm" id="ra">Seleziona tutti</button><button class="btn sm ghost" id="rn">Nessuno</button></div>
      <div class="card table-wrap" style="max-height:52vh"><table class="table"><tbody id="rl"></tbody></table></div>`,
    actions: [{ label: 'Fatto', kind: 'primary', fn: () => { after(); return true; } }],
    onClose: after,
  });
  const visible = () => db.searchClients(q, { discipline: disc || null, filter: c => c.stato !== 'sospeso' });
  const draw = () => {
    $('#rl', m.body).innerHTML = visible().map(c => `<tr class="click" data-r="${c.id}"><td style="width:36px"><input type="checkbox" ${set.has(c.id) ? 'checked' : ''}></td><td><div class="person">${avatar(c, 32)}<div><b>${esc(fullName(c))}</b><small>${esc((c.genitore && c.genitore.telefono) || c.telefono || 'nessun numero')}</small></div></div></td></tr>`).join('');
  };
  $('#rq', m.body).addEventListener('input', e => { q = e.target.value; draw(); });
  $('#rd', m.body).addEventListener('change', e => { disc = e.target.value; draw(); });
  $('#ra', m.body).onclick = () => { visible().forEach(c => set.add(c.id)); draw(); };
  $('#rn', m.body).onclick = () => { set.clear(); draw(); };
  on(m.body, 'click', '[data-r]', (e, t) => { const id = t.dataset.r; if (set.has(id)) set.delete(id); else set.add(id); draw(); });
  draw();
}
