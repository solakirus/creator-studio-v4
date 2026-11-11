const fs=require('fs'), path=require('path'), os=require('os'), http=require('http'), Module=require('module'), cp=require('child_process');
const ROOT=path.join(__dirname,'..','..');   /* run from anywhere: node app/tests/webupdate-win.e2e.js */
const T=fs.mkdtempSync(path.join(os.tmpdir(),'winupd-')), user=path.join(T,'userData'), rem=path.join(T,'remote');
cp.execFileSync('node',[ROOT+'/scripts/copy-web.js'],{stdio:'ignore'});
fs.cpSync(ROOT+'/www',rem,{recursive:true});
fs.appendFileSync(rem+'/js/quickadd.js','\n/* newer */\n');
cp.execFileSync('node',[ROOT+'/scripts/web-manifest.js',rem],{stdio:'ignore'});
const remote=JSON.parse(fs.readFileSync(rem+'/update.json')), shipped=JSON.parse(fs.readFileSync(ROOT+'/www/update.json'));
const hits=[];
const srv=http.createServer((q,r)=>{const p=decodeURIComponent(q.url.split('?')[0]); hits.push(p); const f=path.join(rem,p); if(!fs.existsSync(f)){r.statusCode=404;return r.end();} r.end(fs.readFileSync(f));});
let pass=0,fail=0; const t=(n,c,x='')=>{console.log(`  ${c?'ok  ':'FAIL'}  ${n} ${x}`); c?pass++:fail++;};
srv.listen(18920, async ()=>{
  process.env.CS_UPDATE_REMOTE='http://127.0.0.1:18920/';
  const sent=[];
  const electron={ app:{ requestSingleInstanceLock:()=>true, quit(){}, setAsDefaultProtocolClient(){}, on(){},
      whenReady:()=>new Promise(()=>{}), getPath:()=>user, setAppUserModelId(){} },
    protocol:{ registerSchemesAsPrivileged(){}, handle(){} }, net:{ fetch:(u,o)=>fetch(u,o) },
    shell:{}, Menu:{ setApplicationMenu(){} }, ipcMain:{ handle(){}, on(){} }, dialog:{}, Notification:function(){}, session:{}, BrowserWindow:function(){} };
  const orig=Module._load; Module._load=function(req,...a){ return req==='electron'?electron:orig.call(this,req,...a); };
  const fresh=()=>{ delete require.cache[require.resolve(ROOT+'/electron/main.js')]; return require(ROOT+'/electron/main.js').WebUpdate; };
  let W=fresh();
  t('first launch serves the installed copy', W.choose()===path.join(ROOT,'www'));
  hits.length=0;
  let s=await W.check();
  t('a newer build online is downloaded', s.state==='ready' && s.build===remote.build, JSON.stringify(s));
  t('only the changed file came from GitHub', hits.filter(h=>h!=='/update.json').join()==='/js/quickadd.js', hits.join());
  t('it lands complete, with its list', fs.existsSync(path.join(user,'web',remote.build,'update.json')) && !fs.existsSync(path.join(user,'web',remote.build+'.part')));
  W=fresh(); const root=W.choose();
  t('next launch serves the download', root===path.join(user,'web',remote.build));
  t('and the file it serves is the new one', fs.readFileSync(path.join(root,'js/quickadd.js'),'utf8').includes('newer'));
  W.ok(); let st=JSON.parse(fs.readFileSync(path.join(user,'web','state.json')));
  t('a good start clears the watch', !st.pending && st.active===remote.build);
  W=fresh(); t('it keeps using it on later launches', W.choose()===path.join(user,'web',remote.build));
  s=await W.check(); t('and finds nothing newer', s.state==='current');
  // a bad build: never confirmed
  st=JSON.parse(fs.readFileSync(path.join(user,'web','state.json'))); st.pending={build:remote.build,tries:0,prev:null}; fs.writeFileSync(path.join(user,'web','state.json'),JSON.stringify(st));
  let r; for(let i=0;i<4;i++){ W=fresh(); r=W.choose(); }
  st=JSON.parse(fs.readFileSync(path.join(user,'web','state.json')));
  t('a version that never starts properly is dropped for the installed copy', r===path.join(ROOT,'www') && st.bad.includes(remote.build));
  // new installer resets
  st.bad=[]; st.active=remote.build; st.pending=null; st.shipped='older-installer'; fs.writeFileSync(path.join(user,'web','state.json'),JSON.stringify(st));
  W=fresh(); t('running a new installer starts from its own copy', W.choose()===path.join(ROOT,'www'));
  // tampered
  fs.appendFileSync(rem+'/js/quickadd.js','/*tampered*/'); fs.rmSync(path.join(user,'web',remote.build),{recursive:true,force:true});
  st=JSON.parse(fs.readFileSync(path.join(user,'web','state.json'))); st.ready=null; fs.writeFileSync(path.join(user,'web','state.json'),JSON.stringify(st));
  W=fresh(); W.choose(); s=await W.check();
  t('a file that fails its fingerprint is refused', s.state==='error' && /fingerprint/.test(s.reason), s.reason);
  t('and no half download is left', !fs.existsSync(path.join(user,'web',remote.build)) && !fs.existsSync(path.join(user,'web',remote.build+'.part')));
  console.log(`\n${pass} passed, ${fail} failed`); srv.close(); fs.rmSync(T,{recursive:true,force:true}); process.exit(fail?1:0);
});
