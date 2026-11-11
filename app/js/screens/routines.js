/* The workout library: what you have saved, and starting one again. */
(function(){
  const { ICON } = U;

  async function mount(el, params){
    let list = [], unit = 'lb', groups = [], allTypes = [], filter = 'all';

    async function load(){
      Routines.invalidate();
      list = await Routines.all();
      groups = await Routines.grouped();
      allTypes = await Routines.types();
      unit = await Units.get();
    }

    function render(){
      /* only offer a filter rail once there is enough to be worth filtering */
      const usedTypes = groups.map(g => g.type);
      const rows = filter === 'all' ? list : list.filter(r => (r.type || 'Unsorted') === filter);

      el.innerHTML = Screens.bar({ kicker:'Workout', title:'My workouts',
        actions:`<button class="btn-sm accent" data-a="new">+ Build one</button>` }) + `
      <div class="view"${usedTypes.length > 1 ? ' style="padding-left:0;padding-right:0"' : ''}>
        ${usedTypes.length > 1 ? `<div class="mrail">
          <button class="pill" data-f="all" aria-pressed="${filter==='all'}">All ${list.length}</button>
          ${usedTypes.map(t => `<button class="pill" data-f="${t}" aria-pressed="${filter===t}">${t} ${
            groups.find(g => g.type === t).items.length}</button>`).join('')}
        </div>` : ''}
        <div${usedTypes.length > 1 ? ' class="pad"' : ''}>
        ${rows.length ? rows.map(r => {
          const cov = Routines.muscles(r).slice(0, 4);
          const total = r.items.reduce((n,i) => n + i.sets, 0);
          return `<div class="rt-card" data-open="${r.id}">
            <div class="rt-top">
              <span class="tx">
                <b>${r.name}</b>
                <span>${r.type ? `${r.type} · ` : ''}${r.items.length} lift${r.items.length===1?'':'s'} · ${total} sets${
                  r.lastAt ? ` · last ${new Date(r.lastAt).toLocaleDateString(undefined,{ month:'short', day:'numeric' })}` : ' · never run'}</span>
              </span>
              <span class="rt-runs"><b>${r.runs || 0}</b><span>runs</span></span>
            </div>
            ${cov.length ? `<div class="rt-mus">
              ${cov.map(m => `<span class="mtag" style="--mc:${m.c}">${m.n}</span>`).join('')}
            </div>` : ''}
            <p class="rt-lifts">${r.items.map(i => i.name).join(' · ')}</p>
            <div class="rt-acts">
              <button data-edit="${r.id}">Edit</button>
              <button data-plan="${r.id}">Add to a day</button>
              <button class="start" data-start="${r.id}">Start →</button>
            </div>
          </div>`;
        }).join('')
        : `<div class="empty"><b>No saved workouts</b>
            Build a session, then save it here and you can run it again with one tap —
            weighted from whatever you are currently lifting.</div>`}

        </div>
        <div${usedTypes.length > 1 ? ' class="pad"' : ''}>
        <button class="btn-primary" data-a="new" style="width:100%;margin-top:10px">
          ${list.length ? 'Build another' : 'Build your first'}</button>
        <button class="btn-ghost" data-a="gallery" style="width:100%;margin-top:10px">
          Browse ready-made workouts</button>
        <p class="note">Starting one builds a fresh session using your current working loads,
          so an overload increase carries straight through.</p>
        </div>
      </div>`;
    }

    async function startRoutine(id){
      const r = await Routines.get(id);
      if(!r) return;
      const session = await Routines.toSession(r);
      await Routines.markRun(id);
      Screens.push('session', { preset: session, onChange: async () => { await load(); render(); } });
    }

    /* Putting a workout on a day. It becomes a normal task that knows how to
       start itself, so it swipes and counts toward the streak like anything else. */
    async function openPlan(r){
      if(!r) return;
      const today = await Data.currentDay();
      const days = Array.from({ length: 8 }, (_, i) => {
        const d = today + i;
        const ts = new Date();
        ts.setDate(ts.getDate() + i);
        return { d, label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
          : ts.toLocaleDateString(undefined, { weekday:'long' }),
          sub: ts.toLocaleDateString(undefined, { month:'short', day:'numeric' }) };
      });
      const guess = Routines.estimateMinutes(r);
      const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];
      let repeat = [];

      /* anything already scheduled for this routine, so a plan can be replaced
         rather than quietly doubled */
      const tasks = await Data.tasks();
      const upcoming = tasks.filter(t => t.routineId === r.id && t.view === 'todo' && t.day >= today);
      const series = [...new Set(upcoming.map(t => t.series).filter(Boolean))];

      App.sheet(`
        <h2>Add ${r.name} to a day</h2>
        <p style="margin:0 0 14px;color:var(--muted);font-size:14.5px;line-height:1.55">
          It lands as a task with every lift as a step, blocking out the time you give it.</p>
        ${upcoming.length ? `<p style="margin:0 0 14px;padding:11px 12px;border-radius:var(--r);
          background:rgba(251,105,0,.08);border:1px solid rgba(251,105,0,.3);font-size:13.5px;
          color:var(--muted);line-height:1.5">
          ${upcoming.length} session${upcoming.length===1?'':'s'} of this already on the calendar.
          ${series.length ? 'You can clear them below.' : ''}</p>` : ''}

        <div class="field"><label for="pl-day">Starting</label>
          <select id="pl-day" class="unit">
            ${days.map(x => `<option value="${x.d}">${x.label} · ${x.sub}</option>`).join('')}
          </select></div>

        <div class="field" style="display:flex;gap:10px">
          <span style="flex:1"><label for="pl-time">Time</label>
            <input id="pl-time" type="time" value="18:00"></span>
          <span style="flex:1"><label for="pl-mins">Blocks out</label>
            <select id="pl-mins" class="unit">
              ${[30,45,60,75,90,120,150].map(m => `<option value="${m}"${
                m === guess ? ' selected' : ''}>${m >= 60
                  ? `${Math.floor(m/60)}h${m%60 ? ' ' + (m%60) + 'm' : ''}` : `${m}m`}</option>`).join('')}
            </select></span>
        </div>
        <p style="margin:-4px 0 16px;font-size:12.5px;color:var(--dim);line-height:1.5">
          Worked out from the sets and rests — about ${guess} minutes. Change it if that is wrong.</p>

        <div class="field"><label>Repeat on</label>
          <div class="opts" data-group="dow">
            ${DOW.map((d, i) => `<button type="button" class="opt" data-dow="${i}"
              aria-pressed="false">${d}</button>`).join('')}
          </div>
          <p style="margin:9px 0 0;font-size:13px;color:var(--dim);line-height:1.5">
            Leave these off for a one-off.</p>
        </div>

        <div class="field" data-weeks hidden><label>For how long</label>
          <div class="opts" data-group="wk">
            ${[2,4,6,8,12].map((n,i) => `<button type="button" class="opt" data-wk="${n}"
              aria-pressed="${n === 4}">${n} weeks</button>`).join('')}
          </div></div>

        <div class="sheetcta">
          <button class="btn-primary" data-add>Add it</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${series.length ? `<button class="btn-ghost" data-clearseries style="width:100%;margin-top:10px;
          color:var(--red);border-color:rgba(226,86,74,.4)">Remove the upcoming ones</button>` : ''}`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          const d = e.target.closest('[data-dow]');
          if(d){
            const i = +d.dataset.dow;
            const on = d.getAttribute('aria-pressed') === 'true';
            d.setAttribute('aria-pressed', String(!on));
            repeat = on ? repeat.filter(x => x !== i) : [...repeat, i];
            sheetEl.querySelector('[data-weeks]').hidden = !repeat.length;
            return;
          }
          const wk = e.target.closest('[data-wk]');
          if(wk){
            sheetEl.querySelectorAll('[data-wk]').forEach(b => b.setAttribute('aria-pressed','false'));
            wk.setAttribute('aria-pressed','true');
            return;
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();

          if(e.target.closest('[data-clearseries]')){
            let n = 0;
            for(const k of series) n += await Routines.unschedule(k);
            App.closeSheet();
            U.toast(`${n} upcoming session${n===1?'':'s'} removed`);
            params && params.onChange && params.onChange();
            return;
          }

          if(!e.target.closest('[data-add]')) return;

          const pick = +sheetEl.querySelector('#pl-day').value || today;
          const time = sheetEl.querySelector('#pl-time').value;
          const mins = +sheetEl.querySelector('#pl-mins').value || guess;
          const weeks = +(sheetEl.querySelector('[data-wk][aria-pressed="true"]') || {}).dataset?.wk || 4;

          const made = await Routines.scheduleTask(r.id, pick, time, {
            mins, repeat,
            weeks,
            seriesKey: repeat.length ? `rt_${r.id}_${Date.now().toString(36)}` : null
          });
          App.closeSheet();
          U.toast(made && made.length > 1
            ? `${made.length} sessions added over ${weeks} weeks`
            : `${r.name} added`);
          params && params.onChange && params.onChange();
        });
      });
    }

    function openRename(r){
      App.sheet(`
        <h2>${r.name}</h2>
        <div class="field"><label for="rt-n">Name</label>
          <input id="rt-n" type="text" value="${r.name.replace(/"/g,'&quot;')}"></div>
        <div class="field"><label for="rt-type">Type</label>
          <select id="rt-type" class="unit">
            <option value=""${!r.type ? ' selected' : ''}>Unsorted</option>
            ${allTypes.map(t => `<option value="${t}"${r.type === t ? ' selected' : ''}>${t}</option>`).join('')}
            <option value="__new">+ New type…</option>
          </select>
          <div id="rt-newtype" hidden style="margin-top:10px">
            <input id="rt-newname" type="text" placeholder="Name the new type">
          </div>
        </div>
        <div class="field"><label for="rt-note">Note
          <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <input id="rt-note" type="text" value="${(r.note||'').replace(/"/g,'&quot;')}"
            placeholder="Heavy day · keep rests long"></div>
        <p class="caps muted" style="font-size:11px;margin:6px 0 8px">Lifts</p>
        <div class="group compact" style="margin:0 0 14px">
          ${r.items.map(i => `<div class="row" style="cursor:default">
            <span class="lbl">${i.name}<small>${i.sets} × ${i.reps}</small></span>
          </div>`).join('')}
        </div>
        <p class="note" style="text-align:left;margin:0 0 14px">To change the lifts, start the
          routine, adjust it, and save it over the top.</p>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheetEl => {
        /* the new-type field only appears when it is wanted */
        const sel = sheetEl.querySelector('#rt-type');
        sel.addEventListener('change', () => {
          const wrap = sheetEl.querySelector('#rt-newtype');
          const on = sel.value === '__new';
          wrap.hidden = !on;
          if(on) setTimeout(() => { const f = sheetEl.querySelector('#rt-newname'); if(f) f.focus(); }, 60);
        });

        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(!e.target.closest('[data-save]')) return;

          let type = sel.value;
          if(type === '__new'){
            const made = await Routines.addType(sheetEl.querySelector('#rt-newname').value);
            if(!made) return U.toast('Name the new type first');
            type = made;
          }

          await Routines.save({ ...r, type,
            name: sheetEl.querySelector('#rt-n').value.trim() || r.name,
            note: sheetEl.querySelector('#rt-note').value.trim() });
          App.closeSheet(); await load(); render();
        });
      });
    }

    el.addEventListener('click', async e => {
      const f = e.target.closest('[data-f]');
      if(f){ filter = f.dataset.f; return render(); }

      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'gallery')
        return Screens.push('workout-gallery', { onChange: async () => { await load(); render(); } });
      if(a && a.dataset.a === 'new')
        return Screens.push('session', { onChange: async () => { await load(); render(); } });

      const st = e.target.closest('[data-start]');
      if(st){ e.stopPropagation(); return startRoutine(st.dataset.start); }

      const ed = e.target.closest('[data-edit]');
      if(ed){ e.stopPropagation(); return openRename(list.find(r => r.id === ed.dataset.edit)); }

      const pl = e.target.closest('[data-plan]');
      if(pl){
        e.stopPropagation();
        return openPlan(list.find(x => x.id === pl.dataset.plan));
      }

      const dl = e.target.closest('[data-del]');
      if(dl){
        e.stopPropagation();
        const r = list.find(x => x.id === dl.dataset.del);
        if(!r) return;
        App.sheet(`
          <h2>Delete ${r.name}?</h2>
          <p style="margin:0 0 18px;color:var(--muted);font-size:15px;line-height:1.6">
            The routine goes; the sessions you already did with it stay in your history.</p>
          <div class="sheetcta">
            <button class="btn-primary" data-yes style="background:var(--red)">Delete</button>
            <button class="btn-ghost" data-cancel>Keep it</button>
          </div>`, sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-yes]')) return;
            await Routines.remove(r.id);
            App.closeSheet(); await load(); render();
          });
        });
        return;
      }

      const op = e.target.closest('[data-open]');
      if(op) return startRoutine(op.dataset.open);
    });

    await load();
    render();
  }

  Screens.register('routines', mount);
})();
