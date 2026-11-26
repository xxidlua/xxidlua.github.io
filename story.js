/*
  story.js — storyboard 2–13
  real 3D paper strips hang from the frame → zoom → they dissolve into black dots → the dots settle into the
  leaflet and the paper grows back exactly where they land → 3D leaflet with the card tucked in its back
  (mouse 360°) → top view → unfold → paper crumbles back into dots → five palette roses (click: the wall
  takes that colour) → back cover with the card → card slides out, leaflet sinks → card 360° → card folds.
  One scroll value u (viewport heights after the hanging strips) drives everything.
*/
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';
import Lenis from 'https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.mjs';

const $ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, v) => clamp((v - a) / (b - a));
const sst = (a, b, v) => { const t = inv(a, b, v); return t * t * (3 - 2 * t); };
const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const eo = t => 1 - Math.pow(1 - t, 3);
const eo5 = t => 1 - Math.pow(1 - t, 5);
const COARSE = matchMedia('(pointer:coarse)').matches;
const IV = '#F8F6F0';
const hexRGB = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

/* ---------- timeline (viewport heights after the strips finish hanging) ---------- */
const T = {
  zoom: [0, .8], burst: [.8, 1.3], drift: [1.3, 1.55], gatherF: [1.55, 2.6], solidF: [2.6, 3.1],
  holdF: [3.1, 4.0], top: [4.0, 4.8], unfold: [4.8, 5.8], holdS: [5.8, 6.2],
  dissS: [6.2, 6.9], gatherR: [6.9, 7.9], holdR: [7.9, 9.0],
  scatR: [9.0, 9.5], gatherB: [9.5, 10.5], solidB: [10.5, 11.0], holdB: [11.0, 11.4],
  pull: [11.4, 12.5], leave: [12.05, 12.8], cardC: [12.4, 13.0], holdC: [13.0, 13.8],
  fold: [13.8, 14.8], end: [14.8, 15.7],
  flipB: [15.7, 16.4], unfold2: [16.4, 17.3], hold2: [17.3, 17.8], dive: [17.8, 19.3], cave: [19.3, 28.3]
};
const LEN = 29.2;
const CAVE_N = 494;                                   // frames of the cave fly-through
const fr2u = f => T.cave[0] + f / (CAVE_N - 1) * (T.cave[1] - T.cave[0]);

/* ---------- sound cues (fired when the scroll crosses them, either way) ---------- */
const CUES = [  // paper sounds only — the dots stay silent
  [T.unfold[0] + .05, 'unfold', .7], [T.pull[0] + .15, 'slide', .8], [T.fold[0] + .08, 'fold', .85],
  [T.flipB[0] + .1, 'slide', .5], [T.unfold2[0] + .08, 'unfold', .6]
];
const cueLast = {};
function sfx(k, v) { const t = performance.now(); if (t - (cueLast[k] || 0) < 700) return; cueLast[k] = t; window.__play && window.__play(k, { vol: v }); }

/* ---------- page + scroll ---------- */
const hero = $('hero'), stage = $('stage'), shredEl = $('shred');
let E = 0, started = false, storyOn = false, lenis = null, spacer = null, u = -9, uPrev = -9;

function heroBox() {
  const w = hero.offsetWidth, h = w * 1800 / 2880;
  return { w, h, left: (innerWidth - w) / 2, top: (innerHeight - h) / 2, k: w / 2880 };
}
function measure() { const b = heroBox(); E = Math.max(0, b.top + (1497 + 1076) * b.k + 40 - innerHeight); }
function setSpacer() { if (spacer) spacer.style.height = (innerHeight + E + (storyOn ? LEN * innerHeight : 0)) + 'px'; }

window.__unlockSite = function () {
  if (started) return; started = true;
  measure();
  spacer = document.createElement('div'); spacer.id = 'after'; document.body.appendChild(spacer); setSpacer();
  document.documentElement.classList.add('scroll', 'story');
  lenis = new Lenis({ lerp: .085, wheelMultiplier: .85, touchMultiplier: 1.2 });
  init3D();
  requestAnimationFrame(loop);
};

/* stage transform: scroll the frame up, then zoom onto the strips (storyboard 2) */
const ST = { ox: 0, oy: 0, tx: 0, ty: 0, Z: 1 };
function updateStage(sy) {
  const b = heroBox();
  const sw = .26389 * b.w, sh = 1076 * b.k;
  const cx = b.left + .36875 * b.w + sw / 2, cy = b.top + .8317 * b.h + sh / 2 - E;
  const z = eio(inv(T.zoom[0], T.zoom[1], u));
  ST.Z = lerp(1, Math.min(.9 * innerHeight / sh, .8 * innerWidth / sw, 3.2), z);
  ST.ox = cx; ST.oy = cy + E;
  ST.tx = lerp(0, innerWidth / 2 - cx, z); ST.ty = -Math.min(sy, E) + lerp(0, innerHeight / 2 - cy, z);
  stage.style.transformOrigin = `${ST.ox}px ${ST.oy}px`;
  stage.style.transform = `translate3d(${ST.tx}px,${ST.ty}px,0) scale(${ST.Z})`;
  const bo = inv(T.burst[0] + .05, T.burst[0] + .3, u);
  stage.style.opacity = 1 - bo;
  stage.style.visibility = bo >= 1 ? 'hidden' : 'visible';
  shredEl.style.visibility = ok3D ? 'hidden' : 'visible';
  return b;
}
/* stage-local px → world (z = 0 plane, camera looking down −z) */
function st2w(x, y, z, out) {
  const sx = ST.ox + ST.tx + ST.Z * (x - ST.ox), sy = ST.oy + ST.ty + ST.Z * (y - ST.oy), k = vw / innerWidth;
  out[0] = (sx - innerWidth / 2) * k; out[1] = -(sy - innerHeight / 2) * k; out[2] = z * ST.Z * k;
}

/* ---------- pointer: mouse = full 360° across the screen, touch = horizontal drag ---------- */
let px = .5, py = .5, yaw = 0, pitch = 0, dragYaw = 0, tch = null;
const mouse = new THREE.Vector2(9, 9);
addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { px = e.clientX / innerWidth; py = e.clientY / innerHeight; }
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1));
  hoverRose(e.clientX, e.clientY);
});
addEventListener('touchstart', e => { const t = e.touches[0]; tch = { x: t.clientX, yaw: dragYaw }; mouse.set(t.clientX / innerWidth * 2 - 1, -(t.clientY / innerHeight * 2 - 1)); }, { passive: true });
addEventListener('touchmove', e => { if (!tch) return; const t = e.touches[0]; dragYaw = tch.yaw + (t.clientX - tch.x) / innerWidth * Math.PI * 2; mouse.set(t.clientX / innerWidth * 2 - 1, -(t.clientY / innerHeight * 2 - 1)); }, { passive: true });
addEventListener('touchend', () => { tch = null; setTimeout(() => mouse.set(9, 9), 400); }, { passive: true });

/* ---------- assets ---------- */
const PW = 1.4, PH = PW * 1124 / 789, TH = .006;            // A5 panel
const CW = PW * 90 / 148, CH = CW * 1021 / 919, CT = .0042;  // 90 × 100 mm card, 244 g
const CR = .0028, CC = CR * Math.PI, CL1 = CH / 2 + CC;      // crease radius / crease length: the print starts after the crease so the frame border stays whole and the edges meet when folded
const LR = .0035, LC = LR * Math.PI;                         // leaflet spine
const loader = new THREE.TextureLoader();
const tex = {};
const files = { front: 'lf_front.jpg', back: 'lf_back.jpg', kw: 'lf_kw.jpg', pi: 'lf_pi.jpg', oTop: 'cd_out_top.png', oBot: 'cd_out_bot.jpg', iTop: 'cd_in_top.png', iBot: 'cd_in_bot.jpg', roses: 'roses_mask.png' };
const ready = Promise.all(Object.entries(files).map(([k, f]) => loader.loadAsync(f).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; tex[k] = t; })));

