/* Settings → Morning paper (js/morningpaper.js): the phone asks nastime's
   paper (nas/paper) to print, and shows when it prints by itself.

   The phone app is stood in for with a CapacitorHttp that answers like the
   paper on nastime and records what it was asked.

     node app/tests/browser/v4-morningpaper.browser.js [outDir] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true,
    args: ['--allow-file-access-from-files', '--no-sandbox', '--disable-component-update'] });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('cs4.nasHost', '192.168.4.23');
    window.__req = [];
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {
      CapacitorHttp: { request: async (o) => {
        window.__req.push({ url: o.url, method: o.method, readTimeout: o.readTimeout });
        if (/\/paper\/status$/.test(o.url)) return { status: 200, data: { printAt: '04:30', printer: '192.168.4.50/ipp/print',
          history: [{ at: new Date().toISOString(), ok: true, message: 'Sent' }] } };
        if (/\/paper\/print/.test(o.url)) return { status: 200, data: { ok: true, pages: 2, message: 'Sent to 192.168.4.50/ipp/print' } };
        return { status: 404, data: {} };
      } } } };
  });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(url); await p.waitForFunction(() => window.App && window.Screens && window.MorningPaper, null, { timeout: 20000 });
  await p.waitForTimeout(600);

  ok(await p.evaluate(async () => (await MorningPaper.base()) === 'http://192.168.4.23:8795/paper'), 'the paper is on nastime, :8795/paper');

  await p.evaluate(() => Screens.push('settings', {}));
  await p.waitForSelector('[data-go="paperprint"]', { timeout: 8000 });
  await p.waitForFunction(() => /Prints at/.test((document.querySelector('#paperNote') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  const note = await p.$eval('#paperNote', n => n.textContent);
  ok(/Prints at 4:30 am on 192\.168\.4\.50/.test(note) && /✓/.test(note), 'Settings says when and where it prints, and the last one', note);

  await p.$eval('[data-go="paperprint"]', el => el.scrollIntoView());
  await p.screenshot({ path: path.join(out, 'v4-morningpaper-settings.png') });
  await p.click('[data-go="paperprint"]');
  await p.waitForFunction(() => window.__req.some(r => /\/paper\/print/.test(r.url)), null, { timeout: 5000 }).catch(() => {});
  const req = await p.evaluate(() => window.__req.find(r => /\/paper\/print/.test(r.url)));
  ok(req && req.method === 'POST' && req.url === 'http://192.168.4.23:8795/paper/print?date=today', 'Print today\'s paper asks nastime to print', req && req.url);
  ok(req && req.readTimeout >= 180000, 'it waits long enough for Claude to write', req && req.readTimeout);
  await p.waitForTimeout(400);
  const toast = await p.evaluate(() => [...document.querySelectorAll('.toast, #toast, [role="status"]')].map(x => x.textContent).join(' | '));
  ok(/Printing — 2 pages/.test(toast), 'and says it\'s printing', toast.slice(0, 80));

  /* nastime's Caddyfile not updated yet: :8795/paper is a 404, so straight to the paper's own :8796 */
  const fell = await p.evaluate(async () => {
    window.__req = [];
    const real = Capacitor.Plugins.CapacitorHttp.request;
    Capacitor.Plugins.CapacitorHttp.request = async (o) => /:8795\//.test(o.url) ? (window.__req.push({ url: o.url }), { status: 404, data: 'Not here' }) : real(o);
    const s = await MorningPaper.status();
    return { s: !!(s && s.printAt), urls: window.__req.map(r => r.url) };
  });
  ok(fell.s && fell.urls[0] === 'http://192.168.4.23:8795/paper/status' && fell.urls[1] === 'http://192.168.4.23:8796/paper/status', 'before the Caddyfile update it goes straight to :8796', fell.urls.join(' → '));

  ok(!errs.length, 'no page errors', errs.join(' | ').slice(0, 200));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
