/* Browser test: a series video page with one list of shots, the structure as a
   bar over it, and pages that scroll under a finger. Phone size.

   - Content → Series, Clips and Episodes scroll with a finger (raw touch
     events): the Content wrapper used to be a second scroll box that would not
     pass the swipe on.
   - The series video page: the structure is one bar (no second list of the
     shots); its beat chips jump to the beat's heading in the Steps; Edit beats
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

  head('a series video: one list, the structure as a bar');
  const vid = await p.evaluate(async () => (await Videos.save({ title: 'Part 1', seriesId: 's0' })).id);
  await p.evaluate(id => Screens.push('video-page', { id }), vid); await p.waitForTimeout(1600);
  await p.click(`${top} #vpScript [data-st="pick"]`); await p.waitForTimeout(500);
  await p.click('.sheet [data-use="b-loop"]'); await p.waitForTimeout(1600);
  let ui = await p.evaluate(t => ({ lists: document.querySelectorAll(t + ' .sx-shot').length, rows: document.querySelectorAll(t + ' #vpSteps .tk-ps').length,
    chips: [...document.querySelectorAll(t + ' #vpScript [data-stjump]')].map(x => x.textContent), steps: [...document.querySelectorAll(t + ' .block h4')].filter(h => h.offsetParent !== null).length,
    bars: document.querySelectorAll(t + ' .tk-rowsbar').length }), top);
  ok(ui.lists === 0 && ui.rows === 6, 'the shots are listed once — in the Steps', `${ui.rows} steps`);
  ok(ui.chips.length === 6 && ui.chips[4] === 'Payoff1', 'the bar has a chip per beat', ui.chips.join(' '));
  ok(ui.steps === 0 && ui.bars === 1, 'one Steps heading, not two');
  await p.click(`${top} #vpScript [data-stjump="4"]`); await p.waitForTimeout(900);
  ui = await p.evaluate(t => { const h = document.querySelector(t + ' .tk-beat[data-beatk="4"]').getBoundingClientRect(); return Math.round(h.top); }, top);
  ok(ui > 40 && ui < 200, 'a chip jumps to that beat in the Steps', `heading at ${ui}px`);
  await p.screenshot({ path: path.join(out, 'series-page-bar.png') });

  head('Edit beats');
  await p.click(`${top} #vpScript [data-st="beats"]`); await p.waitForTimeout(500);
  await p.fill('.sheet .sx-ed:nth-of-type(3) .nm', 'Why it matters');
  await p.click('.sheet .sx-ed:nth-of-type(2) [data-rm]'); await p.waitForTimeout(200);
  await p.click('.sheet .sx-ed:nth-of-type(1) [data-mv="1"]'); await p.waitForTimeout(200);
  await p.click('.sheet [data-ok]'); await p.waitForTimeout(1600);
  let v = await p.evaluate(id => Store.get('videos', id), vid);
  const stepBeats = r => (r.subs || []).filter(x => x.shot != null).sort((a, b) => a.shot - b.shot).map(x => x.beat);
  ok(v.beats.join() === 'Why it matters,Hook,Build,Payoff,Call to action', 'renamed, removed and moved', v.beats.join(' → '));
  ok(stepBeats(v).join() === '1,1,0,2,3,4', 'every shot followed its beat; the removed beat\'s shot went to the one before', stepBeats(v).join());
  ok(await p.evaluate(t => [...document.querySelectorAll(t + ' #vpSteps .tk-beat')].map(x => x.textContent).join(), top) !== '', 'the Steps redraw with the new beats');

  head('a shot moves beat from its Script panel');
  await p.click(`${top} #vpSteps [data-twirl="5"]`); await p.waitForTimeout(800);
  await p.selectOption(`${top} #vpSteps [data-tlbeat="5"]`, '3'); await p.waitForTimeout(1500);
  v = await p.evaluate(id => Store.get('videos', id), vid);
  ok(stepBeats(v)[5] === 3, 'shot 6 is in Payoff now', stepBeats(v).join());

  head('Paste a script from the bar');
  await p.click(`${top} #vpScript [data-st="paste"]`); await p.waitForTimeout(500);
  await p.fill('.sheet [data-paste]', 'Why this matters.\n\nThe result first.\n\nTEXT: 5:15 AM');
  await p.click('.sheet [data-ok]'); await p.waitForTimeout(1600);
  v = await p.evaluate(id => Store.get('videos', id), vid);
  const lines = (v.subs || []).filter(x => x.lines && x.lines.length).length;
  ok(lines === 3, 'the parts land on the shots in story order', `${lines} shots got lines`);
  ok(await p.evaluate(t => [...document.querySelectorAll(t + ' #vpSteps .tk-tw')].filter(x => /· 1/.test(x.textContent)).length, top) === 3, 'and the Steps\' Script counts show them');

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