/* ---------- shared dissolve noise (same values on the GPU and for every particle) ---------- */
const NZ = 256, NOISE = new Float32Array(NZ * NZ);
const noiseTex = (() => {
  let s = 77; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const oct = [[5, .5], [11, .28], [23, .14], [61, .08]], acc = new Float32Array(NZ * NZ);
  for (const [f, w] of oct) {
    const g = new Float32Array((f + 1) * (f + 1)); for (let i = 0; i < g.length; i++) g[i] = r();
    for (let y = 0; y < NZ; y++) for (let x = 0; x < NZ; x++) {
      const gx = x / NZ * f, gy = y / NZ * f, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), at = (a, b) => g[b * (f + 1) + a];
      acc[y * NZ + x] += w * lerp(lerp(at(ix, iy), at(ix + 1, iy), sx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), sx), sy);
    }
  }
  const idx = Array.from(acc.keys()).sort((a, b) => acc[a] - acc[b]); // rank → uniform 0..1
  const data = new Uint8Array(NZ * NZ * 4);
  idx.forEach((p, k) => { const v = Math.round(k / (idx.length - 1) * 255); data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = v; data[p * 4 + 3] = 255; NOISE[p] = v / 255; });
  const t = new THREE.DataTexture(data, NZ, NZ); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
})();
function noiseAt(u, v) { // v in GL convention (0 = bottom)
  const x = ((u % 1 + 1) % 1) * NZ - .5, y = ((v % 1 + 1) % 1) * NZ - .5, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const at = (a, b) => NOISE[((b + NZ) % NZ) * NZ + ((a + NZ) % NZ)];
  return lerp(lerp(at(ix, iy), at(ix + 1, iy), fx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), fx), fy);
}
const DIS = { uDis: { value: new THREE.Vector2(-1, 2) }, uNoise: { value: noiseTex } };   // leaflet + card
const SDIS = { uDis: { value: new THREE.Vector2(-1, 2) }, uNoise: { value: noiseTex } };  // strips
function dissolve(mat, U) {
  const hasMap = !!mat.map;
  mat.onBeforeCompile = s => {
    s.uniforms.uDis = U.uDis; s.uniforms.uNoise = U.uNoise;
    s.fragmentShader = 'uniform vec2 uDis;\nuniform sampler2D uNoise;\n' + s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_MAP
        float nz = texture2D(uNoise, vMapUv).r;
        if (nz < uDis.x || nz >= uDis.y) discard;
        float eg = min(nz - uDis.x, uDis.y - nz);
        diffuseColor.rgb *= 1. - (1. - smoothstep(0., .045, eg)) * .62;
      #else
        if (uDis.x > -.5 || uDis.y < 1.5) discard;
      #endif`);
  };
  mat.customProgramCacheKey = () => 'dis' + (hasMap ? 1 : 0) + (mat.isMeshDepthMaterial ? 'd' : '');
  return mat;
}
function depthFor(map, U, alphaTest = 0) {
  return dissolve(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest }), U);
}

/* ---------- paper surface: fibres + grain → normal map ---------- */
function paperNormal(size, fibres, grain, felt, seed) {
  let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
  if (felt) for (let i = 0; i < felt; i++) { const x = r() * size, y = r() * size, rad = 4 + r() * 16, l = r() < .5 ? 0 : 255; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${l},${l},${l},.10)`); gr.addColorStop(1, `rgba(${l},${l},${l},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  g.lineCap = 'round';
  for (let i = 0; i < fibres; i++) {
    const x = r() * size, y = r() * size, a = r() * Math.PI, L = 6 + r() * 26, l = r() < .5 ? 40 : 215;
    g.strokeStyle = `rgba(${l},${l},${l},${.12 + r() * .16})`; g.lineWidth = .5 + r() * 1.1;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .6) * L * .5, y + Math.sin(a + .6) * L * .5, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
  const id = g.getImageData(0, 0, size, size), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * grain; d[i] = d[i + 1] = d[i + 2] = clamp(d[i] + n, 0, 255); }
  const h = new Float32Array(size * size); for (let i = 0; i < h.length; i++) h[i] = d[i * 4] / 255;
  const out = g.createImageData(size, size), o = out.data, H = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 2.2, dy = (H(x, y + 1) - H(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1), p = (y * size + x) * 4;
    o[p] = (-dx / l * .5 + .5) * 255; o[p + 1] = (dy / l * .5 + .5) * 255; o[p + 2] = (1 / l * .5 + .5) * 255; o[p + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; return t;
}

/* ---------- 3D ---------- */
let DPR = 1.5, MY = 0, renderer, scene, camera, CZ = 9, vh = 1, vw = 1, sLeaf = 1, sTop = 1, sSpread = 1, sCard = 1, wall, swall;
let L, content, base, flap, anchor, cardG, cc, leafSheet, cardSheet, leafMats = [], cardMats = [], clip;
let pts, pGeo, pMat, N = COARSE ? 7000 : 13000, ok3D = false, nLeaf, nCard;
const strips = []; let stripMatF, stripMatB, stripPix;
const NS = 16, SEG = 40;

function sizes() {
  const a = innerWidth / innerHeight;
  camera.aspect = a; camera.updateProjectionMatrix();
  vh = 2 * CZ * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); vw = vh * a;
  sLeaf = Math.min(.6 * vh / PH, .76 * vw / PW);
  sTop = sLeaf * 1.12;
  const mob = a < .8; MY = mob ? .045 * vh : 0;          // on phones the objects sit a little higher, above the caption
  sSpread = Math.min(sTop, (mob ? .94 : .8) * vw / (2 * PW), .58 * vh / PH);
  sCard = Math.min(.64 * vh / CH, .78 * vw / CW);
  renderer.setSize(innerWidth, innerHeight, false);
  if (pMat) { pMat.uniforms.uAspect.value = a; pMat.uniforms.uPix.value = renderer.getPixelRatio(); }
}

function init3D() {
  const cv = $('story');
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !COARSE, alpha: true, powerPreference: 'high-performance' });
  cv.addEventListener('webglcontextlost', e => e.preventDefault());
  cv.addEventListener('webglcontextrestored', () => location.reload());
  renderer.setPixelRatio(DPR = Math.min(devicePixelRatio, COARSE ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.localClippingEnabled = true;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, .1, 60); camera.position.set(0, 0, CZ);
  sizes();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;

  scene.add(new THREE.AmbientLight(0xffffff, .5));
  const key = new THREE.DirectionalLight(0xfff3e4, 2.1); key.position.set(-2.6, 3.2, 6);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .5, far: 20 });
  key.shadow.radius = 7; key.shadow.blurSamples = 8; key.shadow.bias = -.0004; key.shadow.normalBias = .004;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe9ecff, .75); fill.position.set(2.5, -1, -5); scene.add(fill);
  wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: .15 }));
  wall.position.z = -1.7; wall.receiveShadow = true; scene.add(wall);
  swall = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: .2, color: 0x2a1c12 }));
  swall.receiveShadow = true; scene.add(swall);

  nLeaf = paperNormal(512, 2600, 26, 0, 11); nLeaf.repeat.set(2, 3);
  nCard = paperNormal(512, 900, 34, 1400, 23); nCard.repeat.set(1.4, .8);

  ready.then(() => { build(); ok3D = true; });
  addEventListener('resize', () => { sizes(); measure(); setSpacer(); if (ok3D) bakeStates(); });
}


/* ---------- one continuous sheet of paper with a real rounded crease ----------
   core space: s runs across the crease (s<0 fixed panel, s>0 moving panel), a runs along it.
   the moving panel wraps around a cylinder of radius R toward +Z ("inner" side) by angle phi. */
class FoldSheet {
  constructor({ W, L0, L1, t, R, place, uv, mats, rows1 = 12 }) {
    Object.assign(this, { W, L0, L1, t, R, place, uv });
    this.meshes = [this.make([-L0, -L0 / 2, 0], 0, mats[0]), this.make(this.movRows(rows1), 1, mats[1])];
    this.update(0);
  }
  movRows(n) { const cm = this.R * Math.PI, r = []; for (let i = 0; i <= n; i++) r.push(cm * i / n); r.push(cm + (this.L1 - cm) * .5, this.L1); return r; }
  core(s, phi, out) {
    const R = this.R, c = R * phi;
    if (s <= 0 || phi < 1e-5) { out[0] = s; out[1] = 0; out[2] = 0; out[3] = 1; return out; }
    if (s <= c) { const th = s / R; out[0] = R * Math.sin(th); out[1] = R * (1 - Math.cos(th)); out[2] = -Math.sin(th); out[3] = Math.cos(th); return out; }
    const px = R * Math.sin(phi), pz = R * (1 - Math.cos(phi)), d = s - c;
    out[0] = px + d * Math.cos(phi); out[1] = pz + d * Math.sin(phi); out[2] = -Math.sin(phi); out[3] = Math.cos(phi); return out;
  }
  make(rows, mov, mat) {
    const nA = 2, nR = rows.length, A = [-this.W / 2, this.W / 2], g = new THREE.BufferGeometry();
    const nv = nR * nA * 2 + nR * 2 * 2 + nA * 2;
    const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = [];
    let v = 0; const surf = [];
    for (const side of [1, -1]) { // 1 = inner, -1 = outer
      const base = v;
      for (let i = 0; i < nR; i++) for (let j = 0; j < nA; j++) { const [uu, vv] = this.uv(A[j], rows[i], side, mov); uv[v * 2] = uu; uv[v * 2 + 1] = vv; v++; }
      surf.push(base);
    }
    const gIn = idx.length;
    for (let i = 0; i < nR - 1; i++) { const a = surf[0] + i * nA, b = a + nA; idx.push(a, b, b + 1, a, b + 1, a + 1); }
    const gOut = idx.length;
    for (let i = 0; i < nR - 1; i++) { const a = surf[1] + i * nA, b = a + nA; idx.push(a, a + 1, b + 1, a, b + 1, b); }
    const gEdge = idx.length, walls = v;
    for (let j = 0; j < 2; j++) for (let i = 0; i < nR; i++) { v += 2; }
    for (let j = 0; j < 2; j++) for (let i = 0; i < nR - 1; i++) { const a = walls + (j * nR + i) * 2; idx.push(a, a + 2, a + 3, a, a + 3, a + 1); }
    const endW = v; v += nA * 2; idx.push(endW, endW + 2, endW + 3, endW, endW + 3, endW + 1);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    g.addGroup(gIn, gOut - gIn, 0); g.addGroup(gOut, gEdge - gOut, 1); g.addGroup(gEdge, idx.length - gEdge, 2);
    const m = new THREE.Mesh(g, mat); m.userData = { rows, mov, surf, walls, endW, nR, nA, A }; m.frustumCulled = false; return m;
  }
  update(phi) {
    if (this.phi === phi) return; this.phi = phi;
    const c = [0, 0, 0, 0], o = [0, 0, 0], ht = this.t / 2;
    for (const m of this.meshes) {
      const U = m.userData, P = m.geometry.attributes.position.array, put = (k, a, Y, Z) => { this.place(a, Y, Z, o); P[k * 3] = o[0]; P[k * 3 + 1] = o[1]; P[k * 3 + 2] = o[2]; };
      for (let i = 0; i < U.nR; i++) {
        this.core(U.rows[i], phi, c);
        for (let j = 0; j < U.nA; j++) {
          put(U.surf[0] + i * U.nA + j, U.A[j], c[0] + c[2] * ht, c[1] + c[3] * ht);
          put(U.surf[1] + i * U.nA + j, U.A[j], c[0] - c[2] * ht, c[1] - c[3] * ht);
        }
        for (let j = 0; j < 2; j++) { const k = U.walls + (j * U.nR + i) * 2; put(k, U.A[j], c[0] + c[2] * ht, c[1] + c[3] * ht); put(k + 1, U.A[j], c[0] - c[2] * ht, c[1] - c[3] * ht); }
      }
      const far = U.mov ? U.nR - 1 : 0; this.core(U.rows[far], phi, c);
      for (let j = 0; j < U.nA; j++) { const k = U.endW + j * 2; put(k, U.A[j], c[0] + c[2] * ht, c[1] + c[3] * ht); put(k + 1, U.A[j], c[0] - c[2] * ht, c[1] - c[3] * ht); }
      m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
    }
  }
  /* a point on one surface (side 1 inner / -1 outer), lifted off it by `off` */
  point(a, s, side, off, out) { const c = this.core(s, this.phi, [0, 0, 0, 0]), h = (this.t / 2 + off) * side; this.place(a, c[0] + c[2] * h, c[1] + c[3] * h, out); return out; }
}

