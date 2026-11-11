/* Working loads, and putting them up on a schedule.

   The weight you are currently using for each lift, tracked separately from any
   one session, so progressive overload can be applied across the board rather
   than remembered lift by lift. */
(function(global){

  const DEFAULTS = {
    pct: 10,           /* how much to add, applied across the board */
    everyWeeks: 3,     /* how often */
    auto: false,       /* apply on its own, or ask first */
    lastAt: 0,
    startedAt: 0
  };

  let cache = null, cfg = null;

  async function config(){
    if(cfg) return cfg;
    cfg = { ...DEFAULTS, ...((await Store.get('settings', 'overload')) || {}) };
    if(!cfg.startedAt){ cfg.startedAt = Date.now(); await Store.put('settings', cfg, 'overload'); }
    return cfg;
  }
  async function setConfig(patch){
    cfg = { ...(await config()), ...patch };
    await Store.put('settings', cfg, 'overload');
    return cfg;
  }

  async function all(){
    if(cache) return cache;
    try { const { values } = await Store.all('loads'); cache = values; }
    catch(e){ cache = []; }
    return cache;
  }
  const invalidate = () => { cache = null; };

  async function get(exerciseId){
    return (await all()).find(l => l.id === exerciseId) || null;
  }

  /* Gyms come in fixed increments, so a percentage has to land on something you
     can actually load. 2.5kg is the smallest plate pair most places have. */
  const STEP_KG = 2.5;
  function round(kg){
    if(kg <= 0) return 0;
    const r = Math.round(kg / STEP_KG) * STEP_KG;
    /* never let a rounding-down leave you exactly where you started */
    return r;
  }

  /* Some lifts should never climb on a schedule — a stretch, a warm-up, anything
     bodyweight. Holding one keeps it tracked but leaves it out of every increase. */
  async function hold(exerciseId, on){
    const list = await all();
    const rec = list.find(l => l.id === exerciseId) || { id: exerciseId, kg: 0, history: [] };
    rec.hold = on === undefined ? !rec.hold : !!on;
    await Store.put('loads', rec);
    invalidate();
    return rec.hold;
  }

  async function set(exerciseId, kg, reason){
    const list = await all();
    const existing = list.find(l => l.id === exerciseId);
    const rec = existing || { id: exerciseId, history: [] };
    const was = rec.kg;

    rec.kg = round(+kg || 0);
    rec.updatedAt = Date.now();
    rec.history = (rec.history || []).concat([{ at: Date.now(), kg: rec.kg, from: was || 0,
                                                why: reason || 'set by hand' }]).slice(-24);
    await Store.put('loads', rec);
    invalidate();
    return rec;
  }

  /* A finished session tells us what you are actually lifting, which is better
     evidence than what you once typed in. Only ever moves a load upward. */
  async function learnFrom(session){
    const list = await all();
    let changed = 0;
    for(const ex of (session.exercises || [])){
      const top = (ex.sets || []).filter(s => s.done !== false)
        .reduce((m, s) => Math.max(m, +s.kg || 0), 0);
      if(!top) continue;
      const cur = list.find(l => l.id === ex.id);
      if(cur && top <= (cur.kg || 0)) continue;
      await set(ex.id, top, 'lifted in a session');
      changed++;
    }
    return changed;
  }

  const WEEK = 7 * 86400000;
  async function schedule(){
    const c = await config();
    const from = c.lastAt || c.startedAt || Date.now();
    const dueAt = from + c.everyWeeks * WEEK;
    const days = Math.ceil((dueAt - Date.now()) / 86400000);
    return { ...c, from, dueAt, days, due: Date.now() >= dueAt };
  }

  /* What an increase would do, without doing it.
     `ids` narrows it to one routine's lifts; held lifts are never included. */
  async function preview(pct, ids){
    const list = await all();
    const p = (pct === undefined ? (await config()).pct : pct) / 100;
    return list
      .filter(l => !ids || ids.includes(l.id))
      .filter(l => !l.hold)
      .filter(l => l.kg > 0)
      .map(l => {
        const raw = l.kg * (1 + p);
        let next = round(raw);
        if(next <= l.kg) next = l.kg + STEP_KG;    /* a rise must actually rise */
        return { id:l.id, from:l.kg, to:next, add: next - l.kg };
      });
  }

  async function apply(pct, ids){
    const rows = await preview(pct, ids);
    const p = pct === undefined ? (await config()).pct : pct;
    for(const r of rows) await set(r.id, r.to, `+${p}% scheduled increase`);
    await setConfig({ lastAt: Date.now() });
    invalidate();
    return rows.length;
  }

  /* Saved sessions double as routines: each one is a named set of lifts, which
     is exactly the scope you want an increase to land on. */
  async function routines(){
    /* saved workouts are the real answer; finished sessions are the fallback for
       anyone who has not saved one yet */
    try {
      const saved = await Routines.all();
      if(saved.length){
        const loaded = await all();
        return saved.map(r => {
          const ids = [...new Set(r.items.map(i => i.id))];
          return { name:r.name, ids, at:r.lastAt || r.createdAt,
            liftable: ids.filter(id => {
              const l = loaded.find(x => x.id === id);
              return l && l.kg > 0 && !l.hold;
            }) };
        }).sort((a,b) => b.at - a.at);
      }
    } catch(e){}

    let sessions = [];
    try { const { values } = await Store.all('sessions'); sessions = values; }
    catch(e){ return []; }

    /* the most recent version of each named routine */
    const byName = {};
    sessions.filter(s2 => s2.name && (s2.exercises || []).length)
      .sort((a,b) => (a.finishedAt || 0) - (b.finishedAt || 0))
      .forEach(s2 => { byName[s2.name] = s2; });

    const loaded = await all();
    const held = new Set(loaded.filter(l => l.hold).map(l => l.id));

    return Object.values(byName).map(s2 => {
      const ids = [...new Set((s2.exercises || []).map(e => e.id))];
      const liftable = ids.filter(id => {
        const l = loaded.find(x => x.id === id);
        return l && l.kg > 0 && !held.has(id);
      });
      return { name:s2.name, ids, liftable, at:s2.finishedAt };
    }).sort((a,b) => b.at - a.at);
  }

  global.Loads = { config, setConfig, all, get, set, hold, round, learnFrom,
                   schedule, preview, apply, routines, invalidate, STEP_KG, DEFAULTS };
})(window);
