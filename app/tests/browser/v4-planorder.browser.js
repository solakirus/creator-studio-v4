/* Browser test: an episode's Plan — sections move by their ⠿ and the order is
   kept for every episode; What to film's sequences drag within a day and to
   another day (mouse, and a held finger); and your default week.

     node app/tests/browser/v4-planorder.browser.js [outDir] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
const top = '.screen:last-child';

async function drag(p, from, to, opt){
  const a = await p.locator(from).first().boundingBox(), b = await p.locator(to).first().boundingBox();
  const ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + (opt && opt.top ? 4 : b.height / 2);
  await p.mouse.move(ax, ay); await p.mouse.down();
  for(let i = 1; i <= 8; i++){ await p.mouse.move(ax + (bx - ax) * i / 8, ay + (by - ay) * i / 8); await p.waitForTimeout(30); }
  await p.mouse.up(); await p.waitForTimeout(900);
}
/* a finger: hold, then move — pointer events with pointerType touch */
async function fingerDrag(p, from, to){
  await p.evaluate(async ([f, t]) => {
    const a = document.querySelector(f).getBoundingClientRect(), b = document.querySelector(t).getBoundingClientRect();
    const ev = (type, x, y, el) => (el || document).dispatchEvent(new PointerEvent(type, { bubbles:true, cancelable:true, pointerType:'touch', pointerId:7, clientX:x, clientY:y, button:0 }));
    const ax = a.x + a.width / 2, ay = a.y + a.height / 2;
    ev('pointerdown', ax, ay, document.querySelector(f));
    await new Promise(r => setTimeout(r, 450));
    for(let i = 1; i <= 6; i++){ ev('pointermove', ax + (b.x + 10 - ax) * i / 6, ay + (b.y + b.height - 6 - ay) * i / 6); await new Promise(r => setTimeout(r, 30)); }
    ev('pointerup', b.x + 10, b.y + b.height - 6);
  }, [from, to]);
  await p.waitForTimeout(900);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  for(const [w, h, name] of [[1440, 900, 'laptop'], [400, 860, 'phone']]){
    console.log(`\n— ${name} —`);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 600 });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('dialog', d => d.accept());
    await p.goto(url); await p.waitForFunction(() => window.App && window.DragSort && window.WeekDefault, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    await p.evaluate(async () => {
      const wk = await Data.currentWeek();
      const days = ['Sunday', 'Monday', 'Tuesday'];
      const mk = (id, title) => ({ id, title, week:wk, format:'weekly', acts:days.map((d, i) => ({ id:id + 'a' + i, title:d, day:null,
        beats:[1, 2, 3].map(n => ({ id:`${id}b${i}${n}`, title:`Sequence ${n}`, setup:'talking', purpose:'', shots:[] })) })) });
      await Store.put('vlogs', mk('v1', 'Week 2')); await Store.put('vlogs', mk('v2', 'Week 3'));
      await Store.del('settings', 'vlog-plan-order'); await WeekDefault.clear();
      Screens.push('vlog', { id:'v1' });
    });
    await p.waitForTimeout(1600);
    const order = () => p.$$eval(`${top} .view > .epblk`, xs => xs.map(x => x.dataset.blk).join());
    ok(await order() === 'quarter,challenge,stands,week,research,film' && (await p.$$(`${top} .epgrip`)).length === 6, 'every section has a ⠿ to move it', await order());
    /* What to film up top, above the challenge */
    if(name === 'laptop') await drag(p, `${top} [data-blk="film"] .epgrip`, `${top} [data-blk="challenge"]`, { top:true });
    else await fingerDrag(p, `${top} [data-blk="film"] .epgrip`, `${top} [data-blk="quarter"]`);
    const o1 = await order();
    ok(o1.indexOf('film') < o1.indexOf('challenge'), 'dragging What to film puts it higher', o1);
    ok(await p.evaluate(async () => (await Store.get('settings', 'vlog-plan-order')).join()) === o1, 'and the order is kept');
    await p.evaluate(() => { Screens.pop(); Screens.push('vlog', { id:'v2' }); }); await p.waitForTimeout(1500);
    ok(await order() === o1, 'another episode opens in the same order');
    await p.evaluate(() => { Screens.pop(); Screens.push('vlog', { id:'v1' }); }); await p.waitForTimeout(1500);
    /* a sequence: Sunday's Sequence 3 to the top of Monday */
    const seq = () => p.evaluate(async () => (await Store.get('vlogs', 'v1')).acts.map(a => a.beats.map(x => x.id).join('|')));
    if(name === 'laptop') await drag(p, `${top} [data-beat="v1b03"]`, `${top} [data-beat="v1b11"]`, { top:true });
    else await fingerDrag(p, `${top} [data-beat="v1b03"]`, `${top} [data-beat="v1b13"]`);
    const s1 = await seq();
    ok(!s1[0].includes('v1b03') && s1[1].split('|').includes('v1b03'), 'a sequence dragged to another day moves there', JSON.stringify(s1));
    if(name === 'laptop'){
      ok(s1[1].split('|')[0] === 'v1b03', 'at the place it was dropped', s1[1]);
      await drag(p, `${top} [data-beat="v1b12"]`, `${top} [data-beat="v1b03"]`, { top:true });
      ok((await seq())[1].split('|')[0] === 'v1b12', 'and within a day they reorder', (await seq())[1]);
    }
    ok(!(await p.evaluate(() => document.querySelector('.screen:last-child').dataset.screen !== 'vlog')), 'a drag doesn’t open the sequence');
    await p.screenshot({ path: path.join(out, `planorder-${name}.png`) });
    /* the default week */
    await p.evaluate(async () => { const v = await Store.get('vlogs', 'v1'); v.acts[0].beats[0].title = 'Wake up'; await Store.put('vlogs', v); Screens.pop(); Screens.push('vlog', { id:'v1' }); });
    await p.waitForTimeout(1500);
    await p.click(`${top} [data-a="weekdefault"]`); await p.waitForTimeout(900);
    const def = await p.evaluate(async () => (await WeekDefault.get()).map(a => a.title + ':' + a.beats.map(x => x.title).join('/')).join(' ; '));
    ok(/^Sunday:Wake up\/Sequence 2/.test(def), 'Make this week my default keeps its days and sequences', def);
    ok(/New weeks start from your default/.test(await p.textContent(`${top} .wkdef`)), 'and says new weeks start from it');
    const ep = await p.evaluate(async () => { const r = await Months.createEpisode({ id:'m1', name:'Nov' }, { week:77, index:1 }); return r.episode.acts.map(a => a.title + ':' + a.beats.map(x => x.title).join('/')).join(' ; '); });
    ok(ep === def && !/shots/.test(ep), 'a new week starts from it', ep);
    await p.click(`${top} [data-a="weekdefault-clear"]`); await p.waitForTimeout(800);
    ok(!(await p.evaluate(() => WeekDefault.get())), '“Back to Sequence 1 · 2 · 3” forgets it');
    await ctx.close();
  }
  await b.close();
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
