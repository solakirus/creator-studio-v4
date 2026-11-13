/* Browser test: getting the GIFs this device's Library doesn't have (frameget.js).

   Two laptops (Electron bridge stood in, each with its own Shot Library
   folder recorded by saveFrame) and a stand-in Sync Hub.
   - A template made on laptop A uses three of A's frames; on laptop B they
     show (kept copies) but aren't in B's Library: the template says so and
     "Get them all" saves them into B's Shot Library at the same library/video
     folder.
   - A frame only nastime has comes from nastime (saveFrame with its link).
   - A frame no one here has is asked for; laptop A copies it on its next
     sync, and when it reaches B it's saved there and the request goes away.
   - One frame's own "↓ Get it" on a missing tile.

     node app/tests/browser/v4-frameget.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const hubMod = require('../helpers/mini-synchub');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
const FX = f => fs.readFileSync(path.join(__dirname, '..', 'fixtures', f)).toString('base64');
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const hub = await hubMod.start({ token: 'tok' });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  async function laptop(name, nas){
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
    await ctx.addInitScript(nas => {
      window.__saved = [];
      window.CS3Lib = { home: async () => ({ path: '/x', exists: true }), scan: async () => ({ items: [], pages: [], roots: [], errors: [] }),
        pickFolder: async () => null, open: async () => {}, trash: async () => ({}), boardFolder: async () => ({}), shotline: async () => null,
        grabFind: async () => null, grabRun: async () => ({}), grabStop: async () => {}, grabStatus: async () => ({ running:false, lines:[], links:[] }), onGrab: () => () => {},
        saveFrame: async o => { window.__saved.push({ path: o.path, url: o.url || '', bytes: o.data ? o.data.length : 0 }); return { ok: true, path: o.path }; },
        fetchJson: async u => nas && /shotlib-index/.test(u) ? nas : null };
      if(nas) localStorage.setItem('cs4-update-nas', 'http://nastime.test:8795/');
    }, nas || null);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.MediaLib && window.FrameGet && window.Sync, null, { timeout: 15000 });
    await p.waitForTimeout(800); return p;
  }
  const nasIndex = { format: 'cs4-shotlib', items: [{ uid: 'h:nastime|Trippin/Lisbon/gifs/tram.gif', path: 'Trippin/Lisbon/gifs/tram.gif', url: '/shotlib/Trippin/Lisbon/gifs/tram.gif', kind: 'gif' }], pages: [] };

  head('laptop A: a template with its own frames');
  const A = await laptop('A');
  const uids = await A.evaluate(async ({ g, s }) => {
    const b64 = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
    const r = await MediaLib.addFiles([new File([b64(g)], 'kettle.gif', { type: 'image/gif' }), new File([b64(g)], 'window.gif', { type: 'image/gif' }),
      new File([b64(s)], 'mug.png', { type: 'image/png' }), new File([b64(g)], 'later.gif', { type: 'image/gif' })], 'Life of Riza camera', 'Morning routine');
    const mk = (item, label) => ShotTemplates.shot({ item, label, role: 'Action' });
    await ShotTemplates.save({ id: 'tpl_m', name: 'Morning routine', kind: 'Vlog day', shots: [mk(r.added[0], 'Kettle'), mk(r.added[1], 'Window'), mk(r.added[2], 'Mug'),
      mk('h:nastime|Trippin/Lisbon/gifs/tram.gif', 'Tram')], tasks: [] });
    await TaskFrames.run();
    return r.added;
  }, { g: FX('opener.gif'), s: FX('still.png') });
  ok((await A.evaluate(() => Store.all('task-frames').then(r => r.values.length))) === 3, 'A keeps its three frames for the other devices');
  ok((await A.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url)).ok, 'A syncs');

  head('laptop B: the template shows them, its Library doesn\'t have them');
  const B = await laptop('B', nasIndex);
  await B.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url); await B.waitForTimeout(1500);
  const miss = await B.evaluate(async () => FrameGet.missing([...TaskFrames.collect((await Store.get('shot-templates', 'tpl_m')).shots)]));
  ok(miss.length === 4, 'all four are missing from B\'s Library', String(miss.length));
  await B.evaluate(() => Screens.push('shot-templates', { id: 'tpl_m' })); await B.waitForTimeout(1200);
  if(await B.$('.tp-tabs [data-tab="shots"][aria-selected="false"]')){ await B.click('.tp-tabs [data-tab="shots"]'); await B.waitForTimeout(800); }
  const barTxt = await B.textContent('.lv-missbar').catch(() => '');
  ok(/4 GIFs/.test(barTxt) && /Get them all/.test(barTxt), 'the template says so, with one button', barTxt.replace(/\s+/g, ' ').trim());
  ok((await B.$$('.tp-frame [data-getone]')).length === 1, 'the frame no copy reached shows its own ↓ Get it', String((await B.$$('.tp-frame [data-getone]')).length));
  await B.screenshot({ path: path.join(out, 'frameget-template.png') });

  head('Get them all');
  await B.click('.lv-missbar [data-getall]'); await B.waitForTimeout(1500);
  const saved = await B.evaluate(() => window.__saved);
  const fromCopies = saved.filter(s => s.bytes > 0).map(s => s.path).sort();
  ok(JSON.stringify(fromCopies) === JSON.stringify(['Life of Riza camera/Morning routine/kettle.gif', 'Life of Riza camera/Morning routine/mug.png', 'Life of Riza camera/Morning routine/window.gif']),
    'the three kept copies go into B\'s Shot Library, in the same library/video folder', JSON.stringify(fromCopies));
  const fromNas = saved.find(s => s.url);
  ok(fromNas && fromNas.path === 'Trippin/Lisbon/gifs/tram.gif' && fromNas.url === 'http://nastime.test:8795/shotlib/Trippin/Lisbon/gifs/tram.gif',
    'the one only nastime has comes from nastime, to the same path', JSON.stringify(fromNas));
  ok((await B.evaluate(() => Store.all('frame-requests').then(r => r.values.length))) === 0, 'nothing had to be asked for');

  head('one no copy has reached: asked for, then it arrives');
  const later = uids[3];
  await B.evaluate(async u => { const t = await Store.get('shot-templates', 'tpl_m'); t.shots.push(ShotTemplates.shot({ item: u, label: 'Later' })); await Store.raw ? Store.put('shot-templates', t) : Store.put('shot-templates', t); }, later);
  /* B hasn't heard of it from A yet: no kept copy, nastime doesn't have it */
  await B.evaluate(() => window.__saved.length = 0);
  const r = await B.evaluate(u => FrameGet.getAll([u]), later);
  ok(r.asked === 1 && r.got === 0, 'B asks for it', JSON.stringify(r));
  await B.evaluate(() => Sync.syncNow()); await B.waitForTimeout(500);
  await A.evaluate(async () => { await Sync.syncNow(); await TaskFrames.run(); await Sync.syncNow(); }); await A.waitForTimeout(500);
  ok(await A.evaluate(u => Store.get('task-frames', u).then(x => !!(x && x.blob)), later), 'A sees the request and copies it for the others');
  await B.evaluate(() => Sync.syncNow()); await B.waitForTimeout(600);
  const n = await B.evaluate(() => FrameGet.fulfil());
  const s2 = await B.evaluate(() => window.__saved);
  ok(s2.some(s => s.path === 'Life of Riza camera/Morning routine/later.gif'), 'when it reaches B it goes into B\'s Shot Library', JSON.stringify(s2));
  ok((await B.evaluate(() => Store.all('frame-requests').then(r => r.values.length))) === 0, 'and the request comes down');

  head('a browser (iPad): into the app\'s own storage');
  const ipad = await b.newContext({ viewport: { width: 1024, height: 1366 } });
  const I = await ipad.newPage(); I.on('pageerror', e => errs.push('ipad: ' + e.message));
  await I.goto(url); await I.waitForFunction(() => window.MediaLib && window.FrameGet && window.Sync, null, { timeout: 15000 });
  await I.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url); await I.waitForTimeout(1500);
  const got = await I.evaluate(async u => { MediaLib.hasLibrary = () => true; const r = await FrameGet.getAll([u]); const lib = await MediaLib.load(true);
    const it = MediaLib.find(lib, u); const pg = it && lib.pageIdx.get(it.page); return { r, src: it && it.src, lib: pg && pg.collection, page: pg && pg.page }; }, uids[0]);
  ok(got.r.got === 1 && got.src === 'db' && got.lib === 'Life of Riza camera' && got.page === 'Morning routine', 'the frame is in its Library under the same library and video, and the template finds it', JSON.stringify(got));

  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); hub.close && hub.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
