/* Swipe import — your saved videos from Instagram, Facebook and TikTok.

   None of the three lets an app read your saves, but all three hand them to
   you in a "Download your information" export. This reads that export — the
   zip as it comes, or a single file out of it — and turns it into links:

     Instagram  saved_posts.json / saved_collections.json (or the .html ones)
     Facebook   your_saved_items.json / collections.json (or the .html ones)
     TikTok     user_data_tiktok.json, or "Favorite Videos.txt" in a .txt export

   Each link comes back with the date you saved it, the creator when the export
   names one, and the collection it sat in on the platform. Nothing is
   downloaded: a swipe is a link.

   TikTok's export also lists every video you ever watched or liked. Only the
   Favorites list is read, so an import is your saves and nothing else.

   read(files) → { items:[{ url, platform, savedAt, author, collection }],
                   files:[names read], skipped:n }                          */
(function(global){

  /* ---------------------------------------------------------------- links */
  const RE_URL = /https?:\/\/[^\s"'<>\\]+/gi;

  /* What a link is, or null when it isn't a saved video/post. */
  function classify(raw){
    let url = String(raw || '').replace(/&amp;/g, '&').replace(/[),.;!?\]]+$/, '');
    let p;
    try { p = new URL(url); } catch(e){ return null; }
    const host = p.hostname.toLowerCase().replace(/^(www\.|m\.|web\.|mobile\.)/, '');
    const path = p.pathname;

    if(/(^|\.)instagram\.com$/.test(host)){
      const m = path.match(/^\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]{5,})/i);
      if(!m) return null;
      const kind = m[1].toLowerCase() === 'p' ? 'p' : 'reel';
      return { platform:'instagram', url:`https://www.instagram.com/${kind}/${m[2]}/`, key:'ig:' + m[2] };
    }
    if(/(^|\.)tiktokv?\.com$/.test(host)){
      const id = (path.match(/\/video\/(\d{6,})/) || [])[1];
      if(id){
        /* keep TikTok's own link — the export's tiktokv.com/share/video/<id>
           form redirects to the real one, which the preview fetch follows */
        return { platform:'tiktok', url: host.startsWith('tiktokv') ? `https://www.tiktokv.com/share/video/${id}/`
                   : `https://www.tiktok.com${path.replace(/\/+$/, '')}`, key:'tt:' + id };
      }
      if(/^(vm|vt)\./.test(host) || /^\/t\/\w+/.test(path))
        return { platform:'tiktok', url, key:'tt:' + host + path.replace(/\/+$/, '') };
      return null;
    }
    if(host === 'fb.watch'){
      return { platform:'facebook', url, key:'fb:' + path.replace(/\/+$/, '') };
    }
    if(/(^|\.)facebook\.com$/.test(host)){
      /* a saved video, reel or post — not a profile, a shop listing or an event */
      if(/^\/(marketplace|events|login|help|settings|privacy|policies|ads|gaming\/?$)/i.test(path)) return null;
      const v = p.searchParams.get('v');
      if(v) return { platform:'facebook', url:`https://www.facebook.com/watch/?v=${v}`, key:'fb:v' + v };
      const vid = (path.match(/\/(?:videos|reel|reels)\/(?:[\w.-]+\/)?(\d{6,})/i) || [])[1];
      if(vid) return { platform:'facebook', url:`https://www.facebook.com${path.replace(/\/+$/, '')}/`, key:'fb:v' + vid };
      const segs = path.split('/').filter(Boolean);
      const contentish = /\/(posts|permalink\.php|story\.php|photo|share\/[rvp]|watch|groups\/[^/]+\/(posts|permalink))/i.test(path);
      if(!contentish || segs.length < 2) return null;
      p.hash = '';
      const keep = ['story_fbid', 'id', 'fbid'];
      [...p.searchParams.keys()].forEach(k => { if(!keep.includes(k)) p.searchParams.delete(k); });
      return { platform:'facebook', url:p.toString(), key:'fb:' + (path + p.search).replace(/\/+$/, '').toLowerCase() };
    }
    return null;
  }

  /* --------------------------------------------------------------- dates */
  function toMs(v){
    if(v == null || v === '') return 0;
    if(typeof v === 'number') return v < 1e11 ? v * 1000 : v;     /* seconds or ms */
    const s = String(v).trim();
    if(/^\d{9,13}$/.test(s)) return toMs(+s);
    /* "2024-03-02 18:22:01" — TikTok's, which Date reads only with a T */
    const t = Date.parse(s.replace(/^(\d{4}-\d\d-\d\d) (\d)/, '$1T$2') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) || !/\d:\d/.test(s) ? '' : 'Z'));
    return isNaN(t) ? 0 : t;
  }
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const TS_KEYS = /^(timestamp|creation_timestamp|date|time|added time|saved on|saved_on|added_on)$/i;

  /* the nearest date inside one saved entry */
  function findTs(entry, depth){
    if(!isObj(entry) || (depth || 0) > 3) return 0;
    for(const [k, v] of Object.entries(entry)){
      if(TS_KEYS.test(k) && (typeof v === 'number' || typeof v === 'string')){ const t = toMs(v); if(t) return t; }
    }
    for(const v of Object.values(entry)){
      if(isObj(v)){ const t = findTs(v, (depth || 0) + 1); if(t) return t; }
      if(Array.isArray(v)) for(const x of v.slice(0, 6)){ const t = findTs(x, (depth || 0) + 1); if(t) return t; }
    }
    return 0;
  }

  /* who made it, where the export says */
  function findAuthor(entry, platform){
    if(!isObj(entry)) return '';
    const t = typeof entry.title === 'string' ? entry.title.trim() : '';
    if(platform === 'facebook' && t){
      /* "Kris saved Joe Smith's video." / "...saved a reel from Joe Smith." */
      const m = t.match(/saved (.+?)'s? (?:video|reel|post|link|photo)/i) || t.match(/saved an? (?:video|reel|post) (?:from|by) (.+?)\.?$/i);
      return m ? m[1].trim() : '';
    }
    if(t && !/^https?:/i.test(t) && !/^collection$/i.test(t) && t.length < 60 && !/\s/.test(t)) return t;
    const smd = entry.string_map_data;
    if(isObj(smd)){
      for(const k of ['Name', 'Owner', 'Username', 'Author']){
        const v = smd[k];
        if(isObj(v) && typeof v.value === 'string' && v.value && !/^https?:/i.test(v.value)) return v.value.trim();
      }
    }
    if(Array.isArray(entry.label_values)){
      const lv = entry.label_values.find(x => isObj(x) && /owner|author|username|name/i.test(x.label || '') && x.value && !/^https?:/i.test(x.value));
      if(lv) return String(lv.value).trim();
    }
    return '';
  }

  /* An array element that names a collection rather than being a save: the
     items after it, up to the next header, are in that collection. */
  function collectionHeader(el){
    if(!isObj(el)) return null;
    if(hasPostUrl(el)) return null;
    const smd = el.string_map_data;
    if(isObj(smd) && isObj(smd.Name) && smd.Name.value && !smd.Name.href &&
       (/^collection$/i.test(el.title || '') || smd['Creation Time'] || smd['Update Time'])) return String(smd.Name.value).trim();
    if(/^collection$/i.test(el.title || '') && typeof el.name === 'string') return el.name.trim();
    return null;
  }
  function hasPostUrl(node, depth){
    if((depth || 0) > 6) return false;
    if(typeof node === 'string') return (node.match(RE_URL) || []).some(u => classify(u));
    if(Array.isArray(node)) return node.some(x => hasPostUrl(x, (depth || 0) + 1));
    if(isObj(node)) return Object.values(node).some(x => hasPostUrl(x, (depth || 0) + 1));
    return false;
  }
  /* Facebook says the collection in the sentence: "…added X to your Cars collection." */
  function fbCollection(entry){
    const t = isObj(entry) && typeof entry.title === 'string' ? entry.title : '';
    const m = t.match(/to (?:the |your |their )?(.+?) collection\.?$/i);
    return m ? m[1].trim() : '';
  }

  /* Every save in a parsed JSON file. */
  function fromJSON(data, hint){
    const out = [];
    function add(str, ctx){
      for(const u of String(str).match(RE_URL) || []){
        const c = classify(u);
        if(!c || (hint && hint !== c.platform)) continue;
        /* the save's details can sit a level or two above the link
           (Facebook nests it in attachments → data), so look outward */
        const up = ctx.entries.slice().reverse();
        const first = fn => { for(const e of up){ const v = fn(e); if(v) return v; } return ''; };
        out.push({ ...c,
          savedAt: first(findTs) || 0,
          author: first(e => findAuthor(e, c.platform)),
          collection: ctx.collection || (c.platform === 'facebook' ? first(fbCollection) : '') });
      }
    }
    (function walk(node, ctx, depth){
      if(depth > 40) return;
      if(typeof node === 'string'){ if(node.length < 4000) add(node, ctx); return; }
      if(Array.isArray(node)){
        let col = ctx.collection;
        for(const el of node){
          const h = collectionHeader(el);
          if(h){ col = h; continue; }
          walk(el, { collection:col, entries: isObj(el) ? ctx.entries.concat([el]) : ctx.entries }, depth + 1);
        }
        return;
      }
      if(isObj(node)) for(const v of Object.values(node)) walk(v, ctx, depth + 1);
    })(data, { collection:'', entries:[] }, 0);
    return out;
  }

  /* TikTok: only the Favorites. The rest of the file is watch history and likes. */
  function tiktokFavorites(data){
    const found = [];
    (function seek(node, depth){
      if(!node || typeof node !== 'object' || depth > 8) return;
      for(const [k, v] of Object.entries(node)){
        if(/^favou?ritevideos?(list)?$/.test(k.toLowerCase().replace(/[\s_-]+/g, ''))) found.push(v);
        else if(typeof v === 'object') seek(v, depth + 1);
      }
    })(data, 0);
    const out = [];
    found.forEach(f => {
      const list = Array.isArray(f) ? f : (isObj(f) ? Object.values(f).find(Array.isArray) || [] : []);
      list.forEach(x => {
        if(!isObj(x)) return;
        const link = x.Link || x.link || x.VideoLink || x.url || '';
        const c = classify(link);
        if(c) out.push({ ...c, savedAt: toMs(x.Date || x.date || x.Timestamp), author:'', collection:'' });
      });
    });
    return out;
  }

  /* "Date: 2024-01-02 10:11:12\nLink: https://…" blocks */
  function tiktokTxt(text){
    const out = [];
    const re = /Date:\s*([^\n\r]+)[\r\n]+\s*(?:Video )?Link:\s*(\S+)/gi;
    let m;
    while((m = re.exec(text))){
      const c = classify(m[2]);
      if(c) out.push({ ...c, savedAt: toMs(m[1]), author:'', collection:'' });
    }
    return out;
  }

  /* Meta's HTML exports: links, and collection names as headings between them */
  function fromHTML(text, hint){
    const out = [];
    const chunks = String(text).split(/<(?=h[1-3]|div class="_3-95|div class="_a6-h)/i);
    let col = '';
    const decode = s => s.replace(/&amp;/g, '&').replace(/&#039;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim();
    for(const ch of chunks){
      const head = ch.match(/^h[1-3][^>]*>([^<]{1,80})</i);
      const urls = (ch.match(/href="([^"]+)"/gi) || []).map(h => h.slice(6, -1));
      const items = urls.map(classify).filter(c => c && (!hint || hint === c.platform));
      if(!items.length){
        if(head && hint !== 'facebook') col = decode(head[1]);
        continue;
      }
      const date = (ch.match(/(?:[A-Z][a-z]{2} \d{1,2}, \d{4}[^<]{0,12})/) || [])[0] || '';
      items.forEach(c => out.push({ ...c, savedAt: toMs(date), author:'', collection: col }));
    }
    return out;
  }

  /* ------------------------------------------------------------------ zip */
  /* Enough of a zip reader for these exports: the central directory, then
     only the files that hold saves, inflated by the browser itself. The zip
     can be gigabytes of photos — none of that is read. */
  const RELEVANT = /(saved_posts|saved_collections|saved_items|your_saved|collections|user_data|favou?rite ?videos)[^/]*\.(json|txt|html?)$/i;

  async function unzip(file, want){
    const size = file.size;
    const tailLen = Math.min(size, 66000 + 22);
    const tail = new DataView(await file.slice(size - tailLen).arrayBuffer());
    let eocd = -1;
    for(let i = tail.byteLength - 22; i >= 0; i--) if(tail.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
    if(eocd < 0) throw new Error('Not a zip file');
    let count = tail.getUint16(eocd + 10, true);
    let cdSize = tail.getUint32(eocd + 12, true);
    let cdOff = tail.getUint32(eocd + 16, true);
    /* ZIP64: big exports */
    if(cdOff === 0xFFFFFFFF || count === 0xFFFF){
      const loc = eocd - 20;
      if(loc >= 0 && tail.getUint32(loc, true) === 0x07064b50){
        const z64 = Number(tail.getBigUint64(loc + 8, true));
        const r = new DataView(await file.slice(z64, z64 + 56).arrayBuffer());
        count = Number(r.getBigUint64(32, true));
        cdSize = Number(r.getBigUint64(40, true));
        cdOff = Number(r.getBigUint64(48, true));
      }
    }
    const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
    const dec = new TextDecoder();
    const entries = [];
    let p = 0;
    for(let i = 0; i < count && p + 46 <= cd.byteLength; i++){
      if(cd.getUint32(p, true) !== 0x02014b50) break;
      const method = cd.getUint16(p + 10, true);
      let csize = cd.getUint32(p + 20, true), usize = cd.getUint32(p + 24, true);
      const nlen = cd.getUint16(p + 28, true), xlen = cd.getUint16(p + 30, true), clen = cd.getUint16(p + 32, true);
      let off = cd.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nlen));
      /* ZIP64 extra field carries the real sizes and offset */
      let x = p + 46 + nlen;
      const xend = x + xlen;
      while(x + 4 <= xend){
        const id = cd.getUint16(x, true), len = cd.getUint16(x + 2, true);
        if(id === 0x0001){
          let q = x + 4;
          if(usize === 0xFFFFFFFF){ usize = Number(cd.getBigUint64(q, true)); q += 8; }
          if(csize === 0xFFFFFFFF){ csize = Number(cd.getBigUint64(q, true)); q += 8; }
          if(off === 0xFFFFFFFF){ off = Number(cd.getBigUint64(q, true)); q += 8; }
        }
        x += 4 + len;
      }
      entries.push({ name, method, csize, usize, off });
      p = xend + clen;
    }
    const out = [];
    for(const e of entries){
      if(e.name.endsWith('/') || !want(e.name)) continue;
      const lh = new DataView(await file.slice(e.off, e.off + 30).arrayBuffer());
      if(lh.getUint32(0, true) !== 0x04034b50) continue;
      const start = e.off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
      const blob = file.slice(start, start + e.csize);
      let text;
      if(e.method === 0) text = await blob.text();
      else if(e.method === 8){
        if(typeof DecompressionStream === 'undefined') throw new Error('This device cannot open zips — unzip it first and pick the file inside');
        text = await new Response(blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      } else continue;
      out.push({ name:e.name, text });
    }
    return { entries: entries.length, files: out };
  }

  /* ---------------------------------------------------------------- files */
  function platformHint(name, text){
    const n = String(name).toLowerCase();
    if(/tiktok|user_data|favou?rite ?videos/.test(n)) return 'tiktok';
    if(/saved_posts|saved_collections/.test(n)) return 'instagram';
    if(/saved_items|your_saved|saved_items_and_collections|collections\.(json|html?)$/.test(n)) return 'facebook';
    const s = String(text).slice(0, 200000);
    if(/"(Your )?Activity"\s*:/.test(s) && /tiktok/i.test(s)) return 'tiktok';
    if(/saved_saved_media|saved_saved_collections/.test(s)) return 'instagram';
    if(/saves_v2|collections_v2/.test(s)) return 'facebook';
    return '';
  }

  function parseOne(name, text){
    text = String(text || '').replace(/^\uFEFF/, '');
    const hint = platformHint(name, text);
    const isJSON = /^\s*[[{]/.test(text);
    if(isJSON){
      let data;
      try { data = JSON.parse(text); } catch(e){ data = null; }
      if(data){
        if(hint === 'tiktok') return tiktokFavorites(data);
        return fromJSON(data, hint || '');
      }
    }
    if(/<html|<a\s|href="/i.test(text)) return fromHTML(text, hint === 'tiktok' ? 'tiktok' : hint);
    if(hint === 'tiktok' || /Link:\s*https?:\/\/\S*tiktok/i.test(text)){
      /* a txt export is one file per list — only the Favorites one counts */
      if(/favou?rite/i.test(name) || /Favou?rite Videos:/i.test(text)){
        const fav = /Favou?rite Videos:?\s*\n([\s\S]*?)(?:\n[A-Z][\w ]{2,40}:\s*\n|$)/i.exec(text);
        return tiktokTxt(fav ? fav[1] : text);
      }
      return [];
    }
    /* anything else: whatever save links are in it */
    return (text.match(RE_URL) || []).map(classify).filter(Boolean)
      .map(c => ({ ...c, savedAt:0, author:'', collection:'' }));
  }

  /* Same link twice (a post in two collections, an import run twice): keep the
     first, but don't lose a collection or creator the second one had. */
  function merge(list){
    const by = new Map();
    for(const it of list){
      const had = by.get(it.key);
      if(!had){ by.set(it.key, { ...it, collections: it.collection ? [it.collection] : [] }); continue; }
      if(!had.author && it.author) had.author = it.author;
      if(!had.savedAt && it.savedAt) had.savedAt = it.savedAt;
      if(it.collection && !had.collections.includes(it.collection)) had.collections.push(it.collection);
    }
    return [...by.values()].map(({ collection, ...rest }) => rest);
  }

  async function read(fileList){
    const files = [...(fileList || [])];
    const all = [], names = [];
    for(const f of files){
      const isZip = /\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed';
      if(isZip){
        const z = await unzip(f, n => RELEVANT.test(n) && !/(^|\/)(messages|inbox)\//i.test(n));
        z.files.forEach(x => { names.push(x.name.split('/').pop()); all.push(...parseOne(x.name, x.text)); });
      } else {
        names.push(f.name);
        all.push(...parseOne(f.name, await f.text()));
      }
    }
    const items = merge(all).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    return { items, files:names, found: all.length };
  }

  const api = { read, parseOne, classify, merge, unzip, toMs };
  global.SwipeImport = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
