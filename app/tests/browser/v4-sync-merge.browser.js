/* Browser test: three devices (phone, laptop, iPad) editing the same things
   between syncs — edits are combined, not saved over each other (merge.js,
   sync.js), and the same thing made on two devices is one record, not two
   (swipekey.js, folders.js, planimport.js).

     node app/tests/browser/v4-sync-merge.browser.js */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const hubMod = require('../helpers/mini-synchub');
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');

(async () => {
  const hub = await hubMod.start({ token: 'tok' });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  const device = async (name, w, skew) => {
    const ctx = await b.newContext({ viewport: { width: w, height: 860 } });
    if(skew) await ctx.addInitScript(ms => { const n = Date.now; Date.now = () => n() + ms; }, skew);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.Sync && window.Merge && window.SwipeKey, null, { timeout: 15000 });
    await p.waitForTimeout(500); return p;
  };
  /* "offline": paused, so edits wait here; online: sync once */
  const off = p => p.evaluate(() => Sync.setPaused(true));
  const on = async p => { await p.evaluate(() => Sync.setPaused(false)); return p.evaluate(() => Sync.syncNow()); };
  const syncAll = async (...ds) => { for(const d of ds) await on(d); for(const d of ds) await on(d); };
  const vlog = p => p.evaluate(async () => Store.get('vlogs', 'v1'));

  const LAP = await device('laptop', 1280), PH = await device('phone', 400), PAD = await device('ipad', 1024);
  await LAP.evaluate(async () => {
    await Store.put('vlogs', { id:'v1', title:'Week 1', week:1, acts:[
      { id:'a1', title:'Mon', beats:[{ id:'b1', title:'Wake up', shots:[{ id:'s1', text:'Alarm' }, { id:'s2', text:'Coffee' }] }] },
      { id:'a2', title:'Tue', beats:[] } ] });
  });
  await LAP.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url);
  await PH.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url);
  await PAD.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url);
  ok(!!(await vlog(PAD)), 'all three have the week');

  head('three devices edit different parts of the same week while apart');
  await Promise.all([off(LAP), off(PH), off(PAD)]);
  await PH.evaluate(async () => { const v = await Store.get('vlogs', 'v1'); v.acts[0].beats[0].shots[0].text = 'Alarm at 5am'; await Store.put('vlogs', v); });
  await LAP.evaluate(async () => { const v = await Store.get('vlogs', 'v1'); v.title = 'Week 1: Show up'; v.acts[1].beats.push({ id:'b2', title:'Gym', shots:[] }); await Store.put('vlogs', v); });
  await PAD.evaluate(async () => { const v = await Store.get('vlogs', 'v1'); v.acts[0].beats[0].shots.push({ id:'s3', text:'Cold shower' }); v.acts[0].beats[0].shots.splice(1, 1); await Store.put('vlogs', v); });
  await syncAll(PH, LAP, PAD);
  for(const [n, d] of [['phone', PH], ['laptop', LAP], ['iPad', PAD]]){
    const v = await vlog(d);
    const shots = v.acts[0].beats[0].shots.map(s => s.text).join(', ');
    ok(v.title === 'Week 1: Show up' && shots === 'Alarm at 5am, Cold shower' && v.acts[1].beats.length === 1,
      `the ${n} has every edit: title, renamed shot, new sequence, added and deleted shots`, `${v.title} | ${shots} | Tue: ${v.acts[1].beats.map(x => x.title)}`);
  }
  const pend = await Promise.all([PH, LAP, PAD].map(d => d.evaluate(() => Sync.status().then(s => s.pending))));
  ok(pend.every(n => n === 0), 'nothing left waiting on any device', pend.join(','));

  head('the same detail changed on two devices');
  await Promise.all([off(LAP), off(PH)]);
  await PH.evaluate(async () => { const v = await Store.get('vlogs', 'v1'); v.acts[0].beats[0].title = 'Rise (phone)'; await Store.put('vlogs', v); });
  await LAP.waitForTimeout(30);
  await LAP.evaluate(async () => { const v = await Store.get('vlogs', 'v1'); v.acts[0].beats[0].title = 'Rise (laptop)'; await Store.put('vlogs', v); });
  await syncAll(PH, LAP, PAD);
  const t = await Promise.all([PH, LAP, PAD].map(async d => (await vlog(d)).acts[0].beats[0].title));
  ok(t.every(x => x === 'Rise (laptop)'), 'the newer edit is on every device', t.join(' / '));
  const cf = await LAP.evaluate(() => Sync.conflicts());
  ok(cf.length === 1 && cf[0].other === 'Rise (phone)' && cf[0].label === 'Week 1: Show up', 'the other one is kept, named by its week', JSON.stringify(cf.map(c => [c.label, c.other])));
  /* through the screens: Settings → Sync → Changed on two devices → Use the other one */
  await LAP.evaluate(() => Screens.push('settings', {})); await LAP.waitForTimeout(700);
  await LAP.click('[data-go="sync"]'); await LAP.waitForTimeout(500);
  ok(/Changed on two devices \(1\)/.test(await LAP.textContent('#sheet')), 'Settings → Sync says one thing was changed on two devices');
  await LAP.click('#sheet [data-conflicts]'); await LAP.waitForTimeout(400);
  const card = (await LAP.textContent('#sheet')).replace(/\s+/g, ' ');
  ok(/Vlog · Week 1: Show up/.test(card) && /Kept: Rise \(laptop\)/.test(card) && /Other device: Rise \(phone\)/.test(card),
    'it shows what was kept and what the other device had', card.slice(0, 160));
  await LAP.click('#sheet [data-use="0"]'); await LAP.waitForTimeout(600);
  await LAP.evaluate(() => App.closeSheet()); await LAP.evaluate(() => Screens.pop && Screens.pop());
  await syncAll(LAP, PH, PAD);
  const t2 = await Promise.all([PH, LAP, PAD].map(async d => (await vlog(d)).acts[0].beats[0].title));
  ok(t2.every(x => x === 'Rise (phone)'), 'bringing it back puts it on every device', t2.join(' / '));
  ok((await LAP.evaluate(() => Sync.conflicts())).length === 0, 'and it leaves the list');

  head('a phone whose clock is an hour slow');
  const SLOW = await device('slow phone', 400, -3600 * 1000);
  await SLOW.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url);
  await LAP.evaluate(async () => { const v = await Store.get('vlogs', 'v1'); v.passLine = 'From the laptop'; await Store.put('vlogs', v); await Sync.syncNow(); });
  await SLOW.evaluate(() => Sync.syncNow());
  await SLOW.evaluate(async () => { const v = await Store.get('vlogs', 'v1'); v.passLine = 'From the slow phone, after'; await Store.put('vlogs', v); await Sync.syncNow(); });
  await LAP.evaluate(() => Sync.syncNow());
  ok((await vlog(LAP)).passLine === 'From the slow phone, after', 'its newer edit still wins: stamped after what it had seen', (await vlog(LAP)).passLine);

  head('folders made on two devices at once');
  await Promise.all([off(LAP), off(PH)]);
  await PH.evaluate(async () => { await SwipeFolders.create('Cars'); await SwipeFolders.create('Gym'); });
  await LAP.evaluate(async () => { await SwipeFolders.create('Cars'); await SwipeFolders.create('Food'); });
  await syncAll(PH, LAP, PAD);
  for(const [n, d] of [['phone', PH], ['laptop', LAP], ['iPad', PAD]]){
    const names = await d.evaluate(async () => { SwipeFolders.invalidate(); return (await SwipeFolders.all()).map(f => f.name).sort().join(','); });
    ok(names === 'Cars,Food,Gym', `the ${n} has every folder, "Cars" once`, names);
  }

  head('the same save added on two devices');
  await Promise.all([off(LAP), off(PH)]);
  const link = 'https://www.instagram.com/reel/ABCdef123/?igsh=xyz';
  await PH.evaluate(async u => Store.put('swipes', { id:SwipeKey.idFor(u), url:u, title:'From the phone', myAngle:'My angle', createdAt:1 }), link);
  await LAP.evaluate(async u => Store.put('swipes', { id:SwipeKey.idFor(u.replace('?igsh=xyz', '')), url:u.replace('?igsh=xyz', ''), title:'Untitled swipe', folders:['fd_x'], createdAt:2 }), link);
  await syncAll(PH, LAP, PAD);
  const sw = await PAD.evaluate(async () => (await Store.all('swipes')).values);
  ok(sw.length === 1 && sw[0].title === 'From the phone' && sw[0].myAngle === 'My angle' && (sw[0].folders || []).includes('fd_x'),
    'one swipe, with the phone\'s title and note and the laptop\'s folder', JSON.stringify(sw.map(s => [s.id, s.title, s.myAngle, s.folders])));

  head('doubles from before: Merge doubles');
  await LAP.evaluate(async () => {
    const u = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    await Store.put('swipes', { id:'sw_old1', url:u, title:'Untitled swipe', folders:['fd_a'], createdAt:10 });
    await Store.put('swipes', { id:'sw_old2', url:'https://youtu.be/dQw4w9WgXcQ', title:'Never gonna', myAngle:'Use the hook', folders:['fd_b'], createdAt:20 });
    await Store.put('swipe-thumb', new Blob(['x'], { type:'image/png' }), 'sw_old2');
    await Store.put('tasks', { id:'tk1', title:'Study it', day:1, view:'todo', subs:[], swipeId:'sw_old2' });
  });
  await LAP.evaluate(() => App.go('series')); await LAP.waitForTimeout(600);
  await LAP.click('.ctnav [data-v="swipe"]'); await LAP.waitForTimeout(900);
  ok(/1 swipe is in here twice/.test(await LAP.textContent('#ctWrap')), 'the swipe file says so');
  await LAP.click('[data-a="mergedoubles"]'); await LAP.waitForTimeout(900);
  const m = await LAP.evaluate(async () => ({ sw:(await Store.all('swipes')).values.filter(s => /dQw4/.test(s.url)),
    thumb:!!(await Store.get('swipe-thumb', 'sw_old1')), task:(await Store.get('tasks', 'tk1')).swipeId }));
  ok(m.sw.length === 1 && m.sw[0].id === 'sw_old1' && m.sw[0].title === 'Never gonna' && m.sw[0].myAngle === 'Use the hook'
    && m.sw[0].folders.join() === 'fd_a,fd_b', 'one left, with both folders and the note', JSON.stringify(m.sw.map(s => [s.id, s.title, s.folders])));
  ok(m.thumb && m.task === 'sw_old1', 'its cover moved over, and the task now points at it');
  await syncAll(LAP, PH, PAD);
  ok((await PH.evaluate(async () => (await Store.all('swipes')).values.filter(s => /dQw4/.test(s.url)).length)) === 1, 'and the phone has one too');

  head('the same plan imported on two devices');
  const plan = JSON.stringify({ format:'creator-studio-phase-plan', episodes:[{ title:'Day One', weekOf:'2027-01-03', acts:[{ title:'Sun', sequences:[{ title:'Intro', shots:['Wide of the street'] }] }] }] });
  await Promise.all([off(LAP), off(PH)]);
  for(const d of [PH, LAP]) await d.evaluate(async t => { const pv = await PlanImport.preview(PlanImport.parseAny(t)); await PlanImport.apply(pv); }, plan);
  await syncAll(PH, LAP, PAD);
  const eps = await PAD.evaluate(async () => (await Store.all('vlogs')).values.filter(v => v.title === 'Day One').map(v => ({ id:v.id, seqs:v.acts.flatMap(a => a.beats).length })));
  ok(eps.length === 1 && eps[0].seqs === 1, 'one episode, its sequence once', JSON.stringify(eps));

  head('the saved check');
  await syncAll(PH, LAP, PAD);
  await PH.evaluate(() => Screens.push('settings', {})); await PH.waitForTimeout(700);
  await PH.click('[data-go="sync"]'); await PH.waitForTimeout(500);
  ok(!!(await PH.$('#sheet [data-allsaved]')), 'the phone says everything on it is saved on nastime');

  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close(); await hub.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