/* a gently bowed sheet: thin box whose two faces follow the same warp */
function sheet(w, h, t, warp, sx = 18, sy = 24) {
  const g = new THREE.BoxGeometry(w, h, t, sx, sy, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + warp(p.getX(i) / (w / 2), p.getY(i) / (h / 2)));
  g.computeVertexNormals(); return g;
}
function paperMat(map, normal, ns, U, edgeCol) {
  const f = dissolve(new THREE.MeshStandardMaterial({ map, normalMap: normal, normalScale: new THREE.Vector2(ns, ns), roughness: .86, envMapIntensity: .38 }), U);
  return f;
}

function build() {
  /* leaflet: ONE sheet folded at the spine — base (inside: print info / outside: back cover) + flap (inside: keyword / outside: front cover) */
  L = new THREE.Group(); content = new THREE.Group(); L.add(content); scene.add(L);
  const edge = dissolve(new THREE.MeshStandardMaterial({ color: 0xece8de, roughness: .9, side: THREE.DoubleSide }), DIS);
  const pm = (map) => { const m = paperMat(map, nLeaf, .32, DIS); m.side = THREE.DoubleSide; return m; };
  leafSheet = new FoldSheet({
    W: PH, L0: PW, L1: PW + LC, t: TH, R: LR,
    place: (a, Y, Z, o) => { o[0] = -Y; o[1] = a; o[2] = Z; },
    uv: (a, sv, side, mov) => { const f = Math.max(0, sv - LC) / PW; return [mov ? (side > 0 ? 1 - f : f) : (side > 0 ? -sv / PW : 1 + sv / PW), a / PH + .5]; },
    mats: [[pm(tex.pi), pm(tex.back), edge], [pm(tex.kw), pm(tex.front), edge]]
  });
  [base, flap] = leafSheet.meshes;
  for (const m of [base, flap]) { content.add(m); m.castShadow = m.receiveShadow = true; const d = depthFor(tex.front, DIS); d.side = THREE.DoubleSide; m.customDepthMaterial = d; leafMats.push(...new Set(m.material)); }
  anchor = new THREE.Object3D(); content.add(anchor);

  /* card: ONE sheet of heavy textured stock folded across the middle — navy half (fixed) + window-frame half (moving, oval cut) */
  clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e3);
  const cm = (map, cut) => {
    const o = { map, roughness: .9, normalMap: nCard, normalScale: new THREE.Vector2(.55, .55), envMapIntensity: .4, clippingPlanes: [clip], clipShadows: true, side: THREE.DoubleSide }; if (cut) o.alphaTest = .5;
    return dissolve(new THREE.MeshStandardMaterial(o), DIS);
  };
  const ce = (c) => dissolve(new THREE.MeshStandardMaterial({ color: c, roughness: .85, clippingPlanes: [clip], clipShadows: true, side: THREE.DoubleSide }), DIS);
  cardSheet = new FoldSheet({
    W: CW, L0: CH / 2, L1: CL1, t: CT, R: CR, rows1: 14,
    place: (a, Y, Z, o) => { o[0] = a; o[1] = Y; o[2] = -Z; },
    uv: (a, sv, side, mov) => [side > 0 ? .5 - a / CW : .5 + a / CW, mov ? Math.max(0, sv - CC) / (CH / 2) : 1 + sv / (CH / 2)],
    mats: [[cm(tex.iBot), cm(tex.oBot), ce(0x1a1b33)], [cm(tex.iTop, true), cm(tex.oTop, true), ce(0x5a598b)]]
  });
  cardG = new THREE.Group(); cc = new THREE.Group(); cardG.add(cc); scene.add(cardG);
  const [cb, ct] = cardSheet.meshes;
  const dB = depthFor(tex.oBot, DIS), dT = depthFor(tex.oTop, DIS, .5); dB.side = dT.side = THREE.DoubleSide;
  cb.customDepthMaterial = dB; ct.customDepthMaterial = dT;
  for (const m of [cb, ct]) { cc.add(m); m.castShadow = m.receiveShadow = true; cardMats.push(...new Set(m.material)); }

  /* shredded strips: real bending paper, front cover outside / keyword page on the back */
  stripPix = pixels(tex.front.image, 316, 450);
  const kwM = tex.kw.clone(); kwM.wrapS = THREE.RepeatWrapping; kwM.repeat.x = -1; kwM.offset.x = 1; kwM.needsUpdate = true;
  stripMatF = dissolve(new THREE.MeshStandardMaterial({ map: tex.front, normalMap: nLeaf, normalScale: new THREE.Vector2(.3, .3), roughness: .86, envMapIntensity: .5, vertexColors: true, side: THREE.FrontSide }), SDIS);
  stripMatB = dissolve(new THREE.MeshStandardMaterial({ map: kwM, normalMap: nLeaf, normalScale: new THREE.Vector2(.3, .3), roughness: .86, envMapIntensity: .5, vertexColors: true, side: THREE.BackSide }), SDIS);
  let sd = 31; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < NS; i++) {
    const g = new THREE.BufferGeometry(), nv = 2 * (SEG + 1);
    const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), idx = [];
    for (let rr = 0; rr <= SEG; rr++) for (let c = 0; c < 2; c++) { const k = rr * 2 + c; uv[k * 2] = (i + c) / NS; uv[k * 2 + 1] = 1 - rr / SEG; }
    for (let rr = 0; rr < SEG; rr++) { const a = rr * 2, b = a + 1, c2 = a + 2, d = a + 3; idx.push(a, c2, d, a, d, b); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    const f = new THREE.Mesh(g, stripMatF), b = new THREE.Mesh(g, stripMatB);
    for (const m of [f, b]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.customDepthMaterial = depthFor(tex.front, SDIS); scene.add(m); }
    strips.push({ g, f, b, tw: (r() - .5) * 1.1, cu: (r() - .35) * 1.0, br: .94 + r() * .08, bow: (r() - .5) * .5 });
  }

  /* particles */
  pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(N).fill(1), 1).setUsage(THREE.DynamicDrawUsage));
  const ar = new Float32Array(N); for (let i = 0; i < N; i++) ar[i] = rnd();
  pGeo.setAttribute('aRand', new THREE.BufferAttribute(ar, 1));
  pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uSize: { value: COARSE ? 2.3 : 2.5 }, uPix: { value: renderer.getPixelRatio() }, uOp: { value: 1 }, uRepel: { value: 0 }, uMouse: { value: mouse }, uAspect: { value: innerWidth / innerHeight }, uCZ: { value: CZ }, uBg: { value: { r: .973, g: .965, b: .941 } }, uSwap: { value: 0 }, uPop: { value: 1 } },
    vertexShader: `
      attribute vec3 color; attribute float aRand; attribute float aAlpha;
      uniform float uSize,uPix,uOp,uRepel,uAspect,uCZ,uPop; uniform vec2 uMouse;
      varying vec3 vC; varying float vO;
      void main(){
        vec4 mv=modelViewMatrix*vec4(position,1.);
        vec4 cp=projectionMatrix*mv;
        vec2 n=cp.xy/cp.w; vec2 d=n-uMouse; d.x*=uAspect;
        float l=length(d); float f=uRepel*exp(-l*l/.018);
        vec2 dir=d/(l+1e-4); dir.x/=uAspect;
        n+=dir*f*.075*(.6+aRand*.8); cp.xy=n*cp.w; gl_Position=cp;
        gl_PointSize=uSize*uPix*uPop*(.55+aRand*.9)*(uCZ/max(.6,-mv.z))*(.45+.55*aAlpha);
        vC=color; vO=uOp*aAlpha;
      }`,
    fragmentShader: `
      uniform vec3 uBg; uniform float uSwap; varying vec3 vC; varying float vO;
      void main(){
        if(vO<.004) discard;
        vec2 c=gl_PointCoord-.5; float r=length(c); if(r>.5) discard;
        float a=(1.-smoothstep(.34,.5,r))*vO;
        vec3 col=vC;
        float lc=dot(col,vec3(.299,.587,.114)), lb=dot(uBg,vec3(.299,.587,.114));
        float near=(1.-smoothstep(.06,.22,distance(col,uBg)))*uSwap;
        col=mix(col, lb>.5? vec3(.09,.09,.16): vec3(.96,.93,.86), near);
        col=mix(col,col*.58,smoothstep(.2,.42,r)*smoothstep(.55,.85,lc)*.7);
        gl_FragColor=vec4(col,a);
      }`
  });
  pts = new THREE.Points(pGeo, pMat); pts.frustumCulled = false; pts.renderOrder = 2; scene.add(pts);
  initRand(); bakeStates();
}

