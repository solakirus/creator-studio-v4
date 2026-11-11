/* Aspect-ratio for browsers that don't have it.

   Much of the app sizes its pictures with CSS `aspect-ratio` — the swipe file
   covers, the Tools icons, reference stills, award tiles. Safari only learned
   it in version 15 (iPadOS 15), so on an older iPad every one of those boxes
   has no height at all: the swipe file shows titles with no covers, no badge
   and no play button, because they all live inside a box that is 0px tall.

   On those browsers only, this finds every element the app gives an
   aspect-ratio — in styles.css, in the <style> blocks some screens inject, and
   in inline style="" attributes — and sets its height from its width, keeping
   it right as the screen resizes and as screens are drawn. Anywhere
   aspect-ratio works, it does nothing at all. */
(function(){
  const force = window.CS_FORCE_ASPECT_SHIM;
  const native = window.CSS && CSS.supports && CSS.supports('aspect-ratio', '1 / 1');
  if(native && !force) return;
  if(typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return;

  /* "4/5" → 1.25 (height per unit of width) */
  function ratioOf(v){
    const m = String(v).trim().match(/^([\d.]+)\s*(?:\/\s*([\d.]+))?/);
    if(!m) return 0;
    const w = +m[1], h = m[2] ? +m[2] : 1;
    return w > 0 && h > 0 ? h / w : 0;
  }

  const rules = new Map();          /* selector -> ratio */
  function scanCss(text){
    String(text).replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/([^{}]+)\{([^{}]*?aspect-ratio\s*:\s*([^;}]+))/g, (_, sel, body, val) => {
        const r = ratioOf(val);
        if(!r) return '';
        sel.split(',').map(s => s.trim()).filter(s => s && !s.startsWith('@') && !s.includes('::'))
          .forEach(s => rules.set(s, r));
        return '';
      });
  }

  const tracked = new WeakSet();
  const ro = new ResizeObserver(entries => entries.forEach(e => size(e.target)));
  function size(el){
    const r = +el.dataset.ar;
    if(!r) return;
    const w = el.getBoundingClientRect().width;
    if(w) el.style.height = (w * r) + 'px';
  }
  function track(el, r){
    if(!el.dataset.ar) el.dataset.ar = r;
    if(tracked.has(el)) return size(el);
    tracked.add(el);
    ro.observe(el);
    size(el);
  }

  const seenStyles = new WeakSet();
  function scan(){
    /* <style> blocks screens add as they open */
    document.querySelectorAll('style').forEach(s => {
      if(seenStyles.has(s)) return;
      seenStyles.add(s); scanCss(s.textContent);
    });
    rules.forEach((r, sel) => {
      let list;
      try { list = document.querySelectorAll(sel); } catch(e){ rules.delete(sel); return; }
      list.forEach(el => track(el, r));
    });
    /* inline style="aspect-ratio:16/9". The browser drops a property it does not
       know once the style is rewritten, so the ratio is kept in data-ar. */
    document.querySelectorAll('[style*="aspect-ratio"]').forEach(el => {
      const m = el.getAttribute('style').match(/aspect-ratio\s*:\s*([^;]+)/);
      const r = m && ratioOf(m[1]);
      if(r) track(el, r);
    });
  }

  let queued = false;
  function soon(){
    if(queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }

  /* the app's own stylesheets, read as text: a browser that does not know a
     property leaves it out of the parsed rules, so the text is the only place
     it survives */
  const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map(l => l.getAttribute('href'))
    .filter(h => h && !/^(https?:)?\/\//.test(h));
  Promise.all(sheets.map(h => fetch(h).then(r => r.ok ? r.text() : '').catch(() => '')))
    .then(texts => { texts.forEach(scanCss); scan(); });

  const start = () => {
    new MutationObserver(soon).observe(document.body, { childList: true, subtree: true });
    soon();
  };
  if(document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  window.AspectFix = { scan, rules };
})();
