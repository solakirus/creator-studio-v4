/* v4: your own default week — how a new weekly vlog starts.

   Out of the box a week is seven days with "Sequence 1 · 2 · 3" in each. Once
   you've arranged a week the way your days actually run (What to film → drag
   the sequences, rename them), "Make this week my default" keeps that layout:
   each day's sequences in order, with their names, how they're filmed and
   what they're for — never the shots, ticks or dates. New weekly vlogs start
   from it (vlog.js "Week, day by day", Months' week slots). Stored in settings
   'vlog-week-default' (synced, so every device starts weeks the same way).

     await WeekDefault.get()          [{ title, beats:[{ title, setup, purpose }] }] | null
     await WeekDefault.saveFrom(vlog) keeps that vlog's days and sequences
     await WeekDefault.clear()        back to Sequence 1 · 2 · 3
     WeekDefault.acts(layout, uid)    fresh acts for a new vlog */
(function(global){
  const KEY = 'vlog-week-default';
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const standard = () => DAYS.map(d => ({ title:d, beats:[1, 2, 3].map(n => ({ title:`Sequence ${n}`, setup:'talking', purpose:'' })) }));

  async function get(){
    try { const v = await Store.get('settings', KEY); return Array.isArray(v) && v.length ? v : null; } catch(e){ return null; }
  }
  function layoutOf(vlog){
    return (vlog.acts || []).map(a => ({ title:String(a.title || ''),
      beats:(a.beats || []).map(b => ({ title:String(b.title || 'Sequence'), setup:b.setup || 'talking', purpose:String(b.purpose || '') })) }));
  }
  async function saveFrom(vlog){ const l = layoutOf(vlog); await Store.put('settings', l, KEY); return l; }
  async function clear(){ try { await Store.del('settings', KEY); } catch(e){} }
  const rid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function acts(layout, uid){
    const id = uid || rid;
    return (layout || standard()).map((a, i) => ({ id:id('a'), title:a.title, day:null, open:i === 0,
      beats:(a.beats || []).map(b => ({ id:id('b'), title:b.title, purpose:b.purpose || '', setup:b.setup || 'talking',
        script:'', sourceId:null, shots:[], day:null, at:null, done:false, clipId:null })) }));
  }
  /* "Sun 3 · Mon 2 · …" */
  const summary = l => (l || standard()).map(a => `${String(a.title).slice(0, 3)} ${(a.beats || []).length}`).join(' · ');

  global.WeekDefault = { KEY, get, saveFrom, clear, acts, standard, layoutOf, summary };
})(window);
