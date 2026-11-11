/* Backup — a copy of everything, somewhere the app cannot take with it.

   On 13 Oct 2026 the v2 app was uninstalled from the phone and took its whole
   database with it: a year of episodes, tasks, meals and photos, gone in one
   tap, because the only copy lived inside the app. What came back came back
   from a laptop database that happened to hold a stale plan pack.

   The rule that follows from that: a backup that lives inside the app is not a
   backup. So every sink here writes OUTSIDE the app's own storage —

     file     Android  → Documents/Creator Studio backups/   (shared storage;
                         survives uninstall, which is the whole point)
              Windows  → the same folder under Documents, via Electron
     server   a POST to wherever you point it (nastime), when it answers
     download the browser's save dialog — iOS has no silent file write, so
              there it is one tap rather than none

   And the second rule: it has to be automatic and visible. The reason the data
   was lost is not that backing up was hard, it is that it was a thing to
   remember. So this runs itself on open, and Settings shows the date in plain
   words — green today, amber at a few days, red at a week. A backup you cannot
   see the state of is one you are only assuming works.

   Records daily, pictures weekly: a records-only file is tens of KB and costs
   nothing to keep seven of. With photos it can be hundreds of MB, so that one
   runs weekly and keeps two. Losing a week of photos is a bad day; losing the
   records is the year.  */
