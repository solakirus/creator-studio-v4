/* Browser test: an episode's board is its shots.
     cd app && bash build-preview.sh && cd .. && xvfb-run node app/tests/browser/boardsync.browser.js /tmp */
const { chromium } = require('playwright-core');
(async () => {
  const out = process.argv[2] || '/tmp';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html')); await p.waitForTimeout(1500);
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if (!c) fails++; };

  // an episode with two sequences; the first was sent to the task list and half filmed
  await p.evaluate(async () => {
    const still = color => new Promise(res => { const c = document.createElement('canvas'); c.width = 320; c.height = 180;
      const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 320, 180); g.fillStyle = '#fff'; g.font = '40px sans-serif'; g.fillText(color, 20, 100); c.toBlob(res, 'image/png'); });
    for (const [id, color, scen, fr] of [['r1', '#7a4', 'exterior', 'Wide'], ['r2', '#a47', 'hands', 'Close'], ['r3', '#47a', 'hands', 'Close']]) {
      await Store.put('refs', { id, kind: 'image', scenario: scen, framing: fr, movement: '', note: 'Ref ' + id, createdAt: Date.now() });
      await Store.put('ref-img', await still(color), id);
    }
    await Store.put('vlogs', { id: 'v1', title: 'Backyard camp-out', week: 2, acts: [{ id: 'a1', title: 'Saturday', beats: [
      { id: 'b1', title: 'Put up the tent', taskId: 40, shots: [{ id: 's1', text: 'Lay out parts', framing: 'Wide' }, { id: 's2', text: 'Stake corners', framing: 'Close' }, { id: 's3', text: 'Tarp over' }] },
      { id: 'b2', title: 'Campfire', shots: [{ id: 's4', text: 'Strike the match', framing: 'Close' }] } ] }] });
    await Store.put('tasks', { id: 40, day: 10, title: 'Put up the tent', kind: 'shoot', beatId: 'b1', vlogId: 'v1', view: 'todo', subs: [], cad: '', pri: 'med',
      shots: [{ id: 't1', text: 'Lay out parts', src: { beat: 'b1', shot: 's1' }, angles: [{ type: 'wide', done: true }, { type: 'medium', done: true }, { type: 'close', done: true }] },
              { id: 't2', text: 'Stake corners', src: { beat: 'b1', shot: 's2' }, angles: [{ type: 'wide', done: true }, { type: 'close', done: false }] }] });
    Data.invalidate();
  });

  const open = async () => {
    await p.evaluate(() => BoardLink.open({ type: 'vlog', id: 'v1', name: 'Backyard camp-out', kicker: 'Episode 2' }));
    await p.waitForTimeout(400);
    const all = await p.$$('iframe.bd-frame'); const f = await all[all.length - 1].contentFrame();
    await f.waitForFunction(() => window.CS3Board && CS3Board.current() === 'vb-vlog-v1'); await p.waitForTimeout(900);
    return f;
  };
  const vlog = () => p.evaluate(async () => (await Store.get('vlogs', 'v1')).acts[0].beats.map(b => ({ id: b.id, title: b.title, shots: b.shots.map(s => ({ id: s.id, text: s.text, framing: s.framing, refs: s.refs })) })));
  const board = f => f.evaluate(() => { const C = CS3Board._.cardsOf(CS3Board.current()); return {
    frames: C.filter(c => c.type === 'frame').map(c => ({ id: c.id, beat: c.data.beat, title: c.data.title, x: c.x, y: c.y, w: c.w, h: c.h })),
    shots: C.filter(c => c.type === 'shot').map(c => ({ id: c.id, ref: c.data.ref && c.data.ref.id, beat: c.data.ref && c.data.ref.beat, desc: c.data.desc, cam: c.data.cam, prog: c.data.prog, img: !!c.data.img, x: c.x, y: c.y })) }; });

  console.log('\nepisode → board');
  let f = await open();
  let s = await board(f);
  ok(s.frames.length === 2 && s.frames.map(x => x.title).join() === 'Put up the tent,Campfire', 'a section per sequence', s.frames.map(x => x.title));
  ok(s.shots.length === 4, 'a card per shot', s.shots.map(x => x.desc));
  const card = id => s.shots.find(x => x.ref === id);
  ok(card('s2').cam === 'Close-up' && card('s1').cam === 'Wide', 'framing becomes the shot type');
  ok(card('s1').prog.done && card('s2').prog.got === 1 && card('s2').prog.want === 2 && !card('s3').prog.sent, 'progress from Shoot mode', [card('s1').prog, card('s2').prog, card('s3').prog]);
  ok(await f.evaluate(() => [...document.querySelectorAll('.cs3-prog')].map(e => e.textContent).join('|')) === 'In the can|1/2 angles|Not shot|Not shot', 'badges on the cards');
  await p.screenshot({ path: out + '/sync-board.png' });

  console.log('\nboard → episode');
  await f.evaluate(() => { const c = CS3Board._.cardsOf(CS3Board.current()).find(c => c.data.ref && c.data.ref.id === 's3'); c.data.desc = 'Throw the tarp over'; c.data.cam = 'Top-down'; CS3Board._.save(c); });
  await p.waitForTimeout(900);
  let v = await vlog();
  ok(v[0].shots[2].text === 'Throw the tarp over' && v[0].shots[2].framing === 'Top-down', 'editing a card edits the shot', v[0].shots[2]);
  await f.evaluate(() => { const c = CS3Board._.cardsOf(CS3Board.current()).find(c => c.data.ref && c.data.ref.id === 's2'); c.data.desc = 'Stake all four corners'; CS3Board._.save(c); });
  await p.waitForTimeout(900);
  ok(await p.evaluate(async () => (await Data.tasks()).find(t => t.id === 40).shots[1].text) === 'Stake all four corners', "and its shoot task's copy");

  await f.evaluate(() => { const fr = CS3Board._.cardsOf(CS3Board.current()).find(c => c.type === 'frame' && c.data.beat === 'b2');
    const c = CS3Board._.mk(CS3Board.current(), 'shot', fr.x + 360, fr.y + 64, { num: '2', cam: 'Medium', desc: 'Marshmallow on a stick', dur: '', vo: '', trans: '' }, 300); CS3Board._.save(c); });
  await p.waitForTimeout(900);
  v = await vlog();
  ok(v[1].shots.length === 2 && v[1].shots[1].text === 'Marshmallow on a stick' && v[1].shots[1].framing === 'Medium', 'a card added in a section becomes a shot', v[1].shots);

  await f.evaluate(() => { const C = CS3Board._.cardsOf(CS3Board.current()); const fr = C.find(c => c.type === 'frame' && c.data.beat === 'b2');
    const c = C.find(c => c.data.ref && c.data.ref.id === 's3'); c.x = fr.x + 700; c.y = fr.y + 64; CS3Board._.save(c); });
  await p.waitForTimeout(900);
  v = await vlog();
  ok(v[0].shots.map(x => x.id).join() === 's1,s2' && v[1].shots.map(x => x.id).includes('s3'), 'dragging to another section moves the shot', v.map(b => b.shots.map(x => x.id)));
  ok(v[1].shots[v[1].shots.length - 1].id === 's3', 'and its place follows left-to-right order', v[1].shots.map(x => x.id));

  await f.evaluate(() => { const C = CS3Board._.cardsOf(CS3Board.current()); const a = C.find(c => c.data.ref && c.data.ref.id === 's1'), b = C.find(c => c.data.ref && c.data.ref.id === 's2');
    const ax = a.x; a.x = b.x; b.x = ax; CS3Board._.save(a); CS3Board._.save(b); });
  await p.waitForTimeout(900);
  v = await vlog();
  ok(v[0].shots.map(x => x.id).join() === 's2,s1', 'swapping two cards reorders the sequence', v[0].shots.map(x => x.id));

  await f.evaluate(() => { const fr = CS3Board._.cardsOf(CS3Board.current()).find(c => c.type === 'frame' && c.data.beat === 'b2'); fr.data.title = 'Campfire at dusk'; CS3Board._.save(fr); });
  await p.waitForTimeout(900);
  ok((await vlog())[1].title === 'Campfire at dusk', 'renaming a section renames the sequence');

  console.log('\ndeleting');
  await f.evaluate(() => { const c = CS3Board._.cardsOf(CS3Board.current()).find(c => c.data.ref && c.data.ref.id === 's4'); CS3Board._.deleteCards([c.id]); });
  await p.waitForTimeout(700);
  ok(!(await vlog())[1].shots.some(x => x.id === 's4'), 'deleting an unfilmed shot card deletes the shot');
  await f.evaluate(() => { const t = [...document.querySelectorAll('.toast button, #toast button')].find(b => /undo/i.test(b.textContent)); if (t) t.click(); });
  await p.waitForTimeout(1000);
  ok((await vlog())[1].shots.some(x => x.id === 's4'), 'Undo puts it back, same id');
  await f.evaluate(() => { const c = CS3Board._.cardsOf(CS3Board.current()).find(c => c.data.ref && c.data.ref.id === 's1'); CS3Board._.deleteCards([c.id]); });
  await p.waitForTimeout(700);
  ok((await vlog())[0].shots.some(x => x.id === 's1'), 'a shot with footage is never deleted from a board');

  console.log('\nstills');
  await f.evaluate(() => { const el = document.querySelector('.card.t-shot .frame') || document.querySelector('.card .frame'); el.click(); });
  await p.waitForSelector('.sp-host.on', { timeout: 4000 });
  await p.screenshot({ path: out + '/sync-picker.png' });
  await p.click('.sp-host [data-folder="hands"]'); await p.waitForTimeout(300);
  await p.click('.sp-host [data-step="1"]'); await p.waitForTimeout(300);
  const counter = await p.evaluate(() => document.querySelector('.sp-meta span').textContent);
  await p.click('.sp-host [data-use]'); await p.waitForTimeout(1200);
  s = await board(f);
  v = await vlog();
  const withImg = s.shots.filter(x => x.img);
  ok(counter === '2 of 2' && withImg.length >= 1, 'pick a folder, step through, use the still', counter);
  ok(v.flatMap(b => b.shots).some(x => (x.refs || [])[0] === 'r2'), "the still becomes the shot's reference (newest first, so 2 of 2 is r2)", v.flatMap(b => b.shots).map(x => x.refs));

  console.log('\nopening again');
  await p.evaluate(() => App.goBack()); await p.waitForTimeout(400);
  await p.evaluate(async () => { const v = await Store.get('vlogs', 'v1'); v.acts[0].beats[0].shots.push({ id: 's9', text: 'Zip the door', framing: 'Medium' }); await Store.put('vlogs', v); });
  f = await open();
  s = await board(f);
  ok(s.frames.length === 2, 'no duplicate sections', s.frames.length);
  ok(new Set(s.shots.map(x => x.ref).filter(Boolean)).size === s.shots.filter(x => x.ref).length, 'no duplicate cards');
  ok(s.shots.some(x => x.ref === 's9'), 'a shot added in the episode appears on the board');
  ok(s.shots.some(x => x.ref === 's1'), 'the footage shot came back');
  await p.screenshot({ path: out + '/sync-board-2.png' });

  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
