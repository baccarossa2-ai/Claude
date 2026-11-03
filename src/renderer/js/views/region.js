// First run: country and language. This screen is always in English; once a language is chosen the
// whole app (screens, prints, messages) runs in that language for good.
import { db, DEFAULT_CAUSALI, defaultSettings } from '../lib/db.js';
import { icon, $, $$ } from '../lib/ui.js';
import { esc, uid } from '../lib/format.js';
import { COUNTRIES, LANGUAGES, regionFor, applyRegion } from '../lib/region.js';
import { t } from '../lib/i18n.js';
import { SPORTS, sportsFor, federationFor } from '../data/sports.js';

const POPULAR = ['US', 'GB', 'IT', 'ES', 'FR', 'DE', 'PT', 'BR', 'MX', 'CA', 'AU', 'AR'];

function guessCountry() {
  const tags = [...(navigator.languages || []), navigator.language || ''];
  for (const tag of tags) {
    const m = /[-_]([A-Z]{2})$/i.exec(tag);
    if (m && COUNTRIES.some(c => c.code === m[1].toUpperCase())) return m[1].toUpperCase();
  }
  return '';
}

function sample(r) {
  try {
    const d = new Date(2026, 10, 3);
    const date = new Intl.DateTimeFormat(r.locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    const long = new Intl.DateTimeFormat(r.locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    const money = new Intl.NumberFormat(r.locale, { style: 'currency', currency: r.currency }).format(1234.5);
    let cur = r.currency;
    try { cur = `${new Intl.DisplayNames(['en'], { type: 'currency' }).of(r.currency)} (${r.currency})`; } catch { /* nome non disponibile */ }
    return { date, long, money, cur };
  } catch {
    return { date: '', long: '', money: '', cur: r.currency };
  }
}

export function runRegionSetup() {
  return new Promise(resolve => {
    const guess = guessCountry();
    const st = { step: 0, country: guess, language: '' };
    const root = document.createElement('div');
    root.className = 'rgn';
    root.setAttribute('data-no-tr', '');
    document.body.appendChild(root);

    const countryRow = c => `<button class="rgn-c ${st.country === c.code ? 'on' : ''}" data-c="${c.code}"><span class="rgn-code">${c.code}</span><span class="grow">${esc(c.name)}</span>${st.country === c.code ? icon('check', 17) : ''}</button>`;

    const draw = () => {
      const steps = ['Country', 'Language', 'Confirm'];
      const head = `<div class="rgn-top"><img src="assets/logo.svg" alt=""><b>Athlos</b><div class="rgn-steps">${steps.map((s, i) => `<span class="${i === st.step ? 'on' : i < st.step ? 'done' : ''}"><i>${i < st.step ? icon('check', 12) : i + 1}</i>${s}</span>`).join('')}</div></div>`;
      let body = '';
      if (st.step === 0) {
        const pop = POPULAR.map(code => COUNTRIES.find(c => c.code === code)).filter(Boolean);
        const all = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, 'en'));
        body = `<div class="rgn-card">
          <h1>Welcome to Athlos</h1>
          <p class="rgn-lead">Where is your club based? We use it to set your currency, date format, phone prefix and local features such as tax codes and receipts.</p>
          <div class="rgn-search">${icon('search', 18)}<input id="q" placeholder="Search for a country…" autocomplete="off"></div>
          <div class="rgn-list" id="list">
            <div class="rgn-sec" data-sec="pop">Popular</div>
            ${pop.map(countryRow).join('')}
            <div class="rgn-sec" data-sec="all">All countries</div>
            ${all.map(countryRow).join('')}
            <button class="rgn-c ${st.country === 'OT' ? 'on' : ''}" data-c="OT"><span class="rgn-code">${icon('globe', 15)}</span><span class="grow">Other country</span></button>
          </div>
          <div class="rgn-foot"><span class="rgn-note">${icon('info', 15)}You can't change the country later: it sets how receipts and reports work.</span><button class="btn primary lg" id="next" ${st.country ? '' : 'disabled'}>Continue${icon('arrow-right', 18)}</button></div>
        </div>`;
      } else if (st.step === 1) {
        const c = COUNTRIES.find(x => x.code === st.country);
        const suggested = c ? c.lang : 'en';
        if (!st.language) st.language = suggested;
        body = `<div class="rgn-card">
          <h1>Choose your language</h1>
          <p class="rgn-lead">Athlos will always run in this language: screens, receipts, reports and messages.</p>
          <div class="rgn-langs">${LANGUAGES.map(l => {
            let en = l.name;
            try { en = new Intl.DisplayNames(['en'], { type: 'language' }).of(l.code); } catch { /* nome inglese non disponibile */ }
            return `<button class="rgn-l ${st.language === l.code ? 'on' : ''}" data-l="${l.code}"><b>${esc(l.name)}</b><small>${esc(en)}${l.code === suggested ? ' · suggested' : ''}</small>${st.language === l.code ? `<span class="rgn-tick">${icon('check', 16)}</span>` : ''}</button>`;
          }).join('')}</div>
          <div class="rgn-foot"><button class="btn ghost lg" id="back">${icon('arrow-left', 18)}Back</button><button class="btn primary lg" id="next">Continue${icon('arrow-right', 18)}</button></div>
        </div>`;
      } else {
        const r = regionFor(st.country, st.language);
        const s = sample(r);
        const c = COUNTRIES.find(x => x.code === st.country);
        const lang = LANGUAGES.find(l => l.code === st.language);
        body = `<div class="rgn-card">
          <h1>Ready to go</h1>
          <p class="rgn-lead">Check your choices. The language can't be changed later.</p>
          <div class="rgn-sum">
            <div><span>Country</span><b>${esc(c ? c.name : 'Other country')}</b></div>
            <div><span>Language</span><b>${esc(lang ? lang.name : st.language)}</b></div>
            <div><span>Currency</span><b>${esc(s.cur)}</b></div>
            <div><span>Amounts</span><b>${esc(s.money)}</b></div>
            <div><span>Dates</span><b>${esc(s.date)} · ${esc(s.long)}</b></div>
            <div><span>Phone prefix</span><b>${r.phonePrefix ? '+' + esc(r.phonePrefix) : '—'}</b></div>
          </div>
          <div class="rgn-foot"><button class="btn ghost lg" id="back">${icon('arrow-left', 18)}Back</button><button class="btn primary lg" id="go">${icon('rocket', 18)}Start Athlos</button></div>
        </div>`;
      }
      root.innerHTML = `<div class="rgn-bg"></div><div class="rgn-drag"></div>${head}<div class="rgn-body">${body}</div>`;
      bind();
    };

    const bind = () => {
      const q = $('#q', root);
      if (q) {
        q.oninput = () => {
          const v = q.value.trim().toLowerCase();
          $$('.rgn-sec', root).forEach(s => { s.style.display = v ? 'none' : ''; });
          const seen = new Set();
          $$('.rgn-c', root).forEach(b => {
            const name = b.textContent.trim().toLowerCase();
            const code = b.dataset.c.toLowerCase();
            let show = !v || name.includes(v) || code === v;
            // con la ricerca attiva mostra ogni paese una volta sola
            if (v && show) { if (seen.has(code)) show = false; else seen.add(code); }
            b.style.display = show ? '' : 'none';
          });
        };
        setTimeout(() => q.focus(), 50);
      }
      $$('.rgn-c', root).forEach(b => {
        b.onclick = () => { st.country = b.dataset.c; st.language = ''; const top = $('#list', root).scrollTop; const v = q ? q.value : ''; draw(); $('#list', root).scrollTop = top; if (v) { $('#q', root).value = v; $('#q', root).oninput(); } };
        b.ondblclick = () => { st.country = b.dataset.c; st.language = ''; st.step = 1; draw(); };
      });
      $$('.rgn-l', root).forEach(b => { b.onclick = () => { st.language = b.dataset.l; draw(); }; });
      const next = $('#next', root);
      if (next) next.onclick = () => { if (st.step === 0 && !st.country) return; st.step++; draw(); };
      const back = $('#back', root);
      if (back) back.onclick = () => { st.step--; draw(); };
      const go = $('#go', root);
      if (go) go.onclick = () => {
        const r = { ...regionFor(st.country, st.language), chosenAt: new Date().toISOString() };
        root.classList.add('out');
        setTimeout(() => root.remove(), 500);
        resolve(r);
      };
    };

    draw();
  });
}

