/*
 * Athlos Suite — processo principale Electron.
 * Finestra applicazione nativa (nessun browser), archivio locale, stampa,
 * notifiche di sistema, chat in rete locale e finestra di Salto Studio.
 */
const {
  app, BrowserWindow, ipcMain, dialog, shell, Notification, Menu, nativeTheme, protocol, clipboard, nativeImage,
} = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { Readable } = require('stream');
const QRCode = require('qrcode');
const { Store } = require('./store');
const printing = require('./printing');
const { LanChat } = require('./chat');

const isDev = process.argv.includes('--dev');
const RENDERER = path.join(__dirname, '..', 'renderer');
const ICON = path.join(__dirname, '..', '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

// Profilo dati separato (utile per provare due postazioni sullo stesso PC)
if (process.env.ATHLOS_PROFILE_DIR) app.setPath('userData', path.resolve(process.env.ATHLOS_PROFILE_DIR));

// Tutta l'interfaccia e i media passano dal protocollo athlos:// (stessa origine):
// athlos://app/… file dell'app, athlos://media/… immagini salvate, athlos://file/… file scelti dall'utente
protocol.registerSchemesAsPrivileged([
  { scheme: 'athlos', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, codeCache: true } },
]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.m4v': 'video/mp4',
  '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac',
};
const USER_FILE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi', '.mp3', '.wav', '.ogg', '.opus', '.m4a', '.aac', '.flac']);

function fileUrl(p) {
  return 'athlos://file/' + encodeURIComponent(p);
}

