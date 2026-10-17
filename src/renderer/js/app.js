// Guscio dell'applicazione: barra laterale, barra superiore, navigazione, ricerca globale,
// blocco con PIN, prima configurazione e avvisi all'avvio.
import { db } from './lib/db.js';
import { icon, el, $, $$, on, modal, popMenu, ripple, toast, avatar } from './lib/ui.js';
import { parseHash, go } from './lib/router.js';
import { esc, daysUntil, fullName, normalize, euro, date, age, todayISO } from './lib/format.js';
import { startChat, onChat, unreadCount, chatState } from './lib/chatstate.js';

// barra in basso del telefono
const TABS = [
  { path: '/dashboard', label: 'Home', icon: 'layout-dashboard' },
  { path: '/atleti', label: 'Atleti', icon: 'users', match: /^\/atleti/ },
  { path: '/ricevute', label: 'Ricevute', icon: 'receipt-text', match: /^\/ricevute/ },
  { path: '/scadenzario', label: 'Scadenze', icon: 'calendar-clock', badge: 'scadenze-m' },
  { label: 'Altro', icon: 'layout-grid' },
];

const NAV = [
  { group: 'Gestione' },
  { path: '/dashboard', label: 'Panoramica', icon: 'layout-dashboard' },
  { path: '/atleti', label: 'Anagrafiche', icon: 'users', match: /^\/atleti/ },
  { path: '/ricevute', label: 'Ricevute', icon: 'receipt-text', match: /^\/ricevute/ },
  { path: '/scadenzario', label: 'Scadenzario', icon: 'calendar-clock', badge: 'scadenze' },
  { group: 'Società' },
  { path: '/societa', label: 'Dati società', icon: 'building-2' },
  { path: '/discipline', label: 'Discipline', icon: 'trophy' },
  { group: 'Creatività' },
  { path: '/studio', label: 'Salto Studio', icon: 'clapperboard', tag: 'VIDEO' },
  { path: '/comunica', label: 'Comunica', icon: 'megaphone' },
  { path: '/squadra', label: 'Squadra', icon: 'messages-square', badge: 'chat' },
];

let current = null;
let cleanup = null;

// ------------------------------------------------------------------ tema
export async function applyTheme(mode = db.settings.theme) {
  let dark;
  if (mode === 'auto') dark = await window.athlos.system.systemDark();
  else dark = mode === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  await window.athlos.system.setTheme(mode);
}

