/* Creator Studio — the plan pack. (Copied from the laptop Planner kit for
   Creator Studio 3, with one change: shots are named in `text` — the field the
   task and episode screens read — so a planner `name` lands there.)

   One JSON file that carries a plan from the laptop Planner to the phone.

   Two things make it safe where a plain backup restore is not:

   1. Identity travels as `uid`, a string made on the planning side. The phone
      keeps its own numeric task ids underneath, so a pack can never land on top
      of an unrelated task that happens to share a number.

   2. Ownership is split. The planner owns the plan — titles, dates, times,
      steps, shots and their angles, beats. The phone owns progress — every
      `done` tick, a task's view, a clip's state. Bringing in a newer plan
      rewrites the plan and leaves the progress alone, so an angle you already
      shot stays shot.

   Dates travel as YYYY-MM-DD and become program day numbers here, because the
   laptop and the phone need not agree on when the program started.

   preview() reads and reports. apply() writes. Applying the same pack twice
   changes nothing the second time. */
(function(global){

  const FORMAT = 'creator-studio-plan';
  const VERSION = 1;
  const KINDS = ['tasks', 'vlogs', 'clips', 'series', 'refs'];   /* refs: reference stills, v1 extension */

  const rand = () => Math.random().toString(36).slice(2, 6);
  const newUid = p => `pl_${p || 'x'}_${Date.now().toString(36)}${rand()}`;
  const localId = p => `${p}_${Date.now().toString(36)}${rand()}`;

  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;
  const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));

  /* key-sorted, so "did anything change" does not depend on property order */
  function canon(v){
    if(Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if(v && typeof v === 'object'){
      return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort()
        .map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    }
    return JSON.stringify(v === undefined ? null : v);
  }
  const same = (a, b) => canon(a) === canon(b);

  /* ------------------------------------------------------------ format */

  function build(records, removed){
    const out = {
      format: FORMAT, v: VERSION,
      createdAt: new Date().toISOString(),
      source: 'planner',
      records: {}, removed: {}
    };
    KINDS.forEach(k => {
      out.records[k] = clone((records || {})[k]) || [];
      out.removed[k] = clone((removed || {})[k]) || [];
    });
    validate(out);
    return out;
  }

  function parse(text){
    let obj;
    try { obj = typeof text === 'string' ? JSON.parse(text) : text; }
    catch(e){ throw new Error('That file is not valid JSON.'); }
    if(!obj || typeof obj !== 'object') throw new Error('That file is empty.');
    if(obj.format !== FORMAT){
      if(obj.data && obj.version) throw new Error('That is a full backup, not a plan pack. Use Restore for it.');
      throw new Error('That is not a plan pack.');
    }
    if(obj.v !== VERSION) throw new Error(`This plan pack is version ${obj.v}. This app reads version ${VERSION} — update the app.`);
    obj.records = obj.records || {};
    obj.removed = obj.removed || {};
    KINDS.forEach(k => {
      obj.records[k] = Array.isArray(obj.records[k]) ? obj.records[k] : [];
      obj.removed[k] = Array.isArray(obj.removed[k]) ? obj.removed[k] : [];
    });
    validate(obj);
    return obj;
  }

  /* problems that make a pack unusable throw; everything else is a warning */
  function validate(pack){
    KINDS.forEach(k => {
      const seen = new Set();
      pack.records[k].forEach((r, i) => {
        if(!r || typeof r.uid !== 'string' || !r.uid)
          throw new Error(`${k} #${i + 1} has no uid.`);
        if(seen.has(r.uid)) throw new Error(`${k} has the uid ${r.uid} twice.`);
        seen.add(r.uid);
      });
    });
    pack.records.tasks.forEach(t => {
      if(!t.title) throw new Error(`Task ${t.uid} has no title.`);
      if(!ISO.test(String(t.date || ''))) throw new Error(`Task "${t.title}" needs a date as YYYY-MM-DD.`);
    });
  }

  /* ------------------------------------------------------------ helpers */

  const dayOf = date => Data.dateToDay(new Date(date + 'T09:00').getTime());

  const angleDone = a => !!(a && a.done);
  const shotHasWork = s => !!(s && (s.done || (s.angles || []).some(angleDone)));
  const taskHasWork = t => !!(t && (
    t.view === 'done' ||
    (t.subs || []).some(x => x.done) ||
    (t.shots || []).some(shotHasWork)));
  const vlogHasWork = v => !!(v && (v.acts || []).some(a =>
    (a.beats || []).some(b => b.done || (b.shots || []).some(s => s.done))));

  /* A planned angle. The phone keeps `done` and anything else it hung on it. */
  const ANGLE_FIELDS = ['n', 'type', 'framing', 'angle', 'movement', 'cam', 'note'];
  function mergeAngle(old, p){
    const out = old ? { ...old } : { uid:p.uid };
    ANGLE_FIELDS.forEach(k => { if(has(p, k)) out[k] = p[k]; });
    if(!old) out.done = false;
    delete out.orphan;
    return out;
  }

  /* Merge a list of planner-made children into what the phone has, by uid.
     Things the phone made itself (no uid) are never touched. Planner-made
     things that left the plan go — unless work was done on them, in which case
     they stay and are marked orphan so nothing captured disappears. */
  function mergeList(oldList, planList, mergeOne, hasWork){
    const old = oldList || [];
    const byUid = {};
    old.forEach(x => { if(x && x.uid) byUid[x.uid] = x; });
    const planned = (planList || []).map(p => mergeOne(byUid[p.uid], p));
    const inPlan = new Set((planList || []).map(p => p.uid));
    const kept = old.filter(x => !x.uid || !inPlan.has(x.uid))
      .filter(x => !x.uid || hasWork(x))
      .map(x => x.uid ? { ...x, orphan:true } : x);
    return [...planned, ...kept];
  }

  const SHOT_FIELDS = ['action', 'location', 'movement', 'framing', 'note', 'target'];
  /* set per plan() run: turns a planner ref uid into this phone's ref id */
  let refCtx = { idOf: () => undefined, planner: new Set() };

  function mergeTaskShot(old, p){
    const out = old ? { ...old } : { uid:p.uid };
    SHOT_FIELDS.forEach(k => { if(has(p, k)) out[k] = p[k]; });
    if(has(p, 'name')){ out.text = p.name; delete out.name; }
    else if(has(p, 'text')) out.text = p.text;
    if(has(p, 'refUids')){
      /* references you added on the phone stay; the planner's are replaced */
      const mine = ((old && old.refs) || []).filter(id => !refCtx.planner.has(id));
      const theirs = p.refUids.map(refCtx.idOf).filter(id => id !== undefined);
      out.refs = [...new Set([...theirs, ...mine])];
    }
    if(has(p, 'angles') || !old){
      out.angles = mergeList(old && old.angles, p.angles || [], mergeAngle, angleDone);
    }
    delete out.orphan;
    return out;
  }

  /* Beat shots are flat — one tick on the shot itself. */
  function mergeBeatShot(old, p){
    const out = old ? { ...old } : { uid:p.uid, done:false };
    ['text', 'location', 'framing', 'movement', 'note'].forEach(k => { if(has(p, k)) out[k] = p[k]; });
    if(!has(p, 'text') && has(p, 'name')) out.text = p.name;
    delete out.name;
    delete out.orphan;
    return out;
  }

  /* Steps are matched by their words, because that is all a step is. */
  function mergeSubs(oldSubs, planSubs){
    const old = oldSubs || [];
    const pool = old.map(s => ({ s, used:false }));
    const planned = (planSubs || []).map(p => {
      const t = typeof p === 'string' ? p : p.t;
      const hit = pool.find(x => !x.used && x.s.t === t);
      if(hit){ hit.used = true; return { ...hit.s, t }; }
      return { t, done:false };
    });
    const kept = pool.filter(x => !x.used && x.s.done).map(x => x.s);
    return [...planned, ...kept];
  }

  /* ------------------------------------------------------------ the plan */

  /* Work out every change without writing anything. */
  async function plan(pack){
    pack = parse(pack);
    const warnings = [];

    const [tasksArr, clipsArr, seriesArr, vlogsArr, refsArr] = await Promise.all([
      Data.tasks(), Data.clips(), Data.series(),
      Store.all('vlogs').then(r => r.values).catch(() => []),
      Store.all('refs').then(r => r.values).catch(() => [])
    ]);

    const work = {
      tasks: new Map(tasksArr.map(t => [t.id, clone(t)])),
      clips: new Map(clipsArr.map(c => [c.id, clone(c)])),
      series: new Map(seriesArr.map(s => [s.id, clone(s)])),
      vlogs: new Map(vlogsArr.map(v => [v.id, clone(v)])),
      refs: new Map(refsArr.map(x => [x.id, clone(x)]))
    };
    const before = {};
    KINDS.forEach(k => { before[k] = new Map([...work[k]].map(([id, r]) => [id, canon(r)])); });

    const idByUid = {};
    KINDS.forEach(k => {
      idByUid[k] = {};
      work[k].forEach((r, id) => { if(r.uid) idByUid[k][r.uid] = id; });
    });

    const added = { tasks:new Set(), vlogs:new Set(), clips:new Set(), series:new Set(), refs:new Set() };
    /* unique across devices — see U.taskId */
    let nextTaskId = U.taskId();

    /* --- reference stills. The picture travels as a data: URL and is only
       rewritten when its hash changes; a linked one is just its URL. */
    const blobs = [];
    for(const p of pack.records.refs){
      let id = idByUid.refs[p.uid];
      const old = id !== undefined ? work.refs.get(id) : null;
      const rec = old ? { ...old } : { id: localId('rf'), uid:p.uid, scenario:'planner', framing:'', movement:'',
        note:'', kind:'image', createdAt: Date.now() };
      ['note', 'kind', 'framing', 'movement', 'url'].forEach(k => { if(has(p, k)) rec[k] = p[k]; });
      if(p.data && (!old || old.hash !== p.hash)){
        if(!/^data:image\//.test(p.data)) warnings.push(`Reference ${p.uid} is not an image and was skipped.`);
        else { blobs.push([rec.id, p.data]); rec.hash = p.hash || String(p.data.length); delete rec.url; }
      }
      if(!old && !p.data && !p.url){ warnings.push(`Reference ${p.uid} arrived with no picture.`); continue; }
      if(!old){ id = rec.id; idByUid.refs[p.uid] = id; added.refs.add(id); }
      work.refs.set(id, rec);
    }
    refCtx = {
      idOf: u => idByUid.refs[u],
      planner: new Set([...work.refs.values()].filter(x => x.uid).map(x => x.id))
    };

    /* --- series */
    for(const p of pack.records.series){
      let id = idByUid.series[p.uid];
      const old = id !== undefined ? work.series.get(id) : null;
      const rec = old ? { ...old } : { id: localId('s'), uid:p.uid, state:'draft', total:0, nextDrop:null };
      ['title', 'cadence', 'total'].forEach(k => { if(has(p, k)) rec[k] = p[k]; });
      if(!rec.title) rec.title = 'Untitled series';
      if(!old){ id = rec.id; idByUid.series[p.uid] = id; added.series.add(id); }
      work.series.set(id, rec);
    }

    /* --- clips */
    const seriesIdFor = (uid, label) => {
      if(!uid) return undefined;
      const id = idByUid.series[uid];
      if(id === undefined) warnings.push(`${label} points at a series that is not in the pack or on this phone.`);
      return id;
    };
    for(const p of pack.records.clips){
      let id = idByUid.clips[p.uid];
      const old = id !== undefined ? work.clips.get(id) : null;
      const rec = old ? { ...old } : {
        id: localId('c'), uid:p.uid, state:'raw', pct:0, dur:'', createdAt: Date.now()
      };
      ['title', 'plat', 'publishAt'].forEach(k => { if(has(p, k)) rec[k] = p[k]; });
      if(has(p, 'plan')) rec.plan = { ...(rec.plan || {}), ...p.plan };
      if(has(p, 'seriesUid')){
        const sid = seriesIdFor(p.seriesUid, `Clip "${p.title || p.uid}"`);
        if(sid !== undefined) rec.seriesId = sid;
        else if(p.seriesUid === null) rec.seriesId = null;
      }
      if(!rec.title) rec.title = 'Untitled clip';
      if(!rec.plat) rec.plat = 'youtube';
      if(!old){ id = rec.id; idByUid.clips[p.uid] = id; added.clips.add(id); }
      work.clips.set(id, rec);
    }

    /* --- tasks */
    for(const p of pack.records.tasks){
      let id = idByUid.tasks[p.uid];
      const old = id !== undefined ? work.tasks.get(id) : null;
      const rec = old ? { ...old } : {
        id: nextTaskId, uid:p.uid, cad:'One-off', pri:'med', at:null, mins:0,
        prog:'', view:'todo', subs:[], shots:[]
      };
      rec.day = await dayOf(p.date);
      ['title', 'at', 'mins', 'cad', 'pri', 'prog'].forEach(k => { if(has(p, k)) rec[k] = p[k]; });
      if(has(p, 'kind')) rec.kind = p.kind || undefined;
      if(has(p, 'subs')) rec.subs = mergeSubs(old && old.subs, p.subs);
      if(has(p, 'shots')) rec.shots = mergeList(old && old.shots, p.shots, mergeTaskShot, shotHasWork);
      if(has(p, 'clipUid') && p.clipUid){
        const cid = idByUid.clips[p.clipUid];
        if(cid !== undefined) rec.clipId = cid;
        else warnings.push(`Task "${p.title}" points at a clip that is not in the pack or on this phone.`);
      }
      if(!old){ id = nextTaskId; nextTaskId = U.taskId(); idByUid.tasks[p.uid] = id; added.tasks.add(id); }
      work.tasks.set(id, rec);
    }

    /* --- vlogs (episodes) */
    const weekOf = async date => ISO.test(String(date || ''))
      ? Data.weekNumber(new Date(date + 'T09:00').getTime()) : undefined;

    for(const p of pack.records.vlogs){
      let id = idByUid.vlogs[p.uid];
      const old = id !== undefined ? work.vlogs.get(id) : null;
      const rec = old ? { ...old } : {
        id: localId('v'), uid:p.uid, format:'weekly', length:'long', seriesId:null,
        acts:[], createdAt: Date.now()
      };
      if(has(p, 'title')) rec.title = p.title;
      if(!rec.title) rec.title = 'Untitled episode';
      ['premise', 'question'].forEach(k => { if(has(p, k)) rec[k] = p[k]; });
      if(has(p, 'weekOf')) rec.week = await weekOf(p.weekOf);
      if(has(p, 'seriesUid')){
        const sid = seriesIdFor(p.seriesUid, `Episode "${rec.title}"`);
        if(sid !== undefined) rec.seriesId = sid;
      }

      if(has(p, 'acts')){
        rec.acts = [];
        const oldActs = (old && old.acts) || [];
        const oldActByUid = {};
        oldActs.forEach(a => { if(a.uid) oldActByUid[a.uid] = a; });

        for(const pa of p.acts){
          const oa = pa.uid ? oldActByUid[pa.uid] : null;
          const act = oa ? { ...oa } : { id: localId('a'), uid: pa.uid || newUid('a'), day:null, open:false };
          if(has(pa, 'title')) act.title = pa.title;
          const beats = [];
          for(const pb of (pa.beats || [])){
            const ob = (oa && (oa.beats || []).find(b => b.uid && b.uid === pb.uid)) || null;
            const b = ob ? { ...ob } : {
              id: localId('b'), uid: pb.uid, purpose:'', shots:[], day:null, at:null,
              done:false, clipId:null
            };
            ['title', 'fn', 'purpose', 'at', 'mins'].forEach(k => { if(has(pb, k)) b[k] = pb[k]; });
            if(has(pb, 'date')) b.day = pb.date && ISO.test(pb.date) ? await dayOf(pb.date) : null;
            if(has(pb, 'shots')) b.shots = mergeList(ob && ob.shots, pb.shots, mergeBeatShot, s => !!s.done);
            if(has(pb, 'taskUid') && pb.taskUid){
              const tid = idByUid.tasks[pb.taskUid];
              if(tid !== undefined){
                b.taskId = tid;
                const t = work.tasks.get(tid);
                if(t && (t.beatId !== b.id || t.vlogId !== rec.id)){
                  work.tasks.set(tid, { ...t, beatId:b.id, vlogId:rec.id });
                }
              } else warnings.push(`Beat "${pb.title || pb.uid}" points at a task that is not in the pack.`);
            }
            delete b.orphan;
            beats.push(b);
          }
          /* beats that left the plan but already have work done stay */
          const inPlan = new Set((pa.beats || []).map(x => x.uid));
          ((oa && oa.beats) || []).filter(b => b.uid && !inPlan.has(b.uid))
            .filter(b => b.done || (b.shots || []).some(s => s.done))
            .forEach(b => beats.push({ ...b, orphan:true }));
          ((oa && oa.beats) || []).filter(b => !b.uid).forEach(b => beats.push(b));
          act.beats = beats;
          rec.acts.push(act);
        }
        /* acts the phone made itself are kept as they are */
        const planActs = new Set(p.acts.map(a => a.uid).filter(Boolean));
        oldActs.filter(a => !a.uid || !planActs.has(a.uid))
          .filter(a => !a.uid || (a.beats || []).some(b => b.done || (b.shots || []).some(s => s.done)))
          .forEach(a => rec.acts.push(a.uid ? { ...a, orphan:true } : a));
      }

      if(!old){ id = rec.id; idByUid.vlogs[p.uid] = id; added.vlogs.add(id); }
      work.vlogs.set(id, rec);
    }

    /* --- removals */
    const removeIds = { tasks:[], vlogs:[], clips:[], series:[], refs:[] };
    const keptWithWork = [];
    const workTest = {
      tasks: taskHasWork,
      vlogs: vlogHasWork,
      clips: c => c.state && c.state !== 'raw',
      series: s => [...work.clips.values()].some(c => c.seriesId === s.id),
      /* a still you also pinned to a shot of your own on the phone stays */
      refs: x => [...work.tasks.values()].some(t => (t.shots || []).some(sh => !sh.uid && (sh.refs || []).includes(x.id)))
    };
    KINDS.forEach(k => {
      pack.removed[k].forEach(u => {
        const id = idByUid[k][u];
        if(id === undefined) return;       /* already gone — nothing to do */
        const r = work[k].get(id);
        if(workTest[k](r)){
          keptWithWork.push(r.title || u);
          if(!r.orphan) work[k].set(id, { ...r, orphan:true });
        } else {
          removeIds[k].push(id);
          work[k].delete(id);
        }
      });
    });

    /* --- what actually changed */
    const changed = { tasks:[], vlogs:[], clips:[], series:[], refs:[] };
    const updated = { tasks:0, vlogs:0, clips:0, series:0, refs:0 };
    KINDS.forEach(k => {
      work[k].forEach((r, id) => {
        if(added[k].has(id)){ changed[k].push(r); return; }
        if(before[k].get(id) !== canon(r)){ changed[k].push(r); updated[k]++; }
      });
    });

    const count = o => {
      const out = {};
      KINDS.forEach(k => { const v = o[k]; out[k] = v instanceof Set ? v.size : v.length; });
      return out;
    };

    return {
      summary: {
        add: count(added),
        update: updated,
        remove: count(removeIds),
        keptWithWork,
        warnings,
        nothingToDo: KINDS.every(k => !changed[k].length && !removeIds[k].length) && !blobs.length
      },
      changed, removeIds, blobs
    };
  }

  async function preview(pack){
    return (await plan(pack)).summary;
  }

  async function apply(pack){
    const p = await plan(pack);
    for(const [id, data] of p.blobs){
      const res = await fetch(data);                 /* data: URL → Blob, no network */
      await Store.put('ref-img', await res.blob(), id);
    }
    for(const k of KINDS){
      for(const r of p.changed[k]) await Store.put(k, r);
      for(const id of p.removeIds[k]){
        await Store.del(k, id);
        if(k === 'refs'){ try { await Store.del('ref-img', id); await Store.del('ref-poster', id); } catch(e){} }
      }
    }
    if(global.Refs && Refs.forget) p.changed.refs.forEach(r => Refs.forget(r.id));
    Data.invalidate();
    if(global.Channels && Channels.invalidate) Channels.invalidate();
    return p.summary;
  }

  /* one line a person can read, e.g. "12 new · 4 updated · 1 removed" */
  function describe(s){
    const sum = o => KINDS.reduce((n, k) => n + (o[k] || 0), 0);
    const parts = [];
    if(sum(s.add)) parts.push(`${sum(s.add)} new`);
    if(sum(s.update)) parts.push(`${sum(s.update)} updated`);
    if(sum(s.remove)) parts.push(`${sum(s.remove)} removed`);
    if(s.keptWithWork.length) parts.push(`${s.keptWithWork.length} kept (has captured work)`);
    return parts.join(' · ') || 'Already up to date';
  }

  global.PlanPack = { FORMAT, VERSION, newUid, build, parse, preview, apply, describe };
})(window);
