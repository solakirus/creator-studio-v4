/* Morning paper — the app's side of the newspaper nastime prints each morning
   (nas/paper; PAPER.txt has the setup).

   The paper itself lives on nastime: it reads your plans from Sync Hub and
   prints by itself at its set time. The app only gives you two buttons:

     MorningPaper.print()      make today's paper now and print it
     MorningPaper.open()       the paper's page on nastime (preview, PDF, printer check)
     MorningPaper.status()     { printAt, printer, claude, history… } or null when nastime doesn't answer
     MorningPaper.base()       its address: http://<nastime>:8795/paper

   The phone talks to nastime outside the page (CapacitorHttp), so an http
   address works from its https://localhost page. */
(function(global){
  const PORT = '8795', DIRECT = '8796';
  const native = () => !!(global.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const H = () => native() && global.Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp;

  async function base(){
    /* opened from nastime itself (the iPad, https through Tailscale): same address */
    if(/^https?:$/.test(location.protocol) && !native() && !/(^|\.)github\.io$/i.test(location.hostname) &&
       !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return location.origin + '/paper';
    const h = global.NasAddr ? await NasAddr.host().catch(() => '') : '';
    return h ? `http://${h}:${PORT}/paper` : '';
  }

  /* Through Caddy (:8795/paper) first. Until the laptop has copied the new
     Caddyfile to nastime (update.bat), that answers 404 — then the paper's
     own port, :8796, straight. */
  async function call(method, path, ms){
    const b = await base();
    if(!b) throw new Error('Set nastime\'s address first (Settings → Sync)');
    try { return await once(method, b + path, ms); }
    catch(e){
      if(e.status !== 404 || !b.includes(':' + PORT + '/')) throw e;
      return once(method, b.replace(':' + PORT + '/', ':' + DIRECT + '/') + path, ms);
    }
  }
  const gone = () => { const e = new Error('The paper isn\'t set up on nastime yet (PAPER.txt)'); e.status = 404; return e; };
  async function once(method, url, ms){
    const http = H();
    if(http){
      const r = await http.request({ url, method, responseType:'json', connectTimeout:5000, readTimeout:ms || 15000,
        headers:{ 'Content-Type':'application/json' }, data: method === 'POST' ? {} : undefined });
      if(r.status === 404) throw gone();
      const d = typeof r.data === 'string' ? JSON.parse(r.data || '{}') : r.data;
      if(r.status >= 400 && !(d && d.message)) throw new Error('nastime answered ' + r.status);
      return d;
    }
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 15000);
    try {
      const r = await fetch(url, { method, signal:ctl.signal, cache:'no-store' });
      if(r.status === 404) throw gone();
      const d = await r.json();
      if(!r.ok && !(d && d.message)) throw new Error('nastime answered ' + r.status);
      return d;
    } catch(e){
      if(e.name === 'AbortError') throw new Error('nastime didn\'t answer in time');
      if(/Failed to fetch|NetworkError|Load failed/i.test(e.message)){ const x = new Error('Can\'t reach nastime'); throw x; }
      throw e;
    } finally { clearTimeout(t); }
  }

  async function status(){
    try { return await call('GET', '/status', 6000); } catch(e){ return null; }
  }

  let printing = false;
  async function print(when){
    if(printing) return U.toast('Already making it — one moment');
    printing = true;
    U.toast('Making the paper on nastime — Claude can take a minute…');
    try {
      const r = await call('POST', '/print?date=' + (when || 'today'), 300000);
      U.toast(r && r.ok ? `🗞 Printing — ${r.pages || 1} page${r.pages === 1 ? '' : 's'}` : `Not printed: ${(r && r.message) || 'no answer'}`);
      return r;
    } catch(e){ U.toast(e.message); return { ok:false, message:e.message }; }
    finally { printing = false; }
  }

  async function open(){
    const b = await base();
    if(!b) return U.toast('Set nastime\'s address first (Settings → Sync)');
    try { window.open(b + '/', '_blank'); } catch(e){ U.toast(b + '/'); }
  }

  global.MorningPaper = { base, status, print, open };
})(window);
