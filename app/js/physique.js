/* Physique — weight and progress photos over time.

   Two things get logged and they belong together: what the scale says and what
   you actually look like. Either one alone lies. An entry can carry one, the
   other, or both.

   Photos are blobs in their own store keyed by entry id, so the log itself stays
   small enough to read and export without dragging megabytes through it. */
(function(global){

  const uid = () => 'ph_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  const dayKey = ts => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };

  /* The same day as a date input wants it — local, not UTC, or a late-evening
     entry shows as the next day. */
  const dayISO = ts => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${
      String(d.getDate()).padStart(2, '0')}`;
  };

  /* Four angles, because one is not a record — a front shot alone hides most of
     what changes. The keys never change; the labels are what you read. */
  const POSES = [
    { k:'front', label:'Front' },
    { k:'back',  label:'Back' },
    { k:'left',  label:'Left side' },
    { k:'right', label:'Right side' }
  ];
  const photoKey = (id, pose) => id + ':' + pose;

  async function all(){
    try {
      const { values } = await Store.all('physique');
      return values.sort((a, b) => (b.at || 0) - (a.at || 0));
    } catch(e){ return []; }
  }

  async function photos(){
    try { return await Store.allMap('physique-photo'); } catch(e){ return {}; }
  }

  /* One entry per day. Logging again on the same day edits that day rather than
     starting a second one, so the export reads as a timeline and not a pile. */
  async function forDay(ts){
    const key = dayKey(ts || Date.now());
    return (await all()).find(e => dayKey(e.at) === key) || null;
  }

  /* The weight before this one. Day to day it barely moves, so starting from
     the last reading makes the stepper usable — a couple of taps rather than
     typing the whole number every morning. */
  async function lastKgBefore(ts){
    const cut = ts || Date.now();
    const prev = (await all())
      .filter(e => e.kg != null && e.at < cut)
      .sort((a, b) => b.at - a.at)[0];
    return prev ? prev.kg : null;
  }

  async function save(entry, files){
    const e = { id: entry.id || uid(), at: entry.at || Date.now(),
                kg: entry.kg == null ? null : +entry.kg,
                note: (entry.note || '').trim(),
                poses: Array.isArray(entry.poses) ? entry.poses.slice() : [] };

    for(const [pose, file] of Object.entries(files || {})){
      if(!file) continue;
      await Store.put('physique-photo', file, photoKey(e.id, pose));
      if(!e.poses.includes(pose)) e.poses.push(pose);
    }
    e.hasPhoto = e.poses.length > 0;

    await Store.put('physique', e);
    if(global.Data && Data.invalidate) Data.invalidate('physique');
    return e;
  }

  async function remove(id){
    await Store.del('physique', id);
    for(const p of POSES){ try { await Store.del('physique-photo', photoKey(id, p.k)); } catch(e){} }
    try { await Store.del('physique-photo', id); } catch(e){}   /* the old single-photo key */
    if(global.Data && Data.invalidate) Data.invalidate('physique');
  }

  async function removePhoto(id, pose){
    try { await Store.del('physique-photo', photoKey(id, pose)); } catch(e){}
    const list = await all();
    const e = list.find(x => x.id === id);
    if(!e) return;
    e.poses = (e.poses || []).filter(p => p !== pose);
    e.hasPhoto = e.poses.length > 0;
    await Store.put('physique', e);
  }

  /* Anything logged before there were four angles had one photo under the bare
     entry id. It is a front shot as far as anyone is concerned. */
  function posesOf(entry, blobs){
    const out = {};
    POSES.forEach(p => {
      const b = blobs[photoKey(entry.id, p.k)];
      if(b) out[p.k] = b;
    });
    if(!out.front && blobs[entry.id]) out.front = blobs[entry.id];
    return out;
  }

  /* ---- what the numbers say ---- */

  function stats(list){
    const weighed = (list || []).filter(e => typeof e.kg === 'number' && e.kg > 0)
      .sort((a, b) => a.at - b.at);
    if(!weighed.length) return { n:0 };

    const first = weighed[0], last = weighed[weighed.length - 1];
    const lo = weighed.reduce((m, e) => e.kg < m.kg ? e : m, first);
    const hi = weighed.reduce((m, e) => e.kg > m.kg ? e : m, first);

    /* last seven days against the seven before, so a single heavy morning does
       not read as a trend */
    const now = Date.now();
    const mean = arr => arr.reduce((n, e) => n + e.kg, 0) / (arr.length || 1);
    const recent = weighed.filter(e => e.at >= now - 7 * 864e5);
    const prior = weighed.filter(e => e.at < now - 7 * 864e5 && e.at >= now - 14 * 864e5);

    return {
      n: weighed.length,
      first, last, lo, hi,
      change: last.kg - first.kg,
      trend: recent.length && prior.length ? mean(recent) - mean(prior) : null,
      series: weighed.map(e => ({ at:e.at, kg:e.kg }))
    };
  }

  /* ---- taking it with you ---- */

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  async function csv(){
    const list = (await all()).slice().sort((a, b) => a.at - b.at);
    const rows = [['date', 'kg', 'lb', 'angles', 'note']];
    list.forEach(e => rows.push([
      new Date(e.at).toISOString().slice(0, 10),
      e.kg == null ? '' : e.kg,
      e.kg == null ? '' : Math.round(e.kg * 2.2046226 * 10) / 10,
      POSES.map(p => (e.poses || []).includes(p.k) ? p.k : '').filter(Boolean).join(' ') ||
        (e.hasPhoto ? 'front' : ''),
      '"' + String(e.note || '').replace(/"/g, '""') + '"'
    ]));
    return rows.map(r => r.join(',')).join('\n');
  }

  const asDataUrl = blob => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

  /* One file with the photos inside it. A folder of loose images and a spreadsheet
     is two things to keep together and lose separately; this opens in any browser
     and shows the whole run side by side. */
  /* One file, oldest first, a row per day with the four angles side by side.
     That ordering is the point: scrolling it is the transformation, and it is
     what you would pull stills from. */
  async function page(){
    const list = (await all()).slice().sort((a, b) => a.at - b.at);
    const blobs = await photos();
    const s = stats(list);
    const startAt = list.length ? list[0].at : Date.now();

    const rows = [];
    for(const e of list){
      const mine = posesOf(e, blobs);
      const cells = [];
      for(const p of POSES){
        let img = '';
        if(mine[p.k]){
          try { img = await asDataUrl(mine[p.k]); } catch(err){ img = ''; }
        }
        cells.push(img
          ? `<figure><img src="${img}" alt="${p.label}"><figcaption>${p.label}</figcaption></figure>`
          : `<figure class="miss"><div class="noimg">${p.label}</div></figure>`);
      }

      const d = new Date(e.at);
      const dayNo = Math.round((dayKey(e.at) - dayKey(startAt)) / 864e5) + 1;
      rows.push(`<section>
        <header>
          <h2>Day ${dayNo}<small>${d.toLocaleDateString(undefined,
            { weekday:'short', day:'numeric', month:'short', year:'numeric' })}</small></h2>
          ${e.kg != null ? `<p class="w">${e.kg} kg<span>${
            Math.round(e.kg * 2.2046226 * 10) / 10} lb</span></p>` : ''}
        </header>
        ${e.note ? `<p class="note">${esc(e.note)}</p>` : ''}
        <div class="angles">${cells.join('')}</div>
      </section>`);
    }

    return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Physique log</title>
<style>
  body{margin:0;padding:28px 20px 60px;background:#151515;color:#EDE5D2;
    font:16px/1.5 system-ui,-apple-system,sans-serif}
  h1{font-size:36px;margin:0 0 4px;letter-spacing:-.02em}
  .sum{color:#969185;margin:0 0 30px}
  .sum b{color:#FB6900}
  section{border-top:1px solid #33302A;padding:22px 0 4px}
  section header{display:flex;align-items:baseline;gap:14px}
  section h2{font-size:22px;margin:0;letter-spacing:-.01em}
  section h2 small{display:block;font-size:13px;font-weight:400;color:#969185;margin:3px 0 0}
  .w{margin:0 0 0 auto;font-size:22px;font-weight:700;text-align:right}
  .w span{display:block;font-size:13px;font-weight:400;color:#969185}
  .note{margin:10px 0 0;color:#969185;font-size:14px}
  .angles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0 0}
  figure{margin:0}
  figure img{width:100%;display:block;aspect-ratio:3/4;object-fit:cover;border-radius:5px;
    background:#1F1C17}
  figcaption{margin:6px 0 0;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;
    color:#969185}
  .miss .noimg{aspect-ratio:3/4;border:1px dashed #33302A;border-radius:5px;display:flex;
    align-items:center;justify-content:center;color:#4A4840;font-size:11.5px;
    letter-spacing:.05em;text-transform:uppercase}
  @media (max-width:640px){ .angles{grid-template-columns:repeat(2,1fr)} }
  @media print{ body{background:#fff;color:#111} section{break-inside:avoid} }
</style>
<h1>Physique log</h1>
<p class="sum">${list.length} day${list.length === 1 ? '' : 's'}${
  s.n ? ` · <b>${s.first.kg} kg to ${s.last.kg} kg</b> · ${
    s.change > 0 ? '+' : ''}${Math.round(s.change * 10) / 10} kg overall` : ''}
  · exported ${new Date().toLocaleDateString()}</p>
${rows.join('')}`;
  }

  /* ---- two days, side by side ---- */

  /* What changed between them. Days apart is counted on the calendar rather than
     in milliseconds, so a morning shot and an evening one are still one day. */
  function compare(a, b){
    if(!a || !b) return null;
    const [from, to] = a.at <= b.at ? [a, b] : [b, a];
    const days = Math.round((dayKey(to.at) - dayKey(from.at)) / 864e5);
    const bothWeighed = typeof from.kg === 'number' && typeof to.kg === 'number';
    return {
      from, to, days,
      kg: bothWeighed ? Math.round((to.kg - from.kg) * 10) / 10 : null,
      perWeek: bothWeighed && days >= 7
        ? Math.round(((to.kg - from.kg) / (days / 7)) * 10) / 10
        : null
    };
  }

  /* The pair as one file: the card that opens the video. */
  async function card(a, b, opts){
    const c = compare(a, b);
    if(!c) return '';
    const o = opts || {};
    const blobs = await photos();
    const unitLb = o.unit === 'lb';
    const showKg = kg => unitLb
      ? Math.round(kg * 2.2046226 * 10) / 10 + ' lb'
      : Math.round(kg * 10) / 10 + ' kg';

    const col = async (e, label) => {
      const mine = posesOf(e, blobs);
      const shots = [];
      for(const p of POSES){
        let img = '';
        if(mine[p.k]){ try { img = await asDataUrl(mine[p.k]); } catch(err){ img = ''; } }
        shots.push(img ? `<img src="${img}" alt="${p.label}">`
                       : `<div class="noimg">${p.label}</div>`);
      }
      return `<div class="side">
        <p class="cap">${label}<small>${new Date(e.at).toLocaleDateString(undefined,
          { day:'numeric', month:'short', year:'numeric' })}</small></p>
        <div class="shots">${shots.join('')}</div>
        ${e.kg != null ? `<p class="kg">${showKg(e.kg)}</p>` : '<p class="kg none">—</p>'}
      </div>`;
    };

    return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.days} days</title>
<style>
  body{margin:0;padding:26px 18px 40px;background:#151515;color:#EDE5D2;
    font:16px/1.5 system-ui,-apple-system,sans-serif}
  .head{text-align:center;margin:0 0 20px}
  .head h1{font-size:44px;margin:0;letter-spacing:-.03em}
  .head p{margin:4px 0 0;color:#969185}
  .head .delta{display:inline-block;margin:12px 0 0;padding:7px 16px;border-radius:999px;
    background:#FB6900;color:#151515;font-weight:700;font-size:18px}
  .pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .side .cap{margin:0 0 8px;text-align:center;font-weight:700}
  .side .cap small{display:block;font-weight:400;font-size:12.5px;color:#969185}
  .shots{display:grid;grid-template-columns:1fr 1fr;gap:5px}
  .shots img{width:100%;display:block;aspect-ratio:3/4;object-fit:cover;border-radius:4px;
    background:#1F1C17}
  .noimg{aspect-ratio:3/4;border:1px dashed #33302A;border-radius:4px;display:flex;
    align-items:center;justify-content:center;color:#4A4840;font-size:10.5px;
    letter-spacing:.05em;text-transform:uppercase}
  .kg{margin:10px 0 0;text-align:center;font-size:22px;font-weight:700}
  .kg.none{color:#4A4840}
  @media print{ body{background:#fff;color:#111} }
</style>
<div class="head">
  <h1>${c.days} days</h1>
  ${c.kg != null ? `<span class="delta">${c.kg > 0 ? '+' : ''}${
    unitLb ? Math.round(c.kg * 2.2046226 * 10) / 10 + ' lb' : c.kg + ' kg'}</span>` : ''}
  ${c.perWeek != null ? `<p>${c.perWeek > 0 ? '+' : ''}${
    unitLb ? Math.round(c.perWeek * 2.2046226 * 10) / 10 + ' lb' : c.perWeek + ' kg'} a week</p>` : ''}
</div>
<div class="pair">${await col(c.from, 'Before')}${await col(c.to, 'After')}</div>`;
  }

  global.Physique = {
    lastKgBefore, POSES, all, photos, posesOf, photoKey, forDay, compare, card,
                      save, remove, removePhoto, stats, csv, page, dayKey, dayISO };
})(window);
