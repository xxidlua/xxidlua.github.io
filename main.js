import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const $=s=>document.querySelector(s);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const hero=$('#hero'),stage=$('#stage'),dark=$('#dark'),typed=$('#typed'),caret=$('#caret'),flick=$('#flick');
function fitHero(){const w=innerWidth,h=innerHeight;hero.style.width=Math.min(w*0.92/0.552,h*0.72/0.4513)+'px'}
fitHero();addEventListener('resize',fitHero);
const pupils=[...document.querySelectorAll('.pupil')];
addEventListener('pointermove',e=>{for(const p of pupils){const r=p.ownerSVGElement.getBoundingClientRect();const dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);const a=Math.atan2(dy,dx),d=Math.min(1,Math.hypot(dx,dy)/160);p.setAttribute('cx',(Math.cos(a)*9*d).toFixed(2));p.setAttribute('cy',(Math.sin(a)*4.2*d).toFixed(2))}});

/* ---------- sound ---------- */
let AC=null;const buf={};
const b64ab=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u.buffer};
async function initAudio(){try{AC=new (window.AudioContext||window.webkitAudioContext)();await AC.resume();
  await Promise.all(Object.entries(window.SND||{}).map(async([k,v])=>{try{buf[k]=await AC.decodeAudioData(b64ab(v))}catch(e){}}))}catch(e){AC=null}}
function play(k,{vol=1,rate=1,loop=false}={}){if(!AC||!buf[k])return null;const s=AC.createBufferSource(),g=AC.createGain();s.buffer=buf[k];s.playbackRate.value=rate;s.loop=loop;g.gain.value=vol;s.connect(g).connect(AC.destination);s.start();return {s,g}}
window.__play=(k,o)=>play(k,o);
function fade(n,to,t){if(!n||!AC)return;const g=n.g.gain;g.cancelScheduledValues(AC.currentTime);g.setValueAtTime(g.value,AC.currentTime);g.linearRampToValueAtTime(to,AC.currentTime+t)}

/* ---------- film texture ---------- */
const fc=$('#film'),fx=fc.getContext('2d');let frames=[];
function sizeFilm(){fc.width=Math.ceil(innerWidth/3);fc.height=Math.ceil(innerHeight/3);frames=[];for(let k=0;k<6;k++){const im=fx.createImageData(fc.width,fc.height),d=im.data;for(let i=0;i<d.length;i+=4){const v=Math.random()*255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=Math.random()*26}frames.push(im)}}
sizeFilm();addEventListener('resize',sizeFilm);
let fi=0,lastF=0,scratch=null;
(function film(now){if(now-lastF>1000/18){lastF=now;fx.putImageData(frames[fi++%frames.length],0,0);const W=fc.width,H=fc.height;
  for(let k=0;k<3;k++)if(Math.random()<.35){fx.fillStyle=Math.random()<.5?'rgba(0,0,0,.55)':'rgba(255,250,235,.45)';fx.beginPath();fx.arc(Math.random()*W,Math.random()*H,Math.random()*1.6+.4,0,7);fx.fill()}
  if(Math.random()<.06){fx.strokeStyle='rgba(20,15,10,.35)';fx.lineWidth=.7;fx.beginPath();let x=Math.random()*W,y=Math.random()*H;fx.moveTo(x,y);for(let s=0;s<5;s++){x+=(Math.random()-.5)*8;y+=Math.random()*8;fx.lineTo(x,y)}fx.stroke()}
  if(!scratch&&Math.random()<.05)scratch={x:Math.random()*W,life:6+Math.random()*14};
  if(scratch){fx.fillStyle=`rgba(255,248,230,${.12+Math.random()*.15})`;fx.fillRect(scratch.x+=Math.random()-.5,0,.8,H);if(--scratch.life<=0)scratch=null}
  flick.style.opacity=(Math.random()*.035).toFixed(3)}requestAnimationFrame(film)})(0);

