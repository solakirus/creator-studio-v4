/* Browser test: the week board in the Month tab — tasks on their days, drag
   to move, tap to open. Laptop size (opens on Week) and phone size.
     cd app && bash build-preview.sh && cd .. && xvfb-run node app/tests/browser/week.browser.js /tmp */
const { chromium } = require('playwright-core');
(async () => {
  const out = process.argv[2] || '/tmp';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if (!c) fails++; };
  const url = 'file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html');
  const errs = [];

  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(1500);
  const today = await p.evaluate(() => Data.currentDay());
  await p.evaluate(async d => {
    const T = (id, day, title, kind, at, extra) => Store.put('tasks', { id, day, title, kind, at, view: 'todo', cad: '', pri: 'med', subs: [], ...extra });
    await T(901, d, 'Film the tent build', 'shoot', '09:00', { shots: [{ text: 'Wide', angles: [{ type: 'wide', done: true }, { type: 'close', done: false }] }] });
    await T(902, d, 'Cut the vlog', 'edit', '14:00', { subs: [{ t: 'Rough cut', done: true }, { t: 'Color', done: false }] });
    await T(903, d + 1, 'Post the short', 'publish', '18:30');
    Data.invalidate('tasks');
  }, today);
  await p.click('#tabbar .tab:nth-child(2)'); await p.waitForTimeout(900);
  const onWeek = await p.evaluate(() => !!document.querySelector('.wk-cols'));
  ok(onWeek, 'on a wide screen the Month tab opens on Week');
  const cols = await p.evaluate(() => [...document.querySelectorAll('.wk-col')].map(c => [c.dataset.day, c.querySelectorAll('.wk-card').length]));
  ok(cols.length === 7, 'seven days', cols);
  await p.screenshot({ path: out + '/week-laptop.png' });

  const card = await p.$('.wk-card[data-task="901"]');
  const target = await p.$(`.wk-col[data-day="${today - 2}"]`);
  if (card && target) {
    const a = await card.boundingBox(), t = await target.boundingBox();
    await p.mouse.move(a.x + 20, a.y + 15); await p.mouse.down();
    await p.mouse.move(a.x + 60, a.y + 40, { steps: 5 });
    await p.mouse.move(t.x + t.width / 2, t.y + 120, { steps: 12 });
    await p.mouse.up(); await p.waitForTimeout(700);
  }
  const moved = await p.evaluate(async () => (await Data.tasks()).find(t => t.id === 901).day);
  ok(moved === today - 2, 'dragging a card moves the task to that day', moved);
  ok(await p.evaluate(d => !!document.querySelector(`.wk-col[data-day="${d}"] .wk-card[data-task="901"]`), today - 2), 'and the board shows it there');
  await p.click('.wk-card[data-task="902"]'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => Screens.topId()) === 'task', 'tapping a card opens the task');
  await p.close();

  const m = await b.newPage({ viewport: { width: 412, height: 900 }, hasTouch: true, isMobile: true });
  m.on('pageerror', e => errs.push(e.message));
  await m.goto(url); await m.waitForTimeout(1500);
  await m.click('#tabbar .tab:nth-child(2)'); await m.waitForTimeout(700);
  ok(await m.evaluate(() => !document.querySelector('.wk-cols')), 'on a phone it still opens on Calendar');
  await m.click('.ctnav [data-mv="week"]'); await m.waitForTimeout(700);
  await m.screenshot({ path: out + '/week-phone.png' });
  ok(await m.evaluate(() => document.querySelectorAll('.wk-col').length) === 7, 'Week is one tap away');

  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
