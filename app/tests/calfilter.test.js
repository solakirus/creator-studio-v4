/* The channel filter was a wrapped list of nine pills above the grid, so the
   month you opened the screen to look at started below the fold. It is one row
   now, and the theme block moved below the grid for the same reason. */
const fs = require('fs');
const cal = fs.readFileSync('app/js/screens/calendar.js', 'utf8');
const css = fs.readFileSync('app/styles.css', 'utf8');

let pass = 0, fail = 0;
const t = (n, c, x) => { console.log(`  ${c ? 'ok ' : 'FAIL'}  ${n.padEnd(54)} ${x || ''}`); c ? pass++ : fail++; };

console.log('\n— the pill list is gone —');
t('no chiplist of channels on this screen', !/class="chiplist"/.test(cal));
t('and no per-channel pill in the page', !/data-chanf=/.test(cal));
t('its click handler went with it', !/dataset\.chanf/.test(cal));
t('replaced by one row', /<div class="calfilter">/.test(cal));
t('that opens a picker', /data-a="chans"/.test(cal) && /if\(a\.dataset\.a === 'chans'\) return openChannels\(\)/.test(cal));

console.log('\n— the row says where it stands —');
t('there is a label function', /function filterLabel\(\)/.test(cal));
t('and the row prints it', /<span>\$\{filterLabel\(\)\}<\/span>/.test(cal));
t('resting state is a statement, not a prompt', /if\(!filters\.size\) return 'All channels'/.test(cal));
t('one channel reads as its own name', /if\(filters\.size === 1\)/.test(cal));
t('"No channel" alone is named properly', /only === '' \? 'No channel only' : only/.test(cal));
t('more than one is counted', /return `\$\{filters\.size\} channels`/.test(cal));
/* every channel ticked still hides tasks, so it is not the "All" view */
t('all-ticked is NOT reported as All channels',
  !/filters\.size === CHANS\.length\) return 'All channels'/.test(cal));

console.log('\n— and there is a way back to the whole month —');
t('a Clear button, only when a filter is on', /\$\{filters\.size \? `<button class="btn-sm" data-a="allchans">Clear/.test(cal));
t('it empties the set', /if\(a\.dataset\.a === 'allchans'\)\{ filters\.clear\(\); return render\(\); \}/.test(cal));
t('and the sheet has an All channels row', /data-ch="__all"/.test(cal));
t('which clears rather than selects everything', /if\(v === '__all'\) filters\.clear\(\)/.test(cal));

console.log('\n— the picker sheet behaves —');
t('channels toggle, they are not a single choice',
  /filters\.has\(v\) \? filters\.delete\(v\) : filters\.add\(v\)/.test(cal));
t('ticks repaint in place', /const sync = \(\) =>/.test(cal));
/* rebuilding the sheet would slide it up from the bottom on every tick */
t('the sheet is not rebuilt on each tick',
  !/sync\(\);[\s\S]{0,80}openChannels\(\)/.test(cal));
t('the grid behind it updates as you tick', /sync\(\);\s*\n[\s\S]{0,180}render\(\);/.test(cal));
t('the No channel row only shows when something has none',
  /clips\.some\(c => !c\.channel\) \? `/.test(cal));

console.log('\n— channel names are the user’s text, so they are escaped —');
t('this file has its own esc', /const esc = s => String\(s == null \? '' : s\)/.test(cal));
t('used on the row', /data-ch="\$\{esc\(c\.n\)\}"/.test(cal));
t('and on the label', /<span class="lbl">\$\{esc\(c\.n\)\}<\/span>/.test(cal));
/* U does not export one; a bare esc here would be a ReferenceError at render */
t('and it is defined at module scope, not inside the sheet',
  cal.indexOf('const esc = s =>') < cal.indexOf('async function mount'));

console.log('\n— the grid is nearer the top —');
const iFilter = cal.indexOf('class="calfilter"');
const iGrid   = cal.indexOf('class="calgrid"');
const iTheme  = cal.indexOf('data-a="theme"');
t('the filter comes before the grid', iFilter > 0 && iFilter < iGrid);
t('and the theme block after it', iTheme > iGrid, `filter ${iFilter}, grid ${iGrid}, theme ${iTheme}`);
t('the theme is still editable', /if\(a\.dataset\.a === 'theme'\) return openTheme\(\)/.test(cal));
t('and only rendered once', (cal.match(/data-a="theme"/g) || []).length === 1);
t('the grid still tells you it is tappable', /Tap any day to see it and add a task to it/.test(cal));

console.log('\n— the wording matches what it actually does —');
t('no stale "filtering by platform"', !/filtering by platform/.test(cal));
t('it says channel, because that is the filter', /while a channel filter is on/.test(cal));

console.log('\n— styled as one row —');
t('.calfilter is a flex row', /\.calfilter\{display:flex/.test(css));
t('the button fills the width', /\.cf-pick\{flex:1 1 auto/.test(css));
t('a long channel name truncates instead of wrapping',
  /\.cf-pick > span\{[^}]*text-overflow:ellipsis;white-space:nowrap/.test(css));
t('and it is a 44px tap target', /\.cf-pick\{[^}]*height:44px/.test(css));
t('the tick column is styled', /\.cf-tick\{/.test(css));

console.log(`\n${fail ? 'FAILED' : 'the month grid starts above the fold'}  (${pass} ok, ${fail} failed)\n`);
process.exit(fail ? 1 : 0);
