/* Catching something shared into the app.

   You are scrolling, you see a video worth stealing from, you hit share and pick
   Creator Studio. This is the part that receives it and asks where it goes.

   Android hands that over in one of a few ways depending on what is installed in
   the native shell, so all of them are watched:
     1. the send-intent plugin, if the APK has it
     2. a deep link arriving through Capacitor's appUrlOpen
     3. plain query parameters, which is what a PWA share target uses and what
        makes this testable in a browser

   Everything below is the receiving half. The share sheet only lists the app
   once the native side declares it can receive — see the handover notes. */
(function(global){

  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

  /* the first http(s) link in whatever came across */
  const firstUrl = text => {
    const m = String(text || '').match(/https?:\/\/[^\s]+/);
    return m ? m[0] : '';
  };

  function sourceOf(url){
    const u = String(url).toLowerCase();
    if(u.includes('tiktok')) return 'tiktok';
    if(u.includes('youtube') || u.includes('youtu.be')) return u.includes('shorts') ? 'ytshort' : 'ytlong';
    if(u.includes('instagram')) return 'reel';
    if(u.includes('linkedin')) return 'linkedin';
    if(u.includes('twitter') || u.includes('x.com')) return 'x';
    return 'reel';
  }

  const LABEL = { tiktok:'TikTok', ytshort:'YouTube Short', ytlong:'YouTube',
                  reel:'Instagram', linkedin:'LinkedIn', x:'X' };

  /* ---- where it can go ---- */

  /* A recipe you found while scrolling. It arrives as a title and a link and
     nothing else, which is the point — you fill it in when you cook it. The
     link stays on the meal so you can go back to the video mid-cook, which is
     when you actually need it. */
  async function toMeal(share){
    const rec = {
      id: uid('m_'),
      title: (share.title || share.text || 'Saved recipe').slice(0, 90),
      category: 'Entrees',
      source: LABEL[sourceOf(share.url)] || sourceOf(share.url) || '',
      url: share.url || '',
      tags: ['to try'],
      ingredients: [],
      steps: [],
      note: share.text && share.text !== share.title ? String(share.text).slice(0, 400) : '',
      createdAt: Date.now()
    };
    await Store.put('meals', rec);
    if(window.Nutrition && Nutrition.invalidate) Nutrition.invalidate('meals');

    /* A thumbnail if the platform allows one — YouTube always, TikTok usually,
       Instagram never. Saving does not wait on it: the meal is already stored,
       and a picture arriving a second later is fine. */
    if(window.Thumb){
      Thumb.attach(rec, 'meal-photo').then(async got => {
        if(!got) return;
        rec.imageUrl = got.imageUrl;
        await Store.put('meals', rec);
        if(window.Nutrition && Nutrition.invalidate) Nutrition.invalidate('meals');
        if(window.Screens && Screens.refreshTop) Screens.refreshTop();
      }).catch(() => {});
    }

    return rec;
  }

  async function toSwipe(share){
    const rec = {
      id: uid('sw_'),
      url: share.url,
      title: share.title || share.text || share.url,
      source: sourceOf(share.url),
      hook:'', beats:[], why:'', transferable:'', myAngle:'',
      intent:'Education', channels:[], targets:[],
      createdAt: Date.now()
    };
    await Store.put('swipes', rec);

    /* the cover, where the platform allows one — the same path meals use */
    if(window.Thumb){
      Thumb.attach(rec, 'swipe-thumb').then(async got => {
        if(!got) return;
        rec.imageUrl = got.imageUrl;
        await Store.put('swipes', rec);
        if(window.Screens && Screens.refreshTop) Screens.refreshTop();
      }).catch(() => {});
    }

    return rec;
  }

  async function toNote(share){
    const rec = {
      id: uid('ib_'),
      text: [share.title, share.url].filter(Boolean).join('\n') || share.text || '',
      desc: share.text && share.title !== share.text ? share.text : '',
      subs: [],
      createdAt: Date.now()
    };
    await Store.put('inbox', rec);
    if(global.Data && Data.invalidate) Data.invalidate('inbox');
    return rec;
  }

  /* ---- asking ---- */

  function ask(share){
    if(!share || (!share.url && !share.text)) return;
    const from = share.url ? (LABEL[sourceOf(share.url)] || 'a link') : 'a note';

    App.sheet(`
      <h2 style="margin:0 0 3px">Shared from ${from}</h2>
      <p class="hintline" style="margin:0 0 14px">Where should it go?</p>

      <div class="sharecard">
        ${share.title ? `<b>${String(share.title).replace(/</g,'&lt;')}</b>` : ''}
        ${share.url ? `<span class="u">${String(share.url).replace(/</g,'&lt;')}</span>` : ''}
        ${share.text && share.text !== share.title
          ? `<p>${String(share.text).slice(0, 240).replace(/</g,'&lt;')}</p>` : ''}
      </div>

      <div class="qi-acts" style="margin:16px 0 0">
        <button data-to="swipe">Swipe file</button>
        <button data-to="meal">Meals</button>
        <button data-to="note">Notes</button>
        <button class="rm" data-to="drop">Discard</button>
      </div>

      <div class="sheetcta">
        <button class="btn-ghost" data-cancel>Decide later</button>
      </div>`, sheet => {
      sheet.addEventListener('click', async e => {
        if(e.target.closest('[data-cancel]')) return App.closeSheet();
        const to = e.target.closest('[data-to]');
        if(!to) return;

        App.closeSheet();
        if(to.dataset.to === 'drop') return;

        if(to.dataset.to === 'swipe'){
          const rec = await toSwipe(share);
          U.toast('Saved to the swipe file');
          if(global.Screens && Screens.push) Screens.push('swipe', { id:rec.id });
          return;
        }

        if(to.dataset.to === 'meal'){
          const rec = await toMeal(share);
          U.toast('Saved to Meals');
          /* opened straight away, because a title and a link is not yet a recipe
             and the moment you are most likely to type the rest is now */
          if(global.Screens && Screens.push) Screens.push('meal', { id:rec.id });
          return;
        }
        await toNote(share);
        U.toast('Saved to Notes');
        /* The other destinations open the thing they made, so the screen is
           right by definition. A note stays where it is, and nothing told the
           list underneath that it had gained one. */
        if(global.Screens && Screens.refreshTop) Screens.refreshTop();
        if(global.App && App.refreshTab) App.refreshTab();
      });
    });
  }

  /* ---- listening ---- */

  function fromQuery(search){
    const p = new URLSearchParams(search || '');
    const text = p.get('text') || p.get('share') || '';
    const url = p.get('url') || firstUrl(text);
    const title = p.get('title') || '';
    if(!url && !text) return null;
    return { url, title, text: text && text !== url ? text : '' };
  }

  /* what the send-intent plugin hands over */
  function fromIntent(res){
    if(!res) return null;
    const text = res.text || res.description || '';
    const url = res.url || firstUrl(text);
    if(!url && !text) return null;
    return { url, title: res.title || '', text: text && text !== url ? text : '' };
  }

  async function check(){
    /* a plain browser, or a PWA share target */
    const q = fromQuery(global.location && location.search);
    if(q){
      ask(q);
      /* take it out of the address bar so a refresh does not ask twice */
      try { history.replaceState({}, '', location.pathname); } catch(e){}
      return true;
    }

    const plugin = global.SendIntent ||
      (global.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SendIntent);
    if(plugin && plugin.checkSendIntentReceived){
      try {
        const got = fromIntent(await plugin.checkSendIntentReceived());
        if(got){ ask(got); return true; }
      } catch(e){ /* nothing was shared, which is the usual case */ }
    }
    return false;
  }

  function listen(){
    const cap = global.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
    if(cap && cap.addListener){
      /* a share can arrive while the app is already open */
      try {
        cap.addListener('appUrlOpen', data => {
          const u = data && data.url ? String(data.url) : '';
          const qs = u.includes('?') ? u.slice(u.indexOf('?')) : '';
          const got = fromQuery(qs) || (firstUrl(u) ? { url:firstUrl(u), title:'', text:'' } : null);
          if(got) ask(got);
        });
        cap.addListener('resume', () => check());
      } catch(e){ console.warn('Share listener unavailable', e); }
    }
    check();
  }

  global.Share = { listen, check, ask, toSwipe, toMeal, toNote, fromQuery, fromIntent, sourceOf, firstUrl };
})(window);
