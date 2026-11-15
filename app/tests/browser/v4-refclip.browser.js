/* Browser test: a reference video on a storyboard shot — a section of
   someone else's video (0:10 → 1:23) to recreate, played just that far.

     node app/tests/browser/v4-refclip.browser.js [outDir] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const appDir = path.resolve(__dirname, '../..');
const url = 'file:///' + path.join(appDir, 'index.html').replace(/\\/g, '/');
const top = '.screen:last-child';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  for(const [w, h, name] of [[1440, 900, 'laptop'], [400, 860, 'phone']]){
    console.log(`\n— ${name} —`);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 600 });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('dialog', d => d.accept());
    await p.route(/github\.io|youtube|ytimg/, r => r.fulfill({ status:200, contentType:'text/html', body:'<p>stub</p>' }));
    await p.goto(url); await p.waitForFunction(() => window.App && window.ShotBoard && window.RefClip, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    ok(await p.evaluate(() => [RefClip.parse('1:23'), RefClip.parse('83'), RefClip.parse('1m23s'), RefClip.parse('1:02:05'), RefClip.timeIn('https://youtu.be/x?t=1m5s'), RefClip.fmt(83)].join()) === '83,83,83,3725,65,1:23',
      'times read as 1:23, 83, 1m23s or 1:02:05, and from a link’s t=');
    await p.evaluate(async () => {
      const wk = await Data.currentWeek();
      await Store.put('vlogs', { id:'v1', title:'Week 2', week:wk, acts:[{ id:'a1', title:'Monday', beats:[
        { id:'b1', title:'Drive', shots:[{ id:'s1', text:'Speed ramp past the car' }, { id:'s2', text:'Pull away' }] }] }] });
      Screens.push('vlog-day', { vlogId:'v1', actId:'a1' });
    });
    await p.waitForTimeout(1800);
    const shots = () => p.evaluate(async () => (await Store.get('vlogs', 'v1')).acts[0].beats[0].shots);
    ok((await p.$$(`${top} [data-sbvedit]`)).length === 2, 'every storyboard card has ＋ Reference video');
    await p.click(`${top} [data-sbvedit="0"]`); await p.waitForTimeout(500);
    await p.fill('#sheet [data-rcurl]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'); await p.dispatchEvent('#sheet [data-rcurl]', 'change');
    ok(await p.inputValue('#sheet [data-rcfrom]') === '0:10', 'a link with a time in it fills From', await p.inputValue('#sheet [data-rcfrom]'));
    await p.fill('#sheet [data-rcto]', '0:05'); await p.click('#sheet [data-rcok]'); await p.waitForTimeout(300);
    ok(/after/.test(await p.textContent('#sheet [data-rcmsg]')), '“To” before “From” is caught');
    await p.fill('#sheet [data-rcto]', '1:23'); await p.fill('#sheet [data-rcn]', 'The ramp into the reveal');
    await p.click('#sheet [data-rcok]'); await p.waitForTimeout(1300);
    let s = await shots();
    ok(s[0].vref && s[0].vref.start === 10 && s[0].vref.end === 83 && s[0].vref.n === 'The ramp into the reveal', 'saved on the shot: the link, 0:10 to 1:23, and what to take', JSON.stringify(s[0].vref));
    ok(/Reference · YouTube · 0:10 – 1:23/.test(await p.textContent(`${top} [data-sbvplay="0"]`)), 'the card shows ▶ Reference · YouTube · 0:10 – 1:23');
    await p.screenshot({ path: path.join(out, `refclip-${name}.png`) });
    await p.click(`${top} [data-sbvplay="0"]`); await p.waitForTimeout(700);
    const src = await p.$eval('.spl-frame', f => f.getAttribute('src')).catch(() => '');
    ok(/yt\.html\?v=dQw4w9WgXcQ.*&t=10&e=83/.test(src), 'it plays just that section — starts at 0:10, stops at 1:23', src);
    await p.evaluate(() => SwipePlayer.close()); await p.waitForTimeout(300);
    /* shoot mode has it too */
    await p.evaluate(() => Screens.push('shoot-run', { host:ShotList.hostBeat('v1', 'b1') })); await p.waitForTimeout(1500);
    ok(/Reference · YouTube · 0:10 – 1:23/.test(await p.textContent('.sr [data-vref]').catch(() => '')), 'shoot mode shows the reference on that shot');
    await p.click('.sr [data-vref]'); await p.waitForTimeout(600);
    ok(/&t=10&e=83/.test(await p.$eval('.spl-frame', f => f.getAttribute('src')).catch(() => '')), 'and plays the same section');
    await p.evaluate(() => SwipePlayer.close()); await p.click('[data-next]'); await p.waitForTimeout(500);
    ok(!(await p.$('.sr [data-vref]')), 'a shot with no reference has no button');
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(700);
    /* take it off */
    await p.click(`${top} [data-sbvedit="0"]`); await p.waitForTimeout(500);
    await p.click('#sheet [data-rcoff]'); await p.waitForTimeout(1200);
    ok(!(await shots())[0].vref && (await p.$$(`${top} [data-sbvplay]`)).length === 0, 'Take it off removes it');
    await ctx.close();
  }
  /* yt.html passes the stop time to YouTube */
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.route(/youtube/, r => r.fulfill({ status:200, contentType:'text/html', body:'' }));
  await p.goto('file:///' + path.join(appDir, 'yt.html').replace(/\\/g, '/') + '?v=dQw4w9WgXcQ&t=10&e=83'); await p.waitForTimeout(500);
  const inner = await p.$eval('iframe', f => f.src);
  ok(/start=10/.test(inner) && /end=83/.test(inner), 'yt.html asks YouTube to start at 10 s and end at 83 s', inner);
  await b.close();
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
