/* Browser test: the phone keeps its own GIFs (phonelib.js).

   - Laptop (Electron bridge stood in, frames in its app storage): Deck →
     "⇩ For the phone" makes a .cs4lib file of what's shown.
   - Phone (Capacitor stood in): Content has Library and Starred; Library →
     On this phone → Import a file adds them, under the same library and
     video; a template from the laptop finds them by their path.
   - Keep from nastime (real Caddy + nas/helper.js over a stand-in Shot
     Library): tick a video, it downloads; it still shows with nastime off;
     a new GIF on nastime arrives on "Update now"; "Stop keeping" removes.

     node app/tests/browser/v4-phonelib.browser.js [out folder] */
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const ROOT = path.resolve(__dirname, '../../..');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const CADDY = process.env.CADDY || ['/tmp/caddybin/caddy', '/usr/bin/caddy', '/usr/local/bin/caddy'].find(p => fs.existsSync(p)) || 'caddy';
const FX = f => fs.readFileSync(path.join(__dirname, '..', 'fixtures', f)).toString('base64');
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'phonelib-'));
  const lib = path.join(T, 'shot-library'), fx = f => path.join(ROOT, 'app/tests/fixtures', f);
  const put = (rel, src) => { fs.mkdirSync(path.dirname(path.join(lib, rel)), { recursive: true }); fs.copyFileSync(fx(src), path.join(lib, rel)); };
  put('Life of Riza camera/Morning routine/gifs/riza-01.gif', 'opener.gif');
  put('Life of Riza camera/Morning routine/gifs/riza-02.gif', 'disk.gif');
  put('Life of Riza camera/Desk setup/gifs/desk-01.gif', 'opener.gif');
  put('Trippin/Lisbon/stills/tram.png', 'still.png');
  cp.execFileSync('node', [path.join(ROOT, 'scripts/copy-web.js')], { stdio: 'ignore' });
  const cf = fs.readFileSync(path.join(ROOT, 'nas/Caddyfile'), 'utf8')
    .replace(':80 {', ':18991 {').replace('root * /srv', `root * ${path.join(ROOT, 'www')}`).replace('root * /shotlib', `root * ${lib}`);
  fs.writeFileSync(path.join(T, 'Caddyfile'), cf);
  const helper = cp.spawn(process.execPath, [path.join(ROOT, 'nas/helper.js')], { env: { ...process.env, LIB: lib, PORT: '18992', SITE: path.join(T, 'nowww'), SOURCE: 'http://127.0.0.1:9/' }, stdio: 'ignore' });
  let caddy = cp.spawn(CADDY, ['run', '--config', path.join(T, 'Caddyfile'), '--adapter', 'caddyfile'], { env: { ...process.env, HELPER: '127.0.0.1:18992', SYNC_HUB: '127.0.0.1:9' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1800));

  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  try {
    head('laptop: a file for the phone');
    const lctx = await b.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
    await lctx.addInitScript(() => { window.CS3Lib = { home: async () => ({ path:'/x', exists:true }), scan: async () => ({ items: [], pages: [], roots: [], errors: [] }),
      pickFolder: async () => null, open: async () => {}, trash: async () => 0, boardFolder: async () => ({}), shotline: async () => null,
      grabFind: async () => null, grabRun: async () => ({}), grabStop: async () => {}, grabStatus: async () => ({ running:false, lines:[], links:[] }), onGrab: () => () => {} }; });
    const L = await lctx.newPage(); L.on('pageerror', e => errs.push('laptop: ' + e.message));
    await L.goto(url); await L.waitForFunction(() => window.App && window.MediaLib && window.PhoneLib, null, { timeout: 15000 });
    const luids = await L.evaluate(async ({ g, s }) => { const b64 = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
      const a = await MediaLib.addFiles([new File([b64(g)], 'kettle.gif', { type:'image/gif' }), new File([b64(s)], 'mug.png', { type:'image/png' })], 'Everyday', 'Coffee');
      await MediaLib.addFiles([new File([b64(g)], 'walk.gif', { type:'image/gif' })], 'Everyday', 'Walks');
      await ShotTemplates.save({ id:'tpl_c', name:'Coffee', kind:'Vlog day', shots:[ShotTemplates.shot({ item:a.added[0], label:'Kettle' })], tasks:[] });
      return a.added; }, { g: FX('opener.gif'), s: FX('still.png') });
    await L.evaluate(() => App.go('series')); await L.waitForTimeout(300);
    await L.click('.ctnav [data-v="library"]'); await L.waitForTimeout(900);
    await L.click('.lv-pstrip .lv-pcard:has(b:text-is("Coffee"))'); await L.waitForTimeout(700);
    const [dl] = await Promise.all([L.waitForEvent('download'), L.click('[data-forphone]')]);
    const file = path.join(T, dl.suggestedFilename()); await dl.saveAs(file);
    ok(/Coffee\.cs4lib$/.test(file) && fs.statSync(file).size > 2000, '"⇩ For the phone" saves a .cs4lib of the video shown', path.basename(file) + ' ' + fs.statSync(file).size);
    const zl = cp.execSync(`unzip -l "${file}"`).toString();
    ok(/files\/Everyday\/Coffee\/kettle\.gif/.test(zl) && /cs4lib\.json/.test(zl) && !/walk\.gif/.test(zl), 'an ordinary zip: the files at library/video/name and a list (just that video)');
    const tpl = await L.evaluate(() => Store.get('shot-templates', 'tpl_c'));

    head('phone: Library, and Import a file');
    const pctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    await pctx.addInitScript(() => {
      const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for(let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {
        CapacitorHttp: { request: async o => { const r = await fetch(o.url); return { status:r.status, data: o.responseType === 'json' ? await r.json() : b64(await r.arrayBuffer()), headers:{} }; } } } };
      localStorage.setItem('cs4-update-nas', 'http://127.0.0.1:18991/');
    });
    const P = await pctx.newPage(); P.on('pageerror', e => errs.push('phone: ' + e.message));
    await P.goto(url); await P.waitForFunction(() => window.App && window.MediaLib && window.PhoneLib, null, { timeout: 15000 });
    await P.waitForTimeout(800);
    ok(await P.evaluate(() => MediaLib.phone() && MediaLib.hasLibrary()), 'the phone has a Library of its own');
    await P.evaluate(() => App.go('series')); await P.waitForTimeout(500);
    const nav = await P.$$eval('.ctnav [data-v]', x => x.map(e => e.dataset.v));
    ok(nav.includes('library') && nav.includes('starred') && !nav.includes('templates'), 'Content shows Library and Starred (no Templates)', nav.join(' '));
    await P.tap('.ctnav [data-v="library"]'); await P.waitForTimeout(800);
    await P.tap('.lv-tabs [data-tab="folders"]'); await P.waitForTimeout(700);
    ok(/On this phone/.test(await P.textContent('.lv-tabs')), 'its Folders tab is "On this phone"');
    await P.setInputFiles('[data-importfile]', file); await P.waitForTimeout(1500);
    let got = await P.evaluate(async () => (await Store.all('lib-items')).values.map(r => [r.library, r.page, r.name, r.path]));
    ok(got.length === 2 && got.every(r => r[0] === 'Everyday' && r[1] === 'Coffee' && r[3].startsWith('Everyday/Coffee/')), 'Import adds them under the same library and video', JSON.stringify(got));
    await P.evaluate(t => Store.put('shot-templates', t), tpl);
    const found = await P.evaluate(async u => { const l = await MediaLib.load(true); const it = MediaLib.find(l, u); return it && it.src; }, luids[0]);
    ok(found === 'db', 'a template made on the laptop finds the phone\'s copy');
    await P.setInputFiles('[data-importfile]', file); await P.waitForTimeout(1200);
    ok((await P.evaluate(async () => (await Store.all('lib-items')).values.length)) === 2, 'importing the same file again adds nothing twice');

    head('phone: keep from nastime');
    await P.tap('.lv-tabs [data-tab="folders"]'); await P.waitForTimeout(600);
    await P.tap('[data-showcat]'); await P.waitForTimeout(1200);
    const libsSeen = await P.$$eval('[data-klib]', x => x.map(e => e.dataset.klib));
    ok(libsSeen.includes('Life of Riza camera') && libsSeen.includes('Trippin'), 'it lists nastime\'s libraries', libsSeen.join(' | '));
    await P.evaluate(() => { document.querySelector('[data-kdir="Life of Riza camera/Morning routine"]').closest('details').open = true; });
    await P.check('[data-kdir="Life of Riza camera/Morning routine"]');
    await P.tap('[data-keepsave]'); await P.waitForTimeout(2500);
    got = await P.evaluate(async () => (await Store.all('lib-items')).values.filter(r => r.library === 'Life of Riza camera').map(r => r.path).sort());
    ok(JSON.stringify(got) === JSON.stringify(['Life of Riza camera/Morning routine/gifs/riza-01.gif', 'Life of Riza camera/Morning routine/gifs/riza-02.gif']), 'ticking a video downloads just its GIFs', JSON.stringify(got));
    await P.screenshot({ path: path.join(out, 'phone-onphone.png'), fullPage: true });

    caddy.kill(); await new Promise(r => setTimeout(r, 500));
    await P.tap('.lv-tabs [data-tab="deck"]'); await P.waitForTimeout(900);
    const imgs = await P.$$eval('.lv-deck .lv-tile img', x => x.filter(i => i.complete && i.naturalWidth > 0).length);
    ok((await P.$$('.lv-deck .lv-tile')).length === 4 && imgs >= 3, 'with nastime off, the Deck still shows them all', String(imgs));
    await P.screenshot({ path: path.join(out, 'phone-deck.png') });

    caddy = cp.spawn(CADDY, ['run', '--config', path.join(T, 'Caddyfile'), '--adapter', 'caddyfile'], { env: { ...process.env, HELPER: '127.0.0.1:18992', SYNC_HUB: '127.0.0.1:9' }, stdio: 'ignore' });
    put('Life of Riza camera/Morning routine/gifs/riza-03.gif', 'opener.gif');
    await new Promise(r => setTimeout(r, 22000));        /* the helper re-reads its list after 20 s */
    const r = await P.evaluate(() => PhoneLib.update({ quiet:true }));
    ok(r.got === 1, 'a new GIF on nastime arrives on the next update', JSON.stringify(r));
    await P.tap('.lv-tabs [data-tab="folders"]'); await P.waitForTimeout(600);
    P.once('dialog', d => d.accept());
    await P.tap('[data-unkeep-dir="Life of Riza camera/Morning routine"]'); await P.waitForTimeout(1200);
    ok((await P.evaluate(async () => (await Store.all('lib-items')).values.filter(r => r.library === 'Life of Riza camera').length)) === 0
      && (await P.evaluate(() => PhoneLib.keepList())).pages.length === 0, 'Stop keeping takes them off the phone');
  } catch(e){ ok(false, 'ran to the end', e.message); }
  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close(); caddy.kill(); helper.kill(); fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
