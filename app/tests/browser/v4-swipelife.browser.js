/* Browser test: the swipe file's Life area groups, transition swipes on the
   Transitions tab, and Make it a habit.

     node app/tests/browser/v4-swipelife.browser.js [outDir] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
const top = '.screen:last-child';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  for(const [w, h, name] of [[1440, 900, 'laptop'], [400, 860, 'phone']]){
    console.log(`\n— ${name} —`);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 600 });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('dialog', d => d.accept());
    await p.goto(url); await p.waitForFunction(() => window.App && window.SwipeTags && window.Habits, null, { timeout: 15000 });
    await p.waitForTimeout(800);

    /* a device that never saved a list: the new groups, the old starters kept */
    let g = await p.evaluate(async () => { SwipeTags.invalidate(); return (await SwipeTags.all()).map(x => x.name + ':' + x.tags.map(t => t.name).join('/')); });
    ok(/^Life area:Creator\/Craft\/Fitness\/Family\/Mindset\/Home & Garden$/.test(g[0]) && g.slice(0, 6).map(x => x.split(':')[0]).join() === 'Life area,Use it for,For which,Technique,Routine,Status',
      'Life area first, with Home & Garden, then the other groups', g[0]);
    ok(g.some(x => /^Vibe:/.test(x)) && /Primer/.test(g[1]) && /Transition/.test(g[1]), 'the old starters stay (a swipe tagged with one keeps it)');

    /* a device with its own list: upgraded once, your groups kept, a deleted tag stays deleted */
    g = await p.evaluate(async () => {
      await Store.put('settings', [{ id:'tg_mine', name:'Gear', tags:[{ id:'t_lens', name:'Lens', color:'#E8853A' }] }], 'swipe-tags');
      await Store.del('settings', 'swipe-tags-v2');
      SwipeTags.invalidate(); const a = await SwipeTags.all();
      const la = a.find(x => x.name === 'Life area'); await SwipeTags.removeTag(la.tags.find(t => t.name === 'Mindset').id);
      SwipeTags.invalidate(); const b2 = await SwipeTags.all();
      return { names:b2.map(x => x.name), la:b2[0].tags.map(t => t.name), flag:await Store.get('settings', 'swipe-tags-v2') };
    });
    ok(g.names[0] === 'Life area' && g.names.includes('Gear') && g.flag === true, 'a saved list gets the new groups once, its own groups kept', g.names.join(', '));
    ok(!g.la.includes('Mindset'), 'and a tag you delete afterwards stays deleted', g.la.join('/'));

    /* swipes: one on how to do a transition, one stretching routine */
    await p.evaluate(async () => {
      const by = await SwipeTags.byId(); const find = (gn, tn) => Object.keys(by).find(id => by[id].group.name === gn && by[id].tag.name === tn);
      await Store.put('swipes', { id:'sw_tr', title:'How to do a whip pan', source:'reel', url:'', hook:'Snap the camera, blur, land', tagIds:[find('Life area', 'Craft'), find('Technique', 'Transition')], savedAt:Date.now() });
      await Store.put('swipes', { id:'sw_st', title:'10-minute hip opener', source:'reel', url:'', tagIds:[find('Life area', 'Fitness'), find('Routine', 'Stretch & mobility')], savedAt:Date.now() });
      await Store.put('swipes', { id:'sw_x', title:'A thumbnail idea', source:'reel', url:'', tagIds:[find('Use it for', 'Thumbnail')], savedAt:Date.now() });
    });

    /* the swipe file: show only what still needs a tag */
    await p.evaluate(async () => { await Store.put('swipes', { id:'sw_none', title:'Never sorted', source:'reel', url:'', tagIds:[], savedAt:Date.now() });
      localStorage.removeItem('cs4-swipe-filter'); Screens.push('swipe-file'); });
    await p.waitForTimeout(1800);
    const ids = () => p.$$eval(`${top} .swipecard[data-open]`, xs => xs.map(x => x.dataset.open).sort().join());
    ok(/No tags yet · 1/.test(await p.textContent(`${top} [data-a="untagged"]`)), 'a 🏷 No tags yet button, counting the swipes with none');
    await p.click(`${top} [data-a="untagged"]`); await p.waitForTimeout(900);
    ok(await ids() === 'sw_none', 'it shows only those', await ids());
    await p.click(`${top} [data-a="untagged"]`); await p.waitForTimeout(900);
    const la = await p.evaluate(async () => (await SwipeTags.all()).find(x => x.name === 'Life area'));
    await p.selectOption(`${top} [data-fg="${la.id}"]`, '__none'); await p.waitForTimeout(900);
    ok(await ids() === 'sw_none,sw_x', 'a group’s “No Life area tag yet” shows the swipes with nothing from it', await ids());
    const fit = la.tags.find(t => t.name === 'Fitness').id;
    await p.selectOption(`${top} [data-fg="${la.id}"]`, 'not:' + fit); await p.waitForTimeout(900);
    ok(await ids() === 'sw_none,sw_tr,sw_x', '“Without Fitness” leaves out the swipes tagged Fitness', await ids());
    await p.screenshot({ path: path.join(out, `untagged-${name}.png`) });
    await p.click(`${top} [data-a="clearf"]`).catch(() => {}); await p.waitForTimeout(600);
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(500);

    /* Transitions: its own section for your transition swipes */
    await p.evaluate(() => Screens.push('transitions')); await p.waitForTimeout(1500);
    ok(/My swipes\s*1/.test(await p.textContent(`${top} [data-p="swipes"]`)), 'the Transitions tab has a ✂ My swipes section, counting 1');
    await p.click(`${top} [data-p="swipes"]`); await p.waitForTimeout(900);
    const cards = await p.$$eval(`${top} .trs-sw b`, xs => xs.map(x => x.textContent));
    ok(cards.length === 1 && cards[0] === 'How to do a whip pan', 'it lists only the swipes tagged Transition', JSON.stringify(cards));
    await p.screenshot({ path: path.join(out, `trswipes-${name}.png`) });
    await p.click(`${top} [data-swopen="sw_tr"]`); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => document.querySelector('.screen:last-child').dataset.screen) === 'swipe', 'tapping one opens the swipe');
    await p.evaluate(() => { Screens.pop(); Screens.pop(); }); await p.waitForTimeout(500);
    await p.evaluate(() => localStorage.setItem('cs4-tr-pick', 'all'));

    /* Make it a habit */
    await p.evaluate(() => Screens.push('swipe', { id:'sw_st' })); await p.waitForTimeout(1500);
    ok(/Make it a habit/.test(await p.textContent(`${top} [data-a="mkhabit"]`)), 'a swipe has ＋ Make it a habit');
    await p.click(`${top} [data-a="mkhabit"]`); await p.waitForTimeout(600);
    await p.click('#sheet [data-often="weekdays"]'); await p.fill('#sheet [data-htime]', '06:15');
    await p.click('#sheet [data-hok]'); await p.waitForTimeout(1800);
    const hb = await p.evaluate(async () => { const s = await Store.get('swipes', 'sw_st'); const h = await Habits.get(s.habitId);
      const ts = (await Store.all('tasks')).values.filter(t => t.habitId === h.id); return { h, n:ts.length, sw:ts.every(t => (t.swipeIds || []).includes('sw_st')) }; });
    ok(hb.h && hb.h.name === '10-minute hip opener' && hb.h.swipeId === 'sw_st' && hb.h.days.join() === '1,2,3,4,5' && hb.h.at === '06:15' && hb.h.group === 'Body',
      'it makes a habit: the swipe’s name, weekdays, 6:15, under Body', JSON.stringify(hb.h && [hb.h.name, hb.h.days, hb.h.at, hb.h.group]));
    ok(hb.n > 0 && hb.sw, 'its to-do tasks carry the video', `${hb.n} tasks`);
    ok(/✓ Habit · 10-minute hip opener/.test(await p.textContent(`${top} [data-a="habitopen"]`)), 'the swipe now shows ✓ Habit');
    await p.screenshot({ path: path.join(out, `swipehabit-${name}.png`) });
    await ctx.close();
  }
  await b.close();
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
