/* Shots — This week, My shots and Core references together (v4).

   They answer the same question at three distances: what am I shooting, what
   should it look like, and what made me want to shoot it. Keeping them apart
   meant crossing the app to check one against another. */
(function(){

  /* v4: what to shoot this week (by place), your own shots and templates,
     and the videos that define the look (screens/shots-hub.js) */
  const NAV = [
    { v:'week', label:'This week', screen:'shots-week',
      d:'M3 5h18v15H3zM3 9h18M8 3v4M16 3v4M7 13h3M7 16.5h3M13 13h4' },
    { v:'bank', label:'My shots', screen:'shot-bank',
      d:'M2.5 6h13v12h-13zM15.5 10.5L21.5 7.5v9l-6-3M6 12h5' },
    { v:'core', label:'Core refs', screen:'core-refs',
      d:'M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9z' }
  ];

  async function mount(el, params){
    let view = (params && params.view) || 'week';

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
