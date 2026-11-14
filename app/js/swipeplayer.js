/* Swipe player — watch a swipe in a pop-out over the swipe file.

   The play badge on a card used to leave the app for the platform's page.
   Now it opens the platform's own player (embed.js: Instagram, TikTok,
   YouTube, Facebook) in a lightbox over the grid. Step through the swipes
   you're looking at (the filtered list) with ‹ ›, a sideways swipe on the
   dark area, or ← → on a keyboard; close with ✕, Esc or a tap outside.
   A link with no player (X, a newsletter) shows its cover and the way out.

   Sort it: one slim row under the video — a button per filter (Use it for,
   Vibe, Channel, Folder…) with how many are picked. Tapping one opens just
   its options in one more row; tapping it again folds it (the open one is
   remembered). Only that row redraws: the video doesn't reload.

     SwipePlayer.open(list, index, { cover(s), openSwipe(s), onClose(),
       panel:{ groups: async s => [{ k, label, opts:[{ p, v, label, on, color }] }],
               click: async (s, el) => updatedSwipe } })   */
(function(global){
  let box = null, list = [], i = 0, opts = {};

  /* the player's size for its platform, inside the screen */
  function frame(url, room){
    const e = global.Embed ? Embed.forUrl(url) : null;
    if(!e) return null;
    const vw = Math.min(innerWidth, document.documentElement.clientWidth || innerWidth);
    const maxW = vw - 24, maxH = Math.max(220, innerHeight - (room || 190));
    let w, h, src = e.src;
    if(e.kind === 'youtube'){
      const tall = /\/shorts\//i.test(url);
      src += (src.includes('?') ? '&' : '?') + 'autoplay=1&playsinline=1';
      if(tall){ h = Math.min(maxH, 760); w = Math.min(maxW, Math.round(h * 9 / 16)); h = Math.round(w * 16 / 9); }
      else { w = Math.min(maxW, 1000); h = Math.round(w * 9 / 16); if(h > maxH){ h = maxH; w = Math.round(h * 16 / 9); } }
    } else if(e.kind === 'tiktok'){ w = Math.min(maxW, 340); h = Math.min(maxH, 740); }
    else if(e.kind === 'instagram'){ w = Math.min(maxW, 400); h = Math.min(maxH, 680); }
    else { w = Math.min(maxW, 420); h = Math.min(maxH, 720); }
    return { kind:e.kind, src, w, h };
  }

  const esc = t => global.U && U.esc ? U.esc(t) : String(t == null ? '' : t);
  const SITE = { instagram:'Instagram', tiktok:'TikTok', youtube:'YouTube', facebook:'Facebook' };
  function siteOf(url){
    const u = String(url || '');
    if(/instagram/i.test(u)) return 'Instagram';
    if(/tiktok/i.test(u)) return 'TikTok';
    if(/youtu/i.test(u)) return 'YouTube';
    if(/facebook|fb\.watch/i.test(u)) return 'Facebook';
    if(/twitter|x\.com/i.test(u)) return 'X';
    return 'the source';
  }

  const GROUP_KEY = 'cs4-spl-group';
  let openGroup = (() => { try { return localStorage.getItem(GROUP_KEY) || ''; } catch(e){ return ''; } })();

  async function drawPanel(){
    const p = box && box.querySelector('.spl-sort');
    if(!p) return;
    if(!opts.panel){ p.hidden = true; return; }
    const groups = (await opts.panel.groups(list[i])).filter(g => g.opts.length);
    if(!box) return;
    if(!groups.some(g => g.k === openGroup)) openGroup = '';
    const g = groups.find(x => x.k === openGroup);
    p.innerHTML = `<div class="spl-groups">${groups.map(x => {
        const n = x.opts.filter(o => o.on).length;
        return `<button class="spl-g" data-pg="${esc(x.k)}" aria-expanded="${x.k === openGroup}"${n ? ' data-has' : ''}>${esc(x.label)}${n ? ` · ${n}` : ''}</button>`;
      }).join('')}</div>
      ${g ? `<div class="spl-opts">${g.opts.map(o => `<button class="spl-chip" data-p="${esc(o.p)}" data-v="${esc(o.v)}" aria-pressed="${!!o.on}">${
        o.color ? `<i style="background:${o.color}"></i>` : ''}${esc(o.label)}</button>`).join('')}</div>` : ''}`;
  }

  async function draw(){
    const s = list[i];
    if(!s){ close(); return; }
    await drawPanel();
    if(!box) return;
    /* room for one options row even while folded, so opening one never
       pushes the video about */
    const room = 70 + box.querySelector('.spl-foot').offsetHeight + 20 + (opts.panel && !openGroup ? 42 : 0);
    const f = frame(s.url, room);
    const title = s.title && !/^untitled swipe$/i.test(s.title) ? s.title : (s.author ? '@' + s.author : 'Untitled swipe');
    const cover = opts.cover ? opts.cover(s) : '';
    box.querySelector('.spl-stage').innerHTML = f
      ? `<iframe class="spl-frame" src="${f.src}" style="width:${f.w}px;height:${f.h}px" frameborder="0"
          allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowfullscreen title="${esc(title)}"></iframe>`
      : `<div class="spl-none" style="background-image:${cover}">
          <p>${esc(siteOf(s.url))} doesn't let its videos play inside other apps.</p>
          ${s.url ? `<a class="btn-primary" href="${esc(s.url)}" target="_blank" rel="noopener">Open on ${esc(siteOf(s.url))}</a>` : ''}</div>`;
    box.querySelector('.spl-title').textContent = title;
    box.querySelector('.spl-count').textContent = list.length > 1 ? `${i + 1} of ${list.length}` : '';
    box.querySelector('[data-spl="prev"]').disabled = i <= 0;
    box.querySelector('[data-spl="next"]').disabled = i >= list.length - 1;
    const src = box.querySelector('[data-spl="source"]');
    src.hidden = !s.url; src.textContent = `↗ ${siteOf(s.url)}`;
  }

  function go(d){ const n = i + d; if(n < 0 || n >= list.length) return; i = n; draw(); }

  function onKey(e){
    if(!box) return;
    if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); }
    else if(e.key === 'ArrowRight'){ e.preventDefault(); e.stopPropagation(); go(1); }
    else if(e.key === 'ArrowLeft'){ e.preventDefault(); e.stopPropagation(); go(-1); }
  }

  function open(items, index, o){
    list = (items || []).filter(Boolean); i = Math.max(0, Math.min(index || 0, list.length - 1)); opts = o || {}; changed = false;
    if(!list.length) return;
    close();
    box = document.createElement('div');
    box.className = 'spl';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Watch the swipe');
    box.innerHTML = `
      <div class="spl-top">
        <span class="spl-count"></span>
        <button class="spl-x" data-spl="close" aria-label="Close">✕</button>
      </div>
      <div class="spl-mid">
        <button class="spl-nav" data-spl="prev" aria-label="Previous swipe">‹</button>
        <div class="spl-stage"></div>
        <button class="spl-nav" data-spl="next" aria-label="Next swipe">›</button>
      </div>
      <div class="spl-foot">
        <p class="spl-title"></p>
        <div class="spl-sort"></div>
        <div class="spl-acts">
          <button class="btn-sm" data-spl="swipe">Open the swipe</button>
          <button class="btn-sm" data-spl="source"></button>
        </div>
      </div>`;
    document.body.appendChild(box);
    document.documentElement.classList.add('spl-open');
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-spl]');
      if(b){
        const a = b.dataset.spl;
        if(a === 'close') return close();
        if(a === 'prev') return go(-1);
        if(a === 'next') return go(1);
        if(a === 'source'){ try { global.open(list[i].url, '_blank', 'noopener'); } catch(err){} return; }
        if(a === 'swipe'){ const s = list[i]; close(); if(opts.openSwipe) opts.openSwipe(s); return; }
      }
      const pg = e.target.closest('[data-pg]');
      if(pg){
        openGroup = openGroup === pg.dataset.pg ? '' : pg.dataset.pg;
        try { localStorage.setItem(GROUP_KEY, openGroup); } catch(err){}
        return drawPanel();
      }
      /* an option or folder in Sort it: only the strip redraws, the video plays on */
      const opt = e.target.closest('.spl-opts [data-p]');
      if(opt && opts.panel){
        (async () => {
          const s = await opts.panel.click(list[i], opt);
          if(s) list[i] = s;
          changed = true;
          drawPanel();
        })();
        return;
      }
      /* the dark around the player closes it */
      if(e.target === box || e.target.classList.contains('spl-mid') || e.target.classList.contains('spl-stage')) close();
    });
    /* a sideways swipe on the dark area steps through (the player itself
       keeps its own touches) */
    let sx = null, sy = null;
    box.addEventListener('pointerdown', e => {
      /* the Sort it rows scroll sideways themselves */
      if(e.target.closest('.spl-foot')){ sx = null; return; }
      sx = e.clientX; sy = e.clientY;
    });
    box.addEventListener('pointerup', e => {
      if(sx === null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5){ moved = true; go(dx < 0 ? 1 : -1); }
    });
    let moved = false;
    box.addEventListener('click', e => { if(moved){ moved = false; e.stopPropagation(); } }, true);
    document.addEventListener('keydown', onKey, true);
    draw();
  }

  /* Back (the phone's button or gesture) closes it: app.js goBack asks first */
  let changed = false;
  function close(){
    if(!box) return;
    box.remove(); box = null;
    document.documentElement.classList.remove('spl-open');
    document.removeEventListener('keydown', onKey, true);
    /* sorted something while watching: the grid behind catches up */
    if(changed && opts.onClose){ changed = false; opts.onClose(); }
  }

  global.SwipePlayer = { open, close, isOpen: () => !!box };
})(window);
