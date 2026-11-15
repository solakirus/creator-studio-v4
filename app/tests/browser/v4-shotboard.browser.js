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
    await p.evaluate(() => { localStorage.setItem('cs4-shots-view', 'steps'); localStorage.setItem('cs4-sb-details', '1'); });
    const cid = await p.evaluate(async () => (await Data.saveClip({ title: 'Gym day', state: 'raw', stage: 'planned',
      shotList: [{ text: 'Walking in, bag over shoulder', framing: 'Wide', movement: 'Tracking', role: 'Action' }, { text: 'Chalk / straps close-up', framing: 'Extreme close-up', movement: 'Static', role: 'Insert' },
        { text: 'Main lift, low angle', framing: 'Medium', movement: 'Static', role: 'B-roll' }] })).id);

    const head = t => console.log('  · ' + t);
    await p.evaluate(id => Screens.push('clip', { id, tab: 'shoot' }), cid); await p.waitForTimeout(1500);
    ok(!(await p.$(`${top} .sb-switch`)) && !!(await p.$(`${top} .cp-shoot`)), 'clips have their own Shoot card (the Storyboard is for episodes)');
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(400);

    /* an episode's sequence */
    await p.evaluate(async () => { await Store.put('vlogs', { id: 'v1', title: 'Week 7', week: 7, acts: [{ id: 'a1', title: 'Saturday', day: 0,
      beats: [{ id: 'b1', title: 'Gym', shots: [{ id: 'x1', text: 'Walk in' }, { id: 'x2', text: 'Warm up', framing: 'Medium' }] }] }] }); });
    /* the episode's plan: folded sections, the week across */
    await p.evaluate(async () => { const v = await Store.get('vlogs', 'v1'); v.acts.push({ id: 'a2', title: 'Sunday', beats: [{ id: 'b9', title: 'Wind down', shots: [] }] }); await Store.put('vlogs', v); });
    await p.evaluate(() => Screens.push('vlog', { id: 'v1' })); await p.waitForTimeout(1500);
    const ep = await p.evaluate(t => { const s = document.querySelector(t); return { folds: [...s.querySelectorAll('details.epfold')].map(d => d.open), cols: s.querySelectorAll('.wkcol').length,
      seqs: s.querySelectorAll('.wkcol .wkc-seq').length, habits: !!s.querySelector('[data-ep5hab]'), stat: !!s.querySelector('[data-ep5stat]'), segs: !!s.querySelector('[data-ep5seg],[data-ep5segs]') }; }, top);
    ok(ep.folds.length === 4 && ep.folds.every(o => !o), 'the plan: four sections folded to one line each', JSON.stringify(ep.folds));
    ok(ep.cols === 2 && ep.seqs === 2, 'What to film: a column per day, its sequences down it', JSON.stringify(ep));
    ok(!ep.habits && !ep.stat && !ep.segs, 'no habit days, stat card or segments');
    await p.click(`${top} .wkcol .wkc-seq[data-beat="b1"]`); await p.waitForTimeout(1200);
    ok(/Gym/.test(await p.textContent(`${top} .screenbar h1`)), 'a sequence in a column opens it');
    ok(!!(await p.$(`${top} details.epfold[data-epfold="seqmore"]:not([open])`)), 'its page folds the rest under More about this sequence');
    await p.evaluate(() => { Screens.pop(); Screens.pop(); }); await p.waitForTimeout(500);

    /* the day: every sequence on it, Steps or Storyboard */
    await p.evaluate(() => Screens.push('vlog-day', { vlogId: 'v1', actId: 'a1' })); await p.waitForTimeout(1500);
    ok(!!(await p.$(`${top} .sb-switch`)), 'the day has the Steps | Storyboard switch');
    if(!(await p.$(`${top} .sc-host`))) { await p.click(`${top} .seqcard .sc-head`).catch(() => {}); await p.waitForTimeout(800); }
    await p.click(`${top} .sb-switch [data-sbv="board"]`); await p.waitForTimeout(1200);
    ok((await p.$$(`${top} .dcols .dcol .tp-shot`)).length === 2 && /Beginning|1 ·/.test(await p.textContent(`${top} .dcols`)) === false, 'Storyboard: the day’s sequence is a column of shot cards');
    await p.fill(`${top} .sc-host [data-sbf="text"][data-i="0"]`, 'Walk in the door'); await p.waitForTimeout(1000);
    ok((await p.evaluate(() => Store.get('vlogs', 'v1'))).acts[0].beats[0].shots[0].text === 'Walk in the door', 'and its edits land on the sequence');
    await p.screenshot({ path: path.join(out, `sb-day-${name}.png`) });
    /* the details fold */
    await p.evaluate(() => localStorage.setItem('cs4-sb-details', '0'));
    await p.click(`${top} .sb-switch [data-sbv="steps"]`); await p.waitForTimeout(600); await p.click(`${top} .sb-switch [data-sbv="board"]`); await p.waitForTimeout(1000);
    ok(!(await p.$(`${top} .dcol [data-sbf="role"]`)) && (await p.$$(`${top} .dcol .sb-facts`)).length === 2, 'cards fold to frame, words and one line of facts');
    ok((await p.$$(`${top} .dcol .sb-then [data-then]`)).length === 1, 'THEN shows between the shots even folded');
    /* a short as a shot */
    await p.click(`${top} .dcol [data-sbaddclip]`); await p.waitForTimeout(500);
    await p.fill('#sheet [data-newclip]', 'Morning routine short'); await p.click('#sheet [data-mkclip]'); await p.waitForTimeout(1200);
    let vb = (await p.evaluate(() => Store.get('vlogs', 'v1'))).acts[0].beats[0].shots;
    const clipRec2 = vb[2] && vb[2].clip ? await p.evaluate(id => Store.get('clips', id), vb[2].clip) : null;
    ok(vb.length === 3 && clipRec2 && clipRec2.title === 'Morning routine short' && /Short · Morning routine short/.test(await p.textContent(`${top} .dcol .sb-clip`)),
      '＋ Short or clip: a new short becomes a shot that points at it', JSON.stringify(vb.map(x => [x.text, x.clip])));
    await p.click(`${top} .dcol .tp-shot:nth-child(2) [data-sbmore]`); await p.waitForTimeout(400);
    ok((await p.$$(`${top} .dcol [data-sbf="role"]`)).length === 1, 'Details opens just that card');
    await p.fill(`${top} .dcol .tp-shot:nth-child(2) [data-sbf="desc"]`, 'Sweat on the bar'); await p.waitForTimeout(900);
    ok((await p.evaluate(() => Store.get('vlogs', 'v1'))).acts[0].beats[0].shots[1].desc === 'Sweat on the bar', 'Details has a description line, and it saves');
    await p.click(`${top} .dcol .tp-shot:nth-child(3) [data-sbmore]`); await p.waitForTimeout(400);
    await p.click(`${top} .dcol .tp-shot:nth-child(3) [data-sbrm]`); await p.waitForTimeout(800);
    await p.evaluate(() => localStorage.setItem('cs4-sb-details', '1'));
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(400);
    await p.evaluate(() => Screens.push('vlog-beat', { vlogId: 'v1', beatId: 'b1' })); await p.waitForSelector(`${top} .tp-shot`, { timeout: 6000 }).catch(() => {});
    await p.waitForTimeout(600);
    ok((await p.$$(`${top} .tp-shot`)).length === 2, 'the sequence’s own page opens in the Storyboard too (the choice is remembered)');
    ok(!!(await p.$(`${top} [data-sbshootall]`)) && (await p.$$(`${top} .tp-shead [data-sbmore]`)).length === 0, 'with ▶ Shoot mode on top (and every card open, details shown)');
    await p.selectOption(`${top} [data-sbf="role"][data-i="1"]`, 'Insert'); await p.waitForTimeout(600);
    await p.selectOption(`${top} [data-then="0"]`, 'Dissolve'); await p.waitForTimeout(600);
    let v = await p.evaluate(() => Store.get('vlogs', 'v1'));
    const bs = v.acts[0].beats[0].shots;
    ok(bs[1].role === 'Insert' && bs[1].framing === 'Medium' && bs[0].tr.n === 'Dissolve' && bs[0].id === 'x1' && bs[0].text === 'Walk in the door', 'its edits land on the sequence, ids kept', JSON.stringify(bs));
    await p.screenshot({ path: path.join(out, `sb-seq-${name}.png`) });
    await p.click(`${top} .sb-switch [data-sbv="steps"]`); await p.waitForTimeout(1200);
    /* the Steps: transitions can be added there too */
    await p.evaluate(() => localStorage.setItem('cs4-show-tr', '0'));
    await p.click(`${top} .tk-trtog`); await p.waitForTimeout(700);
    ok((await p.$$(`${top} .tk-trm`)).length >= 1, 'Steps: Show transitions puts a marker in every gap');
    await p.click(`${top} .tk-trm [data-trset]`); await p.waitForTimeout(500);
    await p.click('#sheet [data-plain="J-cut"]'); await p.waitForTimeout(1200);
    ok(((await p.evaluate(() => Store.get('vlogs', 'v1'))).acts[0].beats[0].shots[0].tr || {}).n === 'J-cut', 'and a gap’s ✎ / + transition picks one (plain ones too)');
    await p.evaluate(() => localStorage.setItem('cs4-show-tr', '0'));
    await p.click(`${top} .tk-trtog`); await p.waitForTimeout(500);
    await p.click(`${top} [data-tick="1"]`).catch(() => {}); await p.waitForTimeout(1200);
    v = await p.evaluate(() => Store.get('vlogs', 'v1'));
    const bs2 = v.acts[0].beats[0].shots;
    ok(bs2[1].done && bs2[1].framing === 'Medium' && bs2[1].text === 'Warm up' && bs2[0].text === 'Walk in the door' && bs2[0].tr && bs2[0].tr.n === 'J-cut', 'ticking a sequence’s Steps keeps the shot type and THEN', JSON.stringify(bs2.map(s => [s.text, s.framing, s.done, s.tr && s.tr.n])));

    /* shoot mode: shot 1, its sequence's parts, then shot 2 */
    await p.evaluate(async () => {
      const v = await Store.get('vlogs', 'v1'); const b = v.acts[0].beats[0];
      const q = Notebook.copyNew(Notebook.stepsPage('Walk in the door'));
      q.slots = [{ text: 'Hand on the handle', item: '' }, { text: 'Door swings', item: '' }, { text: 'Feet over the line', item: '' }];
      b.shots[0].seq = q; b.shots[0].done = false; b.shots[1].done = false; b.shotsSig = '';
      await Store.put('vlogs', v);
      Screens.push('shoot-run', { host: ShotList.hostBeat('v1', 'b1') });
    });
    await p.waitForSelector('.sr-k', { timeout: 6000 }).catch(() => {}); await p.waitForTimeout(600);
    const order = [];
    for(let k = 0; k < 5; k++){ order.push((await p.textContent('.sr-k')).trim().split(' · ').slice(0, 2).join(' · ')); await p.click('[data-next]').catch(() => {}); await p.waitForTimeout(250); }
    ok(/^Shot 1$/.test(order[0]) && /^Shot 1\.1 · part 1 of 3/.test(order[1]) && /^Shot 1\.3/.test(order[3]) && /^Shot 2/.test(order[4]), 'shoot mode: shot 1, then the 3 shots inside it, then shot 2', order.join(' → '));
    await p.click('.sr-dots [data-go="1"]'); await p.waitForTimeout(300);
    ok(/Hand on the handle/.test(await p.textContent('.sr-t')), 'a part shows its own words');
    await p.screenshot({ path: path.join(out, `sb-shoot-${name}.png`) });
    await p.click('[data-got]'); await p.waitForTimeout(900);
    const vv = await p.evaluate(() => Store.get('vlogs', 'v1'));
    const sh0 = vv.acts[0].beats[0].shots[0];
    ok(sh0.seq && sh0.seq.slots[0].done && !sh0.done && /Door swings/.test(await p.textContent('.sr-t')), 'Got it ticks that part (not the whole shot) and moves to the next part', JSON.stringify(sh0.seq && sh0.seq.slots.map(x => x.done)));
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(500);
    await ctx.close();
  }
  await b.close();
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
