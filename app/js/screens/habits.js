/* Year in dots — the habit screens, the editor, and what Today shows.

   'habits'  the year: every habit as a grid of days, a column per week
   'habit'   one habit: month by month, streaks, this week
   HabitsUI.edit(habit)            the add / edit sheet
   HabitsUI.decorate(root, tasks, day)
                                   Today's habit strip and the tags on its cards.
                                   views/today.js calls it after every list draw;
                                   that call is the only change Today needed.

   The data and every rule about what colour a dot is live in js/habits.js. */
(function(global){
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const todayKey = () => Habits.keyOf(Date.now());

  /* ------------------------------------------------ styles, once */
  (function(){
    if(document.getElementById('habits-css')) return;
    const st = document.createElement('style');
    st.id = 'habits-css';
    st.textContent = `
      .hb-year{display:flex;align-items:center;gap:6px;margin:0 0 4px}
      .hb-year h1{margin:0;font-family:var(--display),sans-serif;font-weight:900;font-size:38px;letter-spacing:-.025em;line-height:1}
      .hb-year .kick{margin:0 0 0 8px;align-self:flex-end;padding-bottom:4px;font-family:var(--display),sans-serif;
        font-weight:900;font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:var(--amber)}
      .hb-year .arrows{margin-left:auto;display:flex;gap:2px}
      .hb-year .arrows button{width:44px;height:44px;background:none;border:0;color:var(--muted);display:flex;
        align-items:center;justify-content:center;cursor:pointer}
      .hb-year .arrows svg{width:18px;height:18px}
      .hb-sub{margin:0 0 14px;font-size:14.5px;color:var(--muted)}
      .hb-chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
      .hb-chips button{height:30px;padding:0 14px;border-radius:var(--r);border:1px solid var(--line);
        background:var(--surface-1);color:var(--cream);font-size:13.5px;cursor:pointer}
      .hb-chips button[aria-pressed="true"]{background:var(--cream);border-color:var(--cream);color:var(--bg);font-weight:700}
      .hb-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 18px}
      .hb-stats.two{grid-template-columns:repeat(2,minmax(0,1fr))}
      .hb-stat{background:var(--surface-1);border-radius:var(--r);box-shadow:var(--offset) var(--offset) 0 var(--shadow);
        padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}
      .hb-stat b{font-family:var(--display),sans-serif;font-weight:900;font-size:26px;line-height:1.1;white-space:nowrap}
      .hb-stat b small{font-size:15px;color:var(--muted);font-weight:700}
      .hb-stat span{font-size:12px;color:var(--muted)}
      .hb-stat.hot b{color:var(--orange)}
      .hb-months{display:grid;column-gap:1.2px;padding:0 8px;margin:0 0 4px}
      .hb-months span{font-size:10px;font-weight:700;color:var(--muted);white-space:nowrap}
      .hb-list{display:flex;flex-direction:column;gap:12px}
      .hb-card{background:var(--surface-1);border-radius:var(--r);box-shadow:var(--offset) var(--offset) 0 var(--shadow);
        padding:9px 8px 10px;display:flex;flex-direction:column;gap:8px;cursor:pointer;text-align:left}
      .hb-top{display:flex;align-items:baseline;gap:8px;padding:0 2px;min-width:0}
      .hb-top i{width:9px;height:9px;border-radius:2px;flex:0 0 9px;align-self:center}
      .hb-top b{font-size:15px;font-weight:700;white-space:nowrap}
      .hb-top span{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
      .hb-top em{margin-left:auto;font-style:normal;font-family:var(--display),sans-serif;font-weight:900;font-size:17px}
      .hb-grid{display:grid;grid-template-rows:repeat(7,auto);grid-auto-flow:column;gap:1.2px}
      /* padding, not aspect-ratio: Safari on the iPad sized aspect-ratio cells wrong */
      .hb-d{display:block;height:0;padding-top:100%;border-radius:1px}
      .hb-wk{display:grid;column-gap:1.2px;margin-top:-4px}
      .hb-wk span{height:3px;border-radius:1px}
      .hb-legend{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin:16px 2px 0;font-size:12px;color:var(--muted)}
      .hb-legend span{display:flex;align-items:center;gap:5px}
      .hb-legend i{display:inline-block;width:9px;height:9px;border-radius:1px}
      .hb-empty{background:var(--surface-1);border-radius:var(--r);box-shadow:var(--offset) var(--offset) 0 var(--shadow);padding:16px}
      .hb-empty p{margin:0 0 12px;color:var(--muted);font-size:14.5px;line-height:1.5}
      .hb-empty .sugg{display:flex;flex-direction:column;gap:8px}
      .hb-empty .sugg button{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;text-align:left;
        background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r);color:var(--cream);font-size:14.5px;cursor:pointer}
      .hb-empty .sugg i{width:10px;height:10px;border-radius:2px;flex:0 0 10px}
      .hb-empty .sugg small{margin-left:auto;color:var(--muted);font-size:12.5px}

      .hb-mrows{background:var(--surface-1);border-radius:var(--r);box-shadow:var(--offset) var(--offset) 0 var(--shadow);
        padding:12px;display:flex;flex-direction:column;gap:4px;margin:0 0 18px}
      .hb-mrow{display:flex;align-items:center;gap:6px}
      .hb-mrow > span{width:26px;flex:0 0 26px;font-size:11px;font-weight:700;color:var(--muted)}
      .hb-mrow > em{width:32px;flex:0 0 32px;text-align:right;font-style:normal;font-size:11px;font-weight:700}
      .hb-mrow .g{flex:1;display:grid;grid-template-columns:repeat(31,minmax(0,1fr));gap:1.5px}
      .hb-capsrow{display:flex;align-items:center;margin:0 0 8px}
      .hb-caps{margin:0;font-family:var(--display),sans-serif;font-weight:900;font-size:13px;letter-spacing:.15em;
        text-transform:uppercase;color:var(--muted)}
      .hb-caps.amber{color:var(--amber)}
      .hb-capsrow small{margin-left:auto;font-size:12px;color:var(--muted)}
      .hb-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin:0 0 18px}
      .hb-week button{height:54px;border-radius:var(--r);display:flex;flex-direction:column;align-items:center;
        justify-content:center;gap:2px;border:1px solid var(--line);background:var(--surface-1);color:var(--muted);font:inherit}
      .hb-week button b{font-family:var(--display),sans-serif;font-weight:900;font-size:17px;color:inherit}
      .hb-week button small{font-size:11px;font-weight:700}
      .hb-week button.done{background:var(--hb);border-color:var(--hb);color:#151515;box-shadow:4px 4px 0 var(--shadow)}
      .hb-week button.today{border:2px solid var(--hb);color:var(--cream)}
      .hb-week button.ahead{border-style:dashed;opacity:.7}
      .hb-week button:disabled{cursor:default}
      .hb-note{display:flex;gap:12px;align-items:center;padding:12px;border-radius:var(--r);
        background:color-mix(in srgb, var(--orange) 8%, transparent);border:1px solid color-mix(in srgb, var(--orange) 30%, transparent);
        font-size:13.5px;line-height:1.45}

      /* the editor */
      .hb-opts{display:flex;flex-direction:column;gap:6px}
      .hb-opts button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:48px;padding:9px 12px;
        text-align:left;background:var(--surface-1);border:1px solid var(--line);border-radius:var(--r);color:var(--cream);cursor:pointer}
      .hb-opts button b{font-size:14.5px}
      .hb-opts button small{font-size:12.5px;color:var(--muted)}
      .hb-opts button[aria-pressed="true"]{border-color:var(--orange);box-shadow:inset 3px 0 0 var(--orange)}
      .hb-sw{display:flex;gap:8px;flex-wrap:wrap}
      .hb-sw button{width:38px;height:38px;border-radius:var(--r);border:0;cursor:pointer}
      .hb-sw button[aria-pressed="true"]{box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--cream)}
      .hb-row2{display:flex;gap:8px}
      .hb-row2 input,.hb-row2 select,.hb-in{height:44px;box-sizing:border-box;padding:0 10px;background:var(--surface-1);
        border:1px solid var(--line);border-radius:var(--r);color:var(--cream);font-size:15px;min-width:0}
      .hb-in{width:100%}
      .hb-danger{background:none;border:0;color:var(--red);font-weight:700;padding:12px 0;cursor:pointer}

      /* Today */
      .hb-strip{background:var(--surface-1);border-radius:var(--r);box-shadow:var(--offset) var(--offset) 0 var(--shadow);
        padding:10px 12px 12px;margin:0 0 14px}
      .hb-strip .h{display:flex;align-items:center;margin:0 0 8px}
      .hb-strip .h p{margin:0;font-family:var(--display),sans-serif;font-weight:900;font-size:12.5px;letter-spacing:.14em;
        text-transform:uppercase;color:var(--amber)}
      .hb-strip .h button{margin-left:auto;background:none;border:0;color:var(--orange-hi);font-weight:700;font-size:13px;
        padding:6px 0 6px 10px;cursor:pointer}
      .hb-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
      .hb-tile{border-radius:var(--r);padding:7px 7px 8px;display:flex;flex-direction:column;gap:4px;min-width:0;
        background:var(--bg);border:1px solid var(--line);color:var(--cream);text-align:left;cursor:pointer;font:inherit}
      .hb-tile.done{background:var(--surface-2);border-color:var(--surface-2)}
      .hb-tile .n{display:flex;align-items:center;gap:5px;min-width:0}
      .hb-tile .n i{width:8px;height:8px;border-radius:2px;flex:0 0 8px}
      .hb-tile .n b{font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .hb-tile small{font-size:11px;color:var(--muted)}
      .hb-tile.done small{color:var(--hb);font-weight:700}
      .hb-strip.empty{display:flex;align-items:center;gap:10px;padding:12px;cursor:pointer;color:var(--cream);
        border:0;width:100%;text-align:left;font:inherit}
      .hb-strip.empty span{font-size:14px}
      .hb-strip.empty small{margin-left:auto;color:var(--orange-hi);font-weight:700;font-size:13px}
      .hb-tag{display:flex;align-items:center;gap:8px;margin:8px 0 0;padding:7px 52px 0 0;border-top:1px solid var(--line);
        font-size:12.5px;min-width:0}
      .hb-tag i{width:8px;height:8px;border-radius:2px;flex:0 0 8px}
      .hb-tag b{white-space:nowrap}
      .hb-tag span{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
      .hb-tag .wk{margin-left:auto;display:flex;gap:3px;flex:0 0 auto}
      .hb-tag .wk s{width:9px;height:9px;border-radius:2px;text-decoration:none}
      .hb-tag .bump{margin-left:auto;flex:0 0 auto;height:30px;padding:0 10px;background:var(--surface-2);
        border:1px solid var(--line);border-radius:var(--r);color:var(--cream);font-weight:700;font-size:12.5px;cursor:pointer}`;
    document.head.appendChild(st);
  })();

  /* ------------------------------------------------ dots */
  function dotStyle(st, c){
    switch(st){
      case 'done':  return `background:${c}`;
      case 'part':  return `background:${c}66`;
      case 'miss':  return 'background:var(--line)';
      case 'rest':  return 'background:transparent;box-shadow:inset 0 0 0 1px var(--surface-2)';
      case 'today': return `background:transparent;box-shadow:inset 0 0 0 1.4px ${c}`;
      case 'ahead': return 'background:var(--divider)';
      default:      return 'background:transparent';
    }
  }
  const weekBarStyle = (state, c) =>
    state === 'hit' ? `background:${c}` : state === 'miss' ? 'background:var(--line)'
    : state === 'now' ? `background:${c}55` : state === 'ahead' ? 'background:var(--divider)' : 'background:transparent';

  function gridHTML(h, year, idx, tk){
    const y = Habits.yearOf(h, year, idx, tk);
    let cells = '';
    for(let i = 0; i < y.lead; i++) cells += '<span class="hb-d"></span>';
    y.days.forEach(d => { cells += `<span class="hb-d" style="${dotStyle(d.st, h.color)}"></span>`; });
    let bars = '';
    if(h.per === 'week'){
      bars = `<div class="hb-wk" style="grid-template-columns:repeat(${y.cols},minmax(0,1fr))">` +
        Habits.weeksOf(h, year, idx, tk).map(w => `<span style="${weekBarStyle(w.state, h.color)}"></span>`).join('') +
        '</div>';
    }
    return { html: `<div class="hb-grid" style="grid-template-columns:repeat(${y.cols},minmax(0,1fr))">${cells}</div>` + bars, cols: y.cols, lead: y.lead };
  }
  function monthLabels(year, cols, lead){
    const first = new Date(year, 0, 1).getTime();
    return `<div class="hb-months" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">` +
      MONTHS.map((m, i) => {
        const doy = Math.round((new Date(year, i, 1).getTime() - first) / 86400000);
        const col = Math.floor((lead + doy) / 7) + 1;
        return `<span style="grid-column:${col} / span 4">${m}</span>`;
      }).join('') + '</div>';
  }

  const CHEV_L = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.4 3.6 17.5 5.7 11.2 12l6.3 6.3-2.1 2.1L7 12z"/></svg>';
  const CHEV_R = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.6 3.6 6.5 5.7l6.3 6.3-6.3 6.3 2.1 2.1L17 12z"/></svg>';

  const SUGGEST = [
    { name:'Workout', per:'week', times:6, color:'#5BBE6A', group:'Body', source:{ type:'kind', kind:'workout' }, why:'6 a week · counts workout tasks and sessions' },
    { name:'Run', per:'week', times:3, color:'#E2564A', group:'Body', source:{ type:'runs' }, why:'3 a week · reads your run log' },
    { name:'Film something', per:'day', color:'#FB6900', group:'Content', source:{ type:'kind', kind:'shoot' }, why:'every day · any finished shoot task' },
    { name:'Drink water', per:'day', color:'#4F9DF7', group:'Body', source:{ type:'own', amount:8, unit:'cups' }, why:'8 cups a day · its own task' },
    { name:'Read', per:'day', color:'#A855F7', group:'Mind', source:{ type:'own', amount:20, unit:'min' }, why:'20 min a day · its own task' }
  ];

  /* ------------------------------------------------ the year */
  function mountYear(el, params){
    let year = (params && params.year) || new Date().getFullYear();
    let group = '';

    async function render(){
      const [habits, idx] = await Promise.all([Habits.all(), Habits.facts()]);
      const tk = todayKey();
      const shown = group ? habits.filter(h => h.group === group) : habits;
      const groups = Habits.GROUPS.filter(g => habits.some(h => h.group === g));

      const scored = shown.map(h => ({ h, s: Habits.score(h, year, idx, tk) }))
        .sort((a, b) => (b.s.pct == null ? -1 : b.s.pct) - (a.s.pct == null ? -1 : a.s.pct));
      const pcts = scored.map(x => x.s.pct).filter(p => p != null);
      const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) + '%' : '–';
      const perfect = Habits.perfectDays(shown, year, idx, tk);
      const bestAll = shown.length ? Math.max(...shown.map(h => Habits.best(h, idx, tk, year))) : 0;

      const now = new Date();
      const doy = Math.round((Habits.fromKey(tk) - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
      const len = Math.round((new Date(year + 1, 0, 1) - new Date(year, 0, 1)) / 86400000);
      const sub = year === now.getFullYear() ? `Day ${doy} of ${len} · ${shown.length} habit${shown.length === 1 ? '' : 's'}`
        : year > now.getFullYear() ? `Starts in ${year - now.getFullYear() === 1 ? 'the new year' : year}` : `${year} · looking back`;

      let first = null;
      const cards = scored.map(({ h, s }) => {
        const g = gridHTML(h, year, idx, tk);
        if(!first) first = g;
        const extra = h.per === 'week' ? ` · ${s.hit} of ${s.of} wks` : '';
        return `<article class="hb-card" data-h="${esc(h.id)}" role="button" tabindex="0" aria-label="${esc(h.name)}">
          <div class="hb-top"><i style="background:${h.color}"></i><b>${esc(h.name)}</b>
            <span>${esc(Habits.goalLabel(h))}${extra}</span><em>${s.pct == null ? '–' : s.pct + '%'}</em></div>
          ${g.html}
        </article>`;
      }).join('');

      el.innerHTML = Screens.bar({ kicker:'Habits', title:'Year in dots',
        actions:'<button class="btn-sm accent" data-a="new">+ Habit</button>' }) + `
      <div class="view">
        <div class="hb-year">
          <h1>${year}</h1><p class="kick">Year in dots</p>
          <div class="arrows">
            <button data-y="${year - 1}" aria-label="Previous year">${CHEV_L}</button>
            <button data-y="${year + 1}" aria-label="Next year">${CHEV_R}</button>
          </div>
        </div>
        <p class="hb-sub">${sub}</p>

        ${habits.length ? `
          ${groups.length ? `<div class="hb-chips">
            <button data-g="" aria-pressed="${!group}">All</button>
            ${groups.map(g => `<button data-g="${g}" aria-pressed="${group === g}">${g}</button>`).join('')}
          </div>` : ''}
          <div class="hb-stats">
            <div class="hb-stat"><b>${avg}</b><span>Year so far</span></div>
            <div class="hb-stat hot"><b>${perfect}</b><span>Perfect days</span></div>
            <div class="hb-stat"><b>${bestAll}</b><span>Best streak</span></div>
          </div>
          ${first ? monthLabels(year, first.cols, first.lead) : ''}
          <div class="hb-list">${cards}</div>
          <div class="hb-legend">
            <span><i style="background:var(--orange)"></i>Done</span>
            <span><i style="background:color-mix(in srgb, var(--orange) 40%, transparent)"></i>Partly</span>
            <span><i style="background:var(--line)"></i>Missed</span>
            <span><i style="box-shadow:inset 0 0 0 1px var(--surface-2)"></i>Day off</span>
            <span><i style="background:var(--divider)"></i>Ahead</span>
            <span><i style="width:14px;height:3px;background:var(--green)"></i>Week goal hit</span>
          </div>`
        : `<div class="hb-empty">
            <p>Each habit watches something you already do and fills a dot when it happens — a finished
              workout, a logged run, a task you repeat. Start with one:</p>
            <div class="sugg">${SUGGEST.map((s, i) => `<button data-sug="${i}"><i style="background:${s.color}"></i>
              ${esc(s.name)}<small>${esc(s.why)}</small></button>`).join('')}
              <button data-a="new"><i style="background:var(--muted)"></i>Something else<small>start blank</small></button>
            </div>
          </div>`}
      </div>`;
    }

    el.addEventListener('click', e => {
      const y = e.target.closest('[data-y]');
      if(y){ year = +y.dataset.y; return render(); }
      const g = e.target.closest('[data-g]');
      if(g){ group = g.dataset.g; return render(); }
      if(e.target.closest('[data-a="new"]')) return edit(null, render);
      const s = e.target.closest('[data-sug]');
      if(s){ const { why, ...rest } = SUGGEST[+s.dataset.sug]; return edit(rest, render); }
      const c = e.target.closest('[data-h]');
      if(c) Screens.push('habit', { id:c.dataset.h, year, onChange: render });
    });
    el.addEventListener('keydown', e => {
      if(e.key !== 'Enter') return;
      const c = e.target.closest('[data-h]');
      if(c) Screens.push('habit', { id:c.dataset.h, year, onChange: render });
    });
    render();
  }

  /* ------------------------------------------------ one habit */
  function mountHabit(el, params){
    const year = (params && params.year) || new Date().getFullYear();

    async function render(){
      const h = await Habits.get(params.id);
      if(!h){ el.innerHTML = Screens.bar({ title:'Habit' }) + '<div class="view"><p class="hb-sub">This habit was removed.</p></div>'; return; }
      const idx = await Habits.facts();
      const tk = todayKey();
      const s = Habits.score(h, year, idx, tk);
      const cur = Habits.streak(h, idx, tk);
      const best = Habits.best(h, idx, tk, year);
      const yr = Habits.yearOf(h, year, idx, tk);
      let seriesName = '';
      if(h.source.type === 'series'){
        const one = (await Data.tasks()).filter(t => t.series === h.source.series).sort((a, b) => b.day - a.day)[0];
        seriesName = one ? one.title : '';
      }

      /* month rows: 31 cells each, the spare ones empty */
      let at = 0;
      const rows = MONTHS.map((m, i) => {
        const len = new Date(year, i + 1, 0).getDate();
        const days = yr.days.slice(at, at + len); at += len;
        const counted = days.filter(d => ['done', 'part', 'miss'].includes(d.st));
        const done = days.filter(d => d.st === 'done').length;
        const pct = h.per === 'week'
          ? (days.some(d => d.st === 'done') ? done + '×' : '–')
          : counted.length ? Math.round(done / counted.length * 100) + '%' : '–';
        const cells = days.map(d => `<span class="hb-d" style="${dotStyle(d.st, h.color)}"></span>`).join('') +
          '<span class="hb-d"></span>'.repeat(31 - len);
        return `<div class="hb-mrow"><span>${m}</span><div class="g">${cells}</div><em>${pct}</em></div>`;
      }).join('');

      /* this week, Sunday to Saturday */
      const sun = Habits.fromKey(Habits.weekKey(tk));
      const D = ['Su','Mo','Tu','We','Th','Fr','Sa'];
      const own = h.source.type === 'own';
      const week = D.map((dw, i) => {
        const k = Habits.keyOf(Habits.addDays(sun, i));
        const st = Habits.dayStatus(h, k, idx, tk);
        const cls = st === 'done' ? 'done' : st === 'today' ? 'today' : st === 'ahead' ? 'ahead' : '';
        const word = { done:'done', part:'partly done', miss:'missed', rest:'day off', today:'today, not done yet', ahead:'ahead', before:'before this habit' }[st] || st;
        return `<button class="${cls}" data-k="${k}" ${own && st !== 'ahead' && st !== 'before' ? '' : 'disabled'}
          aria-label="${dw} ${new Date(Habits.fromKey(k)).getDate()}, ${word}">
          <small>${dw}</small><b>${new Date(Habits.fromKey(k)).getDate()}</b></button>`;
      }).join('');
      const wc = h.per === 'week' ? Habits.weekCount(h, tk, idx, tk) : null;

      el.innerHTML = Screens.bar({ kicker: (h.group ? h.group + ' · ' : '') + year, title: esc(h.name),
        actions:'<button class="btn-sm" data-a="edit">Edit</button>' }) + `
      <div class="view" style="--hb:${h.color}">
        <p class="hb-sub" style="margin-top:4px">${esc(Habits.goalLabel(h))} · fills from ${esc(Habits.sourceLabel(h, seriesName))}</p>
        <div class="hb-stats two">
          <div class="hb-stat"><b style="color:${h.color}">${s.pct == null ? '–' : s.pct + '%'}</b><span>Year so far</span></div>
          <div class="hb-stat"><b>${h.per === 'week' ? s.hit + '<small> / ' + s.of + '</small>' : (s.hit | 0) + '<small> / ' + s.of + '</small>'}</b>
            <span>${h.per === 'week' ? 'Weeks hit' : 'Days done'}</span></div>
          <div class="hb-stat"><b>${cur.n}</b><span>Current streak · ${cur.unit}</span></div>
          <div class="hb-stat"><b>${best}</b><span>Best streak</span></div>
        </div>

        <div class="hb-capsrow"><p class="hb-caps amber">Month by month</p>
          <small>${h.per === 'week' ? 'times per month' : 'share of due days'}</small></div>
        <div class="hb-mrows">${rows}</div>

        <div class="hb-capsrow"><p class="hb-caps">This week</p>
          ${wc != null ? `<small>${wc} of ${h.times} so far</small>` : ''}</div>
        <div class="hb-week">${week}</div>

        <div class="hb-note">${own
          ? 'It puts a task on <b>Today</b> for each of its days. Tick it there, or tap a day above.'
          : 'Nothing to tick here: it fills itself from ' + esc(Habits.sourceLabel(h, seriesName)) + '.'}</div>
      </div>`;
    }

    el.addEventListener('click', async e => {
      if(e.target.closest('[data-a="edit"]')){
        const h = await Habits.get(params.id);
        return edit(h, () => { render(); params.onChange && params.onChange(); }, () => { params.onChange && params.onChange(); Screens.pop(); });
      }
      const b = e.target.closest('.hb-week [data-k]');
      if(b && !b.disabled){
        await toggleOwn(params.id, b.dataset.k);
        render();
        params.onChange && params.onChange();
      }
    });
    render();
  }

  /* Tick or untick an own-task habit on a date, making its task if needed. */
  async function toggleOwn(habitId, k){
    const h = await Habits.get(habitId);
    if(!h) return;
    const day = await Data.dateToDay(Habits.fromKey(k) + 9 * 3600000);
    const tasks = await Data.tasks();
    let t = tasks.find(x => x.habitId === h.id && x.day === day);
    if(!t) t = Habits.ownTaskFor(h, day);
    else t = { ...t };
    const done = t.view !== 'done';
    t.view = done ? 'done' : 'todo';
    const a = Habits.amountOf(t.prog);
    if(a) t.prog = `${done ? a.b : 0} / ${String(t.prog).replace(/^\s*[\d.]+\s*\/\s*/, '')}`;
    await Store.put('tasks', t);
    Data.invalidate('tasks');
  }

  /* ------------------------------------------------ the editor */
  function edit(existing, onSaved, onRemoved){
    const isNew = !existing || !existing.id;
    const d = Habits.normalise(existing || { name:'', per:'day', source:{ type:'own' } });
    if(!existing || !existing.color){
      /* a colour nobody is using yet */
      Habits.all().then(list => {
        const used = new Set(list.map(x => x.color));
        const free = Habits.COLORS.find(c => !used.has(c));
        if(free && !(existing && existing.color)){ d.color = free; paint(); }
      });
    }
    let seriesList = [], armed = false, sheetEl = null;

    const SRC = [
      ['own',    'Its own task on Today', 'made for you, a week ahead'],
      ['series', 'A task I already repeat', 'pick one of your repeating tasks'],
      ['kind',   'Any finished task of a type', 'Workout, Shoot, Edit or Publish'],
      ['runs',   'My run log', 'any run you log']
    ];

    function html(){
      const s = d.source;
      return `
      <h2 style="margin:0 0 14px">${isNew ? 'New habit' : 'Edit habit'}</h2>
      <input id="hb-name" class="pgname" type="text" value="${esc(d.name === 'Untitled habit' ? '' : d.name)}"
        placeholder="Drink water" autocomplete="off" aria-label="Habit name">
      <p class="err" id="hb-err" hidden>Give the habit a name first.</p>

      <h3 class="pgh">What fills the dot?</h3>
      <div class="hb-opts">${SRC.map(([v, b, sm]) =>
        `<button type="button" data-src="${v}" aria-pressed="${s.type === v}"><b>${b}</b><small>${sm}</small></button>`).join('')}
      </div>
      ${s.type === 'own' ? `
        <div class="hb-row2" style="margin-top:8px">
          <input id="hb-amt" type="number" min="0" inputmode="decimal" value="${s.amount || ''}" placeholder="Amount" aria-label="Amount" style="width:90px">
          <input id="hb-unit" type="text" value="${esc(s.unit)}" placeholder="cups, min, pages… (optional)" aria-label="Unit" style="flex:1">
        </div>
        <p class="hintline">With an amount, a day you start but don't finish shows as a faded dot.</p>` : ''}
      ${s.type === 'series' ? `
        <select id="hb-series" class="hb-in" style="margin-top:8px" aria-label="Repeating task">
          ${seriesList.length ? seriesList.map(x => `<option value="${esc(x.key)}" ${x.key === s.series ? 'selected' : ''}>${esc(x.title)} · ${esc(x.label)}</option>`).join('')
            : '<option value="">No repeating tasks yet</option>'}
        </select>` : ''}
      ${s.type === 'kind' ? `
        <select id="hb-kind" class="hb-in" style="margin-top:8px" aria-label="Task type">
          ${Object.entries(Habits.KINDS).map(([k, n]) => `<option value="${k}" ${k === s.kind ? 'selected' : ''}>${n}${k === 'workout' ? ' — tasks and finished sessions' : ''}</option>`).join('')}
        </select>` : ''}

      <h3 class="pgh">Goal</h3>
      <div class="pgseg">
        <button type="button" data-per="day" aria-pressed="${d.per === 'day'}"><b>On set days</b><small>each one is a dot</small></button>
        <button type="button" data-per="week" aria-pressed="${d.per === 'week'}"><b>Times a week</b><small>days off don't count</small></button>
      </div>
      ${d.per === 'week' ? `
        <div class="pgstep" style="margin-top:8px">
          <button type="button" class="bump" data-times="-1" aria-label="Fewer">&minus;</button>
          <span class="val"><b>${d.times}</b><i>a week</i></span>
          <button type="button" class="bump" data-times="1" aria-label="More">+</button>
        </div>` : ''}
      ${d.per === 'day' || s.type === 'own' ? `
        <p class="hintline" style="margin:10px 0 6px">${d.per === 'day' ? 'Which days count' : 'Which days its task goes on'}</p>
        <div id="hb-days">${U.dayGrid(d.days)}</div>` : ''}

      <h3 class="pgh">Colour</h3>
      <div class="hb-sw">${Habits.COLORS.map(c =>
        `<button type="button" data-c="${c}" aria-pressed="${c === d.color}" aria-label="Colour ${c}" style="background:${c}"></button>`).join('')}</div>

      <h3 class="pgh">Group <span style="font-weight:400;font-size:13px;color:var(--muted)">optional</span></h3>
      <div class="hb-chips" style="margin:0">
        <button type="button" data-grp="" aria-pressed="${!d.group}">None</button>
        ${Habits.GROUPS.map(g => `<button type="button" data-grp="${g}" aria-pressed="${d.group === g}">${g}</button>`).join('')}
      </div>

      <div class="sheetcta">
        <button class="btn-primary" data-hb="save">${isNew ? 'Add habit' : 'Save'}</button>
        <button class="btn-ghost" data-hb="cancel">Cancel</button>
      </div>
      ${isNew ? '' : `<button class="hb-danger" data-hb="delete">${armed ? 'Tap again to delete — the dots go too' : 'Delete habit'}</button>`}`;
    }

    /* fields typed into survive a redraw */
    function read(){
      if(!sheetEl) return;
      const v = id => { const x = sheetEl.querySelector('#' + id); return x ? x.value : null; };
      if(v('hb-name') != null) d.name = v('hb-name');
      if(v('hb-amt') != null) d.source.amount = +v('hb-amt') || null;
      if(v('hb-unit') != null) d.source.unit = v('hb-unit');
      if(v('hb-series') != null) d.source.series = v('hb-series') || null;
      if(v('hb-kind') != null) d.source.kind = v('hb-kind');
      const grid = sheetEl.querySelector('#hb-days');
      if(grid){ const days = U.readDayGrid(grid); if(days.length) d.days = days; }
    }
    function paint(){ if(sheetEl){ read(); sheetEl.innerHTML = html(); } }

    Data.tasks().then(tasks => {
      /* every repeating set, newest first, named by its latest task */
      const by = new Map();
      tasks.forEach(t => {
        if(!t.series || String(t.series).indexOf('habit:') === 0) return;
        const cur = by.get(t.series) || { key:t.series, title:t.title, day:-1e9, n:0 };
        cur.n++;
        if(t.day > cur.day){ cur.day = t.day; cur.title = t.title; }
        by.set(t.series, cur);
      });
      seriesList = [...by.values()].sort((a, b) => b.day - a.day)
        .map(x => ({ ...x, label: x.n + ' task' + (x.n === 1 ? '' : 's') }));
      if(d.source.type === 'series' && !d.source.series && seriesList[0]) d.source.series = seriesList[0].key;
      paint();
    });

    App.sheet(html(), s => {
      sheetEl = s;
      s.addEventListener('input', e => {
        if(e.target.id === 'hb-name'){ const er = s.querySelector('#hb-err'); if(er) er.hidden = true; }
      });
      s.addEventListener('click', async e => {
        const src = e.target.closest('[data-src]');
        if(src){
          read(); d.source.type = src.dataset.src;
          if(d.source.type === 'series' && !d.source.series && seriesList[0]) d.source.series = seriesList[0].key;
          if(d.source.type === 'kind' && !d.source.kind) d.source.kind = 'workout';
          return paint();
        }
        const per = e.target.closest('[data-per]');
        if(per){ read(); d.per = per.dataset.per; if(d.per === 'week' && !d.times) d.times = 3; return paint(); }
        const tm = e.target.closest('[data-times]');
        if(tm){ read(); d.times = Math.min(7, Math.max(1, (d.times || 3) + +tm.dataset.times)); return paint(); }
        const dw = e.target.closest('[data-dow]');
        if(dw){
          const on = dw.getAttribute('aria-pressed') === 'true';
          const grid = s.querySelector('#hb-days');
          if(on && U.readDayGrid(grid).length === 1) return U.toast('Keep at least one day');
          dw.setAttribute('aria-pressed', String(!on));
          return;
        }
        const c = e.target.closest('[data-c]');
        if(c){ read(); d.color = c.dataset.c; return paint(); }
        const g = e.target.closest('[data-grp]');
        if(g){ read(); d.group = g.dataset.grp; return paint(); }

        const act = e.target.closest('[data-hb]');
        if(!act) return;
        if(act.dataset.hb === 'cancel') return App.closeSheet();
        if(act.dataset.hb === 'delete'){
          if(!armed){ armed = true; return paint(); }
          await Habits.remove(d.id);
          App.closeSheet();
          U.toast('Habit deleted');
          return onRemoved ? onRemoved() : onSaved && onSaved();
        }
        if(act.dataset.hb === 'save'){
          read();
          if(!String(d.name || '').trim() || d.name === 'Untitled habit'){
            s.querySelector('#hb-err').hidden = false;
            return s.querySelector('#hb-name').focus();
          }
          if(d.source.type === 'series' && !d.source.series) return U.toast('Make a repeating task first, or pick another option');
          const saved = await Habits.save(d);
          if(saved.source.type === 'own'){
            const made = await Habits.ensureTasks(await Data.currentDay(), 7);
            if(made) U.toast(`Added to Today for the next week`);
          }
          App.closeSheet();
          if(isNew) U.toast(saved.name + ' added');
          onSaved && onSaved(saved);
        }
      });
    });
  }

  /* ------------------------------------------------ Today

     Called after every list draw on Today. Fills the strip and puts a small
     tag on any task card a habit is counting. Keeps the next week of own-task
     habits stocked; if that adds anything, Today redraws once to show it. */
  let topping = false;
  async function decorate(root, tasks, day){
    if(!root || !global.Habits) return;
    const strip = root.querySelector('#habitStrip');
    let habits;
    try { habits = await Habits.all(); } catch(e){ return; }

    if(habits.some(h => h.source.type === 'own') && !topping){
      topping = true;
      try {
        const today = await Data.currentDay();
        let made = await Habits.ensureTasks(today, 7);
        if(day > today + 6) made += await Habits.ensureTasks(day, 1);
        if(made){ topping = false; if(App.refreshTab()) return; }
      } catch(e){ console.warn('Habit top-up failed', e); }
      topping = false;
    }

    wire(root);
    if(!strip) return;
    if(!habits.length){
      strip.innerHTML = `<button class="hb-strip empty" data-hb-year>
        <span>Track habits on a year grid</span><small>Year in dots ›</small></button>`;
      return;
    }
    const idx = await Habits.facts();
    const tk = todayKey();
    const dayTs = await Data.dayToDate(day);
    const k = Habits.keyOf(dayTs);
    const live = new Map((tasks || []).map(t => [t.id, t]));

    let doneN = 0;
    const tiles = habits.map(h => {
      const st = Habits.dayStatus(h, k, idx, tk);
      let word;
      if(st === 'done'){ word = 'Done'; doneN++; }
      else if(h.per === 'week') word = Habits.weekCount(h, k, idx, tk) + ' / ' + h.times + ' wk';
      else if(st === 'part'){
        const t = (idx.byDate[k] || []).find(x => (x.habitId === h.id || (h.source.series && x.series === h.source.series)) && Habits.amountOf(x.prog));
        const a = t && Habits.amountOf(t.prog);
        word = a ? a.a + ' / ' + a.b + (h.source.unit ? ' ' + h.source.unit : '') : 'Started';
      }
      else if(st === 'rest') word = 'Day off';
      else if(st === 'ahead') word = 'Later';
      else if(st === 'miss') word = 'Missed';
      else word = 'To do';
      return `<button class="hb-tile${st === 'done' ? ' done' : ''}" data-hb-open="${esc(h.id)}" style="--hb:${h.color}">
        <span class="n"><i style="background:${h.color}"></i><b>${esc(h.name)}</b></span><small>${word}</small></button>`;
    }).join('');
    strip.innerHTML = `<section class="hb-strip">
      <div class="h"><p>Habits · ${doneN} of ${habits.length}</p><button data-hb-year>Year in dots ›</button></div>
      <div class="hb-tiles">${tiles}</div></section>`;

    /* tags on the cards a habit is counting */
    root.querySelectorAll('.mediacard[data-id]').forEach(card => {
      const body = card.querySelector('.body');
      if(!body) return;
      const old = body.querySelector('.hb-tag');
      if(old) old.remove();
      const t = live.get(+card.dataset.id);
      if(!t) return;
      const h = habits.find(x => (x.source.type === 'own' && t.habitId === x.id)
        || (x.source.type === 'series' && t.series && t.series === x.source.series)
        || (x.source.type === 'kind' && t.kind === x.source.kind));
      if(!h) return;
      const tk2 = Habits.keyOf(dayTs);
      let what = '', right = '';
      if(h.per === 'week'){
        what = Habits.weekCount(h, tk2, idx, tk) + ' of ' + h.times + ' this week';
        const sun = Habits.fromKey(Habits.weekKey(tk2));
        right = '<span class="wk" aria-hidden="true">' + [0,1,2,3,4,5,6].map(i => {
          const st = Habits.dayStatus(h, Habits.keyOf(Habits.addDays(sun, i)), idx, tk);
          return `<s style="${dotStyle(st, h.color)}"></s>`;
        }).join('') + '</span>';
      } else {
        const sk = Habits.streak(h, idx, tk);
        what = sk.n > 1 ? sk.n + '-day streak' : Habits.goalLabel(h);
        const a = Habits.amountOf(t.prog);
        if(a && t.view !== 'done' && h.source.type === 'own')
          right = `<button class="bump" data-hb-bump="${t.id}" aria-label="Add 1${h.source.unit ? ' ' + esc(h.source.unit) : ''}">+1</button>`;
      }
      const tag = document.createElement('div');
      tag.className = 'hb-tag';
      tag.dataset.hbOpen = h.id;
      tag.innerHTML = `<i style="background:${h.color}"></i><b>${esc(h.name)}</b><span>${esc(what)}</span>${right}`;
      body.appendChild(tag);
    });
  }

  /* One capture-phase listener on Today, so a tap on a habit tag opens the
     habit instead of the task underneath it. */
  function wire(root){
    if(root.dataset.hbWired) return;
    root.dataset.hbWired = '1';
    root.addEventListener('click', async e => {
      const bump = e.target.closest('[data-hb-bump]');
      if(bump){
        e.stopPropagation(); e.preventDefault();
        const t = await Store.get('tasks', +bump.dataset.hbBump);
        const a = t && Habits.amountOf(t.prog);
        if(!a) return;
        const n = Math.min(a.b, a.a + 1);
        t.prog = `${n} / ${String(t.prog).replace(/^\s*[\d.]+\s*\/\s*/, '')}`;
        if(n >= a.b) t.view = 'done';
        await Store.put('tasks', t);
        Data.invalidate('tasks');
        if(n >= a.b) U.toast(t.title + ' — done for today');
        App.refreshTab();
        return;
      }
      if(e.target.closest('[data-hb-year]')){
        e.stopPropagation(); e.preventDefault();
        Screens.push('habits', { onChange: () => App.refreshTab() });
        return;
      }
      const open = e.target.closest('[data-hb-open]');
      if(open){
        e.stopPropagation(); e.preventDefault();
        Screens.push('habit', { id: open.dataset.hbOpen, onChange: () => App.refreshTab() });
      }
    }, true);
  }

  Screens.register('habits', mountYear);
  Screens.register('habit', mountHabit);
  global.HabitsUI = { edit, decorate, dotStyle };
})(window);
