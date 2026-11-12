/* Task frames — the GIFs, clips and stills a task or a video uses, carried to
   the phone without the Library.

   The Library lives on the laptop. A task's shot page, a step, or a video made
   from a template only points at a Library frame by its uid ("db:li_…" for a
   frame added to the app, "h:<root>|<path>" for one in a folder on disk). The
   phone has neither, so on its own every picture spot there would be blank.

   So, on any device that has the Library (the laptop):
     keep()   finds every frame a live task or video points at and copies the
              file into the 'task-frames' store, keyed by that same uid. Sync
              and "Export everything" carry that store like any other, and
              MediaLib.find answers the uid from it (medialib.js keptItems), so
              the page, the steps and the video draw the same picture.

   And on every device:
     sweep()  deletes kept frames nothing live points at any more:
                - the task was deleted, or its date is more than 21 days ago
                - the video was deleted, or it was published more than 21 days ago
              The Library's own files are never touched: only these copies.

   A frame copied less than a day ago is never swept, so a frame that reaches a
   device a moment before its task does isn't thrown away in between.

   Runs a few seconds after start, after a sync brings anything in, and (on the
   laptop) a few seconds after a task or video is saved. */
(function(global){
  const DAY = 86400000;
  const KEEP_DAYS = 21;                       /* after the task's date */
  const GRACE = DAY;                          /* a fresh copy is never swept */
  const MAX_BYTES = 30 * 1024 * 1024;         /* bigger than this doesn't travel (sync sends one record per request at most) */
  const STORE = 'task-frames';
  const UID = /^(db:li_[A-Za-z0-9_]+|h:[^|]+\|.+)$/;

  const now = () => (global.TaskFrames && global.TaskFrames._now) ? global.TaskFrames._now() : Date.now();   /* tests move the clock */
  const startOfToday = () => { const d = new Date(now()); d.setHours(0, 0, 0, 0); return d.getTime(); };

  /* every Library uid anywhere inside a task or video: page spots, extra pages,
     steps, a video's page. Strings only; nothing else looks like a uid. */
  function collect(obj, out, depth){
    out = out || new Set();
    depth = depth || 0;
    if(obj == null || depth > 12) return out;
    if(typeof obj === 'string'){ if(UID.test(obj)) out.add(obj); return out; }
    if(Array.isArray(obj)){ obj.forEach(v => collect(v, out, depth + 1)); return out; }
    if(typeof obj === 'object'){
      if(typeof Blob !== 'undefined' && obj instanceof Blob) return out;
      for(const k in obj) collect(obj[k], out, depth + 1);
    }
    return out;
  }

  async function all(store){
    try { return (await Store.all(store)).values || []; } catch(e){ return []; }
  }

  /* is a task still in its window? No day = no date = kept while it exists. */
  async function taskLive(t, cutoff){
    if(!t || t.day == null) return true;
    let ts = null;
    try { ts = await Data.dayToDate(t.day); } catch(e){ ts = null; }
    return ts == null || ts >= cutoff;
  }
  function videoLive(v, cutoff){
    if(!v) return false;
    if(v.stage !== 'published') return true;
    return !v.publishedAt || v.publishedAt >= cutoff;
  }

  /* uid → true for everything a live task or video points at, and every
     starred frame (those never age out) */
  async function wanted(){
    const cutoff = startOfToday() - KEEP_DAYS * DAY;
    const want = new Set();
    for(const g of await all('star-groups')) (g.items || []).forEach(u => { if(UID.test(u)) want.add(u); });
    /* a template's frames are ready on the phone before it's ever used —
       "Morning routine" at 6 am doesn't wait for the laptop to be on */
    for(const t of await all('shot-templates')) collect(t, want);
    for(const t of await all('tasks')) if(await taskLive(t, cutoff)) collect(t, want);
    for(const v of await all('videos')){
      /* a video published before v4 stamped the date: stamp it now, so the
         21 days start counting instead of never */
      if(v.stage === 'published' && !v.publishedAt){
        v.publishedAt = now();
        try { await Store.put('videos', v); } catch(e){}
      }
      if(videoLive(v, cutoff)) collect(v, want);
    }
    return want;
  }

  /* copy what is wanted and not kept yet — only where the Library is */
  async function keep(want){
    if(!global.MediaLib) return { copied:0, tooBig:0, missing:0 };
    want = want || await wanted();
    const have = new Set((await all(STORE)).map(r => r.uid));
    const need = [...want].filter(u => !have.has(u));
    if(!need.length) return { copied:0, tooBig:0, missing:0 };
    let lib;
    try { lib = await MediaLib.load(); } catch(e){ return { copied:0, tooBig:0, missing:need.length }; }
    let copied = 0, tooBig = 0, missing = 0;
    for(const uid of need){
      const it = MediaLib.find(lib, uid);
      if(!it || it.src === 'tf'){ missing++; continue; }      /* not in this device's Library */
      let blob = null;
      try { blob = await MediaLib.blobOf(it); } catch(e){ blob = null; }
      if(!blob){ missing++; continue; }
      if(blob.size > MAX_BYTES){ tooBig++; continue; }
      const rec = { uid, kind:it.kind || MediaLib.kindOf(it.name, blob.type) || 'image', name:it.name || 'frame',
                    label:it.label || '', caption:it.caption || '', mime:blob.type || it.mime || '',
                    bytes:blob.size, blob, keptAt:now() };
      if(it.kind === 'video'){
        try {
          if(it.src === 'db'){ const p = await Store.get('lib-poster', it.id); if(p) rec.poster = p; }
          else if(MediaLib.videoPoster){ const pv = await MediaLib.videoPoster(blob); if(pv && pv.blob) rec.poster = pv.blob; }
        } catch(e){}
      }
      await Store.put(STORE, rec);
      copied++;
    }
    if(copied) MediaLib.invalidate();
    return { copied, tooBig, missing };
  }

  /* delete copies nothing live points at */
  async function sweep(want){
    want = want || await wanted();
    let removed = 0;
    for(const r of await all(STORE)){
      if(!r || !r.uid || want.has(r.uid)) continue;
      if(r.keptAt && now() - r.keptAt < GRACE) continue;
      await Store.del(STORE, r.uid);
      removed++;
    }
    if(removed && global.MediaLib) MediaLib.invalidate();
    return removed;
  }

  let running = null, timer = null, last = null;
  async function run(){
    if(running) return running;
    running = (async () => {
      try {
        const want = await wanted();
        const k = await keep(want);
        const removed = await sweep(want);
        last = { at:now(), ...k, removed, kept:(await all(STORE)).length };
        return last;
      } catch(e){
        console.warn('task frames', e);
        return (last = { at:now(), error:String(e && e.message || e) });
      }
    })();
    try { return await running; } finally { running = null; }
  }
  function soon(ms){
    clearTimeout(timer);
    timer = setTimeout(() => { run(); }, ms == null ? 4000 : ms);
  }

  /* a saved task or video may point at new frames (laptop) */
  if(global.Store && Store.put && !Store.put._tf){
    const put = Store.put;
    const wrapped = async function(store, value, key){
      const r = await put.call(Store, store, value, key);
      if(store === 'tasks' || store === 'videos' || store === 'star-groups' || store === 'shot-templates') soon();
      return r;
    };
    wrapped._tf = true;
    Store.put = wrapped;
  }

  /* what a frame's size and count look like, for Settings */
  async function stats(){
    const recs = await all(STORE);
    return { count:recs.length, bytes:recs.reduce((n, r) => n + (r.bytes || 0), 0), last };
  }

  /* a row of a page's frames with their lines, for the video sheet: GIFs and
     stills as pictures, clips playing muted on a loop */
  async function strip(host, page){
    if(!host || !page || !global.MediaLib) return;
    const esc = s => U.esc(s);   /* shared: util.js */
    const slots = (page.slots || []).filter(sl => sl.item);
    if(!slots.length){ host.innerHTML = ''; return; }
    let lib = null;
    try { lib = await MediaLib.load(); } catch(e){ lib = null; }
    const cells = await Promise.all(slots.map(async (sl, i) => {
      const it = lib && MediaLib.find(lib, sl.item);
      const u = it ? await MediaLib.url(it).catch(() => null) : null;
      const pic = !u ? `<span class="tf-miss">not here yet</span>`
        : it.kind === 'video' ? `<video src="${esc(u)}" muted loop autoplay playsinline preload="metadata"></video>`
        : `<img src="${esc(u)}" alt="" loading="lazy">`;
      return `<figure class="tf-cell"><div class="tf-pic">${pic}</div><figcaption><b>${i + 1}</b> ${esc(sl.text || '')}</figcaption></figure>`;
    }));
    if(!host.isConnected) return;
    host.innerHTML = cells.join('');
  }

  global.TaskFrames = { collect, wanted, keep, sweep, run, soon, stats, strip, KEEP_DAYS, MAX_BYTES, STORE, UID };

  if(typeof document !== 'undefined' && !global.CS_NO_AUTORUN){
    setTimeout(() => run(), 6000);
    if(global.Sync && Sync.onChange){
      /* after every sync: a frame or a task may have arrived */
      let lastGot = 0;
      Sync.onChange(async () => {
        try {
          const s = await Sync.status();
          if(s && s.at && s.at !== lastGot){ lastGot = s.at; if(s.got) soon(1500); }
        } catch(e){}
      });
    }
  }
})(window);
