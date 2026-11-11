/* What you are currently lifting, and when it goes up next. */
(function(){
  const { ICON } = U;

  async function mount(el, params){
    let unit = 'lb', lib = [], loads = [], sched = null;

    async function load(){
      Loads.invalidate();
      unit = await Units.get();
      lib = await Exercises.all();
      loads = await Loads.all();
      sched = await Loads.schedule();
    }

    const nameOf = id => (lib.find(x => x.id === id) || { name:id }).name;
    const colourOf = id => {
      const x = lib.find(e => e.id === id);
      return Exercises.colour(x && (x.pri || [])[0]);
    };
    const w = kg => `${Units.fmt(kg, unit)}${Units.label(unit).toLowerCase()}`;

    function render(){
      const rows = loads.filter(l => l.kg > 0)
        .sort((a,b) => nameOf(a.id).localeCompare(nameOf(b.id)));
      const pctDone = Math.max(0, Math.min(100, Math.round(
        (1 - sched.days / (sched.everyWeeks * 7)) * 100)));

      el.innerHTML = Screens.bar({ kicker:'Workout', title:'Working loads',
        actions:`<button class="btn-sm" data-a="settings">Setup</button>` }) + `
      <div class="view">

        <div class="ov-card">
          <div class="top">
            <b>+${sched.pct}%</b>
            <span>every ${sched.everyWeeks}<br>week${sched.everyWeeks===1?'':'s'}</span>
          </div>
          <div class="ov-bar"><i style="width:${sched.due ? 100 : pctDone}%"></i></div>
          <p class="ov-msg${sched.due ? ' due' : ''}">${
            sched.due
              ? `<b>Due now.</b> Everything below goes up ${sched.pct}% when you apply it.`
              : `Next increase in <b>${sched.days} day${sched.days===1?'':'s'}</b>${
                  sched.lastAt ? ` · last applied ${new Date(sched.lastAt).toLocaleDateString(undefined,{ month:'short', day:'numeric' })}` : ''}.`}</p>
          <div class="ov-cta">
            <button class="set" data-a="settings">Change it</button>
            <button class="go" data-a="apply" ${rows.length ? '' : 'disabled'}>Apply now</button>
          </div>
        </div>

        ${rows.length ? `
          <div class="sec"><h2>Current loads</h2><div class="rule"></div>
            <span class="alt">${rows.length}</span></div>
          <div class="block" style="padding:2px 14px">
            ${rows.map(l => {
              const last = (l.history || []).slice(-1)[0];
              const rise = last && last.from && last.kg > last.from ? last.kg - last.from : 0;
              return `<div class="ld-row${l.hold ? ' held' : ''}" data-edit="${l.id}">
                <span class="dot" style="background:${colourOf(l.id)}"></span>
                <span class="nm"><b>${nameOf(l.id)}</b>
                  <span>${l.hold ? 'held — never raised automatically'
                    : `${l.updatedAt
                        ? `updated ${new Date(l.updatedAt).toLocaleDateString(undefined,{ month:'short', day:'numeric' })}`
                        : ''}${last && last.why ? ` · ${last.why}` : ''}`}</span></span>
                ${rise && !l.hold ? `<span class="up">+${w(rise)}</span>` : ''}
                <span class="kg">${w(l.kg)}</span>
                <button class="holdbtn" data-hold="${l.id}"
                  aria-label="${l.hold ? 'Let this one rise' : 'Hold this one'}">
                  ${l.hold
                    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0"/></svg>'
                    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6M6 12l6-6 6 6"/></svg>'}
                </button>
              </div>`;
            }).join('')}
          </div>`
        : `<div class="empty"><b>Nothing tracked yet</b>
            Finish a session and the weights you actually lifted are picked up automatically.
            Or add one by hand below.</div>`}

        <button class="btn-ghost" data-a="add" style="width:100%;margin-top:14px">Set a load by hand</button>
        <p class="note">Loads follow whatever you actually lift, so a heavy session raises the
          baseline on its own. Increases round to the nearest ${Units.fmt(Loads.STEP_KG, unit)}${
          Units.label(unit).toLowerCase()} so they land on real plates.</p>
      </div>`;
    }

    /* ---- applying an increase ----
       The saved percentage is what normally runs. This lets a single round go
       higher or lower without rewriting the schedule you set up. */
    async function openApply(){
      const c = await Loads.config();
      const routines = await Loads.routines();
      let pct = c.pct;
      let scope = null;                 /* null means everything */

      const listFor = rows => rows.map(r => `<div class="ld-prev">
        <span class="n">${nameOf(r.id)}</span>
        <span class="ar">${w(r.from)} →</span>
        <span class="to">${w(r.to)}</span>
      </div>`).join('');

      const idsFor = () => scope ? (routines.find(r => r.name === scope) || {}).ids : null;
      const rows = await Loads.preview(pct, idsFor());
      if(!rows.length && !routines.length) return U.toast('No loads to raise yet');

      const scopeHTML = () => `
        <button data-scope="" aria-pressed="${!scope}">
          <span class="tick"></span>
          <span class="tx"><b>Everything</b><span>Every lift you are tracking</span></span>
        </button>
        ${routines.map(r => `<button data-scope="${r.name}" aria-pressed="${scope === r.name}">
          <span class="tick"></span>
          <span class="tx"><b>${r.name}</b><span>${
            r.liftable.length
              ? `${r.liftable.length} lift${r.liftable.length===1?'':'s'} would rise`
              : 'nothing here to raise'}</span></span>
        </button>`).join('')}`;

      App.sheet(`
        <h2>Raise your loads</h2>
        ${routines.length ? `<div class="field"><label>Apply to</label>
          <div class="ld-scope" data-scopes>${scopeHTML()}</div>
          <p style="margin:0;font-size:13px;color:var(--dim);line-height:1.5">
            Routines come from your saved sessions. Anything held, bodyweight or cardio is
            left alone whichever you pick.</p>
        </div>` : ''}
        <div class="field"><label>This round</label>
          <div class="opts" data-group="pct">
            ${[2.5, 5, 7.5, 10, 15, 20].map(p => `<button type="button" class="opt" data-v="${p}"
              aria-pressed="${pct === p}">${p}%</button>`).join('')}
          </div>
          <p style="margin:9px 0 0;font-size:13px;color:var(--dim);line-height:1.5">
            Your schedule stays at ${c.pct}% — this is a one-off.</p>
        </div>
        <p style="margin:0 0 12px;color:var(--muted);font-size:14px;line-height:1.55">
          <span data-count>${rows.length}</span> lifts, rounded to the nearest plate.
          Anything that would round back down goes up one step instead.</p>
        <div class="group compact" style="margin:0 0 14px;max-height:38vh;overflow-y:auto"
          data-rows>${listFor(rows)}</div>
        <div class="sheetcta">
          <button class="btn-primary" data-go>Raise them</button>
          <button class="btn-ghost" data-cancel>Not yet</button>
        </div>`, sheetEl => {
        async function repaint(){
          const fresh = await Loads.preview(pct, idsFor());
          sheetEl.querySelector('[data-rows]').innerHTML = fresh.length
            ? listFor(fresh)
            : `<p style="padding:14px 0;color:var(--dim);font-size:14px">Nothing in this scope has
               a weight to raise.</p>`;
          sheetEl.querySelector('[data-count]').textContent = fresh.length;
          const go = sheetEl.querySelector('[data-go]');
          if(go) go.disabled = !fresh.length;
        }

        sheetEl.addEventListener('click', async e => {
          const opt = e.target.closest('[data-v]');
          if(opt){
            sheetEl.querySelectorAll('[data-v]').forEach(o => o.setAttribute('aria-pressed','false'));
            opt.setAttribute('aria-pressed','true');
            pct = +opt.dataset.v;
            return repaint();
          }
          const sc = e.target.closest('[data-scope]');
          if(sc){
            scope = sc.dataset.scope || null;
            sheetEl.querySelectorAll('[data-scope]').forEach(b =>
              b.setAttribute('aria-pressed', String((b.dataset.scope || null) === scope)));
            return repaint();
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(!e.target.closest('[data-go]')) return;
          const n = await Loads.apply(pct, idsFor());
          if(!n){ App.closeSheet(); return U.toast('Nothing in that scope to raise'); }
          App.closeSheet();
          U.toast(`${n} lift${n===1?'':'s'} raised ${pct}%${scope ? ` in ${scope}` : ''}`);
          await load(); render();
          Celebrate.showAwards();
        });
      });
    }

    /* ---- the schedule ---- */
    async function openSetup(){
      const c = await Loads.config();
      App.sheet(`
        <h2>Progressive overload</h2>
        <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.6">
          How much to add, and how often. Small and frequent beats large and rare —
          you can always skip an increase, but you cannot un-injure a shoulder.</p>

        <div class="field"><label>Increase by</label>
          <div class="opts" data-group="pct">
            ${[2.5, 5, 7.5, 10, 15].map(p => `<button type="button" class="opt" data-v="${p}"
              aria-pressed="${c.pct === p}">${p}%</button>`).join('')}
          </div></div>

        <div class="field"><label>Every</label>
          <div class="opts" data-group="wk">
            ${[1, 2, 3, 4, 6, 8].map(n => `<button type="button" class="opt" data-v="${n}"
              aria-pressed="${c.everyWeeks === n}">${n} week${n===1?'':'s'}</button>`).join('')}
          </div></div>

        <div class="row" style="cursor:pointer;margin:4px 0 0">
          <span class="lbl">Apply it on its own<small>Otherwise it waits and asks</small></span>
          <span class="tog" role="switch" data-auto aria-checked="${!!c.auto}" tabindex="0"><i></i></span>
        </div>

        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        <button class="btn-ghost" data-reset style="width:100%;margin-top:10px">
          Restart the clock from today</button>`, sheetEl => {
        sheetEl.addEventListener('click', async e => {
          const opt = e.target.closest('.opt');
          if(opt){
            opt.closest('.opts').querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed','false'));
            opt.setAttribute('aria-pressed','true'); return;
          }
          const tog = e.target.closest('[data-auto]');
          if(tog){
            tog.setAttribute('aria-checked', String(tog.getAttribute('aria-checked') !== 'true'));
            return;
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-reset]')){
            await Loads.setConfig({ lastAt: Date.now() });
            App.closeSheet(); await load(); render();
            return U.toast('Clock restarted');
          }
          if(!e.target.closest('[data-save]')) return;
          const pick = g => +sheetEl.querySelector(`[data-group="${g}"] .opt[aria-pressed="true"]`).dataset.v;
          await Loads.setConfig({
            pct: pick('pct'), everyWeeks: pick('wk'),
            auto: sheetEl.querySelector('[data-auto]').getAttribute('aria-checked') === 'true'
          });
          App.closeSheet(); await load(); render();
        });
      });
    }

    /* ---- one load by hand ---- */
    async function openLoad(id){
      const cur = id ? await Loads.get(id) : null;
      const imperial = unit !== 'kg';
      const shown = cur ? Units.fmt(cur.kg, unit) : '';

      App.sheet(`
        <h2>${id ? nameOf(id) : 'Set a load'}</h2>
        ${id ? '' : `<div class="field"><label for="ld-ex">Exercise</label>
          <select id="ld-ex" class="unit">
            ${lib.map(x => `<option value="${x.id}">${x.name}</option>`).join('')}
          </select></div>`}
        <div class="field"><label for="ld-kg">Working weight (${Units.label(unit).toLowerCase()})</label>
          <input id="ld-kg" type="number" inputmode="decimal" min="0" step="${imperial ? 5 : 2.5}"
            value="${shown}"></div>
        ${cur && (cur.history||[]).length > 1 ? `
          <p class="caps muted" style="font-size:11px;margin:0 0 8px">Recent</p>
          <div class="group compact" style="margin:0 0 14px">
            ${cur.history.slice(-5).reverse().map(h => `<div class="ld-prev">
              <span class="n">${new Date(h.at).toLocaleDateString(undefined,{ month:'short', day:'numeric' })}</span>
              <span class="ar">${h.why}</span>
              <span class="to">${w(h.kg)}</span>
            </div>`).join('')}
          </div>` : ''}
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(!e.target.closest('[data-save]')) return;
          const val = +sheetEl.querySelector('#ld-kg').value || 0;
          const target = id || sheetEl.querySelector('#ld-ex').value;

          /* The field shows a rounded pound figure, so converting it back would
             quietly shave a kilo off a load you never meant to change. If the
             number on screen is untouched, the stored weight is untouched too. */
          if(cur && String(val) === String(shown)) { App.closeSheet(); return; }

          await Loads.set(target, Units.toKg(val, unit), 'set by hand');
          App.closeSheet(); await load(); render();
        });
      });
    }

    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]');
      if(a){
        if(a.dataset.a === 'apply')    return openApply();
        if(a.dataset.a === 'settings') return openSetup();
        if(a.dataset.a === 'add')      return openLoad(null);
      }
      const h = e.target.closest('[data-hold]');
      if(h){
        e.stopPropagation();
        const on = await Loads.hold(h.dataset.hold);
        await load(); render();
        return U.toast(on ? 'Held — increases will skip it' : 'Back in the rotation');
      }
      const ed = e.target.closest('[data-edit]');
      if(ed) return openLoad(ed.dataset.edit);
    });

    await load();
    render();
  }

  Screens.register('loads', mount);
})();
