/* The nutrition console. Three tabs across the bottom, the same shape as the
   workout one — and the things you check rather than edit (the week, the list,
   the pantry) fold open on the front page instead of hiding behind a tile. */
(function(){

  const I = {
    meals:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v8a3 3 0 0 0 6 0V3M9 11v10M17 3c-1.5 2-2 4-2 6s.5 3 2 3 2-1 2-3-.5-4-2-6zM17 12v9"/></svg>',
    prep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13a8 8 0 0 1 16 0z"/><path d="M2 17h20M12 5V3"/></svg>',
    templ:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></svg>',
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11h10.2L21 7H6"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></svg>',
    pantry:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 12h16M10 7.5h1M10 16.5h1"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  };
  const CHEV = '<svg class="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  const NAV = [
    { v:'dash',  label:'Dashboard', d:'M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z' },
    { v:'meals', label:'Meals',     d:'M6 3v8a3 3 0 0 0 6 0V3M9 11v10M17 3c-1.5 2-2 4-2 6s.5 3 2 3 2-1 2-3-.5-4-2-6zM17 12v9' },
    { v:'prep',  label:'Prep',      d:'M4 13a8 8 0 0 1 16 0zM2 17h20M12 5V3' }
  ];

  const SLOTS = ['breakfast','lunch','dinner','snacks'];
  const DAYS  = ['sun','mon','tue','wed','thu','fri','sat'];
  const DAY_LABEL = { mon:'Monday', tue:'Tuesday', wed:'Wednesday', thu:'Thursday',
                      fri:'Friday', sat:'Saturday', sun:'Sunday' };

  async function mount(el, params){
    let view = 'dash', root = el;
    let meals = [], tpl = [], pantry = [], prep = [], groc = [], week = null, wk = null;

    async function load(){
      wk = Nutrition.isoWeek();
      [meals, tpl, pantry, prep, groc, week] = await Promise.all([
        Nutrition.meals(), Nutrition.templates(), Nutrition.pantry(),
        Nutrition.prep(), Nutrition.groceryFor(wk), Nutrition.week(wk)
      ]);
    }

    /* ---- the three folds: what you check rather than edit ---- */
    function planFold(){
      const slots = week.slots || {};
      const filled = Object.keys(slots).length;
      /* one line per day, listing what is in it */
      const byDay = {};
      Object.entries(slots).forEach(([key, id]) => {
        /* keys are written as `mon-breakfast` */
        const cut = key.indexOf('-');
        const d = cut < 0 ? key : key.slice(0, cut);
        const slot = cut < 0 ? '' : key.slice(cut + 1);
        const meal = meals.find(m => m.id === id);
        (byDay[d] = byDay[d] || []).push({ slot, title: meal ? meal.title : 'Something' });
      });
      /* keep the slots in eating order, not the order they were planned in */
      Object.values(byDay).forEach(list =>
        list.sort((a,b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot)));
      const days = Object.keys(byDay).sort((a,b) => DAYS.indexOf(a) - DAYS.indexOf(b));

      /* real dates, so the week reads like a calendar rather than a list of names */
      const { sunday, label } = Nutrition.weekRange(wk);
      const today = new Date(); today.setHours(0,0,0,0);

      const cards = DAYS.map((d, i) => {
        const date = new Date(sunday);
        date.setDate(sunday.getDate() + i);
        date.setHours(0,0,0,0);
        const isToday = date.getTime() === today.getTime();
        const past = date < today;
        const list = byDay[d] || [];

        return `<div class="wk-day${isToday ? ' today' : past ? ' past' : ''}" data-day="${d}">
          <div class="wk-dh">
            <b>${d}</b>
            <span>${date.getDate()}</span>
          </div>
          ${list.length ? list.map(x => `<div class="wk-meal">
            <span class="s">${x.slot}</span>
            <span class="t">${x.title}</span>
          </div>`).join('')
          : `<p class="wk-none">Nothing planned</p>`}
          ${isToday ? `<span class="wk-tag">Today</span>` : ''}
        </div>`;
      }).join('');

      return `<details class="nu-fold" style="--nu:#3F6FA0"${filled ? ' open' : ''}>
        <summary>
          <span class="ic">${I.plan}</span>
          <span class="tx"><b>This week</b><span>${label} · ${filled} of 28 slots</span></span>
          ${CHEV}
        </summary>
        <div class="nu-body">
          <div class="wk-rail" id="wkRail">${cards}</div>
          <button class="nu-more" data-go="planner">Open the weekly planner</button>
        </div>
      </details>`;
    }

    function groceryFold(){
      const toBuy = groc.filter(g => !g.inPantry && !g.checked);
      const got = groc.filter(g => g.checked || g.inPantry);
      const show = toBuy.slice(0, 8);

      return `<details class="nu-fold" style="--nu:#4B8A57"${toBuy.length ? ' open' : ''}>
        <summary>
          <span class="ic">${I.cart}</span>
          <span class="tx"><b>Grocery list</b><span>${
            toBuy.length ? `${toBuy.length} to buy` : 'Nothing to buy'}${
            got.length ? ` · ${got.length} covered` : ''}</span></span>
          ${CHEV}
        </summary>
        <div class="nu-body">
          ${show.length ? show.map(g => {
            const L = Shopping.line(g);
            return `<div class="nu-line">
              <span class="t">${g.name}</span>
              <span class="q">${L.buy}</span>
            </div>`;
          }).join('')
          : `<p class="nu-empty">Clear. Plan some meals and anything the pantry cannot cover
             turns up here.</p>`}
          ${toBuy.length > 8 ? `<p class="nu-empty" style="padding:10px 0 0">
            + ${toBuy.length - 8} more</p>` : ''}
          <button class="nu-more" data-go="grocery">Open the full list</button>
        </div>
      </details>`;
    }

    function pantryFold(){
      const show = pantry.slice(0, 8);
      return `<details class="nu-fold" style="--nu:#C18A2E">
        <summary>
          <span class="ic">${I.pantry}</span>
          <span class="tx"><b>Pantry</b><span>${
            pantry.length ? `${pantry.length} item${pantry.length===1?'':'s'} in stock` : 'Nothing in it'}</span></span>
          ${CHEV}
        </summary>
        <div class="nu-body">
          ${show.length ? show.map(p => `<div class="nu-line">
            <span class="t">${p.name}</span>
            ${p.qty ? `<span class="q">${p.qty}${p.unit ? ' ' + p.unit : ''}</span>` : ''}
          </div>`).join('')
          : `<p class="nu-empty">Tell it what you already have and the grocery list stops
             asking you to buy it again.</p>`}
          ${pantry.length > 8 ? `<p class="nu-empty" style="padding:10px 0 0">
            + ${pantry.length - 8} more</p>` : ''}
          <button class="nu-more" data-go="pantry">Open the pantry</button>
          ${pantry.length ? `<button class="nu-more" data-inv style="margin-top:8px;
            color:var(--orange);border-color:rgba(251,105,0,.4)">Take inventory</button>` : ''}
        </div>
      </details>`;
    }


    /* ---- the tabs ---- */
    function dashHTML(){
      const filled = Object.keys(week.slots || {}).length;
      const toBuy = groc.filter(g => !g.inPantry && !g.checked).length;
      const toCook = prep.filter(p => !p.cooked).length;

      return `
        <div class="hero" style="margin-bottom:14px">
          <p class="k">This week</p>
          <p class="v">${filled}<span> / 28 planned</span></p>
          <p class="s">${toBuy ? `${toBuy} still to buy` : 'Grocery list is clear'}${
            toCook ? ` · ${toCook} prep session${toCook===1?'':'s'} waiting` : ''}</p>
        </div>

        ${planFold()}
        ${groceryFold()}
        ${pantryFold()}

        <p class="note">Everything here is a read at a glance. Tap through to any of them to make changes.</p>`;
    }

    function mealsHTML(){
      return `
        <div class="hero" style="margin-bottom:14px">
          <p class="k">Saved meals</p>
          <p class="v">${meals.length}</p>
          <p class="s">Meals are the base unit. Templates bundle them into a day you can reuse.</p>
        </div>

        <div class="sec"><h2>Saved meals</h2><div class="rule"></div>
          <span class="alt">${meals.length}</span></div>
        ${meals.length ? `<div class="ctiles">
          ${meals.slice(0, 6).map(m => `<button class="ctile on" data-meal="${m.id}"
            style="--t-a:#4B8A57;--t-b:#234A2A">
            <span class="art3">${I.meals}</span>
            <span class="strip"><b>${m.title}</b><span>${
              m.kcal ? `${m.kcal} kcal` : (m.slot || 'any time')}</span></span>
          </button>`).join('')}
        </div>
        ${meals.length > 6 ? `<button class="nu-more" data-go="meals">See all ${meals.length}</button>` : ''}`
        : `<div class="empty"><b>No meals yet</b>Meals are the base unit — everything else builds on them.</div>`}
        <button class="btn-primary" data-go="meals" style="width:100%;margin-top:12px">
          ${meals.length ? 'Manage meals' : 'Add your first meal'}</button>

        <div class="sec" style="margin-top:22px"><h2>Templates</h2><div class="rule"></div>
          <span class="alt">${tpl.length}</span></div>
        ${tpl.length ? `<div class="ctiles">
          ${tpl.map(t => `<button class="ctile on" data-go="templates"
            style="--t-a:#7B4FA8;--t-b:#3E2560">
            <span class="art3">${I.templ}</span>
            <span class="strip"><b>${t.name}</b><span>${
              SLOTS.filter(s2 => t.slots && t.slots[s2]).length} meals</span></span>
          </button>`).join('')}
        </div>`
        : `<div class="empty"><b>No templates yet</b>
            Build a day you would happily repeat, save it, and drop it into the planner in one tap.</div>`}
        <button class="btn-ghost" data-go="templates" style="width:100%;margin-top:12px">
          ${tpl.length ? 'Manage templates' : 'Build a template'}</button>`;
    }

    function prepHTML(){
      const todo = prep.filter(p => !p.cooked);
      const done = prep.filter(p => p.cooked);

      /* portions left is what was made minus what has been eaten */
      const portions = done.reduce((a, s2) =>
        a + (s2.mealIds || []).reduce((n, id) =>
          n + Math.max(0, Nutrition.batchesOf(s2, id) - ((s2.used || {})[id] || 0)), 0), 0);

      /* against what the rest of the week still expects */
      const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];
      const { sunday } = Nutrition.weekRange(wk);
      const today = new Date(); today.setHours(0,0,0,0);
      const dayIdx = Math.max(0, Math.round((today - sunday) / 86400000));
      const stillPlanned = Object.keys(week.slots || {}).filter(k =>
        DAY_KEYS.indexOf(k.slice(0, k.indexOf('-'))) >= dayIdx).length;
      const short = Math.max(0, stillPlanned - portions);

      return `
        <div class="hero" style="margin-bottom:14px">
          <p class="k">In the fridge</p>
          <p class="v">${portions}<span> portion${portions===1?'':'s'}</span></p>
          <p class="s">${
            !stillPlanned ? 'Nothing left planned this week'
            : short ? `${short} short of the ${stillPlanned} meals still planned`
                    : `Covers all ${stillPlanned} meals still planned`}${
            todo.length ? ` · ${todo.length} session${todo.length===1?'':'s'} to cook` : ''}</p>
        </div>

        ${todo.length ? `<div class="sec"><h2>To cook</h2><div class="rule"></div></div>
          <div class="group" style="margin:0 0 16px">
            ${todo.map(p => `<button class="row" data-go="prep">
              <span class="lbl">${p.name || 'Prep session'}
                <small>${p.portions || 0} portions${p.day ? ` · ${p.day}` : ''}</small></span>
            </button>`).join('')}
          </div>` : ''}

        ${done.length ? `<div class="sec"><h2>Cooked</h2><div class="rule"></div>
            <span class="alt">${done.length}</span></div>
          <div class="group" style="margin:0">
            ${done.slice(0, 6).map(p => `<button class="row" data-go="prep">
              <span class="lbl">${p.name || 'Prep session'}
                <small>${p.portions || 0} portions ready</small></span>
            </button>`).join('')}
          </div>` : ''}

        ${!prep.length ? `<div class="empty"><b>Nothing prepped</b>
          Cook once, eat four times. Prep sessions turn into portions you can pull from all week.</div>` : ''}

        <button class="btn-primary" data-go="prep" style="width:100%;margin-top:14px">Open meal prep</button>`;
    }


    function render(){
      const titles = { dash:'Nutrition', meals:'Meals', prep:'Meal prep' };
      const body = view === 'dash'  ? dashHTML()
                 : view === 'meals' ? mealsHTML()
                 : prepHTML();

      root.innerHTML =
        Screens.bar({ kicker:'Creator studio', title:titles[view] }) +
        `<div class="view">${body}</div>
         <nav class="console-nav">${NAV.map(n => `
           <button class="cbtn" data-v="${n.v}" ${view===n.v?'aria-current="page"':''}>
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${n.d}"/></svg>
             ${n.label}</button>`).join('')}</nav>`;
      requestAnimationFrame(scrollToToday);
    }

    el.addEventListener('click', async e => {
      const v = e.target.closest('[data-v]');
      if(v){ view = v.dataset.v; return render(); }

      const m = e.target.closest('[data-meal]');
      /* 'meals' is the list and ignores an id; 'meal' is the one you tapped */
      if(m) return Screens.push('meal', { id:m.dataset.meal, onChange: refresh });

      if(e.target.closest('[data-inv]'))
        return Screens.push('inventory', { onChange: refresh });
      const go = e.target.closest('[data-go]');
      if(go) return Screens.push(go.dataset.go, { onChange: refresh });
    });

    /* Start the rail on today, since that is the day you are actually asking about. */
    function scrollToToday(){
      const rail = root.querySelector('#wkRail');
      if(!rail) return;
      const card = rail.querySelector('.wk-day.today');
      if(card) rail.scrollLeft = Math.max(0, card.offsetLeft - rail.offsetLeft - 14);
    }

    async function refresh(){ await load(); render(); }

    await load();
    render();
  }

  Screens.register('nutrition-home', mount);
})();
