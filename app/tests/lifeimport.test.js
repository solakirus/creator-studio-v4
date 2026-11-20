/* Importing to-dos from the other apps: tagged by part of life, never twice. */
const fs = require('fs');
const A = require('path').join(__dirname, '..') + '/';
const L = require(A + 'js/lifeimport.js');

let fails = 0;
const check = (label, cond, detail) => {
  if (!cond) fails++;
  console.log((cond ? '  ok  ' : '  !!  ') + label.padEnd(60) + (detail || ''));
};

/* program day 1 = 2026-11-01, so a date's day is its day of the month */
const dayOf = d => +d.slice(8, 10);
const TODAY = 20;

const punch = JSON.stringify({ format:'life-tasks', version:1, app:'Punch', tasks:[
  { id:'p1', title:'Re-caulk the tub', date:'2026-11-22', time:'9am', hours:1.5, where:'Bathroom', steps:['Scrape', 'Caulk'] },
  { id:'p2', title:'Clean gutters', date:'2026-11-23' },
  { id:'p2', title:'Clean gutters', date:'2026-11-23' },                  // twice in one file
  { title:'#Example row', date:'2026-11-23' }
]});
const car = 'app,id,title,date,steps\nTorque Book,c9,Oil change — Civic,2026-11-24,Drain; Filter; Fill\nTorque Book,c10,Rotate tires,,';
const family = JSON.stringify([{ format:'life-tasks', app:'Homebase', area:'family', tasks:[
  { id:'ch1@2026-11-21', title:'Take out trash', date:'2026-11-21' }] }]);

console.log('— reading files —');
const p = L.parse(punch);
check('JSON tasks are read, the example row is not', p.length === 3, p.length);
check('the area is guessed from the app', p[0].area === 'home');
check('hours become minutes', p[0].minutes === 90);
check('9am becomes 09:00', p[0].time === '09:00');
check('steps come through', p[0].steps.length === 2);
const c = L.parse(car);
check('a CSV works', c.length === 2 && c[0].area === 'car', c.map(x => x.area).join());
check('CSV steps split on semicolons', c[0].steps.length === 3);
const f = L.parse(family);
check('several apps in one array', f.length === 1 && f[0].area === 'family');

console.log('\n— duplicates are skipped —');
const first = L.classify(p.concat(c, f), [], [], dayOf, TODAY);
check('new tasks come in', first.add.length === 5, first.add.length);
check('the same task twice in one file comes in once', first.dup.length === 1 && first.dup[0].title === 'Clean gutters');
check('an undated task lands on today', first.add.find(x => x.title === 'Rotate tires').day === TODAY);

const made = first.add.map((it, i) => L.toTask(it, 1000 + i, true));
check('imported tasks carry where they came from', made.every(t => t.src && t.life && t.lifeApp));
check('and are marked to be filmed', made.every(t => t.kind === 'shoot'));
check('the arriving note is escaped', L.toTask({ ...first.add[0], notes:'<b>x</b>' }, 1, false).note.includes('&lt;b&gt;'));

const again = L.classify(p.concat(c, f), made, [], dayOf, TODAY);
check('importing the same files again adds nothing', again.add.length === 0, again.add.length);
check('and says why', again.dup.every(d => d.why));

const done = made.map(t => ({ ...t, view:'done' }));
check('a finished one is not brought back', L.classify(p, done, [], dayOf, TODAY).add.length === 0);
check('a deleted one is not brought back (remembered key)',
  L.classify(p, [], first.add.map(x => x.src), dayOf, TODAY).add.length === 0);

const typed = [{ id:5, day:22, title:'Re-caulk  the tub!', view:'todo' }];
const r = L.classify(L.parse(punch), typed, [], dayOf, TODAY);
check('one you typed yourself with the same title and day is skipped',
  r.dup.some(d => d.title === 'Re-caulk the tub' && d.why === 'already on that day'));
check('the same title on another day still comes in',
  L.classify([{ ...p[0], src:'punch:other', date:'2026-11-29' }], typed, [], dayOf, TODAY).add.length === 1);

console.log('\n— in the app —');
const settings = fs.readFileSync(A + 'js/screens/settings.js', 'utf8');
const today = fs.readFileSync(A + 'js/views/today.js', 'utf8');
const html = fs.readFileSync(A + 'index.html', 'utf8');
check('the script is loaded', /js\/lifeimport\.js/.test(html));
check('Settings has the row', /data-go="lifeimport"/.test(settings) && /LifeImport\.open\(\)/.test(settings));
check('Today can focus on one part of life', /data-focus=/.test(today) && /\.filter\(inFocus\)/.test(today));
check('and remembers the choice', /cs4:focus/.test(today));

if (fails) { console.log(`\nFAIL ${fails}`); process.exit(1); }
console.log('\nall good');
