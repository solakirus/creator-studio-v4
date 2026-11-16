/* nastime's address — one setting for everything that talks to nastime.

   Sync (Sync Hub on :8787, or through the app's own :8795), app updates
   (:8795/update.json), the Library (:8795/shotlib-index.json) and, on the
   laptop, the Shot Library share (\\nastime\shot-library) all live on the
   same box, so they share one host: an IP like 192.168.4.23, or a name that
   survives the router handing nastime a new IP — nastime.local.

   NasAddr.host()       the host in use ('' when none)
   NasAddr.set(host)    switch everything to that host (sync keeps its port)
   NasAddr.find()       look for nastime: its name, then the home network
   NasAddr.ask()        the sheet: one address, "Find nastime"

   When nastime stops answering, the app looks for it by itself (start, every
   30 minutes) and switches if it turns up somewhere new. */
(function(global){
  const APP_PORT = '8795';
  const NAMES = ['nastime.local', 'nastime', 'casaos.local'];
  const SEEN_KEY = 'cs4.nasHost';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  const native = () => !!(global.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const http = () => native() && global.Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp;

  /* "http://192.168.4.23:8787/x", "\\192.168.4.23\share", "nastime.local" → the host */
  function clean(v){
    let s = String(v || '').trim();
    if(!s) return '';
    s = s.replace(/^\\\\/, '').replace(/^[a-z]+:\/\//i, '').split(/[\/\\?#]/)[0];
    return s.replace(/:\d+$/, '').toLowerCase();
  }
  const pageHost = () => /^https?:$/.test(location.protocol) && !/(^|\.)github\.io$/i.test(location.hostname)
    && !native() ? location.hostname : '';

  async function syncServer(){ try { return global.Sync ? (await Sync.status()).server || '' : ''; } catch(e){ return ''; } }
  async function host(){
    const s = await syncServer();
    if(s) return clean(s);
    const n = global.Updater && Updater.nasAddress ? await Updater.nasAddress().catch(() => '') : '';
    if(n) return clean(n);
    return pageHost() || (() => { try { return localStorage.getItem(SEEN_KEY) || ''; } catch(e){ return ''; } })();
  }

  /* is nastime's app at this host? (update.json, readable from anywhere) */
  async function ping(h, ms){
    const url = `http://${h}:${APP_PORT}/update.json?t=${Date.now()}`;
    try {
      const H = http();
      if(H){
        const r = await H.request({ url, method:'GET', responseType:'json', connectTimeout:ms || 1500, readTimeout:ms || 1500 });
        const m = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        return !!(r.status < 400 && m && m.format === 'cs3-web');
      }
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 1500);
      try {
        const r = await fetch(url, { cache:'no-store', signal:ctl.signal });
        const m = r.ok ? await r.json() : null;
        return !!(m && m.format === 'cs3-web');
      } finally { clearTimeout(t); }
    } catch(e){ return false; }
  }

  /* where nastime is: the host in use, its name, then every address on the
     same home network as the last one seen. The page on GitHub (https) can't
     look at http addresses, so there it only tries what it can. */
  async function find(o){
    const opts = o || {};
    const cur = await host();
    const tried = new Set();
    const tryOne = async h => { if(!h || tried.has(h)) return false; tried.add(h); return ping(h, 1500); };
    for(const h of [cur, ...NAMES]) if(await tryOne(h)) return h;
    const m = /^(\d+\.\d+\.\d+)\.(\d+)$/.exec(cur || '');
    if(!m || opts.noScan) return '';
    const base = m[1], all = [];
    for(let i = 1; i < 255; i++) all.push(base + '.' + i);
    for(let i = 0; i < all.length; i += 48){
      if(opts.onProgress) opts.onProgress(i, all.length);
      const batch = all.slice(i, i + 48).filter(h => !tried.has(h));
      batch.forEach(h => tried.add(h));
      const hits = await Promise.all(batch.map(h => ping(h, 1200).then(ok => ok ? h : '')));
      const hit = hits.find(Boolean);
      if(hit) return hit;
    }
    return '';
  }

  /* switch everything to this host */
  async function set(v){
    const h = clean(v);
    if(!h) throw new Error('Type nastime’s address — nastime.local, or an IP like 192.168.4.23');
    const old = await host();
    const notes = [];
    /* Sync: same port as before (the laptop and phone use Sync Hub's :8787,
       the iPad the app's own :8795) */
    const srv = await syncServer();
    if(srv){
      const u = new URL(srv);
      if(clean(srv) !== h){
        u.hostname = h;
        await Sync.moveServer(u.origin);
        notes.push('sync');
      }
    }
    /* updates and the Library */
    if(global.Updater){
      /* its own address, unless it's worked out from Sync (which just moved) */
      let mine = ''; try { mine = localStorage.getItem('cs4-update-nas') || ''; } catch(e){}
      if(mine !== 'off' && (!srv || mine)) Updater.setNasAddress(`http://${h}:${APP_PORT}/`);
      notes.push('updates');
    }
    /* the laptop's Shot Library share (\\old\shot-library) */
    if(old && old !== h && global.MediaLib && MediaLib.disk && MediaLib.disk()){
      const s = await MediaLib.settings();
      const swap = p => typeof p === 'string' ? p.replace(new RegExp('^\\\\\\\\' + old.replace(/\./g, '\\.') + '(?=\\\\)', 'i'), '\\\\' + h) : p;
      const roots = (s.roots || []).map(swap);
      const mirrors = Object.fromEntries(Object.entries(s.mirrors || {}).map(([a, b]) => [swap(a), swap(b)]));
      if(JSON.stringify(roots) !== JSON.stringify(s.roots || []) || JSON.stringify(mirrors) !== JSON.stringify(s.mirrors || {})){
        await MediaLib.setSettings({ roots, mirrors });
        notes.push('library folders');
      }
      if(MediaLib.rescan) MediaLib.rescan().catch(() => {});
    }
    try { localStorage.setItem(SEEN_KEY, h); } catch(e){}
    if(global.MediaLib && MediaLib.probeRemote) MediaLib.probeRemote().catch(() => {});
    return { host:h, old, changed:notes };
  }

  /* the sheet */
  function ask(){
    return new Promise(async done => {
      const cur = await host();
      App.sheet(`<h2 style="margin:0 0 6px">nastime’s address</h2>
        <p class="hintline" style="margin:0 0 12px">One address for sync, app updates and the Library. <b>nastime.local</b> keeps working when the router gives nastime a new IP; an IP like 192.168.4.23 works too.</p>
        <div class="field"><label for="nasHost">Address</label>
          <input id="nasHost" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="nastime.local" value="${esc(cur)}"></div>
        <div class="sheetcta"><button class="btn-primary" data-nasgo>Use this address</button>
          <button class="btn-ghost" data-nasfind>🔎 Find nastime</button></div>
        <p class="hintline" data-nasmsg style="margin:10px 0 0"></p>
        <p class="hintline" style="margin:10px 0 0">Tip: in the router, a <b>DHCP reservation</b> for nastime keeps its IP the same for good.</p>`, sh => {
        const msg = sh.querySelector('[data-nasmsg]'), inp = sh.querySelector('#nasHost');
        const say = (t, bad) => { msg.innerHTML = t; msg.style.color = bad ? 'var(--red)' : ''; };
        sh.addEventListener('click', async e => {
          if(e.target.closest('[data-nasfind]')){
            say('Looking…');
            const h = await find({ onProgress:(i, n) => say(`Looking around the home network… ${Math.round(i / n * 100)}%`) });
            if(h){ inp.value = h; say(`Found nastime at <b>${esc(h)}</b> — press Use this address.`); }
            else say(native() || !/^https:/.test(location.protocol) ? 'Couldn’t find nastime. Is it on, and is this device on the home Wi-Fi?' : 'This page can’t look for nastime itself — type its address.', true);
            return;
          }
          if(e.target.closest('[data-nasgo]')){
            const b = e.target.closest('[data-nasgo]');
            b.disabled = true; say('Checking…');
            const h = clean(inp.value);
            if(h && !(await ping(h, 4000)) && !confirm(`nastime doesn’t answer at ${h} right now. Use it anyway?`)){ b.disabled = false; say(''); return; }
            try {
              const r = await set(inp.value);
              App.closeSheet();
              U.toast(`nastime is now ${r.host}${r.changed.length ? ' — ' + r.changed.join(', ') + ' switched' : ''}`);
              done(true);
            } catch(err){ b.disabled = false; say(esc(err.message || err), true); }
          }
        });
      });
    });
  }

  /* nastime stopped answering? look for it, and switch when it's somewhere new */
  let lastHunt = 0;
  async function hunt(){
    if(Date.now() - lastHunt < 25 * 60 * 1000) return;
    lastHunt = Date.now();
    const cur = await host();
    if(!cur || await ping(cur, 3000)) return;
    const h = await find();
    if(h && h !== cur){
      const r = await set(h).catch(() => null);
      if(r && global.U) U.toast(`nastime moved to ${h} — switched sync, updates and the Library over`);
    }
  }
  if(typeof document !== 'undefined' && !global.CS_NO_AUTORUN && (native() || global.CS3Lib)){
    setTimeout(() => { hunt().catch(() => {}); }, 20000);
    setInterval(() => { hunt().catch(() => {}); }, 30 * 60 * 1000);
  }

  global.NasAddr = { host, set, find, ping, ask, clean, hunt, NAMES };
})(window);
