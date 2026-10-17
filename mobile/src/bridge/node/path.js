export const join = (...p) => p.filter(Boolean).join('/').replace(/\/+/g, '/');
export const basename = p => String(p).split('/').pop();
export const dirname = p => String(p).split('/').slice(0, -1).join('/');
export default { join, basename, dirname };
