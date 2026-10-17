// Segnaposto: sostituito dall'implementazione della chat Squadra su rete locale.
// Contratto: createChatApi(emit) restituisce lo stesso oggetto di window.athlos.chat del desktop
// (start, snapshot, send, update, react, read, typing, addChannel, removeChannel, clear);
// gli eventi vanno passati a emit('chat:event', payload) come fa il processo principale su desktop.
export function createChatApi(emit) {
  const off = async () => null;
  return { start: off, snapshot: off, send: off, update: off, react: off, read: off, typing: off, addChannel: off, removeChannel: off, clear: off };
}
