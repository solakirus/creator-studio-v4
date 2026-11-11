/* Habits — a year of dots, read from what you already do.

   A habit is not a second to-do list. It is a rule that watches something the
   app already records and fills a dot when it happens:

     own     — the habit puts its own small task on Today (Drink water)
     series  — a repeating task you already made (Film something)
     kind    — any finished task of a type: Workout, Shoot, Edit, Publish.
               For Workout, a finished workout session counts too, on the day
               you actually did it, so doing Thursday's Push on Wednesday still
               fills Wednesday.
     runs    — your run log

   A goal is either "on these days" (each of those days is a dot you can miss)
   or "N times a week" (only the count in each Sunday→Saturday week matters,
   so a day off is never a miss).

   Storage: one settings record per habit, key "habit:<id>". No new store and
   no database version bump, and Sync already carries settings records one key
   at a time, so two devices editing two different habits never collide.

   Everything below the storage block is plain functions over plain data, so
   tests/habits.test.js can run it in Node without a browser. */
(function(global){
  const PREFIX = 'habit:';
  const COLORS = ['#FB6900', '#E8A33D', '#F2C230', '#5BBE6A', '#22C7B8', '#4F9DF7', '#A855F7', '#E2564A'];
  const KINDS = { workout:'Workout', shoot:'Shoot', edit:'Edit', publish:'Publish' };
  const GROUPS = ['Content', 'Body', 'Mind', 'Home'];
  const DAY = 86400000;

  /* ------------------------------------------------ dates, local and calendar-true */
  const pad = n => String(n).padStart(2, '0');
  function midnight(ts){ const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function addDays(ts, n){ const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); }
  function keyOf(ts){ const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k){ const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d).getTime(); }
  const dowOf = k => new Date(fromKey(k)).getDay();
  /* the Sunday that starts the week holding this date */
  const weekKey = k => keyOf(addDays(fromKey(k), -dowOf(k)));

  /* "5 / 8 cups" → { a:5, b:8 }. Anything else is not an amount. */
  function amountOf(prog){
    const m = /^\s*([\d.]+)\s*\/\s*([\d.]+)/.exec(String(prog || ''));
    if(!m) return null;
    const a = +m[1], b = +m[2];
    return b > 0 ? { a, b } : null;
  }

  /* ------------------------------------------------ the record */
  function normalise(h){
    const src = h.source || {};
    const type = ['own', 'series', 'kind', 'runs'].includes(src.type) ? src.type : 'own';
    const per = h.per === 'week' ? 'week' : 'day';
    let days = Array.isArray(h.days) ? h.days.filter(d => d >= 0 && d <= 6) : [];
    if(!days.length) days = [0, 1, 2, 3, 4, 5, 6];
    return {
      id: h.id || ('hb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      name: String(h.name || '').trim() || 'Untitled habit',
      color: h.color || COLORS[0],
      group: GROUPS.includes(h.group) ? h.group : '',
      per,
      times: per === 'week' ? Math.min(7, Math.max(1, +h.times || 3)) : null,
      days: [...new Set(days)].sort(),
      source: {
        type,
        series: type === 'series' ? (src.series || null) : null,
        kind: type === 'kind' ? (KINDS[src.kind] ? src.kind : 'workout') : null,
        amount: type === 'own' && +src.amount > 0 ? +src.amount : null,
        unit: type === 'own' ? String(src.unit || '').trim() : ''
      },
      at: h.at || '',
      order: h.order == null ? Date.now() : h.order,
      createdKey: h.createdKey || keyOf(Date.now()),
      createdAt: h.createdAt || Date.now(),
      updatedAt: Date.now()
    };
  }

  /* ------------------------------------------------ storage */
  async function all(){
    let got;
    try { got = await Store.all('settings'); } catch(e){ return []; }
    const out = [];
    got.keys.forEach((k, i) => {
      const v = got.values[i];
      if(String(k).indexOf(PREFIX) === 0 && v && v.id) out.push(v);
    });
    return out.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  async function get(id){
    try { return (await Store.get('settings', PREFIX + id)) || null; } catch(e){ return null; }
  }
  async function save(h){
    const rec = normalise(h);
    await Store.put('settings', rec, PREFIX + rec.id);
    if(rec.source.type === 'own') await tidyOwnTasks(rec);
    if(global.Data) Data.invalidate('habits');
    return rec;
  }
  /* Removing a habit takes its own unticked future tasks with it. Ticked ones,
     and anything in the past, stay: that is history, not the habit. */
  async function remove(id){
    const h = await get(id);
    await Store.del('settings', PREFIX + id);
    if(h && h.source && h.source.type === 'own') await tidyOwnTasks(h, true);
    if(global.Data) Data.invalidate();
    return true;
  }

  /* ------------------------------------------------ own tasks, a week ahead at a time

     The habit does not write a year of tasks up front. It keeps the next seven
     days stocked, every time Today opens, so it never runs out and never
     floods the planner. The id is worked out from the habit and the day, so
     two devices topping up the same day make the same task, and Sync folds
     them into one instead of doubling it. */
  function ownTaskId(habitId, day){
    const h = (U && U.hash ? U.hash(String(habitId)) : 0) % 1000000;
    return Number('9' + String(h).padStart(6, '0') + String(day + 100000).padStart(6, '0'));
  }
  function ownTaskFor(h, day){
    const amount = h.source.amount;
    return {
      id: ownTaskId(h.id, day), day, title: h.name,
      cad: h.per === 'week' ? `${h.times}×/week` : (h.days.length === 7 ? 'Daily' : 'Habit'),
      pri: 'med', at: h.at || '', mins: 0,
      prog: amount ? (`0 / ${amount} ${h.source.unit || ''}`).trim() : '',
      subs: [], shots: [], view: 'todo',
      habitId: h.id, series: 'habit:' + h.id
    };
  }
  async function ensureTasks(fromDay, count){
    const habits = (await all()).filter(h => h.source && h.source.type === 'own');
    if(!habits.length) return 0;
    const tasks = await Data.tasks();
    const p = await Data.program();
    const have = new Set(tasks.filter(t => t.habitId).map(t => t.habitId + '@' + t.day));
    let made = 0;
    for(let i = 0; i < (count || 7); i++){
      const day = fromDay + i;
      const k = keyOf(addDays(p.start, day - 1));
      const dow = dowOf(k);
      for(const h of habits){
        if(k < h.createdKey) continue;
        if(!h.days.includes(dow)) continue;
        if(have.has(h.id + '@' + day)) continue;
        await Store.put('tasks', ownTaskFor(h, day));
        have.add(h.id + '@' + day);
        made++;
      }
    }
    if(made) Data.invalidate('tasks');
    return made;
  }
  /* After an edit: future unticked tasks follow the new name, amount and days. */
  async function tidyOwnTasks(h, removeAll){
    const tasks = await Data.tasks();
    const today = await Data.currentDay();
    const p = await Data.program();
    let n = 0;
    for(const t of tasks){
      if(t.habitId !== h.id || t.view !== 'todo' || t.day == null || t.day < today) continue;
      const dow = new Date(addDays(p.start, t.day - 1)).getDay();
      if(removeAll || !h.days.includes(dow)){ await Store.del('tasks', t.id); n++; continue; }
      const fresh = ownTaskFor(h, t.day);
      const was = amountOf(t.prog);
      const next = { ...t, title: h.name, cad: fresh.cad, at: t.at || fresh.at,
        prog: fresh.prog && was ? `${was.a} / ${h.source.amount} ${h.source.unit || ''}`.trim() : fresh.prog };
      await Store.put('tasks', next); n++;
    }
    if(n) Data.invalidate('tasks');
  }

  /* ------------------------------------------------ the facts, indexed by date */
  async function facts(){
    const [tasks, p] = await Promise.all([Data.tasks(), Data.program()]);
    let sessions = [], runs = [];
    try { sessions = (await Store.all('sessions')).values; } catch(e){}
    try { runs = (await Store.all('runs')).values; } catch(e){}
    return index({ tasks, sessions, runs, start: p.start });
  }
  function index(f){
    const byDate = {}, sessions = {}, runs = {};
    /* the first date each source has anything at all: before it, a linked habit
       has no history to judge, so those days are "before", not a year of misses */
    const first = {};
    const seen = (sig, k) => { if(!first[sig] || k < first[sig]) first[sig] = k; };
    (f.tasks || []).forEach(t => {
      if(t.day == null) return;                 /* day 0 is a real date; only null is "no day" */
      const k = keyOf(addDays(f.start, t.day - 1));
      (byDate[k] = byDate[k] || []).push(t);
      if(t.kind) seen('kind:' + t.kind, k);
      if(t.series) seen('series:' + t.series, k);
    });
    (f.sessions || []).forEach(s => { if(s && s.finishedAt){ const k = keyOf(s.finishedAt); sessions[k] = true; seen('kind:workout', k); } });
    (f.runs || []).forEach(r => { if(r && r.at){ const k = keyOf(r.at); runs[k] = true; seen('runs', k); } });
    return { byDate, sessions, runs, first, start: f.start };
  }

  /* ------------------------------------------------ one habit, one day

     done   — it happened
     part   — an amount was started but not finished (5 of 8 cups)
     miss   — a day it was due and it did not happen
     rest   — not due that day (a day off, or a weekly habit's quiet day)
     today  — due today and not done yet: not a miss until the day is over
     ahead  — still to come
     before — before an own-task habit existed, so there was nothing to tick */
  function linked(h, list){
    const s = h.source;
    if(s.type === 'own') return list.filter(t => t.habitId === h.id);
    if(s.type === 'series') return list.filter(t => t.series && t.series === s.series);
    if(s.type === 'kind') return list.filter(t => t.kind === s.kind);
    return [];
  }
  /* where a habit's history begins: an own task the day it was made; a linked
     one from the first record of what it watches, or the day it was made if
     that is earlier (or there is nothing yet) */
  function sinceOf(h, idx){
    const s = h.source;
    if(s.type === 'own') return h.createdKey;
    const sig = s.type === 'runs' ? 'runs' : s.type === 'series' ? 'series:' + s.series : 'kind:' + s.kind;
    const f = idx.first && idx.first[sig];
    return f && f < h.createdKey ? f : h.createdKey;
  }
  function dayStatus(h, k, idx, todayKey){
    if(k > todayKey) return 'ahead';
    if(k < sinceOf(h, idx)) return 'before';
    const list = linked(h, idx.byDate[k] || []);
    let done = list.some(t => t.view === 'done');
    if(h.source.type === 'kind' && h.source.kind === 'workout' && idx.sessions[k]) done = true;
    if(h.source.type === 'runs') done = !!idx.runs[k];
    if(done) return 'done';

    const part = list.some(t => { const a = amountOf(t.prog); return a && a.a > 0 && a.a < a.b; });
    const due = h.per === 'week' ? false
      : h.source.type === 'series' ? list.some(t => t.view !== 'skipped') || false
      : h.days.includes(dowOf(k));
    if(k === todayKey) return part ? 'part' : (due || h.per === 'week' ? 'today' : 'rest');
    if(part) return 'part';
    /* a series day with nothing scheduled is the series resting, not you missing */
    if(h.source.type === 'series') return list.length ? 'miss' : 'rest';
    return due ? 'miss' : 'rest';
  }

  /* ------------------------------------------------ a whole year, a week, a streak */
  function yearOf(h, year, idx, todayKey){
    const first = new Date(year, 0, 1).getTime();
    const lead = new Date(first).getDay();
    const len = Math.round((new Date(year + 1, 0, 1).getTime() - first) / DAY);
    const days = [];
    for(let i = 0; i < len; i++){
      const k = keyOf(addDays(first, i));
      days.push({ k, st: dayStatus(h, k, idx, todayKey) });
    }
    const cols = Math.ceil((lead + len) / 7);
    return { lead, len, cols, days };
  }
  /* how many times in the week holding k, and whether the goal was met */
  function weekCount(h, k, idx, todayKey){
    const start = fromKey(weekKey(k));
    let n = 0;
    for(let i = 0; i < 7; i++){
      const d = keyOf(addDays(start, i));
      if(dayStatus(h, d, idx, todayKey) === 'done') n++;
    }
    return n;
  }
  function weeksOf(h, year, idx, todayKey){
    /* every Sunday-starting week that touches this year */
    const first = new Date(year, 0, 1).getTime();
    const end = year + '-12-31', thisWeek = weekKey(todayKey), out = [];
    for(let s = addDays(first, -new Date(first).getDay()); keyOf(s) <= end; s = addDays(s, 7)){
      const k = keyOf(s), last = keyOf(addDays(s, 6));
      const n = h.per === 'week' ? weekCount(h, k, idx, todayKey) : 0;
      let state;
      if(k > todayKey) state = 'ahead';
      else if(k === thisWeek) state = n >= h.times ? 'hit' : 'now';
      else if(last < sinceOf(h, idx)) state = 'before';
      else state = n >= h.times ? 'hit' : 'miss';
      out.push({ k, n, state });
    }
    return out;
  }
  function streak(h, idx, todayKey){
    if(h.per === 'week'){
      let n = 0, s = fromKey(weekKey(todayKey));
      if(weekCount(h, keyOf(s), idx, todayKey) >= h.times) n++;
      s = addDays(s, -7);
      for(let guard = 0; guard < 520; guard++){
        if(weekCount(h, keyOf(s), idx, todayKey) >= h.times){ n++; s = addDays(s, -7); } else break;
      }
      return { n, unit: n === 1 ? 'week' : 'weeks' };
    }
    let n = 0, d = fromKey(todayKey);
    if(dayStatus(h, todayKey, idx, todayKey) === 'done') n++;
    d = addDays(d, -1);
    for(let guard = 0; guard < 3660; guard++){
      const st = dayStatus(h, keyOf(d), idx, todayKey);
      if(st === 'done'){ n++; d = addDays(d, -1); continue; }
      if(st === 'rest'){ d = addDays(d, -1); continue; }
      break;
    }
    return { n, unit: n === 1 ? 'day' : 'days' };
  }
  function best(h, idx, todayKey, year){
    if(h.per === 'week'){
      let b = 0, run = 0;
      weeksOf(h, year, idx, todayKey).forEach(w => {
        if(w.state === 'hit'){ run++; b = Math.max(b, run); } else if(w.state !== 'now') run = 0;
      });
      return b;
    }
    let b = 0, run = 0;
    yearOf(h, year, idx, todayKey).days.forEach(d => {
      if(d.st === 'done'){ run++; b = Math.max(b, run); }
      else if(d.st === 'miss' || d.st === 'part') run = 0;
    });
    return b;
  }
  /* The share of the year so far that went to plan. Day habits: due days done
     (half for a started amount). Week habits: finished weeks that hit. */
  function score(h, year, idx, todayKey){
    if(h.per === 'week'){
      const ws = weeksOf(h, year, idx, todayKey).filter(w => w.state === 'hit' || w.state === 'miss');
      const hit = ws.filter(w => w.state === 'hit').length;
      return { pct: ws.length ? Math.round(hit / ws.length * 100) : null, hit, of: ws.length };
    }
    let num = 0, den = 0;
    yearOf(h, year, idx, todayKey).days.forEach(d => {
      if(d.k === todayKey && d.st !== 'done') return;   /* today counts once it is done, or once it is over */
      if(d.st === 'done'){ num++; den++; }
      else if(d.st === 'part'){ num += .5; den++; }
      else if(d.st === 'miss') den++;
    });
    return { pct: den ? Math.round(num / den * 100) : null, hit: num, of: den };
  }
  /* A perfect day: every day-habit that was due, done. Week habits never break one. */
  function perfectDays(habits, year, idx, todayKey){
    const daily = habits.filter(h => h.per === 'day');
    if(!daily.length) return 0;
    const grids = daily.map(h => yearOf(h, year, idx, todayKey).days);
    let n = 0;
    grids[0].forEach((_, i) => {
      let due = 0, ok = true;
      grids.forEach(g => {
        const st = g[i].st;
        if(st === 'done') due++;
        else if(st === 'miss' || st === 'part'){ due++; ok = false; }
      });
      if(due && ok) n++;
    });
    return n;
  }

  /* What a habit is counting, in words, for the habit page and the editor. */
  function sourceLabel(h, seriesName){
    const s = h.source;
    if(s.type === 'own') return 'its own task on Today';
    if(s.type === 'series') return 'your repeating task' + (seriesName ? ' "' + seriesName + '"' : '');
    if(s.type === 'kind') return 'any finished ' + (KINDS[s.kind] || 'task').toLowerCase() +
      (s.kind === 'workout' ? ' task or workout session' : ' task');
    return 'your run log';
  }
  function goalLabel(h){
    if(h.per === 'week') return h.times + (h.times === 1 ? ' time' : ' times') + ' a week';
    const amt = h.source.amount ? h.source.amount + (h.source.unit ? ' ' + h.source.unit : '') + ' ' : '';
    if(h.days.length === 7) return amt ? amt + 'a day' : 'every day';
    const D = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return (amt ? amt + 'on ' : '') + h.days.map(d => D[d]).join(' ');
  }

  global.Habits = {
    PREFIX, COLORS, KINDS, GROUPS,
    all, get, save, remove, normalise,
    ensureTasks, ownTaskId, ownTaskFor,
    facts, index, dayStatus, sinceOf, yearOf, weeksOf, weekCount, streak, best, score, perfectDays,
    amountOf, sourceLabel, goalLabel,
    keyOf, fromKey, addDays, weekKey, dowOf
  };
})(window);
