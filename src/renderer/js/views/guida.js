// Guida: anteprima dei moduli con immagini, primi passi e domande frequenti.
import { db } from '../lib/db.js';
import { icon, on } from '../lib/ui.js';
import { go } from '../lib/router.js';
import { esc } from '../lib/format.js';

const MODULES = [
  { img: 'artistica', chip: 'Anagrafiche', icon: 'users', title: 'Atleti e clienti', path: '/atleti', text: 'Schede complete con genitore, residenza, discipline e certificato.', points: ['Codice fiscale calcolato e verificato', 'Ricerca per nome, cognome, disciplina', 'Import/export Excel e stampa elenco', 'Tessera atleta con QR'] },
  { img: 'ritmica', chip: 'Ricevute', icon: 'receipt-text', title: 'Ricevute generali e commerciali', path: '/ricevute', text: 'Due serie numerate che ripartono ogni 1° gennaio.', points: ['Importo in lettere automatico', 'Marca da bollo e detrazione 19%', 'Originale + copia, A4/A5/termica', 'PDF e conferma su WhatsApp'] },
  { img: 'judo', chip: 'Scadenzario', icon: 'calendar-clock', title: 'Certificati medici', path: '/scadenzario', text: 'Avvisi 30 giorni prima, con invio guidato dei promemoria.', points: ['Scaduti, in scadenza, mancanti', 'Calendario a 12 mesi', 'Rinnovo in due clic', 'Notifiche di Windows all\'avvio'] },
  { img: 'studio', chip: 'Salto Studio', icon: 'clapperboard', title: 'Editor video e grafica', path: '/studio', text: 'Montaggio a timeline e design di post in un\'unica app.', points: ['Filtri, transizioni, testi animati', 'Voce fuori campo ed effetti voce', 'Adesivi, forme, modelli pronti', 'Esportazione video e immagini'] },
  { img: 'aerea', chip: 'Comunica', icon: 'megaphone', title: 'Messaggi per i social', path: '/comunica', text: 'Modelli pronti per WhatsApp, Messenger, Facebook, Instagram e X.', points: ['Anteprima realistica per piattaforma', 'Conteggio caratteri e hashtag', 'Variabili automatiche', 'Invio a più famiglie'] },
  { img: 'team', chip: 'Squadra', icon: 'messages-square', title: 'Chat di lavoro', path: '/squadra', text: 'Lo staff comunica tra le postazioni della palestra, senza account.', points: ['Canali e messaggi diretti', 'Conferme di consegna e lettura', 'Compiti da spuntare', 'Risposte rapide e reazioni'] },
];

const STEPS = [
  ['Completa i dati della società', 'Denominazione, partita IVA, indirizzo di fatturazione, sedi e logo: compaiono su ogni ricevuta.', '/societa'],
  ['Controlla le discipline', 'Ginnastica artistica, ritmica, judo, acrobatica aerea e salute e fitness sono già pronte: imposta quote e colori.', '/discipline'],
  ['Inserisci gli atleti', 'Uno alla volta o importando un file Excel/CSV. Per i minorenni aggiungi il genitore.', '/atleti/nuovo'],
  ['Scegli la stampante', 'Imposta la stampante predefinita, il formato (A4, A5 o termica) e prova la stampa.', '/impostazioni?sezione=stampanti'],
  ['Emetti la prima ricevuta', 'Dalla scheda dell\'atleta o con Ctrl+R: causale, mesi, metodo di pagamento e stampa.', '/ricevute/nuova'],
  ['Tieni d\'occhio lo scadenzario', 'Ogni mattina Athlos ti avvisa dei certificati in scadenza: un clic e la famiglia riceve il promemoria.', '/scadenzario'],
];

