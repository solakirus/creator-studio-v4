/* Browser test: an episode day's Storyboard cards carry the shot's script
   lines (VO / CAM / TXT) like a clip's columns, and one Stop GIFs switch
   for the day.

     node app/tests/browser/v4-epscript.browser.js [outDir] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
const top = '.screen:last-child';
const GIF = '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';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  for(const [w, h, name] of [[1440, 900, 'laptop'], [400, 860, 'phone']]){
    console.log(`\n— ${name} —`);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 600 });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('dialog', d => d.accept());
    await p.goto(url); await p.waitForFunction(() => window.App && window.ShotBoard, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    await p.evaluate(async b64 => {
      const bin = atob(b64), u8 = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const g = await MediaLib.addBlob(new Blob([u8], { type:'image/gif' }), { name:'walk.gif', label:'Walk in' });
      const wk = await Data.currentWeek();
      await Store.put('vlogs', { id:'v1', title:'Week 2', week:wk, acts:[{ id:'a1', title:'Monday', beats:[
        { id:'b1', title:'Wake up', shots:[{ id:'s1', text:'Alarm', item:g }, { id:'s2', text:'Coffee', lines:[{ k:'vo', t:'Five-fifteen.' }] }] },
        { id:'b2', title:'Gym', shots:[{ id:'s3', text:'Walk in', item:g }] }] }] });
      localStorage.setItem('cs4-shots-view', 'board'); localStorage.removeItem('cs4-frames-still');
      Screens.push('vlog-day', { vlogId:'v1', actId:'a1' });
    }, GIF);
    await p.waitForTimeout(2200);
    const shots = () => p.evaluate(async () => (await Store.get('vlogs', 'v1')).acts[0].beats.map(b => b.shots.map(s => ({ t:s.text, lines:s.lines || [] }))));
    const sv = await p.$eval(`${top} [data-sblt="1:0"]`, x => x.value).catch(() => null);
    ok(sv === 'Five-fifteen.', 'a shot’s script lines show on its Storyboard card', sv);
    ok((await p.$$(`${top} [data-sbladd]`)).length === 3, 'every card has + Add a line');
    await p.click(`${top} .dcol:first-child [data-sbladd="0"]`); await p.waitForTimeout(1200);
    await p.fill(`${top} .dcol:first-child [data-sblt="0:0"]`, 'Nobody else is up.'); await p.waitForTimeout(1200);
    await p.click(`${top} .dcol:first-child [data-sblk="0:0"]`); await p.waitForTimeout(800);
    await p.click(`${top} .dcol:first-child [data-sblk="0:0"]`); await p.waitForTimeout(1000);
    let r = await shots();
    ok(JSON.stringify(r[0][0].lines) === JSON.stringify([{ k:'txt', t:'Nobody else is up.' }]), 'a line is added, typed and its kind tapped VO → CAM → TXT', JSON.stringify(r[0][0].lines));
    await p.click(`${top} .dcol:first-child [data-sblrm="1:0"]`); await p.waitForTimeout(1200);
    r = await shots();
    ok(!r[0][1].lines.length, '× takes a line off');
    const mb = await p.$$(`${top} [data-motion]`);
    ok(mb.length === 1, 'one Stop GIFs switch for the whole day', mb.length);
    await p.click(`${top} [data-motion]`); await p.waitForTimeout(600);
    const st = await p.$$eval(`${top} [data-sbframe] [data-slpic]`, xs => xs.map(c => !!c.querySelector('canvas') && !c.querySelector('canvas').hidden && c.querySelector('img[data-anim]').hidden));
    ok(st.length === 2 && st.every(Boolean), 'it stops every GIF on the day', JSON.stringify(st));
    await p.screenshot({ path: path.join(out, `epscript-${name}.png`) });
    await p.click(`${top} [data-motion]`); await p.waitForTimeout(400);
    /* the line follows the shot into shoot mode */
    await p.evaluate(() => Screens.push('shoot-run', { host:ShotList.hostBeat('v1', 'b1') })); await p.waitForTimeout(1500);
    const sr = await p.evaluate(() => document.querySelector('.sr') ? document.querySelector('.sr').innerText : '');
    ok(/Nobody else is up/.test(sr) || !!(await p.$('.sr [data-script], .sr .sr-script, .sr [data-reveal]')), 'shoot mode has the shot’s script', sr.replace(/\s+/g, ' ').slice(0, 90));
    await ctx.close();
  }
  await b.close();
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
