/* Selecting several things at once.

   Hold any item in a list; it becomes selected and every other item grows a
   checkbox. Tap the ones you want, then delete them together. Tapping outside
   or pressing Cancel leaves the mode and nothing is lost.

   One module rather than one per screen: the gesture, the bar and the guard
   that stops a tap from navigating while you are selecting are the fiddly part,
   and three copies of them would drift.

   A screen opts in with Select.enable(host, {...}) and gets all of it. */
(function(global){

  const HOLD_MS = 450;     /* long enough not to fire on a scroll, short enough to feel deliberate */
  const MOVE_TOL = 10;     /* a finger that travels this far is scrolling, not holding */

  let active = null;       /* the one list currently in selection mode */

  function clear(){
    if(!active) return;
    const { host, bar } = active;
    host.classList.remove('selecting');
    host.querySelectorAll('.sel-on').forEach(n => n.classList.remove('sel-on'));
    if(bar && bar.parentNode) bar.parentNode.removeChild(bar);
    active = null;
  }

  function count(){
    return active ? active.host.querySelectorAll('.sel-on').length : 0;
  }

  function paint(){
    if(!active) return;
    const n = count();
    const { bar, noun } = active;
    if(!n){ clear(); return; }        /* deselecting the last one leaves the mode */
    bar.querySelector('.sb-n').textContent =
      `${n} ${noun}${n === 1 || /s$/.test(noun) ? '' : 's'} selected`;   /* "3 series", not "3 seriess" */
  }

  function barHTML(){
    return `
      <button class="sb-x" aria-label="Cancel">Cancel</button>
      <span class="sb-n">1 selected</span>
      <button class="sb-del">Delete</button>`;
  }

  function begin(host, item, opts){
    if(active && active.host !== host) clear();

    if(!active){
      host.classList.add('selecting');
      const bar = document.createElement('div');
      bar.className = 'selbar';
      bar.innerHTML = barHTML();
      /* a screen can offer more than Delete — "Add to folder", say. These sit
         before Delete and hand the chosen ids over; the screen does the rest. */
      const extra = typeof opts.extra === 'function' ? opts.extra() : (opts.extra || []);
      extra.forEach((x, i) => {
        const b = document.createElement('button');
        b.className = 'sb-extra'; b.dataset.extra = String(i); b.textContent = x.label;
        bar.insertBefore(b, bar.querySelector('.sb-del'));
      });
      document.body.appendChild(bar);

      bar.addEventListener('click', async e => {
        if(e.target.closest('.sb-x')) return clear();
        const ex = e.target.closest('[data-extra]');
        if(ex){
          const ids = [...host.querySelectorAll('.sel-on')].map(n => opts.idOf(n)).filter(Boolean);
          const x = extra[+ex.dataset.extra];
          if(!x || !ids.length) return;
          const done = () => { clear(); if(opts.onDone) opts.onDone(); };
          try { await x.run(ids, done); } catch(err){ console.error(err); U.toast('That did not work'); }
          return;
        }
        if(!e.target.closest('.sb-del')) return;

        const ids = [...host.querySelectorAll('.sel-on')].map(n => opts.idOf(n)).filter(Boolean);
        const n = ids.length;
        const noun = `${n} ${opts.noun}${n === 1 || /s$/.test(opts.noun) ? '' : 's'}`;

        /* Deleting several things at once is the one action worth interrupting
           for — undo is not on offer, so the question is asked plainly. */
        App.sheet(`
          <h2 style="margin:0 0 3px">Delete ${noun}?</h2>
          <p class="hintline" style="margin:0 0 14px">${
            opts.warning || 'This cannot be undone.'}</p>
          <div class="sheetcta">
            <button class="btn-primary" data-yes
              style="background:var(--red);border-color:var(--red)">Delete ${noun}</button>
            <button class="btn-ghost" data-no>Keep them</button>
          </div>`, sheet => {
          sheet.addEventListener('click', async ev => {
            if(ev.target.closest('[data-no]')) return App.closeSheet();
            if(!ev.target.closest('[data-yes]')) return;
            App.closeSheet();
            try {
              await opts.onDelete(ids);
              U.toast(`${noun} deleted`);
            } catch(err){
              console.error('Bulk delete failed', err);
              U.toast('Could not delete');
            }
            clear();
            if(opts.onDone) opts.onDone();
          });
        });
      });

      active = { host, bar, noun:opts.noun, opts };
    }

    item.classList.add('sel-on');
    paint();
  }

  function toggle(item){
    item.classList.toggle('sel-on');
    paint();
  }

  /* A screen calls this once per mount. */
  function enable(host, opts){
    if(!host || !opts || !opts.itemSelector || !opts.idOf || !opts.onDelete) return;
    opts.noun = opts.noun || 'item';

    if(host.dataset.selectable === '1') return;   /* listeners attach once */
    host.dataset.selectable = '1';

    let timer = null, startX = 0, startY = 0, held = false;

    /* Two enabled lists can be nested — the tab's own view holds the section's.
       Both would hear the same long press, and the outer one would win, asking
       to delete "0 tasks" because a clip card carries no task id. The nearest
       enabled list owns the gesture. */
    const mine = t => {
      if(!t || !t.closest) return null;
      const item = t.closest(opts.itemSelector);
      if(!item) return null;
      const owner = t.closest('[data-selectable="1"]');
      return owner === host ? item : null;
    };
    const itemAt = mine;

    host.addEventListener('touchstart', e => {
      const item = itemAt(e.target);
      if(!item) return;
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY; held = false;
      clearTimeout(timer);
      timer = setTimeout(() => {
        held = true;
        if(navigator.vibrate) { try { navigator.vibrate(12); } catch(err){} }
        begin(host, item, opts);
      }, HOLD_MS);
    }, { passive:true });

    host.addEventListener('touchmove', e => {
      const t = e.touches[0];
      if(Math.abs(t.clientX - startX) > MOVE_TOL || Math.abs(t.clientY - startY) > MOVE_TOL){
        clearTimeout(timer);
      }
    }, { passive:true });

    host.addEventListener('touchend', () => clearTimeout(timer), { passive:true });
    host.addEventListener('touchcancel', () => clearTimeout(timer), { passive:true });

    /* Right-click is the same gesture on a desktop, and it makes this testable. */
    host.addEventListener('contextmenu', e => {
      const item = itemAt(e.target);
      if(!item) return;
      e.preventDefault();
      begin(host, item, opts);
    });

    /* While selecting, a tap picks rather than opens. This has to run before
       the screen's own click handler, so it is captured on the way down. */
    host.addEventListener('click', e => {
      if(!active || active.host !== host) return;
      const item = itemAt(e.target);
      e.preventDefault();
      e.stopPropagation();
      if(item) toggle(item);
    }, true);
  }

  /* Leaving a screen must not leave the bar floating over the next one. It sits
     above the tab bar at z-index 60, so a stale one covers the section nav and
     swallows every tap — which looks exactly like the app has frozen. */
  function reset(){ clear(); }

  /* The list is gone from the page but the bar is still in the body: this is
     what happens when a screen re-renders or you switch section while picking. */
  function prune(){
    if(!active) return;
    if(!document.body.contains(active.host)) clear();
  }

  /* Any tap that is not on the bar and not on the list ends the selection —
     switching section, opening a tab, anything. Cheaper and more reliable than
     asking every screen to remember to call reset. */
  document.addEventListener('click', e => {
    if(!active) return;
    if(e.target.closest('.selbar')) return;
    /* the confirm sheet is part of this flow, not a tap somewhere else */
    if(e.target.closest('.sheet, #sheet, .scrim')) return;
    if(active.host.contains(e.target)) return;
    clear();
  }, true);

  global.Select = { enable, reset, clear, count, prune, HOLD_MS };
})(window);
