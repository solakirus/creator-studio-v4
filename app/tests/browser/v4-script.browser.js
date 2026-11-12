/* Browser test: the clip page reworked, structures, and script lines on shots.

   Plan: References first, then Purpose (what it's for, type, who, promise,
   length) and Script (hook, structure, shot-by-shot lines); Holding the middle
   gone. A structure picked on an empty clip makes a shot per beat; the hook
   box is shot 1's first line both ways; Paste a whole script splits across the
   shots. Shoot: the day row, then Steps + Shot page; each step's Script twirl
   edits its lines; the steps fold to a line with the page still showing; beat
   names head the steps; no "Capture for N versions". Shoot mode: the shot
   first, its script behind a reveal that stays open between shots. Edit: the
   cut list (lines over each cut, an edit note), versions ticked as cut. Post:
   versions with platforms and a link, caption with search words; no Cuts or
   Where it is. A shoot day carries the lines and beats. A series video gets
   the same. Your own structure is made, used and deleted. Phone: page shows.

     node app/tests/browser/v4-script.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  async function device(name, laptop){
    const ctx = await b.newContext(laptop ? { viewport: { width: 1280, height: 900 } } : { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    p.on('dialog', d => d.accept());
    await p.goto(url); await p.waitForFunction(() => window.App && window.ShotList && window.Structures, null, { timeout: 15000 });
    await p.waitForTimeout(800); return p;
  }
  const top = '.screen:last-child';
  const lap = await device('laptop', true);
  const clipRec = id => lap.evaluate(id => Store.get('clips', id), id);
  const steps = r => (r.subs || []).filter(x => x.shot != null).sort((a, b) => a.shot - b.shot);

  head('a clip, opened on Plan');
  const cid = await lap.evaluate(async () => (await Data.saveClip({ title: 'Morning ritual, part 1', state: 'raw', stage: 'idea',
    plan: { tab: 'plan', versions: [Versions.make('short', []), Versions.make('custom', [], 'Teaser')] } })).id);
  await lap.evaluate(id => Screens.push('clip', { id, tab: 'plan' }), cid); await lap.waitForTimeout(1500);
  let ui = await lap.evaluate(t => { const s = document.querySelector(t);
    const sums = [...s.querySelectorAll('.view > details > summary')].map(x => x.firstChild.textContent.trim());
    return { sums, subs: [...s.querySelectorAll('#sec-purpose .cp-subk')].map(x => x.textContent.trim()),
      script: [...s.querySelectorAll('#sec-script .cp-subk')].map(x => x.textContent.trim()), mount: !!s.querySelector('#clipScript .sx'),
      retain: /Holding the middle/.test(s.textContent) }; }, top);
  ok(ui.sums[0] === 'References' && ui.sums[1] === 'Purpose' && ui.sums[2] === 'Script', 'References first, then Purpose and Script', ui.sums.join(' · '));
  ok(['What it’s for', 'Type', 'Who it’s for', 'The promise', 'Length'].every(x => ui.subs.includes(x)), 'Purpose holds what it’s for, type, who, promise and length', ui.subs.join(', '));
  ok(ui.script[0].startsWith('Hook') && ui.mount, 'Script holds the hook and the structure with its shots');
  ok(!ui.retain, 'Holding the middle is gone');
  await lap.click(`${top} #s-purpose [data-v="trust"]`); await lap.waitForTimeout(500);
  ok((await clipRec(cid)).plan.purpose === 'trust', 'a purpose chip sets it');

  head('a structure on an empty clip');
  await lap.click(`${top} #clipScript [data-st="pick"]`); await lap.waitForTimeout(500);
  ok(await lap.evaluate(() => document.querySelectorAll('.sheet [data-use]').length >= 7), 'the built-in structures are listed');
  await lap.click('.sheet [data-use="b-loop"]'); await lap.waitForTimeout(1500);
  let r = await clipRec(cid);
  ok(r.plan.beats.length === 6 && r.plan.structure.id === 'b-loop' && r.plan.beatGuide[0].includes('three seconds'), 'its beats are the flow, with what each is for', r.plan.beats.join(' → '));
  ok((r.page.slots || []).length === 6 && steps(r).map(x => x.beat).join() === '0,1,2,3,4,5' && r.page.slots[0].role === 'Action', 'a shot for each beat, from the structure', r.page.slots.map(x => x.text).join(' | '));
  ui = await lap.evaluate(t => ({ secs: document.querySelectorAll(t + ' #clipScript .sx-beat').length, jump: document.querySelectorAll(t + ' #clipScript [data-stjump]').length }), top);
  ok(ui.secs === 6 && ui.jump === 6, 'each beat is a section, with chips to jump between them');

  head('lines on the shots, the hook on shot 1');
  await lap.fill(`${top} [data-f="hook"]`, 'Five-fifteen. Every day.'); await lap.dispatchEvent(`${top} [data-f="hook"]`, 'change'); await lap.waitForTimeout(1500);
  r = await clipRec(cid);
  ok(steps(r)[0].lines && steps(r)[0].lines[0].hook && steps(r)[0].lines[0].t === 'Five-fifteen. Every day.', 'the hook box puts its words on shot 1 as its first line');
  await lap.click(`${top} #clipScript [data-ladd="3"]`); await lap.waitForTimeout(1200);
  await lap.fill(`${top} #clipScript [data-lt="3:0"]`, 'When I started, I gave my mornings to my phone.');
  await lap.dispatchEvent(`${top} #clipScript [data-lt="3:0"]`, 'change'); await lap.waitForTimeout(1200);
  await lap.click(`${top} #clipScript [data-ladd="3"]`); await lap.waitForTimeout(1200);
  /* the kind is a chip: VO → CAM → TXT, a tap each */
  await lap.click(`${top} #clipScript [data-lk="3:1"]`); await lap.waitForTimeout(700);
  await lap.click(`${top} #clipScript [data-lk="3:1"]`); await lap.waitForTimeout(700);
  ok(await lap.textContent(`${top} #clipScript [data-lk="3:1"]`) === 'TXT', 'tapping the kind chip goes VO → CAM → TXT');
  await lap.fill(`${top} #clipScript [data-lt="3:1"]`, 'WATER · LIGHT · ONE PAGE');
  await lap.dispatchEvent(`${top} #clipScript [data-lt="3:1"]`, 'change'); await lap.waitForTimeout(1200);
  r = await clipRec(cid);
  ok(JSON.stringify(steps(r)[3].lines) === JSON.stringify([{ k: 'vo', t: 'When I started, I gave my mornings to my phone.' }, { k: 'txt', t: 'WATER · LIGHT · ONE PAGE' }]),
    'lines are added to a shot, with their kind', JSON.stringify(steps(r)[3].lines));
  ok((r.shotList[3].lines || []).length === 2, 'and kept on the clip\'s plain shot list too');
  await lap.fill(`${top} #clipScript [data-lt="0:0"]`, 'Five-fifteen. Every single day.');
  await lap.dispatchEvent(`${top} #clipScript [data-lt="0:0"]`, 'change'); await lap.waitForTimeout(1200);
  r = await clipRec(cid);
  ok(r.plan.hook === 'Five-fifteen. Every single day.' && await lap.inputValue(`${top} [data-f="hook"]`) === 'Five-fifteen. Every single day.', 'changing the hook line on the shot changes the hook box');
  await lap.selectOption(`${top} #clipScript [data-sbeat="5"]`, '4'); await lap.waitForTimeout(1200);
  r = await clipRec(cid);
  ok(steps(r)[5].beat === 4 && await lap.evaluate(t => document.querySelectorAll(t + ' #clipScript .sx-beat')[4].querySelectorAll('.sx-shot').length, top) === 2, 'a shot moves to another beat');
  await lap.selectOption(`${top} #clipScript [data-sbeat="5"]`, '5'); await lap.waitForTimeout(1200);
  ui = await lap.evaluate(t => document.querySelector(t + ' [data-scriptn]').textContent, top);
  ok(/6 beats/.test(ui) && /2 of 6 shots have lines/.test(ui), 'the Script summary counts beats and lines', ui);

  head('paste a whole script');
  await lap.click(`${top} #clipScript [data-st="paste"]`); await lap.waitForTimeout(500);
  await lap.fill('.sheet [data-paste]', 'p1 line\n\nBecause the first hour is yours.\n\nCAM: The kettle tells you.');
  await lap.click('.sheet [data-ok]'); await lap.waitForTimeout(1500);
  r = await clipRec(cid);
  ok(steps(r)[1].lines.some(l => l.t === 'Because the first hour is yours.') && steps(r)[2].lines.some(l => l.k === 'cam' && l.t === 'The kettle tells you.'),
    'each part lands on the next shot in story order; CAM: is said to camera');
  /* tidy: take the first part off shot 1 again */
  await lap.evaluate(async id => { const c = await Store.get('clips', id); const s0 = c.subs.find(x => x.shot === 0); s0.lines = s0.lines.filter(l => l.t !== 'p1 line'); await Data.saveClip(c); }, cid);

  head('Shoot: steps with their script, folding, the page always there');
  await lap.evaluate(id => { Screens.pop(); Screens.push('clip', { id, tab: 'shoot' }); }, cid); await lap.waitForTimeout(2000);
  ui = await lap.evaluate(t => { const s = document.querySelector(t); return { first: s.querySelector('.view > .cp-dayrow') !== null && s.querySelector('.view > .segmented ~ .cp-dayrow') !== null,
    needs: /Capture for/.test(s.textContent), rows: s.querySelectorAll('#clipShots .tk-ps').length, tw: [...s.querySelectorAll('#clipShots .tk-tw')].map(x => x.textContent.trim()),
    beats: [...s.querySelectorAll('#clipShots .tk-beat')].map(x => x.textContent.trim()), page: !!s.querySelector('#clipShots .tkp-cwrap:not([hidden]) canvas'),
    flow: [...s.querySelectorAll('.view > details > summary')].map(x => x.firstChild.textContent.trim()) }; }, top);
  ok(ui.first && !ui.needs, 'the shoot day row comes first; Capture for N versions is gone');
  ok(ui.rows === 6 && ui.page, 'Steps beside the Shot page');
  ok(ui.tw[3] === 'Script · 2' && ui.tw[0] === 'Script · 1', 'each step has a Script twirl with its line count', ui.tw.join(' | '));
  ok(ui.beats.length === 6 && ui.beats[0] === 'Hook' && ui.beats[4] === 'Payoff', 'the beat names head the steps', ui.beats.join(' · '));
  ok(!ui.flow.includes('Script') && !ui.flow.includes('Flow'), 'no separate Flow or Script on Shoot', ui.flow.join(' · '));
  await lap.click(`${top} #clipShots [data-twirl="3"]`); await lap.waitForTimeout(900);
  ui = await lap.evaluate(t => [...document.querySelectorAll(t + ' #clipShots .tk-lines .tk-lt')].map(x => x.value), top);
  ok(ui.length === 2 && ui[1] === 'WATER · LIGHT · ONE PAGE', 'the twirl opens its lines under the step', ui.join(' | '));
  await lap.click(`${top} #clipShots [data-tladd="3"]`); await lap.waitForTimeout(1200);
  await lap.fill(`${top} #clipShots [data-tlt="3:2"]`, 'Now the phone waits.');
  await lap.dispatchEvent(`${top} #clipShots [data-tlt="3:2"]`, 'change'); await lap.waitForTimeout(1200);
  r = await clipRec(cid);
  ok(steps(r)[3].lines.length === 3 && steps(r)[3].lines[2].t === 'Now the phone waits.', 'a line added under a step is saved on the clip');
  await lap.screenshot({ path: path.join(out, 'script-shoot-tab.png'), fullPage: false });
  await lap.click(`${top} #clipShots [data-a="rowsfold"]`); await lap.waitForTimeout(900);
  ui = await lap.evaluate(t => ({ rows: document.querySelectorAll(t + ' #clipShots .tk-ps').length, bar: (document.querySelector(t + ' #clipShots .tk-rowsbar') || {}).textContent || '',
    page: !!document.querySelector(t + ' #clipShots .tkp-cwrap canvas'), next: !!document.querySelector(t + ' #clipShots .tkp-next') }), top);
  ok(ui.rows === 0 && /6 shots · 0 taken · next: /.test(ui.bar) && ui.page && ui.next, 'the steps fold to one line; the page and Next up stay', ui.bar.trim().replace(/\s+/g, ' '));
  await lap.evaluate(id => { Screens.pop(); Screens.push('clip', { id, tab: 'shoot' }); }, cid); await lap.waitForTimeout(1800);
  ok(await lap.evaluate(t => document.querySelectorAll(t + ' #clipShots .tk-ps').length, top) === 0, 'folded stays folded next time');
  await lap.click(`${top} #clipShots [data-a="rowsfold"]`); await lap.waitForTimeout(900);
  ok(await lap.evaluate(t => document.querySelectorAll(t + ' #clipShots .tk-ps').length, top) === 6, 'and opens again');

  head('shoot mode: the shot first, then its script');
  await lap.click(`${top} #clipShots [data-a="shootmode"]`); await lap.waitForTimeout(1200);
  ui = await lap.evaluate(() => ({ k: document.querySelector('.sr-k').textContent, tw: (document.querySelector('[data-script]') || {}).textContent || '', lines: document.querySelectorAll('.sr-line').length }));
  ok(/Shot 1 · Action · Hook/.test(ui.k) && /Script for this shot · 1 line/.test(ui.tw) && ui.lines === 0, 'the shot shows, its script waits behind a button', ui.k + ' / ' + ui.tw.trim());
  await lap.click('[data-script]'); await lap.waitForTimeout(500);
  ok(await lap.evaluate(() => document.querySelector('.sr-line span').textContent) === 'Five-fifteen. Every single day.', 'tap it and the lines show, big');
  await lap.click('[data-next]'); await lap.waitForTimeout(500); await lap.click('[data-next]'); await lap.waitForTimeout(500); await lap.click('[data-next]'); await lap.waitForTimeout(600);
  ui = await lap.evaluate(() => ({ k: document.querySelector('.sr-k').textContent, lines: [...document.querySelectorAll('.sr-line')].map(x => x.textContent) }));
  ok(ui.lines.length === 3 && /Payoff|Build/.test(ui.k) && /Text/.test(ui.lines[1]), 'it stays open from shot to shot', ui.k + ' · ' + ui.lines.length + ' lines');
  await lap.screenshot({ path: path.join(out, 'script-shootmode.png') });
  await lap.keyboard.press('s'); await lap.waitForTimeout(400);
  ok(await lap.evaluate(() => document.querySelectorAll('.sr-line').length) === 0, 'S hides it again');
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(600);

  head('a shoot day carries the lines and the beats');
  await lap.click(`${top} [data-a="toshoot"]`); await lap.waitForTimeout(800);
  await lap.click('.sheet [data-ok]'); await lap.waitForTimeout(1500);
  r = await clipRec(cid);
  const task = await lap.evaluate(id => Store.get('tasks', id), r.shootTaskId);
  ok(task && steps(task)[3].lines.length === 3 && (task.beatNames || []).length === 6, 'the shoot task has each shot\'s lines and the beat names');
  await lap.evaluate(id => Screens.push('task', { id }), task.id); await lap.waitForTimeout(1800);
  ui = await lap.evaluate(t => ({ beats: document.querySelectorAll(t + ' .tk-beat').length, tw: document.querySelectorAll(t + ' .tk-tw').length }), top);
  ok(ui.beats === 6 && ui.tw === 6, 'the task screen shows the beats and each shot\'s Script twirl');
  await lap.click(`${top} [data-fold="steps"] > h4`); await lap.waitForTimeout(800);
  ui = await lap.evaluate(t => ({ rows: document.querySelectorAll(t + ' .tk-ps').length, page: !!document.querySelector(t + ' .tkp-cwrap canvas') }), top);
  ok(ui.rows === 0 && ui.page, 'the Steps heading folds the rows; the page stays');
  await lap.click(`${top} [data-fold="steps"] > h4`); await lap.waitForTimeout(800);
  /* a tick on the shoot task shows as Taken on the clip's cut list */
  await lap.click(`${top} [data-tick="0"]`); await lap.waitForTimeout(900);
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(500);

  head('Edit: the cut list');
  await lap.evaluate(id => { Screens.pop(); Screens.push('clip', { id, tab: 'edit' }); }, cid); await lap.waitForTimeout(2000);
  ui = await lap.evaluate(t => { const s = document.querySelector(t); return { cuts: s.querySelectorAll('#clipCuts .sx-cut').length,
    beats: [...s.querySelectorAll('#clipCuts p.k')].map(x => x.textContent), said: [...s.querySelectorAll('#clipCuts .sx-cut')][3].querySelectorAll('.said .l').length,
    taken: [...s.querySelectorAll('#clipCuts .taken')].map(x => x.textContent.trim()), whole: !!s.querySelector('.view [data-f="script"]'),
    secs: [...s.querySelectorAll('.view > details > summary')].map(x => x.firstChild.textContent.trim()) }; }, top);
  ok(ui.cuts === 6 && ui.beats.length === 6 && ui.said === 3, 'every shot in story order under its beat, with the words over it');
  ok(ui.taken[0] === '✓ Taken' && ui.taken[1] === 'Not taken yet', 'filmed on the shoot task shows as Taken');
  ok(!ui.whole && ui.secs.join() === 'Cut list,Versions,Notes', 'no whole script, length or references on Edit', ui.secs.join(' · '));
  await lap.fill(`${top} #clipCuts [data-en="3"]`, 'Cut the second um'); await lap.dispatchEvent(`${top} #clipCuts [data-en="3"]`, 'change'); await lap.waitForTimeout(1200);
  r = await clipRec(cid);
  ok(steps(r)[3].editNote === 'Cut the second um', 'an edit note is kept on its shot');
  await lap.click(`${top} [data-vedit]`); await lap.waitForTimeout(700);
  r = await clipRec(cid);
  ok(r.plan.versions[0].state === 'edited', 'a version is ticked as edited');
  ok(!(await lap.$(`${top} [data-vplat]`)), 'platforms are not on Edit');

  head('Post: where each version goes');
  await lap.click(`${top} [data-ctab="post"]`); await lap.waitForTimeout(1000);
  ui = await lap.evaluate(t => { const s = document.querySelector(t); return { secs: [...s.querySelectorAll('.view > details > summary')].map(x => x.firstChild.textContent.trim()),
    plats: s.querySelectorAll('[data-vplat]').length, links: s.querySelectorAll('[data-vlink]').length, kw: !!s.querySelector('[data-f="keywords"]') }; }, top);
  ok(ui.secs.join() === 'Where each version goes,Title and thumbnail,Caption, tags and search words,What counts as working', 'Post: versions, title, caption, what counts as working', ui.secs.join(' · '));
  ok(ui.plats > 0 && ui.links === 2 && ui.kw, 'each version has its platforms and a link; search words sit with the caption');
  await lap.fill(`${top} [data-vlink]`, 'https://youtube.com/shorts/abc'); await lap.waitForTimeout(800);
  await lap.click(`${top} [data-vpost]`); await lap.waitForTimeout(800);
  r = await clipRec(cid);
  ok(r.plan.versions[0].state === 'posted' && r.plan.versions[0].link === 'https://youtube.com/shorts/abc', 'ticked as posted, with its link');
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(400);

  head('a series video is a clip, and gets the same');
  const vid = await lap.evaluate(async () => { const v = await Videos.save({ title: 'Part 2 — the kettle', hook: 'Old hook', hookT: 1 }); await ClipFlow.migrate(); return ClipFlow.idFor(v.id); });
  await lap.evaluate(id => Screens.push('clip', { id, tab: 'plan' }), vid); await lap.waitForTimeout(1800);
  await lap.click(`${top} #clipScript [data-st="pick"]`); await lap.waitForTimeout(500);
  await lap.click('.sheet [data-use="b-tutorial"]'); await lap.waitForTimeout(1500);
  let v = await lap.evaluate(id => Store.get('clips', id), vid);
  ok(v.plan.beats.length === 7 && v.page.slots.length === 7 && steps(v)[0].lines[0].t === 'Old hook', 'its beats and a shot for each; its old hook sits on shot 1', v.plan.beats.join(' → '));

  head('your own structure');
  await lap.click(`${top} #clipScript [data-st="pick"]`); await lap.waitForTimeout(500);
  await lap.click('.sheet [data-new]'); await lap.waitForTimeout(500);
  await lap.fill('.sheet [data-name]', 'Mystery reveal');
  await lap.fill('.sheet .sx-ed .nm', 'The question');
  await lap.click('.sheet [data-addb]'); await lap.waitForTimeout(300);
  await lap.fill('.sheet .sx-ed:nth-of-type(2) .nm', 'Wrong answers');
  await lap.click('.sheet [data-addb]'); await lap.waitForTimeout(300);
  await lap.fill('.sheet .sx-ed:nth-of-type(3) .nm', 'The answer');
  await lap.click('.sheet [data-ok]'); await lap.waitForTimeout(800);
  const mine = await lap.evaluate(() => Structures.custom());
  ok(mine.length === 1 && mine[0].beats.map(x => x.n).join() === 'The question,Wrong answers,The answer', 'made and saved', mine.map(x => x.n).join());
  ok(await lap.evaluate(() => !!document.querySelector('.sheet [data-use^="u"]')), 'it is in the list straight away');
  await lap.click('.sheet [data-use^="u"]'); await lap.waitForTimeout(1500);
  v = await lap.evaluate(id => Store.get('clips', id), vid);
  ok(v.plan.beats.join() === 'The question,Wrong answers,The answer' && v.page.slots.length === 7 && steps(v).map(x => x.beat).join() === '0,0,0,1,1,2,2',
    'used on a video that has shots: they spread across its beats', steps(v).map(x => x.beat).join());
  await lap.click(`${top} #clipScript [data-st="pick"]`); await lap.waitForTimeout(500);
  await lap.click('.sheet [data-edit^="u"]'); await lap.waitForTimeout(500);
  await lap.click('.sheet [data-del]'); await lap.waitForTimeout(800);
  ok((await lap.evaluate(() => Structures.custom())).length === 0, 'and deleted');
  await lap.evaluate(() => App.closeSheet()); await lap.waitForTimeout(300);
  await lap.evaluate(() => Screens.pop()); await lap.waitForTimeout(300);

  head('on a phone');
  const ph = await device('phone', false);
  const pid = await ph.evaluate(async () => {
    const c = await Data.saveClip({ title: 'Phone clip', state: 'raw', stage: 'planned', plan: { tab: 'shoot' } });
    return c.id;
  });
  await ph.evaluate(id => Screens.push('clip', { id, tab: 'plan' }), pid); await ph.waitForTimeout(1500);
  await ph.click(`${top} #clipScript [data-st="pick"]`); await ph.waitForTimeout(500);
  await ph.click('.sheet [data-use="b-transform"]'); await ph.waitForTimeout(1500);
  await ph.click(`${top} #clipScript [data-ladd="1"]`); await ph.waitForTimeout(1200);
  await ph.fill(`${top} #clipScript [data-lt="1:0"]`, 'Because the first hour is the only one nobody else gets.');
  await ph.dispatchEvent(`${top} #clipScript [data-lt="1:0"]`, 'change'); await ph.waitForTimeout(1200);
  ui = await ph.evaluate(t => { const ta = document.querySelector(t + ' #clipScript [data-lt="1:0"]'); return { w: ta.getBoundingClientRect().width, h: ta.getBoundingClientRect().height,
    side: getComputedStyle(document.querySelector(t + ' #clipScript .sx-shot .side')).display }; }, top);
  ok(ui.w >= 250 && ui.h <= 60 && ui.side === 'none', 'on a phone a line gets the width (no frame column) and wraps to two lines at most', `${Math.round(ui.w)} × ${Math.round(ui.h)} px`);
  await ph.screenshot({ path: path.join(out, 'script-phone-plan.png'), fullPage: false });
  await ph.click(`${top} [data-ctab="shoot"]`); await ph.waitForTimeout(1800);
  ui = await ph.evaluate(t => ({ page: !!document.querySelector(t + ' #clipShots .tkp-cwrap:not([hidden]) canvas'), show: !!document.querySelector(t + ' [data-a="showpage"]'),
    bar: !!document.querySelector(t + ' #clipShots .tk-rowsbar'), w: document.documentElement.scrollWidth }), top);
  ok(ui.page && !ui.show && ui.bar, 'the shot page shows on a phone, with the fold bar over the steps');
  ok(ui.w <= 412, 'nothing runs off the side', ui.w);
  await ph.click(`${top} #clipShots [data-twirl="1"]`); await ph.waitForTimeout(900);
  ui = await ph.evaluate(t => { const box = document.querySelector(t + ' #clipShots .tk-lines'), ta = box && box.querySelector('.tk-lt');
    return { box: box ? box.getBoundingClientRect().width : 0, list: document.querySelector(t + ' #clipShots .tkp-left').getBoundingClientRect().width, ta: ta ? ta.getBoundingClientRect().width : 0 }; }, top);
  ok(ui.box >= ui.list - 2 && ui.ta >= 250, 'a step\'s script opens the full width of the list, under the row', `${Math.round(ui.ta)} px for the words`);
  await ph.screenshot({ path: path.join(out, 'script-phone-shoot.png'), fullPage: false });

  head('errors');
  ok(!errs.length, 'no script errors', errs.slice(0, 3).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
