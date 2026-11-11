/* Domain layer: seeding, cross-tab queries, and the derived weekly numbers.
   Views read from here rather than owning their own arrays. */
(function(global){
  const pad = n => String(n).padStart(2,'0');
  const DAY = 86400000;
  const now = () => Date.now();
  const daysAgo = n => now() - n * DAY;

  const SEED_SERIES = [
    { id:'shop-build-diaries', title:"Shop Build Diaries", cadence:"Weekly",   total:12, state:"live",
      nextDrop: now() + 2 * DAY, active:true },
    { id:'rack-and-stack',     title:"Rack & Stack",       cadence:"Biweekly", total:8,  state:"live",  nextDrop: now() + 9 * DAY },
    { id:'pool-deck-rebuild',  title:"Pool Deck Rebuild",  cadence:"Monthly",  total:6,  state:"draft", nextDrop: null },
    { id:'homelab-teardowns',  title:"Homelab Teardowns",  cadence:"Weekly",   total:9,  state:"done",  nextDrop: null }
  ];

  const SEED_CLIPS = [
    { id:'c1', title:"Rack teardown — cold open", plat:"youtube", dur:"0:42", seriesId:'homelab-teardowns',  state:"posted", pct:100, createdAt:daysAgo(1) },
    { id:'c2', title:"Deck demo timelapse",       plat:"shorts",  dur:"0:28", seriesId:'pool-deck-rebuild',  state:"queued", pct:70,  createdAt:daysAgo(2) },
    { id:'c3', title:"Bench top glue-up",         plat:"tiktok",  dur:"0:19", seriesId:'shop-build-diaries', state:"raw",    pct:25,  createdAt:daysAgo(2) },
    { id:'c4', title:"Cable management b-roll",   plat:"reels",   dur:"0:33", seriesId:'rack-and-stack',     state:"queued", pct:55,  createdAt:daysAgo(3) },
    { id:'c5', title:"Switch config walkthrough", plat:"youtube", dur:"4:07", seriesId:'rack-and-stack',     state:"posted", pct:100, createdAt:daysAgo(4) },
    { id:'c6', title:"Sunset patio wide",         plat:"shorts",  dur:"0:12", seriesId:'pool-deck-rebuild',  state:"raw",    pct:10,  createdAt:daysAgo(5) },
    { id:'c7', title:"First cut — ep 7",          plat:"youtube", dur:"8:12", seriesId:'shop-build-diaries', state:"posted", pct:100, createdAt:daysAgo(6) }
  ];

  const DEFAULT_TARGETS = { clips:20, edits:8 };
  /* Day 1 is a real date and the count runs on forever from there. */
  const DEFAULT_PROGRAM = { start: new Date(new Date().getFullYear(), 9, 1).getTime() };

  const cache = { series:null, clips:null, tasks:null, sessions:null, targets:null, program:null };

  async function series(){
    if(!cache.series){ const { values } = await Store.all('series'); cache.series = values; }
    return cache.series;
  }
  async function clips(){
    if(!cache.clips){
      const { values } = await Store.all('clips');
      /* Upgraded as they are read, not rewritten on disk — an install that has
         not been opened in a month still makes sense on the first load. */
      cache.clips = global.Lifecycle ? values.map(Lifecycle.fromClip) : values;
    }
    return cache.clips;
  }
  /* Sample content is something you ask for, not something you inherit. */
  async function loadSamples(){
    for(const r of SEED_SERIES) await Store.put('series', r);
    for(const r of SEED_CLIPS)  await Store.put('clips', r);
    invalidate();
  }
  async function tasks(){
    if(!cache.tasks){ const { values } = await Store.all('tasks'); cache.tasks = values; }
    return cache.tasks;
  }
  async function sessions(){
    if(!cache.sessions){
      const { values } = await Store.all('sessions');
      cache.sessions = values.sort((a,b) => b.finishedAt - a.finishedAt);
    }
    return cache.sessions;
  }
  async function targets(){
    if(!cache.targets){
      const stored = await Store.get('settings','weekly-targets');
      cache.targets = stored || DEFAULT_TARGETS;
    }
    return cache.targets;
  }
  async function setTargets(t){
    cache.targets = t;
    await Store.put('settings', t, 'weekly-targets');
  }
  /* Bumped on every invalidate. The shell compares it across a pushed screen to
     know whether the view underneath is now out of date. */
  let stamp = 0;
  function invalidate(k){
    k ? cache[k] = null : Object.keys(cache).forEach(x => cache[x] = null);
    stamp++;
  }
  const version = () => stamp;

  /* ---- the program clock: what turns "Day 3" into a real date ---- */
  const midnight = ts => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };

  /* Adding 86,400,000ms is not adding a day. Across a daylight saving change the
     two drift by an hour, which was enough to make a finished task stop matching
     the day it belongs to and vanish out of the activity grid. Calendar
     arithmetic instead, and rounding when measuring a gap. */
  function addDays(ts, n){
    const d = new Date(ts);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + n);
    return d.getTime();
  }
  const daysBetween = (a, b) => Math.round((midnight(b) - midnight(a)) / DAY);

  async function program(){
    if(!cache.program){
      const stored = await Store.get('settings','program');
      if(stored && stored.start) cache.program = stored;
      else {
        cache.program = { ...DEFAULT_PROGRAM };
        await Store.put('settings', cache.program, 'program');
      }
    }
    return cache.program;
  }
  async function setProgram(p){
    cache.program = { ...(cache.program || DEFAULT_PROGRAM), ...p };
    await Store.put('settings', cache.program, 'program');
    return cache.program;
  }
  async function dayToDate(n){
    const p = await program();
    return addDays(p.start, n - 1);
  }
  async function dateToDay(ts){
    const p = await program();
    return daysBetween(p.start, ts) + 1;
  }
  async function currentDay(){
    /* No clamp either way. Before day one the count is negative, which is what
       the practice weeks are — clamping to 1 meant a task scheduled in week -1
       never appeared on the day it was for, because "today" claimed to be day 1
       the whole time. The count is continuous in both directions. */
    return await dateToDay(Date.now());
  }
  const weekOf = n => Math.ceil(n / 7);

  /* ---- before Day 1: the run-up has a name of its own ----

     currentDay() above is already unclamped, so the app can already sit on a
     day 0 or a negative one. What was missing is a NAME for that stretch —
     "Prep", "Red phase", "Q1 prep" — and one place that labels a day, so the
     day sheet, the profile and the shot list all say the same thing. */
  const DEFAULT_PRE = 'Prep';

  /* A compatibility alias. Nothing in this app calls it — currentDay() is
     already unclamped and is what the screens use — but v2 screens and the
     laptop Planner call Data.todayDay(), so anything ported in from either
     keeps working instead of failing on a missing function. */
  async function todayDay(){ return currentDay(); }

  async function phaseOf(n){
    if(n >= 1) return { pre:false, name:null, toGo:0 };
    const p = await program();
    return { pre:true, name:(p.preName || DEFAULT_PRE).trim() || DEFAULT_PRE, toGo: 1 - n };
  }

  /* "Day 12 · week 2", or "Prep · 4 days to Day 1" */
  async function dayLabel(n){
    const ph = await phaseOf(n);
    return ph.pre
      ? `${ph.name} · ${ph.toGo} day${ph.toGo === 1 ? '' : 's'} to Day 1`
      : `Day ${n} · week ${weekOf(n)}`;
  }

  /* Move Day 1 without moving anything on the calendar.

     Everything is stored by program day and week number, so a new start date
     on its own slides every task, beat and milestone to a different real date.
     This shifts the numbers by the same amount the start moved, so a shoot
     planned for Saturday Oct 10 is still on Saturday Oct 10 afterwards. */
  async function moveStart(newStart, preName){
    const p = await program();
    const days  = Math.round((midnight(newStart) - midnight(p.start)) / DAY);
    const weeks = Math.round((sundayOf(newStart) - sundayOf(p.start)) / (7 * DAY));
    const shiftDay  = d => typeof d === 'number' ? d - days  : d;
    const shiftWeek = w => typeof w === 'number' ? w - weeks : w;
    const moved = { tasks:0, beats:0, episodes:0, challenges:0, plans:0, videos:0 };

    if(days){
      const { values: ts } = await Store.all('tasks');
      for(const t of ts){
        if(typeof t.day !== 'number') continue;
        await Store.put('tasks', { ...t, day: shiftDay(t.day) }); moved.tasks++;
      }
      const { values: vs } = await Store.all('vlogs').catch(() => ({ values:[] }));
      for(const v of vs){
        const nv = { ...v, week: shiftWeek(v.week),
          acts: (v.acts || []).map(a => ({ ...a, day: shiftDay(a.day),
            beats: (a.beats || []).map(b => {
              if(typeof b.day === 'number') moved.beats++;
              return { ...b, day: shiftDay(b.day) };
            }) })) };
        await Store.put('vlogs', nv); moved.episodes++;
      }
      /* program plans: the day week one begins, and days tapped on or off by hand */
      const { values: ps } = await Store.all('plans').catch(() => ({ values:[] }));
      for(const pl of ps){
        await Store.put('plans', { ...pl, startDay: shiftDay(pl.startDay),
          add: (pl.add || []).map(shiftDay), skip: (pl.skip || []).map(shiftDay) });
        moved.plans++;
      }
      /* one-off videos sit on a program day too */
      const { values: vds } = await Store.all('videos').catch(() => ({ values:[] }));
      for(const v of vds){
        if(typeof v.day !== 'number') continue;
        await Store.put('videos', { ...v, day: shiftDay(v.day) }); moved.videos++;
      }
    }
    if(weeks){
      const { values: cs } = await Store.all('challenges').catch(() => ({ values:[] }));
      for(const c of cs){
        await Store.put('challenges', { ...c,
          fromWeek: shiftWeek(c.fromWeek), toWeek: shiftWeek(c.toWeek),
          milestones: (c.milestones || []).map(m => ({ ...m, week: shiftWeek(m.week) })) });
        moved.challenges++;
      }
      if(global.Challenges && Challenges.invalidate) Challenges.invalidate();
    }

    const next = { start: midnight(newStart) };
    if(preName !== undefined) next.preName = String(preName || '').trim() || DEFAULT_PRE;
    await setProgram(next);
    invalidate();
    return { ...moved, days };
  }

  /* ---- weeks run Sunday to Saturday, and an episode is a week ---- */
  function sundayOf(ts){
    const d = new Date(ts);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - d.getDay());     /* 0 = Sunday */
    return d.getTime();
  }
  async function weekOne(){
    const p = await program();
    return sundayOf(p.start);                /* week 1 is the week the program starts in */
  }
  async function weekNumber(ts){
    const base = await weekOne();
    return Math.floor(daysBetween(base, sundayOf(ts || Date.now())) / 7) + 1;
  }
  async function weekStartOf(n){
    const base = await weekOne();
    return addDays(base, (n - 1) * 7);
  }
  async function weekDates(n){
    const from = await weekStartOf(n);
    const to = addDays(from, 6);
    return { from, to,
      label: `${new Date(from).toLocaleDateString(undefined,{ month:'short', day:'numeric' })} – ${
        new Date(to).toLocaleDateString(undefined,{ month:'short', day:'numeric' })}` };
  }
  /* an episode belongs to the month its FIRST day falls in */
  async function monthOfWeek(n){
    const d = new Date(await weekStartOf(n));
    return { key:`${d.getFullYear()}-${pad(d.getMonth()+1)}`,
             label:d.toLocaleDateString(undefined,{ month:'long', year:'numeric' }) };
  }
  const currentWeek = () => weekNumber(Date.now());

  /* ---- cross-tab joins ---- */
  async function seriesWithProgress(){
    const [s, c] = await Promise.all([series(), clips()]);
    return s.map(x => {
      const mine = c.filter(cl => cl.seriesId === x.id);
      const done = mine.filter(cl => cl.state === 'posted').length;
      /* where the run actually stands: shot but not cut, cut but not out */
      const raw = mine.filter(cl => cl.state === 'raw').length;
      const queued = mine.filter(cl => cl.state === 'queued').length;
      return { ...x, clips:mine.length, done, raw, queued,
               pct: x.total ? Math.round(done / x.total * 100) : 0 };
    });
  }
  async function clipsWithSeries(){
    const [s, c] = await Promise.all([series(), clips()]);
    const byId = Object.fromEntries(s.map(x => [x.id, x]));
    return c.map(cl => ({ ...cl, seriesName: byId[cl.seriesId] ? byId[cl.seriesId].title : 'Unassigned' }));
  }
  async function activeSeries(){
    const s = await seriesWithProgress();
    return s.find(x => x.active) || s.find(x => x.state === 'live') || s[0];
  }

  /* ---- weekly rollup, counted rather than invented ---- */
  function weekStart(d){
    const x = new Date(d || Date.now());
    x.setHours(0,0,0,0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
    return x.getTime();
  }
  /* Activity per day, so the heatmap and sparkline stop being decorative. */
  async function activity(daysBack){
    const [c, t, ws] = await Promise.all([clips(), tasks(), sessions()]);
    const p = await program();
    const key = ts => midnight(ts);
    const map = {};
    const bump = (ts, n) => { const k = key(ts); map[k] = (map[k] || 0) + n; };

    c.forEach(x => bump(x.createdAt, 1));
    ws.forEach(x => bump(x.finishedAt, 2));
    t.filter(x => x.view === 'done').forEach(x => {
      bump(addDays(p.start, x.day - 1), 1);
    });

    const out = [];
    const today = midnight(Date.now());
    for(let i = daysBack - 1; i >= 0; i--){
      const d = addDays(today, -i);
      out.push({ date:d, n: map[d] || 0 });
    }
    return out;
  }

  async function weekly(){
    const from = weekStart();
    const [c, t, ws, tg] = await Promise.all([clips(), tasks(), sessions(), targets()]);

    const wkClips = c.filter(x => x.createdAt >= from);
    const edits   = wkClips.filter(x => x.state !== 'raw').length;
    const posts   = wkClips.filter(x => x.state === 'posted').length;
    const doneTasks = t.filter(x => x.view === 'done');
    const shots   = t.reduce((n,x) => n + ((x.subs || []).filter(s => s.done).length), 0);
    const workouts = ws.filter(x => x.finishedAt >= from);
    const days = new Set([
      ...workouts.map(x => new Date(x.finishedAt).toDateString()),
      ...wkClips.map(x => new Date(x.createdAt).toDateString())
    ]).size;

    const spark = (await activity(7)).map(d =>
      c.filter(x => midnight(x.createdAt) === d.date).length);

    /* A suggestion is only worth showing once there is enough to see a pattern. */
    const logged = (await activity(14)).filter(d => d.n > 0).length;
    let suggestion = null;
    if(logged >= 6){
      const byDow = {};
      (await activity(28)).forEach(d => {
        const k = new Date(d.date).getDay();
        byDow[k] = (byDow[k] || 0) + d.n;
      });
      const best = Object.entries(byDow).sort((a,b) => b[1] - a[1])[0];
      const worst = Object.entries(byDow).sort((a,b) => a[1] - b[1])[0];
      const nm = i => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][i];
      suggestion = { title:`${nm(+best[0])} is your strongest day`,
                     body:`You log the most on ${nm(+best[0])} and the least on ${nm(+worst[0])}. Put the hard shoot on the strong day.` };
    }

    return {
      logged, spark, suggestion,
      profile:[
        { n:wkClips.length, l:'Clips' }, { n:shots, l:'Shots' }, { n:edits, l:'Edits' },
        { n:posts, l:'Posts' }, { n:days, l:'Days' }
      ],
      tasksDone: doneTasks.length,
      tasksTotal: t.length,
      workouts: workouts.length,
      volumeKg: workouts.reduce((v,x) => v + (x.volumeKg || 0), 0),
      targets:[
        { key:'clips', title:`Capture ${tg.clips} clips`, desc:'Raw footage logged to the library, across any series.',
          foot:'This week · capture', now:wkClips.length, goal:tg.clips },
        { key:'edits', title:`Finish ${tg.edits} edits`, desc:'Clips moved out of Raw and into the publish queue.',
          foot:'This week · edit', now:edits, goal:tg.edits }
      ]
    };
  }

  /* ---- writes ---- */
  const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

  async function saveSeries(rec){
    const r = { ...rec };
    if(!r.id) r.id = uid('s');
    if(r.active){
      const all = await series();
      for(const other of all){
        if(other.id !== r.id && other.active){ other.active = false; await Store.put('series', other); }
      }
    }
    await Store.put('series', r);
    invalidate('series');
    return r;
  }
  async function deleteSeries(id){
    const c = await clips();
    for(const cl of c.filter(x => x.seriesId === id)){
      cl.seriesId = null; await Store.put('clips', cl);
    }
    await Store.del('series', id);
    invalidate('series'); invalidate('clips');
  }

  const PCT_FOR = { raw:25, queued:70, posted:100 };
  async function saveClip(rec){
    /* keeps `state` in step with `stage`, so the publish queue and the month
       calendar carry on reading what they always read */
    if(global.Lifecycle) rec = Lifecycle.normalise(rec);
    const r = { ...rec };
    if(!r.id){ r.id = uid('c'); r.createdAt = Date.now(); }
    if(r.pct === undefined || r.pct === null) r.pct = PCT_FOR[r.state] ?? 0;
    await Store.put('clips', r);
    invalidate('clips');
    return r;
  }
  async function deleteClip(id){ await Store.del('clips', id); invalidate('clips'); }

  global.Data = { series, clips, tasks, sessions, targets, setTargets, invalidate, loadSamples,
                  SEED_SERIES, SEED_CLIPS,
                  program, setProgram, dayToDate, dateToDay, currentDay, weekOf,
                  todayDay, phaseOf, dayLabel, moveStart,
                  weekNumber, weekStartOf, weekDates, monthOfWeek, currentWeek, sundayOf,
                  seriesWithProgress, clipsWithSeries, activeSeries, weekly, weekStart, activity, version,
                  saveSeries, deleteSeries, saveClip, deleteClip, PCT_FOR };
})(window);
