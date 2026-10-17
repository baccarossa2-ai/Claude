// Buffer ridotto: la chat usa solo testo JSON
export const Buffer = {
  from: s => ({ toString: () => String(s) }),
};
