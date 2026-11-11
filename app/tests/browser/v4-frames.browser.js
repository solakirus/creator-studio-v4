/* Browser test: a laptop's Library frames reach the phone through the tasks and
   videos that use them — and nothing else of the Library does.

   Two separate browsers (each its own database), the real app in each, and a
   stand-in Sync Hub between them (tests/helpers/mini-synchub.js):

     laptop  has the Library (window.CS3Lib stands in for the Electron bridge):
             a GIF and a still added to the app, a clip, and a GIF in a folder
             on disk. A template's shots use them; it goes on today as a task,
             and becomes a video.
     phone   no Library. Joins sync and must get the task, the video and their
             frames — drawable, the GIF still moving — but no Library items,
             no Library/Templates sections, and no laptop settings.

   Then the cleanup: 21 days after the task's date its frames go, unless a
   video still uses them; a published video lets them go 21 days after it went
   out; a deleted task's frames go a day later. The Library itself is never
   touched. And sync's catch-up: a device that passed over a store's records
   (an older build) fetches them once it has the store.

     node app/tests/browser/v4-frames.browser.js [out folder]      (screenshots go there) */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const hubMod = require('../helpers/mini-synchub');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1243/chrome-linux/chrome',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const FX = f => fs.readFileSync(path.join(__dirname, '..', 'fixtures', f));
const DAY = 86400000;

