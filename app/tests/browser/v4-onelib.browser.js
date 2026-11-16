/* Browser test: one Library on every device (medialib.js, phonelib.js, nasaddr.js).

   A real nastime stands in: Caddy (nas/Caddyfile, on :8795) + nas/helper.js
   over a small Shot Library.

   - Phone (Capacitor stood in): Content has Library and Templates; the Deck
     shows nastime's frames; Folders lists nastime's folders with "Keep";
     Keep downloads a folder; a kept frame shows once; nastime off → the kept
     ones still show; a new GIF → "has 1 new GIF · Download · Not now";
     Keep off takes them off.
   - iPad (the app opened from nastime): the same Folders screen; keeping one
     video works.
   - Laptop (Electron bridge stood in): Library and Templates, its own
     folders screen, no "For the phone".
   - nastime's address: one setting, found by its host.

     node app/tests/browser/v4-onelib.browser.js [out folder] */
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
    .replace(':80 {', ':8795 {').replace('root * /srv', `root * ${path.join(ROOT, 'www')}`).replace('root * /shotlib', `root * ${lib}`);
  fs.writeFileSync(path.join(T, 'Caddyfile'), cf);
  const helper = cp.spawn(process.execPath, [path.join(ROOT, 'nas/helper.js')], { env: { ...process.env, LIB: lib, PORT: '18992', SITE: path.join(T, 'nowww'), SOURCE: 'http://127.0.0.1:9/' }, stdio: 'ignore' });
  let caddy = cp.spawn(CADDY, ['run', '--config', path.join(T, 'Caddyfile'), '--adapter', 'caddyfile'], { env: { ...process.env, HELPER: '127.0.0.1:18992', SYNC_HUB: '127.0.0.1:9' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1800));

  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const NAS = 'http://127.0.0.1:8795/';
  const errs = [];
  const libCount = async (P, lib) => P.evaluate(async l => (await Store.all('lib-items')).values.filter(r => r.library === l).length, lib);
  const restart = async () => {
    caddy = cp.spawn(CADDY, ['run', '--config', path.join(T, 'Caddyfile'), '--adapter', 'caddyfile'], { env: { ...process.env, HELPER: '127.0.0.1:18992', SYNC_HUB: '127.0.0.1:9' }, stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 1500));
  };
  try {
    head('phone');
    const pctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    await pctx.addInitScript(nas => {
      const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for(let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {
        CapacitorHttp: { request: async o => { const r = await fetch(o.url); return { status:r.status, data: o.responseType === 'json' ? await r.json() : b64(await r.arrayBuffer()), headers:{} }; } } } };
      localStorage.setItem('cs4-update-nas', nas);
    }, NAS);
    const P = await pctx.newPage(); P.on('pageerror', e => errs.push('phone: ' + e.message));
    await P.goto(url); await P.waitForFunction(() => window.App && window.MediaLib && window.PhoneLib && window.NasAddr, null, { timeout: 15000 });
    await P.waitForFunction(() => MediaLib.remote(), null, { timeout: 8000 }).catch(() => {});
    ok(await P.evaluate(() => MediaLib.phone() && MediaLib.keeps() && MediaLib.remote()), 'the phone reads nastime’s Shot Library');
    await P.waitForTimeout(1500);
    await P.evaluate(() => App.go('series')); await P.waitForSelector('.ctnav [data-v]', { timeout: 10000 }).catch(() => {}); await P.waitForTimeout(500);
    let nav = await P.$$eval('.ctnav [data-v]', x => x.map(e => e.dataset.v));
    ok(nav.includes('library') && nav.includes('templates') && !nav.includes('starred'), 'Content shows Library and Templates, like every device', nav.join(' '));
    await P.tap('.ctnav [data-v="library"]'); await P.waitForTimeout(1000);
    ok((await P.$$('.lv-deck .lv-tile')).length === 4, 'the Deck shows nastime’s frames before anything is kept', String((await P.$$('.lv-deck .lv-tile')).length));
    ok(!(await P.$('[data-forphone]')), 'no “For the phone” file');
    await P.tap('.lv-tabs [data-tab="folders"]'); await P.waitForTimeout(1200);
    ok((await P.textContent('.lv-tabs')).includes('Folders') && /nastime is connected/.test(await P.textContent('[data-nasline]')), 'Folders: “nastime is connected”');
    const libsSeen = await P.$$eval('[data-klib]', x => x.map(e => e.dataset.klib));
    ok(libsSeen.includes('Life of Riza camera') && libsSeen.includes('Trippin'), 'each nastime folder has a Keep switch', libsSeen.join(' | '));
    await P.screenshot({ path: path.join(out, 'onelib-phone-folders.png'), fullPage: true });
    await P.click('.lv-switch:has([data-klib="Life of Riza camera"])'); await P.waitForTimeout(2500);
    ok((await libCount(P, 'Life of Riza camera')) === 3, 'Keep downloads the whole folder to the phone', String(await libCount(P, 'Life of Riza camera')));
    ok(/✓ on this phone/.test(await P.textContent('[data-libcard="Life of Riza camera"]')), 'its row says ✓ on this phone');
    await P.screenshot({ path: path.join(out, 'onelib-phone-kept.png'), fullPage: true });
    await P.tap('.lv-tabs [data-tab="deck"]'); await P.waitForTimeout(900);
    ok((await P.$$('.lv-deck .lv-tile')).length === 4, 'a kept frame shows once, not twice', String((await P.$$('.lv-deck .lv-tile')).length));
    const kept = await P.evaluate(async () => { const l = await MediaLib.load(true); const it = l.items.find(x => x.path === 'Life of Riza camera/Morning routine/gifs/riza-01.gif'); return it && it.kept && (await MediaLib.url(it)).startsWith('blob:'); });
    ok(kept, 'and plays from the copy on the phone');

    caddy.kill(); await new Promise(r => setTimeout(r, 600));
    await P.evaluate(() => MediaLib.probeRemote()); await P.evaluate(() => App.go('series')); await P.waitForTimeout(300);
    await P.tap('.ctnav [data-v="library"]'); await P.waitForTimeout(900);
    const imgs = await P.$$eval('.lv-deck .lv-tile img', x => x.filter(i => i.complete && i.naturalWidth > 0).length);
    ok((await P.$$('.lv-deck .lv-tile')).length === 3 && imgs >= 2, 'nastime off: the Deck shows the kept folder', String(imgs));
    await P.tap('.lv-tabs [data-tab="folders"]'); await P.waitForTimeout(900);
    ok(/can’t be reached/.test(await P.textContent('[data-nasline]')) && (await P.$$('[data-klib]')).length === 1, 'Folders: “can’t be reached”, with what the phone keeps');
    await P.screenshot({ path: path.join(out, 'onelib-phone-offline.png'), fullPage: true });

    await restart();
    put('Life of Riza camera/Morning routine/gifs/riza-03.gif', 'opener.gif');
    await new Promise(r => setTimeout(r, 22000));        /* the helper re-reads its list after 20 s */
    await P.evaluate(() => MediaLib.probeRemote());
    await P.evaluate(() => PhoneLib.round());
    await P.waitForSelector('#keepPrompt', { timeout: 5000 }).catch(() => {});
    const pt = await P.$eval('#keepPrompt', e => e.textContent).catch(() => '');
    ok(/Life of Riza camera has 1 new GIF/.test(pt), 'a new GIF on nastime: the phone asks', pt.trim());
    await P.screenshot({ path: path.join(out, 'onelib-phone-prompt.png') });
    await P.click('[data-kp="later"]'); await P.waitForTimeout(300);
    await P.evaluate(() => PhoneLib.round()); await P.waitForTimeout(300);
    ok(!(await P.$('#keepPrompt')) && (await libCount(P, 'Life of Riza camera')) === 3, '“Not now” — it doesn’t ask again for the same ones');
    await P.evaluate(() => App.go('series')); await P.waitForTimeout(300);
    await P.tap('.ctnav [data-v="library"]'); await P.waitForTimeout(600);
    await P.tap('.lv-tabs [data-tab="folders"]'); await P.waitForTimeout(1500);
    ok(/1 new GIF/.test(await P.textContent('[data-newline]')), 'Folders still shows “1 new GIF · Download”');
    await P.tap('[data-getnew]'); await P.waitForTimeout(2000);
    ok((await libCount(P, 'Life of Riza camera')) === 4, 'Download brings it in', String(await libCount(P, 'Life of Riza camera')));
    P.once('dialog', d => d.accept());
    await P.click('.lv-switch:has([data-klib="Life of Riza camera"])'); await P.waitForTimeout(1200);
    ok((await libCount(P, 'Life of Riza camera')) === 0 && (await P.evaluate(() => PhoneLib.keepList())).libs.length === 0, 'Keep off takes the folder off the phone');

    head('phone: keep everything, in step with nastime');
    P.on('dialog', d => d.accept().catch(() => {}));
    await P.click('.lv-switch:has([data-kall])'); await P.waitForTimeout(3000);
    const allN = await P.evaluate(async () => (await Store.all('lib-items')).values.filter(r => r.path).length);
    ok(allN === 5 && (await P.evaluate(() => PhoneLib.keepList())).all && await P.evaluate(() => PhoneLib.auto()), 'Keep all downloads every frame on nastime and turns on new-GIF downloads', String(allN));
    ok((await P.$$('[data-klib]:disabled')).length === 2, 'each folder shows as kept with it');
    await P.screenshot({ path: path.join(out, 'onelib-phone-keepall.png'), fullPage: true });
    fs.unlinkSync(path.join(lib, 'Life of Riza camera/Morning routine/gifs/riza-03.gif'));
    await new Promise(r => setTimeout(r, 22000));
    await P.evaluate(() => PhoneLib.round()); await P.waitForTimeout(800);
    ok((await P.evaluate(async () => (await Store.all('lib-items')).values.filter(r => r.path).map(r => r.path))).every(x => !/riza-03/.test(x)) &&
      (await P.evaluate(async () => (await Store.all('lib-items')).values.filter(r => r.path).length)) === 4, 'a GIF deleted from nastime leaves the phone too');
    put('Life of Riza camera/Morning routine/gifs/riza-03.gif', 'opener.gif');
    await new Promise(r => setTimeout(r, 22000));
    await P.evaluate(() => PhoneLib.round()); await P.waitForTimeout(1500);
    ok((await P.evaluate(async () => (await Store.all('lib-items')).values.filter(r => r.path).length)) === 5, 'and one added comes down by itself');
    await P.tap('.lv-tabs [data-tab="deck"]'); await P.waitForTimeout(300); await P.tap('.lv-tabs [data-tab="folders"]'); await P.waitForTimeout(1500);
    await P.click('.lv-switch:has([data-kall])'); await P.waitForTimeout(1200);
    ok((await P.evaluate(async () => (await Store.all('lib-items')).values.filter(r => r.path).length)) === 0, 'Keep all off takes them off the phone');

    head('iPad (opened from nastime)');
    const ictx = await b.newContext({ viewport: { width: 1024, height: 1366 }, hasTouch: true,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15' });
    await ictx.addInitScript(() => { Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 }); });
    const I = await ictx.newPage(); I.on('pageerror', e => errs.push('ipad: ' + e.message));
    await I.goto(NAS); await I.waitForTimeout(5000);   /* the service worker settles in (a reload or two) */
    await I.waitForFunction(() => window.App && window.MediaLib && window.PhoneLib, null, { timeout: 15000 });
    await I.waitForFunction(() => MediaLib.remote(), null, { timeout: 8000 }).catch(() => {});
    await I.evaluate(() => App.go('series')); await I.waitForTimeout(500);
    nav = await I.$$eval('.ctnav [data-v]', x => x.map(e => e.dataset.v));
    ok(nav.includes('library') && nav.includes('templates'), 'Content shows Library and Templates', nav.join(' '));
    await I.click('.ctnav [data-v="library"]'); await I.waitForTimeout(900);
    ok((await I.$$('.lv-deck .lv-tile')).length === 5, 'the Deck shows nastime’s frames', String((await I.$$('.lv-deck .lv-tile')).length));
    await I.click('.lv-tabs [data-tab="folders"]'); await I.waitForTimeout(1200);
    ok(/Keep on this iPad/.test(await I.textContent('.lv-dev')) && /nastime is connected/.test(await I.textContent('[data-nasline]')), 'the same Folders screen — “Keep on this iPad”');
    await I.evaluate(() => { document.querySelector('[data-libcard="Trippin"]').open = true; });
    await I.check('[data-kdir="Trippin/Lisbon"]'); await I.waitForTimeout(1800);
    ok((await libCount(I, 'Trippin')) === 1, 'keeping a single video works on the iPad');
    await I.screenshot({ path: path.join(out, 'onelib-ipad-folders.png'), fullPage: true });
    ok(await I.evaluate(() => NasAddr.host()) === '127.0.0.1', 'nastime’s address is the page’s own host');

    head('phone whose page can’t load nastime’s pictures');
    const qctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    await qctx.addInitScript(nas => {
      const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for(let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {
        CapacitorHttp: { request: async o => { const r = await fetch(o.url); if(window.__files404 && /\/shotlib\//.test(o.url)) return { status:404, data:'', headers:{} };
          return { status:r.status, data: o.responseType === 'json' ? await r.json() : b64(await r.arrayBuffer()), headers:{} }; } } } };
      localStorage.setItem('cs4-update-nas', nas);
    }, NAS);
    const Q = await qctx.newPage(); Q.on('pageerror', e => errs.push('phone2: ' + e.message));
    /* the WebView refusing plain-http pictures: every <img>/<video> from nastime fails */
    await Q.route(/\/shotlib\//, r => ['image', 'media'].includes(r.request().resourceType()) ? r.abort() : r.continue());
    await Q.goto(url); await Q.waitForFunction(() => window.App && window.MediaLib && MediaLib.remote(), null, { timeout: 15000 }).catch(() => {});
    await Q.evaluate(() => App.go('series')); await Q.waitForSelector('.ctnav [data-v]', { timeout: 10000 }).catch(() => {}); await Q.waitForTimeout(400);
    await Q.tap('.ctnav [data-v="library"]'); await Q.waitForTimeout(3500);
    const shown = await Q.$$eval('.lv-deck .lv-tile img', x => x.filter(i => i.complete && i.naturalWidth > 0 && i.src.startsWith('blob:')).length);
    ok(shown >= 3, 'the pictures come through the app instead (no broken tiles)', String(shown));
    await Q.screenshot({ path: path.join(out, 'onelib-phone-viaapp.png') });
    await Q.tap('.lv-tabs [data-tab="folders"]'); await Q.waitForTimeout(3000);
    ok(!!(await Q.$('[data-viaapp]')) && !(await Q.$('[data-fileswarn]')), 'Folders: connected, files through the app — no warning');
    await Q.evaluate(() => { window.__files404 = true; }); await Q.tap('.lv-tabs [data-tab="deck"]'); await Q.waitForTimeout(500);
    await Q.tap('.lv-tabs [data-tab="folders"]'); await Q.waitForTimeout(3500);
    ok(/won’t send its files \(nastime answered 404\)/.test(await Q.textContent('[data-fileswarn]').catch(() => '')), 'files nastime won’t send: Folders says so, and what to check');
    await Q.screenshot({ path: path.join(out, 'onelib-phone-fileswarn.png'), fullPage: true });

    head('laptop');
    const lctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
    await lctx.addInitScript(nas => { localStorage.setItem('cs4-update-nas', nas); window.CS3Lib = { home: async () => ({ path:'/x', exists:true }), scan: async () => ({ items: [], pages: [], roots: [], errors: [] }),
      fetchJson: async u => { try { const r = await fetch(u); return r.ok ? r.json() : null; } catch(e){ return null; } },
      pickFolder: async () => null, open: async () => {}, trash: async () => 0, boardFolder: async () => ({}), shotline: async () => null,
      grabFind: async () => null, grabRun: async () => ({}), grabStop: async () => {}, grabStatus: async () => ({ running:false, lines:[], links:[] }), onGrab: () => () => {} }; }, NAS);
    const L = await lctx.newPage(); L.on('pageerror', e => errs.push('laptop: ' + e.message));
    await L.goto(url); await L.waitForFunction(() => window.App && window.MediaLib, null, { timeout: 15000 }); await L.waitForTimeout(800);
    await L.evaluate(() => App.go('series')); await L.waitForTimeout(400);
    nav = await L.$$eval('.ctnav [data-v]', x => x.map(e => e.dataset.v));
    ok(nav.includes('library') && nav.includes('templates') && !nav.includes('starred'), 'Library and Templates', nav.join(' '));
    await L.click('.ctnav [data-v="library"]'); await L.waitForTimeout(700);
    ok(!(await L.$('[data-forphone]')), 'no “For the phone” file');
    await L.click('.lv-tabs [data-tab="folders"]'); await L.waitForTimeout(700);
    ok(/Folders on this computer/.test(await L.textContent('#libBody')), 'its Folders tab is the laptop’s folders');
    ok(/nastime is connected/.test(await L.textContent('#libBody')), 'and says nastime is connected (no share mounted)');
    await L.screenshot({ path: path.join(out, 'onelib-desktop-folders.png'), fullPage: true });
    await L.click('.lv-tabs [data-tab="deck"]'); await L.waitForTimeout(800);
    ok((await L.$$('.lv-deck .lv-tile')).length === 5, 'the desktop’s Deck shows nastime’s Shot Library (Linux without the share)', String((await L.$$('.lv-deck .lv-tile')).length));
    await L.click('.lv-tabs [data-tab="folders"]'); await L.waitForTimeout(600);
    await L.uncheck('[data-nasread]'); await L.waitForTimeout(800);
    await L.click('.lv-tabs [data-tab="deck"]'); await L.waitForTimeout(800);
    ok((await L.$$('.lv-deck .lv-tile')).length === 0, 'switching it off shows just the computer’s own folders');
    const gv = await L.evaluate(async () => { await MediaLib.setSettings({ roots:['/run/user/1000/gvfs/smb-share:server=192.168.4.23,share=shot-library'], mirrors:{} });
      localStorage.setItem('cs4-update-nas', 'http://192.168.4.23:8795/'); await NasAddr.set('nastime.local'); return (await MediaLib.settings()).roots[0]; });
    ok(gv === '/run/user/1000/gvfs/smb-share:server=nastime.local,share=shot-library', 'Linux: the share mounted in Files follows nastime’s new address', gv);
    const sw = await L.evaluate(async () => { await MediaLib.setSettings({ roots:['\\\\192.168.4.23\\shot-library'], mirrors:{ '\\\\192.168.4.23\\shot-library':'C:\\Copy' } });
      localStorage.setItem('cs4-update-nas', 'http://192.168.4.23:8795/');
      const r = await NasAddr.set('http://127.0.0.1:8795'); const s = await MediaLib.settings();
      return { r, roots:s.roots, mirrors:s.mirrors, nas: await Updater.nasAddress() }; });
    ok(sw.roots[0] === '\\\\127.0.0.1\\shot-library' && sw.mirrors['\\\\127.0.0.1\\shot-library'] === 'C:\\Copy' && sw.nas === NAS,
      'a new nastime address switches updates and the laptop’s Shot Library share', JSON.stringify(sw));
    ok(await L.evaluate(() => NasAddr.ping('127.0.0.1')) && await L.evaluate(() => NasAddr.find({ noScan:true })) === '127.0.0.1', 'NasAddr finds nastime where it answers');
    ok(await L.evaluate(() => [NasAddr.clean('\\\\192.168.4.23\\x'), NasAddr.clean('http://Nastime.local:8787/sync'), NasAddr.clean('nastime.local')].join()) === '192.168.4.23,nastime.local,nastime.local', 'addresses of every shape come down to the host');
  } catch(e){ ok(false, 'ran to the end', e.message); }
  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close(); caddy.kill(); helper.kill(); fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
