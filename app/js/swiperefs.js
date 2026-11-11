/* Swipe references — the videos you are borrowing from, shown right inside a
   clip or a task. A clip holds its own list; a task shows its clip's list plus
   anything linked to the task itself, so nothing has to be linked twice.

   The host screen renders an empty slot and calls fill(); everything else
   (opening, unlinking, the picker) is handled here through wire(). */
(function(global){

  const CSS = `
  .swr-strip{display:flex;gap:10px;overflow-x:auto;padding:2px 0 6px;scroll-snap-type:x proximity}
  .swr-card{position:relative;flex:0 0 132px;scroll-snap-align:start}
  .swr-open{display:block;width:100%;padding:0;border:1px solid #2B2822;border-radius:var(--r);
    background:var(--surface-2);color:var(--cream);text-align:left;cursor:pointer;overflow:hidden}
  .swr-open .thumb::before{content:"";display:block;padding-top:125%}   /* 4:5 without aspect-ratio — see .swipecard .thumb in styles.css */
  .swr-open .thumb{position:relative;display:block;background-size:cover;
    background-position:center;background-color:#221F1A;overflow:hidden}
  .swr-open .src{position:absolute;left:6px;top:6px;z-index:2;font-size:10.5px;font-weight:800;
    letter-spacing:.08em;padding:3px 6px;border-radius:3px;background:rgba(10,8,6,.75)}
  .swr-open .t{display:block;padding:8px 9px 9px;font-size:13px;font-weight:700;line-height:1.3;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .swr-rm{position:absolute;right:6px;top:6px;z-index:3;width:24px;height:24px;border-radius:50%;
    border:0;background:rgba(10,8,6,.8);color:var(--cream);font-size:15px;line-height:24px;padding:0;cursor:pointer}
  .swr-from{position:absolute;left:6px;bottom:44px;z-index:3;font-size:10px;font-weight:800;
    letter-spacing:.08em;text-transform:uppercase;padding:3px 6px;border-radius:3px;
    background:rgba(10,8,6,.8);color:var(--muted)}
  .swr-empty{margin:0 0 10px;font-size:14px;color:var(--muted);line-height:1.5}
  .swr-pick{display:flex;align-items:center;gap:11px;width:100%;padding:8px;margin:0 0 6px;
    border:1px solid #2B2822;border-radius:var(--r);background:var(--surface-2);color:var(--cream);
    text-align:left;cursor:pointer}
  .swr-pick i{flex:0 0 44px;height:55px;border-radius:4px;background-size:cover;background-position:center;
    background-color:#221F1A}
  .swr-pick b{display:block;font-size:14.5px;line-height:1.3}
  .swr-pick small{display:block;font-size:12px;color:var(--muted);margin-top:2px}
  .swr-pick[aria-pressed="true"]{border-color:var(--orange)}
  `;
  function injectCSS(){
    if(document.getElementById('swr-css')) return;
    const st = document.createElement('style');
    st.id = 'swr-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  async function records(ids){
    const out = [];
    for(const id of ids){
      try { const s = await Store.get('swipes', id); if(s) out.push(s); } catch(e){}
    }
    return out;
  }

  const esc = t => String(t || '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  function card(s, own, from){
    const V = global.SwipeView;
    const so = V.SOURCES[s.source] || V.SOURCES.reel;
    return `<div class="swr-card">
      <button class="swr-open" data-swr-open="${s.id}">
        <span class="thumb" style="background-image:${V.coverFor(s)}">
          <span class="src" style="color:${so.c}">${V.SHORT[s.source] || 'REEL'}</span>
        </span>
        <span class="t">${esc(s.title) || 'Untitled swipe'}</span>
      </button>
      ${own ? `<button class="swr-rm" data-swr-rm="${s.id}" aria-label="Unlink">×</button>` : ''}
      ${from ? `<span class="swr-from">${esc(from)}</span>` : ''}
    </div>`;
  }

  /* Instagram previews need a laid-out card to size against, so a closed
     section waits until it is opened. */
  function mountEmbeds(root){
    if(!global.SwipeView) return;
    root.querySelectorAll('.swr-open .thumb[data-ig]').forEach(th => {
      if(th.clientWidth > 0) global.SwipeView.mountIgEmbed(th);
    });
  }

  /* own: ids linked here. inherited: [{ id, from }] shown read-only. */
  async function fill(slot, { own = [], inherited = [], empty } = {}){
    if(!slot) return;
    injectCSS();
    if(!global.SwipeView){
      slot.innerHTML = `<p class="swr-empty">Open the Swipe tab once so references can load.</p>`;
      return;
    }
    await global.SwipeView.loadThumbs();
    const ownRecs = await records(own);
    const inhIds = inherited.filter(x => !own.includes(x.id));
    const inhRecs = await records(inhIds.map(x => x.id));
    const cards = ownRecs.map(s => card(s, true, ''))
      .concat(inhRecs.map(s => card(s, false, (inhIds.find(x => x.id === s.id) || {}).from)));
    slot.innerHTML = `
      ${cards.length ? `<div class="swr-strip">${cards.join('')}</div>`
        : `<p class="swr-empty">${empty || 'No swipes linked yet. Link the videos you are borrowing from so they are one tap away.'}</p>`}
      <button class="cp-add" data-swr-add style="margin-top:6px">${cards.length ? '+ Add another swipe' : '+ Link a swipe'}</button>`;
    requestAnimationFrame(() => mountEmbeds(slot));
    const det = slot.closest('details');
    if(det && !det._swrToggle){
      det._swrToggle = true;
      det.addEventListener('toggle', () => { if(det.open) requestAnimationFrame(() => mountEmbeds(det)); });
    }
  }

  /* The searchable list of every swipe; tapping one links it and closes. */
  async function pick(exclude, onPick){
    injectCSS();
    if(!global.SwipeView) return U.toast('Open the Swipe tab once first');
    await global.SwipeView.loadThumbs();
    const { values } = await Store.all('swipes');
    const all = values.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
    if(!all.length) return U.toast('Your swipe file is empty');
    const V = global.SwipeView;
    const row = s => `<button class="swr-pick" data-pick="${s.id}" aria-pressed="${exclude.includes(s.id)}">
      <i style="background-image:${V.coverFor(s)}"></i>
      <span><b>${esc(s.title) || 'Untitled swipe'}</b>
        <small>${(V.SOURCES[s.source] || V.SOURCES.reel).n}${exclude.includes(s.id) ? ' · already linked' : ''}</small></span>
    </button>`;
    const filter = q => all.filter(s => !q ||
      ((s.title || '') + ' ' + (s.hook || '') + ' ' + (s.why || '')).toLowerCase().includes(q));
    App.sheet(`
      <h2>Link a swipe</h2>
      <div class="field"><input id="swr-q" type="text" placeholder="Search your swipes…"></div>
      <div id="swr-list" style="max-height:55vh;overflow:auto">${filter('').slice(0, 80).map(row).join('')}</div>
      <div class="sheetcta"><button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
      const q = sheetEl.querySelector('#swr-q'), list = sheetEl.querySelector('#swr-list');
      q.addEventListener('input', () => {
        list.innerHTML = filter(q.value.trim().toLowerCase()).slice(0, 80).map(row).join('');
      });
      sheetEl.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        const b = e.target.closest('[data-pick]');
        if(!b) return;
        if(exclude.includes(b.dataset.pick)) return U.toast('Already linked');
        App.closeSheet();
        await onPick(b.dataset.pick);
      });
    });
  }

  /* One listener per host screen. getOwn() returns the current list so the
     handlers never act on a stale copy after a re-render. */
  function wire(root, { getOwn, add, remove, onOpenChange }){
    if(root._swrWired) return;
    root._swrWired = true;
    root.addEventListener('click', async e => {
      const op = e.target.closest('[data-swr-open]');
      if(op){ e.stopPropagation(); return Screens.push('swipe', { id: op.dataset.swrOpen, onChange: onOpenChange }); }
      const rm = e.target.closest('[data-swr-rm]');
      if(rm){ e.stopPropagation(); await remove(rm.dataset.swrRm); return; }
      const ad = e.target.closest('[data-swr-add]');
      if(ad){ e.stopPropagation(); return pick(getOwn(), add); }
    });
  }

  global.SwipeRefs = { fill, pick, wire, mountEmbeds };
})(window);
