/* The prep phase, and moving Day 1 without moving the plans.

   moveStart writes to the database, so this runs it against a fake store and
   asserts on what came back out — the rule it exists to keep is that a shoot
   planned for a real date is still on that real date afterwards. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  console.log(`  ${cond ? 'ok ' : 'FAIL'}  ${name.padEnd(50)} ${extra}`);
  cond ? pass++ : fail++;
};
const head = s => console.log(`\n— ${s} —`);

const DAY = 86400000;
const midnight = ts => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };

/* ---- a fake store, keyed like the real one ---- */
const db = { tasks:{}, vlogs:{}, plans:{}, videos:{}, challenges:{}, settings:{} };
global.Store = {
  all: async s => ({ keys:Object.keys(db[s] || {}), values:Object.values(db[s] || {}) }),
  allMap: async s => ({ ...(db[s] || {}) }),
  get: async (s, k) => (db[s] || {})[k],
  put: async (s, v, k) => { (db[s] = db[s] || {})[k != null ? k : v.id] = v; },
  del: async (s, k) => { delete (db[s] || {})[k]; },
  names: () => Object.keys(db)
};
global.U = { ICON:new Proxy({}, { get:()=> '<svg/>' }), toast(){} };
global.window = global;

/* Day 1 = Mon 5 Oct 2026. A shoot sits on day 10 → Wed 14 Oct. */
const START = midnight(new Date(2026, 9, 5).getTime());
db.settings['program'] = { start: START };
db.tasks[1] = { id:1, t:'Shoot the tent bit', day:10, at:'09:00' };
db.tasks[2] = { id:2, t:'Prep-day errand',    day:0 };
db.tasks[3] = { id:3, t:'No day at all',      day:null };
db.vlogs[9] = { id:9, week:2, acts:[{ id:'a1', day:10, beats:[{ id:'b1', day:10 }, { id:'b2', day:null }] }] };
db.plans[5] = { id:5, startDay:8, add:[9], skip:[11] };
db.videos[7] = { id:7, day:10 };

for(const f of ['js/data.js']){
  new Function('global', fs.readFileSync(path.join(ROOT, f), 'utf8'))(global);
}

(async () => {
  const dayToReal = async n => await Data.dayToDate(n);

  head('a day before Day 1 has a name');
  let ph = await Data.phaseOf(0);
  t('day 0 is in the run-up', ph.pre === true);
  t('named Prep by default', ph.name === 'Prep', ph.name);
  t('and it is one day to Day 1', ph.toGo === 1, String(ph.toGo));
  ph = await Data.phaseOf(-6);
  t('day -6 is seven days out', ph.toGo === 7, String(ph.toGo));
  t('day 1 itself is not', (await Data.phaseOf(1)).pre === false);
  t('the label reads as a sentence', await Data.dayLabel(-6) === 'Prep · 7 days to Day 1',
    await Data.dayLabel(-6));
  t('singular when it is one day', (await Data.dayLabel(0)).includes('1 day to'),
    await Data.dayLabel(0));
  t('and a real day says day and week', await Data.dayLabel(10) === 'Day 10 · week 2',
    await Data.dayLabel(10));

  head('todayDay does not floor at 1');
  t('it matches currentDay', await Data.todayDay() === await Data.currentDay());

  head('moving Day 1 keeps every plan on its real date');
  const before = {
    task: await dayToReal(db.tasks[1].day),
    beat: await dayToReal(db.vlogs[9].acts[0].beats[0].day),
    video: await dayToReal(db.videos[7].day)
  };
  /* push Day 1 four days later */
  const r = await Data.moveStart(START + 4 * DAY, 'Red phase');
  t('it reports the shift', r.days === 4, r.days + ' days');
  t('and how many tasks it touched', r.tasks === 2, String(r.tasks));

  const after = {
    task: await dayToReal(db.tasks[1].day),
    beat: await dayToReal(db.vlogs[9].acts[0].beats[0].day),
    video: await dayToReal(db.videos[7].day)
  };
  t('the shoot is on the same real date', before.task === after.task,
    new Date(after.task).toDateString());
  t('so is the beat', before.beat === after.beat);
  t('so is the one-off video', before.video === after.video);
  t('its day number moved instead', db.tasks[1].day === 6, 'day ' + db.tasks[1].day);

  head('and it does not mangle the edges');
  t('a day-0 task shifted too, not dropped', db.tasks[2].day === -4, 'day ' + db.tasks[2].day);
  t('a task with no day still has none', db.tasks[3].day === null);
  t('a beat with no day still has none', db.vlogs[9].acts[0].beats[1].day === null);
  t('the plan start moved', db.plans[5].startDay === 4, String(db.plans[5].startDay));
  t('its hand-picked days moved with it', db.plans[5].add[0] === 5 && db.plans[5].skip[0] === 7,
    `add ${db.plans[5].add[0]} skip ${db.plans[5].skip[0]}`);

  head('and the run-up can be renamed');
  t('the new name stuck', (await Data.phaseOf(0)).name === 'Red phase',
    (await Data.phaseOf(0)).name);
  t('the start date is the new one', (await Data.program()).start === START + 4 * DAY);

  console.log(`\n${fail ? 'FAILED' : 'moving Day 1 never moves the plans'}  (${pass} ok, ${fail} failed)\n`);
  process.exit(fail ? 1 : 0);
})();
