/* Session — draft, live, and the saved summary. Finishing writes to `sessions`. */
(function(){
  const { pad, ICON, generatedArt } = U;

  const TEMPLATE = () => ({
    name:"Legs workout",
    exercises:[
      { id:"back-squat", name:"Back squat", rest:180,
        sets:[{kg:60,reps:5},{kg:60,reps:5},{kg:60,reps:5},{kg:60,reps:5},{kg:60,reps:5}] },
      { id:"leg-press", name:"Leg press", rest:150,
        sets:[{kg:120,reps:10},{kg:120,reps:11},{kg:120,reps:10}] }
    ]
  });

  const SVG = {
    play:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor"/></svg>',
    x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h4l1.5-2h7L17 7h4v12H3z"/><circle cx="12" cy="13" r="3.4"/></svg>',
    timer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5"/></svg>',
    help:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.7-.9 1.3v.5M12 16.5v.01"/></svg>',
    pencil:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14.5 6.5l3 3"/></svg>'
  };

  let root, session, mode, doneCount, startedAt, lastSaved, history = [], art = {}, pendingArt = null;
let tick = null, restFrom = null, unit = 'lb';

const hms = ms => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return pad(Math.floor(t / 60)) + ':' + pad(t % 60);
};
function startTick(){
  stopTick();
  tick = setInterval(() => {
    const c = root && root.querySelector('.clock.live');
    if(c) c.innerHTML = '<i></i>' + hms(Date.now() - startedAt);
    const r = root && root.querySelector('[data-rest]');
    if(r && restFrom){
      const ex = session.exercises.find(x => x.id === r.dataset.rest);
      const el2 = Math.floor((Date.now() - restFrom) / 1000);
      r.querySelector('b').textContent =
        Math.floor(el2 / 60) + ':' + pad(el2 % 60) + '/' + Math.floor(ex.rest / 60) + ':' + pad(ex.rest % 60);
    }
  }, 1000);
}
function stopTick(){ if(tick){ clearInterval(tick); tick = null; } }

  const totalSets = () => session.exercises.reduce((n,e) => n + e.sets.length, 0);
  const artFor = ex => art[ex.id] ? `url(${art[ex.id]})` : generatedArt(ex.id, ex.name, 360, 168);

  async function loadArt(){
    try {
      const blobs = await Store.allMap('exercise-art');
      Object.values(art).forEach(URL.revokeObjectURL);
      art = {};
      Object.entries(blobs).forEach(([k,b]) => art[k] = URL.createObjectURL(b));
    } catch(e){ console.warn('Exercise art unavailable', e); }
  }

  function buildRecord(){
    const now = Date.now();
    let n = 0;
    const exercises = session.exercises.map((ex, order) => ({
      order: order + 1, name: ex.name, id: ex.id, restSec: ex.rest,
      sets: ex.sets.map((s,i) => ({ set:i+1, kg:s.kg, reps:s.reps, done:(n++) < doneCount }))
    }));
    const completed = exercises.flatMap(e => e.sets).filter(s => s.done);
    return {
      id:'ws_' + now, name:session.name, startedAt:startedAt || now, finishedAt:now,
      durationSec: Math.round((startedAt ? now - startedAt : 0) / 1000),
      setsCompleted: completed.length, setsPlanned: totalSets(),
      volumeKg: completed.reduce((v,s) => v + s.kg * s.reps, 0),
      exercises
    };
  }

  /* ---------- markup ---------- */
  function bar(){
    const live = mode === 'live';
    if(mode === 'saved'){
      return `<header class="sess-bar">
        <button class="sess-x" data-pop aria-label="Close">${SVG.x}</button>
        <div class="sess-mid"><p class="kick" style="font-family:var(--display);font-weight:900;font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--dim);margin:0 0 1px">Complete</p>
          <h1>${lastSaved.name}</h1></div></header>`;
    }
    return `<header class="sess-bar">
      <button class="sess-x" data-pop aria-label="Close">${SVG.x}</button>
      <div class="sess-mid">
        <p class="kick" style="font-family:var(--display);font-weight:900;font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--dim);margin:0 0 1px">${live ? 'Live session' : 'Draft'}</p>
        <h1>${session.exercises.length ? session.name : 'New session'}</h1>
        ${live ? '' : '<div class="titlerule"></div>'}
      </div>
      ${live ? '' : `<span style="width:22px;height:22px;color:var(--muted)">${SVG.pencil}</span>`}
      <span class="clock${live ? ' live' : ''}">${live ? '<i></i>' + hms(Date.now() - startedAt) : '--:--'}</span>
    </header>`;
  }

  function setRow(s, i, state){
    return `<div class="set ${state}">
      <span class="setno">${i+1}</span>
      <span class="step"><button data-step="kg-" data-i="${i}">−</button>
        <span class="v"><b>${Units.fmt(s.kg, unit)}</b><span>${Units.label(unit)}</span></span>
        <button data-step="kg+" data-i="${i}">+</button></span>
      <span class="step"><button data-step="rep-" data-i="${i}">−</button>
        <span class="v"><b>${s.reps}</b><span>REPS</span></span>
        <button data-step="rep+" data-i="${i}">+</button></span>
      <button class="chk" aria-label="Mark set done">${ICON.check}</button>
    </div>`;
  }

  /* which exercises have a demo, refreshed whenever the session renders */
  let DEMOS = {};
  async function loadDemos(){
    const ids = session.exercises.map(e => e.id);
    for(const id of ids) DEMOS[id] = await Exercises.demoFor(id);
  }

  function exerciseHTML(ex, n, total, counter){
    const live = mode === 'live';
    const startIdx = counter.i;
    let rows = '';
    ex.sets.forEach((s,i) => {
      let state = '';
      if(live){
        if(counter.i < doneCount) state = 'done';
        else if(counter.i === doneCount) state = 'now';
        counter.i++;
      }
      rows += setRow(s, i, state);
    });
    const hasActive = live && doneCount >= startIdx && doneCount < counter.i;
    const footer = live
      ? (hasActive
          ? `<div class="restbar" data-rest="${ex.id}">${SVG.timer}<span class="t">Resting <b>0:00/${Math.floor(ex.rest/60)}:${pad(ex.rest%60)}</b></span><button class="skip" data-a="skip">SKIP ›</button></div>`
          : `<div class="restidle">${SVG.timer} Rest · ${ex.rest}s</div>`)
      : `<div class="setbtns"><button data-sets="-" data-ex="${ex.id}">− Set</button><button data-sets="+" data-ex="${ex.id}">+ Set</button></div>`;

    return `<section class="ex" data-ex="${ex.id}">
      <div class="exart" style="background-image:${artFor(ex)}">
        <span class="idx">${pad(n)} <span>OF ${pad(total)}</span></span>
        <button class="exbtn cam" data-art="${ex.id}" aria-label="Change image">${SVG.cam}</button>
        <button class="exbtn demo${DEMOS[ex.id] ? ' has' : ''}" data-demo="${ex.id}"
          aria-label="Watch the movement">${DEMOS[ex.id] ? SVG.play : SVG.help}</button>
        <button class="exbtn close" data-remove="${ex.id}" aria-label="Remove">${SVG.x}</button>
        <h2>${ex.name}</h2>
      </div>
      <div class="thead"><span>Set</span><span>KG</span><span>Reps</span><span>Done</span></div>
      ${rows}${footer}
    </section>`;
  }

  function body(){
    if(mode === 'saved'){
      const r = lastSaved, m = Math.floor(r.durationSec/60), sec = r.durationSec % 60;
      return `<div class="view">
        <div class="done-hero"><span class="tick">${ICON.check}</span>
          <b>Session saved</b><p>${r.name} · ${new Date(r.finishedAt).toLocaleDateString()}</p></div>
        <div class="sum">
          <div class="sumcell"><b>${r.setsCompleted}</b><span>Sets</span></div>
          <div class="sumcell"><b>${Math.round(Units.toDisplay(r.volumeKg, unit)).toLocaleString()}</b><span>Volume ${unit}</span></div>
          <div class="sumcell"><b>${m}:${pad(sec)}</b><span>Duration</span></div>
        </div>
        <div class="hist"><div class="hrow" style="border:0"><span class="n" style="color:var(--muted)">Export lives in Progress, in the console.</span></div>
          ${history.slice(0,6).map(h => { const d = new Date(h.finishedAt);
            return `<div class="hrow"><span class="d">${pad(d.getMonth()+1)}/${pad(d.getDate())}</span>
              <span class="n">${h.name} · ${h.setsCompleted} sets</span>
              <span class="v">${Math.round(Units.toDisplay(h.volumeKg, unit)).toLocaleString()} ${unit}</span></div>`; }).join('')}
        </div></div>`;
    }
    if(!session.exercises.length){
      return `<div class="view"><button class="addex" style="width:100%;cursor:pointer;color:var(--cream)" data-a="pick">
        <div class="plus">+</div>
        <b>Add first exercise</b><p>Pick from the library, or start with a quick template.</p></button></div>`;
    }
    let html = '';
    if(mode === 'live'){
      const total = totalSets();
      html += `<div class="progwrap">
        <div class="progtop"><span class="caps muted" style="font-size:13.5px">Progress · let's go.</span>
          <span class="r">${doneCount}/${total} sets</span></div>
        <div class="blocks">${Array.from({length:total},(_,i) =>
          `<i class="${i < doneCount ? 'done' : i === doneCount ? 'now' : ''}"></i>`).join('')}</div></div>`;
    }
    /* The shape of the session, so a week of nothing but pressing is visible
       before it becomes a shoulder problem. */
    if(mode !== 'live'){
      const cov = Exercises.coverage(session.exercises);
      if(cov.length){
        const top = cov[0].score;
        html += `<div class="cov">
          <p class="cap">What this session hits</p>
          ${cov.map(m => `<div class="row" style="--mc:${m.c}">
            <span class="nm">${m.n}</span>
            <span class="bar"><i style="width:${Math.round((m.score / top) * 100)}%"></i></span>
            <span class="n">${m.score}</span>
          </div>`).join('')}
        </div>`;
      }
    }

    const counter = { i:0 };
    html += session.exercises.map((ex,i) => exerciseHTML(ex, i+1, session.exercises.length, counter)).join('');
    if(mode !== 'live'){
      html += `<button class="addex" style="width:100%;cursor:pointer;color:var(--cream);padding:22px 18px" data-a="pick">
        <div class="plus" style="width:44px;height:44px;font-size:24px;margin-bottom:10px">+</div>
        <b style="font-size:20px;margin:0">Add another exercise</b></button>`;
    }
    return `<div class="view">${html}</div>`;
  }

  function foot(){
    if(mode === 'saved')
      return `<div class="screenfoot two"><button class="fbtn ghost" data-pop>Back to console</button>
        <button class="fbtn cream" data-pop>Done</button></div>`;
    if(mode === 'live')
      return `<div class="screenfoot two"><button class="fbtn cream" data-a="pause">Pause</button>
        <button class="fbtn orange" data-a="finish">${ICON.check} Finish workout</button></div>`;
    return `<div class="screenfoot two"><button class="fbtn ghost" data-pop>Discard</button>
      <button class="fbtn cream" data-a="start" ${session.exercises.length?'':'disabled'}>Start workout</button></div>
      ${session.exercises.length ? `<div style="padding:0 calc(var(--gutter) + var(--sar)) 10px calc(var(--gutter) + var(--sal))">
        <button class="btn-ghost" data-a="saveroutine" style="width:100%">
          ${session.routineId ? 'Save over this routine' : 'Save as a routine'}</button>
      </div>` : ''}`;
  }

  function render(){
    root.innerHTML = bar() + body() + foot();
    /* the play glyph appears once we know there is something to play */
    loadDemos().then(() => {
      session.exercises.forEach(ex => {
        const b = root.querySelector(`[data-demo="${ex.id}"]`);
        if(b) b.classList.toggle('has', !!DEMOS[ex.id]);
      });
    });
  }

  /* ---------- events ---------- */
  function wire(){
    root.addEventListener('click', async e => {
      /* saving the routine before anything else, since it shares the data-a hook */
      if(e.target.closest('[data-a="saveroutine"]')){
        const existing = session.routineId ? await Routines.get(session.routineId) : null;
        App.sheet(`
          <h2>${existing ? 'Save over it' : 'Save as a routine'}</h2>
          <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.6">
            Saves the lifts, sets and reps — not the weights. Running it later uses whatever
            you are lifting at the time.</p>
          <div class="field"><label for="sr-n">Name</label>
            <input id="sr-n" type="text"
              value="${(existing ? existing.name : (session.name || '')).replace(/"/g,'&quot;')}"
              placeholder="Push day"></div>
          <div class="sheetcta">
            <button class="btn-primary" data-save>Save</button>
            <button class="btn-ghost" data-cancel>Cancel</button>
          </div>`, sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-save]')) return;
            const name = sheetEl.querySelector('#sr-n').value.trim();
            if(!name) return U.toast('Name it first');
            const built = Routines.fromSession(session, name);
            const saved = await Routines.save(existing ? { ...existing, ...built, id:existing.id } : built);
            session.routineId = saved.id;
            session.name = name;
            App.closeSheet();
            U.toast('Saved to your workouts');
            onChange && onChange();
            render();
          });
          setTimeout(() => { const f = sheetEl.querySelector('#sr-n'); if(f) f.focus(); }, 180);
        });
        return;
      }

      const cam = e.target.closest('[data-art]');
      if(cam){
        pendingArt = cam.dataset.art;
        App.pickImage(async file => {
          try { await Store.put('exercise-art', file, pendingArt); await loadArt(); }
          catch(err){ console.error(err); U.toast("Couldn't save that image"); }
          pendingArt = null; render();
        });
        return;
      }
      const dm = e.target.closest('[data-demo]');
      if(dm){
        const ex = session.exercises.find(x => x.id === dm.dataset.demo);
        if(!ex) return;
        /* your own GIF plays over the workout; without one, fall back to the web */
        const src = await Exercises.demoFor(ex.id);
        if(src) return DemoPlay.show(ex.id, ex.name);
        window.open(ex.demo || ('https://www.youtube.com/results?search_query=' +
          encodeURIComponent(ex.name + ' proper form')), '_blank');
        return;
      }

      const rm = e.target.closest('[data-remove]');
      if(rm){ session.exercises = session.exercises.filter(x => x.id !== rm.dataset.remove); render(); return; }

      const setBtn = e.target.closest('[data-sets]');
      if(setBtn){
        const ex = session.exercises.find(x => x.id === setBtn.dataset.ex);
        if(setBtn.dataset.sets === '+') ex.sets.push({ ...ex.sets[ex.sets.length-1] || { kg:20, reps:8 } });
        else if(ex.sets.length > 1) ex.sets.pop();
        render(); return;
      }
      const step = e.target.closest('[data-step]');
      if(step){
        const ex = session.exercises.find(x => x.id === step.closest('.ex').dataset.ex);
        const s = ex.sets[+step.dataset.i], k = step.dataset.step;
        const inc = Units.toKg(Units.step(unit), unit);
        if(k === 'kg+') s.kg += inc;
        if(k === 'kg-') s.kg = Math.max(0, s.kg - inc);
        if(k === 'rep+') s.reps += 1;
        if(k === 'rep-') s.reps = Math.max(1, s.reps - 1);
        render(); return;
      }
      if(e.target.closest('.chk') && mode === 'live'){
        doneCount = Math.min(doneCount + 1, totalSets());
        restFrom = Date.now();
        render(); return;
      }
      const act = e.target.closest('[data-a]');
      if(!act) return;
      if(act.dataset.a === 'start'){
        startedAt = Date.now(); restFrom = null; doneCount = 0; mode = 'live'; render(); startTick();
      }
      if(act.dataset.a === 'skip'){ restFrom = Date.now(); render(); }
      if(act.dataset.a === 'pause'){ stopTick(); U.toast('Paused'); }
      if(act.dataset.a === 'pick'){
        Screens.push('exercise-picker', { onPick: chosen => {
          chosen.forEach(c => { if(!session.exercises.some(x => x.id === c.id)) session.exercises.push(c); });
          if(session.name === 'Legs workout' && !session.exercises.length) session.name = 'New session';
          render();
        }});
      }
      if(act.dataset.a === 'finish'){
        const rec = buildRecord();
        try { await Store.put('sessions', rec);
      Loads.learnFrom(rec);          /* what you actually lifted becomes the baseline */
      /* tell whoever opened this that there is a new session, or the screen you
         came from carries on showing the list it drew before you trained */
      try { Data.invalidate && Data.invalidate('sessions'); } catch(e){}
      onChange && onChange();
      /* if a task put this workout on the day, tick it off */
      if(session.routineId){
        try {
          const day = await Data.currentDay();
          await Routines.completeTaskFor(session.routineId, day);
        } catch(e){ console.warn('No task to tick', e); }
      }
      Celebrate.showAwards(); const { values } = await Store.all('sessions');
          history = values.sort((a,b) => b.finishedAt - a.finishedAt); }
        catch(err){ console.error(err); U.toast("Couldn't save the session"); }
        stopTick(); lastSaved = rec; mode = 'saved'; render();
      }
    });
  }

  let onChange = null;

  function mount(el, params){
    root = el;
    session = (params && (params.preset || params.session))
            || { name:'', exercises:[] };     /* an empty session, not a canned one */
    onChange = (params && params.onChange) || null;
    mode = 'draft'; doneCount = 0; startedAt = null;
    (async () => {
      unit = await Units.get();
      await loadArt();
      try { const { values } = await Store.all('sessions');
        history = values.sort((a,b) => b.finishedAt - a.finishedAt); }
      catch(e){ history = []; }
      render(); wire();
    })();
  }

  Screens.register('session', mount);
})();
