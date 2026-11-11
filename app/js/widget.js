/* The home screen widget's data.

   A widget runs outside the WebView and cannot reach IndexedDB, so it cannot
   ask the app anything. The app has to hand it a snapshot and keep it current.

   This writes that snapshot through the same kind of bridge the live
   notification uses. In a browser it is a silent no-op.

   Keep it small and already-formatted: a widget draws strings, it does not
   compute. Anything it would have to work out is worked out here. */
(function(global){

  const plugin = () =>
    (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.CSWidget) || null;

  const available = () => !!plugin();

  /* what the widget shows, in the words it shows them */
  async function snapshot(){
    const out = { day:'', progress:'', next:'', nextAt:'', shoot:'', updatedAt:Date.now() };

    try {
      const day = await Data.currentDay();
      /* before the programme starts the count is negative — say so plainly
         rather than showing "Day -13", which reads as a bug */
      out.day = day > 0 ? `Day ${day}`
        : day === 0 ? 'Starts tomorrow'
        : `${Math.abs(day)} days to go`;

      const tasks = (await Data.tasks()).filter(t => t.day === day);
      const done = tasks.filter(t => t.view === 'done').length;
      out.progress = tasks.length ? `${done}/${tasks.length} done` : 'Nothing scheduled';

      /* the one you would do next: first undone, in the order they sit */
      const next = tasks.find(t => t.view !== 'done');
      if(next){
        out.next = next.title || 'Untitled';
        out.nextAt = next.at || '';
      } else if(tasks.length){
        out.next = 'All done today';
      }

      /* what you are filming, since that is the thing most easily forgotten */
      const shoots = tasks.filter(t => t.kind === 'shoot' && t.view !== 'done');
      if(shoots.length){
        out.shoot = shoots.length === 1
          ? shoots[0].title
          : `${shoots.length} sequences to film`;
      }
    } catch(e){ console.warn('Widget snapshot failed', e); }

    return out;
  }

  /* Pushing on every change would be wasteful and pushing on a timer would be
     stale; this runs after anything that could move the numbers. */
  let pending = null;
  async function push(){
    const p = plugin();
    if(!p || !p.update) return false;
    try {
      const data = await snapshot();
      await p.update(data);
      return true;
    } catch(e){ console.warn('Widget update failed', e); return false; }
  }

  /* Several things often change at once — ticking a task redraws Today, which
     would otherwise push three times in a second. */
  function refresh(){
    if(!available()) return;
    clearTimeout(pending);
    pending = setTimeout(push, 400);
  }

  global.Widget = { available, snapshot, push, refresh };
})(window);
