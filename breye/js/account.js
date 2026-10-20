/* Thorion account — sign in with Google on the AI Horde (free, unlimited community GPUs).
   A personal Horde key puts the requests ahead of the shared anonymous queue for photos, video frames
   and text; the network stays free and unlimited. The key never leaves this browser except to aihorde.net. */
(function () {
  'use strict';
  const B = window.B;
  const API = 'https://aihorde.net/api/v2';
  const AGENT = 'thorion:2.0:github.com/baccarossa2-ai/Claude';
  const ANON = '0000000000';
  let state = { key: B.ls.get('horde:key', ''), user: B.ls.get('horde:user', null) };

  B.hordeKey = () => state.key || ANON;

  async function whoami(key) {
    const r = await fetch(API + '/find_user', { headers: { apikey: key, 'Client-Agent': AGENT } });
    if (r.status === 404 || r.status === 401 || r.status === 403) throw Object.assign(new Error('Chiave non valida'), { userMessage: 'Questa chiave non è valida: copiala di nuovo da aihorde.net (dopo l’accesso con Google).' });
    if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { userMessage: 'AI Horde non risponde in questo momento: riprova tra poco.' });
    const u = await r.json();
    return { name: String(u.username || 'Utente'), id: u.id, kudos: Math.round(u.kudos || 0), trusted: !!u.trusted };
  }
  function save(key, user) { state = { key, user }; B.ls.set('horde:key', key); B.ls.set('horde:user', user); B.emit('account', state); }

  B.account = {
    get signedIn() { return !!state.key; },
    get user() { return state.user; },
    async connect(key) { key = String(key || '').trim(); if (!/^[A-Za-z0-9_-]{10,64}$/.test(key) || key === ANON) throw Object.assign(new Error('Chiave non valida'), { userMessage: 'Incolla la API key di AI Horde (una stringa di lettere e numeri).' }); const u = await whoami(key); save(key, u); return u; },
    async refresh() { if (!state.key) return null; try { const u = await whoami(state.key); save(state.key, u); return u; } catch (e) { return state.user; } },
    signOut() { B.ls.del('horde:key'); B.ls.del('horde:user'); state = { key: '', user: null }; B.emit('account', state); },
    open
  };

  /* the sign-in sheet */
  function open() {
    const body = B.h('div', { class: 'acct' });
    const paint = () => {
      body.innerHTML = '';
      if (state.key && state.user) {
        const u = state.user;
        body.append(
          B.h('div', { class: 'acct-me' }, B.h('span', { class: 'acct-av', text: (u.name || '?').slice(0, 1).toUpperCase() }), B.h('div', {}, B.h('b', { text: u.name.replace(/#\d+$/, '') }), B.h('small', { text: 'Account AI Horde · ' + u.kudos + ' kudos · priorità attiva' }))),
          B.h('p', { class: 'muted', text: 'Le tue foto, i fotogrammi dei video e le risposte passano davanti alla coda anonima. La rete resta gratuita e illimitata; più kudos hai, prima arrivano i risultati.' }),
          B.h('div', { class: 'chips' },
            B.h('button', { class: 'btn', type: 'button', onclick: async (e) => { e.currentTarget.disabled = true; await B.account.refresh(); paint(); } }, B.h('span', { 'data-i': 'RefreshCw' }), 'Aggiorna'),
            B.h('a', { class: 'btn ghost', href: 'https://aihorde.net/', target: '_blank', rel: 'noopener' }, B.h('span', { 'data-i': 'ExternalLink' }), 'Il mio account'),
            B.h('button', { class: 'btn ghost', type: 'button', onclick: () => { B.account.signOut(); paint(); } }, B.h('span', { 'data-i': 'LogOut' }), 'Esci')));
      } else {
        const inp = B.h('input', { class: 'input', type: 'password', placeholder: 'Incolla qui la tua API key', autocomplete: 'off', spellcheck: 'false' });
        const err = B.h('p', { class: 'acct-err', hidden: true });
        const go = B.h('button', { class: 'btn gold', type: 'button', onclick: async () => {
          err.hidden = true; go.disabled = true; go.lastChild.textContent = 'Verifico…';
          try { const u = await B.account.connect(inp.value); B.toast('Connesso come ' + u.name.replace(/#\d+$/, '') + ': priorità attiva', 'ok'); paint(); }
          catch (e) { err.textContent = e.userMessage || e.message; err.hidden = false; go.disabled = false; go.lastChild.textContent = 'Collega'; }
        } }, B.h('span', { 'data-i': 'Link' }), B.h('span', { text: 'Collega' }));
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
        body.append(
          B.h('ol', { class: 'acct-steps' },
            B.h('li', {}, B.h('b', { text: 'Accedi con Google' }), B.h('span', { text: ' su AI Horde, la rete GPU gratuita e illimitata che usa Thorion.' }), B.h('div', {}, B.h('a', { class: 'btn g-btn', href: 'https://aihorde.net/register', target: '_blank', rel: 'noopener' }, B.h('span', { class: 'g-logo', html: '<svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>' }), 'Accedi con Google'))),
            B.h('li', {}, B.h('b', { text: 'Copia la API key' }), B.h('span', { text: ' che AI Horde ti mostra subito dopo l’accesso (conservala: vale come password).' })),
            B.h('li', {}, B.h('b', { text: 'Incollala qui' }), B.h('span', { text: ': Thorion la ricorda su questo dispositivo.' }), B.h('div', { class: 'acct-row' }, inp, go), err)),
          B.h('p', { class: 'mini-note', text: 'Senza account Thorion funziona lo stesso, gratis e senza limiti, ma con la coda anonima: con l’account le richieste hanno la precedenza. Le chat restano salvate su questo dispositivo; da “…” puoi esportarle e ripristinarle.' }));
      }
      B.hydrateIcons(body);
    };
    paint();
    B.modal({ title: 'Account Thorion', icon: 'User', body, wide: true });
    if (state.key) B.account.refresh().then(() => paint());
  }
})();
