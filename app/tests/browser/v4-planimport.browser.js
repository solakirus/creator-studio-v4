/* Browser test: a plan written in chat, imported into the Planner, refined,
   and pasted back. Import plan on the Planner's sidebar takes a pasted code
   block; new videos come in with their shots; a plan pasted again updates
   the same videos (by id, or title in its series) — except one you've
   changed in the app, which waits for a tick. Copy my plan for Claude gives
   the plan back as the same format.

     node app/tests/browser/v4-planimport.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = t => console.log('\n— ' + t + ' —');

const PLAN = {
  format: 'creator-studio-plan', plan: 'Cinematic shorts, batch 1',
  series: [{ id: 'cin-everyday', channel: 'Kris Catten', name: 'Cinematic Everyday' }],
  videos: [
    { id: 'ce-01', series: 'Cinematic Everyday', seriesId: 'cin-everyday', channel: 'Kris Catten', order: 1, platform: 'instagram',
      title: 'Morning coffee, shot like a film', hook: 'You make coffee every day. Make it look like this.',
      idea: 'Handheld, natural window light, 6 shots.',
      shots: [{ text: 'Window light on the counter', framing: 'Wide', movement: 'Static' },
              { text: 'Grinder close-up', framing: 'Close-up', lines: [{ k: 'vo', t: 'Every day starts the same.' }] },
              'Pour over, top down'] },
    { id: 'ce-02', series: 'Cinematic Everyday', seriesId: 'cin-everyday', channel: 'Kris Catten', order: 2,
      title: 'Packing a bag at sunset', hook: 'Five minutes, one window.', day: '2026-11-20',
      shots: ['Bag on the bed', 'Hands folding a shirt'] }
  ]
};
const chat = obj => 'Here is the plan:\n\n```json\n' + JSON.stringify(obj, null, 2) + '\n```\n\nPaste it into Import plan.';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/') + '?planner');
  await p.waitForFunction(() => window.App && window.PlanImport, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  const vids = () => p.evaluate(async () => (await Videos.all()).filter(v => /^ce-/.test(v.id)).sort((a, b) => a.id.localeCompare(b.id)));
  const importText = async (text, tick) => {
    await p.click('.tabbar [data-import]'); await p.waitForTimeout(400);
    await p.fill('#pi-text', text); await p.click('[data-pi-next]'); await p.waitForTimeout(700);
    if(tick) await tick();
  };

  head('a plan from chat, pasted in');
  ok(await p.isVisible('.tabbar [data-import]'), 'Import plan sits on the Planner\'s sidebar, above Send to phone',
    await p.$$eval('.tabbar .tab', x => x.map(e => e.getAttribute('aria-label')).join(' · ')));
  await importText(chat(PLAN));
  const sheet = await p.textContent('#sheet');
  ok(/2 new · 0 to update/.test(sheet) && /Morning coffee, shot like a film · 3 shots/.test(sheet), 'the preview lists the new videos and their shots');
  ok(/Import 1 series, 2 videos/.test(await p.textContent('[data-go]')), 'and the button says what it will do', await p.textContent('[data-go]'));
  await p.screenshot({ path: path.join(out, 'planimport-preview.png') });
  await p.click('[data-go]'); await p.waitForTimeout(900);
  let v = await vids();
  ok(v.length === 2 && v[0].hook === PLAN.videos[0].hook && v[0].plat === 'instagram', 'both videos are in, with their hooks and platform');
  ok(v[0].shotList.length === 3 && v[0].shotList[0].framing === 'Wide' && v[0].shotList[1].lines[0].t === 'Every day starts the same.', 'with their shots: framing, movement, the line said over it');
  ok(v[1].day === '2026-11-20' && v[1].stage === 'planned' && !!v[1].taskId, 'a shoot day puts it on that day, planned');
  ok(v.every(x => x.imported && x.imported.sig), 'each remembers how it came in');
  const series = await p.evaluate(async () => (await Data.series()).find(s => s.id === 'cin-everyday'));
  ok(series && series.title === 'Cinematic Everyday' && v.every(x => x.seriesId === 'cin-everyday'), 'inside their series');

  head('refined in the app, then a refined plan pasted back');
  /* a frame put on a shot, and video 2's hook changed by hand */
  await p.evaluate(async () => {
    const a = await Videos.get('ce-01'); a.shotList[1].item = 'frame:abc'; a.shotList[1].done = true; await Store.put('videos', a);
    const b = await Videos.get('ce-02'); await Videos.save({ ...b, hook: 'My own hook' });
  });
  /* ticking a shot through its steps (as the day screen does) isn't "changing" it */
  await p.evaluate(async () => { const h = ShotList.hostVideo ? ShotList.hostVideo('ce-01') : null; if(h){ const t = await h.load(); if(t.subs[0]) t.subs[0].done = true; await h.save(t); } });
  const P2 = JSON.parse(JSON.stringify(PLAN));
  P2.videos[0].hook = 'Your coffee, but cinematic.';
  P2.videos[0].shots.splice(2, 0, 'Steam in the backlight');
  P2.videos[1].hook = 'Pack light, shoot slow.';
  P2.videos.push({ title: 'Night walk, one lens', series: 'Cinematic Everyday', channel: 'Kris Catten', order: 3, shots: ['Street lamp wide'] });
  await importText(chat(P2));
  const s2 = await p.textContent('#sheet');
  ok(/1 new · 2 to update/.test(s2), 'one new, two to update', (/\d+ new · \d+ to update · \d+ unchanged/.exec(s2) || [])[0]);
  ok(/Morning coffee, shot like a film — hook, shots/.test(s2), 'each update says what changes');
  ok(await p.$eval('[data-pi-up="0"]', e => e.checked) && !(await p.$eval('[data-pi-up="1"]', e => e.checked)) && /changed this one in the app/.test(s2),
    'the one you changed here is left unticked, and says why');
  ok(/Import 1 video, update 1/.test(await p.textContent('[data-go]')), 'so the button updates only the other', await p.textContent('[data-go]'));
  await p.screenshot({ path: path.join(out, 'planimport-update.png') });
  await p.click('[data-go]'); await p.waitForTimeout(900);
  v = await vids();
  const a = v.find(x => x.id === 'ce-01'), b2 = v.find(x => x.id === 'ce-02');
  ok(a.hook === 'Your coffee, but cinematic.' && a.shotList.length === 4 && a.shotList[2].text === 'Steam in the backlight', 'video 1 has the new hook and the added shot');
  ok(a.shotList[1].item === 'frame:abc' && a.shotList[1].done, 'a shot that stayed keeps its frame and its tick');
  ok(b2.hook === 'My own hook', 'video 2 keeps your hook');
  ok((await p.evaluate(async () => (await Videos.all()).filter(v => v.title === 'Night walk, one lens' && v.seriesId === 'cin-everyday').length)) === 1, 'the new one joins the series');

  head('ticking the changed one replaces it');
  await importText(chat(P2), async () => { await p.click('[data-pi-up="0"]'); await p.waitForTimeout(150); });
  ok(/update 1/.test(await p.textContent('[data-go]')), 'ticked, it is included');
  await p.click('[data-go]'); await p.waitForTimeout(900);
  ok((await vids()).find(x => x.id === 'ce-02').hook === 'Pack light, shoot slow.', 'and takes the plan\'s hook');

  head('copy my plan for Claude, and back');
  await p.click('.tabbar [data-import]'); await p.waitForTimeout(400);
  await p.click('[data-pi-copy]'); await p.waitForTimeout(400);
  let copied = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  if(!copied) copied = await p.inputValue('#pi-text');
  let ex = null; try { ex = JSON.parse(copied); } catch(e){}
  ok(ex && /creator-studio/.test(ex.format) && ex.videos.some(x => x.id === 'ce-01' && x.shots.length === 4), 'it copies the plan, ids and shots included', copied.slice(0, 60));
  ok(ex && ex.videos.find(x => x.id === 'ce-01').shots[0].framing === 'Wide', 'shots keep their framing');
  await p.fill('#pi-text', copied); await p.click('[data-pi-next]'); await p.waitForTimeout(700);
  ok(/0 new · 0 to update/.test(await p.textContent('#sheet')), 'pasted straight back, nothing changes', (/\d+ new · \d+ to update · \d+ unchanged/.exec(await p.textContent('#sheet')) || [])[0]);
  await p.click('[data-cancel]'); await p.waitForTimeout(200);

  head('what gets pasted');
  ok(await p.evaluate(() => { try { PlanImport.parseAny('Sure! ' + JSON.stringify({ videos: [{ title: 'x' }] }) + ' Enjoy.'); return true; } catch(e){ return false; } }),
    'words around the JSON are fine');
  ok(await p.evaluate(() => { try { PlanImport.parseAny('nothing here'); return false; } catch(e){ return true; } }), 'something that isn\'t a plan says so');

  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
