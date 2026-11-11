/* The ladder itself. Set these up once — artwork plus the level it unlocks at —
   and from then on they arrive on their own. */
(function(){
  const { ICON } = U;

  async function mount(el, params){
    let list = [], arts = {}, level = 1;

    async function load(){
      Avatars.invalidate();
      list = await Avatars.all();
      level = (await Levels.state()).level;
      Object.values(arts).forEach(u => URL.revokeObjectURL(u));
      arts = {};
      for(const a of list){
        const u = await Avatars.art(a.id);
        if(u) arts[a.id] = u;
      }
    }

    function render(){
      el.innerHTML = Screens.bar({ kicker:'Profile', title:'Avatars',
        actions:`<button class="btn-sm accent" data-a="new">+ Add</button>` }) + `
      <div class="view">
        <p class="note" style="text-align:left;margin:0 0 16px">
          Each avatar unlocks at a level and stays yours. You are level ${level} — anything at or below
          that is already earned.</p>

        ${list.length ? `<div class="block" style="padding:4px 14px">
          ${list.map(a => {
            const got = a.level <= level;
            return `<button class="av-row${got ? '' : ' locked'}" data-edit="${a.id}">
              <span class="th" style="${arts[a.id] ? `background-image:url(${arts[a.id]})` : ''}"></span>
              <span class="m"><b>${a.name || 'Untitled'}</b>
                <span>Unlocks at level ${a.level}</span></span>
              <span class="st ${got ? 'on' : 'off'}">${got ? 'Earned' : `LVL ${a.level}`}</span>
            </button>`;
          }).join('')}
        </div>` : `<div class="empty"><b>No avatars yet</b>
          Add artwork for the levels you are working toward. A still or an animated GIF both work.</div>`}

        <p class="note">The profile shows the highest one you have earned. Levels come from tasks,
          perfect days, workouts, runs, published clips and achievements.</p>
      </div>`;
    }

    function openForm(rec){
      const r = rec || { name:'', level: Math.max(1, level + 1) };
      let picked = null, pickedUrl = arts[r.id] || null;

      App.sheet(`
        <h2>${rec ? 'Edit avatar' : 'New avatar'}</h2>
        <div class="av-pre" data-pick style="${pickedUrl ? `background-image:url(${pickedUrl})` : ''}">
          ${pickedUrl ? '' : 'Tap to choose artwork'}
        </div>
        <div class="field"><label for="av-n">Name</label>
          <input id="av-n" type="text" value="${(r.name||'').replace(/"/g,'&quot;')}"
            placeholder="The Wanderer"></div>
        <div class="field"><label for="av-l">Unlocks at level</label>
          <input id="av-l" type="number" min="1" max="99" value="${r.level}"></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>${rec ? 'Save' : 'Add it'}</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${rec ? `<button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);
          border-color:rgba(226,86,74,.4)">Remove</button>` : ''}`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-pick]')){
            App.pickImage(file => {
              picked = file;
              if(pickedUrl && pickedUrl !== arts[r.id]) URL.revokeObjectURL(pickedUrl);
              pickedUrl = URL.createObjectURL(file);
              const pre = sheetEl.querySelector('.av-pre');
              pre.style.backgroundImage = `url(${pickedUrl})`;
              pre.textContent = '';
            });
            return;
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-delete]')){
            await Avatars.remove(r.id);
            App.closeSheet();
            await load(); render();
            params && params.onChange && params.onChange();
            return;
          }
          if(!e.target.closest('[data-save]')) return;

          const lvl = Math.max(1, +sheetEl.querySelector('#av-l').value || 1);
          if(!picked && !rec) return U.toast('Pick some artwork first');
          if(list.some(a => a.level === lvl && a.id !== r.id))
            return U.toast(`Level ${lvl} already has an avatar`);

          await Avatars.save({ id:r.id, name: sheetEl.querySelector('#av-n').value.trim(),
                               level: lvl, file: picked });
          App.closeSheet();
          await load(); render();
          params && params.onChange && params.onChange();
        });
        setTimeout(() => { const f = sheetEl.querySelector('#av-n'); if(f) f.focus(); }, 180);
      });
    }

    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'new') return openForm(null);
      const ed = e.target.closest('[data-edit]');
      if(ed) openForm(list.find(x => x.id === ed.dataset.edit));
    });

    await load();
    render();
  }

  Screens.register('avatars', mount);
})();
