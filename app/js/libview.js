/* Showing Library frames: tiles, the big viewer and the picker.

   Shared by the Library, Templates and notebook pages so a frame looks and
   behaves the same everywhere: GIFs move (unless Play is off), clips play
   muted and looping while you point at them (Shotline's hoverPlay), stills
   are stills. */
(function(global){

  const esc = s => U.esc(s);   /* shared: util.js */
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* One frame, filled in later by hydrate(). `cls` adds classes, `sel` ticks it. */
  function tile(it, o){
    const opts = o || {};
    if(!it) return `<div class="lv-tile lv-missing ${opts.cls || ''}"><span>not in your library</span></div>`;
    return `<div class="lv-tile ${opts.cls || ''}${opts.sel ? ' is-sel' : ''}" data-uid="${esc(it.uid)}" data-kind="${it.kind}"
        title="${esc(MediaLib.title(it))}">
      <div class="lv-media" data-media="${esc(it.uid)}"></div>
      ${opts.badge === false ? '' : `<span class="lv-kind">${MediaLib.KIND_LABEL[it.kind]}</span>`}
      ${opts.check ? `<span class="lv-check" aria-hidden="true">${U.ICON.check}</span>` : ''}
      ${opts.caption ? `<span class="lv-cap">${esc(MediaLib.title(it))}</span>` : ''}
      ${opts.extra || ''}
    </div>`;
  }

  /* first frame of a GIF, for when Play is off */
  async function stillOf(it){
    try {
      const b = await MediaLib.blobOf(it);
      if(!b) return null;
      const bmp = await createImageBitmap(b);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
      return c;
    } catch(e){ return null; }
  }

  /* Put the real pictures into every [data-media] under `root`. */
  async function hydrate(root, lib, opts){
    const o = opts || {};
    const s = await MediaLib.settings();
    const play = o.play != null ? o.play : s.play !== false;
    const hosts = [...root.querySelectorAll('[data-media]')].filter(h => !h.dataset.done);
    for(const h of hosts){
      h.dataset.done = '1';
      const it = MediaLib.find(lib, h.dataset.media);
      if(!it){ h.classList.add('lv-empty'); continue; }
      const src = await MediaLib.url(it);
      if(!src){ h.classList.add('lv-empty'); continue; }
      if(it.kind === 'video'){
        const v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'metadata';
        const p = await MediaLib.posterUrl(it);
        if(p) v.poster = p;
        v.src = src + (it.src === 'h' ? '#t=0.5' : '');
        h.appendChild(v);
        const tileEl = h.closest('.lv-tile') || h;
        if(o.autoplay){ v.play().catch(() => {}); }
        else {
          tileEl.addEventListener('mouseenter', () => v.play().catch(() => {}));
          tileEl.addEventListener('mouseleave', () => { v.pause(); });
          tileEl.addEventListener('focusin', () => v.play().catch(() => {}));
        }
      } else if(it.kind === 'gif' && !play && (it.bytes || 0) < MediaLib.MAX_GIF_BYTES){
        const c = await stillOf(it);
        if(c) h.appendChild(c);
        else { const img = new Image(); img.src = src; h.appendChild(img); }
      } else {
        const img = new Image();
        img.decoding = 'async'; img.loading = 'lazy';
        img.src = src;
        img.alt = '';
        h.appendChild(img);
      }
    }
  }

  /* ------------------------------------------------------------ big viewer */
  async function view(uid, extra){
    const lib = await MediaLib.load();
    const it = MediaLib.find(lib, uid);
    if(!it) return U.toast('That frame is not in your library');
    const pg = lib.pageIdx.get(it.page);
    const boards = await MediaLib.allBoards();
    const on = boards.filter(b => b.items.includes(it.uid));
    const box = document.createElement('div');
    box.className = 'lv-viewer';
    box.innerHTML = `<div class="lv-vbox">
        <div class="lv-vmedia"></div>
        <div class="lv-vside">
          <p class="lv-vkind">${MediaLib.KIND_LABEL[it.kind]} · ${esc(pg ? pg.collection : '')}</p>
          <h2>${esc(MediaLib.title(it))}</h2>
          <p class="lv-vmeta">${esc(pg ? MediaLib.pageLabel(pg) : '')}${it.bytes ? ' · ' + (it.bytes / 1048576).toFixed(1) + ' MB' : ''}</p>
          ${it.big ? `<p class="lv-vmeta"><a class="lv-biglink" href="${esc(it.big)}" target="_blank" rel="noopener">⤢ Open the bigger GIF</a></p>`
            : it.link ? `<p class="lv-vmeta"><a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.link.slice(0, 60))}</a></p>` : ''}
          ${it.caption && it.big ? `<p class="lv-vmeta">${esc(it.caption.replace(/\s*·?\s*Bigger GIF: \S+/, ''))}</p>` : ''}
          ${it.source ? `<p class="lv-vmeta">Original: <a href="${esc(it.source)}" target="_blank" rel="noopener">${esc(it.source.replace(/^https?:\/\/(www\.)?/, '').slice(0, 50))}</a></p>` : ''}
          ${(it.tags || []).length ? `<p class="lv-vmeta">${it.tags.map(x => '#' + esc(x)).join(' ')}</p>` : ''}
          ${on.length ? `<p class="lv-vmeta">On ${on.map(b => '◈ ' + esc(b.name)).join(', ')}</p>` : ''}
          ${it.src === 'db' ? `<label class="lv-lab">Label<input class="lv-in" data-label value="${esc(it.label)}" placeholder="What is in it"></label>` : ''}
          <div class="lv-vacts">
            ${(extra && extra.actions) || ''}
            <button class="lv-btn" data-board>◈ Add to a board</button>
            ${global.CS3Lib ? `<button class="lv-btn" data-star>★ Star</button>` : ''}
            <button class="lv-btn ghost" data-close>Close</button>
          </div>
        </div></div>`;
    document.body.appendChild(box);
    const media = box.querySelector('.lv-vmedia');
    const src = await MediaLib.url(it);
    if(it.kind === 'video'){
      const v = document.createElement('video');
      v.src = src; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.controls = true;
      media.appendChild(v);
      v.play().catch(() => {});
    } else {
      const img = new Image(); img.src = src; media.appendChild(img);
    }
    const close = () => box.remove();
    box.addEventListener('click', async e => {
      if(e.target === box || e.target.closest('[data-close]')) return close();
      if(e.target.closest('[data-board]')){ close(); return boardMenu([it.uid]); }
      if(e.target.closest('[data-star]')){ close(); return starMenu([it.uid]); }
      const a = e.target.closest('[data-act]');
      if(a && extra && extra.onAction){ close(); extra.onAction(a.dataset.act, it); }
    });
    const lab = box.querySelector('[data-label]');
    if(lab) lab.addEventListener('change', async () => { await MediaLib.update(it.uid, { label:lab.value.trim() }); U.toast('Label saved'); });
    const key = e => { if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', key, true); e.stopPropagation(); } };
    document.addEventListener('keydown', key, true);
  }

  /* ------------------------------------------------------------ boards */
  async function boardMenu(uids, after){
    const boards = await MediaLib.allBoards();
    const groups = [...new Set([...MediaLib.BOARD_GROUPS, ...boards.map(b => b.group)])]
      .filter(g => boards.some(b => b.group === g));
    App.sheet(`<h2 style="margin:0 0 6px">Add ${plural(uids.length, 'frame')} to a board</h2>
      <p class="hintline" style="margin:0 0 14px">A frame can sit on many boards; nothing is moved.</p>
      ${groups.map(g => `<p class="lv-group">${esc(g)}</p>` + boards.filter(b => b.group === g)
        .sort((a, b) => a.name.localeCompare(b.name)).map(b =>
        `<button class="noterow" data-to="${b.id}"><span class="dot" style="background:var(--orange)"></span>
          <span class="t"><b>◈ ${esc(b.name)}</b><small>${plural(b.items.length, 'frame')}</small></span></button>`).join('')).join('')}
      ${boards.length ? '' : '<p class="hintline">No boards yet. Make one below.</p>'}
      <button class="btn-ghost" data-new style="width:100%;margin:10px 0 0">＋ New board with these</button>`, sh => {
      sh.addEventListener('click', async e => {
        const t = e.target.closest('[data-to]');
        if(t){
          const n = await MediaLib.addToBoard(t.dataset.to, uids);
          App.closeSheet();
          U.toast(n ? `Added ${plural(n, 'frame')}` : 'Already on that board');
          if(after) after();
          return;
        }
        if(e.target.closest('[data-new]')){
          App.closeSheet();
          setTimeout(() => boardDialog(null, uids, after), 260);
        }
      });
    });
  }

  /* ★ Star into a group — the frames go to the phone too, and stay */
  async function starMenu(uids, after){
    const groups = await MediaLib.allStars();
    App.sheet(`<h2 style="margin:0 0 6px">Star ${plural(uids.length, 'frame')}</h2>
      <p class="hintline" style="margin:0 0 14px">Starred frames live on your phone too, always — for the shots you make every day.</p>
      ${groups.map(g => `<button class="noterow" data-sg="${g.id}"><span class="dot" style="background:var(--amber)"></span>
          <span class="t"><b>★ ${esc(g.name)}</b><small>${plural(g.items.length, 'frame')}</small></span></button>`).join('')}
      ${groups.length ? '' : '<p class="hintline">No groups yet — name the first one.</p>'}
      <div style="display:flex;gap:8px;margin:12px 0 0"><input id="sg-new" class="pgname" type="text" placeholder="New group, e.g. Walking, Car work, Transitions" autocomplete="off" style="margin:0;flex:1">
        <button class="btn-sm" data-sgnew>＋ Make</button></div>`, sh => {
      const make = async () => {
        const name = sh.querySelector('#sg-new').value.trim();
        if(!name) return U.toast('Give the group a name');
        const g = await MediaLib.saveStar({ name, items:uids });
        App.closeSheet(); U.toast(`★ ${plural(uids.length, 'frame')} in “${g.name}”`);
        if(after) after(g);
      };
      sh.addEventListener('click', async e => {
        const t = e.target.closest('[data-sg]');
        if(t){
          const n = await MediaLib.starInto(t.dataset.sg, uids);
          App.closeSheet();
          U.toast(n ? `★ Starred ${plural(n, 'frame')}` : 'Already in that group');
          if(after) after();
          return;
        }
        if(e.target.closest('[data-sgnew]')) return make();
      });
      sh.querySelector('#sg-new').addEventListener('keydown', e => { if(e.key === 'Enter') make(); });
    });
  }

  function boardDialog(board, uids, after){
    const b = board || { name:'', group:'Activity' };
    App.sheet(`<h2 style="margin:0 0 14px">${board ? 'Rename board' : 'New board'}</h2>
      <input id="bd-n" class="pgname" type="text" value="${esc(b.name)}" placeholder="e.g. Gym, Beach, Golden hour" autocomplete="off">
      <h3 class="pgh">Sort it under</h3>
      <div class="lv-pills">${MediaLib.BOARD_GROUPS.map(g =>
        `<button class="pill" data-g="${g}" aria-pressed="${b.group === g}">${g}</button>`).join('')}</div>
      <input id="bd-g" class="pgname" type="text" value="${esc(b.group)}" autocomplete="off" style="margin-top:10px">
      <div class="sheetcta"><button class="btn-primary" data-save>Save</button>
        <button class="btn-ghost" data-cancel>Cancel</button></div>`, sh => {
      const g = sh.querySelector('#bd-g');
      sh.addEventListener('click', async e => {
        const p = e.target.closest('[data-g]');
        if(p){ g.value = p.dataset.g; sh.querySelectorAll('[data-g]').forEach(x => x.setAttribute('aria-pressed', String(x === p))); return; }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-save]')) return;
        const name = sh.querySelector('#bd-n').value.trim();
        if(!name) return U.toast('Give the board a name');
        const rec = await MediaLib.saveBoard({ ...(board || {}), name, group:g.value.trim() || 'Other',
          items:[...((board && board.items) || []), ...(uids || [])] });
        App.closeSheet();
        U.toast(board ? 'Board saved' : `Board “${rec.name}” made`);
        if(after) after(rec);
      });
      setTimeout(() => { const f = sh.querySelector('#bd-n'); if(f) f.focus(); }, 180);
    });
  }

  /* ------------------------------------------------------------ the picker
     Shotline's picking opens the whole Deck: click picks; with `multi` you tick
     as many as you like and press Add. Returns the chosen uids. */
  function pick(opts){
    const o = opts || {};
    return new Promise(async resolve => {
      const s = await MediaLib.settings();
      let kind = 'all', q = '', src = 'all', chosen = [];
      const boards = await MediaLib.allBoards();
      const lib0 = await MediaLib.load();
      const box = document.createElement('div');
      box.className = 'lv-viewer lv-picker';
      box.innerHTML = `<div class="lv-pbox">
        <div class="lv-phead">
          <h2>${esc(o.title || (o.multi ? 'Add frames from the Library' : 'Pick a shot from the Library'))}</h2>
          <button class="lv-btn ghost" data-close>Close</button>
        </div>
        <div class="lv-pbar">
          ${['all','gif','video','image'].map(k => `<button class="pill" data-k="${k}" aria-pressed="${k === kind}">${
            k === 'all' ? 'All' : k === 'gif' ? 'GIFs' : k === 'video' ? 'Clips' : 'Stills'}</button>`).join('')}
          <select class="lv-sel" data-src>
            <option value="all">Everything</option>
            ${boards.map(b => `<option value="board:${b.id}">◈ ${esc(b.name)}</option>`).join('')}
            ${lib0.collections.map(c => `<option value="col:${esc(c.key)}">${esc(c.name)}</option>`).join('')}
          </select>
          <input class="lv-in" data-q placeholder="Search…" type="search">
        </div>
        <div class="lv-grid lv-pgrid"></div>
        ${o.multi ? `<div class="lv-pfoot"><span data-n>Nothing ticked</span>
          <button class="lv-btn" data-add disabled>Add</button></div>` : ''}
      </div>`;
      document.body.appendChild(box);
      const grid = box.querySelector('.lv-pgrid');
      const done = v => { box.remove(); document.removeEventListener('keydown', key, true); resolve(v); };
      const key = e => { if(e.key === 'Escape'){ e.stopPropagation(); done(o.multi ? [] : null); } };
      document.addEventListener('keydown', key, true);

      async function draw(){
        const { lib, list } = await MediaLib.deck({ kind, q, src });
        grid.innerHTML = list.length ? list.slice(0, 600).map(it => tile(it, { check:o.multi, sel:chosen.includes(it.uid) })).join('')
          : `<div class="empty" style="grid-column:1/-1"><b>Nothing here</b>${lib.items.length
              ? 'Try another filter.' : 'Your Library is empty. Add GIFs, clips and stills in Content → Library.'}</div>`;
        hydrate(grid, lib, { play:s.play !== false });
      }
      box.addEventListener('click', e => {
        if(e.target === box || e.target.closest('[data-close]')) return done(o.multi ? [] : null);
        const k = e.target.closest('[data-k]');
        if(k){ kind = k.dataset.k; box.querySelectorAll('[data-k]').forEach(x => x.setAttribute('aria-pressed', String(x === k))); return draw(); }
        if(e.target.closest('[data-add]')) return done(chosen);
        const t = e.target.closest('.lv-tile[data-uid]');
        if(!t) return;
        if(!o.multi) return done(t.dataset.uid);
        const u = t.dataset.uid;
        chosen = chosen.includes(u) ? chosen.filter(x => x !== u) : [...chosen, u];
        t.classList.toggle('is-sel', chosen.includes(u));
        box.querySelector('[data-n]').textContent = chosen.length ? `${plural(chosen.length, 'frame')} ticked` : 'Nothing ticked';
        box.querySelector('[data-add]').disabled = !chosen.length;
      });
      box.addEventListener('contextmenu', e => {
        const t = e.target.closest('.lv-tile[data-uid]');
        if(t){ e.preventDefault(); view(t.dataset.uid); }
      });
      box.querySelector('[data-src]').addEventListener('change', e => { src = e.target.value; draw(); });
      let timer;
      box.querySelector('[data-q]').addEventListener('input', e => { clearTimeout(timer); timer = setTimeout(() => { q = e.target.value; draw(); }, 180); });
      draw();
    });
  }

  global.LibView = { tile, hydrate, view, pick, boardMenu, boardDialog, starMenu, esc, plural };
})(window);
