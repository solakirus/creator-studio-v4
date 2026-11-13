/* Browser test: View as Grid / Big / List on a laptop-width screen
   (viewas.js), for the Swipe file, Clips and Vlog, in the app and the
   Planner. The phone keeps its own layout and shows no switch.

     node app/tests/browser/v4-viewas.browser.js */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');

(async () => {
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.waitForFunction(() => window.App && window.Store && window.ViewAs, null, { timeout: 15000 });
  await p.evaluate(async () => {
    for(let i = 0; i < 9; i++) await Store.put('swipes', { id:'s' + i, title:'Swipe ' + i, url:'https://example.com/' + i, source:'reel', createdAt:Date.now() - i });
    for(let i = 0; i < 6; i++) await Store.put('clips', { id:'c' + i, title:'Clip ' + i, channel:'', stage:'plan', createdAt:Date.now() - i });
    await Store.put('vlogs', { id:'v1', title:'Week one', createdAt:Date.now() });
  });
  await p.waitForTimeout(500);

  console.log('\n— the swipe file —');
  await p.evaluate(() => App.go('series')); await p.waitForTimeout(700);
  await p.click('.ctnav [data-v="swipe"]'); await p.waitForTimeout(900);
  const sw = await p.evaluate(() => {
    const g = document.querySelector('.swipegrid'), t = g.querySelector('.thumb');
    return { cls:g.className, cols:getComputedStyle(g).gridTemplateColumns.split(' ').length, th:t.getBoundingClientRect().height,
      tw:t.getBoundingClientRect().width, pick:getComputedStyle(document.querySelector('[data-lay-pick="swipe"]')).display };
  });
  ok(sw.pick !== 'none', 'a laptop screen shows the Grid / Big / List switch');
  ok(/lay-grid/.test(sw.cls) && sw.cols >= 6, 'Grid by default: many swipes across, not two', `${sw.cols} across`);
  ok(sw.th > 100 && Math.abs(sw.th - sw.tw * 1.25) < 2, 'each swipe shows its picture, 4:5', `${Math.round(sw.tw)}×${Math.round(sw.th)}`);
  await p.click('[data-lay-pick="swipe"] [data-lay="list"]'); await p.waitForTimeout(400);
  const swl = await p.evaluate(() => {
    const g = document.querySelector('.swipegrid'), c = g.querySelector('.swipecard');
    return { cls:g.className, h:c.getBoundingClientRect().height, dir:getComputedStyle(c).flexDirection,
      pressed:document.querySelector('[data-lay-pick="swipe"] [data-lay="list"]').getAttribute('aria-pressed') };
  });
  ok(/lay-list/.test(swl.cls) && swl.dir === 'row' && swl.h < 100 && swl.pressed === 'true', 'List: short rows, picture at the side', `${Math.round(swl.h)}px tall`);
  await p.click('[data-lay-pick="swipe"] [data-lay="big"]'); await p.waitForTimeout(400);
  const swb = await p.evaluate(() => getComputedStyle(document.querySelector('.swipegrid')).gridTemplateColumns.split(' ').length);
  ok(swb >= 3 && swb < sw.cols, 'Big: fewer, larger cards', `${swb} across`);

  console.log('\n— Clips and Vlog —');
  await p.click('.ctnav [data-v="clips"]'); await p.waitForTimeout(900);
  const cl = await p.evaluate(() => { const l = document.getElementById('clipList');
    return { cls:l.className, cols:getComputedStyle(l).gridTemplateColumns.split(' ').length }; });
  ok(/lay-grid/.test(cl.cls) && cl.cols >= 3, 'Clips in Grid sit side by side', `${cl.cols} across`);
  await p.click('[data-lay-pick="clips"] [data-lay="list"]'); await p.waitForTimeout(300);
  const cll = await p.evaluate(() => document.querySelector('#clipList .mediacard .card').getBoundingClientRect().height);
  ok(cll < 70, 'Clips in List are one short line each', `${Math.round(cll)}px`);
  await p.click('.ctnav [data-v="episodes"]'); await p.waitForTimeout(900);
  const vl = await p.evaluate(() => [...document.querySelectorAll('[data-lay-host="vlog"]')].map(l => l.className).join(','));
  ok(/lay-grid/.test(vl), 'Vlog lists take the switch too', vl);

  console.log('\n— kept —');
  await p.reload(); await p.waitForFunction(() => window.App && window.ViewAs, null, { timeout: 15000 }); await p.waitForTimeout(600);
  await p.evaluate(() => App.go('series')); await p.waitForTimeout(700);
  await p.click('.ctnav [data-v="clips"]'); await p.waitForTimeout(900);
  const kept = await p.evaluate(() => ({ clips:document.getElementById('clipList').className, swipe:ViewAs.get('swipe') }));
  ok(/lay-list/.test(kept.clips) && kept.swipe === 'big', 'each list remembers its own choice', JSON.stringify(kept));

  console.log('\n— the Planner —');
  const pp = await ctx.newPage(); pp.on('pageerror', e => errs.push(e.message));
  await pp.goto(url + '?planner'); await pp.waitForFunction(() => window.App && window.ViewAs, null, { timeout: 15000 }); await pp.waitForTimeout(700);
  await pp.click('.tabbar [data-tab="series"]'); await pp.waitForTimeout(700);
  await pp.click('.ctnav [data-v="clips"]'); await pp.waitForTimeout(900);
  ok(await pp.evaluate(() => !!document.querySelector('[data-lay-pick="clips"]') && /lay-list/.test(document.getElementById('clipList').className)),
    'the Planner has the switch on Clips, sharing the choice');

  console.log('\n— the phone —');
  await p.setViewportSize({ width: 400, height: 860 }); await p.waitForTimeout(400);
  const ph = await p.evaluate(() => ({ pick:getComputedStyle(document.querySelector('.laypick')).display,
    h:document.querySelector('#clipList .mediacard .card').getBoundingClientRect().height,
    cols:getComputedStyle(document.getElementById('clipList')).display }));
  ok(ph.pick === 'none' && ph.h > 80 && ph.cols === 'flex', 'a phone shows no switch and keeps its full cards', JSON.stringify(ph));

  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
