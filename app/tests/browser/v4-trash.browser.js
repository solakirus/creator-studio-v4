/* Browser test: Recently deleted (trash.js), across devices.

   Two devices (a laptop and an iPad-sized browser) on a stand-in Sync Hub.
   - An episode and its shoot task deleted together: "Undo" brings both back.
   - Settings → Recently deleted lists it (with its linked item) on the OTHER
     device too, and Restore there brings it back everywhere.
   - The iPad deletes while offline, the laptop had edited it before: the
     delete wins, and the laptop keeps its version — Restore brings back the
     laptop's edit.
   - The iPad deletes offline, the laptop edits AFTER: the edit wins, the
     episode stays, and nothing is listed.
   - Tasks the app makes itself (habits) aren't kept; 30 days on, gone.

     node app/tests/browser/v4-trash.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const hubMod = require('../helpers/mini-synchub');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const hub = await hubMod.start({ token: 'tok' });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  async function device(name, opts){
    const ctx = await b.newContext(opts);
    if(name === 'laptop') await ctx.addInitScript(() => { window.CS3Lib = { home: async () => ({ path:'/x', exists:true }), scan: async () => ({ items: [], pages: [], roots: [], errors: [] }),
      pickFolder: async () => null, open: async () => {}, trash: async () => 0, boardFolder: async () => ({}), shotline: async () => null,
      grabFind: async () => null, grabRun: async () => ({}), grabStop: async () => {}, grabStatus: async () => ({ running:false, lines:[], links:[] }), onGrab: () => () => {} }; });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.Trash && window.Sync, null, { timeout: 15000 });
    await p.waitForTimeout(800); return p;
  }
  const ep = (id, title, extra) => ({ id, title, kind:'weekly', days:[{ id:'d1', label:'Mon', seqs:[{ id:'s1', title:'Kettle' }] }], ...(extra || {}) });
  try {
    const L = await device('laptop', { viewport: { width: 1280, height: 860 } });
    const I = await device('ipad', { viewport: { width: 1024, height: 1366 }, hasTouch: true });
    ok((await L.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url)).ok && (await I.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url)).ok, 'both devices sync');

    head('delete, then Undo');
    await L.evaluate(async e => { await Store.put('vlogs', e); await Store.put('tasks', { id:'t_shoot', title:'Shoot: Morning routine', vlogId:'v1' }); }, ep('v1', 'Morning routine'));
    await L.evaluate(() => Screens.push('settings', {})); await L.waitForTimeout(400);
    await L.evaluate(async () => { await Store.del('tasks', 't_shoot'); await Store.del('vlogs', 'v1'); });
    await L.waitForTimeout(300);
    const bar = await L.$eval('#undoBar.on', e => e.textContent).catch(() => '');
    ok(/Deleted “Morning routine”/.test(bar) && /Undo/.test(bar), 'a bar names the episode, with Undo', bar.trim());
    await L.screenshot({ path: path.join(out, 'trash-undo.png') });
    await L.click('#undoBar [data-undo]'); await L.waitForTimeout(600);
    ok(await L.evaluate(async () => !!(await Store.get('vlogs', 'v1')) && !!(await Store.get('tasks', 't_shoot'))), 'Undo brings back the episode and its task');
    ok((await L.evaluate(() => Trash.count())) === 0, 'and it leaves Recently deleted');

    head('deleted on one device, restored on the other');
    await L.evaluate(async () => { await Store.del('tasks', 't_shoot'); await Store.del('vlogs', 'v1'); await Sync.syncNow(); });
    await I.evaluate(() => Sync.syncNow()); await I.waitForTimeout(300);
    ok(await I.evaluate(async () => !(await Store.get('vlogs', 'v1'))), 'the delete reaches the iPad');
    await I.evaluate(() => Screens.push('settings', {})); await I.waitForTimeout(700);
    ok(/1 thing you can bring back/.test(await I.textContent('#trLine')), 'iPad Settings: "Recently deleted · 1 thing you can bring back"', (await I.textContent('#trLine')).trim());
    await I.click('[data-go="trash"]'); await I.waitForTimeout(700);
    const row = await I.textContent('#sheet .tr-item');
    ok(/Morning routine/.test(row) && /Episode · 1 linked item/.test(row) && /on the computer/.test(row), 'the iPad lists it: episode, its linked task, deleted on the computer', row.replace(/\s+/g, ' ').trim());
    await I.screenshot({ path: path.join(out, 'trash-sheet.png') });
    await I.click('#sheet [data-restore]'); await I.waitForTimeout(700);
    await I.evaluate(() => Sync.syncNow()); await L.evaluate(() => Sync.syncNow()); await L.waitForTimeout(300);
    ok(await L.evaluate(async () => !!(await Store.get('vlogs', 'v1')) && !!(await Store.get('tasks', 't_shoot')) && (await Trash.count()) === 0), 'Restore on the iPad brings it back on the laptop too');

    head('offline delete wins over an earlier edit: both versions kept');
    await I.evaluate(() => Sync.setPaused(true));
    await L.evaluate(async () => { const v = await Store.get('vlogs', 'v1'); v.days[0].seqs.push({ id:'s2', title:'Window light' }); await Store.put('vlogs', v); await Sync.syncNow(); });
    await L.waitForTimeout(200);
    await I.evaluate(async () => { await Store.del('vlogs', 'v1'); });
    await I.evaluate(async () => { await Sync.setPaused(false); await Sync.syncNow(); });
    await L.evaluate(() => Sync.syncNow()); await L.waitForTimeout(300);
    ok(await L.evaluate(async () => !(await Store.get('vlogs', 'v1'))), 'the iPad’s later delete wins on the laptop');
    const g = await L.evaluate(async () => (await Trash.list()).map(x => ({ t:x.title, v:x.versions.length, n:x.items.length })));
    ok(g.length === 1 && g[0].v === 1, 'Recently deleted shows it with two versions', JSON.stringify(g));
    await L.evaluate(() => { App.closeSheet(); Screens.pop(); }); await L.waitForTimeout(500);
    await L.evaluate(() => Screens.push('settings', {})); await L.waitForTimeout(400);
    await L.click('[data-go="trash"]'); await L.waitForTimeout(700);
    ok(/Two versions/.test(await L.textContent('#sheet .tr-item')), 'the sheet says so, with a button for each');
    await L.screenshot({ path: path.join(out, 'trash-two-versions.png') });
    await L.click('#sheet [data-ver*="here-computer"]'); await L.waitForTimeout(700);
    const back = await L.evaluate(async () => (await Store.get('vlogs', 'v1')).days[0].seqs.map(s => s.title));
    ok(JSON.stringify(back) === JSON.stringify(['Kettle', 'Window light']), 'restoring the laptop’s version keeps the edit the iPad never saw', JSON.stringify(back));
    await L.evaluate(() => Sync.syncNow()); await I.evaluate(() => Sync.syncNow());
    ok((await I.evaluate(async () => (await Store.get('vlogs', 'v1') || { days:[{ seqs:[] }] }).days[0].seqs.length)) === 2, 'and the iPad gets it back, edit included');

    head('offline delete loses to a later edit');
    await I.evaluate(() => Sync.setPaused(true));
    await I.evaluate(() => Store.del('vlogs', 'v1'));
    await I.waitForTimeout(200);
    await L.evaluate(async () => { const v = await Store.get('vlogs', 'v1'); v.title = 'Morning routine v2'; await Store.put('vlogs', v); await Sync.syncNow(); });
    await I.evaluate(async () => { await Sync.setPaused(false); await Sync.syncNow(); });
    ok((await I.evaluate(async () => (await Store.get('vlogs', 'v1') || {}).title)) === 'Morning routine v2', 'the later edit wins: the episode is back on the iPad');
    ok((await I.evaluate(() => Trash.count())) === 0 && (await L.evaluate(async () => { await Sync.syncNow(); return Trash.count(); })) === 0, 'and nothing is listed as deleted');

    head('what isn’t kept');
    await L.evaluate(async () => { await Store.put('tasks', { id:'t_h', title:'Stretch', habitId:'h1' }); await Store.del('tasks', 't_h'); });
    ok((await L.evaluate(() => Trash.count())) === 0, 'a task a habit made is not kept');
    const swept = await L.evaluate(async () => { await Store.put('tasks', { id:'t_old', title:'Old one' }); await Store.del('tasks', 't_old');
      const r = (await Store.all('trash')).values.find(x => x.key === 't_old'); r.at -= 31 * 86400000; await Store.put('trash', r); return Trash.sweep(); });
    ok(swept === 1 && (await L.evaluate(() => Trash.count())) === 0, '31 days on, it’s gone for good');
  } catch(e){ ok(false, 'ran to the end', e.message); }
  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close(); await hub.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
