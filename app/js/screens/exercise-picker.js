/* Exercise picker — search and category filter over the library. */
(function(){
  async function mount(el, params){
    let muscle = 'all', q = '', picked = [];
    let layout = (await Store.get('settings','ex-layout')) || 'cards';
    const unit = await Units.get();
    const onPick = params.onPick || (() => {});
    let LIBRARY = await Exercises.all();
    let ART = await Exercises.artMap(LIBRARY.map(x => x.id));
    /* What you are currently lifting beats whatever the library shipped with,
       so an overload increase actually reaches the next session. */
    let LOADS = {};
    try { (await Loads.all()).forEach(l => { if(l.kg > 0) LOADS[l.id] = l.kg; }); }
    catch(e){ LOADS = {}; }
    const startWeight = x => LOADS[x.id] !== undefined ? LOADS[x.id] : x.kg;

    const VIEW_ICONS = {
      cards:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>',
      list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
    };

    el.innerHTML = Screens.bar({ title:'Add exercise',
      actions:`<span class="vtoggle">
        <button data-layout="cards" aria-pressed="${layout==='cards'}" aria-label="Cards">${VIEW_ICONS.cards}</button>
        <button data-layout="list" aria-pressed="${layout==='list'}" aria-label="List">${VIEW_ICONS.list}</button>
      </span>` }) + `
      <div class="view" style="padding-left:0;padding-right:0">
        <div class="pad">
          <div class="field" style="margin-bottom:14px">
            <input id="q" type="text" placeholder="Search the library…" autocomplete="off">
          </div>
        </div>
        <div class="mrail">
          <button class="pill" data-c="all" aria-pressed="true">All</button>
          ${Exercises.MUSCLES.map(m => `<button class="pill" data-c="${m.id}"
            style="--mc:${m.c}" aria-pressed="false">${m.n}</button>`).join('')}
        </div>
        <div class="pad" id="covHost"></div>
        <div class="pad"><div id="exlist"></div></div>
      </div>
      <div class="screenfoot"><button class="fbtn cream" id="addBtn" disabled>Add exercises</button></div>`;

    const list = el.querySelector('#exlist');
    const addBtn = el.querySelector('#addBtn');

    function render(){
      /* a muscle filter matches whether it is the point of the lift or just along
         for the ride — searching "triceps" should find the bench press too */
      const rows = LIBRARY.filter(x =>
        (muscle === 'all' ||
         (x.pri || []).includes(muscle) || (x.sec || []).includes(muscle)) &&
        (!q || x.name.toLowerCase().includes(q) ||
         [...(x.pri||[]), ...(x.sec||[])].some(m => Exercises.label(m).toLowerCase().includes(q))));
      list.className = layout === 'cards' ? 'excards' : 'group';

      if(layout === 'cards'){
        list.innerHTML = rows.length ? rows.map(x => {
          const on = picked.includes(x.id);
          const primary = (x.pri || [])[0];
          const img = ART[x.id];
          return `<button class="excard${on ? ' on' : ''}" data-id="${x.id}"
            style="--mc:${Exercises.colour(primary)}">
            <span class="band${img ? ' hasart' : ''}">
              ${img ? `<img src="${img}" alt="">` : `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                  stroke-linecap="round" stroke-linejoin="round"><path d="${Exercises.glyph(primary)}"/></svg>`}
              <span class="eq">${x.eq}</span>
              <span class="tick">${U.ICON.check}</span>
              <span class="info" data-info="${x.id}">i</span>
            </span>
            <span class="meat">
              <b>${x.name}</b>
              <span class="mtags">
                ${(x.pri || []).map(m => `<span class="mtag" style="--mc:${Exercises.colour(m)}">${Exercises.label(m)}</span>`).join('')}
              </span>
              <span class="d">${startWeight(x)
                ? Units.fmt(startWeight(x), unit) + Units.label(unit).toLowerCase() + ' × ' : ''}${x.reps}</span>
            </span>
          </button>`;
        }).join('') : `<div class="empty" style="grid-column:1/-1;padding:40px 8px"><b>No matches</b>Try a different search or muscle.</div>`;

        paint();
        return;
      }

      list.innerHTML = rows.length ? rows.map(x => {
        const on = picked.includes(x.id);
        const primary = (x.pri || [])[0];
        const img = ART[x.id];
        return `<button class="row" data-id="${x.id}">
          ${img ? `<img class="thumb" src="${img}" alt="">`
                : `<span class="dot" style="width:9px;height:9px;border-radius:50%;flex:0 0 9px;
                     background:${Exercises.colour(primary)}"></span>`}
          <span class="lbl">${x.name}
            <small>${x.eq} · ${startWeight(x)
              ? Units.fmt(startWeight(x), unit) + Units.label(unit).toLowerCase() + ' × ' : ''}${x.reps} reps${
              LOADS[x.id] !== undefined ? ' · your load' : ' default'}</small>
            <span class="mtags">
              ${(x.pri || []).map(m => `<span class="mtag" style="--mc:${Exercises.colour(m)}">${Exercises.label(m)}</span>`).join('')}
              ${(x.sec || []).map(m => `<span class="mtag sec" style="--mc:${Exercises.colour(m)}">${Exercises.label(m)}</span>`).join('')}
            </span>
          </span>
          <span class="demo" data-info="${x.id}" style="width:26px;height:26px;border-radius:var(--r);
            border:1px solid var(--line);color:var(--dim);display:flex;align-items:center;justify-content:center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.7-.9 1.3v.5M12 16.5v.01"/></svg>
          </span>
          <span style="width:26px;height:26px;border-radius:var(--r);display:flex;align-items:center;justify-content:center;
            ${on ? 'background:var(--orange);color:#fff' : 'border:1px solid var(--line);color:var(--dim)'}">
            ${on ? U.ICON.check : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'}
          </span></button>`;
      }).join('') : `<div class="empty" style="padding:40px 8px"><b>No matches</b>Try a different search or category.</div>`;

      paint();
    }

    /* the coverage panel and the button say the same thing in both layouts */
    function paint(){
      const host = el.querySelector('#covHost');
      if(host){
        const chosen = LIBRARY.filter(x => picked.includes(x.id));
        const cov = Exercises.coverage(chosen);
        const top = cov.length ? cov[0].score : 1;
        host.innerHTML = chosen.length ? `
          <div class="cov">
            <p class="cap">What this hits</p>
            ${cov.map(m => `<div class="row" style="--mc:${m.c}">
              <span class="nm">${m.n}</span>
              <span class="bar"><i style="width:${Math.round((m.score / top) * 100)}%"></i></span>
              <span class="n">${m.score}</span>
            </div>`).join('')}
          </div>` : '';
      }
      addBtn.disabled = !picked.length;
      addBtn.textContent = picked.length
        ? `Add ${picked.length} exercise${picked.length === 1 ? '' : 's'}`
        : 'Add exercises';
    }

    el.querySelector('#q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });

    el.addEventListener('click', e => {
      const lay = e.target.closest('[data-layout]');
      if(lay){
        layout = lay.dataset.layout;
        Store.put('settings', layout, 'ex-layout');
        el.querySelectorAll('[data-layout]').forEach(b =>
          b.setAttribute('aria-pressed', String(b.dataset.layout === layout)));
        render(); return;
      }
      const c = e.target.closest('[data-c]');
      if(c){
        el.querySelectorAll('[data-c]').forEach(x => x.setAttribute('aria-pressed','false'));
        c.setAttribute('aria-pressed','true'); muscle = c.dataset.c; render(); return;
      }
      /* the info affordance opens the exercise rather than selecting it */
      const info = e.target.closest('[data-info]');
      if(info){
        e.stopPropagation();
        return Screens.push('exercise', { id: info.dataset.info, onChange: async () => {
          ART = await Exercises.artMap(LIBRARY.map(v => v.id));
          render();
        }});
      }

      const r = e.target.closest('[data-id]');
      if(r){
        const id = r.dataset.id;
        picked.includes(id) ? picked = picked.filter(x => x !== id) : picked.push(id);
        render(); return;
      }
      if(e.target.closest('#addBtn')){
        const chosen = picked.map(id => {
          const x = LIBRARY.find(l => l.id === id);
          const cardio = (x.pri || []).includes('cardio');
          const kg = startWeight(x);
          return { id:x.id, name:x.name, pri:x.pri || [], sec:x.sec || [], eq:x.eq,
                   rest: cardio ? 60 : 150,
                   sets:[{kg, reps:x.reps},{kg, reps:x.reps},{kg, reps:x.reps}] };
        });
        onPick(chosen);
        Screens.pop();
      }
    });

    render();
    setTimeout(() => { const f = el.querySelector('#q'); if(f) f.focus(); }, 200);
  }

  Screens.register('exercise-picker', mount);
})();