/* ---------- 3D velvet curtain ---------- */
const cv=$('#cloth');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0x000000,0);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.62;
const scene=new THREE.Scene();
const FOV=28,HH=4;const camera=new THREE.PerspectiveCamera(FOV,1,.1,60);camera.position.set(0,0,(HH/2)/Math.tan(THREE.MathUtils.degToRad(FOV/2)));
const tl=new THREE.TextureLoader();
const alb=tl.load(window.V_ALB||'v_alb.jpg');alb.colorSpace=THREE.SRGBColorSpace;
const nrm=tl.load(window.V_NRM||'v_nrm.jpg');
for(const t of[alb,nrm]){t.wrapS=THREE.MirroredRepeatWrapping;t.wrapT=THREE.ClampToEdgeWrapping;t.anisotropy=8}
const MATS={};function velvetFor(sd){return MATS['v'+sd]||(MATS['v'+sd]=Object.assign(mat.clone(),{side:sd}))}function liningFor(sd){return MATS['l'+sd]||(MATS['l'+sd]=new THREE.MeshStandardMaterial({color:0x1c0408,roughness:.95,side:sd}))}
const mat=new THREE.MeshPhysicalMaterial({map:alb,normalMap:nrm,normalScale:new THREE.Vector2(.24,.24),roughness:.45,metalness:0,specularIntensity:.6,specularColor:new THREE.Color('#ff4f93'),
  sheen:1,sheenColor:new THREE.Color('#c41f63'),sheenRoughness:.26,side:THREE.DoubleSide,color:0xffffff});
// lights
const amb=new THREE.HemisphereLight(0xffe9e0,0x200508,0.0);scene.add(amb);
const spot=new THREE.SpotLight(0xfff0dc,0,0,THREE.MathUtils.degToRad(9),.55,0);spot.position.set(0,.6,10);spot.target.position.set(0,-.1,0);
spot.castShadow=false;spot.shadow.mapSize.set(512,512);spot.shadow.bias=-.0004;spot.shadow.normalBias=.02;spot.shadow.radius=10;spot.shadow.blurSamples=16;scene.add(spot,spot.target);
const house=new THREE.DirectionalLight(0xfff0e0,0);house.position.set(.8,4.2,9);house.castShadow=true;house.shadow.mapSize.set(1024,1024);
house.shadow.camera.left=-9;house.shadow.camera.right=9;house.shadow.camera.top=4;house.shadow.camera.bottom=-4;house.shadow.camera.near=1;house.shadow.camera.far=20;house.shadow.bias=-.0005;house.shadow.normalBias=.03;house.shadow.radius=6;house.shadow.blurSamples=8;scene.add(house);
const foot=new THREE.DirectionalLight(0xffc98a,0);foot.position.set(0,-6,5);scene.add(foot);
const catcher=new THREE.Mesh(new THREE.PlaneGeometry(40,12),new THREE.ShadowMaterial({opacity:.13,color:0x2a1a14}));catcher.position.z=-.55;catcher.receiveShadow=true;scene.add(catcher);

