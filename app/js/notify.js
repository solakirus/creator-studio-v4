/* The ongoing day-progress notification.
   Native on Android via the LiveStatus plugin; a silent no-op in a browser. */
(function(global){
  const plugin = () =>
    (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.LiveStatus) || null;
  const available = () => !!plugin();

  /* Android 13+ needs POST_NOTIFICATIONS granted at runtime. The live status
     plugin cannot ask on its own, so borrow the local-notifications plugin,
     which requests exactly the same permission. */
  async function systemAllowed(){
    const ln = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.LocalNotifications;
    if(!ln) return 'unknown';
    try {
      let r = await ln.checkPermissions();
      if(r.display !== 'granted') r = await ln.requestPermissions();
      return r.display === 'granted' ? 'granted' : 'denied';
    } catch(e){ console.warn(e); return 'unknown'; }
  }

  let enabled = null;
  async function isEnabled(){
    if(enabled === null){
      const v = await Store.get('settings', 'live-notification');
      enabled = v === undefined ? true : !!v;
    }
    return enabled;
  }
  async function setEnabled(on){
    enabled = !!on;
    await Store.put('settings', enabled, 'live-notification');
    on ? update() : clear();
  }

  const fmt = at => {
    if(!at) return null;
    const [h, m] = at.split(':').map(Number);
    const ampm = h >= 12 ? 'P' : 'A';
    const hr = h % 12 === 0 ? 12 : h % 12;
    return m ? `${hr}:${String(m).padStart(2,'0')}${ampm}` : `${hr}${ampm}`;
  };

  /* Where you are in the thousand days, and how much of today is done, on the
     first line. What to do next goes under it — the count is the thing you glance
     at all day, so it should never be the line that scrolls off. */
  async function state(){
    const [tasks, day] = await Promise.all([Data.tasks(), Data.currentDay()]);
    const mine = tasks.filter(t => t.day === day);
    const done = mine.filter(t => t.view === 'done').length;
    const total = mine.length;

    /* timed tasks first, in clock order, then anything without a time */
    const open = mine.filter(t => t.view === 'todo')
      .sort((a,b) => (a.at || '99:99').localeCompare(b.at || '99:99'));
    const now = new Date();
    const clock = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    /* the one that is due, or the next one up */
    const due = open.filter(t => t.at && t.at <= clock).pop();
    const current = due || open[0] || null;

    let title, body;
    if(!total){
      title = `Day ${day} · 0/0`;
      body = 'Nothing on the day yet';
    } else if(done === total){
      title = `Day ${day} · ${total}/${total} done`;
      body = 'Day clear — streak safe';
    } else {
      const kind = current && current.kind
        ? ({ shoot:'Shoot', edit:'Edit', publish:'Publish' })[current.kind] : null;
      const when = fmt(current && current.at);

      title = `Day ${day} · ${done}/${total} done`;

      /* Just the one task on the second line. Naming the one after it made the
         line long enough to truncate, which cost the thing you were reading. */
      const parts = [];
      if(current){
        const at = due && when ? ` · due ${when}` : when ? ` · ${when}` : '';
        parts.push(`${kind ? kind + ' · ' : ''}${current.title}${at}`);
      }
      parts.push(`${total - done} left today`);
      body = parts.join(' · ');
    }

    return {
      title, body, done, total,
      subText: `${done}/${total}`,             /* sits beside the app name */
      shortText: `${done}/${total}`,           /* must fit a 96dp chip */
      actionLabel: current ? 'Mark done' : null,
      actionTarget: current ? `done:${current.id}` : '',
      target: current ? `task:${current.id}` : ''
    };
  }

  async function update(){
    const p = plugin();
    if(!p || !(await isEnabled())) return false;
    const allowed = await systemAllowed();
    if(allowed === 'denied') return 'denied';
    try { await p.show(await state()); return true; }
    catch(e){ console.warn('Live status unavailable', e); return false; }
  }
  async function clear(){
    const p = plugin();
    if(!p) return;
    try { await p.clear(); } catch(e){ console.warn(e); }
  }

  /* Did a notification launch us, and if so what did it want? */
  async function consumeTarget(){
    const p = plugin();
    if(!p || !p.consumeTarget) return null;
    try {
      const r = await p.consumeTarget();
      return (r && r.target) ? r.target : null;
    } catch(e){ return null; }
  }

  global.Notify = { available, isEnabled, setEnabled, update, clear, state, systemAllowed, consumeTarget };
})(window);
