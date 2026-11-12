/* The Library — GIFs, clips and stills to plan with, carried over from Shotline.

   Two kinds of frames sit side by side and look the same everywhere:
     • ones you added to the app (phone and laptop): the file is kept inside the
       app, so it travels with a backup.            uid "db:<id>"
     • on the laptop, ones in folders on disk — ~/Shot Library and any folder
       you add — read with Shotline's rules.         uid "h:<root>|<path>"
   Both are grouped the way Shotline groups them: a library (collection), and
   inside it pages (a grabbed page, a video, or a batch you added).

   Boards are Shotline's boards: a name, a group (Activity, Location, Mood,
   Subject, Other) and the frames on it. A frame can sit on many boards. */
(function(global){

  const BOARD_GROUPS = ['Activity', 'Location', 'Mood', 'Subject', 'Other'];
  const KIND_LABEL = { gif:'GIF', video:'Clip', image:'Still' };
  const KINDS = ['gif', 'video', 'image'];
  /* clips.js MAX_GIF: a moving picture bigger than this shows as a still */
  const MAX_GIF_BYTES = 30 * 1024 * 1024;

  const disk = () => global.CS3Lib || null;

  /* v4: the iPad (any browser that opened the app from nastime) reads the
     same Shot Library the laptop does, through nastime: the list from
     shotlib-index.json (nas/helper.js), the files from shotlib/<path>. Read
     only — grabbing, folders and copies stay on the laptop. The phone app
     (Capacitor) and the laptop (its own disk) never use this. */
  const REMOTE_KEY = 'cs4.remoteLib';
  const webOnly = () => !disk() && /^https?:$/.test(location.protocol) &&
    !(global.Capacitor && global.Capacitor.isNativePlatform && global.Capacitor.isNativePlatform());
  let remoteOn = (() => { try { return webOnly() && localStorage.getItem(REMOTE_KEY) === '1'; } catch(e){ return false; } })();
  const libListeners = new Set();
  async function readRemote(){
    const r = await fetch('shotlib-index.json?t=' + Date.now(), { cache:'no-store' });
    const j = r.ok ? await r.json() : null;
    if(!j || j.format !== 'cs4-shotlib' || !Array.isArray(j.items)) throw new Error(r.ok ? 'Not a Shot Library list' : 'nastime answered ' + r.status);
    const abs = u => new URL(u, location.href).href;
    j.items.forEach(it => { it.src = 'h'; it.url = abs(it.url); });
    j.pages.forEach(p => { p.src = 'h'; });
    return j;
  }
  async function probeRemote(){
    let on = false;
    if(webOnly()){ try { await readRemote(); on = true; } catch(e){ on = false; } }
    try { on ? localStorage.setItem(REMOTE_KEY, '1') : localStorage.removeItem(REMOTE_KEY); } catch(e){}
    if(on !== remoteOn){ remoteOn = on; diskCache = null; cache = null; libListeners.forEach(f => { try { f(on); } catch(e){} }); }
    return on;
  }
  /* is there a Library on this device — the laptop's folders, or nastime's */
  const hasLibrary = () => !!disk() || remoteOn;
  const uidOf = rec => 'db:' + rec.id;
  const newId = () => 'li_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* library.rs kind_of, from a name or a MIME type */
  function kindOf(name, mime){
    const m = /\.([a-z0-9]+)$/i.exec(name || '');
    const e = m ? m[1].toLowerCase() : '';
    if(e === 'gif' || mime === 'image/gif') return 'gif';
    if(['mp4','webm','mov','m4v','ogv'].includes(e) || /^video\//.test(mime || '')) return 'video';
    if(['jpg','jpeg','png','webp','avif','bmp','jfif'].includes(e) || /^image\//.test(mime || '')) return 'image';
    return null;
  }

  function titleCase(s){
    return String(s || '').replace(/[-_]/g, ' ').split(/\s+/).filter(Boolean).join(' ')
      .replace(/(^|[^a-z0-9])([a-z0-9])/gi, (m, a, b) => a + b.toUpperCase());
  }

  /* ------------------------------------------------------------ settings */
  const DEFAULTS = { roots:[], hidden:[], play:true, deckKind:'all', deckSrc:'all', target:null,
                     grabber:'', links:'', libName:'', follow:false, maxPages:20, ytEvery:0, ytMax:200,
                     ytSens:'normal', ytWhat:'both', ytMode:'download', gifSecs:3, gifMode:'shot',
                     gifMax:200, keepVideo:false, scanUrl:'', scanMax:200, bigGifs:'link', cookies:'none',
                     mirrors:{}, copied:{} };
  let settingsCache = null;
  async function settings(){
    if(!settingsCache){
      let s = null;
      try { s = await Store.get('settings', 'library'); } catch(e){ s = null; }
      settingsCache = { ...DEFAULTS, ...(s || {}) };
    }
    return settingsCache;
  }
  async function setSettings(patch){
    const s = { ...(await settings()), ...patch };
    settingsCache = s;
    await Store.put('settings', s, 'library');
    return s;
  }

  /* ------------------------------------------------------------ reading */
  let cache = null, diskCache = null, loading = null;

  /* the frames inside the app */
  async function appItems(){
    let recs = [];
    try { recs = (await Store.all('lib-items')).values; } catch(e){ recs = []; }
    const pages = new Map();
    const items = recs.map(r => {
      const lib = r.library || 'My library';
      const pg = r.page || 'Added';
      const pageUid = 'db|' + lib + '|' + pg;
      if(!pages.has(pageUid)) pages.set(pageUid, { uid:pageUid, src:'db', collection:lib, page:pg,
        title:'', heading:'', source:r.link || '', grabbed:new Date(r.createdAt || 0).toISOString(), counts:[0,0,0] });
      const p = pages.get(pageUid);
      p.counts[KINDS.indexOf(r.kind)]++;
      return { uid:uidOf(r), id:r.id, src:'db', kind:r.kind, name:r.name || 'file', label:r.label || '',
               caption:r.caption || '', link:r.link || '', page:pageUid, bytes:r.bytes || 0,
               createdAt:r.createdAt || 0, mime:r.mime || '',
               big:r.big || '', source:r.source || '', tags:r.tags || [], from:r.from || '' };
    });
    items.sort((a, b) => (b.createdAt - a.createdAt) || (a.name < b.name ? -1 : 1));
    return { items, pages:[...pages.values()] };
  }

  async function diskItems(force){
    const d = disk();
    if(!d && remoteOn){
      if(diskCache && !force) return diskCache;
      try { const j = await readRemote(); diskCache = { items:j.items, pages:j.pages, roots:[], errors:[] }; }
      catch(e){ diskCache = { items:[], pages:[], roots:[], errors:['nastime’s Shot Library can’t be reached — ' + (e.message || e)] }; }
      return diskCache;
    }
    if(!d) return { items:[], pages:[], roots:[], errors:[] };
    if(diskCache && !force) return diskCache;
    const s = await settings();
    try {
      const r = await d.scan(s.roots || [], s.mirrors || {});
      r.items.forEach(it => { it.src = 'h'; });
      r.pages.forEach(p => { p.src = 'h'; });
      diskCache = r;
    } catch(e){
      console.warn('Library folders could not be read', e);
      diskCache = { items:[], pages:[], roots:[], errors:[String(e && e.message || e)] };
    }
    return diskCache;
  }

  /* frames kept for tasks (the task-frames store), shaped like Library items */
  async function keptItems(){
    let recs = [];
    try { recs = (await Store.all('task-frames')).values; } catch(e){ recs = []; }
    return recs.filter(r => r && r.uid).map(r => ({ uid:r.uid, id:r.uid, src:'tf', kind:r.kind || 'image',
      name:r.name || 'frame', label:r.label || '', caption:r.caption || '', link:'', page:'', bytes:r.bytes || 0,
      createdAt:r.keptAt || 0, mime:r.mime || '', big:'', source:'', tags:[], from:'' }));
  }
  async function keptRecord(uid){ try { return await Store.get('task-frames', uid); } catch(e){ return null; } }

  /* library.rs reindex: collections from pages, newest page first */
  function index(items, pages){
    const byUid = new Map(items.map(it => [it.uid, it]));
    const byPlain = new Map();
    items.forEach(it => { if(it.path && !byPlain.has(it.path)) byPlain.set(it.path, it); });
    /* A frame copied into the app (bringIn) still answers to the folder address
       it came from, so templates, pages and tasks that point at the folder copy
       find it on a device without that folder. The folder copy wins where both exist. */
    items.forEach(it => {
      if(!it.from) return;
      if(!byUid.has(it.from)) byUid.set(it.from, it);
      const plain = it.from.includes('|') ? it.from.slice(it.from.indexOf('|') + 1) : '';
      if(plain && !byPlain.has(plain)) byPlain.set(plain, it);
    });
    const pageIdx = new Map(pages.map(p => [p.uid, p]));
    const cols = new Map();
    pages.forEach(p => {
      const key = (p.src === 'h' ? 'h:' + p.root : 'db') + '|c|' + p.collection;
      if(!cols.has(key)) cols.set(key, { key, src:p.src, root:p.root || '', name:p.collection, pages:[], counts:[0,0,0] });
      const c = cols.get(key);
      c.pages.push(p.uid);
      p.colKey = key;
      for(let k = 0; k < 3; k++) c.counts[k] += p.counts[k];
    });
    const collections = [...cols.values()].sort((a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1);
    collections.forEach(c => c.pages.sort((a, b) => {
      const pa = pageIdx.get(a), pb = pageIdx.get(b);
      return (pb.grabbed || '').localeCompare(pa.grabbed || '') || String(pa.page).localeCompare(String(pb.page));
    }));
    return { items, pages, collections, byUid, byPlain, pageIdx };
  }

  async function load(force){
    if(cache && !force) return cache;
    if(loading && !force) return loading;
    /* built in a local and handed over at the end: a rescan or a settings change
       can clear the cache while this one is still reading */
    const run = (async () => {
      const a = await appItems();
      const h = await diskItems(force);
      const c = index([...a.items, ...h.items], [...a.pages, ...h.pages]);
      /* v4: frames kept for tasks and videos (taskframes.js). They answer to the
         Library uid they were copied from, so a page or shot finds them on the
         phone, which has no Library. They are not Library items: they never show
         in the Library's own grids, and the Library's copy wins on the laptop. */
      for(const it of await keptItems()){
        if(!c.byUid.has(it.uid)) c.byUid.set(it.uid, it);
        const plain = it.uid.includes('|') ? it.uid.slice(it.uid.indexOf('|') + 1) : '';
        if(plain && !c.byPlain.has(plain)) c.byPlain.set(plain, it);
      }
      c.roots = h.roots || [];
      c.errors = h.errors || [];
      c.fallback = h.fallback || [];
      cache = c;
      if(loading === run) loading = null;
      return c;
    })();
    loading = run;
    return loading;
  }
  function invalidate(){ cache = null; }

  /* a frame by its id, or by its path inside the library when the library moved */
  function find(lib, uid){
    if(!lib || !uid) return null;
    const hit = lib.byUid.get(uid);
    if(hit) return hit;
    const plain = uid.includes('|') ? uid.slice(uid.indexOf('|') + 1) : uid;
    return lib.byPlain.get(plain) || null;
  }

  const title = it => it ? (it.label || it.caption || it.name) : '';
  const pageLabel = p => p ? (p.heading || p.title || titleCase(p.page)) : '';

  /* ------------------------------------------------------------ files */
  const urls = new Map();
  const posters = new Map();
  async function url(it){
    if(!it) return null;
    if(it.src === 'h') return it.url;
    if(urls.has(it.src + ':' + it.id)) return urls.get(it.src + ':' + it.id);
    let blob = null;
    if(it.src === 'tf'){ const r = await keptRecord(it.uid); blob = r && r.blob || null; }
    else try { blob = await Store.get('lib-blob', it.id); } catch(e){ blob = null; }
    if(!blob) return null;
    const u = URL.createObjectURL(blob);
    urls.set(it.src + ':' + it.id, u);
    return u;
  }
  async function posterUrl(it){
    if(!it || it.src === 'h') return null;
    const pk = it.src + ':' + it.id;
    if(posters.has(pk)) return posters.get(pk);
    let blob = null;
    if(it.src === 'tf'){ const r = await keptRecord(it.uid); blob = r && r.poster || null; }
    else try { blob = await Store.get('lib-poster', it.id); } catch(e){ blob = null; }
    const u = blob ? URL.createObjectURL(blob) : null;
    posters.set(pk, u);
    return u;
  }
  async function blobOf(it){
    if(!it) return null;
    if(it.src === 'db'){ try { return await Store.get('lib-blob', it.id); } catch(e){ return null; } }
    if(it.src === 'tf'){ const r = await keptRecord(it.uid); return r && r.blob || null; }
    try { const r = await fetch(it.url); return r.ok ? await r.blob() : null; } catch(e){ return null; }
  }

  /* a still from the first second of a clip, for grids and pickers */
  function videoPoster(blob){
    return new Promise(resolve => {
      const v = document.createElement('video');
      const u = URL.createObjectURL(blob);
      let done = false;
      const finish = out => { if(done) return; done = true; URL.revokeObjectURL(u); resolve(out); };
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = u;
      v.addEventListener('loadeddata', () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); } catch(e){ finish(null); } });
      v.addEventListener('seeked', () => {
        try {
          const w = Math.min(480, v.videoWidth || 480);
          const h = Math.round(w * (v.videoHeight || 270) / (v.videoWidth || 480));
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(v, 0, 0, w, h);
          c.toBlob(b => finish({ blob:b, dur:v.duration || 0, w:v.videoWidth, h:v.videoHeight }), 'image/jpeg', 0.82);
        } catch(e){ finish(null); }
      });
      v.addEventListener('error', () => finish(null));
      setTimeout(() => finish(null), 8000);
    });
  }

  /* Add files to the app's library. `library` names the collection ("My
     library", "Vlog looks"); each batch is a page, like a grabbed page. */
  async function addFiles(files, library, page, onProgress){
    const lib = String(library || '').trim() || 'My library';
    const d = new Date();
    const pg = String(page || '').trim() ||
      'Added ' + d.toLocaleDateString(undefined, { month:'short', day:'numeric' }) + ' ' +
      d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
    const added = [], refused = [];
    let i = 0;
    for(const f of files){
      i++;
      const kind = kindOf(f.name, f.type);
      if(!kind){ refused.push(f.name); continue; }
      const id = newId();
      const rec = { id, kind, name:f.name || (kind + '-' + i), label:'', caption:'', link:f.link || '',
                    library:lib, page:pg, bytes:f.size || 0, mime:f.type || '', createdAt:Date.now() + i };
      if(kind === 'video'){
        const p = await videoPoster(f);
        if(p && p.blob){ await Store.put('lib-poster', p.blob, id); rec.dur = p.dur; rec.w = p.w; rec.h = p.h; }
      }
      await Store.put('lib-blob', f, id);
      await Store.put('lib-items', rec);
      added.push(uidOf(rec));
      if(onProgress) onProgress(i, files.length);
    }
    invalidate();
    if(global.Data && Data.invalidate) Data.invalidate();
    return { added, refused };
  }

  /* a direct link to a GIF, a clip or a picture, fetched outside the page */
  async function addFromLink(link, library){
    const u = String(link || '').trim();
    if(!/^https?:\/\//i.test(u)) throw new Error('That is not a link');
    let blob = null, type = '';
    const http = global.Capacitor && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp;
    if(http){
      const r = await http.request({ url:u, method:'GET', responseType:'blob', readTimeout:60000, connectTimeout:20000 });
      type = (r.headers && (r.headers['content-type'] || r.headers['Content-Type'])) || '';
      const bin = atob(String(r.data || ''));
      const bytes = new Uint8Array(bin.length);
      for(let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
      blob = new Blob([bytes], { type:type.split(';')[0] });
    } else {
      const r = await fetch(u);
      if(!r.ok) throw new Error('The link answered ' + r.status);
      blob = await r.blob(); type = blob.type;
    }
    let name = decodeURIComponent((u.split('?')[0].split('/').pop() || 'download'));
    if(!kindOf(name)){
      const ext = { 'image/gif':'.gif', 'video/mp4':'.mp4', 'video/webm':'.webm', 'image/jpeg':'.jpg',
                    'image/png':'.png', 'image/webp':'.webp' }[(type || '').split(';')[0]];
      if(!ext) throw new Error('That link is a page, not a GIF, clip or picture');
      name += ext;
    }
    const file = new File([blob], name, { type:(type || '').split(';')[0] });
    file.link = u;
    return addFiles([file], library, null);
  }

  async function update(uid, patch){
    if(!uid.startsWith('db:')) return false;
    const id = uid.slice(3);
    const rec = await Store.get('lib-items', id);
    if(!rec) return false;
    await Store.put('lib-items', { ...rec, ...patch });
    invalidate();
    return true;
  }

  /* Delete: the app's own frames go; frames in folders are moved into
     Shot Library/_Deleted (keeping their folders), so nothing is lost by accident. */
  async function remove(uids){
    const lib = await load();
    let n = 0;
    const onDisk = [];
    for(const u of uids){
      const it = find(lib, u);
      if(!it) continue;
      if(it.src === 'db'){
        await Store.del('lib-items', it.id);
        await Store.del('lib-blob', it.id);
        try { await Store.del('lib-poster', it.id); } catch(e){}
        if(urls.has(it.id)){ URL.revokeObjectURL(urls.get(it.id)); urls.delete(it.id); }
        n++;
      } else onDisk.push({ root:it.root, path:it.path });
    }
    if(onDisk.length && disk()) n += await disk().trash(onDisk);
    // take them off every board too
    const boards = await allBoards();
    for(const b of boards){
      const keep = b.items.filter(x => !uids.includes(x));
      if(keep.length !== b.items.length) await saveBoard({ ...b, items:keep });
    }
    // and out of every starred group (the copies leave the phone with them)
    await unstar(null, uids);
    invalidate();
    diskCache = null;
    return n;
  }

  /* Laptop → phone: copy frames from folders on disk (grabbed pages, Shot
     Library) into the app's own library, so a backup or a "Library &
     Templates" file carries them to the phone. Title, bigger-GIF link,
     original source and tags come along; boards are pointed at the copies.
     A frame copied before (rec.from) is not copied twice. uids: which disk
     frames (all of them when empty). */
  async function bringIn(uids, onProgress){
    const lib = await load(true);
    const want = (uids && uids.length) ? new Set(uids) : null;
    const disk = lib.items.filter(it => it.src === 'h' && (!want || want.has(it.uid)));
    const done = new Map();
    try { (await Store.all('lib-items')).values.forEach(r => { if(r.from) done.set(r.from, uidOf(r)); }); } catch(e){}
    const swap = new Map();
    let n = 0, skipped = 0, failed = 0, i = 0;
    for(const it of disk){
      i++;
      if(done.has(it.uid)){ swap.set(it.uid, done.get(it.uid)); skipped++; continue; }
      const blob = await blobOf(it);
      if(!blob){ failed++; continue; }
      const p = lib.pageIdx.get(it.page);
      const id = newId();
      const rec = { id, kind:it.kind, name:it.name, label:it.label || '', caption:it.caption || '', link:it.link || '',
                    big:it.big || '', source:it.source || '', tags:it.tags || [], from:it.uid,
                    library:(p && p.collection) || 'Grabbed', page:(p && pageLabel(p)) || 'Grabbed',
                    bytes:blob.size || it.bytes || 0, mime:blob.type || '', createdAt:Date.now() + i };
      if(it.kind === 'video'){
        const pv = await videoPoster(blob);
        if(pv && pv.blob){ await Store.put('lib-poster', pv.blob, id); rec.dur = pv.dur; rec.w = pv.w; rec.h = pv.h; }
      }
      await Store.put('lib-blob', blob, id);
      await Store.put('lib-items', rec);
      swap.set(it.uid, uidOf(rec));
      n++;
      if(onProgress) onProgress(i, disk.length);
    }
    /* boards that held the disk frames now hold the copies too */
    for(const b of await allBoards()){
      const items = b.items.map(x => swap.get(x) || x);
      if(items.some((x, k) => x !== b.items[k])) await saveBoard({ ...b, items:[...new Set(items)] });
    }
    invalidate();
    if(global.Data && Data.invalidate) Data.invalidate();
    return { copied:n, already:skipped, failed, total:disk.length };
  }

  /* move pages (batches) of the app's frames into another library */
  async function moveToLibrary(pageUids, to){
    const name = String(to || '').trim();
    if(!name) return 0;
    let n = 0;
    const { values } = await Store.all('lib-items');
    for(const r of values){
      const pu = 'db|' + (r.library || 'My library') + '|' + (r.page || 'Added');
      if(pageUids.includes(pu)){ await Store.put('lib-items', { ...r, library:name }); n++; }
    }
    invalidate();
    return n;
  }

  /* ------------------------------------------------------------ boards */
  async function allBoards(){
    try { return (await Store.all('lib-boards')).values.map(b => ({ group:'Other', items:[], ...b })); }
    catch(e){ return []; }
  }
  async function saveBoard(b){
    const rec = { id:b.id || ('bd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)),
                  name:String(b.name || '').trim() || 'Board',
                  group:(String(b.group || '').trim() || 'Other').slice(0, 30),
                  items:[...new Set(b.items || [])], created:b.created || Date.now() };
    await Store.put('lib-boards', rec);
    return rec;
  }
  async function deleteBoard(id){ await Store.del('lib-boards', id); }

  /* ------------------------------------------------------------ starred groups
     The everyday frames, picked on the laptop, kept on every device. A group
     is { id, name, items:[uid], created }; the 'star-groups' store syncs (the
     boards don't), and taskframes.js copies every starred frame across and
     never sweeps it. Starring happens on the laptop; the phone reads. */
  async function allStars(){
    try { return (await Store.all('star-groups')).values.map(g => ({ items:[], ...g }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))); }
    catch(e){ return []; }
  }
  async function saveStar(g){
    const rec = { id:g.id || ('sg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)),
                  name:(String(g.name || '').trim() || 'Starred').slice(0, 40),
                  items:[...new Set(g.items || [])], created:g.created || Date.now() };
    await Store.put('star-groups', rec);
    if(global.TaskFrames) TaskFrames.soon(1500);
    return rec;
  }
  async function deleteStar(id){
    await Store.del('star-groups', id);
    if(global.TaskFrames) TaskFrames.soon(1500);
  }
  /* add frames to a group; returns how many were new to it */
  async function starInto(id, uids){
    const g = (await allStars()).find(x => x.id === id);
    if(!g) return 0;
    const before = g.items.length;
    g.items = [...new Set([...g.items, ...uids])];
    await saveStar(g);
    return g.items.length - before;
  }
  /* take frames out of one group, or (id null) out of every group */
  async function unstar(id, uids){
    const drop = new Set(uids);
    let n = 0;
    for(const g of await allStars()){
      if(id && g.id !== id) continue;
      const keep = g.items.filter(u => !drop.has(u));
      if(keep.length !== g.items.length){ n += g.items.length - keep.length; await saveStar({ ...g, items:keep }); }
    }
    return n;
  }
  async function starredSet(){ return new Set((await allStars()).flatMap(g => g.items)); }
  async function addToBoard(id, uids){
    const b = (await allBoards()).find(x => x.id === id);
    if(!b) return 0;
    const before = b.items.length;
    b.items = [...new Set([...b.items, ...uids])];
    await saveBoard(b);
    return b.items.length - before;
  }

  /* Shotline's boards, from Shot Library's _boards.json (laptop) */
  async function importShotline(){
    const d = disk();
    if(!d) return { boards:0, templates:[] };
    const r = await d.shotline();
    const mine = await allBoards();
    let n = 0;
    for(const b of (r.boards || [])){
      if(mine.some(x => x.id === b.id)) continue;
      await saveBoard({ id:b.id, name:b.name, group:b.group, items:b.items || [], created:b.created });
      n++;
    }
    return { boards:n, templates:r.templates || [] };
  }

  /* ------------------------------------------------------------ the Deck's filter */
  /* views-clips.js search: every word typed must be found somewhere */
  function search(lib, it, q){
    if(!q) return true;
    const p = lib.pageIdx.get(it.page);
    const hay = [it.name, it.label, it.caption, (it.tags || []).join(' '), KIND_LABEL[it.kind], it.kind,
                 p && pageLabel(p), p && p.collection, p && p.page].join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
  }

  async function deck(opts){
    const o = opts || {};
    const lib = await load();
    const s = await settings();
    const hidden = new Set(s.hidden || []);
    let board = null, star = null;
    const src = o.src || 'all';
    if(src.startsWith('board:')){
      board = (await allBoards()).find(b => b.id === src.slice(6));
    }
    if(src.startsWith('star:')){
      star = (await allStars()).find(g => g.id === src.slice(5));
    }
    let list;
    if(src === 'unused'){
      /* on no board, in no starred group, and in no template, task or video */
      const used = new Set();
      (await allBoards()).forEach(b => b.items.forEach(u => used.add(u)));
      (await allStars()).forEach(g => g.items.forEach(u => used.add(u)));
      if(global.TaskFrames) for(const st of ['tasks', 'videos', 'clips', 'vlogs', 'seq-template', 'shot-templates']){
        try { (await Store.all(st)).values.forEach(v => TaskFrames.collect(v, used)); } catch(e){}
      }
      const isUsed = it => used.has(it.uid) || (it.from && used.has(it.from));
      list = lib.items.filter(it => !hidden.has(it.page) && !isUsed(it));
    } else if(star){
      list = star.items.map(u => find(lib, u)).filter(Boolean);
    } else if(board){
      list = board.items.map(u => find(lib, u)).filter(Boolean);
    } else {
      list = lib.items.filter(it => !hidden.has(it.page));
      if(src.startsWith('col:')) list = list.filter(it => (lib.pageIdx.get(it.page) || {}).colKey === src.slice(4));
      if(src.startsWith('page:')) list = list.filter(it => it.page === src.slice(5));
    }
    if(o.kind && o.kind !== 'all') list = list.filter(it => it.kind === o.kind);
    if(o.q) list = list.filter(it => search(lib, it, o.q));
    /* v4: sorting a big library */
    const by = {
      oldest: (a, b) => (a.createdAt || 0) - (b.createdAt || 0) || String(a.name).localeCompare(String(b.name)),
      name:   (a, b) => title(a).localeCompare(title(b), undefined, { numeric:true, sensitivity:'base' }),
      size:   (a, b) => (b.bytes || 0) - (a.bytes || 0),
      kind:   (a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || title(a).localeCompare(title(b)),
      newest: (a, b) => (b.createdAt || 0) - (a.createdAt || 0) || String(a.name).localeCompare(String(b.name))
    }[o.sort || ''];
    if(by) list = list.slice().sort(by);
    return { lib, list, board, star };
  }

  /* ------------------------------------------------------------ copies (v4)
     A folder can keep a copy somewhere else — the Shot Library on the NAS with
     a copy on this computer. New and changed files are copied a little after
     the app starts, after a grab, and from "Copy now". When the folder can't be
     reached the Library reads the copy instead (electron/library.js scanAll).
     Settings stay on this computer: each computer chooses its own copies. */
  async function homeRoot(){
    const d = disk();
    try { return d && d.home ? (await d.home()).path : ''; } catch(e){ return ''; }
  }
  let copyRun = null;
  async function copyNow(only){
    const d = disk();
    if(!d || typeof d.mirror !== 'function') return null;
    if(copyRun) return copyRun;
    copyRun = (async () => {
      const s = await settings();
      const pairs = Object.entries(s.mirrors || {}).filter(([from, to]) => from && to && (!only || from === only));
      if(!pairs.length) return [];
      const r = await d.mirror(pairs);
      if(!r || !r.ok) return [];
      const copied = { ...((await settings()).copied || {}) };
      for(const x of r.results || []){
        const was = copied[x.from] || {};
        copied[x.from] = x.skipped || x.error
          ? { ...was, tried:Date.now(), problem:x.error || 'The folder couldn’t be reached' }
          : { at:Date.now(), tried:Date.now(), copied:x.copied || 0, same:x.same || 0, failed:x.failed || 0, bytes:x.bytes || 0, problem:'' };
      }
      await setSettings({ copied });
      return r.results || [];
    })();
    try { return await copyRun; } finally { copyRun = null; }
  }
  async function setCopy(root, to){
    const s = await settings();
    const mirrors = { ...(s.mirrors || {}) };
    const copied = { ...(s.copied || {}) };
    if(to) mirrors[root] = to; else { delete mirrors[root]; delete copied[root]; }
    await setSettings({ mirrors, copied });
    diskCache = null; cache = null;
  }
  /* the copy can't be the folder itself, inside it, around it, or another folder the Library reads */
  const norm = p => String(p || '').replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase();
  async function copyProblem(root, to){
    const a = norm(root), b = norm(to);
    if(!b) return 'Choose a folder';
    if(a === b || b.startsWith(a + '/') || a.startsWith(b + '/')) return 'The copy has to be outside the folder it copies';
    const s = await settings();
    const others = [await homeRoot(), ...(s.roots || [])].filter(r => norm(r) !== a).map(norm);
    if(others.some(o => o && (o === b || b.startsWith(o + '/') || o.startsWith(b + '/')))) return 'That folder is already in the Library — choose an empty or separate folder';
    return '';
  }
  /* the iPad: is nastime's Shot Library there? (remembered, so Content shows
     Library and Templates at once next time; checked again each start) */
  if(webOnly()){
    libListeners.add(() => { try { if(global.App && App.refreshTab) App.refreshTab(); } catch(e){} });
    setTimeout(() => { probeRemote().catch(() => {}); }, 1200);
  }
  if(disk() && typeof disk().mirror === 'function'){
    setTimeout(() => { copyNow().catch(() => {}); }, 20000);
    if(typeof disk().onGrab === 'function') disk().onGrab('done', () => setTimeout(() => { copyNow().catch(() => {}); }, 3000));
  }

  /* ------------------------------------------------------------ "＋ adds to…" */
  async function target(){ return (await settings()).target || null; }
  async function setTarget(t){ await setSettings({ target:t || null }); }

  global.MediaLib = {
    BOARD_GROUPS, KIND_LABEL, KINDS, MAX_GIF_BYTES,
    kindOf, titleCase, title, pageLabel,
    settings, setSettings, load, invalidate, find, url, posterUrl, blobOf,
    addFiles, addFromLink, update, remove, moveToLibrary, bringIn,
    allBoards, saveBoard, deleteBoard, addToBoard, importShotline,
    allStars, saveStar, deleteStar, starInto, unstar, starredSet,
    deck, search, target, setTarget, disk, videoPoster,
    hasLibrary, remote: () => remoteOn && !disk(), probeRemote,
    onLibraryChange: f => { if(typeof f === 'function') libListeners.add(f); },
    copyNow, setCopy, copyProblem,
    rescan: () => { diskCache = null; cache = null; return load(true); }
  };
})(window);
