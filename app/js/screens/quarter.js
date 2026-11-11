/* The quarter, as a screen. Three things live here and nothing else:
   what the topic is, what you have read about it, and the skeleton a week
   starts from. */
(function(){

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  async function mount(el, params){
    const embedded = !!(params && params.embedded);
    let list = [], q = null, srcs = [], filter = 'all', goals = [], months = [], loose = [];

    async function load(){
      list = await Quarters.all();
      q = params && params.id ? await Quarters.get(params.id)
        : (await Quarters.current()) || list[0] || null;
      srcs = q ? await Quarters.sources(q.id) : [];
      goals = q ? await Quarters.monthGoals(q) : [];
      /* the months that actually belong to this quarter — real records with
         their own dates, challenge, stakes and result, and their own page */
      try {
        const all = await Months.all();
        /* A month keeps its dates as "YYYY-MM-DD"; a quarter keeps timestamps.
           Comparing the two directly is quietly always false, so both are put
           on the same footing first. */
        const byDate = m => Months.ts(m.startDate) || 0;
        months = all.filter(m => m.quarterId === (q && q.id)).sort((a, b) => byDate(a) - byDate(b));

        /* Months you already planned, whose dates sit inside this quarter but
           which never had a quarter set. They belong here by the calendar, so
           the page offers to say so rather than making you build them again. */
        loose = (q && q.startDate && q.endDate)
          ? all.filter(m => !m.quarterId && byDate(m)
              && byDate(m) >= q.startDate && byDate(m) <= q.endDate)
              .sort((a, b) => byDate(a) - byDate(b))
          : [];
      } catch(e){ months = []; loose = []; }
    }

    const monthName = key => {
      const [y, m] = String(key).split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month:'long', year:'numeric' });
    };

    function sourceRow(s){
      const k = Quarters.kindOf(s.kind);
      return `
        <button class="noterow" data-src="${s.id}">
          <span class="dot" style="background:var(--orange)"></span>
          <span class="t">
            <b>${esc(s.work || s.passage.slice(0, 60) || 'Untitled')}</b>
            <small>${k.label}${s.author ? ' · ' + esc(s.author) : ''}${
              s.year ? ' · ' + esc(s.year) : ''}</small>
          </span>
          ${U.ICON.chevR}
        </button>`;
    }

    function render(){
      if(!list.length){
        el.innerHTML = (embedded ? '' : Screens.bar({ title:'Quarter' })) + `
          <div class="view">
            <div class="pagehead"><h1 class="page-title">Quarter</h1></div>
            <div class="empty"><b>No quarter yet</b>
              A quarter is one developmental topic and the reading behind it.
              Twelve weeks of experiments draw on it, so the research happens once.</div>
            <button class="btn-primary" data-a="fill" style="width:100%;margin:14px 0 0">
              Lay out the quarters to 2030</button>
            <button class="btn-ghost" data-a="new" style="width:100%;margin:8px 0 0">
              Start just one</button>
          </div>`;
        return;
      }

      const shown = filter === 'all' ? srcs : srcs.filter(s => s.kind === filter);
      const counts = {};
      srcs.forEach(s => counts[s.kind] = (counts[s.kind] || 0) + 1);

      el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Content', title:q.name })) + `
        <div class="view">
          <div class="pagehead"><h1 class="page-title">${esc(q.name)}</h1>
            <span class="headacts" style="display:flex;gap:8px;align-items:center">
              <button class="headbtn" data-a="edit">EDIT</button>
              <button class="headbtn" data-a="new">NEW</button>
            </span></div>

          ${list.some(x => !x.startDate) || list.length < 4
            ? `<button class="btn-ghost" data-a="fill" style="width:100%;margin:0 0 12px">
                Lay out the quarters to 2030</button>` : ''}

          ${list.length > 1 ? `<select id="qt-pick" class="pgbar" style="margin:0 0 14px">
            ${list.map(x => `<option value="${x.id}" ${x.id === q.id ? 'selected' : ''}
              >${esc(x.name)}${Quarters.rangeLabel(x) ? ' · ' + Quarters.rangeLabel(x) : ''}</option>`).join('')}
          </select>` : ''}

          <!-- thirteen project weeks. The calendar quarter is a label worked
               out from those dates, not a second thing to keep in step. -->
          <p class="hintline" style="margin:0 0 16px">${
            Quarters.rangeLabel(q) || Quarters.months(q).map(monthName).join(' · ')}${
            Quarters.calendarSpan(q) ? ` · spans ${Quarters.calendarSpan(q)}` : ''}</p>

          <div class="sec"><h2>The topic</h2><div class="rule"></div></div>
          <p class="qt-topic">${q.topic ? esc(q.topic) : '<i>Not set — what are you studying this quarter?</i>'}</p>
          ${q.throughline ? `<p class="qt-thru">${esc(q.throughline)}</p>` : ''}

          <div class="sec"><h2>The challenge</h2><div class="rule"></div></div>
          <p class="hintline" style="margin:0 0 10px">The big one you are holding for twelve
            weeks. The monthly goals below build to it, and each week's experiment builds
            to those.</p>
          <p class="qt-topic">${q.challenge
            ? esc(q.challenge)
            : '<i>Not set — what are you committing to for the quarter?</i>'}</p>

          <div class="sec"><h2>Month by month</h2><div class="rule"></div>
            <span class="alt">${months.filter(m => m.result && m.result !== 'pending').length}/${
              months.length || 3}</span></div>
          <p class="hintline" style="margin:0 0 12px">The three months of this quarter. Each
            one opens its own page — its challenge, habits, stakes and how it ended.</p>
          ${months.length ? months.map(m => `
            <button class="noterow" data-month="${m.id}">
              <span class="dot" style="background:${
                m.result === 'won' ? 'var(--green)'
                : m.result === 'lost' ? 'var(--red)' : 'var(--dim)'}"></span>
              <span class="t"><b>${esc(m.name || 'Untitled month')}</b>
                <small>${m.challenge ? esc(m.challenge) : 'No challenge set'}</small></span>
              ${U.ICON.chevR}
            </button>`).join('')
            : `<div class="empty"><b>No months yet</b>
                A month is a whole number of weeks with a challenge and stakes.
                Make one and set its quarter to this.</div>`}
          ${loose.length ? `
            <div class="loosem">
              <b>${loose.length} month${loose.length === 1 ? '' : 's'} fall${
                loose.length === 1 ? 's' : ''} inside this quarter</b>
              <span>${loose.map(m => esc(m.name || 'Untitled')).join(' · ')}</span>
              <button class="btn-sm accent" data-a="claim">Link ${
                loose.length === 1 ? 'it' : 'them'}</button>
            </div>` : ''}

          <div style="display:flex;gap:8px;margin:10px 0 0">
            <button class="btn-ghost" data-a="linkmonth" style="flex:1">Link a month</button>
            <button class="btn-ghost" data-a="addmonth" style="flex:1">${
              months.length >= 3 ? 'Add another' : 'Add a month'}</button>
            ${months.length ? `<button class="btn-ghost" data-a="allmonths" style="flex:1">
              All months</button>` : ''}
          </div>

          <div class="sec"><h2>Sources</h2><div class="rule"></div>
            <span class="alt">${srcs.length}</span></div>
          <p class="hintline" style="margin:0 0 12px">What is true and who said it —
            the reading every week of this quarter draws on.</p>

          ${srcs.length ? `<div class="vidfilters">
            <button class="opt" data-f="all" aria-pressed="${filter === 'all'}">All ${srcs.length}</button>
            ${Quarters.KINDS.filter(k => counts[k.k]).map(k =>
              `<button class="opt" data-f="${k.k}" aria-pressed="${filter === k.k}"
                >${k.label} ${counts[k.k]}</button>`).join('')}
          </div>` : ''}

          ${shown.length ? shown.map(sourceRow).join('')
            : `<div class="empty"><b>${srcs.length ? 'None of that kind' : 'Nothing read yet'}</b>
                ${srcs.length ? 'Nothing matches that filter.'
                  : 'Add the books, studies and articles behind this quarter.'}</div>`}

          <button class="btn-ghost" data-a="addsrc" style="width:100%;margin:12px 0 0">
            Add a source</button>

        </div>`;
    }

    /* ---------- the quarter itself ---------- */

    function editor(rec){
      const isNew = !rec.id;
      const r = { ...Quarters.blank(), ...rec };
      const now = new Date();
      const opts = Array.from({ length:8 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
        return Quarters.monthKey(d);
      });

      App.sheet(`
        <h2 style="margin:0 0 14px">${isNew ? 'New quarter' : 'Edit quarter'}</h2>
        <input id="qt-n" class="pgname" type="text" value="${esc(r.name)}"
          placeholder="Attention" autocomplete="off">

        <h3 class="pgh">The topic</h3>
        <textarea id="qt-t" class="pgtext" rows="2"
          placeholder="One developmental subject you will study for twelve weeks."
          >${esc(r.topic)}</textarea>

        <h3 class="pgh">The challenge</h3>
        <textarea id="qt-c" class="pgtext" rows="2"
          placeholder="The big commitment for these twelve weeks — the thing the monthly goals build to."
          >${esc(r.challenge || '')}</textarea>

        <h3 class="pgh">The through-line</h3>
        <textarea id="qt-th" class="pgtext" rows="3"
          placeholder="What you want a viewer to understand by the end of the quarter that they did not at the start."
          >${esc(r.throughline)}</textarea>

        <h3 class="pgh">Starts in</h3>
        <select id="qt-m" class="pgbar">
          ${opts.map(k => `<option value="${k}" ${r.startMonth === k ? 'selected' : ''}
            >${monthName(k)}</option>`).join('')}
        </select>
        <p class="hintline">It covers that month and the two after it.</p>

        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${isNew ? '' : `<button class="btn-ghost" data-del
          style="width:100%;margin:12px 0 0;color:var(--red);border-color:rgba(226,86,74,.45)">
          Delete this quarter and its sources</button>`}`, sheet => {

        sheet.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();

          if(e.target.closest('[data-del]')){
            await Quarters.remove(r.id);
            App.closeSheet();
            params.id = null;
            await load(); render();
            return U.toast('Deleted');
          }
          if(!e.target.closest('[data-save]')) return;

          const saved = await Quarters.save({
            ...r,
            name: sheet.querySelector('#qt-n').value,
            topic: sheet.querySelector('#qt-t').value.trim(),
            challenge: sheet.querySelector('#qt-c').value.trim(),
            throughline: sheet.querySelector('#qt-th').value.trim(),
            startMonth: sheet.querySelector('#qt-m').value
          });
          App.closeSheet();
          params.id = saved.id;
          await load(); render();
        });
      });
    }

    /* ---------- one source ---------- */

    function sourceSheet(rec){
      const r = { kind:'book', author:'', work:'', year:'', url:'', passage:'', tags:[], ...rec };
      const isNew = !r.id;

      App.sheet(`
        <h2 style="margin:0 0 14px">${isNew ? 'Add a source' : 'Source'}</h2>

        <h3 class="pgh" style="margin-top:0">What kind?</h3>
        <select id="sr-k" class="pgbar">
          ${Quarters.KINDS.map(k => `<option value="${k.k}" ${r.kind === k.k ? 'selected' : ''}
            >${k.label}</option>`).join('')}
        </select>

        <h3 class="pgh">Title of the work</h3>
        <input id="sr-w" class="pgname" type="text" value="${esc(r.work)}"
          placeholder="Stolen Focus" autocomplete="off">

        <div style="display:flex;gap:10px">
          <span style="flex:2"><h3 class="pgh">Author</h3>
            <input id="sr-a" class="pgbar" type="text" value="${esc(r.author)}"
              placeholder="Johann Hari"></span>
          <span style="flex:1"><h3 class="pgh">Year</h3>
            <input id="sr-y" class="pgbar" type="text" value="${esc(r.year)}"
              placeholder="2022"></span>
        </div>

        <h3 class="pgh">The passage</h3>
        <textarea id="sr-p" class="pgtext" rows="4"
          placeholder="The bit you would actually quote. Copy it exactly — you will be saying it on camera."
          >${esc(r.passage)}</textarea>

        <h3 class="pgh">Link</h3>
        <input id="sr-u" class="pgbar" type="url" value="${esc(r.url)}"
          placeholder="https://" autocomplete="off">

        <h3 class="pgh">Tags</h3>
        <input id="sr-t" class="pgname" type="text" value="${esc((r.tags || []).join(', '))}"
          placeholder="dopamine, history" autocomplete="off">

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
            ...r, quarterId: q.id,
            kind: sheet.querySelector('#sr-k').value,
            work: sheet.querySelector('#sr-w').value.trim(),
            author: sheet.querySelector('#sr-a').value.trim(),
            year: sheet.querySelector('#sr-y').value.trim(),
            passage: sheet.querySelector('#sr-p').value.trim(),
            url: sheet.querySelector('#sr-u').value.trim(),
            tags: sheet.querySelector('#sr-t').value.split(',').map(x => x.trim()).filter(Boolean)
          });
          App.closeSheet();
          await load(); render();
        });
      });
    }

    /* Hosted in a tab, mount runs again on every visit. The data must reload
       each time, but the listeners must only ever be attached once. */
    /* Mount runs again on every visit to this tab. Attaching a listener each
       time stacks them; attaching only on the first leaves that listener bound
       to the first mount's stale data. So one listener is attached once and
       always calls whatever the newest mount put here. */
    if(!el.dataset.wiredQuarter){
      el.dataset.wiredQuarter = '1';
      el.addEventListener('click', e => el.__onClick && el.__onClick(e));
      el.addEventListener('change', e => el.__onChange && el.__onChange(e));
    }

    el.__onChange = (async e => {
      if(e.target.id !== 'qt-pick') return;
      params.id = e.target.value;
      await load(); render();
    });

    el.__onClick = (async e => {
      const mo = e.target.closest('[data-month]');
      if(mo){
        /* the real month page — the theme-and-goal sheet that used to open here
           wrote to a record nothing else read */
        return Screens.push('month', { id:mo.dataset.month,
          onChange:async () => { await load(); render(); } });
      }

      if(e.target.closest('[data-a="claim"]')){
        /* setting the quarter on each, which is the same field the month form
           writes — nothing else about them is touched */
        for(const m of loose){
          await Months.save({ ...m, quarterId:q.id,
            quarter: m.quarter || q.name || '',
            quarterTheme: m.quarterTheme || q.topic || '' });
        }
        const n = loose.length;
        await load(); render();
        return U.toast(`${n} month${n === 1 ? '' : 's'} linked`);
      }

      if(e.target.closest('[data-a="linkmonth"]')){
        /* Linking by date only works when the dates already line up. A month
           planned before the quarters existed may sit anywhere, so this lists
           every month that is not already spoken for and lets you say. */
        const all = await Months.all();
        const free = all.filter(m => !m.quarterId || m.quarterId === q.id)
          .sort((a, b) => (Months.ts(a.startDate) || 0) - (Months.ts(b.startDate) || 0));

        if(!free.length) return U.toast('Every month already belongs to a quarter');

        const when = m => {
          const a = Months.ts(m.startDate), b = Months.ts(m.endDate);
          if(!a) return 'No dates';
          const f = t => new Date(t).toLocaleDateString(undefined,
            { month:'short', day:'numeric' });
          return b ? `${f(a)} – ${f(b)}` : f(a);
        };

        App.sheet(`
          <h2 style="margin:0 0 3px">Months for ${esc(q.name)}</h2>
          <p class="hintline" style="margin:0 0 14px">Tick the ones that belong to this
            quarter. Unticking one leaves it unassigned rather than deleting it.</p>
          <div class="group compact" style="margin:0 0 14px;max-height:52vh;overflow-y:auto">
            ${free.map(m => `
              <button class="row" data-pick="${m.id}" aria-pressed="${m.quarterId === q.id}">
                <span class="lbl">${esc(m.name || 'Untitled month')}
                  <small>${when(m)}${m.challenge ? ' · ' + esc(m.challenge) : ''}</small></span>
                <span class="tg" data-on="${m.id}"${
                  m.quarterId === q.id ? '' : ' hidden'}>linked</span>
              </button>`).join('')}
          </div>
          <div class="sheetcta">
            <button class="btn-primary" data-save>Done</button>
            <button class="btn-ghost" data-cancel>Cancel</button>
          </div>`, sheet => {
          const picked = new Set(free.filter(m => m.quarterId === q.id).map(m => m.id));
          sheet.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();

            const row = ev.target.closest('[data-pick]');
            if(row){
              const id = row.dataset.pick;
              picked.has(id) ? picked.delete(id) : picked.add(id);
              row.setAttribute('aria-pressed', String(picked.has(id)));
              const tag = sheet.querySelector(`[data-on="${id}"]`);
              if(tag) tag.hidden = !picked.has(id);
              return;
            }

            if(!ev.target.closest('[data-save]')) return;
            let n = 0;
            for(const m of free){
              const want = picked.has(m.id);
              const has = m.quarterId === q.id;
              if(want === has) continue;
              await Months.save({ ...m,
                quarterId: want ? q.id : null,
                quarter: want ? (m.quarter || q.name || '') : m.quarter,
                quarterTheme: want ? (m.quarterTheme || q.topic || '') : m.quarterTheme });
              n++;
            }
            App.closeSheet();
            await load(); render();
            if(n) U.toast(`${n} month${n === 1 ? '' : 's'} updated`);
          });
        });
        return;
      }

      if(e.target.closest('[data-a="addmonth"]')){
        /* Made here, so it arrives attached: the quarter's id and name are
           filled in, and its start follows the last month of this quarter —
           or the quarter's own first day when there are none yet. */
        if(window.MonthsUI && MonthsUI.openForm){
          const last = months[months.length - 1];
          const start = last && last.endDate
            ? Months.addDays(last.endDate, 1)
            : (q.startDate ? Months.snapSunday(q.startDate) : null);
          return MonthsUI.openForm(null,
            async () => { await load(); render(); },
            { quarterId:q.id, quarter:q.name || '', quarterTheme:q.topic || '',
              ...(start ? { startDate:start } : {}) });
        }
        return Screens.push('months', { onChange:async () => { await load(); render(); } });
      }

      if(e.target.closest('[data-a="allmonths"]'))
        return Screens.push('months', { onChange:async () => { await load(); render(); } });
      const f = e.target.closest('[data-f]');
      if(f){ filter = f.dataset.f; return render(); }

      const src = e.target.closest('[data-src]');
      if(src){
        const s = srcs.find(x => x.id === src.dataset.src);
        if(s) return sourceSheet(s);
      }

      const a = e.target.closest('[data-a]');
      if(!a) return;
      if(a.dataset.a === 'fill'){
        /* Thirteen weeks each from week one. Anything already there is adopted
           by its dates rather than replaced, so nothing written is lost. */
        U.toast('Laying them out…');
        const r = await Quarters.ensureThrough(2030);
        await load();
        render();
        return U.toast(r.made
          ? `${r.made} quarter${r.made === 1 ? '' : 's'} added${
              r.adopted ? `, ${r.adopted} kept` : ''}`
          : 'They were already there');
      }

      if(a.dataset.a === 'new') return editor(Quarters.blank());
      if(a.dataset.a === 'edit') return editor(q);
      if(a.dataset.a === 'addsrc') return sourceSheet({});
    });

    await load();
    render();

    /* opened from Planning's NEW: start the form rather than showing whichever
       quarter happened to be first */
    if(params && params.fresh) editor(Quarters.blank());
  }

  Screens.register('quarter', mount);
})();
