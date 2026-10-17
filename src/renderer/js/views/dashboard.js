// Panoramica: saluto, numeri chiave, grafici, scadenze, compleanni e azioni rapide.
import { db } from '../lib/db.js';
import { icon, countUp, avatar, on, $ } from '../lib/ui.js';
import { go } from '../lib/router.js';
import { esc, euro, daysUntil, fullName, MESI, MESI_BREVI, GIORNI, todayISO, age, relTime, phoneIntl, fillTemplate, date, relDays } from '../lib/format.js';
import { certStats } from '../app.js';

const IMAGES = ['palestra', 'artistica', 'ritmica', 'judo', 'aerea', 'fitness'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

export default {
  title: 'Panoramica',
  render(root) {
    const now = new Date();
    const me = db.settings.chat.profile;
    const clients = db.clients.filter(c => c.stato !== 'sospeso');
    const year = now.getFullYear();
    const monthKey = todayISO().slice(0, 7);
    const valid = db.receipts.filter(r => !r.annullata);
    const incassoMese = valid.filter(r => r.data.startsWith(monthKey)).reduce((s, r) => s + Number(r.totale || 0), 0);
    const incassoAnno = valid.filter(r => r.anno === year).reduce((s, r) => s + Number(r.totale || 0), 0);
    const recG = db.receipts.filter(r => r.anno === year && r.tipo === 'generale').length;
    const recC = db.receipts.filter(r => r.anno === year && r.tipo === 'commerciale').length;
    const cs = certStats();
    const days = db.settings.reminderDays || 30;

    // incassi ultimi 12 mesi
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(year, now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: MESI_BREVI[d.getMonth()], v: valid.filter(r => r.data.startsWith(key)).reduce((s, r) => s + Number(r.totale || 0), 0) });
    }
    const maxV = Math.max(1, ...months.map(m => m.v));

    // atleti per disciplina
    const discs = db.disciplines.filter(d => d.attiva !== false).map(d => ({ d, n: clients.filter(c => (c.discipline || []).includes(d.id)).length }));
    const totDisc = discs.reduce((s, x) => s + x.n, 0);

    const due = clients
      .map(c => ({ c, d: daysUntil(c.certificato && c.certificato.scadenza) }))
      .filter(x => x.d !== null && x.d <= days)
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);

    const birthdays = clients
      .filter(c => c.dataNascita)
      .map(c => {
        const b = new Date(c.dataNascita + 'T00:00:00');
        let next = new Date(year, b.getMonth(), b.getDate());
        if (next < new Date(year, now.getMonth(), now.getDate())) next = new Date(year + 1, b.getMonth(), b.getDate());
        return { c, d: Math.round((next - new Date(year, now.getMonth(), now.getDate())) / 86400000) };
      })
      .filter(x => x.d <= 7)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);

    const recent = db.activity.slice(0, 7);
    const img = IMAGES[now.getDate() % IMAGES.length];

    root.innerHTML = `
      <section class="hero">
        <div class="hero-bg" style="background-image:url('assets/images/${img}.webp')"></div>
        <div>
          <div class="hero-date">${GIORNI[now.getDay()]} ${now.getDate()} ${MESI[now.getMonth()]} ${year}</div>
          <h1>${greeting()}${me ? `, ${esc(me.nome)}` : ''}! 👋</h1>
          <p>${cs.expired + cs.soon > 0
            ? `Oggi hai <b>${cs.expired + cs.soon} certificati</b> da controllare${birthdays.some(b => b.d === 0) ? ' e qualche compleanno da festeggiare 🎂' : ''}. Tutto il resto è in ordine.`
            : `Tutti i certificati sono in regola. ${esc(db.company.denominazione || 'La tua società')} è pronta per una grande giornata di allenamenti.`}</p>
          <div class="actions">
            <button class="btn primary" data-go="/ricevute/nuova?tipo=generale">${icon('receipt-text', 16)}Nuova ricevuta</button>
            <button class="btn" data-go="/atleti/nuovo">${icon('user-plus', 16)}Nuovo atleta</button>
            <button class="btn" data-studio>${icon('clapperboard', 16)}Salto Studio</button>
          </div>
        </div>
        <div class="hero-side">
          <div class="hero-pill"><b data-count="${clients.length}">0</b><span>Atleti attivi</span></div>
          <div class="hero-pill"><b data-count="${db.disciplines.filter(d => d.attiva !== false).length}">0</b><span>Discipline</span></div>
        </div>
      </section>

      <div class="dash-grid">
        ${stat('users', 'Atleti iscritti', clients.length, `${clients.filter(c => age(c.dataNascita) !== null && age(c.dataNascita) < 18).length} minorenni`, 'var(--grad)', 'rgba(139,61,240,.8)')}
        ${stat('wallet', `Incassi di ${MESI[now.getMonth()]}`, incassoMese, `${euro(incassoAnno)} nel ${year}`, 'var(--grad-green)', 'rgba(16,185,129,.8)', true)}
        ${stat('receipt-text', `Ricevute ${year}`, recG + recC, `${recG} generali · ${recC} commerciali`, 'var(--grad-cool)', 'rgba(14,165,233,.8)')}
        ${stat('heart-pulse', 'Certificati da controllare', cs.expired + cs.soon, `${cs.expired} scaduti · ${cs.soon} entro ${days} gg · ${cs.missing} mancanti`, 'linear-gradient(135deg,#F97316,#EF4444)', 'rgba(239,68,68,.8)')}

        <div class="card c7">
          <div class="card-head"><div><h3>Incassi degli ultimi 12 mesi</h3><p>Ricevute generali e commerciali, escluse le annullate</p></div>
            <div class="actions"><button class="btn sm ghost" data-go="/ricevute">Vedi ricevute ${icon('arrow-right', 14)}</button></div></div>
          <div class="card-body">
            <div class="chart-bars">${months.map((m, i) => `<div class="chart-bar"><div class="bar ${m.v ? '' : 'dim'}" data-v="${euro(m.v)}" style="height:${Math.max(3, (m.v / maxV) * 100)}%;animation-delay:${i * 0.04}s"></div><small>${m.label}</small></div>`).join('')}</div>
          </div>
        </div>

        <div class="card c5">
          <div class="card-head"><div><h3>Atleti per disciplina</h3><p>Un atleta può seguire più corsi</p></div></div>
          <div class="card-body">
            <div class="donut-wrap">${donut(discs, totDisc)}
              <div class="legend">${discs.map(x => `<div class="legend-row"><i style="background:${x.d.colore}"></i><span class="ellipsis">${esc(x.d.nome)}</span><b>${x.n}</b></div>`).join('')}</div>
            </div>
          </div>
        </div>

        <div class="card c5">
          <div class="card-head"><div><h3>Certificati in scadenza</h3><p>Prossimi ${days} giorni e già scaduti</p></div>
            <div class="actions"><button class="btn sm ghost" data-go="/scadenzario">Scadenzario ${icon('arrow-right', 14)}</button></div></div>
          <div class="card-body">
            ${due.length ? due.map(({ c, d }) => `<div class="list-item">
                ${avatar(c, 38)}
                <div class="person grow"><div><b>${esc(fullName(c))}</b><small>${date(c.certificato.scadenza)} · ${relDays(d)}</small></div></div>
                <span class="badge ${d < 0 ? 'danger' : d <= 7 ? 'warn' : 'info'}">${d < 0 ? 'Scaduto' : d === 0 ? 'Oggi' : `${d} gg`}</span>
                <button class="btn icon sm whatsapp" data-wa="${c.id}" data-tip="Avvisa su WhatsApp">${icon('brand-whatsapp', 16)}</button>
              </div>`).join('') : `<div class="empty" style="padding:24px"><div class="empty-art" style="width:60px;height:60px;border-radius:20px">${icon('shield-check', 26)}</div><h3>Tutto in regola</h3><p>Nessun certificato scade nei prossimi ${days} giorni.</p></div>`}
          </div>
        </div>

        <div class="card c4">
          <div class="card-head"><div><h3>Compleanni della settimana</h3><p>Un pensiero fa sempre piacere</p></div></div>
          <div class="card-body">
            ${birthdays.length ? birthdays.map(({ c, d }) => `<div class="list-item">
                ${avatar(c, 38)}
                <div class="person grow"><div><b>${esc(fullName(c))}</b><small>${d === 0 ? '🎉 Oggi!' : d === 1 ? 'Domani' : `Tra ${d} giorni`} · compie ${age(c.dataNascita) + (d === 0 ? 0 : 1)} anni</small></div></div>
                <button class="btn icon sm" data-bday="${c.id}" data-tip="Manda gli auguri">${icon('cake', 16)}</button>
              </div>`).join('') : `<p class="muted small">Nessun compleanno nei prossimi 7 giorni.</p>`}
          </div>
        </div>

        <div class="card c3">
          <div class="card-head"><div><h3>Azioni rapide</h3></div></div>
          <div class="card-body">
            <div class="quick-grid">
              ${quick('user-plus', 'Atleta', 'Nuova anagrafica', '/atleti/nuovo', 'var(--grad)')}
              ${quick('receipt', 'Ricevuta', 'Commerciale', '/ricevute/nuova?tipo=commerciale', 'var(--grad-cool)')}
              ${quick('megaphone', 'Social', 'Post e messaggi', '/comunica', 'var(--grad-warm)')}
              ${quick('messages-square', 'Squadra', 'Chat staff', '/squadra', 'var(--grad-green)')}
            </div>
          </div>
        </div>

        <div class="card c12">
          <div class="card-head"><div><h3>Attività recente</h3><p>Le ultime operazioni registrate</p></div></div>
          <div class="card-body">
            ${recent.length ? `<div class="grid g2">${recent.map(a => `<div class="list-item"><span class="pi-ico" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--surface-3);color:var(--accent)">${icon(activityIcon(a.type), 16)}</span><div class="grow ellipsis">${esc(a.text)}</div><small class="muted nowrap">${relTime(a.ts)}</small></div>`).join('')}</div>`
              : '<p class="muted small">Qui compariranno le ultime operazioni.</p>'}
          </div>
        </div>
      </div>`;

    root.querySelectorAll('[data-count]').forEach(n => countUp(n, Number(n.dataset.count)));
    root.querySelectorAll('[data-stat]').forEach(n => countUp(n, Number(n.dataset.stat), n.dataset.money ? { format: v => euro(v) } : undefined));
    requestAnimationFrame(() => root.querySelectorAll('.donut circle[data-off]').forEach(c => { c.style.strokeDashoffset = c.dataset.off; }));

    on(root, 'click', '[data-go]', (e, t) => go(t.dataset.go));
    on(root, 'click', '[data-studio]', () => window.athlos.system.openStudio());
    on(root, 'click', '[data-wa]', (e, t) => sendReminder(db.client(t.dataset.wa)));
    on(root, 'click', '[data-bday]', (e, t) => sendBirthday(db.client(t.dataset.bday)));
  },
};

