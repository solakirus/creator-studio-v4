/* Day sheet — everything happening today, written out to read before you start. */
(function(){
  const { ICON, pad } = U;

  const BLOCKS = [
    { n:'Early',          from:3,  to:5  },
    { n:'Morning',        from:6,  to:8  },
    { n:'Midday',         from:9,  to:11 },
    { n:'Afternoon',      from:12, to:14 },
    { n:'Late afternoon', from:15, to:17 },
    { n:'Evening',        from:18, to:20 },
    { n:'Night',          from:21, to:23 }
  ];
  function fmtTime(hhmm){
    if(!hhmm) return null;
    const [h,m] = hhmm.split(':').map(Number);
    const ap = h >= 12 ? 'P' : 'A', hr = h % 12 === 0 ? 12 : h % 12;
    return m ? `${hr}:${String(m).padStart(2,'0')}${ap}` : `${hr}${ap}`;
  }
  const blockOf = at => {
    if(!at) return null;
    const h = +at.split(':')[0];
    return BLOCKS.find(b => h >= b.from && h <= b.to) || null;
  };

  async function mount(el, params){
    let day = params.day, date = null, items = [], lib = [], kit = [], dayLbl = '';

    async function load(){
      if(day == null) day = await Data.currentDay();
      date = await Data.dayToDate(day);
      /* one place names a day, so prep days read the same here, on the profile
         and on the shot list */
      dayLbl = await Data.dayLabel(day);
      lib = await ShotLib.all();
      kit = await Coverage.kit();

      const tasks = Object.values(await Store.allMap('tasks')).filter(t => t.day === day);
      items = tasks.map(t => ({ kind:'task', rec:t, at:t.at, title:t.title, done:t.view === 'done' }));

      /* vlog beats scheduled onto this day */
      const { values: vlogs } = await Store.all('vlogs');
      vlogs.forEach(v => (v.acts || []).forEach(a => (a.beats || [])
        .filter(b => b.day === day)
        .forEach(b => items.push({ kind:'beat', rec:b, at:b.at, done:b.done,
          title:b.title, from:`${v.title} · ${a.title}` }))));

      /* meal prep on this day */
      const prep = await Nutrition.prep();
      const dayStart = new Date(date).setHours(0,0,0,0);
      prep.filter(p => !p.cooked && p.date >= dayStart && p.date < dayStart + 86400000)
        .forEach(p => items.push({ kind:'prep', rec:p, at:null, done:false,
          title:'Meal prep session', from:`${(p.mealIds||[]).length} meals · ${p.batches || 1}×` }));

      items.sort((a,b) => (a.at || '99:99').localeCompare(b.at || '99:99'));
    }

    const typeLabel = id => {
      const k = lib.find(x => x.id === id);
      return k ? k.label : id;
    };

    function itemHTML(it, n){
      const r = it.rec;
      const shots = (r.shots || []);
      const steps = (r.subs || []);
      const cov = it.kind === 'task' ? Coverage.totals(r, Coverage.kitFor(r, kit)) : null;

      return `
      <article class="ds-item${it.done ? ' done' : ''}">
        <div class="ds-t">
          <span class="n">${n}</span>
          <h3>${it.title}</h3>
          ${it.at ? `<span class="clock">${fmtTime(it.at)}</span>` : ''}
        </div>
        <div class="ds-meta">
          ${it.from ? `<span class="tg count">${it.from}</span>` : ''}
          ${r.cad ? `<span class="tg">${r.cad}</span>` : ''}
          ${shots.length ? `<span class="tg count">${shots.length} shots</span>` : ''}
          ${steps.length ? `<span class="tg count">${steps.length} steps</span>` : ''}
          ${cov && cov.want ? `<span class="tg count" style="color:${cov.got >= cov.want ? 'var(--green)' : 'var(--amber)'}">
            coverage ${cov.got}/${cov.want}</span>` : ''}
        </div>

        ${steps.length ? `<div class="ds-sec"><h4>Steps</h4>
          ${steps.map((s,si) => `<div class="ds-li${s.done ? ' on' : ''}"><span class="b"></span>
            <span class="dsn">${si + 1}</span>
            <span>${s.t}${s.note ? `<span class="angs">${s.note}</span>` : ''}</span></div>`).join('')}
        </div>` : ''}

        ${shots.length ? `<div class="ds-sec"><h4>Shot list</h4>
          ${shots.map(s => {
            const si = steps.findIndex(x => String(x.t||'').trim().toLowerCase() === String(s.text||'').trim().toLowerCase());
            return `<div class="ds-li${Coverage.shotDone(s) ? ' on' : ''}"><span class="b"></span>
            <span class="dsn">${si === -1 ? '' : si + 1}</span>
            <span>${s.text}
              ${(s.angles || []).length ? `<span class="angs">${
                s.angles.map(a => (a.done ? '✓ ' : '□ ') + typeLabel(a.type) +
                  (a.doneAt ? ' ' + new Date(a.doneAt).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }) : ''))
                  .join('   ')}</span>` : ''}
              ${s.note ? `<span class="angs">${s.note}</span>` : ''}
            </span></div>`;
          }).join('')}
        </div>` : ''}

        ${r.purpose ? `<div class="ds-sec"><h4>Why</h4>
          <p style="margin:0;font-size:14px;line-height:1.5;color:var(--muted)">${r.purpose}</p></div>` : ''}
      </article>`;
    }

    function render(){
      const d = new Date(date);
      const timed = items.filter(i => i.at);
      const untimed = items.filter(i => !i.at);
      const shots = items.reduce((n,i) => n + ((i.rec.shots || []).length), 0);
      const angles = items.reduce((n,i) =>
        n + (i.rec.shots || []).reduce((m,s) => m + (s.angles || []).length, 0), 0);
      const doneCount = items.filter(i => i.done).length;

      let body = '';
      let n = 0;
      BLOCKS.forEach(b => {
        const mine = timed.filter(i => blockOf(i.at) === b);
        if(!mine.length) return;
        body += `<div class="ds-block">
          <div class="ds-when"><b>${b.n}</b><div class="rule"></div>
            <b style="color:var(--dim)">${mine.length}</b></div>
          ${mine.map(i => itemHTML(i, ++n)).join('')}
        </div>`;
      });
      if(untimed.length){
        body += `<div class="ds-block">
          <div class="ds-when"><b>Sometime today</b><div class="rule"></div>
            <b style="color:var(--dim)">${untimed.length}</b></div>
          ${untimed.map(i => itemHTML(i, ++n)).join('')}
        </div>`;
      }

      el.innerHTML = Screens.bar({ kicker:'Today', title:'Day sheet',
        actions:`<button class="btn-sm accent" data-a="add">+ Task</button>
                 <button class="btn-sm" data-a="print">Print</button>` }) + `
      <div class="view">
        <header class="ds-head">
          <!-- Three lines that each hold one line's worth: the weekday with the
               day and week, then the date on its own, then the counts. The date
               uses the short month so it can never break at display size. -->
          <p class="sub">${d.toLocaleDateString(undefined,{ weekday:'long' })}
            · ${dayLbl}</p>
          <h1>${d.toLocaleDateString(undefined,{ month:'short', day:'numeric', year:'numeric' })}</h1>
          <p class="line">${items.length} thing${items.length===1?'':'s'} · ${doneCount} done ·
            ${shots} shot${shots===1?'':'s'} · ${angles} angle${angles===1?'':'s'}</p>
        </header>
        ${items.length ? body : `<div class="ds-empty">
          <b style="display:block;font-family:var(--display),sans-serif;font-weight:900;font-size:21px;margin:0 0 8px">Nothing on this day</b>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Put the first thing on it, or schedule a vlog beat onto this date.</p>
          <button class="btn-primary" data-a="add">+ Add a task</button>
        </div>`}
      </div>`;
    }

    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if(!a) return;
      if(a.dataset.a === 'print') return window.print();
      /* This sheet is the day laid out in front of you, which is exactly when
         you notice what is missing from it. */
      if(a.dataset.a === 'add')
        return TaskForm.open({ day, onSaved: async () => {
          await load(); render();
          if(params.onChange) params.onChange();
        } });
    });

    await load();
    render();
  }

  Screens.register('daysheet', mount);
})();
