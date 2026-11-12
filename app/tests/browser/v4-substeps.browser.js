/* Today's steps drop-down: the box ticks a step (crossed out); the words edit in place and rename the shot on the page. node app/tests/browser/v4-substeps.browser.js */
const path=require('path');const pw=require('/opt/npm-tools/node_modules/playwright');
let pass=0,fail=0;const ok=(c,l,x)=>{console.log(`  ${c?'ok  ':'FAIL'}  ${l}${x!==undefined?'   '+x:''}`);c?pass++:fail++;};
(async()=>{const b=await pw.chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',args:['--allow-file-access-from-files']});
const errs=[];
for(const phone of [true,false]){
 const ctx=await b.newContext(phone?{viewport:{width:412,height:915},isMobile:true,hasTouch:true,deviceScaleFactor:2}:{viewport:{width:1280,height:860}});
 const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file:///' + require('path').resolve(__dirname, '../../index.html').replace(/\\/g, '/'));await p.waitForFunction(()=>window.App&&window.QuickAdd,null,{timeout:15000});await p.waitForTimeout(800);
 const id=await p.evaluate(async()=>{const t=await QuickAdd.add({day:await Data.currentDay(),title:'Walk',kind:'shoot'});App.go('today');return t.id;});
 await p.waitForTimeout(900);
 await p.click(`.mediacard[data-id="${id}"] .steps`);await p.waitForTimeout(500);
 const n=await p.evaluate(()=>document.querySelectorAll('.subs .sub').length);
 ok(n===9,(phone?'phone':'laptop')+': the drop-down lists the steps',n);
 const inp=p.locator('.subs [data-subname="1"]');
 await inp.tap?.call(inp).catch(()=>{}); await inp.click(); await p.waitForTimeout(200);
 let t=await p.evaluate(async id=>(await Store.get('tasks',id)).subs[1].done,id);
 ok(t===false,'tapping the words does not tick it');
 await inp.fill('Wide: the walk out the door');await inp.press('Enter');await p.waitForTimeout(600);
 t=await p.evaluate(async id=>{const x=await Store.get('tasks',id);return [x.subs[1].t,x.page.slots[x.subs[1].shot].text];},id);
 ok(t[0]==='Wide: the walk out the door'&&t[1]===t[0],'editing renames the step and its shot on the page',JSON.stringify(t));
 await p.click('.subs [data-subtick="1"]');await p.waitForTimeout(600);
 t=await p.evaluate(async id=>{const x=await Store.get('tasks',id);return {d:x.subs[1].done,cls:document.querySelector('.subs [data-sub="1"]').classList.contains('done'),name:document.querySelector('.subs [data-subname="1"]').value,deco:getComputedStyle(document.querySelector('.subs [data-subname="1"]')).textDecorationLine};},id);
 ok(t.d&&t.cls&&t.deco==='line-through','the box ticks it and crosses it out',JSON.stringify(t));
 await p.evaluate(async id=>{Screens.push('task',{id});},id);await p.waitForTimeout(1500);
 const nm=await p.evaluate(()=>(document.querySelector('.tk-hidden')||{}).textContent||'');
 ok(/1 done/.test(nm),'the task page counts it as done',nm);
 await p.evaluate(()=>Screens.pop());await p.waitForTimeout(500);
 if(phone) 
 await ctx.close();
}
ok(!errs.length,'no errors',errs.join('|'));console.log(`${pass} ok, ${fail} failed`);await b.close();process.exit(fail?1:0);})();