/* ---------- strips: geometry follows main.js's shredder (extension e, per-strip lag / tilt / sway) ---------- */
const tmp3 = [0, 0, 0];
function stripPoint(s, i, cx, yl, b, out) {
  // cx: 0..1 across the strip, yl: 0..len along the strip element (top = hidden end)
  const P = s.P, len = P.len, d = Math.max(0, yl - P.hide), yy = P.hide + d, q = d / len;
  const th = s.tw * q, x0 = (cx - .5) * P.w;
  const lx = x0 * Math.cos(th) + s.bow * len * .04 * q * q, lz = x0 * Math.sin(th) + s.cu * len * .07 * q * q;
  const cr = Math.cos(P.rot), sr = Math.sin(P.rot);
  st2w(P.px + lx * cr - yy * sr, P.py + lx * sr + yy * cr, lz, out);
  return d;
}
function updateStrips(b, show) {
  const SS = window.__shredStrips, e = window.__shredE ?? 0;
  if (!SS || !show) { for (const s of strips) s.f.visible = s.b.visible = false; swall.visible = false; return; }
  const len = 1076 * b.k, sw = .26389 * b.w, left = b.left + .36875 * b.w, slot = b.top + .8317 * b.h, f = e / 1076;
  const kw = len / 1076;
  for (let i = 0; i < NS; i++) {
    const s = strips[i], p = SS[i];
    const ee = Math.max(0, Math.min(1076, e + p.lag * Math.min(1, f * 4))), ff = ee / 1076;
    const rot = (p.tilt * ff + Math.sin(clock * 1.4 + p.ph) * .35 * ff) * Math.PI / 180, txx = p.dir * ff * 5;
    s.P = { len, w: sw / NS * 1.004, hide: (1 - ff) * len, rot, px: left + (i + .5) * sw / NS + txx, py: slot - (1 - ff) * len };
    const pos = s.g.attributes.position.array, col = s.g.attributes.color.array;
    for (let r = 0; r <= SEG; r++) {
      const yl = r / SEG * len;
      for (let c = 0; c < 2; c++) {
        const k = r * 2 + c, d = stripPoint(s, i, c, yl, b, tmp3);
        pos[k * 3] = tmp3[0]; pos[k * 3 + 1] = tmp3[1]; pos[k * 3 + 2] = tmp3[2];
        const sh = (.48 + .52 * sst(0, 30 * kw * 2, d)) * s.br * (1 - .05 * sst(.85, 1, (yl) / len));
        col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = sh;
      }
    }
    s.g.attributes.position.needsUpdate = true; s.g.attributes.color.needsUpdate = true; s.g.computeVertexNormals();
    s.f.visible = s.b.visible = ee > 1;
  }
  // the wall the frame hangs on, a little behind the paper
  const k = vw / innerWidth; swall.visible = true; swall.position.set(0, 0, -26 * ST.Z * k);
}

/* ---------- particle states ---------- */
let seed = 1337; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const S = {}; let R, PH3, AX, BLACK, PAL, ROSE, roseCells = [];
const PALHEX = ['#0b1636', '#5a598b', '#efe3bf', '#c9ccd1', '#0d0f0c'];

function initRand() {
  R = new Float32Array(N); PH3 = new Float32Array(N * 3); AX = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    R[i] = rnd();
    for (let j = 0; j < 3; j++) { PH3[i * 3 + j] = rnd() * 6.283; AX[i * 3 + j] = rnd() * 2 - 1; }
  }
  BLACK = [.085, .08, .075];
  PAL = PALHEX.map(hexRGB);
}

function pixels(img, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}
/* weighted sampling of n points from an image; returns [u,v,r,g,b]* (v from the top) */
function sample(src, w, h, n, weight) {
  const d = src.data || pixels(src, w, h), W = new Float32Array(w * h);
  let tot = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x), p = i * 4, lum = (d[p] * .299 + d[p + 1] * .587 + d[p + 2] * .114) / 255;
    const q = x < w - 1 ? p + 4 : p, r = y < h - 1 ? p + w * 4 : p;
    const edge = Math.abs(d[p] - d[q]) / 255 + Math.abs(d[p + 1] - d[r + 1]) / 255;
    const bd = Math.min(x, y, w - 1 - x, h - 1 - y);
    tot += W[i] = Math.max(0, weight(lum, edge, bd, d[p + 3] / 255, x / w, y / h)); W[i] = tot;
  }
  const out = new Float32Array(n * 5);
  for (let k = 0; k < n; k++) {
    const t = rnd() * tot; let lo = 0, hi = W.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (W[m] < t) lo = m + 1; else hi = m; }
    const x = lo % w, y = (lo / w) | 0, p = lo * 4;
    out[k * 5] = (x + rnd()) / w; out[k * 5 + 1] = (y + rnd()) / h;
    out[k * 5 + 2] = d[p] / 255; out[k * 5 + 3] = d[p + 1] / 255; out[k * 5 + 4] = d[p + 2] / 255;
  }
  return out;
}
const paperW = (lum, edge, bd) => .3 + Math.pow(1 - lum, 1.5) * 2.2 + edge * 1.6 + (bd < 2 ? 1.6 : 0);

function setLeafPose(rx, ry, rz, s, open, x = 0, y = 0, z = 0) {
  L.position.set(x, y + MY, z); L.rotation.set(rx, ry, rz); L.scale.setScalar(s);
  leafSheet.update(Math.PI * (1 - open)); content.position.x = -PW / 2 * (1 - open);
  L.updateMatrixWorld(true);
}
const POSE_F = [-.3, .55, .06], POSE_B = [-.08, Math.PI - .2, .03];

