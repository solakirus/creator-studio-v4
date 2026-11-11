/* The app's palette.

   Every colour in the stylesheet comes from a variable on :root, so a different
   look is an attribute on <html> rather than a second build of the app. That
   matters: one codebase means a fix reaches both of you, and she keeps her own
   data because it is her phone.

   Applied before first paint (see the inline call in index.html) so the app does
   not flash dark and then turn pink. */
(function(global){

  /* the hue; the ground is chosen separately, so each of these has a light and
     a dark version rather than being one or the other */
  const PALETTES = [
    { k:'studio', n:'Studio', d:'Orange',       light:'#FAF7F2', dark:'#151515', acc:'#FB6900' },
    { k:'blush',  n:'Blush',  d:'Pink',         light:'#FDF7F8', dark:'#1B1318', acc:'#E0629A' },
    { k:'plum',   n:'Plum',   d:'Deeper pink',  light:'#FCF5FA', dark:'#191320', acc:'#C95BA0' },
    { k:'lilac',  n:'Lilac',  d:'Purple',       light:'#F8F6FD', dark:'#161320', acc:'#8B6FD4' },
    { k:'mint',   n:'Mint',   d:'Green',        light:'#F4FAF6', dark:'#111A16', acc:'#3F9E77' },
    { k:'peach',  n:'Peach',  d:'Warm orange',  light:'#FFF8F3', dark:'#1B1310', acc:'#E8794B' }
  ];

  const MODES = [
    { k:'dark',  n:'Dark' },
    { k:'light', n:'Light' }
  ];

  /* The typeface is a separate choice from the colours — someone may want the
     rounded one on the dark palette, or the pinks with the original type. */
  const TYPES = [
    { k:'sharp', n:'Studio', d:'Red Hat Display, heavy and tight' },
    { k:'soft',  n:'Soft',   d:'Quicksand and Nunito, rounded' }
  ];

  const KEY = 'cs-palette';
  const MKEY = 'cs-mode';
  const TKEY = 'cs-type';
  const known = k => PALETTES.some(p => p.k === k);
  const knownMode = k => MODES.some(m => m.k === k);
  const knownType = k => TYPES.some(t => t.k === k);

  /* localStorage rather than the database: this has to be readable before the
     first paint, and opening IndexedDB is asynchronous. */
  /* An install from before this existed stored 'dark' as a palette; that is a
     ground, not a hue, so it reads as the original Studio look. */
  function current(){
    try {
      const k = localStorage.getItem(KEY);
      return known(k) ? k : 'studio';
    } catch(e){ return 'studio'; }
  }

  function currentMode(){
    try {
      const k = localStorage.getItem(MKEY);
      if(knownMode(k)) return k;
      /* an old install that had picked one of the light palettes should stay
         light rather than flipping to black on this update */
      const old = localStorage.getItem(KEY);
      return (old && old !== 'dark' && old !== 'plum' && known(old)) ? 'light' : 'dark';
    } catch(e){ return 'dark'; }
  }

  function apply(k, mode){
    const hue = known(k) ? k : 'studio';
    const use = knownMode(mode) ? mode : currentMode();
    const el = document.documentElement;
    el.setAttribute('data-palette', hue);
    el.setAttribute('data-mode', use);

    /* the phone's own chrome — status bar, address bar — should match */
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta){
      const p = PALETTES.find(x => x.k === hue);
      meta.setAttribute('content', p ? p[use] : '#151515');
    }
    return hue;
  }

  function set(k){
    const use = apply(k, currentMode());
    try { localStorage.setItem(KEY, use); } catch(e){}
    return use;
  }

  function setMode(m){
    const use = knownMode(m) ? m : 'dark';
    apply(current(), use);
    try { localStorage.setItem(MKEY, use); } catch(e){}
    return use;
  }

  function currentType(){
    try {
      const k = localStorage.getItem(TKEY);
      return knownType(k) ? k : 'sharp';
    } catch(e){ return 'sharp'; }
  }

  function applyType(k){
    const use = knownType(k) ? k : 'sharp';
    const el = document.documentElement;
    if(use === 'sharp') el.removeAttribute('data-type');
    else el.setAttribute('data-type', use);
    return use;
  }

  function setType(k){
    const use = applyType(k);
    try { localStorage.setItem(TKEY, use); } catch(e){}
    return use;
  }

  /* called from index.html before the body renders */
  function boot(){ apply(current(), currentMode()); applyType(currentType()); }

  global.Palette = { PALETTES, MODES, TYPES, current, set, apply,
                     currentMode, setMode,
                     currentType, setType, applyType, boot };
})(window);
