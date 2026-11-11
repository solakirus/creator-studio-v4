/* Thumbnails for things you saved from social media.

   What is actually possible differs by platform, and pretending otherwise would
   just produce broken images:

     YouTube   — the thumbnail url is derivable from the video id. No request,
                 nothing to fail.
     TikTok    — a public oEmbed endpoint returns one and allows cross-origin
                 requests. No key. It can change without notice, so every call
                 is wrapped and a failure is silent.
     Instagram — needs an app token since 2020, and fetching the page is blocked
                 cross-origin. There is no honest way to get it from here, so we
                 do not try and the generated artwork stands.
     Anywhere  — reading og:image means fetching the page cross-origin, which
       else      the browser refuses.

   Showing a remote image needs no permission at all. Downloading it into the
   app does, and often fails — so that is best-effort, and the url is kept
   either way. */
(function(global){

  /* ---- working out the url ---- */

  const YT = [
    /youtube\.com\/watch\?[^#]*\bv=([\w-]{6,})/i,
    /youtu\.be\/([\w-]{6,})/i,
    /youtube\.com\/shorts\/([\w-]{6,})/i,
    /youtube\.com\/embed\/([\w-]{6,})/i
  ];

  function youtubeId(url){
    for(const re of YT){
      const m = String(url || '').match(re);
      if(m) return m[1];
    }
    return null;
  }

  const isTikTok = url => /tiktok\.com\//i.test(String(url || ''));

  /* The one that needs no network call at all. hqdefault exists for every
     video; maxres does not, which is why it is not used. */
  const youtubeThumb = id => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

  /* Both platforms publish an oEmbed endpoint that answers cross-origin and
     needs no key. It carries the title as well as the thumbnail, which is the
     difference between "Untitled swipe" and knowing what you saved. */
  const OEMBED = {
    tiktok:  u => 'https://www.tiktok.com/oembed?url=' + encodeURIComponent(u),
    youtube: u => 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u)
  };

  /* Why this is not just fetch():

     Inside the app the page is served from localhost, so every request to
     another site is cross-origin. The browser refuses it unless that site
     sends a header allowing it — TikTok does, YouTube does not. So fetch()
     works in a browser tab for one of them and neither reliably on the phone.

     Capacitor ships a native HTTP client that makes the request outside the
     WebView, where that rule does not apply. Use it when it is there, and fall
     back to fetch for the preview in a desktop browser. */
  function nativeHttp(){
    const C = global.Capacitor;
    if(C && C.CapacitorHttp && C.CapacitorHttp.get) return C.CapacitorHttp;
    if(C && C.Plugins && C.Plugins.CapacitorHttp) return C.Plugins.CapacitorHttp;
    return null;
  }

  let lastError = null;               /* so a failure can be reported, not guessed at */
  const why = () => lastError;

  async function getJSON(url){
    const http = nativeHttp();
    if(http){
      try {
        const r = await http.get({ url, headers:{ Accept:'application/json' } });
        if(r && r.status >= 200 && r.status < 300){
          return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        }
        lastError = 'The platform answered ' + (r && r.status);
        return null;
      } catch(e){
        lastError = 'Native request failed: ' + (e && e.message || e);
        return null;
      }
    }

    try {
      const r = await fetch(url);
      if(!r.ok){ lastError = 'The platform answered ' + r.status; return null; }
      return await r.json();
    } catch(e){
      lastError = 'Blocked by the browser (no native HTTP available)';
      return null;
    }
  }

  async function oembed(url){
    const which = youtubeId(url) ? 'youtube' : isTikTok(url) ? 'tiktok' : null;
    if(!which){ lastError = 'That platform does not publish one'; return null; }
    lastError = null;
    const j = await getJSON(OEMBED[which](url));
    return j ? { title:(j.title || '').trim(), thumb:j.thumbnail_url || null,
                 author:(j.author_name || '').trim() } : null;
  }

  /* The only entry point worth calling: hand it a link, get a thumbnail url or
     null. Never throws, never leaves you waiting on a dead request. */
  async function forUrl(url){
    if(!url) return null;

    const yt = youtubeId(url);
    if(yt) return youtubeThumb(yt);

    if(isTikTok(url)){
      /* a request that never answers should not hold up saving the record */
      const got = await Promise.race([
        oembed(url),
        new Promise(res => setTimeout(() => res(null), 4000))
      ]);
      return got && got.thumb ? got.thumb : null;
    }

    return null;
  }

  /* What a link can tell you about itself, so a pasted one arrives named rather
     than as "Untitled swipe". */
  async function describe(url){
    if(!url) return null;
    const got = await Promise.race([
      oembed(url),
      new Promise(res => setTimeout(() => res(null), 4000))
    ]);
    if(!got) return null;

    const yt = youtubeId(url);
    return {
      title: got.title || '',
      author: got.author || '',
      /* the derived YouTube thumbnail beats the oEmbed one, which is often the
         small default */
      thumb: yt ? youtubeThumb(yt) : (got.thumb || null)
    };
  }

  /* ---- keeping it ---- */

  /* Downloading means it still works on a plane, and that the thumbnail cannot
     vanish when the post does. It is blocked as often as not, so a failure is
     not an error — the url stays and the image loads from the network. */
  async function download(thumbUrl){
    if(!thumbUrl) return null;

    /* the same cross-origin rule applies to the image itself */
    const http = nativeHttp();
    if(http){
      try {
        const r = await http.get({ url:thumbUrl, responseType:'blob' });
        if(!r || r.status < 200 || r.status >= 300) return null;
        /* the native client hands back base64 rather than a Blob */
        if(typeof r.data === 'string'){
          const bin = atob(r.data.replace(/^data:[^,]+,/, ''));
          const arr = new Uint8Array(bin.length);
          for(let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          const blob = new Blob([arr], { type:'image/jpeg' });
          return blob.size ? blob : null;
        }
        return r.data || null;
      } catch(e){ return null; }
    }

    try {
      const r = await fetch(thumbUrl, { mode:'cors' });
      if(!r.ok) return null;
      const blob = await r.blob();
      if(!blob || !blob.size || !/^image\//.test(blob.type || '')) return null;
      return blob;
    } catch(e){ return null; }
  }

  /* Find a thumbnail for a meal, keep a copy if we are allowed one, and record
     the url regardless. Returns what changed so the caller can save it. */
  async function attach(rec, store){
    const url = await forUrl(rec && rec.url);
    if(!url) return null;

    const blob = await download(url);
    if(blob && store){
      try {
        await Store.put(store, blob, rec.id);
        return { imageUrl:url, stored:true };
      } catch(e){ /* fall through to the url on its own */ }
    }
    return { imageUrl:url, stored:false };
  }

  /* Fill in whatever is missing across a set, without holding anything up: one
     at a time so a hundred saved links do not open a hundred requests, and
     skipping the ones that already have a cover. */
  async function backfill(records, store, save, opts){
    const nameIf = (opts && opts.nameIf) || (() => false);
    let n = 0;
    for(const r of records){
      if(!r || !r.url) continue;
      const wantsName = nameIf(r);
      if(r.imageUrl && !wantsName) continue;

      /* one call answers both questions, so an untitled entry with a cover
         still gets named rather than being skipped */
      const about = await describe(r.url);
      let changed = false;

      if(wantsName && about && about.title){
        r.title = about.title.slice(0, 120);
        changed = true;
      }
      if(!r.imageUrl){
        const got = await attach(r, store);
        if(got){ r.imageUrl = got.imageUrl; changed = true; }
      }

      if(!changed) continue;
      try { await save(r); n++; } catch(e){}
    }
    return n;
  }

  global.Thumb = { forUrl, download, attach, backfill, describe, oembed,
                   youtubeId, youtubeThumb, isTikTok, nativeHttp, why };
})(window);