// ------------------------------------------------------------------ guscio
function renderShell() {
  const root = $('#root');
  root.innerHTML = `
  <div class="app ${db.settings.sidebarCollapsed ? 'collapsed' : ''}" id="app">
    <aside class="sidebar">
      <div class="brand">
        <img src="assets/logo.svg" alt="Athlos">
        <div class="brand-name">Athlos<small>Suite sportiva</small></div>
        <button class="collapse-btn" id="collapse" data-tip="Comprimi / espandi menu" data-tip-pos="right">${icon('chevrons-left', 16)}</button>
      </div>
      <div class="club-card" id="clubCard" data-tip-pos="right"></div>
      <nav class="nav" id="nav"></nav>
      <div class="sidebar-foot">
        <button class="nav-item" data-path="/guida" data-tip="Guida e anteprima" data-tip-pos="right">${icon('circle-help', 19)}<span>Guida</span></button>
        <button class="nav-item" data-path="/impostazioni" data-tip="Impostazioni" data-tip-pos="right">${icon('settings', 19)}<span>Impostazioni</span></button>
      </div>
    </aside>
    <section class="main">
      <header class="topbar">
        <button class="top-btn m-only" id="menuBtn" aria-label="Menu">${icon('menu', 22)}</button>
        <div class="m-title m-only" id="mTitle"><img src="assets/logo.svg" alt=""><span>Athlos</span></div>
        <button class="search-trigger" id="searchBtn">${icon('search', 17)}<span>Cerca atleti, ricevute, azioni…</span><kbd>Ctrl K</kbd></button>
        <div class="spacer"></div>
        <button class="btn primary sm" id="newBtn">${icon('plus', 16)}<span>Nuovo</span></button>
        <button class="top-btn" id="bellBtn" data-tip="Avvisi" data-tip-pos="bottom">${icon('bell', 18)}</button>
        <button class="top-btn" id="themeBtn" data-tip="Tema chiaro/scuro" data-tip-pos="bottom">${icon('moon', 18)}</button>
      </header>
      <main class="view" id="view"></main>
    </section>
    <div class="m-scrim" id="scrim"></div>
    <nav class="m-tabbar" id="tabbar">${TABS.map(t => `<button class="m-tab" ${t.path ? `data-path="${t.path}"` : 'data-drawer'}>
      ${icon(t.icon, 22)}<span>${esc(t.label)}</span>${t.badge ? `<i class="nav-badge hidden" data-badge="${t.badge}"></i>` : ''}</button>`).join('')}</nav>
  </div>`;

  renderNav();
  renderClubCard();

  on($('#app'), 'click', '[data-path]', (e, t) => go(t.dataset.path));
  $('#collapse').onclick = () => {
    db.settings.sidebarCollapsed = !db.settings.sidebarCollapsed;
    $('#app').classList.toggle('collapsed', db.settings.sidebarCollapsed);
    db.save('settings');
  };
  $('#clubCard').onclick = () => go('/societa');
  // telefono: menu laterale a scomparsa
  const drawer = open => document.documentElement.classList.toggle('drawer-open', open);
  $('#menuBtn').onclick = () => drawer(true);
  $('#scrim').onclick = () => drawer(false);
  on($('#tabbar'), 'click', '[data-drawer]', () => drawer(true));
  let x0 = null;
  $('.sidebar').addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  $('.sidebar').addEventListener('touchend', e => { if (x0 !== null && x0 - e.changedTouches[0].clientX > 60) drawer(false); x0 = null; }, { passive: true });
  $('#searchBtn').onclick = openPalette;
  $('#newBtn').onclick = e => newMenu(e.currentTarget);
  $('#bellBtn').onclick = e => alertsMenu(e.currentTarget);
  $('#themeBtn').onclick = async () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    db.settings.theme = dark ? 'light' : 'dark';
    await db.save('settings');
    await applyTheme();
    updateThemeIcon();
  };
  updateThemeIcon();
  updateBadges();

  db.on('company', renderClubCard);
  db.on('clients', updateBadges);
  db.on('*', () => { renderClubCard(); updateBadges(); });
  onChat(() => updateBadges());
}

function updateThemeIcon() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('#themeBtn').innerHTML = icon(dark ? 'sun' : 'moon', 18);
}

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = NAV.map(n => {
    if (n.group) return `<div class="nav-group">${esc(n.group)}</div>`;
    return `<button class="nav-item" data-path="${n.path}" data-tip="${esc(n.label)}" data-tip-pos="right">
      ${icon(n.icon, 19)}<span>${esc(n.label)}</span>
      ${n.tag ? `<em class="nav-tag">${n.tag}</em>` : ''}
      ${n.badge ? `<i class="nav-badge hidden" data-badge="${n.badge}"></i>` : ''}
    </button>`;
  }).join('');
  highlightNav();
}

function highlightNav() {
  const path = parseHash().path;
  $$('.nav-item[data-path]').forEach(b => {
    const n = NAV.find(x => x.path === b.dataset.path);
    const active = n && n.match ? n.match.test(path) : b.dataset.path === path;
    b.classList.toggle('active', active);
  });
  $$('.m-tab[data-path]').forEach(b => {
    const t = TABS.find(x => x.path === b.dataset.path);
    b.classList.toggle('active', t.match ? t.match.test(path) : t.path === path);
  });
}