// cloth: simulated ahead of time in a background worker, then played back
const WSRC="const HH=4;let _sd=7;const rnd=()=>(_sd=(_sd*16807)%2147483647)/2147483647;const RND=Array.from({length:37},()=>.85+rnd()*.3);const sim={};let halves=[];let target=0;let prof=null;\nlet tSim=0;const DUR=4.6;\nfunction buildSim(asp,small){\n  prof=null;\n  \n  const Wv=HH*asp/2;sim.Wv=Wv;\n  const railLen=Wv+.25;const nR=Math.max(10,Math.min(24,Math.round(railLen/0.28)));const K=4;\n  const cols=(nR-1)*K+1,rows=small?42:56;\n  const g=railLen/(nR-1);const fullness=1.75;const dx=g*fullness/K;const top=2.32,len=4.42;const dy=len/(rows-1);\n  Object.assign(sim,{floor:-2.14,nR,K,cols,rows,g,dx,dy,top,railLen,minGap:.055,lead0:-.03});\n  halves=[-1,1].map((side,hi)=>{\n    const n=cols*rows,p=new Float32Array(n*3),q=new Float32Array(n*3),w=new Float32Array(n);\n    const slackDepth=Math.sqrt(Math.max(0,(K*dx/2)**2-(g/2)**2));\n    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const k=j*cols+i,seg=Math.floor(i/K),m=i%K;\n      const jit=RND[seg%RND.length],x=sim.lead0+seg*g+(m/K)*g,z=(seg%2?1:-1)*slackDepth*jit*Math.sin(Math.PI*m/K);\n      p[k*3]=x;p[k*3+1]=top-j*dy;p[k*3+2]=z;w[k]=j>=rows-3?.22:(i===0?.55:1)}\n    q.set(p);\n    const C=[];const add=(a,b,r,st,mode)=>{const A=a*3,B=b*3;C.push(a,b,Math.hypot(p[B]-p[A],p[B+1]-p[A+1],p[B+2]-p[A+2]),st,mode)};// mode 0 both,1 stretch only\n    const dg=Math.hypot(dx,dy);\n    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const k=j*cols+i;\n      if(i<cols-1)add(k,k+1,dx,1,0);if(j<rows-1)add(k,k+cols,dy,1,0);\n      if(i<cols-1&&j<rows-1){add(k,k+cols+1,dg,.35,1);add(k+1,k+cols,dg,.35,1)}\n      if(i<cols-2)add(k,k+2,0,.55,0);if(j<rows-2)add(k,k+2*cols,2*dy,.9,0)}\n    return {side,p,q,w,C:new Float32Array(C),rings:new Float32Array(nR).map((_,r)=>sim.lead0+r*g),rv:new Float32Array(nR)}});\n  target=sim.lead0;for(let s=0;s<450;s++)step(1/180,0);\n}\nfunction ringsStep(h,dt){const {rings,rv}=h,{nR,minGap,g,railLen}=sim;\n  // lead ring: heavy carriage pulled by a spring toward the target\n  const kS=36,cD=9.5;rv[0]+=(kS*(target-rings[0])-cD*rv[0])*dt;\n  for(let r=1;r<nR;r++)rv[r]*=Math.exp(-3.2*dt);\n  for(let r=0;r<nR;r++)rings[r]+=rv[r]*dt;\n  // contact: a ring pushes the next one once they touch; fabric keeps them within one bay\n  for(let r=1;r<nR;r++){if(rings[r]<rings[r-1]+minGap){rings[r]=rings[r-1]+minGap;if(rv[r]<rv[r-1]){const m=(rv[r]+rv[r-1])/2;rv[r]=m*1.08;rv[r-1]=m*.96}}\n    if(rings[r]>rings[r-1]+g){rings[r]=rings[r-1]+g}}\n}\nfunction step(dt){tSim+=dt;const {cols,rows,K,top}=sim;\n  for(const h of halves){ringsStep(h,dt);const {p,q,w,C,rings}=h,n=w.length;\n    const G=-9.8*dt*dt;\n    for(let k=0;k<n;k++){const o=k*3;const vx=(p[o]-q[o])*.996,vy=(p[o+1]-q[o+1])*.996,vz=(p[o+2]-q[o+2])*.99;q[o]=p[o];q[o+1]=p[o+1];q[o+2]=p[o+2];p[o]+=vx;p[o+1]+=vy+G;p[o+2]+=vz}\n    for(let it=0;it<11;it++){\n      // heading tape: ring columns pinned to their ring, others held at rail height\n      for(let i=0;i<cols;i++){const o=i*3;p[o+1]=top;if(i%K===0){p[o]=rings[i/K];p[o+2]=0}}\n      for(let c=0;c<C.length;c+=5){const a=C[c]*3,b=C[c+1]*3,r=C[c+2],st=C[c+3];const dx=p[b]-p[a],dy=p[b+1]-p[a+1],dz=p[b+2]-p[a+2];const d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-6;\n        if(C[c+4]===1&&d<r)continue;const wa=w[C[c]],wb=w[C[c+1]];const f=(d-r)/(d*(wa+wb))*st;\n        p[a]+=dx*f*wa;p[a+1]+=dy*f*wa;p[a+2]+=dz*f*wa;p[b]-=dx*f*wb;p[b+1]-=dy*f*wb;p[b+2]-=dz*f*wb}\n      // keep fabric in front of the back wall\n      for(let k=0;k<n;k++){const o=k*3+2;if(p[o]<-.8)p[o]=-.8}\n    }\n    for(let i=0;i<cols;i++){const o=i*3;p[o+1]=top;if(i%K===0){p[o]=rings[i/K];p[o+2]=0}}\n    const F=sim.floor;for(let k=0;k<n;k++){const o=k*3;if(p[o+1]<F){p[o+1]=F;q[o]=p[o]-(p[o]-q[o])*.55;q[o+2]=p[o+2]-(p[o+2]-q[o+2])*.55;q[o+1]=F}}\n  }}\nfunction makeProf(){const N=Math.ceil((DUR+.4)*180),a=new Float32Array(N+1);let x=0,tot=0;const sp=[];\n  for(let i=0;i<=N;i++){const t=i/180,u=Math.min(1,Math.max(0,(t-.35)/DUR));let v=Math.sin(Math.PI*u);v*=1+.38*Math.sin(2*Math.PI*1.15*(t-.35))*Math.sin(Math.PI*u);sp.push(Math.max(0,v));tot+=Math.max(0,v)}\n  for(let i=0;i<=N;i++){x+=sp[i]/tot;a[i]=x}prof=a}\nfunction targetAt(t){if(!prof)makeProf();if(t<.35)return sim.lead0-.07*Math.sin(Math.PI*t/.35);const i=Math.min(prof.length-1,Math.round(t*180));return sim.lead0+prof[i]*(sim.Wv+.8)}\n\nfunction snap(){const n=sim.cols*sim.rows,out=new Float32Array(n*6);halves.forEach((h,hi)=>{const s=h.side,o=hi*n*3,p=h.p,zo=s>0?.03:0;for(let k=0;k<n;k++){out[o+k*3]=s*p[k*3];out[o+k*3+1]=p[k*3+1];out[o+k*3+2]=p[k*3+2]+zo}});return out}\nonmessage=e=>{const {asp,small,id}=e.data;buildSim(asp,small);postMessage({type:'meta',id,cols:sim.cols,rows:sim.rows,dx:sim.dx});\n  const f0=snap();postMessage({type:'frames',id,frames:[f0]},[f0.buffer]);\n  const steps=Math.ceil((DUR+.35+2.0)*180);let batch=[];\n  for(let s=1;s<=steps;s++){target=targetAt(s/180);step(1/180);if(s%6===0){batch.push(snap());if(batch.length>=8){postMessage({type:'frames',id,frames:batch},batch.map(b=>b.buffer));batch=[]}}}\n  if(batch.length)postMessage({type:'frames',id,frames:batch},batch.map(b=>b.buffer));postMessage({type:'done',id})};\n";
let worker=null,bakeId=0,cfr=[],baked=false,meta=null,meshes=[];
// the velvet has body: the lining sits a few mm behind the face and the hem / side edges are closed with a rim
const THK=.045;
function makeMeshes(){for(const m of meshes){scene.remove(m);m.geometry.dispose();const u=m.userData;if(u.lin){scene.remove(u.lin,u.rim);u.lin.geometry.dispose();u.rim.geometry.dispose()}}meshes=[];const {cols,rows,dx}=meta;
  [-1,1].forEach((side,hi)=>{const geo=new THREE.PlaneGeometry(1,1,cols-1,rows-1);const uv=geo.attributes.uv;
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const k=j*cols+i;uv.setXY(k,(i*dx)/8+hi*.41,1-j/(rows-1))}
    const front=side>0?THREE.FrontSide:THREE.BackSide,back=side>0?THREE.BackSide:THREE.FrontSide;
    const mesh=new THREE.Mesh(geo,velvetFor(front));mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;scene.add(mesh);
    const lgeo=geo.clone();const lin=new THREE.Mesh(lgeo,liningFor(back));lin.receiveShadow=true;lin.castShadow=true;lin.frustumCulled=false;scene.add(lin);
    // rolled rim along the hem and both vertical edges: front edge → bulge → lining edge
    const edges=[Array.from({length:cols},(_,i)=>(rows-1)*cols+i),Array.from({length:rows},(_,j)=>j*cols),Array.from({length:rows},(_,j)=>j*cols+cols-1)];
    const nbr=[edges[0].map(v=>v-cols),edges[1].map(v=>v+1),edges[2].map(v=>v-1)];
    const nV=edges.reduce((a,e)=>a+e.length*3,0),rp=new Float32Array(nV*3),ruv=new Float32Array(nV*2),ri=[];let o=0;
    for(const e of edges){for(let q=0;q<e.length;q++){const a=o+q*3;for(let r=0;r<3;r++){ruv[(a+r)*2]=uv.getX(e[q])+r*.003;ruv[(a+r)*2+1]=uv.getY(e[q])}
      if(q<e.length-1){const b=a+3;ri.push(a,a+1,b+1,a,b+1,b,a+1,a+2,b+2,a+1,b+2,b+1)}}o+=e.length*3}
    const rgeo=new THREE.BufferGeometry();rgeo.setAttribute('position',new THREE.BufferAttribute(rp,3));rgeo.setAttribute('uv',new THREE.BufferAttribute(ruv,2));rgeo.setIndex(ri);
    const rim=new THREE.Mesh(rgeo,MATS.rim||(MATS.rim=Object.assign(mat.clone(),{side:THREE.DoubleSide})));rim.castShadow=true;rim.receiveShadow=true;rim.frustumCulled=false;scene.add(rim);
    mesh.userData={lin,lgeo,rim,rgeo,edges,nbr,fac:side>0?-1:1};meshes.push(mesh)})}
