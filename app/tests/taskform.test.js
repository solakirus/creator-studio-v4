/* Adding a task to a day that is not today.

   The month grid and the week board could show tasks, move them and tick them,
   and never make one — the only add form lived inside the Today view and always
   landed on today. This checks the lifted-out form exists, that the three
   planning screens actually call it with their own day, and that the repeat
   expansion lands on the right dates. */
const fs = require('fs');
const form  = fs.readFileSync('app/js/taskform.js', 'utf8');
const cal   = fs.readFileSync('app/js/screens/calendar.js', 'utf8');
const week  = fs.readFileSync('app/js/screens/week-board.js', 'utf8');
const dayst = fs.readFileSync('app/js/screens/daysheet.js', 'utf8');
const html  = fs.readFileSync('app/index.html', 'utf8');
const css   = fs.readFileSync('app/styles.css', 'utf8');

let pass = 0, fail = 0;
const t = (n, c, x) => { console.log(`  ${c ? 'ok ' : 'FAIL'}  ${n.padEnd(52)} ${x || ''}`); c ? pass++ : fail++; };

console.log('\n— the form is a module, not a screen’s private part —');
t('it hangs one global off window', /global\.TaskForm = \{ open/.test(form) && /\}\)\(window\);/.test(form));
t('and index.html loads it', /<script src="js\/taskform\.js"><\/script>/.test(html));
t('before the screens that call it',
  html.indexOf('js/taskform.js') < html.indexOf('js/screens/program.js'));
t('it takes a day to aim at', /opts\.day/.test(form) && /if\(day == null && o\.date != null\)/.test(form));
t('a date works too, converted once', /await Data\.dateToDay\(ts\)/.test(form));
t('and it falls back to today, never to nothing', /if\(day == null\) day = await Data\.currentDay\(\)/.test(form));

console.log('\n— ids are unique across devices, not counted —');
/* "highest + 1" collides once two devices sync: both make the same next id.
   U.taskId is time plus random digits, so the phone and laptop never agree. */
