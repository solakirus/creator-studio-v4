/* Capture mode — the shot list, at arm's length, while you're actually filming. */
(function(){
  const { ICON } = U;

  async function mount(el, params){
    let day = params.day, pieces = [], idx = 0, kit = [];

    async function load(){
      if(day == null) day = await Data.currentDay();
      const tasks = await Data.tasks();
      /* a piece worth shooting is a task on this day with a shot list */
      pieces = tasks
        .filter(t => t.day === day && ((t.shots || []).length || (t.subs || []).length))
        .sort((a,b) => (a.at || '99:99').localeCompare(b.at || '99:99'));
      if(idx >= pieces.length) idx = Math.max(0, pieces.length - 1);
      kit = await Coverage.kit();
    }

    function fmt(hhmm){
      if(!hhmm) return '';
      const [h,m] = hhmm.split(':').map(Number);
      const ap = h >= 12 ? 'P' : 'A', hr = h % 12 === 0 ? 12 : h % 12;
      return m ? `${hr}:${String(m).padStart(2,'0')}${ap}` : `${hr}${ap}`;
    }

    function render(){
      const prev = el.querySelector('.view');
      const keep = prev ? prev.scrollTop : 0;
      const restore = () => {
        const v = el.querySelector('.view');
        if(v && keep) v.scrollTop = keep;
      };
      if(!pieces.length){
        el.innerHTML = Screens.bar({ kicker:'Capture mode', title:`Day ${day}` }) + `
          <div class="view"><div class="cap-empty">
            <b>Nothing to shoot</b>
            <p>Capture mode walks the shot lists on this day. Add steps to a task on Today and they
               become its shot list here.</p>
          </div></div>`;
        return;
      }

      const p = pieces[idx];
      const shots = (p.shots && p.shots.length) ? p.shots : (p.subs || []);
      const done = shots.filter(s => s.angles ? Coverage.shotDone(s) : s.done).length;
      const listOf = x => (x.shots && x.shots.length) ? x.shots : (x.subs || []);
      const isDone = s => s.angles ? Coverage.shotDone(s) : s.done;
      const total = pieces.reduce((n,x) => n + listOf(x).length, 0);
      const allDone = pieces.reduce((n,x) => n + listOf(x).filter(isDone).length, 0);

      el.innerHTML = `
      <header class="cap-head">
        <div class="top">
          <button class="back" data-pop aria-label="Exit">${ICON.chevL}</button>
          <h1>${p.title}</h1>
          ${p.at ? `<span class="timechip">${fmt(p.at)}</span>` : ''}
        </div>
        <div class="cap-prog">
          <span class="caps muted" style="font-size:11.5px">Piece ${idx+1}/${pieces.length}</span>
          <div class="track"><i style="width:${total ? Math.round(allDone / total * 100) : 0}%"></i></div>
          <b>${done}/${shots.length}</b>
        </div>
      </header>

      <div class="view" style="padding-top:18px">
        ${shots.map((s,i) => `
          <button class="shot${(s.angles ? Coverage.shotDone(s) : s.done) ? ' done' : ''}" data-shot="${i}">
            <span class="idx">${i+1}</span>
            <span class="bx">${ICON.check}</span>
            <span class="tx">${s.text || s.t}
              ${s.angles ? `<br><span style="font-size:13px;color:var(--muted)">${Coverage.shotGot(s)} of ${s.angles.length} angles · ${
                s.angles.map(a => (a.done ? '✓' : '') + a.type).join(', ')}</span>` : ''}</span>
          </button>`).join('')}
        <div style="margin-top:18px">${Coverage.html(p, Coverage.kitFor(p, kit))}</div>
        ${p.swipeId ? `<button class="btn-sm" data-a="swipe" style="width:100%;margin-top:16px;justify-content:center">↗ Open the swipe for this piece</button>` : ''}
        <p class="note">${allDone} of ${total} shots captured across the day.</p>
      </div>

      <div class="cap-foot">
        <button data-a="prev" ${idx === 0 ? 'disabled' : ''}>← Prev</button>
        <button class="accent" data-a="alldone">${done === shots.length ? 'Piece complete' : 'Mark all captured'}</button>
        <button data-a="next" ${idx >= pieces.length - 1 ? 'disabled' : ''}>Next →</button>
      </div>`;
      restore();
    }

    async function persist(p){
      const list = (p.shots && p.shots.length) ? p.shots : (p.subs || []);
      const isDone = s => s.angles ? Coverage.shotDone(s) : s.done;
      p.view = list.length && list.every(isDone) ? 'done' : (p.view === 'done' ? 'todo' : p.view);
      await Store.put('tasks', p);
      Data.invalidate('tasks');
      params.onChange && params.onChange();
    }

    el.addEventListener('click', async e => {
      const sh = e.target.closest('[data-shot]');
      if(sh){
        const p = pieces[idx];
        const list = (p.shots && p.shots.length) ? p.shots : p.subs;
        const s = list[+sh.dataset.shot];
        if(s.angles){
          /* a named shot logs an angle rather than a single tick */
          const kitFor = Coverage.kitFor(p, kit);
          const label = id => {
            const k = kitFor.find(x => x.id === id);
            return k ? k.label : id;
          };
          App.sheet(`<h2>${s.text}</h2>
            <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px">
              ${Coverage.shotGot(s)} of ${s.angles.length} planned angles. Tick what you have.</p>
            <div class="group compact" style="margin:0">
              ${s.angles.map((a,ai) => `<button class="row" data-tickang="${ai}">
                <span class="lbl">${label(a.type)}</span>
                <span style="width:26px;height:26px;border-radius:var(--r);display:flex;align-items:center;
                  justify-content:center;${a.done
                    ? 'background:var(--green);color:#fff' : 'border:1px solid var(--line);color:var(--dim)'}">
                  ${a.done ? ICON.check : ''}</span>
              </button>`).join('')}
            </div>
            <div class="sheetcta"><button class="btn-ghost" data-cancel style="flex:1">Done</button></div>`,
          sheetEl => {
            sheetEl.addEventListener('click', async ev => {
              const ta = ev.target.closest('[data-tickang]');
              if(ta){
                ev.stopPropagation();
                const a = s.angles[+ta.dataset.tickang];
                a.done = !a.done;
                await persist(p);
                App.closeSheet();
                setTimeout(render, 60);
                return;
              }
              if(ev.target.closest('[data-cancel]')){ App.closeSheet(); setTimeout(render, 60); }
            });
          });
          return;
        }
        s.done = !s.done;
        await persist(p);
        return render();
      }
      const a = e.target.closest('[data-a]');
      if(!a) return;
      if(a.dataset.a === 'prev' && idx > 0){ idx--; return render(); }
      if(a.dataset.a === 'next' && idx < pieces.length - 1){ idx++; return render(); }
      if(a.dataset.a === 'swipe') return Screens.push('swipe', { id:pieces[idx].swipeId });
      if(a.dataset.a === 'alldone'){
        const p = pieces[idx];
        const list = (p.shots && p.shots.length) ? p.shots : (p.subs || []);
        const isDone2 = s => s.angles ? Coverage.shotDone(s) : s.done;
        const every = list.every(isDone2);
        list.forEach(s => {
          if(s.angles){
            if(every) s.angles = [];
            else while(Coverage.shotGot(s) < Coverage.shotTarget(s)) s.angles.push({ type:'wide', at:Date.now() });
          } else s.done = !every;
        });
        await persist(p);
        /* finishing a piece moves you to the next one, since that's what you'd do anyway */
        if(!every && idx < pieces.length - 1) idx++;
        render();
      }
    });

    await load();
    render();
  }

  Screens.register('capture', mount);
})();
