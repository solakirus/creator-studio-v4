/* Planning, from the top down.

   Everything under a quarter already existed — months carry a theme and a goal,
   weeks are episodes, days hold sequences. What was missing was the way in:
   somewhere to start at the biggest idea and walk down to the thing you are
   filming on Tuesday.

   So this is a route, not a new model. Quarters for a year, each one opening
   the quarter you already have. */
(function(){
  const { ICON } = U;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  async function mount(el, params){
    const embedded = !!(params && params.embedded);
    let quarters = [], year = null, months = [];

    async function load(){
      try { quarters = await Quarters.all(); } catch(e){ quarters = []; }

      /* the year in view: the one holding today, unless you have moved */
      if(year == null){
        year = (params && params.year) || new Date().getFullYear();
      }

      /* The months are real records with their own dates, challenge and stakes,
         and their own page. This lists them rather than inventing a second kind
         of month. */
      try { months = await Months.all(); } catch(e){ months = []; }

      /* the episodes themselves are counted on the month screen, where the
         week numbers are already worked out */
    }

    const yearOf = q => +String(q.startMonth || '').slice(0, 4);

    function render(){
      const mine = quarters.filter(q => Quarters.months(q).some(k => +k.slice(0, 4) === year));
      const years = [...new Set(quarters.map(yearOf).filter(Boolean))].sort();
      if(!years.includes(year)) years.push(year);
      years.sort();

      el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Creator studio', title:'Planning',
        actions:`<button class="btn-sm accent" data-a="new">+ Quarter</button>` })) + `
        <div class="view">
          <!-- the bar above already says Planning; this names the section, and
               carries the action that would otherwise be lost when hosted -->
          <div class="pagehead"><h1 class="page-title">Quarters</h1>
            <span class="headacts"><button class="headbtn" data-a="new">NEW QUARTER</button></span>
          </div>
          <p class="hintline" style="margin:0 0 14px">Start at the quarter and work down —
            the month's goal, then the weeks that get you there.</p>

          <div class="wkbar" style="margin:0 0 16px">
            <button data-y="${year - 1}">←</button>
            <span><b>${year}</b><small>${mine.length} quarter${
              mine.length === 1 ? '' : 's'}</small></span>
            <button data-y="${year + 1}">→</button>
          </div>

          ${mine.length ? mine.map(q => {
            const mons = months.filter(m => m.quarterId === q.id)
              .sort((a, b) => (a.startDate || 0) - (b.startDate || 0));
            const done = mons.filter(m => m.result && m.result !== 'pending').length;
            return `
              <article class="qcard">
                <button class="qc-head" data-q="${q.id}">
                  <span class="qc-t">
                    <b>${esc(q.name)}</b>
                    <small>${q.topic ? esc(q.topic) : 'No topic set'}</small>
                  </span>
                  <span class="qc-n">${done}/${mons.length || 3}</span>
                  ${ICON.chevR}
                </button>

                ${q.challenge ? `<p class="qc-ch">${esc(q.challenge)}</p>` : ''}

                <div class="qc-months">
                  ${mons.length ? mons.map(m => `
                      <button class="qc-m" data-month="${m.id}">
                        <span class="qm-t">
                          <b>${esc(m.name || 'Untitled month')}</b>
                          <small>${m.challenge ? esc(m.challenge) : 'No challenge set'}</small>
                        </span>
                        <span class="qm-r ${m.result || 'pending'}">${
                          (m.result || 'pending').toUpperCase()}</span>
                        ${ICON.chevR}
                      </button>`).join('')
                    : `<p class="sc-none">No months under this quarter yet.</p>`}
                </div>
              </article>`;
          }).join('')
            : `<div class="empty"><b>Nothing for ${year}</b>
                A quarter is one developmental topic and the reading behind it.
                Start one and the months and weeks hang off it.</div>`}
        </div>`;
    }

    el.addEventListener('click', async e => {
      const y = e.target.closest('[data-y]');
      if(y){ year = +y.dataset.y; return render(); }

      const q = e.target.closest('[data-q]');
      if(q) return Screens.push('quarter', { id:q.dataset.q,
        onChange:async () => { await load(); render(); } });

      const m = e.target.closest('[data-month]');
      if(m) return Screens.push('month', { id:m.dataset.month,
        onChange:async () => { await load(); render(); } });

      if(e.target.closest('[data-a="new"]'))
        return Screens.push('quarter', { fresh:true,
          onChange:async () => { await load(); render(); } });
    });

    await load();
    render();
  }

  /* Planning holds both halves of the same walk: the quarters, and the months
     underneath them. Tabs rather than two tiles, because you move between them
     constantly while planning. The strip is fixed height so the section below
     keeps the whole scrolling area — two stacked .view elements fight for it. */
  async function mountHost(el, params){
    let section = (params && params.section) || 'quarters';

    function shell(){
      el.innerHTML = Screens.bar({ kicker:'Creator studio',
        title: section === 'months' ? 'Months'
             : section === 'paper'  ? 'Paper' : 'Planning' }) + `
        <div class="sectabs">
          <div class="segmented" role="tablist">
            <button role="tab" data-sec="quarters"
              aria-selected="${section === 'quarters'}">Quarters</button>
            <button role="tab" data-sec="months"
              aria-selected="${section === 'months'}">Months</button>
            <!-- Paper belongs here as much as under the pen on Today: on a
                 laptop you plan from this screen, and hunting for it on Today
                 is the wrong way round. -->
            <button role="tab" data-sec="paper"
              aria-selected="${section === 'paper'}">Paper</button>
          </div>
        </div>
        <div id="planHost"></div>`;
    }

    async function show(){
      shell();
      const host = el.querySelector('#planHost');
      if(section === 'paper'){
        const ok = Screens.mountInto
          ? Screens.mountInto('paper', host, { embedded:true })
          : null;
        if(!ok) host.innerHTML = '<div class="view"><div class="empty">' +
          '<b>Not available</b>The paper pages could not be opened.</div></div>';
        return;
      }
      if(section === 'months'){
        const ok = Screens.mountInto
          ? Screens.mountInto('months', host, { embedded:true })
          : null;
        if(!ok) host.innerHTML = '<div class="view"><div class="empty">' +
          '<b>Not available</b>The months could not be opened.</div></div>';
        return;
      }
      await mount(host, { ...(params || {}), embedded:true });
    }

    if(!el.dataset.wiredPlanHost){
      el.dataset.wiredPlanHost = '1';
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-sec]');
        if(!b || b.dataset.sec === section) return;
        section = b.dataset.sec;
        show();
      });
    }
    await show();
  }

  Screens.register('planning', mountHost);
  Screens.register('planning-quarters', mount);
})();
