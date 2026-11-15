/* Browser test: a clip's (and a series episode's) slim Shoot tab — the
   shoot day that puts it on the to-do list, its time, ▶ Shoot mode and the
   tick list.

     node app/tests/browser/v4-clipshoot.browser.js [outDir] */
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
    await p.goto(url); await p.waitForFunction(() => window.App && window.ClipFlow, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    for(const kind of ['clip', 'series episode']){
      console.log(`  · ${kind}`);
      const title = kind === 'clip' ? 'Ram won’t run' : 'Can I get a ride — part 1';
      const cid = await p.evaluate(async ([kind, title]) => {
        if(kind === 'clip') return (await Data.saveClip({ title, state:'raw', stage:'idea', plan:{ tab:'plan' } })).id;
        await Store.put('series', { id:'sr_r', title:'Can I get a ride', state:'live', createdAt:Date.now() }); Data.invalidate('series');
        const v = await Videos.save({ title, seriesId:'sr_r', order:1 }); await ClipFlow.migrate(); return ClipFlow.idFor(v.id);
      }, [kind, title]);
      const rec = () => p.evaluate(async id => { const c = await Store.get('clips', id); const t = c.shootTaskId ? await Store.get('tasks', c.shootTaskId) : null; return { c, t }; }, cid);
      /* Plan first, so it has its three beats and shots */
      await p.evaluate(id => Screens.push('clip', { id, tab:'plan' }), cid); await p.waitForTimeout(1800);
      await p.click(`${top} [data-ctab="shoot"]`); await p.waitForTimeout(1500);
      ok(/Not on a day yet/.test(await p.textContent(`${top} .cps-when`)) && (await p.$$(`${top} .cps-row`)).length === 3, 'Shoot: not on a day yet, its shots in a tick list');
      await p.click(`${top} [data-a="toshoot"]`); await p.waitForTimeout(800);
      await p.click('#sheet [data-ok]'); await p.waitForTimeout(1800);
      let r = await rec();
      const today = await p.evaluate(() => Data.currentDay());
      ok(r.t && r.t.day === today && r.t.kind === 'shoot', 'Put it on a day makes a shoot task on that day', r.t && r.t.day);
      ok(/On your to-do list/.test(await p.textContent(`${top} .cps-when`)) && /🎬 Shoot/.test(await p.textContent(`${top} .cp-meta`)), 'the card and the clip’s header show the shoot day');
      await p.click(`${top} [data-a="shoottime"]`); await p.waitForTimeout(500);
      await p.fill('#sheet .cps-tin', '07:30'); await p.click('#sheet [data-tok]'); await p.waitForTimeout(1500);
      r = await rec();
      ok(r.t.at === '07:30' && /7:30 AM/.test(await p.textContent(`${top} [data-a="shoottime"]`)), 'the time chip sets when on that day', r.t.at);
      await p.click(`${top} [data-cpstick="0"]`); await p.waitForTimeout(1500);
      r = await rec();
      ok((r.t.subs || []).find(x => x.shot === 0).done && /1 of 3/.test(await p.textContent(`${top} [data-cpsn]`)), 'a tick lands on the shoot task too');
      if(kind === 'clip' && name === 'laptop') await p.screenshot({ path: path.join(out, `clipshoot-${name}.png`) });
      if(kind === 'clip' && name === 'phone') await p.screenshot({ path: path.join(out, `clipshoot-${name}.png`) });
      await p.click(`${top} [data-a="shootgo"]`); await p.waitForTimeout(1500);
      ok(!!(await p.$('.sr')) && /Shot 2|2 \//.test(await p.textContent('.sr')), 'Shoot mode opens on the shoot task, at the first shot not taken');
      await p.evaluate(() => Screens.pop()); await p.waitForTimeout(800);
      await p.evaluate(() => { Screens.pop(); App.go('today'); }); await p.waitForTimeout(1800);
      const td = await p.evaluate(() => (document.querySelector('#todayList') || {}).innerText || '');
      ok(td.includes(title) && /7:30/.test(td), 'it is on today’s to-do list, at 7:30', td.replace(/\s+/g, ' ').slice(0, 100));
    }
    await ctx.close();
  }
  await b.close();
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
