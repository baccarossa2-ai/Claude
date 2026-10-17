/*
 * Stampa reale: elenco delle stampanti installate in Windows, stampa diretta
 * (silenziosa o con finestra di dialogo di sistema) e generazione PDF.
 * Ogni documento viene caricato in una finestra nascosta e passato allo spooler.
 */
const { BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Formati carta in micron (unità richiesta da Electron per i formati personalizzati)
const PAPER = {
  A4: 'A4',
  A5: 'A5',
  Letter: 'Letter',
  'Termica 80mm': { width: 80000, height: 297000 },
  'Termica 58mm': { width: 58000, height: 297000 },
};

function paper(name) {
  return PAPER[name] || 'A4';
}

async function loadHidden(html) {
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: { sandbox: true, contextIsolation: true, javascript: false },
  });
  const tmp = path.join(os.tmpdir(), `athlos-print-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  try {
    await win.loadFile(tmp);
    // lascia il tempo ai font locali di essere applicati
    await new Promise(r => setTimeout(r, 150));
  } finally {
    fs.unlink(tmp, () => {});
  }
  return win;
}

async function listPrinters(webContents) {
  const printers = await webContents.getPrintersAsync();
  return printers.map(p => ({
    name: p.name,
    displayName: p.displayName || p.name,
    description: p.description || '',
    isDefault: !!p.isDefault || !!(p.options && p.options['printer-is-default']),
    status: p.status,
  }));
}

async function printHtml(opts) {
  const { html, deviceName, silent = false, copies = 1, pageSize = 'A4', landscape = false, margins = 'default' } = opts;
  const win = await loadHidden(html);
  return new Promise(resolve => {
    const printOptions = {
      silent: !!silent,
      printBackground: true,
      copies: Math.max(1, Math.min(20, Number(copies) || 1)),
      pageSize: paper(pageSize),
      landscape: !!landscape,
      margins: { marginType: margins === 'none' ? 'none' : 'default' },
    };
    if (deviceName) printOptions.deviceName = deviceName;
    win.webContents.print(printOptions, (success, failureReason) => {
      win.destroy();
      resolve({ success, failureReason: success ? null : failureReason });
    });
  });
}

async function htmlToPdf({ html, pageSize = 'A4', landscape = false }) {
  const win = await loadHidden(html);
  try {
    const size = paper(pageSize);
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      landscape: !!landscape,
      pageSize: typeof size === 'string' ? size : { width: size.width / 25400, height: size.height / 25400 },
      margins: { marginType: 'default' },
    });
    return pdf;
  } finally {
    win.destroy();
  }
}

module.exports = { listPrinters, printHtml, htmlToPdf, PAPER_FORMATS: Object.keys(PAPER) };
