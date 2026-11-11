/* Levels. Earned by doing the work repeatedly, not by spending time in the app —
   so the number means something when you look at it in six months. */
(function(global){

  /* What counts, and for how much. Weighted so consistency beats volume:
     a perfect day is worth more than the tasks inside it. */
  const WEIGHTS = {
    task:      2,    // anything ticked off
    perfectDay:15,   // everything on the list, no skips
    session:   8,    // a workout finished
    run:       8,    // a run logged
    clipPosted:20,   // something actually published
    award:     25,   // an achievement unlocked
    lesson:    6,    // a lesson finished in the Academy
    /* the vlog challenge — set in Settings → Challenge XP, these are the defaults */
    habitDay:  10,   // a habit day logged on an episode
    weeklyWin: 50,   // an episode's week won
    monthlyWin:200   // a challenge month won
  };

  /* Each rank takes a little longer than the last. */
  const RANKS = [
    { n:'Rookie',     a:'#7A7268', b:'#4A443D' },
    { n:'Regular',    a:'#8A6A2F', b:'#5C4519' },
    { n:'Consistent', a:'#A6803A', b:'#6B5220' },
    { n:'Committed',  a:'#9AA3AD', b:'#5F6771' },
    { n:'Disciplined',a:'#B4BDC7', b:'#6F7883' },
    { n:'Relentless', a:'#D9A93F', b:'#8A6A1E' },
    { n:'Prolific',   a:'#F0C24A', b:'#9C7A22' },
    { n:'Veteran',    a:'#7FD8C9', b:'#2F7F72' },
    { n:'Machine',    a:'#8CC6F0', b:'#2E6C99' },
    { n:'Legend',     a:'#C89CF5', b:'#5B2E99' }
  ];

  /* Level n needs 100 * n^1.35 points in total — steep enough to mean something,
     shallow enough that level 20 is reachable. */
  const need = lvl => Math.round(100 * Math.pow(lvl, 1.35));
  const totalFor = lvl => {
    let t = 0;
    for(let i = 1; i < lvl; i++) t += need(i);
    return t;
  };

  async function points(){
    const [tasks, sessionsRes, runsRes, clips, awards] = await Promise.all([
      Data.tasks(), Store.all('sessions'), Store.all('runs'), Data.clips(), Store.all('awards')
    ]);
    let lessons = 0;
    try { lessons = await Academy.totalDone(); } catch(e){}

    const done = tasks.filter(t => t.view === 'done');
    const byDay = {};
    tasks.forEach(t => {
      const d = byDay[t.day] = byDay[t.day] || { total:0, done:0 };
      d.total++;
      if(t.view === 'done') d.done++;
    });
    const perfect = Object.values(byDay).filter(d => d.total && d.done >= d.total).length;
    const posted = clips.filter(c => c.state === 'posted').length;

    /* A missing weight used to turn one part into NaN, and NaN spreads: the
       total, the level, the progress bar and "x / y xp" all went with it.
       Scoring through here means an unweighted thing is worth nothing rather
       than poisoning the number. */
    const score = (n, w) => (Number(n) || 0) * (Number(w) || 0);

    /* the vlog challenge, worked out from the episodes and months */
    let ch = { habitDays:0, weeklyWins:0, monthlyWins:0 };
    if(global.Scoreboard){
      try {
        ch = await Scoreboard.counts();
        Object.assign(WEIGHTS, await Scoreboard.weights());   /* so the breakdown shows today's values */
      } catch(e){}
    }

    const parts = {
      task:       score(done.length, WEIGHTS.task),
      perfectDay: score(perfect, WEIGHTS.perfectDay),
      session:    score(sessionsRes.values.length, WEIGHTS.session),
      run:        score(runsRes.values.length, WEIGHTS.run),
      clipPosted: score(posted, WEIGHTS.clipPosted),
      award:      score(awards.values.length, WEIGHTS.award),
      lesson:     score(lessons, WEIGHTS.lesson),
      habitDay:   score(ch.habitDays, WEIGHTS.habitDay),
      weeklyWin:  score(ch.weeklyWins, WEIGHTS.weeklyWin),
      monthlyWin: score(ch.monthlyWins, WEIGHTS.monthlyWin)
    };
    const total = Object.values(parts).reduce((a,b) => a + b, 0);
    return { total, parts, counts:{
      tasks:done.length, perfect, sessions:sessionsRes.values.length,
      runs:runsRes.values.length, posted, awards:awards.values.length, lessons,
      habitDays:ch.habitDays, weeklyWins:ch.weeklyWins, monthlyWins:ch.monthlyWins } };
  }

  /* Where that total puts you. */
  async function state(){
    const p = await points();
    /* Your own thresholds if you set some in Settings — the total each level
       starts at — carrying on along the built-in curve's steps past the last
       one. None set, and this is exactly the curve it always was. */
    let custom = [];
    if(global.Scoreboard){ try { custom = await Scoreboard.thresholds(); } catch(e){ custom = []; } }
    const startOf = lvl => {
      if(!custom.length || lvl <= 1) return totalFor(lvl);
      if(lvl - 2 < custom.length) return custom[lvl - 2];
      const last = custom[custom.length - 1];
      let t = last;
      for(let i = custom.length + 1; i < lvl; i++) t += need(i);
      return t;
    };
    let lvl = 1;
    while(p.total >= startOf(lvl + 1)) lvl++;

    const floor = startOf(lvl);
    const ceiling = startOf(lvl + 1);
    const into = p.total - floor;
    const span = Math.max(1, ceiling - floor);   /* never divide by zero */
    const rank = RANKS[Math.min(RANKS.length - 1, Math.floor((lvl - 1) / 3))];

    return {
      level: lvl, rank, points: p.total, parts: p.parts, counts: p.counts,
      into, span, toNext: ceiling - p.total,
      pct: Math.max(0, Math.min(100, Math.round((into / span) * 100)))
    };
  }

  /* Did this action push us over a boundary? Called after anything that scores. */
  async function check(){
    const s = await state();
    const seen = (await Store.get('settings','level')) || 0;
    if(s.level > seen){
      await Store.put('settings', s.level, 'level');
      return s;                     /* something to celebrate */
    }
    if(!seen) await Store.put('settings', s.level, 'level');
    return null;
  }

  global.Levels = { state, check, points, RANKS, WEIGHTS, need, totalFor };
})(window);
