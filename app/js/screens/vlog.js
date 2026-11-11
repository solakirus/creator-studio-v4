/* Vlog Builder — a whole video planned before it exists.
   Outline > acts > beats > shots, with dates and real clips attached. */
(function(){
  const { ICON } = U;

  const FORMATS = {
    daily:  { n:'Daily',     d:'Day in the life',     len:'8'  },
    build:  { n:'Build log', d:'Project over time',   len:'8'  },
    howto:  { n:'How-to',    d:'Teach one thing',     len:'15' },
    weekly: { n:'Weekly',    d:'A week in one video', len:'15' },
    short:  { n:'Short',     d:'Vertical, under 60s', len:'3'  }
  };
  const LENGTHS = ['3','8','15','20'];
  const LEN_LABEL = { '3':'3 min', '8':'8 min', '15':'15 min', '20':'20 min+' };
  const FRAMING  = ['Wide','Medium','Close','Over-shoulder','POV','Top-down'];
  const MOVEMENT = ['Static','Pan','Tilt','Push in','Pull out','Tracking','Handheld'];

  /* Starting shapes. A weekly vlog is acts by day; the rest are acts by story. */
  const PRESETS = {
    weekly: { n:'Week, day by day', d:'One act per day', acts:
      /* Sunday first: a vlog week starts where yours does, not where a calendar
         library happens to. */
      ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
        /* A day is a container, so it starts with three empty sequences to rename
           rather than one named after the day — "Monday" is not something you
           can shoot, and most days end up with at least three things in them. */
        .map(d => ({ title:d, beats:[1,2,3].map(n => ({
          title:`Sequence ${n}`, purpose:'', setup:'talking', shots:[] })) })) },
    threeact: { n:'Three acts', d:'Setup, work, payoff', acts:[
      { title:'Act 1 — Setup', beats:[
        { title:'Cold open — the best 3 seconds', purpose:'Earn the next ten seconds' },
        { title:'Set up what this is', purpose:'Tell them what they are here for' }] },
      { title:'Act 2 — The work', beats:[
        { title:'The work itself', purpose:'Show the effort, not just the result' },
        { title:'The turn — what went wrong', purpose:'Give it stakes' }] },
      { title:'Act 3 — Payoff', beats:[
        { title:'The result', purpose:'Pay off the promise' },
        { title:'Outro and next hook', purpose:'Keep them for the next one' }] }
    ]},
    chrono: { n:'Chronological', d:'Start to finish', acts:[
      { title:'The day', beats:[
        { title:'Establishing shot', purpose:'Set place and time' },
        { title:'Morning / setup', purpose:'Show the starting point' },
        { title:'The main block of work', purpose:'The substance' },
        { title:'Wrap — what got done', purpose:'Close the loop' }] }
    ]},
    blank: { n:'Blank', d:'Build it yourself', acts:[{ title:'Act 1', beats:[] }] }
  };

  const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  const all = async () => {
    const { values } = await Store.all('vlogs');
    return values.sort((a,b) => b.createdAt - a.createdAt);
  };
  function fmtTime(hhmm){
    if(!hhmm) return '';
    const [h,m] = hhmm.split(':').map(Number);
    const ap = h >= 12 ? 'P' : 'A', hr = h % 12 === 0 ? 12 : h % 12;
    return m ? `${hr}:${String(m).padStart(2,'0')}${ap}` : `${hr}${ap}`;
  }
  /* Older outlines were a flat beat list. Fold them into one act. */
  function migrate(v){
    if(!v.acts){
      v.acts = [{ id:uid('a'), title:'Act 1', day:null, open:true,
                  beats:(v.beats || []).map(b => ({ ...b, shots:b.shots || [], purpose:b.purpose || '' })) }];
      delete v.beats;
    }

    /* An older template named a day's only sequence after the day — "Monday —
       what happened" — which made the day and the sequence look like the same
       thing. Numbered within their day instead, so the name says where it sits
       until you give it a real one. */
    (v.acts || []).forEach(a => {
      (a.beats || []).forEach((b, i) => {
        if(/^.+\s—\s*what happened$/i.test(b.title || '')) b.title = `Sequence ${i + 1}`;
      });
    });

    return v;
  }
  const everyBeat = v => v.acts.flatMap(a => a.beats.map(b => ({ act:a, beat:b })));

  /* Deleting episodes. The research tagged to one goes back to unassigned
     rather than going with it, a month just gets its week slot back, and any
     tasks already sent to your days stay where they are. */
  async function deleteEpisodes(ids){
    const gone = new Set(ids);
    try {
      const { values } = await Store.all('sources');
      for(const r of values.filter(x => gone.has(x.vlogId))) await Store.put('sources', { ...r, vlogId:null });
    } catch(e){}
    for(const id of ids) await Store.del('vlogs', id);
    if(window.Months) Months.invalidate();
  }

  /* ---------- list: episodes, by month ---------- */
  async function mountList(el, params){
    /* Hosted inside the Content tab there is already a heading and a nav above
       it, and a back button would go nowhere. */
    const embedded = !!(params && params.embedded);
    async function render(){
      const rows = (await all()).map(migrate);
      const thisWeek = await Data.currentWeek();
      let unassigned = 0;
      try { unassigned = window.Research ? (await Research.unassigned()).length : 0; } catch(e){}

      /* An episode tagged to a challenge month sits under that month (a week
         belongs to the month its Saturday is in, so week 1 is October); one
         that isn't falls back to the calendar month its week starts in. Keys
         are dates, so the groups sort in time order. */
      let chMonths = {};
      try { if(window.Months) chMonths = Object.fromEntries((await Months.all()).map(m => [m.id, m])); } catch(e){}
      const groups = {};
      for(const v of rows){
        const wk = v.week || null;
        const cm = v.monthId && chMonths[v.monthId];
        let key, label;
        if(cm && cm.startDate){
          key = cm.startDate;
          label = `${cm.name || 'Month'} ${new Date(Months.ts(cm.endDate || cm.startDate)).getFullYear()}`;
        } else if(wk){
          const m = await Data.monthOfWeek(wk);
          key = m.key + '-01'; label = m.label;
        } else { key = 'none'; label = 'No week set'; }
        (groups[key] = groups[key] || { label, items:[] }).items.push({ v, wk });
      }
      /* earliest first: month 1 at the top, "No week set" last */
      const keys = Object.keys(groups).sort();

      const head = Screens.bar({ kicker:'Creator studio', title:'Episodes',
        actions:`<button class="btn-sm" data-a="challenges">Challenges</button>
                 <button class="btn-sm accent" data-a="new">+ New</button>` });

      el.innerHTML = (embedded ? '' : head) + `
      <div class="view">
        ${embedded ? `<div class="pagehead"><h1 class="page-title">Episodes</h1>
          <span class="headacts" style="display:flex;gap:8px;align-items:center">
            <button class="headbtn" data-a="challenges">CHALLENGES</button>
            <button class="headbtn" data-a="new">NEW</button>
          </span></div>` : ''}
        ${window.Research ? `<div class="epmonth" style="margin:0 0 16px">
          <button class="epm-open" data-a="research">
            <span class="k">Research</span>
            <b>${unassigned ? `${unassigned} unassigned` : 'Quotes, studies, experiments'}</b>
          </button>
          <button class="btn-sm accent" data-a="rs-quick">+ Log</button>
        </div>` : ''}
        ${rows.length ? keys.map(k => `
          <div class="sec"><h2>${groups[k].label}</h2><div class="rule"></div>
            <span class="alt">${groups[k].items.length}</span></div>
          <div class="list">
            ${groups[k].items.sort((a,b) => ((a.wk ?? 1e9) - (b.wk ?? 1e9)) || ((a.v.createdAt || 0) - (b.v.createdAt || 0))).map(({ v, wk }) => {
              const beats = everyBeat(v);
              const done = beats.filter(x => x.beat.done).length;
              const shots = beats.reduce((n,x) => n + (x.beat.shots || []).length, 0);
              const pct = beats.length ? Math.round((done / beats.length) * 100) : 0;
              const state = !beats.length ? 'draft' : done === beats.length ? 'done' : 'live';
              const label = !beats.length ? 'Empty' : done === beats.length ? 'Wrapped' : 'In progress';
              /* the same card a series uses, so the three sections read alike */
              return `<article class="mediacard"><div class="card" data-open="${v.id}">
                <div class="art" style="background-image:${U.generatedArt(v.id, v.title)}"></div>
                <span class="state ${state}">${label}</span>
                <div class="body"><h3>${wk ? `Ep ${wk} · ` : ''}${v.title}</h3>
                  <div class="meta">
                    <span>${wk ? `Week ${wk}${wk === thisWeek ? ' · this week' : ''}` : 'Unscheduled'}</span>
                    <span class="sep">|</span><span class="st">${done} / ${beats.length} sequences</span>
                    <span class="sep">|</span><span class="st">${shots} shot${shots===1?'':'s'}</span>
                  </div>
                </div>
                <div class="progress"><i style="width:${pct}%"></i></div>
              </div></article>`;
            }).join('')}
          </div>`).join('')
        : `<div class="empty"><b>No episodes yet</b>One episode per week, Sunday to Saturday. Plan its days, sequences and shots here, then shoot against it.</div>`}
        <p class="note">Episodes are numbered by week and run continuously. Scheduled sequences appear on Today.</p>
      </div>`;
    }
    /* The Content tab re-mounts a section every time you switch to it, so an
       unguarded listener stacks: three visits, three pushes from one tap. */
    /* hold an episode to pick several, then delete them together */
    if(window.Select) Select.enable(el, {
      itemSelector: '.mediacard',
      noun: 'episode',
      idOf: n => { const c = n.querySelector('[data-open]'); return c ? c.dataset.open : null; },
      warning: 'The episodes and their sequences go for good. Research on them goes back to unassigned; tasks already on your days stay.',
      onDelete: deleteEpisodes,
      onDone: render
    });

    if(!el.dataset.wiredEpisodes){
      el.dataset.wiredEpisodes = '1';
      el.addEventListener('click', e => {
        const a = e.target.closest('[data-a]');
        if(a && a.dataset.a === 'new') return Screens.push('vlog-new', { onDone:render });
        if(a && a.dataset.a === 'challenges') return Screens.push('challenges', {});
        if(a && a.dataset.a === 'research') return Screens.push('research', { onChange:render });
        if(a && a.dataset.a === 'rs-quick') return Research.quickAdd({ onSaved:render });
        const o = e.target.closest('[data-open]');
        if(o) Screens.push('vlog', { id:o.dataset.open, onChange:render });
      });
    }
    render();
  }

  /* ---------- create ---------- */
  async function mountNew(el, params){
    let format = 'weekly', preset = 'weekly', length = '15', seriesId = null;
    let week = await Data.currentWeek();
    const series = await Data.series();


    function render(){
      const s = series.find(x => x.id === seriesId);

      /* The page used to have a navy gradient and its own set of classes — a
         visual language nothing else in the app spoke. Same controls, the
         standard page format. */
      el.innerHTML = Screens.bar({ kicker:'Episodes', title:'New episode' }) + `
      <div class="view">
        <div class="pagehead"><h1 class="page-title">New episode</h1></div>

        <h3 class="pgh" style="margin-top:4px">Format</h3>
        <div class="pgseg" data-group="format">
          ${Object.entries(FORMATS).map(([k,v]) =>
            `<button type="button" data-set="format" data-v="${k}" aria-pressed="${format===k}">
              <b>${v.n}</b><small>${v.d}</small></button>`).join('')}
        </div>

        <h3 class="pgh">How it is broken up</h3>
        <div class="pgseg" data-group="preset">
          ${Object.entries(PRESETS).map(([k,v]) =>
            `<button type="button" data-set="preset" data-v="${k}" aria-pressed="${preset===k}">
              <b>${v.n}</b><small>${v.d}</small></button>`).join('')}
        </div>

        <h3 class="pgh">Target length</h3>
        <select id="ep-len" class="pgbar">
          ${LENGTHS.map(l => `<option value="${l}" ${length===l ? 'selected' : ''}
            >${LEN_LABEL[l]}</option>`).join('')}
        </select>

        <h3 class="pgh">Which week</h3>
        <button class="noterow" data-a="week">
          <span class="dot" style="background:var(--orange)"></span>
          <span class="t"><b>Episode ${week}</b><small id="wkdates">Week ${week}</small></span>
          ${ICON.chevR}
        </button>

        <h3 class="pgh">Series</h3>
        <button class="noterow" data-a="series">
          <span class="dot" style="background:${s ? 'var(--orange)' : 'var(--dim)'}"></span>
          <span class="t"><b>${s ? s.title : 'Not part of a series'}</b>
            <small>Tap to choose</small></span>
          ${ICON.chevR}
        </button>

        <p class="hintline" style="margin:16px 0 0">
          ${PRESETS[preset].acts.length} day blocks to start — add sequences inside each one.</p>

        <div class="sheetcta" style="margin-top:18px">
          <button class="btn-primary" data-a="create">Create the episode</button>
        </div>
      </div>`;
    }

    let spineTimer = null;

    el.addEventListener('input', e => {
      const f = e.target.dataset.spine;
      if(!f) return;
      v[f] = e.target.value;
      clearTimeout(spineTimer);
      spineTimer = setTimeout(() => save(), 400);
    });

    el.addEventListener('change', e => {
      if(e.target.id === 'ep-len'){ length = e.target.value; }
    });

    /* the week template, edited where a week is planned */
    function templateSheet(){
      const lines = (quarter.template || []).map(t =>
        `${t.title} | ${t.setup} | ${t.note || ''}`).join('\n');

      App.sheet(`
        <h2 style="margin:0 0 3px">How a week starts</h2>
        <p class="hintline" style="margin:0 0 14px">One segment per line:
          <b>title | setup | note</b>. Setups: ${Quarters.SETUPS.map(s => s.k).join(', ')}.</p>
        <textarea id="tp-x" class="pgtext" rows="8">${esc(lines)}</textarea>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheet => {
        sheet.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(!e.target.closest('[data-save]')) return;

          const template = sheet.querySelector('#tp-x').value.split('\n')
            .map(line => line.split('|').map(x => x.trim()))
            .filter(p => p[0])
            .map(p => ({ title:p[0],
                         setup: Quarters.SETUPS.some(s => s.k === p[1]) ? p[1] : 'talking',
                         note: p[2] || '' }));
          await Quarters.save({ ...quarter, template });
          quarter = await Quarters.get(quarter.id);
          App.closeSheet();
          await load(); render();
        });
      });
    }

    el.addEventListener('click', async e => {
      const set = e.target.closest('[data-set]');
      if(set){
        if(set.dataset.set === 'format'){
          format = set.dataset.v; length = FORMATS[format].len;
          if(format === 'weekly') preset = 'weekly';
        } else preset = set.dataset.v;
        return render();
      }

      const a = e.target.closest('[data-a]');
      if(!a) return;

      if(a.dataset.a === 'week'){
        const cur = await Data.currentWeek();
        App.sheet(`<h2>Which week</h2>
          <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.55">
            One episode per week, Sunday to Saturday. Episode number is the week number.</p>
          <div class="field"><label for="wk">Week</label>
            <input id="wk" type="number" min="1" value="${week}"></div>
          <p id="wkprev" style="margin:0;color:var(--cream);font-size:14.5px"></p>
          <div class="sheetcta"><button class="btn-primary" data-save>Use this week</button>
            <button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
          const input = sheetEl.querySelector('#wk');
          const prev = sheetEl.querySelector('#wkprev');
          const refresh = async () => {
            const n = Math.max(1, +input.value || 1);
            const d = await Data.weekDates(n);
            const m = await Data.monthOfWeek(n);
            prev.innerHTML = `<b>Episode ${n}</b> · ${d.label} · ${m.label}${n === cur ? ' · this week' : ''}`;
          };
          input.addEventListener('input', refresh); refresh();
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-save]')) return;
            week = Math.max(1, +input.value || 1);
            App.closeSheet(); render();
          });
        });
        return;
      }
      if(a.dataset.a === 'series'){
        App.sheet(`<h2>Series</h2><div class="group compact" style="margin:0">
          ${series.map(x => `<button class="row" data-s="${x.id}"><span class="lbl">${x.title}</span>${ICON.chevR}</button>`).join('')}
          <button class="row" data-s=""><span class="lbl">Not part of a series</span></button>
        </div><div class="sheetcta"><button class="btn-ghost" data-cancel style="flex:1">Cancel</button></div>`,
        sheetEl => {
          sheetEl.addEventListener('click', ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            const b = ev.target.closest('[data-s]');
            if(!b) return;
            seriesId = b.dataset.s || null; App.closeSheet(); render();
          });
        });
        return;
      }

      if(a.dataset.a === 'create'){
        const s = series.find(x => x.id === seriesId);
        const rec = {
          id: uid('v'),
          title: s ? `${s.title} — ${FORMATS[format].n.toLowerCase()}` : `${FORMATS[format].n} vlog`,
          format, length, seriesId, week,
          acts: PRESETS[preset].acts.map((a2,i) => ({
            id: uid('a'), title:a2.title, day:null, open:i === 0,
            /* the setup comes from the shape, so a seeded sequence already knows
               how it is filmed and can be batched before you touch it */
            beats: a2.beats.map(b => ({ id:uid('b'), title:b.title, purpose:b.purpose || '',
                                        setup:b.setup || 'talking', script:'', sourceId:null,
                                        shots:[], day:null, at:null, done:false, clipId:null }))
          })),
          createdAt: Date.now()
        };
        await Store.put('vlogs', rec);
        Screens.pop();
        setTimeout(() => {
          params.onDone && params.onDone();
          Screens.push('vlog', { id:rec.id, onChange:params.onDone });
        }, 280);
      }
    });

    render();
  }

  /* ---------- the outline ---------- */
  async function mountTimeline(el, params){
    let v, today = 1, clips = [], startDate = null, mode = 'plan', weekOffset = 0;
    let quarter = null;      /* the research this week draws on */
    let focusDay = null;     /* which day Shoot is showing */
    let weekSources = [];    /* and its own — this week's specifics */
    let monthGoal = null;    /* the rung between the quarter and this week */
    let milestones = [], weekMeta = {};
    let monthRec = null, monthFit = null, monthSuggest = null;   /* the challenge month */
    let epDates = null;       /* film Sunday–Saturday and the Thursday release, from the week */
    let beatsOpen = false;    /* the script beats stay as you left them between redraws */
    const dayLabel = n => {
      if(!startDate) return `Day ${n}`;
      const d = new Date(startDate);
      d.setDate(d.getDate() + (n - 1));
      return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    };
    const save = async () => { await Store.put('vlogs', v); params.onChange && params.onChange(); };

    /* what this line is citing, drawn from the quarter's reading */
    let qSources = [];
    function srcOptions(){
      if(!qSources.length) return '';
      return `<select id="bsrc" class="pgbar" style="margin:9px 0 0">
        <option value="">Not citing anything</option>
        ${qSources.map(x => `<option value="${x.id}" ${b.sourceId === x.id ? 'selected' : ''}
          >${(x.work || x.passage || '').slice(0, 50)}${x.author ? ' — ' + x.author : ''}</option>`).join('')}
      </select>`;
    }

    async function load(){
      v = migrate(await Store.get('vlogs', params.id));
      today = await Data.currentDay();
      clips = await Data.clips();
      startDate = (await Data.program()).start;
      milestones = v.week ? await Challenges.milestonesFor(v.week) : [];
      if(v.week){
        const d = await Data.weekDates(v.week);
        const m = await Data.monthOfWeek(v.week);
        /* the quarter that month belongs to — what all twelve weeks draw on */
        try { quarter = await Quarters.forMonth(m.key); } catch(e){ quarter = null; }
        try {
          const rec = await Store.get('settings', 'month-theme:' + m.key);
          monthGoal = (rec && rec.goal) ? { label:m.label, goal:rec.goal } : null;
        } catch(e){ monthGoal = null; }
        weekMeta = { label:d.label, month:m.label, current:v.week === (await Data.currentWeek()) };
      } else weekMeta = {};

      /* the challenge month it is tagged to — or, if none, the one whose weeks
         contain it, offered as a suggestion */
      monthRec = null; monthFit = null; monthSuggest = null; epDates = null;
      if(window.Months){
        try { epDates = await Months.datesOf(v); } catch(e){ epDates = null; }
        try {
          monthRec = v.monthId ? await Months.get(v.monthId) : null;
          if(monthRec) monthFit = await Months.fitFor(v, monthRec);
          else if(Months.hasWeek(v)){
            const d = await Months.datesOf(v);
            monthSuggest = d ? await Months.forDate(d.filmStart) : null;
          }
        } catch(e){ monthRec = null; }
      }

      /* and this week's own reading, which is the part that changes weekly */
      try { weekSources = await Quarters.sourcesForVlog(v.id); } catch(e){ weekSources = []; }
      try {
        const cites = await Quarters.citable(v.id, quarter ? quarter.id : null);
        citeIndex = [...cites.mine, ...cites.pool];
      } catch(e){ citeIndex = []; }
    }

    /* The Month field: which challenge month this episode belongs to. */
    function monthLineHTML(){
      if(!window.Months) return '';
      const esc2 = t => String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
      if(monthRec) return `<div class="epmonth">
          <button class="epm-open" data-a="month-open">
            <span class="k">Month</span>
            <b>${esc2(monthRec.name) || 'Untitled month'}${v.isVerdict ? ' · verdict' : ''}</b>
            ${monthFit && !monthFit.inRange ? `<small class="warn">${window.Months.hasWeek(v)
                ? "This week is outside the month's weeks" : 'No week set — assign one to place it'}</small>`
              : monthRec.challenge ? `<small>${esc2(monthRec.challenge)}</small>` : ''}
          </button>
          <button class="btn-sm" data-a="month-tag">Change</button>
        </div>`;
      return `<div class="epmonth empty">
          <span class="epm-open"><span class="k">Month</span><b>Not in a challenge month</b>
            ${monthSuggest ? `<small>This week falls in ${esc2(monthSuggest.name)}</small>` : ''}</span>
          ${monthSuggest ? `<button class="btn-sm accent" data-a="month-suggest">Tag ${esc2(monthSuggest.name)}</button>` : ''}
          <button class="btn-sm" data-a="month-tag">${monthSuggest ? 'Other' : 'Tag a month'}</button>
        </div>`;
    }

    /* The episode's own plan for the challenge: what skill, what the week's
       challenge is and where the pass line sits, when it films and releases,
       the edit-order segments, the script beats, and how the week went. The
       month's verdict details show on its verdict episode. */
    function episodePanelHTML(){
      if(!window.Months) return '';
      const x = Months.withExtras(v);
      const e2 = t => String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
      const full = { weekday:'short', month:'short', day:'numeric' };
      const segs = x.segments;
      const done = segs.filter(g => g.status === 'done').length;
      const shot = segs.filter(g => g.status === 'shot').length;
      const SEG = { todo:'To do', shot:'Shot', done:'Done' };
      const beatsFilled = ['intro','history','wisdom','science','backToMe'].filter(k => (x.scriptBeats[k] || '').trim()).length;
      const BEATS = [['intro','Intro'],['history','History'],['wisdom','Wisdom'],['science','Science'],['backToMe','Back to me']];
      return `
      <div class="ep5">
        ${monthLineHTML()}

        <div class="ep5-grid">
          <label>Skill<input data-ep5="skill" value="${e2(x.skill)}" placeholder="Discipline" autocomplete="off"></label>
          <label>Weekly challenge<input data-ep5="weeklyChallenge" value="${e2(x.weeklyChallenge)}"
            placeholder="Wake at 5am every day" autocomplete="off"></label>
          <label>Pass line<input data-ep5="passLine" value="${e2(x.passLine)}"
            placeholder="6 of 7 days" autocomplete="off"></label>
        </div>

        <div class="ep5-dates">
          ${epDates ? `
            <div><small>Films</small><b>${Months.label(epDates.filmStart, full)} – ${Months.label(epDates.filmEnd, full)}</b></div>
            <div><small>Releases${x.releaseDate ? ' · set by hand' : ''}</small>
              <b><input type="date" data-ep5date value="${epDates.releaseDate}"></b>
              ${x.releaseDate ? `<button class="ep5-link" data-ep5reset>Back to Thursday</button>` : ''}</div>`
          : `<div style="grid-column:1/-1"><small>Dates</small><b style="color:var(--dim)">Assign a week to get film and release dates</b></div>`}
        </div>

        ${window.Scoreboard ? (() => {
          const hd = Scoreboard.habitDaysOf(v, monthRec);
          const ks = Object.keys(hd);
          return `<div class="ep5-h"><span>Habit days</span><i></i><em>${
            ks.reduce((n, k) => n + hd[k], 0)}/${ks.length * 7}</em></div>
          ${ks.length ? ks.map(k => `<div class="ep5-hab">
            <span class="lb">${Scoreboard.habitLabel(k)}</span>
            <span class="dots">${[1,2,3,4,5,6,7].map(n => `<i class="${n <= hd[k] ? 'on' : ''}"></i>`).join('')}</span>
            <button data-ep5hab="${k}" data-d="-1" aria-label="One fewer day">−</button>
            <b>${hd[k]}</b>
            <button data-ep5hab="${k}" data-d="1" aria-label="One more day">+</button>
          </div>`).join('') : `<p class="note" style="text-align:left;margin:0">No habits tracked this month.</p>`}
          <button class="btn-ghost" data-ep5stat style="width:100%;margin:8px 0 0">Stat card</button>`;
        })() : ''}

        <div class="ep5-h"><span>Result</span><i></i></div>
        <div class="mo-seg" role="group" aria-label="Episode result" style="margin:0">
          <button data-ep5res="W" class="W" aria-pressed="${x.result === 'W'}">WON</button>
          <button data-ep5res="" aria-pressed="${!x.result}">PENDING</button>
          <button data-ep5res="L" class="L" aria-pressed="${x.result === 'L'}">LOST</button>
        </div>

        ${x.isVerdict && monthRec ? `<div class="ep5-verdict">
          <span class="k">Verdict · ${e2(monthRec.name)}</span>
          <b>${e2(monthRec.challenge) || 'No challenge set on the month'}</b>
          <span class="mo-res${monthRec.result ? ' ' + monthRec.result : ''}" style="align-self:flex-start">${
            monthRec.result === 'W' ? 'Won' : monthRec.result === 'L' ? 'Lost' : 'Pending'}</span>
          <small><b>Reward:</b> ${e2(monthRec.reward) || '—'}</small>
          <small><b>Penalty options:</b> ${(monthRec.penaltyOptions || []).length
            ? (monthRec.penaltyOptions || []).map(e2).join(' · ') : '—'}</small>
          <button class="ep5-link" data-a="month-open">Open ${e2(monthRec.name)} →</button>
        </div>` : ''}

        <div class="ep5-h"><span>Segments</span><i></i><em>${segs.length ? `${done}/${segs.length} done${shot ? ` · ${shot} shot` : ''}` : ''}</em></div>
        ${segs.length ? `<div class="ep5-segs">${segs.map((g, i) => `
          <button class="ep5-seg ${g.status}" data-ep5seg="${i}">
            <span class="dot"></span><span class="lb">${e2(g.label)}</span><span class="st">${SEG[g.status] || 'To do'}</span>
          </button>`).join('')}</div>
          <p class="note" style="text-align:left;margin:6px 0 0">Tap to move a segment on: to do → shot → done.</p>`
        : `<button class="cp-add" data-ep5segs>+ Add the ten default segments</button>`}

        <details class="ep5-beats"${beatsOpen ? ' open' : ''}>
          <summary>Script beats<em>${beatsFilled}/5 written</em></summary>
          ${BEATS.map(([k, lb]) => `<label>${lb}
            <textarea data-ep5beat="${k}" rows="3">${e2(x.scriptBeats[k])}</textarea></label>`).join('')}
        </details>
      </div>`;
    }

    /* Tag this episode to a month, or clear it. The change goes into the open
       record and through its own save, so nothing else on the page is lost. */
    async function setMonth(m){
      if(!m){
        v.monthId = null; v.isVerdict = false;
        await save(); await load(); return render();
      }
      const fit = await Months.fitFor(v, m);
      if(fit.holder){
        return U.toast(`Week ${fit.slot.index} of ${m.name} already has "${fit.holder.title}"`);
      }
      if(!fit.inRange && !confirm(Months.hasWeek(v)
          ? `Project week ${v.week} is outside ${m.name}'s weeks. Tag it anyway?`
          : `This episode has no week set, so it won't sit in one of ${m.name}'s weeks yet. Tag it anyway?`)) return;
      v.monthId = m.id;
      v.isVerdict = !!fit.last;
      if(!Array.isArray(v.segments) || !v.segments.length) v.segments = Months.defaultSegments();
      await save(); await load(); render();
      U.toast(`Tagged to ${m.name}`);
    }
    async function pickMonth(){
      const list = await Months.all();
      App.sheet(`<h2>Month</h2>
        ${list.length ? `<div class="group compact" style="margin:0">
          ${list.map(m => `<button class="row" data-m="${m.id}"><span class="lbl">${
            String(m.name || 'Untitled month').replace(/</g,'&lt;')}<small style="display:block;color:var(--muted);font-size:12px">${
            Months.label(m.startDate)} – ${Months.label(m.endDate)}</small></span>${
            v.monthId === m.id ? '<span style="color:var(--orange)">✓</span>' : ICON.chevR}</button>`).join('')}
          ${v.monthId ? `<button class="row" data-m=""><span class="lbl">Not in a month</span></button>` : ''}
        </div>` : `<div class="empty"><b>No months yet</b>Make one under Calendar → Months.</div>`}
        <div class="sheetcta"><button class="btn-ghost" data-cancel style="flex:1">Cancel</button></div>`,
      sheetEl => {
        sheetEl.addEventListener('click', async ev => {
          if(ev.target.closest('[data-cancel]')) return App.closeSheet();
          const b = ev.target.closest('[data-m]');
          if(!b) return;
          App.closeSheet();
          await setMonth(b.dataset.m ? list.find(x => x.id === b.dataset.m) : null);
        });
      });
    }

    function beatHTML(act, b, i){
      const clip = clips.find(c => c.id === b.clipId);
      const shotsDone = (b.shots || []).filter(s => s.done).length;
      return `
      <!-- The whole card opens the beat. The chevron used to be the only way in,
           which made a beat read as a label rather than something you work on. -->
      <article class="beat open${b.done ? ' done' : ''}" data-beat="${b.id}" data-act="${act.id}">
        <span class="bgo" aria-hidden="true">${ICON.chevR}</span>
        <div class="bh"><span class="num">${i+1}</span><h3>${b.title}${
          b.fn && Story.fn(b.fn)
            ? `<span class="fntag" style="--fc:${Story.fn(b.fn).c}">${Story.fn(b.fn).n}</span>`
            : ''}</h3></div>
        ${b.purpose ? `<p class="purpose">${b.purpose}</p>` : ''}
        ${(b.shots || []).length ? `
          <!-- A sequence with eight shots used to push every other sequence off
               the screen. Folded away by default, open once you are shooting it. -->
          <details class="seqshots"${shotsDone && shotsDone < b.shots.length ? ' open' : ''}>
            <summary>
              <span class="sq-n">${shotsDone}/${b.shots.length} shots</span>
              <span class="sq-go">${ICON.chevR}</span>
            </summary>
            <div class="sq-list">
              ${b.shots.map(s => `<div class="shotline${s.done ? ' done' : ''}" data-shot="${b.id}:${s.id}">
                <span class="bx">${ICON.check}</span>
                <span class="tx">${s.text}</span>
                ${s.framing ? `<span class="tag">${s.framing}</span>` : ''}
                ${s.movement ? `<span class="tag">${s.movement}</span>` : ''}
              </div>`).join('')}
            </div>
          </details>` : ''}
        <div class="bm">
          <button class="timechip${b.day != null ? '' : ' none'}" data-sched="${b.id}">
            ${ICON.clock}${b.day != null ? `${dayLabel(b.day)}${b.at ? ' · ' + fmtTime(b.at) : ''}` : 'schedule'}</button>
          ${(b.shots || []).length ? `<span class="tg count">${shotsDone}/${b.shots.length} shots</span>` : ''}
          ${b.taskId ? `<span class="tg" style="color:var(--orange);border-color:rgba(251,105,0,.4)">on your day</span>` : ''}
          ${(() => {
            /* where its clip has got to — the beat and the clip are one thing,
               so the beat should say what the clip says */
            if(!b.clipId) return '';
            const c = clips.find(x => x.id === b.clipId);
            if(!c) return '';
            const st = Lifecycle.stage(c.stage || 'idea');
            return `<span class="tg" style="color:${st.c};border-color:${st.c}66">${st.label}</span>`;
          })()}
          ${clip ? `<span class="cliplink">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="M15.5 10.5L21.5 7.5v9l-6-3z"/></svg>
            ${clip.state}</span>` : ''}
          <span class="bbtns">
            <button class="mini" data-move="up:${act.id}:${b.id}" ${i===0?'disabled':''} aria-label="Move up">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg></button>
            <button class="mini" data-move="down:${act.id}:${b.id}" ${i===act.beats.length-1?'disabled':''} aria-label="Move down">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
            <button class="mini tick" data-done="${b.id}" aria-label="Mark done">${ICON.check}</button>
          </span>
        </div>
      </article>`;
    }

    function render(){
      if(!v){ Screens.pop(); return; }
      if(mode === 'plan') return renderPlan();
      if(mode === 'week') return renderWeek();
      const prevView = el.querySelector('.view');
      const keepTop = prevView ? prevView.scrollTop : 0;
      setTimeout(() => {
        const nv = el.querySelector('.view');
        if(nv && keepTop) nv.scrollTop = keepTop;
      }, 0);
      const beats = everyBeat(v);
      const done = beats.filter(x => x.beat.done).length;
      const shots = beats.reduce((n,x) => n + (x.beat.shots || []).length, 0);
      const shotsDone = beats.reduce((n,x) => n + (x.beat.shots || []).filter(s => s.done).length, 0);

      el.innerHTML = Screens.bar({ kicker:v.week ? `Episode ${v.week}` : 'Vlog builder', title:v.title,
        actions:`<span class="modetog">
          <button data-a="mode-plan" aria-pressed="${mode==='plan'}">Plan</button>
          <button data-a="mode-board" aria-pressed="false">Board</button>
          <button data-a="mode-week" aria-pressed="${mode==='week'}">Shoot</button>
          <button data-a="mode-outline" aria-pressed="${mode==='outline'}">Edit</button>
        </span>` }) + `
      <div class="view">
        ${v.week ? `<div class="epband">
          <span class="epno"><small>Ep</small><b>${v.week}</b></span>
          <span class="t"><b>${weekMeta.label || ''}</b>
            <small>Week ${v.week}${weekMeta.month ? ' · ' + weekMeta.month : ''}${
              weekMeta.current ? ' · this week' : ''}</small></span>
          <button class="btn-sm" data-a="setweek">Change</button>
        </div>` : `<div class="metaline"><button class="btn-sm" data-a="setweek">Assign a week</button></div>`}

        ${episodePanelHTML()}

        ${cutListHTML()}

        ${standsHTML()}

        ${(() => {
          /* the spine: does this week have a story, or just footage */
          const st = Story.check(v);
          const arc = Story.arc(v);
          return `
          <div class="sp-card">
            <div class="sp-head"><b>${st.score}%</b><span>Story<br>ready</span></div>
            <div class="sp-bar"><i style="width:${st.score}%"></i></div>

            ${arc.length ? `
              <div class="shapechart">
                ${arc.map(p => `<span class="b" title="${p.title}"
                  style="height:${Math.round(p.level * 100)}%;--ac:${
                    p.fn && Story.fn(p.fn) ? Story.fn(p.fn).c : '#3A352E'}"></span>`).join('')}
              </div>
              <div class="shapechart-l"><span>Open</span><span>The shape of the week</span><span>Close</span></div>`
            : ''}

            <div class="sp-line">
              <label for="sp-premise">Through-line</label>
              <textarea id="sp-premise" data-spine="premise"
                placeholder="One sentence. What is this week actually about — not what happened, what it means.">${v.premise || ''}</textarea>
            </div>
            <div class="sp-line">
              <label for="sp-audience">Who it is for</label>
              <textarea id="sp-audience" data-spine="audience"
                placeholder="Who is watching this, and what are they hoping to get out of it?">${v.audience || ''}</textarea>
            </div>
            <div class="sp-line">
              <label for="sp-question">The question</label>
              <textarea id="sp-question" data-spine="question"
                placeholder="What does the viewer want answered by the end?">${v.question || ''}</textarea>
            </div>

            ${st.gaps.length ? st.gaps.slice(0, 5).map(g =>
              `<div class="sp-gap w${g.w}"><i></i>${g.t}</div>`).join('')
            : `<p style="margin:6px 0 0;font-size:14px;color:var(--green)">It has a spine. Go shoot it.</p>`}

            <button class="btn-ghost" data-a="shape" style="width:100%;margin-top:12px">
              ${(v.acts || []).length > 1 ? 'Restructure the week' : 'Give it a shape'}</button>
            <button class="btn-primary" data-a="tasks" style="width:100%;margin-top:10px">
              Add to my tasks</button>
          </div>`;
        })()}

        ${milestones.length ? `<div class="block" style="padding:14px">
          <h4 style="margin:0 0 10px">This week's milestones</h4>
          ${milestones.map(m => `<div class="ms${m.done ? ' done' : ''}" data-ms="${m.challenge.id}:${m.id}">
            <span class="bx">${ICON.check}</span>
            <span class="tx">${m.title}<br><span style="font-size:12px;color:var(--dim)">${m.challenge.title}</span></span>
          </div>`).join('')}
          <p style="margin:11px 0 0;font-size:13px;color:var(--dim);line-height:1.5">
            What this episode is about. Build the acts around these.</p>
        </div>` : ''}

        <div class="block" style="padding:14px">
          <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">
            <span class="tg">${FORMATS[v.format] ? FORMATS[v.format].n : v.format}</span>
            <span class="tg count">${LEN_LABEL[v.length] || v.length}</span>
            <span class="tg count">${done}/${beats.length} beats</span>
            <span class="tg count">${shotsDone}/${shots} shots</span>
          </div>
          <div class="track" style="margin-top:12px">
            <i class="ok" style="width:${beats.length ? Math.round(done / beats.length * 100) : 0}%"></i></div>
        </div>

        ${v.acts.map((act, ai) => `
          <section class="act${act.open ? ' open' : ''}" data-actid="${act.id}">
            <button class="act-h" data-toggle="${act.id}">
              <svg class="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              <span class="t"><b>${act.title}</b>
                <small>${act.beats.length} beat${act.beats.length===1?'':'s'}${act.day != null ? ` · ${dayLabel(act.day)}` : ''}</small></span>
              <span class="tg count">${act.beats.filter(b => b.done).length}/${act.beats.length}</span>
            </button>
            ${act.open ? `
              <div class="act-body">
                <div class="tl">${act.beats.map((b,i) => beatHTML(act, b, i)).join('')}</div>
                <button class="addbeat" data-addbeat="${act.id}">+ Add a beat</button>
              </div>
              <div class="act-tools">
                <button data-actday="${act.id}">${act.day != null ? dayLabel(act.day) : 'Set date'}</button>
                <!-- the same board as the episode's, opened on this day's
                     sections rather than the whole week -->
                <button data-actboard="${act.id}">Board</button>
                <button data-actname="${act.id}">Rename</button>
                <button data-actmove="up:${act.id}" ${ai===0?'disabled':''}>↑</button>
                <button data-actmove="down:${act.id}" ${ai===v.acts.length-1?'disabled':''}>↓</button>
                <button data-actdel="${act.id}" style="color:var(--red)">Delete</button>
              </div>` : ''}
          </section>`).join('')}

        <button class="addbeat" data-a="addact">+ Add an act</button>
        <p class="note">Setting a day on an act schedules every beat in it. Beats with a day appear on Today.</p>
        <button class="btn-ghost" data-a="delete" style="width:100%;margin-top:14px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete episode</button>
      </div>`;
    }

    /* ---- week view: the story laid out across seven days ---- */
    function weekDays(){
      /* anchor on the first scheduled beat's week, or the current one */
      const days = everyBeat(v).map(x => x.beat.day).filter(Boolean);
      const anchorDay = days.length ? Math.min(...days) : today;
      const anchor = new Date(startDate);
      anchor.setDate(anchor.getDate() + (anchorDay - 1) + weekOffset * 7);
      anchor.setHours(0,0,0,0);
      /* Sunday first — a vlog week runs Sunday to Saturday, and the strip has to
         agree with the day blocks in Plan or the two read as different weeks. */
      const sunday = new Date(anchor);
      sunday.setDate(anchor.getDate() - anchor.getDay());
      return Array.from({ length:7 }, (_,i) => {
        const d = new Date(sunday);
        d.setDate(sunday.getDate() + i);
        const n = Math.round((d - new Date(startDate).setHours(0,0,0,0)) / 86400000) + 1;
        return { date:d, day:n };
      });
    }

    function beatCard(act, b){
      /* Dragging works but is miserable with a dozen sequences on a phone, so the
         card is also a button: tap it, pick the day. */
      return `<div class="wbeat${b.done ? ' done' : ''}" data-item="beat:${b.id}" data-vlog="${v.id}">
        <span class="grip" aria-label="Drag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 9h14M5 15h14"/></svg></span>
        <span class="act">${act.title.slice(0,10)}</span>
        <span class="nm">${b.title}${b.at ? `<span>${fmtTime(b.at)}</span>` : ''}</span>
        <button class="wmove" data-moveto="${b.id}" aria-label="Move to another day">
          ${ICON.chevR}</button>
      </div>`;
    }

    /* ---- Plan: the first pass ----

       Monday-you answers three questions and lists what to film. No acts, no
       story shape — you cannot know the turn before you have lived the week,
       and being asked to invent one is what made this overwhelming. */
    /* The same shape as the quarter's, saved against this week instead. A week
       about calorie tracking and a week about form cite different things, and
       keeping both in the quarter means digging for this week's every time. */
    function sourceSheet(rec){
      const r = { kind:'article', author:'', work:'', year:'', url:'', passage:'',
                  tags:[], ...(rec || {}) };
      const isNew = !r.id;

      App.sheet(`
        <h2 style="margin:0 0 3px">${isNew ? 'A source for this week' : 'Source'}</h2>
        <p class="hintline" style="margin:0 0 14px">Belongs to this episode. The quarter's
          reading stays where it is.</p>

        <h3 class="pgh" style="margin-top:0">What kind?</h3>
        <select id="ws-k" class="pgbar">
          ${Quarters.KINDS.map(k => `<option value="${k.k}" ${r.kind === k.k ? 'selected' : ''}
            >${k.label}</option>`).join('')}
        </select>

        <h3 class="pgh">Title of the work</h3>
        <input id="ws-w" class="pgname" type="text" value="${(r.work || '').replace(/"/g,'&quot;')}"
          placeholder="Why calorie counting fails" autocomplete="off">

        <div style="display:flex;gap:10px">
          <span style="flex:2"><h3 class="pgh">Author</h3>
            <input id="ws-a" class="pgbar" type="text" value="${(r.author || '').replace(/"/g,'&quot;')}"></span>
          <span style="flex:1"><h3 class="pgh">Year</h3>
            <input id="ws-y" class="pgbar" type="text" value="${(r.year || '').replace(/"/g,'&quot;')}"></span>
        </div>

        <h3 class="pgh">The passage</h3>
        <textarea id="ws-p" class="pgtext" rows="4"
          placeholder="The bit you would actually quote — you will be saying it on camera."
          >${r.passage || ''}</textarea>

        <h3 class="pgh">Link</h3>
        <input id="ws-u" class="pgbar" type="url" value="${(r.url || '').replace(/"/g,'&quot;')}"
          placeholder="https://">

        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${isNew ? '' : `<button class="btn-ghost" data-del
          style="width:100%;margin:12px 0 0;color:var(--red);border-color:rgba(226,86,74,.45)">
          Remove this source</button>`}`, sheet => {

        sheet.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();

          if(e.target.closest('[data-del]')){
            await Quarters.removeSource(r.id);
            App.closeSheet();
            await load(); render();
            return U.toast('Removed');
          }
          if(!e.target.closest('[data-save]')) return;

          await Quarters.saveSource({
            ...r,
            vlogId: v.id,
            quarterId: quarter ? quarter.id : null,
            kind: sheet.querySelector('#ws-k').value,
            work: sheet.querySelector('#ws-w').value.trim(),
            author: sheet.querySelector('#ws-a').value.trim(),
            year: sheet.querySelector('#ws-y').value.trim(),
            passage: sheet.querySelector('#ws-p').value.trim(),
            url: sheet.querySelector('#ws-u').value.trim()
          });
          App.closeSheet();
          await load(); render();
        });
      });
    }

    /* Pick the day from a list rather than dragging. */
    function moveSheet(found){
      const { act:from, beat:b } = found;

      App.sheet(`
        <h2 style="margin:0 0 3px">${b.title}</h2>
        <p class="hintline" style="margin:0 0 14px">Which day are you filming this?</p>
        <div class="group compact" style="margin:0 0 14px;max-height:48vh;overflow-y:auto">
          ${v.acts.map(a => `
            <button class="row" data-to="${a.id}">
              <span class="lbl">${a.title}
                <small>${(a.beats || []).length} sequence${
                  (a.beats || []).length === 1 ? '' : 's'}${
                  a.id === from.id ? ' · where it is now' : ''}</small></span>
              ${a.id === from.id ? '<span class="tg">here</span>' : ICON.chevR}
            </button>`).join('')}
        </div>
        <div class="sheetcta">
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheet => {
        sheet.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          const to = e.target.closest('[data-to]');
          if(!to) return;

          const target = v.acts.find(a => a.id === to.dataset.to);
          if(!target || target.id === from.id) return App.closeSheet();

          from.beats = from.beats.filter(x => x.id !== b.id);
          b.day = target.day ?? b.day ?? null;      /* the block's date, if it has one */
          target.beats.push(b);

          await save();
          App.closeSheet();
          U.toast(`Moved to ${target.title}`);
          render();
        });
      });
    }

    /* The cut list: everything you shot, in order, with the line you said and
       what it cites. This is what Edit is for — you are at the computer with the
       footage open, and this is the sheet beside the timeline. */
    /* this week's reading and the quarter's, by id — what a sequence cites */
    let citeIndex = [];
    const qSourceById = id => citeIndex.find(x => x.id === id) || null;

    function cutListHTML(){
      const all = everyBeat(v);
      const shot = all.filter(x => x.beat.done || (x.beat.shots || []).some(s2 => s2.done));
      if(!all.length) return '';

      const byDay = {};
      shot.forEach(x => {
        const k = x.beat.day || 0;
        (byDay[k] = byDay[k] || []).push(x);
      });
      const order = Object.keys(byDay).map(Number).sort((a, b) => a - b);

      return `
        <details class="cutlist"${shot.length ? ' open' : ''}>
          <summary>
            <b>What you have</b>
            <span>${shot.length} of ${all.length} captured</span>
            ${ICON.chevR}
          </summary>
          <div class="cl-body">
            ${shot.length ? order.map(d => `
              <p class="cl-day">${d ? dayLabel(d) : 'No day'}</p>
              ${byDay[d].map(x => {
                const b = x.beat;
                const src = b.sourceId ? qSourceById(b.sourceId) : null;
                const got = (b.shots || []).filter(s2 => s2.done);
                return `
                  <div class="cl-seq">
                    <b>${b.title}</b>
                    ${b.script ? `<p class="cl-line">${b.script}</p>` : ''}
                    ${src ? `<p class="cl-cite">${Quarters.cite(src).replace(/\*/g, '')}${
                      src.url ? ` · ${src.url}` : ''}</p>` : ''}
                    ${got.length ? `<p class="cl-shots">${
                      got.map(s2 => s2.text).join(' · ')}</p>` : ''}
                  </div>`;
              }).join('')}`).join('')
            : `<p class="hintline" style="margin:0">Nothing captured yet. This fills up as you
                tick shots off in Shoot.</p>`}
          </div>
        </details>`;
    }

    /* Where the week stands — drawn in Plan and in Edit, because the question
       "have these reached my task list?" is the same one in both. */
    function standsHTML(){
      /* Where the week stands. Planning a vlog is three passes and nothing
             said so, which is why a beat with a date but no task felt broken:
             write the beats, hang them on days, then send them to your days. */
          const all = everyBeat(v);
          const dated = all.filter(x => x.beat.day);
          const sent = dated.filter(x => x.beat.taskId);

          const step = (n, title, done, note, cta) => `
            <div class="wf-step${done ? ' done' : ''}">
              <span class="wf-n">${done ? '&#10003;' : n}</span>
              <span class="wf-t"><b>${title}</b><small>${note}</small></span>
              ${cta || ''}
            </div>`;

          return `
          <div class="wf">
            <p class="wf-h">Where this week stands</p>
            ${step(1, 'Shape the week', all.length > 0,
              all.length ? `${all.length} beat${all.length === 1 ? '' : 's'} written`
                         : 'No beats yet — write the moves first, dates come later',
              all.length ? '' : '<button class="btn-sm accent" data-a="shape">Use a shape</button>')}

            ${step(2, 'Give each one a day', all.length > 0 && dated.length === all.length,
              !all.length ? 'Nothing to schedule yet'
                : dated.length === all.length ? 'Every beat has a date'
                : `${dated.length} of ${all.length} dated — tap a beat to set its day`,
              '')}

            ${step(3, 'Add them to my tasks', dated.length > 0 && sent.length === dated.length,
              !dated.length ? 'Nothing dated yet'
                : sent.length === dated.length ? 'All of them are on your days'
                : `${sent.length} of ${dated.length} sent — until you do this, nothing shows on Today`,
              dated.length && sent.length < dated.length
                ? '<button class="btn-sm accent" data-a="tasks">Add to my tasks</button>' : '')}
          </div>`;
    }

    function renderPlan(){
      const segs = everyBeat(v);
      /* Grouped by the day block they sit in, not by setup. A day holds several
         sequences; grouping by setup scattered a day's sequences across the page
         and left no place to add another one to Monday. Batching by setup is
         what Shoot mode is for. */
      const byAct = v.acts.map(a => ({ act:a, items:a.beats.map(b => ({ act:a, beat:b })) }));

      el.innerHTML = Screens.bar({ kicker:v.week ? `Episode ${v.week}` : 'Vlog builder', title:v.title,
        actions:`<span class="modetog">
          <button data-a="mode-plan" aria-pressed="true">Plan</button>
          <button data-a="mode-board" aria-pressed="false">Board</button>
          <button data-a="mode-week" aria-pressed="false">Shoot</button>
          <button data-a="mode-outline" aria-pressed="false">Edit</button>
        </span>` }) + `
      <div class="view">
        <!-- the quarter has no button in the nav, so this is how you reach it.
             It also shows the rung above this week: the challenge these weekly
             experiments are building toward. -->
        ${quarter ? `<button class="qtline" data-a="openquarter">
          <span class="k">This quarter</span>
          <b>${quarter.name}</b>
          ${quarter.challenge ? `<small><b>Challenge:</b> ${quarter.challenge}</small>` : ''}
          ${monthGoal ? `<small><b>${monthGoal.label}:</b> ${monthGoal.goal}</small>` : ''}
          ${ICON.chevR}
        </button>` : `<button class="qtline empty" data-a="openquarter">
          <span class="k">No quarter yet</span>
          <b>Set one up</b>
          <small>The reading twelve weeks of experiments draw on.</small>
          ${ICON.chevR}
        </button>`}

        ${episodePanelHTML()}

        ${standsHTML()}

        <div class="sec"><h2>The week</h2><div class="rule"></div></div>

        <div class="sp-line">
          <label for="pl-exp">This week's goal</label>
          <textarea id="pl-exp" data-spine="experiment"
            placeholder="One testable thing with an end, building toward the month's goal. No phone before noon for seven days."
            >${v.experiment || ''}</textarea>
        </div>
        <div class="sp-line">
          <label for="pl-ang">The angle</label>
          <textarea id="pl-ang" data-spine="angle"
            placeholder="Which slice of the quarter's topic this week teaches.">${v.angle || ''}</textarea>
        </div>
        <div class="sp-line">
          <label for="pl-q">The hook question</label>
          <textarea id="pl-q" data-spine="question"
            placeholder="What does the viewer want answered by the end?">${v.question || ''}</textarea>
        </div>
        <!-- The same framing the quarter asks for, at the week. A quarter has one
             topic and one through-line; so does each week inside it, and they are
             not the same sentences. -->
        <div class="sp-line">
          <label for="pl-thru">The through-line</label>
          <textarea id="pl-thru" data-spine="premise"
            placeholder="The one thing a viewer should understand by the end of this week."
            >${v.premise || ''}</textarea>
        </div>
        <div class="sp-line">
          <label for="pl-aud">Who it is for</label>
          <textarea id="pl-aud" data-spine="audience"
            placeholder="Who is watching this one, and what are they hoping to get out of it?"
            >${v.audience || ''}</textarea>
        </div>

        <div class="sec"><h2>Research</h2><div class="rule"></div>
          <span class="alt">${weekSources.length}</span></div>
        <p class="hintline" style="margin:0 0 12px">The quotes, studies and examples behind
          <em>this</em> week, by the segment they're for. The quarter holds what all twelve draw on.</p>

        ${window.Research ? Research.groupedHTML(weekSources) : ''}

        <div style="display:flex;gap:8px;margin:${weekSources.length ? '8px' : '0'} 0 18px">
          <button class="btn-ghost" data-a="rs-add" style="flex:1">+ Add</button>
          <button class="btn-ghost" data-a="rs-link" style="flex:1">Link existing</button>
        </div>

        <div class="sec"><h2>What to film</h2><div class="rule"></div>
          <span class="alt">${segs.length}</span></div>
        <p class="hintline" style="margin:0 0 12px">A day holds its sequences. Open one to see
          what is in it.</p>

        ${byAct.length ? byAct.map(({ act, items }) => {
          const shots = items.reduce((n, x) => n + (x.beat.shots || []).length, 0);
          const got = items.reduce((n, x) => n + (x.beat.shots || []).filter(s2 => s2.done).length, 0);
          return `
            <button class="dayrow" data-day="${act.id}">
              <span class="dr-t">
                <b>${act.title}${act.day != null ? ` · ${dayLabel(act.day)}` : ''}</b>
                <small>${items.length
                  ? [`${items.length} sequence${items.length === 1 ? '' : 's'}`,
                     (() => {
                       /* which kinds are in this day, so you know what the day
                          asks of you before opening it */
                       if(!(window.Quarters && Quarters.setupOf)) return '';
                       const kinds = [...new Set(items.map(x => x.beat.setup || 'talking'))];
                       return kinds.map(k => Quarters.setupOf(k).label).join(', ');
                     })(),
                     shots ? `${got}/${shots} shots` : '',
                     (() => { const c = VlogTasks.counts(items);
                       return c.onTasks ? `${c.onTasks} on your days` : ''; })()
                    ].filter(Boolean).join(' · ')
                  : 'Nothing planned yet'}</small>
              </span>
              ${shots ? `<span class="dr-c${got === shots ? ' all' : ''}">${got}/${shots}</span>` : ''}
              ${ICON.chevR}
            </button>`;
        }).join('')
          : `<div class="empty"><b>No days yet</b>
              Start from this quarter's template, or add a day block.</div>`}

        <!-- The template used to be edited on the quarter page, which is the
             wrong place for it: a quarter is three months of intent, and this
             is how one week opens. It lives where it is used. -->
        ${quarter ? `<div style="display:flex;gap:8px;margin:14px 0 0">
          ${(quarter.template || []).length
            ? `<button class="btn-primary" data-a="seed" style="flex:1">Start from the template</button>`
            : ''}
          <button class="btn-ghost" data-a="template" style="flex:1">${
            (quarter.template || []).length ? 'Edit the template' : 'Set up a week template'}</button>
        </div>` : ''}

        <!-- Every episode has its own board, built in (Creator Studio 3). -->
        <div class="sec" style="margin-top:22px"><h2>Board</h2><div class="rule"></div></div>
        <button class="noterow" data-a="board">
          <span class="dot" style="background:var(--orange)"></span>
          <span class="t"><b>Open this week's board</b>
            <small>The canvas for planning it — shots, stills, notes, music</small></span>
          ${U.ICON.chevR}
        </button>
      </div>`;
    }

    /* ---- Shoot: the page you open at the tripod ----

       It used to be the week: a calendar, a table of every sequence, and the
       batch panel — three views of the same list, which is why it read as a
       duplicate of Plan. Plan is the desk. This is today: what am I filming,
       in what order, what have I got. */
    function renderWeek(){
      const days = weekDays();
      const beats = everyBeat(v);
      const unscheduled = beats.filter(x => !x.beat.day);

      /* the day in focus — today if the week contains it, else the first day
         that still has something to film */
      const withWork = days.filter(d => beats.some(x => x.beat.day === d.day && !x.beat.done));
      if(focusDay == null){
        const t = days.find(d => d.day === today);
        focusDay = (t && beats.some(x => x.beat.day === t.day)) ? t.day
          : (withWork[0] ? withWork[0].day : (days[0] ? days[0].day : null));
      }
      const focus = days.find(d => d.day === focusDay) || days[0];
      const mine = focus ? beats.filter(x => x.beat.day === focus.day) : [];
      const mineLeft = mine.filter(x => !x.beat.done);

      el.innerHTML = Screens.bar({ kicker:v.week ? `Episode ${v.week}` : 'Vlog builder', title:v.title,
        actions:`<span class="modetog">
          <button data-a="mode-plan" aria-pressed="false">Plan</button>
          <button data-a="mode-board" aria-pressed="false">Board</button>
          <button data-a="mode-week" aria-pressed="true">Shoot</button>
          <button data-a="mode-outline" aria-pressed="false">Edit</button>
        </span>` }) + `
      <div class="view">

        <!-- which day you are filming; the rest of the week is one tap away
             without being a second calendar -->
        <div class="dstrip">
          ${days.map(d => {
            const n = beats.filter(x => x.beat.day === d.day);
            const done = n.filter(x => x.beat.done).length;
            return `<button data-focus="${d.day}" aria-pressed="${d.day === focusDay}"
              class="${n.length ? (done === n.length ? 'all' : '') : 'empty'}">
              <b>${d.date.toLocaleDateString(undefined, { weekday:'short' }).slice(0,2)}</b>
              <span>${n.length || '·'}</span>
            </button>`;
          }).join('')}
        </div>

        ${focus ? `
          <div class="sec"><h2>${focus.date.toLocaleDateString(undefined,
            { weekday:'long', month:'short', day:'numeric' })}</h2><div class="rule"></div>
            <span class="alt">${mine.length}</span></div>

          ${mine.length ? `
            ${(() => {
              /* Batched by setup, because that is the order you actually film
                 in: everything on the tripod, then everything outside. */
              const groups = {};
              mineLeft.forEach(x => {
                const k = x.beat.setup || 'talking';
                (groups[k] = groups[k] || []).push(x);
              });
              const order = Object.keys(groups);
              if(!order.length) return `<div class="wf" style="margin:0 0 14px">
                <p style="margin:0;font-size:14px;color:var(--green)">Everything here is captured.</p>
              </div>`;

              return order.map(k => {
                const setup = (window.Quarters && Quarters.setupOf)
                  ? Quarters.setupOf(k) : { label:k, d:'' };
                return `
                  <p class="shootgroup">${setup.label}<span>${groups[k].length}</span></p>
                  ${groups[k].map(x => seqShootCard(x.act, x.beat)).join('')}`;
              }).join('');
            })()}

            ${mine.some(x => x.beat.done) ? `
              <p class="shootgroup done">Captured<span>${mine.filter(x => x.beat.done).length}</span></p>
              ${mine.filter(x => x.beat.done).map(x => seqShootCard(x.act, x.beat)).join('')}` : ''}
          ` : `<div class="empty"><b>Nothing on this day</b>
                Plan it first, or pick another day above.</div>`}
        ` : ''}

        ${unscheduled.length ? `
          <div class="sec" style="margin-top:22px"><h2>No day yet</h2><div class="rule"></div>
            <span class="alt">${unscheduled.length}</span></div>
          <p class="hintline" style="margin:0 0 10px">These will not reach your task list
            until they have one.</p>
          ${unscheduled.map(x => `
            <button class="noterow" data-moveto="${x.beat.id}">
              <span class="dot" style="background:var(--dim)"></span>
              <span class="t"><b>${x.beat.title}</b>
                ${setupTag(x.beat)}
                <small>${x.act.title}</small></span>
              ${ICON.chevR}
            </button>`).join('')}` : ''}
      </div>`;
    }

    /* the kind of thing it is, visible from the list */
    function setupTag(b){
      if(!(window.Quarters && Quarters.setupOf)) return '';
      const st = Quarters.setupOf(b.setup || 'talking');
      return `<span class="setuptag" style="color:${st.c};border-color:${st.c}55;
        background:${st.c}14">${st.label}</span>`;
    }

    /* One sequence, as it reads while you are filming it: what it is, the line
       you say, and the shots to tick as you get them. */
    function seqShootCard(act, b){
      const sh = b.shots || [];
      const done = sh.filter(x => x.done).length;
      const all = sh.length > 0 && done === sh.length;

      return `
        <article class="seqcard${all || b.done ? ' all' : ''}">
          <button class="sc-head" data-beat="${b.id}">
            <span class="dot" style="background:${b.done ? 'var(--green)' : 'var(--orange)'}"></span>
            <span class="t">
              <b>${b.title}</b>
              ${setupTag(b)}
              <small>${[act.title, b.at ? fmtTime(b.at) : '',
                         sh.length ? `${done}/${sh.length} shots` : 'no shots listed'
                        ].filter(Boolean).join(' · ')}</small></span>
            ${ICON.chevR}
          </button>

          ${b.script ? `<p class="sc-line">${b.script}</p>` : ''}

          ${sh.length ? `
            <details class="seqshots"${!all ? ' open' : ''}>
              <summary>
                <span class="sq-n">${done}/${sh.length} shots</span>
                <span class="sq-go">${ICON.chevR}</span>
              </summary>
              <div class="sq-list">
                ${sh.map(x => `<div class="shotline${x.done ? ' done' : ''}"
                  data-shot="${b.id}:${x.id}">
                  <span class="bx">${ICON.check}</span>
                  <span class="tx">${x.text}</span>
                  ${x.framing ? `<span class="tag">${x.framing}</span>` : ''}
                </div>`).join('')}
              </div>
            </details>` : ''}

          <div class="sc-foot">
            <button data-moveto="${b.id}">Move to another day</button>
            <button data-done="${b.id}">${b.done ? 'Not captured after all' : 'Mark captured'}</button>
          </div>
        </article>`;
    }

    async function moveBeatToDay(key, vlogId, target){
      const id = key.split(':')[1];
      const f = findBeat(id);
      if(!f) return;
      const d = target.dataset.drop;
      f.beat.day = d === '' ? null : +d;
      if(d === '') f.beat.at = null;
      await save();
      renderWeek();
    }

    const findBeat = id => {
      for(const a of v.acts){ const b = a.beats.find(x => x.id === id); if(b) return { act:a, beat:b }; }
      return null;
    };

    async function scheduleBeat(b){
      const field = await U.dayField('bd', b.day ?? today);
      App.sheet(`
        <h2>Schedule this beat</h2>
        <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.55">
          Pick the date you'll shoot it. It appears on Today for that date, with its shots as the
          list to capture.</p>
        ${field}
        <div class="field"><label for="ba">Time <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <input id="ba" type="time" value="${b.at || ''}"></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Schedule</button>
          <button class="btn-ghost" data-clear>Unschedule</button>
        </div>`, sheetEl => {
        U.wireDayField(sheetEl, 'bd');
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-clear]')){ b.day = null; b.at = null; await save(); App.closeSheet(); return render(); }
          if(!e.target.closest('[data-save]')) return;
          const n = await U.readDayField(sheetEl, 'bd');
          if(!n) return U.toast('Pick a date');
          b.day = n;
          b.at = sheetEl.querySelector('#ba').value || null;
          await save(); App.closeSheet(); render();
        });
      });
    }

    /* Hold a sequence to pick several and delete them together. The cards carry
       data-beat in every mode, so one setup covers Plan, Shoot and Edit. */
    if(window.Select) Select.enable(el, {
      itemSelector: '.seqcard',
      noun: 'sequence',
      idOf: n => {
        const head = n.querySelector('[data-beat]');
        return head ? head.dataset.beat : null;
      },
      warning: 'Their shots go with them. Any task already on your days is removed too.',
      onDelete: async ids => {
        for(const id of ids){
          const found = findBeat(id);
          if(found && found.beat.taskId){
            try { await Store.del('tasks', found.beat.taskId); } catch(err){}
          }
        }
        v.acts.forEach(a => { a.beats = (a.beats || []).filter(b => !ids.includes(b.id)); });
        await save();
        try { Data.invalidate && Data.invalidate('tasks'); } catch(err){}
      },
      onDone: async () => { await load(); render(); }
    });

    el.addEventListener('input', e => {
      const f = e.target.dataset && e.target.dataset.ep5;
      if(f){ v[f] = e.target.value; save(); return; }
      const bk = e.target.dataset && e.target.dataset.ep5beat;
      if(bk){ v.scriptBeats = { ...(v.scriptBeats || {}), [bk]: e.target.value }; save(); }
    });
    el.addEventListener('change', async e => {
      if(e.target.dataset && e.target.dataset.ep5date !== undefined && e.target.hasAttribute('data-ep5date')){
        const val = e.target.value;
        const auto = epDates ? Months.thursdayAfter(epDates.filmEnd) : null;
        v.releaseDate = val && val !== auto ? val : null;
        await save(); await load(); render();
      }
    });
    el.addEventListener('click', async e => {
      const er = e.target.closest('[data-ep5res]');
      if(er){
        v.result = er.dataset.ep5res || null; await save(); render();
        if(window.Celebrate && Celebrate.checkLevel) Celebrate.checkLevel();
        return;
      }
      const hb = e.target.closest('[data-ep5hab]');
      if(hb){
        const k = hb.dataset.ep5hab;
        v.habitDays = { ...(v.habitDays || {}) };
        v.habitDays[k] = Scoreboard.clampDay((v.habitDays[k] || 0) + (+hb.dataset.d));
        await save(); render();
        if(window.Celebrate && Celebrate.checkLevel) Celebrate.checkLevel();
        return;
      }
      if(e.target.closest('[data-ep5stat]')) return Screens.push('statcard', { id:v.id });
      const sg = e.target.closest('[data-ep5seg]');
      if(sg){
        const g = (v.segments || [])[+sg.dataset.ep5seg];
        if(g){ g.status = Months.SEG_NEXT[g.status] || 'shot'; await save(); render(); }
        return;
      }
      if(e.target.closest('[data-ep5segs]')){ v.segments = Months.defaultSegments(); await save(); return render(); }
      if(e.target.closest('[data-ep5reset]')){ v.releaseDate = null; await save(); await load(); return render(); }
      const bs = e.target.closest('.ep5-beats > summary');
      if(bs){ beatsOpen = !bs.parentElement.open; return; }
      const mo = e.target.closest('[data-a^="month-"]');
      if(mo){
        const k = mo.dataset.a;
        if(k === 'month-open' && monthRec) return Screens.push('month', { id:monthRec.id,
          onChange: async () => { await load(); render(); } });
        if(k === 'month-suggest' && monthSuggest) return setMonth(monthSuggest);
        if(k === 'month-tag') return pickMonth();
        return;
      }
      const tg = e.target.closest('[data-toggle]');
      if(tg){
        const a = v.acts.find(x => x.id === tg.dataset.toggle);
        a.open = !a.open; await save(); return render();
      }
      const mv = e.target.closest('[data-move]');
      if(mv){
        const [dir, actId, beatId] = mv.dataset.move.split(':');
        const a = v.acts.find(x => x.id === actId);
        const i = a.beats.findIndex(x => x.id === beatId);
        const j = dir === 'up' ? i-1 : i+1;
        if(j < 0 || j >= a.beats.length) return;
        [a.beats[i], a.beats[j]] = [a.beats[j], a.beats[i]];
        await save(); return render();
      }
      const am = e.target.closest('[data-actmove]');
      if(am){
        const [dir, id] = am.dataset.actmove.split(':');
        const i = v.acts.findIndex(x => x.id === id);
        const j = dir === 'up' ? i-1 : i+1;
        if(j < 0 || j >= v.acts.length) return;
        [v.acts[i], v.acts[j]] = [v.acts[j], v.acts[i]];
        await save(); return render();
      }
      const sh = e.target.closest('[data-shot]');
      if(sh){
        const [beatId, shotId] = sh.dataset.shot.split(':');
        const f = findBeat(beatId);
        const s = f.beat.shots.find(x => x.id === shotId);
        s.done = !s.done;
        if(f.beat.shots.every(x => x.done)) f.beat.done = true;
        await save(); return render();
      }
      const dn = e.target.closest('[data-done]');
      if(dn){ const f = findBeat(dn.dataset.done); f.beat.done = !f.beat.done; await save(); return render(); }
      const sc = e.target.closest('[data-sched]');
      if(sc) return scheduleBeat(findBeat(sc.dataset.sched).beat);

      /* nothing inside the card claimed the tap, so open the beat */
      const card = e.target.closest('[data-beat]');
      if(card){
        return Screens.push('vlog-beat', { vlogId:v.id, beatId:card.dataset.beat,
          onChange:async () => { await load(); render(); } });
      }

      const ab = e.target.closest('[data-addbeat]');
      if(ab){
        const a = v.acts.find(x => x.id === ab.dataset.addbeat);
        const b = { id:uid('b'), title:`Sequence ${(a.beats || []).length + 1}`,
                    purpose:'', shots:[], day:a.day ?? null, at:null, done:false, clipId:null };
        a.beats.push(b); await save();
        return Screens.push('vlog-beat', { vlogId:v.id, beatId:b.id,
          onChange:async () => { await load(); render(); } });
      }
      /* One day's visuals. Same board as the episode's — a week is one board —
         opened showing only this day's sections, so you can draw and arrange
         Tuesday without the rest of the week in the way. */
      const abd = e.target.closest('[data-actboard]');
      if(abd){
        const a = v.acts.find(x => x.id === abd.dataset.actboard);
        if(!a) return;
        if(!(a.beats || []).length)
          return U.toast('Add a beat to this day first — the board draws a section per beat');
        return BoardLink.open({ type:'vlog', id:v.id, name:v.title,
          kicker: a.title || 'Day', focus:`act:${a.id}`,
          onChange: async () => { await load(); render(); } });
      }

      const ad = e.target.closest('[data-actday]');
      if(ad){
        const a = v.acts.find(x => x.id === ad.dataset.actday);
        const field = await U.dayField('ad', a.day ?? today);
        App.sheet(`<h2>${a.title}</h2>
          <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.55">
            Setting a date here schedules every beat in this act onto it.</p>
          ${field}
          <div class="sheetcta"><button class="btn-primary" data-save>Set for the act</button>
            <button class="btn-ghost" data-clear>Clear</button></div>`, sheetEl => {
          U.wireDayField(sheetEl, 'ad');
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-clear]')){
              a.day = null; a.beats.forEach(b => b.day = null);
              await save(); App.closeSheet(); return render();
            }
            if(!ev.target.closest('[data-save]')) return;
            const n = await U.readDayField(sheetEl, 'ad');
            if(!n) return U.toast('Pick a date');
            a.day = n; a.beats.forEach(b => b.day = n);
            await save(); App.closeSheet(); render();
          });
        });
        return;
      }
      const an = e.target.closest('[data-actname]');
      if(an){
        const a = v.acts.find(x => x.id === an.dataset.actname);
        App.sheet(`<h2>Rename act</h2>
          <div class="field"><label for="at">Title</label>
            <input id="at" type="text" value="${a.title.replace(/"/g,'&quot;')}"></div>
          <div class="sheetcta"><button class="btn-primary" data-save>Save</button>
            <button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-save]')) return;
            const t = sheetEl.querySelector('#at').value.trim();
            if(!t) return U.toast('Give the act a name');
            a.title = t; await save(); App.closeSheet(); render();
          });
        });
        return;
      }
      const adel = e.target.closest('[data-actdel]');
      if(adel){
        v.acts = v.acts.filter(x => x.id !== adel.dataset.actdel);
        await save(); return render();
      }

      const msRow = e.target.closest('[data-ms]');
      if(msRow){
        const [cid, mid] = msRow.dataset.ms.split(':');
        await Challenges.toggleMilestone(cid, mid);
        await load(); return render();
      }

      const fd = e.target.closest('[data-focus]');
      if(fd){ focusDay = +fd.dataset.focus; return render(); }

      /* Move a sequence to another day. Days are the act blocks, so this moves it
         between them as well as setting its date — leaving it in Monday's block
         with Tuesday's date is how the two views end up disagreeing. */
      const mv2 = e.target.closest('[data-moveto]');
      if(mv2){
        const found = findBeat(mv2.dataset.moveto);
        if(!found) return;
        return moveSheet(found);
      }

      /* Neither a day row nor a source row carries data-a, so both have to be
         handled before the bail-out below — otherwise the tap is discarded and
         the row looks dead. */
      const rsRow = e.target.closest('[data-rs]');
      if(rsRow && window.Research){
        const found = weekSources.find(x => x.id === rsRow.dataset.rs);
        if(found) return Research.edit(found, { onSaved: async () => { await load(); render(); } });
        return;
      }
      const srcRow = e.target.closest('[data-src]');
      if(srcRow){
        const found = weekSources.find(x => x.id === srcRow.dataset.src);
        if(found) return sourceSheet(found);
        return;
      }

      const dayOpen = e.target.closest('[data-day]');
      if(dayOpen){
        return Screens.push('vlog-day', { vlogId:v.id, actId:dayOpen.dataset.day,
          onChange:async () => { await load(); render(); } });
      }

      const a2 = e.target.closest('[data-a]');
      if(!a2) return;

      /* Turning beats into real tasks. A derived card shows on the day but cannot
         be swiped and does not count toward the streak — a task can do both. */
      if(a2.dataset.a === 'tasks'){
        /* the flow lives in VlogTasks now, so a day screen can use it too */
        VlogTasks.sheet(v, {
          scope: a2.dataset.act || null,
          dayLabel, fmtTime,
          onDone: async () => { await load(); render(); }
        });
        return;
      }

      /* choose a shape for the week, keeping whatever is already written */
      if(a2.dataset.a === 'shape'){
        const hasWork = (v.acts || []).some(a => (a.beats || []).length);
        App.sheet(`
          <h2>Give the week a shape</h2>
          <p style="margin:0 0 14px;color:var(--muted);font-size:14.5px;line-height:1.6">
            A spine to cut against. Every beat arrives with a job — you change the words,
            the structure holds.</p>
          ${hasWork ? `<p style="margin:0 0 14px;padding:11px 12px;border-radius:var(--r);
            background:rgba(232,163,61,.1);border:1px solid rgba(232,163,61,.35);font-size:13.5px;
            color:var(--amber);line-height:1.5">
            This replaces the acts you already have. Anything scheduled or shot stays on the calendar.</p>` : ''}
          <div style="margin:0 0 14px">
            ${Story.SHAPES.map(sh => `<button class="row" data-shape="${sh.id}">
              <span class="lbl">${sh.n}<small>${sh.d}</small></span>
              <span style="font-family:var(--display),sans-serif;font-weight:900;color:var(--muted)">${
                sh.acts.reduce((n,a) => n + a.beats.length, 0)}</span>
            </button>`).join('')}
          </div>
          <div class="sheetcta"><button class="btn-ghost" data-cancel>Cancel</button></div>`,
        sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            const pick = ev.target.closest('[data-shape]');
            if(!pick) return;
            v.acts = Story.applyShape(pick.dataset.shape, uid);
            await save();
            App.closeSheet();
            U.toast('Structure applied');
            await load(); render();
          });
        });
        return;
      }

      if(a2.dataset.a === 'setweek'){
        const cur = await Data.currentWeek();
        App.sheet(`<h2>Which week</h2>
          <div class="field"><label for="vw">Week</label>
            <input id="vw" type="number" min="1" value="${v.week || cur}"></div>
          <p id="vwprev" style="margin:0;color:var(--cream);font-size:14.5px"></p>
          <div class="sheetcta"><button class="btn-primary" data-save>Save</button>
            <button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
          const input = sheetEl.querySelector('#vw');
          const prev = sheetEl.querySelector('#vwprev');
          const refresh = async () => {
            const n = Math.max(1, +input.value || 1);
            const d = await Data.weekDates(n);
            const m = await Data.monthOfWeek(n);
            prev.innerHTML = `<b>Episode ${n}</b> · ${d.label} · ${m.label}`;
          };
          input.addEventListener('input', refresh); refresh();
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-save]')) return;
            const nw = Math.max(1, +input.value || 1);
            /* one episode per week of a month: a week another episode of the
               same month already has is refused rather than doubled up */
            if(window.Months && v.monthId && nw !== +v.week){
              const mo2 = await Months.get(v.monthId);
              const holder = mo2 ? await Months.slotHolder(mo2, nw, v.id) : null;
              if(holder) return U.toast(`Week ${nw} of ${mo2.name} already has "${holder.title}"`);
            }
            v.week = nw;
            if(window.Months && v.monthId){
              const mo2 = await Months.get(v.monthId);
              if(mo2) v.isVerdict = !!(await Months.fitFor(v, mo2)).last;
            }
            await save(); await load(); App.closeSheet(); render();
          });
        });
        return;
      }
      /* the quarter's skeleton, dropped in so a week starts with six rows
         rather than a blank page. Only ever adds what is missing. */
      /* one day, one setup, everything of that kind filmed together */
      const bt = e.target.closest('[data-batch]');
      if(bt){
        const k = bt.dataset.batch;
        const items = everyBeat(v).filter(x => !x.beat.done && (x.beat.setup || 'talking') === k);
        if(!items.length) return;
        const setup = (window.Quarters && Quarters.setupOf) ? Quarters.setupOf(k) : { label:k, d:'' };
        const field = await U.dayField('bt', items.find(x => x.beat.day)
          ? items.find(x => x.beat.day).beat.day : today);

        App.sheet(`
          <h2 style="margin:0 0 3px">${setup.label}</h2>
          <p class="hintline" style="margin:0 0 14px">${items.length} sequence${
            items.length === 1 ? '' : 's'} shot the same way. Put them on one day and film them
            back to back.</p>
          <div class="group compact" style="margin:0 0 14px;max-height:34vh;overflow-y:auto">
            ${items.map(x => `<div class="row" style="cursor:default">
              <span class="lbl">${x.beat.title}<small>${
                x.beat.day != null ? dayLabel(x.beat.day) : 'no day yet'}${
                (x.beat.shots || []).length ? ' · ' + x.beat.shots.length + ' shots' : ''}</small></span>
            </div>`).join('')}
          </div>
          ${field}
          <div class="field"><label for="bta">Time <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
            <input id="bta" type="time"></div>
          <div class="sheetcta">
            <button class="btn-primary" data-save>Put all ${items.length} on this day</button>
            <button class="btn-ghost" data-cancel>Cancel</button>
          </div>`, sheetEl => {
          U.wireDayField(sheetEl, 'bt');
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-save]')) return;
            const n = await U.readDayField(sheetEl, 'bt');
            if(!n) return U.toast('Pick a date');
            const at = sheetEl.querySelector('#bta').value || null;
            items.forEach(x => { x.beat.day = n; x.beat.at = at; });
            await save();
            App.closeSheet();
            U.toast(`${items.length} set for ${dayLabel(n)}`);
            render();
          });
        });
        return;
      }

      if(a2.dataset.a === 'unboard'){
        v.boardId = null;
        await save();
        await load(); return render();
      }

      if(a2.dataset.a === 'board') return BoardLink.open({ type:'vlog', id:v.id, name:v.title,
        kicker: v.week ? `Episode ${v.week}` : 'Episode', onChange: async () => { await load(); render(); } });
      if(a2.dataset.a === 'board-old'){
        if(v.boardId){
          /* the way back is this episode, so the other app can return you */
          const ok = Storyboard.openBoard(v.boardId, Storyboard.backLink('vlog', v.id));
          if(!ok) U.toast('Could not open the storyboard app');
          return;
        }
        App.sheet(`
          <h2 style="margin:0 0 3px">Link a board</h2>
          <p class="hintline" style="margin:0 0 14px">Paste the board's id, or the whole
            link if that is what the storyboard app gives you.</p>
          <input id="sb-id" class="pgname" type="text" placeholder="board id"
            autocomplete="off" autocapitalize="off" spellcheck="false">
          <div class="sheetcta">
            <button class="btn-primary" data-save>Link it</button>
            <button class="btn-ghost" data-cancel>Cancel</button>
          </div>`, sheet => {
          sheet.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-save]')) return;
            const id = Storyboard.idFrom(sheet.querySelector('#sb-id').value);
            if(!id) return U.toast('Paste an id first');
            v.boardId = id;
            await save();
            App.closeSheet();
            await load(); render();
          });
          setTimeout(() => { const f = sheet.querySelector('#sb-id'); if(f) f.focus(); }, 180);
        });
        return;
      }

      if(a2.dataset.a === 'template') return templateSheet();

      if(a2.dataset.a === 'seed'){
        if(!quarter || !(quarter.template || []).length) return;
        const have = new Set(everyBeat(v).map(x => x.beat.title.toLowerCase()));
        const act = v.acts[0] || (v.acts[0] = { id:uid('a'), title:'Unsorted', beats:[] });
        let added = 0;
        (quarter.template || []).forEach(t => {
          if(have.has(t.title.toLowerCase())) return;
          act.beats.push({ id:uid('b'), title:t.title, purpose:t.note || '',
                           setup:t.setup || 'talking', script:'', sourceId:null,
                           shots:[], day:null, at:null, done:false, clipId:null });
          added++;
        });
        await save();
        U.toast(added ? `${added} sequence${added === 1 ? '' : 's'} added` : 'Already there');
        return render();
      }

      /* a sequence belongs to the day you added it from */
      const addTo = e.target.closest('[data-addto]');
      if(addTo){
        const act = v.acts.find(x => x.id === addTo.dataset.addto);
        if(!act) return;
        const b = { id:uid('b'), title:`Sequence ${(act.beats || []).length + 1}`,
                    purpose:'', setup:'talking', script:'', sourceId:null, shots:[],
                    /* takes the day it was added to, so it is already scheduled */
                    day:act.day ?? null, at:null, done:false, clipId:null };
        act.beats.push(b);
        await save();
        return Screens.push('vlog-beat', { vlogId:v.id, beatId:b.id,
          onChange:async () => { await load(); render(); } });
      }

      if(a2.dataset.a === 'addseg'){
        const act = v.acts[0] || (v.acts[0] = { id:uid('a'), title:'Unsorted', beats:[] });
        const b = { id:uid('b'), title:`Sequence ${(act.beats || []).length + 1}`,
                    purpose:'', setup:'talking', script:'', sourceId:null, shots:[],
                    /* takes the day it was added to, so it is already scheduled */
                    day:act.day ?? null, at:null, done:false, clipId:null };
        act.beats.push(b);
        await save();
        return Screens.push('vlog-beat', { vlogId:v.id, beatId:b.id,
          onChange:async () => { await load(); render(); } });
      }

      if(a2.dataset.a === 'addsrc') return sourceSheet(null);
      if(a2.dataset.a === 'rs-add') return Research.quickAdd({ vlogId:v.id,
        onSaved: async saved => {
          /* logged from an episode, it belongs to that episode's quarter too */
          if(saved && quarter && !saved.quarterId) await Quarters.saveSource({ ...saved, quarterId:quarter.id });
          await load(); render();
        } });
      if(a2.dataset.a === 'rs-link') return Research.pickFor(v.id, async () => { await load(); render(); });

      if(a2.dataset.a === 'openquarter')
        return Screens.push('quarter', { id: quarter ? quarter.id : null,
          onChange:async () => { await load(); render(); } });

      if(a2.dataset.a === 'mode-plan'){ mode = 'plan'; return render(); }
      /* The board is a canvas and wants the whole screen, so it opens over
         the episode rather than inside it; back returns here. */
      if(a2.dataset.a === 'mode-board') return BoardLink.open({ type:'vlog', id:v.id, name:v.title,
        kicker: v.week ? `Episode ${v.week}` : 'Episode', onChange: async () => { await load(); render(); } });
      if(a2.dataset.a === 'mode-outline'){ mode = 'outline'; return render(); }
      if(a2.dataset.a === 'mode-week'){ mode = 'week'; return render(); }
      if(a2.dataset.a === 'wprev'){ weekOffset--; return renderWeek(); }
      if(a2.dataset.a === 'wnext'){ weekOffset++; return renderWeek(); }
      if(a2.dataset.a === 'addact'){
        v.acts.push({ id:uid('a'), title:`Act ${v.acts.length + 1}`, day:null, open:true, beats:[] });
        await save(); return render();
      }
      if(a2.dataset.a === 'rename'){
        App.sheet(`<h2>Rename outline</h2>
          <div class="field"><label for="vt">Title</label>
            <input id="vt" type="text" value="${v.title.replace(/"/g,'&quot;')}"></div>
          <div class="sheetcta"><button class="btn-primary" data-save>Save</button>
            <button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-save]')) return;
            const t = sheetEl.querySelector('#vt').value.trim();
            if(!t) return U.toast('Give it a title');
            v.title = t; await save(); App.closeSheet(); render();
          });
        });
        return;
      }
      if(a2.dataset.a === 'delete'){
        if(!confirm(`Delete "${v.title || 'this episode'}"? Its sequences go with it; research on it goes back to unassigned.`)) return;
        await deleteEpisodes([v.id]);
        params.onChange && params.onChange();
        Screens.pop();
      }
    });

    await load();
    render();
    Timeline.wireDrag(el, moveBeatToDay, '[data-drop]');
  }

  /* ---------- one beat: purpose, shots, clip ---------- */
  async function mountBeat(el, params){
    let v, act, b, clips = [], series = [], startDate = null;
    const dayLabel = n => {
      if(!startDate) return `Day ${n}`;
      const d = new Date(startDate);
      d.setDate(d.getDate() + (n - 1));
      return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    };

    async function load(){
      v = migrate(await Store.get('vlogs', params.vlogId));
      for(const a of v.acts){
        const f = a.beats.find(x => x.id === params.beatId);
        if(f){ act = a; b = f; break; }
      }
      clips = await Data.clips();
      series = await Data.series();
      startDate = (await Data.program()).start;
      try {
        const m = v.week ? await Data.monthOfWeek(v.week) : null;
        const q = m ? await Quarters.forMonth(m.key) : null;
        /* this week's own reading leads; the quarter's pool follows */
        const { mine, pool } = await Quarters.citable(v.id, q ? q.id : null);
        qSources = [...mine, ...pool];
      } catch(e){ qSources = []; }
    }
    const save = async () => { await Store.put('vlogs', v); params.onChange && params.onChange(); };

    /* what this line is citing, drawn from the quarter's reading */
    let qSources = [];
    function srcOptions(){
      if(!qSources.length) return '';
      return `<select id="bsrc" class="pgbar" style="margin:9px 0 0">
        <option value="">Not citing anything</option>
        ${qSources.map(x => `<option value="${x.id}" ${b.sourceId === x.id ? 'selected' : ''}
          >${(x.work || x.passage || '').slice(0, 50)}${x.author ? ' — ' + x.author : ''}</option>`).join('')}
      </select>`;
    }

    function render(){
      if(!b){ Screens.pop(); return; }
      const clip = clips.find(c => c.id === b.clipId);
      const done = (b.shots || []).filter(s => s.done).length;

      el.innerHTML = Screens.bar({ kicker:act.title, title:b.title,
        actions:`<button class="btn-sm" data-a="rename">Rename</button>` }) + `
      <div class="view">
        ${(() => {
          const cur = b.fn ? Story.fn(b.fn) : null;
          return `<details class="nu-fold" style="--nu:${cur ? cur.c : 'var(--muted)'}"${
            cur ? '' : ' open'}>
            <summary>
              <span class="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                  stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 8l7-5 7 5"/></svg>
              </span>
              <span class="tx"><b>What job it does</b>
                <span>${cur ? cur.d : 'Not set — every beat needs one'}</span></span>
              ${cur ? `<span class="fntag" style="--fc:${cur.c};margin:0 8px 0 0">${cur.n}</span>` : ''}
              <svg class="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
                stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </summary>
            <div class="nu-body">
              <div class="fnpick">
                ${Story.FUNCTIONS.map(f => `<button type="button" data-fn="${f.id}"
                  style="--fc:${f.c}" aria-pressed="${b.fn === f.id}">
                  <b>${f.n}</b><small>${f.d}</small>
                </button>`).join('')}
              </div>
            </div>
          </details>`;
        })()}

        <div class="block">
          <h4>How it gets shot</h4>
          <p class="hintline" style="margin:0 0 9px">This is what decides what can be
            filmed back to back.</p>
          <select id="bsetup" class="pgbar">
            ${((window.Quarters && Quarters.SETUPS) || [{ k:'talking', label:'Talking head', d:'' }])
              .map(st => `<option value="${st.k}" ${(b.setup || 'talking') === st.k ? 'selected' : ''}
                >${st.label}${st.d ? ' — ' + st.d : ''}</option>`).join('')}
          </select>
        </div>

        <div class="block">
          <h4>The line</h4>
          <p class="hintline" style="margin:0 0 9px">What you actually say, word for word.
            A quote belongs here, not in the source — the source is the book.</p>
          <textarea id="bscript" rows="4" placeholder="Say it the way you will say it on camera."
            style="width:100%;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
            color:var(--cream);font-size:15.5px;padding:11px;outline:none;line-height:1.5;resize:vertical"
            >${b.script || ''}</textarea>
          ${srcOptions()}
        </div>

        <div class="block">
          <h4>Why this sequence exists</h4>
          <textarea id="purpose" rows="3" placeholder="What it does for the story — what the viewer knows or feels after it that they did not before."
            style="width:100%;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
            color:var(--cream);font-size:15.5px;padding:11px;outline:none;line-height:1.5;resize:vertical">${b.purpose || ''}</textarea>
        </div>

        <div class="block">
          <h4>Shots · ${done} of ${(b.shots||[]).length} captured</h4>
          ${(b.shots||[]).length ? (b.shots||[]).map((s,i) => `
            <div class="shotline${s.done ? ' done' : ''}" data-shot="${s.id}">
              <span class="bx">${ICON.check}</span>
              <span class="tx">${s.text}${s.note ? `<br><span style="color:var(--dim);font-size:12.5px">${s.note}</span>` : ''}</span>
              ${s.framing ? `<span class="tag">${s.framing}</span>` : ''}
              ${s.movement ? `<span class="tag">${s.movement}</span>` : ''}
              <button class="mini" data-editshot="${s.id}" aria-label="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14.5 6.5l3 3"/></svg></button>
            </div>`).join('')
            : `<p style="margin:0;color:var(--muted);font-size:14.5px">No shots yet. Add the setups you need for this sequence.</p>`}
          <div style="display:flex;gap:8px">
            <button class="addbeat" data-a="addshot" style="flex:1">+ Add a shot</button>
            <button class="addbeat" data-a="suggestshots" style="flex:1">✦ Suggest shots</button>
          </div>
        </div>

        <div class="block">
          <h4>Scheduling</h4>
          <div class="metaline" style="margin:0">
            <button class="btn-sm" data-a="sched">
              ${b.day != null ? `${dayLabel(b.day)}${b.at ? ' · ' + fmtTime(b.at) : ''}` : 'Not scheduled'}</button>
          </div>
        </div>

        <div class="block">
          <h4>Clip</h4>
          ${clip
            ? `<button class="noterow" data-a="openclip" style="margin:0 0 10px">
                 <span class="dot" style="background:var(--orange)"></span>
                 <span class="t"><b>${clip.title}</b>
                   <small>${clip.state}${clip.dur && clip.dur !== '0:00' ? ' · ' + clip.dur : ''}</small></span>
                 ${ICON.chevR}
               </button>
               <div class="metaline" style="margin:0">
                 <button class="btn-sm" data-a="unlink">Unlink</button></div>`
            : `<p style="margin:0 0 12px;color:var(--muted);font-size:14.5px;line-height:1.55">
                 No clip yet. Create one and this sequence gets a real entry in Clips you can move through
                 raw, queued and posted.</p>
               <div class="metaline" style="margin:0">
                 <button class="btn-sm accent" data-a="makeclip">Create clip</button>
                 <button class="btn-sm" data-a="linkclip">Link existing</button></div>`}
        </div>

        <button class="btn-ghost" data-a="delete" style="width:100%;color:var(--red);border-color:rgba(226,86,74,.4)">Delete sequence</button>
      </div>`;
    }

    function editShot(shot){
      const isNew = !shot;
      const s = shot || { id:uid('s'), text:'', note:'', framing:'', movement:'', done:false };
      App.sheet(`
        <h2>${isNew ? 'New shot' : 'Edit shot'}</h2>
        <div class="field"><label for="st">The shot</label>
          <input id="st" type="text" value="${(s.text||'').replace(/"/g,'&quot;')}" placeholder="Hands on the bar, sunrise behind"></div>
        <div class="field"><label for="sn">Note <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <input id="sn" type="text" value="${(s.note||'').replace(/"/g,'&quot;')}" placeholder="Wait for the light"></div>
        <div class="field"><label>Framing</label><div class="opts" data-group="framing">
          ${FRAMING.map(f => `<button type="button" class="opt" data-v="${f}" aria-pressed="${s.framing===f}">${f}</button>`).join('')}
        </div></div>
        <div class="field"><label>Movement</label><div class="opts" data-group="movement">
          ${MOVEMENT.map(m => `<button type="button" class="opt" data-v="${m}" aria-pressed="${s.movement===m}">${m}</button>`).join('')}
        </div></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>${isNew ? 'Add shot' : 'Save'}</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${isNew ? '' : `<button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete shot</button>`}`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          const opt = e.target.closest('.opt');
          if(opt){
            const g = opt.closest('.opts');
            const was = opt.getAttribute('aria-pressed') === 'true';
            g.querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed','false'));
            opt.setAttribute('aria-pressed', String(!was));   /* tapping again clears it */
            return;
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-delete]')){
            b.shots = b.shots.filter(x => x.id !== s.id);
            await save(); App.closeSheet(); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          const t = sheetEl.querySelector('#st').value.trim();
          if(!t) return U.toast('Describe the shot');
          const pick = g => {
            const el2 = sheetEl.querySelector(`[data-group="${g}"] .opt[aria-pressed="true"]`);
            return el2 ? el2.dataset.v : '';
          };
          s.text = t;
          s.note = sheetEl.querySelector('#sn').value.trim();
          s.framing = pick('framing');
          s.movement = pick('movement');
          b.shots = b.shots || [];
          if(isNew) b.shots.push(s);
          await save(); App.closeSheet(); render();
        });
        setTimeout(() => { const f = sheetEl.querySelector('#st'); if(f) f.focus(); }, 180);
      });
    }

    el.addEventListener('input', e => {
      /* the two long fields save themselves as you type */
      if(e.target.id === 'purpose') b.purpose = e.target.value;
      else if(e.target.id === 'bscript') b.script = e.target.value;
      else return;
      clearTimeout(el._t);
      el._t = setTimeout(save, 500);
    });

    /* the two pickers save at once — there is nothing to debounce */
    el.addEventListener('change', async e => {
      if(e.target.id === 'bsetup'){ b.setup = e.target.value; return save(); }
      if(e.target.id === 'bsrc'){ b.sourceId = e.target.value || null; return save(); }
    });

    el.addEventListener('click', async e => {
      /* the job this beat does in the episode */
      const f = e.target.closest('[data-fn]');
      if(f){
        const picked = f.dataset.fn;
        b.fn = b.fn === picked ? null : picked;
        if(b.fn && !(b.purpose || '').trim()){
          const def = Story.fn(b.fn);
          if(def) b.purpose = def.d;
        }
        await save();
        render();
        /* choosing one is the end of the job, so fold it away again */
        const fold = el.querySelector('details.nu-fold');
        if(fold && b.fn) fold.open = false;
        return;
      }

      const sh = e.target.closest('[data-shot]');
      if(sh && !e.target.closest('[data-editshot]')){
        const s = b.shots.find(x => x.id === sh.dataset.shot);
        s.done = !s.done; await save(); return render();
      }
      const es = e.target.closest('[data-editshot]');
      if(es) return editShot(b.shots.find(x => x.id === es.dataset.editshot));

      const a = e.target.closest('[data-a]');
      if(!a) return;

      if(a.dataset.a === 'addshot') return editShot(null);
      /* break this action into its shots (Creator Studio 3) */
      if(a.dataset.a === 'suggestshots')
        return ShotAI.forBeat(v.id, b.id, async () => { await load(); render(); params.onChange && params.onChange(); });

      if(a.dataset.a === 'rename'){
        App.sheet(`<h2>Rename beat</h2>
          <div class="field"><label for="bt">Title</label>
            <input id="bt" type="text" value="${b.title.replace(/"/g,'&quot;')}"></div>
          <div class="sheetcta"><button class="btn-primary" data-save>Save</button>
            <button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-save]')) return;
            const t = sheetEl.querySelector('#bt').value.trim();
            if(!t) return U.toast('Give it a title');
            b.title = t; await save(); App.closeSheet(); render();
          });
        });
        return;
      }

      if(a.dataset.a === 'sched'){
        const today = await Data.currentDay();
        const field = await U.dayField('bd', b.day ?? today);
        App.sheet(`<h2>Schedule this beat</h2>
          ${field}
          <div class="field"><label for="ba">Time</label>
            <input id="ba" type="time" value="${b.at || ''}"></div>
          <div class="sheetcta"><button class="btn-primary" data-save>Schedule</button>
            <button class="btn-ghost" data-clear>Unschedule</button></div>`, sheetEl => {
          U.wireDayField(sheetEl, 'bd');
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-clear]')){ b.day = null; b.at = null; await save(); App.closeSheet(); return render(); }
            if(!ev.target.closest('[data-save]')) return;
            const n = await U.readDayField(sheetEl, 'bd');
            if(!n) return U.toast('Pick a date');
            b.day = n;
            b.at = sheetEl.querySelector('#ba').value || null;
            await save(); App.closeSheet(); render();
          });
        });
        return;
      }

      if(a.dataset.a === 'makeclip'){
        /* one thing, not two: the clip starts as everything the beat already is */
        let channel = '';
        try {
          const sr = (await Data.series()).find(x => x.id === v.seriesId);
          channel = (sr && sr.channel) || '';
        } catch(err){ channel = ''; }

        const c = await Data.saveClip({
          title: b.title,
          plat:'youtube',
          stage: b.done ? 'shot' : (b.day != null ? 'planned' : 'idea'),
          seriesId: v.seriesId || null,
          channel,
          shots: (b.shots || []).map(sh => sh.text || sh.name || String(sh)).filter(Boolean),
          hook: b.purpose || '',
          dur:'0:00',
          plan: { script: b.script || '' }
        });
        b.clipId = c.id;
        /* a beat that was sent to the task list before it had a clip still needs
           the two joined, or ticking the task off moves nothing */
        if(b.taskId){
          try {
            const map = await Store.allMap('tasks');
            const t = map[b.taskId];
            if(t && !t.clipId){ t.clipId = c.id; await Store.put('tasks', t); Data.invalidate('tasks'); }
          } catch(err){ console.warn('Could not join the task to the clip', err); }
        }
        await save();
        clips = await Data.clips();
        render();
        return Screens.push('clip', { id:c.id,
          onChange:async () => { clips = await Data.clips(); render(); } });
      }
      if(a.dataset.a === 'linkclip'){
        App.sheet(`<h2>Link a clip</h2>
          <div class="group compact" style="margin:0">
            ${clips.map(c => `<button class="row" data-c="${c.id}">
              <span class="lbl">${c.title}<small>${c.state} · ${c.dur}</small></span>${ICON.chevR}</button>`).join('')
              || '<div class="empty" style="padding:26px 8px"><b>No clips yet</b>Create one instead.</div>'}
          </div>
          <div class="sheetcta"><button class="btn-ghost" data-cancel style="flex:1">Cancel</button></div>`,
        sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            const c = ev.target.closest('[data-c]');
            if(!c) return;
            b.clipId = c.dataset.c; await save(); App.closeSheet(); render();
          });
        });
        return;
      }
      if(a.dataset.a === 'unlink'){ b.clipId = null; await save(); return render(); }
      if(a.dataset.a === 'openclip'){
        /* The old order pushed the clips list and then popped twice, which closed
           the very thing it had just opened. Go to the clip itself, and leave the
           beat on the stack so backing out returns here. */
        if(!b.clipId) return;
        return Screens.push('clip', { id:b.clipId,
          onChange:async () => { clips = await Data.clips(); render(); } });
      }

      if(a.dataset.a === 'delete'){
        act.beats = act.beats.filter(x => x.id !== b.id);
        await save(); Screens.pop();
      }
    });

    await load();
    render();
  }

  Screens.register('vlog-builder', mountList);
  Screens.register('vlog-new', mountNew);
  Screens.register('vlog', mountTimeline);
  Screens.register('vlog-beat', mountBeat);
})();
