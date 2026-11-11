/* A run as it happens: a clock, and a big button you hit at each marker. */
(function(){
  const MI_PER_KM = 0.621371;

  async function mount(el, params){
    let unit = await Units.get();
    const imperial = unit !== 'kg';
    const lab = imperial ? 'mi' : 'km';

    let startedAt = null, elapsed = 0, ticking = null, running = false;
    let laps = [];                  /* seconds at each marker */
    let manualDist = 0;             /* if you finish mid-lap */

    /* GPS, when the phone and the shell allow it. Tapping LAP still works either
       way — satellites under trees are not something to depend on alone. */
    let gps = null, gpsKm = 0, gpsAcc = null, gpsErr = null, useGps = false;
    let kind = 'outdoor';           /* outside, treadmill or a ruck */
    let packKg = 0;

    const KINDS = [
      { k:'outdoor', label:'Outside' },
      { k:'treadmill', label:'Treadmill' },
      { k:'ruck', label:'Ruck' }
    ];

    /* Written every few seconds while running, so a kill loses seconds rather
       than the whole run. */
    let saveTimer = null;
    function persist(){
      if(!startedAt && !elapsed) return;
      RunGPS.saveLive({
        startedAt, elapsed, running, laps: laps.slice(), manualDist,
        kind, packKg, gpsKm,
        points: gps && gps.points ? gps.points.slice(-400) : []
      });
    }
    function beginPersist(){
      clearInterval(saveTimer);
      saveTimer = setInterval(persist, 5000);
    }
    function endPersist(){ clearInterval(saveTimer); saveTimer = null; }

    function startGps(){
      if(!RunGPS.available() || kind === 'treadmill'){ useGps = false; return; }
      gps = RunGPS.track(u => {
        if(u.error){ gpsErr = u.error; render(); return; }
        const hadError = !!gpsErr;
        gpsErr = null;
        gpsKm = u.km;
        gpsAcc = u.acc;
        /* redraw the whole screen only when the shape of it changed */
        if(hadError) return render();
        paintDistance();
      });
      useGps = !!gps.ok;
    }
    function stopGps(){ if(gps) gps.stop(); gps = null; }

    const hms = sec => {
      sec = Math.max(0, Math.floor(sec));
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
               : `${m}:${String(s).padStart(2,'0')}`;
    };
    const ms = sec => {
      sec = Math.max(0, Math.round(sec));
      return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2,'0')}`;
    };
    const now = () => elapsed + (running && startedAt ? (Date.now() - startedAt) / 1000 : 0);
    /* GPS distance wins when it is on, since it is measuring the actual route;
       the lap count is the fallback and the treadmill's only option. */
    const dist = () => useGps && gpsKm > 0
      ? (imperial ? gpsKm * MI_PER_KM : gpsKm)
      : laps.length + manualDist;
    const bestLap = () => {
      if(!laps.length) return null;
      let best = Infinity;
      laps.forEach((t,i) => { const split = i ? t - laps[i-1] : t; best = Math.min(best, split); });
      return best;
    };

    /* the distance, its pace, and the accuracy line — nothing else moves */
    function paintDistance(){
      const d = dist();
      const box = el.querySelector('.rl-dist b');
      if(box) box.textContent = d.toFixed(d % 1 ? 2 : 0);
      const pace = el.querySelector('.rl-pace');
      if(pace && d) pace.textContent = `${ms(now() / d)} per ${lab}`;
      const line = el.querySelector('.rl-gps');
      if(line && useGps && !gpsErr && kind !== 'treadmill'){
        line.textContent = `GPS on${gpsAcc != null ? ` · ±${Math.round(gpsAcc)}m` : ''}` +
          (RunGPS.source() === 'background' ? ' · keeps going with the screen off'
                                           : ' · keep the screen on');
      }
    }

    function render(){
      lastText = '';          /* the element about to be replaced held it */
      const t = now();
      const d = dist();
      const pace = d ? t / d : 0;
      const best = bestLap();

      el.className = 'screen in';
      el.innerHTML = Screens.bar({ kicker:'Workout', title:'Run' }) + `
      <div class="rl">
        <div class="rl-body">
          <p class="rl-clock">${hms(t)}</p>
          <p class="rl-sub">${running ? 'Running' : (t ? 'Paused' : 'Ready')}</p>

          <div class="rl-dist"><b>${d.toFixed(d % 1 ? 2 : 0)}</b><span>${lab}</span></div>
          <p class="rl-pace">${d ? `${ms(pace)} per ${lab}` : 'Hit LAP at each marker'}</p>

          <div class="rl-kind">${KINDS.map(k =>
            `<button data-kind="${k.k}" ${kind === k.k ? 'aria-current="page"' : ''}
              ${running ? 'disabled' : ''}>${k.label}</button>`).join('')}</div>

          <p class="rl-gps">${
            kind === 'treadmill' ? 'Treadmill — tapping LAP is the only way to count it'
            : gpsErr ? `GPS: ${gpsErr} — LAP still counts`
            : useGps ? `GPS on${gpsAcc != null ? ` · ±${Math.round(gpsAcc)}m` : ''}${
                RunGPS.source() === 'background' ? ' · keeps going with the screen off'
                                                 : ' · keep the screen on'}`
            : RunGPS.available() ? 'GPS starts when you do'
            : 'No GPS here — tap LAP at each marker'}</p>

          ${laps.length ? `<div class="rl-laps">
            ${laps.map((at,i) => {
              const split = i ? at - laps[i-1] : at;
              return `<div class="rl-lap${best !== null && Math.abs(split - best) < .01 ? ' best' : ''}">
                <b>${i+1}</b>
                <span class="t">${ms(split)}</span>
                <span class="p">${hms(at)}${best !== null && Math.abs(split - best) < .01 ? ' · fastest' : ''}</span>
              </div>`;
            }).join('')}
          </div>` : ''}
        </div>

        <div class="rl-foot">
          <button data-a="toggle">${running ? 'Pause' : (now() ? 'Resume' : 'Start')}</button>
          <button class="lap" data-a="lap" ${running ? '' : 'disabled'}>LAP</button>
          <button data-a="finish" ${now() ? '' : 'disabled'}>Finish</button>
        </div>
      </div>`;
    }

    /* The clock repaints on the frame loop rather than a timer: an interval gets
       throttled and coalesced, which is what made it look frozen and then jump.
       Only the text that changed is written — rebuilding the screen for every
       GPS fix was the other half of the stutter. */
    let frame = null, lastText = '';
    function paintClock(){
      const clock = el.querySelector('.rl-clock');
      if(clock){
        const t = hms(now());
        if(t !== lastText){ clock.textContent = t; lastText = t; }
      }
      frame = running ? requestAnimationFrame(paintClock) : null;
    }
    function tick(){
      clearInterval(ticking);
      if(frame) cancelAnimationFrame(frame);
      lastText = '';
      frame = requestAnimationFrame(paintClock);
      /* a belt-and-braces timer, in case frames stop while backgrounded */
      ticking = setInterval(() => { if(running) paintClock(); }, 1000);
    }
    function stopTick(){
      clearInterval(ticking);
      if(frame) cancelAnimationFrame(frame);
      frame = null;
    }

    function start(){
      running = true;
      startedAt = Date.now();
      if(!gps) startGps();
      tick();
      beginPersist();
      persist();
      render();
    }
    function pause(){
      elapsed = now();
      running = false;
      startedAt = null;
      stopTick();
      persist();
      render();
    }

    async function finish(){
      const t = now();
      if(running) pause();
      const d = dist();

      App.sheet(`
        <h2>Finish the run</h2>
        <div class="field"><label for="f-d">Distance (${lab})</label>
          <input id="f-d" type="number" step="0.01" min="0" value="${d ? d.toFixed(2) : ''}"
            placeholder="${laps.length ? d.toFixed(2) : '3.10'}"></div>
        <p style="margin:0 0 16px;color:var(--muted);font-size:14px;line-height:1.55">
          ${laps.length ? `${laps.length} marker${laps.length===1?'':'s'} tapped. Adjust if you finished part way through one.`
            : 'No markers tapped — put the distance in by hand.'}</p>
        <div class="field"><label for="f-note">Note <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <input id="f-note" type="text" placeholder="Easy, humid"></div>
        <p style="margin:0 0 4px;color:var(--orange);font-family:var(--display),sans-serif;font-weight:900;font-size:15px">
          ${hms(t)} total</p>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save the run</button>
          <button class="btn-ghost" data-cancel>Keep going</button>
        </div>
        <button class="btn-ghost" data-discard style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Discard</button>`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-discard]')){ App.closeSheet(); Screens.pop(); return; }
          if(!e.target.closest('[data-save]')) return;

          const val = +sheetEl.querySelector('#f-d').value || 0;
          if(!val) return U.toast('How far did you go?');
          const km = imperial ? val / MI_PER_KM : val;

          await Store.put('runs', {
            id:'rn_' + Date.now().toString(36),
            km, sec: Math.round(t),
            kind, packKg,
            /* the route itself, so the distance can be re-derived and checked */
            track: gps && gps.points ? gps.points.slice() : [],
            gps: useGps,
            note: sheetEl.querySelector('#f-note').value.trim(),
            laps: laps.map(x => Math.round(x)),
            at: Date.now()
          });
          await RunGPS.clearLive();
          App.closeSheet();
          U.toast('Run saved');
          params && params.onChange && params.onChange();
          Screens.pop();
          setTimeout(() => Celebrate.showAwards(), 420);
        });
      });
    }

    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if(!a) return;
      if(a.dataset.a === 'toggle') return running ? pause() : start();
      if(a.dataset.a === 'lap'){
        if(!running) return;
        laps.push(now());
        if(navigator.vibrate) navigator.vibrate(18);
        return render();
      }
      if(a.dataset.a === 'finish'){ stopGps(); endPersist(); return finish(); }

      const k = e.target.closest('[data-kind]');
      if(k && !running){
        kind = k.dataset.kind;
        /* a treadmill has nowhere to go, so the satellites are switched off */
        if(kind === 'treadmill'){ stopGps(); useGps = false; }
        return render();
      }
    });

    /* leaving the screen should not leave a timer running */
    el.addEventListener('screen:pop', () => {
      stopTick();
      endPersist();
      /* leaving the screen mid-run keeps the record, so it can be picked up */
      if(running || elapsed) persist(); else RunGPS.clearLive();
      stopGps();
    });

    /* Coming back to a run that was still going when the app went away. */
    (async () => {
      const left = RunGPS.resumable(await RunGPS.loadLive());
      if(!left) return;

      const mins = Math.round(((left.elapsed || 0) +
        (left.running && left.startedAt ? (Date.now() - left.startedAt) / 1000 : 0)) / 60);

      App.sheet(`
        <h2 style="margin:0 0 3px">A run was still going</h2>
        <p class="hintline" style="margin:0 0 16px">${mins} minute${mins === 1 ? '' : 's'} in,
          ${(left.laps || []).length} lap${(left.laps || []).length === 1 ? '' : 's'}${
          left.gpsKm ? `, ${(imperial ? left.gpsKm * MI_PER_KM : left.gpsKm).toFixed(2)} ${lab} tracked` : ''}.</p>
        <div class="sheetcta">
          <button class="btn-primary" data-resume>Pick it back up</button>
          <button class="btn-ghost" data-bin>Throw it away</button>
        </div>`, sheet => {
        sheet.addEventListener('click', async e => {
          if(e.target.closest('[data-bin]')){
            await RunGPS.clearLive();
            return App.closeSheet();
          }
          if(!e.target.closest('[data-resume]')) return;

          elapsed = left.elapsed || 0;
          laps = left.laps || [];
          manualDist = left.manualDist || 0;
          kind = left.kind || 'outdoor';
          packKg = left.packKg || 0;
          gpsKm = left.gpsKm || 0;
          /* the clock kept running while the app was gone */
          if(left.running && left.startedAt){
            elapsed += (Date.now() - left.startedAt) / 1000;
          }
          App.closeSheet();
          start();
        });
      });
    })();

    render();
  }

  Screens.register('run-live', mount);
})();
