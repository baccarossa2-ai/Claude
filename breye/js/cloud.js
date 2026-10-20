/* Thorion cloud — your chats follow your account to every device.
   The identity is the AI Horde account you sign in to with Google: the key never leaves this browser,
   the server only sees a SHA-256 fingerprint of it, and every chat is compressed and AES-GCM encrypted
   here before upload (the database stores ciphertext it cannot read). */
(function () {
  'use strict';
  const B = window.B;
  const RPC = 'https://manolzdpkfpwtsabtkjz.supabase.co/rest/v1/rpc/';
  const PUB = 'sb_publishable_MwaXZpPw7w49E_opAHkLNw_oDAjCvC0';
  const te = new TextEncoder(), td = new TextDecoder();
  const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; };
  let keyCtx = null, status = 'off';
  const setStatus = (s) => { status = s; B.emit('cloud', s); };

  async function keys() {
    const k = B.account && B.account.signedIn ? B.hordeKey() : null;
    if (!k || !(window.crypto && crypto.subtle)) return null;
    if (keyCtx && keyCtx.key === k) return keyCtx;
    const auth = hex(await crypto.subtle.digest('SHA-256', te.encode('thorion-auth|' + k)));
    const raw = await crypto.subtle.digest('SHA-256', te.encode('thorion-enc|' + k));
    const aes = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    return (keyCtx = { key: k, auth, aes, tag: auth.slice(0, 10) });
  }
  async function rpc(fn, body) {
    const r = await fetch(RPC + fn, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('cloud ' + r.status);
    return r.json();
  }
  async function pipe(u8, Stream) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new Stream('gzip'))).arrayBuffer()); }
  async function seal(obj, k) {
    let data = te.encode(JSON.stringify(obj)), z = '0';
    if (window.CompressionStream) { data = await pipe(data, CompressionStream); z = '1'; }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k.aes, data));
    return z + '.' + b64(iv) + '.' + b64(ct);
  }
  async function open(str, k) {
    const [z, iv, ct] = String(str).split('.');
    let data = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, k.aes, unb64(ct)));
    if (z === '1') data = await pipe(data, DecompressionStream);
    return JSON.parse(td.decode(data));
  }
  // the cloud copy keeps the words and light previews of the pictures; videos and 3D scenes stay on the device
  async function shrink(src, max, q) {
    if (typeof src !== 'string' || !src.startsWith('data:image') || src.length < 160000) return src;
    try {
      const im = await B.loadImage(src), s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q);
    } catch (e) { return ''; }
  }
  async function slim(chat) {
    const c = JSON.parse(JSON.stringify(chat));
    for (const m of c.messages || []) {
      if (m.images) m.images = (await Promise.all(m.images.map((s) => shrink(s, 384, 0.7)))).filter(Boolean);
      for (const x of m.media || []) if (x.src) x.src = await shrink(x.src, x.draft ? 256 : 768, 0.78);
      if (m.gen && m.gen.src) m.gen.src = await shrink(m.gen.src, 768, 0.78);
      (m.steps || []).forEach((s) => { if (typeof s.preview === 'string' && !s.preview.startsWith('data:')) delete s.preview; });
    }
    return c;
  }

  const timers = new Map();
  async function pushNow(chat) {
    const k = await keys(); if (!k || !chat || !chat.id) return;
    try {
      setStatus('sync');
      await rpc('thorion_put', { p_auth: k.auth, p_chat: chat.id, p_updated: chat.updated || Date.now(), p_data: await seal(await slim(chat), k), p_deleted: false });
      B.ls.set('cloud:pushed:' + k.tag, Math.max(B.ls.get('cloud:pushed:' + k.tag, 0), chat.updated || 0));
      setStatus('ok');
    } catch (e) { console.warn('cloud push', e); setStatus('offline'); }
  }
  async function pull() {
    const k = await keys(); if (!k) return 0;
    const since = B.ls.get('cloud:since:' + k.tag, 0);
    const rows = await rpc('thorion_list', { p_auth: k.auth, p_since: since });
    let n = 0, top = since;
    for (const r of rows || []) {
      top = Math.max(top, +r.updated || 0);
      const local = await B.db.get('chats', r.chat_id).catch(() => null);
      if (local && (local.updated || 0) >= r.updated) continue;
      if (r.deleted) { if (local) { await B.db.del('chats', r.chat_id); n++; } continue; }
      try { const chat = await open(r.data, k); if (chat && chat.id === r.chat_id) { await B.db.put('chats', chat); n++; } } catch (e) { console.warn('cloud decrypt', e); }
    }
    B.ls.set('cloud:since:' + k.tag, top);
    return n;
  }
  let syncing = null;
  async function sync() {
    if (syncing) return syncing;
    syncing = (async () => {
      const k = await keys(); if (!k) { setStatus('off'); return; }
      try {
        setStatus('sync');
        const n = await pull();
        // anything changed here since the last upload (or never uploaded) goes up now
        const pushed = B.ls.get('cloud:pushed:' + k.tag, 0);
        const mine = (await B.db.all('chats')).filter((c) => c.messages && c.messages.length && (c.updated || 0) > pushed);
        for (const c of mine) await pushNow(c);
        setStatus('ok');
        if (n) B.emit('cloud:pulled', n);
      } catch (e) { console.warn('cloud sync', e); setStatus('offline'); }
    })().finally(() => { syncing = null; });
    return syncing;
  }

  B.cloud = {
    get status() { return status; },
    push(chat) { if (!(B.account && B.account.signedIn) || !chat || !chat.id) return; clearTimeout(timers.get(chat.id)); timers.set(chat.id, setTimeout(() => { timers.delete(chat.id); pushNow(chat); }, 1200)); },
    async remove(id) { const k = await keys(); if (!k || !id) return; try { await rpc('thorion_put', { p_auth: k.auth, p_chat: id, p_updated: Date.now(), p_data: '', p_deleted: true }); } catch (e) { console.warn('cloud remove', e); } },
    sync
  };
  B.on('account', () => { keyCtx = null; if (B.account.signedIn) sync(); else setStatus('off'); });
  addEventListener('online', () => { if (B.account && B.account.signedIn) sync(); });
  setTimeout(() => { if (B.account && B.account.signedIn) sync(); }, 1500);
})();
