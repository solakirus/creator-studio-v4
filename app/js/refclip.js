/* v4: a reference video on a shot — a section of someone else's video to
   recreate, from one time to another (0:10 → 1:23).

   Kept on the shot as vref: { url, start, end, n } (seconds; end 0 = to the
   end; n = what to take from it). It travels with the shot through the Steps,
   tasks and shoot mode (shotlist.js extras). YouTube plays just that section —
   its player starts at start and stops at end (yt.html t / e). Other sites
   play the whole video, with the times shown so you know where to look.

     RefClip.label(v)             "0:10 – 1:23"
     RefClip.site(url)            "YouTube"
     await RefClip.edit(v, title) → { url, start, end, n } | 'clear' | null
     RefClip.play(v, title)       the pop-out player, that section only */
(function(global){
  const esc = s => global.U && U.esc ? U.esc(s) : String(s == null ? '' : s);

  /* 83 → "1:23", 3725 → "1:02:05" */
  function fmt(s){
    s = Math.max(0, Math.round(+s || 0));
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
  }
  /* "1:23", "83", "1m23s", "1:02:05" → seconds; '' → 0; nonsense → NaN */
  function parse(t){
    const v = String(t == null ? '' : t).trim().toLowerCase();
    if(!v) return 0;
    if(/^\d+(\.\d+)?$/.test(v)) return Math.round(+v);
    const hms = v.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/);
    if(hms && (hms[1] || hms[2] || hms[3])) return (+hms[1] || 0) * 3600 + (+hms[2] || 0) * 60 + (+hms[3] || 0);
    const parts = v.split(':');
    if(parts.length >= 2 && parts.length <= 3 && parts.every(p => /^\d+$/.test(p))) return parts.reduce((a, p) => a * 60 + +p, 0);
    return NaN;
  }
  /* a time already in a link: youtu.be/x?t=83, ?t=1m23s, &start=10, #t=1:23 */
  function timeIn(url){
    const m = String(url || '').match(/[?&#](?:t|start)=([\dhms:.]+)/i);
    if(!m) return 0;
    const s = parse(m[1]);
    return isNaN(s) ? 0 : s;
  }
  function site(url){
    const u = String(url || '');
    if(/youtu/i.test(u)) return 'YouTube';
    if(/instagram/i.test(u)) return 'Instagram';
    if(/tiktok/i.test(u)) return 'TikTok';
    if(/facebook|fb\.watch/i.test(u)) return 'Facebook';
    if(/vimeo/i.test(u)) return 'Vimeo';
    return 'Video';
  }
  const label = v => !v ? '' : v.start || v.end ? `${fmt(v.start || 0)} – ${v.end ? fmt(v.end) : 'end'}` : 'whole video';
  const isYT = url => !!(global.Embed && Embed.youtubeId && Embed.youtubeId(url));

  function play(v, title){
    if(!v || !v.url || !global.SwipePlayer) return;
    const t = (title ? title + ' · ' : '') + 'reference · ' + label(v);
    SwipePlayer.open([{ id:'vref', title:t, url:v.url, start:v.start || 0, end:v.end || 0 }], 0, { noun:'reference' });
    if(!isYT(v.url) && (v.start || v.end) && global.U && U.toast) U.toast(`${site(v.url)} plays it all — watch ${label(v)}`);
  }

  function edit(v, title){
    v = v || {};
    return new Promise(res => {
      let settled = false;
      const done = r => { if(settled) return; settled = true; res(r); };
      App.sheet(`<h2 style="margin:0 0 4px">Reference video${title ? ` · ${esc(title)}` : ''}</h2>
        <p class="hintline" style="margin:0 0 12px">A video you want to recreate part of. Paste its link, then the section — YouTube plays just that bit.</p>
        <input class="rc-in" data-rcurl type="url" placeholder="https://youtube.com/watch?v=…" value="${esc(v.url || '')}" aria-label="The video's link">
        <div class="rc-times">
          <label><span>From</span><input class="rc-in" data-rcfrom inputmode="numeric" placeholder="0:10" value="${v.start ? fmt(v.start) : ''}"></label>
          <label><span>To</span><input class="rc-in" data-rcto inputmode="numeric" placeholder="1:23" value="${v.end ? fmt(v.end) : ''}"></label>
        </div>
        <input class="rc-in" data-rcn placeholder="What to take from it — the move, the framing, the pacing…" value="${esc(v.n || '')}" aria-label="What to take from it">
        <p class="hintline rc-msg" data-rcmsg style="margin:8px 0 0"></p>
        <div class="sheetcta"><button class="btn-primary" data-rcok>Save</button><button class="btn-ghost" data-rcplay>▶ Preview</button>
          ${v.url ? '<button class="btn-ghost" data-rcoff>Take it off</button>' : ''}<button class="btn-ghost" data-rcno>Cancel</button></div>`, sh => {
        const val = () => {
          const url = sh.querySelector('[data-rcurl]').value.trim();
          let start = parse(sh.querySelector('[data-rcfrom]').value), end = parse(sh.querySelector('[data-rcto]').value);
          const msg = t => { sh.querySelector('[data-rcmsg]').textContent = t; return null; };
          if(!/^https?:\/\//i.test(url)) return msg('Paste the video’s link first.');
          if(isNaN(start) || isNaN(end)) return msg('Times look like 0:10, 1:23 or 83.');
          if(!start && !sh.querySelector('[data-rcfrom]').value.trim()) start = timeIn(url);
          if(end && end <= start) return msg('“To” has to be after “From”.');
          return { url, start, end, n:sh.querySelector('[data-rcn]').value.trim() };
        };
        /* a link with a time in it fills From */
        sh.querySelector('[data-rcurl]').addEventListener('change', e => {
          const f = sh.querySelector('[data-rcfrom]'), t = timeIn(e.target.value);
          if(t && !f.value.trim()) f.value = fmt(t);
        });
        sh.addEventListener('click', ev => {
          if(ev.target.closest('[data-rcno]')){ App.closeSheet(); return done(null); }
          if(ev.target.closest('[data-rcoff]')){ App.closeSheet(); return done('clear'); }
          if(ev.target.closest('[data-rcplay]')){ const r = val(); if(r) play(r, title); return; }
          if(ev.target.closest('[data-rcok]')){
            const r = val(); if(!r) return;
            if(!r.n) delete r.n;
            App.closeSheet(); return done(r);
          }
        });
      });
    });
  }

  function css(){
    if(document.getElementById('rc-css')) return;
    const st = document.createElement('style'); st.id = 'rc-css';
    st.textContent = `
    .rc-in{width:100%;height:44px;margin:0 0 8px;padding:0 11px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--cream);font:inherit;font-size:15px;box-sizing:border-box}
    .rc-in:focus{border-color:var(--orange);outline:none}
    .rc-times{display:flex;gap:8px}
    .rc-times label{flex:1;display:flex;flex-direction:column;gap:4px}
    .rc-times span{font-family:var(--display),sans-serif;font-weight:900;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
    .rc-msg{color:var(--red)}
    .rc-chip{display:flex;align-items:center;gap:6px}
    .rc-play{flex:1;min-width:0;height:32px;padding:0 10px;border:1px solid rgba(232,133,58,.5);border-radius:var(--r);background:rgba(232,133,58,.1);color:#F2B27A;font:inherit;font-size:13px;font-weight:600;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rc-n{font-size:12.5px;color:var(--muted);line-height:1.4;margin:-2px 0 0}`;
    document.head.appendChild(st);
  }

  global.RefClip = { fmt, parse, timeIn, site, label, edit, play, css };
})(window);
