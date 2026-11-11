/* Every shot you have planned, wherever it lives.

   A shot is written on a task or on an episode beat, which is right — that is
   where you plan. But when you are standing somewhere with a camera, the useful
   question is not "which task is this" but "what can I get while I am here".
   This gathers them all into one list you can cut by place, by framing, or by
   what is still outstanding. */
(function(global){

  /* Places you shoot. Yours, added as you go, because nobody else's list of
     locations is any use to you. */
  async function locations(){
    try { return (await Store.get('settings', 'shot-locations')) || []; }
    catch(e){ return []; }
  }
  async function addLocation(name){
    const n = String(name || '').trim();
    if(!n) return null;
    const list = await locations();
    if(!list.some(x => x.toLowerCase() === n.toLowerCase())) list.push(n);
    await Store.put('settings', list, 'shot-locations');
    return n;
  }
  /* Locations actually in use, so the filter never offers an empty one. */
  async function usedLocations(){
    const all = await gather();
    return [...new Set(all.map(s => s.location).filter(Boolean))].sort();
  }

  /* Pull every shot out of tasks and episodes into one shape.

     Each carries `id` (permanent — see shotids.js) and `ref`, which is what
     anything outside the shot list keeps to find it again. A sequence's shot
     that was sent to the task list exists twice (the task copy is where Shoot
     mode ticks angles); it is listed once, as the task copy, which knows where
     it came from. */
  async function gather(){
    const out = [];

    let tasks = [];
    try { tasks = await Data.tasks(); } catch(e){ tasks = []; }
    const sent = new Set();
    tasks.forEach(t => (t.shots || []).forEach(s => { if(s && s.src && s.src.shot) sent.add(s.src.shot); }));

    tasks.forEach(t => {
      (t.shots || []).forEach((s, i) => {
        const angles = s.angles || [];
        out.push({
          key: `task:${t.id}:${i}`,
          id: s.id || null,
          ref: { type:'task', owner:t.id, id:s.id || null },
          src: s.src || null,
          name: s.text || s.name || 'Shot',
          location: s.location || '',
          framing: (angles[0] || {}).n || '',
          movement: s.movement || '',
          refs: s.refs || [],
          angles,
          captured: angles.length ? angles.every(a => a.done) : false,
          partly: angles.some(a => a.done) && !angles.every(a => a.done),
          source: 'task', sourceId: t.id, sourceName: t.title,
          vlogId: t.vlogId || null,
          day: t.day, at: t.at || '',
          kind: t.kind || ''
        });
      });
    });

    let vlogs = [];
    try { const { values } = await Store.all('vlogs'); vlogs = values; }
    catch(e){ vlogs = []; }
    vlogs.forEach(v => (v.acts || []).forEach(a => (a.beats || []).forEach(b => {
      (b.shots || []).forEach((s, i) => {
        if(s && s.id && sent.has(s.id)) return;      /* listed as its task copy */
        out.push({
          key: `beat:${b.id}:${i}`,
          id: s.id || null,
          ref: { type:'beat', owner:b.id, vlog:v.id, id:s.id || null },
          name: s.text || s.name || 'Shot',
          location: s.location || '',
          framing: s.framing || '',
          movement: s.movement || '',
          refs: s.refs || [],
          angles: [],
          captured: !!s.done,
          partly: false,
          source: 'beat', sourceId: b.id, vlogId: v.id,
          sourceName: `${v.title} · ${b.title}`,
          day: b.day ?? null, at: b.at || '',
          kind: 'shoot'
        });
      });
    })));

    return out;
  }

  /* ---- finding a shot by its id ----

     ref: { type:'task', owner:<taskId>, id } or { type:'beat', owner:<beatId>, vlog:<vlogId>, id }.
     find() returns { shot, record, store } or null. update() changes the shot
     with fn(shot) and saves the record it lives in. */
  async function find(ref){
    if(!ref || !ref.id) return null;
    if(ref.type === 'task'){
      const t = await Store.get('tasks', ref.owner);
      const shot = t && (t.shots || []).find(s => s.id === ref.id);
      return shot ? { shot, record:t, store:'tasks' } : null;
    }
    if(ref.type === 'beat'){
      const v = ref.vlog != null ? await Store.get('vlogs', ref.vlog) : null;
      const list = v ? [v] : (await Store.all('vlogs')).values;
      for(const vv of list) for(const a of (vv.acts || [])) for(const b of (a.beats || [])){
        if(b.id !== ref.owner) continue;
        const shot = (b.shots || []).find(s => s.id === ref.id);
        if(shot) return { shot, record:vv, store:'vlogs', beat:b };
      }
    }
    return null;
  }

  async function update(ref, fn){
    const hit = await find(ref);
    if(!hit) return false;
    fn(hit.shot, hit);
    await Store.put(hit.store, hit.record);
    if(hit.store === 'tasks') Data.invalidate('tasks');
    return true;
  }

  /* The other copy of the same shot, if it was sent to the task list. */
  async function twin(ref){
    const hit = await find(ref);
    if(!hit) return null;
    if(hit.store === 'tasks' && hit.shot.src){
      const t = hit.record;
      return { type:'beat', owner:hit.shot.src.beat, vlog:t.vlogId, id:hit.shot.src.shot };
    }
    if(hit.store === 'vlogs'){
      const tasks = await Data.tasks();
      for(const t of tasks) for(const s of (t.shots || []))
        if(s.src && s.src.shot === ref.id) return { type:'task', owner:t.id, id:s.id };
    }
    return null;
  }

  /* Grouped by place, because that is how a shoot day is actually planned.
     Anything without a location sorts last rather than pretending to be a place. */
  function byLocation(shots){
    const map = {};
    shots.forEach(s => {
      const k = s.location || '';
      (map[k] = map[k] || []).push(s);
    });
    return Object.entries(map)
      .sort((a, b) => a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0]))
      .map(([location, items]) => ({
        location, items,
        outstanding: items.filter(s => !s.captured).length
      }));
  }

  function stats(shots){
    const captured = shots.filter(s => s.captured).length;
    return {
      total: shots.length, captured,
      outstanding: shots.length - captured,
      pct: shots.length ? Math.round(captured / shots.length * 100) : 0
    };
  }

  /* Writing a location back onto whichever thing owns the shot — and onto its
     other copy, so the sequence and its shoot task never disagree. Shots from
     before ids existed are still found by position. */
  async function setLocation(shot, location){
    const ref = shot.ref && shot.ref.id ? shot.ref : null;
    if(ref){
      const ok = await update(ref, s => { s.location = location; });
      const other = await twin(ref);
      if(other) await update(other, s => { s.location = location; });
      return ok;
    }
    if(shot.source === 'task'){
      const tasks = await Data.tasks();
      const t = tasks.find(x => x.id === shot.sourceId);
      if(!t) return false;
      const i = +shot.key.split(':')[2];
      if(!t.shots[i]) return false;
      t.shots[i].location = location;
      await Store.put('tasks', t);
      Data.invalidate('tasks');
      return true;
    }
    const { values } = await Store.all('vlogs');
    const v = values.find(x => x.id === shot.vlogId);
    if(!v) return false;
    for(const a of (v.acts || [])){
      const b = (a.beats || []).find(x => x.id === shot.sourceId);
      if(!b) continue;
      const i = +shot.key.split(':')[2];
      if(!b.shots[i]) return false;
      b.shots[i].location = location;
      await Store.put('vlogs', v);
      return true;
    }
    return false;
  }

  global.Shots = { gather, byLocation, stats, locations, addLocation,
                   usedLocations, setLocation, find, update, twin };
})(window);
