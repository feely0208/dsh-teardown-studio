import * as THREE from 'three';
import { TextureLoader } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W=1920,H=1080;
const T2=new URLSearchParams(location.search).get('template')==='02';
const EMBED=new URLSearchParams(location.search).get('embed')==='1';
if(T2)document.body.classList.add('tpl02');
if(EMBED)document.body.classList.add('embed');
const cl=v=>Math.min(1,Math.max(0,v));
const ss=(t,a,b)=>{const x=cl((t-a)/(b-a));return x*x*(3-2*x);};
const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const lerp=(a,b,t)=>a+(b-a)*t;

const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(W,H);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
renderer.outputColorSpace=THREE.SRGBColorSpace;
document.getElementById('stage').appendChild(renderer.domElement);

const scene=new THREE.Scene();scene.background=new THREE.Color(0x04070f);scene.fog=new THREE.FogExp2(0x04070f,.022);
const camera=new THREE.PerspectiveCamera(37,W/H,.05,100);scene.add(camera);
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.38;

/* textures */
function canvasTex(w,h,draw,repeat){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat[0],repeat[1]);}
  return t;
}
const carbonTex=canvasTex(256,256,(g,w,h)=>{
  g.fillStyle='#0a0b0d';g.fillRect(0,0,w,h);const s=16;
  for(let y=0;y<h;y+=s)for(let x=0;x<w;x+=s){
    const odd=((x/s+y/s)%2)===0;g.fillStyle=odd?'rgba(60,64,72,.55)':'rgba(20,22,26,.72)';
    g.fillRect(x+1,y+1,s-2,s-2);g.fillStyle=odd?'rgba(120,128,140,.1)':'rgba(70,78,90,.05)';
    g.fillRect(x+1,y+1,s-2,3);
  }
},[12,12]);
const pcbTex=canvasTex(512,512,(g,w,h)=>{
  g.fillStyle='#091510';g.fillRect(0,0,w,h);g.strokeStyle='rgba(196,150,58,.35)';g.lineWidth=2;
  for(let i=0;i<60;i++){let x=Math.random()*w,y=Math.random()*h;g.beginPath();g.moveTo(x,y);
    for(let k=0;k<3;k++){x+=(Math.random()-.5)*160;y+=(Math.random()-.5)*160;g.lineTo(x,y);}g.stroke();}
  g.fillStyle='rgba(205,165,75,.5)';for(let i=0;i<160;i++)g.fillRect(Math.random()*w,Math.random()*h,5,5);
});
const decalTex=canvasTex(512,96,(g,w,h)=>{
  g.clearRect(0,0,w,h);g.fillStyle='rgba(238,231,219,.7)';g.font='500 30px "SF Mono",Menlo,monospace';g.textAlign='center';
  g.fillText('DEEPSEEK  /  1017',w/2,h*.66);
});
const chipTex=canvasTex(256,256,(g,w,h)=>{
  g.fillStyle='#07080a';g.fillRect(0,0,w,h);g.strokeStyle='rgba(227,162,90,.5)';g.lineWidth=4;g.strokeRect(9,9,w-18,h-18);
  g.fillStyle='rgba(244,201,142,.92)';g.font='700 52px "SF Mono",Menlo,monospace';g.textAlign='center';
  g.fillText('1017',w/2,h/2+2);g.font='500 13px "SF Mono",Menlo,monospace';g.fillText('FLIGHT CTRL',w/2,h/2+34);
});

const propBlurTex=canvasTex(256,256,(g,w,h)=>{
  g.clearRect(0,0,w,h);
  const gr=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
  gr.addColorStop(0,'rgba(150,165,180,.05)');gr.addColorStop(.55,'rgba(150,165,180,.16)');gr.addColorStop(1,'rgba(150,165,180,0)');
  g.fillStyle=gr;g.beginPath();g.arc(w/2,h/2,w/2,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(190,205,220,.20)';g.lineWidth=6;
  for(let i=0;i<3;i++){g.beginPath();g.arc(w/2,h/2,w*.34,i*2.094,i*2.094+1.2);g.stroke();}
});

/* materials */
const matBody=new THREE.MeshStandardMaterial({color:0x14161a,metalness:.55,roughness:.46,envMapIntensity:1.1});
const matShell=new THREE.MeshPhysicalMaterial({color:0x111317,metalness:.45,roughness:.4,clearcoat:.7,clearcoatRoughness:.3,envMapIntensity:1.2});
const matCarbon=new THREE.MeshPhysicalMaterial({color:0x0c0e11,metalness:.5,roughness:.44,map:carbonTex,clearcoat:.6,envMapIntensity:1.0});
const matMetal=new THREE.MeshPhysicalMaterial({color:0x262a31,metalness:1,roughness:.25,envMapIntensity:1.5});
const matDark=new THREE.MeshStandardMaterial({color:0x07080a,metalness:.4,roughness:.64});
const matAccent=new THREE.MeshPhysicalMaterial({color:0xd9822e,metalness:.5,roughness:.36,emissive:0x361303,emissiveIntensity:1.2});
const matGlass=new THREE.MeshPhysicalMaterial({color:0x8fb8e8,metalness:0,roughness:.02,transparent:true,opacity:.55,clearcoat:1,envMapIntensity:2.4,ior:1.62});
const matPCB=new THREE.MeshStandardMaterial({color:0x0a1a12,metalness:.3,roughness:.58,map:pcbTex,emissive:0x06110b,emissiveMap:pcbTex,emissiveIntensity:.9});
const matChip=new THREE.MeshStandardMaterial({color:0x07080a,metalness:.7,roughness:.32});
const matProp=new THREE.MeshPhysicalMaterial({color:0x14171c,metalness:.45,roughness:.4,clearcoat:.5,side:THREE.DoubleSide});
const matCopper=new THREE.MeshPhysicalMaterial({color:0xb06a3a,metalness:1,roughness:.32,envMapIntensity:1.3});
const matLED=new THREE.MeshBasicMaterial({color:0xff5a2e,toneMapped:false});
const matStrip=new THREE.MeshBasicMaterial({color:0xff6a3a,toneMapped:false});
const matAmber=new THREE.MeshBasicMaterial({color:0xffb066,toneMapped:false});
if(T2){
  matBody.color.set(0x23272e);matShell.color.set(0x181c22);
  matAccent.color.set(0x1f7fa8);matAccent.emissive.set(0x06202c);
  matStrip.color.set(0x5cc8ff);matAmber.color.set(0x8fe0ff);matLED.color.set(0x4fc8ff);
  matGlass.color.set(0xa8d8f0);matProp.color.set(0x1a1e24);
}

/* helpers */
function box(p,w,h,d,r,mat,x,y,z){
  const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,4,r),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;p.add(m);return m;
}
function cylY(p,r,h,mat,x,y,z,seg=40){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),mat);m.position.set(x,y,z);m.castShadow=true;p.add(m);return m;}
function tube(p,pts,r,mat){const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),32,r,8,false);const m=new THREE.Mesh(g,mat);m.castShadow=true;p.add(m);return m;}
function torus(p,R,t,mat,x,y,z,axis='y'){const m=new THREE.Mesh(new THREE.TorusGeometry(R,t,10,64),mat);m.position.set(x,y,z);if(axis==='x')m.rotation.y=Math.PI/2;else if(axis==='y')m.rotation.x=Math.PI/2;m.castShadow=true;p.add(m);return m;}

/* body shape */
function outline(w,d,r){
  const s=new THREE.Shape();
  s.moveTo(-w/2+r,-d/2);s.lineTo(w/2-r,-d/2);s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);
  s.lineTo(w/2,d/2-r);s.quadraticCurveTo(w/2,d/2,w/2-r,d/2);
  s.lineTo(-w/2+r,d/2);s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);
  s.lineTo(-w/2,-d/2+r);s.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);
  return s;
}
function extrudeBody(w,d,h,r,mat,y){
  const g=new THREE.ExtrudeGeometry(outline(w,d,r),{depth:h,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:4,curveSegments:28});
  g.rotateX(-Math.PI/2);g.translate(0,y,0);
  const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m;
}

const product=new THREE.Group();scene.add(product);

