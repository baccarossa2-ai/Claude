// Crea mobile/www: copia l'interfaccia di Athlos (src/renderer) e aggiunge il ponte Android.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.resolve(here, '..');
const RENDERER = path.resolve(MOBILE, '..', 'src', 'renderer');
const WWW = path.join(MOBILE, 'www');
const SHIMS = path.join(MOBILE, 'src', 'bridge', 'node');

fs.rmSync(WWW, { recursive: true, force: true });
fs.cpSync(RENDERER, WWW, { recursive: true });
fs.rmSync(path.join(WWW, 'package.json'), { force: true });

// 1) ponte window.athlos (Capacitor + chat condivisa col PC)
await build({
  entryPoints: [path.join(MOBILE, 'src', 'bridge', 'index.js')],
  outfile: path.join(WWW, 'mobile', 'bridge.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome90'],
  minify: true,
  legalComments: 'none',
  alias: Object.fromEntries(['dgram', 'net', 'fs', 'os', 'path', 'crypto', 'events'].map(m => [m, path.join(SHIMS, m + '.js')])),
  inject: [path.join(SHIMS, 'buffer.js')],
  define: { 'process.env': '{}' },
  logLevel: 'warning',
});

// 2) avvio: l'app parte solo quando l'archivio del telefono è pronto
fs.cpSync(path.join(MOBILE, 'src', 'web'), path.join(WWW, 'mobile'), { recursive: true });
fs.writeFileSync(path.join(WWW, 'mobile', 'boot-app.js'), "await window.athlosReady;\nawait import('../js/app.js');\n");
fs.writeFileSync(path.join(WWW, 'mobile', 'boot-studio.js'), "await window.athlosReady;\nawait import('../js/studio/main.js');\n");

for (const [page, entry, boot] of [['index.html', 'js/app.js', 'boot-app.js'], ['studio.html', 'js/studio/main.js', 'boot-studio.js']]) {
  const file = path.join(WWW, page);
  let html = fs.readFileSync(file, 'utf8');
  const tag = `<script type="module" src="${entry}"></script>`;
  if (!html.includes(tag)) throw new Error(`${page}: script principale non trovato`);
  html = html.replace(tag, `<script src="mobile/bridge.js"></script>\n  <script type="module" src="mobile/${boot}"></script>`);
  html = html.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">');
  html = html.replace('</head>', '  <link rel="stylesheet" href="mobile/mobile.css">\n</head>');
  fs.writeFileSync(file, html);
}

// 3) indirizzi interni del PC (athlos://app/…) -> percorsi dell'app sul telefono
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
let rewritten = 0;
for (const f of walk(WWW).filter(f => /\.(js|html|css)$/.test(f) && !path.relative(WWW, f).startsWith('mobile'))) {
  const src = fs.readFileSync(f, 'utf8');
  const out = src.replaceAll('athlos://app/', '/');
  if (out !== src) { fs.writeFileSync(f, out); rewritten++; }
}
const left = walk(WWW).filter(f => /\.(js|html)$/.test(f) && !f.endsWith('bridge.js')).filter(f => /athlos:\/\/(app|media)/.test(fs.readFileSync(f, 'utf8')));
if (left.length) throw new Error('Indirizzi athlos:// rimasti in: ' + left.join(', '));

console.log(`www pronta (${rewritten} file adattati)`);
