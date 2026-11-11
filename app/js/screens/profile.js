/* Profile — who you are in the program, and what you have done lately. */
(function(){
  const { ICON } = U;

  /* tiers earned by perfect days, since that is the thing that costs something */
  const TIERS = [
    { at:0,   n:'Bronze IV',  a:'#8A6A2F', b:'#5C4519' },
    { at:5,   n:'Bronze I',   a:'#A6803A', b:'#6B5220' },
    { at:15,  n:'Silver III', a:'#9AA3AD', b:'#5F6771' },
    { at:30,  n:'Silver I',   a:'#B4BDC7', b:'#6F7883' },
    { at:60,  n:'Gold III',   a:'#D9A93F', b:'#8A6A1E' },
    { at:100, n:'Gold I',     a:'#F0C24A', b:'#9C7A22' },
    { at:200, n:'Platinum',   a:'#7FD8C9', b:'#2F7F72' },
    { at:365, n:'Diamond',    a:'#8CC6F0', b:'#2E6C99' }
  ];
  const tierFor = n => TIERS.slice().reverse().find(t => n >= t.at) || TIERS[0];

  async function mount(el){
    let photo = null, art = null, nextArt = null, avCur = null, avNext = null,
        name = '', goal = null, program = null;

    async function load(){
      try {
        const blob = await Store.get('profile-photo', 'me');
        if(photo) URL.revokeObjectURL(photo);
        photo = blob ? URL.createObjectURL(blob) : null;
      } catch(e){ photo = null; }
      /* whichever avatar the current level has earned */
      try {
        const lvl = (await Levels.state()).level;
        avCur = await Avatars.current(lvl);
        avNext = await Avatars.next(lvl);
        if(art) URL.revokeObjectURL(art);
        if(nextArt) URL.revokeObjectURL(nextArt);
        art = avCur ? await Avatars.art(avCur.id) : null;
        nextArt = avNext ? await Avatars.art(avNext.id) : null;
      } catch(e){ art = null; nextArt = null; avCur = null; avNext = null; }
      name = (await Store.get('settings', 'name')) || '';
      program = await Data.program();
      const key = new Date();
      goal = await Store.get('settings', `goal:${key.getFullYear()}-${U.pad(key.getMonth()+1)}`);
    }

    async function render(){
      const acDone = await Academy.totalDone();
      const [day, week, streak, stats, tasks, lv] = await Promise.all([
        Data.currentDay(), Data.currentWeek(), Celebrate.streak(),
        Celebrate.stats(), Data.tasks(), Levels.state()
      ]);
      const R = 68, C = 2 * Math.PI * R;
      /* before Day 1 the badge says the phase, not a day number below 1 */
      const prePhase = await Data.phaseOf(day);
      const awards = await Awards.unlocked();
      const tier = tierFor(stats.best);
      const done = tasks.filter(t => t.view === 'done');
      const todayCount = tasks.filter(t => t.day === day && t.view === 'done').length;
      const since = new Date(program.start);

      const recent = done.slice().sort((a,b) => b.day - a.day).slice(0, 5);

      el.innerHTML = Screens.bar({ kicker:'Creator studio', title:'Profile',
        actions:`<button class="btn-sm" data-a="settings" aria-label="Settings">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><circle cx="12" cy="12" r="3.4"/><path d="M19.1 14.4a1.6 1.6 0 0 0 .32 1.77l.06.06a1.9 1.9 0 1 1-2.69 2.69l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V20a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1.04-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a1.9 1.9 0 1 1-2.69-2.69l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H4a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.46-1.04 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.9 1.9 0 1 1 2.69-2.69l.06.06a1.6 1.6 0 0 0 1.77.32h.08a1.6 1.6 0 0 0 .97-1.47V4a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 .97 1.47h.08a1.6 1.6 0 0 0 1.77-.32l.06-.06a1.9 1.9 0 1 1 2.69 2.69l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97H20a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.47.97z"/></svg>
                 </button>
                 <button class="btn-sm" data-a="share">Share</button>` }) + `
      <div class="view">
        <div class="pf-card">
          <div class="pf-av" data-a="photo" style="${photo ? `background-image:url(${photo})` : ''}">
            ${photo ? '' : `<span class="ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg></span>`}
            <span class="pen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14.5 6.5l3 3"/></svg></span>
          </div>

          <h2 class="pf-name" data-a="name">${name || 'Set your name'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14.5 6.5l3 3"/></svg>
          </h2>

          <div class="pf-badges">
            <span class="pf-tier" style="background:linear-gradient(135deg,${tier.a},${tier.b})">${tier.n}</span>
            <span class="pf-day">${prePhase.pre
              ? `${prePhase.name} · ${prePhase.toGo}d to Day 1`
              : `Day ${day} · wk ${week}`}</span>
          </div>

          <p class="pf-goal-k">Goal of this month</p>
          <button class="pf-goal${goal ? '' : ' empty'}" data-a="goal">
            ${goal || 'Tap to set your monthly goal'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14.5 6.5l3 3"/></svg>
          </button>
        </div>

        <div class="av-card" style="--rank-a:${lv.rank.a};--rank-b:${lv.rank.b}">
          <!-- Earned is decided by the ladder, not by whether a picture loaded.
               An avatar you have earned but not given artwork to still reads as
               earned; it just asks for a picture. -->
          <div class="av-art${art ? '' : ' locked'}" style="${art ? `background-image:url(${art})` : ''}">
            <span class="av-lvl">LVL ${lv.level}</span>
            ${art ? '' : `<span class="av-locked">
              ${avCur
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                     stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.8"/><path d="M3 16l5-4 4 3 3-2 6 5"/></svg>
                   <b>${avCur.name || 'Level ' + avCur.level} — earned</b>
                   <span>It has no artwork yet. Add one in Avatars and it shows here.</span>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                     stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/></svg>
                   <b>${avNext ? 'Nothing earned yet' : 'No avatars set up'}</b>
                   <span>${avNext
                     ? `Your first one arrives at level ${avNext.level}.`
                     : 'Build the ladder in Settings, then climb it.'}</span>`}
            </span>`}
            <div class="av-foot">
              <p class="av-rank">${avCur ? avCur.name || lv.rank.n : lv.rank.n}</p>
              <p class="av-name">${name || 'Unnamed'}</p>
              <div class="av-bar"><i style="width:${lv.pct}%"></i></div>
              <div class="av-pts">
                <span><b>${lv.into}</b> / ${lv.span} xp</span>
                <span><b>${lv.toNext}</b> to level ${lv.level + 1}</span>
              </div>
            </div>
          </div>
          ${avNext && avCur ? `<div class="av-next">
            <span class="th" style="${nextArt ? `background-image:url(${nextArt})` : ''}"></span>
            <span>Next up<br><b>${avNext.name || 'Level ' + avNext.level}</b> at level ${avNext.level}</span>
          </div>` : ''}
        </div>

        <div class="pf-grid">
          <div class="pf-cell"><p>Started</p><b style="font-size:21px">${since.toLocaleDateString(undefined,{ month:'short', day:'numeric', year:'numeric' })}</b></div>
          <div class="pf-cell"><p>Current streak</p><b>${streak}
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1.3 3.6 5 4.9 5 9a5 5 0 0 1-10 0c0-1.8.9-3 1.8-4C10.1 8.4 12 6.6 12 2z"/></svg></b></div>
          <div class="pf-cell"><p>Tasks today</p><b>${todayCount}</b></div>
          <div class="pf-cell"><p>Best run</p><b>${stats.best}</b></div>
          <div class="pf-cell"><p>Done all time</p><b>${stats.totalDone}</b></div>
          <div class="pf-cell"><p>Achievements</p><b>${awards.length}</b></div>
        </div>

        <details class="cp-sec">
          <summary>How the level was earned<span class="n">${lv.points} pts</span>
            <svg class="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></summary>
          <div class="cp-body">
            ${[['tasks','Tasks done','task'], ['perfect','Perfect days','perfectDay'],
               ['sessions','Workouts','session'], ['runs','Runs','run'],
               ['posted','Published','clipPosted'], ['awards','Achievements','award'],
               ['lessons','Lessons read','lesson'],
               /* the vlog challenge */
               ['habitDays','Challenge habit days','habitDay'], ['weeklyWins','Weekly wins','weeklyWin'],
               ['monthlyWins','Monthly wins','monthlyWin']]
              .filter(([c]) => lv.counts[c] !== undefined)
              .map(([c, label, k]) => `<div class="lv-row">
                <span class="n">${lv.counts[c]}</span>
                <span class="l">${label} <span style="color:var(--dim)">× ${Levels.WEIGHTS[k]}</span></span>
                <span class="p">${lv.parts[k]}</span>
              </div>`).join('')}
            <div class="lv-break">
              <div class="lv-row"><span class="n"></span>
                <span class="l" style="color:var(--cream)">Total</span>
                <span class="p" style="color:var(--orange)">${lv.points}</span></div>
            </div>
            <p class="note" style="text-align:left;margin:12px 0 0">Consistency is worth more than volume —
              a perfect day scores more than the tasks inside it.</p>
          </div>
        </details>

        <div class="sec"><h2>Recent activity</h2><div class="rule"></div>
          <span class="alt">last ${recent.length}</span></div>
        ${recent.length ? `<div class="block" style="padding:2px 14px">
          ${recent.map(t => `<div class="pf-act">
            <span class="day"><small>Day</small><b>${t.day}</b></span>
            <span class="nm">${t.title}</span>
            <span class="when">${t.day === day ? 'Today' : t.day === day - 1 ? 'Yesterday' : `${day - t.day} days ago`}</span>
          </div>`).join('')}
        </div>` : `<div class="empty"><b>Nothing done yet</b>Tick something off and it shows up here.</div>`}

        <div class="group" style="margin:14px 0 0">
          <button class="row" data-a="academy">
            <span class="lbl">Academy<small>${acDone
              ? `${acDone} of ${Academy.totalLessons()} lessons read`
              : `${Academy.COURSES.length} courses on habits, shipping and focus`}</small></span>${ICON.chevR}</button>
          <button class="row" data-a="streak">
            <span class="lbl">Streak<small>${streak} day${streak===1?'':'s'} · best ${stats.best}</small></span>${ICON.chevR}</button>
          <button class="row" data-a="avatars">
            <span class="lbl">Avatars<small>${avCur ? `${avCur.name || 'Level ' + avCur.level} earned` : 'Set up the ladder'}</small></span>${ICON.chevR}</button>
          <button class="row" data-a="rating">
            <span class="lbl">Your rating<small>What your work adds up to</small></span>${ICON.chevR}</button>
          <button class="row" data-a="awards">
            <span class="lbl">Achievements<small>${awards.length} unlocked</small></span>${ICON.chevR}</button>
          <button class="row" data-a="capture">
            <span class="lbl">Quick capture<small>Catch an idea and file it later</small></span>${ICON.chevR}</button>
          <button class="row" data-a="challenges">
            <span class="lbl">Challenges<small>The arc, the month, the milestones</small></span>${ICON.chevR}</button>
          <button class="row" data-a="settings">
            <span class="lbl">Settings<small>Everything else</small></span>${ICON.chevR}</button>
        </div>
      </div>`;
    }

    el.addEventListener('click', async e => {
      if(await SectionArt.handle(e, async () => { await load(); render(); })) return;
      const a = e.target.closest('[data-a]');
      if(!a) return;

      if(a.dataset.a === 'photo'){
        App.pickImage(async file => {
          await Store.put('profile-photo', file, 'me');
          await load(); render();
        });
        return;
      }
      if(a.dataset.a === 'name'){
        App.sheet(`<h2>Your name</h2>
          <div class="field"><label for="pn">Name</label>
            <input id="pn" type="text" value="${name.replace(/"/g,'&quot;')}" placeholder="Khaleem Catten"></div>
          <div class="sheetcta"><button class="btn-primary" data-save>Save</button>
            <button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-save]')) return;
            name = sheetEl.querySelector('#pn').value.trim();
            await Store.put('settings', name, 'name');
            App.closeSheet(); render();
          });
          setTimeout(() => { const f = sheetEl.querySelector('#pn'); if(f) f.focus(); }, 180);
        });
        return;
      }
      if(a.dataset.a === 'goal'){
        const d = new Date();
        const key = `goal:${d.getFullYear()}-${U.pad(d.getMonth()+1)}`;
        App.sheet(`<h2>${d.toLocaleDateString(undefined,{ month:'long' })}'s goal</h2>
          <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.55">
            One line. The thing this month is for.</p>
          <div class="field"><label for="pg">Goal</label>
            <input id="pg" type="text" value="${(goal||'').replace(/"/g,'&quot;')}" placeholder="Ship four episodes, no misses"></div>
          <div class="sheetcta"><button class="btn-primary" data-save>Save</button>
            <button class="btn-ghost" data-clear>Clear</button></div>`, sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-clear]')){
              goal = null; await Store.put('settings', '', key);
              App.closeSheet(); return render();
            }
            if(!ev.target.closest('[data-save]')) return;
            goal = sheetEl.querySelector('#pg').value.trim();
            await Store.put('settings', goal, key);
            App.closeSheet(); render();
          });
          setTimeout(() => { const f = sheetEl.querySelector('#pg'); if(f) f.focus(); }, 180);
        });
        return;
      }
      if(a.dataset.a === 'academy') return Screens.push('academy', { onChange:() => render() });
      if(a.dataset.a === 'streak') return Screens.push('streak', { onChange:() => render() });
      if(a.dataset.a === 'avatars') return Screens.push('avatars', { onChange: async () => { await load(); render(); } });
      if(a.dataset.a === 'awards') return Screens.push('awards', { onChange:() => render() });
      if(a.dataset.a === 'rating') return Screens.push('rating', { onChange:() => render() });
      if(a.dataset.a === 'capture') return Screens.push('quick-capture', { onChange:() => render() });
      if(a.dataset.a === 'challenges') return Screens.push('challenges', { onChange:() => render() });
      if(a.dataset.a === 'settings') return Screens.push('settings', {});
      if(a.dataset.a === 'share') return Celebrate.shareCard();
    });

    await load();
    render();
  }

  Screens.register('profile', mount);
})();
