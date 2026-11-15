/* Browser test: the task's Steps + Shot page in episodes, clips and a series'
   videos (v4, shotlist.js hosts lending screens/task.js its Steps block).

   Laptop (Library stood in): frames, a template "Morning routine" with three
   framed shots, two frames starred. An episode: Monday with "Coffee" (two old
   text shots) and "Morning routine"; Tuesday empty.
     - the sequence editor shows the task's Steps + Shot page, built from the
       old shots; ticking, renaming, adding a shot and picking a frame on the
       page all land on the sequence (and its plain shot list);
     - shoot mode runs on the sequence; a tick made elsewhere rebuilds the page;
     - the day screen opens the first unfinished sequence into its Steps + page,
       folds the rest, opens another on tap, and ▶ Shoot it works with no task;
     - What to film stays plain day rows; Add to my tasks carries the page.
   A clip from the template: Steps + page first on Shoot; Put the shoot on a
   day carries the page. A series video opens as a page: parts down the left,
   stage, Steps; a shoot day carries the page. Synced to the phone: the
   sequence's frames show on its steps, and holding one swaps it.

     node app/tests/browser/v4-shotlists.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const hubMod = require('../helpers/mini-synchub');
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
  const hub = await hubMod.start({ token: 'tok' });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  async function device(name, laptop){
    const ctx = await b.newContext(laptop ? { viewport: { width: 1280, height: 900 } } : { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    if(laptop) await ctx.addInitScript(() => { window.CS3Lib = { home: async () => ({ path: '/x', exists: true }), scan: async () => ({ items: [], pages: [], roots: [], errors: [] }),
      pickFolder: async () => null, open: async () => {}, trash: async () => 0, boardFolder: async () => ({}), shotline: async () => null,
      grabFind: async () => ({ root: 'built in', setUp: true, node: true, builtin: true, ytdlp: true, ffmpeg: true, out: '/x' }),
      grabRun: async () => ({}), grabStop: async () => {}, onGrab: () => () => {} }; });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.ShotList && window.Sync && window.StarPick, null, { timeout: 15000 });
    await p.waitForTimeout(1000); return p;
  }
  const top = '.screen:last-child';
  const beat = (p, i) => p.evaluate(async i => (await Store.get('vlogs', 'vl_test')).acts[0].beats[i || 0], i || 0);
  const lap = await device('laptop', true);

  head('set up on the laptop');
  const S = await lap.evaluate(async ({ g, s, w }) => {
    const b64 = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
    const r = await MediaLib.addFiles([new File([b64(g)], 'kettle.gif', { type: 'image/gif' }), new File([b64(s)], 'mug.png', { type: 'image/png' }),
      new File([b64(w)], 'window.gif', { type: 'image/gif' }), new File([b64(s)], 'beans.png', { type: 'image/png' })], 'Everyday', 'Mine');
    const u = r.added;
    await MediaLib.saveStar({ name: 'Morning', items: [u[1], u[3]] });
    const mk = (item, label) => ShotTemplates.shot({ item, label, role: 'Action' });
    const tpl = await ShotTemplates.save({ name: 'Morning routine', kind: 'Vlog day', shots: [mk(u[0], 'Kettle on'), mk(u[1], 'First sip'), mk(u[2], 'Light through the window')], tasks: [] });
    const day = await Data.currentDay();
    await Store.put('vlogs', { id: 'vl_test', title: 'Week of mornings', createdAt: Date.now(), acts: [
      { id: 'a_mon', title: 'Monday', day, open: true, beats: [
        { id: 'b_coffee', title: 'Coffee', purpose: '', setup: 'talking', script: '', day, at: null, done: false, clipId: null,
          shots: [{ id: 'sh1', text: 'Kettle on', framing: 'Close', done: false }, { id: 'sh2', text: 'First sip', done: false }] },
        { id: 'b_routine', title: 'Morning routine', purpose: '', setup: 'location', script: '', day, at: null, done: false, clipId: null,
          shots: tpl.shots.map(x => ({ id: 'r' + x.id, text: x.label, item: x.item, done: false })) }] },
      { id: 'a_tue', title: 'Tuesday', day: day + 1, open: true, beats: [] }] });
    return { u, tpl: tpl.id, day };
  }, { g: FX('opener.gif'), s: FX('still.png'), w: FX('disk.gif') });
  ok(S.u.length === 4, 'frames, a template, an episode');

  head('episode: a sequence is a Storyboard');
  await lap.evaluate(() => Screens.push('vlog-beat', { vlogId: 'vl_test', beatId: 'b_coffee' })); await lap.waitForTimeout(1800);
  let ui = await lap.evaluate(t => { const s = document.querySelector(t); return { cards: s.querySelectorAll('#beatShots .tp-shot').length,
    names: [...s.querySelectorAll('#beatShots [data-sbf="text"]')].map(i => i.value), steps: !!s.querySelector('#beatShots .tk-ps'),
    first: [...s.querySelectorAll('.block h4')].map(h => h.textContent.trim())[0] }; }, top);
  ok(ui.cards === 2 && !ui.steps, 'a card per shot, no Steps', JSON.stringify(ui.names));
  ok(ui.names[0] === 'Kettle on', 'its shots come across with their names', ui.names[0]);
  ok(/^Shots/.test(ui.first), 'and it is the first block', ui.first);
  await lap.check(`${top} #beatShots [data-sbf="done"][data-i="0"]`); await lap.waitForTimeout(900);
  let bt = await beat(lap);
  ok(bt.shots[0].done, 'ticking a card lands on the sequence');
  ok(bt.shots[0].id === 'sh1' && bt.shots[1].id === 'sh2', 'its shots keep their ids');
  await lap.fill(`${top} #beatShots [data-sbf="text"][data-i="1"]`, 'First sip at the window'); await lap.waitForTimeout(1100);
  bt = await beat(lap);
  ok(bt.shots[1].text === 'First sip at the window', 'renaming a card renames the shot', bt.shots[1].text);
  await lap.click(`${top} #beatShots [data-sbempty]`); await lap.waitForTimeout(900);
  bt = await beat(lap);
  ok(bt.shots.length === 3, '＋ Empty shot adds one', bt.shots.length);
  await lap.click(`${top} #beatShots [data-sbframe="2"]`); await lap.waitForTimeout(900);
  const picker = await lap.$(`.lv-picker .lv-tile[data-uid="${S.u[3]}"]`);
  ok(!!picker, 'tapping an empty frame opens the Library picker');
  if(picker){ await picker.click(); await lap.waitForTimeout(1200); }
  bt = await beat(lap);
  ok(bt.shots[2].item === S.u[3], 'the frame lands on the shot', bt.shots[2].item);
  await lap.screenshot({ path: path.join(out, 'laptop-sequence.png') });
  await lap.click(`${top} #beatShots [data-sbshootall]`); await lap.waitForTimeout(1200);
  const sr = await lap.evaluate(() => ({ t: (document.querySelector('.sr-ttl') || {}).textContent, n: (document.querySelector('.sr-n') || {}).textContent }));
  ok(sr.t === 'Coffee' && sr.n === '2 / 3', 'Shoot mode runs on the sequence, from the first shot not taken', `${sr.t} ${sr.n}`);
  await lap.click('[data-got]'); await lap.waitForTimeout(600);
  bt = await beat(lap);
  ok(bt.shots[1].done, 'Got it ticks the sequence\'s shot');
  await lap.keyboard.press('Escape'); await lap.waitForTimeout(900);
  ok((await lap.evaluate(t => !!document.querySelector(t + ' #beatShots'), top)), 'Esc closes shoot mode only');
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);

  head('episode: the day');
  await lap.evaluate(() => Screens.push('vlog-day', { vlogId: 'vl_test', actId: 'a_mon' })); await lap.waitForTimeout(2200);
  ui = await lap.evaluate(t => ({ cols: [...document.querySelectorAll(t + ' .dcol [data-host]')].map(h => h.dataset.host), shoot: document.querySelectorAll(t + ' [data-shootseq]').length,
    imgs: document.querySelectorAll(t + ' [data-host="b_routine"] .sb-pic img, ' + t + ' [data-host="b_routine"] .sb-pic video').length }), top);
  ok(ui.cols.join() === 'b_coffee,b_routine' && ui.shoot === 2, 'a column per sequence, ▶ Shoot it on each', ui.cols.join(','));
  ok(ui.imgs === 3, 'frames on its cards', `${ui.imgs} frames`);
  const before = (await beat(lap)).shots.length;
  await lap.click(`${top} [data-host="b_coffee"] [data-sbempty]`); await lap.waitForTimeout(1200);
  ok((await beat(lap)).shots.length === before + 1, '＋ Empty shot works inside the day (the sequence gets the shot)', `${before} → ${(await beat(lap)).shots.length}`);
  await lap.fill(`${top} [data-host="b_coffee"] [data-sbf="text"][data-i="${before}"]`, 'Pour, wide from the counter'); await lap.waitForTimeout(1100);
  ok((await beat(lap)).shots.some(x => x.text === 'Pour, wide from the counter'), 'and typing names it');
  await lap.click(`${top} [data-host="b_coffee"] [data-sbframe="${before}"]`); await lap.waitForTimeout(900);
  const dpick = await lap.$(`.lv-picker .lv-tile[data-uid="${S.u[1]}"]`);
  ok(!!dpick, 'tapping its empty frame opens the Library picker');
  if(dpick){ await dpick.click(); await lap.waitForTimeout(1200); }
  ok((await beat(lap)).shots[before].item === S.u[1], 'and the frame lands on the sequence');
  await lap.screenshot({ path: path.join(out, 'laptop-day.png'), fullPage: true });
  await lap.click(`${top} [data-shootseq="b_routine"]`); await lap.waitForTimeout(1200);
  ok((await lap.evaluate(() => (document.querySelector('.sr-ttl') || {}).textContent)) === 'Morning routine', '▶ Shoot it shoots the sequence (no task needed)');
  await lap.click('[data-got]'); await lap.waitForTimeout(500);
  await lap.keyboard.press('Escape'); await lap.waitForTimeout(900);
  ok((await beat(lap, 1)).shots[0].done, 'and its tick lands on the sequence');
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);
  await lap.evaluate(() => Screens.push('vlog', { id: 'vl_test' })); await lap.waitForTimeout(1800);
  const wtf = await lap.evaluate(() => [...document.querySelectorAll('.wkcol')].map(r => r.querySelectorAll('.sl-strip, img').length));
  ok(wtf.length === 2 && wtf.every(n => n === 0), 'What to film: a plain column per day', JSON.stringify(wtf));
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);
  const tk = await lap.evaluate(async () => { const v = await Store.get('vlogs', 'vl_test');
    await VlogTasks.write(v, v.acts[0].beats.map(beat => ({ act: v.acts[0], beat }))); await Store.put('vlogs', v);
    const t = await Store.get('tasks', v.acts[0].beats[1].taskId); return { items: t.page.slots.map(s => s.item), steps: t.subs.length, kind: t.kind }; });
  ok(tk.kind === 'shoot' && tk.items.length === 3 && tk.items[0] === S.u[0] && tk.steps === 3, 'Add to my tasks carries the sequence\'s page, frames included');

  head('clips');
  const clipId = await lap.evaluate(async id => (await ShotTemplates.newClip(id)).id, S.tpl);
  await lap.evaluate(id => Screens.push('clip', { id, tab: 'shoot' }), clipId); await lap.waitForTimeout(2000);
  await lap.waitForTimeout(800);
  ui = await lap.evaluate(t => ({ rows: document.querySelectorAll(t + ' .cps-row').length, imgs: document.querySelectorAll(t + ' .cps-row .pic img, ' + t + ' .cps-row .pic video, ' + t + ' .cps-row .pic canvas').length }), top);
  ok(ui.rows === 3 && ui.imgs >= 3, 'a clip from the template: Shoot lists its shots with their frames', JSON.stringify(ui));
  await lap.click(`${top} [data-cpstick="0"]`); await lap.waitForTimeout(1000);
  await lap.click(`${top} [data-a="toshoot"]`); await lap.waitForTimeout(800);
  await lap.click('#sheet [data-ok]'); await lap.waitForTimeout(1500);
  const ct = await lap.evaluate(async id => { const c = await Store.get('clips', id); const t = c.shootTaskId && await Store.get('tasks', c.shootTaskId);
    return { done: c.shotList[0].done, items: t ? t.page.slots.map(s => s.item) : [], clipId: t && t.clipId, pages: !!c.page }; }, clipId);
  ok(ct.done && ct.pages, 'its ticks stay on the clip');
  ok(ct.items.length === 3 && ct.items[0] === S.u[0] && ct.clipId === clipId, 'Put the shoot on a day carries the clip\'s page to one shoot task');
  await lap.screenshot({ path: path.join(out, 'laptop-clip.png'), fullPage: true });
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);

  head('a series\' video is a clip, opened on the clip page');
  const vids = await lap.evaluate(async () => { await Store.put('series', { id: 'sr_m', title: 'Morning ritual', state: 'live', createdAt: Date.now() }); Data.invalidate('series');
    const a = await Videos.save({ title: 'Part 1 — the kitchen', seriesId: 'sr_m', order: 1, shots: ['Alarm off', 'Curtains open'] });
    const b = await Videos.save({ title: 'Part 2 — the commute', seriesId: 'sr_m', order: 2 });
    await ClipFlow.migrate(); return [ClipFlow.idFor(a.id), ClipFlow.idFor(b.id)]; });
  await lap.evaluate(() => Screens.push('series-view', { id: 'sr_m' })); await lap.waitForTimeout(1500);
  await lap.click(`${top} [data-video="${vids[0]}"]`); await lap.waitForTimeout(1500);
  await lap.click(`${top} [data-ctab="shoot"]`); await lap.waitForTimeout(1500);
  ui = await lap.evaluate(t => ({ part: ((document.querySelector(t + ' .cp-series') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    rows: document.querySelectorAll(t + ' .cps-row').length, day: !!document.querySelector(t + ' [data-a="toshoot"]') }), top);
  ok(/Episode 1 of 2/.test(ui.part), 'it knows its series and part', ui.part);
  ok(ui.rows === 2 && ui.day, 'and has its shots and a shoot day to set', `${ui.rows} rows`);
  await lap.click(`${top} [data-a="toshoot"]`); await lap.waitForTimeout(700);
  await lap.click('#sheet [data-ok]'); await lap.waitForTimeout(1500);
  const vt = await lap.evaluate(async id => { const c = await Store.get('clips', id); const t = await Store.get('tasks', c.shootTaskId); return { n: t.page.slots.length, steps: t.subs.map(s => s.t), stage: c.stage }; }, vids[0]);
  ok(vt.n === 2 && vt.steps.length === 2 && vt.stage === 'planned', 'Put it on a day carries its page, and it is Planned', vt.steps.join(' | '));
  await lap.screenshot({ path: path.join(out, 'laptop-video.png'), fullPage: true });
  await lap.click(`${top} [data-part="1"]`); await lap.waitForTimeout(1500);
  ok((await lap.evaluate(t => (document.querySelector(t + ' .cp-head .t') || {}).textContent, top)) === 'Part 2 — the commute', '› switches to the next part');
  await lap.evaluate(() => { Screens.pop(); Screens.pop(); }); await lap.waitForTimeout(600);

  head('on the phone');
  await lap.evaluate(async () => { await TaskFrames.run(); });
  const up = await lap.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url);
  ok(up && up.ok, 'the laptop syncs');
  const ph = await device('phone', false);
  await ph.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url);
  await ph.waitForTimeout(1500);
  await ph.evaluate(() => Screens.push('vlog-beat', { vlogId: 'vl_test', beatId: 'b_routine' })); await ph.waitForTimeout(2000);
  ui = await ph.evaluate(t => ({ cards: document.querySelectorAll(t + ' #beatShots .tp-shot').length, imgs: document.querySelectorAll(t + ' #beatShots .sb-pic img, ' + t + ' #beatShots .sb-pic video').length }), top);
  ok(ui.imgs === 3, 'the sequence\'s frames show on its Storyboard cards, on a phone as well', JSON.stringify(ui));
  await ph.click(`${top} #beatShots [data-sbframe="1"]`); await ph.waitForTimeout(900);
  ok((await ph.evaluate(() => document.querySelectorAll('#sheet [data-pick]').length)) === 2, 'tapping a card\'s frame opens the starred frames');
  await ph.click(`#sheet [data-pick="${S.u[3]}"]`); await ph.waitForTimeout(1000);
  ok((await beat(ph, 1)).shots[1].item === S.u[3], 'and swaps it on the sequence');
  await ph.screenshot({ path: path.join(out, 'phone-sequence.png') });
  await ph.evaluate(() => Screens.pop()); await ph.waitForTimeout(400);
  await ph.evaluate(() => Screens.push('vlog-day', { vlogId: 'vl_test', actId: 'a_mon' })); await ph.waitForTimeout(1800);
  ok((await ph.evaluate(t => document.querySelectorAll(t + ' .dcol .tp-shot').length, top)) >= 1, 'the phone\'s day shows its sequences as Storyboard columns too');
  await ph.screenshot({ path: path.join(out, 'phone-day.png') });

  ok(!errs.length, 'no script errors', errs.slice(0, 3).join(' | '));
  await b.close(); await hub.close();
  console.log(`\nSteps + Shot page everywhere  (${pass} ok, ${fail} failed)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
