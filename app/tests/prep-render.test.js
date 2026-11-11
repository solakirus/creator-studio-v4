/* The three screens the prep phase changed, rendered against a stub DOM.

   Source checks prove the call is there; only rendering proves the screen
   draws. This is the harness that caught the task metaline printing a missing
   value as a word. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  console.log(`  ${cond ? 'ok ' : 'FAIL'}  ${name.padEnd(48)} ${extra}`);
  cond ? pass++ : fail++;
};
const head = s => console.log(`\n— ${s} —`);

/* Some mounts call an async render() without awaiting it, so the screen fills
   a tick or two after mount resolves. Let those settle before reading. */
const settle = async () => { for(let i = 0; i < 8; i++) await Promise.resolve(); };

const mk = () => ({ innerHTML:'', dataset:{}, _h:[],
  addEventListener(ty, f){ this._h.push([ty, f]); },
  querySelector(){ return null; }, querySelectorAll(){ return []; },
  appendChild(){}, remove(){}, classList:{ add(){}, remove(){}, toggle(){} } });

let DAYNUM = 0;                                  /* today sits in the run-up */
global.URL = { createObjectURL:()=> 'blob:x', revokeObjectURL(){} };
const blobs = { '7:0':{}, '7:1':{} };
const TASK = { id:7, t:'Call the plumber', note:'ask about the valve', kind:'task',
               day:0, subs:[], shots:[] };
global.Store = {
  allMap: async s => s === 'task-media' ? blobs : (s === 'tasks' ? { 7:TASK } : {}),
  all: async () => ({ keys:[], values:[] }),
  get: async () => null, put: async () => {}, del: async () => {}
};
global.Data = {
  program: async () => ({ start: Date.now(), preName:'Red phase' }),
  currentDay: async () => DAYNUM, todayDay: async () => DAYNUM,
  currentWeek: async () => 1,
  phaseOf: async n => n >= 1 ? { pre:false, name:null, toGo:0 }
                             : { pre:true, name:'Red phase', toGo: 1 - n },
  dayLabel: async n => n >= 1 ? `Day ${n} · week ${Math.ceil(n/7)}`
                              : `Red phase · ${1-n} day${1-n===1?'':'s'} to Day 1`,
  dayToDate: async () => Date.now(),
  tasks: async () => [TASK], today: async () => [], save: async () => {}
};
global.U = { ICON:new Proxy({}, { get:()=> '<svg/>' }), toast(){}, esc:s=>String(s||''),
  fmt:()=> '', generatedArt:()=> 'none', dayField:async()=>({}), readDayField:async()=>null,
  pad:n=>String(n).padStart(2,'0') };
global.App = { sheet(){}, closeSheet(){}, pickImage(){}, go(){}, TOOLS:[] };
const mounts = {};
global.Screens = { register(id, m){ mounts[id] = m; }, push(){}, pop(){},
  bar:()=> '<header/>', mountInto(){ return true; } };
global.Coverage = { html:()=> '', shotDone:()=>false, tally:()=>({got:0,pct:0}),
  kit: async ()=>({}), kitFor:()=>({}), shotTotals:()=>({ got:0, pct:0, want:0 }),
  totals:()=>({ got:0, pct:0, want:0 }), ANGLE_TARGET:3 };
global.ShotLib = { all: async () => [] };
/* streak() returns a NUMBER, not an object — the screen interpolates it directly */
global.Celebrate = { streak: async () => 0, stats: async () => ({ best:0, perfect:0 }),
  shareCard(){} };
global.Levels = { state: async () => ({ level:1, rank:{ n:'Rookie', a:'#7A7268', b:'#4A443D' },
  points:0, parts:{}, counts:{}, into:0, span:100, toNext:100, pct:0 }) };
global.Awards = { unlocked: async () => [] };
global.Academy = { totalDone: async () => 0, totalLessons: () => 0, COURSES:[], all:()=>[] };
global.Avatars = { all: async () => [], art: async () => null, current: async () => null };
global.Challenges = { all: async () => [], invalidate(){} };
/* A render() called without await turns any throw inside it into an unhandled
   rejection and an empty screen — surface it rather than reporting 0 chars. */
process.on('unhandledRejection', e => {
  console.log('    unhandled rejection in a render: ' + (e && e.message));
});
global.Series = { all: async () => [] };
global.Channels = { all: async () => [] };
global.SwipeRefs = { wire(){}, panel:()=> '' };
global.Refs = { panel:()=> '', mount(){} };
global.Nutrition = { prep: async () => [], week: async () => ({}) };
global.Months = { all: async () => [], ts: s => new Date(s).getTime() };
global.Videos = { STAGES:[{k:'idea'}] };
global.document = { createElement:()=> ({ style:{}, addEventListener(){}, classList:{ add(){} } }),
  querySelector(){ return null; }, getElementById(){ return null; }, addEventListener(){}, body:mk(),
  head:{ appendChild(){} } };
global.window = global;

for(const f of ['js/screens/task.js', 'js/screens/daysheet.js', 'js/screens/profile.js']){
  try { new Function(fs.readFileSync(path.join(ROOT, f), 'utf8'))(); }
  catch(e){ console.log('  load error in ' + f + ': ' + e.message); }
}

(async () => {
  head('a task with no cadence and no priority');
  const el = mk();
  if(!mounts.task) return t('task registered', false);
  await mounts.task(el, { id:7 });
  await settle();
  const h = el.innerHTML;
  t('it rendered', h.length > 400, h.length + ' chars');
  t('and never prints a missing value as a word', !h.includes('undefined'));
  t('the cadence button says so instead', h.includes('No cadence'));
  t('and the priority button too', h.includes('No priority'));
  t('the Details count reads "not set"', h.includes('not set'));
  const iu = h.indexOf('undefined');
  if(iu >= 0) console.log('    undefined at: ' + JSON.stringify(h.slice(Math.max(0,iu-150), iu+50)));

  head('the day sheet on a prep day');
  const el2 = mk();
  if(mounts.daysheet){
    await mounts.daysheet(el2, { day:0 });
    await settle();
    const h2 = el2.innerHTML;
    t('it rendered', h2.length > 200, h2.length + ' chars');
    t('and names the phase, not "Day 0"', h2.includes('Red phase') && !/Day 0/.test(h2),
      (h2.match(/Red phase[^<]*/) || [''])[0]);
  } else t('daysheet registered', false);

  head('the profile badge on a prep day');
  const el3 = mk();
  if(mounts.profile){
    try { await mounts.profile(el3, {}); } catch(e){ console.log('    profile threw: ' + e.message); }
    await settle();
    const h3 = el3.innerHTML;
    t('it rendered', h3.length > 200, h3.length + ' chars');
    t('the badge names the phase', h3.includes('Red phase'));
    t('and not a day number below 1', !/Day 0 ·|Day -/.test(h3));
  } else t('profile registered', false);

  console.log(`\n${fail ? 'FAILED' : 'the prep phase reads correctly on screen'}  (${pass} ok, ${fail} failed)\n`);
  process.exit(fail ? 1 : 0);
})();
