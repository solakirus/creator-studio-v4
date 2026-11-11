/* Clips — grouped by the job each needs next (Plan · Shoot · Edit · Post), filtered by channel. */
(function(global){
  const { generatedArt, slug } = U;

  const PLATFORMS = {
    youtube:{ name:"YouTube", dot:"#E2564A" }, shorts:{ name:"Shorts", dot:"#FB6900" },
    tiktok: { name:"TikTok",  dot:"#4FC4B8" }, reels:  { name:"Reels",  dot:"#8B4FC4" }
  };
  const STATE = { posted:"Posted", queued:"Queued", raw:"Raw" };

  /* Clips are grouped by the job they need next, the same four stages the clip
     page uses. A clip's stage is set when you move it on from its page; older
     clips without one are placed from what they already have. */
  const STAGES = ['plan','shoot','edit','post'];
  const STAGE_NAME = { plan:'Plan', shoot:'Shoot', edit:'Edit', post:'Post' };
  const stageOf = c => Versions.stageOf(c);
  const isDone = c => Versions.isPublished(c);

  let rows = [], tab = 'plan', chanFilter = 'all', root;
  let CHANNELS = [];        /* the same list the series filter offers */
  const chanColour = n => (CHANNELS.find(c => c.n === n) || {}).c || 'var(--orange)';
  const inChan = c => chanFilter === 'all' ? true : chanFilter === 'none' ? !c.channel : c.channel === chanFilter;

  /* one line under the title that says where this clip is within its stage */
  function stageLine(c, st){
    const p = c.plan || {};
    const v = p.versions || [];
    const pr = v.length && global.Versions ? Versions.progress(v) : null;
    const beats = (p.beats || []).filter(b => b.trim()).length;
    if(isDone(c)) return pr ? `${pr.posted}/${pr.total} versions posted` : 'Published';
    if(st === 'plan'){
      const r = global.ClipCraft ? ClipCraft.readiness(p) : 0;
      return `${r}% ready to shoot${beats ? ` · ${beats} beats` : ''}`;
    }
    if(st === 'shoot'){
      const needs = global.Versions ? Versions.shootNeeds(v).length : 0;
      return `${beats ? `${beats} beats to film` : 'No flow yet'}${v.length ? ` · ${v.length} versions` : ''}${needs ? ` · ${needs} capture notes` : ''}`;
    }
    if(st === 'edit') return pr ? `${pr.edited}/${pr.total} versions edited` : 'No versions planned';
    return pr ? `${pr.posted}/${pr.total} versions posted` : 'Ready to post';
  }

  function renderTabs(){
    const bar = root.querySelector('#clipTabs');
    if(!bar) return;
    bar.innerHTML = STAGES.map(k => {
      const n = rows.filter(c => inChan(c) && stageOf(c) === k && !isDone(c)).length;
      return `<button role="tab" aria-selected="${tab === k}" data-tab="${k}">${STAGE_NAME[k]}${
        n ? ` <small style="opacity:.6;font-weight:600">${n}</small>` : ''}</button>`;
    }).join('');
  }

  function renderList(){
    renderTabs();
    const inTab = rows.filter(c => stageOf(c) === tab && inChan(c));
    /* in Post, anything already out drops below the ones still to go */
    const open = inTab.filter(c => !isDone(c)), done = inTab.filter(isDone);
    const host = root.querySelector('#clipList');
    if(!host) return;
    const card = c => {
      try {
      const p = PLATFORMS[c.plat] || { name:c.plat, dot:'#888' };
      const planned = c.plan && (c.plan.hook || (c.plan.beats || []).some(b => b.trim()));
      return `<article class="mediacard"><div class="card" data-plan="${c.id}">
        <div class="art" style="background-image:${generatedArt(c.id, c.title)}"></div>
        <!-- The channel leads. Which of yours this belongs to is the thing you
             scan for; the platform matters once you are publishing it, and by
             then you are on the clip itself. -->
        <span class="plat"${c.channel ? ` data-chan="${c.channel.replace(/"/g,'&quot;')}"
          role="button"` : ''}>${c.channel
          ? `<span class="dot" style="background:${chanColour(c.channel)}"></span>${c.channel}`
          : `<span class="dot" style="background:#4A443B"></span>No channel`}</span>
        <span class="dur">${c.dur}</span>
        <div class="body"><h3 style="font-size:21px">${c.title}</h3>
          <!-- The platform sits in the meta line, not over the artwork. Two
               badges on a 92px card overlapped the title; and the platform is
               something you read, not something you scan for. -->
          <div class="meta">
            <span class="st platdot"><span class="dot" style="background:${p.dot}"></span>${p.name}</span>
            <span class="sep">|</span>
            <span class="st">${c.seriesName}</span>
            <span class="sep">|</span><span class="st" style="color:${isDone(c) ? 'var(--green)' : 'var(--orange)'}">
              ${stageLine(c, stageOf(c))}</span>
            <span class="sep">|</span>
            <span class="st" data-edit="${c.id}" style="color:var(--muted)">edit details</span>
          </div></div>
        ${(() => { const st = Lifecycle.stage(c.stage || 'idea');
          return `<span class="stat" style="background:${st.c};color:#151515">${st.label}</span>`;
        })()}
        <div class="progress"><i style="width:${(() => {
          const v = (c.plan && c.plan.versions) || [];
          if(v.length && global.Versions){
            const pr = Versions.progress(v);
            return stageOf(c) === 'post' ? pr.pctPosted : pr.pctEdited;
          }
          return c.pct || 0;
        })()}%"></i></div>
      </div></article>`;
      } catch(err){
        console.warn('Clip row failed', c && c.id, err);
        return `<article class="mediacard"><div class="card" data-edit="${c.id}">
          <div class="body"><h3 style="font-size:19px">${(c && c.title) || 'Untitled'}</h3></div>
        </div></article>`;
      }
    };
    const EMPTY = {
      plan:'New clips start here. Tap + to add one.',
      shoot:'Nothing waiting to be filmed. Move a clip here from its Plan tab when it is ready.',
      edit:'Nothing in the edit. Clips land here once they are shot.',
      post:'Nothing ready to go out yet.'
    };
    host.innerHTML = (open.length ? open.map(card).join('')
        : `<div class="empty"><b>Nothing in ${STAGE_NAME[tab]}</b>${EMPTY[tab]}</div>`) +
      (done.length ? `<p class="note" style="text-align:left;margin:18px 0 10px;letter-spacing:.14em;
          text-transform:uppercase;font-weight:800;font-size:12px">Posted · ${done.length}</p>` +
        done.map(card).join('') : '');
  }

  async function reload(){
    rows = (await Data.clipsWithSeries()).sort((a,b) => b.createdAt - a.createdAt);
    const c = root.querySelector('.count');
    if(c) c.textContent = rows.length;
    renderList();
  }

  async function mount(el){
    root = el;
    root.className = 'view flush';
    rows = (await Data.clipsWithSeries()).sort((a,b) => b.createdAt - a.createdAt);
    try { CHANNELS = await Channels.all(); } catch(e){ CHANNELS = []; }

    root.innerHTML = `
    <div class="pad">
      <div class="pagehead">
        <h1 class="page-title">Clips</h1><span class="count">${rows.length}</span>
        <div class="headacts">
          <!-- the way into the channel pages, the same idea as the clips button
               that sits on Series -->
          <button class="sq" data-chans aria-label="Channels"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="7" r="2.6"/><circle cx="6" cy="17" r="2.6"/><path d="M11 7h9M11 17h9"/></svg></button>
          <button class="sq" aria-label="Import"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 11l4 4 4-4M4 20h16"/></svg></button>
          <button class="sq" data-new aria-label="New clip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>
          <span class="avatar">K</span>
        </div>
      </div>
      <div class="segmented" role="tablist" id="clipTabs"></div>
    </div>
    <!-- the stage is the tabs above; channel is the one filter left -->
    <div class="pad"><div class="vidbar">
      <select id="cl-c" class="pgbar">
        <option value="all">All channels · ${rows.length}</option>
        ${/* Your channels, the same list the series filter uses — deriving them
              from the clips meant a channel with nothing in it yet simply was
              not offered, so the two filters disagreed. */
          CHANNELS.map(c => `<option value="${(c.n || '').replace(/"/g,'&quot;')}"
            ${chanFilter === c.n ? 'selected' : ''}>${c.n} · ${
            rows.filter(x => x.channel === c.n).length}</option>`).join('')}
        ${[...new Set(rows.map(c => c.channel).filter(Boolean))]
          .filter(ch => !CHANNELS.some(c => c.n === ch)).sort().map(ch =>
          `<option value="${ch}" ${chanFilter === ch ? 'selected' : ''}>${ch} · ${
            rows.filter(c => c.channel === ch).length}</option>`).join('')}
        ${rows.some(c => !c.channel)
          ? `<option value="none" ${chanFilter === 'none' ? 'selected' : ''}>No channel · ${
              rows.filter(c => !c.channel).length}</option>` : ''}
      </select>
    </div></div>
    <div class="pad"><div class="list" id="clipList"></div></div>`;

    /* hold a clip to start picking several, then delete them together */
    if(global.Select) Select.enable(root, {
      itemSelector: '.mediacard',
      noun: 'clip',
      idOf: n => {
        const el2 = n.querySelector('[data-plan],[data-edit]');
        return el2 ? (el2.dataset.plan || el2.dataset.edit) : null;
      },
      warning: 'The clips go for good. Anything they were cut from stays.',
      onDelete: async ids => { for(const id of ids) await Data.deleteClip(id); },
      onDone: reload
    });

    if(!root.dataset.wiredClips){
      root.dataset.wiredClips = '1';
      root.addEventListener('change', e => {
        if(e.target.id === 'cl-c'){ chanFilter = e.target.value; return renderList(); }
      });

      root.addEventListener('click', e => {
      const t = e.target.closest('[data-tab]');
      if(t){ tab = t.dataset.tab; renderList(); return; }

      if(e.target.closest('[data-new]')) return openForm(null);
      if(e.target.closest('[data-chans]'))
        return Screens.push('channels-list', { onChange:reload });

      /* the badge opens the channel; anywhere else on the card opens the clip */
      const chn = e.target.closest('[data-chan]');
      if(chn){
        e.stopPropagation();
        return Screens.push('channel', { name:chn.dataset.chan, onChange:reload });
      }

      const ed = e.target.closest('[data-edit]');
      if(ed){ e.stopPropagation(); return openForm(rows.find(x => x.id === ed.dataset.edit)); }
      const pl = e.target.closest('[data-plan]');
      if(pl) Screens.push('clip', { id: pl.dataset.plan, tab,
          onEdit: c => { App.closeSheet(); openForm(rows.find(x => x.id === c.id)); },
          onChange: reload });
      });
    }

    renderList();
  }

  /* ---- create / edit ---- */
  const STATES = [['raw','Raw'],['queued','Queued'],['posted','Posted']];

  async function form(rec){
    const all = await Data.series();
    const r = rec || { title:'', plat:'youtube', dur:'', channel:'',
                       seriesId:(all[0] && all[0].id) || null, stage:'idea' };
    /* a clip made before channels existed has none; that is a real state, not
       a missing one, so it gets its own option rather than a blank */
    const chans = CHANNELS.length ? CHANNELS : await (async () => {
      try { return await Channels.all(); } catch(e){ return []; }
    })();
    return `
    <h2>${rec ? 'Edit clip' : 'New clip'}</h2>
    <div class="field"><label for="c-title">Title</label>
      <input id="c-title" type="text" value="${(r.title||'').replace(/"/g,'&quot;')}" placeholder="Rack teardown — cold open" autocomplete="off">
      <p class="err" id="c-err" hidden>Give the clip a title first.</p></div>
    <div class="field"><label>Channel</label><div class="opts" data-group="chan">
      <button type="button" class="opt" data-v="" aria-pressed="${!r.channel}">No channel</button>
      ${chans.map(x => `<button type="button" class="opt" data-v="${(x.n || '').replace(/"/g,'&quot;')}"
        aria-pressed="${r.channel === x.n}">${x.n}</button>`).join('')}
    </div>
    ${(() => { const c = chans.find(x => x.n === r.channel);
       return c && c.about ? `<p class="hintline">${String(c.about).replace(/</g,'&lt;')}</p>` : ''; })()}
    </div>
    <div class="field"><label>Platform</label><div class="opts" data-group="plat">
      ${Object.entries(PLATFORMS).map(([k,p]) =>
        `<button type="button" class="opt" data-v="${k}" aria-pressed="${r.plat===k}">${p.name}</button>`).join('')}
    </div></div>
    <div class="field"><label>Stage</label><div class="opts" data-group="stage">
      ${Lifecycle.STAGES.map(st => `<button type="button" class="opt" data-v="${st.k}"
        aria-pressed="${(r.stage || 'idea') === st.k}">${st.label}</button>`).join('')}
    </div></div>
    <div class="field"><label>Series</label><div class="opts" data-group="series">
      ${all.map(x => `<button type="button" class="opt" data-v="${x.id}" aria-pressed="${r.seriesId===x.id}">${x.title}</button>`).join('')}
      <button type="button" class="opt" data-v="" aria-pressed="${!r.seriesId}">Unassigned</button>
    </div></div>
    <div class="field"><label for="c-dur">Duration</label>
      <input id="c-dur" type="text" value="${r.dur||''}" placeholder="0:42" autocomplete="off"></div>
    <div class="sheetcta">
      <button class="btn-primary" data-save>${rec ? 'Save' : 'Add clip'}</button>
      <button class="btn-ghost" data-cancel>Cancel</button>
    </div>
    ${rec ? `<button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete clip</button>` : ''}`;
  }

  async function openForm(rec){
    const html = await form(rec);
    App.sheet(html, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        const opt = e.target.closest('.opt');
        if(opt){
          opt.closest('.opts').querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed','false'));
          opt.setAttribute('aria-pressed','true'); return;
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(e.target.closest('[data-delete]')){
          await Data.deleteClip(rec.id); App.closeSheet(); U.toast('Clip deleted'); reload(); return;
        }
        if(!e.target.closest('[data-save]')) return;

        const title = sheetEl.querySelector('#c-title').value.trim();
        if(!title){ sheetEl.querySelector('#c-err').hidden = false; return; }
        const pick = g => {
          const on = sheetEl.querySelector(`[data-group="${g}"] .opt[aria-pressed="true"]`);
          return on ? on.dataset.v : '';
        };
        const stage = pick('stage') || 'idea';

        await Data.saveClip({
          ...(rec ? { ...rec, id:rec.id, createdAt:rec.createdAt } : {}),
          title, plat:pick('plat'), stage,
          channel: pick('chan'),
          seriesId: pick('series') || null,
          dur: sheetEl.querySelector('#c-dur').value.trim() || '0:00',
          pct: Data.PCT_FOR[Lifecycle.TO_CLIP[stage] || 'raw']
        });
        App.closeSheet();
        Celebrate.showAwards();
        reload();
      });
      setTimeout(() => { const f = sheetEl.querySelector('#c-title'); if(f) f.focus(); }, 180);
    });
  }

  global.ViewClips = { mount };
})(window);
