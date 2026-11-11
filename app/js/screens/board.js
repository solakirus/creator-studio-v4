/* Board — the canvas, full screen, over whatever opened it.

   A thin bar with the way back, then the frame. Everything inside the frame —
   cards, lines, views, the boards list, undo — is the canvas's own. */
(function(global){

  function mount(el, params){
    const o = params || {};
    const title = o.name || (o.side ? 'Boards' : 'Board');
    el.classList.add('bd-screen');
    el.innerHTML = Screens.bar({ kicker: o.kicker || 'Board', title }) +
      `<div class="bd-host"></div>`;
    const host = el.querySelector('.bd-host');
    host.appendChild(BoardLink.frame(o));

    /* edits on the board reach the episode at once; redraw the screen
       underneath so it is current when you come back */
    if(o.onChange && global.BoardSync){
      const off = BoardSync.onChange(() => { if(!el.isConnected) return off(); o.onChange(); });
    }
  }

  Screens.register('board', mount);
})(window);

/* Content → Boards: every board and folder, the boards list open. */
(function(){
  function mount(el){
    el.innerHTML = '<div class="bd-embed"></div>';
    el.querySelector('.bd-embed').appendChild(BoardLink.frame({ side:true }));
  }
  Screens.register('boards-home', mount);
})();
