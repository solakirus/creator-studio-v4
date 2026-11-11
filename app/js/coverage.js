/* Coverage — how many of each kind of shot you want off a given piece.
   A tally rather than a checklist, because the count is the point. */
(function(global){
  const DEFAULT_KIT = [
    { id:'establish', label:'Establishing', target:2, hint:'Where we are' },
    { id:'wide',      label:'Wide',         target:2, hint:'The whole action' },
    { id:'medium',    label:'Medium',       target:2, hint:'Subject and context' },
    { id:'close',     label:'Close-up',     target:2, hint:'Face, hands, reaction' },
    { id:'detail',    label:'Detail',       target:2, hint:'The small thing that sells it' },
    { id:'creative',  label:'Creative',     target:2, hint:'The one you have to think about' }
  ];

  let cache = null;
  async function kit(){
    if(cache) return cache;
    const stored = await Store.get('settings', 'coverage-kit');
    cache = (stored && stored.length) ? stored : DEFAULT_KIT.slice();
    if(!stored) await Store.put('settings', cache, 'coverage-kit');
    return cache;
  }
  async function saveKit(list){ cache = list; await Store.put('settings', list, 'coverage-kit'); }
  const invalidate = () => cache = null;

  /* Angles are planned first and ticked when captured. Coverage counts
     only the ones actually in the can. */
  const fromShots = (owner, id) =>
    ((owner && owner.shots) || []).reduce((n, s) =>
      n + ((s.angles || []).filter(a => a.type === id && a.done).length), 0);

  /* the default plan for a new shot — the coverage triangle */
  const DEFAULT_PLAN = ['wide','medium','close'];
  const ANGLE_TARGET = 3;
  const shotTarget = s => (s.angles || []).length || s.target || ANGLE_TARGET;
  const shotGot = s => (s.angles || []).filter(a => a.done).length;
  const planned = (owner, id) =>
    ((owner && owner.shots) || []).reduce((n, s) =>
      n + ((s.angles || []).filter(a => a.type === id).length), 0);
  const shotDone = s => shotGot(s) >= shotTarget(s);
  function shotTotals(owner){
    const shots = (owner && owner.shots) || [];
    const got = shots.reduce((n,s) => n + Math.min(shotGot(s), shotTarget(s)), 0);
    const want = shots.reduce((n,s) => n + shotTarget(s), 0);
    return { got, want, pct: want ? Math.round(got / want * 100) : 0, shots:shots.length };
  }
  const count = (owner, id) => fromShots(owner, id);
  function totals(owner, list){
    const got = list.reduce((n,k) => n + Math.min(count(owner,k.id), k.target), 0);
    const want = list.reduce((n,k) => n + k.target, 0);
    return { got, want, pct: want ? Math.round(got / want * 100) : 0 };
  }

  /* A task can override the kit — some pieces want a Dutch angle and three details. */
  const kitFor = (owner, globalKit) =>
    (owner && owner.kit && owner.kit.length) ? owner.kit : globalKit;

  /* the block used on the task screen and in capture mode */
  function html(owner, list, opts){
    const o = opts || {};
    const t = totals(owner, list);
    const met = t.got >= t.want && t.want > 0;
    if(o.fold){
      return `
      <div class="block fold${o.open ? ' open' : ''}${met ? ' lit' : ''}" id="covblock" data-fold="cov">
        <h4><svg class="fcv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          Required coverage<span class="cnt" data-cov-total>${met ? 'all covered' : `${t.got} of ${t.want}`}</span></h4>
        <div class="fbody">
          <div style="display:flex;align-items:center;gap:10px;margin:0 0 12px">
            <div class="track" style="flex:1"><i class="ok" data-cov-bar style="width:${t.pct}%"></i></div>
            ${o.editable ? `<button class="btn-sm" data-a="editkit" style="height:32px;font-size:13px">
              ${owner && owner.kit ? 'Custom' : 'Customise'}</button>` : ''}
          </div>
          ${met ? `<p class="covlit">Everything required is in the can.</p>` : ''}
          ${rows(owner, list)}
          <p style="margin:12px 0 0;font-size:13px;color:var(--dim);line-height:1.5">
            Counted from the angles logged on your shot list — there is nothing to tick here.</p>
        </div>
      </div>`;
    }
    return `
    <div class="block" id="covblock" ${o.flat ? 'style="border:0;background:transparent;padding:0"' : ''}>
      <div style="display:flex;align-items:center;gap:10px;margin:0 0 12px">
        <h4 style="margin:0;flex:1">Coverage · <span data-cov-total>${t.got} of ${t.want}</span></h4>
        ${o.editable ? `<button class="btn-sm" data-a="editkit" style="height:32px;font-size:13px">
          ${owner && owner.kit ? 'Custom' : 'Customise'}</button>` : ''}
      </div>
      <div class="track" style="margin:0 0 14px"><i class="ok" data-cov-bar style="width:${t.pct}%"></i></div>
      ${rows(owner, list)}
    </div>`;
  }

  /* Read-only. Every number here comes from angles logged on the shot list,
     so there is exactly one place to record a shot. */
  function rows(owner, list){
    return list.map(k => {
      const n = count(owner, k.id);
      const full = n >= k.target;
      const plan = planned(owner, k.id);
      return `<div class="cov${full ? ' full' : ''}" data-cov-row="${k.id}">
        <span class="cl"><b>${k.label}</b>${
          plan ? `<small>${plan} planned on the shot list</small>` : (k.hint ? `<small>${k.hint}</small>` : '')}</span>
        <span class="ct"><span data-cov-n>${n}</span><span>/${k.target}</span></span>
        <span class="cbadge">${full
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5.5 5.5L20 7"/></svg>'
          : `${k.target - n} to go`}</span>
      </div>`;
    }).join('');
  }

  /* Update the tally in place. Re-rendering the screen would throw away the
     scroll position, which is maddening when you are counting shots. */
  function patch(root, owner, list){
    const t = totals(owner, list);
    const totalEl = root.querySelector('[data-cov-total]');
    const barEl = root.querySelector('[data-cov-bar]');
    if(totalEl) totalEl.textContent = `${t.got} of ${t.want}`;
    if(barEl) barEl.style.width = t.pct + '%';

    list.forEach(k => {
      const row = root.querySelector(`[data-cov-row="${k.id}"]`);
      if(!row) return;
      const n = count(owner, k.id);
      const numEl = row.querySelector('[data-cov-n]');
      if(numEl) numEl.textContent = n;
      row.classList.toggle('full', n >= k.target);

    });
  }

  global.Coverage = { kit, kitFor, saveKit, invalidate, count, fromShots, planned, totals, html, patch,
                      ANGLE_TARGET, DEFAULT_PLAN, shotTarget, shotGot, shotDone, shotTotals, DEFAULT_KIT };
})(window);
