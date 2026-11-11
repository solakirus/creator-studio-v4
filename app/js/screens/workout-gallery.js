/* A shelf of ready-made workouts. Picking one saves it as your own routine,
   which you can then change freely — the template is a starting point, not a rule. */
(function(){

  const GLYPH = {
    'Push':'M3 9h18M6 9v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9',
    'Pull':'M12 21V5M8 9l4-4 4 4M5 21h14',
    'Legs':'M8 3h8M9 3v8l-2 10M15 3v8l2 10',
    'Full body':'M12 3a2 2 0 1 0 0-.01M12 6v7M8 21l4-8 4 8M6 10l6 2 6-2',
    'Calisthenics':'M6 6v12M18 6v12M6 12h12M3 9v6M21 9v6',
    'Core':'M5 5h14v14H5zM5 12h14M12 5v14',
    'Conditioning':'M3 12h4l2-6 3 12 2-6h7',
    'Boxing':'M7 8h7a4 4 0 0 1 4 4v4a3 3 0 0 1-3 3H9a2 2 0 0 1-2-2zM7 8V6a2 2 0 0 1 2-2h3',
    'Military':'M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7z',
    'Basketball':'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c4 4 4 14 0 18M12 3c-4 4-4 14 0 18',
    'Yoga':'M12 4a2 2 0 1 0 0-.01M12 7v4M7 20l5-9 5 9M5 12h14',
    'Mobility':'M12 4a2 2 0 1 0 0-.01M12 7v5l-4 8M12 12l4 8M7 9h10'
  };
  const glyph = t => GLYPH[t] || GLYPH['Full body'];

  /* Which types you want to see. Everything is on until you turn something off,
     and the setting only hides them from the index — nothing is deleted. */
  async function visibleTypes(){
    let hidden = [];
    try { hidden = (await Store.get('settings', 'workout-types-off')) || []; }
    catch(e){ hidden = []; }
    return WorkoutTypes.CATS.filter(c => !hidden.includes(c));
  }

  async function mount(el, params){
    let cat = null;          /* null = the index; a type name = that type's workouts */
    let shown = await visibleTypes();

    const countOf = c => WorkoutTypes.TYPES.filter(t => t.type === c).length;
    const namesOf = c => WorkoutTypes.TYPES.filter(t => t.type === c)
      .map(t => t.n).join(' · ');

    /* ---- level one: the types ---- */
    function renderIndex(){
      const total = WorkoutTypes.TYPES.filter(t => shown.includes(t.type)).length;

      el.innerHTML = Screens.bar({ kicker:'Workout', title:'Workout types',
        actions:`<button class="btn-sm" data-a="filters">Filters</button>` }) + `
      <div class="view">
        <p class="note" style="text-align:left;margin:0 0 16px">${total} workouts across
          ${shown.length} type${shown.length===1?'':'s'}. Pick a type to see what is in it.</p>

        ${shown.map(c => `<button class="ty-row" data-open="${c}" style="--wc:${colourOf(c)}">
          <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="${glyph(c)}"/></svg></span>
          <span class="tx"><b>${c}</b><span>${namesOf(c)}</span></span>
          <span class="n">${countOf(c)}</span>
          <svg class="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
            stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
        </button>`).join('')}

        ${shown.length < WorkoutTypes.CATS.length ? `<p class="note" style="text-align:left">
          ${WorkoutTypes.CATS.length - shown.length} type${
            WorkoutTypes.CATS.length - shown.length === 1 ? ' is' : 's are'} hidden.
          Change that under Filters.</p>` : ''}
      </div>`;
    }

    /* the colour of a type is taken from its first workout, so they always agree */
    const colourOf = c => {
      const t = WorkoutTypes.TYPES.find(x => x.type === c);
      return t ? t.c : '#FB6900';
    };

    /* ---- level two: the workouts inside one type ---- */
    function render(){
      if(cat === null) return renderIndex();
      const rows = WorkoutTypes.TYPES.filter(t => t.type === cat);

      el.innerHTML = Screens.bar({ kicker:'Workout types', title:cat,
        actions:`<button class="btn-sm" data-a="index">All types</button>` }) + `
      <div class="view" style="padding-left:0;padding-right:0">
        <div class="pad">
          <p class="note" style="text-align:left;margin:0 0 14px">
            ${rows.length} workout${rows.length===1?'':'s'}. Pick one and it becomes yours —
            saved to your workouts and editable from there. Weights come from what you are
            currently lifting.</p>
        </div>
        <div class="mrail">
          ${shown.map(c => `<button class="pill" data-c="${c}"
            aria-pressed="${cat===c}">${c}</button>`).join('')}
        </div>
        <div class="pad">
          <div class="wt-grid">
            ${rows.map(t => `<button class="wt-card" data-wtype="${t.id}" style="--wc:${t.c}">
              <span class="wt-band">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                  stroke-linecap="round" stroke-linejoin="round"><path d="${glyph(t.type)}"/></svg>

              </span>
              <span class="wt-meat">
                <b>${t.n}</b>
                <span>${t.items.length} lifts · ${
                  t.items.reduce((n,i) => n + i[1], 0)} sets</span>
              </span>
            </button>`).join('')}
          </div>
        </div>
      </div>`;
    }

    async function openType(id){
      const t = await WorkoutTypes.expand(WorkoutTypes.byId(id));
      if(!t) return;
      const cov = Exercises.coverage(t.items).slice(0, 5);
      const sets = t.items.reduce((n,i) => n + i.sets, 0);

      App.sheet(`
        <h2>${t.n}</h2>
        <p style="margin:0 0 14px;color:var(--muted);font-size:15px;line-height:1.6">${t.d}</p>

        ${cov.length ? `<div class="mtags" style="margin:0 0 14px">
          ${cov.map(m => `<span class="mtag" style="--mc:${m.c}">${m.n}</span>`).join('')}
        </div>` : ''}

        <p class="caps muted" style="font-size:11px;margin:0 0 8px">
          ${t.items.length} lifts · ${sets} sets</p>
        <div class="group compact" style="margin:0 0 16px;max-height:36vh;overflow-y:auto">
          ${t.items.map(i => `<div class="row" style="cursor:default">
            <span class="lbl">${i.name}<small>${i.sets} × ${i.reps}${
              i.reps > 30 ? ' sec' : ''}</small></span>
          </div>`).join('')}
        </div>

        <div class="sheetcta">
          <button class="btn-primary" data-save>Save to my workouts</button>
          <button class="btn-ghost" data-start>Start it now</button>
        </div>`, sheetEl => {
        sheetEl.addEventListener('click', async e => {
          const save = e.target.closest('[data-save]');
          const start = e.target.closest('[data-start]');
          if(!save && !start) return;

          const routine = await Routines.save({ name:t.n, note:t.d, type:t.type, items:t.items });
          App.closeSheet();
          params && params.onChange && params.onChange();

          if(start){
            const session = await Routines.toSession(routine);
            await Routines.markRun(routine.id);
            Screens.push('session', { preset: session,
              onChange: params && params.onChange });
          } else {
            U.toast(`${t.n} saved to your workouts`);
          }
        });
      });
    }

    /* ---- choosing which types you care about ---- */
    async function openFilters(){
      let hidden = [];
      try { hidden = (await Store.get('settings', 'workout-types-off')) || []; }
      catch(e){ hidden = []; }

      const rowsHTML = () => WorkoutTypes.CATS.map(c => `
        <button class="ty-pin${hidden.includes(c) ? ' off' : ''}" data-t="${c}">
          <span class="dot" style="background:${colourOf(c)}"></span>
          <span class="nm">${c}<span style="color:var(--dim);font-size:12.5px"> · ${countOf(c)}</span></span>
          <span class="sw"><i></i></span>
        </button>`).join('');

      App.sheet(`
        <h2>Types to show</h2>
        <p style="margin:0 0 12px;color:var(--muted);font-size:14.5px;line-height:1.55">
          Turn off the ones you never do. Nothing is deleted — they come back the moment
          you switch them on.</p>
        <div style="margin:0 0 14px" data-rows>${rowsHTML()}</div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Done</button>
          <button class="btn-ghost" data-all>Show them all</button>
        </div>`, sheetEl => {
        sheetEl.addEventListener('click', async e => {
          const t = e.target.closest('[data-t]');
          if(t){
            const c = t.dataset.t;
            hidden.includes(c) ? hidden = hidden.filter(x => x !== c) : hidden.push(c);
            t.classList.toggle('off');
            return;
          }
          if(e.target.closest('[data-all]')){
            hidden = [];
            sheetEl.querySelector('[data-rows]').innerHTML = rowsHTML();
            return;
          }
          if(!e.target.closest('[data-save]')) return;
          await Store.put('settings', hidden, 'workout-types-off');
          shown = await visibleTypes();
          if(cat && !shown.includes(cat)) cat = null;
          App.closeSheet();
          render();
        });
      });
    }

    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'filters') return openFilters();
      if(a && a.dataset.a === 'index'){ cat = null; return render(); }

      const open = e.target.closest('[data-open]');
      if(open){ cat = open.dataset.open; return render(); }

      const c = e.target.closest('[data-c]');
      if(c){ cat = c.dataset.c; return render(); }

      /* not data-type: <html> carries that for the lettering, and closest()
         would match the document element on any tap that missed a card */
      const t = e.target.closest('[data-wtype]');
      if(t) openType(t.dataset.wtype);
    });

    render();
  }

  Screens.register('workout-gallery', mount);
})();