t('ids come from U.taskId', /async function nextId\(\)\{ return U\.taskId\(\); \}/.test(form));
t('and the id is taken at save time, not at open', /let id = await nextId\(\);/.test(form));
t('each copy in a series gets its own', /id: U\.taskId\(\), day: day \+ i/.test(form));
t('nothing counts from the highest id any more', !/Math\.max\(0, \.\.\./.test(form));

console.log('\n— the month grid can write to a square —');
t('the day sheet offers it', /data-add style="flex:1">\+ Add a task/.test(cal));
t('aimed at that date, not today', /TaskForm\.open\(\{ date: ts,/.test(cal));
t('and reloads the grid after', /onSaved: async \(\) => \{ await load\(\); render\(\); \}/.test(cal));
t('a task row is no longer a dead end', !/data-task="\$\{c\.id\}"[\s\S]{0,80}cursor:default/.test(cal)
  && /<button class="row" data-task="\$\{c\.id\}">/.test(cal));
t('tapping one opens the real task', /Screens\.push\('task', \{ id,/.test(cal));

console.log('\n— the week board can write to a column —');
t('each day header carries a +', /data-add="\$\{day\.n\}"/.test(week));
t('with a label a screen reader can use', /aria-label="Add a task to \$\{DOW/.test(week));
t('it opens the form on that day', /TaskForm\.open\(\{ day: \+add\.dataset\.add/.test(week));
t('and keeps your scroll position', /o\.keepScroll = true; await render\(\); o\.keepScroll = false;/.test(week));
t('the + is a real tap target, not a glyph', /\.wk-add\{[^}]*width:28px;height:28px/.test(css));
t('and the hint says it exists', /Tap <b>\+<\/b> on a day/.test(week));

console.log('\n— the day sheet can write to its own day —');
t('there is a + Task in the bar', /data-a="add">\+ Task/.test(dayst));
t('and in the empty state', /data-a="add">\+ Add a task/.test(dayst));
t('it passes the sheet’s day', /TaskForm\.open\(\{ day, onSaved/.test(dayst));
t('the empty state no longer sends you to Today',
  !/Add a task on Today/.test(dayst));
t('and print still works', /if\(a\.dataset\.a === 'print'\) return window\.print\(\)/.test(dayst));

console.log('\n— what it writes is a normal task —');
/* the whole point: one store, so Today, the board, the calendar and the day
   sheet all pick it up with no extra plumbing */
t('written straight to the tasks store', /Store\.put\('tasks', base\)/.test(form));
t('with the shape the app expects',
  /view: 'todo'/.test(form) && /pri,/.test(form) && /subs: steps/.test(form));
t('the cache is told', /Data\.invalidate\('tasks'\)/.test(form));
t('notifications and the widget too', /Notify\.update\(\)/.test(form) && /Widget\.refresh\(\)/.test(form));
t('each of those guarded, none load-bearing',
  (form.match(/try \{ if\(global\./g) || []).length >= 3);
t('a kind is only set when chosen', /if\(kind\) base\.kind = kind;/.test(form));
t('so a plain task stays uncoloured on the board', /''\:'Plain'/.test(form.replace(/\s/g, '')));

console.log('\n— the repeat lands on the right days, run for real —');
/* the same walk the form does: step forward a day at a time from the chosen
   date and drop a copy on every matching weekday */
function expand(startTs, startDay, dows, weeks){
  const out = [];
  const start = new Date(startTs); start.setHours(0, 0, 0, 0);
  for(let i = 0; i < weeks * 7; i++){
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if(!dows.includes(d.getDay())) continue;
    out.push({ day: startDay + i, dow: d.getDay() });
  }
  return out;
}

/* Mon 2 Nov 2026 is a Monday */
const mon = new Date(2026, 10, 2).getTime();
t('a Monday start on Mondays is a weekly run',
  expand(mon, 100, [1], 4).length === 4, 'four Mondays in four weeks');
t('and the first one is the day you picked',
  expand(mon, 100, [1], 4)[0].day === 100);
t('seven days apart each time',
  expand(mon, 100, [1], 4).map(x => x.day).join() === '100,107,114,121');

const mwf = expand(mon, 100, [1, 3, 5], 2);
t('Mon/Wed/Fri for two weeks is six', mwf.length === 6, mwf.map(x => x.day).join());
t('in date order', mwf.every((x, i) => i === 0 || x.day > mwf[i - 1].day));
t('and only on those weekdays', mwf.every(x => [1, 3, 5].includes(x.dow)));

/* picking a weekday that has already gone this week must still start next week,
   not land before the date you were planning */
const wed = expand(mon, 100, [0], 1);
t('a Sunday picked from a Monday waits for the Sunday',
  wed.length === 1 && wed[0].day === 106, 'day ' + (wed[0] || {}).day);
t('never earlier than the date picked', wed.every(x => x.day >= 100));

console.log('\n— counting in days, not weeks, survives a clock change —');
/* 1 Nov 2026 is the US DST fall-back. Adding 7*86400000 across it lands an hour
   early and can slide onto the wrong calendar day; setDate cannot. */
const beforeDst = new Date(2026, 9, 25).getTime();          /* Sun 25 Oct */
const walked = expand(beforeDst, 10, [0], 3).map(x => x.day);
t('three Sundays across the change', walked.length === 3, walked.join());
t('still exactly seven days apart', walked.join() === '10,17,24');
const naive = [0, 1, 2].map(n => new Date(beforeDst + n * 7 * 864e5).getDay());
t('the arithmetic version would not have been', naive.join() !== '0,0,0',
  'got weekdays ' + naive.join());
t('the source walks with setDate', /dd\.setDate\(start\.getDate\(\) \+ i\)/.test(form));

console.log('\n— and nothing is ever saved silently empty —');
t('a repeat that matches nothing still writes the one day',
  /if\(!written\.length\)\{[\s\S]{0,120}Store\.put\('tasks', base\)/.test(form));
t('an untitled task is refused', /if\(!name\)\{ \$\('#tf-err'\)\.hidden = false; return; \}/.test(form));
t('the toast says how many landed', /Added \$\{written\.length\} times/.test(form));

console.log('\n— house rules —');
t('no bare global. in a screen', !/[^.\w]global\./.test(cal + week + dayst));
t('the form escapes what it interpolates', /const esc = s =>/.test(form));
t('and uses it on the seeded title', /value="\$\{esc\(seed\.title \|\| ''\)\}"/.test(form));

console.log(`\n${fail ? 'FAILED' : 'planning screens can write tasks'}  (${pass} ok, ${fail} failed)\n`);
process.exit(fail ? 1 : 0);
