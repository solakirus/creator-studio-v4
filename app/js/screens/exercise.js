/* One exercise, up close: what it looks like, what it works, what you last did.
   The artwork is the point — a GIF of the movement beats any description. */
(function(){
  const { ICON } = U;

  async function mount(el, params){
    const id = params && params.id;
    let x = null, artUrl = null, demoUrl = null, unit = 'lb', history = [];

    async function load(){
      const all = await Exercises.all();
      x = all.find(e => e.id === id);
      if(!x) return;
      artUrl = await Exercises.art(x.id);
      demoUrl = await Exercises.art(x.id, 'demo');
      unit = await Units.get();

      /* what this lift has actually done, pulled out of finished sessions */
      try {
        const { values } = await Store.all('sessions');
        history = values
          .flatMap(s => (s.exercises || [])
            .filter(e => e.id === x.id || e.name === x.name)
            .map(e => ({
              at: s.finishedAt,
              best: (e.sets || []).reduce((m, st) => Math.max(m, +st.kg || 0), 0),
              sets: (e.sets || []).length,
              reps: (e.sets || []).reduce((n, st) => n + (+st.reps || 0), 0)
            })))
          .sort((a,b) => b.at - a.at)
          .slice(0, 5);
      } catch(e){ history = []; }
    }

    function render(){
      if(!x){
        el.innerHTML = Screens.bar({ title:'Exercise' }) +
          '<div class="view"><div class="empty"><b>Not found</b>It may have been removed.</div></div>';
        return;
      }
      const primary = (x.pri || [])[0];
      const best = history.reduce((m,h) => Math.max(m, h.best), 0);

      el.innerHTML = Screens.bar({ kicker:'Library', title:x.name,
        actions:`<button class="btn-sm" data-a="edit">Edit</button>` }) + `
      <div class="view" style="--mc:${Exercises.colour(primary)}">

        <div class="ex-slots">
          <div class="ex-slot" data-art="cover">
            ${artUrl ? `<img src="${artUrl}" alt="">
              <span class="x" data-clear="cover">×</span>` : `
              <span class="ph">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
                  stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18v14H3zM8 12l3 3 5-6"/></svg>
                <b>Cover</b><span>How you spot it in a list</span>
              </span>`}
            <span class="cap">Cover</span>
          </div>
          <div class="ex-slot" data-art="demo">
            ${demoUrl ? `<img src="${demoUrl}" alt="">
              <span class="x" data-clear="demo">×</span>` : `
              <span class="ph">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
                  stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z"/></svg>
                <b>Demo</b><span>A GIF you watch mid-set</span>
              </span>`}
            <span class="cap">Demo${demoUrl ? '' : ' · none'}</span>
          </div>
        </div>

        ${(demoUrl || artUrl) ? `<button class="btn-ghost" data-a="play" style="width:100%;margin:0 0 16px">
          Watch the movement</button>` : ''}

        <h1 class="ex-title">${x.name}</h1>
        <div class="mtags" style="margin:0 0 4px">
          ${(x.pri || []).map(m => `<span class="mtag" style="--mc:${Exercises.colour(m)}">${Exercises.label(m)}</span>`).join('')}
          ${(x.sec || []).map(m => `<span class="mtag sec" style="--mc:${Exercises.colour(m)}">${Exercises.label(m)}</span>`).join('')}
        </div>

        <div class="ex-facts">
          <div class="ex-fact"><p>Equipment</p><b style="font-size:16px;text-transform:capitalize">${x.eq}</b></div>
          <div class="ex-fact"><p>Default set</p><b>${
            x.kg ? `${Units.fmt(x.kg, unit)}${Units.label(unit).toLowerCase()} × ${x.reps}` : `${x.reps} reps`}</b></div>
          <div class="ex-fact"><p>Your best</p><b>${
            best ? `${Units.fmt(best, unit)}${Units.label(unit).toLowerCase()}` : '—'}</b></div>
          <div class="ex-fact"><p>Times done</p><b>${history.length ? history.length + '+' : '0'}</b></div>
        </div>

        ${history.length ? `
          <div class="sec"><h2>Recent</h2><div class="rule"></div></div>
          <div class="group" style="margin:0">
            ${history.map(h => `<div class="row" style="cursor:default">
              <span class="lbl">${new Date(h.at).toLocaleDateString(undefined,{ weekday:'short', month:'short', day:'numeric' })}
                <small>${h.sets} sets · ${h.reps} reps</small></span>
              <span style="font-family:var(--display),sans-serif;font-weight:900">${
                h.best ? Units.fmt(h.best, unit) + Units.label(unit).toLowerCase() : '—'}</span>
            </div>`).join('')}
          </div>`
        : `<p class="note" style="text-align:left">No sessions with this one yet.</p>`}

        <button class="btn-ghost" data-a="demo" style="width:100%;margin-top:14px">
          Look up proper form</button>

      </div>`;
    }

    /* Editing what it works, without leaving the exercise you are looking at. */
    function openEdit(){
      const pick = (field, chosen) => Exercises.MUSCLES.map(m => `
        <button type="button" class="opt" data-${field}="${m.id}"
          style="--mc:${m.c}" aria-pressed="${chosen.includes(m.id)}">${m.n}</button>`).join('');

      App.sheet(`
        <h2>${x.name}</h2>
        <div class="field"><label for="e-name">Name</label>
          <input id="e-name" type="text" value="${(x.name||'').replace(/"/g,'&quot;')}"></div>

        <div class="field"><label>Works — primary</label>
          <div class="opts">${pick('pri', x.pri || [])}</div>
          <p style="margin:9px 0 0;font-size:13px;color:var(--dim);line-height:1.5">
            What the lift is for. Counts double toward coverage.</p>
        </div>

        <div class="field"><label>Also works</label>
          <div class="opts">${pick('sec', x.sec || [])}</div>
        </div>

        <div class="field"><label>Equipment</label>
          <div class="opts">
            ${Exercises.EQUIPMENT.map(eq => `<button type="button" class="opt" data-eq="${eq}"
              aria-pressed="${x.eq===eq}" style="text-transform:capitalize">${eq}</button>`).join('')}
          </div>
        </div>

        <div class="field" style="display:flex;gap:10px">
          <span style="flex:1"><label for="e-kg">Default weight (kg)</label>
            <input id="e-kg" type="number" min="0" step="2.5" value="${x.kg || 0}"></span>
          <span style="flex:1"><label for="e-reps">Default reps</label>
            <input id="e-reps" type="number" min="1" value="${x.reps || 8}"></span>
        </div>

        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheetEl => {
        sheetEl.addEventListener('click', async ev => {
          const pri = ev.target.closest('[data-pri]');
          const sec = ev.target.closest('[data-sec]');
          if(pri || sec){
            const b = pri || sec;
            b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
            return;
          }
          const eq = ev.target.closest('[data-eq]');
          if(eq){
            sheetEl.querySelectorAll('[data-eq]').forEach(o => o.setAttribute('aria-pressed','false'));
            eq.setAttribute('aria-pressed','true');
            return;
          }
          if(ev.target.closest('[data-cancel]')) return App.closeSheet();
          if(!ev.target.closest('[data-save]')) return;

          const grab = f => [...sheetEl.querySelectorAll(`[data-${f}][aria-pressed="true"]`)]
            .map(b => b.dataset[f]);
          const priList = grab('pri');
          if(!priList.length) return U.toast('Pick at least one primary muscle');

          await Exercises.save({
            id: x.id,
            name: sheetEl.querySelector('#e-name').value.trim() || x.name,
            pri: priList,
            sec: grab('sec').filter(m => !priList.includes(m)),
            eq: (sheetEl.querySelector('[data-eq][aria-pressed="true"]') || {}).dataset?.eq || x.eq,
            kg: +sheetEl.querySelector('#e-kg').value || 0,
            reps: +sheetEl.querySelector('#e-reps').value || 8
          });
          App.closeSheet();
          await load(); render();
          params && params.onChange && params.onChange();
        });
      });
    }

    el.addEventListener('click', async e => {
      const clear = e.target.closest('[data-clear]');
      if(clear){
        e.stopPropagation();
        const kind = clear.dataset.clear === 'demo' ? 'demo' : undefined;
        await Exercises.clearArt(x.id, kind);
        if(kind) demoUrl = null; else artUrl = null;
        render();
        params && params.onChange && params.onChange();
        return;
      }
      const slot = e.target.closest('[data-art]');
      if(slot){
        const kind = slot.dataset.art === 'demo' ? 'demo' : undefined;
        App.pickImage(async file => {
          const url = await Exercises.setArt(x.id, file, kind);
          if(kind) demoUrl = url; else artUrl = url;
          render();
          params && params.onChange && params.onChange();
        });
        return;
      }
      const a = e.target.closest('[data-a]');
      if(!a) return;
      if(a.dataset.a === 'demo'){
        window.open('https://www.youtube.com/results?search_query=' +
          encodeURIComponent(x.name + ' proper form'), '_blank');
        return;
      }
      if(a.dataset.a === 'play'){
        DemoPlay.show(x.id, x.name);
        return;
      }
      if(a.dataset.a === 'edit') return openEdit();
    });

    await load();
    render();
  }

  Screens.register('exercise', mount);
})();
