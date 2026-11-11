/* Whole-app checks for the mistakes this codebase keeps producing
   (docs/CREATOR-STUDIO-3.md, "Mistakes this codebase keeps producing"),
   plus Creator Studio 3's identity. Source checks: cheap, and they catch the
   bugs that parse fine and then take the app down on the device.

     node app/tests/checks.test.js */
const fs = require('fs'), path = require('path');
const A = path.join(__dirname, '..') + '/';
const ROOT = path.join(A, '..');

let fails = 0;
const ok = (cond, label, extra) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${extra ? '   ' + extra : ''}`);
  if (!cond) fails++;
};
const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const js = walk(A + 'js').filter(f => f.endsWith('.js'));
const src = Object.fromEntries(js.map(f => [path.relative(A, f), fs.readFileSync(f, 'utf8')]));
const html = fs.readFileSync(A + 'index.html', 'utf8');

console.log('\nidentity');
/* The default must be CS3's own database. A CS_DB_NAME override is allowed so
   tests can use a throwaway one, but nothing may name v2's database. */
ok(/const DB_NAME = (?:global\.CS_DB_NAME \|\| )?'creator-studio-3';/.test(src['js/store.js']),
  'own database by default, never v2\'s');
ok(!/'creator-studio'(?!-)/.test(src['js/store.js']),
  'and v2\'s database name appears nowhere');
ok(/<title>Creator Studio 3<\/title>/.test(html), 'title says Creator Studio 3');
const nativeDir = path.join(ROOT, 'native');
const nat = fs.readdirSync(nativeDir).filter(f => /\.(java|xml)$/.test(f))
  .map(f => [f, fs.readFileSync(path.join(nativeDir, f), 'utf8')]);
const v2links = nat.filter(([, s]) => s.includes('com.creatorstudio.v2://'));
ok(!v2links.length, 'widgets and shortcuts open cs3://, not v2', v2links.map(x => x[0]).join(' '));
const sc = (nat.find(x => x[0] === 'shortcuts.xml') || [])[1] || '';
ok(!/targetPackage="com\.creatorstudio\.v2"/.test(sc), 'shortcuts target the cs3 app id');
const cap = JSON.parse(fs.readFileSync(path.join(ROOT, 'capacitor.config.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
ok(cap.appId === 'com.solakirus.creatorstudio3' && pkg.build.appId === cap.appId, 'Android and Windows share one app id');

console.log('\n1. every script tag points at a file');
const tags = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const missing = tags.filter(t => !fs.existsSync(A + t));
ok(!missing.length, `${tags.length} scripts load`, missing.join(' '));
const unloaded = Object.keys(src).filter(f => !tags.includes(f));
ok(!unloaded.length, 'every js file is loaded', unloaded.join(' '));

console.log('\n2. global. only where global is declared');
const badGlobal = Object.entries(src).filter(([, s]) => /\bglobal\./.test(s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))
  && !/\(function\s*\(\s*global\s*[,)]/.test(s));
ok(!badGlobal.length, 'no stray global.', badGlobal.map(x => x[0]).join(' '));

console.log('\n3. no handlers matching the theme attributes on <html>');
const themeMatch = Object.entries(src).filter(([, s]) => /closest\(\s*['"]\[data-(mode|type|palette)\]/.test(s));
ok(!themeMatch.length, "no closest('[data-mode]') / [data-type] / [data-palette]", themeMatch.map(x => x[0]).join(' '));

console.log('\n5. every pushed screen is registered');
const all = Object.values(src).join('\n');
const registered = new Set([...all.matchAll(/Screens\.register\(\s*['"]([\w-]+)['"]/g)].map(m => m[1]));
const pushed = new Set([...all.matchAll(/Screens\.(?:push|mountInto|replace)\(\s*['"]([\w-]+)['"]/g)].map(m => m[1]));
const orphan = [...pushed].filter(p => !registered.has(p));
ok(!orphan.length, `${pushed.size} screens pushed, all registered`, orphan.join(' '));

console.log('\n7. every tool tile has a route');
const app = src['js/app.js'];
const toolsBlock = (app.match(/const TOOLS\s*=\s*\[([\s\S]*?)\];/) || [])[1] || '';
const tiles = [...toolsBlock.matchAll(/name:\s*"([^"]+)"/g)].map(m => m[1]);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const routes = (app.match(/const TOOL_ROUTES\s*=\s*\{([\s\S]*?)\};/) || [])[1] || '';
const keys = new Set([...routes.matchAll(/['"]?([\w-]+)['"]?\s*:/g)].map(m => m[1]));
const noRoute = tiles.filter(t => !keys.has(slug(t)));
ok(tiles.length === 8, `Tools has 8 tiles`, tiles.join(', '));
ok(!noRoute.length, 'every tile slug is in TOOL_ROUTES', noRoute.join(' '));
const routeTargets = [...routes.matchAll(/:\s*'([\w-]+)'/g)].map(m => m[1]);
const deadRoute = routeTargets.filter(r => !registered.has(r));
ok(!deadRoute.length, 'every route opens a registered screen', deadRoute.join(' '));

console.log('\nbackup covers every store');
const tr = src['js/transfer.js'];
ok(!/RECORD_STORES\s*=\s*\[/.test(tr), 'no hand-kept store list in transfer.js');
ok(/objectStoreNames/.test(tr), 'store list read from the database itself');

console.log('\nthe board works offline');
const board = fs.readFileSync(A + 'board/board.html', 'utf8');
ok(!/fonts\.googleapis|fonts\.gstatic/.test(board), 'no Google Fonts in the board');
const fcss = fs.readFileSync(A + 'board/fonts/board-fonts.css', 'utf8');
const missingFonts = [...fcss.matchAll(/url\('([^']+)'\)/g)].map(m => m[1]).filter(f => !fs.existsSync(A + 'board/fonts/' + f));
ok(!missingFonts.length, 'every board font file is there', missingFonts.join(' '));

console.log('\na newer database never takes the app down');
ok(/VersionError/.test(src['js/store.js']), 'store.js falls back to opening it as-is');

console.log('\nmoving Day 1 never moves the plans');
const set = src['js/screens/settings.js'];
ok(/Data\.moveStart\(/.test(set), 'the start-date sheet calls moveStart');
/* The bug this replaces: writing the new start on its own, which slides every
   task and beat onto a different real date. */
ok(!/await Data\.setProgram\(\{ start:/.test(set),
  'and never writes the start on its own');
ok(/function moveStart/.test(src['js/data.js']), 'and data.js provides it');

console.log('\nday 0 is a real date, not a missing day');
/* Day numbers run below 1 — the run-up to Day 1 — so a truthiness test on a
   day silently drops day 0. These are the spots it was wrong in. */
const dayTruthy = Object.entries(src)
  .flatMap(([f, s]) => s.split('\n').map((l, i) => [f, i + 1, l]))
  .filter(([f, , l]) =>
    /\.day \|\| null|\.day \? ` · day |filter\(\w+ => \w+\.at && \w+\.day &&/.test(l))
  .map(([f, n]) => `${f}:${n}`);
ok(!dayTruthy.length, 'no day read through a truthiness test', dayTruthy.join(' '));

console.log('\nthere is always a copy outside the app');
const bk = src['js/backup.js'];
ok(!!bk, 'backup.js ships');
/* The whole point is a file the app cannot take with it when it is deleted.
   CACHE is inside the app's own storage and would go with it. */
ok(/directory: *'DOCUMENTS'/.test(bk), 'it writes to Documents');
ok(!/'CACHE'/.test(bk), 'and never to the app\'s own cache');
ok(/Backup\.auto\(\)/.test(src['js/app.js']), 'and it runs itself on open');
ok(/data-go="autobackup"/.test(src['js/screens/settings.js']),
  'with a row in Settings showing when it last ran');
/* A backup that reports success it did not have is worse than none. */
ok(/written short/.test(bk), 'a short write is treated as a failure');

console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
process.exit(fails ? 1 : 0);
