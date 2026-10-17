// Documenti stampabili (HTML autonomo) e finestra di stampa con anteprima, scelta stampante e PDF.
import { db } from '../lib/db.js';
import { modal, icon, toast, $ } from '../lib/ui.js';
import { esc } from '../lib/format.js';

const FONT_BASE = new URL('../../assets/fonts/', import.meta.url).href;

export function fontCSS() {
  return `
  @font-face{font-family:'Plus Jakarta Sans';font-weight:200 800;src:url('${FONT_BASE}plus-jakarta-sans-latin-wght-normal.woff2') format('woff2');}
  @font-face{font-family:'Plus Jakarta Sans';font-weight:200 800;src:url('${FONT_BASE}plus-jakarta-sans-latin-ext-wght-normal.woff2') format('woff2');unicode-range:U+0100-024F,U+1E00-1EFF;}
  @font-face{font-family:'Outfit';font-weight:100 900;src:url('${FONT_BASE}outfit-latin-wght-normal.woff2') format('woff2');}
  @font-face{font-family:'JetBrains Mono';font-weight:400;src:url('${FONT_BASE}jetbrains-mono-latin-400-normal.woff2') format('woff2');}`;
}

export function docShell({ title, body, css = '', page = 'A4', landscape = false }) {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>${fontCSS()}
  @page { size: ${page === 'A5' ? 'A5' : page === 'A4' ? 'A4' : 'auto'} ${landscape ? 'landscape' : 'portrait'}; margin: ${page.startsWith('Termica') ? '2mm' : '12mm'}; }
  *{box-sizing:border-box} html,body{margin:0;padding:0}
  body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1b1838;font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}
  h1,h2,h3{font-family:'Outfit','Plus Jakarta Sans',sans-serif;margin:0}
  .mono{font-family:'JetBrains Mono',monospace}
  ${css}</style></head><body>${body}</body></html>`;
}

export function listDocument({ title, subtitle, head, rows }) {
  const c = db.company;
  const name = c.tipoSoggetto === 'persona' ? `${c.nome} ${c.cognome}` : c.denominazione;
  return docShell({
    title,
    landscape: true,
    css: `
    .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #7C4DFF;padding-bottom:8px;margin-bottom:12px}
    .top h1{font-size:20pt} .top p{margin:2px 0 0;color:#6b6890;font-size:9.5pt}
    table{width:100%;border-collapse:collapse;font-size:9.5pt}
    th{text-align:left;background:#F1EEFF;color:#4b3aa8;padding:6px 8px;font-size:8.5pt;text-transform:uppercase;letter-spacing:.04em}
    td{padding:6px 8px;border-bottom:1px solid #e7e4f3}
    tr:nth-child(even) td{background:#FBFAFF}
    .foot{margin-top:10px;font-size:8.5pt;color:#8a86a6;text-align:right}`,
    body: `<div class="top"><div><h1>${esc(title)}</h1><p>${esc(subtitle || '')}</p></div><div style="text-align:right"><b>${esc(name || '')}</b><p>${esc(c.formaGiuridica || '')}</p></div></div>
      <table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(v => `<td>${esc(v ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <div class="foot">Stampato con Athlos Suite · ${new Date().toLocaleString('it-IT')}</div>`,
  });
}

// Stampa con la finestra di anteprima e scelta della stampante
export function printDocument(html, { title = 'Documento', landscape = false, pageSize, fileName, onPrinted } = {}) {
  const st = db.settings.printer;
  let format = pageSize || st.formato || 'A4';
  return new Promise(resolve => {
    const m = modal({
      title: `Stampa · ${title}`,
      subtitle: 'Anteprima di stampa, scelta della stampante e salvataggio in PDF',
      icon: 'printer',
      size: 'xl',
      onClose: resolve,
      body: `<div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:22px;align-items:start">
        <div class="paper" style="background:#E9E7F3;padding:18px;border-radius:14px;max-height:66vh;overflow:auto"><div class="paper" style="margin:0 auto;max-width:${landscape ? '100%' : '640px'}"><iframe id="pv" style="height:62vh"></iframe></div></div>
        <div class="col" style="gap:14px">
          <label class="field"><span>Stampante</span><select id="prt"><option value="">Caricamento stampanti…</option></select><small class="hint" id="prtHint"></small></label>
          <label class="field"><span>Formato carta</span><select id="fmt"></select></label>
          <label class="field"><span>Copie</span><input id="cop" type="number" min="1" max="20" value="${Number(st.copie) || 1}"></label>
          <label class="switch"><input type="checkbox" id="sil" ${st.silent ? 'checked' : ''}><i></i>Stampa diretta, senza finestra di Windows</label>
          <div class="sep" style="margin:4px 0"></div>
          <button class="btn primary lg" id="doPrint">${icon('printer', 18)}Stampa</button>
          <button class="btn" id="doPdf">${icon('file-down', 17)}Salva come PDF</button>
          <p class="muted tiny">Le stampanti sono quelle installate in Windows (USB, rete, Wi-Fi o virtuali come “Microsoft Print to PDF”).</p>
        </div>
      </div>`,
    });
    const pv = $('#pv', m.body);
    pv.srcdoc = html;
    window.athlos.print.formats().then(fmts => {
      $('#fmt', m.body).innerHTML = fmts.map(f => `<option ${f === format ? 'selected' : ''}>${f}</option>`).join('');
    });
    window.athlos.print.printers().then(list => {
      const sel = $('#prt', m.body);
      if (!list.length) {
        sel.innerHTML = '<option value="">Nessuna stampante trovata</option>';
        $('#prtHint', m.body).textContent = 'Collega una stampante in Windows oppure salva in PDF.';
        return;
      }
      const preferred = st.deviceName && list.some(p => p.name === st.deviceName) ? st.deviceName : (list.find(p => p.isDefault) || list[0]).name;
      sel.innerHTML = list.map(p => `<option value="${esc(p.name)}" ${p.name === preferred ? 'selected' : ''}>${esc(p.displayName)}${p.isDefault ? ' (predefinita)' : ''}</option>`).join('');
    });
    $('#fmt', m.body).addEventListener('change', e => { format = e.target.value; });
    $('#doPrint', m.body).onclick = async () => {
      const deviceName = $('#prt', m.body).value;
      const res = await window.athlos.print.html({
        html, deviceName, silent: $('#sil', m.body).checked, copies: Number($('#cop', m.body).value) || 1, pageSize: format, landscape,
      });
      if (res.success) {
        toast('Documento inviato alla stampante');
        db.log('print', `Stampato: ${title}`);
        onPrinted && onPrinted();
        m.close(true);
      } else if (res.failureReason && !/cancel/i.test(res.failureReason)) {
        toast('Stampa non riuscita: ' + res.failureReason, { type: 'error' });
      }
    };
    $('#doPdf', m.body).onclick = async () => {
      const p = await window.athlos.print.pdf({ html, defaultName: fileName || title, pageSize: format, landscape });
      if (p) { toast('PDF salvato'); m.close(true); }
    };
  });
}

// Stampa immediata con le impostazioni salvate (usata da "Salva e stampa")
export async function quickPrint(html, { landscape = false, pageSize } = {}) {
  const st = db.settings.printer;
  const res = await window.athlos.print.html({ html, deviceName: st.deviceName || undefined, silent: !!st.silent && !!st.deviceName, copies: st.copie || 1, pageSize: pageSize || st.formato, landscape });
  if (res.success) toast('Inviato alla stampante');
  else if (res.failureReason && !/cancel/i.test(res.failureReason)) toast('Stampa non riuscita: ' + res.failureReason, { type: 'error' });
  return res.success;
}
