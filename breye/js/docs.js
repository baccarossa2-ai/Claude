/* Documenti & PDF — AI writer and Acrobat-style PDF toolkit */
(function () {
  'use strict';
  const B = window.B;
  B.lib.mammoth = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
  B.lib.turndown = 'https://cdnjs.cloudflare.com/ajax/libs/turndown/7.1.2/turndown.min.js';

  const DOC_TPL = {
    letter: ['Lettera formale', '<p style="text-align:right">Milano, ' + new Date().toLocaleDateString('it-IT', { dateStyle: 'long' }) + '</p><p><b>Spett.le</b><br>Nome Azienda<br>Via Roma 1<br>20100 Milano</p><p><b>Oggetto:</b> richiesta di informazioni</p><p>Gentile Responsabile,</p><p>con la presente desidero…</p><p>Cordiali saluti,</p><p>Nome Cognome</p>'],
    cv: ['Curriculum', '<h1>Nome Cognome</h1><p><i>Designer · Milano · email@esempio.it · +39 333 000 0000</i></p><h2>Profilo</h2><p>Breve presentazione professionale in 2-3 righe.</p><h2>Esperienza</h2><h3>Ruolo · Azienda <span style="color:#8a705a">(2022 – oggi)</span></h3><ul><li>Risultato misurabile ottenuto</li><li>Progetto principale seguito</li></ul><h2>Formazione</h2><p>Laurea in … · Università di … (2020)</p><h2>Competenze</h2><p>Figma, Photoshop, sviluppo web, comunicazione</p>'],
    article: ['Articolo', '<h1>Titolo dell’articolo</h1><p><i>Un sottotitolo che invoglia a leggere.</i></p><p>Paragrafo di apertura che cattura l’attenzione…</p><h2>Primo punto</h2><p>…</p><h2>Secondo punto</h2><p>…</p><blockquote>Una citazione significativa.</blockquote><h2>Conclusione</h2><p>…</p>'],
    minutes: ['Verbale riunione', '<h1>Verbale della riunione</h1><p><b>Data:</b> ' + new Date().toLocaleDateString('it-IT') + ' · <b>Partecipanti:</b> …</p><h2>Ordine del giorno</h2><ol><li>…</li><li>…</li></ol><h2>Decisioni</h2><ul><li>…</li></ul><h2>Azioni</h2><table><tr><th>Azione</th><th>Responsabile</th><th>Scadenza</th></tr><tr><td>…</td><td>…</td><td>…</td></tr></table>'],
    proposal: ['Proposta commerciale', '<h1>Proposta per [Cliente]</h1><p><i>Preparata da [Azienda] · ' + new Date().toLocaleDateString('it-IT') + '</i></p><h2>Obiettivi</h2><p>…</p><h2>Soluzione</h2><p>…</p><h2>Tempi</h2><p>…</p><h2>Investimento</h2><table><tr><th>Voce</th><th>Importo</th></tr><tr><td>…</td><td>€ …</td></tr></table><h2>Prossimi passi</h2><p>…</p>']
  };

  B.view('docs', {
    title: 'Documenti & PDF', icon: 'FileText', group: 'studio', desc: 'Scrittura AI e strumenti PDF',
    mount(el) {
      el.classList.add('docs-view');
      B.loadFont('Lora', '400;600;700');
      const st = { mode: 'write', id: null, name: 'Documento senza titolo', pdfs: [], pages: [], pdfText: '' };
      const nameIn = B.h('input', { id: 'dcName', value: st.name, 'aria-label': 'Nome documento' });
      nameIn.addEventListener('change', () => (st.name = nameIn.value));
      const modeSeg = B.h('div', { class: 'seg' });
      [['write', 'Scrivi', 'Feather'], ['pdf', 'Strumenti PDF', 'FileStack']].forEach(([k, l, ic]) => modeSeg.append(B.h('button', { type: 'button', 'data-m': k, class: k === st.mode ? 'on' : '', onclick: () => setMode(k) }, B.h('span', { 'data-i': ic }), l)));
      const barRight = B.h('div', { class: 'row' });
      const bar = B.h('div', { class: 'bar' }, B.h('div', { class: 'bar-title' }, B.h('span', { class: 'bt-ic', 'data-i': 'FileText' }), nameIn), modeSeg, B.h('div', { class: 'bar-sp' }), barRight);
      const writeEl = B.h('div', { class: 'dc-write' });
      const pdfEl = B.h('div', { class: 'dc-pdf', hidden: true });
      el.append(bar, writeEl, pdfEl);
      function setMode(k) { st.mode = k; B.$$('[data-m]', modeSeg).forEach((b) => b.classList.toggle('on', b.dataset.m === k)); writeEl.hidden = k !== 'write'; pdfEl.hidden = k !== 'pdf'; paintBar(); }
      function paintBar() {
        barRight.innerHTML = '';
        if (st.mode === 'write') barRight.append(B.h('button', { class: 'btn', type: 'button', onclick: (e) => tplMenu(e.currentTarget) }, B.h('span', { 'data-i': 'LayoutTemplate' }), 'Modelli'), B.h('button', { class: 'btn', type: 'button', onclick: importDoc }, B.h('span', { 'data-i': 'Upload' }), 'Importa'), B.h('button', { class: 'btn', type: 'button', onclick: saveDoc }, B.h('span', { 'data-i': 'Save' }), 'Salva'), B.h('button', { class: 'btn gold', type: 'button', onclick: (e) => exportMenu(e.currentTarget) }, B.h('span', { 'data-i': 'Download' }), 'Esporta'));
        B.hydrateIcons(barRight);
      }

      /* ================= writer ================= */
      const page = B.h('div', { class: 'dc-page md', contenteditable: 'true', spellcheck: 'true', 'aria-label': 'Documento' });
      page.innerHTML = '<h1>Benvenuto nel tuo documento</h1><p>Scrivi qui, oppure chiedi a <b>Iris</b> di scrivere per te usando il pannello a destra. Seleziona un paragrafo per riscriverlo, tradurlo o riassumerlo.</p>';
      const tb = B.h('div', { class: 'dc-tb' });
      const cmd = (c, v) => { page.focus(); document.execCommand(c, false, v); };
      const T = (ic, tip, fn) => B.h('button', { class: 'btn icon ghost sm', type: 'button', 'data-tip': tip, 'aria-label': tip, 'data-i': ic, onmousedown: (e) => e.preventDefault(), onclick: fn });
      const block = B.h('select', { class: 'select sm', 'aria-label': 'Stile paragrafo', style: 'width:130px' }, [['p', 'Paragrafo'], ['h1', 'Titolo 1'], ['h2', 'Titolo 2'], ['h3', 'Titolo 3'], ['blockquote', 'Citazione'], ['pre', 'Codice']].map(([v, l]) => B.h('option', { value: v }, l)));
      block.addEventListener('change', () => { cmd('formatBlock', block.value); });
      const fcol = B.h('input', { type: 'color', class: 'swatch-in', value: '#a8642a', 'aria-label': 'Colore testo', oninput: (e) => cmd('foreColor', e.target.value) });
      tb.append(T('Undo2', 'Annulla', () => cmd('undo')), T('Redo2', 'Ripeti', () => cmd('redo')), B.h('div', { class: 'bar-sep' }), block,
        T('Bold', 'Grassetto', () => cmd('bold')), T('Italic', 'Corsivo', () => cmd('italic')), T('Underline', 'Sottolineato', () => cmd('underline')), T('Strikethrough', 'Barrato', () => cmd('strikeThrough')), fcol,
        B.h('div', { class: 'bar-sep' }), T('List', 'Elenco puntato', () => cmd('insertUnorderedList')), T('ListOrdered', 'Elenco numerato', () => cmd('insertOrderedList')),
        T('AlignLeft', 'A sinistra', () => cmd('justifyLeft')), T('AlignCenter', 'Al centro', () => cmd('justifyCenter')), T('AlignRight', 'A destra', () => cmd('justifyRight')), T('AlignJustify', 'Giustificato', () => cmd('justifyFull')),
        B.h('div', { class: 'bar-sep' }), T('Link', 'Inserisci link', async () => { const sel = saveSel(); const u = await B.prompt('Indirizzo del link', 'https://'); restoreSel(sel); if (u) cmd('createLink', u); }),
        T('Table', 'Inserisci tabella', () => cmd('insertHTML', '<table><tr><th>Colonna 1</th><th>Colonna 2</th><th>Colonna 3</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table><p></p>')),
        T('ImagePlus', 'Inserisci immagine', async () => { const sel = saveSel(); const [f] = await B.pickFiles('image/*'); restoreSel(sel); if (f) cmd('insertImage', await B.blobToDataURL(f)); }),
        T('Minus', 'Linea divisoria', () => cmd('insertHorizontalRule')), T('Eraser', 'Cancella formattazione', () => cmd('removeFormat')));
      const stats = B.h('div', { class: 'dc-stats muted' });
      const aiPanel = B.h('aside', { class: 'dc-ai' });
      writeEl.append(B.h('div', { class: 'dc-main' }, tb, B.h('div', { class: 'dc-scroll scroll' }, page), stats), aiPanel);
      function saveSel() { const s = getSelection(); return s.rangeCount ? s.getRangeAt(0).cloneRange() : null; }
      function restoreSel(r) { if (!r) return; page.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      const updStats = () => { const t = page.innerText || ''; const w = (t.match(/\S+/g) || []).length; stats.textContent = w + ' parole · ' + t.length + ' caratteri · ' + Math.max(1, Math.round(w / 220)) + ' min di lettura'; };
      page.addEventListener('input', B.debounce(updStats, 200)); updStats();
      page.addEventListener('paste', (e) => { const html = e.clipboardData.getData('text/html'); if (html) { e.preventDefault(); const clean = window.DOMPurify ? window.DOMPurify.sanitize(html, { FORBID_ATTR: ['style', 'class'] }) : e.clipboardData.getData('text/plain'); document.execCommand('insertHTML', false, clean); } });
      B.need('purify');

      /* AI panel */
      const gen = B.h('textarea', { class: 'textarea', id: 'dcGen', rows: 4, placeholder: 'Cosa vuoi scrivere? es. “lettera di presentazione per un posto da barista”, “articolo di 600 parole sui benefici del caffè”' });
      const genBtn = B.h('button', { class: 'btn gold block', type: 'button', onclick: () => generate() }, B.h('span', { 'data-i': 'Sparkles' }), 'Scrivi con Iris');
      const tone = B.h('select', { class: 'select sm', 'aria-label': 'Tono' }, ['Professionale', 'Amichevole', 'Persuasivo', 'Formale', 'Ironico', 'Poetico', 'Semplice e chiaro'].map((t) => B.h('option', { value: t }, t)));
      const len = B.h('select', { class: 'select sm', 'aria-label': 'Lunghezza' }, [['breve', 'Breve'], ['media', 'Media'], ['lunga', 'Lunga']].map(([v, l]) => B.h('option', { value: v, selected: v === 'media' }, l)));
      aiPanel.append(B.h('div', { class: 'ai-box' }, B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': 'Feather' }), 'Scrittura magica'), gen, B.h('div', { class: 'grid2' }, tone, len), genBtn));
      const acts = B.h('div', { class: 'ai-box' }, B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': 'Wand2' }), 'Sul testo selezionato'), B.h('p', { class: 'mini-note', text: 'Seleziona del testo (o niente, per lavorare sull’intero documento).' }));
      const chips = B.h('div', { class: 'chips' });
      [['Continua a scrivere', 'continue'], ['Riassumi', 'Riassumi in modo chiaro mantenendo i punti chiave.'], ['Correggi', 'Correggi grammatica, ortografia e punteggiatura senza cambiare lo stile.'], ['Più formale', 'Riscrivi con un tono più formale e professionale.'], ['Più semplice', 'Riscrivi in modo più semplice e scorrevole.'], ['Espandi', 'Espandi con più dettagli ed esempi concreti.'], ['Accorcia', 'Rendilo più conciso, circa metà lunghezza.'], ['Elenco puntato', 'Trasforma in un elenco puntato chiaro.'], ['Traduci in inglese', 'Traduci in inglese.'], ['Traduci in italiano', 'Traduci in italiano.'], ['Titolo', 'title']].forEach(([l, ins]) => chips.append(B.h('button', { class: 'chip', type: 'button', onmousedown: (e) => e.preventDefault(), onclick: () => transform(ins) }, l)));
      acts.append(chips); aiPanel.append(acts);
      const ask = B.h('input', { class: 'input sm', id: 'dcAsk', placeholder: 'Fai una domanda sul documento' });
      const askOut = B.h('div', { class: 'md mini-note' });
      ask.addEventListener('keydown', async (e) => { if (e.key !== 'Enter' || !ask.value.trim()) return; askOut.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; try { const t = await B.ai.text('Documento:\n"""\n' + page.innerText.slice(0, 60000) + '\n"""\n\nDomanda: ' + ask.value, { tier: 'default' }); askOut.innerHTML = await B.md(t); } catch (er) { askOut.textContent = B.ai.errorText(er); } });
      aiPanel.append(B.h('div', { class: 'ai-box' }, B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': 'MessageSquare' }), 'Chiedi al documento'), ask, askOut));

      async function generate(promptOverride) {
        const p = (promptOverride || gen.value).trim(); if (!p) return B.toast('Descrivi cosa scrivere');
        genBtn.disabled = true; const old = page.innerHTML;
        page.innerHTML = '<p class="muted">Iris sta scrivendo…</p>';
        try {
          const t = await B.ai.text('Scrivi in Markdown il seguente documento: ' + p + '\nTono: ' + tone.value + '. Lunghezza: ' + len.value + '. Usa titoli, paragrafi ben strutturati ed elenchi dove servono. Rispondi solo con il documento.', { tier: 'default', onText: async ({ text }) => { page.innerHTML = await B.md(text); } });
          page.innerHTML = await B.md(t); updStats();
          const first = page.querySelector('h1'); if (first) { st.name = nameIn.value = first.textContent.slice(0, 60); }
        } catch (e) { page.innerHTML = old; B.err(e); }
        genBtn.disabled = false;
      }
      async function transform(ins) {
        const s = getSelection(); let range = s.rangeCount && page.contains(s.anchorNode) && !s.isCollapsed ? s.getRangeAt(0) : null;
        const text = range ? range.toString() : page.innerText;
        if (!text.trim()) return B.toast('Il documento è vuoto');
        try {
          if (ins === 'continue') { const t = await B.ai.text('Continua questo testo in modo naturale per 1-3 paragrafi, stesso stile e lingua. Rispondi solo con la continuazione in Markdown.\n\n' + page.innerText.slice(-6000), { tier: 'default' }); page.insertAdjacentHTML('beforeend', await B.md(t)); updStats(); return; }
          if (ins === 'title') { const t = await B.ai.text('Proponi un titolo efficace (solo il titolo) per:\n' + text.slice(0, 4000), { system: false, tier: 'quick' }); page.insertAdjacentHTML('afterbegin', '<h1>' + B.esc(t.replace(/^["#\s]+|["\s]+$/g, '')) + '</h1>'); return; }
          const out = await B.ai.text(ins + ' Rispondi solo con il risultato in Markdown, senza commenti.\n\nTesto:\n' + text.slice(0, 60000), { tier: 'default' });
          const html = await B.md(out);
          if (range) { s.removeAllRanges(); s.addRange(range); document.execCommand('insertHTML', false, /^<p>[\s\S]*<\/p>\s*$/.test(html) && !/<\/p>\s*<p>/.test(html) ? html.replace(/^<p>|<\/p>\s*$/g, '') : html); }
          else page.innerHTML = html;
          updStats();
        } catch (e) { B.err(e); }
      }
      function tplMenu(at) { B.menu(at, Object.entries(DOC_TPL).map(([k, [l, h]]) => ({ label: l, icon: 'FileText', fn: () => { page.innerHTML = h; st.name = nameIn.value = l; updStats(); } }))); }
      async function importDoc() {
        const [f] = await B.pickFiles('.txt,.md,.html,.htm,.docx'); if (!f) return;
        try {
          if (/\.docx$/i.test(f.name)) { await B.need('mammoth'); const r = await window.mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() }); page.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(r.value) : r.value; }
          else if (/\.md$/i.test(f.name)) page.innerHTML = await B.md(await f.text());
          else if (/\.html?$/i.test(f.name)) { await B.need('purify'); page.innerHTML = window.DOMPurify.sanitize(await f.text()); }
          else page.innerHTML = (await f.text()).split(/\n{2,}/).map((p) => '<p>' + B.esc(p).replace(/\n/g, '<br>') + '</p>').join('');
          st.name = nameIn.value = f.name.replace(/\.[^.]+$/, ''); updStats(); B.toast('Documento importato', 'ok');
        } catch (e) { B.err(e, 'Non riesco a leggere questo file'); }
      }
      const docCSS = 'body{font-family:Georgia,serif;line-height:1.6;color:#22140b;max-width:720px;margin:40px auto;padding:0 20px}h1,h2,h3{font-family:Helvetica,Arial,sans-serif;color:#3b2314}blockquote{border-left:3px solid #c98a2e;margin:0;padding:4px 16px;color:#5d4230}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d2b994;padding:6px 10px}th{background:#f2e7d7}img{max-width:100%}';
      function exportMenu(at) {
        B.menu(at, [
          { label: 'PDF', icon: 'FileText', fn: exportPDF },
          { label: 'Word (.doc)', icon: 'FileType2', fn: () => B.save(new Blob(['<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>' + docCSS + '</style></head><body>' + page.innerHTML + '</body></html>'], { type: 'application/msword' }), B.slug(st.name) + '.doc') },
          { label: 'Markdown', icon: 'Hash', fn: async () => { await B.need('turndown'); const md = new window.TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' }).turndown(page.innerHTML); B.save(new Blob([md], { type: 'text/markdown' }), B.slug(st.name) + '.md'); } },
          { label: 'Pagina HTML', icon: 'FileCode', fn: () => B.save(new Blob(['<!doctype html><html lang="it"><head><meta charset="utf-8"><title>' + B.esc(st.name) + '</title><style>' + docCSS + '</style></head><body>' + page.innerHTML + '</body></html>'], { type: 'text/html' }), B.slug(st.name) + '.html') },
          { label: 'Testo semplice', icon: 'FileText', fn: () => B.save(new Blob([page.innerText], { type: 'text/plain' }), B.slug(st.name) + '.txt') },
          '-', { label: 'Copia testo', icon: 'Copy', fn: () => B.copy(page.innerText) }
        ], { align: 'right' });
      }
      async function exportPDF() {
        try {
          B.toast('Impagino il PDF…');
          await B.need('jspdf', 'html2canvas');
          const clone = page.cloneNode(true); clone.classList.add('dc-print'); clone.removeAttribute('contenteditable');
          const host = B.h('div', { style: 'position:fixed;left:-10000px;top:0;width:794px;background:#fff' }, clone); document.body.append(host);
          const canvas = await window.html2canvas(clone, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
          host.remove();
          const { jsPDF } = window.jspdf; const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
          const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
          const imgH = canvas.height * pw / canvas.width; let y = 0, pageN = 0;
          const sliceH = Math.floor(canvas.width * ph / pw);
          while (y < canvas.height) {
            const part = document.createElement('canvas'); part.width = canvas.width; part.height = Math.min(sliceH, canvas.height - y);
            part.getContext('2d').drawImage(canvas, 0, y, canvas.width, part.height, 0, 0, canvas.width, part.height);
            if (pageN) pdf.addPage();
            pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, part.height * pw / canvas.width);
            y += sliceH; pageN++;
          }
          void imgH;
          B.save(pdf.output('blob'), B.slug(st.name) + '.pdf');
        } catch (e) { B.err(e, 'Esportazione PDF non riuscita'); }
      }
      async function saveDoc() { st.id = st.id || B.uid('p'); await B.projects.save({ id: st.id, type: 'doc', name: st.name, data: { html: page.innerHTML } }); B.toast('Documento salvato', 'ok'); }
      B.key('mod+s', () => { if (st.mode === 'write') saveDoc(); }, 'docs');

      /* ================= PDF tools ================= */
      const pdfDrop = B.h('div', { class: 'dropzone dc-pdfdrop' }, B.h('span', { 'data-i': 'FileStack' }), B.h('b', { text: 'Trascina PDF o immagini qui' }), B.h('small', { text: 'Unisci, dividi, ruota, riordina, estrai, aggiungi filigrana e numeri di pagina, converti immagini in PDF.' }));
      pdfDrop.addEventListener('click', async () => addPdfFiles(await B.pickFiles('application/pdf,image/*', true)));
      B.dropzone(pdfEl, addPdfFiles, 'application/pdf,image/*');
      const ptools = B.h('div', { class: 'dc-ptools' });
      const grid = B.h('div', { class: 'dc-pgrid' });
      const pside = B.h('aside', { class: 'dc-ai' });
      pdfEl.append(B.h('div', { class: 'dc-main' }, ptools, B.h('div', { class: 'dc-scroll scroll', style: 'padding:18px' }, pdfDrop, grid)), pside);
      const sel = () => st.pages.filter((p) => p.sel);
      function paintPTools() {
        ptools.innerHTML = '';
        const n = st.pages.length, s = sel().length;
        ptools.append(B.h('span', { class: 'muted', style: 'font-size:12.5px;white-space:nowrap', text: n ? n + ' pagine' + (s ? ' · ' + s + ' selezionate' : '') : 'Nessun file' }), B.h('div', { class: 'bar-sp' }),
          T('CheckCircle2', 'Seleziona tutto', () => { const all = s < n; st.pages.forEach((p) => (p.sel = all)); paintGrid(); }),
          T('RotateCw', 'Ruota selezionate', () => { (s ? sel() : st.pages).forEach((p) => (p.rot = (p.rot + 90) % 360)); paintGrid(); }),
          T('Trash2', 'Elimina selezionate', () => { if (!s) return B.toast('Seleziona le pagine da eliminare'); st.pages = st.pages.filter((p) => !p.sel); paintGrid(); }),
          T('Copy', 'Duplica selezionate', () => { const out = []; st.pages.forEach((p) => { out.push(p); if (p.sel) out.push(Object.assign({}, p, { sel: false, uid: B.uid('pg') })); }); st.pages = out; paintGrid(); }),
          B.h('button', { class: 'btn sm', type: 'button', onclick: async () => addPdfFiles(await B.pickFiles('application/pdf,image/*', true)) }, B.h('span', { 'data-i': 'Plus' }), 'Aggiungi'),
          B.h('button', { class: 'btn sm', type: 'button', onclick: () => buildPdf(true) }, B.h('span', { 'data-i': 'Scissors' }), 'Estrai selezionate'),
          B.h('button', { class: 'btn sm', type: 'button', onclick: toImages }, B.h('span', { 'data-i': 'FileImage' }), 'In immagini'),
          B.h('button', { class: 'btn gold sm', type: 'button', onclick: () => buildPdf(false) }, B.h('span', { 'data-i': 'Download' }), 'Salva PDF'));
        B.hydrateIcons(ptools);
      }
      async function ensurePdfJs() { await B.need('pdfjs'); await B.loadScript(B.lib.pdfjsWorker); if (window.pdfjsLib.GlobalWorkerOptions) window.pdfjsLib.GlobalWorkerOptions.workerSrc = B.lib.pdfjsWorker; return window.pdfjsLib; }
      async function addPdfFiles(files) {
        for (const f of files) {
          try {
            if (f.type.startsWith('image/')) { const url = URL.createObjectURL(f); const im = await B.loadImage(url); st.pages.push({ uid: B.uid('pg'), kind: 'image', file: f, thumb: url, w: im.naturalWidth, h: im.naturalHeight, rot: 0, sel: false, name: f.name }); continue; }
            const pdfjs = await ensurePdfJs(); const buf = await f.arrayBuffer();
            const doc = await pdfjs.getDocument({ data: buf.slice(0), isEvalSupported: false }).promise;
            const src = { id: B.uid('pdf'), name: f.name, bytes: buf, doc };
            st.pdfs.push(src);
            for (let i = 1; i <= doc.numPages; i++) {
              const pg = await doc.getPage(i); const vp = pg.getViewport({ scale: 0.35 });
              const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
              st.pages.push({ uid: B.uid('pg'), kind: 'pdf', src: src.id, index: i - 1, thumb: c.toDataURL('image/jpeg', 0.7), rot: 0, sel: false, name: f.name });
            }
          } catch (e) { B.toast('Non riesco ad aprire ' + f.name + (/password/i.test(e.message || '') ? ' (protetto da password)' : ''), 'err'); }
        }
        paintGrid(); paintPSide();
      }
      let dragUid = null;
      function paintGrid() {
        grid.innerHTML = ''; pdfDrop.hidden = !!st.pages.length;
        st.pages.forEach((p, i) => {
          const card = B.h('div', { class: 'dc-pg' + (p.sel ? ' sel' : ''), draggable: 'true', onclick: () => { p.sel = !p.sel; paintGrid(); } },
            B.h('div', { class: 'dc-pgimg' }, B.h('img', { src: p.thumb, alt: 'Pagina ' + (i + 1), style: { transform: 'rotate(' + p.rot + 'deg)' } })),
            B.h('div', { class: 'dc-pgl' }, B.h('b', { text: i + 1 }), B.h('span', { text: p.name })), B.h('span', { class: 'dc-check', 'data-i': 'Check' }));
          card.addEventListener('dragstart', () => { dragUid = p.uid; card.classList.add('drag'); });
          card.addEventListener('dragend', () => card.classList.remove('drag'));
          card.addEventListener('dragover', (e) => e.preventDefault());
          card.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); const from = st.pages.findIndex((x) => x.uid === dragUid); const to = st.pages.indexOf(p); if (from < 0 || from === to) return; const [m] = st.pages.splice(from, 1); st.pages.splice(to, 0, m); paintGrid(); });
          grid.append(card);
        });
        B.hydrateIcons(grid); paintPTools();
      }
      const wmIn = B.h('input', { class: 'input sm', id: 'dcWm', placeholder: 'Testo filigrana (facoltativo)' });
      const numT = B.h('input', { type: 'checkbox', id: 'dcNum' });
      async function buildPdf(onlySel) {
        const pages = onlySel ? sel() : st.pages; if (!pages.length) return B.toast(onlySel ? 'Seleziona le pagine da estrarre' : 'Aggiungi prima dei PDF o immagini');
        try {
          await B.need('pdflib'); const { PDFDocument, degrees, rgb, StandardFonts } = window.PDFLib;
          const out = await PDFDocument.create(); const font = await out.embedFont(StandardFonts.HelveticaBold);
          const cache = {};
          for (const p of pages) {
            let page;
            if (p.kind === 'pdf') { const src = st.pdfs.find((x) => x.id === p.src); if (!cache[src.id]) cache[src.id] = await PDFDocument.load(src.bytes.slice(0), { ignoreEncryption: true }); const [cp] = await out.copyPages(cache[src.id], [p.index]); page = out.addPage(cp); page.setRotation(degrees(((cp.getRotation().angle || 0) + p.rot) % 360)); }
            else { const bytes = new Uint8Array(await p.file.arrayBuffer()); let img; try { img = /png/i.test(p.file.type) ? await out.embedPng(bytes) : await out.embedJpg(bytes); } catch (e) { const im = await B.loadImage(p.thumb); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); img = await out.embedJpg(new Uint8Array(await (await B.canvasToBlob(c, 'image/jpeg', 0.92)).arrayBuffer())); } const A4w = 595, A4h = 842; const land = img.width > img.height; const pw = land ? A4h : A4w, ph = land ? A4w : A4h; page = out.addPage([pw, ph]); const s = Math.min(pw / img.width, ph / img.height) * 0.94; page.drawImage(img, { x: (pw - img.width * s) / 2, y: (ph - img.height * s) / 2, width: img.width * s, height: img.height * s }); if (p.rot) page.setRotation(degrees(p.rot)); }
          }
          const all = out.getPages();
          all.forEach((pg, i) => {
            const { width, height } = pg.getSize();
            if (wmIn.value.trim()) pg.drawText(wmIn.value.trim(), { x: width * 0.12, y: height * 0.35, size: Math.min(width, height) / 9, font, color: rgb(0.66, 0.39, 0.16), opacity: 0.18, rotate: degrees(35) });
            if (numT.checked) { const t = (i + 1) + ' / ' + all.length; pg.drawText(t, { x: width / 2 - font.widthOfTextAtSize(t, 10) / 2, y: 22, size: 10, font, color: rgb(0.35, 0.26, 0.19) }); }
          });
          const bytes = await out.save({ useObjectStreams: true });
          B.save(new Blob([bytes], { type: 'application/pdf' }), (onlySel ? 'estratto' : st.pdfs.length > 1 ? 'uniti' : B.slug((st.pdfs[0] || {}).name || 'documento').replace(/-pdf$/, '')) + '-breye.pdf');
        } catch (e) { B.err(e, 'Creazione del PDF non riuscita'); }
      }
      async function toImages() {
        const pages = sel().length ? sel() : st.pages; if (!pages.length) return;
        try {
          await B.need('jszip'); const zip = new window.JSZip(); let k = 0;
          for (const p of pages) {
            k++;
            if (p.kind === 'image') { zip.file('pagina-' + k + '-' + p.name, p.file); continue; }
            const src = st.pdfs.find((x) => x.id === p.src); const pg = await src.doc.getPage(p.index + 1); const vp = pg.getViewport({ scale: 2, rotation: (pg.rotate + p.rot) % 360 });
            const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            zip.file('pagina-' + k + '.png', await B.canvasToBlob(c));
          }
          B.save(await zip.generateAsync({ type: 'blob' }), 'pagine-pdf.zip');
        } catch (e) { B.err(e); }
      }
      async function pdfText() {
        let out = '';
        for (const src of st.pdfs) { for (let i = 1; i <= src.doc.numPages; i++) { const pg = await src.doc.getPage(i); const tc = await pg.getTextContent(); out += '\n\n--- ' + src.name + ', pagina ' + i + ' ---\n' + tc.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join(''); } }
        return out.trim();
      }
      function paintPSide() {
        pside.innerHTML = '';
        pside.append(B.h('div', { class: 'ai-box' }, B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': 'Stamp' }), 'Opzioni di salvataggio'), wmIn, B.h('label', { class: 'row', style: 'gap:8px;font-size:13px' }, B.h('span', { class: 'switch' }, numT, B.h('span')), 'Numeri di pagina'), B.h('p', { class: 'mini-note', text: 'Trascina le miniature per riordinare. Clicca per selezionare.' })));
        const q = B.h('input', { class: 'input sm', id: 'dcPdfQ', placeholder: 'Chiedi qualcosa ai PDF caricati' });
        const out = B.h('div', { class: 'md mini-note dc-pdfout' });
        const run = async (prompt) => {
          if (!st.pdfs.length) return B.toast('Carica prima un PDF');
          out.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
          try { if (!st.pdfText) st.pdfText = await pdfText(); if (!st.pdfText.trim()) { out.textContent = 'Questo PDF non contiene testo selezionabile (forse è una scansione). Esporta le pagine in immagini e usa l’OCR negli Strumenti.'; return; } const t = await B.ai.text('Contenuto dei PDF:\n"""\n' + st.pdfText.slice(0, 120000) + '\n"""\n\n' + prompt + '\nCita le pagine quando utile.', { tier: 'default', onText: async ({ text }) => { out.innerHTML = await B.md(text); } }); out.innerHTML = await B.md(t); }
          catch (e) { out.textContent = B.ai.errorText(e); }
        };
        q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && q.value.trim()) run('Domanda: ' + q.value); });
        const ch = B.h('div', { class: 'chips' }, [['Riassumi', 'Riassumi il documento in punti chiave.'], ['Punti principali', 'Elenca i 7 punti più importanti.'], ['Scadenze e date', 'Estrai tutte le date, scadenze e importi in una tabella.'], ['Spiega semplice', 'Spiega il contenuto come a uno studente di 15 anni.']].map(([l, p]) => B.h('button', { class: 'chip', type: 'button', onclick: () => run(p) }, l)));
        pside.append(B.h('div', { class: 'ai-box' }, B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': 'MessagesSquare' }), 'Chatta con il PDF'), q, ch, out));
        pside.append(B.h('div', { class: 'ai-box' }, B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': 'FileText' }), 'Testo'), B.h('div', { class: 'grid2' },
          B.h('button', { class: 'btn sm', type: 'button', onclick: async () => { if (!st.pdfs.length) return; B.save(new Blob([await pdfText()], { type: 'text/plain' }), 'testo-pdf.txt'); } }, 'Estrai .txt'),
          B.h('button', { class: 'btn sm', type: 'button', onclick: async () => { if (!st.pdfs.length) return; page.innerHTML = (await pdfText()).split(/\n{2,}/).map((p) => '<p>' + B.esc(p) + '</p>').join(''); setMode('write'); B.toast('Testo aperto nell’editor', 'ok'); } }, 'Apri nell’editor'))));
        B.hydrateIcons(pside);
      }
      paintPTools(); paintPSide(); paintBar();

      this.load = async (p) => {
        if (p.project) { const pr = await B.projects.get(p.project); if (pr) { st.id = pr.id; st.name = nameIn.value = pr.name; page.innerHTML = pr.data.html; setMode('write'); updStats(); } return; }
        if (p.markdown) { page.innerHTML = await B.md(p.markdown); setMode('write'); updStats(); }
        if (p.prompt) { setMode('write'); gen.value = p.prompt; if (p.auto) generate(p.prompt); }
        if (p.pdf) setMode('pdf');
      };
    },
    onShow(p) { if (p && Object.keys(p).length) this.load(p); }
  });
})();
