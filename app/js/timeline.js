/* The day as blocks of hours, with long-press drag to move things between them.
   Renders into Today; reads the same records the list view does. */
(function(global){
  const { ICON } = U;

  const BLOCKS = [
    { k:'early',  n:'Early',          from:3,  to:5  },
    { k:'morning',n:'Morning',        from:6,  to:8  },
    { k:'midday', n:'Midday',         from:9,  to:11 },
    { k:'noon',   n:'Afternoon',      from:12, to:14 },
    { k:'late',   n:'Late afternoon', from:15, to:17 },
    { k:'evening',n:'Evening',        from:18, to:20 },
    { k:'night',  n:'Night',          from:21, to:23 }
  ];
  const hourLabel = h => {
    const ap = h >= 12 ? 'P' : 'A';
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}${ap}`;
  };
  const rangeLabel = b => `${hourLabel(b.from)}–${hourLabel(b.to)}`;
  const hourOf = at => at ? +at.split(':')[0] : null;

  /* The hours a block runs through after the one it starts in. Rather than
     stretching a card across the hour rows — which would sit on top of anything
     else booked there — each later hour gets a quiet continuation strip. */
  function spanHours(it){
    if(!it.at || !it.mins) return [];
    const [h, m] = it.at.split(':').map(Number);
    const startMin = h * 60 + m;
    const endMin = startMin + it.mins;
    const out = [];
    for(let hour = h + 1; hour * 60 < endMin; hour++) out.push(hour);
    return out;
  }

  function contHTML(it, hour){
    const [h, m] = it.at.split(':').map(Number);
    const endMin = h * 60 + m + it.mins;
    const last = endMin <= (hour + 1) * 60;
    return `<div class="tlcont${it.done ? ' done' : ''}" data-item="${it.kind}:${it.id}"
      ${it.tone ? `style="--tone:${it.tone}"` : ''}>
      <span class="ln"></span>
      <span class="tx">${it.title}${last ? ` · ends ${endLabel(it)}` : ' continues'}</span>
    </div>`;
  }

  /* which blocks are open — remembered while the app is running */
  const open = new Set(['early','morning','midday','noon','late','evening','night']);

  const GRIP = `<span class="grip" aria-label="Drag">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
      <path d="M5 9h14M5 15h14"/></svg></span>`;

  /* A block runs to the end of whatever it says it takes, so an hour in the gym
     reads as an hour rather than a dot at six o'clock. */
  const endLabel = it => {
    if(!it.mins || !it.at) return '';
    const [h, m] = it.at.split(':').map(Number);
    const end = new Date();
    end.setHours(h, m + it.mins, 0, 0);
    const eh = end.getHours(), em = end.getMinutes();
    const ampm = eh >= 12 ? 'P' : 'A';
    const hr = eh % 12 === 0 ? 12 : eh % 12;
    return `${hr}${em ? ':' + String(em).padStart(2,'0') : ''}${ampm}`;
  };

  function itemHTML(it){
    const long = it.mins >= 45;
    const style = [
      it.mins ? `--mins:${it.mins}` : '',
      it.tone ? `--tone:${it.tone}` : ''
    ].filter(Boolean).join(';');

    return `<div class="tlitem${it.done ? ' done' : ''}${it.mins ? ' timed' : ''}${long ? ' long' : ''}${
      it.tone ? ' toned' : ''}"
      data-item="${it.kind}:${it.id}" data-vlog="${it.vlogId || ''}"
      ${style ? `style="${style}"` : ''}>
      ${GRIP}
      <span class="dot ${it.kind === 'beat' ? 'beat' : it.kind === 'task' ? '' : 'derived'}"></span>
      <span class="nm">${it.title}${it.sub ? `<span class="sub">${it.sub}</span>` : ''}
        ${(it.mins || it.toneLabel) ? `<span class="span">${
          it.toneLabel ? it.toneLabel.toUpperCase() : ''}${
          it.toneLabel && it.mins ? ' · ' : ''}${
          it.mins ? `${it.mins >= 60
            ? `${Math.floor(it.mins / 60)}h${it.mins % 60 ? ' ' + (it.mins % 60) + 'm' : ''}`
            : `${it.mins}m`}${it.at ? ` · until ${endLabel(it)}` : ''}` : ''}</span>` : ''}</span>
      ${it.tickable ? `<button class="bx" data-tick="${it.kind}:${it.id}" aria-label="Done">${ICON.check}</button>` : ''}
    </div>`;
  }

  /* items: [{ kind, id, vlogId, title, sub, at, done, tickable }] */
  function render(items){
    const nowH = new Date().getHours();
    const untimed = items.filter(i => !i.at);

    let html = BLOCKS.map(b => {
      const mine = items.filter(i => {
        const h = hourOf(i.at);
        return h !== null && h >= b.from && h <= b.to;
      });
      /* a block starting in the previous band but still running in this one */
      const spillover = items.filter(i =>
        spanHours(i).some(h => h >= b.from && h <= b.to) &&
        !(hourOf(i.at) >= b.from && hourOf(i.at) <= b.to));
      const isNow = nowH >= b.from && nowH <= b.to;
      const isOpen = open.has(b.k);
      let rows = '';
      for(let h = b.from; h <= b.to; h++){
        const inHour = mine.filter(i => hourOf(i.at) === h);
        /* anything that started earlier and is still running */
        const running = items.filter(i => spanHours(i).includes(h));
        rows += `<div class="hr${h === nowH ? ' now' : ''}" data-hour="${h}">
          <span class="lab">${hourLabel(h)}</span>
          <div class="slot">${inHour.map(itemHTML).join('')}${
            running.map(i => contHTML(i, h)).join('')}</div>
        </div>`;
      }
      return `<section class="blk${isOpen ? ' open' : ''}${isNow ? ' now' : ''}" data-blk="${b.k}">
        <button class="blk-h" data-toggle="${b.k}">
          <svg class="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          <b>${b.n}</b><span class="rng">${rangeLabel(b)}</span>
          <span class="cnt${mine.length || spillover.length ? ' some' : ''}">${
            mine.length ? `${mine.length} thing${mine.length===1?'':'s'}` : ''}${
            spillover.length ? `${mine.length ? ' + ' : ''}${spillover.length} running` : ''}</span>
        </button>
        ${isOpen ? rows : ''}
      </section>`;
    }).join('');

    html += `<section class="blk open" data-blk="none">
      <button class="blk-h" data-toggle="none">
        <svg class="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        <b>Sometime today</b>
        <span class="cnt${untimed.length ? ' some' : ''}">${untimed.length ? `${untimed.length}` : ''}</span>
      </button>
      <div class="hr" data-hour=""><span class="lab">—</span>
        <div class="slot">${untimed.length ? untimed.map(itemHTML).join('')
          : `<span style="color:var(--dim);font-size:13.5px;padding:6px 0">Nothing without a time</span>`}</div>
      </div>
    </section>`;

    return html;
  }

  /* ---------- long press to pick up, drag to an hour ---------- */
  /* dropSel names what counts as a drop target; onMove receives the target element. */
  function wireDrag(root, onMove, dropSel){
    const SEL = dropSel || '[data-hour]';
    let lifted = null, source = null, hint = null, lastDrop = null, scroller = null;

    const clearDrop = () => {
      if(lastDrop) lastDrop.classList.remove('drop');
      lastDrop = null;
    };
    function cleanup(){
      if(lifted){ lifted.remove(); lifted = null; }
      if(hint){ hint.remove(); hint = null; }
      if(source) source.style.visibility = '';
      source = null;
      clearDrop();
      document.body.style.userSelect = '';
      document.body.classList.remove('dragging');
    }

    /* Only the grip starts a drag. It carries touch-action:none, so the browser
       never begins a scroll on it — which is what made long-press unusable. */
    root.addEventListener('pointerdown', e => {
      const grip = e.target.closest('.grip');
      if(!grip) return;
      const item = grip.closest('.tlitem, .wbeat');
      if(!item) return;

      e.preventDefault();
      source = item;
      scroller = root.closest('.view') || root;

      const r = item.getBoundingClientRect();
      lifted = item.cloneNode(true);
      lifted.classList.add('lifted');
      lifted.style.left = r.left + 'px';
      lifted.style.top = r.top + 'px';
      lifted.style.width = r.width + 'px';
      document.body.appendChild(lifted);
      item.style.visibility = 'hidden';

      hint = document.createElement('div');
      hint.className = 'tlhint';
      hint.textContent = SEL === '[data-hour]'
        ? 'Drop on an hour, or on Sometime today'
        : 'Drop on a day, or on Unscheduled';
      document.body.appendChild(hint);

      document.body.style.userSelect = 'none';
      document.body.classList.add('dragging');
      if(navigator.vibrate) navigator.vibrate(10);
      grip.setPointerCapture(e.pointerId);
    });

    root.addEventListener('pointermove', e => {
      if(!lifted) return;
      e.preventDefault();
      const r = lifted.getBoundingClientRect();
      lifted.style.left = (e.clientX - r.width / 2) + 'px';
      lifted.style.top = (e.clientY - r.height / 2) + 'px';

      lifted.style.display = 'none';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      lifted.style.display = '';
      const row = under && under.closest(SEL);
      if(row !== lastDrop){
        clearDrop();
        if(row){ row.classList.add('drop'); lastDrop = row; }
      }

      /* nudge the scroll when you reach the edges */
      const vr = scroller.getBoundingClientRect();
      if(e.clientY < vr.top + 80) scroller.scrollTop -= 14;
      else if(e.clientY > vr.bottom - 80) scroller.scrollTop += 14;
    });

    const finish = async e => {
      if(!lifted) return;
      const target = lastDrop;
      const key = source.dataset.item;
      const vlogId = source.dataset.vlog || null;
      cleanup();
      if(!target) return;
      if(SEL === '[data-hour]'){
        const h = target.dataset.hour;
        await onMove(key, vlogId, h === '' ? null : `${String(h).padStart(2,'0')}:00`);
      } else {
        await onMove(key, vlogId, target);
      }
    };
    root.addEventListener('pointerup', finish);
    root.addEventListener('pointercancel', () => cleanup());

    return { toggle:k => { open.has(k) ? open.delete(k) : open.add(k); } };
  }

  global.Timeline = { render, wireDrag, BLOCKS, open };
})(window);