let shown=-1;
function show(fi){if(!cfr.length||!meshes.length)return;fi=Math.max(0,Math.min(cfr.length-1,fi));if(fi===shown)return;shown=fi;
  const a=Math.floor(fi),b=Math.min(cfr.length-1,a+1),f=fi-a,A=cfr[a],B=cfr[b],n=meta.cols*meta.rows*3;
  meshes.forEach((m,hi)=>{const arr=m.geometry.attributes.position.array,o=hi*n;
    if(f<1e-4)for(let k=0;k<n;k++)arr[k]=A[o+k];else for(let k=0;k<n;k++){const v=A[o+k];arr[k]=v+(B[o+k]-v)*f}
    m.geometry.attributes.position.needsUpdate=true;m.geometry.computeVertexNormals();
    const U=m.userData,nr=m.geometry.attributes.normal.array,lp=U.lgeo.attributes.position.array,t=THK*U.fac;
    for(let k=0;k<n;k+=3){lp[k]=arr[k]+nr[k]*t;lp[k+1]=arr[k+1]+nr[k+1]*t;lp[k+2]=arr[k+2]+nr[k+2]*t}
    U.lgeo.attributes.position.needsUpdate=true;U.lgeo.attributes.normal.array.set(nr);U.lgeo.attributes.normal.needsUpdate=true;
    const rp=U.rgeo.attributes.position.array;let o2=0;
    U.edges.forEach((e,ei)=>{const nb=U.nbr[ei];for(let q=0;q<e.length;q++){const s=e[q]*3,w=nb[q]*3;
      let ox=arr[s]-arr[w],oy=arr[s+1]-arr[w+1],oz=arr[s+2]-arr[w+2];const ol=Math.hypot(ox,oy,oz)||1;ox/=ol;oy/=ol;oz/=ol;
      rp[o2]=arr[s];rp[o2+1]=arr[s+1];rp[o2+2]=arr[s+2];
      rp[o2+3]=(arr[s]+lp[s])/2+ox*THK*.55;rp[o2+4]=(arr[s+1]+lp[s+1])/2+oy*THK*.55;rp[o2+5]=(arr[s+2]+lp[s+2])/2+oz*THK*.55;
      rp[o2+6]=lp[s];rp[o2+7]=lp[s+1];rp[o2+8]=lp[s+2];o2+=9}});
    U.rgeo.attributes.position.needsUpdate=true;U.rgeo.computeVertexNormals()})}