function bakeStates() {
  seed = 4242;
  const v = new THREE.Vector3();
  const o3 = [0, 0, 0], toWorld = (a, sv, side, arr, i) => { leafSheet.point(a, sv, side, .004, o3); v.set(o3[0], o3[1], o3[2]).applyMatrix4(content.matrixWorld); arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; };
  const field = () => { const a = new Float32Array(N * 3); for (let i = 0; i < N; i++) { a[i * 3] = (rnd() - .5) * vw * 1.25; a[i * 3 + 1] = (rnd() - .5) * vh * 1.2; a[i * 3 + 2] = -2.4 + rnd() * 4; } return a; };
  S.fA = field(); S.fB = field();
  const keep = (name, n3) => { S[name] = new Float32Array(N * 3); S[name + 'C'] = new Float32Array(N * 3); S[name + 'N'] = new Float32Array(N); };
  const put = (name, i, sm, k, nz) => { S[name + 'C'][i * 3] = sm[k * 5 + 2]; S[name + 'C'][i * 3 + 1] = sm[k * 5 + 3]; S[name + 'C'][i * 3 + 2] = sm[k * 5 + 4]; S[name + 'N'][i] = nz; };

  // front cover, in the first 3D pose
  setLeafPose(...POSE_F, sLeaf, 0); keep('leafF');
  let sm = sample(tex.front.image, 158, 225, N, paperW);
  for (let i = 0; i < N; i++) { toWorld((.5 - sm[i * 5 + 1]) * PH, LC + sm[i * 5] * PW, -1, S.leafF, i); put('leafF', i, sm, i, noiseAt(sm[i * 5], 1 - sm[i * 5 + 1])); }

  // open spread (keyword | print info), flat top view
  setLeafPose(0, 0, 0, sSpread, 1); keep('spread');
  const h = N >> 1;
  sm = sample(tex.kw.image, 158, 225, h, paperW);
  for (let i = 0; i < h; i++) { toWorld((.5 - sm[i * 5 + 1]) * PH, LC + (1 - sm[i * 5]) * PW, 1, S.spread, i); put('spread', i, sm, i, noiseAt(sm[i * 5], 1 - sm[i * 5 + 1])); }
  sm = sample(tex.pi.image, 158, 225, N - h, paperW);
  for (let i = h; i < N; i++) { const k = i - h; toWorld((.5 - sm[k * 5 + 1]) * PH, -sm[k * 5] * PW, 1, S.spread, i); put('spread', i, sm, k, noiseAt(sm[k * 5], 1 - sm[k * 5 + 1])); }

  // back cover with the card's window frame on it
  const cw = 316, chh = Math.round(316 * PH / PW), c = document.createElement('canvas'); c.width = cw; c.height = chh;
  const g = c.getContext('2d'); g.drawImage(tex.back.image, 0, 0, cw, chh);
  const fw = cw * CW / PW, fh = chh * (CH / 2) / PH; g.drawImage(tex.oTop.image, (cw - fw) / 2, (chh - fh) / 2, fw, fh);
  setLeafPose(...POSE_B, sLeaf, 0); keep('leafB');
  sm = sample(g.getImageData(0, 0, cw, chh), cw, chh, N, paperW);
  for (let i = 0; i < N; i++) { toWorld((.5 - sm[i * 5 + 1]) * PH, (sm[i * 5] - 1) * PW, -1, S.leafB, i); put('leafB', i, sm, i, noiseAt(sm[i * 5], 1 - sm[i * 5 + 1])); }

  // five roses (palette), one row on wide screens, 3 + 2 on tall ones
  const mk = pixels(tex.roses.image, 700, 505); const rows = innerWidth / innerHeight < .8 ? 2 : 1;
  const Hr = rows === 1 ? Math.min(.6 * vh, (.9 * vw / 5) * 505 / 140 * .95) : Math.min(.34 * vh, (.92 * vw / 3) * 505 / 140 * .95);
  const Wr = Hr * 140 / 505, gap = rows === 1 ? Math.min(.9 * vw / 5, Wr * 1.5) : Math.min(.92 * vw / 3, Wr * 1.45);
  roseCells = [];
  for (let k = 0; k < 5; k++) {
    const row = rows === 1 ? 0 : (k < 3 ? 0 : 1), col = rows === 1 ? k : (k < 3 ? k : k - 3), cnt = rows === 1 ? 5 : (row ? 2 : 3);
    roseCells.push({ x: (col - (cnt - 1) / 2) * gap, y: rows === 1 ? .03 * vh : (row ? -.22 * vh : .16 * vh), w: Wr, h: Hr });
  }
  S.rose = new Float32Array(N * 3); S.roseC = new Float32Array(N * 3); ROSE = new Int8Array(N);
  const per = Math.floor(N / 5);
  for (let k = 0; k < 5; k++) {
    const o = new Uint8ClampedArray(140 * 505 * 4); for (let y = 0; y < 505; y++) for (let x = 0; x < 140; x++) { const s = (y * 700 + k * 140 + x) * 4, t = (y * 140 + x) * 4; o[t] = o[t + 1] = o[t + 2] = mk[s]; o[t + 3] = 255; }
    const cnt = k === 4 ? N - per * 4 : per;
    const s2 = sample({ data: o }, 140, 505, cnt, (lum) => lum > .5 ? 1 : 0);
    const rc = roseCells[k];
    for (let j = 0; j < cnt; j++) {
      const i = k * per + j;
      S.rose[i * 3] = rc.x + (s2[j * 5] - .5) * rc.w; S.rose[i * 3 + 1] = rc.y + (.5 - s2[j * 5 + 1]) * rc.h; S.rose[i * 3 + 2] = (rnd() - .5) * .14;
      const jit = (rnd() - .5) * .06; S.roseC[i * 3] = clamp(PAL[k][0] + jit); S.roseC[i * 3 + 1] = clamp(PAL[k][1] + jit); S.roseC[i * 3 + 2] = clamp(PAL[k][2] + jit);
      ROSE[i] = k;
    }
  }
  S.strip = null;
}

/* the strips as they hang right now → dots (positions on the bent paper, its colours, its dissolve value) */
function bakeStrip(b) {
  seed = 99;
  S.strip = new Float32Array(N * 3); S.stripC = new Float32Array(N * 3); S.stripN = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    let i, s, yl, cx, tries = 0;
    do { i = (rnd() * NS) | 0; s = strips[i]; cx = rnd(); yl = s.P.hide + rnd() * (s.P.len - s.P.hide); } while (s.P.len - s.P.hide < 2 && ++tries < 8);
    stripPoint(s, i, cx, yl, b, tmp3);
    S.strip[n * 3] = tmp3[0]; S.strip[n * 3 + 1] = tmp3[1]; S.strip[n * 3 + 2] = tmp3[2];
    const uu = (i + cx) / NS, vv = yl / s.P.len, px_ = Math.min(315, uu * 316 | 0), py_ = Math.min(449, vv * 450 | 0), p = (py_ * 316 + px_) * 4;
    S.stripC[n * 3] = stripPix[p] / 255; S.stripC[n * 3 + 1] = stripPix[p + 1] / 255; S.stripC[n * 3 + 2] = stripPix[p + 2] / 255;
    S.stripN[n] = noiseAt(uu, 1 - vv);
  }
}

/* ---- particle passes ---- */
const A_ = () => pGeo.attributes;
function flush() { const a = A_(); a.position.needsUpdate = a.color.needsUpdate = a.aAlpha.needsUpdate = true; }
function drift(P, j, tm, w) {
  P[j] += Math.sin(tm * .33 + PH3[j]) * .11 * w; P[j + 1] += Math.cos(tm * .29 + PH3[j + 1]) * .11 * w; P[j + 2] += Math.sin(tm * .23 + PH3[j + 2]) * .16 * w;
}
/* free morph between two states (staggered by order) */
function morph(A, B, g, o) {
  const a = A_(), P = a.position.array, C = a.color.array, Al = a.aAlpha.array, st = o.stag ?? .4, ease = o.ease || eio, ord = o.ord || R;
  const arc = o.arc || 0, dA = o.dA || 0, dB = o.dB || 0, cA = o.cA, cB = o.cB;
  for (let i = 0; i < N; i++) {
    const j = i * 3, ti = clamp(g * (1 + st) - ord[i] * st), e = ease(ti), s = Math.sin(Math.PI * e) * arc;
    P[j] = lerp(A[j], B[j], e) + AX[j] * s; P[j + 1] = lerp(A[j + 1], B[j + 1], e) + AX[j + 1] * s; P[j + 2] = lerp(A[j + 2], B[j + 2], e) + AX[j + 2] * s * .6;
    drift(P, j, o.time, lerp(dA, dB, e));
    const ce = o.cMix ? o.cMix(e, ti) : e;
    for (let q = 0; q < 3; q++) C[j + q] = lerp(cA.length > 3 ? cA[j + q] : cA[q], cB.length > 3 ? cB[j + q] : cB[q], ce);
    Al[i] = o.alpha ? o.alpha(i, ti) : 1;
  }
  flush();
}
/* paper → dots: each dot waits on the paper until the dissolve front reaches its own spot, then lifts off */
function peel(A, AC, AN, B, g, tm) {
  const a = A_(), P = a.position.array, C = a.color.array, Al = a.aAlpha.array, W = .55;
  for (let i = 0; i < N; i++) {
    const j = i * 3, gi = (AN[i] + .05) / 1.1 * W, ti = clamp((g - gi) / (1 - gi)), e = eo(ti), s = Math.sin(Math.PI * e) * .35;
    P[j] = lerp(A[j], B[j], e) + AX[j] * s; P[j + 1] = lerp(A[j + 1], B[j + 1], e) + AX[j + 1] * s; P[j + 2] = lerp(A[j + 2], B[j + 2], e) + AX[j + 2] * s * .6;
    drift(P, j, tm, e);
    const ce = clamp(ti * 2.6);
    for (let q = 0; q < 3; q++) C[j + q] = lerp(AC[j + q], BLACK[q], ce);
    Al[i] = sst(gi - .012, gi + .015, g);
  }
  flush();
  return clamp(g / W) * 1.1 - .05; // dissolve front for the paper
}
/* dots → paper: dots land in noise order, take the paper's colour, and fade exactly where the paper grows back */
function settle(A, B, BC, BN, g, rv, tm) {
  const a = A_(), P = a.position.array, C = a.color.array, Al = a.aAlpha.array, st = .55;
  for (let i = 0; i < N; i++) {
    const j = i * 3, ti = clamp(g * (1 + st) - BN[i] * st), e = eio(ti), s = Math.sin(Math.PI * e) * .45;
    P[j] = lerp(A[j], B[j], e) + AX[j] * s; P[j + 1] = lerp(A[j + 1], B[j + 1], e) + AX[j + 1] * s; P[j + 2] = lerp(A[j + 2], B[j + 2], e) + AX[j + 2] * s * .6;
    drift(P, j, tm, 1 - e);
    const ce = sst(.72, 1, e);
    for (let q = 0; q < 3; q++) C[j + q] = lerp(BLACK[q], BC[j + q], ce);
    Al[i] = 1 - sst(BN[i] - .03, BN[i] + .012, rv);
  }
  flush();
}