// lofted hull (smooth, tapered nose/tail)
function loft(stations,mat,M=32,n=2.4){
  const pos=[],idx=[];
  for(const st of stations){
    for(let i=0;i<M;i++){
      const a=i/M*Math.PI*2,cz=Math.cos(a),sy=Math.sin(a);
      const z=Math.sign(cz)*Math.pow(Math.abs(cz),2/n)*st.w/2;
      const y=st.cy+Math.sign(sy)*Math.pow(Math.abs(sy),2/n)*st.h/2;
      pos.push(st.x,y,z);
    }
  }
  for(let si=0;si<stations.length-1;si++)for(let i=0;i<M;i++){
    const a=si*M+i,b=si*M+(i+1)%M,c=(si+1)*M+(i+1)%M,d=(si+1)*M+i;
    idx.push(a,c,b,a,d,c);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m;
}
const bodyStations=[
  {x:-.46,w:.17,h:.065,cy:.012},{x:-.38,w:.31,h:.100,cy:.014},{x:-.24,w:.41,h:.125,cy:.014},
  {x:-.05,w:.46,h:.135,cy:.014},{x:.16,w:.45,h:.130,cy:.014},{x:.30,w:.38,h:.110,cy:.016},
  {x:.40,w:.27,h:.082,cy:.018},{x:.46,w:.12,h:.040,cy:.020}
];
const bodyMat=new THREE.MeshPhysicalMaterial({color:0x121418,metalness:.5,roughness:.42,clearcoat:.7,clearcoatRoughness:.28,envMapIntensity:1.15,side:THREE.DoubleSide});
const body=new THREE.Group();product.add(body);
body.add(loft(bodyStations,bodyMat,36,2.35));

// body detail: seams, vents, decal, accent strips
{
  const lineMat=new THREE.MeshBasicMaterial({color:0x040506});
  const vm=new THREE.MeshStandardMaterial({color:0x050607,roughness:.65,metalness:.3});
  for(const side of [-1,1]){
    const seam=new THREE.Mesh(new THREE.BoxGeometry(.58,.004,.006),lineMat);seam.position.set(-.03,.079,side*.218);product.add(seam);
    for(let i=0;i<4;i++){
      const v=new THREE.Mesh(new THREE.BoxGeometry(.085,.012,.014),vm);v.position.set(-.18+i*.105,.044,side*.226);product.add(v);
    }

  }
  const d=new THREE.Mesh(new THREE.PlaneGeometry(.30,.056),new THREE.MeshBasicMaterial({map:decalTex,transparent:true,depthWrite:false,toneMapped:false,opacity:.75}));
  d.rotation.x=-Math.PI/2;d.position.set(.10,.083,0);product.add(d);
}

// top shell (lofted thin cover)
const topShell=new THREE.Group();topShell.userData.partId='shell';product.add(topShell);
const shellStations=[
  {x:-.35,w:.28,h:.022,cy:.085},{x:-.20,w:.39,h:.026,cy:.087},{x:.03,w:.42,h:.027,cy:.087},
  {x:.22,w:.36,h:.024,cy:.085},{x:.31,w:.22,h:.018,cy:.083}
];
const shellMat=new THREE.MeshPhysicalMaterial({color:0x0b0d10,metalness:.5,roughness:.4,clearcoat:.8,clearcoatRoughness:.25,envMapIntensity:1.2,side:THREE.DoubleSide});
topShell.add(loft(shellStations,shellMat,36,2.3));
{
  const panel=new THREE.Mesh(new THREE.BoxGeometry(.52,.005,.30),new THREE.MeshStandardMaterial({color:0x0a0b0d,roughness:.6}));
  panel.position.set(-.01,.099,0);topShell.add(panel);
  for(let i=0;i<3;i++)box(topShell,.42,.008,.014,.004,matDark,0,.088,-.09+i*.09);
  box(topShell,.016,.006,.30,.004,matAccent,.26,.101,0);
  // panel seams + screws
  const lm=new THREE.MeshBasicMaterial({color:0x040506});
  for(const z of [-.13,0,.13]){
    const l=new THREE.Mesh(new THREE.BoxGeometry(.56,.003,.005),lm);l.position.set(-.02,.102,z);topShell.add(l);
  }
  const sg=new THREE.CylinderGeometry(.009,.009,.007,10);
  const sm=new THREE.MeshStandardMaterial({color:0x3a3f47,metalness:1,roughness:.3});
  for(const [x,z] of [[-.30,-.18],[.24,-.18],[-.30,.18],[.24,.18],[0,.20],[0,-.20]]){
    const sc=new THREE.Mesh(sg,sm);sc.position.set(x,.102,z);topShell.add(sc);
  }
}

// battery
const battery=new THREE.Group();battery.position.set(0,.118,-.02);battery.userData.partId='battery';product.add(battery);
{
  box(battery,.46,.065,.32,.026,matDark,0,0,0);
  box(battery,.42,.010,.28,.008,matBody,0,.040,0);
  for(let i=0;i<4;i++)box(battery,.038,.012,.046,.003,matDark,-.16+i*.11,.052,-.14);
  box(battery,.24,.010,.011,.003,matAccent,0,.045,.16);
  const d=new THREE.Mesh(new THREE.PlaneGeometry(.28,.052),new THREE.MeshBasicMaterial({map:decalTex,transparent:true,depthWrite:false,toneMapped:false,opacity:.7}));
  d.rotation.x=-Math.PI/2;d.position.set(0,.054,.03);battery.add(d);
}

// FC board
const fc=new THREE.Group();fc.position.y=.018;fc.userData.partId='fc';product.add(fc);
{
  const m=new THREE.Mesh(new THREE.BoxGeometry(.44,.022,.30),[matPCB,matDark,matDark,matDark,matDark,matDark]);m.castShadow=true;fc.add(m);
  const chip=new THREE.Mesh(new THREE.BoxGeometry(.15,.020,.15),[matChip,matChip,new THREE.MeshStandardMaterial({map:chipTex,metalness:.6,roughness:.3}),matChip,matChip,matChip]);
  chip.position.set(0,.050,.02);fc.add(chip);
  box(fc,.22,.032,.16,.01,matMetal,0,.055,-.08);
  box(fc,.045,.028,.045,.005,matAccent,.17,.045,.0);
  torus(fc,.11,.011,matCopper,.0,.055,.14,'x');
}

/* gimbal */
const gimbal=new THREE.Group();gimbal.position.set(.40,-.16,0);gimbal.userData.partId='gimbal';product.add(gimbal);
{
  // bracket
  box(product,.20,.05,.14,.012,matMetal,.44,-.10,0);
box(product,.22,.035,.07,.008,matMetal,.36,-.14,0);
  box(product,.07,.16,.11,.012,matMetal,.43,-.16,0);
  // yaw / roll
  cylY(gimbal,.055,.05,matMetal,0,0,0,32);
  box(gimbal,.05,.11,.09,.012,matMetal,0,-.06,.06);
  const cam=new THREE.Group();cam.position.set(.02,-.12,.065);gimbal.add(cam);
  box(cam,.25,.19,.18,.038,matShell,0,0,0);
  // dual lens
  for(const z of [-.045,.045]){
    const r=z<0?.066:.053;
    cylY(cam,r,.05,matMetal,0,0,0,36).rotation.z=Math.PI/2;
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.09,36),matMetal);barrel.rotation.z=Math.PI/2;barrel.position.set(.125,0,z);barrel.castShadow=true;cam.add(barrel);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(r*.92,.006,8,32),matAccent);ring.rotation.y=Math.PI/2;ring.position.set(.17,0,z);cam.add(ring);
    const glass=new THREE.Mesh(new THREE.CylinderGeometry(r*.82,r*.82,.008,36),matGlass);glass.rotation.z=Math.PI/2;glass.position.set(.17,0,z);cam.add(glass);
  }
  box(cam,.03,.04,.02,.004,matAccent,.07,.06,.08);
}

