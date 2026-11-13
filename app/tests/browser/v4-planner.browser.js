/* Browser test: the Planner — the same app showing only planning.
   index.html?planner (Electron: --planner): Plan (opens on the week board),
   Content (no Swipe), Settings, Send to phone. A task planned there reaches
   the phone through Sync on Send to phone; with no Sync it makes the file
   for the other device. The full app is unchanged.

     node app/tests/browser/v4-planner.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const hubMod = require('../helpers/mini-synchub');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const hub = await hubMod.start({ token: 'tok' });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const base = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  const page = async (q, opts) => { const ctx = await b.newContext(Object.assign({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }, opts || {}));
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(q + ': ' + e.message));
    await p.goto(base + q); await p.waitForFunction(() => window.App && window.Sync, null, { timeout: 15000 }); await p.waitForTimeout(1200); return p; };

  const P = await page('?planner');
  const tabs = await P.$$eval('.tabbar .tab', x => x.map(b => b.getAttribute('aria-label')));
  ok(JSON.stringify(tabs) === '["Draft","Plan","Content","Settings","Import plan","Send to phone"]', 'the Planner\'s sidebar: Draft, Plan, Content, Settings, Import plan, Send to phone', JSON.stringify(tabs));
  ok(await P.title() === 'Creator Studio Planner', 'its own name');
  ok(!!(await P.$('.wb, [class*="wb-"], .weekboard, #mnWrap')) && /Week/.test(await P.textContent('#view')), 'it opens on the week board');
  await P.screenshot({ path: path.join(out, 'planner-week.png') });
  await P.click('.tabbar [data-tab="series"]'); await P.waitForTimeout(800);
  const secs = await P.$$eval('.ctnav [data-v]', x => x.map(e => e.dataset.v));
  ok(!secs.includes('swipe') && secs.includes('clips') && secs.includes('series'), 'Content keeps to planning (no Swipe)', secs.join(' '));
  await P.screenshot({ path: path.join(out, 'planner-content.png') });

  /* no Sync: Send to phone makes the file for the other device */
  const [dl] = await Promise.all([P.waitForEvent('download', { timeout: 15000 }), P.click('.tabbar [data-send]')]);
  ok(/for-other-device/.test(dl.suggestedFilename()), 'with no Sync, Send to phone saves the file for the phone', dl.suggestedFilename());

  /* with Sync: plan a task, Send to phone, the phone has it */
  await P.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url); await P.waitForTimeout(800);
  await P.evaluate(async () => QuickAdd.add({ day: await Data.currentDay(), title: 'Shoot the morning routine', kind: 'shoot' }));
  await P.click('.tabbar [data-send]'); await P.waitForTimeout(1500);
  ok(/Sent/.test(await P.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')), 'Send to phone syncs, and says so');
  const phone = await page('', { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await phone.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url); await phone.waitForTimeout(1500);
  ok(await phone.evaluate(async () => (await Data.tasks()).some(t => t.title === 'Shoot the morning routine')), 'the phone has the planned task');

  const full = await page('');
  const ftabs = await full.$$eval('.tabbar .tab', x => x.map(b => b.getAttribute('aria-label')));
  ok(ftabs.includes('Today') && !ftabs.includes('Send to phone'), 'the full app is unchanged', ftabs.join(' '));
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); hub.close && hub.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
