/* Every planned shot, cut by where you have to be to get it. */
(function(){
  const { ICON } = U;

  async function mount(el, params){
    let all = [], locs = [], filterLoc = 'all', status = 'todo', refThumbs = {};

    async function load(){
      all = await Shots.gather();
      locs = await Shots.usedLocations();
      const ids = [...new Set(all.flatMap(s => s.refs || []))];
      for(const id of ids){
        if(refThumbs[id] === undefined) refThumbs[id] = await Refs.thumb(id);
      }
    }

    function visible(){
      return all.filter(s =>
        (filterLoc === 'all' || (s.location || '') === (filterLoc === 'none' ? '' : filterLoc)) &&
        (status === 'all' || (status === 'todo' ? !s.captured : s.captured)));
    }

    function render(){
      const rows = visible();
      const st = Shots.stats(all);
      const groups = Shots.byLocation(rows);

      el.innerHTML = Screens.bar({ kicker:'Creator studio', title:'Shot list',
        actions:`<button class="btn-sm" data-a="places">Places</button>` }) + `
      <div class="view" style="padding-left:0;padding-right:0">
        <div class="pad">
          <div class="sl-hero">
            <div class="top">
              <b>${st.outstanding}</b>
              <span>still to<br>capture</span>
            </div>
            <div class="sl-bar"><i style="width:${st.pct}%"></i></div>
            <p style="margin:10px 0 0;font-size:13.5px;color:var(--muted);line-height:1.5">
              ${st.captured} of ${st.total} captured across every task and episode.</p>
          </div>
        </div>

        <div class="mrail">
          <button class="pill" data-s="todo" aria-pressed="${status==='todo'}">Outstanding</button>
          <button class="pill" data-s="got" aria-pressed="${status==='got'}">Captured</button>
          <button class="pill" data-s="all" aria-pressed="${status==='all'}">All</button>
        </div>

        <div class="mrail" style="margin-top:8px">
          <button class="pill" data-l="all" aria-pressed="${filterLoc==='all'}">Everywhere</button>
          ${locs.map(l => `<button class="pill" data-l="${l}"
            aria-pressed="${filterLoc===l}">${l}</button>`).join('')}
          ${all.some(s => !s.location) ? `<button class="pill" data-l="none"
            aria-pressed="${filterLoc==='none'}">No place set</button>` : ''}
        </div>

        <div class="pad">
          ${groups.length ? groups.map(g => `
            <div class="sl-loc">
              <b>${g.location || 'No place set'}</b><i></i>
              <span class="n">${g.outstanding ? `${g.outstanding} to get` : 'all captured'}</span>
            </div>
            ${g.items.map(s => `
              <button class="sl-row${s.captured ? ' got' : s.partly ? ' part' : ''}" data-shot="${s.key}">
                <span class="bx">${ICON.check}</span>
                <span class="tx">
                  <b>${s.name}</b>
                  <!-- != null, and prep days read as "prep": day 0 and below
                       are real dates before Day 1, not a missing day -->
                  <span>${s.sourceName}${s.day != null
                    ? ` · ${s.day >= 1 ? 'day ' + s.day : 'prep'}` : ''}${
                    s.at ? ` · ${s.at}` : ''}</span>
                  ${(s.framing || s.movement) ? `<span class="tags">
                    ${s.framing ? `<span class="mtag" style="--mc:#5B62A8">${s.framing}</span>` : ''}
                    ${s.movement ? `<span class="mtag" style="--mc:#8A6A2F">${s.movement}</span>` : ''}
                  </span>` : ''}
                  ${(s.refs || []).length ? `<span class="rf">
                    ${s.refs.slice(0,4).map(r => refThumbs[r]
                      ? `<img src="${refThumbs[r]}" alt="">` : '').join('')}
                  </span>` : ''}
                </span>
              </button>`).join('')}`).join('')
          : `<div class="empty"><b>Nothing here</b>
              ${status === 'todo' ? 'Everything planned has been captured.'
                : 'Plan shots on a task or an episode beat and they gather here.'}</div>`}
          <p class="note">Shots live on their task or beat. This is the same list, sorted by
            where you have to be to get them.</p>
        </div>
      </div>`;
    }

    /* tapping a shot offers the two things worth doing from here */
    async function openShot(key){
      const s = all.find(x => x.key === key);
      if(!s) return;
      const places = await Shots.locations();
      const used = await Shots.usedLocations();
      const options = [...new Set([...places, ...used])].sort();

      App.sheet(`
        <h2>${s.name}</h2>
        <p style="margin:0 0 14px;color:var(--muted);font-size:14.5px;line-height:1.55">
          From ${s.sourceName}${s.day != null
            ? ` · ${s.day >= 1 ? 'day ' + s.day : 'prep'}` : ''}.</p>

        <div class="field"><label for="sl-loc">Where it happens</label>
          <select id="sl-loc" class="unit">
            <option value="">No place set</option>
            ${options.map(l => `<option value="${l}"${s.location === l ? ' selected' : ''}>${l}</option>`).join('')}
            <option value="__new">+ New place…</option>
          </select>
          <div id="sl-new" hidden style="margin-top:10px">
            <input id="sl-newname" type="text" placeholder="TPA2 datacenter">
          </div>
        </div>

        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-open>Open ${s.source === 'task' ? 'the task' : 'the beat'}</button>
        </div>`, sheetEl => {
        const sel = sheetEl.querySelector('#sl-loc');
        sel.addEventListener('change', () => {
          const on = sel.value === '__new';
          sheetEl.querySelector('#sl-new').hidden = !on;
          if(on) setTimeout(() => { const f = sheetEl.querySelector('#sl-newname'); if(f) f.focus(); }, 60);
        });

        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-open]')){
            App.closeSheet();
            if(s.source === 'task') Screens.push('task', { id:s.sourceId, onChange: refresh });
            else Screens.push('vlog-beat', { vlogId:s.vlogId, beatId:s.sourceId, onChange: refresh });
            return;
          }
          if(!e.target.closest('[data-save]')) return;

          let place = sel.value;
          if(place === '__new'){
            const made = await Shots.addLocation(sheetEl.querySelector('#sl-newname').value);
            if(!made) return U.toast('Name the place first');
            place = made;
          }
          await Shots.setLocation(s, place);
          App.closeSheet();
          await refresh();
        });
      });
    }

    async function refresh(){ await load(); render(); }

    el.addEventListener('click', async e => {
      const st = e.target.closest('[data-s]');
      if(st){ status = st.dataset.s; return render(); }
      const l = e.target.closest('[data-l]');
      if(l){ filterLoc = l.dataset.l; return render(); }

      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'places'){
        const list = await Shots.locations();
        App.sheet(`
          <h2>Places</h2>
          <p style="margin:0 0 12px;color:var(--muted);font-size:14.5px;line-height:1.55">
            Where you shoot. Add the ones you use and they appear on every shot.</p>
          <div class="field"><label for="pl-new">Add one</label>
            <div style="display:flex;gap:9px">
              <input id="pl-new" type="text" placeholder="TPA2 datacenter" style="flex:1">
              <button class="btn-sm accent" data-addpl style="height:52px;padding:0 16px">Add</button>
            </div></div>
          <div class="group" style="margin:6px 0 0">
            ${list.length ? list.map(l => `<div class="row" style="cursor:default">
              <span class="lbl">${l}</span>
              <button class="btn-sm" data-delpl="${l}">Remove</button>
            </div>`).join('')
            : `<p style="padding:14px 0;color:var(--dim);font-size:14px">None yet.</p>`}
          </div>
          <div class="sheetcta"><button class="btn-primary" data-cancel>Done</button></div>`,
        sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')){ App.closeSheet(); return refresh(); }
            if(ev.target.closest('[data-addpl]')){
              const made = await Shots.addLocation(sheetEl.querySelector('#pl-new').value);
              if(!made) return U.toast('Name it first');
              App.closeSheet();
              return el.querySelector('[data-a="places"]').click();
            }
            const del = ev.target.closest('[data-delpl]');
            if(del){
              const keep = (await Shots.locations()).filter(x => x !== del.dataset.delpl);
              await Store.put('settings', keep, 'shot-locations');
              App.closeSheet();
              return el.querySelector('[data-a="places"]').click();
            }
          });
        });
        return;
      }

      const row = e.target.closest('[data-shot]');
      if(row) return openShot(row.dataset.shot);
    });

    await load();
    render();
  }

  Screens.register('shot-list', mount);
})();
