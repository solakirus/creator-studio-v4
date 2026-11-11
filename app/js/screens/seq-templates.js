/* The sequence templates, as a place you can edit them.

   The six that ship are a starting point, not a fixed list — your shots for a
   training session are not mine. A built-in you change is stored as your version
   of it; one you hide can be brought back, because hiding is not deleting. */
(function(){
  const { ICON } = U;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  async function mount(el, params){
    let list = [], hidden = [];

    async function load(){
      SeqLib.invalidate();
      list = await SeqLib.all();
      /* which of the shipped ones you have put away, so they can come back */
      let mine = {};
      try { mine = await Store.allMap('seq-template'); } catch(e){ mine = {}; }
      hidden = SeqLib.BUILT_IN.filter(b => mine[b.id] && mine[b.id].hidden);
    }

    const changed = () => { if(params && params.onChange) params.onChange(); };

    function render(){
      el.innerHTML = Screens.bar({ kicker:'Episodes', title:'Sequence templates' }) + `
        <div class="view">
          <div class="pagehead"><h1 class="page-title">Templates</h1>
            <span class="headacts" style="display:flex;gap:8px;align-items:center">
              <button class="headbtn" data-a="new">NEW</button>
            </span></div>
          <p class="hintline" style="margin:0 0 16px">A template is a named sequence with its
            shots already in it. Tap one to make it yours.</p>

          ${list.map(t => `
            <button class="noterow" data-edit="${t.id}">
              <span class="dot" style="background:var(--orange)"></span>
              <span class="t"><b>${esc(t.name)}</b>
                <small>${(t.shots || []).length} shot${(t.shots || []).length === 1 ? '' : 's'}${
                  (window.Quarters && Quarters.setupOf) ? ' · ' + Quarters.setupOf(t.setup || 'talking').label : ''}</small></span>
              ${ICON.chevR}
            </button>`).join('')}

          ${hidden.length ? `
            <div class="sec" style="margin-top:20px"><h2>Put away</h2><div class="rule"></div>
              <span class="alt">${hidden.length}</span></div>
            <p class="hintline" style="margin:0 0 10px">Hidden, not deleted — bring one back
              and it returns as it shipped.</p>
            ${hidden.map(t => `
              <button class="noterow" data-restore="${t.id}">
                <span class="dot" style="background:var(--dim)"></span>
                <span class="t"><b>${esc(t.name)}</b>
                  <small>${(t.shots || []).length} shots · tap to bring back</small></span>
              </button>`).join('')}` : ''}
        </div>`;
    }

    function editor(t){
      const isNew = !t.id;
      const r = { setup:'talking', purpose:'', shots:[], ...t };
      const isBuiltIn = SeqLib.BUILT_IN.some(b => b.id === r.id);

      App.sheet(`
        <h2 style="margin:0 0 14px">${isNew ? 'New template' : 'Template'}</h2>
        <input id="tp-n" class="pgname" type="text" value="${esc(r.name || '')}"
          placeholder="Training session" autocomplete="off">

        <h3 class="pgh">How it is filmed</h3>
        <select id="tp-s" class="pgbar">
          ${((window.Quarters && Quarters.SETUPS) || [{ k:'talking', label:'Talking head' }])
            .map(st => `<option value="${st.k}" ${r.setup === st.k ? 'selected' : ''}
              >${st.label}</option>`).join('')}
        </select>

        <h3 class="pgh">What it is for</h3>
        <input id="tp-p" class="pgname" type="text" value="${esc(r.purpose)}"
          placeholder="Show the work, not just the result" autocomplete="off">

        <h3 class="pgh">Shots</h3>
        <textarea id="tp-x" class="pgtext" rows="7"
          placeholder="Walk in, establishing&#10;Working set, side on&#10;Close on the weight"
          >${esc((r.shots || []).join('\n'))}</textarea>
        <p class="hintline">One per line. These arrive ready to tick every time you use it.</p>

        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${isNew ? '' : `<button class="btn-ghost" data-del
          style="width:100%;margin:12px 0 0;color:var(--red);border-color:rgba(226,86,74,.45)">
          ${isBuiltIn ? 'Put this one away' : 'Delete this template'}</button>`}
        ${isBuiltIn && !isNew ? `<p class="note">One that ships can be put away and brought
          back later. Yours are deleted for good.</p>` : ''}`, sheet => {

        sheet.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();

          if(e.target.closest('[data-del]')){
            await SeqLib.remove(r.id);
            App.closeSheet();
            await load(); render(); changed();
            return U.toast(isBuiltIn ? 'Put away' : 'Deleted');
          }
          if(!e.target.closest('[data-save]')) return;

          await SeqLib.save({
            ...r,
            name: sheet.querySelector('#tp-n').value,
            setup: sheet.querySelector('#tp-s').value,
            purpose: sheet.querySelector('#tp-p').value.trim(),
            shots: sheet.querySelector('#tp-x').value.split('\n')
              .map(x => x.trim()).filter(Boolean)
          });
          App.closeSheet();
          await load(); render(); changed();
        });

        setTimeout(() => { const f = sheet.querySelector('#tp-n'); if(f) f.focus(); }, 180);
      });
    }

    el.addEventListener('click', async e => {
      const ed = e.target.closest('[data-edit]');
      if(ed){
        const t = list.find(x => x.id === ed.dataset.edit);
        if(t) editor(t);
        return;
      }

      const rs = e.target.closest('[data-restore]');
      if(rs){
        await SeqLib.restore(rs.dataset.restore);
        await load(); render(); changed();
        return U.toast('Back in the list');
      }

      if(e.target.closest('[data-a="new"]')) return editor({ name:'', shots:[] });
    });

    await load();
    render();
  }

  Screens.register('seq-templates', mount);
})();
