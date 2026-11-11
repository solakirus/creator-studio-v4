/* Browser test: a clip's board is its flow — one section, a card per line,
   edits / order / new cards / deletes (with Undo) go back to the clip.
     cd app && bash build-preview.sh && cd .. && xvfb-run node app/tests/browser/clipboard.browser.js /tmp */
const { chromium } = require('playwright-core');
(async () => {
  const out = process.argv[2] || '/tmp';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if (!c) fails++; };
  await p.goto('file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html')); await p.waitForTimeout(1500);
  await p.evaluate(() => Data.saveClip({ id: 'c1', title: 'Tent timelapse', plat: 'tiktok', stage: 'planned', createdAt: Date.now(),
    plan: { beats: ['Empty yard', 'Bag drops in', 'Tent rises'] } }));
  const lines = () => p.evaluate(async () => (await Store.get('clips', 'c1')).plan.beats);
  const open = async () => {
    await p.evaluate(() => BoardLink.open({ type: 'clip', id: 'c1', name: 'Tent timelapse', status: 'ready' })); await p.waitForTimeout(400);
    const fr = await p.$$('iframe.bd-frame'); const f = await fr[fr.length - 1].contentFrame();
    await f.waitForFunction(() => window.CS3Board && CS3Board.current() === 'vb-clip-c1'); await p.waitForTimeout(900); return f;
  };
  const cards = f => f.evaluate(() => CS3Board._.cardsOf(CS3Board.current()).filter(c => c.type === 'shot').map(c => ({ id: c.id, line: c.data.line, desc: c.data.desc, num: c.data.num, x: c.x })));
  let f = await open();
  let c = await cards(f);
  ok(await f.evaluate(() => CS3Board._.cardsOf(CS3Board.current()).some(c => c.type === 'frame' && c.data.flow)), 'the flow is a section');
  ok(c.length === 3 && c.map(x => x.desc).join() === 'Empty yard,Bag drops in,Tent rises', 'a card per line, in order', c.map(x => x.desc));
  await p.screenshot({ path: out + '/clipboard.png' });

  await f.evaluate(() => { const c = CS3Board._.cardsOf(CS3Board.current()).find(c => c.data.line === 1); c.data.desc = 'Bag thrown in from off-camera'; CS3Board._.save(c); });
  await p.waitForTimeout(900);
  ok((await lines())[1] === 'Bag thrown in from off-camera', 'editing a card edits the line');
  await f.evaluate(() => { const C = CS3Board._.cardsOf(CS3Board.current()); const a = C.find(c => c.data.line === 0), z = C.find(c => c.data.line === 2); const ax = a.x; a.x = z.x; z.x = ax; CS3Board._.save(a); CS3Board._.save(z); });
  await p.waitForTimeout(900);
  ok((await lines()).join() === 'Tent rises,Bag thrown in from off-camera,Empty yard', 'swapping cards reorders the flow', await lines());
  await f.evaluate(() => { const fr = CS3Board._.cardsOf(CS3Board.current()).find(c => c.type === 'frame' && c.data.flow);
    const c = CS3Board._.mk(CS3Board.current(), 'shot', fr.x + fr.w - 320, fr.y + 64, { num: '4', desc: 'Lights on inside', cam: '', dur: '', vo: '', trans: '' }, 300); CS3Board._.save(c); });
  await p.waitForTimeout(900);
  ok((await lines())[3] === 'Lights on inside', 'a card typed into the section adds a line', await lines());
  await f.evaluate(() => { const c = CS3Board._.cardsOf(CS3Board.current()).find(c => c.data.line === 1); CS3Board._.deleteCards([c.id]); });
  await p.waitForTimeout(800);
  ok((await lines()).join() === 'Tent rises,Empty yard,Lights on inside', 'deleting a card removes its line', await lines());
  await f.evaluate(() => { const t = [...document.querySelectorAll('#toast button, .toast button')].find(b => /undo/i.test(b.textContent)); if (t) t.click(); });
  await p.waitForTimeout(1000);
  ok((await lines()).join() === 'Tent rises,Bag thrown in from off-camera,Empty yard,Lights on inside', 'Undo puts it back where it was', await lines());
  c = await cards(f);
  ok(c.filter(x => x.line != null).map(x => x.line).sort().join() === '0,1,2,3', 'every card points at its own line', c.map(x => [x.line, x.desc]));

  await p.evaluate(() => App.goBack()); await p.waitForTimeout(300);
  await p.evaluate(async () => { const r = await Store.get('clips', 'c1'); r.plan.beats.push('Fade to night'); await Data.saveClip(r); });
  f = await open(); c = await cards(f);
  ok(c.length === 5 && c.some(x => x.desc === 'Fade to night'), 'a line added on the clip screen appears on the board', c.map(x => x.desc));
  ok(new Set(c.map(x => x.line)).size === 5, 'no duplicate cards');
  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
