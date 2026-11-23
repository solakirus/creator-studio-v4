/* HTML → PDF with headless Chromium, and the paper's fonts kept on nastime.

     pdf(htmlFile, pdfFile, { chrome })     → the PDF's bytes
     png(htmlFile, pngFile, { chrome })     → a picture of the first page (checks)
     fonts(dir)                             → @font-face CSS pointing at files in dir, or '' (then Google's link is used)
     findChrome()                           → the browser's path, or null */
'use strict';
const { execFile } = require('child_process');
const fs = require('fs'), path = require('path');

function findChrome(want){
  const c = [want, process.env.CHROME, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].filter(Boolean);
  for (const p of c) { try { fs.accessSync(p, fs.constants.X_OK); return p; } catch (e) {} }
  return null;
}

function run(chrome, args, timeout){
  return new Promise((resolve, reject) => {
    execFile(chrome, args, { timeout: timeout || 90000, maxBuffer: 16 * 1024 * 1024 }, (err, out, errOut) => {
      if (err) return reject(new Error('Chromium: ' + (String(errOut || '').trim().split('\n').slice(-1)[0] || err.message)));
      resolve(out);
    });
  });
}
const base = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--allow-file-access-from-files', '--run-all-compositor-stages-before-draw', '--virtual-time-budget=15000'];

async function pdf(htmlFile, pdfFile, o){
  const chrome = findChrome(o && o.chrome);
  if (!chrome) throw new Error('Chromium isn’t installed yet (it installs itself the first time the paper starts)');
  try { fs.unlinkSync(pdfFile); } catch (e) {}
  await run(chrome, [...base, '--no-pdf-header-footer', '--print-to-pdf-no-header', `--print-to-pdf=${pdfFile}`, 'file://' + path.resolve(htmlFile)]);
  if (!fs.existsSync(pdfFile)) throw new Error('Chromium didn’t make the PDF');
  return fs.readFileSync(pdfFile);
}

async function png(htmlFile, pngFile, o){
  const chrome = findChrome(o && o.chrome);
  if (!chrome) throw new Error('Chromium isn’t installed');
  await run(chrome, [...base, '--window-size=816,1056', `--screenshot=${pngFile}`, 'file://' + path.resolve(htmlFile)]);
  return pngFile;
}

/* Google's CSS asks for the woff2 files a modern browser gets; they're saved
   once into dir and served to Chromium from disk, so a slow or down internet
   at 4:30 a.m. never prints the paper in a fallback font. */
async function fonts(dir, googleCss){
  const cssFile = path.join(dir, 'fonts.css');
  try { if (fs.statSync(cssFile).size > 100) return fs.readFileSync(cssFile, 'utf8'); } catch (e) {}
  try {
    fs.mkdirSync(dir, { recursive: true });
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
    const r = await fetch(googleCss, { headers: { 'User-Agent': ua } });
    if (!r.ok) return '';
    let css = await r.text();
    const urls = [...new Set((css.match(/url\((https:[^)]+)\)/g) || []).map(u => u.slice(4, -1)))];
    for (const [i, u] of urls.entries()) {
      const f = r.ok ? await fetch(u) : null;
      if (!f || !f.ok) return '';
      const name = `f${i}.woff2`;
      fs.writeFileSync(path.join(dir, name), Buffer.from(await f.arrayBuffer()));
      css = css.split(u).join('file://' + path.join(dir, name));
    }
    fs.writeFileSync(cssFile, css);
    return css;
  } catch (e) { return ''; }
}

module.exports = { pdf, png, fonts, findChrome };
