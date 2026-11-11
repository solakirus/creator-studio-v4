/* Habits — the logic that decides what colour each dot is.

   Runs app/js/habits.js in a plain Node context with a small in-memory Store,
   so no browser and no install. The cases are the ones that would make the
   grid lie: a workout done on the "wrong" day, a day off counted as a miss, a
   weekly habit punished for a quiet Tuesday, two devices doubling a task. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'habits.js'), 'utf8');

let pass = 0, fail = 0;
const t = (n, c, x) => { console.log(`  ${c ? 'ok ' : 'FAIL'}  ${n.padEnd(60)} ${x === undefined ? '' : x}`); c ? pass++ : fail++; };

/* ---- a tiny Store / Data / U, enough for habits.js ---- */
function makeWorld(startKey){
  const stores = { settings: new Map(), tasks: new Map(), sessions: new Map(), runs: new Map() };
  const Store = {
    async all(s){ const m = stores[s]; return { keys: [...m.keys()], values: [...m.values()] }; },
    async get(s, k){ return stores[s].get(k); },
    async put(s, v, k){ stores[s].set(k === undefined ? v.id : k, JSON.parse(JSON.stringify(v))); },
    async del(s, k){ stores[s].delete(k); }
  };
  const [y, m, d] = startKey.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  const Data = {
    async tasks(){ return [...stores.tasks.values()]; },
    async program(){ return { start }; },
    async currentDay(){ return Math.round((new Date().setHours(0,0,0,0) - start) / 86400000) + 1; },
    invalidate(){}
  };
  const U = { hash(str){ let h = 0; for(let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); } };
  const win = { Store, Data, U };
  const ctx = vm.createContext({ window: win, Store, Data, U, console, Date, Math, Number, String, Set, Array, JSON, Promise, Object });
  vm.runInContext(src, ctx);
  return { H: win.Habits, stores, start, Store };
}

