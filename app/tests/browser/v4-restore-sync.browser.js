/* Browser test: what Restore from backup brings in reaches the other devices.
   A restore used to write past Store.put, so 13 Nov 2026's Creator Studio 3
   swipe file stayed on the laptop. Now a restore is offered to sync, and a
   device that restored before this fix offers its swipes once (offerRestored),
   without undoing anything newer the server already has.

     node app/tests/browser/v4-restore-sync.browser.js */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const hubMod = require('../helpers/mini-synchub');
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

(async () => {
  const hub = await hubMod.start({ token: 'tok' });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  const device = async (name, w) => {
    const ctx = await b.newContext({ viewport: { width: w || 1280, height: 860 } });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.Sync && window.Transfer, null, { timeout: 15000 });
    await p.waitForTimeout(600); return p;
  };
  const swipes = p => p.evaluate(async () => (await Store.all('swipes')).values.map(s => s.id).sort().join(','));

  /* the backup, as Creator Studio 3 would make it */
  const OTHER = await device('cs3');
  const backup = await OTHER.evaluate(async png => {
    for(let i = 0; i < 5; i++) await Store.put('swipes', { id: 'cs3_' + i, title: 'From CS3 ' + i, url: 'https://example.com/' + i, createdAt: Date.now() });
    await Store.put('swipe-thumb', await (await fetch('data:image/png;base64,' + png)).blob(), 'cs3_0');
    await Store.put('tasks', { id: 'tk_cs3', title: 'not wanted', day: 1, view: 'todo', subs: [] });
    return JSON.stringify(await Transfer.exportAll());
  }, PNG);

  console.log('\n— a restore reaches the phone —');
  const LAP = await device('laptop');
  ok((await LAP.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url)).ok, 'the laptop syncs');
  const PH = await device('phone', 400);
  await PH.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url);
  /* one of them is already here, renamed since the backup was made */
  await LAP.evaluate(async () => { await Store.put('swipes', { id:'cs3_2', title:'Renamed since', createdAt:Date.now() }); await Sync.syncNow(); });
  await LAP.evaluate(async t => Transfer.importAll(JSON.parse(t), 'merge', new Set(['swipes', 'swipe-thumb'])), backup);
  const pend = await LAP.evaluate(() => Sync.status().then(s => s.pending));
  ok(pend === 5, 'the restored swipes and their picture are waiting to go up', pend);
  ok((await LAP.evaluate(async () => (await Store.get('swipes', 'cs3_2')).title)) === 'Renamed since',
    'one already here keeps its newer version — Add never goes back to the backup\'s copy');
  await LAP.evaluate(() => Sync.syncNow()); await PH.evaluate(() => Sync.syncNow());
  ok(await swipes(PH) === 'cs3_0,cs3_1,cs3_2,cs3_3,cs3_4', 'the phone has the restored swipes', await swipes(PH));
  ok(await PH.evaluate(async () => !!(await Store.get('swipe-thumb', 'cs3_0'))), 'and the cover picture');
  ok(await PH.evaluate(async () => !(await Store.get('tasks', 'tk_cs3'))), 'nothing that was left unticked');

  console.log('\n— a laptop that restored before the fix catches up once —');
  /* written straight to the database, the way the old restore did */
  await LAP.evaluate(async () => {
    const d = await Store.db();
    await new Promise(r => { const t = d.transaction('swipes', 'readwrite');
      t.objectStore('swipes').put({ id: 'old_1', title: 'Restored before the fix', createdAt: Date.now() });
      t.objectStore('swipes').put({ id: 'cs3_1', title: 'Old laptop copy', createdAt: Date.now() });
      t.oncomplete = r; });
  });
  /* meanwhile the phone renamed one of them */
  await PH.evaluate(async () => { const s = await Store.get('swipes', 'cs3_1'); s.title = 'Renamed on the phone'; await Store.put('swipes', s); await Sync.syncNow(); });
  const n1 = await LAP.evaluate(() => Sync.offerRestored());
  const n2 = await LAP.evaluate(() => Sync.offerRestored());
  ok(n1 >= 7 && n2 === 0, 'the swipes are offered once, and only once', `${n1} then ${n2}`);
  await LAP.evaluate(() => Sync.syncNow()); await PH.evaluate(() => Sync.syncNow());
  ok(/old_1/.test(await swipes(PH)), 'the one restored before the fix reaches the phone', await swipes(PH));
  const t1 = await PH.evaluate(async () => (await Store.get('swipes', 'cs3_1')).title);
  const t1l = await LAP.evaluate(async () => (await Store.get('swipes', 'cs3_1')).title);
  ok(t1 === 'Renamed on the phone' && t1l === 'Renamed on the phone', 'the catch-up undoes nothing newer: the phone\'s rename stands on both', `${t1} / ${t1l}`);

  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close(); await hub.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
