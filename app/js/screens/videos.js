/* The one-off videos: a board by stage, and the sheet behind each one. */
(function(){

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  async function mount(el, params){
    const embedded = !!(params && params.embedded);
    let list = [], chans = [], runs = [], today = 1;
    let chanFilter = 'all', filter = 'all';

    async function load(){
      list = await Videos.all();
      try { chans = await Channels.all(); } catch(e){ chans = []; }
      try { runs = await Data.series(); } catch(e){ runs = []; }
      try { today = await Data.currentDay(); } catch(e){ today = 1; }
    }

    const chanColour = name => {
      const c = chans.find(x => x.n === name);
      return c ? c.c : 'var(--dim)';
    };

    /* Same card as a series: generated artwork, a state chip, a meta line and a
       progress bar. A video has no episode count, so the bar shows how far along
       the stages it is. */
    function card(v){
      const st = Videos.stage(v.stage);
      const i = Videos.STAGES.findIndex(x => x.k === v.stage);
      const pct = Math.round(((i + 1) / Videos.STAGES.length) * 100);
      const when = v.day ? (v.day === today ? 'today' : v.day < today
        ? `day ${v.day} · passed` : `day ${v.day}`) : 'no day yet';
      return `
        <article class="mediacard"><div class="card" data-open="${v.id}">
          <div class="art" style="background-image:${U.generatedArt(v.id, v.title)}"></div>
          <span class="state" style="background:${st.c};color:#151515">${st.label}</span>
          <div class="body"><h3>${esc(v.title)}</h3>
            <div class="meta">
              <span style="color:${chanColour(v.channel)}">${esc(v.channel || 'No channel')}</span>
              <span class="sep">|</span><span class="st">${when}</span>
              ${(v.tags || []).length ? `<span class="sep">|</span>
                <span class="st">${v.tags.map(t => '#' + esc(t)).join(' ')}</span>` : ''}
            </div>
          </div>
          <div class="progress"><i style="width:${pct}%"></i></div>
        </div></article>`;
    }

    function render(){
      const tags = [...new Set(list.flatMap(v => v.tags || []))].sort();
      /* channel narrows the pile; stage says where in the run each one is */
      const inChannel = chanFilter === 'all' ? list
        : chanFilter === 'none' ? list.filter(v => !v.channel)
        : list.filter(v => v.channel === chanFilter);

      const shown = filter === 'all' ? inChannel
        : filter.startsWith('#') ? inChannel.filter(v => (v.tags || []).includes(filter.slice(1)))
        : inChannel.filter(v => v.stage === filter);
      const n = Videos.counts(inChannel);
      const unassigned = list.filter(v => !v.channel).length;

      el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Creator studio', title:'Videos' })) + `
        <div class="view">
          <!-- the page head Series uses, so the three sections read as one place -->
          <div class="pagehead"><h1 class="page-title">Videos</h1>
            <span class="headacts" style="display:flex;gap:8px;align-items:center">
              <button class="headbtn" data-a="new">NEW</button>
            </span></div>

          <!-- Two dropdowns rather than two rows of chips: with a few channels and
               five stages the chips filled the screen before a single video did. -->
          <div class="vidbar">
            <select id="vf-c" class="pgbar">
              <option value="all" ${chanFilter === 'all' ? 'selected' : ''}>All channels · ${list.length}</option>
              ${chans.map(c => {
                const cn = list.filter(v => v.channel === c.n).length;
                return `<option value="${esc(c.n)}" ${chanFilter === c.n ? 'selected' : ''}
                  >${esc(c.n)} · ${cn}</option>`;
              }).join('')}
              ${unassigned ? `<option value="none" ${chanFilter === 'none' ? 'selected' : ''}
                >No channel · ${unassigned}</option>` : ''}
            </select>

            <select id="vf-s" class="pgbar">
              <option value="all" ${filter === 'all' ? 'selected' : ''}>Every stage · ${inChannel.length}</option>
              ${Videos.STAGES.map(st =>
                `<option value="${st.k}" ${filter === st.k ? 'selected' : ''}
                  >${st.label} · ${n[st.k] || 0}</option>`).join('')}
              ${tags.length ? `<optgroup label="Tags">${tags.map(t =>
                `<option value="#${esc(t)}" ${filter === '#' + t ? 'selected' : ''}>#${esc(t)}</option>`).join('')}
                </optgroup>` : ''}
            </select>
          </div>

          <div class="sec"><h2>${filter === 'all' ? 'All videos'
            : filter.startsWith('#') ? filter : Videos.stage(filter).label}</h2>
            <div class="rule"></div><span class="alt">${shown.length}</span></div>

          ${shown.length ? `<div class="list">${shown.map(card).join('')}</div>`
            : `<div class="empty"><b>${list.length ? 'Nothing here' : 'No videos yet'}</b>
                ${list.length
                  ? 'Nothing matches that filter.'
                  : 'A one-off for one channel — not a series, not an episode. Add one and give it a day.'}</div>`}
        </div>`;
    }

    /* ---------- the sheet ---------- */

    /* the sheet lives in its own module now, so a series can open it too */
    const editor = v => VideoSheet.open(v, { onDone: async () => { await load(); render(); } });

    /* Mount runs again on every visit to this tab. Attaching a listener each
       time stacks them; attaching only on the first leaves that listener bound
       to the first mount's stale data. So one listener is attached once and
       always calls whatever the newest mount put here. */
    if(!el.dataset.wiredVideos){
      el.dataset.wiredVideos = '1';
      el.addEventListener('click', e => el.__onClick && el.__onClick(e));
      el.addEventListener('change', e => el.__onChange && el.__onChange(e));
    }

    el.__onChange = (e => {
      if(e.target.id === 'vf-c'){ chanFilter = e.target.value; filter = 'all'; return render(); }
      if(e.target.id === 'vf-s'){ filter = e.target.value; return render(); }
    });

    el.__onClick = (async e => {
      if(e.target.closest('[data-a="new"]')) return editor(Videos.blank());

      const open = e.target.closest('[data-open]');
      if(open){
        const v = list.find(x => x.id === open.dataset.open);
        if(v) editor(v);
      }
    });

    await load();
    render();
  }

  Screens.register('videos', mount);
})();
