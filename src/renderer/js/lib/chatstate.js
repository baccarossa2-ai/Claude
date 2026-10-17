// Stato globale della chat Squadra: resta attiva in sottofondo per contare i non letti
// e mostrare le notifiche anche quando si lavora in un'altra schermata.
import { db } from './db.js';
import { uid, colorFor } from './format.js';

const subs = new Set();
export const chatState = {
  snap: null,
  activeChannel: null,
  typing: {},
  started: false,
};

function emit(evt) {
  for (const cb of subs) cb(evt);
}

export function onChat(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function profile() {
  return db.settings.chat.profile;
}

export function networkKey() {
  return db.settings.chat.networkKey || db.company.denominazione || 'athlos';
}

export async function ensureProfile(data) {
  const s = db.settings;
  if (data) {
    s.chat.profile = { id: s.chat.profile?.id || uid('u-'), colore: colorFor(data.nome), ...s.chat.profile, ...data };
    await db.save('settings');
  }
  return s.chat.profile;
}

export async function startChat() {
  const p = profile();
  if (!p) return null;
  chatState.snap = await window.athlos.chat.start(p, networkKey());
  chatState.started = true;
  emit({ type: 'ready' });
  return chatState.snap;
}

export function unreadCount(channelId) {
  const s = chatState.snap;
  const me = profile();
  if (!s || !me) return 0;
  return s.messages.filter(m => (!channelId || m.channel === channelId) && m.from !== me.id && !m.deleted
    && !(m.readBy || []).includes(me.id) && isMine(m.channel)).length;
}

function isMine(channel) {
  const me = profile();
  return !channel.startsWith('dm:') || channel.includes(me.id);
}

window.athlos.on('chat:event', evt => {
  const s = chatState.snap;
  if (!s) return;
  switch (evt.type) {
    case 'message': {
      const i = s.messages.findIndex(m => m.id === evt.message.id);
      if (i >= 0) s.messages[i] = evt.message; else s.messages.push(evt.message);
      if (evt.incoming && (chatState.activeChannel !== evt.message.channel || !document.hasFocus())) {
        window.athlos.system.notify({ title: `Squadra · ${evt.message.fromName}`, body: evt.message.text || '📎 Allegato', silent: document.hasFocus() });
      }
      break;
    }
    case 'update': {
      const i = s.messages.findIndex(m => m.id === evt.message.id);
      if (i >= 0) s.messages[i] = evt.message;
      break;
    }
    case 'presence':
      s.online = evt.online;
      s.contacts = evt.contacts;
      break;
    case 'channels':
      s.channels = evt.channels;
      break;
    case 'typing':
      chatState.typing[evt.channel] = { who: evt.from.nome, until: Date.now() + 3500 };
      break;
    case 'reset':
      chatState.snap = evt.snapshot;
      break;
    default:
      break;
  }
  emit(evt);
});
