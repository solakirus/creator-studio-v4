/* Browser test: v2-shaped shots (no ids) get ids saved at start-up, a shoot
   task is linked to its sequence, the shot list shows the pair once, and a
   location set on one lands on both. Then the shot screens open cleanly.
     cd app && bash build-preview.sh && cd .. && xvfb-run node app/tests/browser/shots.browser.js /tmp */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  const p = await b.newPage({ viewport: { width: 412, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const url = 'file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html');
  await p.goto(url); await p.waitForTimeout(1500);
  const day = await p.evaluate(() => Data.currentDay());
  await p.evaluate(async day => {   // write raw, exactly as v2 left it: no ids anywhere
    const d = await Store.db();
    await new Promise(res => { const t = d.transaction(['tasks','vlogs'], 'readwrite');
      t.objectStore('vlogs').put({ id:'v1', title:'Week 2', acts:[{ id:'a1', title:'Saturday', beats:[{ id:'b1', title:'Tent', day, taskId:40,
        shots:[{ text:'Lay out parts', framing:'Wide' }, { text:'Stake corners', framing:'Close' }, { text:'Not sent yet' }] }] }] });
      t.objectStore('tasks').put({ id:40, day, title:'Tent', cad:'Week 2 · Saturday', pri:'med', mins:0, prog:'', at:null, kind:'shoot', beatId:'b1', vlogId:'v1', view:'todo', subs:[{t:'Lay out parts',done:false},{t:'Stake corners',done:false}],
        shots:[{ name:'Lay out parts', angles:[{ n:'Wide', done:true }, { n:'Medium' }] }, { name:'Stake corners', angles:[{ n:'Close' }] }] });
      t.oncomplete = res; });
  }, day);
  await p.reload(); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    const d = await Store.db();
    const raw = (s, k) => new Promise(res => { const q = d.transaction(s).objectStore(s).get(k); q.onsuccess = () => res(q.result); });
    const t = await raw('tasks', 40), v = await raw('vlogs', 'v1');
    const all = await Shots.gather();
    const tent = all.filter(s => s.sourceId === 40 || s.vlogId === 'v1');
    const first = tent.find(s => s.name === 'Lay out parts');
    await Shots.setLocation(first, 'Backyard');
    const t2 = await raw('tasks', 40), v2 = await raw('vlogs', 'v1');
    return {
      savedTaskIds: t.shots.map(s => s.id), savedText: t.shots.map(s => s.text), savedTypes: t.shots.map(s => (s.angles||[]).map(a => a.type).join('+')), savedBeatIds: v.acts[0].beats[0].shots.map(s => s.id),
      linked: t.shots.map(s => s.src && s.src.shot), listed: tent.map(s => `${s.source}:${s.name}`),
      locTask: t2.shots[0].location, locBeat: v2.acts[0].beats[0].shots[0].location
    };
  });
  console.log(JSON.stringify(r, null, 1));
  for (const [screen, params] of [['shots-console', {}], ['shot-list', {}], ['task', { id: 40 }], ['vlog', { id: 'v1' }], ['vlog-day', { vlogId: 'v1', actId: 'a1' }]]) {
    await p.evaluate(([s, o]) => Screens.push(s, o), [screen, params]); await p.waitForTimeout(700);
    await p.screenshot({ path: `${process.argv[2]}/shots-${screen}.png` });
    const bad = await p.evaluate(() => /\bundefined\b/i.test(document.getElementById('screens').innerText));
    console.log(`${screen}: ${bad ? 'shows "undefined"' : 'clean'}`);
    await p.evaluate(() => App.goBack()); await p.waitForTimeout(300);
  }
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
