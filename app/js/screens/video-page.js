/* v4: a series' video, opened as a page.

   It used to be a pop-up, which had no room for what you film it from. Now it
   is a page like a task's: where it's up to, the hook, the shoot day, and the
   task's own Steps + Shot page (shotlist.js host) — frames, Next up, shoot
   mode. On a wide screen the series' other parts sit down the left as plain
   rows; the rest of the details (channel, tags, delete) stay in the sheet
   behind "Details".

     Screens.push('video-page', { id, onChange }) */
(function(global){
  const esc = s => U.esc(s);

  const CSS = `
  .vp{display:flex;flex-wrap:wrap;align-items:flex-start;gap:0}
  .vp-parts{flex:1 1 260px;max-width:320px;padding:4px 16px 20px 0;border-right:1px solid var(--line);margin-right:20px;box-sizing:border-box}
  .vp-parts .k,.vp .k{font-family:var(--display),sans-serif;font-weight:900;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
  .vp-part{display:block;width:100%;text-align:left;padding:10px 11px;margin:0 0 6px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);color:var(--cream);cursor:pointer;font:inherit}
  .vp-part.on{border-color:var(--orange);background:#241C12}
  .vp-part b{display:block;font-size:14px;font-weight:700;line-height:1.3}
  .vp-part small{display:flex;gap:8px;align-items:center;margin-top:5px;color:var(--muted);font-size:12px}
  .vp-part i{font-style:normal;color:#151515;font-size:11px;font-weight:700;padding:1px 6px;border-radius:3px}
  .vp-main{flex:999 1 560px;min-width:0}
  .vp-title{font-family:var(--display),sans-serif;font-weight:900;font-size:26px;margin:2px 0 12px;line-height:1.1}
  .vp-stages{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
  .vp-stages button{height:38px;padding:0 14px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);color:var(--cream);font:inherit;font-size:14px;cursor:pointer}
  .vp-stages button[aria-pressed="true"]{color:#151515;font-weight:700}
  .vp-cards{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 16px}
  .vp-card{flex:2 1 300px;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r);padding:12px 14px}
  .vp-card.day{flex:1 1 220px;display:flex;flex-direction:column;gap:8px}
  .vp-card p{margin:4px 0 0;line-height:1.45}
  .vp-card .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .vp-card .row b{flex:1}
  .vp-fold{display:flex;gap:12px;align-items:center;padding:13px 14px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);margin:8px 0 0}
  .vp-fold b{flex:0 0 120px}
  .vp-fold span{flex:1;color:var(--muted);font-size:14px}
  @media (max-width:899px){ .vp-parts{display:none} }`;

  async function mount(el, params){
    if(!document.getElementById('vp-css')){ const st = document.createElement('style'); st.id = 'vp-css'; st.textContent = CSS; document.head.appendChild(st); }
    let id = params.id, v = null, parts = [], series = null, when = '';

    async function load(){
      v = await Videos.get(id);
      parts = [];
      series = null;
      if(v && v.seriesId){
        try { parts = await Videos.forSeries(v.seriesId); } catch(e){ parts = []; }
        parts.sort((a, b) => ((+a.order || 1e9) - (+b.order || 1e9)) || ((a.createdAt || 0) - (b.createdAt || 0)));
        try { series = (await Data.series()).find(s => s.id === v.seriesId) || null; } catch(e){ series = null; }
      }
      when = '';
      if(v && v.day) try { when = new Date(await Data.dayToDate(v.day)).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }); } catch(e){ when = 'day ' + v.day; }
    }
    const changed = () => { try { params.onChange && params.onChange(); } catch(e){} };

    function render(){
      if(!v){ el.innerHTML = Screens.bar({ title:'Video' }) + '<div class="view"><div class="empty"><b>Gone</b>This video isn’t here any more.</div></div>'; return; }
      const n = (v.shotList || v.shots || []).length;
      const at = parts.findIndex(x => x.id === v.id);
      el.innerHTML = Screens.bar({ kicker:series ? 'Series · ' + esc(series.title || '') : 'Video', title:esc(v.title),
        actions:'<button class="btn-sm" data-a="details">Details</button>' }) + `
      <div class="view"><div class="vp">
        ${parts.length > 1 ? `<nav class="vp-parts" aria-label="Parts in this series"><p class="k">Parts · ${parts.length}</p>
          ${parts.map(x => { const st = Videos.stage(x.stage); const c = (x.shotList || x.shots || []).length;
            return `<button class="vp-part${x.id === v.id ? ' on' : ''}" data-part="${esc(x.id)}"><b>${esc(x.title)}</b>
              <small>${c ? c + ' shot' + (c === 1 ? '' : 's') : 'no shots yet'}<i style="background:${st.c}">${st.label}</i></small></button>`; }).join('')}
        </nav>` : ''}
        <div class="vp-main">
          ${at >= 0 && parts.length > 1 ? `<p class="k">Part ${at + 1} of ${parts.length}</p>` : ''}
          <h2 class="vp-title">${esc(v.title)}</h2>
          <div class="vp-stages" role="group" aria-label="Where it is up to">
            ${Videos.STAGES.map(s => `<button data-stage="${s.k}" aria-pressed="${(v.stage || 'idea') === s.k}"
              ${(v.stage || 'idea') === s.k ? `style="background:${s.c};border-color:${s.c}"` : ''}>${s.label}</button>`).join('')}
          </div>
          <div class="vp-cards">
            <div class="vp-card"><p class="k" style="margin:0">The hook</p>
              <p>${v.hook ? '“' + esc(v.hook) + '”' : '<span style="color:var(--muted)">No hook yet — add it in Details.</span>'}</p></div>
            <div class="vp-card day"><p class="k" style="margin:0">Shoot day</p>
              <div class="row"><b>${v.day ? esc(when) : 'Not on your days'}</b>
                <button class="btn-sm${v.day ? '' : ' accent'}" data-a="day">${v.day ? 'Move' : 'Put on a day'}</button>
                ${v.day ? '<button class="btn-sm" data-a="unday">Take it off</button>' : ''}</div></div>
          </div>
          <div class="block" style="margin:0"><h4>Steps${n ? ` <span class="cnt">${n} shots</span>` : ''}</h4><div id="vpSteps"></div></div>
          ${v.notes ? `<div class="vp-fold"><b>Notes</b><span>${esc(v.notes)}</span></div>` : ''}
          ${(v.tags || []).length ? `<div class="vp-fold"><b>Tags</b><span>${v.tags.map(t => '#' + esc(t)).join(' ')}</span></div>` : ''}
        </div>
      </div></div>`;
      ShotList.embed(el.querySelector('#vpSteps'), ShotList.hostVideo(v.id), async () => { v = await Videos.get(id) || v; changed(); });
    }

    el.addEventListener('click', async e => {
      const pt = e.target.closest('[data-part]');
      if(pt){ id = pt.dataset.part; await load(); return render(); }
      const st = e.target.closest('[data-stage]');
      if(st){ v = await Videos.save({ ...(await Videos.get(id)), stage:st.dataset.stage }); changed(); await load(); return render(); }
      const a = e.target.closest('[data-a]');
      if(!a) return;
      if(a.dataset.a === 'details') return VideoSheet.open(await Videos.get(id), { seriesId:v.seriesId, onDone:async () => { await load(); render(); changed(); } });
      if(a.dataset.a === 'unday'){ await Videos.unschedule(await Videos.get(id)); await load(); render(); changed(); return U.toast('Off your days'); }
      if(a.dataset.a === 'day'){
        const field = await U.dayField('vp-day', v.day || await Data.currentDay());
        App.sheet(`<h2 style="margin:0 0 4px">${v.day ? 'Move the shoot' : 'Put the shoot on a day'}</h2>
          <p class="hintline" style="margin:0 0 12px">A shoot task with these steps and this shot page — frames, shoot mode, and on your phone.</p>
          ${field}
          <div class="sheetcta"><button class="btn-primary" data-ok>Save</button><button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
          U.wireDayField(sh, 'vp-day');
          sh.addEventListener('click', async ev => {
            if(ev.target.closest('[data-no]')) return App.closeSheet();
            if(!ev.target.closest('[data-ok]')) return;
            const day = await U.readDayField(sh, 'vp-day');
            if(day == null) return U.toast('Pick a day');
            await Videos.schedule(await Videos.get(id), day);
            App.closeSheet();
            await load(); render(); changed();
            U.toast('On your days — the steps go with it');
          });
        });
      }
    });

    await load();
    render();
  }

  Screens.register('video-page', mount);
})(window);
