/* Backup and import. JSON round-trips the whole database; CSV brings in
   lists from elsewhere.

   A backup covers every store the database has — not a hand-kept list, which
   is how the old backup came to hold 19 of 50 stores and silently drop
   episodes, quarters, months and every image. Pictures and voice notes are
   written into the file as base64, unless you ask for a backup without them.

   File shape (version 2):
     { format:'creator-studio', version:2, app, exportedAt, photos:true|false,
       data:  { <store with its own id>: [record, …] },
       keyed: { <store keyed from outside>: [[key, value], …] } }
   A Blob anywhere inside becomes { __blob:<type>, b64:<data> } and a Date
   becomes { __date:<iso> }. Version 1 files (Creator Studio v2) still restore. */
(function(global){
  const FORMAT = 'creator-studio';
  const VERSION = 2;

  /* What a store is keyed by, read from the database itself so a store added
     later is covered without anyone remembering to list it. */
  async function layout(){
    const d = await Store.db();
    const out = {};
    const names = [...d.objectStoreNames];
    if(!names.length) return out;
    const t = d.transaction(names, 'readonly');
    names.forEach(n => { out[n] = t.objectStore(n).keyPath || null; });
    return out;
  }

  function blobToB64(blob){
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] || '');
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }
  function b64ToBlob(b64, type){
    const bin = atob(b64 || '');
    const bytes = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || 'application/octet-stream' });
  }

  /* Turn a stored value into something JSON can hold. `stats` counts the
     pictures so the export can say what it wrote. */
  async function encode(v, photos, stats){
    if(v === null || typeof v !== 'object') return v;
    if(typeof Blob !== 'undefined' && v instanceof Blob){
      if(!photos){ stats.dropped++; return undefined; }
      stats.blobs++; stats.bytes += v.size;
      return { __blob: v.type || 'application/octet-stream', b64: await blobToB64(v) };
    }
    if(v instanceof Date) return { __date: v.toISOString() };
    if(v instanceof ArrayBuffer) return encode(new Blob([v]), photos, stats);
    if(ArrayBuffer.isView(v)) return encode(new Blob([v]), photos, stats);
    if(Array.isArray(v)){
      const out = [];
      for(const x of v) out.push(await encode(x, photos, stats));
      return out;
    }
    const out = {};
    for(const [k, x] of Object.entries(v)){
      const e = await encode(x, photos, stats);
      if(e !== undefined) out[k] = e;
    }
    return out;
  }

  function decode(v, stats){
    if(v === null || typeof v !== 'object') return v;
    if(Array.isArray(v)) return v.map(x => decode(x, stats));
    if(typeof v.__blob === 'string' && typeof v.b64 === 'string'){
      if(stats) stats.blobs++;
      return b64ToBlob(v.b64, v.__blob);
    }
    if(typeof v.__date === 'string' && Object.keys(v).length === 1) return new Date(v.__date);
    const out = {};
    for(const [k, x] of Object.entries(v)) out[k] = decode(x, stats);
    return out;
  }

  /* opts.photos — false leaves pictures and voice notes out (a small file) */
  async function exportAll(opts){
    const photos = !opts || opts.photos !== false;
    const stats = { blobs:0, bytes:0, dropped:0, records:0 };
    const out = { format:FORMAT, version:VERSION, app:'creator-studio-v4',
                  exportedAt:new Date().toISOString(), photos, data:{}, keyed:{} };
    const shape = await layout();
    /* opts.only — just these stores (the Library & Templates file for the phone) */
    const only = opts && Array.isArray(opts.only) ? opts.only : null;
    if(only) out.only = only;
    for(const [s, keyPath] of Object.entries(shape)){
      if(only && !only.includes(s)) continue;
      let got;
      try { got = await Store.all(s); } catch(e){ console.warn('Could not read', s, e); continue; }
      if(keyPath){
        const rows = [];
        for(const v of got.values){
          const e = await encode(v, photos, stats);
          if(e !== undefined){ rows.push(e); stats.records++; }
        }
        out.data[s] = rows;
      } else {
        const pairs = [];
        for(let i = 0; i < got.keys.length; i++){
          if(s === 'settings' && /^secret:/.test(String(got.keys[i]))) continue;   /* API keys stay on the device */
          const e = await encode(got.values[i], photos, stats);
          if(e === undefined) continue;          /* a picture left out on purpose */
          pairs.push([got.keys[i], e]); stats.records++;
        }
        out.keyed[s] = pairs;
      }
    }
    out.stats = stats;
    return out;
  }

  /* One transaction per store: an import of a few thousand records takes a
     second instead of a minute. */
  async function putMany(store, items, keyed){
    if(!items.length) return 0;
    const d = await Store.db();
    return new Promise((res, rej) => {
      const t = d.transaction(store, 'readwrite');
      const st = t.objectStore(store);
      items.forEach(it => keyed ? st.put(it[1], it[0]) : st.put(it));
      t.oncomplete = () => res(items.length);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('Import of ' + store + ' was aborted'));
    });
  }

  /* mode 'merge' adds and overwrites by id; 'replace' clears each store the
     backup carries first. A store the file doesn't mention is never touched —
     restoring an older backup must not wipe what it never had. */
  /* v4: what a file holds, by the groups you'd pick from — so a backup from
     Creator Studio 3 can bring in just its swipe file (or just anything) */
  const GROUPS = [
    { k:'swipe',    label:'Swipe file',               stores:['swipes', 'swipe-thumb'] },
    { k:'refs',     label:'Reference library',        stores:['refs', 'ref-img', 'ref-poster'] },
    { k:'tasks',    label:'Tasks and routines',       stores:['tasks', 'task-media', 'routines', 'templates', 'presets', 'task-frames'] },
    { k:'content',  label:'Series, clips and videos', stores:['series', 'clips', 'videos'] },
    { k:'vlog',     label:'Vlogs, months, quarters',  stores:['vlogs', 'months', 'quarters', 'challenges', 'sources', 'seq-template'] },
    { k:'notes',    label:'Inbox, notes and journal', stores:['inbox', 'inbox-media', 'journal', 'board-items'] },
    { k:'library',  label:'Library and templates',    stores:['lib-items', 'lib-blob', 'lib-poster', 'lib-boards', 'shot-templates', 'star-groups', 'nb-music'] },
    { k:'fitness',  label:'Workouts and body',        stores:['sessions', 'exercises', 'exercise-art', 'runs', 'physique', 'physique-photo', 'plans', 'loads', 'courses'] },
    { k:'food',     label:'Food',                     stores:['meals', 'meal-photo', 'grocery', 'pantry', 'prep', 'planner'] },
    { k:'settings', label:'Settings and channels',    stores:['settings'] }
  ];
  /* [{ k, label, stores, count }] for the groups this file has records in;
     anything not in a group is "Everything else" */
  function contents(obj){
    const count = s => (Array.isArray((obj.data || {})[s]) ? obj.data[s].length : 0) + (Array.isArray((obj.keyed || {})[s]) ? obj.keyed[s].length : 0);
    const inFile = [...new Set(Object.keys(obj.data || {}).concat(Object.keys(obj.keyed || {})))].filter(s => count(s));
    const out = GROUPS.map(g => ({ ...g, stores:g.stores.filter(s => inFile.includes(s)), count:count(g.stores[0]) || g.stores.reduce((n, s) => n + count(s), 0) })).filter(g => g.stores.length);
    const rest = inFile.filter(s => !GROUPS.some(g => g.stores.includes(s)));
    if(rest.length) out.push({ k:'other', label:'Everything else', stores:rest, count:rest.reduce((n, s) => n + count(s), 0) });
    return out;
  }

  async function importAll(obj, mode, only){
    if(!obj || obj.format !== FORMAT) throw new Error('Not a Creator Studio backup');
    if((obj.version || 1) > VERSION) throw new Error('That backup is from a newer version of the app');
    const shape = await layout();
    const report = { records:0, photos:0, skipped:[] };
    const stats = { blobs:0 };

    const plan = [];
    const wanted = s => !only || only.has(s);
    for(const [s, rows] of Object.entries(obj.data || {})){
      if(!wanted(s)) continue;
      if(!(s in shape)){ report.skipped.push(s); continue; }
      if(!Array.isArray(rows)) continue;
      const kp = shape[s];
      if(kp){
        const ok = rows.map(r => decode(r, stats)).filter(r => r && r[kp] !== undefined && r[kp] !== null);
        plan.push([s, ok, false]);
      } else {
        /* a version 1 file has no out-of-line stores in data, but be forgiving */
        plan.push([s, rows.filter(r => Array.isArray(r) && r.length === 2).map(r => [r[0], decode(r[1], stats)]), true]);
      }
    }
    for(const [s, pairs] of Object.entries(obj.keyed || {})){
      if(!wanted(s)) continue;
      if(!(s in shape)){ report.skipped.push(s); continue; }
      if(!Array.isArray(pairs)) continue;
      const kp = shape[s];
      const items = pairs.filter(p => Array.isArray(p) && p.length === 2).map(p => [p[0], decode(p[1], stats)]);
      if(kp) plan.push([s, items.map(p => p[1]).filter(v => v && v[kp] !== undefined), false]);
      else plan.push([s, items, true]);
    }

    /* replacing settings must not take this device's own secrets with it */
    let secrets = [];
    if(mode === 'replace' && plan.some(([s]) => s === 'settings')){
      const { keys, values } = await Store.all('settings');
      secrets = keys.map((k, i) => [k, values[i]]).filter(([k]) => /^secret:/.test(String(k)));
    }
    if(mode === 'replace') for(const [s] of plan) await Store.clear(s);
    if(secrets.length) await putMany('settings', secrets, true);
    report.kept = 0;
    for(const [s, items0, keyed] of plan){
      const keyOf = it => keyed ? it[0] : it[shape[s]];
      let items = items0;
      /* Add to what's here ADDS: an item already here keeps the version it
         has (the newest, from you or another device), rather than going back
         to the backup's older copy and taking every device with it */
      if(mode !== 'replace'){
        let have = new Set();
        try { have = new Set((await Store.all(s)).keys.map(k => JSON.stringify(k))); } catch(e){}
        items = items0.filter(it => !have.has(JSON.stringify(keyOf(it))));
        report.kept += items0.length - items.length;
      }
      report.records += await putMany(s, items, keyed);
      /* written past Store.put, so tell sync what came in — otherwise a
         restore stays on this device and never reaches the others. Added
         items are only offered (stamped 1): if another device already sent
         the server the same item, the server's copy is the one kept. */
      if(global.Sync && Sync.touchMany)
        await Sync.touchMany(s, items.map(keyOf), mode === 'replace' ? undefined : 1);
    }
    report.photos = stats.blobs;
    lastReport = report;
    return report.records;
  }
  let lastReport = null;

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
        let n = 0;
        for(const r of rows){
          if(!r.title) continue;
          await Store.put('tasks', {
            id: U.taskId(), day: Math.max(1, +r.day || 1), title:r.title,
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

  global.Transfer = { exportAll, importAll, contents, GROUPS, download, pickFile, toObjects, IMPORTERS,
                      report: () => lastReport, encode, decode, VERSION };
})(window);
