/* yt-dlp with a browser whose cookie file is locked ("Could not copy Chrome cookie database"): YouTube goes without the browser's sign-in, a social link retries without it.
     node app/tests/electron/grab-cookies.test.js */
const fs=require('fs'),os=require('os'),path=require('path');
const G=require(require('path').join(__dirname, '../../../electron/grab-builtin.js'));
async function sim(url, cookies, behave){
  const lines=[];const calls=[];
  const job={stopped:false,emit:l=>lines.push(l),run:async(cmd,args,cb)=>{
    if(cmd==='ytdlp'){ calls.push(args.includes('--cookies-from-browser')?'browser':'none');
      const r=behave(args); if(r.code===0){ const f=path.join(args[args.indexOf('-o')+1].replace('video.%(ext)s','video.mp4')); fs.writeFileSync(f,'x'); cb&&cb('@@T Test video'); cb&&cb('@@F '+f);} return r; }
    return {code:0,err:'Duration: 00:00:05.00',out:''}; }};
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'gs-'));
  const code=await G.grab(job,{ytdlp:'ytdlp',ffmpeg:'ffmpeg'},[url],out,{cookies,ytWhat:'stills'});
  return {code,calls,lines:lines.filter(l=>!/^▶/.test(l)).slice(0,6)};
}
const locked={code:1,err:'ERROR: Could not copy Chrome cookie database. See https://github.com/yt-dlp/yt-dlp/issues/7271'};
let pass=0,fail=0;const ok=(c,l,x)=>{console.log(`  ${c?'ok  ':'FAIL'}  ${l}${x!==undefined?'   '+x:''}`);c?pass++:fail++;};
(async()=>{
  let r=await sim('https://youtu.be/ijwBE0odti4?si=x','chrome',a=>a.includes('--cookies-from-browser')?locked:{code:0,err:''});
  ok(r.code===0&&r.calls.join()==='none','YouTube with Chrome picked and locked: downloads without Chrome\'s cookies',r.calls.join());
  r=await sim('https://youtu.be/ijwBE0odti4','chrome',a=>a.includes('--cookies-from-browser')?locked:{code:1,err:"ERROR: [youtube] x: Sign in to confirm you're not a bot"});
  ok(r.calls.join()==='none,browser'&&r.lines.some(l=>/close Chrome/.test(l)),'YouTube wanting a sign-in tries Chrome\'s, and says to close Chrome when it is locked',r.calls.join());
  r=await sim('https://www.instagram.com/reel/DAbc123/','chrome',a=>a.includes('--cookies-from-browser')?locked:{code:0,err:''});
  ok(r.code===0&&r.calls.join()==='browser,none','Instagram: Chrome\'s cookies first, then without them when locked',r.calls.join());
  console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})();
