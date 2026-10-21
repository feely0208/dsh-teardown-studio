#!/usr/bin/env node
/**
 * Local 3D model pipeline (no cloud, no external deps).
 *   upload GLB -> extract every node/mesh into a part graph -> cache locally -> reuse next run.
 *
 * Usage:
 *   node tools/model-pipeline.mjs <model.glb> [--force]
 *   node tools/model-pipeline.mjs --list
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = process.cwd();
const LABEL_HINTS = {
  enginemetal: '发动机 / 金属动力结构',
  stealh: '外壳 / 蒙皮',
  GOLD: '接口 / 装饰件',
  detail_grey: '灰色细节件',
  detail_black: '黑色细节件',
  detail_red: '红色细节件',
  DETAIL_WHITE: '白色细节件'
};
const CACHE = path.join(ROOT, 'cache', 'models');
fs.mkdirSync(CACHE, { recursive: true });

const args = process.argv.slice(2);
if (args.includes('--list')) { listCache(); process.exit(0); }
const force = args.includes('--force');
const input = args.find(a => !a.startsWith('--'));
if (!input) { console.error('usage: node tools/model-pipeline.mjs <model.glb> [--force]'); process.exit(1); }

const src = path.resolve(input);
if (!fs.existsSync(src)) { console.error('missing file:', src); process.exit(1); }
const buf = fs.readFileSync(src);
const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
const dir = path.join(CACHE, hash);
const graphFile = path.join(dir, 'partgraph.json');

if (!force && fs.existsSync(graphFile)) {
  const cached = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
  console.log(`CACHED  ${hash}  ${cached.partCount} parts  ${cached.source.name}`);
  console.log(`path    ${dir}`);
  console.log(`model   ${path.join(dir, cached.source.cachedName)}`);
  process.exit(0);
}

const glb = parseGLB(buf);
const parts = extractParts(glb);
const bounds = unionBounds(parts.map(p => p.bounds));
const center = centerOf(bounds);
const overall = { size: sizeOf(bounds) };

for (const p of parts) {
  let dx=p.center[0]-center[0], dy=p.center[1]-center[1], dz=p.center[2]-center[2];
  let len=Math.hypot(dx,dy,dz); if(len<1e-6){dy=1;len=1;}
  dx/=len; dy/=len; dz/=len; dy+=0.35; len=Math.hypot(dx,dy,dz)||1;
  p.explode=[round(dx/len),round(dy/len),round(dz/len)];
}

const groups = groupByMaterial(parts);
const graph = {
  version: 1,
  createdAt: new Date().toISOString(),
  source: { name: path.basename(src), hash, bytes: buf.length, cachedName: 'model.glb' },
  bounds: bounds.map(round),
  center: center.map(round),
  size: overall.size.map(round),
  partCount: parts.length,
  groupCount: groups.length,
  parts,
  groups
};

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'model.glb'), buf);
fs.writeFileSync(graphFile, JSON.stringify(graph, null, 2));
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
  hash, name: graph.source.name, parts: parts.length, groups: groups.length, createdAt: graph.createdAt
}, null, 2));

console.log(`PREPARED ${hash}`);
console.log(`file     ${src}`);
console.log(`cache    ${dir}`);
console.log(`parts    ${parts.length}  groups ${groups.length}`);
console.log('---');
for (const p of parts.slice(0, 12)) console.log(`${p.id}  ${p.name}  [${p.center.join(', ')}]  ${p.materials.join('/') || '-'}`);
if (parts.length > 12) console.log(`... ${parts.length - 12} more`);
console.log('---');
console.log(`next run: node tools/model-pipeline.mjs "${path.relative(ROOT, src)}"  -> CACHED`);

/* ---------------- GLB ---------------- */
function parseGLB(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546C67) throw new Error('not a GLB');
  const version = buffer.readUInt32LE(4);
  const total = buffer.readUInt32LE(8);
  let off = 12, json = null;
  while (off < total) {
    const len = buffer.readUInt32LE(off);
    const type = buffer.readUInt32LE(off + 4);
    const chunk = buffer.subarray(off + 8, off + 8 + len);
    if (type === 0x4E4F534A) json = JSON.parse(chunk.toString('utf8').replace(/\0+$/g, '').trim());
    off += 8 + len;
  }
  if (!json) throw new Error('no JSON chunk');
  return { json, version };
}

