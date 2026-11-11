/* Meal Prep — dated cook sessions, the cook-day checklist, and what's in stock. */
(function(){
  const { ICON, pad } = U;

  const fmtDate = ts => new Date(ts).toLocaleDateString(undefined,
    { weekday:'short', month:'short', day:'numeric', year:'numeric' });

  /* ---------- sessions list ---------- */
  async function mountPrep(el){
    let tab = 'sessions';

    async function render(){
      const [all, meals] = await Promise.all([Nutrition.prep(), Nutrition.meals()]);
      const byId = Object.fromEntries(meals.map(m => [m.id, m]));
      const sessions = all.filter(s => !s.cooked).sort((a,b) => a.date - b.date);
      const stock = all.filter(s => s.cooked)
        .flatMap(s => (s.mealIds || []).map(id => ({
          session:s, meal:byId[id],
          portions: Math.max(0, Nutrition.batchesOf(s, id) - ((s.used || {})[id] || 0))
        })))
        .filter(x => x.meal && x.portions > 0)
        .sort((a,b) => a.session.cookedAt - b.session.cookedAt);

      /* What the rest of the week still wants, so stock can be judged against
         something real rather than admired in the abstract. */
      const wk = Nutrition.isoWeek();
      const week = await Nutrition.week(wk);
      const today = new Date(); today.setHours(0,0,0,0);
      const { sunday } = Nutrition.weekRange(wk);
      const dayIdx = Math.max(0, Math.round((today - sunday) / 86400000));
      const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];
      const stillPlanned = Object.keys(week.slots || {}).filter(k => {
        const d = k.slice(0, k.indexOf('-'));
        return DAY_KEYS.indexOf(d) >= dayIdx;
      }).length;
      const have = stock.reduce((n,x) => n + x.portions, 0);
      const short = Math.max(0, stillPlanned - have);

      el.innerHTML = Screens.bar({ kicker:'Nutrition', title:'Meal prep',
        actions:`<button class="btn-sm accent" data-a="new">+ New session</button>` }) + `
      <div class="view">
        <div class="chiplist">
          <button class="cpill" data-tab="sessions" aria-pressed="${tab==='sessions'}">Sessions</button>
          <button class="cpill" data-tab="stock" aria-pressed="${tab==='stock'}">In stock · ${stock.reduce((n,x) => n + x.portions, 0)}</button>
        </div>

        ${tab === 'sessions'
          ? (sessions.length ? sessions.map(s => `
              <div class="block" style="padding:14px">
                <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
                  <div style="flex:1;min-width:150px">
                    <b style="display:block;font-family:var(--display),sans-serif;font-weight:900;
                      font-size:19px;margin:0 0 8px">${fmtDate(s.date)}</b>
                    <span class="tagline" style="margin-bottom:8px">
                      <span class="tg" style="background:transparent;border:1px solid var(--orange);color:var(--orange)">To cook</span>
                      <span class="tg count">${(s.mealIds||[]).length} meal${(s.mealIds||[]).length===1?'':'s'}</span>
                      ${s.batches > 1 ? `<span class="tg count">${s.batches}× batch</span>` : ''}
                    </span>
                    <p style="margin:0;color:var(--muted);font-size:14.5px">
                      ${(s.mealIds||[]).map(id => byId[id] && byId[id].title).filter(Boolean).join(', ') || 'No meals yet'}</p>
                  </div>
                  <div style="display:flex;gap:8px">
                    <button class="btn-sm" data-cook="${s.id}">Cook</button>
                    <button class="btn-sm" data-edit="${s.id}">Edit</button>
                  </div>
                </div>
              </div>`).join('')
            : `<div class="block" style="text-align:center;padding:34px 18px">
                <b style="display:block;font-family:var(--display),sans-serif;font-weight:900;font-size:21px;margin:0 0 8px">No sessions planned</b>
                <p style="margin:0;color:var(--muted);font-size:15px;line-height:1.5">A session is a cook day — pick the meals and how many batches of each.</p>
              </div>`)
          : (stock.length ? `
              <div class="st-cover">
                <div class="top">
                  <b>${have}</b>
                  <span>portion${have===1?'':'s'}<br>in the fridge</span>
                </div>
                <div class="st-bar">
                  ${Array.from({ length: Math.max(stillPlanned, have, 1) }, (_, i) =>
                    `<i class="${i < have ? 'on' : i < stillPlanned ? 'short' : ''}"></i>`).join('')}
                </div>
                <p class="st-msg${short ? ' short' : ''}">${
                  !stillPlanned
                    ? `Nothing left planned this week — <b>${have}</b> spare for whenever.`
                    : short
                      ? `<b>${short} short</b> of the ${stillPlanned} meals still planned this week.
                         That is ${short} chance${short===1?'':'s'} to end up snacking instead.`
                      : `Covers all <b>${stillPlanned}</b> meals still planned this week${
                          have > stillPlanned ? `, with ${have - stillPlanned} spare` : ''}.`}</p>
              </div>

              <div class="block" style="padding:0">
              ${stock.map(x => {
                const days = Math.round((Date.now() - x.session.cookedAt) / 86400000);
                return `<div class="st-row${days >= 4 ? ' old' : ''}">
                  <span class="nm"><b>${x.meal.title}</b>
                    <span>cooked ${fmtDate(x.session.cookedAt)}${
                      days >= 4 ? ` · ${days} days ago, eat it` : days ? ` · ${days}d ago` : ' · today'}</span></span>
                  <span class="ct">
                    <button data-eat="${x.session.id}:${x.meal.id}" aria-label="Ate one">−</button>
                    <span class="n">${x.portions}</span>
                    <button data-back="${x.session.id}:${x.meal.id}"
                      ${((x.session.used || {})[x.meal.id] || 0) <= 0 ? 'disabled' : ''}
                      aria-label="Put one back">+</button>
                  </span>
                </div>`;
              }).join('')}</div>`
            : `<div class="block" style="text-align:center;padding:34px 18px">
                <b style="display:block;font-family:var(--display),sans-serif;font-weight:900;font-size:21px;margin:0 0 8px">Nothing cooked yet</b>
                <p style="margin:0;color:var(--muted);font-size:15px;line-height:1.5">Mark a prep session cooked and what it made shows up here.</p>
              </div>`)}

        <p class="note">${tab === 'sessions'
          ? `${sessions.length} session${sessions.length===1?'':'s'} · ingredients ride along on the grocery list for the week each one is dated in.`
          : `Oldest first — what needs eating is at the top. Tap minus when you eat one.`}</p>
      </div>`;
    }

    async function openForm(session){
      const meals = await Nutrition.meals();
      const s = session || { date:Date.now(), mealIds:[], batches:3 };
      const picked = new Set(s.mealIds || []);

      App.sheet(`
        <h2>${session ? 'Edit session' : 'New prep session'}</h2>
        <div class="field"><label for="s-date">Cook day</label>
          <input id="s-date" type="date" value="${new Date(s.date).toISOString().slice(0,10)}"></div>
        <div class="field"><label>Batches of each</label><div class="opts" data-group="batches">
          ${[1,2,3,4,5,6].map(n => `<button type="button" class="opt" data-v="${n}" aria-pressed="${s.batches===n}">${n}×</button>`).join('')}
        </div></div>
        <div class="field"><label>Meals</label>
          <div class="group compact" style="margin:0" id="s-meals">
            ${meals.map(m => `<button type="button" class="row" data-meal="${m.id}">
              <span class="lbl">${m.title}<small>${(m.ingredients||[]).length} ingredients</small></span>
              <span class="pickbox" style="width:26px;height:26px;border-radius:var(--r);display:flex;
                align-items:center;justify-content:center;${picked.has(m.id)
                  ? 'background:var(--orange);color:#fff' : 'border:1px solid var(--line);color:var(--dim)'}">
                ${picked.has(m.id) ? ICON.check : '+'}</span></button>`).join('')}
          </div></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>${session ? 'Save session' : 'Create session'}</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${session ? `<button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete session</button>` : ''}`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          const opt = e.target.closest('.opt');
          if(opt){
            opt.closest('.opts').querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed','false'));
            opt.setAttribute('aria-pressed','true'); return;
          }
          const mrow = e.target.closest('[data-meal]');
          if(mrow){
            const id = mrow.dataset.meal;
            const box = mrow.querySelector('.pickbox');
            if(picked.has(id)){
              picked.delete(id);
              box.style.cssText = 'width:26px;height:26px;border-radius:var(--r);display:flex;align-items:center;justify-content:center;border:1px solid var(--line);color:var(--dim)';
              box.innerHTML = '+';
            } else {
              picked.add(id);
              box.style.cssText = 'width:26px;height:26px;border-radius:var(--r);display:flex;align-items:center;justify-content:center;background:var(--orange);color:#fff';
              box.innerHTML = ICON.check;
            }
            return;
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-delete]')){
            await Nutrition.remove('prep', session.id); App.closeSheet(); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          if(!picked.size) return U.toast('Pick at least one meal');

          await Nutrition.save('prep', {
            ...(session || {}),
            date: new Date(sheetEl.querySelector('#s-date').value + 'T09:00').getTime(),
            batches: +sheetEl.querySelector('[data-group="batches"] .opt[aria-pressed="true"]').dataset.v,
            mealIds: [...picked],
            cooked: false
          }, 'pr');
          App.closeSheet(); render();
        });
      });
    }

    /* Eating a portion is the whole point of having cooked it, so it should cost
       one tap and nothing else. */
    async function useOne(ref, delta){
      const [sessionId, mealId] = ref.split(':');
      const all = await Nutrition.prep();
      const sess = all.find(x => x.id === sessionId);
      if(!sess) return;
      sess.used = sess.used || {};
      const made = Nutrition.batchesOf(sess, mealId);
      const now = sess.used[mealId] || 0;
      sess.used[mealId] = Math.max(0, Math.min(made, now + delta));
      await Nutrition.save('prep', sess);
      render();
    }

    el.addEventListener('click', async e => {
      const eat = e.target.closest('[data-eat]');
      if(eat) return useOne(eat.dataset.eat, +1);
      const back = e.target.closest('[data-back]');
      if(back) return useOne(back.dataset.back, -1);
      const t = e.target.closest('[data-tab]');
      if(t){ tab = t.dataset.tab; return render(); }
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'new') return openForm(null);
      const c = e.target.closest('[data-cook]');
      if(c) return Screens.push('cook', { id:c.dataset.cook, onChange:render });
      const ed = e.target.closest('[data-edit]');
      if(ed){
        const all = await Nutrition.prep();
        openForm(all.find(x => x.id === ed.dataset.edit));
      }
    });

    render();
  }

  /* ---------- cook day ---------- */
  async function mountCook(el, params){
    const done = new Set();

    async function render(){
      const [all, meals] = await Promise.all([Nutrition.prep(), Nutrition.meals()]);
      const s = all.find(x => x.id === params.id);
      if(!s){ Screens.pop(); return; }
      const byId = Object.fromEntries(meals.map(m => [m.id, m]));
      const shopping = await Nutrition.prepShopping(s);
      const steps = (s.mealIds || []).map(id => byId[id]).filter(Boolean);
      const mult = id => Nutrition.batchesOf(s, id);
      const totalSteps = steps.reduce((n,m) => n + (m.steps || []).length, 0);

      el.innerHTML = Screens.bar({ kicker:'Meal prep', title:fmtDate(s.date),
        actions:`<button class="btn-sm accent" data-a="cooked">Mark cooked</button>` }) + `
      <div class="view">
        <div class="sec"><h2 style="color:var(--orange)">Shopping</h2><div class="rule"></div>
          <span class="alt">Grocery list</span></div>
        <div class="block" style="padding:14px">
          ${shopping.length ? shopping.map(i => {
            const L = Shopping.line(i);
            return `<div class="ingrow"><span>${i.name}</span>
              <span class="buyamt"><b>${L.buy}</b>${
                L.converted ? `<span>recipe: ${L.recipe}</span>` : ''}</span></div>`;
          }).join('')
            : `<p style="margin:0;color:var(--muted)">No ingredients listed on these meals.</p>`}
          <p style="margin:12px 0 0;color:var(--muted);font-size:13.5px;line-height:1.55">
            Scaled by what you are making, merged, and converted into what the shop sells —
            the recipe figure sits underneath where the two differ. These are already on the
            grocery list for that week.</p>
        </div>

        <div class="sec"><h2 style="color:var(--orange)">Cook day</h2><div class="rule"></div>
          <span class="alt">${done.size} of ${totalSteps}</span></div>
        ${steps.map(m => {
          const n = mult(m.id);
          const ing = Nutrition.scaledIngredients(m, n);
          const round = v => Math.round(v * 100) / 100;
          return `
          <div class="block" style="padding:16px 14px">
            <div class="ck-head">
              <b>${m.title}</b>
              <span class="ck-step">
                <button data-less="${m.id}" ${n <= 1 ? 'disabled' : ''} aria-label="Fewer">−</button>
                <span class="n">${n}×</span>
                <button data-more="${m.id}" aria-label="More">+</button>
              </span>
            </div>

            ${ing.length ? `
              <div class="ck-cap"><span>Ingredients for ${n}</span>
                <span style="letter-spacing:.04em;text-transform:none;color:var(--dim)">per 1 →</span></div>
              <div class="ck-ing">
                ${ing.map(x => `<div class="r">
                  <span class="nm">${x.name}</span>
                  <span class="amt">${round(x.qty)}${x.unit ? ' ' + x.unit : ''}</span>
                  <span class="base">${n > 1 ? `${round(x.base)}${x.unit ? ' ' + x.unit : ''}` : ''}</span>
                </div>`).join('')}
              </div>` : ''}
            ${(m.steps||[]).length ? `<div class="ck-cap"><span>Directions</span></div>` : ''}
            ${(m.steps||[]).map((st,i) => {
              const key = m.id + ':' + i;
              const on = done.has(key);
              return `<div class="gitem${on?' on':''}" data-step="${key}" style="padding:11px 0">
                <span class="bx" style="width:24px;height:24px;flex:0 0 24px;border-radius:3px">${ICON.check}</span>
                <span style="color:var(--orange);font-family:var(--display),sans-serif;font-weight:900;
                  min-width:18px">${i+1}</span>
                <span class="nm">${st}</span></div>`;
            }).join('')}
          </div>`; }).join('')}
      </div>`;
    }

    /* Changing how much you are making rewrites the ingredient column and the
       shopping total in one go, so the numbers can never disagree. */
    async function setCount(mealId, delta){
      const all = await Nutrition.prep();
      const s = all.find(x => x.id === params.id);
      if(!s) return;
      s.per = s.per || {};
      const now = Nutrition.batchesOf(s, mealId);
      const next = Math.max(1, Math.min(40, now + delta));
      s.per[mealId] = next;
      await Nutrition.save('prep', s);
      render();
    }

    /* Eating a portion is the whole point of having cooked it, so it should cost
       one tap and nothing else. */
    async function useOne(ref, delta){
      const [sessionId, mealId] = ref.split(':');
      const all = await Nutrition.prep();
      const sess = all.find(x => x.id === sessionId);
      if(!sess) return;
      sess.used = sess.used || {};
      const made = Nutrition.batchesOf(sess, mealId);
      const now = sess.used[mealId] || 0;
      sess.used[mealId] = Math.max(0, Math.min(made, now + delta));
      await Nutrition.save('prep', sess);
      render();
    }

    el.addEventListener('click', async e => {
      const eat = e.target.closest('[data-eat]');
      if(eat) return useOne(eat.dataset.eat, +1);
      const back = e.target.closest('[data-back]');
      if(back) return useOne(back.dataset.back, -1);
      const less = e.target.closest('[data-less]');
      if(less) return setCount(less.dataset.less, -1);
      const more = e.target.closest('[data-more]');
      if(more) return setCount(more.dataset.more, +1);

      const st = e.target.closest('[data-step]');
      if(st){
        const k = st.dataset.step;
        done.has(k) ? done.delete(k) : done.add(k);
        return render();
      }
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'cooked'){
        await Nutrition.markCooked(params.id);
        U.toast('Cooked — portions are in stock');
        params.onChange && params.onChange();
        Screens.pop();
      }
    });

    render();
  }

  Screens.register('prep', mountPrep);
  Screens.register('cook', mountCook);
})();
