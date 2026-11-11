/* BoardLink — how the rest of the app opens the canvas.

   The canvas is Storyboard's, brought in whole as board/board.html and shown
   in a frame on the Board screen. It stores its boards in this app's database
   (store 'board-items'), so a backup carries them. Every episode and clip has
   its own board with a fixed id, made the first time it is opened; free
   boards and folders live under Content → Boards.

   Board status uses Storyboard's words. A clip's stage maps onto them so the
   board's Pipeline view and the clip agree. */
(function(global){

  const STATUS_FOR = { idea:'idea', planned:'ready', shot:'shot', editing:'edited', published:'published' };
  const statusFor = stage => STATUS_FOR[stage] || '';

  /* must match videoBoardId() in board/board.html */
  const boardIdFor = (type, id) => `vb-${type}-${String(id).replace(/[^\w-]/g, '_')}`;

  /* opts: { type:'vlog'|'clip', id, name, status, due, kicker, focus, onChange } — a video's board
           { board:<id> } — a particular board;  { side:true } — the boards list
     focus:'act:<id>' frames one day's sections instead of the whole board. */
  function open(opts){
    const o = opts || {};
    return Screens.push('board', o);
  }

  /* What goes after the # when the frame loads. */
  function hashFor(o){
    const q = new URLSearchParams();
    if(o.type && o.id != null){
      q.set('video', `${o.type}:${o.id}`);
      if(o.name) q.set('name', o.name);
      if(o.status) q.set('status', o.status);
      if(o.due) q.set('due', o.due);
    } else if(o.board) q.set('board', o.board);
    if(o.side) q.set('side', '1');
    /* focus=act:<id> opens a video's board showing one day's sections */
    if(o.focus) q.set('focus', o.focus);
    return q.toString();
  }

  /* The page itself. In the app it is a file next to index.html; the
     single-file preview carries it inline instead (build-preview.sh). */
  function frame(o){
    const f = document.createElement('iframe');
    f.className = 'bd-frame';
    f.title = 'Board';
    f.dataset.hash = hashFor(o);
    const inline = document.getElementById('cs3-board-src');
    /* written as '<' + '/script>' so this file can itself sit inside a script tag */
    if(inline) f.srcdoc = inline.textContent.split('<\\/script>').join('<' + '/script>');
    else f.src = 'board/board.html#' + f.dataset.hash;
    return f;
  }

  global.BoardLink = { open, frame, hashFor, boardIdFor, statusFor };
})(window);
