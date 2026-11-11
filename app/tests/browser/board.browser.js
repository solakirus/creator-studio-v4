/* Browser test: the canvas inside the app.
   Content → Boards shows the boards list; an episode's Board button opens its
   own board (made once, in a Videos folder); a clip's too; boards are in the
   app's database and in Export everything.
     cd app && bash build-preview.sh && cd .. && xvfb-run node app/tests/browser/board.browser.js /tmp */
const { chromium } = require('playwright-core');
(async () => {
  const out = process.argv[2] || '/tmp';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: false });
  const p = await b.newPage({ viewport: { width: 412, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('frameattached', f => {});
  await p.goto('file://' + require('path').resolve(__dirname, '../../../creator-studio-preview.html')); await p.waitForTimeout(1500);
  const frameOf = async () => { await p.waitForSelector('iframe.bd-frame', { timeout: 5000 }); const all = await p.$$('iframe.bd-frame'); const f = await all[all.length - 1].contentFrame(); await f.waitForFunction(() => window.CS3Board && !!window.CS3Board.current(), null, { timeout: 8000 }); return f; };

  // Content → Boards
  await p.click('#tabbar .tab:nth-child(4)'); await p.waitForTimeout(500);
  await p.click('.ctnav [data-v="boards"]'); await p.waitForTimeout(400);
  let f = await frameOf(); await p.waitForTimeout(600);
  console.log('Content → Boards:', await f.evaluate(() => ({ crumbs: document.querySelector('#crumbs').innerText.replace(/\s+/g, ' '), boardsList: !document.querySelector('#side').hidden, theme: document.documentElement.dataset.theme, cs3: document.documentElement.dataset.cs3 })));
  await p.screenshot({ path: out + '/board-content.png' });

  // an episode
  await p.evaluate(() => Store.put('vlogs', { id: 'v1', title: 'Backyard camp-out', week: 2, acts: [{ id: 'a1', title: 'Saturday', beats: [{ id: 'b1', title: 'Tent', shots: [{ text: 'Lay out parts' }] }] }] }));
  await p.evaluate(() => Screens.push('vlog', { id: 'v1' })); await p.waitForTimeout(700);
  await p.screenshot({ path: out + '/board-episode-bar.png' });
  await p.click('[data-a="mode-board"]'); await p.waitForTimeout(400);
  f = await frameOf(); await p.waitForTimeout(500);
  const ep = await f.evaluate(() => ({ board: CS3Board.current(), crumbs: document.querySelector('#crumbs').innerText.replace(/\s+/g, ' '), title: document.querySelector('#boardTitle').value }));
  console.log('Episode board:', ep);
  // put a note on it, like a person would, through the canvas's own add path
  await f.evaluate(() => { const it = CS3Board.items(); });
  await p.screenshot({ path: out + '/board-episode.png' });
  await p.evaluate(() => App.goBack()); await p.waitForTimeout(400);
  await p.click('[data-a="mode-board"]'); await p.waitForTimeout(400);
  f = await frameOf();
  console.log('Second open, same board:', await f.evaluate(() => CS3Board.current()) === ep.board);
  await p.evaluate(() => { App.goBack(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { App.goBack(); }); await p.waitForTimeout(300);

  // a clip
  const clipId = await p.evaluate(async () => { const c = { id: 'c1', title: 'Tent timelapse', plat: 'tiktok', state: 'raw', stage: 'planned', createdAt: Date.now() }; await Store.put('clips', c); Data.invalidate('clips'); return c.id; });
  await p.evaluate(id => Screens.push('clip', { id }), clipId); await p.waitForTimeout(700);
  await p.click('[data-a="board"]'); await p.waitForTimeout(400);
  f = await frameOf();
  console.log('Clip board:', await f.evaluate(() => { const b = CS3Board.items().get(CS3Board.current()); return { id: b.id, name: b.name, status: b.status, parent: b.parent }; }));

  // stored in the app's database, and in the backup
  const r = await p.evaluate(async () => {
    const { values } = await Store.all('board-items');
    const bk = await Transfer.exportAll({ photos: true });
    return { inDb: values.length, videoBoards: values.filter(v => v.video).map(v => v.id), inBackup: (bk.data['board-items'] || []).length };
  });
  console.log('Storage:', r);
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
