/* Program — where recurring, goal-oriented work lives.

   A plan here is a rule that gets harder on a schedule. Saving one writes
   ordinary dated tasks, so Today, the streak and the timeline never need to
   know a plan exists. Editing rewrites the future only: anything already done
   or skipped is history and stays put. */
(function(){

  const { DOW, DOW_N } = U;     /* shared, so the series and the vlog get the same grid */
  const MODE_LABEL = {
    none:{ t:'None', s:'stays the same' },
    gradual:{ t:'Gradual', s:'+1 day / step' },
    aggressive:{ t:'Aggressive', s:'+2 days / step' }
  };
  const PRI_LABEL = {
    low:{ t:'Low', s:'easy win' },
    med:{ t:'Medium', s:'normal' },
    high:{ t:'High', s:'the hard one' }
  };
  const AMT_LABEL = {
    none:{ t:'None', s:'stays the same' },
    gradual:{ t:'Gradual', s:'+10% / step' },
    aggressive:{ t:'Aggressive', s:'+20% / step' }
  };

  const uid = () => 'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  let el, plans = [], tasks = [], today = 1, weekTop = 0, open = new Set(), showEnded = false;

  /* ---------- data ---------- */

  async function load(){
    try { plans = Object.values(await Store.allMap('plans')); } catch(e){ plans = []; }
    try { tasks = Object.values(await Store.allMap('tasks')); } catch(e){ tasks = []; }
    try { today = await Data.currentDay(); } catch(e){ today = 1; }
    weekTop = Math.floor((today - 1) / 7);
  }

  /* Program day -> weekday. Everything in the engine hangs off this. */
  let dowOf = d => ((d - 1) % 7 + 7) % 7;
  async function calibrate(){
    try {
      const anchor = new Date(await Data.dayToDate(today));
      const base = anchor.getDay();
      dowOf = d => ((base + (d - today)) % 7 + 7) % 7;
    } catch(e){ /* keep the fallback */ }
  }

  /* ---------- the week strip ---------- */

  function weekStrip(){
    const first = weekTop * 7 + 1;
    const cells = [];
    for(let i = 0; i < 7; i++){
      const day = first + i;
      const running = plans.filter(p => !p.ended &&
        Program.expand(p, { dowOf, horizon: day }).some(e => e.day === day)).length;
      cells.push(`
        <div class="pgday${day === today ? ' now' : ''}">
          <span class="d">${day}</span>
          ${running ? `<span class="dot">${running}</span>` : '<span class="dot none">—</span>'}
        </div>`);
    }
    return `
      <section class="pgweek">
        <header>
          <h2>Week ${weekTop + 1}</h2>
          <div class="nav">
            <button class="btn-sm" data-wk="-1" ${weekTop ? '' : 'disabled'}>${U.ICON.chevL}</button>
            <button class="btn-sm" data-wk="1">${U.ICON.chevR}</button>
          </div>
        </header>
        <div class="pgdows">${DOW.map(d => `<span>${d}</span>`).join('')}</div>
        <div class="pgdays">${cells.join('')}</div>
      </section>`;
  }

  /* ---------- a plan row ---------- */

  function planRow(p){
    const wk = Math.max(0, weekTop - Math.floor((p.startDay - 1) / 7));
    const days = Program.daysForWeek(p, wk);
    const amt = Program.amountForWeek(p, wk);
    const isOpen = open.has(p.id);

    return `
      <article class="pgplan${p.ended ? ' ended' : ''}" data-plan="${p.id}">
        <div class="top">
          <div class="who">
            <h3>${p.title || 'Untitled'}</h3>
            <p class="freq">${U.ICON.repeat}${Program.freqLabel(days.length)}${
              amt ? ' · ' + Program.amountLabel(amt) : ''} · ${
              (PRI_LABEL[p.pri || 'med'] || PRI_LABEL.med).t}${p.ended ? ' · ended' : ''}</p>
          </div>
          <div class="acts">
            ${p.ended
              ? `<button class="btn-sm accent" data-a="resume">Resume</button>`
              : `<button class="btn-sm" data-a="edit" aria-label="Edit ${p.title}">${U.ICON.pencil}</button>`}
            <button class="btn-sm" data-a="del" aria-label="Remove ${p.title}">${U.ICON.trash}</button>
          </div>
        </div>
        ${isOpen ? `<div class="pgstrip"><div class="pgstripin">${
          Program.preview(p).map((r, i) => `
            <div class="pgwk${i === wk ? ' now' : ''}">
              <b>Week ${i + 1}</b>
              <span class="v">${r.amount ? Program.amountLabel(r.amount) : '—'}</span>
              <span class="f">${r.freq}</span>
            </div>`).join('')}</div></div>` : ''}
        ${window.SwipeRefs ? ((p.swipeIds || []).length
          ? `<div class="pg-refs"><p class="pg-refh">How to do it</p><div data-refslot="${p.id}"></div></div>`
          : `<button class="pgtoggle" data-refadd="${p.id}" style="margin-top:4px">+ Link a video for how to do it</button>`) : ''}
        <button class="pgtoggle" data-a="toggle">${
          isOpen ? 'Hide plan preview' : 'Plan preview'} ${U.ICON.chevD}</button>
      </article>`;
  }

  /* The videos a plan points at — the routine you follow, the form you copy.
     Each plan's strip fills in after the list draws. */
  function fillRefs(){
    if(!window.SwipeRefs || !el) return;
    el.querySelectorAll('[data-refslot]').forEach(slot => {
      const p = plans.find(x => x.id === slot.dataset.refslot);
      if(p) SwipeRefs.fill(slot, { own:p.swipeIds || [] });
    });
  }
  async function saveRefs(p, ids){
    p.swipeIds = ids;
    await Store.put('plans', p);
    render();
  }

  function render(){
    const running = plans.filter(p => !p.ended);
    const ended = plans.filter(p => p.ended);
    const live = running.length;
    el.innerHTML =
      Screens.bar({ kicker:'Creator studio', title:'Program' }) + `
      <style>
        /* squared off and shadowed, like every other card in the app */
        .pgweek{background:var(--surface-2);border:1px solid #2B2822;border-radius:var(--r);
          padding:14px;margin:0 0 18px;box-shadow:5px 5px 0 var(--shadow)}
        .pgweek header{display:flex;align-items:center;margin:0 0 12px}
        .pgweek h2{font-family:var(--display),sans-serif;font-weight:900;font-size:20px;margin:0}
        .pgweek .nav{margin-left:auto;display:flex;gap:6px}
        .pgweek .nav .btn-sm{padding:6px 9px}
        .pgweek .nav svg{width:13px;height:13px;display:block}
        .pgdows,.pgdays{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
        .pgdows span{font-family:var(--display),sans-serif;font-weight:900;font-size:10.5px;
          letter-spacing:.1em;color:var(--orange);text-align:center;padding:0 0 7px}
        .pgday{background:var(--surface-1);border:1px solid #33302A;border-radius:var(--r);
          padding:9px 0 7px;text-align:center}
        .pgday.now{background:var(--orange);border-color:var(--orange)}
        .pgday .d{display:block;font-family:var(--display),sans-serif;font-weight:900;font-size:15px}
        .pgday.now .d{color:#151515}
        .pgday .dot{display:block;font-size:10.5px;color:var(--muted);margin:3px 0 0}
        .pgday .dot.none{color:var(--dim)}
        .pgday.now .dot{color:rgba(21,21,21,.75)}

        .pgplan{background:var(--surface-2);border:1px solid #2B2822;border-radius:var(--r);
          padding:14px;margin:0 0 12px}
        .pgplan.ended{opacity:.55}
        .pgplan .top{display:flex;gap:12px;align-items:flex-start}
        .pgplan h3{font-family:var(--display),sans-serif;font-weight:900;font-size:18px;margin:0 0 5px}
        .pgplan .freq{margin:0;font-size:13.5px;color:var(--orange);display:flex;align-items:center;gap:6px}
        .pgplan .freq svg{width:14px;height:14px;flex:0 0 14px}
        .pgplan .acts{margin-left:auto;display:flex;gap:6px}
        .pgplan .acts .btn-sm{padding:8px 10px}
        .pgplan .acts svg{width:15px;height:15px;display:block}
        .pgtoggle{width:100%;background:none;border:0;color:var(--muted);cursor:pointer;
          font-family:inherit;font-size:13.5px;padding:12px 0 2px;display:flex;
          align-items:center;justify-content:center;gap:6px}
        .pgtoggle svg{width:13px;height:13px}

        /* the run, week by week — scrolls inside the card, never past it */
        .pgstrip{overflow:hidden;margin:14px 0 0}
        .pgstripin{display:flex;gap:8px;overflow-x:auto;padding:0 0 4px;
          scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch}
        .pgstripin::-webkit-scrollbar{display:none;width:0;height:0}
        .pgwk{flex:0 0 108px;background:var(--surface-1);border:1px solid #33302A;
          border-radius:var(--r);padding:10px 11px}
        .pgwk.now{background:var(--orange);border-color:var(--orange)}
        .pgwk b{display:block;font-family:var(--display),sans-serif;font-weight:900;font-size:12.5px;
          padding:0 0 8px;border-bottom:1px solid #3A362F}
        .pgwk.now b{color:#151515;border-bottom-color:rgba(21,21,21,.3)}
        .pgwk .v{display:block;font-family:var(--display),sans-serif;font-weight:900;font-size:19px;
          margin:9px 0 2px}
        .pgwk.now .v,.pgwk.now .f{color:#151515}
        .pgwk .f{display:block;font-size:12px;color:var(--muted)}
        .pgfoot{margin:16px 0 0;font-size:13px;color:var(--dim);line-height:1.55}
      </style>
      <div class="view">
        ${weekStrip()}
        <div class="sechead">
          <h2>Plans</h2>
          <button class="btn-sm accent" data-a="add">Add plan +</button>
        </div>
        ${running.length
          ? running.map(planRow).join('')
          : `<div class="empty"><b>No plans running</b>
              A plan is recurring work that gets harder — a workout, cold showers,
              a weekly challenge. Add one and it writes itself onto your days.</div>`}
        ${live ? `<p class="pgfoot">${live} plan${live === 1 ? '' : 's'} writing tasks onto your days.
          Editing a plan only ever changes days you have not reached yet.</p>` : ''}
        ${ended.length ? `
          <button class="pgtoggle" data-a="showended" style="margin:18px 0 0">
            ${showEnded ? 'Hide' : 'Show'} ${ended.length} ended
            plan${ended.length === 1 ? '' : 's'} ${U.ICON.chevD}</button>
          ${showEnded ? ended.map(planRow).join('') : ''}` : ''}
      </div>
      <style>
        .pg-refs{margin:10px 0 2px}
        .pg-refh{margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
          color:var(--muted)}
        .pg-refs .swr-card{flex-basis:112px}
      </style>`;
    fillRefs();
  }

  /* ---------- the editor ---------- */

  /* The editor is deliberately mostly buttons. Every choice is a tap target you
     can hit with a thumb, the selected one is coloured, and the explanation is
     the subtitle inside the button rather than a paragraph above it. */
  function editor(plan, isNew){
    const p = JSON.parse(JSON.stringify(plan));
    if(!p.freqRamp) p.freqRamp = { mode:'none', everyWeeks:3, max:p.days.length };
    if(!p.amountRamp) p.amountRamp = { mode:'none', everyWeeks:3, max:null };
    if(!p.pri) p.pri = 'med';

    const seg = (attr, map, cur) => `<div class="pgseg">${Object.keys(map).map(k =>
      `<button type="button" ${attr}="${k}" aria-pressed="${cur === k}">
        <b>${map[k].t}</b><small>${map[k].s}</small></button>`).join('')}</div>`;

    const stepper = (id, value, suffix) => `
      <div class="pgstep">
        <button type="button" class="bump" data-step="${id}:-1">&minus;</button>
        <span class="val"><b id="${id}">${value}</b>${suffix ? `<i>${suffix}</i>` : ''}</span>
        <button type="button" class="bump" data-step="${id}:1">+</button>
      </div>`;

    App.sheet(`

      <h2 style="margin:0 0 14px">${isNew ? 'New plan' : p.title || 'Edit plan'}</h2>
      <input id="pg-title" class="pgname" type="text" value="${p.title || ''}"
        placeholder="Cold shower" autocomplete="off">
      <p class="pgerr" id="pg-err" hidden>Give it a name.</p>

      <h3 class="pgh">Which days?</h3>
      ${U.dayGrid(p.days)}

      <h3 class="pgh">How much each time?</h3>
      <div id="pg-amtwrap">
        ${stepper('pg-amt', p.amount ? p.amount.value : 0, '')}
        <select id="pg-unit" class="pgbar" style="margin:8px 0 0">
          <option value="__none" ${!p.amount ? 'selected' : ''}>Just tick it — no amount</option>
          <option value="" ${p.amount && !p.amount.unit ? 'selected' : ''}>a number, no unit</option>
          ${TaskLib.UNITS.map(u =>
            `<option value="${u}" ${p.amount && p.amount.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </div>

      <h3 class="pgh">How hard?</h3>
      ${seg('data-pri', PRI_LABEL, p.pri)}

      <h3 class="pgh">Do more over time?</h3>
      ${seg('data-freq', MODE_LABEL, p.freqRamp.mode)}

      <div id="pg-fcap" class="${p.freqRamp.mode === 'none' ? 'pgoff' : ''}">
        <h3 class="pgh">At most, how often?</h3>
        ${stepper('pg-fmax', Math.max(p.days.length, p.freqRamp.max || p.days.length), 'days / week')}
      </div>

      <h3 class="pgh">Go harder over time?</h3>
      ${seg('data-amt', AMT_LABEL, p.amountRamp.mode)}

      <div id="pg-acap" class="${p.amountRamp.mode === 'none' || !p.amount ? 'pgoff' : ''}">
        <h3 class="pgh">Up to how much?</h3>
        ${stepper('pg-amax', p.amountRamp.max != null ? p.amountRamp.max : (p.amount ? p.amount.value : 0), '')}
      </div>

      <h3 class="pgh">How long?</h3>
      <select id="pg-weeks" class="pgbar">
        ${[4,6,8,10,12,26].map(n =>
          `<option value="${n}" ${p.weeks === n ? 'selected' : ''}>${n} weeks</option>`).join('')}
        <option value="date" ${p.untilDate ? 'selected' : ''}>Until a date I pick</option>
        <option value="0" ${!p.weeks ? 'selected' : ''}>Until I end it</option>
      </select>
      <div id="pg-len"></div>

      <div class="sheetcta">
        <button class="btn-primary" data-go>Preview the run</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheet => {

      const $ = s => sheet.querySelector(s);
      /* null means "just tick it"; '' means a bare number with no unit */
      let unit = p.amount ? p.amount.unit : null;
      let lenMode = p.weeks > 0 ? 'weeks' : 'open';

      const num = id => +($(`#${id}`) || {}).textContent || 0;
      const setNum = (id, v) => { const n = $(`#${id}`); if(n) n.textContent = v; };

      function fade(){
        $('#pg-fcap').className = $('[data-freq][aria-pressed="true"]').dataset.freq === 'none' ? 'pgoff' : '';
        const amtOff = $('[data-amt][aria-pressed="true"]').dataset.amt === 'none' || unit === null;
        $('#pg-acap').className = amtOff ? 'pgoff' : '';
        /* nothing to count means nothing to bump */
        $('#pg-amtwrap').querySelector('.pgstep').className = unit === null ? 'pgstep pgoff' : 'pgstep';
      }

      $('#pg-weeks').addEventListener('change', ev => {
        const v = ev.target.value;
        lenMode = v === 'date' ? 'date' : v === '0' ? 'open' : 'weeks';
        if(lenMode === 'weeks') p.weeks = +v;
        lenField();
      });

      $('#pg-unit').addEventListener('change', ev => {
        unit = ev.target.value === '__none' ? null : ev.target.value;
        if(unit !== null && num('pg-amt') === 0) setNum('pg-amt', 1);
        fade();
      });

      function press(b, attr){
        sheet.querySelectorAll('[' + attr + ']').forEach(x =>
          x.setAttribute('aria-pressed', String(x === b)));
      }

      function lenField(){
        $('#pg-len').innerHTML = lenMode === 'date'
          ? `<div class="pgdatewrap">
               <input id="pg-until" class="pgbar pgdate" type="date" value="${p.untilDate || ''}"
                 min="${new Date().toISOString().slice(0,10)}">
             </div>` : '';
        const d = $('#pg-until');
        if(!d) return;
        /* tapping anywhere on the bar opens the picker, not just the little icon */
        d.addEventListener('click', () => { if(d.showPicker) try { d.showPicker(); } catch(err){} });
        d.addEventListener('change', () => { p.untilDate = d.value || null; });
      }

      fade(); lenField();

      sheet.addEventListener('click', e => {
        const bump = e.target.closest('[data-step]');
        if(bump){
          const [id, delta] = bump.dataset.step.split(':');
          const step = id === 'pg-amt' || id === 'pg-amax' ? (num(id) >= 10 ? 1 : 0.5) : 1;
          let v = Math.round((num(id) + step * +delta) * 10) / 10;
          if(id === 'pg-fmax') v = Math.min(7, Math.max(p.days.length, v));
          else v = Math.max(0, v);
          setNum(id, v);
          return fade();
        }

        const dow = e.target.closest('[data-dow]');
        if(dow){
          const n = +dow.dataset.dow;
          p.days = p.days.includes(n) ? p.days.filter(x => x !== n) : p.days.concat(n);
          p.days.sort((a,b) => a - b);
          dow.setAttribute('aria-pressed', String(p.days.includes(n)));
          if(num('pg-fmax') < p.days.length) setNum('pg-fmax', p.days.length);
          return;
        }

        const pr = e.target.closest('[data-pri]');
        if(pr){ press(pr, 'data-pri'); p.pri = pr.dataset.pri; return; }

        const f = e.target.closest('[data-freq]');
        if(f){ press(f, 'data-freq'); p.freqRamp.mode = f.dataset.freq; return fade(); }

        const a = e.target.closest('[data-amt]');
        if(a){ press(a, 'data-amt'); p.amountRamp.mode = a.dataset.amt; return fade(); }

        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-go]')) return;

        p.title = $('#pg-title').value.trim();
        if(!p.title){ $('#pg-err').hidden = false; return; }
        if(!p.days.length) return;

        p.amount = unit === null || num('pg-amt') <= 0 ? null
          : { value: num('pg-amt'), unit: unit || '' };
        p.freqRamp.max = Math.min(7, Math.max(p.days.length, num('pg-fmax')));
        p.amountRamp.max = p.amount && num('pg-amax') > 0 ? num('pg-amax') : null;

        if(lenMode === 'open'){ p.weeks = 0; p.untilDate = null; }
        else if(lenMode === 'date'){
          const until = $('#pg-until') && $('#pg-until').value;
          p.untilDate = until || null;
          p.weeks = until ? weeksUntil(until) : 0;
        } else { p.weeks = p.weeks > 0 ? p.weeks : 10; p.untilDate = null; }

        if(isNew){ p.id = uid(); p.startDay = today; }
        App.closeSheet();
        setTimeout(() => confirmRun(p, isNew), 60);
      });

      /* the sheet may already have been replaced by the preview step */
      setTimeout(() => { const f2 = $('#pg-title'); if(f2) f2.focus(); }, 180);
    });
  }

  function weeksUntil(iso){
    const end = new Date(iso + 'T00:00:00');
    const days = Math.ceil((end - new Date().setHours(0,0,0,0)) / 864e5);
    return Math.max(1, Math.ceil(days / 7));
  }

  /* ---------- preview, then commit ---------- */

  /* The run laid out as a calendar: a row per week, a cell per day, each cell
     carrying what that day is worth once the ramps are applied. Tapping a future
     day adds or drops it, which is stored on the plan itself rather than by
     editing the generated tasks, so the rule stays the source of truth.

     An open-ended plan has no last week to draw, so it shows ten. */
  const OPEN_PREVIEW_WEEKS = 10;

  function confirmRun(p, isNew){
    const weeks = p.weeks > 0 ? p.weeks : OPEN_PREVIEW_WEEKS;
    let todayTs = Date.now();

    /* the real date behind a program day */
    const dateOf = d => new Date(todayTs + (d - today) * 864e5);
    const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYNAME = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    function grid(){
      const on = new Set(Program.expand(p, { dowOf, horizon: p.startDay + weeks * 7 }).map(e => e.day));
      const heads = Array.from({ length:7 }, (_, i) => DAYNAME[dowOf(p.startDay + i)]);

      let html = `<div class="pgcal">
        <div class="pgcalhead"><span></span>${heads.map(h => `<span>${h}</span>`).join('')}</div>`;

      for(let wk = 0; wk < weeks; wk++){
        const amount = Program.amountForWeek(p, wk);
        const first = dateOf(p.startDay + wk * 7);
        html += `<div class="pgcalrow">
          <span class="wk"><b>W${wk + 1}</b><i>${MON[first.getMonth()]}</i></span>`;
        for(let i = 0; i < 7; i++){
          const day = p.startDay + wk * 7 + i;
          const d = dateOf(day);
          const past = day < today;
          const isToday = day === today;
          const lit = on.has(day);
          html += `<button type="button" class="pgcell${lit ? ' on' : ' off'}${
            past ? ' past' : ''}${isToday ? ' now' : ''}"
            ${past ? 'disabled' : ''} data-day="${day}">
            <span class="n">${d.getDate()}</span>
            ${lit ? `<span class="v">${amount ? Program.amountLabel(amount) : '\u2713'}</span>`
                  : '<span class="dot">\u00b7</span>'}
          </button>`;
        }
        html += '</div>';
      }
      return html + '</div>';
    }

    function summary(){
      const plan = Program.diff(p, tasks, today, { dowOf, horizon: today + 364 });
      return `${plan.create.length} to add${
        plan.remove.length ? ' · ' + plan.remove.length + ' to clear' : ''}${
        plan.kept ? ' · ' + plan.kept + ' already logged, untouched' : ''}`;
    }

    App.sheet(`
      <style>
        .pghead{display:flex;align-items:center;gap:12px;background:var(--surface-2);
          border:1px solid #2B2822;border-radius:var(--r);padding:13px;margin:0 0 16px}
        .pghead h3{font-family:var(--display),sans-serif;font-weight:900;font-size:19px;margin:0 0 4px}
        .pghead p{margin:0;color:var(--orange);font-size:13.5px}
        .pgsub{margin:0 0 4px;font-family:var(--display),sans-serif;font-weight:900;font-size:19px}
        .pgtap{margin:0 0 14px;color:var(--muted);font-size:13.5px}

        .pgcal{max-height:48vh;overflow:auto;scrollbar-width:none}
        .pgcal::-webkit-scrollbar{display:none;width:0;height:0}
        .pgcalhead,.pgcalrow{display:grid;grid-template-columns:42px repeat(7,1fr);gap:5px;
          align-items:stretch}
        .pgcalhead{position:sticky;top:0;background:var(--bg);z-index:1;padding:0 0 6px}
        .pgcalhead span{text-align:center;font-family:var(--display),sans-serif;font-weight:900;
          font-size:10.5px;letter-spacing:.08em;color:var(--muted)}
        .pgcalrow{margin:0 0 5px}
        .pgcalrow .wk{display:flex;flex-direction:column;justify-content:center}
        .pgcalrow .wk b{font-family:var(--display),sans-serif;font-weight:900;font-size:12.5px;
          color:var(--cream)}
        .pgcalrow .wk i{font-style:normal;font-size:10.5px;color:var(--dim)}

        .pgcell{position:relative;min-height:52px;border-radius:var(--r);cursor:pointer;
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
          font-family:inherit}
        .pgcell.on{background:var(--surface-1);border:1px solid #3B372F}
        .pgcell.off{background:none;border:1px dashed #33302A}
        .pgcell.now{border-color:var(--orange);border-style:solid;background:rgba(251,105,0,.13)}
        .pgcell.past{opacity:.35;cursor:default}
        .pgcell .n{font-size:10.5px;color:var(--muted);line-height:1}
        .pgcell.on .n{color:var(--dim)}
        .pgcell .v{font-family:var(--display),sans-serif;font-weight:900;font-size:13px;
          color:var(--cream);line-height:1}
        .pgcell.now .v{color:var(--orange)}
        .pgcell .dot{color:var(--dim);font-size:15px;line-height:1}
        .pgcount{margin:12px 0 0;font-size:13px;color:var(--dim)}
      </style>

      <h2 style="margin:0 0 14px">Preview the run</h2>
      <div class="pghead">
        <div style="flex:1">
          <h3>${p.title}</h3>
          <p>${Program.freqLabel(p.days.length)}${
            p.amount ? ' · ' + Program.amountLabel(p.amount) : ''}</p>
        </div>
      </div>

      <p class="pgsub">Your ${weeks}-week ${p.weeks > 0 ? 'program' : 'view'}</p>
      <p class="pgtap">${p.weeks > 0
        ? 'Tap any future date to add or remove this task for that day.'
        : 'This plan runs until you end it — the first ten weeks are shown.'}</p>

      <div id="pg-grid">${grid()}</div>
      <p class="pgcount" id="pg-count">${summary()}</p>

      <div class="sheetcta">
        <button class="btn-primary" data-save>Save changes</button>
        <button class="btn-ghost" data-back>Back</button>
      </div>`, sheet => {

      const redraw = () => {
        sheet.querySelector('#pg-grid').innerHTML = grid();
        sheet.querySelector('#pg-count').textContent = summary();
      };

      sheet.addEventListener('click', async e => {
        const cell = e.target.closest('[data-day]');
        if(cell && !cell.disabled){
          const day = +cell.dataset.day;
          const lit = cell.classList.contains('on');
          p.add = (p.add || []).filter(x => x !== day);
          p.skip = (p.skip || []).filter(x => x !== day);
          /* a day the rule already covers is switched off; any other is switched on */
          if(lit) p.skip.push(day); else p.add.push(day);
          return redraw();
        }
        if(e.target.closest('[data-back]')){ App.closeSheet(); return setTimeout(() => editor(p, isNew), 60); }
        if(!e.target.closest('[data-save]')) return;
        const plan = Program.diff(p, tasks, today, { dowOf, horizon: today + 364 });
        await commit(p, plan);
        App.closeSheet();
      });
    });

    /* the calendar needs real dates; fetch once and redraw if it differs */
    Promise.resolve(Data.dayToDate(today)).then(ts => {
      if(!ts || ts === todayTs) return;
      todayTs = ts;
      const g = document.querySelector('#pg-grid');
      if(g) g.innerHTML = grid();
    }).catch(() => {});
  }

  async function commit(p, plan){

    for(const id of plan.remove){
      await Store.del('tasks', id);
      tasks = tasks.filter(t => t.id !== id);
    }
    for(const u of plan.update){
      const t = tasks.find(x => x.id === u.id);
      if(!t) continue;
      t.cad = u.cad; t.prog = u.prog;
      await Store.put('tasks', t);
    }
    for(const c of plan.create){
      const t = { id: U.taskId(), day: c.day, title: c.title, cad: c.cad, prog: c.prog,
                  planId: c.planId, pri: p.pri || 'med', at:null, mins:0, subs:[], view:'todo' };
      tasks.push(t);
      await Store.put('tasks', t);
    }
    /* difficulty is a property of the plan, so days already written follow it */
    for(const t of tasks){
      if(t.planId !== p.id || t.day < today || t.view !== 'todo') continue;
      if(t.pri === (p.pri || 'med')) continue;
      t.pri = p.pri || 'med';
      await Store.put('tasks', t);
    }

    await Store.put('plans', p);
    if(!plans.some(x => x.id === p.id)) plans.push(p);
    else plans = plans.map(x => x.id === p.id ? p : x);

    Data.invalidate('tasks');
    U.toast(`${p.title} — ${plan.create.length} day${plan.create.length === 1 ? '' : 's'} added`);
    render();
  }

  /* Two different intentions behind one bin icon. Ending keeps the record and
     the days you actually did; deleting takes the plan away entirely. Neither
     touches a day already done or skipped. */
  function confirmRemove(p){
    const future = tasks.filter(t => t.planId === p.id && t.day >= today && t.view === 'todo').length;
    const past = tasks.filter(t => t.planId === p.id && (t.view === 'done' || t.view === 'skipped')).length;

    App.sheet(`
      <h2>${p.title}</h2>
      <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.6">
        ${future ? future + ' upcoming day' + (future === 1 ? '' : 's') + ' would be cleared. ' : ''}
        ${past ? past + ' day' + (past === 1 ? '' : 's') + ' you already did stay on the record either way.'
               : 'Nothing has been ticked off yet.'}</p>
      <div class="sheetcta">
        ${p.ended ? '' : `<button class="btn-primary" data-end>Stop it, keep the record</button>`}
        <button class="btn-ghost" data-del style="color:var(--red)">Delete the plan</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheet => {
      sheet.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(e.target.closest('[data-end]')){ App.closeSheet(); return endPlan(p); }
        if(!e.target.closest('[data-del]')) return;
        App.closeSheet();
        await deletePlan(p);
      });
    });
  }

  async function endPlan(p){
    const stopped = Object.assign({}, p, { ended:true });
    const plan = Program.diff(stopped, tasks, today, { dowOf, horizon: today + 364 });
    await commit(stopped, plan);
    U.toast(p.title + ' stopped');
  }

  async function resumePlan(p){
    const live = Object.assign({}, p, { ended:false });
    const plan = Program.diff(live, tasks, today, { dowOf, horizon: today + 364 });
    await commit(live, plan);
    U.toast(p.title + ' running again');
  }

  /* Deleting clears what has not happened and lets go of the rest: the days you
     did stay as ordinary tasks rather than pointing at a plan that is gone. */
  async function deletePlan(p){
    const stopped = Object.assign({}, p, { ended:true });
    const plan = Program.diff(stopped, tasks, today, { dowOf, horizon: today + 364 });

    for(const id of plan.remove){
      await Store.del('tasks', id);
      tasks = tasks.filter(t => t.id !== id);
    }
    for(const t of tasks){
      if(t.planId !== p.id) continue;
      delete t.planId;
      await Store.put('tasks', t);
    }
    await Store.del('plans', p.id);
    plans = plans.filter(x => x.id !== p.id);
    open.delete(p.id);

    Data.invalidate('tasks');
    U.toast(p.title + ' deleted');
    render();
  }

  /* ---------- wiring ---------- */

  async function mount(host){
    el = host;
    /* Do not touch className here. A pushed screen arrives with class
       "screen in", which is what positions it and slides it over the tab bar —
       overwriting it with "view" left this screen stuck at the top of the
       stack with no height. The inner .view below is the scrolling body. */
    await load();
    await calibrate();
    render();

    if(el.dataset.wiredProgram) return;
    el.dataset.wiredProgram = '1';

    el.addEventListener('click', async e => {
      const wk = e.target.closest('[data-wk]');
      if(wk && wk.dataset.wk){ weekTop = Math.max(0, weekTop + +wk.dataset.wk); return render(); }

      if(e.target.closest('[data-a="add"]')) return editor(Program.blank(), true);
      if(e.target.closest('[data-a="showended"]')){ showEnded = !showEnded; return render(); }

      const row = e.target.closest('[data-plan]');
      if(!row) return;
      const p = plans.find(x => x.id === row.dataset.plan);
      if(!p) return;

      /* the plan's videos: open one, unlink one, or link another */
      const ro = e.target.closest('[data-swr-open]');
      if(ro) return Screens.push('swipe', { id:ro.dataset.swrOpen, onChange:render });
      const rr = e.target.closest('[data-swr-rm]');
      if(rr) return saveRefs(p, (p.swipeIds || []).filter(x => x !== rr.dataset.swrRm));
      if(e.target.closest('[data-swr-add]') || e.target.closest('[data-refadd]'))
        return SwipeRefs.pick(p.swipeIds || [], sid => {
          saveRefs(p, (p.swipeIds || []).concat(sid));
          U.toast('Linked — it shows on every task from this plan');
        });

      const act = e.target.closest('[data-a]');
      if(!act) return;
      if(act.dataset.a === 'toggle'){
        open.has(p.id) ? open.delete(p.id) : open.add(p.id);
        return render();
      }
      if(act.dataset.a === 'edit') return editor(p, false);
      if(act.dataset.a === 'resume') return resumePlan(p);
      if(act.dataset.a === 'del') return confirmRemove(p);
    });
  }

  Screens.register('program', mount);
})();
