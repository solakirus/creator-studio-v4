/* Library — Shotline's Shot Library inside Creator Studio.

   Deck      every GIF, clip and still: filter, search, boards, tick to select,
             ＋ adds a frame to the template or page chosen in Templates
   Boards    named groups of frames (Activity, Location, Mood, Subject, Other)
   Folders   which libraries and pages show in the Deck; on the laptop, the
             folders on disk it reads (Shot Library and any you add)
   Add       add files from this device, a direct link, or (laptop) grab
             pages and videos with Shot Library's grabber */
(function(){
  const { esc, plural, tile, hydrate } = LibView;

  let tab = 'deck';
  let kind = 'all', q = '', src = 'all', selecting = false, sel = new Set();
  let sort = '', limit = 1500, lastTick = null, deckKeys = null;   /* v4: big-library tools */

  async function mount(el, params){
    const embedded = !!(params && params.embedded);
    if(params && params.tab) tab = params.tab;
    if(params && params.src){ src = params.src; tab = 'deck'; }

    el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Content', title:'Library' })) +
      '<div class="view lv-root" id="libHost"></div>';
    const host = el.querySelector('#libHost');
    const grabOff = [];

    async function render(){
      const s = await MediaLib.settings();
      const lib = await MediaLib.load();
      const t = await MediaLib.target();
      host.innerHTML = `
        <div class="pagehead"><h1 class="page-title">Library</h1><span class="count">${lib.items.length}</span>
          <div class="headacts"><button class="headbtn" data-go="add">＋ ADD</button></div></div>
        <div class="segrow lv-tabs" role="tablist">
          ${[['deck','Deck'],['starred','★ Starred'],['boards','Boards'],['folders','Folders'],['add','Add & grab']].map(([k, l]) =>
            `<button class="seg" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}
        </div>
        ${t ? `<div class="lv-target"><span>＋ adds to <b>${esc(t.label || 'a template')}</b></span>
          <button class="lv-btn ghost sm" data-untarget>Stop</button></div>` : ''}
        ${tab !== 'folders' && (lib.fallback || []).length ? `<p class="lv-warn" data-fallbackline>⚠ ${lib.fallback.length === 1 ? 'A folder' : lib.fallback.length + ' folders'} can’t be reached — showing the copy on this computer. <button class="lv-btn sm ghost" data-tab="folders">Folders</button></p>` : ''}
        <div data-grabstrip></div>
        <div id="libBody"></div>`;
      grabStrip();
      const body = host.querySelector('#libBody');
      if(tab === 'boards') return boardsPage(body, lib);
      if(tab === 'starred') return starredPage(body, lib);
      if(tab === 'folders') return foldersPage(body, lib, s);
      if(tab === 'add') return addPage(body, lib, s);
      return deckPage(body, lib, s, t);
    }

    /* ---------------------------------------------------------- Deck */
    async function deckPage(body, lib, s, t){
      const boards = await MediaLib.allBoards();
      const stars = await MediaLib.allStars();
      const inStar = src.startsWith('star:') ? stars.find(g => g.id === src.slice(5)) : null;
      const count = k => lib.items.filter(it => k === 'all' || it.kind === k).length;
      const srcPage = src.startsWith('page:') ? lib.pageIdx.get(src.slice(5)) : null;
      /* v4: the second picker — one grabbed video or page at a time (LibView.pagePicker) */
      const pp = LibView.pagePicker(lib, src, s.hidden);
      const colNow = pp.colNow, usePgSel = pp.show;
      body.innerHTML = `
        <div class="lv-bar">
          ${['all','gif','video','image'].map(k => `<button class="pill" data-k="${k}" aria-pressed="${kind === k}">${
            k === 'all' ? 'All' : k === 'gif' ? 'GIFs' : k === 'video' ? 'Clips' : 'Stills'} <small>${count(k)}</small></button>`).join('')}
        </div>
        <div class="lv-bar">
          <select class="lv-sel" data-src>
            <option value="all">Everything</option>
            <option value="unused" ${src === 'unused' ? 'selected' : ''}>Unused — on no board, group, template or task</option>
            ${srcPage && !usePgSel ? `<option value="${esc(src)}" selected>${esc(MediaLib.pageLabel(srcPage))}</option>` : ''}
            ${stars.length ? `<optgroup label="Starred — on the phone too">${stars.map(g =>
              `<option value="star:${g.id}" ${src === 'star:' + g.id ? 'selected' : ''}>★ ${esc(g.name)} (${g.items.length})</option>`).join('')}</optgroup>` : ''}
            ${boards.length ? `<optgroup label="Boards">${boards.map(b =>
              `<option value="board:${b.id}" ${src === 'board:' + b.id ? 'selected' : ''}>◈ ${esc(b.name)} (${b.items.length})</option>`).join('')}</optgroup>` : ''}
            ${lib.collections.length ? `<optgroup label="Libraries">${lib.collections.map(c =>
              `<option value="col:${esc(c.key)}" ${src === 'col:' + c.key || (srcPage && usePgSel && colNow === c.key) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>` : ''}
          </select>
          <input class="lv-in" type="search" data-q placeholder="Search names, labels, pages…" value="${esc(q)}">
          <button class="pill" data-play aria-pressed="${s.play !== false}">▶ Play GIFs</button>
          <select class="lv-sel" data-sort aria-label="Sort">
            ${[['', 'Library order'], ['newest', 'Newest first'], ['oldest', 'Oldest first'], ['name', 'Name A→Z'], ['size', 'Biggest first'], ['kind', 'GIFs, clips, stills']].map(([v, l]) =>
              `<option value="${v}" ${sort === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <button class="pill" data-select aria-pressed="${selecting}">☐ Select</button>
        </div>
        <div class="lv-selbar" ${selecting ? '' : 'hidden'}>
          <b data-seln>${plural(sel.size, 'frame')}</b>
          <button class="lv-btn sm" data-sel="star">★ Star into…</button>
          ${inStar ? `<button class="lv-btn sm ghost" data-sel="unstar">Take out of ★ ${esc(inStar.name)}</button>` : ''}
          <button class="lv-btn sm" data-sel="board">◈ Add to board</button>
          ${t ? `<button class="lv-btn sm" data-sel="target">＋ Add to ${esc(t.label || 'template')}</button>` : ''}
          <button class="lv-btn sm ghost" data-sel="all">Select all shown</button>
          <button class="lv-btn sm ghost" data-sel="invert" title="Tick the ones you want to keep, then Invert and Delete">Invert</button>
          <button class="lv-btn sm ghost" data-sel="clear">Clear</button>
          <button class="lv-btn sm ghost danger" data-sel="delete">Delete</button>
        </div>
        ${pp.html}
        <div class="lv-grid lv-deck${selecting ? ' lv-selecting' : ''}" data-drop></div>
        <p class="hintline lv-foot">${selecting
          ? 'Drag across frames to tick (or untick) a whole run at once · Shift-click ticks everything between two · Delete key deletes the ticked ones · Esc clears.'
          : `Click a frame to see it big${t ? ', ＋ adds it to ' + esc(t.label) : ''}. Ctrl-click (⌘ on a Mac) starts ticking frames. Drop files here to add them.`}</p>`;
      const grid = body.querySelector('.lv-deck');

      async function draw(){
        const { lib: l, list, board } = await MediaLib.deck({ kind, q, src, sort });
        const shown = list.slice(0, limit);
        grid.innerHTML = shown.length ? shown.map(it =>
          tile(it, { check:selecting, sel:sel.has(it.uid), caption:true,
            extra: t && !selecting ? `<button class="lv-plus" data-plus="${esc(it.uid)}" title="Add to ${esc(t.label)}">＋</button>` : '' })
        ).join('') : `<div class="empty" style="grid-column:1/-1"><b>${l.items.length ? 'Nothing matches' : 'Your Library is empty'}</b>${
          l.items.length ? 'Try another filter or search.' : 'Add GIFs, clips and stills from this device, a link, or (on the laptop) a folder.'}
          ${l.items.length ? '' : '<br><button class="lv-btn" data-go="add" style="margin-top:14px">＋ Add to the Library</button>'}</div>`;
        if(list.length > shown.length) grid.insertAdjacentHTML('beforeend',
          `<p class="hintline" style="grid-column:1/-1">Showing ${shown.length} of ${list.length}.
            <button class="lv-btn sm" data-more>Show ${Math.min(1500, list.length - shown.length)} more</button>
            <button class="lv-btn sm ghost" data-moreall>Show all ${list.length}</button></p>`);
        grid.dataset.board = board ? board.id : '';
        hydrate(grid, l);
        grid._shown = shown.map(x => x.uid);
      }
      function selbar(){
        const bar = body.querySelector('.lv-selbar');
        /* shown the whole time you're ticking, so the frames never jump under a drag */
        bar.hidden = !selecting;
        body.querySelector('[data-seln]').textContent = sel.size ? plural(sel.size, 'frame') : 'Nothing ticked yet';
        bar.querySelectorAll('[data-sel]:not([data-sel="all"]):not([data-sel="invert"])').forEach(x => { x.disabled = !sel.size; });
      }

      body.addEventListener('click', async e => {
        const k = e.target.closest('[data-k]');
        if(k){ kind = k.dataset.k; body.querySelectorAll('[data-k]').forEach(x => x.setAttribute('aria-pressed', String(x === k))); return draw(); }
        if(e.target.closest('[data-play]')){ await MediaLib.setSettings({ play:!(s.play !== false) }); return render(); }
        if(e.target.closest('[data-select]')){ selecting = !selecting; sel.clear(); return render(); }
        const plus = e.target.closest('[data-plus]');
        if(plus){ e.stopPropagation(); return addToTarget([plus.dataset.plus]); }
        const a = e.target.closest('[data-sel]');
        if(a){
          const act = a.dataset.sel;
          if(act === 'clear'){ sel.clear(); grid.querySelectorAll('.is-sel').forEach(x => x.classList.remove('is-sel')); return selbar(); }
          if(act === 'all'){ (grid._shown || []).forEach(u => sel.add(u)); grid.querySelectorAll('.lv-tile').forEach(x => x.classList.add('is-sel')); return selbar(); }
          if(act === 'invert'){
            (grid._shown || []).forEach(u => sel.has(u) ? sel.delete(u) : sel.add(u));
            grid.querySelectorAll('.lv-tile[data-uid]').forEach(x => x.classList.toggle('is-sel', sel.has(x.dataset.uid)));
            return selbar();
          }
          if(act === 'board') return LibView.boardMenu([...sel], () => { sel.clear(); render(); });
          if(act === 'star') return LibView.starMenu([...sel], () => { sel.clear(); render(); });
          if(act === 'unstar' && inStar){ const n = await MediaLib.unstar(inStar.id, [...sel]); sel.clear(); U.toast(`Took ${plural(n, 'frame')} out — they leave the phone`); return render(); }
          if(act === 'target'){ await addToTarget([...sel]); sel.clear(); return render(); }
          if(act === 'delete') return confirmDelete([...sel]);
        }
        if(e.target.closest('[data-more]')){ limit += 1500; return draw(); }
        if(e.target.closest('[data-moreall]')){ limit = 1e9; return draw(); }
        const tl = e.target.closest('.lv-tile[data-uid]');
        if(!tl) return;
        if(dragged){ dragged = false; return; }            /* the end of a drag, not a click */
        /* Ctrl/⌘-click starts ticking, with this one ticked */
        if(!selecting && (e.ctrlKey || e.metaKey)){ selecting = true; sel.clear(); sel.add(tl.dataset.uid); lastTick = tl.dataset.uid; return render(); }
        if(selecting){
          const u = tl.dataset.uid;
          /* Shift-click ticks everything between this and the last one ticked */
          const order = grid._shown || [];
          if(e.shiftKey && lastTick && order.includes(lastTick)){
            const [a, b] = [order.indexOf(lastTick), order.indexOf(u)].sort((x, y) => x - y);
            order.slice(a, b + 1).forEach(x => sel.add(x));
            grid.querySelectorAll('.lv-tile[data-uid]').forEach(x => x.classList.toggle('is-sel', sel.has(x.dataset.uid)));
          } else {
            sel.has(u) ? sel.delete(u) : sel.add(u);
            tl.classList.toggle('is-sel', sel.has(u));
          }
          lastTick = u;
          return selbar();
        }
        const board = grid.dataset.board;
        LibView.view(tl.dataset.uid, {
          actions:(t ? `<button class="lv-btn" data-act="target">＋ Add to ${esc(t.label)}</button>` : '') +
                  (board ? `<button class="lv-btn ghost" data-act="unboard">Take off this board</button>` : '') +
                  `<button class="lv-btn ghost danger" data-act="delete">Delete</button>`,
          onAction: async (act, it) => {
            if(act === 'target') return addToTarget([it.uid]);
            if(act === 'delete') return confirmDelete([it.uid]);
            if(act === 'unboard'){
              const b = (await MediaLib.allBoards()).find(x => x.id === board);
              if(b){ await MediaLib.saveBoard({ ...b, items:b.items.filter(u => u !== it.uid) }); draw(); }
            }
          }
        });
      });
      body.addEventListener('contextmenu', e => {
        const tl = e.target.closest('.lv-tile[data-uid]');
        if(tl){ e.preventDefault(); if(!selecting) LibView.view(tl.dataset.uid); }
      });

      /* v4: drag to tick a whole run. Press on a frame and move: every frame
         from that one to the one under the pointer (in order, like reading)
         takes the first one's new state — ticked, or unticked if it was
         ticked. Near the top or bottom edge the page scrolls along. On a touch
         screen a sideways drag ticks; an up-and-down swipe still scrolls. */
      let dragged = false;
      if(selecting){
        let drag = null, scrollTimer = null;
        const scroller = (() => { let n = grid.parentElement; while(n && n !== document.body){ const cs = getComputedStyle(n);
          if(/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight) return n; n = n.parentElement; } return document.scrollingElement; })();
        const tileAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('.lv-deck .lv-tile[data-uid]') : null; };
        const paint = () => {
          const order = grid._shown || [];
          const a = order.indexOf(drag.from), b = order.indexOf(drag.to);
          if(a < 0 || b < 0) return;
          const [lo, hi] = a < b ? [a, b] : [b, a];
          sel.clear(); drag.before.forEach(u => sel.add(u));
          for(let i = lo; i <= hi; i++) drag.on ? sel.add(order[i]) : sel.delete(order[i]);
          grid.querySelectorAll('.lv-tile[data-uid]').forEach(x => x.classList.toggle('is-sel', sel.has(x.dataset.uid)));
          selbar();
        };
        const edgeScroll = () => {
          clearInterval(scrollTimer); scrollTimer = null;
          if(!drag || !scroller) return;
          const r = scroller === document.scrollingElement ? { top:0, bottom:innerHeight } : scroller.getBoundingClientRect();
          const dy = drag.y < r.top + 60 ? -18 : drag.y > r.bottom - 60 ? 18 : 0;
          if(!dy) return;
          scrollTimer = setInterval(() => {
            if(!drag){ clearInterval(scrollTimer); return; }
            scroller.scrollTop += dy;
            const t2 = tileAt(drag.x, drag.y);
            if(t2 && t2.dataset.uid !== drag.to){ drag.to = t2.dataset.uid; paint(); }
          }, 30);
        };
        grid.addEventListener('pointerdown', e => {
          if(e.button !== 0) return;
          const tl = e.target.closest('.lv-tile[data-uid]');
          if(!tl) return;
          drag = { from:tl.dataset.uid, to:tl.dataset.uid, on:!sel.has(tl.dataset.uid), before:new Set(sel), x:e.clientX, y:e.clientY, moved:false, id:e.pointerId };
        });
        grid.addEventListener('pointermove', e => {
          if(!drag || e.pointerId !== drag.id) return;
          drag.x = e.clientX; drag.y = e.clientY;
          const t2 = tileAt(e.clientX, e.clientY);
          if(!drag.moved){
            if(!t2 || t2.dataset.uid === drag.from) return;
            drag.moved = true;
            try { grid.setPointerCapture(e.pointerId); } catch(err){}
            grid.classList.add('lv-dragging');
          }
          e.preventDefault();
          if(t2 && t2.dataset.uid !== drag.to){ drag.to = t2.dataset.uid; paint(); }
          edgeScroll();
        });
        const end = e => {
          if(!drag || (e && e.pointerId !== drag.id)) return;
          if(drag.moved){ dragged = true; lastTick = drag.to; setTimeout(() => { dragged = false; }, 50); }
          drag = null; clearInterval(scrollTimer); scrollTimer = null;
          grid.classList.remove('lv-dragging');
        };
        grid.addEventListener('pointerup', end);
        grid.addEventListener('pointercancel', end);
      }

      /* keys while ticking: Delete deletes, Ctrl/⌘+A ticks all shown, Esc clears */
      if(deckKeys) document.removeEventListener('keydown', deckKeys);
      deckKeys = e => {
        if(!grid.isConnected){ document.removeEventListener('keydown', deckKeys); deckKeys = null; return; }
        if(/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '') || document.querySelector('#sheet.open')) return;
        if(!selecting) return;
        if((e.key === 'Delete' || e.key === 'Backspace') && sel.size){ e.preventDefault(); return confirmDelete([...sel]); }
        if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a'){ e.preventDefault(); body.querySelector('[data-sel="all"]').click(); }
        if(e.key === 'Escape' && sel.size){ e.preventDefault(); body.querySelector('[data-sel="clear"]').click(); }
      };
      document.addEventListener('keydown', deckKeys);
      /* a new source redraws the page: its selection bar changes with it (a starred group's "Take out of") */
      body.querySelector('[data-src]').addEventListener('change', e => { src = e.target.value; limit = 1500; sel.clear(); render(); });
      LibView.wireStrip(body, lib);
      body.addEventListener('click', e => {
        const c = e.target.closest('[data-pgcard]');
        if(!c) return;
        e.stopPropagation();
        src = c.dataset.pgcard || pp.back(); limit = 1500; sel.clear(); render();
      }, true);
      body.querySelector('[data-sort]').addEventListener('change', e => { sort = e.target.value; draw(); });
      let timer;
      body.querySelector('[data-q]').addEventListener('input', e => { clearTimeout(timer); timer = setTimeout(() => { q = e.target.value; draw(); }, 200); });
      wireDrop(grid);
      await draw();
      if(selecting) selbar();
    }

    async function addToTarget(uids){
      const t = await MediaLib.target();
      if(!t) return U.toast('Choose where ＋ adds to in Templates first');
      if(!global_tpl()) return U.toast('Templates are not available');
      const n = await ShotTemplates.addToTarget(t, uids);
      U.toast(n ? `Added ${plural(n, 'frame')} to ${t.label}` : 'Nothing added — the page has no empty spots');
    }
    const global_tpl = () => !!window.ShotTemplates;

    async function confirmDelete(uids){
      /* the iPad reads nastime's Shot Library without changing it: those are deleted from the laptop */
      if(MediaLib.remote()){
        const l = await MediaLib.load();
        const own = uids.filter(u => { const it = MediaLib.find(l, u); return it && it.src === 'db'; });
        if(!own.length) return U.toast('These live in the Shot Library on nastime — delete them from the laptop');
        uids = own;
      }
      const lib = MediaLib.disk() ? 'They’re moved into Shot Library/_Deleted when they live in a folder, so you can still get those back.' : 'They’re taken out of the app.';
      App.sheet(`<h2 style="margin:0 0 10px">Delete ${plural(uids.length, 'frame')}?</h2>
        <p class="hintline" style="margin:0 0 6px">${lib} Boards and templates that use them show an empty spot.</p>
        <div class="sheetcta"><button class="btn-primary" data-yes style="background:var(--red)">Delete</button>
        <button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
        sh.addEventListener('click', async e => {
          if(e.target.closest('[data-no]')) return App.closeSheet();
          if(!e.target.closest('[data-yes]')) return;
          const n = await MediaLib.remove(uids);
          App.closeSheet();
          sel.clear();
          U.toast(`Deleted ${plural(n, 'frame')}`);
          render();
        });
      });
    }

    function wireDrop(zone){
      zone.addEventListener('dragover', e => { if(e.dataTransfer && [...e.dataTransfer.types].includes('Files')){ e.preventDefault(); zone.classList.add('lv-dropping'); } });
      zone.addEventListener('dragleave', () => zone.classList.remove('lv-dropping'));
      zone.addEventListener('drop', async e => {
        e.preventDefault();
        zone.classList.remove('lv-dropping');
        const files = [...(e.dataTransfer.files || [])];
        if(files.length) await addPicked(files, '');
      });
    }

    async function addPicked(files, library){
      U.toast(`Adding ${plural(files.length, 'file')}…`);
      const r = await MediaLib.addFiles(files, library, null);
      U.toast(`Added ${plural(r.added.length, 'frame')}${r.refused.length ? ` · ${r.refused.length} weren’t GIFs, clips or pictures` : ''}`);
      tab = 'deck'; src = 'all';
      render();
      return r;
    }

    /* ---------------------------------------------------------- Boards */
    /* ---------------------------------------------------------- Starred
       the groups that live on the phone too; managing a big group happens in
       the Deck (Show in Deck → Select), where search and bulk tools are */
    async function starredPage(body, lib){
      const groups = await MediaLib.allStars();
      const all = [...new Set(groups.flatMap(g => g.items))];
      const bytes = all.reduce((n, u) => { const it = MediaLib.find(lib, u); return n + (it && it.bytes || 0); }, 0);
      const missing = all.filter(u => !MediaLib.find(lib, u)).length;
      body.innerHTML = `
        <div class="lv-card lv-starhead"><h3>★ Starred — on your phone too</h3>
          <p class="hintline" style="margin:0">${plural(all.length, 'frame')} in ${plural(groups.length, 'group')} · ${bytes < 1048576 ? 'under 1 MB' : 'about ' + (bytes / 1048576).toFixed(0) + ' MB'} on the phone${missing ? ` · ${missing} no longer in the Library` : ''}.
            Star frames in the Deck (☐ Select → ★ Star into…) or with ★ on a frame. They never expire on the phone; take them out here to free the space.</p></div>
        <div class="lv-bar"><button class="lv-btn" data-newstar>＋ New group</button></div>
        ${groups.length ? `<div class="lv-boards">${groups.map(g => `
          <article class="lv-board" data-star="${g.id}">
            <div class="lv-quad" data-starshow="${g.id}">${[0,1,2,3].map(k => g.items[k] && MediaLib.find(lib, g.items[k])
              ? tile(MediaLib.find(lib, g.items[k]), { badge:false }) : '<div class="lv-tile lv-blank"></div>').join('')}</div>
            <div class="lv-bname"><b>★ ${esc(g.name)}</b><small>${plural(g.items.length, 'frame')}</small></div>
            <div class="lv-bacts">
              <button class="lv-btn sm" data-starshow="${g.id}">Show in Deck</button>
              <button class="lv-btn sm ghost" data-starrename="${g.id}">Rename</button>
              <button class="lv-btn sm ghost danger" data-stardel="${g.id}">Delete</button>
            </div>
          </article>`).join('')}</div>`
          : `<div class="empty"><b>Nothing starred yet</b>Make groups for the shots you make all the time — Walking, Car work, Transitions — and star frames into them. Each group is on your phone, ready for any task.</div>`}`;
      hydrate(body, lib, { play:false });
      /* v4: starred GIFs this device's Library doesn't have — one button gets them all */
      if(window.FrameGet) FrameGet.bar(body, all, () => render());
      body.addEventListener('click', async e => {
        const nameSheet = (title, val, done) => App.sheet(`<h2 style="margin:0 0 14px">${title}</h2>
          <input id="sg-n" class="pgname" type="text" value="${esc(val || '')}" placeholder="e.g. Walking, Car work, Transitions" autocomplete="off">
          <div class="sheetcta"><button class="btn-primary" data-save>Save</button><button class="btn-ghost" data-cancel>Cancel</button></div>`, sh => {
            sh.addEventListener('click', async ev => {
              if(ev.target.closest('[data-cancel]')) return App.closeSheet();
              if(!ev.target.closest('[data-save]')) return;
              const n = sh.querySelector('#sg-n').value.trim();
              if(!n) return U.toast('Give the group a name');
              await done(n); App.closeSheet(); render();
            });
            setTimeout(() => { const f = sh.querySelector('#sg-n'); if(f) f.focus(); }, 180);
          });
        if(e.target.closest('[data-newstar]')) return nameSheet('New starred group', '', n => MediaLib.saveStar({ name:n, items:[] }));
        const sh = e.target.closest('[data-starshow]');
        if(sh){ src = 'star:' + sh.dataset.starshow; tab = 'deck'; selecting = false; sel.clear(); return render(); }
        const rn = e.target.closest('[data-starrename]');
        if(rn){ const g = groups.find(x => x.id === rn.dataset.starrename); return nameSheet('Rename group', g.name, n => MediaLib.saveStar({ ...g, name:n })); }
        const del = e.target.closest('[data-stardel]');
        if(del){
          const g = groups.find(x => x.id === del.dataset.stardel);
          App.sheet(`<h2 style="margin:0 0 10px">Delete ★ ${esc(g.name)}?</h2>
            <p class="hintline">Its ${plural(g.items.length, 'frame')} leave the phone (unless another group or a task still uses them). The Library keeps them.</p>
            <div class="sheetcta"><button class="btn-primary" data-yes style="background:var(--red)">Delete</button>
            <button class="btn-ghost" data-no>Cancel</button></div>`, s2 => s2.addEventListener('click', async ev => {
              if(ev.target.closest('[data-no]')) return App.closeSheet();
              if(!ev.target.closest('[data-yes]')) return;
              await MediaLib.deleteStar(g.id); App.closeSheet(); render();
            }));
        }
      });
    }

    async function boardsPage(body, lib){
      const boards = await MediaLib.allBoards();
      const groups = [...new Set([...MediaLib.BOARD_GROUPS, ...boards.map(b => b.group)])].filter(g => boards.some(b => b.group === g));
      body.innerHTML = `
        <div class="lv-bar"><button class="lv-btn" data-newboard>＋ New board</button>
          <span class="hintline" style="margin:0">A frame can sit on many boards; nothing is moved.</span></div>
        ${boards.length ? groups.map(g => `
          <div class="sec"><h2>${esc(g)}</h2><div class="rule"></div></div>
          <div class="lv-boards">${boards.filter(b => b.group === g).sort((a, b) => a.name.localeCompare(b.name)).map(b => `
            <article class="lv-board" data-board="${b.id}">
              <div class="lv-quad" data-show="${b.id}">${[0,1,2,3].map(k => b.items[k]
                ? tile(MediaLib.find(lib, b.items[k]), { badge:false }) : '<div class="lv-tile lv-blank"></div>').join('')}</div>
              <div class="lv-bname"><b>${esc(b.name)}</b><small>${plural(b.items.length, 'frame')}</small></div>
              <div class="lv-bacts">
                <button class="lv-btn sm" data-show="${b.id}">Show in Deck</button>
                <button class="lv-btn sm ghost" data-rename="${b.id}">Rename</button>
                ${MediaLib.disk() ? `<button class="lv-btn sm ghost" data-folder="${b.id}" title="Copies the files into Shot Library/_Boards/&lt;group&gt;/&lt;board&gt;">Make folder</button>` : ''}
                <button class="lv-btn sm ghost danger" data-delboard="${b.id}">Delete</button>
              </div>
            </article>`).join('')}</div>`).join('')
          : `<div class="empty"><b>No boards yet</b>Make boards like “Gym”, “Beach” or “Night city”, then tick frames in the Deck and choose Add to board.</div>`}`;
      hydrate(body, lib, { play:false });
      body.addEventListener('click', async e => {
        if(e.target.closest('[data-newboard]')) return LibView.boardDialog(null, [], () => render());
        const sh = e.target.closest('[data-show]');
        if(sh){ src = 'board:' + sh.dataset.show; tab = 'deck'; return render(); }
        const rn = e.target.closest('[data-rename]');
        if(rn) return LibView.boardDialog(boards.find(b => b.id === rn.dataset.rename), [], () => render());
        const fo = e.target.closest('[data-folder]');
        if(fo){
          const b = boards.find(x => x.id === fo.dataset.folder);
          const files = [];
          for(const u of b.items){
            const it = MediaLib.find(lib, u);
            if(!it) continue;
            if(it.src === 'h') files.push({ abs:decodeURIComponent(it.url.replace('cs3lib://f/', '')), name:it.name });
            else { const bl = await MediaLib.blobOf(it); if(bl) files.push({ b64:await Saver.blobToBase64(bl), name:it.name }); }
          }
          if(!files.length) return U.toast('Nothing on this board can be copied yet');
          const r = await MediaLib.disk().boardFolder({ group:b.group, name:b.name, files });
          return U.toast(`Copied ${plural(r.n, 'file')} into _Boards/${b.group}/${b.name}`);
        }
        const del = e.target.closest('[data-delboard]');
        if(del){
          const b = boards.find(x => x.id === del.dataset.delboard);
          App.sheet(`<h2 style="margin:0 0 10px">Delete “${esc(b.name)}”?</h2>
            <p class="hintline">The frames stay in your library.</p>
            <div class="sheetcta"><button class="btn-primary" data-yes style="background:var(--red)">Delete</button>
            <button class="btn-ghost" data-no>Cancel</button></div>`, s2 => s2.addEventListener('click', async ev => {
              if(ev.target.closest('[data-no]')) return App.closeSheet();
              if(!ev.target.closest('[data-yes]')) return;
              await MediaLib.deleteBoard(b.id);
              if(src === 'board:' + b.id) src = 'all';
              App.closeSheet(); render();
            }));
        }
      });
    }

    /* ---------------------------------------------------------- Folders */
    async function foldersPage(body, lib, s){
      const d = MediaLib.disk();
      const homeInfo = d ? await d.home() : null;
      const hidden = new Set(s.hidden || []);
      const canCopy = !!(d && typeof d.mirror === 'function');
      const ago = t => { if(!t) return ''; const m = Math.round((Date.now() - t) / 60000);
        return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
      const mb = b => b >= 1048576 ? (b / 1048576).toFixed(b >= 104857600 ? 0 : 1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
      /* live progress: the laptop side reports every 50 files (cs3:lib-mirror-step) */
      if(d && typeof d.onMirror === 'function' && !foldersPage._mirrorOn){
        foldersPage._mirrorOn = true;
        d.onMirror((st, done) => {
          if(done || !st || !st.from) return;
          document.querySelectorAll('[data-copyrow]').forEach(row => {
            if(row.dataset.copyrow !== st.from) return;
            const x = row.querySelector('[data-copystate]');
            if(x) x.textContent = `copying… ${st.copied} copied${st.same ? ` · ${st.same} already there` : ''}${st.failed ? ` · ${st.failed} failed` : ''}`;
          });
        });
      }
      function copyRow(root){
        if(!canCopy || !root) return '';
        const to = (s.mirrors || {})[root];
        if(!to) return `<div class="lv-row lv-copy"><span>⧉</span><small>No copy yet</small>
          <button class="lv-btn sm ghost" data-copyset="${esc(root)}">Keep a copy…</button></div>`;
        const c = (s.copied || {})[root] || {};
        const state = c.problem ? `<span style="color:var(--red)">${esc(c.problem)}</span>${c.at ? ' · last copied ' + ago(c.at) : ''}`
          : c.at ? `last copied ${ago(c.at)}${c.copied ? ` · ${c.copied} new (${mb(c.bytes || 0)})` : ' · up to date'}${c.failed ? ` · <span style="color:var(--red)">${c.failed} couldn’t be copied</span>` : ''}`
          : 'not copied yet';
        return `<div class="lv-row lv-copy" data-copyrow="${esc(root)}"><span>⧉</span><small>Copy at ${esc(to)} — <i data-copystate>${state}</i></small>
          <button class="lv-btn sm" data-copynow="${esc(root)}">Copy now</button>
          <button class="lv-btn sm ghost" data-open="${esc(to)}">Open</button>
          <button class="lv-btn sm ghost" data-copyoff="${esc(root)}" title="Stops copying; the copy and its files stay where they are">Stop</button></div>`;
      }
      body.innerHTML = `
        ${d ? `<div class="lv-card">
          <h3>Folders on this computer</h3>
          ${(lib.fallback || []).map(f => `<p class="lv-warn" data-fallback>⚠ <b>${esc(f.root)}</b> can’t be reached right now, so the Library is showing its copy on this computer (${esc(f.copy)}). Everything still opens; new copies start again once it’s back.</p>`).join('')}
          <div class="lv-row"><span>🗀 Shot Library</span><small>${esc(homeInfo.path)}${homeInfo.exists ? '' : ' — not there yet'}</small>
            ${homeInfo.exists ? `<button class="lv-btn sm ghost" data-open="${esc(homeInfo.path)}">Open</button>` : ''}</div>
          ${copyRow(homeInfo.path)}
          ${(s.roots || []).map(r => `<div class="lv-row"><span>🗀</span><small>${esc(r)}</small>
            <button class="lv-btn sm ghost" data-open="${esc(r)}">Open</button>
            <button class="lv-btn sm ghost" data-unroot="${esc(r)}" title="Stops showing it here; nothing is deleted">Remove</button></div>
            ${copyRow(r)}`).join('')}
          <p class="hintline">⧉ A copy keeps every frame in a second place — the NAS folder with a copy on this computer, say. New and changed files are copied when the app starts, after a grab, and when you press Copy now. Nothing is ever deleted from a copy. If the folder can’t be reached, the Library reads its copy instead.</p>
          <div class="lv-row"><button class="lv-btn sm" data-addroot>Choose a folder…</button>
            <button class="lv-btn sm ghost" data-rescan>⟳ Refresh</button></div>
          ${(lib.errors || []).map(e => `<p class="hintline" style="color:var(--red)">${esc(e)}</p>`).join('')}
        </div>` : MediaLib.remote() ? `<div class="lv-card">
          <h3>The Shot Library on nastime</h3>
          <p class="hintline" style="margin:0 0 10px">This iPad reads the same folder as the laptop, straight from nastime. Grabs and new folders are added on the laptop; they show here the next time you refresh.</p>
          ${(lib.errors || []).map(e => `<p class="hintline" style="color:var(--red)">${esc(e)}</p>`).join('')}
          <div class="lv-row"><button class="lv-btn sm ghost" data-rescan>⟳ Refresh</button></div>
        </div>` : ''}
        <div class="sec"><h2>Libraries</h2><div class="rule"></div><span class="alt">${lib.collections.length}</span></div>
        <p class="hintline" style="margin:-4px 0 12px">Tick or untick whole libraries or single pages to choose what appears in the Deck.</p>
        ${lib.collections.length ? lib.collections.map(c => {
          const on = c.pages.filter(p => !hidden.has(p)).length;
          const state = on === 0 ? 'off' : on === c.pages.length ? 'on' : 'some';
          return `<details class="lv-col">
            <summary><input type="checkbox" data-col="${esc(c.key)}" ${state === 'on' ? 'checked' : ''} ${state === 'some' ? 'data-some' : ''}>
              <b>${esc(c.name)}</b><small>${plural(c.pages.length, 'page')} · ${c.counts[0]} GIFs · ${c.counts[1]} clips · ${c.counts[2]} stills${c.src === 'h' ? ' · on disk' : ''}</small></summary>
            ${c.pages.map(pu => { const p = lib.pageIdx.get(pu); return `<div class="lv-row lv-page">
              <input type="checkbox" data-page="${esc(pu)}" ${hidden.has(pu) ? '' : 'checked'}>
              <span class="lv-pt">${esc(MediaLib.pageLabel(p))}</span>
              <small>${p.counts[0]} GIFs · ${p.counts[1]} clips · ${p.counts[2]} stills${p.grabbed ? ' · ' + esc(p.grabbed.slice(0, 10)) : ''}</small>
              <button class="lv-btn sm ghost" data-deck="${esc(pu)}">Deck</button>
              ${p.src === 'h' ? `<button class="lv-btn sm ghost" data-open="${esc(p.root + (p.dir ? '/' + p.dir : ''))}">folder</button>`
                : `<button class="lv-btn sm ghost" data-move="${esc(pu)}">move</button>`}
            </div>`; }).join('')}
          </details>`; }).join('') : `<div class="empty"><b>No media yet</b>Use Add & grab${d ? ', or add a folder above' : ''}.</div>`}`;
      body.querySelectorAll('[data-some]').forEach(x => { x.indeterminate = true; });
      body.addEventListener('click', async e => {
        const o = e.target.closest('[data-open]');
        if(o && d) return d.open(/Win/i.test(navigator.platform || navigator.userAgent) ? o.dataset.open.replace(/\//g, '\\') : o.dataset.open);   /* Windows wants backslashes; Linux and Mac don't */
        if(e.target.closest('[data-addroot]')){
          const p = await d.pickFolder();
          if(p && !(s.roots || []).includes(p)){ await MediaLib.setSettings({ roots:[...(s.roots || []), p] }); await MediaLib.rescan(); render(); }
          return;
        }
        const cs = e.target.closest('[data-copyset]');
        if(cs && d){
          const root = cs.dataset.copyset;
          const to = await d.pickFolder();
          if(!to) return;
          /* the folder picked is already on the list above (added with Choose a
             folder…): it can become the copy instead — taken off the list, so the
             same frames aren't shown twice */
          const nrm = x => String(x || '').replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase();
          const listed = (s.roots || []).find(r => nrm(r) === nrm(to));
          if(listed && nrm(listed) !== nrm(root)){
            if(!confirm('That folder is already on your Library list. Use it as the copy instead? It comes off the list; nothing in it is deleted.')) return;
            s.roots = (s.roots || []).filter(r => r !== listed);
            await MediaLib.setSettings({ roots:s.roots });
          }
          const why = await MediaLib.copyProblem(root, to);
          if(why) return U.toast(why);
          await MediaLib.setCopy(root, to);
          s = await MediaLib.settings();
          render();
          U.toast('Copying into ' + to + ' — the row shows how far it has got');
          const r = (await MediaLib.copyNow(root) || [])[0];
          if(r && (r.error || r.skipped)) U.toast(r.error || 'The folder can’t be reached right now');
          else if(r) U.toast(`Copied ${r.copied} file${r.copied === 1 ? '' : 's'}${r.failed ? ` · ${r.failed} couldn’t be copied` : ''}`);
          await MediaLib.rescan();
          return render();
        }
        const cn = e.target.closest('[data-copynow]');
        if(cn){
          cn.disabled = true; cn.textContent = 'Copying…';
          const r = await MediaLib.copyNow(cn.dataset.copynow);
          const x = (r || [])[0];
          U.toast(!x ? 'Nothing to copy' : x.error ? x.error : x.skipped ? 'The folder can’t be reached right now' : x.copied ? `Copied ${x.copied} new or changed file${x.copied === 1 ? '' : 's'}` : 'The copy is up to date');
          return render();
        }
        const co = e.target.closest('[data-copyoff]');
        if(co){
          if(!confirm('Stop keeping a copy of this folder? The copy and its files stay where they are.')) return;
          await MediaLib.setCopy(co.dataset.copyoff, '');
          await MediaLib.rescan();
          return render();
        }
        const un = e.target.closest('[data-unroot]');
        if(un){ await MediaLib.setSettings({ roots:(s.roots || []).filter(r => r !== un.dataset.unroot) }); await MediaLib.rescan(); return render(); }
        if(e.target.closest('[data-rescan]')){ U.toast('Reading the folders…'); await MediaLib.rescan(); return render(); }
        const dk = e.target.closest('[data-deck]');
        if(dk){ e.preventDefault(); src = 'page:' + dk.dataset.deck; tab = 'deck'; return render(); }
        const mv = e.target.closest('[data-move]');
        if(mv){ e.preventDefault(); return moveDialog(lib, [mv.dataset.move]); }
      });
      body.addEventListener('change', async e => {
        const c = e.target.closest('[data-col]');
        const p = e.target.closest('[data-page]');
        const h = new Set((await MediaLib.settings()).hidden || []);
        if(c){
          const col = lib.collections.find(x => x.key === c.dataset.col);
          col.pages.forEach(pu => c.checked ? h.delete(pu) : h.add(pu));
        } else if(p){
          p.checked ? h.delete(p.dataset.page) : h.add(p.dataset.page);
        } else return;
        await MediaLib.setSettings({ hidden:[...h].sort() });
        render();
      });
    }

    function moveDialog(lib, pageUids){
      const names = [...new Set(lib.collections.filter(c => c.src === 'db').map(c => c.name))];
      App.sheet(`<h2 style="margin:0 0 8px">Move ${plural(pageUids.length, 'page')} to library</h2>
        <div class="lv-pills">${names.map(n => `<button class="pill" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
        <input id="mv-to" class="pgname" placeholder="or type a new library name" style="margin-top:10px" autocomplete="off">
        <div class="sheetcta"><button class="btn-primary" data-yes>Move</button><button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
        sh.addEventListener('click', async e => {
          const n = e.target.closest('[data-n]');
          if(n){ sh.querySelector('#mv-to').value = n.dataset.n; return; }
          if(e.target.closest('[data-no]')) return App.closeSheet();
          if(!e.target.closest('[data-yes]')) return;
          const to = sh.querySelector('#mv-to').value.trim();
          if(!to) return U.toast('Type a library name');
          const k = await MediaLib.moveToLibrary(pageUids, to);
          App.closeSheet();
          U.toast(`Moved ${plural(k, 'frame')} to ${to}`);
          render();
        });
      });
    }

    /* ---------------------------------------------------------- Add & grab */
    async function addPage(body, lib, s){
      const d = MediaLib.disk();
      const names = [...new Set(lib.collections.filter(c => c.src === 'db').map(c => c.name))];
      const gr = d ? await d.grabFind(s.grabber) : null;
      body.innerHTML = `
        <div class="lv-card">
          <h3>Add GIFs, clips and stills</h3>
          <p class="hintline" style="margin:0 0 10px">${d ? 'From this computer. They’re kept inside the app, so they travel with your backup.'
            : MediaLib.remote() ? 'From this iPad. They’re kept in the app on this iPad only — to add to the Shot Library on nastime, use the laptop.'
            : 'From this phone. They’re kept inside the app, so they travel with your backup.'}</p>
          <label class="lv-lab">Library name <small>(optional, e.g. “Cut-ins” or “Vlog looks”)</small>
            <input class="lv-in" data-libname value="${esc(s.libName || '')}" placeholder="My library"></label>
          ${names.length ? `<div class="lv-pills">${names.map(n => `<button class="pill" data-ln="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
          <div class="lv-drop" data-drop><b>Drop files here</b><span>or</span>
            <button class="lv-btn" data-files>Choose files…</button></div>
          <input type="file" data-input multiple accept="image/*,video/*,.gif,.webp,.mp4,.mov,.webm,.m4v" hidden>
          <div class="lv-row" style="margin-top:12px">
            <input class="lv-in" data-link placeholder="…or paste a direct link to a .gif, .mp4 or picture" style="flex:1">
            <button class="lv-btn" data-fetch>Add link</button></div>
        </div>
        ${d ? grabCard(gr, s) : `<div class="lv-card"><h3>Grab media</h3><p class="hintline" style="margin:0">Grabbing whole pages, YouTube, Instagram or TikTok videos runs on the laptop with Shot Library’s grabber.</p></div>`}
        ${d ? `<div class="lv-card"><h3>From Shotline</h3>
          <p class="hintline" style="margin:0 0 10px">Bring in the boards Shot Library shares (Shot Library/_boards.json) and the templates you made in Shotline (Shot Library/_Shotline/plan.json).</p>
          <button class="lv-btn" data-shotline>Import boards and templates</button></div>` : ''}`;
      const input = body.querySelector('[data-input]');
      const libName = () => body.querySelector('[data-libname]').value.trim();
      body.querySelector('[data-libname]').addEventListener('change', e => MediaLib.setSettings({ libName:e.target.value.trim() }));
      input.addEventListener('change', () => { const f = [...input.files]; if(f.length) addPicked(f, libName()); });
      const drop = body.querySelector('[data-drop]');
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('lv-dropping'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('lv-dropping'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('lv-dropping'); const f = [...(e.dataTransfer.files || [])]; if(f.length) addPicked(f, libName()); });
      body.addEventListener('click', async e => {
        const ln = e.target.closest('[data-ln]');
        if(ln){ body.querySelector('[data-libname]').value = ln.dataset.ln; return MediaLib.setSettings({ libName:ln.dataset.ln }); }
        if(e.target.closest('[data-files]')) return input.click();
        if(e.target.closest('[data-fetch]')){
          const v = body.querySelector('[data-link]').value.trim();
          try { U.toast('Fetching…'); const r = await MediaLib.addFromLink(v, libName()); U.toast(`Added ${plural(r.added.length, 'frame')}`); tab = 'deck'; render(); }
          catch(err){ U.toast(err.message || 'Could not add that link'); }
          return;
        }
        if(e.target.closest('[data-shotline]')){
          const r = await MediaLib.importShotline();
          let t = 0;
          if(window.ShotTemplates && r.templates.length) t = await ShotTemplates.importShotline(r.templates);
          return U.toast(`Brought in ${plural(r.boards, 'board')} and ${plural(t, 'template')}`);
        }
        await grabClick(e, body, s);
      });
      if(d) await restoreGrab(body);
    }

    /* v4: a grab keeps running when you leave the Library. The desktop shell
       remembers it (cs3:grab-status), so coming back shows its log, the links
       a scan found, and Stop — on Add & grab in full, on the other tabs as a
       strip at the top. */
    const stripOff = [];
    let stripTurn = 0;
    const lastLine = st => { for(let i = st.lines.length - 1; i >= 0; i--){ const l = String(st.lines[i]).trim(); if(l) return l; } return ''; };
    const grabWhat = st => st.mode === 'scan' ? 'Finding links' : st.mode === 'setup' ? 'Setting up the grabber' : 'Grabbing ' + (st.what || '');
    async function grabStrip(){
      stripOff.forEach(f => f()); stripOff.length = 0;
      const mine = ++stripTurn;
      const d = MediaLib.disk();
      const slot = host.querySelector('[data-grabstrip]');
      if(!slot || !d || !d.grabStatus || tab === 'add') return;
      const st = await d.grabStatus().catch(() => null);
      if(!st || !st.running || !slot.isConnected || mine !== stripTurn) return;
      slot.innerHTML = `<div class="lv-target lv-grabbing"><span class="lv-live" aria-hidden="true"></span>
        <span class="lv-gtext"><b>${esc(grabWhat(st))}</b> <small data-gline>${esc(lastLine(st))}</small></span>
        <button class="lv-btn sm" data-gshow>Show</button><button class="lv-btn ghost sm" data-gstop>Stop</button></div>`;
      const line = slot.querySelector('[data-gline]');
      stripOff.push(d.onGrab('line', l => { if(String(l).trim()) line.textContent = String(l).trim(); }));
      stripOff.push(d.onGrab('done', r => {
        stripOff.forEach(f => f()); stripOff.length = 0;
        slot.innerHTML = `<div class="lv-target"><span>${r.code === 0 ? '✓ Grab finished' : '■ Grab stopped'}</span>
          <button class="lv-btn ghost sm" data-gshow>Show</button></div>`;
      }));
    }
    function setBusy(body, on){
      const st = body.querySelector('[data-stop]'); if(st) st.hidden = !on;
      body.querySelectorAll('[data-grab],[data-scan],[data-setup]').forEach(b => {
        if(on){ if(!('was' in b.dataset)) b.dataset.was = b.disabled ? '1' : ''; b.disabled = true; }
        else if('was' in b.dataset){ b.disabled = !!b.dataset.was; delete b.dataset.was; }
      });
    }
    /* one set of listeners at a time, tied to this page's log */
    function wireGrab(body, o){
      const d = MediaLib.disk();
      const log = body.querySelector('[data-log]');
      const say = l => { if(!log.isConnected) return; log.hidden = false; log.textContent += l + '\n'; log.scrollTop = log.scrollHeight; };
      grabOff.forEach(f => f()); grabOff.length = 0;
      grabOff.push(d.onGrab('line', say));
      if(o.scan){
        const found = o.found || [];
        const box = body.querySelector('[data-found]');
        const draw = () => {
          if(!box.isConnected) return;
          box.innerHTML = `<p class="hintline">${plural(found.length, 'link')} found — tick the ones to grab</p>` +
            found.map((x, i) => `<label class="lv-row lv-found"><input type="checkbox" data-fl="${i}"> <span class="pill sm">${esc(x.kind || '')}</span>
              <span class="lv-pt">${esc(x.title || x.url)}</span></label>`).join('') +
            `<button class="lv-btn sm" data-addfound>Add ticked to the links list</button>`;
          box._found = found;
        };
        if(found.length) draw();
        grabOff.push(d.onGrab('link', l => { found.push(l); draw(); }));
      }
      grabOff.push(d.onGrab('done', async r => {
        say(r.code === 0 ? '— finished —' : `— stopped${r.code == null ? '' : ` (code ${r.code})`} —`);
        if(log.isConnected) setBusy(body, false);
        await MediaLib.rescan();
        if(o.setup && log.isConnected) setTimeout(render, 400);
      }));
      return say;
    }
    async function restoreGrab(body){
      const d = MediaLib.disk();
      if(!d.grabStatus) return;
      const st = await d.grabStatus().catch(() => null);
      if(!st || !body.isConnected || (!st.running && !st.lines.length && !st.links.length)) return;
      /* a grab that ended a while ago isn't worth bringing back */
      if(!st.running && Date.now() - (st.endedAt || 0) > 30 * 60 * 1000) return;
      const log = body.querySelector('[data-log]');
      if(log){
        log.hidden = false;
        log.textContent = (st.running ? '' : '(last grab) ') + grabWhat(st) + '…\n' + st.lines.map(l => l + '\n').join('') +
          (st.running ? '' : (st.code === 0 ? '— finished —\n' : '— stopped —\n'));
        log.scrollTop = log.scrollHeight;
      }
      const found = st.mode === 'scan' ? st.links.slice() : null;
      if(st.running){
        setBusy(body, true);
        wireGrab(body, { scan:st.mode === 'scan', found:found || [], setup:st.mode === 'setup' });
      } else if(found && found.length){
        const box = body.querySelector('[data-found]');
        box.innerHTML = `<p class="hintline">${plural(found.length, 'link')} found — tick the ones to grab</p>` +
          found.map((x, i) => `<label class="lv-row lv-found"><input type="checkbox" data-fl="${i}"> <span class="pill sm">${esc(x.kind || '')}</span>
            <span class="lv-pt">${esc(x.title || x.url)}</span></label>`).join('') +
          `<button class="lv-btn sm" data-addfound>Add ticked to the links list</button>`;
        box._found = found;
      }
      if(st.running) body.querySelector('[data-log]').closest('.lv-card').scrollIntoView({ block:'nearest' });
    }

    /* v4: no "Phone ⇄ laptop" file any more — the phone gets the frames its
       tasks and videos use through sync (taskframes.js), not the Library. */

    function grabCard(gr, s){
      /* pages grab with nothing installed; videos need yt-dlp and ffmpeg */
      const ready = gr && (gr.builtin || (gr.root && gr.setUp && gr.node));
      const tool = (ok, name) => `<span class="lv-tool${ok ? ' ok' : ''}">${ok ? '●' : '○'} ${name}</span>`;
      return `<div class="lv-card">
        <h3>Grab media</h3>
        <p class="hintline" style="margin:0 0 10px">Pages, YouTube, Instagram, Vimeo, TikTok. Videos are cut at every shot change into stills and short GIFs, into Shot Library. Only grab from sites whose terms allow it, and keep the files for your own planning.</p>
        <div class="lv-row"><b>Grabber</b>
          ${!gr.builtin ? `<small style="color:var(--green)">● Ready · Shot Library’s grabber · ${esc(gr.root)}</small>`
            : gr.setUp ? `<small style="color:var(--green)">● Ready · built in</small>${tool(true, 'yt-dlp')}${tool(true, 'ffmpeg')}`
            : `<small style="color:var(--amber)">Pages work now. For videos this laptop needs ${[!gr.ytdlp && 'yt-dlp', !gr.ffmpeg && 'ffmpeg'].filter(Boolean).join(' and ')}.</small>
               ${tool(!!gr.ytdlp, 'yt-dlp')}${tool(!!gr.ffmpeg, 'ffmpeg')}
               ${gr.winget ? `<button class="lv-btn sm" data-setup>Install ${[!gr.ytdlp && 'yt-dlp', !gr.ffmpeg && 'ffmpeg'].filter(Boolean).join(' and ')}</button>` : ''}
               <button class="lv-btn sm ghost" data-recheck>Check again</button>`}
        </div>
        ${gr.builtin && !gr.setUp ? `<p class="hintline" style="margin:0 0 8px">${gr.winget ? 'The button installs them with Windows’ own installer (winget), free, in a minute or two.'
          : 'Install them from github.com/yt-dlp/yt-dlp and ffmpeg.org, then press Check again.'}</p>` : ''}
        <details class="lv-opts"><summary>Use Shot Library’s grabber folder instead</summary>
          <div class="lv-row"><input class="lv-in" data-grabdir value="${esc(s.grabber || '')}" placeholder="Grabber folder (has grabber/grab.mjs)" style="flex:1">
            <button class="lv-btn sm ghost" data-usegrab>Use</button></div></details>
        <h4>Find links on a page, channel or profile</h4>
        <div class="lv-row"><input class="lv-in" data-scanurl value="${esc(s.scanUrl || '')}" placeholder="https://www.youtube.com/@channel" style="flex:1">
          <button class="lv-btn sm" data-scan ${ready ? '' : 'disabled'}>Find links</button></div>
        <div data-found></div>
        <h4>Links (one per line)</h4>
        <textarea class="lv-in lv-ta" data-links rows="4">${esc(s.links || '')}</textarea>
        <details class="lv-opts"><summary>Video and page settings</summary>
          <div class="lv-row"><span>Stills</span><select class="lv-sel" data-o="ytEvery">
            <option value="0" ${!+s.ytEvery ? 'selected' : ''}>at every cut</option>
            ${[1, 2, 3, 5].map(v => `<option value="${v}" ${+s.ytEvery === v ? 'selected' : ''}>every ${v} s</option>`).join('')}</select>
            <span>up to</span><input class="lv-in num" data-o="ytMax" type="number" min="1" max="10000" value="${s.ytMax}"></div>
          <div class="lv-row"><span>Cut sensitivity</span><select class="lv-sel" data-o="ytSens">${['high','normal','low'].map(v =>
            `<option value="${v}" ${s.ytSens === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
            <span>Make</span><select class="lv-sel" data-o="ytWhat">${[['both','Stills + GIFs'],['stills','Stills only'],['gifs','GIFs only']].map(([v, l]) =>
            `<option value="${v}" ${s.ytWhat === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="lv-row"><span>GIFs</span><input class="lv-in num" data-o="gifSecs" type="number" min="1.5" max="8" step="0.5" value="${s.gifSecs}"><span>s long,</span>
            <select class="lv-sel" data-o="gifMode"><option value="shot" ${s.gifMode === 'shot' ? 'selected' : ''}>stay inside the shot</option>
            <option value="span" ${s.gifMode === 'span' ? 'selected' : ''}>run across cuts</option></select>
            <span>up to</span><input class="lv-in num" data-o="gifMax" type="number" min="1" max="5000" value="${s.gifMax}"></div>
          <div class="lv-row"><span>Bigger GIFs behind thumbnails</span><select class="lv-sel" data-o="bigGifs">${[['link','save each GIF, linked to its bigger GIF'],['download','save the bigger GIFs themselves (large files)'],['off','GIFs only, no bigger links (fastest)']].map(([v, l]) =>
            `<option value="${v}" ${(s.bigGifs || 'link') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="lv-row"><span>Signed-in sites (Instagram…)</span><select class="lv-sel" data-o="cookies">${[['none','the app’s own sign-in (it asks when a site needs one)'],['firefox','use Firefox’s sign-in'],['chrome','use Chrome’s sign-in'],['edge','use Edge’s sign-in']].map(([v, l]) =>
            `<option value="${v}" ${(s.cookies || 'none') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="lv-row"><label><input type="checkbox" data-o="keepVideo" ${s.keepVideo ? 'checked' : ''}> keep the downloaded video</label>
            <label><input type="checkbox" data-o="follow" ${s.follow ? 'checked' : ''}> also grab the pages each link points to</label></div>
        </details>
        <div class="lv-row"><input class="lv-in" data-grablib value="${esc(s.libName || '')}" placeholder="Library name (optional; empty = sort by site)" style="flex:1">
          <button class="lv-btn" data-grab ${ready ? '' : 'disabled'}>Grab now</button>
          <button class="lv-btn ghost" data-stop hidden>Stop</button></div>
        <pre class="lv-log" data-log hidden></pre>
      </div>`;
    }

    async function grabClick(e, body, s){
      const d = MediaLib.disk();
      if(!d) return;
      const log = body.querySelector('[data-log]');
      const fresh = () => { log.textContent = ''; body.querySelector('[data-found]').innerHTML = ''; };
      if(e.target.closest('[data-usegrab]')){ await MediaLib.setSettings({ grabber:body.querySelector('[data-grabdir]').value.trim() }); return render(); }
      if(e.target.closest('[data-recheck]')) return render();
      if(e.target.closest('[data-setup]')){
        fresh();
        const say = wireGrab(body, { setup:true });
        const r = await d.grabRun({ mode:'setup', setting:s.grabber });
        if(r && r.ok === false) return U.toast(r.why);
        setBusy(body, true);
        return say('Setting up the grabber…');
      }
      if(e.target.closest('[data-stop]')) return d.grabStop();
      if(e.target.closest('[data-scan]')){
        const url = body.querySelector('[data-scanurl]').value.trim();
        if(!/^https?:/i.test(url)) return U.toast('Paste a link that starts with http');
        await MediaLib.setSettings({ scanUrl:url });
        fresh();
        const say = wireGrab(body, { scan:true, found:[] });
        const r = await d.grabRun({ mode:'scan', url, max:s.scanMax, setting:s.grabber });
        if(!r.ok) return U.toast(r.why);
        setBusy(body, true);
        return say('Finding links on ' + url + '…');
      }
      if(e.target.closest('[data-addfound]')){
        const box = body.querySelector('[data-found]');
        const ticked = [...box.querySelectorAll('[data-fl]:checked')].map(x => box._found[+x.dataset.fl].url);
        const ta = body.querySelector('[data-links]');
        const have = new Set(ta.value.split(/\s+/));
        ta.value = (ta.value.trim() + '\n' + ticked.filter(u => !have.has(u)).join('\n')).trim() + '\n';
        await MediaLib.setSettings({ links:ta.value });
        return U.toast(`Added ${plural(ticked.length, 'link')} to the list`);
      }
      if(e.target.closest('[data-grab]')){
        const links = body.querySelector('[data-links]').value.split(/\s+/).filter(l => /^https?:/i.test(l));
        if(!links.length) return U.toast('Add a link to grab first');
        const opts = {};
        body.querySelectorAll('[data-o]').forEach(x => { opts[x.dataset.o] = x.type === 'checkbox' ? x.checked : x.type === 'number' ? +x.value : x.value; });
        opts.ytEvery = +opts.ytEvery;
        opts.out = body.querySelector('[data-grablib]').value.trim();
        await MediaLib.setSettings({ ...opts, links:body.querySelector('[data-links]').value, libName:opts.out });
        fresh();
        const say = wireGrab(body, {});
        const r = await d.grabRun({ mode:'grab', links, opts, setting:s.grabber });
        if(!r.ok) return U.toast(r.why);
        setBusy(body, true);
        say(`Grabbing ${plural(links.length, 'link')}…${r.builtin ? '' : ' a Chrome window works through them'}`);
      }
    }

    host.addEventListener('click', async e => {
      const tb = e.target.closest('[data-tab]');
      if(tb && host.contains(tb)){ tab = tb.dataset.tab; selecting = false; sel.clear(); return render(); }
      if(e.target.closest('[data-go="add"]')){ tab = 'add'; return render(); }
      if(e.target.closest('[data-untarget]')){ await MediaLib.setTarget(null); return render(); }
      if(e.target.closest('[data-gshow]')){ tab = 'add'; return render(); }
      if(e.target.closest('[data-gstop]')){
        const d = MediaLib.disk(); if(d) await d.grabStop();
        const b = e.target.closest('[data-gstop]'); b.disabled = true; b.textContent = 'Stopping…';
      }
    });
    /* leaving the Library drops this page's listeners (the grab carries on) */
    const gone = new MutationObserver(() => {
      if(host.isConnected) return;
      grabOff.forEach(f => f()); grabOff.length = 0;
      stripOff.forEach(f => f()); stripOff.length = 0;
      gone.disconnect();
    });
    gone.observe(document.body, { childList:true, subtree:true });

    await render();
  }

  Screens.register('library', mount);
  if(window.CS3Lib && CS3Lib.onGrab) CS3Lib.onGrab('done', r => {
    if(document.querySelector('.lv-root')) return;
    MediaLib.rescan().catch(() => {});
    U.toast(r && r.code === 0 ? 'Grab finished — it’s in the Library' : 'The grab stopped');
  });
})();
