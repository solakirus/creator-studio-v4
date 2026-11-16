/* v4: ShotBoard (the "Storyboard" view) — the Templates' shot cards, for a real video's shots.

   Planning a day's sequence reads best as the Templates' Shots tab: a frame
   per shot, its role and length, shot type and move, THEN (how it cuts to the
   next one), notes, and a task sequence of up to nine more shots inside it.
   Until now that layout only existed on a template; an episode's sequence, a
   clip or a series video showed its shots as Steps beside a shot page.

   ShotBoard.mount(box, boardAdapter) shows the same shots that way.
   The adapter is ShotList.board(key) — 'clip:<id>', 'video:<id>' or
   'beat:<vlogId>:<beatId>' — which edits the record's own shot list, so the
   Steps, the Shoot tab, shoot mode and the Edit cut list all see the change.
   THEN is the shot's `tr`: a plain one (Dissolve, J-cut…) or one of your
   Eyecandy transitions (transitions.js), which the Edit tab can play.

   ShotBoard.view() is always 'board' — the episode screens show only the
   Storyboard; switchHTML() is empty and setView() does nothing. */
(function(global){
  const esc = s => U.esc(s);
  const VIEW_KEY = 'cs4-shots-view';
  /* the Storyboard is the only view of an episode's shots now — the Steps |
     Storyboard switch is gone (the Steps still live on tasks and in shoot mode) */
  const view = () => 'board';
  const setView = () => {};
  const switchHTML = () => '';

  const T = () => global.ShotTemplates || { ROLES:['Action', 'Insert', 'B-roll', 'Talking', 'Reaction', 'Transition'],
    SIZES:['—', 'Wide', 'Medium', 'Close-up'], MOVES:['—', 'Static', 'Handheld', 'Pan'], TRANSITIONS:['Cut', 'Dissolve'], DURATIONS:[1, 2, 3, 5, 10] };
  const fmt = s => global.Notebook && Notebook.fmtTime ? Notebook.fmtTime(s) : Math.round(s) + ' s';
  const dash = v => v && v !== '—' ? v : '';
  /* the Library on the laptop (and the iPad reading nastime's); the phone picks from Starred */
  const hasLib = () => !!(global.MediaLib && MediaLib.hasLibrary && MediaLib.hasLibrary());   /* every device has the Library now */
  const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  async function mount(box, A, o){
    o = o || {};
    if(!box || !A) return;
    let shots = (await A.load()) || [];
    let tt = 0;
    /* each card shows its frame and words; the rest folds under Details
       (one card at a time, or all of them — remembered on this device) */
    /* the shorts and clips a shot can be (Content → Clips) */
    let clips = new Map();
    const loadClips = async () => { try { clips = new Map(((await Store.all('clips')).values || []).map(c => [c.id, c])); } catch(e){} };
    await loadClips();
    const kindOf = c => /shorts|reels|tiktok|short/i.test(c.plat || c.format || '') ? 'Short' : 'Clip';
    function clipSheet(title){
      return new Promise(resolve => {
        let q = '';
        const list = () => [...clips.values()].filter(c => !q || (c.title || '').toLowerCase().includes(q))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 80);
        const rows = () => list().map(c => `<button class="row" data-pickclip="${esc(c.id)}"><span class="lbl">${esc(c.title || 'Untitled')}
            <small>${[kindOf(c), c.channel, global.Lifecycle && Lifecycle.stage ? Lifecycle.stage(c.stage || 'idea').label : ''].filter(Boolean).map(esc).join(' · ')}</small></span></button>`).join('')
          || '<p class="hintline" style="margin:6px 0">Nothing by that name — make it new below.</p>';
        App.sheet(`<h2 style="margin:0 0 4px">${esc(title)}</h2>
          <p class="hintline" style="margin:0 0 10px">A short or clip from Content → Clips. It stays its own clip; this shot points at it.</p>
          <input class="sb-q" type="search" placeholder="Find a short or clip" aria-label="Find a short or clip">
          <div class="group compact sb-clips" style="margin:8px 0 10px;max-height:44vh;overflow-y:auto">${rows()}</div>
          <div style="display:flex;gap:6px"><input class="sb-q" data-newclip placeholder="Or a new short — its title" aria-label="New short title" style="flex:1"><button class="btn-sm accent" data-mkclip>Make it</button></div>
          <div class="sheetcta"><button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
          sh.querySelector('.sb-q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); sh.querySelector('.sb-clips').innerHTML = rows(); });
          sh.addEventListener('click', async e => {
            if(e.target.closest('[data-no]')){ App.closeSheet(); return resolve(null); }
            const pc = e.target.closest('[data-pickclip]');
            if(pc){ App.closeSheet(); return resolve(clips.get(pc.dataset.pickclip) || null); }
            if(e.target.closest('[data-mkclip]')){
              const t = sh.querySelector('[data-newclip]').value.trim();
              if(!t) return U.toast('Give it a title');
              const c = await Data.saveClip({ title:t, state:'raw', stage:'idea', plat:'shorts', createdAt:Date.now() });
              await loadClips(); App.closeSheet(); return resolve(c);
            }
          });
        });
      });
    }
    const DET_KEY = 'cs4-sb-details';
    let allOpen = (() => { try { return localStorage.getItem(DET_KEY) === '1'; } catch(e){ return false; } })();
    const opened = new Set();
    const isOpen = s => allOpen || opened.has(s.id);
    const save = async () => { await A.save(shots); shots = (await A.load()) || shots; if(o.onChange) await o.onChange(); };
    const sel = (attr, list, v, title) => `<select class="lv-sel" ${attr} ${title ? `title="${title}"` : ''}>${list.map(x => `<option ${v === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;

    /* the script said over the shot — the same lines (VO / CAM / TXT) a
       clip's script, the Steps and shoot mode show */
    const SX = () => global.Structures || { KIND_SHORT:{ vo:'VO', cam:'CAM', txt:'TXT' }, KIND_NAME:{ vo:'VO', cam:'On cam', txt:'Text' }, KIND_NEXT:{ vo:'cam', cam:'txt', txt:'vo' } };
    function linesHTML(s, i){
      const ls = Array.isArray(s.lines) ? s.lines : [];
      return `<div class="sb-lines">${ls.map((l, j) => { const k = SX().KIND_SHORT[l.k] ? l.k : 'vo';
        return `<div class="sx-ln"><button class="sx-lk ${k}" data-sblk="${i}:${j}" title="Tap to change: VO voiceover → CAM said to camera → TXT words on screen" aria-label="${SX().KIND_NAME[k]} — tap to change">${SX().KIND_SHORT[k]}</button>${l.hook ? '<span class="sx-hook">HOOK</span>' : ''}
          <textarea class="sx-lt" rows="1" data-sblt="${i}:${j}" placeholder="${k === 'txt' ? 'Words on screen' : 'What is said over this shot'}">${esc(l.t || '')}</textarea>
          <button class="sx-lrm" data-sblrm="${i}:${j}" aria-label="Remove this line">×</button></div>`; }).join('')}
        <button class="sx-add" data-sbladd="${i}">+ Add a line</button></div>`;
    }
    const grow = ta => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };

    function thenSel(s, i){
      const tr = s.tr;
      const plain = T().TRANSITIONS.filter(x => x !== 'End');
      const cur = tr && tr.id ? 'ec:' + tr.id : tr && tr.n ? tr.n : 'Cut';
      return `<select class="lv-sel" data-then="${i}" title="How it cuts to the next shot">
        ${plain.map(x => `<option value="${esc(x)}" ${cur === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}
        ${tr && tr.n && !tr.id && !plain.includes(tr.n) ? `<option value="${esc(tr.n)}" selected>${esc(tr.n)}</option>` : ''}
        ${tr && tr.id ? `<option value="ec:${esc(tr.id)}" selected>⇄ ${esc(tr.n || 'Eyecandy')}</option>` : ''}
        ${global.Transitions ? '<option value="__ec">⇄ Eyecandy transitions…</option>' : ''}</select>`;
    }

    function draw(){
      if(!box.isConnected) return;
      const roles = shots.map(s => s.role).filter(Boolean);
      const miss = global.Notebook && Notebook.missingRoles ? Notebook.missingRoles(roles) : [];
      const total = shots.reduce((n, s) => n + (+s.secs || 0), 0);
      let start = 0;
      box.innerHTML = `<div class="sb${o.narrow ? ' narrow' : ''}">
        ${shots.length ? `<p class="hintline sb-sum">${[global.Notebook && Notebook.roleLine && roles.length ? esc(Notebook.roleLine(roles)) : '',
            miss.length ? `<span style="color:var(--red)">missing: ${esc(miss.join(', ').toLowerCase())}</span>` : '', total ? 'total ' + fmt(total) : '',
            `${shots.filter(s => s.done).length} of ${shots.length} filmed`].filter(Boolean).join(' · ')}
          <span class="sb-sumacts">${o.motion !== false && shots.some(s => s.item) && global.ShotList && ShotList.motionBtn ? ShotList.motionBtn() : ''}${A.host && !o.narrow ? `<button class="sb-shootall" data-sbshootall>▶ Shoot mode</button>` : ''}
          <button class="sb-alldet" data-sballdet aria-pressed="${allOpen}">${allOpen ? 'Hide details' : 'Show all details'}</button></span></p>` : ''}
        <div class="tp-shots">${shots.map((s, i) => {
          const s0 = start; start += Math.max(0, +s.secs || 0);
          const spec = [dash(s.framing), dash(s.movement)].filter(Boolean).join(' · ');
          const nseq = s.seq && s.seq.slots ? s.seq.slots.length : 0;
          return `<article class="tp-shot${s.done ? ' sb-done' : ''}" draggable="true" data-i="${i}">
            <div class="tp-shead"><b>${String(i + 1).padStart(2, '0')}</b><span class="sp">${esc(spec.toUpperCase())}</span>
              <small>${s.secs ? fmt(s0) + ' · ' + fmt(s.secs) : ''}</small>
              ${allOpen ? '' : `<button class="sb-tog" data-sbmore="${esc(s.id)}" aria-expanded="${isOpen(s)}" title="${isOpen(s) ? 'Fold the details' : 'Show the details'}">${isOpen(s) ? 'Less ⌃' : 'Details ⌄'}</button>`}</div>
            <div class="tp-frame${s.item ? '' : ' empty'}" data-sbframe="${i}">
              ${s.item ? `<span class="sb-pic" data-slpic="${esc(s.item)}"></span>` : ''}
              <i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
              ${s.role ? `<span class="tp-role">${esc(s.role.toUpperCase())}</span>` : ''}
              <span class="tp-hint">${s.item ? '↻ to change · ✕ to take off' : hasLib() ? 'Pick a frame from the Library' : 'Pick a starred frame'}</span>
              ${s.item ? `<span class="tp-facts"><button class="tp-fbtn" data-sbpick="${i}" title="Pick another frame" aria-label="Pick another frame">↻</button>
                <button class="tp-fbtn" data-sbclear="${i}" title="Take the frame off this shot" aria-label="Take the frame off this shot">✕</button></span>` : ''}
            </div>
            <input class="lv-in" data-sbf="text" data-i="${i}" value="${esc(s.text || '')}" placeholder="What happens in this shot">
            ${s.clip ? (() => { const c = clips.get(s.clip); return `<div class="sb-cliprow"><button class="sb-clip" data-sbclipopen="${esc(s.clip)}" title="Open it">▶ ${c ? `${kindOf(c)} · ${esc(c.title || 'Untitled')}` : 'A clip that isn’t on this device'}</button>
              <button class="lv-btn sm ghost" data-sbclipoff="${i}" title="Take it off this shot (the clip stays)" aria-label="Take the clip off this shot">✕</button></div>`; })() : ''}
            ${linesHTML(s, i)}
            ${(() => {
              /* a sequence inside the shot, and a reference video to recreate — set
                 ones get their own row, the ones still to add share a row */
              const seqSet = global.Notebook && nseq, refSet = global.RefClip && s.vref && s.vref.url;
              const seqRow = seqSet ? `<div class="sb-seqrow"><button class="sb-seq" data-sbseq="${i}" title="Open the shots inside this one">▦ Sequence · ${nseq} shot${nseq === 1 ? '' : 's'}${s.seq.slots.some(x => x.item) ? ` · ${s.seq.slots.filter(x => x.item).length} with frames` : ''}</button>
                  ${A.host ? `<button class="lv-btn sm ghost" data-sbshoot="${i}" title="Shoot mode from this shot: it, then the shots inside it, then the next">▶</button>` : ''}
                  <button class="lv-btn sm ghost" data-sbunseq="${i}" title="Take the sequence off (back to one picture)" aria-label="Take the sequence off">✕</button></div>` : '';
              const got = refSet && s.vref.clip;
              const refRow = refSet ? `<div class="rc-chip"><button class="rc-play" data-sbvplay="${i}" title="${got ? 'Play the grabbed copy' : 'Play just that section'}">${got && s.vref.gif ? `<span class="rc-gif" data-slpic="${esc(s.vref.gif)}"></span>` : '▶ '}Reference · ${esc(RefClip.site(s.vref.url))} · ${esc(RefClip.label(s.vref))}${got ? ' · grabbed' : ''}</button>
                  ${got ? `<button class="lv-btn sm ghost" data-sbvdrop="${i}" title="Delete the grabbed copy (the link stays)" aria-label="Delete the grabbed copy">🗑</button>`
                    : RefClip.canGrab() ? `<button class="lv-btn sm ghost" data-sbvgrab="${i}" title="Download just this section — plays here with no sign-in, as a 3-second GIF on the card" aria-label="Grab this section">⬇ Grab</button>` : ''}
                  <button class="lv-btn sm ghost" data-sbvedit="${i}" title="Change the link or the times" aria-label="Change the reference">✎</button></div>${s.vref.n ? `<p class="rc-n">${esc(s.vref.n)}</p>` : ''}` : '';
              const adds = [global.Notebook && !nseq ? `<button class="sb-seqadd" data-sbmkseq="${i}" title="Shots inside this shot — shoot mode runs through them, then goes on">▦ Add a sequence</button>` : '',
                global.RefClip && !refSet ? `<button class="sb-seqadd" data-sbvedit="${i}" title="A section of a video you want to recreate — from one time to another">＋ Reference video</button>` : ''].filter(Boolean);
              return seqRow + refRow + (adds.length ? `<div class="sb-adds">${adds.join('')}</div>` : '');
            })()}
            ${!isOpen(s) ? `<div class="sb-fold"><label class="tp-done" title="Filmed"><input type="checkbox" data-sbf="done" data-i="${i}" ${s.done ? 'checked' : ''}></label>
              <span class="sb-facts">${[s.role, s.secs ? fmt(s.secs) : '', s.desc || s.note ? '✎' : ''].filter(Boolean).map(esc).join(' · ') || '<i>Nothing set yet</i>'}</span>
              </div>` : `
            <div class="sb-more">
            <div class="lv-row"><span class="tp-drag" title="Drag to reorder">⠿</span>
              ${sel(`data-sbf="role" data-i="${i}"`, [''].concat(T().ROLES), s.role || '').replace('<option >', '<option value="">').replace(/<option( selected)?><\/option>/, `<option value=""$1>Role</option>`)}
              <select class="lv-sel" data-sbf="secs" data-i="${i}" title="How long it runs">${!s.secs ? '<option value="0" selected>—</option>' : ''}${T().DURATIONS.map(d => `<option value="${d}" ${+s.secs === d ? 'selected' : ''}>${fmt(d)}</option>`).join('')}
                ${s.secs && !T().DURATIONS.includes(+s.secs) ? `<option value="${s.secs}" selected>${fmt(s.secs)}</option>` : ''}</select>
              <label class="tp-done" title="Filmed"><input type="checkbox" data-sbf="done" data-i="${i}" ${s.done ? 'checked' : ''}></label></div>
            <input class="lv-in" data-sbf="desc" data-i="${i}" value="${esc(s.desc || '')}" placeholder="Description — what we see in it">
            <div class="lv-row">${sel(`data-sbf="framing" data-i="${i}"`, T().SIZES, s.framing || '—', 'Shot type')}
              ${sel(`data-sbf="movement" data-i="${i}"`, T().MOVES, s.movement || '—', 'Move')}</div>
            ${global.Devices ? `<div class="lv-row"><span class="tp-then">ON</span><button class="lv-btn sm ghost" data-sbdev="${i}" title="What it's shot on">${esc(s.dev || 'Pick a device')}</button>${s.off ? '<small style="color:#7FB6F5">▣ on the computer</small>' : ''}</div>` : ''}
            ${s.clip ? '' : `<div class="lv-row"><button class="lv-btn sm ghost" data-sbclip="${i}" title="This shot is a short or clip you made (or will make)">＋ Attach a short or clip</button></div>`}
            <textarea class="lv-in lv-ta" data-sbf="note" data-i="${i}" rows="2" placeholder="Notes: lens, audio, line…">${esc(s.note || '')}</textarea>
            <div class="lv-row tp-sfoot"><small></small>
              ${i > 0 ? `<button class="lv-btn sm ghost" data-sbmv="${i}" data-d="-1" title="Earlier" aria-label="Earlier">←</button>` : ''}
              ${i + 1 < shots.length ? `<button class="lv-btn sm ghost" data-sbmv="${i}" data-d="1" title="Later" aria-label="Later">→</button>` : ''}
              <button class="lv-btn sm ghost" data-sbdup="${i}" title="Duplicate" aria-label="Duplicate">⧉</button>
              <button class="lv-btn sm ghost" data-sbrm="${i}" title="Remove" aria-label="Remove">✕</button>
              </div>
            </div>`}
            ${i < shots.length - 1 ? `<div class="sb-then${s.tr && (s.tr.n || s.tr.id) ? ' set' : ''}"><span class="tp-then">THEN</span>${thenSel(s, i)}
              ${s.tr && s.tr.id ? `<button class="lv-btn sm ghost" data-sbwatch="${esc(s.tr.id)}" data-trn="${esc(s.tr.n || '')}" title="Watch it" aria-label="Watch the transition">▶</button>` : ''}</div>` : ''}
          </article>`; }).join('')}
          ${hasLib() ? `<button class="tp-addcard" data-sbframes><b>＋</b><span>Add frames from the Library</span></button>` : ''}
        </div>
        <div class="lv-row" style="margin-top:12px;flex-wrap:wrap"><button class="lv-btn ghost" data-sbempty title="Plan a shot you still have to film">＋ Empty shot</button>
          <button class="lv-btn ghost" data-sbaddclip title="A short or clip that plays in this sequence">＋ Short or clip</button></div>
      </div>`;
      box.querySelectorAll('.lv-ta').forEach(ta => { ta.style.height = 'auto'; ta.style.height = Math.max(46, ta.scrollHeight) + 'px'; });
      if(global.Structures && Structures.css) Structures.css();
      if(global.RefClip) RefClip.css();
      box.querySelectorAll('.sb-lines .sx-lt').forEach(grow);
      if(global.ShotList) ShotList.fillPics(box);
    }

    /* a frame for shot i: the Library on the laptop, Starred on the phone */
    async function pickFor(i){
      if(hasLib() && global.LibView){
        const u = await LibView.pick({ title:'Pick a frame for shot ' + (i + 1) });
        if(!u) return;
        shots[i].item = u;
        if(!shots[i].text && global.MediaLib){ try { const it = MediaLib.find(await MediaLib.load(), u); if(it) shots[i].text = it.label || it.name || ''; } catch(e){} }
        await save(); return draw();
      }
      if(global.StarPick) return StarPick.open({ title:'A frame for shot ' + (i + 1), clear:!!shots[i].item, onPick: async u => { shots[i].item = u || ''; await save(); draw(); } });
      U.toast('Pick frames on the laptop, or star some there first');
    }

    box.addEventListener('click', async e => {
      e.stopPropagation();
      const g = e.target;
      const dv = g.closest('[data-sbdev]');
      if(dv){ const i = +dv.dataset.sbdev; const d = await Devices.pick('Shot ' + (i + 1) + ' — shot on', shots[i].dev || ''); if(d === null) return; if(d) shots[i].dev = d; else delete shots[i].dev; await save(); return draw(); }
      const co = g.closest('[data-sbclipopen]');
      if(co) return Screens.push('clip', { id:co.dataset.sbclipopen, onChange: async () => { await loadClips(); draw(); } });
      const cf = g.closest('[data-sbclipoff]');
      if(cf){ delete shots[+cf.dataset.sbclipoff].clip; await save(); return draw(); }
      const ca = g.closest('[data-sbclip]');
      if(ca){ const i = +ca.dataset.sbclip; const c = await clipSheet(`A short or clip for shot ${i + 1}`); if(!c) return;
        shots[i].clip = c.id; if(!shots[i].text || /^Shot \d+$/.test(shots[i].text)) shots[i].text = c.title || shots[i].text; await save(); return draw(); }
      if(g.closest('[data-sbaddclip]')){
        const c = await clipSheet('Add a short or clip to this sequence');
        if(!c) return;
        shots.push({ id:uid(), text:c.title || 'Short', note:'', role:'', item:'', framing:'', movement:'', done:false, clip:c.id });
        await save(); return draw();
      }
      if(g.closest('[data-sbshootall]')){
        clearTimeout(tt); await A.save(shots);
        return Screens.push('shoot-run', { host:A.host(), onChange: async () => { shots = (await A.load()) || shots; draw(); if(o.onChange) await o.onChange(); } });
      }
      const wt = g.closest('[data-sbwatch]');
      if(wt && global.Transitions) return Transitions.peek(wt.dataset.sbwatch, wt.dataset.trn);
      const mo = g.closest('[data-sbmore]');
      if(mo){ const id = mo.dataset.sbmore; opened.has(id) ? opened.delete(id) : opened.add(id); return draw(); }
      if(g.closest('[data-sballdet]')){ allOpen = !allOpen; opened.clear(); try { localStorage.setItem(DET_KEY, allOpen ? '1' : '0'); } catch(err){} return draw(); }
      const la = g.closest('[data-sbladd]');
      if(la){
        const i = +la.dataset.sbladd; clearTimeout(tt);
        shots[i].lines = (Array.isArray(shots[i].lines) ? shots[i].lines : []).concat({ k:'vo', t:'' });
        const j = shots[i].lines.length - 1;
        await save(); draw();
        const f = box.querySelector(`[data-sblt="${i}:${j}"]`); if(f) f.focus();
        return;
      }
      const lk = g.closest('[data-sblk]');
      if(lk){
        const [i, j] = lk.dataset.sblk.split(':').map(Number), l = (shots[i].lines || [])[j];
        if(!l) return;
        l.k = SX().KIND_NEXT[l.k] || 'cam';
        lk.className = 'sx-lk ' + l.k; lk.textContent = SX().KIND_SHORT[l.k];
        const ta = lk.parentElement.querySelector('.sx-lt'); if(ta) ta.placeholder = l.k === 'txt' ? 'Words on screen' : 'What is said over this shot';
        clearTimeout(tt); await A.save(shots); if(o.onChange) await o.onChange();
        return;
      }
      const lr = g.closest('[data-sblrm]');
      if(lr){
        const [i, j] = lr.dataset.sblrm.split(':').map(Number);
        if(!shots[i].lines) return;
        shots[i].lines.splice(j, 1); clearTimeout(tt);
        await save(); return draw();
      }
      const pk = g.closest('[data-sbpick]');
      if(pk) return pickFor(+pk.dataset.sbpick);
      const cl = g.closest('[data-sbclear]');
      if(cl){ shots[+cl.dataset.sbclear].item = ''; await save(); return draw(); }
      const fr = g.closest('[data-sbframe]');
      if(fr){
        const s = shots[+fr.dataset.sbframe];
        if(s.seq && s.seq.slots) return openSeq(+fr.dataset.sbframe);
        if(s.item && hasLib() && global.LibView && LibView.view) return LibView.view(s.item);
        return pickFor(+fr.dataset.sbframe);
      }
      if(g.closest('[data-sbframes]')){
        const uids = await LibView.pick({ multi:true });
        if(!uids || !uids.length) return;
        const lib = await MediaLib.load();
        for(const u of uids){
          const it = MediaLib.find(lib, u);
          const ts = it && global.ShotTemplates ? await ShotTemplates.shotFromItem(lib, it) : null;
          shots.push({ id:uid(), text:(it && (it.label || it.name)) || '', note:'', role:ts ? ts.role : 'Action', item:u,
            framing:'', movement:'', done:false, ...(ts && ts.seconds ? { secs:ts.seconds } : {}) });
        }
        await save(); return draw();
      }
      if(g.closest('[data-sbempty]')){ /* named, so it survives a trip through the Steps (a nameless shot isn't one there) */
        shots.push({ id:uid(), text:'Shot ' + (shots.length + 1), note:'', role:'Action', item:'', framing:'Wide', movement:'Static', done:false, secs:3 }); await save(); draw();
        const ins = box.querySelectorAll('[data-sbf="text"]'); if(ins.length){ const f = ins[ins.length - 1]; f.focus(); f.select(); } return; }
      const mv = g.closest('[data-sbmv]');
      if(mv){ const i = +mv.dataset.sbmv, j = i + +mv.dataset.d; [shots[i], shots[j]] = [shots[j], shots[i]]; await save(); return draw(); }
      const dp = g.closest('[data-sbdup]');
      if(dp){ const i = +dp.dataset.sbdup; const c = JSON.parse(JSON.stringify(shots[i])); c.id = uid(); c.done = false; shots.splice(i + 1, 0, c); await save(); return draw(); }
      const rm = g.closest('[data-sbrm]');
      if(rm){
        const i = +rm.dataset.sbrm, was = shots[i];
        shots.splice(i, 1); await save(); draw();
        if(U.toastUndo) U.toastUndo('Shot ' + (i + 1) + ' removed', async () => { shots.splice(i, 0, was); await save(); draw(); });
        return;
      }
      const mk = g.closest('[data-sbmkseq]');
      if(mk) return seqSheet(+mk.dataset.sbmkseq);
      const vp = g.closest('[data-sbvplay]');
      if(vp){ const sh = shots[+vp.dataset.sbvplay]; return RefClip.play(sh.vref, sh.text || ''); }
      const vg = g.closest('[data-sbvgrab]');
      if(vg){
        const k = +vg.dataset.sbvgrab, sh = shots[k];
        vg.disabled = true; vg.textContent = 'Grabbing…';
        U.toast(`Grabbing ${RefClip.label(sh.vref)} — a minute or so`);
        try {
          const nv = await RefClip.grab(sh.vref, sh.text || 'Shot ' + (k + 1));
          const cur = shots.find(x => x.id === sh.id) || sh;
          cur.vref = nv; clearTimeout(tt); await save(); draw();
          U.toast('Grabbed — it plays here now, and goes 3 days after the episode is posted');
        } catch(err){ vg.disabled = false; vg.textContent = '⬇ Grab'; U.toast(err.message || 'Couldn’t grab it'); }
        return;
      }
      const vd = g.closest('[data-sbvdrop]');
      if(vd){
        const k = +vd.dataset.sbvdrop;
        shots[k].vref = await RefClip.drop(shots[k].vref); clearTimeout(tt); await save(); draw();
        return U.toast('Grabbed copy deleted — the link and times stay');
      }
      const ve = g.closest('[data-sbvedit]');
      if(ve){
        const k = +ve.dataset.sbvedit, sh = shots[k];
        const r = await RefClip.edit(sh.vref, sh.text || 'Shot ' + (k + 1));
        if(!r) return;
        clearTimeout(tt);
        const old = sh.vref || {};
        const same = r !== 'clear' && old.url === r.url && (old.start || 0) === r.start && (old.end || 0) === r.end;
        if(r === 'clear'){ if(old.clip || old.gif) await RefClip.drop(old); delete shots[k].vref; }
        else if(same) shots[k].vref = { ...r, ...(old.clip ? { clip:old.clip } : {}), ...(old.gif ? { gif:old.gif } : {}), ...(old.grabbedAt ? { grabbedAt:old.grabbedAt } : {}) };
        else { if(old.clip || old.gif) await RefClip.drop(old); shots[k].vref = r; }
        await save(); draw();
        if(r !== 'clear' && r.grabNow && !(shots[k].vref && shots[k].vref.clip)){
          const b = box.querySelector(`[data-sbvgrab="${k}"]`);
          if(b) return b.click();
        }
        return U.toast(r === 'clear' ? 'Reference taken off' : `Reference saved · ${RefClip.label(r)}`);
      }
      const sq = g.closest('[data-sbseq]');
      if(sq) return openSeq(+sq.dataset.sbseq);
      const sh = g.closest('[data-sbshoot]');
      if(sh){
        clearTimeout(tt); await A.save(shots);
        return Screens.push('shoot-run', { host:A.host(), at:+sh.dataset.sbshoot, onChange: async () => { shots = (await A.load()) || shots; draw(); if(o.onChange) await o.onChange(); } });
      }
      const us = g.closest('[data-sbunseq]');
      if(us){ delete shots[+us.dataset.sbunseq].seq; await save(); return draw(); }
    });
    box.addEventListener('change', async e => {
      const g = e.target;
      const th = g.closest('[data-then]');
      if(th){
        const i = +th.dataset.then, v = th.value;
        if(v === '__ec'){
          const r = await Transitions.pick({ title:`After shot ${i + 1}`, current:shots[i].tr });
          if(r && r !== 'clear') shots[i].tr = { id:r.id, n:r.title || Transitions.techName((r.tech || [])[0]) };
          else if(r === 'clear') delete shots[i].tr;
        } else if(v.startsWith('ec:')) return;
        else if(v === 'Cut') delete shots[i].tr;
        else shots[i].tr = { id:'', n:v };
        await save(); return draw();
      }
      const f = g.dataset && g.dataset.sbf;
      if(!f) return;
      const s = shots[+g.dataset.i];
      if(!s) return;
      if(f === 'done') s.done = g.checked;
      else if(f === 'secs') s.secs = +g.value || 0;
      else if(f === 'framing' || f === 'movement') s[f] = g.value === '—' ? '' : g.value;
      else s[f] = g.value;
      await save();
      if(['role', 'secs', 'framing', 'movement', 'done'].includes(f)) draw();
    });
    /* words save as you type, without redrawing under you */
    box.addEventListener('input', e => {
      const g = e.target;
      if(g.dataset && g.dataset.sblt != null){
        const [i, j] = g.dataset.sblt.split(':').map(Number), l = (shots[i].lines || [])[j];
        if(!l) return;
        l.t = g.value; grow(g);
        clearTimeout(tt); tt = setTimeout(async () => { await A.save(shots); if(o.onChange) await o.onChange(); }, 500);
        return;
      }
      if(!(g.dataset && ['text', 'note', 'desc'].includes(g.dataset.sbf))) return;
      shots[+g.dataset.i][g.dataset.sbf] = g.value;
      if(g.tagName === 'TEXTAREA'){ g.style.height = 'auto'; g.style.height = Math.max(46, g.scrollHeight) + 'px'; }
      clearTimeout(tt); tt = setTimeout(async () => { await A.save(shots); if(o.onChange) await o.onChange(); }, 500);
    });
    /* drag ⠿ to reorder */
    let from = -1;
    box.addEventListener('dragstart', e => { const c = e.target.closest('.tp-shot'); if(c && !e.target.closest('input,textarea,select')){ from = +c.dataset.i; e.dataTransfer.effectAllowed = 'move'; } });
    box.addEventListener('dragover', e => { const c = e.target.closest('.tp-shot'); if(c && from >= 0){ e.preventDefault(); box.querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); c.classList.add('drop'); } });
    box.addEventListener('drop', async e => {
      const c = e.target.closest('.tp-shot');
      if(!c || from < 0) return;
      e.preventDefault();
      const [s] = shots.splice(from, 1); shots.splice(+c.dataset.i, 0, s); from = -1;
      await save(); draw();
    });

    /* a sequence for a shot: a blank 9-shot page (the default), or a copy of
       one of your template pages — shoot mode runs the shot, then each shot
       inside it, then the next shot on the storyboard */
    async function seqSheet(i){
      const s = shots[i];
      const name = s.text || s.role || 'Shot ' + (i + 1);
      const opts = [];
      if(global.ShotTemplates) try {
        for(const t of await ShotTemplates.all()){
          const sh = (t.shots || []).filter(x => x.item || x.label || x.name);
          if(sh.length) opts.push({ t:t.name || 'Template', p:'its shot list', n:Math.min(sh.length, Notebook.MAX_STEPS || 9), make:() => ShotTemplates.pageFrom(t) });
          for(const pg of t.sheets || []) if((pg.slots || []).length) opts.push({ t:t.name || 'Template', p:pg.name || Notebook.layoutName(pg.layout) || 'Page', n:pg.slots.length, make:() => Notebook.copyNew(pg) });
          for(const x of t.shots || []) if(x.sequence && (x.sequence.slots || []).length) opts.push({ t:t.name || 'Template', p:(x.label || x.name || 'A shot') + '’s sequence', n:x.sequence.slots.length, make:() => Notebook.copyNew(x.sequence) });
        }
      } catch(e){}
      App.sheet(`<h2 style="margin:0 0 4px">A sequence inside “${esc(name)}”</h2>
        <p class="hintline" style="margin:0 0 12px">Shoot mode goes to this shot, through every shot inside it, then on to the next one.</p>
        <button class="vt-pick sb-seqopt" data-seqblank><b>▦ Blank 9-shot page</b><small>Nine spots to fill — frames, words, a tick for each</small></button>
        ${opts.length ? `<p class="lv-group" style="margin:14px 0 6px">Or one of your template pages</p>
          ${opts.map((o2, k) => `<button class="vt-pick sb-seqopt" data-seqtpl="${k}"><b>${esc(o2.t)} · ${esc(o2.p)}</b><small>${o2.n} shot${o2.n === 1 ? '' : 's'}</small></button>`).join('')}`
          : '<p class="hintline" style="margin:12px 0 0">Your template pages show here too — make them on the Templates tab.</p>'}
        <div class="sheetcta"><button class="btn-ghost" data-seqno>Cancel</button></div>`, sh => {
        sh.addEventListener('click', async ev => {
          if(ev.target.closest('[data-seqno]')) return App.closeSheet();
          const bl = ev.target.closest('[data-seqblank]'), tp = ev.target.closest('[data-seqtpl]');
          if(!bl && !tp) return;
          let q = bl ? Notebook.copyNew(Notebook.stepsPage(name)) : opts[+tp.dataset.seqtpl].make();
          if(!q) return U.toast('That page is empty');
          q = Notebook.copyNew(q);
          q.slots = (q.slots || []).map(x => ({ ...x, done:false }));
          if(bl) q.name = 'Sequence · ' + name;
          if(s.item && q.slots[0] && !q.slots[0].item) q.slots[0].item = s.item;
          s.seq = q; clearTimeout(tt);
          App.closeSheet(); await save(); draw();
          if(bl && global.PagesEditor) return openSeq(i);
          U.toast(`Sequence added — ${q.slots.length} shot${q.slots.length === 1 ? '' : 's'} inside “${name}”`);
        });
      });
    }

    function openSeq(i){
      const s = shots[i];
      Screens.push('shot-seq', { kicker:A.title(), title:s.text || 'Task sequence', page:s.seq,
        put: async page => { const cur = shots.find(x => x.id === s.id); if(cur){ cur.seq = page; await A.save(shots); } },
        onChange: async () => { shots = (await A.load()) || shots; draw(); } });
    }

    draw();
  }

  /* a shot's task sequence on its own page (the Templates' tpl-sequence, for any shot) */
  Screens.register('shot-seq', (el, params) => {
    if(!params.page){ el.innerHTML = Screens.bar({ title:'Task sequence' }) + '<div class="view"><div class="empty"><b>Gone</b>That sequence was removed.</div></div>'; return; }
    el.innerHTML = Screens.bar({ kicker:esc(params.kicker || ''), title:esc(params.title || 'Task sequence') }) + '<div class="view tp-root"><div id="sbSeqHost"></div></div>';
    const sheets = [params.page];
    PagesEditor.mount(el.querySelector('#sbSeqHost'), { sheets, single:true, tid:null, tasks:[], save: async () => {
      await params.put(sheets[0]);
      if(params.onChange) params.onChange();
    } });
  });

  const CSS = `
  .sb-switch{display:inline-flex;gap:2px;padding:2px;margin:0 0 10px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-1)}
  .sb-switch button{height:30px;padding:0 14px;border:0;border-radius:calc(var(--r) - 2px);background:transparent;color:var(--muted);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}
  .sb-switch button[aria-selected="true"]{background:var(--cream);color:#151515}
  .sb-sum{margin:0 0 12px}
  .sb .tp-frame .sb-pic{position:absolute;inset:0}
  .sb .tp-frame .sb-pic img,.sb .tp-frame .sb-pic video{width:100%;height:100%;object-fit:cover;display:block}
  .sb .tp-frame .sb-pic i{display:none}
  .tp-shot.sb-done .tp-shead b{color:var(--green)}
  .sb .tp-shot > .lv-in{flex:0 0 auto}
  .sb-sum{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px}
  .sb-sumacts{margin-left:auto;display:flex;gap:6px}
  .sb-shootall{height:28px;padding:0 12px;border:0;border-radius:var(--r);background:var(--orange);color:#151515;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer}
  .sb-tog{margin-left:4px;height:24px;padding:0 9px;border:1px solid var(--line);border-radius:12px;background:transparent;color:var(--muted);font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap}
  .sb-tog[aria-expanded="true"]{color:var(--cream);border-color:var(--muted)}
  .sb-alldet{height:26px;padding:0 10px;border:1px solid var(--line);border-radius:13px;background:transparent;color:var(--muted);font:inherit;font-size:12px;cursor:pointer}
  .sb-adds{display:flex;gap:6px;flex-wrap:wrap}
  .sb-seqrow{display:flex;align-items:center;gap:6px}
  .sb-seq{flex:1;min-width:0;height:32px;padding:0 10px;border:1px solid rgba(125,180,245,.45);border-radius:var(--r);background:rgba(125,180,245,.1);color:#9CC6F5;font:inherit;font-size:13px;font-weight:600;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sb-seqadd{align-self:flex-start;height:28px;padding:0 10px;border:1px dashed var(--line);border-radius:var(--r);background:transparent;color:var(--muted);font:inherit;font-size:12.5px;cursor:pointer}
  .sb-seqadd:hover{border-color:#9CC6F5;color:var(--cream)}
  .sb-seqopt{margin:0 0 7px}
  .sb-fold{display:flex;align-items:center;gap:8px;min-height:32px}
  .sb-facts{flex:1;min-width:0;font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sb-facts i{color:var(--dim);font-style:normal}
  .sb-more{display:flex;flex-direction:column;gap:6px}
  .sb.narrow .tp-shots{grid-template-columns:1fr;gap:12px}
  .sb-lines{display:flex;flex-direction:column;gap:5px;margin:2px 0 0}
  .sb-lines .sx-add{margin-top:1px}
  .sb-then{display:flex;align-items:center;gap:8px;margin-top:2px;padding:6px 8px;border:1px dashed var(--line);border-radius:var(--r)}
  .sb-then .lv-sel{flex:1;min-width:0;height:28px}
  .sb-then.set{border-style:solid;border-color:rgba(167,139,250,.45);background:rgba(167,139,250,.08)}
  .sb-then.set .tp-then{color:#C9B8FF}
  .sb-cliprow{display:flex;gap:6px;align-items:center}
  .sb-clip{flex:1;min-width:0;height:32px;padding:0 10px;border:1px solid rgba(91,190,106,.45);border-radius:var(--r);background:rgba(91,190,106,.08);color:var(--cream);font:inherit;font-size:13px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
  .sb-q{width:100%;height:38px;padding:0 10px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--cream);font:inherit}
  .sb.narrow .tp-addcard{min-height:64px}
  .sb-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .sb-head h4{margin:0}`;
  function css(){ if(document.getElementById('sb-css')) return; const st = document.createElement('style'); st.id = 'sb-css'; st.textContent = CSS; document.head.appendChild(st); }
  css();

  global.ShotBoard = { mount, view, setView, switchHTML };
})(window);
