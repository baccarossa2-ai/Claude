// TCP a righe JSON tramite il plugin nativo AthlosLan
import { EventEmitter } from './events.js';
import { Lan } from './lan-plugin.js';

const sockets = new Map();
const early = new Map();
let server = null;
let hooked = false;

function hook() {
  if (hooked) return;
  hooked = true;
  Lan.addListener('tcpConnection', e => {
    if (!server) { Lan.tcpClose({ id: e.id }).catch(() => {}); return; }
    const s = new Socket(e.id);
    s.remoteAddress = e.address;
    server.handler(s);
  });
  Lan.addListener('tcpData', e => {
    const s = sockets.get(e.id);
    if (s) s.emit('data', e.data);
    else early.set(e.id, (early.get(e.id) || '') + e.data);
  });
  Lan.addListener('tcpClose', e => {
    const s = sockets.get(e.id);
    if (s && !s.destroyed) { s.destroyed = true; sockets.delete(e.id); clearTimeout(s._t); s.emit('close'); }
  });
}

class Socket extends EventEmitter {
  constructor(id) {
    super();
    this.destroyed = false;
    this._t = null;
    if (id != null) this._attach(id);
  }
  _attach(id) {
    this.id = id;
    sockets.set(id, this);
    if (early.has(id)) {
      const d = early.get(id);
      early.delete(id);
      setTimeout(() => this.emit('data', d), 0);
    }
  }
  setEncoding() {}
  setKeepAlive() {}
  setTimeout(ms, cb) {
    clearTimeout(this._t);
    if (ms > 0 && cb) this._t = setTimeout(cb, ms);
  }
  write(s) {
    if (this.destroyed || this.id == null) return false;
    Lan.tcpWrite({ id: this.id, data: String(s) }).catch(() => this.destroy());
    return true;
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    clearTimeout(this._t);
    if (this.id != null) { sockets.delete(this.id); Lan.tcpClose({ id: this.id }).catch(() => {}); }
    this.emit('close');
  }
  end() { this.destroy(); }
}

class Server extends EventEmitter {
  constructor(handler) {
    super();
    this.handler = handler;
    this.listening = false;
    this._port = null;
  }
  listen(port) {
    hook();
    server = this;
    Lan.tcpListen({ port }).then(r => {
      this.listening = true;
      this._port = r.port;
      this.emit('listening');
    }, err => {
      const e = new Error((err && err.message) || 'Porta non disponibile');
      e.code = /in use|EADDRINUSE/i.test(e.message) ? 'EADDRINUSE' : 'ENET';
      this.emit('error', e);
    });
    return this;
  }
  address() { return { port: this._port }; }
  close() {
    this.listening = false;
    if (server === this) server = null;
    Lan.tcpServerClose().catch(() => {});
  }
}

export const createServer = handler => new Server(handler);

export function connect({ host, port }, cb) {
  hook();
  const s = new Socket(null);
  if (cb) s.once('connect', cb);
  Lan.tcpConnect({ host, port, timeout: 5000 }).then(({ id }) => {
    if (s.destroyed) { Lan.tcpClose({ id }).catch(() => {}); return; }
    s._attach(id);
    s.emit('connect');
  }, err => {
    if (s.destroyed) return;
    s.destroyed = true;
    clearTimeout(s._t);
    s.emit('error', err);
    s.emit('close');
  });
  return s;
}

export default { createServer, connect };
