/*
 * Squadra — chat di lavoro in rete locale, senza server e senza internet.
 *
 * Ogni postazione Athlos annuncia la propria presenza in multicast UDP e riceve
 * i messaggi su una porta TCP. I messaggi viaggiano come righe JSON. Lo storico
 * vive in chat.json nella cartella dati; quando due postazioni si ritrovano,
 * si scambiano i messaggi mancanti (sincronizzazione).
 *
 * Solo le postazioni con la stessa "chiave di rete" (per esempio il nome della
 * società) si vedono tra loro, così due palestre sulla stessa rete restano separate.
 */
const dgram = require('dgram');
const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { EventEmitter } = require('events');

const MCAST_ADDR = '239.255.47.80';
const DISCOVERY_PORT = Number(process.env.ATHLOS_CHAT_DISCOVERY_PORT) || 47800;
const TCP_PORT = Number(process.env.ATHLOS_CHAT_PORT) || 47801;
const HELLO_EVERY = 4000;
const PEER_TIMEOUT = 14000;
const MAX_MESSAGES = 5000;
const MAX_LINE = 12 * 1024 * 1024; // allegati immagine fino a ~8 MB in base64

const DEFAULT_CHANNELS = [
  { id: 'generale', nome: 'Generale', descrizione: 'Comunicazioni per tutto lo staff', icona: 'megaphone', colore: '#7C4DFF' },
  { id: 'segreteria', nome: 'Segreteria', descrizione: 'Iscrizioni, pagamenti e ricevute', icona: 'receipt-text', colore: '#0EA5E9' },
  { id: 'istruttori', nome: 'Istruttori', descrizione: 'Allenamenti, orari e sostituzioni', icona: 'dumbbell', colore: '#F97316' },
  { id: 'gare', nome: 'Gare ed eventi', descrizione: 'Convocazioni, trasferte e risultati', icona: 'trophy', colore: '#EC4899' },
];

function id() {
  return Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
}

class LanChat extends EventEmitter {
  constructor(dir) {
    super();
    this.file = path.join(dir, 'chat.json');
    this.state = this.load();
    this.peers = new Map(); // id -> {profile, address, port, lastSeen, socket}
    this.profile = null;
    this.networkKey = '';
    this.udp = null;
    this.server = null;
    this.port = null;
    this.helloTimer = null;
    this.sweepTimer = null;
    this.saveTimer = null;
    this.running = false;
  }

