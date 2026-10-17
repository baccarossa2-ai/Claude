// Libreria di messaggi pronti per WhatsApp, Messenger, Facebook, Instagram e X.
// Il testo usa *grassetto* e _corsivo_ in stile WhatsApp; per gli altri social viene convertito.

export const CATEGORIES = [
  ['tutti', 'Tutti', '✨'],
  ['certificati', 'Certificati', '🩺'],
  ['pagamenti', 'Pagamenti', '💳'],
  ['iscrizioni', 'Iscrizioni', '📝'],
  ['gare', 'Gare e risultati', '🏆'],
  ['eventi', 'Eventi e saggi', '🎭'],
  ['auguri', 'Auguri e feste', '🎉'],
  ['avvisi', 'Avvisi e orari', '📢'],
  ['promo', 'Promozioni', '🔥'],
  ['staff', 'Staff e benvenuto', '💜'],
];

export const TEMPLATES = [
  { id: 't-cert-30', cat: 'certificati', emoji: '🩺', title: 'Certificato in scadenza', text: 'Ciao {nome}! 👋\nTi ricordiamo che il *certificato medico* di {atleta} scade il *{data}*.\nPer continuare ad allenarsi senza interruzioni, portaci il nuovo certificato in segreteria. 🙏\n\nGrazie! 💜\n_{societa}_' },
  { id: 't-cert-exp', cat: 'certificati', emoji: '⛔', title: 'Certificato scaduto', text: 'Gentile {nome},\nil certificato medico di {atleta} risulta *scaduto*. ⚠️\nSenza certificato valido, per legge, non possiamo far partecipare agli allenamenti.\nTi chiediamo di consegnarlo al più presto. Grazie per la collaborazione!\n{societa}' },
  { id: 't-cert-ok', cat: 'certificati', emoji: '✅', title: 'Certificato ricevuto', text: 'Ciao {nome}! ✅ Abbiamo ricevuto il nuovo certificato medico di {atleta}. È tutto in regola, ci vediamo in palestra! 🤸‍♀️💜' },
  { id: 't-pay-rem', cat: 'pagamenti', emoji: '💳', title: 'Promemoria quota mensile', text: 'Ciao {nome}! 😊\nTi ricordiamo la *quota di {mese}* per {disciplina}: *{importo}*.\nPuoi pagare in segreteria (contanti, POS) oppure con bonifico.\nGrazie! 💜 {societa}' },
  { id: 't-pay-ok', cat: 'pagamenti', emoji: '🧾', title: 'Conferma pagamento', text: 'Gentile {nome}, confermiamo di aver ricevuto il pagamento di *{importo}* per {atleta}. 🧾 La ricevuta è pronta in segreteria. Grazie! 💜' },
  { id: 't-pay-iban', cat: 'pagamenti', emoji: '🏦', title: 'Dati per il bonifico', text: 'Ecco i dati per il bonifico 🏦\n*Intestatario:* {societa}\n*IBAN:* {iban}\n*Causale:* quota {mese} – {atleta}\nGrazie! 💜' },
  { id: 't-pay-detr', cat: 'pagamenti', emoji: '📑', title: 'Ricevute per la detrazione', text: 'Ciao {nome}! 📑 Per la dichiarazione dei redditi puoi richiedere in segreteria le ricevute delle quote di {atleta}: valgono per la *detrazione del 19%* delle spese sportive dei ragazzi dai 5 ai 18 anni. 💜' },
  { id: 't-iscr-open', cat: 'iscrizioni', emoji: '📝', title: 'Iscrizioni aperte', text: '🚀 *ISCRIZIONI APERTE!* 🚀\nLa nuova stagione di {societa} sta per iniziare!\n🤸‍♀️ Ginnastica artistica\n🎀 Ginnastica ritmica\n🥋 Judo\n🎪 Acrobatica aerea\n💪 Salute e fitness\n\n📍 {luogo}\n📞 {telefono}\nVieni a provare: *la prima lezione è gratuita!* 💜' },
  { id: 't-iscr-trial', cat: 'iscrizioni', emoji: '🎁', title: 'Lezione di prova gratuita', text: 'Vuoi provare {disciplina}? 🎁 Prenota la tua *lezione di prova gratuita* da {societa}!\nScrivici qui o chiama il {telefono}. Ti aspettiamo! 💜' },
  { id: 't-iscr-docs', cat: 'iscrizioni', emoji: '📋', title: 'Documenti per l\'iscrizione', text: 'Ciao {nome}! Per completare l\'iscrizione di {atleta} ci servono:\n✅ modulo di iscrizione firmato\n✅ certificato medico valido\n✅ copia del codice fiscale\n✅ quota di iscrizione\nGrazie! 💜 {societa}' },
  { id: 't-iscr-welcome', cat: 'iscrizioni', emoji: '🤗', title: 'Benvenuto nella famiglia', text: 'Benvenuta/o {atleta} nella famiglia di *{societa}*! 🤗💜\nSiamo felicissimi di averti con noi in {disciplina}. Ci vediamo in palestra! 🤸‍♀️' },
  { id: 't-gara-conv', cat: 'gare', emoji: '📣', title: 'Convocazione gara', text: '📣 *CONVOCAZIONE*\n{atleta} è convocata/o per *{evento}*.\n📅 {data}\n⏰ Ritrovo ore {ora}\n📍 {luogo}\nPortare: body/divisa sociale, documento e acqua. 💧\nForza ragazze e ragazzi! 💪💜' },
  { id: 't-gara-res', cat: 'gare', emoji: '🏆', title: 'Risultati di gara', text: '🏆 *Che giornata!* 🏆\nComplimenti alle nostre atlete e ai nostri atleti per i risultati a *{evento}*! 🥇🥈🥉\nOrgogliosi di voi e dello staff tecnico. Avanti così! 💜\n#{societa}' },
  { id: 't-gara-gold', cat: 'gare', emoji: '🥇', title: 'Medaglia d\'oro', text: '🥇 *MEDAGLIA D\'ORO!* 🥇\nApplausi per {atleta} che conquista il primo posto a {evento}! 👏👏👏\nTutto il lavoro in palestra ripaga. Siamo fierissimi di te! 💜' },
  { id: 't-gara-good', cat: 'gare', emoji: '🍀', title: 'In bocca al lupo', text: 'In bocca al lupo a tutte le nostre atlete e atleti in gara oggi a {evento}! 🍀💪\nDivertitevi e date il massimo. Noi facciamo il tifo per voi! 📣💜' },
  { id: 't-ev-saggio', cat: 'eventi', emoji: '🎭', title: 'Saggio di fine anno', text: '🎭 *SAGGIO DI FINE ANNO* 🎭\nVi aspettiamo per festeggiare insieme una stagione meravigliosa!\n📅 {data} ⏰ {ora}\n📍 {luogo}\nIngresso libero per famiglie e amici. Non mancate! 💜✨' },
  { id: 't-ev-open', cat: 'eventi', emoji: '🚪', title: 'Open day', text: '🚪 *OPEN DAY* da {societa}!\n📅 {data} dalle {ora}\nLezioni dimostrative, prove gratuite e tanta energia! 🤸‍♀️🥋🎪\nPorta un amico! 💜' },
  { id: 't-ev-camp', cat: 'eventi', emoji: '☀️', title: 'Camp estivo', text: '☀️ *SUMMER CAMP* ☀️\nGinnastica, giochi, acrobatica e divertimento!\n📅 {data}\n👧👦 dai 5 ai 14 anni\nPosti limitati: prenota in segreteria o al {telefono}. 💜' },
  { id: 't-ev-stage', cat: 'eventi', emoji: '🎓', title: 'Stage con tecnico ospite', text: '🎓 *STAGE SPECIALE* di {disciplina} con un tecnico ospite!\n📅 {data} ⏰ {ora}\nUn\'occasione unica per crescere. Iscrizioni in segreteria! 💜' },
  { id: 't-aug-bday', cat: 'auguri', emoji: '🎂', title: 'Buon compleanno', text: 'Tanti auguri {nome}! 🎉🎂\nTutto lo staff di {societa} ti augura un compleanno fantastico, pieno di salti di gioia! 🤸‍♀️💜' },
  { id: 't-aug-xmas', cat: 'auguri', emoji: '🎄', title: 'Buon Natale', text: '🎄 *Buon Natale* da tutta la famiglia di {societa}! 🎁\nGrazie ad atlete, atleti e famiglie per questo anno insieme. Ci vediamo dopo le feste per nuovi traguardi! ✨💜' },
  { id: 't-aug-ny', cat: 'auguri', emoji: '🎆', title: 'Buon anno', text: '🎆 *Buon {anno}!* 🎆\nChe sia un anno pieno di sport, salute e soddisfazioni. Grazie di far parte di {societa}! 💜' },
  { id: 't-aug-easter', cat: 'auguri', emoji: '🐣', title: 'Buona Pasqua', text: '🐣 Buona Pasqua da {societa}! 🌸 Un abbraccio a tutte le famiglie. La palestra resta chiusa nei giorni festivi: ci rivediamo martedì! 💜' },
  { id: 't-aug-mom', cat: 'auguri', emoji: '💐', title: 'Festa della mamma', text: '💐 Auguri a tutte le mamme che ci accompagnano ogni giorno in palestra, tra borsoni, chignon e tifo sugli spalti! Grazie! 💜 {societa}' },
  { id: 't-avv-close', cat: 'avvisi', emoji: '🔒', title: 'Chiusura palestra', text: '🔒 *AVVISO*\nLa palestra resterà chiusa il *{data}*. Le lezioni riprenderanno regolarmente il giorno successivo.\nGrazie per la comprensione! 💜 {societa}' },
  { id: 't-avv-orari', cat: 'avvisi', emoji: '🕒', title: 'Cambio orario', text: '🕒 *CAMBIO ORARIO* per {disciplina}\nDal {data} la lezione si terrà alle *{ora}*.\nPer dubbi scrivici qui. Grazie! 💜' },
  { id: 't-avv-sub', cat: 'avvisi', emoji: '🔁', title: 'Lezione sostituita', text: 'Ciao! Oggi la lezione di {disciplina} sarà tenuta da un\'altra istruttrice/istruttore dello staff. Orario e sala restano invariati. A dopo! 💜' },
  { id: 't-avv-meteo', cat: 'avvisi', emoji: '🌧️', title: 'Allerta meteo', text: '🌧️ A causa dell\'*allerta meteo* le attività di oggi sono *sospese*. La sicurezza prima di tutto! Vi aggiorniamo per i prossimi giorni. 💜 {societa}' },
  { id: 't-avv-body', cat: 'avvisi', emoji: '👗', title: 'Ordine body e divise', text: '👗 *ORDINE BODY E DIVISE*\nSono aperti gli ordini per body e tute sociali! Comunica la taglia in segreteria entro il *{data}*. 💜' },
  { id: 't-promo-friend', cat: 'promo', emoji: '👯', title: 'Porta un amico', text: '👯 *PORTA UN AMICO!* 👯\nChi porta un amico che si iscrive riceve *uno sconto sulla quota del mese*! 🎁\nPiù siamo, più ci divertiamo! 💜 {societa}' },
  { id: 't-promo-fam', cat: 'promo', emoji: '👨‍👩‍👧', title: 'Sconto famiglia', text: '👨‍👩‍👧 *SCONTO FAMIGLIA*\nFratelli e sorelle iscritti? Per il secondo figlio la quota è *scontata*! Chiedi in segreteria. 💜' },
  { id: 't-promo-fit', cat: 'promo', emoji: '💪', title: 'Fitness per i genitori', text: '💪 Mentre i ragazzi si allenano… perché non lo fai anche tu?\n*Salute e fitness* per adulti, negli stessi orari! Prima lezione gratuita. 💜 {societa}' },
  { id: 't-promo-aerea', cat: 'promo', emoji: '🎪', title: 'Scopri l\'acrobatica aerea', text: '🎪 Hai mai sognato di volare? ✨\nScopri l\'*acrobatica aerea*: tessuti, cerchio aereo e trapezio, per tutti i livelli!\nProva gratuita: {telefono} 💜' },
  { id: 't-staff-meet', cat: 'staff', emoji: '🗓️', title: 'Riunione staff', text: '🗓️ *Riunione staff* il {data} alle {ora} in palestra.\nOrdine del giorno: calendario gare, orari e organizzazione saggio. Presenza importante! 💜' },
  { id: 't-staff-thanks', cat: 'staff', emoji: '🙌', title: 'Grazie allo staff', text: '🙌 Un enorme *GRAZIE* a istruttrici, istruttori, giudici e volontari di {societa}: senza di voi niente di tutto questo sarebbe possibile! 💜' },
  { id: 't-staff-coach', cat: 'staff', emoji: '⭐', title: 'Presentazione istruttore', text: '⭐ Vi presentiamo chi allena {disciplina}: passione, esperienza e tanta pazienza! 😄\nPassate a conoscerci in palestra. 💜 {societa}' },
  { id: 't-promo-video', cat: 'promo', emoji: '🎬', title: 'Nuovo video', text: '🎬 È online il nuovo video di {societa}! Guarda che spettacolo le nostre atlete e i nostri atleti in allenamento. 🤸‍♀️🔥\nSeguici su Instagram: {instagram}' },
];

