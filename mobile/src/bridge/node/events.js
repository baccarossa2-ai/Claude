// EventEmitter minimo per il codice condiviso col PC (src/main/chat.js)
export class EventEmitter {
  constructor() { this._ev = new Map(); }
  on(name, fn) { if (!this._ev.has(name)) this._ev.set(name, []); this._ev.get(name).push(fn); return this; }
  once(name, fn) { const w = (...a) => { this.removeListener(name, w); fn(...a); }; return this.on(name, w); }
  removeListener(name, fn) { const l = this._ev.get(name); if (l) this._ev.set(name, l.filter(x => x !== fn)); return this; }
  off(name, fn) { return this.removeListener(name, fn); }
  emit(name, ...args) {
    const l = this._ev.get(name);
    if (!l || !l.length) { if (name === 'error') console.warn(args[0]); return false; }
    for (const fn of l.slice()) { try { fn(...args); } catch (err) { console.error(err); } }
    return true;
  }
}
export default { EventEmitter };
