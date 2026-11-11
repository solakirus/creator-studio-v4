/* The notebook pages of a template (or a shot's task sequence), as an editor:
   a strip of pages, the open page big on the left, its words on the right.

   On the page: click a picture spot to pick a shot from the Library
   (right-click for black & white or ungraded), click any words to type over
   them in the same handwriting, click a palette chip to change its colour,
   tick a step's box, click the music strip to add or play music.
   Port of Shotline's ui_pages.rs pages_editor / page_open / page_form. */
(function(global){
  const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const NB = () => global.Notebook;

  /* opts: { sheets (array, changed in place), tasks:[titles], save(), tid, single } */
  function mount(host, opts){
    const o = opts || {};
    const sheets = o.sheets;
    let selId = (sheets[0] || {}).id || null;
    let play = false, lines = false, alive = true, media = {}, wave = null;

    const save = () => { if(o.save) o.save(); };
    const cur = () => sheets.find(s => s.id === selId) || null;

    async function render(){
      const sh = cur();
      const boards = await MediaLib.allBoards();
      const lib = await MediaLib.load();
      const tg = await MediaLib.target();
      const filling = sh && tg && tg.kind === 'sheet' && tg.sid === sh.id;
      host.innerHTML = `
        <div class="pe-bar">
          ${o.single ? '' : `<details class="lv-menu"><summary class="lv-btn sm">＋ Add page ▾</summary><div>
            <p class="lv-group">Like your videos</p>
            ${NB().designs().map(([n], i) => `<button data-add="${i}">${esc(n)}</button>`).join('')}</div></details>
          <details class="lv-menu"><summary class="lv-btn sm ghost">＋ Steps for a task ▾</summary><div>
            <p class="lv-group">A task's steps, each with a picture or GIF</p>
            ${(o.tasks || []).map((t, i) => `<button data-addtask="${i}">${esc(t)}</button>`).join('') || '<p class="hintline">No tasks here yet — add some on the Tasks tab.</p>'}
            <button data-addtask="-1">A blank task sequence</button></div></details>`}
          ${sh ? `
            ${o.single ? '' : `<button class="lv-btn sm ghost" data-dup>Duplicate</button>
            <button class="lv-btn sm ghost" data-mv="-1" title="Move earlier">◀</button>
            <button class="lv-btn sm ghost" data-mv="1" title="Move later">▶</button>
            ${o.lockId && sh.id === o.lockId ? `<span class="pe-lock" title="${esc(o.lockNote || '')}">Shot page</span>`
              : `<button class="lv-btn sm ghost danger" data-del>Delete page</button>`}`}
            <details class="lv-menu"><summary class="lv-btn sm ghost">Fill empty spots ▾</summary><div>
              <p class="lv-group">Random shots from</p>
              <button data-fill="">Everything in the Library</button>
              ${boards.map(b => `<button data-fill="board:${b.id}">◈ ${esc(b.name)}</button>`).join('')}
              ${lib.collections.map(c => `<button data-fill="col:${esc(c.key)}">${esc(c.name)}</button>`).join('')}</div></details>
            ${o.noTarget ? '' : `<button class="pill sm" data-target aria-pressed="${!!filling}">${filling ? '✔ Library ＋ fills this page' : 'Make Library ＋ fill this page'}</button>`}
            <button class="pill sm" data-play aria-pressed="${play}">▶ Play GIFs & clips</button>
            <button class="pill sm" data-lines aria-pressed="${lines}" title="On: just the grid lines over the app's paper. Off: the grey paper of your template videos">See-through paper</button>
            <button class="lv-btn sm ghost" data-png title="A 1080 × 1350 PNG, ready for a carousel">Save picture</button>
            <button class="lv-btn sm" data-video title="A 720 × 900 video at 24 fps, GIFs and clips moving inside">Save video</button>` : ''}
        </div>
        ${o.single ? '' : `<div class="pe-strip">${sheets.map((s, i) => `<button class="pe-thumb${s.id === selId ? ' on' : ''}${o.lockId && s.id === o.lockId ? ' lock' : ''}" data-sel="${s.id}" title="${esc(s.name)}${o.lockId && s.id === o.lockId ? ' · shot page' : ''}">
          <canvas width="84" height="105" data-thumb="${s.id}"></canvas><span>${i + 1}</span></button>`).join('')}</div>`}
        ${sh ? `<div class="pe-open">
          <div class="pe-pagewrap"><canvas class="pe-page" width="720" height="900"></canvas><div class="pe-edit" hidden></div></div>
          <div class="pe-form">${form(sh, lib)}</div></div>`
          : `<div class="empty"><b>No pages yet</b>Add a page like your “Notes from a creative” videos: frames from the film, before & after, a character sheet, a soundtrack or a signed cover. Then click a spot to drop in a shot from your Library.</div>`}`;
      if(!sh) return;
      media = await NB().prepare(sh);
      wave = await NB().waveOf(sh);
      draw();
      thumbs();
      if(play) loop();
    }

    async function thumbs(){
      for(const c of host.querySelectorAll('[data-thumb]')){
        const s = sheets.find(x => x.id === c.dataset.thumb);
        if(!s) continue;
        const m = await NB().prepare(s);
        NB().draw(c.getContext('2d'), s, { scale:84 / 720, media:m, linesOnly:lines });
      }
    }

    function draw(t){
      const c = host.querySelector('.pe-page');
      const sh = cur();
      if(!c || !sh) return;
      const st = NB().playState(sh);
      NB().draw(c.getContext('2d'), sh, { media, wave, t:play ? (t != null ? t : performance.now() / 1000) : null,
        played: st && wave && wave.secs ? st.pos / wave.secs : (st && st.dur ? st.pos / st.dur : null), playing: st && st.playing, linesOnly:lines });
    }

    let raf = 0;
    function loop(){
      cancelAnimationFrame(raf);
      let last = 0;
      const tick = now => {
        if(!alive || !document.body.contains(host)){ alive = false; return; }
        const sh = cur();
        const st = sh && NB().playState(sh);
        if(play || (st && st.playing)){
          if(now - last > 40){ last = now; draw(now / 1000); }
          raf = requestAnimationFrame(tick);
        }
      };
      raf = requestAnimationFrame(tick);
      Object.values(media).forEach(m => { if(m && m.kind === 'video'){ play ? m.el.play().catch(() => {}) : m.el.pause(); } });
    }

    function form(sh, lib){
      const st = NB().playState(sh);
      const f = NB().fieldsOf(sh.layout);
      let h = `<input class="pe-name" data-name value="${esc(sh.name)}">
        <p class="hintline" style="margin:2px 0 10px">${esc(NB().layoutName(sh.layout))} · 4:5 · click any words on the page to type over them, a picture spot to pick a shot (right-click: black & white or ungraded)</p>
        <button class="lv-btn sm ghost" data-full>⛶ Full screen</button>
        <p class="lv-group">Music for this page</p>
        <div class="lv-row"><button class="lv-btn sm ghost" data-music>♪ Choose a file…</button>
          ${sh.music ? `<button class="lv-btn sm ghost" data-playm>${st && st.playing ? '❚❚ Pause' : '▶ Play'}</button>
          ${st ? `<button class="lv-btn sm ghost" data-in style="color:var(--green)">[ In</button><button class="lv-btn sm ghost" data-out style="color:var(--red)">Out ]</button>` : ''}
          ${sh.music_out > sh.music_in ? `<button class="lv-btn sm ghost" data-inout>▶ In → Out</button>` : ''}
          <button class="lv-btn sm ghost" data-nomusic title="Take the music off">✕</button>` : ''}</div>
        ${sh.music_in > 0 || sh.music_out > 0 ? `<p class="hintline" style="color:var(--green)">In ${NB().fmtTime(sh.music_in)} → Out ${sh.music_out > 0 ? NB().fmtTime(sh.music_out) : 'end'}</p>` : ''}
        <input class="lv-in" data-mlink value="${esc(/^nb:/.test(sh.music) ? '' : sh.music)}" placeholder="…or paste a link (YouTube, Spotify…)">
        <input class="lv-in" data-mnote value="${esc(sh.music_note)}" placeholder="Note: “from 0:45, the drop on the cut”">
        <input type="file" data-mfile accept="audio/*,.mp3,.m4a,.wav,.ogg,.opus,.flac,.aac" hidden>`;
      if(sh.layout === 'steps'){
        const roles = sh.slots.map(x => x.role);
        const miss = NB().missingRoles(roles);
        h += `<p class="lv-group">${sh.slots.length} of ${NB().MAX_STEPS} steps</p>
          <div class="lv-row"><button class="lv-btn sm ghost" data-step="1" ${sh.slots.length >= NB().MAX_STEPS ? 'disabled' : ''}>＋ Step</button>
            <button class="lv-btn sm ghost" data-step="-1" ${sh.slots.length <= 1 ? 'disabled' : ''}>− Last step</button></div>
          <p class="hintline">${esc(NB().roleLine(roles))}${miss.length ? ` <span style="color:var(--red)">· missing: ${esc(miss.join(', ').toLowerCase())}</span>` : ''}${
            sh.slots.length < NB().TASK_SHOTS_MIN ? ` <span style="color:var(--amber)">· a task usually needs ${NB().TASK_SHOTS_MIN} to ${NB().MAX_STEPS} shots</span>` : ''}</p>
          ${sh.slots.map((x, i) => `<div class="lv-row pe-steprow"><input type="checkbox" data-sdone="${i}" ${x.done ? 'checked' : ''}>
            <b class="pe-n">${String(i + 1).padStart(2, '0')}</b>
            <select class="lv-sel" data-srole="${i}"><option value="">Role</option>${NB().ROLES.map(r => `<option ${x.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
            <input class="lv-in" data-stext="${i}" value="${esc(x.text)}" placeholder="What happens in this step"></div>`).join('')}`;
      }
      if(sh.layout === 'frames'){
        const pal = (sh.palette || []).length >= 7 ? sh.palette : NB().FRAMES_PALETTE;
        h += `<p class="lv-group">Palette</p>${pal.slice(0, 7).map((c, i) => `<div class="lv-row"><span class="pe-pl">${i < 5 ? 'Colour ' + (i + 1) : 'Accent ' + (i - 4)}</span>
          <input type="color" data-pc="${i}" value="${esc(c.toLowerCase())}"><input class="lv-in pe-hex" data-ph="${i}" value="${esc(c)}"></div>`).join('')}
          <button class="lv-btn sm ghost" data-pickpal title="Five main tones (dark → light), two accents and the tone most pixels lean to">Pick palette from these frames</button>`;
      }
      h += f.map(([k, label, multi]) => `<p class="lv-group">${esc(label)}</p>${multi
        ? `<textarea class="lv-in lv-ta" data-f="${k}" rows="2">${esc((sh.fields || {})[k] || '')}</textarea>`
        : `<input class="lv-in" data-f="${k}" value="${esc((sh.fields || {})[k] || '')}">`}`).join('');
      h += `<p class="lv-group">Video length</p><div class="lv-row"><input class="lv-in num" type="number" min="1" max="30" step="0.1" data-secs value="${sh.seconds || 5}"> <span>s</span></div>
        <p class="lv-group">Picture spots</p>
        ${sh.slots.map((x, i) => { const it = x.item ? MediaLib.find(lib, x.item) : null; return `<div class="lv-row"><span>${i + 1}.</span>
          <span class="lv-pt">${esc(x.item ? (it ? MediaLib.title(it) : 'not in your library') : 'empty')}</span>
          <select class="lv-sel" data-tone="${i}">${[['', 'As shot'], ['bw', 'Black & white'], ['flat', 'Ungraded']].map(([v, l]) =>
            `<option value="${v}" ${(x.tone || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`; }).join('')}`;
      return h;
    }

    /* where on the page a click landed, in page units */
    function at(e, c){
      const r = c.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width * NB().PAGE_W, (e.clientY - r.top) / r.height * NB().PAGE_H];
    }
    const inside = (p, r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];

    async function pickInto(i){
      const sh = cur();
      const u = await LibView.pick({ title:'Pick a shot for spot ' + (i + 1) });
      if(!u) return;
      while(sh.slots.length <= i) sh.slots.push({ item:'', tone:'', text:'', role:'', done:false });
      sh.slots[i].item = u;
      save(); render();
    }

    function inlineEdit(spot, c){
      const sh = cur();
      const wrap = host.querySelector('.pe-edit');
      const k = c.getBoundingClientRect().width / NB().PAGE_W;
      const fam = { marker:'NB Marker', hand:'NB Hand', mono:'NB Mono' }[spot.fam] || 'NB Hand';
      wrap.hidden = false;
      wrap.innerHTML = `<textarea spellcheck="false"></textarea>`;
      const ta = wrap.querySelector('textarea');
      Object.assign(wrap.style, { left:(spot.r[0] * k - 2) + 'px', top:(spot.r[1] * k - 2) + 'px',
        width:Math.max(80, (spot.r[2] - spot.r[0]) * k + 30) + 'px', height:Math.max(24, (spot.r[3] - spot.r[1]) * k + 10) + 'px' });
      Object.assign(ta.style, { fontFamily:`"${fam}"`, fontSize:(spot.size * k) + 'px', color:/red|approved|note_side|tone_pct|accent|nickname|caption1_red|^note$/.test(spot.key) ? 'rgb(196,40,52)' : 'rgb(26,26,28)' });
      ta.value = NB().fieldOf(sh, spot.key);
      ta.focus(); ta.select();
      const commit = () => {
        if(wrap.hidden) return;
        NB().setField(sh, spot.key, ta.value);
        wrap.hidden = true; wrap.innerHTML = '';
        save(); render();
      };
      ta.addEventListener('blur', commit);
      ta.addEventListener('keydown', e => {
        if(e.key === 'Escape'){ e.stopPropagation(); wrap.hidden = true; wrap.innerHTML = ''; }
        if(e.key === 'Enter' && !spot.multi){ e.preventDefault(); ta.blur(); }
      });
    }

    async function pageClick(e, c, full){
      const sh = cur();
      const p = at(e, c);
      const spots = NB().textSpots(sh);
      for(let k = spots.length - 1; k >= 0; k--){
        const sp = spots[k];
        if(!inside(p, sp.r)) continue;
        if(sp.key.startsWith('swatch:')){
          const i = +sp.key.slice(7);
          const inp = document.createElement('input'); inp.type = 'color';
          const pal = (sh.palette || []).length >= 7 ? sh.palette : NB().FRAMES_PALETTE.slice();
          inp.value = pal[i].toLowerCase();
          inp.addEventListener('input', () => { sh.palette = pal.slice(); sh.palette[i] = inp.value.toUpperCase(); draw(); });
          inp.addEventListener('change', () => { save(); render(); });
          inp.click();
          return;
        }
        if(sp.key.startsWith('done:')){ const i = +sp.key.slice(5); sh.slots[i].done = !sh.slots[i].done; save(); return full ? full() : render(); }
        if(sp.key === 'music'){
          if(!sh.music) return host.querySelector('[data-mfile]').click();
          const a = await NB().playerFor(sh);
          if(!a) return U.toast('That link opens in its own app');
          const bx0 = sh.layout === 'steps' ? NB().WAVE_X0 : 70, bx1 = sh.layout === 'steps' ? NB().WAVE_X1 : 650;
          if(sh.layout === 'steps' && p[0] < bx0){ a.paused ? a.play() : a.pause(); }
          else { const fr = Math.max(0, Math.min(1, (p[0] - bx0) / (bx1 - bx0))); if(a.duration) a.currentTime = fr * a.duration; a.play(); }
          loop(); setTimeout(() => !full && render(), 60);
          return;
        }
        if(full) return;
        return inlineEdit(sp, c);
      }
      const rects = NB().slotRects(sh.layout, sh.slots.length);
      const i = rects.findIndex(r => inside(p, r));
      if(i >= 0) return pickInto(i);
    }

    function slotMenu(e, c){
      const sh = cur();
      const p = at(e, c);
      const i = NB().slotRects(sh.layout, sh.slots.length).findIndex(r => inside(p, r));
      if(i < 0) return;
      e.preventDefault();
      const sl = sh.slots[i] || {};
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
      m.addEventListener('click', ev => {
        const b = ev.target.closest('[data-c]');
        if(!b) return;
        m.remove();
        if(b.dataset.c === 'pick') return pickInto(i);
        if(b.dataset.c === 'view') return LibView.view(sl.item);
        if(b.dataset.c === 'clear'){ sl.item = ''; save(); return render(); }
        if(b.dataset.c === 'tone'){ sl.tone = b.dataset.v; save(); return render(); }
      });
    }

    /* the page over the whole window, to follow while shooting; tick steps off there */
    function fullScreen(){
      const box = document.createElement('div');
      box.className = 'pe-full';
      box.innerHTML = `<canvas width="1080" height="1350"></canvas><button class="lv-btn ghost" data-x>Close</button>`;
      document.body.appendChild(box);
      const c = box.querySelector('canvas');
      const paint = () => NB().draw(c.getContext('2d'), cur(), { scale:1.5, media, wave, t:play ? performance.now() / 1000 : null, linesOnly:lines });
      paint();
      let r2 = 0;
      const tick = () => { if(!document.body.contains(box)) return; paint(); r2 = requestAnimationFrame(tick); };
      if(play) tick();
      const close = () => { cancelAnimationFrame(r2); box.remove(); render(); document.removeEventListener('keydown', key, true); };
      const key = e => { if(e.key === 'Escape'){ e.stopPropagation(); close(); } };
      document.addEventListener('keydown', key, true);
      box.addEventListener('click', e => {
        if(e.target.closest('[data-x]') || e.target === box) return close();
        if(e.target === c) pageClick(e, c, paint);
      });
    }

    host.addEventListener('click', async e => {
      const t = e.target;
      const sh = cur();
      const add = t.closest('[data-add]');
      if(add){
        const s = NB().copyNew(NB().designs()[+add.dataset.add][1]);
        const i = sheets.findIndex(x => x.id === selId);
        sheets.splice(i < 0 ? sheets.length : i + 1, 0, s);
        selId = s.id; save(); return render();
      }
      const at2 = t.closest('[data-addtask]');
      if(at2){
        const k = +at2.dataset.addtask;
        const s = NB().copyNew(NB().stepsPage(k >= 0 ? o.tasks[k] : 'Task'));
        const i = sheets.findIndex(x => x.id === selId);
        sheets.splice(i < 0 ? sheets.length : i + 1, 0, s);
        selId = s.id; save(); return render();
      }
      const sel = t.closest('[data-sel]');
      if(sel){ selId = sel.dataset.sel; return render(); }
      if(!sh) return;
      if(t.closest('[data-dup]')){ const c = NB().copyNew(sh); sheets.splice(sheets.indexOf(sh) + 1, 0, c); selId = c.id; save(); return render(); }
      const mv = t.closest('[data-mv]');
      if(mv){ const i = sheets.indexOf(sh), j = i + +mv.dataset.mv; if(j >= 0 && j < sheets.length){ sheets.splice(i, 1); sheets.splice(j, 0, sh); save(); render(); } return; }
      if(t.closest('[data-del]')){ if(o.lockId && sh.id === o.lockId) return; const i = sheets.indexOf(sh); sheets.splice(i, 1); selId = (sheets[Math.min(i, sheets.length - 1)] || {}).id || null; save(); return render(); }
      const fill = t.closest('[data-fill]');
      if(fill){ const n = await NB().fillEmpty(sh, fill.dataset.fill); U.toast(n ? `Filled ${plural(n, 'spot')}` : 'No empty spots, or nothing to pick from'); if(n) save(); return render(); }
      if(t.closest('[data-target]')){
        const tg = await MediaLib.target();
        if(tg && tg.kind === 'sheet' && tg.sid === sh.id) await MediaLib.setTarget(null);
        else await MediaLib.setTarget({ kind:'sheet', tid:o.tid, sid:sh.id, label:'📄 ' + sh.name });
        return render();
      }
      if(t.closest('[data-play]')){ play = !play; await render(); return loop(); }
      if(t.closest('[data-lines]')){ lines = !lines; return render(); }
      if(t.closest('[data-png]')){ U.toast('Making the picture…'); try { await NB().savePicture(sh, lines); } catch(err){ U.toast('Could not save the picture'); } return; }
      if(t.closest('[data-video]')){
        const b = t.closest('[data-video]');
        b.disabled = true;
        try { await NB().saveVideo(sh, lines, p => { b.textContent = 'Recording ' + Math.round(p * 100) + '%'; }); }
        catch(err){ U.toast(err.message || 'Could not make the video'); }
        b.disabled = false; b.textContent = 'Save video';
        return;
      }
      if(t.closest('[data-full]')) return fullScreen();
      if(t.closest('[data-music]')) return host.querySelector('[data-mfile]').click();
      if(t.closest('[data-nomusic]')){ sh.music = ''; sh.music_name = ''; sh.music_in = 0; sh.music_out = 0; save(); return render(); }
      if(t.closest('[data-playm]')){
        const a = await NB().playerFor(sh);
        if(!a){ if(/^https?:/i.test(sh.music)) window.open(sh.music, '_blank'); return; }
        if(a.paused){ if(sh.music_in > 0 && a.currentTime < sh.music_in) a.currentTime = sh.music_in; a.play(); } else a.pause();
        loop(); return setTimeout(render, 80);
      }
      if(t.closest('[data-inout]')){
        const a = await NB().playerFor(sh);
        if(a){ a.currentTime = sh.music_in; NB().setOut(sh.music_out); a.play(); loop(); setTimeout(render, 80); }
        return;
      }
      if(t.closest('[data-in]') || t.closest('[data-out]')){
        const st = NB().playState(sh);
        if(!st) return;
        const pos = Math.round(st.pos * 10) / 10;
        if(t.closest('[data-in]')){ sh.music_in = pos; if(sh.music_out <= pos) sh.music_out = 0; }
        else if(pos > sh.music_in) sh.music_out = pos;
        save(); return render();
      }
      const stp = t.closest('[data-step]');
      if(stp){
        if(+stp.dataset.step > 0 && sh.slots.length < NB().MAX_STEPS) sh.slots.push({ item:'', tone:'', text:'', role:'', done:false });
        if(+stp.dataset.step < 0 && sh.slots.length > 1) sh.slots.pop();
        save(); return render();
      }
      if(t.closest('[data-pickpal]')){
        const r = await NB().paletteFromSlots(sh);
        if(!r) return U.toast('Fill some spots with shots first');
        const pal = [...r.main, ...r.accents];
        while(pal.length < 7) pal.push(NB().FRAMES_PALETTE[pal.length]);
        sh.palette = pal;
        sh.fields.tone_note = `${r.family} tones\ndominant`;
        sh.fields.tone_pct = `${Math.round(r.share * 100)}% of pixels\nlean ${r.family}`;
        save(); U.toast('Palette picked from the frames'); return render();
      }
      if(t.classList.contains('pe-page')) return pageClick(e, t);
    });
    host.addEventListener('contextmenu', e => { if(e.target.classList.contains('pe-page')) slotMenu(e, e.target); });

    host.addEventListener('change', async e => {
      const sh = cur();
      if(!sh) return;
      const t = e.target;
      if(t.matches('[data-mfile]')){ const file = t.files && t.files[0]; if(file){ await NB().attachMusic(sh, file); save(); render(); } return; }
      if(t.matches('[data-name]')) sh.name = t.value;
      else if(t.matches('[data-mlink]')){ if(t.value.trim()){ sh.music = t.value.trim(); sh.music_name = ''; } }
      else if(t.matches('[data-mnote]')) sh.music_note = t.value;
      else if(t.matches('[data-f]')) sh.fields[t.dataset.f] = t.value;
      else if(t.matches('[data-secs]')) sh.seconds = Math.max(1, Math.min(30, +t.value || 5));
      else if(t.matches('[data-tone]')) sh.slots[+t.dataset.tone].tone = t.value;
      else if(t.matches('[data-sdone]')) sh.slots[+t.dataset.sdone].done = t.checked;
      else if(t.matches('[data-srole]')) sh.slots[+t.dataset.srole].role = t.value;
      else if(t.matches('[data-stext]')) sh.slots[+t.dataset.stext].text = t.value;
      else if(t.matches('[data-pc]') || t.matches('[data-ph]')){
        const i = +(t.dataset.pc || t.dataset.ph);
        const v = NB().parseHex(t.value);
        if(!v) return;
        sh.palette = ((sh.palette || []).length >= 7 ? sh.palette : NB().FRAMES_PALETTE).slice();
        sh.palette[i] = v;
      } else return;
      save();
      if(t.matches('[data-srole]') || t.matches('[data-tone]') || t.matches('[data-pc]') || t.matches('[data-ph]') || t.matches('[data-sdone]')) render();
      else { draw(); thumbs(); }
    });

    render();
    return { refresh:render, select:id => { selId = id; render(); } };
  }

  global.PagesEditor = { mount };
})(window);
