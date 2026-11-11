/* The arc, the challenges under it, and the weekly milestones that become episodes. */
(function(){
  const { ICON } = U;

  async function mount(el, params){
    let list = [], week = 1;

    async function load(){
      list = await Challenges.all();
      week = await Data.currentWeek();
    }

    function chalHTML(c){
      const p = Challenges.progress(c, week);
      const kids = list.filter(x => x.parentId === c.id);
      const arc = !c.parentId;
      const running = Challenges.covers(c, week);
      return `
      <article class="chal${arc ? ' arc' : ''}" data-chal="${c.id}">
        <div class="h">
          <b>${c.title}</b>
          <span class="kind ${arc ? 'arc' : 'sub'}">${arc ? 'Arc' : 'Challenge'}</span>
        </div>
        <p class="note">
          Week ${c.fromWeek || 1}${c.toWeek ? ` – ${c.toWeek}` : ' onward'}${
          running ? ' · running now' : ''}${p.weeks ? ` · ${p.weeks} weeks` : ''}
        </p>
        ${c.note ? `<p class="note">${c.note}</p>` : ''}
        <div class="bars">
          ${p.weekPct !== null ? `<div class="b"><span>Time · ${p.elapsed}/${p.weeks}</span>
            <div class="track"><i style="width:${p.weekPct}%"></i></div></div>` : ''}
          ${p.total ? `<div class="b"><span>Milestones · ${p.done}/${p.total}</span>
            <div class="track"><i class="ok" style="width:${p.msPct}%"></i></div></div>` : ''}
        </div>
        ${(c.milestones || []).length ? `<div style="margin:13px 0 0">
          ${c.milestones.slice().sort((a,b) => (a.week||0) - (b.week||0)).map(m => `
            <div class="ms${m.done ? ' done' : ''}" data-ms="${c.id}:${m.id}">
              <span class="bx">${ICON.check}</span>
              <span class="tx">${m.title}</span>
              <span class="wk">wk ${m.week}</span>
            </div>`).join('')}
        </div>` : ''}
        <div class="metaline" style="margin:13px 0 0">
          <button class="btn-sm" data-addms="${c.id}">+ Milestone</button>
          <button class="btn-sm" data-edit="${c.id}">Edit</button>
          ${arc ? `<button class="btn-sm" data-sub="${c.id}">+ Challenge under this</button>` : ''}
        </div>
        ${kids.length ? `<div style="margin:14px 0 0 12px;border-left:1px solid var(--line);padding-left:12px">
          ${kids.map(chalHTML).join('')}
        </div>` : ''}
      </article>`;
    }

    function render(){
      const arcs = list.filter(c => !c.parentId);
      el.innerHTML = Screens.bar({ kicker:'Creator studio', title:'Challenges',
        actions:`<button class="btn-sm accent" data-a="new">+ New</button>` }) + `
      <div class="view">
        <p class="note" style="text-align:left;margin:0 0 16px">
          The long arc — the thousand days. Everything under it now lives in the Quarter:
          the quarter carries the challenge, its months carry the goals, and a week's goal
          is its episode's experiment. Keep arcs here; plan the rest there.
          You are in week ${week}.</p>
        ${arcs.length ? arcs.map(chalHTML).join('')
          : `<div class="empty"><b>Nothing set yet</b>Start with the long one — the 1000 days — then put the monthly challenges under it.</div>`}
      </div>`;
    }

    function openForm(c, parentId){
      const isNew = !c;
      const rec = c || { title:'', note:'', fromWeek:week, toWeek:null, parentId:parentId || null };
      App.sheet(`
        <h2>${isNew ? (parentId ? 'New challenge' : 'New arc') : 'Edit'}</h2>
        <div class="field"><label for="c-title">Title</label>
          <input id="c-title" type="text" value="${(rec.title||'').replace(/"/g,'&quot;')}"
            placeholder="${parentId ? 'Shop build month' : '1000 days'}"></div>
        <div class="field"><label for="c-note">What it is <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <textarea id="c-note" rows="3">${rec.note || ''}</textarea></div>
        <div class="field" style="display:flex;gap:10px">
          <span style="flex:1"><label for="c-from">From week</label>
            <input id="c-from" type="number" min="1" value="${rec.fromWeek || week}"></span>
          <span style="flex:1"><label for="c-to">To week <span style="text-transform:none;letter-spacing:0;font-weight:400">(blank = open)</span></label>
            <input id="c-to" type="number" min="1" value="${rec.toWeek || ''}"></span>
        </div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>${isNew ? 'Create' : 'Save'}</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${isNew ? '' : `<button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete</button>`}`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-delete]')){
            await Challenges.remove(rec.id); await load(); App.closeSheet(); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          const title = sheetEl.querySelector('#c-title').value.trim();
          if(!title) return U.toast('Give it a title');
          const to = sheetEl.querySelector('#c-to').value.trim();
          await Challenges.save({
            ...rec, title,
            note: sheetEl.querySelector('#c-note').value.trim(),
            fromWeek: Math.max(1, +sheetEl.querySelector('#c-from').value || 1),
            toWeek: to ? Math.max(1, +to) : null
          });
          await load(); App.closeSheet(); render();
        });
        setTimeout(() => { const f = sheetEl.querySelector('#c-title'); if(f) f.focus(); }, 180);
      });
    }

    function openMilestone(challengeId){
      const c = list.find(x => x.id === challengeId);
      App.sheet(`
        <h2>Milestone</h2>
        <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.55">
          Something to hit in one week. It becomes the spine of that week's episode.</p>
        <div class="field"><label for="m-title">What</label>
          <input id="m-title" type="text" placeholder="Frame and sheet the back wall"></div>
        <div class="field"><label for="m-week">Week</label>
          <input id="m-week" type="number" min="1" value="${week}"></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Add</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(!e.target.closest('[data-save]')) return;
          const title = sheetEl.querySelector('#m-title').value.trim();
          if(!title) return U.toast('Say what the milestone is');
          c.milestones = c.milestones || [];
          c.milestones.push({ id:Challenges.uid(), title,
            week: Math.max(1, +sheetEl.querySelector('#m-week').value || week), done:false });
          await Challenges.save(c);
          await load(); App.closeSheet(); render();
        });
        setTimeout(() => { const f = sheetEl.querySelector('#m-title'); if(f) f.focus(); }, 180);
      });
    }

    el.addEventListener('click', async e => {
      const ms = e.target.closest('[data-ms]');
      if(ms){
        const [cid, mid] = ms.dataset.ms.split(':');
        await Challenges.toggleMilestone(cid, mid);
        await load(); return render();
      }
      const add = e.target.closest('[data-addms]');
      if(add) return openMilestone(add.dataset.addms);
      const sub = e.target.closest('[data-sub]');
      if(sub) return openForm(null, sub.dataset.sub);
      const ed = e.target.closest('[data-edit]');
      if(ed) return openForm(list.find(x => x.id === ed.dataset.edit));
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'new') return openForm(null, null);
    });

    await load();
    render();
  }

  Screens.register('challenges', mount);
})();
