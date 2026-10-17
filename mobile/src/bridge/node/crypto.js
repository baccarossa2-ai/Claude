export function randomBytes(n) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return { toString: () => Array.from(b, x => x.toString(16).padStart(2, '0')).join('') };
}
export default { randomBytes };
