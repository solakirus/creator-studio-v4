/* Shell: tab routing, the Tools dock, the shared sheet and image picker. */
(function(global){
  const { slug } = U;

  const TOOLS = [
    { name:"Workout",    a:"#C4613A", b:"#6C2B1C", d:"M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" },
    { name:"Nutrition",  a:"#4B8A57", b:"#234A2A", d:"M12 8c0-3 2-5 5-5 0 3-2 5-5 5zM12 8c-3.5 0-6 2.5-6 6.5S8.5 22 12 22s6-3.5 6-7.5S15.5 8 12 8z" },
    { name:"Program", a:"#B4533A", b:"#5E2418", d:"M4 5h16v15H4zM8 3v4M16 3v4M4 10h16M7 14h3M7 17h7M13 14h4" },
    { name:"Shots", a:"#3C7FA8", b:"#1D4460", d:"M2.5 6h13v12h-13zM15.5 10.5L21.5 7.5v9l-6-3M6 12h5" },
    { name:"Quick Capture", a:"#C05A2A", b:"#6B2D10", d:"M12 5v14M5 12h14" },
    { name:"Notes",      a:"#3F6FA0", b:"#1E3A58", d:"M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5" },
    { name:"Insights",   a:"#4B8A57", b:"#234A2A", d:"M4 19V9M9.5 19V5M15 19v-7M20.5 19v-11M3 19h18" },
    /* the journal moved into Notes as a section — two kinds of writing in one
       place — which freed this tile for the thing that had nowhere to live */
    { name:"Planning",   a:"#C18A2E", b:"#6E4A12", d:"M4 4h16v16H4zM4 9h16M9 9v11M13 13h4M13 16h3" }
  ];
  const PRESETS = {
    ember:["#C4613A","#6C2B1C"], ocean:["#3C7FA8","#1D4460"], violet:["#7B4FA8","#3E2560"],
    moss:["#4B8A57","#234A2A"],  gold:["#C18A2E","#6E4A12"],  slate:["#5A6270","#2A3038"]
  };

  const TABS = [
    { id:'today',  label:'Today',  view:() => ViewToday,
      /* Solid silhouettes, the way the bar looked before. Where a shape needs a
         hole it is cut with evenodd so the gap is transparent — no second colour
         to go wrong against the bar or a future light theme. */
      icon:'<path fill-rule="evenodd" d="M6 4h12a1.6 1.6 0 0 1 1.6 1.6v13.8a1.6 1.6 0 0 1-1.6 1.6H6a1.6 1.6 0 0 1-1.6-1.6V5.6A1.6 1.6 0 0 1 6 4zM8.2 10.6l1.9 1.9 3.7-3.7 1.1 1.1-4.8 4.8-3-3zM8.4 16.6h7.2v1.5H8.4z"/>' },
    { id:'weekly', label:'Month', view:() => ViewMonth,
      icon:'<path fill-rule="evenodd" d="M7.2 2.6h1.6v2.2h6.4V2.6h1.6v2.2h1.8A1.6 1.6 0 0 1 20.2 6.4v12.6a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6V6.4a1.6 1.6 0 0 1 1.6-1.6h1.8zM5.4 10.2v8.8h13.2v-8.8zM7.2 12.2h2v2h-2zM11 12.2h2v2h-2zM14.8 12.2h2v2h-2zM7.2 15.8h2v2h-2zM11 15.8h2v2h-2z"/>' },
    { id:'tools',  label:'Tools',  view:null,
      icon:'<rect x="3" y="3" width="8" height="8" rx="1.8"/><rect x="13" y="3" width="8" height="8" rx="1.8"/><rect x="3" y="13" width="8" height="8" rx="1.8"/><rect x="13" y="13" width="8" height="8" rx="1.8"/>' },
    { id:'series', label:'Content', view:() => ViewContent,
      icon:'<path fill-rule="evenodd" d="M3.8 5h16.4a1.6 1.6 0 0 1 1.6 1.6v10.8a1.6 1.6 0 0 1-1.6 1.6H3.8a1.6 1.6 0 0 1-1.6-1.6V6.6A1.6 1.6 0 0 1 3.8 5zM10 8.9v6.2l5.2-3.1z"/>' },
    { id:'profile', label:'Profile', screen:'profile',
      icon:'<circle cx="12" cy="8.4" r="3.9"/><path d="M4.4 20.4a7.6 7.6 0 0 1 15.2 0z"/>' }
  ];

  /* v4: the Planner — this same app showing only planning: the week board,
     months and calendar (Plan), episodes, series, clips, templates and the
     Library (Content), Settings, and Send to phone. Opened by the "Creator
     Studio Planner" shortcut (Electron --planner) or ?planner in a browser.
     Same data as the full app on this device, so nothing is copied between them. */
  const PLANNER = /[?&]planner\b/.test(global.location ? location.search : '');
  global.CS4_PLANNER = PLANNER;
  if(PLANNER){
    const plan = TABS.find(t => t.id === 'weekly'), content = TABS.find(t => t.id === 'series');
    plan.label = 'Plan';
    TABS.length = 0;
    /* Draft: plan one idea with Claude, then import it (views/draft.js) */
    const draft = { id:'draft', label:'Draft', view:() => global.ViewDraft,
      icon:'<path d="M11 2.5l1.9 5.1 5.1 1.9-5.1 1.9L11 16.5l-1.9-5.1L4 9.5l5.1-1.9zM18.5 13.5l.95 2.55 2.55.95-2.55.95-.95 2.55-.95-2.55-2.55-.95 2.55-.95z"/>' };
    TABS.push(draft, plan, content, { id:'settings', label:'Settings', screen:'settings',
      icon:'<path fill-rule="evenodd" d="M10.3 2.6h3.4l.5 2.6 1.7.9 2.4-1.2 2.4 2.4-1.2 2.4.8 1.8 2.6.5v3.4l-2.6.5-.8 1.8 1.2 2.4-2.4 2.4-2.4-1.2-1.7.9-.5 2.6h-3.4l-.5-2.6-1.7-.9-2.4 1.2-2.4-2.4 1.2-2.4-.8-1.8-2.6-.5v-3.4l2.6-.5.8-1.8-1.2-2.4 2.4-2.4 2.4 1.2 1.7-.9zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z"/>' });
    document.documentElement.classList.add('planner');
    document.title = 'Creator Studio Planner';
  }
  const HOME = PLANNER ? 'weekly' : 'today';

  /* Send to phone: everything goes through Sync, so it's one sync now; with
     no Sync set up, the file for the other device instead */
  async function sendToPhone(btn){
    const s = global.Sync ? await Sync.status().catch(() => null) : null;
    if(s && s.connected){
      if(btn) btn.classList.add('busy');
      try { await Sync.syncNow(); U.toast('Sent — the phone, the iPad and the laptop get it the next time they sync (when opened, or within 3 minutes)'); }
      catch(e){ U.toast('Couldn’t reach the sync server — ' + (e.message || e) + '. It sends by itself once it can.'); }
      finally { if(btn) btn.classList.remove('busy'); }
      return;
    }
    if(global.SettingsActions && SettingsActions.exportForDevice){
      U.toast('Sync isn’t set up here — making a file for the phone instead (Settings → Restore from backup → Add to what’s here, on the phone)');
      return SettingsActions.exportForDevice();
    }
    U.toast('Set up Sync in Settings to send plans to the phone');
  }

  let current = null, toolIcons = {}, imageCb = null;
  const viewEl  = () => document.getElementById('view');
  const dockEl  = () => document.getElementById('dock');
  const panelEl = () => document.getElementById('panel');
  const scrimEl = () => document.getElementById('scrim');
  const sheetEl = () => document.getElementById('sheet');

  /* ---------- tools dock ---------- */
  function renderTools(){
    panelEl().querySelector('.grid').innerHTML = TOOLS.map(t => {
      const c = toolIcons[slug(t.name)];
      let style, cls = '';
      if(c && c.blob){ style = `background-image:url(${URL.createObjectURL(c.blob)})`; cls = ' custom'; }
      else if(c && c.preset && PRESETS[c.preset]){ const [a,b] = PRESETS[c.preset];
        style = `background:linear-gradient(150deg,${a},${b})`; }
      else style = `background:linear-gradient(150deg,${t.a},${t.b})`;
      return `<button class="tool" data-tool="${slug(t.name)}">
        <span class="icon${cls}" style="${style}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${t.d}"/></svg>
        </span><span>${t.name}</span></button>`;
    }).join('');
    measureDock();
  }
  function measureDock(){ dockEl().style.setProperty('--panel-h', panelEl().offsetHeight + 'px'); }
  /* One place decides which tab is lit, because it used to be decided in three
     and they disagreed: Profile stayed lit after you backed out of it, and
     opening Tools lit a second tab on top of the one you were already on. */
  function paintTabs(){
    const top = Screens.topId ? Screens.topId() : null;
    const asScreen = TABS.find(t => t.screen && t.screen === top);
    const lit = toolsOpen() ? 'tools' : asScreen ? asScreen.id : current;
    document.querySelectorAll('.tabbar .tab').forEach(b =>
      b.dataset.tab === lit
        ? b.setAttribute('aria-current', 'page')
        : b.removeAttribute('aria-current'));
  }

  /* The dock reads its artwork once at boot. Changing an icon in settings wrote
     to the store and nothing told the dock, so the new one only appeared after
     a restart. */
  async function reloadToolIcons(){
    try { toolIcons = await Store.allMap('toolicon'); }
    catch(e){ console.warn('Tool icons unavailable', e); }
    renderTools();
  }

  function setTools(on){
    dockEl().classList.toggle('open', on);
    scrimEl().classList.toggle('open', on);
    paintTabs();
  }
  const toolsOpen = () => dockEl().classList.contains('open');

  /* ---------- routing ---------- */
  function go(id){
    const t = TABS.find(x => x.id === id);
    if(t && t.screen){
      /* a tab that is really a screen: keep the previous view mounted underneath.
         paintTabs runs off the push, and again off the pop when he backs out. */
      Screens.push(t.screen, {});
      return;
    }
    const tab = TABS.find(t => t.id === id);
    if(!tab || !tab.view) return;
    if(toolsOpen()) setTools(false);
    current = id;
    paintTabs();
    const el = viewEl();
    el.innerHTML = '';
    el.scrollTop = 0;
    Promise.resolve(tab.view().mount(el)).catch(err => {
      console.error(err);
      el.innerHTML = '<div class="empty"><b>Something went wrong</b>Check the console.</div>';
    });
  }

  /* Redraw whatever tab is showing, without changing which one it is.
     Something arriving from outside — a shared link becoming a note — has no
     screen of its own to refresh, so the list underneath has to be told. */
  function refreshTab(){
    const tab = TABS.find(t => t.id === current);
    if(!tab || !tab.view) return false;
    const el = viewEl();
    const keep = el.scrollTop;
    el.innerHTML = '';
    Promise.resolve(tab.view().mount(el))
      .then(() => { el.scrollTop = keep; })
      .catch(err => console.error(err));
    return true;
  }

  /* ---------- shared sheet ---------- */
  function sheet(html, onReady){
    /* Every sheet wires its own handlers onto this node, and nothing ever took
       them off again — so the tenth sheet of a session ran the other nine's
       handlers too, and a save could pick up a field from a form that closed
       ten minutes ago. A fresh node carries the id and classes but none of the
       listeners. */
    const old = sheetEl();
    const s = old.cloneNode(false);
    old.parentNode.replaceChild(s, old);
    s.innerHTML = html;
    s.classList.add('open');
    /* lift the scrim above any pushed screens while a sheet is up */
    scrimEl().classList.add('open', 'above');
    if(onReady) onReady(s);
  }
  function closeSheet(){
    sheetEl().classList.remove('open');
    scrimEl().classList.remove('above');
    if(!toolsOpen()) scrimEl().classList.remove('open');
    setTimeout(() => { if(!sheetEl().classList.contains('open')) sheetEl().innerHTML = ''; }, 240);
  }

  /* ---------- image picker ---------- */
  function pickImage(cb){
    imageCb = cb;
    const input = document.getElementById('imgInput');
    if(!input){ U.toast('No image picker available here'); return; }
    input.value = '';
    try { input.click(); }
    catch(e){
      console.warn('File picker refused', e);
      U.toast('This browser will not open the picker — try the installed app');
    }
  }

  /* ---------- boot ---------- */
  async function init(){
    document.getElementById('tabbar').innerHTML = TABS.map(t => `
      <button class="tab" data-tab="${t.id}" aria-label="${t.label}">
        <svg viewBox="0 0 24 24" fill="currentColor">${t.icon}</svg>
      </button>`).join('') + (PLANNER ? `
      <button class="tab tab-import" data-import aria-label="Import plan" title="Paste a plan from Claude, or copy yours to refine in chat">
        <svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h11V8h-4V4zm5.2 4h1.6v5.6l1.9-1.9 1.1 1.1-3.8 3.8-3.8-3.8 1.1-1.1 1.9 1.9z"/></svg>
      </button>
      <button class="tab tab-send" data-send aria-label="Send to phone" title="Send the plan to the phone and the iPad">
        <svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 3v13h8V5zm2.5 15h3v-1h-3zM12 6.5l3.2 3.2-1.1 1.1-1.3-1.3V15h-1.6V9.5l-1.3 1.3-1.1-1.1z"/></svg>
      </button>` : '');

    await reloadToolIcons();

    document.getElementById('tabbar').addEventListener('click', e => {
      const b = e.target.closest('.tab'); if(!b) return;
      if(b.dataset.send !== undefined) return sendToPhone(b);
      if(b.dataset.import !== undefined){
        return global.PlanImportUI ? PlanImportUI.fromFile(() => refreshTab && refreshTab()) : U.toast('Import is not available');
      }
      /* On a wide screen the tabs stay visible beside pushed screens (the
         sidebar), so a tab has to close them — otherwise it changes the tab
         underneath and nothing seems to happen. On a phone screens cover the
         bar, so there is never anything to close. */
      while(Screens.depth && Screens.depth()) Screens.pop();
      if(b.dataset.tab === 'tools'){ setTools(!toolsOpen()); return; }
      go(b.dataset.tab);
    });

    /* Keyed by the tile's slug, which is what data-tool carries. Both the old
       and current names are listed so a renamed tile cannot orphan its screen. */
    /* One key per tile in TOOLS: a tile's key is slug(name). The old aliases
       went in v4 — nothing stores or pins a slug, so they could never fire.
       Renaming a tile means changing its key here too. */
    const TOOL_ROUTES = {
      workout:'workout',
      nutrition:'nutrition-home',
      program:'program',
      shots:'shots-console',
      'quick-capture':'quick-capture',
      notes:'notes',
      insights:'insights',
      planning:'planning'
    };
    panelEl().addEventListener('click', e => {
      const t = e.target.closest('[data-tool]'); if(!t) return;
      const route = TOOL_ROUTES[t.dataset.tool];
      setTools(false);
      if(route) Screens.push(route);
      else U.toast(t.querySelector('span:last-child').textContent + ' — not built yet');
    });

    scrimEl().addEventListener('click', () => {
      if(sheetEl().classList.contains('open')) return closeSheet();
      setTools(false);
    });
    document.addEventListener('keydown', e => {
      if(e.key !== 'Escape') return;
      if(sheetEl().classList.contains('open')) closeSheet();
      else setTools(false);
    });

    document.getElementById('imgInput').addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0];
      const cb = imageCb;
      imageCb = null;
      if(!f || !cb) return;
      try { await cb(f); }
      catch(err){
        console.error('Saving the image failed', err);
        U.toast('Could not save that image');
      }
    });

    /* First run after rules exist: record what is already true so the boosts
       that pop later are ones you actually just earned. */
    if(global.Rating && global.Store){
      Store.get('settings', 'rating-met')
        .then(seen => { if(!seen) return Rating.primeMet(); })
        .catch(() => {});
    }

    window.addEventListener('resize', measureDock);
    wireEdgeSwipe();
    wireToTop();
    wireHardwareBack();
    /* something shared in from Instagram, YouTube or TikTok */
    if(global.Share && Share.listen) Share.listen();
    if(global.Shortcuts && Shortcuts.listen) Shortcuts.listen();
    /* draw the widget once at launch, so it is right even if nothing changes today */
    if(global.Widget && Widget.refresh) Widget.refresh();
    /* A pushed screen can write tasks — a program plan does, so does adding an
       avatar. Whatever is underneath loaded its data when it mounted and has no
       idea. Depth tells a push from a pop, since popping onto another pushed
       screen still leaves something on top; a stamp recorded per push says
       whether anything actually changed while it was open. */
    let depths = [];
    if(Screens.onChange) Screens.onChange(() => {
      paintTabs();
      const now = Data.version ? Data.version() : 0;
      const depth = Screens.depth();

      if(depth > depths.length){ depths.push(now); return; }      /* pushed */
      if(depth === depths.length) return;                          /* neither */

      const wasAt = depths.pop();                                  /* popped */
      if(wasAt === undefined || wasAt === now) return;
      if(depth > 0) Screens.refreshTop();
      else if(current) go(current);
    });

    go(HOME);

    /* Reaching the first screen is the proof a self-updated version works;
       without it, one that fails three times is rolled back. */
    setTimeout(() => {
      if(global.Updater) Updater.ok();
      if(global.CS3Update){
        CS3Update.ok();
        CS3Update.onReady(() => updateBar(() => CS3Update.restart()));
      }
      if(global.Updater && Updater.isAndroid) Updater.onReady(() => updateBar(() => Updater.applyNow()));
      /* Windows/Linux download in main.js: tell it this device's nastime too */
      if(global.Updater) Updater.pushSources().catch(() => {});
    }, 3000);
  }

  /* v4: an update has downloaded — offer it now, or it loads next time */
  function updateBar(apply){
    if(document.querySelector('.upd-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'upd-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `<span>A new version is ready</span>
      <button class="upd-go" type="button">Restart now</button><button class="upd-later" type="button" aria-label="Later">Later</button>`;
    document.body.appendChild(bar);
    bar.querySelector('.upd-go').addEventListener('click', async () => {
      bar.querySelector('.upd-go').textContent = 'Restarting…';
      try { await apply(); } catch(e){ U.toast('Could not restart — it loads next time you open the app'); bar.remove(); }
    });
    bar.querySelector('.upd-later').addEventListener('click', () => { bar.remove(); U.toast('It loads next time you open the app'); });
  }

  /* ---- going back ----

     One answer for every way of asking: the hardware button, the system gesture,
     and a swipe from the left edge. It unwinds the app in the order things were
     opened — a sheet, then the tools dock, then the screen stack, then back to
     Today — and only lets the OS close the app once there is nothing left to
     close. Returns false when it has nothing to do. */
  function goBack(){
    const sheet = sheetEl();
    if(sheet && sheet.classList.contains('open')){ closeSheet(); return true; }
    if(toolsOpen()){ setTools(false); return true; }
    if(Screens.depth && Screens.depth()){ Screens.pop(); return true; }
    if(current && current !== HOME){ go(HOME); return true; }
    return false;
  }

  /* Back to the top of a long page: a small ↑ that shows once you are more
     than about a screen down whatever is on top (a tab or a pushed
     screen), and a tap on the page's title does the same. */
  function wireToTop(){
    if(!document.getElementById('totop-css')){
      const st = document.createElement('style'); st.id = 'totop-css';
      st.textContent = `.totop{position:fixed;z-index:30;right:14px;bottom:calc(var(--h-tabbar) + var(--sab) + 96px);width:44px;height:44px;border-radius:50%;
        border:1px solid var(--line);background:var(--surface-2);color:var(--cream);display:flex;align-items:center;justify-content:center;
        box-shadow:0 6px 18px rgba(0,0,0,.45);opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .18s,transform .18s}
        .totop.on{opacity:1;pointer-events:auto;transform:none}
        .totop svg{width:20px;height:20px}
        .screenbar .mid h1,.page-title{cursor:pointer}`;
      document.head.appendChild(st);
    }
    const btn = document.createElement('button');
    btn.className = 'totop'; btn.type = 'button'; btn.setAttribute('aria-label', 'Back to the top');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
    document.body.appendChild(btn);
    /* the page that scrolls on top right now: the top pushed screen's, else the tab's */
    const topView = () => {
      const scr = document.querySelector('#screens > .screen:last-child');
      if(scr && !scr.classList.contains('sr-screen')) return scr.querySelector('.view');
      return scr ? null : document.getElementById('view');
    };
    const check = () => {
      const v = topView();
      btn.classList.toggle('on', !!v && v.scrollTop > v.clientHeight * 0.9 && !document.querySelector('.sheet.open'));
    };
    document.addEventListener('scroll', e => { if(e.target && e.target.classList && e.target.classList.contains('view')) check(); }, true);
    setInterval(check, 700);
    const up = () => { const v = topView(); if(v) v.scrollTo({ top:0, behavior:'smooth' }); btn.classList.remove('on'); };
    btn.addEventListener('click', up);
    document.addEventListener('click', e => {
      if(e.target.closest && e.target.closest('.screenbar .mid h1, .screenbar .mid .kick, .page-title')) up();
    });
  }

  /* A drag starting at the very left edge. Narrow on purpose: cards elsewhere on
     the screen swipe too, and the two must not fight. */
  function wireEdgeSwipe(){
    const EDGE = 26, TRAVEL = 68;
    let x0 = 0, y0 = 0, live = false;

    document.addEventListener('touchstart', e => {
      const t = e.touches[0];
      live = !!t && t.clientX <= EDGE;
      if(live){ x0 = t.clientX; y0 = t.clientY; }
    }, { passive:true });

    document.addEventListener('touchmove', e => {
      if(!live) return;
      const t = e.touches[0];
      if(!t) return;
      const dx = t.clientX - x0, dy = Math.abs(t.clientY - y0);
      /* a vertical drag is a scroll, not a back */
      if(dy > 40 && dy > dx){ live = false; return; }
      if(dx >= TRAVEL){
        live = false;
        goBack();
      }
    }, { passive:true });

    const stop = () => { live = false; };
    document.addEventListener('touchend', stop, { passive:true });
    document.addEventListener('touchcancel', stop, { passive:true });
  }

  /* The Android back button, when the shell gives us one. */
  /* The system back gesture never reaches the page — Android swallows the touch
     at the edge and turns it into a back event. So the swipe handler above only
     covers a drag the webview actually sees; this is what catches the real one.

     Three routes, wired together rather than as alternatives, because which one
     exists depends on what is installed in the native shell:
       1. Capacitor's App plugin, if @capacitor/app is in the build
       2. the Cordova-style document event some shells still send
       3. webview history — Capacitor's own default when nothing else handles
          back is to go back in history, and only exit when there is none, so
          keeping one spare entry turns that default into our own handler. */
  function wireHardwareBack(){
    let handled = false;

    const take = () => {
      handled = true;
      return goBack();
    };

    const cap = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.App;
    if(cap && cap.addListener){
      try {
        cap.addListener('backButton', () => { if(!take() && cap.exitApp) cap.exitApp(); });
      } catch(e){ console.warn('Back button listener unavailable', e); }
    }

    document.addEventListener('backbutton', e => {
      e.preventDefault && e.preventDefault();
      take();
    }, false);

    /* the history route, always armed: harmless when a listener above wins,
       and the only thing that works when neither is present */
    if(!global.history || !history.pushState) return;
    const arm = () => { try { history.pushState({ app:true }, ''); } catch(e){} };
    arm();
    window.addEventListener('popstate', () => {
      if(handled){ handled = false; arm(); return; }   /* a listener already dealt with it */
      if(goBack()) arm();
      /* nothing left to close: let the entry go and the shell close the app */
    });
  }

  /* Open whatever a notification pointed at. */
  async function handleNotificationTarget(){
    if(!global.Notify || !Notify.consumeTarget) return;
    const target = await Notify.consumeTarget();
    if(!target) return;
    openTarget(target);
  }

  /* Route a target the plugin hands us directly. */
  function openTarget(target){
    if(!target) return;
    const [kind, id] = String(target).split(':');
    if(kind === 'task'){
      go('today');
      setTimeout(() => Screens.push('task', { id }), 220);
    }
  }

  /* Three ways in, because each covers a case the others miss:
     a cold launch, a resume, and a tap while already in the foreground. */
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible') handleNotificationTarget();
  });
  setTimeout(handleNotificationTarget, 600);

  (function listenForTaps(){
    const p = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.LiveStatus;
    if(!p || !p.addListener) return;
    try { p.addListener('openTarget', ev => openTarget(ev && ev.target)); }
    catch(e){ console.warn('Could not listen for notification taps', e); }
  })();

  /* The day's backup, well after the app is usable — it reads every store, so
     it must never be between the person and the first paint. Silent either
     way: Settings → Automatic backup is where it reports. */
  function backupWhenIdle(){
    if(!global.Backup) return;
    const run = () => Backup.auto();
    if(global.requestIdleCallback) requestIdleCallback(run, { timeout: 15000 });
    else setTimeout(run, 6000);
  }

  global.App = { go, goBack, refreshTab, sheet, closeSheet, pickImage, reloadToolIcons, updateBar, sendToPhone, planner:PLANNER, TOOLS, PRESETS };
  document.addEventListener('DOMContentLoaded', () => { init(); backupWhenIdle(); });
})(window);
