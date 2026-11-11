/* Metrics — every number the app can prove about you, derived from what is
   already stored.

   Achievements and ratings both ask questions like "how many perfect days" or
   "best bench at four reps". Rather than each inventing its own arithmetic,
   both read from here, which means a rule you write can only ever refer to
   something the app can actually measure.

   Everything is computed from history on demand. Nothing is watched, nothing is
   incremented — so a rule added today is judged against everything you have
   already done. */
(function(global){

  const DAY = 86400000;
  const midnight = ts => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };
  const dayKey = ts => midnight(ts);

  /* consecutive calendar days present in a set of timestamps */
  function runOfDays(keys){
    if(!keys.length) return { best:0, current:0 };
    const set = new Set(keys);
    const sorted = [...set].sort((a,b) => a - b);
    let best = 1, run = 1;
    for(let i = 1; i < sorted.length; i++){
      run = sorted[i] - sorted[i-1] === DAY ? run + 1 : 1;
      best = Math.max(best, run);
    }
    const today = midnight(Date.now());
    let current = 0;
    for(let d = set.has(today) ? today : today - DAY; set.has(d); d -= DAY) current++;
    return { best, current };
  }

  /* ---- the catalogue: what a rule is allowed to ask about ---- */
  const METRICS = [
    { key:'tasksDone',     label:'Tasks finished',            unit:'',        group:'Days', windowed:true },
    { key:'taskDone',      label:'A task of mine, completed',  unit:'times',   group:'Days',
      needsMatch:true, windowed:true },
    { key:'perfectDays',   label:'Perfect days',              unit:'days',    group:'Days' },
    { key:'perfectStreak', label:'Perfect days in a row now', unit:'days',    group:'Days' },
    { key:'perfectBest',   label:'Longest perfect streak',    unit:'days',    group:'Days' },
    { key:'activeDays',    label:'Days with anything logged', unit:'days',    group:'Days' },

    { key:'workouts',      label:'Workouts finished',         unit:'',        group:'Body', windowed:true },
    { key:'workoutStreak', label:'Workout days in a row',     unit:'days',    group:'Body' },
    { key:'workoutBest',   label:'Longest training streak',   unit:'days',    group:'Body' },
    { key:'volumeKg',      label:'Total volume lifted',       unit:'kg',      group:'Body' },
    { key:'heaviest',      label:'Heaviest set, any lift',    unit:'kg',      group:'Body' },
    { key:'liftBest',      label:'Best weight on one lift',   unit:'kg',      group:'Body',
      needsLift:true, needsReps:true },

    { key:'runs',          label:'Runs logged',               unit:'',        group:'Runs', windowed:true },
    { key:'runStreak',     label:'Run days in a row',         unit:'days',    group:'Runs' },
    { key:'totalKm',       label:'Distance run in total',     unit:'km',      group:'Runs', windowed:true },
    { key:'runIn',         label:'Distance in one run under a time', unit:'km', group:'Runs',
      needsMins:true },
    { key:'longestRun',    label:'Longest single run',        unit:'km',      group:'Runs' },
    { key:'fastestPace',   label:'Best pace',                 unit:'min/km',  group:'Runs', lowerIsBetter:true },

    { key:'clipsPosted',   label:'Pieces published',          unit:'',        group:'Work', windowed:true },
    { key:'clipsCaptured', label:'Clips captured',            unit:'',        group:'Work' },
    { key:'angles',        label:'Angles captured',           unit:'',        group:'Work' },
    { key:'awards',        label:'Achievements unlocked',     unit:'',        group:'Days' },
    { key:'lessons',       label:'Chapters read',             unit:'',        group:'Mind' },
    { key:'coursesDone',   label:'Courses finished',          unit:'',        group:'Mind' },
    { key:'journalDays',   label:'Days journalled',           unit:'days',    group:'Mind' }
  ];

  const byKey = Object.fromEntries(METRICS.map(m => [m.key, m]));

  /* ---- reading it all ---- */

  async function snapshot(){
    const grab = async (store, fallback) => {
      try { const { values } = await Store.all(store); return values; }
      catch(e){ return fallback; }
    };
    const [tasks, sessions, runs, clips, journal, awards] = await Promise.all([
      (async () => { try { return await Data.tasks(); } catch(e){ return []; } })(),
      grab('sessions', []), grab('runs', []), 
      (async () => { try { return await Data.clips(); } catch(e){ return []; } })(),
      grab('journal', []), grab('awards', [])
    ]);

    /* perfect days: every task on that day ticked, and at least one task */
    const byDay = {};
    tasks.forEach(t => {
      const d = byDay[t.day] = byDay[t.day] || { total:0, done:0 };
      d.total++;
      if(t.view === 'done') d.done++;
    });
    const perfectList = Object.keys(byDay).map(Number)
      .filter(d => byDay[d].total && byDay[d].done >= byDay[d].total)
      .sort((a,b) => a - b);

    let perfectBest = 0, run = 0, prev = null;
    perfectList.forEach(d => { run = prev !== null && d === prev + 1 ? run + 1 : 1; prev = d;
      perfectBest = Math.max(perfectBest, run); });

    let today = 1;
    try { today = await Data.currentDay(); } catch(e){ today = 1; }
    let perfectStreak = 0;
    for(let d = today; d >= 1; d--){
      if(perfectList.includes(d)) perfectStreak++; else break;
    }

    const sessDays = sessions.map(s => dayKey(s.finishedAt || s.at || Date.now()));
    const runDays = runs.map(r => dayKey(r.finishedAt || r.at || Date.now()));
    const sRun = runOfDays(sessDays), rRun = runOfDays(runDays);

    const volumeKg = sessions.reduce((a, s) => a + (+s.volumeKg || 0), 0);
    const heaviest = sessions.reduce((a, s) => Math.max(a,
      (s.exercises || []).reduce((m, e) => Math.max(m,
        (e.sets || []).reduce((k, x) => Math.max(k, +x.kg || 0), 0)), 0)), 0);

    const totalKm = runs.reduce((a, r) => a + (+r.km || 0), 0);
    const longestRun = runs.reduce((a, r) => Math.max(a, +r.km || 0), 0);
    /* a run is stored as { km, sec } — reading a "mins" field that does not
       exist made every pace zero, and zero never beats a threshold */
    const mins = r => (+r.sec || 0) / 60 || +r.mins || 0;
    const paces = runs.filter(r => +r.km > 0 && mins(r) > 0).map(r => mins(r) / r.km);
    const fastestPace = paces.length ? Math.min(...paces) : 0;

    const angles = tasks.reduce((a, t) => a + (t.shots || []).reduce((m, s) =>
      m + (s.angles || []).filter(x => x.done).length, 0), 0);

    let lessons = 0, coursesDone = 0;
    try {
      lessons = await Academy.totalDone();
      for(const c of (Academy.COURSES || [])){
        const p = await Academy.courseProgress(c.id);
        if(p.of && p.n >= p.of) coursesDone++;
      }
    } catch(e){}

    const activeDays = new Set([
      ...perfectList,
      ...tasks.filter(t => t.view === 'done').map(t => t.day)
    ]).size;

    return {
      tasksDone: tasks.filter(t => t.view === 'done').length,
      perfectDays: perfectList.length,
      perfectStreak, perfectBest, activeDays,

      workouts: sessions.length, workoutStreak: sRun.current, workoutBest: sRun.best,
      volumeKg: Math.round(volumeKg), heaviest,

      runs: runs.length, runStreak: rRun.current, totalKm: Math.round(totalKm * 10) / 10,
      longestRun: Math.round(longestRun * 10) / 10,
      fastestPace: Math.round(fastestPace * 10) / 10,

      clipsPosted: clips.filter(c => c.state === 'posted').length,
      clipsCaptured: clips.length,
      angles, lessons, coursesDone,
      awards: awards.length,
      journalDays: journal.length,

      /* kept whole so per-lift, per-window and per-task questions can be answered */
      _sessions: sessions, _runs: runs, _tasks: tasks, _clips: clips, _today: today
    };
  }

  /* Best weight on one named lift at or above a rep count — the thing a plain
     "heaviest" number cannot answer. */
  function liftBest(snap, liftName, minReps){
    const want = String(liftName || '').trim().toLowerCase();
    const reps = +minReps || 1;
    if(!want) return 0;
    return (snap._sessions || []).reduce((best, s) =>
      (s.exercises || []).reduce((b, e) => {
        if(!String(e.name || '').toLowerCase().includes(want)) return b;
        return (e.sets || []).reduce((k, x) =>
          (+x.reps || 0) >= reps ? Math.max(k, +x.kg || 0) : k, b);
      }, best), 0);
  }

  /* Was it done inside the last N days? Program days for tasks, real dates for
     everything with a timestamp. */
  const inWindow = (ts, days) => !days || ts >= midnight(Date.now()) - (days - 1) * DAY;

  /* Best distance covered in a single run at or under a time. "20 miles inside
     an hour" is this, not a pace — pace alone would pass on a fast 2km. */
  function runIn(snap, maxMins){
    const cap = +maxMins || 0;
    if(!cap) return 0;
    return (snap._runs || []).reduce((best, r) => {
      const m = (+r.sec || 0) / 60 || +r.mins || 0;
      return m > 0 && m <= cap ? Math.max(best, +r.km || 0) : best;
    }, 0);
  }

  /* How many times a task of yours was ticked off — matched on its title, so a
     plan or a task invented later can be scored without any new code here. */
  function taskDone(snap, match, days){
    const want = String(match || '').trim().toLowerCase();
    if(!want) return 0;
    const from = (snap._today || 1) - ((+days || 0) - 1);
    return (snap._tasks || []).filter(t =>
      t.view === 'done' &&
      String(t.title || '').toLowerCase().includes(want) &&
      (!days || t.day >= from)).length;
  }

  function valueOf(snap, rule){
    if(!rule || !rule.metric) return 0;
    const w = +rule.window || 0;

    if(rule.metric === 'liftBest') return liftBest(snap, rule.lift, rule.reps);
    if(rule.metric === 'runIn') return runIn(snap, rule.mins);
    if(rule.metric === 'taskDone') return taskDone(snap, rule.match, w);

    if(w){
      const from = (snap._today || 1) - (w - 1);
      switch(rule.metric){
        case 'tasksDone':
          return (snap._tasks || []).filter(t => t.view === 'done' && t.day >= from).length;
        case 'workouts':
          return (snap._sessions || []).filter(s => inWindow(s.finishedAt || s.at || 0, w)).length;
        case 'runs':
          return (snap._runs || []).filter(r => inWindow(r.finishedAt || r.at || 0, w)).length;
        case 'totalKm':
          return Math.round((snap._runs || []).filter(r => inWindow(r.finishedAt || r.at || 0, w))
            .reduce((a, r) => a + (+r.km || 0), 0) * 10) / 10;
        case 'clipsPosted':
          return (snap._clips || []).filter(c => c.state === 'posted' &&
            inWindow(c.postedAt || c.createdAt || 0, w)).length;
        default: break;
      }
    }
    const v = snap[rule.metric];
    return typeof v === 'number' ? v : 0;
  }

  /* A rule is met when the measured value passes the threshold. Lower-is-better
     metrics flip, so "pace under 5" reads the way you would say it. */
  function met(snap, rule){
    if(!rule || !rule.metric) return false;
    const m = byKey[rule.metric];
    const v = valueOf(snap, rule);
    const target = +rule.value || 0;
    if(m && m.lowerIsBetter) return v > 0 && v <= target;
    return v >= target;
  }

  const windowText = d => !d ? '' : d === 7 ? ' in a week' : d === 30 ? ' in a month'
    : d === 1 ? ' today' : ` in ${d} days`;

  /* what a rule reads as, in words */
  function describe(rule){
    if(!rule || !rule.metric) return '';
    const m = byKey[rule.metric];
    if(!m) return '';
    const unit = m.unit ? ' ' + m.unit : '';
    const win = windowText(+rule.window || 0);

    if(rule.metric === 'liftBest')
      return `${rule.lift || 'a lift'} at ${rule.value}${unit} for ${rule.reps || 1}+ reps`;
    if(rule.metric === 'runIn')
      return `${rule.value}${unit} in one run under ${rule.mins || 60} minutes`;
    if(rule.metric === 'taskDone')
      return `"${rule.match || 'a task'}" ${rule.value}${unit}${win || ' all time'}`;
    return m.lowerIsBetter
      ? `${m.label} under ${rule.value}${unit}${win}`
      : `${m.label}: ${rule.value}${unit}${win}`;
  }

  /* Points that grow with how far past the threshold you are: every `per` above
     it is worth `points` more, up to `max`. A 140kg bench and a 190kg bench
     should not be worth the same. */
  function bonus(snap, rule){
    const sc = rule && rule.scale;
    if(!sc || !sc.per || !met(snap, rule)) return 0;
    const over = valueOf(snap, rule) - (+rule.value || 0);
    if(over <= 0) return 0;
    const steps = Math.floor(over / +sc.per);
    return Math.min(+sc.max || Infinity, steps * (+sc.points || 0));
  }

  global.Metrics = { METRICS, byKey, snapshot, valueOf, met, describe, bonus,
                     liftBest, runIn, taskDone, runOfDays, windowText };
})(window);
