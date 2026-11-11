/* Swipe a card sideways to act on it. Horizontal only — a vertical drag is
   always a scroll, so the gesture has to lose that argument first. */
(function(global){
  const THRESHOLD = 0.32;     /* of card width */
  const MAX_TILT = 4;         /* degrees, at full throw */

  function wire(root, opts){
    const o = opts || {};
    const sel = o.selector || '.mediacard';
    let card = null, inner = null, startX = 0, startY = 0;
    let axis = null, dx = 0, width = 0, acted = false;

    const reset = animate => {
      if(!inner) return;
      inner.style.transition = animate ? 'transform .2s cubic-bezier(.2,.8,.3,1)' : '';
      inner.style.transform = '';
      if(card) card.classList.remove('swiping','swipe-r','swipe-l','swipe-armed');
    };
    const finish = () => {
      if(inner) inner.style.transition = '';
      card = null; inner = null; axis = null; dx = 0; acted = false;
    };

    root.addEventListener('pointerdown', e => {
      if(e.target.closest('button, input, textarea, select, .grip, .check, .artctl, [data-time], [data-swipe]')) return;
      const c = e.target.closest(sel);
      if(!c || !c.dataset.id) return;
      card = c;
      inner = c.querySelector('.card') || c;
      startX = e.clientX; startY = e.clientY;
      width = c.getBoundingClientRect().width || 320;
      axis = null; dx = 0; acted = false;
    });

    root.addEventListener('pointermove', e => {
      if(!card) return;
      const mx = e.clientX - startX, my = e.clientY - startY;

      if(axis === null){
        if(Math.abs(mx) < 10 && Math.abs(my) < 10) return;
        /* a clear horizontal lead wins; anything else is a scroll and we bow out */
        axis = Math.abs(mx) > Math.abs(my) * 1.4 ? 'x' : 'y';
        if(axis === 'y'){ finish(); return; }
        card.classList.add('swiping');
        try { card.setPointerCapture(e.pointerId); } catch(err){}
      }
      if(axis !== 'x') return;

      e.preventDefault();
      dx = mx;
      const armed = Math.abs(dx) > width * THRESHOLD;
      const tilt = (dx / width) * MAX_TILT;
      inner.style.transform = `translateX(${dx}px) rotate(${tilt}deg)`;
      card.classList.toggle('swipe-r', dx > 0);
      card.classList.toggle('swipe-l', dx < 0);
      card.classList.toggle('swipe-armed', armed);
    });

    const release = async () => {
      if(!card || axis !== 'x'){ finish(); return; }
      const armed = Math.abs(dx) > width * THRESHOLD;
      const id = card.dataset.id;
      const dir = dx > 0 ? 'right' : 'left';

      if(armed && !acted){
        acted = true;
        /* throw it the rest of the way, then let the list re-render */
        inner.style.transition = 'transform .18s ease-out, opacity .18s ease-out';
        inner.style.transform = `translateX(${dx > 0 ? width : -width}px) rotate(${dx > 0 ? MAX_TILT : -MAX_TILT}deg)`;
        inner.style.opacity = '0';
        const done = dir === 'right' ? o.onRight : o.onLeft;
        setTimeout(() => { if(done) done(id); }, 150);
        finish();
        return;
      }
      reset(true);
      setTimeout(finish, 200);
    };

    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', () => { reset(true); setTimeout(finish, 200); });
  }

  global.SwipeCards = { wire };
})(window);
