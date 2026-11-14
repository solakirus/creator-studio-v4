/* Embedding a video, rather than fetching a picture of it.

   The thumbnail chase was the wrong problem. Notion does not download a cover
   when you paste a TikTok — it embeds the platform's own player, which renders
   its poster frame for free. No request from us, no cross-origin rule, nothing
   to store, and it still works on a link posted yesterday.

   Every platform here publishes an embed URL derived from the link itself, so
   this is string work, not network work:

     YouTube   — youtube.com/embed/<id>
     TikTok    — tiktok.com/embed/v2/<id>
     Instagram — instagram.com/<p|reel>/<code>/embed
     Facebook  — facebook.com/plugins/video.php?href=<the whole url>, which is
                 why this one is passed through rather than picked apart
     X         — no keyless embed that renders in a plain iframe; its widget
                 needs their script, which is more than a preview is worth.

   The one thing to be careful of: an iframe per card is a page-load each. They
   are lazy so nothing loads until you scroll to it. */
(function(global){

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

  /* the long digit string at the end of a TikTok video url */
  function tiktokId(url){
    /* tiktokv.com/share/video/<id> is the form a TikTok data download uses */
    const m = String(url || '').match(/tiktokv?\.com\/[^?#]*\/video\/(\d{6,})/i);
    return m ? m[1] : null;
  }

  /* Facebook's plugin takes the video's address whole. It answers "video
     unavailable" for anything but the plain address of a public video, so a
     link is tidied first: www, not m./web./mbasic.; no tracking on the end; a
     reel as /reel/<id>/. A share link (/share/r/…, fb.watch) can't be tidied
     here — the swipe player resolves it to the real address first. */
  function facebookUrl(url){
    const u = String(url || '');
    if(!/(?:^|\.)facebook\.com\//i.test(u) && !/(?:^|\/\/)fb\.watch\//i.test(u)) return null;
    /* a profile or a page is not a video, and the plugin shows an error box */
    if(!/\/(?:videos?|reels?|watch|share\/[rv])\//i.test(u) && !/fb\.watch\//i.test(u)) return null;
    let p;
    try { p = new URL(u); } catch(e){ return u; }
    if(/fb\.watch$/i.test(p.hostname) || /^\/share\//i.test(p.pathname)) return u;
    const v = p.searchParams.get('v');
    if(v && /^\d+$/.test(v)) return `https://www.facebook.com/watch/?v=${v}`;
    const reel = (p.pathname.match(/\/reels?\/(\d{6,})/i) || [])[1];
    if(reel) return `https://www.facebook.com/reel/${reel}/`;
    return `https://www.facebook.com${p.pathname.replace(/\/+$/, '')}/`;
  }
  /* a link Facebook's player can't use as it is: it has to be followed to
     the video's real address first */
  const facebookNeedsResolving = url => /(?:^|\/\/)fb\.watch\//i.test(String(url || '')) ||
    /facebook\.com\/share\//i.test(String(url || ''));

  /* YouTube's player is loaded through yt.html on the app's own site, so it
     has a real origin and referrer (see yt.html for why). The page itself
     when it is served over https from a real host (GitHub Pages, nastime over
     Tailscale); otherwise — the Android app, the laptop app, a file — the
     GitHub Pages copy. */
  const PAGES = 'https://solakirus.github.io/creator-studio-v4/';
  function relayBase(){
    try {
      const l = global.location;
      if(l && l.protocol === 'https:' && !/^(localhost|127\.|\[::1\])/i.test(l.hostname)) return new URL('.', l.href).href;
    } catch(e){}
    return PAGES;
  }

  /* posts, reels and tv all embed the same way */
  function instagramCode(url){
    const m = String(url || '').match(/instagram\.com\/(?:p|reel|reels|tv)\/([\w-]{5,})/i);
    return m ? m[1] : null;
  }

  /* The embed url for a link, or null when the platform has none worth using. */
  function forUrl(url){
    if(!url) return null;

    const yt = youtubeId(url);
    if(yt) return { kind:'youtube',
                    /* through yt.html: no autoplay unless asked, no related videos */
                    src:`${relayBase()}yt.html?v=${yt}`,
                    ratio:'56.25%' };

    const tt = tiktokId(url);
    if(tt) return { kind:'tiktok', src:`https://www.tiktok.com/embed/v2/${tt}`,
                    ratio:'150%' };      /* portrait, and their chrome is tall */

    const ig = instagramCode(url);
    if(ig) return { kind:'instagram', src:`https://www.instagram.com/p/${ig}/embed`,
                    ratio:'125%' };

    const fb = facebookUrl(url);
    if(fb) return { kind:'facebook',
                    src:`https://www.facebook.com/plugins/video.php?href=${
                      encodeURIComponent(fb)}&show_text=false`,
                    ratio:'100%' };      /* they come both ways up, so square */

    return null;
  }

  const can = url => !!forUrl(url);

  /* A poster image where one can be derived without asking anybody. YouTube is
     the only platform that gives this away in its url; the others need the
     embed. */
  function poster(url){
    const yt = youtubeId(url);
    return yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : null;
  }

  /* The iframe itself. Lazy by default: a grid of these should cost nothing
     until it is scrolled into view. */
  function html(url, opts){
    const e = forUrl(url);
    if(!e) return '';
    const o = opts || {};
    const ratio = o.ratio || e.ratio;
    return `<span class="embed embed-${e.kind}" style="padding-bottom:${ratio}">
      <iframe src="${e.src}" loading="lazy" frameborder="0" scrolling="no" referrerpolicy="strict-origin-when-cross-origin"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen title="Preview"></iframe>
    </span>`;
  }

  global.Embed = { forUrl, can, poster, html, relayBase, facebookNeedsResolving,
                   youtubeId, tiktokId, instagramCode, facebookUrl };
})(window);