function extractParts(glb) {
  const { json } = glb;
  const parts = [];
  const scene = json.scenes?.[json.scene ?? 0] || { nodes: [] };
  const walk = (idx, parentMatrix, trail) => {
    const node = json.nodes?.[idx];
    if (!node) return;
    const world = mul(parentMatrix, localMatrix(node));
    const name = node.name || `node_${idx}`;
    if (node.mesh != null) {
      const mesh = json.meshes?.[node.mesh];
      const bounds = meshBounds(json, mesh);
      if (bounds) {
        const wb = transformBounds(bounds, world);
        const mats = [...new Set((mesh.primitives || []).map(pr => json.materials?.[pr.material]?.name).filter(Boolean))];
        parts.push({
          id: `part-${String(parts.length + 1).padStart(2, '0')}`,
          name: cleanName(mesh.name || name),
          nodeIndex: idx,
          meshIndex: node.mesh,
          materials: mats,
          path: [...trail, name].join('/'),
          bounds: wb.map(round),
          center: centerOf(wb).map(round),
          size: sizeOf(wb).map(round),
          explode: [0, 1, 0]
        });
      }
    }
    for (const child of node.children || []) walk(child, world, [...trail, name]);
  };
  for (const root of scene.nodes || []) walk(root, identity(), []);
  return parts;
}

function meshBounds(json, mesh) {
  let out = null;
  for (const prim of mesh.primitives || []) {
    const acc = json.accessors?.[prim.attributes?.POSITION];
    if (!acc?.min || !acc?.max) continue;
    const b = [
      acc.min[0], acc.min[1], acc.min[2],
      acc.max[0], acc.max[1], acc.max[2]
    ];
    out = out ? unionBounds([out, b]) : b;
  }
  return out;
}

/* ---------------- matrix ---------------- */
function identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
function localMatrix(n) {
  if (n.matrix) return n.matrix.slice();
  const t = n.translation || [0,0,0];
  const q = n.rotation || [0,0,0,1];
  const s = n.scale || [1,1,1];
  const [x,y,z,w] = q;
  const x2=x+x, y2=y+y, z2=z+z;
  const xx=x*x2, xy=x*y2, xz=x*z2, yy=y*y2, yz=y*z2, zz=z*z2, wx=w*x2, wy=w*y2, wz=w*z2;
  return [
    (1-(yy+zz))*s[0], (xy+wz)*s[0], (xz-wy)*s[0], 0,
    (xy-wz)*s[1], (1-(xx+zz))*s[1], (yz+wx)*s[1], 0,
    (xz+wy)*s[2], (yz-wx)*s[2], (1-(xx+yy))*s[2], 0,
    t[0], t[1], t[2], 1
  ];
}
function mul(a,b) {
  const o = new Array(16);
  for (let c=0;c<4;c++) for (let r=0;r<4;r++) {
    o[c*4+r] = a[0*4+r]*b[c*4+0] + a[1*4+r]*b[c*4+1] + a[2*4+r]*b[c*4+2] + a[3*4+r]*b[c*4+3];
  }
  return o;
}
function tp(m, p) {
  return [
    m[0]*p[0] + m[4]*p[1] + m[8]*p[2] + m[12],
    m[1]*p[0] + m[5]*p[1] + m[9]*p[2] + m[13],
    m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14]
  ];
}
function transformBounds(b, m) {
  const pts = [];
  for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) pts.push(tp(m, [x,y,z]));
  return unionBounds([pts.flat()]);
}

/* ---------------- bounds ---------------- */
function unionBounds(list) {
  const out = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const b of list) if (b) {
    out[0]=Math.min(out[0],b[0]); out[1]=Math.min(out[1],b[1]); out[2]=Math.min(out[2],b[2]);
    out[3]=Math.max(out[3],b[3]); out[4]=Math.max(out[4],b[4]); out[5]=Math.max(out[5],b[5]);
  }
  return out;
}
function centerOf(b) { return [(b[0]+b[3])/2, (b[1]+b[4])/2, (b[2]+b[5])/2]; }
function sizeOf(b) { return [b[3]-b[0], b[4]-b[1], b[5]-b[2]]; }
function cleanName(n) { return String(n || 'mesh').replace(/_[A-Za-z0-9]+_\d+$/, '').replace(/[._]+/g, ' ').trim(); }
function round(n) { return Math.round(n * 10000) / 10000; }

function groupByMaterial(parts) {
  const map = new Map();
  for (const p of parts) {
    const key = p.materials[0] || 'unassigned';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p.id);
  }
  return [...map.entries()].map(([name, ids], i) => ({ id: `group-${String(i+1).padStart(2,'0')}`, name, label: LABEL_HINTS[name] || name, parts: ids }));
}

/* ---------------- box helper ---------------- */

function listCache() {
  console.log('cache:', CACHE);
  for (const d of fs.readdirSync(CACHE)) {
    const f = path.join(CACHE,d,'partgraph.json');
    if (!fs.existsSync(f)) continue;
    const g = JSON.parse(fs.readFileSync(f,'utf8'));
    console.log(`${d}  ${g.partCount} parts  ${g.source.name}  ${g.createdAt}`);
  }
}
