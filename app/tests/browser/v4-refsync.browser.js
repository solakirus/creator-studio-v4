/* Browser test: a reference section grabbed on the laptop plays on the phone
   and the iPad — offline too (refclip.js, the synced 'ref-clips' store).

   Laptop (Electron bridge stood in, refGrab returns a real mp4 and GIF), a
   phone app (Capacitor stood in) and an iPad-sized browser, on a stand-in
   Sync Hub.
   - Grab on the laptop → the episode's shot carries rc: copies; they sync.
   - The phone and the iPad show "grabbed" with the GIF and play the copy
     (a blob, no YouTube) — with the hub gone too.
   - A grab from before (kept in the laptop's own Library) moves over by itself.
   - Posted + 3 days: the copy goes on every device.

     node app/tests/browser/v4-refsync.browser.js [out folder] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const hubMod = require('../helpers/mini-synchub');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const FX = f => fs.readFileSync(path.join(__dirname, '..', 'fixtures', f)).toString('base64');
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const head = s => console.log(`\n— ${s} —`);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  let hub = await hubMod.start({ token: 'tok' });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
  const errs = [];
  const CLIP = FX('clip.webm'), GIFB = FX('opener.gif');
  async function device(name, opts, init){
    const ctx = await b.newContext(opts);
    if(init) await ctx.addInitScript(init, [CLIP, GIFB]);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('dialog', d => d.accept());
    await p.route(/github\.io|youtube|ytimg/, r => r.fulfill({ status:200, contentType:'text/html', body:'<p>stub</p>' }));
    await p.goto(url); await p.waitForFunction(() => window.App && window.RefClip && window.Sync && window.MediaLib, null, { timeout: 15000 });
    await p.waitForTimeout(800); return p;
  }
  const laptopInit = ([clip, gif]) => {
    const bytes = b64 => { const bin = atob(b64), u8 = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; };
    window.CS3Lib = { home: async () => ({ path:'/x', exists:true }), scan: async () => ({ items: [], pages: [], roots: [], errors: [] }),
      pickFolder: async () => null, open: async () => {}, trash: async () => 0, boardFolder: async () => ({}), shotline: async () => null,
      grabFind: async () => null, grabRun: async () => ({}), grabStop: async () => {}, grabStatus: async () => ({ running:false, lines:[], links:[] }), onGrab: () => () => {},
      refGrab: async o => ({ ok:true, title:'Test', clip:bytes(clip), gif:bytes(gif), lines:[] }) };
  };
  const phoneInit = () => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {} }; };
  const episode = { id:'v1', title:'Morning routine', acts:[{ id:'a1', title:'Mon', beats:[{ id:'b1', title:'Open', shots:[
    { id:'s1', text:'Kettle on', vref:{ url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ', start:10, end:83 } }, { id:'s2', text:'Window light' }] }] }] };
  try {
    const L = await device('laptop', { viewport: { width: 1280, height: 860 } }, laptopInit);
    const P = await device('phone', { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true }, phoneInit);
    const I = await device('ipad', { viewport: { width: 1024, height: 1366 }, hasTouch: true });
    for(const [d, how] of [[L, 'upload'], [P, 'replace'], [I, 'replace']]) await d.evaluate(([h, w]) => Sync.connect(h, 'tok', w), [hub.url, how]);

    head('grab on the laptop');
    const v = await L.evaluate(async e => { e.week = await Data.currentWeek(); await Store.put('vlogs', e); const sh = e.acts[0].beats[0].shots[0];
      sh.vref = await RefClip.grab(sh.vref, sh.text); await Store.put('vlogs', e); await Sync.syncNow(); return sh.vref; }, episode);
    ok(/^rc:rc_.*:clip$/.test(v.clip) && /:gif$/.test(v.gif), 'the shot carries the section and the GIF as synced copies', JSON.stringify([v.clip, v.gif]));

    for(const [d, name] of [[P, 'phone'], [I, 'iPad']]){
      head('on the ' + name);
      await d.evaluate(() => Sync.syncNow()); await d.waitForTimeout(300);
      const got = await d.evaluate(async () => { const e = await Store.get('vlogs', 'v1'); const r = e.acts[0].beats[0].shots[0].vref;
        const l = await MediaLib.load(true); const c = MediaLib.find(l, r.clip), g = MediaLib.find(l, r.gif);
        return { c: c && (await MediaLib.url(c) || '').slice(0, 5), g: g && (await MediaLib.url(g) || '').slice(0, 5), bytes: c ? c.bytes : 0 }; });
      ok(got.c === 'blob:' && got.g === 'blob:' && got.bytes > 0, `the ${name} has the section and the GIF`, JSON.stringify(got));
      await d.evaluate(() => Screens.push('vlog-day', { vlogId:'v1', actId:'a1' })); await d.waitForTimeout(1500);
      const chip = await d.textContent('.screen:last-child [data-sbvplay="0"]').catch(() => '');
      ok(/grabbed/.test(chip) && !!(await d.$('.screen:last-child [data-sbvplay="0"] .rc-gif')), `the ${name}’s storyboard shows the GIF and “grabbed”`, chip.replace(/\s+/g, ' ').trim());
      await d.screenshot({ path: path.join(out, `refsync-${name}.png`) });
      if(name === 'iPad'){ await hub.close(); hub = null; }   /* the iPad plays it with nastime gone */
      await d.click('.screen:last-child [data-sbvplay="0"]'); await d.waitForTimeout(800);
      ok(!!(await d.$('.rc-pop video[src^="blob:"]')) && !(await d.$('.spl-frame')), `the ${name} plays the grabbed copy, not YouTube${name === 'iPad' ? ' — with nastime off' : ''}`);
      await d.click('.rc-pop .rc-x').catch(() => {});
    }
    hub = await hubMod.start({ token: 'tok' });
    for(const d of [L, P, I]) await d.evaluate(h => Sync.moveServer(h).catch(() => null), hub.url);

    head('an older grab moves over');
    const moved = await L.evaluate(async ([clip, gif]) => {
      const bytes = b64 => { const bin = atob(b64), u8 = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; };
      const o = { library:'References', page:'Grabbed sections' };
      const c = await MediaLib.addBlob(new Blob([bytes(clip)], { type:'video/mp4' }), { ...o, kind:'video', name:'reference.mp4', label:'Old one' });
      const g = await MediaLib.addBlob(new Blob([bytes(gif)], { type:'image/gif' }), { ...o, kind:'gif', name:'reference.gif', label:'Old one' });
      const e = await Store.get('vlogs', 'v1'); e.acts[0].beats[0].shots[1].vref = { url:'https://youtu.be/abc', start:0, end:5, clip:c, gif:g };
      await Store.put('vlogs', e);
      const n = await RefClip.moveOld();
      const r = (await Store.get('vlogs', 'v1')).acts[0].beats[0].shots[1].vref;
      const left = (await Store.all('lib-items')).values.filter(x => x.library === 'References').length;
      await Sync.syncNow();
      return { n, clip:r.clip, left };
    }, [CLIP, GIFB]);
    ok(moved.n === 1 && /^rc:/.test(moved.clip) && moved.left === 0, 'it moves into the synced copies and leaves the laptop’s Library', JSON.stringify(moved));
    ok(await P.evaluate(async () => { await Sync.syncNow(); const r = (await Store.get('vlogs', 'v1')).acts[0].beats[0].shots[1].vref; const l = await MediaLib.load(true); return !!MediaLib.find(l, r.clip); }), 'and reaches the phone');

    head('posted + 3 days');
    const n = await L.evaluate(async () => { const e = await Store.get('vlogs', 'v1'); e.editSteps = [{ n:'Post', done:true, at:Date.now() - 4 * 86400000 }];
      await Store.put('vlogs', e); const n = await RefClip.cleanup(); await Sync.syncNow(); return n; });
    await P.evaluate(() => Sync.syncNow()); await I.evaluate(() => Sync.syncNow());
    const left = await Promise.all([L, P, I].map(d => d.evaluate(() => Store.all('ref-clips').then(r => r.values.length))));
    ok(n === 2 && left.join() === '0,0,0', 'the copies go on every device (the links stay)', JSON.stringify({ n, left }));
  } catch(e){ ok(false, 'ran to the end', e.message); }
  ok(!errs.length, 'no page errors', errs.join(' | '));
  await b.close(); if(hub) await hub.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
