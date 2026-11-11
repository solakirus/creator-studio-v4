/* update.json — what the phone and Windows apps read to update themselves.

   Every file the web app is made of, with its SHA-256 and size, plus a build
   id. Written next to the files whenever they are staged: into _site/ by the
   Pages workflow (that copy is what devices download from) and into www/ by
   copy-web.js (that copy ships inside the APK and the Windows app, so a device
   knows exactly what it already has and downloads only what changed).

   `native` is the level of the native shells (android/, electron/) this web
   code needs. Bump NATIVE_LEVEL when web code starts relying on something a
   new APK or Windows build has to provide; devices on an older shell then stay
   on what they have until that app is rebuilt, rather than loading code that
   calls a plugin they don't have.

     node scripts/web-manifest.js <dir>          */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const NATIVE_LEVEL = 1;
const SKIP = new Set(['update.json', 'tests', 'build-preview.sh']);

function write(dir){
  const files = [];
  (function walk(abs, rel){
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (rel === '' && SKIP.has(e.name)) continue;
      if (e.name.startsWith('.')) continue;
      const a = path.join(abs, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(a, r);
      else {
        const buf = fs.readFileSync(a);
        files.push([r, crypto.createHash('sha256').update(buf).digest('hex'), buf.length]);
      }
    }
  })(dir, '');
  files.sort((a, b) => a[0] < b[0] ? -1 : 1);
  const build = crypto.createHash('sha256')
    .update(files.map(f => f[0] + ':' + f[1]).join('\n')).digest('hex').slice(0, 12);
  const out = { format: 'cs3-web', build, native: NATIVE_LEVEL, made: new Date().toISOString(), files };
  fs.writeFileSync(path.join(dir, 'update.json'), JSON.stringify(out));
  return out;
}

module.exports = { write, NATIVE_LEVEL };

if (require.main === module) {
  const dir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www'));
  const m = write(dir);
  console.log(`[update] build ${m.build}, ${m.files.length} files -> ${path.relative(process.cwd(), dir) || '.'}/update.json`);
}