function bake(){if(worker)worker.terminate();cfr=[];baked=false;shown=-1;const id=++bakeId;
  worker=new Worker(URL.createObjectURL(new Blob([WSRC],{type:'text/javascript'})));
  worker.onmessage=e=>{const d=e.data;if(d.id!==bakeId)return;
    if(d.type==='meta'){meta=d;makeMeshes()}else if(d.type==='frames'){for(const f of d.frames)cfr.push(f);if(shown<0)show(0)}else if(d.type==='done')baked=true};
  worker.postMessage({asp:innerWidth/innerHeight,small:innerWidth<700,id})}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
resize();bake();
let rzT=0;addEventListener('resize',()=>{resize();if(!opening){clearTimeout(rzT);rzT=setTimeout(bake,250)}});

const L={spot:0,house:0,foot:0,amb:0};
function applyLights(){spot.intensity=L.spot*11;house.intensity=L.house*3.2;foot.intensity=L.foot*.55;amb.intensity=L.amb*.35}
let opening=false,openT0=0,done=false,last=performance.now();
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;
  if(phase==='gate'||phase==='typing'||phase==='await-lights'){requestAnimationFrame(frame);return}
  if(opening){let fi=(now-openT0)/1000*30;
    if(fi>cfr.length-1){if(baked){if(!done){done=true;show(cfr.length-1);renderer.render(scene,camera);cv.style.display='none';phase='main'}return}openT0+=dt*1000;fi=cfr.length-1}
    show(fi)}else show(0);
  applyLights();renderer.render(scene,camera);requestAnimationFrame(frame)}
