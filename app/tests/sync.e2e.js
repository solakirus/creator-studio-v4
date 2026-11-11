/* Sync, end to end: two devices, each with its own database, swapping changes
   through a real Sync Hub server.

   Not part of `npm test` (it needs the server and fake-indexeddb), so run by
   hand, from app/:

     npm i --no-save fake-indexeddb
     SYNC_HUB=/path/to/sync-hub node tests/sync.e2e.js

   SYNC_HUB is the folder holding Sync Hub's server.js. The checks are the
   cases that decide whether sync loses work: a delete on one device and an add
   on the other both landing, a stale edit not overwriting a newer one, a
   picture surviving the trip, a device's own settings staying its own, and a
   second device joining by replacing its data with the server's. */
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HUB = process.env.SYNC_HUB;
if (!HUB || !fs.existsSync(path.join(HUB, 'server.js'))) {
  console.error('Set SYNC_HUB to the folder with Sync Hub\'s server.js'); process.exit(2);
}
let FakeIDB;
try { FakeIDB = require('fake-indexeddb'); }
catch (e) { console.error('npm i --no-save fake-indexeddb first'); process.exit(2); }

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  console.log(`  ${cond ? 'ok ' : 'FAIL'}  ${name.padEnd(58)} ${extra}`);
  cond ? pass++ : fail++;
};
const head = s => console.log(`\n— ${s} —`);

/* FileReader is a browser thing; Transfer.encode uses it for pictures */
class FileReader {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(b => {
      this.result = `data:${blob.type};base64,` + Buffer.from(b).toString('base64');
      this.onload && this.onload();
    }, err => { this.error = err; this.onerror && this.onerror(); });
  }
}

/* One device: its own IndexedDB, the real store/util/transfer/sync code. */
function device(name) {
  const ctx = {
    console, Date, Math, JSON, Promise, Blob, Map, Set, Error, Object, Array, String, Number,
    ArrayBuffer, Uint8Array, atob, btoa, fetch, AbortController, FileReader, URL,
    structuredClone,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0,   /* syncs run when the test says */
    indexedDB: new FakeIDB.IDBFactory(), IDBKeyRange: FakeIDB.IDBKeyRange,
    navigator: { onLine: true }
  };
  ctx.window = ctx; ctx.CS_DB_NAME = 'cs3-test-' + name;
  vm.createContext(ctx);
  for (const f of ['js/util.js', 'js/store.js', 'js/sync.js', 'js/transfer.js']) {
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { if (f !== 'js/util.js') throw e; }   /* util touches the DOM in places; only taskId is needed */
  }
  if (!ctx.U) ctx.U = {};
  return ctx;
}

