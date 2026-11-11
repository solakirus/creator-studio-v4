/* The library as a thing you own: add your own lifts, retag the built-ins,
   hide the ones you will never do. */
(function(){
  const { ICON } = U;

  async function mount(el, params){
    let q = '', muscle = 'all', list = [], layout = 'cards';

    const VIEW_ICONS = {
      cards:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>',
      list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
    };

    let ART = {};
    async function load(){
      Exercises.invalidate();
      list = await Exercises.all();
      ART = await Exercises.artMap(list.map(x => x.id));
      layout = (await Store.get('settings','ex-layout')) || 'cards';
    }

    function render(){
      const rows = list.filter(x =>
        (muscle === 'all' || (x.pri || []).includes(muscle) || (x.sec || []).includes(muscle)) &&
        (!q || x.name.toLowerCase().includes(q)));

      const mine = list.filter(x => !x.builtIn).length;

      el.innerHTML = Screens.bar({ kicker:'Workout', title:'Exercise library',
        actions:`<span class="vtoggle" style="margin-right:8px">
            <button data-layout="cards" aria-pressed="${layout==='cards'}" aria-label="Cards">${VIEW_ICONS.cards}</button>
            <button data-layout="list" aria-pressed="${layout==='list'}" aria-label="List">${VIEW_ICONS.list}</button>
          </span>
          <button class="btn-sm accent" data-a="new">+ New</button>` }) + `
      <div class="view" style="padding-left:0;padding-right:0">
        <div class="pad">
          <div class="field" style="margin-bottom:12px">
            <input id="q" type="text" placeholder="Search…" autocomplete="off" value="${q}">
          </div>
        </div>
        <div class="mrail">
          <button class="pill" data-c="all" aria-pressed="${muscle==='all'}">All</button>
          ${Exercises.MUSCLES.map(m => `<button class="pill" data-c="${m.id}"
            style="--mc:${m.c}" aria-pressed="${muscle===m.id}">${m.n}</button>`).join('')}
        </div>
        <div class="pad">
          <div class="${layout === 'cards' ? 'excards' : 'group'}" style="margin:0">
            ${!rows.length
              ? `<div class="empty" style="grid-column:1/-1;padding:38px 8px"><b>Nothing here</b>Try another muscle or search.</div>`
            : layout === 'cards'
              ? rows.map(x => {
                  const primary = (x.pri || [])[0];
                  const img = ART[x.id];
                  return `<button class="excard" data-open="${x.id}"
                    style="--mc:${Exercises.colour(primary)}">
                    <span class="band${img ? ' hasart' : ''}">
                      ${img ? `<img src="${img}" alt="">` : `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                          stroke-linecap="round" stroke-linejoin="round"><path d="${Exercises.glyph(primary)}"/></svg>`}
                      <span class="eq">${x.eq}</span>
                      <span class="info" data-edit="${x.id}">✎</span>
                    </span>
                    <span class="meat">
                      <b>${x.name}</b>
                      <span class="mtags">
                        ${(x.pri||[]).map(m => `<span class="mtag" style="--mc:${Exercises.colour(m)}">${Exercises.label(m)}</span>`).join('')}
                      </span>
                      <span class="d">${x.builtIn ? `${x.reps} reps default` : 'yours'}</span>
                    </span>
                  </button>`;
                }).join('')
              : rows.map(x => `<button class="row" data-open="${x.id}">
              ${ART[x.id] ? `<img class="thumb" src="${ART[x.id]}" alt="">`
                : `<span class="dot" style="width:9px;height:9px;border-radius:50%;flex:0 0 9px;
                     background:${Exercises.colour((x.pri||[])[0])}"></span>`}
              <span class="lbl">${x.name}
                <small>${x.eq}${x.builtIn ? '' : ' · yours'}</small>
                <span class="mtags">
                  ${(x.pri||[]).map(m => `<span class="mtag" style="--mc:${Exercises.colour(m)}">${Exercises.label(m)}</span>`).join('')}
                  ${(x.sec||[]).map(m => `<span class="mtag sec" style="--mc:${Exercises.colour(m)}">${Exercises.label(m)}</span>`).join('')}
                </span>
              </span>
              <span class="demo" data-edit="${x.id}" style="width:28px;height:28px;border-radius:var(--r);
                border:1px solid var(--line);color:var(--dim);display:flex;align-items:center;
                justify-content:center;font-size:13px">✎</span>
              ${ICON.chevR}</button>`).join('')}
          </div>
          <p class="note">${list.length} exercise${list.length===1?'':'s'}${
            mine ? ` · ${mine} of them yours` : ''}. Hidden built-ins can be brought back below.</p>
          <button class="btn-ghost" data-a="restore" style="width:100%">Restore hidden built-ins</button>
        </div>
      </div>`;
    }

    function openForm(x){
      const r = x || { name:'', pri:[], sec:[], eq:'barbell', kg:0, reps:8 };
      const pick = (field, chosen) => Exercises.MUSCLES.map(m => `
        <button type="button" class="opt" data-${field}="${m.id}"
          style="--mc:${m.c}" aria-pressed="${chosen.includes(m.id)}">${m.n}</button>`).join('');

      App.sheet(`
        <h2>${x ? x.name : 'New exercise'}</h2>
        <div class="field"><label for="x-name">Name</label>
          <input id="x-name" type="text" value="${(r.name||'').replace(/"/g,'&quot;')}"
            placeholder="Incline dumbbell press"></div>

        <div class="field"><label>Works — primary</label>
          <div class="opts" data-group="pri">${pick('pri', r.pri || [])}</div>
          <p style="margin:9px 0 0;font-size:13px;color:var(--dim);line-height:1.5">
            What the lift is for. Counts double toward coverage.</p>
        </div>

        <div class="field"><label>Also works</label>
          <div class="opts" data-group="sec">${pick('sec', r.sec || [])}</div>
        </div>

        <div class="field"><label>Equipment</label>
          <div class="opts" data-group="eq">
            ${Exercises.EQUIPMENT.map(e => `<button type="button" class="opt" data-eq="${e}"
              aria-pressed="${r.eq===e}">${e}</button>`).join('')}
          </div>
        </div>

        <div class="field" style="display:flex;gap:10px">
          <span style="flex:1"><label for="x-kg">Default weight (kg)</label>
            <input id="x-kg" type="number" min="0" step="2.5" value="${r.kg || 0}"></span>
          <span style="flex:1"><label for="x-reps">Default reps</label>
            <input id="x-reps" type="number" min="1" value="${r.reps || 8}"></span>
        </div>

        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${x ? `<button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);
          border-color:rgba(226,86,74,.4)">${x.builtIn ? 'Hide this one' : 'Delete'}</button>` : ''}`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          /* muscles multi-select; equipment is one only */
          const pri = e.target.closest('[data-pri]');
          const sec = e.target.closest('[data-sec]');
          if(pri || sec){
            const b = pri || sec;
            b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
            return;
          }
          const eq = e.target.closest('[data-eq]');
          if(eq){
            sheetEl.querySelectorAll('[data-eq]').forEach(o => o.setAttribute('aria-pressed','false'));
            eq.setAttribute('aria-pressed','true');
            return;
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-delete]')){
            await Exercises.remove(r.id);
            App.closeSheet(); await load(); return render();
          }
          if(!e.target.closest('[data-save]')) return;

          const name = sheetEl.querySelector('#x-name').value.trim();
          if(!name) return U.toast('Name it first');
          const grab = f => [...sheetEl.querySelectorAll(`[data-${f}][aria-pressed="true"]`)]
            .map(b => b.dataset[f]);
          const priList = grab('pri');
          if(!priList.length) return U.toast('Pick at least one primary muscle');

          await Exercises.save({
            id: r.id, name, pri: priList, sec: grab('sec').filter(m => !priList.includes(m)),
            eq: (sheetEl.querySelector('[data-eq][aria-pressed="true"]') || {}).dataset?.eq || 'other',
            kg: +sheetEl.querySelector('#x-kg').value || 0,
            reps: +sheetEl.querySelector('#x-reps').value || 8
          });
          App.closeSheet(); await load(); render();
        });
        setTimeout(() => { const f = sheetEl.querySelector('#x-name'); if(f) f.focus(); }, 180);
      });
    }

    el.addEventListener('input', e => {
      if(e.target.id === 'q'){ q = e.target.value.trim().toLowerCase(); render();
        const i = el.querySelector('#q'); if(i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
    });

    el.addEventListener('click', async e => {
      const lay = e.target.closest('[data-layout]');
      if(lay){
        layout = lay.dataset.layout;
        await Store.put('settings', layout, 'ex-layout');
        return render();
      }
      const c = e.target.closest('[data-c]');
      if(c){ muscle = c.dataset.c; return render(); }
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'new') return openForm(null);
      if(a && a.dataset.a === 'restore'){
        await Exercises.restoreAll();
        await load(); U.toast('Built-ins restored'); return render();
      }
      const ed = e.target.closest('[data-edit]');
      if(ed){ e.stopPropagation(); return openForm(list.find(x => x.id === ed.dataset.edit)); }
      const op = e.target.closest('[data-open]');
      if(op) return Screens.push('exercise', { id: op.dataset.open,
        onChange: async () => { await load(); render(); } });
    });

    await load();
    render();
    if(params && params.editId){
      const hit = list.find(x => x.id === params.editId);
      if(hit) setTimeout(() => openForm(hit), 200);
    }
  }

  Screens.register('exercise-library', mount);
})();