  load() {
    try {
      const s = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      s.channels = s.channels && s.channels.length ? s.channels : DEFAULT_CHANNELS.slice();
      s.messages = s.messages || [];
      s.contacts = s.contacts || {};
      return s;
    } catch {
      return { channels: DEFAULT_CHANNELS.slice(), messages: [], contacts: {} };
    }
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      if (this.state.messages.length > MAX_MESSAGES) this.state.messages = this.state.messages.slice(-MAX_MESSAGES);
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.state));
      fs.renameSync(tmp, this.file);
    }, 300);
  }

  snapshot() {
    return {
      me: this.profile,
      port: this.port,
      running: this.running,
      channels: this.state.channels,
      messages: this.state.messages,
      contacts: this.state.contacts,
      online: [...this.peers.values()].map(p => ({ ...p.profile, address: p.address })),
      addresses: localAddresses(),
    };
  }

  // ------------------------------------------------------------------ avvio
  async start(profile, networkKey) {
    this.profile = profile;
    this.networkKey = String(networkKey || 'athlos').toLowerCase().trim();
    this.state.contacts[profile.id] = { ...profile, lastSeen: Date.now() };
    if (this.running) {
      this.sayHello();
      return this.snapshot();
    }
    await this.startTcp();
    this.startUdp();
    this.running = true;
    this.helloTimer = setInterval(() => this.sayHello(), HELLO_EVERY);
    this.sweepTimer = setInterval(() => this.sweep(), 3000);
    setTimeout(() => this.sayHello(), 200);
    return this.snapshot();
  }

  stop() {
    clearInterval(this.helloTimer);
    clearInterval(this.sweepTimer);
    if (this.udp) {
      try { this.sendUdp({ t: 'bye' }); } catch { /* rete non disponibile */ }
      try { this.udp.close(); } catch { /* già chiuso */ }
    }
    if (this.server) this.server.close();
    for (const p of this.peers.values()) if (p.socket) p.socket.destroy();
    this.peers.clear();
    this.running = false;
  }

  startTcp() {
    return new Promise(resolve => {
      const server = net.createServer(sock => this.attachSocket(sock, null));
      server.on('error', err => {
        if (err.code === 'EADDRINUSE' && server.listening === false) {
          server.listen(0, '0.0.0.0'); // porta libera casuale
        } else {
          this.emit('event', { type: 'error', message: err.message });
        }
      });
      server.on('listening', () => {
        this.port = server.address().port;
        resolve();
      });
      server.listen(TCP_PORT, '0.0.0.0');
      this.server = server;
    });
  }

  startUdp() {
    const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    udp.on('error', err => this.emit('event', { type: 'error', message: 'Rete: ' + err.message }));
    udp.on('message', (buf, rinfo) => {
      let msg;
      try { msg = JSON.parse(buf.toString('utf8')); } catch { return; }
      if (!msg || msg.k !== this.networkKey || !msg.from || msg.from.id === this.profile.id) return;
      if (msg.t === 'hello') this.onHello(msg, rinfo.address);
      if (msg.t === 'bye') this.dropPeer(msg.from.id);
    });
    udp.bind(DISCOVERY_PORT, () => {
      try {
        udp.setBroadcast(true);
        udp.setMulticastTTL(2);
        udp.setMulticastLoopback(true);
        for (const addr of localAddresses()) {
          try { udp.addMembership(MCAST_ADDR, addr); } catch { /* interfaccia non multicast */ }
        }
        try { udp.addMembership(MCAST_ADDR); } catch { /* già iscritto */ }
      } catch (err) {
        this.emit('event', { type: 'error', message: 'Multicast non disponibile: ' + err.message });
      }
      this.sayHello();
    });
    this.udp = udp;
  }

  sendUdp(obj) {
    if (!this.udp) return;
    const buf = Buffer.from(JSON.stringify({ ...obj, k: this.networkKey, from: this.profile }));
    this.udp.send(buf, DISCOVERY_PORT, MCAST_ADDR, () => {});
    // broadcast di riserva per reti che filtrano il multicast
    for (const b of broadcastAddresses()) this.udp.send(buf, DISCOVERY_PORT, b, () => {});
  }

  sayHello() {
    if (this.profile) this.sendUdp({ t: 'hello', port: this.port, v: 1 });
  }

  onHello(msg, address) {
    const known = this.peers.get(msg.from.id);
    const isNew = !known;
    const peer = known || { socket: null };
    peer.profile = msg.from;
    peer.address = address;
    peer.port = msg.port;
    peer.lastSeen = Date.now();
    this.peers.set(msg.from.id, peer);
    this.state.contacts[msg.from.id] = { ...msg.from, lastSeen: Date.now() };
    if (isNew) {
      this.save();
      this.emit('event', { type: 'presence', online: this.onlineList(), contacts: this.state.contacts });
      // chiedi i messaggi persi mentre eravamo scollegati
      const last = this.state.messages.filter(m => m.from !== this.profile.id).reduce((a, m) => Math.max(a, m.ts), 0);
      this.sendTo(msg.from.id, { t: 'sync-req', since: last - 60000, channels: this.state.channels.map(c => c.id) });
      // riannuncia subito così anche l'altro ci vede
      this.sayHello();
    }
  }

  sweep() {
    const now = Date.now();
    let changed = false;
    for (const [pid, p] of this.peers) {
      if (now - p.lastSeen > PEER_TIMEOUT) {
        if (p.socket) p.socket.destroy();
        this.peers.delete(pid);
        changed = true;
      }
    }
    if (changed) this.emit('event', { type: 'presence', online: this.onlineList(), contacts: this.state.contacts });
  }

  dropPeer(pid) {
    const p = this.peers.get(pid);
    if (!p) return;
    if (p.socket) p.socket.destroy();
    this.peers.delete(pid);
    this.emit('event', { type: 'presence', online: this.onlineList(), contacts: this.state.contacts });
  }

  onlineList() {
    return [...this.peers.values()].map(p => ({ ...p.profile, address: p.address }));
  }

  // ------------------------------------------------------------------ TCP
  attachSocket(sock, peerId) {
    let buf = '';
    sock.setEncoding('utf8');
    sock.setKeepAlive(true, 10000);
    sock.on('data', chunk => {
      buf += chunk;
      if (buf.length > MAX_LINE) { buf = ''; sock.destroy(); return; }
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.k !== this.networkKey || !msg.from) continue;
        if (!peerId) {
          peerId = msg.from.id;
          const p = this.peers.get(peerId);
          if (p && !p.socket) p.socket = sock;
        }
        this.onPacket(msg);
      }
    });
    sock.on('error', () => {});
    sock.on('close', () => {
      const p = peerId && this.peers.get(peerId);
      if (p && p.socket === sock) p.socket = null;
    });
  }

  connect(peer) {
    return new Promise((resolve, reject) => {
      if (peer.socket && !peer.socket.destroyed) return resolve(peer.socket);
      const sock = net.connect({ host: peer.address, port: peer.port }, () => {
        peer.socket = sock;
        this.attachSocket(sock, peer.profile.id);
        resolve(sock);
      });
      sock.setTimeout(5000, () => { sock.destroy(); reject(new Error('timeout')); });
      sock.on('connect', () => sock.setTimeout(0));
      sock.on('error', reject);
    });
  }

  async sendTo(peerId, obj) {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.port) return false;
    try {
      const sock = await this.connect(peer);
      sock.write(JSON.stringify({ ...obj, k: this.networkKey, from: this.profile }) + '\n');
      return true;
    } catch {
      return false;
    }
  }

  broadcast(obj, onlyTo) {
    const targets = onlyTo ? onlyTo.filter(pid => this.peers.has(pid)) : [...this.peers.keys()];
    return Promise.all(targets.map(pid => this.sendTo(pid, obj)));
  }

  // ------------------------------------------------------------------ messaggi
  recipientsOf(channelId) {
    if (channelId.startsWith('dm:')) return channelId.slice(3).split('|').filter(x => x !== this.profile.id);
    return null;
  }

  upsertMessage(m) {
    const i = this.state.messages.findIndex(x => x.id === m.id);
    if (i >= 0) {
      this.state.messages[i] = { ...this.state.messages[i], ...m };
      return false;
    }
    this.state.messages.push(m);
    this.state.messages.sort((a, b) => a.ts - b.ts);
    return true;
  }

  async send({ channel, text, attachment, replyTo, kind = 'text', task }) {
    const m = {
      id: id(),
      channel,
      from: this.profile.id,
      fromName: this.profile.nome,
      fromColor: this.profile.colore,
      text: String(text || '').slice(0, 8000),
      attachment: attachment || null,
      replyTo: replyTo || null,
      kind,
      task: task || null,
      ts: Date.now(),
      reactions: {},
      delivered: [],
      readBy: [],
    };
    this.upsertMessage(m);
    this.save();
    this.emit('event', { type: 'message', message: m });
    const results = await this.broadcast({ t: 'msg', message: m }, this.recipientsOf(channel));
    return { message: m, sentTo: results.filter(Boolean).length };
  }

  async update(messageId, patch) {
    const m = this.state.messages.find(x => x.id === messageId);
    if (!m) return null;
    const allowed = {};
    for (const k of ['reactions', 'task', 'pinned', 'deleted', 'text']) if (k in patch) allowed[k] = patch[k];
    if (allowed.deleted) { allowed.text = ''; allowed.attachment = null; }
    Object.assign(m, allowed, { editedAt: Date.now() });
    this.save();
    this.emit('event', { type: 'update', message: m });
    await this.broadcast({ t: 'upd', id: messageId, patch: { ...allowed, attachment: allowed.deleted ? null : undefined } }, this.recipientsOf(m.channel));
    return m;
  }

  async react(messageId, emoji) {
    const m = this.state.messages.find(x => x.id === messageId);
    if (!m) return null;
    const r = { ...(m.reactions || {}) };
    const list = new Set(r[emoji] || []);
    if (list.has(this.profile.id)) list.delete(this.profile.id); else list.add(this.profile.id);
    if (list.size) r[emoji] = [...list]; else delete r[emoji];
    return this.update(messageId, { reactions: r });
  }

  markRead(channel) {
    const ids = [];
    for (const m of this.state.messages) {
      if (m.channel === channel && m.from !== this.profile.id && !(m.readBy || []).includes(this.profile.id)) {
        m.readBy = [...(m.readBy || []), this.profile.id];
        ids.push({ id: m.id, to: m.from });
      }
    }
    if (!ids.length) return;
    this.save();
    const byAuthor = {};
    for (const x of ids) (byAuthor[x.to] = byAuthor[x.to] || []).push(x.id);
    for (const [author, list] of Object.entries(byAuthor)) this.sendTo(author, { t: 'read', ids: list });
  }

  typing(channel) {
    this.broadcast({ t: 'typing', channel }, this.recipientsOf(channel));
  }

  addChannel(ch) {
    const c = {
      id: (ch.nome || 'canale').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-4),
      nome: ch.nome,
      descrizione: ch.descrizione || '',
      icona: ch.icona || 'hash',
      colore: ch.colore || '#7C4DFF',
    };
    this.state.channels.push(c);
    this.save();
    this.broadcast({ t: 'channel', channel: c });
    this.emit('event', { type: 'channels', channels: this.state.channels });
    return c;
  }

  removeChannel(channelId) {
    this.state.channels = this.state.channels.filter(c => c.id !== channelId);
    this.save();
    this.emit('event', { type: 'channels', channels: this.state.channels });
  }

  clearHistory() {
    this.state.messages = [];
    this.save();
    this.emit('event', { type: 'reset', snapshot: this.snapshot() });
  }

  onPacket(pkt) {
    const fromId = pkt.from.id;
    const peer = this.peers.get(fromId);
    if (peer) peer.lastSeen = Date.now();
    switch (pkt.t) {
      case 'msg': {
        const m = pkt.message;
        if (!m || !m.id || !m.channel) return;
        if (m.channel.startsWith('dm:') && !m.channel.includes(this.profile.id)) return;
        m.delivered = [...new Set([...(m.delivered || []), this.profile.id])];
        if (this.upsertMessage(m)) {
          this.save();
          this.emit('event', { type: 'message', message: m, incoming: true });
        }
        this.sendTo(fromId, { t: 'ack', ids: [m.id] });
        break;
      }
      case 'ack':
      case 'read': {
        const key = pkt.t === 'ack' ? 'delivered' : 'readBy';
        for (const mid of pkt.ids || []) {
          const m = this.state.messages.find(x => x.id === mid);
          if (!m) continue;
          m[key] = [...new Set([...(m[key] || []), fromId])];
          if (key === 'readBy') m.delivered = [...new Set([...(m.delivered || []), fromId])];
          this.emit('event', { type: 'update', message: m });
        }
        this.save();
        break;
      }
      case 'upd': {
        const m = this.state.messages.find(x => x.id === pkt.id);
        if (!m) return;
        const patch = {};
        for (const k of ['reactions', 'task', 'pinned', 'deleted', 'text']) if (pkt.patch && k in pkt.patch) patch[k] = pkt.patch[k];
        if (patch.deleted) patch.attachment = null;
        Object.assign(m, patch, { editedAt: Date.now() });
        this.save();
        this.emit('event', { type: 'update', message: m });
        break;
      }
      case 'typing':
        this.emit('event', { type: 'typing', channel: pkt.channel.startsWith('dm:') ? pkt.channel : pkt.channel, from: pkt.from });
        break;
      case 'channel':
        if (pkt.channel && !this.state.channels.find(c => c.id === pkt.channel.id)) {
          this.state.channels.push(pkt.channel);
          this.save();
          this.emit('event', { type: 'channels', channels: this.state.channels });
        }
        break;
      case 'sync-req': {
        const since = Number(pkt.since) || 0;
        const msgs = this.state.messages.filter(m => m.ts > since && (!m.channel.startsWith('dm:') || m.channel.includes(fromId))).slice(-400);
        const extraChannels = this.state.channels.filter(c => !(pkt.channels || []).includes(c.id));
        this.sendTo(fromId, { t: 'sync-res', messages: msgs, channels: extraChannels });
        break;
      }
      case 'sync-res': {
        let added = 0;
        for (const c of pkt.channels || []) {
          if (!this.state.channels.find(x => x.id === c.id)) { this.state.channels.push(c); added++; }
        }
        for (const m of pkt.messages || []) {
          if (m.channel.startsWith('dm:') && !m.channel.includes(this.profile.id)) continue;
          if (this.upsertMessage(m)) added++;
        }
        if (added) {
          this.save();
          this.emit('event', { type: 'reset', snapshot: this.snapshot() });
        }
        break;
      }
      default:
        break;
    }
  }
}

function localAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

function broadcastAddresses() {
  const out = new Set();
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal || !a.netmask) continue;
      const ip = a.address.split('.').map(Number);
      const mask = a.netmask.split('.').map(Number);
      out.add(ip.map((b, i) => (b | (~mask[i] & 255))).join('.'));
    }
  }
  return [...out];
}

module.exports = { LanChat, DEFAULT_CHANNELS };
