/* Weekly — read-only accountability view. No editing lives here by design. */
(function(global){
  const { ICON, generatedArt } = U;

  const GLYPH = {
    Clips:'M2.5 6h14v12h-14zM16.5 10.5L22 8v8l-5.5-2.5z',
    Shots:'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6',
    Edits:'M4 20l4-1 10-10-3-3L5 16zM14.5 6.5l3 3',
    Posts:'M12 19V5M6 11l6-6 6 6',
    Days:'M3 5h18v16H3zM8 3v4M16 3v4M3 11h18',
    clips:'M2.5 6h14v12h-14zM16.5 10.5L22 8v8l-5.5-2.5z',
    edits:'M4 20l4-1 10-10-3-3L5 16zM14.5 6.5l3 3'
  };

  /* A one-word read on the week, derived rather than decorative. */
  function verdict(w){
    const days = w.profile.find(p => p.l === 'Days').n;
    const hit = w.targets.filter(t => t.now >= t.goal * 0.9).length;
    if(days >= 5 && hit === w.targets.length) return { word:'Dialled', line:'Every target met and you showed up nearly every day. Hold this.' };
    if(days >= 4) return { word:'Consistent', line:`You worked on ${days} of the last 7 days. Output is steady — watch the target that's lagging.` };
    if(days >= 2) return { word:'Patchy', line:`Only ${days} active days this week. The work is fine; the frequency is the problem.` };
    if(days > 0)  return { word:'Stalled', line:'Barely any activity logged. One small thing today resets the pattern.' };
    return { word:'Idle', line:'Nothing logged this week yet. Start with the smallest task on Today.' };
  }

  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

  /* 5 rows of 14 days = the last 70 days, oldest row first. */
  function heatmap(days){
    const lvl = n => n === 0 ? 0 : n <= 1 ? 1 : n <= 3 ? 2 : 3;
    let html = '<div class="corner"></div>' + Array.from({length:14},(_,i) => `<div class="col">${i+1}</div>`).join('');
    for(let r = 0; r < 5; r++){
      const from = r * 14;
      const first = days[from];
      const label = first
        ? new Date(first.date).toLocaleDateString(undefined,{ month:'short', day:'numeric' })
        : '—';
      html += `<div class="rowlab">${label}</div>`;
      for(let c = 0; c < 14; c++){
        const d = days[from + c];
        const l = d ? lvl(d.n) : 0;
        const t = d ? `${new Date(d.date).toLocaleDateString()} · ${d.n} logged` : '';
        html += `<div class="cell${l ? ' l'+l : ''}" title="${t}"></div>`;
      }
    }
    return html;
  }

  async function mount(el){
    el.className = 'view';
    const w = await Data.weekly();
    const v = verdict(w);
    const days = await Data.activity(70);

    /* what is on the days, for the shoot-day line below */
    let tasks = [], today = 1;
    try {
      tasks = await Data.tasks();
      today = await Data.currentDay();
    } catch(e){ tasks = []; }

    /* The next shoot day, as a line rather than a chip. This is the planning view,
       so a countdown belongs here more than it did on Today. */
    function shootLine(){
      const shoots = tasks
        .filter(t => (t.kind === 'shoot' || t.cad === 'Shoot day') && t.view !== 'done')
        .sort((a, b) => a.day - b.day);
      const next = shoots.find(t => t.day >= today);
      if(!next && !shoots.length) return '';

      const away = next ? next.day - today : null;
      const when = away === 0 ? 'today' : away === 1 ? 'tomorrow' : `in ${away} days`;
      const sameDay = next ? shoots.filter(t => t.day === next.day).length : 0;

      return `<button class="shootline" data-act="calendar">
        <span class="ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <rect x="2.5" y="7" width="12" height="10" rx="2"/><path d="M14.5 11l6-3v8l-6-3z"/></svg>
        </span>
        <span class="tx">
          <b>${next ? `Next shoot ${when}` : 'No shoot day booked'}</b>
          <span>${next
            ? `${next.title}${sameDay > 1 ? ` · ${sameDay} things that day` : ''}${
                next.at ? ` · ${next.at}` : ''}`
            : 'Auto-schedule from the calendar, or tag a task as a shoot day'}</span>
        </span>
        ${next ? `<span class="cnt">${away === 0 ? 'NOW' : away + 'd'}</span>` : ''}
      </button>`;
    }

    el.innerHTML = `
    <style>
      .capsule{margin-left:auto;border:1px solid var(--line);border-radius:var(--r);padding:9px 13px;min-width:132px}
      .capsule .k{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);
        font-family:var(--display);font-weight:900;margin:0 0 5px}
      .capsule .v{display:flex;align-items:baseline;gap:5px;margin:0 0 7px}
      .capsule .v b{font-family:var(--display);font-weight:900;font-size:19px;letter-spacing:-.02em}
      .capsule .v span{font-size:13px;color:var(--muted)}
      .capsule .bar{height:3px;background:rgba(237,229,210,.1)}
      .capsule .bar i{display:block;height:100%;background:var(--amber)}
      .rule-full{height:1px;background:var(--line);margin:0 0 18px}
      .hero{position:relative;border:1px solid var(--line);border-radius:var(--r);overflow:hidden;
        min-height:330px;background:var(--surface-1)}
      .hero .bgart{position:absolute;inset:0;background-size:cover;background-position:center 30%}
      .hero .bgart::after{content:"";position:absolute;inset:0;
        background:linear-gradient(180deg,rgba(10,8,6,.62) 0%,rgba(10,8,6,.38) 34%,rgba(10,8,6,.80) 78%,rgba(10,8,6,.94) 100%)}
      .hero .inner{position:relative;z-index:2;padding:18px 15px 16px}
      .heroTop{display:flex;align-items:center;gap:10px;margin:0 0 14px}
      .share{margin-left:auto;border:1px solid rgba(237,229,210,.28);border-radius:var(--r);
        padding:7px 13px;font-size:12.5px;background:rgba(10,8,6,.4)}
      .hero h2{font-family:var(--display);font-weight:900;font-size:42px;letter-spacing:-.03em;
        text-transform:uppercase;margin:0 0 10px;line-height:1;color:#fff}
      .hero p.lede{margin:0 0 18px;font-size:15px;line-height:1.55;color:#D8D2C6;max-width:34ch}
      .hr-soft{height:1px;background:rgba(237,229,210,.16);margin:0 0 14px}
      .profile{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:0 0 16px}
      .pcell{border:1px solid rgba(237,229,210,.22);border-radius:var(--r);background:rgba(10,8,6,.34);
        padding:11px 4px 9px;text-align:center}
      .pcell svg{width:15px;height:15px;color:#E4DDD0;margin:0 0 7px}
      .pcell b{display:block;font-family:var(--display);font-weight:900;font-size:20px;line-height:1}
      .pcell span{display:block;font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:#B6AFA3;margin:6px 0 0}
      .ghostcta{width:100%;height:48px;border:1px solid rgba(237,229,210,.34);border-radius:var(--r);
        background:rgba(10,8,6,.32);color:var(--cream);font-family:var(--display);font-weight:900;
        font-size:15px;letter-spacing:.11em;text-transform:uppercase;cursor:pointer}
      .twoup{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0 0}
      .mini{background:var(--surface-2);border:1px solid #2B2822;border-radius:var(--r);padding:14px;
        min-height:150px;display:flex;flex-direction:column}
      .mini .k{font-family:var(--display);font-weight:900;font-size:11.5px;letter-spacing:.15em;
        text-transform:uppercase;color:var(--muted);margin:0 0 10px}
      .mini .big{font-family:var(--display);font-weight:900;font-size:36px;letter-spacing:-.03em;line-height:1;margin:0}
      .mini .s{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:9px 0 0}
      .spark{margin-top:auto;height:34px}
      .spark svg{width:100%;height:100%;display:block}
      .lock{width:30px;height:30px;border-radius:50%;border:1px solid var(--line);display:flex;
        align-items:center;justify-content:center;color:var(--dim);margin:0 0 12px}
      .lock svg{width:14px;height:14px}
      .mini h3{font-family:var(--display);font-weight:900;font-size:19px;line-height:1.15;margin:0 0 8px}
      .mini p{font-size:13.5px;line-height:1.5;color:var(--muted);margin:0}
      .goal{background:var(--surface-2);border:1px solid #2B2822;border-radius:var(--r);padding:15px 14px}
      .goal + .goal{margin-top:10px}
      .goalTop{display:flex;gap:12px;margin:0 0 12px}
      .goal .ic{width:38px;height:38px;flex:0 0 38px;border-radius:var(--r);background:var(--surface-1);
        border:1px solid #35302A;display:flex;align-items:center;justify-content:center;color:var(--muted)}
      .goal .ic svg{width:17px;height:17px}
      .goal h3{font-family:var(--display);font-weight:900;font-size:17px;margin:0 0 5px}
      .goal p{font-size:13.5px;line-height:1.5;color:var(--muted);margin:0}
      .goalFoot{display:flex;font-family:var(--display);font-weight:900;font-size:12px;letter-spacing:.12em;
        text-transform:uppercase;color:var(--muted);margin:0 0 9px}
      .goalFoot .n{margin-left:auto}
      .goalFoot .n.ok{color:var(--green)} .goalFoot .n.warn{color:var(--red)}
      /* The box clips; the strip inside it scrolls. Before this the grid simply
         ran past the border and took the whole page sideways with it. */
      .heat{background:var(--surface-2);border:1px solid #2B2822;border-radius:var(--r);
        padding:16px 0 16px 14px;overflow:hidden}
      .heatscroll{overflow-x:auto;overflow-y:hidden;padding-right:14px;
        scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch}
      .heatscroll::-webkit-scrollbar{display:none;width:0;height:0}
      /* a floor under each column, so it scrolls on purpose rather than squashing */
      .heatgrid{display:grid;grid-template-columns:auto repeat(14,minmax(19px,1fr));gap:5px;
        align-items:center;min-width:min-content}
      .heatgrid .col{font-size:9.5px;color:var(--dim);text-align:center}
      .heatgrid .rowlab,.heatgrid .corner{position:sticky;left:0;z-index:1;background:var(--surface-2);
        box-shadow:5px 0 0 var(--surface-2)}
      .heatgrid .rowlab{font-family:var(--display);font-weight:900;font-size:10.5px;letter-spacing:.11em;
        color:var(--muted);padding-right:8px;white-space:nowrap}
      .cell{aspect-ratio:1;border-radius:2px;background:rgba(237,229,210,.055)}
      .cell.l1{background:rgba(242,194,48,.22)}
      .cell.l2{background:rgba(242,194,48,.45)}
      .cell.l3{background:rgba(242,194,48,.72)}
    </style>

    <div class="pagehead" style="align-items:flex-start;margin-bottom:8px">
      <h1 class="page-title">Weekly</h1>
      <div class="capsule">
        <p class="k">This week</p>
        <p class="v"><b>${w.tasksDone}</b><span>/ ${w.tasksTotal} tasks</span></p>
        <div class="bar"><i style="width:${w.tasksTotal ? Math.round(w.tasksDone / w.tasksTotal * 100) : 0}%"></i></div>
      </div>
    </div>
    <div class="rule-full"></div>

    ${shootLine()}

    <section class="hero">
      <div class="bgart" style="background-image:${generatedArt('weekly','Week',360,330)}"></div>
      <div class="inner">
        <div class="heroTop">
          <p class="caps" style="font-size:12.5px;letter-spacing:.14em">Week in review · week 2</p>
          <span class="share">${w.workouts} workout${w.workouts === 1 ? "" : "s"}</span>
        </div>
        <h2>${v.word}</h2>
        <p class="lede">${v.line}</p>
        <div class="hr-soft"></div>
        <p class="caps muted" style="font-size:12.5px;margin:0 0 11px;color:#CFC8BB">Week profile</p>
        <div class="profile">
          ${w.profile.map(p => `<div class="pcell">${svg(GLYPH[p.l])}<b>${p.n}</b><span>${p.l}</span></div>`).join('')}
        </div>
        <button class="ghostcta" data-a="breakdown">Full breakdown →</button>
      </div>
    </section>

    <div class="twoup">
      <div class="mini">
        <p class="k">Output</p><p class="big">${w.profile[0].n}</p><p class="s">Clips since Mon</p>
        <div class="spark">${(() => {
          const max = Math.max(1, ...w.spark);
          const pts = w.spark.map((n,i) => `${i * (120 / Math.max(1, w.spark.length - 1))},${32 - (n / max) * 28}`);
          const last = pts[pts.length - 1] ? pts[pts.length - 1].split(',') : ['120','32'];
          return `<svg viewBox="0 0 120 34" preserveAspectRatio="none">
            <polyline points="${pts.join(' ')}" fill="none" stroke="#5BBE6A" stroke-width="2"/>
            <circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="#5BBE6A"/></svg>`;
        })()}</div>
      </div>
      <div class="mini">
        <p class="k">Suggestion</p>
        ${w.suggestion
          ? `<h3>${w.suggestion.title}</h3><p>${w.suggestion.body}</p>`
          : `<span class="lock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10" width="15" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>
             <h3>Log ${Math.max(1, 6 - w.logged)} more day${6 - w.logged === 1 ? '' : 's'} to unlock</h3>
             <p>Once there's enough logged we'll call out which days actually produce.</p>`}
      </div>
    </div>

    <div class="sechead"><h2>Weekly targets</h2><button class="link" data-a="targets" style="background:none;border:0;cursor:pointer;font-family:inherit">Edit ${ICON.chevR}</button></div>
    ${w.targets.map(t => {
      const pct = Math.round(t.now / t.goal * 100), ok = pct >= 85;
      return `<div class="goal">
        <div class="goalTop"><span class="ic">${svg(GLYPH[t.key])}</span>
          <div><h3>${t.title}</h3><p>${t.desc}</p></div></div>
        <div class="goalFoot"><span>${t.foot}</span><span class="n ${ok?'ok':'warn'}">${t.now} / ${t.goal}</span></div>
        <div class="track"><i class="${ok?'ok':'warn'}" style="width:${pct}%"></i></div>
      </div>`;
    }).join('')}

    <div class="sechead"><h2>Your activity, week by week</h2><span class="link">Last 70 days</span></div>
    <div class="heat"><div class="heatscroll"><div class="heatgrid">${heatmap(days)}</div></div></div>`;

    if(!el.dataset.wiredWeekly){ el.dataset.wiredWeekly = '1';
    /* the shoot line opens the calendar, where the whole run is visible */
    if(!el.dataset.wiredShoot){
      el.dataset.wiredShoot = '1';
      el.addEventListener('click', e => {
        if(e.target.closest('[data-act="calendar"]')) Screens.push('calendar', {});
      });
    }

    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if(!a) return;
      if(a.dataset.a === 'targets')   return openTargets(w, () => mount(el));
      if(a.dataset.a === 'breakdown') return openBreakdown(w, days);
    });
    }
  }

  function openTargets(w, after){
    App.sheet(`
      <h2>Weekly targets</h2>
      <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.55">
        What a good week looks like. The bars on this page measure against these.</p>
      <div class="field"><label for="tg-clips">Clips captured</label>
        <input id="tg-clips" type="number" min="1" value="${w.targets[0].goal}"></div>
      <div class="field"><label for="tg-edits">Edits finished</label>
        <input id="tg-edits" type="number" min="1" value="${w.targets[1].goal}"></div>
      <div class="sheetcta">
        <button class="btn-primary" data-save>Save targets</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-save]')) return;
        await Data.setTargets({
          clips: Math.max(1, +sheetEl.querySelector('#tg-clips').value || 1),
          edits: Math.max(1, +sheetEl.querySelector('#tg-edits').value || 1)
        });
        App.closeSheet(); after && after();
      });
    });
  }

  function openBreakdown(w, days){
    const active = days.filter(d => d.n > 0).length;
    const total = days.reduce((n,d) => n + d.n, 0);
    App.sheet(`
      <h2>Full breakdown</h2>
      <div class="group compact" style="margin:0">
        ${w.profile.map(p => `<div class="row"><span class="lbl">${p.l}</span>
          <span style="font-family:var(--display),sans-serif;font-weight:900">${p.n}</span></div>`).join('')}
        <div class="row"><span class="lbl">Tasks completed</span>
          <span style="font-family:var(--display),sans-serif;font-weight:900">${w.tasksDone} / ${w.tasksTotal}</span></div>
        <div class="row"><span class="lbl">Workouts</span>
          <span style="font-family:var(--display),sans-serif;font-weight:900">${w.workouts}</span></div>
        <div class="row"><span class="lbl">Volume lifted</span>
          <span style="font-family:var(--display),sans-serif;font-weight:900">${Math.round(w.volumeKg).toLocaleString()} kg</span></div>
        <div class="row"><span class="lbl">Active days, last 70</span>
          <span style="font-family:var(--display),sans-serif;font-weight:900">${active}</span></div>
        <div class="row"><span class="lbl">Things logged, last 70 days</span>
          <span style="font-family:var(--display),sans-serif;font-weight:900">${total}</span></div>
      </div>
      <div class="sheetcta"><button class="btn-ghost" data-cancel style="flex:1">Close</button></div>`,
    sheetEl => {
      sheetEl.addEventListener('click', e => { if(e.target.closest('[data-cancel]')) App.closeSheet(); });
    });
  }

  global.ViewWeekly = { mount };
})(window);
