/* Browser test: an episode's ▶ Shoot today — shoot mode through the day's
   sequences one after another — and the time chip on a day's sequences.

     node app/tests/browser/v4-shoottoday.browser.js [outDir] */
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
    await p.goto(url); await p.waitForFunction(() => window.App && window.ShotList, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    const todayName = await p.evaluate(async () => {
      const wk = await Data.currentWeek();
      const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const tn = names[new Date().getDay()];
      await Store.put('vlogs', { id: 'v1', title: 'Week 2', week: wk, acts: names.map((d, i) => ({ id: 'a' + i, title: d, beats: d !== tn ? [] : [
        { id: 'b1', title: 'Wake up', shots: [{ id: 's1', text: 'Alarm' }, { id: 's2', text: 'Coffee' }] },
        { id: 'b2', title: 'Gym', at: '06:30', shots: [{ id: 's3', text: 'Walk in' }] },
        { id: 'b3', title: 'Wind down', shots: [{ id: 's4', text: 'Sunset' }] }] })) });
      Screens.push('vlog', { id: 'v1' });
      return tn;
    });
    await p.waitForTimeout(1500);
    const btn = await p.textContent(`${top} [data-a="mode-week"]`);
    ok(/Shoot today/.test(btn), 'the episode’s Shoot is now ▶ Shoot today', btn.trim());
    await p.click(`${top} [data-a="mode-week"]`); await p.waitForSelector('.sr-q', { timeout: 6000 }).catch(() => {});
    await p.waitForTimeout(500);
    const q1 = await p.textContent('.sr-q');
    ok(/Sequence 1 of 3 · Gym · then Wake up/.test(q1), 'it walks today’s sequences, a set time first', q1);
    await p.screenshot({ path: path.join(out, `st-${name}.png`) });
    await p.click('[data-got]'); await p.waitForTimeout(900);
    ok(/All 1 shots taken|Next sequence/.test(await p.textContent('.sr')), 'the last shot of a sequence offers the next one');
    await p.click('.sr-all [data-nexttask]'); await p.waitForTimeout(1200);
    ok(/Sequence 2 of 3 · Wake up/.test(await p.textContent('.sr-q')), 'Next sequence goes straight on');
    await p.click('[data-next]'); await p.waitForTimeout(400); await p.click('[data-next]'); await p.waitForTimeout(1200);
    ok(/Sequence 3 of 3 · Wind down · the last one today/.test(await p.textContent('.sr-q')), '› past the last shot goes on to the next sequence too');
    await p.click('[data-prev]'); await p.waitForTimeout(1200);
    ok(/Sequence 2 of 3/.test(await p.textContent('.sr-q')) && /Coffee/.test(await p.textContent('.sr-t')), '‹ from the first shot goes back to the last shot of the one before');
    const gym = await p.evaluate(async () => (await Store.get('vlogs', 'v1')).acts.flatMap(a => a.beats).find(x => x.id === 'b2').shots[0].done);
    ok(gym, 'its ticks land on the sequences');
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(600);

    /* the time chip */
    const actId = await p.evaluate(async tn => (await Store.get('vlogs', 'v1')).acts.find(a => a.title === tn).id, todayName);
    await p.evaluate(id => Screens.push('vlog-day', { vlogId: 'v1', actId: id }), actId); await p.waitForTimeout(1300);
    const chips = await p.$$eval(`${top} [data-seqtime]`, x => x.map(y => y.textContent.trim()));
    ok(chips.length === 3 && chips.includes('🕘 6:30 AM') && chips.includes('＋ Time'), 'each sequence on the day has a time chip', chips.join(' | '));
    await p.click(`${top} [data-seqtime="b3"]`); await p.waitForTimeout(400);
    await p.fill('#sheet .dc-tin', '19:15'); await p.click('#sheet [data-tok]'); await p.waitForTimeout(900);
    const at = await p.evaluate(async () => (await Store.get('vlogs', 'v1')).acts.flatMap(a => a.beats).find(x => x.id === 'b3').at);
    ok(at === '19:15' && /7:15 PM/.test(await p.textContent(`${top} [data-seqtime="b3"]`)), 'setting it saves the time on the sequence', at);
    await p.evaluate(() => localStorage.setItem('cs4-shots-view', 'board')); await p.evaluate(() => Screens.pop()); await p.waitForTimeout(300);
    await p.evaluate(id => Screens.push('vlog-day', { vlogId: 'v1', actId: id }), actId); await p.waitForTimeout(1300);
    ok((await p.$$(`${top} .dcol [data-seqtime]`)).length === 3, 'the chip is on the Storyboard columns too');
    await p.screenshot({ path: path.join(out, `st-day-${name}.png`) });
    await p.evaluate(() => { Screens.pop(); Screens.pop(); App.go('today'); }); await p.waitForTimeout(1500);
    const tday = await p.evaluate(() => document.querySelector('#todayList') ? document.querySelector('#todayList').innerText : '');
    const gymCards = await p.evaluate(() => [...document.querySelectorAll('#todayList [data-derived="beat"]')].map(c => c.innerText.split('\n').filter(Boolean).slice(0, 2).join(' ')));
    ok(gymCards.length === 3 && /Wind down/.test(tday) && /Gym/.test(tday), 'Today lists the day’s sequences, once each, at their times', JSON.stringify(gymCards));
    await ctx.close();
  }
  await b.close();
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
