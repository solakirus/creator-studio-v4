/* Checks a staged site before it is published.

   A broken Pages deploy is worse than a failed one: the iPad installs it, the
   service worker caches it, and the fault is then sitting on the device. These
   are the things that would actually break it, each cheap to verify.

     node scripts/check-site.js _site  */
const fs = require('fs'), path = require('path');

const site = path.resolve(process.argv[2] || '_site');
let fails = 0;
const ok = (cond, label, extra) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${extra ? '   ' + extra : ''}`);
  if (!cond) fails++;
};
const has = f => fs.existsSync(path.join(site, f));

const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');

console.log('\nthe page can load');
const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const missingJs = srcs.filter(s => !has(s));
ok(!missingJs.length, `${srcs.length} scripts all present`, missingJs.join(' '));
const hrefs = [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map(m => m[1]);
const missingCss = hrefs.filter(h => !/^https?:/.test(h) && !has(h));
ok(!missingCss.length, `${hrefs.length} stylesheets and links all present`, missingCss.join(' '));

console.log('\nit can be installed');
ok(has('manifest.webmanifest'), 'the manifest is there');
const man = JSON.parse(fs.readFileSync(path.join(site, 'manifest.webmanifest'), 'utf8'));
const missingIcons = man.icons.map(i => i.src).filter(s => !has(s));
ok(!missingIcons.length, 'every manifest icon exists', missingIcons.join(' '));
ok(has('icons/apple-touch-icon.png'), 'the iOS home-screen icon exists');
ok(/apple-mobile-web-app-capable/.test(html), 'iOS is told it can run fullscreen');
/* Relative, or the app breaks the moment it is served from a project subpath
   rather than the root of a domain. */
ok(man.start_url.startsWith('./') && man.scope.startsWith('./'),
  'the manifest paths are relative, so a subpath works', `${man.scope} ${man.start_url}`);
ok(!/(src|href)="\//.test(html), 'and nothing in the page is rooted at /');

console.log('\nit works offline');
ok(has('sw.js'), 'the service worker is there');
const sw = fs.readFileSync(path.join(site, 'sw.js'), 'utf8');
ok(!sw.includes('__BUILD__') && !sw.includes('__FILES__'), 'and it was stamped, not shipped raw');
const listed = new Set((sw.match(/"\.\/[^"]+"/g) || []).map(s => s.slice(3, -1)));
const notCached = srcs.filter(s => !listed.has(s.replace(/^\.\//, '')));
ok(!notCached.length, 'every script the page loads is precached', notCached.slice(0, 4).join(' '));
ok(listed.has('index.html'), 'and so is the page itself');

console.log('\nnothing private went along');
ok(!fs.existsSync(path.join(site, 'tests')), 'the tests are not published');
for (const f of ['../android', '../electron', '../docs']) {
  ok(!fs.existsSync(path.join(site, path.basename(f))), `no ${path.basename(f)}/ in the site`);
}

console.log(fails ? `\n${fails} check(s) failed — not publishing\n` : '\nthe site is sound\n');
process.exit(fails ? 1 : 0);
