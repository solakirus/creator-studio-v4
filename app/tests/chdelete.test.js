/* A channel can be deleted from the page you actually open. */
const fs = require('fs');
const A = require('path').join(__dirname, '..') + '/';

let fails = 0;
const check = (label, cond, detail) => {
  if (!cond) fails++;
  console.log((cond ? '  ok  ' : '  !!  ') + label.padEnd(56) + (detail || ''));
};

const ch = fs.readFileSync(A + 'js/screens/channel.js', 'utf8');
const set = fs.readFileSync(A + 'js/screens/settings.js', 'utf8');
const css = fs.readFileSync(A + 'styles.css', 'utf8');

console.log('— where the delete lives —');
check('the settings row opens the channel page', /data-open="\$\{c\.n/.test(set));
check('so the editor there has to offer delete', /data-delete/.test(ch));
check('and the reason is written down', /had become undeletable/.test(ch));
check('settings keeps its own, for the form reached by EDIT', /data-delete/.test(set));

console.log('\n— it asks before it does it —');
check('naming the channel', /Delete \$\{esc\(ch\.n\)\}\?/.test(ch));
check('counting what names it', /thing\$\{uses === 1 \? '' : 's'\} name this channel/.test(ch));
check('and promising they survive', /They stay,/.test(ch));
check('nothing goes on the first tap',
  ch.indexOf('data-delete]') < ch.indexOf('data-yes]'));

console.log('\n— and it removes the right one —');
check('only the channel by that name', /filter\(x => x\.n !== ch\.n\)/.test(ch));
check('saving the rest', /Channels\.save\(all\)/.test(ch));
check('telling whoever opened it', /params\.onChange\(\)/.test(ch));
check('and leaving the page that showed it', /Screens\.pop\(\)/.test(ch));

console.log('\n— the way into the editor is hittable —');
check('EDIT is a real tap target', /\.chedit\{[^}]*padding:9px 11px/.test(css),
  (css.match(/\.chedit\{[^}]*padding:[^;]+/) || [''])[0].split('padding:')[1] || '');
check('without pushing the row taller', /\.chedit\{[^}]*margin:-4px 0/.test(css));

console.log(fails ? '\n' + fails + ' FAILED' : '\na channel can be removed');
process.exit(fails ? 1 : 0);
