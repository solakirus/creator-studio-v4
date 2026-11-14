/* Sync — keeps every device's Creator Studio in step through Sync Hub on nastime.

   Each device keeps working from its own database exactly as before, online or
   not. This only watches what changes and swaps it with the server:

     - every Store.put / del / clear is noted as "this key changed at this time"
       in a small side database (creator-studio-4-sync), never in the app's own
     - a sync pushes those keys up (reading the record as it is NOW, so ten edits
       to one task are one upload, and a key that no longer exists goes up as a
       delete), then pulls everything other devices sent since last time
     - it pulls first, then pushes. A record changed here AND on another device
       since they last met is combined (merge.js): every edit from both stays,
       and only where both changed the same detail does the newer one win — the
       other is kept in Settings → Sync → Changed on two devices. To know what
       each side changed, a record's last-synced version (its base) is kept in
       this side database from the moment it is first edited until it is back
       in step with the server.
     - "newer" never trusts a device's clock alone: a change is stamped no
       earlier than anything this device has already seen from the server
     - a delete against an edit, or a picture: the newer one wins, as before

   It runs on open, when the app comes back to the front, a few seconds after
   any change, and every few minutes while open. With no server set it does
   nothing at all.

   Not synced: the backup's own bookkeeping and this module's settings — those
   belong to one device. Pictures ARE synced; they travel inside the records as
   the same { __blob, b64 } shape "Export everything" uses. */
