// Navigazione tra le schermate tramite l'hash dell'indirizzo (#/atleti/123?tab=ricevute).

const ROUTES = [
  ['/dashboard', () => import('../views/dashboard.js')],
  ['/societa', () => import('../views/societa.js')],
  ['/discipline', () => import('../views/discipline.js')],
  ['/atleti', () => import('../views/atleti.js')],
  ['/atleti/nuovo', () => import('../views/atleta-form.js')],
  ['/atleti/:id', () => import('../views/atleta.js')],
  ['/atleti/:id/modifica', () => import('../views/atleta-form.js')],
  ['/ricevute', () => import('../views/ricevute.js')],
  ['/ricevute/nuova', () => import('../views/ricevuta-editor.js')],
  ['/scadenzario', () => import('../views/scadenzario.js')],
  ['/comunica', () => import('../views/comunica.js')],
  ['/squadra', () => import('../views/squadra.js')],
  ['/studio', () => import('../views/studio-home.js')],
  ['/impostazioni', () => import('../views/impostazioni.js')],
  ['/guida', () => import('../views/guida.js')],
];

export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/dashboard';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const [pattern, loader] of ROUTES) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    const m = path.match(re);
    if (m) {
      const params = {};
      keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { path, pattern, loader, params, query };
    }
  }
  return { path: '/dashboard', pattern: '/dashboard', loader: ROUTES[0][1], params: {}, query: {} };
}

export function go(path) {
  if (location.hash === '#' + path) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = path;
}

export function back(fallback = '/dashboard') {
  if (history.length > 1) history.back(); else go(fallback);
}
