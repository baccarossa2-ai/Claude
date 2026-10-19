/* Video AI — storyboard engine, generative music, video export (WebCodecs MP4 or MediaRecorder) */
(function () {
  'use strict';
  const B = window.B;
  B.lib.mp4mux = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.min.js';

  /* ================= deterministic random ================= */
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; }
  const ease = { io: (t) => 0.5 - Math.cos(Math.PI * B.clamp(t, 0, 1)) / 2, out: (t) => 1 - Math.pow(1 - B.clamp(t, 0, 1), 3), back: (t) => { t = B.clamp(t, 0, 1); const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); } };
  B.ease = ease;

  /* ================= generative music ================= */
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const MOODS = {
    none: { label: 'Nessuna musica' },
    cinematic: { label: 'Cinematica', bpm: 72, root: 57, minor: true, prog: [0, 5, 2, 6], drums: 'soft', pad: 1, arp: 1, bass: 1, boom: 1 },
    upbeat: { label: 'Energica', bpm: 118, root: 60, minor: false, prog: [0, 4, 5, 3], drums: 'pop', pad: 0.6, arp: 1, bass: 1 },
    lofi: { label: 'Lo-fi', bpm: 82, root: 62, minor: false, prog: [1, 4, 0, 5], seventh: true, drums: 'lofi', pad: 0.7, arp: 0.6, bass: 1, crackle: 1 },
    ambient: { label: 'Ambient', bpm: 60, root: 64, minor: false, prog: [0, 3, 5, 3], pad: 1.2, arp: 0.5, shimmer: 1 },
    epic: { label: 'Epica', bpm: 90, root: 50, minor: true, prog: [0, 5, 6, 0], drums: 'epic', pad: 1.1, arp: 0.8, bass: 1.2, boom: 1 },
    corporate: { label: 'Corporate', bpm: 108, root: 60, minor: false, prog: [0, 5, 3, 4], drums: 'pop', pad: 0.8, arp: 1.1, bass: 0.9 }
  };
  const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];
  B.music = {
    MOODS,
    async render({ mood = 'cinematic', duration = 20, seed = 7, sampleRate = 44100 }) {
      const M = MOODS[mood]; if (!M || !M.bpm) return null;
      const dur = Math.max(2, duration);
      const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * dur), sampleRate);
      const R = rng(seed * 7919 + 13);
      const master = ctx.createGain(); master.gain.value = 0.8;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
      master.connect(comp); comp.connect(ctx.destination);
      const rev = ctx.createConvolver(); const irLen = sampleRate * 2.8; const ir = ctx.createBuffer(2, irLen, sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < irLen; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / irLen, 3.2); }
      rev.buffer = ir; const revG = ctx.createGain(); revG.gain.value = 0.32; rev.connect(revG); revG.connect(master);
      const noise = ctx.createBuffer(1, sampleRate, sampleRate); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }
      const scale = M.minor ? MIN : MAJ;
      const beat = 60 / M.bpm, bar = beat * 4;
      const deg = (d, oct) => M.root + scale[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + (oct || 0));
      const chordNotes = (d) => [deg(d), deg(d + 2), deg(d + 4)].concat(M.seventh ? [deg(d + 6)] : []);
      function env(g, t, a, peak, rel, len) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + Math.max(a, len - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t + len); }
      function pad(t, len, notes, vol) {
        notes.forEach((n) => [-7, 7].forEach((det) => {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n - 12); o.detune.value = det;
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1600, t + len / 2); f.frequency.linearRampToValueAtTime(700, t + len); f.Q.value = 0.6;
          const g = ctx.createGain(); env(g, t, Math.min(1.4, len / 3), 0.035 * vol, 1.2, len + 1);
          o.connect(f); f.connect(g); g.connect(master); g.connect(rev); o.start(t); o.stop(t + len + 1.1);
        }));
      }
      function pluck(t, n, vol, len = 0.9) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = NOTE(n);
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = NOTE(n + 12);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        const g2 = ctx.createGain(); g2.gain.value = 0.25;
        o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master); g.connect(rev); o.start(t); o2.start(t); o.stop(t + len + 0.05); o2.stop(t + len + 0.05);
      }
      function bass(t, n, len, vol) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n - 24);
        const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = NOTE(n - 24);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
        const g = ctx.createGain(); env(g, t, 0.02, 0.22 * vol, 0.15, len);
        o.connect(f); s.connect(g); f.connect(g); g.connect(master); o.start(t); s.start(t); o.stop(t + len + 0.1); s.stop(t + len + 0.1);
      }
      function kick(t, v = 1) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); const g = ctx.createGain(); g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.45); }
      function noiseHit(t, type, freq, len, vol) { const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len); s.connect(f); f.connect(g); g.connect(master); if (len > 0.12) g.connect(rev); s.start(t, R() * 0.5); s.stop(t + len + 0.02); }
      function snare(t, v = 1) { noiseHit(t, 'bandpass', 1900, 0.2, 0.32 * v); const o = ctx.createOscillator(); o.frequency.value = 185; const g = ctx.createGain(); g.gain.setValueAtTime(0.25 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.12); }
      function hat(t, v = 1) { noiseHit(t, 'highpass', 7500, 0.045, 0.11 * v); }
      function boom(t) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(30, t + 2.4); const g = ctx.createGain(); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6); o.connect(g); g.connect(master); g.connect(rev); o.start(t); o.stop(t + 2.7); noiseHit(t, 'lowpass', 500, 1.6, 0.25); }
      const bars = Math.ceil(dur / bar) + 1;
      for (let b = 0; b < bars; b++) {
        const t = b * bar; if (t >= dur) break;
        const d = M.prog[b % M.prog.length];
        const notes = chordNotes(d);
        const intro = b === 0, outro = t > dur - bar * 1.2;
        if (M.pad) pad(t, bar, notes, M.pad);
        if (M.bass && !intro) { for (let q = 0; q < 4; q += (M.drums === 'pop' ? 1 : 2)) bass(t + q * beat, notes[0] + (M.drums === 'pop' && q % 2 ? 12 : 0), beat * (M.drums === 'pop' ? 0.9 : 1.8), M.bass); }
        if (M.arp) { const steps = M.bpm > 100 ? 8 : 8; for (let s = 0; s < steps; s++) { if (R() < 0.18 && !intro) continue; const n = notes[(s + (b % 2)) % notes.length] + 12 + (R() < 0.2 ? 12 : 0); pluck(t + s * beat / 2, n, M.arp * (intro ? 0.6 : 1)); } }
        if (M.shimmer) for (let s = 0; s < 3; s++) pluck(t + R() * bar, notes[Math.floor(R() * notes.length)] + 24, 0.35, 2.5);
        if (M.boom && (b % 4 === 0) && b > 0 && !outro) boom(t);
        if (M.drums && !intro && !outro) {
          for (let q = 0; q < 4; q++) {
            const tq = t + q * beat;
            if (M.drums === 'pop') { kick(tq); if (q % 2) snare(tq); hat(tq + beat / 2); hat(tq, 0.6); }
            else if (M.drums === 'lofi') { if (q === 0 || q === 2.5) kick(tq, 0.7); if (q === 2) kick(tq + beat / 2, 0.6); if (q % 2) snare(tq, 0.55); hat(tq + beat / 2, 0.5); }
            else if (M.drums === 'epic') { if (q === 0 || q === 2) { kick(tq, 1); noiseHit(tq, 'lowpass', 220, 0.5, 0.5); } if (q === 3) for (let k = 0; k < 3; k++) noiseHit(tq + k * beat / 3, 'bandpass', 300, 0.3, 0.3); }
            else if (M.drums === 'soft') { if (q === 0) kick(tq, 0.55); if (q === 2) noiseHit(tq, 'bandpass', 1200, 0.25, 0.08); }
          }
        }
      }
      if (M.crackle) { const s = ctx.createBufferSource(); const cb = ctx.createBuffer(1, sampleRate * 2, sampleRate); const d = cb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() < 0.0009 ? (R() * 2 - 1) * 0.6 : (R() * 2 - 1) * 0.006; s.buffer = cb; s.loop = true; const g = ctx.createGain(); g.gain.value = 0.5; s.connect(g); g.connect(master); s.start(0); s.stop(dur); }
      master.gain.setValueAtTime(0.8, Math.max(0, dur - 2.2)); master.gain.linearRampToValueAtTime(0.0001, dur);
      return await ctx.startRendering();
    },
    toWav(buf) {
      const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
      const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
      const ws = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
      ws(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); ws(36, 'data'); out.setUint32(40, len * ch * 2, true);
      const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
      let o = 44; for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = B.clamp(chans[c][i], -1, 1); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
      return new Blob([out], { type: 'audio/wav' });
    }
  };

  /* ================= video export ================= */
  B.exportVideo = async function ({ w, h, fps = 30, duration, draw, audio, onProgress, signal, realtime }) {
    w = Math.round(w / 2) * 2; h = Math.round(h / 2) * 2;
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const frames = Math.max(1, Math.round(duration * fps));
    const canWC = !realtime && typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';
    if (canWC) {
      try {
        await B.need('mp4mux');
        const codecs = [['avc1.640028', 'avc'], ['avc1.4d0028', 'avc'], ['avc1.42001f', 'avc'], ['vp09.00.40.08', 'vp9'], ['vp09.00.10.08', 'vp9']];
        let vcodec = null, vmux = 'avc';
        for (const [c, mx] of codecs) { try { const s = await VideoEncoder.isConfigSupported({ codec: c, width: w, height: h, bitrate: 8e6, framerate: fps }); if (s.supported) { vcodec = c; vmux = mx; break; } } catch (e) { /* next */ } }
        if (!vcodec) throw new Error('Nessun codec video supportato');
        let acodec = null;
        if (audio && typeof window.AudioEncoder === 'function') {
          for (const c of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) { try { const s = await AudioEncoder.isConfigSupported({ codec: c[0], sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels, bitrate: 160000 }); if (s.supported) { acodec = c; break; } } catch (e) { /* next */ } }
        }
        const M = window.Mp4Muxer;
        const muxer = new M.Muxer({ target: new M.ArrayBufferTarget(), video: { codec: vmux, width: w, height: h, frameRate: fps }, audio: acodec ? { codec: acodec[1], numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate } : undefined, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
        let encErr = null;
        const ve = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { encErr = e; } });
        ve.configure({ codec: vcodec, width: w, height: h, bitrate: Math.min(20e6, w * h * fps * 0.12), framerate: fps, latencyMode: 'quality' });
        for (let i = 0; i < frames; i++) {
          if (signal && signal.aborted) throw Object.assign(new Error('Interrotto'), { code: 'cancelled' });
          if (encErr) throw encErr;
          const t = i / fps;
          await draw(ctx, t, true);
          const vf = new VideoFrame(canvas, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / fps) });
          ve.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close();
          while (ve.encodeQueueSize > 6) await B.sleep(4);
          if (onProgress && i % 3 === 0) onProgress(i / frames * (acodec ? 0.92 : 0.98));
        }
        await ve.flush(); ve.close();
        if (acodec) {
          const ae = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { encErr = e; } });
          ae.configure({ codec: acodec[0], sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels, bitrate: 160000 });
          const total = Math.min(audio.length, Math.ceil(duration * audio.sampleRate)), block = audio.sampleRate;
          for (let off = 0; off < total; off += block) {
            const n = Math.min(block, total - off);
            const data = new Float32Array(n * audio.numberOfChannels);
            for (let c = 0; c < audio.numberOfChannels; c++) data.set(audio.getChannelData(c).subarray(off, off + n), c * n);
            const ad = new AudioData({ format: 'f32-planar', sampleRate: audio.sampleRate, numberOfFrames: n, numberOfChannels: audio.numberOfChannels, timestamp: Math.round(off / audio.sampleRate * 1e6), data });
            ae.encode(ad); ad.close();
          }
          await ae.flush(); ae.close();
        }
        if (encErr) throw encErr;
        muxer.finalize();
        onProgress && onProgress(1);
        return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4' };
      } catch (e) {
        if (e.code === 'cancelled') throw e;
        console.warn('WebCodecs export failed, falling back to MediaRecorder', e);
      }
    }
    /* real-time fallback */
    const stream = canvas.captureStream(fps);
    let actx = null;
    if (audio) {
      actx = new AudioContext({ sampleRate: audio.sampleRate });
      const dest = actx.createMediaStreamDestination();
      const src = actx.createBufferSource(); src.buffer = audio; src.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      src.start(actx.currentTime + 0.05);
    }
    const types = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mime = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 8e6 });
    const chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    rec.start(250);
    const t0 = performance.now();
    await new Promise((resolve) => {
      async function step() {
        const t = (performance.now() - t0) / 1000;
        if (t >= duration || (signal && signal.aborted)) return resolve();
        await draw(ctx, t, false);
        onProgress && onProgress(t / duration);
        requestAnimationFrame(step);
      }
      step();
    });
    rec.stop(); await done; if (actx) actx.close();
    if (signal && signal.aborted) throw Object.assign(new Error('Interrotto'), { code: 'cancelled' });
    const type = rec.mimeType || 'video/webm';
    return { blob: new Blob(chunks, { type }), ext: /mp4/.test(type) ? 'mp4' : 'webm' };
  };

  B.exportDialog = function (title) {
    const bar = B.h('div', { class: 'exp-bar' }, B.h('i'));
    const pct = B.h('b', { text: '0%' });
    const note = B.h('p', { class: 'muted', text: 'Rendering dei fotogrammi in corso. Puoi continuare a guardare: il file sarà pronto a breve.' });
    const ctl = new AbortController();
    const m = B.modal({ title: title || 'Esportazione video', icon: 'Film', dismiss: false, body: B.h('div', { class: 'exp-box' }, B.h('div', { class: 'row', style: 'justify-content:space-between' }, B.h('span', { text: 'Avanzamento' }), pct), bar, note), actions: [{ label: 'Annulla', fn: () => { ctl.abort(); } }] });
    return { signal: ctl.signal, progress: (p) => { bar.firstChild.style.width = (p * 100).toFixed(1) + '%'; pct.textContent = Math.round(p * 100) + '%'; }, close: () => m.close() };
  };

  /* ================= scene renderer ================= */
  const TEXT_STYLES = { cinematic: 'Cinematico', bold: 'Impatto', elegant: 'Elegante', typewriter: 'Macchina da scrivere', lower: 'Sottopancia', none: 'Nessun testo' };
  const CAMERAS = { zoomIn: 'Zoom avanti', zoomOut: 'Zoom indietro', panLeft: 'Panoramica sinistra', panRight: 'Panoramica destra', orbit: 'Orbita', still: 'Fermo' };
  const PARTICLES = { none: 'Nessuna', dust: 'Pulviscolo', bokeh: 'Bokeh', sparks: 'Scintille', snow: 'Neve', rain: 'Pioggia', stars: 'Stelle' };
  const TRANS = { fade: 'Dissolvenza', iris: 'Iride', blink: 'Battito di ciglia', zoom: 'Zoom', slide: 'Scorrimento', flash: 'Lampo dorato', cut: 'Stacco netto' };
  B.motionOpts = { TEXT_STYLES, CAMERAS, PARTICLES, TRANS };
  const TD = 0.7; // transition seconds

  let grain = null;
  function grainCanvas() {
    if (grain) return grain;
    grain = document.createElement('canvas'); grain.width = grain.height = 256;
    const x = grain.getContext('2d'); const id = x.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 22; }
    x.putImageData(id, 0, 0); return grain;
  }

  function drawCover(ctx, img, w, h, scale, ox, oy, rot) {
    const iw = img.naturalWidth || img.videoWidth || img.width, ih = img.naturalHeight || img.videoHeight || img.height;
    if (!iw || !ih) return;
    const s = Math.max(w / iw, h / ih) * scale;
    ctx.save(); ctx.translate(w / 2 + ox * w, h / 2 + oy * h); if (rot) ctx.rotate(rot);
    ctx.drawImage(img, -iw * s / 2, -ih * s / 2, iw * s, ih * s); ctx.restore();
  }
  function cameraAt(cam, p) {
    const e = ease.io(p);
    switch (cam) {
      case 'zoomIn': return [1.04 + 0.16 * e, 0, 0, 0];
      case 'zoomOut': return [1.2 - 0.16 * e, 0, 0, 0];
      case 'panLeft': return [1.16, 0.06 - 0.12 * e, 0, 0];
      case 'panRight': return [1.16, -0.06 + 0.12 * e, 0, 0];
      case 'orbit': return [1.14 + 0.05 * Math.sin(e * Math.PI), 0.03 * Math.sin(e * Math.PI * 2), 0.02 * Math.cos(e * Math.PI), 0.025 * (e - 0.5)];
      default: return [1.03 + 0.015 * e, 0, 0, 0];
    }
  }
  function gradientBG(ctx, w, h, t, pal) {
    const p = pal && pal.length ? pal : ['#1a0f08', '#7a3d16', '#e3a94a', '#f3d088'];
    ctx.fillStyle = p[0]; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < p.length; i++) {
      const a = t * 0.25 + i * 2.1;
      const x = w * (0.5 + 0.35 * Math.cos(a * (0.7 + i * 0.13))), y = h * (0.5 + 0.35 * Math.sin(a * (0.9 - i * 0.1)));
      const r = Math.max(w, h) * (0.45 + 0.1 * Math.sin(t * 0.4 + i));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const [R, G, Bc] = B.hexToRgb(p[i]);
      g.addColorStop(0, 'rgba(' + R + ',' + G + ',' + Bc + ',0.55)'); g.addColorStop(1, 'rgba(' + R + ',' + G + ',' + Bc + ',0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function particles(ctx, kind, w, h, t, seed) {
    if (!kind || kind === 'none') return;
    const R = rng(seed + 99), n = { dust: 70, bokeh: 18, sparks: 55, snow: 120, rain: 160, stars: 140 }[kind] || 0;
    const S = Math.min(w, h) / 1080;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const x0 = R() * w, y0 = R() * h, sp = 0.5 + R(), ph = R() * 6.28, sz = R();
      let x, y, r, a;
      if (kind === 'dust') { x = (x0 + Math.sin(t * 0.3 * sp + ph) * 30 * S + t * 8 * S) % w; y = ((y0 - t * 14 * sp * S) % h + h) % h; r = (1 + sz * 2.4) * S; a = 0.25 + 0.35 * Math.sin(t * 2 * sp + ph) ** 2; ctx.fillStyle = 'rgba(255,226,170,' + a + ')'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
      else if (kind === 'bokeh') { x = (x0 + t * 12 * sp * S) % (w + 200) - 100; y = y0 + Math.sin(t * 0.4 + ph) * 25 * S; r = (30 + sz * 70) * S; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,200,120,' + (0.10 + sz * 0.1) + ')'); g.addColorStop(0.8, 'rgba(255,190,110,' + (0.06) + ')'); g.addColorStop(1, 'rgba(255,190,110,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
      else if (kind === 'sparks') { const life = (t * 0.35 * sp + R()) % 1; x = x0 + Math.sin(life * 6 + ph) * 40 * S; y = h - life * h * 1.1; r = (1.5 + sz * 2.5) * S * (1 - life); a = (1 - life) * (0.6 + 0.4 * Math.sin(t * 20 + ph)); ctx.fillStyle = 'rgba(255,' + (150 + sz * 80 | 0) + ',60,' + a + ')'; ctx.shadowColor = 'rgba(255,140,40,.9)'; ctx.shadowBlur = 8 * S; ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, 7); ctx.fill(); }
      else if (kind === 'snow') { x = (x0 + Math.sin(t * sp + ph) * 30 * S) % w; y = (y0 + t * 60 * sp * S) % h; r = (1.5 + sz * 3.5) * S; ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + sz * 0.4) + ')'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
      else if (kind === 'rain') { x = (x0 + t * 120 * S) % w; y = (y0 + t * 1400 * sp * S) % h; ctx.strokeStyle = 'rgba(200,210,230,' + (0.15 + sz * 0.25) + ')'; ctx.lineWidth = 1.2 * S; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6 * S, y + 28 * S * sp); ctx.stroke(); }
      else if (kind === 'stars') { a = 0.3 + 0.7 * Math.abs(Math.sin(t * sp * 1.5 + ph)); r = (0.6 + sz * 1.6) * S; ctx.fillStyle = 'rgba(255,245,225,' + a + ')'; ctx.beginPath(); ctx.arc(x0, y0 * 0.75, r, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }
  function wrapLines(ctx, text, maxW) {
    const words = String(text || '').split(/\s+/), lines = []; let cur = '';
    words.forEach((wd) => { const test = cur ? cur + ' ' + wd : wd; if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = test; });
    if (cur) lines.push(cur); return lines;
  }
  function drawText(ctx, sc0, w, h, lt, dur, story) {
    const sc = sc0.title || !sc0.subtitle ? sc0 : Object.assign({}, sc0, { title: sc0.subtitle, subtitle: '' });
    const style = sc.text || 'cinematic'; if (style === 'none' || (!sc.title && !sc.subtitle)) return;
    const S = Math.min(w, h) / 1080, portrait = h > w;
    const tin = B.clamp((lt - 0.25) / 0.9, 0, 1), tout = B.clamp((dur - lt - 0.15) / 0.5, 0, 1);
    const vis = Math.min(ease.out(tin), tout);
    if (vis <= 0) return;
    const pos = sc.textPos || (style === 'lower' ? 'bottom' : 'center');
    const color = story.textColor || '#fff7ea', accent = story.accent || '#e3a94a';
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 24 * S;
    const maxW = w * 0.84;
    const cy = pos === 'top' ? h * 0.22 : pos === 'bottom' ? h * (portrait ? 0.74 : 0.76) : h * 0.48;
    if (style === 'cinematic' || style === 'elegant') {
      const size = (portrait ? 92 : 104) * S * (style === 'elegant' ? 1.1 : 1);
      ctx.font = (style === 'elegant' ? 'italic 400 ' + size + 'px "Instrument Serif", Georgia, serif' : '800 ' + size + 'px "Bricolage Grotesque", sans-serif');
      if ('letterSpacing' in ctx) ctx.letterSpacing = (style === 'cinematic' ? (2 + 10 * (1 - tin)) * S : 0) + 'px';
      const lines = wrapLines(ctx, sc.title, maxW);
      const lh = size * 1.05, total = lines.length * lh;
      ctx.globalAlpha = vis;
      lines.forEach((ln, i) => {
        const y = cy - total / 2 + lh * (i + 0.5) + (1 - ease.out(tin)) * 30 * S;
        if (style === 'elegant') { const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2); g.addColorStop(0, '#fff3d6'); g.addColorStop(0.55, accent); g.addColorStop(1, '#b8742a'); ctx.fillStyle = g; } else ctx.fillStyle = color;
        ctx.fillText(ln, w / 2, y);
      });
      if (sc.subtitle) {
        if ('letterSpacing' in ctx) ctx.letterSpacing = 4 * S + 'px';
        ctx.font = '600 ' + 30 * S + 'px "Figtree", sans-serif'; ctx.fillStyle = 'rgba(255,240,215,.88)';
        const sl = wrapLines(ctx, sc.subtitle.toUpperCase(), maxW);
        sl.forEach((ln, i) => ctx.fillText(ln, w / 2, cy + total / 2 + 44 * S + i * 40 * S));
      }
    } else if (style === 'bold') {
      const words = String(sc.title || '').split(/\s+/).filter(Boolean);
      const size = (portrait ? 128 : 136) * S;
      ctx.font = '800 ' + size + 'px "Bricolage Grotesque", sans-serif';
      const lines = []; let cur = []; words.forEach((wd) => { const test = cur.concat(wd).join(' '); if (ctx.measureText(test.toUpperCase()).width > maxW && cur.length) { lines.push(cur); cur = [wd]; } else cur.push(wd); }); if (cur.length) lines.push(cur);
      const lh = size * 0.98; let k = 0;
      ctx.globalAlpha = tout;
      lines.forEach((ln, li) => {
        const y = cy - lines.length * lh / 2 + lh * (li + 0.5);
        const lineW = ctx.measureText(ln.join(' ').toUpperCase()).width; let x = w / 2 - lineW / 2;
        ln.forEach((wd) => {
          const wt = B.clamp((lt - 0.2 - k * 0.12) / 0.35, 0, 1), sc2 = ease.back(wt);
          const ww = ctx.measureText(wd.toUpperCase()).width;
          ctx.save(); ctx.translate(x + ww / 2, y); ctx.scale(sc2, sc2); ctx.globalAlpha = tout * B.clamp(wt * 2, 0, 1);
          ctx.fillStyle = k % 3 === 1 ? accent : color; ctx.fillText(wd.toUpperCase(), 0, 0); ctx.restore();
          x += ww + ctx.measureText(' ').width; k++;
        });
      });
      if (sc.subtitle) { ctx.globalAlpha = vis; ctx.font = '600 ' + 34 * S + 'px "Figtree", sans-serif'; ctx.fillStyle = color; ctx.fillText(sc.subtitle, w / 2, cy + lines.length * lh / 2 + 50 * S); }
    } else if (style === 'typewriter') {
      const size = (portrait ? 64 : 70) * S;
      ctx.font = '600 ' + size + 'px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
      const full = String(sc.title || '');
      const n = Math.floor(B.clamp((lt - 0.2) * 18, 0, full.length));
      const lines = wrapLines(ctx, full, maxW);
      let shown = n; const lh = size * 1.3;
      ctx.globalAlpha = tout; ctx.fillStyle = color;
      const startY = cy - lines.length * lh / 2 + lh / 2;
      let lastX = w / 2 - Math.min(maxW, ctx.measureText(full).width) / 2, lastY = startY;
      lines.forEach((ln, i) => { if (shown <= 0) return; const part = ln.slice(0, shown); shown -= ln.length + 1; const lw = ctx.measureText(ln).width; const x = w / 2 - lw / 2; ctx.fillText(part, x, startY + i * lh); lastX = x + ctx.measureText(part).width; lastY = startY + i * lh; });
      if (Math.floor(lt * 2) % 2 === 0) { ctx.fillStyle = accent; ctx.fillRect(lastX + 6 * S, lastY - size * 0.45, size * 0.5, size * 0.9); }
      if (sc.subtitle && n >= full.length) { ctx.textAlign = 'center'; ctx.font = '500 ' + 30 * S + 'px "Figtree", sans-serif'; ctx.fillStyle = 'rgba(255,240,215,.85)'; ctx.fillText(sc.subtitle, w / 2, startY + lines.length * lh + 20 * S); }
    } else if (style === 'lower') {
      const p = ease.out(tin), size = 54 * S;
      ctx.textAlign = 'left'; ctx.shadowBlur = 0;
      const x = w * 0.07, y = h * (portrait ? 0.78 : 0.8);
      ctx.font = '800 ' + size + 'px "Bricolage Grotesque", sans-serif';
      const tw = Math.min(maxW, ctx.measureText(sc.title || '').width + 60 * S);
      ctx.globalAlpha = tout;
      ctx.fillStyle = 'rgba(12,7,4,.78)'; ctx.fillRect(x, y - size * 0.8, tw * p, size * 1.6);
      ctx.fillStyle = accent; ctx.fillRect(x, y - size * 0.8, 8 * S, size * 1.6 + (sc.subtitle ? 50 * S : 0));
      ctx.save(); ctx.beginPath(); ctx.rect(x, y - size, tw * p, size * 3); ctx.clip();
      ctx.fillStyle = color; ctx.fillText(sc.title || '', x + 30 * S, y);
      if (sc.subtitle) { ctx.font = '600 ' + 28 * S + 'px "Figtree", sans-serif'; ctx.fillStyle = 'rgba(12,7,4,.78)'; const sw = ctx.measureText(sc.subtitle).width + 60 * S; ctx.fillRect(x, y + size * 0.8, sw * p, 50 * S); ctx.fillStyle = '#f3d088'; ctx.fillText(sc.subtitle, x + 30 * S, y + size * 0.8 + 26 * S); }
      ctx.restore();
    }
    ctx.restore();
  }

  /* renders one scene (local time lt) into ctx */
  function renderScene(ctx, story, sc, idx, lt, w, h, fast) {
    const dur = sc.dur || 4, p = B.clamp(lt / dur, 0, 1);
    ctx.save();
    ctx.fillStyle = '#0a0604'; ctx.fillRect(0, 0, w, h);
    const bg = sc.bg || { type: 'gradient' };
    const cam = cameraAt(sc.camera || 'zoomIn', p);
    if (bg.type === 'image' && sc._img) {
      drawCover(ctx, sc._img, w, h, cam[0], cam[1], cam[2], cam[3]);
    } else if ((bg.type === 'shader' && bg.code) || bg.type === 'preset') {
      const code = bg.type === 'preset' ? (B.shader.presets[bg.preset] || B.shader.presets.silk).code : bg.code;
      if (!sc._sc || sc._sc.width !== Math.round(w * (fast ? 0.5 : 1))) { sc._sc = document.createElement('canvas'); sc._sc.width = Math.round(w * (fast ? 0.5 : 1)); sc._sc.height = Math.round(h * (fast ? 0.5 : 1)); }
      try { B.shader.pool.draw(code, sc._sc, lt + idx * 7.3); drawCover(ctx, sc._sc, w, h, 1 + (cam[0] - 1) * 0.5, cam[1] * 0.5, cam[2] * 0.5, 0); }
      catch (e) { gradientBG(ctx, w, h, lt + idx * 3, story.palette); }
    } else gradientBG(ctx, w, h, lt + idx * 3, bg.colors || story.palette);
    // grade + overlays
    if (story.grade !== false) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(201,138,46,0.28)'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over'; }
    particles(ctx, sc.particles, w, h, lt + idx * 11, idx * 31 + 7);
    if (story.lightLeak) {
      ctx.globalCompositeOperation = 'screen';
      const lx = w * (0.2 + 0.6 * ease.io((lt * 0.15 + idx * 0.3) % 1)), g = ctx.createRadialGradient(lx, h * 0.2, 0, lx, h * 0.2, Math.max(w, h) * 0.6);
      g.addColorStop(0, 'rgba(255,170,80,0.22)'); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,' + (story.vignette ?? 0.55) + ')'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    if (story.grain !== false) { const gc = grainCanvas(); const pat = ctx.createPattern(gc, 'repeat'); ctx.save(); ctx.translate((lt * 997) % 256, (lt * 613) % 256); ctx.fillStyle = pat; ctx.fillRect(-256, -256, w + 512, h + 512); ctx.restore(); }
    drawText(ctx, sc, w, h, lt, dur, story);
    ctx.restore();
  }

  function sceneAt(story, t) {
    let acc = 0;
    for (let i = 0; i < story.scenes.length; i++) { const d = story.scenes[i].dur || 4; if (t < acc + d || i === story.scenes.length - 1) return { i, lt: t - acc, start: acc }; acc += d; }
    return { i: 0, lt: 0, start: 0 };
  }
  const buffers = new WeakMap();
  function buf(story, k, w, h) { let m = buffers.get(story); if (!m) buffers.set(story, (m = {})); if (!m[k] || m[k].width !== w || m[k].height !== h) { m[k] = document.createElement('canvas'); m[k].width = w; m[k].height = h; } return m[k]; }

  B.renderStory = function (ctx, story, t, fast) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const { i, lt } = sceneAt(story, t);
    const sc = story.scenes[i];
    const next = story.scenes[i + 1];
    const d = sc.dur || 4;
    const tr = next ? (next.transition || sc.transition || 'fade') : null;
    const into = next && lt > d - TD && tr !== 'cut' ? (lt - (d - TD)) / TD : 0;
    if (!into) { renderScene(ctx, story, sc, i, lt, w, h, fast); }
    else {
      const A = buf(story, 'a', w, h), Bc = buf(story, 'b', w, h);
      renderScene(A.getContext('2d'), story, sc, i, lt, w, h, fast);
      renderScene(Bc.getContext('2d'), story, next, i + 1, Math.max(0, lt - d), w, h, fast);
      transition(ctx, A, Bc, tr, ease.io(into), w, h, story);
    }
    // global fade in/out
    const total = story.scenes.reduce((s, x) => s + (x.dur || 4), 0);
    const fin = B.clamp(t / 0.6, 0, 1), fout = B.clamp((total - t) / 0.8, 0, 1), f = Math.min(fin, fout);
    if (f < 1) { ctx.fillStyle = 'rgba(0,0,0,' + (1 - f) + ')'; ctx.fillRect(0, 0, w, h); }
    if (story.letterbox) { const bh = Math.max(0, (h - w / 2.39) / 2); if (bh > 0 && w > h) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, bh); ctx.fillRect(0, h - bh, w, bh); } }
    if (story.watermark) { ctx.save(); ctx.globalAlpha = 0.75; ctx.font = '700 ' + Math.round(Math.min(w, h) * 0.026) + 'px "Bricolage Grotesque", sans-serif'; ctx.fillStyle = '#f3d088'; ctx.textAlign = 'right'; ctx.fillText('Thorion', w - Math.min(w, h) * 0.04, h - Math.min(w, h) * 0.04); ctx.restore(); }
  };
  function transition(ctx, A, Bc, kind, p, w, h) {
    switch (kind) {
      case 'iris': {
        ctx.drawImage(A, 0, 0);
        const R = Math.hypot(w, h) / 2 * p;
        ctx.save(); ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.max(0.1, R), 0, 7); ctx.clip(); ctx.drawImage(Bc, 0, 0); ctx.restore();
        if (p > 0 && p < 1) { ctx.save(); ctx.strokeStyle = 'rgba(227,169,74,' + (1 - p) + ')'; ctx.lineWidth = Math.min(w, h) * 0.02 * (1 - p) + 1; ctx.shadowColor = '#e3a94a'; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.max(0.1, R), 0, 7); ctx.stroke(); ctx.restore(); }
        break;
      }
      case 'blink': {
        const c = p < 0.5 ? p * 2 : (1 - p) * 2; // 0→1→0 closed
        ctx.drawImage(p < 0.5 ? A : Bc, 0, 0);
        const lid = h / 2 * ease.io(c);
        ctx.fillStyle = '#050302';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, lid * 0.9); ctx.quadraticCurveTo(w / 2, lid * 1.25, 0, lid * 0.9); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, h); ctx.lineTo(w, h - lid * 0.9); ctx.quadraticCurveTo(w / 2, h - lid * 1.25, 0, h - lid * 0.9); ctx.closePath(); ctx.fill();
        break;
      }
      case 'zoom': {
        ctx.save(); ctx.globalAlpha = 1 - p; ctx.translate(w / 2, h / 2); ctx.scale(1 + p * 0.35, 1 + p * 0.35); ctx.drawImage(A, -w / 2, -h / 2); ctx.restore();
        ctx.save(); ctx.globalAlpha = p; ctx.translate(w / 2, h / 2); ctx.scale(1.25 - p * 0.25, 1.25 - p * 0.25); ctx.drawImage(Bc, -w / 2, -h / 2); ctx.restore();
        break;
      }
      case 'slide': { ctx.drawImage(A, -w * p, 0); ctx.drawImage(Bc, w * (1 - p), 0); break; }
      case 'flash': { ctx.drawImage(p < 0.5 ? A : Bc, 0, 0); const a = 1 - Math.abs(p - 0.5) * 2; ctx.fillStyle = 'rgba(255,226,170,' + a * 0.95 + ')'; ctx.fillRect(0, 0, w, h); break; }
      default: { ctx.drawImage(A, 0, 0); ctx.globalAlpha = p; ctx.drawImage(Bc, 0, 0); ctx.globalAlpha = 1; }
    }
  }
  B.storyDuration = (story) => story.scenes.reduce((s, x) => s + (x.dur || 4), 0);
  B.prepareStory = async function (story) {
    for (const sc of story.scenes) {
      if (sc.bg && sc.bg.type === 'image' && !sc._img && (sc.bg.blob || sc.bg.src)) {
        try { sc._img = await B.loadImage(sc.bg.blob || sc.bg.src); } catch (e) { sc.bg = { type: 'gradient' }; }
      }
    }
    try { await Promise.all(['800 40px "Bricolage Grotesque"', 'italic 400 40px "Instrument Serif"', '600 30px "Figtree"', '600 30px "JetBrains Mono"'].map((f) => document.fonts.load(f))); } catch (e) { /* ignore */ }
    return story;
  };

  /* ================= Video AI view ================= */
  const FORMATS = [['9:16', 1080, 1920, 'Reel / TikTok'], ['16:9', 1920, 1080, 'YouTube'], ['1:1', 1080, 1080, 'Quadrato'], ['4:5', 1080, 1350, 'Feed']];
  const VSTYLES = [['photo', 'Cinematico realistico', 'Camera', 'Foto realistiche dalla rete GPU comunitaria, animate con camera e pellicola'], ['shader', 'Procedurale 3D', 'Aperture', 'Mondi generati sulla GPU, illimitati'], ['graphic', 'Grafica animata', 'Shapes', 'Gradienti, tipografia cinetica, istantaneo']];

  B.view('motion', {
    title: 'Video AI', icon: 'Film', group: 'ai', desc: 'Video da testo o da foto', badge: 'AI',
    mount(el) {
      const st = { mode: 'text', fmt: '9:16', style: 'photo', mood: 'cinematic', dur: 15, story: null, playing: false, t: 0, audio: null, audioDirty: true, busy: false, img: null };
      el.classList.add('motion-view');
      const left = B.h('aside', { class: 'gen-panel scroll' });
      const right = B.h('div', { class: 'mo-right' });
      el.append(B.h('div', { class: 'gen-layout' }, left, right));

      /* ---- left controls ---- */
      const modeSeg = B.h('div', { class: 'seg' });
      [['text', 'Da testo', 'Type'], ['photo', 'Da foto', 'Image'], ['real', 'Ultra realistico', 'Sparkles']].forEach(([k, l, ic]) => modeSeg.append(B.h('button', { type: 'button', 'data-m': k, class: k === st.mode ? 'on' : '', onclick: () => setMode(k) }, B.h('span', { 'data-i': ic }), l)));
      const ta = B.h('textarea', { class: 'textarea', id: 'moPrompt', rows: 4, placeholder: 'Racconta il video: es. “spot di 15 secondi per una torrefazione artigianale: chicchi che tostano, mani dell’artigiano, tazza fumante all’alba, logo finale”' });
      const photoBox = B.h('div', { class: 'dropzone', hidden: true }, B.h('span', { 'data-i': 'ImagePlus' }), B.h('b', { text: 'Trascina una foto o clicca' }), B.h('small', { text: 'JPG, PNG, WebP' }));
      const photoPrev = B.h('img', { class: 'mo-photo', hidden: true, alt: 'Foto da animare' });
      photoBox.addEventListener('click', async () => { const [f] = await B.pickFiles('image/*'); if (f) setPhoto(f); });
      B.dropzone(photoBox, (fs) => setPhoto(fs[0]), 'image/*');
      const fmtWrap = B.h('div', { class: 'ratio-row' });
      FORMATS.forEach(([k, w, h, l]) => { const sc = 22 / Math.max(w, h); fmtWrap.append(B.h('button', { class: 'ratio' + (k === st.fmt ? ' on' : ''), type: 'button', 'data-f': k, 'data-tip': l, onclick: () => { st.fmt = k; B.$$('[data-f]', fmtWrap).forEach((c) => c.classList.toggle('on', c.dataset.f === k)); if (st.story) { st.story.w = w; st.story.h = h; resizePreview(); } } }, B.h('i', { style: { width: w * sc + 'px', height: h * sc + 'px' } }), k)); });
      const durSel = B.h('select', { class: 'select sm', id: 'moDur' }, [6, 10, 15, 20, 30, 45, 60].map((d) => B.h('option', { value: d, selected: d === st.dur }, d + ' secondi')));
      durSel.addEventListener('change', () => { st.dur = +durSel.value; });
      const styleWrap = B.h('div', { class: 'eng-list' });
      VSTYLES.forEach(([k, l, ic, s]) => styleWrap.append(B.h('button', { class: 'eng' + (k === st.style ? ' on' : ''), type: 'button', 'data-v': k, onclick: () => { st.style = k; B.$$('[data-v]', styleWrap).forEach((c) => c.classList.toggle('on', c.dataset.v === k)); } }, B.h('span', { class: 'eng-ic', 'data-i': ic }), B.h('span', null, B.h('b', { text: l }), B.h('small', { text: s })))));
      const moodSel = B.h('select', { class: 'select sm', id: 'moMood' }, Object.entries(MOODS).map(([k, m]) => B.h('option', { value: k, selected: k === st.mood }, m.label)));
      moodSel.addEventListener('change', () => { st.mood = moodSel.value; st.audioDirty = true; if (st.story) st.story.music = st.mood; });
      const goBtn = B.h('button', { class: 'btn gold lg block', type: 'button', onclick: generate }, B.h('span', { 'data-i': 'Sparkles' }), 'Genera video');
      const realNote = B.h('div', { class: 'mini-note', hidden: true, html: 'Ultra realistico: Thorion scrive lo storyboard, ogni scena viene scattata dalla <b>rete GPU comunitaria</b> (gratuita e illimitata), rifinita a tasselli e sviluppata con la finitura pellicola “Cinema”; poi la anima con camera, luce e musica nel browser. Di solito 4–8 minuti.' });
      const styleField = B.h('div', { class: 'field' }, B.h('span', { class: 'lbl', text: 'Stile visivo' }), styleWrap);
      left.append(
        B.h('div', { class: 'gen-head' }, B.h('span', { class: 'eyebrow', text: 'Thorion Motion' }), B.h('h1', { text: 'Video AI' })),
        modeSeg,
        B.h('div', { class: 'field' }, B.h('label', { for: 'moPrompt', text: 'Descrizione' }), ta),
        photoBox, photoPrev, realNote,
        B.h('div', { class: 'field' }, B.h('span', { class: 'lbl', text: 'Formato' }), fmtWrap),
        B.h('div', { class: 'grid2' }, B.h('div', { class: 'field' }, B.h('label', { for: 'moDur', text: 'Durata' }), durSel), B.h('div', { class: 'field' }, B.h('label', { for: 'moMood', text: 'Musica AI' }), moodSel)),
        styleField, goBtn);
      function setMode(k) {
        st.mode = k; B.$$('[data-m]', modeSeg).forEach((c) => c.classList.toggle('on', c.dataset.m === k));
        photoBox.hidden = k !== 'photo' || !!st.img; photoPrev.hidden = k !== 'photo' || !st.img; realNote.hidden = k !== 'real';
        styleField.hidden = k !== 'text';
        if (k === 'real' && !B.ai.engines.horde) B.toast('Le scene ultra realistiche usano la rete GPU comunitaria della versione web di Thorion: qui userò scene 3D.');
        ta.placeholder = k === 'photo' ? 'Testo da mostrare sul video (facoltativo) e tipo di movimento, es. “zoom lento, pulviscolo dorato, titolo: Nuova collezione”' : k === 'real' ? 'Descrivi la scena realistica: soggetto, azione, ambiente, luce' : ta.placeholder;
      }
      async function setPhoto(f) { st.img = f; photoPrev.src = URL.createObjectURL(f); photoPrev.hidden = false; photoBox.hidden = true; }
      photoPrev.addEventListener('click', async () => { const [f] = await B.pickFiles('image/*'); if (f) setPhoto(f); });

      /* ---- right: player + scenes ---- */
      const cv = B.h('canvas', { class: 'mo-canvas' });
      const stage = B.h('div', { class: 'mo-stage' }, cv);
      const empty = B.h('div', { class: 'mo-empty' }, B.h('div', { class: 'mo-empty-eye' }), B.h('h2', { html: 'Il tuo prossimo video <span class="serif">inizia qui</span>.' }), B.h('p', { class: 'muted', text: 'Scrivi un’idea a sinistra: Thorion crea lo storyboard, le immagini, il movimento, i testi e la musica. Poi puoi modificare ogni scena ed esportare in MP4.' }));
      stage.append(empty);
      const playBtn = B.h('button', { class: 'btn icon gold', type: 'button', 'aria-label': 'Play', 'data-i': 'Play', onclick: togglePlay });
      const scrub = B.h('input', { class: 'range', type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Posizione' });
      const tLbl = B.h('span', { class: 'mono muted', text: '0:00.0' });
      const exportBtn = B.h('button', { class: 'btn gold', type: 'button', onclick: exportVideo }, B.h('span', { 'data-i': 'Download' }), 'Esporta MP4');
      const toEditor = B.h('button', { class: 'btn', type: 'button', onclick: sendToEditor }, B.h('span', { 'data-i': 'Clapperboard' }), 'Apri nel Video Editor');
      const fxBtn = B.h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Effetti globali', 'data-tip': 'Effetti globali', 'data-i': 'SlidersHorizontal', onclick: (e) => globalFx(e.currentTarget) });
      const controls = B.h('div', { class: 'mo-ctrl' }, playBtn, scrub, tLbl, fxBtn, toEditor, exportBtn);
      const scenesWrap = B.h('div', { class: 'mo-scenes' });
      const status = B.h('div', { class: 'mo-status', hidden: true });
      right.append(stage, controls, status, scenesWrap);
      controls.hidden = true;
      B.eye(B.$('.mo-empty-eye', empty), { range: 0.12 });
      scrub.addEventListener('input', () => { st.t = scrub.value / 1000 * B.storyDuration(st.story); if (st.playing) togglePlay(); draw(); });

      let raf = 0, last = 0, actx = null, asrc = null;
      function resizePreview() {
        if (!st.story) return;
        const maxW = 720, sc = Math.min(1, maxW / Math.max(st.story.w, st.story.h));
        cv.width = Math.round(st.story.w * sc); cv.height = Math.round(st.story.h * sc);
        stage.style.setProperty('--ar', st.story.w + '/' + st.story.h);
        draw();
      }
      function draw() { if (!st.story) return; B.renderStory(cv.getContext('2d'), st.story, st.t, true); const D = B.storyDuration(st.story); scrub.value = st.t / D * 1000; B.rangeFill(scrub); tLbl.textContent = B.fmtTime(st.t) + ' / ' + B.fmtTime(D); markScene(); }
      function loop(now) {
        if (!st.playing) return;
        const dt = (now - last) / 1000; last = now;
        st.t += dt; const D = B.storyDuration(st.story);
        if (st.t >= D) { st.t = 0; stopAudio(); startAudio(); }
        draw(); raf = requestAnimationFrame(loop);
      }
      async function togglePlay() {
        if (!st.story) return;
        st.playing = !st.playing;
        playBtn.dataset.i = st.playing ? 'Pause' : 'Play'; B.hydrateIcons(controls);
        if (st.playing) { last = performance.now(); await startAudio(); raf = requestAnimationFrame(loop); }
        else { cancelAnimationFrame(raf); stopAudio(); }
      }
      async function ensureAudio() {
        if (!st.audioDirty && st.audio) return st.audio;
        st.audio = st.story && st.story.music && st.story.music !== 'none' ? await B.music.render({ mood: st.story.music, duration: B.storyDuration(st.story), seed: st.story.seed || 7 }) : null;
        st.audioDirty = false; return st.audio;
      }
      async function startAudio() {
        const a = await ensureAudio(); if (!a || !st.playing) return;
        actx = actx || new AudioContext();
        if (actx.state === 'suspended') try { await actx.resume(); } catch (e) { /* ignore */ }
        asrc = actx.createBufferSource(); asrc.buffer = a; asrc.connect(actx.destination); asrc.start(0, Math.min(st.t, a.duration - 0.01));
      }
      function stopAudio() { try { asrc && asrc.stop(); } catch (e) { /* ignore */ } asrc = null; }

      function markScene() { if (!st.story) return; let acc = 0, idx = 0; st.story.scenes.forEach((s, i) => { if (st.t >= acc) idx = i; acc += s.dur || 4; }); B.$$('.mo-scene', scenesWrap).forEach((c, i) => c.classList.toggle('on', i === idx)); }

      function setStory(story) {
        st.story = story; st.t = 0; st.audioDirty = true; empty.hidden = true; controls.hidden = false;
        resizePreview(); renderScenes();
        if (!st.playing) togglePlay();
      }
      function renderScenes() {
        scenesWrap.innerHTML = '';
        if (!st.story) return;
        scenesWrap.append(B.h('div', { class: 'section-title' }, B.h('h2', { text: st.story.title || 'Storyboard' }), B.h('span', { class: 'muted', text: st.story.scenes.length + ' scene · ' + B.fmtTime(B.storyDuration(st.story)) })));
        const list = B.h('div', { class: 'mo-scene-list' });
        st.story.scenes.forEach((sc, i) => list.append(sceneCard(sc, i)));
        list.append(B.h('button', { class: 'mo-add', type: 'button', onclick: () => { const last = st.story.scenes[st.story.scenes.length - 1]; st.story.scenes.push({ dur: 4, title: 'Nuova scena', subtitle: '', text: 'cinematic', camera: 'zoomIn', particles: 'dust', transition: 'iris', bg: last && last.bg ? Object.assign({}, last.bg) : { type: 'gradient' }, _img: last && last._img }); st.audioDirty = true; renderScenes(); draw(); } }, B.h('span', { 'data-i': 'Plus' }), 'Aggiungi scena'));
        scenesWrap.append(list); B.hydrateIcons(scenesWrap);
      }
      function sceneCard(sc, i) {
        const th = B.h('canvas', { width: 240, height: Math.round(240 * st.story.h / st.story.w), class: 'mo-th' });
        const card = B.h('div', { class: 'mo-scene' });
        const sel = (opts, key) => { const s = B.h('select', { class: 'select sm', 'aria-label': key }, Object.entries(opts).map(([k, l]) => B.h('option', { value: k, selected: sc[key] === k }, l))); s.addEventListener('change', () => { sc[key] = s.value; draw(); paintThumb(); }); return s; };
        const title = B.h('input', { class: 'input sm', value: sc.title || '', placeholder: 'Titolo a schermo', 'aria-label': 'Titolo' });
        const sub = B.h('input', { class: 'input sm', value: sc.subtitle || '', placeholder: 'Sottotitolo', 'aria-label': 'Sottotitolo' });
        title.addEventListener('input', () => { sc.title = title.value; draw(); });
        sub.addEventListener('input', () => { sc.subtitle = sub.value; draw(); });
        const dur = B.h('input', { class: 'input sm', type: 'number', min: 1, max: 30, step: 0.5, value: sc.dur || 4, 'aria-label': 'Durata', style: 'width:70px' });
        dur.addEventListener('change', () => { sc.dur = B.clamp(+dur.value || 4, 1, 30); st.audioDirty = true; draw(); renderScenes(); });
        const bgBtn = B.h('button', { class: 'btn sm', type: 'button', onclick: (e) => bgMenu(sc, e.currentTarget) }, B.h('span', { 'data-i': 'Image' }), 'Sfondo');
        const del = B.h('button', { class: 'btn icon sm ghost', type: 'button', 'aria-label': 'Elimina scena', 'data-i': 'Trash2', onclick: () => { if (st.story.scenes.length < 2) return; st.story.scenes.splice(i, 1); st.audioDirty = true; renderScenes(); draw(); } });
        card.append(B.h('div', { class: 'mo-th-wrap', onclick: () => { st.t = st.story.scenes.slice(0, i).reduce((s, x) => s + (x.dur || 4), 0) + 0.8; draw(); } }, th, B.h('span', { class: 'mo-num', text: i + 1 })),
          B.h('div', { class: 'mo-f' }, title, sub,
            B.h('div', { class: 'grid2' }, sel(TEXT_STYLES, 'text'), sel(CAMERAS, 'camera'), sel(PARTICLES, 'particles'), sel(TRANS, 'transition')),
            B.h('div', { class: 'row' }, B.h('span', { class: 'lbl', text: 'Secondi' }), dur, B.h('div', { class: 'bar-sp' }), bgBtn, del)));
        function paintThumb() { const x = th.getContext('2d'); renderScene(x, st.story, sc, i, Math.min(1.6, (sc.dur || 4) * 0.4), th.width, th.height, true); }
        requestAnimationFrame(paintThumb);
        sc._paint = paintThumb;
        return card;
      }
      function bgMenu(sc, at) {
        const items = [
          { label: 'Carica una foto…', icon: 'Upload', fn: async () => { const [f] = await B.pickFiles('image/*'); if (!f) return; sc.bg = { type: 'image', blob: f }; sc._img = await B.loadImage(f); draw(); sc._paint && sc._paint(); } },
          { label: 'Genera foto con Thorion', icon: 'Camera', fn: () => regenScene(sc, 'photo') },
          { label: 'Genera scena 3D con Thorion', icon: 'Aperture', fn: () => regenScene(sc, 'shader') },
          '-', { header: 'Scene pronte' }
        ];
        Object.entries(B.shader.presets).forEach(([k, p]) => items.push({ label: p.label, icon: 'Sparkle', fn: () => { sc.bg = { type: 'preset', preset: k }; sc._img = null; draw(); sc._paint && sc._paint(); } }));
        items.push({ label: 'Gradiente animato', icon: 'Blend', fn: () => { sc.bg = { type: 'gradient' }; sc._img = null; draw(); sc._paint && sc._paint(); } });
        B.menu(at, items);
      }
      async function regenScene(sc, kind) {
        const prompt = sc.visual || sc.title || st.story.title || ta.value;
        B.toast('Thorion sta creando lo sfondo della scena…');
        try {
          if (kind === 'photo') { const r = await B.ai.image(prompt, { engine: B.ai.photoEngine(true) || 'vector', w: st.story.w, h: st.story.h, style: 'cinema', look: 'cinema' }); sc.bg = { type: 'image', blob: r.blob }; sc._img = await B.loadImage(r.blob); }
          else { sc.bg = { type: 'shader', code: await B.ai.shader(prompt) }; sc._img = null; }
          draw(); sc._paint && sc._paint(); B.toast('Scena aggiornata', 'ok');
        } catch (e) { B.err(e); }
      }
      function globalFx(at) {
        const s = st.story; if (!s) return;
        B.menu(at, [
          { label: (s.letterbox ? '✓ ' : '') + 'Bande cinema 2.39:1', icon: 'Ratio', fn: () => { s.letterbox = !s.letterbox; draw(); } },
          { label: (s.grain !== false ? '✓ ' : '') + 'Grana pellicola', icon: 'Sparkle', fn: () => { s.grain = s.grain === false; draw(); } },
          { label: (s.lightLeak ? '✓ ' : '') + 'Light leak caldo', icon: 'Sun', fn: () => { s.lightLeak = !s.lightLeak; draw(); } },
          { label: (s.grade !== false ? '✓ ' : '') + 'Color grading ambra', icon: 'Palette', fn: () => { s.grade = s.grade === false; draw(); } },
          { label: (s.watermark ? '✓ ' : '') + 'Firma Thorion', icon: 'Eye', fn: () => { s.watermark = !s.watermark; draw(); } },
          '-', { label: 'Salva come progetto', icon: 'Save', fn: saveProject }
        ]);
      }

      function setStatus(html) { status.hidden = !html; status.innerHTML = html || ''; B.hydrateIcons(status); }

      async function generate() {
        if (st.busy) return;
        const prompt = ta.value.trim();
        const [, W, H] = FORMATS.find((f) => f[0] === st.fmt);
        if (st.playing) togglePlay();
        if (st.mode === 'photo') {
          if (!st.img) return B.toast('Scegli prima una foto da animare');
          const words = prompt.match(/titolo:\s*(.+)$/i);
          const story = { w: W, h: H, music: st.mood, seed: Date.now() % 1000, palette: ['#120a06', '#7a3d16', '#e3a94a', '#f3d088'], lightLeak: true, title: 'Foto animata',
            scenes: [{ dur: Math.min(st.dur, 12), title: words ? words[1] : '', subtitle: '', text: 'elegant', camera: /indietro|out/i.test(prompt) ? 'zoomOut' : /panoram|pan/i.test(prompt) ? 'panRight' : /orbit/i.test(prompt) ? 'orbit' : 'zoomIn', particles: /neve/i.test(prompt) ? 'snow' : /pioggia/i.test(prompt) ? 'rain' : /scintill|fuoco/i.test(prompt) ? 'sparks' : /bokeh|luci/i.test(prompt) ? 'bokeh' : 'dust', transition: 'fade', bg: { type: 'image', blob: st.img } }] };
          if (st.dur > 12) story.scenes.push(Object.assign({}, story.scenes[0], { dur: st.dur - 12, camera: 'panLeft', transition: 'iris', title: '' }));
          await B.prepareStory(story); setStory(story); return;
        }
        if (!prompt) { ta.focus(); return B.toast('Descrivi il video che vuoi'); }
        st.busy = true; goBtn.disabled = true;
        try { await generateStory(prompt, W, H, st.mode === 'real'); }
        catch (e) { if (e.code !== 'cancelled') B.err(e); setStatus(''); }
        st.busy = false; goBtn.disabled = false;
      }

      async function generateStory(prompt, W, H, ultra) {
        setStatus('<div class="iris-spin sm"></div><span>Thorion scrive lo storyboard…</span>');
        await B.ai.init();
        let plan;
        const ask = 'Sei un regista e motion designer pluripremiato. Crea lo storyboard di un video di ' + st.dur + ' secondi in formato ' + st.fmt + ' su: "' + prompt + '".\nRispondi SOLO con JSON valido con questa forma:\n{"title":"titolo breve","palette":["#hex scuro","#hex","#hex","#hex chiaro"],"music":"cinematic|upbeat|lofi|ambient|epic|corporate","scenes":[{"dur":numero di secondi,"visual":"descrizione visiva DETTAGLIATA in inglese per un generatore di immagini fotorealistiche (soggetto, luogo, luce, obiettivo, atmosfera)","title":"testo a schermo breve (max 6 parole) nella lingua della richiesta, oppure stringa vuota","subtitle":"testo secondario breve o vuoto","text":"cinematic|bold|elegant|typewriter|lower","camera":"zoomIn|zoomOut|panLeft|panRight|orbit|still","particles":"none|dust|bokeh|sparks|snow|rain|stars","transition":"fade|iris|blink|zoom|slide|flash"}]}\nRegole: da ' + (ultra ? '2 a 4' : '3 a 7') + ' scene, durate che sommano esattamente a ' + st.dur + '; ritmo narrativo con apertura forte e chiusura con messaggio o call to action; varia camera e transizioni.';
        if (B.ai.textEngine()) {
          try { plan = await B.ai.json(ask, { system: false, tier: 'default' }); } catch (e) { B.toast('Storyboard AI non disponibile, uso un modello automatico'); }
        }
        if (!plan || !Array.isArray(plan.scenes) || !plan.scenes.length) plan = fallbackPlan(prompt);
        const scenes = plan.scenes.slice(0, 8).map((s) => ({ dur: B.clamp(+s.dur || st.dur / plan.scenes.length, 1.5, 20), visual: s.visual || prompt, title: s.title || '', subtitle: s.subtitle || '', text: TEXT_STYLES[s.text] ? s.text : 'cinematic', camera: CAMERAS[s.camera] ? s.camera : 'zoomIn', particles: PARTICLES[s.particles] ? s.particles : 'dust', transition: TRANS[s.transition] ? s.transition : 'fade', bg: { type: 'gradient' } }));
        const sum = scenes.reduce((a, s) => a + s.dur, 0); scenes.forEach((s) => (s.dur = Math.round(s.dur * st.dur / sum * 10) / 10));
        const pal = (Array.isArray(plan.palette) && plan.palette.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).length >= 3) ? plan.palette : ['#120a06', '#7a3d16', '#e3a94a', '#f3d088'];
        const style = ultra ? 'photo' : st.style;
        const story = { w: W, h: H, title: plan.title || prompt.slice(0, 40), palette: pal, music: st.mood !== 'cinematic' ? st.mood : (MOODS[plan.music] ? plan.music : st.mood), seed: Date.now() % 1000, scenes, lightLeak: style === 'photo', letterbox: !!ultra && W > H };
        moodSel.value = story.music;
        await B.prepareStory(story);
        setStory(story);
        if (style === 'graphic') { setStatus(''); return; }
        const n = scenes.length;
        if (style === 'photo') {
          const engine = B.ai.photoEngine(!ultra);
          if (!engine || engine === 'web') {
            scenes.forEach((sc, i) => { sc.bg = { type: 'preset', preset: Object.keys(B.shader.presets)[i % 5] }; });
            draw(); scenes.forEach((sc) => sc._paint && sc._paint());
            setStatus('<span data-i="Info"></span><span>Le foto realistiche delle scene arrivano dalla rete GPU comunitaria, disponibile nella versione web di Thorion. Qui ho usato scene 3D pronte.</span> <a class="btn sm gold" target="_blank" rel="noopener" href="' + B.esc(B.PUBLIC_URL + '?p=' + encodeURIComponent(prompt) + '#imagine') + '">Apri Thorion sul web</a>');
            return;
          }
          // every scene develops in parallel on the community network; the story plays meanwhile with placeholder backgrounds
          let ready = 0;
          const tick = () => setStatus('<div class="iris-spin sm"></div><span>' + (ultra ? 'Ultra realistico' : 'Cinematico') + ': ' + ready + ' di ' + n + ' scene sviluppate sulla rete GPU comunitaria… (di solito ' + (ultra ? '4–8' : '2–4') + ' minuti, puoi già modificare testi e camera)</span>');
          tick();
          scenes.forEach((sc, i) => { sc.bg = { type: 'preset', preset: Object.keys(B.shader.presets)[i % 5] }; });
          draw();
          let failed = 0;
          await Promise.all(scenes.map(async (sc, i) => {
            try {
              const r = await B.ai.image('RAW photo, cinematic film still, ' + sc.visual + ', anamorphic lens, natural light, subtle film grain, highly detailed', { engine, w: W, h: H, look: 'cinema', rawPrompt: true, negative: 'cartoon, illustration, 3d render, cgi, plastic skin, blurry, deformed, watermark, text, logo' });
              sc.bg = { type: 'image', blob: r.blob }; sc._img = await B.loadImage(r.blob);
            } catch (e) { failed++; if (failed === 1) B.toast(B.ai.errorText(e) + ' Per questa scena tengo uno sfondo 3D.'); }
            ready++; tick(); draw(); sc._paint && sc._paint();
          }));
        } else {
          for (let i = 0; i < n; i++) {
            const sc = scenes[i];
            setStatus('<div class="iris-spin sm"></div><span>Scena ' + (i + 1) + ' di ' + n + ': Thorion costruisce il mondo 3D…</span>');
            try { sc.bg = { type: 'shader', code: await B.ai.shader(sc.visual) }; }
            catch (e) { sc.bg = { type: 'preset', preset: Object.keys(B.shader.presets)[i % 5] }; if (i === 0) B.toast(B.ai.errorText(e) + ' Uso scene pronte dove serve.'); }
            draw(); sc._paint && sc._paint();
          }
        }
        setStatus('<span data-i="CheckCircle2"></span><span>Video pronto. Modifica le scene qui sotto o esportalo.</span>');
        setTimeout(() => setStatus(''), 5000);
      }
      function fallbackPlan(prompt) {
        const n = st.dur <= 10 ? 3 : st.dur <= 20 ? 4 : 6;
        const words = prompt.split(/[,.;]/).map((s) => s.trim()).filter(Boolean);
        const cams = ['zoomIn', 'panRight', 'orbit', 'zoomOut', 'panLeft', 'still'], tr = ['iris', 'fade', 'blink', 'zoom', 'flash', 'slide'];
        return { title: words[0] || 'Video', scenes: Array.from({ length: n }, (_, i) => ({ dur: st.dur / n, visual: prompt + ', cinematic shot ' + (i + 1), title: i === 0 ? (words[0] || '').slice(0, 40) : i === n - 1 ? 'Thorion' : (words[i] || '').slice(0, 40), subtitle: '', text: i === 0 ? 'cinematic' : i === n - 1 ? 'elegant' : 'bold', camera: cams[i % 6], particles: ['dust', 'bokeh', 'sparks', 'dust', 'stars', 'bokeh'][i % 6], transition: tr[i % 6] })) };
      }

      async function exportVideo() {
        if (!st.story) return;
        if (st.playing) togglePlay();
        const dlg = B.exportDialog('Esporto il video');
        try {
          const audio = await ensureAudio();
          const story = st.story;
          const res = await B.exportVideo({ w: story.w, h: story.h, fps: 30, duration: B.storyDuration(story), audio, signal: dlg.signal, onProgress: dlg.progress, draw: (ctx, t) => { B.renderStory(ctx, story, t, false); } });
          dlg.close();
          await B.save(res.blob, B.slug(story.title) + '.' + res.ext);
          B.lastExport = res;
        } catch (e) { dlg.close(); if (e.code !== 'cancelled') B.err(e, 'Esportazione non riuscita'); }
      }
      async function sendToEditor() {
        if (!st.story) return;
        if (st.playing) togglePlay();
        const dlg = B.exportDialog('Preparo il video per l’editor');
        try {
          const audio = await ensureAudio();
          const res = await B.exportVideo({ w: st.story.w, h: st.story.h, fps: 30, duration: B.storyDuration(st.story), audio, signal: dlg.signal, onProgress: dlg.progress, draw: (ctx, t) => B.renderStory(ctx, st.story, t, false) });
          dlg.close();
          B.go('video', { importBlob: res.blob, name: (st.story.title || 'Video AI') + '.' + res.ext, ratio: st.story.w + 'x' + st.story.h });
        } catch (e) { dlg.close(); if (e.code !== 'cancelled') B.err(e); }
      }
      async function saveProject() {
        const s = st.story; if (!s) return;
        const data = { w: s.w, h: s.h, title: s.title, palette: s.palette, music: s.music, seed: s.seed, letterbox: s.letterbox, grain: s.grain, lightLeak: s.lightLeak, grade: s.grade, watermark: s.watermark, scenes: [] };
        for (const sc of s.scenes) { const c = Object.assign({}, sc); delete c._img; delete c._sc; delete c._paint; if (c.bg && c.bg.blob) c.bg = { type: 'image', src: await B.blobToDataURL(c.bg.blob) }; data.scenes.push(c); }
        const th = document.createElement('canvas'); th.width = 320; th.height = Math.round(320 * s.h / s.w); B.renderStory(th.getContext('2d'), s, 1.2, true);
        st.projectId = st.projectId || B.uid('p');
        await B.projects.save({ id: st.projectId, type: 'motion', name: s.title || 'Video AI', data, thumb: th.toDataURL('image/jpeg', 0.7) });
        B.toast('Progetto salvato', 'ok');
      }
      B.key('mod+s', () => { saveProject(); }, 'motion');
      B.key(' ', () => { togglePlay(); }, 'motion');

      this.load = async (p) => {
        if (p.project) { const pr = await B.projects.get(p.project); if (pr) { st.projectId = pr.id; const story = JSON.parse(JSON.stringify(pr.data)); await B.prepareStory(story); setStory(story); } return; }
        if (p.shader) { const [, W, H] = FORMATS.find((f) => f[0] === st.fmt); const story = { w: W, h: H, music: 'ambient', seed: 5, title: p.prompt || 'Scena 3D', scenes: [{ dur: 8, title: '', text: 'none', camera: 'still', particles: 'none', transition: 'fade', bg: { type: 'shader', code: p.shader } }] }; await B.prepareStory(story); setStory(story); return; }
        if (p.imageURL || p.galleryId) {
          let blob = null;
          if (p.galleryId) { const g = await B.db.get('gallery', p.galleryId); blob = g && g.blob; }
          if (!blob && p.imageURL) blob = B.dataURLToBlob(p.imageURL);
          if (blob) { setMode('photo'); setPhoto(blob); if (p.prompt) ta.value = ''; generate(); }
          return;
        }
        if (p.prompt) { setMode('text'); ta.value = p.prompt; if (p.auto) generate(); }
      };
    },
    onShow(p) { if (p) this.load(p); },
    onHide() { const v = B.views.motion; if (v && v.el) { const b = B.$('.mo-ctrl [data-i="Pause"]', v.el); if (b) b.click(); } }
  });
})();
