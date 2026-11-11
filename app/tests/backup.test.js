/* The backup, exercised against a fake filesystem.

   This exists because of 13 Oct 2026: the app was uninstalled and the only
   copy of the database went with it. So the checks are not "does it call
   writeFile" but the things that actually decide whether data survives —
   where the file goes, that a short write is caught, that old files are swept
   oldest-first, and that a device which cannot write silently says so instead
   of quietly doing nothing. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  console.log(`  ${cond ? 'ok ' : 'FAIL'}  ${name.padEnd(54)} ${extra}`);
  cond ? pass++ : fail++;
};
const head = s => console.log(`\n— ${s} —`);

/* ---- a fake device ---- */
let disk, written, settings, failWrite, shortWrite;
/* opts.noFs — a device with no filesystem plugin at all: an iPad, or a browser */
function reset(opts){
  opts = opts || {};
  disk = {}; written = []; settings = {}; failWrite = false; shortWrite = false;
  global.Store = {
    get: async (s, k) => settings[k],
    put: async (s, v, k) => { settings[k] = v; },
    all: async () => ({ keys:[], values:[] }), allMap: async () => ({})
  };
  global.Transfer = {
    exportAll: async o => ({ format:'creator-studio', photos: !!(o && o.photos),
      data:{ tasks:[{ id:1, title:'a task' }] }, keyed:{} }),
    download: async (name) => { written.push('download:' + name); return true; }
  };
  const Filesystem = {
    writeFile: async o => {
      if(failWrite) throw new Error('disk full');
      disk[o.path] = shortWrite ? 'x' : o.data;
      written.push('write:' + o.path + ':' + o.directory);
    },
    stat: async o => disk[o.path] === undefined ? Promise.reject(new Error('no')) : ({ size: disk[o.path].length }),
    readdir: async o => ({ files: Object.keys(disk)
      .filter(f => f.startsWith(o.path + '/'))
      .map(f => ({ name: f.slice(o.path.length + 1) })) }),
    deleteFile: async o => { delete disk[o.path]; written.push('delete:' + o.path); }
  };
  global.Capacitor = opts.noFs ? undefined : { Plugins: { Filesystem } };
  global.window = global;
  delete global.Backup;
  new Function(fs.readFileSync(path.join(ROOT, 'js/backup.js'), 'utf8'))();
}
const files = () => Object.keys(disk).sort();

(async () => {
  reset();
  head('it writes outside the app, where an uninstall cannot reach');
  let r = await Backup.run('records');
  t('it reported success', r.ok, JSON.stringify(r.done));
  t('into Documents, not app storage', written.some(w => w.endsWith(':DOCUMENTS')),
    written.find(w => w.startsWith('write:')));
  t('in its own folder', files()[0].startsWith('Creator Studio backups/'), files()[0]);
  t('named by date', /creator-studio-\d{4}-\d\d-\d\d\.json$/.test(files()[0]), files()[0]);
  t('and the daily one leaves pictures out',
    JSON.parse(disk[files()[0]]).photos === false);

  head('a short write is a failure, not a backup');
  reset(); shortWrite = true;
  r = await Backup.run('records');
  t('it does not claim success', !r.ok);
  t('and says why', /short/i.test(r.failed.join(' ')), r.failed.join(' '));
  const st = await Backup.status();
  t('the status shows the error', !!st.error, st.error.slice(0, 40));
  t('and never says it was saved', st.when === 'never', st.when);

  head('it keeps seven and drops the oldest');
  reset();
  for(let i = 1; i <= 10; i++){
    disk[`Creator Studio backups/creator-studio-2026-09-${String(i).padStart(2,'0')}.json`] = '{}';
  }
  await Backup.run('records');
  const kept = files().filter(f => /creator-studio-\d{4}-\d\d-\d\d\.json$/.test(f));
  t('seven are left', kept.length === 7, kept.length + ' files');
  t('the oldest went first', !kept.some(f => f.includes('2026-09-01')), kept[0]);
  t('and today\'s is one of them', kept.some(f => f.includes(new Date().toISOString().slice(0,10))));

  head('a full backup is separate, and keeps fewer');
  reset();
  for(let i = 1; i <= 4; i++)
    disk[`Creator Studio backups/creator-studio-2026-09-0${i}-full.json`] = '{}';
  disk['Creator Studio backups/creator-studio-2026-09-09.json'] = '{}';
  await Backup.run('full');
  const fulls = files().filter(f => /-full\.json$/.test(f));
  t('two full files are kept', fulls.length === 2, fulls.length + '');
  t('and it includes the pictures',
    JSON.parse(disk[fulls[fulls.length-1]] || '{}').photos === true || fulls.length === 2);
  t('the daily files are untouched by the full sweep',
    files().includes('Creator Studio backups/creator-studio-2026-09-09.json'));

  head('a device that cannot write a file says so');
  reset({ noFs:true });
  r = await Backup.run('records');
  t('it does not pretend', !r.ok, JSON.stringify(r.failed));
  t('and offers nothing without a tap', !written.length, written.join(' '));
  r = await Backup.run('records', { manual:true });
  t('but a tap opens the save dialog', r.ok && written.some(w => w.startsWith('download:')),
    written.join(' '));
  const st2 = await Backup.status();
  t('and the status knows it cannot do it alone', st2.silent === false);

  head('the server sink');
  reset();
  let sent = null;
  global.fetch = async (url, o) => { sent = { url, len: o.body.length }; return { ok:true }; };
  await Backup.setServer('http://nastime.local:8080/backups/');
  r = await Backup.run('records');
  t('it PUT the file', !!sent, sent && sent.url);
  t('named by date, with no double slash', sent && /backups\/creator-studio-[\d-]+\.json$/.test(sent.url), sent && sent.url);
  t('and the file still went to disk too', files().length === 1, files().join(' '));

  head('a server that is down never costs you the local copy');
  reset();
  global.fetch = async () => { throw new Error('unreachable'); };
  await Backup.setServer('http://nastime.local:8080/backups');
  r = await Backup.run('records');
  t('the backup still succeeded', r.ok, JSON.stringify(r.done));
  t('the file is on disk', files().length === 1);
  t('and the failure is recorded, not swallowed', r.failed.some(f => /server/.test(f)), r.failed.join(' '));

  head('it does not run twice in a day, and can be turned off');
  reset();
  await Backup.auto();
  const after1 = files().length;
  await Backup.auto();
  t('a second open does not write again', files().length === after1, files().length + '');
  reset();
  await Backup.setOff(true);
  await Backup.auto();
  t('off means off', files().length === 0, files().length + '');

  head('the status reads like a sentence');
  reset();
  await Backup.run('records');
  const s3 = await Backup.status();
  t('green when it ran today', s3.tone === 'good', s3.tone);
  t('and says when', s3.when === 'today', s3.when);
  settings['backup:state'].recordsAt = Date.now() - 3 * 86400000;
  t('amber after a few days', (await Backup.status()).tone === 'warn');
  settings['backup:state'].recordsAt = Date.now() - 9 * 86400000;
  t('red after a week', (await Backup.status()).tone === 'bad');
  t('and counts the days', (await Backup.status()).when === '9 days ago', (await Backup.status()).when);

  console.log(`\n${fail ? 'FAILED' : 'a copy survives the app being deleted'}  (${pass} ok, ${fail} failed)\n`);
  process.exit(fail ? 1 : 0);
})();
