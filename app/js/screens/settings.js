/* Settings — pushed screen, plus the tool icon editor pushed on top of it. */
(function(){
  const { ICON, slug } = U;
  const svg = d => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const chev = `<svg class="chevr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;

  const row  = (icon, label, sub, attrs) =>
    `<button class="row" ${attrs || ''}>${svg(icon)}<span class="lbl">${label}${sub ? `<small>${sub}</small>` : ''}</span>${chev}</button>`;
  const toggleRow = (icon, label, sub, on) =>
    `<div class="row">${svg(icon)}<span class="lbl">${label}${sub ? `<small>${sub}</small>` : ''}</span>
      <span class="tog" role="switch" aria-checked="${on}" tabindex="0"><i></i></span></div>`;
  const sec = t => `<div class="sec"><h2>${t}</h2><div class="rule"></div></div>`;

  const D = {
    chart:'M3 15l4-6 4 4 5-8 5 6',
    user:'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5',
    globe:'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18',
    cloudq:'M5.5 18a4 4 0 0 1 .8-7.9 6 6 0 0 1 11.6 1.2A3.6 3.6 0 0 1 18 18zM12 12.5v.01M11 15.2c0-.9 1.8-1 1.8-2.2',
    image:'M3 4h18v16H3zM8.5 9.5v.01M21 16l-5-5-6 6',
    grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    pencil:'M4 20l4-1 10-10-3-3L5 16zM14.5 6.5l3 3',
    pause:'M7 4h3v16H7zM14 4h3v16h-3z',
    clock:'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17M12 7.5V12l3 2',
    cal:'M3 5h18v16H3zM8 3v4M16 3v4M3 11h18',
    play:'M8 5l11 7-11 7z',
    bolt:'M13 2L4.5 13.5H11L10 22l8.5-11.5H12z',
    sun:'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M12 2v2.5M12 19.5V22M22 12h-2.5M4.5 12H2M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4L5.6 5.6',
    lines:'M3 6h18M3 12h18M3 18h18',
    down:'M12 3v12M8 11l4 4 4-4M4 20h16',
    up:'M12 16V4M8 8l4-4 4 4M4 20h16',
    sync:'M20 11a8 8 0 0 0-14.6-4.5M4 3.5v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20.5v-4h-4',
    trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'
  };

  function mount(el){
    el.innerHTML = Screens.bar({ title:'Settings' }) + `
    <div class="view">
      ${sec('Studio stats')}
      <div class="tiles">
        <div class="tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="14" height="12" rx="2"/><path d="M16.5 10.5L22 8v8l-5.5-2.5z"/></svg><b>14</b><span>Videos published</span></div>
        <div class="tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg><b>3</b><span>Series active</span></div>
      </div>
      <div class="group">${row(D.chart,'All-time stats')}</div>

      ${sec('Account')}
      <div class="group">
        ${row(D.user || D.lines,'Profile','Your name, avatar and this month\'s goal','data-go="profile"')}
        ${row(D.user,'Edit your name')}
        ${row(D.globe,'Time zone')}
        ${row(D.cloudq,'Progress not correct?')}
        ${row(D.image,'Colours','How the whole app looks','data-go="palette"')}
        ${row(D.grid,'Customize tool icons','Swap the artwork in the Tools sheet','data-go="toolicons"')}
        ${row(D.lines,'Channels','The brands you publish under','data-go="channels"')}
        ${row(D.image,'Coverage kit','The shots you want off every piece','data-go="coverage"')}
        ${row(D.grid,'Shot library','Every angle you can plan against','data-go="shotlibrary"')}
        ${row(D.trophy || D.bolt,'Achievements','What you have unlocked so far','data-go="awards"')}
        ${row(D.user || D.grid,'Avatars','Artwork you unlock as you level','data-go="avatars"')}
        ${row(D.trophy || D.bolt,'Challenge XP','Habit days, weekly and monthly wins, level thresholds','data-go="scoreboard-settings"')}
        ${row(D.image,'Customize card art')}
      </div>

      ${sec('Production')}
      <div class="group">
        ${row(D.cal,'Program start date','<span id="startVal">—</span>','data-go="startdate"')}
        ${row(D.pencil,'Edit current cycle')}
        ${row(D.pause,'Pause the planner')}
        ${row(D.clock,'Capture reminder time')}
        ${row(D.cal,'Change start day')}
        ${row(D.play,'Start a new cycle')}
        ${row(D.bolt,'Activate crunch mode')}
      </div>

      ${sec('Display')}
      <div class="group">
        ${toggleRow(D.sun,'Dark mode','',true)}
        ${toggleRow(D.lines,'Compact list','Denser rows, more on screen',false)}
        ${toggleRow(D.image,'Show card art','Off uses flat colour cards',true)}
        <div class="row">${svg(D.bolt)}
          <span class="lbl">Sound on a perfect day<small>A chime when the last task is ticked</small></span>
          <span class="tog" role="switch" data-sound aria-checked="true" tabindex="0"><i></i></span>
        </div>
      </div>

      ${sec('Production')}
      <div class="group">
        ${row(D.cal,'Program start date','<span id="startVal">—</span>','data-go="startdate"')}
        ${row(D.chart,'Pipeline','<span id="pipeVal">—</span>','data-go="pipeline"')}
        ${row(D.grid,'Import and export','Fill everything in on a spreadsheet','data-go="data-hub"')}
      </div>

      ${sec('Units')}
      <div class="group">
        <div class="row">${svg(D.chart)}
          <span class="lbl">Weight<small>Used everywhere in the workout console</small></span>
          <span style="display:flex;gap:7px">
            <button class="opt" data-unit="lb">lb</button>
            <button class="opt" data-unit="kg">kg</button>
          </span>
        </div>
      </div>

      ${sec('Notifications')}
      <div class="group">
        <div class="row">${svg(D.bolt)}
          <span class="lbl">Day progress notification<small id="notifyNote">An ongoing notification showing how far through today you are</small></span>
          <span class="tog" role="switch" data-notify aria-checked="true" tabindex="0"><i></i></span>
        </div>
        <div class="row">${svg(D.clock)}
          <span class="lbl">Remind me before timed things<small id="remNote">A nudge ahead of anything with a clock time</small></span>
          <span class="tog" role="switch" data-remind aria-checked="true" tabindex="0"><i></i></span>
        </div>
        ${row(D.clock,'Lead time','<span id="leadVal">—</span>','data-go="leadtime"')}
        ${row(D.bolt,'Send a test notification','Posts one now, using today\'s real numbers','data-go="testnotify"')}
        ${row(D.cloudq,'Notification diagnostics','What is and is not working','data-go="notifydiag"')}
      </div>

      ${sec('Planning help')}
      <div class="group">
        ${row(D.bolt,'AI shot suggestions','Your Anthropic key for Suggest shots — or none, and paste into a chat','data-go="ai"')}
      </div>

      ${sec('Data')}
      <div class="group">
        <button class="row" data-go="sync"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${D.sync}"/></svg>
          <span class="lbl">Sync with your server<small id="syLine">checking…</small></span>
          <i class="bkdot" id="syDot"></i>${chev}</button>
        <button class="row" data-go="appupdate"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${D.down}"/></svg>
          <span class="lbl">App updates<small id="upLine">checking…</small></span>${chev}</button>
        ${row(D.down,'Import from CSV','Meals, clips, tasks or pantry items','data-go="csv"')}
        ${row(D.down,'Restore from backup','A Creator Studio JSON file','data-go="restore"')}
        ${row(D.down,'Open a plan pack','From the laptop Planner or the Reference Library — safe to open twice','data-go="planpack"')}
        <!-- First in the group on purpose: the automatic one is the one that
             saves you, and it only works if you can see that it is working. -->
        <button class="row" data-go="autobackup"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${D.up}"/></svg>
          <span class="lbl">Automatic backup<small id="bkLine">checking…</small></span>
          <i class="bkdot" id="bkDot"></i>${chev}</button>
        ${row(D.up,'Export everything','Every record and picture — for the other device or a new phone','data-go="backup"')}
        ${row(D.up,'Export as spreadsheets','CSV files that open in Notion or Sheets','data-go="csvout"')}
        ${row(D.grid,'Load sample content','Meals, series and clips to try things out','data-go="samples"')}
        <button class="row" data-go="wipe"><svg class="ic" style="color:var(--red)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${D.trash}"/></svg>
          <span class="lbl" style="color:var(--red)">Clear local data<small>Everything, permanently</small></span>${chev}</button>
      </div>

      <p class="note" style="margin-top:34px;color:var(--dim);font-size:12.5px">Creator Studio · v0.5.0<br>Made in Plant City</p>
    </div>`;

    /* unit buttons reflect the stored choice */
    (async () => {
      const u = await Units.get();
      el.querySelectorAll('[data-unit]').forEach(b =>
        b.setAttribute('aria-pressed', String(b.dataset.unit === u)));
    })();

    /* pipeline summary */
    (async () => {
      const c = await Pipeline.config();
      const v = el.querySelector('#pipeVal');
      if(v) v.textContent = `Shoot ${c.shootLead}d before · edit ${c.editLead}d before`;
    })();

    /* sound toggle */
    (async () => {
      const t = el.querySelector('[data-sound]');
      if(t) t.setAttribute('aria-checked', String(await Celebrate.soundOn()));
    })();

    /* reminder toggle and lead time */
    (async () => {
      const c = await Reminders.config();
      const t = el.querySelector('[data-remind]');
      if(t) t.setAttribute('aria-checked', String(!!c.on));
      const lv = el.querySelector('#leadVal');
      if(lv) lv.textContent = c.lead ? `${c.lead} minutes before` : 'At the time';
      const rn = el.querySelector('#remNote');
      if(rn && !Reminders.available())
        rn.textContent = 'Needs the installed app and the notifications plugin';
      else if(rn){
        const n = await Reminders.count();
        rn.textContent = `${n} reminder${n===1?'':'s'} scheduled`;
      }
    })();

    /* notification toggle reflects real state, and says so when unavailable */
    (async () => {
      const t = el.querySelector('[data-notify]');
      const note = el.querySelector('#notifyNote');
      if(!t) return;
      t.setAttribute('aria-checked', String(await Notify.isEnabled()));
      if(!Notify.available() && note)
        note.textContent = 'Only available in the installed app, not the browser';
    })();

    /* which version is running, and whether a newer one is waiting */
    (async () => {
      const line = el.querySelector('#upLine');
      if(!line) return;
      try {
        const i = await appUpdateInfo();
        line.textContent = updateLine(i);
      } catch(e){ line.textContent = 'Could not check'; }
    })();

    /* the sync line: same idea as the backup one below */
    (async () => {
      const line = el.querySelector('#syLine'), dot = el.querySelector('#syDot');
      if(!line || !window.Sync) return;
      try {
        const s = await Sync.status();
        const tone = !s.connected ? '' : s.paused ? 'warn' : s.error ? 'bad' : s.at ? 'good' : 'warn';
        if(dot) dot.className = 'bkdot ' + tone;
        line.textContent = syncLine(s);
      } catch(e){ line.textContent = 'Could not check'; }
    })();

    /* the backup line, in plain words and a colour you can read at a glance */
    (async () => {
      const line = el.querySelector('#bkLine'), dot = el.querySelector('#bkDot');
      /* window, not global: this file is wrapped (function(){…})() and has no
         `global` — reaching for one throws at boot and takes the app down */
      if(!line || !window.Backup) return;
      try {
        const s = await Backup.status();
        if(dot) dot.className = 'bkdot ' + s.tone;
        const kb = s.size ? ' · ' + (s.size > 1048576
          ? (s.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(s.size / 1024)) + ' KB') : '';
        line.textContent = s.off ? 'Turned off'
          /* "needs you" is not an error, so it is checked first — otherwise an
             iPad reads as broken every day and the light stops meaning anything */
          : (s.when === 'never' && !s.silent && !s.server)
            ? 'This device needs a tap — open this to save one'
          : s.error ? 'Last tried and failed — ' + s.error
          : s.when === 'never'
            ? (s.silent ? 'Not yet — open this to run the first one'
                        : 'This device cannot save one on its own — tap to set it up')
            : 'Saved ' + s.when + kb + (s.where ? ' · ' + s.where.replace(/^file:/, '') : '');
      } catch(e){ line.textContent = 'Could not check'; }
    })();

    /* show the live start date in the row */
    (async () => {
      try {
        const p = await Data.program();
        const v = el.querySelector('#startVal');
        if(v) v.textContent = new Date(p.start).toLocaleDateString(undefined,
          { weekday:'short', year:'numeric', month:'long', day:'numeric' }) +
          ' · day ' + (await Data.currentDay()) + ' today';
      } catch(e){ console.warn(e); }
    })();

    el.addEventListener('click', e => {
      const u = e.target.closest('[data-unit]');
      if(u){
        Units.set(u.dataset.unit);
        el.querySelectorAll('[data-unit]').forEach(b =>
          b.setAttribute('aria-pressed', String(b === u)));
        U.toast(u.dataset.unit === 'kg' ? 'Showing kilograms' : 'Showing pounds');
        return;
      }

      const t = e.target.closest('.tog');
      if(t){
        const on = t.getAttribute('aria-checked') !== 'true';
        t.setAttribute('aria-checked', String(on));
        if(t.hasAttribute('data-sound')){
          Celebrate.setSound(on);
          if(on) Celebrate.chime();
          return;
        }
        if(t.hasAttribute('data-remind')){
          Reminders.setConfig({ on }).then(async () => {
            const rn = el.querySelector('#remNote');
            if(rn && Reminders.available()){
              const n = await Reminders.count();
              rn.textContent = `${n} reminder${n===1?'':'s'} scheduled`;
            }
          });
          if(on && !Reminders.available()) U.toast('Takes effect in the installed app');
          return;
        }
        if(t.hasAttribute('data-notify')){
          Notify.setEnabled(on);
          if(on && !Notify.available()) U.toast('Takes effect in the installed app');
        }
        return;
      }
      const go = e.target.closest('[data-go]');
      if(!go) return;
      if(go.dataset.go === 'startdate') return openStartDate(() => mount(el));
      if(go.dataset.go === 'pipeline')  return openPipeline(() => mount(el));
      if(go.dataset.go === 'avatars')   return Screens.push('avatars', { onChange:() => render() });
      if(go.dataset.go === 'data-hub')  return Screens.push('data-hub', { onChange:() => render() });
      if(go.dataset.go === 'samples')   return openSamples();
      if(go.dataset.go === 'csv')       return openCsvImport();
      if(go.dataset.go === 'restore')   return openRestore();
      if(go.dataset.go === 'planpack')  return openPlanPack();
      if(go.dataset.go === 'ai')        return ShotAI.openSettings();
      if(go.dataset.go === 'sync')      return openSync(() => mount(el));
      if(go.dataset.go === 'appupdate') return checkAppUpdate(() => mount(el));
      if(go.dataset.go === 'autobackup') return openAutoBackup(() => mount(el));
      if(go.dataset.go === 'backup')    return doBackup();
      if(go.dataset.go === 'csvout')    return doSheets();

      /* These rows rendered but nothing listened for them, so they were dead to
         the touch — no error, no toast, nothing. Every one is a registered
         screen that simply was never pushed. */
      if(go.dataset.go === 'profile')     return Screens.push('profile', { onChange:() => render() });
      if(go.dataset.go === 'toolicons')   return Screens.push('toolicons', { onChange:() => render() });
      if(go.dataset.go === 'channels')    return Screens.push('channels', { onChange:() => render() });
      if(go.dataset.go === 'coverage')    return Screens.push('coverage', { onChange:() => render() });
      if(go.dataset.go === 'shotlibrary') return Screens.push('shotlibrary', { onChange:() => render() });
      if(go.dataset.go === 'awards')      return Screens.push('awards', { onChange:() => render() });
      if(go.dataset.go === 'palette')   return doPalette();
      if(go.dataset.go === 'leadtime')   return openLeadTime();
      if(go.dataset.go === 'testnotify') return doTestNotify();
      if(go.dataset.go === 'notifydiag') return openNotifyDiag();
      if(go.dataset.go === 'wipe')      return openWipe();
      Screens.push(go.dataset.go);
    });
  }

  /* ---------- automatic backup ----------

     Deliberately plain about what it can and cannot do on this device. A
     backup people half-trust is worse than none, because they stop making the
     other kind. */
  /* ---------- sync ----------
     One sheet for both states. Not connected: an address, a token, Connect —
     and if both this device and the server already hold data, a plain choice
     of which wins, because guessing that wrong is the one way sync loses work.
     Connected: when it last ran, what is waiting, Sync now, pause, disconnect. */
  const agoText = t => {
    if(!t) return 'never';
    const s = Math.round((Date.now() - t) / 1000);
    if(s < 60) return 'just now';
    if(s < 3600) return Math.round(s / 60) + ' min ago';
    if(s < 86400) return Math.round(s / 3600) + ' h ago';
    return new Date(t).toLocaleDateString(undefined, { month:'short', day:'numeric' });
  };
  function syncLine(s){
    if(!s.connected) return 'Off — keep phone, laptop and iPad in step through nastime';
    if(s.paused) return 'Paused on this device';
    const wait = s.pending ? ` · ${s.pending} change${s.pending === 1 ? '' : 's'} waiting` : '';
    if(s.error) return s.error + wait;
    return 'Synced ' + agoText(s.at) + wait;
  }

  /* ---------- app updates ----------
     Android (js/updater.js) and Windows (electron/main.js) fetch new versions
     of the web files from GitHub Pages on their own; the iPad loads the site
     directly. This row says which version is running and checks on a tap. */
  async function appUpdateInfo(){
    if(window.CS3Update) return { kind:'windows', ...(await CS3Update.info()) };
    if(window.Updater && (await Updater.info()).available) return { kind:'android', ...(await Updater.info()) };
    return { kind:'web' };
  }
  function updateLine(i){
    if(i.kind === 'web') return 'Updates itself whenever it opens online';
    const v = i.build ? 'Version ' + i.build.slice(0, 7) : 'This version';
    const s = i.status || {};
    if(s.state === 'downloading') return `Downloading an update… ${s.done || 0} of ${s.total || '?'}`;
    if(s.state === 'ready') return v + ' · update downloaded, loads next time you open the app';
    if(s.state === 'error' && s.needsApk) return v + ' · ' + s.reason;
    return v + ' · updates itself from GitHub';
  }
  async function checkAppUpdate(after){
    const i = await appUpdateInfo();
    if(i.kind === 'web') return U.toast('This one is the website itself — it is always current when it opens online');
    U.toast('Checking for an update…');
    const r = i.kind === 'windows' ? await CS3Update.check() : await Updater.check({ quiet:true });
    const ready = r.ready || r.state === 'ready';
    const current = r.upToDate || r.state === 'current';
    U.toast(ready ? 'Update downloaded — close and reopen the app to use it'
          : current ? 'Already up to date'
          : 'Could not update: ' + (r.reason || 'unknown problem'));
    after && after();
  }

  async function openSync(after){
    const esc = t => String(t == null ? '' : t)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    const s = await Sync.status();
    const p = 'margin:0 0 14px;color:var(--muted);font-size:14.5px;line-height:1.55';

    if(s.connected){
      App.sheet(`
        <h2>Sync</h2>
        <p style="${p}">This device swaps changes with <b>${esc(s.server)}</b> when it opens,
          when you come back to it, a few seconds after you change something, and every few
          minutes. Away from home it keeps working and catches up when it can reach the server.</p>
        <div class="block" style="margin:0 0 14px">
          <div class="metaline" style="margin:0">
            <span class="tg count">Last sync · ${esc(agoText(s.at))}</span>
            <span class="tg count">${s.pending} waiting to send</span>
          </div>
          ${s.error ? `<p class="hintline" style="margin:9px 0 0;color:var(--red)">${esc(s.error)}</p>` : ''}
        </div>
        <div class="sheetcta">
          <button class="btn-primary" data-now>Sync now</button>
          <button class="btn-ghost" data-pause>${s.paused ? 'Resume sync' : 'Pause on this device'}</button>
        </div>
        <button class="btn-ghost" data-off style="width:100%;margin-top:10px;color:var(--red)">Disconnect this device</button>
        <p class="hintline" style="margin:8px 0 0">Disconnecting keeps everything on this device; it just stops swapping.</p>`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-now]')){
            const b = e.target.closest('[data-now]');
            b.disabled = true; b.textContent = 'Syncing…';
            const r = await Sync.syncNow();
            App.closeSheet();
            U.toast(r.ok ? `Synced — ${r.got} in, ${r.sent} out` : (r.error || 'Sync is paused'));
            after && after(); return;
          }
          if(e.target.closest('[data-pause]')){
            await Sync.setPaused(!s.paused);
            App.closeSheet(); U.toast(s.paused ? 'Sync resumed' : 'Sync paused'); after && after(); return;
          }
          if(e.target.closest('[data-off]')){
            if(!confirm('Stop syncing this device? Nothing here is deleted.')) return;
            await Sync.disconnect();
            App.closeSheet(); U.toast('Disconnected'); after && after();
          }
        });
      });
      return;
    }

    const saved = s.server || 'http://192.168.4.23:8787';
    App.sheet(`
      <h2>Sync with your server</h2>
      <p style="${p}">Keeps this device in step with your other ones through Sync Hub on nastime.
        Everything still works offline; changes swap whenever the server can be reached.</p>
      <div class="field"><label for="sy-srv">Server address</label>
        <input id="sy-srv" type="url" inputmode="url" autocapitalize="off" spellcheck="false" value="${esc(saved)}"></div>
      <div class="field"><label for="sy-tok">Sync token</label>
        <input id="sy-tok" type="password" autocapitalize="off" spellcheck="false" autocomplete="off"
          placeholder="The SYNC_TOKEN you set in CasaOS"></div>
      <div id="sy-choice"></div>
      <p class="hintline" id="sy-msg" style="margin:4px 0 0"></p>
      <div class="sheetcta"><button class="btn-primary" data-connect>Connect</button></div>`,
    sheetEl => {
      const $ = q => sheetEl.querySelector(q);
      const msg = (t, bad) => { const m = $('#sy-msg'); m.textContent = t; m.style.color = bad ? 'var(--red)' : ''; };
      const done = r => {
        App.closeSheet();
        U.toast(r && r.ok ? `Connected — ${r.got} in, ${r.sent} out` : 'Connected — ' + ((r && r.error) || 'will sync shortly'));
        after && after();
      };
      const run = async (how, btn) => {
        btn.disabled = true; btn.textContent = how === 'replace' ? 'Fetching…' : 'Sending…';
        try {
          /* The one choice that drops data here, so keep a copy first — but only
             where that is silent. On an iPad it opens a file preview over the
             app mid-connect, which is how the first iPad connect got stuck; the
             choice text there says to Export everything first instead. */
          if(how === 'replace' && window.Backup && await Sync.localCount()){
            let silent = false;
            try { silent = (await Backup.status()).silent; } catch(e){}
            if(silent){
              msg('Backing up this device first…');
              try { await Backup.run('records', { manual:true }); } catch(e){}
            }
          }
          msg('Syncing — the first one can take a minute with pictures…');
          done(await Sync.connect($('#sy-srv').value, $('#sy-tok').value, how));
        } catch(e){ btn.disabled = false; btn.textContent = 'Try again'; msg(e.message || String(e), true); }
      };

      sheetEl.addEventListener('click', async e => {
        const pick = e.target.closest('[data-how]');
        if(pick) return run(pick.dataset.how, pick);
        const c = e.target.closest('[data-connect]');
        if(!c) return;
        c.disabled = true; c.textContent = 'Checking…'; msg('');
        try {
          const { records } = await Sync.probe($('#sy-srv').value, $('#sy-tok').value);
          const here = await Sync.localCount();
          let silent = true;
          try { silent = window.Backup ? (await Backup.status()).silent : true; } catch(e){}
          if(!records) return run('upload', c);       /* first device: send it all up */
          if(!here) return run('replace', c);         /* empty device: take the server's */
          c.style.display = 'none';
          $('#sy-choice').innerHTML = `
            <p style="${p}">The server already has <b>${records}</b> records, and this device has
              <b>${here}</b>. Which should this device end up with?</p>
            <button class="btn-primary" data-how="replace" style="width:100%">Use the server's — replace this device</button>
            <p class="hintline" style="margin:6px 0 12px">Right for a second device. ${silent
              ? "This device's data is backed up first, then swapped for the server's."
              : "Its data is swapped for the server's. Want a copy first? Close this and use Export everything."}</p>
            <button class="btn-ghost" data-how="merge" style="width:100%">Combine both</button>
            <p class="hintline" style="margin:6px 0 0">Adds what is only here to the server. Where both have the same item, the server's version is kept.</p>`;
          msg('');
        } catch(err){
          c.disabled = false; c.textContent = 'Connect';
          msg(err.message || String(err), true);
        }
      });
    });
  }

  async function openAutoBackup(after){
    /* settings.js has no module-scope esc(); this sheet puts a URL the user
       typed back into an attribute, so it needs one */
    const esc = t => String(t == null ? '' : t)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    const s = await Backup.status();
    const ago = d => !d ? 'never' : new Date(d).toLocaleString(undefined,
      { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });

    App.sheet(`
      <h2>Automatic backup</h2>
      <p style="margin:0 0 14px;color:var(--muted);font-size:14.5px;line-height:1.55">
        ${s.silent
          ? `A copy of everything is written to <b>Documents / ${esc(Backup.FOLDER)}</b> once a day,
             and the last ${7} are kept. That folder is outside the app, so it survives
             the app being uninstalled.`
          : `This device can't write a file on its own — that's iPhones and iPads,
             and any browser. Tap <b>Back up now</b> and choose where to save it;
             once a week is plenty. Pointing it at a server below makes it automatic here too.`}</p>

      <div class="block" style="margin:0 0 14px">
        <div class="metaline" style="margin:0">
          <span class="tg count">Records · ${esc(ago(s.at))}</span>
          ${s.full ? `<span class="tg count">With pictures · ${esc(ago(s.full))}</span>` : ''}
        </div>
        ${s.error ? `<p class="hintline" style="margin:9px 0 0;color:var(--red)">${esc(s.error)}</p>` : ''}
      </div>

      <div class="field"><label for="bk-srv">Also send to a server (optional)</label>
        <input id="bk-srv" type="url" inputmode="url" placeholder="http://nastime.local:8080/backups"
          value="${esc(s.server || '')}">
        <p class="hintline" style="margin:7px 0 0">A PUT of the file to that address, named by date.
          Leave it empty if you don't want one. This is what makes the iPad automatic.</p></div>

      <label class="pp-chk" style="margin:4px 0 2px"><input type="checkbox" id="bk-off" ${s.off ? 'checked' : ''}>
        <span>Stop backing up automatically</span></label>

      <div class="sheetcta">
        <button class="btn-primary" data-run>Back up now</button>
        <button class="btn-ghost" data-save>Save settings</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        if(e.target.closest('[data-save]')){
          await Backup.setServer((sheetEl.querySelector('#bk-srv') || {}).value || '');
          await Backup.setOff((sheetEl.querySelector('#bk-off') || {}).checked);
          App.closeSheet(); U.toast('Saved'); after && after(); return;
        }
        if(!e.target.closest('[data-run]')) return;
        const btn = e.target.closest('[data-run]');
        btn.disabled = true; btn.textContent = 'Backing up…';
        /* save the server first, so "set it and run it" is one tap not two */
        await Backup.setServer((sheetEl.querySelector('#bk-srv') || {}).value || '');
        const r = await Backup.run('records', { manual:true });
        App.closeSheet();
        U.toast(r.ok ? 'Backed up — ' + r.done.join(', ').replace(/file:/, '')
                     : 'Could not back up: ' + (r.failed[0] || r.error || 'nowhere to write it'));
        after && after();
      });
    });
  }

  /* ---------- program start date ---------- */
  async function openStartDate(after){
    const p = await Data.program();
    const iso = new Date(p.start).toISOString().slice(0,10);

    App.sheet(`
      <h2>Program start</h2>
      <p style="margin:0 0 16px;color:var(--muted);font-size:15px;line-height:1.55">
        Day 1 is this date. The count runs on from there with no end — Today opens on whatever day it is now.
        <b>Moving the start never moves your plans:</b> everything keeps the real
        date it was planned for, and the day numbers shift instead.</p>
      <div class="field"><label for="ps-date">Start date</label>
        <input id="ps-date" type="date" value="${iso}"></div>
      <div class="field"><label for="ps-pre">Name for the days before Day 1</label>
        <input id="ps-pre" type="text" value="${String(p.preName || 'Prep')
          .replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" placeholder="Prep">
        <div class="opts" style="margin-top:8px">
          <button type="button" class="opt" data-pre="Prep">Prep</button>
          <button type="button" class="opt" data-pre="Red phase">Red phase</button>
        </div></div>
      <div class="field"><label>Quick set</label><div class="opts">
        <button type="button" class="opt" data-quick="oct1">Oct 1 this year</button>
        <button type="button" class="opt" data-quick="today">Today</button>
        <button type="button" class="opt" data-quick="mon">This Monday</button>
      </div></div>
      <p id="ps-preview" style="margin:0;color:var(--cream);font-size:15px"></p>
      <div class="sheetcta">
        <button class="btn-primary" data-save>Save start date</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {

      const input = sheetEl.querySelector('#ps-date');
      const preview = sheetEl.querySelector('#ps-preview');

      function refresh(){
        const start = new Date(input.value + 'T00:00');
        if(isNaN(start)) return preview.textContent = '';
        const today = new Date(); today.setHours(0,0,0,0);
        const n = Math.floor((today - start) / 86400000) + 1;
        preview.innerHTML = n >= 1
          ? `Today would be <b>day ${n}</b> · week ${Math.ceil(n / 7)}.`
          : `Starts in <b>${1 - n} day${1 - n === 1 ? '' : 's'}</b>.`;
      }
      input.addEventListener('input', refresh);
      refresh();

      sheetEl.addEventListener('click', async e => {
        const q = e.target.closest('[data-quick]');
        if(q){
          const d = new Date();
          if(q.dataset.quick === 'oct1') d.setMonth(9, 1);
          if(q.dataset.quick === 'mon')  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
          d.setHours(0,0,0,0);
          input.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,10);
          refresh();
          return;
        }
        const pb = e.target.closest('[data-pre]');
        if(pb){
          const f = sheetEl.querySelector('#ps-pre');
          if(f) f.value = pb.dataset.pre;
          return;
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-save]')) return;

        const start = new Date(input.value + 'T00:00');
        if(isNaN(start)) return U.toast('Pick a valid date');

        /* moveStart, not setProgram: everything is stored by day and week
           number, so writing the new start on its own would slide every task,
           beat and milestone onto a different real date. */
        const pre = (sheetEl.querySelector('#ps-pre') || {}).value;
        const r = await Data.moveStart(start.getTime(), pre);
        Data.invalidate('program');
        App.closeSheet();
        U.toast(r && r.days
          ? `Start moved — ${r.tasks} task${r.tasks === 1 ? '' : 's'} kept their dates`
          : 'Start date saved');
        after && after();
      });
    });
  }

  /* ---------- tool icon editor ---------- */
  /* Redraw the tools dock so a changed icon shows without restarting. */
  const refreshDock = async () => {
    if(window.App && App.reloadToolIcons){
      try { await App.reloadToolIcons(); } catch(e){ console.warn('Dock refresh failed', e); }
    }
  };

  function mountIcons(el){
    let custom = {}, selected = null, pending = null;

    el.innerHTML = Screens.bar({ title:'Tool icons' }) + `
    <div class="view">
      <p class="note" style="text-align:left;margin:0 0 18px">Pick a tool, then choose a colour or use your own image. Square images work best — they're cropped to fill.</p>
      <div class="grid" id="igrid"></div>
      <div id="editor"></div>
    </div>`;

    const grid = el.querySelector('#igrid');
    const editor = el.querySelector('#editor');

    function tile(t, i){
      const c = custom[slug(t.name)];
      let style, cls = '';
      if(c && c.blob){ style = `background-image:url(${URL.createObjectURL(c.blob)})`; cls = ' custom'; }
      else if(c && c.preset && App.PRESETS[c.preset]){ const [a,b] = App.PRESETS[c.preset];
        style = `background:linear-gradient(150deg,${a},${b})`; }
      else style = `background:linear-gradient(150deg,${t.a},${t.b})`;
      return `<button class="tool" data-i="${i}" style="${selected===i?'outline:2px solid var(--orange);outline-offset:3px':''}">
        <span class="icon${cls}" style="${style}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${t.d}"/></svg>
        </span><span>${t.name}</span></button>`;
    }

    function render(){
      grid.innerHTML = App.TOOLS.map(tile).join('');
      if(selected === null){ editor.innerHTML = ''; return; }
      const t = App.TOOLS[selected], cur = custom[slug(t.name)] || {};
      editor.innerHTML = `
      <div style="margin:22px 0 0;border:1px solid var(--line);border-radius:var(--r);padding:16px 14px">
        <h3 style="font-family:var(--display);font-weight:900;font-size:18px;margin:0 0 14px">${t.name}</h3>
        <p class="caps muted" style="font-size:11.5px;margin:0 0 10px">Colour</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 18px" id="sw">
          ${Object.entries(App.PRESETS).map(([k,[a,b]]) =>
            `<button data-p="${k}" style="width:44px;height:44px;border-radius:11px;cursor:pointer;
              border:1px solid rgba(255,255,255,.18);background:linear-gradient(150deg,${a},${b});
              ${cur.preset===k?'outline:2px solid var(--orange);outline-offset:2px':''}"></button>`).join('')}
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn-primary" style="height:46px;font-size:14px" data-a="upload">Use image</button>
          <button class="btn-ghost" style="height:46px" data-a="reset">Reset</button>
        </div>
      </div>`;
    }

    el.addEventListener('click', async e => {
      const cell = e.target.closest('[data-i]');
      if(cell){ const i = +cell.dataset.i; selected = selected === i ? null : i; render(); return; }
      if(selected === null) return;
      const key = slug(App.TOOLS[selected].name);

      const sw = e.target.closest('[data-p]');
      if(sw){ custom[key] = { preset:sw.dataset.p }; await Store.put('toolicon', custom[key], key);
        render(); await refreshDock(); return; }

      const act = e.target.closest('[data-a]');
      if(!act) return;
      if(act.dataset.a === 'reset'){ delete custom[key]; await Store.del('toolicon', key);
        render(); await refreshDock(); return; }
      if(act.dataset.a === 'upload'){
        pending = key;
        App.pickImage(async file => {
          custom[pending] = { blob:file };
          await Store.put('toolicon', custom[pending], pending);
          pending = null; render();
          await refreshDock();
        });
      }
    });

    (async () => {
      try { custom = await Store.allMap('toolicon'); } catch(e){ console.warn(e); }
      render();
    })();
  }

  /* ---------- pipeline ---------- */
  async function openPipeline(after){
    const c = await Pipeline.config();
    App.sheet(`
      <h2>Pipeline</h2>
      <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.6">
        How far ahead of a publish date the work has to happen. Everything auto-scheduling
        creates is worked back from these.</p>
      <div class="field"><label>Shoot, days before publishing</label>
        <div class="opts" data-group="shoot">
          ${[3,5,6,7,10,14].map(n => `<button type="button" class="opt" data-v="${n}"
            aria-pressed="${c.shootLead===n}">${n}</button>`).join('')}
        </div></div>
      <div class="field"><label>Edit, days before publishing</label>
        <div class="opts" data-group="edit">
          ${[1,2,3,4,5].map(n => `<button type="button" class="opt" data-v="${n}"
            aria-pressed="${c.editLead===n}">${n}</button>`).join('')}
        </div></div>
      <div class="field" style="display:flex;gap:10px">
        <span style="flex:1"><label for="pp-s">Shoot at</label>
          <input id="pp-s" type="time" value="${c.shootTime}"></span>
        <span style="flex:1"><label for="pp-e">Edit at</label>
          <input id="pp-e" type="time" value="${c.editTime}"></span>
      </div>
      <div class="field"><label>Plan ahead</label>
        <div class="opts" data-group="weeks">
          ${[2,4,6,8,12].map(n => `<button type="button" class="opt" data-v="${n}"
            aria-pressed="${c.weeks===n}">${n} weeks</button>`).join('')}
        </div></div>
      <div class="sheetcta">
        <button class="btn-primary" data-save>Save</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        const opt = e.target.closest('.opt');
        if(opt){
          opt.closest('.opts').querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed','false'));
          opt.setAttribute('aria-pressed','true'); return;
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-save]')) return;
        const pick = g => +sheetEl.querySelector(`[data-group="${g}"] .opt[aria-pressed="true"]`).dataset.v;
        await Pipeline.setConfig({
          shootLead:pick('shoot'), editLead:pick('edit'), weeks:pick('weeks'),
          shootTime:sheetEl.querySelector('#pp-s').value || '09:00',
          editTime:sheetEl.querySelector('#pp-e').value || '19:00'
        });
        App.closeSheet();
        U.toast('Pipeline saved');
        after && after();
      });
    });
  }

  /* ---------- notifications ---------- */
  async function openLeadTime(){
    const c = await Reminders.config();
    App.sheet(`
      <h2>Lead time</h2>
      <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.55">
        How far ahead of a timed task or beat you want the nudge.</p>
      <div class="field"><label>Before</label><div class="opts" data-group="lead">
        ${[0,5,10,15,30,60].map(n => `<button type="button" class="opt" data-v="${n}"
          aria-pressed="${c.lead===n}">${n === 0 ? 'At the time' : n + ' min'}</button>`).join('')}
      </div></div>
      <div class="field"><label>Look ahead</label><div class="opts" data-group="days">
        ${[1,2,3,7].map(n => `<button type="button" class="opt" data-v="${n}"
          aria-pressed="${c.days===n}">${n} day${n===1?'':'s'}</button>`).join('')}
      </div></div>
      <div class="sheetcta">
        <button class="btn-primary" data-save>Save</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        const opt = e.target.closest('.opt');
        if(opt){
          opt.closest('.opts').querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed','false'));
          opt.setAttribute('aria-pressed','true'); return;
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-save]')) return;
        const pick = g => +sheetEl.querySelector(`[data-group="${g}"] .opt[aria-pressed="true"]`).dataset.v;
        await Reminders.setConfig({ lead:pick('lead'), days:pick('days') });
        App.closeSheet();
        U.toast('Reminders rescheduled');
        mount(el);
      });
    });
  }

  async function doTestNotify(){
    if(!Notify.available())
      return U.toast('No plugin found — this only works in the installed app');
    try {
      const res = await Notify.update();
      if(res === 'denied') return U.toast('Android is blocking notifications for this app');
      U.toast(res ? 'Posted — check your shade' : 'Turned off in the toggle above');
    } catch(e){
      console.error(e);
      U.toast(e.message || 'The notification was refused');
    }
  }

  async function openNotifyDiag(){
    const st = await Notify.state();
    const inApp = Notify.available();
    const sysPerm = await Notify.systemAllowed();
    let promo = 'unknown';
    try {
      const p = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LiveStatus;
      if(p && p.isPromotable) promo = (await p.isPromotable()).value ? 'yes' : 'no (needs Android 16+)';
    } catch(e){ promo = 'could not check'; }

    const rowOf = (k,v,good) =>
      `<div class="row" style="cursor:default"><span class="lbl">${k}</span>
        <span style="font-family:var(--display),sans-serif;font-weight:900;
          color:${good === null ? 'var(--cream)' : good ? 'var(--green)' : 'var(--red)'}">${v}</span></div>`;

    App.sheet(`
      <h2>Notification diagnostics</h2>
      <div class="group compact" style="margin:0 0 16px">
        ${rowOf('Native plugin found', inApp ? 'yes' : 'no', inApp)}
        ${rowOf('Enabled in settings', (await Notify.isEnabled()) ? 'yes' : 'no', await Notify.isEnabled())}
        ${rowOf('Android permission', sysPerm, sysPerm === 'unknown' ? null : sysPerm === 'granted')}
        ${rowOf('Status bar chip', promo, null)}
      </div>
      ${sysPerm === 'denied' ? `<p class="note" style="text-align:left;color:var(--red);margin:0 0 16px">
        Android is blocking notifications for this app. Long-press the app icon, then App info,
        then Notifications, and allow them.</p>` : ''}
      <p class="caps muted" style="font-size:11.5px;margin:0 0 10px">Reminders</p>
      <div class="group compact" style="margin:0 0 16px">
        ${rowOf('Reminder plugin', Reminders.available() ? 'yes' : 'no', Reminders.available())}
        ${rowOf('Scheduled', String(await Reminders.count()), null)}
        ${rowOf('Upcoming with a time', String((await Reminders.upcoming()).length), null)}
      </div>
      <p class="caps muted" style="font-size:11.5px;margin:0 0 10px">What it would say right now</p>
      <div class="group compact" style="margin:0">
        ${rowOf('Title', st.title, null)}
        ${rowOf('Body', st.body, null)}
        ${rowOf('Chip text', st.shortText, null)}
        ${rowOf('Action button', st.actionLabel || '—', null)}
      </div>
      ${inApp ? '' : `<p class="note" style="text-align:left">
        Running in a browser. The plugin only exists inside the installed app.</p>`}
      <div class="sheetcta">
        <button class="btn-primary" data-test>Send it now</button>
        <button class="btn-ghost" data-cancel>Close</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(e.target.closest('[data-test]')){ await doTestNotify(); }
      });
    });
  }

  /* ---------- how it looks ----------

     One app, several palettes, rather than a second build for anyone who does
     not want charcoal and orange. Applied the moment you tap so you can see it
     rather than imagine it. */
  function doPalette(){
    if(!window.Palette) return U.toast('Not available');
    const now = Palette.current();
    const nowMode = Palette.currentMode();
    const nowType = Palette.currentType();

    App.sheet(`
      <h2 style="margin:0 0 3px">Colours</h2>
      <p class="hintline" style="margin:0 0 14px">Tap one to try it. It sticks until
        you change it, and only on this phone.</p>
      <div class="opts" data-group="setmode" style="margin:0 0 14px">
        ${Palette.MODES.map(m => `<button type="button" class="opt" data-setmode="${m.k}"
          aria-pressed="${nowMode === m.k}">${m.n}</button>`).join('')}
      </div>

      <div class="group compact" style="margin:0 0 14px">
        ${Palette.PALETTES.map(p => `
          <button class="row" data-pal="${p.k}">
            <span style="display:flex;gap:4px;flex:0 0 auto">
              <span data-sw="${p.k}" style="width:13px;height:13px;border-radius:50%;
                background:${p[nowMode]};border:1px solid rgba(128,128,128,.35)"></span>
              <span style="width:13px;height:13px;border-radius:50%;
                background:${p.acc};border:1px solid rgba(128,128,128,.35)"></span>
            </span>
            <span class="lbl">${p.n}<small>${p.d}</small></span>
            <span class="tg" data-on="${p.k}"${now === p.k ? '' : ' hidden'}>on</span>
          </button>`).join('')}
      </div>
      <h3 class="pgh">Lettering</h3>
      <p class="hintline" style="margin:0 0 10px">A separate choice — the rounded
        one works on any of the colours.</p>
      <div class="group compact" style="margin:0 0 14px">
        ${Palette.TYPES.map(t => `
          <button class="row" data-settype="${t.k}">
            <span class="lbl" style="font-family:${t.k === 'soft' ? '\'Quicksand\'' : 'var(--display)'},sans-serif">
              ${t.n}<small style="font-family:var(--body),sans-serif">${t.d}</small></span>
            <span class="tg" data-ton="${t.k}"${nowType === t.k ? '' : ' hidden'}>on</span>
          </button>`).join('')}
      </div>

      <div class="sheetcta">
        <button class="btn-ghost" data-cancel>Done</button>
      </div>`, sheet => {
      sheet.addEventListener('click', e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();

        /* Scoped to the sheet and named so it cannot collide: <html> carries
           data-mode and data-type now, and closest() walks that far — so every
           tap matched the mode branch and nothing else ever ran. */
        const m = e.target.closest('[data-setmode]');
        if(m){
          const k = Palette.setMode(m.dataset.setmode);
          sheet.querySelectorAll('[data-setmode]').forEach(b =>
            b.setAttribute('aria-pressed', String(b.dataset.setmode === k)));
          /* the ground swatch on each row has to follow the mode, or it shows
             a light dot while the app is dark */
          Palette.PALETTES.forEach(p => {
            const sw = sheet.querySelector(`[data-sw="${p.k}"]`);
            if(sw) sw.style.background = p[k];
          });
          return;
        }

        const t = e.target.closest('[data-settype]');
        if(t){
          const k = Palette.setType(t.dataset.settype);
          sheet.querySelectorAll('[data-ton]').forEach(x => { x.hidden = x.dataset.ton !== k; });
          return;
        }

        const p = e.target.closest('[data-pal]');
        if(!p) return;
        const k = Palette.set(p.dataset.pal);
        /* the tick moves without redrawing the sheet, so the colours change
           under a sheet that stays where it is */
        sheet.querySelectorAll('[data-on]').forEach(x => { x.hidden = x.dataset.on !== k; });
      });
    });
  }

  /* ---------- the same export the data hub offers ----------

     Two exports that sound alike do different jobs, so they sit next to each
     other and say which is which: the JSON one restores the app, the CSV one
     opens somewhere else. One file per sheet, because a CSV has one header row
     and anything else imports as nonsense. */
  async function doSheets(){
    if(!window.Datasets) return U.toast('Not available');

    const wanted = [];
    for(const d of Datasets.DATASETS){
      let n = 0;
      try { n = await d.count(); } catch(e){ n = 0; }
      if(n > 0) wanted.push({ d, n });
    }
    if(!wanted.length) return U.toast('Nothing to export yet');

    App.sheet(`
      <h2 style="margin:0 0 3px">Export as spreadsheets</h2>
      <p class="hintline" style="margin:0 0 14px">One file per sheet, so each opens
        straight into Notion or Sheets. ${wanted.length} file${
        wanted.length === 1 ? '' : 's'}, one share sheet each.</p>
      <div class="group compact" style="margin:0 0 14px;max-height:44vh;overflow-y:auto">
        ${wanted.map(({ d, n }) => `<div class="row" style="cursor:default">
          <span class="lbl">${d.n}<small>${n} row${n === 1 ? '' : 's'}</small></span>
        </div>`).join('')}
      </div>
      <div class="sheetcta">
        <button class="btn-primary" data-go>Export ${wanted.length}</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-go]')) return;
        App.closeSheet();
        try {
          for(const { d } of wanted){
            const csv = await Datasets.toCSV(d.id);
            await Saver.save(`creator-studio-${d.id}.csv`, csv,
              'text/csv;charset=utf-8', d.n);
          }
          U.toast(`${wanted.length} file${wanted.length === 1 ? '' : 's'} exported`);
        } catch(err){ console.error(err); U.toast('Export failed'); }
      });
    });
  }

  /* ---------- backup ---------- */
  /* Everything, every store. Photos make the file big, so leaving them out is
     offered — but never the default, because a backup without them is the one
     you regret. */
  function doBackup(){
    App.sheet(`
      <h2>Export everything</h2>
      <p style="margin:0 0 14px;color:var(--muted);font-size:14.5px;line-height:1.6">
        One file with every record in the app — episodes, quarters, months, workouts, meals, references.
        Restore it on another phone or the laptop with <b>Restore from backup</b>.</p>
      <div class="field"><label>Pictures and voice notes</label><div class="opts" data-group="setphotos">
        <button type="button" class="opt" data-v="with" aria-pressed="true">Include them</button>
        <button type="button" class="opt" data-v="without" aria-pressed="false">Leave them out</button>
      </div></div>
      <div class="sheetcta">
        <button class="btn-primary" data-go>Export</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        const opt = e.target.closest('.opt');
        if(opt){
          opt.closest('.opts').querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed','false'));
          opt.setAttribute('aria-pressed','true'); return;
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        const go = e.target.closest('[data-go]');
        if(!go || go.disabled) return;
        const photos = sheetEl.querySelector('[data-group="setphotos"] .opt[aria-pressed="true"]').dataset.v === 'with';
        go.disabled = true; go.textContent = 'Packing…';
        try {
          const obj = await Transfer.exportAll({ photos });
          const st = obj.stats || {};
          delete obj.stats;
          const d = new Date();
          const name = `creator-studio-3-${d.getFullYear()}-${U.pad(d.getMonth()+1)}-${U.pad(d.getDate())}${photos ? '' : '-no-photos'}.json`;
          const ok = await Transfer.download(name, JSON.stringify(obj), 'application/json');
          App.closeSheet();
          if(ok) U.toast(`Exported ${st.records || 0} records${photos ? ` and ${st.blobs || 0} pictures` : ''}`);
        } catch(err){ console.error(err); U.toast('Export failed'); go.disabled = false; go.textContent = 'Export'; }
      });
    });
  }

  /* ---------- plan pack ----------
     The planning side owns the plan, this app owns progress: opening a newer
     pack rewrites titles, dates, shots and angles and never touches a tick. */
  async function openPlanPack(){
    const text = await Transfer.pickFile('application/json,.json');
    if(!text) return;
    let pack, sum;
    try { pack = JSON.parse(text); sum = await PlanPack.preview(pack); }
    catch(err){ console.error(err); return U.toast(err.message || 'That file could not be read'); }
    const line = PlanPack.describe(sum);
    App.sheet(`
      <h2>Open plan pack</h2>
      <p style="margin:0 0 10px;color:var(--cream);font-size:16px">${line}</p>
      ${(sum.keptWithWork || []).length ? `<p style="margin:0 0 10px;color:var(--muted);font-size:14px;line-height:1.5">
        Kept because something was already done on them: ${sum.keptWithWork.slice(0, 6).join(', ')}${sum.keptWithWork.length > 6 ? '…' : ''}</p>` : ''}
      ${(sum.warnings || []).length ? `<p style="margin:0 0 10px;color:var(--amber);font-size:14px;line-height:1.5">${sum.warnings.slice(0, 4).join('<br>')}</p>` : ''}
      <p style="margin:0 0 14px;color:var(--muted);font-size:14px;line-height:1.5">Ticks and progress here are never changed.</p>
      <div class="sheetcta">
        <button class="btn-primary" data-go ${sum.nothingToDo ? 'disabled' : ''}>${sum.nothingToDo ? 'Nothing to change' : 'Bring it in'}</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-go]')) return;
        try {
          const done = await PlanPack.apply(pack);
          App.closeSheet();
          U.toast(PlanPack.describe(done));
        } catch(err){ console.error(err); U.toast(err.message || 'Could not bring that in'); }
      });
    });
  }

  function openRestore(){
    App.sheet(`
      <h2>Restore from backup</h2>
      <p style="margin:0 0 14px;color:var(--muted);font-size:14.5px;line-height:1.6">
        Pick a Creator Studio JSON file — from Creator Studio 3, or a backup made in Creator Studio v2.
        Pictures come along if the backup has them.</p>
      <div class="field"><label>How to bring it in</label><div class="opts" data-group="setmode">
        <button type="button" class="opt" data-v="merge" aria-pressed="true">Add to what's here</button>
        <button type="button" class="opt" data-v="replace" aria-pressed="false">Replace everything</button>
      </div></div>
      <div class="sheetcta">
        <button class="btn-primary" data-go>Choose file</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        const opt = e.target.closest('.opt');
        if(opt){
          opt.closest('.opts').querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed','false'));
          opt.setAttribute('aria-pressed','true'); return;
        }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-go]')) return;
        const mode = sheetEl.querySelector('[data-group="setmode"] .opt[aria-pressed="true"]').dataset.v;
        const text = await Transfer.pickFile('application/json,.json');
        if(!text) return;
        try {
          const n = await Transfer.importAll(JSON.parse(text), mode);
          const rep = Transfer.report() || {};
          Data.invalidate(); Nutrition.invalidate(); Channels.invalidate();
          App.closeSheet();
          U.toast(`Restored ${n} records${rep.photos ? ` and ${rep.photos} pictures` : ''}`);
          setTimeout(() => location.reload(), 700);
        } catch(err){ console.error(err); U.toast(err.message || 'That file could not be read'); }
      });
    });
  }

  /* ---------- CSV ---------- */
  function openCsvImport(){
    let kind = 'meals';
    const render = sheetEl => {
      const imp = Transfer.IMPORTERS[kind];
      sheetEl.innerHTML = `
        <h2>Import from CSV</h2>
        <div class="field"><label>What are you importing</label><div class="opts" data-group="kind">
          ${Object.entries(Transfer.IMPORTERS).map(([k,v]) =>
            `<button type="button" class="opt" data-k="${k}" aria-pressed="${kind===k}">${v.label}</button>`).join('')}
        </div></div>
        <p style="margin:0 0 10px;color:var(--muted);font-size:14px">Header row, these columns in any order:</p>
        <p style="margin:0 0 12px;font-family:ui-monospace,monospace;font-size:12.5px;color:var(--cream);
          background:var(--bg);border:1px solid var(--line);border-radius:var(--r);padding:11px;line-height:1.7">
          ${imp.columns}</p>
        <p style="margin:0 0 16px;color:var(--muted);font-size:13.5px;line-height:1.6">${imp.hint}</p>
        <div class="field"><label for="csv">Paste it, or choose a file</label>
          <textarea id="csv" rows="5" placeholder="title,category&#10;Chicken & Rice Bowl,Entrees"></textarea></div>
        <div class="sheetcta">
          <button class="btn-primary" data-go>Import</button>
          <button class="btn-ghost" data-file>Choose file</button>
        </div>
        <button class="btn-ghost" data-cancel style="width:100%;margin-top:10px">Cancel</button>`;
    };

    App.sheet('', sheetEl => {
      render(sheetEl);
      sheetEl.addEventListener('click', async e => {
        const k = e.target.closest('[data-k]');
        if(k){ kind = k.dataset.k; return render(sheetEl); }
        if(e.target.closest('[data-cancel]')) return App.closeSheet();

        if(e.target.closest('[data-file]')){
          const text = await Transfer.pickFile('.csv,text/csv');
          if(text) sheetEl.querySelector('#csv').value = text;
          return;
        }
        if(!e.target.closest('[data-go]')) return;

        const text = sheetEl.querySelector('#csv').value.trim();
        if(!text) return U.toast('Paste a CSV or choose a file');
        try {
          const rows = Transfer.toObjects(text);
          if(!rows.length) return U.toast('Needs a header row and at least one line');
          const n = await Transfer.IMPORTERS[kind].run(rows);
          App.closeSheet();
          U.toast(`Imported ${n} ${Transfer.IMPORTERS[kind].label.toLowerCase()}`);
        } catch(err){ console.error(err); U.toast('That file could not be read'); }
      });
    });
  }

  /* ---------- sample content ---------- */
  function openSamples(){
    App.sheet(`
      <h2>Load sample content</h2>
      <p style="margin:0 0 16px;color:var(--muted);font-size:15px;line-height:1.6">
        Adds four series, seven clips and five meals so the planner, calendar and grocery list have
        something to work with. It's added alongside anything you already have, not instead of it.</p>
      <div class="sheetcta">
        <button class="btn-primary" data-go>Add samples</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-go]')) return;
        try {
          await Data.loadSamples();
          await Nutrition.loadSamples();
          U.toast('Samples added');
        } catch(err){ console.error(err); U.toast("Couldn't add the samples"); }
        App.closeSheet();
      });
    });
  }

  /* ---------- wipe ---------- */
  function openWipe(){
    App.sheet(`
      <h2>Clear local data</h2>
      <p style="margin:0 0 14px;color:var(--muted);font-size:15px;line-height:1.6">
        Deletes every task, clip, series, meal, plan, workout session, journal entry, swipe and
        reference on this device — along with every photo you've added. There is no undo and no backup.</p>
      <div class="field"><label for="wp">Type <b style="color:var(--cream)">DELETE</b> to confirm</label>
        <input id="wp" type="text" autocomplete="off" placeholder="DELETE"></div>
      <div class="sheetcta">
        <button class="btn-primary" data-go style="background:var(--red);box-shadow:0 5px 0 var(--shadow)">Delete everything</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      sheetEl.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        if(!e.target.closest('[data-go]')) return;
        if(sheetEl.querySelector('#wp').value.trim().toUpperCase() !== 'DELETE')
          return U.toast('Type DELETE to confirm');
        try {
          /* "Local" means local: disconnect sync first and clear underneath it,
             or every delete would go to the server and empty the other devices. */
          if(window.Sync) await Sync.disconnect();
          const clear = (Store.raw && Store.raw.clear) || Store.clear;
          for(const n of Store.names()) await clear(n);
          Data.invalidate(); Nutrition.invalidate(); Channels.invalidate();
          App.closeSheet();
          U.toast('Everything cleared');
          setTimeout(() => location.reload(), 700);
        } catch(err){ console.error(err); U.toast("Couldn't clear the data"); }
      });
      setTimeout(() => { const f = sheetEl.querySelector('#wp'); if(f) f.focus(); }, 180);
    });
  }

  /* ---------- channels editor ---------- */
  /* Channel names your work already uses that aren't set up here yet — an
     imported series brings its channel's name but not the channel. */
  async function channelsInUse(){
    const names = new Set();
    try { (await Data.series()).forEach(x => x.channel && names.add(x.channel)); } catch(e){}
    try { (await Data.clips()).forEach(x => x.channel && names.add(x.channel)); } catch(e){}
    try { if(window.Videos) (await Videos.all()).forEach(x => x.channel && names.add(x.channel)); } catch(e){}
    return [...names];
  }

  /* A renamed channel takes its work with it: every series, clip, video and
     swipe tagged with the old name moves to the new one, so the colour and the
     filters keep finding them. */
  async function renameChannel(from, to){
    if(!from || !to || from === to) return 0;
    let n = 0;
    const move = async (store, recs, write) => {
      for(const r of recs){ await write(r); n++; }
    };
    try { await move('series', (await Data.series()).filter(x => x.channel === from),
      r => Data.saveSeries({ ...r, channel:to })); } catch(e){}
    try { await move('clips', (await Data.clips()).filter(x => x.channel === from),
      r => Data.saveClip({ ...r, channel:to })); } catch(e){}
    try { if(window.Videos) await move('videos', (await Videos.all()).filter(x => x.channel === from),
      r => Videos.save({ ...r, channel:to })); } catch(e){}
    try {
      const { values } = await Store.all('swipes');
      await move('swipes', values.filter(x => (x.channels || []).includes(from)),
        r => Store.put('swipes', { ...r, channels:r.channels.map(c => c === from ? to : c) }));
    } catch(e){}
    if(Data.invalidate){ Data.invalidate('series'); Data.invalidate('clips'); }
    return n;
  }

  async function mountChannels(el){
    let list = (await Channels.all()).slice();
    let missing = [];
    const refreshMissing = async () => {
      const have = new Set(list.map(c => c.n));
      missing = (await channelsInUse()).filter(n => !have.has(n)).sort();
    };
    await refreshMissing();

    function render(){
      el.innerHTML = Screens.bar({ title:'Channels',
        actions:`<button class="btn-sm accent" data-a="add">+ Add</button>` }) + `
      <div class="view">
        <p class="note" style="text-align:left;margin:0 0 16px">These appear wherever you tag work by brand —
          the swipe file today, and anywhere else that needs to know which channel something is for.</p>
        <div class="group" style="margin:0">
          ${list.map((c,i) => {
            const s2 = c.schedule;
            const cadence = s2 && s2.days && s2.days.length
              ? `Posts ${s2.days.map(d => Channels.DAYS[d]).join(', ')}${s2.perDay > 1 ? ` · ${s2.perDay}×` : ''}` +
                (s2.shootDays && s2.shootDays.length
                  ? ` · shoots ${s2.shootDays.map(d => Channels.DAYS[d]).join(', ')}` : '')
              : 'No cadence set';
            /* what it is for comes first — the cadence is useful, but it is not
               what you are checking when you cannot remember the channel */
            /* the row opens the channel; the pencil edits it. Tapping a name
               and getting a form was the wrong way round once a channel had
               somewhere of its own to be looked at. */
            return `<button class="row" data-open="${c.n.replace(/"/g,'&quot;')}">
              <span style="width:12px;height:12px;border-radius:50%;flex:0 0 12px;background:${c.c}"></span>
              <span class="lbl">${c.n}<small>${c.about
                ? String(c.about).replace(/</g, '&lt;') + ' · ' + cadence
                : cadence}</small></span>
              <span class="chedit" data-i="${i}" role="button" aria-label="Edit">EDIT</span>
              ${chev}</button>`;
          }).join('')}
        </div>
        ${list.length ? '' : `<div class="empty"><b>No channels</b>Add the brands you publish under.</div>`}
        ${missing.length ? `<div class="empty" style="margin-top:16px;text-align:left">
          <b>Used in your work but not set up</b>
          <span style="display:block;margin:0 0 10px">Each of these is a name something is tagged with. If it's really one
            of your channels written differently, file it under that one — everything tagged with it moves across.
            Otherwise add it as a new channel.</span>
          ${missing.map((n, i) => {
            const near = Channels.match ? Channels.match(n, list) : null;
            const esc2 = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
            return `<div style="display:grid;grid-template-columns:1fr 1.2fr;gap:8px;align-items:center;margin:0 0 8px">
              <b style="font-size:14.5px;margin:0">${esc2(n)}</b>
              <select data-miss="${i}" class="unit">
                <option value="__add">Add as a new channel</option>
                ${list.map(c => `<option value="${esc2(c.n)}" ${near && near.n === c.n ? 'selected' : ''}>File under ${esc2(c.n)}</option>`).join('')}
                <option value="__skip">Leave it for now</option>
              </select></div>`;
          }).join('')}
          <button class="btn-ghost" data-a="addmissing" style="width:100%;margin-top:6px">Apply</button></div>` : ''}
      </div>`;
    }

    function openForm(idx){
      const c = idx === null ? { n:'', c:Channels.PALETTE[list.length % Channels.PALETTE.length] } : list[idx];
      App.sheet(`
        <h2>${idx === null ? 'New channel' : 'Edit channel'}</h2>
        <div class="field"><label for="ch-name">Name</label>
          <input id="ch-name" type="text" value="${c.n.replace(/"/g,'&quot;')}" placeholder="Fix & Invest"></div>
        <!-- Eight channels is more than anyone holds in their head. A line about
             what each one is for is the difference between picking a channel and
             guessing at one. -->
        <div class="field"><label for="ch-about">What it is for <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <textarea id="ch-about" rows="2"
            placeholder="Who it is for and what belongs on it — the reminder you will want in six weeks."
            >${(c.about || '').replace(/</g, '&lt;')}</textarea></div>

        <div class="field"><label>Publishes on</label>
          <div class="opts" data-group="days">
            ${Channels.DAYS.map((d,i) => `<button type="button" class="opt" data-day="${i}"
              aria-pressed="${((c.schedule && c.schedule.days) || []).includes(i)}">${d}</button>`).join('')}
          </div>
        </div>
        <div class="field" style="display:flex;gap:10px">
          <span style="flex:1"><label for="ch-per">Per day</label>
            <input id="ch-per" type="number" min="1" max="5" value="${(c.schedule && c.schedule.perDay) || 1}"></span>
          <span style="flex:1"><label for="ch-time">Goes out at</label>
            <input id="ch-time" type="time" value="${(c.schedule && c.schedule.time) || '18:00'}"></span>
        </div>
        <div class="field"><label>Shoot days <span style="text-transform:none;letter-spacing:0;font-weight:400">(when you're already doing it)</span></label>
          <div class="opts" data-group="shootdays">
            ${Channels.DAYS.map((d,i) => `<button type="button" class="opt" data-sday="${i}"
              aria-pressed="${((c.schedule && c.schedule.shootDays) || []).includes(i)}">${d}</button>`).join('')}
          </div>
          <p style="margin:9px 0 0;font-size:13px;color:var(--dim);line-height:1.5">
            Leave empty and pieces are scheduled by the pipeline lead time instead.</p>
        </div>
        <div class="field"><label for="ch-max">Most pieces in one shoot day</label>
          <input id="ch-max" type="number" min="1" max="10" value="${(c.schedule && c.schedule.maxPerShoot) || 3}"></div>

        <div class="field"><label>Platform</label>
          <div class="opts" data-group="plat">
            ${[['youtube','YouTube'],['shorts','Shorts'],['tiktok','TikTok'],['reels','Reels']].map(([v,n]) =>
              `<button type="button" class="opt" data-plat="${v}"
                aria-pressed="${((c.schedule && c.schedule.platform) || 'youtube') === v}">${n}</button>`).join('')}
          </div>
        </div>

        <div class="field"><label>Colour</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap" id="ch-colours">
            ${Channels.PALETTE.map(p => `<button type="button" data-c="${p}"
              style="width:40px;height:40px;border-radius:50%;cursor:pointer;background:${p};
              border:1px solid rgba(255,255,255,.2);${c.c===p?'outline:2px solid var(--cream);outline-offset:2px':''}"></button>`).join('')}
          </div></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>${idx === null ? 'Add channel' : 'Save'}</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${idx === null ? '' : `<button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete channel</button>`}`,
      sheetEl => {
        let colour = c.c;
        sheetEl.addEventListener('click', async e => {
          const sdayBtn = e.target.closest('[data-sday]');
          if(sdayBtn){
            const on = sdayBtn.getAttribute('aria-pressed') === 'true';
            sdayBtn.setAttribute('aria-pressed', String(!on));
            return;
          }
          const dayBtn = e.target.closest('[data-day]');
          if(dayBtn){
            const on = dayBtn.getAttribute('aria-pressed') === 'true';
            dayBtn.setAttribute('aria-pressed', String(!on));
            return;
          }
          const platBtn = e.target.closest('[data-plat]');
          if(platBtn){
            sheetEl.querySelectorAll('[data-plat]').forEach(b => b.setAttribute('aria-pressed','false'));
            platBtn.setAttribute('aria-pressed','true');
            return;
          }
          const sw = e.target.closest('[data-c]');
          if(sw){
            colour = sw.dataset.c;
            sheetEl.querySelectorAll('#ch-colours button').forEach(b => b.style.outline = '');
            sw.style.outline = '2px solid var(--cream)'; sw.style.outlineOffset = '2px';
            return;
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-delete]')){
            list.splice(idx, 1); await Channels.save(list);
            App.closeSheet(); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          const n = sheetEl.querySelector('#ch-name').value.trim();
          if(!n) return U.toast('Name the channel first');
          const days = [...sheetEl.querySelectorAll('[data-day][aria-pressed="true"]')]
            .map(b => +b.dataset.day);
          const platSel = sheetEl.querySelector('[data-plat][aria-pressed="true"]');
          const schedule = {
            days,
            perDay: Math.max(1, +sheetEl.querySelector('#ch-per').value || 1),
            time: sheetEl.querySelector('#ch-time').value || '18:00',
            platform: platSel ? platSel.dataset.plat : 'youtube',
            shootDays: [...sheetEl.querySelectorAll('[data-sday][aria-pressed="true"]')].map(b => +b.dataset.sday),
            maxPerShoot: Math.max(1, +sheetEl.querySelector('#ch-max').value || 3)
          };
          const about = sheetEl.querySelector('#ch-about').value.trim();
          const oldName = idx === null ? null : list[idx].n;
          idx === null ? list.push({ n, c:colour, about, schedule })
                       : list[idx] = { n, c:colour, about, schedule };
          await Channels.save(list);
          const moved = oldName && oldName !== n ? await renameChannel(oldName, n) : 0;
          App.closeSheet();
          if(moved) U.toast(`Renamed on ${moved} item${moved === 1 ? '' : 's'}`);
          await refreshMissing(); render();
        });
        setTimeout(() => { const f = sheetEl.querySelector('#ch-name'); if(f) f.focus(); }, 180);
      });
    }

    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'add') return openForm(null);
      if(a && a.dataset.a === 'addmissing'){
        (async () => {
          let merged = 0, added = 0, moved = 0;
          const choices = missing.map((n, i) => {
            const sel = el.querySelector(`[data-miss="${i}"]`);
            return { n, to: sel ? sel.value : '__add' };
          });
          for(const ch of choices){
            if(ch.to === '__skip') continue;
            if(ch.to === '__add'){
              list.push({ n:ch.n, c:Channels.PALETTE[list.length % Channels.PALETTE.length], about:'' });
              added++;
            } else { moved += await renameChannel(ch.n, ch.to); merged++; }
          }
          await Channels.save(list);
          await refreshMissing(); render();
          U.toast([merged ? `${merged} filed under your channels (${moved} item${moved === 1 ? '' : 's'} moved)` : '',
                   added ? `${added} added — tap one to set its colour` : ''].filter(Boolean).join(' · ') || 'Nothing changed');
        })();
        return;
      }
      const opn = e.target.closest('[data-open]');
      if(opn && !e.target.closest('[data-i]')){
        return Screens.push('channel', { name:opn.dataset.open,
          onChange:async () => { list = (await Channels.all()).slice(); render(); } });
      }

      const r = e.target.closest('[data-i]');
      if(r) openForm(+r.dataset.i);
    });

    render();
  }

  /* ---------- coverage kit ---------- */
  async function mountCoverage(el){
    let list = (await Coverage.kit()).slice();

    function render(){
      const total = list.reduce((n,k) => n + k.target, 0);
      el.innerHTML = Screens.bar({ title:'Coverage kit',
        actions:`<button class="btn-sm accent" data-a="lib">Library</button>` }) + `
      <div class="view">
        <p class="note" style="text-align:left;margin:0 0 16px">
          The shots you want off every piece. This appears on each task and in capture mode as a tally
          you count up while filming — ${total} shots in total right now.</p>
        <div class="group" style="margin:0">
          ${list.map((k,i) => `<button class="row" data-i="${i}">
            <span class="lbl">${k.label}${k.hint ? `<small>${k.hint}</small>` : ''}</span>
            <span style="font-family:var(--display),sans-serif;font-weight:900;color:var(--orange)">${k.target}×</span>
            ${chev}</button>`).join('')}
        </div>
        ${list.length ? '' : `<div class="empty"><b>Nothing in the kit</b>Add the shot types you always want.</div>`}
        <button class="btn-ghost" data-a="reset" style="width:100%;margin-top:16px">Reset to the default kit</button>
      </div>`;
    }

    function openForm(idx){
      const k = idx === null ? { id:'', label:'', target:2, hint:'' } : list[idx];
      App.sheet(`
        <h2>${idx === null ? 'New shot type' : 'Edit shot type'}</h2>
        <div class="field"><label for="ck-label">Name</label>
          <input id="ck-label" type="text" value="${(k.label||'').replace(/"/g,'&quot;')}" placeholder="Wide"></div>
        <div class="field"><label for="ck-hint">Hint <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <input id="ck-hint" type="text" value="${(k.hint||'').replace(/"/g,'&quot;')}" placeholder="The whole action"></div>
        <div class="field"><label for="ck-target">How many</label>
          <input id="ck-target" type="number" min="1" value="${k.target}"></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>${idx === null ? 'Add' : 'Save'}</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${idx === null ? '' : `<button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Remove</button>`}`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-delete]')){
            list.splice(idx,1); await Coverage.saveKit(list); App.closeSheet(); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          const label = sheetEl.querySelector('#ck-label').value.trim();
          if(!label) return U.toast('Name the shot type');
          const rec = {
            id: k.id || U.slug(label),
            label,
            hint: sheetEl.querySelector('#ck-hint').value.trim(),
            target: Math.max(1, +sheetEl.querySelector('#ck-target').value || 1)
          };
          idx === null ? list.push(rec) : list[idx] = rec;
          await Coverage.saveKit(list);
          App.closeSheet(); render();
        });
        setTimeout(() => { const f = sheetEl.querySelector('#ck-label'); if(f) f.focus(); }, 180);
      });
    }

    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'lib'){
        return ShotLib.pick({
          title:'Your default kit',
          existing:list,
          onPick: async picked => { list = picked; await Coverage.saveKit(list); render(); }
        });
      }
      if(a && a.dataset.a === 'reset'){
        list = Coverage.DEFAULT_KIT.slice();
        await Coverage.saveKit(list);
        U.toast('Back to the default kit');
        return render();
      }
      const r = e.target.closest('[data-i]');
      if(r) openForm(+r.dataset.i);
    });

    render();
  }

  /* ---------- shot library ---------- */
  async function mountShotLibrary(el){
    let list = (await ShotLib.all()).slice();
    let q = '';

    function render(){
      const rows = q ? list.filter(k => (k.label + ' ' + (k.hint||'')).toLowerCase().includes(q)) : list;
      const groups = {};
      rows.forEach(k => { (groups[k.group || 'Other'] = groups[k.group || 'Other'] || []).push(k); });

      el.innerHTML = Screens.bar({ title:'Shot library',
        actions:`<button class="btn-sm accent" data-a="add">+ Add</button>` }) + `
      <div class="view">
        <p class="note" style="text-align:left;margin:0 0 14px">
          Every angle you can plan a shot against. ${list.length} in the library.</p>
        <div class="angsearch" style="margin:0 0 16px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>
          <input id="lq" type="text" placeholder="Search…" value="${q}">
        </div>
        ${Object.entries(groups).map(([g, items]) => `
          <div class="sec"><h2>${g}</h2><div class="rule"></div><span class="alt">${items.length}</span></div>
          <div class="group" style="margin:0">
            ${items.map(k => `<button class="row" data-id="${k.id}">
              <span class="lbl">${k.label}${k.hint ? `<small>${k.hint}</small>` : ''}</span>
              ${chev}</button>`).join('')}
          </div>`).join('')}
        ${rows.length ? '' : `<div class="empty"><b>Nothing matches</b>Try a different word, or add it.</div>`}
        <button class="btn-ghost" data-a="reset" style="width:100%;margin-top:18px">Reset to the built-in library</button>
      </div>`;

      const li = el.querySelector('#lq');
      if(li){
        li.addEventListener('input', () => { q = li.value.trim().toLowerCase(); render(); });
        if(q){ li.focus(); li.setSelectionRange(q.length, q.length); }
      }
    }

    function openForm(id){
      const idx = id ? list.findIndex(k => k.id === id) : -1;
      const k = idx === -1 ? { id:'', label:'', hint:'', group:'Yours' } : list[idx];
      const inUse = idx !== -1;

      App.sheet(`
        <h2>${inUse ? 'Edit angle' : 'New angle'}</h2>
        <div class="field"><label for="sl-label">Name</label>
          <input id="sl-label" type="text" value="${(k.label||'').replace(/"/g,'&quot;')}" placeholder="Dutch angle"></div>
        <div class="field"><label for="sl-hint">Hint <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <input id="sl-hint" type="text" value="${(k.hint||'').replace(/"/g,'&quot;')}" placeholder="Tilted — unease or energy"></div>
        <div class="field"><label>Group</label><div class="opts" data-group="g">
          ${ShotLib.GROUPS.map(g => `<button type="button" class="opt" data-v="${g}" aria-pressed="${k.group===g}">${g}</button>`).join('')}
        </div></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>${inUse ? 'Save' : 'Add'}</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${inUse ? `<button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Remove from the library</button>` : ''}`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          const opt = e.target.closest('.opt');
          if(opt){
            opt.closest('.opts').querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed','false'));
            opt.setAttribute('aria-pressed','true'); return;
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-delete]')){
            list.splice(idx,1); await ShotLib.save(list);
            App.closeSheet(); U.toast('Removed'); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          const label = sheetEl.querySelector('#sl-label').value.trim();
          if(!label) return U.toast('Name the angle');
          const rec = {
            id: k.id || U.slug(label),
            label,
            hint: sheetEl.querySelector('#sl-hint').value.trim(),
            group: sheetEl.querySelector('[data-group="g"] .opt[aria-pressed="true"]').dataset.v
          };
          idx === -1 ? list.push(rec) : list[idx] = rec;
          await ShotLib.save(list);
          App.closeSheet(); render();
        });
        setTimeout(() => { const f = sheetEl.querySelector('#sl-label'); if(f) f.focus(); }, 180);
      });
    }

    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'add') return openForm(null);
      if(a && a.dataset.a === 'reset'){
        list = await ShotLib.reset();
        U.toast('Back to the built-in library');
        return render();
      }
      const r = e.target.closest('[data-id]');
      if(r) openForm(r.dataset.id);
    });

    render();
  }

  Screens.register('shotlibrary', mountShotLibrary);
  Screens.register('coverage', mountCoverage);
  Screens.register('channels', mountChannels);
  Screens.register('settings', mount);
  Screens.register('toolicons', mountIcons);
})();
