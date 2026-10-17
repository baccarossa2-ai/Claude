/*
 * Ponte sicuro tra l'interfaccia e il sistema: l'interfaccia non ha accesso
 * diretto a Node, solo a queste funzioni.
 */
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const invoke = (ch, ...args) => ipcRenderer.invoke(ch, ...args);

function on(channel, cb) {
  const allowed = ['chat:event', 'db:changed', 'navigate', 'notify:click', 'studio:open'];
  if (!allowed.includes(channel)) throw new Error('Canale non consentito: ' + channel);
  const handler = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('athlos', {
  platform: process.platform,
  db: {
    load: () => invoke('db:load'),
    put: (collection, value) => invoke('db:put', collection, value),
    paths: () => invoke('db:paths'),
  },
  media: {
    save: (bytes, ext) => invoke('media:save', bytes, ext),
    remove: name => invoke('media:delete', name),
    url: name => (name ? `athlos://media/${encodeURIComponent(name)}` : ''),
  },
  backup: {
    list: () => invoke('backup:list'),
    now: () => invoke('backup:now'),
    restore: name => invoke('backup:restore', name),
    exportFile: () => invoke('backup:export'),
    importFile: () => invoke('backup:import'),
    openFolder: () => invoke('backup:openFolder'),
  },
  print: {
    printers: () => invoke('print:printers'),
    formats: () => invoke('print:formats'),
    html: opts => invoke('print:html', opts),
    pdf: opts => invoke('print:pdf', opts),
  },
  file: {
    open: opts => invoke('file:open', opts),
    save: opts => invoke('file:save', opts),
    reveal: p => invoke('file:reveal', p),
    toUrl: p => invoke('file:toUrl', p),
    exists: p => invoke('file:exists', p),
    pathOf: file => {
      try { return webUtils.getPathForFile(file); } catch { return ''; }
    },
    urlOf: p => (p ? 'athlos://file/' + encodeURIComponent(p) : ''),
    studioDir: () => invoke('studio:projectsDir'),
  },
  studio: {
    recent: () => invoke('studio:recent'),
    save: payload => invoke('studio:save', payload),
    load: p => invoke('studio:load', p),
    remove: p => invoke('studio:delete', p),
    pending: () => invoke('studio:pending'),
  },
  system: {
    open: url => invoke('shell:open', url),
    copy: text => invoke('clipboard:write', text),
    copyImage: dataUrl => invoke('clipboard:image', dataUrl),
    notify: opts => invoke('notify', opts),
    qr: (text, opts) => invoke('qr:svg', text, opts),
    info: () => invoke('app:info'),
    setTheme: mode => invoke('app:setTheme', mode),
    systemDark: () => invoke('app:systemDark'),
    relaunch: () => invoke('app:relaunch'),
    openStudio: payload => invoke('window:studio', payload),
    focusMain: route => invoke('window:focusMain', route),
  },
  security: {
    hashPin: pin => invoke('security:hashPin', pin),
    verifyPin: (pin, stored) => invoke('security:verifyPin', pin, stored),
  },
  chat: {
    start: (profile, key) => invoke('chat:start', profile, key),
    snapshot: () => invoke('chat:snapshot'),
    send: payload => invoke('chat:send', payload),
    update: (id, patch) => invoke('chat:update', id, patch),
    react: (id, emoji) => invoke('chat:react', id, emoji),
    read: channel => invoke('chat:read', channel),
    typing: channel => invoke('chat:typing', channel),
    addChannel: ch => invoke('chat:addChannel', ch),
    removeChannel: id => invoke('chat:removeChannel', id),
    clear: () => invoke('chat:clear'),
  },
  on,
});
