/* Browser test: the v4 clean-up, as a person meets it on a phone.

   1. one add-task form: Today's + opens the same form as Month and Week; a
      plain task stays plain (no nine-shot page); a Shoot task gets the page
   2. a shot step shows its own frame; the page drawing folds away on a phone;
      tapping a frame opens shoot mode on that shot
   3. an episode's sequence has "Shoot it", into the same shoot mode, showing
      the shot's Reference Library still
   4. every Tools tile still opens something

     node app/tests/browser/v4-simpler.browser.js [out folder] */
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
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/'));
  await p.waitForFunction(() => window.App && window.TaskForm && window.ShootRun, null, { timeout: 15000 });
  await p.waitForTimeout(1200);
  const tasks = () => p.evaluate(async () => (await Store.all('tasks')).values);

  head('one add-task form');
  await p.evaluate(() => App.go('today')); await p.waitForTimeout(600);
  await p.click('[data-act="add"]'); await p.waitForTimeout(500);
  await p.click('[data-pick=""]'); await p.waitForTimeout(700);
  ok(await p.$('#tf-title') !== null && await p.$('#f-title') === null, 'Today\'s + opens the shared form (taskform.js), not a second copy');
  ok(await p.$('#tf-kind') !== null, 'which asks what kind it is');
  await p.fill('#tf-title', 'Call the doctor');
  await p.click('[data-tfsave]'); await p.waitForTimeout(800);
  let t = (await tasks()).find(x => x.title === 'Call the doctor');
  ok(t && !t.page && !(t.subs || []).length, 'a plain task stays plain: no nine-shot page, no steps', t && `${(t.subs || []).length} steps`);
  ok(await p.evaluate(() => [...document.querySelectorAll('.mediacard h2')].some(h => /Call the doctor/.test(h.textContent))), 'and shows on Today straight away');

  await p.click('[data-act="add"]'); await p.waitForTimeout(500);
  await p.click('[data-pick=""]'); await p.waitForTimeout(700);
  await p.fill('#tf-title', 'Film the yard');
  await p.selectOption('#tf-kind', 'shoot');
  await p.click('[data-tfsave]'); await p.waitForTimeout(800);
  t = (await tasks()).find(x => x.title === 'Film the yard');
  ok(t && t.kind === 'shoot' && t.page && t.page.slots.length === 9 && t.subs.length === 9, 'a Shoot task starts with the nine-shot sequence', t && `${t.page ? t.page.slots.length : 0} shots`);

  /* a library pick still prefills */
  await p.click('[data-act="add"]'); await p.waitForTimeout(500);
  const firstTile = await p.$('[data-pick="0"]');
  if (firstTile) {
    const name = (await firstTile.textContent()).replace('Recommended', '').trim();
    await firstTile.click(); await p.waitForTimeout(700);
    ok((await p.inputValue('#tf-title')) === name, 'a task-library pick prefills the form', name);
    await p.click('[data-tfcancel]'); await p.waitForTimeout(300);
  }

  head('frames beside the steps');
  const id = await p.evaluate(async ({ gif, png }) => {
    const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    await Store.put('task-frames', { uid: 'db:li_g', kind: 'gif', name: 'g', mime: 'image/gif', blob: new Blob([b64(gif)], { type: 'image/gif' }), keptAt: Date.now() });
    await Store.put('task-frames', { uid: 'db:li_s', kind: 'image', name: 's', mime: 'image/png', blob: new Blob([b64(png)], { type: 'image/png' }), keptAt: Date.now() });
    MediaLib.invalidate();
    const P = { ...Notebook.stepsPage('Walk'), name: 'Shot sequence · Walk' };
    P.slots = [['db:li_g', 'B-roll', 'Coffee, walking out'], ['db:li_s', 'Action', 'Wide: the start'], ['', 'Talking', 'Explain it']]
      .map(([item, role, text]) => ({ item, role, text, tone: '', done: false }));
    return (await QuickAdd.add({ day: await Data.currentDay(), title: 'Walk', kind: 'shoot', page: P })).id;
  }, { gif: FX('opener.gif'), png: FX('still.png') });
  await p.evaluate(id => Screens.push('task', { id }), id);
  await p.waitForTimeout(1800);
  const st = await p.evaluate(() => ({ th: document.querySelectorAll('.tk-th[data-shootat]').length, add: document.querySelectorAll('.tk-th[data-starpick]').length, img: document.querySelectorAll('.tk-th img').length,
    page: !document.querySelector('[data-a="showpage"]') && !document.querySelector('.tkp-cwrap').hidden }));
  ok(st.th === 2 && st.img === 2, 'each shot step with a frame shows it', `${st.img} of 2`);
  ok(st.page, 'the shot page always shows, on a phone too');
  await p.screenshot({ path: path.join(out, 'steps-frames.png') });
  await p.click('.tk-th[data-shootat="1"]'); await p.waitForTimeout(900);
  ok((await p.textContent('.sr-n').catch(() => '')) === '2 / 3', 'tapping a step\'s frame opens shoot mode on that shot');
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(400);
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(400);

  head('an episode\'s sequence');
  const ep = await p.evaluate(async ({ png }) => {
    const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    await Store.put('refs', { id: 'rf1', kind: 'image', name: 'wide ref' });
    await Store.put('ref-img', new Blob([b64(png)], { type: 'image/png' }), 'rf1');
    const day = await Data.currentDay();
    const v = { id: 'vq1', title: 'Episode 1', acts: [{ id: 'aq1', title: 'Monday', beats: [{ id: 'bq1', title: 'Yard intro', day,
      shots: [{ id: 'sq1', text: 'Wide of the yard' }, { id: 'sq2', text: 'Hands on the rake' }] }] }] };
    await Store.put('vlogs', v);
    await VlogTasks.write(v, [{ act: v.acts[0], beat: v.acts[0].beats[0] }]);
    const task = (await Store.all('tasks')).values.find(x => x.beatId === 'bq1');
    task.shots[0].angles[0].refIds = ['rf1'];
    await Store.put('tasks', task);
    await Store.put('vlogs', v);
    Screens.push('vlog-day', { vlogId: 'vq1', actId: 'aq1' });
    return task.id;
  }, { png: FX('still.png') });
  await p.waitForTimeout(1200);
  const shootIt = await p.$('[data-shootseq="bq1"]');   /* on its task (ep), since it's on your days */
  ok(!!shootIt, 'a sequence on your tasks has “Shoot it”');
  if (shootIt) { await shootIt.click(); await p.waitForTimeout(1000); }
  const sr = await p.evaluate(() => ({ n: (document.querySelector('.sr-n') || {}).textContent, t: (document.querySelector('.sr-t') || {}).textContent,
    img: !!document.querySelector('.sr-pic img') }));
  ok(sr.n === '1 / 2' && /Wide of the yard/.test(sr.t || ''), 'it opens the same shoot mode on the first shot', `${sr.n} · ${sr.t}`);
  ok(sr.img, 'showing that shot\'s Reference Library still');
  await p.screenshot({ path: path.join(out, 'episode-shoot.png') });
  await p.evaluate(() => { Screens.pop(); Screens.pop(); }); await p.waitForTimeout(500);

  head('Tools');
  const tiles = await p.evaluate(() => App.TOOLS ? App.TOOLS.map(t => t.name) : null);
  let dead = [];
  await p.evaluate(() => App.go('today'));
  for (const name of tiles || []) {
    await p.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); });
    const opened = await p.evaluate(n => {
      const slug = U.slug(n);
      const btn = document.querySelector(`[data-tool="${slug}"]`);
      if (!btn) return 'no tile';
      btn.click();
      const top = document.querySelectorAll('.screen');
      const toast = document.querySelector('.toast');
      return toast && /not built yet/.test(toast.textContent) ? 'not built' : (top.length ? 'ok' : 'nothing');
    }, name);
    if (opened !== 'ok') dead.push(`${name}: ${opened}`);
    await p.evaluate(() => { while (Screens.depth && Screens.depth()) Screens.pop(); });
    await p.waitForTimeout(250);
  }
  ok(tiles && tiles.length === 8, 'eight tiles', tiles && tiles.length);
  ok(!dead.length, 'every Tools tile opens its screen', dead.join(', '));

  head('errors');
  ok(!errs.length, 'no script errors', errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\nv4 clean-up  (${pass} ok, ${fail} failed)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
