/* Month calendar — what runs when, plus the queue of things that have no date yet. */
(function(){
  const { ICON, pad } = U;

  const PLATFORMS = {
    reel:{ n:'IG Reel', c:'#E1477E' }, carousel:{ n:'IG Carousel', c:'#A855F7' },
    story:{ n:'IG Story', c:'#F59E0B' }, tiktok:{ n:'TikTok', c:'#22C7B8' },
    ytshort:{ n:'YT Short', c:'#E2564A' }, youtube:{ n:'YT Long-form', c:'#FB6900' },
    shorts:{ n:'Shorts', c:'#FB6900' }, x:{ n:'X / Twitter', c:'#9AA0A6' },
    linkedin:{ n:'LinkedIn', c:'#3B82F6' }, newsletter:{ n:'Newsletter', c:'#5BBE6A' }
  };
  const colour = p => (PLATFORMS[p] || { c:'#9AA0A6' }).c;
  /* channel names are the user's own text and go into markup */
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const monthKey = (y,m) => `${y}-${pad(m+1)}`;
  const sameDay = (ts, d) => { const x = new Date(ts);
    return x.getFullYear()===d.getFullYear() && x.getMonth()===d.getMonth() && x.getDate()===d.getDate(); };

  function fmtTime(ts){
    const d = new Date(ts), h = d.getHours(), m = d.getMinutes();
    const ap = h >= 12 ? 'P' : 'A', hr = h % 12 === 0 ? 12 : h % 12;
    return m ? `${hr}:${String(m).padStart(2,'0')}${ap}` : `${hr}${ap}`;
  }
  const hhmmToTs = (dayTs, hhmm) => {
    const d = new Date(dayTs);
    if(hhmm){ const [h,m] = hhmm.split(':').map(Number); d.setHours(h, m, 0, 0); }
    else d.setHours(9, 0, 0, 0);
    return d.getTime();
  };

  async function mount(el, params){
    /* hosted as a tab there is no stack to go back to, and the tab already
       names the place */
    const embedded = !!(params && params.embedded);
    const now = new Date();
    let year = now.getFullYear(), month = now.getMonth();
    let filters = new Set(), placing = null, clips = [], tasks = [], theme = null;
    let CHANS = [];          /* your channels, which is how you think about a month */

    async function load(){
      clips = await Data.clips();
      try { CHANS = await Channels.all(); } catch(e){ CHANS = []; }
      theme = await Store.get('settings', 'month-theme:' + monthKey(year, month));
      /* tasks live on program days, so convert each to a real date for the grid */
      const raw = await Data.tasks();
      const start = (await Data.program()).start;
      tasks = raw.map(t => {
        const base = new Date(start);
        base.setHours(0,0,0,0);
        base.setDate(base.getDate() + (t.day - 1));
        if(t.at){ const [h,m] = t.at.split(':').map(Number); base.setHours(h, m, 0, 0); }
        return { ...t, kind:'task', when: base.getTime(), timed: !!t.at };
      });
    }

    /* Filtering a month by platform answered "what is going out on TikTok",
       which is rarely the question. "What is this channel doing this month" is. */
    const visible = () => clips.filter(c => !filters.size || filters.has(c.channel || ''));
    const scheduledClips = () => visible().filter(c => c.scheduledAt)
      .map(c => ({ ...c, kind:'clip', when:c.scheduledAt, timed:true }));
    /* the platform filter is about clips, so it hides tasks entirely when active */
    const dayEntries = d => [
      ...scheduledClips().filter(c => sameDay(c.when, d)),
      ...(filters.size ? [] : tasks.filter(t => sameDay(t.when, d)))
    ].sort((a,b) => (a.timed ? a.when : Infinity) - (b.timed ? b.when : Infinity));
    const scheduled = scheduledClips;
    const queue = () => visible().filter(c => !c.scheduledAt && c.state !== 'posted');

    /* What the one row says, so the state is readable without opening it.
       "All channels" is the resting state and the thing you want most of the
       time, so it reads as a statement rather than as a prompt. */
    function filterLabel(){
      if(!filters.size) return 'All channels';
      if(filters.size === 1){
        const only = [...filters][0];
        return only === '' ? 'No channel only' : only;
      }
      /* deliberately NOT special-cased when every channel is ticked: any
         filter at all hides tasks, so that is not the same view as "All" */
      return `${filters.size} channels`;
    }

    /* The chip list became a sheet. Same toggles, same behaviour, but off the
       screen until asked for — and with a way back to the whole month at the
       top, which the chips never had. */
    function openChannels(){
      const dot = c => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;
        flex:0 0 9px;background:${c}"></span>`;
      const rows = CHANS.map(c => `
        <button class="row" data-ch="${esc(c.n)}" aria-pressed="${filters.has(c.n)}">
          ${dot(c.c)}<span class="lbl">${esc(c.n)}</span>
          <span class="cf-tick">${filters.has(c.n) ? '✓' : ''}</span>
        </button>`).join('');
      const noneRow = clips.some(c => !c.channel) ? `
        <button class="row" data-ch="" aria-pressed="${filters.has('')}">
          ${dot('#4A443B')}<span class="lbl">No channel</span>
          <span class="cf-tick">${filters.has('') ? '✓' : ''}</span>
        </button>` : '';

      App.sheet(`
        <h2>Filter by channel</h2>
        <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.55">
          Pick one or more to see only their clips. With a filter on, tasks are
          hidden — the month is showing you the channel, not your day.</p>
        <div class="group compact" style="margin:0 0 14px">
          <button class="row" data-ch="__all" aria-pressed="${!filters.size}">
            <span class="lbl">All channels<small>Everything, plus your tasks</small></span>
            <span class="cf-tick">${!filters.size ? '✓' : ''}</span>
          </button>
        </div>
        <div class="group compact" style="margin:0">${rows}${noneRow}</div>
        <div class="sheetcta"><button class="btn-primary" data-cancel style="flex:1">Done</button></div>`,
      sheetEl => {
        /* Repaint the ticks in place. Calling App.sheet again would build a
           fresh node and slide the whole sheet up from the bottom on every
           tick, which looks broken when all that changed is one checkmark. */
        const sync = () => {
          sheetEl.querySelectorAll('[data-ch]').forEach(r => {
            const v = r.dataset.ch;
            const on = v === '__all' ? !filters.size : filters.has(v);
            r.setAttribute('aria-pressed', String(on));
            const tick = r.querySelector('.cf-tick');
            if(tick) tick.textContent = on ? '✓' : '';
          });
        };
        sheetEl.addEventListener('click', e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          const b = e.target.closest('[data-ch]');
          if(!b) return;
          const v = b.dataset.ch;
          if(v === '__all') filters.clear();
          else filters.has(v) ? filters.delete(v) : filters.add(v);
          sync();
          /* and the grid behind it, so you can see what the filter does before
             you close the sheet */
          render();
        });
      });
    }

    function weeksIn(){
      const first = new Date(year, month, 1);
      const start = new Date(first);
      start.setDate(first.getDate() - first.getDay());      /* grid starts Sunday */
      const rows = [];
      for(let w = 0; w < 6; w++){
        const row = [];
        for(let d = 0; d < 7; d++){
          const day = new Date(start);
          day.setDate(start.getDate() + w * 7 + d);
          row.push(day);
        }
        rows.push(row);
        const last = row[6];
        if(last.getMonth() !== month && last > first) break;
      }
      return rows;
    }

    function render(){
      const rows = weeksIn();
      const q = queue();
      const label = new Date(year, month, 1).toLocaleDateString(undefined, { month:'long', year:'numeric' });

      const head = Screens.bar({ kicker:'Creator studio', title:'Month',
        actions:`<button class="btn-sm" data-a="today">Today</button>
                 <button class="btn-sm accent" data-a="plan">Auto-schedule</button>` });

      el.innerHTML = (embedded ? '' : head) + `
      <div class="view">
        ${embedded ? `<div class="pagehead"><h1 class="page-title">Month</h1>
          <span class="headacts" style="display:flex;gap:8px;align-items:center">
            <button class="headbtn" data-a="today">TODAY</button>
            <button class="headbtn" data-a="plan">SCHEDULE</button>
          </span></div>` : ''}
        <div class="wkbar">
          <button data-a="prev">←</button>
          <div class="mid"><p class="k" style="font-family:var(--display),sans-serif;font-size:19px">${label}</p>
            <p class="r">${rows.length} weeks</p></div>
          <button data-a="next">→</button>
        </div>

        <!-- One row, not nine pills and a heading. Filtering a month by channel
             is something you do occasionally; looking at the month is what you
             came for, and the chip list was pushing the grid off the screen. -->
        <div class="calfilter">
          <button class="cf-pick" data-a="chans">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
            <span>${filterLabel()}</span>
            ${ICON.chevR}
          </button>
          ${filters.size ? `<button class="btn-sm" data-a="allchans">Clear</button>` : ''}
        </div>

        <div class="calgrid">
          <div class="calhead">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<span>${d}</span>`).join('')}</div>
          ${rows.map(row => `<div class="calrow">${row.map(d => {
            const out = d.getMonth() !== month;
            const isToday = sameDay(Date.now(), d);
            const evs = dayEntries(d);
            return `<button class="cday${out?' out':''}${isToday?' today':''}${placing?' target':''}"
              data-day="${d.getTime()}">
              <span class="dn">${d.getDate()}</span>
              ${evs.slice(0,2).map(c => `<span class="ev" style="color:${c.kind === 'task' ? 'var(--cream)' : colour(c.plat)}">${c.timed ? fmtTime(c.when) + ' ' : ''}${c.title}</span>`).join('')}
              ${evs.length > 2 ? `<span class="more">+${evs.length - 2} more</span>` : ''}
            </button>`;
          }).join('')}</div>`).join('')}
        </div>
        <!-- the grid looked read-only, because it was -->
        <p class="hintline" style="margin:10px 0 0">Tap any day to see it and add a task to it.</p>

        <!-- The theme sat above the grid and pushed it down too. It is the
             month's framing, which you set once and read occasionally; the grid
             is the thing you open this screen to look at. -->
        <div class="block" style="margin-top:16px">
          <h4 style="margin:0 0 10px">${label}</h4>
          ${theme && theme.theme
            ? `<p style="margin:0 0 6px;font-size:16px"><b>${theme.theme}</b></p>
               ${theme.goal ? `<p style="margin:0;color:var(--muted);font-size:14.5px">Goal: ${theme.goal}</p>` : ''}`
            : `<p style="margin:0;color:var(--muted);font-size:14.5px;line-height:1.6">
                 No theme on this month yet. The theme is what the month is about; the goal is the concrete
                 thing each week is a step toward.</p>`}
          <div class="metaline" style="margin:14px 0 0">
            <button class="btn-sm" data-a="theme">${theme && theme.theme ? 'Edit theme' : 'Set a theme'}</button>
          </div>
        </div>

        <div class="block" style="margin-top:16px">
          <h4>Unscheduled queue</h4>
          ${q.length ? `
            <p style="margin:0 0 12px;color:var(--muted);font-size:14px">
              ${placing ? 'Now tap a day to place it.' : 'Tap a clip, then tap a day.'}</p>
            <div style="display:flex;gap:9px;flex-wrap:wrap">
              ${q.map(c => `<button class="qchip${placing===c.id?' on':''}" data-q="${c.id}">
                <span class="dot" style="background:${colour(c.plat)}"></span>
                <span class="nm">${c.title}</span></button>`).join('')}
            </div>`
          : `<p style="margin:0;color:var(--muted);font-size:14.5px;line-height:1.6">
               Queue is empty. Anything in Clips without a date lands here, ready to place.</p>`}
        </div>

        <p class="note">${scheduled().length} clips scheduled · ${q.length} waiting${filters.size ? ' · your tasks are hidden while a channel filter is on' : ''}.</p>
      </div>`;
    }

    async function openDay(ts){
      const d = new Date(ts);
      const evs = dayEntries(d);
      const q = queue();
      App.sheet(`
        <h2>${d.toLocaleDateString(undefined,{ weekday:'long', month:'long', day:'numeric' })}</h2>
        ${evs.length ? `<p class="caps muted" style="font-size:11.5px;margin:0 0 10px">On this day</p>
          <div class="group compact" style="margin:0 0 18px">
            ${evs.map(c => c.kind === 'task'
              /* a task here used to be a dead row — the one place you were
                 already looking at the thing you wanted to change */
              ? `<button class="row" data-task="${c.id}">
                  <span class="timechip${c.timed ? '' : ' none'}">${c.timed ? fmtTime(c.when) : '—'}</span>
                  <span class="lbl">${c.title}<small>Task · day ${c.day}</small></span>
                  ${ICON.chevR}</button>`
              : `<button class="row" data-clip="${c.id}">
                  <span class="timechip">${fmtTime(c.when)}</span>
                  <span class="lbl">${c.title}<small>${(PLATFORMS[c.plat]||{n:c.plat}).n}</small></span>
                  ${ICON.chevR}</button>`).join('')}
          </div>` : `<p style="margin:0 0 18px;color:var(--muted);font-size:15px">Nothing on this day.</p>`}

        <div class="sheetcta" style="margin:0 0 18px">
          <button class="btn-primary" data-add style="flex:1">+ Add a task</button>
        </div>
        ${q.length ? `<p class="caps muted" style="font-size:11.5px;margin:0 0 10px">Place from the queue</p>
          <div class="group compact" style="margin:0">
            ${q.map(c => `<button class="row" data-place="${c.id}">
              <span class="dot" style="width:9px;height:9px;border-radius:50%;flex:0 0 9px;background:${colour(c.plat)}"></span>
              <span class="lbl">${c.title}<small>${(PLATFORMS[c.plat]||{n:c.plat}).n}</small></span>
              ${ICON.chevR}</button>`).join('')}
          </div>` : ''}
        <div class="sheetcta"><button class="btn-ghost" data-cancel style="flex:1">Close</button></div>`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();

          /* The whole point of planning on a month grid: pick the square, put
             something in it. The form lands on this date, not on today. */
          if(e.target.closest('[data-add]')){
            App.closeSheet();
            setTimeout(() => TaskForm.open({ date: ts,
              onSaved: async () => { await load(); render(); } }), 260);
            return;
          }

          const tk = e.target.closest('[data-task]');
          if(tk){
            const id = tk.dataset.task;
            App.closeSheet();
            setTimeout(() => Screens.push('task', { id,
              onChange: async () => { await load(); render(); } }), 260);
            return;
          }

          const pl = e.target.closest('[data-place]');
          if(pl){
            const c = clips.find(x => x.id === pl.dataset.place);
            await Data.saveClip({ ...c, scheduledAt: hhmmToTs(ts) });
            await load(); App.closeSheet(); render(); return;
          }
          const cl = e.target.closest('[data-clip]');
          if(cl){
            const c = clips.find(x => x.id === cl.dataset.clip);
            App.closeSheet();
            setTimeout(() => openClipTime(c, ts), 260);
          }
        });
      });
    }

    async function openClipTime(c, dayTs){
      const cur = new Date(c.scheduledAt);
      const hhmm = `${pad(cur.getHours())}:${pad(cur.getMinutes())}`;
      /* if this came from the planner it has a shoot and an edit attached to it */
      const chain = await Pipeline.chainFor(c.id);
      const kinds = chain.map(t => t.kind).filter(Boolean);

      App.sheet(`
        <h2>${c.title}</h2>
        ${chain.length ? `<p style="margin:0 0 16px;padding:11px 12px;border-radius:var(--r);
          background:rgba(251,105,0,.08);border:1px solid rgba(251,105,0,.3);
          font-size:13.5px;color:var(--muted);line-height:1.55">
          Auto-scheduled from your cadence. ${kinds.length} linked task${kinds.length===1?'':'s'}
          — ${[...new Set(kinds)].join(' and ')} — sit on Today.</p>` : ''}
        <div class="field"><label for="ct">Time</label>
          <input id="ct" type="time" value="${hhmm}"></div>
        <div class="field"><label>Quick set</label><div class="opts">
          ${['06:00','09:00','12:00','15:00','18:00','21:00'].map(t =>
            `<button type="button" class="opt" data-q="${t}">${t}</button>`).join('')}
        </div></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save time</button>
          <button class="btn-ghost" data-unsched>Unschedule</button>
        </div>
        ${chain.length ? `<button class="btn-ghost" data-drop style="width:100%;margin-top:10px;
          color:var(--red);border-color:rgba(226,86,74,.4)">Remove this piece and its tasks</button>` : ''}`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          const q = e.target.closest('[data-q]');
          if(q){ sheetEl.querySelector('#ct').value = q.dataset.q; return; }
          if(e.target.closest('[data-drop]')){
            const key = (chain.find(t => t.slotKey && !t.slotKey.startsWith('post|')) || {}).slotKey;
            if(key) await Pipeline.removeSlot(key);
            await load(); App.closeSheet();
            U.toast('Piece and its tasks removed');
            return render();
          }
          if(e.target.closest('[data-unsched]')){
            await Data.saveClip({ ...c, scheduledAt:null });
            await load(); App.closeSheet(); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          await Data.saveClip({ ...c, scheduledAt: hhmmToTs(dayTs, sheetEl.querySelector('#ct').value) });
          await load(); App.closeSheet(); render();
        });
      });
    }

    function openTheme(){
      const t = theme || { theme:'', goal:'' };
      App.sheet(`
        <h2>${new Date(year, month, 1).toLocaleDateString(undefined,{ month:'long', year:'numeric' })}</h2>
        <div class="field"><label for="th">Theme — what the month is about</label>
          <input id="th" type="text" value="${(t.theme||'').replace(/"/g,'&quot;')}" placeholder="Shop build, start to finish"></div>
        <div class="field"><label for="gl">Goal — the concrete thing to hit</label>
          <input id="gl" type="text" value="${(t.goal||'').replace(/"/g,'&quot;')}" placeholder="Ship 12 clips and one long-form"></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(!e.target.closest('[data-save]')) return;
          const rec = { theme: sheetEl.querySelector('#th').value.trim(),
                        goal:  sheetEl.querySelector('#gl').value.trim() };
          await Store.put('settings', rec, 'month-theme:' + monthKey(year, month));
          await load(); App.closeSheet(); render();
        });
      });
    }

    /* Plan from each channel's cadence, working backwards to shoot and edit days. */
    async function autoSchedule(){
      const { items, shootDays, cfg } = await Pipeline.plan(Date.now(), null);

      if(!items.length){
        const chans = await Channels.all();
        const any = chans.some(c => c.schedule && (c.schedule.days || []).length);
        return U.toast(any ? 'Everything in range is already scheduled'
                           : 'Set a cadence on a channel first — Settings, then Channels');
      }

      const byChannel = {};
      items.forEach(i => byChannel[i.slot.channel] = (byChannel[i.slot.channel] || 0) + 1);
      const shootCount = Object.keys(shootDays).length;
      const first = items[0], last = items[items.length - 1];
      const d = ts => new Date(ts).toLocaleDateString(undefined, { month:'short', day:'numeric' });

      App.sheet(`
        <h2>Auto-schedule ${cfg.weeks} weeks</h2>
        <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.6">
          ${items.length} publish slot${items.length===1?'':'s'} between ${d(first.publishAt)} and ${d(last.publishAt)},
          from your channel cadences.</p>

        <div class="group compact" style="margin:0 0 16px">
          ${Object.entries(byChannel).map(([n, c]) => `<div class="row" style="cursor:default">
            <span class="lbl">${n}</span>
            <span style="font-family:var(--display),sans-serif;font-weight:900">${c}</span></div>`).join('')}
        </div>

        <p class="caps muted" style="font-size:11.5px;margin:0 0 10px">What it will create</p>
        <div class="group compact" style="margin:0 0 16px">
          <div class="row" style="cursor:default"><span class="lbl">Shoot days
            <small>Everything due that week, batched into one</small></span>
            <span style="font-family:var(--display),sans-serif;font-weight:900">${shootCount}</span></div>
          <div class="row" style="cursor:default"><span class="lbl">Edit tasks
            <small>${cfg.editLead} days before each publish</small></span>
            <span style="font-family:var(--display),sans-serif;font-weight:900">${items.length}</span></div>
          <div class="row" style="cursor:default"><span class="lbl">Publish tasks and clips
            <small>One clip each, scheduled on the calendar</small></span>
            <span style="font-family:var(--display),sans-serif;font-weight:900">${items.length}</span></div>
        </div>

        <p class="note" style="text-align:left;margin:0">
          Shoots land ${cfg.shootLead} days before their publish date. Planning again later only adds
          what is missing.</p>

        <div class="sheetcta">
          <button class="btn-primary" data-go>Schedule it all</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        <button class="btn-ghost" data-clear style="width:100%;margin-top:10px;color:var(--red);
          border-color:rgba(226,86,74,.4)">Clear everything auto-scheduled from today</button>`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-clear]')){
            const n = await Pipeline.clearPlan(Date.now());
            App.closeSheet();
            U.toast(n ? `${n} scheduled tasks removed` : 'Nothing scheduled to remove');
            await load(); return render();
          }
          if(!e.target.closest('[data-go]')) return;
          const res = await Pipeline.apply(Date.now(), null);
          await load();
          App.closeSheet();
          U.toast(`${res.shoots} shoot days · ${res.edits} edits · ${res.posts} posts`);
          render();
          Reminders.sync();
        });
      });
    }

    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]');
      if(a){
        if(a.dataset.a === 'prev'){ month--; if(month < 0){ month = 11; year--; } await load(); return render(); }
        if(a.dataset.a === 'next'){ month++; if(month > 11){ month = 0; year++; } await load(); return render(); }
        if(a.dataset.a === 'today'){ year = now.getFullYear(); month = now.getMonth(); await load(); return render(); }
        if(a.dataset.a === 'theme') return openTheme();
        if(a.dataset.a === 'plan')  return autoSchedule();
        if(a.dataset.a === 'auto')  return autoSchedule();
        if(a.dataset.a === 'chans') return openChannels();
        /* back to the whole month in one tap, which the chip list never had —
           you had to remember which ones you had turned on */
        if(a.dataset.a === 'allchans'){ filters.clear(); return render(); }
      }
      const qc = e.target.closest('[data-q]');
      if(qc){ placing = placing === qc.dataset.q ? null : qc.dataset.q; return render(); }

      const day = e.target.closest('[data-day]');
      if(!day) return;
      const ts = +day.dataset.day;
      if(placing){
        const c = clips.find(x => x.id === placing);
        await Data.saveClip({ ...c, scheduledAt: hhmmToTs(ts) });
        placing = null;
        await load();
        U.toast('Placed');
        return render();
      }
      openDay(ts);
    });

    await load();
    render();
  }

  Screens.register('calendar', mount);
})();
