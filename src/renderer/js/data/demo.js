// Dati di esempio inventati, per provare l'app senza inserire persone reali.
// Tutti i record hanno demo: true e si eliminano da Impostazioni › Dati.
import { db } from '../lib/db.js';
import { computeCF } from '../lib/cf.js';
import { toISO, uid } from '../lib/format.js';

const NOMI_F = ['Sofia', 'Giulia', 'Martina', 'Chiara', 'Alice', 'Emma', 'Greta', 'Beatrice', 'Ginevra', 'Matilde', 'Noemi', 'Viola', 'Elena', 'Bianca', 'Rebecca', 'Gaia'];
const NOMI_M = ['Leonardo', 'Francesco', 'Lorenzo', 'Tommaso', 'Mattia', 'Gabriele', 'Riccardo', 'Edoardo'];
const COGNOMI = ['Rinaldi', 'Ferraro', 'Lombardo', 'Marchetti', 'Caruso', 'Bellini', 'Santoro', 'Fontana', 'Moretti', 'Barbieri', 'Galli', 'Conti', 'Testa', 'Gentile', 'Longo', 'Martini', 'Vitale', 'Serra', 'Leone', 'Colombo', 'Grasso', 'Pellegrino', 'Russo', 'Messina'];
const LUOGHI = [['Catania', 'CT'], ['Acireale', 'CT'], ['Misterbianco', 'CT'], ['Paternò', 'CT'], ['Siracusa', 'SR'], ['Messina', 'ME'], ['Palermo', 'PA'], ['Roma', 'RM'], ['Milano', 'MI']];
const VIE = ['Via Etnea', 'Via Garibaldi', 'Corso Italia', 'Via Roma', 'Viale Mario Rapisardi', 'Via Vittorio Emanuele', 'Piazza Verga', 'Via dei Mille'];

function rng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

export async function createDemoData() {
  const r = rng(20261017);
  const pick = a => a[Math.floor(r() * a.length)];
  const now = new Date();
  const discIds = db.disciplines.map(d => d.id);
  const created = [];
  for (let i = 0; i < 24; i++) {
    const female = i % 4 !== 3;
    const nome = female ? NOMI_F[i % NOMI_F.length] : NOMI_M[i % NOMI_M.length];
    const cognome = COGNOMI[i % COGNOMI.length];
    const adult = i >= 20;
    const ageY = adult ? 25 + Math.floor(r() * 25) : 5 + Math.floor(r() * 12);
    const birth = new Date(now.getFullYear() - ageY, Math.floor(r() * 12), 1 + Math.floor(r() * 27));
    if (i === 2) birth.setMonth(now.getMonth(), now.getDate()); // un compleanno oggi
    const [luogo, prov] = pick(LUOGHI);
    const sesso = female ? 'F' : 'M';
    const cf = computeCF({ nome, cognome, dataNascita: toISO(birth), sesso, luogoNascita: luogo, provinciaNascita: prov });
    const scad = new Date(now);
    scad.setDate(scad.getDate() + [-12, -3, 2, 6, 11, 18, 25, 29, 45, 80, 120, 200, 260, 300][i % 14] + Math.floor(r() * 3));
    let discs;
    if (adult) discs = [i % 2 ? 'd-fitness' : 'd-aerea'];
    else if (!female) discs = ['d-judo'];
    else discs = [['d-artistica', 'd-ritmica', 'd-artistica', 'd-ritmica', 'd-aerea'][i % 5]];
    if (i % 7 === 0 && !adult) discs.push('d-aerea');
    const res = { indirizzo: pick(VIE), civico: String(1 + Math.floor(r() * 180)), cap: prov === 'CT' ? '95100' : '', comune: luogo, provincia: prov };
    const c = {
      id: uid('c-'),
      demo: true,
      nome,
      cognome,
      sesso,
      dataNascita: toISO(birth),
      luogoNascita: luogo,
      provinciaNascita: prov,
      codiceFiscale: cf.ok ? cf.value : '',
      residenza: res,
      telefono: `000 000 ${String(1000 + i)}`,
      email: `${nome}.${cognome}@esempio.it`.toLowerCase(),
      discipline: discs.filter(d => discIds.includes(d)),
      certificato: { tipo: adult || ageY < 8 ? 'non agonistico' : pick(['agonistico', 'non agonistico']), scadenza: i === 5 ? '' : toISO(scad), medico: 'Dott. Esempio' },
      genitore: adult ? null : {
        nome: pick(['Laura', 'Francesca', 'Valentina', 'Marco', 'Andrea', 'Salvatore', 'Giuseppe', 'Simona']),
        cognome,
        codiceFiscale: '',
        telefono: `000 000 ${String(2000 + i)}`,
        email: `famiglia.${cognome}@esempio.it`.toLowerCase(),
        relazione: 'Genitore',
      },
      note: '',
      stato: 'attivo',
      consensoPrivacy: true,
      consensoFoto: i % 3 !== 0,
    };
    created.push(c);
  }
  for (const c of created) await db.upsertClient(c);

  // qualche ricevuta degli ultimi mesi per popolare i grafici
  const list = db.clients.filter(c => c.demo);
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 5);
    for (const c of list.slice(0, 8 + ((m * 3) % 9))) {
      const disc = db.discipline(c.discipline[0]);
      const day = toISO(new Date(d.getFullYear(), d.getMonth(), 3 + Math.floor(r() * 20)));
      if (day > toISO(now)) continue;
      const payer = c.genitore ? { ...c.genitore } : { nome: c.nome, cognome: c.cognome, codiceFiscale: c.codiceFiscale };
      const imp = disc ? disc.quotaMensile : 45;
      await db.addReceipt({
        demo: true,
        tipo: m % 4 === 0 && c === list[0] ? 'commerciale' : 'generale',
        data: day,
        clientId: c.id,
        intestatario: { ...payer, residenza: c.residenza },
        atleta: { nome: c.nome, cognome: c.cognome, codiceFiscale: c.codiceFiscale, dataNascita: c.dataNascita, luogoNascita: c.luogoNascita },
        righe: [{ descrizione: `Quota mensile ${disc ? disc.nome : 'corso'}`, importo: imp }],
        totale: imp,
        metodo: pick(['Contanti', 'POS / Bancomat', 'Bonifico bancario', 'Satispay']),
        mesi: [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`],
        disciplina: disc ? disc.nome : '',
        detrazione: !c.genitore ? false : true,
        bollo: false,
        note: '',
      });
    }
  }
  db.log('demo', 'Caricati 24 atleti di esempio');
}

export async function removeDemoData() {
  const ids = new Set(db.clients.filter(c => c.demo).map(c => c.id));
  db.all.clients = db.clients.filter(c => !c.demo);
  db.all.receipts = db.receipts.filter(r => !r.demo && !ids.has(r.clientId));
  await db.save('clients');
  await db.save('receipts');
  db.log('demo', 'Eliminati i dati di esempio');
  return ids.size;
}