const FAQ = [
  ['Come funziona la numerazione delle ricevute?', 'Ricevute generali e commerciali hanno due contatori indipendenti per ogni anno. Il 1° gennaio entrambe ripartono da 1 (Generale n. 1/2027, Commerciale n. 1/2027). Una ricevuta annullata conserva il suo numero; si può eliminare solo l\'ultima della serie, per correggere un errore.'],
  ['Posso continuare la numerazione del vecchio programma?', 'Sì: in Impostazioni › Ricevute indica il primo numero da usare per l\'anno in corso, per ciascuna serie.'],
  ['Le stampanti termiche sono supportate?', 'Sì, qualsiasi stampante installata in Windows, comprese le termiche da 80 mm e 58 mm: scegli il formato “Termica” e Athlos impagina la ricevuta in modo compatto.'],
  ['Dove sono salvati i dati? E se si rompe il PC?', 'In un archivio locale nella cartella utente di Windows, con un backup automatico ogni giorno. Da Impostazioni › Dati e backup esporti un file .athlos da conservare su chiavetta o cloud e reimportarlo su un altro PC.'],
  ['Come funziona la chat Squadra?', 'Ogni computer con Athlos sulla stessa rete della palestra trova gli altri da solo. I messaggi non passano da internet. Se un PC era spento, recupera i messaggi persi alla riaccensione.'],
  ['Il promemoria del certificato parte da solo?', 'Athlos ti avvisa ogni giorno e prepara i messaggi: con un clic si apre WhatsApp con il testo già scritto. L\'invio totalmente automatico richiede un account WhatsApp Business Platform e sarà il prossimo passo.'],
];

export default {
  title: 'Guida',
  render(root) {
    root.innerHTML = `
      <section class="hero" style="min-height:240px">
        <div class="hero-bg" style="background-image:url('assets/images/palestra.webp')"></div>
        <div><div class="hero-date">Guida e anteprima</div><h1>Benvenuto in Athlos</h1>
          <p>Tutto quello che serve per gestire ${esc(db.company.denominazione || 'la tua società')}: in pochi minuti sei operativo.</p>
          <div class="actions"><button class="btn primary" id="tour">${icon('presentation', 16)}Rivedi l'anteprima animata</button><button class="btn" data-go="/societa">${icon('rocket', 16)}Inizia dai dati società</button></div></div>
      </section>
      <h2 class="section-title mt-lg">${icon('sparkles', 20)}I moduli di Athlos</h2>
      <div class="grid g3">${MODULES.map(m => `<div class="card module-tile hoverable" data-go="${m.path}">
        <div class="mt-img"><img src="assets/images/${m.img}.webp" alt=""><span class="chip plain">${icon(m.icon, 13)} ${esc(m.chip)}</span></div>
        <div class="mt-body"><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p><ul>${m.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div></div>`).join('')}</div>
      <h2 class="section-title mt-lg">${icon('list-checks', 20)}Primi passi</h2>
      <div class="grid g2">${STEPS.map((s, i) => `<div class="guide-step"><div class="gs-num">${i + 1}</div><div class="grow"><h4>${esc(s[0])}</h4><p>${esc(s[1])}</p><button class="btn sm soft mt" data-go="${s[2]}">Vai ${icon('arrow-right', 14)}</button></div></div>`).join('')}</div>
      <h2 class="section-title mt-lg">${icon('circle-help', 20)}Domande frequenti</h2>
      <div class="col">${FAQ.map(f => `<details class="card pad-sm"><summary style="cursor:pointer;font-weight:700;list-style:none;display:flex;align-items:center;gap:10px">${icon('chevron-right', 16)}${esc(f[0])}</summary><p class="small" style="margin:10px 0 0 26px;color:var(--text-2)">${esc(f[1])}</p></details>`).join('')}</div>`;
    on(root, 'click', '[data-go]', (e, t) => {
      if (t.dataset.go === '/studio') window.athlos.system.openStudio(); else go(t.dataset.go);
    });
    root.querySelector('#tour').onclick = async () => {
      const { runOnboarding } = await import('./onboarding.js');
      await runOnboarding();
      location.reload();
    };
    root.querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => {
      d.querySelector('summary .ico').style.transform = d.open ? 'rotate(90deg)' : '';
    }));
  },
};
