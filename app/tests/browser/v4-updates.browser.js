/* Browser test: the page's half of updating from GitHub or nastime.

   - the nastime address is worked out from Sync (Sync Hub :8787 → app :8795),
     or set by hand, or turned off;
   - Updater.newest() reads both places and takes the newest, never an older one;
   - on the laptop the address is passed to the desktop shell (CS3Update.setSources);
   - Settings → App updates shows both places and the address;
   - a downloaded update offers "Restart now".

     node app/tests/browser/v4-updates.browser.js [out folder] */
const path = require('path'), fs = require('fs'), http = require('http');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);

const man = (build, made) => JSON.stringify({ format:'cs3-web', build, native:1, made, files:[] });
const state = { gh: man('aaaaaaa11111', '2026-11-12T10:00:00Z'), nas: man('bbbbbbb22222', '2026-11-12T12:00:00Z') };
const serve = k => http.createServer((q, r) => { r.setHeader('Access-Control-Allow-Origin', '*'); r.end(state[k]); });
const gh = serve('gh').listen(18941), nas = serve('nas').listen(18942);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(() => {
    window.CS_UPDATE_REMOTE = 'http://127.0.0.1:18941/';
    window.__src = []; window.__restart = 0;
    window.CS3Update = { ok(){}, check: async () => ({ state:'current' }), info: async () => ({ available:true, build:'ccccccc33333', made:'2026-11-12T11:00:00Z', status:{} }),
      onReady(f){ window.__ready = f; }, setSources: async l => { window.__src.push(l); return l; }, restart(){ window.__restart++; } };
  });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.waitForFunction(() => window.App && window.Updater && window.Sync, null, { timeout: 15000 });
  await p.waitForTimeout(3600);

  head('where updates come from');
  await p.evaluate(() => { Sync.status = async () => ({ server:'http://127.0.0.1:8787' }); });
  ok(await p.evaluate(() => Updater.nasAddress()) === 'http://127.0.0.1:8795/', 'Sync Hub on :8787 → nastime\'s app on :8795');
  await p.evaluate(() => { Sync.status = async () => ({ server:'http://192.168.4.23:8795' }); });
  ok(await p.evaluate(() => Updater.nasAddress()) === 'http://192.168.4.23:8795/', 'a sync address that is the app\'s own is used as is');
  await p.evaluate(() => Updater.setNasAddress('http://127.0.0.1:18942'));
  ok(await p.evaluate(() => Updater.nasAddress()) === 'http://127.0.0.1:18942/', 'an address typed in Settings wins');
  ok(JSON.stringify(await p.evaluate(() => window.__src[window.__src.length - 1])) === '["http://127.0.0.1:18942/"]', 'and is handed to the desktop app');
  const srcs = await p.evaluate(async () => (await Updater.sources()).map(s => s.name + ' ' + s.base));
  ok(srcs.length === 2 && /GitHub http:\/\/127.0.0.1:18941/.test(srcs[0]) && /nastime/.test(srcs[1]), 'two places to look', srcs.join(' | '));

  head('the newest wins');
  const cur = { build:'ccccccc33333', made:'2026-11-12T11:00:00Z' };
  let n = await p.evaluate(c => Updater.newest(c, [], 1).then(r => ({ take: r.take && r.take.name, best: r.best && r.best.name })), cur);
  ok(n.take === 'nastime', 'nastime newer than what runs → take nastime', JSON.stringify(n));
  state.gh = man('ddddddd44444', '2026-11-12T13:00:00Z');
  n = await p.evaluate(c => Updater.newest(c, [], 1).then(r => r.take && r.take.name), cur);
  ok(n === 'GitHub', 'GitHub newer still → take GitHub');
  n = await p.evaluate(() => Updater.newest({ build:'x', made:'2026-11-12T14:00:00Z' }, [], 1).then(r => r.take));
  ok(n === null, 'nothing older than what runs is ever taken');
  n = await p.evaluate(c => Updater.newest(c, ['ddddddd44444'], 1).then(r => r.take && r.take.name), cur);
  ok(n === 'nastime', 'a build that failed before is passed over');
  state.gh = man('eeeeeee55555', '2026-11-12T15:00:00Z').replace('"native":1', '"native":2');
  n = await p.evaluate(c => Updater.newest(c, [], 1).then(r => r.needsShell), cur);
  ok(n === true, 'one that needs a new app build is flagged, not loaded');
  await p.evaluate(() => Updater.setNasAddress('off'));
  ok(await p.evaluate(async () => (await Updater.sources()).length) === 1, '"don\'t use nastime" leaves GitHub alone');
  await p.evaluate(() => Updater.setNasAddress('http://127.0.0.1:18942'));

  head('Settings → App updates');
  state.gh = man('aaaaaaa11111', '2026-11-12T10:00:00Z');
  await p.evaluate(() => Screens.push('settings', {})); await p.waitForTimeout(700);
  await p.click('[data-go="appupdate"]'); await p.waitForTimeout(900);
  const sheet = await p.textContent('#sheet');
  ok(/GitHub · aaaaaaa/.test(sheet) && /nastime · bbbbbbb/.test(sheet), 'it shows what each place has', sheet.replace(/\s+/g, ' ').slice(0, 220));
  ok(await p.inputValue('#upNas') === 'http://127.0.0.1:18942', 'and this device\'s nastime address');
  await p.screenshot({ path: path.join(out, 'settings-updates.png') });
  await p.fill('#upNas', 'nastime:8795'); await p.click('[data-upclose]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => Updater.nasAddress()) === 'http://127.0.0.1:18942/', 'an address without http:// is refused');
  await p.fill('#upNas', 'http://192.168.4.23:8795'); await p.click('[data-upclose]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => Updater.nasAddress()) === 'http://192.168.4.23:8795/', 'a good one is kept');

  head('Restart now');
  await p.evaluate(() => window.__ready && window.__ready('fffffff'));
  await p.waitForTimeout(300);
  ok(await p.isVisible('.upd-bar'), 'a downloaded update shows the bar');
  await p.screenshot({ path: path.join(out, 'update-bar.png') });
  await p.click('.upd-bar .upd-go'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.__restart) === 1, 'Restart now restarts the app');

  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); gh.close(); nas.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
