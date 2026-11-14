/* Browser test: the Storyboard view of a video's shots (shotboard.js) — the
   Templates' shot cards on a clip and on an episode's sequence, editing the
   same shots the Steps, the shot page and the Edit cut list read.

     node app/tests/browser/v4-shotboard.browser.js [outDir] */
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
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 600 });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.ShotBoard && window.ShotList, null, { timeout: 15000 });
    await p.waitForTimeout(900);
    await p.evaluate(() => localStorage.setItem('cs4-shots-view', 'steps'));
    const cid = await p.evaluate(async () => (await Data.saveClip({ title: 'Gym day', state: 'raw', stage: 'planned',
      shotList: [{ text: 'Walking in, bag over shoulder', framing: 'Wide', movement: 'Tracking', role: 'Action' }, { text: 'Chalk / straps close-up', framing: 'Extreme close-up', movement: 'Static', role: 'Insert' },
        { text: 'Main lift, low angle', framing: 'Medium', movement: 'Static', role: 'B-roll' }] })).id);

    const head = t => console.log('  · ' + t);
    await p.evaluate(id => Screens.push('clip', { id, tab: 'shoot' }), cid); await p.waitForTimeout(1500);
    ok(!(await p.$(`${top} .sb-switch`)) && !!(await p.$(`${top} .tk-host`)), 'clips keep their Steps (the Storyboard is for episodes)');
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(400);

    /* an episode's sequence */
    await p.evaluate(async () => { await Store.put('vlogs', { id: 'v1', title: 'Week 7', week: 7, acts: [{ id: 'a1', title: 'Saturday', day: 0,
      beats: [{ id: 'b1', title: 'Gym', shots: [{ id: 'x1', text: 'Walk in' }, { id: 'x2', text: 'Warm up', framing: 'Medium' }] }] }] }); });
    /* the day: every sequence on it, Steps or Storyboard */
    await p.evaluate(() => Screens.push('vlog-day', { vlogId: 'v1', actId: 'a1' })); await p.waitForTimeout(1500);
    ok(!!(await p.$(`${top} .sb-switch`)), 'the day has the Steps | Storyboard switch');
    if(!(await p.$(`${top} .sc-host`))) { await p.click(`${top} .seqcard .sc-head`).catch(() => {}); await p.waitForTimeout(800); }
    await p.click(`${top} .sb-switch [data-sbv="board"]`); await p.waitForTimeout(1200);
    ok((await p.$$(`${top} .sc-host .tp-shot`)).length === 2, 'Storyboard: the day’s sequence shows as shot cards');
    await p.fill(`${top} .sc-host [data-sbf="text"][data-i="0"]`, 'Walk in the door'); await p.waitForTimeout(1000);
    ok((await p.evaluate(() => Store.get('vlogs', 'v1'))).acts[0].beats[0].shots[0].text === 'Walk in the door', 'and its edits land on the sequence');
    await p.screenshot({ path: path.join(out, `sb-day-${name}.png`) });
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(400);
    await p.evaluate(() => Screens.push('vlog-beat', { vlogId: 'v1', beatId: 'b1' })); await p.waitForSelector(`${top} .tp-shot`, { timeout: 6000 }).catch(() => {});
    await p.waitForTimeout(600);
    ok((await p.$$(`${top} .tp-shot`)).length === 2, 'the sequence’s own page opens in the Storyboard too (the choice is remembered)');
    await p.selectOption(`${top} [data-sbf="role"][data-i="1"]`, 'Insert'); await p.waitForTimeout(600);
    await p.selectOption(`${top} [data-then="0"]`, 'Dissolve'); await p.waitForTimeout(600);
    let v = await p.evaluate(() => Store.get('vlogs', 'v1'));
    const bs = v.acts[0].beats[0].shots;
    ok(bs[1].role === 'Insert' && bs[1].framing === 'Medium' && bs[0].tr.n === 'Dissolve' && bs[0].id === 'x1' && bs[0].text === 'Walk in the door', 'its edits land on the sequence, ids kept', JSON.stringify(bs));
    await p.screenshot({ path: path.join(out, `sb-seq-${name}.png`) });
    await p.click(`${top} .sb-switch [data-sbv="steps"]`); await p.waitForTimeout(1200);
    await p.click(`${top} [data-tick="1"]`).catch(() => {}); await p.waitForTimeout(1200);
    v = await p.evaluate(() => Store.get('vlogs', 'v1'));
    const bs2 = v.acts[0].beats[0].shots;
    ok(bs2[1].done && bs2[1].framing === 'Medium' && bs2[1].text === 'Warm up' && bs2[0].text === 'Walk in the door' && bs2[0].tr && bs2[0].tr.n === 'Dissolve', 'ticking a sequence’s Steps keeps the shot type and THEN', JSON.stringify(bs2.map(s => [s.text, s.framing, s.done, s.tr && s.tr.n])));
    await ctx.close();
  }
  await b.close();
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
