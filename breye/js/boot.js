/* Boot sequence */
(function () {
  'use strict';
  const B = window.B;
  function start() {
    const saved = B.ls.get('theme', null);
    if (saved) B.theme.set(saved);
    B.hydrateIcons(document);
    B.eye(B.$('#brandEye'), { range: 0.1, lid: 'var(--bg-elev)' });
    B.$('#themeBtn').addEventListener('click', () => B.theme.toggle());
    B.$('#cmdBtn').addEventListener('click', () => B.openCmdk());
    B.$('#aiPill').addEventListener('click', () => B.go('settings'));
    B.$('#side').addEventListener('click', (e) => { if (innerWidth > 760 && e.target.closest('.brand')) { e.preventDefault(); B.go('home'); } });
    const ic = B.$('#themeBtn [data-i]'); if (ic) { ic.dataset.i = B.theme.get() === 'light' ? 'Sun' : 'Moon'; B.hydrateIcons(B.$('#themeBtn')); }

    B.start();
    try { const qp = new URLSearchParams(location.search).get('p'); if (qp) { history.replaceState(null, '', location.pathname + '#imagine'); B.go('imagine', { prompt: qp.slice(0, 2000) }); } } catch (e) { /* ignore */ }
    B.ai.init().then((e) => {
      const pill = B.$('#aiPill');
      const any = e.claude || e.web;
      pill.classList.toggle('ready', !!any && !!e.horde);
      pill.classList.toggle('partial', !!any && !e.horde);
      pill.querySelector('.ai-pill-tx').textContent = any ? (e.claude ? 'Iris · Claude' : 'Iris · Web') : 'Iris offline';
      pill.dataset.tip = B.ai.engineLabel();
    });
    setTimeout(() => B.$('#boot').classList.add('gone'), 900);
    setTimeout(() => B.$('#boot').remove(), 1700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('error', (e) => { if (e && e.message && !/ResizeObserver/.test(e.message)) console.warn('Breye:', e.message); });
})();