let pass = 0, fail = 0;
const ok = (c, l, extra) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${extra !== undefined ? '   ' + extra : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const hub = await hubMod.start({ token: 'tok', files: { 'disk.gif': { data: FX('disk.gif'), type: 'image/gif' } } });
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];

  async function device(name, laptop){
    const ctx = await browser.newContext(laptop ? { viewport: { width: 1280, height: 860 } }
                                                : { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    if(laptop){
      /* the Electron bridge's Library half: one folder with one GIF */
      await ctx.addInitScript(hubUrl => {
        const root = '/home/kris/Shot Library';
        window.CS3Lib = {
          home: async () => root,
          scan: async () => ({ roots: [root], errors: [],
            pages: [{ uid: 'h|' + root + '|Openers', src: 'h', root, dir: 'Openers', collection: 'Shot Library', page: 'Openers',
                      title: '', heading: 'Openers', grabbed: '2026-11-01T00:00:00Z', counts: [1, 0, 0] }],
            items: [{ uid: 'h:' + root + '|Openers/disk.gif', kind: 'gif', name: 'disk.gif', label: '', caption: '',
                      page: 'h|' + root + '|Openers', path: 'Openers/disk.gif', url: hubUrl + '/f/disk.gif', bytes: 675 }] }),
          pickFolder: async () => null, open: async () => {}, trash: async () => ({}), boardFolder: async () => ({}),
          shotline: async () => null, grabFind: async () => null, grabRun: async () => ({}), grabStop: async () => {}, onGrab: () => () => {}
        };
      }, hub.url);
    }
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(url);
    await p.waitForFunction(() => window.App && window.Store && window.TaskFrames && window.Sync, null, { timeout: 15000 });
    await p.waitForTimeout(1200);
    return p;
  }

  const laptop = await device('laptop', true);
  const phone = await device('phone', false);

  head('the laptop plans with Library frames');
  const plan = await laptop.evaluate(async ({ gif, png, webm }) => {
    const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const files = [new File([b64(gif)], 'opener.gif', { type: 'image/gif' }), new File([b64(png)], 'still.png', { type: 'image/png' }),
                   new File([b64(webm)], 'clip.webm', { type: 'video/webm' })];
    const r = await MediaLib.addFiles(files, 'Vlog looks', 'Openers');
    const lib = await MediaLib.load(true);
    const disk = lib.items.find(i => i.src === 'h');
    const [g, s, c] = r.added;
    const shots = [ShotTemplates.shot({ item: g, label: 'Cold open: the jump', role: 'Action' }),
                   ShotTemplates.shot({ item: s, label: 'Title over a wide', role: 'Action', size: 'Wide' }),
                   ShotTemplates.shot({ item: c, label: 'Push in on the board', role: 'B-roll' }),
                   ShotTemplates.shot({ item: disk.uid, label: 'Whip pan out', role: 'Transition' })];
    const tpl = await ShotTemplates.save({ name: 'Beach day', kind: 'Vlog day', shots, tasks: [] });
    await ShotTemplates.putOnDay(tpl.id, Date.now());
    const video = await ShotTemplates.newVideo(tpl.id);
    /* a second task a month out, to be deleted later, using only the still */
    const t2 = await QuickAdd.add({ day: (await Data.currentDay()) + 30, title: 'Throwaway', page: { ...Notebook.stepsPage('Throwaway'), slots: [{ item: s, text: 'just the still', role: 'Action', tone: '', done: false }] } });
    const tasks = (await Store.all('tasks')).values;
    const shoot = tasks.find(t => t.title === 'Shoot — Beach day');
    const nav = [...document.querySelectorAll('.ctnav [data-v]')].map(b => b.dataset.v);
    App.go && App.go('series');
    await new Promise(z => setTimeout(z, 500));
    const nav2 = [...document.querySelectorAll('.ctnav [data-v]')].map(b => b.dataset.v);
    return { uids: [g, s, c, disk.uid], shootId: shoot && shoot.id, t2: t2.id, videoId: video.id,
             slots: shoot ? shoot.page.slots.map(x => x.item) : [], steps: shoot ? shoot.subs.map(x => x.t) : [],
             videoSlots: (video.page && video.page.slots || []).map(x => x.item), nav: nav.length ? nav : nav2 };
  }, { gif: FX('opener.gif').toString('base64'), png: FX('still.png').toString('base64'), webm: FX('clip.webm').toString('base64') });
  ok(!!plan.shootId, 'Put on a day made the shoot task');
  ok(JSON.stringify(plan.slots) === JSON.stringify(plan.uids), 'its shot page holds every shot\'s frame, in order', plan.slots.length + ' spots');
  ok(plan.steps.length === 4 && /Cold open/.test(plan.steps[0]), 'and its steps are the shots', plan.steps[0]);
  ok(JSON.stringify(plan.videoSlots) === JSON.stringify(plan.uids), 'New video kept the frames too');
  ok(plan.nav.includes('library') && plan.nav.includes('templates'), 'the laptop shows Library and Templates', plan.nav.join(' '));

  const kept = await laptop.evaluate(async () => { const r = await TaskFrames.run(); return { ...r, list: (await Store.all('task-frames')).values.map(x => [x.uid, x.kind, x.bytes, !!x.poster]) }; });
  ok(kept.kept === 4, 'the laptop copied the four frames the task and video use', JSON.stringify(kept.list.map(x => x[1])));
  ok(kept.list.some(x => x[1] === 'video' && x[3]), 'the clip has a poster still');

  head('sync to the phone');
  const up = await laptop.evaluate(async hub => { const r = await Sync.connect(hub, 'tok', 'upload'); return r; }, hub.url);
  ok(up && up.ok, 'the laptop joins Sync Hub', up && (up.error || `${up.sent} sent`));
  const srv = [...hub.apps.get('creator-studio-4').values()];
  ok(srv.length > 0, 'it syncs into its own space, creator-studio-4', srv.length + ' records');
  ok(!srv.some(r => /^lib-/.test(r.store) || r.store === 'nb-music'), 'no Library store went to the server');
  ok(!srv.some(r => r.store === 'settings' && r.id === '"library"'), 'nor the laptop\'s Library settings');
  ok(srv.filter(r => r.store === 'task-frames').length === 4, 'the four kept frames did');

  const down = await phone.evaluate(async hub => Sync.connect(hub, 'tok', 'replace'), hub.url);
  ok(down && down.ok, 'the phone joins and takes the server\'s data', down && (down.error || `${down.got} in`));
  const ph = await phone.evaluate(async ({ uids, shootId, videoId }) => {
    const lib = await MediaLib.load(true);
    const kinds = [];
    for(const u of uids){ const m = await Notebook.mediaFor(lib, u); kinds.push(m ? (m.missing ? 'missing' : m.kind) : 'none'); }
    const t = (await Store.all('tasks')).values.find(x => x.id === shootId);
    const v = (await Store.all('videos')).values.find(x => x.id === videoId);
    App.go('series');
    await new Promise(z => setTimeout(z, 600));
    const nav = [...document.querySelectorAll('.ctnav [data-v]')].map(b => b.dataset.v);
    return { kinds, task: !!t, video: !!v, libItems: (await Store.all('lib-items')).values.length,
             libVisible: lib.items.length, frames: (await Store.all('task-frames')).values.length, nav,
             gifFrames: (await Notebook.mediaFor(lib, uids[0])).frames ? (await Notebook.mediaFor(lib, uids[0])).frames.length : 0 };
  }, plan);
  ok(ph.task && ph.video, 'the phone has the task and the video');
  ok(ph.frames === 4, 'and their four frames', ph.frames);
  ok(JSON.stringify(ph.kinds) === JSON.stringify(['anim', 'still', 'video', 'anim']), 'every frame draws on the phone — GIFs move, the clip plays', ph.kinds.join(' '));
  ok(ph.gifFrames === 3, 'the GIF has all its frames', ph.gifFrames);
  ok(ph.libItems === 0 && ph.libVisible === 0, 'but the phone has no Library', `${ph.libItems} items`);
  ok(!ph.nav.includes('library') && !ph.nav.includes('templates'), 'and no Library or Templates section', ph.nav.join(' '));

  /* what it looks like: the shoot task on the phone, and the video sheet */
  await phone.evaluate(async id => { Screens.push('task', { id }); }, plan.shootId);
  await phone.waitForTimeout(2500);
  await phone.screenshot({ path: path.join(out, 'phone-task.png') });
  const drawn = await phone.evaluate(() => {
    const c = document.querySelector('[data-pagecanvas]');
    if(!c) return { canvas: false };
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    /* the opener GIF's first frame is orange (251,105,0): look for it on the page */
    let orange = 0;
    for(let i = 0; i < d.length; i += 16) if(Math.abs(d[i] - 251) < 12 && Math.abs(d[i + 1] - 105) < 12 && d[i + 2] < 20) orange++;
    return { canvas: true, orange };
  });
  ok(drawn.canvas, 'the phone opens the task with its shot page');
  ok(drawn.orange > 50, 'and the page shows the frame itself, not an empty spot', drawn.orange + ' px');
  await phone.evaluate(() => Screens.pop && Screens.pop());
  await phone.evaluate(async id => { const v = await Videos.get(id); VideoSheet.open(v); }, plan.videoId);
  await phone.waitForTimeout(1500);
  const strip = await phone.evaluate(() => ({ cells: document.querySelectorAll('#vd-fr .tf-cell').length,
    pics: document.querySelectorAll('#vd-fr img, #vd-fr video').length, missing: document.querySelectorAll('#vd-fr .tf-miss').length }));
  ok(strip.cells === 4 && strip.pics === 4 && !strip.missing, 'the video sheet shows the four frames', JSON.stringify(strip));
  const sheet = await phone.$('#vd-fr');
  if(sheet) await sheet.scrollIntoViewIfNeeded();
  await phone.waitForTimeout(400);
  await phone.screenshot({ path: path.join(out, 'phone-video.png') });
  await phone.evaluate(() => App.closeSheet && App.closeSheet());

  head('habits come along, and stay simple');
  const hb = await laptop.evaluate(async () => {
    const h = await Habits.save({ name: 'Drink water', source: { type: 'own', amount: 8, unit: 'cups' } });
    await Habits.ensureTasks(await Data.currentDay(), 7);
    const t = (await Store.all('tasks')).values.find(x => x.habitId === h.id);
    Screens.push('task', { id: t.id });
    await new Promise(z => setTimeout(z, 1500));
    const after = (await Store.all('tasks')).values.find(x => x.id === t.id);
    Screens.pop();
    await Sync.syncNow();
    return { id: h.id, tid: t.id, page: !!after.page, steps: (after.subs || []).length };
  });
  ok(!hb.page && hb.steps === 0, 'opening a habit task leaves it a plain tick — no shot page, no steps', `${hb.steps} steps`);
  const hp = await phone.evaluate(async ({ id, tid }) => {
    await Sync.syncNow();
    const h = await Habits.get(id);
    const t = (await Store.all('tasks')).values.find(x => x.id === tid);
    App.go('today');
    await new Promise(z => setTimeout(z, 800));
    return { habit: !!h, name: h && h.name, task: !!t, strip: !!document.querySelector('#habitStrip') && document.querySelector('#habitStrip').textContent.includes('Drink water') };
  }, hb);
  ok(hp.habit && hp.task, 'the habit and its tasks reach the phone', hp.name);
  ok(hp.strip, 'and the phone\'s Today shows it in the habit strip');

  head('sync catch-up: a device that passed over a store');
  const cu = await phone.evaluate(async () => {
    /* make the phone look like it came from a build without task-frames: no
       frames here, the cursor already past them, and the store not in its list */
    for(const r of (await Store.all('task-frames')).values) await Store.raw.del('task-frames', r.uid);
    const sdb = await new Promise((res, rej) => { const q = indexedDB.open('creator-studio-4-sync'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    const get = k => new Promise(res => { const q = sdb.transaction('meta').objectStore('meta').get(k); q.onsuccess = () => res(q.result); });
    const put = (k, v) => new Promise(res => { const t = sdb.transaction('meta', 'readwrite'); t.objectStore('meta').put(v, k); t.oncomplete = res; });
    const stores = await get('stores');
    await put('stores', (stores || []).filter(n => n !== 'task-frames'));
    const before = (await Store.all('task-frames')).values.length;
    const r = await Sync.syncNow();
    const after = (await Store.all('task-frames')).values.length;
    const r2 = await Sync.syncNow();
    return { had: Array.isArray(stores) && stores.includes('task-frames'), before, after, got: r.got, again: r2.got };
  });
  ok(cu.had, 'the phone remembers which stores it has synced');
  ok(cu.before === 0 && cu.after === 4, 'a store it passed over is fetched from the start once', `${cu.before} → ${cu.after}`);
  ok(cu.again === 0, 'and only once', cu.again + ' on the next sync');

  head('cleanup on the phone');
  const c1 = await phone.evaluate(async () => {
    TaskFrames._now = () => Date.now() + 23 * 86400000;    /* the task's date is now 23 days ago */
    const r = await TaskFrames.run();
    return { removed: r.removed, left: (await Store.all('task-frames')).values.length };
  });
  ok(c1.left === 4, 'after 21 days the frames stay while an unpublished video still uses them', `${c1.removed} removed`);

  const c2 = await phone.evaluate(async ({ videoId }) => {
    const v = await Videos.get(videoId);
    await Videos.save({ ...v, stage: 'published' });           /* published today */
    TaskFrames._now = () => Date.now() + 5 * 86400000;
    const early = await TaskFrames.run();
    TaskFrames._now = () => Date.now() + 23 * 86400000;
    const r = await TaskFrames.run();
    const left = (await Store.all('task-frames')).values.map(x => x.uid);
    return { early: early.removed, removed: r.removed, left, stamped: !!(await Videos.get(videoId)).publishedAt };
  }, plan);
  ok(c2.stamped, 'publishing stamps when it went out');
  ok(c2.early === 0, 'five days after publishing nothing goes');
  ok(c2.removed === 3 && c2.left.length === 1, '21 days after the shoot and the publish, its frames go', `${c2.removed} removed`);
  ok(c2.left[0] === plan.uids[1], 'except the still, which the other task still uses');

  const c3 = await phone.evaluate(async ({ t2 }) => {
    await Store.del('tasks', t2);
    TaskFrames._now = () => Date.now() + 23 * 86400000;
    const r = await TaskFrames.run();
    return { removed: r.removed, left: (await Store.all('task-frames')).values.length };
  }, plan);
  ok(c3.removed === 1 && c3.left === 0, 'a deleted task\'s frame goes too', `${c3.removed} removed`);

  head('the laptop after sync');
  await phone.evaluate(async () => { delete TaskFrames._now; await Sync.syncNow(); });
  const lp = await laptop.evaluate(async () => {
    await Sync.syncNow();
    return { frames: (await Store.all('task-frames')).values.length, lib: (await Store.all('lib-items')).values.length,
             blobs: (await Store.all('lib-blob')).keys.length };
  });
  ok(lp.frames === 0, 'the copies are gone from the laptop as well', lp.frames);
  ok(lp.lib === 3 && lp.blobs === 3, 'the Library itself is untouched', `${lp.lib} items, ${lp.blobs} files`);

  head('page errors');
  ok(!errs.length, 'no script errors on either device', errs.slice(0, 5).join(' | '));

  await browser.close();
  await hub.close();
  console.log(`\nlaptop → phone frames  (${pass} ok, ${fail} failed)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