/* arms + ducts + motors + props */
const arms=[];const airflows=[];const plumes=[];
const dirs=[[1,1],[-1,1],[-1,-1],[1,-1]];
dirs.forEach(([sx,sz],idx)=>{
  const root=new THREE.Group();root.rotation.y=-Math.atan2(sz,sx);product.add(root);
  // arm tube from body to duct
  const curvePts=[new THREE.Vector3(.30,0,.16),new THREE.Vector3(.55,.015,.34),new THREE.Vector3(.78,.02,.56),new THREE.Vector3(.95,.02,.72)];
  // Note: local +X direction; build along X instead
  const pts=[new THREE.Vector3(.30,0,0),new THREE.Vector3(.55,.012,0),new THREE.Vector3(.80,.018,0),new THREE.Vector3(.90,.02,0)];
  const arm=tube(root,pts,.026,matCarbon);arm.userData.partId='duct';
  box(root,.20,.08,.13,.02,matCarbon,.40,0,0).userData.partId='duct';
  cylY(root,.052,.045,matMetal,.33,0,0,18);
  torus(root,.055,.005,matAccent,.33,.0,0,'y');
  // duct root
  const duct=new THREE.Group();duct.position.set(.90,.02,0);duct.userData.partId='duct';root.add(duct);
  const prof=[[.245,0],[.282,0],[.287,.03],[.277,.075],[.254,.085],[.241,.06],[.241,.03],[.245,0]].map(p=>new THREE.Vector2(p[0],p[1]));
  const dg=new THREE.LatheGeometry(prof,56);const dm=new THREE.Mesh(dg,new THREE.MeshPhysicalMaterial({color:0x191c21,metalness:.6,roughness:.38,side:THREE.DoubleSide,clearcoat:.5,envMapIntensity:1.1}));
  dm.castShadow=true;duct.add(dm);
  torus(duct,.294,.005,matMetal,0,.078,0,'y');
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3;const sp=new THREE.Mesh(new THREE.BoxGeometry(.24,.011,.016),matMetal);
    sp.position.set(Math.cos(a)*.13,.055,Math.sin(a)*.13);sp.rotation.y=-a;duct.add(sp);
  }
  const motor=new THREE.Group();motor.position.y=.02;motor.userData.partId='motor';duct.add(motor);
  cylY(motor,.064,.065,matMetal,0,0,0,32);
  cylY(motor,.077,.046,matShell,0,.05,0,36);
  torus(motor,.074,.004,matAmber,0,.077,0,'y');
  cylY(motor,.011,.12,matMetal,0,.10,0,12);
  const led=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,.006,10),matLED);led.position.set(0,-.04,.068);motor.add(led);
  // duct airflow: soft mist + short streaks (air, not coils)
  {
    const fg=new THREE.Group();duct.add(fg);fg.userData.noBox=true;
    const fm=new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uTime;varying vec2 vUv;void main(){float n=sin(vUv.y*16.0-uTime*1.8)*sin(vUv.x*10.0+uTime*.7)*.5+.5;float a=n*.09+.012;vec3 c=vec3(.62,.82,1.0);gl_FragColor=vec4(c*a,a);}`});
    const fcyl=new THREE.Mesh(new THREE.CylinderGeometry(.272,.235,.13,48,1,true),fm);fcyl.position.y=.035;fg.add(fcyl);
    const puffTex=canvasTex(64,64,(g,w,h)=>{const gr=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,'rgba(225,242,255,.95)');gr.addColorStop(.45,'rgba(170,215,255,.28)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
    const puffs=[];
    for(let j=0;j<11;j++){
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:puffTex,color:0xcfeaff,transparent:true,opacity:.1,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
      sp.scale.setScalar(.08);fg.add(sp);puffs.push({sp,phase:j/11});
    }
    const streaks=[];
    for(let j=0;j<7;j++){
      const g2=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,0)]);
      const ln=new THREE.Line(g2,new THREE.LineBasicMaterial({color:0xdff2ff,transparent:true,opacity:.32,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
      fg.add(ln);streaks.push({ln,phase:j/7,ang:j*2.399});
    }
    airflows.push({mat:fm,puffs,streaks,phase:idx*1.7});
  }

  // prop-wash plume: soft volumetric columns + smoke puffs
  {
    const pg=new THREE.Group();pg.position.y=-.015;duct.add(pg);pg.userData.noBox=true;
    const plumeMat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uColor:{value:new THREE.Color(T2?0x1f7fa8:0x8fb0c4)},uOpacity:{value:T2?.58:.34}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:`uniform float uTime;uniform vec3 uColor;uniform float uOpacity;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
        void main(){vUv=uv;vec3 p=position;
          float sway=sin(uv.y*7.0+uTime*1.1)*.035*(1.0-uv.y);
          p.x+=sway;p.z+=cos(uv.y*5.0+uTime*.9)*.035*(1.0-uv.y);
          vN=normalize(normalMatrix*normal);
          vec4 mv=modelViewMatrix*vec4(p,1.0);
          vV=normalize(-mv.xyz);
          gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform float uTime;uniform vec3 uColor;uniform float uOpacity;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
        float fbm(vec2 p){float v=0.;float a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}
        void main(){vec2 uv=vUv;float n=fbm(vec2(uv.x*10.0+uTime*.3,uv.y*4.0-uTime*.5));
          float ndv=abs(dot(normalize(vN),normalize(vV)));
          float soft=pow(ndv,1.25);
          float fade=smoothstep(0.0,0.22,uv.y)*smoothstep(1.0,0.42,uv.y);
          float a=n*n*uOpacity*soft*fade;
          gl_FragColor=vec4(uColor,a);}`});
    const c1=new THREE.Mesh(new THREE.CylinderGeometry(.075,.44,1.0,44,1,true),plumeMat);c1.position.y=-.52;pg.add(c1);
    const c2=new THREE.Mesh(new THREE.CylinderGeometry(.13,.56,1.05,44,1,true),plumeMat.clone());c2.position.y=-.54;c2.material.uniforms.uTime.value=1.7;pg.add(c2);
    const puffs=[];
    const st=canvasTex(64,64,(g,w,h)=>{const gr=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,'rgba(220,235,242,.55)');gr.addColorStop(.45,'rgba(160,185,200,.18)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
    for(let j=0;j<28;j++){
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:st,color:(T2?0x1f7fa8:0xa8c0cc),transparent:true,opacity:(T2?.24:.14),blending:THREE.NormalBlending,depthWrite:false}));
      sp.scale.setScalar(.16);pg.add(sp);puffs.push({sp,phase:j/20,rad:j});
    }
    plumes.push({group:pg,mats:[plumeMat,c2.material],puffs,phase:idx*1.3});
  }

  const prop=new THREE.Group();prop.position.y=.115;prop.scale.setScalar(.84);prop.userData.partId='prop';motor.add(prop);
  cylY(prop,.022,.018,matDark,0,0,0,18);
  // curved blade via shape extrude
  const bs=new THREE.Shape();
  bs.moveTo(0,0);bs.quadraticCurveTo(.14,.012,.28,.005);bs.quadraticCurveTo(.29,.035,.16,.045);bs.quadraticCurveTo(.06,.03,0,.018);
  const bg=new THREE.ExtrudeGeometry(bs,{depth:.004,bevelEnabled:false,curveSegments:12});
  bg.rotateX(-Math.PI/2);
  for(let b=0;b<3;b++){
    const holder=new THREE.Group();holder.rotation.y=b*Math.PI*2/3;
    const blade=new THREE.Mesh(bg,matProp);blade.rotation.x=(idx%2?1:-1)*.16;blade.castShadow=true;holder.add(blade);
    const cuff=new THREE.Mesh(new THREE.BoxGeometry(.045,.010,.050),new THREE.MeshStandardMaterial({color:0x2a2f36,metalness:.6,roughness:.35}));cuff.position.set(.055,.004,0);holder.add(cuff);
    const tip=new THREE.Mesh(new THREE.BoxGeometry(.03,.006,.03),new THREE.MeshStandardMaterial({color:0x9aa7b8,roughness:.5}));
    tip.position.set(.285,.004,0);holder.add(tip);prop.add(holder);
  }
  // arm fairing
  box(root,.26,.018,.10,.008,matCarbon,.46,.035,0);
  // duct rim screws
  for(let k=0;k<4;k++){
    const a=k*Math.PI/2+Math.PI/4;
    const sc=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.006,8),new THREE.MeshStandardMaterial({color:0x3a3f47,metalness:1,roughness:.3}));
    sc.position.set(Math.cos(a)*.265,.075,Math.sin(a)*.265);duct.add(sc);
  }
  // emissive accent strips
  const st1=new THREE.Mesh(new THREE.BoxGeometry(.55,.006,.012),matStrip);st1.position.set(.60,.035,.055);root.add(st1);
  const st2=new THREE.Mesh(new THREE.BoxGeometry(.55,.006,.012),matStrip);st2.position.set(.60,.035,-.055);root.add(st2);
  arms.push({root,duct,motor,prop,dir:new THREE.Vector3(sx,0,sz).normalize()});
});

// body accent strips + front LEDs
for(const z of [-.28,.28]){
  const st=new THREE.Mesh(new THREE.BoxGeometry(.60,.006,.010),matStrip);st.position.set(-.04,.062,z);product.add(st);
}
for(const z of [-.10,.10]){
  const led=new THREE.Mesh(new THREE.SphereGeometry(.012,10,8),matLED);led.position.set(.455,.05,z);product.add(led);
}

// legs
for(const sx of [-1,1])for(const sz of [-1,1]){
  const pts=[new THREE.Vector3(sx*.26,-.02,sz*.20),new THREE.Vector3(sx*.34,-.24,sz*.26),new THREE.Vector3(sx*.40,-.36,sz*.30)];
  tube(product,pts,.016,matMetal);
  const foot=new THREE.Mesh(new THREE.SphereGeometry(.03,12,10),matDark);foot.position.set(sx*.40,-.37,sz*.30);foot.scale.y=.55;product.add(foot);
}
// front vision sensors
for(const s of [-1,1]){
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.02,24),matMetal);ring.rotation.z=Math.PI/2;ring.position.set(.44,.04,s*.15);product.add(ring);
  const eye=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.01,24),matGlass);eye.rotation.z=Math.PI/2;eye.position.set(.452,.04,s*.15);product.add(eye);
}

// gimbal cable
{
  const pts=[new THREE.Vector3(.30,-.06,0),new THREE.Vector3(.36,-.12,.06),new THREE.Vector3(.43,-.17,.04)];
  const cg=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,.008,6,false);
  const cm=new THREE.Mesh(cg,new THREE.MeshStandardMaterial({color:0x090a0c,roughness:.7}));product.add(cm);
}

/* environment */
{
  const bg=canvasTex(512,512,(g,w,h)=>{const gr=g.createRadialGradient(w*.5,h*.42,0,w*.5,h*.42,w*.75);
    gr.addColorStop(0,'#0a1420');gr.addColorStop(.5,'#050b14');gr.addColorStop(1,'#02050a');g.fillStyle=gr;g.fillRect(0,0,w,h);});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(30,17),new THREE.MeshBasicMaterial({map:bg,depthWrite:false}));m.position.z=-8;scene.add(m);
}
{
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:0x02050a,roughness:1,metalness:.02}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.78;floor.receiveShadow=false;scene.add(floor);
  const ring=new THREE.Mesh(new THREE.RingGeometry(1.7,3.2,96),new THREE.MeshBasicMaterial({color:0xe3a25a,transparent:true,opacity:.035,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=-.775;ring.material.opacity=.012;scene.add(ring);
  const gridTex=canvasTex(512,512,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle='rgba(130,170,205,.28)';g.lineWidth=1;
    for(let i=0;i<=8;i++){const p=i*w/8;g.beginPath();g.moveTo(p,0);g.lineTo(p,h);g.stroke();g.beginPath();g.moveTo(0,p);g.lineTo(w,p);g.stroke();}},[6,6]);
  const grid=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshBasicMaterial({map:gridTex,transparent:true,opacity:.02,blending:THREE.AdditiveBlending,depthWrite:false}));
  grid.rotation.x=-Math.PI/2;grid.position.y=-.774;scene.add(grid);
}
// background glow
{
  const gt=canvasTex(512,512,(g,w,h)=>{const gr=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,'rgba(60,110,150,.18)');gr.addColorStop(.5,'rgba(40,70,90,.06)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:gt,color:0x9fd0e0,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false}));
  sp.scale.set(7,5,1);sp.position.set(0,.2,-3.2);scene.add(sp);
}

// particles
{
  const n=280,geo=new THREE.BufferGeometry(),pos=new Float32Array(n*3);
  for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*8;pos[i*3+1]=(Math.random()-.5)*4;pos[i*3+2]=-1.5+Math.random()*3;}
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  scene.add(new THREE.Points(geo,new THREE.PointsMaterial({color:0xbcd8ee,size:.007,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false})));
}
// lights
const key=new THREE.DirectionalLight(0xffd9b4,1.6);key.position.set(4,5,4);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;scene.add(key);
const fill=new THREE.DirectionalLight(0x7f9ec0,.9);fill.position.set(-5,2,3);scene.add(fill);
const rimA=new THREE.PointLight(0xff9f4d,18,15,2);rimA.position.set(-3.5,1.6,-2.2);scene.add(rimA);
const rimB=new THREE.PointLight(0x7fb6ff,18,14,2);rimB.position.set(3.4,-1,-1.8);scene.add(rimB);
const top=new THREE.SpotLight(0xfff0dc,12,18,.9,1,1.8);top.position.set(.3,5,1);scene.add(top);
const coolRim=new THREE.PointLight(0x7fb6ff,26,13,2);coolRim.position.set(2.8,1.2,-2.2);scene.add(coolRim);

if(T2){
  scene.background.set(0xe9eef3);scene.fog.color.set(0xe9eef3);scene.fog.density=.014;scene.environmentIntensity=.18;
  renderer.toneMappingExposure=.82;
  matBody.envMapIntensity=.45;matShell.envMapIntensity=.45;matMetal.envMapIntensity=.7;matCarbon.envMapIntensity=.45;matAccent.envMapIntensity=.5;
  scene.traverse(o=>{
    if(o.isMesh){
      const g=o.geometry;
      if(g&&g.type==='PlaneGeometry'){
        const w=g.parameters&&g.parameters.width;
        if(w===60){o.material.color.set(0xdfe6ec);o.material.roughness=.95;}
        else if(w===30&&g.parameters.height===17){o.visible=false;}
        else if(w===30&&g.parameters.height===30){o.material.opacity=.04;o.material.color.set(0x4a90b8);}
        else if(w===30){o.material.opacity=.06;o.material.color.set(0x4a90b8);}
        else if(w===2.6){o.material.opacity=.35;}
      }
      if(g&&g.type==='RingGeometry'){o.material.color.set(0x2f86b0);o.material.opacity=.06;}
    }
    if(o.isPoints)o.material.color.set(0x7aaac8);
    if(o.isSprite&&o.material&&o.material.map)o.visible=false;
  });
  key.intensity=2.0;key.color.set(0xfff2e2);fill.intensity=1.0;fill.color.set(0xbcd6ef);
  rimA.intensity=10;rimA.color.set(0x4fa8d8);rimB.intensity=10;rimB.color.set(0x8fd8ff);
  coolRim.intensity=20;top.intensity=10;
}

/* post */
const composer=new EffectComposer(renderer);composer.setPixelRatio(1);composer.setSize(W,H);
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(W,H),.28,.5,1.05);composer.addPass(bloom);
const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:{value:0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;varying vec2 vUv;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec2 uv=vUv;vec3 c=texture2D(tDiffuse,uv).rgb;float d=length((uv-.5)*vec2(1.,.92));float vig=smoothstep(.96,.2,d);c*=mix(.45,1.,vig);c*=vec3(1.03,1.,.955);float g=hash(uv*vec2(1920.,1080.)+uTime*57.);c+=(g-.5)*.006;gl_FragColor=vec4(max(c,0.),1.);}`});
composer.addPass(grade);composer.addPass(new OutputPass());

