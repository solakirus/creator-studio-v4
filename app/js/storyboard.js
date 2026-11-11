/* The link between this app and the storyboard app.

   Both are Capacitor apps on the same phone, so each declares a URL scheme and
   Android does the switching. Nothing is shared between their databases — what
   travels is an id and a way back.

     out:  storyboard://board/<id>?from=creatorstudio&back=<a link to here>
     in:   com.creatorstudio.v2://go/vlog/<id>   (handled in js/shortcuts.js)

   The return link is the part worth having. Jumping to a board and then hunting
   for where you came from is worse than not jumping at all, so every link out
   carries the way back.

   For this to work the storyboard app has to declare the scheme in its
   manifest and route the path on launch — the same two things this app already
   does. See native/STORYBOARD.md. */
(function(global){

  const SCHEME = 'storyboard';
  const SELF = 'cs3';

  /* Whether anything can open a link at all. In a browser this is a no-op that
     opens a tab and fails quietly; on the phone it switches apps. */
  const canOpen = () => typeof global.open === 'function';

  /* A link back to a particular thing in this app. */
  function backLink(kind, id){
    return `${SELF}://go/${kind}/${encodeURIComponent(id)}`;
  }

  /* The link out. `board` is whatever id the storyboard app uses; it is stored
     here as an opaque string and never parsed. */
  function boardLink(board, back){
    const q = back ? `?from=creatorstudio&back=${encodeURIComponent(back)}` : '';
    return `${SCHEME}://board/${encodeURIComponent(board)}${q}`;
  }

  /* Open a board, carrying the way back to wherever you are. */
  function openBoard(board, back){
    if(!board) return false;
    const url = boardLink(board, back);
    try {
      global.open(url, '_system');
      return true;
    } catch(e){
      try { global.location.href = url; return true; }
      catch(e2){ return false; }
    }
  }

  /* An id pasted from the other app may arrive as a whole link rather than a
     bare id — take either, since which one you get depends on how that app
     offers it. */
  function idFrom(text){
    const s = String(text || '').trim();
    if(!s) return '';
    const m = s.match(/board\/([\w-]+)/i);
    return m ? m[1] : s.replace(/^\/+|\/+$/g, '');
  }

  global.Storyboard = { SCHEME, boardLink, backLink, openBoard, idFrom, canOpen };
})(window);
