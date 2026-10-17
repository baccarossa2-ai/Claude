// Stato dell'applicazione in memoria, sincronizzato con l'archivio locale del processo principale.
import { uid, todayISO, normalize, fullName } from './format.js';

export const DEFAULT_DISCIPLINES = [
  { id: 'd-artistica', nome: 'Ginnastica artistica', colore: '#6366F1', icona: 'medal', immagine: 'artistica', federazione: 'FGI', quotaMensile: 50, quotaIscrizione: 30, descrizione: 'Corpo libero, trave, parallele, volteggio e anelli.' },
  { id: 'd-ritmica', nome: 'Ginnastica ritmica', colore: '#EC4899', icona: 'sparkles', immagine: 'ritmica', federazione: 'FGI', quotaMensile: 50, quotaIscrizione: 30, descrizione: 'Fune, cerchio, palla, clavette e nastro.' },
  { id: 'd-judo', nome: 'Judo', colore: '#0EA5E9', icona: 'shield', immagine: 'judo', federazione: 'FIJLKAM', quotaMensile: 45, quotaIscrizione: 30, descrizione: 'Arte marziale olimpica: tecnica, disciplina e rispetto.' },
  { id: 'd-aerea', nome: 'Acrobatica aerea', colore: '#F97316', icona: 'wand-sparkles', immagine: 'aerea', federazione: '', quotaMensile: 55, quotaIscrizione: 30, descrizione: 'Tessuti, cerchio aereo e trapezio.' },
  { id: 'd-fitness', nome: 'Salute e fitness', colore: '#10B981', icona: 'heart-pulse', immagine: 'fitness', federazione: '', quotaMensile: 40, quotaIscrizione: 20, descrizione: 'Allenamento funzionale, tonificazione e benessere.' },
];

export const DEFAULT_CAUSALI = [
  { id: 'c-quota', descrizione: 'Quota mensile corso', tipo: 'generale', importo: 0, usaQuotaDisciplina: true },
  { id: 'c-iscr', descrizione: 'Quota di iscrizione e tesseramento annuale', tipo: 'generale', importo: 30 },
  { id: 'c-assoc', descrizione: 'Quota associativa annuale', tipo: 'generale', importo: 20 },
  { id: 'c-gara', descrizione: 'Iscrizione gara / evento', tipo: 'generale', importo: 15 },
  { id: 'c-trim', descrizione: 'Quota trimestrale corso', tipo: 'generale', importo: 140 },
  { id: 'c-body', descrizione: 'Body / divisa sociale', tipo: 'commerciale', importo: 45 },
  { id: 'c-tuta', descrizione: 'Tuta di rappresentanza', tipo: 'commerciale', importo: 60 },
  { id: 'c-attr', descrizione: 'Attrezzi (nastro, cerchio, palla, clavette)', tipo: 'commerciale', importo: 25 },
  { id: 'c-pers', descrizione: 'Lezione individuale / personal training', tipo: 'commerciale', importo: 35 },
];

export const PAYMENT_METHODS = ['Contanti', 'POS / Bancomat', 'Carta di credito', 'Bonifico bancario', 'Satispay', 'PayPal', 'Assegno'];

export function defaultCompany() {
  return {
    tipoSoggetto: 'ente',
    denominazione: 'Athletic Club',
    formaGiuridica: 'A.S.D.',
    nome: '',
    cognome: '',
    partitaIva: '',
    codiceFiscale: '',
    fatturazione: { indirizzo: '', civico: '', cap: '', comune: '', provincia: '', nazione: 'Italia' },
    sedi: [{ id: uid('s-'), nome: 'Sede principale', indirizzo: '', civico: '', cap: '', comune: '', provincia: '', telefono: '', principale: true }],
    telefono: '',
    cellulare: '',
    email: '',
    pec: '',
    sito: '',
    codiceSdi: '',
    iban: '',
    presidente: '',
    registroRasd: '',
    affiliazioni: '',
    social: { instagram: '', facebook: '', tiktok: '', x: '', youtube: '' },
    logo: '',
  };
}

export function defaultSettings() {
  return {
    theme: 'auto',
    onboardingDone: false,
    sidebarCollapsed: false,
    reminderDays: 30,
    notifyOnStart: true,
    printer: { deviceName: '', formato: 'A4', copie: 1, silent: false, doppiaCopia: false },
    receipts: {
      startNumbers: {},
      footer: 'Grazie per la fiducia! Conserva questa ricevuta.',
      detrazioneAuto: true,
      bolloAuto: true,
      bolloThreshold: 77.47,
      bolloAmount: 2,
      causali: DEFAULT_CAUSALI.map(c => ({ ...c })),
      firma: '',
    },
    reminderTemplate: 'Ciao {nome}! 👋 Ti ricordiamo che il certificato medico di {atleta} {frase}. Per continuare ad allenarsi senza interruzioni, portaci il nuovo certificato in segreteria. Grazie! 💜 {societa}',
    birthdayTemplate: 'Tanti auguri {nome}! 🎉🎂 Tutto lo staff di {societa} ti augura un compleanno fantastico e pieno di salti di gioia! 🤸‍♀️💜',
    chat: { profile: null, networkKey: '' },
    pin: '',
    lockOnStart: false,
  };
}

const listeners = new Map();
let data = {};

function emit(col) {
  for (const cb of listeners.get(col) || []) cb(data[col]);
  for (const cb of listeners.get('*') || []) cb(col);
}

