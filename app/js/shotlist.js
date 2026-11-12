/* v4: the task's Steps + Shot page, everywhere a video is planned.

   A task has its shots as steps beside a shot page (a notebook page with a
   frame — GIF, clip or still — in each spot), Next up, and shoot mode. An
   episode's sequence, a clip and a series video now have exactly that: they
   lend the task screen a task-shaped copy of themselves and take it back on
   save (a "host"), so it is the same Steps block, not a look-alike.

     ShotList.hostBeat(vlogId, beatId) / hostClip(id) / hostVideo(id)
              { kicker, load() → { title, page, subs, pageFrom, morePages },
                save(t) }. Each record keeps page + subs, and a plain shot
              list beside them (beat.shots, clip/video .shotList + .shots) for
              everything that reads shots (Shots, board, counts, search).
              When something else changes that list (the board, ✦ Suggest
              shots, a tick on the day screen) the page is rebuilt from it.
     ShotList.embed(container, host, onChange)
              the Steps block inside another screen (screens/task.js)
     ShotList.toTask(t, shots, title)
              shots → a shot page (first 14, with frames) whose shots are the
              steps; the rest as plain steps
     ShotList.putOnDay / daySheet   one shoot task for a clip or video
     ShotList.norm(list)     old lists (plain text lines) become shots
     ShotList.thumbHTML / stripHTML / fillPics   small frames in lists */
