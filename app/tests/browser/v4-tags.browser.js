/* Browser test: tags on Library frames (21 Nov 2026).

   Laptop (its own Shot Library folder) and the Linux desktop (reads nastime,
   so its addresses differ), synced through tests/helpers/mini-synchub.js.
   Checks: an old board becomes tags once; the Deck's tag rows and counts;
   Tag from Select mode, a new tag typed in; filter (any within a category,
   all across), Untagged, Group by; Tag all shown for one video; search finds
   tags; the viewer's chips; smart boards (fill themselves, not offered in Add
   to board); Manage: rename, merge, delete; the desktop sees it all by its
   own addresses, and the picker narrows by tags; a phone with nothing kept
   says why.

     node app/tests/browser/v4-tags.browser.js [out folder] */
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
const FILES = ['Gym/gifs/squat.gif', 'Gym/gifs/deadlift.gif', 'Gym/gifs/rack.gif', 'Kitchen/gifs/pour.gif', 'Kitchen/gifs/chop.gif', 'Car/gifs/drive.gif'];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const fx = f => fs.readFileSync(path.join(__dirname, '..', 'fixtures', f));
  const files = {}; FILES.forEach((f, i) => { files[f] = { data: fx(i % 2 ? 'disk.gif' : 'opener.gif'), type: 'image/gif' }; });
  const hub = await hubMod.start({ token: 'tok', files });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  async function computer(name, root){
    const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
    await ctx.addInitScript(({ root, hubUrl, FILES }) => {
      const pages = [...new Set(FILES.map(f => f.split('/')[0]))].map(d => ({ uid: 'h|' + root + '|' + d, src: 'h', root, dir: d, collection: 'Shot Library',
        page: d, title: '', heading: d, grabbed: '2026-11-01T00:00:00Z', counts: [FILES.filter(f => f.startsWith(d + '/')).length, 0, 0] }));
      const items = FILES.map(f => ({ uid: 'h:' + root + '|' + f, kind: 'gif', name: f.split('/').pop(), label: '', caption: '',
        page: 'h|' + root + '|' + f.split('/')[0], root, path: f, url: hubUrl + '/f/' + encodeURIComponent(f), bytes: 700 }));
      window.CS3Lib = { home: async () => root, scan: async () => ({ roots: [root], errors: [], pages, items }),
        pickFolder: async () => null, open: async () => {}, trash: async () => ({}), boardFolder: async () => ({}), shotline: async () => null,
        grabFind: async () => null, grabRun: async () => ({}), grabStop: async () => {}, onGrab: () => () => {} };
    }, { root, hubUrl: hub.url, FILES });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('dialog', d => d.accept());
    await p.goto(url); await p.waitForFunction(() => window.App && window.MediaLib && window.Tags && window.Sync, null, { timeout: 15000 });
    await p.waitForTimeout(800); return p;
  }
  const LAP = '/home/kris/Shot Library', DESK = 'nastime';
  const U = (root, i) => 'h:' + root + '|' + FILES[i];
  const openLib = async (p, rows) => { await p.evaluate(() => App.go('series')); await p.waitForTimeout(400); await p.click('.ctnav [data-v="library"]'); await p.waitForTimeout(1400);
    if(rows !== false && !(await p.$('.tg-rows'))){ await p.click('[data-tgtoggle]'); await p.waitForTimeout(500); } };
  const tiles = p => p.$$eval('.lv-deck .lv-tile[data-uid]', x => [...new Set(x.map(e => e.dataset.uid.split('|').pop()))]);
  const tagsOf = (p, i) => p.evaluate(async f => { const m = await Tags.map(); return [...(m.get(f) || [])].sort(); }, FILES[i]);
  const chip = id => `.tg-rows [data-tgf="${id}"]`;

  const lap = await computer('laptop', LAP);
  try {
    head('a board from before becomes tags');
    await lap.evaluate(async u => { await Store.put('lib-boards', { id: 'bd_old', name: 'Beach days', group: 'Location', items: [u], created: 1 }); }, U(LAP, 5));
    await openLib(lap);
    await lap.waitForTimeout(800);
    ok(JSON.stringify(await tagsOf(lap, 5)) === '["location:beach-days"]', 'board "Beach days" (Location) tags its frame Location: Beach days', JSON.stringify(await tagsOf(lap, 5)));
    ok((await lap.evaluate(() => Tags.fromBoards())) === 0, 'and only once');

    head('the Deck\'s tag rows');
    ok(await lap.evaluate(async () => (await MediaLib.settings()).tagsOpen === true), 'shut at first, 🏷 Tags opens them (and remembers)');
    const rows = await lap.$$eval('.tg-rows .tg-k', x => x.map(e => e.textContent));
    ok(rows.slice(0, 4).join() === 'Activity,Location,Genre,Shot', 'a row per category', rows.join(' '));
    ok(/Untagged\s*5/.test(await lap.textContent('[data-tguntag]')), 'Untagged counts what is left', await lap.textContent('[data-tguntag]'));
    await lap.screenshot({ path: path.join(out, 'tags-deck.png') });

    head('tagging');
    await lap.click('[data-select]'); await lap.waitForTimeout(400);
    for(const i of [0, 1]) await lap.click(`.lv-deck .lv-tile[data-uid="${U(LAP, i)}"]`);
    await lap.click('[data-sel="tag"]'); await lap.waitForTimeout(500);
    await lap.click('#sheet [data-tgset="activity:gym"]'); await lap.waitForTimeout(300);
    await lap.click('#sheet [data-tgset="location:gym"]'); await lap.waitForTimeout(300);
    await lap.fill('#sheet [data-tgnew="location"]', 'Squat rack'); await lap.press('#sheet [data-tgnew="location"]', 'Enter'); await lap.waitForTimeout(500);
    ok(JSON.stringify(await tagsOf(lap, 0)) === '["activity:gym","location:gym","location:squat-rack"]' && JSON.stringify(await tagsOf(lap, 1)) === JSON.stringify(await tagsOf(lap, 0)),
      'Tag puts a tag on every ticked frame; a new one typed in is made and put on', JSON.stringify(await tagsOf(lap, 0)));
    await lap.click('#sheet [data-tgset="location:gym"]'); await lap.waitForTimeout(300);
    ok(!(await tagsOf(lap, 1)).includes('location:gym'), 'tapping a lit one takes it off them all');
    await lap.click('#sheet [data-tgset="location:gym"]'); await lap.waitForTimeout(300);
    await lap.screenshot({ path: path.join(out, 'tags-sheet.png') });
    await lap.click('#sheet [data-tgdone]'); await lap.waitForTimeout(500);
    await lap.click('[data-select]'); await lap.waitForTimeout(500);

    /* one more by the viewer: rack.gif, Gym + Close-up */
    await lap.click(`.lv-deck .lv-tile[data-uid="${U(LAP, 2)}"]`); await lap.waitForTimeout(700);
    ok(!!(await lap.$('.lv-viewer [data-vtag="activity:gym"]')), 'the full-screen viewer shows its tags');
    await lap.click('.lv-viewer [data-vtag="activity:gym"]'); await lap.click('.lv-viewer [data-vtag="shot:close-up"]'); await lap.waitForTimeout(400);
    ok(JSON.stringify(await tagsOf(lap, 2)) === '["activity:gym","shot:close-up"]', 'and tapping one there tags it', JSON.stringify(await tagsOf(lap, 2)));
    await lap.click('.lv-viewer [data-close]'); await lap.waitForTimeout(500);

    head('finding frames');
    await lap.click(chip('activity:gym')); await lap.waitForTimeout(600);
    ok((await tiles(lap)).length === 3, 'Activity: Gym → the three gym frames', (await tiles(lap)).join(' '));
    await lap.click(chip('shot:close-up')); await lap.waitForTimeout(600);
    ok(JSON.stringify(await tiles(lap)) === '["Gym/gifs/rack.gif"]', 'and Close-up → both have to match (across categories)');
    await lap.click(chip('location:car')); await lap.click(chip('location:squat-rack')); await lap.click(chip('shot:close-up')); await lap.waitForTimeout(600);
    ok((await tiles(lap)).length === 2, 'Car or Squat rack (within a category, either) with Gym', (await tiles(lap)).join(' '));
    await lap.click(chip('location:car')); await lap.click(chip('location:squat-rack')); await lap.click(chip('activity:gym')); await lap.waitForTimeout(400);
    await lap.click('[data-tguntag]'); await lap.waitForTimeout(600);
    ok(JSON.stringify((await tiles(lap)).sort()) === '["Kitchen/gifs/chop.gif","Kitchen/gifs/pour.gif"]', 'Untagged shows what is left', (await tiles(lap)).join(' '));
    await lap.click('[data-tguntag]'); await lap.waitForTimeout(400);
    await lap.selectOption('[data-groupby]', 'activity'); await lap.waitForTimeout(600);
    const secs = await lap.$$eval('.lv-deck .tg-sec', x => x.map(e => e.firstChild.textContent + ' ' + e.querySelector('small').textContent));
    ok(secs.join(' | ') === 'Gym 3 frames | No activity tag 3 frames', 'Group by Activity makes a section per tag, then the rest', secs.join(' | '));
    await lap.screenshot({ path: path.join(out, 'tags-group.png') });
    await lap.selectOption('[data-groupby]', ''); await lap.waitForTimeout(400);

    /* Tag all shown: one video */
    await lap.click(`.lv-pstrip [data-pgcard="page:h|${LAP}|Kitchen"]`); await lap.waitForTimeout(800);
    await lap.click('[data-tgall]'); await lap.waitForTimeout(500);
    ok(/Tag 2 frames/.test(await lap.textContent('#sheet h2')), 'Tag all shown opens for the video\'s 2 frames');
    await lap.click('#sheet [data-tgset="activity:cooking"]'); await lap.waitForTimeout(300);
    await lap.click('#sheet [data-tgdone]'); await lap.waitForTimeout(400);
    ok((await tagsOf(lap, 3)).includes('activity:cooking') && (await tagsOf(lap, 4)).includes('activity:cooking'), 'both get it');
    await lap.click('.lv-pstrip .lv-pall'); await lap.waitForTimeout(600);
    await lap.fill('[data-q]', 'cooking'); await lap.waitForTimeout(700);
    ok((await tiles(lap)).length === 2, 'searching a tag\'s name finds its frames');
    await lap.fill('[data-q]', ''); await lap.waitForTimeout(600);

    head('Gallery');
    await lap.click('[data-dv="gallery"]'); await lap.waitForTimeout(500);
    let gw = await lap.evaluate(() => { const t = document.querySelector('.lv-deck .lv-tile'); return { on: document.querySelector('.lv-deck').classList.contains('lv-gallery'), w: Math.round(t.getBoundingClientRect().width) }; });
    ok(gw.on && gw.w >= 330, 'Gallery makes the tiles big', gw.w + 'px wide');
    await lap.screenshot({ path: path.join(out, 'gallery.png') });
    await lap.click('.lv-tabs [data-tab="starred"]'); await lap.waitForTimeout(400); await lap.click('.lv-tabs [data-tab="deck"]'); await lap.waitForTimeout(800);
    ok(await lap.evaluate(() => document.querySelector('.lv-deck').classList.contains('lv-gallery')), 'and stays that way');
    await lap.click('[data-dv="grid"]'); await lap.waitForTimeout(400);
    gw = await lap.evaluate(() => Math.round(document.querySelector('.lv-deck .lv-tile').getBoundingClientRect().width));
    ok(gw < 250, 'Grid goes back to small tiles', gw + 'px');

    head('smart boards');
    await lap.click('.lv-tabs [data-tab="boards"]'); await lap.waitForTimeout(700);
    await lap.click('[data-newsmart]'); await lap.waitForTimeout(500);
    await lap.fill('#sheet [data-sbname]', 'Gym shots');
    await lap.click('#sheet [data-tgf="activity:gym"]'); await lap.waitForTimeout(300);
    ok(/3 frames match/.test(await lap.textContent('#sheet [data-sbn]')), 'it shows how many match as you pick');
    await lap.click('#sheet [data-sbsave]'); await lap.waitForTimeout(700);
    let bd = await lap.evaluate(async () => (await MediaLib.allBoards()).map(x => `${x.name}:${x.items.length}:${Array.isArray(x.smart)}`));
    ok(bd.includes('Gym shots:3:true'), 'a smart board with its 3 frames', bd.join(' '));
    await lap.evaluate(async () => { const lib = await MediaLib.load(); await Tags.set([lib.items.find(i => i.path === 'Car/gifs/drive.gif')], 'activity:gym', true); });
    bd = await lap.evaluate(async () => (await MediaLib.allBoards()).map(x => `${x.name}:${x.items.length}`));
    ok(bd.includes('Gym shots:4'), 'tagging another frame puts it on by itself', bd.join(' '));
    ok(!(await lap.evaluate(async () => { await LibView.boardMenu(['x']); await new Promise(r => setTimeout(r, 300)); const t = document.querySelector('#sheet').textContent; App.closeSheet(); return t; })).includes('Gym shots'),
      'Add to board doesn\'t offer it');
    const bt = await lap.evaluate(() => [...document.querySelectorAll('.lv-board .lv-bname')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
    ok(/Gym shots ?Smart · Gym · \d+ frames/.test(bt), 'the Boards tab marks it Smart, with its tags', bt);

    head('Manage tags');
    await lap.evaluate(() => Tags.manage()); await lap.waitForTimeout(600);
    await lap.fill('#sheet [data-tagname="activity:gym"]', 'Weight room'); await lap.dispatchEvent('#sheet [data-tagname="activity:gym"]', 'change'); await lap.waitForTimeout(400);
    await lap.selectOption('#sheet [data-tagdo="location:gym"]', 'merge:location:squat-rack'); await lap.waitForTimeout(700);
    await lap.click('#sheet [data-tagdel="shot:close-up"]'); await lap.waitForTimeout(600);
    await lap.screenshot({ path: path.join(out, 'tags-manage.png') });
    await lap.click('#sheet [data-tgdone]'); await lap.waitForTimeout(400);
    const after = await lap.evaluate(async () => { const cs = await Tags.cats(); return { gym: Tags.nameOf(cs, 'activity:gym'), lgym: !!Tags.nameOf(cs, 'location:gym'), cu: !!Tags.nameOf(cs, 'shot:close-up'),
      board: (await MediaLib.allBoards()).find(x => x.name === 'Gym shots').items.length }; });
    ok(after.gym === 'Weight room' && after.board === 4, 'rename: the tag is "Weight room", frames and the smart board keep it', JSON.stringify(after));
    ok(!after.lgym && JSON.stringify(await tagsOf(lap, 0)) === '["activity:gym","location:squat-rack"]', 'merge: Location Gym folded into Squat rack', JSON.stringify(await tagsOf(lap, 0)));
    ok(!after.cu && !(await tagsOf(lap, 2)).includes('shot:close-up'), 'delete: Close-up is gone, and off its frame');

    head('on the desktop (reads nastime)');
    await lap.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url);
    const desk = await computer('desktop', DESK);
    await desk.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url); await desk.waitForTimeout(1500);
    await openLib(desk);
    ok(/Weight room/.test(await desk.textContent('.tg-rows')), 'the renamed tag is there');
    await desk.click(chip('activity:gym')); await desk.waitForTimeout(700);
    const dt = await desk.$$eval('.lv-deck .lv-tile[data-uid]', x => x.map(e => e.dataset.uid));
    ok(dt.length === 4 && dt.every(u => u.startsWith('h:nastime|')), 'its filter finds the same frames by its own addresses', dt.length + ' frames');
    bd = await desk.evaluate(async () => (await MediaLib.allBoards()).map(x => `${x.name}:${x.items.length}`));
    ok(bd.includes('Gym shots:4'), 'the smart board fills here too', bd.join(' '));
    const picked = await desk.evaluate(async () => {
      const pr = LibView.pick({ multi: true }); await new Promise(r => setTimeout(r, 700));
      document.querySelector('.lv-picker [data-ptg]').click(); await new Promise(r => setTimeout(r, 500));
      document.querySelector('.lv-picker [data-tgf="activity:cooking"]').click(); await new Promise(r => setTimeout(r, 700));
      const n = document.querySelectorAll('.lv-picker .lv-pgrid .lv-tile[data-uid]').length;
      document.querySelector('.lv-picker [data-close]').click(); await pr; return n; });
    ok(picked === 2, 'the frame picker narrows by tags too', picked + ' frames');
    await desk.context().close();

    head('a phone with nothing kept');
    const ph = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    await ph.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {} }; });
    const pp = await ph.newPage(); pp.on('pageerror', e => errs.push('phone: ' + e.message));
    await pp.goto(url); await pp.waitForFunction(() => window.App && window.MediaLib, null, { timeout: 15000 }); await pp.waitForTimeout(800);
    await openLib(pp, false);
    const emp = await pp.evaluate(() => (document.querySelector('.lv-deck .empty') || {}).textContent || '');
    ok(/Keep all/.test(emp) && /Tailscale/.test(emp), 'it says why, and what to do at home and away', emp.replace(/\s+/g, ' ').slice(0, 90));
    await pp.screenshot({ path: path.join(out, 'phone-empty.png') });
    await ph.close();
    ok(errs.length === 0, 'no page errors', errs.join(' | '));
  } catch(e){ fail++; console.log('  FAIL  ' + (e.stack || e)); }
  await b.close(); await hub.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
