/* Planning a clip before it exists: the hook, the flow, the shots, and what you
   want people to do at the end. Everything here is what you would otherwise
   scribble in notes before a shoot. */
(function(){
  const { ICON } = U;

  const LENGTHS = [
    { v:'short',  n:'Under 60s' },
    { v:'mid',    n:'1 – 5 min' },
    { v:'long',   n:'5 min +' }
  ];
  const CHEV = '<svg class="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  /* The clip page is split by stage so you only see what the job in hand needs.
     A section can sit on more than one tab; it is the same data either way. */
  const TABS = {
    plan:  ['ready','purpose','type','audience','promise','hook','retain','flow','length','cta','script','refs'],
    shoot: ['needs','shots','flow','script','notes','refs','toshoot'],
    edit:  ['versions','script','length','refs','notes'],
    post:  ['versions','cuts','titles','caption','keywords','metric','where']
  };
  const TAB_NAME = { plan:'Plan', shoot:'Shoot', edit:'Edit', post:'Post' };
  const TAB_NOTE = {
    plan:  'Decide what this clip is, who it is for, and how it flows.',
    shoot: 'What to capture on the day — the flow, the lines, and what every version needs.',
    edit:  'Cut each version. Tap the circle when one is edited.',
    post:  'Titles, caption and tags — then tick each version as it goes out.'
  };
  /* where each readiness gap lives */
  const GAP_TAB = { titles:'post', thumb:'post', metric:'post' };

  function injectVersionCSS(){
    if(document.getElementById('v-css')) return;
    const st = document.createElement('style');
    st.id = 'v-css';
    st.textContent = `
    .vt-pick{display:block;width:100%;text-align:left;padding:11px 12px;margin:0 0 7px;cursor:pointer;
      border:1px solid #2B2822;border-radius:var(--r);background:var(--surface-2);color:var(--cream)}
    .vt-pick b{display:block;font-size:15px}
    .vt-pick small{display:block;margin-top:3px;font-size:12.5px;color:var(--muted);line-height:1.4}
    .v-prog{margin:0 0 14px}
    .v-bar{position:relative;height:9px;border-radius:5px;background:var(--surface-1);overflow:hidden}
    .v-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:5px}
    .v-bar i.ed{background:rgba(245,158,11,.45)}
    .v-bar i.po{background:var(--green)}
    .v-stats{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px;font-size:13px;color:var(--muted)}
    .v-stats b{color:var(--cream)}
    .v-done{margin:8px 0 0;font-size:14px;color:var(--green)}
    .v-list{display:flex;flex-direction:column;gap:6px}
    .v-row{display:flex;align-items:center;gap:9px;padding:7px 8px;border:1px solid #2B2822;
      border-radius:var(--r);background:var(--surface-2)}
    .v-row.on{border-color:var(--orange)}
    .v-state{flex:0 0 30px;width:30px;height:30px;border-radius:50%;padding:0;cursor:pointer;
      border:2px solid #4A453C;background:transparent;color:#151515;display:flex;align-items:center;justify-content:center}
    .v-state svg{width:16px;height:16px}
    .v-state.edited{background:#F59E0B;border-color:#F59E0B}
    .v-state.posted{background:var(--green);border-color:var(--green)}
    .v-name{flex:1;min-width:0;padding:0;border:0;background:none;color:var(--cream);text-align:left;cursor:pointer}
    .v-name b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .v-name small{display:block;font-size:12px;color:var(--muted);margin-top:1px}
    .v-plats{display:flex;gap:4px;flex:0 0 auto}
    .v-plats button{font-size:10.5px;font-weight:800;letter-spacing:.04em;padding:5px 6px;border-radius:4px;
      border:1px solid #3A362F;background:transparent;color:var(--dim);cursor:pointer}
    .v-plats button[aria-pressed="true"]{background:var(--cream);border-color:var(--cream);color:#151515}
    .v-focus{padding:12px;margin:0 0 12px;border:1px solid var(--orange);border-radius:var(--r);
      background:rgba(251,105,0,.06)}
    .v-fhead{display:flex;align-items:center;justify-content:space-between;margin:0 0 4px}
    .v-fhead .k{font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--orange)}
    .v-x{border:0;background:none;color:var(--muted);font-size:20px;cursor:pointer;padding:0 4px}
    .v-fname{width:100%;background:transparent;border:0;border-bottom:1px solid #3A362F;color:var(--cream);
      font-size:19px;font-weight:800;padding:4px 0 6px;margin:0 0 10px;outline:none}
    .v-guide{margin:0 0 8px;font-size:14.5px;line-height:1.55;color:var(--cream)}
    .v-need{margin:0 0 10px;font-size:13.5px;line-height:1.5;color:#F59E0B}
    .v-fref,.v-factions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
    .v-needs{display:flex;flex-direction:column;gap:3px;padding:10px 12px;margin:0 0 12px;font-size:13.5px;
      color:var(--muted);border:1px dashed #3A362F;border-radius:var(--r)}
    .v-needs b{color:var(--cream);margin-bottom:3px}
    .v-foot{display:flex;flex-direction:column;gap:6px}
    `;
    document.head.appendChild(st);
  }

  async function mount(el, params){
    let clip = null;
    const id = params && params.id;
    let tpls = [];            /* version templates, built-in and your own */
    let focusV = null;        /* the version you are working on right now */
    let refsOpen = null;      /* remembers whether References was left open */
    let swipeTitles = {};     /* titles for swipes linked to single versions */
    let tab = null;           /* plan · shoot · edit · post */
    injectVersionCSS();

    async function load(){
      clip = await Store.get('clips', id);
      if(!clip) return;
      clip.plan = clip.plan || {};
      const d = { hook:'', beats:[], cta:'', caption:'', tags:'', length:'short', notes:'',
                  purpose:'', type:'', audience:'', promise:'', payoff:'',
                  hookStyle:'', retain:'', ctaType:'', metric:'',
                  titles:['','',''], thumb:'', keywords:'', script:'',
                  versions:[], swipeIds:[] };
      clip.plan = { ...d, ...clip.plan };
      if(!Array.isArray(clip.plan.beats)) clip.plan.beats = [];
      if(!Array.isArray(clip.plan.titles)) clip.plan.titles = ['','',''];
      while(clip.plan.titles.length < 3) clip.plan.titles.push('');
      if(!Array.isArray(clip.plan.versions)) clip.plan.versions = [];
      if(!Array.isArray(clip.plan.swipeIds)) clip.plan.swipeIds = [];
      tpls = await Versions.templates();
      if(!tab) tab = (params && TABS[params.tab] && params.tab) || (TABS[clip.plan.tab] && clip.plan.tab)
        || Versions.stageOf(clip);
      const sw = [...new Set(clip.plan.versions.map(v => v.swipeId).filter(Boolean))];
      swipeTitles = {};
      for(const sid of sw){
        try { const r = await Store.get('swipes', sid); if(r) swipeTitles[sid] = r.title || 'Untitled swipe'; } catch(e){}
      }
    }

    /* Writing on every keystroke would thrash the database, so hold briefly. */
    let timer = null;
    function save(quiet){
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await Data.saveClip(clip);
        if(!quiet) U.toast('Saved');
      }, 400);
    }

    /* Re-rendering on every keystroke would lose the caret, so only the
       structural changes redraw. */
    const words = t => (t || '').trim() ? (t.trim().match(/\S+/g) || []).length : 0;
    /* roughly 150 words a minute spoken, which is a touch slow for shorts and about
       right for anything longer */
    const readTime = t => {
      const s2 = Math.round((words(t) / 150) * 60);
      return s2 < 60 ? `${s2}s` : `${Math.floor(s2/60)}:${String(s2%60).padStart(2,'0')}`;
    };
    const scriptStat = t => words(t) ? `${words(t)} words · ~${readTime(t)}` : 'not written';

    const pick = (set, field, cur) => `<div class="cp-pick">
      ${ClipCraft.SETS[set].map(o => `<button class="cp-opt" data-set="${field}" data-v="${o.v}"
        aria-pressed="${cur === o.v}">
        <span class="tick"></span>
        <span><b>${o.n}</b><small>${o.d}</small></span>
      </button>`).join('')}</div>`;

    function render(){
      const p = clip.plan;
      const ready = ClipCraft.readiness(p);
      const gaps = ClipCraft.gaps(p);
      const scroll = el.querySelector('.view') ? el.querySelector('.view').scrollTop : 0;

      const S = {};
      S.ready = `
        <div class="cp-ready">
          <div class="top"><b>${ready}%</b><span>Ready to shoot</span></div>
          <div class="cp-bar"><i style="width:${ready}%"></i></div>
          ${gaps.length ? gaps.slice(0, 5).map(g =>
            `<button class="cp-gap w${g.w}" data-jump="${g.k}"><i></i>${g.t}<span class="go">fix</span></button>`).join('')
          : `<p style="margin:0;font-size:14px;color:var(--green)">Nothing missing. Go shoot it.</p>`}
        </div>`;
      S.refs = `
        <details class="cp-sec" id="sec-refs"${(refsOpen === null ? p.swipeIds.length > 0 : refsOpen) ? ' open' : ''}>
          <summary>References<span class="n">${p.swipeIds.length
            ? `${p.swipeIds.length} swipe${p.swipeIds.length === 1 ? '' : 's'}` : 'what you are borrowing from'}</span>${CHEV}</summary>
          <div class="cp-body"><div id="swr-slot"></div></div>
        </details>`;
      S.purpose = `
        <details class="cp-sec"${p.purpose ? '' : ' open'}>
          <summary>Purpose<span class="n">${ClipCraft.label('purpose', p.purpose) || 'what is this for'}</span>${CHEV}</summary>
          <div class="cp-body" id="s-purpose">
            <p class="note" style="text-align:left;margin:0 0 12px">A video doing two jobs does neither.
              Pick the one it is really for.</p>
            ${pick('purpose','purpose',p.purpose)}
          </div>
        </details>`;
      S.type = `
        <details class="cp-sec">
          <summary>Type<span class="n">${ClipCraft.label('type', p.type) || 'what they get'}</span>${CHEV}</summary>
          <div class="cp-body" id="s-type">${pick('type','type',p.type)}</div>
        </details>`;
      S.audience = `
        <details class="cp-sec"${p.audience ? '' : ''}>
          <summary>Who it's for<span class="n">${p.audience ? 'named' : 'one person'}</span>${CHEV}</summary>
          <div class="cp-body" id="s-audience">
            <textarea class="cp-hook" data-f="audience" style="min-height:64px"
              placeholder="One specific person. 'A sysadmin who has never set foot in a datacenter' beats 'tech people'.">${p.audience || ''}</textarea>
          </div>
        </details>`;
      S.promise = `
        <details class="cp-sec" open>
          <summary>The promise<span class="n">${p.promise ? 'set' : 'say it in line one'}</span>${CHEV}</summary>
          <div class="cp-body" id="s-promise">
            <textarea class="cp-hook" data-f="promise" style="min-height:64px"
              placeholder="What they get for watching. Has to be clear within the first line.">${p.promise || ''}</textarea>
            <div style="height:10px"></div>
            <textarea class="cp-hook" data-f="payoff" style="min-height:54px"
              placeholder="Where you deliver it — which beat. If it is the last one, say so on purpose.">${p.payoff || ''}</textarea>
          </div>
        </details>`;
      S.hook = `
        <details class="cp-sec" open>
          <summary>Hook<span class="n">${p.hook ? 'written' : 'first 3 seconds'}</span>${CHEV}</summary>
          <div class="cp-body" id="s-hook">
            <textarea class="cp-hook" data-f="hook" placeholder="The line or shot that stops the scroll. Say it out loud — if it takes more than three seconds, cut it down.">${p.hook || ''}</textarea>
            <div style="height:12px"></div>
            <p class="note" style="text-align:left;margin:0 0 10px">How it works</p>
            ${pick('hookStyle','hookStyle',p.hookStyle)}
          </div>
        </details>`;
      S.retain = `
        <details class="cp-sec">
          <summary>Holding the middle<span class="n">${ClipCraft.label('retain', p.retain) || 'where most drop off'}</span>${CHEV}</summary>
          <div class="cp-body" id="s-retain">
            <p class="note" style="text-align:left;margin:0 0 12px">The hook gets them in. This keeps them.
              Pick one and actually build it into the flow.</p>
            ${pick('retain','retain',p.retain)}
          </div>
        </details>`;
      S.flow = `
        <details class="cp-sec" open>
          <summary>Flow<span class="n">${p.beats.length} beat${p.beats.length===1?'':'s'}</span>${CHEV}</summary>
          <div class="cp-body" id="s-beats">
            ${p.beats.length ? p.beats.map((b,i) => `
              <div class="cp-beat">
                <span class="i">${i+1}</span>
                <textarea class="tx" rows="1" data-beat="${i}"
                  placeholder="What happens here">${b}</textarea>
                <span class="mv">
                  <button data-up="${i}" ${i===0?'disabled':''} aria-label="Move up">▲</button>
                  <button data-down="${i}" ${i===p.beats.length-1?'disabled':''} aria-label="Move down">▼</button>
                </span>
                <button class="rm" data-rmbeat="${i}" aria-label="Remove">×</button>
              </div>`).join('')
            : `<p class="note" style="text-align:left;margin:0 0 10px">
                 The order things happen in. Three or four beats is usually enough for a short.</p>`}
            <button class="cp-add" data-a="addbeat">+ Add a beat</button>
          </div>
        </details>`;
      S.length = `
        <details class="cp-sec">
          <summary>Length<span class="n">${(LENGTHS.find(l => l.v === p.length) || LENGTHS[0]).n}</span>${CHEV}</summary>
          <div class="cp-body">
            <div class="cp-len">
              ${LENGTHS.map(l => `<button data-len="${l.v}" aria-pressed="${p.length===l.v}">${l.n}</button>`).join('')}
            </div>
            <p class="note" style="text-align:left;margin:0">Sets how many beats the flow wants.
              A short lives or dies on the hook; a long one needs a reason to stay past minute two.</p>
          </div>
        </details>`;
      S.cta = `
        <details class="cp-sec">
          <summary>Call to action<span class="n">${ClipCraft.label('ctaType', p.ctaType) || 'pick one'}</span>${CHEV}</summary>
          <div class="cp-body" id="s-ctaType">
            ${pick('ctaType','ctaType',p.ctaType)}
            <div style="height:12px"></div>
            <textarea class="cp-hook" data-f="cta" style="min-height:60px"
              placeholder="How you say it, in your words.">${p.cta || ''}</textarea>
          </div>
        </details>`;
      S.titles = `
        <details class="cp-sec">
          <summary>Title and thumbnail<span class="n">${
            (p.titles || []).filter(t => t.trim()).length || 'none'} option${
            (p.titles || []).filter(t => t.trim()).length === 1 ? '' : 's'}</span>${CHEV}</summary>
          <div class="cp-body" id="s-titles">
            <p class="note" style="text-align:left;margin:0 0 12px">Write three and pick the worst one to cut.
              The first title you think of is almost never the best.</p>
            <div class="cp-titles">
              ${[0,1,2].map(i => `<div class="t"><span>${i+1}</span>
                <input type="text" data-title="${i}" value="${(p.titles[i]||'').replace(/"/g,'&quot;')}"
                  placeholder="${i === 0 ? 'The obvious one' : i === 1 ? 'The specific one' : 'The strange one'}"></div>`).join('')}
            </div>
            <div style="height:4px"></div>
            <textarea class="cp-hook" data-f="thumb" style="min-height:60px"
              placeholder="Thumbnail: one subject, one idea, readable at the size of a thumbnail.">${p.thumb || ''}</textarea>
          </div>
        </details>`;
      S.keywords = `
        <details class="cp-sec">
          <summary>Search and discovery<span class="n">${p.keywords ? 'set' : 'how they find it'}</span>${CHEV}</summary>
          <div class="cp-body" id="s-keywords">
            <textarea class="cp-hook" data-f="keywords" style="min-height:60px"
              placeholder="What someone would actually type. Put the main one in the title and say it out loud early.">${p.keywords || ''}</textarea>
          </div>
        </details>`;
      S.metric = `
        <details class="cp-sec">
          <summary>What counts as working<span class="n">${ClipCraft.label('metric', p.metric) || 'decide now'}</span>${CHEV}</summary>
          <div class="cp-body" id="s-metric">
            <p class="note" style="text-align:left;margin:0 0 12px">Decide before you post, so you cannot
              move the goalposts afterwards.</p>
            ${pick('metric','metric',p.metric)}
          </div>
        </details>`;
      S.caption = `
        <details class="cp-sec">
          <summary>Caption and tags<span class="n">${p.caption ? 'drafted' : 'for posting day'}</span>${CHEV}</summary>
          <div class="cp-body">
            <textarea class="cp-hook" data-f="caption" style="min-height:88px"
              placeholder="The caption as you would post it.">${p.caption || ''}</textarea>
            <div style="height:10px"></div>
            <textarea class="cp-hook" data-f="tags" style="min-height:54px"
              placeholder="#datacenter #homelab">${p.tags || ''}</textarea>
          </div>
        </details>`;
      S.script = `
        <details class="cp-sec"${p.script ? ' open' : ''}>
          <summary>Script<span class="n">${scriptStat(p.script)}</span>${CHEV}</summary>
          <div class="cp-body" id="s-script">
            <div class="cp-tools">
              <button data-ins="[HOOK]">Hook</button>
              <button data-ins="[BEAT]">Beat</button>
              <button data-ins="[B-ROLL: ]">B-roll</button>
              <button data-ins="[ON CAM]">On cam</button>
              <button data-ins="[TEXT: ]">On-screen text</button>
              <button data-ins="[CTA]">CTA</button>
              <button data-a="fromflow">Build from the flow</button>
            </div>
            <textarea class="cp-script" data-f="script"
              placeholder="Write it the way you'll say it. Contractions, short sentences, no throat-clearing — the first word should already be the hook.">${p.script || ''}</textarea>
            <div class="cp-count">
              <span><b>${words(p.script)}</b> words</span>
              <span><b>~${readTime(p.script)}</b> at speaking pace</span>
            </div>
          </div>
        </details>`;
      S.notes = `
        <details class="cp-sec">
          <summary>Notes<span class="n">${p.notes ? 'written' : ''}</span>${CHEV}</summary>
          <div class="cp-body">
            <textarea class="cp-hook" data-f="notes"
              placeholder="Gear, locations, anything you will forget by the shoot.">${p.notes || ''}</textarea>
          </div>
        </details>`;
      S.where = `
        <details class="cp-sec">
          <summary>Where it is<span class="n">${Lifecycle.stage(clip.stage || 'idea').label}</span>${CHEV}</summary>
          <div class="cp-body">
            <p class="note" style="text-align:left;margin:0 0 12px">Finishing a shoot, edit or
              publish task moves this on its own. Set it by hand when you work out of order.</p>
            <div class="pgseg" data-group="stage" style="flex-wrap:wrap">
              ${Lifecycle.STAGES.map(st =>
                `<button type="button" data-stage="${st.k}"
                  aria-pressed="${(clip.stage || 'idea') === st.k}"
                  ><b>${st.label}</b><small>${st.d}</small></button>`).join('')}
            </div>
          </div>
        </details>
`;
      S.shots = `
        <details class="cp-sec"${(clip.shots || []).length ? '' : ' open'}>
          <summary>Shot list<span class="n">${(clip.shots || []).length || 'none yet'}</span>${CHEV}</summary>
          <div class="cp-body">
            <p class="note" style="text-align:left;margin:0 0 12px">One per line. These ride along
              as steps when this lands on a shoot day.</p>
            <textarea class="cp-hook" data-f="shots" placeholder="Wide of the bench&#10;Hands on the drill&#10;Reveal, slow push in"
              >${(clip.shots || []).join('\n')}</textarea>
          </div>
        </details>
`;
      S.cuts = `
        <details class="cp-sec">
          <summary>Cuts<span class="n">${(clip.cuts || []).length || 1}</span>${CHEV}</summary>
          <div class="cp-body">
            <p class="note" style="text-align:left;margin:0 0 12px">One shoot, several versions.
              Each carries its own platform and moves at its own pace.</p>
            ${(clip.cuts || []).map(cut => `
              <div class="cutrow">
                <select data-cutplat="${cut.id}" class="pgbar">
                  ${['youtube','shorts','tiktok','reels','instagram','x','linkedin','newsletter']
                    .map(pl => `<option value="${pl}" ${cut.plat === pl ? 'selected' : ''}>${pl}</option>`).join('')}
                </select>
                <select data-cutstate="${cut.id}" class="pgbar">
                  ${Lifecycle.STAGES.map(st =>
                    `<option value="${st.k}" ${(cut.state || 'idea') === st.k ? 'selected' : ''}
                      >${st.label}</option>`).join('')}
                </select>
                ${(clip.cuts || []).length > 1
                  ? `<button class="cutdel" data-cutdel="${cut.id}" aria-label="Remove">&times;</button>` : ''}
              </div>`).join('')}
            <button class="btn-ghost" data-a="addcut" style="width:100%;margin:8px 0 0">
              Add a cut for another platform</button>
          </div>
        </details>
`;
      S.versions = versionsHTML();
      S.needs = needsHTML();
      S.toshoot = `
        <button class="btn-ghost" data-a="toshoot" style="width:100%;margin:4px 0 0">
          Send the flow to the shoot task</button>
        <p class="note">Each beat becomes a shot on whichever shoot day this clip belongs to.</p>`;

      el.innerHTML = Screens.bar({ kicker:'Clip', title:TAB_NAME[tab],
        actions:`<button class="btn-sm" data-a="aidraft" aria-label="Draft the empty parts of the plan with AI" title="Draft with AI">✦</button>
                  <button class="btn-sm" data-a="board">Board</button>
                  <button class="btn-sm" data-a="open">Details</button>` }) + `
      <div class="view">
        <div class="cp-head">
          <p class="t">${clip.title || 'Untitled clip'}</p>
          <div class="cp-meta">
            ${(() => { const st = Lifecycle.stage(clip.stage || 'idea');
              return `<span class="cp-pill" style="background:${st.c};color:#151515">${st.label}</span>`;
            })()}
            ${clip.channel ? `<span class="cp-pill">${clip.channel}</span>` : ''}
            <span class="cp-pill">${(clip.cuts || []).length || 1} cut${
              ((clip.cuts || []).length || 1) === 1 ? '' : 's'}</span>
            ${clip.scheduledAt ? `<span class="cp-pill">${ICON.clock}${
              new Date(clip.scheduledAt).toLocaleDateString(undefined,{ month:'short', day:'numeric' })}</span>` : ''}
            ${p.beats.length ? `<span class="cp-pill">${p.beats.length} beats</span>` : ''}
          </div>
        </div>

        <div class="segmented" role="tablist" style="position:sticky;top:0;z-index:5">
          ${Object.keys(TABS).map(k => `<button role="tab" data-ctab="${k}" aria-selected="${tab === k}">${TAB_NAME[k]}</button>`).join('')}
        </div>
        <p class="note cp-tabnote" style="text-align:left;margin:-4px 0 14px">${TAB_NOTE[tab]}</p>

        ${TABS[tab].map(k => S[k] || '').join('\n')}
        ${moveOnHTML()}
      </div>`;

      if(scroll) el.querySelector('.view').scrollTop = scroll;
      autoGrow();
      const refsSec = el.querySelector('#sec-refs');
      if(refsSec) refsSec.addEventListener('toggle', () => { refsOpen = refsSec.open; });
      SwipeRefs.fill(el.querySelector('#swr-slot'), { own: p.swipeIds,
        empty:'Link the videos this clip is borrowing from. Its shoot and edit tasks will show them too.' });
    }

    /* ---------- versions: one shoot, many posts ---------- */
    const STATE_LABEL = { todo:'Not started', edited:'Edited', posted:'Posted' };
    const STATE_ICON = {
      todo:'',
      edited:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/></svg>',
      posted:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
    };
    const escA = t => String(t || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

    function versionsHTML(){
      const list = clip.plan.versions;
      const pr = Versions.progress(list);
      const F = Versions.FORMATS;

      if(!list.length){
        return `<details class="cp-sec" open>
          <summary>Versions<span class="n">one shoot, many posts</span>${CHEV}</summary>
          <div class="cp-body">
            <p class="note" style="text-align:left;margin:0 0 12px">Plan every video you will cut from this one
              shoot. Pick a template to start — you can add, rename or remove versions afterwards.</p>
            ${tpls.map(t => `<button class="vt-pick" data-vtpl-id="${t.id}">
              <b>${escA(t.n)}</b><small>${escA(t.d || '')} · ${(t.f || []).length} versions</small></button>`).join('')}
            <button class="cp-add" data-a="vadd">+ Start with a single version</button>
          </div>
        </details>`;
      }

      const fv = list.find(v => v.id === focusV);
      return `<details class="cp-sec" open id="s-versions">
        <summary>Versions<span class="n">${pr.edited}/${pr.total} edited · ${pr.posted} posted</span>${CHEV}</summary>
        <div class="cp-body">
          <div class="v-prog">
            <div class="v-bar"><i class="ed" style="width:${pr.pctEdited}%"></i><i class="po" style="width:${pr.pctPosted}%"></i></div>
            <div class="v-stats">
              <span><b>${pr.edited}</b> of ${pr.total} edited</span>
              <span><b>${pr.posted}</b> posted</span>
              <span><b>${pr.posts}</b> posts across platforms</span>
            </div>
            ${pr.total && pr.posted === pr.total ? `<p class="v-done">Every version is out. This concept is done.</p>` : ''}
          </div>

          ${fv ? `<div class="v-focus">
            <div class="v-fhead">
              <span class="k">Working on</span>
              <button class="v-x" data-vfocus="" aria-label="Close">×</button>
            </div>
            <input class="v-fname" data-vname="${fv.id}" value="${escA(fv.name)}">
            ${(F[fv.f] || {}).g ? `<p class="v-guide">${(F[fv.f] || {}).g}</p>` : ''}
            ${(F[fv.f] || {}).shoot ? `<p class="v-need">🎥 On the shoot: ${(F[fv.f] || {}).shoot}</p>` : ''}
            <textarea class="cp-hook" data-vnote="${fv.id}" style="min-height:64px"
              placeholder="Hook, voiceover line, text on screen, which moments to use…">${fv.note || ''}</textarea>
            <div class="v-fref">
              ${fv.swipeId
                ? `<button class="btn-sm" data-vswipe-open="${fv.swipeId}">↗ ${escA(swipeTitles[fv.swipeId] || 'Linked swipe')}</button>
                   <button class="btn-sm" data-vswipe-rm="${fv.id}">Unlink</button>`
                : `<button class="btn-sm" data-vswipe="${fv.id}">+ Link a swipe for this version</button>`}
            </div>
            <div class="v-factions">
              <button class="btn-sm" data-vdup="${fv.id}">Duplicate</button>
              <button class="btn-sm" data-vsolo="${fv.id}">Make it its own clip</button>
              <button class="btn-sm" data-vrm="${fv.id}" style="color:var(--red);border-color:rgba(226,86,74,.4)">Remove</button>
            </div>
          </div>` : ''}

          <div class="v-list">
            ${list.map(v => {
              const fmt = F[v.f] || F.custom;
              return `<div class="v-row${v.id === focusV ? ' on' : ''}">
                <button class="v-state ${v.state}" data-vstate="${v.id}"
                  aria-label="${STATE_LABEL[v.state]} — tap to move on">${STATE_ICON[v.state]}</button>
                <button class="v-name" data-vfocus="${v.id}">
                  <b>${fmt.icon} ${escA(v.name)}</b>
                  <small>${STATE_LABEL[v.state]}${v.note ? ' · has notes' : ''}${v.swipeId ? ' · swipe' : ''}</small>
                </button>
                <span class="v-plats">${Versions.PLATS.map(pl =>
                  `<button data-vplat="${v.id}" data-k="${pl.k}" aria-pressed="${(v.plats || []).includes(pl.k)}">${pl.n}</button>`).join('')}</span>
              </div>`;
            }).join('')}
          </div>
          <p class="note" style="text-align:left;margin:8px 0 12px">Tap the circle to move a version along:
            not started → edited → posted. Tap a name to open its guide.</p>

          <div class="v-foot">
            <button class="cp-add" data-a="vadd">+ Add a version</button>
            <button class="cp-add" data-a="vtpl">+ Add from a template</button>
            <button class="cp-add" data-a="vsave">Save this list as a template</button>
          </div>
        </div>
      </details>`;
    }

    /* The bottom of each tab: hand the clip on to the next stage, which is what
       moves it between tabs on the Clips list. */
    /* The tabs are views of the work; the clip's stage is the app's own
       lifecycle (idea → planned → shot → editing → published). Each tab's button
       moves the stage on, never back — except when you choose a tab by hand. */
    const MOVE = {
      plan:  { to:'planned',   next:'shoot', label:'Planning done — ready to shoot' },
      shoot: { to:'shot',      next:'edit',  label:'Filmed — move to Edit' },
      edit:  { to:'editing',   next:'post',  label:'Cut is done — on to posting' },
      post:  { to:'published', next:'post',  label:'Everything is out — mark it published' }
    };
    const TAB_START = { plan:'idea', shoot:'planned', edit:'shot', post:'editing' };
    function moveOnHTML(){
      const st = clip.stage || 'idea';
      const home = Versions.stageOf(clip);
      if(st === 'published') return `<p class="note" style="color:var(--green);margin-top:18px">
        Published. <button class="btn-sm" data-a="unpost" style="margin-left:6px">Undo</button></p>`;
      if(tab !== home)
        return `<p class="note" style="margin-top:18px">This clip is at
          <b>${Lifecycle.stage(st).label}</b>.
          <button class="btn-sm" data-a="stagehere" style="margin-left:6px">Move it to ${TAB_NAME[tab]}</button></p>`;
      return `<button class="btn-primary" data-a="moveon" style="width:100%;margin-top:18px">${MOVE[tab].label}</button>`;
    }
    async function setStage(st, nextTab){
      clip.stage = st;
      if(nextTab){ tab = nextTab; clip.plan.tab = nextTab; }
      focusV = null;
      await Data.saveClip(clip);
      clip = Lifecycle.normalise(clip);
      params && params.onChange && params.onChange();
      render();
      const v = el.querySelector('.view'); if(v) v.scrollTop = 0;
    }

    /* the shoot tab's checklist: what the planned versions need captured */
    function needsHTML(){
      const list = clip.plan.versions;
      const needs = Versions.shootNeeds(list);
      if(!list.length) return `<div class="v-needs">
        <b>No versions planned yet</b>
        <span>Add versions on the Edit tab and this fills with what the shoot has to capture for them.</span>
      </div>`;
      return `<div class="v-needs">
        <b>Capture for ${list.length} version${list.length === 1 ? '' : 's'}</b>
        ${needs.length ? needs.map(n => `<span>• ${n}</span>`).join('')
          : '<span>Nothing special — the original footage covers every version.</span>'}
        ${needs.length ? `<button class="btn-sm" data-a="vneeds" style="margin-top:8px;align-self:flex-start">Add these to the shoot task</button>` : ''}
      </div>`;
    }

    function findVersion(vid){ return clip.plan.versions.find(v => v.id === vid); }

    async function linkedShoot(){
      const tasks = await Data.tasks();
      const edit = tasks.find(t => t.clipId === clip.id && t.kind === 'edit');
      let shoot = null;
      if(edit){
        const label = clip.title.split(' · ')[0];
        shoot = tasks.find(t => t.kind === 'shoot' && (t.subs || []).some(x => x.t.includes(label)));
      }
      return shoot || tasks.find(t => t.kind === 'shoot' && t.view === 'todo') || null;
    }

    function openTemplates(){
      App.sheet(`
        <h2>Add from a template</h2>
        <p style="margin:0 0 12px;color:var(--muted);font-size:14px;line-height:1.5">
          Adds the template's versions to the ones already here.</p>
        ${tpls.map(t => `<div style="display:flex;gap:8px;align-items:stretch;margin:0 0 6px">
          <button class="vt-pick" data-vtpl-id="${t.id}" style="flex:1;margin:0">
            <b>${escA(t.n)}</b><small>${escA(t.d || '')} · ${(t.f || []).length} versions</small></button>
          ${t.id.startsWith('u') ? `<button class="btn-sm" data-vtpl-del="${t.id}" aria-label="Delete template">×</button>` : ''}
        </div>`).join('')}
        <div class="sheetcta"><button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          const del = e.target.closest('[data-vtpl-del]');
          if(del){
            if(!confirm('Delete this template? Clips that used it keep their versions.')) return;
            const mine = (await Versions.customTemplates()).filter(t => t.id !== del.dataset.vtplDel);
            await Versions.saveCustomTemplates(mine);
            tpls = await Versions.templates();
            App.closeSheet(); render();
            return U.toast('Template deleted');
          }
          const b = e.target.closest('[data-vtpl-id]');
          if(!b) return;
          await applyTemplate(b.dataset.vtplId);
          App.closeSheet();
        });
      });
    }

    async function applyTemplate(tid){
      const t = tpls.find(x => x.id === tid);
      if(!t) return;
      Versions.fromTemplate(t, clip.plan.versions);
      await Data.saveClip(clip);
      render();
      U.toast(`${(t.f || []).length} versions added`);
    }

    function openAddVersion(){
      const F = Versions.FORMATS;
      App.sheet(`
        <h2>Add a version</h2>
        ${Object.entries(F).map(([k, f]) => `<button class="vt-pick" data-vfmt="${k}">
          <b>${f.icon} ${f.n}</b><small>${f.g ? f.g.split('. ')[0] + '.' : 'Name it yourself'}</small></button>`).join('')}
        <div class="sheetcta"><button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          const b = e.target.closest('[data-vfmt]');
          if(!b) return;
          let name = null;
          if(b.dataset.vfmt === 'custom'){
            name = (prompt('Name this version') || '').trim();
            if(!name) return;
          }
          const v = Versions.make(b.dataset.vfmt, clip.plan.versions, name);
          clip.plan.versions.push(v);
          focusV = v.id;
          await Data.saveClip(clip);
          App.closeSheet();
          render();
        });
      });
    }

    function autoGrow(){
      el.querySelectorAll('.cp-beat .tx').forEach(t => {
        t.style.height = 'auto';
        t.style.height = t.scrollHeight + 'px';
      });
    }

    /* typing never re-renders, so the caret stays put */
    el.addEventListener('input', e => {
      const vn = e.target.dataset.vnote;
      if(vn){ const v = findVersion(vn); if(v){ v.note = e.target.value; save(true); } return; }
      const vna = e.target.dataset.vname;
      if(vna){
        const v = findVersion(vna);
        if(v){
          v.name = e.target.value;
          const row = el.querySelector(`.v-row.on .v-name b`);
          if(row) row.textContent = `${(Versions.FORMATS[v.f] || Versions.FORMATS.custom).icon} ${v.name}`;
          save(true);
        }
        return;
      }
      const f = e.target.dataset.f;
      if(f === 'shots'){
        /* the shot list belongs to the clip itself — it is what the shoot task
           carries, not part of the story plan */
        clip.shots = e.target.value.split('\n').map(x => x.trim()).filter(Boolean);
        return save(true);
      }
      if(f){
        clip.plan[f] = e.target.value;
        if(f === 'script'){
          const c = el.querySelector('.cp-count');
          if(c) c.innerHTML = `<span><b>${words(e.target.value)}</b> words</span>
            <span><b>~${readTime(e.target.value)}</b> at speaking pace</span>`;
        }
        return save(true);
      }
      const ti = e.target.dataset.title;
      if(ti !== undefined){ clip.plan.titles[+ti] = e.target.value; return save(true); }
      const b = e.target.dataset.beat;
      if(b !== undefined){
        clip.plan.beats[+b] = e.target.value;
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
        save(true);
      }
    });

    /* the two dropdowns on a cut save the moment they change */
    el.addEventListener('change', async e => {
      const pl = e.target.dataset.cutplat;
      if(pl){
        const cut = (clip.cuts || []).find(c => c.id === pl);
        if(cut){ cut.plat = e.target.value; await save(); }
        return;
      }
      const st = e.target.dataset.cutstate;
      if(st){
        const cut = (clip.cuts || []).find(c => c.id === st);
        if(cut){
          cut.state = e.target.value;
          /* the piece is as far along as its furthest cut */
          clip.stage = Lifecycle.stageOf(clip);
          await save();
          render();
        }
      }
    });

    el.addEventListener('click', async e => {
      const ct = e.target.closest('[data-ctab]');
      if(ct){
        if(ct.dataset.ctab === tab) return;
        tab = ct.dataset.ctab;
        focusV = null;
        clip.plan.tab = tab;
        save(true);
        render();
        const v = el.querySelector('.view'); if(v) v.scrollTop = 0;
        return;
      }

      /* ---- versions ---- */
      const vs = e.target.closest('[data-vstate]');
      if(vs){
        const v = findVersion(vs.dataset.vstate);
        if(v){
          v.state = Versions.cycle(v.state);
          await Data.saveClip(clip);
          render();
          const pr = Versions.progress(clip.plan.versions);
          if(v.state === 'posted' && pr.posted === pr.total) U.toast('Every version posted. Concept complete.');
        }
        return;
      }
      const vf = e.target.closest('[data-vfocus]');
      if(vf){
        focusV = vf.dataset.vfocus && vf.dataset.vfocus !== focusV ? vf.dataset.vfocus : null;
        render();
        if(focusV){
          const card = el.querySelector('.v-focus');
          if(card) card.scrollIntoView({ behavior:'smooth', block:'nearest' });
        }
        return;
      }
      const vp = e.target.closest('[data-vplat]');
      if(vp){
        const v = findVersion(vp.dataset.vplat);
        if(v){
          v.plats = v.plats || [];
          const k = vp.dataset.k;
          v.plats = v.plats.includes(k) ? v.plats.filter(x => x !== k) : v.plats.concat(k);
          await Data.saveClip(clip);
          render();
        }
        return;
      }
      const vd = e.target.closest('[data-vdup]');
      if(vd){
        const v = findVersion(vd.dataset.vdup);
        if(v){
          const copy = { ...Versions.make(v.f, clip.plan.versions), note:v.note, plats:[...(v.plats || [])],
                         swipeId:v.swipeId };
          if(v.f === 'custom') copy.name = v.name + ' (copy)';
          clip.plan.versions.splice(clip.plan.versions.indexOf(v) + 1, 0, copy);
          focusV = copy.id;
          await Data.saveClip(clip);
          render();
        }
        return;
      }
      const vr = e.target.closest('[data-vrm]');
      if(vr){
        const v = findVersion(vr.dataset.vrm);
        if(v && confirm(`Remove "${v.name}"?`)){
          clip.plan.versions = clip.plan.versions.filter(x => x !== v);
          focusV = null;
          await Data.saveClip(clip);
          render();
        }
        return;
      }
      const vso = e.target.closest('[data-vsolo]');
      if(vso){
        const v = findVersion(vso.dataset.vsolo);
        if(!v || !confirm(`Turn "${v.name}" into its own clip? It leaves this checklist.`)) return;
        const fresh = await Data.saveClip({
          title: `${clip.title || 'Clip'} · ${v.name}`, plat: clip.plat, state:'raw',
          seriesId: clip.seriesId || null, dur:'0:00',
          plan: { notes: [(Versions.FORMATS[v.f] || {}).g, v.note].filter(Boolean).join('\n\n'),
                  swipeIds: v.swipeId ? [v.swipeId] : [] }
        });
        clip.plan.versions = clip.plan.versions.filter(x => x !== v);
        focusV = null;
        await Data.saveClip(clip);
        render();
        U.toast('Made its own clip');
        return Screens.push('clip', { id: fresh.id });
      }
      const vsw = e.target.closest('[data-vswipe]');
      if(vsw){
        const v = findVersion(vsw.dataset.vswipe);
        if(v) SwipeRefs.pick([], async sid => {
          v.swipeId = sid;
          try { const r = await Store.get('swipes', sid); swipeTitles[sid] = (r && r.title) || 'Untitled swipe'; } catch(e){}
          await Data.saveClip(clip);
          render();
        });
        return;
      }
      const vswo = e.target.closest('[data-vswipe-open]');
      if(vswo) return Screens.push('swipe', { id: vswo.dataset.vswipeOpen });
      const vswr = e.target.closest('[data-vswipe-rm]');
      if(vswr){
        const v = findVersion(vswr.dataset.vswipeRm);
        if(v){ v.swipeId = null; await Data.saveClip(clip); render(); }
        return;
      }
      const vt = e.target.closest('[data-vtpl-id]');
      if(vt && el.contains(vt)) return applyTemplate(vt.dataset.vtplId);

      const sg = e.target.closest('[data-stage]');
      if(sg){
        clip.stage = sg.dataset.stage;
        await save();
        return render();
      }

      if(e.target.closest('[data-a="addcut"]')){
        Object.assign(clip, Lifecycle.addCut(clip, 'shorts'));
        await save();
        return render();
      }

      const cd = e.target.closest('[data-cutdel]');
      if(cd){
        clip.cuts = (clip.cuts || []).filter(c => c.id !== cd.dataset.cutdel);
        await save();
        return render();
      }

      const ins = e.target.closest('[data-ins]');
      if(ins){
        const ta = el.querySelector('[data-f="script"]');
        if(!ta) return;
        const at = ta.selectionStart;
        const tag = ins.dataset.ins;
        const before = ta.value.slice(0, at);
        const pad = before && !before.endsWith('\n') ? '\n' : '';
        ta.value = before + pad + tag + '\n' + ta.value.slice(at);
        clip.plan.script = ta.value;
        const caret = (before + pad + tag).length + 1;
        ta.focus();
        ta.setSelectionRange(caret, caret);
        save(true);
        return;
      }

      const opt = e.target.closest('[data-set]');
      if(opt){
        const f = opt.dataset.set;
        clip.plan[f] = clip.plan[f] === opt.dataset.v ? '' : opt.dataset.v;
        await Data.saveClip(clip);
        return render();
      }
      const jump = e.target.closest('[data-jump]');
      if(jump){
        const map = { hook:'s-hook', promise:'s-promise', purpose:'s-purpose', audience:'s-audience',
                      beats:'s-beats', hookStyle:'s-hook', retain:'s-retain', ctaType:'s-ctaType',
                      titles:'s-titles', thumb:'s-titles', metric:'s-metric' };
        const want = GAP_TAB[jump.dataset.jump] || 'plan';
        if(want !== tab){ tab = want; render(); }
        const target = el.querySelector('#' + (map[jump.dataset.jump] || ''));
        if(target){
          const sec = target.closest('details');
          if(sec) sec.open = true;
          target.scrollIntoView({ behavior:'smooth', block:'center' });
        }
        return;
      }
      const len = e.target.closest('[data-len]');
      if(len){ clip.plan.length = len.dataset.len; await Data.saveClip(clip); return render(); }

      const up = e.target.closest('[data-up]');
      if(up){
        const i = +up.dataset.up;
        const b = clip.plan.beats;
        [b[i-1], b[i]] = [b[i], b[i-1]];
        await Data.saveClip(clip); return render();
      }
      const dn = e.target.closest('[data-down]');
      if(dn){
        const i = +dn.dataset.down;
        const b = clip.plan.beats;
        [b[i+1], b[i]] = [b[i], b[i+1]];
        await Data.saveClip(clip); return render();
      }
      const rm = e.target.closest('[data-rmbeat]');
      if(rm){
        clip.plan.beats.splice(+rm.dataset.rmbeat, 1);
        await Data.saveClip(clip); return render();
      }

      const a = e.target.closest('[data-a]');
      if(!a) return;

      if(a.dataset.a === 'moveon'){
        const m = MOVE[tab];
        if(tab === 'post'){
          const pr = Versions.progress(clip.plan.versions);
          if(pr.total && pr.posted < pr.total &&
             !confirm(`${pr.total - pr.posted} version${pr.total - pr.posted === 1 ? ' is' : 's are'} not ticked as posted. Mark it published anyway?`)) return;
        }
        const st = Lifecycle.ahead(clip.stage || 'idea', m.to) ? m.to : (clip.stage || 'idea');
        await setStage(st, m.next);
        return U.toast(tab === 'post' && st === 'published' ? 'Published' : `Now ${Lifecycle.stage(st).label.toLowerCase()}`);
      }
      if(a.dataset.a === 'stagehere'){
        await setStage(TAB_START[tab], tab);
        return U.toast(`Moved to ${TAB_NAME[tab]}`);
      }
      if(a.dataset.a === 'unpost'){ await setStage('editing', 'post'); return; }
      if(a.dataset.a === 'vadd') return openAddVersion();
      if(a.dataset.a === 'vtpl') return openTemplates();
      if(a.dataset.a === 'vsave'){
        const list = clip.plan.versions;
        if(!list.length) return U.toast('No versions to save');
        const n = (prompt('Name this template', clip.title ? `${clip.title.split(' · ')[0]} pack` : 'My template') || '').trim();
        if(!n) return;
        const mine = await Versions.customTemplates();
        mine.push({ id:'u' + Date.now().toString(36), n, d:'Your template',
                    f: list.map(v => v.f), names: list.map(v => v.name) });
        await Versions.saveCustomTemplates(mine);
        tpls = await Versions.templates();
        return U.toast('Saved — it shows up on every clip now');
      }
      if(a.dataset.a === 'vneeds'){
        const needs = Versions.shootNeeds(clip.plan.versions);
        const shoot = await linkedShoot();
        if(!shoot) return U.toast('No shoot task to send these to');
        const label = (clip.title || 'Clip').split(' · ')[0];
        shoot.subs = shoot.subs || [];
        let added = 0;
        needs.forEach(n => {
          const t = `${label}: ${n}`;
          if(!shoot.subs.some(x => x.t === t)){ shoot.subs.push({ t, done:false }); added++; }
        });
        await Store.put('tasks', shoot);
        Data.invalidate('tasks');
        return U.toast(added ? `${added} added to "${shoot.title}"` : 'Already on the shoot task');
      }

      if(a.dataset.a === 'fromflow'){
        const beats = clip.plan.beats.filter(b => b.trim());
        if(!beats.length) return U.toast('Nothing in the flow yet');
        if(clip.plan.script && clip.plan.script.trim() &&
           !confirm('Replace what is already in the script?')) return;
        clip.plan.script =
          `[HOOK]\n${clip.plan.hook || ''}\n\n` +
          beats.map((b,i) => `[BEAT ${i+1}] ${b}\n`).join('\n') +
          `\n[CTA]\n${clip.plan.cta || ''}\n`;
        await Data.saveClip(clip);
        render();
        return U.toast('Scaffolded from the flow');
      }

      if(a.dataset.a === 'addbeat'){
        clip.plan.beats.push('');
        await Data.saveClip(clip);
        render();
        const last = [...el.querySelectorAll('.cp-beat .tx')].pop();
        if(last) last.focus();
        return;
      }

      if(a.dataset.a === 'open'){
        params && params.onEdit && params.onEdit(clip);
        return;
      }

      /* Draft the plan's empty fields with AI; nothing written is replaced */
      if(a.dataset.a === 'aidraft'){
        try {
          const r = await ClipIdeas.draftInto(clip);
          if(!r) return;
          if(!r.filled.length) return U.toast('Everything is already written — nothing to fill');
          clip.plan = r.plan;
          await Data.saveClip(clip);
          await load(); render();
          return U.toast(`Filled ${r.filled.length} empty part${r.filled.length === 1 ? '' : 's'} of the plan`);
        } catch(err){ return U.toast(err.message || 'Could not read that answer'); }
      }

      /* the clip's own canvas — status follows the clip */
      if(a.dataset.a === 'board') return BoardLink.open({ type:'clip', id:clip.id,
        name: clip.title || 'Untitled clip', status: BoardLink.statusFor(clip.stage), kicker:'Clip' });

      if(a.dataset.a === 'toshoot'){
        const beats = clip.plan.beats.filter(b => b.trim());
        if(!beats.length) return U.toast('Nothing in the flow yet');

        const tasks = await Data.tasks();
        /* the shoot day this clip belongs to, found through its edit task */
        const edit = tasks.find(t => t.clipId === clip.id && t.kind === 'edit');
        let shoot = null;
        if(edit){
          const label = clip.title.split(' · ')[0];
          shoot = tasks.find(t => t.kind === 'shoot' &&
            (t.subs || []).some(x => x.t.includes(label)));
        }
        if(!shoot) shoot = tasks.find(t => t.kind === 'shoot' && t.view === 'todo');
        if(!shoot) return U.toast('No shoot task to send these to');

        shoot.shots = (shoot.shots || []).concat(beats.map(b => ({
          name: `${clip.title.split(' · ')[0]}: ${b.slice(0, 40)}`,
          angles: [{ n:'Wide' }, { n:'Medium' }, { n:'Close' }]
        })));
        await Store.put('tasks', shoot);
        Data.invalidate('tasks');
        U.toast(`${beats.length} shots added to the shoot day`);
      }
    });

    await load();
    SwipeRefs.wire(el, {
      getOwn: () => (clip && clip.plan.swipeIds) || [],
      add: async sid => {
        clip.plan.swipeIds.push(sid);
        refsOpen = true;
        await Data.saveClip(clip);
        render();
        U.toast('Swipe linked');
      },
      remove: async sid => {
        clip.plan.swipeIds = clip.plan.swipeIds.filter(x => x !== sid);
        await Data.saveClip(clip);
        render();
      },
      onOpenChange: () => render()
    });
    if(!clip){
      el.innerHTML = Screens.bar({ title:'Clip' }) +
        '<div class="view"><div class="empty"><b>Clip not found</b>It may have been removed.</div></div>';
      return;
    }
    render();
  }

  Screens.register('clip', mount);
})();
