/* Quick sort — the Inbox, one swipe at a time.

   Hundreds of saves come in at once from an import, and opening each one to
   tick a folder is three taps a video. Here the video plays, the folders sit
   underneath, and one tap files it and brings up the next.

     tap a folder      file it there, next one
     hold a folder     add it there and stay (for a second folder)
     Keep              out of the Inbox with no folder
     Skip              to the back of the line
     Delete            gone (Undo brings it back)
     Undo              the last thing, whatever it was

   On a keyboard: 1–9 for the first nine folders, K keep, S or → skip,
   D delete, Z or Backspace undo. */
(function(){
  const esc = v => U.esc(v);
  const HOLD_MS = 450;

  function savedLine(s){
    const t = s.savedAt || 0;
    if(!t) return '';
    const d = new Date(t);
    const same = d.getFullYear() === new Date().getFullYear();
    return 'saved ' + d.toLocaleDateString(undefined, { month:'short', day:'numeric', ...(same ? {} : { year:'numeric' }) });
  }

  async function mount(el, params){
    const V = window.SwipeView;
    if(!V){ U.toast('Open the Swipe file first'); return Screens.pop(); }
    await V.loadThumbs();

    const { values } = await Store.all('swipes');
    const line = values.filter(s => s.inbox)
      .sort((a, b) => ((b.savedAt || b.createdAt || 0) - (a.savedAt || a.createdAt || 0)))
      .map(s => s.id);
    const total = line.length;
    let at = 0;                       /* index into line of the one on screen */
    const undo = [];                  /* { kind, before, thumb, index } */
    const tally = { filed:0, kept:0, deleted:0, skipped:0 };
    let cur = null;                   /* the swipe on screen */
    let folders = window.SwipeFolders ? await SwipeFolders.sorted() : [];
    const changed = () => params.onChange && params.onChange();

    async function load(){
      while(at < line.length){
        const s = await Store.get('swipes', line[at]);
        if(s && s.inbox) return s;
        line.splice(at, 1);           /* sorted somewhere else meanwhile */
      }
      return null;
    }

    async function render(){
      cur = await load();
      if(!cur) return renderDone();
      const so = V.SOURCES[cur.source] || V.SOURCES.reel;
      const emb = window.Embed && !V.hasThumb(cur.id) ? Embed.forUrl(cur.url) : null;
      const ratio = emb ? parseFloat(emb.ratio) / 100 : 1.25;
      const done = total - line.length + at;
      const left = line.length - at;
      const has = new Set(cur.folders || []);

      el.innerHTML = Screens.bar({ kicker:'Inbox', title:'Quick sort' }) + `
      <div class="view qs">
        <div class="qs-prog"><span>${left} left${tally.filed + tally.kept + tally.deleted ? ` · ${tally.filed + tally.kept} sorted` : ''}</span>
          <i><b style="width:${total ? Math.round(done / total * 100) : 0}%"></b></i></div>

        <div class="qs-prev" style="width:min(100%, calc(44vh / ${ratio.toFixed(3)}))">
          ${emb ? Embed.html(cur.url).replace('loading="lazy"', '')
                : `<span class="qs-cover" style="background-image:${V.coverFor(cur)}"></span>`}
        </div>

        <div class="qs-meta">
          <span class="tg" style="color:${so.c};border:1px solid ${so.c};background:transparent">${so.n}</span>
          <span class="qs-t"><b>${esc(cur.title && !/^untitled swipe$/i.test(cur.title) ? cur.title : (cur.author ? '@' + cur.author : 'Untitled swipe'))}</b>
            <small>${[cur.author && cur.title && !/^untitled/i.test(cur.title) ? '@' + esc(cur.author) : '', savedLine(cur)].filter(Boolean).join(' · ')}</small></span>
          ${cur.url ? `<button class="btn-sm" data-q="open" aria-label="Open in the app">↗</button>` : ''}
        </div>

        <div class="qs-folders">
          ${folders.map((f, i) => `<button class="qs-f" data-f="${f.id}" aria-pressed="${has.has(f.id)}">
            ${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}<span>${esc(f.emoji || '📁')} ${esc(f.name)}</span></button>`).join('')}
          <button class="qs-f qs-new" data-q="new"><span>+ New folder</span></button>
        </div>
        <p class="qs-hint">${folders.length ? 'Tap a folder to file it and move on. Hold one to add it and stay.' : 'Make your first folder — cars, morning routine, editing tricks…'}</p>

        <div class="qs-acts">
          <button data-q="undo" ${undo.length ? '' : 'disabled'}>↶ Undo</button>
          <button data-q="skip">Skip</button>
          <button data-q="keep">Keep<small>no folder</small></button>
          <button data-q="del" class="qs-del">Delete</button>
        </div>
      </div>`;

      /* fill in a title and creator while you look at it, if the import
         hasn't reached this one yet */
      if(V.needsDetails && V.needsDetails(cur) && window.LinkMeta && LinkMeta.native()){
        const id = cur.id;
        V.enrich(cur).then(async got => {
          if(got && cur && cur.id === id && el.isConnected){
            await V.loadThumbs();
            const t = el.querySelector('.qs-t b');
            if(t && cur.title && !/^untitled/i.test(cur.title)) t.textContent = cur.title;
          }
        }).catch(() => {});
      }
    }

    function renderDone(){
      el.innerHTML = Screens.bar({ kicker:'Inbox', title:'Quick sort' }) + `
      <div class="view qs">
        <div class="empty" style="margin-top:12vh"><b>${total ? 'Inbox zero' : 'Nothing in the Inbox'}</b>
          ${total ? `${tally.filed} filed · ${tally.kept} kept · ${tally.deleted} deleted` : 'New saves land here until they are in a folder.'}</div>
        ${undo.length ? `<button class="btn-ghost" data-q="undo" style="width:100%;margin-top:14px">↶ Undo the last one</button>` : ''}
        <button class="btn-primary" data-q="back" style="width:100%;margin-top:10px">Back to the swipe file</button>
      </div>`;
    }

    /* every change keeps what the swipe looked like before, so Undo is exact */
    async function commit(kind, mutate){
      const before = JSON.parse(JSON.stringify(cur));
      const entry = { kind, before, index: at };
      if(kind === 'del'){
        try { entry.thumb = await Store.get('swipe-thumb', cur.id); } catch(e){}
        await Store.del('swipes', cur.id);
        try { await Store.del('swipe-thumb', cur.id); } catch(e){}
        line.splice(at, 1);
        tally.deleted++;
      } else {
        mutate(cur);
        cur.inbox = false;
        await Store.put('swipes', cur);
        line.splice(at, 1);
        tally[kind === 'keep' ? 'kept' : 'filed']++;
      }
      undo.push(entry);
      changed();
      render();
    }

    async function doUndo(){
      const u = undo.pop();
      if(!u) return;
      if(u.kind === 'skip'){
        /* it went to the back; bring it forward again */
        const i = line.lastIndexOf(u.before.id);
        if(i !== -1) line.splice(i, 1);
        line.splice(u.index, 0, u.before.id);
        tally.skipped--;
      } else if(u.kind === 'hold'){
        await Store.put('swipes', u.before);
      } else {
        await Store.put('swipes', u.before);
        if(u.thumb) await Store.put('swipe-thumb', u.thumb, u.before.id);
        line.splice(u.index, 0, u.before.id);
        tally[u.kind === 'del' ? 'deleted' : u.kind === 'keep' ? 'kept' : 'filed']--;
      }
      at = u.index;
      if(u.thumb) await V.loadThumbs();
      changed();
      render();
    }

    function skip(){
      if(line.length - at <= 1){ return U.toast('That is the last one'); }
      const id = line.splice(at, 1)[0];
      line.push(id);
      undo.push({ kind:'skip', before:{ id }, index: at });
      tally.skipped++;
      render();
    }

    async function file(fid){
      const f = folders.find(x => x.id === fid);
      await commit('file', s => { s.folders = [...new Set((s.folders || []).concat(fid))]; });
      if(f) U.toast(`${f.emoji || '📁'} ${f.name}`);
    }

    /* hold: add the folder, stay on this one */
    async function hold(fid){
      const before = JSON.parse(JSON.stringify(cur));
      const on = (cur.folders || []).includes(fid);
      cur.folders = on ? cur.folders.filter(x => x !== fid) : (cur.folders || []).concat(fid);
      await Store.put('swipes', cur);
      undo.push({ kind:'hold', before, index: at });
      const b = el.querySelector(`.qs-f[data-f="${fid}"]`);
      if(b) b.setAttribute('aria-pressed', String(!on));
      const u = el.querySelector('[data-q="undo"]'); if(u) u.disabled = false;
      const f = folders.find(x => x.id === fid);
      U.toast(on ? `Took it out of ${f ? f.name : 'that folder'}` : `Added to ${f ? f.name : 'that folder'} — tap another, or Keep`);
      if(navigator.vibrate) try { navigator.vibrate(15); } catch(e){}
    }

    async function newFolder(){
      const n = (prompt('Name the new folder') || '').trim();
      if(!n) return;
      const f = await SwipeFolders.create(n, '📁');
      folders = await SwipeFolders.sorted();
      if(f) await file(f.id);
    }

    /* tap vs hold on a folder: a hold must not also count as a tap */
    let timer = null, held = false, sx = 0, sy = 0;
    el.addEventListener('pointerdown', e => {
      const b = e.target.closest('.qs-f[data-f]');
      if(!b) return;
      held = false; sx = e.clientX; sy = e.clientY;
      clearTimeout(timer);
      timer = setTimeout(() => { held = true; hold(b.dataset.f); }, HOLD_MS);
    });
    const cancelHold = e => {
      if(e && e.type === 'pointermove' && Math.hypot(e.clientX - sx, e.clientY - sy) < 10) return;
      clearTimeout(timer);
    };
    ['pointerup', 'pointercancel', 'pointerleave', 'pointermove'].forEach(t => el.addEventListener(t, cancelHold));
    el.addEventListener('contextmenu', e => { if(e.target.closest('.qs-f')) e.preventDefault(); });

    el.addEventListener('click', async e => {
      const f = e.target.closest('.qs-f[data-f]');
      if(f){
        if(held){ held = false; return; }
        return cur && file(f.dataset.f);
      }
      const q = e.target.closest('[data-q]');
      if(!q || q.disabled) return;
      const k = q.dataset.q;
      if(k === 'back') return Screens.pop();
      if(k === 'undo') return doUndo();
      if(!cur) return;
      if(k === 'open'){ try { window.open(cur.url, '_blank', 'noopener'); } catch(err){} return; }
      if(k === 'new') return newFolder();
      if(k === 'skip') return skip();
      if(k === 'keep') return commit('keep', () => {});
      if(k === 'del') return commit('del');
    });

    function onKey(e){
      if(!el.isConnected){ document.removeEventListener('keydown', onKey); return; }
      if(el.classList.contains('under')) return;              /* another screen is on top */
      if(/input|textarea|select/i.test((e.target && e.target.tagName) || '')) return;
      const k = e.key.toLowerCase();
      if((k === 'z' && !e.ctrlKey && !e.metaKey) || k === 'backspace' || ((e.ctrlKey || e.metaKey) && k === 'z')){
        e.preventDefault(); return doUndo();
      }
      if(!cur) return;
      if(/^[1-9]$/.test(k) && folders[+k - 1]){ e.preventDefault(); return file(folders[+k - 1].id); }
      if(k === 'k'){ e.preventDefault(); return commit('keep', () => {}); }
      if(k === 's' || k === 'arrowright'){ e.preventDefault(); return skip(); }
      if(k === 'd' || k === 'delete'){ e.preventDefault(); return commit('del'); }
    }
    document.addEventListener('keydown', onKey);

    render();
  }

  (function css(){
    if(document.getElementById('qs-css')) return;
    const st = document.createElement('style');
    st.id = 'qs-css';
    st.textContent = `
    .qs-prog{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:13px;color:var(--muted)}
    .qs-prog i{flex:1;height:5px;border-radius:3px;background:var(--surface-2);overflow:hidden;display:block}
    .qs-prog b{display:block;height:100%;background:var(--orange-grad, var(--orange));transition:width .25s}
    .qs-prev{margin:0 auto 10px;border-radius:var(--r);overflow:hidden;background:#000;border:1px solid #2B2822}
    .qs-prev .embed{margin:0;border-radius:0}
    .qs-cover{display:block;padding-top:125%;background-size:cover;background-position:center;background-color:#221F1A}
    .qs-meta{display:flex;align-items:center;gap:10px;margin:0 0 12px}
    .qs-meta .tg{flex:none}
    .qs-t{flex:1;min-width:0;display:flex;flex-direction:column}
    .qs-t b{font-size:15px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .qs-t small{font-size:12.5px;color:var(--muted)}
    .qs-folders{display:flex;flex-wrap:wrap;gap:8px}
    .qs-f{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 13px;border:1px solid var(--line);
      border-radius:var(--r);background:var(--surface-2);color:var(--cream);font-size:15px;cursor:pointer;
      -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation}
    .qs-f:active{transform:scale(.97)}
    .qs-f[aria-pressed="true"]{border-color:var(--orange);background:rgba(251,105,0,.16)}
    .qs-f kbd{font:600 11px/1 ui-monospace,monospace;color:var(--dim, var(--muted));border:1px solid var(--line);
      border-radius:4px;padding:2px 4px}
    .qs-new{border-style:dashed;background:none;color:var(--muted)}
    .qs-hint{margin:8px 0 14px;font-size:12.5px;color:var(--muted)}
    .qs-acts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;position:sticky;bottom:0;padding:8px 0 4px;
      background:var(--bg)}
    .qs-acts button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-height:48px;
      border:1px solid var(--line);border-radius:var(--r);background:none;color:var(--cream);font-size:14.5px;cursor:pointer}
    .qs-acts button small{font-size:11px;color:var(--muted)}
    .qs-acts button:disabled{opacity:.35}
    .qs-acts .qs-del{color:var(--red);border-color:rgba(226,86,74,.4)}`;
    document.head.appendChild(st);
  })();

  Screens.register('swipe-sort', mount);
})();
