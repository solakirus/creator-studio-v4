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

  head('episode: a sequence has the task\'s Steps + Shot page');
  await lap.evaluate(() => Screens.push('vlog-beat', { vlogId: 'vl_test', beatId: 'b_coffee' })); await lap.waitForTimeout(1800);
  let ui = await lap.evaluate(t => { const s = document.querySelector(t); return { rows: s.querySelectorAll('#beatShots .tk-ps').length,
    canvas: !!s.querySelector('#beatShots [data-pagecanvas]'), split: !!s.querySelector('#beatShots .tkp-split'),
    names: [...s.querySelectorAll('#beatShots .tk-name')].map(i => i.value), first: [...s.querySelectorAll('.block h4')].map(h => h.textContent.trim())[0] }; }, top);
  ok(ui.rows === 2 && ui.canvas && ui.split, 'Steps beside the Shot page, built from the sequence\'s old shots', JSON.stringify(ui.names));
  ok(ui.names[0] === 'Kettle on — Close', 'framing carried into the shot\'s name', ui.names[0]);
  ok(/^Steps/.test(ui.first), 'and it is the first block', ui.first);
  await lap.click(`${top} #beatShots [data-tick="0"]`); await lap.waitForTimeout(600);
  let bt = await beat(lap);
  ok(bt.shots[0].done && bt.page && bt.subs.find(x => x.shot === 0).done, 'ticking a step lands on the sequence (page, steps and its shot list)');
  ok(bt.shots[0].id === 'sh1' && bt.shots[1].id === 'sh2', 'its shots keep their ids');
  await lap.fill(`${top} #beatShots [data-pf="text:1"]`, 'First sip at the window'); await lap.press(`${top} #beatShots [data-pf="text:1"]`, 'Enter'); await lap.waitForTimeout(600);
  bt = await beat(lap);
  ok(bt.shots[1].text === 'First sip at the window', 'renaming a step renames the shot', bt.shots[1].text);
  await lap.click(`${top} #beatShots [data-a="psadd"]`); await lap.waitForTimeout(700);
  bt = await beat(lap);
  ok(bt.shots.length === 3 && bt.page.slots.length === 3, '＋ Add a shot adds a step and a spot', bt.shots.length);
  /* a frame: tap the empty spot on the page → the Library picker */
  await lap.evaluate(t => document.querySelector(t + ' #beatShots [data-pagecanvas]').scrollIntoView(), top); await lap.waitForTimeout(300);
  const pt = await lap.evaluate(t => { const c = document.querySelector(t + ' #beatShots [data-pagecanvas]'); const bx = c.getBoundingClientRect();
    return (async () => { const v = await Store.get('vlogs', 'vl_test'); const P = v.acts[0].beats[0].page; const r = Notebook.slotRects(P.layout, P.slots.length)[2];
      return { x: bx.left + ((r[0] + r[2]) / 2) / Notebook.PAGE_W * bx.width, y: bx.top + ((r[1] + r[3]) / 2) / Notebook.PAGE_H * bx.height }; })(); }, top);
  await lap.mouse.click(pt.x, pt.y); await lap.waitForTimeout(900);
  const picker = await lap.$(`.lv-picker .lv-tile[data-uid="${S.u[3]}"]`);
  ok(!!picker, 'tapping an empty spot on the page opens the Library picker');
  if(picker){ await picker.click(); await lap.waitForTimeout(1200); }
  bt = await beat(lap);
  ok(bt.page.slots[2].item === S.u[3] && bt.shots[2].item === S.u[3], 'the frame lands on the page and the shot', bt.shots[2].item);
  ok((await lap.evaluate(t => document.querySelectorAll(t + ' #beatShots .tk-th[data-item] img, ' + t + ' #beatShots .tk-th[data-item] video').length, top)) >= 1, 'and shows beside its step');
  await lap.screenshot({ path: path.join(out, 'laptop-sequence.png') });
  await lap.click(`${top} #beatShots [data-a="shootmode"]`); await lap.waitForTimeout(1200);
  const sr = await lap.evaluate(() => ({ t: (document.querySelector('.sr-ttl') || {}).textContent, n: (document.querySelector('.sr-n') || {}).textContent }));
  ok(sr.t === 'Coffee' && sr.n === '2 / 3', 'Shoot mode runs on the sequence, from the first shot not taken', `${sr.t} ${sr.n}`);
  await lap.click('[data-got]'); await lap.waitForTimeout(600);
  bt = await beat(lap);
  ok(bt.shots[1].done, 'Got it ticks the sequence\'s shot');
  await lap.keyboard.press('Escape'); await lap.waitForTimeout(900);
  ok((await lap.evaluate(t => !!document.querySelector(t + ' #beatShots'), top)), 'Esc closes shoot mode only');
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);
  /* a tick made somewhere else (the episode's Shoot list, the board) */
  await lap.evaluate(async () => { const v = await Store.get('vlogs', 'vl_test'); v.acts[0].beats[0].shots[2].done = true; v.acts[0].beats[0].shots.push({ id: 'sh9', text: 'Out the door', done: false }); await Store.put('vlogs', v); });
  await lap.evaluate(() => Screens.push('vlog-beat', { vlogId: 'vl_test', beatId: 'b_coffee' })); await lap.waitForTimeout(1500);
  ui = await lap.evaluate(t => ({ rows: document.querySelectorAll(t + ' #beatShots .tk-ps').length, hidden: (document.querySelector(t + ' #beatShots .tk-hidden') || {}).textContent || '' }), top);
  ok(/3 done/.test(ui.hidden) && ui.rows === 1, 'a change made elsewhere rebuilds the page: 3 done (hidden), 1 to go', ui.hidden);
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);

  head('episode: the day');
  await lap.evaluate(() => Screens.push('vlog-day', { vlogId: 'vl_test', actId: 'a_mon' })); await lap.waitForTimeout(2000);
  ui = await lap.evaluate(t => ({ hosts: [...document.querySelectorAll(t + ' [data-host]')].map(h => h.dataset.host), rows: document.querySelectorAll(t + ' [data-host] .tk-ps').length,
    shoot: document.querySelectorAll(t + ' .sc-shoot').length, lines: document.querySelectorAll(t + ' .seqcard .shotline[data-shot]').length }), top);
  ok(ui.hosts.length === 1 && ui.hosts[0] === 'b_coffee', 'the first unfinished sequence opens right there; the other stays folded', ui.hosts.join(','));
  ok(ui.rows === 1 && ui.shoot === 2, 'with its Steps + Shot page, and ▶ Shoot it on each', `${ui.rows} rows`);
  await lap.click(`${top} [data-seqfold="b_routine"]`); await lap.waitForTimeout(1500);
  ui = await lap.evaluate(t => ({ hosts: [...document.querySelectorAll(t + ' [data-host]')].map(h => h.dataset.host), imgs: document.querySelectorAll(t + ' [data-host="b_routine"] .tk-th img, ' + t + ' [data-host="b_routine"] .tk-th video').length }), top);
  ok(ui.hosts.includes('b_routine') && ui.imgs === 3, 'tapping a folded one opens it, frames on its steps', `${ui.imgs} frames`);
  /* working in the open sequence, on the day itself */
  const before = (await beat(lap)).shots.length;
  await lap.click(`${top} [data-host="b_coffee"] [data-a="psadd"]`); await lap.waitForTimeout(1200);
  let dayUi = await lap.evaluate(t => ({ hosts: [...document.querySelectorAll(t + ' [data-host]')].map(h => h.dataset.host), focus: (document.activeElement || {}).dataset ? document.activeElement.dataset.pf : '' }), top);
  ok((await beat(lap)).shots.length === before + 1, '＋ Add a shot works inside the day (the sequence gets the shot)', `${before} → ${(await beat(lap)).shots.length}`);
  ok(dayUi.hosts.length === 2 && /^text:/.test(dayUi.focus || ''), 'the day doesn\'t fold or redraw under you — the new shot\'s name is ready to type', JSON.stringify(dayUi));
  await lap.keyboard.type('Pour, wide from the counter'); await lap.keyboard.press('Enter'); await lap.waitForTimeout(800);
  ok((await beat(lap)).shots.some(x => x.text === 'Pour, wide from the counter'), 'and typing names it');
  const dpt = await lap.evaluate(t => { const c = document.querySelector(t + ' [data-host="b_coffee"] [data-pagecanvas]'); c.scrollIntoView(); const bx = c.getBoundingClientRect();
    return (async () => { const v = await Store.get('vlogs', 'vl_test'); const P = v.acts[0].beats[0].page; const i = P.slots.length - 1; const r = Notebook.slotRects(P.layout, P.slots.length)[i];
      return { i, x: bx.left + ((r[0] + r[2]) / 2) / Notebook.PAGE_W * bx.width, y: bx.top + ((r[1] + r[3]) / 2) / Notebook.PAGE_H * bx.height }; })(); }, top);
  await lap.waitForTimeout(300);
  const dpt2 = await lap.evaluate(t => { const c = document.querySelector(t + ' [data-host="b_coffee"] [data-pagecanvas]'); const bx = c.getBoundingClientRect(); return { left: bx.left, top: bx.top }; }, top);
  await lap.mouse.click(dpt.x, dpt.y); await lap.waitForTimeout(900);
  const dpick = await lap.$(`.lv-picker .lv-tile[data-uid="${S.u[1]}"]`);
  ok(!!dpick, 'tapping its empty spot on the shot page opens the Library picker');
  if(dpick){ await dpick.click(); await lap.waitForTimeout(1200); }
  ok((await beat(lap)).shots[dpt.i].item === S.u[1], 'and the frame lands on the sequence');
  await lap.screenshot({ path: path.join(out, 'laptop-day.png'), fullPage: true });
  await lap.click(`${top} [data-shootseq="b_routine"]`); await lap.waitForTimeout(1200);
  ok((await lap.evaluate(() => (document.querySelector('.sr-ttl') || {}).textContent)) === 'Morning routine', '▶ Shoot it shoots the sequence (no task needed)');
  await lap.click('[data-got]'); await lap.waitForTimeout(500);
  await lap.keyboard.press('Escape'); await lap.waitForTimeout(900);
  ok((await beat(lap, 1)).shots[0].done, 'and its tick lands on the sequence');
  await lap.click(`${top} [data-host="b_coffee"] [data-tick="3"]`).catch(() => {}); await lap.waitForTimeout(600);
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);
  await lap.evaluate(() => Screens.push('vlog', { id: 'vl_test' })); await lap.waitForTimeout(1800);
  const wtf = await lap.evaluate(() => [...document.querySelectorAll('.dayrow[data-day]')].map(r => r.querySelectorAll('.sl-strip, img').length));
  ok(wtf.length === 2 && wtf.every(n => n === 0), 'What to film stays plain day rows', JSON.stringify(wtf));
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);
  const tk = await lap.evaluate(async () => { const v = await Store.get('vlogs', 'vl_test');
    await VlogTasks.write(v, v.acts[0].beats.map(beat => ({ act: v.acts[0], beat }))); await Store.put('vlogs', v);
    const t = await Store.get('tasks', v.acts[0].beats[1].taskId); return { items: t.page.slots.map(s => s.item), steps: t.subs.length, kind: t.kind }; });
  ok(tk.kind === 'shoot' && tk.items.length === 3 && tk.items[0] === S.u[0] && tk.steps === 3, 'Add to my tasks carries the sequence\'s page, frames included');

  head('clips');
  const clipId = await lap.evaluate(async id => (await ShotTemplates.newClip(id)).id, S.tpl);
  await lap.evaluate(id => Screens.push('clip', { id, tab: 'shoot' }), clipId); await lap.waitForTimeout(2000);
  ui = await lap.evaluate(t => ({ rows: document.querySelectorAll(t + ' #clipShots .tk-ps').length, imgs: document.querySelectorAll(t + ' #clipShots .tk-th img, ' + t + ' #clipShots .tk-th video').length,
    canvas: !!document.querySelector(t + ' #clipShots [data-pagecanvas]') }), top);
  ok(ui.rows === 3 && ui.imgs === 3 && ui.canvas, 'a clip from the template: Steps + Shot page first on Shoot, frames on the steps', JSON.stringify(ui));
  await lap.click(`${top} #clipShots [data-tick="0"]`); await lap.waitForTimeout(700);
  await lap.click(`${top} [data-a="toshoot"]`); await lap.waitForTimeout(800);
  await lap.click('#sheet [data-ok]'); await lap.waitForTimeout(1500);
  const ct = await lap.evaluate(async id => { const c = await Store.get('clips', id); const t = c.shootTaskId && await Store.get('tasks', c.shootTaskId);
    return { done: c.shotList[0].done, items: t ? t.page.slots.map(s => s.item) : [], clipId: t && t.clipId, pages: !!c.page }; }, clipId);
  ok(ct.done && ct.pages, 'its ticks stay on the clip');
  ok(ct.items.length === 3 && ct.items[0] === S.u[0] && ct.clipId === clipId, 'Put the shoot on a day carries the clip\'s page to one shoot task');
  await lap.screenshot({ path: path.join(out, 'laptop-clip.png'), fullPage: true });
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);

  head('a series\' video, as a page');
  const vids = await lap.evaluate(async () => [(await Videos.save({ title: 'Part 1 — the kitchen', seriesId: 'sr_m', order: 1, shots: ['Alarm off', 'Curtains open'] })).id,
    (await Videos.save({ title: 'Part 2 — the commute', seriesId: 'sr_m', order: 2 })).id]);
  await lap.evaluate(id => Screens.push('video-page', { id }), vids[0]); await lap.waitForTimeout(1800);
  ui = await lap.evaluate(t => ({ parts: document.querySelectorAll(t + ' .vp-part').length, plain: !document.querySelector(t + ' .vp-parts img, ' + t + ' .vp-parts .sl-strip'),
    rows: document.querySelectorAll(t + ' #vpSteps .tk-ps').length, canvas: !!document.querySelector(t + ' #vpSteps [data-pagecanvas]') }), top);
  ok(ui.parts === 2 && ui.plain, 'the series\' parts down the left, plain (no shot lists)');
  ok(ui.rows === 2 && ui.canvas, 'and the video\'s Steps + Shot page', `${ui.rows} rows`);
  await lap.click(`${top} [data-stage="planned"]`); await lap.waitForTimeout(700);
  ok((await lap.evaluate(id => Videos.get(id), vids[0])).stage === 'planned', 'the stage is one tap');
  await lap.click(`${top} [data-a="day"]`); await lap.waitForTimeout(700);
  await lap.click('#sheet [data-ok]'); await lap.waitForTimeout(1500);
  const vt = await lap.evaluate(async id => { const v = await Videos.get(id); const t = await Store.get('tasks', v.taskId); return { n: t.page.slots.length, steps: t.subs.map(s => s.t) }; }, vids[0]);
  ok(vt.n === 2 && vt.steps.length === 2, 'Put on a day carries its page', vt.steps.join(' | '));
  await lap.screenshot({ path: path.join(out, 'laptop-video.png'), fullPage: true });
  await lap.click(`${top} [data-part="${vids[1]}"]`); await lap.waitForTimeout(1200);
  ok((await lap.evaluate(t => (document.querySelector(t + ' .vp-title') || {}).textContent, top)) === 'Part 2 — the commute', 'tapping another part switches to it');
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);

  head('on the phone');
  await lap.evaluate(async () => { await TaskFrames.run(); });
  const up = await lap.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url);
  ok(up && up.ok, 'the laptop syncs');
  const ph = await device('phone', false);
  await ph.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url);
  await ph.waitForTimeout(1500);
  await ph.evaluate(() => Screens.push('vlog-beat', { vlogId: 'vl_test', beatId: 'b_routine' })); await ph.waitForTimeout(2000);
  ui = await ph.evaluate(t => ({ rows: document.querySelectorAll(t + ' #beatShots .tk-ps').length, imgs: document.querySelectorAll(t + ' #beatShots .tk-th img, ' + t + ' #beatShots .tk-th video').length,
    page: !!document.querySelector(t + ' #beatShots .tkp-cwrap:not([hidden]) [data-pagecanvas]') }), top);
  ok(ui.imgs === 2 && ui.page, 'the sequence\'s frames show on its steps; the shot page shows too, on a phone as well', JSON.stringify(ui));
  const th = ph.locator(`${top} #beatShots .tk-th[data-shootat="1"]`);
  await th.scrollIntoViewIfNeeded(); await ph.waitForTimeout(300);
  const bx = await th.boundingBox();
  await ph.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await ph.mouse.down(); await ph.waitForTimeout(900); await ph.mouse.up(); await ph.waitForTimeout(900);
  ok((await ph.evaluate(() => document.querySelectorAll('#sheet [data-pick]').length)) === 2, 'holding a step\'s frame opens the starred frames');
  await ph.click(`#sheet [data-pick="${S.u[3]}"]`); await ph.waitForTimeout(1000);
  ok((await beat(ph, 1)).shots[1].item === S.u[3], 'and swaps it on the sequence');
  await ph.screenshot({ path: path.join(out, 'phone-sequence.png') });
  await ph.evaluate(() => Screens.pop()); await ph.waitForTimeout(400);
  await ph.evaluate(() => Screens.push('vlog-day', { vlogId: 'vl_test', actId: 'a_mon' })); await ph.waitForTimeout(1800);
  ok((await ph.evaluate(t => document.querySelectorAll(t + ' [data-host] .tk-ps').length, top)) >= 1, 'the phone\'s day opens a sequence into its steps too');
  await ph.screenshot({ path: path.join(out, 'phone-day.png') });

  ok(!errs.length, 'no script errors', errs.slice(0, 3).join(' | '));
  await b.close(); await hub.close();
  console.log(`\nSteps + Shot page everywhere  (${pass} ok, ${fail} failed)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
