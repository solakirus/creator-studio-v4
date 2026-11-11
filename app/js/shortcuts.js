/* Long-press shortcuts.

   Holding the app icon on Android offers a few actions. Each launches the app
   with a deep link — creatorstudio://go/run — and this turns that into a screen.

   A shortcut is only worth a slot if it saves you real navigation on a day you
   are busy: starting a run, capturing a thought, filming today's sequences.
   Everything else is two taps away anyway. */
(function(global){

  /* what each one opens. The key is the last part of the link. */
  const ROUTES = {
    /* today is a tab rather than a pushed screen, so it is reached differently —
       a widget tapping through to "my tasks" should land on the tab bar's own
       Today, not push a copy of it over whatever was open */
    today:   { tab:'today',            label:'Today' },
    run:     { screen:'run-live',      label:'Start a run' },
    capture: { screen:'quick-capture', label:'Quick capture' },
    shoot:   { screen:'vlog-builder',  label:'Today\'s filming' },
    workout: { screen:'workout',       label:'Workout' }
  };

  const keyOf = url => {
    const m = String(url || '').match(/(?:go\/|[?&]go=)([\w-]+)/);
    return m ? m[1].toLowerCase() : null;
  };

  /* A link can name a particular thing: go/vlog/<id>. Another app sending you
     back here knows which episode you left from, and landing on the episode
     list instead would waste that. */
  const idOf = url => {
    const m = String(url || '').match(/go\/[\w-]+\/([\w-]+)/);
    return m ? m[1] : null;
  };

  /* Where a link with an id lands. Kept apart from ROUTES because these are not
     shortcuts — nothing offers them on a long press; they exist to be sent. */
  const TARGETS = {
    vlog:     { screen:'vlog' },
    day:      { screen:'vlog-day' },
    quarter:  { screen:'quarter' },
    month:    { screen:'month' },
    clip:     { screen:'clip' },
    swipe:    { screen:'swipe' },
    series:   { screen:'series-view' },
    channel:  { screen:'channel', param:'name' },
    board:    { screen:'board', param:'board' }
  };

  /* Opening the app from a shortcut should land you on the thing, not on Today
     with the thing somewhere behind it. */
  /* Shoot should land on the day you are filming, not on the episode list with
     it three taps away — the whole point of the shortcut is that you are busy. */
  async function todaysDay(){
    try {
      const day = await Data.currentDay();
      const { values } = await Store.all('vlogs');
      for(const v of values){
        for(const a of (v.acts || [])){
          if(a.day === day) return { vlogId:v.id, actId:a.id };
          /* the block may have no date while its sequences do */
          if((a.beats || []).some(b => b.day === day)) return { vlogId:v.id, actId:a.id };
        }
      }
    } catch(e){ console.warn('No day to open', e); }
    return null;
  }

  async function go(key){
    const r = ROUTES[key];
    if(!r) return false;
    try {
      if(r.tab){
        if(global.App && App.go){ App.go(r.tab); return true; }
        return false;
      }

      if(!(global.Screens && Screens.push)) return false;

      if(key === 'shoot'){
        const found = await todaysDay();
        if(found){ Screens.push('vlog-day', found); return true; }
        /* nothing scheduled for today — the episode list is the honest fallback */
      }

      /* the tab bar owns Today; a shortcut pushes over whatever is there */
      Screens.push(r.screen, {});
      return true;
    } catch(e){ console.warn('Shortcut route failed', e); }
    return false;
  }

  function handle(url){
    const key = keyOf(url);
    if(!key) return false;

    /* a link naming a particular thing opens that thing */
    const id = idOf(url);
    if(id && TARGETS[key]){
      const t = TARGETS[key];
      try {
        if(!(global.Screens && Screens.push)) return false;
        Screens.push(t.screen, { [t.param || 'id']: decodeURIComponent(id) });
        return true;
      } catch(e){ return false; }
    }

    return go(key);
  }

  /* A cold start carries the link in the launch URL; a warm one arrives as an
     event. Both have to work, or the shortcut does nothing the second time. */
  function listen(){
    const App = global.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
    if(!App) return;

    try {
      if(App.addListener){
        App.addListener('appUrlOpen', data => {
          if(data && data.url) handle(data.url);
        });
      }
      if(App.getLaunchUrl){
        App.getLaunchUrl().then(r => { if(r && r.url) handle(r.url); })
          .catch(() => {});
      }
    } catch(e){ console.warn('Shortcuts unavailable', e); }
  }

  global.Shortcuts = { ROUTES, TARGETS, keyOf, idOf, go, handle, listen };
})(window);
