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
    /* yt.html on the app's site, served from this folder */
    await ctx.route(/solakirus\.github\.io\/creator-studio-v4\/yt\.html/, r => { loads++; r.fulfill({ contentType: 'text/html',
      body: fs.readFileSync(path.resolve(__dirname, '../../yt.html'), 'utf8') }); });
    await ctx.route(/youtube-nocookie\.com\/embed/, r => r.fulfill({ contentType: 'text/html', body: stub('YouTube') }));
    await ctx.route(/facebook\.com\/plugins\/video\.php/, r => r.fulfill({ contentType: 'text/html', body: stub('Facebook') }));
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
    /* the YouTube one (3 of 4) went through yt.html */
    const noPlayer = await p.textContent('.spl-stage');
    ok(/Open on X/.test(noPlayer), 'X has no player: its cover and Open on X');

    /* YouTube through yt.html, with a real origin for the player */
    await p.evaluate(() => { document.querySelector('[data-spl="prev"]').click(); });
    await p.waitForTimeout(700);
    const yt = await p.evaluate(() => { const f = document.querySelector('.spl-frame'); return f ? f.src : ''; });
    ok(/solakirus\.github\.io\/creator-studio-v4\/yt\.html\?v=dQw4w9WgXcQ.*autoplay=1/.test(yt), 'YouTube plays through yt.html on the app\'s site', yt);
    const inner = await p.evaluate(() => new Promise(r => setTimeout(() => {
      try { const d = document.querySelector('.spl-frame').contentDocument; r(d && d.querySelector('iframe') ? d.querySelector('iframe').src : 'cross-origin'); } catch(e){ r('cross-origin'); } }, 600)));
    ok(inner === 'cross-origin' || /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*autoplay=1/.test(inner), 'and yt.html loads the player from there', inner);

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
  console.log('\n— yt.html itself —');
  {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    await p.route(/youtube-nocookie/, r => r.fulfill({ contentType:'text/html', body:'ok' }));
    await p.goto('file:///' + path.resolve(__dirname, '../../yt.html').replace(/\\/g, '/') + '?v=dQw4w9WgXcQ&autoplay=1&t=12');
    const src = await p.$eval('iframe', f => f.src + ' | ' + f.referrerPolicy + ' | ' + f.allow);
    ok(/youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/.test(src) && /autoplay=1/.test(src) && /start=12/.test(src) && /playsinline=1/.test(src)
      && /strict-origin-when-cross-origin/.test(src) && /autoplay/.test(src), 'yt.html builds the player with autoplay, start, playsinline and a referrer', src.slice(0, 160));
    await p.goto('file:///' + path.resolve(__dirname, '../../yt.html').replace(/\\/g, '/') + '?v=<script>');
    ok(/embed\/script\?/.test(await p.$eval('iframe', f => f.src)), 'a bad id is cleaned, not run');
    await ctx.close();
  }

  console.log('\n— Facebook —');
  {
    const ctx = await b.newContext({ viewport: { width: 400, height: 860 } });
    await ctx.route(/facebook\.com\/plugins\/video\.php/, r => r.fulfill({ contentType: 'text/html', body: stub('Facebook') }));
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push('fb: ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.SwipePlayer && window.Embed, null, { timeout: 15000 });
    await p.waitForTimeout(900);
    const tidy = await p.evaluate(() => [
      Embed.facebookUrl('https://m.facebook.com/reel/1234567890123/?mibextid=abc&rdid=x'),
      Embed.facebookUrl('https://web.facebook.com/watch/?v=987654321&ref=sharing'),
      Embed.facebookUrl('https://www.facebook.com/somepage/videos/55555555555/?__tn__=x'),
      Embed.facebookNeedsResolving('https://www.facebook.com/share/r/1AbCdEf/'),
      Embed.facebookNeedsResolving('https://fb.watch/abcDEF/') ]);
    ok(tidy[0] === 'https://www.facebook.com/reel/1234567890123/' && tidy[1] === 'https://www.facebook.com/watch/?v=987654321'
      && tidy[2] === 'https://www.facebook.com/somepage/videos/55555555555/' && tidy[3] && tidy[4],
      'Facebook links are tidied to the video\'s plain address; share links are spotted', JSON.stringify(tidy));
    await p.evaluate(async () => {
      await Store.put('swipes', { id:'fb1', title:'FB share', url:'https://www.facebook.com/share/r/1AbCdEf/', source:'facebook', createdAt:2 });
      await Store.put('swipes', { id:'fb2', title:'FB reel', url:'https://m.facebook.com/reel/1234567890123/?mibextid=abc', source:'facebook', createdAt:1 });
    });
    await p.evaluate(() => App.go('series')); await p.waitForSelector('.ctnav [data-v="swipe"]'); await p.waitForTimeout(400);
    await p.click('.ctnav [data-v="swipe"]'); await p.waitForSelector('.swipecard[data-open="fb1"] [data-watch]'); await p.waitForTimeout(400);
    /* a browser can't read Facebook's page: it says so instead of "video unavailable" */
    await p.click('.swipecard[data-open="fb1"] [data-watch]'); await p.waitForTimeout(700);
    ok(/share link/.test(await p.textContent('.spl-stage')) && !(await p.$('.spl-frame')), 'an unresolved share link explains itself, with Open on Facebook');
    await p.click('[data-spl="next"]'); await p.waitForTimeout(500);
    const fsrc = await p.$eval('.spl-frame', f => decodeURIComponent(f.src));
    ok(/plugins\/video\.php\?href=https:\/\/www\.facebook\.com\/reel\/1234567890123\/&/.test(fsrc), 'a reel plays from its plain address', fsrc.slice(0, 120));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    /* the phone app: the share link is followed, then kept */
    await p.evaluate(() => { LinkMeta.native = () => true; LinkMeta.get = async () => ({ finalUrl:'https://www.facebook.com/reel/42424242424242/' }); });
    await p.click('.swipecard[data-open="fb1"] [data-watch]'); await p.waitForTimeout(900);
    const rs = await p.$eval('.spl-frame', f => decodeURIComponent(f.src)).catch(() => '');
    ok(/href=https:\/\/www\.facebook\.com\/reel\/42424242424242\//.test(rs), 'on the phone a share link is followed to the reel and plays', rs.slice(0, 120));
    ok((await p.evaluate(async () => (await Store.get('swipes', 'fb1')).playUrl)) === 'https://www.facebook.com/reel/42424242424242/', 'and kept on the swipe, so it is looked up once');
    await ctx.close();
  }

  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
