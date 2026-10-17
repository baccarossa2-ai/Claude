// Anteprima di benvenuto e prima configurazione guidata.
import { db } from '../lib/db.js';
import { icon, el, $, $$, confetti, on } from '../lib/ui.js';
import { esc } from '../lib/format.js';
import { validatePIVA, validateCF } from '../lib/cf.js';
import { ensureProfile } from '../lib/chatstate.js';
import { createDemoData } from '../data/demo.js';

export const SLIDES = [
  {
    img: 'palestra', chip: 'Benvenuto', title: 'La tua società, <em>tutta in un\'unica app</em>.',
    text: 'Athlos riunisce anagrafiche, ricevute, certificati medici, stampa, grafica, video e comunicazione. Funziona sul tuo PC, anche senza internet, e i dati restano tuoi.',
    features: [
      ['users', 'Anagrafiche complete', 'Atleti, genitori, residenza, codice fiscale calcolato in automatico.'],
      ['receipt-text', 'Ricevute numerate', 'Generali e commerciali, numerazione separata che riparte ogni 1° gennaio.'],
      ['calendar-clock', 'Scadenzario', 'Certificati medici sotto controllo, con avvisi 30 giorni prima.'],
      ['printer', 'Stampa reale', 'Stampanti A4, A5 e termiche da 80 mm, oppure PDF.'],
    ],
  },
  {
    img: 'artistica', chip: 'Anagrafiche', title: 'Trova chiunque <em>in un istante</em>.',
    text: 'Cerca per nome, cognome, codice fiscale o disciplina: “Di Mauro”, “ritmica”, “Aurora”. Con Ctrl+K la ricerca globale è sempre a portata di mano.',
    features: [
      ['scan-line', 'Codice fiscale automatico', 'Calcolato da nome, data e comune; verifica e decodifica inclusi.'],
      ['map-pin', '7.904 comuni italiani', 'Provincia e CAP compilati da soli mentre scrivi.'],
      ['id-card', 'Tessera con QR', 'Tessera atleta pronta da stampare.'],
      ['file-spreadsheet', 'Importa ed esporta', 'Carica gli elenchi da Excel (CSV) in un clic.'],
    ],
  },
  {
    img: 'ritmica', chip: 'Ricevute', title: 'Ricevute perfette, <em>senza pensarci</em>.',
    text: 'Scegli l\'atleta, la causale e il metodo di pagamento: Athlos scrive l\'importo in lettere, aggiunge la marca da bollo quando serve e la dicitura per la detrazione fiscale dei minori.',
    features: [
      ['hash', 'Due serie numerate', 'Generale n. 1, 2, 3… e Commerciale n. 1, 2, 3… ogni anno.'],
      ['stamp', 'Marca da bollo', 'Avviso automatico sopra 77,47 € per le ricevute esenti.'],
      ['baby', 'Detrazione 19%', 'Dicitura automatica per gli atleti dai 5 ai 18 anni.'],
      ['file-down', 'PDF e stampa', 'Originale e copia, su A4, A5 o termica.'],
    ],
  },
  {
    img: 'studio', chip: 'Salto Studio', title: 'Video e grafiche <em>da far invidia</em>.',
    text: 'Salto Studio unisce il montaggio video a timeline con il design di grafiche: filtri, transizioni, testi animati, adesivi, voce fuori campo, effetti sonori e modelli pronti per Instagram, TikTok, Facebook e YouTube.',
    features: [
      ['film', 'Timeline multitraccia', 'Taglia, dividi, velocizza e sovrapponi clip.'],
      ['mic', 'Voce fuori campo', 'Registra la tua voce e applica effetti voce.'],
      ['wand-sparkles', 'Effetti e filtri', 'Decine di filtri, transizioni, animazioni e chroma key.'],
      ['layout-template', 'Modelli pronti', 'Gare, saggi, iscrizioni aperte, auguri e risultati.'],
    ],
  },
  {
    img: 'team', chip: 'Squadra & Comunica', title: 'Lo staff connesso, <em>i social pronti</em>.',
    text: 'Squadra è la chat di lavoro tra le postazioni della palestra: canali, messaggi diretti, compiti da spuntare e conferme di lettura. Comunica prepara i messaggi per WhatsApp, Messenger, Facebook, Instagram e X.',
    features: [
      ['messages-square', 'Chat in rete locale', 'Nessun account, nessun server: funziona sulla rete della palestra.'],
      ['list-checks', 'Compiti', 'Trasforma un messaggio in un compito da completare.'],
      ['brand-whatsapp', 'Messaggi pronti', 'Decine di modelli per avvisi, gare, auguri e promozioni.'],
      ['brand-instagram', 'Anteprima social', 'Vedi il post come apparirà su ogni piattaforma.'],
    ],
  },
];

