/* Templates and the Weekly Planner. A template is one day; the planner is a week of them. */
(function(){
  const { SLOTS, DAYS } = Nutrition;
  const SLOT_LABEL = { breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner', snacks:'Snacks' };
  /* Which meal categories may fill which slot. */
  const SLOT_CATS = {
    breakfast:['Breakfast'],
    lunch:['Lunch','Entrees','Sides'],
    dinner:['Dinner','Entrees','Sides'],
    snacks:['Snacks','Dessert','Drink']
  };
  const fits = (meal, slot) => (SLOT_CATS[slot] || []).includes(meal.category);

  /* ---------- templates ---------- */
  async function mountTemplates(el){
    let editing = null, showForm = false;

    async function render(){
      const [tpls, meals] = await Promise.all([Nutrition.templates(), Nutrition.meals()]);
      const byId = Object.fromEntries(meals.map(m => [m.id, m]));
      const opts = (sel, slot) => {
        const rows = meals.filter(m => fits(m, slot));
        if(!rows.length) return `<option value="">— no ${SLOT_LABEL[slot].toLowerCase()} meals saved —</option>`;
        return `<option value="">— none —</option>` +
          rows.map(m => `<option value="${m.id}"${sel===m.id?' selected':''}>${m.title}</option>`).join('');
      };
      const t = editing || {};

      el.innerHTML = Screens.bar({ kicker:'Nutrition', title:'Templates',
        actions:`<button class="btn-sm accent" data-a="new">+ New template</button>` }) + `
      <div class="view">
        ${showForm ? `
        <div class="block">
          <h4>Template name</h4>
          <div class="field" style="margin-bottom:14px">
            <input id="t-name" type="text" value="${(t.name||'').replace(/"/g,'&quot;')}" placeholder="e.g. Cutting Day">
          </div>
          ${SLOTS.map(s => `
            <h4 class="slotlab">${SLOT_LABEL[s]}</h4>
            <div class="field" style="margin:0">
              <select id="t-${s}">${opts(t[s], s)}</select>
            </div>`).join('')}
          <div class="sheetcta">
            <button class="btn-ghost" data-a="cancel" style="flex:1">Cancel</button>
            <button class="btn-primary" data-a="save" style="flex:1.3">${editing && editing.id ? 'Save template' : 'Create template'}</button>
          </div>
        </div>` : ''}

        ${tpls.length ? tpls.map(x => `
          <div class="block" data-edit="${x.id}" style="cursor:pointer">
            <h4 style="color:var(--cream);font-size:17px;letter-spacing:-.01em;text-transform:none;margin-bottom:10px">${x.name}</h4>
            ${SLOTS.map(s => `<div class="ingrow"><span style="color:var(--muted);font-size:13px;
              letter-spacing:.1em;text-transform:uppercase;font-family:var(--display),sans-serif;
              font-weight:900;min-width:92px">${SLOT_LABEL[s]}</span>
              <span class="q" style="margin-left:auto;color:var(--cream);font-family:var(--body),sans-serif;font-size:14.5px">
                ${x[s] && byId[x[s]] ? byId[x[s]].title : '—'}</span></div>`).join('')}
          </div>`).join('')
        : `<div class="empty"><b>No templates yet</b>A template is one day of meals you can drop into the planner whenever.</div>`}
        <p class="note">Built once and reused — a template belongs to no particular week.</p>
      </div>`;
    }

    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]');
      if(a){
        if(a.dataset.a === 'new'){ editing = {}; showForm = true; return render(); }
        if(a.dataset.a === 'cancel'){ editing = null; showForm = false; return render(); }
        if(a.dataset.a === 'save'){
          const name = el.querySelector('#t-name').value.trim();
          if(!name) return U.toast('Give the template a name');
          const rec = { ...(editing || {}), name };
          SLOTS.forEach(s => rec[s] = el.querySelector('#t-' + s).value || null);
          await Nutrition.save('templates', rec, 't');
          editing = null; showForm = false; return render();
        }
      }
      const ed = e.target.closest('[data-edit]');
      if(ed){
        const tpls = await Nutrition.templates();
        editing = tpls.find(x => x.id === ed.dataset.edit);
        showForm = true; render();
      }
    });

    render();
  }

  /* ---------- weekly planner ---------- */
  async function mountPlanner(el){
    let wk = Nutrition.isoWeek();

    async function render(){
      const [rec, meals, tpls] = await Promise.all([
        Nutrition.week(wk), Nutrition.meals(), Nutrition.templates()
      ]);
      const byId = Object.fromEntries(meals.map(m => [m.id, m]));
      const range = Nutrition.weekRange(wk);
      const filled = Object.keys(rec.slots || {}).length;

      el.innerHTML = Screens.bar({ kicker:'Nutrition', title:'Weekly planner',
        actions:`<button class="btn-sm" data-a="grocery">Grocery →</button>` }) + `
      <div class="view">
        <div class="wkbar">
          <button data-a="prev">←</button>
          <div class="mid"><p class="k">${wk}</p><p class="r">${range.label}</p></div>
          <button data-a="next">→</button>
        </div>

        <div class="plangrid">
          <div class="planrow planhead">
            <span></span>${SLOTS.map(s => `<span>${SLOT_LABEL[s]}</span>`).join('')}
          </div>
          ${DAYS.map(d => `
            <div class="planrow">
              <button class="daylab" data-day="${d}">${d.toUpperCase()}<small>⊞</small></button>
              ${SLOTS.map(s => {
                const id = rec.slots[`${d}-${s}`], meal = id && byId[id];
                return `<button class="cell${meal ? '' : ' empty'}" data-cell="${d}-${s}">${meal ? meal.title : '+'}</button>`;
              }).join('')}
            </div>`).join('')}
        </div>

        <p class="note">${filled} of 28 slots filled. Tap a cell for one meal, or a day name to drop in a whole template.</p>
      </div>`;
    }

    async function pickMeal(day, slot){
      const [meals, rec] = await Promise.all([Nutrition.meals(), Nutrition.week(wk)]);
      const current = rec.slots[`${day}-${slot}`];
      const rows = meals.filter(m => fits(m, slot));
      App.sheet(`
        <h2>${day.toUpperCase()} · ${SLOT_LABEL[slot]}</h2>
        ${rows.length ? '' : `<p style="color:var(--muted);margin:0 0 16px;font-size:15px;line-height:1.55">
          Nothing saved under ${SLOT_CATS[slot].join(', ')} yet. Save a meal in one of those categories and it shows up here.</p>`}
        <div class="group compact" style="margin:0">
          ${rows.map(m => `<button class="row" data-pick="${m.id}">
            <span class="lbl">${m.title}<small>${m.category || ''}</small></span>
            ${current === m.id ? `<span style="color:var(--orange)">${U.ICON.check}</span>` : U.ICON.chevR}
          </button>`).join('')}
        </div>
        <div class="sheetcta">
          <button class="btn-ghost" data-clear style="flex:1">Clear slot</button>
          <button class="btn-ghost" data-cancel style="flex:1">Cancel</button>
        </div>`, sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-clear]')){
            await Nutrition.setSlot(wk, day, slot, null); App.closeSheet(); return render();
          }
          const p = e.target.closest('[data-pick]');
          if(!p) return;
          await Nutrition.setSlot(wk, day, slot, p.dataset.pick);
          App.closeSheet(); render();
        });
      });
    }

    async function pickTemplate(day){
      const tpls = await Nutrition.templates();
      if(!tpls.length) return U.toast('No templates yet — build one first');
      App.sheet(`
        <h2>Fill ${day.toUpperCase()}</h2>
        <div class="group compact" style="margin:0">
          ${tpls.map(t => `<button class="row" data-tpl="${t.id}">
            <span class="lbl">${t.name}<small>${SLOTS.filter(s => t[s]).length} of 4 slots</small></span>
            ${U.ICON.chevR}</button>`).join('')}
        </div>
        <div class="sheetcta"><button class="btn-ghost" data-cancel style="flex:1">Cancel</button></div>`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          const t = e.target.closest('[data-tpl]');
          if(!t) return;
          await Nutrition.applyTemplate(wk, day, t.dataset.tpl);
          App.closeSheet(); render();
        });
      });
    }

    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if(a){
        if(a.dataset.a === 'prev'){ wk = Nutrition.shiftWeek(wk, -1); return render(); }
        if(a.dataset.a === 'next'){ wk = Nutrition.shiftWeek(wk,  1); return render(); }
        if(a.dataset.a === 'grocery') return Screens.push('grocery', { week:wk });
      }
      const c = e.target.closest('[data-cell]');
      if(c){ const [d,s] = c.dataset.cell.split('-'); return pickMeal(d, s); }
      const d = e.target.closest('[data-day]');
      if(d) pickTemplate(d.dataset.day);
    });

    render();
  }

  Screens.register('templates', mountTemplates);
  Screens.register('planner', mountPlanner);
})();
