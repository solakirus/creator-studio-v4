/* Notes and photos on a task. */
const fs = require('fs');
const A = require('path').join(__dirname, '..') + '/';

let fails = 0;
const check = (label, cond, detail) => {
  if (!cond) fails++;
  console.log((cond ? '  ok  ' : '  !!  ') + label.padEnd(56) + (detail || ''));
};

const t = fs.readFileSync(A + 'js/screens/task.js', 'utf8');
const store = fs.readFileSync(A + 'js/store.js', 'utf8');
const css = fs.readFileSync(A + 'styles.css', 'utf8');

console.log('— a note you can write —');
check('the field is there', /id="tk-note"/.test(t));
check('holding its own text, not the one the task arrived with',
  /String\(t\.notes \|\| ''\)/.test(t));
check('and the arriving note still shows above it', /\$\{t\.note \?/.test(t));
check('it saves when you leave the field', /e\.target\.id !== 'tk-note'/.test(t));
check('not on every keystroke', !/addEventListener\('input'[\s\S]{0,200}tk-note/.test(t));
check('and the reason is written down', /a task write also re-sorts Today/.test(t));

console.log('\n— photos —');
check('there is a store for them', /'task-media'/.test(store));
check('and the version was bumped for it', +((store.match(/DB_VERSION = (\d+)/) || [])[1]) >= 33);
check('keyed per task so several fit', /<taskId>:<n>/.test(store));
check('adding one opens the picker', /App\.pickImage\(async file =>/.test(t));
check('into the next free slot', /Math\.max\(\.\.\.mine\) \+ 1/.test(t));
check('which is why', /removing one in the middle does not collide/.test(t));
check('only this task\'s photos are shown',
  /k\.split\(':'\)\[0\] === String\(t\.id\)/.test(t));
check('in the order they were added', /\+a\[0\]\.split\(':'\)\[1\]/.test(t));
check('each can be removed', /data-rmshot=/.test(t));
check('without opening anything behind it', /rm\)\{\s*\n\s*e\.stopPropagation\(\)/.test(t));
check('and the object urls are released', /revokeObjectURL/.test(t));

console.log('\n— and it is usable —');
check('the note field is styled', /\.tknote\{/.test(css));
check('the photos sit in a grid', /\.tkshots\{[^}]*grid-template-columns:repeat\(3/.test(css));
check('and the remove button is a real target',
  /\.tkx\{[^}]*width:26px;height:26px/.test(css));

console.log(fails ? '\n' + fails + ' FAILED' : '\nnotes and photos explain a task');
process.exit(fails ? 1 : 0);
