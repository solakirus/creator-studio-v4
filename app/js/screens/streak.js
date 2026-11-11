/* The streak, given the room it deserves.

   Everything here is read from the same task data the rest of the app uses —
   the shields are just thresholds on the longest run you have put together. */
(function(){

  const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  /* Shields you are working toward. Drawn rather than illustrated, so they stay
     sharp and cost nothing to ship. */
  const TIERS = [
    { at:7,   n:'7-Day Streak',   emblem:'sword' },
    { at:14,  n:'14-Day Streak',  emblem:'wolf'  },
    { at:33,  n:'33-Day Streak',  emblem:'helm'  },
    { at:66,  n:'66-Day Streak',  emblem:'blades'},
    { at:100, n:'100-Day Streak', emblem:'crown' },
    { at:200, n:'200-Day Streak', emblem:'flame' },
    { at:365, n:'365-Day Streak', emblem:'star'  }
  ];

  const FLAME = 'M50 4c7 20 27 27 27 48a27 27 0 0 1-54 0c0-10 5-16 10-21 4 6 11 9 11 9 0-14-3-25 6-36z';

  /* --- the shield, built from parts so each tier differs without new files --- */
  function emblemPath(kind){
    switch(kind){
      case 'sword':  return '<path d="M50 26l4 4-16 26-6 2 2-6z" fill="currentColor"/><path d="M36 54l6 6" stroke="currentColor" stroke-width="3"/>';
      case 'wolf':   return '<path d="M38 34l6 10h12l6-10 4 16-10 16H44L34 50z" fill="currentColor"/><circle cx="44" cy="50" r="2.4" fill="#151515"/><circle cx="56" cy="50" r="2.4" fill="#151515"/>';
      case 'helm':   return '<path d="M36 36h28v18c0 10-6 16-14 20-8-4-14-10-14-20z" fill="currentColor"/><path d="M50 38v34" stroke="#151515" stroke-width="3"/>';
      case 'blades': return '<path d="M34 30l32 36M66 30L34 66" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>';
      case 'crown':  return '<path d="M32 58l4-22 10 12 4-16 4 16 10-12 4 22z" fill="currentColor"/><rect x="32" y="60" width="36" height="7" rx="2" fill="currentColor"/>';
      case 'flame':  return `<path d="${FLAME}" transform="translate(20 22) scale(.6)" fill="currentColor"/>`;
      default:       return '<path d="M50 30l6 14 15 1-11 10 3 15-13-8-13 8 3-15-11-10 15-1z" fill="currentColor"/>';
    }
  }

  function shield(tier, won){
    const body = won ? '#2A2520' : '#1C1A16';
    const edge = won ? '#A8752C' : '#2F2C26';
    const ink  = won ? '#E8B45C' : '#4A453D';
    return `
      <svg viewBox="0 0 100 116" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g-${tier.at}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${won ? '#3A332A' : '#232019'}"/>
            <stop offset="1" stop-color="${body}"/>
          </linearGradient>
        </defs>
        <path d="M50 4l40 12v40c0 26-18 44-40 54C28 100 10 82 10 56V16z"
              fill="url(#g-${tier.at})" stroke="${edge}" stroke-width="2.5"/>
        <path d="M50 11l33 10v35c0 22-15 37-33 46-18-9-33-24-33-46V21z"
              fill="none" stroke="${edge}" stroke-width="1" opacity=".5"/>
        <g color="${ink}">${emblemPath(tier.emblem)}</g>
        <path d="M22 88h56l-6 12H28z" fill="${won ? '#8A5E22' : '#242119'}"/>
        <text x="50" y="97" text-anchor="middle"
              font-family="'Red Hat Display',sans-serif" font-weight="900" font-size="10"
              fill="${won ? '#FFF1D6' : '#5A544A'}">${tier.at}-DAY</text>
      </svg>`;
  }

  async function mount(el){
    const [cs, stats, tasks, day] = await Promise.all([
      Celebrate.computeStreak(), Celebrate.stats(), Data.tasks(), Data.currentDay()
    ]);
    const streak = cs.current;
    const savedDays = new Set(cs.saved);
    const program = await Data.program();

    /* the last seven days, ending today, marked perfect or not */
    const byDay = {};
    tasks.forEach(t => {
      const d = byDay[t.day] = byDay[t.day] || { total:0, done:0 };
      d.total++;
      if(t.view === 'done') d.done++;
    });
    const perfect = d => byDay[d] && byDay[d].total && byDay[d].done >= byDay[d].total;

    const today = new Date(); today.setHours(0,0,0,0);
    const week = [];
    for(let i = 6; i >= 0; i--){
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dNum = day - i;
      week.push({
        date, dow: date.getDay(), dayNum: dNum,
        on: dNum >= 1 && perfect(dNum),
        frozen: savedDays.has(dNum),
        isToday: i === 0
      });
    }

    /* the next shield to chase, and everything already won */
    const best = stats.best;
    const next = TIERS.find(t => best < t.at);

    const heroArt = await SectionArt.get('streak');

    el.innerHTML = `
      <div class="stk">
        <div class="stk-hero${heroArt ? ' hasart' : ''}">
          ${heroArt ? `<img class="stk-art" src="${heroArt}" alt="">` : ''}
          <button class="sart-edit" data-sartedit="streak" aria-label="Change the artwork"
            style="right:auto;left:64px;top:calc(var(--sat) + 17px)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
              stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14.5 6.5l3 3"/></svg>
          </button>
          <span class="flamebg">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <path d="${FLAME}" fill="currentColor"/>
            </svg>
          </span>
          <div class="stk-top">
            <button class="stk-x" data-back aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"
                stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
            <button class="stk-freeze" data-freeze>
              Streak Freeze
              <span class="drops">
                ${Array.from({ length: cs.cap }, (_, i) => `<span class="drop${
                  i < cs.freezes ? '' : ' spent'}">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.5c3.4 4.6 6.5 7.7 6.5 11.4a6.5 6.5 0 0 1-13 0c0-3.7 3.1-6.8 6.5-11.4z"/>
                  </svg></span>`).join('')}
              </span>
            </button>
          </div>
          <p class="stk-num"><b>${streak}</b><span>day streak</span></p>
        </div>

        <div class="stk-week">
          <div class="h"><b>This week</b>
            <span>${week.filter(w => w.on).length} of 7</span></div>
          <div class="stk-days">
            ${week.map(w => `<span class="d${w.isToday ? ' on' : ''}">${DAYS[w.dow]}</span>`).join('')}
            ${week.map(w => `<span class="f">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="${FLAME}" fill="${w.frozen ? '#3E7FA8' : w.on ? '#FB6900' : '#332F29'}"
                  ${w.isToday && !w.on ? 'stroke="#FB6900" stroke-width="4"' : ''}/>
              </svg>
              ${(w.on || w.frozen) ? `<span class="tick">
                ${w.frozen
                  ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"
                       stroke-linecap="round"><path d="M12 4v16M4.5 8l15 8M19.5 8l-15 8"/></svg>`
                  : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4"
                       stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`}
              </span>` : ''}
            </span>`).join('')}
          </div>
        </div>

        <p class="stk-rule">To hold a streak, finish <b>every task</b> you set for the day.
          A day with nothing on it neither earns nor breaks one.${
          cs.saved.length ? `<br><span style="color:#5FA8D3">A freeze has covered ${
            cs.saved.length} missed day${cs.saved.length===1?'':'s'}.</span>` : ''}</p>

        <div class="stk-grid">
          ${TIERS.map(t => {
            const won = best >= t.at;
            const chasing = next && next.at === t.at;
            return `<div class="stk-badge${won ? '' : ' locked'}">
              <span class="art">${shield(t, won)}</span>
              <p class="nm">${t.n}</p>
              ${won ? `<p class="won">Earned</p>`
                : chasing ? `<div class="pg">
                    <p class="n">${streak}/${t.at}</p>
                    <div class="bar"><i style="width:${Math.min(100, Math.round(streak / t.at * 100))}%"></i></div>
                  </div>` : ''}
            </div>`;
          }).join('')}
        </div>

        <p class="note" style="padding:8px var(--gutter) 30px">Best run so far: ${best} day${best===1?'':'s'}.
          Shields are kept on your longest run, so a broken streak never takes one away.</p>
      </div>`;

    el.addEventListener('click', async e => {
      if(await SectionArt.handle(e, () => mount(el))) return;
      if(e.target.closest('[data-back]')) return Screens.pop();

      if(e.target.closest('[data-freeze]')){
        App.sheet(`
          <h2>Streak Freeze</h2>
          <p style="margin:0 0 16px;color:var(--muted);font-size:15px;line-height:1.65">
            You have <b style="color:var(--cream)">${cs.freezes}</b> of ${cs.cap} banked.</p>
          <div class="group" style="margin:0 0 14px">
            <div class="row" style="cursor:default"><span class="lbl">Earning them
              <small>One for every ${7} days you hold the streak</small></span></div>
            <div class="row" style="cursor:default"><span class="lbl">Spending them
              <small>Used on their own the moment you miss a day</small></span></div>
            <div class="row" style="cursor:default"><span class="lbl">The cap
              <small>Two at a time, so they cannot be hoarded</small></span></div>
          </div>
          <p class="note" style="text-align:left;margin:0">A frozen day shows blue in the week strip.
            It holds the streak but does not count as a perfect day, so it earns you nothing else.</p>
          <div class="sheetcta"><button class="btn-primary" data-cancel>Got it</button></div>`,
        sheetEl => {
          sheetEl.addEventListener('click', ev => {
            if(ev.target.closest('[data-cancel]')) App.closeSheet();
          });
        });
      }
    });
  }

  Screens.register('streak', mount);
})();
