/* Shot ids — every shot gets a permanent name.

   A shot lives inside the thing it was planned on: a task (`task.shots[i]`,
   with angles) or an episode sequence (`vlog.acts[].beats[].shots[i]`). That
   stays true. What was missing is identity: shots were found by their place
   in a list (`task:12:3`), so anything pointing at one — a card on a board —
   broke the moment the list was reordered.

   So every shot, and every angle on it, gets an `id`. It is stamped:
     - on read  (Store.get / Store.all of tasks and vlogs), in memory
     - on write (Store.put of tasks and vlogs), so it is saved
     - once at start-up, so stored records catch up
   Ids for shots that never had one are derived from where they sit (owner,
   position, name), so a read and a later write of the same old shot agree on
   its id even if they happen in different screens. Once saved, an id never
   changes. A copied shot (duplicate) gets a fresh one.

   Episode shots sent to the task list are copied onto the shoot task — that is
   how Shoot mode ticks angles. The copy remembers where it came from
   (`src: { beat, shot }`), so the two are known to be the same shot. */
(function(global){

  /* FNV-1a, base36: short, stable, no dependencies */
  function hash(s){
    let h = 0x811c9dc5;
    for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36);
  }
  const nameOf = s => (s && (s.text || s.name)) || '';

  /* One shape. Shots are named in `text` (what the task and episode screens
     read); copies made by the old "Add to my tasks" wrote `name`, which showed
     as "undefined" on the task screen. Angles are identified by `type` (what
     coverage counts); those copies wrote only a label in `n`. */
  const TYPE_OF = [[/^establish/i, 'establish'], [/^wide/i, 'wide'], [/^med/i, 'medium'],
                   [/^close/i, 'close'], [/^detail/i, 'detail'], [/^creative/i, 'creative']];
  function angleType(label){
    const l = String(label || '').trim();
    if(!l) return '';
    const hit = TYPE_OF.find(([re]) => re.test(l));
    if(hit) return hit[1];
    const lib = global.ShotLib && ShotLib.CATALOGUE;
    const k = Array.isArray(lib) && lib.find(x => x && String(x.label || '').toLowerCase() === l.toLowerCase());
    return k ? k.id : l.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function normalise(s){
    let changed = false;
    if((s.text == null || s.text === '') && s.name){ s.text = s.name; delete s.name; changed = true; }
    (s.angles || []).forEach(a => {
      if(a && typeof a === 'object' && !a.type && a.n){ a.type = angleType(a.n); changed = true; }
    });
    return changed;
  }

  /* Give a list of shots ids, in place. Returns true if anything changed. */
  function stampList(list, owner){
    if(!Array.isArray(list)) return false;
    let changed = false;
    const seen = new Set();
    list.forEach((s, i) => {
      if(!s || typeof s !== 'object') return;
      if(normalise(s)) changed = true;
      if(!s.id || seen.has(s.id)){
        const base = 'sh_' + hash(`${owner}:${i}:${nameOf(s)}`);
        let id = base, n = 1;
        while(seen.has(id)) id = `${base}${n++}`;
        s.id = id; changed = true;
      }
      seen.add(s.id);
      if(Array.isArray(s.angles)){
        const aseen = new Set();
        s.angles.forEach((a, j) => {
          if(!a || typeof a !== 'object') return;
          if(!a.id || aseen.has(a.id)){
            const base = 'an_' + hash(`${s.id}:${j}:${a.type || a.n || ''}`);
            let id = base, n = 1;
            while(aseen.has(id)) id = `${base}${n++}`;
            a.id = id; changed = true;
          }
          aseen.add(a.id);
        });
      }
    });
    return changed;
  }

  function stampTask(t){
    if(!t || typeof t !== 'object' || t.id == null) return false;
    return stampList(t.shots, 'task:' + t.id);
  }
  function stampVlog(v){
    if(!v || typeof v !== 'object' || v.id == null) return false;
    let changed = false;
    (v.acts || []).forEach(a => (a.beats || []).forEach(b => {
      if(b && stampList(b.shots, 'beat:' + (b.id || '?'))) changed = true;
    }));
    return changed;
  }
  const STAMP = { tasks: stampTask, vlogs: stampVlog };

  /* A shoot task made from a sequence: point each copied shot at its original.
     Matched by position and name, the way vlogtasks.js copied them. */
  function linkTask(t, vlogsById){
    if(!t || !t.beatId || !Array.isArray(t.shots)) return false;
    const v = vlogsById[t.vlogId];
    if(!v) return false;
    let beat = null;
    (v.acts || []).forEach(a => (a.beats || []).forEach(b => { if(b.id === t.beatId) beat = b; }));
    if(!beat || !Array.isArray(beat.shots)) return false;
    let changed = false;
    t.shots.forEach((s, i) => {
      if(s.src) return;
      const o = beat.shots[i];
      if(o && o.id && nameOf(o) === nameOf(s)){ s.src = { beat: beat.id, shot: o.id }; changed = true; }
    });
    return changed;
  }

  /* ---------------------------------------------------------- wire into Store */

  function wrap(){
    if(!global.Store || Store.__shotIds) return;
    const { get, all, put } = Store;
    Store.get = async (store, key) => {
      const v = await get(store, key);
      if(STAMP[store]) STAMP[store](v);
      return v;
    };
    Store.all = async store => {
      const r = await all(store);
      if(STAMP[store]) r.values.forEach(STAMP[store]);
      return r;
    };
    Store.put = (store, value, key) => {
      if(STAMP[store]) STAMP[store](value);
      return put(store, value, key);
    };
    Store.__shotIds = true;
  }

  /* Save the ids into records that don't have them yet, and link shoot tasks
     to the sequences they came from. Quiet, and safe to run every start. */
  async function migrate(){
    try {
      const d = await Store.db();
      const read = name => new Promise((res, rej) => {
        const r = d.transaction(name, 'readonly').objectStore(name).getAll();
        r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
      });
      const [tasks, vlogs] = await Promise.all([read('tasks'), read('vlogs')]);
      const dirtyV = vlogs.filter(stampVlog);
      const byId = Object.fromEntries(vlogs.map(v => [v.id, v]));
      const dirtyT = tasks.filter(t => { const a = stampTask(t); const b = linkTask(t, byId); return a || b; });
      if(!dirtyV.length && !dirtyT.length) return { tasks:0, vlogs:0 };
      await new Promise((res, rej) => {
        const tx = d.transaction(['tasks', 'vlogs'], 'readwrite');
        dirtyT.forEach(t => tx.objectStore('tasks').put(t));
        dirtyV.forEach(v => tx.objectStore('vlogs').put(v));
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
      if(global.Data && Data.invalidate) Data.invalidate();
      return { tasks: dirtyT.length, vlogs: dirtyV.length };
    } catch(e){ console.warn('Shot ids: migration skipped', e); return null; }
  }

  wrap();
  if(global.document) document.addEventListener('DOMContentLoaded', () => setTimeout(migrate, 1200));

  global.ShotIds = { stampList, stampTask, stampVlog, linkTask, migrate, hash, angleType };
})(window);