function renderClubCard() {
  const c = db.company;
  const card = $('#clubCard');
  if (!card) return;
  const name = c.tipoSoggetto === 'persona' ? `${c.nome} ${c.cognome}`.trim() : c.denominazione;
  const logo = c.logo ? `<img src="${window.athlos.media.url(c.logo)}" alt="">` : esc((name || 'A').slice(0, 1));
  card.dataset.tip = name || 'Società';
  card.innerHTML = `<div class="club-logo">${logo}</div>
    <div class="club-info"><b>${esc(name || 'La tua società')}</b><span>${esc(c.formaGiuridica || 'Società sportiva')} · ${db.clients.length} iscritti</span></div>`;
}

export function certStats() {
  const days = db.settings.reminderDays || 30;
  let expired = 0, soon = 0, missing = 0;
  for (const c of db.clients) {
    if (c.stato === 'sospeso') continue;
    const d = daysUntil(c.certificato && c.certificato.scadenza);
    if (d === null) missing++;
    else if (d < 0) expired++;
    else if (d <= days) soon++;
  }
  return { expired, soon, missing };
}

function updateBadges() {
  const s = certStats();
  const n = s.expired + s.soon;
  for (const b of $$('[data-badge="scadenze"], [data-badge="scadenze-m"]')) { b.textContent = n; b.classList.toggle('hidden', !n); }
  const u = unreadCount();
  const cb = $('[data-badge="chat"]');
  if (cb) { cb.textContent = u > 99 ? '99+' : u; cb.classList.toggle('hidden', !u); }
  const bell = $('#bellBtn');
  if (bell) {
    const has = n > 0 || birthdaysToday().length > 0;
    bell.innerHTML = icon(has ? 'bell-ring' : 'bell', 18) + (has ? '<i class="dot"></i>' : '');
  }
}

function birthdaysToday() {
  const t = todayISO().slice(5);
  return db.clients.filter(c => c.dataNascita && c.dataNascita.slice(5) === t && c.stato !== 'sospeso');
}

function newMenu(anchor) {
  popMenu(anchor, [
    { header: 'Crea' },
    { label: 'Nuovo atleta / cliente', icon: 'user-plus', hint: 'Ctrl N', fn: () => go('/atleti/nuovo') },
    { label: 'Ricevuta generale', icon: 'receipt-text', hint: 'Ctrl R', fn: () => go('/ricevute/nuova?tipo=generale') },
    { label: 'Ricevuta commerciale', icon: 'receipt', fn: () => go('/ricevute/nuova?tipo=commerciale') },
    '-',
    { label: 'Messaggio social', icon: 'megaphone', fn: () => go('/comunica') },
    { label: 'Video o grafica in Salto Studio', icon: 'clapperboard', fn: () => window.athlos.system.openStudio() },
    { label: 'Messaggio allo staff', icon: 'messages-square', fn: () => go('/squadra') },
  ]);
}

function alertsMenu(anchor) {
  const days = db.settings.reminderDays || 30;
  const items = [{ header: 'Avvisi di oggi' }];
  const due = db.clients
    .map(c => ({ c, d: daysUntil(c.certificato && c.certificato.scadenza) }))
    .filter(x => x.d !== null && x.d <= days && x.c.stato !== 'sospeso')
    .sort((a, b) => a.d - b.d)
    .slice(0, 6);
  for (const { c, d } of due) {
    items.push({ label: `${fullName(c)} · certificato ${d < 0 ? 'scaduto' : d === 0 ? 'scade oggi' : `tra ${d} gg`}`, icon: d < 0 ? 'circle-alert' : 'heart-pulse', fn: () => go(`/atleti/${c.id}`) });
  }
  for (const c of birthdaysToday()) {
    items.push({ label: `🎂 Compleanno di ${c.nome} ${c.cognome} (${age(c.dataNascita)} anni)`, icon: 'cake', fn: () => go(`/atleti/${c.id}`) });
  }
  if (items.length === 1) items.push({ label: 'Nessun avviso: tutto in regola!', icon: 'circle-check', disabled: true });
  else items.push('-', { label: 'Apri lo scadenzario', icon: 'calendar-clock', fn: () => go('/scadenzario') });
  popMenu(anchor, items);
}

