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
                     gifMax:200, keepVideo:false, scanUrl:'', scanMax:200, bigGifs:'link', cookies:'none' };
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
    if(!d) return { items:[], pages:[], roots:[], errors:[] };
    if(diskCache && !force) return diskCache;
    const s = await settings();
    try {
      const r = await d.scan(s.roots || []);
      r.items.forEach(it => { it.src = 'h'; });
      r.pages.forEach(p => { p.src = 'h'; });
      diskCache = r;
    } catch(e){
      console.warn('Library folders could not be read', e);
      diskCache = { items:[], pages:[], roots:[], errors:[String(e && e.message || e)] };
    }
    return diskCache;
  }

  /* library.rs reindex: collections from pages, newest page first */
  function index(items, pages){
    const byUid = new Map(items.map(it => [it.uid, it]));
    const byPlain = new Map();
    items.forEach(it => { if(it.path && !byPlain.has(it.path)) byPlain.set(it.path, it); });
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
    loading = (async () => {
      const a = await appItems();
      const h = await diskItems(force);
      cache = index([...a.items, ...h.items], [...a.pages, ...h.pages]);
      cache.roots = h.roots || [];
      cache.errors = h.errors || [];
      loading = null;
      return cache;
    })();
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
    if(urls.has(it.id)) return urls.get(it.id);
    let blob = null;
    try { blob = await Store.get('lib-blob', it.id); } catch(e){ blob = null; }
    if(!blob) return null;
    const u = URL.createObjectURL(blob);
    urls.set(it.id, u);
    return u;
  }
  async function posterUrl(it){
    if(!it || it.src === 'h') return null;
    if(posters.has(it.id)) return posters.get(it.id);
    let blob = null;
    try { blob = await Store.get('lib-poster', it.id); } catch(e){ blob = null; }
    const u = blob ? URL.createObjectURL(blob) : null;
    posters.set(it.id, u);
    return u;
  }
  async function blobOf(it){
    if(!it) return null;
    if(it.src === 'db'){ try { return await Store.get('lib-blob', it.id); } catch(e){ return null; } }
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
    let board = null;
    const src = o.src || 'all';
    if(src.startsWith('board:')){
      board = (await allBoards()).find(b => b.id === src.slice(6));
    }
    let list;
    if(board){
      list = board.items.map(u => find(lib, u)).filter(Boolean);
    } else {
      list = lib.items.filter(it => !hidden.has(it.page));
      if(src.startsWith('col:')) list = list.filter(it => (lib.pageIdx.get(it.page) || {}).colKey === src.slice(4));
      if(src.startsWith('page:')) list = list.filter(it => it.page === src.slice(5));
    }
    if(o.kind && o.kind !== 'all') list = list.filter(it => it.kind === o.kind);
    if(o.q) list = list.filter(it => search(lib, it, o.q));
    return { lib, list, board };
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
    deck, search, target, setTarget, disk,
    rescan: () => { diskCache = null; cache = null; return load(true); }
  };
})(window);
