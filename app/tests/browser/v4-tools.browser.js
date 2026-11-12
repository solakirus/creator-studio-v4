/* Browser test: the big-library tools, the NAS copy, template shots in the
   add-task form, and hold-to-swap (v4).

   Laptop (Library, Electron bridge stood in — its scan hands back 1,600 frames
   from a "NAS" folder, and it records copy jobs):
     - the Deck shows 1,500 then "Show 100 more"; sort by size; Shift-click
       selects a run; Unused leaves out starred, boarded and planned frames;
     - Folders: "Keep a copy…" refuses a copy inside the folder, sets one up and
       copies, shows when it last copied, "Copy now", the warning when the NAS
       can't be reached and the copy is read, and Stop;
     - the add-task form takes a template's shots and frames; a template's
       frames are kept for the phone even when no task uses them.
   Sync (tests/helpers/mini-synchub.js). Phone: in shoot mode, holding the
   picture swaps the frame for a starred one — on this task only, the template
   stays; on the task page, holding a step's thumbnail does the same.

     node app/tests/browser/v4-tools.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const hubMod = require('../helpers/mini-synchub');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const FX = f => fs.readFileSync(path.join(__dirname, '..', 'fixtures', f)).toString('base64');
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const hub = await hubMod.start({ token: 'tok' });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  async function device(name, laptop){
    const ctx = await b.newContext(laptop ? { viewport: { width: 1280, height: 860 } } : { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    if(laptop) await ctx.addInitScript(png => {
      const N = 1600, still = 'data:image/png;base64,' + png;
      const pages = [{ uid: 'h:/nas/Shot Library|Big/everyday', root: '/nas/Shot Library', dir: 'Big/everyday', collection: 'Big', site: 'Big',
        page: 'everyday', title: '', heading: '', source: '', grabbed: '', counts: [0, 0, N] }];
      const items = Array.from({ length: N }, (_, i) => {
        const p = 'Big/everyday/images/img_' + String(i).padStart(4, '0') + '.png';
        return { uid: 'h:/nas/Shot Library|' + p, src: 'h', root: '/nas/Shot Library', path: p, kind: 'image', name: p.split('/').pop(),
          label: '', caption: '', link: '', big: '', source: '', tags: [], order: i, bytes: 1000 + i, page: pages[0].uid, url: still };
      });
      window.__t = { scans: [], copies: [], pick: null, fallback: false, copied: 3 };
      window.CS3Lib = {
        home: async () => ({ path: '/home/kris/Shot Library', exists: true }),
        scan: async (roots, mirrors) => {
          __t.scans.push({ roots, mirrors });
          const fb = __t.fallback ? [{ root: '/nas/Shot Library', copy: (mirrors || {})['/nas/Shot Library'] || '/laptop/copy' }] : [];
          return { items: items.map(x => ({ ...x })), pages: pages.map(x => ({ ...x, counts: [...x.counts] })), roots: ['/nas/Shot Library'], errors: [], fallback: fb };
        },
        mirror: async pairs => { __t.copies.push(pairs); return { ok: true, results: pairs.map(([from, to]) => ({ from, to, copied: __t.copied, same: 10, failed: 0, bytes: 3 * 1048576, errors: [] })) }; },
        onMirror: () => () => {},
        pickFolder: async () => __t.pick, open: async () => {}, trash: async () => 0, boardFolder: async () => ({}), shotline: async () => null,
        grabFind: async () => ({ root: 'built in', setUp: true, node: true, builtin: true, ytdlp: true, ffmpeg: true, out: '/x' }),
        grabRun: async () => ({}), grabStop: async () => {}, onGrab: () => () => {} };
    }, FX('still.png'));
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url); await p.waitForFunction(() => window.App && window.MediaLib && window.Sync && window.StarPick && window.TaskForm, null, { timeout: 15000 });
    await p.waitForTimeout(1000); return p;
  }
  const lap = await device('laptop', true);
  await lap.evaluate(async () => { await MediaLib.setSettings({ roots: ['/nas/Shot Library'] }); await MediaLib.rescan(); });
  const tiles = () => lap.evaluate(() => document.querySelectorAll('.lv-deck .lv-tile').length);

  head('a big library in the Deck');
  await lap.evaluate(() => App.go('series')); await lap.waitForTimeout(400);
  await lap.click('.ctnav [data-v="library"]'); await lap.waitForTimeout(1500);
  ok((await tiles()) === 1500, 'the Deck shows the first 1,500', await tiles());
  ok(/Show 100 more/.test(await lap.textContent('[data-more]')), 'with “Show 100 more” and “Show all”', (await lap.textContent('[data-more]')).trim());
  await lap.click('[data-more]'); await lap.waitForTimeout(1200);
  ok((await tiles()) === 1600 && !(await lap.$('[data-more]')), 'and then all 1,600', await tiles());
  await lap.selectOption('[data-sort]', 'size'); await lap.waitForTimeout(1200);
  let first = await lap.getAttribute('.lv-deck .lv-tile', 'data-uid');
  ok(/img_1599\.png$/.test(first), 'Biggest first puts the biggest frame first', first.split('/').pop());
  await lap.selectOption('[data-sort]', 'name'); await lap.waitForTimeout(1200);
  first = await lap.getAttribute('.lv-deck .lv-tile', 'data-uid');
  ok(/img_0000\.png$/.test(first), 'Name A→Z puts img_0000 first', first.split('/').pop());
  await lap.click('[data-select]'); await lap.waitForTimeout(800);
  const t3 = await lap.$$('.lv-deck .lv-tile');
  await t3[2].click(); await lap.waitForTimeout(150);
  await t3[7].click({ modifiers: ['Shift'] }); await lap.waitForTimeout(300);
  const seln = await lap.textContent('[data-seln]');
  ok(/^6 frames/.test(seln.trim()), 'click one, Shift-click another: the six from one to the other are picked', seln.trim());
  await lap.click('[data-sel="clear"]'); await lap.click('[data-select]'); await lap.waitForTimeout(500);

  head('your own frames, groups, templates');
  const uids = await lap.evaluate(async ({ g, s, w }) => {
    const b64 = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
    const r = await MediaLib.addFiles([new File([b64(g)], 'kettle.gif', { type: 'image/gif' }), new File([b64(s)], 'mug.png', { type: 'image/png' }),
      new File([b64(w)], 'window.gif', { type: 'image/gif' }), new File([b64(s)], 'beans.png', { type: 'image/png' }),
      new File([b64(s)], 'spare.png', { type: 'image/png' })], 'Everyday', 'Mine');
    return r.added;
  }, { g: FX('opener.gif'), s: FX('still.png'), w: FX('disk.gif') });
  ok(uids.length === 5, 'five frames added', uids.length);
  const made = await lap.evaluate(async u => {
    const g = await MediaLib.saveStar({ name: 'Morning coffee', items: [u[1], u[3]] });
    const bd = await MediaLib.saveBoard({ name: 'Ideas', group: 'Other', items: [u[4]] });
    const mk = (item, label) => ShotTemplates.shot({ item, label, role: 'Action' });
    const morning = await ShotTemplates.save({ name: 'Morning routine', kind: 'Vlog day', shots: [mk(u[0], 'Kettle on'), mk(u[2], 'Light through the window'), mk('', 'Stretch')], tasks: [] });
    const coffee = await ShotTemplates.save({ name: 'Coffee only', kind: 'Vlog day', shots: [mk(u[3], 'Beans')], tasks: [] });
    const d = await MediaLib.deck({ src: 'unused' });
    return { g: g.id, board: !!bd, morning: morning.id, coffee: coffee.id, unused: d.list.map(x => x.uid) };
  }, uids);
  ok(made.board && !made.unused.some(u => uids.includes(u)), 'Unused leaves out frames that are starred, on a board or in a template', made.unused.filter(u => uids.includes(u)).length + ' of mine left');
  ok(made.unused.length === 1600, 'and keeps the 1,600 nobody has used yet', made.unused.length);
  ok(await lap.evaluate(() => !!document.querySelector('[data-src] option[value="unused"]')), 'the Deck offers Unused as a source');

  head('the add-task form takes a template');
  await lap.evaluate(async () => TaskForm.open({ day: await Data.currentDay() })); await lap.waitForTimeout(700);
  const opts = await lap.evaluate(() => [...document.querySelectorAll('#tf-tpl option')].map(o => o.textContent.trim()));
  ok(opts.some(o => /^Morning routine · 3 shots/.test(o)), 'templates with shots are offered', opts.join(' | '));
  await lap.selectOption('#tf-tpl', made.morning); await lap.waitForTimeout(200);
  const pre = await lap.evaluate(() => ({ title: document.querySelector('#tf-title').value, kind: document.querySelector('#tf-kind').value }));
  ok(pre.title === 'Morning routine' && pre.kind === 'shoot', 'picking one names it and makes it a Shoot task', JSON.stringify(pre));
  await lap.click('[data-tfsave]'); await lap.waitForTimeout(1500);
  const task = await lap.evaluate(async () => {
    const t = (await Store.all('tasks')).values.filter(x => x.title === 'Morning routine').pop();
    return t && { id: t.id, kind: t.kind, items: (t.page && t.page.slots || []).map(s => s.item || ''), tpl: t.pageFrom && t.pageFrom.template,
      labels: (t.page && t.page.slots || []).map(s => s.label || '') };
  });
  ok(task && task.kind === 'shoot', 'the task is saved as a Shoot task');
  ok(task && task.items[0] === uids[0] && task.items[1] === uids[2], 'its shot page has the template\'s frames, in order', task && task.items.slice(0, 3).join(' '));
  ok(task && task.tpl === 'Morning routine', 'and remembers the template it came from', task && task.tpl);
  const kept = await lap.evaluate(async () => { await TaskFrames.run(); return (await Store.all('task-frames')).values.map(x => x.uid); });
  ok(kept.includes(uids[3]), 'a template\'s frames are kept for the phone even with no task using them');
  ok(!kept.includes(uids[4]), 'a frame only on a board isn\'t');

  head('the NAS copy (Folders)');
  await lap.click('.lv-tabs [data-tab="folders"]'); await lap.waitForTimeout(800);
  ok((await lap.$$('[data-copyset]')).length === 2, 'each folder offers “Keep a copy…”');
  await lap.evaluate(() => { __t.pick = '/nas/Shot Library/backup'; });
  await lap.click('[data-copyset="/nas/Shot Library"]'); await lap.waitForTimeout(700);
  let st = await lap.evaluate(async () => ({ m: (await MediaLib.settings()).mirrors, copies: __t.copies.length, toast: (document.querySelector('.toast') || {}).textContent || '' }));
  ok(!Object.keys(st.m).length && st.copies === 0, 'a copy inside the folder is refused', st.toast.trim());
  await lap.evaluate(() => { __t.pick = '/home/kris/Shot Library/x'; });
  await lap.click('[data-copyset="/nas/Shot Library"]'); await lap.waitForTimeout(700);
  st = await lap.evaluate(async () => ({ m: (await MediaLib.settings()).mirrors, copies: __t.copies.length }));
  ok(!Object.keys(st.m).length && st.copies === 0, 'so is one inside another Library folder');
  await lap.evaluate(() => { __t.pick = 'D:\\Shot Library copy'; });
  await lap.click('[data-copyset="/nas/Shot Library"]'); await lap.waitForTimeout(1500);
  st = await lap.evaluate(async () => ({ m: (await MediaLib.settings()).mirrors, copies: __t.copies, row: (document.querySelector('[data-copyrow="/nas/Shot Library"]') || {}).textContent || '' }));
  ok(st.m['/nas/Shot Library'] === 'D:\\Shot Library copy', 'a folder on this computer becomes the NAS folder\'s copy');
  ok(st.copies.length === 1 && JSON.stringify(st.copies[0]) === JSON.stringify([['/nas/Shot Library', 'D:\\Shot Library copy']]), 'and the first copy starts straight away', JSON.stringify(st.copies));
  ok(/Copy at D:\\Shot Library copy/.test(st.row) && /last copied just now · 3 new \(3\.0 MB\)/.test(st.row), 'the row says where and when', st.row.replace(/\s+/g, ' ').trim().slice(0, 90));
  await lap.screenshot({ path: path.join(out, 'laptop-folders-copy.png') });
  await lap.evaluate(() => { __t.copied = 0; });
  await lap.click('[data-copynow="/nas/Shot Library"]'); await lap.waitForTimeout(1200);
  st = await lap.evaluate(() => ({ n: __t.copies.length, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '),
    row: (document.querySelector('[data-copyrow="/nas/Shot Library"]') || {}).textContent || '' }));
  ok(st.n === 2 && /up to date/.test(st.row), 'Copy now copies again — nothing new, so “up to date”', st.toast.trim());
  const sc = await lap.evaluate(async () => { await MediaLib.rescan(); return __t.scans[__t.scans.length - 1]; });
  ok(sc.mirrors && sc.mirrors['/nas/Shot Library'] === 'D:\\Shot Library copy', 'the scan is told about the copy, so it can stand in', JSON.stringify(sc.mirrors));
  await lap.evaluate(async () => { __t.fallback = true; await MediaLib.rescan(); });
  await lap.click('.lv-tabs [data-tab="deck"]'); await lap.waitForTimeout(1000);
  ok(!!(await lap.$('[data-fallbackline]')), 'when the NAS can\'t be reached the Deck says it\'s showing the copy');
  ok((await tiles()) === 1605, 'and every frame is still there', await tiles());
  await lap.click('[data-fallbackline] [data-tab="folders"]'); await lap.waitForTimeout(800);
  const warn = await lap.textContent('[data-fallback]');
  ok(/can’t be reached right now/.test(warn) && /D:\\Shot Library copy/.test(warn), 'Folders names the copy in use', warn.trim().slice(0, 80));
  await lap.screenshot({ path: path.join(out, 'laptop-folders-fallback.png') });
  await lap.evaluate(() => { __t.fallback = false; window.confirm = () => true; });
  await lap.click('[data-copyoff="/nas/Shot Library"]'); await lap.waitForTimeout(1000);
  st = await lap.evaluate(async () => ({ m: (await MediaLib.settings()).mirrors, c: (await MediaLib.settings()).copied }));
  ok(!Object.keys(st.m).length && !Object.keys(st.c).length, 'Stop forgets the copy (its files stay where they are)');
  /* the NAS folder was added to the list first, then picked as the Shot Library's copy */
  await lap.evaluate(() => { __t.pick = '/nas/Shot Library'; __t.copied = 7; window.confirm = () => true; });
  await lap.click('[data-copyset="/home/kris/Shot Library"]'); await lap.waitForTimeout(1500);
  st = await lap.evaluate(async () => ({ roots: (await MediaLib.settings()).roots, m: (await MediaLib.settings()).mirrors, last: __t.copies[__t.copies.length - 1] }));
  ok(!st.roots.includes('/nas/Shot Library') && st.m['/home/kris/Shot Library'] === '/nas/Shot Library', 'a folder already on the list can become the copy (it comes off the list)', JSON.stringify(st.roots));
  ok(JSON.stringify(st.last) === JSON.stringify([['/home/kris/Shot Library', '/nas/Shot Library']]), 'and the copy starts at once', JSON.stringify(st.last));
  const local = await lap.evaluate(async () => Sync.LOCAL_STORES && /^(backup:|sync:|library$)/.test('library'));
  ok(local, 'copy settings stay on this computer — they never sync');

  const up = await lap.evaluate(h => Sync.connect(h, 'tok', 'upload'), hub.url);
  ok(up && up.ok, 'the laptop syncs');

  head('on the phone: hold to swap a frame for today');
  const ph = await device('phone', false);
  await ph.evaluate(h => Sync.connect(h, 'tok', 'replace'), hub.url);
  await ph.waitForTimeout(1500);
  await ph.evaluate(id => ShootRun.open(id, 0), task.id); await ph.waitForTimeout(1500);
  const hold = async sel => { const bx = await ph.locator(sel).first().boundingBox(); await ph.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
    await ph.mouse.down(); await ph.waitForTimeout(900); await ph.mouse.up(); await ph.waitForTimeout(900); };
  ok(!!(await ph.$('[data-pic] img')), 'shoot mode shows the first shot\'s frame');
  await hold('[data-pic]');
  const sheet = await ph.evaluate(() => ({ h: (document.querySelector('#sheet h2') || {}).textContent || '', n: document.querySelectorAll('#sheet [data-pick]').length,
    clean: !!document.querySelector('.sr.clean') }));
  ok(/swap its frame for today/.test(sheet.h) && sheet.n === 2, 'holding the picture opens the starred frames', `${sheet.n} in “${sheet.h}”`);
  ok(!sheet.clean, 'and the hold isn\'t taken as a tap');
  await ph.screenshot({ path: path.join(out, 'phone-hold-swap.png') });
  await ph.click(`#sheet [data-pick="${uids[3]}"]`); await ph.waitForTimeout(1300);
  let sw = await ph.evaluate(async ({ id, tpl }) => {
    const t = await Store.get('tasks', id), tp = await Store.get('shot-templates', tpl);
    return { slot: t.page.slots[0].item, tpl: tp.shots[0].item, toast: [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' ') };
  }, { id: task.id, tpl: made.morning });
  ok(sw.slot === uids[3], 'the shot now has the frame picked', sw.slot);
  ok(sw.tpl === uids[0], 'the template keeps its own');
  ok(/stays as it is/.test(sw.toast), 'and says so', sw.toast.trim().slice(0, 70));
  ok(await ph.evaluate(() => !!document.querySelector('[data-pic] img')), 'the new frame shows');
  await ph.evaluate(() => Screens.pop()); await ph.waitForTimeout(500);

  await ph.evaluate(id => Screens.push('task', { id }), task.id); await ph.waitForTimeout(1500);
  await hold('.tk-th[data-shootat="1"]');
  ok((await ph.evaluate(() => document.querySelectorAll('#sheet [data-pick]').length)) === 2, 'on the task page, holding a step\'s frame opens the picker too');
  await ph.click(`#sheet [data-pick="${uids[1]}"]`); await ph.waitForTimeout(1300);
  sw = await ph.evaluate(async id => (await Store.get('tasks', id)).page.slots[1].item, task.id);
  ok(sw === uids[1], 'and swaps that shot', sw);
  await ph.evaluate(() => Sync.syncNow());
  const back = await lap.evaluate(async ({ id, tpl }) => { await Sync.syncNow(); const t = await Store.get('tasks', id); const tp = await Store.get('shot-templates', tpl);
    return { a: t.page.slots[0].item, b: t.page.slots[1].item, tpl: tp.shots.map(s => s.item) }; }, { id: task.id, tpl: made.morning });
  ok(back.a === uids[3] && back.b === uids[1] && back.tpl[0] === uids[0] && back.tpl[1] === uids[2], 'the laptop gets the swapped task and the unchanged template');

  ok(!errs.length, 'no script errors', errs.slice(0, 3).join(' | '));
  await b.close(); await hub.close();
  console.log(`\nlibrary tools, copy, templates, swap  (${pass} ok, ${fail} failed)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