// Prima installazione: discipline del paese e testi predefiniti nella lingua scelta.
// Su un archivio già in uso (atleti o ricevute presenti) non si tocca nulla.
export async function localizeDefaults(r) {
  if (db.clients.length || db.receipts.length) return;
  const keys = sportsFor(r.country);
  const now = new Date().toISOString();
  db.all.disciplines = keys.map(k => {
    const s = SPORTS[k];
    const old = db.disciplines.find(d => d.id === `d-${k}`);
    return {
      id: `d-${k}`, nome: t(s.nome), colore: s.colore, icona: s.icona, immagine: s.immagine,
      federazione: federationFor(k, r.country), quotaMensile: old ? old.quotaMensile : 50, quotaIscrizione: old ? old.quotaIscrizione : 30,
      descrizione: t(s.descrizione), attiva: true, createdAt: now,
    };
  });
  const ds = defaultSettings();
  const rs = db.settings.receipts;
  rs.causali = DEFAULT_CAUSALI.map(c => ({ ...c, descrizione: t(c.descrizione) }));
  rs.footer = t(ds.receipts.footer);
  db.settings.reminderTemplate = t(ds.reminderTemplate);
  db.settings.birthdayTemplate = t(ds.birthdayTemplate);
  if (r.country !== 'IT' && r.country !== 'SM') { rs.detrazioneAuto = false; rs.bolloAuto = false; }
  const co = db.company;
  let nation = '';
  try { nation = r.country === 'OT' ? '' : new Intl.DisplayNames([r.language], { type: 'region' }).of(r.country); } catch { /* nome non disponibile */ }
  co.fatturazione = { ...(co.fatturazione || {}), nazione: nation };
  if (Array.isArray(co.sedi)) co.sedi.forEach(s => { if (s.nome === 'Sede principale') s.nome = t('Sede principale'); });
  else co.sedi = [{ id: uid('s-'), nome: t('Sede principale'), principale: true }];
  await db.save('disciplines');
  await db.save('company');
}

// all'avvio: chiede paese e lingua la prima volta, poi applica formati e traduzione
export async function ensureRegion() {
  if (db.settings.region && db.settings.region.country) {
    await applyRegion(db.settings.region);
    return false;
  }
  const r = await runRegionSetup();
  db.settings.region = r;
  await applyRegion(r);
  await localizeDefaults(r);
  await db.save('settings');
  return true;
}
