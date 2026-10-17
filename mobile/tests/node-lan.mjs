// Plugin AthlosLan simulato in Node (dgram/net) per provare la chat del telefono contro quella del PC.
import dgram from 'node:dgram';
import net from 'node:net';
import os from 'node:os';

const listeners = new Map();
const emit = (ev, data) => { for (const cb of listeners.get(ev) || []) cb(data); };
const sockets = new Map();
let seq = 1;
let udp = null;
let server = null;

function track(s) {
  const id = seq++;
  sockets.set(id, s);
  s.setEncoding('utf8');
  s.on('data', d => emit('tcpData', { id, data: d }));
  s.on('close', () => { sockets.delete(id); emit('tcpClose', { id }); });
  s.on('error', () => {});
  return id;
}

export const Lan = {
  addListener(ev, cb) { if (!listeners.has(ev)) listeners.set(ev, []); listeners.get(ev).push(cb); return { remove() {} }; },
  async netInfo() {
    const out = [];
    for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address, netmask: a.netmask });
    return { interfaces: out };
  },
  udpBind({ port }) {
    return new Promise((resolve, reject) => {
      udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      udp.on('message', (b, r) => emit('udpMessage', { data: b.toString('utf8'), address: r.address, port: r.port }));
      udp.once('error', reject);
      udp.bind(port, () => { try { udp.setBroadcast(true); udp.setMulticastLoopback(true); udp.addMembership('239.255.47.80'); } catch { /* niente multicast */ } resolve(); });
    });
  },
  async udpSend({ data, address, port }) { await new Promise(r => udp.send(Buffer.from(data), port, address, () => r())); },
  async udpClose() { if (udp) udp.close(); udp = null; },
  tcpListen({ port }) {
    return new Promise((resolve, reject) => {
      server = net.createServer(s => { const id = track(s); emit('tcpConnection', { id, address: s.remoteAddress.replace('::ffff:', '') }); });
      server.once('error', e => reject(new Error(e.code === 'EADDRINUSE' ? 'Porta in use' : e.message)));
      server.listen(port, '0.0.0.0', () => resolve({ port: server.address().port }));
    });
  },
  async tcpServerClose() { if (server) server.close(); server = null; },
  tcpConnect({ host, port }) {
    return new Promise((resolve, reject) => {
      const s = net.connect({ host, port }, () => resolve({ id: track(s) }));
      s.once('error', reject);
    });
  },
  async tcpWrite({ id, data }) { const s = sockets.get(id); if (!s) throw new Error('chiusa'); s.write(data); },
  async tcpClose({ id }) { const s = sockets.get(id); if (s) s.destroy(); },
};