function stat(ic, label, value, foot, g, gc, money) {
  return `<div class="stat c3" style="--g:${g};--gc:${gc}">
    <div class="stat-ico">${icon(ic, 20)}</div>
    <div class="stat-val" data-stat="${value}" ${money ? 'data-money="1"' : ''}>0</div>
    <div class="stat-lbl">${esc(label)}</div>
    <div class="stat-foot muted">${esc(foot)}</div>
  </div>`;
}

function quick(ic, title, sub, path, g) {
  return `<button class="quick" data-go="${path}" style="--g:${g}"><span class="q-ico">${icon(ic, 18)}</span><b>${esc(title)}</b><small>${esc(sub)}</small></button>`;
}

function donut(discs, total) {
  const R = 64;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const segs = total ? discs.filter(x => x.n).map(x => {
    const len = (x.n / total) * C;
    const s = `<circle cx="84" cy="84" r="${R}" fill="none" stroke="${x.d.colore}" stroke-width="22" stroke-dasharray="${len - 2} ${C}" stroke-dashoffset="${C}" data-off="${-acc}" stroke-linecap="butt"></circle>`;
    acc += len;
    return s;
  }).join('') : '';
  return `<div class="donut"><svg width="168" height="168" viewBox="0 0 168 168"><circle cx="84" cy="84" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="22"></circle>${segs}</svg>
    <div class="donut-center"><div><b>${total}</b><span>iscrizioni</span></div></div></div>`;
}

