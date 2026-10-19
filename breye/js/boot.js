/* Boot sequence — Thorion opens straight into the chat (the whole app is the chat) */
(function () {
  'use strict';
  const B = window.B;
  function start() {
    document.body.classList.add('solo'); // chat-only shell: the studio nav is hidden
    const saved = B.ls.get('theme', null);
    if (saved) B.theme.set(saved);
    B.hydrateIcons(document);
    B.$('#themeBtn') && B.$('#themeBtn').addEventListener('click', () => B.theme.toggle());

    // land on the chat; a ?p= deep link asks Thorion for that photo
    let ask = null;
    try { const qp = new URLSearchParams(location.search).get('p'); if (qp) { ask = 'Crea una foto ultra realistica: ' + qp.slice(0, 1500); history.replaceState(null, '', location.pathname); } } catch (e) { /* ignore */ }
    if (location.hash.slice(1) !== 'chat') history.replaceState(null, '', '#chat');
    B.start();
    if (B.current() !== 'chat') B.go('chat', ask ? { ask } : null); else if (ask) B.go('chat', { ask });

    B.ai.init();
    setTimeout(() => B.$('#boot').classList.add('gone'), 900);
    setTimeout(() => B.$('#boot').remove(), 1700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('error', (e) => { if (e && e.message && !/ResizeObserver/.test(e.message)) console.warn('Thorion:', e.message); });
})();
