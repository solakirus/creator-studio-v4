# Android self-update (app/js/updater.js) against a fake GitHub, with Capacitor faked. python3 app/tests/browser/updater.browser.py
# Android updater, in a real browser with Capacitor's WebView and Filesystem simulated.
import subprocess, sys, time, os, shutil, json, http.server, threading, functools
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','..'))
W=f'{ROOT}/www'
T=os.path.join(__import__('tempfile').gettempdir(),'cs3-updt')
shutil.rmtree(T, ignore_errors=True); os.makedirs(T)
subprocess.run(['node',f'{ROOT}/scripts/copy-web.js'],check=True,capture_output=True)
cur=f'{T}/current'; rem=f'{T}/remote'
shutil.copytree(W,cur); shutil.copytree(W,rem)
# a page that loads only the updater, served from the "phone"
open(f'{cur}/upd.html','w').write('<!doctype html><script src="js/updater.js"></script>')
# the "GitHub" copy is one change newer
with open(f'{rem}/js/quickadd.js','a') as f: f.write('\n/* a newer version */\n')
subprocess.run(['node',f'{ROOT}/scripts/web-manifest.js',rem],check=True,capture_output=True)
remote=json.load(open(f'{rem}/update.json')); current=json.load(open(f'{cur}/update.json'))
hits=[]
class CORS(http.server.SimpleHTTPRequestHandler):
    def end_headers(self): self.send_header('Access-Control-Allow-Origin','*'); super().end_headers()
    def log_message(self,*a): hits.append(self.path)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
def serve(d,port,h):
    s=http.server.ThreadingHTTPServer(('127.0.0.1',port),functools.partial(h,directory=d)); threading.Thread(target=s.serve_forever,daemon=True).start(); return s
s1=serve(cur,18910,Quiet); s2=serve(rem,18911,CORS)
FAKE="""
window.CS_UPDATE_REMOTE='http://127.0.0.1:18911/';
const disk = JSON.parse(sessionStorage.getItem('disk')||'{}');
const keep = () => sessionStorage.setItem('disk', JSON.stringify(disk));
window.__calls = JSON.parse(sessionStorage.getItem('calls')||'[]');
const call = c => { __calls.push(c); sessionStorage.setItem('calls', JSON.stringify(__calls)); };
window.Capacitor = { isNativePlatform:()=>true, getPlatform:()=>'android', Plugins:{
  WebView:{ setServerBasePath:async o=>call(['base',o.path]), setServerAssetPath:async o=>call(['asset',o.path]),
            persistServerBasePath:async()=>call(['persist']) },
  Filesystem:{
    writeFile:async o=>{ disk[o.path]=o.data.length; keep(); },
    rmdir:async o=>{ Object.keys(disk).filter(k=>k.startsWith(o.path+'/')).forEach(k=>delete disk[k]); keep(); },
    readdir:async o=>({ files:[...new Set(Object.keys(disk).filter(k=>k.startsWith(o.path+'/')).map(k=>k.split('/')[1]))] }),
    getUri:async o=>({ uri:'file:///data/user/0/cs3/files/'+o.path }) } } };
window.__disk = disk;
"""
fails=0
def ok(c,l,x=''):
    global fails; print(('  ok  ' if c else '  FAIL')+'  '+l+('   '+str(x)[:150] if x!='' else '')); fails+=0 if c else 1