/* ---------- roses: click = wall colour + a soft bloom ---------- */
let roseBg = null, curBg = IV; const pulses = [-99, -99, -99, -99, -99];
const roseHold = () => u >= T.gatherR[1] - .15 && u < T.scatR[0] + .05;
function pickRose(x, y) {
  if (!ok3D || !roseHold()) return -1;
  const sx = v => (v / vw + .5) * innerWidth, sy = v => (-v / vh + .5) * innerHeight;
  for (let k = 0; k < 5; k++) { const r = roseCells[k]; if (Math.abs(x - sx(r.x)) < r.w / vw * innerWidth * .75 && Math.abs(y - sy(r.y)) < r.h / vh * innerHeight * .52) return k; }
  return -1;
}
function hoverRose(x, y) { if (!started) return; document.body.style.cursor = pickRose(x, y) >= 0 ? 'pointer' : ''; }
/* each rose is a piano key, left to right: do re mi fa sol (the sample is a C, 263 Hz → tuned to 261.63 Hz) */
const SCALE = [0, 2, 4, 5, 7];
addEventListener('pointerup', e => {
  const k = pickRose(e.clientX, e.clientY); if (k < 0) return; roseBg = PALHEX[k]; pulses[k] = clock;
  window.__play && window.__play('chime', { vol: .6, rate: .99437 * Math.pow(2, SCALE[k] / 12) });
});
function bloom(tm) {
  const P = A_().position.array;
  let any = false; for (const p of pulses) if (tm - p < 1.6) any = true;
  for (let i = 0; i < N; i++) {
    const k = ROSE[i], j = i * 3;
    P[j + 1] += Math.sin(tm * 1.1 + PH3[j]) * .006;
    if (!any) continue;
    const age = tm - pulses[k]; if (age < 0 || age > 1.6) continue;
    const p = age / 1.6, amp = Math.sin(Math.PI * Math.sqrt(p)) * (1 - p);
    const rc = roseCells[k], dx = P[j] - rc.x, dy = P[j + 1] - rc.y, a = amp * (.35 + R[i] * .5);
    P[j] = rc.x + dx * (1 + a * .55) + AX[j] * amp * .12;
    P[j + 1] = rc.y + dy * (1 + a * .3) + AX[j + 1] * amp * .12;
    P[j + 2] += AX[j + 2] * amp * .35;
  }
  A_().position.needsUpdate = true;
}


/* ---------- captions (museum wall labels) ---------- */
const CAPS = [
  ['shred', .06, .78], ['leaflet', T.holdF[0] + .02, T.top[0] - .02], ['dreamer', T.holdS[0] - .12, T.dissS[0] + .04],
  ['roses', T.gatherR[1] - .08, T.scatR[0] + .02], ['exhibit', T.holdB[0] - .06, T.pull[0] + .12],
  ['card', T.holdC[0] - .06, T.fold[0] + .04]
];
const capEls = {}, capOn = {}, capT = {};
document.querySelectorAll('.cap').forEach(el => { (capEls[el.dataset.k] ||= []).push(el); });
document.querySelectorAll('.shred-t').forEach(el => {          // titles are cut into vertical slices, like the strips
  const t = el.textContent, n = Math.max(10, Math.min(22, t.length + 4)); el.textContent = ''; el.setAttribute('aria-label', t);
  const g = document.createElement('span'); g.className = 'ghost'; g.textContent = t; el.appendChild(g);
  let sd = t.length * 97 + 13; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const sl = document.createElement('span'); sl.className = 'sl'; sl.textContent = t; sl.setAttribute('aria-hidden', 'true');
    sl.style.clipPath = `inset(-30% ${(100 - (i + 1) * 100 / n).toFixed(3)}% -30% ${(i * 100 / n - .05).toFixed(3)}%)`;
    sl.style.setProperty('--i', i); sl.style.setProperty('--r', (r() * 2 - 1).toFixed(2)); el.appendChild(sl);
  }
});
document.querySelectorAll('.cmyk .ck').forEach((el, i) => el.style.setProperty('--i', i));
let typing = null;
function typeThanks(on) {
  const el = $('thanks'); if (!el) return; clearInterval(typing); typing = null;
  if (!on) { el.textContent = ''; return; }
  const line = 'Thank you for looking.'; let k = 0; el.textContent = '';
  typing = setInterval(() => {
    const ch = line[k++]; el.textContent += ch;
    window.__play && window.__play('k' + (Math.random() * 10 | 0), ch === ' ' ? { vol: .25, rate: .85 } : { vol: .5, rate: .94 + Math.random() * .12 });
    if (k >= line.length) { clearInterval(typing); typing = null; }
  }, 95);
}
function captions() {
  for (const [k, a, b] of CAPS) {
    const on = storyOn && u >= a && u < b;
    if (on === !!capOn[k]) continue; capOn[k] = on; clearTimeout(capT[k]);
    for (const el of capEls[k] || []) {
      if (on) { el.classList.remove('out'); void el.offsetWidth; el.classList.add('on'); }
      else { el.classList.remove('on'); el.classList.add('out'); capT[k] = setTimeout(() => { for (const e of capEls[k]) e.classList.remove('out'); }, 800); }
    }
  }
  if (capOn.roses && roseCells.length) {   // ink values sit under each rose
    const cks = document.querySelectorAll('.cmyk .ck');
    roseCells.forEach((rc, i) => { const el = cks[i]; if (!el) return; el.style.left = ((rc.x / vw + .5) * innerWidth) + 'px'; el.style.top = ((-(rc.y - rc.h / 2) / vh + .5) * innerHeight + 10) + 'px'; });
  }
}

/* ---------- the cave: a scroll-scrubbed fly-through, first seen through the card's oval window ---------- */
const caveCv = $('cave'), cctx = caveCv.getContext('2d');
const CAVE_BG = '#0b0a10';
const OX = (.4924 - .5) * CW, OY = CC + .499 * CH / 2, RX = .3477 * CW, RY = .352 * CH / 2;   // the laser-cut oval, card-local
function caveSetName() { return innerWidth / innerHeight < 1 ? 'm' : innerWidth * devicePixelRatio >= 2200 ? 'hd' : 'd'; }
const CAVE_WIN = { hd: [5, 12], d: [8, 18], m: [8, 20] };   // decoded frames kept behind / ahead of the playhead
const CAVE = { set: null, blobs: [], req: [], bmp: [], live: new Set(), dec: 0, busy: 0, cur: 0 };
function caveLoad() {   // compressed frames, fetched at low priority, nearest-ahead first
  const set = caveSetName();
  if (CAVE.set !== set) { for (const k of CAVE.live) CAVE.bmp[k].close(); CAVE.live.clear(); Object.assign(CAVE, { set, blobs: [], req: [], bmp: [] }); }
  while (CAVE.busy < 4) {
    let i = -1;
    for (let k = Math.max(0, CAVE.cur - 2); k < CAVE_N; k++) if (!CAVE.req[k]) { i = k; break; }
    if (i < 0) for (let k = 0; k < CAVE_N; k++) if (!CAVE.req[k]) { i = k; break; }
    if (i < 0) return;
    CAVE.req[i] = 1; CAVE.busy++;
    fetch(`cave/${set}/${String(i + 1).padStart(4, '0')}.webp`, { priority: 'low' }).then(r => r.blob())
      .then(b => { if (CAVE.set === set) CAVE.blobs[i] = b; }).catch(() => { CAVE.req[i] = 0; })
      .finally(() => { CAVE.busy--; caveLoad(); });
  }
}
function caveDecode(c) {  // keep only a small window of decoded frames around the playhead (decoded off the main thread)
  CAVE.cur = c;
  const [wb, wa] = CAVE_WIN[CAVE.set] || [8, 18];
  for (const k of CAVE.live) if (k < c - wb || k > c + wa) { CAVE.bmp[k].close(); CAVE.bmp[k] = null; CAVE.live.delete(k); }
  for (let k = Math.max(0, c - 2); k <= Math.min(CAVE_N - 1, c + wa - 3) && CAVE.dec < 3; k++) {
    if (CAVE.bmp[k] || CAVE.bmp[k] === 0 || !CAVE.blobs[k]) continue;
    CAVE.bmp[k] = 0; CAVE.dec++; const set = CAVE.set;
    createImageBitmap(CAVE.blobs[k]).then(bm => { if (CAVE.set !== set) { bm.close(); return; } CAVE.bmp[k] = bm; CAVE.live.add(k); caveDirty = true; })
      .catch(() => { CAVE.bmp[k] = null; }).finally(() => { CAVE.dec--; });
  }
}
let caveDirty = true;
function caveNear(i) { for (let d = 0; d < 40; d++) { if (CAVE.bmp[i - d]) return i - d; if (CAVE.bmp[i + d]) return i + d; } return -1; }
/* f: fractional frame · z: zoom about the focal point (fx, fy in css px) · mx, my: parallax in css px */
function drawCave(f, z, fx, fy, mx, my) {
  const d = Math.min(devicePixelRatio, CAVE.set === 'hd' ? 2 : 1.5), W = Math.round(innerWidth * d), H = Math.round(innerHeight * d);
  if (caveCv.width !== W || caveCv.height !== H) { caveCv.width = W; caveCv.height = H; }
  const i0 = clamp(Math.floor(f), 0, CAVE_N - 1); caveDecode(i0); const a = caveNear(i0); if (a < 0) return;
  const b = a === i0 && CAVE.bmp[i0 + 1] ? i0 + 1 : -1, t = b > 0 ? f - i0 : 0;
  const im = CAVE.bmp[a], s1 = Math.max(W / im.width, H / im.height) * 1.05, w1 = im.width * s1, h1 = im.height * s1;
  const Fx = fx * d, Fy = fy * d, x = Fx + (W / 2 - w1 / 2 + mx * d - Fx) * z, y = Fy + (H / 2 - h1 / 2 + my * d - Fy) * z;
  cctx.globalAlpha = 1; cctx.drawImage(im, x, y, w1 * z, h1 * z);
  if (t > .02) { cctx.globalAlpha = t; cctx.drawImage(CAVE.bmp[b], x, y, w1 * z, h1 * z); cctx.globalAlpha = 1; }
}
const ovalPts = Array.from({ length: 56 }, (_, i) => { const th = i / 56 * Math.PI * 2; return [Math.cos(th) * RX * 1.012, Math.sin(th) * RY * 1.012]; });
const pv = new THREE.Vector3();
function toScreen(v) { v.project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }
function ovalClip(k) {   // k: how far the iris has opened inside the cut (0..1)
  cardG.updateMatrixWorld(true);
  return 'polygon(' + ovalPts.map(([x, y]) => { const [sx, sy] = toScreen(cc.localToWorld(pv.set(OX + x * k, OY + y * k, 0))); return `${sx.toFixed(1)}px ${sy.toFixed(1)}px`; }).join(',') + ')';
}
let caveMx = 0, caveMy = 0, lastCave = '', lastClip = '', last3D = '', perfT = 0, perfN = 0;


