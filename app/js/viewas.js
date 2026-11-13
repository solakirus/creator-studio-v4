/* View as: Grid / Big / List for the long lists on a laptop screen.

   On the phone these lists are one card per row and that is right. Across a
   1920px laptop the same layout made every clip a banner and every swipe the
   size of the window, so from 900px wide each list gets a small switch in its
   header. The choice is kept per list on this device (localStorage), and the
   classes it sets only do anything inside the 900px media query in
   styles.css, so a phone never changes even if a choice was saved.

     ViewAs.picker('clips')   the switch, for a page header
     ViewAs.cls('clips')      'lay-grid' | 'lay-big' | 'lay-list', for the list
     data-lay-host="clips"    on the list, so a switch updates it in place

   A change fires window 'cs-layout' {key, value} for lists that need to
   redraw (the swipe file sizes its Instagram previews to the card). */
(function(global){
  const MODES = ['grid', 'big', 'list'];
  const LABEL = { grid:'Grid', big:'Big', list:'List' };
  const ICON = {
    grid:'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
    big:'M4 4h16v7H4zM4 14h16v6H4z',
    list:'M4 6h2.5M9.5 6H20M4 12h2.5M9.5 12H20M4 18h2.5M9.5 18H20'
  };
  const KEY = k => 'cs4-lay-' + k;

  function get(k){
    try { const v = global.localStorage.getItem(KEY(k)); if(LABEL[v]) return v; } catch(e){}
    return 'grid';
  }
  const cls = k => 'lay-' + get(k);

  function set(k, v){
    if(!LABEL[v]) return;
    try { global.localStorage.setItem(KEY(k), v); } catch(e){}
    document.querySelectorAll(`[data-lay-host="${k}"]`).forEach(h => {
      MODES.forEach(m => h.classList.remove('lay-' + m));
      h.classList.add('lay-' + v);
    });
    document.querySelectorAll(`[data-lay-pick="${k}"] [data-lay]`).forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.lay === v)));
    global.dispatchEvent(new CustomEvent('cs-layout', { detail:{ key:k, value:v } }));
  }

  function picker(k){
    const on = get(k);
    return `<span class="laypick" role="group" aria-label="View as" data-lay-pick="${k}">${MODES.map(v =>
      `<button type="button" data-lay="${v}" aria-pressed="${on === v}" title="${LABEL[v]}" aria-label="View as ${LABEL[v]}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"
          stroke-linejoin="round"><path d="${ICON[v]}"/></svg></button>`).join('')}</span>`;
  }

  /* Capture, and stopped there: the switch sits inside headers whose own
     click handlers read data attributes, and a view change is never one of
     their actions. */
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-lay-pick] [data-lay]');
    if(!b) return;
    e.preventDefault(); e.stopPropagation();
    set(b.closest('[data-lay-pick]').dataset.layPick, b.dataset.lay);
  }, true);

  global.ViewAs = { get, set, cls, picker, MODES };
})(window);
