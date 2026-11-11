/* Scoreboard — the vlog challenge's numbers: habit days, weekly and monthly wins,
   and the XP they earn.

   XP is never typed in. It is worked out from what the episodes and months
   record, and it feeds the one level the rest of the app already has — the
   weights below are added to Levels' own, so a habit day counts toward the same
   rank as a workout or a published clip.

   Episodes carry `habitDays: { vlog, training, german }`, each 0–7. A month can
   switch habits off with `habits: [...]`; missing means all three. */
(function(global){

  const HABITS = [
    { k:'vlog',     label:'Vlog' },
    { k:'training', label:'Training' },
    { k:'german',   label:'German' }
  ];
  const ALL_HABITS = HABITS.map(h => h.k);
  const habitLabel = k => (HABITS.find(h => h.k === k) || { label:k }).label;

  /* the placeholders until you decide — editable in Settings */
  const DEFAULTS = { habitDay:10, weeklyWin:50, monthlyWin:200 };
  const KEY = 'scoreboard-xp';
  const TKEY = 'level-thresholds';

  async function weights(){
    let s = null;
    try { s = await Store.get('settings', KEY); } catch(e){}
    const out = { ...DEFAULTS };
    Object.keys(DEFAULTS).forEach(k => {
      const n = Number(s && s[k]);
      if(s && s[k] !== undefined && s[k] !== '' && isFinite(n) && n >= 0) out[k] = n;
    });
    return out;
  }
  async function saveWeights(w){
    const clean = {};
    Object.keys(DEFAULTS).forEach(k => {
      const n = Number(w[k]);
      clean[k] = isFinite(n) && n >= 0 ? n : DEFAULTS[k];
    });
    await Store.put('settings', clean, KEY);
    return clean;
  }

  /* Your own level thresholds: the total XP each level starts at, from level 2
     up. Empty means the built-in curve, which is how levels have always worked. */
  async function thresholds(){
    let t = null;
    try { t = await Store.get('settings', TKEY); } catch(e){}
    return Array.isArray(t) ? t.map(Number).filter(n => isFinite(n) && n > 0) : [];
  }
  async function saveThresholds(list){
    const clean = [...new Set((list || []).map(Number).filter(n => isFinite(n) && n > 0))].sort((a,b) => a - b);
    await Store.put('settings', clean, TKEY);
    return clean;
  }

  const clampDay = n => Math.max(0, Math.min(7, Math.round(Number(n) || 0)));
  const activeHabits = m => (m && Array.isArray(m.habits)) ? m.habits.filter(h => ALL_HABITS.includes(h)) : ALL_HABITS.slice();

  /* the habit days an episode actually counts: only the habits its month has on */
  function habitDaysOf(v, m){
    const hd = (v && v.habitDays) || {};
    const out = {};
    activeHabits(m).forEach(h => { out[h] = clampDay(hd[h]); });
    return out;
  }
  const sum = o => Object.values(o).reduce((a,b) => a + b, 0);

  async function everything(){
    let eps = [], months = [];
    try { eps = (await Store.all('vlogs')).values; } catch(e){}
    try { months = (await Store.all('months')).values; } catch(e){}
    return { eps, months, byId: Object.fromEntries(months.map(m => [m.id, m])) };
  }

  /* What Levels adds to the total. */
  async function counts(){
    const { eps, months, byId } = await everything();
    const habitDays = eps.reduce((n, v) => n + sum(habitDaysOf(v, byId[v.monthId])), 0);
    return {
      habitDays,
      weeklyWins: eps.filter(v => v.result === 'W').length,
      monthlyWins: months.filter(m => m.result === 'W').length
    };
  }

  /* The season so far: every episode with a result. */
  async function season(){
    const { eps } = await everything();
    return { w: eps.filter(v => v.result === 'W').length, l: eps.filter(v => v.result === 'L').length };
  }

  /* One month's totals: habit days per habit, the weekly record, and the XP it earned. */
  async function monthTotals(m){
    const w = await weights();
    const eps = (await everything()).eps.filter(v => v.monthId === m.id);
    const habits = activeHabits(m);
    const per = Object.fromEntries(habits.map(h => [h, 0]));
    eps.forEach(v => { const d = habitDaysOf(v, m); habits.forEach(h => { per[h] += d[h]; }); });
    let slots = [];
    try { slots = await Months.weeks(m); } catch(e){}
    const days = sum(per);
    const wins = eps.filter(v => v.result === 'W').length;
    const losses = eps.filter(v => v.result === 'L').length;
    const xp = days * w.habitDay + wins * w.weeklyWin + (m.result === 'W' ? w.monthlyWin : 0);
    return { habits, per, days, possible: slots.length * 7, wins, losses, xp, weeks: slots.length, eps };
  }

  /* ---------- Settings: the XP values and the level list ---------- */
  Screens.register('scoreboard-settings', async (el, params) => {
    async function render(){
      const w = await weights();
      const t = await thresholds();
      el.innerHTML = Screens.bar({ kicker:'Settings', title:'Challenge XP' }) + `
      <div class="view">
        <p class="note" style="text-align:left;margin:0 0 16px">What the vlog challenge earns. It adds to
          the same level as everything else — tasks, workouts, published clips. Change these any time;
          XP is always worked out again from what's recorded, never stored.</p>
        <div class="field"><label for="sb-hd">XP per habit day</label>
          <input id="sb-hd" type="number" min="0" inputmode="numeric" value="${w.habitDay}"></div>
        <div class="field"><label for="sb-ww">XP per weekly win</label>
          <input id="sb-ww" type="number" min="0" inputmode="numeric" value="${w.weeklyWin}"></div>
        <div class="field"><label for="sb-mw">XP per monthly win</label>
          <input id="sb-mw" type="number" min="0" inputmode="numeric" value="${w.monthlyWin}"></div>
        <div class="field"><label for="sb-th">Level thresholds — the total XP each level starts at, from level 2</label>
          <textarea id="sb-th" rows="5" placeholder="Leave empty to keep the built-in curve&#10;100&#10;350&#10;700">${t.join('\n')}</textarea></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-reset>Back to defaults</button>
        </div>
      </div>`;
    }
    el.addEventListener('click', async e => {
      if(e.target.closest('[data-reset]')){
        if(!confirm('Put the XP values back to 10 / 50 / 200 and use the built-in level curve?')) return;
        await saveWeights(DEFAULTS); await saveThresholds([]);
        U.toast('Back to defaults'); await render();
        if(global.Celebrate && Celebrate.checkLevel) Celebrate.checkLevel();
        return;
      }
      if(!e.target.closest('[data-save]')) return;
      await saveWeights({ habitDay: el.querySelector('#sb-hd').value,
                          weeklyWin: el.querySelector('#sb-ww').value,
                          monthlyWin: el.querySelector('#sb-mw').value });
      await saveThresholds(el.querySelector('#sb-th').value.split(/[\s,]+/));
      U.toast('Saved'); await render();
      params && params.onChange && params.onChange();
      if(global.Celebrate && Celebrate.checkLevel) Celebrate.checkLevel();
    });
    await render();
  });

  /* ---------- the stat card: one clean screen to put in the edit ---------- */
  const SC_CSS = `
  .sc{display:flex;flex-direction:column;gap:14px;padding:22px 20px;border-radius:14px;
    background:linear-gradient(160deg,#1E1B17 0%,#121110 100%);border:1px solid #2F2B25;color:#F2EADB}
  .sc .k{font-size:11.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#9C9486}
  .sc .ttl{font-family:var(--display),sans-serif;font-weight:900;font-size:26px;line-height:1.1;margin:4px 0 0}
  .sc .row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .sc .cell{padding:12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid #2F2B25}
  .sc .cell b{display:block;font-family:var(--display),sans-serif;font-weight:900;font-size:28px;line-height:1.05}
  .sc .cell small{display:block;margin-top:4px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9C9486}
  .sc .hab{display:flex;align-items:center;gap:10px;font-size:14px}
  .sc .hab span:first-child{flex:0 0 74px;color:#C9C0B0}
  .sc .dots{display:flex;gap:5px;flex:1}
  .sc .dots i{flex:1;height:10px;border-radius:3px;background:#2F2B25}
  .sc .dots i.on{background:#FB6900}
  .sc .hab b{flex:0 0 30px;text-align:right}
  .sc .bar{height:8px;border-radius:4px;background:#2F2B25;overflow:hidden}
  .sc .bar i{display:block;height:100%;background:#5BBE6A}
  .sc .lvl{display:flex;justify-content:space-between;align-items:baseline;font-size:14px;color:#C9C0B0}
  .sc .lvl b{font-family:var(--display),sans-serif;font-weight:900;font-size:22px;color:#F2EADB}
  `;
  Screens.register('statcard', async (el, params) => {
    if(!document.getElementById('sc-css')){
      const st = document.createElement('style'); st.id = 'sc-css'; st.textContent = SC_CSS;
      document.head.appendChild(st);
    }
    const esc = t => String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const v = await Store.get('vlogs', params && params.id);
    if(!v){ el.innerHTML = Screens.bar({ kicker:'Stat card', title:'Not found' }); return; }
    const m = v.monthId ? await Months.get(v.monthId) : null;
    const days = habitDaysOf(v, m);
    const sn = await season();
    let lv = null;
    try { lv = await Levels.state(); } catch(e){}
    const mt = m ? await monthTotals(m) : null;
    const decided = mt ? mt.wins + mt.losses : 0;

    el.innerHTML = Screens.bar({ kicker:'Stat card', title:esc(v.title) || 'Episode' }) + `
    <div class="view">
      <div class="sc">
        <div>
          <div class="k">${v.week ? `Week ${v.week}` : 'This week'}${v.skill ? ` · ${esc(v.skill)}` : ''}</div>
          <p class="ttl">${esc(v.weeklyChallenge) || esc(v.title) || 'This week'}</p>
        </div>
        <div>
          <div class="k" style="margin-bottom:8px">Habit days this week</div>
          ${Object.keys(days).map(h => `<div class="hab" style="margin-bottom:7px">
            <span>${habitLabel(h)}</span>
            <span class="dots">${[1,2,3,4,5,6,7].map(n => `<i class="${n <= days[h] ? 'on' : ''}"></i>`).join('')}</span>
            <b>${days[h]}/7</b></div>`).join('')}
        </div>
        <div class="row">
          <div class="cell"><b>${sn.w}–${sn.l}</b><small>Season W–L</small></div>
          <div class="cell"><b>${lv ? lv.points.toLocaleString() : '—'}</b><small>Total XP</small></div>
          <div class="cell"><b>${lv ? lv.level : '—'}</b><small>${lv ? esc(lv.rank.n) : 'Level'}</small></div>
        </div>
        ${lv ? `<div><div class="lvl"><span>Level ${lv.level} → ${lv.level + 1}</span><span>${lv.toNext.toLocaleString()} XP to go</span></div>
          <div class="bar" style="margin-top:6px"><i style="width:${lv.pct}%;background:#FB6900"></i></div></div>` : ''}
        ${m ? `<div>
          <div class="k" style="margin-bottom:6px">${esc(m.name)} challenge</div>
          <p style="margin:0 0 8px;font-size:16px;line-height:1.4">${esc(m.challenge) || '—'}</p>
          <div class="lvl"><span>${mt.wins} won · ${mt.losses} lost of ${mt.weeks} weeks</span>
            <span>${m.result === 'W' ? '<b style="color:#5BBE6A;font-size:16px">WON</b>'
              : m.result === 'L' ? '<b style="color:#E2564A;font-size:16px">LOST</b>' : 'in progress'}</span></div>
          <div class="bar" style="margin-top:6px"><i style="width:${mt.weeks ? Math.round(decided / mt.weeks * 100) : 0}%"></i></div>
        </div>` : ''}
      </div>
      <p class="note" style="margin-top:12px">Screenshot this for the stat card in the edit.</p>
    </div>`;
  });

  global.Scoreboard = { HABITS, ALL_HABITS, habitLabel, DEFAULTS, weights, saveWeights, thresholds,
                        saveThresholds, activeHabits, habitDaysOf, clampDay, counts, season, monthTotals };
})(window);
