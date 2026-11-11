/* Runs — distance, time, and the pace that falls out of them. */
(function(){
  /* Three different efforts that all produce a distance and a time. A treadmill
     mile and a rucked mile are not the same thing and averaging them together
     makes both numbers meaningless. */
  const KINDS = [
    { k:'outdoor',   label:'Outside',   d:'M13 4.5a1.4 1.4 0 1 0 0-.1M11 21l1.5-5.5L9 13l1-5 4 2 3 1M8.5 21l2-4' },
    { k:'treadmill', label:'Treadmill', d:'M3 17h13a4 4 0 0 0 4-4V7M3 17v3M6 17l1-4M13.5 5.5a1.2 1.2 0 1 0 0-.1' },
    { k:'ruck',      label:'Ruck',      d:'M9 7V5.5A2.5 2.5 0 0 1 14 5.5V7M6.5 7h11v12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z' }
  ];
  const kindOf = k => KINDS.find(x => x.k === k) || KINDS[0];
  const { ICON } = U;

  const uid = () => 'rn_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  const MI_PER_KM = 0.621371;

  async function mount(el){
    let runs = [], unit = 'lb';   /* lb means imperial, so miles */

    async function load(){
      const { values } = await Store.all('runs');
      runs = values.sort((a,b) => b.at - a.at);
      unit = await Units.get();
    }
    const imperial = () => unit !== 'kg';
    const dist = km => imperial() ? km * MI_PER_KM : km;
    const distLabel = () => imperial() ? 'mi' : 'km';
    const toKm = v => imperial() ? v / MI_PER_KM : v;

    /* pace per mile or per km, from seconds and distance */
    function pace(r){
      const d = dist(r.km);
      if(!d || !r.sec) return '—';
      const s = r.sec / d;
      return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2,'0')}`;
    }
    const hms = sec => {
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
               : `${m}:${String(s).padStart(2,'0')}`;
    };

    function render(){
      const total = runs.reduce((a,r) => a + r.km, 0);
      const longest = runs.reduce((a,r) => Math.max(a, r.km), 0);
      const month = runs.filter(r => {
        const d = new Date(r.at), n = new Date();
        return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
      }).reduce((a,r) => a + r.km, 0);

      el.innerHTML = Screens.bar({ kicker:'Workout', title:'Runs',
        actions:`<button class="btn-sm" data-a="new">Log</button>
                 <button class="btn-sm accent" data-a="live">Start a run</button>` }) + `
      <div class="view">
        <div class="runhero">
          <p class="caps muted" style="font-size:11.5px;margin:0 0 6px">Distance all time</p>
          <div class="big"><b>${dist(total).toFixed(1)}</b><span>${distLabel()}</span></div>
          <div class="rungrid">
            <div class="c"><b>${runs.length}</b><span>runs</span></div>
            <div class="c"><b>${dist(month).toFixed(1)}</b><span>this month</span></div>
            <div class="c"><b>${dist(longest).toFixed(1)}</b><span>longest</span></div>
          </div>
        </div>

        ${runs.length ? `<div class="block" style="padding:4px 14px">
          ${runs.map(r => `<div class="runrow" data-run="${r.id}">
            <span class="d">${dist(r.km).toFixed(1)}<span style="font-size:12px;color:var(--dim)"> ${distLabel()}</span></span>
            <span class="m"><b>${hms(r.sec)} · ${pace(r)} /${distLabel()}</b>
              <span>${new Date(r.at).toLocaleDateString(undefined,{ weekday:'short', month:'short', day:'numeric' })}${r.note ? ' · ' + r.note : ''}</span></span>
            ${r.km >= longest && runs.length > 1 ? `<span class="pr">Longest</span>` : ''}
          </div>`).join('')}
        </div>` : `<div class="empty"><b>No runs yet</b>Log one and the pace, totals and records work themselves out.</div>`}
        <p class="note">Distances follow your unit setting. Switch to kilometres in Settings.</p>
      </div>`;
    }

    function openForm(run){
      const r = run || { km:'', sec:0, note:'', at:Date.now(), kind:'outdoor', packKg:0 };
      let kind = r.kind || 'outdoor';
      const d = r.km ? (imperial() ? r.km * MI_PER_KM : r.km).toFixed(2) : '';
      const mins = r.sec ? Math.floor(r.sec / 60) : '';
      const secs = r.sec ? r.sec % 60 : '';

      const packField = kg => `<label class="hintline" style="display:block;margin:0 0 5px">
          Pack weight (${unit})</label>
        <input id="r-pack-kg" class="pgbar" type="number" min="0" step="1"
          value="${kg ? Math.round(Units.toDisplay(kg, unit)) : ''}" placeholder="20">`;

      App.sheet(`
        <h2>${run ? 'Edit run' : 'Log a run'}</h2>

        <h3 class="pgh" style="margin-top:0">What was it?</h3>
        <div class="pgseg" data-group="kind">${KINDS.map(k =>
          `<button type="button" data-kind="${k.k}" aria-pressed="${kind === k.k}">
            <b>${k.label}</b></button>`).join('')}</div>
        <div id="r-pack" style="margin:10px 0 0"></div>

        <div class="field" style="margin-top:16px"><label for="r-d">Distance (${distLabel()})</label>
          <input id="r-d" type="number" step="0.01" min="0" value="${d}" placeholder="3.1"></div>
        <div class="field" style="display:flex;gap:10px">
          <span style="flex:1"><label for="r-m">Minutes</label>
            <input id="r-m" type="number" min="0" value="${mins}" placeholder="28"></span>
          <span style="flex:1"><label for="r-s">Seconds</label>
            <input id="r-s" type="number" min="0" max="59" value="${secs}" placeholder="30"></span>
        </div>
        <p id="r-pace" style="margin:0 0 16px;color:var(--orange);font-family:var(--display),sans-serif;
          font-weight:900;font-size:15px"></p>
        <div class="field"><label for="r-note">Note <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <input id="r-note" type="text" value="${(r.note||'').replace(/"/g,'&quot;')}" placeholder="Easy, humid"></div>
        <div class="field"><label for="r-date">When</label>
          <input id="r-date" type="date" value="${new Date(r.at - new Date(r.at).getTimezoneOffset()*60000).toISOString().slice(0,10)}"></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>${run ? 'Save' : 'Log it'}</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${run ? `<button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete run</button>` : ''}`,
      sheetEl => {
        const show = () => {
          const dv = +sheetEl.querySelector('#r-d').value || 0;
          const sec = (+sheetEl.querySelector('#r-m').value || 0) * 60 + (+sheetEl.querySelector('#r-s').value || 0);
          const out = sheetEl.querySelector('#r-pace');
          if(!dv || !sec){ out.textContent = ''; return; }
          const p = sec / dv;
          out.textContent = `${Math.floor(p/60)}:${String(Math.round(p%60)).padStart(2,'0')} per ${distLabel()}`;
        };
        ['#r-d','#r-m','#r-s'].forEach(sel => sheetEl.querySelector(sel).addEventListener('input', show));
        show();

        /* the pack weight only matters for a ruck, so it only appears for one */
        const showPack = () => {
          const host = sheetEl.querySelector('#r-pack');
          if(host) host.innerHTML = kind === 'ruck' ? packField(r.packKg || 0) : '';
        };
        showPack();

        sheetEl.addEventListener('click', async e => {
          const kb = e.target.closest('[data-kind]');
          if(kb){
            kind = kb.dataset.kind;
            sheetEl.querySelectorAll('[data-kind]').forEach(b =>
              b.setAttribute('aria-pressed', String(b === kb)));
            return showPack();
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-delete]')){
            await Store.del('runs', run.id); await load(); App.closeSheet(); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          const dv = +sheetEl.querySelector('#r-d').value || 0;
          if(!dv) return U.toast('How far did you go?');
          const sec = (+sheetEl.querySelector('#r-m').value || 0) * 60 + (+sheetEl.querySelector('#r-s').value || 0);
          const when = new Date(sheetEl.querySelector('#r-date').value + 'T09:00').getTime();
          const packInput = sheetEl.querySelector('#r-pack-kg');
          await Store.put('runs', {
            id: run ? run.id : uid(),
            km: toKm(dv), sec,
            kind,
            packKg: kind === 'ruck' && packInput ? Units.toKg(+packInput.value || 0, unit) : 0,
            note: sheetEl.querySelector('#r-note').value.trim(),
            at: isNaN(when) ? Date.now() : when
          });
          await load();
          App.closeSheet();
          render();
          Celebrate.showAwards();       /* a first run, a 10k, a streak — all judged here */
        });
        setTimeout(() => { const f = sheetEl.querySelector('#r-d'); if(f) f.focus(); }, 180);
      });
    }

    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'new') return openForm(null);
      if(a && a.dataset.a === 'live') return Screens.push('run-live', {
        onChange: async () => { await load(); render(); } });
      const r = e.target.closest('[data-run]');
      if(r) openForm(runs.find(x => x.id === r.dataset.run));
    });

    await load();
    render();
  }

  Screens.register('runs', mount);
})();