requestAnimationFrame(frame);

/* ---------- sequence ---------- */
const LINE='Thank you for coming to my exhibition';let phase='gate',proj=null;window.__phase=()=>phase;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function enter(){phase='typing';caret.classList.remove('blink');await initAudio();proj=play('proj',{vol:0,loop:true});fade(proj,.18,1.2);
  await wait(700);for(let i=0;i<LINE.length;i++){const ch=LINE[i];typed.textContent+=ch;
    play('k'+(Math.random()*10|0),ch===' '?{vol:.35,rate:.85}:{vol:.75,rate:.94+Math.random()*.12});
    await wait(ch===' '?150+Math.random()*90:(i===18?380:60+Math.random()*95))}
  await wait(260);play('bell',{vol:.55});caret.classList.add('blink');phase='await-lights'}
function lightsOn(){phase='lights';play('spot',{vol:.9});
  for(const [t,v] of [[430,1],[500,.06],[590,.85],[650,.3],[760,1]])setTimeout(()=>{L.spot=v;L.amb=v*.5;dark.style.opacity=v>.5?0:1-v*.6;if(v>.5)$('.type').classList.add('gone')},t);
  setTimeout(()=>fade(proj,.08,2),800);setTimeout(()=>{phase='await-open'},800)}
let bgm=null;function startMusic(){const a=$('#bgm');if(!a)return;try{if(AC){if(!bgm){const s=AC.createMediaElementSource(a),g=AC.createGain();g.gain.value=0;s.connect(g).connect(AC.destination);bgm={g}}
  a.play().catch(()=>{});const g=bgm.g.gain;g.cancelScheduledValues(AC.currentTime);g.setValueAtTime(0,AC.currentTime);g.linearRampToValueAtTime(.32,AC.currentTime+7)}else{a.volume=.3;a.play().catch(()=>{})}}catch(e){}}
function openCurtain(){if(!baked){setTimeout(openCurtain,150);return}phase='open';startMusic();stage.classList.add('open');opening=true;openT0=performance.now();play('curtain',{vol:.85});
  const t0=performance.now();(function hl(){const t=(performance.now()-t0)/1000;L.house=Math.min(1,.25+t*.6);L.foot=Math.min(1,t*.6);L.spot=Math.max(.0,1-t*.3);L.amb=.5+Math.min(.5,t*.3);if(t<2.6)requestAnimationFrame(hl)})();
  setTimeout(()=>{document.body.classList.add('lit');fade(proj,0,3)},1600)}
function onAct(){if(phase==='main')return;if(phase==='gate')enter();else if(phase==='await-lights')lightsOn();else if(phase==='await-open')openCurtain()}
let lastAct=0;const act=e=>{const t=performance.now();if(t-lastAct<450)return;lastAct=t;onAct()};addEventListener('pointerup',act);addEventListener('touchend',act,{passive:true});addEventListener('click',act);addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onAct()}});
// test hooks
window.__lights=o=>{Object.assign(L,o);applyLights();dark.style.opacity=0;$('.type').classList.add('gone')};
window.__run=secs=>{stage.classList.add('open');show(secs*30);applyLights();renderer.render(scene,camera)};window.__baked=()=>baked;window.__ready=()=>alb.image&&alb.image.complete;

