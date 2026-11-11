/* Two thin wrappers, so a thing can live in more than one place without being
   written twice.

   The month calendar was a tool and is now the second tab; the weekly review was
   the second tab and is now a tool called Insights. Neither was rewritten — each
   is hosted where it now belongs. */
(function(global){

  /* The month, as a tab, with two sections: the calendar as it always was, and
     the challenge months. Same floating nav as the Content tab, so the two tabs
     that hold sections work the same way. The calendar itself is untouched —
     it is hosted here exactly as it was hosted before. */
  const MNAV = [
    { v:'calendar', label:'Calendar', screen:'calendar',
      d:'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
    { v:'months',   label:'Months',   screen:'months',
      d:'M5 21V4M5 4h11l-2 4 2 4H5' },
    /* Creator Studio 3: the laptop Planner's week board — the laptop opens on it */
    { v:'week',     label:'Week',     screen:'week-board',
      d:'M3 5h18v15H3zM3 9h18M8.5 9v11M14 9v11' }
  ];
  let section = (global.matchMedia && matchMedia('(min-width: 900px)').matches) ? 'week' : 'calendar';

  (function css(){
    if(document.getElementById('mn-css')) return;
    const st = document.createElement('style');
    st.id = 'mn-css';
    /* the same host rules the Content tab uses: one level of padding, and room
       at the bottom for the floating nav */
    st.textContent = `#mnWrap{min-width:0;overflow-x:hidden}
      #mnWrap > .view{padding-top:0;padding-left:0;padding-right:0;
        padding-bottom:calc(var(--h-tabbar) + var(--sab) + 84px)}`;
    document.head.appendChild(st);
  })();

  const ViewMonth = {
    async mount(el){
      async function show(){
        el.innerHTML = `
          <div id="mnWrap"></div>
          <nav class="ctnav">${MNAV.map(n => `
            <button data-mv="${n.v}" ${section === n.v ? 'aria-current="page"' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"><path d="${n.d}"/></svg>
              ${n.label}</button>`).join('')}</nav>`;
        const host = el.querySelector('#mnWrap');
        if(global.Select) Select.reset();
        const target = MNAV.find(n => n.v === section) || MNAV[0];
        const ok = Screens.mountInto
          ? Screens.mountInto(target.screen, host, { embedded:true, onChange:show })
          : null;
        if(!ok) host.innerHTML = '<div class="view"><div class="empty">' +
          '<b>Not available</b>That section could not be opened.</div></div>';
      }
      if(!el.dataset.wiredMonthTab){
        el.dataset.wiredMonthTab = '1';
        el.addEventListener('click', e => {
          const b = e.target.closest('[data-mv]');
          if(b && b.dataset.mv !== section){ section = b.dataset.mv; show(); }
        });
      }
      await show();
    }
  };

  /* the weekly review, as a screen behind the Insights tile */
  Screens.register('insights', async (el) => {
    el.innerHTML = Screens.bar({ kicker:'Creator studio', title:'Insights' }) +
      '<div id="insWrap" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>';
    const host = el.querySelector('#insWrap');
    if(global.ViewWeekly && ViewWeekly.mount) await ViewWeekly.mount(host);
    else host.innerHTML = '<div class="view"><div class="empty">' +
      '<b>Not available</b>The weekly review could not be opened.</div></div>';
  });

  global.ViewMonth = ViewMonth;
})(window);
