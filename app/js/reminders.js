/* Scheduled reminders for anything with a time on it.
   Uses @capacitor/local-notifications; a no-op in a browser. */
(function(global){
  const plugin = () =>
    (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.LocalNotifications) || null;
  const available = () => !!plugin();

  const DEFAULTS = { on:true, lead:15, days:2 };   /* minutes before, days ahead */
  let cfg = null;

  async function config(){
    if(!cfg) cfg = { ...DEFAULTS, ...((await Store.get('settings','reminders')) || {}) };
    return cfg;
  }
  async function setConfig(patch){
    cfg = { ...(await config()), ...patch };
    await Store.put('settings', cfg, 'reminders');
    await sync();
    return cfg;
  }

  /* A stable numeric id per item, so rescheduling replaces rather than duplicates. */
  function idFor(kind, key){
    let h = 0;
    const s = kind + ':' + key;
    for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 2000000;
  }

  async function permission(){
    const p = plugin();
    if(!p) return false;
    try {
      let res = await p.checkPermissions();
      if(res.display !== 'granted') res = await p.requestPermissions();
      return res.display === 'granted';
    } catch(e){ console.warn(e); return false; }
  }

  /* Everything with a clock time in the next few days. */
  async function upcoming(){
    const c = await config();
    const out = [];
    const now = Date.now();
    const horizon = now + c.days * 86400000;

    const at = (day, hhmm) => {
      const base = new Date(Data.dayToDateSync ? Data.dayToDateSync(day) : 0);
      return base;
    };

    const program = await Data.program();
    const midnight = ts => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };
    const dateOf = (day, hhmm) => {
      const d = new Date(midnight(program.start));
      d.setDate(d.getDate() + (day - 1));
      const [h,m] = String(hhmm).split(':').map(Number);
      d.setHours(h, m, 0, 0);
      return d.getTime();
    };

    const tasks = await Data.tasks();
    tasks.filter(t => t.at && t.view !== 'done').forEach(t => {
      const when = dateOf(t.day, t.at);
      if(when > now && when < horizon)
        out.push({ id:idFor('task', t.id), when, title:t.title,
                   body:`${t.cad}${(t.shots||[]).length ? ` · ${t.shots.length} shots` : ''}` });
    });

    const { values: vlogs } = await Store.all('vlogs');
    vlogs.forEach(v => (v.acts || []).forEach(a => (a.beats || [])
      /* day 0 is a real date — the day before Day 1 — so this is != null,
         never a truthiness test */
      .filter(b => b.at && b.day != null && !b.done)
      .forEach(b => {
        const when = dateOf(b.day, b.at);
        if(when > now && when < horizon)
          out.push({ id:idFor('beat', b.id), when, title:b.title, body:`${v.title} · ${a.title}` });
      })));

    return out.sort((a,b) => a.when - b.when);
  }

  async function sync(){
    const p = plugin();
    if(!p) return false;
    const c = await config();

    try {
      const pending = await p.getPending();
      if(pending && pending.notifications && pending.notifications.length)
        await p.cancel({ notifications: pending.notifications.map(n => ({ id:n.id })) });
    } catch(e){ console.warn('Could not clear pending reminders', e); }

    if(!c.on) return true;
    if(!(await permission())) return false;

    const items = await upcoming();
    const lead = c.lead * 60000;
    const list = items
      .map(i => ({ ...i, fire: i.when - lead }))
      .filter(i => i.fire > Date.now())
      .slice(0, 60)                     /* Android caps how many you can schedule */
      .map(i => ({
        id: i.id,
        title: i.title,
        body: `${c.lead ? `In ${c.lead} min · ` : ''}${i.body}`,
        schedule: { at: new Date(i.fire), allowWhileIdle: true },
        smallIcon: 'ic_stat_icon_config_sample'
      }));

    if(!list.length) return true;
    try { await p.schedule({ notifications: list }); return true; }
    catch(e){ console.error('Could not schedule reminders', e); return false; }
  }

  async function count(){
    const p = plugin();
    if(!p) return 0;
    try { const r = await p.getPending(); return (r.notifications || []).length; }
    catch(e){ return 0; }
  }

  global.Reminders = { available, config, setConfig, sync, upcoming, count, permission };
})(window);
