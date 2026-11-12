/* nas/mirror.js — nastime keeps itself current from GitHub.

   A stand-in "GitHub" (a local web server over a folder) and a stand-in
   nastime www/. Checks: a newer GitHub version is copied in (only changed
   files downloaded, fingerprints checked, one swap); an older one never
   replaces what the laptop published; a bad file leaves www/ as it was.

     node app/tests/nas/mirror.test.js */
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { write } = require('../../../scripts/web-manifest');
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-'));
  const gh = path.join(tmp, 'gh'), site = path.join(tmp, 'nas', 'www');
  const put = (dir, f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
  const stamp = (dir, iso) => { const m = write(dir); m.made = iso; fs.writeFileSync(path.join(dir, 'update.json'), JSON.stringify(m)); return m; };
  const hits = [];
  let corrupt = null;
  const srv = http.createServer((q, r) => {
    const p = decodeURIComponent(q.url.split('?')[0]); hits.push(p);
    const f = path.join(gh, p);
    if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.end(corrupt === p ? Buffer.from('tampered') : fs.readFileSync(f));
  }).listen(0);
  await new Promise(r => srv.on('listening', r));
  process.env.SOURCE = `http://127.0.0.1:${srv.address().port}/`;
  process.env.SITE = site;
  const { look } = require('../../../nas/mirror');

  /* nastime has v1, GitHub has v2 (one file changed, one added) */
  put(site, 'index.html', '<h1>v1</h1>'); put(site, 'js/a.js', 'a1'); put(site, 'js/b.js', 'b');
  stamp(site, '2026-11-12T10:00:00Z');
  put(gh, 'index.html', '<h1>v1</h1>'); put(gh, 'js/a.js', 'a2'); put(gh, 'js/b.js', 'b'); put(gh, 'js/c.js', 'c');
  const v2 = stamp(gh, '2026-11-12T11:00:00Z');
  hits.length = 0;
  ok(await look() === 'updated', 'a newer GitHub version is taken');
  const here = JSON.parse(fs.readFileSync(path.join(site, 'update.json')));
  ok(here.build === v2.build && fs.readFileSync(path.join(site, 'js/a.js'), 'utf8') === 'a2' && fs.existsSync(path.join(site, 'js/c.js')), 'www now holds it');
  const files = hits.filter(h => h !== '/update.json').sort();
  ok(JSON.stringify(files) === '["/js/a.js","/js/c.js"]', 'only the changed and new files were downloaded', files.join(' '));
  ok(!fs.existsSync(site + '.next'), 'no work folder left behind');
  ok(await look() === 'current', 'the next look finds nothing to do');
  /* a file the new version dropped goes; www/ stays the same folder (Caddy's mount) */
  const ino = fs.statSync(site).ino;
  fs.rmSync(path.join(gh, 'js/b.js')); stamp(gh, '2026-11-12T11:10:00Z');
  ok(await look() === 'updated' && !fs.existsSync(path.join(site, 'js/b.js')) && fs.statSync(site).ino === ino, 'a file the new version no longer has is removed, in the same www folder');

  /* the laptop publishes v3 straight to nastime; GitHub still has v2, then an older-dated build */
  put(site, 'js/a.js', 'a3'); stamp(site, '2026-11-12T12:00:00Z');
  ok(await look() === 'current' && fs.readFileSync(path.join(site, 'js/a.js'), 'utf8') === 'a3', 'what the laptop published is never replaced by an older GitHub version');
  put(gh, 'js/b.js', 'b-old'); stamp(gh, '2026-11-12T11:30:00Z');  /* GitHub: newer than v2, older than the laptop's v3 */
  ok(await look() === 'current', 'even when GitHub has a different build, if it is older');

  /* GitHub catches up with something newer, but a file is damaged in transit */
  put(gh, 'js/a.js', 'a4'); const v4 = stamp(gh, '2026-11-12T13:00:00Z');
  corrupt = '/js/a.js';
  ok(await look() === 'failed', 'a file that doesn\'t match its fingerprint stops the update');
  ok(fs.readFileSync(path.join(site, 'js/a.js'), 'utf8') === 'a3' && !fs.existsSync(site + '.next'), 'and www is left exactly as it was');
  corrupt = null;
  ok(await look() === 'updated' && JSON.parse(fs.readFileSync(path.join(site, 'update.json'))).build === v4.build, 'the next look takes it once it comes through whole');

  srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nnas mirror  (${pass} ok, ${fail} failed)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