export const HASHTAGS = {
  base: ['sport', 'asd', 'palestra', 'sportgiovanile', 'teamwork', 'passione'],
  'Ginnastica artistica': ['ginnasticaartistica', 'gymnastics', 'artisticgymnastics', 'gym', 'ginnastica'],
  'Ginnastica ritmica': ['ginnasticaritmica', 'rhythmicgymnastics', 'ritmica', 'rg', 'ginnastica'],
  Judo: ['judo', 'judoitalia', 'martialarts', 'judokids', 'tatami'],
  'Acrobatica aerea': ['acrobaticaaerea', 'aerialsilks', 'aerialhoop', 'aerialist', 'circo'],
  'Salute e fitness': ['fitness', 'benessere', 'workout', 'salute', 'allenamento'],
};

export const EMOJIS = ['🤸‍♀️', '🤸‍♂️', '🎀', '🥋', '🎪', '💪', '🏆', '🥇', '🥈', '🥉', '🎉', '🎂', '💜', '❤️', '✨', '🔥', '📣', '📅', '⏰', '📍', '✅', '⚠️', '🙏', '👏', '😊', '🚀', '⭐', '🎁', '📸', '🎬', '☀️', '🎄'];

// Converte *grassetto* in caratteri Unicode che restano in grassetto su Instagram, Facebook e X
const BOLD = {};
'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('').forEach((ch, i) => {
  const cp = i < 26 ? 0x1D5D4 + i : i < 52 ? 0x1D5EE + (i - 26) : 0x1D7EC + (i - 52);
  BOLD[ch] = String.fromCodePoint(cp);
});
const ITALIC = {};
'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('').forEach((ch, i) => {
  ITALIC[ch] = String.fromCodePoint(i < 26 ? 0x1D608 + i : 0x1D622 + (i - 26));
});