try:
  with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.environ.get('CHROME','/opt/pw-browsers/chromium'),args=['--no-sandbox'])
    ctx=b.new_context(); ctx.add_init_script(FAKE); p=ctx.new_page()
    errs=[]; p.on('pageerror',lambda e: errs.append(str(e)))
    p.goto('http://127.0.0.1:18910/upd.html'); p.wait_for_timeout(500)
    st=p.evaluate("JSON.parse(localStorage.getItem('cs3-updater'))")
    ok(st.get('shipped')==current['build'] and st.get('nativeLevel')==1, 'it knows it is running the copy inside the APK', st)
    hits.clear()
    r=p.evaluate("Updater.check({quiet:true})")
    ok(r.get('ready') and r.get('build')==remote['build'], 'a newer build online is downloaded', r)
    fetched=[h for h in hits if not h.startswith('/update.json')]
    ok(len(fetched)==1 and 'quickadd.js' in fetched[0], 'only the changed file came from GitHub', fetched)
    disk=p.evaluate("Object.keys(__disk)")
    ok(len(disk)==len(remote['files'])+1 and f"web/{remote['build']}/update.json" in disk, 'every file written, list last', len(disk))
    ok(p.evaluate("Updater.check({quiet:true})").get('ready'), 'checking again does not download twice')
    # next launch: switch to it
    p.reload(); p.wait_for_timeout(500)
    calls=p.evaluate("__calls")
    ok(['base',f"/data/user/0/cs3/files/web/{remote['build']}"] in calls and ['persist'] in calls, 'next launch switches to it, and keeps it', calls)
    st=p.evaluate("JSON.parse(localStorage.getItem('cs3-updater'))")
    ok(st['pending']['build']==remote['build'] and st['pending']['prev'] is None, 'and remembers the APK copy to fall back to', st['pending'])

    # it starts badly three times: pretend the new build is now running (serve remote as current)
    s1.shutdown(); s1.server_close(); s1=serve(rem,18910,Quiet); open(f'{rem}/upd.html','w').write('<!doctype html><script src="js/updater.js"></script>')
    for i in range(3):
        p.evaluate("sessionStorage.setItem('calls','[]')"); p.reload(); p.wait_for_timeout(400)
    calls=p.evaluate("__calls"); st=p.evaluate("JSON.parse(localStorage.getItem('cs3-updater'))")
    ok(['asset','public'] in calls, 'after three failed starts it goes back to the APK copy', calls)
    ok(remote['build'] in st['bad'] and not st['pending'], 'and never tries that build again', st.get('bad'))

    # a good start clears the watch
    ctx2=b.new_context(); ctx2.add_init_script(FAKE); p2=ctx2.new_page(); p2.goto('http://127.0.0.1:18910/upd.html'); p2.wait_for_timeout(300)
    p2.evaluate("localStorage.setItem('cs3-updater', JSON.stringify({bundles:{'"+remote['build']+"':'/x'}, pending:{build:'"+remote['build']+"',tries:1,prev:null}}))")
    p2.evaluate("Updater.ok()"); p2.wait_for_timeout(200)
    ok(p2.evaluate("JSON.parse(localStorage.getItem('cs3-updater')).pending")==None, 'reaching the first screen marks it good')
    ctx2.close()

    # a tampered file is refused
    s1.shutdown(); s1.server_close(); s1=serve(cur,18910,Quiet)
    with open(f'{rem}/js/quickadd.js','a') as f: f.write('/* tampered after the list was made */')
    ctx3=b.new_context(); ctx3.add_init_script(FAKE); p3=ctx3.new_page(); p3.goto('http://127.0.0.1:18910/upd.html'); p3.wait_for_timeout(300)
    r=p3.evaluate("Updater.check({quiet:true})")
    ok(not r.get('ok') and 'fingerprint' in (r.get('reason') or ''), 'a file that does not match its fingerprint is refused', r)
    ok(p3.evaluate("JSON.parse(localStorage.getItem('cs3-updater')).ready")==None and len(p3.evaluate("Object.keys(__disk)"))==0, 'and nothing half-downloaded is kept')
    # needs a newer APK
    m=json.load(open(f'{rem}/update.json')); m['native']=2; json.dump(m,open(f'{rem}/update.json','w'))
    r=p3.evaluate("Updater.check({quiet:true})")
    ok(r.get('needsApk'), 'an update that needs a newer APK is not loaded', r.get('reason'))
    ok(not errs, 'no page errors', errs[:2])
    b.close()
finally:
    s1.shutdown(); s2.shutdown()
print('FAILS',fails)
