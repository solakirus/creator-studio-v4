/* Browser test: the app installs and runs with the network off.

   Served from a SUBPATH (/creator-studio-3/) because that is how GitHub Pages
   serves a project site, and a single leading slash anywhere would work in
   testing and break there.

     node scripts/build-sw.js _site && node app/tests/browser/pwa.browser.js _site */
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');

const SITE = path.resolve(process.argv[2] || '_site');
const BASE = '/creator-studio-3/';
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.webmanifest':'application/manifest+json', '.png':'image/png', '.woff2':'font/woff2', '.svg':'image/svg+xml' };

(async () => {
  let offline = false, served = 0;
  const server = http.createServer((req, res) => {
    if (offline) { res.socket.destroy(); return; }
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(BASE, '') || 'index.html';
    const f = path.join(SITE, rel);
    if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
    served++;
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}${BASE}index.html`;

  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  const ctx = await b.newContext({ viewport:{ width:1024, height:1366 }, hasTouch:true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if (!c) fails++; };

  console.log('\nit loads from a project subpath');
  await p.goto(url); await p.waitForTimeout(2500);
  ok(await p.title() === 'Creator Studio 3', 'the page is the app', await p.title());
  ok(await p.locator('.tabbar .tab').count() >= 5, 'the tabs rendered',
     await p.locator('.tabbar .tab').count());
  ok(!errs.length, 'and nothing threw on boot', errs.slice(0,2));

  console.log('\nit registered as an installable app');
  const sw = await p.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return r ? { scope: r.scope, active: !!r.active } : null;
  });
  ok(sw && sw.active, 'the service worker is active', sw && sw.scope);
  ok(sw && sw.scope.endsWith(BASE), 'scoped to the subpath, not the domain root', sw && sw.scope);
  const man = await p.evaluate(async () => {
    const href = document.querySelector('link[rel=manifest]').href;
    const m = await (await fetch(href)).json();
    return { name: m.name, display: m.display, start: m.start_url, icons: m.icons.length };
  });
  ok(man.display === 'standalone', 'it opens without browser chrome', man.display);
  ok(man.icons === 3, 'with its icons', man.icons);

  console.log('\nthe data survives a reload — the thing that matters');
  await p.evaluate(async () => {
    await Store.put('tasks', { id: 9100, day: 1, title:'Written on the iPad', kind:'task',
      view:'todo', subs:[], cad:'', pri:'med' });
  });
  await p.reload(); await p.waitForTimeout(2000);
  const kept = await p.evaluate(async () => (await Store.get('tasks', 9100) || {}).title);
  ok(kept === 'Written on the iPad', 'it is still there after a reload', kept);

  console.log('\nand with the network pulled');
  const before = served;
  offline = true;
  await ctx.setOffline(true);
  await p.reload({ waitUntil: 'commit' }).catch(() => {});
  await p.waitForTimeout(3000);
  ok(await p.title() === 'Creator Studio 3', 'the app still opens offline', await p.title());
  ok(await p.locator('.tabbar .tab').count() >= 5, 'with its tabs',
     await p.locator('.tabbar .tab').count());
  const kept2 = await p.evaluate(async () => (await Store.get('tasks', 9100) || {}).title).catch(() => null);
  ok(kept2 === 'Written on the iPad', 'and the task is still there', kept2);
  console.log(`         (the server answered ${served - before} requests while offline — expected 0)`);
  ok(served === before, 'nothing reached the network');

  console.log(fails ? `\n${fails} check(s) failed` : '\nit installs, runs offline, and keeps its data');
  console.log('errors:', errs.length ? errs.slice(0,3) : 'none');
  await b.close(); server.close();
  process.exit(fails ? 1 : 0);
})();
