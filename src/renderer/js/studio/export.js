// Esportazione di Salto Studio: video (MP4 o WebM con audio mixato), immagine PNG/JPG e PDF.
import { S, duration, emit } from './state.js';
import { renderFrame, syncMedia, settle, pauseAll } from './engine.js';
import { masterStream, resume, updateMix, renderMixdown } from './audio.js';
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer.js';
import { modal, icon, toast, $, confetti } from '../lib/ui.js';
import { esc } from '../lib/format.js';

export function videoFormats() {
  const list = [
    ['mp4', 'MP4 (H.264) · consigliato per i social', 'video/mp4;codecs=avc1.640028,mp4a.40.2'],
    ['mp4', 'MP4 (H.264) · compatibilità massima', 'video/mp4;codecs=avc1.42E01F,mp4a.40.2'],
    ['mp4', 'MP4', 'video/mp4'],
    ['webm', 'WebM (VP9)', 'video/webm;codecs=vp9,opus'],
    ['webm', 'WebM (VP8)', 'video/webm;codecs=vp8,opus'],
  ];
  const ok = list.filter(([, , mime]) => window.MediaRecorder && MediaRecorder.isTypeSupported(mime));
  // un solo MP4 (il migliore disponibile) e un solo WebM
  return ['mp4', 'webm'].map(ext => ok.find(f => f[0] === ext)).filter(Boolean);
}

// esportazione precisa con WebCodecs: H.264 (o VP9) + AAC (o Opus) in un vero file MP4
export async function preciseSupport(w, h) {
  if (!window.VideoEncoder || !window.AudioEncoder) return null;
  const even = v => Math.round(v / 2) * 2;
  const W = even(w);
  const H = even(h);
  const mbs = Math.ceil(W / 16) * Math.ceil(H / 16);
  const avc = mbs <= 8192 ? ['avc1.640028', 'avc1.4d0028'] : ['avc1.640032', 'avc1.4d0032', 'avc1.640033'];
  let video = null;
  for (const codec of avc) {
    try { if ((await VideoEncoder.isConfigSupported({ codec, width: W, height: H, bitrate: 8e6, framerate: 30 })).supported) { video = { codec, mux: 'avc' }; break; } } catch { /* prossimo */ }
  }
  if (!video) {
    try { if ((await VideoEncoder.isConfigSupported({ codec: 'vp09.00.40.08', width: W, height: H, bitrate: 8e6, framerate: 30 })).supported) video = { codec: 'vp09.00.40.08', mux: 'vp9' }; } catch { /* nessuno */ }
  }
  if (!video) return null;
  let audio = null;
  for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
    try { if ((await AudioEncoder.isConfigSupported({ codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 })).supported) { audio = { codec, mux }; break; } } catch { /* prossimo */ }
  }
  return { video, audio };
}

export async function exportPrecise({ scale, fps, bitrate, onProgress, isCancelled, previewCanvas }) {
  const W = S.project.width;
  const H = S.project.height;
  const ow = Math.round(W * scale / 2) * 2;
  const oh = Math.round(H * scale / 2) * 2;
  const sup = await preciseSupport(ow, oh);
  if (!sup) throw new Error('Codifica video non disponibile su questo computer');
  const dur = duration();
  const hasAudio = !!sup.audio && S.project.clips.some(c => c.type === 'audio' || (c.type === 'video' && !c.muted));
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: sup.video.mux, width: ow, height: oh, frameRate: fps },
    audio: hasAudio ? { codec: sup.audio.mux, sampleRate: 48000, numberOfChannels: 2 } : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let failure = null;
  // audio: mix fuori tempo reale e codifica
  if (hasAudio) {
    onProgress(0, 'Mixaggio dell\'audio…');
    const mix = await renderMixdown(S.project, dur, 48000);
    const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: e => { failure = e; } });
    aenc.configure({ codec: sup.audio.codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 });
    const L = mix.getChannelData(0);
    const R = mix.numberOfChannels > 1 ? mix.getChannelData(1) : L;
    const step = 4800;
    for (let i = 0; i < mix.length; i += step) {
      const n = Math.min(step, mix.length - i);
      const data = new Float32Array(n * 2);
      data.set(L.subarray(i, i + n), 0);
      data.set(R.subarray(i, i + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / 48000 * 1e6), data });
      aenc.encode(ad);
      ad.close();
    }
    await aenc.flush();
    aenc.close();
  }
  // video: fotogramma per fotogramma
  const cv = document.createElement('canvas');
  cv.width = ow;
  cv.height = oh;
  const ctx = cv.getContext('2d', { alpha: false, willReadFrequently: false });
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failure = e; } });
  venc.configure({ codec: sup.video.codec, width: ow, height: oh, bitrate, framerate: fps, latencyMode: 'quality', ...(sup.video.mux === 'avc' ? { avc: { format: 'avc' } } : {}) });
  const frames = Math.max(1, Math.round(dur * fps));
  const pctx = previewCanvas ? previewCanvas.getContext('2d') : null;
  pauseAll();
  for (let i = 0; i < frames; i++) {
    if (isCancelled()) { venc.close(); return null; }
    if (failure) throw failure;
    const t = Math.min(dur - 1e-4, i / fps);
    syncMedia(t, false);
    await settle(t);
    renderFrame(ctx, t, { scale: ow / W });
    const frame = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
    venc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    if (pctx && i % 3 === 0) pctx.drawImage(cv, 0, 0, previewCanvas.width, previewCanvas.height);
    while (venc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 4));
    if (i % 5 === 0) { onProgress(i / frames, `Fotogramma ${i + 1} di ${frames}`); await new Promise(r => setTimeout(r, 0)); }
  }
  await venc.flush();
  venc.close();
  if (failure) throw failure;
  muxer.finalize();
  onProgress(1, 'Completato');
  return { buffer: target.buffer, codec: sup.video.mux, audio: hasAudio ? sup.audio.mux : null };
}

