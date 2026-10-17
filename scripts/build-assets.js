/*
 * Rigenera gli asset statici inclusi nel repository:
 *   - font (woff2) + fonts.css      -> src/renderer/assets/fonts
 *   - set di icone (Lucide, ISC)    -> src/renderer/js/lib/icons.js
 *   - elenco comuni italiani        -> src/renderer/js/data/comuni.js
 *
 * Uso: node scripts/build-assets.js <cartella node_modules con i pacchetti> [comuni.json]
 * I pacchetti richiesti sono elencati in FONTS e in lucide-static.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NM = path.resolve(process.argv[2] || path.join(ROOT, 'node_modules'));
const COMUNI_JSON = process.argv[3];

// [famiglia CSS, pacchetto, file woff2, peso, variabile?]
const FONTS = [
  ['Plus Jakarta Sans', '@fontsource-variable/plus-jakarta-sans', 'plus-jakarta-sans-latin-wght-normal.woff2', '200 800', true],
  ['Plus Jakarta Sans', '@fontsource-variable/plus-jakarta-sans', 'plus-jakarta-sans-latin-ext-wght-normal.woff2', '200 800', true, 'ext'],
  ['Outfit', '@fontsource-variable/outfit', 'outfit-latin-wght-normal.woff2', '100 900', true],
  ['Montserrat', '@fontsource-variable/montserrat', 'montserrat-latin-wght-normal.woff2', '100 900', true],
  ['Poppins', '@fontsource/poppins', 'poppins-latin-400-normal.woff2', '400'],
  ['Poppins', '@fontsource/poppins', 'poppins-latin-700-normal.woff2', '700'],
  ['Poppins', '@fontsource/poppins', 'poppins-latin-900-normal.woff2', '900'],
  ['Bebas Neue', '@fontsource/bebas-neue', 'bebas-neue-latin-400-normal.woff2', '400'],
  ['Anton', '@fontsource/anton', 'anton-latin-400-normal.woff2', '400'],
  ['Oswald', '@fontsource-variable/oswald', 'oswald-latin-wght-normal.woff2', '200 700', true],
  ['Playfair Display', '@fontsource-variable/playfair-display', 'playfair-display-latin-wght-normal.woff2', '400 900', true],
  ['Lobster', '@fontsource/lobster', 'lobster-latin-400-normal.woff2', '400'],
  ['Pacifico', '@fontsource/pacifico', 'pacifico-latin-400-normal.woff2', '400'],
  ['Dancing Script', '@fontsource-variable/dancing-script', 'dancing-script-latin-wght-normal.woff2', '400 700', true],
  ['Permanent Marker', '@fontsource/permanent-marker', 'permanent-marker-latin-400-normal.woff2', '400'],
  ['Caveat', '@fontsource-variable/caveat', 'caveat-latin-wght-normal.woff2', '400 700', true],
  ['Righteous', '@fontsource/righteous', 'righteous-latin-400-normal.woff2', '400'],
  ['Bangers', '@fontsource/bangers', 'bangers-latin-400-normal.woff2', '400'],
  ['Raleway', '@fontsource-variable/raleway', 'raleway-latin-wght-normal.woff2', '100 900', true],
  ['Roboto Slab', '@fontsource-variable/roboto-slab', 'roboto-slab-latin-wght-normal.woff2', '100 900', true],
  ['Archivo Black', '@fontsource/archivo-black', 'archivo-black-latin-400-normal.woff2', '400'],
  ['Fredoka', '@fontsource-variable/fredoka', 'fredoka-latin-wght-normal.woff2', '300 700', true],
  ['Lilita One', '@fontsource/lilita-one', 'lilita-one-latin-400-normal.woff2', '400'],
  ['Great Vibes', '@fontsource/great-vibes', 'great-vibes-latin-400-normal.woff2', '400'],
  ['Abril Fatface', '@fontsource/abril-fatface', 'abril-fatface-latin-400-normal.woff2', '400'],
  ['Press Start 2P', '@fontsource/press-start-2p', 'press-start-2p-latin-400-normal.woff2', '400'],
  ['Russo One', '@fontsource/russo-one', 'russo-one-latin-400-normal.woff2', '400'],
  ['Satisfy', '@fontsource/satisfy', 'satisfy-latin-400-normal.woff2', '400'],
  ['Luckiest Guy', '@fontsource/luckiest-guy', 'luckiest-guy-latin-400-normal.woff2', '400'],
  ['Black Ops One', '@fontsource/black-ops-one', 'black-ops-one-latin-400-normal.woff2', '400'],
  ['JetBrains Mono', '@fontsource/jetbrains-mono', 'jetbrains-mono-latin-400-normal.woff2', '400'],
];

const ICONS = `
layout-dashboard building-2 trophy users user user-plus user-round receipt receipt-text calendar-clock calendar
calendar-days calendar-check calendar-x calendar-plus bell bell-ring message-circle messages-square send share-2
clapperboard film video image image-plus music mic mic-off type shapes sticker sparkles wand-sparkles layers settings
printer search plus minus x check check-check chevron-down chevron-up chevron-left chevron-right chevrons-left
chevrons-right arrow-left arrow-right arrow-up-right arrow-down arrow-up pencil trash-2 copy download upload save folder-open
file-text file-down file-spreadsheet file-check files filter sliders-horizontal sun moon monitor palette shield-check
lock unlock key-round log-out info circle-help triangle-alert circle-alert circle-check heart-pulse stethoscope cake
gift phone mail map-pin globe credit-card banknote wallet euro hash at-sign qr-code id-card star heart smile smile-plus
paperclip pin pin-off reply ellipsis ellipsis-vertical play pause square skip-back skip-forward scissors undo-2 redo-2
zoom-in zoom-out volume-2 volume-x crop rotate-cw rotate-ccw flip-horizontal flip-vertical move maximize minimize
grid-3x3 align-left align-center align-right bold italic underline eye eye-off wifi wifi-off radio zap flame rocket
dumbbell medal award activity chart-column chart-pie trending-up trending-down clock history list-checks list-todo
square-check-big circle-dot refresh-cw external-link link keyboard command layout-template sparkle party-popper
megaphone instagram facebook twitter baby graduation-cap school briefcase house building store ticket tag tags
book-open notebook-pen clipboard-list clipboard-check contact square-user users-round user-check user-x arrow-down-up
list-filter database hard-drive cloud archive inbox bookmark circle-user badge-check badge-euro scan-line brush pen-tool
eraser droplet contrast aperture camera gauge timer hourglass alarm-clock list layout-grid columns-3 panel-left
panel-right grip-vertical text-cursor-input case-sensitive languages audio-lines audio-waveform waves headphones
speaker disc-3 bot brain lightbulb magnet square-play monitor-play presentation blend paintbrush spline pentagon circle
triangle hexagon octagon diamond arrow-big-right message-square-quote quote bring-to-front send-to-back group ungroup
align-horizontal-justify-center align-vertical-justify-center stamp signature scale percent calculator coins piggy-bank
landmark circle-plus circle-minus circle-x power menu ratio frame focus wand venus mars cake-slice sticky-note
mouse-pointer-click hand gamepad-2 music-2 music-4 drum guitar piano bell-plus send-horizontal at-sign smartphone
message-square message-square-text message-circle-heart reply-all forward archive-restore user-cog shield lock-keyhole
fingerprint key cpu server network laptop link-2 unlink scan qr-code sparkles crown gem infinity thumbs-up target printer-check
heart-handshake image-down film clapperboard square-dashed type-outline text image-up wand-2 volume-1 mic-vocal
square-split-horizontal split copy-plus clipboard-paste lock-open eye triangle-right repeat repeat-1 fast-forward rewind
square-play gauge layers-2 move-3d scaling crop flip-horizontal-2 settings-2 save-all folder-plus history
`.split(/\s+/).filter(Boolean);

function buildFonts() {
  const outDir = path.join(ROOT, 'src/renderer/assets/fonts');
  fs.mkdirSync(outDir, { recursive: true });
  let css = '/* Generato da scripts/build-assets.js — font open source (SIL OFL) tramite Fontsource */\n';
  for (const [family, pkg, file, weight, variable, subset] of FONTS) {
    const src = path.join(NM, pkg, 'files', file);
    if (!fs.existsSync(src)) { console.warn('font mancante:', src); continue; }
    fs.copyFileSync(src, path.join(outDir, file));
    const range = subset === 'ext'
      ? 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'
      : 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
    css += `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weight};src:url('./${file}') format('woff2');unicode-range:${range};}\n`;
  }
  fs.writeFileSync(path.join(outDir, 'fonts.css'), css);
  console.log('fonts ok');
}

