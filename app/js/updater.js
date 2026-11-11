/* Updater — the Android app keeps itself current from GitHub Pages.

   The web half of the app (everything in app/) is the same code the iPad runs
   from https://solakirus.github.io/creator-studio-3/. Rather than rebuild the
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
  const REMOTE = global.CS_UPDATE_REMOTE || 'https://solakirus.github.io/creator-studio-3/';   /* tests point it elsewhere */
  const KEY = 'cs3-updater';
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
      let remote;
      try { remote = await (await fetch(REMOTE + 'update.json?t=' + Date.now(), { cache: 'no-store' })).json(); }
      catch(e){ return done({ ok:false, reason:'Could not reach GitHub' }); }
      const s = load();
      if(!remote || remote.format !== 'cs3-web') return done({ ok:false, reason:'No update information online' });
      if(remote.build === cur.build) return done({ ok:true, upToDate:true });
      if((s.bad || []).includes(remote.build)) return done({ ok:true, upToDate:true, skipped:true });
      if(remote.native > (s.nativeLevel || 1))
        return done({ ok:false, needsApk:true, reason:'This update needs a new APK — rebuild it on the laptop' });
      if(s.ready && s.ready.build === remote.build) return done({ ok:true, ready:true });

      const have = new Map(cur.files.map(f => [f[0], f[1]]));
      const dir = 'web/' + remote.build;
      status = { state:'downloading', done:0, total:remote.files.length };
      try {
        try { await FS.rmdir({ path: dir, directory: 'DATA', recursive: true }); } catch(e){}
        for(const [p, hash] of remote.files){
          /* unchanged files come from what is running, which is instant */
          const url = have.get(p) === hash ? p : REMOTE + p + '?b=' + remote.build;
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
        if(global.U && U.toast && !(opts && opts.quiet)) U.toast('App update downloaded — it loads next time you open the app');
        return done({ ok:true, ready:true, build: remote.build });
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

  global.Updater = { boot, ok, check, info, REMOTE };
  boot().catch(e => console.warn('updater', e));
})(window);
