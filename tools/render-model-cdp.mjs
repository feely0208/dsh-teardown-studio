/** Local renderer using system Chrome via raw CDP. No puppeteer, no browser bundle. */
import fs from 'fs'; import path from 'path'; import http from 'http'; import { spawn, execFile } from 'child_process';
const ROOT=process.env.DWH_ROOT||process.cwd(), DATA=process.env.DWH_DATA||ROOT;
const arg=(k,d='')=>{const i=process.argv.indexOf(k);return i>=0?process.argv[i+1]:d;};
const MODEL=arg('--model'), OUT=path.resolve(arg('--out','out-model/model.mp4')), BG=arg('--bg',''), MUSIC=arg('--music',''); const BROWSER=arg('--browser','');
fs.mkdirSync(path.dirname(OUT),{recursive:true});
const frames=fs.mkdtempSync('/tmp/dwh-render-');
const MIME={'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.css':'text/css','.glb':'model/gltf-binary','.wav':'audio/wav','.mp3':'audio/mpeg'};
const server=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);let f=(u.startsWith('/cache/')||u.startsWith('/uploads/')||u.startsWith('/out-model/'))?path.join(DATA,u):path.join(ROOT,u==='/'?'/teardown-v1/index.html':u);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(d);});});
const port=8871; await new Promise(r=>server.listen(port,r));
const chromePath=BROWSER||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile=fs.mkdtempSync('/tmp/dwh-chrome-');
const chrome=spawn(chromePath,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--no-sandbox','--disable-dev-shm-usage','--use-angle=metal','--window-size=1920,1080','about:blank'],{stdio:'ignore'});
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
let devPort=0,wsPath='';
for(let i=0;i<150;i++){const f=path.join(profile,'DevToolsActivePort');if(fs.existsSync(f)){const l=fs.readFileSync(f,'utf8').trim().split('\n');devPort=+l[0];wsPath=l[1]||'';break;}await sleep(100);}
if(!devPort)throw new Error('chrome did not start');
const url=`http://127.0.0.1:${port}/teardown-v1/index.html?template=02&embed=1&model=${encodeURIComponent(MODEL)}${BG?`&bg=${encodeURIComponent(BG)}`:''}`;
const target=await (await fetch(`http://127.0.0.1:${devPort}/json/new?${encodeURIComponent(url)}`,{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);let id=0;const waiters=new Map();
ws.onmessage=(ev)=>{const m=JSON.parse(ev.data);if(m.id&&waiters.has(m.id)){const {res,rej}=waiters.get(m.id);waiters.delete(m.id);m.error?rej(new Error(m.error.message)):res(m.result);}};
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
function send(method,params={}){return new Promise((res,rej)=>{const i=++id;waiters.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}));});}
await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
async function evalJs(expr){const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result?.value;}
for(let i=0;i<200;i++){if(await evalJs('window.ready===true && window.__modelReady===true'))break;await sleep(150);}
await sleep(800);
const DUR=12,N=DUR*30;
for(let i=0;i<N;i++){
 const t=i/(N-1); const e=t<.62?(()=>{const x=Math.min(1,t/.62);return x*x*(3-2*x)})():1;
 await evalJs(`window.__setAuto(${e})`);
 const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:92,fromSurface:true});
 fs.writeFileSync(path.join(frames,`f${String(i).padStart(4,'0')}.jpg`),Buffer.from(shot.data,'base64'));
}
try{ws.close();}catch{} try{chrome.kill('SIGTERM');}catch{} server.close();
const musicFile=MUSIC?(MUSIC.startsWith('/')?path.join(DATA,MUSIC.replace(/^\//,'')):path.resolve(ROOT,MUSIC)):'';
const hasMusic=!!musicFile&&fs.existsSync(musicFile);
const args=['-y','-v','error','-framerate','30','-i',path.join(frames,'f%04d.jpg')];if(hasMusic)args.push('-i',musicFile);
args.push('-t',String(DUR),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p');if(hasMusic)args.push('-c:a','aac','-b:a','192k','-shortest');args.push(OUT);
await new Promise((resolve,reject)=>execFile('ffmpeg',args,(err,so,se)=>{if(err){console.error(se);process.exit(1);}fs.rmSync(frames,{recursive:true,force:true});console.log(OUT);resolve();}));
