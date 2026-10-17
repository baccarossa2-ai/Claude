// Modelli pronti di Salto Studio (stile Canva): ogni modello crea un progetto completo,
// già personalizzato con nome, logo e contatti della società.
import { newProject, baseClip, textClip, nid, FORMATS } from './state.js';

const IMG = name => `athlos://app/assets/images/${name}.webp`;
const fmt = id => FORMATS.find(f => f.id === id);

function proj(format, name, bg, dur = 6) {
  const p = newProject(fmt(format));
  p.name = name;
  p.background = bg;
  p.designDuration = dur;
  p.tracks = [
    { id: 'tv1', kind: 'visual', name: 'Sfondo' },
    { id: 'tv2', kind: 'visual', name: 'Immagini' },
    { id: 'tv3', kind: 'visual', name: 'Grafica' },
    { id: 'tv4', kind: 'visual', name: 'Testi' },
    { id: 'tv5', kind: 'visual', name: 'Adesivi' },
    { id: 'ta1', kind: 'audio', name: 'Musica' },
    { id: 'ta2', kind: 'audio', name: 'Voce' },
  ];
  return p;
}

// ogni elemento va su una traccia libera: se quella indicata è occupata ne crea una sopra
const add = (p, track, c) => {
  if (c.duration === 5) c.duration = p.designDuration;
  const busy = id => p.clips.some(o => o.trackId === id && o.start < c.start + c.duration - 1e-3 && o.start + o.duration > c.start + 1e-3);
  let id = track;
  if (busy(id)) {
    const base = p.tracks.find(t => t.id === track);
    const same = p.tracks.filter(t => t.id === track || t.base === track);
    id = same.map(t => t.id).find(x => !busy(x));
    if (!id) {
      const nt = { id: nid('t'), kind: 'visual', name: `${base.name} ${same.length + 1}`, base: track };
      p.tracks.splice(p.tracks.indexOf(same[same.length - 1]) + 1, 0, nt);
      id = nt.id;
    }
  }
  c.trackId = id;
  p.clips.push(c);
  return c;
};
const img = (src, x, y, w, h, extra = {}) => baseClip('image', { src, name: 'Immagine', x, y, w, h, fit: 'cover', ...extra });
const color = (x, y, w, h, extra = {}) => baseClip('color', { name: 'Riquadro', x, y, w, h, ...extra });
const shape = (shapeName, x, y, w, h, extra = {}) => baseClip('shape', { name: 'Forma', shape: shapeName, x, y, w, h, fill: '#7C4DFF', strokeWidth: 0, ...extra });
const sticker = (emoji, x, y, s, extra = {}) => baseClip('sticker', { name: 'Adesivo ' + emoji, emoji, x, y, w: s, h: s, ...extra });
const text = (t, x, y, w, extra = {}) => textClip({ text: t, x, y, w, ...extra });

function brandFooter(p, b, y, extra = {}) {
  const parts = [b.phone && `📞 ${b.phone}`, b.instagram && `📸 ${b.instagram}`].filter(Boolean).join('   ');
  if (parts) add(p, 'tv4', text(parts, p.width / 2, y, p.width - 120, { font: 'Poppins', weight: 600, size: Math.round(p.width / 30), color: '#FFFFFF', animIn: { type: 'fade', duration: 0.8 }, ...extra }));
  if (b.logo) add(p, 'tv5', img(b.logo, p.width - 110, 110, 140, 140, { fit: 'contain', name: 'Logo', animIn: { type: 'pop', duration: 0.6 } }));
}

