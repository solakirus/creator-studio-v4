/* v4: one kind of video. A series' episode is a clip in that series.

   Series used to hold "videos" (their own store, page and five stage buttons)
   while one-offs were clips with Plan · Shoot · Edit · Post. Now every series
   video is a clip with seriesId, opened on the clip page; the Series section and
   its front page stay as they were, listing the clips that belong to each run.

     ClipFlow.migrate()    each record in `videos` becomes a clip once, as
                           'cv_' + its id — the same id on every device, so a
                           phone and a laptop converting the same video land on
                           one clip. The video keeps `movedTo` and is left alone
                           after that. Its shoot task gets the clip's id. Runs at
                           start, after a sync, and when a video is saved (an
                           older device, or a plan import, can still make one).
     ClipFlow.parts(seriesId)   the clips in a series, in their order
     ClipFlow.stageFrom(clip, shootTask)   how far along the work shows it is:
                           on a day → Planned; every shot ticked (on the shoot
                           task or the clip) → Shot; a version cut → Editing;
                           every version posted → Published
     ClipFlow.auto(id)     moves a clip on to that, never back. Runs by itself
                           when a clip or its shoot task is saved (but not while
                           the clip page has that clip open — it does its own). */
(function(global){
  const PREFIX = 'cv_';
  const idFor = vid => PREFIX + vid;

  function fromVideo(v){
    const tags = (v.tags || []).map(t => '#' + String(t).replace(/^#/, '')).join(' ');
    const c = {
      id: idFor(v.id), title: v.title || 'Untitled', seriesId: v.seriesId || null,
      channel: v.channel || '', plat: v.plat || 'youtube', order: +v.order || 0,
      stage: v.stage || 'idea', createdAt: v.createdAt || Date.now(),
      fromVideo: v.id, shootTaskId: v.taskId || null,
      plan: { tab: null, hook: v.hook || '', hookT: v.hookT || 0, notes: v.notes || '', tags,
        beats: Array.isArray(v.beats) ? v.beats.slice() : [], beatGuide: Array.isArray(v.beatGuide) ? v.beatGuide.slice() : [],
        structure: v.structure || null, versions: [], swipeIds: [] }
    };
    if(v.publishedAt) c.postedAt = v.publishedAt;
    ['page', 'subs', 'pageFrom', 'morePages', 'hideDone', 'pageOff', 'shotList', 'shots', 'shotsSig'].forEach(k => { if(v[k] !== undefined) c[k] = v[k]; });
    if(!Array.isArray(c.shots)) c.shots = [];
    return c;
  }

  let migrating = null;
  async function migrate(){
    if(migrating) return migrating;
    migrating = (async () => {
      let vids = [];
      try { vids = (await Store.all('videos')).values || []; } catch(e){ return 0; }
      let n = 0;
      for(const v of vids){
        if(!v || !v.id || v.movedTo) continue;
        const id = idFor(v.id);
        let have = null;
        try { have = await Store.get('clips', id); } catch(e){}
        if(!have){
          await Data.saveClip(fromVideo(v));
          n++;
        }
        if(v.taskId){
          try { const t = await Store.get('tasks', v.taskId); if(t && !t.clipId){ t.clipId = id; await Store.put('tasks', t); } } catch(e){}
        }
        await Store.put('videos', { ...v, movedTo: id });
      }
      if(n){ Data.invalidate && Data.invalidate('clips'); Data.invalidate && Data.invalidate('tasks'); }
      return n;
    })();
    try { return await migrating; } finally { migrating = null; }
  }

  /* the clips in a series, numbered ones first in their order, then newest first */
  async function parts(seriesId){
    if(!seriesId) return [];
    const all = (await Data.clips()).filter(c => c.seriesId === seriesId);
    return all.sort((a, b) => ((+a.order || 1e9) - (+b.order || 1e9)) || ((a.createdAt || 0) - (b.createdAt || 0)));
  }

  /* ---- stages that move themselves ---- */
  const shotSteps = x => ((x && x.subs) || []).filter(s => s && s.shot != null);
  const allShot = x => { const s = shotSteps(x); return s.length > 0 && s.every(y => y.done); };
  function stageFrom(c, task){
    let st = 'idea';
    if(task && task.day != null) st = 'planned';
    if((task && (task.view === 'done' || allShot(task))) || allShot(c)) st = 'shot';
    const vs = (c.plan && c.plan.versions) || [];
    if(vs.some(v => v.state === 'edited' || v.state === 'posted')) st = 'editing';
    if(vs.length && vs.every(v => v.state === 'posted')) st = 'published';
    return st;
  }
  const current = c => c.stage || (Lifecycle.FROM_CLIP[c.state]) || 'idea';
  /* the further of where it is and where the work says it is */
  async function settle(c){
    let task = null;
    if(c.shootTaskId){ try { task = await Store.get('tasks', c.shootTaskId); } catch(e){} }
    const ev = stageFrom(c, task);
    return Lifecycle.ahead(current(c), ev) ? ev : null;
  }
  async function auto(id){
    let c = null;
    try { c = await Store.get('clips', id); } catch(e){}
    if(!c) return null;
    const to = await settle(c);
    if(!to) return null;
    await Data.saveClip({ ...c, stage: to });
    Data.invalidate && Data.invalidate('clips');
    return to;
  }

  /* when a clip or its shoot task is saved, look again (not the one the clip
     page has open: it settles its own copy, or the two would write over each other) */
  const pending = new Map();
  function soon(id){
    if(!id) return;
    if(typeof document !== 'undefined' && document.querySelector(`.screen[data-clip-id="${String(id).replace(/"/g, '')}"]`)) return;
    clearTimeout(pending.get(id));
    pending.set(id, setTimeout(() => { pending.delete(id); auto(id).catch(() => {}); }, 600));
  }
  let vTimer = null;
  if(global.Store && Store.put && !Store.put._cf){
    const put = Store.put;
    const wrapped = async function(store, value, key){
      const r = await put.call(Store, store, value, key);
      try {
        if(store === 'tasks' && value && value.clipId) soon(value.clipId);
        else if(store === 'clips' && value && value.id) soon(value.id);
        else if(store === 'videos' && value && !value.movedTo){ clearTimeout(vTimer); vTimer = setTimeout(() => migrate().catch(() => {}), 800); }
      } catch(e){}
      return r;
    };
    wrapped._cf = true;
    Object.keys(put).forEach(k => { if(!(k in wrapped)) wrapped[k] = put[k]; });
    Store.put = wrapped;
  }

  const api = { PREFIX, idFor, fromVideo, migrate, parts, stageFrom, settle, auto };
  global.ClipFlow = api;

  if(typeof document !== 'undefined' && !global.CS_NO_AUTORUN){
    setTimeout(() => migrate().catch(() => {}), 1200);
    if(global.Sync && Sync.onChange) Sync.onChange(() => { setTimeout(() => migrate().catch(() => {}), 1500); });
  }
})(window);
