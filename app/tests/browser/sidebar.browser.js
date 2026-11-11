/* Browser test: on a wide window the tabs are a left sidebar; on a phone
   they are the bottom bar as before. Screenshots of the main places.
     cd app && bash build-preview.sh && cd .. && xvfb-run node app/tests/browser/sidebar.browser.js /tmp */
const { chromium } = require('playwright-core');
(async () => {
  const out = process.argv[2] || '/tmp';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  let fails = 0; const errs = [];
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if (!c) fails++; };
  const url = 'file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html');

  const p = await b.newPage({ viewport: { width: 1366, height: 800 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(1500);
  const rail = await p.evaluate(() => { const r = document.querySelector('#dock').getBoundingClientRect(); return { x: r.x, w: Math.round(r.width), h: Math.round(r.height) }; });
  ok(rail.x === 0 && rail.w === 92 && rail.h === 800, 'the tabs are a full-height rail on the left', rail);
  const view = await p.evaluate(() => Math.round(document.querySelector('#view').getBoundingClientRect().left));
  ok(view >= 92, 'the page starts right of the rail', view);
  await p.screenshot({ path: out + '/side-today.png' });
  await p.click('.tab[data-tab="tools"]'); await p.waitForTimeout(500);
  const panel = await p.evaluate(() => { const r = document.querySelector('#panel').getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width) }; });
  ok(panel.x === 92 && panel.w === 460, 'Tools opens beside the rail', panel);
  await p.screenshot({ path: out + '/side-tools.png' });
  await p.click('.tool[data-tool="shots"]'); await p.waitForTimeout(800);
  const scr = await p.evaluate(() => { const s = [...document.querySelectorAll('.screen')].pop(); return s ? Math.round(s.getBoundingClientRect().left) : null; });
  ok(scr === 92, 'a pushed screen keeps the rail visible', scr);
  await p.screenshot({ path: out + '/side-screen.png' });
  await p.click('.tab[data-tab="series"]'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => Screens.depth()) === 0, 'a sidebar tab closes the screen that was open');
  await p.click('.ctnav [data-v="boards"]'); await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/side-boards.png' });
  const nav = await p.evaluate(() => { const r = document.querySelector('.ctnav').getBoundingClientRect(); return { left: Math.round(r.left), bottom: Math.round(innerHeight - r.bottom) }; });
  ok(nav.left > 92 && nav.bottom < 40, 'the section nav sits at the bottom, right of the rail', nav);
  await p.close();

  const m = await b.newPage({ viewport: { width: 412, height: 900 } }); m.on('pageerror', e => errs.push(e.message));
  await m.goto(url); await m.waitForTimeout(1500);
  const bar = await m.evaluate(() => { const r = document.querySelector('#dock').getBoundingClientRect(); return { y: Math.round(r.y), w: Math.round(r.width) }; });
  ok(bar.w === 412 && bar.y > 800, 'on a phone the tab bar is still at the bottom', bar);
  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
