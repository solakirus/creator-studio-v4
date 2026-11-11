/* Notebook pages — Shotline's "Notes from a creative, to a creative" pages.

   A page is 720 × 900 (4:5), graph paper with 29 squares across, marker
   titles, hand-written notes, a red dot on top and a red sign-off, with Library
   frames in the picture spots. Every position below is in page units, taken
   from Shotline's sheet.rs and ui_pages.rs (see MECHANICS.md).

   Layouts: frames · compare · character · soundtrack · cover · steps */
(function(global){

  const PAGE_W = 720, PAGE_H = 900, PAGE_FPS = 24, GRID_SQUARES = 29, SENSOR_W_MM = 36;
  const MAX_STEPS = 14, TASK_SHOTS_MIN = 8, STEP_COLS = 3;
  const ROLES = ['Action', 'Insert', 'B-roll', 'Talking', 'Reaction', 'Transition'];
  const TASK_NEEDS = ['Action', 'Insert', 'B-roll', 'Reaction'];

  const C = {
    paper:'rgb(233,233,230)', pen:'rgb(26,26,28)', red:'rgb(196,40,52)', dot:'rgb(226,58,66)',
    label:'rgb(52,52,56)', rule:'rgb(78,78,82)', accent:'rgb(194,52,31)', lines:'#EDE5D2'
  };
  const FAM = { marker:'"NB Marker"', hand:'"NB Hand"', mono:'"NB Mono"', bold:'"NB Bold"' };

  const LAYOUTS = [
    ['frames', 'Frames from the film', 9],
    ['compare', 'Same shot · before & after', 2],
    ['character', 'Character sheet', 4],
    ['soundtrack', 'Soundtrack', 3],
    ['cover', 'Cover · notes from a creative', 1],
    ['steps', 'Task sequence · steps', 6]
  ];
  const layoutName = l => (LAYOUTS.find(x => x[0] === l) || [0, 'Page'])[1];
  const slotCount = l => (LAYOUTS.find(x => x[0] === l) || [0, 0, 1])[2];

  /* the words on each layout: key, label in the editor, several lines */
  const FIELDS = {
    frames:[['title','Title',1],['project','Project'],['camera','Camera'],['city','City'],['tone_note','Palette note',1],
      ['tone_pct','Palette note (red)',1],['accent_note','Accent colours note (red)'],['lenses','Lenses'],
      ['fov','Field-of-view chart: focal lengths (mm)'],['fov_note','Chart note'],['approved','Sign-off (red)']],
    compare:[['lens','Lens'],['rig','Rig'],['sequence','Sequence'],['scene','Scene'],['camera','Camera'],['title','Title',1],
      ['note_top','Note on the top picture',1],['mark_top','Mark on the top note (✓, ✗ or empty)'],['note_side','Side note (red)',1],
      ['note_bottom','Note on the bottom picture',1],['mark_bottom','Mark on the bottom note (✓, ✗ or empty)'],['location','Location'],['approved','Sign-off (red)']],
    character:[['title','Title'],['talent','Under the title'],['project','Project'],['film','Film'],['role','Role'],['ruler','Height on the ruler'],
      ['name','Name'],['nickname','Nickname (circled, red)'],['age','Age'],['gender','Gender'],['height','Height'],['nationality','Nationality'],
      ['weight','Weight'],['discipline','Discipline'],['view1','Picture 1 label'],['view2','Picture 2 label'],['view3','Picture 3 label'],
      ['view4','Picture 4 label'],['approved','Sign-off (red)']],
    soundtrack:[['title','Title'],['subtitle','Under the title'],['track','Track'],['composer','Composer'],['from','From'],
      ['caption1','Left picture caption'],['caption1_red','Left picture caption (red)'],['caption2','Right picture caption'],
      ['quote','Quote',1],['note','Note (red)'],['start','Waveform start'],['length','Waveform length'],['approved','Sign-off (red)']],
    steps:[['title','Title'],['task','Task'],['day','Day'],['location','Location'],['camera','Camera'],['notes','Notes',1],['approved','Sign-off (red)']],
    cover:[['title','Title',1],['role','Under the portrait'],['signed','Signature'],['note','Note by the signature (red)'],
      ['project','Project'],['film','Film'],['city','City']]
  };
  const fieldsOf = l => FIELDS[l] || FIELDS.cover;

  /* the palette read off the first video */
  const FRAMES_PALETTE = ['#07121B', '#0C2836', '#094158', '#4F717E', '#91A8A6', '#7A3A30', '#1E5A3C'];
  /* palette chips: (x, width), five main then two accents */
  const SWATCHES = [[114, 62], [183.5, 62], [253, 62], [322.5, 62], [392, 62], [465, 35], [507, 35]];

  /* a task, start to finish (Shotline ai.js week planner prompt) */
  const TASK_STEPS = [
    ['B-roll', 'How it starts: coffee, walking out to it'], ['Action', 'Wide: the problem, the start'],
    ['Action', 'Wide: each step of the work'], ['Insert', 'Close: hands on the tool'],
    ['Insert', 'Insert: parts and details'], ['B-roll', 'A b-roll moment that moves it along'],
    ['Talking', 'Explain it to camera'], ['Reaction', 'The result, the reaction'], ['Transition', 'Transition out']
  ];

  const rid = () => Math.random().toString(36).slice(2, 10);

  function sheet(layout, name, seconds, kv, tones){
    const n = slotCount(layout);
    return { id:rid(), layout, name, fields:{ ...kv },
      slots:Array.from({ length:n }, (_, i) => ({ item:'', tone:(tones || [])[i] || '', text:'', role:'', done:false })),
      palette: layout === 'frames' ? FRAMES_PALETTE.slice() : [], seconds,
      music:'', music_note:'', music_in:0, music_out:0 };
  }

  function stepsPage(task){
    const s = sheet('steps', 'Sequence · ' + task, 6, { title:'SHOT SEQUENCE', task:'task — ' + task, day:'Monday',
      location:'Your city', camera:'SONY FX3', notes:'shoot it in this order — tick each step as it\'s done', approved:'apprvd' });
    s.slots = TASK_STEPS.map(([role, text]) => ({ item:'', tone:'', text, role, done:false }));
    return s;
  }
  const framesPage = () => sheet('frames', 'Frames from the film', 5, { title:'FRAMES FROM\nTHE FILM', project:'VLOG — Ep. 01',
    camera:'SONY FX3', city:'YOUR CITY', tone_note:'blue tones\ndominant', tone_pct:'94% of pixels\nlean blue', accent_note:'accents',
    lenses:'16-35 GM · 24-70 GM · 70-200 GM', fov:'16, 35, 70, 200', fov_note:'horizontal FOV, full frame', approved:'apprvd' });
  function comparePage(which){
    const V = {
      walk:['Same walk · two focal lengths', 6, '24-70mm GM', 'handheld · sticks', 'THE ARENA', 'APPROACH', 'SAME WALK\nTWO FOCAL LENGTHS',
        '24mm, following —\nsubject owns the frame', '', 'a nod to the classics,\nwalking in', '70mm, locked off —\nthe place owns it', '', 'EXT. running track, your city'],
      silhouette:['Same shot · before & after (silhouette)', 5.08, '24-70mm GM', 'handheld · static', 'STRETCH', 'HIGH ANGLE', 'SAME SHOT\nBEFORE & AFTER',
        'graded for\nsilhouette', '✓', 'crushed the shadows\nto get there', 'S-Log3, ungraded\nflat, no shadow', '✗', 'EXT. running track, your city'],
      broll:['Same shot · before & after (B-roll)', 4.83, '70-200mm GM', 'handheld', 'B-ROLL', 'CLOSE → WIDE', 'SAME SHOT\nBEFORE & AFTER',
        'graded, leaning\ninto the blues', '✓', 'close first, then wide —\nthe place builds the world', 'S-Log3, ungraded\nflat, grey haze', '✗', 'EXT. riverside, your city'],
      run:['Same shot · before & after', 8.17, '16-35mm GM', 'handheld', 'RUN', 'TRACKING · WIDE', 'SAME SHOT\nBEFORE & AFTER',
        'graded + Gyroflow\nstabilised', '✓', 'shot out of a\ncar window', 'S-Log3, ungraded\nunstabilised', '✗', 'EXT. parking lot, your city']
    };
    const v = V[which] || V.run;
    return sheet('compare', v[0], v[1], { lens:v[2], rig:v[3], sequence:v[4], scene:v[5], camera:'SONY FX3', title:v[6],
      note_top:v[7], mark_top:v[8], note_side:v[9], note_bottom:v[10], mark_bottom:v[11], location:v[12], approved:'apprvd' },
      ['', which === 'walk' ? '' : 'flat']);
  }
  const characterPage = () => sheet('character', 'Character sheet', 5, { title:'CHARACTER SHEET', talent:'talent — Name', project:'VLOG',
    film:'Weekly vlog', role:'lead talent', ruler:'180\ncm', name:'Name', nickname:'Nickname', age:'mid-20s', gender:'—',
    height:'180 cm · 5 ft 11', nationality:'—', weight:'70 kg', discipline:'running', view1:'FRONT', view2:'3/4', view3:'SIDE',
    view4:'BACK', approved:'apprvd' });
  const soundtrackPage = () => sheet('soundtrack', 'Soundtrack', 7.13, { title:'SOUNDTRACK', subtitle:'Weekly vlog — episode 01',
    track:'Track title', composer:'Composer', from:'Album, year', caption1:'Composer', caption1_red:'why they matter',
    caption2:'track 3 — a favourite cue', quote:'the sound that sets the pace —\nwhat this week feels like',
    note:'my favourite composer', start:'0:00', length:'1:57', approved:'apprvd' }, ['', 'bw', '']);
  const coverPage = () => sheet('cover', 'Notes from a creative · sign-off', 7.08, { title:'NOTES FROM A CREATIVE,\nTO A CREATIVE',
    role:'DIRECTOR · SHOT & CUT', signed:'Your name', note:'— with love, keep making', project:'VLOG — Ep. 01',
    film:'Weekly vlog', city:'Your city' }, ['bw']);

  /* the eight pages in the order the videos were saved */
  const carousel = () => [framesPage(), comparePage('run'), characterPage(), comparePage('walk'), soundtrackPage(),
    comparePage('silhouette'), comparePage('broll'), coverPage()];
  const designs = () => [...carousel().map(s => [s.name, s]), ['Task sequence · steps', stepsPage('Task')]];
  const copyNew = s => ({ ...JSON.parse(JSON.stringify(s)), id:rid() });

  /* ------------------------------------------------------------ numbers */
  const fovDegrees = fl => Math.round(2 * Math.atan(SENSOR_W_MM / (2 * Math.max(1, fl))) * 180 / Math.PI);
  const focalList = s => String(s || '').split(/[^0-9.]+/).map(parseFloat).filter(x => x >= 4 && x <= 1200).slice(0, 6);
  const missingRoles = roles => TASK_NEEDS.filter(n => !roles.some(r => r === n));
  function roleLine(roles){
    const c = {};
    roles.forEach(r => { const k = r || 'Action'; c[k] = (c[k] || 0) + 1; });
    return ROLES.filter(r => c[r]).map(r => `${c[r]} ${r.toLowerCase()}`).join(' · ');
  }
  function parseHex(t){ const h = String(t || '').trim().replace(/^#/, ''); return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toUpperCase() : null; }
  const toHex = c => '#' + c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();
  function fmtTime(s){
    if(!(s > 0)) return '0 s';
    if(s < 60) return (Math.round(s * 10) / 10).toString() + ' s';
    const m = Math.floor(s / 60), r = Math.floor(s - m * 60);
    return m + ':' + String(r).padStart(2, '0');
  }
  function hashStr(s){ let h = 2166136261 >>> 0; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function waveAmp(seed, i, n){
    const u = i / (n - 1);
    const env = 0.12 + 0.88 * Math.pow(Math.sin(Math.PI * u), 1.4);
    let h = (seed ^ Math.imul(i, 2654435761)) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 0x5bd1e995) >>> 0; h = (h ^ (h >>> 15)) >>> 0;
    return env * (0.3 + 0.7 * ((h % 1000) / 1000));
  }

  /* a task sequence's cells, three to a row: [picture, caption] */
  function stepCells(n){
    n = Math.max(1, Math.min(MAX_STEPS, n));
    const rows = Math.max(2, Math.ceil(n / STEP_COLS));
    const [x0, x1, y0, y1, gap] = [64, 655, 108, 748, 10];
    const w = (x1 - x0 - gap * (STEP_COLS - 1)) / STEP_COLS;
    const h = (y1 - y0 - gap * (rows - 1)) / rows;
    const capH = 44, picH = Math.min(h - capH - 6, w * 1.25);
    return Array.from({ length:n }, (_, i) => {
      const c = i % STEP_COLS, r = Math.floor(i / STEP_COLS);
      const x = x0 + c * (w + gap), y = y0 + r * (h + gap);
      return [[x, y, x + w, y + picH], [x, y + picH + 6, x + w, y + picH + 6 + capH]];
    });
  }

  function slotRects(layout, n){
    if(layout === 'steps') return stepCells(n).map(c => c[0]);
    if(layout === 'frames'){
      const [x0, y0, x1, y1, gap] = [64, 113, 655, 588, 6];
      const w = (x1 - x0 - 2 * gap) / 3, h = (y1 - y0 - 2 * gap) / 3;
      return Array.from({ length:9 }, (_, i) => { const c = i % 3, r = Math.floor(i / 3); const x = x0 + c * (w + gap), y = y0 + r * (h + gap); return [x, y, x + w, y + h]; });
    }
    if(layout === 'compare') return [[120, 107, 600, 368], [120, 520, 600, 781]];
    if(layout === 'character') return [[100, 116, 235, 458], [241, 116, 376, 458], [381, 116, 516, 458], [522, 116, 655, 458]];
    if(layout === 'soundtrack') return [[108, 133, 588, 402], [106, 432, 350, 610], [380, 418, 593, 633]];
    return [[229, 203, 490, 542]];
  }

  const WAVE_STRIP = [64, 758, 655, 800], WAVE_X0 = 96, WAVE_X1 = 610;

  /* every word on a page you can click to edit, where it sits, and its handwriting */
  function textSpots(sh){
    const v = [];
    const sp = (key, r, fam, size, multi) => v.push({ key, r, fam, size, multi:!!multi });
    const metaRight = keys => keys.forEach((k, i) => { const y = 42 + i * 21; sp(k, [518, y - 13, 655, y + 6], 'hand', 15); });
    switch(sh.layout){
      case 'frames':
        sp('title', [64, 30, 300, 95], 'marker', 21, 1); metaRight(['project', 'camera', 'city']);
        sp('tone_note', [556, 597, 662, 640], 'hand', 14, 1); sp('tone_pct', [572, 644, 662, 683], 'hand', 11.5, 1);
        sp('accent_note', [460, 664, 548, 684], 'hand', 11.5); sp('lenses', [104, 707, 655, 729], 'hand', 16);
        sp('fov', [100, 734, 430, 772], 'hand', 12.5); sp('fov_note', [398, 813, 562, 833], 'hand', 12.5);
        sp('approved', [574, 824, 652, 846], 'hand', 15);
        SWATCHES.forEach(([x, w], i) => sp('swatch:' + i, [x, 603, x + w, i < 5 ? 680 : 657], ''));
        break;
      case 'compare':
        sp('lens', [90, 36, 222, 56], 'hand', 15); sp('rig', [90, 60, 222, 80], 'hand', 15); metaRight(['sequence', 'scene', 'camera']);
        sp('note_top', [80, 370, 236, 416], 'hand', 14, 1); sp('note_side', [500, 376, 660, 418], 'hand', 12, 1);
        sp('title', [190, 416, 530, 492], 'marker', 19, 1); sp('note_bottom', [524, 472, 662, 516], 'hand', 14, 1);
        sp('location', [108, 801, 655, 823], 'hand', 16); sp('approved', [574, 825, 652, 847], 'hand', 15);
        break;
      case 'character':
        sp('title', [64, 28, 340, 62], 'marker', 22); sp('talent', [64, 68, 320, 90], 'hand', 13.5); metaRight(['project', 'film', 'role']);
        sp('ruler', [56, 104, 90, 136], 'hand', 11.5, 1);
        slotRects('character', 4).forEach((r, i) => sp('view' + (i + 1), [r[0], 464, r[2], 481], 'mono', 7.6));
        [['name', 'height'], ['nickname', 'nationality'], ['age', 'weight'], ['gender', 'discipline']].forEach(([a, b], i) => {
          const y = 546 + i * 57; sp(a, [138, y - 27, 345, y + 2], 'hand', 16); sp(b, [448, y - 27, 655, y + 2], 'hand', 16);
        });
        sp('approved', [574, 781, 652, 803], 'hand', 15);
        break;
      case 'soundtrack':
        sp('title', [64, 28, 340, 62], 'marker', 22); sp('subtitle', [64, 70, 340, 92], 'hand', 13.5); metaRight(['track', 'composer', 'from']);
        sp('caption1', [106, 612, 214, 634], 'hand', 13.5); sp('caption1_red', [214, 612, 352, 634], 'hand', 12);
        sp('caption2', [380, 636, 594, 658], 'hand', 12.5); sp('quote', [64, 658, 440, 712], 'hand', 16, 1);
        sp('note', [448, 682, 600, 702], 'hand', 12); sp('approved', [574, 711, 652, 733], 'hand', 15);
        sp('music', [65, 740, 655, 795], ''); sp('start', [60, 797, 120, 813], 'mono', 7.5); sp('length', [600, 797, 660, 813], 'mono', 7.5);
        break;
      case 'steps':
        sp('title', [64, 28, 340, 62], 'marker', 22); sp('task', [64, 68, 330, 90], 'hand', 13.5); metaRight(['day', 'location', 'camera']);
        stepCells(sh.slots.length).forEach(([, cap], i) => {
          sp('step:' + i, [cap[0] + 24, cap[1], cap[2] - 20, cap[3]], 'hand', 13, 1);
          sp('done:' + i, [cap[2] - 16, cap[1] + 1, cap[2], cap[1] + 17], '');
        });
        sp('music', WAVE_STRIP, ''); sp('notes', [64, 812, 548, 862], 'hand', 14, 1); sp('approved', [574, 824, 652, 846], 'hand', 15);
        break;
      default:
        sp('title', [140, 100, 580, 190], 'marker', 24, 1); sp('role', [240, 552, 480, 570], 'mono', 7.6);
        sp('signed', [278, 596, 442, 654], 'hand', 34); sp('note', [450, 614, 662, 640], 'hand', 13);
        sp('project', [113, 738, 243, 760], 'hand', 13.5); sp('film', [290, 738, 443, 760], 'hand', 13.5); sp('city', [490, 738, 643, 760], 'hand', 13.5);
    }
    return v;
  }
  const fieldOf = (sh, key) => {
    const m = /^step:(\d+)$/.exec(key);
    if(m) return (sh.slots[+m[1]] || {}).text || '';
    return (sh.fields || {})[key] || '';
  };
  function setField(sh, key, val){
    const m = /^step:(\d+)$/.exec(key);
    if(m){ while(sh.slots.length <= +m[1]) sh.slots.push({ item:'', tone:'', text:'', role:'', done:false }); sh.slots[+m[1]].text = val; return; }
    sh.fields = sh.fields || {};
    sh.fields[key] = val;
  }

  /* ------------------------------------------------------------ pictures
     A frame for a spot: a still, the frames of a GIF (decoded, so they move
     on the page and in a saved video), or a playing clip. Kept by uid. */
  const media = new Map();
  async function mediaFor(lib, uid){
    if(!uid) return null;
    if(media.has(uid)) return media.get(uid);
    const p = (async () => {
      const it = MediaLib.find(lib, uid);
      if(!it) return { missing:true };
      try {
        if(it.kind === 'video'){
          const v = document.createElement('video');
          v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
          v.src = await MediaLib.url(it);
          await new Promise(res => { v.addEventListener('loadeddata', res, { once:true }); v.addEventListener('error', res, { once:true }); setTimeout(res, 6000); });
          return { kind:'video', el:v, w:v.videoWidth, h:v.videoHeight };
        }
        const blob = await MediaLib.blobOf(it);
        if(!blob) return { missing:true };
        if(it.kind === 'gif' && global.ImageDecoder && blob.size < MediaLib.MAX_GIF_BYTES){
          try {
            const dec = new ImageDecoder({ data:await blob.arrayBuffer(), type:blob.type || 'image/gif' });
            await dec.tracks.ready;
            const count = Math.min(dec.tracks.selectedTrack ? dec.tracks.selectedTrack.frameCount : 1, 120);
            const frames = [];
            let total = 0;
            for(let i = 0; i < count; i++){
              const r = await dec.decode({ frameIndex:i });
              const bmp = await createImageBitmap(r.image);
              const d = Math.max(0.02, (r.image.duration || 100000) / 1e6);
              r.image.close();
              frames.push([bmp, d]); total += d;
            }
            if(frames.length) return { kind:'anim', frames, total, w:frames[0][0].width, h:frames[0][0].height };
          } catch(e){ /* fall back to a still */ }
        }
        const bmp = await createImageBitmap(blob);
        return { kind:'still', el:bmp, w:bmp.width, h:bmp.height };
      } catch(e){ return { missing:true }; }
    })();
    media.set(uid, p);
    /* a frame that isn't here yet (a kept copy still on its way from the
       laptop) is looked for again next time rather than remembered as missing */
    p.then(m => { if(m && m.missing && media.get(uid) === p) media.delete(uid); });
    return p;
  }
  /* a GIF's own length: its frame times added up; 2.5 s when it can't be read (clips.js gifInfo) */
  async function gifSeconds(lib, uid){
    const m = await mediaFor(lib, uid);
    return m && m.kind === 'anim' && m.total > 0.05 ? m.total : 2.5;
  }

  function drawable(m, t){
    if(!m || m.missing) return null;
    if(m.kind === 'anim'){
      if(t == null) return m.frames[0][0];
      let at = t % m.total;
      for(const [b, d] of m.frames){ if(at < d) return b; at -= d; }
      return m.frames[m.frames.length - 1][0];
    }
    if(m.kind === 'video') return m.el.readyState >= 2 ? m.el : null;
    return m.el;
  }

  /* cover: crop the frame to fill the spot */
  function drawCover(ctx, src, w, h, x, y, dw, dh){
    if(!w || !h) return;
    const sr = w / h, dr = dw / dh;
    let sw = w, sh = h, sx = 0, sy = 0;
    if(sr > dr){ sw = h * dr; sx = (w - sw) / 2; } else { sh = w / dr; sy = (h - sh) / 2; }
    ctx.drawImage(src, sx, sy, sw, sh, x, y, dw, dh);
  }

  /* ------------------------------------------------------------ the pen */
  function Pen(ctx, s){
    const P = {
      ctx, s,
      font:(fam, size) => `${fam === 'bold' ? '700 ' : ''}${Math.max(0.5, size * s)}px ${FAM[fam] || FAM.hand}, sans-serif`,
      text(x, y, align, t, fam, size, col){
        if(!t) return { x0:x, x1:x, y0:y, y1:y };
        ctx.font = P.font(fam, size);
        ctx.fillStyle = col;
        const [h, v] = align;
        ctx.textAlign = h; ctx.textBaseline = v;
        ctx.letterSpacing = '0px';
        if(fam === 'hand') ctx.fillText(t, x * s + Math.max(0.3, 0.45 * s), y * s);
        ctx.fillText(t, x * s, y * s);
        const w = ctx.measureText(t).width / s;
        const x0 = h === 'left' ? x : h === 'right' ? x - w : x - w / 2;
        const hh = size;
        const y0 = v === 'top' ? y : v === 'bottom' ? y - hh : y - hh / 2;
        return { x0, x1:x0 + w, y0, y1:y0 + hh };
      },
      lines(x, y, h, t, fam, size, col, lh){
        const a = h < 0.25 ? 'left' : h > 0.75 ? 'right' : 'center';
        return String(t || '').split('\n').map((l, i) => P.text(x, y + i * lh, [a, 'top'], l, fam, size, col));
      },
      label(x, y, align, t){
        if(!t) return;
        ctx.font = P.font('mono', 7.6);
        ctx.letterSpacing = (0.7 * s) + 'px';
        ctx.fillStyle = C.label; ctx.textAlign = align[0]; ctx.textBaseline = align[1];
        ctx.fillText(String(t).toUpperCase(), x * s, y * s);
        ctx.letterSpacing = '0px';
      },
      line(a, b, w, col){
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.6, w * s); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(a[0] * s, a[1] * s); ctx.lineTo(b[0] * s, b[1] * s); ctx.stroke();
      },
      underline(x0, x1, y){ P.line([x0, y], [x1, y], 0.8, C.rule); },
      poly(pts, w, col){
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.6, w * s); ctx.setLineDash([]);
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)); ctx.stroke();
      },
      tick(x, y, k, col){ P.poly([[x, y], [x + 4 * k, y + 5 * k], [x + 13 * k, y - 7 * k]], 1.5, col); },
      cross(x, y, k, col){ P.line([x - 4 * k, y - 4 * k], [x + 4 * k, y + 4 * k], 1.4, col); P.line([x - 4 * k, y + 4 * k], [x + 4 * k, y - 4 * k], 1.4, col); },
      mark(m, x, y){
        const t = String(m || '').trim();
        if(['✓', 'v', 'ok', 'yes'].includes(t)) P.tick(x - 2, y, 0.9, C.red);
        else if(['✗', 'x', 'X', 'no'].includes(t)) P.cross(x + 2, y, 1, C.red);
      },
      arrow(from, ctrl, to){
        const pts = [];
        for(let i = 0; i <= 14; i++){
          const t = i / 14;
          pts.push([(1 - t) ** 2 * from[0] + 2 * (1 - t) * t * ctrl[0] + t * t * to[0], (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * ctrl[1] + t * t * to[1]]);
        }
        P.poly(pts, 1.3, C.pen);
        const dx = to[0] - ctrl[0], dy = to[1] - ctrl[1], l = Math.hypot(dx, dy) || 1;
        const d = [dx / l, dy / l], side = [-d[1], d[0]];
        [-1, 1].forEach(g => P.line(to, [to[0] - d[0] * 8 + side[0] * 4.5 * g, to[1] - d[1] * 8 + side[1] * 4.5 * g], 1.3, C.pen));
      },
      approved(x, y, t){
        if(!String(t || '').trim()) return;
        const r = P.text(x, y, ['left', 'middle'], t, 'hand', 15, C.red);
        P.tick(r.x1 + 7, y, 1, C.red);
      },
      dot(x, y, r){
        ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.beginPath(); ctx.arc(x * s, (y + 1) * s, (r + 1) * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.dot; ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.arc((x - r * 0.3) * s, (y - r * 0.3) * s, r * 0.45 * s, 0, Math.PI * 2); ctx.fill();
      },
      metaRight(rows){
        rows.forEach(([l, v], i) => {
          const y = 42 + i * 21;
          P.label(508, y + 2, ['right', 'middle'], l);
          P.text(524, y + 5, ['left', 'bottom'], v, 'hand', 15, C.pen);
          P.underline(518, 655, y + 6);
        });
      },
      metaLeft(rows){
        rows.forEach(([l, v], i) => {
          const y = 48 + i * 24;
          P.label(64, y + 3, ['left', 'middle'], l);
          P.text(94, y + 6, ['left', 'bottom'], v, 'hand', 15, C.pen);
          P.underline(90, 222, y + 8);
        });
      },
      field(label, lx, vx, x1, y, v, col){
        P.label(lx, y + 3, ['left', 'middle'], label);
        const r = P.text(vx, y - 1, ['left', 'bottom'], v, 'hand', 16, col);
        P.underline(vx - 4, x1, y + 2);
        return r;
      },
      dashed(r, col){
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.8, 1 * s); ctx.setLineDash([5 * s, 4 * s]);
        ctx.strokeRect(r[0] * s, r[1] * s, (r[2] - r[0]) * s, (r[3] - r[1]) * s); ctx.setLineDash([]);
      }
    };
    return P;
  }

  function paper(P, linesOnly){
    const { ctx, s } = P;
    ctx.fillStyle = linesOnly ? C.lines : C.paper;
    ctx.fillRect(0, 0, PAGE_W * s, PAGE_H * s);
    const step = PAGE_W / GRID_SQUARES;
    ctx.strokeStyle = linesOnly ? 'rgba(120,110,95,0.24)' : 'rgba(110,114,118,0.29)';
    ctx.lineWidth = Math.max(0.5, 0.7 * s);
    ctx.setLineDash([]);
    ctx.beginPath();
    for(let x = 0; x <= PAGE_W + 0.1; x += step){ ctx.moveTo(x * s, 0); ctx.lineTo(x * s, PAGE_H * s); }
    for(let y = 0; y <= PAGE_H + 0.1; y += step){ ctx.moveTo(0, y * s); ctx.lineTo(PAGE_W * s, y * s); }
    ctx.stroke();
    if(linesOnly){ ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, PAGE_W * s - 1, PAGE_H * s - 1); return; }
    /* soft darker edges, like a photographed sheet */
    const W = PAGE_W * s, H = PAGE_H * s, ins = 0.2;
    [[0, 0, W * ins, 0, 0, 0, W * ins, H], [W, 0, W * (1 - ins), 0, W * (1 - ins), 0, W * ins, H],
     [0, 0, 0, H * ins, 0, 0, W, H * ins], [0, H, 0, H * (1 - ins), 0, H * (1 - ins), W, H * ins]].forEach(([a, b, c, d, x, y, w, h]) => {
      const g = ctx.createLinearGradient(a, b, c, d);
      g.addColorStop(0, 'rgba(0,0,0,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    });
  }

  function picture(P, slot, r, m, t){
    const { ctx, s } = P;
    const [x, y, w, h] = [r[0] * s, r[1] * s, (r[2] - r[0]) * s, (r[3] - r[1]) * s];
    ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(x + 1.2 * s, y + 2 * s, w, h);
    const src = slot.item ? drawable(m, t) : null;
    if(!src){
      ctx.fillStyle = 'rgb(220,220,216)';
      ctx.fillRect(x, y, w, h);
      P.dashed([r[0] + 3, r[1] + 3, r[2] - 3, r[3] - 3], 'rgb(150,150,150)');
      if(r[3] - r[1] > 40){
        P.text((r[0] + r[2]) / 2, (r[1] + r[3]) / 2 - 8, ['center', 'middle'], '+', 'bold', 22, 'rgb(120,120,120)');
        P.text((r[0] + r[2]) / 2, (r[1] + r[3]) / 2 + 14, ['center', 'middle'],
          !slot.item ? 'add a shot' : (m && m.missing ? 'not in your library' : 'loading…'), 'hand', 12, 'rgb(110,110,110)');
      }
      return;
    }
    const sw = src.videoWidth || src.width, shh = src.videoHeight || src.height;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if(slot.tone === 'bw') ctx.filter = 'grayscale(1)';
    drawCover(ctx, src, sw, shh, x, y, w, h);
    ctx.filter = 'none';
    if(slot.tone === 'flat'){
      /* ungraded log footage: washed-out, grey, low contrast */
      ctx.globalAlpha = 150 / 255; ctx.filter = 'grayscale(1)';
      drawCover(ctx, src, sw, shh, x, y, w, h);
      ctx.filter = 'none'; ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(132,136,140,0.47)'; ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------ the layouts */
  const f = (sh, k) => (sh.fields || {})[k] || '';

  function decoFrames(P, sh){
    const { ctx, s } = P;
    P.lines(64, 33, 0, f(sh, 'title'), 'marker', 21, C.pen, 29);
    P.dot(350, 60, 18);
    P.metaRight([['project', f(sh, 'project')], ['camera', f(sh, 'camera')], ['city', f(sh, 'city')]]);
    P.label(64, 632, ['left', 'middle'], 'palette');
    const pal = (sh.palette || []).length >= 7 ? sh.palette : FRAMES_PALETTE;
    SWATCHES.forEach(([x, w], i) => {
      ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect((x + 1) * s, 604.5 * s, w * s, 54 * s);
      ctx.fillStyle = pal[i]; ctx.fillRect(x * s, 603 * s, w * s, 54 * s);
      let h = hashStr(sh.id + i);
      for(let k = 0; k < 18; k++){
        h = (Math.imul(h, 1103515245) + 12345) >>> 0;
        const yy = 605 + ((h >>> 8) % 50);
        P.line([x + 1, yy], [x + w - 1, yy + ((h >>> 4) % 5) - 2], 0.9, (h & 1) === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.08)');
      }
      if(i < 5) P.text(x + w / 2, 671, ['center', 'middle'], pal[i], 'hand', 11.5, C.pen);
    });
    P.text(503.5, 674, ['center', 'middle'], f(sh, 'accent_note'), 'hand', 11.5, C.red);
    P.lines(560, 600, 0, f(sh, 'tone_note'), 'hand', 14, C.pen, 19);
    P.lines(657, 646, 1, f(sh, 'tone_pct'), 'hand', 11.5, C.red, 17);
    P.line([64, 688], [655, 688], 0.6, 'rgb(120,120,124)');
    P.label(64, 724, ['left', 'middle'], 'lenses');
    P.text(108, 727, ['left', 'bottom'], f(sh, 'lenses'), 'hand', 16, C.pen);
    P.underline(104, 655, 729);
    /* field-of-view fan */
    const ax = 90, ay = 810;
    ctx.strokeStyle = C.pen; ctx.lineWidth = Math.max(0.6, s); ctx.strokeRect(64 * s, 803 * s, 16 * s, 14 * s);
    P.line([80, 806], [ax, ay - 2], 1, C.pen); P.line([80, 814], [ax, ay + 2], 1, C.pen);
    const fs = focalList(f(sh, 'fov'));
    fs.forEach((fl, i) => {
      const n = fs.length;
      const radius = n === 4 ? [45, 105, 195, 305][i] : n <= 1 ? 200 : 45 + 260 * i / (n - 1);
      const deg = fovDegrees(fl), half = deg / 2 * Math.PI / 180;
      [-1, 1].forEach(g => P.line([ax, ay], [ax + radius * 1.1 * Math.cos(half), ay + g * radius * 1.1 * Math.sin(half)], 0.8, C.pen));
      P.poly(Array.from({ length:17 }, (_, k) => { const a = -half + 2 * half * k / 16; return [ax + radius * Math.cos(a), ay + radius * Math.sin(a)]; }), 0.9, C.pen);
      const top = [ax + radius * Math.cos(half), ay - radius * Math.sin(half)];
      P.text(top[0] + 3, top[1] - 9, ['left', 'bottom'], Math.round(fl) + 'mm', 'hand', 12.5, C.pen);
      P.text(top[0] + 6, top[1] - 8, ['left', 'top'], deg + '°', 'hand', 12, C.red);
    });
    P.text(400, 823, ['left', 'middle'], f(sh, 'fov_note'), 'hand', 12.5, C.pen);
    P.approved(578, 835, f(sh, 'approved'));
  }

  function decoCompare(P, sh){
    P.metaLeft([['lens', f(sh, 'lens')], ['rig', f(sh, 'rig')]]);
    P.dot(350, 60, 18);
    P.metaRight([['sequence', f(sh, 'sequence')], ['scene', f(sh, 'scene')], ['camera', f(sh, 'camera')]]);
    const rs = P.lines(82, 372, 0, f(sh, 'note_top'), 'hand', 14, C.pen, 20);
    const last = rs[rs.length - 1];
    if(last && f(sh, 'note_top')) P.mark(f(sh, 'mark_top'), last.x1 + 9, (last.y0 + last.y1) / 2 + 2);
    if(f(sh, 'note_top')) P.arrow([238, 399], [270, 401], [279, 374]);
    P.lines(657, 378, 1, f(sh, 'note_side'), 'hand', 12, C.red, 19);
    P.lines(360, 418, 0.5, f(sh, 'title'), 'marker', 19, C.pen, 35);
    const mark = f(sh, 'mark_bottom').trim();
    const nb = f(sh, 'note_bottom').split('\n');
    nb.forEach((l, i) => {
      const indent = i > 0 && mark ? 18 : 0;
      P.text(528 + indent, 474 + i * 21, ['left', 'top'], l, 'hand', 14, C.pen);
      if(i === 1) P.mark(mark, 535, 486 + 21);
    });
    if(nb.length === 1 && f(sh, 'note_bottom')) P.mark(mark, 518, 486);
    if(f(sh, 'note_bottom')) P.arrow([511, 481], [484, 484], [477, 516]);
    P.label(64, 818, ['left', 'middle'], 'location');
    P.text(112, 821, ['left', 'bottom'], f(sh, 'location'), 'hand', 16, C.pen);
    P.underline(108, 655, 823);
    P.approved(578, 836, f(sh, 'approved'));
  }

  function decoCharacter(P, sh){
    P.text(64, 31, ['left', 'top'], f(sh, 'title'), 'marker', 22, C.pen);
    P.text(64, 70, ['left', 'top'], f(sh, 'talent'), 'hand', 13.5, C.pen);
    P.dot(373, 60, 18);
    P.metaRight([['project', f(sh, 'project')], ['film', f(sh, 'film')], ['role', f(sh, 'role')]]);
    P.line([88, 146], [88, 446], 0.8, C.pen);
    for(let y = 146, k = 0; y <= 446.5; y += 6, k++) P.line([88 - (k % 5 === 0 ? 7 : 3.5), y], [88, y], 0.7, C.pen);
    P.lines(72, 108, 0.5, f(sh, 'ruler'), 'hand', 11.5, C.red, 13);
    P.text(78, 446, ['right', 'middle'], '0', 'mono', 7, C.pen);
    slotRects('character', 4).forEach((v, i) => {
      P.text(v[0] + 4, v[1] + 3, ['left', 'top'], String(i + 1).padStart(2, '0'), 'mono', 7, '#fff');
      P.label((v[0] + v[2]) / 2, 472, ['center', 'middle'], f(sh, 'view' + (i + 1)));
    });
    [['name', 'height'], ['nickname', 'nationality'], ['age', 'weight'], ['gender', 'discipline']].forEach(([a, b], i) => {
      const y = 546 + i * 57;
      const red = a === 'nickname';
      const r = P.field(a, 64, 142, 345, y, f(sh, a), red ? C.red : C.pen);
      if(red && f(sh, a)){
        const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, rx = (r.x1 - r.x0) / 2 + 9, ry = (r.y1 - r.y0) / 2 + 2;
        P.poly(Array.from({ length:41 }, (_, k) => { const t = k / 40 * Math.PI * 2 * 1.03 - 0.4; return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)]; }), 1.1, C.red);
      }
      P.field(b, 372, 452, 655, y, f(sh, b), C.pen);
    });
    P.approved(578, 792, f(sh, 'approved'));
  }

  function decoSoundtrack(P, sh, wave, played){
    P.text(64, 31, ['left', 'top'], f(sh, 'title'), 'marker', 22, C.pen);
    P.text(64, 72, ['left', 'top'], f(sh, 'subtitle'), 'hand', 13.5, C.pen);
    P.dot(350, 60, 18);
    P.metaRight([['track', f(sh, 'track')], ['composer', f(sh, 'composer')], ['from', f(sh, 'from')]]);
    const r = P.text(110, 614, ['left', 'top'], f(sh, 'caption1'), 'hand', 13.5, C.pen);
    P.text(f(sh, 'caption1') ? r.x1 + 6 : 110, 615, ['left', 'top'], f(sh, 'caption1_red'), 'hand', 12, C.red);
    P.text(486, 639, ['center', 'top'], f(sh, 'caption2'), 'hand', 12.5, C.pen);
    f(sh, 'quote').split('\n').forEach((l, i) => P.text(64 + (i > 0 ? 14 : 0), 660 + i * 26, ['left', 'top'], l, 'hand', 16, C.pen));
    P.text(450, 684, ['left', 'top'], f(sh, 'note'), 'hand', 12, C.red);
    P.approved(578, 722, f(sh, 'approved'));
    const n = 150, seed = hashStr(sh.id);
    P.line([65, 767], [655, 767], 0.5, 'rgb(90,90,94)');
    const real = wave && wave.peaks && wave.peaks.length >= 2 ? wave : null;
    for(let i = 0; i < n; i++){
      const x = 70 + 580 * i / (n - 1);
      const a = (real ? Math.max(0.04, real.peaks[Math.min(real.peaks.length - 1, Math.floor(i * real.peaks.length / n))]) : waveAmp(seed, i, n)) * 24;
      const past = played != null && (x - 70) / 580 <= played;
      P.line([x, 767 - a], [x, 767 + a], 1.15, past ? C.red : C.pen);
    }
    if(played != null){ const x = 70 + 580 * Math.max(0, Math.min(1, played)); P.line([x, 737], [x, 797], 1.8, C.red); }
    P.text(65, 805, ['left', 'middle'], f(sh, 'start'), 'mono', 7.5, C.pen);
    const len = real && !f(sh, 'length').trim() ? fmtTime(real.secs) : f(sh, 'length');
    P.text(655, 805, ['right', 'middle'], len, 'mono', 7.5, C.pen);
  }

  function decoCover(P, sh){
    P.dot(360, 68, 14);
    P.lines(360, 106, 0.5, f(sh, 'title'), 'marker', 24, C.pen, 38);
    P.label(360, 561, ['center', 'middle'], f(sh, 'role'));
    P.text(360, 655, ['center', 'bottom'], f(sh, 'signed'), 'hand', 34, C.pen);
    P.underline(278, 440, 654);
    P.label(280, 665, ['left', 'middle'], 'signed');
    P.text(455, 627, ['left', 'middle'], f(sh, 'note'), 'hand', 13, C.red);
    [['project', 64, 118, 243], ['film', 264, 295, 443], ['city', 463, 495, 643]].forEach(([l, lx, vx, x1]) => {
      P.label(lx, 758, ['left', 'middle'], l);
      P.text(vx, 756, ['left', 'bottom'], f(sh, l), 'hand', 13.5, C.pen);
      P.underline(vx - 5, x1, 760);
    });
  }

  function stepsMusic(P, sh, wave, played, playing){
    const { ctx, s } = P;
    const [x0, y0, x1, y1] = WAVE_STRIP, mid = y1 - 14;
    if(!String(sh.music || '').trim()){
      P.dashed(WAVE_STRIP, 'rgb(140,140,140)');
      P.text((x0 + x1) / 2, (y0 + y1) / 2, ['center', 'middle'], '♪  add the music for this sequence', 'hand', 14, 'rgb(120,120,120)');
      return;
    }
    const cx = (x0 + 12) * s, cy = mid * s;
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(cx, cy, 12 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    if(playing){ [-3.5, 3.5].forEach(dx => ctx.fillRect(cx + (dx - 1.5) * s, cy - 5.5 * s, 3 * s, 11 * s)); }
    else { ctx.beginPath(); ctx.moveTo(cx - 4 * s, cy - 6.5 * s); ctx.lineTo(cx + 7 * s, cy); ctx.lineTo(cx - 4 * s, cy + 6.5 * s); ctx.fill(); }
    const n = 120, seed = hashStr(sh.id);
    const real = wave && wave.peaks && wave.peaks.length >= 2 ? wave : null;
    for(let i = 0; i < n; i++){
      const x = WAVE_X0 + (WAVE_X1 - WAVE_X0) * i / (n - 1);
      const a = (real ? Math.max(0.05, real.peaks[Math.min(real.peaks.length - 1, Math.floor(i * real.peaks.length / n))]) : waveAmp(seed, i, n)) * 11;
      const past = played != null && (x - WAVE_X0) / (WAVE_X1 - WAVE_X0) <= played;
      P.line([x, mid - a], [x, mid + a], 1.1, past ? C.red : C.pen);
    }
    if(played != null){ const x = WAVE_X0 + (WAVE_X1 - WAVE_X0) * Math.max(0, Math.min(1, played)); P.line([x, y0 + 4], [x, y1 - 2], 1.8, C.red); }
    const total = real ? real.secs : 0;
    if(total > 0 && (sh.music_in > 0 || sh.music_out > 0)){
      const a = WAVE_X0 + (WAVE_X1 - WAVE_X0) * Math.min(1, Math.max(0, sh.music_in / total));
      const b = WAVE_X0 + (WAVE_X1 - WAVE_X0) * (sh.music_out > 0 ? Math.min(1, sh.music_out / total) : 1);
      ctx.fillStyle = 'rgba(46,107,69,0.18)'; ctx.fillRect(a * s, (y0 + 12) * s, (b - a) * s, (y1 - 1 - y0 - 12) * s);
      P.line([a, y0 + 12], [a, y1 - 1], 1.6, 'rgb(46,107,69)'); P.line([b, y0 + 12], [b, y1 - 1], 1.6, C.red);
    }
    const now = played != null ? played * total : null;
    P.text(x1, mid, ['right', 'middle'], total > 0 ? (now != null ? fmtTime(now) + ' / ' : '') + fmtTime(total) : '', 'mono', 7.5, C.pen);
    let name = musicName(sh);
    if(String(sh.music_note || '').trim()) name += ' — ' + sh.music_note.trim();
    P.text(WAVE_X0, y0 - 1, ['left', 'top'], name, 'hand', 11.5, C.red);
  }

  function decoSteps(P, sh, wave, played, playing){
    const { ctx, s } = P;
    stepsMusic(P, sh, wave, played, playing);
    P.text(64, 31, ['left', 'top'], f(sh, 'title'), 'marker', 22, C.pen);
    P.text(64, 70, ['left', 'top'], f(sh, 'task'), 'hand', 13.5, C.pen);
    P.dot(350, 60, 18);
    P.metaRight([['day', f(sh, 'day')], ['location', f(sh, 'location')], ['camera', f(sh, 'camera')]]);
    stepCells(sh.slots.length).forEach(([pic, cap], i) => {
      const sl = sh.slots[i] || {};
      if(sl.role){
        ctx.font = P.font('bold', 8.5);
        const w = ctx.measureText(sl.role.toUpperCase()).width / s;
        ctx.fillStyle = 'rgba(26,26,26,0.82)'; ctx.fillRect((pic[0] + 6) * s, (pic[1] + 6) * s, (w + 10) * s, 15 * s);
        P.text(pic[0] + 11, pic[1] + 8.5, ['left', 'top'], sl.role.toUpperCase(), 'bold', 8.5, '#fff');
      }
      P.text(cap[0], cap[1] + 1, ['left', 'top'], String(i + 1).padStart(2, '0'), 'bold', 12.5, C.accent);
      const wrap = cap[2] - cap[0] - 46;
      if(sl.text && wrap > 4){
        ctx.font = P.font('hand', 13);
        const words = sl.text.split(/\s+/), rows = [''];
        for(const w of words){
          const tryL = rows[rows.length - 1] ? rows[rows.length - 1] + ' ' + w : w;
          if(ctx.measureText(tryL).width / s > wrap && rows[rows.length - 1]){ if(rows.length === 2){ rows[1] += '…'; break; } rows.push(w); }
          else rows[rows.length - 1] = tryL;
        }
        rows.forEach((l, k) => P.text(cap[0] + 24, cap[1] + k * 16, ['left', 'top'], l, 'hand', 13, sl.done ? 'rgb(120,120,120)' : C.pen));
      }
      ctx.strokeStyle = C.pen; ctx.lineWidth = Math.max(0.6, s);
      ctx.strokeRect((cap[2] - 14) * s, (cap[1] + 3) * s, 12 * s, 12 * s);
      if(sl.done) P.tick(cap[2] - 13, cap[1] + 9, 0.9, C.red);
    });
    P.lines(64, 814, 0, f(sh, 'notes'), 'hand', 14, C.pen, 20);
    P.approved(578, 835, f(sh, 'approved'));
  }

  function musicLine(P, sh){
    const { ctx, s } = P;
    const x = 66, y = 874;
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(x * s, (y + 3) * s, 3.4 * s, 0, Math.PI * 2); ctx.fill();
    P.line([x + 3, y + 3], [x + 3, y - 9], 1.3, C.red); P.line([x + 3, y - 9], [x + 8, y - 6], 1.3, C.red);
    let t = musicName(sh);
    if(String(sh.music_note || '').trim()) t += ' — ' + sh.music_note.trim();
    P.text(x + 14, y, ['left', 'middle'], t, 'hand', 12.5, C.red);
  }

  /* a file name or a link's last part, kept to 80 characters (ytdlp.js '%(title).80B') */
  function musicName(sh){
    if(sh.music_name) return sh.music_name.slice(0, 80);
    const t = String(sh.music || '').trim().replace(/\/$/, '');
    let last = t.split(/[\\/]/).pop() || t;
    last = last.replace(/\.[a-z0-9]{2,4}$/i, '');
    const m = / \[[^\]]+\]$/.exec(last);
    if(m && last.slice(0, m.index).trim()) last = last.slice(0, m.index);
    return last.replace(/_/g, ' ').replace(/ - /g, ' — ').slice(0, 80);
  }

  /* Draw a page. opts: { scale, t (seconds, to make GIFs and clips move),
     media: { uid → loaded media }, wave, played, playing, linesOnly } */
  function draw(ctx, sh, opts){
    const o = opts || {};
    const s = o.scale || 1;
    const P = Pen(ctx, s);
    ctx.save();
    paper(P, !!o.linesOnly);
    if(sh.layout === 'cover'){
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(224.5 * s, 200 * s, 273 * s, 351 * s);
      ctx.fillStyle = 'rgb(248,248,246)'; ctx.fillRect(223 * s, 197 * s, 273 * s, 351 * s);
    }
    const rects = slotRects(sh.layout, sh.slots.length);
    rects.forEach((r, i) => {
      const slot = sh.slots[i] || { item:'' };
      picture(P, slot, r, o.media ? o.media[slot.item] : null, o.t);
      if(sh.layout === 'steps' && slot.done){ ctx.fillStyle = 'rgba(255,255,255,0.43)'; ctx.fillRect(r[0] * s, r[1] * s, (r[2] - r[0]) * s, (r[3] - r[1]) * s); }
    });
    const played = o.played != null ? o.played : null;
    switch(sh.layout){
      case 'frames': decoFrames(P, sh); break;
      case 'compare': decoCompare(P, sh); break;
      case 'character': decoCharacter(P, sh); break;
      case 'soundtrack': decoSoundtrack(P, sh, o.wave, played); break;
      case 'steps': decoSteps(P, sh, o.wave, played, !!o.playing); break;
      default: decoCover(P, sh);
    }
    if(String(sh.music || '').trim() && sh.layout !== 'steps') musicLine(P, sh);
    ctx.restore();
  }

  /* everything a page needs before it can be drawn */
  let fontsReady = null;
  function fonts(){
    if(!fontsReady){
      fontsReady = Promise.all([
        document.fonts.load('20px "NB Marker"'), document.fonts.load('20px "NB Hand"'),
        document.fonts.load('20px "NB Mono"'), document.fonts.load('700 20px "NB Bold"')
      ]).catch(() => null);
    }
    return fontsReady;
  }
  async function prepare(sh){
    await fonts();
    const lib = await MediaLib.load();
    const out = {};
    await Promise.all((sh.slots || []).filter(x => x.item).map(async x => { out[x.item] = await mediaFor(lib, x.item); }));
    return out;
  }

  /* ------------------------------------------------------------ music */
  const waves = new Map();
  async function musicBlob(sh){
    const m = String(sh.music || '');
    if(m.startsWith('nb:')){ try { return await Store.get('nb-music', m.slice(3)); } catch(e){ return null; } }
    return null;
  }
  /* 150 bars of RMS loudness, scaled to the loudest */
  async function waveOf(sh){
    const m = String(sh.music || '');
    if(!m.startsWith('nb:')) return null;
    if(waves.has(m)) return waves.get(m);
    const p = (async () => {
      const b = await musicBlob(sh);
      if(!b) return null;
      try {
        const AC = global.AudioContext || global.webkitAudioContext;
        const ac = new AC();
        const buf = await ac.decodeAudioData(await b.arrayBuffer());
        if(ac.close) ac.close();
        const data = buf.getChannelData(0), n = 150, step = Math.floor(data.length / n) || 1, peaks = [];
        for(let i = 0; i < n; i++){
          let sum = 0, cnt = 0;
          for(let k = i * step; k < Math.min(data.length, (i + 1) * step); k += 8){ sum += data[k] * data[k]; cnt++; }
          peaks.push(Math.sqrt(sum / Math.max(1, cnt)));
        }
        const mx = Math.max(...peaks, 1e-6);
        return { peaks:peaks.map(x => x / mx), secs:buf.duration };
      } catch(e){ return null; }
    })();
    waves.set(m, p);
    return p;
  }
  async function attachMusic(sh, file){
    const id = 'mu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    await Store.put('nb-music', file, id);
    sh.music = 'nb:' + id;
    sh.music_name = (file.name || 'music').replace(/\.[a-z0-9]{2,4}$/i, '');
    sh.music_in = 0; sh.music_out = 0;
    if(sh.layout === 'soundtrack'){
      const tr = f(sh, 'track').trim();
      if(!tr || tr === 'Track title') sh.fields.track = musicName(sh);
      sh.fields.length = '';
    }
  }

  /* one player for the whole app */
  const player = { el:null, key:'', out:0 };
  async function playerFor(sh){
    const key = String(sh.music || '');
    if(player.key === key && player.el) return player.el;
    if(player.el) player.el.pause();
    let src = key;
    if(key.startsWith('nb:')){ const b = await musicBlob(sh); if(!b) return null; src = URL.createObjectURL(b); }
    else if(!/^https?:/i.test(key) || !/\.(mp3|m4a|wav|ogg|opus|webm|aac|flac)(\?|$)/i.test(key)) return null;
    player.el = new Audio(src);
    player.key = key;
    player.el.addEventListener('timeupdate', () => {
      if(player.out > 0 && player.el.currentTime >= player.out){ player.el.pause(); player.out = 0; }
    });
    return player.el;
  }
  const playState = sh => (player.key === String(sh.music || '') && player.el)
    ? { pos:player.el.currentTime, dur:player.el.duration || 0, playing:!player.el.paused } : null;
  const setOut = sec => { player.out = sec || 0; };

  /* ------------------------------------------------------------ palette (sheet.rs palette_of) */
  const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  function hsv(c){
    const [r, g, b] = c.map(x => x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if(d > 1e-6){ h = mx === r ? ((60 * ((g - b) / d)) % 360 + 360) % 360 : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); }
    return [h, mx <= 1e-6 ? 0 : d / mx, mx];
  }
  function kmeans(px, k, rounds){
    if(!px.length || !k) return [];
    const sorted = px.slice().sort((a, b) => lum(a) - lum(b));
    let c = Array.from({ length:k }, (_, i) => sorted[Math.min(sorted.length - 1, Math.floor((i + 0.5) / k * sorted.length))].slice());
    for(let r = 0; r < rounds; r++){
      const sum = c.map(() => [0, 0, 0]), n = c.map(() => 0);
      for(const p of px){
        let best = 0, bd = Infinity;
        c.forEach((q, j) => { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if(d < bd){ bd = d; best = j; } });
        sum[best][0] += p[0]; sum[best][1] += p[1]; sum[best][2] += p[2]; n[best]++;
      }
      c = c.map((q, j) => n[j] ? [sum[j][0] / n[j], sum[j][1] / n[j], sum[j][2] / n[j]] : q);
    }
    return c.sort((a, b) => lum(a) - lum(b));
  }
  function paletteOf(px){
    if(px.length < 16) return null;
    const main = kmeans(px, 5, 12);
    let blue = 0, warm = 0, green = 0;
    for(const p of px){ if(p[1] > p[0] + 4 && p[1] > p[2] + 4) green++; else if(p[2] > p[0]) blue++; else warm++; }
    const [family, count, hueC] = blue >= warm && blue >= green ? ['blue', blue, 210] : warm >= green ? ['warm', warm, 25] : ['green', green, 120];
    const acc = px.filter(p => { const [h, s, v] = hsv(p); let dh = Math.abs(h - hueC); dh = Math.min(dh, 360 - dh); return s > 0.3 && v > 0.15 && dh > 60; });
    const accents = acc.length >= Math.floor(px.length / 200) + 4 ? kmeans(acc, 2, 10)
      : main.slice().sort((a, b) => hsv(b)[1] - hsv(a)[1]).slice(0, 2);
    return { main:main.map(toHex), accents:accents.map(toHex), family, share:count / px.length };
  }
  /* every picture spot shrunk to about 48 px and its pixels pooled */
  async function paletteFromSlots(sh){
    const lib = await MediaLib.load();
    const px = [];
    for(const sl of sh.slots){
      if(!sl.item) continue;
      const m = await mediaFor(lib, sl.item);
      const src = drawable(m, null);
      if(!src) continue;
      const w = src.videoWidth || src.width, h = src.videoHeight || src.height;
      if(!w || !h) continue;
      const k = 48 / Math.max(w, h);
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      const x = c.getContext('2d'); x.drawImage(src, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      for(let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
    }
    return paletteOf(px);
  }

  /* random frames from the Deck (or a board or library) into the empty spots */
  async function fillEmpty(sh, from){
    const lib = await MediaLib.load();
    let pool;
    if(from && from.startsWith('board:')){
      const b = (await MediaLib.allBoards()).find(x => x.id === from.slice(6));
      pool = b ? b.items.map(u => MediaLib.find(lib, u)).filter(Boolean) : [];
    } else if(from && from.startsWith('col:')){
      pool = lib.items.filter(it => (lib.pageIdx.get(it.page) || {}).colKey === from.slice(4));
    } else pool = (await MediaLib.deck({})).list;
    const used = new Set(sh.slots.map(x => x.item));
    pool = pool.map(it => it.uid).filter(u => !used.has(u));
    if(!pool.length) return 0;
    let n = 0;
    const taken = new Set();
    for(const sl of sh.slots.filter(x => !x.item)){
      for(let k = 0; k < 20; k++){
        const u = pool[Math.floor(Math.random() * pool.length)];
        if(!taken.has(u) || taken.size >= pool.length){ taken.add(u); sl.item = u; n++; break; }
      }
    }
    return n;
  }

  /* ------------------------------------------------------------ saving */
  const fileName = sh => (String(sh.name || 'page').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'page');

  /* a 1080 × 1350 PNG, ready for a carousel */
  async function savePicture(sh, linesOnly){
    const m = await prepare(sh);
    const wave = await waveOf(sh);
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
    draw(c.getContext('2d'), sh, { scale:1.5, media:m, wave, linesOnly });
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return Saver.save(fileName(sh) + '.png', blob, 'image/png', 'Save the page');
  }

  /* a 720 × 900 video at 24 fps for the page's length, GIFs and clips moving inside */
  async function saveVideo(sh, linesOnly, onProgress){
    const m = await prepare(sh);
    const wave = await waveOf(sh);
    const c = document.createElement('canvas'); c.width = PAGE_W; c.height = PAGE_H;
    const ctx = c.getContext('2d');
    const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const type = types.find(t => global.MediaRecorder && MediaRecorder.isTypeSupported(t));
    if(!type) throw new Error('This device cannot record video');
    Object.values(m).forEach(x => { if(x && x.kind === 'video'){ x.el.currentTime = 0; x.el.play().catch(() => {}); } });
    const stream = c.captureStream(PAGE_FPS);
    const rec = new MediaRecorder(stream, { mimeType:type, videoBitsPerSecond:8000000 });
    const parts = [];
    rec.ondataavailable = e => { if(e.data && e.data.size) parts.push(e.data); };
    const secs = Math.max(1, Math.min(30, +sh.seconds || 5));
    const done = new Promise(r => { rec.onstop = r; });
    draw(ctx, sh, { media:m, t:0, wave, linesOnly });
    rec.start(250);
    const t0 = performance.now();
    await new Promise(res => {
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        draw(ctx, sh, { media:m, t, wave, linesOnly });
        if(onProgress) onProgress(Math.min(1, t / secs));
        if(t >= secs) return res();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    rec.stop();
    await done;
    const blob = new Blob(parts, { type:type.split(';')[0] });
    return Saver.save(fileName(sh) + (type.startsWith('video/mp4') ? '.mp4' : '.webm'), blob, blob.type, 'Save the video');
  }

  global.Notebook = {
    PAGE_W, PAGE_H, PAGE_FPS, GRID_SQUARES, MAX_STEPS, TASK_SHOTS_MIN, ROLES, TASK_NEEDS, TASK_STEPS,
    LAYOUTS, FRAMES_PALETTE, SWATCHES, WAVE_STRIP, WAVE_X0, WAVE_X1,
    layoutName, slotCount, fieldsOf, designs, carousel, stepsPage, copyNew,
    fovDegrees, focalList, missingRoles, roleLine, parseHex, fmtTime,
    slotRects, stepCells, textSpots, fieldOf, setField,
    draw, prepare, fonts, mediaFor, gifSeconds,
    waveOf, attachMusic, playerFor, playState, setOut, musicName,
    paletteFromSlots, paletteOf, fillEmpty, savePicture, saveVideo
  };
})(window);