/* ---------- words in the cave: each line hangs at its own depth; scrolling flies you toward, into and past them ---------- */
const spaceEl = $('space');
const SPACE = [
  { k: 'name', a: T.dive[1] - .55, b: fr2u(160) },
  { k: 'fields', a: fr2u(120), b: fr2u(310), fly: true },
  { k: 'look', a: fr2u(318), b: fr2u(440) },
  { k: 'contact', a: fr2u(442), b: fr2u(493), stay: true }
].map(g => {
  const el = spaceEl.querySelector(`[data-k="${g.k}"]`);
  const words = [...el.querySelectorAll('.w')].map(w => ({ el: w, d: +(w.dataset.d || 0), x: +(w.dataset.x || 0), z: +(w.dataset.z || 0), last: '' }));
  const ticks = [...el.querySelectorAll('.tick')];
  return { ...g, el, words, ticks };
});
const ei = t => t * t * t;
function wordOp(z) { return sst(-1600, -950, z) * (1 - sst(320, 820, z)); }
let spaceKey = '';
function space() {
  const live = storyOn && u > SPACE[0].a - .05;
  spaceEl.classList.toggle('on', live);
  if (!live) return;
  const key = u.toFixed(4) + caveMx.toFixed(1) + caveMy.toFixed(1);
  if (key === spaceKey) return; spaceKey = key;
  spaceEl.style.perspectiveOrigin = `${50 + caveMx * .12}% ${50 + caveMy * .12}%`;
  for (const g of SPACE) {
    const p = (u - g.a) / (g.b - g.a), act = p > -.02 && (g.stay || p < 1.02);
    if (!act) { for (const w of g.words) if (w.last !== 'off') { w.last = 'off'; w.el.style.opacity = 0; } continue; }
    const q = clamp(p);
    if (g.fly) {   // three words on a depth grid: you pass them one by one
      const travel = -1300 + q * 3700;
      for (const w of g.words) {
        const z = w.z + travel, o = wordOp(z) * sst(0, .05, q) * (1 - sst(.95, 1, q));
        const t = `translate3d(0,0,${z.toFixed(1)}px)`, v = t + o.toFixed(3);
        if (v !== w.last) { w.last = v; w.el.style.transform = t; w.el.style.opacity = o; }
      }
      continue;
    }
    // a block: words come in scattered in depth, settle into one line, then scatter again as you pass through
    const zin = lerp(-1700, 0, eo(inv(0, .4, q))), hold = inv(.4, .66, q) * 70, zout = g.stay ? 0 : ei(inv(.66, 1, q)) * 1100;
    const Z = zin + hold + zout, spread = (1 - eo(inv(0, .42, q))) + (g.stay ? 0 : ei(inv(.66, 1, q)) * .8);
    for (const w of g.words) {
      const z = Z + w.d * spread, x = w.x * spread * 3, o = wordOp(z);
      const t = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px)`, v = t + o.toFixed(3);
      if (v !== w.last) { w.last = v; w.el.style.transform = t; w.el.style.opacity = o; }
    }
    const to = wordOp(Z) * sst(.3, .45, q) * (g.stay ? 1 : 1 - sst(.62, .72, q));   // registration ticks frame the block while it's in focus
    for (const tk of g.ticks) { tk.style.opacity = to; tk.style.transform = `translateZ(${Z.toFixed(1)}px) scale(${(1 + (1 - sst(.3, .45, q)) * .6).toFixed(3)})`; }
  }
}

/* ---------- frame ---------- */
let clock = 0, last = performance.now(), LP = [0, Math.PI, 0, 1];
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), qF = new THREE.Quaternion(), eul = new THREE.Euler();
function setOp(mats, o) { for (const m of mats) { const t = o < .999; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; } m.opacity = o; } }

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
  lenis.raf(now);
  if (!storyOn && window.__phase && window.__phase() === 'leaflet') { storyOn = true; setSpacer(); }
  const sy = lenis.animatedScroll ?? scrollY;
  uPrev = u; u = (sy - E) / innerHeight;
  const b = updateStage(sy);
  captions(); space();
  if (storyOn && window.__mix) window.__mix(sst(T.dive[0], T.cave[0] + .4, u));   // Satie fades into the dream lullaby as you enter the oval
  if (storyOn) for (const [th, k, v] of CUES) if ((uPrev < th) !== (u < th) && Math.abs(u - uPrev) < .6) sfx(k, v);

  const yt = COARSE ? dragYaw : (px - .5) * Math.PI * 2, pt = COARSE ? 0 : (py - .5) * .7;
  yaw += (yt - yaw) * Math.min(1, dt * 5); pitch += (pt - pitch) * Math.min(1, dt * 5);

  // wall colour
  const want = u >= lerp(T.dive[0], T.dive[1], .75) ? CAVE_BG : (u >= T.gatherR[0] && u < T.scatR[0] + .2 && roseBg) ? roseBg : IV;
  if (want !== curBg) {
    curBg = want; document.documentElement.style.background = want; document.body.style.background = want;
    const c = hexRGB(want); $('caps').classList.toggle('dark', c[0] * .299 + c[1] * .587 + c[2] * .114 < .55);
  }
  if (!ok3D) { renderer.render(scene, camera); return; }
  { const t = hexRGB(curBg), c = pMat.uniforms.uBg.value; c.r = t[0]; c.g = t[1]; c.b = t[2]; }
  pMat.uniforms.uSwap.value = curBg === IV ? 0 : 1;

  /* ---- strips (until they have crumbled) ---- */
  const gB = inv(...T.burst, u);
  updateStrips(b, u < T.burst[0] + (T.burst[1] - T.burst[0]) * .56);
  wall.visible = u >= T.burst[1] - .1 && u < T.flipB[0] + .25;

  /* ---- particles + dissolve fronts ---- */
  let vis = true, op = 1, rep = .7, pop = 1;
  const tm = clock;
  SDIS.uDis.value.set(-1, 2); DIS.uDis.value.set(-1, 2);
  if (u < T.burst[0]) { vis = false; S.strip = null; }
  else if (u < T.drift[0]) {
    if (!S.strip) bakeStrip(b);
    const d = peel(S.strip, S.stripC, S.stripN, S.fA, gB, tm);
    SDIS.uDis.value.set(d, 2); pop = 1 + Math.sin(Math.PI * clamp(gB * 1.4)) * .5; rep = gB;
  } else if (u < T.gatherF[0]) { morph(S.fA, S.fA, 0, { dA: 1, time: tm, cA: BLACK, cB: BLACK }); rep = 1; }
  else if (u < T.solidF[1]) {
    const g = inv(...T.gatherF, u), rv = inv(...T.solidF, u) * 1.1 - .05;
    settle(S.fA, S.leafF, S.leafFC, S.leafFN, g, rv, tm);
    DIS.uDis.value.set(-1, rv); rep = 1 - g * .8;
  } else if (u < T.dissS[0]) { vis = false; }
  else if (u < T.gatherR[0]) {
    const g = inv(...T.dissS, u);
    const d = peel(S.spread, S.spreadC, S.spreadN, S.fB, g, tm); DIS.uDis.value.set(d, 2); rep = g;
  } else if (u < T.scatR[0]) {
    const g = inv(...T.gatherR, u);
    morph(S.fB, S.rose, g, { stag: .45, arc: .35, dA: 1, dB: .12, time: tm, cA: BLACK, cB: S.roseC });
    bloom(tm); rep = 1.1;
  } else if (u < T.gatherB[0]) {
    const g = inv(...T.scatR, u);
    morph(S.rose, S.fA, g, { stag: .3, ease: eo, arc: .3, dA: .12, dB: 1, time: tm, cA: S.roseC, cB: BLACK }); rep = 1;
  } else if (u < T.solidB[1]) {
    const g = inv(...T.gatherB, u), rv = inv(...T.solidB, u) * 1.1 - .05;
    settle(S.fA, S.leafB, S.leafBC, S.leafBN, g, rv, tm);
    DIS.uDis.value.set(-1, rv); rep = 1 - g * .8;
  } else vis = false;
  pts.visible = vis; pMat.uniforms.uOp.value = op; pMat.uniforms.uRepel.value = rep; pMat.uniforms.uPop.value = pop;

  /* ---- leaflet ---- */
  const leafOn = (u >= T.solidF[0] && u < T.dissS[0] + (T.dissS[1] - T.dissS[0]) * .56) || (u >= T.solidB[0] && u < T.leave[1]);
  const lo = u >= T.solidB[0] ? 1 - inv(lerp(T.leave[0], T.leave[1], .7), T.leave[1], u) : 1;
  L.visible = leafOn && lo > .001;
  if (L.visible) {
    setOp(leafMats, lo);
    let rx, ry, rz, s = sLeaf, open = 0, x = 0, y = 0, z = 0;
    if (u < T.solidB[0]) {
      if (u < T.top[0]) {
        const w = eio(inv(T.holdF[0], T.holdF[0] + .35, u));
        [rx, ry, rz] = POSE_F; rx += pitch * w; ry += yaw * w;
      } else if (u < T.unfold[0]) {
        const e = eio(inv(...T.top, u));
        rx = lerp(POSE_F[0] + pitch, 0, e); ry = lerp(POSE_F[1] + yaw, 0, e); rz = lerp(POSE_F[2], 0, e); s = lerp(sLeaf, sTop, e);
      } else {
        const e = eio(inv(...T.unfold, u)), w = inv(T.holdS[0], T.holdS[0] + .3, u) * (1 - inv(...T.dissS, u));
        open = e; s = lerp(sTop, sSpread, e); rx = (py - .5) * .14 * w; ry = (px - .5) * .2 * w; rz = 0;
      }
      LP = [rx, ry, rz, s, open];
    } else {
      const e = eio(inv(T.pull[0], T.pull[1] - .3, u)), w = inv(T.holdB[0], T.holdB[0] + .25, u) * (1 - e);
      rx = lerp(POSE_B[0], 0, e) + (py - .5) * .3 * w; ry = lerp(POSE_B[1], Math.PI, e) + (px - .5) * .5 * w; rz = lerp(POSE_B[2], 0, e);
      s = lerp(sLeaf, sLeaf * 1.3, e);
      const lv = eio(inv(...T.leave, u)); y = -vh * .8 * lv; z = -1.1 * lv;
      LP = [rx, ry, rz, s, 0]; rx += lv * .5;
    }
    setLeafPose(rx, ry, rz, s, open, x, y, z);
  }
  if (u >= T.leave[1]) LP = [0, Math.PI, 0, sLeaf * 1.3, 0];

  /* ---- card: tucked into the back cover whenever the leaflet is there, then out on its own ---- */
  const cardOn = L.visible || u >= T.solidB[0];
  cardG.visible = cardOn;
  if (cardOn) {
    const back = u >= T.solidB[0];
    const sl = back ? eio(inv(T.pull[0] + .12, T.pull[1], u)) : 0;
    anchor.position.set(PW / 2, -CH / 4 + sl * (CH / 2 + .05), -(TH / 2 + CT / 2 + .0035) - sl * sl * .3);
    anchor.rotation.set(-Math.sin(Math.PI * sl) * .32, Math.PI, 0);
    const keepP = L.position.clone(), keepR = L.rotation.clone(), keepS = L.scale.x, keepO = leafSheet.phi, keepC = content.position.x;
    setLeafPose(LP[0], LP[1], LP[2], LP[3], LP[4] || 0);
    anchor.updateMatrixWorld(true);
    anchor.matrixWorld.decompose(tmpV, tmpQ, tmpS);
    if (sl < 1) {
      const n = new THREE.Vector3(0, 1, 0).applyQuaternion(L.getWorldQuaternion(new THREE.Quaternion()));
      const p = content.localToWorld(new THREE.Vector3(PW / 2, -CH / 4, 0));
      clip.setFromNormalAndCoplanarPoint(n, p);
    } else clip.set(new THREE.Vector3(0, 1, 0), 1e3);
    L.position.copy(keepP); L.rotation.copy(keepR); L.scale.setScalar(keepS); leafSheet.update(keepO); content.position.x = keepC; L.updateMatrixWorld(true);
    setOp(cardMats, back ? 1 : lo);
    const bb = back ? eio(inv(...T.cardC, u)) : 0, f0 = eio(inv(...T.fold, u));
    const fl = eio(inv(...T.flipB, u)), un = eio(inv(...T.unfold2, u)), f = f0 * (1 - un), dv = inv(...T.dive, u);
    let wU = inv(T.holdC[0], T.holdC[0] + .25, u) * (1 - f0);
    if (u >= T.end[0]) wU = inv(T.end[0], T.end[0] + .3, u) * (1 - inv(T.end[1] - .25, T.end[1], u));
    if (u >= T.unfold2[1]) wU = .2 * inv(T.unfold2[1], T.hold2[1], u) * (1 - inv(T.dive[0], T.dive[0] + .3, u));
    const arc = Math.sin(Math.PI * fl);   // the flip: lift, a little tilt, turn over
    eul.set(pitch * wU + arc * .2, yaw * wU + Math.PI * f0 + Math.PI * fl, arc * .07); qF.setFromEuler(eul);
    let sc = lerp(tmpS.x, sCard, bb);
    const tgt = new THREE.Vector3(0, MY, .25 + arc * .35);
    if (dv > 0) {   // fly into the oval: it grows until it swallows the screen, the cave behind it grows a little less
      const visH = 2 * (CZ - .25) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), visW = visH * camera.aspect;
      const need = Math.sqrt((visW / 2 / RX) ** 2 + (visH / 2 / RY) ** 2) * 1.06;
      const e = sst(0, 1, dv), c = sst(0, .4, dv);
      sc = sc * Math.exp(Math.log(need / sc) * e);
      tgt.set(lerp(0, -sc * OX, c), lerp(MY, -sc * OY, c), .25);
    }
    cardG.position.lerpVectors(tmpV, tgt, bb);
    cardG.quaternion.slerpQuaternions(tmpQ, qF, bb);
    cardG.scale.setScalar(sc);
    cardSheet.update(Math.PI * f);
    cc.position.y = CH / 4 * f;
    if (dv >= 1) cardG.visible = false;
  }

  /* ---- cave ---- */
  if (u > T.holdB[0] && CAVE.busy < 4) caveLoad();
  if (u > T.fold[0] && u < T.unfold2[1]) caveDecode(0);   // have the first frames decoded before the iris opens
  const caveOp = u >= T.unfold2[1] - .1 ? 1 : 0, iris = eo(inv(T.unfold2[1] - .1, T.hold2[0] + .3, u));
  if (caveOp > 0) {
    const dv = inv(...T.dive, u), e = sst(0, 1, dv);
    const fr = u < T.cave[0] ? 0 : clamp((u - T.cave[0]) / (T.cave[1] - T.cave[0])) * (CAVE_N - 1);
    const inCave = sst(T.dive[1] - .3, T.cave[0] + .3, u);
    caveMx += (((COARSE ? 0 : (.5 - px)) * 22 * inCave) - caveMx) * Math.min(1, dt * 3);
    caveMy += (((COARSE ? 0 : (.5 - py)) * 14 * inCave) - caveMy) * Math.min(1, dt * 3);
    let fx = innerWidth / 2, fy = innerHeight / 2;
    if (cardG.visible) { cardG.updateMatrixWorld(true); [fx, fy] = toScreen(cc.localToWorld(pv.set(OX, OY, 0))); }
    const zk = lerp(.5, 1, e), ck = [fr.toFixed(2), zk.toFixed(4), fx | 0, fy | 0, caveMx.toFixed(1), caveMy.toFixed(1), innerWidth, innerHeight].join();
    if (ck !== lastCave || caveDirty) { lastCave = ck; caveDirty = false; drawCave(fr, zk, lerp(fx, innerWidth / 2, e), lerp(fy, innerHeight / 2, e), caveMx, caveMy); }
    else caveDecode(clamp(Math.floor(fr), 0, CAVE_N - 1));
    const clipS = cardG.visible ? ovalClip(Math.max(.002, iris)) : 'none';
    if (clipS !== lastClip) { lastClip = clipS; caveCv.style.clipPath = clipS; }
    caveCv.style.opacity = caveOp;
  } else if (caveCv.style.opacity !== '0') caveCv.style.opacity = 0;

  const inCave = u >= T.dive[1];
  const key = [inCave ? 'cave' : u.toFixed(4), yaw.toFixed(4), pitch.toFixed(4), curBg, innerWidth, innerHeight].join();
  const animated = pts.visible || u < T.burst[1];
  if (animated || key !== last3D) { last3D = key; renderer.render(scene, camera); }
  // adaptive resolution: if frames are slow, render the 3D a bit softer
  perfT += dt; perfN++;
  if (perfN >= 90) { const ms = perfT / perfN * 1000; perfT = perfN = 0; if (ms > 24 && DPR > 1) { DPR = Math.max(1, DPR - .25); renderer.setPixelRatio(DPR); sizes(); last3D = ''; } }
}

/* test hook: jump to a story position (in viewport heights after the strips) */
window.__go = v => { const y = E + v * innerHeight; lenis.scrollTo(y, { immediate: true, force: true }); };
window.__T = T;
