/* Browser test: the Library & Templates file moves between laptop and phone.

   Fills one app (a Library frame with a bigger-GIF link and tags, a board, the
   templates, a task with its shot page and a second page), exports only those
   stores the way Library → Add & grab → "Export Library & Templates" does,
   then imports the file into a second, empty app and checks everything came.

     node app/tests/browser/phonesync.browser.js <out folder> */
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs');
const out = path.resolve(process.argv[2] || '.');
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
const STORES = ['lib-items', 'lib-blob', 'lib-poster', 'lib-boards', 'shot-templates', 'tasks'];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const ok = (c, l) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];

  /* the laptop */
  const c1 = await b.newContext(); const p1 = await c1.newPage();
  p1.on('pageerror', e => errs.push(e.message));
  await p1.goto(url); await p1.waitForTimeout(1500);
  const file = await p1.evaluate(async stores => {
    const gif = new Uint8Array([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);
    const f = new File([gif], 'crash.gif', { type: 'image/gif' });
    const r = await MediaLib.addFiles([f], 'Vlog looks', 'Crash cut');
    const uid = r.added[0];
    await MediaLib.update(uid, { label: 'Watchtower of Turkey', big: 'https://example.com/big_1080p.gif', source: 'https://vimeo.com/1', tags: ['beach'] });
    await MediaLib.saveBoard({ id: 'b1', name: 'Openers', group: 'Vlog', items: [uid] });
    await ShotTemplates.all();
    const t = { id: 7701, day: await Data.currentDay(), title: 'Swim', cad: 'One-off', pri: 'med', subs: [], view: 'todo' };
    await TaskPages.attachDefault(t);
    t.morePages = [Notebook.copyNew(Notebook.designs()[0][1])];
    await Store.put('tasks', t);
    const data = await Transfer.exportAll({ photos: true, only: stores });
    return JSON.stringify(data);
  }, STORES);
  const obj = JSON.parse(file);
  ok(Object.keys(obj.data).every(s => STORES.includes(s)) && Object.keys(obj.keyed).every(s => STORES.includes(s)), 'the file holds only the Library, Templates and tasks');
  ok(!obj.data.settings && !obj.keyed.settings, 'no settings or keys in it');
  fs.writeFileSync(path.join(out, 'library-templates.json'), file);

  /* the phone: a fresh app */
  const c2 = await b.newContext(); const p2 = await c2.newPage();
  p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(url); await p2.waitForTimeout(1500);
  const got = await p2.evaluate(async text => {
    const before = (await Store.all('lib-items')).values.length;
    const n = await Transfer.importAll(JSON.parse(text), 'merge');
    await MediaLib.rescan();
    const lib = await MediaLib.load(true);
    const it = lib.items.find(x => x.label === 'Watchtower of Turkey');
    const blob = it && await Store.get('lib-blob', it.id);
    const boards = await MediaLib.allBoards();
    const t = await Store.get('tasks', 7701);
    const tpls = await ShotTemplates.all();
    return { before, n, item: it && { big: it.big, source: it.source, tags: it.tags, kind: it.kind }, blob: blob ? blob.size : 0,
      board: (boards.find(x => x.id === 'b1') || {}).items, uid: it && it.uid,
      page: t && t.page && t.page.slots.length, more: t && (t.morePages || []).length, steps: t && t.subs.length, tpls: tpls.length };
  }, file);
  ok(got.before === 0, 'the phone started empty');
  ok(got.n > 0, `${got.n} records brought in`);
  ok(got.item && got.item.kind === 'gif' && got.blob > 0, 'the GIF and its file arrived');
  ok(got.item && got.item.big === 'https://example.com/big_1080p.gif' && got.item.source === 'https://vimeo.com/1' && got.item.tags[0] === 'beach', 'its bigger-GIF link, source and tags came along');
  ok(got.board && got.board[0] === got.uid, 'the board still holds it');
  ok(got.page === 9 && got.more === 1 && got.steps === 9, 'the task came with its shot page, its second page and its steps');
  ok(got.tpls > 0, `${got.tpls} templates on the phone`);

  /* importing twice adds nothing new */
  const again = await p2.evaluate(async text => { await Transfer.importAll(JSON.parse(text), 'merge'); return (await Store.all('lib-items')).values.length; }, file);
  ok(again === 1, 'importing the same file again doesn’t double anything');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})();
