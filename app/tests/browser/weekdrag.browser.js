/* Browser test: dragging a card to another day on the week board, with a real
   touch pointer. This is the bug the device had — touch-action:pan-x pan-y let
   the browser claim the gesture, so the long-press never fired. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  const ctx = await b.newContext({ viewport:{ width:412, height:900 }, hasTouch:true, isMobile:true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html'));
  await p.waitForTimeout(1500);
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if (!c) fails++; };

  /* two tasks on day 1 of the current week */
  const day1 = await p.evaluate(async () => {
    const d = await Data.currentDay();
    const base = d - ((d - 1) % 7);                 /* first day of this week */
    await Store.put('tasks', { id: 8001, day: base, title:'Replace the turning light', kind:'task', view:'todo', subs:[], cad:'', pri:'med' });
    await Store.put('tasks', { id: 8002, day: base, title:'Walk', kind:'task', view:'todo', subs:[], cad:'', pri:'med' });
    Data.invalidate();
    return base;
  });

  await p.evaluate(() => Screens.push('week-board', {}));
  await p.waitForTimeout(900);

  const cards = await p.locator('.wk-card').count();
  ok(cards >= 2, 'the cards are on the board', cards);

  console.log('\nthe css no longer hands the gesture to the browser');
  const ta = await p.evaluate(() => getComputedStyle(document.querySelector('.wk-card')).touchAction);
  ok(ta === 'none', 'touch-action on a card is none', ta);

  console.log('\nlong-press then drag, with a finger');
  const from = p.locator('.wk-card').first();
  const fb = await from.boundingBox();
  const cols = await p.locator('.wk-col').all();
  const tb = await cols[1].boundingBox();

  /* press, hold past the 280ms, then move to the next column */
  const cdp = await ctx.newCDPSession(p);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX:12, radiusY:12, force:1 }] });

  await touch('touchStart', fb.x + fb.width/2, fb.y + fb.height/2);
  await p.waitForTimeout(420);                       /* past the hold */
  const lifted = await p.evaluate(() => !!document.querySelector('.wk-lifted'));
  ok(lifted, 'the card lifted on the hold');
  const ghost = await p.evaluate(() => !!document.querySelector('.wk-ghost'));
  ok(ghost, 'and a ghost is following the finger');

  /* At phone width a column is 78% of the screen, so the next day is mostly
     off to the right. A finger drags to the edge and the board scrolls the
     next day into view — which is exactly what move() does. */
  const edge = 412 - 14, midY = fb.y + fb.height / 2;
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', fb.x + fb.width/2 + (edge - fb.x - fb.width/2) * i / 8, midY);
    await p.waitForTimeout(40);
  }
  for (let i = 0; i < 25; i++) { await touch('touchMove', edge, midY); await p.waitForTimeout(40); }

  const over = await p.evaluate(() => {
    const c = document.querySelector('.wk-col.over');
    return c ? +c.dataset.day : null;
  });
  ok(over !== null, 'a day is highlighted under the finger', over);
  ok(over === null || over !== day1, 'and it is not the day it started on', { start: day1, over });

  await touch('touchEnd', edge, midY);
  await p.waitForTimeout(800);

  const moved = await p.evaluate(async id => (await Store.get('tasks', id)).day, 8001);
  ok(moved !== day1, 'the task moved off its original day', { was: day1, now: moved });
  ok(moved === over, 'to the day it was dropped on', { dropped: over, now: moved });

  console.log('\na tap still opens the task');
  await p.evaluate(() => { while (Screens.depth() > 1) Screens.pop(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => Screens.push('week-board', {}));
  await p.waitForTimeout(800);
  /* the board scrolled while dragging, so pick a card that is actually on
     screen rather than the first one in the DOM */
  let c2 = null;
  for (const h of await p.locator('.wk-card').all()) {
    const bb = await h.boundingBox();
    if (bb && bb.x > 0 && bb.x + bb.width < 412) { c2 = bb; break; }
  }
  ok(!!c2, 'there is a card on screen to tap');
  await touch('touchStart', c2.x + c2.width/2, c2.y + c2.height/2);
  await p.waitForTimeout(90);
  await touch('touchEnd', c2.x + c2.width/2, c2.y + c2.height/2);
  await p.waitForTimeout(700);
  const onTask = await p.evaluate(() => Screens.topId && Screens.topId());
  ok(onTask === 'task', 'a quick tap opens it', onTask);

  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})();
