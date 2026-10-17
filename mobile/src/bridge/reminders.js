// Promemoria dei certificati medici direttamente sul telefono: una notifica alle 9:00
// del giorno di preavviso (30 giorni prima, o quanto scelto nelle impostazioni) e una il giorno della scadenza.
import { LocalNotifications } from '@capacitor/local-notifications';
import { native } from './fsx.js';

const HORIZON_DAYS = 150;   // AlarmManager ha un limite di allarmi per app: si programma solo il prossimo periodo
const MAX_SCHEDULED = 240;
let timer = null;
let asked = false;

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 1) || 1;
}

function at9(iso, minusDays) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d - minusDays, 9, 0, 0);
}

const it = d => d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

function plan(clients, settings) {
  const days = Number(settings && settings.reminderDays) || 30;
  const now = Date.now();
  const limit = now + HORIZON_DAYS * 86400000;
  const out = [];
  for (const c of clients || []) {
    const exp = c && c.certificato && c.certificato.scadenza;
    if (!exp || c.stato === 'sospeso' || !/^\d{4}-\d{2}-\d{2}$/.test(exp)) continue;
    const name = `${c.nome || ''} ${c.cognome || ''}`.trim() || 'atleta';
    const when = at9(exp, 0);
    const steps = [
      { kind: 'avviso', at: at9(exp, days), title: 'Certificato medico in scadenza', body: `Il certificato di ${name} scade il ${it(when)} (tra ${days} giorni). Tocca per avvisare la famiglia.` },
      { kind: 'scadenza', at: when, title: 'Certificato medico scaduto oggi', body: `Oggi scade il certificato di ${name}. Senza certificato valido non può allenarsi.` },
    ];
    for (const s of steps) {
      const t = s.at.getTime();
      if (t <= now || t > limit) continue;
      out.push({
        id: hash(`${c.id}|${s.kind}|${exp}|${days}|${name}`),
        title: s.title,
        body: s.body,
        schedule: { at: s.at, allowWhileIdle: true },
        smallIcon: 'ic_stat_athlos',
        iconColor: '#7C5CFF',
        extra: { kind: 'cert', route: `/atleti/${c.id}` },
      });
    }
  }
  return out.sort((a, b) => a.schedule.at - b.schedule.at).slice(0, MAX_SCHEDULED);
}

export function scheduleReminders(getData) {
  if (!native) return;
  clearTimeout(timer);
  timer = setTimeout(() => apply(getData()).catch(err => console.warn('Promemoria non programmati:', err)), 1500);
}

async function apply(data) {
  const wanted = plan(data.clients, data.settings);
  const pending = (await LocalNotifications.getPending()).notifications || [];
  const ours = pending.filter(n => n.extra && n.extra.kind === 'cert');
  const keep = new Set(wanted.map(n => n.id));
  const stale = ours.filter(n => !keep.has(Number(n.id)));
  if (stale.length) await LocalNotifications.cancel({ notifications: stale.map(n => ({ id: Number(n.id) })) });
  const have = new Set(ours.map(n => Number(n.id)));
  const fresh = wanted.filter(n => !have.has(n.id));
  if (!fresh.length) return;
  if (!(await ensurePermission())) return;
  await LocalNotifications.schedule({ notifications: fresh });
}

export async function ensurePermission() {
  let p = await LocalNotifications.checkPermissions();
  if (p.display !== 'granted' && !asked) {
    asked = true;
    p = await LocalNotifications.requestPermissions();
  }
  return p.display === 'granted';
}
