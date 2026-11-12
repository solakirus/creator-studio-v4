/* v4: a series' video is a clip now (clipflow.js), opened on the clip page with
   Plan · Shoot · Edit · Post. This screen is kept only so anything still
   asking for 'video-page' (an old link, an older build's board) lands there:
   it turns the video into its clip if that hasn't happened yet, then swaps
   itself for the clip page.

     Screens.push('video-page', { id, onChange }) */
(function(global){
  async function mount(el, params){
    el.innerHTML = Screens.bar({ title:'Opening…' }) + '<div class="view"></div>';
    let cid = null;
    try {
      if(global.ClipFlow) await ClipFlow.migrate();
      const v = await Store.get('videos', params.id).catch(() => null);
      cid = (v && v.movedTo) || (global.ClipFlow ? ClipFlow.idFor(params.id) : null);
      if(cid && !(await Store.get('clips', cid).catch(() => null))) cid = null;
    } catch(e){ cid = null; }
    if(!cid){
      el.innerHTML = Screens.bar({ title:'Video' }) + '<div class="view"><div class="empty"><b>Gone</b>This video isn’t here any more.</div></div>';
      return;
    }
    Screens.replace('clip', { id:cid, onChange:params.onChange });
  }
  Screens.register('video-page', mount);
})(window);
