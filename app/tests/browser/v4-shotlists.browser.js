/* Browser test: one shot list — with frames and shoot mode — in episodes,
   clips and a series' videos (v4, shotlist.js).

   Laptop (Library stood in): a template "Morning routine" with three framed
   shots, two frames starred. An episode day with a sequence:
     - the sequence editor's Shots list takes the template (frames and all),
       a typed shot, a Library frame for it; ticks; shoot mode over the list;
     - the day screen shows a filmstrip and shoots a sequence with no task;
     - What to film shows each day's frames;
     - Add to my tasks puts the shots on the task as its shot page.
   A clip made from the template has the list; "Put the shoot on a day" makes
   one shoot task with the frames. A series video's sheet opens the list on
   its own screen and comes back; scheduling carries the frames. Synced to the
   phone: the frames draw, and holding one swaps it for a starred frame.

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
    const ctx = await b.newContext(laptop ? { viewport: { width: 1280, height: 860 } } : { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    if(laptop) await ctx.addInitScript(() => { window.CS3Lib = { home: async () => ({ path: '/x', exists: true }), scan: async () => ({ items: [], pages: [], roots: [], errors: [] }),
      pickFolder: async () => null, open: async () => {}, trash: async () => 0, boardFolder: async () => ({}), shotline: async () => null,
      grabFind: async () => ({ root: 'built in', setUp: true, node: true, builtin: true, ytdlp: true, ffmpeg: true, out: '/x' }),
      grabRun: async () => ({}), grabStop: async () => {}, onGrab: () => () => {} }; });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.ShotList && window.Sync && window.StarPick, null, { timeout: 15000 });
    await p.waitForTimeout(1000); return p;
  }
  const rows = p => p.evaluate(() => [...document.querySelectorAll('.screen:last-child .sl-row, #clipShots .sl-row, #se-list .sl-row')].filter(r => r.offsetParent).length);
  const pics = p => p.evaluate(() => [...document.querySelectorAll('.sl-row .sl-th img, .sl-row .sl-th video')].filter(r => r.offsetParent).length);
  const lap = await device('laptop', true);

  head('set up on the laptop');
  const S = await lap.evaluate(async ({ g, s, w }) => {
    const b64 = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
    const r = await MediaLib.addFiles([new File([b64(g)], 'kettle.gif', { type: 'image/gif' }), new File([b64(s)], 'mug.png', { type: 'image/png' }),
      new File([b64(w)], 'window.gif', { type: 'image/gif' }), new File([b64(s)], 'beans.png', { type: 'image/png' })], 'Everyday', 'Mine');
    const u = r.added;
    await MediaLib.saveStar({ name: 'Morning', items: [u[1], u[3]] });
    const mk = (item, label, size) => ShotTemplates.shot({ item, label, role: 'Action', size: size || '—' });
    const tpl = await ShotTemplates.save({ name: 'Morning routine', kind: 'Vlog day', shots: [mk(u[0], 'Kettle on', 'Close'), mk(u[1], 'First sip'), mk(u[2], 'Light through the window', 'Wide')], tasks: [] });
    const day = await Data.currentDay();
    const v = { id: 'vl_test', title: 'Week of mornings', createdAt: Date.now(), acts: [
      { id: 'a_mon', title: 'Monday', day, open: true, beats: [{ id: 'b_coffee', title: 'Coffee', purpose: '', setup: 'talking', script: '', shots: [], day, at: null, done: false, clipId: null }] },
      { id: 'a_tue', title: 'Tuesday', day: day + 1, open: true, beats: [] }] };
    await Store.put('vlogs', v);
    return { u, tpl: tpl.id, day };
  }, { g: FX('opener.gif'), s: FX('still.png'), w: FX('disk.gif') });
  ok(S.u.length === 4, 'four frames, a template, an episode');

  head('episode: the sequence editor');
  await lap.evaluate(() => Screens.push('vlog-beat', { vlogId: 'vl_test', beatId: 'b_coffee' })); await lap.waitForTimeout(1000);
  ok(!!(await lap.$('#beatShots .sl-empty')), 'Shots sits at the top, empty, with Add / From a template / Library');
  const order = await lap.evaluate(() => { const hs = [...document.querySelectorAll('.screen:last-child .block h4')].map(h => h.textContent.trim()); return hs; });
  ok(order[0] === 'Shots', 'it is the first block', order.slice(0, 3).join(' · '));
  await lap.click('#beatShots [data-sl="tpl"]'); await lap.waitForTimeout(600);
  await lap.click(`#sheet [data-tp="st:${S.tpl}"]`); await lap.waitForTimeout(1500);
  ok((await rows(lap)) === 3, 'From a template adds its three shots', await rows(lap));
  ok((await pics(lap)) === 3, 'each with its frame, drawn', await pics(lap));
  await lap.click('#beatShots [data-sl="add"]'); await lap.waitForTimeout(500);
  await lap.fill('#sl-t', 'Steam off the cup'); await lap.click('#sheet [data-group="framing"] [data-v="Close"]'); await lap.click('#sheet [data-save]'); await lap.waitForTimeout(800);
  ok((await rows(lap)) === 4, 'a typed shot joins them');
  await lap.click('#beatShots .sl-row[data-i="3"] [data-sl="pic"]'); await lap.waitForTimeout(900);
  await lap.click(`.lv-picker .lv-tile[data-uid="${S.u[3]}"]`); await lap.waitForTimeout(900);
  await lap.click('#beatShots .sl-row[data-i="0"] [data-sl="tick"]'); await lap.waitForTimeout(500);
  let beat = await lap.evaluate(async () => (await Store.get('vlogs', 'vl_test')).acts[0].beats[0].shots);
  ok(beat.length === 4 && beat[3].item === S.u[3] && beat[3].framing === 'Close', 'its empty frame takes one from the Library', beat[3].text);
  ok(beat[0].done && beat[0].item === S.u[0] && beat[0].framing === 'Close', 'ticks and frames are saved on the sequence');
  await lap.screenshot({ path: path.join(out, 'laptop-sequence-shots.png') });
  await lap.click('#beatShots [data-sl="shoot"]'); await lap.waitForTimeout(1200);
  const sr = await lap.evaluate(() => ({ t: (document.querySelector('.sr-ttl') || {}).textContent, n: (document.querySelector('.sr-n') || {}).textContent, img: !!document.querySelector('.sr-pic img') }));
  ok(sr.t === 'Coffee' && sr.n === '2 / 4' && sr.img, 'Shoot opens shoot mode on the first shot not taken', `${sr.t} ${sr.n}`);
  await lap.click('[data-got]'); await lap.waitForTimeout(600);
  beat = await lap.evaluate(async () => (await Store.get('vlogs', 'vl_test')).acts[0].beats[0].shots.map(s => s.done));
  ok(beat[1] === true, 'Got it ticks the sequence\'s shot');
  await lap.keyboard.press('Escape'); await lap.waitForTimeout(800);
  ok((await lap.evaluate(() => document.querySelectorAll('#beatShots .sl-row.done').length)) === 2, 'back in the editor, both show taken');
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(500);

  head('episode: the day, and What to film');
  await lap.evaluate(() => Screens.push('vlog-day', { vlogId: 'vl_test', actId: 'a_mon' })); await lap.waitForTimeout(1300);
  ok((await lap.evaluate(() => document.querySelectorAll('.seqcard .sl-strip img').length)) === 4, 'the sequence card shows its four frames');
  ok(!!(await lap.$('[data-shootseq="b_coffee"]')), '▶ Shoot it is there with no task needed');
  await lap.click('[data-shootseq="b_coffee"]'); await lap.waitForTimeout(1000);
  ok((await lap.evaluate(() => (document.querySelector('.sr-ttl') || {}).textContent)) === 'Coffee', 'and shoots the sequence');
  await lap.keyboard.press('Escape'); await lap.waitForTimeout(600);
  await lap.click('[data-a="add"]'); await lap.waitForTimeout(700);
  ok(!!(await lap.$(`#sheet [data-stpl="${S.tpl}"]`)), 'Add a sequence offers shot templates (with frames) too');
  await lap.click(`#sheet [data-stpl="${S.tpl}"]`); await lap.waitForTimeout(900);
  const added = await lap.evaluate(async () => (await Store.get('vlogs', 'vl_test')).acts[0].beats.map(b => [b.title, b.shots.length, b.shots.filter(s => s.item).length, b.day]));
  ok(added.length === 2 && added[1][0] === 'Morning routine' && added[1][2] === 3 && added[1][3] === S.day, 'which lands as a sequence on the day, frames and all', JSON.stringify(added[1]));
  await lap.screenshot({ path: path.join(out, 'laptop-day.png') });
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);
  await lap.evaluate(() => Screens.push('vlog', { id: 'vl_test' })); await lap.waitForTimeout(1800);
  const wtf = await lap.evaluate(() => [...document.querySelectorAll('.dayrow[data-day]')].map(r => [r.dataset.day, r.querySelectorAll('.sl-strip img').length]));
  ok(wtf.length === 2 && wtf[0][1] === 7 && wtf[1][1] === 0, 'What to film shows each day\'s frames', JSON.stringify(wtf));
  await lap.evaluate(() => { const r = document.querySelector('.dayrow[data-day]'); if(r) r.scrollIntoView(); });
  await lap.screenshot({ path: path.join(out, 'laptop-what-to-film.png') });
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);
  const tk = await lap.evaluate(async () => {
    const v = await Store.get('vlogs', 'vl_test');
    await VlogTasks.write(v, v.acts[0].beats.map(beat => ({ act: v.acts[0], beat })));
    await Store.put('vlogs', v);
    const t = await Store.get('tasks', v.acts[0].beats[0].taskId);
    return { items: t.page.slots.map(s => s.item), steps: t.subs.length, done: t.subs.filter(s => s.done).length, kind: t.kind };
  });
  ok(tk.kind === 'shoot' && JSON.stringify(tk.items) === JSON.stringify([S.u[0], S.u[1], S.u[2], S.u[3]]), 'Add to my tasks puts the shots on the task as its shot page, frames included');
  ok(tk.steps === 4 && tk.done === 2, 'with a step per shot, taken ones ticked', `${tk.done}/${tk.steps}`);

  head('clips');
  const clipId = await lap.evaluate(async id => (await ShotTemplates.newClip(id)).id, S.tpl);
  await lap.evaluate(id => Screens.push('clip', { id, tab: 'shoot' }), clipId); await lap.waitForTimeout(1500);
  ok((await rows(lap)) === 3 && (await pics(lap)) === 3, 'a clip from the template has its three shots with frames, first on Shoot');
  ok(/Put the shoot on a day/.test(await lap.textContent('[data-a="toshoot"]')), 'and one button to put the shoot on a day');
  await lap.click('[data-a="toshoot"]'); await lap.waitForTimeout(800);
  await lap.click('#sheet [data-ok]'); await lap.waitForTimeout(1500);
  const ct = await lap.evaluate(async id => { const c = await Store.get('clips', id); const t = c.shootTaskId && await Store.get('tasks', c.shootTaskId);
    return { has: !!t, items: t ? t.page.slots.map(s => s.item) : [], clipId: t && t.clipId, btn: document.querySelector('[data-a="toshoot"]').textContent.trim() }; }, clipId);
  ok(ct.has && ct.items.length === 3 && ct.items[0] === S.u[0] && ct.clipId === clipId, 'it makes one shoot task with the frames, tied to the clip');
  ok(/Shoot on .+ move or update it/.test(ct.btn), 'the button then says when', ct.btn);
  await lap.screenshot({ path: path.join(out, 'laptop-clip-shots.png') });
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);

  head('a series\' video');
  const vid = await lap.evaluate(async () => (await Videos.save({ title: 'Morning ritual, part 1', shots: ['Alarm off'] })).id);
  await lap.evaluate(async id => VideoSheet.open(await Videos.get(id)), vid); await lap.waitForTimeout(800);
  ok(/1 shot/.test(await lap.textContent('#vd-shots')), 'the sheet sums up the shot list (old text lines still count)');
  await lap.click('#sheet [data-shots]'); await lap.waitForTimeout(900);
  ok(!!(await lap.$('#se-list')) && (await rows(lap)) === 1, '“Shots & frames” opens the list on its own screen');
  await lap.click('#se-list [data-sl="tpl"]'); await lap.waitForTimeout(600);
  await lap.click(`#sheet [data-tp="st:${S.tpl}"]`); await lap.waitForTimeout(1200);
  ok((await rows(lap)) === 4, 'where a template\'s shots join it');
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(1200);
  ok(/4 shots · 3 with frames/.test(await lap.textContent('#vd-shots')), 'closing it comes back to the sheet, updated', (await lap.textContent('#vd-shots')).trim().slice(0, 40));
  await lap.click('#sheet [data-when="today"]'); await lap.click('#sheet [data-save]'); await lap.waitForTimeout(1200);
  const vt = await lap.evaluate(async id => { const v = await Videos.get(id); const t = await Store.get('tasks', v.taskId);
    return { items: t.page.slots.map(s => s.item), steps: t.subs.map(s => s.t), shots: v.shots }; }, vid);
  ok(vt.items.length === 4 && vt.items[0] === '' && vt.items[1] === S.u[0], 'giving it a day puts its shots and frames on the task', vt.steps.join(' | '));
  ok(vt.shots.length === 4, 'and the text lines stay in step for everything that reads them');

  head('on the phone');
  await lap.evaluate(async () => { await TaskFrames.run(); });
  const up = await lap.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url);
  ok(up && up.ok, 'the laptop syncs');
  const ph = await device('phone', false);
  await ph.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url);
  await ph.waitForTimeout(1500);
  await ph.evaluate(() => Screens.push('vlog-beat', { vlogId: 'vl_test', beatId: 'b_coffee' })); await ph.waitForTimeout(1500);
  ok((await rows(ph)) === 4 && (await pics(ph)) === 4, 'the sequence\'s shots and frames are on the phone', `${await pics(ph)} drawn`);
  ok(!(await ph.$('#beatShots [data-sl="lib"]')), 'no Library button on the phone');
  await ph.locator('#beatShots .sl-row[data-i="2"] [data-sl="pic"]').scrollIntoViewIfNeeded(); await ph.waitForTimeout(300);
  const bx = await ph.locator('#beatShots .sl-row[data-i="2"] [data-sl="pic"]').boundingBox();
  await ph.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await ph.mouse.down(); await ph.waitForTimeout(900); await ph.mouse.up(); await ph.waitForTimeout(900);
  ok((await ph.evaluate(() => document.querySelectorAll('#sheet [data-pick]').length)) === 2, 'holding a frame opens the starred frames');
  await ph.click(`#sheet [data-pick="${S.u[3]}"]`); await ph.waitForTimeout(900);
  const sw = await ph.evaluate(async () => (await Store.get('vlogs', 'vl_test')).acts[0].beats[0].shots[2].item);
  ok(sw === S.u[3], 'and picking one swaps it');
  await ph.screenshot({ path: path.join(out, 'phone-sequence-shots.png') });
  await ph.evaluate(() => Screens.pop()); await ph.waitForTimeout(400);
  await ph.evaluate(id => Screens.push('clip', { id, tab: 'shoot' }), clipId); await ph.waitForTimeout(1500);
  ok((await pics(ph)) === 3, 'the clip\'s frames draw on the phone');
  await ph.evaluate(() => Screens.pop());

  const kept = await ph.evaluate(async () => { TaskFrames._now = () => Date.now() + 60 * 86400000; const r = await TaskFrames.run(); delete TaskFrames._now;
    return { removed: r.removed, left: (await Store.all('task-frames')).values.length }; });
  ok(kept.left >= 4, 'two months on, the template and the clip keep their frames on the phone', `${kept.left} kept, ${kept.removed} removed`);

  ok(!errs.length, 'no script errors', errs.slice(0, 3).join(' | '));
  await b.close(); await hub.close();
  console.log(`\nshot lists everywhere  (${pass} ok, ${fail} failed)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
