/* Sync — keeps every device's Creator Studio in step through Sync Hub on nastime.

   Each device keeps working from its own database exactly as before, online or
   not. This only watches what changes and swaps it with the server:

     - every Store.put / del / clear is noted as "this key changed at this time"
       in a small side database (creator-studio-3-sync), never in the app's own
     - a sync pushes those keys up (reading the record as it is NOW, so ten edits
       to one task are one upload, and a key that no longer exists goes up as a
       delete), then pulls everything other devices sent since last time
     - the newest change to a record wins; on an exact tie an edit beats a delete
       (the server decides that, so every device agrees)

   It runs on open, when the app comes back to the front, a few seconds after
   any change, and every few minutes while open. With no server set it does
   nothing at all.

   Not synced: the backup's own bookkeeping and this module's settings — those
   belong to one device. Pictures ARE synced; they travel inside the records as
   the same { __blob, b64 } shape "Export everything" uses. */
(function(global){
  const APP      = 'creator-studio-3';
  const DB_NAME  = (global.CS_DB_NAME || 'creator-studio-3') + '-sync';
  const PUSH_MAX_BYTES = 4 * 1024 * 1024;   /* per request, well under the server's 50 MB */
  const PUSH_MAX_ITEMS = 300;
  const EVERY    = 3 * 60 * 1000;           /* background sync while open */
  const AFTER_CHANGE = 5000;                /* quiet period after an edit */
  const TIMEOUT  = 20000;

  /* settings keys that belong to one device */
  const LOCAL_SETTINGS = /^(backup:|sync:)/;
  const skip = (store, key) => store === 'settings' && LOCAL_SETTINGS.test(String(key));

  /* ------------------------------------------------ the side database */
  let sdbp = null;
  function sdb(){
    if(sdbp) return sdbp;
    sdbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if(!d.objectStoreNames.contains('dirty')) d.createObjectStore('dirty', { keyPath:'k' });
        if(!d.objectStoreNames.contains('meta'))  d.createObjectStore('meta');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return sdbp;
  }
  function req(store, mode, fn){
    return sdb().then(d => new Promise((res, rej) => {
      const t = d.transaction(store, mode), r = fn(t.objectStore(store));
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
    }));
  }
  const meta    = k => req('meta', 'readonly', s => s.get(k));
  const setMeta = (k, v) => req('meta', 'readwrite', s => s.put(v, k));
  const dirtyKey = (store, key) => store + '\u0001' + JSON.stringify(key);
  const getDirty = k => req('dirty', 'readonly', s => s.get(k));
  const allDirty = () => req('dirty', 'readonly', s => s.getAll());
  const countDirty = () => req('dirty', 'readonly', s => s.count());

  /* ------------------------------------------------ watching the app's writes */
  const raw = { put: Store.put, del: Store.del, clear: Store.clear };
  let keyPaths = null;
  async function layout(){
    if(keyPaths) return keyPaths;
    const d = await Store.db();
    const names = [...d.objectStoreNames], out = {};
    if(names.length){
      const t = d.transaction(names, 'readonly');
      names.forEach(n => { out[n] = t.objectStore(n).keyPath || null; });
    }
    return keyPaths = out;
  }

  /* Record that a key changed. Never throws into the caller: a save that
     worked must not look like it failed because the bookkeeping hiccuped. */
  async function touch(store, key){
    try {
      if(key === undefined || key === null || skip(store, key)) return;
      const k = dirtyKey(store, key);
      await req('dirty', 'readwrite', s => s.put({ k, store, key, at: Date.now() }));
      soon();
    } catch(e){ console.warn('sync: could not note a change', e); }
  }

  Store.put = async function(store, value, key){
    const r = await raw.put(store, value, key);
    let k = key;
    if(k === undefined){
      try { const kp = (await layout())[store]; k = kp && value ? value[kp] : undefined; } catch(e){}
    }
    touch(store, k);
    return r;
  };
  Store.del = async function(store, key){
    const r = await raw.del(store, key);
    touch(store, key);
    return r;
  };
  Store.clear = async function(store){
    let keys = [];
    try { keys = (await Store.all(store)).keys; } catch(e){}
    const r = await raw.clear(store);
    for(const k of keys) await touch(store, k);
    return r;
  };
  Store.raw = raw;

  /* ------------------------------------------------ settings */
  async function config(){ return (await meta('config')) || {}; }
  async function deviceId(){
    let id = await meta('device');
    if(!id){ id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); await setMeta('device', id); }
    return id;
  }
  const clean = u => String(u || '').trim().replace(/\/+$/, '');

  /* ------------------------------------------------ talking to the server */
  async function call(cfg, method, path, body){
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT) : null;
    try {
      const r = await fetch(cfg.server + path, {
        method,
        headers: Object.assign({ 'Authorization': 'Bearer ' + cfg.token },
                               body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined,
        signal: ctl ? ctl.signal : undefined
      });
      if(r.status === 401) throw new Error('The server did not accept the token');
      if(!r.ok) throw new Error('The server answered ' + r.status);
      return await r.json();
    } catch(e){
      if(e && e.name === 'AbortError') throw new Error('The server took too long to answer');
      if(e && /Failed to fetch|NetworkError|Load failed/i.test(e.message || ''))
        throw new Error('Could not reach the server — check the address, and that you are on home Wi-Fi or Tailscale is on');
      throw e;
    } finally { if(timer) clearTimeout(timer); }
  }

  /* Ask the server who it is and what it already holds for this app. */
  async function probe(server, token){
    const cfg = { server: clean(server), token: String(token || '').trim() };
    if(!/^https?:\/\//.test(cfg.server)) throw new Error('The address should start with http:// or https://');
    const stats = await call(cfg, 'GET', '/stats');
    const mine = (stats || []).filter(r => r.app === APP);
    const records = mine.reduce((n, r) => n + (r.total - r.deleted), 0);
    return { cfg, records };
  }

  /* How much is on this device, so the first connect can ask the right question.
     Settings are left out: a brand-new install writes a couple on its own
     (the program clock, the rating), and they are not "data" anyone would
     want to protect from being replaced. */
  async function localCount(){
    const kp = await layout();
    let n = 0;
    for(const s of Object.keys(kp)){
      if(s === 'settings') continue;
      try {
        const { keys } = await Store.all(s);
        n += keys.filter(k => !skip(s, k)).length;
      } catch(e){}
    }
    return n;
  }

  /* ------------------------------------------------ one sync */
  let running = null, timer = null, listeners = [];
  const emit = () => listeners.forEach(f => { try { f(); } catch(e){} });

  async function push(cfg, me){
    const kp = await layout();
    let sent = 0;
    for(;;){
      const entries = (await allDirty()).sort((a, b) => a.at - b.at);
      if(!entries.length) return sent;

      const batch = [], picked = [];
      let bytes = 0;
      for(const e of entries){
        if(batch.length >= PUSH_MAX_ITEMS) break;
        if(!(e.store in kp)){ await req('dirty', 'readwrite', s => s.delete(e.k)); continue; }
        let value;
        try { value = await Store.get(e.store, e.key); } catch(err){ value = undefined; }
        const change = { store: e.store, id: JSON.stringify(e.key), updatedAt: e.at, deviceId: me };
        if(value === undefined){ change.deleted = true; }
        else {
          const stats = { blobs:0, bytes:0, dropped:0 };
          change.data = await Transfer.encode(value, true, stats);
        }
        const size = change.data ? JSON.stringify(change.data).length : 64;
        if(batch.length && bytes + size > PUSH_MAX_BYTES) break;
        bytes += size; batch.push(change); picked.push(e);
      }
      if(!batch.length) return sent;

      const r = await call(cfg, 'POST', '/sync/' + APP, { changes: batch });
      const byId = new Map(picked.map(e => [e.store + '\u0001' + JSON.stringify(e.key), e]));

      for(const a of (r.accepted || [])){
        const e = byId.get(a.store + '\u0001' + a.id);
        await clearIfUnchanged(e);
      }
      for(const x of (r.rejected || [])){
        const e = byId.get(x.store + '\u0001' + x.id);
        if(x.reason === 'older' && x.current) await apply(x.current, kp);
        await clearIfUnchanged(e);
      }
      sent += batch.length;
    }
  }

  /* Only forget a change if nothing newer happened to that key while it was
     in flight — otherwise the newer edit would never be sent. */
  async function clearIfUnchanged(e){
    if(!e) return;
    const now = await getDirty(e.k);
    if(now && now.at === e.at) await req('dirty', 'readwrite', s => s.delete(e.k));
  }

  /* Write one change from the server into this device, unless this device has
     a newer unsent edit to the same record. Returns true if anything changed. */
  async function apply(c, kp){
    if(!(c.store in kp)) return false;          /* a store a newer build added */
    let key;
    try { key = JSON.parse(c.id); } catch(e){ return false; }
    if(skip(c.store, key)) return false;
    const d = await getDirty(dirtyKey(c.store, key));
    if(d && d.at > c.updatedAt) return false;    /* ours is newer; it goes up next */

    if(c.deleted) await raw.del(c.store, key);
    else {
      const value = Transfer.decode(c.data, null);
      if(kp[c.store]) await raw.put(c.store, value);
      else await raw.put(c.store, value, key);
    }
    if(d) await req('dirty', 'readwrite', s => s.delete(d.k));
    return true;
  }

  async function pull(cfg, me){
    const kp = await layout();
    let since = (await meta('cursor')) || 0, changed = 0;
    /* The app's data was cleared (an iPad clearing a home-screen app's storage,
       say) but this side database kept its place in the server's history. It
       would then ask only for changes after that point and get none: "0 in,
       0 out" on an empty device. An empty device starts from the beginning. */
    if(since && !(await localCount())){ since = 0; await setMeta('cursor', 0); }
    for(;;){
      const r = await call(cfg, 'GET', `/sync/${APP}?since=${since}`);
      for(const c of (r.changes || [])){
        if(c.deviceId === me) continue;          /* our own, echoed back */
        if(await apply(c, kp)) changed++;
      }
      since = r.cursor || since;
      await setMeta('cursor', since);
      if(!r.more) return changed;
    }
  }

  async function syncNow(opts){
    if(running) return running;
    running = (async () => {
      const cfg = await config();
      if(!cfg.server || !cfg.token || cfg.paused) return { ok:false, skipped:true };
      if(!cfg.ready) return { ok:false, skipped:true, needsSetup:true };
      if(typeof navigator !== 'undefined' && navigator.onLine === false)
        return note({ ok:false, error:'Offline — changes are saved here and will go up later' });
      if(!global.Transfer || !Transfer.encode) return note({ ok:false, error:'Sync could not start' });
      const me = await deviceId();
      try {
        const sent = await push(cfg, me);
        const got = await pull(cfg, me);
        if(got) refresh();
        return note({ ok:true, sent, got, at: Date.now() });
      } catch(e){
        return note({ ok:false, error: e.message || String(e) });
      }
    })();
    try { return await running; } finally { running = null; emit(); }
  }

  async function note(r){
    const s = (await meta('status')) || {};
    const next = r.ok ? { at: r.at, sent: r.sent, got: r.got, error: null }
                      : { ...s, error: r.error, errorAt: Date.now() };
    await setMeta('status', next);
    return r;
  }

  /* Something arrived: drop the caches and redraw the tab, unless the person
     is typing or has a screen pushed on top — then the shell redraws it when
     that screen closes, because invalidate() bumps the version it watches. */
  function refresh(){
    try { if(global.Data && Data.invalidate) Data.invalidate(); } catch(e){}
    try {
      const a = document.activeElement;
      const typing = a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
      const onTab = !global.Screens || !Screens.depth || Screens.depth() === 0;
      if(!typing && onTab && global.App && App.refreshTab) App.refreshTab();
    } catch(e){}
    try { if(global.Widget && Widget.refresh) Widget.refresh(); } catch(e){}
  }

  function soon(){
    clearTimeout(timer);
    timer = setTimeout(() => syncNow(), AFTER_CHANGE);
  }

  /* ------------------------------------------------ connecting a device */

  /* how: 'upload'  — the server is empty, or this device's data goes up and
                      joins what is there (the server's copy wins a clash)
          'replace' — this device takes the server's data and drops its own
          'merge'   — same as upload, named for when both sides have data */
  async function connect(server, token, how){
    const { cfg } = await probe(server, token);
    await setMeta('config', { ...cfg, ready:false });
    await setMeta('cursor', 0);
    await setMeta('status', {});
    const kp = await layout();

    if(how === 'replace'){
      /* a fresh identity, so nothing on the server is mistaken for our echo */
      await setMeta('device', null); await deviceId();
      await req('dirty', 'readwrite', s => s.clear());
      for(const st of Object.keys(kp)){
        if(st === 'settings'){
          const { keys } = await Store.all(st);
          for(const k of keys) if(!skip(st, k)) await raw.del(st, k);
        } else await raw.clear(st);
      }
    } else {
      /* Everything here goes up. Stamped as very old, so where the server
         already has the same record, the server's copy is the one kept. */
      for(const st of Object.keys(kp)){
        let keys = [];
        try { keys = (await Store.all(st)).keys; } catch(e){}
        for(const k of keys){
          if(skip(st, k)) continue;
          await req('dirty', 'readwrite', s => s.put({ k: dirtyKey(st, k), store: st, key: k, at: 1 }));
        }
      }
    }
    await setMeta('config', { ...cfg, ready:true });
    const r = await syncNow();
    if(how === 'replace') refresh();
    return r;
  }

  async function disconnect(){
    await setMeta('config', {});
    await setMeta('cursor', 0);
    await setMeta('status', {});
    await req('dirty', 'readwrite', s => s.clear());
    emit();
  }

  async function setPaused(p){
    const c = await config();
    await setMeta('config', { ...c, paused: !!p });
    emit();
  }

  async function status(){
    const c = await config();
    const s = (await meta('status')) || {};
    let pending = 0;
    try { pending = await countDirty(); } catch(e){}
    return { server: c.server || '', connected: !!(c.server && c.token && c.ready),
             paused: !!c.paused, at: s.at || null, got: s.got || 0, sent: s.sent || 0,
             error: s.error || null, errorAt: s.errorAt || null, pending, running: !!running };
  }

  /* ------------------------------------------------ when to run */
  function start(){
    if(typeof document === 'undefined') return;
    setTimeout(() => syncNow(), 2500);
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible') syncNow();
    });
    if(global.addEventListener) global.addEventListener('online', () => syncNow());
    setInterval(() => {
      if(document.visibilityState !== 'hidden') syncNow();
    }, EVERY);
  }

  global.Sync = { syncNow, connect, disconnect, probe, localCount, status, setPaused, touch,
                  onChange: f => listeners.push(f), APP };
  start();
})(window);
