/* yt-dlp with a browser whose cookie file is locked ("Could not copy Chrome cookie database"): YouTube goes without the browser's sign-in, a social link retries without it.
     node app/tests/electron/grab-cookies.test.js */
const fs=require('fs'),os=require('os'),path=require('path');
const G=require(require('path').join(__dirname, '../../../electron/grab-builtin.js'));
async function sim(url, cookies, behave){
  G._resetFreshen();
  const lines=[];const calls=[];
  const job={stopped:false,emit:l=>lines.push(l),run:async(cmd,args,cb)=>{
    if(cmd==='ytdlp' && args[0]==='-U'){ calls.push('update'); return behave(args); }
    if(cmd==='ytdlp'){ calls.push(args.includes('--cookies-from-browser')?'browser:'+args[args.indexOf('--cookies-from-browser')+1]:'none');
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
  ok(r.calls.join()==='none,update,browser:chrome'&&r.lines.some(l=>/Chrome's sign-in can't be read/.test(l))&&r.lines.some(l=>/Firefox/.test(l)),'YouTube wanting a sign-in: updates yt-dlp, tries Chrome\'s, then points to Firefox',r.calls.join());
  r=await sim('https://www.instagram.com/reel/DAbc123/','chrome',a=>a.includes('--cookies-from-browser')?locked:{code:0,err:''});
  ok(r.code===0&&r.calls.join()==='browser:chrome,none','Instagram: Chrome\'s cookies first, then without them when locked',r.calls.join());
  /* YouTube's "not a bot": a fresh yt-dlp, then advice */
  let updated=false;
  r=await sim('https://youtu.be/ijwBE0odti4','chrome',a=>a[0]==='-U'?(updated=true,{code:0,err:'Updated yt-dlp to stable@2026.11.10'}):a.includes('--cookies-from-browser')?locked:updated?{code:0,err:''}:{code:1,err:"ERROR: [youtube] x: Sign in to confirm you're not a bot"});
  ok(r.code===0&&r.calls.join()==='none,update,none'&&r.lines.some(l=>/updated — trying again/.test(l)),'YouTube asking “not a bot”: yt-dlp is updated and it goes again without a sign-in',r.calls.join());
  r=await sim('https://youtu.be/ijwBE0odti4','chrome',a=>a[0]==='-U'?{code:0,err:'yt-dlp is up to date (stable@2026.11.10)'}:a.includes('--cookies-from-browser')?locked:{code:1,err:"ERROR: [youtube] x: Sign in to confirm you're not a bot"});
  ok(r.code===1&&r.lines.some(l=>/Firefox, sign in to YouTube/.test(l)),'already the newest and still asking: says to sign in to YouTube in Firefox',r.calls.join());
  /* a reference's section: just start→end, then a 3-second GIF */
  {
    G._resetFreshen();
    const seen=[];
    const job={stopped:false,emit:()=>{},run:async(cmd,args,cb)=>{ seen.push([cmd,args]);
      if(cmd==='ytdlp'){ const f=args[args.indexOf('-o')+1].replace('video.%(ext)s','video.mp4'); fs.writeFileSync(f,'x'); cb&&cb('@@F '+f); return {code:0,err:''}; }
      if(cmd==='ffmpeg'){ fs.writeFileSync(args[args.length-1],'g'); return {code:0,err:''}; }
      return {code:0,err:''}; }};
    const r=await G.grabSection(job,{ytdlp:'ytdlp',ffmpeg:'ffmpeg'},'https://youtu.be/ijwBE0odti4',10,83,{cookies:'none'});
    const y=seen.find(x=>x[0]==='ytdlp')[1], f=seen.find(x=>x[0]==='ffmpeg')[1];
    ok(r.ok&&y[y.indexOf('--download-sections')+1]==='*10-83'&&y.includes('--force-keyframes-at-cuts')&&f[f.indexOf('-t')+1]==='3'&&r.gif&&r.clip,'a reference grab asks yt-dlp for just 10–83 s and makes a 3-second GIF');
    fs.rmSync(r.tmp,{recursive:true,force:true});
  }
  console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})();
