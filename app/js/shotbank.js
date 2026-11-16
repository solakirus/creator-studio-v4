/* My shots — your own shots, filed by place, dropped into any video.

   The Library holds other people's shots that inspire you. This holds YOURS:
   the gym shots on the phone, the overhead in the kitchen, the daily vlog
   shots — set up once, used again and again.

   A shot here: { id, name, place, tags:[], dev, item (a Library frame), note
   (how you set it up), anytime (can be grabbed whenever, no date), lastShot }
   in the synced 'my-shots' store. Places are the shot list's places
   (Shots.locations — Gym, House, Car…); tags cut across them (Overhead, Daily
   vlog…); dev is what it's shot on (Devices).

   Linked: a shot assigned to a video keeps `bank: <id>`. Changing the shot
   here (its name, frame, place, camera, setup) changes every copy; ticking
   it in a video stays that video's — and the bank shows "in 3 videos · last
   shot Tue".

   Templates (shot templates — Content → Templates) get a place too, and come
   along wherever My shots does: a whole "Gym 1" drops into a sequence, a
   day, or a clip's beat in one go.

     ShotBank.pick({ title }) → { name, place, shots:[storyboard shots] } | null
     ShotBank.assign({ name, place, shots }) → where it went | null  (the sheet)
     ShotBank.week({ scope }) → the rows for Shots → This week
     ShotBank.tick(row, on) · ShotBank.setPlace(row, place) */
