/* Taking stock, one item at a time.

   A long editable list is a thing you avoid; a single question with a big number
   pad is a thing you finish. This walks whatever you pick — one group, or the lot —
   and writes the counts back as you go. */
(function(){

  async function mount(el, params){
    const only = params && params.group;      /* one group, or every group */
    let queue = [], at = 0, value = 0, finished = false;

    async function load(){
      const pantry = await Nutrition.pantry();
      const list = only ? pantry.filter(p => FoodGroups.of(p) === only) : pantry;
      /* walk group by group, so the mind stays in one cupboard at a time */
      queue = FoodGroups.bucket(list).flatMap(g =>
        g.items.map(item => ({ item, group:g })));
      at = 0;
      value = current();
    }

    const current = () => {
      const e = queue[at];
      return e ? Math.max(0, +e.item.qty || 0) : 0;
    };

    function render(){
      const host = document.getElementById('inventory');
      if(!host) return;

      if(finished || !queue.length){
        host.innerHTML = `
          <div class="inv-mid">
            <div class="inv-done">
              ${queue.length ? `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                <h2>Counted</h2>
                <p>${queue.length} item${queue.length===1?'':'s'} updated. The grocery list has already
                  taken what you have into account.</p>`
              : `<h2>Nothing to count</h2>
                 <p>Add a few things to the pantry first, then run the inventory to keep them honest.</p>`}
              <button class="btn-primary" data-close style="width:100%">Done</button>
            </div>
          </div>`;
        host.classList.add('on');
        return;
      }

      const e = queue[at];
      const g = e.group;
      const was = +e.item.qty || 0;

      host.style.setProperty('--pg', g.c);
      host.innerHTML = `
        <div class="inv-top">
          <div class="inv-bar"><i style="width:${Math.round((at / queue.length) * 100)}%"></i></div>
          <div class="inv-meta">
            <span class="inv-grp">${g.n}</span>
            <span class="inv-count">${at + 1} of ${queue.length}</span>
          </div>
        </div>

        <div class="inv-mid">
          <p class="inv-q">How many do you have?</p>
          <p class="inv-name">${e.item.name}</p>
          <p class="inv-was">${was ? `Last counted at ${was}${e.item.unit ? ' ' + e.item.unit : ''}`
                                   : 'Never counted'}</p>

          <div class="inv-num">
            <button data-step="-1" aria-label="One fewer">−</button>
            <input type="number" inputmode="numeric" min="0" value="${value}" data-val>
            <button data-step="1" aria-label="One more">+</button>
          </div>
          <div style="width:100%;max-width:250px;margin:0 0 22px">
            ${Shopping.unitSelect('class="unit" data-unit',
              Shopping.normaliseStock(e.item.unit), 'stock')}
          </div>

          <div class="inv-quick">
            <button class="none" data-set="0">None left</button>
            <button data-set="1">1</button>
            <button data-set="2">2</button>
            <button data-set="5">5</button>
            <button data-set="10">10</button>
          </div>
        </div>

        <div class="inv-bot">
          <button class="skip" data-skip>Skip</button>
          <button class="next" data-next>${at === queue.length - 1 ? 'Finish' : 'Next'}</button>
        </div>`;
      host.classList.add('on');
    }

    async function commit(){
      const e = queue[at];
      if(!e) return;
      const n = Math.max(0, +value || 0);
      const host = document.getElementById('inventory');
      const sel = host && host.querySelector('[data-unit]');
      await Nutrition.save('pantry', {
        ...e.item, qty:n,
        unit: sel ? sel.value : e.item.unit,
        countedAt: Date.now()
      });
    }

    async function advance(save){
      if(save) await commit();
      if(at >= queue.length - 1){
        finished = true;
        Nutrition.invalidate('pantry');
        params && params.onChange && params.onChange();
        return render();
      }
      at++;
      value = current();
      render();
    }

    function close(){
      const host = document.getElementById('inventory');
      if(host){ host.classList.remove('on'); setTimeout(() => { host.innerHTML = ''; }, 260); }
      params && params.onChange && params.onChange();
      Screens.pop();
    }

    /* the walk lives in its own full-screen layer, so the screen behind it is just a shell */
    el.innerHTML = '';
    const host = document.getElementById('inventory');
    host.onclick = async ev => {
      if(ev.target.closest('[data-close]')) return close();

      const step = ev.target.closest('[data-step]');
      if(step){
        value = Math.max(0, value + (+step.dataset.step));
        const input = host.querySelector('[data-val]');
        if(input) input.value = value;
        return;
      }
      const set = ev.target.closest('[data-set]');
      if(set){
        value = +set.dataset.set;
        const input = host.querySelector('[data-val]');
        if(input) input.value = value;
        return;
      }
      if(ev.target.closest('[data-skip]')) return advance(false);
      if(ev.target.closest('[data-next]')) return advance(true);
    };
    host.oninput = ev => {
      if(ev.target.matches('[data-val]')) value = Math.max(0, +ev.target.value || 0);
    };

    await load();
    render();
  }

  Screens.register('inventory', mount);
})();
