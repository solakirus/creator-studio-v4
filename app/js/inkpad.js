/* Creator Studio — ink pad. Handwritten notes with a pen, finger or mouse.

   Shared by the phone app and the laptop Planner. Ink is kept as pen strokes,
   not a picture, so it redraws sharp at any size and stays small enough to
   travel in a plan pack. Coordinates are stored on a 1000-wide page, so a
   note written on the phone lines up on the laptop.

   ink = { v:1, W:1000, H:<page height>, strokes:[ { c:colour, s:size, p:[x,y,pressure, x,y,pressure, …] } ] }

   When a real pen is on the screen, touches are ignored — rest your palm. */
(function(global){

  const W = 1000;
  const COLOURS = ['#EDE5D2', '#FB6900', '#3B9EFF', '#5BBE6A'];
  const SIZES = { fine: 2.2, medium: 3.6, bold: 6 };
  const blank = () => ({ v:1, W, H:600, strokes:[] });
  const isEmpty = ink => !ink || !(ink.strokes || []).length;

  function draw(ctx, ink, scale, opts){
    opts = opts || {};
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    (ink.strokes || []).forEach(st => {
      const p = st.p; if(!p || p.length < 3) return;
      ctx.strokeStyle = opts.mono || st.c;
      ctx.fillStyle = opts.mono || st.c;
      if(p.length === 3){                                   /* a dot */
        ctx.beginPath(); ctx.arc(p[0] * scale, p[1] * scale, st.s * scale * 0.6, 0, Math.PI * 2); ctx.fill(); return;
      }
      for(let i = 3; i < p.length; i += 3){
        const pr = (p[i + 2] || 50) / 100;
        ctx.lineWidth = Math.max(0.6, st.s * scale * (0.55 + pr * 0.9));
        ctx.beginPath();
        ctx.moveTo(p[i - 3] * scale, p[i - 2] * scale);
        ctx.lineTo(p[i] * scale, p[i + 1] * scale);
        ctx.stroke();
      }
    });
  }

  /* dark ink on white — what handwriting reading reads best */
  function toPNG(ink, opts){
    opts = opts || {};
    const pad = 20, scale = opts.scale || 1;
    let maxY = 0;
    (ink.strokes || []).forEach(st => { for(let i = 1; i < st.p.length; i += 3) maxY = Math.max(maxY, st.p[i]); });
    const h = Math.min(ink.H, Math.max(200, maxY + 60));
    const c = document.createElement('canvas');
    c.width = (W + pad * 2) * scale; c.height = (h + pad * 2) * scale;
    const g = c.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height);
    g.translate(pad * scale, pad * scale);
    draw(g, ink, scale, { mono: '#111111' });
    return c.toDataURL('image/png');
  }

  /* Put a pad in `host`. onChange(ink) fires after every stroke. */
  function mount(host, ink, onChange, opts){
    opts = opts || {};
    ink = ink && ink.strokes ? JSON.parse(JSON.stringify(ink)) : blank();
    let colour = COLOURS[0], size = 'medium', tool = 'pen', penSeen = false;
    const undo = [];

    host.innerHTML = `
      <div class="ink-bar" role="toolbar" aria-label="Ink tools">
        <button type="button" class="ink-b on" data-ink="pen" aria-label="Pen" aria-pressed="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16z"/></svg></button>
        <button type="button" class="ink-b" data-ink="eraser" aria-label="Eraser — tap a stroke to remove it" aria-pressed="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 20h12M5 15l8-8 5 5-6 6H8z"/></svg></button>
        <span class="ink-sep"></span>
        ${COLOURS.map((c, i) => `<button type="button" class="ink-c${i ? '' : ' on'}" data-colour="${c}" style="--c:${c}" aria-label="Colour ${i + 1}"></button>`).join('')}
        <span class="ink-sep"></span>
        <select class="ink-size" aria-label="Pen size">
          <option value="fine">Fine</option><option value="medium" selected>Medium</option><option value="bold">Bold</option></select>
        <span class="ink-grow"></span>
        <button type="button" class="ink-b" data-ink="undo" aria-label="Undo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/></svg></button>
        <button type="button" class="ink-b" data-ink="clear" aria-label="Clear the page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
      </div>
      <div class="ink-page"><canvas class="ink-cv" aria-label="Writing area"></canvas></div>
      <button type="button" class="ink-more">+ More room</button>`;

    const page = host.querySelector('.ink-page');
    const cv = host.querySelector('.ink-cv');
    const g = cv.getContext('2d');
    let scale = 1, dpr = 1;

    function fit(){
      const w = page.clientWidth || 600;
      dpr = global.devicePixelRatio || 1;
      scale = w / W;
      cv.style.width = w + 'px'; cv.style.height = (ink.H * scale) + 'px';
      cv.width = Math.round(w * dpr); cv.height = Math.round(ink.H * scale * dpr);
      redraw();
    }
    function redraw(){
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      /* faint ruled lines, like paper */
      g.strokeStyle = 'rgba(237,229,210,.06)'; g.lineWidth = 1;
      for(let y = 60; y < ink.H; y += 60){ g.beginPath(); g.moveTo(0, y * scale); g.lineTo(W * scale, y * scale); g.stroke(); }
      draw(g, ink, scale);
    }
    const changed = () => { onChange && onChange(ink); };

    /* ---- drawing ---- */
    let cur = null, pid = null;
    const at = e => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / scale), Math.round((e.clientY - r.top) / scale)]; };
    const pressure = e => Math.round(((e.pointerType === 'pen' && e.pressure) ? e.pressure : 0.5) * 100);

    function hit(x, y){
      for(let i = ink.strokes.length - 1; i >= 0; i--){
        const p = ink.strokes[i].p;
        for(let j = 0; j < p.length; j += 3) if(Math.abs(p[j] - x) < 14 && Math.abs(p[j + 1] - y) < 14) return i;
      }
      return -1;
    }

    cv.addEventListener('pointerdown', e => {
      if(e.pointerType === 'pen') penSeen = true;
      if(penSeen && e.pointerType === 'touch') return;      /* palm on the screen */
      if(pid !== null) return;
      e.preventDefault();
      const [x, y] = at(e);
      if(tool === 'eraser'){
        const i = hit(x, y);
        if(i >= 0){ undo.push(JSON.stringify(ink.strokes)); ink.strokes.splice(i, 1); redraw(); changed(); }
        return;
      }
      pid = e.pointerId; try { cv.setPointerCapture(pid); } catch(_){}
      undo.push(JSON.stringify(ink.strokes));
      if(undo.length > 60) undo.shift();
      cur = { c: colour, s: SIZES[size], p: [x, y, pressure(e)] };
      ink.strokes.push(cur);
      redraw();
    });
    cv.addEventListener('pointermove', e => {
      if(e.pointerId !== pid || !cur) return;
      e.preventDefault();
      let evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if(!evs.length) evs = [e];
      evs.forEach(ev => {
        const [x, y] = at(ev), p = cur.p;
        if(Math.abs(p[p.length - 3] - x) + Math.abs(p[p.length - 2] - y) < 2) return;
        p.push(x, y, pressure(ev));
      });
      /* draw just the newest piece, the full redraw happens on lift */
      const p = cur.p, n = p.length;
      if(n >= 6){
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.lineCap = 'round'; g.strokeStyle = cur.c;
        g.lineWidth = Math.max(0.6, cur.s * scale * (0.55 + p[n - 1] / 100 * 0.9));
        g.beginPath(); g.moveTo(p[n - 6] * scale, p[n - 5] * scale); g.lineTo(p[n - 3] * scale, p[n - 2] * scale); g.stroke();
      }
    });
    const end = e => {
      if(e.pointerId !== pid) return;
      pid = null;
      if(cur){
        const maxY = Math.max(...cur.p.filter((v, i) => i % 3 === 1));
        if(maxY > ink.H - 80){ ink.H += 300; fit(); }      /* the page grows as you write down it */
        cur = null; redraw(); changed();
      }
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.style.touchAction = 'none';

    /* ---- tools ---- */
    host.addEventListener('click', e => {
      const b = e.target.closest('[data-ink]');
      const c = e.target.closest('[data-colour]');
      if(c){
        colour = c.dataset.colour; tool = 'pen';
        host.querySelectorAll('.ink-c').forEach(x => x.classList.toggle('on', x === c));
        host.querySelectorAll('[data-ink="pen"],[data-ink="eraser"]').forEach(x => {
          x.classList.toggle('on', x.dataset.ink === 'pen'); x.setAttribute('aria-pressed', String(x.dataset.ink === 'pen')); });
        return;
      }
      if(e.target.closest('.ink-more')){ ink.H += 300; fit(); changed(); return; }
      if(!b) return;
      const a = b.dataset.ink;
      if(a === 'pen' || a === 'eraser'){
        tool = a;
        host.querySelectorAll('[data-ink="pen"],[data-ink="eraser"]').forEach(x => {
          x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      }
      if(a === 'undo' && undo.length){ ink.strokes = JSON.parse(undo.pop()); redraw(); changed(); }
      if(a === 'clear' && ink.strokes.length){
        if(opts.confirm && !opts.confirm('Clear the whole page?')) return;
        undo.push(JSON.stringify(ink.strokes)); ink.strokes = []; ink.H = 600; fit(); changed();
      }
    });
    host.querySelector('.ink-size').addEventListener('change', e => { size = e.target.value; });

    const ro = global.ResizeObserver ? new ResizeObserver(() => fit()) : null;
    if(ro) ro.observe(page); else global.addEventListener('resize', fit);
    fit();

    return {
      get: () => ink,
      png: () => toPNG(ink),
      destroy: () => { if(ro) ro.disconnect(); host.innerHTML = ''; }
    };
  }

  /* a small read-only preview of a note's ink */
  function preview(canvas, ink, width){
    const w = width || 300, s = w / W;
    let maxY = 0;
    (ink.strokes || []).forEach(st => { for(let i = 1; i < st.p.length; i += 3) maxY = Math.max(maxY, st.p[i]); });
    const h = Math.max(60, Math.min(ink.H, maxY + 30)) * s;
    const dpr = global.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(g, ink, s);
  }

  /* the styling, once, so both apps get the same pad */
  function css(){
    if(document.getElementById('ink-css')) return;
    const st = document.createElement('style'); st.id = 'ink-css';
    st.textContent = `
      .ink-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}
      .ink-b{width:36px;height:36px;display:grid;place-items:center;border:1px solid #2F2C26;border-radius:4px;background:#151515;color:#969185;padding:0;cursor:pointer}
      .ink-b svg{width:18px;height:18px}
      .ink-b.on{border-color:#FB6900;color:#FB6900}
      .ink-c{width:26px;height:26px;border-radius:50%;border:2px solid #2F2C26;background:var(--c);padding:0;cursor:pointer}
      .ink-c.on{border-color:#FB6900;box-shadow:0 0 0 2px #151515 inset}
      .ink-sep{width:1px;height:22px;background:#2F2C26;margin:0 2px}
      .ink-grow{flex:1}
      .ink-size{height:34px;border:1px solid #2F2C26;border-radius:4px;background:#151515;color:#EDE5D2;font:inherit;font-size:13px;padding:0 6px}
      .ink-page{background:#151515;border:1px solid #2F2C26;border-radius:4px;overflow:hidden}
      .ink-cv{display:block;cursor:crosshair}
      .ink-more{margin-top:6px;border:0;background:none;color:#969185;font:inherit;font-size:13px;cursor:pointer;padding:4px 0}
      .ink-more:hover{color:#EDE5D2}`;
    document.head.appendChild(st);
  }

  global.InkPad = { mount, preview, toPNG, isEmpty, css, blank };
})(window);
