/* Saved workouts.

   A finished session is history. A routine is the reusable thing — the list of
   lifts, in order, that you meant to do. Starting one builds a fresh session
   from your current working loads rather than whatever you lifted last time. */
(function(global){

  let cache = null;
  const uid = () => 'rt_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  async function all(){
    if(cache) return cache;
    try {
      const { values } = await Store.all('routines');
      cache = values.sort((a,b) => (b.lastAt || 0) - (a.lastAt || 0) ||
                                    a.name.localeCompare(b.name));
    } catch(e){ cache = []; }
    return cache;
  }
  const invalidate = () => { cache = null; };

  async function get(id){ return (await all()).find(r => r.id === id) || null; }

  async function save(rec){
    const r = {
      id: rec.id || uid(),
      name: rec.name || 'Untitled routine',
      note: rec.note || '',
      type: rec.type || '',        /* which kind of workout this is */
      /* only what makes the routine reusable: which lifts, how many sets, how many
         reps. The weight comes from your current loads at the time you run it. */
      items: (rec.items || []).map(i => ({
        id: i.id, name: i.name, sets: Math.max(1, +i.sets || 3),
        reps: Math.max(1, +i.reps || 8), rest: +i.rest || 150,
        pri: i.pri || [], sec: i.sec || []
      })),
      createdAt: rec.createdAt || Date.now(),
      lastAt: rec.lastAt || 0,
      runs: rec.runs || 0
    };
    await Store.put('routines', r);
    invalidate();
    return r;
  }

  async function remove(id){
    await Store.del('routines', id);
    invalidate();
  }

  /* Turn a session you have just built into something you can run again. */
  function fromSession(session, name){
    return {
      name: name || session.name || 'Untitled routine',
      items: (session.exercises || []).map(e => ({
        id: e.id, name: e.name,
        sets: (e.sets || []).length || 3,
        reps: (e.sets || [])[0] ? ((e.sets[0].reps) || 8) : 8,
        rest: e.rest || 150,
        pri: e.pri || [], sec: e.sec || []
      }))
    };
  }

  /* Build a runnable session, weighted from what you are lifting now. */
  async function toSession(routine){
    let loads = [];
    try { loads = await Loads.all(); } catch(e){ loads = [] }
    let lib = [];
    try { lib = await Exercises.all(); } catch(e){ lib = []; }

    const weightFor = item => {
      const l = loads.find(x => x.id === item.id);
      if(l && l.kg > 0) return l.kg;
      const x = lib.find(e => e.id === item.id);
      return x ? (x.kg || 0) : 0;
    };

    return {
      name: routine.name,
      routineId: routine.id,
      exercises: routine.items.map(i => {
        const kg = weightFor(i);
        return {
          id: i.id, name: i.name, rest: i.rest, pri: i.pri, sec: i.sec,
          sets: Array.from({ length: i.sets }, () => ({ kg, reps: i.reps }))
        };
      })
    };
  }

  /* Note that it was run, so the library sorts by what you actually use. */
  async function markRun(id){
    const r = await get(id);
    if(!r) return;
    r.lastAt = Date.now();
    r.runs = (r.runs || 0) + 1;
    await Store.put('routines', r);
    invalidate();
  }

  const muscles = routine =>
    Exercises.coverage((routine.items || []).map(i => ({ pri:i.pri, sec:i.sec })));

  /* Types come from the shipped list plus anything you have invented. A type you
     made stays available as long as a routine still uses it. */
  async function types(){
    const shipped = (global.WorkoutTypes && WorkoutTypes.CATS) || [];
    let custom = [];
    try { custom = (await Store.get('settings', 'routine-types')) || []; }
    catch(e){ custom = []; }
    const used = (await all()).map(r => r.type).filter(Boolean);
    return [...new Set([...shipped, ...custom, ...used])];
  }

  async function addType(name){
    const n = String(name || '').trim();
    if(!n) return null;
    let custom = [];
    try { custom = (await Store.get('settings', 'routine-types')) || []; }
    catch(e){ custom = []; }
    if(!custom.includes(n)) custom.push(n);
    await Store.put('settings', custom, 'routine-types');
    return n;
  }

  /* Grouped for a list that stays readable once there are a lot of them. */
  async function grouped(){
    const list = await all();
    const out = {};
    list.forEach(r => { (out[r.type || 'Unsorted'] = out[r.type || 'Unsorted'] || []).push(r); });
    return Object.entries(out)
      .sort((a,b) => a[0] === 'Unsorted' ? 1 : b[0] === 'Unsorted' ? -1 : a[0].localeCompare(b[0]))
      .map(([type, items]) => ({ type, items }));
  }

  /* ---- quick start ----
     What sits on the workout page's front row. Each entry points at either a
     routine of yours or one of the shipped workouts, so you can pin something
     before you have saved it. Empty means "work it out from what I use most". */
  async function quickStart(){
    let pinned = [];
    try { pinned = (await Store.get('settings', 'quickstart')) || []; }
    catch(e){ pinned = []; }

    const mine = await all();
    const resolved = [];

    for(const p of pinned){
      if(p.kind === 'routine'){
        const r = mine.find(x => x.id === p.id);
        if(r) resolved.push({ kind:'routine', id:r.id, n:r.name, c:colourFor(r), runs:r.runs || 0 });
      } else {
        const t = global.WorkoutTypes && WorkoutTypes.byId(p.id);
        if(t) resolved.push({ kind:'type', id:t.id, n:t.n, c:t.c, runs:0 });
      }
    }

    /* nothing pinned yet: fall back to whatever you actually run */
    if(!resolved.length){
      return mine.slice()
        .sort((a,b) => (b.runs || 0) - (a.runs || 0) || (b.lastAt || 0) - (a.lastAt || 0))
        .slice(0, 3)
        .map(r => ({ kind:'routine', id:r.id, n:r.name, c:colourFor(r), runs:r.runs || 0,
                     auto:true }));
    }
    return resolved;
  }

  function colourFor(r){
    const cov = (global.Exercises && Exercises.coverage(r.items || [])) || [];
    return cov.length ? cov[0].c : '#FB6900';
  }

  async function setQuickStart(list){
    await Store.put('settings', list.map(x => ({ kind:x.kind, id:x.id })), 'quickstart');
  }

  /* ---- putting a workout on a day ----
     A workout task is an ordinary task that happens to carry a routine id, so it
     swipes, counts toward the streak, and sits in the timeline like everything
     else — it just knows how to start itself. */
  /* A rough guess at how long a routine takes, used as the default block: every
     set plus its rest, plus a couple of minutes a lift for setting up. */
  function estimateMinutes(r){
    const secs = (r.items || []).reduce((n, i) => {
      const work = i.reps > 30 ? i.reps : i.sets * 45;   /* held positions count in seconds */
      const rest = i.sets * (i.rest || 150);
      return n + work + rest + 120;
    }, 0);
    return Math.max(15, Math.round(secs / 60 / 5) * 5);  /* to the nearest five */
  }

  async function scheduleTask(routineId, day, at, opts){
    const r = await get(routineId);
    if(!r) return null;
    const o = opts || {};

    const tasks = await Data.tasks();
    const mins = +o.mins || estimateMinutes(r);

    const make = (d) => ({
      id: U.taskId(), day: d,
      title: r.name,
      cad: o.repeat && o.repeat.length ? 'Weekly' : (r.type || 'Workout'),
      pri: 'med',
      at: at || '',
      mins,                              /* how long to block out */
      prog: '',
      view: 'todo',
      kind: 'workout',
      routineId: r.id,
      series: o.seriesKey || null,       /* ties a recurring set together */
      subs: r.items.map(i => ({ t: `${i.name} · ${i.sets}×${i.reps}`, done:false })),
      shots: []
    });

    /* one-off */
    if(!o.repeat || !o.repeat.length){
      const task = make(day);
      await Store.put('tasks', task);
      Data.invalidate('tasks');
      return [task];
    }

    /* recurring: the chosen weekdays, for however many weeks */
    const weeks = Math.max(1, +o.weeks || 4);
    const startDate = await Data.dayToDate(day);
    const start = new Date(startDate); start.setHours(0,0,0,0);
    const made = [];

    for(let i = 0; i < weeks * 7; i++){
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if(!o.repeat.includes(d.getDay())) continue;
      const dayNum = day + i;
      const task = make(dayNum);
      await Store.put('tasks', task);
      made.push(task);
    }
    Data.invalidate('tasks');
    return made;
  }

  /* Removing a whole recurring set, for when a plan changes. */
  async function unschedule(seriesKey){
    const tasks = await Data.tasks();
    let n = 0;
    for(const t of tasks){
      if(t.series && t.series === seriesKey && t.view === 'todo'){
        await Store.del('tasks', t.id);
        n++;
      }
    }
    Data.invalidate('tasks');
    return n;
  }

  /* When a session finishes, tick the task that asked for it. */
  async function completeTaskFor(routineId, day){
    if(!routineId) return false;
    const tasks = await Data.tasks();
    const hit = tasks.filter(t => t.routineId === routineId && t.view === 'todo')
      .sort((a,b) => Math.abs(a.day - day) - Math.abs(b.day - day))[0];
    if(!hit) return false;
    hit.view = 'done';
    (hit.subs || []).forEach(s2 => s2.done = true);
    await Store.put('tasks', hit);
    Data.invalidate('tasks');
    return true;
  }

  global.Routines = { all, get, save, remove, fromSession, toSession, markRun,
                      muscles, types, addType, grouped, invalidate,
                      quickStart, setQuickStart, scheduleTask, completeTaskFor,
                      estimateMinutes, unschedule };
})(window);
