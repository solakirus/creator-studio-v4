/* Browser test: a grab that outlives the Library page, the one-video-or-page
   picker (Deck and frame picker), and taking a frame off a template shot.

   Laptop (Electron bridge stood in, with a grab the test drives by hand):
   start a grab, leave the Library, come back — the log, Stop and disabled
   Grab are back; other tabs show a strip with Stop; Stop reaches the bridge;
   a finished grab clears the strip. A scan's found links come back too.
   Deck: frames from three batches; the second picker shows one at a time,
   scoped to the library picked on the left.

     node app/tests/browser/v4-grab-picker.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const FX = f => fs.readFileSync(path.join(__dirname, '..', 'fixtures', f)).toString('base64');
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(() => {
    /* the desktop shell's grab state, driven by the test */
    const G = window.__G = { st: { running:false, mode:'', what:'', lines:[], links:[], code:null, endedAt:0 }, ls: { line:new Set(), link:new Set(), done:new Set() }, stops:0, runs:[] };
    G.emit = (k, v) => { if(k === 'line') G.st.lines.push(v); if(k === 'link') G.st.links.push(v);
      if(k === 'done') Object.assign(G.st, { running:false, code:v.code, endedAt:Date.now() }); G.ls[k].forEach(f => f(v)); };
    window.CS3Lib = { home: async () => '/x', scan: async () => ({ items: [], pages: [], roots: [], errors: [] }),
      pickFolder: async () => null, open: async () => {}, trash: async () => ({}), boardFolder: async () => ({}), shotline: async () => null,
      grabFind: async () => ({ root: 'built in', setUp: true, node: true, builtin: true, ytdlp: true, ffmpeg: true, out: '/x' }),
      grabRun: async o => { if(G.st.running) return { ok:false, why:'A grab is already running' }; G.runs.push(o);
        Object.assign(G.st, { running:true, mode:o.mode, what: o.mode === 'scan' ? o.url : (o.links || []).length + ' links', lines:[], links:[], code:null }); return { ok:true, builtin:true }; },
      grabStop: async () => { G.stops++; },
      grabStatus: async () => JSON.parse(JSON.stringify(G.st)),
      onGrab: (k, f) => { G.ls[k].add(f); return () => G.ls[k].delete(f); } };
  });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.waitForFunction(() => window.App && window.MediaLib, null, { timeout: 15000 });
  await p.waitForTimeout(800);
  const toLib = async () => { await p.evaluate(() => App.go('series')); await p.waitForTimeout(300); await p.click('.ctnav [data-v="library"]'); await p.waitForTimeout(700); };
  const leave = async () => { await p.evaluate(() => App.go('today')); await p.waitForTimeout(500); };

  head('a grab survives leaving the Library');
  await toLib();
  await p.click('.lv-tabs [data-tab="add"]'); await p.waitForTimeout(600);
  await p.fill('[data-links]', 'https://www.youtube.com/watch?v=aaa\nhttps://www.youtube.com/watch?v=bbb');
  await p.click('[data-grab]'); await p.waitForTimeout(400);
  await p.evaluate(() => { __G.emit('line', 'video 1 of 2: Morning routine'); __G.emit('line', '  42 cuts found'); });
  await p.waitForTimeout(200);
  ok(await p.isVisible('[data-stop]'), 'Stop shows while it runs');
  await leave();
  await p.evaluate(() => __G.emit('line', '  12 GIFs made'));
  ok(await p.evaluate(() => __G.ls.line.size === 0), 'leaving drops the page\'s listeners (the grab carries on)', String(await p.evaluate(() => __G.ls.line.size)));
  await toLib();
  /* the Library opens on the tab you left it on */
  const onAdd = await p.$eval('.lv-tabs [data-tab="add"]', e => e.getAttribute('aria-selected'));
  if(onAdd !== 'true'){ await p.click('.lv-tabs [data-tab="add"]'); await p.waitForTimeout(600); }
  let log = await p.textContent('[data-log]');
  ok(/Morning routine/.test(log) && /12 GIFs made/.test(log), 'coming back shows the log, including lines from while you were away', JSON.stringify(log.slice(0, 120)));
  ok(await p.isVisible('[data-stop]'), 'coming back shows Stop');
  ok(await p.$eval('[data-grab]', e => e.disabled), 'Grab now waits while one runs');
  await p.evaluate(() => __G.emit('line', 'video 2 of 2: Desk setup')); await p.waitForTimeout(150);
  ok(/Desk setup/.test(await p.textContent('[data-log]')), 'new lines keep arriving');
  await p.screenshot({ path: path.join(out, 'grab-back.png') });

  head('the strip on other tabs');
  await p.click('.lv-tabs [data-tab="deck"]'); await p.waitForTimeout(600);
  ok(await p.isVisible('.lv-grabbing'), 'the Deck shows a running-grab strip');
  ok(/Grabbing 2 links/.test(await p.textContent('.lv-grabbing')) && /Desk setup/.test(await p.textContent('[data-gline]')), 'it says what and the latest line', await p.textContent('.lv-grabbing'));
  await p.evaluate(() => __G.emit('line', '  9 stills saved')); await p.waitForTimeout(150);
  ok(/9 stills saved/.test(await p.textContent('[data-gline]')), 'the strip keeps up');
  await p.screenshot({ path: path.join(out, 'grab-strip.png') });
  await p.click('[data-gstop]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => __G.stops) === 1, 'Stop on the strip stops the grab');
  await p.evaluate(() => __G.emit('done', { code: 1 })); await p.waitForTimeout(250);
  ok(/Grab stopped/.test(await p.textContent('[data-grabstrip]')), 'the strip says it stopped');
  await p.click('[data-gshow]'); await p.waitForTimeout(700);
  log = await p.textContent('[data-log]');
  ok(/stopped/.test(log) && !(await p.isVisible('[data-stop]')) && !(await p.$eval('[data-grab]', e => e.disabled)), 'Show opens Add & grab with the last log, and you can grab again');

  head('a scan\'s links come back');
  await p.fill('[data-scanurl]', 'https://www.youtube.com/@riza');
  await p.click('[data-scan]'); await p.waitForTimeout(300);
  await p.evaluate(() => { __G.emit('link', { url:'https://y/1', title:'Riza vlog 1', kind:'video' }); __G.emit('link', { url:'https://y/2', title:'Riza vlog 2', kind:'video' }); });
  await leave(); await p.evaluate(() => __G.emit('link', { url:'https://y/3', title:'Riza vlog 3', kind:'video' }));
  await toLib();
  if(await p.$eval('.lv-tabs [data-tab="add"]', e => e.getAttribute('aria-selected')) !== 'true'){ await p.click('.lv-tabs [data-tab="add"]'); await p.waitForTimeout(600); }
  ok(await p.$$eval('[data-found] [data-fl]', x => x.length) === 3, 'all three found links are listed again', String(await p.$$eval('[data-found] [data-fl]', x => x.length)));
  ok(await p.isVisible('[data-stop]'), 'and the scan can be stopped');
  await p.click('[data-stop]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => __G.stops) === 2, 'Stop on Add & grab reaches the grabber');
  await p.evaluate(() => __G.emit('done', { code: 0 })); await p.waitForTimeout(300);
  await leave();
  await p.evaluate(() => { __G.emit('done', { code: 0 }); }); await p.waitForTimeout(200);
  ok(/Grab finished/.test(await p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')), 'a grab that ends while you\'re elsewhere says so');

  head('one video or page at a time');
  await p.evaluate(async ({ g, s }) => {
    const b64 = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
    const f = (n, gif) => new File([b64(gif ? g : s)], n, { type: gif ? 'image/gif' : 'image/png' });
    await MediaLib.addFiles([f('a1.gif', 1), f('a2.gif', 1), f('a3.gif', 1)], 'Riza', 'Morning routine');
    await MediaLib.addFiles([f('b1.gif', 1), f('b2.gif', 1)], 'Riza', 'Desk setup');
    await MediaLib.addFiles([f('c1.png', 0)], 'Mine', 'Added');
  }, { g: FX('opener.gif'), s: FX('still.png') });
  await toLib();
  await p.click('.lv-tabs [data-tab="deck"]'); await p.waitForTimeout(700);
  const tiles = () => p.$$eval('.lv-deck .lv-tile', x => x.length);
  ok(await tiles() === 6, 'Everything shows all six', String(await tiles()));
  const cards = (sc = '') => p.$$eval(sc + ' .lv-pstrip .lv-pcard', x => x.map(c => c.querySelector('b').textContent.trim() + (c.querySelector('small') ? ' / ' + c.querySelector('small').textContent.trim() : '') + ' (' + c.querySelector('.lv-pn').textContent.trim() + ')'));
  const card = (name, sc = '') => p.click(`${sc} .lv-pstrip .lv-pcard:has(b:text-is("${name}"))`);
  let opts = await cards();
  ok(opts.length === 4 && opts.includes('Morning Routine / Riza (3)') && opts.includes('Desk Setup / Riza (2)') && /^Every video/.test(opts[0]),
    'a row of cards across the top: every video or page, its library and count', JSON.stringify(opts));
  const thumbs = await p.$$eval('.lv-pstrip .lv-pcard:not(.lv-pall) .lv-media', x => x.filter(m => m.querySelector('img,canvas,video')).length);
  ok(thumbs === 3, 'each card shows its first frame', String(thumbs));
  await card('Morning Routine'); await p.waitForTimeout(700);
  ok(await tiles() === 3, 'tapping one shows just its frames', String(await tiles()));
  ok(/Riza/.test(await p.$eval('[data-src]', s => s.options[s.selectedIndex].textContent)), 'the menu on the left shows its library');
  opts = await cards();
  ok(opts.length === 3 && /^All of it/.test(opts[0]) && await p.$eval('.lv-pstrip .lv-pcard[aria-pressed="true"] b', b => b.textContent) === 'Morning Routine',
    'the row narrows to that library, with the chosen card lit', JSON.stringify(opts));
  await p.screenshot({ path: path.join(out, 'deck-one-video.png') });
  await card('Desk Setup'); await p.waitForTimeout(700);
  ok(await tiles() === 2, 'switching to another video', String(await tiles()));
  await card('All of it'); await p.waitForTimeout(700);
  ok(await tiles() === 5, '"All of it" goes back to the whole library', String(await tiles()));
  await p.selectOption('[data-src]', 'all'); await p.waitForTimeout(700);
  ok(await tiles() === 6 && (await cards()).length === 4, 'Everything brings the full row back');

  head('the frame picker');
  const opened = p.evaluate(() => LibView.pick({ title:'Pick a frame for shot 1' }).then(u => window.__picked = u));
  await p.waitForTimeout(900);
  const sizes = await p.$$eval('.lv-pgrid .lv-tile', x => x.slice(0, 3).map(t => { const r = t.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  ok(sizes.length && sizes.every(([w, h]) => h > w * 0.5), 'its tiles keep their shape', JSON.stringify(sizes));
  ok(await p.$('.lv-pscroll .lv-pgrid') && await p.$eval('.lv-pscroll', e => getComputedStyle(e).overflowY === 'auto'), 'the grid scrolls inside a wrapper, not squeezed by a fixed height');
  ok((await cards('.lv-picker')).length === 4, 'it has the row of videos too');
  await card('Desk Setup', '.lv-picker'); await p.waitForTimeout(600);
  ok((await p.$$eval('.lv-pgrid .lv-tile', x => x.length)) === 2, 'picking a video shows just its frames');
  ok(/Riza/.test(await p.$eval('.lv-picker [data-src]', s => s.options[s.selectedIndex].textContent)), 'and its library on the left');
  await p.screenshot({ path: path.join(out, 'picker-one-video.png') });
  await p.click('.lv-pgrid .lv-tile'); await opened; await p.waitForTimeout(200);
  ok(!!(await p.evaluate(() => window.__picked)), 'a click picks the frame');
  p.evaluate(() => LibView.pick({ title:'Again' }).then(u => window.__picked2 = u)); await p.waitForTimeout(800);
  ok(await p.$eval('.lv-picker .lv-pcard[aria-pressed="true"]:not(.lv-pall) b', b => b.textContent) === 'Desk Setup' && (await p.$$eval('.lv-pgrid .lv-tile', x => x.length)) === 2,
    'the next pick opens on the same video');
  await p.click('.lv-picker [data-close]'); await p.waitForTimeout(200);

  head('taking a frame off a template shot');
  const tid = await p.evaluate(async () => {
    const lib = await MediaLib.load();
    const u = lib.items.filter(i => i.kind === 'gif').map(i => i.uid);
    const t = await ShotTemplates.save({ name:'Weekly vlog test', kind:'Vlog day', shots:[ShotTemplates.shot({ item:u[0], label:'Cold open', role:'Action' }), ShotTemplates.shot({ item:u[1], label:'Whip pan', role:'Transition' })], tasks:[] });
    return t.id;
  });
  await p.evaluate(id => Screens.push('shot-templates', { id }), tid); await p.waitForTimeout(800);
  if(await p.$('.tp-tabs [data-tab="shots"][aria-selected="false"]')){ await p.click('.tp-tabs [data-tab="shots"]'); await p.waitForTimeout(500); }
  ok((await p.$$('[data-fclear]')).length === 2, 'each shot with a frame has ✕ and ↻');
  await p.hover('.tp-frame[data-frame="1"]'); await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(out, 'template-frame-buttons.png') });
  await p.click('[data-fclear="1"]'); await p.waitForTimeout(600);
  const after = await p.evaluate(async id => (await ShotTemplates.all()).find(x => x.id === id).shots.map(s => [s.item ? 'frame' : 'empty', s.label, s.role]), tid);
  ok(JSON.stringify(after) === '[["frame","Cold open","Action"],["empty","Whip pan","Transition"]]', '✕ takes the frame off and keeps the words and role', JSON.stringify(after));
  ok(/Pick a frame/.test(await p.textContent('.tp-frame[data-frame="1"]')) && !(await p.$('[data-fclear="1"]')), 'the shot is an empty slot again');
  const ch = p.click('[data-fchange="0"]'); await ch; await p.waitForTimeout(700);
  ok(!!(await p.$('.lv-picker')), '↻ opens the picker');
  await p.click('.lv-picker [data-close]'); await p.waitForTimeout(200);

  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
