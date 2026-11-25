'use strict';
/* fork (wakare): a lookup card the user dragged opens again at the dragged place (kept on screen), also after the reader reloads. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {startEdge}=require('./library-views-perf.cjs');
const ROOT=path.join(__dirname,'..'),WEB=path.join(ROOT,'web'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hasEdge=[process.env.MEGULIT_EDGE,'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].some(p=>p&&fs.existsSync(p));
const STUB=`<script>window.__TAURI_INTERNALS__={transformCallback:()=>1,invoke:async(cmd,args)=>{const r=args&&args.request||{};
 if(cmd==='service'){if(r.action==='home')return {preferences:{language:'zh',themeMode:'dark'},games:[]};if(r.action==='ui_state')return {};
  if(r.action==='reader_bootstrap')return {engines:[],native:{}};if(r.action==='reader_message')return {replies:[]};return {};}return null;}};</script>`;
const TYPES={'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'};
function serve(){const server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://x').pathname),file=path.join(WEB,rel);
 if(!file.startsWith(WEB)||!fs.existsSync(file)||!fs.statSync(file).isFile()){if(/^\/reader\/modules\/[a-z0-9-]+\.js$/.test(rel)){res.writeHead(200,{'content-type':'text/javascript'});return res.end('');}res.writeHead(404);return res.end();}
 let data=fs.readFileSync(file);if(rel==='/reader/index.html')data=Buffer.from(String(data).replace('<head>','<head>'+STUB));
 res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream'});res.end(data);});
 return new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server)));}
const WORD={entries:[{spellings:['猫'],readings:['ねこ'],pos:['名詞'],definitions:['猫；猫科动物']}]};
const SETUP=`(()=>{window.__tomoyoMode.set('translation');document.body.classList.add('tomoyo-gal-bound');
 const s=document.createElement('div');s.id='line';s.className='sentence-text';s.innerHTML='「そんなこと、<span id=w>注意すれば</span>わかるはずでしょ？」';
 s.style.cssText='position:fixed;left:360px;top:640px;width:900px;font:36px/1.5 Meiryo;color:#fff';document.body.append(s);
 window.__tomoyoChinese.gameArea=()=>({left:200,top:100,width:1280,height:720});return 1})()`;
const OPEN=`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const b=window.__tomoyoChinese;b.closeLocalSelection?.();await w(300);
 b.localLookup=async()=>(${JSON.stringify(WORD)});b.openLocalSelection({text:'x',start:0,end:1,selection:'x'},document.getElementById('w'));await w(900);
 const r=document.querySelector('.tomoyo-selection-card').getBoundingClientRect();return {left:Math.round(r.left),top:Math.round(r.top),right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight};})()`;
const DRAG=(dx,dy)=>`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const c=document.querySelector('.tomoyo-selection-card'),head=c.querySelector('[data-lookup-grip]');
 const hr=head.getBoundingClientRect();let x=hr.left+6,y=hr.top+hr.height/2;
 /* a spot on the grip that is not one of its buttons */
 for(let i=0;i<40;i++){const t=document.elementFromPoint(x,y);if(t&&t.closest('[data-lookup-grip]')===head&&!t.closest('button,a,input,select,textarea,summary,[role=button]'))break;x+=8;}
 window.__megulitLookupDrag('start',x,y);for(let i=1;i<=5;i++){window.__megulitLookupDrag('move',x+${dx}*i/5,y+${dy}*i/5);await w(20);}window.__megulitLookupDrag('end',x+${dx},y+${dy});await w(100);
 const r=c.getBoundingClientRect();return {left:Math.round(r.left),top:Math.round(r.top)};})()`;
test('lookup card: reopens where it was dragged, also after a reload, and stays on screen',{skip:!hasEdge&&'Edge not installed',timeout:120000},async()=>{
 const temp=fs.mkdtempSync(path.join(process.env.MEGULIT_WORK||os.tmpdir(),'megulit-lookup-remember-'));let server,cdp;
 try{server=await serve();cdp=await startEdge(path.join(temp,'edge'));
  const load=async()=>{await cdp.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/reader/index.html`});
   let ready=false;for(let i=0;i<120&&!ready;i++){await sleep(250);ready=await cdp.evaluate('!!window.__TOME_READER_READY__').catch(()=>false);}
   assert.ok(ready,'reader page loaded');await cdp.evaluate(SETUP);};
  await load();
  const first=await cdp.evaluate(OPEN);
  const dragged=await cdp.evaluate(DRAG(-250,-200));
  assert.ok(Math.abs(dragged.left-(first.left-250))<=2&&Math.abs(dragged.top-(first.top-200))<=2,'drag moved the card '+JSON.stringify({first,dragged}));
  const again=await cdp.evaluate(OPEN);
  assert.deepEqual({left:again.left,top:again.top},dragged,'reopened at the dragged place');
  await load();
  const reloaded=await cdp.evaluate(OPEN);
  assert.deepEqual({left:reloaded.left,top:reloaded.top},dragged,'remembered after a reload');
  /* the screen numbers name another monitor of a wide overlay (avail starts at 600): the card still opens at its place */
  await cdp.evaluate(`(()=>{for(const [k,v] of Object.entries({availLeft:600,availTop:0,availWidth:600,availHeight:420}))Object.defineProperty(screen,k,{get:()=>v,configurable:true});return 1})()`);
  const otherMonitor=await cdp.evaluate(OPEN);
  assert.deepEqual({left:otherMonitor.left,top:otherMonitor.top},dragged,'not snapped to the other monitor');
  /* a remembered place off the current window is pulled back on screen */
  await cdp.evaluate(`localStorage.setItem('megulit.fork.lookupPlace',JSON.stringify({left:99999,top:99999}))`);
  const clamped=await cdp.evaluate(OPEN);
  assert.ok(clamped.right<=clamped.w&&clamped.bottom<=clamped.h&&clamped.left>=0&&clamped.top>=0,'kept on screen '+JSON.stringify(clamped));
 }finally{await cdp?.stop();server?.close();await sleep(400);try{fs.rmSync(temp,{recursive:true,force:true});}catch{}}
});
