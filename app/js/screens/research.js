/* The research library: everything logged, filtered by type, status, and
   whether it has been given to an episode yet. Reached from the Episodes tab. */
(function(){

  async function mount(el, params){
    Research.injectCSS();
    let type = '', status = '', assigned = (params && params.assigned) || '';

    async function render(){
      const [items, eps] = await Promise.all([Research.all(), Research.episodes()]);
      const title = id => { const v = eps.find(x => x.id === id);
        return v ? `${v.week ? `Ep ${v.week} · ` : ''}${v.title || 'Untitled episode'}` : ''; };
      const list = items.filter(r =>
        (!type || r.kind === type) &&
        (!status || Research.statusOf(r).k === status) &&
        (!assigned || (assigned === 'no' ? !r.vlogId : !!r.vlogId)));
      const unCount = items.filter(r => !r.vlogId).length;

      el.innerHTML = Screens.bar({ kicker:'Episodes', title:'Research',
        actions:`<button class="btn-sm accent" data-a="add">+ Log</button>` }) + `
      <div class="view">
        <div class="rs-filters">
          <select id="rs-f-type"><option value="">Any type</option>
            ${Research.TYPES.map(t => `<option value="${t.k}" ${type === t.k ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
          <select id="rs-f-status"><option value="">Any status</option>
            ${Research.STATUS.map(s => `<option value="${s.k}" ${status === s.k ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
          <select id="rs-f-asg">
            <option value="" ${!assigned ? 'selected' : ''}>All · ${items.length}</option>
            <option value="no" ${assigned === 'no' ? 'selected' : ''}>Unassigned · ${unCount}</option>
            <option value="yes" ${assigned === 'yes' ? 'selected' : ''}>On an episode · ${items.length - unCount}</option>
          </select>
        </div>
        ${list.length ? list.map(r => Research.rowHTML(r, { epTitle:title(r.vlogId) })).join('')
          : `<div class="empty"><b>${items.length ? 'Nothing matches' : 'Nothing logged yet'}</b>${items.length
            ? 'Try a different filter.' : 'Tap + Log the moment you find a quote, a study, an experiment or an example.'}</div>`}
      </div>`;
    }

    el.addEventListener('change', e => {
      if(e.target.id === 'rs-f-type'){ type = e.target.value; render(); }
      if(e.target.id === 'rs-f-status'){ status = e.target.value; render(); }
      if(e.target.id === 'rs-f-asg'){ assigned = e.target.value; render(); }
    });
    el.addEventListener('click', async e => {
      if(e.target.closest('[data-a="add"]')) return Research.quickAdd({ onSaved:render });
      const row = e.target.closest('[data-rs]');
      if(row){
        const r = (await Research.all()).find(x => x.id === row.dataset.rs);
        if(r) Research.edit(r, { onSaved:render });
      }
    });

    await render();
  }

  Screens.register('research', mount);
})();
