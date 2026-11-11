/* Browser test: bringing data in.
   1. A real Storyboard "Export everything" file (made by running the original
      app) imports into Boards; a board linked to an episode in v2 (boardId) and
      one named like a clip join those videos' boards.
   2. A plan pack from the laptop Planner opens, twice, without duplicating.
     cd app && bash build-preview.sh && cd .. && STORYBOARD=path/to/storyboard/www/index.html \
       xvfb-run node app/tests/browser/import.browser.js /tmp */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2] || '/tmp';
  const SB = process.env.STORYBOARD || '/home/claude/sb/storyboard-app/www/index.html';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  let fails = 0;
  const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + JSON.stringify(x) : ''}`); if (!c) fails++; };

  // 1a. make a Storyboard export the way the app does: its own items, plus two boards
  const sb = await b.newPage();
  await sb.goto('file://' + path.resolve(SB)); await sb.waitForTimeout(1500);
  const exp = await sb.evaluate(async () => {
    const db = await new Promise(r => { const q = indexedDB.open('storyboard-canvas', 1); q.onsuccess = () => r(q.result); });
    const items = await new Promise(r => { const q = db.transaction('items').objectStore('items').getAll(); q.onsuccess = () => r(q.result); });
    const root = items.find(i => i.kind === 'board' && !i.parent);
    const uid = () => Math.random().toString(36).slice(2, 11);
    const ep = { id: 'sbEP' + uid(), kind: 'board', name: 'Linked by id', parent: root.id, view: null, status: 'scripted', due: '2026-10-18' };
    const cl = { id: 'sbCL' + uid(), kind: 'board', name: 'Tent timelapse', parent: root.id, view: null, status: 'idea' };
    const note = { id: uid(), kind: 'card', board: ep.id, type: 'note', x: 0, y: 0, w: 240, z: 5, color: 'tape', data: { text: 'Planned in Storyboard' } };
    const shot = { id: uid(), kind: 'card', board: cl.id, type: 'shot', x: 0, y: 0, w: 300, z: 6, color: '', data: { num: '1', cam: 'Wide', desc: 'Sun moves over the tent', dur: '0:05' } };
    return { app: 'storyboard', version: 1, exportedAt: new Date().toISOString(), items: [...items, ep, cl, note, shot], epId: ep.id };
  });
  const file = path.join(out, 'storyboard-export.json');
  fs.writeFileSync(file, JSON.stringify({ app: exp.app, version: exp.version, exportedAt: exp.exportedAt, items: exp.items }));
  await sb.close();

  const p = await b.newPage({ viewport: { width: 1100, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../../../creator-studio-preview.html')); await p.waitForTimeout(1500);
  await p.evaluate(async epBoard => {
    await Store.put('vlogs', { id: 'v7', title: 'Some other title', boardId: epBoard, acts: [] });
    await Store.put('clips', { id: 'c7', title: 'Tent timelapse', plat: 'tiktok', state: 'raw', stage: 'planned', createdAt: Date.now() });
    Data.invalidate();
  }, exp.epId);

  console.log('\nStoryboard export');
  await p.evaluate(() => BoardLink.open({ side: true })); await p.waitForTimeout(1500);
  let frames = await p.$$('iframe.bd-frame'); let f = await frames[frames.length - 1].contentFrame();
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), f.click('#sideImport, button:has-text("Import a board or backup")')]);
  await fc.setFiles(file); await p.waitForTimeout(3500);
  const r = await f.evaluate(() => { const I = [...CS3Board.items().values()];
    const vb = id => I.find(i => i.id === id);
    return { epBoard: vb('vb-vlog-v7') && { status: vb('vb-vlog-v7').status, due: vb('vb-vlog-v7').due, parent: vb('vb-vlog-v7').parent },
      epCards: I.filter(i => i.board === 'vb-vlog-v7').map(i => i.data && i.data.text).filter(Boolean),
      clipCards: I.filter(i => i.board === 'vb-clip-c7').map(i => i.data && i.data.desc).filter(Boolean),
      leftovers: I.filter(i => i.kind === 'board' && /Linked by id|Tent timelapse/.test(i.name) && !i.video).length,
      imported: I.filter(i => i.kind === 'board' && /\(imported\)/.test(i.name || '')).map(i => i.name) }; });
  ok(r.epBoard && r.epCards.includes('Planned in Storyboard'), "a board linked to an episode in v2 joins that episode's board", r);
  ok(r.epBoard && r.epBoard.status === 'scripted' && r.epBoard.due === '2026-10-18', 'its pipeline status and due date come along');
  ok(r.clipCards.includes('Sun moves over the tent'), "a board named like a clip joins the clip's board");
  ok(r.leftovers === 0, 'no leftover copies of the joined boards');
  ok(r.imported.length === 1, 'everything else arrives as one "(imported)" board', r.imported);
  await p.screenshot({ path: out + '/import-boards.png' });
  await p.evaluate(() => App.goBack()); await p.waitForTimeout(300);

  console.log('\nplan pack');
  const pack = { format: 'creator-studio-plan', v: 1, source: 'planner', createdAt: new Date().toISOString(),
    records: { refs: [], vlogs: [], clips: [], series: [], tasks: [{ uid: 'pl_t_1', title: 'Backyard camp-out', date: '2026-10-11', at: '09:00', kind: 'shoot', mins: 240, subs: ['Put up the tent'],
      shots: [{ uid: 'pl_s_1', name: 'Stake the corners', action: 'Put up the tent', location: 'Backyard',
        angles: [{ uid: 'pl_a_1', type: 'close', n: 'Close-up', angle: 'Low', movement: 'Handheld', cam: 'B' }] }] }] },
    removed: { tasks: [], vlogs: [], clips: [], series: [], refs: [] } };
  const pf = path.join(out, 'plan-pack.json'); fs.writeFileSync(pf, JSON.stringify(pack));
  await p.evaluate(() => Screens.push('settings', {})); await p.waitForTimeout(500);
  for (const round of [1, 2]) {
    const [c2] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-go="planpack"]')]);
    await c2.setFiles(pf); await p.waitForTimeout(800);
    const sheet = await p.evaluate(() => document.querySelector('#sheet').innerText);
    console.log(`  round ${round}:`, sheet.split('\n').filter(Boolean).slice(0, 3).join(' | '));
    const btn = await p.$('#sheet [data-go]:not([disabled])');
    if (btn) { await btn.click(); await p.waitForTimeout(800); } else await p.click('#sheet [data-cancel]');
    if (round === 2) ok(/Already up to date|Nothing to change/.test(sheet), 'opening it again changes nothing');
  }
  const t = await p.evaluate(async () => (await Data.tasks()).filter(t => t.uid === 'pl_t_1').map(t => ({ title: t.title, shot: t.shots[0].text, id: t.shots[0].id, type: t.shots[0].angles[0].type })));
  ok(t.length === 1 && t[0].shot === 'Stake the corners' && /^sh_/.test(t[0].id) && t[0].type === 'close', 'one task, its shot named, typed and given an id', t);

  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