// ------------------------------------------------------------------ router
async function route() {
  const r = parseHash();
  highlightNav();
  document.documentElement.classList.remove('drawer-open');
  if (cleanup) { try { cleanup(); } catch (err) { console.error(err); } cleanup = null; }
  const view = $('#view');
  current = r;
  let mod;
  try {
    mod = (await r.loader()).default;
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="empty"><h3>Errore nel caricamento</h3><p>${esc(err.message)}</p></div>`;
    return;
  }
  if (current !== r) return;
  view.className = 'view' + (mod.full ? ' full' : '');
  view.scrollTop = 0;
  // ogni schermata riceve un contenitore nuovo: gli eventi della precedente spariscono con lei
  const host = document.createElement('div');
  host.className = 'view-host' + (mod.full ? ' full' : '');
  view.replaceChildren(host);
  try {
    cleanup = (await mod.render(host, r.params, r.query)) || null;
  } catch (err) {
    console.error(err);
    host.innerHTML = `<div class="empty"><h3>Qualcosa è andato storto</h3><p>${esc(err.message)}</p></div>`;
  }
  view.classList.remove('enter');
  void view.offsetWidth;
  view.classList.add('enter');
  document.title = `${mod.title || 'Athlos'} · Athlos Suite`;
  const mt = $('#mTitle span');
  if (mt) mt.textContent = r.path === '/dashboard' ? (db.company.denominazione || 'Athlos') : (mod.title || 'Athlos');
}

// ------------------------------------------------------------------ palette comandi
const ACTIONS = [
  { label: 'Nuovo atleta / cliente', icon: 'user-plus', keys: 'nuovo atleta cliente anagrafica aggiungi', fn: () => go('/atleti/nuovo') },
  { label: 'Nuova ricevuta generale', icon: 'receipt-text', keys: 'ricevuta generale pagamento quota', fn: () => go('/ricevute/nuova?tipo=generale') },
  { label: 'Nuova ricevuta commerciale', icon: 'receipt', keys: 'ricevuta commerciale vendita', fn: () => go('/ricevute/nuova?tipo=commerciale') },
  { label: 'Apri Salto Studio (editor video)', icon: 'clapperboard', keys: 'video editor montaggio grafica studio salto', fn: () => window.athlos.system.openStudio() },
  { label: 'Scrivi un post social', icon: 'megaphone', keys: 'social instagram facebook whatsapp twitter x messenger post', fn: () => go('/comunica') },
  { label: 'Chat dello staff', icon: 'messages-square', keys: 'chat squadra staff messaggi', fn: () => go('/squadra') },
  { label: 'Certificati in scadenza', icon: 'calendar-clock', keys: 'certificati scadenza medico scadenzario', fn: () => go('/scadenzario') },
  { label: 'Dati della società', icon: 'building-2', keys: 'società partita iva indirizzo sedi', fn: () => go('/societa') },
  { label: 'Discipline', icon: 'trophy', keys: 'discipline corsi ginnastica judo', fn: () => go('/discipline') },
  { label: 'Stampanti e impostazioni', icon: 'printer', keys: 'stampante impostazioni backup tema pin', fn: () => go('/impostazioni') },
  { label: 'Guida e anteprima', icon: 'circle-help', keys: 'guida aiuto tutorial anteprima', fn: () => go('/guida') },
  { label: 'Cambia tema chiaro/scuro', icon: 'moon', keys: 'tema scuro chiaro dark light', fn: () => $('#themeBtn').click() },
];

function openPalette() {
  if ($('.palette')) return;
  let sel = 0;
  let items = [];
  const m = modal({
    size: 'md',
    className: 'palette-back',
    body: `<div class="palette-input">${icon('search', 20)}<input placeholder="Cerca per nome, cognome, codice fiscale, disciplina, n° ricevuta…" autofocus></div>
      <div class="palette-list"></div>
      <div class="palette-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> per muoverti</span><span><kbd>Invio</kbd> per aprire</span><span><kbd>Esc</kbd> per chiudere</span></div>`,
  });
  m.el.classList.add('palette');
  const input = m.body.querySelector('input');
  const list = m.body.querySelector('.palette-list');

  const renderList = () => {
    const q = normalize(input.value.trim());
    items = [];
    const groups = [];
    if (q) {
      const people = db.searchClients(input.value).slice(0, 7);
      if (people.length) groups.push(['Atleti e clienti', people.map(c => ({
        html: `${avatar(c, 34)}<div><b>${esc(fullName(c))}</b><small>${esc((c.discipline || []).map(id => db.discipline(id)?.nome).filter(Boolean).join(', ') || 'Nessuna disciplina')} · ${esc(c.codiceFiscale || '')}</small></div>`,
        fn: () => go(`/atleti/${c.id}`),
      }))]);
      const discs = db.disciplines.filter(d => normalize(d.nome).includes(q));
      if (discs.length) groups.push(['Discipline', discs.map(d => ({
        html: `<span class="pi-ico" style="background:${d.colore};color:#fff">${icon(d.icona || 'trophy', 17)}</span><div><b>Tutti gli iscritti a ${esc(d.nome)}</b><small>${db.clients.filter(c => (c.discipline || []).includes(d.id)).length} atleti</small></div>`,
        fn: () => go(`/atleti?disciplina=${d.id}`),
      }))]);
      const recs = db.receipts.filter(r => String(r.numero) === q.replace(/\D/g, '') || normalize(r.intestatario?.nome + ' ' + r.intestatario?.cognome).includes(q)).slice(0, 5);
      if (recs.length) groups.push(['Ricevute', recs.map(r => ({
        html: `<span class="pi-ico">${icon('receipt-text', 17)}</span><div><b>Ricevuta ${r.tipo} n. ${r.numero}/${r.anno}</b><small>${esc(r.intestatario?.nome || '')} ${esc(r.intestatario?.cognome || '')} · ${euro(r.totale)} · ${date(r.data)}</small></div>`,
        fn: () => go(`/ricevute?apri=${r.id}`),
      }))]);
    }
    const acts = ACTIONS.filter(a => !q || normalize(a.label + ' ' + a.keys).includes(q));
    if (acts.length) groups.push(['Azioni rapide', acts.map(a => ({ html: `<span class="pi-ico">${icon(a.icon, 17)}</span><div><b>${esc(a.label)}</b></div>`, fn: a.fn }))]);
    list.innerHTML = groups.length ? groups.map(([g, arr]) => {
      const start = items.length;
      items.push(...arr);
      return `<div class="palette-group">${esc(g)}</div>` + arr.map((it, i) => `<div class="palette-item" data-i="${start + i}">${it.html}</div>`).join('');
    }).join('') : `<div class="empty" style="padding:30px"><p>Nessun risultato per “${esc(input.value)}”</p></div>`;
    sel = Math.min(sel, items.length - 1);
    highlight();
  };
  const highlight = () => {
    $$('.palette-item', list).forEach(x => x.classList.toggle('sel', Number(x.dataset.i) === sel));
    const s = $('.palette-item.sel', list);
    if (s) s.scrollIntoView({ block: 'nearest' });
  };
  const run = i => { const it = items[i]; if (!it) return; m.close(); it.fn(); };
  input.addEventListener('input', () => { sel = 0; renderList(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); highlight(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); highlight(); e.preventDefault(); }
    if (e.key === 'Enter') run(sel);
  });
  on(list, 'click', '.palette-item', (e, t) => run(Number(t.dataset.i)));
  on(list, 'mousemove', '.palette-item', (e, t) => { if (sel !== Number(t.dataset.i)) { sel = Number(t.dataset.i); highlight(); } });
  renderList();
}

