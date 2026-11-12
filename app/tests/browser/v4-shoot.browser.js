/* Browser test: GIFs move on a task's shot page, and shoot mode walks the
   shots one at a time, full screen.

   A phone-sized app with no Library: three kept frames (a moving GIF, a
   still, a clip) on a five-shot page, as they arrive from the laptop.

     node app/tests/browser/v4-shoot.browser.js [out folder]   (screenshots) */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
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
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/'));
  await p.waitForFunction(() => window.App && window.TaskFrames && window.ShootRun, null, { timeout: 15000 });
  await p.waitForTimeout(1200);

  const id = await p.evaluate(async ({ gif, png, webm }) => {
    const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const keep = (uid, kind, mime, data) => Store.put('task-frames', { uid, kind, name: uid, mime, blob: new Blob([b64(data)], { type: mime }), keptAt: Date.now() });
    await keep('db:li_gif', 'gif', 'image/gif', gif);
    await keep('db:li_png', 'image', 'image/png', png);
    await keep('db:li_clip', 'video', 'video/webm', webm);
    MediaLib.invalidate();
    const P = { ...Notebook.stepsPage('Walk'), name: 'Shot sequence · Walk' };
    P.slots = [['db:li_gif', 'B-roll', 'How it starts: coffee, walking out to it'], ['db:li_png', 'Action', 'Wide: the problem, the start'],
      ['db:li_clip', 'Insert', 'Close: hands on the tool'], ['', 'Talking', 'Explain it to camera'], ['db:li_gif', 'Transition', 'Transition out']]
      .map(([item, role, text]) => ({ item, role, text, tone: '', done: false }));
    const t = await QuickAdd.add({ day: await Data.currentDay(), title: 'Walk', kind: 'shoot', page: P });
    return t.id;
  }, { gif: FX('opener.gif'), png: FX('still.png'), webm: FX('clip.webm') });

  head('the shot page on the task');
  await p.evaluate(id => Screens.push('task', { id }), id);
  await p.waitForTimeout(2200);
  /* on a phone the page drawing starts folded under the steps */
  if(await p.$('[data-a="showpage"]')){ await p.click('[data-a="showpage"]'); await p.waitForTimeout(1500); }
  /* the GIF's spot, sampled twice: its three frames are orange, green and blue */
  const sample = () => p.evaluate(() => {
    const c = document.querySelector('[data-pagecanvas]');
    const r = Notebook.slotRects('steps', 5)[0];
    const d = c.getContext('2d').getImageData(Math.round(r[0] + 8), Math.round(r[1] + 8), 1, 1).data;
    return [d[0], d[1], d[2]].join(',');
  });
  const seen = new Set();
  for(let k = 0; k < 8; k++){ seen.add(await sample()); await p.waitForTimeout(110); }
  ok(seen.size >= 2, 'the GIF moves on the task\'s shot page, not stuck on its first frame', [...seen].join(' | '));
  ok(await p.$('[data-a="shootmode"]') !== null, 'there is a Shoot mode button on the shot page');
  ok(await p.$('.tkp-next[data-a="shootnext"]') !== null, 'and Next up opens it too');

  head('tap a picture → shoot mode on that shot');
  const box = await p.evaluate(() => { const c = document.querySelector('[data-pagecanvas]'); c.scrollIntoView(); const b = c.getBoundingClientRect(); const r = Notebook.slotRects('steps', 5)[1];
    return { x: b.left + (r[0] + r[2]) / 2 * b.width / Notebook.PAGE_W, y: b.top + (r[1] + r[3]) / 2 * b.height / Notebook.PAGE_H }; });
  await p.mouse.click(box.x, box.y);
  await p.waitForTimeout(900);
  let s = await p.evaluate(() => ({ open: !!document.querySelector('.sr-screen .sr'), n: (document.querySelector('.sr-n') || {}).textContent,
    t: (document.querySelector('.sr-t') || {}).textContent, k: (document.querySelector('.sr-k') || {}).textContent,
    img: !!document.querySelector('.sr-pic img'), full: (() => { const r = document.querySelector('.sr-screen').getBoundingClientRect(); return r.width === innerWidth && r.height === innerHeight; })() }));
  ok(s.open && s.full, 'it fills the screen');
  ok(s.n === '2 / 5' && /Wide: the problem/.test(s.t) && /Action/.test(s.k), 'on the shot tapped, with its type and line', `${s.n} · ${s.k} · ${s.t}`);
  ok(s.img, 'showing its frame');
  await p.screenshot({ path: path.join(out, 'shoot-2.png') });

  head('Got it, and on to the next');
  await p.click('[data-got]');
  await p.waitForTimeout(700);
  s = await p.evaluate(() => ({ n: document.querySelector('.sr-n').textContent, vid: !!document.querySelector('.sr-pic video'),
    playing: (() => { const v = document.querySelector('.sr-pic video'); return v && !v.paused; })(), dots: [...document.querySelectorAll('.sr-dots i')].map(i => i.className).join(',') }));
  ok(s.n === '3 / 5', 'Got it moves to the next shot not taken', s.n);
  ok(s.vid && s.playing, 'a clip plays');
  ok(/done/.test(s.dots.split(',')[1]), 'and the bar shows shot 2 taken', s.dots);
  let saved = await p.evaluate(async id => { const t = await Store.get('tasks', id); return { slot: t.page.slots[1].done, step: t.subs.find(x => x.shot === 1).done }; }, id);
  ok(saved.slot && saved.step, 'the tick is saved on the shot and its step');
  await p.screenshot({ path: path.join(out, 'shoot-3.png') });

  /* a swipe back, then on */
  const swipe = async dx => p.evaluate(dx => {
    const el = document.querySelector('.sr-screen'); const mk = (type, x) => { const ev = new Event(type, { bubbles: true });
      ev.touches = [{ clientX: x, clientY: 400 }]; ev.changedTouches = [{ clientX: x, clientY: 400 }]; el.dispatchEvent(ev); };
    mk('touchstart', 200); mk('touchend', 200 + dx); }, dx);
  await swipe(150); await p.waitForTimeout(400);
  ok((await p.textContent('.sr-n')) === '2 / 5', 'a swipe right goes back');
  ok(/undo/.test(await p.getAttribute('[data-got]', 'class')), 'a taken shot offers undo');
  await swipe(-150); await p.waitForTimeout(400);
  ok((await p.textContent('.sr-n')) === '3 / 5', 'a swipe left goes on');

  head('clean view');
  await p.click('[data-pic]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('.sr').classList.contains('clean') && getComputedStyle(document.querySelector('.sr-bar')).display === 'none'), 'tapping the picture hides everything else');
  await p.screenshot({ path: path.join(out, 'shoot-clean.png') });
  await p.click('[data-pic]'); await p.waitForTimeout(200);

  head('a shot with no frame, then the rest');
  await p.click('[data-got]'); await p.waitForTimeout(500);
  s = await p.evaluate(() => ({ n: document.querySelector('.sr-n').textContent, none: !!document.querySelector('.sr-none') }));
  ok(s.n === '4 / 5' && s.none, 'a shot without a frame still shows, big number and line', s.n);
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  ok((await p.textContent('.sr-n')) === '5 / 5', 'Enter is Got it (laptop)');
  await p.keyboard.press('Space'); await p.waitForTimeout(500);
  ok((await p.textContent('.sr-n')) === '1 / 5', 'after the last, it goes back to the first not taken');
  await p.click('[data-got]'); await p.waitForTimeout(600);
  s = await p.evaluate(async id => ({ all: !!document.querySelector('.sr-all'), txt: (document.querySelector('.sr-all h2') || {}).textContent,
    view: (await Store.get('tasks', id)).view }), id);
  ok(s.all && /All 5 shots taken/.test(s.txt), 'every shot in: it says so', s.txt);
  ok(s.view === 'done', 'and the task is ticked off');
  await p.screenshot({ path: path.join(out, 'shoot-all.png') });

  head('back to the task');
  await p.click('.sr-all [data-x]'); await p.waitForTimeout(900);
  s = await p.evaluate(() => ({ top: !!document.querySelector('.screen[data-screen="task"]'), sr: !!document.querySelector('.sr-screen'),
    count: (document.querySelector('.tkp-count') || {}).textContent }));
  ok(s.top && !s.sr, 'closing leaves you on the task');
  ok(s.count === '5/5', 'which already shows every shot ticked', s.count);

  head('from Today');
  await p.evaluate(async id => { await ShootRun.setDone(id, 0, false); Screens.pop(); App.go('today'); }, id);
  await p.waitForTimeout(1200);
  const chip = await p.$(`[data-shoot="${id}"]`);
  ok(!!chip, 'Today\'s card has a shoot chip', chip && await chip.textContent());
  ok(!(await p.$(`[data-pages="${id}"].tpages`)), 'in place of the page chip that repeated the steps count');
  if(chip){ await chip.click(); await p.waitForTimeout(900); }
  ok((await p.textContent('.sr-n').catch(() => '')) === '1 / 5', 'it opens shoot mode on the shot still to do');
  await p.evaluate(() => Screens.pop());

  head('errors');
  ok(!errs.length, 'no script errors', errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\nshoot mode  (${pass} ok, ${fail} failed)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
