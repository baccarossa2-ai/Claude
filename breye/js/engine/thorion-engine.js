/* Thorion Engine — a realistic real-time 3D engine built on three.js, made to be embedded anywhere.
   Physically based sky and sun with a time-of-day cycle (the sky itself lights the scene), PBR materials
   from Poly Haven, soft shadows that follow the player, SSAO + bloom + filmic tone mapping, open-world
   city with traffic and pedestrians, nature with terrain/water/forest, studio showcase, animated
   characters, third-person / first-person / orbit / driving, touch controls, rain and fog.
   B.engine.buildHTML(spec) returns a self-contained HTML page (three.js from the CDN, engine inlined). */
(function () {
  'use strict';
  const B = window.B || (window.B = {});
  const THREE_V = '0.160.0';

  /* ---------------- runtime (stringified into the page: it must not use anything outside itself) ---------------- */
  function ThorionEngine(THREE, X, spec) {
    spec = spec || {};
    const PH = 'https://dl.polyhaven.org/file/ph-assets/';
    const GH = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/';
    const $ = (id) => document.getElementById(id);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
    const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    let seed = (spec.seed || 1234) >>> 0;
    const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 560;
    const Q = spec.quality || (mobile ? 'medium' : 'high');
    const preset = spec.preset || (spec.objects ? 'custom' : 'open_world_city');
    const hud = $('hud'), hint = $('hint'), load = $('load');
    const say = (t) => { if (hint) hint.textContent = t; };

    /* renderer, scene, camera */
    const canvas = $('c');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    const PR = Math.min(devicePixelRatio || 1, Q === 'high' ? 1.5 : 1);
    renderer.setPixelRatio(PR); renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85; renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000);
    camera.position.set(0, 3, 8);
    const manager = new THREE.LoadingManager();
    let pending = 0, loaded = 0;
    manager.onStart = () => { pending++; };
    manager.onProgress = (u, l, t) => { loaded = l; if (load) load.querySelector('small').textContent = 'Carico texture, cielo e personaggi… ' + Math.round(l / Math.max(1, t) * 100) + '%'; };
    const TL = new THREE.TextureLoader(manager); TL.setCrossOrigin('anonymous');
    const pmrem = new THREE.PMREMGenerator(renderer);
    const updates = [], colliders = [], lampSpots = [], emissives = [];
    const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();

    /* ---------- sky, sun, time of day: the sky also lights the scene (PMREM) ---------- */
    const sky = new X.Sky(); sky.scale.setScalar(2500); scene.add(sky);
    const envSky = new X.Sky(); envSky.scale.setScalar(900); const envScene = new THREE.Scene(); envScene.add(envSky);
    [sky, envSky].forEach((s) => { const u = s.material.uniforms; u.turbidity.value = 4; u.rayleigh.value = 1.15; u.mieCoefficient.value = 0.003; u.mieDirectionalG.value = 0.86; });
    const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
    const SM = Q === 'high' ? 4096 : 2048, SR = Q === 'high' ? 70 : 50;
    sun.shadow.mapSize.set(SM, SM); Object.assign(sun.shadow.camera, { left: -SR, right: SR, top: SR, bottom: -SR, near: 1, far: 420 }); sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.03;
    const moon = new THREE.DirectionalLight(0x8ea8ff, 0); const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x3b3128, 0.25);
    scene.add(sun, sun.target, moon, hemi);
    const sunDir = new THREE.Vector3(0, 1, 0);
    let envRT = null, hdrEnv = null, timeH = 13, nightK = 0, lastEnvH = -99, studioMode = false, noSky = false;
    const stars = (() => { const g = new THREE.BufferGeometry(), n = 2500, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 0.95), r = 1800; p[i * 3] = r * Math.sin(ph) * Math.cos(th); p[i * 3 + 1] = r * Math.cos(ph); p[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th); } g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const m = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }); const s = new THREE.Points(g, m); scene.add(s); return s; })();
    function setTime(h) {
      timeH = ((h % 24) + 24) % 24;
      const day = (timeH - 6) / 14, elev = Math.sin(Math.PI * clamp(day, -0.2, 1.2)) * 64, azim = 105 + clamp(day, 0, 1) * 150;
      sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(azim));
      [sky, envSky].forEach((s) => s.material.uniforms.sunPosition.value.copy(sunDir));
      const dayK = sstep(-4, 14, elev), gold = sstep(25, 2, elev) * sstep(-3, 3, elev);
      nightK = 1 - sstep(-6, 4, elev);
      sun.intensity = 5.2 * dayK; sun.color.setRGB(1, lerp(0.97, 0.6, gold), lerp(0.93, 0.36, gold));
      moon.intensity = 0.35 * nightK; moon.position.set(-sunDir.x, Math.abs(sunDir.y) + 0.4, -sunDir.z).multiplyScalar(100);
      hemi.intensity = 0.12 + 0.2 * dayK; hemi.color.setRGB(lerp(0.3, 0.8, dayK), lerp(0.36, 0.88, dayK), lerp(0.55, 1, dayK));
      renderer.toneMappingExposure = (spec.exposure || 1) * lerp(0.5, 0.58, dayK);
      stars.material.opacity = noSky ? 1 : nightK * 0.9; sky.visible = !studioMode && !noSky;
      if (studioMode) { sun.intensity = 0; moon.intensity = 0; hemi.intensity = 0.15; renderer.toneMappingExposure = spec.exposure || 1; stars.material.opacity = 0; }
      if (scene.fog) { const f = scene.fog.color; f.setRGB(lerp(0.03, lerp(0.6, 0.9, gold), dayK), lerp(0.04, lerp(0.7, 0.62, gold), dayK), lerp(0.07, lerp(0.82, 0.44, gold), dayK)); }
      emissives.forEach((m) => { m.emissiveIntensity = (m.userData.base || 1) * nightK; });
      lampSpots.forEach((l) => { l.intensity = l.userData.base * nightK; });
      if (!hdrEnv && Math.abs(timeH - lastEnvH) > 0.25) { lastEnvH = timeH; if (envRT) envRT.dispose(); envRT = pmrem.fromScene(envScene, 0, 1, 2000); scene.environment = envRT.texture; }
    }

    /* ---------- materials: Poly Haven PBR with procedural fallback ---------- */
    const PBR = { asphalt: 'asphalt_02', road: 'asphalt_02', sidewalk: 'concrete_tiles', concrete: 'brushed_concrete', grass: 'leafy_grass', forest: 'forest_ground_04', rock: 'aerial_rocks_02', sand: 'coast_sand_01', wood: 'dark_wooden_planks', marble: 'marble_01', metal: 'metal_plate', plaster: 'grey_plaster', cobble: 'cobblestone_01', bark: 'bark_brown_02', brick: 'brick_4', tiles: 'clay_roof_tiles' };
    const TINT = { asphalt: 0x6a6b70, road: 0x6a6b70, sidewalk: 0x9a968e, concrete: 0x8f8b84, grass: 0x4f6b2c, forest: 0x4a3f2c, rock: 0x777068, sand: 0xc8b48a, wood: 0x5a3b24, marble: 0xe8e4dc, metal: 0x8a8d90, plaster: 0xb8b2a8, cobble: 0x77706a, bark: 0x4a3626, brick: 0x8a4a36, tiles: 0x9b4a32 };
    const noiseTex = (hex) => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const col = new THREE.Color(hex); const id = x.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const n = 0.82 + rnd() * 0.3; id.data[i] = col.r * 255 * n; id.data[i + 1] = col.g * 255 * n; id.data[i + 2] = col.b * 255 * n; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const matCache = {};
    function material(name, repeat, extra) {
      const key = name + '|' + (repeat || 1) + '|' + JSON.stringify(extra || {});
      if (matCache[key]) return matCache[key];
      const id = PBR[name] || name, rep = repeat || 1;
      const m = new THREE.MeshStandardMaterial(Object.assign({ color: TINT[name] || 0x999999, roughness: 0.9, metalness: name === 'metal' ? 0.85 : 0 }, extra || {}));
      const prep = (t, srgb) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = Q === 'high' ? 8 : 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
      const base = PH + 'Textures/jpg/1k/' + id + '/' + id + '_';
      TL.load(base + 'diff_1k.jpg', (t) => { m.map = prep(t, true); m.color.set(0xffffff); m.needsUpdate = true; }, undefined, () => { m.map = prep(noiseTex(TINT[name] || 0x999999), true); m.color.set(0xffffff); m.needsUpdate = true; });
      TL.load(base + 'nor_gl_1k.jpg', (t) => { m.normalMap = prep(t); m.normalScale.set(1, 1); m.needsUpdate = true; }, undefined, () => {});
      TL.load(base + 'rough_1k.jpg', (t) => { m.roughnessMap = prep(t); m.roughness = 1; m.needsUpdate = true; }, undefined, () => {});
      return (matCache[key] = m);
    }
    function boxUV(geo, w, h, d, period) { // world-scaled UVs on every face of a box
      const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / period, uv.getY(i) * dims[f][1] / period); }
      uv.needsUpdate = true; return geo;
    }

    /* ---------- facades with windows (lit at night) ---------- */
    function facade(style) {
      const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
      const e = document.createElement('canvas'); e.width = e.height = 512; const ex = e.getContext('2d'); ex.fillStyle = '#000'; ex.fillRect(0, 0, 512, 512);
      const base = ['#8d8a84', '#a39686', '#6f7478', '#b8ad9c', '#5a5f66', '#9a6c55'][style % 6];
      x.fillStyle = base; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2500; i++) { x.fillStyle = 'rgba(' + (rnd() < 0.5 ? '0,0,0' : '255,255,255') + ',' + (rnd() * 0.05) + ')'; x.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 6, 2 + rnd() * 6); }
      const glass = style % 3 === 2, cols = glass ? 8 : 4, rows = glass ? 8 : 4, cw = 512 / cols, rh = 512 / rows;
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        const px = q * cw + cw * (glass ? 0.06 : 0.22), py = r * rh + rh * (glass ? 0.08 : 0.2), ww = cw * (glass ? 0.88 : 0.56), hh = rh * (glass ? 0.84 : 0.6);
        const g = x.createLinearGradient(px, py, px + ww, py + hh); g.addColorStop(0, glass ? '#2c3b48' : '#1c232b'); g.addColorStop(1, glass ? '#54697a' : '#3a4652');
        x.fillStyle = g; x.fillRect(px, py, ww, hh);
        if (!glass) { x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(px, py + hh - 3, ww, 3); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(px - 3, py - 3, ww + 6, 3); }
        if (rnd() < 0.42) { const warm = rnd() < 0.8; ex.fillStyle = warm ? 'rgb(255,' + (190 + rnd() * 40 | 0) + ',' + (120 + rnd() * 50 | 0) + ')' : 'rgb(200,225,255)'; ex.globalAlpha = 0.55 + rnd() * 0.45; ex.fillRect(px, py, ww, hh); ex.globalAlpha = 1; }
      }
      const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
      const em = new THREE.CanvasTexture(e); em.colorSpace = THREE.SRGBColorSpace; em.wrapS = em.wrapT = THREE.RepeatWrapping;
      const m = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0, roughness: glass ? 0.25 : 0.85, metalness: glass ? 0.55 : 0.05 });
      m.userData.base = 1.5; emissives.push(m); return m;
    }

    /* ---------- procedural car with clear-coated paint ---------- */
    const CAR_COLORS = [0x0d0d0f, 0xe6e6e6, 0x7a0d12, 0x1d3557, 0x8b8f94, 0x2f4f3a, 0xb38b2d, 0x3b3b40];
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 24); wheelGeo.rotateZ(Math.PI / 2);
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.85 }), rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 1, roughness: 0.25 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1015, metalness: 0.2, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.88 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d6, emissiveIntensity: 0 }), tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a0a, emissiveIntensity: 0 });
    headMat.userData.base = 3; tailMat.userData.base = 2; emissives.push(headMat, tailMat);
    function carMesh(color) {
      const g = new THREE.Group();
      const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 });
      const s = new THREE.Shape(); // side profile (x = length, y = height)
      s.moveTo(-2.2, 0.3); s.lineTo(2.15, 0.3); s.quadraticCurveTo(2.3, 0.32, 2.3, 0.6); s.lineTo(2.25, 0.78); s.quadraticCurveTo(1.6, 0.9, 1.0, 0.95); s.lineTo(0.55, 1.42); s.quadraticCurveTo(0.2, 1.5, -0.8, 1.48); s.lineTo(-1.6, 1.0); s.quadraticCurveTo(-2.15, 0.95, -2.25, 0.8); s.lineTo(-2.25, 0.4); s.quadraticCurveTo(-2.25, 0.3, -2.2, 0.3);
      const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 4, curveSegments: 10 }), paint);
      body.geometry.translate(0, 0, -0.85); body.castShadow = body.receiveShadow = true; g.add(body);
      const win = new THREE.Shape(); win.moveTo(0.95, 0.98); win.lineTo(0.5, 1.4); win.quadraticCurveTo(0.2, 1.46, -0.75, 1.44); win.lineTo(-1.5, 1.02); win.lineTo(0.95, 0.98);
      const wm = new THREE.Mesh(new THREE.ExtrudeGeometry(win, { depth: 1.78, bevelEnabled: false }), glassMat); wm.geometry.translate(0, 0, -0.89); g.add(wm);
      [[1.45, 0.88], [-1.45, 0.88], [1.45, -0.88], [-1.45, -0.88]].forEach(([x, z]) => { const w = new THREE.Group(); const t = new THREE.Mesh(wheelGeo, tyreMat), r = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.27, 16).rotateZ(Math.PI / 2), rimMat); t.castShadow = true; w.add(t, r); w.position.set(x, 0.36, z); g.add(w); (g.userData.wheels = g.userData.wheels || []).push(w); });
      [[2.27, 0.62, 0.62], [2.27, 0.62, -0.62]].forEach(([x, y, z]) => { const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.34), headMat); h.position.set(x, y, z); g.add(h); });
      [[-2.27, 0.68, 0.66], [-2.27, 0.68, -0.66]].forEach(([x, y, z]) => { const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.3), tailMat); h.position.set(x, y, z); g.add(h); });
      g.rotation.order = 'YXZ';
      return g;
    }

    /* ---------- characters ---------- */
    const gltf = new X.GLTFLoader(manager);
    if (X.DRACOLoader) { const draco = new X.DRACOLoader(); draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/'); gltf.setDRACOLoader(draco); }
    // the sports car: a real scanned-quality model with clear-coated paint, chrome rims and glass
    let ferrariP = null;
    function sportsCar(color) {
      ferrariP = ferrariP || new Promise((res) => gltf.load(GH + 'models/gltf/ferrari.glb', (g) => res(g), undefined, () => res(null)));
      const holder = new THREE.Group(); holder.rotation.order = 'YXZ';
      ferrariP.then((g) => {
        if (!g) { const c = carMesh(color); holder.add(c); holder.userData.wheels = c.userData.wheels; return; }
        const m = g.scene.children[0].clone(true);
        const body = new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.03 });
        const details = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.35 });
        const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.25, roughness: 0, transmission: 1 });
        const bodyO = m.getObjectByName('body'); if (bodyO) bodyO.material = body;
        ['rim_fl', 'rim_fr', 'rim_rr', 'rim_rl', 'trim'].forEach((n) => { const o = m.getObjectByName(n); if (o) o.material = details; });
        const gl = m.getObjectByName('glass'); if (gl) gl.material = glass;
        m.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
        const inner = new THREE.Group(); inner.rotation.y = Math.PI / 2; inner.add(m);
        TL.load(GH + 'models/gltf/ferrari_ao.png', (t) => { const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4), new THREE.MeshBasicMaterial({ map: t, blending: THREE.MultiplyBlending, toneMapped: false, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; sh.renderOrder = 2; inner.add(sh); });
        holder.add(inner);
        holder.userData.ferrari = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map((n) => m.getObjectByName(n)).filter(Boolean);
      });
      return holder;
    }
    let soldier = null;
    const soldierP = new Promise((res) => gltf.load(GH + 'models/gltf/Soldier.glb', (g) => { soldier = g; res(g); }, undefined, () => res(null)));
    function primitiveMan(color) {
      const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: color || 0x3d4a5c, roughness: 0.8 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 6, 12), m); body.position.y = 0.95; body.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), new THREE.MeshStandardMaterial({ color: 0xc69c7d, roughness: 0.7 })); head.position.y = 1.72; head.castShadow = true;
      g.add(body, head); g.userData.prim = true; return g;
    }
    function character(opts) {
      const o = opts || {}, holder = new THREE.Group(); holder.position.set(o.x || 0, 0, o.z || 0); scene.add(holder);
      const c = { obj: holder, mixer: null, acts: {}, cur: null, speed: 0, yaw: o.yaw || 0, vy: 0, ground: true };
      c.play = (name, fade) => { const a = c.acts[name]; if (!a || c.cur === a) return; a.reset().setEffectiveWeight(1).fadeIn(fade || 0.25).play(); if (c.cur) c.cur.fadeOut(fade || 0.25); c.cur = a; };
      soldierP.then((g) => {
        if (!g) { holder.add(primitiveMan(o.color)); return; }
        const m = X.SkeletonUtils.clone(g.scene); m.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
        m.rotation.y = Math.PI; holder.add(m);
        c.mixer = new THREE.AnimationMixer(m);
        g.animations.forEach((a) => { c.acts[a.name] = c.mixer.clipAction(a); });
        c.play('Idle', 0);
      });
      return c;
    }

    /* ---------- worlds ---------- */
    let ground = () => 0, parkArea = null;
    const spawn = new THREE.Vector3(0, 0, 0), cars = [], npcs = [];
    function addCollider(x0, z0, x1, z1) { colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) }); }
    function pushOut(p, r) {
      let hit = false;
      for (const b of colliders) {
        if (p.x < b.x0 - r || p.x > b.x1 + r || p.z < b.z0 - r || p.z > b.z1 + r) continue;
        const dl = p.x - (b.x0 - r), dr = (b.x1 + r) - p.x, dt = p.z - (b.z0 - r), db = (b.z1 + r) - p.z, m = Math.min(dl, dr, dt, db);
        if (m === dl) p.x = b.x0 - r; else if (m === dr) p.x = b.x1 + r; else if (m === dt) p.z = b.z0 - r; else p.z = b.z1 + r;
        hit = true;
      }
      return hit;
    }

    function buildCity() {
      scene.fog = new THREE.FogExp2(0xb9c8d8, Q === 'high' ? 0.0026 : 0.0038);
      const N = Q === 'high' ? 7 : 5, BLK = 64, RD = 16, SW = 4, SPAN = N * BLK + (N + 1) * RD, H0 = -SPAN / 2;
      const asphalt = material('asphalt', (SPAN + 400) / 3, { roughness: 1 });
      const gp = new THREE.Mesh(new THREE.PlaneGeometry(SPAN + 400, SPAN + 400), asphalt); gp.rotation.x = -Math.PI / 2; gp.receiveShadow = true; scene.add(gp);
      const sideMat = material('sidewalk', 1), roof = material('concrete', 1);
      const styles = [0, 1, 2, 3, 4, 5].map(facade);
      const lineMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c4, roughness: 0.7 }), yMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.7 });
      const lampPole = new THREE.MeshStandardMaterial({ color: 0x2b2d30, metalness: 0.7, roughness: 0.4 }), bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd8a0, emissiveIntensity: 0 }); bulbMat.userData.base = 6; emissives.push(bulbMat);
      const roads = [];
      for (let i = 0; i <= N; i++) roads.push(H0 + i * (BLK + RD) + RD / 2);
      // lane markings
      const dash = new THREE.PlaneGeometry(3, 0.18), dashes = new THREE.InstancedMesh(dash, lineMat, roads.length * 2 * Math.ceil(SPAN / 9)); let di = 0; const M4 = new THREE.Matrix4(), Qt = new THREE.Quaternion(), S1 = new THREE.Vector3(1, 1, 1);
      roads.forEach((r) => { for (let s = H0; s < -H0; s += 9) { M4.compose(tmpV.set(s, 0.02, r), Qt.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), S1); dashes.setMatrixAt(di++, M4); M4.compose(tmpV.set(r, 0.02, s), Qt.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2)), S1); dashes.setMatrixAt(di++, M4); } });
      dashes.count = di; dashes.receiveShadow = true; scene.add(dashes);
      void yMat;
      const lampGeo = new THREE.CylinderGeometry(0.08, 0.12, 7, 8), armGeo = new THREE.BoxGeometry(1.6, 0.1, 0.1), bulbGeo = new THREE.SphereGeometry(0.22, 12, 8);
      const blocks = [];
      for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
        const x0 = H0 + RD + bx * (BLK + RD), z0 = H0 + RD + bz * (BLK + RD);
        blocks.push([x0, z0]);
        const sw = new THREE.Mesh(boxUV(new THREE.BoxGeometry(BLK, 0.18, BLK), BLK, 0.18, BLK, 4), sideMat); sw.position.set(x0 + BLK / 2, 0.09, z0 + BLK / 2); sw.receiveShadow = true; scene.add(sw);
        if (bx === Math.floor(N / 2) && bz === Math.floor(N / 2)) { // a small park in the middle
          const park = new THREE.Mesh(new THREE.BoxGeometry(BLK - 2 * SW, 0.24, BLK - 2 * SW), material('grass', 24)); park.position.set(x0 + BLK / 2, 0.12, z0 + BLK / 2); park.receiveShadow = true; scene.add(park);
          for (let t = 0; t < 14; t++) addTree(x0 + SW + 4 + rnd() * (BLK - 2 * SW - 8), z0 + SW + 4 + rnd() * (BLK - 2 * SW - 8), 0.8 + rnd() * 0.5);
          const gx = x0 + BLK / 2, gz = z0 + BLK / 2, gs = BLK - 2 * SW - 1; const og = ground; ground = (x, z) => (Math.abs(x - gx) < gs / 2 && Math.abs(z - gz) < gs / 2 ? 0.24 : og(x, z)); grassField(gx, gz, gs, Q === 'high' ? 9000 : 3000); ground = og; parkArea = [gx, gz, gs];
          spawn.set(x0 + BLK / 2, 0, z0 - RD / 2 + 3);
          continue;
        }
        const lots = 2 + Math.floor(rnd() * 2), lw = (BLK - 2 * SW) / lots;
        for (let i = 0; i < lots; i++) for (let j = 0; j < lots; j++) {
          const w = lw - 2 - rnd() * 3, d = lw - 2 - rnd() * 3, center = Math.hypot(x0 + BLK / 2, z0 + BLK / 2) / (SPAN / 2);
          const h = 10 + rnd() * (center < 0.45 ? 110 : 45) * (1.15 - center * 0.6);
          const st = Math.floor(rnd() * styles.length);
          const geo = boxUV(new THREE.BoxGeometry(w, h, d), w, h, d, styles[st].roughness < 0.5 ? 14 : 12);
          const b = new THREE.Mesh(geo, [styles[st], styles[st], roof, roof, styles[st], styles[st]]);
          const cx = x0 + SW + lw * i + lw / 2, cz = z0 + SW + lw * j + lw / 2;
          b.position.set(cx, h / 2 + 0.18, cz); b.castShadow = true; b.receiveShadow = true; scene.add(b);
          addCollider(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
          if (h > 30 && rnd() < 0.6) { const ac = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 2.2, d * 0.3), material('metal', 1)); ac.position.set(cx + (rnd() - 0.5) * w * 0.4, h + 1.3, cz + (rnd() - 0.5) * d * 0.4); ac.castShadow = true; scene.add(ac); }
        }
        // street lamps on the block corners and mid-sides
        [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92], [0.5, 0.04], [0.5, 0.96]].forEach(([u, v]) => {
          const px = x0 + u * BLK, pz = z0 + v * BLK; const pole = new THREE.Mesh(lampGeo, lampPole); pole.position.set(px, 3.5, pz); pole.castShadow = true; scene.add(pole);
          const arm = new THREE.Mesh(armGeo, lampPole); arm.position.set(px + (u < 0.5 ? -0.7 : 0.7), 6.9, pz); scene.add(arm);
          const bulb = new THREE.Mesh(bulbGeo, bulbMat); bulb.position.set(px + (u < 0.5 ? -1.4 : 1.4), 6.75, pz); scene.add(bulb); lampSpots.push(bulb.position);
          addCollider(px - 0.15, pz - 0.15, px + 0.15, pz + 0.15);
        });
      }
      lampSpots.length = 0;
      // a pool of real lights follows the player through the lamps at night
      for (let i = 0; i < (Q === 'high' ? 8 : 4); i++) { const l = new THREE.PointLight(0xffc98a, 0, 26, 1.6); l.userData.base = 40; scene.add(l); lampSpots.push(l); }
      const bulbs = []; scene.traverse((n) => { if (n.isMesh && n.material === bulbMat) bulbs.push(n.position); });
      updates.push(() => { if (nightK < 0.05) return; const p = player.obj.position; bulbs.sort((a, b) => a.distanceToSquared(p) - b.distanceToSquared(p)); lampSpots.forEach((l, i) => { if (bulbs[i]) l.position.copy(bulbs[i]).y -= 0.4; }); });
      // traffic
      const nCars = Q === 'high' ? 26 : 12;
      for (let i = 0; i < nCars; i++) {
        const along = rnd() < 0.5, r = roads[Math.floor(rnd() * roads.length)], dir = rnd() < 0.5 ? 1 : -1, lane = dir * 3.6;
        const car = carMesh(CAR_COLORS[i % CAR_COLORS.length]); const s = H0 + rnd() * SPAN;
        if (along) car.position.set(s, 0, r + lane); else car.position.set(r - lane, 0, s);
        car.rotation.y = along ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
        scene.add(car);
        const parked = i < nCars * 0.25;
        if (parked) { if (along) car.position.z = r + dir * 6.2; else car.position.x = r - dir * 6.2; }
        cars.push({ mesh: car, along, dir, speed: parked ? 0 : 7 + rnd() * 7, parked, H0, SPAN, v: 0, steer: 0 });
      }
      updates.push((dt) => { for (const c of cars) { if (c.parked || c === drive.car) continue; const m = c.mesh, d = c.speed * dt * c.dir; if (c.along) { m.position.x += d; if (m.position.x > -H0) m.position.x = H0; if (m.position.x < H0) m.position.x = -H0; } else { m.position.z += d; if (m.position.z > -H0) m.position.z = H0; if (m.position.z < H0) m.position.z = -H0; } spinWheels(c, c.speed * dt); } });
      const hero = sportsCar(spec.color ? new THREE.Color(spec.color).getHex() : 0xa50d12); hero.position.set(spawn.x + 6, 0, spawn.z - 4.5); hero.rotation.y = 0; scene.add(hero);
      cars.push({ mesh: hero, parked: true, speed: 0, v: 0, steer: 0, hero: true });
      // pedestrians walk around the blocks
      const nPed = Q === 'high' ? 9 : 4;
      for (let i = 0; i < nPed; i++) {
        const [x0, z0] = blocks[Math.floor(rnd() * blocks.length)], inset = 1.8, path = [[x0 + inset, z0 + inset], [x0 + BLK - inset, z0 + inset], [x0 + BLK - inset, z0 + BLK - inset], [x0 + inset, z0 + BLK - inset]];
        const k = Math.floor(rnd() * 4), c = character({ x: path[k][0], z: path[k][1] }); c.path = path; c.k = (k + 1) % 4; c.walk = 1.3 + rnd() * 0.4; c.obj.position.y = 0.18; npcs.push(c);
      }
      updates.push((dt) => { for (const c of npcs) { const t = c.path[c.k], p = c.obj.position, dx = t[0] - p.x, dz = t[1] - p.z, dd = Math.hypot(dx, dz); if (dd < 0.3) { c.k = (c.k + 1) % 4; continue; } p.x += dx / dd * c.walk * dt; p.z += dz / dd * c.walk * dt; c.obj.rotation.y = Math.atan2(dx, dz); c.play('Walk'); } });
      ground = (x, z) => { if (parkArea && Math.abs(x - parkArea[0]) < parkArea[2] / 2 && Math.abs(z - parkArea[1]) < parkArea[2] / 2) return 0.24; const fx = ((x - H0) % (BLK + RD) + (BLK + RD)) % (BLK + RD), fz = ((z - H0) % (BLK + RD) + (BLK + RD)) % (BLK + RD); return fx > RD && fz > RD && Math.abs(x) < -H0 && Math.abs(z) < -H0 ? 0.18 : 0; };
      addCollider(-SPAN, -SPAN / 2 - 6, SPAN, -SPAN / 2 - 4); addCollider(-SPAN, SPAN / 2 + 4, SPAN, SPAN / 2 + 6); addCollider(-SPAN / 2 - 6, -SPAN, -SPAN / 2 - 4, SPAN); addCollider(SPAN / 2 + 4, -SPAN, SPAN / 2 + 6, SPAN);
      say('WASD per camminare · Shift corri · Spazio salta · E sali/scendi dall’auto · trascina per guardarti attorno');
    }
    function spinWheels(c, dist) { (c.mesh.userData.wheels || []).forEach((w) => { w.rotation.z -= dist / 0.36; }); (c.mesh.userData.ferrari || []).forEach((w) => { w.rotation.x += dist / 0.34; }); }

    // value-noise fbm for terrain
    const perm = new Uint8Array(512); for (let i = 0; i < 256; i++) perm[i] = i; for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
    function noise2(x, y) { const X0 = Math.floor(x) & 255, Y0 = Math.floor(y) & 255, xf = x - Math.floor(x), yf = y - Math.floor(y), u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = perm[X0] + Y0, b = perm[X0 + 1] + Y0; return lerp(lerp(grad(perm[a], xf, yf), grad(perm[b], xf - 1, yf), u), lerp(grad(perm[a + 1], xf, yf - 1), grad(perm[b + 1], xf - 1, yf - 1), u), v); }
    const fbm = (x, y) => { let s = 0, a = 1, f = 1; for (let i = 0; i < 5; i++) { s += a * noise2(x * f, y * f); a *= 0.5; f *= 2.02; } return s; };

    const treeParts = { trunks: [], crowns: [], pines: [] };
    function addTree(x, z, s) { const t = rnd() < 0.35 ? 'pines' : 'crowns'; treeParts.trunks.push([x, z, s]); treeParts[t].push([x, z, s]); }
    function leafTexture(pine) {
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      for (let i = 0; i < (pine ? 140 : 46); i++) {
        const px = 20 + rnd() * 216, py = 20 + rnd() * 216, a = rnd() * 6.28, l = pine ? 18 + rnd() * 14 : 16 + rnd() * 16, w = pine ? 1.6 : l * 0.45;
        const g = 70 + rnd() * 60; x.save(); x.translate(px, py); x.rotate(a);
        x.fillStyle = 'rgb(' + (g * 0.55 | 0) + ',' + (g + 30 | 0) + ',' + (g * 0.35 | 0) + ')'; x.beginPath(); x.ellipse(0, 0, l, w, 0, 0, 6.28); x.fill();
        if (!pine) { x.strokeStyle = 'rgba(30,50,20,.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(-l, 0); x.lineTo(l, 0); x.stroke(); }
        x.restore();
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    }
    // a crown is a cloud of leaf cards whose normals point outwards: soft, volumetric foliage
    function crownGeometry(pine, cards) {
      const pos = [], nor = [], uv = [], idx = []; const c = new THREE.Vector3(0, pine ? 5.2 : 5.3, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < cards; i++) {
        let p;
        if (pine) { const h = rnd(), r = (1 - h) * 2.1 * (0.6 + rnd() * 0.5), th = rnd() * 6.28; p = new THREE.Vector3(Math.cos(th) * r, 1.4 + h * 7.2, Math.sin(th) * r); }
        else { const u = rnd() * 2 - 1, th = rnd() * 6.28, r = 2.3 * Math.cbrt(0.35 + rnd() * 0.65); p = new THREE.Vector3(Math.sqrt(1 - u * u) * Math.cos(th) * r, 5.3 + u * r * 0.8, Math.sqrt(1 - u * u) * Math.sin(th) * r); }
        const sz = pine ? 1.3 : 1.25 + rnd() * 0.5; q.setFromEuler(e.set(rnd() * 3, rnd() * 6.28, rnd() * 3));
        n.copy(p).sub(c).normalize(); if (pine) n.y = 0.35, n.normalize();
        const base = pos.length / 3;
        [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]].forEach(([dx, dy, u0, v0]) => { a.set(dx * sz / 2, dy * sz / 2, 0).applyQuaternion(q).add(p); pos.push(a.x, a.y, a.z); b.copy(n); nor.push(b.x, b.y, b.z); uv.push(u0, v0); });
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
    }
    function flushTrees() {
      const n = treeParts.trunks.length; if (!n) return;
      const trunkGeo = new THREE.CylinderGeometry(0.14, 0.3, 5.2, 9, 3); { const p = trunkGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 1.3) * 0.05); } } trunkGeo.translate(0, 2.5, 0);
      const M = new THREE.Matrix4(), Qr = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
      const mk = (geo, mat, list, tint, depthMat) => { const im = new THREE.InstancedMesh(geo, mat, list.length); const col = new THREE.Color(); list.forEach(([x, z, s], i) => { M.compose(tmpV.set(x, ground(x, z) - 0.1, z), Qr.setFromAxisAngle(UP, rnd() * 6.28), tmpV2.set(s, s * (0.9 + rnd() * 0.3), s)); im.setMatrixAt(i, M); if (tint) { col.setHSL(tint[0] + rnd() * 0.05, tint[1] + rnd() * 0.15, tint[2] + rnd() * 0.12); im.setColorAt(i, col); } }); im.castShadow = true; im.receiveShadow = true; if (depthMat) im.customDepthMaterial = depthMat; scene.add(im); return im; };
      mk(trunkGeo, material('bark', 1), treeParts.trunks);
      [false, true].forEach((pine) => {
        const list = treeParts[pine ? 'pines' : 'crowns']; if (!list.length) return;
        const tex = leafTexture(pine);
        const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.82, metalness: 0 });
        const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.42 });
        mk(crownGeometry(pine, Q === 'high' ? (pine ? 220 : 190) : (pine ? 120 : 110)), mat, list, pine ? [0.26, 0.35, 0.62] : [0.2, 0.45, 0.72], depth);
      });
      treeParts.trunks.forEach(([x, z, s]) => addCollider(x - 0.3 * s, z - 0.3 * s, x + 0.3 * s, z + 0.3 * s));
    }
    // wind-blown grass clumps around a point
    const windT = { value: 0 };
    updates.push((dt) => { windT.value += dt; });
    function grassField(cx, cz, size, count, avoid) {
      const blades = 7, pos = [], nor = [], col = [];
      for (let b = 0; b < blades; b++) { const a = rnd() * 6.28, h = 0.35 + rnd() * 0.45, w = 0.05, ox = (rnd() - 0.5) * 0.25, oz = (rnd() - 0.5) * 0.25, lean = (rnd() - 0.5) * 0.25, ca = Math.cos(a), sa = Math.sin(a);
        const v = [[-w, 0], [w, 0], [0, h]]; v.forEach(([px, py]) => { pos.push(ox + px * ca + lean * py * sa, py, oz + px * sa + lean * py * ca); nor.push(0, 1, 0); const k = py / h; col.push(0.35 + k * 0.4, 0.55 + k * 0.35, 0.2 + k * 0.15); }); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const m = new THREE.MeshStandardMaterial({ color: 0x6f8f3a, vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
      m.onBeforeCompile = (sh) => { sh.uniforms.uWind = windT; sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 wp = instanceMatrix * vec4(0.,0.,0.,1.);float sway = sin(uWind*1.7 + wp.x*0.35 + wp.z*0.27)*0.5 + sin(uWind*3.1 + wp.x*0.9)*0.2;transformed.x += sway * transformed.y * transformed.y * 0.55;transformed.z += sway * transformed.y * transformed.y * 0.25;'); };
      const im = new THREE.InstancedMesh(g, m, count); const M = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), c = new THREE.Color(); let k = 0;
      for (let i = 0; i < count * 1.5 && k < count; i++) { const x = cx + (rnd() - 0.5) * size, z = cz + (rnd() - 0.5) * size; if (avoid && avoid(x, z)) continue; const sc = 0.7 + rnd() * 0.9; M.compose(tmpV.set(x, ground(x, z) - 0.02, z), q.setFromAxisAngle(UP, rnd() * 6.28), tmpV2.set(sc, sc * (0.8 + rnd() * 0.5), sc)); im.setMatrixAt(k, M); c.setHSL(0.2 + rnd() * 0.07, 0.4 + rnd() * 0.2, 0.32 + rnd() * 0.16); im.setColorAt(k, c); k++; }
      im.count = k; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im;
    }

    function buildNature() {
      scene.fog = new THREE.FogExp2(0xbfd1e0, 0.0022);
      const S = 600, seg = Q === 'high' ? 256 : 160, water = 0.6;
      ground = (x, z) => { const d = Math.hypot(x, z), flat = sstep(20, 70, d); return (fbm(x * 0.006, z * 0.006) * 26 + fbm(x * 0.03, z * 0.03) * 2.5) * flat + 1.2 + (sstep(180, 300, d) * 40); };
      const g = new THREE.PlaneGeometry(S, S, seg, seg); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position, colors = new Float32Array(p.count * 3), c = new THREE.Color();
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = ground(x, z); p.setY(i, y); const k = clamp((y - water) / 6, 0, 1); c.setRGB(lerp(0.78, 1, k), lerp(0.72, 1, k), lerp(0.6, 0.95, k)); if (y > 22) c.lerp(new THREE.Color(0.85, 0.85, 0.85), sstep(22, 34, y)); colors.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.computeVertexNormals();
      const tm = material('grass', 260).clone(); tm.vertexColors = true;
      const terrain = new THREE.Mesh(g, tm); terrain.receiveShadow = true; scene.add(terrain);
      // lake
      const wg = new THREE.PlaneGeometry(S, S);
      let lake;
      if (X.Water) {
        const wn = TL.load(GH + 'textures/waternormals.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
        lake = new X.Water(wg, { textureWidth: Q === 'high' ? 1024 : 512, textureHeight: Q === 'high' ? 1024 : 512, waterNormals: wn, sunDirection: sunDir.clone(), sunColor: 0xffffff, waterColor: 0x0d2a33, distortionScale: 2.6, fog: true });
        updates.push((dt) => { lake.material.uniforms.time.value += dt * 0.6; lake.material.uniforms.sunDirection.value.copy(sunDir); });
      } else lake = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: 0x1d3a44, roughness: 0.08, metalness: 0.3 }));
      lake.rotation.x = -Math.PI / 2; lake.position.y = water; scene.add(lake);
      // forest + rocks
      const nT = Q === 'high' ? 650 : 300;
      for (let i = 0; i < nT; i++) { const x = (rnd() - 0.5) * S * 0.9, z = (rnd() - 0.5) * S * 0.9, y = ground(x, z); if (y < water + 0.8 || y > 26 || Math.hypot(x, z) < 12) continue; addTree(x, z, 0.8 + rnd() * 0.9); }
      const rockMat = material('rock', 1);
      for (let i = 0; i < (Q === 'high' ? 140 : 60); i++) { const x = (rnd() - 0.5) * S * 0.8, z = (rnd() - 0.5) * S * 0.8, y = ground(x, z); if (y < water) continue; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + rnd() * 2.2, 1), rockMat); r.position.set(x, y - 0.3, z); r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); r.scale.y = 0.6 + rnd() * 0.5; r.castShadow = r.receiveShadow = true; scene.add(r); }
      spawn.set(0, 0, 6);
      grassField(0, 0, 150, Q === 'high' ? 32000 : 9000, (x, z) => ground(x, z) < water + 0.4);
      say('WASD per camminare · Shift corri · Spazio salta · trascina per guardarti attorno');
    }

    function buildStudio() {
      scene.background = new THREE.Color(0x15161a);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 96), new THREE.MeshStandardMaterial({ color: 0x2a2b30, roughness: 0.35, metalness: 0.1 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
      new X.RGBELoader(manager).load(PH + 'HDRIs/hdr/1k/studio_small_08_1k.hdr', (t) => { t.mapping = THREE.EquirectangularReflectionMapping; hdrEnv = pmrem.fromEquirectangular(t).texture; scene.environment = hdrEnv; t.dispose(); }, undefined, () => { hdrEnv = pmrem.fromScene(new X.RoomEnvironment(renderer), 0.04).texture; scene.environment = hdrEnv; });
      const key = new THREE.SpotLight(0xffffff, 140, 60, 0.5, 0.6, 1.5); key.position.set(6, 10, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0002; scene.add(key);
      const rim = new THREE.SpotLight(0xbcd2ff, 60, 50, 0.6, 0.8, 1.5); rim.position.set(-8, 6, -6); scene.add(rim);
      studioMode = true; spawn.set(0, 0, 0);
      if (preset === 'studio' && !(spec.objects && spec.objects.length)) { const car = sportsCar(spec.color ? new THREE.Color(spec.color).getHex() : 0x8a0b10); car.position.y = 0.12; const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.12, 96), new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.4, metalness: 0.6 })); deck.position.y = 0.06; deck.receiveShadow = true; const turn = new THREE.Group(); turn.add(deck, car); scene.add(turn); updates.push((dt) => { turn.rotation.y += dt * 0.25; }); }
      say('Trascina per ruotare · scorri per lo zoom');
    }

    function buildCustom() {
      const sk = spec.sky || 'day';
      if (sk === 'studio') buildStudio(); else if (sk === 'space') { scene.background = new THREE.Color(0x02030a); noSky = true; }
      if (!scene.fog && spec.fog) scene.fog = new THREE.FogExp2(0xbfd1e0, 0.012);
      const A = spec.assets || {}, tex = {};
      Object.keys(A).forEach((k) => { tex[k] = TL.load(A[k], (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }); });
      if (sk !== 'studio' && sk !== 'space') {
        const g = spec.ground || {}, size = Math.max(10, +g.size || 80);
        const gm = g.texture && tex[g.texture] ? new THREE.MeshStandardMaterial({ map: tex[g.texture], roughness: 0.9 }) : g.material ? material(g.material, size / 6) : new THREE.MeshStandardMaterial({ color: g.color || 0x6b6b72, roughness: 0.95 });
        if (gm.map && g.texture) gm.map.repeat.set(+g.tiles || 8, +g.tiles || 8);
        const gp = new THREE.Mesh(new THREE.PlaneGeometry(size, size), gm); gp.rotation.x = -Math.PI / 2; gp.receiveShadow = true; scene.add(gp);
      }
      (spec.objects || []).slice(0, 64).forEach((o) => { if (!o) return; const m = addShape(o, tex); if (+o.spin) updates.push((dt) => { m.rotation.y += +o.spin * dt; }); });
      spawn.set(0, 0, 8);
      say(spec.mode === 'fps' ? 'WASD per muoverti · mouse per guardare' : 'Trascina per ruotare · scorri per lo zoom');
    }
    function addShape(o, tex) {
      const s = o.size || [], sh = o.shape || 'box'; let geo;
      if (sh === 'sphere') geo = new THREE.SphereGeometry(s[0] || 1, 64, 40);
      else if (sh === 'cylinder') geo = new THREE.CylinderGeometry(s[0] || 1, s[1] || s[0] || 1, s[2] || 2, 48);
      else if (sh === 'cone') geo = new THREE.ConeGeometry(s[0] || 1, s[1] || 2, 48);
      else if (sh === 'torus') geo = new THREE.TorusGeometry(s[0] || 1, s[1] || 0.35, 32, 96);
      else if (sh === 'plane') geo = new THREE.PlaneGeometry(s[0] || 2, s[1] || 2);
      else geo = boxUV(new THREE.BoxGeometry(s[0] || 1, s[1] || 1, s[2] || 1), s[0] || 1, s[1] || 1, s[2] || 1, 2);
      let mat;
      if (o.texture && tex && tex[o.texture]) mat = new THREE.MeshStandardMaterial({ map: tex[o.texture], roughness: o.rough == null ? 0.7 : +o.rough, metalness: o.metal == null ? 0.05 : +o.metal });
      else if (o.material) mat = material(o.material, o.repeat || 1);
      else if (o.glass) mat = new THREE.MeshPhysicalMaterial({ color: o.color || 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.5, ior: 1.5 });
      else mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(o.color || '#d9a05a'), metalness: o.metal == null ? 0.1 : +o.metal, roughness: o.rough == null ? 0.55 : +o.rough, clearcoat: o.clearcoat ? 1 : 0 });
      const mesh = new THREE.Mesh(geo, mat); const p = o.pos || [0, 1, 0]; mesh.position.set(p[0] || 0, p[1] || 0, p[2] || 0); if (o.rot) mesh.rotation.set(o.rot[0] || 0, o.rot[1] || 0, o.rot[2] || 0);
      mesh.castShadow = mesh.receiveShadow = true; if (sh === 'plane' && !o.rot) mesh.rotation.x = -Math.PI / 2; scene.add(mesh);
      if (o.collide !== false && sh !== 'plane') { const bb = new THREE.Box3().setFromObject(mesh); if (bb.max.y > 0.4) addCollider(bb.min.x, bb.min.z, bb.max.x, bb.max.z); }
      return mesh;
    }

    /* ---------- weather ---------- */
    let rain = null;
    function setWeather(w) {
      if (rain) { scene.remove(rain); rain = null; }
      if (scene.fog) scene.fog.density = (preset === 'nature' ? 0.0022 : Q === 'high' ? 0.0026 : 0.0038) * (w === 'fog' ? 5 : w === 'rain' ? 2 : 1);
      Object.values(matCache).forEach((m) => { if (!m.userData.r0) m.userData.r0 = m.roughness; m.roughness = w === 'rain' ? m.userData.r0 * 0.35 : m.userData.r0; m.envMapIntensity = w === 'rain' ? 1.6 : 1; });
      if (w === 'rain' || w === 'snow') {
        const n = Q === 'high' ? 14000 : 6000, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 6);
        for (let i = 0; i < n; i++) { const x = (rnd() - 0.5) * 120, y = rnd() * 60, z = (rnd() - 0.5) * 120; pos.set([x, y, z, x + 0.05, y - (w === 'rain' ? 0.6 : 0.08), z], i * 6); }
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: w === 'rain' ? 0x9fb3c8 : 0xffffff, transparent: true, opacity: w === 'rain' ? 0.35 : 0.8 })); rain.frustumCulled = false; rain.userData.kind = w; scene.add(rain);
      }
    }
    updates.push((dt) => { if (!rain) return; const p = rain.geometry.attributes.position, a = p.array, sp = rain.userData.kind === 'rain' ? 34 : 3, c = camera.position; for (let i = 0; i < a.length; i += 6) { a[i + 1] -= sp * dt; a[i + 4] -= sp * dt; if (a[i + 1] < c.y - 10) { a[i + 1] += 60; a[i + 4] += 60; } if (a[i] - c.x > 60) { a[i] -= 120; a[i + 3] -= 120; } else if (c.x - a[i] > 60) { a[i] += 120; a[i + 3] += 120; } if (a[i + 2] - c.z > 60) { a[i + 2] -= 120; a[i + 5] -= 120; } else if (c.z - a[i + 2] > 60) { a[i + 2] += 120; a[i + 5] += 120; } } p.needsUpdate = true; });

    /* ---------- post-processing ---------- */
    let composer = null;
    try {
      const rt = new THREE.WebGLRenderTarget(innerWidth * PR, innerHeight * PR, { type: THREE.HalfFloatType, samples: Q === 'high' ? 4 : 0 });
      composer = new X.EffectComposer(renderer, rt);
      composer.addPass(new X.RenderPass(scene, camera));
      if (Q === 'high' && X.GTAOPass && spec.ao !== false) { const ao = new X.GTAOPass(scene, camera, innerWidth, innerHeight); ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.1 }); ao.blendIntensity = 0.85; composer.addPass(ao); }
      composer.addPass(new X.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.5, 0.88));
      composer.addPass(new X.OutputPass());
      if (Q !== 'high' && X.SMAAPass) composer.addPass(new X.SMAAPass(innerWidth * PR, innerHeight * PR));
    } catch (e) { console.warn('post-processing non disponibile', e); composer = null; }

    /* ---------- player & controls ---------- */
    const mode = spec.player || (preset === 'studio' || (preset === 'custom' && spec.mode !== 'fps') ? 'orbit' : spec.mode === 'fps' ? 'fps' : 'third_person');
    const player = character({ x: 0, z: 0 });
    const keys = {}, look = { yaw: Math.PI, pitch: 0.28, dist: 6.5 }, drive = { car: null };
    addEventListener('keydown', (e) => { keys[e.code] = true; if (e.code === 'KeyE' || e.code === 'KeyF') toggleCar(); if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); });
    addEventListener('keyup', (e) => { keys[e.code] = false; });
    let orbit = null, plc = null;
    if (mode === 'orbit') { orbit = new X.OrbitControls(camera, renderer.domElement); orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * 0.49; camera.position.set(6, 4, 8); orbit.target.set(0, 1, 0); player.obj.visible = false; }
    else if (mode === 'fps') { plc = new X.PointerLockControls(camera, renderer.domElement); renderer.domElement.addEventListener('click', () => plc.lock()); player.obj.visible = false; }
    else {
      let drag = null;
      renderer.domElement.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45) return; drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
      addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; look.yaw -= (e.clientX - drag.x) * 0.005; look.pitch = clamp(look.pitch + (e.clientY - drag.y) * 0.004, -0.2, 1.2); drag.x = e.clientX; drag.y = e.clientY; });
      addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) drag = null; });
      renderer.domElement.addEventListener('wheel', (e) => { look.dist = clamp(look.dist + e.deltaY * 0.01, 2.5, 18); }, { passive: true });
    }
    // touch joystick + buttons
    const joy = { x: 0, y: 0 }, isTouch = matchMedia('(pointer: coarse)').matches;
    if (isTouch && mode !== 'orbit') {
      const pad = document.createElement('div'); pad.className = 'joy'; const knob = document.createElement('i'); pad.appendChild(knob); document.body.appendChild(pad);
      let jid = null, c0 = null;
      pad.addEventListener('pointerdown', (e) => { jid = e.pointerId; const r = pad.getBoundingClientRect(); c0 = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; pad.setPointerCapture(e.pointerId); });
      pad.addEventListener('pointermove', (e) => { if (e.pointerId !== jid) return; let dx = (e.clientX - c0.x) / 50, dy = (e.clientY - c0.y) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } joy.x = dx; joy.y = dy; knob.style.transform = 'translate(' + dx * 34 + 'px,' + dy * 34 + 'px)'; });
      const end = () => { jid = null; joy.x = joy.y = 0; knob.style.transform = ''; }; pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
      const btns = document.createElement('div'); btns.className = 'tbtns';
      [['Salta', () => { keys.Space = true; setTimeout(() => { keys.Space = false; }, 120); }], ['Corri', (b) => { keys.ShiftLeft = !keys.ShiftLeft; b.classList.toggle('on', keys.ShiftLeft); }], ['Auto', () => toggleCar()]].forEach(([t, fn]) => { const b = document.createElement('button'); b.textContent = t; b.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(b); }); btns.appendChild(b); });
      document.body.appendChild(btns);
    }
    function toggleCar() {
      if (drive.car) { const c = drive.car; player.obj.visible = true; player.obj.position.copy(c.mesh.position).add(tmpV.set(Math.cos(c.mesh.rotation.y + Math.PI / 2) * 2.4, 0, -Math.sin(c.mesh.rotation.y + Math.PI / 2) * 2.4)); c.parked = true; c.speed = 0; drive.car = null; return; }
      let best = null, bd = 9; for (const c of cars) { const d = c.mesh.position.distanceTo(player.obj.position); if (d < bd) { bd = d; best = c; } }
      if (best) { drive.car = best; best.parked = true; best.v = 0; player.obj.visible = false; look.dist = 9; }
    }
    function stepPlayer(dt) {
      const p = player.obj.position;
      if (drive.car) {
        const c = drive.car, m = c.mesh, f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y, st = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0) - joy.x;
        c.v += f * (f * c.v < 0 ? 22 : 9) * dt; c.v *= 1 - (f ? 0.15 : 0.9) * dt; c.v = clamp(c.v, -10, 48);
        c.steer = lerp(c.steer, clamp(st, -1, 1) * 0.55, 1 - Math.exp(-6 * dt));
        m.rotation.y += c.steer * c.v * dt * 0.22;
        const fx = Math.cos(m.rotation.y), fz = -Math.sin(m.rotation.y);
        m.position.x += fx * c.v * dt; m.position.z += fz * c.v * dt;
        if (pushOut(m.position, 1.3)) c.v *= -0.25;
        m.position.y = ground(m.position.x, m.position.z);
        spinWheels(c, c.v * dt); (m.userData.wheels || []).slice(0, 2).forEach((w) => { w.rotation.y = c.steer * 0.8; });
        p.copy(m.position); if (hud) hud.textContent = Math.round(Math.abs(c.v) * 3.6) + ' km/h';
        look.yaw += angDiff(m.rotation.y + Math.PI * 1.5, look.yaw) * (1 - Math.exp(-2.5 * dt));
        return;
      }
      if (mode === 'orbit') return;
      const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y, side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
      const run = keys.ShiftLeft || keys.ShiftRight, sp = run ? 6.2 : 2.4, mv = Math.hypot(fwd, side);
      let yaw = look.yaw;
      if (mode === 'fps') { tmpV.set(0, 0, -1).applyQuaternion(camera.quaternion); yaw = Math.atan2(-tmpV.x, -tmpV.z); }
      if (mv > 0.05) {
        const a = yaw + Math.atan2(-side, fwd); const vx = -Math.sin(a) * sp * Math.min(1, mv), vz = -Math.cos(a) * sp * Math.min(1, mv);
        p.x += vx * dt; p.z += vz * dt; player.yaw = Math.atan2(vx, vz);
        player.obj.rotation.y += angDiff(player.yaw, player.obj.rotation.y) * (1 - Math.exp(-10 * dt));
      }
      pushOut(p, 0.4);
      const gy = ground(p.x, p.z);
      if ((keys.Space) && player.ground) { player.vy = 5.2; player.ground = false; }
      player.vy -= 14 * dt; p.y += player.vy * dt; if (p.y <= gy) { p.y = gy; player.vy = 0; player.ground = true; }
      player.play(!player.ground ? 'Run' : mv > 0.05 ? (run ? 'Run' : 'Walk') : 'Idle');
      if (player.obj.children[0] && player.obj.children[0].userData.prim) player.obj.children[0].position.y = mv > 0.05 ? Math.abs(Math.sin(performance.now() / 120)) * 0.08 : 0;
      if (hud) hud.textContent = '';
    }
    function stepCamera(dt) {
      if (orbit) { orbit.update(); return; }
      const p = player.obj.position;
      if (mode === 'fps' && !drive.car) { camera.position.set(p.x, p.y + 1.65, p.z); return; }
      const d = look.dist, cy = Math.cos(look.pitch);
      const target = tmpV2.set(p.x, p.y + (drive.car ? 1.6 : 1.55), p.z);
      const want = tmpV.set(target.x + Math.sin(look.yaw) * d * cy, target.y + Math.sin(look.pitch) * d, target.z + Math.cos(look.yaw) * d * cy);
      want.y = Math.max(want.y, ground(want.x, want.z) + 0.4);
      camera.position.lerp(want, 1 - Math.exp(-10 * dt)); camera.lookAt(target);
    }

    /* ---------- public API (for custom code) ---------- */
    const E = {
      THREE, scene, camera, renderer, spec, player,
      material, setTime, setWeather, addTree, addCollider, ground: (x, z) => ground(x, z),
      addBox: (o) => addShape(Object.assign({ shape: 'box' }, o)), addSphere: (o) => addShape(Object.assign({ shape: 'sphere' }, o)), addCylinder: (o) => addShape(Object.assign({ shape: 'cylinder' }, o)), addShape: (o) => addShape(o),
      addMesh(geo, mat, pos) { const m = new THREE.Mesh(geo, mat); if (pos) m.position.set(pos[0] || 0, pos[1] || 0, pos[2] || 0); m.castShadow = m.receiveShadow = true; scene.add(m); return m; },
      addModel(url, o) { o = o || {}; return new Promise((res, rej) => gltf.load(url, (g) => { const m = g.scene; m.traverse((n) => { if (n.isMesh) { n.castShadow = n.receiveShadow = true; } }); const p = o.pos || [0, 0, 0]; m.position.set(p[0], p[1], p[2]); if (o.scale) m.scale.setScalar(o.scale); if (o.rotY) m.rotation.y = o.rotY; scene.add(m); if (g.animations.length) { const mx = new THREE.AnimationMixer(m); mx.clipAction(g.animations[o.anim || 0]).play(); updates.push((dt) => mx.update(dt)); } res(m); }, undefined, rej)); },
      addCharacter(o) { o = o || {}; const p = o.pos || [0, 0, 0]; const c = character({ x: p[0], z: p[2] }); c.obj.position.y = ground(p[0], p[2]); if (o.path) { c.path = o.path; c.k = 0; c.walk = o.speed || 1.4; npcs.push(c); } else setTimeout(() => c.play(o.anim || 'Idle'), 50); return c; },
      addCar(o) { o = o || {}; const p = o.pos || [0, 0, 0]; const col = o.color != null ? new THREE.Color(o.color).getHex() : CAR_COLORS[cars.length % CAR_COLORS.length]; const m = o.model === 'sedan' ? carMesh(col) : sportsCar(col); m.position.set(p[0], ground(p[0], p[2]), p[2]); m.rotation.y = o.rotY || 0; scene.add(m); const c = { mesh: m, parked: true, speed: 0, v: 0, steer: 0 }; cars.push(c); return c; },
      addLight(o) { o = o || {}; const l = o.type === 'spot' ? new THREE.SpotLight(o.color || 0xffffff, o.intensity || 60, o.distance || 40, o.angle || 0.6, 0.5, 1.5) : new THREE.PointLight(o.color || 0xffffff, o.intensity || 20, o.distance || 25, 1.6); const p = o.pos || [0, 4, 0]; l.position.set(p[0], p[1], p[2]); l.castShadow = !!o.shadow; scene.add(l); return l; },
      onUpdate(fn) { updates.push(fn); },
      say
    };
    window.E = E;

    /* ---------- build ---------- */
    if (preset === 'nature') buildNature(); else if (preset === 'studio') { buildStudio(); if (spec.objects) (spec.objects || []).slice(0, 64).forEach((o) => o && addShape(o, {})); } else if (preset === 'custom') buildCustom(); else buildCity();
    flushTrees();
    const T0 = { day: 13, morning: 9, noon: 13, afternoon: 16, sunset: 19.35, golden: 18.9, dusk: 19.9, night: 23, midnight: 0, dawn: 6.4 };
    setTime(typeof spec.time_of_day === 'number' ? spec.time_of_day : T0[spec.time_of_day] != null ? T0[spec.time_of_day] : spec.sky === 'sunset' ? 19.2 : spec.sky === 'night' ? 23 : 13);
    setWeather(spec.weather || (spec.fog ? 'fog' : 'clear'));
    player.obj.position.copy(spawn); player.obj.position.y = ground(spawn.x, spawn.z);
    if (spec.player === 'car' && cars.length) { const c = cars.reduce((a, b) => (a.mesh.position.distanceTo(spawn) < b.mesh.position.distanceTo(spawn) ? a : b)); player.obj.position.copy(c.mesh.position); toggleCar(); }
    if (spec.custom_code) { try { new Function('E', 'THREE', spec.custom_code)(E, THREE); } catch (e) { console.error(e); say('Errore nel codice personalizzato: ' + e.message); } }

    addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); if (composer) composer.setSize(innerWidth, innerHeight); });
    const clock = new THREE.Clock();
    let first = true, cycleT = 0;
    renderer.setAnimationLoop(() => {
      const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
      if (spec.day_cycle) { cycleT += dt; if (cycleT > 0.25) { setTime(timeH + cycleT * 24 / (+spec.day_cycle || 240)); cycleT = 0; } }
      stepPlayer(dt);
      if (player.mixer) player.mixer.update(dt);
      npcs.forEach((n) => n.mixer && n.mixer.update(dt));
      for (const f of updates) f(dt, t);
      stepCamera(dt);
      // shadows follow the action
      const fp = player.obj.position; sun.target.position.copy(fp); sun.position.copy(fp).addScaledVector(sunDir, 160); sun.target.updateMatrixWorld();
      if (composer) composer.render(dt); else renderer.render(scene, camera);
      if (first) { first = false; setTimeout(() => { if (load) load.classList.add('gone'); }, 600); }
    });
    setTimeout(() => { if (load) load.classList.add('gone'); }, 12000);
    return E;
  }

  /* ---------------- page builder ---------------- */
  const ADDONS = [
    ['OrbitControls', 'controls/OrbitControls.js'], ['PointerLockControls', 'controls/PointerLockControls.js'], ['GLTFLoader', 'loaders/GLTFLoader.js'], ['RGBELoader', 'loaders/RGBELoader.js'],
    ['EffectComposer', 'postprocessing/EffectComposer.js'], ['RenderPass', 'postprocessing/RenderPass.js'], ['UnrealBloomPass', 'postprocessing/UnrealBloomPass.js'], ['OutputPass', 'postprocessing/OutputPass.js'], ['SMAAPass', 'postprocessing/SMAAPass.js'], ['GTAOPass', 'postprocessing/GTAOPass.js'],
    ['DRACOLoader', 'loaders/DRACOLoader.js'], ['Sky', 'objects/Sky.js'], ['Water', 'objects/Water.js'], ['RoomEnvironment', 'environments/RoomEnvironment.js']
  ];
  const esc = (s) => String(s || '').replace(/[<>&]/g, '');
  function buildHTML(spec) {
    spec = Object.assign({}, spec || {});
    const data = JSON.stringify(spec).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, ' ');
    const title = esc(spec.title || 'Thorion Engine');
    return '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">'
      + '<title>' + title + '</title><style>html,body{margin:0;height:100%;overflow:hidden;background:#07080b;font-family:system-ui,-apple-system,Segoe UI,sans-serif;touch-action:none}#c{display:block;width:100%;height:100%}'
      + '#hint{position:fixed;left:14px;bottom:14px;max-width:calc(100% - 28px);color:#fff;font-size:12.5px;background:rgba(0,0,0,.45);padding:7px 11px;border-radius:10px;pointer-events:none;backdrop-filter:blur(6px)}'
      + '#hud{position:fixed;right:14px;top:12px;color:#fff;font:700 18px system-ui;text-shadow:0 1px 6px #000}#tt{position:fixed;left:14px;top:12px;color:#fff;font:700 14px system-ui;letter-spacing:.02em;text-shadow:0 1px 6px #000;opacity:.9}'
      + '#load{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#07080b;color:#f3d088;transition:opacity .8s;z-index:5}#load b{font:800 22px system-ui;letter-spacing:.04em}#load small{color:#cfc6b8}#load.gone{opacity:0;pointer-events:none}'
      + '.joy{position:fixed;left:22px;bottom:70px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);touch-action:none;z-index:3}.joy i{position:absolute;left:38px;top:38px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.55)}'
      + '.tbtns{position:fixed;right:16px;bottom:70px;display:flex;flex-direction:column;gap:10px;z-index:3}.tbtns button{width:64px;height:64px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.35);color:#fff;font:600 12px system-ui}.tbtns button.on{background:rgba(243,208,136,.55)}</style></head>'
      + '<body><canvas id="c"></canvas><div id="tt">' + title + '</div><div id="hud"></div><div id="hint"></div><div id="load"><b>THORION ENGINE</b><small>Preparo il mondo…</small></div>'
      + '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@' + THREE_V + '/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@' + THREE_V + '/examples/jsm/"}}</' + 'script>'
      + '<script type="module">\nimport * as THREE from "three";\n' + ADDONS.map(([n, p]) => 'import { ' + n + ' } from "three/addons/' + p + '";').join('\n') + '\nimport * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";\n'
      + 'const X = { ' + ADDONS.map(([n]) => n).join(', ') + ', SkeletonUtils };\n'
      + 'const ThorionEngine = ' + ThorionEngine.toString() + ';\n'
      + 'try { ThorionEngine(THREE, X, ' + data + '); } catch (e) { console.error(e); document.getElementById("hint").textContent = "Errore: " + e.message; document.getElementById("load").classList.add("gone"); }\n'
      + '</' + 'script></body></html>';
  }

  B.engine = {
    buildHTML,
    presets: ['open_world_city', 'nature', 'studio', 'custom'],
    docs: 'Thorion Engine (three.js 0.160, realistico): preset open_world_city (città con traffico, pedoni, auto guidabili), nature (terreno, lago, foresta), studio (vetrina prodotto con luce HDR), custom (oggetti). ' +
      'Opzioni: time_of_day (dawn|morning|noon|afternoon|golden|sunset|dusk|night o ore 0-24), day_cycle (secondi per un giorno intero), weather (clear|rain|fog|snow), player (third_person|fps|orbit|car), quality (high|medium). ' +
      'custom_code: JavaScript eseguito con E e THREE dopo la costruzione del mondo. API: E.scene, E.camera, E.player.obj, E.material(nome, ripetizione) con nomi asphalt|concrete|sidewalk|grass|forest|rock|sand|wood|marble|metal|plaster|cobble|bark|brick|tiles (texture PBR reali), ' +
      'E.addBox({pos:[x,y,z],size:[w,h,d],material|color,metal,rough}), E.addSphere, E.addCylinder, E.addMesh(geo,mat,pos), E.addModel(urlGLB,{pos,scale,rotY}) -> Promise, E.addCharacter({pos,path:[[x,z],...],speed}), E.addCar({pos,color,rotY,model:"sports"|"sedan"}) (sports = supercar realistica guidabile con E), E.addTree(x,z,scala), ' +
      'E.addLight({type:"point"|"spot",pos,color,intensity}), E.setTime(ore), E.setWeather(w), E.ground(x,z) altezza del terreno, E.addCollider(x0,z0,x1,z1), E.onUpdate((dt,t)=>{…}), E.say(testo).'
  };
})();
