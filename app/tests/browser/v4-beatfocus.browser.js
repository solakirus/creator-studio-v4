/* Browser test: one beat at a time in a clip's Script (21 Nov 2026).

   Tapping a beat's chip (or ⤢ on its header) opens just that beat, full
   width, its shots as a grid; ‹ › and ← → step through the beats; All beats
   or Esc goes back. Adding a shot keeps you in it; moving the beat keeps you
   on it; it stays when the page redraws; Rows or Columns, it's the same view.
   The Edit tab's chips still just scroll.

     node app/tests/browser/v4-beatfocus.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
const top = '.screen:last-child', S = `${top} #clipScript`;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  for(const [w, h, name] of [[1440, 900, 'laptop'], [412, 915, 'phone']]){
    console.log(`\n— ${name} —`);
    const ctx = await b.newContext(w < 600 ? { viewport: { width: w, height: h }, isMobile: true, hasTouch: true } : { viewport: { width: w, height: h } });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('dialog', d => d.accept());
    await p.goto(url); await p.waitForFunction(() => window.App && window.Structures && window.Data, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    const cid = await p.evaluate(async () => (await Data.saveClip({ title: 'Can I get a ride — ep 1', state: 'raw', stage: 'idea',
      plan: { tab: 'plan', noAutoBeats: true, versions: [Versions.make('short', [])] } })).id);
    await p.evaluate(id => Screens.push('clip', { id, tab: 'plan' }), cid); await p.waitForTimeout(1500);
    await p.click(`${S} [data-st="bme"]`); await p.waitForTimeout(1200);
    const ui = () => p.evaluate(s => { const c = document.querySelector(s);
      return { focus: !!c.querySelector('.sx.focus'), secs: [...c.querySelectorAll('.sx-beat .sx-bn')].map(x => x.value),
        where: (c.querySelector('.sx-fwhere') || {}).textContent || '', on: [...c.querySelectorAll('.sx-jump [aria-pressed="true"]')].map(x => x.firstChild.textContent),
        shots: c.querySelectorAll('.sx-beat .sx-shot').length, grid: (() => { const g = c.querySelector('.sx.focus .sx-shots'); return g ? getComputedStyle(g).display : ''; })() }; }, S);

    let u = await ui();
    ok(!u.focus && u.secs.join() === 'Beginning,Middle,End' && u.on.join() === 'All beats', 'all three beats show, "All beats" lit', u.secs.join());
    await p.click(`${S} [data-stjump="1"]`); await p.waitForTimeout(500);
    u = await ui();
    ok(u.focus && u.secs.join() === 'Middle' && u.on.join() === 'Middle', 'tapping a beat\'s chip opens just that beat', u.secs.join());
    ok(/Middle/.test(u.where) && /Beat 2 of 3/.test(u.where), 'the bar says where you are', u.where.replace(/\s+/g, ' ').trim());
    ok(u.grid === 'grid', 'its shots are a grid of big frames');
    await p.click(`${S} [data-sadd="1"]`); await p.waitForTimeout(900);
    u = await ui();
    ok(u.focus && u.secs.join() === 'Middle' && u.shots === 2, 'adding a shot keeps you in the beat', `${u.shots} shots`);
    await p.screenshot({ path: path.join(out, `${name}-beat-focus.png`) });

    await p.click(`${S} [data-sxstep="-1"]`); await p.waitForTimeout(400);
    ok((await ui()).secs.join() === 'Beginning' && await p.$eval(`${S} [data-sxstep="-1"]`, x => x.disabled), '‹ steps back (and stops at the first)');
    if(name === 'laptop'){
      await p.click(`${S} .sx-fwhere`);
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
      ok((await ui()).secs.join() === 'End', '→ steps forward on a keyboard');
      await p.focus(`${S} .sx-bn`); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(300);
      ok((await ui()).secs.join() === 'End', 'but not while typing in a box');
      await p.evaluate(() => document.activeElement.blur());
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      ok(!(await ui()).focus, 'Esc goes back to every beat');
    } else {
      await p.click(`${S} [data-sxall]`); await p.waitForTimeout(400);
      ok(!(await ui()).focus, 'All beats goes back to every beat');
    }

    /* ⤢ on a beat's header, moving it, a redraw */
    await p.click(`${S} [data-sxfocus="1"]`); await p.waitForTimeout(400);
    ok((await ui()).secs.join() === 'Middle', '⤢ on a beat opens it too');
    await p.click(`${S} [data-bmv="1:1"]`); await p.waitForTimeout(900);
    u = await ui();
    ok(u.secs.join() === 'Middle' && /Beat 3 of 3/.test(u.where), 'moving the beat keeps you on it', u.where.replace(/\s+/g, ' ').trim());
    await p.evaluate(() => { const b2 = document.querySelector('.screen:last-child [data-tab="shoot"], .screen:last-child [data-t="shoot"]'); if(b2) b2.click(); });
    await p.waitForTimeout(700);
    await p.evaluate(() => { const b2 = document.querySelector('.screen:last-child [data-tab="plan"], .screen:last-child [data-t="plan"]'); if(b2) b2.click(); });
    await p.waitForTimeout(1000);
    ok((await ui()).secs.join() === 'Middle', 'it\'s still open after the page redraws (Shoot and back)');
    await p.click(`${S} [data-sxall]`); await p.waitForTimeout(400);
    await p.evaluate(() => localStorage.setItem('cs4-sx-cols', 'rows'));
    await p.click(`${S} [data-sxv="rows"]`); await p.waitForTimeout(400);
    await p.click(`${S} [data-stjump="0"]`); await p.waitForTimeout(400);
    u = await ui();
    ok(u.focus && u.grid === 'grid' && u.secs.join() === 'Beginning', 'with Rows chosen, a beat opens the same way');
    await p.click(`${S} [data-stjump="0"]`); await p.waitForTimeout(400);
    ok(!(await ui()).focus, 'tapping the lit chip again goes back to all');
    await p.evaluate(() => localStorage.removeItem('cs4-sx-cols'));
    await ctx.close();
  }
  ok(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
