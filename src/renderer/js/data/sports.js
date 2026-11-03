// Discipline proposte al primo avvio in base al paese scelto (nomi in italiano: vengono tradotti
// nella lingua dell'utente quando si creano). Ogni società può poi aggiungere, modificare o disattivare.
export const SPORTS = {
  artistica: { nome: 'Ginnastica artistica', colore: '#6366F1', icona: 'medal', immagine: 'artistica', fed: 'gym', descrizione: 'Corpo libero, trave, parallele, volteggio e anelli.' },
  ritmica: { nome: 'Ginnastica ritmica', colore: '#EC4899', icona: 'sparkles', immagine: 'ritmica', fed: 'gym', descrizione: 'Fune, cerchio, palla, clavette e nastro.' },
  trampolino: { nome: 'Trampolino elastico', colore: '#8B5CF6', icona: 'rocket', immagine: 'artistica', fed: 'gym', descrizione: 'Salti, avvitamenti e salti mortali sul trampolino.' },
  acrobatica: { nome: 'Ginnastica acrobatica', colore: '#14B8A6', icona: 'users', immagine: 'ritmica', fed: 'gym', descrizione: 'Coppie e gruppi: equilibri, lanci e figure.' },
  aerea: { nome: 'Acrobatica aerea', colore: '#F97316', icona: 'wand-sparkles', immagine: 'aerea', fed: '', descrizione: 'Tessuti, cerchio aereo e trapezio.' },
  cheer: { nome: 'Cheerleading', colore: '#F43F5E', icona: 'megaphone', immagine: 'ritmica', fed: '', descrizione: 'Coreografie, salti, piramidi e stunt di squadra.' },
  danza: { nome: 'Danza', colore: '#A855F7', icona: 'music', immagine: 'ritmica', fed: '', descrizione: 'Classica, moderna, contemporanea e hip hop.' },
  judo: { nome: 'Judo', colore: '#0EA5E9', icona: 'shield', immagine: 'judo', fed: 'judo', descrizione: 'Arte marziale olimpica: tecnica, disciplina e rispetto.' },
  karate: { nome: 'Karate', colore: '#EF4444', icona: 'shield', immagine: 'judo', fed: '', descrizione: 'Kata e kumite per bambini, ragazzi e adulti.' },
  taekwondo: { nome: 'Taekwondo', colore: '#2563EB', icona: 'shield', immagine: 'judo', fed: '', descrizione: 'Arte marziale coreana: calci, forme e combattimento.' },
  capoeira: { nome: 'Capoeira', colore: '#EAB308', icona: 'music', immagine: 'team', fed: '', descrizione: 'Arte marziale brasiliana con musica e acrobazie.' },
  nuoto: { nome: 'Nuoto', colore: '#06B6D4', icona: 'droplet', immagine: 'fitness', fed: '', descrizione: 'Scuola nuoto, perfezionamento e agonismo.' },
  fitness: { nome: 'Salute e fitness', colore: '#10B981', icona: 'heart-pulse', immagine: 'fitness', fed: '', descrizione: 'Allenamento funzionale, tonificazione e benessere.' },
  yoga: { nome: 'Yoga e pilates', colore: '#84CC16', icona: 'heart', immagine: 'fitness', fed: '', descrizione: 'Postura, respirazione, forza e flessibilità.' },
};

// discipline suggerite per paese (le altre restano disponibili nel catalogo)
const BY_COUNTRY = [
  [['IT', 'SM'], ['artistica', 'ritmica', 'judo', 'aerea', 'fitness']],
  [['FR', 'BE', 'LU', 'MC', 'CH', 'MA', 'TN', 'DZ', 'SN'], ['artistica', 'ritmica', 'judo', 'danza', 'fitness']],
  [['DE', 'AT', 'NL', 'DK', 'SE', 'NO', 'FI'], ['artistica', 'ritmica', 'trampolino', 'judo', 'fitness']],
  [['ES'], ['artistica', 'ritmica', 'judo', 'danza', 'fitness']],
  [['PT', 'AO', 'MZ'], ['artistica', 'ritmica', 'trampolino', 'judo', 'fitness']],
  [['BR'], ['artistica', 'ritmica', 'judo', 'capoeira', 'fitness']],
  [['MX', 'AR', 'CL', 'CO', 'PE', 'UY', 'VE', 'EC', 'DO', 'CU'], ['artistica', 'ritmica', 'taekwondo', 'danza', 'fitness']],
  [['GB', 'IE', 'AU', 'NZ', 'ZA'], ['artistica', 'ritmica', 'trampolino', 'acrobatica', 'fitness']],
  [['US', 'CA'], ['artistica', 'trampolino', 'cheer', 'danza', 'fitness']],
  [['JP'], ['artistica', 'ritmica', 'judo', 'karate', 'fitness']],
  [['KR'], ['artistica', 'ritmica', 'taekwondo', 'danza', 'fitness']],
];
const DEFAULT_SET = ['artistica', 'ritmica', 'judo', 'danza', 'fitness'];

// federazioni nazionali di ginnastica e judo
const FEDERATIONS = {
  IT: ['FGI', 'FIJLKAM'], SM: ['FSGS', 'FSAM'], FR: ['FFGym', 'FFJDA'], DE: ['DTB', 'DJB'], AT: ['ÖFT', 'ÖJV'], CH: ['STV-FSG', 'SJV-FSJ'],
  ES: ['RFEG', 'RFEJYDA'], PT: ['FGP', 'FPJ'], GB: ['British Gymnastics', 'British Judo'], IE: ['Gymnastics Ireland', 'Irish Judo Association'],
  US: ['USA Gymnastics', 'USA Judo'], CA: ['Gymnastics Canada', 'Judo Canada'], BR: ['CBG', 'CBJ'], MX: ['FMG', 'FMJ'], AR: ['CAG', 'FAJ'],
  AU: ['Gymnastics Australia', 'Judo Australia'], NZ: ['Gymnastics New Zealand', 'Judo New Zealand'], BE: ['FfG / Gymfed', 'FBJ'],
  NL: ['KNGU', 'JBN'], JP: ['JGA', 'AJJF'], ZA: ['Gymnastics South Africa', 'Judo South Africa'],
};

export function sportsFor(country) {
  const hit = BY_COUNTRY.find(([codes]) => codes.includes(country));
  return hit ? hit[1] : DEFAULT_SET;
}

export function federationFor(key, country) {
  const s = SPORTS[key];
  const f = FEDERATIONS[country];
  if (!s || !f) return '';
  return s.fed === 'gym' ? f[0] : s.fed === 'judo' ? f[1] : '';
}
