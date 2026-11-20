/* The grabber's cut finder (electron/grab-builtin.js cutTimes / cutsFrom).

   Made-up videos with ffmpeg:
     hard   four very different scenes          → 4 shots
     soft   four shots of the same grey room, the box moved — cuts that score
            far below the threshold (what Instagram reels full of same-room
            B-roll look like)                   → 4 shots (was 1)
     moving one continuous moving shot          → 1
     zoom   one continuous zoom                 → 1
     dup    the soft one at 25 fps in a 30 fps file (repeated frames) → still 4
   and a video's own id from its link (one folder per reel).

     node app/tests/electron/grab-cuts.test.js   (needs ffmpeg on PATH) */
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const G = require('../../../electron/grab-builtin.js');
let pass = 0, fail = 0;
const ok = (c, l, x) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${l}${x !== undefined ? '   ' + x : ''}`); c ? pass++ : fail++; };
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'cuts-'));
const ff = args => cp.execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]);
const job = { emit: () => {}, run: (cmd, args) => new Promise(r => { const p = cp.spawn(cmd, args); let out = '', err = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d); p.on('close', code => r({ code, out, err })); }) };
const shots = async (f, sens) => (await G.cutTimes(job, 'ffmpeg', path.join(T, f), { ytSens: sens || 'normal' })).map(x => +x.start.toFixed(1));

(async () => {
  try {
    const segs = [];
    for (let i = 0; i < 4; i++){
      const c = (40 + i * 6).toString(16).padStart(2, '0'), b = (70 + i * 6).toString(16).padStart(2, '0');
      ff(['-f', 'lavfi', '-i', `color=c=0x${c}${c}${c}:s=640x360:d=2:r=30`, '-vf', `drawbox=x=${i * 60}:y=100:w=120:h=120:color=0x${b}${b}60:t=fill,noise=alls=8:allf=t,format=yuv420p`, path.join(T, `s${i}.mp4`)]);
      segs.push(`file '${path.join(T, `s${i}.mp4`)}'`);
    }
    fs.writeFileSync(path.join(T, 'l.txt'), segs.join('\n'));
    ff(['-f', 'concat', '-safe', '0', '-i', path.join(T, 'l.txt'), '-c', 'copy', path.join(T, 'soft.mp4')]);
    ff(['-i', path.join(T, 'soft.mp4'), '-vf', 'fps=25', '-r', '30', '-pix_fmt', 'yuv420p', path.join(T, 'dup.mp4')]);
    ff(['-f', 'lavfi', '-i', 'smptebars=s=640x360:d=2', '-f', 'lavfi', '-i', 'testsrc=s=640x360:d=2', '-f', 'lavfi', '-i', 'rgbtestsrc=s=640x360:d=2',
      '-f', 'lavfi', '-i', 'mandelbrot=s=640x360,trim=duration=2', '-filter_complex', '[0][1][2][3]concat=n=4:v=1,format=yuv420p', '-r', '30', path.join(T, 'hard.mp4')]);
    ff(['-f', 'lavfi', '-i', 'testsrc2=s=640x360:d=8:r=30', '-pix_fmt', 'yuv420p', path.join(T, 'moving.mp4')]);
    ff(['-f', 'lavfi', '-i', 'mandelbrot=s=640x360,trim=duration=8', '-r', '30', '-pix_fmt', 'yuv420p', path.join(T, 'zoom.mp4')]);

    let s = await shots('hard.mp4'); ok(s.join() === '0,2,4,6', 'four very different scenes: 4 shots', s.join(' '));
    s = await shots('soft.mp4'); ok(s.join() === '0,2,4,6', 'four shots of the same room (cuts far below the threshold): 4 shots', s.join(' '));
    s = await shots('dup.mp4'); ok(s.length === 4, 'the same with repeated frames (25 fps in 30): still 4', s.join(' '));
    s = await shots('soft.mp4', 'low'); ok(s.length < 4, '“Fewer cuts” keeps only the clearer ones', s.join(' '));
    s = await shots('moving.mp4'); ok(s.length === 1, 'one continuous moving shot: 1', s.join(' '));
    s = await shots('zoom.mp4'); ok(s.length === 1, 'one continuous zoom: 1', s.join(' '));
    ok(['https://www.instagram.com/reel/DceYXBcxMav/', 'https://www.instagram.com/p/AbC/', 'https://www.tiktok.com/@a/video/123', 'https://www.youtube.com/watch?v=xyz', 'https://youtu.be/abc']
      .map(G.videoId).join() === 'DceYXBcxMav,AbC,123,xyz,abc', 'each reel’s own id from its link (its own folder)');
  } catch(e){ ok(false, 'ran to the end', e.message); }
  fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
