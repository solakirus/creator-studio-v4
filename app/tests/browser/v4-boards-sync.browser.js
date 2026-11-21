/* Browser test: Library boards sync between devices (20 Nov 2026).

   Two computers read the same Shot Library but name it differently: the
   laptop by its folder ("h:/home/kris/Shot Library|…"), the Linux desktop by
   nastime ("h:nastime|…"). Sync (tests/helpers/mini-synchub.js).
   Checks: a board made before boards synced is offered once; a new board goes
   up; the other computer has both, with their frames drawn; adding a frame
   that's already there under the other address doesn't double it; taking a
   frame off and deleting a board travel back; the Library's own files still
   never go to the server.

     node app/tests/browser/v4-boards-sync.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const hubMod = require('../helpers/mini-synchub');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);
const FILES = ['Gym/gifs/squat.gif', 'Gym/gifs/deadlift.gif', 'Beach/stills/pier.png'];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const fx = f => fs.readFileSync(path.join(__dirname, '..', 'fixtures', f));
  const files = {};
  FILES.forEach((f, i) => { files[f] = { data: fx(f.endsWith('.png') ? 'still.png' : i ? 'disk.gif' : 'opener.gif'), type: f.endsWith('.png') ? 'image/png' : 'image/gif' }; });
  const hub = await hubMod.start({ token: 'tok', files });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];

  /* a computer with the Electron bridge's Library half, reading the three frames under its own root */
  async function computer(name, root){
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
    await ctx.addInitScript(({ root, hubUrl, FILES }) => {
      const pages = [...new Set(FILES.map(f => f.split('/')[0]))].map(d => ({ uid: 'h|' + root + '|' + d, src: 'h', root, dir: d, collection: 'Shot Library',
        page: d, title: '', heading: d, grabbed: '2026-11-01T00:00:00Z', counts: [0, 0, 0] }));
      const items = FILES.map(f => ({ uid: 'h:' + root + '|' + f, kind: f.endsWith('.png') ? 'image' : 'gif', name: f.split('/').pop(), label: '', caption: '',
        page: 'h|' + root + '|' + f.split('/')[0], root, path: f, url: hubUrl + '/f/' + encodeURIComponent(f), bytes: 700 }));
      window.CS3Lib = { home: async () => root, scan: async () => ({ roots: [root], errors: [], pages, items }),
        pickFolder: async () => null, open: async () => {}, trash: async () => ({}), boardFolder: async () => ({}), shotline: async () => null,
        grabFind: async () => null, grabRun: async () => ({}), grabStop: async () => {}, onGrab: () => () => {} };
    }, { root, hubUrl: hub.url, FILES });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.MediaLib && window.Sync, null, { timeout: 15000 });
    await p.waitForTimeout(1000); return p;
  }
  const uidsOf = root => FILES.map(f => 'h:' + root + '|' + f);
  const LAP = '/home/kris/Shot Library', DESK = 'nastime';
  const L = uidsOf(LAP), D = uidsOf(DESK);
  const boards = p => p.evaluate(async () => (await MediaLib.allBoards()).map(x => ({ name: x.name, n: x.items.length })).sort((a, b) => a.name.localeCompare(b.name)));
  const syncBoth = async () => { await lap.evaluate(() => Sync.syncNow()); await desk.evaluate(() => Sync.syncNow()); await lap.evaluate(() => Sync.syncNow()); };

  const lap = await computer('laptop', LAP);
  try {
    head('the laptop, already syncing, with a board from before');
    const up = await lap.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url);
    ok(up && up.ok, 'the laptop syncs');
    /* a board made while boards stayed on one device: never noted as changed */
    await lap.evaluate(async u => { await Store.raw.put('lib-boards', { id: 'bd_old', name: 'Beach days', group: 'Location', items: [u], created: 1 }); MediaLib.invalidate(); }, L[2]);
    const offered = await lap.evaluate(() => Sync.offerRestored());
    ok(offered === 1, 'the board from before is offered to the server, once', offered);
    ok((await lap.evaluate(() => Sync.offerRestored())) === 0, 'and not again');
    await lap.evaluate(async u => { const r = await MediaLib.saveBoard({ name: 'Gym', group: 'Activity', items: [] }); await MediaLib.addToBoard(r.id, u); await Sync.syncNow(); }, [L[0], L[1]]);
    const onHub = [...(hub.apps.get('creator-studio-4') || new Map()).values()];
    ok(onHub.filter(r => r.store === 'lib-boards' && !r.deleted).length === 2, 'both boards are on the server',
      onHub.filter(r => r.store === 'lib-boards').map(r => r.id).join(' '));
    ok(!onHub.some(r => /^lib-(items|blob|poster)$/.test(r.store)), 'the Library\'s own files are not');

    head('on the Linux desktop (reads nastime)');
    var desk = await computer('desktop', DESK);
    await desk.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url);
    await desk.waitForTimeout(1500);
    ok(JSON.stringify(await boards(desk)) === '[{"name":"Beach days","n":1},{"name":"Gym","n":2}]', 'both boards are here', JSON.stringify(await boards(desk)));
    await desk.evaluate(() => { App.go('series'); }); await desk.waitForTimeout(400);
    await desk.click('.ctnav [data-v="library"]'); await desk.waitForTimeout(800);
    await desk.click('.lv-tabs [data-tab="boards"]'); await desk.waitForTimeout(1000);
    const cards = await desk.evaluate(() => [...document.querySelectorAll('.lv-board')].map(c => ({
      name: c.querySelector('.lv-bname b').textContent, frames: c.querySelectorAll('.lv-quad .lv-tile[data-uid]').length, missing: c.querySelectorAll('.lv-missing').length })));
    const gym = cards.find(c => c.name === 'Gym') || {};
    ok(gym.frames === 2 && gym.missing === 0, 'Gym shows its two frames from this computer\'s Library', JSON.stringify(cards));
    await desk.screenshot({ path: path.join(out, 'desktop-boards.png') });
    const gymId = await desk.evaluate(async () => (await MediaLib.allBoards()).find(x => x.name === 'Gym').id);
    const deckList = await desk.evaluate(async id => (await MediaLib.deck({ src: 'board:' + id })).list.map(it => it.uid), gymId);
    ok(deckList.length === 2 && deckList.every(u => u.startsWith('h:nastime|')), 'Show in Deck lists them by this computer\'s address', deckList.join(' '));
    const onText = await desk.evaluate(async u => { await LibView.view(u); await new Promise(r => setTimeout(r, 300));
      const t = (document.querySelector('.lv-viewer') || {}).textContent || ''; const x = document.querySelector('.lv-viewer [data-close]'); if(x) x.click(); return t; }, D[0]);
    ok(/On ◈ Gym/.test(onText), 'a frame\'s viewer says which board it is on');

    head('changes on the desktop');
    ok((await desk.evaluate(({ id, u }) => MediaLib.addToBoard(id, [u]), { id: gymId, u: D[0] })) === 0, 'adding a frame already there (other address) doesn\'t double it');
    ok((await desk.evaluate(({ id, u }) => MediaLib.takeOffBoard(id, [u]), { id: gymId, u: D[1] })) === 1, 'taking a frame off works across addresses');
    await desk.evaluate(async u => { const r = await MediaLib.saveBoard({ name: 'Night city', group: 'Mood', items: [] }); await MediaLib.addToBoard(r.id, [u]); }, D[2]);
    await syncBoth();
    ok(JSON.stringify(await boards(lap)) === '[{"name":"Beach days","n":1},{"name":"Gym","n":1},{"name":"Night city","n":1}]', 'the laptop gets the change and the new board',
      JSON.stringify(await boards(lap)));
    const lapNight = await lap.evaluate(async () => { const lib = await MediaLib.load(true); const bd = (await MediaLib.allBoards()).find(x => x.name === 'Night city');
      return (await MediaLib.deck({ src: 'board:' + bd.id })).list.map(it => it.uid); });
    ok(lapNight.length === 1 && lapNight[0].startsWith('h:' + LAP), 'and finds its frame in its own folder', lapNight.join(' '));

    head('a board deleted on the laptop');
    await lap.evaluate(() => MediaLib.deleteBoard('bd_old'));
    await syncBoth();
    await desk.evaluate(() => Sync.syncNow());
    ok(!(await boards(desk)).some(x => x.name === 'Beach days'), 'is gone from the desktop too', JSON.stringify(await boards(desk)));
    ok(errs.length === 0, 'no page errors', errs.join(' | '));
  } catch(e){ fail++; console.log('  FAIL  ' + (e.stack || e)); }
  await b.close(); await hub.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
