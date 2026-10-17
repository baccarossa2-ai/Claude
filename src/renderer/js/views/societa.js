// Dati della società: denominazione o persona fisica, partita IVA, fatturazione, sedi, contatti, social e logo.
import { db, defaultCompany } from '../lib/db.js';
import { icon, on, $, $$, toast, pickImage } from '../lib/ui.js';
import { esc, uid, address } from '../lib/format.js';
import { validatePIVA, validateCF } from '../lib/cf.js';
import { placeAutocomplete } from '../lib/places.js';

const FORME = ['A.S.D.', 'S.S.D. a r.l.', 'S.S.D. cooperativa', 'Associazione', 'S.r.l.', 'S.n.c.', 'Ditta individuale', 'Libero professionista', 'Altro'];

export default {
  title: 'Dati società',
  render(root) {
    const c = JSON.parse(JSON.stringify({ ...defaultCompany(), ...db.company }));
    c.fatturazione = { ...defaultCompany().fatturazione, ...(c.fatturazione || {}) };
    c.social = { ...defaultCompany().social, ...(c.social || {}) };
    if (!c.sedi || !c.sedi.length) c.sedi = defaultCompany().sedi;
    let dirty = false;

    root.innerHTML = `
      <div class="page-head">
        <div><div class="eyebrow">Impostazioni della società</div><h1>Dati società</h1><p>Questi dati compaiono su ogni ricevuta, sulle tessere e nei messaggi. Ogni società inserisce la propria denominazione.</p></div>
        <div class="actions"><span class="badge warn hidden" id="dirty">Modifiche non salvate</span><button class="btn primary" data-save>${icon('save', 16)}Salva dati</button></div>
      </div>
      <div class="grid" style="grid-template-columns:minmax(0,1fr) 380px;gap:20px;align-items:start">
        <div class="col" style="gap:18px">
          <div class="card pad"><div class="form-section" style="margin:0">
            <h3><span class="ico-box">${icon('building-2', 17)}</span>Intestazione</h3>
            <div class="seg" id="tipo"><button data-v="ente">${icon('building-2', 15)}Società / associazione</button><button data-v="persona">${icon('user', 15)}Persona fisica (nome e cognome)</button></div>
            <div id="names" class="mt"></div>
            <div class="grid g2 mt">
              <label class="field"><span>Partita IVA</span><input name="partitaIva" class="mono" maxlength="13" value="${esc(c.partitaIva)}"><small class="hint" id="pivaH"></small></label>
              <label class="field"><span>Codice fiscale</span><input name="codiceFiscale" class="mono upper" maxlength="16" value="${esc(c.codiceFiscale)}"><small class="hint" id="cfH"></small></label>
              <label class="field"><span>Legale rappresentante / presidente</span><input name="presidente" value="${esc(c.presidente)}"></label>
              <label class="field"><span>N. iscrizione Registro attività sportive (RASD)</span><input name="registroRasd" value="${esc(c.registroRasd)}"></label>
              <label class="field span-all"><span>Affiliazioni (federazioni ed enti)</span><input name="affiliazioni" value="${esc(c.affiliazioni)}" placeholder="Es. FGI, FIJLKAM, CSI, UISP"></label>
            </div>
          </div></div>

          <div class="card pad"><div class="form-section" style="margin:0">
            <h3><span class="ico-box">${icon('landmark', 17)}</span>Indirizzo di fatturazione / sede legale</h3>
            <div class="grid" style="grid-template-columns:3fr 1fr"><label class="field"><span>Indirizzo</span><input name="f.indirizzo" value="${esc(c.fatturazione.indirizzo)}"></label><label class="field"><span>Civico</span><input name="f.civico" value="${esc(c.fatturazione.civico)}"></label></div>
            <div class="grid mt" style="grid-template-columns:2fr 1fr 1fr 1.4fr">
              <label class="field"><span>Comune</span><div><input name="f.comune" value="${esc(c.fatturazione.comune)}"></div></label>
              <label class="field"><span>CAP</span><input name="f.cap" maxlength="5" value="${esc(c.fatturazione.cap)}"></label>
              <label class="field"><span>Provincia</span><input name="f.provincia" class="upper" maxlength="2" value="${esc(c.fatturazione.provincia)}"></label>
              <label class="field"><span>Nazione</span><input name="f.nazione" value="${esc(c.fatturazione.nazione)}"></label>
            </div>
            <div class="grid g3 mt">
              <label class="field"><span>Codice destinatario SDI</span><input name="codiceSdi" class="mono upper" maxlength="7" value="${esc(c.codiceSdi)}"></label>
              <label class="field"><span>PEC</span><input name="pec" value="${esc(c.pec)}"></label>
              <label class="field"><span>IBAN</span><input name="iban" class="mono upper" value="${esc(c.iban)}"></label>
            </div>
          </div></div>

          <div class="card pad"><div class="form-section" style="margin:0">
            <h3><span class="ico-box">${icon('map-pin', 17)}</span>Sedi e palestre <button class="btn sm" style="margin-left:auto" id="addSede">${icon('plus', 15)}Aggiungi sede</button></h3>
            <div class="col" id="sedi" style="gap:12px"></div>
          </div></div>

          <div class="card pad"><div class="form-section" style="margin:0">
            <h3><span class="ico-box">${icon('phone', 17)}</span>Contatti e social</h3>
            <div class="grid g2">
              <label class="field"><span>Telefono</span><input name="telefono" value="${esc(c.telefono)}"></label>
              <label class="field"><span>Cellulare / WhatsApp</span><input name="cellulare" value="${esc(c.cellulare)}"></label>
              <label class="field"><span>Email</span><input name="email" value="${esc(c.email)}"></label>
              <label class="field"><span>Sito web</span><input name="sito" value="${esc(c.sito)}"></label>
              <label class="field"><span>${icon('brand-instagram', 14)} Instagram</span><input name="s.instagram" value="${esc(c.social.instagram)}" placeholder="@nomesocieta"></label>
              <label class="field"><span>${icon('brand-facebook', 14)} Facebook</span><input name="s.facebook" value="${esc(c.social.facebook)}" placeholder="facebook.com/…"></label>
              <label class="field"><span>${icon('music-2', 14)} TikTok</span><input name="s.tiktok" value="${esc(c.social.tiktok)}"></label>
              <label class="field"><span>${icon('brand-x', 14)} X (Twitter)</span><input name="s.x" value="${esc(c.social.x)}"></label>
            </div>
          </div></div>
        </div>

        <div class="col" style="gap:18px;position:sticky;top:0">
          <div class="card pad" style="text-align:center">
            <div id="logo" style="width:140px;height:140px;margin:0 auto;border-radius:30px;overflow:hidden;display:grid;place-items:center;background:var(--surface-3);border:2px dashed var(--line-2)"></div>
            <div class="row mt" style="justify-content:center"><button class="btn sm" id="logoBtn">${icon('image-plus', 15)}Carica logo</button><button class="btn sm ghost" id="logoDel">${icon('trash-2', 15)}</button></div>
            <p class="muted tiny mt">PNG o JPG, meglio quadrato e con sfondo trasparente.</p>
          </div>
          <div class="card pad"><h3 class="section-title">${icon('eye', 17)}Così appare sulle ricevute</h3><div id="preview" style="border:1px solid var(--line);border-radius:12px;padding:14px;background:#fff;color:#1b1838"></div></div>
          <button class="btn primary lg block" data-save>${icon('save', 18)}Salva dati</button>
        </div>
      </div>`;

    const setDirty = v => { dirty = v; $('#dirty', root).classList.toggle('hidden', !v); };

    const renderNames = () => {
      $$('#tipo button', root).forEach(b => b.classList.toggle('active', b.dataset.v === (c.tipoSoggetto === 'persona' ? 'persona' : 'ente')));
      $('#names', root).innerHTML = c.tipoSoggetto === 'persona'
        ? `<div class="grid g2"><label class="field"><span>Nome</span><input name="nome" value="${esc(c.nome)}"></label><label class="field"><span>Cognome</span><input name="cognome" value="${esc(c.cognome)}"></label></div>`
        : `<div class="grid" style="grid-template-columns:2fr 1fr"><label class="field"><span>Denominazione sociale</span><input name="denominazione" value="${esc(c.denominazione)}" placeholder="Es. Athletic Club"></label>
           <label class="field"><span>Forma giuridica</span><select name="formaGiuridica">${FORME.map(f => `<option ${c.formaGiuridica === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label></div>`;
    };

    const renderSedi = () => {
      $('#sedi', root).innerHTML = c.sedi.map((s, i) => `<div style="padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--surface-2)">
        <div class="row between"><div class="row"><span class="badge ${s.principale ? 'accent' : ''}">${s.principale ? '★ Sede principale' : `Sede ${i + 1}`}</span></div>
          <div class="row">${!s.principale ? `<button class="btn sm ghost" data-main="${i}">${icon('star', 14)}Principale</button>` : ''}<button class="btn sm ghost" data-copyf="${i}">${icon('copy', 14)}Usa indirizzo fatturazione</button>${c.sedi.length > 1 ? `<button class="btn icon sm ghost" data-delsede="${i}">${icon('trash-2', 15)}</button>` : ''}</div></div>
        <div class="grid mt" style="grid-template-columns:1.4fr 2fr 0.7fr"><label class="field"><span>Nome sede</span><input data-sede="${i}" data-k="nome" value="${esc(s.nome)}"></label>
          <label class="field"><span>Indirizzo</span><input data-sede="${i}" data-k="indirizzo" value="${esc(s.indirizzo)}"></label>
          <label class="field"><span>Civico</span><input data-sede="${i}" data-k="civico" value="${esc(s.civico)}"></label></div>
        <div class="grid mt" style="grid-template-columns:2fr 1fr 0.8fr 1.6fr"><label class="field"><span>Comune</span><div><input data-sede="${i}" data-k="comune" value="${esc(s.comune)}"></div></label>
          <label class="field"><span>CAP</span><input data-sede="${i}" data-k="cap" value="${esc(s.cap)}"></label>
          <label class="field"><span>Prov.</span><input data-sede="${i}" data-k="provincia" class="upper" maxlength="2" value="${esc(s.provincia)}"></label>
          <label class="field"><span>Telefono sede</span><input data-sede="${i}" data-k="telefono" value="${esc(s.telefono)}"></label></div>
      </div>`).join('');
      $$('[data-k=comune]', root).forEach(inp => placeAutocomplete(inp, {
        onPick: p => {
          const s = c.sedi[Number(inp.dataset.sede)];
          Object.assign(s, { comune: p.nome, provincia: p.prov, cap: s.cap || p.cap });
          renderSedi(); setDirty(true); renderPreview();
        },
      }));
    };

    const renderLogo = () => {
      $('#logo', root).innerHTML = c.logo ? `<img src="${window.athlos.media.url(c.logo)}" style="width:100%;height:100%;object-fit:contain;background:#fff">` : `<div class="muted">${icon('image', 40)}</div>`;
      $('#logoDel', root).classList.toggle('hidden', !c.logo);
    };

    const renderPreview = () => {
      const name = c.tipoSoggetto === 'persona' ? `${c.nome} ${c.cognome}` : c.denominazione;
      $('#preview', root).innerHTML = `<div style="display:flex;gap:10px;align-items:flex-start;border-bottom:2px solid #7C4DFF;padding-bottom:8px">
        ${c.logo ? `<img src="${window.athlos.media.url(c.logo)}" style="width:44px;height:44px;object-fit:contain">` : '<div style="width:40px;height:40px;border-radius:10px;background:var(--grad)"></div>'}
        <div style="text-align:left;min-width:0"><b style="font-family:Outfit;font-size:17px">${esc(name || 'Nome società')}</b>
          <div style="font-size:11px;color:#5d5980">${esc([c.tipoSoggetto !== 'persona' ? c.formaGiuridica : '', address(c.fatturazione)].filter(Boolean).join(' · '))}</div>
          <div style="font-size:11px;color:#5d5980">${esc([c.partitaIva && `P.IVA ${c.partitaIva}`, c.codiceFiscale && `C.F. ${c.codiceFiscale}`].filter(Boolean).join(' · '))}</div>
          <div style="font-size:11px;color:#5d5980">${esc([c.telefono || c.cellulare, c.email].filter(Boolean).join(' · '))}</div></div></div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:#8a86a6"><span>Ricevuta generale</span><b style="color:#1b1838">N. 1/${new Date().getFullYear()}</b></div>`;
    };

    const validate = () => {
      const p = c.partitaIva ? validatePIVA(c.partitaIva) : null;
      const f = c.codiceFiscale ? validateCF(c.codiceFiscale) : null;
      $('#pivaH', root).textContent = p ? (p.ok ? '✓ Valida' : p.error) : '';
      $('#pivaH', root).className = 'hint ' + (p ? (p.ok ? 'ok' : 'err') : '');
      $('#cfH', root).textContent = f ? (f.ok ? '✓ Valido' : f.error) : 'Per le associazioni è spesso numerico (11 cifre)';
      $('#cfH', root).className = 'hint ' + (f ? (f.ok ? 'ok' : 'err') : '');
    };

    on(root, 'input', 'input[name], select[name]', (e, t) => {
      const n = t.name;
      const v = t.classList.contains('upper') ? t.value.toUpperCase() : t.value;
      if (n.startsWith('f.')) c.fatturazione[n.slice(2)] = v;
      else if (n.startsWith('s.')) c.social[n.slice(2)] = v;
      else c[n] = v;
      setDirty(true); validate(); renderPreview();
    });
    on(root, 'change', 'select[name]', (e, t) => t.dispatchEvent(new Event('input', { bubbles: true })));
    on(root, 'input', '[data-sede]', (e, t) => { c.sedi[Number(t.dataset.sede)][t.dataset.k] = t.dataset.k === 'provincia' ? t.value.toUpperCase() : t.value; setDirty(true); });
    on($('#tipo', root), 'click', 'button', (e, t) => { c.tipoSoggetto = t.dataset.v; renderNames(); renderPreview(); setDirty(true); });
    $('#addSede', root).onclick = () => { c.sedi.push({ id: uid('s-'), nome: `Sede ${c.sedi.length + 1}`, indirizzo: '', civico: '', cap: '', comune: '', provincia: '', telefono: '', principale: false }); renderSedi(); setDirty(true); };
    on(root, 'click', '[data-delsede]', (e, t) => { const i = Number(t.dataset.delsede); const was = c.sedi[i].principale; c.sedi.splice(i, 1); if (was) c.sedi[0].principale = true; renderSedi(); setDirty(true); });
    on(root, 'click', '[data-main]', (e, t) => { c.sedi.forEach((s, i) => { s.principale = i === Number(t.dataset.main); }); renderSedi(); setDirty(true); });
    on(root, 'click', '[data-copyf]', (e, t) => { Object.assign(c.sedi[Number(t.dataset.copyf)], { indirizzo: c.fatturazione.indirizzo, civico: c.fatturazione.civico, cap: c.fatturazione.cap, comune: c.fatturazione.comune, provincia: c.fatturazione.provincia }); renderSedi(); setDirty(true); });
    $('#logoBtn', root).onclick = async () => {
      const name = await pickImage({ max: 600, type: 'image/png' }).catch(() => null);
      if (!name) return;
      c.logo = name; renderLogo(); renderPreview(); setDirty(true);
    };
    $('#logoDel', root).onclick = () => { c.logo = ''; renderLogo(); renderPreview(); setDirty(true); };
    placeAutocomplete($('[name="f.comune"]', root), {
      onPick: p => { c.fatturazione.comune = p.nome; c.fatturazione.provincia = p.prov; if (!c.fatturazione.cap) c.fatturazione.cap = p.cap; $('[name="f.provincia"]', root).value = p.prov; $('[name="f.cap"]', root).value = c.fatturazione.cap; setDirty(true); renderPreview(); },
    });

    const save = async () => {
      if (c.tipoSoggetto !== 'persona' && !String(c.denominazione || '').trim()) { toast('Inserisci la denominazione sociale', { type: 'warning' }); return; }
      if (c.tipoSoggetto === 'persona' && !String(c.cognome || '').trim()) { toast('Inserisci nome e cognome', { type: 'warning' }); return; }
      if (db.company.logo && db.company.logo !== c.logo) window.athlos.media.remove(db.company.logo);
      await db.save('company', c);
      db.log('company', 'Aggiornati i dati della società');
      setDirty(false);
      toast('Dati della società salvati');
    };
    on(root, 'click', '[data-save]', save);
    const onKey = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
    document.addEventListener('keydown', onKey);

    renderNames(); renderSedi(); renderLogo(); renderPreview(); validate();
    return () => {
      document.removeEventListener('keydown', onKey);
      if (dirty) toast('Attenzione: le modifiche ai dati società non sono state salvate', { type: 'warning' });
    };
  },
};
