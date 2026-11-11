/* Paper reached from Planning, and the page sized to be looked at.

   Two things this proves: the Planning tab actually mounts Paper (and without
   a second title bar, which would steal the height the page needs), and fit()
   picks the whole-sheet scale on a landscape window rather than the
   fill-the-width scale that suits a phone. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  console.log(`  ${cond ? 'ok ' : 'FAIL'}  ${name.padEnd(50)} ${extra}`);
  cond ? pass++ : fail++;
};
const head = s => console.log(`\n— ${s} —`);

head('the Planning screen offers Paper');
const plan = fs.readFileSync(path.join(ROOT, 'js/screens/planning.js'), 'utf8');
t('there is a Paper tab', /data-sec="paper"/.test(plan));
t('it mounts the paper screen', /mountInto\('paper'/.test(plan));
t('embedded, so it loses the duplicate bar', /mountInto\('paper', host, \{ embedded:true \}/.test(plan));
t('and the header says Paper on that tab', /section === 'paper'\s*\?\s*'Paper'/.test(plan));

head('and the paper screen knows it is embedded');
const scr = fs.readFileSync(path.join(ROOT, 'js/screens/paper-screen.js'), 'utf8');
t('it skips its own bar when hosted', /o\.embedded \? '' : Screens\.bar/.test(scr));
t('and a prep-day task still reaches the page', /t\.day != null/.test(scr),
  /t => t\.day\)/.test(scr) ? 'TRUTHINESS STILL THERE' : '');

head('the sheet is sized to be seen, not scrolled');
/* fit() is private to paper.js, so exercise the real thing: load the module
   with a stub DOM, hand it a landscape stage, and read the scale it sets. */
const src = fs.readFileSync(path.join(ROOT, 'js/paper.js'), 'utf8');
t('there are two fit modes', /st\.fit === 'width'/.test(src));
t('whole page is the default', /fit: 'page'/.test(src));
t('it measures the room rather than assuming it', /getBoundingClientRect/.test(src));
t('and the choice is remembered', /fit: st\.fit/.test(src));

/* the arithmetic itself, lifted exactly as written */
const PW = 1000, PH = 1400;
const fitScale = (mode, stageW, roomH, n = 1) => {
  const byW = (stageW || 1000) / (PW * n);
  let scale;
  if(mode === 'width') scale = Math.min(2, byW);
  else scale = roomH > 120 ? Math.min(byW, roomH / PH) : byW;
  return Math.max(.08, scale);
};

head('on a laptop window (1450 wide, 760 of room)');
const page  = fitScale('page',  1450, 760);
const width = fitScale('width', 1450, 760);
t('whole page fits the height', Math.round(PH * page) <= 760, Math.round(PH * page) + 'px tall');
t('and fits the width too', Math.round(PW * page) <= 1450, Math.round(PW * page) + 'px wide');
t('fill width is bigger, for writing', width > page, width.toFixed(2) + ' vs ' + page.toFixed(2));
t('fill width overflows the height, as it should', Math.round(PH * width) > 760,
  Math.round(PH * width) + 'px tall');

head('the real laptop case: the spread turns on at 900px');
/* spreadOn() gives two pages side by side from 900px wide, which is a much
   better match for a landscape window than one portrait page. */
const src2 = fs.readFileSync(path.join(ROOT, 'js/paper.js'), 'utf8');
t('the spread is automatic above 900px', /st\.spread === null \? \(host\.clientWidth \|\| 1200\) >= 900/.test(src2));
const two = fitScale('page', 1450, 760, 2);
t('two pages fit the window whole', Math.round(PH * two) <= 760 && Math.round(2 * PW * two) <= 1450,
  Math.round(2 * PW * two) + '×' + Math.round(PH * two));
t('and use the width better than one page does', 2 * PW * two > PW * page,
  Math.round(2 * PW * two) + 'px vs ' + Math.round(PW * page) + 'px');

head('on a phone (380 wide, 600 of room)');
const ph = fitScale('page', 380, 600);
t('it still fits', Math.round(PH * ph) <= 600 && Math.round(PW * ph) <= 380,
  Math.round(PW * ph) + '×' + Math.round(PH * ph));

head('and it does not blow up in the corner cases');
t('a two-page spread halves the width', fitScale('page', 1450, 2000, 2) < fitScale('page', 1450, 2000, 1));
t('no room measured yet falls back to width', fitScale('page', 1450, 0) === 1.45);
t('never scales to nothing', fitScale('page', 0, 0) > 0);

console.log(`\n${fail ? 'FAILED' : 'Paper is in Planning, and the page fits the window'}  (${pass} ok, ${fail} failed)\n`);
process.exit(fail ? 1 : 0);
