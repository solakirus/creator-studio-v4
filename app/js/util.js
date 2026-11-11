/* Shared helpers: slugs, generated artwork, icons, toast. */
(function(global){
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const pad  = n => String(n).padStart(2,'0');

  function hash(str){
    let h = 0;
    for(let i=0;i<str.length;i++) h = (h*31 + str.charCodeAt(i))|0;
    return Math.abs(h);
  }

  const PALETTES = [
    ["#7A4A28","#2A1710"], ["#2F4A63","#141E28"], ["#3F5B44","#16211A"],
    ["#5C3E62","#211828"], ["#6B5227","#231B0F"], ["#7A3A3A","#281414"]
  ];

  /* Deterministic cover art so a card without a photo still looks designed. */
  function generatedArt(key, title, w, h){
    w = w || 360; h = h || 114;
    const n = hash(key), [a,b] = PALETTES[n % PALETTES.length];
    const angle = 115 + (n % 5) * 12, cx = 18 + (n % 4) * 22;
    const letter = (String(title).trim()[0] || '?').toUpperCase();
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<defs><linearGradient id="g" gradientTransform="rotate(${angle-90} .5 .5)">` +
      `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>` +
      `<radialGradient id="r" cx="${cx}%" cy="22%" r="68%">` +
      `<stop offset="0" stop-color="#FFFFFF" stop-opacity=".16"/>` +
      `<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" fill="url(#r)"/>` +
      `<text x="${w-26}" y="${h*0.84}" text-anchor="end" font-family="Red Hat Display, sans-serif" ` +
      `font-weight="900" font-size="${h*1.03}" fill="#FFFFFF" fill-opacity=".07">${letter}</text></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  const ICON = {
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5.5 5.5L20 7"/></svg>',
    chevR:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
    chevL:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    chevD:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    image:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-6 6"/></svg>',
    move:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/></svg>',
    pencil:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4.5-1.2L19.3 8A2.3 2.3 0 0 0 16 4.7L5.2 15.5z"/><path d="M14.8 6.2l3 3"/></svg>',
    trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5h16M9.5 6.5V4.2h5v2.3M6.5 6.5l1 13.3h9l1-13.3M10 10v6M14 10v6"/></svg>',
    repeat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h13l-3-3M21 16H8l3 3"/></svg>',
    clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3.6"/><path d="M12 2.2v2.6M12 19.2v2.6M21.8 12h-2.6M4.8 12H2.2M18.9 5.1l-1.9 1.9M7 17l-1.9 1.9M18.9 18.9L17 17M7 7L5.1 5.1"/></svg>',
    gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.4"/><path d="M19.1 14.4a1.6 1.6 0 0 0 .32 1.77l.06.06a1.9 1.9 0 1 1-2.69 2.69l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V20a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1.04-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a1.9 1.9 0 1 1-2.69-2.69l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H4a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.46-1.04 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.9 1.9 0 1 1 2.69-2.69l.06.06a1.6 1.6 0 0 0 1.77.32h.08a1.6 1.6 0 0 0 .97-1.47V4a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 .97 1.47h.08a1.6 1.6 0 0 0 1.77-.32l.06-.06a1.9 1.9 0 1 1 2.69 2.69l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97H20a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.47.97z"/></svg>'
  };

  let toastTimer;
  function toast(msg){
    let el = document.querySelector('.toast');
    if(!el){ el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add('on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
  }

  /* Day numbers are how things are stored, but a date is what people think in.
     These render a date field and convert between the two. */
  async function dayField(id, day){
    const d = await Data.dayToDate(day || await Data.currentDay());
    const iso = new Date(d - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0,10);
    return `<div class="field">
      <label for="${id}">Date</label>
      <input id="${id}" type="date" value="${iso}">
      <p class="err" id="${id}-note" style="color:var(--muted);font-weight:400" hidden></p>
    </div>`;
  }
  /* Keep a live "that is day N" line under the field. */
  function wireDayField(sheetEl, id){
    const input = sheetEl.querySelector('#' + id);
    const note = sheetEl.querySelector('#' + id + '-note');
    if(!input || !note) return;
    const refresh = async () => {
      const ts = new Date(input.value + 'T09:00').getTime();
      if(isNaN(ts)) return note.hidden = true;
      const n = await Data.dateToDay(ts);
      note.hidden = false;
      note.textContent = n >= 1
        ? `Day ${n} · week ${Math.ceil(n / 7)} of your program`
        : `${1 - n} day${1 - n === 1 ? '' : 's'} before your program starts`;
    };
    input.addEventListener('input', refresh);
    refresh();
  }
  async function readDayField(sheetEl, id){
    const v = sheetEl.querySelector('#' + id).value;
    const ts = new Date(v + 'T09:00').getTime();
    if(isNaN(ts)) return null;
    /* Days before the programme starts are real days — the practice weeks before
       day one are week -1 and week 0. Clamping to 1 silently moved anything
       scheduled there onto the first day. */
    return await Data.dateToDay(ts);
  }

  /* Which days of the week something runs on. The program owned this; the series
     and the daily vlog want the same control, so it lives here rather than being
     copied twice and drifting. */
  const DOW = ['Mo','Tu','We','Th','Fr','Sa','Su'];
  const DOW_N = [1,2,3,4,5,6,0];            /* display order, Monday first */
  const DOW_FULL = { 0:'Sunday', 1:'Monday', 2:'Tuesday', 3:'Wednesday',
                     4:'Thursday', 5:'Friday', 6:'Saturday' };

  function dayGrid(days){
    const on = days || [];
    return `<div class="pgdaygrid">${DOW_N.map((n, i) =>
      `<button type="button" data-dow="${n}" aria-pressed="${on.includes(n)}">${DOW[i]}</button>`
    ).join('')}</div>`;
  }

  /* toggling inside any sheet that drew one */
  function wireDayGrid(host, onChange){
    host.addEventListener('click', e => {
      const b = e.target.closest('[data-dow]');
      if(!b || !host.contains(b)) return;
      const on = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', String(!on));
      if(onChange) onChange(readDayGrid(host));
    });
  }

  const readDayGrid = host => [...host.querySelectorAll('[data-dow]')]
    .filter(b => b.getAttribute('aria-pressed') === 'true')
    .map(b => +b.dataset.dow);

  /* "Mon, Wed and Fri" — how a cadence reads once it is real days */
  function daysLabel(days){
    const on = (days || []).slice().sort((a, b) => DOW_N.indexOf(a) - DOW_N.indexOf(b));
    if(!on.length) return 'No days yet';
    if(on.length === 7) return 'Every day';
    const names = on.map(n => DOW_FULL[n].slice(0, 3));
    return names.length === 1 ? names[0]
      : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }

  /* A new task's id. Tasks used to take "the highest id + 1", which is fine on
     one device and wrong on two: the phone and the laptop both see 41 as the
     highest, both make a 42, and when they sync one of them overwrites the
     other. This is the time in ms with three random digits after it — still a
     plain number, still bigger than every older id so sorting by id keeps
     creation order, and never the same on two devices. Calls in one session
     only ever go up, so a loop that makes several tasks gets distinct ids. */
  let lastTaskId = 0;
  function taskId(){
    const t = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    lastTaskId = Math.max(t, lastTaskId + 1);
    return lastTaskId;
  }

  global.U = {
    taskId, DOW, DOW_N, DOW_FULL, dayGrid, wireDayGrid, readDayGrid, daysLabel, slug, pad, hash, generatedArt, ICON, toast, dayField, wireDayField, readDayField };
})(window);
