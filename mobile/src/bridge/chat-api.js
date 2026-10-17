// Chat Squadra sul telefono: è lo stesso codice del PC (src/main/chat.js), con rete e file
// forniti dal plugin nativo AthlosLan. Telefoni e PC sulla stessa Wi-Fi si vedono tra loro.
import { Capacitor } from '@capacitor/core';
import { LanChat } from '../../../src/main/chat.js';
import { __setup } from './node/fs.js';
import { __setInterfaces } from './node/os.js';
import { Lan } from './node/lan-plugin.js';
import * as fsx from './fsx.js';

const FILE = 'athlos/chat.json';
const native = Capacitor.isNativePlatform();

export function createChatApi(emit) {
  let chat = null;
  let ready = null;
  let netTimer = null;

  const refreshNet = async () => {
    try { __setInterfaces((await Lan.netInfo()).interfaces); } catch { /* rete non disponibile */ }
  };

  const init = () => {
    if (!ready) {
      ready = (async () => {
        const initial = {};
        try { initial[FILE] = await fsx.readText(FILE); } catch { /* primo avvio */ }
        __setup(initial, (p, text) => fsx.writeText(p, text));
        if (native) {
          await refreshNet();
          netTimer = setInterval(refreshNet, 15000);
        }
        chat = new LanChat('athlos');
        chat.on('event', evt => emit('chat:event', evt));
      })();
    }
    return ready;
  };

  // Senza rete nativa (anteprima web) la chat resta usabile in locale
  const offline = (profile, key) => {
    chat.profile = profile;
    chat.networkKey = String(key || 'athlos').toLowerCase().trim();
    chat.state.contacts[profile.id] = { ...profile, lastSeen: Date.now() };
    return chat.snapshot();
  };

  return {
    start: async (profile, key) => {
      await init();
      if (!native) return offline(profile, key);
      const timeout = new Promise(r => setTimeout(() => r(null), 8000));
      const snap = await Promise.race([chat.start(profile, key), timeout]);
      return snap || offline(profile, key);
    },
    snapshot: async () => { await init(); return chat.snapshot(); },
    send: async payload => { await init(); return chat.send(payload); },
    update: async (id, patch) => { await init(); return chat.update(id, patch); },
    react: async (id, emoji) => { await init(); return chat.react(id, emoji); },
    read: async channel => { await init(); if (chat.profile) chat.markRead(channel); return true; },
    typing: async channel => { await init(); if (chat.profile) chat.typing(channel); return true; },
    addChannel: async ch => { await init(); return chat.addChannel(ch); },
    removeChannel: async id => { await init(); chat.removeChannel(id); return true; },
    clear: async () => { await init(); chat.clearHistory(); return true; },
    _stop: () => { clearInterval(netTimer); if (chat) chat.stop(); },
  };
}
