/* One finished session, read back.

   Every set you did is already stored — weight, reps, whether you completed it.
   Until now the log showed a single summary line and there was no way to open
   it, so the record existed and nothing could read it. This is that screen: what
   you lifted last time, which is the only thing you need before you lift again. */
(function(){

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  const hms = sec => {
    const s = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
  };

  async function mount(el, params){
    let unit = 'lb';
    try { unit = await Units.get(); } catch(e){ unit = 'lb'; }
    const show = kg => Math.round(Units.toDisplay(kg || 0, unit) * 10) / 10;

    let rec = null, prev = null;
    try {
      const { values } = await Store.all('sessions');
      const sorted = values.sort((a, b) => b.finishedAt - a.finishedAt);
      rec = sorted.find(r => r.id === params.id) || null;
      /* the one before it with the same name, to compare against */
      if(rec) prev = sorted.find(r => r.name === rec.name && r.finishedAt < rec.finishedAt) || null;
    } catch(e){ rec = null; }

    if(!rec){
      el.innerHTML = Screens.bar({ title:'Session' }) +
        '<div class="view"><div class="empty"><b>Not found</b>That session is no longer stored.</div></div>';
      return;
    }

    const d = new Date(rec.finishedAt);
    const best = ex => (ex.sets || []).filter(s => s.done)
      .reduce((m, s) => (s.kg * s.reps > m.kg * m.reps ? s : m), { kg:0, reps:0 });

    /* what the same lift did last time, so progress is visible without arithmetic */
    function lastTime(name){
      if(!prev) return null;
      const was = (prev.exercises || []).find(e => e.name === name);
      if(!was) return null;
      const b = (was.sets || []).filter(s => s.done)
        .reduce((m, s) => (s.kg * s.reps > m.kg * m.reps ? s : m), { kg:0, reps:0 });
      return b.kg ? b : null;
    }

    el.innerHTML = Screens.bar({ kicker:'Session log', title:rec.name || 'Session' }) + `
      <div class="view">
        <div class="pagehead"><h1 class="page-title">${esc(rec.name || 'Session')}</h1></div>
        <p class="hintline" style="margin:0 0 16px">${d.toLocaleDateString(undefined,
          { weekday:'long', day:'numeric', month:'long', year:'numeric' })} · ${
          d.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' })}</p>

        <div class="phstats">
          <div><b>${rec.setsCompleted}/${rec.setsPlanned}</b><small>sets</small></div>
          <div><b>${Math.round(Units.toDisplay(rec.volumeKg || 0, unit)).toLocaleString()}</b><small>${unit} volume</small></div>
          <div><b>${hms(rec.durationSec)}</b><small>on the clock</small></div>
          <div><b>${(rec.exercises || []).length}</b><small>lifts</small></div>
        </div>

        <div class="sec"><h2>What you lifted</h2><div class="rule"></div>
          <span class="alt">${(rec.exercises || []).length}</span></div>

        ${(rec.exercises || []).map(ex => {
          const b = best(ex);
          const was = lastTime(ex.name);
          const up = was && b.kg > was.kg;
          return `
            <article class="sxrow">
              <div class="top">
                <b>${esc(ex.name)}</b>
                ${b.kg ? `<span class="best">${show(b.kg)} ${unit} × ${b.reps}</span>` : ''}
              </div>
              <div class="sets">
                ${(ex.sets || []).map(s => `
                  <span class="set${s.done ? '' : ' skipped'}">${show(s.kg)}<i>×${s.reps}</i></span>`).join('')}
              </div>
              ${was ? `<p class="vs${up ? ' up' : ''}">Last time ${show(was.kg)} ${unit} × ${was.reps}${
                up ? ' — up on it' : b.kg === was.kg && b.reps === was.reps ? ' — matched' : ''}</p>` : ''}
            </article>`;
        }).join('')}

        ${prev ? `<button class="btn-ghost" data-prev="${prev.id}" style="width:100%;margin:16px 0 0">
          The ${rec.name} before this one</button>` : ''}
      </div>`;

    el.addEventListener('click', e => {
      const p = e.target.closest('[data-prev]');
      if(p) Screens.replace('session-view', { id:p.dataset.prev });
    });
  }

  Screens.register('session-view', mount);
})();
