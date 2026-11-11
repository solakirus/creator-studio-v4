/* Program — recurring, goal-oriented tasks that get harder on a schedule.

   A plan is a rule. The days you actually tick are ordinary tasks generated
   from it, exactly like the rest of the planner, so nothing downstream — the
   streak, the timeline, swipe to done — needs to know a plan exists.

   Everything here is pure: give it a plan and a way to turn a program day into
   a weekday and it tells you what the run looks like. No storage, no DOM. */
(function(global){

  /* One step of progression, taken every `everyWeeks` weeks. Frequency steps in
     whole days; amount steps as a share of where it started. The three-week
     interval is the same one progressive overload already uses for lifts. */
  const FREQ_STEP = { none:0, gradual:1, aggressive:2 };
  const AMT_STEP  = { none:0, gradual:0.10, aggressive:0.20 };
  const DEFAULT_EVERY = 3;

  const MODES = ['none', 'gradual', 'aggressive'];

  function blank(){
    return {
      id:null, title:'', icon:null, kind:null,
      days:[1,3,5],            // weekdays it starts on, 0 = Sunday
      startDay:1,              // the program day week one begins on
      weeks:10,                // 0 means it runs until you end it
      pri:'med',               // difficulty, shown on the card next to the frequency
      amount:null,             // { value, unit } — null means you just tick it
      freqRamp:{ mode:'none', everyWeeks:DEFAULT_EVERY, max:5 },
      amountRamp:{ mode:'none', everyWeeks:DEFAULT_EVERY, max:null },
      add:[], skip:[],         // days you tapped on or off by hand
      ended:false
    };
  }

  /* Which progression step a week sits on. Weeks 0-2 are step 0, 3-5 step 1. */
  function stepAt(ramp, wk){
    const every = Math.max(1, (ramp && ramp.everyWeeks) || DEFAULT_EVERY);
    return Math.floor(wk / every);
  }

  /* The longest run of back-to-back days in a week, counted round the corner so
     Saturday into Sunday counts as consecutive. */
  function longestRun(days){
    if(days.length >= 7) return 7;
    const have = new Set(days);
    let best = 0;
    for(let start = 0; start < 7; start++){
      if(have.has((start + 6) % 7)) continue;   // only measure from a run's first day
      let n = 0;
      while(n < 7 && have.has((start + n) % 7)) n++;
      best = Math.max(best, n);
    }
    return best;
  }

  /* Add the weekday that sits furthest from the ones already picked, so going
     from three days to four spreads out instead of clumping onto the weekend.

     Ties are common — adding Tuesday or Saturday to Mon/Wed/Fri/Sun both leave a
     one-day gap — so the tie is broken by whichever leaves the shorter run of
     consecutive days. Four in a row is harder to keep than four spread out. */
  function widestGap(days){
    const have = new Set(days);
    let best = null, bestScore = null;
    for(let d = 0; d < 7; d++){
      if(have.has(d)) continue;
      let gap = 7;
      have.forEach(h => {
        const raw = Math.abs(h - d);
        gap = Math.min(gap, Math.min(raw, 7 - raw));
      });
      const score = [gap, -longestRun(days.concat(d))];
      if(!bestScore || score[0] > bestScore[0] ||
        (score[0] === bestScore[0] && score[1] > bestScore[1])){
        bestScore = score; best = d;
      }
    }
    return best;
  }

  /* How many times a week runs, once the frequency ramp has been applied. */
  function perWeek(plan, wk){
    const base = (plan.days || []).length;
    const ramp = plan.freqRamp || {};
    const cap = Math.min(7, ramp.max || base);
    const grown = base + FREQ_STEP[ramp.mode || 'none'] * stepAt(ramp, wk);
    return Math.max(1, Math.min(grown, Math.max(base, cap)));
  }

  /* The weekdays that week uses — the starting set, widened as it ramps. */
  function daysForWeek(plan, wk){
    const days = (plan.days || []).slice().sort((a,b) => a - b);
    const want = perWeek(plan, wk);
    while(days.length < want && days.length < 7){
      const d = widestGap(days);
      if(d === null) break;
      days.push(d);
      days.sort((a,b) => a - b);
    }
    return days;
  }

  /* What one go is worth that week, once the amount ramp has been applied. */
  function amountForWeek(plan, wk){
    if(!plan.amount) return null;
    const base = +plan.amount.value || 0;
    const ramp = plan.amountRamp || {};
    const grown = base * (1 + AMT_STEP[ramp.mode || 'none'] * stepAt(ramp, wk));
    const cap = ramp.max == null ? Infinity : +ramp.max;
    const v = Math.min(grown, Math.max(base, cap));
    return { value: Math.round(v * 100) / 100, unit: plan.amount.unit || '' };
  }

  /* "Daily" reads better than "7×/week", and it is what the card says. */
  function freqLabel(n){ return n >= 7 ? 'Daily' : n + '\u00d7/week'; }

  function amountLabel(a){
    if(!a) return '';
    const v = a.value % 1 === 0 ? String(a.value) : a.value.toFixed(1).replace(/\.0$/, '');
    return a.unit ? v + a.unit : v;
  }

  /* Every dated occurrence of the plan.

     `dowOf(day)` turns a program day into a weekday, which only the caller
     knows, since it depends on when the program started. `weeks:0` runs open
     ended, so a horizon is required to stop it. */
  function expand(plan, opts){
    const o = opts || {};
    const dowOf = o.dowOf;
    if(typeof dowOf !== 'function') throw new Error('expand needs dowOf(day)');

    const start = plan.startDay || 1;
    const runWeeks = plan.weeks > 0 ? plan.weeks
      : Math.max(1, Math.ceil(((o.horizon || start + 364) - start + 1) / 7));

    const skip = new Set(plan.skip || []);
    const extra = new Set(plan.add || []);
    const out = [];

    for(let wk = 0; wk < runWeeks; wk++){
      const days = daysForWeek(plan, wk);
      const amount = amountForWeek(plan, wk);
      for(let i = 0; i < 7; i++){
        const day = start + wk * 7 + i;
        if(o.horizon && day > o.horizon) break;
        const on = days.includes(dowOf(day)) || extra.has(day);
        if(!on || skip.has(day)) continue;
        out.push({ day, week:wk, dow:dowOf(day), amount, perWeek:days.length });
      }
    }
    return out;
  }

  /* A week-by-week summary, which is what the plan preview strip shows. */
  function preview(plan, opts){
    const runWeeks = plan.weeks > 0 ? plan.weeks : 12;
    const rows = [];
    for(let wk = 0; wk < runWeeks; wk++){
      const days = daysForWeek(plan, wk);
      rows.push({
        week: wk,
        perWeek: days.length,
        days,
        freq: freqLabel(days.length),
        amount: amountForWeek(plan, wk)
      });
    }
    return rows;
  }

  /* What to write and what to drop so the tasks match the plan.

     Only the future moves. Anything already done or skipped is history and is
     left exactly where it is, which is what keeps an edit from quietly
     rewriting a streak. */
  function diff(plan, tasks, fromDay, opts){
    /* Program plans tag their tasks with planId; the planner's own repeats use
       a series key. Same arithmetic either way, so the field is a parameter. */
    const key = (opts && opts.key) || 'planId';
    const mine = (tasks || []).filter(t => t[key] === plan.id);
    const past = mine.filter(t => t.day < fromDay || t.view === 'done' || t.view === 'skipped');
    const futureTodo = mine.filter(t => t.day >= fromDay && t.view !== 'done' && t.view !== 'skipped');

    const wanted = plan.ended ? [] : expand(plan, opts).filter(e => e.day >= fromDay);
    const heldDays = new Set(past.map(t => t.day));
    const haveDay = new Map(futureTodo.map(t => [t.day, t]));

    const create = wanted
      .filter(e => !haveDay.has(e.day) && !heldDays.has(e.day))
      .map(e => ({
        day: e.day, week: e.week, key, planId: plan.id, title: plan.title,
        cad: freqLabel(e.perWeek),
        prog: e.amount ? '0 / ' + amountLabel(e.amount) : ''
      }));

    const wantDays = new Set(wanted.map(e => e.day));
    const remove = futureTodo.filter(t => !wantDays.has(t.day)).map(t => t.id);

    /* a day that stays but whose frequency or target moved needs relabelling */
    const update = wanted
      .filter(e => haveDay.has(e.day))
      .map(e => {
        const t = haveDay.get(e.day);
        const cad = freqLabel(e.perWeek);
        const prog = e.amount ? '0 / ' + amountLabel(e.amount) : '';
        return (t.cad === cad && (t.prog || '') === prog) ? null : { id:t.id, cad, prog };
      })
      .filter(Boolean);

    return { create, remove, update, kept: past.length };
  }

  global.Program = {
    blank, perWeek, daysForWeek, amountForWeek, freqLabel, amountLabel,
    expand, preview, diff, widestGap, longestRun, stepAt,
    MODES, FREQ_STEP, AMT_STEP, DEFAULT_EVERY
  };
})(window);
