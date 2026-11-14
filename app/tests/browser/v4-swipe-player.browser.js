/* Browser test: a swipe playing in a pop-out over the swipe file
   (swipeplayer.js) — step through, sort while watching, close — phone and
   laptop. The platforms' players are stood in for (no internet here).

     node app/tests/browser/v4-swipe-player.browser.js [outDir] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
const stub = name => `<html><body style="margin:0;background:#222;color:#fff;font:600 18px sans-serif;display:grid;place-items:center;height:100vh">${name}</body></html>`;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  for(const [w, h, name] of [[400, 860, 'phone'], [1440, 900, 'laptop']]){
    console.log(`\n— ${name} —`);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 600 });
    let loads = 0;
    await ctx.route(/instagram\.com\/p\/.*\/embed/, r => { loads++; r.fulfill({ contentType: 'text/html', body: stub('Instagram') }); });
    await ctx.route(/tiktok\.com\/embed/, r => { loads++; r.fulfill({ contentType: 'text/html', body: stub('TikTok') }); });
    await ctx.route(/youtube\.com\/embed/, r => { loads++; r.fulfill({ contentType: 'text/html', body: stub('YouTube') }); });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.SwipePlayer && window.SwipeFolders, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    await p.evaluate(async () => {
      await SwipeFolders.create('Cars');
      const L = [['Reel one', 'https://www.instagram.com/reel/AAAAA1/'], ['TikTok two', 'https://www.tiktok.com/@a/video/7123456789012345678'],
                 ['YouTube three', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'], ['X four', 'https://x.com/someone/status/12345']];
      for(const [i, [t, u]] of L.entries()) await Store.put('swipes', { id: 's' + i, title: t, url: u, source: 'reel', inbox: true, createdAt: Date.now() - i * 1000 });
    });
    await p.evaluate(() => App.go('series')); await p.waitForSelector('.ctnav [data-v="swipe"]'); await p.waitForTimeout(500);
    await p.click('.ctnav [data-v="swipe"]'); await p.waitForSelector('.swipegrid .swipecard [data-watch]'); await p.waitForTimeout(500);

    await p.click('.swipegrid .swipecard:first-child [data-watch]'); await p.waitForTimeout(700);
    const first = await p.textContent('.spl-title');
    ok(await p.evaluate(() => SwipePlayer.isOpen()) && /1 of 4/.test(await p.textContent('.spl-count')), '▶ opens it in a pop-out, not a new page', first);
    ok(!(await p.$('.spl-opts')) && (await p.$$('.spl-g')).length >= 4, 'Sort it starts as one slim row of filters',
      (await p.$$eval('.spl-g', x => x.map(y => y.textContent.trim()))).join(', '));
    await p.screenshot({ path: path.join(out, `swipe-player-${name}.png`) });

    /* sort while watching */
    const l0 = loads;
    await p.click('.spl-g[data-pg="__chan"]'); await p.waitForTimeout(250);
    await p.click('.spl-opts .spl-chip'); await p.waitForTimeout(300);
    await p.click('.spl-g[data-pg="__fold"]'); await p.waitForTimeout(250);
    ok(/Channel · 1/.test((await p.$$eval('.spl-g', x => x.map(y => y.textContent))).join('|')), 'a channel picked; its button counts it');
    await p.click('.spl-opts .spl-chip'); await p.waitForTimeout(300);
    ok(loads === l0, 'sorting doesn\'t reload the video');
    const fb = await p.evaluate(() => { const f = document.querySelector('.spl-stage').getBoundingClientRect(), o = document.querySelector('.spl-foot').getBoundingClientRect(); return f.bottom <= o.top + 1; });
    ok(fb, 'with a row open the video still clears the controls');
    await p.screenshot({ path: path.join(out, `swipe-player-sort-${name}.png`) });

    /* step through */
    if(w > 600){ await p.keyboard.press('ArrowRight'); } else { await p.click('[data-spl="next"]'); }
    await p.waitForTimeout(400);
    const second = await p.textContent('.spl-title');
    ok(second !== first && /2 of 4/.test(await p.textContent('.spl-count')), 'the next swipe', second);
    ok(await p.$eval('.spl-g[data-pg="__fold"]', x => x.getAttribute('aria-expanded')) === 'true', 'the open filter stays open for the next one');
    for(let k = 0; k < 3; k++){ await p.evaluate(() => { const n = document.querySelector('[data-spl="next"]'); if(!n.disabled) n.click(); }); await p.waitForTimeout(250); }
    ok(/4 of 4/.test(await p.textContent('.spl-count')) && await p.$eval('[data-spl="next"]', x => x.disabled), 'the last one: › is off');
    const noPlayer = await p.textContent('.spl-stage');
    ok(/Open on X/.test(noPlayer), 'X has no player: its cover and Open on X');

    /* close */
    if(w > 600) await p.keyboard.press('Escape'); else await p.evaluate(() => App.goBack());
    await p.waitForTimeout(600);
    ok(!(await p.evaluate(() => SwipePlayer.isOpen())) && !!(await p.$('.swipegrid')), `${w > 600 ? 'Esc' : 'Back'} closes it, back on the swipe file`);
    const saved = await p.evaluate(async t => { const s = (await Store.all('swipes')).values.find(x => x.title === t); return { ch: (s.channels || []).length, f: (s.folders || []).length, inbox: !!s.inbox }; }, first);
    ok(saved.ch === 1 && saved.f === 1 && !saved.inbox, 'what was sorted is saved; filed means out of the Inbox', JSON.stringify(saved));

    await p.click('.swipegrid .swipecard:first-child [data-watch]'); await p.waitForTimeout(400);
    await p.click('[data-spl="swipe"]'); await p.waitForTimeout(700);
    ok(!(await p.evaluate(() => SwipePlayer.isOpen())) && !!(await p.$('#screens [data-f="title"]')), 'Open the swipe goes to its page');
    await ctx.close();
  }
  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
