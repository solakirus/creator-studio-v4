/* Shots — the planned list, the reference library and the swipe file together.

   They answer the same question at three distances: what am I shooting, what
   should it look like, and what made me want to shoot it. Keeping them apart
   meant crossing the app to check one against another. */
(function(){

  const NAV = [
    { v:'list', label:'Shot list', screen:'shot-list',
      d:'M2.5 6h13v12h-13zM15.5 10.5L21.5 7.5v9l-6-3M6 12h5' },
    { v:'refs', label:'References', screen:'reference-library',
      d:'M3 5h18v14H3zM3 10h18M9 10v9' },
    { v:'swipe', label:'Swipe file', screen:'swipe-file',
      d:'M6 3h12v18l-6-4-6 4z' }
  ];

  async function mount(el, params){
    let view = (params && params.view) || 'list';

    function shell(){
      el.innerHTML = `
        <div id="scWrap" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>
        <nav class="console-nav">${NAV.map(n => `
          <button class="cbtn" data-v="${n.v}" ${view === n.v ? 'aria-current="page"' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"><path d="${n.d}"/></svg>
            ${n.label}</button>`).join('')}</nav>`;
    }

    /* Each half is a screen in its own right; the console just hosts it and keeps
       the nav underneath, so neither had to be rewritten to live here. */
    async function show(){
      shell();
      const host = el.querySelector('#scWrap');
      const target = NAV.find(n => n.v === view);
      const inner = Screens.mountInto
        ? Screens.mountInto(target.screen, host, { embedded:true, onChange:show })
        : null;
      if(!inner) host.innerHTML = '<div class="view"><div class="empty">' +
        '<b>Not available</b>That half could not be opened.</div></div>';
    }

    el.addEventListener('click', e => {
      const v = e.target.closest('[data-v]');
      if(v && v.dataset.v !== view){ view = v.dataset.v; show(); }
    });

    show();
  }

  Screens.register('shots-console', mount);
})();
