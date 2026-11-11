/* Content — the three things you publish, behind one nav.

   Episodes are outlines with acts, Videos are one-offs belonging to nothing, and
   Series are runs with a cadence. They were scattered across a tab and a tool
   tile; they are the same kind of decision, so they sit together. Each section
   is the screen or view it always was — nothing was rewritten to live here. */
(function(global){

  const NAV = [
    /* The quarter is set up once every twelve weeks, so it does not earn a
       permanent button; it is reached from the line at the top of a week's plan.
       Clips are the footage itself and get looked at daily once you are shooting. */
    { v:'episodes', label:'Episodes', screen:'vlog-builder',
      d:'M4 5h16v14H4zM4 9.5h16M9.5 9.5V19' },
    { v:'series',   label:'Series',   view:'ViewSeries',
      d:'M3.8 5h16.4v13.4H3.8zM10 8.9v6.2l5.2-3.1z' },
    { v:'clips',    label:'Clips',    screen:'clips-screen',
      d:'M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4' },
    /* The swipe file lived two levels down under Tools → Shots, which is a long
       way from where you use it: deciding how to shoot something. */
    { v:'swipe',    label:'Swipe',    screen:'swipe-file',
      d:'M4 6h11v12H4zM17 8h3v8h-3M7.5 9.5l4 2.5-4 2.5z' },
    /* Creator Studio 3: the canvas. Every video's board, plus free boards
       and folders for everything that isn't one video. */
    { v:'boards',   label:'Boards',   screen:'boards-home',
      d:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 16.5h7M16.5 13v7' },
    /* From Shotline: the Library of GIFs, clips and stills to plan with, and
       the Templates — shot structures, task lists, looks and notebook pages. */
    { v:'library',  label:'Library',  screen:'library', laptop:true,
      d:'M4 5h5v14H4zM10.5 5h4v14h-4zM16 6.2l3.6-1 3 13.6-3.6 1z' },
    { v:'templates', label:'Templates', screen:'shot-templates', laptop:true,
      d:'M5 3h10l4 4v14H5zM15 3v4h4M8 11h8M8 14.5h8M8 18h5' }
  ];

  /* v4: the Library and Templates are where planning happens, on the laptop.
     The phone gets what they put on tasks and videos (taskframes.js), not the
     Library itself. window.CS3Lib is the laptop's disk bridge (electron/preload.js). */
  const onLaptop = () => !!global.CS3Lib;
  const shown = () => NAV.filter(n => !n.laptop || onLaptop());

  let view = 'clips';

  async function mount(el){
    function shell(){
      /* Bottom, within thumb reach, floating just above the tab bar. It is fixed
         rather than in the flow so it cannot scroll away, and the section below
         leaves room for it. */
      el.innerHTML = `
        <div id="ctWrap"></div>
        <nav class="ctnav">${shown().map(n => `
          <button data-v="${n.v}" ${view === n.v ? 'aria-current="page"' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"><path d="${n.d}"/></svg>
            ${n.label}</button>`).join('')}</nav>`;
    }

    async function show(){
      shell();
      const host = el.querySelector('#ctWrap');
      if(!shown().some(n => n.v === view)) view = 'clips';
      const target = NAV.find(n => n.v === view);
      /* the section about to be replaced may have a selection bar open */
      if(global.Select) Select.reset();

      /* a section is either a registered screen or one of the tab views */
      if(target.screen){
        const ok = Screens.mountInto
          ? Screens.mountInto(target.screen, host, { embedded:true, onChange:show })
          : null;
        if(ok) return;
      }
      if(target.view && global[target.view] && global[target.view].mount){
        await global[target.view].mount(host);
        return;
      }
      host.innerHTML = '<div class="view"><div class="empty">' +
        '<b>Not available</b>That section could not be opened.</div></div>';
    }

    if(!el.dataset.wiredContent){
      el.dataset.wiredContent = '1';
      el.addEventListener('click', e => {
        const v = e.target.closest('[data-v]');
        if(v && v.dataset.v !== view){ view = v.dataset.v; show(); }
      });
    }

    await show();
  }

  global.ViewContent = { mount, NAV };
})(window);
