/* Browser test: without sync, a file carries the plans from the laptop to the
   phone — and leaves the Library behind.

   Laptop: a Library frame (and a second one no task uses), a Shoot task whose
   page uses the first, a habit. Settings → Export for the other device.
   Phone: Settings → Restore from backup → Add to what's here, that file.

     node app/tests/browser/v4-devicefile.browser.js */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const FX = f => fs.readFileSync(path.join(__dirname, '..', 'fixtures', f)).toString('base64');
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };

(async () => {
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  const open = async (vp) => { const c = await b.newContext({ viewport: vp }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.TaskFrames && window.Sync, null, { timeout: 15000 }); await p.waitForTimeout(1000); return p; };

  console.log('\n— the laptop exports —');
  const lap = await open({ width: 1280, height: 860 });
  const file = await lap.evaluate(async ({ gif, png }) => {
    const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const r = await MediaLib.addFiles([new File([b64(gif)], 'used.gif', { type: 'image/gif' }), new File([b64(png)], 'unused.png', { type: 'image/png' })], 'Looks', 'Openers');
    const P = { ...Notebook.stepsPage('Yard'), name: 'Shot sequence · Yard' };
    P.slots = [{ item: r.added[0], text: 'Rake it', role: 'Action', tone: '', done: false }];
    await QuickAdd.add({ day: await Data.currentDay(), title: 'Film the yard', kind: 'shoot', page: P });
    await Habits.save({ name: 'Drink water', source: { type: 'own', amount: 8, unit: 'cups' } });
    /* the file goes where the browser saves; catch it on the way */
    let text = null;
    Transfer.download = async (name, t) => { text = t; window.__name = name; return true; };
    App.go('profile'); await new Promise(z => setTimeout(z, 300));
    Screens.push('settings'); await new Promise(z => setTimeout(z, 600));
    const row = document.querySelector('[data-go="devicefile"]');
    if(!row) return { row: false };
    row.click();
    for(let i = 0; i < 40 && !text; i++) await new Promise(z => setTimeout(z, 250));
    return { row: true, text, name: window.__name };
  }, { gif: FX('opener.gif'), png: FX('still.png') });
  ok(file.row, 'Settings has Export for the other device');
  ok(!!file.text, 'it writes a file', file.name);
  const data = file.text ? JSON.parse(file.text) : { data: {} };
  ok(!Object.keys(data.data).some(s => /^lib-|nb-music/.test(s)), 'the Library is not in it', Object.keys(data.data).filter(s => /^lib-/.test(s)).join(','));
  ok((data.data['task-frames'] || []).length === 1, 'the frame the task uses is, and only that one', (data.data['task-frames'] || []).length);
  const keys = ((data.keyed || {}).settings || []).map(([k]) => String(k));
  ok((data.data.tasks || []).some(t => t.title === 'Film the yard') && keys.some(k => /^habit:/.test(k)), 'with the tasks, and the habit (a setting)');
  ok(!keys.some(k => /^(backup:|sync:|library$)/.test(k)), 'but not this device\'s own settings (backup, Library folders)', keys.filter(k => /^(backup:|library$)/.test(k)).join(','));

  console.log('\n— the phone brings it in —');
  const ph = await open({ width: 412, height: 915 });
  /* Restore reloads the app when it's done */
  const reloaded = ph.waitForEvent('load', { timeout: 30000 }).catch(() => null);
  await ph.evaluate(async text => {
    Transfer.pickFile = async () => text;
    Screens.push('settings'); await new Promise(z => setTimeout(z, 600));
    document.querySelector('[data-go="restore"]').click(); await new Promise(z => setTimeout(z, 500));
    const sheet = document.getElementById('sheet') || document.body;
    const merge = sheet.querySelector('[data-v="merge"]'); if(merge) merge.click();
    sheet.querySelector('button.btn-primary[data-go]').click();
  }, file.text);
  ok(!!(await reloaded), 'Restore → Add to what\'s here takes it, and the app reloads');
  await ph.waitForFunction(() => window.App && window.MediaLib && window.Habits, null, { timeout: 15000 });
  await ph.waitForTimeout(1200);
  const got = await ph.evaluate(async () => {
    const t = (await Store.all('tasks')).values.find(x => x.title === 'Film the yard');
    const lib = await MediaLib.load(true);
    const m = t ? await Notebook.mediaFor(lib, t.page.slots[0].item) : null;
    return { task: !!t, kind: m && m.kind, habits: (await Habits.all()).map(h => h.name), libItems: (await Store.all('lib-items')).values.length };
  });
  ok(got.task, 'the task arrives');
  ok(got.kind === 'anim', 'and its frame draws — the GIF moving', got.kind);
  ok(got.habits.includes('Drink water'), 'the habit arrives', got.habits.join(', '));
  ok(got.libItems === 0, 'and the phone still has no Library');

  ok(!errs.length, 'no script errors', errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\nfile for the other device  (${pass} ok, ${fail} failed)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
