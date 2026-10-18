/* The Breye eye: follows the pointer, blinks, dilates while Iris thinks. */
(function () {
  'use strict';
  const B = window.B;
  const eyes = new Set();
  let px = innerWidth / 2, py = innerHeight / 3, raf = 0;

  B.eye = function (host, opts = {}) {
    const el = B.h('div', { class: 'eye' + (opts.cls ? ' ' + opts.cls : '') },
      B.h('div', { class: 'eye-ring' }),
      B.h('div', { class: 'eye-socket' }, B.h('div', { class: 'eye-iris' }, B.h('div', { class: 'eye-pupil' })), B.h('div', { class: 'eye-gloss' }), B.h('div', { class: 'eye-lid t' }), B.h('div', { class: 'eye-lid b' })));
    if (opts.lid) el.style.setProperty('--lid', opts.lid);
    host.append(el);
    const iris = el.querySelector('.eye-iris');
    const me = { el, iris, range: opts.range || 0.075, dil: 1 };
    eyes.add(me);
    schedule();
    const blink = () => { if (!document.body.contains(el)) { eyes.delete(me); return; } el.classList.add('blink'); setTimeout(() => el.classList.remove('blink'), 140); setTimeout(blink, 2500 + Math.random() * 5000); };
    if (opts.blink !== false) setTimeout(blink, 1500 + Math.random() * 3000);
    me.dilate = (v) => { me.dil = v; iris.querySelector('.eye-pupil').style.setProperty('--dil', v); };
    me.think = (on) => el.classList.toggle('think', !!on);
    return me;
  };

  function update() {
    raf = 0;
    eyes.forEach((e) => {
      if (!e.el.isConnected) return;
      const r = e.el.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 400) * e.range * r.width;
      e.iris.style.transform = 'translate(' + (dx / d * k).toFixed(2) + 'px,' + (dy / d * k).toFixed(2) + 'px)';
    });
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(update); }
  addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; schedule(); }, { passive: true });
  addEventListener('resize', schedule);

  /* AI activity: dilate + spin every eye */
  B.on('ai:busy', (n) => eyes.forEach((e) => { e.think && e.think(n > 0); e.dilate && e.dilate(n > 0 ? 1.35 : 1); }));
  addEventListener('blur', () => eyes.forEach((e) => e.dilate && e.dilate(1.2)));
  addEventListener('focus', () => eyes.forEach((e) => e.dilate && e.dilate(1)));

  /* animated iris-fibre background */
  B.fibers = function (canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    let w, h, fibers = [], stop = false, t0 = performance.now();
    function size() {
      const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1);
      w = canvas.width = Math.max(1, r.width * dpr); h = canvas.height = Math.max(1, r.height * dpr);
      fibers = [];
      const n = opts.count || 220;
      for (let i = 0; i < n; i++) fibers.push({ a: Math.random() * Math.PI * 2, r0: 0.12 + Math.random() * 0.2, r1: 0.45 + Math.random() * 0.55, wob: Math.random() * 6, hue: Math.random(), wd: 0.4 + Math.random() * 1.6 });
    }
    size();
    const ro = new ResizeObserver(size); ro.observe(canvas);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function frame(now) {
      if (stop || !canvas.isConnected) { ro.disconnect(); return; }
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const cx = w * (opts.cx || 0.78), cy = h * (opts.cy || 0.45), R = Math.max(w, h) * 0.75;
      ctx.globalCompositeOperation = 'lighter';
      for (const f of fibers) {
        const a = f.a + Math.sin(t * 0.08 + f.wob) * 0.03 + t * 0.006;
        const r0 = R * f.r0, r1 = R * f.r1;
        const x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0;
        const bend = Math.sin(t * 0.3 + f.wob) * 0.05;
        const x1 = cx + Math.cos(a + bend) * r1, y1 = cy + Math.sin(a + bend) * r1;
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        const col = f.hue < 0.5 ? '227,169,74' : f.hue < 0.8 ? '201,138,46' : '243,208,136';
        g.addColorStop(0, 'rgba(' + col + ',0.0)'); g.addColorStop(0.25, 'rgba(' + col + ',0.22)'); g.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.strokeStyle = g; ctx.lineWidth = f.wd * (devicePixelRatio || 1);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + Math.sin(f.wob + t * 0.2) * 20, (y0 + y1) / 2, x1, y1); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (!reduce) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { stop() { stop = true; } };
  };
})();
