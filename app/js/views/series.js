/* Series — hero plus list. Progress is counted from clips, not stored. */
(function(global){
  const { generatedArt, slug } = U;
  const STATE = { live:"Live", draft:"Draft", done:"Wrapped" };
  const DAY = 86400000;

  function until(ts){
    if(!ts) return { big:'—', sub:'not scheduled', chip:'NO DROP SCHEDULED' };
    const ms = ts - Date.now();
    const d = Math.max(0, Math.floor(ms / DAY));
    const h = Math.max(0, Math.floor((ms % DAY) / 3600000));
    const date = new Date(ts).toLocaleDateString(undefined, { month:'short', day:'numeric' });
    return { big:date, sub: d === 0 ? 'today' : `in ${d} day${d===1?'':'s'}`, chip:`NEXT DROP IN ${d}D ${h}H` };
  }

  let root;
  let CHANNELS = [];      /* a series runs on one of your channels, like a video does */
  let chanFilter = 'all', stageFilter = 'all';

  async function render(el){
    await loadChannels();
    el.className = 'view';
    const [hero, list] = await Promise.all([Data.activeSeries(), Data.seriesWithProgress()]);

    /* channel narrows which series; stage narrows to the ones with work of that
       kind waiting, so "what needs editing" is one tap rather than a read-through */
    const inChannel = chanFilter === 'all' ? list
      : chanFilter === 'none' ? list.filter(x => !x.channel)
      : list.filter(x => x.channel === chanFilter);
    const shown = stageFilter === 'all' ? inChannel
      : stageFilter === 'raw' ? inChannel.filter(x => (x.raw || 0) > 0)
      : stageFilter === 'queued' ? inChannel.filter(x => (x.queued || 0) > 0)
      : inChannel.filter(x => (x.done || 0) > 0);
    const u = until(hero && hero.nextDrop);

    el.innerHTML = `
    <style>
      .hero2{border:1px solid var(--line);border-radius:var(--r);overflow:hidden;background:var(--surface-1)}
      .hero2 .art2{position:relative;height:190px;background-size:cover;background-position:center 34%}
      .hero2 .art2::after{content:"";position:absolute;inset:0;
        background:linear-gradient(180deg,rgba(10,8,6,.38) 0%,rgba(10,8,6,.10) 32%,rgba(10,8,6,.72) 76%,rgba(10,8,6,.94) 100%)}
      .timer{position:absolute;left:12px;top:12px;z-index:2;background:rgba(10,8,6,.86);border-radius:var(--r);
        padding:8px 13px;display:flex;align-items:center;gap:8px;font-family:var(--display);font-weight:900;
        font-size:14px;letter-spacing:.09em;color:var(--amber)}
      .timer i{width:8px;height:8px;border-radius:50%;background:var(--orange)}
      .heroText{position:absolute;left:14px;right:14px;bottom:12px;z-index:2}
      .heroText h2{font-family:var(--display);font-weight:900;font-size:30px;letter-spacing:-.025em;
        line-height:1.04;margin:0;color:#fff;text-shadow:0 1px 4px rgba(10,8,6,.5)}
      .statusrow{display:flex;align-items:center;gap:14px;padding:16px 14px}
      .statusrow .badge{width:44px;height:44px;flex:0 0 44px;border-radius:var(--r);background:var(--surface-2);
        border:1px solid #35302A;display:flex;align-items:center;justify-content:center;color:var(--amber)}
      .statusrow .badge svg{width:22px;height:22px}
      .statusrow .t{font-family:var(--display);font-weight:900;font-size:13px;letter-spacing:.13em;
        text-transform:uppercase;color:var(--orange);margin:0 0 5px}
      .statusrow .v{font-family:var(--display);font-weight:900;font-size:23px;letter-spacing:-.02em;margin:0}
      .dash{border-top:1px dashed #3A352E}
      .statgrid{display:grid;grid-template-columns:1fr 1fr}
      .statcell{padding:18px 14px;text-align:center}
      .statcell.v2{border-left:1px dashed #3A352E}
      .statcell .k{font-family:var(--display);font-weight:900;font-size:12.5px;letter-spacing:.15em;
        text-transform:uppercase;color:var(--muted);margin:0 0 10px}
      .statcell .n{font-family:var(--display);font-weight:900;font-size:27px;letter-spacing:-.02em;margin:0}
      .statcell .s{font-size:14px;color:var(--muted);margin:7px 0 0}
      .heroCta{padding:14px}
    </style>

    <div class="pagehead"><h1 class="page-title">Series</h1>
      <span class="headacts" style="display:flex;gap:8px;align-items:center">
        <button class="iconbtn" data-clips aria-label="All clips" style="width:34px;height:34px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="M15.5 10.5L21.5 7.5v9l-6-3z"/></svg>
        </button>
        <button class="headbtn" data-import>IMPORT</button>
        <button class="headbtn" data-new>NEW</button>
      </span></div>

    ${hero ? `
    <div class="hero2">
      <div class="art2" style="background-image:${generatedArt(hero.id, hero.title, 360, 190)}">
        <span class="timer"><i></i>${u.chip}</span>
        <div class="heroText">
          <p class="caps amber" style="font-size:13px;margin:0 0 6px">Active series · ${hero.total} episodes · ${
            (hero.days && hero.days.length) ? U.daysLabel(hero.days).toLowerCase() : hero.cadence.toLowerCase()}</p>
          <h2>${hero.title}</h2>
        </div>
      </div>
      <div class="statusrow">
        <span class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="14" height="12" rx="2"/><path d="M16.5 10.5L22 8v8l-5.5-2.5z"/></svg></span>
        <div><p class="t">You're on</p><p class="v">Episode ${hero.done + 1} of ${hero.total}</p></div>
      </div>
      <div class="dash"></div>
      <div class="statgrid">
        <div class="statcell"><p class="k">Published</p><p class="n">${hero.done}</p><p class="s">of ${hero.total}</p></div>
        <div class="statcell v2"><p class="k">Next drop</p><p class="n">${u.big}</p><p class="s">${u.sub}</p></div>
      </div>
      <div class="dash"></div>
      <div class="heroCta" style="display:flex;gap:8px">
        <button class="btn-primary" data-open="${hero.id}">Open series</button>
        <button class="btn-ghost" data-edit="${hero.id}">Edit</button></div>
    </div>` : ''}

    <!-- the same pair as Videos: which channel, then where the work stands -->
    <div class="vidbar">
      <select id="sf-c" class="pgbar">
        <option value="all" ${chanFilter === 'all' ? 'selected' : ''}>All channels · ${list.length}</option>
        ${CHANNELS.map(c => {
          const cn = list.filter(x => x.channel === c.n).length;
          return `<option value="${(c.n || '').replace(/"/g,'&quot;')}"
            ${chanFilter === c.n ? 'selected' : ''}>${c.n} · ${cn}</option>`;
        }).join('')}
        ${list.some(x => !x.channel)
          ? `<option value="none" ${chanFilter === 'none' ? 'selected' : ''}>No channel · ${
              list.filter(x => !x.channel).length}</option>` : ''}
      </select>

      <select id="sf-s" class="pgbar">
        <option value="all" ${stageFilter === 'all' ? 'selected' : ''}>Everything · ${shown.length}</option>
        <option value="raw" ${stageFilter === 'raw' ? 'selected' : ''}>Needs editing · ${
          inChannel.reduce((n, x) => n + (x.raw || 0), 0)}</option>
        <option value="queued" ${stageFilter === 'queued' ? 'selected' : ''}>Needs publishing · ${
          inChannel.reduce((n, x) => n + (x.queued || 0), 0)}</option>
        <option value="posted" ${stageFilter === 'posted' ? 'selected' : ''}>Published · ${
          inChannel.reduce((n, x) => n + (x.done || 0), 0)}</option>
      </select>
    </div>

    <div class="sec"><h2>${stageFilter === 'all' ? 'All series'
      : stageFilter === 'raw' ? 'Waiting on an edit'
      : stageFilter === 'queued' ? 'Waiting to go out' : 'Published'}</h2>
      <div class="rule"></div><span class="alt">${shown.length}</span></div>
    <div class="list">
      ${shown.map(s => `<article class="mediacard"><div class="card" data-open="${s.id}">
        <div class="art" style="background-image:${generatedArt(s.id, s.title)}"></div>
        <span class="state ${s.state}">${STATE[s.state]}</span>
        <div class="body"><h3>${s.title}</h3>
          <div class="meta">${s.channel
            ? `<span data-chan="${s.channel.replace(/"/g,'&quot;')}" role="button"
                 style="color:${chanColour(s.channel)}">${s.channel}</span><span class="sep">|</span>`
            : ''}
            <span>${(s.days && s.days.length) ? U.daysLabel(s.days) : s.cadence}</span><span class="sep">|</span>
            <span class="st">${s.done} / ${s.total} out</span><span class="sep">|</span>
            <span class="st">${s.raw || 0} to edit</span><span class="sep">|</span>
            <span class="st">${s.queued || 0} to post</span><span class="sep">|</span>
            <span class="st">${s.clips} clip${s.clips===1?'':'s'}</span></div></div>
        <div class="progress"><i style="width:${s.pct}%"></i></div>
      </div></article>`).join('')}
    </div>`;
  }

  /* ---- create / edit ---- */
  const CADENCES = ['Daily','Weekly','Biweekly','Monthly'];
  /* what kind of videos a series makes — pick any that fit */
  const KINDS = ['Short (vertical)','Long-form','Vlog','How-to','Talking head','Review',
                 'Multi-part build','Behind the scenes','Podcast','Live'];

  /* A series used to say "Weekly" and nothing about which day. Turning that into
     real days keeps the old ones readable rather than blanking them. */
  const cadenceToDays = c => c === 'Daily' ? [1,2,3,4,5,6,0] : c === 'Weekly' ? [0] : [];
  const STATES = [['live','Live'],['draft','Draft'],['done','Wrapped']];

  async function loadChannels(){
    try { CHANNELS = await Channels.all(); } catch(e){ CHANNELS = []; }
  }

  /* the channel's own colour, so a wall of series sorts itself by eye */
  const chanColour = name => {
    const c = CHANNELS.find(x => x.n === name);
    return c && c.c ? c.c : 'var(--muted)';
  };

  function form(rec){
    const r = rec || { title:'', cadence:'Weekly', total:8, state:'draft', nextDrop:null, active:false };
    const dateVal = r.nextDrop ? new Date(r.nextDrop).toISOString().slice(0,10) : '';
    return `
    <h2>${rec ? 'Edit series' : 'New series'}</h2>
    <div class="field"><label for="s-title">Title</label>
      <input id="s-title" type="text" value="${r.title.replace(/"/g,'&quot;')}" placeholder="Shop Build Diaries" autocomplete="off">
      <p class="err" id="s-err" hidden>Give the series a title first.</p></div>
    <div class="field"><label for="s-chan">Channel</label>
      ${(() => {
        /* "Can I Get A Ride" from an import is your "Can i get ride": show it as
           that one rather than listing the same channel twice */
        const near = r.channel && !CHANNELS.some(c => c.n === r.channel) && Channels.match
          ? Channels.match(r.channel, CHANNELS) : null;
        const cur = near ? near.n : r.channel;
        return `<select id="s-chan" class="unit">
        <option value="">No channel yet</option>
        ${CHANNELS.map(c => `<option value="${(c.n || '').replace(/"/g,'&quot;')}"
          ${cur === c.n ? 'selected' : ''}>${c.n}</option>`).join('')}
        ${cur && !CHANNELS.some(c => c.n === cur)
          ? `<option value="${cur.replace(/"/g,'&quot;')}" selected>${cur} (not set up)</option>` : ''}
      </select>
      ${near ? `<p class="hintline" style="margin-top:6px;color:var(--orange)">Saved as "${String(r.channel).replace(/</g,'&lt;')}" —
        it'll be filed under ${String(near.n).replace(/</g,'&lt;')} when you save.</p>` : ''}`;
      })()}
      <!-- what the chosen channel is for, if you wrote it down. This is the
           moment you want it: choosing where a series belongs. -->
      <p class="hintline" id="s-chanabout"${
        (() => { const c = CHANNELS.find(x => x.n === r.channel);
                 return c && c.about ? '' : ' hidden'; })()}>${
        (() => { const c = CHANNELS.find(x => x.n === r.channel);
                 return c && c.about ? String(c.about).replace(/</g, '&lt;') : ''; })()}</p>
      <p class="hintline" style="margin-top:6px">${CHANNELS.length ? "A channel's colour and name live in"
        : 'No channels set up yet —'} <button type="button" data-chans style="padding:0;border:0;background:none;
        color:var(--orange);font:inherit;cursor:pointer;text-decoration:underline">Edit channels</button></p></div>
    <div class="field"><label for="s-about">What it's about</label>
      <textarea id="s-about" rows="3" placeholder="What this series is, who it's for, and what every episode delivers"
        >${String(r.about || '').replace(/</g,'&lt;')}</textarea></div>
    <div class="field"><label for="s-voice">How it should feel <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
      <textarea id="s-voice" rows="2" placeholder="Pace, tone, the thing that makes it this series and not another"
        >${String(r.voice || '').replace(/</g,'&lt;')}</textarea></div>
    <div class="field"><label>Type of videos</label>
      <div class="opts" id="s-kinds">${KINDS.map(k => `<button type="button" class="kopt opt" data-k="${k}"
        aria-pressed="${(r.kinds || []).includes(k)}">${k}</button>`).join('')}</div>
      <input id="s-kinds-more" type="text" style="margin-top:8px" autocomplete="off"
        placeholder="Anything else about the format — length, style, where it's shot"
        value="${String(r.format || '').replace(/"/g,'&quot;')}"></div>
    <div class="field"><label>Which days does one land?</label>
      ${U.dayGrid(r.days && r.days.length ? r.days
        /* only an existing series gets its old cadence read into days — a new
           one starts empty rather than being given a day you did not pick */
        : (rec ? cadenceToDays(r.cadence) : []))}
      <p class="hintline" id="s-dayread" style="margin:8px 0 0"></p></div>
    <div class="field" hidden><div class="opts" data-group="cadence">
      ${CADENCES.map(c => `<button type="button" class="opt" data-v="${c}" aria-pressed="${r.cadence===c}">${c}</button>`).join('')}
    </div></div>
    <div class="field"><label>Status</label><div class="opts" data-group="state">
      ${STATES.map(([v,n]) => `<button type="button" class="opt" data-v="${v}" aria-pressed="${r.state===v}">${n}</button>`).join('')}
    </div></div>
    <div class="field"><label for="s-total">Planned episodes</label>
      <input id="s-total" type="number" min="1" value="${r.total}"></div>
    <div class="field"><label for="s-drop">Next drop <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
      <input id="s-drop" type="date" value="${dateVal}"></div>
    <div class="field"><label>Feature on this tab</label><div class="opts" data-group="active">
      <button type="button" class="opt" data-v="yes" aria-pressed="${!!r.active}">Active series</button>
      <button type="button" class="opt" data-v="no" aria-pressed="${!r.active}">Not featured</button>
    </div></div>
    <div class="sheetcta">
      <button class="btn-primary" data-save>${rec ? 'Save' : 'Create series'}</button>
      <button class="btn-ghost" data-cancel>Cancel</button>
    </div>
    ${rec ? `<button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete series</button>` : ''}`;
  }

  /* when the form is opened from a series' own page, that page redraws (or
     closes, if the series was deleted) after a save */
  let formAfter = null;
  async function openForm(rec, after){
    formAfter = after || null;
    /* the picker is only useful if it knows your channels */
    await loadChannels();
    App.sheet(form(rec), sheetEl => {
      /* the days read back in words, so the grid is not a row of mystery squares */
      const readout = () => {
        const line = sheetEl.querySelector('#s-dayread');
        if(line) line.textContent = U.daysLabel(U.readDayGrid(sheetEl));
      };
      /* keep it in step as you change the choice */
      sheetEl.addEventListener('change', e => {
        if(e.target.id !== 's-chan') return;
        const line = sheetEl.querySelector('#s-chanabout');
        const ch = CHANNELS.find(x => x.n === e.target.value);
        if(!line) return;
        line.textContent = (ch && ch.about) ? ch.about : '';
        line.hidden = !(ch && ch.about);
      });

      U.wireDayGrid(sheetEl, readout);
      readout();

      sheetEl.addEventListener('click', async e => {
        const ko = e.target.closest('.kopt');
        if(ko){ ko.setAttribute('aria-pressed', ko.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); return; }
        const opt = e.target.closest('.opt');
        if(opt){
          opt.closest('.opts').querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed','false'));
          opt.setAttribute('aria-pressed','true'); return;
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(e.target.closest('[data-chans]')){
          App.closeSheet();
          return Screens.push('channels', { onChange:() => { if(root) render(root); } });
        }

        if(e.target.closest('[data-delete]')){
          if(!confirm(`Delete ${rec.title || 'this series'}? Its video ideas go with it; videos further along are kept.`)) return;
          const r = await removeSeries([rec.id]);
          App.closeSheet();
          U.toast(`Series deleted${r.dropped ? ` with ${r.dropped} idea${r.dropped === 1 ? '' : 's'}` : ''}${r.kept ? ` · ${r.kept} kept` : ''}`);
          if(root) render(root);
          if(formAfter){ const f = formAfter; formAfter = null; f({ deleted:true }); }
          return;
        }
        if(!e.target.closest('[data-save]')) return;

        const title = sheetEl.querySelector('#s-title').value.trim();
        if(!title){ sheetEl.querySelector('#s-err').hidden = false; return; }
        const pick = g => sheetEl.querySelector(`[data-group="${g}"] .opt[aria-pressed="true"]`).dataset.v;
        const drop = sheetEl.querySelector('#s-drop').value;

        await Data.saveSeries({
          ...(rec || {}), title,
          channel: sheetEl.querySelector('#s-chan').value,
          cadence: pick('cadence'),
          days: U.readDayGrid(sheetEl),
          state: pick('state'),
          total: Math.max(1, +sheetEl.querySelector('#s-total').value || 1),
          nextDrop: drop ? new Date(drop + 'T09:00').getTime() : null,
          active: pick('active') === 'yes',
          about: sheetEl.querySelector('#s-about').value.trim(),
          voice: sheetEl.querySelector('#s-voice').value.trim(),
          kinds: [...sheetEl.querySelectorAll('#s-kinds .kopt[aria-pressed="true"]')].map(b => b.dataset.k),
          format: sheetEl.querySelector('#s-kinds-more').value.trim()
        });
        App.closeSheet();
        if(root) render(root);
        if(formAfter){ const f = formAfter; formAfter = null; f({ deleted:false }); }
      });
      /* the sheet can be gone by the time this fires */
      setTimeout(() => { const f = sheetEl.querySelector('#s-title'); if(f) f.focus(); }, 180);
    });
  }

  /* Deleting series. The video ideas in them go too — they were only ever
     ideas for that series. Anything further along (planned, shot, editing,
     published) is real work, so it stays, just no longer in a series. */
  async function removeSeries(ids){
    let vids = [];
    try { vids = await Videos.all(); } catch(e){}
    const gone = new Set(ids);
    let dropped = 0, kept = 0;
    for(const v of vids.filter(x => gone.has(x.seriesId))){
      if((v.stage || 'idea') === 'idea'){ await Videos.remove(v.id); dropped++; }
      else { await Videos.save({ ...v, seriesId:null }); kept++; }
    }
    for(const id of ids) await Data.deleteSeries(id);
    return { dropped, kept };
  }

  async function mount(el){
    root = el;
    await render(el);
    /* hold a series to pick several, then delete them together */
    if(global.Select) Select.enable(el, {
      itemSelector: '.mediacard',
      noun: 'series',
      idOf: n => { const c = n.querySelector('[data-open]'); return c ? c.dataset.open : null; },
      warning: 'Their video ideas go with them. Videos already planned, shot, in the edit or published stay, just not in a series.',
      onDelete: async ids => {
        const r = await removeSeries(ids);
        if(r.kept) setTimeout(() => U.toast(`${r.kept} video${r.kept === 1 ? '' : 's'} further along kept`), 400);
      },
      onDone: () => render(root)
    });
    if(!el.dataset.wiredSeries){ el.dataset.wiredSeries = '1';
      /* the channel name opens the channel; the rest of the card opens the series */
      el.addEventListener('click', e => {
        const chn = e.target.closest('[data-chan]');
        if(!chn) return;
        e.stopPropagation();
        Screens.push('channel', { name:chn.dataset.chan, onChange:() => render(root) });
      }, true);
    el.addEventListener('change', e => {
      if(e.target.id === 'sf-c'){ chanFilter = e.target.value; stageFilter = 'all'; return render(root); }
      if(e.target.id === 'sf-s'){ stageFilter = e.target.value; return render(root); }
    });

    el.addEventListener('click', async e => {
      if(e.target.closest('[data-clips]')){ Screens.push('clips-screen', {}); return; }
      /* a CSV or JSON of series and their video ideas, previewed before anything is written */
      if(e.target.closest('[data-import]'))
        return window.PlanImportUI ? PlanImportUI.fromFile(() => render(root)) : U.toast('Import is not available');
      if(e.target.closest('[data-new]')) return openForm(null);
      const op = e.target.closest('[data-open]');
      if(op){
        const list2 = await Data.seriesWithProgress();
        const rec = list2.find(x => x.id === op.dataset.open);
        if(rec) Screens.push('series-view', { id:rec.id, onChange:() => render(root) });
        return;
      }

      const ed = e.target.closest('[data-edit]');
      if(!ed) return;
      const all = await Data.series();
      const rec = all.find(x => x.id === ed.dataset.edit);
      if(rec) openForm(rec);
    });
    }
  }

  /* edit a series from anywhere — its own page uses this */
  async function edit(id, after){
    const rec = (await Data.series()).find(x => x.id === id);
    if(!rec) return U.toast('That series is gone');
    return openForm(rec, after);
  }

  global.ViewSeries = { mount, edit };
})(window);