(function(global){
  const STORE = 'my-shots';
  const TAG_KEY = 'shot-tags';
  const DEFAULT_TAGS = ['Overhead', 'Daily vlog', 'B-roll', 'Detail', 'Talking', 'POV', 'Transition'];
  const esc = s => global.U && U.esc ? U.esc(s) : String(s == null ? '' : s);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const rid = p => (p || 'ms') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------------------------------------------------------------- the bank */
  async function all(){
    let v = [];
    try { v = (await Store.all(STORE)).values || []; } catch(e){ v = []; }
    return v.filter(Boolean).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }
  const get = id => Store.get(STORE, id).catch(() => null);
  async function save(b, opts){
    const old = b.id ? await get(b.id) : null;
    const rec = { id:b.id || rid(), name:String(b.name || '').trim() || 'Shot', place:b.place || '', tags:[...new Set(b.tags || [])],
      dev:b.dev || '', item:b.item || '', note:b.note || '', anytime:!!b.anytime, lastShot:+b.lastShot || 0,
      createdAt:(old && old.createdAt) || b.createdAt || Date.now(), updatedAt:Date.now() };
    if(b.role) rec.role = b.role;
    await Store.put(STORE, rec);
    if(!(opts && opts.quiet)) await propagate(rec);
    return rec;
  }
  const remove = id => Store.del(STORE, id);

  async function places(){
    const own = global.Shots ? await Shots.locations() : [];
    const more = [...(await all()).map(b => b.place), ...(await templates()).map(t => t.place)].filter(Boolean);
    const out = [...own];
    more.forEach(p => { if(!out.some(x => x.toLowerCase() === p.toLowerCase())) out.push(p); });
    return out;
  }
  const addPlace = name => global.Shots ? Shots.addLocation(name) : Promise.resolve(String(name || '').trim() || null);
  async function tags(){
    let v = null;
    try { v = await Store.get('settings', TAG_KEY); } catch(e){}
    return Array.isArray(v) && v.length ? v : DEFAULT_TAGS.slice();
  }
  async function addTag(t){
    const n = String(t || '').trim();
    if(!n) return null;
    const list = await tags();
    if(!list.some(x => x.toLowerCase() === n.toLowerCase())) list.push(n);
    await Store.put('settings', list, TAG_KEY);
    return n;
  }
  async function templates(){
    if(!global.ShotTemplates) return [];
    try { return (await ShotTemplates.all()).filter(t => (t.shots || []).length); } catch(e){ return []; }
  }

  /* a bank shot / a template's shots, as storyboard shots */
  function storyShot(b){
    const s = { id:rid('s'), text:b.name || 'Shot', note:b.note || '', framing:'', movement:'', role:b.role || '', item:b.item || '', done:false, bank:b.id };
    if(b.place) s.location = b.place;
    if(b.dev) s.dev = b.dev;
    return s;
  }
  function tplShots(t){
    const from = global.ShotList && ShotList.fromTplShot ? ShotList.fromTplShot : (x => ({ id:rid('s'), text:x.label || 'Shot', note:x.notes || '', item:x.item || '', role:x.role || '', done:false }));
    return (t.shots || []).map(x => { const s = from(x); if(t.place) s.location = t.place; return s; });
  }

  /* ---------------------------------------------------------------- every video's shots */
  /* [{ key, kind, video, part, day, shots, vlogId?, beatId?, clip?, task? }] — key is
     ShotList.board's: beat:<vlog>:<beat>, clip:<id>, video:<id> */
  async function hosts(){
    const out = [];
    let vlogs = [];
    try { vlogs = (await Store.all('vlogs')).values || []; } catch(e){}
    for(const v of vlogs) for(const a of v.acts || []) for(const b of a.beats || []){
      out.push({ key:`beat:${v.id}:${b.id}`, kind:'episode', video:v.title || 'Episode', part:[a.title, b.title].filter(Boolean).join(' · '),
        day: b.day != null ? b.day : a.day != null ? a.day : null, shots:b.shots || [], vlogId:v.id, beatId:b.id });
    }
    let tasks = new Map();
    try { (await Store.all('tasks')).values.forEach(t => tasks.set(t.id, t)); } catch(e){}
    const list = r => Array.isArray(r.shotList) ? r.shotList : global.ShotList ? ShotList.norm(r.shots) : (r.shots || []);
    let clips = [];
    try { clips = (await Store.all('clips')).values || []; } catch(e){}
    for(const c of clips){
      if(c.state === 'posted' || c.stage === 'published') continue;
      const t = c.shootTaskId ? tasks.get(c.shootTaskId) : null;
      out.push({ key:`clip:${c.id}`, kind:'clip', video:c.title || 'Clip', part:'', day:t ? t.day : null, shots:list(c), clip:c, task:t });
    }
    let videos = [];
    try { videos = (await Store.all('videos')).values || []; } catch(e){}
    for(const r of videos){
      const t = r.shootTaskId ? tasks.get(r.shootTaskId) : null;
      out.push({ key:`video:${r.id}`, kind:'video', video:r.title || 'Video', part:'', day:t ? t.day : null, shots:list(r), task:t });
    }
    return out;
  }
  const doneOf = (h, s, i) => {
    if(h.task && h.task.page){ const x = (h.task.subs || []).find(y => y.shot === i); if(x) return !!x.done; }
    return !!(s && s.done);
  };

  /* where each bank shot is used: id → { n, videos:Set, last } */
  async function usage(){
    const m = new Map();
    for(const h of await hosts()) h.shots.forEach((s, i) => {
      if(!s || !s.bank) return;
      if(!m.has(s.bank)) m.set(s.bank, { n:0, videos:new Set(), last:0 });
      const u = m.get(s.bank);
      u.n++; u.videos.add(h.video);
      if(doneOf(h, s, i)) u.last = Math.max(u.last, +s.doneAt || 1);
    });
    for(const b of await all()) if(b.lastShot){ if(!m.has(b.id)) m.set(b.id, { n:0, videos:new Set(), last:0 }); const u = m.get(b.id); u.last = Math.max(u.last, b.lastShot); }
    return m;
  }

  /* the bank's changes reach every linked copy (not its tick) */
  async function propagate(b){
    if(!global.ShotList || !ShotList.board) return 0;
    let n = 0;
    for(const h of await hosts()){
      if(!h.shots.some(s => s && s.bank === b.id)) continue;
      const bd = ShotList.board(h.key);
      const list = await bd.load();
      if(!list) continue;
      let changed = false;
      list.forEach(s => {
        if(s.bank !== b.id) return;
        const want = { text:b.name, note:b.note || '', item:b.item || '', location:b.place || '', dev:b.dev || '' };
        for(const k in want) if((s[k] || '') !== want[k]){ if(want[k]) s[k] = want[k]; else delete s[k]; changed = true; }
      });
      if(changed){ await bd.save(list); n++; }
    }
    return n;
  }

  /* ---------------------------------------------------------------- putting shots on a video */
  async function appendTo(key, shots, beat){
    const bd = ShotList.board(key);
    const list = (await bd.load()) || [];
    const add = shots.map(s => ({ ...s, id:rid('s'), ...(beat != null && beat >= 0 ? { beat } : {}) }));
    await bd.save(list.concat(add));
    return add.length;
  }
  async function newSequence(vlogId, actId, name, shots){
    const v = await Store.get('vlogs', vlogId);
    const act = v && (v.acts || []).find(a => a.id === actId);
    if(!act) return 0;
    act.beats = act.beats || [];
    act.beats.push({ id:rid('b'), title:name || `Sequence ${act.beats.length + 1}`, purpose:'', setup:'talking', script:'', sourceId:null,
      shots:shots.map(s => ({ ...s, id:rid('s') })), day:act.day != null ? act.day : null, at:null, done:false, clipId:null });
    await Store.put('vlogs', v);
    return shots.length;
  }

  /* ---------------------------------------------------------------- This week */
  /* scope: 'week' (shots on a day this week, and Anytime shots), 'nodate'
     (in a video, not on a day yet), 'all' */
  async function week(o){
    const scope = (o && o.scope) || 'week';
    let d0 = 0, d6 = 0;
    try { const wk = await Data.currentWeek(); const { from } = await Data.weekDates(wk); d0 = await Data.dateToDay(from); d6 = d0 + 6; } catch(e){}
    const rows = [];
    for(const h of await hosts()){
      const inWeek = h.day != null && h.day >= d0 && h.day <= d6;
      if(scope === 'week' && !inWeek) continue;
      if(scope === 'nodate' && h.day != null) continue;
      h.shots.forEach((s, i) => {
        if(!s) return;
        const sx = typeof s === 'string' ? { text:s } : s;
        rows.push({ key:`${h.key}#${i}`, host:h.key, kind:h.kind, i, id:sx.id || '', name:sx.text || 'Shot', place:sx.location || '', dev:sx.dev || '',
          item:sx.item || '', bank:sx.bank || '', done:doneOf(h, sx, i), video:h.video, part:h.part, day:h.day,
          taskId:h.task && h.task.page ? h.task.id : '' });
      });
    }
    if(scope !== 'nodate'){
      const since = d0 ? await Data.dayToDate(d0).catch(() => 0) : 0;
      for(const b of await all()) if(b.anytime) rows.push({ key:`bank:${b.id}`, host:'', kind:'anytime', id:b.id, name:b.name, place:b.place || '',
        dev:b.dev || '', item:b.item || '', bank:b.id, done:!!(b.lastShot && b.lastShot >= since), video:'Anytime', part:'', day:null, anytime:true });
    }
    return { rows, d0 };
  }
  async function tick(row, on){
    const now = Date.now();
    if(row.anytime){
      const b = await get(row.id);
      if(b){ b.lastShot = on ? now : 0; await save(b, { quiet:true }); }
      return;
    }
    if(row.taskId){
      const t = await Store.get('tasks', row.taskId);
      const x = t && (t.subs || []).find(y => y.shot === row.i);
      if(x){ x.done = !!on; await Store.put('tasks', t); if(global.Data) Data.invalidate('tasks'); }
    } else {
      const bd = ShotList.board(row.host);
      const list = await bd.load();
      if(!list || !list[row.i]) return;
      list[row.i].done = !!on;
      if(on) list[row.i].doneAt = now; else delete list[row.i].doneAt;
      await bd.save(list);
    }
    if(on && row.bank){ const b = await get(row.bank); if(b){ b.lastShot = now; await save(b, { quiet:true }); } }
  }
  async function setPlace(row, place){
    if(row.anytime){ const b = await get(row.id); if(b){ b.place = place; await save(b); } return; }
    const bd = ShotList.board(row.host);
    const list = await bd.load();
    if(!list || !list[row.i]) return;
    if(place) list[row.i].location = place; else delete list[row.i].location;
    await bd.save(list);
  }

  /* ---------------------------------------------------------------- the sheets */
  function placeSelect(id, list, cur){
    return `<select id="${id}" class="unit sb-sel"><option value="">No place</option>
      ${list.map(p => `<option value="${esc(p)}" ${p === cur ? 'selected' : ''}>${esc(p)}</option>`).join('')}
      <option value="__new">＋ New place…</option></select>`;
  }
  async function readPlace(sel, ask){
    if(sel.value !== '__new') return sel.value;
    const n = prompt(ask || 'New place — Gym, Kitchen, Car…');
    return n ? await addPlace(n) : '';
  }

  /* pick a template, or some of My shots, to drop in */
  function pick(o){
    const opts = o || {};
    return new Promise(async done => {
      const [tpls, bank, pl] = await Promise.all([templates(), all(), places()]);
      let place = '';
      const settle = v => { App.closeSheet(); done(v); };
      const html = () => {
        const tp = tpls.filter(t => !place || (t.place || '') === place), bk = bank.filter(b => !place || (b.place || '') === place);
        return `<h2 style="margin:0 0 4px">${esc(opts.title || 'Add shots')}</h2>
        <p class="hintline" style="margin:0 0 10px">A whole template, or tick some of your own shots.</p>
        ${pl.length ? `<div class="mrail sb-rail"><button class="pill" data-pl="" aria-pressed="${!place}">Everywhere</button>${pl.map(p => `<button class="pill" data-pl="${esc(p)}" aria-pressed="${place === p}">${esc(p)}</button>`).join('')}</div>` : ''}
        <div class="sb-pick">
          <h3 class="pgh">Templates</h3>
          ${tp.length ? `<div class="group compact">${tp.map(t => `<button class="row" data-tpl="${esc(t.id)}"><span class="lbl">${esc(t.name || 'Template')}
              <small>${plural(t.shots.length, 'shot')}${t.place ? ' · 📍 ' + esc(t.place) : ''}</small></span>${ShotList.stripHTML(t.shots.map(x => ({ text:x.label || 'Shot', item:x.item })), 5)}</button>`).join('')}</div>`
            : `<p class="hintline">No templates${place ? ' for ' + esc(place) : ''} yet — make one in the Library (Select → ▦ Make a template).</p>`}
          <h3 class="pgh">My shots</h3>
          ${bk.length ? `<div class="sb-list">${bk.map(b => `<label class="sb-row"><input type="checkbox" data-bk="${esc(b.id)}">
              ${b.item ? `<span class="sb-pic" data-slpic="${esc(b.item)}"></span>` : '<span class="sb-pic none">🎥</span>'}
              <span class="sb-tx"><b>${esc(b.name)}</b><small>${[b.place && '📍 ' + b.place, b.dev, ...(b.tags || [])].filter(Boolean).map(esc).join(' · ')}</small></span></label>`).join('')}</div>`
            : `<p class="hintline">None${place ? ' for ' + esc(place) : ''} yet — add them in Tools → Shots → My shots.</p>`}
        </div>
        <div class="sheetcta"><button class="btn-primary" data-addbk disabled>Add the ticked shots</button><button class="btn-ghost" data-no>Cancel</button></div>`;
      };
      App.sheet(html(), sh => {
        const draw = () => { sh.innerHTML = html(); ShotList.fillPics(sh); };
        ShotList.fillPics(sh);
        sh.addEventListener('change', () => {
          const n = sh.querySelectorAll('[data-bk]:checked').length, b = sh.querySelector('[data-addbk]');
          b.disabled = !n; b.textContent = n ? `Add ${plural(n, 'shot')}` : 'Add the ticked shots';
        });
        sh.addEventListener('click', e => {
          const p = e.target.closest('[data-pl]');
          if(p){ place = p.dataset.pl; return draw(); }
          if(e.target.closest('[data-no]')) return settle(null);
          const t = e.target.closest('[data-tpl]');
          if(t){ const tp = tpls.find(x => x.id === t.dataset.tpl); return settle(tp ? { name:tp.name || 'Template', place:tp.place || '', shots:tplShots(tp), from:'template' } : null); }
          if(e.target.closest('[data-addbk]')){
            const ids = [...sh.querySelectorAll('[data-bk]:checked')].map(x => x.dataset.bk);
            const picked = ids.map(id => bank.find(b => b.id === id)).filter(Boolean);
            if(!picked.length) return;
            return settle({ name:picked.length === 1 ? picked[0].name : (place || 'My shots'), place, shots:picked.map(storyShot), from:'bank' });
          }
        });
      });
    });
  }

  /* put shots on a video, from the Shots section: video → day → sequence (or a clip's beat) */
  function assign(what){
    return new Promise(async done => {
      const vlogs = ((await Store.all('vlogs').catch(() => ({ values:[] }))).values || [])
        .sort((a, b) => (b.week || 0) - (a.week || 0) || String(b.id).localeCompare(String(a.id))).slice(0, 24);
      const clips = ((await Store.all('clips').catch(() => ({ values:[] }))).values || [])
        .filter(c => c.state !== 'posted' && c.stage !== 'published').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 24);
      let step = { at:'video' };
      const finish = r => { App.closeSheet(); done(r); };
      const head = `<h2 style="margin:0 0 4px">Assign “${esc(what.name)}”</h2><p class="hintline" style="margin:0 0 10px">${plural(what.shots.length, 'shot')} — pick where ${what.shots.length === 1 ? 'it goes' : 'they go'}.</p>`;
      const html = () => {
        if(step.at === 'video') return head + `
          ${vlogs.length ? `<h3 class="pgh">Episodes</h3><div class="group compact sb-scroll">${vlogs.map(v => `<button class="row" data-v="${esc(v.id)}"><span class="lbl">${esc(v.title || 'Episode')}<small>${plural((v.acts || []).length, 'day')}</small></span>${U.ICON.chevR}</button>`).join('')}</div>` : ''}
          ${clips.length ? `<h3 class="pgh">Clips</h3><div class="group compact sb-scroll">${clips.map(c => `<button class="row" data-c="${esc(c.id)}"><span class="lbl">${esc(c.title || 'Clip')}</span>${U.ICON.chevR}</button>`).join('')}</div>` : ''}
          ${!vlogs.length && !clips.length ? '<p class="hintline">No episodes or clips yet.</p>' : ''}
          <div class="sheetcta"><button class="btn-ghost" data-no>Cancel</button></div>`;
        if(step.at === 'day'){
          const v = step.v;
          return head + `<p class="pgh" style="margin:0 0 6px">${esc(v.title || 'Episode')} — which day?</p>
            <div class="group compact sb-scroll">${(v.acts || []).map(a => `<button class="row" data-a="${esc(a.id)}"><span class="lbl">${esc(a.title || 'Day')}<small>${plural((a.beats || []).length, 'sequence')}</small></span>${U.ICON.chevR}</button>`).join('')}</div>
            <div class="sheetcta"><button class="btn-ghost" data-back>Back</button><button class="btn-ghost" data-no>Cancel</button></div>`;
        }
        if(step.at === 'seq'){
          const a = step.a;
          return head + `<p class="pgh" style="margin:0 0 6px">${esc(step.v.title || 'Episode')} · ${esc(a.title || 'Day')}</p>
            <div class="group compact sb-scroll">
              <button class="row" data-new><span class="lbl">＋ As a new sequence<small>“${esc(what.name)}”</small></span></button>
              ${(a.beats || []).map(b => `<button class="row" data-b="${esc(b.id)}"><span class="lbl">Add to “${esc(b.title || 'Sequence')}”<small>${plural((b.shots || []).length, 'shot')} there now</small></span></button>`).join('')}</div>
            <div class="sheetcta"><button class="btn-ghost" data-back>Back</button><button class="btn-ghost" data-no>Cancel</button></div>`;
        }
        if(step.at === 'beat'){
          const bn = (step.c.plan && step.c.plan.beats) || [];
          return head + `<p class="pgh" style="margin:0 0 6px">${esc(step.c.title || 'Clip')} — which beat?</p>
            <div class="group compact sb-scroll">${bn.map((b, k) => `<button class="row" data-k="${k}"><span class="lbl">${esc(b || 'Beat ' + (k + 1))}</span></button>`).join('')}
              <button class="row" data-k="-1"><span class="lbl">${bn.length ? 'No beat — at the end' : 'Add to the clip'}</span></button></div>
            <div class="sheetcta"><button class="btn-ghost" data-back>Back</button><button class="btn-ghost" data-no>Cancel</button></div>`;
        }
        return '';
      };
      App.sheet(html(), sh => {
        const draw = () => { sh.innerHTML = html(); };
        sh.addEventListener('click', async e => {
          if(e.target.closest('[data-no]')) return finish(null);
          if(e.target.closest('[data-back]')){ step = step.at === 'seq' ? { at:'day', v:step.v } : { at:'video' }; return draw(); }
          const v = e.target.closest('[data-v]'); if(v){ step = { at:'day', v:vlogs.find(x => x.id === v.dataset.v) }; return draw(); }
          const c = e.target.closest('[data-c]'); if(c){ step = { at:'beat', c:clips.find(x => x.id === c.dataset.c) }; return draw(); }
          const a = e.target.closest('[data-a]'); if(a){ step = { at:'seq', v:step.v, a:(step.v.acts || []).find(x => x.id === a.dataset.a) }; return draw(); }
          if(e.target.closest('[data-new]')){
            const n = await newSequence(step.v.id, step.a.id, what.name, what.shots);
            U.toast(`${plural(n, 'shot')} → ${step.v.title || 'Episode'} · ${step.a.title || 'Day'}`);
            return finish({ kind:'episode', vlogId:step.v.id });
          }
          const b = e.target.closest('[data-b]');
          if(b){
            const n = await appendTo(`beat:${step.v.id}:${b.dataset.b}`, what.shots);
            U.toast(`${plural(n, 'shot')} → ${step.v.title || 'Episode'}`);
            return finish({ kind:'episode', vlogId:step.v.id });
          }
          const k = e.target.closest('[data-k]');
          if(k){
            const n = await appendTo(`clip:${step.c.id}`, what.shots, +k.dataset.k);
            U.toast(`${plural(n, 'shot')} → ${step.c.title || 'Clip'}`);
            return finish({ kind:'clip', clipId:step.c.id });
          }
        });
      });
    });
  }

  /* one of My shots: add or change it */
  function edit(b0, onSaved){
    return new Promise(async done => {
      const b = { name:'', place:'', tags:[], dev:'', item:'', note:'', anytime:false, ...(b0 || {}) };
      const [pl, tg, devs, used] = await Promise.all([places(), tags(), global.Devices ? Devices.list() : Promise.resolve([]), usage()]);
      const u = b.id ? used.get(b.id) : null;
      const html = () => `<h2 style="margin:0 0 10px">${b.id ? 'Edit shot' : 'New shot'}</h2>
        <div class="field"><label for="sbName">Shot</label><input id="sbName" value="${esc(b.name)}" placeholder="Bench press — side, low"></div>
        <div class="sb-two">
          <div class="field"><label for="sbPlace">Place</label>${placeSelect('sbPlace', pl, b.place)}</div>
          <div class="field"><label for="sbDev">Shot on</label><select id="sbDev" class="unit sb-sel"><option value="">Any camera</option>${devs.map(d => `<option ${d === b.dev ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Tags</label><div class="sb-tags">${tg.map(t => `<button type="button" class="pill" data-tag="${esc(t)}" aria-pressed="${b.tags.includes(t)}">${esc(t)}</button>`).join('')}<button type="button" class="pill" data-newtag>＋</button></div></div>
        <div class="field"><label>Frame</label><div class="sb-frame">${b.item ? `<span class="sb-pic big" data-slpic="${esc(b.item)}"></span>` : '<span class="sb-pic big none">No frame</span>'}
          <div><button type="button" class="btn-sm" data-frame>${b.item ? 'Change' : 'Pick from the Library'}</button>${b.item ? ' <button type="button" class="btn-sm" data-noframe>Remove</button>' : ''}</div></div></div>
        <div class="field"><label for="sbNote">How you set it up</label><textarea id="sbNote" rows="3" placeholder="Phone on the floor stand, 0.5×, left of the bench…">${esc(b.note)}</textarea></div>
        <label class="sb-any"><input type="checkbox" id="sbAny" ${b.anytime ? 'checked' : ''}> <span><b>Anytime</b> — no date; it shows in This week until you get it</span></label>
        ${u && u.n ? `<p class="hintline">In ${plural(u.videos.size, 'video')}${u.last > 1 ? ` · last shot ${new Date(u.last).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })}` : ''}. Changes here reach ${u.n === 1 ? 'that copy' : 'every copy'}.</p>` : ''}
        <div class="sheetcta"><button class="btn-primary" data-save>Save</button>${b.id ? '<button class="btn-ghost" data-assign>Assign to…</button><button class="btn-ghost" data-del style="color:var(--red)">Delete</button>' : ''}<button class="btn-ghost" data-no>Cancel</button></div>`;
      App.sheet(html(), sh => {
        const keep = () => { b.name = sh.querySelector('#sbName').value; b.note = sh.querySelector('#sbNote').value; b.anytime = sh.querySelector('#sbAny').checked;
          b.dev = sh.querySelector('#sbDev').value; const p = sh.querySelector('#sbPlace').value; if(p !== '__new') b.place = p; };
        const draw = () => { keep(); sh.innerHTML = html(); ShotList.fillPics(sh); };
        ShotList.fillPics(sh);
        sh.addEventListener('change', async e => {
          if(e.target.id === 'sbPlace' && e.target.value === '__new'){ const n = await readPlace(e.target); if(n){ b.place = n; if(!pl.includes(n)) pl.push(n); } draw(); }
        });
        sh.addEventListener('click', async e => {
          if(e.target.closest('[data-no]')){ App.closeSheet(); return done(null); }
          const t = e.target.closest('[data-tag]');
          if(t){ const v = t.dataset.tag; b.tags = b.tags.includes(v) ? b.tags.filter(x => x !== v) : [...b.tags, v]; return draw(); }
          if(e.target.closest('[data-newtag]')){ const n = await addTag(prompt('New tag — Overhead, Daily vlog…')); if(n){ if(!tg.includes(n)) tg.push(n); b.tags.push(n); } return draw(); }
          if(e.target.closest('[data-frame]')){ keep(); const u2 = await LibView.pick({ title:'A frame for this shot' }); if(u2) b.item = u2; return draw(); }
          if(e.target.closest('[data-noframe]')){ keep(); b.item = ''; return draw(); }
          if(e.target.closest('[data-save]') || e.target.closest('[data-assign]')){
            keep();
            if(!b.name.trim()) return U.toast('Name the shot first');
            const rec = await save(b);
            if(onSaved) onSaved(rec);
            if(e.target.closest('[data-assign]')){ App.closeSheet(); await assign({ name:rec.name, place:rec.place, shots:[storyShot(rec)] }); return done(rec); }
            App.closeSheet(); U.toast(b.id ? 'Saved' : `“${rec.name}” is in My shots`); return done(rec);
          }
          if(e.target.closest('[data-del]')){
            if(!confirm(`Delete “${b.name}” from My shots? Videos that use it keep their copy.`)) return;
            await remove(b.id); App.closeSheet(); U.toast('Deleted'); return done('deleted');
          }
        });
      });
    });
  }

  global.ShotBank = { all, get, save, remove, places, addPlace, tags, addTag, templates, storyShot, tplShots, hosts, usage, propagate,
    appendTo, newSequence, week, tick, setPlace, pick, assign, edit, placeSelect, readPlace, DEFAULT_TAGS };
})(window);
