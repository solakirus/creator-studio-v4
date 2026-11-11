/* Browser test: adding a task from the planning screens, for real.

   The static test proves the wiring; this proves the thing works — the sheet
   opens on the day you tapped, the save lands on that day and not on today,
   and a repeat fills the weekdays you picked. */
const { chromium } = require('playwright-core');
(async () => {
  /* This container has no route to Google, and a stock Chromium spends its
     first minute trying anyway — component updater, sync, optimisation hints.
     Switched off, the test starts in a second or two. */
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium',
    headless: true, args:['--no-sandbox', '--disable-dev-shm-usage',
      '--disable-component-update', '--disable-background-networking',
      '--disable-sync', '--disable-default-apps', '--no-first-run',
      '--disable-features=OptimizationHints,Translate'] });
  const ctx = await b.newContext({ viewport:{ width:1280, height:980 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html'));
  await p.waitForTimeout(1600);
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if(!c) fails++; };

  const sheetOpen = () => p.evaluate(() =>
    !!document.getElementById('sheet') && document.getElementById('sheet').classList.contains('open'));
  const tasksOn = day => p.evaluate(async d => {
    const all = Object.values(await Store.allMap('tasks'));
    return all.filter(t => t.day === d).map(t => t.title);
  }, day);

  console.log('the form is loaded as a module');
  ok(await p.evaluate(() => typeof TaskForm === 'object' && typeof TaskForm.open === 'function'),
    'TaskForm.open exists');

  /* ------------------------------------------------- the week board column + */
  console.log('\nthe week board: + on a column');
  await p.evaluate(() => Screens.push('week-board', {}));
  await p.waitForTimeout(700);

  const adds = await p.locator('.wk-add').count();
  ok(adds === 7, 'every day has a +', adds);

  /* the third column, whichever day that is — deliberately not today */
  const targetDay = await p.evaluate(() =>
    +document.querySelectorAll('.wk-col')[2].dataset.day);
  const today = await p.evaluate(() => Data.currentDay());
  ok(Number.isFinite(targetDay), 'the third column names a day', targetDay);

  await p.locator('.wk-add').nth(2).click();
  await p.waitForTimeout(450);
  ok(await sheetOpen(), 'the sheet opened');

  const heading = await p.evaluate(() =>
    (document.querySelector('#sheet .hintline') || {}).textContent || '');
  ok(heading.includes('day ' + targetDay), 'it names the day you tapped, not today',
    heading.trim().slice(0, 60));

  await p.fill('#tf-title', 'Take the bins out');
  await p.locator('[data-tfq="18:00"]').click();
  await p.locator('[data-tfsave]').click();
  await p.waitForTimeout(600);

  ok(!(await sheetOpen()), 'the sheet closed on save');
  const onTarget = await tasksOn(targetDay);
  ok(onTarget.includes('Take the bins out'), 'the task landed on that day', onTarget);
  const onToday = await tasksOn(today);
  ok(targetDay === today || !onToday.includes('Take the bins out'),
    'and not on today', { today, targetDay });

  const saved = await p.evaluate(async () => {
    const all = Object.values(await Store.allMap('tasks'));
    const t = all.find(x => x.title === 'Take the bins out');
    return t && { at:t.at, view:t.view, cad:t.cad, pri:t.pri, kind:t.kind };
  });
  ok(saved && saved.at === '18:00', 'with the time picked', saved);
  ok(saved && saved.view === 'todo' && saved.cad === 'One-off', 'and a normal task shape', saved);
  ok(saved && saved.kind === undefined, 'no kind, so the board leaves it uncoloured');

  console.log('\nand the board shows it without a reload');
  const titles = await p.evaluate(() =>
    [...document.querySelectorAll('.wk-col')[2].querySelectorAll('.wk-title')].map(e => e.textContent));
  ok(titles.includes('Take the bins out'), 'the card is in that column', titles);

  /* ------------------------------------------------------------ the repeat */
  console.log('\na repeat fills the weekdays you pick');
  const before = await p.evaluate(async () => Object.keys(await Store.allMap('tasks')).length);
  await p.locator('.wk-add').nth(2).click();
  await p.waitForTimeout(420);
  await p.fill('#tf-title', 'Gym');
  /* Mon, Wed, Fri */
  for(const d of [1, 3, 5]) await p.locator(`[data-tfdow="${d}"]`).click();
  const freq = await p.evaluate(() => document.querySelector('#tf-freq').textContent);
  ok(/3×\/week/.test(freq), 'the line says what it will do', freq.trim());
  const weeksShown = await p.evaluate(() =>
    !document.querySelector('#tf-weeks').classList.contains('pgoff'));
  ok(weeksShown, 'and asks how long for');
  await p.selectOption('#tf-wk', '2');
  await p.locator('[data-tfsave]').click();
  await p.waitForTimeout(900);

  const gym = await p.evaluate(async () => {
    const all = Object.values(await Store.allMap('tasks')).filter(t => t.title === 'Gym');
    return { n: all.length, days: all.map(t => t.day).sort((a, b) => a - b),
             cad: all[0] && all[0].cad, series: all[0] && !!all[0].series };
  });
  ok(gym.n === 6, 'six sessions over two weeks', gym);
  ok(gym.cad === '3×/week', 'the cadence is recorded', gym.cad);
  ok(gym.series, 'and they share a series key');
  ok(gym.days[0] >= targetDay, 'none landed before the day picked', gym.days);
  const gaps = gym.days.slice(1).map((d, i) => d - gym.days[i]);
  ok(gaps.every(g => g > 0), 'in order, no duplicates', gaps);

  /* ------------------------------------------------------ the month calendar */
  console.log('\nthe month grid: tap a square, put something in it');
  await p.evaluate(() => { Screens.pop && Screens.pop(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => Screens.push('calendar', {}));
  await p.waitForTimeout(800);

  /* a square inside this month, not an outside-the-month filler */
  const dayTs = await p.evaluate(() => {
    const c = [...document.querySelectorAll('.cday:not(.out)')][14]
           || [...document.querySelectorAll('.cday:not(.out)')][0];
    return +c.dataset.day;
  });
  await p.evaluate(ts => {
    const c = [...document.querySelectorAll('.cday')].find(x => +x.dataset.day === ts);
    c.click();
  }, dayTs);
  await p.waitForTimeout(450);
  ok(await sheetOpen(), 'the day sheet opened');
  ok(await p.locator('#sheet [data-add]').count() > 0, 'and offers + Add a task');

  await p.locator('#sheet [data-add]').click();
  await p.waitForTimeout(700);
  ok(await p.locator('#tf-title').count() > 0, 'the form replaced it');

  const calDay = await p.evaluate(ts => Data.dateToDay(ts), dayTs);
  await p.fill('#tf-title', 'Dentist');
  await p.locator('[data-tfsave]').click();
  await p.waitForTimeout(800);

  const onCal = await tasksOn(calDay);
  ok(onCal.includes('Dentist'), 'it landed on the square you tapped', { calDay, onCal });

  console.log('\nand the grid redraws with it on');
  const shown = await p.evaluate(ts => {
    const c = [...document.querySelectorAll('.cday')].find(x => +x.dataset.day === ts);
    return c ? c.textContent : '';
  }, dayTs);
  ok(/Dentist/.test(shown), 'the square shows it', shown.trim().slice(0, 40));

  console.log('\na task on the grid is no longer a dead row');
  await p.evaluate(ts => {
    const c = [...document.querySelectorAll('.cday')].find(x => +x.dataset.day === ts);
    c.click();
  }, dayTs);
  await p.waitForTimeout(420);
  const rows = await p.locator('#sheet [data-task]').count();
  ok(rows > 0, 'it is a button now', rows);
  await p.locator('#sheet [data-task]').first().click();
  await p.waitForTimeout(800);
  const opened = await p.evaluate(() => Screens.topId && Screens.topId());
  ok(opened === 'task', 'tapping it opens the task screen', opened);

  /* -------------------------------------------------------------- day sheet */
  console.log('\nthe day sheet can write to its own day');
  /* Push rather than unwind: looping pop() past the bottom of the stack took
     the page down with it, which failed the test for a reason that was the
     test's own. */
  await p.evaluate(d => Screens.push('daysheet', { day: d }), calDay);
  await p.waitForTimeout(700);
  ok(await p.locator('[data-a="add"]').count() > 0, 'there is a + Task');
  await p.locator('[data-a="add"]').first().click();
  await p.waitForTimeout(450);
  ok(await p.locator('#tf-title').count() > 0, 'the form opens');
  await p.fill('#tf-title', 'Call the plumber');
  await p.locator('[data-tfsave]').click();
  await p.waitForTimeout(800);
  const dsNow = await tasksOn(calDay);
  ok(dsNow.includes('Call the plumber'), 'and it lands on that day', dsNow);
  const dsShown = await p.evaluate(() => document.body.textContent.includes('Call the plumber'));
  ok(dsShown, 'the sheet redrew with it');

  console.log('\nnothing threw');
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));

  console.log(fails ? `\nFAILED (${fails})\n` : '\nadding a task from the planning screens works\n');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
