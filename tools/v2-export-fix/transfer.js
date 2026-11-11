/* Backup and import. JSON round-trips the whole database; CSV brings in
   lists from elsewhere. Photos and voice notes stay on the device — they
   would bloat a backup into something you can't email. */
(function(global){
  /* every store that holds records rather than binary */
  const RECORD_STORES = ['tasks','series','clips','meals','templates','planner','grocery',
                         'pantry','prep','sessions','swipes','refs','journal',
                         /* episodes and the challenge months they belong to */
                         'vlogs','months',
                         /* the research library and the quarters it was gathered for */
                         'sources','quarters',
                         /* series videos and program plans */
                         'videos','plans'];
  const KEYED_STORES  = ['settings'];   /* key/value, needs its keys preserved */

  /* ---- Export everything: every store, read from the database itself ----
     (Patched 2026-10-10 for the move to Creator Studio 3. Only the export
     changed: it used to carry 19 hand-listed stores and silently dropped
     episodes' quarters and months, runs, routines and every picture. It still
     only READS the database. Restore below is untouched.)
     Pictures go in as { __blob:<type>, b64:<data> }; Creator Studio 3 reads
     them back. Settings named 'secret:…' (API keys) are left out. */
  function blobToB64(blob){
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] || '');
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }
  async function encode(v, stats){
    if(v === null || typeof v !== 'object') return v;
    if(typeof Blob !== 'undefined' && v instanceof Blob){
      stats.blobs++; return { __blob: v.type || 'application/octet-stream', b64: await blobToB64(v) };
    }
    if(v instanceof Date) return { __date: v.toISOString() };
    if(v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return encode(new Blob([v]), stats);
    if(Array.isArray(v)){ const o = []; for(const x of v) o.push(await encode(x, stats)); return o; }
    const o = {};
    for(const [k, x] of Object.entries(v)){ const e = await encode(x, stats); if(e !== undefined) o[k] = e; }
    return o;
  }
  async function exportAll(){
    const out = { format:'creator-studio', version:2, app:'creator-studio-v2', exportedAt:new Date().toISOString(),
                  photos:true, data:{}, keyed:{} };
    const stats = { blobs:0 };
    const d = await Store.db();
    const names = [...d.objectStoreNames];
    const tx = d.transaction(names, 'readonly');
    const keyPaths = {};
    names.forEach(n => { keyPaths[n] = tx.objectStore(n).keyPath || null; });
    for(const s of names){
      let got;
      try { got = await Store.all(s); } catch(e){ console.warn('Could not read', s, e); continue; }
      if(keyPaths[s]){
        const rows = [];
        for(const v of got.values) rows.push(await encode(v, stats));
        out.data[s] = rows;
      } else {
        const pairs = [];
        for(let i = 0; i < got.keys.length; i++){
          if(s === 'settings' && /^secret:/.test(String(got.keys[i]))) continue;
          pairs.push([got.keys[i], await encode(got.values[i], stats)]);
        }
        out.keyed[s] = pairs;
      }
    }
    return out;
  }

  async function importAll(obj, mode){
    if(!obj || obj.format !== 'creator-studio') throw new Error('Not a Creator Studio backup');
    if(mode === 'replace'){
      /* Only clear what the backup actually carries. A backup made before a store
         was added has no entry for it, and replacing with that file must not wipe
         it — that is how restoring an older backup would lose every episode. */
      for(const s of RECORD_STORES) if(Array.isArray((obj.data || {})[s])) await Store.clear(s);
      for(const s of KEYED_STORES)  if(Array.isArray((obj.keyed || {})[s])) await Store.clear(s);
    }
    let n = 0;
    for(const [s, rows] of Object.entries(obj.data || {})){
      if(!RECORD_STORES.includes(s)) continue;
      for(const r of rows){ await Store.put(s, r); n++; }
    }
    for(const [s, pairs] of Object.entries(obj.keyed || {})){
      if(!KEYED_STORES.includes(s)) continue;
      for(const [k,v] of pairs){ await Store.put(s, v, k); n++; }
    }
    return n;
  }

  /* Routed through Saver, which writes a real file and opens the share sheet on
     device — a Blob download alone silently does nothing in a WebView. */
  async function download(name, text, mime){
    try {
      const r = await Saver.save(name, text, mime || 'application/json', name);
      return r !== false;
    } catch(e){ console.error(e); return false; }
  }

  function pickFile(accept){
    return new Promise(res => {
      const i = document.createElement('input');
      i.type = 'file'; i.accept = accept; i.style.display = 'none';
      document.body.appendChild(i);
      i.addEventListener('change', () => {
        const f = i.files && i.files[0];
        i.remove();
        if(!f) return res(null);
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => res(null);
        r.readAsText(f);
      });
      i.click();
    });
  }

  /* ---- CSV ---- */
  function parseCSV(text){
    const rows = []; let row = [], field = '', quoted = false;
    for(let i = 0; i < text.length; i++){
      const c = text[i];
      if(quoted){
        if(c === '"' && text[i+1] === '"'){ field += '"'; i++; }
        else if(c === '"') quoted = false;
        else field += c;
      } else if(c === '"') quoted = true;
      else if(c === ','){ row.push(field); field = ''; }
      else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
      else if(c !== '\r') field += c;
    }
    if(field || row.length){ row.push(field); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
  }
  function toObjects(text){
    const rows = parseCSV(text.trim());
    if(rows.length < 2) return [];
    const head = rows[0].map(h => h.trim().toLowerCase());
    return rows.slice(1).map(r => {
      const o = {};
      head.forEach((h,i) => o[h] = (r[i] || '').trim());
      return o;
    });
  }
  const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  const list = v => String(v || '').split(/[;|]/).map(x => x.trim()).filter(Boolean);

  /* "300 g chicken breast" -> { q, u, n } */
  /* "300 g chicken breast" -> { q:300, u:'g', n:'chicken breast' }
     Units are matched against the known list rather than taken as typed, so an
     import cannot quietly poison the conversions with 'Tbsp.' or 'pounds'. */
  function parseIngredient(line){
    const m = line.match(/^([\d.\/]+)\s*(fl\s?oz|[a-zA-Z]+)?\.?\s+(.*)$/i);
    if(!m) return { n:line.trim(), q:null, u:'' };

    const q = m[1].includes('/')
      ? m[1].split('/').reduce((a,b) => a / b)
      : parseFloat(m[1]);

    const raw = (m[2] || '').replace(/\.$/, '');
    const unit = raw ? Shopping.normalise(raw) : '';

    /* an unrecognised word was part of the name, not a unit */
    return unit || !raw
      ? { q, u:unit, n:m[3].trim() }
      : { q, u:'', n:`${raw} ${m[3]}`.trim() };
  }

  const IMPORTERS = {
    meals: {
      label:'Meals',
      columns:'title, category, source, ingredients, steps, tags',
      hint:'ingredients and steps take several values separated by semicolons — "300 g chicken breast; 1 cup rice"',
      async run(rows){
        let n = 0;
        for(const r of rows){
          if(!r.title) continue;
          await Store.put('meals', {
            id: uid('m'), title:r.title, category:r.category || 'Entrees', source:r.source || '',
            tags: list(r.tags),
            ingredients: list(r.ingredients).map(parseIngredient),
            steps: list(r.steps),
            createdAt: Date.now() - n
          });
          n++;
        }
        Nutrition.invalidate('meals');
        return n;
      }
    },
    clips: {
      label:'Clips',
      columns:'title, platform, state, series, duration',
      hint:'platform is youtube, shorts, tiktok or reels; state is raw, queued or posted',
      async run(rows){
        const series = await Data.series();
        let n = 0;
        for(const r of rows){
          if(!r.title) continue;
          const match = series.find(s => s.title.toLowerCase() === String(r.series || '').toLowerCase());
          await Store.put('clips', {
            id: uid('c'), title:r.title, plat:(r.platform || 'youtube').toLowerCase(),
            state:(r.state || 'raw').toLowerCase(), seriesId: match ? match.id : null,
            dur:r.duration || '0:00', pct: Data.PCT_FOR[(r.state||'raw').toLowerCase()] ?? 0,
            createdAt: Date.now() - n
          });
          n++;
        }
        Data.invalidate('clips');
        return n;
      }
    },
    tasks: {
      label:'Tasks',
      columns:'title, day, time, cadence, priority, steps',
      hint:'day is the program day number; time is 24-hour like 14:30; steps semicolon-separated',
      async run(rows){
        const { values } = await Store.all('tasks');
        let id = Math.max(0, ...values.map(t => t.id)) + 1, n = 0;
        for(const r of rows){
          if(!r.title) continue;
          await Store.put('tasks', {
            id: id++, day: Math.max(1, +r.day || 1), title:r.title,
            at: r.time || null, cad:r.cadence || 'Daily', pri:(r.priority || 'med').toLowerCase(),
            prog:'', subs: list(r.steps).map(t => ({ t, done:false })), view:'todo'
          });
          n++;
        }
        Data.invalidate('tasks');
        return n;
      }
    },
    pantry: {
      label:'Pantry',
      columns:'item, qty, unit, group',
      hint:'unit is what the shelf holds — bag, box, can, jar, gallon, pcs. Leave group blank and it is guessed from the name.',
      async run(rows){
        let n = 0;
        for(const r of rows){
          const nm = r.item || r.name;
          if(!nm) continue;

          /* accept a group by its id or its label, and guess when neither is given */
          const raw = String(r.group || r.section || '').trim().toLowerCase();
          const hit = FoodGroups.GROUPS.find(g =>
            g.id === raw || g.n.toLowerCase() === raw);

          await Store.put('pantry', {
            id: uid('p'), name: nm,
            qty: +r.qty || 0,
            unit: Shopping.normaliseStock(r.unit || ''),
            group: hit ? hit.id : FoodGroups.guess(nm),
            createdAt: Date.now() - n
          });
          n++;
        }
        Nutrition.invalidate('pantry');
        return n;
      }
    },
    runs: {
      label:'Runs',
      columns:'distance, unit, time, date, note',
      hint:'distance with unit mi or km; time as mm:ss or hh:mm:ss; date as YYYY-MM-DD',
      async run(rows){
        let n = 0;
        for(const r of rows){
          const d = parseFloat(r.distance);
          if(!d) continue;
          const km = String(r.unit || 'mi').toLowerCase().startsWith('k') ? d : d / 0.621371;
          const parts = String(r.time || '').split(':').map(Number).filter(x => !isNaN(x));
          const sec = parts.length === 3 ? parts[0]*3600 + parts[1]*60 + parts[2]
                    : parts.length === 2 ? parts[0]*60 + parts[1]
                    : parts[0] || 0;
          const when = r.date ? new Date(r.date + 'T09:00').getTime() : Date.now() - n * 86400000;
          await Store.put('runs', {
            id: 'rn_' + Date.now().toString(36) + n,
            km, sec, note: r.note || '',
            at: isNaN(when) ? Date.now() : when
          });
          n++;
        }
        return n;
      }
    }
  };

  global.Transfer = { exportAll, importAll, download, pickFile, toObjects, IMPORTERS };
})(window);
