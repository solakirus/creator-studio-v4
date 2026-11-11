/* Showing the movement, full screen, without leaving what you were doing.
   Called from the picker, the library, and mid-workout. */
(function(global){

  async function show(id, name){
    const host = document.getElementById('demoview');
    if(!host) return;

    const src = await Exercises.demoFor(id);
    const all = await Exercises.all();
    const x = all.find(e => e.id === id) || { name, pri:[], sec:[] };

    host.innerHTML = `
      ${src ? `<img src="${src}" alt="${x.name || name}">`
            : `<p class="none">No image for this one yet. Add a GIF in the library and it will
                 play here while you lift.</p>`}
      <h3>${x.name || name || 'Exercise'}</h3>
      <div class="tags">
        ${(x.pri || []).map(m => `<span class="mtag" style="--mc:${Exercises.colour(m)}">${Exercises.label(m)}</span>`).join('')}
        ${(x.sec || []).map(m => `<span class="mtag sec" style="--mc:${Exercises.colour(m)}">${Exercises.label(m)}</span>`).join('')}
      </div>
      <button class="close" data-close>Back to the set</button>`;

    host.classList.add('on');
    host.onclick = e => {
      /* anywhere outside the image closes it — you have a bar in your hands */
      if(e.target.closest('[data-close]') || e.target === host) hide();
    };
  }

  function hide(){
    const host = document.getElementById('demoview');
    if(!host) return;
    host.classList.remove('on');
    setTimeout(() => { host.innerHTML = ''; }, 220);
  }

  global.DemoPlay = { show, hide };
})(window);
