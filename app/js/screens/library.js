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
          ${[['deck','Deck'],['boards','Boards'],['folders','Folders'],['add','Add & grab']].map(([k, l]) =>
            `<button class="seg" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}
        </div>
        ${t ? `<div class="lv-target"><span>＋ adds to <b>${esc(t.label || 'a template')}</b></span>
          <button class="lv-btn ghost sm" data-untarget>Stop</button></div>` : ''}
        <div id="libBody"></div>`;
      const body = host.querySelector('#libBody');
      if(tab === 'boards') return boardsPage(body, lib);
      if(tab === 'folders') return foldersPage(body, lib, s);
      if(tab === 'add') return addPage(body, lib, s);
      return deckPage(body, lib, s, t);
    }

    /* ---------------------------------------------------------- Deck */
    async function deckPage(body, lib, s, t){
      const boards = await MediaLib.allBoards();
      const count = k => lib.items.filter(it => k === 'all' || it.kind === k).length;
      const srcPage = src.startsWith('page:') ? lib.pageIdx.get(src.slice(5)) : null;
      body.innerHTML = `
        <div class="lv-bar">
          ${['all','gif','video','image'].map(k => `<button class="pill" data-k="${k}" aria-pressed="${kind === k}">${
            k === 'all' ? 'All' : k === 'gif' ? 'GIFs' : k === 'video' ? 'Clips' : 'Stills'} <small>${count(k)}</small></button>`).join('')}
        </div>
        <div class="lv-bar">
          <select class="lv-sel" data-src>
            <option value="all">Everything</option>
            ${srcPage ? `<option value="${esc(src)}" selected>${esc(MediaLib.pageLabel(srcPage))}</option>` : ''}
            ${boards.length ? `<optgroup label="Boards">${boards.map(b =>
              `<option value="board:${b.id}" ${src === 'board:' + b.id ? 'selected' : ''}>◈ ${esc(b.name)} (${b.items.length})</option>`).join('')}</optgroup>` : ''}
            ${lib.collections.length ? `<optgroup label="Libraries">${lib.collections.map(c =>
              `<option value="col:${esc(c.key)}" ${src === 'col:' + c.key ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>` : ''}
          </select>
          <input class="lv-in" type="search" data-q placeholder="Search names, labels, pages…" value="${esc(q)}">
          <button class="pill" data-play aria-pressed="${s.play !== false}">▶ Play GIFs</button>
          <button class="pill" data-select aria-pressed="${selecting}">☐ Select</button>
        </div>
        <div class="lv-selbar" ${selecting && sel.size ? '' : 'hidden'}>
          <b data-seln>${plural(sel.size, 'frame')}</b>
          <button class="lv-btn sm" data-sel="board">◈ Add to board</button>
          ${t ? `<button class="lv-btn sm" data-sel="target">＋ Add to ${esc(t.label || 'template')}</button>` : ''}
          <button class="lv-btn sm ghost" data-sel="all">Select all shown</button>
          <button class="lv-btn sm ghost" data-sel="clear">Clear</button>
          <button class="lv-btn sm ghost danger" data-sel="delete">Delete</button>
        </div>
        <div class="lv-grid lv-deck" data-drop></div>
        <p class="hintline lv-foot">Click a frame to see it big${t ? ', ＋ adds it to ' + esc(t.label) : ''}. Drop files here to add them.</p>`;
      const grid = body.querySelector('.lv-deck');

      async function draw(){
        const { lib: l, list, board } = await MediaLib.deck({ kind, q, src });
        const shown = list.slice(0, 1500);
        grid.innerHTML = shown.length ? shown.map(it =>
          tile(it, { check:selecting, sel:sel.has(it.uid), caption:true,
            extra: t && !selecting ? `<button class="lv-plus" data-plus="${esc(it.uid)}" title="Add to ${esc(t.label)}">＋</button>` : '' })
        ).join('') : `<div class="empty" style="grid-column:1/-1"><b>${l.items.length ? 'Nothing matches' : 'Your Library is empty'}</b>${
          l.items.length ? 'Try another filter or search.' : 'Add GIFs, clips and stills from this device, a link, or (on the laptop) a folder.'}
          ${l.items.length ? '' : '<br><button class="lv-btn" data-go="add" style="margin-top:14px">＋ Add to the Library</button>'}</div>`;
        if(list.length > shown.length) grid.insertAdjacentHTML('beforeend',
          `<p class="hintline" style="grid-column:1/-1">Showing the first ${shown.length} of ${list.length}. Search or filter to find the rest.</p>`);
        grid.dataset.board = board ? board.id : '';
        hydrate(grid, l);
        grid._shown = shown.map(x => x.uid);
      }
      function selbar(){
        const bar = body.querySelector('.lv-selbar');
        bar.hidden = !(selecting && sel.size);
        body.querySelector('[data-seln]').textContent = plural(sel.size, 'frame');
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
          if(act === 'board') return LibView.boardMenu([...sel], () => { sel.clear(); render(); });
          if(act === 'target'){ await addToTarget([...sel]); sel.clear(); return render(); }
          if(act === 'delete') return confirmDelete([...sel]);
        }
        const tl = e.target.closest('.lv-tile[data-uid]');
        if(!tl) return;
        if(selecting){
          const u = tl.dataset.uid;
          sel.has(u) ? sel.delete(u) : sel.add(u);
          tl.classList.toggle('is-sel', sel.has(u));
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
        if(tl){ e.preventDefault(); LibView.view(tl.dataset.uid); }
      });
      body.querySelector('[data-src]').addEventListener('change', e => { src = e.target.value; draw(); });
      let timer;
      body.querySelector('[data-q]').addEventListener('input', e => { clearTimeout(timer); timer = setTimeout(() => { q = e.target.value; draw(); }, 200); });
      wireDrop(grid);
      await draw();
    }

    async function addToTarget(uids){
      const t = await MediaLib.target();
      if(!t) return U.toast('Choose where ＋ adds to in Templates first');
      if(!global_tpl()) return U.toast('Templates are not available');
      const n = await ShotTemplates.addToTarget(t, uids);
      U.toast(n ? `Added ${plural(n, 'frame')} to ${t.label}` : 'Nothing added — the page has no empty spots');
    }
    const global_tpl = () => !!window.ShotTemplates;

    function confirmDelete(uids){
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
      body.innerHTML = `
        ${d ? `<div class="lv-card">
          <h3>Folders on this computer</h3>
          <div class="lv-row"><span>🗀 Shot Library</span><small>${esc(homeInfo.path)}${homeInfo.exists ? '' : ' — not there yet'}</small>
            ${homeInfo.exists ? `<button class="lv-btn sm ghost" data-open="${esc(homeInfo.path)}">Open</button>` : ''}</div>
          ${(s.roots || []).map(r => `<div class="lv-row"><span>🗀</span><small>${esc(r)}</small>
            <button class="lv-btn sm ghost" data-open="${esc(r)}">Open</button>
            <button class="lv-btn sm ghost" data-unroot="${esc(r)}" title="Stops showing it here; nothing is deleted">Remove</button></div>`).join('')}
          <div class="lv-row"><button class="lv-btn sm" data-addroot>Choose a folder…</button>
            <button class="lv-btn sm ghost" data-rescan>⟳ Refresh</button></div>
          ${(lib.errors || []).map(e => `<p class="hintline" style="color:var(--red)">${esc(e)}</p>`).join('')}
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
        if(o && d) return d.open(o.dataset.open.replace(/\//g, '\\'));
        if(e.target.closest('[data-addroot]')){
          const p = await d.pickFolder();
          if(p && !(s.roots || []).includes(p)){ await MediaLib.setSettings({ roots:[...(s.roots || []), p] }); await MediaLib.rescan(); render(); }
          return;
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
          <p class="hintline" style="margin:0 0 10px">From this ${d ? 'computer' : 'phone'}. They’re kept inside the app, so they travel with your backup.</p>
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
          <button class="lv-btn" data-shotline>Import boards and templates</button></div>` : ''}
        <div class="lv-card" data-phonecard><h3>Phone ⇄ laptop</h3>
          <p class="hintline" style="margin:0 0 10px">Move the Library (GIFs, clips, stills, boards), Templates (shots, tasks, look, notebook pages) and your tasks with their shot pages between this ${d ? 'laptop' : 'phone'} and the ${d ? 'phone' : 'laptop'} app. Importing adds and updates; it never deletes anything.</p>
          ${d ? `<div class="lv-row"><button class="lv-btn ghost" data-bringin>1 · Copy grabbed files into the app</button>
            <small class="hintline" data-bringnote>Grabbed GIFs live in folders on this laptop; copying them in lets them travel to the phone (with their bigger-GIF links).</small></div>` : ''}
          <div class="lv-row"><button class="lv-btn" data-libexport>${d ? '2 · ' : ''}Export Library & Templates</button>
            <button class="lv-btn ghost" data-libimport>Import a Library & Templates file</button></div>
          <p class="hintline" data-phonelog style="margin:6px 0 0"></p></div>`;
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
        if(await phoneClick(e, body)) return;
        await grabClick(e, body, s);
      });
    }

    /* Phone ⇄ laptop: the stores that make up the Library, Templates and the
       tasks' shot pages, in one file both apps read (Transfer's backup format) */
    const PHONE_STORES = ['lib-items', 'lib-blob', 'lib-poster', 'lib-boards', 'shot-templates', 'tasks'];
    async function phoneClick(e, body){
      const log = body.querySelector('[data-phonelog]');
      const say = t => { if(log) log.textContent = t; };
      if(e.target.closest('[data-bringin]')){
        say('Copying grabbed files into the app…');
        const r = await MediaLib.bringIn(null, (i, n) => say(`Copying grabbed files into the app… ${i} of ${n}`));
        say(`${plural(r.copied, 'file')} copied in${r.already ? ` · ${r.already} already in` : ''}${r.failed ? ` · ${r.failed} couldn’t be read` : ''}. Now export.`);
        return true;
      }
      if(e.target.closest('[data-libexport]')){
        say('Packing the Library and Templates…');
        try {
          const data = await Transfer.exportAll({ photos:true, only:PHONE_STORES });
          data.kind = 'library-templates';
          const text = JSON.stringify(data);
          const name = `CSv4 Library & Templates ${new Date().toISOString().slice(0, 10)}.json`;
          const ok = await Transfer.download(name, text, 'application/json');
          const lib = await MediaLib.load(true);
          const onDisk = lib.items.filter(it => it.src === 'h').length;
          say(ok ? `Saved “${name}” (${(text.length / 1048576).toFixed(1)} MB: ${plural((data.data['lib-items'] || []).length, 'frame')}, ${plural((data.data['shot-templates'] || []).length, 'template')}, ${plural((data.data.tasks || []).length, 'task')}).${onDisk ? ` ${onDisk} grabbed files are still only in folders — press 1 first to include them.` : ''} Open it on the other device with “Import a Library & Templates file”.`
            : 'Not saved.');
        } catch(err){ say('Couldn’t export: ' + (err.message || err)); }
        return true;
      }
      if(e.target.closest('[data-libimport]')){
        const text = await Transfer.pickFile('.json,application/json');
        if(!text) return true;
        say('Bringing it in…');
        try {
          const obj = JSON.parse(text);
          const n = await Transfer.importAll(obj, 'merge');
          const rep = Transfer.report() || {};
          if(window.Data && Data.invalidate) Data.invalidate();
          await MediaLib.rescan();
          say(`Brought in ${plural(n || 0, 'record')}${rep.photos ? ` with ${plural(rep.photos, 'file')}` : ''}. Find them under Library and Templates.`);
        } catch(err){ say('Couldn’t import: ' + (err.message || err)); }
        return true;
      }
      return false;
    }

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
      const say = l => { log.hidden = false; log.textContent += l + '\n'; log.scrollTop = log.scrollHeight; };
      const listen = () => {
        grabOff.forEach(f => f()); grabOff.length = 0;
        grabOff.push(d.onGrab('line', say));
        grabOff.push(d.onGrab('done', async r => {
          say(r.code === 0 ? '— finished —' : `— stopped (code ${r.code}) —`);
          const st = body.querySelector('[data-stop]'); if(st) st.hidden = true;
          await MediaLib.rescan();
        }));
      };
      if(e.target.closest('[data-usegrab]')){ await MediaLib.setSettings({ grabber:body.querySelector('[data-grabdir]').value.trim() }); return render(); }
      if(e.target.closest('[data-recheck]')) return render();
      if(e.target.closest('[data-setup]')){
        listen();
        grabOff.push(d.onGrab('done', () => setTimeout(render, 400)));
        say('Setting up the grabber…');
        return d.grabRun({ mode:'setup', setting:s.grabber });
      }
      if(e.target.closest('[data-stop]')) return d.grabStop();
      if(e.target.closest('[data-scan]')){
        const url = body.querySelector('[data-scanurl]').value.trim();
        if(!/^https?:/i.test(url)) return U.toast('Paste a link that starts with http');
        await MediaLib.setSettings({ scanUrl:url });
        const found = [];
        const box = body.querySelector('[data-found]');
        listen();
        grabOff.push(d.onGrab('link', l => {
          found.push(l);
          box.innerHTML = `<p class="hintline">${plural(found.length, 'link')} found — tick the ones to grab</p>` +
            found.map((x, i) => `<label class="lv-row lv-found"><input type="checkbox" data-fl="${i}"> <span class="pill sm">${esc(x.kind || '')}</span>
              <span class="lv-pt">${esc(x.title || x.url)}</span></label>`).join('') +
            `<button class="lv-btn sm" data-addfound>Add ticked to the links list</button>`;
          box._found = found;
        }));
        const r = await d.grabRun({ mode:'scan', url, max:s.scanMax, setting:s.grabber });
        if(!r.ok) U.toast(r.why);
        return;
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
        listen();
        const r = await d.grabRun({ mode:'grab', links, opts, setting:s.grabber });
        if(!r.ok) return U.toast(r.why);
        body.querySelector('[data-stop]').hidden = false;
        say(`Grabbing ${plural(links.length, 'link')}…${r.builtin ? '' : ' a Chrome window works through them'}`);
      }
    }

    host.addEventListener('click', async e => {
      const tb = e.target.closest('[data-tab]');
      if(tb && host.contains(tb)){ tab = tb.dataset.tab; selecting = false; sel.clear(); return render(); }
      if(e.target.closest('[data-go="add"]')){ tab = 'add'; return render(); }
      if(e.target.closest('[data-untarget]')){ await MediaLib.setTarget(null); return render(); }
    });

    await render();
  }

  Screens.register('library', mount);
})();