export function runOnboarding() {
  return new Promise(resolve => {
    const node = el(`<div class="onb">
      <div class="onb-drag"></div>
      <div class="onb-media">${['palestra', 'artistica', 'ritmica', 'judo', 'aerea', 'fitness', 'studio', 'team'].map(i => `<img src="assets/images/${i}.webp" data-img="${i}" alt="">`).join('')}
        <div class="onb-caption"></div>
      </div>
      <div class="onb-panel"><div class="onb-content"></div></div>
    </div>`);
    document.body.appendChild(node);
    const content = $('.onb-content', node);
    let step = 0;
    const totalSlides = SLIDES.length;
    const draft = JSON.parse(JSON.stringify(db.company));
    const discOn = new Set(db.disciplines.map(d => d.id));
    let myName = '';
    let myRole = 'Segreteria';
    let demo = false;

    const showImg = name => $$('.onb-media img', node).forEach(i => i.classList.toggle('on', i.dataset.img === name));
    const dots = () => `<div class="onb-dots">${Array.from({ length: totalSlides + 3 }, (_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>`;

    const render = () => {
      if (step < totalSlides) {
        const s = SLIDES[step];
        showImg(s.img);
        $('.onb-caption', node).innerHTML = `<span class="chip plain">${esc(s.chip)}</span>`;
        content.innerHTML = `<div class="onb-step">
          ${step === 0 ? `<img src="assets/logo.svg" style="width:64px;height:64px;margin-bottom:22px;filter:drop-shadow(0 14px 30px rgba(139,61,240,.7))" alt="">` : ''}
          <div class="eyebrow" style="margin-bottom:10px">${esc(s.chip)} · ${step + 1} di ${totalSlides}</div>
          <h1>${s.title}</h1>
          <p>${esc(s.text)}</p>
          <div class="onb-features">${s.features.map((f, i) => `<div class="onb-feature" style="animation-delay:${0.1 + i * 0.07}s"><span class="of-ico">${icon(f[0], 18)}</span><div><b>${esc(f[1])}</b><small>${esc(f[2])}</small></div></div>`).join('')}</div>
        </div>
        <div class="onb-foot">${dots()}<div class="grow"></div>
          ${step > 0 ? `<button class="btn" data-a="prev">${icon('arrow-left', 16)}Indietro</button>` : `<button class="btn ghost" data-a="skip" style="color:#A9A2D6">Salta l'anteprima</button>`}
          <button class="btn primary lg" data-a="next">${step === totalSlides - 1 ? 'Configura la società' : 'Avanti'}${icon('arrow-right', 17)}</button>
        </div>`;
      } else if (step === totalSlides) {
        showImg('palestra');
        $('.onb-caption', node).innerHTML = `<span class="chip plain">Passo 1 di 3 · Società</span>`;
        content.innerHTML = `<div class="onb-step">
          <div class="eyebrow" style="margin-bottom:10px">Configurazione · 1 di 3</div>
          <h1>I dati della <em>tua società</em></h1>
          <p>Compaiono su ogni ricevuta. Puoi completarli o cambiarli in qualsiasi momento da “Dati società”.</p>
          <div class="col" style="margin-top:24px;gap:14px">
            <div class="seg" id="tipo"><button data-v="ente" class="${draft.tipoSoggetto !== 'persona' ? 'active' : ''}">${icon('building-2', 15)}Società / associazione</button><button data-v="persona" class="${draft.tipoSoggetto === 'persona' ? 'active' : ''}">${icon('user', 15)}Persona fisica</button></div>
            <div id="nameFields"></div>
            <div class="grid g2">
              <label class="field"><span>Partita IVA</span><input id="piva" class="mono" maxlength="13" value="${esc(draft.partitaIva)}" placeholder="11 cifre"><small class="hint" id="pivaHint"></small></label>
              <label class="field"><span>Codice fiscale</span><input id="cf" class="mono upper" maxlength="16" value="${esc(draft.codiceFiscale)}" placeholder="Codice fiscale"><small class="hint" id="cfHint"></small></label>
            </div>
            <div class="grid" style="grid-template-columns:2fr 1fr">
              <label class="field"><span>Indirizzo di fatturazione</span><input id="ind" value="${esc(draft.fatturazione.indirizzo)}" placeholder="Via / Piazza"></label>
              <label class="field"><span>Civico</span><input id="civ" value="${esc(draft.fatturazione.civico)}"></label>
            </div>
            <div class="grid" style="grid-template-columns:1fr 2fr 1fr">
              <label class="field"><span>CAP</span><input id="cap" maxlength="5" value="${esc(draft.fatturazione.cap)}"></label>
              <label class="field"><span>Comune</span><input id="com" value="${esc(draft.fatturazione.comune)}"></label>
              <label class="field"><span>Prov.</span><input id="prv" class="upper" maxlength="2" value="${esc(draft.fatturazione.provincia)}"></label>
            </div>
          </div>
        </div>
        <div class="onb-foot">${dots()}<div class="grow"></div><button class="btn" data-a="prev">${icon('arrow-left', 16)}Indietro</button><button class="btn primary lg" data-a="next">Continua${icon('arrow-right', 17)}</button></div>`;
        const nameFields = () => {
          $('#nameFields', node).innerHTML = draft.tipoSoggetto === 'persona'
            ? `<div class="grid g2"><label class="field"><span>Nome</span><input id="nome" value="${esc(draft.nome)}"></label><label class="field"><span>Cognome</span><input id="cognome" value="${esc(draft.cognome)}"></label></div>`
            : `<div class="grid" style="grid-template-columns:2fr 1fr"><label class="field"><span>Denominazione sociale</span><input id="den" value="${esc(draft.denominazione)}" placeholder="Es. Athletic Club"></label>
               <label class="field"><span>Forma giuridica</span><select id="forma">${['A.S.D.', 'S.S.D. a r.l.', 'S.S.D. cooperativa', 'Associazione', 'S.r.l.', 'Ditta individuale', 'Altro'].map(f => `<option ${draft.formaGiuridica === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label></div>`;
        };
        nameFields();
        on($('#tipo', node), 'click', 'button', (e, b) => {
          collectCompany();
          draft.tipoSoggetto = b.dataset.v;
          $$('#tipo button', node).forEach(x => x.classList.toggle('active', x === b));
          nameFields();
        });
        const check = () => {
          const p = $('#piva', node).value.trim();
          const c = $('#cf', node).value.trim();
          const pv = p ? validatePIVA(p) : null;
          const cv = c ? validateCF(c) : null;
          $('#pivaHint', node).textContent = pv ? (pv.ok ? '✓ Partita IVA valida' : pv.error) : '';
          $('#pivaHint', node).className = 'hint ' + (pv ? (pv.ok ? 'ok' : 'err') : '');
          $('#cfHint', node).textContent = cv ? (cv.ok ? '✓ Codice fiscale valido' : cv.error) : '';
          $('#cfHint', node).className = 'hint ' + (cv ? (cv.ok ? 'ok' : 'err') : '');
        };
        $('#piva', node).addEventListener('input', check);
        $('#cf', node).addEventListener('input', check);
        check();
      } else if (step === totalSlides + 1) {
        showImg('judo');
        $('.onb-caption', node).innerHTML = `<span class="chip plain">Passo 2 di 3 · Discipline</span>`;
        content.innerHTML = `<div class="onb-step">
          <div class="eyebrow" style="margin-bottom:10px">Configurazione · 2 di 3</div>
          <h1>Le <em>discipline</em> che pratichi</h1>
          <p>Abbiamo già preparato le tue cinque discipline. Disattiva quelle che non ti servono: potrai aggiungerne altre e cambiare quote e colori in “Discipline”.</p>
          <div class="col" style="margin-top:24px;gap:10px">
            ${db.disciplines.map(d => `<div class="onb-disc"><img src="assets/images/${d.immagine || 'palestra'}.webp" alt=""><div class="grow"><b>${esc(d.nome)}</b><div class="tiny" style="color:#A9A2D6">${esc(d.descrizione || '')}</div></div>
              <label class="switch"><input type="checkbox" data-disc="${d.id}" ${discOn.has(d.id) ? 'checked' : ''}><i></i></label></div>`).join('')}
          </div>
        </div>
        <div class="onb-foot">${dots()}<div class="grow"></div><button class="btn" data-a="prev">${icon('arrow-left', 16)}Indietro</button><button class="btn primary lg" data-a="next">Continua${icon('arrow-right', 17)}</button></div>`;
        on(content, 'change', '[data-disc]', (e, t) => { if (t.checked) discOn.add(t.dataset.disc); else discOn.delete(t.dataset.disc); });
      } else {
        showImg('team');
        $('.onb-caption', node).innerHTML = `<span class="chip plain">Passo 3 di 3 · Tu</span>`;
        content.innerHTML = `<div class="onb-step">
          <div class="eyebrow" style="margin-bottom:10px">Configurazione · 3 di 3</div>
          <h1>Ultimo passo: <em>chi sei?</em></h1>
          <p>Il tuo nome appare nella chat Squadra e nei messaggi interni. Puoi anche caricare alcuni atleti di esempio per provare subito ricevute e scadenzario.</p>
          <div class="col" style="margin-top:24px;gap:14px">
            <div class="grid g2">
              <label class="field"><span>Il tuo nome</span><input id="myName" value="${esc(myName)}" placeholder="Es. Giulia"></label>
              <label class="field"><span>Ruolo</span><select id="myRole">${['Segreteria', 'Presidente', 'Direttore tecnico', 'Istruttore', 'Allenatrice', 'Amministrazione', 'Staff'].map(r => `<option ${r === myRole ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
            </div>
            <div class="onb-disc" style="padding:16px"><span class="of-ico" style="width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:var(--grad)">${icon('sparkles', 20)}</span>
              <div class="grow"><b>Carica 24 atleti di esempio</b><div class="tiny" style="color:#A9A2D6">Dati inventati per fare pratica. Li elimini con un clic da Impostazioni › Dati.</div></div>
              <label class="switch"><input type="checkbox" id="demo" ${demo ? 'checked' : ''}><i></i></label></div>
          </div>
        </div>
        <div class="onb-foot">${dots()}<div class="grow"></div><button class="btn" data-a="prev">${icon('arrow-left', 16)}Indietro</button><button class="btn primary lg" data-a="finish">${icon('rocket', 17)}Inizia a usare Athlos</button></div>`;
        $('#myName', node).addEventListener('input', e => { myName = e.target.value; });
        $('#myRole', node).addEventListener('change', e => { myRole = e.target.value; });
        $('#demo', node).addEventListener('change', e => { demo = e.target.checked; });
      }
    };

    function collectCompany() {
      if (step !== totalSlides) return;
      const v = id => ($('#' + id, node) ? $('#' + id, node).value.trim() : undefined);
      if (draft.tipoSoggetto === 'persona') {
        draft.nome = v('nome') ?? draft.nome;
        draft.cognome = v('cognome') ?? draft.cognome;
      } else {
        draft.denominazione = v('den') ?? draft.denominazione;
        draft.formaGiuridica = v('forma') ?? draft.formaGiuridica;
      }
      draft.partitaIva = v('piva') ?? draft.partitaIva;
      draft.codiceFiscale = (v('cf') ?? draft.codiceFiscale).toUpperCase();
      Object.assign(draft.fatturazione, { indirizzo: v('ind'), civico: v('civ'), cap: v('cap'), comune: v('com'), provincia: (v('prv') || '').toUpperCase() });
    }

    const finish = async () => {
      collectCompany();
      await db.save('company', draft);
      for (const d of db.disciplines) d.attiva = discOn.has(d.id);
      await db.save('disciplines');
      if (myName.trim()) await ensureProfile({ nome: myName.trim(), ruolo: myRole });
      if (demo) await createDemoData();
      db.settings.onboardingDone = true;
      await db.save('settings');
      db.log('setup', 'Configurazione iniziale completata');
      confetti();
      node.style.transition = 'opacity .6s, transform .6s';
      node.style.opacity = '0';
      node.style.transform = 'scale(1.03)';
      setTimeout(() => { node.remove(); resolve(); }, 600);
    };

    on(node, 'click', '[data-a]', (e, b) => {
      const a = b.dataset.a;
      collectCompany();
      if (a === 'next') step++;
      if (a === 'prev') step--;
      if (a === 'skip') step = totalSlides;
      if (a === 'finish') return finish();
      render();
    });
    document.addEventListener('keydown', function k(e) {
      if (!document.body.contains(node)) { document.removeEventListener('keydown', k); return; }
      if (e.target.matches('input, select, textarea')) return;
      if (e.key === 'ArrowRight' && step < totalSlides) { step++; render(); }
      if (e.key === 'ArrowLeft' && step > 0 && step <= totalSlides) { step--; render(); }
    });
    render();
  });
}
