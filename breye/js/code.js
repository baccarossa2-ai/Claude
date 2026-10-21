/* Code Studio — editor, live preview, console, AI pair programmer */
(function () {
  'use strict';
  const B = window.B;

  const TEMPLATES = {
    blank: { name: 'Vuoto', files: { 'index.html': '<!doctype html>\n<html lang="it">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Nuovo progetto</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Ciao da Thorion!</h1>\n  <script src="script.js"></script>\n</body>\n</html>\n', 'style.css': 'body {\n  font-family: system-ui, sans-serif;\n  background: #f6eee2;\n  color: #22140b;\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n  margin: 0;\n}\n', 'script.js': "console.log('Pronto!');\n" } },
    landing: { name: 'Landing page', files: { 'index.html': '<!doctype html>\n<html lang="it">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Ambra · Torrefazione</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <header class="nav"><b>Ambra</b><nav><a href="#caffe">Caffè</a><a href="#storia">Storia</a><a class="cta" href="#ordina">Ordina</a></nav></header>\n  <main>\n    <section class="hero">\n      <p class="eyebrow">Torrefazione artigianale dal 1987</p>\n      <h1>Il caffè che <em>si guarda</em> negli occhi.</h1>\n      <p>Miscele tostate a mano, consegnate fresche ogni settimana.</p>\n      <button id="btn">Scopri le miscele</button>\n    </section>\n    <section id="caffe" class="grid">\n      <article><h3>Espresso Bruno</h3><p>Cioccolato fondente e nocciola.</p><span>€ 14</span></article>\n      <article><h3>Ambra Dolce</h3><p>Caramello, miele e mandorla.</p><span>€ 16</span></article>\n      <article><h3>Iride Rara</h3><p>Monorigine Etiopia, floreale.</p><span>€ 19</span></article>\n    </section>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>\n', 'style.css': ':root { --bg:#120a06; --fg:#f6ead9; --gold:#e3a94a; }\n* { box-sizing: border-box; }\nbody { margin:0; font-family: system-ui, sans-serif; background: radial-gradient(circle at 80% 0%, #3b2314, var(--bg) 60%); color: var(--fg); min-height:100vh; }\n.nav { display:flex; justify-content:space-between; align-items:center; padding:20px 6vw; }\n.nav nav { display:flex; gap:24px; align-items:center; }\n.nav a { color:var(--fg); text-decoration:none; opacity:.8; }\n.nav .cta { background:var(--gold); color:#1a0f08; padding:8px 16px; border-radius:30px; opacity:1; font-weight:700; }\n.hero { padding:12vh 6vw 8vh; max-width:900px; }\n.eyebrow { color:var(--gold); letter-spacing:.2em; text-transform:uppercase; font-size:12px; font-weight:700; }\nh1 { font-size:clamp(40px,7vw,84px); line-height:1; margin:.2em 0; }\nh1 em { color:var(--gold); }\nbutton { background:var(--gold); border:0; padding:14px 26px; border-radius:40px; font-weight:700; font-size:16px; cursor:pointer; transition:transform .2s; }\nbutton:hover { transform:translateY(-2px); }\n.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:18px; padding:0 6vw 10vh; }\narticle { background:rgba(255,255,255,.05); border:1px solid rgba(227,169,74,.25); border-radius:20px; padding:24px; transition:transform .3s; }\narticle:hover { transform:translateY(-6px); }\narticle span { color:var(--gold); font-weight:800; }\n', 'script.js': "document.getElementById('btn').addEventListener('click', () => {\n  document.getElementById('caffe').scrollIntoView({ behavior: 'smooth' });\n});\nconsole.log('Landing pronta');\n" } },
    todo: { name: 'App To-do', files: { 'index.html': '<!doctype html>\n<html lang="it">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>To-do</title><link rel="stylesheet" href="style.css"></head>\n<body>\n  <main class="app">\n    <h1>Le mie attività</h1>\n    <form id="f"><input id="t" placeholder="Nuova attività…" autocomplete="off"><button>Aggiungi</button></form>\n    <ul id="list"></ul>\n    <p id="count"></p>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>\n', 'style.css': 'body{margin:0;font-family:system-ui,sans-serif;background:#f6eee2;color:#22140b;display:grid;place-items:start center;min-height:100vh}\n.app{width:min(480px,92vw);margin-top:8vh;background:#fffaf3;border-radius:22px;padding:28px;box-shadow:0 20px 50px rgba(74,44,20,.15)}\nform{display:flex;gap:8px}input{flex:1;padding:12px 14px;border-radius:12px;border:1px solid #e1cdb2;font-size:15px}\nbutton{background:#b5741d;color:#fff;border:0;border-radius:12px;padding:0 16px;font-weight:700;cursor:pointer}\nul{list-style:none;padding:0}li{display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid #f0e4d2}\nli.done span{text-decoration:line-through;opacity:.5}li button{margin-left:auto;background:none;color:#a3621a;font-size:18px}\n', 'script.js': "const list = document.getElementById('list');\nconst items = JSON.parse(localStorage.getItem('todo') || '[]');\nfunction save(){ localStorage.setItem('todo', JSON.stringify(items)); render(); }\nfunction render(){\n  list.innerHTML = '';\n  items.forEach((it, i) => {\n    const li = document.createElement('li');\n    li.className = it.done ? 'done' : '';\n    li.innerHTML = `<input type=\"checkbox\" ${it.done ? 'checked' : ''}><span></span><button aria-label=\"Elimina\">×</button>`;\n    li.querySelector('span').textContent = it.text;\n    li.querySelector('input').onchange = () => { it.done = !it.done; save(); };\n    li.querySelector('button').onclick = () => { items.splice(i, 1); save(); };\n    list.append(li);\n  });\n  document.getElementById('count').textContent = items.filter(i => !i.done).length + ' da fare';\n}\ndocument.getElementById('f').onsubmit = (e) => { e.preventDefault(); const t = document.getElementById('t'); if (!t.value.trim()) return; items.push({ text: t.value.trim(), done: false }); t.value=''; save(); };\nrender();\n" } },
    game: { name: 'Gioco Snake', files: { 'index.html': '<!doctype html>\n<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Snake</title><link rel="stylesheet" href="style.css"></head>\n<body><h1>Snake · <span id="score">0</span></h1><canvas id="c" width="400" height="400"></canvas><p>Frecce per muoverti, spazio per ricominciare</p><script src="script.js"></script></body></html>\n', 'style.css': 'body{margin:0;background:#120a06;color:#f3d088;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh}\ncanvas{background:#1d120b;border-radius:16px;box-shadow:0 0 40px rgba(227,169,74,.25);max-width:92vw}\n', 'script.js': "const c = document.getElementById('c'), x = c.getContext('2d'), N = 20, S = c.width / N;\nlet snake, dir, food, score, alive;\nfunction reset(){ snake=[{x:10,y:10}]; dir={x:1,y:0}; food=spawn(); score=0; alive=true; }\nfunction spawn(){ return {x:Math.floor(Math.random()*N), y:Math.floor(Math.random()*N)}; }\naddEventListener('keydown', e => { const k={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key]; if(k && (k[0]!==-dir.x || k[1]!==-dir.y)) dir={x:k[0],y:k[1]}; if(e.code==='Space' && !alive) reset(); });\nfunction step(){\n  if(alive){ const h={x:(snake[0].x+dir.x+N)%N, y:(snake[0].y+dir.y+N)%N};\n    if(snake.some(s=>s.x===h.x&&s.y===h.y)) alive=false; else { snake.unshift(h); if(h.x===food.x&&h.y===food.y){ score++; food=spawn(); } else snake.pop(); } }\n  x.fillStyle='#1d120b'; x.fillRect(0,0,c.width,c.height);\n  x.fillStyle='#e3a94a'; x.beginPath(); x.arc(food.x*S+S/2, food.y*S+S/2, S/2.4, 0, 7); x.fill();\n  snake.forEach((s,i)=>{ x.fillStyle = i? '#a8642a':'#f3d088'; x.fillRect(s.x*S+1, s.y*S+1, S-2, S-2); });\n  document.getElementById('score').textContent = score;\n  if(!alive){ x.fillStyle='rgba(0,0,0,.6)'; x.fillRect(0,0,c.width,c.height); x.fillStyle='#f3d088'; x.font='bold 28px system-ui'; x.textAlign='center'; x.fillText('Game over', c.width/2, c.height/2); }\n}\nreset(); setInterval(step, 110);\n" } },
    dashboard: { name: 'Dashboard', files: { 'index.html': '<!doctype html>\n<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dashboard</title><link rel="stylesheet" href="style.css"></head>\n<body><main><h1>Vendite settimanali</h1><div class="kpis"><div><small>Ordini</small><b id="k1">0</b></div><div><small>Incasso</small><b id="k2">0</b></div><div><small>Clienti nuovi</small><b id="k3">0</b></div></div><canvas id="chart" width="800" height="320"></canvas></main><script src="script.js"></script></body></html>\n', 'style.css': 'body{margin:0;font-family:system-ui,sans-serif;background:#f6eee2;color:#22140b}main{max-width:900px;margin:0 auto;padding:32px 20px}\n.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}.kpis div{background:#fffaf3;border-radius:16px;padding:16px;box-shadow:0 8px 20px rgba(74,44,20,.08)}\n.kpis small{color:#8a705a}.kpis b{display:block;font-size:30px}canvas{width:100%;background:#fffaf3;border-radius:16px}\n', 'script.js': "const data=[120,180,150,220,260,240,310], days=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];\nconst c=document.getElementById('chart'), x=c.getContext('2d'), W=c.width, H=c.height, max=Math.max(...data)*1.2;\nfunction anim(k,v){ let t=0; const el=document.getElementById(k); const iv=setInterval(()=>{ t+=v/30; el.textContent=Math.round(Math.min(t,v)).toLocaleString('it-IT'); if(t>=v) clearInterval(iv); },20); }\nanim('k1',data.reduce((a,b)=>a+b)); anim('k2',data.reduce((a,b)=>a+b)*14); anim('k3',87);\ndata.forEach((v,i)=>{ const bw=W/data.length*0.6, xx=i*W/data.length+bw/3, h=v/max*(H-40); const g=x.createLinearGradient(0,H-h,0,H); g.addColorStop(0,'#e3a94a'); g.addColorStop(1,'#a8642a'); x.fillStyle=g; x.fillRect(xx,H-20-h,bw,h); x.fillStyle='#5d4230'; x.font='14px system-ui'; x.fillText(days[i],xx+bw/4,H-4); });\n" } }
  };

  const CONSOLE_HOOK = '<script>(function(){var send=function(t,a){try{parent.postMessage({breye:1,t:t,a:[].map.call(a,function(x){try{return typeof x==="object"?JSON.stringify(x):String(x)}catch(e){return String(x)}})},"*")}catch(e){}};["log","info","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){send(k,arguments);o.apply(console,arguments)}});addEventListener("error",function(e){send("error",[e.message+" (riga "+e.lineno+")"])});addEventListener("unhandledrejection",function(e){send("error",["Promise: "+(e.reason&&e.reason.message||e.reason)])});})();<\/script>';

  B.view('code', {
    title: 'Code Studio', icon: 'Code2', group: 'studio', desc: 'Scrivi e prova codice con l’AI',
    mount(el) {
      const st = { files: JSON.parse(JSON.stringify(TEMPLATES.landing.files)), cur: 'index.html', name: 'Il mio progetto', id: null, auto: true, device: 'desktop', logs: [] };
      let cm = null;
      el.classList.add('code-view');
      const nameIn = B.h('input', { id: 'cdName', value: st.name, 'aria-label': 'Nome progetto' });
      nameIn.addEventListener('change', () => (st.name = nameIn.value));
      const runB = B.h('button', { class: 'btn gold', type: 'button', onclick: () => run() }, B.h('span', { 'data-i': 'Play' }), 'Esegui');
      const autoT = B.h('label', { class: 'row', style: 'gap:6px;font-size:12.5px;color:var(--text-2)' }, B.h('span', { class: 'switch' }, B.h('input', { type: 'checkbox', checked: true, onchange: (e) => (st.auto = e.target.checked) }), B.h('span')), 'Auto');
      const bar = B.h('div', { class: 'bar' }, B.h('div', { class: 'bar-title' }, B.h('span', { class: 'bt-ic', 'data-i': 'Code2' }), nameIn),
        B.h('button', { class: 'btn', type: 'button', onclick: (e) => tplMenu(e.currentTarget) }, B.h('span', { 'data-i': 'LayoutTemplate' }), 'Modelli'),
        B.h('div', { class: 'bar-sp' }), autoT, runB,
        B.h('button', { class: 'btn', type: 'button', onclick: () => saveProject() }, B.h('span', { 'data-i': 'Save' }), 'Salva'),
        B.h('button', { class: 'btn', type: 'button', onclick: (e) => dlMenu(e.currentTarget) }, B.h('span', { 'data-i': 'Download' }), 'Scarica'));
      const fileList = B.h('div', { class: 'cd-files' });
      const side = B.h('aside', { class: 'cd-side' }, B.h('div', { class: 'row', style: 'justify-content:space-between' }, B.h('span', { class: 'lbl', text: 'File' }), B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Nuovo file', 'data-i': 'FilePlus', onclick: newFile })), fileList);
      const edHost = B.h('div', { class: 'cd-editor' });
      const edWrap = B.h('div', { class: 'cd-edwrap' }, edHost);
      const frame = B.h('iframe', { class: 'cd-frame', title: 'Anteprima', sandbox: 'allow-scripts allow-modals allow-forms allow-popups allow-pointer-lock' });
      const devSeg = B.h('div', { class: 'seg' });
      [['desktop', 'Monitor'], ['tablet', 'Laptop'], ['mobile', 'Smartphone']].forEach(([k, ic]) => devSeg.append(B.h('button', { type: 'button', class: k === st.device ? 'on' : '', 'aria-label': k, 'data-k': k, onclick: () => { st.device = k; B.$$('button', devSeg).forEach((b) => b.classList.toggle('on', b.dataset.k === k)); frameBox.dataset.dev = k; } }, B.h('span', { 'data-i': ic }))));
      const frameBox = B.h('div', { class: 'cd-framebox', 'data-dev': 'desktop' }, frame);
      const cons = B.h('div', { class: 'cd-console scroll' });
      const consHead = B.h('div', { class: 'cd-chead' }, B.h('span', { 'data-i': 'Terminal' }), B.h('b', { text: 'Console' }), B.h('span', { class: 'cd-errs badge', hidden: true }), B.h('div', { class: 'bar-sp' }), B.h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { st.logs = []; paintCons(); } }, 'Pulisci'));
      const preview = B.h('div', { class: 'cd-preview' }, B.h('div', { class: 'cd-phead' }, B.h('span', { class: 'lbl', text: 'Anteprima dal vivo' }), B.h('div', { class: 'bar-sp' }), devSeg), frameBox, consHead, cons);
      /* AI dock */
      const aiIn = B.h('textarea', { class: 'textarea', id: 'cdAi', rows: 2, placeholder: 'Chiedi a Thorion: “crea un sito per un fotografo”, “aggiungi la modalità scura”, “perché il bottone non funziona?”' });
      const aiOut = B.h('div', { class: 'cd-aiout md scroll' });
      const aiSend = B.h('button', { class: 'btn gold', type: 'button', onclick: () => askAI(aiIn.value) }, B.h('span', { 'data-i': 'Sparkles' }), 'Invia');
      const quick = B.h('div', { class: 'chips' });
      [['Genera da zero', 'Crea un progetto web completo: '], ['Correggi errori', '!fix'], ['Spiega il codice', '!explain'], ['Migliora il design', 'Migliora l’aspetto grafico: più moderno, animazioni curate, responsive, mantenendo le funzioni.'], ['Aggiungi commenti', '!comment'], ['Rendi responsive', 'Rendi il progetto perfettamente responsive per telefono, tablet e desktop.']].forEach(([l, p]) => quick.append(B.h('button', { class: 'chip', type: 'button', onclick: () => { if (p.startsWith('!')) askAI(p); else { aiIn.value = p; aiIn.focus(); } } }, l)));
      const ai = B.h('div', { class: 'cd-ai' }, B.h('div', { class: 'ai-h' }, B.h('span', { 'data-i': 'Bot' }), 'Thorion · programmatrice'), aiOut, quick, B.h('div', { class: 'row', style: 'align-items:flex-end' }, aiIn, aiSend));
      el.append(bar, B.h('div', { class: 'cd-body' }, side, B.h('div', { class: 'cd-mid' }, edWrap, ai), preview));
      aiIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAI(aiIn.value); } });

      window.addEventListener('message', (e) => { const d = e.data; if (!d || !d.breye || e.source !== frame.contentWindow) return; st.logs.push({ t: d.t, m: d.a.join(' ') }); if (st.logs.length > 300) st.logs.shift(); paintCons(); });
      function paintCons() {
        cons.innerHTML = '';
        st.logs.forEach((l) => cons.append(B.h('div', { class: 'cl ' + l.t, text: l.m })));
        const errs = st.logs.filter((l) => l.t === 'error').length; const b = B.$('.cd-errs', consHead); b.hidden = !errs; b.textContent = errs + ' errori'; b.className = 'cd-errs badge err';
        cons.scrollTop = cons.scrollHeight;
      }
      const modeOf = (n) => /\.html?$/.test(n) ? 'htmlmixed' : /\.css$/.test(n) ? 'css' : /\.(js|mjs|json|ts)$/.test(n) ? 'javascript' : /\.py$/.test(n) ? 'python' : /\.md$/.test(n) ? 'markdown' : 'text/plain';
      function paintFiles() {
        fileList.innerHTML = '';
        Object.keys(st.files).forEach((n) => fileList.append(B.h('div', { class: 'cd-file' + (n === st.cur ? ' on' : ''), onclick: () => openFile(n) },
          B.h('span', { 'data-i': /html/.test(n) ? 'FileCode' : /css/.test(n) ? 'Palette' : /js/.test(n) ? 'Braces' : 'FileText' }), B.h('span', { class: 'cd-fn', text: n }),
          n !== 'index.html' ? B.h('button', { class: 'btn icon ghost sm', type: 'button', 'aria-label': 'Elimina ' + n, 'data-i': 'X', onclick: (e) => { e.stopPropagation(); delete st.files[n]; if (st.cur === n) st.cur = 'index.html'; openFile(st.cur); } }) : null)));
        B.hydrateIcons(fileList);
      }
      function openFile(n) {
        if (cm && st.files[st.cur] !== undefined) st.files[st.cur] = cm.getValue();
        st.cur = n; paintFiles();
        if (cm) { cm.setOption('mode', modeOf(n)); cm.setValue(st.files[n] || ''); cm.clearHistory(); }
      }
      async function newFile() { const n = await B.prompt('Nome del nuovo file', 'nuovo.js'); if (!n || st.files[n]) return; st.files[n] = ''; openFile(n); }
      function bundle() {
        if (cm) st.files[st.cur] = cm.getValue();
        let html = st.files['index.html'] || '<!doctype html><html><body></body></html>';
        html = html.replace(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi, (m, f) => st.files[f] != null ? '<style>\n' + st.files[f] + '\n</style>' : m);
        html = html.replace(/<script([^>]*)src=["']([^"']+\.js)["']([^>]*)><\/script>/gi, (m, a, f, b) => st.files[f] != null ? '<script' + a + b + '>\n' + st.files[f].replace(/<\/script>/gi, '<\\/script>') + '\n</script>' : m);
        if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (h) => h + CONSOLE_HOOK); else html = CONSOLE_HOOK + html;
        return html;
      }
      function run() { st.logs = []; paintCons(); frame.srcdoc = bundle(); }
      const autoRun = B.debounce(() => { if (st.auto) run(); }, 700);

      B.need('cm').then(async () => {
        for (const m of ['xml', 'javascript', 'css', 'htmlmixed', 'python', 'markdown']) { try { await B.loadScript(B.lib.cmMode(m)); } catch (e) { /* optional */ } }
        cm = window.CodeMirror(edHost, { value: st.files[st.cur], mode: modeOf(st.cur), lineNumbers: true, theme: 'breye', tabSize: 2, indentUnit: 2, lineWrapping: false, autofocus: false, extraKeys: { 'Ctrl-S': () => saveProject(), 'Cmd-S': () => saveProject(), 'Ctrl-Enter': () => run(), 'Cmd-Enter': () => run() } });
        cm.on('change', () => { st.files[st.cur] = cm.getValue(); autoRun(); });
        run();
      }).catch((e) => { edHost.append(B.h('textarea', { class: 'textarea', style: 'height:100%', value: st.files[st.cur] })); B.err(e); });

      function tplMenu(at) { B.menu(at, Object.entries(TEMPLATES).map(([k, t]) => ({ label: t.name, icon: 'LayoutTemplate', fn: () => { st.files = JSON.parse(JSON.stringify(t.files)); st.cur = 'index.html'; st.name = nameIn.value = t.name; st.id = null; openFile('index.html'); run(); } }))); }
      function dlMenu(at) {
        B.menu(at, [{ label: 'Progetto ZIP', icon: 'Files', fn: async () => { await B.need('jszip'); const z = new window.JSZip(); if (cm) st.files[st.cur] = cm.getValue(); Object.entries(st.files).forEach(([n, c]) => z.file(n, c)); B.save(await z.generateAsync({ type: 'blob' }), B.slug(st.name) + '.zip'); } },
          { label: 'Un solo file HTML', icon: 'FileCode', fn: () => B.save(new Blob([bundle().replace(CONSOLE_HOOK, '')], { type: 'text/html' }), B.slug(st.name) + '.html') },
          { label: 'File corrente (' + st.cur + ')', icon: 'FileText', fn: () => B.save(new Blob([cm ? cm.getValue() : st.files[st.cur]], { type: 'text/plain' }), st.cur) }]);
      }
      async function saveProject() {
        if (cm) st.files[st.cur] = cm.getValue();
        st.id = st.id || B.uid('p');
        await B.projects.save({ id: st.id, type: 'code', name: st.name, data: { files: st.files, cur: st.cur } });
        B.toast('Progetto salvato', 'ok');
      }

      /* AI */
      const history = [];
      async function askAI(q) {
        q = (q || '').trim(); if (!q) return;
        aiIn.value = '';
        if (cm) st.files[st.cur] = cm.getValue();
        const ctx = Object.entries(st.files).map(([n, c]) => '### ' + n + '\n```\n' + c.slice(0, 30000) + '\n```').join('\n\n');
        const errs = st.logs.filter((l) => l.t === 'error').map((l) => l.m).slice(-10).join('\n');
        let task = q;
        if (q === '!fix') task = 'Trova e correggi tutti i bug del progetto. Errori della console:\n' + (errs || '(nessun errore registrato: cerca problemi logici o di layout)');
        if (q === '!explain') task = 'Spiega in modo chiaro e conciso come funziona il file ' + st.cur + ', sezione per sezione. Non modificare i file.';
        if (q === '!comment') task = 'Aggiungi commenti utili e concisi al file ' + st.cur + ' senza cambiarne il comportamento.';
        const want = q === '!explain' ? 'explain' : 'edit';
        aiOut.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
        aiSend.disabled = true;
        try {
          if (want === 'explain') {
            const t = await B.ai.text('Progetto web:\n\n' + ctx + '\n\nRichiesta: ' + task, { system: B.ai.persona + ' Sei una sviluppatrice senior.', tier: 'default', onText: async ({ text }) => { aiOut.innerHTML = await B.md(text); } });
            aiOut.innerHTML = await B.md(t); B.enhanceCode(aiOut);
          } else {
            const r = await B.ai.json('Sei una sviluppatrice web senior. Lavori su un progetto HTML/CSS/JS eseguito in un iframe (nessun server, nessun build step; puoi usare librerie da https://cdnjs.cloudflare.com).\n\nFile attuali:\n' + ctx + '\n\nRichiesta: ' + task + '\n\nRispondi SOLO con JSON: {"summary":"cosa hai fatto, in italiano, 1-3 frasi","files":[{"name":"index.html","content":"contenuto COMPLETO del file"}]}. Includi solo i file nuovi o modificati, sempre con il contenuto completo. Collega CSS e JS dall’index.html con <link href="style.css"> e <script src="script.js">. Codice moderno, curato, accessibile e responsive.', { system: false, tier: 'complex' });
            const files = Array.isArray(r.files) ? r.files : [];
            files.forEach((f) => { if (f && f.name && typeof f.content === 'string') st.files[f.name.replace(/^\.?\//, '')] = f.content; });
            history.push({ q, a: r.summary });
            aiOut.innerHTML = await B.md('**Fatto.** ' + (r.summary || '') + (files.length ? '\n\nFile aggiornati: ' + files.map((f) => '`' + f.name + '`').join(', ') : ''));
            openFile(files[0] && st.files[files[0].name] != null ? files[0].name : st.cur); run();
          }
        } catch (e) { aiOut.textContent = B.ai.errorText(e); }
        aiSend.disabled = false;
      }

      this.load = async (p) => {
        if (p.project) { const pr = await B.projects.get(p.project); if (pr) { st.id = pr.id; st.name = nameIn.value = pr.name; st.files = pr.data.files; openFile(pr.data.cur || 'index.html'); run(); } return; }
        if (p.code) {
          const lang = (p.lang || '').toLowerCase();
          if (/html|xml|svg/.test(lang) || /<html|<body|<div/i.test(p.code)) { st.files = { 'index.html': /<html/i.test(p.code) ? p.code : '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>\n' + p.code + '\n</body></html>' }; }
          else if (/css/.test(lang)) { st.files = JSON.parse(JSON.stringify(TEMPLATES.blank.files)); st.files['style.css'] = p.code; }
          else { st.files = JSON.parse(JSON.stringify(TEMPLATES.blank.files)); st.files['script.js'] = p.code; }
          st.id = null; openFile(Object.keys(st.files)[0]); run(); return;
        }
        if (p.prompt) { aiIn.value = 'Crea un progetto web completo: ' + p.prompt; if (p.auto) askAI(aiIn.value); }
      };
      paintFiles();
      B.key('mod+s', () => { saveProject(); }, 'code');
    },
    onShow(p) { if (p && Object.keys(p).length) this.load(p); setTimeout(() => { const c = B.$('.code-view .CodeMirror'); if (c && c.CodeMirror) c.CodeMirror.refresh(); }, 50); }
  });
})();