export const TEMPLATES = [
  {
    id: 'iscrizioni', name: 'Iscrizioni aperte', format: 'post', cat: 'Promozione',
    build: b => {
      const p = proj('post', 'Iscrizioni aperte', { type: 'gradient', colors: ['#5B5BF6', '#8B3DF0', '#E9468F'], angle: 135 });
      add(p, 'tv2', img(IMG('ritmica'), 760, 760, 560, 560, { radius: 280, border: { width: 14, color: '#FFFFFF' }, animIn: { type: 'zoom-in', duration: 0.8 }, loop: { type: 'float', speed: 0.5 } }));
      add(p, 'tv3', shape('burst', 250, 860, 300, 300, { fill: '#FFE14D', loop: { type: 'spin', speed: 0.15 }, animIn: { type: 'pop', duration: 0.6 } }));
      add(p, 'tv4', text('PROVA\nGRATUITA', 250, 860, 260, { font: 'Anton', weight: 400, size: 56, color: '#1B1440', lineHeight: 1, animIn: { type: 'pop', duration: 0.7 } }));
      add(p, 'tv4', text('ISCRIZIONI APERTE', 540, 250, 980, { font: 'Anton', weight: 400, size: 150, uppercase: true, lineHeight: 0.95, color: '#FFFFFF', textShadow: { enabled: true, color: 'rgba(27,20,64,.55)', blur: 0, x: 8, y: 8 }, animIn: { type: 'word-pop', duration: 1.2 } }));
      add(p, 'tv4', text(`Stagione ${b.season}`, 540, 440, 520, { font: 'Poppins', weight: 700, size: 46, color: '#5B2BD6', bg: { enabled: true, color: '#FFFFFF', padding: 22, radius: 999 }, animIn: { type: 'slide-up', duration: 0.8 } }));
      add(p, 'tv4', text(b.disciplines.slice(0, 5).map(d => '• ' + d).join('\n'), 290, 610, 520, { font: 'Poppins', weight: 600, size: 38, color: '#FFFFFF', align: 'left', lineHeight: 1.35, animIn: { type: 'letters-rise', duration: 1.4 } }));
      add(p, 'tv4', text(b.name, 540, 1030, 900, { font: 'Montserrat', weight: 800, size: 40, color: '#FFFFFF', letterSpacing: 2 }));
      add(p, 'tv5', sticker('✨', 960, 140, 110, { loop: { type: 'pulse', speed: 1 } }));
      return p;
    },
  },
  {
    id: 'risultati', name: 'Risultati di gara', format: 'portrait', cat: 'Gare',
    build: b => {
      const p = proj('portrait', 'Risultati di gara', { type: 'gradient', colors: ['#0B0A14', '#2A1A6B'], angle: 180 });
      add(p, 'tv2', img(IMG('artistica'), 540, 430, 1080, 860, { loop: { type: 'kenburns' }, filter: 'sport' }));
      add(p, 'tv3', color(540, 700, 1080, 400, { colors: ['rgba(11,10,20,0)', '#0B0A14'], angle: 180 }));
      add(p, 'tv3', color(540, 675, 1080, 1350, { fill: 'rgba(0,0,0,0)', effect: 'confetti', name: 'Coriandoli' }));
      add(p, 'tv4', text('COMPLIMENTI!', 540, 860, 1000, { font: 'Anton', weight: 400, size: 150, uppercase: true, gradient: ['#FFE14D', '#FF7A3D', '#E11D48'], textShadow: { enabled: true, color: '#FF7A3D', blur: 30, x: 0, y: 0 }, animIn: { type: 'zoom-out', duration: 0.7 } }));
      add(p, 'tv5', sticker('🥇', 540, 1010, 170, { loop: { type: 'heartbeat', speed: 1 }, animIn: { type: 'drop', duration: 0.8 } }));
      add(p, 'tv4', text('Nome Atleta', 540, 1170, 900, { font: 'Great Vibes', weight: 400, size: 110, color: '#FFFFFF', animIn: { type: 'typewriter', duration: 1.2 } }));
      add(p, 'tv4', text('Campionato regionale · 1° posto', 540, 1275, 900, { font: 'Poppins', weight: 600, size: 38, color: '#C9C3EC' }));
      if (b.logo) add(p, 'tv5', img(b.logo, 110, 110, 140, 140, { fit: 'contain', name: 'Logo' }));
      return p;
    },
  },
  {
    id: 'saggio', name: 'Saggio di fine anno', format: 'story', cat: 'Eventi', dur: 8,
    build: b => {
      const p = proj('story', 'Saggio di fine anno', { type: 'color', color: '#0B0A14' }, 8);
      add(p, 'tv1', img(IMG('ritmica'), 540, 960, 1080, 1920, { loop: { type: 'kenburns' }, filter: 'athlos' }));
      add(p, 'tv2', color(540, 1240, 1080, 1360, { colors: ['rgba(13,11,26,0)', 'rgba(13,11,26,.96)'], angle: 180 }));
      add(p, 'tv3', color(540, 960, 1080, 1920, { fill: 'rgba(0,0,0,0)', effect: 'sparkles', name: 'Stelline' }));
      add(p, 'tv4', text('SAGGIO\nDI FINE ANNO', 540, 1180, 1000, { font: 'Bebas Neue', weight: 400, size: 190, letterSpacing: 4, lineHeight: 0.9, color: '#FFFFFF', animIn: { type: 'rise', duration: 1 } }));
      add(p, 'tv4', text('Sabato 13 giugno · ore 18:00', 540, 1430, 900, { font: 'Poppins', weight: 700, size: 46, color: '#1B1440', bg: { enabled: true, color: '#FFFFFF', padding: 24, radius: 999 }, animIn: { type: 'pop', duration: 0.7 } }));
      add(p, 'tv4', text(b.address || 'Palazzetto dello sport', 540, 1560, 900, { font: 'Poppins', weight: 600, size: 40, color: '#E9E6FF', animIn: { type: 'fade', duration: 1 } }));
      add(p, 'tv4', text(b.name, 540, 1760, 900, { font: 'Montserrat', weight: 800, size: 44, color: '#FFFFFF', letterSpacing: 4, uppercase: true }));
      add(p, 'tv5', sticker('🎀', 900, 300, 160, { loop: { type: 'sway', speed: 0.6 } }));
      return p;
    },
  },
  {
    id: 'compleanno', name: 'Buon compleanno', format: 'story', cat: 'Auguri',
    build: b => {
      const p = proj('story', 'Buon compleanno', { type: 'gradient', colors: ['#FF8AC6', '#B06AB3', '#4568DC'], angle: 160 });
      add(p, 'tv3', color(540, 960, 1080, 1920, { fill: 'rgba(0,0,0,0)', effect: 'confetti', name: 'Coriandoli' }));
      add(p, 'tv5', sticker('🎂', 540, 640, 420, { loop: { type: 'float', speed: 0.6 }, animIn: { type: 'elastic', duration: 1 } }));
      add(p, 'tv5', sticker('🎈', 190, 300, 220, { loop: { type: 'float', speed: 0.4 } }));
      add(p, 'tv5', sticker('🎉', 890, 330, 200, { loop: { type: 'wiggle', speed: 1 } }));
      add(p, 'tv4', text('Tanti auguri', 540, 1040, 1000, { font: 'Great Vibes', weight: 400, size: 200, color: '#FFFFFF', textShadow: { enabled: true, color: 'rgba(0,0,0,.25)', blur: 16, x: 0, y: 8 }, animIn: { type: 'typewriter', duration: 1.4 } }));
      add(p, 'tv4', text('NOME', 540, 1260, 900, { font: 'Luckiest Guy', weight: 400, size: 150, color: '#FFFFFF', stroke: { width: 8, color: '#E9468F' }, animIn: { type: 'pop', duration: 0.8 } }));
      add(p, 'tv4', text(`da tutta la squadra di ${b.name} 💜`, 540, 1460, 900, { font: 'Poppins', weight: 600, size: 44, color: '#FFFFFF' }));
      return p;
    },
  },
  {
    id: 'openday', name: 'Open day', format: 'post', cat: 'Eventi',
    build: b => {
      const p = proj('post', 'Open day', { type: 'color', color: '#0B0A14' });
      add(p, 'tv1', img(IMG('palestra'), 540, 540, 1080, 1080, { filter: 'cool', loop: { type: 'kenburns' } }));
      add(p, 'tv2', color(540, 540, 1080, 1080, { colors: ['rgba(14,165,233,.55)', 'rgba(99,102,241,.85)'], angle: 160 }));
      add(p, 'tv4', text('OPEN DAY', 540, 380, 1040, { font: 'Archivo Black', weight: 400, size: 150, color: '#FFFFFF', textShadow: { enabled: true, color: 'rgba(0,0,0,.35)', blur: 0, x: 10, y: 10 }, animIn: { type: 'stretch', duration: 1 } }));
      add(p, 'tv4', text('Domenica 20 settembre · 10:00–18:00', 540, 540, 900, { font: 'Poppins', weight: 700, size: 44, color: '#1B1440', bg: { enabled: true, color: '#FFE14D', padding: 22, radius: 999 }, animIn: { type: 'slide-up', duration: 0.8 } }));
      add(p, 'tv4', text('Prova gratis tutte le discipline!\nPorta un amico 🤸‍♀️', 540, 700, 900, { font: 'Poppins', weight: 600, size: 46, color: '#FFFFFF', lineHeight: 1.3 }));
      brandFooter(p, b, 980);
      return p;
    },
  },
  {
    id: 'reel', name: 'Reel highlight', format: 'reel', cat: 'Video', dur: 13,
    build: b => {
      const p = proj('reel', 'Reel highlight', { type: 'color', color: '#000000' }, 13);
      const shots = [['artistica', 'FORZA', 'zoom-in'], ['ritmica', 'GRAZIA', 'circle'], ['judo', 'DISCIPLINA', 'push-left'], ['aerea', 'CORAGGIO', 'heart']];
      shots.forEach(([im, word, tr], i) => {
        add(p, 'tv1', img(IMG(im), 540, 960, 1080, 1920, { start: i * 2.6, duration: 2.6, loop: { type: 'kenburns' }, filter: i % 2 ? 'athlos' : 'sport', transition: { type: i ? tr : 'none', duration: 0.6 }, name: word }));
        add(p, 'tv4', text(word, 540, 1500, 1000, { start: i * 2.6 + 0.3, duration: 2.1, font: 'Anton', weight: 400, size: 190, color: '#FFFFFF', letterSpacing: 6, textShadow: { enabled: true, color: 'rgba(0,0,0,.5)', blur: 20, x: 0, y: 8 }, animIn: { type: 'word-pop', duration: 0.6 }, animOut: { type: 'fade', duration: 0.3 } }));
      });
      add(p, 'tv1', color(540, 960, 1080, 1920, { start: 10.4, duration: 2.6, colors: ['#5B5BF6', '#E9468F'], angle: 160, transition: { type: 'flash', duration: 0.5 }, effect: 'sparkles' }));
      if (b.logo) add(p, 'tv2', img(b.logo, 540, 820, 360, 360, { start: 10.6, duration: 2.4, fit: 'contain', animIn: { type: 'elastic', duration: 0.9 } }));
      add(p, 'tv4', text(b.name, 540, 1120, 980, { start: 10.8, duration: 2.2, font: 'Montserrat', weight: 900, size: 92, color: '#FFFFFF', animIn: { type: 'rise', duration: 0.8 } }));
      add(p, 'tv4', text('Iscriviti anche tu!', 540, 1260, 900, { start: 11.2, duration: 1.8, font: 'Poppins', weight: 700, size: 52, color: '#1B1440', bg: { enabled: true, color: '#FFFFFF', padding: 22, radius: 999 }, animIn: { type: 'pop', duration: 0.6 } }));
      return p;
    },
  },
  {
    id: 'youtube', name: 'Copertina YouTube', format: 'youtube', cat: 'Video',
    build: b => {
      const p = proj('youtube', 'Copertina YouTube', { type: 'gradient', colors: ['#1B1440', '#4B1E6E'], angle: 120 });
      add(p, 'tv2', img(IMG('aerea'), 1420, 540, 1000, 1080, { filter: 'vivid' }));
      add(p, 'tv3', color(1000, 540, 400, 1080, { colors: ['#2A1A5E', 'rgba(42,26,94,0)'], angle: 90 }));
      add(p, 'tv4', text('I NOSTRI\nCAMPIONI', 500, 430, 900, { font: 'Anton', weight: 400, size: 200, lineHeight: 0.92, align: 'left', gradient: ['#FFFFFF', '#FFD1E8'], textShadow: { enabled: true, color: 'rgba(0,0,0,.5)', blur: 0, x: 10, y: 10 } }));
      add(p, 'tv4', text('Highlights della stagione', 430, 720, 760, { font: 'Poppins', weight: 700, size: 56, align: 'left', color: '#1B1440', bg: { enabled: true, color: '#FFE14D', padding: 24, radius: 16 } }));
      add(p, 'tv5', sticker('🏆', 860, 200, 180, { rotation: 12 }));
      if (b.logo) add(p, 'tv5', img(b.logo, 140, 940, 170, 170, { fit: 'contain' }));
      return p;
    },
  },
  {
    id: 'locandina', name: 'Locandina evento A4', format: 'a4', cat: 'Stampa',
    build: b => {
      const p = proj('a4', 'Locandina evento', { type: 'color', color: '#FFFFFF' });
      add(p, 'tv1', color(620, 330, 1240, 660, { colors: ['#5B5BF6', '#E9468F'], angle: 135 }));
      add(p, 'tv2', img(IMG('artistica'), 620, 760, 1080, 640, { radius: 40, shadow: { enabled: true, color: 'rgba(40,20,90,.45)', blur: 60, x: 0, y: 30 } }));
      add(p, 'tv4', text('GRAN GALÀ\nDELLA GINNASTICA', 620, 240, 1100, { font: 'Anton', weight: 400, size: 130, lineHeight: 0.95, color: '#FFFFFF' }));
      add(p, 'tv4', text('Sabato 12 dicembre · ore 17:30', 620, 1190, 1100, { font: 'Montserrat', weight: 800, size: 64, color: '#1B1440' }));
      add(p, 'tv4', text(b.address || 'Palazzetto dello sport', 620, 1290, 1100, { font: 'Poppins', weight: 600, size: 44, color: '#5D5980' }));
      add(p, 'tv4', text('Ingresso libero', 620, 1420, 600, { font: 'Poppins', weight: 800, size: 46, color: '#FFFFFF', bg: { enabled: true, color: '#7C4DFF', padding: 26, radius: 999 } }));
      add(p, 'tv4', text([b.name, b.phone, b.instagram].filter(Boolean).join('  ·  '), 620, 1640, 1140, { font: 'Poppins', weight: 600, size: 34, color: '#5D5980' }));
      if (b.logo) add(p, 'tv5', img(b.logo, 1110, 130, 170, 170, { fit: 'contain' }));
      return p;
    },
  },
  {
    id: 'convocazione', name: 'Convocazione gara', format: 'story', cat: 'Gare',
    build: b => {
      const p = proj('story', 'Convocazione', { type: 'gradient', colors: ['#0F2027', '#203A43', '#2C5364'], angle: 160 });
      add(p, 'tv2', img(IMG('judo'), 540, 560, 1080, 1120, { filter: 'cinema' }));
      add(p, 'tv3', color(540, 900, 1080, 500, { colors: ['rgba(32,58,67,0)', '#203A43'], angle: 180 }));
      add(p, 'tv4', text('📣 CONVOCAZIONE', 540, 1160, 1000, { font: 'Russo One', weight: 400, size: 96, color: '#FFFFFF', animIn: { type: 'slide-left', duration: 0.7 } }));
      add(p, 'tv4', text('Gara: Campionato regionale\n📅 Domenica 15 marzo\n⏰ Ritrovo ore 8:00\n📍 Palazzetto dello sport', 540, 1430, 900, { font: 'Poppins', weight: 600, size: 50, align: 'left', lineHeight: 1.45, color: '#FFFFFF', bg: { enabled: true, color: 'rgba(255,255,255,.1)', padding: 40, radius: 30 }, animIn: { type: 'letters-rise', duration: 1.4 } }));
      add(p, 'tv4', text('Forza ragazzi! 💪', 540, 1760, 900, { font: 'Permanent Marker', weight: 400, size: 70, color: '#FFE14D' }));
      return p;
    },
  },
  {
    id: 'avviso', name: 'Avviso chiusura', format: 'post', cat: 'Avvisi',
    build: b => {
      const p = proj('post', 'Avviso', { type: 'color', color: '#FFF7ED' });
      add(p, 'tv3', shape('rounded', 540, 540, 900, 760, { fill: '#FFFFFF', shadow: { enabled: true, color: 'rgba(120,53,15,.18)', blur: 60, x: 0, y: 30 } }));
      add(p, 'tv4', text('AVVISO', 540, 260, 400, { font: 'Archivo Black', weight: 400, size: 60, color: '#FFFFFF', bg: { enabled: true, color: '#E11D48', padding: 20, radius: 999 }, loop: { type: 'pulse', speed: 0.8 } }));
      add(p, 'tv5', sticker('🔒', 540, 420, 150));
      add(p, 'tv4', text('La palestra resterà chiusa', 540, 570, 780, { font: 'Montserrat', weight: 900, size: 70, color: '#1B1440' }));
      add(p, 'tv4', text('lunedì 2 novembre', 540, 690, 700, { font: 'Montserrat', weight: 700, size: 56, color: '#E11D48' }));
      add(p, 'tv4', text(`Grazie per la comprensione 💜\n${b.name}`, 540, 820, 760, { font: 'Poppins', weight: 600, size: 36, color: '#5D5980', lineHeight: 1.4 }));
      return p;
    },
  },
  {
    id: 'benvenuto', name: 'Benvenuta in squadra', format: 'post', cat: 'Squadra',
    build: b => {
      const p = proj('post', 'Benvenuta in squadra', { type: 'gradient', colors: ['#FBD3E9', '#BB377D'], angle: 160 });
      add(p, 'tv2', img(IMG('fitness'), 540, 470, 480, 480, { radius: 240, border: { width: 14, color: '#FFFFFF' }, animIn: { type: 'pop', duration: 0.8 } }));
      add(p, 'tv4', text('Benvenuta in squadra!', 540, 800, 960, { font: 'Lobster', weight: 400, size: 110, color: '#FFFFFF', textShadow: { enabled: true, color: '#7B1F5C', blur: 0, x: 6, y: 6 }, animIn: { type: 'word-pop', duration: 1 } }));
      add(p, 'tv4', text('NOME COGNOME', 540, 930, 800, { font: 'Montserrat', weight: 800, size: 50, letterSpacing: 4, color: '#7B1F5C', bg: { enabled: true, color: '#FFFFFF', padding: 20, radius: 999 } }));
      add(p, 'tv5', sticker('💜', 820, 260, 140, { loop: { type: 'heartbeat' } }));
      add(p, 'tv5', sticker('🤸‍♀️', 250, 260, 150, { loop: { type: 'float', speed: 0.5 } }));
      return p;
    },
  },
  {
    id: 'promo', name: 'Promo fitness', format: 'portrait', cat: 'Promozione',
    build: b => {
      const p = proj('portrait', 'Promo fitness', { type: 'color', color: '#ECFDF5' });
      add(p, 'tv2', img(IMG('fitness'), 540, 520, 1080, 1040, { filter: 'summer' }));
      add(p, 'tv3', shape('burst', 830, 230, 330, 330, { fill: '#E11D48', loop: { type: 'pulse' }, animIn: { type: 'spin', duration: 0.8 } }));
      add(p, 'tv4', text('-20%', 830, 230, 300, { font: 'Anton', weight: 400, size: 110, color: '#FFFFFF', animIn: { type: 'pop', duration: 0.8 } }));
      add(p, 'tv3', color(540, 1200, 1080, 300, { fill: '#10B981' }));
      add(p, 'tv4', text('SALUTE E FITNESS', 540, 1160, 1000, { font: 'Bebas Neue', weight: 400, size: 120, letterSpacing: 6, color: '#FFFFFF' }));
      add(p, 'tv4', text('Prima lezione gratuita · ' + (b.phone || 'chiamaci'), 540, 1260, 1000, { font: 'Poppins', weight: 700, size: 40, color: '#ECFDF5' }));
      return p;
    },
  },
  {
    id: 'natale', name: 'Buone feste', format: 'post', cat: 'Auguri',
    build: b => {
      const p = proj('post', 'Buone feste', { type: 'gradient', colors: ['#7F1D1D', '#14532D'], angle: 160 });
      add(p, 'tv3', color(540, 540, 1080, 1080, { fill: 'rgba(0,0,0,0)', effect: 'snow', name: 'Neve' }));
      add(p, 'tv5', sticker('🎄', 540, 380, 340, { loop: { type: 'sway', speed: 0.5 }, animIn: { type: 'drop', duration: 0.9 } }));
      add(p, 'tv4', text('Buone Feste', 540, 680, 1000, { font: 'Great Vibes', weight: 400, size: 170, color: '#FFE38A', textShadow: { enabled: true, color: 'rgba(0,0,0,.4)', blur: 14, x: 0, y: 6 }, animIn: { type: 'typewriter', duration: 1.4 } }));
      add(p, 'tv4', text(`da tutta la famiglia di ${b.name}`, 540, 850, 900, { font: 'Poppins', weight: 600, size: 44, color: '#FFFFFF' }));
      return p;
    },
  },
  {
    id: 'citazione', name: 'Frase motivazionale', format: 'portrait', cat: 'Social',
    build: b => {
      const p = proj('portrait', 'Frase motivazionale', { type: 'color', color: '#0B0A14' });
      add(p, 'tv1', img(IMG('aerea'), 540, 675, 1080, 1350, { filter: 'noir', adjust: { brightness: -25, contrast: 0, saturate: 0, hue: 0, blur: 0, temperature: 0, vignette: 40, grain: 20, sharpen: 0, exposure: 0 } }));
      add(p, 'tv4', text('“Il talento si allena ogni giorno.”', 540, 640, 900, { font: 'Playfair Display', weight: 700, italic: true, size: 96, color: '#FFFFFF', lineHeight: 1.15, animIn: { type: 'word-pop', duration: 1.6 } }));
      add(p, 'tv4', text(b.name.toUpperCase(), 540, 1000, 800, { font: 'Raleway', weight: 300, size: 36, letterSpacing: 12, color: '#FFD1E8' }));
      return p;
    },
  },
];

export function brandFrom(db) {
  const c = (db && db.company) || {};
  const name = c.tipoSoggetto === 'persona' ? `${c.nome || ''} ${c.cognome || ''}`.trim() : c.denominazione || 'La tua società';
  const sede = (c.sedi || []).find(s => s.principale) || (c.sedi || [])[0] || {};
  const now = new Date();
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    name,
    logo: c.logo ? `athlos://media/${encodeURIComponent(c.logo)}` : '',
    phone: c.cellulare || c.telefono || '',
    instagram: c.social?.instagram || '',
    address: [sede.indirizzo, sede.civico, sede.comune].filter(Boolean).join(', '),
    season: `${y}/${String(y + 1).slice(2)}`,
    disciplines: ((db && db.disciplines) || []).filter(d => d.attiva !== false).map(d => d.nome),
  };
}

export function buildTemplate(t, brand) {
  const p = t.build(brand);
  p.clips.forEach(c => { c.id = nid(); });
  return p;
}