async function serveAthlos(req) {
  const u = new URL(req.url);
  const rel = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
  let file;
  if (u.host === 'app') {
    file = path.normalize(path.join(RENDERER, rel || 'index.html'));
    if (!file.startsWith(RENDERER)) return new Response('Vietato', { status: 403 });
  } else if (u.host === 'media') {
    file = store.mediaPath(rel);
  } else if (u.host === 'file') {
    file = path.normalize(rel);
    if (!USER_FILE_EXT.has(path.extname(file).toLowerCase())) return new Response('Tipo di file non consentito', { status: 403 });
  } else {
    return new Response('Non trovato', { status: 404 });
  }
  let st;
  try { st = fs.statSync(file); } catch { return new Response('Non trovato', { status: 404 }); }
  if (!st.isFile()) return new Response('Non trovato', { status: 404 });
  const headers = {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': 'bytes',
    'Cache-Control': u.host === 'app' ? 'no-cache' : 'no-store',
  };
  // richieste parziali (Range): indispensabili per scorrere video e audio
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (range && st.size > 0) {
    let start = range[1] === '' ? Math.max(0, st.size - Number(range[2])) : Number(range[1]);
    let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : st.size - 1;
    end = Math.min(end, st.size - 1);
    if (start > end || start >= st.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${st.size}` } });
    headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
    headers['Content-Length'] = String(end - start + 1);
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), { status: 206, headers });
  }
  headers['Content-Length'] = String(st.size);
  return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers });
}

if (!process.env.ATHLOS_PROFILE_DIR && !app.requestSingleInstanceLock()) {
  app.quit();
}

app.setAppUserModelId('it.athlos.suite');
// interfaccia in italiano: date gg/mm/aaaa, correttore ortografico, formati numerici
app.commandLine.appendSwitch('lang', 'it-IT');

let store;
let chat;
let mainWindow;
let studioWindow;
let pendingStudioPayload = null;

const THEME_BAR = {
  dark: { color: '#00000000', symbolColor: '#E9E6FF', height: 44 },
  light: { color: '#00000000', symbolColor: '#2A2547', height: 44 },
};

function createMainWindow() {
  const settings = store.get('settings') || {};
  const dark = settings.theme === 'dark' || (settings.theme !== 'light' && nativeTheme.shouldUseDarkColors);
  const bounds = settings.windowBounds || {};

  mainWindow = new BrowserWindow({
    width: bounds.width || 1440,
    height: bounds.height || 900,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    title: 'Athlos Suite',
    icon: ICON,
    backgroundColor: dark ? '#0D0B1A' : '#F5F4FB',
    titleBarStyle: 'hidden',
    titleBarOverlay: dark ? THEME_BAR.dark : THEME_BAR.light,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  if (bounds.maximized) mainWindow.maximize();
  mainWindow.loadURL('athlos://app/index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());

  const remember = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const s = store.get('settings') || {};
    s.windowBounds = { ...mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized() };
    store.set('settings', s);
  };
  mainWindow.on('resize', debounce(remember, 600));
  mainWindow.on('move', debounce(remember, 600));
  mainWindow.on('closed', () => { mainWindow = null; });

  setupWebContents(mainWindow.webContents);
  try { mainWindow.webContents.session.setSpellCheckerLanguages(['it-IT']); } catch { /* lingua non disponibile */ }
}

function createStudioWindow(payload) {
  if (studioWindow && !studioWindow.isDestroyed()) {
    studioWindow.focus();
    if (payload) studioWindow.webContents.send('studio:open', payload);
    return;
  }
  studioWindow = new BrowserWindow({
    width: 1560,
    height: 960,
    minWidth: 1180,
    minHeight: 720,
    show: false,
    title: 'Salto Studio',
    icon: ICON,
    backgroundColor: '#0B0A14',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#E9E6FF', height: 44 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  studioWindow.loadURL('athlos://app/studio.html');
  pendingStudioPayload = payload || null;
  studioWindow.once('ready-to-show', () => {
    studioWindow.maximize();
    studioWindow.show();
  });
  studioWindow.on('closed', () => { studioWindow = null; });
  setupWebContents(studioWindow.webContents);
}

function setupWebContents(wc) {
  // i link esterni si aprono nel browser/app predefinita, mai dentro Athlos
  wc.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (!url.startsWith('athlos://app/')) {
      e.preventDefault();
      openExternalSafe(url);
    }
  });
  wc.on('context-menu', (_e, params) => {
    const items = [];
    if (params.misspelledWord) {
      for (const s of params.dictionarySuggestions.slice(0, 5)) items.push({ label: s, click: () => wc.replaceMisspelling(s) });
      if (items.length) items.push({ type: 'separator' });
    }
    if (params.isEditable) {
      items.push(
        { label: 'Annulla', role: 'undo' },
        { label: 'Ripeti', role: 'redo' },
        { type: 'separator' },
        { label: 'Taglia', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copia', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Incolla', role: 'paste', enabled: params.editFlags.canPaste },
        { label: 'Seleziona tutto', role: 'selectAll' },
      );
    } else if (params.selectionText) {
      items.push({ label: 'Copia', role: 'copy' });
    }
    if (isDev) items.push({ type: 'separator' }, { label: 'Ispeziona', click: () => wc.inspectElement(params.x, params.y) });
    if (items.length) Menu.buildFromTemplate(items).popup();
  });
  wc.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12' && isDev) wc.toggleDevTools();
    if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i' && isDev) wc.toggleDevTools();
  });
}

function openExternalSafe(url) {
  try {
    const u = new URL(url);
    if (['https:', 'http:', 'mailto:', 'tel:', 'whatsapp:', 'fb-messenger:', 'sms:'].includes(u.protocol)) {
      shell.openExternal(url);
      return true;
    }
  } catch { /* url non valido */ }
  return false;
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function senderWindow(e) {
  return BrowserWindow.fromWebContents(e.sender) || mainWindow;
}

// ------------------------------------------------------------------ IPC
function registerIpc() {
  // --- archivio
  ipcMain.handle('db:load', () => store.data);
  ipcMain.handle('db:put', (_e, collection, value) => {
    if (typeof collection !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(collection)) throw new Error('Collezione non valida');
    store.set(collection, value);
    // avvisa le altre finestre (es. Studio <-> principale)
    for (const w of BrowserWindow.getAllWindows()) {
      if (w.webContents.id !== _e.sender.id) w.webContents.send('db:changed', collection);
    }
    return true;
  });
  ipcMain.handle('db:paths', () => ({ data: store.dir, file: store.file, media: store.mediaDir, backup: store.backupDir }));

  // --- media (foto atleti, logo)
  ipcMain.handle('media:save', (_e, bytes, ext) => store.saveMedia(Buffer.from(bytes), ext));
  ipcMain.handle('media:delete', (_e, name) => { store.deleteMedia(name); return true; });

  // --- backup
  ipcMain.handle('backup:list', () => store.listBackups());
  ipcMain.handle('backup:now', () => store.backupNow());
  ipcMain.handle('backup:restore', (_e, name) => store.restoreBackup(name));
  ipcMain.handle('backup:export', async e => {
    const { canceled, filePath } = await dialog.showSaveDialog(senderWindow(e), {
      title: 'Esporta backup completo',
      defaultPath: `Athlos-backup-${new Date().toISOString().slice(0, 10)}.athlos`,
      filters: [{ name: 'Backup Athlos', extensions: ['athlos'] }],
    });
    if (canceled || !filePath) return null;
    fs.writeFileSync(filePath, store.exportBundle());
    return filePath;
  });
  ipcMain.handle('backup:import', async e => {
    const { canceled, filePaths } = await dialog.showOpenDialog(senderWindow(e), {
      title: 'Importa backup',
      filters: [{ name: 'Backup Athlos', extensions: ['athlos', 'json'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return false;
    store.importBundle(fs.readFileSync(filePaths[0], 'utf8'));
    return true;
  });
  ipcMain.handle('backup:openFolder', () => shell.openPath(store.backupDir));

  // --- stampa
  ipcMain.handle('print:printers', e => printing.listPrinters(e.sender));
  ipcMain.handle('print:formats', () => printing.PAPER_FORMATS);
  ipcMain.handle('print:html', (_e, opts) => printing.printHtml(opts || {}));
  ipcMain.handle('print:pdf', async (e, opts) => {
    const pdf = await printing.htmlToPdf(opts || {});
    let target = opts.filePath;
    if (!target) {
      const { canceled, filePath } = await dialog.showSaveDialog(senderWindow(e), {
        title: 'Salva PDF',
        defaultPath: (opts.defaultName || 'documento') + '.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (canceled || !filePath) return null;
      target = filePath;
    }
    fs.writeFileSync(target, pdf);
    if (opts.open !== false) shell.openPath(target);
    return target;
  });

  // --- file
  ipcMain.handle('file:open', async (e, opts = {}) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(senderWindow(e), {
      title: opts.title || 'Apri file',
      filters: opts.filters || [],
      properties: ['openFile', ...(opts.multiple ? ['multiSelections'] : [])],
    });
    if (canceled) return [];
    return filePaths.map(p => ({
      path: p,
      name: path.basename(p),
      size: fs.statSync(p).size,
      url: fileUrl(p),
      text: opts.readText ? fs.readFileSync(p, 'utf8') : undefined,
      base64: opts.readBase64 ? fs.readFileSync(p).toString('base64') : undefined,
    }));
  });
  ipcMain.handle('file:save', async (e, opts = {}) => {
    let target = opts.filePath;
    if (!target) {
      const { canceled, filePath } = await dialog.showSaveDialog(senderWindow(e), {
        title: opts.title || 'Salva',
        defaultPath: opts.defaultName || 'file',
        filters: opts.filters || [],
      });
      if (canceled || !filePath) return null;
      target = filePath;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const data = opts.base64 != null ? Buffer.from(opts.base64, 'base64')
      : opts.bytes != null ? Buffer.from(opts.bytes)
        : String(opts.text ?? '');
    fs.writeFileSync(target, data);
    if (opts.reveal) shell.showItemInFolder(target);
    return target;
  });
  ipcMain.handle('file:reveal', (_e, p) => { shell.showItemInFolder(p); return true; });
  ipcMain.handle('file:toUrl', (_e, p) => fileUrl(p));
  ipcMain.handle('file:exists', (_e, p) => fs.existsSync(p));
  const studioDir = () => {
    const dir = path.join(app.getPath('documents'), 'Salto Studio');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };
  ipcMain.handle('studio:projectsDir', () => studioDir());
  ipcMain.handle('studio:recent', () => {
    const dir = studioDir();
    return fs.readdirSync(dir)
      .filter(n => n.endsWith('.salto'))
      .map(n => {
        const p = path.join(dir, n);
        const thumb = p + '.jpg';
        return { name: n.replace(/\.salto$/, ''), path: p, mtime: fs.statSync(p).mtimeMs, thumb: fs.existsSync(thumb) ? fileUrl(thumb) + '?t=' + Math.round(fs.statSync(thumb).mtimeMs) : '' };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 24);
  });
  ipcMain.handle('studio:save', (_e, { filePath, name, json, thumb }) => {
    let target = filePath;
    if (!target) {
      const safe = String(name || 'Progetto').replace(/[\\/:*?"<>|]/g, '').trim() || 'Progetto';
      target = path.join(studioDir(), safe + '.salto');
      let i = 2;
      while (fs.existsSync(target)) target = path.join(studioDir(), `${safe} (${i++}).salto`);
    }
    fs.writeFileSync(target, json);
    if (thumb) fs.writeFileSync(target + '.jpg', Buffer.from(thumb.split(',')[1], 'base64'));
    return target;
  });
  ipcMain.handle('studio:load', (_e, p) => fs.readFileSync(p, 'utf8'));
  ipcMain.handle('studio:pending', () => { const p = pendingStudioPayload; pendingStudioPayload = null; return p; });
  ipcMain.handle('studio:delete', (_e, p) => {
    if (!p.endsWith('.salto')) return false;
    for (const f of [p, p + '.jpg']) if (fs.existsSync(f)) fs.unlinkSync(f);
    return true;
  });

  // --- sistema
  ipcMain.handle('shell:open', (_e, url) => openExternalSafe(url));
  ipcMain.handle('clipboard:write', (_e, text) => { clipboard.writeText(String(text)); return true; });
  ipcMain.handle('clipboard:image', (_e, dataUrl) => { clipboard.writeImage(nativeImage.createFromDataURL(dataUrl)); return true; });
  ipcMain.handle('notify', (e, { title, body, silent }) => {
    if (!Notification.isSupported()) return false;
    const n = new Notification({ title, body, silent: !!silent, icon: ICON });
    n.on('click', () => {
      const w = senderWindow(e);
      if (w) { if (w.isMinimized()) w.restore(); w.focus(); w.webContents.send('notify:click', { title }); }
    });
    n.show();
    return true;
  });
  ipcMain.handle('qr:svg', (_e, text, opts = {}) => QRCode.toString(String(text), {
    type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: opts.dark || '#14112B', light: opts.light || '#FFFFFF' },
  }));
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    name: app.getName(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    dataDir: store.dir,
    isDev,
  }));
  ipcMain.handle('app:setTheme', (e, mode) => {
    const w = senderWindow(e);
    nativeTheme.themeSource = mode === 'auto' ? 'system' : mode;
    const dark = mode === 'dark' || (mode === 'auto' && nativeTheme.shouldUseDarkColors);
    if (w && w !== studioWindow && process.platform !== 'darwin') {
      try { w.setTitleBarOverlay(dark ? THEME_BAR.dark : THEME_BAR.light); } catch { /* piattaforma senza overlay */ }
    }
    return dark;
  });
  ipcMain.handle('app:systemDark', () => nativeTheme.shouldUseDarkColors);
  ipcMain.handle('app:relaunch', () => { store.flush(); app.relaunch(); app.exit(0); });
  ipcMain.handle('window:studio', (_e, payload) => { createStudioWindow(payload); return true; });
  ipcMain.handle('window:focusMain', (_e, route) => {
    if (!mainWindow) return false;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    if (route) mainWindow.webContents.send('navigate', route);
    return true;
  });

  // --- PIN di blocco (hash scrypt con sale)
  ipcMain.handle('security:hashPin', (_e, pin) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
    return `${salt}:${hash}`;
  });
  ipcMain.handle('security:verifyPin', (_e, pin, stored) => {
    if (!stored || !stored.includes(':')) return false;
    const [salt, hash] = stored.split(':');
    const test = crypto.scryptSync(String(pin), salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(test, 'hex'), Buffer.from(hash, 'hex'));
  });

  // --- chat Squadra
  const forward = evt => {
    for (const w of BrowserWindow.getAllWindows()) if (w !== studioWindow) w.webContents.send('chat:event', evt);
  };
  chat.on('event', forward);
  ipcMain.handle('chat:start', (_e, profile, key) => chat.start(profile, key));
  ipcMain.handle('chat:snapshot', () => chat.snapshot());
  ipcMain.handle('chat:send', (_e, payload) => chat.send(payload));
  ipcMain.handle('chat:update', (_e, msgId, patch) => chat.update(msgId, patch));
  ipcMain.handle('chat:react', (_e, msgId, emoji) => chat.react(msgId, emoji));
  ipcMain.handle('chat:read', (_e, channel) => { chat.markRead(channel); return true; });
  ipcMain.handle('chat:typing', (_e, channel) => { chat.typing(channel); return true; });
  ipcMain.handle('chat:addChannel', (_e, ch) => chat.addChannel(ch));
  ipcMain.handle('chat:removeChannel', (_e, id) => { chat.removeChannel(id); return true; });
  ipcMain.handle('chat:clear', () => { chat.clearHistory(); return true; });
}

// ------------------------------------------------------------------ avvio
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  store = new Store(app.getPath('userData'));
  chat = new LanChat(app.getPath('userData'));
  try { store.dailyBackup(); } catch (err) { console.error('Backup giornaliero non riuscito:', err.message); }

  protocol.handle('athlos', serveAthlos);

  registerIpc();
  createMainWindow();

  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});

app.on('before-quit', () => {
  try { store && store.flush(); } catch (err) { console.error(err); }
  try { chat && chat.stop(); } catch { /* già fermata */ }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
