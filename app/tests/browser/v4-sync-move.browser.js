/* Browser test: Settings → Sync → Change server address (Sync.moveServer).
   nastime came back on a new IP (13 Nov 2026) and a connected device had no
   way to follow it short of Disconnect, which dropped its waiting changes and
   then asked a question whose wrong answer replaces the device's data.

     node app/tests/browser/v4-sync-move.browser.js */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const hubMod = require('../helpers/mini-synchub');
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');

(async () => {
  const hub = await hubMod.start({ token: 'tok' });
  /* the same hub under another address, as after nastime's IP changed */
  const moved = hub.url.replace('127.0.0.1', 'localhost');
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  const device = async (name, w) => {
    const ctx = await b.newContext({ viewport: { width: w || 1280, height: 860 } });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.Sync, null, { timeout: 15000 });
    await p.waitForTimeout(600); return p;
  };
  const LAP = await device('laptop'), PH = await device('phone', 400);
  await LAP.evaluate(async () => { for(let i = 0; i < 3; i++) await Store.put('swipes', { id: 'sw' + i, title: 'Swipe ' + i, createdAt: Date.now() }); });
  await LAP.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url);
  await PH.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url);

  console.log('\n— the server went away; the laptop kept working —');
  await LAP.evaluate(async () => {
    await Sync.setPaused(true);           /* stands in for "can't reach it" */
    await Store.put('swipes', { id: 'sw_new', title: 'Saved while the NAS was down', createdAt: Date.now() });
    await Sync.setPaused(false);
  });
  const before = await LAP.evaluate(() => Sync.status());

  console.log('\n— a wrong address changes nothing —');
  const bad = await LAP.evaluate(() => Sync.moveServer('http://127.0.0.1:9').then(() => 'switched', e => e.message));
  const still = await LAP.evaluate(() => Sync.status());
  ok(bad !== 'switched' && still.server === before.server && still.pending === before.pending,
    'an address that does not answer is refused, and the old one stays', bad);

  console.log('\n— switching to the new address —');
  await LAP.evaluate(() => Screens.push('settings', {})); await LAP.waitForTimeout(700);
  await LAP.click('[data-go="sync"]').catch(async () => { await LAP.evaluate(() => document.querySelector('#syLine').closest('button,[data-go]').click()); });
  await LAP.waitForTimeout(500);
  ok(!!(await LAP.$('#sheet [data-move]')), 'the Sync sheet has Change server address');
  await LAP.click('#sheet [data-move]');
  await LAP.fill('#sy-new', moved);
  await LAP.click('#sheet [data-move-go]'); await LAP.waitForTimeout(1500);
  const after = await LAP.evaluate(() => Sync.status());
  ok(after.connected && after.server === moved.replace(/\/+$/, ''), 'the laptop now uses the new address', after.server);
  ok(after.pending === 0 && !after.error, 'what it saved while the NAS was down went up', JSON.stringify({ pending: after.pending, error: after.error }));
  ok((await LAP.evaluate(async () => (await Store.all('swipes')).keys.length)) === 4, 'nothing on the laptop was dropped');

  await PH.evaluate(m => Sync.moveServer(m), moved);
  const got = await PH.evaluate(async () => (await Store.all('swipes')).keys.sort().join(','));
  ok(got === 'sw0,sw1,sw2,sw_new', 'the phone, moved too, has everything', got);

  console.log('\n— a brand-new, empty server —');
  const hub2 = await hubMod.start({ token: 'tok' });
  const r2 = await LAP.evaluate(h => Sync.moveServer(h), hub2.url);
  const PH2 = await device('phone2', 400);
  await PH2.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub2.url);
  ok(r2.ok && (await PH2.evaluate(async () => (await Store.all('swipes')).keys.length)) === 4,
    'the laptop fills an empty server with what it has', `${r2.sent} sent`);

  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close(); await hub.close(); await hub2.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
