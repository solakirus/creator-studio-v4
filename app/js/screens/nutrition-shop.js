/* Pantry and Grocery. Grocery is derived: the week's plan, merged, minus the pantry. */
(function(){
  const { ICON } = U;

  /* ---------- pantry ---------- */
  async function mountPantry(el){
    async function render(){
      const items = await Nutrition.pantry();
      const buckets = FoodGroups.bucket(items);
      const counted = items.filter(i => i.countedAt).length;

      el.innerHTML = Screens.bar({ kicker:'Nutrition', title:'Pantry',
        actions:`<button class="btn-sm" data-a="grocery">Grocery →</button>
                 <button class="btn-sm accent" data-a="add">+ Add</button>` }) + `
      <div class="view">
        ${items.length ? `<button class="btn-primary" data-a="count-all" style="width:100%;margin:0 0 6px">
            Take inventory · ${items.length} item${items.length===1?'':'s'}</button>
          <p class="note" style="text-align:left;margin:0 0 16px">
            Walks them one at a time, a cupboard at a time. ${
              counted ? `${counted} counted so far.` : 'Nothing counted yet.'}</p>` : ''}

        ${items.length ? buckets.map(g => `
          <div class="pg-head" style="--pg:${g.c}">
            <span class="dot"></span><b>${g.n}</b><i></i>
            <span class="n">${g.items.length}</span>
            <button class="btn-sm" data-count="${g.id}">Count</button>
          </div>
          <div class="group" style="margin:0">
            ${g.items.map(i => `<button class="row" data-edit="${i.id}">
              <span class="lbl">${i.name}${i.countedAt
                ? `<small>counted ${new Date(i.countedAt).toLocaleDateString(undefined,{ month:'short', day:'numeric' })}</small>`
                : ''}</span>
              <span style="color:${+i.qty ? 'var(--cream)' : 'var(--red)'};
                font-family:var(--display),sans-serif;font-weight:900;font-size:15px">
                ${+i.qty ? `${i.qty}${i.unit ? ' ' + i.unit : ''}` : 'none'}</span></button>`).join('')}
          </div>`).join('')
        : `<div class="block" style="text-align:center;padding:34px 18px">
            <b style="display:block;font-family:var(--display),sans-serif;font-weight:900;font-size:21px;margin:0 0 8px">The pantry is empty</b>
            <p style="margin:0;color:var(--muted);font-size:15px;line-height:1.5">Add what you already have and the grocery list stops telling you to buy it again.</p>
          </div>`}
        <p class="note">Anything the pantry lists is struck off the grocery list.
          An item counted at none stays on the list, so you know to buy it again.</p>
      </div>`;
    }

    function openForm(item){
      const i = item || { name:'', qty:'', unit:'', group:'' };
      App.sheet(`
        <h2>${item ? 'Edit item' : 'Add to pantry'}</h2>
        <div class="field"><label for="p-name">Item</label>
          <input id="p-name" type="text" value="${(i.name||'').replace(/"/g,'&quot;')}" placeholder="jasmine rice"></div>
        <div class="field"><label>Group</label>
          <div class="opts" data-group="foodgroup">
            ${FoodGroups.GROUPS.map(g => `<button type="button" class="opt" data-fg="${g.id}"
              aria-pressed="${(i.group || FoodGroups.guess(i.name)) === g.id}">${g.n}</button>`).join('')}
          </div>
          <p style="margin:9px 0 0;font-size:13px;color:var(--dim);line-height:1.5">
            Guessed from the name — change it if the guess is wrong.</p>
        </div>
        <div class="field"><label>How much</label>
          <div class="qrow">
            <span class="qty">
              <div class="qstep">
                <button type="button" data-q="-1" aria-label="Fewer">−</button>
                <input id="p-qty" type="number" inputmode="decimal" min="0" step="1" value="${+i.qty || 0}">
                <button type="button" data-q="1" aria-label="More">+</button>
              </div>
            </span>
            <span class="uni">${Shopping.unitSelect('id="p-unit" class="unit"',
              Shopping.normaliseStock(i.unit), 'stock')}</span>
          </div>
        </div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>${item ? 'Save' : 'Add item'}</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${item ? `<button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Remove from pantry</button>` : ''}`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          const q = e.target.closest('[data-q]');
          if(q){
            const input = sheetEl.querySelector('#p-qty');
            input.value = Math.max(0, (+input.value || 0) + (+q.dataset.q));
            return;
          }
          const opt = e.target.closest('.opt');
          if(opt){
            opt.closest('.opts').querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed','false'));
            opt.setAttribute('aria-pressed','true'); return;
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-delete]')){
            await Nutrition.remove('pantry', item.id); App.closeSheet(); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          const name = sheetEl.querySelector('#p-name').value.trim();
          if(!name) return U.toast('Name the item first');
          await Nutrition.save('pantry', {
            ...(item || {}), name,
            qty: +sheetEl.querySelector('#p-qty').value || 0,
            unit: sheetEl.querySelector('#p-unit').value,
            group: (sheetEl.querySelector('[data-group="foodgroup"] .opt[aria-pressed="true"]') || {})
                     .dataset?.fg || FoodGroups.guess(name)
          }, 'p');
          App.closeSheet(); render();
        });
        setTimeout(() => { const f = sheetEl.querySelector('#p-name'); if(f) f.focus(); }, 180);
      });
    }

    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]');
      if(a){
        if(a.dataset.a === 'add') return openForm(null);
        if(a.dataset.a === 'count-all')
          return Screens.push('inventory', { onChange: render });
        if(a.dataset.a === 'grocery') return Screens.push('grocery', { onChange:() => render() });
      }
      const ct = e.target.closest('[data-count]');
      if(ct){ e.stopPropagation();
        return Screens.push('inventory', { group: ct.dataset.count, onChange: render }); }
      const ed = e.target.closest('[data-edit]');
      if(ed){
        const items = await Nutrition.pantry();
        openForm(items.find(x => x.id === ed.dataset.edit));
      }
    });

    render();
  }

  /* ---------- grocery ---------- */
  async function mountGrocery(el, params){
    let wk = (params && params.week) || Nutrition.isoWeek();

    async function render(){
      const items = await Nutrition.groceryFor(wk);
      const range = Nutrition.weekRange(wk);
      const buyable = items.filter(i => !i.inPantry);
      const ticked = buyable.filter(i => i.checked).length;
      const pct = buyable.length ? Math.round(ticked / buyable.length * 100) : 0;

      el.innerHTML = Screens.bar({ kicker:'Nutrition', title:'Grocery list',
        actions:`<button class="btn-sm" data-a="pantry">Pantry</button>
                 <button class="btn-sm" data-a="planner">Planner →</button>` }) + `
      <div class="view">
        <div class="wkbar">
          <button data-a="prev">←</button>
          <div class="mid"><p class="k">${wk}</p><p class="r">${range.label}</p></div>
          <button data-a="next">→</button>
        </div>

        <div style="display:flex;align-items:center;gap:12px;margin:0 0 16px">
          <div class="track" style="flex:1;height:5px"><i style="width:${pct}%;background:var(--orange)"></i></div>
          <span style="font-family:var(--display),sans-serif;font-weight:900;font-size:16px">
            <span style="color:var(--orange)">${ticked}</span>
            <span style="color:var(--muted)"> / ${buyable.length}</span></span>
        </div>

        <div class="block" style="padding:12px">
          <div style="display:flex;gap:9px">
            <input id="g-name" type="text" placeholder="Something the plan does not cover"
              style="flex:1;height:46px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
              color:var(--cream);font-family:var(--body),sans-serif;font-size:15px;padding:0 11px;outline:none">
            <input id="g-qty" type="number" inputmode="decimal" min="0" placeholder="qty"
              style="width:78px;height:46px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
              color:var(--cream);font-family:var(--body),sans-serif;font-size:15px;padding:0 10px;outline:none">
            <button class="btn-sm accent" data-a="add" style="height:46px">Add</button>
          </div>
        </div>

        ${items.length ? `<div class="block" style="padding:0">
          ${items.map(i => `
            <div class="gitem${i.checked ? ' on' : ''}${i.inPantry ? ' have' : ''}" data-key="${i.key}">
              <span class="bx">${ICON.check}</span>
              <span class="nm">${i.name}</span>
              ${(() => {
                const L = Shopping.line(i);
                return `<span class="buyamt"><b>${L.buy}</b>${
                  L.converted ? `<span>recipe: ${L.recipe}</span>` : ''}${
                  L.note ? `<span>${L.note}</span>` : ''}</span>`;
              })()}
            </div>`).join('')}
        </div>`
        : `<div class="block" style="text-align:center;padding:36px 18px">
            <b style="display:block;font-family:var(--display),sans-serif;font-weight:900;font-size:21px;margin:0 0 8px">Nothing to buy</b>
            <p style="margin:0;color:var(--muted);font-size:15px;line-height:1.5">Plan some meals into this week and whatever they need turns up here.</p>
          </div>`}

        <p class="note">Ticks and hand-added items belong to this week alone, and survive any change to the planner. Struck-through lines are ones the pantry says you already have.</p>
      </div>`;
    }

    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]');
      if(a){
        if(a.dataset.a === 'prev'){ wk = Nutrition.shiftWeek(wk, -1); return render(); }
        if(a.dataset.a === 'next'){ wk = Nutrition.shiftWeek(wk,  1); return render(); }
        if(a.dataset.a === 'pantry')  return Screens.push('pantry', { onChange:() => render() });
        if(a.dataset.a === 'planner') return Screens.pop();
        if(a.dataset.a === 'add'){
          const name = el.querySelector('#g-name').value.trim();
          if(!name) return U.toast('Name the item first');
          await Nutrition.addGroceryExtra(wk, name,
            el.querySelector('#g-qty').value.trim(),
            (el.querySelector('#g-unit') || {}).value || '');
          return render();
        }
      }
      const it = e.target.closest('[data-key]');
      if(it){ await Nutrition.toggleGrocery(wk, it.dataset.key); render(); }
    });

    render();
  }

  Screens.register('pantry', mountPantry);
  Screens.register('grocery', mountGrocery);
})();
