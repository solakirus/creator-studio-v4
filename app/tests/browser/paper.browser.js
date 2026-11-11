/* Browser test: Paper from Today — today's tasks printed on the page,
   ticking one ticks the real task, ink is saved, week and month pages open.
     cd app && bash build-preview.sh && cd .. && xvfb-run node app/tests/browser/paper.browser.js /tmp */
const { chromium } = require('playwright-core');
(async () => {
  const out = process.argv[2] || '/tmp';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if (!c) fails++; };
  await p.goto('file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html')); await p.waitForTimeout(1500);
  const today = await p.evaluate(() => Data.currentDay());
  await p.evaluate(async d => {
    await Store.put('tasks', { id: 801, day: d, title: 'Film the tent build', kind: 'shoot', at: '09:00', mins: 120, view: 'todo', cad: '', pri: 'med', subs: [] });
    await Store.put('tasks', { id: 802, day: d, title: 'Call the gutter guy', view: 'todo', cad: '', pri: 'med', subs: [] });
    Data.invalidate('tasks');
  }, today);
  await p.click('#tabbar .tab:nth-child(1)'); await p.waitForTimeout(600);
  await p.click('[data-act="paper"]'); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => Screens.topId()) === 'paper', 'the pen button on Today opens Paper');
  const txt = await p.evaluate(() => document.querySelector('.pp-wrap').innerText);
  ok(/Film the tent build/.test(txt) && /Call the gutter guy/.test(txt), "today's tasks are printed on the page");
  await p.screenshot({ path: out + '/paper-day.png' });
  /* the writing layer sits over the page; a tap on it reaches the box underneath */
  const tick = await p.$('[data-tick="task:802"]');
  if (tick) { const bb = await tick.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(900); }
  ok(await p.evaluate(async () => (await Data.tasks()).find(t => t.id === 802).view) === 'done', 'ticking it on paper ticks the task');

  const ink = await p.$('.pp-ink');
  if (ink) {
    const r = await ink.boundingBox();
    await p.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.7); await p.mouse.down();
    for (let i = 0; i < 12; i++) await p.mouse.move(r.x + r.width * (0.3 + i * 0.02), r.y + r.height * (0.7 + Math.sin(i) * 0.02));
    await p.mouse.up(); await p.waitForTimeout(1600);
  }
  const saved = await p.evaluate(async () => { const { keys, values } = await Store.all('settings');
    const i = keys.findIndex(k => /^paper:day:/.test(k)); return i < 0 ? 0 : (values[i].L.strokes.length + values[i].R.strokes.length); });
  ok(saved >= 1, 'writing on the page saves the ink', saved);
  for (const m of ['week', 'month']) {
    const btn = await p.$(`[data-go="${m}"], [data-pa="${m}"], button:has-text("${m[0].toUpperCase() + m.slice(1)}")`);
    if (btn) { await btn.click({ force: true, timeout: 3000 }).catch(() => {}); await p.waitForTimeout(800); }
    await p.screenshot({ path: `${out}/paper-${m}.png` });
  }
  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
