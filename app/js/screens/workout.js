/* Workout console: Workouts / Progress / Nutrition, plus session export. */
(function(){
  const { pad, ICON } = U;

  const I = {
    /* runs: a runner, and a chart of what you have run */
    runner:'M13.5 4.4a1.5 1.5 0 1 0 0-.1M11 21l1.6-5.8L9 13l1-5.2 4.2 2.1 3.2 1M8.3 21l2.1-4.2',
    runlog:'M4 19V5M4 19h16M7.5 15.5l3.5-4 3 2.5 5-6',
    push:'M12 3v7M9 6l3-3 3 3M4 13h16M6 11v4M18 11v4',
    pull:'M12 21v-7M9 18l3 3 3-3M4 9h16M6 7v4M18 7v4',
    legs:'M5 4h14M12 4v6M9 10l-1 10M15 10l1 10',
    cardio:'M12 20s-7-4.5-7-9a3.8 3.8 0 0 1 7-2 3.8 3.8 0 0 1 7 2c0 4.5-7 9-7 9zM8.5 12h2l1-2 1.5 4 1-2h1.5',
    body:'M12 3.2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM8 8.4h8v6H8zM9 14.4l-.6 6.4M15 14.4l.6 6.4',
    meals:'M6 3h12v16l-6-3.6L6 19z',
    templ:'M12 3l9 4.5-9 4.5-9-4.5zM3 12l9 4.5L21 12M3 16.5L12 21l9-4.5',
    plan:'M4 5h16v15H4zM8 3v4M16 3v4M4 10h16M8 14h2M13 14h3M8 17h5',
    cart:'M4 8h16l-1.6 10H5.6zM9 8a3 3 0 0 1 6 0',
    prep:'M6 4h12l-1 4H7zM7 10h10l-1 9H8z',
    pantry:'M8 3h8v18H8zM10 7h4M10 11h4M10 15h3',
    photo:'M3 7h4l1.5-2h7L17 7h4v12H3zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    weight:'M4 9h16v6H4zM7 15v2M17 15v2M9 12h6'
  };

  const NAV = [
    { v:'workouts',  label:'Workouts',  d:'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10' },
    { v:'progress',  label:'Progress',  d:'M3 17l6-6 4 4 8-8M15 7h6v6' },
    { v:'runs', label:'Runs', d:'M13.5 5.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM9 21l2.2-5.4-2.4-2 .9-4.4 3.6-1.4 3 2.2 2.7.9M6 12.5l2.4-3.1M11.6 15.6l2.9 1.5 1.6 3.9' }
  ];



  let sessions = [], runs = [], view = 'workouts', root, unit = 'lb', OVERLOAD = null, ROUTINES = [], QUICK = [];
  let PHYS = { photos:0, weights:0, days:0 };   /* counts for the two Progress tiles */
  let ALL_SESSIONS = false;   /* the log shows ten until you ask for the rest */

  /* ---- CSV, long format: one row per set. Pivots properly in Excel. ---- */
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  function toCSV(records){
    const head = ['session_id','date','time','workout','duration_sec','exercise_order','exercise',
                  'set_number','lb','kg','reps','volume_lb','volume_kg','completed'];
    const lines = [head.join(',')];
    records.forEach(r => {
      const d = new Date(r.finishedAt);
      const date = d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
      const time = pad(d.getHours())+':'+pad(d.getMinutes());
      (r.exercises||[]).forEach(ex => (ex.sets||[]).forEach(st => {
        const lb = st.kg / 0.45359237;
        lines.push([r.id,date,time,r.name,r.durationSec,ex.order,ex.name,st.set,
                    lb.toFixed(1), st.kg.toFixed(1), st.reps,
                    (lb*st.reps).toFixed(1), (st.kg*st.reps).toFixed(1),
                    st.done?'yes':'no'].map(esc).join(','));
      }));
    });
    return lines.join('\n');
  }
  const thisMonth = recs => {
    const n = new Date();
    return recs.filter(r => { const d = new Date(r.finishedAt);
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); });
  };
  async function download(name, text){
    const r = await Saver.save(name, text, 'text/csv;charset=utf-8', name);
    if(r === 'shared' || r === 'browser') U.toast('Exported ' + name);
  }

  const tile = t => `<button class="ctile${t.on?' on':''}"${t.go ? ` data-go="${t.go}"` : ''}
    style="--t-a:${t.a || '#C4613A'};--t-b:${t.b || '#6C2B1C'}">
    <span class="art3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="${t.i}"/></svg></span>
    <span class="strip"><b>${t.n}</b><span>${t.s}</span></span></button>`;

  function trackerHTML(){
    /* A blank session always sits first; the rest is whatever you pinned, or
       your most-run workouts until you pin something. */
    const QS = [
      { n:"New", a:"#EDE5D2", b:"#BDB3A0", dark:true, d:"M12 5v14M5 12h14", act:'session' },
      ...QUICK.slice(0, 3).map(q => ({
        n: q.n, a: q.c, b: 'color-mix(in srgb,' + q.c + ' 42%,#141210)',
        d: 'M8 5l11 7-11 7z', act: q.kind + ':' + q.id
      }))
    ];
    return `
    <div style="display:flex;align-items:center;gap:10px;margin:0 0 12px">
      <p class="caps hot" style="margin:0">Get started</p>
      <button class="btn-sm" data-a="editqs" style="margin-left:auto">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"
          style="width:13px;height:13px;margin-right:5px;vertical-align:-2px">
          <path d="M12 5v14M5 12h14"/></svg>Choose${
        QUICK.length && QUICK[0].auto ? ' · auto' : ''}</button>
    </div>
    <div style="border:1px solid #35302A;border-radius:var(--r);background:var(--surface-2);
                box-shadow:0 var(--offset) 0 var(--shadow);overflow:hidden">
      <div style="position:relative;height:200px;background-image:${U.generatedArt('workout-hero','Lift',360,200)};background-size:cover">
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,8,6,.30),rgba(10,8,6,.10) 34%,rgba(10,8,6,.62) 74%,rgba(10,8,6,.88))"></div>
        <span style="position:absolute;left:13px;top:13px;z-index:2;background:var(--orange);color:#fff;
          border-radius:var(--r);padding:7px 12px;display:inline-flex;align-items:center;gap:8px;
          font-family:var(--display);font-weight:900;font-size:14px;letter-spacing:.11em">
          <i style="width:9px;height:9px;background:#fff;display:block"></i>0 MIN</span>
        <span style="position:absolute;right:13px;top:13px;z-index:2;background:rgba(237,229,210,.88);
          color:#151515;border-radius:var(--r);padding:7px 12px;font-family:var(--display);
          font-weight:900;font-size:14px;letter-spacing:.11em">0 MOVES · 0 SETS</span>
        <h2 style="position:absolute;left:14px;right:14px;bottom:12px;z-index:2;margin:0;
          font-family:var(--display);font-weight:900;font-size:40px;letter-spacing:-.03em;line-height:1.02;
          color:#fff;text-shadow:0 2px 6px rgba(10,8,6,.5)">Lift something today</h2>
      </div>
      <div style="border-top:1px solid #3A352E;padding:15px 14px 16px">
        <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:var(--muted)">
          Pick a workout from Quick start below, or build one from scratch — your moves, your sets, your pace.</p>
        <button class="btn-primary" data-go="session">+ Build your first session</button>
        <button class="btn-ghost" data-go="exercise-library" style="width:100%;margin-top:10px">
          Browse the exercise library</button>
        <button class="btn-ghost" data-go="loads" style="width:100%;margin-top:10px">
          Working loads and overload</button>
      </div>
    </div>

    <p class="caps muted" style="margin:26px 0 12px">Quick start</p>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
      ${QS.map(q => `<button class="ctile" style="padding:16px 6px 14px;align-items:center;gap:11px"
        data-qs="${q.act}">
        <span style="width:42px;height:42px;border-radius:9px;display:flex;align-items:center;justify-content:center;
          border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.2);
          background:linear-gradient(150deg,${q.a},${q.b})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;color:${q.dark?'#151515':'#fff'}"><path d="${q.d}"/></svg>
        </span>
        <b style="font-family:var(--display);font-weight:900;font-size:14.5px">${q.n}</b></button>`).join('')}
    </div>

    <details class="wk-fold" style="margin-top:26px">
      <summary>
        <b>My workouts</b>
        <span class="n">${ROUTINES && ROUTINES.length ? `${ROUTINES.length} saved` : 'none yet'}</span>
        <svg class="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
          stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div class="body">
    ${ROUTINES && ROUTINES.length ? `
      <div class="rt-pick">
        ${ROUTINES.slice(0, 6).map(r => {
          const cov = Routines.muscles(r).slice(0, 5);
          const top = cov.length ? cov[0].score : 1;
          const sets = r.items.reduce((n,i) => n + i.sets, 0);
          return `<button class="rt-tile" data-run="${r.id}">
            <span class="go"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg></span>
            <b>${r.name}</b>
            <span class="sets">${r.items.length} lifts · ${sets} sets</span>
            <span class="bars">
              ${cov.length
                ? cov.map(m => `<i style="background:${m.c};opacity:${
                    0.35 + 0.65 * (m.score / top)}"></i>`).join('')
                : '<i style="background:#2F2C26"></i>'}
            </span>
          </button>`;
        }).join('')}
      </div>
      <button class="btn-ghost" data-go="routines" style="width:100%;margin-top:4px">
        Manage all ${ROUTINES.length}</button>`
    : `<p class="note" style="text-align:left;margin:0 0 12px">Nothing saved yet.
        Pick a ready-made workout, or build one and save it.</p>`}
      </div>
    </details>

    <button class="btn-ghost" data-go="workout-gallery" style="width:100%">
      Browse workout types →</button>

    <p class="caps muted" style="margin:26px 0 12px">Recent</p>
    ${sessions.length ? `<div class="hist">${sessions.slice(0,5).map(r => {
        const d = new Date(r.finishedAt);
        return `<div class="hrow"><span class="d">${pad(d.getMonth()+1)}/${pad(d.getDate())}</span>
          <span class="n">${r.name} · ${r.setsCompleted}/${r.setsPlanned} sets</span>
          <span class="v">${Math.round(Units.toDisplay(r.volumeKg, unit)).toLocaleString()} ${unit}</span></div>`;
      }).join('')}</div>`
    : `<div style="border:1px solid #35302A;border-radius:var(--r);background:var(--surface-2);padding:18px 15px">
        <b style="display:block;font-family:var(--display);font-weight:900;font-size:21px;margin:0 0 7px">No sessions yet</b>
        <p style="margin:0;font-size:14.5px;line-height:1.55;color:var(--muted)">Finished workouts will land here. Start your first session to begin the streak.</p>
      </div>`}`;
  }

  function progressHTML(){
    const m = thisMonth(sessions);
    return `
    ${OVERLOAD ? `<button class="row" data-go="loads" style="width:100%;margin:0 0 14px;
      border:1px solid ${OVERLOAD.due ? 'var(--green)' : '#2B2822'};border-radius:var(--r);
      background:var(--surface-2);padding:14px">
      <span class="lbl">Working loads
        <small>${OVERLOAD.count} lift${OVERLOAD.count===1?'':'s'} tracked · ${
          OVERLOAD.due ? `+${OVERLOAD.pct}% is due now`
                       : `+${OVERLOAD.pct}% in ${OVERLOAD.days} day${OVERLOAD.days===1?'':'s'}`}</small></span>
      <span style="font-family:var(--display),sans-serif;font-weight:900;color:${
        OVERLOAD.due ? 'var(--green)' : 'var(--orange)'}">${OVERLOAD.due ? 'DUE' : '+' + OVERLOAD.pct + '%'}</span>
    </button>` : ''}

    <!-- these two said "0 photos" and "0 entries" and did nothing; both now open
         the physique log, which is where the counts come from -->
    <div class="ctiles">
      ${tile({ n:"Photos", s:`${PHYS.photos} photo${PHYS.photos === 1 ? '' : 's'}`,
               i:I.photo, on:PHYS.photos > 0, go:'physique' })}
      ${tile({ n:"Compare", s:PHYS.days > 1 ? `${PHYS.days} days logged` : 'needs two days',
               i:I.weight, on:PHYS.days > 1, go:'physique-compare' })}
    </div>
    <div class="sec"><h2>Session log</h2><div class="rule"></div><span class="alt">${sessions.length} saved</span></div>
    ${sessions.length ? `<div class="hist">${(ALL_SESSIONS ? sessions : sessions.slice(0, 10)).map(r => {
        const d = new Date(r.finishedAt);
        /* a button, not a div — the sets are stored and this is the way in */
        return `<button class="hrow" data-open-session="${r.id}">
          <span class="d">${pad(d.getMonth()+1)}/${pad(d.getDate())}</span>
          <span class="n">${r.name} · ${r.setsCompleted}/${r.setsPlanned} sets</span>
          <span class="v">${Math.round(Units.toDisplay(r.volumeKg, unit)).toLocaleString()} ${unit}</span></button>`;
      }).join('')}</div>
      ${sessions.length > 10 ? `<button class="btn-ghost" data-a="allsessions"
        style="width:100%;margin:10px 0 0">${ALL_SESSIONS
          ? 'Show the last 10 only'
          : `Show all ${sessions.length}`}</button>` : ''}`
    : `<div class="hist"><div class="histempty">No sessions logged yet. Finish a workout and it lands here.</div></div>`}
    <div class="exportbar">
      <button class="xbtn2" data-x="month" ${m.length?'':'disabled'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>This month</button>
      <button class="xbtn2" data-x="all" ${sessions.length?'':'disabled'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M8 8l4-4 4 4M4 20h16"/></svg>Export all</button>
    </div>
    <p class="note">Photos stay on this device. Export them with the weights from the
      physique log.</p>`;
  }

  function runsHTML(){
    const imperial = unit !== 'kg';
    const d = v => imperial ? v * 0.621371 : v;
    const lab = imperial ? 'mi' : 'km';
    const total = runs.reduce((a,r) => a + (r.km || 0), 0);
    const now = new Date();
    const month = runs.filter(r => {
      const x = new Date(r.at);
      return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear();
    }).reduce((a,r) => a + (r.km || 0), 0);
    const longest = runs.reduce((a,r) => Math.max(a, r.km || 0), 0);
    const recent = runs.slice(0, 5);
    const hms = sec => `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;

    /* Pace is the number you actually judge a run by, and it was nowhere. */
    const paceOf = r => (r.km > 0 && r.sec > 0) ? (r.sec / 60) / d(r.km) : null;
    const paceStr = p => p == null ? '—'
      : `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, '0')} /${lab}`;

    const KINDLABEL = { outdoor:'Outside', treadmill:'Treadmill', ruck:'Ruck' };
    const last = runs[0] || null;
    const lastPace = last ? paceOf(last) : null;

    /* the same kind, before this one — pace means nothing across kinds */
    const prevSame = last
      ? runs.find(r => r.id !== last.id && (r.kind || 'outdoor') === (last.kind || 'outdoor'))
      : null;
    const prevPace = prevSame ? paceOf(prevSame) : null;

    const byKind = {};
    runs.forEach(r => {
      const k = r.kind || 'outdoor';
      byKind[k] = byKind[k] || { n:0, km:0 };
      byKind[k].n++; byKind[k].km += r.km || 0;
    });

    return `
      <div class="hero" style="margin-bottom:14px">
        <p class="k">Distance all time</p>
        <p class="v">${d(total).toFixed(1)}<span> ${lab}</span></p>
        <p class="s">${runs.length} run${runs.length===1?'':'s'} · ${d(month).toFixed(1)} ${lab} this month · longest ${d(longest).toFixed(1)} ${lab}</p>
      </div>

      ${last ? `<div class="lastrun">
        <div class="lr-top">
          <b>Last ${KINDLABEL[last.kind || 'outdoor'].toLowerCase()}</b>
          <span>${new Date(last.at).toLocaleDateString(undefined,
            { weekday:'short', day:'numeric', month:'short' })}</span>
        </div>
        <div class="lr-nums">
          <div><b>${d(last.km).toFixed(2)}</b><small>${lab}</small></div>
          <div><b>${hms(last.sec || 0)}</b><small>time</small></div>
          <div><b>${paceStr(lastPace)}</b><small>pace</small></div>
          ${last.packKg ? `<div><b>${Math.round(Units.toDisplay(last.packKg, unit))}</b><small>${unit} pack</small></div>` : ''}
        </div>
        ${prevPace != null && lastPace != null ? `<p class="lr-vs${
          lastPace < prevPace ? ' up' : ''}">${
          lastPace < prevPace ? 'Faster than' : lastPace > prevPace ? 'Slower than' : 'Level with'
          } your last ${KINDLABEL[last.kind || 'outdoor'].toLowerCase()} — ${paceStr(prevPace)}</p>` : ''}
      </div>` : ''}

      ${Object.keys(byKind).length > 1 ? `<div class="kindbar">${
        Object.entries(byKind).map(([k, v]) =>
          `<span><b>${d(v.km).toFixed(1)}</b> ${lab} · ${KINDLABEL[k] || k}</span>`).join('')}</div>` : ''}

      <!-- the same tiles as Progress, so the console reads as one place -->
      <div class="ctiles">
        ${tile({ n:"Start a run", i:I.runner, on:true, go:'run-live',
                 a:'#C4613A', b:'#6C2B1C',
                 s: RunGPS && RunGPS.available() ? 'GPS or lap timer' : 'lap timer' })}
        ${tile({ n:"All runs", i:I.runlog, on:runs.length > 0, go:'runs',
                 a:'#3C7FA8', b:'#1D4460',
                 s: runs.length ? `${runs.length} logged · ${d(total).toFixed(1)} ${lab}` : 'nothing yet' })}
      </div>

      ${recent.length ? `<div class="sec"><h2>Recent</h2><div class="rule"></div>
          <span class="alt">${runs.length}</span></div>
        <div class="group" style="margin:0">
          ${recent.map(r => `<button class="row" data-go="runs">
            <span class="lbl">${d(r.km).toFixed(2)} ${lab} · ${paceStr(paceOf(r))}
              <small>${KINDLABEL[r.kind || 'outdoor']} · ${
                new Date(r.at).toLocaleDateString(undefined,{ weekday:'short', month:'short', day:'numeric' })}${
                r.note ? ' · ' + r.note : ''}</small></span>
            <span style="font-family:var(--display),sans-serif;font-weight:900">${hms(r.sec || 0)}</span>
          </button>`).join('')}
        </div>`
      : `<div class="empty"><b>No runs yet</b>Start one and tap LAP at each marker, or log it afterwards.</div>`}
      <p class="note">Distances follow your unit setting.</p>`;
  }

  function render(){
    const titles = { workouts:'Home', progress:'Progress', runs:'Runs' };
    root.innerHTML =
      Screens.bar({ kicker:'Workout console', title:titles[view] }) +
      `<div class="view">${view === 'workouts' ? trackerHTML() : view === 'progress' ? progressHTML() : runsHTML()}</div>
       <nav class="console-nav">${NAV.map(n => `
         <button class="cbtn" data-v="${n.v}" ${view===n.v?'aria-current="page"':''}>
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${n.d}"/></svg>
           ${n.label}</button>`).join('')}</nav>`;
  }

  function mount(el){
    root = el;
    /* mount runs again after every action, so the listener is attached once only —
       otherwise one tap fires the handler as many times as the screen has mounted */
    const firstMount = !el.dataset.wiredWorkout;
    el.dataset.wiredWorkout = '1';
    if(firstMount) el.addEventListener('click', async e => {
      const nav = e.target.closest('[data-v]');
      if(nav){ view = nav.dataset.v; render(); return; }
      const go = e.target.closest('[data-go]');
      const openSession = e.target.closest('[data-open-session]');
      if(openSession){
        Screens.push('session-view', { id:openSession.dataset.openSession });
        return;
      }
      if(e.target.closest('[data-a="allsessions"]')){ ALL_SESSIONS = !ALL_SESSIONS; render(); return; }

      if(go && go.dataset.go === 'physique'){ Screens.push('physique', { onChange:() => mount(root) }); return; }
      if(go && go.dataset.go === 'physique-compare'){ Screens.push('physique-compare', {}); return; }
      if(go && go.dataset.go === 'exercise-library'){ Screens.push('exercise-library', {}); return; }
      if(go && go.dataset.go === 'loads'){ Screens.push('loads', { onChange:() => mount(root) }); return; }
      if(go && go.dataset.go === 'routines'){ Screens.push('routines', { onChange:() => mount(root) }); return; }
      if(go && go.dataset.go === 'workout-gallery'){
        Screens.push('workout-gallery', { onChange:() => mount(root) }); return; }

      /* a quick-start tile: blank session, a saved routine, or a shipped workout */
      const qs = e.target.closest('[data-qs]');
      if(qs){
        const act = qs.dataset.qs;
        if(act === 'session'){ Screens.push('session', { onChange:() => mount(root) }); return; }
        const [kind, id] = act.split(':');
        if(kind === 'routine'){
          const r = await Routines.get(id);
          if(!r) return;
          const preset = await Routines.toSession(r);
          await Routines.markRun(r.id);
          Screens.push('session', { preset, onChange:() => mount(root) });
        } else {
          const t = await WorkoutTypes.expand(WorkoutTypes.byId(id));
          if(!t) return;
          const saved = await Routines.save({ name:t.n, note:t.d, type:t.type, items:t.items });
          const preset = await Routines.toSession(saved);
          await Routines.markRun(saved.id);
          Screens.push('session', { preset, onChange:() => mount(root) });
        }
        return;
      }

      if(e.target.closest('[data-a="editqs"]')) return openQuickStart();

      const run = e.target.closest('[data-run]');
      if(run){
        const r = await Routines.get(run.dataset.run);
        if(!r) return;
        const preset = await Routines.toSession(r);
        await Routines.markRun(r.id);
        Screens.push('session', { preset, onChange:() => mount(root) });
        return;
      }
      if(go && go.dataset.go === 'runs'){ Screens.push('runs', { onChange:() => mount(root) }); return; }
      if(go && go.dataset.go === 'run-live'){ Screens.push('run-live', { onChange:() => mount(root) }); return; }
      /* every push from here refreshes this screen on the way back — finishing a
         session and returning to a stale Recent list is what this fixes */
      if(go){ Screens.push(go.dataset.go, { onChange:() => mount(root) }); return; }
      const x = e.target.closest('[data-x]');
      if(!x) return;
      if(x.dataset.x === 'all') download('workout-sessions.csv', toCSV(sessions));
      else { const d = new Date();
        download(`workout-sessions-${d.getFullYear()}-${pad(d.getMonth()+1)}.csv`, toCSV(thisMonth(sessions))); }
    });
    (async () => {
      unit = await Units.get();
      try { const r = await Store.all('runs'); runs = r.values.sort((a,b) => b.at - a.at); }
      catch(e){ runs = []; }
      /* the overload clock, so Progress can nudge without being opened */
      try { ROUTINES = await Routines.all(); } catch(e){ ROUTINES = []; }
      try { QUICK = await Routines.quickStart(); } catch(e){ QUICK = []; }
      try {
        const sch = await Loads.schedule();
        const all = await Loads.all();
        OVERLOAD = { ...sch, count: all.filter(l => l.kg > 0).length };
      } catch(e){ OVERLOAD = null; }

      /* what the physique log actually holds, so the tiles stop saying zero */
      try {
        const entries = await Physique.all();
        PHYS = {
          photos: entries.filter(e => e.hasPhoto).length,
          weights: entries.filter(e => typeof e.kg === 'number' && e.kg > 0).length,
          days: entries.length
        };
      } catch(e){ PHYS = { photos:0, weights:0, days:0 }; }
      try { const { values } = await Store.all('sessions');
        sessions = values.sort((a,b) => b.finishedAt - a.finishedAt); }
      catch(e){ console.warn('Sessions unavailable', e); }
      render();
    })();
  }

  /* Choosing what sits on the front row. */
  async function openQuickStart(){
    const mine = await Routines.all();
    const shipped = (window.WorkoutTypes && WorkoutTypes.TYPES) || [];
    let chosen = (await Routines.quickStart())
      .filter(q => !q.auto)
      .map(q => q.kind + ':' + q.id);

    const rowFor = (kind, id, name, sub) => {
      const key = kind + ':' + id;
      const on = chosen.includes(key);
      return `<button class="ty-pin${on ? '' : ' off'}" data-pick="${key}">
        <span class="dot" style="background:${on ? 'var(--orange)' : 'var(--line)'}"></span>
        <span class="nm">${name}<span style="color:var(--dim);font-size:12.5px"> · ${sub}</span></span>
        <span class="sw"><i></i></span>
      </button>`;
    };

    const body = () => `
      ${mine.length ? `<p class="caps muted" style="font-size:11px;margin:0 0 6px">Your workouts</p>
        ${mine.map(r => rowFor('routine', r.id, r.name,
          `${r.items.length} lifts${r.runs ? ` · ${r.runs} runs` : ''}`)).join('')}` : ''}
      <p class="caps muted" style="font-size:11px;margin:16px 0 6px">Ready-made</p>
      ${shipped.slice(0, 12).map(t => rowFor('type', t.id, t.n, t.type)).join('')}`;

    App.sheet(`
      <h2>Quick start</h2>
      <p style="margin:0 0 12px;color:var(--muted);font-size:14.5px;line-height:1.55">
        Pick up to three. A blank session always keeps the first slot.
        Leave everything off and it uses whatever you run most.</p>
      <div style="max-height:46vh;overflow-y:auto;margin:0 0 14px" data-rows>${body()}</div>
      <div class="sheetcta">
        <button class="btn-primary" data-save>Save</button>
        <button class="btn-ghost" data-auto>Back to automatic</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        const p = e.target.closest('[data-pick]');
        if(p){
          const key = p.dataset.pick;
          if(chosen.includes(key)) chosen = chosen.filter(x => x !== key);
          else {
            if(chosen.length >= 3) return U.toast('Three is the limit — turn one off first');
            chosen.push(key);
          }
          sheetEl.querySelector('[data-rows]').innerHTML = body();
          return;
        }
        if(e.target.closest('[data-auto]')){
          await Routines.setQuickStart([]);
          App.closeSheet(); mount(root);
          return U.toast('Back to your most-run workouts');
        }
        if(!e.target.closest('[data-save]')) return;
        await Routines.setQuickStart(chosen.map(k => {
          const [kind, id] = k.split(':');
          return { kind, id };
        }));
        App.closeSheet(); mount(root);
      });
    });
  }

  Screens.register('workout', mount);
})();
