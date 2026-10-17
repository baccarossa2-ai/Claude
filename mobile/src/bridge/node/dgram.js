// UDP (scoperta delle postazioni) tramite il plugin nativo AthlosLan
import { EventEmitter } from './events.js';
import { Lan } from './lan-plugin.js';

let current = null;
let hooked = false;

class Socket extends EventEmitter {
  bind(port, cb) {
    current = this;
    if (!hooked) {
      hooked = true;
      Lan.addListener('udpMessage', e => {
        if (current) current.emit('message', { toString: () => e.data }, { address: e.address, port: e.port });
      });
    }
    Lan.udpBind({ port }).then(() => { if (cb) cb(); this.emit('listening'); }, err => this.emit('error', err));
  }
  setBroadcast() {}
  setMulticastTTL() {}
  setMulticastLoopback() {}
  addMembership() {}
  send(buf, port, address, cb) {
    Lan.udpSend({ data: buf.toString(), port, address }).then(() => cb && cb(null), err => cb && cb(err));
  }
  close() {
    if (current === this) current = null;
    Lan.udpClose().catch(() => {});
  }
}

export const createSocket = () => new Socket();
export default { createSocket };
