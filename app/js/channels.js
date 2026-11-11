/* Channels — the brands you publish under. Editable, since they change. */
(function(global){
  const DEFAULTS = [
    { n:'1k Soldier of Life', c:'#3B9EFF' }, { n:'Fix & Invest', c:'#5BBE6A' },
    { n:'Soldilete', c:'#E1477E' }, { n:'Kris in Germany', c:'#E8A33D' },
    { n:'SOL Imaging', c:'#A855F7' }, { n:'Social bananza', c:'#E2564A' },
    { n:'Can i get ride', c:'#22C7B8' }, { n:'New channel', c:'#E2564A' }
  ];
  const PALETTE = ['#3B9EFF','#5BBE6A','#E1477E','#E8A33D','#A855F7','#E2564A','#22C7B8','#FB6900','#9AA0A6'];
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  /* A channel's commitment: which weekdays it publishes, how many, and where.
     days is an array of 0-6 with Sunday at 0, matching Date.getDay(). */
  const defaultSchedule = () => ({
    days:[], perDay:1, platform:'youtube', time:'18:00',
    shootDays:[], maxPerShoot:3          /* the days you are actually doing the thing */
  });

  let cache = null;
  async function all(){
    if(cache) return cache;
    const stored = await Store.get('settings','channels');
    cache = (stored && stored.length) ? stored : DEFAULTS.slice();
    if(!stored) await Store.put('settings', cache, 'channels');
    return cache;
  }
  async function save(list){ cache = list; await Store.put('settings', list, 'channels'); }
  const invalidate = () => cache = null;

  /* The same channel written two ways — "Can I Get A Ride" and "Can i get ride",
     "Tech It Out" and "Tech it Out", or a one-letter typo — should be one
     channel. Case, punctuation, "&"/"and" and little words don't count, and a
     couple of letters out is still a match on a longer name. */
  const SMALL = new Set(['a','an','the','and']);
  function norm(name){
    return String(name || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ')
      .split(' ').filter(w => w && !SMALL.has(w)).join(' ');
  }
  function distance(a, b){
    if(Math.abs(a.length - b.length) > 2) return 99;
    const d = Array.from({ length:a.length + 1 }, (_, i) => [i]);
    for(let j = 1; j <= b.length; j++) d[0][j] = j;
    for(let i = 1; i <= a.length; i++) for(let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    return d[a.length][b.length];
  }
  /* the saved channel a name most likely means, or null */
  function match(name, list){
    const n = norm(name);
    if(!n) return null;
    const exact = (list || []).find(c => c.n === name);
    if(exact) return exact;
    const same = (list || []).find(c => norm(c.n) === n);
    if(same) return same;
    if(n.length < 6) return null;
    let best = null, bd = 3;
    (list || []).forEach(c => { const dd = distance(norm(c.n), n); if(dd < bd){ bd = dd; best = c; } });
    return bd <= 2 ? best : null;
  }

  global.Channels = { all, save, invalidate, PALETTE, DAYS, defaultSchedule, norm, match };
})(window);
