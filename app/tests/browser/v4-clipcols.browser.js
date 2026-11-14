/* Browser test: a clip's Plan script as columns — one per beat, side by side
   like a day's sequences — with Beginning · Middle · End to start from.

     node app/tests/browser/v4-clipcols.browser.js [outDir] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
const S = '.screen:last-child #clipScript';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  for(const [w, h, name] of [[1440, 900, 'laptop'], [400, 860, 'phone']]){
    console.log(`\n— ${name} —`);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 600 });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('dialog', d => d.accept());
    await p.goto(url); await p.waitForFunction(() => window.App && window.Structures, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    const cid = await p.evaluate(async () => (await Data.saveClip({ title: 'Morning ritual', state: 'raw', stage: 'idea', plan: { tab: 'plan' } })).id);
    const rec = () => p.evaluate(async id => { const c = await Store.get('clips', id);
      return { beats: c.plan.beats, st: (c.subs || []).filter(x => x.shot != null).sort((a, b) => a.shot - b.shot) }; }, cid);
    await p.evaluate(id => Screens.push('clip', { id, tab: 'plan' }), cid); await p.waitForTimeout(1500);
    ok(!!(await p.$(`${S} [data-st="bme"]`)), 'a clip with no beats offers Beginning · Middle · End');
    await p.click(`${S} [data-st="bme"]`); await p.waitForTimeout(1500);
    let r = await rec();
    ok(r.beats.join() === 'Beginning,Middle,End' && r.st.map(x => x.beat).join() === '0,1,2', 'one tap: three beats, a shot in each', r.beats.join(' → '));
    const cols = await p.$$eval(`${S} .sx-cols > .sx-beat`, x => x.map(y => y.getBoundingClientRect().top));
    ok(cols.length === 3 && (name === 'phone' || Math.abs(cols[0] - cols[2]) < 2), 'the beats are columns, side by side', cols.map(Math.round).join(', '));
    ok(await p.textContent(`${S} .sx-bk`) === 'Beat 1 of 3', 'each column says which beat it is');
    await p.click(`${S} [data-sadd="1"]`); await p.waitForTimeout(1200);
    await p.fill(`${S} [data-sn="3"]`, 'Kettle close-up'); await p.dispatchEvent(`${S} [data-sn="3"]`, 'change'); await p.waitForTimeout(900);
    ok(await p.evaluate(s => document.querySelectorAll(s + ' .sx-beat')[1].querySelectorAll('.sx-shot').length, S) === 2, 'a shot added to a column lands in that beat');
    await p.click(`${S} [data-ladd="3"]`); await p.waitForTimeout(1000);
    await p.fill(`${S} [data-lt="3:0"]`, 'The first hour is mine.'); await p.dispatchEvent(`${S} [data-lt="3:0"]`, 'change'); await p.waitForTimeout(900);
    r = await rec();
    ok(r.st[3].beat === 1 && r.st[3].lines[0].t === 'The first hour is mine.', 'its script line is kept on the shot');
    await p.selectOption(`${S} [data-sbeat="3"]`, '2'); await p.waitForTimeout(1200);
    ok((await rec()).st[3].beat === 2 && await p.evaluate(s => document.querySelectorAll(s + ' .sx-beat')[2].querySelectorAll('.sx-shot').length, S) === 2, 'the beat menu moves a shot to another column');
    await p.click(`${S} [data-bmv="0:1"]`); await p.waitForTimeout(1200);
    ok((await rec()).beats.join() === 'Middle,Beginning,End', '› moves a whole beat one column right');
    await p.click(`${S} [data-bmv="1:-1"]`); await p.waitForTimeout(1200);
    await p.click(`${S} .sx-addcol`); await p.waitForTimeout(900);
    ok((await rec()).beats.length === 4 && (await p.$$(`${S} .sx-cols > .sx-beat`)).length === 4, '＋ Beat adds a column');
    await p.fill(`${S} [data-bn="3"]`, 'Tag'); await p.dispatchEvent(`${S} [data-bn="3"]`, 'change'); await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(out, `clipcols-${name}.png`) });
    await p.click(`${S} [data-sxv="rows"]`); await p.waitForTimeout(500);
    ok(!(await p.$(`${S} .sx-cols`)) && (await p.$$(`${S} .sx-beat`)).length === 4, 'Rows puts them back down the page');
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(300);
    await p.evaluate(id => Screens.push('clip', { id, tab: 'plan' }), cid); await p.waitForTimeout(1300);
    ok(!(await p.$(`${S} .sx-cols`)), 'and the choice is remembered');
    await p.click(`${S} [data-sxv="cols"]`); await p.waitForTimeout(500);
    await ctx.close();
  }
  await b.close();
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
