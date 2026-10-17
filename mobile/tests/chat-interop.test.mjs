// La chat del telefono (src/main/chat.js con gli adattatori Android) parla con quella del PC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHIMS = path.join(here, '..', 'src', 'bridge', 'node');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'athlos-chat-'));

async function phoneChat() {
  const out = path.join(tmp, 'phone-chat.mjs');
  await build({
    stdin: { contents: "export { LanChat } from '../src/main/chat.js'; export { __setup } from './src/bridge/node/fs.js'; export { __setInterfaces } from './src/bridge/node/os.js';", resolveDir: path.join(here, '..'), loader: 'js' },
    outfile: out, bundle: true, format: 'esm', platform: 'neutral', logLevel: 'error',
    alias: { ...Object.fromEntries(['dgram', 'net', 'fs', 'os', 'path', 'crypto', 'events'].map(m => [m, path.join(SHIMS, m + '.js')])) },
    plugins: [{ name: 'lan', setup(b) { b.onResolve({ filter: /lan-plugin\.js$/ }, () => ({ path: path.join(here, 'node-lan.mjs'), external: true })); } }],
    inject: [path.join(SHIMS, 'buffer.js')],
    define: { 'process.env': '{}' },
  });
  return import(pathToFileURL(out).href);
}

const wait = (cond, ms = 8000) => new Promise((resolve, reject) => {
  const t0 = Date.now();
  const tick = () => { if (cond()) return resolve(); if (Date.now() - t0 > ms) return reject(new Error('timeout')); setTimeout(tick, 50); };
  tick();
});

test('telefono e PC si trovano e si scambiano messaggi e conferme', { timeout: 25000 }, async () => {
  process.env.ATHLOS_CHAT_PORT = '47911';
  const require = createRequire(import.meta.url);
  const { LanChat: PcChat } = require('../../src/main/chat.js');
  const phoneMod = await phoneChat();
  const { Lan } = await import('./node-lan.mjs');
  phoneMod.__setInterfaces((await Lan.netInfo()).interfaces);
  const saved = {};
  phoneMod.__setup({}, async (p, t) => { saved[p] = t; });

  const key = 'prova-' + Date.now();
  const pc = new PcChat(fs.mkdtempSync(path.join(tmp, 'pc-')));
  const phone = new phoneMod.LanChat('athlos');
  const pcEvents = [];
  const phoneEvents = [];
  pc.on('event', e => pcEvents.push(e));
  phone.on('event', e => phoneEvents.push(e));
  await pc.start({ id: 'u-pc', nome: 'Segreteria PC', colore: '#7C4DFF' }, key);
  await phone.start({ id: 'u-tel', nome: 'Giulia telefono', colore: '#EC4899' }, key);

  await wait(() => pc.peers.has('u-tel') && phone.peers.has('u-pc'));

  const a = await phone.send({ channel: 'generale', text: 'Ciao dal telefono' });
  assert.equal(a.sentTo, 1);
  await wait(() => pc.state.messages.some(m => m.text === 'Ciao dal telefono'));
  await wait(() => (phone.state.messages.find(m => m.id === a.message.id).delivered || []).includes('u-pc'));

  const b = await pc.send({ channel: 'generale', text: 'Ricevuto dal PC 👍' });
  await wait(() => phone.state.messages.some(m => m.id === b.message.id));
  phone.markRead('generale');
  await wait(() => (pc.state.messages.find(m => m.id === b.message.id).readBy || []).includes('u-tel'));
  await wait(() => Object.keys(saved).some(k => k.endsWith('chat.json')), 3000);

  pc.stop();
  phone.stop();
  await Lan.tcpServerClose();
  await Lan.udpClose();
});