(function(global){

  const FOLDER   = 'Creator Studio backups';
  const KEEP     = 7;                 /* daily records files */
  const KEEP_FULL= 2;                 /* weekly files with pictures */
  const EVERY    = 20 * 60 * 60 * 1000;      /* a day, less a margin so a daily
                                                habit never just misses it */
  const EVERY_FULL = 7 * 24 * 60 * 60 * 1000;
  const KEY      = 'backup:state';

  /* Android and Windows both present a Capacitor-shaped Filesystem — the
     Electron preload offers the same four calls — so there is one code path
     here, not two to keep in step. */
  const fsPlugin = () => {
    const p = global.Capacitor && global.Capacitor.Plugins;
    return (p && p.Filesystem) || null;
  };

  const pad = n => String(n).padStart(2, '0');
  const stamp = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const nameFor = (kind, d) => `creator-studio-${stamp(d)}${kind === 'full' ? '-full' : ''}.json`;

  async function state(){
    try { return (await Store.get('settings', KEY)) || {}; } catch(e){ return {}; }
  }
  async function setState(s){
    try { await Store.put('settings', s, KEY); } catch(e){}
  }

  /* ---------------------------------------------------------------- sinks */

  /* Android and Windows can write a file without asking. iOS cannot, and
     pretending otherwise would be the worst kind of bug here — a backup you
     believe in that never happened. */
  async function writeFile(name, text){
    const Fs = fsPlugin();
    if(!Fs) return null;
    /* 'DOCUMENTS' and recursive:true, matching Saver.saveOnly — that path is
       the one already proven on the device, and this is no place to find out
       a different spelling of the directory behaves differently. */
    await Fs.writeFile({ path: `${FOLDER}/${name}`, data: text,
      directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
    /* Read the size back. A write that half-succeeded leaves a file that looks
       like a backup and is not one, and this is the one place in the app where
       quietly-wrong is worse than loudly-broken. */
    const check = await Fs.stat({ path: `${FOLDER}/${name}`, directory:'DOCUMENTS' }).catch(() => null);
    if(check && check.size && check.size < text.length * 0.9)
      throw new Error('the file was written short');
    return { where: `Documents/${FOLDER}` };
  }

  async function sweep(kind){
    const Fs = fsPlugin();
    if(!Fs) return;
    const keep = kind === 'full' ? KEEP_FULL : KEEP;
    const match = f => kind === 'full' ? /-full\.json$/.test(f) : /^creator-studio-\d{4}-\d\d-\d\d\.json$/.test(f);
    try {
      if(!Fs.readdir) return;
      const r = await Fs.readdir({ path: FOLDER, directory:'DOCUMENTS' });
      const files = (r.files || []).map(f => f.name || f);
      const mine = files.filter(match).sort();
      /* oldest first, so what is dropped is always the oldest */
      for(const old of mine.slice(0, Math.max(0, mine.length - keep)))
        await Fs.deleteFile({ path: `${FOLDER}/${old}`, directory:'DOCUMENTS' }).catch(() => {});
    } catch(e){ /* sweeping is housekeeping; never let it fail a backup */ }
  }

  async function postServer(url, name, text){
    if(!url) return null;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl && setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(url.replace(/\/+$/, '') + '/' + encodeURIComponent(name), {
        method: 'PUT', body: text, headers: { 'content-type': 'application/json' },
        signal: ctl ? ctl.signal : undefined
      });
      if(!r.ok) throw new Error('server said ' + r.status);
      return { where: url };
    } finally { if(t) clearTimeout(t); }
  }

  /* ----------------------------------------------------------------- run */

  /* kind: 'records' (daily, no pictures) | 'full' (weekly, everything)
     opts.manual — a tap, so the download sink is allowed to open a dialog */
  async function run(kind, opts){
    kind = kind === 'full' ? 'full' : 'records';
    opts = opts || {};
    const st = await state();
    const started = Date.now();

    let text;
    try {
      const data = await Transfer.exportAll({ photos: kind === 'full' });
      text = JSON.stringify(data);
    } catch(e){
      st[kind + 'Error'] = 'could not read the database: ' + (e.message || e);
      await setState(st); return { ok:false, error: st[kind + 'Error'] };
    }

    const name = nameFor(kind, new Date());
    const done = [], failed = [];

    try { const r = await writeFile(name, text); if(r) done.push('file:' + r.where); }
    catch(e){ failed.push('file: ' + (e.message || e)); }

    if(st.server){
      try { const r = await postServer(st.server, name, text); if(r) done.push('server'); }
      catch(e){ failed.push('server: ' + (e.message || e)); }
    }

    /* Nowhere silent to put it — iOS, or a browser. Offer the save, but only
       off a real tap; a download cannot be conjured without one. */
    if(!done.length && opts.manual && global.Transfer && Transfer.download){
      try { await Transfer.download(name, text, 'application/json'); done.push('download'); }
      catch(e){ failed.push('download: ' + (e.message || e)); }
    }

    st[kind + 'At']    = done.length ? started : st[kind + 'At'] || 0;
    st[kind + 'Size']  = done.length ? text.length : st[kind + 'Size'] || 0;
    st[kind + 'Where'] = done.join(', ') || st[kind + 'Where'] || '';
    st[kind + 'Error'] = done.length ? '' : (failed.join('; ') || 'nowhere to write it');
    await setState(st);
    /* awaited: housekeeping is quick, and leaving it dangling made the number
       of files on disk depend on timing — which is not a property you want in
       the one part of the app whose job is to still be correct later */
    if(done.length) await sweep(kind);

    return { ok: !!done.length, bytes: text.length, done, failed, name };
  }

  /* Called on open. Quiet: it never blocks the first paint and never toasts —
     the Settings row is where it reports. */
  async function auto(){
    try {
      const st = await state();
      if(st.off) return;
      /* An iPad with no server is not a failure to record — there is simply
         nowhere to put a file without a tap. Recording it as an error would
         paint the row red every single day, and a warning that is always on
         is one you stop reading. Settings asks for a tap instead. */
      if(!canWriteSilently() && !st.server) return;
      const now = Date.now();
      if(!st.recordsAt || now - st.recordsAt > EVERY) await run('records');
      const s2 = await state();
      if(canWriteSilently() && (!s2.fullAt || now - s2.fullAt > EVERY_FULL)) await run('full');
    } catch(e){ console.warn('[backup]', e && e.message); }
  }

  const canWriteSilently = () => !!fsPlugin();

  /* What Settings shows. Plain words and a colour, because the only backup
     anyone trusts is one whose state they can see. */
  async function status(){
    const st = await state();
    const at = st.recordsAt || 0;
    const days = at ? Math.floor((Date.now() - at) / 86400000) : Infinity;
    /* A device that cannot write without a tap and has never been asked to is
       amber, not red: nothing is broken, it just needs you once. */
    const needsYou = !at && !canWriteSilently() && !st.server;
    const tone = needsYou ? 'warn'
      : !at ? 'bad' : days < 1 ? 'good' : days < 7 ? 'warn' : 'bad';
    const when = !at ? 'never'
      : days < 1 ? 'today'
      : days === 1 ? 'yesterday'
      : days + ' days ago';
    return {
      tone, when, at,
      size: st.recordsSize || 0,
      where: st.recordsWhere || '',
      error: st.recordsError || '',
      full: st.fullAt || 0,
      server: st.server || '',
      off: !!st.off,
      silent: canWriteSilently()
    };
  }

  async function setServer(url){ const s = await state(); s.server = String(url || '').trim(); await setState(s); }
  async function setOff(off){ const s = await state(); s.off = !!off; await setState(s); }

  global.Backup = { run, auto, status, setServer, setOff, FOLDER, canWriteSilently };
})(window);
