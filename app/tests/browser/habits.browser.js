/* Browser test: habits, for real — the Today strip and tags, the year grid,
   one habit's page, the editor, and the +1 on an amount habit.

     cd app && bash build-preview.sh
     node tests/browser/habits.browser.js            (SHOTS=dir to keep screenshots) */
let pw; try { pw = require('playwright'); } catch(e){ pw = require('playwright-core'); }
const path = require('path');
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined,
    headless: true, args:['--no-sandbox', '--disable-dev-shm-usage', '--disable-component-update',
      '--disable-background-networking', '--disable-sync', '--no-first-run'] });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '../../../creator-studio-preview.html'));
  await p.waitForTimeout(1500);
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if(!c) fails++; };
  const shot = async n => { if(process.env.SHOTS) await p.screenshot({ path: path.join(process.env.SHOTS, n + '.png'), fullPage: false }); };

  console.log('modules load');
  ok(await p.evaluate(() => typeof Habits === 'object' && typeof HabitsUI === 'object'), 'Habits and HabitsUI exist');
  ok(await p.evaluate(() => !!document.querySelector('#habitStrip')), 'Today has a habit strip slot');
  ok(await p.evaluate(() => !!document.querySelector('.hb-strip.empty')), 'with no habits it offers the year grid');

  /* a few weeks of history: workouts (some as sessions only), runs, shoots */
  await p.evaluate(async () => {
    const today = await Data.currentDay();
    let id = 1;
    for(let i = 1; i <= 40; i++){
      const d = today - i;
      if(i % 7 !== 0) await Store.put('tasks', { id: id++, day: d, title: 'Push day', kind:'workout', view: i % 5 ? 'done' : 'todo', cad:'Weekly', pri:'med', subs:[] });
      if(i % 3) await Store.put('tasks', { id: id++, day: d, title: 'Film b-roll', kind:'shoot', view: i % 4 ? 'done' : 'todo', cad:'Daily', pri:'med', subs:[] });
      if(i % 2) await Store.put('runs', { id: 'rn_' + i, km: 4, sec: 1500, at: (await Data.dayToDate(d)) + 7 * 3600000 });
    }
    await Store.put('tasks', { id: id++, day: today, title: 'Push day', kind:'workout', view:'todo', cad:'Weekly', pri:'med', subs:[] });
    await Store.put('sessions', { id:'ws_x', name:'Pull', finishedAt: (await Data.dayToDate(today - 7)) + 18 * 3600000, exercises:[] });
    Data.invalidate();
    await Habits.save({ name:'Workout', per:'week', times:6, color:'#5BBE6A', group:'Body', source:{ type:'kind', kind:'workout' } });
    await Habits.save({ name:'Run', per:'week', times:3, color:'#E2564A', group:'Body', source:{ type:'runs' } });
    await Habits.save({ name:'Film something', per:'day', days:[1,2,3,4,5], color:'#FB6900', group:'Content', source:{ type:'kind', kind:'shoot' } });
    await Habits.save({ name:'Drink water', per:'day', color:'#4F9DF7', group:'Body', source:{ type:'own', amount:8, unit:'cups' } });
    App.refreshTab();
  });
  await p.waitForTimeout(1500);

  console.log('\nToday');
  const tiles = await p.locator('.hb-tile').count();
  ok(tiles === 4, 'a tile per habit', tiles);
  const water = await p.evaluate(async () => (await Data.tasks()).filter(t => t.habitId).length);
  ok(water === 7, 'Drink water stocked a week of its own tasks', water);
  const tags = await p.evaluate(() => [...document.querySelectorAll('.hb-tag b')].map(x => x.textContent));
  ok(tags.includes('Workout'), 'the workout card wears the Workout tag', tags);
  ok(tags.includes('Drink water'), 'the water card wears its tag', tags);
  ok(await p.locator('[data-hb-bump]').count() === 1, 'water has a +1 button');
  await shot('1-today');

  await p.locator('[data-hb-bump]').click();
  await p.waitForTimeout(900);
  const wt = await p.evaluate(async () => { const d = await Data.currentDay(); return (await Data.tasks()).find(t => t.habitId && t.day === d).prog; });
  ok(wt === '1 / 8 cups', '+1 adds a cup', wt);
  ok(await p.evaluate(() => [...document.querySelectorAll('.hb-tile small')].some(x => x.textContent.includes('1 / 8'))), 'the tile shows 1 / 8');

  console.log('\nthe year');
  await p.locator('[data-hb-year]').first().click();
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => Screens.topId()) === 'habits', 'Year in dots opened');
  const cards = await p.locator('.hb-card').count();
  ok(cards === 4, 'four habit cards', cards);
  const cells = await p.evaluate(() => document.querySelector('.hb-card .hb-grid').children.length);
  const yr = new Date().getFullYear();
  const lead = new Date(yr, 0, 1).getDay(), len = (new Date(yr + 1, 0, 1) - new Date(yr, 0, 1)) / 86400000;
  ok(cells === lead + len, 'a cell for every day of the year, after the blank lead-in', cells);
  ok(await p.locator('.hb-wk').count() === 2, 'week bars only on the two weekly habits');
  ok(await p.locator('.hb-chips [data-g]').count() === 3, 'group chips: All, Content, Body');
  await shot('2-year');
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator('.hb-chips [data-g="Content"]').click();
  await p.waitForTimeout(500);
  ok(await p.locator('.hb-card').count() === 1, 'Content shows one habit');
  await p.locator('.hb-chips [data-g=""]').click();
  await p.waitForTimeout(400);
  await p.locator('[data-y]').last().click();
  await p.waitForTimeout(600);
  ok((await p.textContent('.hb-year h1')).trim() === String(yr + 1), 'next year opens');
  ok(await p.evaluate(() => [...document.querySelectorAll('.hb-card .hb-d')].every(x => !/var\(--line\)/.test(x.style.background))), 'next year has no misses yet');
  await p.locator('[data-y]').first().click();
  await p.waitForTimeout(600);

  console.log('\none habit');
  await p.locator('.hb-card', { hasText: 'Workout' }).click();
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => Screens.topId()) === 'habit', 'the habit page opened');
  ok(await p.locator('.hb-mrow').count() === 12, 'twelve month rows');
  ok(await p.locator('.hb-week button').count() === 7, 'seven days this week');
  const sub = await p.textContent('[data-screen="habit"] .hb-sub');
  ok(/6 times a week/.test(sub) && /session/.test(sub), 'it says what it counts', sub.trim());
  await shot('3-habit');

  console.log('\nthe editor');
  await p.locator('[data-a="edit"]').click();
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.getElementById('sheet').classList.contains('open')), 'Edit opens the sheet');
  ok(await p.inputValue('#hb-name') === 'Workout', 'with its name');
  await p.locator('[data-src="own"]').click();
  await p.waitForTimeout(200);
  ok(await p.locator('#hb-amt').count() === 1, 'switching to own task shows the amount fields');
  ok(await p.inputValue('#hb-name') === 'Workout', 'and the name survived the redraw');
  await p.locator('[data-src="kind"]').click();
  await p.locator('[data-hb="cancel"]').click();
  await p.waitForTimeout(400);
  await p.evaluate(() => Screens.pop());
  await p.waitForTimeout(500);

  await p.locator('[data-a="new"]').click();
  await p.waitForTimeout(400);
  await p.locator('[data-hb="save"]').click();
  ok(await p.evaluate(() => !document.getElementById('hb-err').hidden), 'no name, no save');
  await p.fill('#hb-name', 'Read');
  await p.fill('#hb-amt', '20');
  await p.fill('#hb-unit', 'min');
  await shot('4-editor');
  await p.locator('[data-hb="save"]').click();
  await p.waitForTimeout(900);
  ok(await p.locator('.hb-card').count() === 5, 'the new habit is on the year', await p.locator('.hb-card').count());
  const readTasks = await p.evaluate(async () => (await Data.tasks()).filter(t => t.title === 'Read' && t.habitId).length);
  ok(readTasks === 7, 'and its tasks are on the next week', readTasks);

  console.log('\nback on Today');
  await p.evaluate(() => Screens.pop());
  await p.waitForTimeout(1200);
  ok(await p.locator('.hb-tile').count() === 5, 'Today shows five tiles now');

  console.log('\ndelete');
  await p.evaluate(async () => { const r = (await Habits.all()).find(h => h.name === 'Read'); Screens.push('habit', { id: r.id }); });
  await p.waitForTimeout(700);
  await p.locator('[data-a="edit"]').click();
  await p.waitForTimeout(400);
  await p.locator('[data-hb="delete"]').click();
  ok(/Tap again/.test(await p.textContent('[data-hb="delete"]')), 'delete asks twice');
  await p.locator('[data-hb="delete"]').click();
  await p.waitForTimeout(800);
  ok((await p.evaluate(async () => (await Habits.all()).length)) === 4, 'gone');
  const left = await p.evaluate(async () => (await Data.tasks()).filter(t => t.title === 'Read' && t.habitId && t.view === 'todo').length);
  ok(left <= 1, 'its future unticked tasks went with it (today\'s may stay)', left);

  /* light theme, so the dots still read on a pale page */
  await p.evaluate(() => { document.documentElement.dataset.palette = 'blush'; document.documentElement.dataset.mode = 'light'; Screens.push('habits', {}); });
  await p.waitForTimeout(800);
  await shot('5-light');

  ok(!errs.length, 'no page errors', errs.slice(0, 5));
  await b.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
