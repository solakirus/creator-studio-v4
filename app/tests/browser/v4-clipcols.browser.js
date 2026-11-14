/* Browser test: a clip's Plan script as columns — one per beat, side by side
   like a day's sequences — with Beginning · Middle · End to start from.

     node app/tests/browser/v4-clipcols.browser.js [outDir] */
const path = require('path'), fs = require('fs');
let pw;
try { pw = require('playwright-core'); } catch(e){ try { pw = require('playwright'); } catch(e2){ pw = require('/opt/npm-tools/node_modules/playwright'); } }
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out'));
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const url = 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/');
const S = '.screen:last-child #clipScript';
const GIF = 'R0lGODlhoABaAIEAAP+MAB48jAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQADAAAACwAAAAAoABaAAAI/wADCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJsqTJkyhTqlzJsqXLlzBjypxJs6bNmzhz6tzJs6fPn0CDCh1KtKjRo0iTKl3KtKnTp1CjSp1KtarVq1izVgTAtWtXrTq9ih0LlubYs2TLukTLNq3alG3jen2LUq5drnRL3t2bV+Tev30//h0cmOPgw4U1Hiac+OJixI23PgYceeJkyJUhXmac+eFmyp0bfuYcWuFo0KUTnuab2vRqu61dv44bW/Vs2rUP3sadu+Dutr0N/mYbXPhwscWNH/+anODyuc2dP4/uezp16cOvV8+uHfvt7spfgzrXLX48+dHmbW9OL/sxe4aL33u+K98y2vr48+vfz7+///8ABijggAQWaOCBCCao4IIMNujggxBGmFlAACH5BAEMAAIALAAAAACgAFoAgf+MAEE8eAAAAAAAAAj/AAMIHEiwoMGDCBMqXMiwocOHECNKnEixosWLGDNq3Mixo8ePIEOKHEmypMmTKFOqXMmypcuXMGPKnEmzps2bOHPq3Mmzp8+fQIMKHUq0qNGjSJMqXcq0qdOnUKNKnUq1qtWrWLOuBMC1a1etOr2KHQuW5tizZMu6FIC2rVi1KwXIdUsXAFyUcvPWdXu3ZN6/e9v2Ffm3cGC0gz8WXnz4bGKOiyM3TvsYY2TGk71WtnwZc2aumy129vw5NMXRkj+DNh0RNenMrFu7BqzabmyHs19Pvt0wt+HavBn6pq06+MLheoEbT4h8rvLlB5uzfQ69oPTatqtbb45du8Hr1L0LaUTeXfx23+XNDyQfXj369u5zp1dPcPZ8+utd38c/fvR+/v2lVhyACAlYGoHMEXcggglONyCDCjm4IIQLTUhhQ4ddWJFgGnbo4YcghijiiCSWaOKJKKao4oostujiizDGKOOMNNZo44gBAQAh+QQBDAACACwAAAAAoABaAIH/jABkPGQAAAAAAAAI/wADCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJsqTJkyhTqlzJsqXLlzBjypxJs6bNmzhz6tzJs6fPn0CDCh1KtKjRo0iTKl3KtKnTp1CjSp1KtarVq1izBgXAtWtXrTq9ih0LlubYs2TLuhSAtq1YtSsFyHVLFwBclHLz1nV7t2Tev3vb9hX5t3BgtIM/Fl58+GxijosjN077GGNkxpO9VrZ8GXNmrpstdvb8OTTF0ZI/gzYdETXpzKxbuwas2m5sh7NfT77dMLfh2rwZ+qatOvjC4XqBG0+IfK7y5Qebs30OvaD02rarW2+OXbvB69S9C2lE3l38dt/lzQ8kH149+vbuc6dXT3D2fPrrXd/HP370fv79pVYcgAgJWBqBzBF3IIIJTjcggwo5uCCEC01IYUOHXViRYBp26OGHIIYo4ogklmjiiSimqOKKLLbo4oswxijjjDTWaKN2AQEAIfkEAQwAAgAsAAAAAKAAWgCB/4wAhzxQAAAAAAAACP8AAwgcSLCgwYMIEypcyLChw4cQI0qcSLGixYsYM2rcyLGjx48gQ4ocSbKkyZMoU6pcybKly5cwY8qcSbOmzZs4c+rcybOnz59AgwodSrSo0aNIkypdyrSp06dQo0qdSrWq1atYs14FwLVrV606vYodC5bm2LNky7oUgLatWLUrBch1SxcAXJRy89Z1e7dk3r972/YV+bdwYLSDPxZefPhsYo6LIzdO+xhjZMaTvVa2fBlzZq6bLXb2/Dk0xdGSP4M2HRE16cysW7sGrNpubIezX0++3TC34dq8GfqmrTr4wuF6gRtPiHyu8uUHm7N9Dr2g9Nq2q1tvjl27wevUvQtpRN5d/Hbf5c0PJB9ePfr27nOnV09w9nz6613fxz9+9H7+/aVWHIAICVgagcwRdyCCCU43IIMKObgghAtNSGFDh11YkWAadujhhyCGKOKIJJZo4okopqjiiiy26OKLMMYo44w01mgjWAEBACH5BAEMAAIALAAAAACgAFoAgf+MAKo8PAAAAAAAAAj/AAMIHEiwoMGDCBMqXMiwocOHECNKnEixosWLGDNq3Mixo8ePIEOKHEmypMmTKFOqXMmypcuXMGPKnEmzps2bOHPq3Mmzp8+fQIMKHUq0qNGjSJMqXcq0qdOnUKNKnUq1qtWrWLNqnQigq1evW3N+HUs27EyyaMuabSkgrduxa1UKmPu2LoC4J+fqtfsWL0m9gPm69RsSsGHBaQl7NMwYMVrFGxlLdqwW8kXJjSl/tXwZc2bNXTlX9PwZtOiJpCeDDn0aYurSmlu7fh149V3ZDWnDpoyboe7Dtnsv/F17tXCFxPcGP44wOd3lzA06bws9OsHptm9bv+48+/aC2Kt/ag+Q3Pt47r/NnxdYXvz59O7f61a/fiBt+vXZv8afnzxp/v35p5pxAR40oGkFNlccggkqSB2BDSb0IIMRKkRhhQwhhiFFg23o4YcghijiiCSWaOKJKKao4oostujiizDGKOOMNNZo440qBQQAIfkEAQwAAgAsAAAAAKAAWgCB/4wAzTwoAAAAAAAACP8AAwgcSLCgwYMIEypcyLChw4cQI0qcSLGixYsYM2rcyLGjx48gQ4ocSbKkyZMoU6pcybKly5cwY8qcSbOmzZs4c+rcybOnz59AgwodSrSo0aNIkypdyrSp06dQo0qdSrWq1atYs2pNCaCrV69bc34dSzbsTLJoy5ptKSCt27FrVQqY+7YugLgn5+q1+xYvSb2A+br1GxKwYcFpCXs0zBgxWsUbGUt2rBbyRcmNKX+1fBlzZs1dOVf0/Bm06ImkJ4MOfRpi6tKaW7t+HXj1XdkNacN2jDu37tqmey/8DTy2cIXE964+jjx52+XMETp/Hjy6wem2rR/EDl07Qe7VvQ9qTG77tvjxxMuf/54++3r0tNW/h/9a/nyB8d3fx19f//4Aqdn3H3+qdTcgfcoZeCCCAi7IHnXhOVgQhMZJmFCEFl4oWIYSDcbhhyCGKOKIJJZo4okopqjiiiy26OKLMMYo44w01mjjjf8FBAA7';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--allow-file-access-from-files'] });
  const errs = [];
  for(const [w, h, name] of [[1440, 900, 'laptop'], [400, 860, 'phone']]){
    console.log(`\n— ${name} —`);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 600 });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('dialog', d => d.accept());
    await p.goto(url); await p.waitForFunction(() => window.App && window.Structures, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    const cid = await p.evaluate(async () => (await Data.saveClip({ title: 'Morning ritual', state: 'raw', stage: 'idea', plan: { tab: 'plan' } })).id);
    const rec = () => p.evaluate(async id => { const c = await Store.get('clips', id);
      return { beats: c.plan.beats, st: (c.subs || []).filter(x => x.shot != null).sort((a, b) => a.shot - b.shot) }; }, cid);
    await p.evaluate(id => Screens.push('clip', { id, tab: 'plan' }), cid); await p.waitForTimeout(1500);
    ok(!!(await p.$(`${S} [data-st="bme"]`)), 'a clip with no beats offers Beginning · Middle · End');
    await p.click(`${S} [data-st="bme"]`); await p.waitForTimeout(1500);
    let r = await rec();
    ok(r.beats.join() === 'Beginning,Middle,End' && r.st.map(x => x.beat).join() === '0,1,2', 'one tap: three beats, a shot in each', r.beats.join(' → '));
    const cols = await p.$$eval(`${S} .sx-cols > .sx-beat`, x => x.map(y => y.getBoundingClientRect().top));
    ok(cols.length === 3 && (name === 'phone' || Math.abs(cols[0] - cols[2]) < 2), 'the beats are columns, side by side', cols.map(Math.round).join(', '));
    ok(await p.textContent(`${S} .sx-bk`) === 'Beat 1 of 3', 'each column says which beat it is');
    await p.click(`${S} [data-sadd="1"]`); await p.waitForTimeout(1200);
    await p.fill(`${S} [data-sn="3"]`, 'Kettle close-up'); await p.dispatchEvent(`${S} [data-sn="3"]`, 'change'); await p.waitForTimeout(900);
    ok(await p.evaluate(s => document.querySelectorAll(s + ' .sx-beat')[1].querySelectorAll('.sx-shot').length, S) === 2, 'a shot added to a column lands in that beat');
    await p.click(`${S} [data-ladd="3"]`); await p.waitForTimeout(1000);
    await p.fill(`${S} [data-lt="3:0"]`, 'The first hour is mine.'); await p.dispatchEvent(`${S} [data-lt="3:0"]`, 'change'); await p.waitForTimeout(900);
    r = await rec();
    ok(r.st[3].beat === 1 && r.st[3].lines[0].t === 'The first hour is mine.', 'its script line is kept on the shot');
    await p.selectOption(`${S} [data-sbeat="3"]`, '2'); await p.waitForTimeout(1200);
    ok((await rec()).st[3].beat === 2 && await p.evaluate(s => document.querySelectorAll(s + ' .sx-beat')[2].querySelectorAll('.sx-shot').length, S) === 2, 'the beat menu moves a shot to another column');
    await p.click(`${S} [data-bmv="0:1"]`); await p.waitForTimeout(1200);
    ok((await rec()).beats.join() === 'Middle,Beginning,End', '› moves a whole beat one column right');
    await p.click(`${S} [data-bmv="1:-1"]`); await p.waitForTimeout(1200);
    await p.click(`${S} .sx-addcol`); await p.waitForTimeout(900);
    ok((await rec()).beats.length === 4 && (await p.$$(`${S} .sx-cols > .sx-beat`)).length === 4, '＋ Beat adds a column');
    await p.fill(`${S} [data-bn="3"]`, 'Tag'); await p.dispatchEvent(`${S} [data-bn="3"]`, 'change'); await p.waitForTimeout(600);

    /* frames: a GIF on a shot, from starred frames (phone) or the Library (laptop) */
    const gif = await p.evaluate(async b64 => { const bin = atob(b64), u8 = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return MediaLib.addBlob(new Blob([u8], { type:'image/gif' }), { name:'walk-in.gif', label:'Walk in' }); }, GIF);
    ok(!!(await p.$(`${S} .sx-fadd`)) && /Add a frame/.test(await p.textContent(`${S} [data-sxpick="0"]`)), 'every shot card has ＋ Add a frame / GIF');
    await p.evaluate(u => { window.StarPick = { open: o => o.onPick(u) }; }, gif);
    await p.click(`${S} [data-sxpick="0"]`); await p.waitForTimeout(1500);
    let it = await p.evaluate(async id => { const c = await Store.get('clips', id); return [c.page.slots[0].item, (c.shotList || [])[0] && c.shotList[0].item]; }, cid);
    ok(it[0] === gif && it[1] === gif, 'picking one puts the GIF on the shot (kept on the clip’s shot list too)');
    await p.waitForSelector(`${S} [data-sxframe="0"] img[data-anim]`, { timeout:5000 }).catch(() => {});
    ok(await p.$eval(`${S} [data-sxframe="0"]`, f => !!f.querySelector('img[data-anim]') && !f.querySelector('img[data-anim]').hidden), 'the GIF shows on the card, moving');
    const mb = await p.textContent(`${S} [data-motion]`);
    ok(/Stop GIFs/.test(mb), 'a Stop GIFs switch shows once a shot has a frame', mb);
    await p.click(`${S} [data-motion]`); await p.waitForTimeout(500);
    let st = await p.$eval(`${S} [data-sxframe="0"]`, f => ({ img: f.querySelector('img[data-anim]').hidden, cv: f.querySelector('canvas').hidden, drawn: f.querySelector('canvas').dataset.drawn }));
    ok(st.img && !st.cv && st.drawn === '1' && /Play GIFs/.test(await p.textContent(`${S} [data-motion]`)), 'Stop GIFs freezes it on its first frame', JSON.stringify(st));
    await p.click(`${S} [data-bmv="0:1"]`); await p.waitForTimeout(1500); await p.click(`${S} [data-bmv="1:-1"]`); await p.waitForTimeout(1500);
    await p.waitForTimeout(800);
    ok(await p.$eval(`${S} [data-sxframe="0"]`, f => !!f.querySelector('canvas') && !f.querySelector('canvas').hidden), 'and it stays stopped when the page redraws');
    if(name === 'laptop'){
      await p.hover(`${S} [data-sxframe="0"] .sx-pic`, { position:{ x:20, y:20 } }); await p.waitForTimeout(300);
      ok(await p.$eval(`${S} [data-sxframe="0"] img[data-anim]`, i => !i.hidden), 'stopped, the one under the mouse still plays');
      await p.mouse.move(5, 5); await p.waitForTimeout(300);
    }
    await p.click(`${S} [data-motion]`); await p.waitForTimeout(400);
    ok(await p.$eval(`${S} [data-sxframe="0"] img[data-anim]`, i => !i.hidden), 'Play GIFs lets them move again');
    await p.click(`${S} [data-sxclear="0"]`); await p.waitForTimeout(1200);
    ok(!(await p.evaluate(async id => (await Store.get('clips', id)).page.slots[0].item, cid)) && !!(await p.$(`${S} [data-sxpick="0"].sx-fadd`)), '✕ takes the frame off');
    /* the Library: a beat gets shots straight from frames */
    await p.evaluate(u => { MediaLib.hasLibrary = () => true; MediaLib.phone = () => false; window.LibView = { ...(window.LibView || {}), pick: async o => o && o.multi ? [u, u] : u, view: () => {} }; }, gif);
    await p.click(`${S} [data-sxv="rows"]`); await p.waitForTimeout(400); await p.click(`${S} [data-sxv="cols"]`); await p.waitForTimeout(800);
    const before = (await rec()).st.length;
    await p.click(`${S} [data-sxframes="2"]`); await p.waitForTimeout(1800);
    r = await rec();
    const sl = await p.evaluate(async id => (await Store.get('clips', id)).page.slots.map(x => [x.text, x.item]), cid);
    ok(r.st.length === before + 2 && r.st.slice(-2).every(x => x.beat === 2) && sl.slice(-2).every(x => x[1] === gif && x[0] === 'Walk in'), '＋ Shots from frames makes a shot per GIF in that beat', JSON.stringify(sl.slice(-2)));
    await p.screenshot({ path: path.join(out, `clipcols-${name}.png`) });
    await p.click(`${S} [data-sxv="rows"]`); await p.waitForTimeout(500);
    ok(!(await p.$(`${S} .sx-cols`)) && (await p.$$(`${S} .sx-beat`)).length === 4, 'Rows puts them back down the page');
    await p.evaluate(() => localStorage.removeItem('cs4-frames-still'));
    await p.evaluate(() => Screens.pop()); await p.waitForTimeout(300);
    await p.evaluate(id => Screens.push('clip', { id, tab: 'plan' }), cid); await p.waitForTimeout(1300);
    ok(!(await p.$(`${S} .sx-cols`)), 'and the choice is remembered');
    await p.click(`${S} [data-sxv="cols"]`); await p.waitForTimeout(500);
    await ctx.close();
  }
  await b.close();
  ok(!errs.length, 'no page errors', errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
