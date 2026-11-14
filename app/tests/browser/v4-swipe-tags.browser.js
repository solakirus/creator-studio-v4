/* Browser test: your own swipe tags, filters and smart views (swipetags.js,
   screens/swipe.js) — phone and laptop, and tags made on two devices at once.

     node app/tests/browser/v4-swipe-tags.browser.js [outDir] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const hubMod = require('../helpers/mini-synchub');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const hub = await hubMod.start({ token: 'tok' });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  const device = async (name, w) => {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: w < 600 });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    p.on('dialog', d => d.accept(p.__answer || ''));
    await p.goto(url); await p.waitForFunction(() => window.App && window.SwipeTags && window.Sync, null, { timeout: 15000 });
    await p.waitForTimeout(500); return p;
  };
  const swipeFile = async p => { await p.evaluate(() => App.go('series')); await p.waitForTimeout(600); await p.click('.ctnav [data-v="swipe"]'); await p.waitForTimeout(800); };
  const cards = p => p.evaluate(() => [...document.querySelectorAll('.swipecard h3')].map(h => h.textContent.trim()).sort().join(' | '));

  const PH = await device('phone', 400);
  await PH.evaluate(async () => {
    const day = 86400000, now = Date.now();
    const mk = (id, title, extra) => Store.put('swipes', { id, title, url:'https://example.com/' + id, source:'reel', createdAt:now, ...extra });
    await mk('a', 'Cold open hook', { myAngle:'' });
    await mk('b', 'Garden time-lapse', { myAngle:'Do it with the truck', source:'tiktok' });
    await mk('c', 'Old talking head', { savedAt: now - 120 * day });
    await mk('d', 'Voiceover edit', { myAngle:'Mine' });
  });

  head('the old filters are gone; your tags are there');
  await swipeFile(PH);
  ok(!(await PH.$('#f-intent')) && !(await PH.$('#f-channel')) && !(await PH.$('#f-target')), 'no intent, channel or target filters');
  ok(!!(await PH.$('[data-a="filters"]')) && !!(await PH.$('[data-sv=""]')), 'a Filter button and an All view instead');
  const g = await PH.evaluate(async () => (await SwipeTags.all()).map(x => x.name + ':' + x.tags.length).join(', '));
  ok(g === 'Use it for:5, Vibe:3, Format:3', 'starter groups to change or delete', g);
  ok((await PH.evaluate(() => Store.get('settings', 'swipe-tags'))) === undefined, 'the starters are not saved until you change them');

  head('editing your tags');
  await PH.click('[data-a="filters"]'); await PH.waitForTimeout(300);
  await PH.click('#sheet [data-fedit]'); await PH.waitForTimeout(400);
  await PH.fill('#stg-newgroup', 'Hook type'); await PH.click('#sheet [data-gadd]'); await PH.waitForTimeout(300);
  const hid = await PH.evaluate(async () => (await SwipeTags.all()).find(x => x.name === 'Hook type').id);
  await PH.fill(`[data-tnew="${hid}"]`, 'Question'); await PH.press(`[data-tnew="${hid}"]`, 'Enter'); await PH.waitForTimeout(300);
  await PH.fill(`[data-tnew="${hid}"]`, 'Shock'); await PH.click(`[data-tadd="${hid}"]`); await PH.waitForTimeout(300);
  const vibe = await PH.evaluate(async () => (await SwipeTags.all()).find(x => x.name === 'Vibe'));
  await PH.fill(`[data-tname="${vibe.tags[0].id}"]`, 'Hilarious'); await PH.press(`[data-tname="${vibe.tags[0].id}"]`, 'Tab'); await PH.waitForTimeout(300);
  await PH.click(`[data-tcolor="${vibe.tags[1].id}"]`); await PH.waitForTimeout(200);
  const fmt = await PH.evaluate(async () => (await SwipeTags.all()).find(x => x.name === 'Format').id);
  await PH.click(`[data-gdel="${fmt}"]`); await PH.waitForTimeout(300);
  await PH.screenshot({ path: path.join(out, 'swipetags-edit-phone.png') });
  const after = await PH.evaluate(async () => (await SwipeTags.all()).map(x => x.name + ':' + x.tags.map(t => t.name).join('/')).join(' ; '));
  ok(/Hook type:Question\/Shock/.test(after) && /Vibe:Hilarious\/Cinematic/.test(after) && !/Format/.test(after),
    'a new group with two tags, a tag renamed, a group deleted', after);
  ok(Array.isArray(await PH.evaluate(() => Store.get('settings', 'swipe-tags'))), 'and now they are saved (and sync)');
  await PH.click('#sheet [data-tdone]'); await PH.waitForTimeout(500);
  await PH.evaluate(() => App.closeSheet()); await PH.waitForTimeout(300);

  head('tagging');
  const T = await PH.evaluate(async () => { const m = await SwipeTags.byId(); const by = n => Object.values(m).find(x => x.tag.name === n).tag.id;
    return { hook: by('Hook'), q: by('Question'), cin: by('Cinematic') }; });
  await PH.evaluate(() => Screens.push('swipe', { id:'a' })); await PH.waitForTimeout(700);
  ok(/Tags/.test(await PH.textContent('#screens')) && !!(await PH.$(`[data-stag="${T.hook}"]`)), 'a swipe has a Tags section with your tags');
  ok(!(await PH.$eval('details.stg-old', d => d.open)), 'intent, channels and platforms are folded away');
  await PH.click(`[data-stag="${T.hook}"]`); await PH.waitForTimeout(300);
  await PH.click(`[data-stag="${T.q}"]`); await PH.waitForTimeout(300);
  await PH.screenshot({ path: path.join(out, 'swipetags-swipe-phone.png') });
  ok((await PH.evaluate(async () => (await Store.get('swipes', 'a')).tagIds.length)) === 2, 'tapping tags puts them on the swipe');
  await PH.evaluate(() => Screens.pop()); await PH.waitForTimeout(500);
  /* many at once, from the selection bar */
  const n = await PH.evaluate(async t => SwipeTags.apply(['b', 'd'], t, true), T.cin);
  ok(n === 2, 'Tag… puts a tag on many at once');
  await swipeFile(PH);
  ok(/Hook/.test(await PH.textContent('.swipecard[data-open="a"]')), 'a card shows its tags');

  head('filters and smart views');
  await PH.click('[data-a="filters"]'); await PH.waitForTimeout(300);
  await PH.click(`#sheet [data-ft="${T.cin}"]`); await PH.waitForTimeout(200);
  ok(/Show 2 swipes/.test(await PH.textContent('#sheet [data-fgo]')), 'the sheet counts as you pick');
  await PH.click('#sheet [data-fa="has"]'); await PH.waitForTimeout(200);
  await PH.screenshot({ path: path.join(out, 'swipetags-filter-phone.png') });
  await PH.click('#sheet [data-fgo]'); await PH.waitForTimeout(500);
  ok(await cards(PH) === 'Garden time-lapse | Voiceover edit', 'Cinematic + has my angle', await cards(PH));
  ok(/Cinematic/.test(await PH.textContent('.stg-active')) && /Has my angle/.test(await PH.textContent('.stg-active')), 'what is filtering shows as chips');
  PH.__answer = 'Cinematic with an angle';
  await PH.click('[data-a="saveview"]'); await PH.waitForTimeout(500);
  ok(!!(await PH.$('.stg-bar [data-sv]:not([data-sv=""])')), 'saved as a one-tap view');
  await PH.click(`[data-unf="angle"]`); await PH.waitForTimeout(300);
  ok(await cards(PH) === 'Garden time-lapse | Voiceover edit', 'removing a chip widens it again');
  await PH.click('[data-sv=""]'); await PH.waitForTimeout(300);
  ok((await cards(PH)).split(' | ').length === 4, 'All shows everything');
  /* conditions without tags */
  await PH.evaluate(() => { document.querySelector('[data-a="filters"]').click(); });
  await PH.waitForTimeout(300);
  await PH.click('#sheet [data-fa="none"]'); await PH.click('#sheet [data-fw="older"]'); await PH.click('#sheet [data-fgo]'); await PH.waitForTimeout(400);
  ok(await cards(PH) === 'Old talking head', 'no angle yet + saved over 3 months ago', await cards(PH));
  const sv = await PH.evaluate(async () => (await SwipeTags.views())[0].id);
  await PH.click(`[data-sv="${sv}"]`); await PH.waitForTimeout(300);
  ok(await cards(PH) === 'Garden time-lapse | Voiceover edit', 'the saved view brings its filters back');
  await PH.fill('#q', ''); await PH.click('[data-sv=""]'); await PH.waitForTimeout(300);
  await PH.fill('#q', 'question'); await PH.waitForTimeout(400);
  ok(await cards(PH) === 'Cold open hook', 'search finds a swipe by its tag', await cards(PH));

  head('on the laptop');
  const LAP = await device('laptop', 1440);
  await LAP.evaluate(async () => { for(let i = 0; i < 6; i++) await Store.put('swipes', { id:'l' + i, title:'Laptop swipe ' + i, url:'https://example.com/l' + i, source:'reel', createdAt:Date.now() }); });
  await swipeFile(LAP);
  await LAP.click('[data-a="filters"]'); await LAP.waitForTimeout(300);
  await LAP.screenshot({ path: path.join(out, 'swipetags-filter-laptop.png') });
  ok(!!(await LAP.$('#sheet [data-ft]')), 'the same filters on the laptop');
  await LAP.evaluate(() => App.closeSheet());

  head('tags made on two devices at once');
  await PH.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url);
  await LAP.evaluate(h => Sync.connect(h, 'tok', 'merge'), hub.url);
  await PH.evaluate(() => Sync.setPaused(true)); await LAP.evaluate(() => Sync.setPaused(true));
  await PH.evaluate(async () => { const g = (await SwipeTags.all()).find(x => x.name === 'Vibe'); await SwipeTags.addTag(g.id, 'Calm'); });
  await LAP.evaluate(async () => { const g = (await SwipeTags.all()).find(x => x.name === 'Vibe'); await SwipeTags.addTag(g.id, 'Hype'); });
  for(let i = 0; i < 2; i++) for(const d of [PH, LAP]){ await d.evaluate(() => Sync.setPaused(false)); await d.evaluate(() => Sync.syncNow()); }
  const vibes = await Promise.all([PH, LAP].map(d => d.evaluate(async () => { SwipeTags.invalidate(); return (await SwipeTags.all()).find(x => x.name === 'Vibe').tags.map(t => t.name).sort().join(','); })));
  ok(vibes.every(v => v === 'Calm,Cinematic,Hilarious,Hype,Motivational'), 'both new tags on both devices', vibes.join(' / '));

  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close(); await hub.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
