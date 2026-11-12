/* Today — the planner. Tasks persist; card art and focal points persist. */
(function(global){
  const { slug, generatedArt, ICON } = U;


  const LABEL = { low:'Low', med:'Medium', high:'High' };

  let tasks = [], urls = {}, focals = {};
  let day = 1, dayDate = Date.now(), derived = [], chips = { clips:0, open:0, streak:0, avatar:null };
  let filter = 'todo', mode = 'list', adjusting = null, pendingArt = null;
  const expanded = new Set();
  let root, drag = null;

  const artKey = t => slug(t.title);
  /* "14:30" -> "2:30P", matching how the reference labels hours. */
  function fmtTime(hhmm){
    if(!hhmm) return null;
    const [h,m] = hhmm.split(':').map(Number);
    const ap = h >= 12 ? 'P' : 'A';
    const hr = h % 12 === 0 ? 12 : h % 12;
    return m ? `${hr}:${String(m).padStart(2,'0')}${ap}` : `${hr}${ap}`;
  }
  const byTime = (a,b) => (a.at || '99:99').localeCompare(b.at || '99:99');
  const subStats = t => {
    const n = (t.subs || []).length;
    if(!n) return null;
    const d = t.subs.filter(x => x.done).length;
    return { n, d, pct: Math.round(d / n * 100) };
  };
  const bars = pri => {
    const n = pri === 'low' ? 1 : pri === 'med' ? 2 : 3;
    return '<span class="bars">' + [1,2,3].map(i => `<i class="${i<=n?'on':''}"></i>`).join('') + '</span>';
  };
  function artStyle(t){
    const k = artKey(t), u = urls[k];
    const img = u ? `url(${u})` : generatedArt(k, t.title);
    const f = focals[k] || { x:50, y:32 };
    return `background-image:${img};background-position:${f.x}% ${f.y}%`;
  }

  /* Things that live on other screens but happen on this date. */
  async function loadChips(){
    try {
      const [clips, p] = await Promise.all([Data.clips(), Data.program()]);
      const start = new Date(dayDate); start.setHours(0,0,0,0);
      const end = start.getTime() + 86400000;
      chips.clips = clips.filter(c => c.createdAt >= start.getTime() && c.createdAt < end).length;
      chips.open = tasks.filter(t => t.day === day && t.view === 'todo').length;

      chips.streak = await Celebrate.streak();
      try {
        const blob = await Store.get('profile-photo', 'me');
        if(chips.avatar) URL.revokeObjectURL(chips.avatar);
        chips.avatar = blob ? URL.createObjectURL(blob) : null;
      } catch(e){ chips.avatar = null; }
    } catch(e){ console.warn('Chips unavailable', e); }
  }

  async function loadDerived(){
    derived = [];
    try {
      dayDate = await Data.dayToDate(day);
      const dayEnd = dayDate + 86400000;

      const prep = await Nutrition.prep();
      prep.filter(p => !p.cooked && p.date >= dayDate && p.date < dayEnd).forEach(p => {
        derived.push({ kind:'prep', id:p.id, title:'Meal prep session',
          cad:'Cook day', pri:'high',
          prog:`${(p.mealIds||[]).length} meal${(p.mealIds||[]).length===1?'':'s'} · ${p.batches||1}×` });
      });

      /* this week's milestones — what the episode is about */
      try {
        const wk = await Data.weekNumber(dayDate);
        const ms = await Challenges.milestonesFor(wk);
        ms.forEach(m => derived.push({ kind:'milestone', id:m.id, chalId:m.challenge.id,
          done:m.done, title:m.title, cad:m.challenge.title, pri:'high', at:null,
          prog:`Week ${wk} milestone` }));
      } catch(e){ console.warn('Milestones unavailable', e); }

      /* vlog beats scheduled onto this day */
      const { values: vlogs } = await Store.all('vlogs');
      vlogs.forEach(v => {
        const acts = v.acts || (v.beats ? [{ title:'Act 1', beats:v.beats }] : []);
        acts.forEach(a => (a.beats || []).filter(b => b.day === day && !b.taskId).forEach(b => {
          const shots = (b.shots || []).length;
          const shotsDone = (b.shots || []).filter(x => x.done).length;
          derived.push({ kind:'beat', id:b.id, vlogId:v.id, done:b.done,
            title:b.title, cad:`${v.title} · ${a.title}`, pri:'med', at:b.at,
            prog: shots ? `${shotsDone}/${shots} shots` : (b.purpose || 'Vlog beat'),
            pct: shots ? Math.round(shotsDone / shots * 100) : null });
        }));
      });

      const wk = Nutrition.isoWeek(dayDate);
      const [week, meals] = await Promise.all([Nutrition.week(wk), Nutrition.meals()]);
      const byId = Object.fromEntries(meals.map(m => [m.id, m]));
      const dow = Nutrition.DAYS[(new Date(dayDate).getDay() + 6) % 7];
      const planned = Nutrition.SLOTS
        .map(sl => ({ sl, meal: byId[week.slots[`${dow}-${sl}`]] }))
        .filter(x => x.meal);
      if(planned.length){
        derived.push({ kind:'meals', id:'meals-' + dow, title:'Meals planned',
          cad:'Nutrition', pri:'low',
          prog: planned.map(x => x.meal.title).join(' · ') });
      }
    } catch(e){ console.warn('Derived agenda unavailable', e); }
  }

  async function persist(t){
    try {
      await Store.put('tasks', t);
      Data.invalidate('tasks');
      if(t && t.view === 'done' && t.kind){
        Pipeline.taskCompleted(t).then(state => {
          if(state === 'queued') U.toast('Clip moved to the publish queue');
          if(state === 'posted') U.toast('Clip marked posted');
        });
      }
      Notify.update();            /* fire and forget — the notification is never load-bearing */
      if(global.Widget) Widget.refresh();   /* and the home screen, if there is one */
      Reminders.sync();
      Celebrate.showAwards();
      maybeCelebrate();
    } catch(e){ console.error(e); }
  }

  /* ---------- markup ---------- */
  function chrome(){
    const counts = {};
    ['todo','done','skipped'].forEach(v =>
      counts[v] = tasks.filter(t => t.day === day && t.view === v).length);
    counts.prod = tasks.filter(t => t.day === day && t.kind && t.view === 'todo').length;

    return `
    <div class="chiprow">
      <button class="chip${chips.clips ? ' is-active' : ''}" data-act="clips" title="Clips captured today">
        <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="15" height="12" rx="2"/><path d="M17.5 10.5L22 8v8l-4.5-2.5z"/></svg></span>${chips.clips}</button>
      <button class="chip" data-act="open" title="Still to do today">
        <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg></span>${chips.open}</button>
      <button class="chip${chips.streak ? ' is-active' : ''}" data-act="streak" title="Perfect-day streak">
        <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1.2 3.2 4.5 4.3 4.5 8a4.5 4.5 0 0 1-9 0c0-1.6.8-2.7 1.6-3.6C10.2 8.6 12 7 12 3z"/><path d="M12 21a3 3 0 0 0 3-3c0-1.7-1.5-2.3-3-4.5-1.5 2.2-3 2.8-3 4.5a3 3 0 0 0 3 3z"/></svg></span>${chips.streak}</button>
      <span class="spacer"></span>
      <button class="iconbtn${mode==='time' ? ' on' : ''}" data-act="mode" style="width:34px;height:34px"
        aria-label="${mode==='time' ? 'Switch to list' : 'Switch to timeline'}">
        ${mode === 'time'
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'}
      </button>
      <button class="iconbtn" data-act="paper" aria-label="Paper — write the day by hand" title="Paper" style="width:34px;height:34px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M9 15l5.5-5.5 2 2L11 17H9z"/></svg>
      </button>
      <button class="iconbtn" data-act="daysheet" aria-label="Day sheet" style="width:34px;height:34px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M9 9h7M9 13h7M9 17h4"/></svg>
      </button>
      <button class="iconbtn" data-act="settings" aria-label="Settings" style="width:34px;height:34px">${ICON.gear}</button>
    </div>

    <!-- "Day" and its number never split: the week and date sit underneath
         instead of fighting them for the same line. -->
    <div class="dayhead">
      <div class="dh-top">
        <h1 class="page-title">Day ${day}</h1>
        <div class="headacts">
          <button class="sq" data-act="prev" ${day<=1?'disabled':''} aria-label="Previous day">${ICON.chevL}</button>
          <button class="sq" data-act="next" aria-label="Next day">${ICON.chevR}</button>
        </div>
      </div>
      <p class="dh-sub">Week ${Data.weekOf(day)} · ${
        new Date(dayDate).toLocaleDateString(undefined,{ weekday:'long', month:'short', day:'numeric' })}</p>
    </div>

    <div id="habitStrip"></div>

    <div class="segrow" role="tablist">
      ${['todo','done','skipped'].map(v => `
        <button class="seg" role="tab" aria-selected="${filter===v}" data-filter="${v}">
          ${v === 'todo' ? 'To-do' : v[0].toUpperCase()+v.slice(1)} <span class="n">${counts[v]}</span>
        </button>`).join('')}
      ${counts.prod ? `<button class="seg prod" role="tab" aria-selected="${filter==='prod'}" data-filter="prod">
          Production <span class="n">${counts.prod}</span>
        </button>` : ''}
      <button class="addbtn" data-act="add" aria-label="Add task">+</button>
    </div>

    <div class="list" id="todayList"></div>`;
  }

  /* Production and training work read differently from a personal task: a
     coloured edge and a tag. Restored here after an edit removed it — cardHTML
     has referenced KINDS the whole time. */
  const KINDS = {
    shoot:   { c:'#FB6900', label:'Shoot',
      i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="12" height="10" rx="2"/><path d="M14.5 11l6-3v8l-6-3z"/></svg>' },
    edit:    { c:'#A855F7', label:'Edit',
      i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18l5-1 9.5-9.5-4-4L5 13z"/><path d="M14 5.5l4 4"/></svg>' },
    workout: { c:'#3F8A88', label:'Workout',
      i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>' },
    publish: { c:'#5BBE6A', label:'Publish',
      i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>' }
  };

  const kindTag = t => {
    const k = KINDS[t.kind];
    if(!k) return '';
    return `<span class="kindtag" style="--kind:${k.c}">${k.i}${k.label}${
      t.channel ? `<span class="ch">${t.channel}</span>` : ''}${
      t.kind === 'workout' && t.cad && t.cad !== 'Workout'
        ? `<span class="ch">${t.cad}</span>` : ''}</span>`;
  };

  /* How often a repeating task actually runs, counted from the tasks themselves
     rather than stored, so a series made before this existed still reads right —
     and so a run whose frequency changes week to week reports each week honestly.
     Keyed by task id; rebuilt whenever the list is drawn. */
  function freqLabels(){
    const map = new Map(), bySeries = new Map();
    tasks.forEach(t => {
      if(!t.series) return;
      if(!bySeries.has(t.series)) bySeries.set(t.series, []);
      bySeries.get(t.series).push(t);
    });
    bySeries.forEach(run => {
      const first = Math.min(...run.map(t => t.day));
      const perWeek = new Map();
      run.forEach(t => {
        const wk = Math.floor((t.day - first) / 7);
        perWeek.set(wk, (perWeek.get(wk) || 0) + 1);
      });
      run.forEach(t => {
        const n = perWeek.get(Math.floor((t.day - first) / 7)) || 1;
        map.set(t.id, n >= 7 ? 'Daily' : n + '\u00d7/week');
      });
    });
    return map;
  }
  let freqMap = new Map();

  /* the notebook pages a task holds: its shot page and the pages kept beside it */
  const pageCount = t => (t.page ? 1 : 0) + (Array.isArray(t.morePages) ? t.morePages.length : 0);
  const PAGE_ICON = `<svg class="pgi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 7h3v3H8zM13 7h3v3h-3zM8 13h3v3H8zM13 13h3v3h-3z"/></svg>`;

  function cardHTML(t, n){
    const k = artKey(t), st = subStats(t);
    return `
    <div class="mediacard${expanded.has(t.id)?' open':''}${t.kind ? ' prod' : ''}"
      ${t.kind ? `style="--kind:${(KINDS[t.kind]||{}).c || 'var(--orange)'}"` : ''} data-id="${t.id}">
      <span class="swipe-label l">Done</span>
      <span class="swipe-label r">Skip</span>
      <article class="card${t.view==='done'?' done':''}${adjusting===k?' adjusting':''}" data-key="${k}">
        <div class="art" style="${artStyle(t)}"></div>
        <button class="timechip${t.at ? '' : ' none'}" data-time="${t.id}">
          ${ICON.clock}${t.at ? fmtTime(t.at) : 'set time'}
        </button>
        <div class="artctl">
          <button class="artbtn" data-art="${k}" aria-label="Change card art">${ICON.image}</button>
          ${urls[k] ? `<button class="adjbtn${adjusting===k?' on':''}" data-adj="${k}" aria-label="Reposition">${ICON.move}</button>` : ''}
        </div>
        ${adjusting===k ? '<span class="hint">Drag to reposition</span>' : ''}
        <div class="body">
          ${t.kind ? `<div style="margin:0 0 8px">${kindTag(t)}</div>` : ''}
          <h2>${n ? `<span class="cardn">${n}</span>` : ''}${t.title}</h2>
          <div class="meta">
            <span class="cad">${ICON.repeat}${freqMap.get(t.id) || t.cad}</span>
            <span class="sep">|</span>
            <span class="pri ${t.pri}">${bars(t.pri)} ${LABEL[t.pri]}</span>
            ${t.prog ? `<span class="sep">|</span><span>${t.prog}</span>` : ''}
            ${st ? `<span class="sep">|</span><span class="steps">${st.d} / ${st.n} steps<span class="chev">${ICON.chevD}</span></span>` : ''}
            ${t.swipeId ? `<span class="sep">|</span><span class="steps" data-swipe="${t.swipeId}" style="color:var(--amber);opacity:1">↗ swipe</span>` : ''}
            ${t.page && (t.page.slots || []).length
              /* v4: a shot page's count is the steps' count, so one chip, and it starts shoot mode */
              ? `<span class="sep">|</span><span class="tpages tshoot" data-shoot="${t.id}" role="button" tabindex="0" title="Shoot mode: one shot at a time, full screen">▶ shoot <i>${t.page.slots.filter(s => s.done).length}/${t.page.slots.length}</i></span>`
              : pageCount(t) ? `<span class="sep">|</span><span class="tpages" data-pages="${t.id}" role="button" tabindex="0" title="Open this task's ${pageCount(t) === 1 ? 'page' : 'pages'}">${PAGE_ICON}${
              pageCount(t) === 1 ? 'page' : pageCount(t) + ' pages'}</span>` : ''}
          </div>
        </div>
        <button class="check" aria-label="Mark done">${ICON.check}</button>
        ${st ? `<div class="progress"><i style="width:${st.pct}%"></i></div>` : ''}
      </article>
      ${expanded.has(t.id) ? `<div class="subs">${t.subs.map((x,i) => `
        <div class="sub${x.done?' done':''}" data-sub="${i}">
          <span class="box">${ICON.check}</span><span>${x.t}</span>
        </div>`).join('')}${pageCount(t) ? `<button class="subs-page" data-pages="${t.id}">${PAGE_ICON}Open the full ${
          pageCount(t) === 1 ? 'page' : pageCount(t) + ' pages'}</button>` : ''}</div>` : ''}
    </div>`;
  }

  function derivedHTML(d){
    const isBeat = d.kind === 'beat' || d.kind === 'milestone';
    return `
    <div class="mediacard" data-derived="${d.kind}" data-did="${d.id}" data-vlog="${d.vlogId || ''}">
      <article class="card${isBeat && d.done ? ' done' : ''}">
        <div class="art" style="background-image:${generatedArt(d.kind + d.id, d.title)}"></div>
        ${d.at ? `<span class="timechip">${ICON.clock}${fmtTime(d.at)}</span>` : ''}
        <div class="body">
          <h2>${d.title}</h2>
          <div class="meta">
            <span class="cad">${ICON.repeat}${d.cad}</span>
            <span class="sep">|</span>
            <span class="st">${d.prog}</span>
          </div>
        </div>
        ${d.kind === 'milestone'
          ? `<button class="check" data-msdone="${d.chalId}:${d.id}" aria-label="Mark done">${ICON.check}</button>`
          : isBeat
          ? `<button class="check" data-beatdone="${d.id}" aria-label="Mark done">${ICON.check}</button>`
          : `<span class="state live" style="right:11px;top:11px">Open</span>`}
        ${isBeat && d.pct !== null && d.pct !== undefined
          ? `<div class="progress"><i style="width:${d.pct}%"></i></div>` : ''}
      </article>
    </div>`;
  }

  /* everything on this day, flattened for the timeline */
  function timelineItems(){
    const out = tasks.filter(t => t.day === day && t.view !== 'skipped').map(t => ({
      kind:'task', id:t.id, title:t.title, sub:t.cad, at:t.at, mins:t.mins || 0,
      /* the same colour the card uses, so the two views agree at a glance */
      tone: t.kind && KINDS[t.kind] ? KINDS[t.kind].c : null,
      toneLabel: t.kind && KINDS[t.kind] ? KINDS[t.kind].label : null,
      done:t.view === 'done', tickable:true
    }));
    derived.forEach(d => out.push({
      kind:d.kind, id:d.id, vlogId:d.vlogId, title:d.title, sub:d.cad, at:d.at,
      done:!!d.done, tickable:d.kind === 'beat'
    }));
    return out;
  }

  function renderTimeline(){
    const el = root.querySelector('#todayList');
    el.innerHTML = Timeline.render(timelineItems());
  }

  /* Habits (js/screens/habits.js) fill the strip above and tag the cards a
     habit is counting, after every draw. Optional: without it, nothing here
     changes. */
  function renderList(){
    drawList();
    if(global.HabitsUI) HabitsUI.decorate(root, tasks, day).catch(e => console.warn('Habits unavailable', e));
  }

  function drawList(){
    freqMap = freqLabels();
    if(mode === 'time') return renderTimeline();
    const rows = filter === 'prod'
      ? tasks.filter(t => t.day === day && t.kind && t.view === 'todo')
      : tasks.filter(t => t.day === day && t.view === filter);
    const timed = rows.filter(t => t.at).sort(byTime);
    const untimed = rows.filter(t => !t.at);
    const extra = filter === 'todo' ? derived.slice().sort(byTime) : [];
    const el = root.querySelector('#todayList');

    if(!rows.length && !extra.length){
      el.innerHTML = `<div class="empty"><b>Nothing in ${filter}</b>Add a task or swap days with the arrows above.</div>`;
      return;
    }
    /* Timed items, yours and the derived ones, in one run by clock time, with a
       thin divider each time the day moves into a new three-hour period. */
    const run = extra.map(x => ({ x, derived:true })).concat(timed.map(x => ({ x, derived:false })))
      .sort((a,b) => byTime(a.x, b.x));
    let n = 0, lastKey = null, html = '';
    run.forEach(r => {
      const per = periodOf(r.x.at);
      if(per && per.key !== lastKey){
        html += `<div class="daydiv period"><span>${per.name}</span><div class="rule"></div><em>${per.range}</em></div>`;
        lastKey = per.key;
      }
      html += r.derived ? derivedHTML(r.x) : cardHTML(r.x, extra.length + (++n));
    });
    el.innerHTML = html +
      (untimed.length && run.length
        ? `<div class="daydiv"><span>Sometime today</span><div class="rule"></div></div>` : '') +
      untimed.map((x,i) => cardHTML(x, extra.length + timed.length + i + 1)).join('');
  }

  /* Period dividers are quieter than Sometime today: smaller, closer to the
     cards, with the hours pushed to the right in a dimmer tone. */
  (function(){
    if(document.getElementById('period-css')) return;
    const st = document.createElement('style');
    st.id = 'period-css';
    st.textContent = `
      .daydiv.period{gap:10px;margin:18px 0 9px}
      .daydiv.period:first-child{margin-top:4px}
      .daydiv.period span{font-size:11px;letter-spacing:.14em;color:var(--muted)}
      .daydiv.period .rule{height:1px;opacity:.6}
      .daydiv.period em{font-style:normal;font-size:11px;font-weight:600;letter-spacing:.04em;
        color:var(--dim);white-space:nowrap}`;
    document.head.appendChild(st);
  })();

  /* The day in three-hour periods. Late night wraps midnight, so its range
     reads for whichever side of it the task is on. */
  const PERIODS = [
    { from: 3, to: 6,  key:'early',     name:'Early morning', range:'3–6A' },
    { from: 6, to: 9,  key:'morning',   name:'Morning',       range:'6–9A' },
    { from: 9, to:12,  key:'daytime',   name:'Daytime',       range:'9–12P' },
    { from:12, to:15,  key:'afternoon', name:'Afternoon',     range:'12–3P' },
    { from:15, to:18,  key:'evening',   name:'Evening',       range:'3–6P' },
    { from:18, to:21,  key:'night',     name:'Night',         range:'6–9P' }
  ];
  function periodOf(at){
    const m = /^(\d{1,2}):?(\d{2})?/.exec(at || '');
    if(!m) return null;
    const h = +m[1];
    const p = PERIODS.find(x => h >= x.from && h < x.to);
    if(p) return p;
    return h >= 21 ? { key:'late-pm', name:'Late night', range:'9P–12A' }
                   : { key:'late-am', name:'Late night', range:'12–3A' };
  }

  function render(){ root.innerHTML = chrome(); renderList(); }

  /* ---------- add sheet ---------- */
  /* The add form speaks the same language as the plan editor: big headings,
     orange day squares, segmented controls and bumpers rather than a column of
     small-caps labels. Cadence is gone — the day squares say how often it runs
     and the card computes the label from them. */
  /* Editing one of the sample tasks. A built-in is never overwritten in place —
     the change is stored against its id, so the shipped list can still improve
     and removing one only hides it. */
  function editPreset(rec){
    const r = rec ? Object.assign({}, rec) : { name:'', cat:'body', g:'idea', amount:null, unit:'', rec:false };
    const isNew = !rec;
    const glyphs = Object.keys(TaskLib.G);

    App.sheet(`
      <h2>${isNew ? 'New sample task' : 'Edit sample task'}</h2>
      <div class="field"><label for="ep-name">Name</label>
        <input id="ep-name" type="text" value="${r.name || ''}" placeholder="Cold shower" autocomplete="off">
        <p class="err" id="ep-err" hidden>Give it a name.</p></div>

      <div class="field"><label>Category</label>
        <div class="opts" data-group="cat">${TaskLib.CATS.filter(c => c.k !== 'all').map(c =>
          `<button type="button" class="opt" data-cat="${c.k}" aria-pressed="${r.cat === c.k}">${c.label}</button>`).join('')}</div></div>

      <div class="field" style="display:flex;gap:10px">
        <span style="flex:1"><label for="ep-amt">Usual amount</label>
          <input id="ep-amt" type="number" step="0.5" min="0" value="${r.amount == null ? '' : r.amount}"
            placeholder="none"></span>
        <span style="flex:1"><label for="ep-unit">Unit</label>
          <select id="ep-unit" class="unit">
            <option value="">none</option>
            ${TaskLib.UNITS.map(u => `<option value="${u}" ${r.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
          </select></span>
      </div>

      <div class="field"><label>Show as</label>
        <div class="opts" data-group="rec">
          <button type="button" class="opt" data-rec="1" aria-pressed="${!!r.rec}">Recommended</button>
          <button type="button" class="opt" data-rec="0" aria-pressed="${!r.rec}">Normal</button>
        </div></div>

      <div class="field"><label>Icon</label>
        <div class="glyphs">${glyphs.map(g =>
          `<button type="button" class="gbtn" data-g="${g}" aria-pressed="${r.g === g}">
            ${TaskLib.icon(g)}</button>`).join('')}</div></div>

      ${isNew ? '' : `<button class="btn-ghost" data-del
        style="width:100%;margin:22px 0 0;color:var(--red);border-color:rgba(226,86,74,.45)">
        Remove from the list</button>`}
      <div class="sheetcta">
        <button class="btn-primary" data-save>Save</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheet => {

      sheet.addEventListener('click', async e => {
        const c = e.target.closest('[data-cat]');
        if(c){
          r.cat = c.dataset.cat;
          sheet.querySelectorAll('[data-cat]').forEach(x => x.setAttribute('aria-pressed', String(x === c)));
          return;
        }
        const rc = e.target.closest('[data-rec]');
        if(rc){
          r.rec = rc.dataset.rec === '1';
          sheet.querySelectorAll('[data-rec]').forEach(x => x.setAttribute('aria-pressed', String(x === rc)));
          return;
        }
        const g = e.target.closest('[data-g]');
        if(g){
          r.g = g.dataset.g;
          sheet.querySelectorAll('[data-g]').forEach(x => x.setAttribute('aria-pressed', String(x === g)));
          return;
        }
        if(e.target.closest('[data-cancel]')){ App.closeSheet(); return setTimeout(openLibrary, 60); }

        if(e.target.closest('[data-del]')){
          await TaskLib.remove(r);
          App.closeSheet();
          U.toast(r.name + ' removed from the list');
          return setTimeout(openLibrary, 60);
        }
        if(!e.target.closest('[data-save]')) return;

        r.name = sheet.querySelector('#ep-name').value.trim();
        if(!r.name){ sheet.querySelector('#ep-err').hidden = false; return; }
        const amt = parseFloat(sheet.querySelector('#ep-amt').value);
        r.amount = isNaN(amt) ? null : amt;
        r.unit = sheet.querySelector('#ep-unit').value;
        await TaskLib.save(r);
        App.closeSheet();
        U.toast('Saved to the list');
        setTimeout(openLibrary, 60);
      });

      setTimeout(() => { const f = sheet.querySelector('#ep-name'); if(f) f.focus(); }, 180);
    });
  }

  /* Add a task starts with the things you actually do. Picking one only fills
     the form in — from there it is the same task as any other. */
  async function openLibrary(){
    let q = '', cat = 'all', editing = false;
    try { await TaskLib.load(); } catch(e){ /* built-ins still work */ }

    const tiles = () => {
      const found = TaskLib.find(q, cat);
      return `
        <button type="button" class="libtile custom" data-pick="">
          <span class="ic">+</span><span class="nm">${editing ? 'New sample task' : 'Custom task'}</span></button>
        ${found.map((t, i) => `
          <button type="button" class="libtile" data-pick="${i}">
            <span class="ic">${TaskLib.icon(t.g)}</span>
            <span class="nm">${t.name}${t.rec && !editing ? '<em>Recommended</em>' : ''}</span>
            ${editing ? `<span class="edit">${U.ICON.pencil}</span>` : ''}
          </button>`).join('')}
        ${found.length ? '' : `<p class="libnone">Nothing matches. ${
          editing ? 'New sample task adds one.' : 'Custom task builds it from scratch.'}</p>`}`;
    };

    App.sheet(`
      <style>
        .libtop{display:flex;align-items:center;gap:10px;margin:0 0 12px}
        .libtop h2{margin:0;flex:1}
        .libfind{position:relative;margin:0 0 12px}
        .libfind > svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);
          width:16px;height:16px;color:var(--muted);pointer-events:none}
        .libsearch{width:100%;height:48px;padding:0 38px 0 38px;background:var(--surface-1);
          border:1px solid #33302A;border-radius:var(--r);color:var(--cream);
          font:inherit;font-size:15px}
        .libsearch::placeholder{color:var(--dim)}
        .libsearch:focus{outline:0;border-color:var(--orange)}
        .libclear{position:absolute;right:6px;top:50%;transform:translateY(-50%);
          width:30px;height:30px;background:none;border:0;color:var(--muted);
          font-size:19px;line-height:1;cursor:pointer}
        .libcats{display:flex;gap:7px;overflow-x:auto;margin:0 0 14px;padding:0 0 3px;
          scrollbar-width:none}
        .libcats::-webkit-scrollbar{display:none;height:0}
        .libcats .opt{flex:0 0 auto;white-space:nowrap}
        .libgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-height:52vh;
          overflow-y:auto;padding:2px}
        .libtile{display:flex;align-items:center;gap:10px;text-align:left;padding:12px 11px;
          background:var(--surface-1);border:1px solid #33302A;border-radius:var(--r);
          color:var(--cream);font-family:inherit;font-size:14px;cursor:pointer}
        .libtile.custom{background:var(--orange);border-color:var(--orange);color:#151515;
          font-family:var(--display),sans-serif;font-weight:900}
        .libtile .ic{flex:0 0 34px;height:34px;display:flex;align-items:center;justify-content:center;
          border:1px solid #3B372F;border-radius:var(--r);color:var(--cream)}
        .libtile.custom .ic{border-color:rgba(21,21,21,.3);color:#151515;font-size:19px}
        .libtile .ic svg{width:18px;height:18px}
        .libtile .nm{line-height:1.3}
        .libtile em{display:block;font-style:normal;font-size:11px;color:var(--orange);
          margin:3px 0 0;letter-spacing:.04em}
        .libnone{grid-column:1/-1;margin:10px 0;color:var(--dim);font-size:13.5px}
        .libtile .edit{margin-left:auto;flex:0 0 26px;height:26px;display:flex;align-items:center;
          justify-content:center;color:var(--orange);border:1px solid rgba(251,105,0,.4);
          border-radius:var(--r)}
        .libtile .edit svg{width:13px;height:13px}
      </style>
      <div class="libtop">
        <h2>Add a task</h2>
        <button type="button" class="btn-sm" data-editmode>Edit list</button>
      </div>
      <div class="libfind">
        ${U.ICON.search}
        <input class="libsearch" id="lib-q" type="text" placeholder="Search tasks…"
          autocomplete="off" enterkeyhint="search">
        <button type="button" class="libclear" data-clear aria-label="Clear">&times;</button>
      </div>
      <div class="libcats">${TaskLib.CATS.map(c =>
        `<button type="button" class="opt" data-cat="${c.k}" aria-pressed="${c.k === 'all'}">${c.label}</button>`).join('')}</div>
      <div class="libgrid" id="lib-grid">${tiles()}</div>
      <div class="sheetcta"><button class="btn-ghost" data-cancel>Cancel</button></div>`, sheet => {

      const grid = () => sheet.querySelector('#lib-grid');
      const redraw = () => grid().innerHTML = tiles();

      sheet.querySelector('#lib-q').addEventListener('input', e => { q = e.target.value; redraw(); });

      sheet.addEventListener('click', e => {
        if(e.target.closest('[data-clear]')){
          q = '';
          sheet.querySelector('#lib-q').value = '';
          return redraw();
        }
        if(e.target.closest('[data-editmode]')){
          editing = !editing;
          sheet.querySelector('[data-editmode]').textContent = editing ? 'Done' : 'Edit list';
          sheet.querySelector('[data-editmode]').className = editing ? 'btn-sm accent' : 'btn-sm';
          return redraw();
        }
        const c = e.target.closest('[data-cat]');
        if(c){
          cat = c.dataset.cat;
          sheet.querySelectorAll('[data-cat]').forEach(x =>
            x.setAttribute('aria-pressed', String(x === c)));
          return redraw();
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();

        const pick = e.target.closest('[data-pick]');
        if(!pick) return;
        const raw = pick.dataset.pick;
        const rec = raw === '' ? null : TaskLib.find(q, cat)[+raw];

        /* in edit mode a tile opens its entry rather than starting a task */
        if(editing){
          App.closeSheet();
          return setTimeout(() => editPreset(rec), 60);
        }
        const seed = rec ? TaskLib.prefill(rec) : null;
        App.closeSheet();
        setTimeout(() => openSheet(seed), 60);
      });

      setTimeout(() => { const f = sheet.querySelector('#lib-q'); if(f) f.focus(); }, 180);
    });
  }

  /* Today's + opens the one add-task form (taskform.js) — the same one Month,
     Week and the day sheet use. A pick from the task library prefills it. */
  async function openSheet(seed){
    await TaskForm.open({ day, seed: seed || {}, onSaved: async written => {
      (written || []).forEach(w => { if(!tasks.some(x => x.id === w.id)) tasks.push(w); });
      filter = 'todo';
      await loadChips();
      render();
    } });
  }

  function openTime(task){
    App.sheet(`
      <h2>${task.at ? 'Change time' : 'Set a time'}</h2>
      <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.55">
        Timed things sort to the top of the day and show on the calendar. Leave it off and it sits
        under Sometime today.</p>
      <div class="field"><label for="tm">Time</label>
        <input id="tm" type="time" value="${task.at || ''}"></div>
      <div class="field"><label>Quick set</label><div class="opts">
        ${['06:00','09:00','12:00','15:00','18:00','21:00'].map(t =>
          `<button type="button" class="opt" data-q="${t}">${fmtTime(t)}</button>`).join('')}
      </div></div>
      <div class="sheetcta">
        <button class="btn-primary" data-save>Save</button>
        <button class="btn-ghost" data-clear>Clear</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        const q = e.target.closest('[data-q]');
        if(q){ sheetEl.querySelector('#tm').value = q.dataset.q; return; }
        if(e.target.closest('[data-clear]')){
          task.at = null; await persist(task); App.closeSheet(); return render();
        }
        if(!e.target.closest('[data-save]')) return;
        task.at = sheetEl.querySelector('#tm').value || null;
        await persist(task); App.closeSheet(); render();
      });
    });
  }

  async function moveItem(key, vlogId, at){
    const [kind, id] = key.split(':');
    if(kind === 'task'){
      const t = tasks.find(x => x.id === +id);
      if(!t) return;
      t.at = at;
      await persist(t);
    } else if(kind === 'beat'){
      const v = await Store.get('vlogs', vlogId);
      let b = null;
      (v.acts || []).forEach(a => { const f = (a.beats || []).find(x => x.id === id); if(f) b = f; });
      if(!b) return;
      b.at = at;
      await Store.put('vlogs', v);
      await loadDerived();
    } else {
      U.toast('That one is scheduled where it lives');
      return;
    }
    renderList();
  }

  /* The day's done: chime, then the card. Once per day, and never on a day
     you had nothing on. */
  async function maybeCelebrate(){
    try {
      if(!(await Celebrate.perfectToday())) return;
      if(await Celebrate.alreadyCelebrated()) return;
      await Celebrate.markCelebrated();
      Celebrate.chime();
      const [n, x] = await Promise.all([Celebrate.streak(), Celebrate.stats()]);
      await Celebrate.flame(n, x);   /* the burst, then the card */
      showPerfectDay();
    } catch(e){ console.warn('Celebration skipped', e); }
  }

  async function showPerfectDay(){
    const host = document.getElementById('perfectday');
    if(!host) return;
    const [n, all, x] = await Promise.all([Celebrate.streak(), Data.tasks(), Celebrate.stats()]);
    const d = await Data.currentDay();
    const done = all.filter(t => t.day === d && t.view === 'done');

    host.innerHTML = `
      <div class="pd-card">
        <p class="pd-date">${new Date().toLocaleDateString(undefined,
          { weekday:'short', month:'short', day:'numeric' })}</p>
        <h2>Perfect day.</h2>
        <p class="sub">"Every task. Zero skips."</p>
        <div class="pd-list">
          <p class="pd-cap">${done.length} task${done.length===1?'':'s'} done</p>
          ${done.slice(0,5).map(t => `<div class="pd-row"><i></i><span>${t.title}</span></div>`).join('')}
          ${done.length > 5 ? `<p class="pd-day" style="margin:8px 0 0">+ ${done.length - 5} more</p>` : ''}
        </div>
        <div class="pd-grid">
          <span class="pd-stat"><b>${n}</b>day streak</span>
          <span class="pd-stat"><b>${x.week}/${x.weekDays || 7}</b>this week</span>
          <span class="pd-stat"><b>${x.month}</b>this month</span>
          <span class="pd-stat"><b>${x.best}</b>best run</span>
        </div>
        <div class="pd-foot">
          <span class="pd-streak">${x.totalDone} done all time</span>
          <span class="pd-day">Day ${d} · week ${x.week_no}</span>
        </div>
        <div class="pd-cta">
          <button class="save" data-pd="save">Save</button>
          <button class="share" data-pd="share">Share</button>
        </div>
        <button class="pd-close" data-pd="close">Close</button>
      </div>`;
    host.classList.add('open');

    host.onclick = async e => {
      const b = e.target.closest('[data-pd]');
      if(!b){ if(e.target === host) host.classList.remove('open'); return; }
      if(b.dataset.pd === 'close') return host.classList.remove('open');
      if(b.dataset.pd === 'save')  return Celebrate.saveCard();
      if(b.dataset.pd === 'share') return Celebrate.shareCard();
    };
  }

  /* ---------- events ---------- */
  function wire(){
    /* Hold a task to pick several and clear them together. The artwork drag on
       this same element only runs while adjusting, so the two do not collide. */
    if(global.Select) Select.enable(root, {
      itemSelector: '.mediacard',
      noun: 'task',
      idOf: n => n.dataset.id || null,
      warning: 'They leave today for good. Anything they were filming stays.',
      onDelete: async ids => {
        for(const id of ids){
          try { await Store.del('tasks', +id); } catch(err){}
        }
        Data.invalidate('tasks');
      },
      onDone: () => render()
    });

    root.addEventListener('click', async e => {
      const act = e.target.closest('[data-act]');
      if(act){
        const a = act.dataset.act;
        if(a === 'prev' && day > 1){ day--; await loadDerived(); await loadChips(); render(); }
        if(a === 'next'){ day++; await loadDerived(); await loadChips(); render(); }
        if(a === 'add') openLibrary();
        if(a === 'mode'){ mode = mode === 'time' ? 'list' : 'time'; render(); return; }
        if(a === 'paper'){ Screens.push('paper', { onChange: () => App.refreshTab && App.refreshTab() }); return; }
        if(a === 'clips'){ Screens.push('clips-screen', {}); return; }
        if(a === 'open'){ filter = 'todo'; render(); return; }
        if(a === 'streak'){ Screens.push('streak', { onChange:() => render() }); return; }
        if(a === 'profile'){ Screens.push('profile', {}); return; }
        if(a === 'settings'){ Screens.push('settings'); return; }
        if(a === 'daysheet'){ Screens.push('daysheet', { day }); return; }
        return;
      }
      const seg = e.target.closest('[data-filter]');
      if(seg){ filter = seg.dataset.filter; render(); return; }

      const adj = e.target.closest('.adjbtn');
      if(adj){ adjusting = adjusting === adj.dataset.adj ? null : adj.dataset.adj; renderList(); return; }

      const art = e.target.closest('.artbtn');
      if(art){ pendingArt = art.dataset.art; App.pickImage(onImage); return; }

      if(adjusting && !e.target.closest('.artctl')){ adjusting = null; renderList(); return; }

      /* timeline: collapse a block, or tick an item */
      const tgl = e.target.closest('[data-toggle]');
      if(tgl){
        const k = tgl.dataset.toggle;
        Timeline.open.has(k) ? Timeline.open.delete(k) : Timeline.open.add(k);
        renderList();
        return;
      }
      const tk = e.target.closest('[data-tick]');
      if(tk){
        const [kind, id] = tk.dataset.tick.split(':');
        if(kind === 'task'){
          const t = tasks.find(x => x.id === +id);
          t.view = t.view === 'done' ? 'todo' : 'done';
          if(t.subs) t.subs.forEach(x => x.done = t.view === 'done');
          await persist(t);
        } else if(kind === 'beat'){
          const wrap = tk.closest('[data-vlog]');
          const v = await Store.get('vlogs', wrap.dataset.vlog);
          let b = null;
          (v.acts || []).forEach(a2 => { const f = (a2.beats || []).find(x => x.id === id); if(f) b = f; });
          if(b){ b.done = !b.done; (b.shots||[]).forEach(s2 => s2.done = b.done); await Store.put('vlogs', v); }
          await loadDerived();
        }
        renderList();
        return;
      }

      const tc = e.target.closest('[data-time]');
      if(tc){ const t = tasks.find(x => x.id === +tc.dataset.time); if(t) openTime(t); return; }

      const sw = e.target.closest('[data-swipe]');
      if(sw){ Screens.push('swipe', { id:sw.dataset.swipe }); return; }

      const md = e.target.closest('[data-msdone]');
      if(md){
        const [cid, mid] = md.dataset.msdone.split(':');
        await Challenges.toggleMilestone(cid, mid);
        await loadDerived(); renderList();
        return;
      }

      const bd = e.target.closest('[data-beatdone]');
      if(bd){
        const wrap = bd.closest('[data-vlog]');
        const v = await Store.get('vlogs', wrap.dataset.vlog);
        let b = null;
        (v.acts || []).forEach(a => { const f = (a.beats || []).find(x => x.id === bd.dataset.beatdone); if(f) b = f; });
        if(!b && v.beats) b = v.beats.find(x => x.id === bd.dataset.beatdone);
        if(b){
          b.done = !b.done;
          (b.shots || []).forEach(s2 => s2.done = b.done);
          await Store.put('vlogs', v);
        }
        await loadDerived(); renderList();
        return;
      }

      const der = e.target.closest('[data-derived]');
      if(der){
        const kind = der.dataset.derived;
        if(kind === 'prep') Screens.push('cook', { id:der.dataset.did.replace(/^/, ''), onChange:async () => { await loadDerived(); renderList(); } });
        if(kind === 'meals') Screens.push('planner', { onChange:() => render() });
        if(kind === 'milestone'){ Screens.push('challenges', { onChange:() => render() }); return; }
        if(kind === 'beat') Screens.push('vlog-beat', { vlogId:der.dataset.vlog, beatId:der.dataset.did,
          onChange:async () => { await loadDerived(); renderList(); } });
        return;
      }

      const sh = e.target.closest('[data-shoot]');
      if(sh){
        Screens.push('shoot-run', { id:+sh.dataset.shoot, onChange:async () => {
          tasks = Object.values(await Store.allMap('tasks'));
          await loadChips(); render();
        }});
        return;
      }
      const pg = e.target.closest('[data-pages]');
      if(pg){
        Screens.push('task-page', { id:+pg.dataset.pages, onChange:async () => {
          tasks = Object.values(await Store.allMap('tasks'));
          await loadChips(); render();
        }});
        return;
      }
      const sub = e.target.closest('.sub');
      if(sub){
        const t = tasks.find(x => x.id === +sub.closest('.mediacard').dataset.id);
        t.subs[+sub.dataset.sub].done = !t.subs[+sub.dataset.sub].done;
        t.view = t.subs.every(x => x.done) ? 'done' : (t.view === 'done' ? 'todo' : t.view);
        persist(t); render(); return;
      }
      const chk = e.target.closest('.check');
      if(chk){
        const t = tasks.find(x => x.id === +chk.closest('.mediacard').dataset.id);
        const nowDone = t.view !== 'done';
        t.view = nowDone ? 'done' : 'todo';
        if(t.subs) t.subs.forEach(x => x.done = nowDone);
        persist(t); render(); return;
      }
      const steps = e.target.closest('.steps');
      if(steps && !steps.dataset.swipe){
        const t = tasks.find(x => x.id === +steps.closest('.mediacard').dataset.id);
        if(t && t.subs && t.subs.length){
          expanded.has(t.id) ? expanded.delete(t.id) : expanded.add(t.id);
          renderList();
        }
        return;
      }
      const card = e.target.closest('.card');
      if(card){
        const wrap = card.closest('.mediacard');
        if(!wrap || !wrap.dataset.id) return;
        Screens.push('task', { id:wrap.dataset.id, onChange:async () => {
          tasks = Object.values(await Store.allMap('tasks'));
          await loadChips(); render();
        }});
      }
    });

    /* swipe right to finish it, left to set it aside */
    if(root.dataset.gesturesToday) return;
    root.dataset.gesturesToday = '1';
    SwipeCards.wire(root, {
      onRight: async id => {
        const t = tasks.find(x => x.id === +id);
        if(!t) return;
        t.view = 'done';
        (t.subs || []).forEach(s2 => s2.done = true);
        await persist(t);
        await loadChips();
        U.toast('Marked done');
        render();
      },
      onLeft: async id => {
        const t = tasks.find(x => x.id === +id);
        if(!t) return;
        t.view = t.view === 'skipped' ? 'todo' : 'skipped';
        await persist(t);
        await loadChips();
        U.toast(t.view === 'skipped' ? 'Skipped' : 'Back on the list');
        render();
      }
    });

    Timeline.wireDrag(root, moveItem);

    /* focal drag */
    root.addEventListener('pointerdown', e => {
      if(!adjusting) return;
      const card = e.target.closest('.card.adjusting');
      if(!card || e.target.closest('.artctl')) return;
      const f = focals[adjusting] || { x:50, y:32 };
      drag = { x:e.clientX, y:e.clientY, fx:f.x, fy:f.y,
               el:card.querySelector('.art'), w:card.offsetWidth, h:card.offsetHeight };
      card.setPointerCapture(e.pointerId);
    });
    root.addEventListener('pointermove', e => {
      if(!drag) return;
      const nx = Math.min(100, Math.max(0, drag.fx - (e.clientX - drag.x) / drag.w * 100));
      const ny = Math.min(100, Math.max(0, drag.fy - (e.clientY - drag.y) / drag.h * 100));
      focals[adjusting] = { x:Math.round(nx), y:Math.round(ny) };
      drag.el.style.backgroundPosition = `${Math.round(nx)}% ${Math.round(ny)}%`;
    });
    const endDrag = async () => {
      if(!drag) return;
      drag = null;
      try { await Store.put('focal', focals[adjusting], adjusting); } catch(e){ console.error(e); }
    };
    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', endDrag);
  }

  async function onImage(file){
    if(!pendingArt) return;
    try {
      await Store.put('art', file, pendingArt);
      if(!focals[pendingArt]) await Store.put('focal', { x:50, y:32 }, pendingArt);
      await loadArt();
    } catch(e){ console.error(e); U.toast("Couldn't save that image"); }
    pendingArt = null;
    renderList();
  }

  async function loadArt(){
    try {
      const blobs = await Store.allMap('art');
      Object.values(urls).forEach(URL.revokeObjectURL);
      urls = {};
      Object.entries(blobs).forEach(([k,b]) => urls[k] = URL.createObjectURL(b));
      focals = await Store.allMap('focal');
    } catch(e){ console.warn('Art unavailable', e); }
  }

  async function mount(el){
    root = el;
    root.className = 'view';
    try {
      tasks = Object.values(await Store.allMap('tasks'));
    } catch(e){ tasks = []; }
    try { day = await Data.currentDay(); } catch(e){ day = 1; }
    await loadArt();
    await loadDerived();
    await loadChips();
    render();
    /* mount runs again every time this tab is opened — wiring twice would make
       one tap count as two */
    if(!root.dataset.wiredToday){
      wire();
      root.dataset.wiredToday = '1';
    }
    Notify.update();
    if(global.Widget) Widget.refresh();
  }

  global.ViewToday = { mount };
})(window);
