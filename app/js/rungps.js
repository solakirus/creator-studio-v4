/* Following a run with the phone's GPS.

   Distance is worked out from the positions themselves rather than trusted from
   any one of them, because a phone lies about where it is constantly: a fix with
   a 60-metre error can jump you across a field while you stand still. So every
   point is filtered before it counts — poor accuracy is dropped, impossible
   speeds are dropped, and a stationary wobble is ignored.

   It needs a location permission the native shell has to declare. Without it
   this reports unavailable and the manual lap timer still works. */
(function(global){

  const R = 6371;   /* km */

  /* how far apart two fixes are, on a sphere */
  function haversine(a, b){
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  const ACC_LIMIT = 30;      /* metres: worse than this and the fix is noise */
  const MIN_MOVE = 0.004;    /* km: under 4m is a phone wobbling, not a step */
  const MAX_SPEED = 12.5;    /* m/s — faster than a sprint means a GPS jump */

  /* Decide whether a new fix counts, and for how much. Pure, so the rules can be
     tested without a phone or a walk. */
  function step(prev, next){
    if(next.acc != null && next.acc > ACC_LIMIT) return { km:0, why:'inaccurate' };
    if(!prev) return { km:0, why:'first' };

    const km = haversine(prev, next);
    const secs = Math.max(0.001, (next.t - prev.t) / 1000);
    const mps = (km * 1000) / secs;

    if(km < MIN_MOVE) return { km:0, why:'still' };
    if(mps > MAX_SPEED) return { km:0, why:'jumped' };
    return { km, why:'ok', mps };
  }

  /* Distance over a whole track, applying the same rules. */
  function distanceOf(points){
    let total = 0, prev = null;
    (points || []).forEach(p => {
      const s = step(prev, p);
      total += s.km;
      if(s.why !== 'inaccurate') prev = p;
    });
    return Math.round(total * 1000) / 1000;
  }

  /* Whole-unit splits, so you get the pace of each mile rather than one average
     that hides a collapse in the last one. */
  function splits(points, perKm){
    const out = [];
    let run = 0, prev = null, markAt = null, n = 0;
    (points || []).forEach(p => {
      if(markAt === null) markAt = p.t;
      const s = step(prev, p);
      run += s.km;
      if(s.why !== 'inaccurate') prev = p;
      const unitKm = perKm ? 1 : 1.609344;
      while(run >= unitKm){
        run -= unitKm;
        n++;
        out.push({ n, sec: Math.round((p.t - markAt) / 1000) });
        markAt = p.t;
      }
    });
    return out;
  }

  /* ---- the live side ---- */

  const plugins = () => (global.Capacitor && Capacitor.Plugins) || {};
  const bg = () => plugins().BackgroundGeolocation;

  const available = () => !!bg() || !!(global.navigator && navigator.geolocation) ||
    !!plugins().Geolocation;

  /* Which of the three is doing the work, so the screen can say so honestly —
     only the first keeps running with the phone locked. */
  function source(){
    if(bg()) return 'background';
    if(plugins().Geolocation) return 'foreground';
    if(global.navigator && navigator.geolocation) return 'browser';
    return 'none';
  }

  function track(onUpdate){
    if(!available()) return { stop(){}, ok:false };

    const points = [];
    let watchId = null, stopped = false;

    const take = pos => {
      if(stopped || !pos || !pos.coords) return;
      const p = { lat:pos.coords.latitude, lon:pos.coords.longitude,
                  acc:pos.coords.accuracy, t:pos.timestamp || Date.now() };
      const prev = points.length ? points[points.length - 1] : null;
      const s = step(prev, p);
      if(s.why !== 'inaccurate') points.push(p);
      onUpdate && onUpdate({
        km: distanceOf(points),
        acc: p.acc,
        points: points.length,
        moving: s.why === 'ok'
      });
    };

    const fail = err => onUpdate && onUpdate({ error: err && err.message ? err.message : 'no signal' });

    const opts = { enableHighAccuracy:true, maximumAge:1000, timeout:15000 };

    /* The background plugin runs as a foreground service with its own
       notification, which is the only thing Android will let keep feeding
       positions once the screen goes off. */
    const back = bg();
    if(back && back.addWatcher){
      let id = null;
      back.addWatcher({
        backgroundMessage:'Tracking your run',
        backgroundTitle:'Run in progress',
        requestPermissions:true,
        stale:false,
        distanceFilter:5
      }, (location, err) => {
        if(err) return fail(err);
        if(location) take({ coords:location, timestamp: location.time || Date.now() });
      }).then(w => { id = w; }).catch(fail);

      return {
        ok:true, points, background:true,
        stop(){ stopped = true; if(id && back.removeWatcher) back.removeWatcher({ id }); }
      };
    }

    const cap = plugins().Geolocation;

    if(cap && cap.watchPosition){
      cap.watchPosition(opts, (pos, err) => err ? fail(err) : take(pos))
        .then(id => { watchId = id; })
        .catch(fail);
      return {
        ok:true,
        points,
        stop(){ stopped = true; if(watchId != null && cap.clearWatch) cap.clearWatch({ id:watchId }); }
      };
    }

    watchId = navigator.geolocation.watchPosition(take, fail, opts);
    return {
      ok:true,
      points,
      stop(){ stopped = true; if(watchId != null) navigator.geolocation.clearWatch(watchId); }
    };
  }

  /* ---- surviving being killed ----

     With the screen locked Android can and does kill the WebView. The plugin
     keeps collecting, but the page it was feeding is gone. So the run in
     progress is written down as it happens, and picked back up on the way in
     rather than being lost with an hour of work in it. */
  const LIVE = 'run-live';

  async function saveLive(state){
    try { await Store.put('settings', { ...state, savedAt: Date.now() }, LIVE); }
    catch(e){ /* the run still works, it just will not survive a kill */ }
  }
  async function loadLive(){
    try { return await Store.get('settings', LIVE); } catch(e){ return null; }
  }
  async function clearLive(){
    try { await Store.del('settings', LIVE); } catch(e){}
  }

  /* A run left open for more than a day is not one you are still on. */
  const STALE_AFTER = 18 * 3600e3;
  function resumable(state){
    if(!state || !state.startedAt) return null;
    if(Date.now() - (state.savedAt || state.startedAt) > STALE_AFTER) return null;
    return state;
  }

  global.RunGPS = { available, source, track, step, distanceOf, splits, haversine,
                    saveLive, loadLive, clearLive, resumable, STALE_AFTER,
                    ACC_LIMIT, MIN_MOVE, MAX_SPEED };
})(window);