function buildIcons() {
  const dir = path.join(NM, 'lucide-static/icons');
  const out = {};
  for (const name of [...new Set(ICONS)]) {
    const f = path.join(dir, name + '.svg');
    if (!fs.existsSync(f)) { console.warn('icona mancante:', name); continue; }
    const svg = fs.readFileSync(f, 'utf8');
    const inner = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'))
      .replace(/\s*\n\s*/g, '').replace(/\s+\/>/g, '/>').trim();
    out[name] = inner;
  }
  // Loghi social disegnati a mano (forme semplificate, riempimento pieno)
  const brands = {
    'brand-whatsapp': '<path fill="currentColor" stroke="none" d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.7c-1.5 0-2.9-.4-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 5 5 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.2Z"/>',
    'brand-messenger': '<path fill="currentColor" stroke="none" d="M12 2C6.4 2 2 6.1 2 11.7c0 2.9 1.2 5.5 3.2 7.2V22l3-1.7c.9.3 1.8.4 2.8.4 5.6 0 10-4.1 10-9.7S17.6 2 12 2Zm1 12.9-2.6-2.7-4.9 2.7 5.4-5.7 2.6 2.7 4.9-2.7-5.4 5.7Z"/>',
    'brand-facebook': '<path fill="currentColor" stroke="none" d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z"/>',
    'brand-instagram': '<rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none"/>',
    'brand-x': '<path fill="currentColor" stroke="none" d="M17.8 2.5h3.1l-6.8 7.8 8 10.6h-6.3l-4.9-6.4-5.6 6.4H2.2l7.3-8.3L1.8 2.5h6.4l4.4 5.9 5.2-5.9Zm-1.1 16.5h1.7L7.4 4.3H5.5L16.7 19Z"/>',
  };
  Object.assign(out, brands);
  const js = '// Generato da scripts/build-assets.js — icone Lucide (ISC) + loghi social semplificati\n' +
    'export const ICONS = ' + JSON.stringify(out) + ';\n';
  fs.mkdirSync(path.join(ROOT, 'src/renderer/js/lib'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'src/renderer/js/lib/icons.js'), js);
  console.log('icone ok:', Object.keys(out).length);
}

function buildComuni() {
  if (!COMUNI_JSON) return;
  const data = JSON.parse(fs.readFileSync(COMUNI_JSON, 'utf8'));
  // [nome, sigla provincia, codice catastale, CAP principale]
  const rows = data.map(c => [c.nome, c.sigla, c.codiceCatastale, (c.cap && c.cap[0]) || ''])
    .sort((a, b) => a[0].localeCompare(b[0], 'it'));
  const js = '// Generato da scripts/build-assets.js — fonte: ISTAT via github.com/matteocontrini/comuni-json\n' +
    '// [nome, provincia, codice catastale, CAP]\n' +
    'export const COMUNI = ' + JSON.stringify(rows) + ';\n';
  fs.mkdirSync(path.join(ROOT, 'src/renderer/js/data'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'src/renderer/js/data/comuni.js'), js);
  console.log('comuni ok:', rows.length);
}

buildFonts();
buildIcons();
buildComuni();
