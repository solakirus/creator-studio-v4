/* Updater — the Android app keeps itself current from GitHub Pages.

   The web half of the app (everything in app/) is the same code the iPad runs
   from https://solakirus.github.io/creator-studio-v4/. Rather than rebuild the
   APK for every change, the phone downloads new versions of those files from
   there and runs them; only native changes (widgets, plugins) need a new APK.

   How, with nothing a person has to do:
     1. A few seconds after start, read update.json from the site. If its build
        differs from what is running, download the files that changed (the rest
        are copied from what is running), check every one against its SHA-256,
        and keep them in the app's private storage, under web/<build>/.
     2. Next time the app opens, Capacitor is pointed at that folder. Same
        origin (https://localhost), so the database, sync and settings are all
        exactly where they were.
     3. If a new version fails to start three times running, the app goes back
        to the version before it and never tries that build again.

   It never applies a build mid-use, never applies one that needs a newer APK
   (update.json's `native`), and installing a new APK always wins: Capacitor
   forgets the downloaded folder when the app binary changes.

   Android only. Windows does the same from main.js; the iPad already loads the
   site itself. */
(function(global){
  const C = global.Capacitor;
  const isAndroid = !!(C && C.isNativePlatform && C.isNativePlatform() &&
                       C.getPlatform && C.getPlatform() === 'android');
  const REMOTE = global.CS_UPDATE_REMOTE || 'https://solakirus.github.io/creator-studio-v4/';   /* tests point it elsewhere */
  const KEY = 'cs4-updater';
  const NAS_KEY = 'cs4-update-nas';   /* this device's nastime address for updates: '' = work it out, 'off' = don't use */
  const EVERY = 30 * 60 * 1000;       /* look again this often while the app is open */
  const MAX_TRIES = 3;

  const plugin = name => {
    if(!C) return null;
    if(C.Plugins && C.Plugins[name]) return C.Plugins[name];
    try { return C.registerPlugin ? C.registerPlugin(name) : null; } catch(e){ return null; }
  };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){ return {}; } };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e){} };

  let current = null;            /* update.json of what is running now */
  let status = { state: isAndroid ? 'idle' : 'off' };

  async function readCurrent(){
    if(current) return current;
    try { current = await (await fetch('update.json', { cache: 'no-store' })).json(); }
    catch(e){ current = null; }
    return current;
  }

  /* ---------------------------------------------------------- where from
     v4: two places can have a newer version — GitHub Pages (what Claude or
     update.bat pushes) and nastime (what update.bat / publish-nas copies
     there, or what nastime pulled from GitHub). Each is asked; the newest
     (update.json's `made`) wins, and never anything older than what runs. */
  const slash = u => u ? (u.endsWith('/') ? u : u + '/') : '';
  async function nasAddress(){
    let own = '';
    try { own = localStorage.getItem(NAS_KEY) || ''; } catch(e){}
    if(own === 'off') return '';
    if(own) return slash(own);
    /* worked out from Sync: Sync Hub on :8787 → the app on :8795 of the same
       box; a sync address that is the app's own (the iPad's) is used as is */
    try {
      const srv = global.Sync && (await Sync.status()).server;
      if(!srv) return '';
      const u = new URL(srv);
      if(u.port === '8787') u.port = '8795';
      return slash(u.origin);
    } catch(e){ return ''; }
  }
  function setNasAddress(v){
    try { v ? localStorage.setItem(NAS_KEY, v) : localStorage.removeItem(NAS_KEY); } catch(e){}
    pushSources();
  }
  async function sources(){
    const nas = await nasAddress();
    return [{ name:'GitHub', base:REMOTE }, ...(nas && nas !== REMOTE ? [{ name:'nastime', base:nas }] : [])];
  }
  /* Windows/Linux: main.js does its own downloading; tell it about nastime */
  async function pushSources(){
    if(global.CS3Update && CS3Update.setSources) CS3Update.setSources((await sources()).slice(1).map(x => x.base));
  }
  const madeAt = m => (m && Date.parse(m.made)) || 0;
  async function readRemote(src){
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(src.base + 'update.json?t=' + Date.now(), { cache:'no-store', signal:ctl.signal });
      const m = r.ok ? await r.json() : null;
      return m && m.format === 'cs3-web' && Array.isArray(m.files) ? m : null;
    } catch(e){ return null; } finally { clearTimeout(t); }
  }
  /* every source's update.json, and the one to take (or null) */
  async function newest(cur, bad, nativeLevel){
    const list = await sources();
    const seen = await Promise.all(list.map(async src => ({ ...src, m: await readRemote(src) })));
    const ok = seen.filter(x => x.m && !(bad || []).includes(x.m.build));
    ok.sort((a, b) => madeAt(b.m) - madeAt(a.m));
    const best = ok[0] || null;
    const take = best && best.m.build !== cur.build && madeAt(best.m) > madeAt(cur) ? best : null;
    return { seen, best, take, needsShell: !!(take && take.m.native > (nativeLevel || 1)) };
  }

  /* ---------------------------------------------------------- on start */
  async function boot(){
    if(!isAndroid) return;
    const WV = plugin('WebView');
    const cur = await readCurrent();
    if(!WV || !cur) return;
    const s = load();
    s.bundles = s.bundles || {};
    s.bad = s.bad || [];

    /* Not one we downloaded: this is the copy inside the APK, so its native
       level is the APK's own. (A new APK always starts here.) */
    if(!s.bundles[cur.build]){ s.nativeLevel = cur.native; s.shipped = cur.build; }

    /* A new build that keeps failing to start: go back to what came before */
    if(s.pending && s.pending.build === cur.build){
      s.pending.tries = (s.pending.tries || 0) + 1;
      if(s.pending.tries >= MAX_TRIES){
        const back = s.pending.prev;
        s.bad.push(cur.build); s.pending = null; s.ready = null; save(s);
        if(back && s.bundles[back]) await WV.setServerBasePath({ path: s.bundles[back] });
        else await WV.setServerAssetPath({ path: 'public' });
        await WV.persistServerBasePath();
        return;                                   /* the page reloads */
      }
      save(s);
    }

    /* A downloaded build waiting: switch to it now, at startup, before the
       person has started doing anything. */
    if(s.ready && s.ready.build !== cur.build && !s.bad.includes(s.ready.build)){
      const next = s.ready;
      s.pending = { build: next.build, tries: 0, prev: s.bundles[cur.build] ? cur.build : null };
      s.ready = null; save(s);
      await WV.setServerBasePath({ path: next.path });
      await WV.persistServerBasePath();
      return;                                     /* the page reloads into it */
    }
    save(s);
    setTimeout(() => check().catch(e => console.warn('update check failed', e)), 8000);
    setInterval(() => check({ quiet:true }).catch(() => {}), EVERY);
    let lastLook = Date.now();
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState !== 'visible' || Date.now() - lastLook < 10 * 60 * 1000) return;
      lastLook = Date.now(); check({ quiet:true }).catch(() => {});
    });
  }

  /* "Load it now": the same switch boot() makes, without waiting for the
     next time the app opens. The page reloads into the new version. */
  async function applyNow(){
    if(!isAndroid) return false;
    const WV = plugin('WebView'), cur = await readCurrent(), s = load();
    if(!WV || !cur || !s.ready || s.ready.build === cur.build) return false;
    const next = s.ready;
    s.pending = { build: next.build, tries: 0, prev: (s.bundles || {})[cur.build] ? cur.build : null };
    s.ready = null; save(s);
    await WV.setServerBasePath({ path: next.path });
    await WV.persistServerBasePath();
    return true;
  }

  /* The app reached its first screen: whatever is running works. */
  async function ok(){
    if(!isAndroid) return;
    const cur = await readCurrent();
    const s = load();
    if(cur && s.pending && s.pending.build === cur.build){ s.pending = null; save(s); }
    tidy().catch(() => {});
  }

  /* ---------------------------------------------------------- downloading */
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  async function sha(buf){ return hex(await crypto.subtle.digest('SHA-256', buf)); }
  function b64(buf){
    const bytes = new Uint8Array(buf); let s = '';
    for(let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  let checking = null;
  async function check(opts){
    if(!isAndroid) return { ok:false, reason:'Only the Android app updates this way' };
    if(checking) return checking;
    checking = (async () => {
      const FS = plugin('Filesystem');
      const cur = await readCurrent();
      if(!FS || !cur || !global.crypto || !crypto.subtle) return done({ ok:false, reason:'Updates are not available on this device' });
      status = { state:'checking' };
      const s = load();
      const n = await newest(cur, s.bad, s.nativeLevel);
      if(!n.seen.some(x => x.m)) return done({ ok:false, reason:'Could not reach GitHub or nastime' });
      if(!n.take) return done({ ok:true, upToDate:true, from: n.best && n.best.name });
      const remote = n.take.m, BASE = n.take.base;
      if(n.needsShell)
        return done({ ok:false, needsApk:true, reason:'This update needs a new APK — run update.bat on the laptop' });
      if(s.ready && s.ready.build === remote.build) return done({ ok:true, ready:true, from:n.take.name });

      const have = new Map(cur.files.map(f => [f[0], f[1]]));
      const dir = 'web/' + remote.build;
      status = { state:'downloading', done:0, total:remote.files.length };
      try {
        try { await FS.rmdir({ path: dir, directory: 'DATA', recursive: true }); } catch(e){}
        for(const [p, hash] of remote.files){
          /* unchanged files come from what is running, which is instant */
          const url = have.get(p) === hash ? p : BASE + p + '?b=' + remote.build;
          const r = await fetch(url, { cache: 'no-store' });
          if(!r.ok) throw new Error(p + ': ' + r.status);
          const buf = await r.arrayBuffer();
          if(await sha(buf) !== hash) throw new Error(p + ' did not match its fingerprint');
          await FS.writeFile({ path: dir + '/' + p, data: b64(buf), directory: 'DATA', recursive: true });
          status.done++;
        }
        /* the list itself, last: a folder without it is never used */
        await FS.writeFile({ path: dir + '/update.json', data: JSON.stringify(remote),
                             directory: 'DATA', encoding: 'utf8', recursive: true });
        const { uri } = await FS.getUri({ path: dir, directory: 'DATA' });
        const abs = decodeURI(uri.replace(/^file:\/\//, ''));
        const s2 = load();
        s2.bundles = s2.bundles || {}; s2.bundles[remote.build] = abs;
        s2.ready = { build: remote.build, path: abs };
        save(s2);
        readyListeners.forEach(f => { try { f(remote.build); } catch(e){} });
        return done({ ok:true, ready:true, build: remote.build, from:n.take.name });
      } catch(e){
        try { await FS.rmdir({ path: dir, directory: 'DATA', recursive: true }); } catch(err){}
        return done({ ok:false, reason: e.message || String(e) });
      }
    })();
    try { return await checking; } finally { checking = null; }
  }
  function done(r){ status = { state: r.ok ? (r.ready ? 'ready' : 'current') : 'error', ...r, at: Date.now() }; return r; }

  /* keep only what is running and the one before it */
  async function tidy(){
    const FS = plugin('Filesystem'), cur = await readCurrent();
    if(!FS || !cur) return;
    const s = load(); const keep = new Set([cur.build]);
    if(s.pending && s.pending.prev) keep.add(s.pending.prev);
    if(s.ready) keep.add(s.ready.build);
    let list = [];
    try { list = (await FS.readdir({ path: 'web', directory: 'DATA' })).files || []; } catch(e){ return; }
    for(const f of list){
      const name = typeof f === 'string' ? f : f.name;
      if(keep.has(name)) continue;
      try { await FS.rmdir({ path: 'web/' + name, directory: 'DATA', recursive: true }); } catch(e){}
      if(s.bundles) delete s.bundles[name];
    }
    save(s);
  }

  async function info(){
    const cur = await readCurrent();
    return { available: isAndroid, build: cur ? cur.build : null, made: cur ? cur.made : null,
             shipped: load().shipped || null, status };
  }

  const readyListeners = new Set();
  const onReady = f => { if(typeof f === 'function') readyListeners.add(f); };

  global.Updater = { boot, ok, check, info, applyNow, onReady, sources, nasAddress, setNasAddress, pushSources, newest, REMOTE, isAndroid };
  boot().catch(e => console.warn('updater', e));
})(window);
