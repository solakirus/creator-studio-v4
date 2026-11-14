/* Browser test: an episode's Edit — the whole week in one line (editline.js):
   blocks by length, transitions and shorts in the line, a shot's panel,
   selecting and mass-updating footage, devices (yours to edit, and picked
   in shoot mode), markers, and cutting the sequences in another order.

     node app/tests/browser/v4-editline.browser.js [outDir] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
const top = '.screen:last-child';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  for(const [w, h, name] of [[1440, 900, 'laptop'], [400, 860, 'phone']]){
    console.log(`\n— ${name} —`);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 600, permissions: ['clipboard-read', 'clipboard-write'] });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.EditLine && window.Devices, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    await p.evaluate(async () => {
      const c = await Data.saveClip({ title: 'Morning short', stage: 'idea', state: 'raw', plat: 'shorts' });
      await Store.put('vlogs', { id: 'v1', title: 'Week 2', week: 2, acts: [
        { id: 'a1', title: 'Sunday', beats: [
          { id: 'b1', title: 'Wake up', shots: [{ id: 's1', text: 'Alarm', secs: 2, tr: { id: '', n: 'Jump cut' }, done: true }, { id: 's2', text: 'Coffee pour', secs: 4, done: true }, { id: 's3', text: 'Morning short', clip: c.id }] },
          { id: 'b2', title: 'Gym', shots: [{ id: 's4', text: 'Walk in', secs: 3, done: true }, { id: 's5', text: 'Main lift', secs: 6 }] }] },
        { id: 'a2', title: 'Monday', beats: [{ id: 'b3', title: 'Deep work', shots: [{ id: 's6', text: 'Talking to camera', secs: 20 }] }] }] });
      Screens.push('vlog', { id: 'v1' });
    });
    await p.waitForTimeout(1200);
    await p.click(`${top} [data-a="mode-outline"]`); await p.waitForSelector(`${top} .el-b`, { timeout: 6000 }).catch(() => {});
    await p.waitForTimeout(500);
    const L = await p.evaluate(t => { const s = document.querySelector(t);
      return { blocks: [...s.querySelectorAll('.el-b')].map(x => Math.round(x.getBoundingClientRect().width)), tr: s.querySelectorAll('.el-tr').length, short: s.querySelectorAll('.el-b.short').length,
        days: [...s.querySelectorAll('.el-day')].map(x => x.textContent.trim()), seqs: [...s.querySelectorAll('.el-seq')].map(x => x.textContent.trim()), stat: s.querySelector('.el-stat').textContent }; }, top);
    ok(L.blocks.length === 6 && L.days.join() === 'Sunday,Monday' && L.seqs.join() === 'Wake up,Gym,Deep work', 'Edit: every shot of the week in one line, by day and sequence', JSON.stringify(L));
    ok(L.blocks[5] > L.blocks[4] && L.blocks[4] > L.blocks[3], 'each block as wide as it runs');
    ok(L.tr === 1 && L.short === 1, 'the transition and the short are in the line');
    ok(/about 0:38/.test(L.stat) && /3\/6 filmed/.test(L.stat), 'on top: the runtime (a shot with no length counts 3 s) and what is filmed', L.stat);
    await p.screenshot({ path: path.join(out, `el-${name}.png`) });

    /* a shot's panel */
    await p.click(`${top} .el-b[data-elk="b1:1"]`); await p.waitForTimeout(400);
    ok(/Coffee pour/.test(await p.textContent(`${top} .el-panel`)) && /0:02–0:06/.test(await p.textContent(`${top} .el-panel`)), 'tap a block: its panel, with where it sits in the cut');
    await p.fill(`${top} [data-elf="editNote"]`, 'Trim the first second'); await p.waitForTimeout(800);
    await p.click(`${top} [data-eldev]`); await p.waitForTimeout(400);
    await p.click('#sheet [data-dvp="DJI Pocket 3"]'); await p.waitForTimeout(800);
    await p.click(`${top} [data-eltg="cut"]`); await p.waitForTimeout(800);
    let v = await p.evaluate(() => Store.get('vlogs', 'v1'));
    let s2 = v.acts[0].beats[0].shots[1];
    ok(s2.editNote === 'Trim the first second' && s2.dev === 'DJI Pocket 3' && s2.cut === true, 'its edit note, device and ✂ Cut are saved on the shot', JSON.stringify(s2));
    await p.screenshot({ path: path.join(out, `el-panel-${name}.png`) });

    /* mass update */
    await p.click(`${top} [data-elsel="card"]`); await p.waitForTimeout(300);
    ok(/6 shots/.test(await p.textContent(`${top} .el-mass`)), 'Still on a card selects them all');
    await p.click(`${top} [data-elmass="off"]`); await p.waitForTimeout(900);
    await p.click(`${top} .el-day[data-elday="a1"]`); await p.waitForTimeout(300);
    ok(/5 shots/.test(await p.textContent(`${top} .el-mass`)), 'a day’s label selects that day');
    await p.click(`${top} [data-elmass="dev"]`); await p.waitForTimeout(400);
    await p.click('#sheet [data-dvp="Canon R6"]'); await p.waitForTimeout(900);
    await p.click(`${top} [data-elmass="loc"]`); await p.waitForTimeout(400);
    await p.fill('#sheet [data-locin]', 'D:\\Footage\\Week 2\\Sunday'); await p.click('#sheet [data-locok]'); await p.waitForTimeout(900);
    v = await p.evaluate(() => Store.get('vlogs', 'v1'));
    const allShots = v.acts.flatMap(a => a.beats.flatMap(b2 => b2.shots));
    const sun = v.acts[0].beats.flatMap(b2 => b2.shots);
    ok(allShots.every(x => x.off) && sun.every(x => x.dev === 'Canon R6' && x.loc === 'D:\\Footage\\Week 2\\Sunday') && !v.acts[1].beats[0].shots[0].dev,
      'mass: on the computer, then Sunday’s device and folder in one go', JSON.stringify(sun.map(x => [x.dev, x.off])));
    ok(/6\/6 on the computer/.test(await p.textContent(`${top} .el-stat`)), 'the count on top follows');

    /* the ticks survive the Steps */
    const st = await p.evaluate(async () => { const h = ShotList.hostBeat('v1', 'b1'); const t = await h.load(); t.subs[0].done = true; await h.save(t); return (await Store.get('vlogs', 'v1')).acts[0].beats[0].shots.map(x => [x.dev, x.off, x.loc, !!x.cut]); });
    ok(st.every(x => x[0] === 'Canon R6' && x[1] && x[2]) && st[1][3], 'a save through the Steps keeps device, folder, on the computer and cut', JSON.stringify(st));

    /* markers */
    const mk = await p.evaluate(async () => EditLine.markers(await Store.get('vlogs', 'v1')));
    ok(/0:00\s+Alarm.*⇄ Jump cut →/.test(mk) && /0:02\s+Coffee pour.*Trim the first second/.test(mk) && /Total about 0:38/.test(mk), 'Copy as markers: a timecoded line per shot', mk.split('\n').slice(0, 4).join(' | '));

    /* devices are yours */
    await p.click(`${top} [data-eldevs]`); await p.waitForTimeout(400);
    await p.fill('#sheet [data-dvnew]', 'Sony FX3'); await p.click('#sheet [data-dvadd]'); await p.waitForTimeout(200);
    await p.click('#sheet [data-dvrm="3"]'); await p.waitForTimeout(200);
    await p.click('#sheet [data-dvok]'); await p.waitForTimeout(500);
    ok(JSON.stringify(await p.evaluate(() => Devices.list())) === JSON.stringify(['Canon R6', 'DJI Pocket 3', 'iPhone', 'Sony FX3']), 'the device list: add and remove your own');

    /* cut order */
    await p.evaluate(async () => { const v2 = await Store.get('vlogs', 'v1'); v2.editOrder = ['b3', 'b1', 'b2']; await Store.put('vlogs', v2); });
    await p.click(`${top} [data-a="mode-plan"]`); await p.waitForTimeout(600); await p.click(`${top} [data-a="mode-outline"]`); await p.waitForTimeout(900);
    ok((await p.$$eval(`${top} .el-seq`, x => x.map(y => y.textContent.trim()))).join() === 'Deep work,Wake up,Gym', 'sequences cut in their own order (the days stay as filmed)');
    if(name === 'laptop'){
      await p.dragAndDrop(`${top} .el-seq[data-elseq="b2"]`, `${top} .el-seq[data-elseq="b3"]`); await p.waitForTimeout(900);
      ok(JSON.stringify((await p.evaluate(() => Store.get('vlogs', 'v1'))).editOrder) === JSON.stringify(['b2', 'b3', 'b1']), 'drag a sequence’s label to move it');
    }

    /* shoot mode: what you're shooting on */
    await p.evaluate(async () => { Devices.setLast('iPhone'); const v2 = await Store.get('vlogs', 'v1'); v2.acts[1].beats[0].shots[0].done = false; delete v2.acts[1].beats[0].shots[0].dev; v2.acts[1].beats[0].shotsSig = ''; await Store.put('vlogs', v2);
      Screens.push('shoot-run', { host: ShotList.hostBeat('v1', 'b3') }); });
    await p.waitForSelector('.sr-dev', { timeout: 6000 }).catch(() => {}); await p.waitForTimeout(400);
    ok(/iPhone/.test(await p.textContent('.sr-dev')), 'shoot mode shows what you’re shooting on');
    await p.click('[data-got]'); await p.waitForTimeout(900);
    ok((await p.evaluate(() => Store.get('vlogs', 'v1'))).acts[1].beats[0].shots[0].dev === 'iPhone', 'Got it labels the shot with it');
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(300);
    await ctx.close();
  }
  await b.close();
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
