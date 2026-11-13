/* Browser test: ticking many frames at once in the Library's Deck.
   Ctrl-click starts ticking; dragging across frames ticks the whole run (and
   a drag that starts on a ticked one unticks); Invert; Delete key asks, then
   deletes; Esc clears; a plain click still toggles one.

     node app/tests/browser/v4-multiselect.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
const FX = f => fs.readFileSync(path.join(__dirname, '..', 'fixtures', f)).toString('base64');
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { window.CS3Lib = { home: async () => ({ path:'/x', exists:true }), scan: async () => ({ items: [], pages: [], roots: [], errors: [] }),
    pickFolder: async () => null, open: async () => {}, trash: async () => 0, boardFolder: async () => ({}), shotline: async () => null,
    grabFind: async () => null, grabRun: async () => ({}), grabStop: async () => {}, grabStatus: async () => ({ running:false, lines:[], links:[] }), onGrab: () => () => {} }; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/'));
  await p.waitForFunction(() => window.App && window.MediaLib, null, { timeout: 15000 });
  await p.evaluate(async g => { const b64 = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
    const fs = []; for(let i = 0; i < 24; i++) fs.push(new File([b64(g)], 'shot-' + String(i).padStart(2, '0') + '.gif', { type: 'image/gif' }));
    await MediaLib.addFiles(fs, 'Riza', 'Morning'); }, FX('opener.gif'));
  await p.evaluate(() => App.go('series')); await p.waitForTimeout(400);
  await p.click('.ctnav [data-v="library"]'); await p.waitForTimeout(900);
  await p.evaluate(() => MediaLib.setSettings({ play:false }));
  const tiles = () => p.$$('.lv-deck .lv-tile[data-uid]');
  const ticked = () => p.$$eval('.lv-deck .lv-tile.is-sel', x => x.length);
  const center = async i => { const r = await (await tiles())[i].boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };

  await p.click('.lv-deck .lv-tile[data-uid]', { modifiers: ['Control'] }); await p.waitForTimeout(700);
  ok(await p.$('.lv-deck.lv-selecting') && await ticked() === 1, 'Ctrl-click starts ticking, with that frame ticked');

  /* drag from the 3rd to the 11th */
  let [x, y] = await center(2); await p.mouse.move(x, y); await p.mouse.down();
  for(const i of [3, 5, 8, 10]){ const [x2, y2] = await center(i); await p.mouse.move(x2, y2, { steps: 4 }); }
  await p.mouse.up(); await p.waitForTimeout(200);
  ok(await ticked() === 10, 'dragging from one frame to another ticks the whole run between', String(await ticked()));
  ok(/10 frames/.test(await p.textContent('[data-seln]')), 'the bar counts them');
  await p.screenshot({ path: path.join(out, 'deck-drag-ticked.png') });
  /* dragging back shrinks the run */
  [x, y] = await center(12); await p.mouse.move(x, y); await p.mouse.down();
  for(const i of [13, 15, 17]){ const [x2, y2] = await center(i); await p.mouse.move(x2, y2, { steps: 4 }); }
  const [bx, by] = await center(14); await p.mouse.move(bx, by, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200);
  ok(await ticked() === 13, 'moving back while dragging only keeps the run you end on', String(await ticked()));
  /* a drag that starts on a ticked frame unticks */
  [x, y] = await center(4); await p.mouse.move(x, y); await p.mouse.down();
  const [ex, ey] = await center(7); await p.mouse.move(ex, ey, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
  ok(await ticked() === 9, 'a drag starting on a ticked frame unticks the run', String(await ticked()));
  /* a plain click still toggles one */
  await (await tiles())[20].click(); await p.waitForTimeout(150);
  ok(await ticked() === 10, 'a click ticks one');
  await p.click('[data-sel="invert"]'); await p.waitForTimeout(150);
  ok(await ticked() === 14, 'Invert ticks the others', String(await ticked()));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(await ticked() === 0, 'Esc clears');
  [x, y] = await center(0); await p.mouse.move(x, y); await p.mouse.down();
  const [fx, fy] = await center(5); await p.mouse.move(fx, fy, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
  await p.keyboard.press('Delete'); await p.waitForTimeout(500);
  ok(/Delete 6 frames/.test(await p.textContent('#sheet')), 'the Delete key asks first', (await p.textContent('#sheet')).trim().slice(0, 40));
  await p.click('#sheet [data-yes]'); await p.waitForTimeout(900);
  ok((await tiles()).length === 18, 'and deletes the six', String((await tiles()).length));
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
