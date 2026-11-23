/* The paper's pages, as one HTML document Chromium prints to a Letter PDF.

     html(edition, words, weather, { paperName, masthead, place, printedAt, src, fontsCss })

   A1 is the front page: your day. A2 (and A3…) is "To film today" — every
   video on today's list with one frame from its shots. No shoots, no A2.

   Every page is a fixed 8.5 × 11 in sheet (816 × 1056 CSS px). Anything that
   could run long is capped or clipped, so nothing spills onto a page of its
   own. Black ink only: it has to read off a black-and-white laser. */
'use strict';

const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const GOOGLE = 'https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Red+Hat+Display:wght@700;900&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=block';
const PER_FILM_PAGE = 5;

const CSS = `
@page { size: 8.5in 11in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #111; }
body { font-family: 'Source Serif 4', 'Noto Serif', Georgia, serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 816px; height: 1056px; padding: 40px 48px 34px; display: flex; flex-direction: column; overflow: hidden; page-break-after: always; break-after: page; position: relative; }
.page:last-child { page-break-after: auto; break-after: auto; }
.sans { font-family: 'Red Hat Display', 'Noto Sans', Arial, sans-serif; }
.label { font-family: 'Red Hat Display', 'Noto Sans', Arial, sans-serif; font-weight: 700; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
.head { border-bottom: 2px solid #111; padding-bottom: 3px; display: flex; justify-content: space-between; gap: 8px; white-space: nowrap; }
.head > span:first-child { overflow: hidden; text-overflow: ellipsis; }
.tagline { text-align: center; font-style: italic; font-size: 12px; color: #444; }
.mast-bl { text-align: center; font-family: 'UnifrakturMaguntia', 'Noto Serif', serif; font-size: 72px; line-height: 1; margin: 6px 0 8px; white-space: nowrap; }
.mast-rh { text-align: center; font-family: 'Red Hat Display', 'Noto Sans', Arial, sans-serif; font-weight: 900; font-size: 62px; line-height: 1; letter-spacing: -.02em; margin: 8px 0 10px; text-transform: uppercase; white-space: nowrap; }
.dateline { border-top: 3px solid #111; border-bottom: 1px solid #111; padding: 5px 0; display: flex; justify-content: space-between; gap: 12px; font-family: 'Red Hat Display', 'Noto Sans', Arial, sans-serif; font-weight: 700; font-size: 11.5px; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
.cols { display: flex; gap: 22px; margin-top: 14px; flex: 1 1 auto; min-height: 0; }
.left { width: 470px; flex: none; display: flex; flex-direction: column; gap: 14px; min-height: 0; overflow: hidden; }
.rule-v { width: 1px; background: #111; flex: none; }
.right { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 15px; overflow: hidden; }
h1 { margin: 3px 0 4px; font-size: 30px; line-height: 1.1; font-weight: 700; text-wrap: balance; }
.deck { font-style: italic; font-size: 14px; color: #333; }
.story { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 0; font-size: 12.5px; line-height: 1.45; text-align: justify; hyphens: auto; }
.story > div { display: -webkit-box; -webkit-line-clamp: 9; -webkit-box-orient: vertical; overflow: hidden; }
.story > div:first-child { border-right: 1px solid #111; padding-right: 11px; }
.story > div:last-child { padding-left: 11px; }
.row { display: grid; grid-template-columns: 16px 70px minmax(0, 1fr) 58px; gap: 8px; padding: 5px 0; border-bottom: 1px solid #bbb; font-size: 13px; align-items: start; }
.row:last-child { border-bottom: 0; }
.box { width: 12px; height: 12px; border: 1.5px solid #111; margin-top: 2px; }
.box.on::after { content: ''; display: block; width: 7px; height: 4px; border-left: 2px solid #111; border-bottom: 2px solid #111; transform: translate(1px, 1px) rotate(-45deg); }
.row .t { font-weight: 700; }
.row .n { font-size: 12px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row.done .t { text-decoration: line-through; }
.tag { text-align: right; font-family: 'Red Hat Display', 'Noto Sans', Arial, sans-serif; font-weight: 700; font-size: 11.5px; letter-spacing: .04em; }
.more { font-size: 12px; font-style: italic; color: #444; padding-top: 4px; }
.week div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12.5px; line-height: 1.5; }
.week b { font-family: 'Red Hat Display', 'Noto Sans', Arial, sans-serif; letter-spacing: .06em; font-size: 12px; }
.temp { font-size: 34px; font-weight: 700; line-height: 1; }
.small { font-size: 12.5px; line-height: 1.4; }
.mini { display: grid; grid-template-columns: 40px minmax(0, 1fr) 56px; padding: 3px 0; border-top: 1px solid #bbb; font-size: 12px; }
.mini:last-child { border-bottom: 1px solid #bbb; }
.lift { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; border-bottom: 1px solid #bbb; font-size: 12.5px; }
.lift:last-child { border-bottom: 0; }
.lift span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hab { display: grid; grid-template-columns: minmax(0, 1fr) 112px; row-gap: 3px; margin-top: 6px; font-size: 12.5px; align-items: center; }
.hab .nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 6px; }
.dots { display: grid; grid-template-columns: repeat(7, 16px); font-size: 13px; text-align: center; }
.dots.h { font-family: 'Red Hat Display', 'Noto Sans', Arial, sans-serif; font-weight: 700; font-size: 11px; }
.foot { border-top: 1px solid #111; padding-top: 5px; margin-top: 10px; text-align: center; font-family: 'Red Hat Display', 'Noto Sans', Arial, sans-serif; font-weight: 700; font-size: 11.5px; letter-spacing: .1em; text-transform: uppercase; }
.runhead { display: flex; justify-content: space-between; border-bottom: 1px solid #111; padding-bottom: 5px; font-family: 'Red Hat Display', 'Noto Sans', Arial, sans-serif; font-weight: 700; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
.section { border-bottom: 3px solid #111; padding: 6px 0 5px; font-family: 'Red Hat Display', 'Noto Sans', Arial, sans-serif; font-weight: 900; font-size: 14px; letter-spacing: .14em; }
.film { display: flex; flex-direction: column; gap: 14px; margin-top: 14px; }
.shoot { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 18px; padding-bottom: 14px; border-bottom: 1px solid #bbb; }
.shoot:last-child { border-bottom: 0; }
.frame { width: 240px; height: 135px; border: 1px solid #111; background: #e6e6e6; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.frame img { width: 100%; height: 100%; object-fit: cover; display: block; filter: grayscale(1) contrast(1.08); }
.frame .none { font-family: 'Red Hat Display', 'Noto Sans', Arial, sans-serif; font-weight: 700; font-size: 11.5px; letter-spacing: .1em; color: #444; }
.shoot h2 { margin: 2px 0 3px; font-size: 21px; line-height: 1.15; }
.shoot .from { font-size: 12.5px; font-style: italic; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.shoot .list { font-size: 12px; line-height: 1.4; color: #222; margin-top: 5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.shoot .meta { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 6px; }
.lines { flex: 1 1 auto; min-height: 0; background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 27px, #bbb 27px, #bbb 28px); }
`;

