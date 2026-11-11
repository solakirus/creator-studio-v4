/* Stages the web app exactly as the Pages workflow does, so `npm run site`
   checks what will actually be published.

   It used to check app/ directly, which meant one check — "the tests are not
   published" — could never pass, because the tests live in app/tests and the
   workflow strips them on the way out. A check that is always red is a check
   you stop reading, and the ones around it are worth reading.

   Node rather than shell: this has to run on Windows, where cp -r does not.

     node scripts/stage-site.js [outDir]        (default: _site/)  */
const fs = require('fs'), path = require('path');

const root = path.join(__dirname, '..');
const src  = path.join(root, 'app');
const out  = path.resolve(process.argv[2] || path.join(root, '_site'));

/* the same two the workflow removes after copying */
const DROP = new Set(['tests', 'build-preview.sh']);

fs.rmSync(out, { recursive: true, force: true });

let files = 0;
(function copy(from, to, rel){
  fs.mkdirSync(to, { recursive: true });
  for(const e of fs.readdirSync(from, { withFileTypes: true })){
    if(rel === '' && DROP.has(e.name)) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if(e.isDirectory()) copy(a, b, rel ? rel + '/' + e.name : e.name);
    else { fs.copyFileSync(a, b); files++; }
  }
})(src, out, '');

/* Pages runs Jekyll by default, which silently drops anything beginning with
   an underscore. Nothing here starts with one today; something will. */
fs.writeFileSync(path.join(out, '.nojekyll'), '');

console.log(`staged ${files} files -> ${path.relative(root, out)}/`);