(function(global){
  const APP      = 'creator-studio-4';
  const DB_NAME  = (global.CS_DB_NAME || 'creator-studio-4') + '-sync';
  const PUSH_MAX_BYTES = 4 * 1024 * 1024;   /* per request, well under the server's 50 MB */
  const PUSH_MAX_ITEMS = 300;
  const EVERY    = 3 * 60 * 1000;           /* background sync while open */
  const AFTER_CHANGE = 5000;                /* quiet period after an edit */
  const TIMEOUT  = 20000;

  /* settings keys that belong to one device ('library' is the laptop's folders
     and grabber paths) */
  const LOCAL_SETTINGS = /^(backup:|sync:|library$)/;
  /* v4: the Library stays on the laptop. Its files would fill the phone and
     the server; what a task or video uses travels as 'task-frames' instead. */
  const LOCAL_STORES = new Set(['lib-items', 'lib-blob', 'lib-poster', 'lib-boards', 'nb-music']);
  const skip = (store, key) => LOCAL_STORES.has(store) ||
    (store === 'settings' && LOCAL_SETTINGS.test(String(key)));

  /* ------------------------------------------------ the side database */
  let sdbp = null;
  function sdb(){
    if(sdbp) return sdbp;
    sdbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 2);
      r.onupgradeneeded = () => {
        const d = r.result;
        if(!d.objectStoreNames.contains('dirty')) d.createObjectStore('dirty', { keyPath:'k' });
        if(!d.objectStoreNames.contains('meta'))  d.createObjectStore('meta');
        /* a changed record as it was when last in step with the server */
        if(!d.objectStoreNames.contains('base'))  d.createObjectStore('base');
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
  const getBase = k => req('base', 'readonly', s => s.get(k)).catch(() => undefined);
  const putBase = (k, v) => v === undefined ? delBase(k) : req('base', 'readwrite', s => s.put(v, k)).catch(() => {});
  const delBase = k => req('base', 'readwrite', s => s.delete(k)).catch(() => {});
  const isObjLike = v => v !== null && typeof v === 'object' && (Array.isArray(v) ||
    Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

  /* Stamps: the device's clock, but never earlier than the newest change this
     device has seen — a phone whose clock runs slow still stamps its new edit
     after the one it just received, and one running fast only pulls everyone
     forward with it. */
  let clockSeen = 0, clockLoaded = false;
  function seen(t){ if(+t > clockSeen) clockSeen = +t; }
  function stamp(){ const t = Math.max(Date.now(), clockSeen + 1); clockSeen = t; return t; }
  async function loadClock(){
    if(clockLoaded) return; clockLoaded = true;
    try { seen(await meta('clock')); } catch(e){}
  }
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
      await req('dirty', 'readwrite', s => s.put({ k, store, key, at: stamp() }));
      soon();
    } catch(e){ console.warn('sync: could not note a change', e); }
  }

  /* Many keys at once, in one write: what a restore brought in. `at` is when
     the change counts as made — now for a restore (it should win), 1 to only
     fill gaps (anything the server already has is kept, as on first connect). */
  async function touchMany(store, keys, at){
    try {
      const list = (keys || []).filter(k => k !== undefined && k !== null && !skip(store, k));
      if(!list.length) return 0;
      const when = at || stamp();
      await req('dirty', 'readwrite', s => { list.forEach(k => s.put({ k: dirtyKey(store, k), store, key: k, at: when })); });
      soon();
      return list.length;
    } catch(e){ console.warn('sync: could not note changes', e); return 0; }
  }

  /* Restore from backup used to write past Store.put, so what it brought in
     (13 Nov 2026: a whole Creator Studio 3 swipe file) was never offered to
     the server and never reached the phone. Once per device, offer what is
     in those stores again — gaps only, so nothing newer anywhere is undone. */
  const OFFER = { key:'offer:restored-1', stores:['swipes', 'swipe-thumb', 'refs', 'ref-img', 'ref-poster'] };
  async function offerRestored(){
    const cfg = await config();
    if(!cfg.server || !cfg.token || !cfg.ready || await meta(OFFER.key)) return 0;
    const kp = await layout();
    let n = 0;
    for(const st of OFFER.stores){
      if(!(st in kp)) continue;
      let keys = [];
      try { keys = (await Store.all(st)).keys; } catch(e){}
      n += await touchMany(st, keys, 1);
    }
    await setMeta(OFFER.key, Date.now());
    return n;
  }

  /* Before a record in step with the server is first changed, keep it as it
     is: that is what both sides started from, should another device change it
     too before they meet. Already changed since then: the base stays. */
  async function keepBase(store, key){
    try {
      if(key === undefined || key === null || skip(store, key)) return;
      const dk = dirtyKey(store, key);
      if(await getDirty(dk)) return;
      const old = await Store.get(store, key);
      if(isObjLike(old)) await putBase(dk, old);
    } catch(e){}
  }

  Store.put = async function(store, value, key){
    let k = key;
    if(k === undefined){
      try { const kp = (await layout())[store]; k = kp && value ? value[kp] : undefined; } catch(e){}
    }
    await keepBase(store, k);
    const r = await raw.put(store, value, key);
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
    for(let round = 0; round < 200; round++){
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
        bytes += size; batch.push(change); picked.push({ e, value });
      }
      if(!batch.length) return sent;

      const r = await call(cfg, 'POST', '/sync/' + APP, { changes: batch });
      const byId = new Map(picked.map(p => [p.e.store + '\u0001' + JSON.stringify(p.e.key), p]));

      for(const a of (r.accepted || [])){
        const p = byId.get(a.store + '\u0001' + a.id);
        if(!p) continue;
        /* in step with the server again — unless it was edited while on its
           way, in which case what the server now has is that edit's base */
        if(await clearIfUnchanged(p.e)) await delBase(p.e.k);
        else await putBase(p.e.k, isObjLike(p.value) ? p.value : undefined);
      }
      for(const x of (r.rejected || [])){
        const p = byId.get(x.store + '\u0001' + x.id);
        /* another device got there first: combine with theirs (apply), and
           what is left to send goes up on the next round */
        if(x.reason === 'older' && x.current){
          if(x.current.updatedAt) seen(x.current.updatedAt);
          await apply(x.current, kp);
          const now = p && await getDirty(p.e.k);
          /* nothing to combine (theirs is simply newer): take theirs */
          if(now && now.at === p.e.at){ await req('dirty', 'readwrite', s => s.delete(p.e.k)); await apply(x.current, kp); }
        } else if(p) await clearIfUnchanged(p.e);
      }
      sent += batch.length;
    }
    return sent;
  }

  /* Only forget a change if nothing newer happened to that key while it was
     in flight — otherwise the newer edit would never be sent. */
  async function clearIfUnchanged(e){
    if(!e) return false;
    const now = await getDirty(e.k);
    if(now && now.at === e.at){ await req('dirty', 'readwrite', s => s.delete(e.k)); return true; }
    return false;
  }

  /* What changed on two devices, kept so the other version can be brought
     back (Settings → Sync → Changed on two devices). The newest 100. */
  async function logConflicts(store, key, value, list){
    try {
      const v = isObjLike(value) && !Array.isArray(value) ? value : {};
      const label = String(v.title || v.name || v.text || key).slice(0, 80);
      const now = Date.now();
      const add = list.map(c => ({ at:now, store, key, label, path:c.path, kept:c.kept, other:c.other }));
      const had = (await meta('conflicts')) || [];
      await setMeta('conflicts', add.concat(had).slice(0, 100));
    } catch(e){ console.warn('sync: could not keep a conflict', e); }
  }

  /* Write one change from the server into this device. A record this device
     also changed since they last met is combined with it (merge.js). */
  async function apply(c, kp){
    if(!(c.store in kp)) return false;          /* a store a newer build added */
    let key;
    try { key = JSON.parse(c.id); } catch(e){ return false; }
    if(skip(c.store, key)) return false;
    if(c.updatedAt) seen(c.updatedAt);
    const dk = dirtyKey(c.store, key);
    const d = await getDirty(dk);
    const theirs = c.deleted ? undefined : Transfer.decode(c.data, null);
    const write = async v => {
      if(v === undefined) await raw.del(c.store, key);
      else if(kp[c.store]) await raw.put(c.store, v);
      else await raw.put(c.store, v, key);
    };
    const settle = async v => {
      await write(v);
      if(d) await req('dirty', 'readwrite', s => s.delete(dk));
      await delBase(dk);
      return true;
    };

    if(!d) return settle(theirs);
    /* only offered (first connect, a catch-up): the server's copy is kept */
    if(d.at <= 1) return settle(theirs);

    let mine;
    try { mine = await Store.get(c.store, key); } catch(e){}
    const mineNewer = d.at > c.updatedAt;
    /* a delete on either side, a picture, a plain value: the newer one */
    if(theirs === undefined || mine === undefined || !isObjLike(mine) || !isObjLike(theirs) || !global.Merge){
      if(mineNewer) return false;               /* ours goes up next */
      return settle(theirs);
    }
    const base = await getBase(dk);
    const { value, conflicts } = Merge.merge(base, mine, theirs, mineNewer);
    if(conflicts.length) await logConflicts(c.store, key, value, conflicts);
    if(Merge.same(value, theirs)) return settle(theirs);
    await write(value);
    await putBase(dk, theirs);                  /* the server holds theirs now */
    await req('dirty', 'readwrite', s => s.put({ ...d, at: stamp() }));   /* the combined one goes up */
    return true;
  }

  /* A newer build added stores. While this device was on the older build, the
     server's records for those stores were passed over (apply() had nowhere to
     put them) and the cursor moved on, so a plain pull would never see them.
     The first sync on the new build reads the server from the start once,
     taking only records for the stores it just gained. */
  async function catchUp(cfg, me, kp){
    const known = await meta('stores');
    const names = Object.keys(kp).sort();
    if(!Array.isArray(known)){ await setMeta('stores', names); return 0; }   /* first sync: nothing passed over yet */
    const fresh = new Set(names.filter(n => !known.includes(n)));
    if(!fresh.size) return 0;
    let since = 0, changed = 0;
    for(;;){
      const r = await call(cfg, 'GET', `/sync/${APP}?since=${since}`);
      for(const c of (r.changes || [])){
        if(c.deviceId === me || !fresh.has(c.store)) continue;
        if(await apply(c, kp)) changed++;
      }
      since = r.cursor || since;
      if(!r.more) break;
    }
    await setMeta('stores', names);
    return changed;
  }

  async function pull(cfg, me){
    const kp = await layout();
    let since = (await meta('cursor')) || 0, changed = await catchUp(cfg, me, kp);
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
        await loadClock();
        /* pull first: what other devices changed is combined with what is
           waiting here before it goes up, rather than one replacing the other */
        const got = await pull(cfg, me);
        const sent = await push(cfg, me);
        try { await setMeta('clock', clockSeen); } catch(e){}
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
    /* lists kept in memory: without this, folders or channels made on another
       device only showed after a restart */
    ['SwipeFolders', 'SwipeTags', 'Channels', 'Months', 'Quarters'].forEach(n => {
      try { if(global[n] && global[n].invalidate) global[n].invalidate(); } catch(e){}
    });
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
      await req('base', 'readwrite', s => s.clear()).catch(() => {});
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

  /* The server moved (nastime got a new IP, 13 Nov 2026): point this device at
     the new address and keep everything else — its data, its device id and
     the changes still waiting to go up. Disconnecting to do it threw all of
     that away and then asked a question whose wrong answer wipes the device.
     The cursor starts over so nothing is missed if the hub is not quite the
     same one; anything this device changed and has not sent is kept, since
     apply() never overwrites a newer unsent edit. An empty hub gets this
     device's data, stamped old, as on a first connect. */
  async function moveServer(server){
    const c = await config();
    if(!c.token) throw new Error('This device is not connected to a server');
    const { cfg, records } = await probe(server, c.token);
    await setMeta('config', { ...c, server: cfg.server });
    await setMeta('cursor', 0);
    await setMeta('status', {});
    if(!records){
      const waiting = new Set((await allDirty()).map(e => e.k));
      const kp = await layout();
      for(const st of Object.keys(kp)){
        let keys = [];
        try { keys = (await Store.all(st)).keys; } catch(e){}
        await touchMany(st, keys.filter(k => !waiting.has(dirtyKey(st, k))), 1);
      }
    }
    emit();
    return syncNow();
  }

  /* ---- Changed on two devices: what merge.js had to choose between ---- */
  async function conflicts(){ return (await meta('conflicts')) || []; }
  async function dismissConflict(i){
    const list = await conflicts();
    list.splice(i, 1);
    await setMeta('conflicts', list); emit();
  }
  /* bring the other device's version of that detail back (a normal edit, so
     it syncs everywhere like any other) */
  async function useOther(i){
    const list = await conflicts();
    const c = list[i];
    if(!c) return false;
    const rec = await Store.get(c.store, c.key);
    if(rec === undefined) throw new Error('That item is gone now');
    const next = Merge.setAt(structuredClone(rec), c.path, c.other);
    const kp = (await layout())[c.store];
    if(kp) await Store.put(c.store, next); else await Store.put(c.store, next, c.key);
    list.splice(i, 1);
    await setMeta('conflicts', list);
    try { if(global.Data && Data.invalidate) Data.invalidate(); } catch(e){}
    emit();
    return true;
  }

  async function disconnect(){
    await setMeta('config', {});
    await setMeta('cursor', 0);
    await setMeta('status', {});
    await req('base', 'readwrite', s => s.clear()).catch(() => {});
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
    setTimeout(() => offerRestored().catch(() => 0).then(() => syncNow()), 2500);
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible') syncNow();
    });
    if(global.addEventListener) global.addEventListener('online', () => syncNow());
    setInterval(() => {
      if(document.visibilityState !== 'hidden') syncNow();
    }, EVERY);
  }

  global.Sync = { syncNow, connect, moveServer, disconnect, probe, localCount, status, setPaused, touch, touchMany, offerRestored, conflicts, useOther, dismissConflict, LOCAL_STORES,
                  onChange: f => listeners.push(f), APP };
  start();
})(window);
