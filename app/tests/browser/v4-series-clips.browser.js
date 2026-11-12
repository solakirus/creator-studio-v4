/* Browser test: a series' videos are clips (clipflow.js), and stages move by
   themselves.

   - Old series videos become clips 'cv_<id>' once, with their hook, notes,
     tags, structure, shots (page, steps, script lines), order and stage; the
     video keeps movedTo; its shoot task points at the clip. Running it again
     makes nothing new.
   - The Series front page and the series page stay; the series page lists its
     clips as Part 1, 2… and opens one on the clip page, which says "Series ·
     name", "Part 1 of 2" and has ‹ › between parts (on the same tab).
   - A new video and several ideas at once are clips in the series.
   - Stages: on a day → Planned; every shot ticked on the shoot task → Shot
     (by itself, the clip page closed); a version cut → Editing; every version
     posted → Published. The series counts follow the stages.
   - An old video-page link lands on the clip. Removing a series drops its
     idea-stage clips and keeps the rest.

     node app/tests/browser/v4-series-clips.browser.js [out folder] */
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
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  /* the old records go in before the app starts, as an existing install would have them */
  await p.goto(url); await p.waitForFunction(() => window.App && window.ClipFlow, null, { timeout: 15000 });
  const top = '.screen:last-child';

  head('old series videos become clips');
  const S = await p.evaluate(async () => {
    await Store.put('series', { id: 'sr1', title: 'Mornings', state: 'live', cadence: 'weekly', count: 8, channel: 'Soldier of Life', createdAt: Date.now() });
    Data.invalidate('series');
    const day = await Data.currentDay();
    const P = Notebook.stepsPage('Kettle'); P.name = 'Shot sequence · Kettle';
    P.slots = [{ item: '', tone: '', text: 'Alarm off', role: 'Action', done: false }, { item: '', tone: '', text: 'Kettle on', role: 'Insert', done: false }];
    const task = { id: 7101, title: 'Shoot — The kettle', day, kind: 'shoot', view: 'todo', cad: 'One-off', pri: 'med', subs: [] };
    task.page = JSON.parse(JSON.stringify(P)); TaskPages.match(task);
    await Store.put('tasks', task);
    const raw = Store.raw || Store;
    await raw.put('videos', { id: 'vid_a', title: 'The kettle', seriesId: 'sr1', stage: 'planned', order: 1, hook: 'Five-fifteen.', hookT: 5, notes: 'Shoot early',
      tags: ['morning', '5am'], beats: ['Hook', 'Payoff'], beatGuide: ['', ''], structure: { id: 'x', name: 'Mine' }, page: P,
      subs: [{ t: 'Alarm off', done: false, shot: 0, pg: 1, beat: 0, lines: [{ k: 'vo', t: 'Five-fifteen.', hook: true }] }, { t: 'Kettle on', done: false, shot: 1, pg: 1, beat: 1 }],
      shotList: [{ text: 'Alarm off' }, { text: 'Kettle on' }], taskId: 7101, createdAt: Date.now() - 1000 });
    await raw.put('videos', { id: 'vid_b', title: 'The walk', seriesId: 'sr1', stage: 'idea', order: 2, createdAt: Date.now() });
    return { day };
  });
  const made = await p.evaluate(() => ClipFlow.migrate());
  const A = await p.evaluate(() => Store.get('clips', 'cv_vid_a'));
  ok(made === 2 && A && A.seriesId === 'sr1' && A.order === 1 && A.stage === 'planned', 'each video is a clip in its series, same stage and order', `${made} made`);
  ok(A.plan.hook === 'Five-fifteen.' && A.plan.notes === 'Shoot early' && A.plan.tags === '#morning #5am' && A.plan.beats.join() === 'Hook,Payoff' && A.plan.structure.name === 'Mine',
    'hook, notes, tags and structure come along');
  ok(A.page.slots.length === 2 && A.subs[0].lines[0].t === 'Five-fifteen.' && A.subs[1].beat === 1, 'its shots, script lines and beats too');
  const V = await p.evaluate(() => Store.get('videos', 'vid_a')), T = await p.evaluate(() => Store.get('tasks', 7101));
  ok(V.movedTo === 'cv_vid_a' && T.clipId === 'cv_vid_a' && A.shootTaskId === 7101, 'the video says where it went; its shoot task belongs to the clip');
  ok(await p.evaluate(() => ClipFlow.migrate()) === 0, 'running it again makes nothing new');

  head('the Series front page stays');
  await p.evaluate(() => App.go('series')); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('.ctnav [data-v="series"]').click()); await p.waitForTimeout(1300);
  let ui = await p.evaluate(() => ({ hero: !!document.querySelector('#ctWrap .hero2'), title: (document.querySelector('#ctWrap .page-title') || {}).textContent }));
  ok(ui.hero && ui.title === 'Series', 'the front page with its hero is there');

  head('the series page lists its clips');
  await p.evaluate(() => Screens.push('series-view', { id: 'sr1' })); await p.waitForTimeout(1400);
  ui = await p.evaluate(t => ({ cards: [...document.querySelectorAll(t + ' [data-video]')].map(x => x.querySelector('h3').textContent + ' · ' + x.querySelector('.meta .st').textContent),
    state: (document.querySelector(t + ' [data-video] .state') || {}).textContent, footage: /Footage/.test(document.querySelector(t).textContent) }), top);
  ok(ui.cards.join(' | ') === 'The kettle · Episode 1 | The walk · Episode 2', 'its videos in order, as parts', ui.cards.join(' | '));
  ok(ui.state === 'Planned' && !ui.footage, 'each shows its stage; no second "Footage" list');
  await p.click(`${top} [data-video="cv_vid_a"]`); await p.waitForTimeout(1600);
  ui = await p.evaluate(t => ({ kick: (document.querySelector(t + ' .screenbar .kick') || {}).textContent, ser: ((document.querySelector(t + ' .cp-series') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    tabs: [...document.querySelectorAll(t + ' [data-ctab]')].map(x => x.textContent).join(), screen: document.querySelector(t).dataset.screen }), top);
  ok(ui.screen === 'clip' && ui.tabs === 'Plan,Shoot,Edit,Post', 'it opens on the clip page — Plan, Shoot, Edit, Post');
  ok(ui.kick === 'Series · Mornings' && /Mornings Episode 1 of 2/.test(ui.ser), 'it says which series and which part', ui.ser);
  await p.click(`${top} [data-ctab="shoot"]`); await p.waitForTimeout(1000);
  await p.click(`${top} [data-part="1"]`); await p.waitForTimeout(1600);
  ui = await p.evaluate(t => ({ title: (document.querySelector(t + ' .cp-head .t') || {}).textContent, tab: (document.querySelector(t + ' [data-ctab][aria-selected="true"]') || {}).textContent,
    n: document.querySelectorAll('#screens > .screen').length }), top);
  ok(ui.title === 'The walk' && ui.tab === 'Shoot' && ui.n === 2, '› goes to part 2, on the same tab, in place of part 1', `${ui.title} · ${ui.tab}`);
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(700);

  head('new videos are clips in the series');
  await p.click(`${top} [data-a="newvideo"]`); await p.waitForTimeout(500);
  await p.fill('#sv-nt', 'The cold shower'); await p.click('.sheet [data-go]'); await p.waitForTimeout(1800);
  let C = await p.evaluate(() => Data.clips().then(l => l.find(c => c.title === 'The cold shower')));
  ok(C && C.seriesId === 'sr1' && C.order === 3 && (C.stage || 'idea') === 'idea', 'Add a video makes a clip in this series, next in order');
  ok(await p.evaluate(t => document.querySelector(t).dataset.screen === 'clip' && document.querySelector(t + ' [data-ctab="plan"]').getAttribute('aria-selected') === 'true', top), 'and opens it on Plan');
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(700);
  await p.click(`${top} [data-a="bulkideas"]`); await p.waitForTimeout(500);
  await p.fill('#bi-list', 'Journaling | one page\nThe walk\nCold brew');
  await p.click('.sheet [data-go]'); await p.waitForTimeout(1500);
  const titles = await p.evaluate(() => Data.clips().then(l => l.filter(c => c.seriesId === 'sr1').map(c => c.title)));
  ok(titles.includes('Journaling') && titles.includes('Cold brew') && titles.filter(x => x === 'The walk').length === 1, 'several ideas at once are clips too (one already there is skipped)', titles.join(', '));

  head('stages move by themselves');
  const cid = C.id;
  await p.evaluate(id => Screens.push('clip', { id, tab: 'plan' }), cid); await p.waitForTimeout(1300);
  await p.click(`${top} #clipScript [data-st="pick"]`); await p.waitForTimeout(400); await p.click('.sheet [data-use="b-transform"]'); await p.waitForTimeout(1500);
  await p.click(`${top} [data-ctab="shoot"]`); await p.waitForTimeout(1200);
  await p.click(`${top} [data-a="toshoot"]`); await p.waitForTimeout(600); await p.click('.sheet [data-ok]'); await p.waitForTimeout(1600);
  C = await p.evaluate(id => Store.get('clips', id), cid);
  ok(C.stage === 'planned', 'put on a day → Planned', C.stage);
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(500);
  await p.evaluate(async tid => { const t = await Store.get('tasks', tid); t.subs.forEach(x => x.done = true); t.view = 'done'; await Store.put('tasks', t); }, C.shootTaskId);
  await p.waitForTimeout(1500);
  C = await p.evaluate(id => Store.get('clips', id), cid);
  ok(C.stage === 'shot', 'every shot ticked on the shoot task → Shot, with the clip page closed', C.stage);
  await p.evaluate(async id => { const c = await Store.get('clips', id); c.plan.versions = [Versions.make('short', []), Versions.make('custom', [], 'Teaser')]; await Data.saveClip(c); }, cid);
  await p.waitForTimeout(900);
  await p.evaluate(id => Screens.push('clip', { id, tab: 'edit' }), cid); await p.waitForTimeout(1500);
  await p.click(`${top} [data-vedit]`); await p.waitForTimeout(900);
  C = await p.evaluate(id => Store.get('clips', id), cid);
  ok(C.stage === 'editing', 'a version cut → Editing', C.stage);
  await p.click(`${top} [data-ctab="post"]`); await p.waitForTimeout(900);
  await p.click(`${top} [data-vpost]:nth-of-type(1)`).catch(() => {});
  await p.evaluate(t => document.querySelectorAll(t + ' [data-vpost]').forEach((b, i) => { if(i) b.click(); }), top);
  await p.waitForTimeout(400);
  await p.evaluate(t => { const b = document.querySelectorAll(t + ' [data-vpost]'); if(b[0] && !b[0].classList.contains('posted')) b[0].click(); }, top);
  await p.waitForTimeout(1200);
  C = await p.evaluate(id => Store.get('clips', id), cid);
  ok(C.plan.versions.every(v => v.state === 'posted') && C.stage === 'published', 'every version posted → Published', C.stage);
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(600);
  const run = await p.evaluate(() => Data.seriesWithProgress().then(l => l.find(x => x.id === 'sr1')));
  ok(run.done === 1 && run.raw === 0, 'the series counts follow the stages (ideas are not "to edit")', `published ${run.done}, to edit ${run.raw}, to post ${run.queued}`);

  head('an old link, and removing a series');
  await p.evaluate(() => Screens.push('video-page', { id: 'vid_b' })); await p.waitForTimeout(1600);
  ui = await p.evaluate(t => ({ screen: document.querySelector(t).dataset.screen, title: (document.querySelector(t + ' .cp-head .t') || {}).textContent }), top);
  ok(ui.screen === 'clip' && ui.title === 'The walk', 'an old video-page link opens the clip');
  await p.evaluate(() => { while(Screens.depth()) Screens.pop(); }); await p.waitForTimeout(600);
  const res = await p.evaluate(() => ViewSeries.remove(['sr1']));
  const left = await p.evaluate(() => Data.clips().then(l => l.map(c => c.title + ':' + (c.seriesId || '-'))));
  ok(!left.some(x => x.endsWith(':sr1')) && left.includes('The kettle:-') && left.includes('The cold shower:-') && !left.some(x => x.startsWith('The walk:') || x.startsWith('Cold brew:')),
    'removing the series drops its ideas and keeps the work further along', `${res.dropped} dropped, ${res.kept} kept`);

  head('errors');
  ok(!errs.length, 'no script errors', errs.slice(0, 3).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