(function(global){
  const esc = s => U.esc(s);
  const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ------------------------------------------------------------ the data */
  function norm(list){
    return (Array.isArray(list) ? list : []).map(x => {
      if(x == null) return null;
      if(typeof x === 'string') return x.trim() ? { id:uid(), text:x.trim(), note:'', framing:'', movement:'', role:'', item:'', done:false } : null;
      return { id:x.id || uid(), text:String(x.text || x.label || x.name || x.t || '').trim(), note:x.note || x.notes || '',
        framing:x.framing || '', movement:x.movement || '', role:x.role || '', item:x.item || x.frame || '', done:!!x.done };
    }).filter(s => s && (s.text || s.item));
  }
  const texts = shots => norm(shots).map(s => s.text || 'Shot');
  const frames = shots => norm(shots).filter(s => s.item).length;
  const lineOf = s => [s.text || 'Shot', s.framing, s.movement].filter(Boolean).join(' — ');

  /* a shot template's shot (shottemplates.js) as a shot here */
  const dash = v => v && v !== '—' ? v : '';
  const fromTplShot = s => ({ id:uid(), text:s.label || s.name || s.role || 'Shot', note:s.notes || '', framing:dash(s.size),
    movement:dash(s.movement), role:s.role || '', item:s.item || '', done:false });

  /* the shots onto a task: a shot page (≤ 14) + its steps, the rest as steps */
  function toTask(t, shots, title){
    const list = norm(shots);
    if(!list.length || !global.Notebook) return t;
    const max = Notebook.MAX_STEPS || 14;
    const P = Notebook.stepsPage(title || t.title || 'Shots');
    P.name = 'Shot sequence · ' + (title || t.title || 'Shots');
    P.fields = { ...P.fields, task:'task — ' + (t.title || title || '') };
    P.slots = list.slice(0, max).map(s => ({ item:s.item || '', tone:'', text:lineOf(s), role:s.role || '', note:s.note || '', done:!!s.done }));
    t.page = P;
    delete t.pageOff;
    const keep = (t.subs || []).filter(s2 => s2 && s2.shot == null && !list.some(s => lineOf(s) === s2.t || s.text === s2.t));
    t.subs = list.slice(0, max).map((s, i) => ({ t:lineOf(s), done:!!s.done, shot:i, pg:1, ...(s.note ? { note:s.note } : {}) }))
      .concat(list.slice(max).map(s => ({ t:lineOf(s), done:!!s.done })), keep);
    if(global.TaskPages) TaskPages.match(t);
    return t;
  }

  /* a copy of a host's page + steps for a task */
  function copyPage(t, src){
    t.page = global.Notebook && Notebook.copyNew ? Notebook.copyNew(src.page) : JSON.parse(JSON.stringify(src.page));
    (t.page.slots || []).forEach((sl, i) => { sl.done = false; });
    t.subs = (src.subs || []).map(x => ({ ...x, done:false }));
    if(src.pageFrom) t.pageFrom = src.pageFrom;
    if(Array.isArray(src.morePages) && src.morePages.length) t.morePages = src.morePages.map(x => global.Notebook && Notebook.copyNew ? Notebook.copyNew(x) : x);
    delete t.pageOff;
    if(global.TaskPages) TaskPages.match(t);
    return t;
  }

  /* one shoot task for a clip or video: made the first time, moved and
     refreshed after that (a ticked-off one is left alone and a new one made).
     o.page (+ o.subs): the clip's own shot page goes on as it is. */
  async function putOnDay(o){
    let t = o.taskId ? await Store.get('tasks', o.taskId).catch(() => null) : null;
    if(t && t.view === 'done') t = null;
    if(!t) t = { id:U.taskId(), cad:'One-off', pri:'med', at:null, mins:0, prog:'', note:o.note || '', subs:[], view:'todo', kind:'shoot', ...(o.extra || {}) };
    t.day = o.day;
    t.title = 'Shoot — ' + (o.title || 'Untitled');
    if(o.page){ t.subs = []; copyPage(t, o); }
    else toTask(t, o.shots, o.title);
    await Store.put('tasks', t);
    if(global.Data && Data.invalidate) Data.invalidate('tasks');
    return t;
  }
  /* the sheet that asks which day — resolves to the task, null if taken off,
     undefined if cancelled */
  function daySheet(o){
    return new Promise(async resolve => {
      const had = o.taskId ? await Store.get('tasks', o.taskId).catch(() => null) : null;
      const field = await U.dayField('sl-day', (had && had.day) || await Data.currentDay());
      App.sheet(`<h2 style="margin:0 0 4px">${had ? 'Move the shoot' : 'Put the shoot on a day'}</h2>
        <p class="hintline" style="margin:0 0 12px">A shoot task with its ${o.page ? (o.page.slots || []).length : norm(o.shots).length} shots as its steps and its shot page —
          frames, shoot mode, and on your phone.</p>
        ${field}
        <div class="sheetcta"><button class="btn-primary" data-ok>${had ? 'Save' : 'Put it on that day'}</button>
          ${had ? '<button class="btn-ghost" data-off>Take it off my days</button>' : ''}
          <button class="btn-ghost" data-no>Cancel</button></div>`, sh => {
        U.wireDayField(sh, 'sl-day');
        sh.addEventListener('click', async e => {
          if(e.target.closest('[data-no]')){ App.closeSheet(); return resolve(undefined); }
          if(e.target.closest('[data-off]')){
            try { await Store.del('tasks', had.id); } catch(err){}
            if(global.Data && Data.invalidate) Data.invalidate('tasks');
            App.closeSheet(); return resolve(null);
          }
          if(!e.target.closest('[data-ok]')) return;
          const day = await U.readDayField(sh, 'sl-day');
          if(day == null) return U.toast('Pick a day');
          const t = await putOnDay({ ...o, day });
          App.closeSheet();
          resolve(t);
        });
      });
    });
  }

  /* ------------------------------------------------------------ the look */
  const CSS = `
  .sl-strip{display:flex;gap:4px;margin:8px 0 0;overflow:hidden}
  .sl-strip span{width:34px;height:42px;flex:0 0 34px;border-radius:3px;overflow:hidden;background:var(--surface-1,#1F1C17);border:1px solid var(--line)}
  .sl-strip img,.sl-strip video{width:100%;height:100%;object-fit:cover;display:block}
  .shotline .sl-mini{width:28px;height:34px;flex:0 0 28px;border-radius:3px;overflow:hidden;background:var(--surface-1,#1F1C17);border:1px solid var(--line);margin-right:2px}
  .sl-mini img,.sl-mini video{width:100%;height:100%;object-fit:cover;display:block}
  .sl-mini i{display:none}
  .sl-strip em{font-style:normal;color:var(--dim);font-size:12px;align-self:center;margin-left:2px}
  .tk-host.embedded > .block{margin:0;border:0;background:transparent;padding:0}
  .tk-host.embedded > .block > h4{display:none}`;
  function css(){
    if(document.getElementById('sl-css')) return;
    const st = document.createElement('style'); st.id = 'sl-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  /* fill every [data-slpic] under host with its frame, moving */
  async function fillPics(host){
    css();
    const cells = [...host.querySelectorAll('[data-slpic]')];
    if(!cells.length || !global.MediaLib) return;
    let lib = null;
    try { lib = await MediaLib.load(); } catch(e){ return; }
    for(const c of cells){
      const it = MediaLib.find(lib, c.dataset.slpic);
      const u = it ? await MediaLib.url(it).catch(() => null) : null;
      if(!c.isConnected) continue;
      c.innerHTML = !u ? '<i>on its way</i>' : it.kind === 'video'
        ? `<video src="${esc(u)}" muted loop autoplay playsinline preload="metadata"></video>` : `<img src="${esc(u)}" alt="" loading="lazy">`;
    }
  }

  /* a shot line's frame, small (episode screens' .shotline rows) */
  const thumbHTML = s => s && s.item ? `<span class="sl-mini" data-slpic="${esc(s.item)}"></span>` : '';

  /* a row of small frames — for a list's summary (a day, a card) */
  function stripHTML(shots, max){
    const f = norm(shots).filter(s => s.item);
    if(!f.length) return '';
    const n = max || 8;
    return `<div class="sl-strip">${f.slice(0, n).map(s => `<span data-slpic="${esc(s.item)}"></span>`).join('')}${f.length > n ? `<em>+${f.length - n}</em>` : ''}</div>`;
  }

  /* ------------------------------------------------------------ hosts */
  /* page + steps → a plain shot list, in page order, then the other steps */
  function fromTask(t){
    const out = [], P = t.page, subs = t.subs || [];
    const n = P && Array.isArray(P.slots) ? P.slots.length : 0;
    for(let i = 0; i < n; i++){
      const sl = P.slots[i] || {}, mine = subs.filter(x => x.shot === i);
      out.push({ text:sl.text || '', role:sl.role || '', item:sl.item || '', note:(mine[0] || {}).note || sl.note || '',
        done:mine.length ? mine.every(x => x.done) : !!sl.done });
    }
    subs.filter(x => !(x.shot != null && x.shot >= 0 && x.shot < n)).forEach(x => out.push({ text:x.t || '', note:x.note || '', role:'', item:'', done:!!x.done }));
    return out;
  }
  /* what a shot list looks like, so a change made elsewhere is noticed */
  const sigOf = list => JSON.stringify(norm(list).map(x => [x.text, x.item, !!x.done]));

  function host(o){
    let rec = null;
    return {
      kicker:o.kicker,
      async load(){
        rec = await o.get();
        if(!rec) return null;
        const title = o.title(rec);
        const t = { id:o.key, title, kind:'shoot', page:rec.page || null, subs:(rec.subs || []).map(x => ({ ...x })),
          pageFrom:rec.pageFrom || null, morePages:rec.morePages, hideDone:rec.hideDone, pageOff:rec.pageOff, swipeIds:[] };
        const shots = o.shots(rec);
        /* no page yet, or its shot list was changed somewhere else: build it from the list */
        if(!t.page || (rec.shotsSig != null && rec.shotsSig !== sigOf(shots))){
          const old = t.page;
          t.page = null; t.subs = [];
          if(norm(shots).length) toTask(t, shots, title);
          else if(global.Notebook && !rec.pageOff){
            t.page = Notebook.stepsPage(title);
            t.page.name = 'Shot sequence · ' + title;
            t.page.slots = [];
          }
          if(old && t.page){ t.page.fields = { ...(t.page.fields || {}), ...(old.fields || {}) }; if(old.name) t.page.name = old.name; }
        }
        return t;
      },
      async save(t){
        rec = (await o.get()) || rec;
        if(!rec) return;
        rec.page = t.page || null;
        rec.subs = t.subs || [];
        if(t.pageFrom) rec.pageFrom = t.pageFrom; else delete rec.pageFrom;
        if(Array.isArray(t.morePages) && t.morePages.length) rec.morePages = t.morePages; else delete rec.morePages;
        if(t.hideDone !== undefined) rec.hideDone = t.hideDone;
        if(t.pageOff) rec.pageOff = true; else delete rec.pageOff;
        const list = fromTask(t);
        o.mirror(rec, list);
        rec.shotsSig = sigOf(o.shots(rec));
        await o.put(rec);
      }
    };
  }

  /* an episode's sequence (a beat inside vlogs) */
  function hostBeat(vlogId, beatId){
    let v = null;
    return host({ key:'beat:' + beatId, kicker:'Sequence',
      get: async () => { v = await Store.get('vlogs', vlogId); for(const a of (v && v.acts) || []) for(const b of a.beats || []) if(b.id === beatId) return b; return null; },
      put: async () => { await Store.put('vlogs', v); },
      title: b => b.title || 'Sequence',
      shots: b => b.shots || [],
      /* the beat's shots keep their ids, so a task or a board pointing at one still does */
      mirror: (b, list) => { const old = b.shots || [];
        b.shots = list.map((s, i) => ({ id:(old[i] && old[i].id) || uid(), text:s.text, note:s.note, role:s.role, item:s.item, done:s.done })); }
    });
  }
  const listHost = (key, kicker, get, put) => host({ key, kicker, get, put,
    title: r => r.title || 'Untitled',
    shots: r => Array.isArray(r.shotList) ? r.shotList : (r.shots || []),
    mirror: (r, list) => { r.shotList = list; r.shots = list.map(s => s.text || 'Shot'); }
  });
  /* a clip */
  const hostClip = id => listHost('clip:' + id, 'Clip', () => Store.get('clips', id).catch(() => null), r => Data.saveClip(r));
  /* a series' video */
  const hostVideo = id => listHost('video:' + id, 'Video', () => Store.get('videos', id).catch(() => null), r => Videos.save(r));

  /* the Steps block of the task screen, inside another screen */
  function embed(container, h, onChange){
    css();
    if(!container || !global.Screens) return false;
    return Screens.mountInto('task', container, { host:h, embedded:true, onChange });
  }

  global.ShotList = { hostBeat, hostClip, hostVideo, embed, fromTask, toTask, copyPage, putOnDay, daySheet, norm, texts, frames, lineOf,
    fromTplShot, stripHTML, thumbHTML, fillPics, css };
})(window);
