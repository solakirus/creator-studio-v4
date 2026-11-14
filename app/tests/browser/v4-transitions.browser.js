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
          const slug = o.url.split('/').pop();
          setTimeout(() => {
            L.line.forEach(cb => cb('  found 3 thumbnails'));
            [1, 2, 3].forEach(n => L.link.forEach(cb => cb({ url: `https://asset.eyecannndy.com/media/clip/2024/02/28/${slug}-${n}.webp`, title: `${slug} clip ${n}`, kind: 'gif' })));
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
    const pills = await p.$$eval('#trHost .trs-pills button', x => x.map(y => y.textContent.trim()));
    ok(pills.some(x => /^Crash cut/.test(x)) && pills.some(x => /^Whip pan/.test(x)), 'starts with Eyecandy’s transition techniques', pills.slice(0, 6).join(' | '));

    if(name === 'laptop'){
      await p.click('#trHost [data-p="crash-transition"]'); await p.waitForTimeout(300);
      ok(/Read from Eyecandy/.test(await p.textContent('#trHost .trs-bar')), 'a technique not read yet offers Read from Eyecandy');
      await p.click('#trHost [data-a="read"]'); await p.waitForFunction(() => document.querySelectorAll('#trHost .trs-cell').length === 3, null, { timeout: 5000 }).catch(() => {});
      const scans = await p.evaluate(() => window.__scans);
      ok(scans.length === 1 && scans[0].mode === 'scan' && /eyecannndy\.com\/technique\/crash-transition$/.test(scans[0].url), 'reads with the grabber’s scan (links only, no download)', scans[0] && scans[0].mode);
      const recs = await p.evaluate(() => Transitions.all());
      ok(recs.length === 3 && recs.every(r => r.tech[0] === 'crash-transition' && /^ec_crash-transition-\d$/.test(r.id)), 'keeps the 3 clips, drops the page link and the logo', recs.map(r => r.id).join(','));
      await p.click('#trHost [data-a="read"]'); await p.waitForTimeout(500);
      ok((await p.evaluate(() => Transitions.all())).length === 3, 'reading again adds no doubles');
      ok(/Crashcut3/.test((await p.$$eval('#trHost .trs-pills button', x => x.map(y => y.textContent.replace(/\s/g, '')))).join('|').replace(/\s/g, '')), 'the pill counts its clips');
    }
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(out, `tr-tab-${name}.png`) });
    if(name === 'phone'){
      await p.click('#trHost [data-p="whip-pan"]'); await p.waitForTimeout(800);
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

    /* the shot page while shooting */
    await p.evaluate(id => Screens.push('clip', { id, tab: 'shoot' }), cid); await p.waitForSelector(`${top} .tk-trtog`, { timeout: 6000 }).catch(() => {});
    await p.waitForTimeout(500);
    ok(!(await p.$(`${top} .tk-trm`)) && /1 transition · Show/.test(await p.textContent(`${top} .tk-trtog`).catch(() => '')), 'while shooting: hidden, one small Show button');
    await p.screenshot({ path: path.join(out, `tr-shoot-hidden-${name}.png`) });
    await p.click(`${top} .tk-trtog`); await p.waitForTimeout(600);
    const mk = await p.evaluate(t => { const s = document.querySelector(t); const m = s.querySelector('.tk-trm');
      return { n: s.querySelectorAll('.tk-trm').length, after: m && m.previousElementSibling && m.previousElementSibling.dataset.ps, btn: (s.querySelector('.tk-trtog') || {}).textContent }; }, top);
    ok(mk.n === 1 && mk.after === '1' && /Hide/.test(mk.btn), 'Show: one faint marker, between shot 2 and 3', JSON.stringify(mk));
    await p.screenshot({ path: path.join(out, `tr-shoot-shown-${name}.png`) });
    await p.click(`${top} .tk-trm button`); await p.waitForTimeout(600);
    ok(await p.evaluate(() => SwipePlayer.isOpen() && document.querySelectorAll('.spl-acts [data-spla]').length === 0), 'tapping the marker plays it (nothing else to do there)');
    await p.evaluate(() => SwipePlayer.close());
    await p.click(`${top} .tk-trtog`); await p.waitForTimeout(500);
    ok(!(await p.$(`${top} .tk-trm`)), 'Hide puts it away again');

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
