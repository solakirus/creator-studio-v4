/* Achievements. Every rule is a pure function of stored data, so nothing has to
   be kept in sync — an award is simply true or not yet true. */
(function(global){

  /* tone decides the colour and the word; the presenter reads it */
  const TONE = {
    streak:  { c:'#FB6900', label:'Streak' },
    first:   { c:'#5BBE6A', label:'First' },
    record:  { c:'#E8A33D', label:'Record' },
    count:   { c:'#A855F7', label:'Milestone' },
    comeback:{ c:'#22C7B8', label:'Back at it' }
  };

  /* ---- the facts everything is judged against ---- */
  async function facts(){
    const [tasks, day] = await Promise.all([Data.tasks(), Data.currentDay()]);
    const { values: sessions } = await Store.all('sessions');
    const { values: runs } = await Store.all('runs');
    const clips = await Data.clips();

    const byDay = {};
    tasks.forEach(t => {
      const d = byDay[t.day] = byDay[t.day] || { total:0, done:0 };
      d.total++;
      if(t.view === 'done') d.done++;
    });
    const perfect = d => byDay[d] && byDay[d].total && byDay[d].done >= byDay[d].total;

    let dayStreak = 0;
    for(let d = day; d >= 1; d--){
      if(!byDay[d] || !byDay[d].total){ if(d === day) continue; else break; }
      if(perfect(d)) dayStreak++; else break;
    }
    let best = 0, run = 0;
    for(let d = 1; d <= day; d++){
      if(!byDay[d] || !byDay[d].total) continue;
      if(perfect(d)){ run++; best = Math.max(best, run); } else run = 0;
    }
    /* did a perfect day follow a broken one? that is the comeback */
    const brokeThenFixed = dayStreak === 1 && best >= 3;

    /* consecutive calendar days with a workout, and with a run */
    const dayKeys = list => new Set(list.map(x => {
      const d = new Date(x.finishedAt || x.at || x.createdAt);
      d.setHours(0,0,0,0);
      return d.getTime();
    }));
    const consecutive = keys => {
      if(!keys.size) return 0;
      const today = new Date(); today.setHours(0,0,0,0);
      let n = 0, cur = today.getTime();
      if(!keys.has(cur)) cur -= 86400000;      /* yesterday still counts as alive */
      while(keys.has(cur)){ n++; cur -= 86400000; }
      return n;
    };

    const totalKm = runs.reduce((a,r) => a + (+r.km || 0), 0);
    const longest = runs.reduce((a,r) => Math.max(a, +r.km || 0), 0);
    const heaviest = sessions.reduce((a,s) =>
      Math.max(a, (s.exercises || []).reduce((m,e) =>
        Math.max(m, (e.sets || []).reduce((k,x) => Math.max(k, +x.kg || 0), 0)), 0)), 0);

    const shotsToday = tasks.filter(t => t.day === day)
      .reduce((a,t) => a + (t.shots || []).reduce((m,s) =>
        m + (s.angles || []).filter(x => x.done).length, 0), 0);
    const allShotsToday = (() => {
      const mine = tasks.filter(t => t.day === day && (t.shots || []).length);
      if(!mine.length) return false;
      return mine.every(t => t.shots.every(s =>
        (s.angles || []).length && s.angles.every(a => a.done)));
    })();
    const totalAngles = tasks.reduce((a,t) => a + (t.shots || []).reduce((m,s) =>
      m + (s.angles || []).filter(x => x.done).length, 0), 0);

    const posted = clips.filter(c => c.state === 'posted').length;

    /* freezes come from the same computation the streak screen uses */
    let freezes = 0, frozen = 0;
    try {
      const cs = await Celebrate.computeStreak();
      freezes = cs.freezes;
      frozen = cs.saved.length;
    } catch(e){}

    let lessons = 0, coursesDone = 0;
    try {
      lessons = await Academy.totalDone();
      for(const c of Academy.COURSES){
        const p = await Academy.courseProgress(c.id);
        if(p.of && p.n >= p.of) coursesDone++;
      }
    } catch(e){}

    return { day, dayStreak, best, brokeThenFixed, freezes, frozen, lessons, coursesDone,
             workouts:sessions.length, workoutStreak:consecutive(dayKeys(sessions)),
             runs:runs.length, runStreak:consecutive(dayKeys(runs)), totalKm, longest,
             heaviest, posted, shotsToday, allShotsToday, totalAngles,
             tasksDone: tasks.filter(t => t.view === 'done').length };
  }

  /* ---- the rules ---- */
  const DEFS = [
    /* firsts */
    { id:'first-workout', tone:'first', title:'First session', line:'The hard part was starting.',
      req:'Finishing your first workout',
      when:f => f.workouts >= 1 },
    { id:'first-run', tone:'first', title:'First run logged', line:'Now there is a number to beat.',
      req:'Logging your first run',
      when:f => f.runs >= 1 },
    { id:'first-covered', tone:'first', title:'Fully covered', line:'Every planned angle, in the can.',
      req:'Capturing every planned angle in a day',
      when:f => f.allShotsToday },
    { id:'first-post', tone:'first', title:'First one published', line:'It exists outside your head now.',
      req:'Publishing your first piece',
      when:f => f.posted >= 1 },

    /* streaks — days */
    { id:'streak-3', tone:'streak', title:'Three in a row', line:'Long enough to feel deliberate.',
      req:'Three perfect days in a row',
      when:f => f.dayStreak >= 3 },
    { id:'streak-7', tone:'streak', title:'A full week', line:'Seven perfect days.',
      req:'Seven perfect days in a row',
      when:f => f.dayStreak >= 7 },
    { id:'streak-30', tone:'streak', title:'Thirty days', line:'This is who you are now.',
      req:'Thirty perfect days in a row',
      when:f => f.dayStreak >= 30 },
    { id:'streak-100', tone:'streak', title:'One hundred days', line:'Most people never see this screen.',
      req:'One hundred perfect days in a row',
      when:f => f.dayStreak >= 100 },

    /* streaks — training */
    { id:'workout-streak-3', tone:'streak', title:'Three sessions running', line:'Momentum, not motivation.',
      req:'Training three days in a row',
      when:f => f.workoutStreak >= 3 },
    { id:'workout-streak-7', tone:'streak', title:'Seven days training', line:'A week without a gap.',
      req:'Training seven days in a row',
      when:f => f.workoutStreak >= 7 },
    { id:'run-streak-5', tone:'streak', title:'Five days running', line:'Legs are starting to agree.',
      req:'Running five days in a row',
      when:f => f.runStreak >= 5 },

    /* counts */
    { id:'workouts-10', tone:'count', title:'Ten sessions', line:'Ten is a habit forming.',
      req:'Finishing ten workouts',
      when:f => f.workouts >= 10 },
    { id:'workouts-50', tone:'count', title:'Fifty sessions', line:'That is a season of work.',
      req:'Finishing fifty workouts',
      when:f => f.workouts >= 50 },
    { id:'workouts-100', tone:'count', title:'One hundred sessions', line:'Different body, same person.',
      req:'Finishing one hundred workouts',
      when:f => f.workouts >= 100 },
    { id:'km-50', tone:'count', title:'50 km run', line:'Fifty kilometres under your feet.',
      req:'Running fifty kilometres in total',
      when:f => f.totalKm >= 50 },
    { id:'km-100', tone:'count', title:'100 km run', line:'Triple figures.',
      req:'Running one hundred kilometres in total',
      when:f => f.totalKm >= 100 },
    { id:'posted-25', tone:'count', title:'25 published', line:'A body of work.',
      req:'Publishing twenty-five pieces',
      when:f => f.posted >= 25 },
    { id:'angles-1000', tone:'count', title:'1000 angles captured', line:'You have shot a lot of footage.',
      req:'Capturing one thousand angles',
      when:f => f.totalAngles >= 1000 },

    /* records and the day itself */
    { id:'shots-20-day', tone:'record', title:'Twenty in a day', line:'A heavy shoot day.',
      req:'Capturing twenty shots in a single day',
      when:f => f.shotsToday >= 20 },
    { id:'run-10k', tone:'record', title:'Ten kilometres', line:'One run, ten kilometres.',
      req:'Running ten kilometres in one go',
      when:f => f.longest >= 10 },

    { id:'freeze-banked', tone:'record', title:'Freeze banked', line:'A week held straight. That buys you one bad day.',
      req:'Banking a streak freeze',
      when:f => f.freezes >= 1 },
    { id:'freeze-used', tone:'comeback', title:'Saved by a freeze', line:'You missed a day and the streak survived. Use the reprieve.',
      req:'Coming back after a freeze saved the streak',
      when:f => f.frozen >= 1, repeatable:true },

    { id:'first-lesson', tone:'first', title:'Opened a book', line:'One chapter read. The trying is the part that counts.',
      req:'Reading your first chapter',
      when:f => f.lessons >= 1 },
    { id:'course-done', tone:'count', title:'Course finished', line:'A whole course read through. Now go use it.',
      req:'Finishing a whole course',
      when:f => f.coursesDone >= 1 },

    /* the one that matters most */
    { id:'comeback', tone:'comeback', title:'Back on it', line:'You broke a streak and came back the next day. That is the whole skill.',
      req:'Starting again after a day off',
      when:f => f.brokeThenFixed, repeatable:true }
  ];

  async function unlocked(){
    const { values } = await Store.all('awards');
    return values;
  }
  const byId = async () => {
    const list = await unlocked();
    return Object.fromEntries(list.map(a => [a.id, a]));
  };

  /* Returns anything that just became true. Records it, so it fires once. */
  async function check(opts){
    const cap = (opts && opts.cap) || 3;
    const [f, have, list] = await Promise.all([facts(), byId(), defs()]);

    /* Only read the metric snapshot if something actually needs it. */
    let snap = null;
    const needsSnap = list.some(d => d.rule && d.rule.metric);
    if(needsSnap){ try { snap = await Metrics.snapshot(); } catch(e){ snap = null; } }

    const fresh = [];
    for(const d of list){
      let ok = false;
      /* A rule you picked is a descriptor — metric, threshold — evaluated
         against the same history everything else reads. A built-in still has
         its own function. Neither can throw its way into unlocking. */
      try {
        ok = d.rule && d.rule.metric
          ? (snap ? Metrics.met(snap, d.rule) : false)
          : (typeof d.when === 'function' ? !!d.when(f) : false);
      } catch(e){ ok = false; }
      if(!ok) continue;
      const prior = have[d.id];
      if(prior && !d.repeatable) continue;
      if(prior && d.repeatable){
        const sameDay = new Date(prior.at).toDateString() === new Date().toDateString();
        if(sameDay) continue;
      }
      const rec = { id:d.id, at:Date.now(), title:d.title, line:d.line, tone:d.tone, req:d.req };
      await Store.put('awards', rec);
      fresh.push(rec);
    }
    /* Adding several rules you had already met would otherwise queue a card and
       a chime for each. The rest are unlocked and on the wall either way. */
    return fresh.length > cap
      ? fresh.slice(0, cap).concat([{ id:'__more', at:Date.now(), tone:'count',
          title:`and ${fresh.length - cap} more`,
          line:'They are all on the wall.', req:'Catching up on what you had already earned' }])
      : fresh;
  }

  /* The shipped set plus your own, with your edits layered over the built-ins —
     the same shape the task library uses, so a built-in can be re-worded or
     hidden without losing the rule behind it. */
  async function defs(){
    let mine = {};
    try { mine = await Store.allMap('award-def'); } catch(e){ mine = {}; }

    const out = [];
    DEFS.forEach(d => {
      const e = mine[d.id];
      if(e && e.hidden) return;
      out.push({ ...d, ...(e || {}), builtin:true });
    });
    Object.values(mine).forEach(e => {
      if(e.hidden || DEFS.some(d => d.id === e.id)) return;
      /* one of yours: it has no rule, so it unlocks when you say it has */
      out.push({ tone:'first', ...e, builtin:false, when:() => false });
    });
    return out;
  }

  async function all(){
    const [have, list] = await Promise.all([byId(), defs()]);
    return list.map(d => ({ ...d, got:have[d.id] || null }));
  }

  async function saveDef(rec){
    const r = { ...rec };
    delete r.when; delete r.got; delete r.builtin;
    if(!r.id) r.id = 'aw_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
    await Store.put('award-def', r);
    return r;
  }
  async function removeDef(rec){
    if(rec.builtin) await Store.put('award-def', { id:rec.id, hidden:true });
    else {
      await Store.del('award-def', rec.id);
      await Store.del('awards', rec.id).catch(() => {});
    }
  }

  /* one of your own, unlocked by hand */
  async function grant(def){
    const rec = { id:def.id, at:Date.now(), title:def.title, line:def.line,
                  tone:def.tone, req:def.req };
    await Store.put('awards', rec);
    return rec;
  }
  async function revoke(id){ await Store.del('awards', id); }

  global.Awards = { check, all, facts, unlocked, TONE, DEFS,
                    defs, saveDef, removeDef, grant, revoke };
})(window);
