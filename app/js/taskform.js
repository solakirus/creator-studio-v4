/* Adding a task to a day that is not today.

   The app could always write tasks, but only from Today — the add form lived
   inside that view and landed on whatever day the view was showing. So the
   month grid and the week board, the two screens you actually plan on, could
   show tasks and move them and tick them and never make one. Planning a
   Thursday three weeks out meant walking Today forward to it.

   This is that form, lifted out and given a day to aim at. One form, opened
   from the month grid, the week board, the day sheet and Paper, so a task
   added while planning the month is the same record Today will hand you on the
   morning — there is one tasks store and everything reads it.

   It deliberately keeps the repeat ("which days, how long"), because that is
   most of ordinary life: bins out Tuesday, gym Monday Wednesday Friday, call
   Mum on Sundays. A planner that can only write single days makes you write
   the same line fifty times. */
(function(global){

  const PRI  = { low:{ t:'Low', s:'easy win' }, med:{ t:'Medium', s:'normal' },
                 high:{ t:'High', s:'the hard one' } };

  /* The kinds the week board already colours, plus the plain one. Naming the
     kind here is what makes the board readable at a glance — an uncoloured
     card is life, a coloured one is the channel. */
  const KINDS = { '':'Plain', shoot:'Shoot', edit:'Edit', publish:'Publish', workout:'Workout' };

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  const pad = n => String(n).padStart(2, '0');

  function fmtTime(hhmm){
    if(!hhmm) return '';
    const [h, m] = String(hhmm).split(':').map(Number);
    if(isNaN(h)) return hhmm;
    const ap = h >= 12 ? 'pm' : 'am', hh = ((h + 11) % 12) + 1;
    return m ? `${hh}:${pad(m)}${ap}` : `${hh}${ap}`;
  }

  /* Unique across devices, so a task made here never overwrites one made on
     the other device when they sync (see U.taskId). */
  async function nextId(){ return U.taskId(); }

  /* opts.day   — program day to land on (what the callers have)
     opts.date  — a timestamp or yyyy-mm-dd, if that is what you have instead
     opts.seed  — { title, at, kind, mins } to prefill
     opts.onSaved(tasks) — called with what was written  */
  async function open(opts){
    const o = opts || {};
    const seed = o.seed || {};

    let day = o.day;
    if(day == null && o.date != null){
      const ts = typeof o.date === 'number' ? o.date
        : new Date(String(o.date) + 'T09:00').getTime();
      day = await Data.dateToDay(ts);
    }
    if(day == null) day = await Data.currentDay();

    /* The date is the headline, not the day number. "Thursday 12 November" is
       what you are planning; "day 437" is how the app files it. */
    const ts = await Data.dayToDate(day);
    const d  = new Date(ts);
    const dateLabel = d.toLocaleDateString(undefined,
      { weekday:'long', day:'numeric', month:'long' });
    const dow = d.getDay();

    let units = ['reps','min','hr','km','pages','L','g','words','clips'];
    try { if(global.TaskLib && TaskLib.UNITS) units = TaskLib.UNITS; } catch(e){}

    App.sheet(`
      <h2 style="margin:0 0 4px">Add a task</h2>
      <p class="hintline" style="margin:0 0 14px">${esc(dateLabel)} · day ${day}</p>

      <input id="tf-title" class="pgname" type="text" value="${esc(seed.title || '')}"
        placeholder="Bins out" autocomplete="off">
      <p class="err" id="tf-err" hidden>Give the task a name first.</p>

      <h3 class="pgh">What time?</h3>
      <div class="field" style="margin:0">
        <input id="tf-time" type="time" value="${esc(seed.at || '')}">
      </div>
      <div class="opts" style="margin:8px 0 0">
        ${['','06:00','09:00','12:00','15:00','18:00','21:00'].map(t =>
          `<button type="button" class="opt" data-tfq="${t}">${t ? fmtTime(t) : 'No time'}</button>`).join('')}
      </div>
      <p class="hintline" style="margin:8px 0 0">Without a time it sits under
        “Sometime today” and stays off the calendar row.</p>

      <h3 class="pgh">How long will it take?</h3>
      <select id="tf-mins" class="pgbar">
        <option value="0"${!seed.mins ? ' selected' : ''}>Not worth timing</option>
        ${[5,10,15,20,30,45,60,90,120].map(n =>
          `<option value="${n}"${+seed.mins === n ? ' selected' : ''}>${
            n < 60 ? n + ' min' : (n / 60) + ' hr'}</option>`).join('')}
      </select>

      <h3 class="pgh">Does it repeat?</h3>
      <div class="pgdaygrid">
        ${[1,2,3,4,5,6,0].map(n =>
          `<button type="button" data-tfdow="${n}" aria-pressed="false">${
            ['Su','Mo','Tu','We','Th','Fr','Sa'][n]}</button>`).join('')}
      </div>
      <p class="hintline" id="tf-freq">None picked — this lands on ${esc(dateLabel)} only.</p>

      <div id="tf-weeks" class="pgoff">
        <h3 class="pgh">For how long?</h3>
        <select id="tf-wk" class="pgbar">
          ${[2,4,8,12,26,52].map(n =>
            `<option value="${n}"${n === 4 ? ' selected' : ''}>${n} weeks</option>`).join('')}
        </select>
      </div>

      <h3 class="pgh">How hard?</h3>
      <div class="pgseg">${Object.keys(PRI).map(k =>
        `<button type="button" data-tfpri="${k}" aria-pressed="${k === 'med'}">
          <b>${PRI[k].t}</b><small>${PRI[k].s}</small></button>`).join('')}</div>

      <h3 class="pgh">What kind?</h3>
      <select id="tf-kind" class="pgbar">
        ${Object.keys(KINDS).map(k =>
          `<option value="${k}"${(seed.kind || '') === k ? ' selected' : ''}>${
            k ? KINDS[k] + ' — coloured on the week board' : 'Plain — ordinary life'}</option>`).join('')}
      </select>

      <h3 class="pgh">Count something? <small style="font-weight:400;color:var(--muted)">optional</small></h3>
      <div class="pgstep">
        <button type="button" class="bump" data-tfstep="-1">&minus;</button>
        <span class="val"><b id="tf-amt">0</b></span>
        <button type="button" class="bump" data-tfstep="1">+</button>
      </div>
      <select id="tf-unit" class="pgbar" style="margin:8px 0 0">
        <option value="__none" selected>Just tick it — no amount</option>
        <option value="">a number, no unit</option>
        ${units.map(u => `<option value="${u}">${u}</option>`).join('')}
      </select>

      <h3 class="pgh">Steps <small style="font-weight:400;color:var(--muted)">one per line, optional</small></h3>
      <textarea id="tf-steps" class="pgbar" rows="3"
        placeholder="Take it to the kerb&#10;Bring the bin back in"></textarea>

      <div class="sheetcta">
        <button class="btn-primary" data-tfsave>Add it</button>
        <button class="btn-ghost" data-tfcancel>Cancel</button>
      </div>`,
    sheetEl => {
      const $ = s => sheetEl.querySelector(s);
      const title = $('#tf-title');
      if(title) setTimeout(() => title.focus(), 80);

      let repeat = [];
      const syncDow = () => {
        sheetEl.querySelectorAll('[data-tfdow]').forEach(b =>
          b.setAttribute('aria-pressed', String(repeat.includes(+b.dataset.tfdow))));
        $('#tf-weeks').className = repeat.length ? '' : 'pgoff';
        $('#tf-freq').textContent = repeat.length
          ? (repeat.length >= 7 ? 'Daily' : repeat.length + '×/week')
            + ' — from this date onward'
          : `None picked — this lands on ${dateLabel} only.`;
      };

      sheetEl.addEventListener('click', async e => {
        const q = e.target.closest('[data-tfq]');
        if(q){ $('#tf-time').value = q.dataset.tfq; return; }

        const bump = e.target.closest('[data-tfstep]');
        if(bump){
          const cur = +$('#tf-amt').textContent || 0;
          const step = cur >= 10 ? 1 : 0.5;
          $('#tf-amt').textContent = String(
            Math.max(0, Math.round((cur + step * +bump.dataset.tfstep) * 10) / 10));
          return;
        }

        /* weekdays toggle — they are a set, not a single choice */
        const dw = e.target.closest('[data-tfdow]');
        if(dw){
          const i = +dw.dataset.tfdow;
          repeat.includes(i) ? repeat = repeat.filter(x => x !== i) : repeat.push(i);
          return syncDow();
        }

        const pr = e.target.closest('[data-tfpri]');
        if(pr){
          sheetEl.querySelectorAll('[data-tfpri]').forEach(b =>
            b.setAttribute('aria-pressed', String(b === pr)));
          return;
        }

        if(e.target.closest('[data-tfcancel]')) return App.closeSheet();
        if(!e.target.closest('[data-tfsave]')) return;

        const name = title.value.trim();
        if(!name){ $('#tf-err').hidden = false; return; }

        const unitSel = $('#tf-unit').value;
        const amt  = unitSel === '__none' ? 0 : (+$('#tf-amt').textContent || 0);
        const target = amt > 0 ? amt + (unitSel === '__none' ? '' : unitSel) : '';
        const steps = $('#tf-steps').value
          .split('\n').map(x => x.trim()).filter(Boolean).map(t => ({ t, done:false }));
        const pri = ($('[data-tfpri][aria-pressed="true"]') ||
          { dataset:{ tfpri:'med' } }).dataset.tfpri;
        const kind = $('#tf-kind').value;

        let id = await nextId();
        const base = {
          id, day, title: name,
          cad: repeat.length ? (repeat.length >= 7 ? 'Daily' : repeat.length + '×/week') : 'One-off',
          pri,
          at: $('#tf-time').value || null,
          mins: +$('#tf-mins').value || 0,
          prog: target ? '0 / ' + target : '',
          subs: steps,
          view: 'todo'
        };
        if(kind) base.kind = kind;
        /* every new task starts with the task sequence shot page (taskpages.js) */
        if(window.TaskPages) await TaskPages.attachDefault(base);

        const written = [];
        if(!repeat.length){
          await Store.put('tasks', base);
          written.push(base);
        } else {
          /* Walk forward day by day from the chosen date and drop a copy on
             every matching weekday. Counting in days rather than weeks keeps it
             right across a clock change, where adding 7×86400000 does not. */
          const weeks = +$('#tf-wk').value || 4;
          const seriesKey = `sr_${Date.now().toString(36)}`;
          base.series = seriesKey;
          const start = new Date(ts); start.setHours(0, 0, 0, 0);
          for(let i = 0; i < weeks * 7; i++){
            const dd = new Date(start);
            dd.setDate(start.getDate() + i);
            if(!repeat.includes(dd.getDay())) continue;
            const copy = { ...base, id: U.taskId(), day: day + i,
              subs: (base.subs || []).map(x => ({ ...x, done:false })) };
            await Store.put('tasks', copy);
            written.push(copy);
          }
          /* Nothing matched — the days picked never come round inside the
             window. Rather than saving silently nothing, put it on the date. */
          if(!written.length){
            await Store.put('tasks', base);
            written.push(base);
          }
        }

        if(global.Data && Data.invalidate) Data.invalidate('tasks');
        App.closeSheet();
        try { if(global.Notify) Notify.update(); } catch(e){}
        try { if(global.Reminders) Reminders.sync(); } catch(e){}
        try { if(global.Widget) Widget.refresh(); } catch(e){}

        U.toast(written.length === 1
          ? `Added to ${dateLabel}`
          : `Added ${written.length} times — ${base.cad.toLowerCase()}`);

        if(o.onSaved) await o.onSaved(written);
      });

      syncDow();
    });
  }

  global.TaskForm = { open, KINDS, PRI };
})(window);