function activityIcon(t) {
  return { client: 'user', receipt: 'receipt-text', reminder: 'bell-ring', setup: 'rocket', demo: 'sparkles', company: 'building-2', discipline: 'trophy', print: 'printer', backup: 'hard-drive' }[t] || 'activity';
}

export function reminderText(c) {
  const d = daysUntil(c.certificato && c.certificato.scadenza);
  return fillTemplate(db.settings.reminderTemplate, {
    nome: c.genitore && c.genitore.nome ? c.genitore.nome : c.nome,
    atleta: `${c.nome} ${c.cognome}`,
    scadenza: date(c.certificato && c.certificato.scadenza),
    giorni: d === null ? '' : d < 0 ? `scaduto da ${-d} giorni` : d === 0 ? 'oggi' : `tra ${d} giorni`,
    frase: d === null ? 'non risulta ancora consegnato' : d < 0 ? `è scaduto il ${date(c.certificato.scadenza)}` : d === 0 ? 'scade oggi' : `scade il ${date(c.certificato.scadenza)} (tra ${d} ${d === 1 ? 'giorno' : 'giorni'})`,
    societa: db.company.denominazione,
  });
}

export function contactPhone(c) {
  return (c.genitore && c.genitore.telefono) || c.telefono || '';
}

export async function sendReminder(c, { log = true } = {}) {
  if (!c) return;
  const phone = phoneIntl(contactPhone(c));
  const text = reminderText(c);
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  await window.athlos.system.open(url);
  if (log) {
    db.all.reminders.push({ id: 'rm-' + Date.now(), clientId: c.id, kind: 'certificato', scadenza: c.certificato?.scadenza, ts: Date.now(), canale: 'whatsapp' });
    await db.save('reminders');
    db.log('reminder', `Promemoria certificato inviato a ${c.nome} ${c.cognome}`);
  }
}

export async function sendBirthday(c) {
  if (!c) return;
  const phone = phoneIntl(c.telefono || contactPhone(c));
  const text = fillTemplate(db.settings.birthdayTemplate, { nome: c.nome, societa: db.company.denominazione });
  await window.athlos.system.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
  db.log('reminder', `Auguri di compleanno inviati a ${c.nome} ${c.cognome}`);
}
