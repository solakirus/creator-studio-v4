/* Merge — two devices' edits to the same record, combined instead of one
   replacing the other.

   Sync used to keep whichever whole record was saved last, so a shot changed
   on the phone and a sequence changed on the laptop before they synced lost
   one of the two. This compares each side with the version both started from
   (the base: the record as it was when this device last had it in step with
   the server) and keeps every change:

     - a detail only one side changed           that side's
     - both changed it to the same thing        that
     - both changed it differently              the newer edit, and the other
                                                one goes in `conflicts` so it
                                                can be brought back
     - lists of things with ids (days, sequences, shots, subtasks, folders,
       channels)                                item by item: added on either
                                                side stays, deleted stays
                                                deleted, edited is merged
     - plain lists (tags, folder ids)           as sets: added on either side
                                                stays, removed on either goes

   With no base (a record from before this existed, or made on both devices
   at once) nothing can count as deleted, so lists keep everything from both
   and only true clashes go to the newer side.

     Merge.merge(base, mine, theirs, mineNewer) → { value, conflicts:[{ path, kept, other }] }
*/
(function(global){

  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v) &&
    (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
  const isBlob = v => typeof Blob !== 'undefined' && v instanceof Blob;

  function same(a, b){
    if(a === b) return true;
    if(a == null || b == null) return a == null && b == null;   /* null and missing read the same */
    if(isBlob(a) || isBlob(b)) return isBlob(a) && isBlob(b) && a.size === b.size && a.type === b.type;
    if(a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && +a === +b;
    if(Array.isArray(a) || Array.isArray(b)){
      if(!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      for(let i = 0; i < a.length; i++) if(!same(a[i], b[i])) return false;
      return true;
    }
    if(typeof a === 'object' && typeof b === 'object'){
      const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
      if(ka.length !== kb.length) return false;
      for(const k of ka) if(!same(a[k], b[k])) return false;
      return true;
    }
    return a !== a && b !== b;   /* NaN */
  }

  const idOf = x => isObj(x) && (typeof x.id === 'string' || typeof x.id === 'number') ? String(x.id) : null;
  function idList(a){
    if(!Array.isArray(a)) return false;
    const seen = new Set();
    for(const x of a){ const id = idOf(x); if(id === null || seen.has(id)) return false; seen.add(id); }
    return true;
  }
  function primSet(a){
    if(!Array.isArray(a)) return false;
    const seen = new Set();
    for(const x of a){
      if(x !== null && typeof x === 'object') return false;
      const k = typeof x + ':' + x;
      if(seen.has(k)) return false;
      seen.add(k);
    }
    return true;
  }

  /* bookkeeping both sides stamp on every save: not worth a conflict entry */
  const NOISE = /(At|_at|Ts)$|^(imported|sig|rev|version|_.*)$/;
  const quiet = path => { const last = path[path.length - 1]; return typeof last === 'string' && NOISE.test(last); };

  const PLACEHOLDER = { test: v => typeof v === 'string' && /^(untitled( swipe| video| clip)?|new (task|video|clip|series))$/i.test(v.trim()) };

  function merge3(b, m, t, mNewer, path, cf){
    if(same(m, t)) return m;
    if(same(m, b)) return t;
    if(same(t, b)) return m;
    /* both changed it */
    if(isObj(m) && isObj(t)) return mergeObj(isObj(b) ? b : undefined, m, t, mNewer, path, cf);
    if(Array.isArray(m) && Array.isArray(t)){
      const B = Array.isArray(b) ? b : undefined;
      if(idList(m) && idList(t) && (!B || idList(B))) return mergeList(B, m, t, mNewer, path, cf);
      if(primSet(m) && primSet(t) && (!B || primSet(B))) return mergeSet(B, m, t, mNewer);
    }
    /* a placeholder the app wrote ("Untitled swipe") never beats a real one */
    if(PLACEHOLDER.test(m) && !PLACEHOLDER.test(t)) return t;
    if(PLACEHOLDER.test(t) && !PLACEHOLDER.test(m)) return m;
    const kept = mNewer ? m : t, other = mNewer ? t : m;
    if(!quiet(path)) cf.push({ path, kept, other });
    return kept;
  }

  function mergeObj(b, m, t, mNewer, path, cf){
    const out = {};
    const keys = new Set([...Object.keys(m), ...Object.keys(t), ...(b ? Object.keys(b) : [])]);
    for(const k of keys){
      const v = merge3(b ? b[k] : undefined, m[k], t[k], mNewer, path.concat(k), cf);
      if(v !== undefined) out[k] = v;
    }
    return out;
  }

  function mergeList(B, M, T, mNewer, path, cf){
    const map = a => new Map((a || []).map(x => [idOf(x), x]));
    const mb = map(B), mm = map(M), mt = map(T);
    /* the newer side's order, with the other side's new items slotted in
       after the item they followed there */
    const first = mNewer ? M : T, second = mNewer ? T : M;
    const order = first.map(idOf);
    second.forEach((x, i) => {
      const id = idOf(x);
      if(order.includes(id)) return;
      let at = 0;
      for(let j = i - 1; j >= 0; j--){ const p = order.indexOf(idOf(second[j])); if(p !== -1){ at = p + 1; break; } }
      order.splice(at, 0, id);
    });
    const out = [];
    for(const id of order){
      const bi = mb.get(id), mi = mm.get(id), ti = mt.get(id);
      if(mi !== undefined && ti !== undefined){ out.push(merge3(bi, mi, ti, mNewer, path.concat('#' + id), cf)); continue; }
      const only = mi !== undefined ? mi : ti;
      /* on one side only: new there (keep), or deleted on the other — gone,
         unless this side changed it since, which is kept rather than lost */
      if(bi !== undefined && same(only, bi)) continue;
      out.push(only);
    }
    return out;
  }

  function mergeSet(B, M, T, mNewer){
    const has = (a, x) => a.some(y => same(y, x));
    const gone = B ? B.filter(x => !has(M, x) || !has(T, x)) : [];
    const first = mNewer ? M : T, second = mNewer ? T : M;
    return first.concat(second.filter(x => !has(first, x))).filter(x => !has(gone, x));
  }

  function merge(base, mine, theirs, mineNewer){
    const conflicts = [];
    const value = merge3(base, mine, theirs, !!mineNewer, [], conflicts);
    return { value, conflicts };
  }

  /* put a value back at a conflict's path (keys, and '#id' for list items) */
  function setAt(rec, path, v){
    if(!path.length) return v;
    const root = isObj(rec) || Array.isArray(rec) ? rec : {};
    let cur = root;
    for(let i = 0; i < path.length; i++){
      const seg = path[i], last = i === path.length - 1;
      if(typeof seg === 'string' && seg[0] === '#' && Array.isArray(cur)){
        const idx = cur.findIndex(x => idOf(x) === seg.slice(1));
        if(idx === -1){ if(last && v !== undefined) cur.push(v); return root; }
        if(last){ if(v === undefined) cur.splice(idx, 1); else cur[idx] = v; return root; }
        cur = cur[idx];
      } else {
        if(last){ if(v === undefined) delete cur[seg]; else cur[seg] = v; return root; }
        if(cur[seg] == null || typeof cur[seg] !== 'object') cur[seg] = {};
        cur = cur[seg];
      }
    }
    return root;
  }

  const api = { merge, same, setAt, idList, primSet };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Merge = api;
})(typeof window !== 'undefined' ? window : globalThis);
