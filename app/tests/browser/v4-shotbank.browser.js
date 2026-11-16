/* Browser test: Shots — This week, My shots, templates by place (shotbank.js,
   screens/shots-hub.js).

   - Library → Select → ▦ Make a template: "Gym 1" with a place.
   - Tools → Shots opens on This week; tabs This week · My shots · Core refs.
   - My shots: add your own shots (place, camera, tags, Anytime).
   - An episode's sequence: ＋ Template drops Gym 1 in; ticking My shots adds them.
   - From My shots: Assign to… an episode day as a new sequence.
   - This week: grouped by place; tick → ticked in the episode, "got" in My shots.
   - Linked: renaming a shot in My shots renames it in the episode.
   - A clip's beat: + Template or My shots; its shots keep their place.
   - Save as template on a sequence → a shot template with its place.
   - Core references list.

     node app/tests/browser/v4-shotbank.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
const FX = f => fs.readFileSync(path.join(__dirname, '..', 'fixtures', f)).toString('base64');
const S = '.screen:last-child';
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  try {
    await p.goto(url); await p.waitForFunction(() => window.App && window.ShotBank && window.MediaLib, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    const shotsOf = (vid, k) => p.evaluate(async ([v, k]) => { const e = await Store.get('vlogs', v); return e.acts[0].beats[k].shots; }, [vid, k]);

    head('Library → Make a template');
    const uids = await p.evaluate(async g => {
      const b64 = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
      await Shots.addLocation('Gym'); await Shots.addLocation('House');
      const r = await MediaLib.addFiles([new File([b64(g)], 'squat.gif', { type:'image/gif' }), new File([b64(g)], 'rack.gif', { type:'image/gif' }), new File([b64(g)], 'chalk.gif', { type:'image/gif' })], 'Gym refs', 'Saved');
      return r.added;
    }, FX('opener.gif'));
    await p.evaluate(() => App.go('series')); await p.waitForTimeout(400);
    await p.click('.ctnav [data-v="library"]'); await p.waitForTimeout(900);
    await p.click('[data-select]'); await p.waitForTimeout(400);
    for(const u of uids.slice(0, 2)) await p.click(`.lv-tile[data-uid="${u}"]`);
    ok(!!(await p.$('[data-sel="mktpl"]')), 'Select has ▦ Make a template');
    await p.click('[data-sel="mktpl"]'); await p.waitForTimeout(400);
    await p.fill('#mtName', 'Gym 1'); await p.selectOption('#mtPlace', 'Gym');
    await p.click('#sheet [data-ok]'); await p.waitForTimeout(800);
    const tpl = await p.evaluate(async () => (await ShotTemplates.all()).find(t => t.name === 'Gym 1'));
    ok(tpl && tpl.place === 'Gym' && tpl.shots.length === 2 && tpl.shots.every(s => s.item), 'it makes “Gym 1” — 2 shots with their frames, at the Gym', tpl && JSON.stringify([tpl.place, tpl.shots.length]));

    head('Tools → Shots');
    await p.evaluate(() => Screens.push('shots-console', {})); await p.waitForTimeout(900);
    const tabs = await p.$$eval('.console-nav .cbtn', x => x.map(e => e.textContent.trim()));
    ok(tabs.join('|') === 'This week|My shots|Core refs' && /This week/.test(await p.textContent('.screenbar h1')), 'it opens on This week; tabs This week · My shots · Core refs', tabs.join(' · '));
    await p.click('.console-nav [data-v="bank"]'); await p.waitForTimeout(800);
    ok(/Gym 1/.test(await p.textContent('.sbb-tpls')) && /📍 Gym/.test(await p.textContent('.sbb-tpls')), 'My shots lists the template with its place');
    /* your own shots */
    await p.click('[data-newshot]'); await p.waitForTimeout(500);
    await p.fill('#sbName', 'Bench — side'); await p.selectOption('#sbPlace', 'Gym');
    await p.click('#sheet [data-tag="Daily vlog"]'); await p.waitForTimeout(150);
    await p.fill('#sbNote', 'Phone on the floor stand, 0.5×');
    await p.click('#sheet [data-save]'); await p.waitForTimeout(600);
    await p.click('[data-newshot]'); await p.waitForTimeout(500);
    await p.fill('#sbName', 'Kitchen overhead'); await p.selectOption('#sbPlace', 'House'); await p.check('#sbAny');
    await p.click('#sheet [data-save]'); await p.waitForTimeout(600);
    const bank = await p.evaluate(() => ShotBank.all());
    ok(bank.length === 2 && bank.find(x => x.name === 'Bench — side').tags.includes('Daily vlog') && bank.find(x => x.name === 'Kitchen overhead').anytime, 'two of your own shots, with place, tags and Anytime', JSON.stringify(bank.map(x => [x.name, x.place])));
    ok((await p.$$('.sbb-card')).length === 2, 'they show as cards');
    await p.click('.mrail [data-pl="Gym"]'); await p.waitForTimeout(500);
    ok((await p.$$('.sbb-card')).length === 1 && (await p.$$('.sbb-tpl')).length === 1, 'Gym shows just the gym shot and template');
    await p.screenshot({ path: path.join(out, 'shotbank-myshots.png'), fullPage: true });

    head('an episode: ＋ Template on a sequence');
    const vid = await p.evaluate(async () => {
      const day = await Data.currentDay(), week = await Data.currentWeek();
      await Store.put('vlogs', { id:'v1', title:'Week 3', week, acts:[{ id:'a1', title:'Monday', day, beats:[{ id:'b1', title:'Workout', day, shots:[] }] }] });
      return 'v1';
    });
    await p.evaluate(() => Screens.push('vlog-day', { vlogId:'v1', actId:'a1' })); await p.waitForTimeout(1500);
    ok(!!(await p.$(`${S} [data-addtpl="b1"]`)), 'each sequence has ＋ Template');
    await p.click(`${S} [data-addtpl="b1"]`); await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(out, 'shotbank-pick.png') });
    await p.click(`#sheet [data-tpl="${tpl.id}"]`); await p.waitForTimeout(900);
    let sh = await shotsOf(vid, 0);
    ok(sh.length === 2 && sh.every(s => s.location === 'Gym' && s.item), 'Gym 1 drops in: 2 shots, frames and place', JSON.stringify(sh.map(s => s.location)));
    await p.click(`${S} [data-addtpl="b1"]`); await p.waitForTimeout(700);
    await p.check(`#sheet [data-bk="${bank.find(x => x.name === 'Bench — side').id}"]`);
    await p.click('#sheet [data-addbk]'); await p.waitForTimeout(900);
    sh = await shotsOf(vid, 0);
    const benchId = bank.find(x => x.name === 'Bench — side').id;
    ok(sh.length === 3 && sh[2].bank === benchId && sh[2].note === 'Phone on the floor stand, 0.5×', 'a ticked shot from My shots comes in linked, with its setup', JSON.stringify(sh[2]));
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(500);

    head('from My shots: Assign to…');
    await p.click('.mrail [data-pl=""]').catch(() => {}); await p.waitForTimeout(400);
    await p.click(`.sbb-tpl[data-tid="${tpl.id}"] [data-tassign]`); await p.waitForTimeout(500);
    await p.click('#sheet [data-v="v1"]'); await p.waitForTimeout(300);
    await p.click('#sheet [data-a="a1"]'); await p.waitForTimeout(300);
    await p.click('#sheet [data-new]'); await p.waitForTimeout(800);
    const beats = await p.evaluate(async () => (await Store.get('vlogs', 'v1')).acts[0].beats.map(b => [b.title, b.shots.length, b.day != null]));
    ok(beats.length === 2 && beats[1][0] === 'Gym 1' && beats[1][1] === 2 && beats[1][2], 'it lands as a new sequence “Gym 1” on Monday', JSON.stringify(beats));

    head('This week');
    await p.click('.console-nav [data-v="week"]'); await p.waitForTimeout(900);
    const groups = await p.$$eval('.sl-loc b', x => x.map(e => e.textContent.trim()));
    ok(groups.join('|') === '📍 Gym|📍 House', 'grouped by place: Gym, then House', groups.join(' · '));
    ok((await p.$$('.sbw-row')).length === 6 && /Anytime/.test(await p.textContent('.sbw-row:last-child')), '5 gym shots from the episode and the Anytime kitchen shot');
    await p.screenshot({ path: path.join(out, 'shotbank-week.png'), fullPage: true });
    const benchRow = await p.$$eval('.sbw-row', x => x.findIndex(e => /Bench — side/.test(e.textContent)));
    await p.click(`.sbw-row:nth-of-type(${benchRow + 1}) [data-tick]`).catch(async () => { await p.evaluate(i => document.querySelectorAll('.sbw-row')[i].querySelector('[data-tick]').click(), benchRow); });
    await p.waitForTimeout(900);
    sh = await shotsOf(vid, 0);
    const lastShot = await p.evaluate(id => ShotBank.get(id).then(b => b.lastShot), benchId);
    ok(sh[2].done && sh[2].doneAt && lastShot > 0, 'ticking it here ticks it in the episode, and My shots knows when', JSON.stringify([sh[2].done, !!lastShot]));
    ok((await p.$$('.sbw-row')).length === 5, 'it leaves To get');

    head('linked');
    await p.evaluate(async id => { const b = await ShotBank.get(id); b.name = 'Bench — side, low'; await ShotBank.save(b); }, benchId);
    sh = await shotsOf(vid, 0);
    ok(sh[2].text === 'Bench — side, low' && sh[2].done, 'renaming it in My shots renames it in the episode (its tick stays)');
    const use = await p.evaluate(async id => { const u = (await ShotBank.usage()).get(id); return { n:u.n, v:u.videos.size, last:u.last > 1 }; }, benchId);
    ok(use.n === 1 && use.v === 1 && use.last, 'My shots knows where it’s used and when it was got', JSON.stringify(use));

    head('a clip’s beat');
    const cid = await p.evaluate(async () => (await Data.saveClip({ title:'Leg day', state:'raw', stage:'idea', plan:{ tab:'plan' } })).id);
    await p.evaluate(id => Screens.push('clip', { id, tab:'plan' }), cid); await p.waitForTimeout(1800);
    ok(!!(await p.$(`${S} [data-sxtpl="1"]`)), 'each beat has + Template or My shots');
    await p.click(`${S} [data-sxtpl="1"]`); await p.waitForTimeout(700);
    await p.click(`#sheet [data-tpl="${tpl.id}"]`); await p.waitForTimeout(2200);
    const cl = await p.evaluate(async id => { const c = await Store.get('clips', id); return { list:(c.shotList || []).map(s => [s.text, s.location || '', s.beat]), subs:(c.subs || []).filter(x => x.shot != null).map(x => x.beat) }; }, cid);
    ok(cl.list.filter(x => x[1] === 'Gym').length === 2 && cl.subs.filter(x => x === 1).length >= 3, 'Gym 1’s shots land in the Middle beat, with their place', JSON.stringify(cl));
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(400);

    head('Save as template');
    await p.evaluate(() => Screens.push('vlog-day', { vlogId:'v1', actId:'a1' })); await p.waitForTimeout(1500);
    await p.click(`${S} [data-keep="b1"]`); await p.waitForTimeout(800);
    const saved = await p.evaluate(async () => (await ShotTemplates.all()).find(t => t.name === 'Workout'));
    ok(saved && saved.place === 'Gym' && saved.shots.length === 3 && saved.shots.filter(s => s.item).length === 2, 'a sequence saved as a template keeps its frames and place', saved && JSON.stringify([saved.place, saved.shots.length]));
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(400);

    head('Core references');
    await p.evaluate(() => Store.put('settings', [{ title:'Casey’s opener', url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ', start:10, end:30 }], 'core-refs'));
    await p.click('.console-nav [data-v="core"]'); await p.waitForTimeout(700);
    ok(/Casey’s opener/.test(await p.textContent('.sbc-item')) && /0:10 – 0:30/.test(await p.textContent('.sbc-item')), 'it lists the core reference and its section');

    head('phone size');
    await p.setViewportSize({ width: 412, height: 915 });
    await p.click('.console-nav [data-v="week"]'); await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(out, 'shotbank-week-phone.png'), fullPage: true });
    const wide = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    ok(wide, 'This week fits the phone (no sideways scroll)');
  } catch(e){ ok(false, 'ran to the end', e.message); }
  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
