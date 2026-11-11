/* The end-of-day moment: a chime, a streak, and a card worth posting. */
(function(global){

  /* ---- sound: synthesised, so there is no asset to ship or fail to load ---- */
  let ctx = null;
  async function soundOn(){
    const v = await Store.get('settings','sound');
    return v === undefined ? true : !!v;
  }
  async function setSound(on){ await Store.put('settings', !!on, 'sound'); }

  async function chime(){
    if(!(await soundOn())) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if(ctx.state === 'suspended') await ctx.resume();
      const now = ctx.currentTime;
      /* a rising major triad — reads as "finished" rather than "alert" */
      [[523.25, 0], [659.25, .10], [783.99, .20], [1046.5, .32]].forEach(([hz, at]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = hz;
        gain.gain.setValueAtTime(0, now + at);
        gain.gain.linearRampToValueAtTime(.22, now + at + .02);
        gain.gain.exponentialRampToValueAtTime(.0008, now + at + .85);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + at);
        osc.stop(now + at + .9);
      });
      if(navigator.vibrate) navigator.vibrate([14, 60, 22]);
    } catch(e){ console.warn('No audio', e); }
  }

  /* ---- the streak, and the freezes that protect it ----

     Worked out in one forward pass over the whole program, so every screen that
     asks gets the same answer. A freeze is earned for each full week held, up to
     two banked, and is spent automatically on a day you missed — which is the
     only way a missed day does not reset you to zero.

     Today is never judged: a day still in progress cannot break anything, and
     is never worth spending a freeze on. */
  const FREEZE_EVERY = 7;
  const FREEZE_CAP = 2;

  async function computeStreak(){
    const [tasks, today] = await Promise.all([Data.tasks(), Data.currentDay()]);
    const byDay = {};
    tasks.forEach(t => {
      const d = byDay[t.day] = byDay[t.day] || { total:0, done:0 };
      d.total++;
      if(t.view === 'done') d.done++;
    });

    let run = 0, best = 0, freezes = 0, earned = 0;
    const saved = [];

    for(let d = 1; d <= today; d++){
      const s = byDay[d];
      if(!s || !s.total) continue;                 /* an empty day is not a day */

      const perfect = s.done >= s.total;

      if(d === today){
        /* still open — it can add to the run but never end it */
        if(perfect){
          run++;
          if(run % FREEZE_EVERY === 0 && freezes < FREEZE_CAP){ freezes++; earned++; }
        }
        break;
      }

      if(perfect){
        run++;
        if(run % FREEZE_EVERY === 0 && freezes < FREEZE_CAP){ freezes++; earned++; }
      } else if(freezes > 0 && run > 0){
        freezes--;
        saved.push(d);
        run++;                                     /* the freeze carries the day */
      } else {
        run = 0;
      }
      best = Math.max(best, run);
    }
    best = Math.max(best, run);

    return { current: run, best, freezes, earned, saved, cap: FREEZE_CAP };
  }

  async function streak(){
    return (await computeStreak()).current;
  }
  async function freezes(){
    const s = await computeStreak();
    return { have: s.freezes, cap: s.cap, saved: s.saved };
  }

  /* A wider read than the streak alone — the week, the month, and the best run. */
  async function stats(){
    const [tasks, today] = await Promise.all([Data.tasks(), Data.currentDay()]);
    const byDay = {};
    tasks.forEach(t => {
      const d = byDay[t.day] = byDay[t.day] || { total:0, done:0 };
      d.total++;
      if(t.view === 'done') d.done++;
    });
    const perfect = d => byDay[d] && byDay[d].total && byDay[d].done >= byDay[d].total;

    /* this week, Sunday to Saturday, in program days */
    const wkNow = await Data.weekNumber(Date.now());
    const wkStart = await Data.weekStartOf(wkNow);
    const firstDayOfWeek = await Data.dateToDay(wkStart);
    let weekPerfect = 0, weekDays = 0;
    for(let i = 0; i < 7; i++){
      const d = firstDayOfWeek + i;
      if(d > today || d < 1) continue;
      weekDays++;
      if(perfect(d)) weekPerfect++;
    }

    /* this calendar month, by program day */
    const now = new Date();
    let monthPerfect = 0, monthDays = 0;
    for(let d = 1; d <= today; d++){
      const ts = await Data.dayToDate(d);
      const x = new Date(ts);
      if(x.getMonth() !== now.getMonth() || x.getFullYear() !== now.getFullYear()) continue;
      if(!byDay[d] || !byDay[d].total) continue;
      monthDays++;
      if(perfect(d)) monthPerfect++;
    }

    /* the longest run you have ever put together — freezes included, since a
       frozen day did hold the streak */
    const cs = await computeStreak();
    const best = cs.best;

    const totalDone = tasks.filter(t => t.view === 'done').length;

    return { week:weekPerfect, weekDays, month:monthPerfect, monthDays, best, totalDone, week_no:wkNow };
  }

  async function perfectToday(){
    const [tasks, day] = await Promise.all([Data.tasks(), Data.currentDay()]);
    const mine = tasks.filter(t => t.day === day && t.view !== 'skipped');
    if(!mine.length) return false;
    return mine.every(t => t.view === 'done');
  }

  const stamp = d => `${d.getFullYear()}-${U.pad(d.getMonth()+1)}-${U.pad(d.getDate())}`;
  async function alreadyCelebrated(){
    return (await Store.get('settings', 'celebrated')) === stamp(new Date());
  }
  async function markCelebrated(){ await Store.put('settings', stamp(new Date()), 'celebrated'); }

  /* ---- the card, drawn to a canvas so it can be saved or shared ---- */
  async function drawCard(){
    const [tasks, day, n] = await Promise.all([Data.tasks(), Data.currentDay(), streak()]);
    const done = tasks.filter(t => t.day === day && t.view === 'done');
    const shots = done.reduce((a,t) => a + (t.shots || []).length, 0);
    const angles = done.reduce((a,t) =>
      a + (t.shots || []).reduce((m,s) => m + (s.angles || []).filter(x => x.done).length, 0), 0);

    const W = 1080, H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');

    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1F1C17');
    grad.addColorStop(1, '#0E0C0A');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);

    g.fillStyle = '#FB6900';
    g.fillRect(0, 0, W, 12);

    const disp = '900 %dpx "Red Hat Display", system-ui, sans-serif';
    const body = '%dpx "DM Sans", system-ui, sans-serif';

    g.fillStyle = '#FB6900';
    g.font = disp.replace('%d', 30);
    g.fillText(new Date().toLocaleDateString(undefined,
      { weekday:'long', month:'long', day:'numeric' }).toUpperCase(), 80, 140);

    g.fillStyle = '#EDE5D2';
    g.font = disp.replace('%d', 104);
    g.fillText('Perfect day.', 80, 270);

    g.fillStyle = '#969185';
    g.font = body.replace('%d', 38);
    g.fillText('Every task. Zero skips.', 80, 330);

    g.strokeStyle = '#2F2C26'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(80, 390); g.lineTo(W - 80, 390); g.stroke();

    g.fillStyle = '#969185';
    g.font = disp.replace('%d', 26);
    g.fillText(`${done.length} TASK${done.length === 1 ? '' : 'S'} DONE`, 80, 450);

    let y = 520;
    done.slice(0, 6).forEach(t => {
      g.fillStyle = '#5BBE6A';
      g.fillRect(80, y - 26, 8, 36);
      g.fillStyle = '#EDE5D2';
      g.font = body.replace('%d', 38);
      const title = t.title.length > 34 ? t.title.slice(0, 33) + '…' : t.title;
      g.fillText(title, 112, y);
      y += 72;
    });
    if(done.length > 6){
      g.fillStyle = '#605F57';
      g.font = body.replace('%d', 32);
      g.fillText(`+ ${done.length - 6} more`, 112, y);
      y += 60;
    }

    g.strokeStyle = '#2F2C26';
    g.beginPath(); g.moveTo(80, H - 300); g.lineTo(W - 80, H - 300); g.stroke();

    g.fillStyle = '#FB6900';
    g.font = disp.replace('%d', 60);
    g.fillText(`${n}-day streak`, 80, H - 210);

    g.fillStyle = '#969185';
    g.font = body.replace('%d', 34);
    g.fillText(`Day ${day}${shots ? ` · ${shots} shots · ${angles} angles` : ''}`, 80, H - 150);

    g.fillStyle = '#605F57';
    g.font = disp.replace('%d', 24);
    g.fillText('CREATOR STUDIO', 80, H - 70);

    return c;
  }

  function canvasToBlob(c){
    return new Promise(res => c.toBlob(b => res(b), 'image/png', 0.95));
  }

  async function shareCard(){
    const c = await drawCard();
    const blob = await canvasToBlob(c);
    if(!blob) return U.toast('Could not build the card');

    /* the browser's own share sheet first, where it exists and takes files */
    const file = new File([blob], 'perfect-day.png', { type:'image/png' });
    if(!Saver.native() && navigator.canShare && navigator.canShare({ files:[file] })){
      try { await navigator.share({ files:[file], title:'Perfect day' }); return true; }
      catch(e){ if(e.name === 'AbortError') return false; }
    }
    await Saver.save(`perfect-day-${stamp(new Date())}.png`, blob, 'image/png', 'Perfect day');
    return true;
  }

  async function saveCard(){
    const c = await drawCard();
    const blob = await canvasToBlob(c);
    if(!blob) return U.toast('Could not build the card');
    await Saver.saveOnly(`perfect-day-${stamp(new Date())}.png`, blob, 'image/png');
  }

  /* ---- the flame: a full-screen beat between the last tick and the card ---- */
  function flame(n, extra){
    const host = document.getElementById('flameburst');
    if(!host) return Promise.resolve();
    const x = extra || {};

    host.innerHTML = `
      <div class="fb-glow"></div>
      <div class="fb-core">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2c1.3 3.6 5 4.9 5 9a5 5 0 0 1-10 0c0-1.8.9-3 1.8-4C10.1 8.4 12 6.6 12 2z"/>
          <path d="M12 22a3.4 3.4 0 0 0 3.4-3.4c0-1.9-1.7-2.6-3.4-5.1-1.7 2.5-3.4 3.2-3.4 5.1A3.4 3.4 0 0 0 12 22z" opacity=".55"/>
        </svg>
      </div>
      <p class="fb-n">${n}</p>
      <p class="fb-l">day streak</p>
      ${x.week !== undefined ? `<div class="fb-stats">
        <span class="fb-s"><b>${x.week}/${x.weekDays || 7}</b>this week</span>
        <span class="fb-s"><b>${x.month}/${x.monthDays || 0}</b>this month</span>
        <span class="fb-s"><b>${x.best}</b>best run</span>
      </div>` : ''}
      ${Array.from({ length:14 }, (_,i) => {
        const x = (Math.random() * 80 - 40).toFixed(1);
        const delay = (Math.random() * .35).toFixed(2);
        const dur = (1 + Math.random() * .6).toFixed(2);
        const size = (8 + Math.random() * 16).toFixed(0);
        return `<span class="fb-spark" style="--x:${x}vw;--d:${delay}s;--t:${dur}s;
          width:${size}px;height:${size}px;left:${45 + Math.random() * 10}%"></span>`;
      }).join('')}`;

    host.classList.add('on');
    return new Promise(res => {
      setTimeout(() => {
        host.classList.remove('on');
        setTimeout(() => { host.innerHTML = ''; res(); }, 320);
      }, 1650);
    });
  }

  /* ---- an award unlocking: one card, tinted by its tone ---- */
  function award(rec){
    const host = document.getElementById('awardpop');
    if(!host) return Promise.resolve();
    const tone = (global.Awards && Awards.TONE[rec.tone]) || { c:'#FB6900', label:'Unlocked' };

    host.innerHTML = `
      <div class="aw-card" style="--tone:${tone.c}">
        <div class="aw-ring"></div>
        <div class="aw-medal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="14" r="6.4"/>
            <path d="M12 11.4l1.1 2.2 2.4.35-1.75 1.7.41 2.4L12 16.92l-2.16 1.13.41-2.4L8.5 13.95l2.4-.35z" fill="currentColor" stroke="none"/>
            <path d="M8.2 8.2L6 2.6h12l-2.2 5.6"/>
          </svg>
        </div>
        <p class="aw-kind">${tone.label}</p>
        <h3 class="aw-title">${rec.title}</h3>
        <p class="aw-line">${rec.line}</p>
        <button class="aw-close" data-awclose>Nice</button>
      </div>`;
    host.classList.add('on');

    return new Promise(res => {
      const done = () => { host.classList.remove('on'); setTimeout(() => { host.innerHTML = ''; res(); }, 280); };
      host.onclick = e => { if(e.target.closest('[data-awclose]') || e.target === host) done(); };
      setTimeout(done, 6000);
    });
  }

  /* ---- a rating rule coming true: the same beat as an award, in its colour ---- */
  function boost(b){
    const host = document.getElementById('awardpop');
    if(!host) return Promise.resolve();

    host.innerHTML = `
      <div class="aw-card boost" style="--tone:${b.colour || '#FB6900'}">
        <div class="aw-ring"></div>
        <p class="bo-pts">+${b.points}</p>
        <p class="aw-kind">${b.attr}</p>
        <h3 class="aw-title">${b.rule}</h3>
        <p class="aw-line">${b.attr} is now ${b.score}</p>
        <button class="aw-close" data-awclose>Good</button>
      </div>`;
    host.classList.add('on');

    return new Promise(res => {
      const done = () => { host.classList.remove('on');
        setTimeout(() => { host.innerHTML = ''; res(); }, 280); };
      host.onclick = e => { if(e.target.closest('[data-awclose]') || e.target === host) done(); };
      setTimeout(done, 5200);
    });
  }

  /* ---- a new avatar: the artwork is the reward, so it gets the whole card ---- */
  async function avatarWon(av, level){
    const host = document.getElementById('awardpop');
    if(!host) return;
    let url = null;
    try { url = await Avatars.art(av.id); } catch(e){ url = null; }

    host.innerHTML = `
      <div class="aw-card avwin" style="--tone:#FB6900">
        <div class="aw-ring"></div>
        ${url ? `<div class="avw-art"><img src="${url}" alt=""></div>`
              : `<div class="avw-art empty"><span>${(av.name || 'A')[0]}</span></div>`}
        <p class="aw-kind">New avatar · level ${level}</p>
        <h3 class="aw-title">${av.name || 'Level ' + av.level}</h3>
        <p class="aw-line">Yours from here on.</p>
        <button class="aw-close" data-awclose>Nice</button>
      </div>`;
    host.classList.add('on');

    await new Promise(res => {
      const done = () => { host.classList.remove('on');
        setTimeout(() => { if(url) URL.revokeObjectURL(url); host.innerHTML = ''; res(); }, 300); };
      host.onclick = e => { if(e.target.closest('[data-awclose]') || e.target === host) done(); };
      setTimeout(done, 6000);
    });
  }

  /* Levelling up gets its own beat, after any awards. */
  function levelUp(s){
    const host = document.getElementById('levelup');
    if(!host) return Promise.resolve();
    host.style.setProperty('--rank-a', s.rank.a);
    host.style.setProperty('--rank-b', s.rank.b);
    host.innerHTML = `
      <p class="lu-k">Level up</p>
      <p class="lu-n">${s.level}</p>
      <span class="lu-r">${s.rank.n}</span>
      <button class="lu-c" data-luclose>Keep going</button>`;
    host.classList.add('on');
    return new Promise(res => {
      const done = () => { host.classList.remove('on'); setTimeout(() => { host.innerHTML = ''; res(); }, 300); };
      host.onclick = e => { if(e.target.closest('[data-luclose]') || e.target === host) done(); };
      setTimeout(done, 7000);
    });
  }

  async function checkLevel(){
    if(!global.Levels) return;
    try {
      const s = await Levels.check();
      if(!s) return;
      await chime();
      await levelUp(s);

      /* climbing past a rung on the ladder is its own moment */
      if(global.Avatars){
        try {
          const av = await Avatars.unlockedAt(s.level);
          if(av){ await chime(); await avatarWon(av, s.level); }
        } catch(e){ console.warn('Avatars unavailable', e); }
      }
    } catch(e){ console.warn('Levels unavailable', e); }
  }

  /* Check for new awards and show them one after another. */
  async function showAwards(){
    if(!global.Awards) return;
    try {
      const fresh = await Awards.check();
      for(const a of fresh){
        await chime();
        await award(a);
      }

      /* a rating rule that just came true gets the same moment */
      if(global.Rating){
        try {
          const boosts = await Rating.newlyMet();
          for(const b of boosts.slice(0, 3)){
            await chime();
            await boost(b);
          }
        } catch(e){ console.warn('Rating unavailable', e); }
      }

      await checkLevel();
      return fresh.length;
    } catch(e){ console.warn('Awards unavailable', e); return 0; }
  }

  global.Celebrate = { chime, flame, award, boost, avatarWon, showAwards, levelUp, checkLevel,
                       streak, stats, computeStreak, freezes, perfectToday, alreadyCelebrated, markCelebrated,
                       drawCard, shareCard, saveCard, soundOn, setSound };
})(window);
