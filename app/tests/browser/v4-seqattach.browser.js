/* Browser test: a storyboard shot gets a sequence — a blank 9-shot page or
   one of your template pages — and shoot mode runs through it.

     node app/tests/browser/v4-seqattach.browser.js [outDir] */
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
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('dialog', d => d.accept());
    await p.goto(url); await p.waitForFunction(() => window.App && window.ShotBoard && window.ShotTemplates, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    await p.evaluate(async () => {
      const pg = Notebook.stepsPage('Leg day'); pg.name = 'Leg day steps';
      pg.slots = ['Shoes on', 'Chalk up', 'Squat wide', 'Rack it'].map(t => ({ item:'', tone:'', text:t, role:'Action', done:false }));
      await ShotTemplates.create({ name:'Gym day', sheets:[pg] }); ShotTemplates.invalidate();
      const wk = await Data.currentWeek();
      await Store.put('vlogs', { id:'v1', title:'Week 2', week:wk, acts:[{ id:'a1', title:'Monday', beats:[
        { id:'b1', title:'Gym', shots:[{ id:'s1', text:'Walk in' }, { id:'s2', text:'Warm up' }, { id:'s3', text:'Leave' }] }] }] });
      localStorage.setItem('cs4-shots-view', 'board');
      Screens.push('vlog-day', { vlogId:'v1', actId:'a1' });
    });
    await p.waitForTimeout(2000);
    const shots = () => p.evaluate(async () => (await Store.get('vlogs', 'v1')).acts[0].beats[0].shots);
    ok((await p.$$(`${top} [data-sbmkseq]`)).length === 3, 'every storyboard card has ▦ Add a sequence, right on the card');
    await p.click(`${top} [data-sbmkseq="1"]`); await p.waitForTimeout(800);
    const opts = await p.$$eval('#sheet .sb-seqopt', xs => xs.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    ok(/Blank 9-shot page/.test(opts[0]) && opts.some(o => /Gym day · Leg day steps.*4 shots/.test(o)), 'the first choice is a blank 9-shot page, then your template pages', JSON.stringify(opts));
    await p.click('#sheet [data-seqtpl="0"]'); await p.waitForTimeout(1500);
    let s = await shots();
    ok(s[1].seq && s[1].seq.slots.map(x => x.text).join() === 'Shoes on,Chalk up,Squat wide,Rack it', 'a template page is copied in as the shot’s sequence');
    ok(/Sequence · 4 shots/.test(await p.textContent(`${top} [data-sbseq="1"]`)), 'the card shows it: ▦ Sequence · 4 shots');
    await p.screenshot({ path: path.join(out, `seq-${name}.png`) });
    /* shoot mode: shot 2, then the 4 inside it, then shot 3 */
    await p.click(`${top} [data-sbshoot="1"]`); await p.waitForTimeout(1500);
    const seen = [];
    for(let k = 0; k < 6; k++){ seen.push(((await p.textContent('.sr-k').catch(() => '')) + ' ' + (await p.textContent('.sr-t').catch(() => ''))).replace(/\s+/g, ' ').trim()); await p.click('[data-next]').catch(() => {}); await p.waitForTimeout(450); }
    ok(/Warm up/.test(seen[0]) && /Shoes on/.test(seen[1]) && /Rack it/.test(seen[4]) && /Leave/.test(seen[5]), 'shoot mode: the shot, each shot inside it, then the next shot', seen.map(x => x.slice(0, 34)).join(' → '));
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(800);
    /* the blank one opens to be filled */
    await p.click(`${top} [data-sbmkseq="2"]`); await p.waitForTimeout(800);
    await p.click('#sheet [data-seqblank]'); await p.waitForTimeout(1800);
    s = await shots();
    ok(s[2].seq && s[2].seq.slots.length === 9, 'Blank 9-shot page gives nine spots', s[2].seq && s[2].seq.slots.length);
    ok(await p.evaluate(() => document.querySelector('.screen:last-child').dataset.screen) === 'shot-seq', 'and opens it to fill in');
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(800);
    await p.click(`${top} [data-sbunseq="2"]`); await p.waitForTimeout(1200);
    ok(!(await shots())[2].seq && !!(await p.$(`${top} [data-sbmkseq="2"]`)), '✕ takes a sequence off');
    await ctx.close();
  }
  await b.close();
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
