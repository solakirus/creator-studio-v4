/* The home-screen widgets' data (native/CSWidget*.java draws them).

   A widget runs outside the WebView and cannot reach IndexedDB, so it cannot
   ask the app anything. The app hands it a snapshot and keeps it current:
   after anything that could move the numbers (Widget.refresh), at launch,
   and when the app comes back to the front.

   2026-11-22: seven widgets. The snapshot carries today in time order (tasks,
   vlog beats to film, meal prep), what is being filmed, the meals planned and
   today's workout. A check box or Done tapped on a widget waits on the native
   side; takeQueue() hands it over and it is saved here the normal way, so it
   syncs like any other change.

   The five old one-line fields (day, progress, next, nextAt, shoot) are still
   sent beside the snapshot: an APK from before 2026-11-22 reads only those.
   In a browser all of this is a silent no-op. */
(function(global){

  const plugin = () =>
    (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.CSWidget) || null;
  const available = () => !!plugin();

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const byTime = (a, b) => (a.at || '99:99').localeCompare(b.at || '99:99');
  const link = (kind, id) => `cs4://go/${kind}${id != null ? '/' + encodeURIComponent(id) : ''}`;
  const KIND = { shoot:'Shoot', edit:'Edit', publish:'Publish', workout:'Workout' };

  /* "6 exercises · 45 min" from a routine and the task's own amount */
  async function workoutSub(t){
    const bits = [];
    try {
      if(t.routineId && global.Routines){
        const r = await Routines.get(t.routineId);
        if(r){
          if(r.name && r.name !== t.title) bits.push(r.name);
          const n = (r.items || []).length;
          if(n) bits.push(`${n} exercise${n === 1 ? '' : 's'}`);
        }
      }
    } catch(e){}
    if(t.amount && (t.unit || 'min') === 'min') bits.push(`${t.amount} min`);
    else if(t.cad && t.cad !== 'Workout' && !bits.length) bits.push(t.cad);
    return bits.join(' · ');
  }

  const shots = t => {
    const s = t && t.page && Array.isArray(t.page.slots) ? t.page.slots : null;
    return s && s.length ? { got: s.filter(x => x && x.done).length, total: s.length } : null;
  };

  async function snapshot(){
    const out = { day:'', progress:'', next:'', nextAt:'', shoot:'', updatedAt:Date.now(),
      snapshot:{ v:2, date: iso(new Date()), items:[], filming:[], meals:{ slots:[] }, workout:null } };
    const S = out.snapshot;
    try {
      const day = await Data.currentDay();
      S.dayN = day;
      /* before the programme starts the count is negative — say so plainly
         rather than showing "Day -13", which reads as a bug */
      out.day = S.dayLabel = day > 0 ? `Day ${day}`
        : day === 0 ? 'Starts tomorrow'
        : `${Math.abs(day)} days to go`;
      try { S.streak = global.Celebrate ? await Celebrate.streak() : 0; } catch(e){ S.streak = 0; }

      const tasks = (await Data.tasks()).filter(t => t.day === day);
      const done = tasks.filter(t => t.view === 'done').length;
      out.progress = tasks.length ? `${done}/${tasks.length} done` : 'Nothing scheduled';

      /* ---- today, in time order ---- */
      const items = [];
      for(const t of tasks){
        const sh = shots(t);
        const isWorkout = t.kind === 'workout';
        let sub = '';
        if(isWorkout) sub = await workoutSub(t);
        else {
          const bits = [];
          if(t.kind && KIND[t.kind]) bits.push(t.cad && t.cad !== KIND[t.kind] ? t.cad : KIND[t.kind]);
          else if(t.cad) bits.push(t.cad);
          if(t.life && global.LifeImport) { try { bits.push(LifeImport.areaInfo(t.life).label); } catch(e){} }
          if(sh) bits.push(`${sh.got}/${sh.total} shots`);
          else if((t.subs || []).length) bits.push(`${t.subs.filter(x => x.done).length}/${t.subs.length} steps`);
          sub = bits.join(' · ');
        }
        const it = { id: String(t.id), title: t.title || 'Untitled', at: t.at || '', sub,
          done: t.view === 'done', check: true, link: link('task', t.id) };
        if(sh){ it.start = link('shootrun', t.id); it.startLabel = 'Start shooting'; }
        else if(isWorkout && t.routineId){ it.start = link('startworkout', t.id); it.startLabel = 'Start workout'; }
        items.push(it);
      }

      /* vlog beats scheduled onto today (not already a task), and meal prep */
      const dayDate = await Data.dayToDate(day);
      try {
        const { values: vlogs } = await Store.all('vlogs');
        vlogs.forEach(v => {
          const acts = v.acts || (v.beats ? [{ title:'Act 1', beats:v.beats }] : []);
          acts.forEach(a => (a.beats || []).filter(b => b.day === day && !b.taskId).forEach(b => {
            const n = (b.shots || []).length, got = (b.shots || []).filter(x => x.done).length;
            items.push({ id: null, title: b.title || 'Vlog beat', at: b.at || '', done: !!b.done, check: false,
              sub: `${v.title}${n ? ` · ${got}/${n} shots` : ''}`, link: link('shoot'), start: link('shoot'), startLabel: 'Start shooting' });
            S.filming.push({ title: `${b.title || 'Beat'} · ${v.title}`, got, total: n, link: link('shoot') });
          }));
        });
      } catch(e){ console.warn('Widget: vlog beats unavailable', e); }

      try {
        const end = dayDate + 86400000;
        const prep = (await Nutrition.prep()).filter(p => !p.cooked && p.date >= dayDate && p.date < end);
        prep.forEach(p => {
          const n = (p.mealIds || []).length;
          items.push({ id: null, title: 'Meal prep session', at: p.at || '', done: false, check: false,
            sub: `Cook day · ${n} meal${n === 1 ? '' : 's'}`, link: link('meals') });
        });
        if(prep.length){
          const n = prep.reduce((a, p) => a + (p.mealIds || []).length, 0);
          S.meals.prep = `Meal prep today · ${n} meal${n === 1 ? '' : 's'}`;
        }
      } catch(e){}

      items.sort(byTime);
      S.items = items;

      /* the one you would do next: first undone, in the order they sit */
      const next = tasks.find(t => t.view !== 'done');
      if(next){ out.next = next.title || 'Untitled'; out.nextAt = next.at || ''; }
      else if(tasks.length) out.next = 'All done today';

      /* ---- what you are filming ---- */
      tasks.filter(t => t.view !== 'done' && (shots(t) || t.kind === 'shoot')).forEach(t => {
        const sh = shots(t) || { got: 0, total: 0 };
        S.filming.unshift({ title: t.title || 'Shoot', got: sh.got, total: sh.total, link: sh.total ? link('shootrun', t.id) : link('task', t.id) });
      });
      const shoots = tasks.filter(t => t.kind === 'shoot' && t.view !== 'done');
      if(shoots.length) out.shoot = shoots.length === 1 ? shoots[0].title : `${shoots.length} sequences to film`;

      /* ---- meals planned for today (the plan's weeks start on Sunday) ---- */
      try {
        const when = new Date(dayDate);
        const wk = Nutrition.isoWeek(when);
        const [week, meals] = await Promise.all([Nutrition.week(wk), Nutrition.meals()]);
        const byId = Object.fromEntries(meals.map(m => [m.id, m]));
        const dow = Nutrition.DAYS[when.getDay()];
        const label = { breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner', snacks:'Snacks' };
        Nutrition.SLOTS.forEach(sl => {
          const m = byId[(week.slots || {})[`${dow}-${sl}`]];
          if(m) S.meals.slots.push({ slot: label[sl] || sl, title: m.title });
        });
      } catch(e){ console.warn('Widget: meals unavailable', e); }

      /* ---- today's workout: the first one still to do, else the last done ---- */
      const ws = tasks.filter(t => t.kind === 'workout').sort(byTime);
      const w = ws.find(t => t.view !== 'done') || ws[ws.length - 1];
      if(w){
        S.workout = { id: String(w.id), title: w.title || 'Workout', at: w.at || '', sub: await workoutSub(w),
          done: w.view === 'done', link: link('task', w.id),
          start: w.routineId ? link('startworkout', w.id) : link('task', w.id) };
      }
    } catch(e){ console.warn('Widget snapshot failed', e); }
    return out;
  }

  /* ---- check-offs made on the home screen ---- */
  let applying = false;
  async function applyQueue(){
    const p = plugin();
    if(applying || !p || !p.takeQueue) return 0;
    applying = true;
    let n = 0;
    try {
      const r = await p.takeQueue();
      for(const a of (r && r.actions) || []){
        if(!a || a.type !== 'done' || a.key == null) continue;
        const all = await Data.tasks();
        const t = all.find(x => String(x.id) === String(a.key));
        if(!t) continue;
        /* a tap flips it, the same as the box on Today */
        t.view = t.view === 'done' ? 'todo' : 'done';
        await Store.put('tasks', t);
        Data.invalidate('tasks');
        if(t.view === 'done' && t.kind && global.Pipeline) { try { Pipeline.taskCompleted(t); } catch(e){} }
        n++;
      }
      if(n){
        try { if(global.Notify) Notify.update(); } catch(e){}
        try { if(global.Reminders) Reminders.sync(); } catch(e){}
        try { if(global.Celebrate && Celebrate.showAwards) Celebrate.showAwards(); } catch(e){}
        /* redraw Today underneath, unless a screen is open on top of it */
        try {
          const onTab = !global.Screens || !Screens.depth || Screens.depth() === 0;
          if(onTab && global.App && App.refreshTab) App.refreshTab();
        } catch(e){}
      }
    } catch(e){
      /* an APK from before 2026-11-22 has no queue: nothing to take */
    } finally { applying = false; }
    return n;
  }

  /* Pushing on every change would be wasteful and pushing on a timer would be
     stale; this runs after anything that could move the numbers. */
  let pending = null;
  async function push(){
    const p = plugin();
    if(!p || !p.update) return false;
    try {
      await applyQueue();
      const data = await snapshot();
      await p.update(data);
      return true;
    } catch(e){ console.warn('Widget update failed', e); return false; }
  }

  /* Several things often change at once — ticking a task redraws Today, which
     would otherwise push three times in a second. */
  function refresh(){
    if(!available()) return;
    clearTimeout(pending);
    pending = setTimeout(push, 400);
  }

  /* taps on a widget while the app is open, and coming back to the app */
  (function listen(){
    const p = plugin();
    if(!p) return;
    try { if(p.addListener) p.addListener('widgetQueue', () => refresh()); } catch(e){}
    try {
      document.addEventListener('visibilitychange', () => { if(!document.hidden) refresh(); });
    } catch(e){}
  })();

  global.Widget = { available, snapshot, push, refresh, applyQueue };
})(window);
