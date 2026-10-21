/** 42s drone finished-pipeline renderer using system Chrome + ffmpeg, no bundled binaries. */
import fs from 'fs'; import path from 'path'; import http from 'http'; import { spawn, execFile } from 'child_process';
const ROOT=process.env.DWH_ROOT||process.cwd(), DATA=process.env.DWH_DATA||ROOT;
const arg=(k,d='')=>{const i=process.argv.indexOf(k);return i>=0?process.argv[i+1]:d;};
const OUT=path.resolve(arg('--out','out-v1/drone-42s.mp4')), TEMPLATE=arg('--template','02'), BROWSER=arg('--browser',''), FPS=30, DUR=42, N=FPS*DUR;
fs.mkdirSync(path.dirname(OUT),{recursive:true});
const frames=fs.mkdtempSync('/tmp/dwh-drone42-');
const MIME={'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.css':'text/css','.wav':'audio/wav'};
const server=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(ROOT,u==='/'?'/teardown-v1/index.html':u);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(d);});});
const port=8870; await new Promise(r=>server.listen(port,r));
const chromePath=BROWSER||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile=fs.mkdtempSync('/tmp/dwh-chrome-');
const chrome=spawn(chromePath,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--no-sandbox','--disable-dev-shm-usage','--use-angle=metal','--window-size=1920,1080','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); let devPort=0;
for(let i=0;i<150;i++){const f=path.join(profile,'DevToolsActivePort');if(fs.existsSync(f)){devPort=+fs.readFileSync(f,'utf8').trim().split('\n')[0];break;}await sleep(100);}
if(!devPort)throw new Error('chrome did not start');
const url=`http://127.0.0.1:${port}/teardown-v1/index.html?template=${encodeURIComponent(TEMPLATE)}`;
const target=await (await fetch(`http://127.0.0.1:${devPort}/json/new?${encodeURIComponent(url)}`,{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);let id=0;const waiters=new Map();
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&waiters.has(m.id)){const x=waiters.get(m.id);waiters.delete(m.id);m.error?x.rej(new Error(m.error.message)):x.res(m.result);}};
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;waiters.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}));});
await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
const evalJs=async expr=>(await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true})).result?.value;
for(let i=0;i<200;i++){if(await evalJs('window.ready===true'))break;await sleep(150);}
await sleep(800);
for(let i=0;i<N;i++){await evalJs(`window.renderAt(${i/FPS})`);const s=await send('Page.captureScreenshot',{format:'jpeg',quality:92,fromSurface:true});fs.writeFileSync(path.join(frames,`f${String(i).padStart(5,'0')}.jpg`),Buffer.from(s.data,'base64'));if(i%150===0)console.log('frame',i);}
try{ws.close();}catch{}try{chrome.kill('SIGTERM');}catch{}server.close();
const audio=path.join(ROOT,'teardown','score42_norm.wav');
const args=['-y','-v','error','-framerate',String(FPS),'-i',path.join(frames,'f%05d.jpg')];if(fs.existsSync(audio))args.push('-i',audio);
args.push('-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-profile:v','high','-level','4.2');if(fs.existsSync(audio))args.push('-c:a','aac','-b:a','192k','-shortest');args.push('-movflags','+faststart',OUT);
await new Promise((res,rej)=>execFile('ffmpeg',args,(e,so,se)=>{if(e){console.error(se);process.exit(1);}fs.rmSync(frames,{recursive:true,force:true});console.log(OUT);res();}));