// ------------------------------------------------------------------ blocco PIN
function lockScreen() {
  return new Promise(resolve => {
    const name = db.company.denominazione || 'Athlos';
    const node = el(`<div class="lock"><div class="lock-box">
      <img src="assets/logo.svg" alt="">
      <h2>${esc(name)}</h2><p class="muted" style="color:#A9A2D6">Inserisci il PIN per sbloccare</p>
      <div class="pin-dots">${'<i></i>'.repeat(6)}</div>
      <div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button data-n="c">${icon('x', 20)}</button><button data-n="0">0</button><button data-n="ok">${icon('check', 22)}</button></div>
    </div></div>`);
    document.body.appendChild(node);
    let pin = '';
    const dots = () => $$('.pin-dots i', node).forEach((d, i) => d.classList.toggle('on', i < pin.length));
    const tryPin = async () => {
      if (await window.athlos.security.verifyPin(pin, db.settings.pin)) {
        node.style.transition = 'opacity .4s'; node.style.opacity = '0';
        setTimeout(() => node.remove(), 400);
        document.removeEventListener('keydown', key);
        resolve();
      } else {
        const box = $('.lock-box', node);
        box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
        pin = ''; dots();
      }
    };
    const press = n => {
      if (n === 'c') pin = pin.slice(0, -1);
      else if (n === 'ok') return tryPin();
      else if (pin.length < 6) pin += n;
      dots();
      if (pin.length === 6) tryPin();
    };
    const key = e => {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === 'Backspace') press('c');
      if (e.key === 'Enter') press('ok');
    };
    document.addEventListener('keydown', key);
    on(node, 'click', '[data-n]', (e, t) => press(t.dataset.n));
  });
}