function masthead(o){
  const name = o.paperName || 'The Kris Times';
  return o.masthead === 'redhat' ? `<div class="mast-rh">${esc(name)}</div>` : `<div class="mast-bl">${esc(name)}</div>`;
}

const DOT = { done: '●', part: '◐', miss: '○', today: '□', rest: '–', ahead: '', before: '' };

function front(e, w, wx, o){
  const items = e.today, MAX = e.shoots.length ? 9 : 10;
  const rows = items.slice(0, MAX).map(x => `
    <div class="row${x.done ? ' done' : ''}"><span class="box${x.done ? ' on' : ''}"></span><span class="t">${esc(x.time)}</span>
      <span><span class="t">${esc(x.title)}</span>${x.note ? `<div class="n">${esc(x.note)}</div>` : ''}</span><span class="tag">${esc(x.tag)}</span></div>`).join('');
  const more = items.length > MAX ? `<div class="more">…and ${items.length - MAX} more in the app.</div>` : '';
  const weekRows = e.week.filter(d => d.items.length).slice(0, 6).map(d =>
    `<div><b>${esc(d.dow)}</b> — ${esc(d.items.slice(0, 3).map(x => (x.time ? x.time.replace(/:00/, '').toLowerCase().replace(/\./g, '') + ' ' : '') + x.title).join('; '))}${d.items.length > 3 ? `; +${d.items.length - 3} more` : ''}</div>`).join('');

  const right = [];
  if (wx) right.push(`<div><div class="head label"><span>Weather</span><span>${esc(o.place || '')}</span></div>
    <div style="display:flex;align-items:baseline;gap:8px;margin-top:6px"><span class="temp">${wx.high}° / ${wx.low}°</span><span class="label" style="letter-spacing:.04em">High / Low</span></div>
    <div class="small" style="margin-top:4px">${esc(wx.words)}${wx.rain != null && wx.rain >= 20 ? `, ${wx.rain}% chance of rain` : ''}.${wx.sunset ? ` Sunset ${esc(wx.sunset.toLowerCase())}.` : ''}</div>
    <div style="margin-top:6px">${wx.next.map(d => `<div class="mini"><b>${esc(d.dow)}</b><span>${esc(d.words)}</span><span style="text-align:right">${d.high} / ${d.low}</span></div>`).join('')}</div></div>`);
  if (e.workout) right.push(`<div><div class="head label"><span>Workout</span><span>${esc(e.workout.time)}</span></div>
    <div class="small" style="font-weight:700;margin-top:4px">${esc(e.workout.title)}</div>
    <div style="margin-top:2px">${e.workout.lifts.slice(0, 6).map(l => `<div class="lift"><span>${esc(l.name)}</span><b>${esc(l.amount)}</b></div>`).join('') || '<div class="small">The lifts are in the app.</div>'}${e.workout.lifts.length > 6 ? `<div class="more">…and ${e.workout.lifts.length - 6} more</div>` : ''}</div></div>`);
  if (e.due.length) right.push(`<div><div class="head label"><span>Videos · by channel</span></div>
    <div style="display:flex;flex-direction:column;gap:5px;margin-top:6px" class="small">${e.due.slice(0, 5).map(g =>
      `<div><b>${esc(g.channel)}</b> — ${g.items.slice(0, 3).map(i => `“${esc(i.title)}” ${esc(i.when)}${i.stage && !i.late ? ` (${esc(i.stage)})` : ''}`).join('. ')}.</div>`).join('')}</div></div>`);
  if (e.habits.length) right.push(`<div><div class="head label"><span>The streak</span><span>Last 7 days</span></div>
    <div class="hab"><span></span><span class="dots h">${e.habits[0].dots.map(d => `<span>${d.dow}</span>`).join('')}</span>
    ${e.habits.slice(0, 6).map(h => `<span class="nm">${esc(h.name)}${h.streak && h.streak.n > 1 ? ` <i style="color:#444">(${h.streak.n})</i>` : ''}</span><span class="dots">${h.dots.map(d => `<span>${DOT[d.st] || ''}</span>`).join('')}</span>`).join('')}</div>
    <div style="font-size:12px;font-style:italic;color:#444;margin-top:4px">● done · ○ missed · □ today · ( ) streak</div></div>`);
  if (e.openPast.length) right.push(`<div><div class="head label"><span>Still open</span><span>${e.openPast.length}</span></div>
    <div style="margin-top:4px">${e.openPast.slice(0, 5).map(x => `<div class="lift"><span>${esc(x.title)}</span><span style="color:#444">${x.ago === 1 ? 'yesterday' : x.ago + ' days ago'}</span></div>`).join('')}</div></div>`);
  if (e.shoots.length) right.push(`<div><div class="head label"><span>To film</span><span>Page A2</span></div>
    <div class="small" style="margin-top:4px">${e.shoots.length} video${e.shoots.length === 1 ? '' : 's'}, ${e.counts.shots} shot${e.counts.shots === 1 ? '' : 's'}: ${esc(e.shoots.slice(0, 3).map(s => s.title).join(', '))}${e.shoots.length > 3 ? '…' : ''}.</div></div>`);

  return `<section class="page">
  <div class="tagline">Phone stays on the charger. Everything you need is right here.</div>
  ${masthead(o)}
  <div class="dateline"><span>Vol. 1 — ${esc(e.date)} — ${esc(o.place || '')}${o.printedAt ? ' — Printed ' + esc(o.printedAt) : ''}</span><span>${esc(e.dayLabel)}${!e.pre ? ' · Week ' + e.weekNo : ''}</span></div>
  <div class="cols">
    <div class="left">
      <div><div class="label">Your day${e.name ? ', ' + esc(e.name.split(/\s+/)[0]) : ''}</div>
        <h1>${esc(w.headline)}</h1>
        ${w.deck ? `<div class="deck">${esc(w.deck)}</div>` : ''}</div>
      <div class="story"><div>${esc(w.story[0] || '')}</div><div>${esc(w.story[1] || '')}</div></div>
      <div><div class="head label"><span>Today</span><span>${items.length} item${items.length === 1 ? '' : 's'}</span></div>
        <div>${rows || '<div class="small" style="padding:8px 0">Nothing on the list today.</div>'}</div>${more}</div>
      ${weekRows ? `<div class="week"><div class="head label"><span>This week</span></div><div style="margin-top:5px">${weekRows}</div></div>` : ''}
    </div>
    <div class="rule-v"></div>
    <div class="right">${right.join('')}</div>
  </div>
  <div class="foot">${esc(o.paperName || 'The Kris Times')} — ${esc(e.date)} — A1</div>
</section>`;
}

