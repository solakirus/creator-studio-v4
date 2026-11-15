/* v4: drag to sort — with a mouse, or a finger (hold, then drag).

   HTML5 drag-and-drop does nothing on a phone, so this is done with pointer
   events: a mouse starts dragging once it moves a few pixels; a finger holds
   still for a moment first (so scrolling still scrolls). A ghost copy follows
   the pointer, a line shows where it will land, and the click that would
   otherwise follow a drag is swallowed.

     DragSort.wire(container, {
       item: '.card',            what can be picked up (inside container)
       handle: '.grip',          optional: only this part starts a drag
       zone: '.column',          where things can be dropped (default: container)
       axis: 'y' | 'x',          how items line up inside a zone (default 'y')
       onDrop(itemEl, zoneEl, beforeEl)   beforeEl null = at the end
     })                                  → returns an unwire function */
(function(global){
  const HOLD = 320, SLOP = 8, MOUSE_SLOP = 5;

  function css(){
    if(document.getElementById('ds-css')) return;
    const st = document.createElement('style'); st.id = 'ds-css';
    st.textContent = `
    .ds-ghost{position:fixed;z-index:10000;pointer-events:none;opacity:.88;transform:rotate(1.5deg);box-shadow:0 12px 30px rgba(0,0,0,.45);transition:none}
    .ds-src{opacity:.35}
    .ds-zone{outline:2px dashed rgba(251,105,0,.55);outline-offset:2px}
    .ds-mark{position:relative}
    .ds-mark.y::before{content:"";position:absolute;left:0;right:0;top:-5px;height:3px;border-radius:2px;background:var(--orange,#FB6900)}
    .ds-mark.x::before{content:"";position:absolute;top:0;bottom:0;left:-7px;width:3px;border-radius:2px;background:var(--orange,#FB6900)}
    .ds-end.y::after{content:"";display:block;height:3px;margin-top:4px;border-radius:2px;background:var(--orange,#FB6900)}
    .ds-dragging, .ds-dragging *{user-select:none;-webkit-user-select:none;cursor:grabbing!important}`;
    document.head.appendChild(st);
  }

  function wire(container, o){
    if(!container) return () => {};
    css();
    const axis = o.axis === 'x' ? 'x' : 'y';
    let st = null;   /* { el, x0, y0, timer, on, ghost, dx, dy, zone, before, touch } */

    const zones = () => o.zone ? [...container.querySelectorAll(o.zone)] : [container];
    function clearMarks(){
      container.querySelectorAll('.ds-mark,.ds-end,.ds-zone').forEach(n => n.classList.remove('ds-mark', 'ds-end', 'ds-zone', 'x', 'y'));
    }
    function begin(){
      st.on = true;
      const r = st.el.getBoundingClientRect();
      st.dx = st.x0 - r.left; st.dy = st.y0 - r.top;
      const g = st.el.cloneNode(true);
      g.classList.add('ds-ghost'); g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
      g.style.left = r.left + 'px'; g.style.top = r.top + 'px';
      document.body.appendChild(g); st.ghost = g;
      st.el.classList.add('ds-src');
      document.documentElement.classList.add('ds-dragging');
      if(navigator.vibrate && st.touch) try { navigator.vibrate(12); } catch(e){}
    }
    function where(x, y){
      if(st.ghost) st.ghost.style.display = 'none';
      const under = document.elementFromPoint(x, y);
      if(st.ghost) st.ghost.style.display = '';
      const zone = under && zones().find(z => z.contains(under));
      if(!zone) return { zone:null, before:null };
      const items = [...zone.querySelectorAll(o.item)].filter(n => n !== st.el && zone.contains(n) && (!o.zone || n.closest(o.zone) === zone));
      let before = null;
      for(const n of items){
        const r = n.getBoundingClientRect();
        const mid = axis === 'x' ? r.left + r.width / 2 : r.top + r.height / 2;
        if((axis === 'x' ? x : y) < mid){ before = n; break; }
      }
      return { zone, before };
    }
    function move(x, y){
      st.ghost.style.left = (x - st.dx) + 'px'; st.ghost.style.top = (y - st.dy) + 'px';
      const w = where(x, y);
      clearMarks();
      st.zone = w.zone; st.before = w.before;
      if(w.zone){
        if(o.zone) w.zone.classList.add('ds-zone');
        if(w.before) w.before.classList.add('ds-mark', axis);
        else w.zone.classList.add('ds-end', axis);
      }
      /* near an edge of a scrolling area: scroll it along */
      const sc = container.closest('.view') || document.scrollingElement;
      if(sc){ const r = sc.getBoundingClientRect(); if(y < r.top + 40) sc.scrollTop -= 12; else if(y > r.bottom - 40) sc.scrollTop += 12; }
      if(axis === 'x'){ const r = container.getBoundingClientRect(); if(x < r.left + 40) container.scrollLeft -= 14; else if(x > r.right - 40) container.scrollLeft += 14; }
    }
    function end(drop){
      if(!st) return;
      clearTimeout(st.timer);
      const s = st; st = null;
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onCancel, true);
      document.removeEventListener('touchmove', noScroll, { capture:true });
      if(!s.on) return;
      if(s.ghost) s.ghost.remove();
      s.el.classList.remove('ds-src');
      document.documentElement.classList.remove('ds-dragging');
      clearMarks();
      /* the click a drag ends in is not a tap */
      const eat = e => { e.stopPropagation(); e.preventDefault(); };
      document.addEventListener('click', eat, { capture:true, once:true });
      setTimeout(() => document.removeEventListener('click', eat, { capture:true }), 400);
      if(drop && s.zone && o.onDrop) o.onDrop(s.el, s.zone, s.before);
    }
    const noScroll = e => { if(st && st.on) e.preventDefault(); };
    function onMove(e){
      if(!st) return;
      const far = Math.hypot(e.clientX - st.x0, e.clientY - st.y0);
      if(!st.on){
        if(st.touch){ if(far > SLOP) end(false); return; }      /* a finger moving before the hold: a scroll */
        if(far < MOUSE_SLOP) return;
        begin();
      }
      e.preventDefault();
      move(e.clientX, e.clientY);
    }
    const onUp = () => end(true);
    const onCancel = () => end(false);
    function onDown(e){
      if(e.button > 0) return;
      const el = e.target.closest(o.item);
      if(!el || !container.contains(el)) return;
      if(o.handle && !e.target.closest(o.handle)) return;
      if(e.target.closest('input,textarea,select,[contenteditable]')) return;
      st = { el, x0:e.clientX, y0:e.clientY, on:false, touch:e.pointerType !== 'mouse' };
      if(st.touch) st.timer = setTimeout(() => { if(st && !st.on){ begin(); move(st.x0, st.y0); } }, HOLD);
      document.addEventListener('pointermove', onMove, true);
      document.addEventListener('pointerup', onUp, true);
      document.addEventListener('pointercancel', onCancel, true);
      document.addEventListener('touchmove', noScroll, { capture:true, passive:false });
    }
    /* a held finger mustn't open the long-press menu */
    const noMenu = e => { if(e.target.closest(o.item) && container.contains(e.target)) e.preventDefault(); };
    container.addEventListener('pointerdown', onDown);
    container.addEventListener('contextmenu', noMenu);
    return () => { container.removeEventListener('pointerdown', onDown); container.removeEventListener('contextmenu', noMenu); end(false); };
  }

  global.DragSort = { wire };
})(window);
