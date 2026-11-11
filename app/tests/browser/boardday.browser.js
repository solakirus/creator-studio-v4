/* Browser test: one day of the episode, on the episode's board.
     cd app && bash build-preview.sh && cd .. && xvfb-run node app/tests/browser/boardday.browser.js */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html'));
  await p.waitForTimeout(1500);
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if (!c) fails++; };

  /* a week with two days, each with its own sequence */
  await p.evaluate(async () => {
    await Store.put('vlogs', { id: 'v9', title: 'Week 42', week: 42, acts: [
      { id:'aMon', title:'Monday', day:1, beats:[
        { id:'bMon', title:'Put up the tent', shots:[
          { id:'s1', text:'Stake the corners', framing:'Wide' },
          { id:'s2', text:'Hands on the pole', framing:'Close' }] } ] },
      { id:'aTue', title:'Tuesday', day:2, beats:[
        { id:'bTue', title:'Cook over the fire', shots:[
          { id:'s3', text:'Strike the match', framing:'Close' }] } ] }
    ] });
    Data.invalidate();
  });

  const open = async opts => {
    await p.evaluate(o => BoardLink.open(o), opts);
    await p.waitForTimeout(400);
    const all = await p.$$('iframe.bd-frame'); const f = await all[all.length - 1].contentFrame();
    await f.waitForFunction(() => window.CS3Board && CS3Board.current() === 'vb-vlog-v9');
    await p.waitForTimeout(1200);
    return f;
  };
  const frames = f => f.evaluate(() => CS3Board._.cardsOf(CS3Board.current())
    .filter(c => c.type === 'frame')
    .map(c => ({ title: c.data.title, act: c.data.act, actName: c.data.actName, x: c.x, y: c.y, w: c.w, h: c.h })));

  console.log('\nthe whole week');
  let f = await open({ type:'vlog', id:'v9', name:'Week 42' });
  let fr = await frames(f);
  ok(fr.length === 2, 'a section per sequence', fr.map(x => x.title));
  ok(fr.every(x => x.act), 'each tagged with the day it belongs to', fr.map(x => x.act));
  ok(fr.find(x => x.act === 'aMon' && x.actName === 'Monday'), 'Monday named');
  ok(fr.find(x => x.act === 'aTue' && x.actName === 'Tuesday'), 'Tuesday named');
  const whole = await f.evaluate(() => ({ ...CS3Board.view ? CS3Board.view() : {} })).catch(() => null);

  console.log('\none day');
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(400);
  f = await open({ type:'vlog', id:'v9', name:'Week 42', focus:'act:aTue' });
  const fr2 = await frames(f);
  ok(fr2.length === 2, 'the same board — not a second one, nothing dropped', fr2.length);
  const tue = fr2.find(x => x.act === 'aTue'), mon = fr2.find(x => x.act === 'aMon');
  ok(tue && mon, 'both days still there');
  ok(mon.y !== tue.y, 'laid out one day below the other', [mon.y, tue.y]);

  /* the view is what should have changed: Tuesday's row centred in the stage */
  const where = await f.evaluate(acty => {
    const st = document.querySelector('.stage') || document.body;
    const r = st.getBoundingClientRect();
    const row = CS3Board._.cardsOf(CS3Board.current()).find(c => c.type === 'frame' && c.data.act === acty);
    const el = document.querySelector(`[data-id="${row.id}"]`);
    if (!el) return { seen:false };
    const q = el.getBoundingClientRect();
    return { seen:true, inView: q.top < r.bottom && q.bottom > r.top && q.left < r.right && q.right > r.left,
             midY: (q.top + q.bottom) / 2, stageMidY: (r.top + r.bottom) / 2, h: r.height };
  }, 'aTue');
  ok(where.seen, 'Tuesday’s row is on the stage');
  ok(where.inView, 'and in view', where);
  ok(Math.abs(where.midY - where.stageMidY) < where.h / 3, 'roughly centred, not just somewhere',
    Math.round(Math.abs(where.midY - where.stageMidY)) + 'px off centre');

  console.log('\nlooking does not change anything');
  await p.evaluate(() => Screens.pop()); await p.waitForTimeout(500);
  const after = await p.evaluate(async () => (await Store.get('vlogs', 'v9')).acts
    .map(a => ({ day:a.title, beats:a.beats.length, shots:a.beats[0].shots.length })));
  ok(JSON.stringify(after) === JSON.stringify([
    { day:'Monday', beats:1, shots:2 }, { day:'Tuesday', beats:1, shots:1 }]),
    'the episode is untouched', after);

  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})();
