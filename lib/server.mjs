import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { detectAll } from '../tools/deps.mjs';

const ROOT = process.env.DWH_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.DWH_DATA || ROOT;
const PORT = process.env.PORT || 8899;
const UPLOADS = path.join(DATA, 'uploads');
const CACHE = path.join(DATA, 'cache', 'models');
const OUT = path.join(DATA, 'out-model');
for (const d of [UPLOADS, path.join(UPLOADS,'assets'), CACHE, OUT]) fs.mkdirSync(d, { recursive: true });

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.json':'application/json', '.glb':'model/gltf-binary', '.gltf':'model/gltf+json', '.wav':'audio/wav', '.mp3':'audio/mpeg', '.mp4':'video/mp4', '.woff2':'font/woff2' };
const jobs = new Map();

function json(res, code, obj) { res.writeHead(code, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}); res.end(JSON.stringify(obj)); }
function readBody(req, limit = 250 * 1024 * 1024) {
  return new Promise((resolve, reject) => { const chunks=[]; let n=0; req.on('data', c => { n+=c.length; if(n>limit){req.destroy();reject(new Error('too large'));return;} chunks.push(c); }); req.on('end',()=>resolve(Buffer.concat(chunks))); req.on('error',reject); });
}
function sha(buf){ return crypto.createHash('sha256').update(buf).digest('hex').slice(0,16); }

const server = http.createServer(async (req,res)=>{
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === 'POST' && url.pathname === '/api/model') {
      const buf = await readBody(req);
      if (buf.length < 12 || buf.readUInt32LE(0) !== 0x46546C67) return json(res,400,{error:'目前只支持 GLB（文件头不是 glTF binary）'});
      const name = (url.searchParams.get('name') || 'model.glb').replace(/[^\w.\-]+/g,'_');
      const hash = sha(buf);
      const up = path.join(UPLOADS, `${hash}.glb`); fs.writeFileSync(up, buf);
      const graphFile = path.join(CACHE, hash, 'partgraph.json');
      if (!fs.existsSync(graphFile)) {
        await new Promise((resolve,reject)=>execFile(process.execPath,[path.join(ROOT,'tools','model-pipeline.mjs'),up,'--force'],{cwd:DATA},(err,stdout,stderr)=>{ if(err) reject(new Error(stderr||stdout||err.message)); else resolve(); }));
      }
      const graph = JSON.parse(fs.readFileSync(graphFile,'utf8'));
      return json(res,200,{hash,name,parts:graph.partCount,groups:graph.groupCount,partGraph:graph,modelUrl:`/cache/models/${hash}/model.glb`});
    }
    if (req.method === 'POST' && url.pathname === '/api/asset') {
      const buf = await readBody(req);
      const kind = (url.searchParams.get('kind')||'asset').replace(/[^\w\-]+/g,'');
      const name = (url.searchParams.get('name')||'asset.bin').replace(/[^\w.\-]+/g,'_');
      const hash = sha(buf);
      const p = path.join(UPLOADS,'assets',`${hash}-${name}`);
      fs.writeFileSync(p,buf);
      return json(res,200,{kind,name,url:`/uploads/assets/${path.basename(p)}`});
    }
    if (req.method === 'POST' && url.pathname === '/api/render') {
      const body = JSON.parse((await readBody(req)).toString('utf8')||'{}');
      const hash = String(body.hash||'').replace(/[^a-f0-9]/g,'');
      if (body.template !== 'drone42' && (!hash || !fs.existsSync(path.join(CACHE,hash,'model.glb')))) return json(res,400,{error:'missing model'});
      const id = crypto.randomBytes(5).toString('hex');
      const out = path.join(OUT, `${id}.mp4`);
      let args;
      if (body.template === 'drone42') {
        args = [path.join(ROOT,'tools','render-drone42-cdp.mjs'), '--out', out, '--template', String(body.theme||'02').replace(/[^0-9]/g,'')||'02', '--browser', (detectAll().browser.path||'')];
      } else {
        args = [path.join(ROOT,'tools','render-model-cdp.mjs'), '--model', `/cache/models/${hash}/model.glb`, '--out', out, '--music', body.musicUrl||'', '--bg', body.bgUrl||'', '--browser', (detectAll().browser.path||'')];
      }
      const job = { id, status:'running', out, log:'' };
      jobs.set(id,job);
      const child = execFile(process.execPath,args,{cwd:DATA,env:{...process.env,DWH_ROOT:ROOT,DWH_DATA:DATA},maxBuffer:1024*1024*8},(err,stdout,stderr)=>{ job.log=(stdout||'')+(stderr||''); if(err){job.status='error';job.error=err.message;} else {job.status='done'; job.url=`/out-model/${id}.mp4`; } });
      job.child=child;
      return json(res,200,{id,status:'running'});
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/job/')) {
      const job = jobs.get(url.pathname.split('/').pop());
      if (!job) return json(res,404,{error:'no job'});
      return json(res,200,{id:job.id,status:job.status,url:job.url||null,error:job.error||null,log:(job.log||'').slice(-2000)});
    }
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res,200,detectAll());
    if (req.method === 'GET' && url.pathname === '/api/cache') {
      const items=[]; for(const d of fs.readdirSync(CACHE)){const f=path.join(CACHE,d,'partgraph.json');if(!fs.existsSync(f))continue;const g=JSON.parse(fs.readFileSync(f,'utf8'));items.push({hash:d,name:g.source.name,parts:g.partCount,groups:g.groupCount});}
      return json(res,200,{items});
    }
    // static
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/studio/index.html';
    if (p.endsWith('/')) p += 'index.html';
    let file;
    if (p.startsWith('/cache/') || p.startsWith('/uploads/') || p.startsWith('/out-model/')) file = path.join(DATA, p);
    else file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file,(err,data)=>{ if(err){res.writeHead(404);res.end('not found');return;} res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'});res.end(data); });
  } catch(e) { json(res,500,{error:e.message}); }
});
server.listen(PORT, '127.0.0.1', ()=>console.log(`STUDIO http://127.0.0.1:${PORT}/studio/`));