/* three-view inset: stacked CAD line views, flight animation */
const viewOff=document.createElement('canvas');viewOff.width=1860;viewOff.height=224;
const viewRenderer=new THREE.WebGLRenderer({canvas:viewOff,antialias:true,alpha:true});
viewRenderer.setPixelRatio(1);viewRenderer.setSize(1860,224,false);
viewRenderer.setClearColor(0x000000,0);viewRenderer.outputColorSpace=THREE.SRGBColorSpace;
const vw=620,vh=224,va=vw/vh;
const viewScene=new THREE.Scene();
const fh=.72,fw=fh*va,th=1.12,tw=th*va;
const vcams=[
  new THREE.OrthographicCamera(-fw,fw,fh,-fh,.1,30),
  new THREE.OrthographicCamera(-fw,fw,fh,-fh,.1,30),
  new THREE.OrthographicCamera(-tw,tw,th,-th,.1,30)
];
vcams[0].position.set(6,0,0);vcams[0].lookAt(0,0,0);vcams[0].up.set(0,1,0);
vcams[1].position.set(0,0,6);vcams[1].lookAt(0,0,0);vcams[1].up.set(0,1,0);
vcams[2].position.set(0,6,0);vcams[2].lookAt(0,0,0);vcams[2].up.set(0,0,-1);
const cadMat=new THREE.ShaderMaterial({uniforms:{uScan:{value:0},uTime:{value:0},uTint:{value:T2?new THREE.Color(0x2f9fd0):new THREE.Color(0x63e6a6)}},transparent:true,depthWrite:false,
  vertexShader:`varying vec3 vW;void main(){vec4 wp=modelMatrix*vec4(position,1.0);vW=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
  fragmentShader:`uniform float uScan;uniform float uTime;uniform vec3 uTint;void main(){float y=gl_FragCoord.y/224.0;float band=exp(-pow((y-uScan)*11.0,2.0));float flow=.84+.16*sin(gl_FragCoord.x*.05-uTime*4.0);vec3 base=uTint;vec3 hot=mix(uTint,vec3(1.0),.55);gl_FragColor=vec4(mix(base,hot,band*.9)*flow,.92);}`});
const cadGroup=new THREE.Group();const spinners=[];
product.updateMatrixWorld(true);
const isProp=(o)=>{let p=o;while(p){if(p.userData.partId==='prop')return true;p=p.parent;}return false;};
const mkLine=(mesh,parent,inv)=>{
  try{
    const eg=new THREE.EdgesGeometry(mesh.geometry,24);
    if(!eg.attributes.position.count)return;
    const ls=new THREE.LineSegments(eg,cadMat);
    if(inv)ls.matrix.copy(inv).multiply(mesh.matrixWorld);else ls.matrix.copy(mesh.matrixWorld);
    ls.matrixAutoUpdate=false;parent.add(ls);
  }catch(e){}
};

const rec=(o)=>{
  if(o.userData.noBox)return;
  if(o.isMesh&&o.geometry&&!isProp(o))mkLine(o,cadGroup,null);
  o.children.forEach(rec);
};
rec(product);
for(const arm of arms){
  const prop=arm.prop;prop.updateMatrixWorld(true);
  const pivot=new THREE.Vector3();prop.getWorldPosition(pivot);
  const sg=new THREE.Group();sg.position.copy(pivot);cadGroup.add(sg);
  const inv=new THREE.Matrix4().copy(prop.matrixWorld).invert();
  prop.traverse(o=>{if(o.isMesh&&o.geometry)mkLine(o,sg,inv);});
  spinners.push(sg);
}
const bb=new THREE.Box3().setFromObject(cadGroup);const cc=bb.getCenter(new THREE.Vector3());
cadGroup.position.set(-cc.x,-cc.y,-cc.z);
const cadRoot=new THREE.Group();cadRoot.add(cadGroup);viewScene.add(cadRoot);
// nose arrow (points +X)
{
  const pts=[new THREE.Vector3(.34,.09,0),new THREE.Vector3(.54,.09,0),new THREE.Vector3(.48,.12,.045),new THREE.Vector3(.54,.09,0),new THREE.Vector3(.48,.12,-.045)];
  const geo=new THREE.BufferGeometry().setFromPoints(pts);
  const ln=new THREE.Line(geo,cadMat);ln.matrixAutoUpdate=false;cadGroup.add(ln);
}
const vctx=[document.getElementById('vFront'),document.getElementById('vSide'),document.getElementById('vTop')].map(c=>c.getContext('2d'));
function renderViews(t=0){
  cadRoot.rotation.set(Math.sin(t*.7+1.0)*.022,0,.018+Math.sin(t*.9)*.030);
  cadRoot.position.y=Math.sin(t*1.25)*.012;
  cadMat.uniforms.uScan.value=(t*.27)%1.25;cadMat.uniforms.uTime.value=t;
  spinners.forEach((s,i)=>{s.rotation.y=t*(1.3+i*.08);});
  viewRenderer.setScissorTest(true);
  for(let i=0;i<3;i++){
    viewRenderer.setViewport(i*vw,0,vw,vh);viewRenderer.setScissor(i*vw,0,vw,vh);
    viewRenderer.render(viewScene,vcams[i]);
  }
  viewRenderer.setScissorTest(false);
  const sy=(((t*.27)%1.25))*vh;
  for(let i=0;i<3;i++){
    vctx[i].clearRect(0,0,vw,vh);
    vctx[i].drawImage(viewOff,i*vw,0,vw,vh,0,0,vw,vh);
    if(sy>=0&&sy<=vh){
      const gr=vctx[i].createLinearGradient(0,sy-16,0,sy+16);
      gr.addColorStop(0,'rgba(80,240,150,0)');gr.addColorStop(.5,'rgba(110,255,175,.18)');gr.addColorStop(1,'rgba(80,240,150,0)');
      vctx[i].fillStyle=gr;vctx[i].fillRect(0,sy-16,vw,32);
      vctx[i].strokeStyle='rgba(155,255,195,.8)';vctx[i].lineWidth=1;
      vctx[i].beginPath();vctx[i].moveTo(0,sy);vctx[i].lineTo(vw,sy);vctx[i].stroke();
    }
  }
}

/* part metadata */
const partInfo={
  airframe:{k:'PART 01 / AIRFRAME',h:'整机',e:'QUADCOPTER · 4 DUCTED ROTORS',d1:['700 g','TAKE-OFF'],d2:['45 min','FLIGHT TIME'],d3:['4 ×','DUCTED ROTORS'],d4:['3-axis','GIMBAL'],desc:'带圆形涵道保护圈的四翼机。拆解视图仅作结构示意，不代表真实产品；客户可上传自有 glTF / CAD。'},
  shell:{k:'PART 02 / SHELL',h:'上壳体',e:'CARBON SHELL',d1:['0.8 mm','WALL'],d2:['4 ×','QUICK LATCH'],d3:['碳纤维','MATERIAL'],d4:['-32%','WEIGHT'],desc:'一体化上壳体，覆盖电池与飞控；四角快拆卡扣，维护无需工具。'},
  battery:{k:'PART 03 / BATTERY',h:'智能电池',e:'4S SMART BATTERY',d1:['5000 mAh','CAPACITY'],d2:['45 min','ENDURANCE'],d3:['90 min','FAST CHARGE'],d4:['4S','VOLTAGE'],desc:'4S 锂电，内置 BMS；支持 PD 快充与低温自加热。'},
  duct:{k:'PART 04 / DUCT',h:'涵道保护圈',e:'DUCTED GUARD ×4',d1:['4 ×','UNITS'],d2:['12 m/s','WIND'],d3:['-4 dB','NOISE'],d4:['PP+CF','MATERIAL'],desc:'圆形涵道保护圈，包裹桨叶；降低噪声并提升抗风与近人安全性。'},
  motor:{k:'PART 05 / MOTOR',h:'无刷电机',e:'BRUSHLESS MOTOR ×4',d1:['9500 rpm','MAX'],d2:['8 m/s','CLIMB'],d3:['4 ×','UNITS'],d4:['FOC','DRIVE'],desc:'四颗无刷电机差速控制姿态；FOC 驱动，响应更快、效率更高。'},
  prop:{k:'PART 06 / PROP',h:'三叶螺旋桨',e:'LOW-NOISE PROP ×4',d1:['3','BLADES'],d2:['-4 dB','NOISE'],d3:['正反桨','PAIRING'],d4:['CF','MATERIAL'],desc:'三叶低噪桨，正反桨成对抵消反扭矩；碳纤维增强，刚度更高。'},
  gimbal:{k:'PART 07 / GIMBAL',h:'三轴云台',e:'3-AXIS GIMBAL',d1:['±0.01°','STABILITY'],d2:['3-axis','AXES'],d3:['4K','VIDEO'],d4:['双摄','DUAL LENS'],desc:'三轴机械增稳，双摄模组；抖动抑制到 ±0.01°，长曝光不糊。'},
  fc:{k:'PART 08 / CORE',h:'飞控 · 图传',e:'FLIGHT CONTROLLER',d1:['双 IMU','REDUNDANCY'],d2:['15 km','LINK'],d3:['1080p','VIDEO'],d4:['90 ms','LATENCY'],desc:'双 IMU 冗余 + 视觉定位；图传 15 km，端到端延迟 90 ms。'},
};
const partEls=[...document.querySelectorAll('.part')];
const dEl={k:document.getElementById('dK'),h:document.getElementById('dH'),e:document.getElementById('dE'),
  d1v:document.getElementById('d1v'),d1k:document.getElementById('d1k'),d2v:document.getElementById('d2v'),d2k:document.getElementById('d2k'),
  d3v:document.getElementById('d3v'),d3k:document.getElementById('d3k'),d4v:document.getElementById('d4v'),d4k:document.getElementById('d4k'),
  desc:document.getElementById('dD')};
let selected='airframe';
const nodeDefs=[['airframe','整机',0],['shell','上壳',10],['battery','电池',26],['duct','涵道',42],['motor','电机',55],['prop','桨',66],['gimbal','云台',78],['fc','飞控',90],['all','全拆',100]];
const nodesEl=document.getElementById('nodes');
nodeDefs.forEach(([id,name,pct])=>{
  const n=document.createElement('div');n.className='node';n.dataset.id=id;n.style.left=pct+'%';
  n.innerHTML='<i></i><span>'+name+'</span>';
  n.addEventListener('click',()=>{if(id!=='all'){selectPart(id);applyExplode(curE,0);composer.render();}});
  nodesEl.appendChild(n);
});
function updateNodes(e,id){
  document.querySelectorAll('.node').forEach(n=>{
    const on=e>.955?n.dataset.id==='all':n.dataset.id===id;
    n.classList.toggle('on',on);
  });
}

const partObjects={shell:topShell,battery:battery,duct:arms[0].duct,motor:arms[0].motor,prop:arms[0].prop,gimbal:gimbal,fc:fc};
const selBox=new THREE.Box3Helper(new THREE.Box3(),0xe3a25a);
selBox.visible=false;
const selRing=new THREE.Mesh(new THREE.TorusGeometry(.24,.006,8,48),new THREE.MeshBasicMaterial({color:0xe3a25a,transparent:true,opacity:.85,toneMapped:false}));
selRing.rotation.x=Math.PI/2;selRing.visible=false;scene.add(selRing);selBox.material.transparent=true;selBox.material.opacity=.6;scene.add(selBox);
function updateSelBox(){
  const obj=partObjects[selected];
  if(!obj){selBox.visible=false;selRing.visible=false;return;}
  // prop/motor: no bbox/ring — rotating blades make any highlight jitter
  if(selected==='prop'||selected==='motor'){selBox.visible=false;selRing.visible=false;return;}
  selRing.visible=false;
  const b=new THREE.Box3();
  const rec=(o)=>{if(o.userData.noBox)return; if(o.isMesh&&o.geometry){o.geometry.computeBoundingBox();const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);b.union(bb);} o.children.forEach(rec);};
  obj.updateWorldMatrix(true,true);rec(obj);
  selBox.box.copy(b);selBox.visible=true;
}
function setDetail(id){
  const d=partInfo[id];if(!d)return;
  dEl.k.textContent=d.k;dEl.h.textContent=d.h;dEl.e.textContent=d.e;
  dEl.d1v.textContent=d.d1[0];dEl.d1k.textContent=d.d1[1];dEl.d2v.textContent=d.d2[0];dEl.d2k.textContent=d.d2[1];
  dEl.d3v.textContent=d.d3[0];dEl.d3k.textContent=d.d3[1];dEl.d4v.textContent=d.d4[0];dEl.d4k.textContent=d.d4[1];
  dEl.desc.textContent=d.desc;
}
function selectPart(id, updateUI=true){
  selected=id;
  if(updateUI){
    partEls.forEach(el=>el.classList.toggle('on',el.dataset.id===id));
    setDetail(id);
    const vf=document.querySelector('.vf-label');if(vf){const info=partInfo[id];const m=info.k.match(/PART (\d+)/);vf.textContent=(m?m[1]:'01')+' / '+info.h+' · '+(info.e.split('·')[0].trim());}
    const a=anchors[id];
    if(a){tag.el.style.opacity='1';tagTarget=a;}
    else{tag.el.style.opacity='0';tagTarget=null;}
    updateSelBox();
  }
}
const anchors={
  shell:()=>topShell.localToWorld(new THREE.Vector3(0,.09,0)),
  battery:()=>battery.localToWorld(new THREE.Vector3(0,.05,0)),
  duct:()=>arms[0].duct.localToWorld(new THREE.Vector3(0,.08,0)),
  motor:()=>arms[0].motor.localToWorld(new THREE.Vector3(0,.09,0)),
  prop:()=>arms[0].prop.localToWorld(new THREE.Vector3(0,.02,0)),
  gimbal:()=>gimbal.localToWorld(new THREE.Vector3(0,-.12,0)),
  fc:()=>fc.localToWorld(new THREE.Vector3(0,.06,0)),
};
const tagsEl=document.getElementById('tags'),svg=document.getElementById('lines');
const tag={el:document.createElement('div'),line:document.createElementNS('http://www.w3.org/2000/svg','polyline')};
tag.el.className='tag';tag.el.innerHTML='<div class="card"><span id="tagK">PART</span><b id="tagN">部件</b></div>';
tagsEl.appendChild(tag.el);tag.line.setAttribute('fill','none');tag.line.setAttribute('stroke','rgba(227,162,90,.5)');tag.line.setAttribute('stroke-width','1');svg.appendChild(tag.line);
let tagTarget=null;
function updateTag(){
  if(!tagTarget){tag.el.style.opacity='0';tag.line.setAttribute('points','');return;}
  const v=tagTarget().clone().project(camera);
  if(v.z>1){tag.el.style.opacity='0';tag.line.setAttribute('points','');return;}
  const x=(v.x*.5+.5)*W,y=(-v.y*.5+.5)*H;
  const lx=Math.min(W-260,Math.max(260,x+90)),ly=y-36;
  tag.el.style.left=lx+'px';tag.el.style.top=ly+'px';tag.el.style.opacity='1';
  tag.line.setAttribute('points',`${lx-8},${ly} ${x},${y}`);
  document.getElementById('tagN').textContent=partInfo[selected]?.h||'部件';
  document.getElementById('tagK').textContent=(partInfo[selected]?.k||'').split('/')[0].trim();
}

/* explode */
let curE=0;
let demoMode=false;
function applyExplode(e,time=0){
  const shell=ss(e,.02,.34),batt=ss(e,.12,.42),armsP=ss(e,.28,.66),props=ss(e,.5,.82),gim=ss(e,.58,.9),core=ss(e,.74,1);
  topShell.position.y=.0+.52*shell;
  battery.position.y=.118+.92*batt;
  arms.forEach((a,i)=>{
    a.root.position.copy(a.dir).multiplyScalar(.24*armsP);a.root.position.y=.10*armsP;
    a.prop.position.y=.115+.26*props;a.prop.rotation.y=time*(1.6+i*.10)+i;
  });
  gimbal.position.set(.40+.62*gim,-.16-.18*gim,0);
  fc.position.y=.026+.34*core;
  product.rotation.y=-.40+Math.sin(time*.18)*.04;
  product.position.y=.008*Math.sin(time*.5);
  plumes.forEach(p=>p.group.visible=e<0.16);
  product.updateMatrixWorld(true);
}

function updateAirflow(t){
  for(const a of airflows){
    a.mat.uniforms.uTime.value=t;
    for(const [i,p] of a.puffs.entries()){
      const y=((t*.75+p.phase)%1);
      const ang=p.phase*6.283+t*1.4+y*4.2;
      const r=.09+.14*y;
      p.sp.position.set(Math.cos(ang)*r,-.012+y*.145,Math.sin(ang)*r);
      p.sp.material.opacity=(.035+.16*Math.sin(Math.PI*y));
      p.sp.scale.setScalar(.055+.075*y);
    }
    for(const st of a.streaks){
      const y=((t*1.35+st.phase)%1);
      const ang=st.ang+t*2.0+y*4.0;
      const r=.15+.08*y;
      const y2=Math.min(1,y+.035);
      const p1=new THREE.Vector3(Math.cos(ang)*r,-.012+y*.145,Math.sin(ang)*r);
      const p2=new THREE.Vector3(Math.cos(ang+.22)*r,-.012+y2*.145,Math.sin(ang+.22)*r);
      st.ln.geometry.setFromPoints([p1,p2]);
      st.ln.material.opacity=.10+.28*Math.sin(Math.PI*y);
    }
  }
  for(const p of plumes){
    for(const m of p.mats)m.uniforms.uTime.value=t;
    for(const [j,q] of p.puffs.entries()){
      const y=((t*.32+q.phase)%1);
      const ang=q.phase*6.283+t*1.1+y*6.0;
      const r=.05+.38*y;
      q.sp.position.set(Math.cos(ang)*r,-y*1.02,Math.sin(ang)*r);
      q.sp.material.opacity=.15*Math.sin(Math.PI*Math.min(1,y*1.05))+.01;
      q.sp.scale.setScalar(.13+.25*y);
    }
  }
}

/* camera */
let theta=-.62,phi=1.30,radius=4.05;const target=new THREE.Vector3(0,.08,0);
function updateCamera(){
  camera.position.set(target.x+radius*Math.sin(phi)*Math.cos(theta),target.y+radius*Math.cos(phi),target.z+radius*Math.sin(phi)*Math.sin(theta));
  camera.lookAt(target);
}

/* UI */
const ui={pct:document.getElementById('pct'),fill:document.getElementById('fill'),thumb:document.getElementById('thumb'),phase:document.getElementById('phase'),end:document.getElementById('endcard')};
function updateUI(e,t=0){
  ui.pct.textContent=String(Math.round(e*100)).padStart(2,'0')+'%';
  ui.fill.style.width=(e*100)+'%';ui.thumb.style.left=(e*100)+'%';
  const names=['整机形态','外部结构','结构展开','核心系统','元件级拆解'];
  let idx=0;if(e>.08)idx=1;if(e>.30)idx=2;if(e>.56)idx=3;if(e>.80)idx=4;
  ui.phase.innerHTML='当前：<b>'+names[idx]+'</b>';
  updateNodes(e,selected);
  const vp=document.getElementById('vPct');
  if(vp){vp.textContent=String(Math.round(e*100)).padStart(2,'0')+'%';document.getElementById('vFill').style.width=(e*100)+'%';const pi=partInfo[selected];document.getElementById('vName').textContent=(pi?pi.h:'整机')+' · '+(pi?pi.e.split('·')[0].trim():'AIRFRAME');}
  const endA=t>40.2?ss(t,40.2,41.2):0;
  ui.end.style.opacity=endA.toFixed(3);
  const chrome=1-endA;
  for(const sel of ['.brand','.stats','.parts','.detail','.ctrl','.viewsStack','.viewframe','.topbadge'])document.querySelector(sel).style.opacity=chrome.toFixed(3);
}

/* demo */
function demoE(t){
  if(t<5.8)return 0;
  if(t>=34&&t<38)return 1-ease(ss(t,34,38));
  if(t>=38)return 0;
  let i=0;for(let k=0;k<shots.length;k++)if(t>=shots[k].t)i=k;
  const cur=shots[i],prev=shots[Math.max(0,i-1)];
  const k=i===0?1:ss(t,cur.t,cur.t+.85);
  return lerp(prev.e??0,cur.e??0,k);
}
const shots=[
  {t:0,id:'airframe',theta:-.62,phi:1.28,r:4.15,e:0},
  {t:5.8,id:'airframe',theta:-.36,phi:1.20,r:3.95,e:0},
  {t:7.2,id:'shell',theta:-.45,phi:.92,r:3.35,e:.10},
  {t:10.0,id:'battery',theta:.05,phi:.88,r:3.15,e:.26},
  {t:13.0,id:'duct',theta:-1.05,phi:1.30,r:2.95,blend:.20,e:.42},
  {t:14.8,id:'motor',theta:-.72,phi:.95,r:3.80,center:true,e:.55},
  {t:17.6,id:'prop',theta:-.72,phi:.95,r:3.80,center:true,e:.66},
  {t:20.6,id:'gimbal',theta:.36,phi:1.22,r:4.10,center:true,e:.78},
  {t:23.8,id:'fc',theta:.02,phi:.88,r:3.85,center:true,e:.90},
  {t:27.7,id:'airframe',theta:-.45,phi:1.18,r:4.40,e:1},
  {t:34.0,id:'airframe',theta:-.22,phi:1.04,r:4.55,e:1}
];
function partCenter(id){
  if(id==='airframe')return new THREE.Vector3(0,.04,0);
  const obj=partObjects[id];if(!obj)return new THREE.Vector3(0,.04,0);
  const b=new THREE.Box3();
const rec=(o)=>{if(o.userData.noBox)return;if(o.isMesh&&o.geometry){o.geometry.computeBoundingBox();const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);b.union(bb);}o.children.forEach(rec);};
  obj.updateWorldMatrix(true,true);rec(obj);
  return b.getCenter(new THREE.Vector3());
}
function shotTarget(shot){
  const p=partCenter(shot.center?'airframe':shot.id);
  if(shot.blend){const c=partCenter('airframe');p.lerp(c,shot.blend);}
  return p;
}
function shotAt(t){
  let i=0;for(let k=0;k<shots.length;k++)if(t>=shots[k].t)i=k;
  const cur=shots[i],prev=shots[Math.max(0,i-1)];
  const k=i===0?1:ss(t,cur.t,cur.t+.9);
  const a=shotTarget(prev),b=shotTarget(cur);
  const p=a.clone().lerp(b,k);
  return {id:cur.id,target:p,theta:lerp(prev.theta,cur.theta,k),phi:lerp(prev.phi,cur.phi,k),radius:lerp(prev.r,cur.r,k)};
}
function renderAt(t){
  demoMode=true;
  const e=demoE(t);curE=e;applyExplode(e,t);
  const sh=shotAt(t);
  selectPart(sh.id);
  target.copy(sh.target);
  theta=sh.theta;phi=sh.phi;radius=sh.radius;
  updateCamera();updateAirflow(t);updateUI(e,t);updateSelBox();updateTag();
  bloom.strength=(T2?.18:.28)+.02*Math.sin(t*.6);grade.uniforms.uTime.value=t;
  composer.render();renderViews(t);
}
window.renderAt=renderAt;

/* interaction */
let dragging=false,lx=0,ly=0;
const canvas=renderer.domElement;canvas.style.pointerEvents='auto';
const ray=new THREE.Raycaster();const ndc=new THREE.Vector2();
canvas.addEventListener('pointerdown',e=>{dragging=true;lx=e.clientX;ly=e.clientY;});
canvas.addEventListener('pointerup',e=>{
  dragging=false;
  if(Math.abs(e.clientX-lx)+Math.abs(e.clientY-ly)>6)return;
  const cr=canvas.getBoundingClientRect();ndc.x=((e.clientX-cr.left)/cr.width)*2-1;ndc.y=-((e.clientY-cr.top)/cr.height)*2+1;
  ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObject(product,true).filter(h=>h.object.visible);
  if(hits.length){
    let o=hits[0].object;
    while(o&&!o.userData.partId)o=o.parent;
    if(o&&o.userData.partId)selectPart(o.userData.partId);
  }
});
canvas.addEventListener('pointermove',e=>{
  if(!dragging)return;
  theta-=(e.clientX-lx)*.006;phi=Math.min(1.45,Math.max(.65,phi-(e.clientY-ly)*.005));
  lx=e.clientX;ly=e.clientY;updateCamera();updateSelBox();updateTag();composer.render();
});
canvas.addEventListener('wheel',e=>{e.preventDefault();radius=Math.min(6,Math.max(2.6,radius+e.deltaY*.0012));updateCamera();updateTag();composer.render();},{passive:false});
// slider
const track=document.querySelector('.track');
function setEFromX(x){
  const r=track.getBoundingClientRect();curE=cl((x-r.left)/r.width);
  applyExplode(curE,0);updateUI(curE,0);updateTag();composer.render();
}
track.addEventListener('pointerdown',e=>{setEFromX(e.clientX);track.setPointerCapture(e.pointerId);});
track.addEventListener('pointermove',e=>{if(e.buttons)setEFromX(e.clientX);});
// parts
partEls.forEach(el=>el.addEventListener('click',()=>{selectPart(el.dataset.id);applyExplode(curE,0);composer.render();}));
// buttons
let anim=null;
function animateTo(targetE){
  cancelAnimationFrame(anim);const start=curE,t0=performance.now();
  const step=()=>{const k=Math.min(1,(performance.now()-t0)/1200);curE=lerp(start,targetE,ease(k));applyExplode(curE,performance.now()/1000);updateUI(curE,0);updateTag();composer.render();if(k<1)anim=requestAnimationFrame(step);};
  anim=requestAnimationFrame(step);
}
document.getElementById('autoBtn').addEventListener('click',()=>animateTo(1));
document.getElementById('resetBtn').addEventListener('click',()=>animateTo(0));
document.getElementById('uploadBtn').addEventListener('click',()=>document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change',e=>{const f=e.target.files[0];if(f)document.getElementById('uploadBtn').textContent='已接收 '+f.name.slice(0,10);});
document.getElementById('exportBtn').addEventListener('click',()=>{
  const data=JSON.stringify({format:'1017-teardown-v1',parts:Object.keys(partInfo)},null,1);
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.download='teardown-parts.json';a.click();
});

function loop(now){
  if(!demoMode){
    const t=now/1000;
    applyExplode(curE,t);updateAuto(1/60);updateAirflow(t);updateCamera();updateSelBox();updateTag();composer.render();renderViews(t);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function fitViewport(){
  const s=Math.max(innerWidth/1920,innerHeight/1080);
  const ox=(innerWidth-1920*s)/2, oy=(innerHeight-1080*s)/2;
  for(const id of ['stage','ui']){
    const el=document.getElementById(id);
    el.style.transformOrigin='0 0';
    el.style.transform=`translate(${ox}px,${oy}px) scale(${s})`;
  }
}
fitViewport();addEventListener('resize',fitViewport);

const fsBtn=document.getElementById('fsBtn');
fsBtn.addEventListener('click',async()=>{
  try{
    if(!document.fullscreenElement){await document.documentElement.requestFullscreen();fsBtn.textContent='退出全屏';}
    else{await document.exitFullscreen();fsBtn.textContent='全屏';}
  }catch(e){}
});
document.addEventListener('fullscreenchange',()=>{
  fsBtn.textContent=document.fullscreenElement?'退出全屏':'全屏';
  fitViewport();
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  composer.render();
});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();fitViewport();composer.render();});

/* init */
applyExplode(0,0);updateCamera();setDetail('airframe');updateTag();updateUI(0,0);
let autoParts=[],autoGroups=[],autoE=0,autoTarget=0,autoModel=null,autoExploded=false;
function updateAuto(dt){
  if(!autoModel)return;
  autoE+=(autoTarget-autoE)*Math.min(1,dt*4.0);
  for(const p of autoParts)if(!p.grouped)p.pivot.position.copy(p.base).addScaledVector(p.dir,autoE*0.36);
  for(const g of autoGroups)g.group.position.copy(g.base).addScaledVector(g.dir,autoE*0.36);
}
function loadExternalModel(url,explode=true){
  window.__modelReady=false;
  new GLTFLoader().load(url,g=>{
    const m=g.scene;const b=new THREE.Box3().setFromObject(m);const c=b.getCenter(new THREE.Vector3());const sz=b.getSize(new THREE.Vector3());
    const s=2.4/Math.max(sz.x,sz.y,sz.z);m.scale.setScalar(s);m.position.copy(c).multiplyScalar(-s);scene.add(m);
    product.visible=false;plumes.forEach(p=>p.group.visible=false);
    autoModel=m;autoParts=[];const meshes=[];m.updateMatrixWorld(true);
    m.traverse(o=>{if(o.isMesh)meshes.push(o);});
    const center=new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
    for(const mesh of meshes){
      const wc=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
      const dir=wc.clone().sub(center);if(dir.length()<1e-4)dir.set(0,1,0);dir.normalize();dir.y+=.35;dir.normalize();
      const pivot=new THREE.Group();pivot.position.copy(wc);scene.add(pivot);pivot.attach(mesh);
      const nm=(mesh.name||mesh.material?.name||('PART '+(autoParts.length+1))).replace(/_[A-Za-z0-9]+_\d+$/,'').replace(/\./g,' · ');
      autoParts.push({pivot,base:pivot.position.clone(),dir,name:nm});
    }
    m.visible=false;
    autoExploded=explode;autoE=explode?1:0;autoTarget=autoE;
    for(const p of autoParts)p.pivot.position.copy(p.base).addScaledVector(p.dir,autoE*.36);
    target.set(0,.12,0);radius=4.2;updateCamera();composer.render();
    window.parent.postMessage({type:'parts',parts:autoParts.map(p=>p.name)},'*');
    window.__setAuto=(v)=>{
      autoE=autoTarget=Math.max(0,Math.min(1,+v||0));
      for(const p of autoParts)if(!p.grouped)p.pivot.position.copy(p.base).addScaledVector(p.dir,autoE*0.36);
      for(const g of autoGroups)g.group.position.copy(g.base).addScaledVector(g.dir,autoE*0.36);
      composer.render();
    };
    window.__modelReady=true;
  });
}
function groupAuto(ids,name){
  const sel=ids.map(i=>autoParts[i]).filter(p=>p&&!p.grouped);if(!sel.length)return;
  const center=new THREE.Vector3();sel.forEach(p=>center.add(p.pivot.position));center.multiplyScalar(1/sel.length);
  const g=new THREE.Group();g.position.copy(center);scene.add(g);
  sel.forEach(p=>{g.attach(p.pivot);p.grouped=true;});
  autoGroups.push({group:g,base:g.position.clone(),dir:new THREE.Vector3(0,.5,0),name});
  window.parent.postMessage({type:'groups',groups:autoGroups.map(x=>({name:x.name,count:x.group.children.length}))},'*');
}
const params=new URLSearchParams(location.search);
const bgParam=params.get('bg');
function applyCustomBg(url){
  const probe=new Image();
  probe.onload=()=>{
    try{const c=document.createElement('canvas');c.width=32;c.height=18;const g=c.getContext('2d');g.drawImage(probe,0,0,32,18);const d=g.getImageData(0,0,32,18).data;let a=0;for(let i=0;i<d.length;i+=4)a+=(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722);a/=(d.length/4);document.body.classList.toggle('bg-dark',a<118);}catch(e){}
  };
  probe.src=url;
  new TextureLoader().load(url,t=>{
    t.colorSpace=THREE.SRGBColorSpace;scene.background=t;scene.fog=null;
    scene.traverse(o=>{
      if(!o.isMesh)return;
      const g=o.geometry;
      if(g&&g.type==='RingGeometry'){o.visible=false;return;}
      if(g&&g.type==='PlaneGeometry'){
        const w=g.parameters&&g.parameters.width;
        if(w&&w>3)o.visible=false;
      }
    });
  });
}
if(bgParam)applyCustomBg(bgParam);
const modelParam=params.get('model');
if(modelParam)loadExternalModel(modelParam,params.get('auto')==='1');
window.addEventListener('message',e=>{
  const d=e.data||{};
  if(d.type==='bg'&&d.url){applyCustomBg(d.url);}
  if(d.type==='model'&&d.url){loadExternalModel(d.url,d.explode!==false);}
  if(d.type==='group'&&Array.isArray(d.ids)){groupAuto(d.ids,d.name||'部件');}
  if(d.type==='autoexplode'){autoExploded=!autoExploded;autoE=autoExploded?1:0;autoTarget=autoE;for(const p of autoParts)p.pivot.position.copy(p.base).addScaledVector(p.dir,autoE*.36);composer.render();}
  if(d.type==='select'&&d.id){
    selectPart(d.id);applyExplode(curE,0);updateCamera();updateSelBox();updateTag();composer.render();
  }
});
window.ready=false;await document.fonts.ready;composer.render();renderViews(0);window.ready=true;
