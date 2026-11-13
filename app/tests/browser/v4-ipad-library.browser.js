/* Browser test: the iPad plans with the Shot Library on nastime.

   A real Caddy with nas/Caddyfile (paths pointed at temp folders), nas/helper.js
   listing a stand-in Shot Library, and the built web app — opened like the
   iPad opens it (a browser at nastime's address, touch, iPad size).
   Checks: Content shows Library and Templates; the Deck lists the folder's
   GIFs and they load from nastime; the one-video picker; a template shot gets
   a frame from the picker; starring works; a task using a frame gets its copy
   for the phone; the phone app (Capacitor) never reads nastime's Library.

     node app/tests/browser/v4-ipad-library.browser.js [out folder]
   Needs caddy on PATH or CADDY=/path/to/caddy. */
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const ROOT = path.resolve(__dirname, '../../..');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
const CADDY = process.env.CADDY || ['/tmp/caddybin/caddy', '/usr/bin/caddy', '/usr/local/bin/caddy'].find(p => fs.existsSync(p)) || 'caddy';
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'ipadlib-'));
  /* the stand-in Shot Library */
  const lib = path.join(T, 'shot-library'), fx = f => path.join(ROOT, 'app/tests/fixtures', f);
  const put = (rel, src) => { fs.mkdirSync(path.dirname(path.join(lib, rel)), { recursive: true }); fs.copyFileSync(fx(src), path.join(lib, rel)); };
  put('Life of Riza camera/Morning routine/gifs/riza-01.gif', 'opener.gif');
  put('Life of Riza camera/Morning routine/gifs/riza-02.gif', 'disk.gif');
  put('Life of Riza camera/Desk setup/gifs/desk-01.gif', 'opener.gif');
  put('Trippin/Lisbon/stills/tram.png', 'still.png');
  put('_Deleted/old.gif', 'opener.gif');
  /* the built app, the Caddyfile pointed at these folders */
  cp.execFileSync('node', [path.join(ROOT, 'scripts/copy-web.js')], { stdio: 'ignore' });
  const cf = fs.readFileSync(path.join(ROOT, 'nas/Caddyfile'), 'utf8')
    .replace(':80 {', ':18961 {').replace('root * /srv', `root * ${path.join(ROOT, 'www')}`).replace('root * /shotlib', `root * ${lib}`);
  fs.writeFileSync(path.join(T, 'Caddyfile'), cf);
  const helper = cp.spawn(process.execPath, [path.join(ROOT, 'nas/helper.js')], { env: { ...process.env, LIB: lib, PORT: '18962', SITE: path.join(T, 'nowww'), SOURCE: 'http://127.0.0.1:9/' }, stdio: 'ignore' });
  const caddy = cp.spawn(CADDY, ['run', '--config', path.join(T, 'Caddyfile'), '--adapter', 'caddyfile'], { env: { ...process.env, HELPER: '127.0.0.1:18962', SYNC_HUB: '127.0.0.1:9' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1800));
  const base = 'http://127.0.0.1:18961/';

  const b = await pw.chromium.launch({ executablePath: exe, headless: true });
  const errs = [];
  try {
    head('nastime serves the Library');
    const idx = await (await fetch(base + 'shotlib-index.json')).json();
    ok(idx.format === 'cs4-shotlib' && idx.items.length === 4, 'the helper lists the folder (not _Deleted)', idx.items.map(i => i.path).join(' | '));
    ok(idx.items.every(i => !('root' in i) && i.url.startsWith('/shotlib/')), 'with nastime addresses, and no server paths');
    const g = await fetch(base + idx.items.find(i => /riza-01/.test(i.path)).url);
    ok(g.ok && (await g.arrayBuffer()).byteLength === fs.statSync(fx('opener.gif')).size, 'Caddy serves the file itself');

    const ipad = await b.newContext({ viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
    const p = await ipad.newPage(); p.on('pageerror', e => errs.push('ipad: ' + e.stack.split('\n').slice(0,3).join(' ')));
    await p.goto(base); await p.waitForFunction(() => window.App && window.MediaLib, null, { timeout: 15000 });
    await p.waitForFunction(() => window.MediaLib && MediaLib.hasLibrary(), null, { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(800);

    head('the iPad plans with it');
    ok(await p.evaluate(() => MediaLib.hasLibrary() && MediaLib.remote() && !MediaLib.disk()), 'the iPad finds nastime\'s Library (read only, no laptop disk)');
    await p.evaluate(() => App.go('series')); await p.waitForTimeout(600);
    const nav = await p.$$eval('.ctnav [data-v]', x => x.map(e => e.dataset.v));
    ok(nav.includes('library') && nav.includes('templates'), 'Content shows Library and Templates', nav.join(' '));
    await p.tap('.ctnav [data-v="library"]'); await p.waitForTimeout(1200);
    const tiles = await p.$$eval('.lv-deck .lv-tile', x => x.length);
    ok(tiles === 4, 'the Deck shows the Shot Library', String(tiles));
    const loaded = await p.$$eval('.lv-deck .lv-tile img', x => x.filter(i => i.complete && i.naturalWidth > 0 && i.src.includes('/shotlib/')).length);
    ok(loaded >= 1, 'GIFs load from nastime', String(loaded));
    const opts = await p.$$eval('.lv-pstrip .lv-pcard b', x => x.map(o => o.textContent.trim()));
    ok(opts.includes('Morning Routine') && opts.includes('Desk Setup'), 'the row of videos works here too', JSON.stringify(opts));
    await p.tap('.lv-pstrip .lv-pcard:has(b:text-is("Morning Routine"))'); await p.waitForTimeout(700);
    ok((await p.$$eval('.lv-deck .lv-tile', x => x.length)) === 2, 'just Riza\'s morning routine');
    await p.screenshot({ path: path.join(out, 'ipad-library.png') });
    await p.tap('.lv-tabs [data-tab="folders"]'); await p.waitForTimeout(700);
    ok(/Shot Library on nastime/.test(await p.textContent('#libBody')) && !(await p.$('[data-addroot]')), 'Folders says where it reads from (no laptop folder tools)');

    head('templates and stars on the iPad');
    const tid = await p.evaluate(async () => (await ShotTemplates.save({ name:'Morning routine', kind:'Vlog day', shots:[ShotTemplates.shot({ label:'Kettle on', role:'Action' })], tasks:[] })).id);
    await p.evaluate(id => Screens.push('shot-templates', { id }), tid); await p.waitForTimeout(800);
    if(await p.$('.tp-tabs [data-tab="shots"][aria-selected="false"]')){ await p.tap('.tp-tabs [data-tab="shots"]'); await p.waitForTimeout(500); }
    await p.tap('.tp-frame[data-frame="0"]'); await p.waitForTimeout(900);
    ok(!!(await p.$('.lv-picker')) && (await p.$$eval('.lv-pgrid .lv-tile', x => x.length)) >= 2, 'tapping an empty shot opens the picker with the Library');
    await p.tap('.lv-pgrid .lv-tile'); await p.waitForTimeout(800);
    const item = await p.evaluate(async id => (await ShotTemplates.all()).find(x => x.id === id).shots[0].item, tid);
    ok(/^h:nastime\|Life of Riza camera\//.test(item), 'the shot has the frame', item);
    ok(!!(await p.$('[data-fclear="0"]')), 'and ↻ / ✕ show (no hover on a touch screen)');
    await p.screenshot({ path: path.join(out, 'ipad-template.png') });
    const starred = await p.evaluate(async u => { const g = await MediaLib.saveStar({ name:'Morning', items:[] }); await MediaLib.starInto(g.id, [u]); return (await MediaLib.allStars()).find(x => x.id === g.id).items; }, item);
    ok(starred.length === 1, 'a frame can be starred from the iPad (stars sync to the phone)');

    head('the phone gets the frames a task uses');
    await p.evaluate(async u => { await Store.put('tasks', { id:'t_ipad', title:'Shoot morning', kind:'shoot', day: await Data.currentDay(), page:{ kind:'sequence', slots:[{ item:u, text:'', done:false }] } }); }, item);
    const kept = await p.evaluate(async u => { await TaskFrames.keep(); const r = await Store.get('task-frames', u); return r ? r.bytes : 0; }, item);
    ok(kept > 0, 'the iPad copies a task\'s frame for the phone, like the laptop does', String(kept));

    head('the phone app never reads it');
    const phone = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    await phone.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {} }; });
    const ph = await phone.newPage();
    await ph.goto(base); await ph.waitForFunction(() => window.App && window.MediaLib, null, { timeout: 15000 }); await ph.waitForTimeout(2000);
    ok(!(await ph.evaluate(() => MediaLib.hasLibrary())), 'Capacitor (the phone app): no Library');
  } catch(e){ ok(false, 'ran to the end', e.message); }
  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close(); caddy.kill(); helper.kill(); fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