// ------------------------------------------------------------------ avvisi all'avvio
function startupNotifications() {
  if (!db.settings.notifyOnStart) return;
  const s = certStats();
  if (s.expired + s.soon > 0) {
    window.athlos.system.notify({
      title: 'Certificati medici da controllare',
      body: `${s.expired ? `${s.expired} scaduti` : ''}${s.expired && s.soon ? ' e ' : ''}${s.soon ? `${s.soon} in scadenza nei prossimi ${db.settings.reminderDays} giorni` : ''}. Apri lo scadenzario per avvisare le famiglie.`,
    });
  }
  const b = birthdaysToday();
  if (b.length) {
    window.athlos.system.notify({ title: '🎂 Compleanni di oggi', body: b.map(c => `${c.nome} ${c.cognome}`).join(', ') });
  }
}

// ------------------------------------------------------------------ scorciatoie
function shortcuts() {
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) { e.preventDefault(); go('/atleti/nuovo'); }
    if (mod && e.key.toLowerCase() === 'r' && !e.shiftKey) { e.preventDefault(); go('/ricevute/nuova?tipo=generale'); }
    if (mod && e.key === ',') { e.preventDefault(); go('/impostazioni'); }
  });
  document.addEventListener('pointerdown', ripple);
}

// ------------------------------------------------------------------ avvio
async function boot() {
  const t0 = performance.now();
  await db.init();
  await applyTheme();
  const wait = Math.max(0, 1300 - (performance.now() - t0));
  setTimeout(async () => {
    const splash = $('#splash');
    if (db.settings.pin && db.settings.lockOnStart) await lockScreen();
    if (!db.settings.onboardingDone) {
      const { runOnboarding } = await import('./views/onboarding.js');
      splash.classList.add('out');
      await runOnboarding();
    }
    renderShell();
    shortcuts();
    window.addEventListener('hashchange', route);
    window.athlos.on('navigate', path => go(path));
    window.athlos.on('notify:click', () => {});
    if (!location.hash) location.hash = '/dashboard';
    await route();
    splash.classList.add('out');
    setTimeout(() => splash.remove(), 700);
    startupNotifications();
    startChat().then(updateBadges).catch(err => console.warn('Chat non avviata:', err));
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (db.settings.theme === 'auto') applyTheme().then(updateThemeIcon); });
  }, wait);
}

window.addEventListener('error', e => toast('Errore: ' + (e.message || 'imprevisto'), { type: 'error' }));
window.addEventListener('unhandledrejection', e => toast('Errore: ' + (e.reason && e.reason.message || e.reason || 'imprevisto'), { type: 'error' }));

boot();

export { openPalette, updateBadges, chatState };
