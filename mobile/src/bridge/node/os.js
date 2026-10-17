// Interfacce di rete lette dal telefono (aggiornate periodicamente dal ponte della chat)
let ifaces = {};
export function __setInterfaces(list) {
  ifaces = {};
  for (const a of list || []) (ifaces[a.name || 'wlan'] = ifaces[a.name || 'wlan'] || []).push({ address: a.address, netmask: a.netmask, family: 'IPv4', internal: false });
}
export const networkInterfaces = () => ifaces;
export const hostname = () => 'android';
export default { networkInterfaces, hostname };
