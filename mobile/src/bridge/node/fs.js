// File sincroni in memoria per il codice condiviso col PC: si caricano prima dell'avvio
// e ogni rename (salvataggio atomico) viene scritto davvero sul telefono.
const mem = new Map();
let persist = async () => {};

export function __setup(initial, writer) {
  for (const [k, v] of Object.entries(initial)) mem.set(k, v);
  persist = writer;
}
export function readFileSync(p) {
  if (!mem.has(p)) { const e = new Error('ENOENT: ' + p); e.code = 'ENOENT'; throw e; }
  return mem.get(p);
}
export function writeFileSync(p, data) { mem.set(p, String(data)); }
export function existsSync(p) { return mem.has(p); }
export function renameSync(a, b) {
  mem.set(b, mem.get(a));
  mem.delete(a);
  persist(b, mem.get(b)).catch(err => console.error('Chat non salvata:', err));
}
export default { readFileSync, writeFileSync, existsSync, renameSync };
