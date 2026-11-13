/* Browser test: Restore from backup → What to bring in. A backup from
   another Creator Studio (here: one made in a second profile, as Creator
   Studio 3 would) brings in just its swipe file, or any parts you tick.

     node app/tests/browser/v4-restore-parts.browser.js */
const path = require('path'), fs = require('fs'), os = require('os');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');

(async () => {
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  const open = async () => { const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message)); await p.goto(url); await p.waitForFunction(() => window.App && window.Transfer, null, { timeout: 15000 }); await p.waitForTimeout(1000); return p; };

  /* the other studio: swipes with a cover picture, a task, a series */
  const A = await open();
  const file = path.join(os.tmpdir(), 'cs3-backup-test.json');
  const text = await A.evaluate(async () => {
    await Store.put('swipes', { id: 'sw1', title: 'Hook study: cold open', url: 'https://example.com/a', createdAt: Date.now() });
    await Store.put('swipes', { id: 'sw2', title: 'B-roll idea: kitchen pour', createdAt: Date.now() });
    const png = await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).blob();
    await Store.put('swipe-thumb', png, 'sw1');
    await Store.put('tasks', { id: 'tk_other', title: 'A task from the other studio', day: 1, view: 'todo', subs: [] });
    await Data.saveSeries({ id: 's_other', title: 'Other studio series', channel: '' });
    return JSON.stringify(await Transfer.exportAll());
  });
  fs.writeFileSync(file, text);

  /* this studio */
  const B = await open();
  const before = await B.evaluate(async () => ({ tasks: (await Store.all('tasks')).values.length, series: (await Data.series()).length }));
  await B.evaluate(() => Screens.push('settings', {})); await B.waitForTimeout(800);
  await B.click('[data-go="restore"]'); await B.waitForTimeout(400);
  const [fc] = await Promise.all([B.waitForEvent('filechooser'), B.click('#sheet [data-go]')]);
  await fc.setFiles(file); await B.waitForTimeout(700);
  const sheet = await B.textContent('#sheet');
  ok(/What to bring in/.test(sheet) && /Swipe file\s*2 items/.test(sheet) && /Tasks and routines/.test(sheet), 'the file\'s parts are listed with counts', (sheet.match(/Swipe file\s*\d+ items?/) || [])[0]);
  ok(/Just the swipe file \(2\)/.test(sheet), 'with a one-tap "Just the swipe file"', (sheet.match(/Just the swipe file \(\d+\)/) || [])[0]);
  await B.click('[data-only-swipe]'); await B.waitForTimeout(1500);
  const after = await B.evaluate(async () => {
    const sw = (await Store.all('swipes')).values;
    const th = await Store.get('swipe-thumb', 'sw1');
    return { swipes: sw.map(x => x.id).sort().join(','), thumb: !!th && (th.size || (th.byteLength) || 1) > 0,
      tasks: (await Store.all('tasks')).values.length, other: !!(await Store.get('tasks', 'tk_other')), series: (await Data.series()).length };
  });
  ok(after.swipes === 'sw1,sw2' && after.thumb, 'the swipes come in, with their cover pictures', JSON.stringify(after));
  ok(!after.other && after.tasks === before.tasks && after.series === before.series, 'and nothing else: no tasks or series from the other studio');

  /* ticking parts */
  await B.evaluate(() => Screens.push('settings', {})); await B.waitForTimeout(800);
  await B.click('[data-go="restore"]'); await B.waitForTimeout(400);
  const [fc2] = await Promise.all([B.waitForEvent('filechooser'), B.click('#sheet [data-go]')]);
  await fc2.setFiles(file); await B.waitForTimeout(700);
  await B.evaluate(() => document.querySelectorAll('#sheet [data-part]').forEach(c => { c.checked = c.dataset.part === 'tasks'; }));
  await B.click('[data-bring]'); await B.waitForTimeout(1500);
  ok(await B.evaluate(async () => !!(await Store.get('tasks', 'tk_other')) && !(await Data.series()).some(s => s.id === 's_other')), 'ticking only Tasks brings the task and not the series');

  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
