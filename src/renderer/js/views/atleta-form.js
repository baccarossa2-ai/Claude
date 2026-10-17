// Nuova anagrafica / modifica: dati anagrafici, codice fiscale automatico, residenza completa,
// discipline, certificato medico, genitore o tutore, consensi e foto.
import { db } from '../lib/db.js';
import { icon, avatar, on, $, $$, toast, pickImage } from '../lib/ui.js';
import { go } from '../lib/router.js';
import { esc, age, todayISO, toISO, titleCase, date } from '../lib/format.js';
import { computeCF, validateCF, decodeCF } from '../lib/cf.js';
import { placeAutocomplete } from '../lib/places.js';

const EMPTY = () => ({
  nome: '', cognome: '', sesso: '', dataNascita: '', luogoNascita: '', provinciaNascita: '', codiceFiscale: '',
  residenza: { indirizzo: '', civico: '', cap: '', comune: '', provincia: '' },
  telefono: '', email: '', discipline: [], sedeId: '', stato: 'attivo', dataIscrizione: todayISO(),
  certificato: { tipo: 'non agonistico', rilascio: '', scadenza: '', medico: '' },
  genitore: null, note: '', consensoPrivacy: false, consensoFoto: false, foto: '',
});

export default {
  title: 'Anagrafica',
  render(root, params) {
    const editing = params.id ? db.client(params.id) : null;
    if (params.id && !editing) { go('/atleti'); return; }
    const c = editing ? JSON.parse(JSON.stringify({ ...EMPTY(), ...editing })) : EMPTY();
    c.residenza = { ...EMPTY().residenza, ...(c.residenza || {}) };
    c.certificato = { ...EMPTY().certificato, ...(c.certificato || {}) };
    let showParent = !!(c.genitore && (c.genitore.nome || c.genitore.cognome));
    const g = () => (c.genitore = c.genitore || { relazione: 'Madre', nome: '', cognome: '', codiceFiscale: '', telefono: '', email: '' });

    const sedi = db.company.sedi || [];
    root.innerHTML = `
      <div class="crumbs"><a data-go="/atleti">Anagrafiche</a>${icon('chevron-right', 14)}<span>${editing ? esc(`${c.nome} ${c.cognome}`) : 'Nuovo atleta'}</span></div>
      <div class="page-head"><div><h1>${editing ? 'Modifica anagrafica' : 'Nuovo atleta / cliente'}</h1><p>I campi con * sono obbligatori. Il codice fiscale si calcola da solo.</p></div>
        <div class="actions"><button class="btn ghost" data-cancel>Annulla</button><button class="btn primary" data-save>${icon('save', 16)}Salva anagrafica</button></div></div>

      <div class="grid" style="grid-template-columns:minmax(0,1fr) 340px;align-items:start;gap:20px">
        <div class="col" style="gap:18px">
          <div class="card pad">
            <div class="form-section"><h3><span class="ico-box">${icon('user', 17)}</span>Dati anagrafici</h3>
              <div class="grid g2">
                <label class="field"><span>Nome <em>*</em></span><input name="nome" value="${esc(c.nome)}" autocomplete="off"></label>
                <label class="field"><span>Cognome <em>*</em></span><input name="cognome" value="${esc(c.cognome)}" autocomplete="off"></label>
                <div class="field"><span>Sesso</span><div class="seg" id="sesso"><button data-v="F" class="${c.sesso === 'F' ? 'active' : ''}">Femmina</button><button data-v="M" class="${c.sesso === 'M' ? 'active' : ''}">Maschio</button></div></div>
                <label class="field"><span>Data di nascita</span><input type="date" name="dataNascita" value="${esc(c.dataNascita)}" max="${todayISO()}"><small class="hint" id="ageHint"></small></label>
                <label class="field"><span>Luogo di nascita</span><div><input name="luogoNascita" value="${esc(c.luogoNascita)}" placeholder="Comune o stato estero"></div></label>
                <label class="field"><span>Provincia di nascita</span><input name="provinciaNascita" class="upper" maxlength="2" value="${esc(c.provinciaNascita)}" placeholder="Es. CT (EE se estero)"></label>
                <label class="field span-all"><span>Codice fiscale</span>
                  <div class="input-group"><input name="codiceFiscale" class="mono upper" maxlength="16" value="${esc(c.codiceFiscale)}" placeholder="Calcolalo con il pulsante o scrivilo">
                    <button class="btn" id="calcCF" type="button">${icon('wand-sparkles', 16)}Calcola</button>
                    <button class="btn ghost" id="decCF" type="button" data-tip="Ricava data, sesso e luogo dal codice">${icon('scan-line', 16)}</button></div>
                  <small class="hint" id="cfHint"></small></label>
              </div>
            </div>
          </div>

          <div class="card pad">
            <div class="form-section"><h3><span class="ico-box">${icon('house', 17)}</span>Residenza e contatti</h3>
              <div class="grid" style="grid-template-columns:3fr 1fr">
                <label class="field"><span>Indirizzo</span><input name="res.indirizzo" value="${esc(c.residenza.indirizzo)}" placeholder="Via / Piazza / Corso"></label>
                <label class="field"><span>Civico</span><input name="res.civico" value="${esc(c.residenza.civico)}"></label>
              </div>
              <div class="grid mt" style="grid-template-columns:2fr 1fr 1fr">
                <label class="field"><span>Comune</span><div><input name="res.comune" value="${esc(c.residenza.comune)}" placeholder="Inizia a scrivere…"></div></label>
                <label class="field"><span>CAP</span><input name="res.cap" maxlength="5" value="${esc(c.residenza.cap)}"></label>
                <label class="field"><span>Provincia</span><input name="res.provincia" class="upper" maxlength="2" value="${esc(c.residenza.provincia)}"></label>
              </div>
              <div class="grid g2 mt">
                <label class="field"><span>Telefono / cellulare</span><div class="input-icon">${icon('phone', 16)}<input name="telefono" value="${esc(c.telefono)}" placeholder="Per WhatsApp e promemoria"></div></label>
                <label class="field"><span>Email</span><div class="input-icon">${icon('mail', 16)}<input name="email" type="email" value="${esc(c.email)}"></div></label>
              </div>
            </div>
          </div>

          <div class="card pad">
            <div class="form-section"><h3><span class="ico-box">${icon('trophy', 17)}</span>Discipline e iscrizione</h3>
              <div class="chips" id="discs"></div>
              <div class="grid g3 mt">
                <label class="field"><span>Sede</span><select name="sedeId"><option value="">—</option>${sedi.map(s => `<option value="${s.id}" ${s.id === c.sedeId ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}</select></label>
                <label class="field"><span>Data iscrizione</span><input type="date" name="dataIscrizione" value="${esc(c.dataIscrizione)}"></label>
                <label class="field"><span>Stato</span><select name="stato"><option value="attivo" ${c.stato !== 'sospeso' ? 'selected' : ''}>Attivo</option><option value="sospeso" ${c.stato === 'sospeso' ? 'selected' : ''}>Sospeso</option></select></label>
              </div>
            </div>
          </div>

          <div class="card pad">
            <div class="form-section"><h3><span class="ico-box">${icon('heart-pulse', 17)}</span>Certificato medico</h3>
              <div class="grid g2">
                <div class="field"><span>Tipo</span><div class="seg" id="certTipo">${['non agonistico', 'agonistico', 'ludico-motorio'].map(t => `<button data-v="${t}" class="${c.certificato.tipo === t ? 'active' : ''}">${titleCase(t)}</button>`).join('')}</div></div>
                <label class="field"><span>Medico / struttura</span><input name="cert.medico" value="${esc(c.certificato.medico || '')}" placeholder="Facoltativo"></label>
                <label class="field"><span>Data di rilascio</span><input type="date" name="cert.rilascio" value="${esc(c.certificato.rilascio || '')}"></label>
                <label class="field"><span>Data di scadenza</span><input type="date" name="cert.scadenza" value="${esc(c.certificato.scadenza || '')}"><small class="hint" id="certHint"></small></label>
              </div>
              <div class="row wrap mt"><span class="muted small">Scorciatoie:</span>
                <button class="btn sm" data-cert="1y" type="button">${icon('calendar-plus', 14)}1 anno dal rilascio</button>
                <button class="btn sm" data-cert="today" type="button">${icon('calendar-check', 14)}Rilasciato oggi</button></div>
            </div>
          </div>

          <div class="card pad">
            <div class="form-section" style="margin:0"><h3><span class="ico-box">${icon('users', 17)}</span>Genitore o tutore
              <label class="switch" style="margin-left:auto"><input type="checkbox" id="parentToggle" ${showParent ? 'checked' : ''}><i></i><span class="small muted" id="parentLbl"></span></label></h3>
              <div id="parent"></div>
            </div>
          </div>

          <div class="card pad">
            <div class="form-section" style="margin:0"><h3><span class="ico-box">${icon('notebook-pen', 17)}</span>Note e consensi</h3>
              <label class="field"><span>Note</span><textarea name="note" placeholder="Allergie, esigenze, livello tecnico, taglia del body…">${esc(c.note || '')}</textarea></label>
              <div class="col mt" style="gap:10px">
                <label class="switch"><input type="checkbox" name="consensoPrivacy" ${c.consensoPrivacy ? 'checked' : ''}><i></i>Consenso al trattamento dei dati personali (GDPR)</label>
                <label class="switch"><input type="checkbox" name="consensoFoto" ${c.consensoFoto ? 'checked' : ''}><i></i>Consenso a foto e video per social e materiale della società</label>
              </div>
            </div>
          </div>
        </div>

        <div class="col" style="gap:18px;position:sticky;top:0">
          <div class="card pad" style="text-align:center">
            <div id="photo" style="display:grid;place-items:center"></div>
            <div class="row" style="justify-content:center;margin-top:14px">
              <button class="btn sm" id="photoBtn" type="button">${icon('camera', 15)}Foto</button>
              <button class="btn sm ghost" id="photoDel" type="button">${icon('trash-2', 15)}</button>
            </div>
            <h3 style="margin-top:14px" id="sumName"></h3>
            <p class="muted small" id="sumInfo"></p>
          </div>
          <div class="card pad-sm">
            <div class="row"><span class="badge accent">${icon('sparkles', 13)}Suggerimento</span></div>
            <p class="small" style="margin-top:8px;color:var(--text-2)">Scrivi nome, cognome, sesso, data e comune di nascita: premi <b>Calcola</b> e il codice fiscale è pronto. Se hai già il codice, premi ${icon('scan-line', 13)} per ricavare gli altri dati.</p>
          </div>
          <button class="btn primary lg block" data-save>${icon('save', 18)}Salva anagrafica</button>
        </div>
      </div>`;

    const f = name => $(`[name="${name}"]`, root);

    const renderDiscs = () => {
      $('#discs', root).innerHTML = db.disciplines.filter(d => d.attiva !== false || c.discipline.includes(d.id)).map(d =>
        `<button type="button" class="chip ${c.discipline.includes(d.id) ? '' : 'off'}" style="--dc:${d.colore};padding:8px 14px 8px 12px;font-size:13px" data-disc="${d.id}">${c.discipline.includes(d.id) ? icon('check', 14) : ''}${esc(d.nome)}</button>`).join('');
    };

    const renderPhoto = () => {
      $('#photo', root).innerHTML = avatar(c, 112);
      $('#photoDel', root).classList.toggle('hidden', !c.foto);
    };

    const renderSummary = () => {
      const a = age(c.dataNascita);
      $('#sumName', root).textContent = `${c.nome} ${c.cognome}`.trim() || 'Nuovo atleta';
      $('#sumInfo', root).textContent = [a !== null ? `${a} anni` : '', c.luogoNascita, editing ? `Tessera ${editing.tessera}` : ''].filter(Boolean).join(' · ');
      $('#ageHint', root).textContent = a !== null ? `${a} anni${a < 18 ? ' · minorenne' : ''}${a >= 5 && a <= 18 ? ' · detrazione 19% applicabile' : ''}` : '';
      $('#parentLbl', root).textContent = a !== null && a < 18 ? 'Consigliato per i minorenni' : '';
      if (a !== null && a < 18 && !showParent && !editing && !c._parentAsked) {
        c._parentAsked = true;
        showParent = true;
        $('#parentToggle', root).checked = true;
        renderParent();
      }
      renderPhoto();
    };

    const renderParent = () => {
      const box = $('#parent', root);
      if (!showParent) { box.innerHTML = '<p class="muted small" style="margin-top:4px">Attiva per inserire i dati del genitore o tutore: sarà l\'intestatario delle ricevute per i minorenni.</p>'; return; }
      const p = g();
      box.innerHTML = `<div class="grid g3" style="margin-top:6px">
          <label class="field"><span>Relazione</span><select name="gen.relazione">${['Madre', 'Padre', 'Tutore', 'Tutrice', 'Genitore'].map(r => `<option ${p.relazione === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
          <label class="field"><span>Nome</span><input name="gen.nome" value="${esc(p.nome)}"></label>
          <label class="field"><span>Cognome</span><input name="gen.cognome" value="${esc(p.cognome)}"></label>
          <label class="field"><span>Codice fiscale</span><input name="gen.codiceFiscale" class="mono upper" maxlength="16" value="${esc(p.codiceFiscale)}"><small class="hint" id="gcfHint"></small></label>
          <label class="field"><span>Telefono</span><input name="gen.telefono" value="${esc(p.telefono)}"></label>
          <label class="field"><span>Email</span><input name="gen.email" type="email" value="${esc(p.email)}"></label>
        </div>
        <button class="btn sm ghost mt" type="button" id="copyRes">${icon('copy', 14)}Stesso cognome dell'atleta</button>`;
      $('#copyRes', box).onclick = () => { f('gen.cognome').value = c.cognome; p.cognome = c.cognome; };
      checkGenCF();
    };

    const checkCF = () => {
      const v = c.codiceFiscale;
      const hint = $('#cfHint', root);
      const inp = f('codiceFiscale');
      if (!v) { hint.textContent = ''; hint.className = 'hint'; inp.classList.remove('invalid', 'valid'); return; }
      const r = validateCF(v);
      let msg = r.ok ? '✓ Codice fiscale valido' : r.error;
      if (r.ok && c.nome && c.cognome && c.dataNascita && c.sesso && c.luogoNascita) {
        const exp = computeCF(c);
        if (exp.ok && exp.value !== v) msg = '⚠ Valido, ma non corrisponde ai dati inseriti (possibile omocodia o dati diversi)';
      }
      hint.textContent = msg;
      hint.className = 'hint ' + (r.ok ? (msg.startsWith('⚠') ? '' : 'ok') : 'err');
      inp.classList.toggle('invalid', !r.ok);
      inp.classList.toggle('valid', r.ok);
      const dup = db.clients.find(x => x.codiceFiscale === v && (!editing || x.id !== editing.id));
      if (dup) { hint.textContent = `⚠ Codice già presente: ${dup.nome} ${dup.cognome}`; hint.className = 'hint err'; }
    };

    const checkGenCF = () => {
      const h = $('#gcfHint', root);
      if (!h || !c.genitore) return;
      const v = c.genitore.codiceFiscale;
      if (!v) { h.textContent = ''; return; }
      const r = validateCF(v);
      h.textContent = r.ok ? '✓ Valido' : r.error;
      h.className = 'hint ' + (r.ok ? 'ok' : 'err');
    };

    const checkCert = () => {
      const s = c.certificato.scadenza;
      const h = $('#certHint', root);
      if (!s) { h.textContent = 'Senza scadenza l\'atleta compare tra i “certificati mancanti”.'; h.className = 'hint'; return; }
      const d = Math.round((new Date(s + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
      h.textContent = d < 0 ? `Scaduto da ${-d} giorni` : d === 0 ? 'Scade oggi' : `Valido ancora ${d} giorni · promemoria il ${date(toISO(new Date(new Date(s + 'T00:00:00').getTime() - (db.settings.reminderDays || 30) * 86400000)))}`;
      h.className = 'hint ' + (d < 0 ? 'err' : d <= (db.settings.reminderDays || 30) ? '' : 'ok');
    };

    // ---- eventi
    on(root, 'input', 'input[name], textarea[name], select[name]', (e, t) => {
      const n = t.name;
      const v = t.type === 'checkbox' ? t.checked : t.value;
      if (n.startsWith('res.')) c.residenza[n.slice(4)] = n === 'res.provincia' ? v.toUpperCase() : v;
      else if (n.startsWith('cert.')) c.certificato[n.slice(5)] = v;
      else if (n.startsWith('gen.')) { g()[n.slice(4)] = n === 'gen.codiceFiscale' ? v.toUpperCase() : v; checkGenCF(); } else c[n] = n === 'codiceFiscale' || n === 'provinciaNascita' ? String(v).toUpperCase() : v;
      if (n === 'codiceFiscale' || ['nome', 'cognome', 'dataNascita', 'luogoNascita'].includes(n)) checkCF();
      if (n.startsWith('cert.')) checkCert();
      if (['nome', 'cognome', 'dataNascita', 'luogoNascita'].includes(n)) renderSummary();
    });
    on(root, 'change', 'input[type=checkbox][name], select[name], input[type=date][name]', (e, t) => {
      t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    root.addEventListener('focusout', e => {
      const t = e.target;
      if (t.matches && t.matches('input[name=nome], input[name=cognome], input[name="gen.nome"], input[name="gen.cognome"]') && t.value && (t.value === t.value.toLowerCase() || t.value === t.value.toUpperCase())) {
        t.value = titleCase(t.value);
        t.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    on($('#sesso', root), 'click', 'button', (e, t) => { c.sesso = t.dataset.v; $$('#sesso button', root).forEach(b => b.classList.toggle('active', b === t)); checkCF(); });
    on($('#certTipo', root), 'click', 'button', (e, t) => { c.certificato.tipo = t.dataset.v; $$('#certTipo button', root).forEach(b => b.classList.toggle('active', b === t)); });
    on(root, 'click', '[data-disc]', (e, t) => {
      const id = t.dataset.disc;
      c.discipline = c.discipline.includes(id) ? c.discipline.filter(x => x !== id) : [...c.discipline, id];
      renderDiscs();
    });
    on(root, 'click', '[data-cert]', (e, t) => {
      if (t.dataset.cert === 'today') c.certificato.rilascio = todayISO();
      const base = c.certificato.rilascio ? new Date(c.certificato.rilascio + 'T00:00:00') : new Date();
      const exp = new Date(base);
      exp.setFullYear(exp.getFullYear() + 1);
      exp.setDate(exp.getDate() - 1);
      c.certificato.scadenza = toISO(exp);
      f('cert.rilascio').value = c.certificato.rilascio || '';
      f('cert.scadenza').value = c.certificato.scadenza;
      checkCert();
    });
    $('#parentToggle', root).addEventListener('change', e => { showParent = e.target.checked; if (!showParent) c.genitore = null; renderParent(); });

    $('#calcCF', root).onclick = () => {
      const r = computeCF(c);
      if (!r.ok) { toast(r.error, { type: 'warning' }); return; }
      c.codiceFiscale = r.value;
      f('codiceFiscale').value = r.value;
      checkCF();
      toast('Codice fiscale calcolato');
    };
    $('#decCF', root).onclick = () => {
      const d = decodeCF(c.codiceFiscale);
      if (!d) { toast('Inserisci prima un codice fiscale valido', { type: 'warning' }); return; }
      Object.assign(c, { dataNascita: d.dataNascita, sesso: d.sesso, luogoNascita: d.luogoNascita || c.luogoNascita, provinciaNascita: d.provinciaNascita || c.provinciaNascita });
      f('dataNascita').value = c.dataNascita;
      f('luogoNascita').value = c.luogoNascita;
      f('provinciaNascita').value = c.provinciaNascita;
      $$('#sesso button', root).forEach(b => b.classList.toggle('active', b.dataset.v === c.sesso));
      renderSummary();
      checkCF();
      toast('Dati ricavati dal codice fiscale');
    };

    placeAutocomplete(f('luogoNascita'), {
      esteri: true,
      onPick: p => { c.luogoNascita = p.nome; c.provinciaNascita = p.prov; f('provinciaNascita').value = p.prov; checkCF(); renderSummary(); },
    });
    placeAutocomplete(f('res.comune'), {
      onPick: p => {
        c.residenza.comune = p.nome; c.residenza.provincia = p.prov;
        if (!c.residenza.cap || c.residenza.cap.length !== 5) c.residenza.cap = p.cap;
        f('res.provincia').value = p.prov; f('res.cap').value = c.residenza.cap;
      },
    });

    $('#photoBtn', root).onclick = async () => {
      const name = await pickImage({ max: 360, square: true, quality: 0.86 }).catch(() => null);
      if (!name) return;
      if (c.foto && c.foto !== editing?.foto) window.athlos.media.remove(c.foto);
      c.foto = name;
      renderPhoto();
    };
    $('#photoDel', root).onclick = () => { c.foto = ''; renderPhoto(); };

    const save = async () => {
      if (!c.nome.trim() || !c.cognome.trim()) { toast('Nome e cognome sono obbligatori', { type: 'warning' }); f(c.nome.trim() ? 'cognome' : 'nome').focus(); return; }
      if (c.codiceFiscale && !validateCF(c.codiceFiscale).ok) {
        toast('Il codice fiscale non è valido: correggilo o lascialo vuoto', { type: 'warning' });
        f('codiceFiscale').focus();
        return;
      }
      delete c._parentAsked;
      if (c.genitore && !c.genitore.nome && !c.genitore.cognome) c.genitore = null;
      c.nome = c.nome.trim();
      c.cognome = c.cognome.trim();
      if (editing && editing.foto && editing.foto !== c.foto) window.athlos.media.remove(editing.foto);
      const saved = await db.upsertClient(editing ? { ...c, id: editing.id } : c);
      db.log('client', `${editing ? 'Aggiornata' : 'Nuova'} anagrafica: ${saved.nome} ${saved.cognome}`, saved.id);
      toast(editing ? 'Anagrafica aggiornata' : `${saved.nome} ${saved.cognome} aggiunto · tessera n. ${saved.tessera}`);
      go(`/atleti/${saved.id}`);
    };
    on(root, 'click', '[data-save]', save);
    on(root, 'click', '[data-cancel]', () => go(editing ? `/atleti/${editing.id}` : '/atleti'));
    on(root, 'click', '[data-go]', (e, t) => go(t.dataset.go));
    const onKey = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
    document.addEventListener('keydown', onKey);

    renderDiscs();
    renderParent();
    renderSummary();
    checkCF();
    checkCert();
    if (!editing) setTimeout(() => f('nome').focus(), 60);
    return () => document.removeEventListener('keydown', onKey);
  },
};
