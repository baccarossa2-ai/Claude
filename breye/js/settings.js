/* Settings & engine status */
(function () {
  'use strict';
  const B = window.B;
  B.view('settings', {
    title: 'Impostazioni', icon: 'Settings', group: 'more', desc: 'Tema, motori AI e dati',
    mount(el) {
      const page = B.h('div', { class: 'page' }), inner = B.h('div', { class: 'page-in', style: 'max-width:900px' });
      page.append(inner); el.append(page);
      inner.append(B.h('div', { class: 'page-head' }, B.h('div', null, B.h('span', { class: 'eyebrow', text: 'Preferenze' }), B.h('h1', { text: 'Impostazioni' }))));
      const eng = B.h('div', { class: 'card', style: 'padding:18px;display:flex;flex-direction:column;gap:14px' });
      inner.append(B.h('h2', { text: 'Motori di Iris', style: 'font-size:var(--t-lg)' }), eng);
      function modelPicker() {
        const sel = B.h('select', { class: 'select sm', id: 'setTextModel', 'aria-label': 'Modello di testo', style: 'margin-top:8px;max-width:340px' }, B.h('option', { value: 'auto' }, 'Automatico · il migliore disponibile'));
        const note = B.h('div', { class: 'mini-note', style: 'margin-top:6px', text: 'Elenco dal vivo dei modelli ospitati ora sulla rete.' });
        B.ai.textModels().then((list) => {
          list.forEach((m) => sel.append(B.h('option', { value: m.name }, m.label + ' · ' + m.count + (m.count === 1 ? ' GPU' : ' GPU'))));
          sel.value = B.ls.get('ai.textModel', 'auto'); if (!sel.value) sel.value = 'auto';
          if (!list.some((m) => /qwen/i.test(m.name) && m.rank === 0)) note.textContent = 'Nessuna versione grande di Qwen è ospitata in questo momento: Iris la userà da sola appena disponibile.';
        });
        sel.addEventListener('change', () => { B.ls.set('ai.textModel', sel.value); B.toast(sel.value === 'auto' ? 'Iris sceglierà il modello migliore' : 'Modello impostato: ' + sel.selectedOptions[0].textContent, 'ok'); });
        return B.h('div', null, sel, note);
      }
      async function renderEng() {
        const e = await B.ai.init();
        const row = (ic, t, s, ok, extra) => B.h('div', { style: 'display:flex;gap:14px;align-items:flex-start' }, B.h('span', { class: 'ec-ic', 'data-i': ic, style: 'width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--panel-3);color:var(--gold);flex:none' }), B.h('div', { style: 'flex:1;min-width:0' }, B.h('b', { text: t }), B.h('div', { class: 'muted', style: 'font-size:13px', text: s }), extra || null), B.h('span', { class: 'badge ' + (ok ? 'ok' : 'err'), text: ok ? 'Attivo' : 'Spento' }));
        eng.innerHTML = '';
        eng.append(
          row('Brain', 'Claude (dentro claude.ai)', 'Testo, codice, visione e agente di design. Nessuna chiave: usa il tuo account Claude.', e.claude),
          row('Globe', 'Modelli linguistici sulla rete GPU comunitaria', 'Testo, codice, strumenti e visione con modelli aperti ospitati dai volontari di AI Horde: Skyfall 31B, Cydonia e Magidonia 24B per i compiti complessi, Rocinante 12B per le risposte rapide; una versione grande di Qwen viene scelta per prima appena un volontario la ospita. Le foto vengono descritte dai GPU della stessa rete. Gratuito, senza chiave e senza quota.' + (B.ai.gate ? ' In uso ora: ' + B.ai.gate.label + '.' : ''), e.web, e.web ? modelPicker() : null),
          row('Camera', 'Rete GPU comunitaria AI Horde', 'Foto ultra realistiche (ICBINP, Realistic Vision, AbsoluteReality…), rifinitura del dettaglio a tasselli, modifiche, riempimento ed espansione. Gratuita e illimitata, senza account: GPU messe a disposizione da volontari. Iris chiede solo scatti piccoli e fa il resto nel browser, così consuma pochissima GPU.', e.horde, e.horde ? null : B.h('a', { href: B.PUBLIC_URL, target: '_blank', rel: 'noopener', style: 'display:inline-block;margin-top:6px;color:var(--gold)', text: 'Apri Breye sul web per usarla →' })),
          row('Wand2', 'Strumenti di realismo (locali)', 'Finitura pellicola (curva filmica, grana, halation, aberrazione), separazione delle frequenze dopo la rifinitura, ingrandimento, scontorno, lettura del testo (OCR) e montaggio video: girano sul tuo dispositivo, senza limiti.', true),
          row('Cpu', 'Motori locali', 'Ritocco, montaggio, export video, PDF, musica generativa e scene 3D girano sul tuo dispositivo.', true)
        );
        const test = B.h('button', { class: 'btn', type: 'button', onclick: async () => {
          test.disabled = true; test.innerHTML = '<span class="spin"></span> Test in corso';
          try { const t = await B.ai.text('Rispondi solo con: Iris è pronta.', { system: false, tier: 'quick' }); B.toast(t.slice(0, 80), 'ok'); }
          catch (er) { B.err(er); }
          test.disabled = false; test.textContent = 'Prova il motore di testo';
        } }, 'Prova il motore di testo');
        eng.append(B.h('div', { class: 'chips' }, test));
        B.hydrateIcons(eng);
      }
      renderEng();

      const gen = B.h('div', { class: 'card', style: 'padding:18px;display:flex;flex-direction:column;gap:16px' });
      inner.append(B.h('h2', { text: 'Aspetto', style: 'font-size:var(--t-lg)' }), gen);
      const seg = B.h('div', { class: 'seg' });
      [['dark', 'Espresso (scuro)', 'Moon'], ['light', 'Crema (chiaro)', 'Sun']].forEach(([k, l, ic]) => seg.append(B.h('button', { type: 'button', class: B.theme.get() === k ? 'on' : '', 'data-t': k, onclick: () => { B.theme.set(k); B.$$('button', seg).forEach((b) => b.classList.toggle('on', b.dataset.t === k)); } }, B.h('span', { 'data-i': ic }), l)));
      gen.append(B.h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap' }, B.h('div', null, B.h('b', { text: 'Tema' }), B.h('div', { class: 'muted', text: 'I marroni dell’iride, al buio o alla luce.' })), seg));

      const data = B.h('div', { class: 'card', style: 'padding:18px;display:flex;flex-direction:column;gap:12px' });
      inner.append(B.h('h2', { text: 'Dati', style: 'font-size:var(--t-lg)' }), data);
      data.append(B.h('p', { class: 'muted', text: 'Progetti, chat e galleria restano in questo browser (IndexedDB). Nessun dato viene inviato altrove, tranne i testi che chiedi a Iris di elaborare.' }));
      data.append(B.h('div', { class: 'chips' },
        B.h('button', { class: 'btn', type: 'button', onclick: async () => { const all = { projects: await B.db.all('projects'), chats: await B.db.all('chats') }; B.save(new Blob([JSON.stringify(all)], { type: 'application/json' }), 'breye-backup.json'); } }, B.h('span', { 'data-i': 'Download' }), 'Backup completo'),
        B.h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await B.confirm('Cancellare tutti i dati?', 'Progetti, chat e galleria verranno eliminati da questo browser.', 'Cancella tutto', true)) { for (const s of ['projects', 'blobs', 'gallery', 'chats', 'kv']) await B.db.clear(s); B.emit('projects'); B.toast('Dati cancellati'); } } }, B.h('span', { 'data-i': 'Trash2' }), 'Cancella tutti i dati')));

      const about = B.h('div', { class: 'card', style: 'padding:18px;display:flex;gap:16px;align-items:center' });
      const eh = B.h('div', { style: 'width:64px;height:64px;flex:none' });
      about.append(eh, B.h('div', null, B.h('b', { html: 'Breye Studio <span class="muted">v' + B.version + '</span>' }), B.h('div', { class: 'muted', text: 'Br(own) + eye. Il nome viene dall’iride marrone del logo. Icone Lucide (ISC), librerie open source caricate da cdnjs.' })));
      inner.append(about); B.eye(eh, { range: 0.12 });
      const shortcuts = B.h('div', { class: 'card', style: 'padding:18px' });
      shortcuts.innerHTML = '<b>Scorciatoie</b><div class="muted" style="display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin-top:10px;font-size:13px"><span><kbd>Ctrl</kbd> <kbd>K</kbd></span><span>Comandi e ricerca</span><span><kbd>Ctrl</kbd> <kbd>Z</kbd> / <kbd>Ctrl</kbd> <kbd>Y</kbd></span><span>Annulla / ripeti negli editor</span><span><kbd>Ctrl</kbd> <kbd>S</kbd></span><span>Salva il progetto</span><span><kbd>Canc</kbd></span><span>Elimina l’elemento selezionato</span><span><kbd>Spazio</kbd></span><span>Play / pausa nel video editor</span><span><kbd>B</kbd> <kbd>E</kbd> <kbd>V</kbd> <kbd>M</kbd></span><span>Pennello, gomma, sposta, selezione nel Foto Studio</span></div>';
      inner.append(shortcuts);
    }
  });
})();
