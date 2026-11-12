/* One task, opened up: its steps, its timing, and whatever it is attached to. */
(function(){
  const { ICON } = U;
  const CADENCES = ['Daily','Weekly','Shoot day','One-off'];
  const PRI = [['low','Low'],['med','Medium'],['high','High']];
  const PRI_LABEL = { low:'Low', med:'Medium', high:'High' };
  const esc = s => U.esc(s);   /* shared: util.js */

  /* A task's steps beside its pages: each shot's name and type are edited in
     place, its box is the only thing that ticks it, and arrows slide between
     the task's pages, each with its own steps (round 7). */
  if(!document.getElementById('tks-style')){
    const st = document.createElement('style');
    st.id = 'tks-style';
    st.textContent = `
      .tks-other{margin:16px 0 6px;font-family:var(--display),sans-serif;font-weight:900;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
      .shotline.tk-ps{cursor:default;align-items:flex-start}
      .shotline.tk-ps .sn{padding-top:6px}
      .shotline button.bx{padding:0;margin-top:5px;background:none;color:transparent;cursor:pointer}
      .shotline.done button.bx{color:#fff}
      .shotline.done button.bx{background:var(--green)}
      .shotline.tk-ps .mini{margin-top:2px}
      .tk-th{width:46px;height:58px;flex:0 0 46px;padding:0;border:1px solid var(--line);border-radius:3px;background:var(--surface-2);overflow:hidden;cursor:pointer;margin-top:1px}
      .tk-th img,.tk-th video{width:100%;height:100%;object-fit:cover;display:block}
      .tk-thadd{border-style:dashed;color:var(--dim);font-size:20px;background:transparent}
      .shotline.done .tk-th{opacity:.45}
      .tkp-showpage{width:100%;justify-content:center;margin:4px 0 10px}
      .tkp-shoot{background:var(--orange)!important;border-color:var(--orange)!important;color:#151515!important;font-weight:700}
      .tkp-next[data-a]{cursor:pointer;position:relative;padding-right:34px}
      .tkp-next .tkp-go{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-style:normal;color:var(--orange)}
      /* v4: on a phone the name field kept its own width and pushed the move
         buttons off the screen; the text column takes what is left instead */
      .shotline.tk-ps .tx{flex:1 1 auto;min-width:0}
      @media (max-width:520px){ .shotline.tk-ps{gap:6px} .shotline.tk-ps .mini{width:28px;flex-basis:28px} .shotline.tk-ps .tk-rolesel{max-width:110px;margin-right:6px}
        .shotline.tk-ps .tk-line{flex-wrap:wrap;row-gap:3px} .shotline.tk-ps .tk-name{flex:1 1 100%} }
      .tk-line{display:flex;align-items:center;min-width:0}
      .tk-rolesel{appearance:none;-webkit-appearance:none;flex:0 0 auto;width:auto;min-width:0;max-width:150px;height:auto;margin-right:8px;padding:3px 7px;border:1px solid transparent;border-radius:3px;
        background:rgba(237,229,210,.1);color:var(--cream);font-family:var(--display),sans-serif;font-weight:900;font-size:10px;
        letter-spacing:.09em;text-transform:uppercase;cursor:pointer;outline:none}
      .tk-rolesel:hover,.tk-rolesel:focus{border-color:var(--orange)}
      .tk-rolesel.none{background:none;border:1px dashed var(--line);color:var(--dim)}
      .tk-rolesel option{background:var(--surface-2);color:var(--cream);text-transform:none;font-family:inherit;font-weight:400;font-size:13px}
      .tk-name{flex:1;min-width:0;margin-left:-6px;padding:3px 6px;border:1px solid transparent;border-radius:var(--r);background:transparent;
        color:var(--cream);font:inherit;font-size:14.5px;line-height:1.35;outline:none;cursor:text}
      .tk-name:hover{border-color:var(--line)}
      .tk-name:focus{border-color:var(--orange);background:var(--bg)}
      .shotline.done .tk-name{color:var(--muted);text-decoration:line-through}
      .tk-notein{display:none;width:100%;margin:2px 0 0 -6px;padding:2px 6px;border:1px solid transparent;border-radius:var(--r);background:transparent;
        color:var(--dim);font:inherit;font-size:12.5px;outline:none}
      .tk-notein.has,.shotline:focus-within .tk-notein{display:block}
      .tk-notein:hover{border-color:var(--line)}
      .tk-notein:focus{border-color:var(--orange);background:var(--bg);color:var(--muted)}
      .tks-add{width:100%;justify-content:center;margin-top:12px}
      .tkp-nav{display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:8px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2)}
      .tkp-arrow{width:42px;height:42px;flex:0 0 42px;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:var(--r);
        background:var(--bg);color:var(--cream);cursor:pointer}
      .tkp-arrow svg{width:20px;height:20px}
      .tkp-arrow:hover:not([disabled]){border-color:var(--orange);color:var(--orange)}
      .tkp-arrow[disabled]{opacity:.3;cursor:default}
      .tkp-navmid{flex:1;min-width:0;text-align:center}
      .tkp-navmid b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .tkp-navmid small{color:var(--muted);font-size:12.5px}
      .tkp-dots{display:flex;justify-content:center;gap:6px;margin-bottom:5px}
      .tkp-dots button{width:8px;height:8px;padding:0;border:0;border-radius:50%;background:var(--line);cursor:pointer}
      .tkp-dots button.on{background:var(--orange);width:20px;border-radius:4px}
      .tkp-split.slide-l{animation:tkpSlideL .28s ease-out}
      .tkp-split.slide-r{animation:tkpSlideR .28s ease-out}
      @keyframes tkpSlideL{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}
      @keyframes tkpSlideR{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}
      .tkp-cwrap{position:relative}
      /* v4: each shot's script lines, folded under it; the steps fold to a line */
      .tk-tw{display:inline-flex;align-items:center;gap:5px;margin:3px 0 0 -2px;padding:3px 8px;border:1px solid var(--line);border-radius:var(--r);background:transparent;color:var(--muted);font:inherit;font-size:12px;cursor:pointer}
      .tk-tw svg{width:11px;height:11px;transition:transform .15s}
      .tk-tw.on{border-color:var(--orange);color:var(--orange)}
      .tk-tw.on svg{transform:rotate(90deg)}
      .tk-lines{display:flex;flex-direction:column;gap:5px;margin:0 0 10px 40px;padding:8px 9px;border-left:2px solid var(--orange);border-radius:0 var(--r) var(--r) 0;background:rgba(251,105,0,.06)}
      @media (max-width:600px){ .tk-lines{margin-left:0;padding:7px 6px 7px 8px} .tk-lt{font-size:14px;padding:3px 4px} .tk-ln{gap:4px} .tk-lrm{width:22px;flex-basis:22px} }
      .tk-ln{display:flex;align-items:flex-start;gap:6px}
      .tk-lk{height:24px;min-width:36px;flex:0 0 auto;padding:0 5px;border:0;border-radius:3px;font-family:var(--display),sans-serif;font-weight:900;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;margin-top:2px}
      .tk-lk.vo{background:#3A2A14;color:#F2C27A}.tk-lk.cam{background:#1E3324;color:#7FD08C}.tk-lk.txt{background:#22283A;color:#9DB5E8}
      .tk-lk option{background:var(--surface-2);color:var(--cream)}
      .tk-lhook{font-family:var(--display),sans-serif;font-weight:900;font-size:9px;letter-spacing:.08em;background:var(--orange);color:#151515;padding:3px 5px;border-radius:3px;margin-top:4px}
      .tk-lt{flex:1;min-width:0;min-height:28px;resize:none;overflow:hidden;padding:3px 6px;border:1px solid transparent;border-radius:var(--r);background:transparent;color:var(--cream);font:inherit;font-size:14px;line-height:1.45;outline:none}
      .tk-lt:hover{border-color:var(--line)}.tk-lt:focus{border-color:var(--orange);background:var(--bg)}
      .tk-lrm{width:24px;height:24px;flex:0 0 24px;padding:0;border:0;background:none;color:var(--dim);font-size:16px;cursor:pointer;margin-top:2px}
      .tk-ladd{align-self:flex-start;height:26px;padding:0 9px;border:1px solid var(--line);border-radius:var(--r);background:transparent;color:var(--muted);font:inherit;font-size:12px;cursor:pointer}
      .tk-beat{margin:12px 0 4px;font-family:var(--display),sans-serif;font-weight:900;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--orange)}
      .tk-beat:first-child{margin-top:0}
      .tk-rowsbar{display:flex;align-items:center;gap:9px;margin:0 0 8px;padding:7px 8px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);cursor:pointer}
      .tk-rowsbar .fcv{width:16px;height:16px;flex:0 0 16px;color:var(--cream);transition:transform .15s}
      .tk-rowsbar.shut .fcv{transform:rotate(-90deg)}
      .tk-rowsbar b{font-family:var(--display),sans-serif;font-weight:900;font-size:11px;letter-spacing:.13em;text-transform:uppercase}
      .tk-rowsbar span{flex:1;min-width:0;color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .block.fold.tk-keep > .fbody{display:block!important}
      .block.fold.tk-keep.shut > h4 .fcv{transform:rotate(-90deg)}
      .tkp-cwrap .tkp-canvas{cursor:pointer}`;
    document.head.appendChild(st);
  }

  function fmtTime(hhmm){
    if(!hhmm) return null;
    const [h,m] = hhmm.split(':').map(Number);
    const ap = h >= 12 ? 'P' : 'A', hr = h % 12 === 0 ? 12 : h % 12;
    return m ? `${hr}:${String(m).padStart(2,'0')}${ap}` : `${hr}${ap}`;
  }

  /* Thumbnails for every reference linked anywhere on this task. Loaded once,
     so a task with twenty shots does not hit storage twenty times. */
  let REFTHUMBS = {}, REFKIND = {};
  async function loadRefThumbs(t){
    const ids = [...new Set((t.shots || []).flatMap(s2 => s2.refs || []))];
    for(const id of ids){
      if(REFTHUMBS[id] === undefined) REFTHUMBS[id] = await Refs.thumb(id);
      if(REFKIND[id] === undefined){
        const r = await Refs.get(id);
        REFKIND[id] = r ? r.kind : null;
      }
    }
  }

  /* which step lists are folded to a line, kept between visits */
  const ROWS_KEY = 'cs4.stepsFolded';
  const rowsFolded = () => { try { return JSON.parse(localStorage.getItem(ROWS_KEY) || '{}') || {}; } catch(e){ return {}; } };
  function setRowsFolded(k, v){ try { const m = rowsFolded(); if(v) m[k] = 1; else delete m[k]; localStorage.setItem(ROWS_KEY, JSON.stringify(m)); } catch(e){} }

  async function mount(el, params){
    let t, startDate = null, kit = [], lib = [];
    let allTasks = [];      /* the whole set, so a repeat can be counted and rewritten */
    /* which sections are open — a long task should not be a wall of text */
    const fold = { steps:true, pageshots:true, shots:true, cov:true, details:true };
    let planning = null;   /* which shot is showing the angle strip */
    let clipRec = null;    /* the clip this task belongs to, for its references and versions */
    let planRec = null;    /* the program plan that wrote this task, for its videos */
    let refsOpen = null;
    let angQ = '';         /* search inside that strip */

    /* v4: a host lends this screen its Steps + Shot page — an episode's
       sequence, a clip, a series video (shotlist.js ShotList.host*). It hands
       over a task-shaped record ({ title, page, subs, pageFrom, morePages })
       and takes it back on save; only the Steps block is shown, and with
       params.embedded no title bar, so it sits inside another screen. */
    const H = params.host || null;

    async function load(){
      if(H){
        t = await H.load();
        allTasks = t ? [t] : [];
        try { startDate = (await Data.program()).start; } catch(e){ startDate = null; }
        try { kit = Coverage.kitFor(t, await Coverage.kit()); } catch(e){ kit = []; }
        try { lib = await ShotLib.all(); } catch(e){ lib = []; }
        clipRec = null; planRec = null;
        await loadPageChoices();
        if(t && t.page && window.TaskPages && TaskPages.match(t)){ syncPage(); await H.save(t); }
        return;
      }
      const map = await Store.allMap('tasks');
      allTasks = Object.values(map);
      t = allTasks.find(x => x.id === +params.id);
      startDate = (await Data.program()).start;
      kit = Coverage.kitFor(t, await Coverage.kit());
      lib = await ShotLib.all();
      clipRec = null;
      if(t && t.clipId){ try { clipRec = await Store.get('clips', t.clipId); } catch(e){} }
      /* a task a program plan wrote carries the plan's videos */
      planRec = null;
      if(t && t.planId){ try { planRec = await Store.get('plans', t.planId); } catch(e){} }
      await loadPageChoices();
      /* the steps follow the page's shots (taskpages.js match) */
      if(t && t.page && window.TaskPages && TaskPages.match(t)){
        syncPage();
        await Store.put('tasks', t);
        Data.invalidate('tasks');
      }
    }

    /* ---------------------------------------------------------- shot page
       A notebook page from Templates (the nine-shot task sequence, the nine
       frames, any page) linked to this task. The task keeps its own copy, so
       ticking shots here never changes the template. Each step can stand for
       one shot (picture spot) on the page: step.shot is that spot's index. */
    /* v4: on a phone the shot page's drawing starts folded — the steps show the
       shots with their frames, so it would be the same list twice */
    const linesOpen = new Set();     /* shots whose script lines are open, by page:index */
    let pageChoices = [];   /* [{ key:'tid|sid', label, group, n }] */
    let pageMedia = null, pageMediaKey = '';
    async function loadPageChoices(){
      pageChoices = [];
      if(!window.ShotTemplates || !window.Notebook) return;
      let tpls = [];
      try { tpls = await ShotTemplates.all(); } catch(e){ tpls = []; }
      tpls.forEach(tp => {
        (tp.sheets || []).forEach(sh => pageChoices.push({ key:tp.id + '|' + sh.id, group:tp.name,
          label:sh.layout === 'steps' ? 'Task shot sequence' + (/^Sequence · Task$/.test(sh.name) ? '' : ' · ' + sh.name.replace(/^Sequence · /, ''))
            : sh.name, n:(sh.slots || []).length, steps:sh.layout === 'steps' }));
        (tp.shots || []).forEach(s2 => { if(s2.sequence) pageChoices.push({ key:tp.id + '|' + s2.sequence.id, group:tp.name,
          label:'Task shot sequence · ' + (s2.label || s2.name || 'shot'), n:(s2.sequence.slots || []).length, steps:true }); });
      });
    }
    const pageSlots = () => (t && t.page && t.page.slots) || [];
    /* pages kept with the task beside the shot page (notes, frames, a second sequence) */
    const morePages = () => (t && Array.isArray(t.morePages)) ? t.morePages : [];
    const hasShotNo = s2 => s2 && s2.shot != null && s2.shot >= 0 && s2.shot < pageSlots().length;
    function shotLabel(i){
      const sl = pageSlots()[i] || {};
      const bits = [sl.role, sl.text].filter(Boolean).join(' · ');
      return `Shot ${i + 1}${bits ? ' · ' + bits : ''}`;
    }
    const shotName = i => {
      const sl = pageSlots()[i] || {};
      return sl.text || (t.page.layout === 'frames' ? `Frame ${i + 1}` : `Shot ${i + 1}`);
    };
    /* a spot is done when every step standing for it is ticked */
    function syncPage(){
      if(!t || !t.page) return;
      pageSlots().forEach((sl, i) => {
        const mine = (t.subs || []).filter(s2 => s2.shot === i);
        sl.done = !!mine.length && mine.every(s2 => s2.done);
      });
    }
    /* the first spot that is not shot yet, in page order */
    function nextShot(){
      const subs = t.subs || [];
      for(let i = 0; i < pageSlots().length; i++){
        const mine = subs.filter(s2 => s2.shot === i);
        if(mine.length && mine.some(s2 => !s2.done)) return i;
      }
      return -1;
    }
    function freeShot(){
      const used = new Set((t.subs || []).filter(hasShotNo).map(s2 => s2.shot));
      for(let i = 0; i < pageSlots().length; i++) if(!used.has(i)) return i;
      return -1;
    }
    async function linkPage(key){
      const [tid, sid] = String(key).split('|');
      const tp = await ShotTemplates.get(tid);
      const src = tp && ShotTemplates.findSheet(tp, sid);
      if(!src) return U.toast('That page is gone');
      const had = !!t.page;
      /* steps that pointed past the end of the new page lose their shot; steps
         with no shot take the free ones (taskpages.js, shared with new tasks) */
      const { made } = TaskPages.attach(t, tp, src);
      pageMediaKey = '';
      await save(); render();
      U.toast(`${had ? 'Page changed' : 'Page linked'} · the steps are its ${made} shot${made === 1 ? '' : 's'}`);
    }

    function pageSelectHTML(placeholder){
      if(!pageChoices.length) return `<p class="hintline" style="margin:10px 0 0">No notebook pages yet — make one in Content → Templates${window.CS3Lib ? '' : ' on the laptop'}.</p>`;
      const groups = [];
      pageChoices.forEach(c => { let g = groups.find(x => x[0] === c.group); if(!g) groups.push(g = [c.group, []]); g[1].push(c); });
      /* templates with a task sequence first: those are the ones made for steps */
      groups.sort((a, b) => (b[1].some(c => c.steps) ? 1 : 0) - (a[1].some(c => c.steps) ? 1 : 0));
      return `<select class="tkp-sel" data-pagepick aria-label="Shot page for this task">
        <option value="">${placeholder}</option>
        ${groups.map(([g, list]) => `<optgroup label="${U.esc ? U.esc(g) : g.replace(/</g, '&lt;')}">${list.map(c =>
          `<option value="${c.key}">${c.label.replace(/</g, '&lt;')} · ${c.n} shot${c.n === 1 ? '' : 's'}</option>`).join('')}</optgroup>`).join('')}
      </select>`;
    }

    /* ---- the task's pages, one at a time: the shot page (its shots are the
       task's steps), then the pages kept beside it, each with its own shots */
    let pgIdx = 0, slideDir = '';
    const allPages = () => t && t.page ? [t.page].concat(morePages()) : [];
    const curPage = () => { const a = allPages(); if(pgIdx >= a.length) pgIdx = Math.max(0, a.length - 1); return a[pgIdx] || null; };
    const onMain = () => pgIdx === 0;
    const stepOf = i => (t.subs || []).find(s2 => s2.shot === i) || null;
    const shotDone = (P, i) => onMain() ? !!(stepOf(i) || {}).done : !!((P.slots || [])[i] || {}).done;
    function nextOn(P){
      if(onMain()) return nextShot();
      return (P.slots || []).findIndex(sl => !sl.done);
    }
    const shotTitle = (P, i) => { const sl = (P.slots || [])[i] || {}; const bits = [sl.role, sl.text].filter(Boolean); return `Shot ${i + 1}${bits.length ? ' · ' + bits.join(' · ') : ''}`; };

    function pageCardHTML(){
      const P = curPage();
      const slots = P.slots || [];
      const n = slots.length;
      const doneN = slots.filter((_, i) => shotDone(P, i)).length;
      const nx = nextOn(P);
      const hide = t.hideDone !== false;
      const total = allPages().length;
      const from = onMain() && t.pageFrom && t.pageFrom.template ? esc(t.pageFrom.template) : '';
      return `<div class="tkp-card">
        <div class="tkp-head">
          <div class="tkp-title">
            <p class="tkp-k">${onMain() ? 'Shot page' : `Page ${pgIdx + 1}`}${total > 1 ? ` <span class="tkp-more">${pgIdx + 1} of ${total}</span>` : ''}</p>
            <p class="tkp-name" title="${esc(P.name || 'Page')}${from ? ' · from ' + from : ''}">${esc(P.name || 'Page')}</p>
          </div>
          ${n ? `<span class="tkp-count">${doneN}/${n}</span>` : ''}
        </div>
        ${n ? `<div class="track tkp-track"><i class="ok" style="width:${Math.round(doneN / n * 100)}%"></i></div>` : ''}
        <div class="tkp-cwrap"><canvas class="tkp-canvas" width="720" height="900" data-pagecanvas
          title="${onMain() ? 'Tap a picture to shoot it full screen' + (window.CS3Lib ? ' (right-click to change it)' : '') + ', words to type over them, a shot’s box to tick it' : 'Click words to type over them, a picture spot to pick a shot'}"></canvas>
          <div class="pe-edit" hidden></div></div>
        ${nx !== -1 && n ? `<div class="tkp-next"${onMain() ? ` data-a="shootnext" role="button" tabindex="0" title="Shoot it full screen"` : ''}><span>Next up</span><b>${esc(shotTitle(P, nx))}</b>${onMain() ? '<i class="tkp-go">▶</i>' : ''}</div>`
          : n && doneN === n ? `<div class="tkp-next all"><span>All shot</span><b>Every shot on this page is done</b></div>` : ''}
        <div class="tkp-acts">
          ${onMain() && n ? `<button class="btn-sm tkp-shoot" data-a="shootmode">▶ Shoot mode</button>` : ''}
          <button class="btn-sm" data-a="openpage">${total > 1 ? `Open all ${total} pages` : 'Open the page'}</button>
          <details class="tkp-menu"><summary class="btn-sm" aria-label="More for this page">More ▾</summary><div>
            ${from ? `<p class="tkp-from">from ${from}</p>` : ''}
            <button data-a="hidedone" aria-pressed="${hide}">${hide ? '✓ Hiding done shots' : 'Hide done shots'}</button>
            <button data-a="addpage">＋ Add another page</button>
            ${onMain() ? `<div class="tkp-change">${pageSelectHTML('Change page…')}</div>
            <button data-a="unpage" class="danger">Remove page</button>`
              : `<button data-a="unmore" class="danger">Remove this page</button>`}
          </div></details>
        </div>
      </div>`;
    }

    /* the page itself, drawn small, with done spots washed out and the next one ringed */
    async function drawPage(){
      const c = el.querySelector('[data-pagecanvas]');
      const P = curPage();
      if(!c || !P || c.closest('[hidden]')) return;   /* folded on a phone: nothing to draw */
      const key = P.id + ':' + (P.slots || []).map(sl => sl.item).join(',');
      if(key !== pageMediaKey){ pageMedia = await Notebook.prepare(P); pageMediaKey = key; }
      if(!c.isConnected) return;
      const ctx = c.getContext('2d');
      if(onMain()) syncPage();
      paintPage(ctx, P, 0);
      animatePage(c, P);
    }
    /* v4: GIFs move and clips play on the page, as they do in the page editor.
       About 12 frames a second, and only while the page is on screen. */
    let pageRaf = 0;
    function animatePage(c, P){
      cancelAnimationFrame(pageRaf);
      const ms = Object.values(pageMedia || {}).filter(Boolean);
      if(!ms.some(m => m.kind === 'anim' || m.kind === 'video')) return;
      ms.forEach(m => { if(m.kind === 'video' && m.el){ m.el.muted = true; m.el.loop = true; m.el.play().catch(() => {}); } });
      const t0 = performance.now();
      let last = 0;
      const tick = now => {
        if(!c.isConnected || curPage() !== P) return;
        if(now - last > 80 && document.visibilityState !== 'hidden'){ last = now; paintPage(c.getContext('2d'), P, (now - t0) / 1000); }
        pageRaf = requestAnimationFrame(tick);
      };
      pageRaf = requestAnimationFrame(tick);
    }
    function paintPage(ctx, P, tsec){
      Notebook.draw(ctx, P, { scale:1, media:pageMedia, linesOnly:false, t:tsec });
      const slots = P.slots || [];
      const rects = Notebook.slotRects(P.layout, slots.length);
      const nx = nextOn(P);
      rects.forEach((r, i) => {
        const sl = slots[i] || {};
        const [x0, y0, x1, y1] = r;
        if(P.layout !== 'steps'){
          if(sl.done){ ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
          ctx.fillStyle = 'rgba(26,26,28,0.82)'; ctx.fillRect(x0 + 6, y0 + 6, 26, 20);
          ctx.fillStyle = '#fff'; ctx.font = '700 13px "NB Bold", sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
          ctx.fillText(String(i + 1), x0 + 19, y0 + 16.5);
        }
        if(sl.done){
          const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rr = Math.min(34, (x1 - x0) / 4);
          ctx.fillStyle = 'rgba(52,168,83,0.92)'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = rr / 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(cx - rr * 0.45, cy + rr * 0.02); ctx.lineTo(cx - rr * 0.1, cy + rr * 0.36); ctx.lineTo(cx + rr * 0.48, cy - rr * 0.34); ctx.stroke();
        }
        if(i === nx){ ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 6; ctx.strokeRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4); }
      });
    }

    /* ---- working on the page in the task, as in the page editor: words are
       typed over, a picture spot picks a shot from the Library, a shot's own
       box ticks it (and its step). Nothing else ticks a shot. */
    const pagePoint = (e, c) => { const b = c.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * Notebook.PAGE_W, (e.clientY - b.top) / b.height * Notebook.PAGE_H]; };
    const inRect = (p, r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];
    async function pageTap(e, c){
      const P = curPage();
      if(!P) return;
      const p = pagePoint(e, c);
      const spots = Notebook.textSpots(P);
      for(let k = spots.length - 1; k >= 0; k--){
        const sp = spots[k];
        if(!inRect(p, sp.r)) continue;
        if(sp.key.startsWith('done:')){ const i = +sp.key.slice(5); return setShotDone(i, !shotDone(P, i)); }
        if(sp.key.startsWith('swatch:')){
          const i = +sp.key.slice(7);
          const inp = document.createElement('input'); inp.type = 'color';
          const pal = (P.palette || []).length >= 7 ? P.palette : Notebook.FRAMES_PALETTE.slice();
          inp.value = String(pal[i] || '#000000').toLowerCase();
          inp.addEventListener('change', async () => { P.palette = pal.slice(); P.palette[i] = inp.value.toUpperCase(); await save(); render(); });
          inp.click();
          return;
        }
        if(sp.key === 'music'){
          if(!P.music) return U.toast('Add music to this page from “Open the page”');
          const a = await Notebook.playerFor(P);
          if(!a) return U.toast('That link opens in its own app');
          if(a.paused) a.play(); else a.pause();
          return;
        }
        return typeOver(sp, c);
      }
      const i = Notebook.slotRects(P.layout, (P.slots || []).length).findIndex(r => inRect(p, r));
      if(i < 0) return;
      /* v4: on the shot page a picture opens shoot mode on that shot; changing
         it is right-click → Pick a shot (laptop). The phone has no Library to
         pick from, so a spot there always opens shoot mode. */
      const sl = (P.slots || [])[i] || {};
      if(onMain() && (sl.item || !window.CS3Lib)) return openShoot(i);
      if(!window.CS3Lib){ if(sl.item && window.LibView) LibView.view(sl.item); return; }
      return pickInto(i);
    }
    /* each shot step's own frame: a GIF moves, a clip loops (muted) */
    async function fillThumbs(){
      const ths = [...el.querySelectorAll('.tk-th[data-item]')];
      if(!ths.length || !window.MediaLib) return;
      let lib = null;
      try { lib = await MediaLib.load(); } catch(e){ return; }
      for(const b of ths){
        const it = MediaLib.find(lib, b.dataset.item);
        const u = it ? await MediaLib.url(it).catch(() => null) : null;
        if(!b.isConnected || !u) continue;
        b.innerHTML = it.kind === 'video' ? `<video src="${esc(u)}" muted loop autoplay playsinline preload="metadata"></video>` : `<img src="${esc(u)}" alt="">`;
      }
    }
    /* v4, phone: a shot takes one of the starred frames (laptop: the Library picker) */
    function swapFrame(i){ return window.CS3Lib ? pickInto(i) : starPick(i); }
    function starPick(i){
      if(!window.StarPick) return;
      const P = curPage();
      const sl = P && (P.slots || [])[i];
      if(!sl) return;
      const was = sl.item;
      StarPick.open({ title:`Shot ${i + 1} — ${was ? 'swap its frame' : 'pick a starred frame'}`, clear:!!sl.item, onPick: async uid => {
        sl.item = uid || '';
        pageMediaKey = '';
        await save(); render();
        if(was && t.pageFrom && t.pageFrom.template) U.toast(`Swapped for this task — “${t.pageFrom.template}” stays as it is`);
      } });
    }
    function openShoot(i){
      if(H) return Screens.push('shoot-run', { host:H, at:i == null ? undefined : i, onChange: async () => { await load(); render(); } });
      return Screens.push('shoot-run', { id:t.id, at:i == null ? undefined : i, onChange: async () => { await load(); render(); } });
    }
    function typeOver(spot, c){
      const P = curPage();
      const wrap = c.parentElement.querySelector('.pe-edit');
      const k = c.getBoundingClientRect().width / Notebook.PAGE_W;
      const fam = { marker:'NB Marker', hand:'NB Hand', mono:'NB Mono' }[spot.fam] || 'NB Hand';
      wrap.hidden = false;
      wrap.innerHTML = '<textarea spellcheck="false"></textarea>';
      const ta = wrap.querySelector('textarea');
      Object.assign(wrap.style, { left:(spot.r[0] * k - 2) + 'px', top:(spot.r[1] * k - 2) + 'px',
        width:Math.max(80, (spot.r[2] - spot.r[0]) * k + 30) + 'px', height:Math.max(24, (spot.r[3] - spot.r[1]) * k + 10) + 'px' });
      Object.assign(ta.style, { fontFamily:`"${fam}"`, fontSize:Math.max(11, spot.size * k) + 'px', color:'rgb(26,26,28)' });
      ta.value = Notebook.fieldOf(P, spot.key);
      ta.focus(); ta.select();
      let gone = false;
      const commit = async keep => {
        if(gone) return;
        gone = true;
        if(keep) Notebook.setField(P, spot.key, ta.value.trim());
        wrap.hidden = true; wrap.innerHTML = '';
        if(keep){ await save(); render(); }
      };
      ta.addEventListener('blur', () => commit(true));
      ta.addEventListener('keydown', ev => {
        if(ev.key === 'Escape'){ ev.stopPropagation(); commit(false); }
        if(ev.key === 'Enter' && !(spot.multi && ev.shiftKey)){ ev.preventDefault(); ta.blur(); }
      });
    }
    async function pickInto(i){
      const P = curPage();
      const u = await LibView.pick({ title:'Pick a shot for spot ' + (i + 1) });
      if(!u) return;
      while(P.slots.length <= i) P.slots.push({ item:'', tone:'', text:'', role:'', done:false });
      P.slots[i].item = u;
      pageMediaKey = '';
      await save(); render();
    }
    function slotMenu(e, c){
      const P = curPage();
      if(!P) return;
      const i = Notebook.slotRects(P.layout, (P.slots || []).length).findIndex(r => inRect(pagePoint(e, c), r));
      if(i < 0) return;
      e.preventDefault();
      const sl = P.slots[i] || {};
      document.querySelectorAll('.pe-ctx').forEach(x => x.remove());
      const m = document.createElement('div');
      m.className = 'pe-ctx';
      m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px';
      m.innerHTML = `<button data-c="pick">Pick a shot…</button><hr>
        ${[['', 'As shot (colour)'], ['bw', 'Black & white'], ['flat', 'Ungraded (flat log look)']].map(([v, l]) =>
          `<button data-c="tone" data-v="${v}">${(sl.tone || '') === v ? '● ' : ''}${l}</button>`).join('')}
        ${sl.item ? `<hr><button data-c="view">View big</button><button data-c="clear">Empty this spot</button>` : ''}`;
      document.body.appendChild(m);
      const off = ev => { if(!m.contains(ev.target)){ m.remove(); document.removeEventListener('mousedown', off, true); } };
      document.addEventListener('mousedown', off, true);
      m.addEventListener('click', async ev => {
        const b = ev.target.closest('[data-c]');
        if(!b) return;
        m.remove();
        if(b.dataset.c === 'pick') return pickInto(i);
        if(b.dataset.c === 'view') return LibView.view(sl.item);
        if(b.dataset.c === 'clear') sl.item = '';
        if(b.dataset.c === 'tone') sl.tone = b.dataset.v;
        pageMediaKey = '';
        await save(); render();
      });
    }

    /* ---- one shot of the page on show, changed from its step or the page */
    async function setShotDone(i, v){
      const P = curPage();
      if(onMain()){
        TaskPages.match(t);
        (t.subs || []).forEach(s2 => { if(s2.shot === i) s2.done = v; });
        if(t.subs.length && t.subs.every(x => x.done)) t.view = 'done';
        else if(t.view === 'done') t.view = 'todo';
      } else if(P.slots[i]) P.slots[i].done = v;
      await save(); render();
    }
    /* name, type or note: saved without redrawing the list, so typing on into
       the next field (or ticking a box) isn't lost */
    async function shotField(key, value){
      const [what, n] = String(key).split(':');
      const i = +n, P = curPage();
      const sl = P && (P.slots || [])[i];
      if(!sl) return;
      const v = String(value || '').trim();
      if(what === 'role') sl.role = v;
      else if(what === 'text') sl.text = v;
      else if(what === 'note'){
        if(onMain()){ TaskPages.match(t); const s2 = stepOf(i); if(s2){ if(v) s2.note = v; else delete s2.note; } }
        else { if(v) sl.note = v; else delete sl.note; }
      }
      await save();
      drawPage();
      const nb = el.querySelector('.tkp-next b'), nx = nextOn(P);
      if(nb && nx !== -1) nb.textContent = shotTitle(P, nx);
    }
    async function shotMove(i, j){
      const slots = curPage().slots;
      if(j < 0 || j >= slots.length) return;
      [slots[i], slots[j]] = [slots[j], slots[i]];
      if(onMain()) (t.subs || []).forEach(s2 => { if(s2.shot === i) s2.shot = j; else if(s2.shot === j) s2.shot = i; });
      pageMediaKey = '';
      await save(); render();
    }
    async function shotRemove(i){
      const slots = curPage().slots;
      if(slots.length <= 1) return;
      slots.splice(i, 1);
      if(onMain()){
        t.subs = (t.subs || []).filter(s2 => s2.shot !== i);
        t.subs.forEach(s2 => { if(s2.shot != null && s2.shot > i) s2.shot--; });
      }
      pageMediaKey = '';
      await save(); render();
    }
    async function shotAdd(){
      const slots = curPage().slots;
      if(slots.length >= (Notebook.MAX_STEPS || 14)) return U.toast('The page holds ' + (Notebook.MAX_STEPS || 14) + ' shots at most');
      slots.push({ item:'', tone:'', text:'', role:'', done:false });
      if(onMain() && t.view === 'done') t.view = 'todo';
      pageMediaKey = '';
      await save(); render();
      const f = el.querySelector(`[data-pf="text:${slots.length - 1}"]`);
      if(f) f.focus();
    }
    function goPage(k){
      const n = allPages().length;
      if(k < 0 || k >= n || k === pgIdx) return;
      slideDir = k > pgIdx ? 'slide-l' : 'slide-r';
      pgIdx = k; pageMediaKey = '';
      render();
    }

    /* swipes linked to this task itself — the old single swipeId counts too */
    const ownRefs = () => {
      const ids = (t && t.swipeIds) ? t.swipeIds.slice() : [];
      if(t && t.swipeId && !ids.includes(t.swipeId)) ids.unshift(t.swipeId);
      return ids;
    };
    const clipRefs = () => (clipRec && clipRec.plan && clipRec.plan.swipeIds) || [];
    const planRefs = () => (planRec && planRec.swipeIds) || [];
    /* Photos pinned to this task — a reference shot, a diagram, a photo of the
       thing you are fixing. Keyed <taskId>:<n> so a task can hold several;
       the inbox keeps one per note and that was not enough here. */
    let shots = [];
    async function loadShots(){
      try {
        const blobs = await Store.allMap('task-media');
        shots.forEach(x => URL.revokeObjectURL(x.url));
        shots = Object.entries(blobs)
          .filter(([k]) => k.split(':')[0] === String(t.id))
          .sort((a, b) => (+a[0].split(':')[1] || 0) - (+b[0].split(':')[1] || 0))
          .map(([k, b]) => ({ key:k, url:URL.createObjectURL(b) }));
      } catch(e){ shots = []; }
    }

    async function save(){
      if(t && t.page && window.TaskPages) TaskPages.match(t);
      syncPage();
      if(H){ await H.save(t); params.onChange && params.onChange(); return; }
      await Store.put('tasks', t);
      Data.invalidate('tasks');
      Notify.update();
      Reminders.sync();
      params.onChange && params.onChange();
    }
    const dayLabel = n => {
      if(!startDate) return `Day ${n}`;
      const d = new Date(startDate);
      d.setDate(d.getDate() + (n - 1));
      return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    };

    const typeLabel = id => {
      const k = lib.find(x => x.id === id);
      return k ? k.label : id;
    };

    /* Every angle in the library, in one horizontal run. */
    function stripHTML(planned){
      const rows = angQ
        ? lib.filter(k => (k.label + ' ' + (k.hint || '')).toLowerCase().includes(angQ))
        : lib;
      if(!rows.length) return `<span class="grp">Nothing matches</span>`;
      const groups = {};
      rows.forEach(k => { (groups[k.group || 'Other'] = groups[k.group || 'Other'] || []).push(k); });
      return Object.entries(groups).map(([g, items]) =>
        `<span class="grp">${g}</span>` +
        items.map(k => `<span class="ang${planned.has(k.id) ? ' got' : ''}" data-toggleang="${k.id}">${
          planned.has(k.id) ? '✓ ' : ''}${k.label}</span>`).join('')
      ).join('');
    }

    function shotsBlock(){
      const shots = t.shots || [];
      const tt = Coverage.shotTotals(t);
      const covered = shots.filter(Coverage.shotDone).length;
      return `
      <div class="block fold${fold.shots ? ' open' : ''}" data-fold="shots">
        <h4><svg class="fcv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          Shot list<span class="cnt">${shots.length ? `${covered}/${shots.length} covered · ${tt.got} angles` : 'none yet'}</span></h4>
        <div class="fbody">
          ${shots.length ? `<div class="track" style="margin:0 0 14px"><i class="ok" style="width:${tt.pct}%"></i></div>` : ''}
          ${shots.length ? shots.map((s2,i) => {
            const got = Coverage.shotGot(s2), want = Coverage.shotTarget(s2);
            const full = got >= want;
            const planned = new Set((s2.angles || []).map(a => a.type));
            const sNo = stepNo(s2);
            return `
            <div class="shotrow${full ? ' done' : ''}${planning === i ? ' planning' : ''}${sNo ? ' isstep' : ''}">
              <span class="sn${sNo ? '' : ' blank'}">${sNo || ''}</span>
              <span class="tx" data-shotedit="${i}">${s2.text}${s2.note ? `<small>${s2.note}</small>` : ''}
                ${(s2.angles || []).length ? `<span class="angles">
                  ${s2.angles.map((a,ai) => `<span class="ang${a.done ? ' got' : ''}" data-ang="${i}:${ai}"
                    ${a.doneAt ? `title="Shot at ${new Date(a.doneAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}"` : ''}>${
                    a.done ? '✓ ' : ''}${typeLabel(a.type)}${
                    a.doneAt ? `<i>${new Date(a.doneAt).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}</i>` : ''}</span>`).join('')}
                </span>` : `<span class="angles"><span class="ang plan">No angles planned</span></span>`}
                <span class="refstrip">
                  ${(s2.refs || []).map((rid, ri) => `<span class="refchip" data-refopen="${i}:${ri}">
                    ${REFTHUMBS[rid] ? `<img src="${REFTHUMBS[rid]}" alt="">` : ''}
                    ${REFKIND[rid] === 'video' ? `<span class="pl">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg></span>` : ''}
                    <span class="x" data-refdel="${i}:${ri}">×</span>
                  </span>`).join('')}
                  <button class="refadd" data-reflink="${i}" aria-label="Link a reference">+</button>
                </span>
              </span>
              <span class="ring2${full ? ' full' : ''}" data-shotedit="${i}">${got}/${want}</span>
              <button class="mini rm" data-shotdel="${i}" aria-label="Remove this shot">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
              <span class="shotmv">
                <button class="mini" data-shotmv="up:${i}" ${i===0?'disabled':''} aria-label="Move up">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg></button>
                <button class="mini" data-shotmv="down:${i}" ${i===shots.length-1?'disabled':''} aria-label="Move down">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
              </span>
              <button class="addang" data-plan="${i}" aria-label="Plan the angles">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14.5 6.5l3 3"/></svg>
              </button>
            </div>
            ${planning === i ? `
              <div class="angsearch">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>
                <input id="angq" type="text" placeholder="Find an angle…" value="${angQ}">
                ${angQ ? `<button class="angclear" data-angclear aria-label="Clear">×</button>` : ''}
              </div>
              <div class="angstrip">${stripHTML(planned)}</div>
              <p class="striphint">${angQ ? 'Filtered' : 'Scroll for more'} · tap to add or remove — ${planned.size} planned.</p>` : ''}`;
          }).join('')
            : `<p style="margin:0;color:var(--muted);font-size:14.5px;line-height:1.55">
                 The actual shots you want — "me walking across the street", "hands on the drill".
                 Each one wants ${Coverage.ANGLE_TARGET} angles, and every angle you log counts toward
                 your coverage.</p>`}
          ${shots.some(x => stepNo(x)) && shots.length > 1 ? `<button class="btn-sm" data-a="sortshots"
            style="width:100%;margin-top:12px;justify-content:center">Sort by step order</button>` : ''}
          <div style="display:flex;gap:9px;margin-top:12px">
            <input id="newshot" type="text" placeholder="Add a shot and press Enter"
              style="flex:1;height:44px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
              color:var(--cream);font-size:15px;padding:0 11px;outline:none">
            <button class="btn-sm" data-a="addshot" style="width:52px;justify-content:center">+</button>
          </div>
        </div>
      </div>`;
    }

    /* A step and a shot are linked when they share a name. Nothing is stored,
       so adding or removing either side keeps the other honest. */
    const norm = v => String(v || '').trim().toLowerCase();
    const hasShot = text => (t.shots || []).some(sh => norm(sh.text) === norm(text));
    const stepNo = sh => {
      const i = (t.subs || []).findIndex(x => norm(x.t) === norm(sh.text));
      return i === -1 ? null : i + 1;
    };

    function stepsBlock(){
      const steps = t.subs || [];
      const done = steps.filter(s2 => s2.done).length;
      return `
      <div class="block fold${t.page ? ' open tk-keep' + (rowsShut() ? ' shut' : '') : fold.steps ? ' open' : ''}" data-fold="steps">
        <h4><svg class="fcv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          Steps<span class="cnt">${steps.length ? `${done} of ${steps.length}` : 'none yet'}</span></h4>
        <div class="fbody">
          ${t.page ? pagedSteps() : plainSteps()}
        </div>
      </div>`;
    }

    /* a task with no shot page: the steps as they always were */
    function plainSteps(){
      const steps = t.subs || [];
      return `${!steps.length ? `<p style="margin:0;color:var(--muted);font-size:14.5px;line-height:1.55">
                 The jobs that make up this task — clear the ground, set the frame, build the walls.</p>`
        : steps.map((s2, i) => otherRow(s2, i, steps.length)).join('')}
          <div style="display:flex;gap:9px;margin-top:12px">
            <input id="newstep" type="text" placeholder="Add a step and press Enter"
              style="flex:1;height:44px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
              color:var(--cream);font-size:15px;padding:0 11px;outline:none">
            <button class="btn-sm" data-a="addstep" style="width:52px;justify-content:center">+</button>
          </div>
          <div class="tkp-link">${pageSelectHTML('Add a shot page from Templates…')}
            <p class="hintline" style="margin:6px 0 0">Pick a notebook page — like the nine-shot task sequence — and its shots become the steps, ticked off as you film.</p></div>
          ${morePages().length ? `<div class="tkp-pagesrow">
            <span>${morePages().length} page${morePages().length === 1 ? '' : 's'} kept with this task</span>
            <button class="btn-sm" data-a="openpage">Open ${morePages().length === 1 ? 'the page' : 'the pages'}</button></div>` : ''}
          ${steps.length ? tickAllRow() : ''}`;
    }
    const tickAllRow = () => `
          <div style="display:flex;gap:9px;margin-top:10px">
            <button class="btn-sm" data-a="allon" style="flex:1;justify-content:center">Tick all</button>
            <button class="btn-sm" data-a="alloff" style="flex:1;justify-content:center">Clear all</button>
          </div>`;
    const PEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14.5 6.5l3 3"/></svg>`;
    const UP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>`;
    const DOWN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
    const CROSS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
    /* a step that stands for no shot: tick it by its row, edit with the pencil */
    const otherRow = (s2, i, n) => `
            <div class="shotline${s2.done ? ' done' : ''}" data-step="${i}">
              <span class="bx">${ICON.check}</span>
              <span class="sn">${i + 1}</span>
              <span class="tx">${esc(s2.t)}${s2.note ? `<br><span style="color:var(--dim);font-size:12.5px">${esc(s2.note)}</span>` : ''}</span>
              ${t.page ? '' : `<button class="mini" data-mv="up:${i}" ${i === 0 ? 'disabled' : ''} aria-label="Up">${UP}</button>
              <button class="mini" data-mv="down:${i}" ${i === n - 1 ? 'disabled' : ''} aria-label="Down">${DOWN}</button>`}
              <button class="mini" data-edit="${i}" aria-label="Edit">${PEN}</button>
            </div>`;

    /* v4: the step list folds to one line; the page arrows and the shot page stay */
    const rowsKey = () => String(t && t.id);
    const rowsShut = () => !!rowsFolded()[rowsKey()];
    /* the script lines said over a shot: on its step (the main page), or on the spot */
    function linesOf(i){
      if(onMain()){ const s2 = stepOf(i); return (s2 && s2.lines) || []; }
      return ((curPage().slots || [])[i] || {}).lines || [];
    }
    function linesHolder(i){
      if(onMain()){ TaskPages.match(t); return stepOf(i); }
      return (curPage().slots || [])[i] || null;
    }
    const LSHORT = { vo:'VO', cam:'CAM', txt:'TXT' }, LNEXT = { vo:'cam', cam:'txt', txt:'vo' };
    const TWIRL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
    function linesHTML(i){
      const ls = linesOf(i);
      return `<div class="tk-lines">${ls.map((l, j) => `<div class="tk-ln">
          <button class="tk-lk ${LSHORT[l.k] ? l.k : 'vo'}" data-tlk="${i}:${j}" title="Tap to change: VO voiceover → CAM said to camera → TXT words on screen">${LSHORT[l.k] || 'VO'}</button>
          ${l.hook ? '<span class="tk-lhook" title="The hook">HOOK</span>' : ''}
          <textarea class="tk-lt" rows="1" data-tlt="${i}:${j}" placeholder="${l.k === 'txt' ? 'Words on screen' : 'What is said over this shot'}" aria-label="Script line">${esc(l.t || '')}</textarea>
          <button class="tk-lrm" data-tlrm="${i}:${j}" aria-label="Remove this line">×</button></div>`).join('')}
        <button class="tk-ladd" data-tladd="${i}">+ Add a line</button></div>`;
    }
    /* the beat each shot starts, when the record has a structure (structures.js) */
    function beatAt(){
      const names = t.beatNames || [];
      if(!onMain() || !names.length) return [];
      let cur = 0;
      return (curPage().slots || []).map((_, i) => { const s2 = stepOf(i); if(s2 && s2.beat != null && s2.beat >= 0 && s2.beat < names.length) cur = s2.beat; return cur; });
    }

    /* a task with a shot page: the arrows between its pages, then the page on
       show beside its shots. Every shot is a step: its box ticks it, its name
       and its type are changed right there (and on the page with them). */
    function pagedSteps(){
      const P = curPage();
      const pages = allPages();
      const slots = P.slots || [];
      const isSteps = P.layout === 'steps';
      const hide = t.hideDone !== false;
      const nx = nextOn(P);
      const roles = Notebook.ROLES || [];
      const canGrow = isSteps && slots.length < (Notebook.MAX_STEPS || 14);
      const canShrink = isSteps && slots.length > 1;
      const note = i => onMain() ? ((stepOf(i) || {}).note || '') : ((slots[i] || {}).note || '');
      let hidden = 0;
      const bAt = beatAt();
      let lastBeat = -1;
      const rows = slots.map((sl, i) => {
        const dn = shotDone(P, i);
        if(hide && dn){ hidden++; return ''; }
        const r = sl.role || '';
        const bk = bAt.length ? bAt[i] : -1;
        const div = bk >= 0 && bk !== lastBeat ? `<p class="tk-beat">${esc(t.beatNames[bk] || 'Beat ' + (bk + 1))}</p>` : '';
        lastBeat = bk;
        const nl = linesOf(i).filter(l => String(l.t || '').trim()).length;
        const lk = pgIdx + ':' + i, lo = linesOpen.has(lk);
        return `${div}
            <div class="shotline tk-ps${dn ? ' done' : ''}${i === nx ? ' tk-next' : ''}" data-ps="${i}">
              <button class="bx" data-tick="${i}" aria-label="Tick shot ${i + 1}" aria-pressed="${dn}">${ICON.check}</button>
              <span class="sn">${i + 1}</span>
              ${sl.item ? `<button class="tk-th" data-shootat="${i}" data-item="${esc(sl.item)}" aria-label="Shoot shot ${i + 1} full screen" title="Tap: shoot it full screen · Hold: swap the frame"></button>`
                : !window.CS3Lib && isSteps ? `<button class="tk-th tk-thadd" data-starpick="${i}" aria-label="Give shot ${i + 1} a starred frame">＋</button>` : ''}
              <span class="tx">
                <span class="tk-line">
                  ${isSteps ? `<select class="tk-rolesel${r ? '' : ' none'}" data-pf="role:${i}" aria-label="Shot ${i + 1} type">
                    <option value="">${r ? 'No type' : '+ Type'}</option>
                    ${roles.concat(r && !roles.includes(r) ? [r] : []).map(x => `<option value="${esc(x)}" ${r === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}
                  </select>` : ''}
                  ${i === nx ? `<span class="tk-nexttag">Next</span>` : ''}
                  <input type="text" class="tk-name" data-pf="text:${i}" value="${esc(sl.text || '')}" placeholder="${isSteps ? 'Shot' : 'Frame'} ${i + 1} — click to name it" aria-label="Shot ${i + 1} name">
                </span>
                <button class="tk-tw${lo ? ' on' : ''}" data-twirl="${i}" aria-expanded="${lo}">${TWIRL} Script${nl ? ' · ' + nl : ''}</button>
                <input type="text" class="tk-notein${note(i) ? ' has' : ''}" data-pf="note:${i}" value="${esc(note(i))}" placeholder="Add a note" aria-label="Shot ${i + 1} note">
              </span>
              <button class="mini" data-psmv="up:${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${UP}</button>
              <button class="mini" data-psmv="down:${i}" ${i === slots.length - 1 ? 'disabled' : ''} aria-label="Move down">${DOWN}</button>
              ${canShrink ? `<button class="mini rm" data-psdel="${i}" aria-label="Remove this shot">${CROSS}</button>` : ''}
            </div>${lo ? linesHTML(i) : ''}`;
      }).join('');
      const others = onMain() ? (t.subs || []).map((s2, i) => [s2, i]).filter(([s2]) => !hasShotNo(s2)) : [];
      const nav = pages.length > 1 ? `
          <div class="tkp-nav">
            <button class="tkp-arrow" data-pg="${pgIdx - 1}" ${pgIdx === 0 ? 'disabled' : ''} aria-label="Previous page">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>
            <div class="tkp-navmid">
              <span class="tkp-dots">${pages.map((_, k) => `<button class="${k === pgIdx ? 'on' : ''}" data-pg="${k}" aria-label="Page ${k + 1}"></button>`).join('')}</span>
              <b>${esc(P.name || 'Page')}</b>
              <small>Page ${pgIdx + 1} of ${pages.length}${onMain() ? ' · the task’s steps' : ''}</small>
            </div>
            <button class="tkp-arrow" data-pg="${pgIdx + 1}" ${pgIdx === pages.length - 1 ? 'disabled' : ''} aria-label="Next page">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>
          </div>` : '';
      const shut = rowsShut();
      const doneN = slots.filter((_, i) => shotDone(P, i)).length;
      const bar = params.embedded || shut ? `<div class="tk-rowsbar${shut ? ' shut' : ''}" data-a="rowsfold" role="button" tabindex="0" aria-expanded="${!shut}">
            <svg class="fcv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            <b>${isSteps ? 'Steps' : 'Frames'}</b><span>${slots.length} shot${slots.length === 1 ? '' : 's'} · ${doneN} taken${shut && nx !== -1 ? ' · next: ' + esc(shotName(nx)) : ''}</span></div>` : '';
      if(shut) return `${nav}
          <div class="tkp-split${slideDir ? ' ' + slideDir : ''}"><div class="tkp-left">${bar}</div><div class="tkp-right">${pageCardHTML()}</div></div>`;
      return `${nav}
          <div class="tkp-split${slideDir ? ' ' + slideDir : ''}"><div class="tkp-left">${bar}
          ${slots.length ? rows : `<p style="margin:0;color:var(--muted);font-size:14.5px;line-height:1.55">This page has no shots to tick — type on it and add pictures on the right.</p>`}
          ${hidden ? `<button class="tk-hidden" data-a="hidedone">${hidden} done shot${hidden === 1 ? '' : 's'} hidden · Show</button>` : ''}
          ${canGrow ? `<button class="btn-sm tks-add" data-a="psadd">＋ Add a shot</button>` : ''}
          ${others.length ? `<p class="tks-other">Not on the page · ${others.length} older step${others.length === 1 ? '' : 's'}</p>`
            + others.map(([s2, i]) => otherRow(s2, i, others.length)).join('') : ''}
          ${slots.length ? tickAllRow() : ''}
          </div><div class="tkp-right">${pageCardHTML()}</div></div>`;
    }

    function detailsBlock(){
      return `
      <div class="block fold${fold.details ? ' open' : ''}" data-fold="details">
        <h4><svg class="fcv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          Details<span class="cnt">${[t.cad, PRI_LABEL[t.pri]]
            .filter(Boolean).join(' · ') || 'not set'}</span></h4>
        <div class="fbody">
          <div class="metaline" style="margin:0">
            <button class="btn-sm" data-a="when">${t.at ? fmtTime(t.at) : 'No time'} · ${dayLabel(t.day)}</button>
            <!-- these two stay visible even when unset — they are how you set
                 them — so they say so rather than naming a missing value -->
            <button class="btn-sm" data-a="cad">${t.cad || 'No cadence'}</button>
            <button class="btn-sm" data-a="pri">${PRI_LABEL[t.pri] || 'No priority'}</button>
          </div>
          ${t.prog ? `<p style="margin:12px 0 0;color:var(--muted);font-size:14px">Target · ${t.prog}</p>` : ''}
        </div>
      </div>`;
    }

    function render(){
      if(!t){ if(H){ el.innerHTML = '<p class="hintline">This one is gone.</p>'; return; } Screens.pop(); return; }
      /* pull in any thumbnails we do not have yet, then repaint just the strips */
      loadRefThumbs(t).then(() => {
        el.querySelectorAll('.refchip img').forEach(img => {
          if(!img.getAttribute('src')) render();
        });
      });
      /* rebuilding the screen would otherwise throw you back to the top */
      const prev = el.querySelector('.view');
      const keep = prev ? prev.scrollTop : 0;
      const ae = document.activeElement;
      const focusKey = ae && el.contains(ae) && ae.dataset ? ae.dataset.pf || null : null;
      const steps = t.subs || [];
      const done = steps.filter(s => s.done).length;
      const pct = steps.length ? Math.round(done / steps.length * 100) : 0;

      el.innerHTML = H ? (params.embedded ? '' : Screens.bar({ kicker:H.kicker || '', title:t.title })) +
        `<div class="tk-host${params.embedded ? ' embedded' : ''}">${stepsBlock()}</div>` : Screens.bar({ kicker:'Today', title:t.title,
        actions:`<button class="btn-sm" data-a="rename">Rename</button>` }) + `
      <div class="view">
        ${t.series ? `<div style="display:flex;align-items:center;gap:10px;padding:12px 13px;
          border-radius:var(--r);background:var(--surface-2);border:1px solid #2B2822;margin:0 0 14px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"
            style="width:16px;height:16px;color:var(--orange);flex:0 0 16px">
            <path d="M4 10a8 8 0 0 1 14-5M20 14a8 8 0 0 1-14 5M18 4v5h-5M6 20v-5h5"/></svg>
          <span style="flex:1;font-size:13.5px;color:var(--muted);line-height:1.45">
            Repeats <b style="color:var(--orange)">${seriesFreq(t)}</b>. Edits to the
            steps or the time here affect this day only.</span>
          <button class="btn-sm accent" data-a="refreq">Change</button>
          <button class="btn-sm" data-endseries="${t.series}">End it</button>
        </div>` : ''}
        ${t.note ? `<div style="padding:13px;border-radius:var(--r);background:var(--surface-2);
          border:1px solid #2B2822;margin:0 0 14px">
          ${t.source ? `<p style="margin:0 0 7px;font-family:var(--display),sans-serif;font-weight:900;
            font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--orange)">
            ${t.source}</p>` : ''}
          <p style="margin:0;font-size:14.5px;line-height:1.6;color:var(--muted)">${t.note}</p>
        </div>` : ''}

        <!-- Somewhere to explain the task to yourself: what "done" looks like,
             the measurement you took, a photo of the thing. Notes were read-only
             here and arrived only from whatever created the task. -->
        <div class="sec" style="margin-top:4px"><h2>Notes</h2><div class="rule"></div>
          ${shots.length ? `<span class="alt">${shots.length}</span>` : ''}</div>

        <textarea id="tk-note" class="tknote" rows="3"
          placeholder="What you need to remember when you get to this.">${
          String(t.notes || '').replace(/</g, '&lt;')}</textarea>

        ${shots.length ? `<div class="tkshots">
          ${shots.map(x => `<span class="tkshot" style="background-image:url(${x.url})">
            <button class="tkx" data-rmshot="${x.key}" aria-label="Remove">×</button>
          </span>`).join('')}
        </div>` : ''}

        <button class="btn-ghost" data-a="addshot" style="width:100%;margin:10px 0 16px">
          ${shots.length ? 'Add another photo' : 'Add a photo'}</button>
        ${t.planId ? `<div style="display:flex;align-items:center;gap:10px;padding:12px 13px;
          border-radius:var(--r);background:var(--surface-2);border:1px solid #2B2822;margin:0 0 14px">
          <span style="flex:1;font-size:13.5px;color:var(--muted);line-height:1.45">
            This one comes from a program plan, which is where its frequency and
            targets are set.</span>
          <button class="btn-sm accent" data-a="openplan">Edit plan</button>
        </div>` : ''}
        ${t.routineId
          ? `<button class="btn-primary" data-start-workout="${t.routineId}"
              style="width:100%;margin:0 0 14px">Start this workout</button>`
          : `<button class="btn-ghost" data-link-workout
              style="width:100%;margin:0 0 14px">Link a workout to this task</button>`}
        ${t.clipId ? (() => {
          const vl = (clipRec && clipRec.plan && clipRec.plan.versions) || [];
          if(!vl.length) return `<button class="btn-ghost" data-plan-clip="${t.clipId}"
            style="width:100%;margin:0 0 14px">Open the clip plan</button>`;
          const pr = Versions.progress(vl);
          return `<button class="btn-ghost" data-plan-clip="${t.clipId}"
            style="width:100%;margin:0 0 14px;display:block;text-align:left;padding:12px 14px">
            <span style="display:flex;justify-content:space-between;gap:10px;font-size:14.5px">
              <span>Open the clip plan</span>
              <span style="color:var(--muted)">${pr.edited}/${pr.total} versions edited · ${pr.posted} posted</span></span>
            <span style="position:relative;display:block;height:6px;margin-top:9px;border-radius:3px;
              background:var(--surface-1);overflow:hidden">
              <i style="position:absolute;left:0;top:0;bottom:0;width:${pr.pctEdited}%;background:rgba(245,158,11,.45)"></i>
              <i style="position:absolute;left:0;top:0;bottom:0;width:${pr.pctPosted}%;background:var(--green)"></i>
            </span>
          </button>`;
        })() : ''}
        <div class="block">
          <div class="metaline" style="margin:0">
            <!-- Not every path that makes a task sets these: one from a clip, a
                 shot, a quick capture or a vlog day has neither, and the tag
                 printed the missing value as a word on the detail page. -->
            ${t.cad ? `<span class="tg">${t.cad}</span>` : ''}
            ${PRI_LABEL[t.pri] ? `<span class="tg count" style="color:var(--${
              t.pri === 'low' ? 'low' : t.pri === 'med' ? 'med' : 'high'})">${
              PRI_LABEL[t.pri]}</span>` : ''}
            <span class="tg count">${dayLabel(t.day)}</span>
            ${t.at ? `<span class="tg count">${fmtTime(t.at)}</span>` : ''}
            ${t.view === 'done' ? `<span class="tg count" style="color:var(--green)">Done</span>` : ''}
          </div>
          ${steps.length ? `<div class="track" style="margin-top:13px">
            <i class="ok" style="width:${pct}%"></i></div>
            <p style="margin:9px 0 0;font-size:13.5px;color:var(--muted)">${done} of ${steps.length} done</p>` : ''}
        </div>

        ${stepsBlock()}
        ${detailsBlock()}

        ${(() => {
          const n = new Set(ownRefs().concat(clipRefs(), planRefs())).size;
          /* nothing linked yet: just the one quiet button. The section, with room
             for more, appears once the first swipe is in. */
          if(!n) return `<button class="btn-ghost" data-swr-add
            style="width:100%;margin:0 0 14px">+ Link a swipe</button>`;
          const open = refsOpen === null ? n > 0 : refsOpen;
          return `<details class="cp-sec" id="sec-refs"${open ? ' open' : ''} style="margin:0 0 14px">
            <summary>References<span class="n">${n ? `${n} swipe${n === 1 ? '' : 's'}` : 'none linked'}</span>
              <svg class="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
                stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></summary>
            <div class="cp-body"><div id="swr-slot"></div></div>
          </details>`;
        })()}

        <div class="metaline">
          <button class="btn-sm accent" data-a="toggle" style="flex:1;justify-content:center">
            ${t.view === 'done' ? 'Mark not done' : 'Mark done'}</button>
        </div>
        <button class="btn-ghost" data-a="delete" style="width:100%;margin-top:12px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete task</button>
      </div>`;

      const view = el.querySelector('.view');
      if(view && keep) view.scrollTop = keep;

      const refsSec = el.querySelector('#sec-refs');
      if(refsSec) refsSec.addEventListener('toggle', () => { refsOpen = refsSec.open; });
      if(el.querySelector('#swr-slot')) SwipeRefs.fill(el.querySelector('#swr-slot'), {
        own: ownRefs(),
        inherited: clipRefs().map(id => ({ id, from:'from clip' }))
          .concat(planRefs().filter(id => !clipRefs().includes(id)).map(id => ({ id, from:'from plan' }))),
        empty: t.clipId ? 'Nothing linked here or on the clip yet.' : 'Link the videos this task is borrowing from.'
      });

      const aq = el.querySelector('#angq');
      if(aq){
        aq.addEventListener('input', () => {
          angQ = aq.value.trim().toLowerCase();
          const strip = el.querySelector('.angstrip');
          const planned = new Set((t.shots[planning].angles || []).map(a => a.type));
          if(strip) strip.innerHTML = stripHTML(planned);
          const hint = el.querySelector('.striphint');
          if(hint) hint.textContent = `${angQ ? 'Filtered' : 'Scroll for more'} · tap to add or remove — ${planned.size} planned.`;
        });
        if(angQ){ aq.focus(); aq.setSelectionRange(angQ.length, angQ.length); }
      }

      if(t.page) drawPage();
      slideDir = '';
      /* a shot's name, type and note: saved when left, or on Enter */
      el.querySelectorAll('[data-pf]').forEach(f => {
        f.addEventListener('change', () => shotField(f.dataset.pf, f.value));
        if(f.tagName === 'SELECT') f.addEventListener('change', () => f.classList.toggle('none', !f.value));
        if(f.tagName === 'INPUT'){
          f.addEventListener('keydown', ev => {
            if(ev.key === 'Enter'){ ev.preventDefault(); f.blur(); }
            if(ev.key === 'Escape'){ ev.stopPropagation(); f.value = f.defaultValue; f.blur(); }
          });
          if(f.classList.contains('tk-notein')) f.addEventListener('input', () => f.classList.toggle('has', !!f.value.trim()));
        }
      });
      /* a script line: saved when left; its kind the moment it changes */
      el.querySelectorAll('.tk-lt').forEach(ta => {
        const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
        grow();
        ta.addEventListener('input', grow);
        ta.addEventListener('change', async () => {
          const [i, j] = ta.dataset.tlt.split(':').map(Number), h = linesHolder(i);
          if(!h || !h.lines || !h.lines[j]) return;
          h.lines[j].t = ta.value.trim();
          if(h.lines[j].hook) h.lines[j].at = Date.now();
          await save();
          const tw = el.querySelector(`[data-twirl="${i}"]`);
          if(tw){ const nl = h.lines.filter(l => String(l.t || '').trim()).length; tw.lastChild.textContent = ' Script' + (nl ? ' · ' + nl : ''); }
        });
      });
      if(focusKey){
        const f = el.querySelector(`[data-pf="${focusKey}"]`);
        if(f){ f.focus({ preventScroll:true }); if(f.setSelectionRange && f.type === 'text'){ const n = f.value.length; f.setSelectionRange(n, n); } }
      }
      const cv = el.querySelector('[data-pagecanvas]');
      if(cv) cv.addEventListener('contextmenu', ev => slotMenu(ev, cv));
      fillThumbs();
      /* hold a step's frame to swap it — for this task only, the template stays
         (phone: a starred frame; laptop: anything in the Library) */
      el.querySelectorAll('.tk-th[data-shootat]').forEach(b => U.onHold(b, () => swapFrame(+b.dataset.shootat)));
      el.querySelectorAll('[data-pagepick]').forEach(sel => sel.addEventListener('change', () => {
        if(sel.value) linkPage(sel.value);
      }));

      const stepIn = el.querySelector('#newstep');
      if(stepIn) stepIn.addEventListener('keydown', async e => {
        if(e.key === 'Enter') await addStep(stepIn.value);
      });
      const shotIn = el.querySelector('#newshot');
      if(shotIn) shotIn.addEventListener('keydown', async e => {
        if(e.key === 'Enter') await addShot(shotIn.value);
      });
    }

    async function addStep(text){
      const v = String(text || '').trim();
      if(!v) return;
      t.subs = t.subs || [];
      const step = { t:v, done:false };
      const pick = el.querySelector('#newstepshot');
      if(t.page && pick && pick.value !== '') step.shot = +pick.value;
      t.subs.push(step);
      if(t.view === 'done') t.view = 'todo';
      await save(); render();
      const i = el.querySelector('#newstep');
      if(i) i.focus();
    }

    /* Per-task coverage: start from the global kit, then change it for this piece only. */
    function editKit(){
      const working = (t.kit ? t.kit : kit).map(k => ({ ...k }));

      const body = () => `
        <h2>Coverage for this task</h2>
        <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.55">
          Changes here apply to this task alone. Your default kit stays as it is.</p>
        <div class="group" style="margin:0 0 14px">
          ${working.map((k,i) => `<div class="row" style="cursor:default">
            <span class="lbl">${k.label}${k.hint ? `<small>${k.hint}</small>` : ''}</span>
            <span style="display:flex;align-items:center;gap:8px">
              <button class="mini" data-kt="-:${i}" ${k.target <= 1 ? 'disabled' : ''}>−</button>
              <b style="font-family:var(--display),sans-serif;font-weight:900;min-width:22px;text-align:center">${k.target}</b>
              <button class="mini" data-kt="+:${i}">+</button>
              <button class="mini" data-krm="${i}" style="color:var(--red)" aria-label="Remove">×</button>
            </span>
          </div>`).join('') || '<div class="empty" style="padding:24px 8px"><b>Nothing in the kit</b>Add a shot type below.</div>'}
        </div>
        <button class="btn-sm accent" data-klib style="width:100%;justify-content:center;height:46px">
          Pick from the shot library</button>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save for this task</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${t.kit ? `<button class="btn-ghost" data-reset style="width:100%;margin-top:10px">Back to the default kit</button>` : ''}`;

      App.sheet(body(), sheetEl => {
        const redraw = () => { sheetEl.innerHTML = body(); };
        sheetEl.addEventListener('click', async e => {
          const kt = e.target.closest('[data-kt]');
          if(kt){
            const [sign, i] = kt.dataset.kt.split(':');
            const k = working[+i];
            k.target = Math.max(1, k.target + (sign === '+' ? 1 : -1));
            return redraw();
          }
          const rm = e.target.closest('[data-krm]');
          if(rm){ working.splice(+rm.dataset.krm, 1); return redraw(); }

          if(e.target.closest('[data-klib]')){
            App.closeSheet();
            setTimeout(() => ShotLib.pick({
              title:'Coverage for this task',
              existing:working,
              onPick: async picked => {
                t.kit = picked;
                await save();
                kit = picked;
                render();
              }
            }), 260);
            return;
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-reset]')){
            delete t.kit;
            await save();
            kit = Coverage.kitFor(t, await Coverage.kit());
            App.closeSheet(); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          t.kit = working;
          await save();
          kit = working;
          App.closeSheet(); render();
        });
      });
    }

    function editStep(i){
      const s = t.subs[i];
      App.sheet(`
        <h2>Edit step</h2>
        <div class="field"><label for="sx">Step</label>
          <input id="sx" type="text" value="${(s.t||'').replace(/"/g,'&quot;')}"></div>
        <div class="field"><label for="sn">Note <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <input id="sn" type="text" value="${(s.note||'').replace(/"/g,'&quot;')}" placeholder="Tools needed, or how to frame it"></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        <button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete step</button>`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-delete]')){
            if(t.slotKey){
              const base = t.slotKey.startsWith('post|') ? t.slotKey.slice(5) : t.slotKey;
              if(!base.startsWith('shoot|')){
                await Pipeline.removeSlot(base);
                App.closeSheet();
                U.toast('Piece and its tasks removed');
                params && params.onChange && params.onChange();
                return Screens.pop();
              }
            }
            t.subs.splice(i,1); await save(); App.closeSheet(); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          const v = sheetEl.querySelector('#sx').value.trim();
          if(!v) return U.toast('Say what the step is');
          s.t = v; s.note = sheetEl.querySelector('#sn').value.trim();
          const sp = sheetEl.querySelector('#sshot');
          if(sp){ if(sp.value === '') delete s.shot; else s.shot = +sp.value; }
          await save(); App.closeSheet(); render();
        });
        setTimeout(() => { const f = sheetEl.querySelector('#sx'); if(f) f.focus(); }, 180);
      });
    }

    async function addShot(text){
      const v = String(text || '').trim();
      if(!v) return;
      t.shots = t.shots || [];
      t.shots.push({ id:'sh_' + Date.now().toString(36), text:v, note:'',
                     angles: Coverage.DEFAULT_PLAN.map(type => ({ type, done:false })) });
      await save(); render();
      const i = el.querySelector('#newshot');
      if(i) i.focus();
    }

    function editShot(i){
      const sh = t.shots[i];
      App.sheet(`
        <h2>Edit shot</h2>
        <div class="field"><label for="sh-t">The shot</label>
          <input id="sh-t" type="text" value="${(sh.text||'').replace(/"/g,'&quot;')}"></div>
        <div class="field"><label for="sh-n">Note <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <input id="sh-n" type="text" value="${(sh.note||'').replace(/"/g,'&quot;')}" placeholder="Wait for the light"></div>
        <div class="field"><label>Planned angles</label>
          <div class="angles">${(sh.angles || []).length
            ? sh.angles.map(a => `<span class="ang${a.done ? ' got' : ''}">${a.done ? '✓ ' : ''}${typeLabel(a.type)}</span>`).join('')
            : '<span style="color:var(--muted);font-size:14px">None planned yet</span>'}</div>
          <button class="btn-sm" data-planstrip style="width:100%;margin-top:12px;justify-content:center">Plan the angles</button>
        </div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        <button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete shot</button>`,
      sheetEl => {
        sheetEl.addEventListener('click', async ev => {
          const opt = ev.target.closest('.opt');
          if(opt){
            const was = opt.getAttribute('aria-pressed') === 'true';
            sheetEl.querySelectorAll('[data-group="ty"] .opt').forEach(o => o.setAttribute('aria-pressed','false'));
            opt.setAttribute('aria-pressed', String(!was));
            return;
          }
          if(ev.target.closest('[data-planstrip]')){
            App.closeSheet();
            planning = i;
            setTimeout(render, 240);
            return;
          }
          if(ev.target.closest('[data-cancel]')) return App.closeSheet();
          if(ev.target.closest('[data-delete]')){
            t.shots.splice(i,1); await save(); App.closeSheet(); return render();
          }
          if(!ev.target.closest('[data-save]')) return;
          const v = sheetEl.querySelector('#sh-t').value.trim();
          if(!v) return U.toast('Describe the shot');
          sh.text = v;
          sh.note = sheetEl.querySelector('#sh-n').value.trim();
          await save(); App.closeSheet(); render();
        });
        setTimeout(() => { const f = sheetEl.querySelector('#sh-t'); if(f) f.focus(); }, 180);
      });
    }

    /* What this repeat currently runs at, counted from its own tasks rather than
       the stored label, which was written once when the series was created. */
    function seriesFreq(task){
      const run = allTasks.filter(x => x.series === task.series);
      if(!run.length) return task.cad || 'Repeating';
      const first = Math.min(...run.map(x => x.day));
      const wk = Math.floor((task.day - first) / 7);
      const n = run.filter(x => Math.floor((x.day - first) / 7) === wk).length;
      return Program.freqLabel(n);
    }

    /* The weekdays this repeat currently lands on. */
    function seriesDays(task, dowOf){
      const run = allTasks.filter(x => x.series === task.series);
      return [...new Set(run.map(x => dowOf(x.day)))].sort((a,b) => a - b);
    }

    async function editFrequency(task){
      const all = await Data.tasks();
      allTasks = all;

      let dowOf = d => ((d - 1) % 7 + 7) % 7;
      try {
        const base = new Date(await Data.dayToDate(task.day)).getDay();
        dowOf = d => ((base + (d - task.day)) % 7 + 7) % 7;
      } catch(err){ /* keep the fallback */ }

      const run = all.filter(x => x.series === task.series);
      const lastDay = Math.max(...run.map(x => x.day));
      let days = seriesDays(task, dowOf);

      const NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];
      const order = [1,2,3,4,5,6,0];

      App.sheet(`
        <h2>How often?</h2>
        <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.6">
          Changing this rewrites the days from here to the end of the run.
          Anything already done or skipped stays exactly where it is.</p>
        <div class="field"><label>Repeat on</label>
          <div class="opts" data-group="dow">${order.map(n =>
            `<button type="button" class="opt" data-dow="${n}"
              aria-pressed="${days.includes(n)}">${NAMES[n]}</button>`).join('')}</div>
          <p class="hintline" id="rf-n"></p>
        </div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheet => {

        const line = () => sheet.querySelector('#rf-n').textContent =
          days.length ? Program.freqLabel(days.length) + ' from here on' : 'Pick at least one day.';
        line();

        sheet.addEventListener('click', async ev => {
          const b = ev.target.closest('[data-dow]');
          if(b){
            const n = +b.dataset.dow;
            days = days.includes(n) ? days.filter(x => x !== n) : days.concat(n);
            b.setAttribute('aria-pressed', String(days.includes(n)));
            return line();
          }
          if(ev.target.closest('[data-cancel]')) return App.closeSheet();
          if(!ev.target.closest('[data-save]')) return;
          if(!days.length) return line();

          const weeks = Math.max(1, Math.ceil((lastDay - task.day + 1) / 7));
          const shape = { id:task.series, title:task.title, days:days.slice(), startDay:task.day,
                          weeks, freqRamp:{ mode:'none', everyWeeks:3, max:days.length },
                          amountRamp:{ mode:'none', everyWeeks:3, max:null },
                          amount:null, add:[], skip:[], ended:false };
          const plan = Program.diff(shape, all, task.day, { dowOf, key:'series' });

          for(const id of plan.remove) await Store.del('tasks', id);
          for(const u of plan.update){
            const x = all.find(y => y.id === u.id);
            if(!x) continue;
            x.cad = u.cad;
            await Store.put('tasks', x);
          }
          for(const c of plan.create){
            const copy = { ...task, id:U.taskId(), day:c.day, cad:c.cad, view:'todo',
                           subs:(task.subs || []).map(x => ({ ...x, done:false })) };
            await Store.put('tasks', copy);
          }
          Data.invalidate('tasks');
          allTasks = await Data.tasks();
          App.closeSheet();
          U.toast(Program.freqLabel(days.length) + ' from here on');
          render();
        });
      });
    }

    /* The note saves as you leave the field rather than on every keystroke —
       a task write also re-sorts Today and re-syncs reminders. */
    el.addEventListener('change', async e => {
      if(e.target.id !== 'tk-note') return;
      t.notes = e.target.value.trim();
      await save();
    });

    el.addEventListener('click', async e => {
      const rm = e.target.closest('[data-rmshot]');
      if(rm){
        e.stopPropagation();
        try { await Store.del('task-media', rm.dataset.rmshot); } catch(err){}
        await loadShots();
        return render();
      }

      if(e.target.closest('[data-a="addshot"]')){
        return App.pickImage(async file => {
          if(!file) return;
          /* next free slot, so removing one in the middle does not collide */
          let n = 0;
          try {
            const blobs = await Store.allMap('task-media');
            const mine = Object.keys(blobs)
              .filter(k => k.split(':')[0] === String(t.id))
              .map(k => +k.split(':')[1] || 0);
            n = mine.length ? Math.max(...mine) + 1 : 0;
          } catch(err){}
          await Store.put('task-media', file, t.id + ':' + n);
          await loadShots();
          render();
        });
      }

      if(e.target.closest('[data-a="refreq"]')) return editFrequency(t);
      if(e.target.closest('[data-a="openplan"]')){ Screens.pop(); return Screens.push('program', { onChange:() => render() }); }

      const es = e.target.closest('[data-endseries]');
      if(es){
        const key = es.dataset.endseries;
        const all = await Data.tasks();
        const future = all.filter(x => x.series === key && x.view === 'todo' && x.day >= t.day);
        App.sheet(`
          <h2>End the repeat?</h2>
          <p style="margin:0 0 18px;color:var(--muted);font-size:15px;line-height:1.6">
            ${future.length} upcoming one${future.length === 1 ? '' : 's'} would be removed,
            starting with this one. Anything already done stays on the record.</p>
          <div class="sheetcta">
            <button class="btn-primary" data-yes style="background:var(--red)">Remove them</button>
            <button class="btn-ghost" data-cancel>Keep them</button>
          </div>`, sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-yes]')) return;
            for(const x of future) await Store.del('tasks', x.id);
            Data.invalidate('tasks');
            App.closeSheet();
            U.toast(`${future.length} removed`);
            params && params.onChange && params.onChange();
            Screens.pop();
          });
        });
        return;
      }

      if(e.target.closest('[data-link-workout]')){
        const rs = await Routines.all();
        if(!rs.length) return U.toast('Save a workout first');
        App.sheet(`
          <h2>Link a workout</h2>
          <p style="margin:0 0 14px;color:var(--muted);font-size:14.5px;line-height:1.55">
            The task will start it, and its lifts become the steps.</p>
          <div class="group" style="margin:0 0 14px;max-height:44vh;overflow-y:auto">
            ${rs.map(r => `<button class="row" data-pickrt="${r.id}">
              <span class="lbl">${r.name}<small>${r.type ? r.type + ' · ' : ''}${
                r.items.length} lifts · about ${Routines.estimateMinutes(r)} min</small></span>
            </button>`).join('')}
          </div>
          <div class="sheetcta"><button class="btn-ghost" data-cancel>Cancel</button></div>`,
        sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            const p2 = ev.target.closest('[data-pickrt]');
            if(!p2) return;
            const r = rs.find(x => x.id === p2.dataset.pickrt);
            t.kind = 'workout';
            t.routineId = r.id;
            t.mins = t.mins || Routines.estimateMinutes(r);
            if(!(t.subs || []).length){
              t.subs = r.items.map(i => ({ t:`${i.name} · ${i.sets}×${i.reps}`, done:false }));
            }
            await save();
            App.closeSheet();
            U.toast(`${r.name} linked`);
            render();
          });
        });
        return;
      }

      const sw = e.target.closest('[data-start-workout]');
      if(sw){
        const r = await Routines.get(sw.dataset.startWorkout);
        if(!r) return U.toast('That workout has been deleted');
        const preset = await Routines.toSession(r);
        await Routines.markRun(r.id);
        return Screens.push('session', { preset, onChange: () => { load().then(render); } });
      }
      const pc = e.target.closest('[data-plan-clip]');
      if(pc) return Screens.push('clip', { id: pc.dataset.planClip,
        /* open the clip on the tab for the job this task is */
        tab: { shoot:'shoot', edit:'edit', publish:'post' }[t.kind] });
      /* the page in the task works as in the page editor; only a shot's own box ticks it */
      const sp = e.target.closest('[data-starpick]');
      if(sp) return starPick(+sp.dataset.starpick);
      const th = e.target.closest('[data-shootat]');
      if(th) return openShoot(+th.dataset.shootat);
      const pc2 = e.target.closest('[data-pagecanvas]');
      if(pc2 && t.page) return pageTap(e, pc2);
      const pg = e.target.closest('[data-pg]');
      if(pg && !pg.disabled) return goPage(+pg.dataset.pg);
      const tk = e.target.closest('[data-tick]');
      if(tk) return setShotDone(+tk.dataset.tick, !shotDone(curPage(), +tk.dataset.tick));
      const pmv = e.target.closest('[data-psmv]');
      if(pmv){ const [dir, n] = pmv.dataset.psmv.split(':'); return shotMove(+n, dir === 'up' ? +n - 1 : +n + 1); }
      const pdel = e.target.closest('[data-psdel]');
      if(pdel) return shotRemove(+pdel.dataset.psdel);
      const fd = e.target.closest('[data-fold] > h4');
      if(fd && fd.parentElement.dataset.fold === 'steps' && t.page){ setRowsFolded(rowsKey(), !rowsShut()); return render(); }
      const tw = e.target.closest('[data-twirl]');
      if(tw){ const k = pgIdx + ':' + tw.dataset.twirl; linesOpen.has(k) ? linesOpen.delete(k) : linesOpen.add(k); return render(); }
      const tla = e.target.closest('[data-tladd]');
      if(tla){
        const i = +tla.dataset.tladd, h = linesHolder(i);
        if(!h) return;
        h.lines = (h.lines || []).concat({ k:'vo', t:'' });
        linesOpen.add(pgIdx + ':' + i);
        await save(); render();
        const f = el.querySelector(`[data-tlt="${i}:${h.lines.length - 1}"]`); if(f) f.focus();
        return;
      }
      const tlk = e.target.closest('[data-tlk]');
      if(tlk){
        const [i, j] = tlk.dataset.tlk.split(':').map(Number), h = linesHolder(i);
        if(!h || !h.lines || !h.lines[j]) return;
        const k = LNEXT[h.lines[j].k] || 'cam';
        h.lines[j].k = k; tlk.className = 'tk-lk ' + k; tlk.textContent = LSHORT[k];
        return save();
      }
      const tlr = e.target.closest('[data-tlrm]');
      if(tlr){
        const [i, j] = tlr.dataset.tlrm.split(':').map(Number), h = linesHolder(i);
        if(!h || !h.lines) return;
        h.lines.splice(j, 1);
        if(!h.lines.length) delete h.lines;
        await save(); return render();
      }
      if(fd){
        const k = fd.parentElement.dataset.fold;
        fold[k] = !fold[k];
        fd.parentElement.classList.toggle('open', fold[k]);
        return;
      }
      const sdel = e.target.closest('[data-shotdel]');
      if(sdel){
        const i = +sdel.dataset.shotdel;
        const gone = t.shots[i];
        t.shots.splice(i, 1);
        if(planning === i) planning = null;
        await save();
        U.toast(stepNo(gone) ? 'Removed — the step is still there' : 'Shot removed');
        return render();
      }

      const smv = e.target.closest('[data-shotmv]');
      if(smv){
        const [dir, idx] = smv.dataset.shotmv.split(':');
        const i = +idx, j = dir === 'up' ? i-1 : i+1;
        if(j < 0 || j >= t.shots.length) return;
        [t.shots[i], t.shots[j]] = [t.shots[j], t.shots[i]];
        if(planning === i) planning = j; else if(planning === j) planning = i;
        await save(); return render();
      }

      const ang = e.target.closest('[data-ang]');
      if(ang){
        const [si, ai] = ang.dataset.ang.split(':').map(Number);
        const a = t.shots[si].angles[ai];
        a.done = !a.done;
        /* stamp when it was actually shot — the edit wants a timecode, not a tick */
        if(a.done) a.doneAt = Date.now(); else delete a.doneAt;
        await save(); return render();
      }
      /* references linked to a shot */
      const rd = e.target.closest('[data-refdel]');
      if(rd){
        e.stopPropagation();
        const [si, ri] = rd.dataset.refdel.split(':').map(Number);
        (t.shots[si].refs || []).splice(ri, 1);
        await save(); return render();
      }
      const ro = e.target.closest('[data-refopen]');
      if(ro){
        e.stopPropagation();
        const [si, ri] = ro.dataset.refopen.split(':').map(Number);
        return Refs.view(t.shots[si].refs || [], ri);
      }
      const rl = e.target.closest('[data-reflink]');
      if(rl){
        e.stopPropagation();
        const si = +rl.dataset.reflink;
        return Refs.pick(t.shots[si].refs || [], async ids => {
          t.shots[si].refs = ids;
          await loadRefThumbs(t);
          await save();
          render();
        });
      }

      const pl = e.target.closest('[data-plan]');
      if(pl){
        const i = +pl.dataset.plan;
        planning = planning === i ? null : i;
        angQ = '';
        return render();
      }
      if(e.target.closest('[data-angclear]')){ angQ = ''; return render(); }

      const tg = e.target.closest('[data-toggleang]');
      if(tg){
        const sh = t.shots[planning];
        if(!sh) return;
        const type = tg.dataset.toggleang;
        sh.angles = sh.angles || [];
        const has = sh.angles.some(a => a.type === type);
        sh.angles = has
          ? sh.angles.filter(a => a.type !== type)          /* planned twice? both go */
          : [...sh.angles, { type, done:false }];
        await save(); return render();
      }
      const se = e.target.closest('[data-shotedit]');
      if(se) return editShot(+se.dataset.shotedit);

      const ts = e.target.closest('[data-tostep]');
      if(ts){
        const step = t.subs[+ts.dataset.tostep];
        t.shots = t.shots || [];
        const at = t.shots.findIndex(sh => norm(sh.text) === norm(step.t));
        if(at !== -1){
          const had = Coverage.shotGot(t.shots[at]);
          if(had) return U.toast('That shot has angles captured — remove it from the shot list');
          t.shots.splice(at, 1);
          if(planning === at) planning = null;
          await save();
          U.toast('Taken off the shot list');
          return render();
        }
        t.shots.push({ id:'sh_' + Date.now().toString(36), text:step.t, note:'',
                       angles: Coverage.DEFAULT_PLAN.map(type => ({ type, done:false })) });
        await save();
        U.toast('Added with its default angles');
        return render();
      }

      const st = e.target.closest('[data-step]');
      if(st && !e.target.closest('.mini')){
        const s = t.subs[+st.dataset.step];
        s.done = !s.done;
        if(t.subs.every(x => x.done)) t.view = 'done';
        else if(t.view === 'done') t.view = 'todo';
        await save(); return render();
      }
      const mv = e.target.closest('[data-mv]');
      if(mv){
        const [dir, idx] = mv.dataset.mv.split(':');
        const i = +idx, j = dir === 'up' ? i-1 : i+1;
        if(j < 0 || j >= t.subs.length) return;
        [t.subs[i], t.subs[j]] = [t.subs[j], t.subs[i]];
        await save(); return render();
      }
      const ed = e.target.closest('[data-edit]');
      if(ed) return editStep(+ed.dataset.edit);

      const a = e.target.closest('[data-a]');
      if(!a) return;

      if(a.dataset.a === 'editkit') return editKit();
      if(a.dataset.a === 'shootmode') return openShoot(null);
      if(a.dataset.a === 'shootnext') return openShoot(nextOn(curPage()));
      if(a.dataset.a === 'openpage') return Screens.push('task-page', { id:t.id, host:H, onChange: async () => { await load(); render(); } });
      if(a.dataset.a === 'addpage') return Screens.push('task-page', { id:t.id, host:H, addPage:true, onChange: async () => { await load(); render(); } });
      if(a.dataset.a === 'psadd') return shotAdd();
      if(a.dataset.a === 'rowsfold'){ setRowsFolded(rowsKey(), !rowsShut()); return render(); }
      if(a.dataset.a === 'unmore'){
        const P = curPage();
        if(onMain() || !P) return;
        App.sheet(`<h2>Remove this page?</h2>
          <p style="margin:0 0 18px;color:var(--muted);font-size:15px;line-height:1.6">“${esc(P.name || 'Page')}” goes from this task. The shot page and the steps stay.</p>
          <div class="sheetcta">
            <button class="btn-primary" data-yes style="background:var(--red)">Remove it</button>
            <button class="btn-ghost" data-cancel>Keep it</button>
          </div>`, sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-yes]')) return;
            t.morePages = morePages().filter(x => x !== P);
            if(!t.morePages.length) delete t.morePages;
            pgIdx = Math.max(0, pgIdx - 1); pageMediaKey = '';
            await save(); App.closeSheet(); render();
          });
        });
        return;
      }
      if(a.dataset.a === 'hidedone'){ t.hideDone = t.hideDone === false; await save(); return render(); }
      if(a.dataset.a === 'unpage'){
        App.sheet(`<h2>Remove the shot page?</h2>
          <p style="margin:0 0 18px;color:var(--muted);font-size:15px;line-height:1.6">
            The steps stay, ticks and all. Only the page and which shot each step stands for go.${
            morePages().length ? ` The ${morePages().length === 1 ? 'other page stays' : morePages().length + ' other pages stay'} with the task.` : ''}</p>
          <div class="sheetcta">
            <button class="btn-primary" data-yes style="background:var(--red)">Remove it</button>
            <button class="btn-ghost" data-cancel>Keep it</button>
          </div>`, sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-yes]')) return;
            delete t.page; delete t.pageFrom;
            t.pageOff = true;   /* removed on purpose: the default doesn't come back */
            (t.subs || []).forEach(s2 => { delete s2.shot; });
            await save(); App.closeSheet(); render();
          });
        });
        return;
      }
      if(a.dataset.a === 'addstep') return addStep(el.querySelector('#newstep').value);
      if(a.dataset.a === 'addshot') return addShot(el.querySelector('#newshot').value);
      if(a.dataset.a === 'sortshots'){
        /* step-linked shots first, in step order; everything else keeps its place after */
        const withNo = t.shots.map((sh,i) => ({ sh, n:stepNo(sh), i }));
        withNo.sort((x,y) => {
          if(x.n && y.n) return x.n - y.n;
          if(x.n) return -1;
          if(y.n) return 1;
          return x.i - y.i;
        });
        t.shots = withNo.map(x => x.sh);
        planning = null;
        await save(); return render();
      }
      if(a.dataset.a === 'allshots'){
        t.shots = t.shots || [];
        let n = 0;
        (t.subs || []).forEach(step => {
          if(hasShot(step.t)) return;
          t.shots.push({ id:'sh_' + Date.now().toString(36) + n, text:step.t, note:'', fromStep:true,
                         angles: Coverage.DEFAULT_PLAN.map(type => ({ type, done:false })) });
          n++;
        });
        await save();
        U.toast(n ? `Added ${n} shot${n===1?'':'s'}` : 'All steps were already there');
        return render();
      }
      if((a.dataset.a === 'allon' || a.dataset.a === 'alloff') && t.page && !onMain()){
        (curPage().slots || []).forEach(sl => { sl.done = a.dataset.a === 'allon'; });
        await save(); return render();
      }
      if(a.dataset.a === 'allon'){ t.subs.forEach(s => s.done = true); t.view = 'done'; await save(); return render(); }
      if(a.dataset.a === 'alloff'){ t.subs.forEach(s => s.done = false); t.view = 'todo'; await save(); return render(); }
      if(a.dataset.a === 'toggle'){
        const nowDone = t.view !== 'done';
        t.view = nowDone ? 'done' : 'todo';
        (t.subs || []).forEach(s => s.done = nowDone);
        await save(); return render();
      }
      if(a.dataset.a === 'swipe') return Screens.push('swipe', { id:t.swipeId });

      if(a.dataset.a === 'rename'){
        App.sheet(`<h2>Rename task</h2>
          <div class="field"><label for="tt">Title</label>
            <input id="tt" type="text" value="${t.title.replace(/"/g,'&quot;')}"></div>
          <div class="sheetcta"><button class="btn-primary" data-save>Save</button>
            <button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-save]')) return;
            const v = sheetEl.querySelector('#tt').value.trim();
            if(!v) return U.toast('Give it a title');
            t.title = v; await save(); App.closeSheet(); render();
          });
        });
        return;
      }

      if(a.dataset.a === 'when'){
        const field = await U.dayField('td', t.day);
        App.sheet(`<h2>When</h2>
          ${field}
          <div class="field"><label for="tm">Time <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
            <input id="tm" type="time" value="${t.at || ''}"></div>
          <div class="sheetcta"><button class="btn-primary" data-save>Save</button>
            <button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
          U.wireDayField(sheetEl, 'td');
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-save]')) return;
            const n = await U.readDayField(sheetEl, 'td');
            if(n) t.day = n;
            t.at = sheetEl.querySelector('#tm').value || null;
            await save(); App.closeSheet(); render();
          });
        });
        return;
      }

      if(a.dataset.a === 'cad' || a.dataset.a === 'pri'){
        const isCad = a.dataset.a === 'cad';
        const opts = isCad ? CADENCES.map(c => [c,c]) : PRI;
        App.sheet(`<h2>${isCad ? 'Cadence' : 'Priority'}</h2>
          <div class="group compact" style="margin:0">
            ${opts.map(([v,n]) => `<button class="row" data-v="${v}">
              <span class="lbl">${n}</span>
              ${(isCad ? t.cad : t.pri) === v ? `<span style="color:var(--orange)">${ICON.check}</span>` : ''}
            </button>`).join('')}
          </div>
          <div class="sheetcta"><button class="btn-ghost" data-cancel style="flex:1">Cancel</button></div>`,
        sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            const b = ev.target.closest('[data-v]');
            if(!b) return;
            if(isCad) t.cad = b.dataset.v; else t.pri = b.dataset.v;
            await save(); App.closeSheet(); render();
          });
        });
        return;
      }

      if(a.dataset.a === 'delete'){
        await Store.del('tasks', t.id);
        Data.invalidate('tasks');
        params.onChange && params.onChange();
        Screens.pop();
      }
    });

    await load();
    /* a task with no shot page gets the task sequence straight away, unless
       its page was removed on purpose (a host decides its own start) */
    if(!H && t && window.TaskPages && await TaskPages.attachDefault(t)) await save();
    if(!H) await loadShots();
    SwipeRefs.wire(el, {
      getOwn: () => ownRefs().concat(clipRefs(), planRefs()),
      add: async sid => {
        t.swipeIds = (t.swipeIds || []).concat(sid);
        refsOpen = true;
        await save(); render();
        U.toast('Swipe linked');
      },
      remove: async sid => {
        t.swipeIds = (t.swipeIds || []).filter(x => x !== sid);
        if(t.swipeId === sid) t.swipeId = null;
        await save(); render();
      },
      onOpenChange: () => render()
    });
    render();
  }

  Screens.register('task', mount);

  /* The task's own shot page, open big in the notebook editor: drop Library
     frames into its spots, type over its words, tick its shots. Ticks made
     here carry back to the steps that stand for those shots. */
  Screens.register('task-page', async (el, params) => {
    /* v4: a host (shotlist.js) stands in for the tasks store */
    const H = params.host || null;
    const getT = async () => H ? await H.load() : await Store.get('tasks', +params.id);
    const putT = async x => { if(H) await H.save(x); else { await Store.put('tasks', x); Data.invalidate('tasks'); } };
    const t = await getT();
    const extra = t && Array.isArray(t.morePages) ? t.morePages : [];
    if(!t || (!t.page && !extra.length && !params.addPage)){
      el.innerHTML = Screens.bar({ title:'Shot page' }) + '<div class="view"><div class="empty"><b>Gone</b>This task has no shot page any more.</div></div>';
      return;
    }
    /* every page the task holds: the shot page first (its ticks drive the
       steps), then the pages kept beside it. Pages added here stay with the task. */
    const shotId = t.page ? t.page.id : null;
    const sheets = (t.page ? [t.page] : []).concat(extra);
    const title = sheets.length > 1 ? `${sheets.length} pages` : ((sheets[0] || {}).name || 'Shot page');
    el.innerHTML = Screens.bar({ kicker:t.title, title }) + '<div class="view tp-root"><div id="tkpHost"></div></div>';
    const host = el.querySelector('#tkpHost');
    PagesEditor.mount(host, { sheets, tasks:[t.title], noTarget:true, lockId:shotId, lockNote:'The shot page — its ticks are the task’s steps. Remove it from the task’s Steps.', save: async () => {
      const fresh = await getT();
      if(!fresh) return;
      const before = fresh.page ? fresh.page.slots.map(sl => !!sl.done) : [];
      fresh.morePages = sheets.filter(s => s.id !== shotId);
      if(!fresh.morePages.length) delete fresh.morePages;
      const sp = shotId && sheets.find(s => s.id === shotId);
      if(!sp){ await putT(fresh); params.onChange && params.onChange(); return; }
      fresh.page = sp;
      /* a box ticked on the page ticks the steps for that shot */
      fresh.page.slots.forEach((sl, i) => {
        if(!!sl.done === before[i]) return;
        const mine = (fresh.subs || []).filter(s2 => s2.shot === i);
        if(!mine.length && sl.done){ fresh.subs = fresh.subs || []; fresh.subs.push({ t:sl.text || `Shot ${i + 1}`, done:true, shot:i }); }
        mine.forEach(s2 => { s2.done = !!sl.done; });
      });
      if((fresh.subs || []).length){
        if(fresh.subs.every(x => x.done)) fresh.view = 'done';
        else if(fresh.view === 'done') fresh.view = 'todo';
      }
      await putT(fresh);
      params.onChange && params.onChange();
    } });
    /* came from "Add another page": open the page designs straight away */
    if(params.addPage){
      const openAdd = n => { const m = host.querySelector('details.lv-menu'); if(m) m.open = true; else if(n) setTimeout(() => openAdd(n - 1), 60); };
      openAdd(40);
    }
  });
})();
