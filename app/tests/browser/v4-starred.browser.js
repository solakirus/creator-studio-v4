/* Browser test: starred groups — picked on the laptop, kept on the phone.

   Laptop (Library, Electron bridge stood in): frames added; two starred into
   a new group from the Deck's Select mode, one into a second group from the
   frame viewer. Sync (tests/helpers/mini-synchub.js). Phone: a Starred
   section with both groups, frames that draw, full-screen flipping, and a
   shot that takes a starred frame. Starred frames outlive the 21-day rule;
   taking one out on the laptop takes it off the phone.

     node app/tests/browser/v4-starred.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const hubMod = require('../helpers/mini-synchub');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const FX = f => fs.readFileSync(path.join(__dirname, '..', 'fixtures', f)).toString('base64');
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const hub = await hubMod.start({ token: 'tok' });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  async function device(name, laptop){
    const ctx = await b.newContext(laptop ? { viewport: { width: 1280, height: 860 } } : { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    if(laptop) await ctx.addInitScript(() => { window.CS3Lib = { home: async () => '/x', scan: async () => ({ items: [], pages: [], roots: [], errors: [] }),
      pickFolder: async () => null, open: async () => {}, trash: async () => ({}), boardFolder: async () => ({}), shotline: async () => null,
      grabFind: async () => ({ root: 'built in', setUp: true, node: true, builtin: true, ytdlp: true, ffmpeg: true, out: '/x' }),
      grabRun: async () => ({}), grabStop: async () => {}, onGrab: () => () => {} }; });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.MediaLib && window.Sync && window.StarPick, null, { timeout: 15000 });
    await p.waitForTimeout(1000); return p;
  }
  const lap = await device('laptop', true);

  head('starring on the laptop');
  const uids = await lap.evaluate(async ({ g, s, w }) => {
    const b64 = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
    const r = await MediaLib.addFiles([new File([b64(g)], 'walk-in.gif', { type: 'image/gif' }), new File([b64(s)], 'coffee.png', { type: 'image/png' }),
      new File([b64(w)], 'whip.gif', { type: 'image/gif' }), new File([b64(s)], 'not-starred.png', { type: 'image/png' })], 'Everyday', 'Mine');
    return r.added;
  }, { g: FX('opener.gif'), s: FX('still.png'), w: FX('disk.gif') });
  await lap.evaluate(() => App.go('series')); await lap.waitForTimeout(400);
  await lap.click('.ctnav [data-v="library"]'); await lap.waitForTimeout(700);
  ok(!!(await lap.$('.lv-tabs [data-tab="starred"]')), 'the Library has a ★ Starred tab');
  await lap.click('[data-select]'); await lap.waitForTimeout(400);
  for(const u of uids.slice(0, 2)) await lap.click(`.lv-deck .lv-tile[data-uid="${u}"]`);
  await lap.click('[data-sel="star"]'); await lap.waitForTimeout(500);
  await lap.fill('#sg-new', 'Walking'); await lap.click('[data-sgnew]'); await lap.waitForTimeout(700);
  let gs = await lap.evaluate(async () => (await MediaLib.allStars()).map(g => [g.name, g.items.length]));
  ok(JSON.stringify(gs) === '[["Walking",2]]', 'Select → ★ Star into… makes a group with them', JSON.stringify(gs));
  /* a frame's own ★ */
  await lap.click('[data-select]'); await lap.waitForTimeout(400);
  await lap.click(`.lv-deck .lv-tile[data-uid="${uids[2]}"]`); await lap.waitForTimeout(600);
  await lap.click('.lv-viewer [data-star]'); await lap.waitForTimeout(500);
  await lap.fill('#sg-new', 'Transitions'); await lap.click('[data-sgnew]'); await lap.waitForTimeout(700);
  gs = await lap.evaluate(async () => (await MediaLib.allStars()).map(g => [g.name, g.items.length]));
  ok(gs.length === 2 && gs.some(g => g[0] === 'Transitions' && g[1] === 1), 'a frame\'s ★ Star puts it in a group', JSON.stringify(gs));
  await lap.click('.lv-tabs [data-tab="starred"]'); await lap.waitForTimeout(800);
  const head1 = await lap.textContent('.lv-starhead');
  ok(/3 frames in 2 groups/.test(head1) && /MB on the phone/.test(head1), 'the Starred tab counts what\'s on the phone', head1.match(/\d+ frames in \d+ groups[^.]*/)[0]);
  await lap.screenshot({ path: path.join(out, 'laptop-starred.png') });
  await lap.click('[data-starshow]'); await lap.waitForTimeout(700);
  const dk = await lap.evaluate(() => ({ n: document.querySelectorAll('.lv-deck .lv-tile').length, src: (document.querySelector('.lv-bar [data-src]') || {}).value }));
  /* groups sort A→Z: the first card is Transitions, with its one frame */
  ok(dk.n === 1 && /^star:/.test(dk.src || ''), 'Show in Deck opens the group in the Deck, with its search and bulk tools', JSON.stringify(dk));
  const kept = await lap.evaluate(async () => { await TaskFrames.run(); return (await Store.all('task-frames')).values.length; });
  ok(kept === 3, 'the three starred frames are kept for the phone (not the fourth)', kept);
  const up = await lap.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url);
  ok(up && up.ok, 'the laptop syncs');

  head('on the phone');
  const ph = await device('phone', false);
  await ph.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url);
  await ph.waitForTimeout(1500);   /* the app redraws after taking the server's data */
  await ph.evaluate(() => App.go('series')); await ph.waitForTimeout(800);
  const nav = await ph.evaluate(() => [...document.querySelectorAll('.ctnav [data-v]')].map(b => b.dataset.v));
  ok(nav.includes('starred') && !nav.includes('library'), 'Content has Starred (and still no Library)', nav.join(' '));
  await ph.click('.ctnav [data-v="starred"]'); await ph.waitForTimeout(1200);
  const st = await ph.evaluate(() => ({ pills: [...document.querySelectorAll('.st-pills button')].map(b => b.textContent), cells: document.querySelectorAll('.st-cell').length,
    imgs: document.querySelectorAll('.st-cell img').length }));
  ok(st.pills.join('|') === 'All|★ Transitions|★ Walking', 'both groups are there', st.pills.join(' '));
  ok(st.cells === 3 && st.imgs === 3, 'with their frames, drawn', `${st.imgs} of 3`);
  await ph.screenshot({ path: path.join(out, 'phone-starred.png') });
  await ph.click('.st-pills [aria-pressed="false"]:last-child'); await ph.waitForTimeout(700);
  ok((await ph.evaluate(() => document.querySelectorAll('.st-cell').length)) === 2, 'a group shows just its frames');
  await ph.click('.st-cell'); await ph.waitForTimeout(700);
  ok(await ph.evaluate(() => !!document.querySelector('.st-view img') && /1 \/ 2/.test(document.querySelector('.st-vtop small').textContent)), 'a frame opens full screen in its group');
  await ph.click('.st-view [data-n]'); await ph.waitForTimeout(400);
  ok(/2 \/ 2/.test(await ph.textContent('.st-vtop small')), 'and flips to the next');
  await ph.click('.st-view [data-x]');

  head('a shot takes a starred frame');
  const tid = await ph.evaluate(async () => (await QuickAdd.add({ day: await Data.currentDay(), title: 'Morning walk', kind: 'shoot' })).id);
  await ph.evaluate(id => Screens.push('task', { id }), tid); await ph.waitForTimeout(1300);
  ok((await ph.evaluate(() => document.querySelectorAll('[data-starpick]').length)) === 9, 'each frameless shot has a ＋');
  await ph.click('[data-starpick="0"]'); await ph.waitForTimeout(900);
  await ph.click('#sheet [data-pick]'); await ph.waitForTimeout(1200);
  const got = await ph.evaluate(async id => { const t = await Store.get('tasks', id); return { item: t.page.slots[0].item, th: !!document.querySelector('.tk-th[data-shootat="0"] img') }; }, tid);
  ok(got.item && /^db:li_/.test(got.item) && got.th, 'picking one puts it on the shot, and it shows', got.item);
  await ph.evaluate(() => Screens.pop());

  head('they stay — until taken out on the laptop');
  const late = await ph.evaluate(async () => { TaskFrames._now = () => Date.now() + 60 * 86400000; const r = await TaskFrames.run(); delete TaskFrames._now; return { removed: r.removed, left: (await Store.all('task-frames')).values.length }; });
  ok(late.removed === 0 && late.left === 3, '60 days on, every starred frame is still on the phone', `${late.left} kept`);
  /* the shot above took the frame from the first group, Transitions (uids[2]) */
  await lap.evaluate(async us => { for(const g of await MediaLib.allStars()) await MediaLib.unstar(g.id, us); await Sync.syncNow(); }, [uids[0], uids[2]]);
  const gone = await ph.evaluate(async () => { await Sync.syncNow(); TaskFrames._now = () => Date.now() + 2 * 86400000; const r = await TaskFrames.run(); delete TaskFrames._now;
    return { removed: r.removed, left: (await Store.all('task-frames')).values.map(x => x.uid) }; });
  ok(gone.removed === 1 && !gone.left.includes(uids[0]), 'taking one out on the laptop takes it off the phone', `${gone.removed} removed`);
  ok(gone.left.includes(uids[2]), 'but not one a task on the phone still uses');

  ok(!errs.length, 'no script errors', errs.slice(0, 3).join(' | '));
  await b.close(); await hub.close();
  console.log(`\nstarred groups  (${pass} ok, ${fail} failed)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