(async () => {
  const { H, stores, start } = makeWorld('2027-01-01');      /* Day 1 = Fri 1 Jan 2027 */
  const dayOf = k => Math.round((H.fromKey(k) - start) / 86400000) + 1;
  const TODAY = '2027-03-10';                                 /* a Wednesday */

  console.log('\n— dates —');
  t('weeks start on Sunday', H.weekKey('2027-03-10') === '2027-03-07', H.weekKey('2027-03-10'));
  t('2027 is 53 columns of weeks', H.yearOf(H.normalise({ name:'x' }), 2027, H.index({ start }), TODAY).cols === 53);
  t('2028 (leap, starts Saturday) needs 54', H.yearOf(H.normalise({ name:'x' }), 2028, H.index({ start }), TODAY).cols === 54);
  t('amounts parse', JSON.stringify(H.amountOf('5 / 8 cups')) === '{"a":5,"b":8}');
  t('a plain note is not an amount', H.amountOf('3 clips') === null);

  console.log('\n— workout: tasks of that kind, or a session —');
  const gym = H.normalise({ name:'Workout', per:'week', times:6, source:{ type:'kind', kind:'workout' } });
  const facts = {
    start,
    tasks: [
      { id:1, day: dayOf('2027-03-08'), kind:'workout', view:'done' },      /* Mon, ticked */
      { id:2, day: dayOf('2027-03-09'), kind:'workout', view:'todo' },      /* Tue, not ticked… */
      { id:3, day: dayOf('2027-03-09'), kind:'shoot',   view:'done' }
    ],
    sessions: [ { finishedAt: H.fromKey('2027-03-09') + 18 * 3600000 } ], /* …but a session was done Tue */
    runs: [ { at: H.fromKey('2027-03-07') + 7 * 3600000 } ]
  };
  const idx = H.index(facts);
  t('a ticked workout task fills its day', H.dayStatus(gym, '2027-03-08', idx, TODAY) === 'done');
  t('a finished session fills the day it happened', H.dayStatus(gym, '2027-03-09', idx, TODAY) === 'done');
  t('a shoot task does not count as a workout', H.dayStatus(gym, '2027-03-05', idx, TODAY) === 'rest');
  t('a weekly habit never calls a quiet day a miss', H.dayStatus(gym, '2027-03-02', idx, TODAY) === 'rest');
  t('tomorrow is ahead', H.dayStatus(gym, '2027-03-11', idx, TODAY) === 'ahead');
  t('this week counts 2 so far', H.weekCount(gym, '2027-03-10', idx, TODAY) === 2);

  console.log('\n— history starts where the data does —');
  const late = H.normalise({ name:'Workout', per:'day', createdKey:'2027-03-10', source:{ type:'kind', kind:'workout' } });
  t('before the first workout ever recorded: before, not missed', H.dayStatus(late, '2027-03-07', idx, TODAY) === 'before');
  t('from the first record on, it counts', H.dayStatus(late, '2027-03-08', idx, TODAY) === 'done');
  t('those weeks are not misses either', H.weeksOf(H.normalise({ ...late, per:'week', times:3 }), 2027, idx, TODAY)
    .filter(w => w.k < '2027-03-01').every(w => w.state === 'before'));
  t('today, not yet done, does not drag the score', (s => s.of === 3 && s.hit === 2)(H.score(late, 2027, idx, '2027-03-11')),
    JSON.stringify(H.score(late, 2027, idx, '2027-03-11')));

  console.log('\n— runs come from the run log —');
  const run = H.normalise({ name:'Run', per:'week', times:3, source:{ type:'runs' } });
  t('a logged run fills its day', H.dayStatus(run, '2027-03-07', idx, TODAY) === 'done');
  t('a workout is not a run', H.dayStatus(run, '2027-03-08', idx, TODAY) === 'rest');

  console.log('\n— a day habit with days off —');
  const film = H.normalise({ name:'Film', per:'day', days:[1,2,3,4,5], source:{ type:'kind', kind:'shoot' } });
  t('a weekday with no shoot is a miss', H.dayStatus(film, '2027-03-08', idx, TODAY) === 'miss');
  t('a Saturday is a day off', H.dayStatus(film, '2027-03-06', idx, TODAY) === 'rest');
  t('today, not done yet, is not a miss', H.dayStatus(film, TODAY, idx, TODAY) === 'today');
  t('the shoot on Tuesday counts', H.dayStatus(film, '2027-03-09', idx, TODAY) === 'done');

  console.log('\n— a repeating task —');
  const ser = H.normalise({ name:'Edit', per:'day', source:{ type:'series', series:'sr_abc' } });
  const sidx = H.index({ start, tasks: [
    { id:10, day: dayOf('2027-03-01'), series:'sr_abc', view:'done' },
    { id:11, day: dayOf('2027-03-02'), series:'sr_abc', view:'todo' },
    { id:12, day: dayOf('2027-03-03'), series:'sr_abc', view:'todo', prog:'2 / 5' }
  ]});
  t('ticked → done', H.dayStatus(ser, '2027-03-01', sidx, TODAY) === 'done');
  t('left undone → miss', H.dayStatus(ser, '2027-03-02', sidx, TODAY) === 'miss');
  t('started amount → part', H.dayStatus(ser, '2027-03-03', sidx, TODAY) === 'part');
  t('no task that day → the series was resting', H.dayStatus(ser, '2027-03-04', sidx, TODAY) === 'rest');

  console.log('\n— streaks skip days off —');
  const sidx2 = H.index({ start, tasks: [
    '2027-03-03','2027-03-04','2027-03-05','2027-03-08','2027-03-09'   /* Wed Thu Fri, Mon Tue */
  ].map((k, i) => ({ id: 20 + i, day: dayOf(k), kind:'shoot', view:'done' })) });
  t('weekend off does not break a weekday streak', H.streak(film, sidx2, TODAY).n === 5, H.streak(film, sidx2, TODAY).n);
  const w = H.weeksOf(gym, 2027, idx, TODAY);
  t('weeks touching 2027 are listed', w.length === 53, w.length);
  t('this week is in progress, not a miss', w.find(x => x.k === '2027-03-07').state === 'now');
  t('future weeks are ahead', w[w.length - 1].state === 'ahead');

  console.log('\n— own tasks, a week ahead —');
  const today = Math.round((new Date().setHours(0,0,0,0) - start) / 86400000) + 1;
  const water = await H.save({ name:'Drink water', per:'day', source:{ type:'own', amount:8, unit:'cups' } });
  t('saved under habit:<id>', stores.settings.has('habit:' + water.id));
  const made = await H.ensureTasks(today, 7);
  t('seven days stocked', made === 7, made);
  t('again: nothing doubled', (await H.ensureTasks(today, 7)) === 0);
  const tk = [...stores.tasks.values()].filter(x => x.habitId === water.id);
  t('each task carries the amount', tk.every(x => x.prog === '0 / 8 cups'));
  t('ids are plain numbers', tk.every(x => typeof x.id === 'number' && Number.isSafeInteger(x.id)));
  t('the same habit and day give the same id', H.ownTaskId(water.id, 300) === H.ownTaskId(water.id, 300));
  t('different days differ', H.ownTaskId(water.id, 300) !== H.ownTaskId(water.id, 301));
  t('and stay below new task ids', H.ownTaskId(water.id, 300) < Date.now() * 1000);

  await H.save({ ...water, days:[1,3,5], name:'Water' });
  const after = [...stores.tasks.values()].filter(x => x.habitId === water.id);
  t('changing days drops future tasks on dropped days',
    after.every(x => [1,3,5].includes(new Date(start + (x.day - 1) * 86400000).getDay())), after.length);
  t('and renames the rest', after.every(x => x.title === 'Water'));

  stores.tasks.get(after[0].id).view = 'done';
  await H.remove(water.id);
  const left = [...stores.tasks.values()].filter(x => x.habitId === water.id);
  t('removing it keeps what was ticked', left.length === 1 && left[0].view === 'done', left.length);
  t('and the habit is gone', !stores.settings.has('habit:' + water.id));

  console.log('\n— labels —');
  t('weekly goal reads plainly', H.goalLabel(gym) === '6 times a week');
  t('amount goal reads plainly', H.goalLabel(H.normalise({ source:{ type:'own', amount:8, unit:'cups' } })) === '8 cups a day');
  t('workout source says sessions count', /session/.test(H.sourceLabel(gym)));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
