// Stampa su Android: finestra di stampa di sistema (stampanti Wi-Fi, Bluetooth, Mopria,
// "Salva come PDF") e PDF creati direttamente sul telefono, pronti da condividere.
import { registerPlugin } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { native, safeName } from './fsx.js';

const AthlosPrint = registerPlugin('AthlosPrint');

export const FORMATS = ['A4', 'A5', 'Letter', 'Termica 80mm', 'Termica 58mm'];

const titleOf = html => ((/<title>([^<]*)<\/title>/i.exec(html) || [])[1] || 'Athlos').trim();

export async function printers() {
  return [{
    name: 'android',
    displayName: 'Stampanti del telefono',
    description: 'Wi-Fi, Bluetooth, Mopria o “Salva come PDF”: si sceglie al momento della stampa',
    isDefault: true,
    status: 0,
  }];
}

export async function printHtml({ html, pageSize = 'A4', landscape = false } = {}) {
  if (!native) return webPrint(html);
  try {
    await AthlosPrint.print({ html, jobName: titleOf(html), paper: pageSize, landscape: !!landscape });
    return { success: true, failureReason: null };
  } catch (err) {
    return { success: false, failureReason: (err && err.message) || String(err) };
  }
}

// Crea il PDF e apre la condivisione (WhatsApp, email, Drive, Salva su file…)
export async function pdf({ html, defaultName, pageSize = 'A4', landscape = false } = {}) {
  if (!native) {
    await webPrint(html);
    return null;
  }
  const fileName = safeName(defaultName || titleOf(html)).replace(/\.pdf$/i, '') + '.pdf';
  const res = await AthlosPrint.pdf({ html, fileName, paper: pageSize, landscape: !!landscape });
  try {
    await Share.share({ title: fileName, files: [res.uri], dialogTitle: 'Condividi o salva il PDF' });
  } catch (err) {
    if (/cancel/i.test(String(err && err.message))) return null;
    throw err;
  }
  return res.path;
}

function webPrint(html) {
  return new Promise(resolve => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    f.srcdoc = html;
    f.onload = () => {
      try { f.contentWindow.print(); } catch { /* stampa non disponibile */ }
      setTimeout(() => f.remove(), 1000);
      resolve({ success: true, failureReason: null });
    };
    document.body.appendChild(f);
  });
}
