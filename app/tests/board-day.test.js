/* A day of the episode, on the episode's board.

   The chain is: the day button in the episode → BoardLink.hashFor → the
   board's focus param → the frames tagged with that act. Each link is cheap
   to check and the whole thing is useless if any one of them is wrong. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  console.log(`  ${cond ? 'ok ' : 'FAIL'}  ${name.padEnd(52)} ${extra}`);
  cond ? pass++ : fail++;
};
const head = s => console.log(`\n— ${s} —`);

const link  = fs.readFileSync(path.join(ROOT, 'js/boardlink.js'), 'utf8');
const sync  = fs.readFileSync(path.join(ROOT, 'js/boardsync.js'), 'utf8');
const vlog  = fs.readFileSync(path.join(ROOT, 'js/screens/vlog.js'), 'utf8');
const board = fs.readFileSync(path.join(ROOT, 'board/board.html'), 'utf8');

head('the day travels to the board');
t('the sequence carries its act id', /actId: act\.id/.test(sync));
t('and the day number', /actDay: act\.day != null/.test(sync));
t('the section is tagged with the act', /act: beat\.actId \|\| ''/.test(board));
t('and keeps its name for the label', /actName: beat\.act \|\| ''/.test(board));
t('a section made before this gets tagged on the next open',
  /if \(f\.data\.act !== \(beat\.actId \|\| ''\)\)/.test(board));
t('the no-op ternary is gone', !/beat\.act \? `\$\{beat\.title\}` : beat\.title/.test(board));

head('the episode offers it per day');
t('every day has a Board button', /data-actboard="\$\{act\.id\}"/.test(vlog));
t('it opens the episode board, not a new one', /BoardLink\.open\(\{ type:'vlog', id:v\.id[\s\S]{0,180}focus:`act:/.test(vlog));
t('and says so when the day has nothing on it yet', /Add a beat to this day first/.test(vlog));

head('focus survives the trip');
t('hashFor passes it on', /q\.set\('focus', o\.focus\)/.test(link));
t('the board reads it', /q\.get\('focus'\)/.test(board));
t('matching on the act', /focus\.startsWith\('act:'\)/.test(board));
t('fit can frame a subset', /function fit\(only\)/.test(board));
t('and still frames everything with no argument', /\(only && only\.length\) \? only : all/.test(board));
t('an empty day falls back rather than showing a blank stage', /if \(!rows\.length\) return;/.test(board));

/* --- hashFor itself, run for real --- */
head('the hash it actually builds');
global.window = global;
global.Screens = { push(){} };
new Function(fs.readFileSync(path.join(ROOT, 'js/boardlink.js'), 'utf8'))();
const h = s => new URLSearchParams(BoardLink.hashFor(s));

const day = h({ type:'vlog', id:7, name:'Week 42', focus:'act:a1' });
t('names the video', day.get('video') === 'vlog:7', day.get('video'));
t('carries the focus', day.get('focus') === 'act:a1', day.get('focus'));
t('and the name', day.get('name') === 'Week 42');

const whole = h({ type:'vlog', id:7, name:'Week 42' });
t('no focus when the whole episode is opened', whole.get('focus') === null);
t('same board either way', whole.get('video') === day.get('video'),
  'a day is a view of the week, not a second board');

const id = BoardLink.boardIdFor('vlog', 7);
t('the board id is stable', id === BoardLink.boardIdFor('vlog', 7), id);
t('and safe for odd ids', /^vb-vlog-[\w-]+$/.test(BoardLink.boardIdFor('vlog', 'a b/c')),
  BoardLink.boardIdFor('vlog', 'a b/c'));

console.log(`\n${fail ? 'FAILED' : 'a day opens its own part of the episode board'}  (${pass} ok, ${fail} failed)\n`);
process.exit(fail ? 1 : 0);
