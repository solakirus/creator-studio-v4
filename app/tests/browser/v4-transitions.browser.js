/* Browser test: Content → Transitions (transitions.js, screens/transitions.js)
   — Eyecandy's techniques read on the laptop (the grabber's scan, stood in
   for), watched in the pop-out, kept, assigned between two shots; hidden on
   the shot page until asked for; shown in the Edit tab's cut list.

     node app/tests/browser/v4-transitions.browser.js [outDir] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
const PIC = process.env.TR_PIC || '/tmp/trt/a.webp';
const top = '.screen:last-child';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  for(const [w, h, name] of [[1440, 900, 'laptop'], [400, 860, 'phone']]){
    console.log(`\n— ${name} —`);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 600 });
    await ctx.route(/asset\.eyecannndy\.com\/media\/clip\/.*broken/, r => r.fulfill({ status: 404, body: '' }));
    await ctx.route(/asset\.eyecannndy\.com\/media\/clip\/(?!.*broken)/, r => r.fulfill({ contentType: 'image/webp', body: fs.readFileSync(PIC) }));
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    /* the laptop's grabber: a scan of a technique page sends its links, then done */
    if(name === 'laptop') await p.addInitScript(() => {
      const L = { link: new Set(), line: new Set(), done: new Set() };
      window.__scans = [];
      window.CS3Lib = { onGrab: (k, cb) => { L[k].add(cb); return () => L[k].delete(cb); }, grabStop: async () => {},
        grabRun: async o => {
          window.__scans.push(o);
          const u = new URL(o.url), slug = u.pathname.split('/').pop(), pg = +(u.searchParams.get('page') || 1);
          /* page 1 shows 1–3 and (scrolled) 4–5; ?page=2 has 4–5 again plus 6; ?page=3 has 7; ?page=4 nothing */
          const nums = { 1: [1, 2, 3, 4, 5], 2: [4, 5, 6], 3: [7] }[pg] || [];
          setTimeout(() => {
            L.line.forEach(cb => cb('  found 3 thumbnails'));
            nums.forEach(n => L.link.forEach(cb => cb({ url: `https://asset.eyecannndy.com/media/clip/2024/02/28/${slug}-${n}.webp`, title: `${slug} clip ${n}`, kind: 'gif' })));
            L.link.forEach(cb => cb({ url: 'https://eyecannndy.com/technique/aerial', title: 'Aerial', kind: 'page' }));
            L.link.forEach(cb => cb({ url: 'https://asset.eyecannndy.com/static/images/logo.webp', title: '', kind: 'gif' }));
            L.done.forEach(cb => cb({ code: 0 }));
          }, 60);
          return { ok: true, builtin: true };
        } };
    });
    await p.goto(url); await p.waitForFunction(() => window.App && window.Transitions && window.ShotList, null, { timeout: 15000 });
    await p.waitForTimeout(900);
    const cid = await p.evaluate(async () => (await Data.saveClip({ title: 'Morning ritual', state: 'raw', stage: 'planned',
      shotList: [{ text: 'Alarm' }, { text: 'Coffee pour' }, { text: 'Out the door' }, { text: 'Drive' }] })).id);
    if(name === 'phone') await p.evaluate(async () => {
      for(const n of [1, 2]) await Store.put('transitions', { id: 'ec_ph' + n, img: `https://asset.eyecannndy.com/media/clip/x/ph${n}.webp`, title: 'Phone ' + n, tech: ['whip-pan'], page: 'https://eyecannndy.com/technique/whip-pan', at: n });
      await Store.put('transitions', { id: 'ec_bad', img: 'https://asset.eyecannndy.com/media/clip/x/broken.webp', title: 'Broken one', tech: ['whip-pan'], at: 3 });
    });

    await p.evaluate(() => App.go('series')); await p.waitForSelector('.ctnav [data-v="transitions"]'); await p.waitForTimeout(400);
    const tabs = await p.$$eval('.ctnav [data-v]', x => x.map(y => y.dataset.v));
    ok(tabs.indexOf('transitions') === tabs.indexOf('swipe') + 1 && !tabs.includes('boards'), 'Transitions sits next to Swipe; Boards is gone', tabs.join(', '));
    await p.click('.ctnav [data-v="transitions"]'); await p.waitForSelector('#trHost .trs-pills'); await p.waitForTimeout(300);
    const groups = await p.$$eval('#trHost [data-type] option', x => x.map(y => y.textContent.trim()));
    ok(groups.length === 5 && /^Transitions & cuts/.test(groups[1]), 'the starter techniques sit in their types', groups.join(' | '));
    ok((await p.$$('#trHost .trs-top > button')).length === 3 && !!(await p.$('#trHost .trs-search')) && !!(await p.$('#trHost [data-p="swipes"]')), 'the top row is search, Kept, All and My swipes');
    ok(await p.$eval('#trHost [data-tech]', x => x.disabled), 'the technique drop-down waits for a type');
    await p.selectOption('#trHost [data-type]', 'cuts'); await p.waitForTimeout(300);
    const pills = await p.$$eval('#trHost [data-tech] option', x => x.map(y => y.textContent.trim()));
    ok(pills.some(x => /^Crash cut/.test(x)) && pills.some(x => /^Whip pan/.test(x)) && pills.length < 20, 'a type fills the second drop-down with just its techniques', pills.slice(0, 4).join(' | '));

    if(name === 'laptop'){
      await p.selectOption('#trHost [data-tech]', 'crash-transition'); await p.waitForTimeout(300);
      ok(/Read from Eyecandy/.test(await p.textContent('#trHost .trs-bar')), 'a technique not read yet offers Read from Eyecandy');
      await p.click('#trHost [data-a="read"]'); await p.waitForFunction(() => document.querySelectorAll('#trHost .trs-cell').length === 7, null, { timeout: 8000 }).catch(() => {});
      const scans = await p.evaluate(() => window.__scans);
      ok(scans.every(x => x.mode === 'scan') && /eyecannndy\.com\/technique\/crash-transition$/.test(scans[0].url), 'reads with the grabber’s scan (links only, no download)', scans.map(x => x.url.split('/').pop()).join(', '));
      ok(scans.length === 4 && /\?page=3$/.test(scans[2].url), 'goes through every page by itself, stopping at the first empty one');
      const recs = await p.evaluate(() => Transitions.all());
      ok(recs.length === 7 && recs.every(r => r.tech[0] === 'crash-transition' && /^ec_crash-transition-\d$/.test(r.id)), 'keeps all 7 clips, drops the page link and the logo', recs.map(r => r.id).join(','));
      await p.click('#trHost [data-a="read"]'); await p.waitForTimeout(1200);
      ok((await p.evaluate(() => Transitions.all())).length === 7, 'reading again adds no doubles');
      await p.waitForTimeout(800);
      const still = await p.evaluate(() => [...document.querySelectorAll('#trHost .trs-cell')].map(c => { const im = c.querySelector('img');
        return c.querySelector('canvas.trs-cv') ? 'canvas' : im && /^data:image\/jpeg/.test(im.getAttribute('src') || '') ? 'still' : im && im.getAttribute('src') ? 'moving' : 'none'; }));
      ok(still.every(x => x === 'canvas' || x === 'still'), 'the grid shows stills by default, nothing animating', still.join(','));
      ok(/Play all/.test(await p.textContent('#trHost [data-a="move"]')), 'with a Play all button');
      const live = sel => p.evaluate(s => { const im = document.querySelector(s + ' img'); return /asset\.eyecannndy/.test(im.getAttribute('src') || '') && !im.hidden; }, sel);
      await p.hover('#trHost .trs-cell:nth-child(2)'); await p.waitForTimeout(300);
      ok(await live('#trHost .trs-cell:nth-child(2)') && !(await live('#trHost .trs-cell:nth-child(1)')), 'hovering a still plays just that one');
      await p.mouse.move(5, 5); await p.waitForTimeout(300);
      ok(!(await live('#trHost .trs-cell:nth-child(2)')), 'moving off puts the still back');
      await p.click('#trHost [data-a="move"]'); await p.waitForTimeout(700);
      const mv = await p.evaluate(() => [...document.querySelectorAll('#trHost .trs-cell img')].filter(im => /asset\.eyecannndy/.test(im.getAttribute('src') || '')).length);
      ok(mv >= 1 && /Stop all/.test(await p.textContent('#trHost [data-a="move"]')), 'Play all animates the ones on screen; the button becomes Stop all', mv);
      await p.click('#trHost [data-a="move"]'); await p.waitForTimeout(900);
      ok(await p.evaluate(() => ![...document.querySelectorAll('#trHost .trs-cell img')].some(im => /asset\.eyecannndy/.test(im.getAttribute('src') || ''))), 'Stop all stills them again');
      ok(/Crash cut · 7/.test((await p.$$eval('#trHost [data-tech] option', x => x.map(y => y.textContent.trim()))).join('|')), 'each technique counts its clips');
      ok(/Transitions & cuts · 7 clips/.test((await p.$$eval('#trHost [data-type] option', x => x.map(y => y.textContent.trim()))).join('|')), 'and so does its type');
      /* search */
      await p.click('#trHost [data-p="all"]'); await p.fill('#trHost .trs-search', 'clip 6'); await p.waitForTimeout(600);
      ok((await p.$$('#trHost .trs-cell')).length === 1 && /1 match for/.test(await p.textContent('#trHost .trs-bar')), 'search finds a clip by its title', await p.textContent('#trHost .trs-bar span'));
      await p.fill('#trHost .trs-search', 'crash'); await p.waitForTimeout(600);
      ok((await p.$$('#trHost .trs-cell')).length === 7, 'or by its technique’s name');
      await p.fill('#trHost .trs-search', ''); await p.waitForTimeout(600);
      /* more techniques: all of Eyecandy's, and ones it added since */
      await p.selectOption('#trHost [data-type]', '__edit'); await p.waitForTimeout(500);
      ok(/Add all 118/.test(await p.textContent('#sheet')), 'the technique sheet offers all of Eyecandy’s at once');
      await p.click('#sheet [data-addall]'); await p.waitForTimeout(600);
      ok((await p.evaluate(() => Transitions.techs())).length === 136, 'Add all gives all 136');
      ok((await p.$$('#trHost [data-type] option')).length === 10, 'which fill all eight types');
      await p.selectOption('#trHost [data-type]', 'moves'); await p.waitForTimeout(300);
      ok(/Read 24 techniques/.test(await p.textContent('#trHost .trs-bar')), 'an open group reads just its own', await p.textContent('#trHost .trs-bar [data-a="readall"]'));
      await p.screenshot({ path: path.join(out, `tr-top-${name}.png`) });
      await p.evaluate(() => { const g = window.CS3Lib.grabRun; window.CS3Lib.grabRun = async o => { if(/eyecannndy\.com\/$/.test(o.url)){
          setTimeout(() => { window.__fire = 1; }, 0); } return g(o); }; });
      await p.selectOption('#trHost [data-type]', '__edit'); await p.waitForTimeout(400);
      await p.click('#sheet [data-a="discover"]'); await p.waitForTimeout(900);
      ok((await p.evaluate(() => window.__scans.some(x => /eyecannndy\.com\/$/.test(x.url)))), 'Check Eyecandy for new ones scans its front page');
      await p.evaluate(() => App.closeSheet()); await p.selectOption('#trHost [data-type]', 'cuts'); await p.waitForTimeout(300);
      await p.selectOption('#trHost [data-tech]', 'crash-transition'); await p.waitForTimeout(400);
    }
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(out, `tr-tab-${name}.png`) });
    if(name === 'phone'){
      await p.selectOption('#trHost [data-type]', 'cuts'); await p.waitForTimeout(300); await p.selectOption('#trHost [data-tech]', 'whip-pan'); await p.waitForTimeout(800);
      ok(await p.$eval('#trHost .trs-cell[data-w="ec_bad"]', x => x.classList.contains('bad')), 'a picture that won’t load says so instead of a blank box');
      ok(!(await p.$('#trHost [data-a="read"]')) && /laptop/.test(await p.textContent('#trHost').catch(() => '')) === false, 'the phone has no Read button');
      await p.screenshot({ path: path.join(out, `tr-tab-${name}.png`) });
    }

    /* watch, keep, assign */
    await p.click('#trHost .trs-cell'); await p.waitForTimeout(600);
    ok(await p.evaluate(() => SwipePlayer.isOpen() && !!document.querySelector('.spl-stage img.spl-img')), 'a clip plays in the pop-out, as itself');
    const acts = await p.$$eval('.spl-acts button:not([hidden])', x => x.map(y => y.textContent.trim()));
    ok(acts.includes('Assign to a shot') && acts.includes('☆ Keep') && acts.includes('↗ Eyecandy') && !acts.includes('Open the swipe'), 'Assign, Keep and Eyecandy under it', acts.join(' | '));
    await p.screenshot({ path: path.join(out, `tr-player-${name}.png`) });
    await p.click('.spl-acts [data-spla="keep"]'); await p.waitForTimeout(400);
    const first = await p.evaluate(async () => (await Transitions.all()).sort((a, b) => (a.at || 0) - (b.at || 0))[0]);
    ok(!!first.kept && /★ Kept/.test(await p.textContent('.spl-acts')), 'Keep stars it');
    await p.click('.spl-acts [data-spla="assign"]'); await p.waitForTimeout(600);
    ok(!(await p.evaluate(() => SwipePlayer.isOpen())) && /Where does/.test(await p.textContent('#sheet')), 'Assign asks where it goes');
    await p.click(`#sheet [data-host="clip:${cid}"]`); await p.waitForTimeout(700);
    ok((await p.$$('#sheet [data-gap]')).length === 3, 'then shows the gaps between its 4 shots');
    await p.screenshot({ path: path.join(out, `tr-assign-${name}.png`) });
    await p.click('#sheet [data-gap="1"]'); await p.waitForTimeout(800);
    let c = await p.evaluate(id => Store.get('clips', id), cid);
    const s1 = c.shotList[1];
    ok(s1.tr && s1.tr.id === first.id && !(c.shotList[0].tr), 'it goes on shot 2 — the cut from Coffee pour into Out the door', JSON.stringify(s1.tr));
    await p.evaluate(() => App.closeSheet()); await p.waitForTimeout(300);

    /* while shooting: the clip's Shoot list names it between the two shots */
    await p.evaluate(id => Screens.push('clip', { id, tab: 'shoot' }), cid); await p.waitForTimeout(1800);
    const trs = await p.$$eval(`${top} .cps-tr`, xs => xs.map(x => x.textContent));
    ok(trs.length === 1 && /into shot 3/.test(trs[0]), 'while shooting: the Shoot list shows it between shot 2 and 3', JSON.stringify(trs));
    await p.screenshot({ path: path.join(out, `tr-shoot-${name}.png`) });

    /* Edit: the cut list */
    await p.evaluate(id => { Screens.pop(); Screens.push('clip', { id, tab: 'edit' }); }, cid); await p.waitForSelector(`${top} #clipCuts .sx-cut`, { timeout: 6000 }).catch(() => {});
    await p.waitForTimeout(800);
    const cu = await p.evaluate(t => { const s = document.querySelector(t); const r = s.querySelector('#clipCuts .sx-tr');
      return { rows: s.querySelectorAll('#clipCuts .sx-tr').length, gaps: s.querySelectorAll('#clipCuts .sx-trgap').length, text: r && r.textContent.replace(/\s+/g, ' ').trim(),
        prev: r && r.previousElementSibling && r.previousElementSibling.dataset.shot }; }, top);
    ok(cu.rows === 1 && cu.prev === '1' && /into shot 3/.test(cu.text) && cu.gaps === 2, 'Edit: the transition shows between the cuts; the other gaps have a quiet + transition', JSON.stringify(cu));
    await p.screenshot({ path: path.join(out, `tr-edit-${name}.png`), fullPage: false });
    await p.click(`${top} #clipCuts .sx-trgap`); await p.waitForTimeout(600);
    ok(/Between shot 1 and 2/.test(await p.textContent('#sheet')), '+ transition opens the picker');
    await p.click('#sheet [data-pick]'); await p.waitForTimeout(1200);
    c = await p.evaluate(id => Store.get('clips', id), cid);
    ok(!!(c.shotList[0].tr && c.shotList[0].tr.id), 'picked one goes on that cut', JSON.stringify(c.shotList[0].tr));
    await p.click(`${top} #clipCuts [data-troff="0"]`); await p.waitForTimeout(1200);
    c = await p.evaluate(id => Store.get('clips', id), cid);
    ok(!c.shotList[0].tr && c.shotList[1].tr, '× takes it off and leaves the other');

    /* it rides along to the day's shoot task */
    const tk = await p.evaluate(async id => { const t = await ShotList.putOnDay({ title: 'Morning ritual', day: 0, ...(await ShotList.hostClip(id).load()) }); return t.subs.filter(x => x.tr).length; }, cid);
    ok(tk === 1, 'the shoot task on a day carries it too');
    await ctx.close();
  }
  await b.close();
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
