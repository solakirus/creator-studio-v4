/* Swipe file — a gallery of things worth stealing the structure of. */
(function(){
  const { ICON, slug } = U;

  const SOURCES = {
    reel:{ n:'IG Reel', c:'#E1477E' }, carousel:{ n:'IG Carousel', c:'#A855F7' },
    story:{ n:'IG Story', c:'#F59E0B' }, tiktok:{ n:'TikTok', c:'#22C7B8' },
    ytshort:{ n:'YT Short', c:'#E2564A' }, ytlong:{ n:'YT Long-form', c:'#FB6900' },
    x:{ n:'X / Twitter', c:'#9AA0A6' }, linkedin:{ n:'LinkedIn', c:'#3B82F6' },
    newsletter:{ n:'Newsletter', c:'#5BBE6A' }, facebook:{ n:'Facebook', c:'#4B8BF5' }
  };
  const SHORT = { reel:'REEL', carousel:'CARO', story:'STORY', tiktok:'TT', ytshort:'YTS',
                  ytlong:'YT', x:'X', linkedin:'LI', newsletter:'NL', facebook:'FB' };
  const INTENTS = ['Education','Entertainment','Story','Promo','Inspiration'];
  let CHANNELS = [];
  async function loadChannels(){ CHANNELS = await Channels.all(); }

  let thumbs = {};
  let autoCovers = false;   /* the background cover fetch runs once per session */

  /* YouTube is the only platform whose cover image we can derive from the link. */
  function ytId(url){
    const m = String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  function detectSource(url){
    const u = String(url).toLowerCase();
    if(u.includes('tiktok')) return 'tiktok';
    if(u.includes('youtube') || u.includes('youtu.be')) return u.includes('shorts') ? 'ytshort' : 'ytlong';
    if(u.includes('instagram')) return 'reel';
    if(u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook';
    if(u.includes('linkedin')) return 'linkedin';
    if(u.includes('twitter') || u.includes('x.com')) return 'x';
    return 'reel';
  }
  /* Instagram publishes no thumbnail URL, but it does allow its own embed view,
     so a single swipe can show the post itself when there's no custom cover. */
  function igId(url){
    const m = String(url || '').match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
    return m ? m[1] : null;
  }
  /* Grid previews for Instagram swipes with no cover. The embed is drawn at
     Instagram's minimum width, shifted up past its header and scaled to the
     card, so the 4:5 post frame fills the 4:5 thumb. Each loads only when its
     card scrolls near the screen, and taps pass through to the card. */
  const IG_W = 326, IG_HEAD = 50, IG_MEDIA = 408, IG_FOOT = 90;
  let igObserver = null;
  function mountIgEmbed(thumb){
    const id = thumb.dataset.ig;
    if(!id || thumb.querySelector('.igclip')) return;
    const W = thumb.clientWidth, H = thumb.clientHeight || W * 1.25;
    /* Instagram letterboxes a 9:16 reel inside its 4:5 frame. For reels, zoom in
       until the video fills the card edge to edge (a centre crop, like the
       YouTube covers); other posts are fitted to the card as-is. */
    const zoom = thumb.dataset.igReel ? IG_W / (IG_MEDIA * 9 / 16) : 1;
    const S = (W / IG_W) * zoom;
    const tx = W / 2 - S * IG_W / 2;
    const ty = H / 2 - S * (IG_HEAD + IG_MEDIA / 2);
    const clip = document.createElement('span');
    clip.className = 'igclip';
    clip.style.cssText = 'position:absolute;inset:0;overflow:hidden;display:block;pointer-events:none;background:#000';
    const f = document.createElement('iframe');
    f.src = `https://www.instagram.com/p/${id}/embed/`;
    f.title = 'Instagram post';
    f.setAttribute('scrolling', 'no');
    f.setAttribute('tabindex', '-1');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = `position:absolute;left:0;top:0;width:${IG_W}px;
      height:${IG_HEAD + IG_MEDIA + IG_FOOT}px;border:0;pointer-events:none;background:#000;
      transform-origin:0 0;transform:translate(${tx}px,${ty}px) scale(${S})`;
    clip.appendChild(f);
    thumb.prepend(clip);
  }
  function wireIgEmbeds(root){
    if(igObserver) igObserver.disconnect();
    const cards = root.querySelectorAll('.thumb[data-ig]');
    if(!cards.length) return;
    if(!('IntersectionObserver' in window)){ cards.forEach(mountIgEmbed); return; }
    igObserver = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if(!en.isIntersecting) return;
        mountIgEmbed(en.target);
        igObserver.unobserve(en.target);
      });
    }, { rootMargin:'300px 0px' });
    cards.forEach(c => igObserver.observe(c));
  }

  function coverFor(s){
    if(thumbs[s.id]) return `url(${thumbs[s.id]})`;
    /* fetched from the platform and kept on the record */
    /* single quotes: this lands inside a double-quoted style="" attribute */
    if(s.imageUrl) return `url('${String(s.imageUrl).replace(/'/g, '%27').replace(/"/g, '%22')}')`;
    /* YouTube gives its poster away in the url — an image, so no permission
       is needed to show it and no embed is worth the weight */
    const poster = window.Embed ? Embed.poster(s.url) : null;
    if(poster) return `url(${poster})`;
    return U.generatedArt(s.id, s.title || '?', 300, 375);
  }
  async function loadThumbs(){
    try {
      const blobs = await Store.allMap('swipe-thumb');
      Object.values(thumbs).forEach(URL.revokeObjectURL);
      thumbs = {};
      Object.entries(blobs).forEach(([k,b]) => thumbs[k] = URL.createObjectURL(b));
    } catch(e){ console.warn('Swipe thumbs unavailable', e); }
  }

  /* ---------- fill in title, creator and cover from the link itself ---------- */
  /* Titles the app made up, which a real one should replace. */
  function needsTitle(s){
    const t = (s.title || '').trim();
    return !t || /^untitled swipe$/i.test(t) ||
      (/Facebook collection:/.test(s.why || '') && /\s(reel|video|post)$/i.test(t));
  }
  const needsCover = s => !!s.url && !thumbs[s.id] && !ytId(s.url);
  const needsDetails = s => needsTitle(s) || needsCover(s) || !(s.author || /Creator:/i.test(s.why || ''));

  async function enrich(s){
    if(!window.LinkMeta || !s || !s.url) return false;
    const m = await LinkMeta.get(s.url);
    let changed = false;
    /* TikTok short links become the full link, which also makes previews possible later */
    if(m.finalUrl && m.finalUrl !== s.url && /vm\.tiktok|vt\.tiktok|tiktok\.com\/t\/|tiktokv\.com\//i.test(s.url)){
      s.url = m.finalUrl; s.source = detectSource(s.url); changed = true;
    }
    if(m.title && needsTitle(s)){ s.title = m.title; changed = true; }
    /* the fields the rest of the app already reads for a swipe's creator and cover */
    if(m.author && !s.author){ s.author = m.author; changed = true; }
    if(m.image && !s.imageUrl){ s.imageUrl = m.image; changed = true; }
    if(m.author && !/Creator:/i.test(s.why || '')){
      s.why = [s.why, `Creator: ${m.author}${m.authorUrl ? ' ' + m.authorUrl : ''}`].filter(Boolean).join(' | ');
      changed = true;
    }
    if(changed) await Store.put('swipes', s);
    if(m.image && needsCover(s)){
      const b = await LinkMeta.getImage(m.image);
      if(b && b.size > 2000){
        await Store.put('swipe-thumb', b, s.id);
        thumbs[s.id] = URL.createObjectURL(b);
        changed = true;
      }
    }
    return changed;
  }

  /* One fetch at a time with a short pause, so the sites don't start refusing.
     It keeps going if you leave the Swipe tab. */
  const fetchQ = { list:[], done:0, total:0, got:0, running:false, stop:false, onTick:null, onEnd:null };
  function queueFetch(ids, onTick, onEnd){
    ids.forEach(id => { if(!fetchQ.list.includes(id)){ fetchQ.list.push(id); fetchQ.total++; } });
    fetchQ.onTick = onTick; fetchQ.onEnd = onEnd;
    runQueue();
  }
  async function runQueue(){
    if(fetchQ.running) return;
    fetchQ.running = true; fetchQ.stop = false;
    while(fetchQ.list.length && !fetchQ.stop){
      const id = fetchQ.list.shift();
      try { const rec = await Store.get('swipes', id); if(await enrich(rec)) fetchQ.got++; } catch(e){}
      fetchQ.done++;
      fetchQ.onTick && fetchQ.onTick();
      await new Promise(r => setTimeout(r, 600));
    }
    const got = fetchQ.got, done = fetchQ.done;
    Object.assign(fetchQ, { list:[], done:0, total:0, got:0, running:false });
    U.toast(done ? `Details found for ${got} of ${done} swipe${done === 1 ? '' : 's'}` : 'Stopped');
    fetchQ.onEnd && fetchQ.onEnd();
  }
  const fetchBarText = () => `Fetching details · ${fetchQ.done}/${fetchQ.total}`;

  const all = async () => {
    const { values } = await Store.all('swipes');
    return values.sort((a,b) => b.createdAt - a.createdAt);
  };
  const uid = () => 'sw_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  const lastFilter = { f:null, viewId:null };
  let oldOpen = false;   /* the folded old fields on a swipe stay as you left them */
  document.addEventListener('toggle', e => { if(e.target.classList && e.target.classList.contains('stg-old')) oldOpen = e.target.open; }, true);

  /* ---------- your tags (swipetags.js) ---------- */
  const escT = t => U.esc(t);
  /* tag many swipes at once: a tag on all of them is taken off all of them */
  async function tagSheet(ids, done){
    const draw = async sh => {
      const groups = await SwipeTags.all();
      const recs = (await Promise.all(ids.map(id => Store.get('swipes', id)))).filter(Boolean);
      const state = t => { const n = recs.filter(s => (s.tagIds || []).includes(t.id)).length; return n === recs.length && n ? 'all' : n ? 'some' : 'none'; };
      sh.innerHTML = `<h2>Sort ${recs.length} swipe${recs.length === 1 ? '' : 's'}</h2>
        <p class="hintline" style="margin:0 0 12px">Tap an option to put it on all of them; tap again to take it off.</p>
        ${groups.map(g => `<div class="field"><label>${escT(g.name)}</label><div class="opts" style="flex-wrap:wrap">
          ${g.tags.map(t => { const st = state(t); return `<button type="button" class="opt" data-bt="${t.id}" data-st="${st}" aria-pressed="${st === 'all'}"
            ${st === 'some' ? 'style="border-style:dashed"' : ''}><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.color};margin-right:7px"></span>${escT(t.name)}${st === 'some' ? ' · some' : ''}</button>`; }).join('')}
        </div></div>`).join('')}
        <div class="sheetcta"><button class="btn-primary" data-btdone>Done</button>
          <button class="btn-ghost" data-btedit>Edit filters</button></div>`;
    };
    App.sheet('', sh => {
      draw(sh);
      sh.addEventListener('click', async e => {
        const b = e.target.closest('[data-bt]');
        if(b){ await SwipeTags.apply(ids, b.dataset.bt, b.dataset.st !== 'all'); return draw(sh); }
        if(e.target.closest('[data-btedit]')){ App.closeSheet(); return editTags(() => tagSheet(ids, done)); }
        if(e.target.closest('[data-btdone]')){ App.closeSheet(); done && done(); }
      });
    });
  }

  /* add, rename, recolour and remove your groups and tags */
  async function editTags(after){
    const draw = async sh => {
      const groups = await SwipeTags.all(), bi = await SwipeTags.builtins();
      sh.innerHTML = `<h2>Edit filters</h2>
        <p class="hintline" style="margin:0 0 12px">Each of these is a dropdown in your swipe file, and its options are what
          you pick on a swipe. Rename by typing; tap a dot to change its colour. Removing an option takes it off every swipe.</p>
        ${groups.map(g => `<div class="block stg-group" style="margin:0 0 12px">
          <div style="display:flex;gap:8px;align-items:center;margin:0 0 8px">
            <input class="stg-in" data-gname="${g.id}" value="${escT(g.name)}" aria-label="Filter name" style="flex:1;font-weight:700">
            <button class="btn-sm" data-gdel="${g.id}" style="color:var(--red)" aria-label="Delete the filter ${escT(g.name)}">Delete</button>
          </div>
          ${g.tags.map(t => `<div style="display:flex;gap:8px;align-items:center;margin:0 0 6px">
            <button class="stg-dot" data-tcolor="${t.id}" style="background:${t.color}" aria-label="Change colour"></button>
            <input class="stg-in" data-tname="${t.id}" value="${escT(t.name)}" aria-label="Option name" style="flex:1">
            <button class="btn-sm" data-tdel="${t.id}" aria-label="Remove ${escT(t.name)}">✕</button></div>`).join('')}
          <div style="display:flex;gap:8px;margin-top:6px">
            <input class="stg-in" data-tnew="${g.id}" placeholder="+ Add an option to ${escT(g.name)}" style="flex:1">
            <button class="btn-sm" data-tadd="${g.id}">Add</button></div>
        </div>`).join('')}
        <div style="display:flex;gap:8px;margin:4px 0 12px">
          <input class="stg-in" id="stg-newgroup" placeholder="+ New filter — e.g. Hook type, Topic, Energy" style="flex:1">
          <button class="btn-sm accent" data-gadd>Add filter</button></div>
        <h4 style="margin:18px 0 4px">Built-in filters</h4>
        <p class="hintline" style="margin:0 0 8px">Read from what's already on each swipe. Switch on the ones you want as dropdowns.</p>
        ${SwipeTags.BUILTINS.map(x => `<label class="stg-bi"><input type="checkbox" data-bi="${x.k}"${bi[x.k] ? ' checked' : ''}> ${escT(x.label)}</label>`).join('')}
        <div class="sheetcta" style="margin-top:14px"><button class="btn-primary" data-tdone>Done</button></div>`;
    };
    App.sheet('', sh => {
      draw(sh);
      const addTagFrom = async gid => {
        const inp = sh.querySelector(`[data-tnew="${gid}"]`);
        if(inp && inp.value.trim()){ await SwipeTags.addTag(gid, inp.value); await draw(sh); const again = sh.querySelector(`[data-tnew="${gid}"]`); if(again) again.focus(); }
      };
      const addGroupFrom = async () => {
        const inp = sh.querySelector('#stg-newgroup');
        if(inp && inp.value.trim()){ await SwipeTags.addGroup(inp.value); await draw(sh); }
      };
      sh.addEventListener('click', async e => {
        const b = e.target.closest('button'); if(!b) return;
        if(b.dataset.tcolor){
          const t = (await SwipeTags.byId())[b.dataset.tcolor]; if(!t) return;
          const C = SwipeTags.COLORS; await SwipeTags.editTag(t.tag.id, { color: C[(C.indexOf(t.tag.color) + 1) % C.length] });
          return draw(sh);
        }
        if(b.dataset.tdel){
          const t = (await SwipeTags.byId())[b.dataset.tdel];
          if(t && !confirm(`Remove “${t.tag.name}”? It comes off every swipe that has it.`)) return;
          await SwipeTags.removeTag(b.dataset.tdel); return draw(sh);
        }
        if(b.dataset.gdel){
          const g = (await SwipeTags.all()).find(x => x.id === b.dataset.gdel);
          if(g && !confirm(`Delete the filter “${g.name}” and its ${g.tags.length} option${g.tags.length === 1 ? '' : 's'}? Your swipes stay.`)) return;
          await SwipeTags.removeGroup(b.dataset.gdel); return draw(sh);
        }
        if(b.dataset.tadd) return addTagFrom(b.dataset.tadd);
        if(b.hasAttribute('data-gadd')) return addGroupFrom();
        if(b.hasAttribute('data-tdone')){ App.closeSheet(); after && after(); }
      });
      sh.addEventListener('keydown', e => {
        if(e.key !== 'Enter') return;
        if(e.target.dataset.tnew){ e.preventDefault(); addTagFrom(e.target.dataset.tnew); }
        else if(e.target.id === 'stg-newgroup'){ e.preventDefault(); addGroupFrom(); }
        else if(e.target.classList.contains('stg-in')) e.target.blur();
      });
      /* renames save when you leave the box */
      sh.addEventListener('change', async e => {
        const t = e.target;
        if(t.dataset.gname && t.value.trim()) await SwipeTags.renameGroup(t.dataset.gname, t.value);
        if(t.dataset.tname && t.value.trim()) await SwipeTags.editTag(t.dataset.tname, { name: t.value.trim() });
        if(t.dataset.bi) await SwipeTags.setBuiltin(t.dataset.bi, t.checked);
      });
    });
  }

  async function entryTagsHTML(s){
    if(!window.SwipeTags) return '';
    const groups = await SwipeTags.all();
    return `<div class="block">
      <div style="display:flex;align-items:center;gap:8px;margin:0 0 8px"><h4 style="margin:0;flex:1">Sort it</h4>
        <button class="btn-sm" data-a="edittags">Edit filters</button></div>
      ${groups.map(g => `<p class="hintline" style="margin:8px 0 6px">${escT(g.name)}</p><div class="opts" style="flex-wrap:wrap">
        ${g.tags.map(t => `<button class="opt" data-stag="${t.id}" aria-pressed="${(s.tagIds || []).includes(t.id)}"><span
          style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.color};margin-right:7px"></span>${escT(t.name)}</button>`).join('')
          || '<span class="hintline">No options yet</span>'}</div>`).join('')
        || '<p class="hintline" style="margin:0">No filters of your own yet — Edit filters to make some.</p>'}
    </div>`;
  }

  /* ---------- gallery ---------- */
  async function mountList(el, params){
    /* hosted in the Content tab there is already a heading and a nav above */
    const embedded = !!(params && params.embedded);
    let q = '';
    /* your filters (swipetags.js), kept while the app is open */
    let f = lastFilter.f || (window.SwipeTags ? SwipeTags.blank() : null), viewId = lastFilter.viewId || null;
    if(f && window.SwipeTags) f = SwipeTags.norm(f);
    const remember = () => { lastFilter.f = f; lastFilter.viewId = viewId; };
    /* 'all' is the grid as it always was; 'folders' is the folder tiles; a
       folder id (or '__none') is one folder open */
    let view = (params && params.folder) || 'all';
    const esc = s => U.esc(s);   /* shared: util.js */
    const inFolder = () => view !== 'all' && view !== 'folders' && view !== 'inbox';
    const inInbox = () => view === 'inbox';

    async function render(){
      const folders = window.SwipeFolders ? await SwipeFolders.sorted() : [];
      if(inFolder() && view !== '__none' && !folders.some(f => f.id === view)) view = 'folders';
      if(view === 'folders') return renderFolders(folders);
      const everything = await all();
      const inboxN = everything.filter(x => x.inbox).length;
      const tmap = window.SwipeTags ? await SwipeTags.byId() : {};
      const svs = window.SwipeTags ? await SwipeTags.views() : [];
      const groups = window.SwipeTags ? await SwipeTags.all() : [];
      const bi = window.SwipeTags ? await SwipeTags.builtins() : {};
      const fids = new Set(folders.map(x => x.id));
      const tagWords = s => (s.tagIds || []).map(id => tmap[id] ? tmap[id].tag.name : '').join(' ');
      const rows = everything.filter(s =>
        (!inInbox() || s.inbox) &&
        (!inFolder() || (view === '__none'
          ? !(s.folders || []).some(id => folders.some(f => f.id === id))
          : (s.folders || []).includes(view))) &&
        (!q || (s.title + ' ' + (s.hook||'') + ' ' + (s.myAngle||'') + ' ' + (s.author||'') + ' ' + tagWords(s)).toLowerCase().includes(q)) &&
        (!window.SwipeTags || SwipeTags.matches(s, f, fids)));

      /* Icon-only actions keep the header on one line without truncating the title. */
      const IC_IMPORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg>`;
      const IC_LINK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>`;
      const ACTS = `${window.ViewAs ? ViewAs.picker('swipe') : ''}<button class="iconbtn" data-a="import" aria-label="Import" title="Import your saves or a CSV"
                   style="width:34px;height:34px;color:var(--cream)">${IC_IMPORT}</button>
                 <button class="iconbtn" data-a="paste" aria-label="Add links" title="Add links"
                   style="width:34px;height:34px;background:var(--orange-grad);border:0;color:#fff">${IC_LINK}</button>`;
      el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Creator studio', title:'Swipe file', actions:ACTS })) + `
      <div class="view">
        ${embedded ? `<div class="pagehead"><h1 class="page-title">Swipe file</h1>
          <span class="headacts" style="display:flex;gap:8px;align-items:center">
            ${ACTS}
          </span></div>` : ''}
        ${viewSwitch(inboxN)}
        ${inInbox() ? inboxHead(rows) : ''}
        ${inFolder() ? (() => {
          const f = folders.find(x => x.id === view);
          return `<div class="fd-head">
            <button class="fd-back" data-view="folders" aria-label="All folders">‹ Folders</button>
            <h2>${f ? `${esc(f.emoji || '📁')} ${esc(f.name)}` : 'Not in a folder'}</h2>
            ${f ? `<button class="btn-sm" data-a="editfolder">Edit</button>` : ''}
          </div>`;
        })() : ''}
        <div class="filterwrap">
          <input class="wide" id="q" type="text" placeholder="${inFolder() ? 'Search this folder…' : inInbox() ? 'Search the Inbox — a creator, a word…' : 'Search swipes…'}" value="${esc(q)}">
          ${window.SwipeTags ? filterSelects(groups, bi) : ''}
        </div>
        ${window.SwipeTags ? filterLinks(svs) : ''}

        ${(() => {
          /* the same video saved twice (two devices, two imports): swipekey.js */
          const dbl = window.SwipeKey ? SwipeKey.doubles(everything) : [];
          const extra = dbl.reduce((n, g) => n + g.length - 1, 0);
          return extra ? `<div class="metaline" style="justify-content:space-between;align-items:center;
            margin:0 0 12px;padding:9px 12px;border:1px solid var(--amber);border-radius:var(--r)">
            <span style="font-size:13.5px">${extra} swipe${extra === 1 ? ' is' : 's are'} in here twice
              <small style="display:block;color:var(--muted)">Merging keeps one of each, with every folder, note and cover from both</small></span>
            <button class="btn-sm accent" data-a="mergedoubles">Merge doubles</button></div>` : '';
        })()}
        ${fetchQ.running ? `<div class="metaline" style="justify-content:space-between;align-items:center;
          margin:0 0 12px;padding:9px 12px;border:1px solid #2B2822;border-radius:var(--r)">
          <span id="fetchbar" style="font-size:13.5px;color:var(--muted)">${fetchBarText()}</span>
          <button class="btn-sm" data-a="stopfetch">Stop</button></div>` : ''}

        ${rows.length ? `<div class="swipegrid ${window.ViewAs ? ViewAs.cls('swipe') : ''}" data-lay-host="swipe">${rows.map(s => {
          const so = SOURCES[s.source] || SOURCES.reel;
          return `<button class="swipecard" data-open="${s.id}">
            <!-- Still pictures only. A live TikTok / Instagram / Facebook player
                 here caught the finger on Android, so the grid could only be
                 scrolled from its edges. The player is on the swipe itself. -->
            <span class="thumb" style="background-image:${coverFor(s)};overflow:hidden">
              <span class="src" style="color:${so.c}">${SHORT[s.source] || 'REEL'}</span>
              <!-- the play badge opens the video itself: looking at the thing
                   is the point of a swipe file, and it was three taps away -->
              ${s.url ? `<span class="play" data-watch="${s.url.replace(/"/g,'&quot;')}"
                role="button" aria-label="Watch it"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg></span>` : ''}
              ${!s.myAngle ? `<span class="noangle">No angle yet</span>` : ''}
            </span>
            <span class="tx">
              <h3>${esc(s.title && !/^untitled swipe$/i.test(s.title) ? s.title : (s.author ? '@' + s.author : 'Untitled swipe'))}</h3>
              <span class="mini-tags">
                ${(s.tagIds || []).map(id => tmap[id]).filter(Boolean).slice(0, 3).map(x =>
                  `<span class="mt" style="color:${x.tag.color}">${esc(x.tag.name)}</span>`).join('')}
              </span>
            </span>
          </button>`;
        }).join('')}</div>`
        : inInbox() ? `<div class="empty"><b>${q ? 'Nothing in the Inbox matches' : 'Inbox zero'}</b>${q ? 'Try a different word.' :
            'New saves land here until they are in a folder. Import your saves from Instagram, Facebook and TikTok with the file button up top.'}</div>`
        : inFolder() ? `<div class="empty"><b>Nothing in here yet</b>Hold swipes in All and tap <b>+ Folder</b>,
            or paste links straight into this folder.</div>`
        : `<div class="empty"><b>Nothing saved yet</b>Paste a link and break down why it worked while it's fresh.</div>`}

        <p class="note">${rows.length} entr${rows.length===1?'y':'ies'} · YouTube covers load automatically and Instagram posts show a live preview. Add your own cover from the entry for anything else.</p>
      </div>`;
      wireIgEmbeds(el);
      /* typing in the search re-renders; keep the cursor in the box */
      if(keepFocus){ const qi = el.querySelector('#q'); if(qi){ qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); } }
    }
    let keepFocus = false;

    /* the dropdowns: one per filter you made (swipetags.js), then the
       built-in ones you've switched on in Edit filters */
    function filterSelects(groups, bi){
      const sel = (attr, v, cur, first, opts) => `<select ${attr}="${v}"${cur ? ' class="on"' : ''}><option value="">${esc(first)}</option>
        ${opts.map(([k, l]) => `<option value="${esc(k)}"${cur === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      return groups.map(g => sel('data-fg', g.id, (f.sel || {})[g.id] || '', g.name, g.tags.map(t => [t.id, t.name]))).join('') +
        (bi.src ? sel('data-fb', 'src', f.src, 'Any source', Object.entries(SOURCES).map(([k, v]) => [k, v.n])) : '') +
        (bi.angle ? sel('data-fb', 'angle', f.angle, 'Any angle', [['none', 'No angle yet'], ['has', 'Has my angle']]) : '') +
        (bi.when ? sel('data-fb', 'when', f.when, 'Saved any time', Object.entries(SwipeTags.WHEN).map(([k, v]) => [k, v[0]])) : '') +
        (bi.folder ? sel('data-fb', 'folder', f.nofolder ? 'none' : '', 'In a folder or not', [['none', 'Not in a folder yet']]) : '') +
        (bi.intent ? sel('data-fb', 'intent', f.intent, 'All intents', INTENTS.map(i => [i, i])) : '') +
        (bi.channel ? sel('data-fb', 'channel', f.channel, 'Any channel', CHANNELS.map(c => [c.n, c.n])) : '') +
        (bi.target ? sel('data-fb', 'target', f.target, 'Any target', Object.entries(SOURCES).map(([k, v]) => [k, v.n])) : '');
    }
    /* saved views, and what you can do with the filters as they are */
    function filterLinks(svs){
      const on = SwipeTags.active(f);
      return `<div class="stg-bar">
          ${svs.length ? `<button class="pill" data-sv="" aria-pressed="${!viewId && !on}">All</button>
            ${svs.map(v => `<button class="pill" data-sv="${v.id}" aria-pressed="${viewId === v.id}">${esc(v.name)}</button>`).join('')}` : ''}
          <span class="stg-links">
            ${on ? `<button class="stg-link" data-a="clearf">Clear</button>` : ''}
            ${on && !viewId ? `<button class="stg-link" data-a="saveview">Save as a view</button>` : ''}
            ${viewId ? `<button class="stg-link" data-a="delview">Delete this view</button>` : ''}
            <button class="stg-link" data-a="editfilters">Edit filters</button>
          </span>
        </div>`;
    }

    function viewSwitch(inboxN){
      if(!window.SwipeFolders) return '';
      return `<div class="segmented" role="tablist" style="margin:0 0 12px">
        <button role="tab" data-view="all" aria-selected="${view === 'all'}">All</button>
        <button role="tab" data-view="inbox" aria-selected="${view === 'inbox'}">Inbox${inboxN ? ` <span class="ib-n">${inboxN}</span>` : ''}</button>
        <button role="tab" data-view="folders" aria-selected="${view !== 'all' && view !== 'inbox'}">Folders</button>
      </div>`;
    }

    /* the Inbox: one-at-a-time sorting, or everything a search found at once */
    function inboxHead(rows){
      if(!rows.length) return '';
      return `<div class="ib-head">
        ${q ? '' : `<button class="btn-primary" data-a="quicksort" style="width:100%">Quick sort ${rows.length}
          <small>one at a time · tap a folder and the next one comes up</small></button>`}
        ${q ? `<button class="btn-primary" data-a="fileall" style="width:100%">Put all ${rows.length} in a folder</button>` : ''}
      </div>`;
    }

    /* the folder tiles: a 2×2 of covers from inside, the name, how many */
    async function renderFolders(folders){
      const box = await SwipeFolders.contents();
      const inboxN = (await all()).filter(x => x.inbox).length;
      const mosaic = list => `<span class="fd-mosaic">${[0,1,2,3].map(i => list[i]
        ? `<i style="background-image:${coverFor(list[i])}"></i>` : '<i class="blank"></i>').join('')}</span>`;
      const tile = (id, emoji, name, list, pinned) => `<button class="fd-tile" data-view="${id}">
        ${mosaic(list)}
        <span class="fd-name">${esc(emoji)} ${esc(name)}${pinned ? ' <em>📌</em>' : ''}</span>
        <span class="fd-n">${list.length} swipe${list.length === 1 ? '' : 's'}</span></button>`;
      el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Creator studio', title:'Swipe file' })) + `
      <div class="view">
        ${embedded ? `<div class="pagehead"><h1 class="page-title">Swipe file</h1></div>` : ''}
        ${viewSwitch(inboxN)}
        <div class="fd-grid">
          ${folders.map(f => tile(f.id, f.emoji || '📁', f.name, box[f.id] || [], f.pinned)).join('')}
          ${box.__none.length ? tile('__none', '🗂️', 'Not in a folder', box.__none, false) : ''}
          <button class="fd-tile fd-new" data-a="newfolder"><span class="fd-mosaic plus">+</span>
            <span class="fd-name">New folder</span><span class="fd-n">Back pain, study, crafts…</span></button>
        </div>
        ${folders.length ? '' : `<p class="note" style="text-align:left;margin-top:14px">Folders are for keeping
          things together — a folder for back pain, one for studying with your daughter, one for crafts.
          A swipe can be in more than one.</p>`}
      </div>`;
    }

    /* name, emoji, and whether it's pinned to the top */
    function folderSheet(f, after){
      const isNew = !f;
      const cur = f || { name:'', emoji:'📁', pinned:false };
      App.sheet(`<h2>${isNew ? 'New folder' : 'Edit folder'}</h2>
        <div class="field"><label for="fd-name">Name</label>
          <input id="fd-name" type="text" value="${esc(cur.name)}" placeholder="Back pain" autocomplete="off"></div>
        <div class="field"><label>Icon</label>
          <div class="fd-emoji">${SwipeFolders.EMOJI.map(e2 => `<button type="button" data-emo="${e2}"
            aria-pressed="${cur.emoji === e2}">${e2}</button>`).join('')}</div></div>
        ${isNew ? '' : `<label style="display:flex;align-items:center;gap:10px;margin:0 0 14px;font-size:15px">
          <input type="checkbox" id="fd-pin" ${cur.pinned ? 'checked' : ''} style="width:20px;height:20px"> Pin to the top</label>`}
        <div class="sheetcta"><button class="btn-primary" data-save>${isNew ? 'Create folder' : 'Save'}</button>
          <button class="btn-ghost" data-cancel>Cancel</button></div>
        ${isNew ? '' : `<button class="btn-ghost" data-del style="width:100%;margin-top:10px;color:var(--red);
          border-color:rgba(226,86,74,.4)">Delete folder</button>
          <p class="hintline" style="margin:6px 0 0">The swipes in it stay in your swipe file.</p>`}`, sh => {
        let emoji = cur.emoji || '📁';
        sh.addEventListener('click', async e => {
          const em = e.target.closest('[data-emo]');
          if(em){ emoji = em.dataset.emo; sh.querySelectorAll('[data-emo]').forEach(b =>
            b.setAttribute('aria-pressed', String(b === em))); return; }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-del]')){
            if(!confirm(`Delete the folder "${cur.name}"? The swipes in it stay.`)) return;
            await SwipeFolders.remove(f.id);
            App.closeSheet(); U.toast('Folder deleted');
            view = 'folders'; return render();
          }
          if(!e.target.closest('[data-save]')) return;
          const name = sh.querySelector('#fd-name').value.trim();
          if(!name) return U.toast('Name the folder first');
          let saved;
          if(isNew) saved = await SwipeFolders.create(name, emoji);
          else saved = await SwipeFolders.update(f.id, { name, emoji, pinned: sh.querySelector('#fd-pin').checked });
          App.closeSheet();
          if(after) return after(saved);
          render();
        });
        /* the sheet can be gone by the time this fires */
        setTimeout(() => { const f = sh.querySelector('#fd-name'); if(f) f.focus(); }, 180);
      });
    }

    /* which folder should these go into? */
    async function pickFolder(ids, done){
      const folders = await SwipeFolders.sorted();
      App.sheet(`<h2>Add ${ids.length} to a folder</h2>
        <div class="group compact" style="margin:0 0 12px;max-height:50vh;overflow:auto">
          ${folders.map(f => `<button class="row" data-pickf="${f.id}"><span class="lbl">${esc(f.emoji || '📁')} ${esc(f.name)}</span></button>`).join('')}
        </div>
        <div class="field" style="display:flex;gap:8px">
          <input id="pf-new" type="text" placeholder="Or a new folder…" autocomplete="off" style="flex:1">
          <button class="btn-sm accent" data-pfnew>Create</button></div>
        <div class="sheetcta"><button class="btn-ghost" data-cancel>Cancel</button></div>`, sh => {
        sh.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          let fid = null, fname = '';
          const b = e.target.closest('[data-pickf]');
          if(b){ fid = b.dataset.pickf; fname = (folders.find(x => x.id === fid) || {}).name; }
          if(e.target.closest('[data-pfnew]')){
            const n = sh.querySelector('#pf-new').value.trim();
            if(!n) return U.toast('Name the folder first');
            const f = await SwipeFolders.create(n, '📁'); fid = f.id; fname = f.name;
          }
          if(!fid) return;
          const n = await SwipeFolders.addTo(ids, fid);
          App.closeSheet();
          U.toast(n ? `Added ${n} to ${fname}` : `Already in ${fname}`);
          done && done();
        });
      });
    }

    async function openPaste(){
      const existing = await all();
      const missing = existing.filter(needsDetails);
      const pasteFolders = window.SwipeFolders ? await SwipeFolders.sorted() : [];
      const inApp = window.LinkMeta && LinkMeta.native();
      App.sheet(`
        <h2>Add links</h2>
        <div class="field"><label for="sw-urls">One link or a whole list</label>
          <textarea id="sw-urls" rows="5" placeholder="https://www.instagram.com/reel/…&#10;https://youtu.be/…&#10;https://vm.tiktok.com/…"></textarea></div>
        <p style="margin:0 0 14px;color:var(--muted);font-size:14px;line-height:1.55">
          Paste links any way you like — one per line, or copied straight out of a note. The title, creator and
          cover are fetched for each one${inApp ? '' : '. In a browser only YouTube can be read; in the app every platform works'}.
          Links already in your swipe file are skipped.</p>
        ${pasteFolders.length ? `<div class="field"><label for="sw-folder">Save into a folder</label>
          <select id="sw-folder"><option value="">No folder</option>
            ${pasteFolders.map(f => `<option value="${f.id}" ${view === f.id ? 'selected' : ''}>${esc(f.emoji || '📁')} ${esc(f.name)}</option>`).join('')}
          </select></div>` : ''}
        <div class="sheetcta">
          <button class="btn-primary" data-go>Add</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${missing.length ? `<button class="btn-ghost" data-fill style="width:100%;margin-top:10px">
          Fill in missing details for ${missing.length} swipe${missing.length === 1 ? '' : 's'}</button>
          <p style="margin:6px 0 0;color:var(--dim);font-size:12.5px;line-height:1.5">Titles, creators and covers
          wherever they're missing. Runs in the background — about a second per swipe.</p>` : ''}`, sheetEl => {
        const ta = sheetEl.querySelector('#sw-urls');
        const goBtn = sheetEl.querySelector('[data-go]');
        const found = () => [...new Set((ta.value.match(/https?:\/\/[^\s<>"'`]+/gi) || [])
          .map(u => cleanUrl(u.replace(/[),.;!?]+$/, ''))))];
        ta.addEventListener('input', () => {
          const n = found().length;
          goBtn.textContent = n > 1 ? `Add ${n} links` : 'Add';
        });
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-fill]')){
            App.closeSheet();
            queueFetch(missing.map(x => x.id), tick, render);
            return render();
          }
          if(!e.target.closest('[data-go]')) return;
          const urls = found();
          if(!urls.length) return U.toast("Couldn't find a link in that");
          const seen = new Set(existing.map(x => urlKey(x.url)).filter(Boolean));
          const recs = [];
          urls.forEach((url, i) => {
            const k = urlKey(url);
            if(seen.has(k)) return;
            seen.add(k);
            recs.push({ id:SwipeKey.idFor(url), url, source:detectSource(url), title:'Untitled swipe',
                        hook:'', beats:[], why:'', transferable:'', myAngle:'',
                        intent:'Education', channels:[], targets:[], createdAt:Date.now() - i });
          });
          const skipped = urls.length - recs.length;
          if(!recs.length) return U.toast(`Already in your swipe file`);
          const fsel = sheetEl.querySelector('#sw-folder');
          if(fsel && fsel.value) recs.forEach(r => { r.folders = [fsel.value]; });
          else recs.forEach(r => { r.inbox = true; });   /* not in a folder yet: it waits in the Inbox */
          for(const r of recs) await Store.put('swipes', r);
          App.closeSheet();

          /* one link: fetch it now, then open it so you can add the hook */
          if(recs.length === 1){
            U.toast('Fetching details…');
            await enrich(recs[0]);
            return Screens.push('swipe', { id:recs[0].id, onChange:render });
          }
          U.toast(`Added ${recs.length}${skipped ? ` · ${skipped} already in the file` : ''}`);
          queueFetch(recs.map(r => r.id), tick, render);
          render();
        });
        setTimeout(() => ta.focus(), 180);
      });
    }
    function openImportChooser(){
      App.sheet(`<h2>Import</h2>
        <div class="group compact" style="margin:0 0 12px">
          <button class="row" data-imp="saves"><span class="lbl">Your saves
            <small>Saved videos from Instagram, Facebook and TikTok — from their data download</small></span>${U.ICON.chevR}</button>
          <button class="row" data-imp="csv"><span class="lbl">A CSV file
            <small>One row per swipe, with your own columns</small></span>${U.ICON.chevR}</button>
        </div>
        <div class="sheetcta"><button class="btn-ghost" data-cancel>Cancel</button></div>`, sh => {
        sh.addEventListener('click', e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          const b = e.target.closest('[data-imp]');
          if(!b) return;
          App.closeSheet();
          setTimeout(() => b.dataset.imp === 'csv' ? openCsv(render)
            : openSavesImport(() => { view = 'inbox'; q = ''; render(); }, tick, render), 220);
        });
      });
    }

    function tick(){
      const bar = el.querySelector('#fetchbar');
      if(bar) bar.textContent = fetchBarText();
    }

    el.addEventListener('input', async e => {
      if(e.target.id === 'q'){ q = e.target.value.trim().toLowerCase(); keepFocus = true; await render(); keepFocus = false; return; }
    });
    el.addEventListener('change', e => {
      const id = e.target.id;
      const t = e.target;
      if(t.dataset.fg !== undefined || t.dataset.fb !== undefined){
        if(t.dataset.fg) f.sel = { ...(f.sel || {}), [t.dataset.fg]: t.value };
        else if(t.dataset.fb === 'folder') f.nofolder = t.value === 'none';
        else f[t.dataset.fb] = t.value;
        viewId = null; remember(); render();
      }
    });
    /* Hold one to pick several. The card is a button, so the guard in Select
       stops a tap from opening an entry while you are choosing. */
    if(window.Select) Select.enable(el, {
      itemSelector: '.swipecard',
      noun: 'swipe',
      idOf: n => n.dataset.open || null,
      warning: 'The entries go for good. Anything you wrote about them goes too.',
      extra: () => !window.SwipeFolders ? [] : [
        ...(window.SwipeTags ? [{ label:'Sort…', run: (ids, done) => tagSheet(ids, done) }] : []),
        { label:'+ Folder', run: (ids, done) => pickFolder(ids, done) },
        ...(inInbox() ? [{ label:'Sorted', run: async (ids, done) => {
          const n = await markSorted(ids);
          U.toast(`${n} out of the Inbox`); done();
        } }] : []),
        ...(inFolder() && view !== '__none' ? [{ label:'Remove', run: async (ids, done) => {
          const n = await SwipeFolders.removeFrom(ids, view);
          U.toast(`Removed ${n} from this folder`); done();
        } }] : [])
      ],
      onDelete: async ids => {
        for(const id of ids){
          try { await Store.del('swipes', id); } catch(err){}
          /* a cover you uploaded lives in its own store and would be orphaned */
          try { await Store.del('swipe-thumb', id); } catch(err){}
        }
      },
      onDone: async () => { await loadThumbs(); render(); }
    });

    el.addEventListener('click', async e => {
      const vw = e.target.closest('[data-view]');
      if(vw){ view = vw.dataset.view; q = ''; return render(); }
      const sv = e.target.closest('[data-sv]');
      if(sv && window.SwipeTags){
        const v = (await SwipeTags.views()).find(x => x.id === sv.dataset.sv);
        f = v ? SwipeTags.norm(v.f) : SwipeTags.blank(); viewId = v ? v.id : null;
        remember(); return render();
      }
      const a = e.target.closest('[data-a]');
      if(a && a.dataset.a === 'editfilters') return editTags(render);
      if(a && a.dataset.a === 'delview'){
        const v = (await SwipeTags.views()).find(x => x.id === viewId);
        if(v && confirm(`Delete the view “${v.name}”? Your swipes stay as they are.`)){ await SwipeTags.removeView(v.id); viewId = null; f = SwipeTags.blank(); remember(); }
        return render();
      }
      if(a && a.dataset.a === 'clearf'){ f = SwipeTags.blank(); viewId = null; remember(); return render(); }
      if(a && a.dataset.a === 'saveview'){
        const name = (prompt('Name this view — e.g. "Hooks with no angle"') || '').trim(); if(!name) return;
        const v = await SwipeTags.saveView(name, f); viewId = v.id; remember(); U.toast(`Saved “${name}”`); return render();
      }
      if(a && a.dataset.a === 'newfolder') return folderSheet(null, f => { view = f ? f.id : 'folders'; render(); });
      if(a && a.dataset.a === 'editfolder'){
        const f = window.SwipeFolders ? await SwipeFolders.get(view) : null;
        return f ? folderSheet(f) : null;
      }
      if(a && a.dataset.a === 'paste') return openPaste();
      if(a && a.dataset.a === 'stopfetch'){ fetchQ.stop = true; a.textContent = 'Stopping…'; return; }
      if(a && a.dataset.a === 'csv') return openCsv(render);
      if(a && a.dataset.a === 'import') return openImportChooser();
      if(a && a.dataset.a === 'mergedoubles'){
        a.disabled = true; a.textContent = 'Merging…';
        try {
          const r = await SwipeKey.mergeAll();
          await loadThumbs();
          U.toast(r.removed ? `Merged — ${r.removed} double${r.removed === 1 ? '' : 's'} folded into ${r.groups} swipe${r.groups === 1 ? '' : 's'}` : 'No doubles left');
        } catch(err){ console.error(err); U.toast("Couldn't merge — nothing was changed"); }
        return render();
      }
      if(a && a.dataset.a === 'quicksort') return Screens.push('swipe-sort', { onChange:render });
      if(a && a.dataset.a === 'fileall'){
        const ids = (await all()).filter(x => x.inbox &&
          (x.title + ' ' + (x.hook||'') + ' ' + (x.myAngle||'') + ' ' + (x.author||'')).toLowerCase().includes(q)).map(x => x.id);
        return pickFolder(ids, () => { q = ''; render(); });
      }
      if(e.target.closest('[data-a="covers"]')){
        /* Everything saved before this could fetch covers, and anything from a
           platform that was down at the time. One at a time rather than a
           hundred requests at once. */
        const untitled = x => !x.title || /^untitled/i.test(x.title);
        const rows = (await all()).filter(x => x.url && (!x.imageUrl || untitled(x)));
        if(!rows.length) return U.toast('Every one is named and covered');
        U.toast(`Looking at ${rows.length}…`);
        const n = await Thumb.backfill(rows, 'swipe-thumb',
          async r => { await Store.put('swipes', r); },
          { nameIf: untitled });
        await loadThumbs();
        render();
        if(n) return U.toast(`Updated ${n} of ${rows.length}`);

        /* Saying "none of them worked" and stopping is how you end up guessing.
           Say which wall you hit. */
        const reason = Thumb.why && Thumb.why();
        if(!Thumb.nativeHttp || !Thumb.nativeHttp()){
          return U.toast('Needs the installed app — a browser blocks these requests');
        }
        return U.toast(reason || 'None of those platforms would answer');
      }

      /* before the card, or tapping play would open the entry instead */
      const w2 = e.target.closest('[data-watch]');
      if(w2){
        e.stopPropagation();
        try { window.open(w2.dataset.watch, '_blank', 'noopener'); } catch(err){}
        return;
      }

      const o = e.target.closest('[data-open]');
      if(o) Screens.push('swipe', { id:o.dataset.open, onChange:render });
    });

    await loadThumbs();
    await loadChannels();
    render();
    /* Grid / Big / List (viewas.js): the Instagram previews are sized to the
       card when they load, so a new card size needs them drawn again */
    const onLayout = e => {
      if(!el.isConnected){ window.removeEventListener('cs-layout', onLayout); return; }
      if(e.detail && e.detail.key === 'swipe') render();
    };
    window.addEventListener('cs-layout', onLayout);

    /* Cards with no picture at all get one, quietly, on a device that can ask
       the platforms (the phone and Windows apps; a browser cannot). Once a
       session; the cover is saved and syncs to the other devices. */
    if(!autoCovers && window.LinkMeta && LinkMeta.native && LinkMeta.native()){
      autoCovers = true;
      const bare = (await all()).filter(s => s.url && !thumbs[s.id] && !s.imageUrl && !ytId(s.url));
      if(bare.length){ queueFetch(bare.map(s => s.id), tick, async () => { await loadThumbs(); render(); }); render(); }
    }
  }

  /* drop share-tracking tails (?igsh=, ?si=, ?mibextid=) so the same video
     always looks the same; YouTube keeps v and t */
  function cleanUrl(u){
    try {
      const p = new URL(u);
      const host = p.hostname.replace(/^(www\.|m\.)/, '');
      const v = p.searchParams.get('v');
      if(/^youtube\.com$/i.test(host) && v){
        const t = p.searchParams.get('t');
        return `https://www.youtube.com/watch?v=${v}${t ? '&t=' + t : ''}`;
      }
      if(/facebook\.com$/i.test(host) && v) return `https://www.facebook.com/watch/?v=${v}`;
      if(/instagram|tiktok|facebook|fb\.watch|youtu\.be|threads|x\.com|twitter/i.test(host)){
        p.search = ''; p.hash = '';
      }
      return p.toString();
    } catch(e){ return u; }
  }

  /* ---------- CSV import ---------- */
  /* Minimal RFC-4180 parse: handles quoted fields and embedded commas. */
  function parseCSV(text){
    const rows = [];
    let row = [], field = '', quoted = false;
    for(let i = 0; i < text.length; i++){
      const c = text[i];
      if(quoted){
        if(c === '"' && text[i+1] === '"'){ field += '"'; i++; }
        else if(c === '"') quoted = false;
        else field += c;
      } else if(c === '"') quoted = true;
      else if(c === ','){ row.push(field); field = ''; }
      else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
      else if(c !== '\r') field += c;
    }
    if(field || row.length){ row.push(field); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
  }

  /* Same video, however it was copied: tracking params and trailing slashes
     don't count, and every YouTube form collapses to its 11-char id. */
  function urlKey(url){ return SwipeKey.key(url); }   /* swipekey.js: the same on every device */

  function openCsv(after){
    App.sheet(`
      <h2>Import swipes</h2>
      <p style="margin:0 0 14px;color:var(--muted);font-size:14.5px;line-height:1.6">
        One row per swipe. A header row is expected. Recognised columns, in any order:</p>
      <p style="margin:0 0 16px;font-family:ui-monospace,monospace;font-size:12.5px;color:var(--cream);
        background:var(--bg);border:1px solid var(--line);border-radius:var(--r);padding:11px;line-height:1.7">
        title, url, source, hook, why, transferable, angle, intent, channels, targets</p>
      <p style="margin:0 0 16px;color:var(--muted);font-size:14px;line-height:1.6">
        <b style="color:var(--cream)">channels</b> and <b style="color:var(--cream)">targets</b> take several
        values separated by semicolons. Anything missing is left blank — source is guessed from the link.
        A link already in the swipe file is skipped, so importing the same file twice is safe.</p>
      <div class="field">
        <label for="csv-file">Choose a CSV file</label>
        <input id="csv-file" type="file">
      </div>
      <div class="field"><label for="csv-text">…or paste the CSV</label>
        <textarea id="csv-text" rows="6" placeholder="title,url,intent&#10;Mr2 tuesday,https://…,Education"></textarea></div>
      <div class="sheetcta">
        <button class="btn-primary" data-go>Import</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>`, sheetEl => {
      const fileIn = sheetEl.querySelector('#csv-file');
      const textIn = sheetEl.querySelector('#csv-text');
      const goBtn  = sheetEl.querySelector('[data-go]');
      let busy = false;

      /* Picking a file drops its contents into the box, so you can see what's coming in. */
      fileIn.addEventListener('change', async () => {
        const f = fileIn.files && fileIn.files[0];
        if(!f) return;
        /* No file-type filter on the picker: Android labels CSVs several ways
           and greys out any it doesn't match. Check the name here instead. */
        if(!/\.(csv|txt)$/i.test(f.name)) return U.toast('Pick a .csv file');
        try {
          textIn.value = (await f.text()).replace(/^\uFEFF/, '');
          const n = parseCSV(textIn.value.trim()).length - 1;
          U.toast(`${f.name}: ${Math.max(n,0)} row${n===1?'':'s'} ready`);
        } catch(err){ console.error(err); U.toast("Couldn't read that file"); }
      });

      sheetEl.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return busy ? null : App.closeSheet();
        if(!e.target.closest('[data-go]') || busy) return;

        const rows = parseCSV(textIn.value.trim());
        if(rows.length < 2) return U.toast('Needs a header row and at least one entry');

        busy = true;
        goBtn.disabled = true;
        const label = goBtn.textContent;

        try {
          const head = rows[0].map(h => h.trim().toLowerCase());
          const col = n => head.indexOf(n);
          const list = n => String(n || '').split(';').map(x => x.trim()).filter(Boolean);

          /* Everything already saved, plus what this file adds as it goes. */
          const { values } = await Store.all('swipes');
          const seen = new Set(values.map(s => urlKey(s.url)).filter(Boolean));

          const body = rows.slice(1);
          let added = 0, skipped = 0;
          for(let i = 0; i < body.length; i++){
            const r = body[i];
            const get = n => { const c = col(n); return c === -1 ? '' : (r[c] || '').trim(); };
            const url = get('url');
            const key = urlKey(url);
            if(key && seen.has(key)){ skipped++; continue; }
            if(key) seen.add(key);

            await Store.put('swipes', {
              id: url ? SwipeKey.idFor(url) : uid() + i.toString(36), url, title: get('title') || 'Untitled swipe',
              source: get('source') || (url ? detectSource(url) : 'reel'),
              hook: get('hook'), why: get('why'), transferable: get('transferable'),
              myAngle: get('angle'), intent: get('intent') || 'Education',
              channels: list(get('channels')), targets: list(get('targets')),
              beats: [], createdAt: Date.now() - added
            });
            added++;
            if(i % 10 === 0) goBtn.textContent = `Importing… ${i + 1}/${body.length}`;
          }

          App.closeSheet();
          U.toast(`Imported ${added} swipe${added===1?'':'s'}` +
                  (skipped ? ` · skipped ${skipped} already in the file` : ''));
          after && after();
        } catch(err){
          console.error(err);
          U.toast('Import stopped partway — run it again, saved rows will be skipped');
          busy = false;
          goBtn.disabled = false;
          goBtn.textContent = label;
        }
      });
    });
  }

  /* ---------- the Inbox ---------- */
  /* A swipe waits in the Inbox from when it arrives until it is in a folder or
     you say it is sorted. Filing it anywhere takes it out (folders.js too). */
  async function markSorted(ids){
    let n = 0;
    for(const id of ids){
      const s = await Store.get('swipes', id);
      if(!s || !s.inbox) continue;
      s.inbox = false; await Store.put('swipes', s); n++;
    }
    return n;
  }

  /* ---------- import your saves from Instagram, Facebook, TikTok ---------- */
  const HOWTO = {
    instagram:{ n:'Instagram', steps:`Profile → ☰ → <b>Accounts Center</b> → Your information and permissions →
      <b>Download your information</b> → Download or transfer → your Instagram → <b>Some of your information</b> →
      tick <b>Saved</b> → Download to device → Format <b>JSON</b> → Create files.` },
    facebook:{ n:'Facebook', steps:`Menu → Settings → <b>Accounts Center</b> → Your information and permissions →
      <b>Download your information</b> → your Facebook → <b>Some of your information</b> →
      tick <b>Saved items and collections</b> → Format <b>JSON</b> → Create files.` },
    tiktok:{ n:'TikTok', steps:`Profile → ☰ → Settings and privacy → Account → <b>Download your data</b> →
      <b>JSON</b> → Request data. It shows up in the <b>Download data</b> tab — hours to a few days.` }
  };
  const PLAT_SRC = { instagram:'reel', facebook:'facebook', tiktok:'tiktok' };

  function openSavesImport(after, onTick, onEnd){
    const esc = t => U.esc(t);
    App.sheet(`<h2>Import your saves</h2>
      <p style="margin:0 0 12px;color:var(--muted);font-size:14px;line-height:1.55">None of the apps let another app
        read your saves, but each one gives them to you in a data download. Ask for it, wait for the email,
        then pick the zip here — straight from Downloads, no unzipping.</p>
      ${Object.values(HOWTO).map(h => `<details class="si-how"><summary>How to get it from ${h.n}</summary>
        <p>${h.steps}</p></details>`).join('')}
      <div class="field" style="margin-top:14px"><label for="si-file">Pick the zip (or the files from inside it)</label>
        <input id="si-file" type="file" multiple></div>
      <div id="si-sum"></div>
      <div class="sheetcta"><button class="btn-primary" data-go disabled>Import</button>
        <button class="btn-ghost" data-cancel>Cancel</button></div>`, sh => {
      const fileIn = sh.querySelector('#si-file'), sum = sh.querySelector('#si-sum'), go = sh.querySelector('[data-go]');
      let fresh = [], busy = false;

      fileIn.addEventListener('change', async () => {
        const files = fileIn.files;
        if(!files || !files.length) return;
        sum.innerHTML = `<p class="hintline">Reading ${files.length > 1 ? files.length + ' files' : esc(files[0].name)}…</p>`;
        go.disabled = true;
        let res;
        try { res = await SwipeImport.read(files); }
        catch(err){
          console.error(err);
          sum.innerHTML = `<p class="hintline" style="color:var(--red)">${esc(err.message || "Couldn't read that")}</p>`;
          return;
        }
        const existing = await all();
        const seen = new Set(existing.map(x => urlKey(x.url)).filter(Boolean));
        fresh = res.items.filter(it => !seen.has(it.key));
        const dup = res.items.length - fresh.length;
        if(!res.items.length){
          sum.innerHTML = `<p class="hintline" style="color:var(--red)">No saved videos in ${res.files.length ? esc(res.files.join(', ')) : 'that'}.
            ${res.files.length ? '' : 'Pick the zip the app sent you, or saved_posts.json / your_saved_items.json / user_data_tiktok.json from inside it.'}</p>`;
          return;
        }
        const by = {};
        fresh.forEach(it => { by[it.platform] = (by[it.platform] || 0) + 1; });
        const cols = {};
        fresh.forEach(it => (it.collections || []).forEach(c => { cols[c] = (cols[c] || 0) + 1; }));
        const colNames = Object.keys(cols);
        sum.innerHTML = `<div class="si-sum">
          <b>${fresh.length} new save${fresh.length === 1 ? '' : 's'}</b>
          <span>${Object.entries(by).map(([k, n]) => `${n} ${HOWTO[k].n}`).join(' · ') || '—'}${dup ? ` · ${dup} already in your swipe file` : ''}</span>
          ${colNames.length ? `<label class="si-col"><input type="checkbox" id="si-cols" checked>
            Make folders from your ${colNames.length} collection${colNames.length === 1 ? '' : 's'}
            <small>${colNames.slice(0, 6).map(c => `${esc(c)} (${cols[c]})`).join(', ')}${colNames.length > 6 ? '…' : ''}
              — those are already sorted, so they skip the Inbox</small></label>` : ''}
        </div>`;
        go.disabled = !fresh.length;
        go.textContent = fresh.length ? `Add ${fresh.length} to the Inbox` : 'Nothing new';
      });

      sh.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return busy ? null : App.closeSheet();
        if(!e.target.closest('[data-go]') || busy || !fresh.length) return;
        busy = true; go.disabled = true;
        const useCols = !!(sh.querySelector('#si-cols') || {}).checked;
        const fid = {};
        if(useCols && window.SwipeFolders){
          for(const c of new Set(fresh.flatMap(it => it.collections || []))){
            const f = await SwipeFolders.create(c, '📁');
            if(f) fid[c] = f.id;
          }
        }
        const now = Date.now(), ids = [];
        let inbox = 0;
        for(let i = 0; i < fresh.length; i++){
          const it = fresh[i];
          const folders = useCols ? (it.collections || []).map(c => fid[c]).filter(Boolean) : [];
          const rec = { id: SwipeKey.idFor(it.url), url: it.url, source: PLAT_SRC[it.platform] || detectSource(it.url),
            title:'Untitled swipe', hook:'', beats:[], why:'', transferable:'', myAngle:'',
            intent:'Education', channels:[], targets:[], author: it.author || '',
            savedAt: it.savedAt || null, importedFrom: it.platform,
            createdAt: it.savedAt || (now - i), inbox: !folders.length };
          if(folders.length) rec.folders = folders; else inbox++;
          await Store.put('swipes', rec);
          ids.push(rec.id);
          if(i % 25 === 0) go.textContent = `Adding… ${i + 1}/${fresh.length}`;
        }
        App.closeSheet();
        U.toast(`Added ${fresh.length}${inbox !== fresh.length ? ` · ${inbox} in the Inbox, ${fresh.length - inbox} in folders` : ' to the Inbox'}`);
        /* titles and previews come in behind, one at a time */
        queueFetch(ids, onTick, async () => { await loadThumbs(); onEnd && onEnd(); });
        after && after();
      });
    });
  }

  /* ---------- entry ---------- */
  async function mountEntry(el, params){
    let s;
    const save = async () => { await Store.put('swipes', s); params.onChange && params.onChange(); };

    async function render(){
      s = await Store.get('swipes', params.id);
      if(!s){ Screens.pop(); return; }
      const so = SOURCES[s.source] || SOURCES.reel;

      el.innerHTML = Screens.bar({ kicker:'Swipe file', title:s.title || 'Untitled swipe' }) + `
      <div class="view">
        ${(window.Embed && !thumbs[s.id] && Embed.can(s.url))
          ? `<!-- the platform's own player: it draws its poster frame for free,
                  which is what you wanted rather than a downloaded copy -->
             ${Embed.html(s.url)}`
          : `<div class="thumb" style="aspect-ratio:16/9;border-radius:var(--r);background-size:cover;
               background-position:center;background-color:#221F1A;border:1px solid #2B2822;margin:0 0 12px;
               background-image:${coverFor(s)}"></div>`}
        ${s.inbox ? `<div class="ib-line"><span>📥 In your Inbox — put it in a folder below, or</span>
          <button class="btn-sm" data-a="sorted">Mark sorted</button></div>` : ''}
        <div class="metaline">
          <button class="btn-sm" data-a="thumb">${thumbs[s.id] ? 'Change cover' : 'Add cover'}</button>
          ${s.url ? `<button class="btn-sm" data-a="open">↗ Open source</button>` : ''}
          <span class="tg" style="color:${so.c};border:1px solid ${so.c};background:transparent">${so.n}</span>
        </div>

        <div class="block">
          <h4>Title</h4>
          <input class="fld" data-f="title" type="text" value="${(s.title||'').replace(/"/g,'&quot;')}"
            style="width:100%;height:44px;background:var(--bg);border:1px solid var(--line);
            border-radius:var(--r);color:var(--cream);font-size:16px;padding:0 11px;outline:none">
        </div>

        ${await entryTagsHTML(s)}

        <div class="block">
          <h4>The hook, transcribed</h4>
          <textarea class="fld" data-f="hook" rows="3" placeholder="Their opening line, word for word — paraphrasing loses what made it work."
            style="width:100%;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
            color:var(--cream);font-size:15.5px;padding:11px;outline:none;line-height:1.5;resize:vertical">${s.hook||''}</textarea>
        </div>

        <div class="block">
          <h4>Structure — the beats in order</h4>
          ${(s.beats||[]).length ? (s.beats||[]).map((b,i) =>
            `<div class="beatrow"><span class="n">${i+1}</span><span style="flex:1;font-size:15px">${b}</span>
             <button class="x" data-beat="${i}">×</button></div>`).join('')
            : `<p style="color:var(--muted);margin:0 0 10px;font-size:14.5px">No beats yet — walk the post and add one line per move it makes.</p>`}
          <div style="display:flex;gap:9px;margin-top:10px">
            <input id="beat" type="text" placeholder='e.g. "Accusation in frame one"'
              style="flex:1;height:44px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
              color:var(--cream);font-size:15px;padding:0 11px;outline:none">
            <button class="btn-sm" data-a="addbeat" style="width:52px;justify-content:center">+</button>
          </div>
        </div>

        <div class="block">
          <h4>Why it worked</h4>
          <textarea class="fld" data-f="why" rows="3" placeholder="What is actually doing the work here — and what is just decoration?"
            style="width:100%;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
            color:var(--cream);font-size:15.5px;padding:11px;outline:none;line-height:1.5;resize:vertical">${s.why||''}</textarea>
        </div>

        <div class="block">
          <h4>What is transferable</h4>
          <textarea class="fld" data-f="transferable" rows="3" placeholder="The part that survives being lifted out of their topic and dropped into yours."
            style="width:100%;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
            color:var(--cream);font-size:15.5px;padding:11px;outline:none;line-height:1.5;resize:vertical">${s.transferable||''}</textarea>
        </div>

        <div class="block">
          <h4>My angle</h4>
          <textarea class="fld" data-f="myAngle" rows="4" placeholder="Your version. First line becomes the idea title, the whole note becomes its script notes."
            style="width:100%;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
            color:var(--cream);font-size:15.5px;padding:11px;outline:none;line-height:1.5;resize:vertical">${s.myAngle||''}</textarea>
        </div>

        <!-- the app's old sorting: still read by clip ideas and channel pages,
             folded away now that your own tags do the sorting -->
        <details class="block stg-old"${oldOpen ? ' open' : ''}>
          <summary>Intent, channels and platforms</summary>
        <div class="block">
          <h4>Intent</h4>
          <div class="opts">${INTENTS.map(i =>
            `<button class="opt" data-set="intent" data-v="${i}" aria-pressed="${s.intent===i}">${i}</button>`).join('')}</div>
        </div>

        <div class="block">
          <h4>Channels — which of your brands this suits</h4>
          <div class="opts">${CHANNELS.map(c =>
            `<button class="opt" data-tog="channels" data-v="${c.n}" aria-pressed="${(s.channels||[]).includes(c.n)}">
              <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c.c};margin-right:6px"></span>${c.n}</button>`).join('')}</div>
        </div>

        <div class="block">
          <h4>Is this the bar?</h4>
          <p class="note" style="text-align:left;margin:0 0 10px">One channel only. A video
            that is the standard for everything is the standard for nothing — this is the
            one you would point at and say <i>exactly this</i>.</p>
          <div class="opts">
            <button class="opt" data-bar="" aria-pressed="${!s.barFor}">Not the bar</button>
            ${(s.channels || []).length
              ? (s.channels || []).map(n => {
                  const c = CHANNELS.find(x => x.n === n) || { c:'var(--orange)' };
                  return `<button class="opt" data-bar="${n.replace(/"/g,'&quot;')}"
                    aria-pressed="${s.barFor === n}">
                    <span style="display:inline-block;width:7px;height:7px;border-radius:50%;
                      background:${c.c};margin-right:6px"></span>${n}</button>`;
                }).join('')
              : '<span class="note" style="text-align:left">Pick a channel above first.</span>'}
          </div>
        </div>

        <div class="block">
          <h4>Target platforms — where your version would run</h4>
          <div class="opts">${Object.entries(SOURCES).map(([k,v]) =>
            `<button class="opt" data-tog="targets" data-v="${k}" aria-pressed="${(s.targets||[]).includes(k)}">
              <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${v.c};margin-right:6px"></span>${v.n}</button>`).join('')}</div>
        </div>

        </details>

        ${await entryFoldersHTML(s)}

        ${await usedInHTML(s)}

        <div class="metaline" style="margin-top:4px">
          <button class="btn-sm accent" data-a="toclip">Use for a clip</button>
          ${s.url ? `<button class="btn-sm" data-a="refetch">Fetch details</button>` : ''}
          <button class="btn-sm" data-a="piece">Attach to piece</button>
          <button class="btn-sm" data-a="idea">Convert to idea</button>
          <button class="btn-sm" data-a="delete" style="color:var(--red);border-color:rgba(226,86,74,.4)">Delete</button>
        </div>
      </div>`;
    }

    el.addEventListener('input', e => {
      const f = e.target.closest('.fld');
      if(!f) return;
      s[f.dataset.f] = e.target.value;
      clearTimeout(el._t);
      el._t = setTimeout(save, 400);   /* debounce so typing isn't a write per keystroke */
    });

    /* Hold one to pick several. The card is a button, so the guard in Select
       stops a tap from opening an entry while you are choosing. */
    if(window.Select) Select.enable(el, {
      itemSelector: '.swipecard',
      noun: 'swipe',
      idOf: n => n.dataset.open || null,
      warning: 'The entries go for good. Anything you wrote about them goes too.',
      onDelete: async ids => {
        for(const id of ids){
          try { await Store.del('swipes', id); } catch(err){}
          /* a cover you uploaded lives in its own store and would be orphaned */
          try { await Store.del('swipe-thumb', id); } catch(err){}
        }
      },
      onDone: async () => { await loadThumbs(); render(); }
    });

    el.addEventListener('click', async e => {
      const set = e.target.closest('[data-set]');
      if(set){ s[set.dataset.set] = set.dataset.v; await save(); return render(); }
      const stag = e.target.closest('[data-stag]');
      if(stag){
        const id = stag.dataset.stag;
        s.tagIds = (s.tagIds || []).includes(id) ? s.tagIds.filter(x => x !== id) : (s.tagIds || []).concat(id);
        await save(); return render();
      }
      if(e.target.closest('[data-a="edittags"]')) return editTags(render);

      const fo = e.target.closest('[data-fold]');
      if(fo){
        const id = fo.dataset.fold;
        s.folders = (s.folders || []).includes(id) ? s.folders.filter(x => x !== id) : (s.folders || []).concat(id);
        if(s.folders.length) s.inbox = false;
        await save(); return render();
      }
      if(e.target.closest('[data-a="foldnew"]')){
        const n = (prompt('Name the new folder') || '').trim();
        if(!n) return;
        const f = await SwipeFolders.create(n, '📁');
        s.folders = [...new Set((s.folders || []).concat(f.id))];
        s.inbox = false;
        await save(); U.toast(`Added to ${f.name}`); return render();
      }

      const uc = e.target.closest('[data-used-clip]');
      if(uc) return Screens.push('clip', { id: uc.dataset.usedClip });
      const ut = e.target.closest('[data-used-task]');
      if(ut) return Screens.push('task', { id: ut.dataset.usedTask });

      const barBtn = e.target.closest('[data-bar]');
      if(barBtn){
        /* one channel per benchmark, so this replaces rather than adds */
        s.barFor = barBtn.dataset.bar || null;
        await save();
        return render();
      }

      const tog = e.target.closest('[data-tog]');
      if(tog){
        const k = tog.dataset.tog, v = tog.dataset.v;
        s[k] = s[k] || [];
        s[k].includes(v) ? s[k] = s[k].filter(x => x !== v) : s[k].push(v);
        await save(); return render();
      }

      const b = e.target.closest('[data-beat]');
      if(b){ s.beats.splice(+b.dataset.beat, 1); await save(); return render(); }

      const a = e.target.closest('[data-a]');
      if(!a) return;
      if(a.dataset.a === 'sorted'){ s.inbox = false; await save(); U.toast('Out of the Inbox'); return render(); }
      if(a.dataset.a === 'addbeat'){
        const input = el.querySelector('#beat');
        const v = input.value.trim();
        if(!v) return;
        s.beats = s.beats || []; s.beats.push(v);
        await save(); return render();
      }
      if(a.dataset.a === 'thumb'){
        App.pickImage(async file => {
          await Store.put('swipe-thumb', file, s.id);
          await loadThumbs(); render(); params.onChange && params.onChange();
        });
      }
      if(a.dataset.a === 'open' && s.url) window.open(s.url, '_blank');
      if(a.dataset.a === 'idea'){
        if(!s.myAngle) return U.toast('Write your angle first — that becomes the idea');
        const lines = s.myAngle.split('\n').map(x => x.trim()).filter(Boolean);
        await Data.saveClip({ title:lines[0], plat:(s.targets||[])[0] === 'tiktok' ? 'tiktok' : 'youtube',
                              state:'raw', seriesId:null, dur:'0:00' });
        U.toast('Added to Clips as a raw idea');
      }
      if(a.dataset.a === 'piece') return attachToPiece(s, render);
      if(a.dataset.a === 'toclip') return linkToClip(s, render);
      if(a.dataset.a === 'refetch'){
        a.textContent = 'Fetching…';
        const got = await enrich(s);
        U.toast(got ? 'Details updated' : (window.LinkMeta && LinkMeta.native()
          ? 'Nothing new found for this link' : 'Only YouTube can be read in a browser — try it in the app'));
        params.onChange && params.onChange();
        return render();
      }
      if(a.dataset.a === 'delete'){
        await Store.del('swipes', s.id);
        await Store.del('swipe-thumb', s.id);
        params.onChange && params.onChange();
        Screens.pop();
      }
    });

    await loadThumbs();
    await loadChannels();
    render();
  }

  /* ---------- the folders a swipe is in, as chips you tap on and off ---------- */
  async function entryFoldersHTML(s){
    if(!window.SwipeFolders) return '';
    const folders = await SwipeFolders.sorted();
    const esc = t => String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    return `<div class="block">
      <h4>Folders</h4>
      <div class="opts" style="flex-wrap:wrap">
        ${folders.map(f => `<button class="opt" data-fold="${f.id}" aria-pressed="${(s.folders || []).includes(f.id)}"
          >${esc(f.emoji || '📁')} ${esc(f.name)}</button>`).join('')}
        <button class="opt" data-a="foldnew">+ New folder</button>
      </div>
    </div>`;
  }

  /* ---------- where this swipe is being used ---------- */
  async function usedInHTML(swipe){
    const [clips, tasks] = await Promise.all([Data.clips(), Data.tasks()]);
    const inClips = clips.filter(c => c.plan && (
      (c.plan.swipeIds || []).includes(swipe.id) ||
      (c.plan.versions || []).some(v => v.swipeId === swipe.id)));
    const inTasks = tasks.filter(t => t.swipeId === swipe.id || (t.swipeIds || []).includes(swipe.id));
    if(!inClips.length && !inTasks.length) return '';
    return `<div class="block">
      <h4>Used in</h4>
      <div class="metaline" style="margin:0;flex-wrap:wrap">
        ${inClips.map(c => `<button class="btn-sm" data-used-clip="${c.id}">▶ ${c.title || 'Untitled clip'}</button>`).join('')}
        ${inTasks.map(t => `<button class="btn-sm" data-used-task="${t.id}">✓ ${t.title}</button>`).join('')}
      </div>
    </div>`;
  }

  /* ---------- link this swipe to a clip's references ---------- */
  async function linkToClip(swipe, after){
    const clips = (await Data.clips()).slice()
      .sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
    if(!clips.length) return U.toast('No clips yet — add one in the Clips tab');
    const row = c => {
      const has = c.plan && (c.plan.swipeIds || []).includes(swipe.id);
      return `<button class="opt" data-clip="${c.id}" aria-pressed="${!!has}"
        style="width:100%;justify-content:space-between;margin:0 0 6px;text-align:left">
        <span>${c.title || 'Untitled clip'}</span>
        <small style="opacity:.7">${has ? 'linked' : c.state || ''}</small></button>`;
    };
    App.sheet(`
      <h2>Use for a clip</h2>
      <div class="field"><input id="lc-q" type="text" placeholder="Search clips…"></div>
      <div id="lc-list" style="max-height:52vh;overflow:auto">${clips.map(row).join('')}</div>
      <div class="sheetcta"><button class="btn-ghost" data-cancel>Done</button></div>`, sheetEl => {
      const q = sheetEl.querySelector('#lc-q'), list = sheetEl.querySelector('#lc-list');
      q.addEventListener('input', () => {
        const v = q.value.trim().toLowerCase();
        list.innerHTML = clips.filter(c => !v || (c.title || '').toLowerCase().includes(v)).map(row).join('');
      });
      sheetEl.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')){ App.closeSheet(); return after && after(); }
        const b = e.target.closest('[data-clip]');
        if(!b) return;
        const c = clips.find(x => x.id === b.dataset.clip);
        c.plan = c.plan || {};
        const ids = c.plan.swipeIds = c.plan.swipeIds || [];
        const i = ids.indexOf(swipe.id);
        i === -1 ? ids.push(swipe.id) : ids.splice(i, 1);
        await Data.saveClip(c);
        U.toast(i === -1 ? `Linked to ${c.title || 'the clip'}` : 'Unlinked');
        list.innerHTML = clips.filter(x => !q.value.trim() ||
          (x.title || '').toLowerCase().includes(q.value.trim().toLowerCase())).map(row).join('');
      });
    });
  }

  /* ---------- attach to a piece (a task you'll shoot) ---------- */
  async function attachToPiece(swipe, after){
    const [tasks, today] = await Promise.all([Data.tasks(), Data.currentDay()]);
    const upcoming = tasks.filter(t => t.day >= today && t.view !== 'done')
                          .sort((a,b) => a.day - b.day).slice(0, 12);
    const suggested = (swipe.myAngle || '').split('\n')[0].trim() || swipe.title;

    const dayField = await U.dayField('pc-day', today);
    App.sheet(`
      <h2>Attach to a piece</h2>
      <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.6">
        A piece is something you'll shoot. Attaching puts it on Today, with this swipe one tap away
        while you're filming.</p>
      <div class="field"><label for="pc-title">New piece</label>
        <input id="pc-title" type="text" value="${suggested.replace(/"/g,'&quot;')}" placeholder="Shoot: cold open">
      </div>
      ${dayField}
      <div class="sheetcta">
        <button class="btn-primary" data-new>Create piece</button>
        <button class="btn-ghost" data-cancel>Cancel</button>
      </div>
      ${upcoming.length ? `<p class="caps muted" style="font-size:11.5px;margin:22px 0 10px">Or attach to an existing one</p>
        <div class="group compact" style="margin:0">
          ${upcoming.map(t => `<button class="row" data-task="${t.id}">
            <span class="lbl">${t.title}<small>Day ${t.day}${t.swipeId ? ' · already has a swipe' : ''}</small></span>
            ${U.ICON.chevR}</button>`).join('')}
        </div>` : ''}`, sheetEl => {
      U.wireDayField(sheetEl, 'pc-day');
      sheetEl.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();

        const ex = e.target.closest('[data-task]');
        if(ex){
          const t = tasks.find(x => x.id === +ex.dataset.task);
          t.swipeId = swipe.id;
          await Store.put('tasks', t);
          Data.invalidate('tasks');
          App.closeSheet(); U.toast('Attached — it is on Today'); after && after();
          return;
        }
        if(!e.target.closest('[data-new]')) return;

        const title = sheetEl.querySelector('#pc-title').value.trim();
        if(!title) return U.toast('Name the piece first');
        const day = (await U.readDayField(sheetEl, 'pc-day')) || today;
        const id = U.taskId();

        await Store.put('tasks', { id, day, title, cad:'Shoot day', pri:'med', prog:'',
                                   subs:[], view:'todo', swipeId:swipe.id });
        Data.invalidate('tasks');
        App.closeSheet();
        U.toast(`Added to Day ${day}`);
        after && after();
      });
    });
  }

  /* Other screens (a clip's references, a task's references) borrow the same
     covers and Instagram previews the swipe file uses. */
  window.SwipeView = { SOURCES, SHORT, coverFor, igId, loadThumbs, mountIgEmbed,
                       hasThumb: id => !!thumbs[id], enrich, needsDetails, markSorted };

  /* folders: tiles, the open folder's header, the icon picker, the extra bar button */
  (function folderCSS(){
    if(document.getElementById('fd-css')) return;
    const st = document.createElement('style');
    st.id = 'fd-css';
    st.textContent = `
    .fd-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .fd-tile{display:flex;flex-direction:column;padding:0;text-align:left;cursor:pointer;overflow:hidden;
      border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);color:var(--cream)}
    .fd-mosaic{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:2px;aspect-ratio:1/1;
      background:var(--surface-1)}
    .fd-mosaic i{display:block;background-size:cover;background-position:center;background-color:#221F1A}
    .fd-mosaic i.blank{background:var(--surface-1)}
    .fd-mosaic.plus{display:flex;align-items:center;justify-content:center;font-size:44px;color:var(--muted);
      border-bottom:1px dashed var(--line)}
    .fd-new{border-style:dashed;background:none}
    .fd-name{display:block;padding:9px 10px 0;font-family:var(--display),sans-serif;font-weight:900;font-size:15.5px;
      line-height:1.25}
    .fd-name em{font-style:normal;font-size:12px}
    .fd-n{display:block;padding:3px 10px 10px;font-size:12.5px;color:var(--muted)}
    .fd-head{display:flex;align-items:center;gap:10px;margin:0 0 12px}
    .fd-head h2{flex:1;min-width:0;margin:0;font-family:var(--display),sans-serif;font-weight:900;font-size:22px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .fd-back{padding:6px 10px;border:1px solid var(--line);border-radius:var(--r);background:none;
      color:var(--muted);font-size:13.5px;cursor:pointer}
    .fd-emoji{display:flex;flex-wrap:wrap;gap:6px}
    .fd-emoji button{width:42px;height:42px;font-size:21px;border:1px solid var(--line);border-radius:var(--r);
      background:none;cursor:pointer}
    .fd-emoji button[aria-pressed="true"]{border-color:var(--orange);background:rgba(251,105,0,.12)}
    .selbar .sb-extra{background:var(--surface-2);color:var(--cream)}
    .ib-n{display:inline-block;min-width:18px;padding:0 5px;margin-left:4px;border-radius:9px;background:var(--orange);
      color:#fff;font-size:11.5px;line-height:18px;font-weight:700}
    .ib-head{margin:0 0 12px}
    .ib-head .btn-primary{display:flex;flex-direction:column;align-items:center;gap:2px;height:auto;padding:11px 14px}
    .ib-head .btn-primary small{font-weight:500;font-size:12px;opacity:.85}
    .ib-line{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;padding:9px 12px;
      border:1px solid rgba(251,105,0,.35);border-radius:var(--r);background:rgba(251,105,0,.08);font-size:13.5px;color:var(--cream)}
    .si-how{margin:0 0 6px;border:1px solid var(--line);border-radius:var(--r);padding:8px 11px}
    .si-how summary{cursor:pointer;font-size:14px;color:var(--cream)}
    .si-how p{margin:8px 0 2px;font-size:13.5px;line-height:1.6;color:var(--muted)}
    .si-how b{color:var(--cream)}
    .si-sum{display:flex;flex-direction:column;gap:4px;margin:0 0 14px;padding:11px 12px;border:1px solid var(--line);
      border-radius:var(--r);background:var(--surface-2);font-size:14px}
    .si-sum span{color:var(--muted);font-size:13px}
    .si-col{display:block;margin-top:8px;font-size:14px;line-height:1.45}
    .si-col input{width:18px;height:18px;vertical-align:-3px;margin-right:6px}
    .si-col small{display:block;margin:3px 0 0 24px;color:var(--muted);font-size:12.5px}`;
    document.head.appendChild(st);
  })();

  Screens.register('swipe-file', mountList);
  Screens.register('swipe', mountEntry);
})();