export function toUnicodeStyle(text) {
  return text
    .replace(/\*([^*\n]+)\*/g, (m, t) => [...t].map(c => BOLD[c] || c).join(''))
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,!?)])/g, (m, a, t) => a + [...t].map(c => ITALIC[c] || c).join(''));
}

export function stripMarks(text) {
  return text.replace(/\*([^*\n]+)\*/g, '$1').replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,!?)])/g, '$1$2');
}

export const PLATFORMS = {
  whatsapp: { name: 'WhatsApp', icon: 'brand-whatsapp', color: '#25D366', limit: 4096 },
  messenger: { name: 'Messenger', icon: 'brand-messenger', color: '#A033FF', limit: 2000 },
  facebook: { name: 'Facebook', icon: 'brand-facebook', color: '#1877F2', limit: 63206 },
  instagram: { name: 'Instagram', icon: 'brand-instagram', color: '#E1306C', limit: 2200 },
  x: { name: 'X', icon: 'brand-x', color: '#0F1419', limit: 280 },
};

// Adatta il testo alla piattaforma: formattazione, hashtag, lunghezza
export function adapt(text, platform, { unicodeBold = true, hashtags = [] } = {}) {
  let t = text;
  if (platform !== 'whatsapp') t = unicodeBold && platform !== 'messenger' ? toUnicodeStyle(t) : stripMarks(t);
  const tags = hashtags.map(h => '#' + h.replace(/^#/, ''));
  if (tags.length) {
    if (platform === 'instagram') t += '\n.\n.\n' + tags.slice(0, 30).join(' ');
    else if (platform === 'x') t += '\n' + tags.slice(0, 3).join(' ');
    else if (platform === 'facebook') t += '\n\n' + tags.slice(0, 8).join(' ');
    else if (platform === 'whatsapp' || platform === 'messenger') t += '';
  }
  return t;
}

// Conteggio caratteri come lo fa X (emoji = 2, link = 23)
export function xLength(text) {
  const noLinks = text.replace(/https?:\/\/\S+/g, 'x'.repeat(23));
  let n = 0;
  for (const ch of noLinks) n += ch.codePointAt(0) > 0x2FFF ? 2 : 1;
  return n;
}

export function shortenForX(text) {
  if (xLength(text) <= 280) return text;
  const lines = text.split('\n').filter(l => l.trim());
  let out = '';
  for (const l of lines) {
    const next = out ? `${out}\n${l}` : l;
    if (xLength(next) > 276) break;
    out = next;
  }
  if (!out) out = [...text].slice(0, 270).join('');
  return out + ' …';
}
