// Pacchetto .athlos completo: esportazione e importazione tra due postazioni.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Store } = require('../src/main/store.js');
const { exportAll, importAll } = require('../src/main/bundle.js');

function station() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'athlos-bundle-'));
  const studio = path.join(dir, 'Salto Studio');
  fs.mkdirSync(studio, { recursive: true });
  return { dir, store: new Store(dir), studioDir: () => studio, chatFile: path.join(dir, 'chat.json') };
}

test('progetti, file, chat e archivio passano da una postazione all\'altra', () => {
  const a = station();
  a.store.set('clients', [{ id: 'c1', nome: 'Aurora', cognome: 'Di Mauro' }]);
  a.store.set('closures', { '2026-11-02|s1': { uscite: [{ id: 'u1', descrizione: 'Gessetti', importo: 12.5 }], note: 'ok' } });
  a.store.flush();
  const video = path.join(a.dir, 'saggio.mp4');
  fs.writeFileSync(video, Buffer.from('finto video'));
  const proj = { name: 'Saggio', clips: [
    { type: 'video', src: 'athlos://file/' + encodeURIComponent(video) },
    { type: 'image', src: 'athlos://app/assets/images/ritmica.webp' },
    { type: 'image', src: 'athlos://media/logo.png' },
  ] };
  fs.writeFileSync(path.join(a.studioDir(), 'Saggio.salto'), JSON.stringify(proj));
  fs.writeFileSync(a.chatFile, JSON.stringify({ channels: [{ id: 'generale' }], messages: [{ id: 'm1', text: 'ciao' }] }));

  const text = exportAll({ ...a, version: '1.1.0' });
  const b = JSON.parse(text);
  assert.equal(b.athlosBundle, 2);
  const srcs = JSON.parse(b.studio.projects[0].json).clips.map(c => c.src);
  assert.match(srcs[0], /^file:[0-9a-f]{16}\.mp4$/);
  assert.equal(srcs[1], 'app:assets/images/ritmica.webp');
  assert.equal(srcs[2], 'media:logo.png');

  const c = station();
  const res = importAll(text, c);
  assert.equal(res.projects, 1);
  assert.equal(c.store.get('clients')[0].cognome, 'Di Mauro');
  assert.equal(c.store.get('closures')['2026-11-02|s1'].uscite[0].importo, 12.5);
  const imported = JSON.parse(fs.readFileSync(path.join(c.studioDir(), 'Saggio.salto'), 'utf8'));
  const p0 = decodeURIComponent(imported.clips[0].src.replace('athlos://file/', ''));
  assert.equal(fs.readFileSync(p0, 'utf8'), 'finto video');
  assert.equal(imported.clips[1].src, 'athlos://app/assets/images/ritmica.webp');
  assert.equal(JSON.parse(fs.readFileSync(c.chatFile, 'utf8')).messages[0].text, 'ciao');
});
