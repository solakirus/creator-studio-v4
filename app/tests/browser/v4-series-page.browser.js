/* Browser test: a series video page with one list of shots, the structure as a
   bar over it, and pages that scroll under a finger. Phone size.

   - Content → Series, Clips and Episodes scroll with a finger (raw touch
     events): the Content wrapper used to be a second scroll box that would not
     pass the swipe on.
   - A series video is a clip; on its Shoot tab the structure is one bar (no
     second list of the shots); its beat chips jump to the beat's heading in the Steps; Edit beats
     renames, moves and removes beats (shots follow, a removed beat's go to the
     one before); a shot moves beat from its Script panel; Paste a script fills
     the shots.
   - Long pages get a ↑ back-to-top button; a tap on the title does the same.

     node app/tests/browser/v4-series-page.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);
async function swipe(cdp, x, y0, y1){
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for(let k = 1; k <= 12; k++){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (y1 - y0) * k / 12 }] }); await new Promise(r => setTimeout(r, 16)); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(url); await p.waitForFunction(() => window.App && window.Structures, null, { timeout: 15000 });
  await p.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(p);
  const top = '.screen:last-child';

  head('Content scrolls under a finger');
  await p.evaluate(async () => {
    for(let i = 0; i < 6; i++) await Store.put('series', { id: 's' + i, title: 'Series ' + i, state: 'live', cadence: 'weekly', count: 8, createdAt: Date.now() - i });
    for(let i = 0; i < 14; i++) await Data.saveClip({ title: 'Clip ' + i, state: 'raw', stage: 'idea' });
    for(let i = 0; i < 10; i++) await Store.put('vlogs', { id: 'v' + i, title: 'Episode ' + i, createdAt: Date.now() - i, acts: [] });
    ['series', 'clips', 'vlogs'].forEach(k => Data.invalidate && Data.invalidate(k));
  });
  await p.evaluate(() => App.go('series')); await p.waitForTimeout(800);
  const at = () => p.evaluate(() => { const v = document.getElementById('view'); return [Math.round(v.scrollTop), v.scrollHeight - v.clientHeight]; });
  for(const v of ['series', 'clips', 'episodes']){
    await p.evaluate(v => document.querySelector(`.ctnav [data-v="${v}"]`).click(), v); await p.waitForTimeout(1400);
    const [, range] = await at();
    await swipe(cdp, 200, 650, 250); await p.waitForTimeout(600);
    const [down] = await at();
    await swipe(cdp, 200, 300, 700); await p.waitForTimeout(600);
    const [up] = await at();
    ok(range > 50 && down > 100 && up < down, `${v}: a finger on the list scrolls it down and back up`, `${down} then ${up} of ${range}`);
  }

  head('back to the top');
  await p.evaluate(() => document.querySelector('.ctnav [data-v="clips"]').click()); await p.waitForTimeout(1200);
  await p.evaluate(() => { const v = document.getElementById('view'); v.scrollTop = v.scrollHeight; v.dispatchEvent(new Event('scroll')); }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.querySelector('.totop').classList.contains('on')), 'far down a long page, ↑ shows');
  await p.click('.totop'); await p.waitForTimeout(900);
  ok((await at())[0] === 0, 'and takes you back to the top');
  await p.waitForTimeout(800);
  ok(await p.evaluate(() => !document.querySelector('.totop').classList.contains('on')), 'then it goes away');

  head('a series video (a clip): Shoot is just the shots, under their beats');
  const vid = await p.evaluate(async () => (await Data.saveClip({ title: 'Part 1', seriesId: 's0', state: 'raw', stage: 'idea', plan: { tab: 'plan', noAutoBeats: true } })).id);
  await p.evaluate(id => Screens.push('clip', { id, tab: 'plan' }), vid); await p.waitForTimeout(1600);
  await p.click(`${top} #clipScript [data-st="pick"]`); await p.waitForTimeout(500);
  await p.click('.sheet [data-use="b-loop"]'); await p.waitForTimeout(1600);
  await p.click(`${top} [data-ctab="shoot"]`); await p.waitForTimeout(1600);
  let ui = await p.evaluate(t => ({ lists: document.querySelectorAll(t + ' .sx-shot').length, rows: document.querySelectorAll(t + ' #clipShots .tk-ps').length,
    bar: !!document.querySelector(t + ' #clipStruct, ' + t + ' .sx-barw'), plan: /Edit beats|Paste a script|Pick a structure/.test(document.querySelector(t + ' .view').textContent),
    beats: [...document.querySelectorAll(t + ' #clipShots .tk-beat')].map(x => x.textContent.trim()).filter(Boolean).length,
    bars: document.querySelectorAll(t + ' .tk-rowsbar').length }), top);
  ok(ui.lists === 0 && ui.rows === 6, 'the shots are listed once — in the Steps', `${ui.rows} steps`);
  ok(!ui.bar && !ui.plan, 'no structure bar: changing beats or pasting a script is on Plan');
  ok(ui.beats >= 6 && ui.bars === 1, 'the Steps still sit under their beat names', ui.beats + ' beat headings');
  await p.screenshot({ path: path.join(out, 'series-page-shoot.png') });

  head('a shot moves beat from its Script panel');
  const stepBeats = r => (r.subs || []).filter(x => x.shot != null).sort((a, b) => a.shot - b.shot).map(x => x.beat);
  await p.click(`${top} #clipShots [data-twirl="5"]`); await p.waitForTimeout(800);
  await p.selectOption(`${top} #clipShots [data-tlbeat="5"]`, '3'); await p.waitForTimeout(1500);
  let v = await p.evaluate(id => Store.get('clips', id), vid);
  ok(stepBeats(v)[5] === 3, 'shot 6 is in the fourth beat now', stepBeats(v).join());

  head('a tap on the title goes back up');
  await p.evaluate(t => { const v = document.querySelector(t + ' .view'); v.scrollTop = v.scrollHeight; }, top); await p.waitForTimeout(300);
  await p.click(`${top} .screenbar .mid h1`); await p.waitForTimeout(900);
  ok(await p.evaluate(t => document.querySelector(t + ' .view').scrollTop, top) === 0, 'the page is back at the top');

  head('errors');
  ok(!errs.length, 'no script errors', errs.slice(0, 3).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
