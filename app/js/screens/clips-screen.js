/* Clips as a pushed screen, now that the tab bar belongs to Profile. */
(function(){
  async function mount(el, params){
    /* hosted in the Content tab there is no stack to go back to */
    const embedded = !!(params && params.embedded);
    /* Creator Studio 3: Ideas sits on top — a fixed strip, not a second .view */
    el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Creator studio', title:'Clips' })) +
                   `<div class="ci-strip"><button class="ci-open" data-ideas>✦ Ideas — pitch, keep, draft a clip</button></div>` +
                   '<div class="view" id="clipsHost"></div>';
    const host = el.querySelector('#clipsHost');
    el.querySelector('[data-ideas]').addEventListener('click', () =>
      Screens.push('clip-ideas', { onChange: () => ViewClips.mount(host) }));
    /* reuse the tab view wholesale — it already knows how to render itself */
    await ViewClips.mount(host);
  }
  Screens.register('clips-screen', mount);
})();
