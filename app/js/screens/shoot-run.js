/* Shoot mode — one shot at a time, full screen, while filming.

   Opens on a task's shot page (or its steps, when it has no page): the shot's
   GIF moving, clip playing or still filling the screen, its type and line big
   enough to read from behind a camera, what comes next underneath.

     Got it      marks the shot taken (the same tick as its step) and moves to
                 the next one not taken yet
     ‹  ›        back and on without ticking anything; swipe does the same
     tap picture hides everything but the picture, to frame against it
     keys        ← → move, Space or Enter is Got it, Esc closes (laptop)

   When every shot is in, it says so and offers to mark the task done.
   The screen stays awake while it is open (where the device allows).

     Screens.push('shoot-run', { id: taskId, at: shotIndex? }) */
(function(global){
  const esc = s => U.esc(s);   /* shared: util.js */

  /* the shots a task is shot by: its shot page's spots, or its steps */
  function shotsOf(t){
    if(t.page && Array.isArray(t.page.slots) && t.page.slots.length){
      if(global.TaskPages) TaskPages.match(t);
      return t.page.slots.map((sl, i) => {
        const step = (t.subs || []).find(s2 => s2.shot === i) || {};
        /* a spot with no frame: an episode shot's Reference Library still, if it has one */
        const sh = !sl.item && (t.shots || [])[i];
        const ref = sh ? (sh.angles || []).flatMap(a => a.refIds || [])[0] : null;
        return { i, item:sl.item || '', ref:ref || null, role:sl.role || '', text:sl.text || `Shot ${i + 1}`, note:step.note || sl.note || '', done:!!step.done };
      });
    }
    /* steps: an episode sequence's shots keep their Reference Library stills on
       t.shots[i].angles[].refIds — the first one is the shot's frame */
    return (t.subs || []).map((s2, i) => {
      const sh = (t.shots || [])[i];
      const ref = sh && (sh.angles || []).flatMap(a => a.refIds || [])[0];
      return { i, item:s2.frame || '', ref:ref || null, role:'', text:s2.t || `Step ${i + 1}`, note:s2.note || '', done:!!s2.done };
    });
  }

  /* tick one shot — the same rule as the task screen: a page spot ticks the
     steps standing for it; every step ticked makes the task done */
  async function setDone(id, i, v){
    const t = await Store.get('tasks', id);
    if(!t) return null;
    if(t.page && Array.isArray(t.page.slots) && t.page.slots.length){
      if(global.TaskPages) TaskPages.match(t);
      (t.subs || []).forEach(s2 => { if(s2.shot === i) s2.done = v; });
      if(t.page.slots[i]) t.page.slots[i].done = v;
    } else if(t.subs && t.subs[i]) t.subs[i].done = v;
    if((t.subs || []).length && t.subs.every(x => x.done)) t.view = 'done';
    else if(t.view === 'done') t.view = 'todo';
    await Store.put('tasks', t);
    if(global.Data && Data.invalidate) Data.invalidate('tasks');
    return t;
  }

  const CSS = `
  .screen.sr-screen{position:fixed;inset:0;z-index:5;background:#000;color:#EDE5D2;transform:none!important;transition:opacity .2s;opacity:0}
  .screen.sr-screen.in{opacity:1}
  .sr{position:absolute;inset:0;display:flex;flex-direction:column;user-select:none;-webkit-user-select:none}
  .sr-top{display:flex;align-items:center;gap:10px;padding:calc(var(--sat,0px) + 10px) 12px 8px;background:linear-gradient(#000d,#0000);position:relative;z-index:2}
  .sr-x{width:42px;height:42px;flex:0 0 42px;border:1px solid #ffffff33;border-radius:var(--r,4px);background:#00000066;color:#EDE5D2;font-size:20px;display:flex;align-items:center;justify-content:center}
  .sr-ttl{flex:1;min-width:0;font-family:var(--display),sans-serif;font-weight:900;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sr-n{font-family:var(--display),sans-serif;font-weight:900;font-size:15px;color:#FB6900}
  .sr-dots{display:flex;gap:3px;padding:0 12px 6px;position:relative;z-index:2}
  .sr-dots i{flex:1;height:4px;border-radius:2px;background:#ffffff26;cursor:pointer}
  .sr-dots i.done{background:#5BBE6A}.sr-dots i.on{background:#FB6900}
  .sr-pic{flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;background:#000;touch-action:pan-y}
  .sr-holdtip{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);background:rgba(0,0,0,.55);color:#ddd;font-size:12px;padding:4px 10px;border-radius:99px;pointer-events:none;white-space:nowrap}
  .sr.clean .sr-holdtip{display:none}
  .sr-pic img,.sr-pic video{max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;display:block}
  .sr-none{text-align:center;padding:24px;color:#969185}
  .sr-none b{display:block;font-family:var(--display),sans-serif;font-weight:900;font-size:44px;color:#EDE5D2;margin-bottom:6px}
  .sr-taken{position:absolute;top:12px;right:12px;background:#5BBE6A;color:#151515;font-family:var(--display),sans-serif;font-weight:900;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:5px 9px;border-radius:3px}
  .sr-cap{padding:12px 16px 4px;background:#151515;border-top:1px solid #2F2C26}
  .sr-k{font-family:var(--display),sans-serif;font-weight:900;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#FB6900;margin:0}
  .sr-t{font-family:var(--display),sans-serif;font-weight:900;font-size:clamp(22px,4.6vw,40px);line-height:1.12;margin:4px 0 0}
  .sr-note{color:#969185;font-size:15px;margin:6px 0 0}
  .sr-next{display:flex;align-items:center;gap:10px;margin:10px 0 0;color:#969185;font-size:13.5px;min-height:44px}
  .sr-next .th{width:36px;height:44px;flex:0 0 36px;border-radius:3px;overflow:hidden;background:#27241F}
  .sr-next .th img,.sr-next .th video{width:100%;height:100%;object-fit:cover;display:block}
  .sr-next b{color:#EDE5D2;font-weight:600}
  .sr-bar{display:grid;grid-template-columns:64px 1fr 64px;gap:10px;padding:10px 16px calc(var(--sab,0px) + 14px);background:#151515}
  .sr-bar button{height:58px;border-radius:var(--r,4px);border:1px solid #2F2C26;background:#1F1C17;color:#EDE5D2;font-size:24px}
  .sr-bar button:disabled{opacity:.3}
  .sr-bar .sr-go{background:#FB6900;border-color:#FB6900;color:#151515;font-family:var(--display),sans-serif;font-weight:900;font-size:19px;box-shadow:4px 4px 0 #0A0806}
  .sr-bar .sr-go.undo{background:#1F1C17;color:#5BBE6A;border-color:#5BBE6A;box-shadow:none}
  .sr.clean .sr-top,.sr.clean .sr-dots,.sr.clean .sr-cap,.sr.clean .sr-bar{display:none}
  .sr-all{position:absolute;inset:0;z-index:3;background:#151515f2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center}
  .sr-all h2{font-family:var(--display),sans-serif;font-weight:900;font-size:34px;margin:0}
  .sr-all p{color:#969185;margin:0 0 10px}
  .sr-all button{min-width:240px;height:52px;border-radius:var(--r,4px);border:1px solid #2F2C26;background:#1F1C17;color:#EDE5D2;font-size:16px}
  .sr-all .sr-go{background:#FB6900;border-color:#FB6900;color:#151515;font-family:var(--display),sans-serif;font-weight:900}
  @media (min-width:900px){ .sr-cap{padding:14px 28px 6px} .sr-bar{grid-template-columns:90px minmax(240px,420px) 90px;justify-content:center} }`;

  /* swap one shot's frame on this task (the template it came from stays) */
  async function setFrame(id, i, uid){
    const t = await Store.get('tasks', id);
    if(!t) return null;
    if(t.page && Array.isArray(t.page.slots) && t.page.slots[i]) t.page.slots[i].item = uid || '';
    else if(t.subs && t.subs[i]) t.subs[i].frame = uid || '';
    await Store.put('tasks', t);
    if(global.Data && Data.invalidate) Data.invalidate('tasks');
    return t;
  }

  async function mount(el, params){
    if(!document.getElementById('sr-css')){ const st = document.createElement('style'); st.id = 'sr-css'; st.textContent = CSS; document.head.appendChild(st); }
    el.classList.add('sr-screen');
    /* v4: any shot list can be shot — an episode's sequence, a clip, a series
       video (shotlist.js passes params.list: { title, shots(), setDone(i, v),
       setFrame(i, uid), swapNote }); otherwise it's a task (params.id) */
    const L = params.list || null;
    const id = params.id;
    let t = L ? { title:L.title || 'Shots' } : await Store.get('tasks', id);
    if(!t){ el.innerHTML = '<div class="sr"><div class="sr-pic"><div class="sr-none"><b>Gone</b>This task isn’t here any more.</div></div></div>'; return; }
    let shots = L ? await L.shots() : shotsOf(t);
    if(!shots.length){ el.innerHTML = `<div class="sr"><div class="sr-top"><button class="sr-x" data-x>✕</button></div><div class="sr-pic"><div class="sr-none"><b>No shots</b>${L ? 'Add a shot to the list first.' : 'Add steps or a shot page to this task first.'}</div></div></div>`;
      el.querySelector('[data-x]').onclick = () => Screens.pop(); return; }
    const firstOpen = () => { const k = shots.findIndex(s => !s.done); return k < 0 ? 0 : k; };
    let at = params.at != null && shots[params.at] ? params.at : firstOpen();
    let clean = false, allShown = false;

    let lib = null;
    try { lib = global.MediaLib ? await MediaLib.load() : null; } catch(e){ lib = null; }
    const media = async s => {
      if(!s.item && s.ref && global.Refs){
        const r = await Refs.get(s.ref).catch(() => null);
        const u = r ? await Refs.src(s.ref, r).catch(() => null) : null;
        return u ? { kind: r.kind === 'video' ? 'video' : 'image', url:u } : null;
      }
      if(!s.item || !lib) return null;
      const it = MediaLib.find(lib, s.item);
      if(!it) return null;
      const u = await MediaLib.url(it).catch(() => null);
      return u ? { kind:it.kind, url:u } : null;
    };
    const picHTML = (m, small) => !m ? '' : m.kind === 'video'
      ? `<video src="${esc(m.url)}" ${small ? '' : 'autoplay'} muted loop playsinline preload="${small ? 'metadata' : 'auto'}"></video>`
      : `<img src="${esc(m.url)}" alt="">`;

    /* keep the screen on while shooting */
    let lock = null;
    const wake = async () => { try { if(navigator.wakeLock && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch(e){ lock = null; } };
    wake();
    const onVis = () => { if(document.visibilityState === 'visible' && el.isConnected) wake(); };
    document.addEventListener('visibilitychange', onVis);

    const nextAfter = k => { for(let j = 1; j <= shots.length; j++){ const n = (k + j) % shots.length; if(!shots[n].done) return n; } return -1; };

    async function render(){
      const s = shots[at];
      const nx = nextAfter(at);
      const [m, mn] = await Promise.all([media(s), nx >= 0 && nx !== at ? media(shots[nx]) : null]);
      const doneN = shots.filter(x => x.done).length;
      el.innerHTML = `<div class="sr${clean ? ' clean' : ''}">
        <div class="sr-top"><button class="sr-x" data-x aria-label="Close shoot mode">✕</button>
          <div class="sr-ttl">${esc(t.title)}</div><div class="sr-n">${at + 1} / ${shots.length}</div></div>
        <div class="sr-dots">${shots.map((x, k) => `<i class="${x.done ? 'done' : ''}${k === at ? ' on' : ''}" data-go="${k}" title="Shot ${k + 1}"></i>`).join('')}</div>
        <div class="sr-pic" data-pic>${m ? picHTML(m) : `<div class="sr-none"><b>${at + 1}</b>No reference frame for this shot</div>`}
          ${s.done ? '<span class="sr-taken">✓ Taken</span>' : ''}
          ${at === 0 && global.StarPick ? '<span class="sr-holdtip">Tap: clean view · Hold: swap the frame</span>' : ''}</div>
        <div class="sr-cap">
          <p class="sr-k">Shot ${at + 1}${s.role ? ' · ' + esc(s.role) : ''}</p>
          <p class="sr-t">${esc(s.text)}</p>
          ${s.note ? `<p class="sr-note">${esc(s.note)}</p>` : ''}
          <div class="sr-next">${nx >= 0 && nx !== at ? `${mn ? `<span class="th">${picHTML(mn, true)}</span>` : ''}<span>Up next · <b>${nx + 1}. ${esc(shots[nx].text)}</b></span>`
            : doneN === shots.length ? '<span>Every shot is taken</span>' : '<span>This is the last one left</span>'}</div>
        </div>
        <div class="sr-bar">
          <button data-prev aria-label="Previous shot" ${at === 0 ? 'disabled' : ''}>‹</button>
          <button class="sr-go${s.done ? ' undo' : ''}" data-got>${s.done ? '✓ Taken — undo' : 'Got it'}</button>
          <button data-next aria-label="Next shot" ${at === shots.length - 1 ? 'disabled' : ''}>›</button>
        </div>
        ${allShown ? `<div class="sr-all"><h2>All ${shots.length} shots taken</h2><p>${esc(t.title)}</p>
          ${t.view === 'done' ? '<p>The task is ticked off too.</p>' : ''}
          <button class="sr-go" data-x>Back to the task</button><button data-review>Look through them again</button></div>` : ''}
      </div>`;
      /* hold the picture to swap it for another starred frame — today only */
      const pic = el.querySelector('[data-pic]');
      if(pic && global.StarPick) U.onHold(pic, () => {
        const s2 = shots[at];
        StarPick.open({ title:`Shot ${at + 1} — swap its frame for today`, clear:!!s2.item, onPick: async uid => {
          if(L){ await L.setFrame(s2.i, uid); shots = await L.shots(); await render(); if(L.swapNote && uid) U.toast(L.swapNote); return; }
          const fresh = await setFrame(id, s2.i, uid);
          if(fresh){ t = fresh; shots = shotsOf(t); }
          await render();
          if(t.pageFrom && t.pageFrom.template) U.toast(`Swapped for today — “${t.pageFrom.template}” stays as it is`);
        } });
      });
    }

    const go = k => { if(k < 0 || k >= shots.length) return; at = k; render(); };
    async function got(){
      const s = shots[at];
      const v = !s.done;
      if(L){ await L.setDone(s.i, v); shots = await L.shots(); }
      else {
        const fresh = await setDone(id, s.i, v);
        if(fresh){ t = fresh; shots = shotsOf(t); }
      }
      if(!v) return render();
      if(navigator.vibrate) try { navigator.vibrate(30); } catch(e){}
      const n = nextAfter(at);
      if(n < 0){ allShown = true; return render(); }
      at = n; render();
    }

    el.addEventListener('click', e => {
      if(e.target.closest('[data-x]')) return Screens.pop();
      if(e.target.closest('[data-review]')){ allShown = false; at = 0; return render(); }
      if(e.target.closest('[data-got]')) return got();
      if(e.target.closest('[data-prev]')) return go(at - 1);
      if(e.target.closest('[data-next]')) return go(at + 1);
      const d = e.target.closest('[data-go]'); if(d) return go(+d.dataset.go);
      if(e.target.closest('[data-pic]')){ clean = !clean; el.querySelector('.sr').classList.toggle('clean', clean); }
    });
    /* swipe between shots */
    let sx = null, sy = 0;
    el.addEventListener('touchstart', e => { const p = e.touches[0]; sx = p.clientX; sy = p.clientY; }, { passive:true });
    el.addEventListener('touchend', e => {
      if(sx == null) return;
      const p = e.changedTouches[0], dx = p.clientX - sx, dy = p.clientY - sy;
      sx = null;
      if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) go(at + (dx < 0 ? 1 : -1));
    }, { passive:true });
    const onKey = e => {
      if(!el.isConnected){ document.removeEventListener('keydown', onKey); return; }
      if(/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return;
      if(e.key === 'ArrowRight') go(at + 1);
      else if(e.key === 'ArrowLeft') go(at - 1);
      else if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); got(); }
      /* Esc: screens.js already closes the top screen — popping here too closed two */
    };
    document.addEventListener('keydown', onKey);
    /* let go of the screen lock and listeners once closed */
    const mo = new MutationObserver(() => { if(!el.isConnected){ mo.disconnect(); document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis); try { lock && lock.release(); } catch(e){}
      /* the screen underneath shows the ticks made here */
      try { params.onChange && params.onChange(); } catch(e){} } });
    mo.observe(document.getElementById('screens') || document.body, { childList:true });

    await render();
  }

  Screens.register('shoot-run', mount);
  global.ShootRun = { shotsOf, setDone, setFrame, open: (id, at) => Screens.push('shoot-run', { id, at }) };
})(window);