function filmPages(e, o){
  const out = [];
  for (let p = 0; p * PER_FILM_PAGE < e.shoots.length; p++) {
    const part = e.shoots.slice(p * PER_FILM_PAGE, (p + 1) * PER_FILM_PAGE);
    const pg = 'A' + (p + 2);
    const cards = part.map(s => {
      const img = s.frame && o.src ? o.src(s.frame) : '';
      return `<div class="shoot">
        <div class="frame">${img ? `<img src="${esc(img)}" alt="">` : '<span class="none">NO FRAME YET</span>'}</div>
        <div style="min-width:0">
          <div class="label">${esc([s.time, s.mins ? s.mins + ' min' : ''].filter(Boolean).join(' · ') || 'Any time')}</div>
          <h2>${esc(s.title)}</h2>
          ${s.from || s.video ? `<div class="from">${esc([s.video && s.video !== s.title ? s.video : '', s.from].filter(Boolean).join(' — '))}</div>` : ''}
          ${s.hook ? `<div class="from">Hook: “${esc(s.hook)}”</div>` : ''}
          ${s.shots.length ? `<div class="list">${esc(s.shots.join(' · '))}</div>` : ''}
          <div class="meta"><span class="label" style="letter-spacing:.06em">${s.total ? `${s.total} shot${s.total === 1 ? '' : 's'}${s.taken ? ` · ${s.taken} taken` : ''}` : 'No shot list yet'}</span>
            <span style="display:flex;align-items:center;gap:6px" class="label"><span class="box${s.done ? ' on' : ''}"></span>Filmed</span></div>
        </div></div>`;
    }).join('');
    const last = (p + 1) * PER_FILM_PAGE >= e.shoots.length;
    out.push(`<section class="page">
  <div class="runhead"><span>${esc(o.paperName || 'The Kris Times')}</span><span>${esc(e.date)}</span><span>${pg}</span></div>
  <div class="section">TO FILM TODAY</div>
  ${p === 0 ? `<div style="margin-top:12px"><div class="label">${e.shoots.length} video${e.shoots.length === 1 ? '' : 's'} · ${e.counts.shots} shot${e.counts.shots === 1 ? '' : 's'}</div>
    <h1 style="font-size:28px">${e.shoots.length === 1 ? esc(e.shoots[0].title) : `${e.shoots.length} videos on today’s shoot list`}</h1>
    <div class="deck">One frame from each, so you know the look before you pick up the camera. Shoot mode in the app has every shot.</div></div>` : ''}
  <div class="film">${cards}</div>
  ${last ? `<div style="margin-top:14px;flex:1 1 auto;display:flex;flex-direction:column;min-height:60px"><div class="head label"><span>Notes from the shoot</span></div><div class="lines"></div></div>` : '<div style="flex:1 1 auto"></div>'}
  <div class="foot">${esc(o.paperName || 'The Kris Times')} — ${esc(e.date)} — ${pg}</div>
</section>`);
  }
  return out;
}

function html(e, w, wx, opts){
  const o = opts || {};
  const pages = [front(e, w, wx, o), ...filmPages(e, o)];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(o.paperName || 'The Kris Times')} — ${esc(e.date)}</title>
${o.fontsCss ? `<style>${o.fontsCss}</style>` : `<link rel="stylesheet" href="${GOOGLE}">`}
<style>${CSS}${o.screen ? '@media screen { body { background:#d8d8d8; padding:24px 0; } .page { margin:0 auto 24px; background:#fff; box-shadow:0 2px 10px rgba(0,0,0,.25); } }' : ''}</style>
</head><body>
${pages.join('\n')}
<script>
/* a box that would be cut off at the bottom of its column comes out whole,
   so the page never ends on a heading with nothing under it */
document.querySelectorAll('.right, .left').forEach(col => {
  const end = col.getBoundingClientRect().bottom;
  [...col.children].reverse().forEach(c => { if (c.getBoundingClientRect().bottom > end + 1 && c !== col.firstElementChild) c.remove(); });
});
</script>
</body></html>`;
}

module.exports = { html, esc, GOOGLE, PER_FILM_PAGE, pageCount: e => 1 + Math.ceil(e.shoots.length / PER_FILM_PAGE) };
