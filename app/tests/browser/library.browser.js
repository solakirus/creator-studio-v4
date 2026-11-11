/* Browser test: the Library and Templates carried over from Shotline.

   Adds GIFs, a clip and stills to the Library, makes a board, opens the
   notebook carousel and fills its pages, adds Library frames to a template's
   shots, makes a video from a template and puts one on a day. Screenshots of
   each step go to <out>. Runs on the files in app/ with a throwaway profile.

     node app/tests/browser/library.browser.js <media folder> <out folder>
   (CHROME=path to Chrome or Edge; on Windows Edge is found by itself) */
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs');
const media = path.resolve(process.argv[2] || '.');
const out = path.resolve(process.argv[3] || '.');
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: exe, headless: true,
    args: ['--allow-file-access-from-files', '--disable-component-update', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/'));
  await p.waitForTimeout(1500);
  const shot = async n => { await p.waitForTimeout(900); await p.screenshot({ path: path.join(out, n + '.png') }); };
  const ok = (c, l) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };

  /* Library: add files */
  await p.evaluate(() => App.go('series'));
  await p.waitForTimeout(400);
  await p.click('.ctnav [data-v="library"]');
  await p.waitForTimeout(500);
  await p.click('.lv-tabs [data-tab="add"]');
  await p.waitForTimeout(400);
  const files = fs.readdirSync(media).filter(f => /\.(gif|mp4|png|jpg)$/i.test(f)).map(f => path.join(media, f));
  await p.fill('[data-libname]', 'Vlog looks');
  await p.setInputFiles('[data-input]', files);
  await p.waitForTimeout(3000);
  const n = await p.evaluate(async () => (await MediaLib.load(true)).items.length);
  ok(n === files.length, `${n} of ${files.length} files in the Library`);
  await shot('1-deck');

  /* filters */
  await p.click('.lv-bar [data-k="gif"]');
  await p.waitForTimeout(500);
  const gifs = await p.evaluate(() => document.querySelectorAll('.lv-deck .lv-tile').length);
  ok(gifs === files.filter(f => /\.gif$/i.test(f)).length, `GIF filter shows ${gifs}`);
  await p.click('.lv-bar [data-k="all"]');

  /* a board */
  await p.evaluate(async () => {
    const l = await MediaLib.load();
    await MediaLib.saveBoard({ name: 'Harbour mood', group: 'Mood', items: l.items.slice(0, 3).map(i => i.uid) });
  });
  await p.click('.lv-tabs [data-tab="boards"]');
  await shot('2-boards');
  await p.click('.lv-tabs [data-tab="folders"]');
  await shot('3-folders');

  /* big viewer */
  await p.click('.lv-tabs [data-tab="deck"]');
  await p.waitForTimeout(500);
  await p.click('.lv-deck .lv-tile >> nth=0');
  await shot('4-viewer');
  await p.click('.lv-viewer [data-close]');

  /* Templates: the notebook carousel */
  await p.click('.ctnav [data-v="templates"]');
  await p.waitForTimeout(800);
  await shot('5-templates');
  const tid = await p.evaluate(async () => (await ShotTemplates.all()).find(t => t.name.startsWith('Behind the film')).id);
  await p.click(`[data-open="${tid}"]`);
  await p.waitForTimeout(1200);
  await p.click('.pe-bar summary:has-text("Fill empty spots")');
  await p.click('.pe-bar [data-fill=""]');
  await p.waitForTimeout(2500);
  const filled = await p.evaluate(async id => (await ShotTemplates.get(id)).sheets[0].slots.filter(s => s.item).length, tid);
  ok(filled === 9, `Frames from the film: ${filled} of 9 spots filled`);
  await shot('6-frames-page');
  await p.click('[data-pickpal]');
  await p.waitForTimeout(1500);
  const pal = await p.evaluate(async id => (await ShotTemplates.get(id)).sheets[0].fields.tone_note, tid);
  ok(/tones/.test(pal), `palette picked: ${JSON.stringify(pal)}`);
  for (let i = 1; i < 8; i++) {
    await p.click(`.pe-strip .pe-thumb >> nth=${i}`);
    await p.waitForTimeout(500);
    if (i === 2 || i === 4 || i === 7) {
      await p.click('.pe-bar summary:has-text("Fill empty spots")');
      await p.click('.pe-bar [data-fill=""]');
    }
    await shot('7-page-' + (i + 1));
  }

  /* a spot opens the picker */
  await p.click(`.pe-strip .pe-thumb >> nth=0`);
  await p.waitForTimeout(600);
  const box = await p.locator('.pe-page').boundingBox();
  await p.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await p.waitForTimeout(800);
  ok(await p.locator('.lv-picker').count() === 1, 'clicking a picture spot opens the picker');
  await shot('8-picker');
  await p.click('.lv-picker .lv-tile >> nth=1');
  await p.waitForTimeout(800);

  /* type over words on the page */
  await p.mouse.click(box.x + box.width * (100 / 720), box.y + box.height * (45 / 900));
  await p.waitForTimeout(400);
  await p.keyboard.press('Control+A');
  await p.keyboard.type('MY FRAMES\nTHIS WEEK');
  await p.mouse.click(box.x + box.width + 40, box.y + 10);
  await p.waitForTimeout(800);
  const title = await p.evaluate(async id => (await ShotTemplates.get(id)).sheets[0].fields.title, tid);
  ok(title === 'MY FRAMES\nTHIS WEEK', `title typed on the page: ${JSON.stringify(title)}`);

  /* a template's shots from the Library */
  const vid = await p.evaluate(async () => (await ShotTemplates.all()).find(t => t.name === 'Weekly vlog').id);
  await p.click(`[data-open="${vid}"]`);
  await p.waitForTimeout(700);
  const added = await p.evaluate(async id => {
    const l = await MediaLib.load();
    return ShotTemplates.addToTarget({ kind: 'shots', tid: id }, l.items.map(i => i.uid));
  }, vid);
  await p.click('.tp-tabs [data-tab="look"]');
  await p.click('.tp-tabs [data-tab="shots"]');
  await p.waitForTimeout(1200);
  ok(added === files.length, `${added} frames added to the Weekly vlog's shots`);
  await shot('9-shots');
  await p.click('.tp-tabs [data-tab="tasks"]');
  await shot('10-tasks');
  await p.click('.tp-tabs [data-tab="look"]');
  await shot('11-look');

  /* use it */
  const r = await p.evaluate(async id => {
    const v = await ShotTemplates.newVideo(id);
    const n = await ShotTemplates.putOnDay(id, Date.now());
    const tasks = Object.values(await Store.allMap('tasks'));
    return { video: v && v.title, shots: v && v.shots.length, n, shoot: tasks.filter(t => t.title === 'Shoot — Weekly vlog').length };
  }, vid);
  ok(r.video === 'Weekly vlog' && r.shots > 8, `new video "${r.video}" with ${r.shots} shots`);
  ok(r.n === 9 && r.shoot === 1, `put on today: ${r.n} tasks, one shoot task`);

  /* a page saved as a picture draws without error */
  const px = await p.evaluate(async id => {
    const sh = (await ShotTemplates.get(id)).sheets[0];
    const m = await Notebook.prepare(sh);
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
    Notebook.draw(c.getContext('2d'), sh, { scale: 1.5, media: m });
    return c.toDataURL('image/png').length;
  }, tid);
  ok(px > 100000, `page renders at 1080 × 1350 (${px} bytes)`);
  /* full-size pictures of the frames page, the cover and a task sequence */
  const pages = await p.evaluate(async id => {
    const t = await ShotTemplates.get(id);
    const steps = Notebook.stepsPage('Brake job');
    await Notebook.fillEmpty(steps, '');
    steps.slots[0].done = true;
    const outp = {};
    for (const [k, sh] of [['frames', t.sheets[0]], ['character', t.sheets[2]], ['cover', t.sheets[7]], ['steps', steps]]) {
      const m = await Notebook.prepare(sh);
      const c = document.createElement('canvas'); c.width = 720; c.height = 900;
      Notebook.draw(c.getContext('2d'), sh, { media: m });
      outp[k] = c.toDataURL('image/png');
    }
    return outp;
  }, tid);
  for (const [k, d] of Object.entries(pages)) fs.writeFileSync(path.join(out, 'page-' + k + '.png'), Buffer.from(d.split(',')[1], 'base64'));

  /* phone width */
  await p.setViewportSize({ width: 412, height: 900 });
  await p.evaluate(() => App.go('series'));
  await p.waitForTimeout(500);
  await p.click('.ctnav [data-v="library"]');
  await shot('12-phone-library');
  await p.click('.ctnav [data-v="templates"]');
  await shot('13-phone-templates');

  console.log('errors:', errs.length ? errs : 'none');
  if (errs.length) process.exitCode = 1;
  await b.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
