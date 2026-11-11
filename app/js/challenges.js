/* Challenges — the long arc, the month's challenge under it, and the weekly
   milestones under that. A week's milestones are what its episode is about. */
(function(global){
  const uid = () => 'ch_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  let cache = null;
  async function all(){
    if(cache) return cache;
    const { values } = await Store.all('challenges');
    cache = values.sort((a,b) => (a.fromWeek || 0) - (b.fromWeek || 0));
    return cache;
  }
  const invalidate = () => cache = null;

  async function save(rec){
    const r = { ...rec };
    if(!r.id){ r.id = uid(); r.createdAt = Date.now(); }
    r.milestones = r.milestones || [];
    await Store.put('challenges', r);
    invalidate();
    return r;
  }
  async function remove(id){
    const kids = (await all()).filter(c => c.parentId === id);
    for(const k of kids){ k.parentId = null; await Store.put('challenges', k); }
    await Store.del('challenges', id);
    invalidate();
  }

  const covers = (c, week) =>
    week >= (c.fromWeek || 1) && (!c.toWeek || week <= c.toWeek);

  /* What is running in a given week, outermost first. */
  async function forWeek(week){
    const list = await all();
    const running = list.filter(c => covers(c, week));
    const arcs = running.filter(c => !c.parentId);
    const rest = running.filter(c => c.parentId);
    return [...arcs, ...rest];
  }

  /* The milestones aimed at this week — the basis of its episode. */
  async function milestonesFor(week){
    const list = await all();
    const out = [];
    list.forEach(c => (c.milestones || [])
      .filter(m => m.week === week)
      .forEach(m => out.push({ ...m, challenge:c })));
    return out;
  }

  async function toggleMilestone(challengeId, milestoneId){
    const list = await all();
    const c = list.find(x => x.id === challengeId);
    if(!c) return;
    const m = (c.milestones || []).find(x => x.id === milestoneId);
    if(!m) return;
    m.done = !m.done;
    await Store.put('challenges', c);
    invalidate();
  }

  /* How far through a challenge you are, by weeks elapsed and milestones hit. */
  function progress(c, week){
    const from = c.fromWeek || 1;
    const to = c.toWeek || null;
    const weeks = to ? (to - from + 1) : null;
    const elapsed = Math.max(0, Math.min(weeks || Infinity, week - from + 1));
    const ms = c.milestones || [];
    const done = ms.filter(m => m.done).length;
    return {
      weeks, elapsed,
      weekPct: weeks ? Math.round(elapsed / weeks * 100) : null,
      done, total:ms.length,
      msPct: ms.length ? Math.round(done / ms.length * 100) : null
    };
  }

  global.Challenges = { all, save, remove, invalidate, forWeek, milestonesFor,
                        toggleMilestone, progress, covers, uid };
})(window);