export const db = {
  async init() {
    const raw = await window.athlos.db.load();
    data = raw || {};
    let changed = false;
    if (!data.company) { data.company = defaultCompany(); changed = true; }
    if (!data.disciplines) { data.disciplines = DEFAULT_DISCIPLINES.map(d => ({ ...d, attiva: true, createdAt: new Date().toISOString() })); changed = true; }
    if (!data.clients) { data.clients = []; changed = true; }
    if (!data.receipts) { data.receipts = []; changed = true; }
    if (!data.reminders) { data.reminders = []; changed = true; }
    if (!data.activity) { data.activity = []; changed = true; }
    if (!data.templates) { data.templates = []; changed = true; }
    const ds = defaultSettings();
    data.settings = { ...ds, ...(data.settings || {}) };
    data.settings.printer = { ...ds.printer, ...(data.settings.printer || {}) };
    data.settings.receipts = { ...ds.receipts, ...(data.settings.receipts || {}) };
    data.settings.chat = { ...ds.chat, ...(data.settings.chat || {}) };
    if (changed) {
      for (const k of ['company', 'disciplines', 'clients', 'receipts', 'reminders', 'activity', 'templates', 'settings']) await window.athlos.db.put(k, data[k]);
    }
    window.athlos.on('db:changed', async () => {
      const fresh = await window.athlos.db.load();
      data = { ...data, ...fresh };
      emit('*');
    });
    return data;
  },

  get(col) { return data[col]; },
  get company() { return data.company; },
  get disciplines() { return data.disciplines; },
  get clients() { return data.clients; },
  get receipts() { return data.receipts; },
  get settings() { return data.settings; },
  get activity() { return data.activity; },
  get reminders() { return data.reminders; },
  get templates() { return data.templates; },
  get all() { return data; },

  async save(col, value) {
    if (value !== undefined) data[col] = value;
    await window.athlos.db.put(col, data[col]);
    emit(col);
  },

  on(col, cb) {
    if (!listeners.has(col)) listeners.set(col, new Set());
    listeners.get(col).add(cb);
    return () => listeners.get(col).delete(cb);
  },

  // ------------------------------------------------ attività recente
  log(type, text, ref) {
    data.activity.unshift({ id: uid('a-'), ts: Date.now(), type, text, ref: ref || null });
    if (data.activity.length > 300) data.activity.length = 300;
    this.save('activity');
  },

  // ------------------------------------------------ discipline
  discipline(id) { return data.disciplines.find(d => d.id === id); },
  activeDisciplines() { return data.disciplines.filter(d => d.attiva !== false); },

  // ------------------------------------------------ anagrafiche
  client(id) { return data.clients.find(c => c.id === id); },

  async upsertClient(c) {
    const now = new Date().toISOString();
    const i = data.clients.findIndex(x => x.id === c.id);
    if (i >= 0) {
      data.clients[i] = { ...data.clients[i], ...c, updatedAt: now };
    } else {
      const max = data.clients.reduce((m, x) => Math.max(m, Number(x.tessera) || 0), 0);
      const { id, ...rest } = c;
      c = { id: id || uid('c-'), tessera: String(max + 1).padStart(4, '0'), stato: 'attivo', dataIscrizione: todayISO(), createdAt: now, ...rest, updatedAt: now };
      data.clients.push(c);
    }
    await this.save('clients');
    return i >= 0 ? data.clients[i] : c;
  },

  async removeClient(id) {
    const c = this.client(id);
    data.clients = data.clients.filter(x => x.id !== id);
    await this.save('clients');
    return c;
  },

  searchClients(q, { discipline, filter } = {}) {
    const terms = normalize(q).split(/\s+/).filter(Boolean);
    return data.clients.filter(c => {
      if (discipline && !(c.discipline || []).includes(discipline)) return false;
      if (filter && !filter(c)) return false;
      if (!terms.length) return true;
      const disc = (c.discipline || []).map(id => (this.discipline(id) || {}).nome || '').join(' ');
      const hay = normalize([c.nome, c.cognome, c.codiceFiscale, c.telefono, c.email, c.tessera, disc,
        c.genitore && c.genitore.nome, c.genitore && c.genitore.cognome, c.residenza && c.residenza.comune].join(' '));
      return terms.every(t => hay.includes(t));
    }).sort((a, b) => fullName(a).localeCompare(fullName(b), 'it'));
  },

  // ------------------------------------------------ ricevute
  nextReceiptNumber(tipo, anno) {
    const start = Number(((data.settings.receipts.startNumbers || {})[anno] || {})[tipo]) || 1;
    const max = data.receipts.filter(r => r.tipo === tipo && Number(r.anno) === Number(anno)).reduce((m, r) => Math.max(m, Number(r.numero) || 0), 0);
    return Math.max(max + 1, start);
  },

  async addReceipt(r) {
    const anno = Number(r.data.slice(0, 4));
    const rec = {
      id: uid('r-'),
      createdAt: new Date().toISOString(),
      annullata: false,
      ...r,
      anno,
      numero: this.nextReceiptNumber(r.tipo, anno),
    };
    data.receipts.push(rec);
    await this.save('receipts');
    return rec;
  },

  async updateReceipt(id, patch) {
    const r = data.receipts.find(x => x.id === id);
    if (!r) return null;
    Object.assign(r, patch, { updatedAt: new Date().toISOString() });
    await this.save('receipts');
    return r;
  },

  isLastOfSeries(r) {
    return !data.receipts.some(x => x.tipo === r.tipo && x.anno === r.anno && x.numero > r.numero);
  },

  async removeReceipt(id) {
    data.receipts = data.receipts.filter(x => x.id !== id);
    await this.save('receipts');
  },

  receiptsOf(clientId) {
    return data.receipts.filter(r => r.clientId === clientId).sort((a, b) => b.data.localeCompare(a.data) || b.numero - a.numero);
  },
};