export function openExport({ getPreviewCanvas, stopPlayback }) {
  const fmts = videoFormats();
  const W = S.project.width;
  const H = S.project.height;
  const dur = duration();
  const hasMotion = S.project.clips.some(c => c.type === 'video' || c.type === 'audio' || (c.animIn?.type && c.animIn.type !== 'none') || (c.loop?.type && c.loop.type !== 'none') || (c.effect && c.effect !== 'none'));
  const m = modal({
    title: 'Esporta',
    subtitle: `${esc(S.project.name)} · ${W}×${H} · ${dur.toFixed(1)} secondi`,
    icon: 'download',
    size: 'lg',
    body: `<div class="grid" style="grid-template-columns:1fr 1fr;gap:20px">
        <div class="col" style="gap:12px">
          <div class="seg" id="kind"><button data-k="video" class="${hasMotion ? 'active' : ''}">${icon('film', 15)}Video</button><button data-k="image" class="${hasMotion ? '' : 'active'}">${icon('image', 15)}Immagine</button><button data-k="pdf">${icon('file-text', 15)}PDF</button></div>
          <div id="opts"></div>
        </div>
        <div><div class="st-export-prev" style="aspect-ratio:${W}/${H};max-height:52vh;margin:0 auto;background:#000;border-radius:14px;overflow:hidden" id="prevBox"><canvas id="prevCv" style="width:100%;height:100%"></canvas></div>
          <div class="progress mt hidden" id="prog"><i style="width:0%"></i></div><p class="small muted mt" id="status" style="text-align:center"></p></div>
      </div>`,
    actions: [
      { label: 'Chiudi', kind: 'ghost', fn: mm => { cancel = true; mm.close(); return false; } },
      { label: 'Esporta', kind: 'primary', icon: 'download', fn: () => { start(); return false; } },
    ],
    onClose: () => { cancel = true; },
  });
  let kind = hasMotion ? 'video' : 'image';
  let cancel = false;
  let precise = null;
  const prevCv = $('#prevCv', m.body);
  prevCv.width = Math.round(W * Math.min(1, 640 / Math.max(W, H)));
  prevCv.height = Math.round(H * Math.min(1, 640 / Math.max(W, H)));
  renderFrame(prevCv.getContext('2d'), S.time, { scale: prevCv.width / W });

  const drawOpts = () => {
    const o = $('#opts', m.body);
    if (kind === 'video') {
      o.innerHTML = `<label class="field"><span>Formato</span><select id="vf">${precise ? `<option value="precise">MP4 ${precise.video.mux === 'avc' ? 'H.264' : 'VP9'}${precise.audio ? ' + ' + precise.audio.mux.toUpperCase() : ''} · preciso, consigliato per i social</option>` : ''}${fmts.map((f, i) => `<option value="${i}">${esc(f[1])} · tempo reale</option>`).join('')}</select></label>
        <label class="field"><span>Risoluzione</span><select id="vr"><option value="1">Originale ${W}×${H}</option><option value="0.6667">${Math.round(W * 0.6667)}×${Math.round(H * 0.6667)} (720p)</option><option value="0.5">${Math.round(W / 2)}×${Math.round(H / 2)} (leggera)</option></select></label>
        <label class="field"><span>Fotogrammi al secondo</span><select id="vfps">${[24, 25, 30, 60].map(f => `<option ${f === (S.project.fps || 30) ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <label class="field"><span>Qualità</span><select id="vq"><option value="16000000">Alta (16 Mbps)</option><option value="8000000" selected>Ottima (8 Mbps)</option><option value="4000000">Leggera (4 Mbps)</option></select></label>
        <p class="tiny muted">${precise ? 'Modalità precisa: ogni fotogramma viene calcolato uno per uno, con audio mixato a parte. Il file è compatibile con Instagram, TikTok, Facebook, WhatsApp e YouTube.' : `L'esportazione avviene in tempo reale (${dur.toFixed(0)} secondi): tieni aperta questa finestra fino alla fine.`}</p>`;
    } else if (kind === 'image') {
      o.innerHTML = `<label class="field"><span>Formato immagine</span><select id="if"><option value="png">PNG (massima qualità)</option><option value="jpg">JPG (più leggero)</option></select></label>
        <label class="field"><span>Dimensione</span><select id="is"><option value="1">${W}×${H}</option><option value="2">${W * 2}×${H * 2} (doppia, per la stampa)</option><option value="0.5">${W / 2}×${H / 2}</option></select></label>
        <label class="field"><span>Fotogramma</span><select id="it"><option value="cur">Quello visibile ora (${S.time.toFixed(1)}s)</option><option value="end">Fine delle animazioni</option></select></label>
        <button class="btn" id="copyImg">${icon('copy', 15)}Copia negli appunti</button>`;
      $('#copyImg', m.body).onclick = async () => { const url = await imageDataUrl(1, 'png'); await window.athlos.system.copyImage(url); toast('Immagine copiata: incollala dove vuoi'); };
    } else {
      o.innerHTML = `<p class="small">Crea un PDF pronto da stampare o inviare via email, con la grafica alla massima risoluzione.</p>
        <label class="field"><span>Formato pagina</span><select id="pf"><option value="fit">Stessa proporzione della grafica</option><option value="A4">A4</option><option value="A5">A5</option></select></label>`;
    }
  };
  drawOpts();
  preciseSupport(W, H).then(p => { precise = p; drawOpts(); }).catch(() => {});
  $('#kind', m.body).addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    kind = b.dataset.k;
    m.body.querySelectorAll('#kind button').forEach(x => x.classList.toggle('active', x === b));
    drawOpts();
  });

  async function imageDataUrl(scale, type) {
    const t = $('#it', m.body)?.value === 'end' ? Math.min(duration() - 0.01, Math.max(...S.project.clips.map(c => c.start + Math.max(c.animIn?.duration || 0, 0) + 0.05), S.time)) : S.time;
    syncMedia(t, false);
    await settle(t);
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * scale);
    cv.height = Math.round(H * scale);
    renderFrame(cv.getContext('2d'), t, { scale });
    return cv.toDataURL(type === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
  }

  async function start() {
    const foot = m.el.querySelector('.modal-foot .btn.primary');
    const status = $('#status', m.body);
    if (kind === 'image') {
      const type = $('#if', m.body).value;
      const url = await imageDataUrl(Number($('#is', m.body).value), type);
      const p = await window.athlos.file.save({ defaultName: `${S.project.name}.${type}`, filters: [{ name: type.toUpperCase(), extensions: [type] }], base64: url.split(',')[1], reveal: true });
      if (p) { toast('Immagine salvata'); confetti({ count: 80 }); }
      return;
    }
    if (kind === 'pdf') {
      const url = await imageDataUrl(2, 'jpg');
      const pf = $('#pf', m.body).value;
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${pf === 'fit' ? `${W}px ${H}px` : pf};margin:0}html,body{margin:0;height:100%}img{display:block;width:100%;height:100%;object-fit:contain}</style></head><body><img src="${url}"></body></html>`;
      const p = await window.athlos.print.pdf({ html, defaultName: S.project.name, pageSize: pf === 'fit' ? 'A4' : pf });
      if (p) toast('PDF salvato');
      return;
    }
    // video
    if ($('#vf', m.body).value === 'precise') {
      const scaleP = Number($('#vr', m.body).value);
      const fpsP = Number($('#vfps', m.body).value);
      const bitrateP = Number($('#vq', m.body).value);
      stopPlayback();
      S.exporting = true;
      cancel = false;
      foot.disabled = true;
      m.body.querySelectorAll('select, .seg button').forEach(x => { x.disabled = true; });
      $('#prog', m.body).classList.remove('hidden');
      const t0 = performance.now();
      try {
        const res = await exportPrecise({
          scale: scaleP, fps: fpsP, bitrate: bitrateP, previewCanvas: prevCv, isCancelled: () => cancel,
          onProgress: (p, msg) => { $('#prog i', m.body).style.width = `${p * 100}%`; status.textContent = msg; },
        });
        if (!res) { status.textContent = 'Esportazione annullata'; return; }
        const p = await window.athlos.file.save({ defaultName: `${S.project.name}.mp4`, filters: [{ name: 'MP4', extensions: ['mp4'] }], bytes: new Uint8Array(res.buffer), reveal: true });
        status.textContent = p ? `Video MP4 salvato (${(res.buffer.byteLength / 1048576).toFixed(1)} MB in ${((performance.now() - t0) / 1000).toFixed(0)} s)` : 'Salvataggio annullato';
        if (p) { toast('Video esportato! Pronto per i social'); confetti(); }
      } catch (err) {
        status.textContent = 'Errore: ' + err.message;
        toast('Esportazione precisa non riuscita: prova la modalità tempo reale', { type: 'error' });
      } finally {
        S.exporting = false;
        foot.disabled = false;
        m.body.querySelectorAll('select, .seg button').forEach(x => { x.disabled = false; });
      }
      return;
    }
    if (!fmts.length) { toast('Questo computer non supporta la registrazione video', { type: 'error' }); return; }
    const [ext, , mime] = fmts[Number($('#vf', m.body).value)];
    const scale = Number($('#vr', m.body).value);
    const fps = Number($('#vfps', m.body).value);
    const bitrate = Number($('#vq', m.body).value);
    stopPlayback();
    S.exporting = true;
    cancel = false;
    foot.disabled = true;
    m.body.querySelectorAll('select, .seg button').forEach(x => { x.disabled = true; });
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * scale / 2) * 2;
    cv.height = Math.round(H * scale / 2) * 2;
    const ctx = cv.getContext('2d', { alpha: false });
    await resume();
    const stream = cv.captureStream(fps);
    for (const tr of masterStream().getAudioTracks()) stream.addTrack(tr);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 192000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise(r => { rec.onstop = r; });
    $('#prog', m.body).classList.remove('hidden');
    status.textContent = 'Preparazione…';
    syncMedia(0, false);
    await settle(0);
    renderFrame(ctx, 0, { scale: cv.width / W });
    rec.start(500);
    const t0 = performance.now();
    const pctx = prevCv.getContext('2d');
    await new Promise(resolve => {
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        if (cancel || t >= dur) { resolve(); return; }
        S.time = t;
        syncMedia(t, true);
        updateMix(t);
        renderFrame(ctx, t, { scale: cv.width / W });
        pctx.drawImage(cv, 0, 0, prevCv.width, prevCv.height);
        $('#prog i', m.body).style.width = `${(t / dur) * 100}%`;
        status.textContent = `Registrazione ${t.toFixed(1)} / ${dur.toFixed(1)} s`;
        emit('time');
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    renderFrame(ctx, Math.max(0, dur - 0.001), { scale: cv.width / W });
    await new Promise(r => setTimeout(r, 250));
    rec.stop();
    await done;
    pauseAll();
    S.exporting = false;
    stream.getVideoTracks().forEach(t => t.stop());
    foot.disabled = false;
    m.body.querySelectorAll('select, .seg button').forEach(x => { x.disabled = false; });
    if (cancel) { status.textContent = 'Esportazione annullata'; return; }
    status.textContent = 'Salvataggio…';
    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const p = await window.athlos.file.save({ defaultName: `${S.project.name}.${ext}`, filters: [{ name: ext.toUpperCase(), extensions: [ext] }], bytes, reveal: true });
    $('#prog i', m.body).style.width = '100%';
    status.textContent = p ? `Video salvato (${(blob.size / 1048576).toFixed(1)} MB)` : 'Salvataggio annullato';
    if (p) { toast('Video esportato! Pronto per i social'); confetti(); }
  }
}