/* ---------- the shredder: card goes down, the leaflet comes out in strips ---------- */
const cardEl=$('#card'),shredEl=$('#shred');const NS=16,IMG_H=1800,IMG_W=2880;
const V=300,DELAY=303,LEAF=1076;// image px per second, card travel before strips appear, leaflet height
const strips=[];for(let i=0;i<NS;i++){const d=document.createElement('div');d.className='st';d.style.left=(i*100/NS)+'%';d.style.width=(100/NS+.05)+'%';
  d.style.backgroundImage='url('+(window.LEAF||'leaflet.jpg')+')';d.style.backgroundSize=(NS*100)+'% 100%';d.style.backgroundPosition=(i/(NS-1)*100)+'% 0';
  d.style.filter=`brightness(${(0.95+Math.random()*.09).toFixed(3)})`;shredEl.appendChild(d);
  strips.push({d,lag:(Math.random()*2-1)*14,tilt:(Math.random()*2-1)*.9,ph:Math.random()*6.28,dir:(i-(NS-1)/2)/((NS-1)/2)})}
window.__shredStrips=strips;
let sh0=0,shift=0;
function startShred(){if(phase!=='main')return;phase='shred';document.body.classList.add('exit');hero.style.transition='none';play('shred',{vol:.85});window.__unlockSite&&window.__unlockSite();
  setTimeout(()=>{sh0=performance.now();requestAnimationFrame(shredFrame)},450)}
function shredFrame(now){const t=(now-sh0)/1000,trav=V*t;
  // card slides down at a constant speed inside the glass
  cardEl.style.transform=`translateY(${(trav/470*100).toFixed(3)}%)`;
  const e=Math.max(0,Math.min(LEAF,trav-DELAY)),f=e/LEAF;window.__shredE=e;
  shredEl.style.setProperty('--o',Math.min(1,e/60).toFixed(3));
  for(const s of strips){const ee=Math.max(0,Math.min(LEAF,e+s.lag*Math.min(1,f*4))),ff=ee/LEAF;
    const rot=(s.tilt*ff+Math.sin(t*1.4+s.ph)*.35*ff).toFixed(3),tx=(s.dir*ff*5).toFixed(2);
    s.d.style.transform=`translate(${tx}px,${(-(1-ff)*100).toFixed(3)}%) rotate(${rot}deg)`}
  // the frame stays put; it only trembles while the shredder runs
  const jit=(f>0&&f<1)?(Math.random()-.5)*.8:0;
  hero.style.translate=`${jit.toFixed(2)}px 0`;
  if(t<(DELAY+LEAF+40)/V+.6)requestAnimationFrame(shredFrame);else{phase='leaflet';hero.style.translate='0 0'}}
addEventListener('wheel',e=>{if(phase==='main'&&e.deltaY>6)startShred()},{passive:true});addEventListener('keydown',e=>{if(phase==='main'&&['ArrowDown','PageDown',' '].includes(e.key))startShred()});
let ty0=null;addEventListener('touchstart',e=>{ty0=e.touches[0].clientY},{passive:true});
addEventListener('touchmove',e=>{if(ty0!=null&&phase==='main'&&ty0-e.touches[0].clientY>24){ty0=null;startShred()}},{passive:true});
window.__skip=()=>{phase='main';document.body.classList.add('lit','exit');cv.style.display='none';dark.style.opacity=0;$('.type').classList.add('gone');stage.classList.add('open');hero.style.transition='none';sh0=performance.now()-30000;shredFrame(performance.now());window.__unlockSite&&window.__unlockSite()};
window.__shred=(t)=>{phase='main';document.body.classList.add('lit','exit');cv.style.display='none';dark.style.opacity=0;$('.type').classList.add('gone');stage.classList.add('open');hero.style.transition='none';sh0=performance.now()-t*1000;shredFrame(performance.now())};
