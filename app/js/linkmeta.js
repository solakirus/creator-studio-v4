/* LinkMeta — fetch the title, creator and cover image for a pasted link.

   Inside the Android app, requests go through Capacitor's native HTTP, which
   is not bound by the browser's cross-site rules, so Instagram, TikTok and
   Facebook pages can be read directly. In a plain browser only YouTube works
   (through noembed, which allows cross-site reads); everything else returns
   what it can and the swipe keeps its link.

   get(url) → { title, author, authorUrl, image, finalUrl } — any field may be
   empty. Never throws. */
(function(global){

  const cap = () => global.Capacitor;
  const http = () => cap() && cap().Plugins && cap().Plugins.CapacitorHttp;
  const native = () => !!(http() && cap().isNativePlatform && cap().isNativePlatform());

  /* Social sites hand full link-preview tags to their own crawler. */
  const CRAWLER = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
  const TIMEOUT = 12000;

  async function getText(url, headers){
    if(native()){
      const r = await http().get({ url, headers: headers || {}, responseType:'text',
                                    connectTimeout:TIMEOUT, readTimeout:TIMEOUT });
      return { status:r.status, text: typeof r.data === 'string' ? r.data : JSON.stringify(r.data || ''),
               url: r.url || url };
    }
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const r = await fetch(url, { headers, signal:ctl.signal });
      return { status:r.status, text: await r.text(), url: r.url || url };
    } finally { clearTimeout(t); }
  }

  async function getJSON(url){
    const r = await getText(url, { Accept:'application/json' });
    if(r.status >= 400) return null;
    try { return JSON.parse(r.text); } catch(e){ return null; }
  }

  /* An image as a Blob, ready to store as a swipe cover. */
  async function getImage(url){
    try {
      if(native()){
        const r = await http().get({ url, responseType:'blob', headers:{ 'User-Agent':CRAWLER },
                                      connectTimeout:TIMEOUT, readTimeout:TIMEOUT });
        if(r.status >= 400 || !r.data) return null;
        const type = (r.headers && (r.headers['Content-Type'] || r.headers['content-type'])) || 'image/jpeg';
        const bin = atob(String(r.data).replace(/^data:[^,]+,/, ''));
        const bytes = new Uint8Array(bin.length);
        for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: type.split(';')[0] });
      }
      const r = await fetch(url);
      if(!r.ok) return null;
      const b = await r.blob();
      return b.type.startsWith('image/') ? b : null;
    } catch(e){ return null; }
  }

  const ENT = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", '#39':"'", nbsp:' ' };
  function decode(s){
    return String(s || '')
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
      .replace(/&([a-z0-9#]+);/gi, (m, k) => ENT[k.toLowerCase()] !== undefined ? ENT[k.toLowerCase()] : m)
      .trim();
  }
  function meta(html, prop){
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
    const m = re1.exec(html) || re2.exec(html);
    return m ? decode(m[1]) : '';
  }

  /* A caption makes a better title than "Instagram reel" — first line, trimmed. */
  function tidy(t, max){
    t = String(t || '').replace(/\s+/g, ' ').trim();
    const first = t.split(/(?<=[.!?])\s|\s[|•]\s/)[0] || t;
    t = first.length >= 12 ? first : t;
    return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
  }

  const isYT = u => /youtu\.?be/i.test(u);
  const isTT = u => /tiktok\.com/i.test(u);
  const isIG = u => /instagram\.com/i.test(u);
  const isFB = u => /facebook\.com|fb\.watch/i.test(u);

  async function youtube(url){
    const j = native()
      ? await getJSON(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`)
      : await getJSON(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    if(!j || j.error) return {};
    return { title: tidy(j.title, 90), author: j.author_name || '', authorUrl: j.author_url || '' };
  }

  async function tiktok(url){
    let finalUrl = url;
    /* vm.tiktok.com short links: follow them to the full /@name/video/123 link */
    if(/vm\.tiktok|vt\.tiktok|tiktok\.com\/t\//i.test(url)){
      try { const r = await getText(url, { 'User-Agent':CRAWLER }); if(r.url) finalUrl = r.url.split('?')[0]; } catch(e){}
    }
    const j = await getJSON(`https://www.tiktok.com/oembed?url=${encodeURIComponent(finalUrl)}`);
    if(!j) return { finalUrl };
    return { finalUrl, title: tidy(j.title, 90), author: j.author_name || j.author_unique_id || '',
             authorUrl: j.author_url || '', image: j.thumbnail_url || '' };
  }

  async function page(url){
    const r = await getText(url, { 'User-Agent':CRAWLER, 'Accept-Language':'en-US,en;q=0.8' });
    if(r.status >= 400 || !r.text) return {};
    const h = r.text;
    const ogTitle = meta(h, 'og:title'), ogDesc = meta(h, 'og:description') || meta(h, 'description');
    const out = { image: meta(h, 'og:image'), finalUrl: meta(h, 'og:url') || '' };

    if(isIG(url)){
      /* og:title: "Name (@handle) • Instagram reel" or "Name on Instagram: "caption""
         og:description: "123 likes, 4 comments - handle on May 1, 2024: "caption"" */
      const handle = (/\(@([\w.]+)\)/.exec(ogTitle) || / - ([\w.]+) on [A-Z]/.exec(ogDesc) || [])[1] || '';
      const cap = (/:\s*["“](.+?)["”]\.?\s*$/s.exec(ogDesc) || /:\s*["“](.+?)["”]/s.exec(ogTitle) || [])[1] || '';
      out.author = handle || (ogTitle.split(/ on Instagram| \(@/)[0] || '');
      out.authorUrl = handle ? `https://www.instagram.com/${handle}/` : '';
      out.title = tidy(cap || '', 90);
      return out;
    }
    if(isFB(url)){
      /* Facebook puts the caption in og:title or og:description, often with
         "| By Name | ..." on the end */
      const by = /\|\s*By ([^|]+?)\s*\|/.exec(ogTitle + ' ' + ogDesc);
      out.author = by ? by[1].trim() : '';
      const t = (ogTitle && !/^(facebook|watch|log in)/i.test(ogTitle)) ? ogTitle : ogDesc;
      out.title = tidy(t.replace(/\|\s*By [^|]+\|?.*$/, '').replace(/\s*\|\s*Facebook\s*$/i, ''), 90);
      return out;
    }
    out.title = tidy(ogTitle || (/<title[^>]*>([^<]*)<\/title>/i.exec(h) || [])[1] || '', 90);
    out.title = decode(out.title);
    out.author = meta(h, 'og:site_name');
    return out;
  }

  async function get(url){
    try {
      if(isYT(url)) return await youtube(url);
      if(isTT(url)){
        const t = await tiktok(url);
        if(t.title || t.author || !native()) return t;
        return { ...(await page(t.finalUrl || url)), finalUrl: t.finalUrl };
      }
      if(!native()) return {};      /* a browser can't read these sites */
      return await page(url);
    } catch(e){
      console.warn('LinkMeta', url, e);
      return {};
    }
  }

  global.LinkMeta = { get, getImage, native, isYT };
})(window);
