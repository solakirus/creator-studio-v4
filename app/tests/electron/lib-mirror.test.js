/* The Shot Library on the NAS with a copy on this computer (v4), against real
   folders in a temp directory and the real electron/library.js:
     - "Copy now" copies every frame, manifest and board; a second run copies
       nothing; a changed file goes across again; a deleted one stays in the copy;
     - _Deleted and dot files are left out; a copy inside its folder is refused;
     - when the NAS folder is gone, the Library reads the copy under the NAS
       folder's own uids, so tasks, boards and stars still find their frames;
       the copy's files may be served; the copy isn't read twice when both exist.

     node app/tests/electron/lib-mirror.test.js */
const path = require('path'), fs = require('fs'), os = require('os');

let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs4-mirror-'));
process.env.SHOT_LIBRARY_HOME = path.join(tmp, 'home');
fs.mkdirSync(process.env.SHOT_LIBRARY_HOME, { recursive: true });
const Lib = require(path.join(__dirname, '..', '..', '..', 'electron', 'library.js'));

const nas = path.join(tmp, 'nas', 'Shot Library');
const copy = path.join(tmp, 'laptop', 'Shot Library copy');
const put = (rel, data) => { const f = path.join(nas, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); return f; };
const fixtures = path.join(__dirname, '..', 'fixtures');
const gif = fs.readFileSync(path.join(fixtures, 'opener.gif'));
const png = fs.readFileSync(path.join(fixtures, 'still.png'));

put('Cinema/coffee/gifs/pour.gif', gif);
put('Cinema/coffee/images/cup.png', png);
put('Cinema/coffee/manifest.json', JSON.stringify({ site: 'Cinema', page: 'coffee', items: [{ file: 'gifs/pour.gif', label: 'The pour' }] }));
put('Morning/wake.png', png);
put('_Boards/Morning/Routine/pour.gif', gif);
put('_Deleted/old.gif', gif);
put('.thumbs/x.png', png);

(async () => {
  console.log('\nCopying');
  let steps = 0;
  let st = await Lib.mirrorCopy(nas, copy, () => steps++);
  ok(st.copied === 5 && st.failed === 0, 'first copy takes every frame, the manifest and the board', JSON.stringify({ copied: st.copied, failed: st.failed }));
  ok(fs.existsSync(path.join(copy, 'Cinema', 'coffee', 'gifs', 'pour.gif')), 'files keep their folders');
  ok(fs.readFileSync(path.join(copy, 'Cinema', 'coffee', 'gifs', 'pour.gif')).equals(gif), 'byte for byte');
  ok(!fs.existsSync(path.join(copy, '_Deleted')) && !fs.existsSync(path.join(copy, '.thumbs')), '_Deleted and dot folders stay behind');
  ok(!fs.readdirSync(path.join(copy, 'Morning')).some(f => f.endsWith('.cs4part')), 'no half-copied files left');

  st = await Lib.mirrorCopy(nas, copy);
  ok(st.copied === 0 && st.same === 5, 'second run copies nothing', JSON.stringify({ copied: st.copied, same: st.same }));

  const f = path.join(nas, 'Morning', 'wake.png');
  fs.writeFileSync(f, Buffer.concat([png, Buffer.from('changed')]));
  put('Morning/stretch.gif', gif);
  st = await Lib.mirrorCopy(nas, copy);
  ok(st.copied === 2, 'a changed and a new file go across', st.copied);
  ok(fs.statSync(path.join(copy, 'Morning', 'wake.png')).size === png.length + 7, 'the copy has the changed file');

  fs.unlinkSync(path.join(nas, 'Morning', 'stretch.gif'));
  await Lib.mirrorCopy(nas, copy);
  ok(fs.existsSync(path.join(copy, 'Morning', 'stretch.gif')), 'deleting on the NAS never deletes from the copy');

  let threw = '';
  try { await Lib.mirrorCopy(nas, path.join(nas, 'inside')); } catch (e) { threw = e.message; }
  ok(/inside/.test(threw), 'a copy inside its own folder is refused', threw);
  threw = '';
  try { await Lib.mirrorCopy(path.join(tmp, 'nope'), copy); } catch (e) { threw = e.message; }
  ok(/No folder/.test(threw), 'an unreachable folder says so', threw);

  console.log('\nReading');
  const mirrors = { [nas]: copy };
  let r = Lib.scanAll([nas], mirrors);
  const live = r.items.map(i => i.uid).sort();
  ok(r.fallback.length === 0 && r.errors.length === 0, 'the NAS folder is read when it is there');
  ok(live.length === 3 && live.every(u => u.startsWith('h:' + nas + '|')), 'its frames answer to the NAS folder (boards in _Boards aren’t Deck frames)', live.length);
  ok(!r.items.some(i => i.root === copy), 'the copy isn’t read as well');
  const label = (r.items.find(i => i.path === 'Cinema/coffee/gifs/pour.gif') || {}).label;
  ok(label === 'The pour', 'manifest labels come through', label);

  /* the NAS goes away (renamed, like a drive that's offline) */
  fs.renameSync(nas, nas + ' (offline)');
  r = Lib.scanAll([nas], mirrors);
  ok(r.fallback.length === 1 && r.fallback[0].root === nas && r.fallback[0].copy === copy, 'the Library says it is reading the copy');
  ok(r.errors.length === 0, 'no “No folder” error while the copy stands in', JSON.stringify(r.errors));
  const offline = r.items.map(i => i.uid).filter(u => !u.endsWith('stretch.gif')).sort();
  ok(JSON.stringify(offline) === JSON.stringify(live), 'the same uids, so tasks, boards and stars still find their frames');
  ok(r.items.length === 4, 'the copy also has the frame that was deleted on the NAS', r.items.length);
  const it = r.items.find(i => i.path === 'Morning/wake.png');
  ok(it && it.root === copy && decodeURIComponent(it.url.replace('cs3lib://f/', '')).startsWith(copy), 'the picture itself is read from the copy');
  ok(Lib.allowed(path.join(copy, 'Morning', 'wake.png')), 'the copy’s files may be served to the page');
  const pg = r.pages.find(p => p.uid === it.page);
  ok(pg && pg.uid.startsWith('h:' + nas + '|'), 'pages keep their NAS ids, so ticked/unticked pages stay as they were');

  fs.renameSync(nas + ' (offline)', nas);
  r = Lib.scanAll([nas], {});
  ok(r.fallback.length === 0 && !Lib.allowed(path.join(copy, 'Morning', 'wake.png')), 'with no copy set, the copy folder is not served');
  r = Lib.scanAll([path.join(tmp, 'gone')], { [path.join(tmp, 'gone')]: path.join(tmp, 'also-gone') });
  ok(r.errors.length === 1 && /No folder/.test(r.errors[0]), 'folder and copy both missing: one plain error');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL', e); process.exit(1); });