(async () => {
  /* a throwaway server */
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'synchub-'));
  const PORT = 18787 + Math.floor(Math.random() * 500), TOKEN = 'e2e-token';
  const srv = spawn(process.execPath, ['--no-warnings', path.join(HUB, 'server.js')],
    { env: { ...process.env, PORT, DATA_DIR: data, SYNC_TOKEN: TOKEN }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.once('data', r));
  const URL_ = `http://127.0.0.1:${PORT}`;

  try {
    const phone = device('phone'), laptop = device('laptop');
    const S = d => d.Store, Y = d => d.Sync;

    head('connecting');
    let bad = null;
    try { await Y(phone).probe(URL_, 'wrong'); } catch (e) { bad = e.message; }
    t('a wrong token is refused in plain words', /token/.test(bad || ''), bad);

    /* the phone has the real data */
    await S(phone).put('tasks', { id: 1, day: 3, title: 'Clip A shoot', view: 'todo' });
    await S(phone).put('tasks', { id: 2, day: 4, title: 'Edit B', view: 'todo' });
    await S(phone).put('settings', { start: 123 }, 'program');
    await S(phone).put('settings', { at: 5 }, 'backup:state');
    const pic = new Blob([Buffer.from([1, 2, 3, 250, 251])], { type: 'image/jpeg' });
    await S(phone).put('task-media', pic, '1:0');

    const p1 = await Y(phone).probe(URL_, TOKEN);
    t('an empty server says it holds nothing', p1.records === 0);
    const r1 = await Y(phone).connect(URL_, TOKEN, 'upload');
    t('the first device uploads everything', r1.ok && r1.sent === 4, JSON.stringify(r1));

    /* the laptop has some junk of its own and joins by taking the server's */
    await S(laptop).put('tasks', { id: 1, day: 1, title: 'laptop junk', view: 'todo' });
    await S(laptop).put('settings', { at: 9 }, 'backup:state');
    const r2 = await Y(laptop).connect(URL_, TOKEN, 'replace');
    t('the second device joins by replacing', r2.ok && r2.got === 4, JSON.stringify(r2));
    const lt = (await S(laptop).allMap('tasks'));
    t('its junk is gone, the phone\'s tasks are there', Object.keys(lt).length === 2 && lt[1].title === 'Clip A shoot');
    t('a device\'s backup bookkeeping stays its own', (await S(laptop).get('settings', 'backup:state')).at === 9);
    const lp = await S(laptop).get('task-media', '1:0');
    const bytes = lp ? [...new Uint8Array(await lp.arrayBuffer())] : [];
    t('a picture survives the trip byte for byte', bytes.join() === '1,2,3,250,251' && lp.type === 'image/jpeg');

    head('the case from the chat: delete here, add there');
    await S(phone).del('tasks', 2);
    const newId = phone.U.taskId();
    await S(laptop).put('tasks', { id: newId, day: 5, title: 'New clip C', view: 'todo' });
    await Y(phone).syncNow(); await Y(laptop).syncNow(); await Y(phone).syncNow();
    const pt = await S(phone).allMap('tasks'), lt2 = await S(laptop).allMap('tasks');
    t('the delete reached the laptop', !lt2[2]);
    t('the add reached the phone', pt[newId] && pt[newId].title === 'New clip C');
    t('both devices now hold the same tasks', JSON.stringify(Object.keys(pt).sort()) === JSON.stringify(Object.keys(lt2).sort()));

    head('the same task on both');
    const a = await S(phone).get('tasks', 1);
    await S(laptop).put('tasks', { ...a, title: 'older edit (laptop)' });
    await new Promise(r => global.setTimeout(r, 15));
    await S(phone).put('tasks', { ...a, title: 'newer edit (phone)' });
    await Y(phone).syncNow(); await Y(laptop).syncNow();
    t('the newer edit wins on the device that made the older one', (await S(laptop).get('tasks', 1)).title === 'newer edit (phone)');
    t('and stays on the device that made it', (await S(phone).get('tasks', 1)).title === 'newer edit (phone)');

    await S(phone).del('tasks', 1);
    await new Promise(r => global.setTimeout(r, 15));
    await S(laptop).put('tasks', { ...a, title: 'edited after the delete' });
    await Y(phone).syncNow(); await Y(laptop).syncNow(); await Y(phone).syncNow();
    t('an edit made after a delete brings the task back', (await S(phone).get('tasks', 1) || {}).title === 'edited after the delete');

    head('a third device that combines');
    const ipad = device('ipad');
    const own = ipad.U.taskId() + 7;
    await S(ipad).put('tasks', { id: own, day: 9, title: 'only on the iPad', view: 'todo' });
    await S(ipad).put('tasks', { id: 1, day: 9, title: 'iPad clash', view: 'todo' });
    const r3 = await Y(ipad).connect(URL_, TOKEN, 'merge');
    await Y(phone).syncNow();
    t('combining sends up what only it had', ((await S(phone).get('tasks', own)) || {}).title === 'only on the iPad', JSON.stringify(r3));
    t('and where both had an item, the server\'s is kept', (await S(ipad).get('tasks', 1)).title === 'edited after the delete'
      && (await S(phone).get('tasks', 1)).title === 'edited after the delete');

    head('clearing one device stays on that device');
    /* what Settings > Clear local data does */
    await Y(ipad).disconnect();
    for (const n of S(ipad).names()) await S(ipad).raw.clear(n);
    await Y(phone).syncNow();
    t('the cleared device is empty', Object.keys(await S(ipad).allMap('tasks')).length === 0);
    t('and the other device still has everything', Object.keys(await S(phone).allMap('tasks')).length >= 3);
    const after = await Y(ipad).connect(URL_, TOKEN, 'replace');
    t('reconnecting it fills it back up', Object.keys(await S(ipad).allMap('tasks')).length
      === Object.keys(await S(phone).allMap('tasks')).length, JSON.stringify(after));

    head('a device whose data was wiped but kept its sync place');
    for (const n of S(ipad).names()) await S(ipad).raw.clear(n);   /* data gone, side database kept */
    const heal = await Y(ipad).syncNow();
    t('it downloads everything again instead of "0 in, 0 out"', heal.got > 0
      && Object.keys(await S(ipad).allMap('tasks')).length === Object.keys(await S(phone).allMap('tasks')).length, JSON.stringify(heal));

    head('ids');
    const ids = new Set(); for (let i = 0; i < 500; i++) ids.add(phone.U.taskId());
    const lap = laptop.U.taskId();
    t('500 new task ids on one device are all different', ids.size === 500);
    t('and bigger than any old counting id', Math.min(...ids) > 1e12 && Number.isSafeInteger(lap));

    head('status');
    const st = await Y(phone).status();
    t('nothing left waiting after a sync', st.pending === 0 && st.connected && !st.error, JSON.stringify(st));
    await S(phone).put('tasks', { id: 77, day: 1, title: 'offline edit', view: 'todo' });
    t('an edit made since is counted as waiting', (await Y(phone).status()).pending === 1);
  } catch (e) {
    console.error(e); fail++;
  } finally {
    srv.kill();
    fs.rmSync(data, { recursive: true, force: true });
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
