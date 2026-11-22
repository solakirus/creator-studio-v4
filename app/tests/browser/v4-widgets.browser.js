/* Browser test: the home-screen widgets' data and taps (22 Nov 2026).

   js/widget.js builds a snapshot for the seven native widgets: today in time
   order (tasks, vlog beats, meal prep), filming, meals planned (the plan's
   weeks start on Sunday) and today's workout; it still sends the five old
   one-line fields for an APK from before. A check box or Done tapped on a
   widget comes back through takeQueue() and is saved like a tick on Today.
   js/shortcuts.js opens the widgets' links: a task, its shot page, a workout
   started straight away, Meals, and Add a task.

     node app/tests/browser/v4-widgets.browser.js [outDir] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true });
  /* a phone: Capacitor with the CSWidget plugin, recording what the app sends */
  await ctx.addInitScript(() => {
    window.__wg = { updates: [], queue: [], listeners: {} };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {
      CSWidget: {
        update: async (d) => { window.__wg.updates.push(JSON.parse(JSON.stringify(d))); },
        takeQueue: async () => { const q = window.__wg.queue; window.__wg.queue = []; return { actions: q }; },
        isPlaced: async () => ({ placed: true }),
        placed: async () => ({ kinds: ['today'] }),
        addListener: (n, fn) => { window.__wg.listeners[n] = fn; return Promise.resolve({ remove(){} }); },
      } } };
  });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message + ' @ ' + String(e.stack).split('\n').slice(1,3).join(' '))); p.on('dialog', d => d.accept());
  await p.goto(url); await p.waitForFunction(() => window.App && window.Widget && window.Nutrition, null, { timeout: 15000 });
  await p.waitForTimeout(800);

  const today = await p.evaluate(async () => {
    const day = await Data.currentDay();
    await Store.put('routines', { id: 'r1', name: 'Push day', items: [['bench', 'Bench press'], ['ohp', 'Overhead press'], ['dips', 'Dips']].map(([id, name]) => ({ id, name, sets: 3, reps: 8, rest: 120, pri: [], sec: [] })) });
    await Store.put('tasks', { id: 501, day, title: 'Push day', kind: 'workout', routineId: 'r1', at: '06:30', amount: 45, unit: 'min', view: 'todo', subs: [], pri: 'high' });
    await Store.put('tasks', { id: 502, day, title: 'Film the opener: kitchen', kind: 'shoot', at: '14:30', view: 'todo', subs: [], pri: 'high', cad: 'Episode 7',
      page: { slots: [{ done: true }, { done: false }, { done: false }] } });
    await Store.put('tasks', { id: 503, day, title: 'Clean the gutters', view: 'todo', subs: [{ done: true }, { done: false }], pri: 'low' });
    await Store.put('tasks', { id: 504, day, title: 'Edit Clip 12', kind: 'edit', at: '19:00', view: 'done', subs: [], pri: 'med' });
    await Store.put('tasks', { id: 599, day: day + 1, title: 'Tomorrow thing', view: 'todo', subs: [] });
    /* meals planned for today, keyed the way the plan screen writes them */
    for(const [id, title] of [['wm1', 'Overnight Oats'], ['wm2', 'Chicken & Rice Bowl'], ['wm3', 'Salmon Tacos']])
      await Store.put('meals', { id, title, category: 'Entrees', tags: [], ingredients: [] });
    if(Nutrition.invalidate) Nutrition.invalidate();
    const meals = (await Nutrition.meals()).filter(m => /^wm\d$/.test(m.id)).sort((a, b) => a.id.localeCompare(b.id));
    const wk = Nutrition.isoWeek(new Date(await Data.dayToDate(day)));
    const dow = Nutrition.DAYS[new Date(await Data.dayToDate(day)).getDay()];
    await Nutrition.setSlot(wk, dow, 'breakfast', meals[0].id);
    await Nutrition.setSlot(wk, dow, 'dinner', meals[1].id);
    /* and yesterday's, which must not show */
    const yd = Nutrition.DAYS[(new Date(await Data.dayToDate(day)).getDay() + 6) % 7];
    if(yd !== dow) await Nutrition.setSlot(wk === Nutrition.isoWeek(new Date(await Data.dayToDate(day - 1))) ? wk : Nutrition.isoWeek(new Date(await Data.dayToDate(day - 1))), yd, 'lunch', meals[2].id);
    Data.invalidate();
    return { day, breakfast: meals[0].title, dinner: meals[1].title, lunchYesterday: meals[2].title };
  });

  console.log('\n— snapshot —');
  await p.evaluate(() => Widget.push()); await p.waitForTimeout(300);
  let d = await p.evaluate(() => window.__wg.updates[window.__wg.updates.length - 1]);
  const S = d.snapshot;
  ok(d.day === S.dayLabel && /^(Day \d+|Starts tomorrow|\d+ days to go)$/.test(d.day), 'the old one-line fields are still sent (for an older APK)', d.day + ' · ' + d.progress);
  ok(d.progress === '1/4 done', 'old progress line: 1/4 done', d.progress);
  ok(S.v === 2 && S.dayN === today.day && /^\d{4}-\d\d-\d\d$/.test(S.date), 'snapshot v2 with the day number and date');
  const titles = S.items.map(i => (i.at || '—') + ' ' + i.title);
  console.log('     items:', titles.join(' | '));
  ok(S.items.length === 4 && !titles.some(t => /Tomorrow/.test(t)), 'Today: only today\'s 4 tasks');
  ok(S.items[0].title === 'Push day' && S.items[1].title === 'Film the opener: kitchen' && S.items[3].title === 'Clean the gutters', 'in time order, untimed last');
  const shoot = S.items.find(i => i.id === '502'), gut = S.items.find(i => i.id === '503'), wo = S.items.find(i => i.id === '501');
  ok(shoot.sub === 'Episode 7 · 1/3 shots' && shoot.start === 'cs4://go/shootrun/502' && shoot.startLabel === 'Start shooting', 'a shoot: shots got, Start opens shoot mode', shoot.sub);
  ok(gut.sub === '1/2 steps' && gut.check && gut.link === 'cs4://go/task/503' && !gut.start, 'a plain task: steps, check box, opens the task', gut.sub);
  ok(wo.sub === '3 exercises · 45 min' && wo.start === 'cs4://go/startworkout/501', 'a workout: its routine and minutes, Start starts it', wo.sub);
  ok(S.items.find(i => i.id === '504').done === true, 'a done task comes through as done');
  ok(S.filming.length === 1 && S.filming[0].got === 1 && S.filming[0].total === 3 && S.filming[0].link === 'cs4://go/shootrun/502', 'Filming today: the shoot with 1/3 shots');
  ok(S.meals.slots.length === 2 && S.meals.slots[0].slot === 'Breakfast' && S.meals.slots[0].title === today.breakfast && S.meals.slots[1].slot === 'Dinner', 'Meals: today\'s breakfast and dinner', S.meals.slots.map(x => x.slot + ': ' + x.title).join(' · '));
  ok(!S.meals.slots.some(x => x.title === today.lunchYesterday && x.slot === 'Lunch'), 'and not yesterday\'s lunch');
  ok(S.workout && S.workout.title === 'Push day' && S.workout.at === '06:30' && S.workout.start === 'cs4://go/startworkout/501' && !S.workout.done, 'Workout: Push day at 6:30, Start');

  console.log('\n— a tick on the home screen —');
  await p.evaluate(() => { window.__wg.queue = [{ type: 'done', key: '503', at: Date.now() }, { type: 'done', key: '504', at: Date.now() }]; window.__wg.listeners.widgetQueue(); });
  await p.waitForTimeout(1200);
  const views = await p.evaluate(async () => { const all = await Data.tasks(); return [all.find(t => t.id === 503).view, all.find(t => t.id === 504).view]; });
  ok(views[0] === 'done', 'Clean the gutters ticked on the widget → done in the app');
  ok(views[1] === 'todo', 'tapping a done one un-ticks it');
  d = await p.evaluate(() => window.__wg.updates[window.__wg.updates.length - 1]);
  ok(d.snapshot.items.find(i => i.id === '503').done === true && d.progress === '1/4 done', 'the widgets get a fresh snapshot right after');
  const dirty = await p.evaluate(async () => { try { const s = await Sync.status(); return s; } catch(e){ return null; } });
  console.log('     sync status after the tick:', dirty ? JSON.stringify(dirty).slice(0, 120) : '(no Sync.status)');

  console.log('\n— the widgets\' links —');
  const go = async (u) => { await p.evaluate((u) => Shortcuts.handle(u), u); await p.waitForTimeout(900); return p.evaluate(() => Screens.topId ? Screens.topId() : null); };
  const back = async () => { await p.evaluate(() => { while(Screens.depth && Screens.depth()) Screens.pop(); }); await p.waitForTimeout(300); };
  let top = await go('cs4://go/task/503'); ok(top === 'task', 'task/503 opens the task', top); await back();
  top = await go('cs4://go/shootrun/502'); ok(top === 'shoot-run', 'shootrun/502 opens shoot mode', top); await back();
  top = await go('cs4://go/startworkout/501'); ok(top === 'session', 'startworkout/501 starts the Push day session', top);
  const run = await p.evaluate(async () => { const r = await Routines.get('r1'); return r && (r.lastRun || r.runs || r.last || null); });
  await back();
  top = await go('cs4://go/meals'); ok(top === 'nutrition-home', 'meals opens Nutrition', top); await back();
  await p.evaluate(() => Shortcuts.handle('cs4://go/add')); await p.waitForTimeout(900);
  const form = await p.evaluate(() => !!document.querySelector('.sheet.open, #sheet.open, .sheet.on'));
  ok(form, 'add opens the Add a task form');
  await p.screenshot({ path: path.join(out, 'widgets-add.png') });

  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
