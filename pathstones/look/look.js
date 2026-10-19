// ルックの試作（2026-10-19）。世界は 3D、操作は 2D（XZ の平面）。ターン制ではなくリアルタイム。
// 暗い野に灯りが点々。ブロックのムカデが動きまわり、頭の操縦席に敵の小人。灯りに照らされた所だけ、通った跡がうっすら見える。
// 小人（自分）はわなを置いてムカデをちょん切り、ブロックを拾うと自分のうしろにつながる。
// 配置と動きは乱数の種で固定。どのパターンでも同じ世界を、見た目だけ変えて見くらべる。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PATTERNS } from './patterns.js';

const qs = new URLSearchParams(location.search);
const KEY = (qs.get('p') || 'D5').toUpperCase(); // 2026-10-19 ユーザーが D、つづけて D5（操縦席を作りこむ）に決めた
const P = PATTERNS[KEY] || PATTERNS.D5;
const FIELD = 34; // 野の半分の広さ
const SP = 0.98; // 体節のあいだ

// ---------- 乱数（種で固定） ----------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(20261019);
const rr = (a, b) => a + (b - a) * R();

// ---------- 画面 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(P.bg);
scene.fog = new THREE.FogExp2(P.fog.color, P.fog.density);
const camera = new THREE.PerspectiveCamera(P.cam.fov, innerWidth / innerHeight, 0.1, 200);
let zoom = 1;

scene.add(new THREE.HemisphereLight(P.hemi.sky, P.hemi.ground, P.hemi.intensity));

// ---------- 材質 ----------
// 登場物（ムカデ・小人・わな）だけ見た目を変えられる。世界は A のまま、登場物は D のように読みやすく、などを試すため
let ACTOR = 0;
const actor = f => (...a) => { ACTOR++; try { return f(...a); } finally { ACTOR--; } };
const isToon = () => P.toon || (ACTOR > 0 && P.actorToon);
let gradient = null;
if (P.toon || P.actorToon) {
  const d = new Uint8Array([40, 40, 40, 255, 130, 130, 130, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
}
function mat(color, o = {}) {
  if (isToon()) return new THREE.MeshToonMaterial({ color, gradientMap: gradient, emissive: o.emissive || 0, emissiveIntensity: o.ei ?? 1 });
  return new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, emissive: o.emissive || 0, emissiveIntensity: o.ei ?? 1, flatShading: !!o.flat });
}
const glow = (color, ei = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(ei), toneMapped: true });
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.BackSide });
function outline(mesh, s = 1.07) {
  if (!(P.outline || (ACTOR > 0 && P.actorOutline))) return mesh;
  const o = new THREE.Mesh(mesh.geometry, OUTLINE);
  o.scale.setScalar(1 + (s - 1) * (P.outlineK ?? 1)); // outlineK でふちどりの太さを振る
  mesh.add(o);
  return mesh;
}
function M(geo, material, shadow = true) { const m = new THREE.Mesh(geo, material); m.castShadow = shadow; m.receiveShadow = true; return m; }

// ---------- 地面（手続きの絵） ----------
function groundCanvas(g) {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = g.base; x.fillRect(0, 0, 1024, 1024);
  const r2 = rng(7);
  const blob = (col, n, rmin, rmax, a) => { x.fillStyle = col; for (let i = 0; i < n; i++) { x.globalAlpha = a * (0.4 + r2() * 0.6); x.beginPath(); x.arc(r2() * 1024, r2() * 1024, rmin + r2() * (rmax - rmin), 0, 7); x.fill(); } x.globalAlpha = 1; };
  if (g.kind === 'dirt') {
    blob(g.dark, 260, 10, 70, 0.25); blob(g.light, 500, 2, 14, 0.35); blob(g.accent, 40, 30, 110, 0.35); blob(g.dark, 2500, 1, 3, 0.5);
  } else if (g.kind === 'wood') {
    const w = 128;
    for (let i = 0; i < 1024 / w; i++) {
      x.fillStyle = i % 2 ? g.base : g.light; x.globalAlpha = 0.35; x.fillRect(i * w, 0, w, 1024); x.globalAlpha = 1;
      for (let k = 0; k < 40; k++) { x.strokeStyle = g.dark; x.globalAlpha = 0.15 + r2() * 0.2; x.lineWidth = 1 + r2() * 2; x.beginPath(); const sx = i * w + r2() * w; x.moveTo(sx, 0); for (let y = 0; y <= 1024; y += 64) x.lineTo(sx + Math.sin(y * 0.01 + k) * 6, y); x.stroke(); }
      x.globalAlpha = 1; x.fillStyle = g.accent; x.fillRect(i * w, 0, 3, 1024);
      x.fillRect(i * w, ((i * 377) % 1024), w, 3);
    }
  } else if (g.kind === 'moss') {
    blob(g.dark, 300, 10, 80, 0.3); blob(g.light, 900, 2, 10, 0.4); blob(g.accent, 400, 1, 3, 0.35);
  } else if (g.kind === 'ink') {
    blob(g.dark, 200, 20, 120, 0.25); blob(g.light, 120, 10, 60, 0.18);
    for (let i = 0; i < 1400; i++) { x.strokeStyle = r2() < 0.5 ? g.light : g.dark; x.globalAlpha = 0.25; x.lineWidth = 1; x.beginPath(); const a = r2() * 1024, b = r2() * 1024, t = r2() * 7; x.moveTo(a, b); x.lineTo(a + Math.cos(t) * 18, b + Math.sin(t) * 18); x.stroke(); }
    x.globalAlpha = 1;
  }
  return c;
}
{
  const cv = groundCanvas(P.ground);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(P.ground.repeat, P.ground.repeat); tex.anisotropy = 8;
  const bump = new THREE.CanvasTexture(cv); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.copy(tex.repeat);
  const gm = P.toon ? new THREE.MeshToonMaterial({ map: tex, gradientMap: gradient })
    : new THREE.MeshStandardMaterial({ map: tex, bumpMap: bump, bumpScale: P.ground.bump, roughness: P.ground.rough });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(FIELD * 2 + 30, FIELD * 2 + 30), gm);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
}

// ---------- 灯り ----------
const lamps = [];
{
  let tries = 0;
  while (lamps.length < 24 && tries++ < 4000) {
    const p = new THREE.Vector2(rr(-FIELD + 4, FIELD - 4), rr(-FIELD + 4, FIELD - 4));
    if (lamps.every(l => l.p.distanceTo(p) > 9)) lamps.push({ p });
  }
  lamps.sort((a, b) => a.p.length() - b.p.length());
}
function lampModel(kind) {
  const g = new THREE.Group();
  const L = P.lamp;
  if (kind === 'lantern') {
    const post = outline(M(new THREE.CylinderGeometry(0.06, 0.08, 1.9, 8), mat(L.metal, { rough: 0.6, metal: 0.6 }))); post.userData.post = true;
    post.position.y = 0.95; g.add(post);
    const arm = M(new THREE.BoxGeometry(0.5, 0.05, 0.05), mat(L.metal, { metal: 0.6, rough: 0.6 })); arm.position.set(0.22, 1.85, 0); g.add(arm);
    const cage = M(new THREE.CylinderGeometry(0.16, 0.2, 0.36, 6, 1, true), new THREE.MeshStandardMaterial({ color: L.metal, metalness: 0.6, roughness: 0.5, wireframe: true }), false); cage.position.set(0.44, 1.6, 0); g.add(cage);
    const cap = M(new THREE.ConeGeometry(0.24, 0.16, 6), mat(L.metal, { metal: 0.6, rough: 0.5 })); cap.position.set(0.44, 1.86, 0); g.add(cap);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), glow(L.color, 4)); flame.position.set(0.44, 1.6, 0); g.add(flame);
    g.userData.lightPos = new THREE.Vector3(0.44, 1.55, 0);
    g.userData.flame = flame;
  } else if (kind === 'candle') {
    const wax = outline(M(new THREE.CylinderGeometry(0.22, 0.25, 0.9, 16), mat(L.metal, { rough: 0.5 }))); wax.userData.post = true;
    wax.position.y = 0.45; g.add(wax);
    const drip = M(new THREE.TorusGeometry(0.2, 0.05, 6, 16), mat(L.metal, { rough: 0.5 })); drip.rotation.x = Math.PI / 2; drip.position.y = 0.88; g.add(drip);
    const plate = M(new THREE.CylinderGeometry(0.5, 0.55, 0.06, 20), mat('#8a6a3a', { metal: 0.8, rough: 0.35 })); plate.position.y = 0.03; g.add(plate);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 10), glow(L.color, 2.2)); flame.position.y = 1.08; g.add(flame);
    g.userData.lightPos = new THREE.Vector3(0, 1.25, 0);
    g.userData.flame = flame;
  } else if (kind === 'mushroom') {
    const r3 = rng(lamps.length * 13 + 5);
    for (let i = 0; i < 4; i++) {
      const s = i === 0 ? 1 : 0.35 + r3() * 0.4;
      const a = r3() * 7, d = i === 0 ? 0 : 0.5 + r3() * 0.5;
      const stem = M(new THREE.CylinderGeometry(0.07 * s, 0.11 * s, 1.1 * s, 8), mat(L.metal, { rough: 0.6, emissive: L.color, ei: 0.08 }));
      stem.position.set(Math.cos(a) * d, 0.55 * s, Math.sin(a) * d); stem.userData.post = true; g.add(stem);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.45 * s, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), glow(L.color, i === 0 ? 0.8 : 0.6));
      cap.position.set(stem.position.x, 1.1 * s, stem.position.z); cap.scale.y = 0.55; g.add(cap);
      if (i === 0) g.userData.flame = cap;
    }
    g.userData.lightPos = new THREE.Vector3(0, 1.2, 0);
  } else if (kind === 'paper') {
    const pole = outline(M(new THREE.CylinderGeometry(0.04, 0.05, 2.1, 6), mat(L.metal))); pole.userData.post = true;
    pole.position.set(-0.3, 1.05, 0); g.add(pole);
    const arm = M(new THREE.BoxGeometry(0.62, 0.04, 0.04), mat(L.metal)); arm.position.set(0, 2.05, 0); g.add(arm);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), glow(L.color, 2.2)); body.scale.y = 1.25; body.position.set(0.25, 1.62, 0); outline(body, 1.06); g.add(body);
    for (const y of [1.25, 1.99]) { const ring = M(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 12), mat(L.metal)); ring.position.set(0.25, y, 0); g.add(ring); }
    g.userData.lightPos = new THREE.Vector3(0.25, 1.62, 0);
    g.userData.flame = body;
  }
  return g;
}
for (const l of lamps) {
  const g = lampModel(P.lamp.kind);
  g.position.set(l.p.x, 0, l.p.y); g.rotation.y = rr(0, 6.28);
  // 灯りのまわりの部品は影を落とさない（灯りが部品の内側にあると、地面に大きな黒い影が出る）。柱だけ落とす
  g.traverse(o => { if (o.isMesh) o.castShadow = !!o.userData.post; });
  scene.add(g);
  const lp = g.userData.lightPos.clone().applyEuler(g.rotation).add(g.position);
  const light = new THREE.PointLight(P.lamp.color, P.lamp.intensity, P.lamp.distance, 2);
  light.position.copy(lp); scene.add(light);
  l.light = light; l.pos3 = lp; l.flame = g.userData.flame; l.phase = rr(0, 10);
}
// 影を落とす灯りは3つだけ。カメラに近い灯りへ移して使う（灯りの数は変えない＝シェーダーを作り直さない）
const shadowLights = [0, 1, 2].map(() => {
  const s = new THREE.PointLight(P.lamp.color, 0, P.lamp.distance, 2);
  s.castShadow = true; s.shadow.mapSize.set(512, 512); s.shadow.bias = -0.004; s.shadow.radius = 4; s.shadow.camera.near = 0.1; s.shadow.camera.far = P.lamp.distance;
  scene.add(s); return s;
});

// ---------- 小道具 ----------
{
  const pr = P.props, r4 = rng(99);
  const spots = [];
  for (let i = 0; i < pr.count; i++) {
    const p = new THREE.Vector2((r4() * 2 - 1) * (FIELD + 8), (r4() * 2 - 1) * (FIELD + 8));
    if (lamps.some(l => l.p.distanceTo(p) < 1.4)) continue;
    spots.push(p);
  }
  const place = (geo, material, fn) => {
    const im = new THREE.InstancedMesh(geo, material, spots.length);
    im.castShadow = true; im.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
    spots.forEach((p, i) => { const o = fn(i); e.set(o.rx || 0, r4() * 6.28, o.rz || 0); q.setFromEuler(e); s.set(o.sx, o.sy, o.sz); m4.compose(new THREE.Vector3(p.x, o.y || 0, p.y), q, s); im.setMatrixAt(i, m4); });
    scene.add(im); return im;
  };
  if (pr.kind === 'rocks') {
    place(new THREE.IcosahedronGeometry(0.5, 0), mat(pr.color, { rough: 0.95, flat: true }), () => { const k = 0.15 + r4() ** 3 * 0.9; return { sx: k * (0.8 + r4() * 0.6), sy: k * (0.4 + r4() * 0.4), sz: k, y: 0.05 }; });
  } else if (pr.kind === 'toys') {
    const half = Math.floor(spots.length / 2);
    const cols = ['#c9a06a', '#7aa0c0', '#c07a5a', '#90b070'];
    const tm = mat('#ffffff', { rough: 0.5 });
    const im = place(new THREE.CylinderGeometry(0.12, 0.12, 1, 10), tm, () => { const k = 0.4 + r4() * 0.8; return { sx: 1, sy: k, sz: 1, y: 0.06, rx: Math.PI / 2 }; });
    const c = new THREE.Color(); for (let i = 0; i < spots.length; i++) im.setColorAt(i, c.set(cols[i % 4]));
    im.count = half;
    const leaf = place(new THREE.CircleGeometry(0.5, 6), new THREE.MeshStandardMaterial({ color: '#7a5a2a', roughness: 0.9, side: THREE.DoubleSide }), () => ({ sx: 0.5 + r4() * 0.5, sy: 1, sz: 1, y: 0.02, rx: -Math.PI / 2 }));
    leaf.count = spots.length; leaf.castShadow = false;
  } else if (pr.kind === 'fungi') {
    place(new THREE.IcosahedronGeometry(0.5, 0), mat(pr.color, { rough: 0.9, flat: true }), () => { const k = 0.2 + r4() ** 2 * 1.2; return { sx: k, sy: k * 0.5, sz: k, y: 0.03 }; });
    const dots = place(new THREE.SphereGeometry(0.05, 6, 4), glow(P.lamp.color, 1.2), () => ({ sx: 1, sy: 1, sz: 1, y: 0.06 }));
    dots.castShadow = false;
    // 小さな光の粒を、灯りから離れた所にも少しだけ
  } else if (pr.kind === 'inkstones') {
    place(new THREE.DodecahedronGeometry(0.5, 0), mat(pr.color), () => { const k = 0.25 + r4() ** 2 * 1.2; return { sx: k, sy: k * 0.5, sz: k * 0.8, y: 0.04 }; });
  }
}

// ---------- 小人 ----------
function makePerson(c, sitting = false) {
  const g = new THREE.Group();
  const body = outline(M(new THREE.CylinderGeometry(0.075, 0.12, 0.24, 10), mat(c.suit, { rough: 0.8 })), 1.12);
  body.position.y = sitting ? 0.12 : 0.24; g.add(body);
  const head = outline(M(new THREE.SphereGeometry(0.085, 14, 10), mat(c.skin, { rough: 0.7 })), 1.12);
  head.position.y = body.position.y + 0.2; g.add(head);
  const hat = M(new THREE.ConeGeometry(0.1, 0.16, 12), mat(c.hat, { rough: 0.7 }));
  hat.position.y = head.position.y + 0.1; hat.rotation.z = -0.25; g.add(hat);
  const eye = glow(c.goggle || '#111', c.goggle ? 1.4 : 1);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), eye); e.position.set(0.075, head.position.y + 0.01, s * 0.035); g.add(e); }
  if (!sitting) {
    const legs = [];
    for (const s of [-1, 1]) { const l = M(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6), mat(c.suit)); l.position.set(0, 0.07, s * 0.05); g.add(l); legs.push(l); }
    g.userData.legs = legs;
  } else {
    for (const s of [-1, 1]) { const a = M(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6), mat(c.suit)); a.position.set(0.08, 0.16, s * 0.08); a.rotation.z = Math.PI / 2.4; g.add(a); }
  }
  g.userData.body = body;
  return g;
}

// ---------- ブロックの体節 ----------
const BLOCK_GEO = new RoundedBoxGeometry(0.86, 0.6, 0.78, 3, 0.1);
const HEAD_GEO = new RoundedBoxGeometry(1.0, 0.66, 0.9, 3, 0.14);
const LEG_GEO = new THREE.CylinderGeometry(0.035, 0.025, 0.6, 5); LEG_GEO.translate(0, -0.3, 0);
const LEG_MAT = actor(mat)(P.block.legs, { rough: 0.6, metal: 0.2 });
const blockMats = P.block.palette.map(c => actor(mat)(c, { rough: P.block.rough, metal: P.block.metal }));
let blockIdx = 0;
const RM = rng(5); // 苔の乱数は別（パターンで配置がずれないように）
function makeSegment() {
  const g = new THREE.Group();
  const b = outline(M(BLOCK_GEO, blockMats[blockIdx++ % blockMats.length]), 1.06); b.position.y = 0.42; g.add(b);
  if (P.block.moss && RM() < 0.5) { const m = M(new THREE.BoxGeometry(0.5, 0.04, 0.5), mat(P.block.moss, { rough: 1 })); m.position.set(RM() * 0.2 - 0.1, 0.73, RM() * 0.2 - 0.1); g.add(m); }
  // 継ぎ目の金具
  const pin = M(new THREE.CylinderGeometry(0.09, 0.09, 0.82, 8), mat('#3a332c', { metal: 0.7, rough: 0.4 })); pin.rotation.x = Math.PI / 2; pin.position.set(-0.47, 0.4, 0); g.add(pin); g.userData.pin = pin;
  const legs = [];
  for (const s of [-1, 1]) { const l = M(LEG_GEO, LEG_MAT); l.position.set(0, 0.42, s * 0.4); l.rotation.x = s * 1.1; g.add(l); legs.push(l); }
  g.userData = { block: b, legs, pin };
  return g;
}
function makeHead() {
  const H = P.head;
  const g = new THREE.Group();
  const hm = mat(H.color, { rough: H.rough, metal: 0.1, emissive: H.emissive || 0, ei: H.ei ?? 0 });
  const b = outline(M(HEAD_GEO, hm), 1.06); b.position.y = 0.46; g.add(b);
  // 操縦席: 頭の上のくぼみ・座席・風よけ・小人
  const rim = M(new THREE.TorusGeometry(0.26, 0.05, 6, 16), mat('#2a2420', { metal: 0.7, rough: 0.4 })); rim.rotation.x = Math.PI / 2; rim.position.set(-0.08, 0.8, 0); g.add(rim);
  const seat = M(new THREE.BoxGeometry(0.2, 0.08, 0.26), mat('#2a2420', { rough: 0.6 })); seat.position.set(-0.14, 0.82, 0); g.add(seat);
  const back = M(new THREE.BoxGeometry(0.05, 0.22, 0.26), mat('#2a2420', { rough: 0.6 })); back.position.set(-0.24, 0.92, 0); g.add(back);
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), new THREE.MeshStandardMaterial({ color: H.glass, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.3, side: THREE.DoubleSide }));
  shield.position.set(0.14, 0.92, 0); shield.rotation.set(0, Math.PI / 2, 0); shield.rotateX(-0.5); g.add(shield);
  const pilot = makePerson(P.pilot, true); pilot.position.set(-0.12, 0.84, 0); pilot.scale.setScalar(1.3); g.add(pilot);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.22), glow(H.eye, 0.6)); dash.position.set(0.08, 0.86, 0); g.add(dash);
  // 操縦かん
  const stick = M(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5), mat('#111')); stick.position.set(0.02, 0.9, 0); stick.rotation.z = -0.4; g.add(stick);
  // 目・あご・触角
  const eyeM = glow(H.eye, H.eyeGlow);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), eyeM); e.position.set(0.5, 0.56, s * 0.24); g.add(e);
    const jaw = outline(M(new THREE.TorusGeometry(0.2, 0.04, 6, 10, Math.PI * 0.9), mat('#1c1612', { metal: 0.5, rough: 0.4 })), 1.1);
    jaw.position.set(0.55, 0.25, s * 0.16); jaw.rotation.set(Math.PI / 2, 0, s > 0 ? -0.2 : Math.PI + 0.2); g.add(jaw);
    const ant = M(new THREE.CylinderGeometry(0.012, 0.02, 0.9, 5), mat('#1c1612')); ant.geometry.translate(0, 0.45, 0);
    ant.position.set(0.42, 0.72, s * 0.2); ant.rotation.set(s * 0.5, 0, -1.0); g.add(ant);
    g.userData['ant' + s] = ant;
  }
  const legs = [];
  for (const s of [-1, 1]) { const l = M(LEG_GEO, LEG_MAT); l.position.set(0, 0.42, s * 0.44); l.rotation.x = s * 1.1; g.add(l); legs.push(l); }
  if (H.cockpit === 'deluxe') {
    // ガラスの丸屋根・真鍮のふち・前照灯・旗
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: H.glass, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2 }));
    dome.position.set(-0.08, 0.8, 0); g.add(dome);
    const brass = outline(M(new THREE.TorusGeometry(0.34, 0.045, 8, 24), mat('#c9a24a', { metal: 0.9, rough: 0.3 })), 1.15); brass.rotation.x = Math.PI / 2; brass.position.set(-0.08, 0.8, 0); g.add(brass);
    const hl = outline(M(new THREE.CylinderGeometry(0.09, 0.07, 0.14, 12), mat('#1c1c1c')), 1.12); hl.rotation.z = Math.PI / 2; hl.position.set(0.5, 0.86, 0); g.add(hl);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.075, 14), glow('#fff2c8', 3)); lens.rotation.y = Math.PI / 2; lens.position.set(0.58, 0.86, 0); g.add(lens);
    const pole = M(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5), mat('#1c1c1c')); pole.position.set(-0.42, 1.05, 0.25); g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.14), mat(H.flag || H.color)); flag.material.side = THREE.DoubleSide; flag.position.set(-0.55, 1.32, 0.25); g.add(flag);
    g.userData.flag = flag;
    pilot.scale.setScalar(1.6);
    const scarf = M(new THREE.BoxGeometry(0.22, 0.03, 0.05), mat(H.flag || '#d63a2a')); scarf.position.set(-0.3, 1.1, 0); g.add(scarf); g.userData.scarf = scarf;
  }
  if (H.face === 'kumadori') {
    // 頭の上の隈取り（墨の線）
    const ink = mat('#141414');
    for (const s of [-1, 1]) {
      const st = M(new THREE.BoxGeometry(0.42, 0.012, 0.05), ink); st.position.set(0.22, 0.795, s * 0.3); st.rotation.y = s * 0.35; g.add(st);
      const st2 = M(new THREE.BoxGeometry(0.2, 0.012, 0.04), ink); st2.position.set(0.36, 0.795, s * 0.13); st2.rotation.y = -s * 0.6; g.add(st2);
      const brow = M(new THREE.BoxGeometry(0.06, 0.16, 0.18), ink); brow.position.set(0.5, 0.7, s * 0.24); brow.rotation.x = s * 0.4; g.add(brow);
    }
  }
  g.userData.legs = legs; g.userData.pilot = pilot; g.userData.block = b;
  return g;
}

makePerson = actor(makePerson); makeSegment = actor(makeSegment); makeHead = actor(makeHead);

// ---------- 通った跡 ----------
const TRAIL_N = 3000;
const trailMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.07),
  P.toon ? new THREE.MeshToonMaterial({ color: P.trail.color, gradientMap: gradient })
    : new THREE.MeshStandardMaterial({ color: P.trail.color, roughness: 0.9, emissive: P.trail.emissive, emissiveIntensity: P.trail.ei }), TRAIL_N);
trailMesh.receiveShadow = true; trailMesh.frustumCulled = false;
const trailBirth = new Float32Array(TRAIL_N).fill(-999);
const trailBase = [];
let trailHead = 0;
{ const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < TRAIL_N; i++) { trailMesh.setMatrixAt(i, z); trailBase.push(new THREE.Matrix4()); } }
scene.add(trailMesh);
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function dropMark(x, z, yaw, now) {
  _e.set(-Math.PI / 2, 0, yaw + rr(-0.3, 0.3)); _q.setFromEuler(_e);
  trailBase[trailHead].compose(_v.set(x, 0.012, z), _q, _s.set(1, 1, 1));
  trailBirth[trailHead] = now; trailHead = (trailHead + 1) % TRAIL_N;
}
const TRAIL_LIFE = 40;
function updateTrail(now) {
  for (let i = 0; i < TRAIL_N; i++) {
    const age = now - trailBirth[i];
    if (age > TRAIL_LIFE + 1) continue;
    const k = Math.max(0, 1 - age / TRAIL_LIFE);
    _m4.copy(trailBase[i]); _m4.multiply(new THREE.Matrix4().makeScale(k, k, 1));
    trailMesh.setMatrixAt(i, _m4);
  }
  trailMesh.instanceMatrix.needsUpdate = true;
}

// ---------- 道すじをたどる列（ムカデも、自分のうしろの列も同じ） ----------
function placeAlong(hist, segs, x0, z0, spacing, startI = 1) {
  // hist は古い→新しい。新しい側から距離をたどる
  let need = spacing * startI, acc = 0, i = hist.length - 1, px = x0, pz = z0;
  for (let s = 0; s < segs.length; s++) {
    while (i >= 0) {
      const h = hist[i]; const d = Math.hypot(h.x - px, h.z - pz);
      if (acc + d >= need) { const t = (need - acc) / (d || 1); px = px + (h.x - px) * t; pz = pz + (h.z - pz) * t; acc = need; break; }
      acc += d; px = h.x; pz = h.z; i--;
    }
    const g = segs[s];
    const prev = s === 0 ? { x: x0, z: z0 } : segs[s - 1].position;
    g.position.x = px; g.position.z = pz;
    const yaw = Math.atan2(prev.z - pz, prev.x - px);
    if (Math.hypot(prev.x - px, prev.z - pz) > 0.01) g.rotation.y = -yaw;
    need += spacing;
  }
}

function litAt(x, z) { let k = 0; for (const l of lamps) { const d = Math.hypot(l.p.x - x, l.p.y - z); k = Math.max(k, 1 - d / (P.lamp.distance * 0.45)); } return Math.max(0, k); }

// ---------- ムカデ ----------
const centipedes = [];
// 操縦席の小さな明かり（数は固定。ムカデが入れかわっても付けかえるだけ）
const cockpitLights = [0, 1, 2, 3].map(() => {
  const l = new THREE.PointLight(P.head.eye, 1.6, 3.4, 2); scene.add(l); // 小人の真上に近いと白く飛ぶので高めに
  if (P.head.cockpit === 'deluxe') { l.spot = new THREE.SpotLight('#ffe8b0', 14, 9, 0.42, 0.6, 2); scene.add(l.spot); scene.add(l.spot.target); }
  return l;
});
// 頭から尾へ色を移す（block.gradient: [頭のそばの色, 尾の色]）
const gradMats = P.block.gradient ? Array.from({ length: 14 }, (_, i) => actor(mat)(new THREE.Color(P.block.gradient[0]).lerp(new THREE.Color(P.block.gradient[1]), Math.min(1, i / 7)), { rough: P.block.rough })) : null;
const loose = [];
class Centipede {
  constructor(x, z, h, n, kind = 'centipede') {
    this.x = x; this.z = z; this.h = h; this.speed = rr(1.9, 2.4);
    // ヘビ型: 足のない細い体節をたくさん。うねりはまなびラボ「ヘビが進むしくみ」（snake-move）と同じ実物の形
    // （Hu ほか 2009 の実測: 波長 0.4 L・ふれはば 0.1 L）。石のあいだの進み方（Gray 1946）のように、体は頭の通った道をなぞる＝横すべりなし
    this.kind = kind; this.snake = kind === 'snake';
    // 本物のヘビは体の太さが体長の 3〜5%。積み木でも曲がりきれるよう、細く短い体節をたくさん
    if (this.snake) { n = 22; this.speed *= 0.9; }
    this.sp = this.snake ? 0.42 : SP;
    this.head = makeHead(); this.head.scale.setScalar(this.snake ? 0.85 : 1.2); scene.add(this.head);
    if (this.snake) { this.head.userData.legs.forEach(l => l.visible = false); this.head.traverse(o => { if (o === this.head.userData.ant1 || o === this.head.userData['ant-1']) o.visible = false; }); }
    this.lamp = cockpitLights.find(l => !l.owner || l.owner.dead) || cockpitLights[0]; this.lamp.owner = this;
    this.segs = []; for (let i = 0; i < n; i++) {
      const s = makeSegment(); if (gradMats) s.userData.block.material = gradMats[Math.min(i, 13)];
      if (this.snake) { const k = 1 - 0.6 * (i / n) ** 1.5; s.userData.block.scale.set(0.47, 0.62 * k, 0.6 * k); s.userData.block.position.y = 0.2 * k + 0.02; s.userData.legs.forEach(l => l.visible = false); s.userData.pin.visible = false; }
      scene.add(s); this.segs.push(s);
    }
    this.hist = []; for (let i = n + 2; i > 0; i--) this.hist.push({ x: x - Math.cos(h) * i * this.sp, z: z - Math.sin(h) * i * this.sp });
    this.target = null; this.walk = 0; this.markAcc = 0; this.side = 1; this.lonely = 0; this.fade = 1; this.t = rr(0, 10);
  }
  update(dt, now) {
    this.t += dt;
    // 行き先: ふだんはふらふら、暗がりの小人を見つけたら追う
    const dp = Math.hypot(player.x - this.x, player.z - this.z);
    const chase = dp < 7 && litAt(player.x, player.z) < 0.35;
    if (!this.target || Math.hypot(this.target.x - this.x, this.target.z - this.z) < 2 || R() < dt * 0.05) this.target = { x: rr(-FIELD + 3, FIELD - 3), z: rr(-FIELD + 3, FIELD - 3) };
    let tx = chase ? player.x : this.target.x, tz = chase ? player.z : this.target.z;
    let vx = tx - this.x, vz = tz - this.z; const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
    // 光をさける（灯りのふちをなぞるように）
    for (const l of lamps) {
      const ax = this.x - l.p.x, az = this.z - l.p.y, d = Math.hypot(ax, az); const r = P.lamp.avoid;
      if (d < r * 1.6) { const w = (1 - d / (r * 1.6)) * 3.2; vx += ax / d * w; vz += az / d * w; }
    }
    // ほかのムカデ・野のはし
    for (const c of centipedes) if (c !== this) { const ax = this.x - c.x, az = this.z - c.z, d = Math.hypot(ax, az); if (d < 3) { vx += ax / d; vz += az / d; } }
    if (Math.abs(this.x) > FIELD - 2) vx -= Math.sign(this.x) * 2; if (Math.abs(this.z) > FIELD - 2) vz -= Math.sign(this.z) * 2;
    const want = Math.atan2(vz, vx);
    let dh = want - this.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const wig = Math.sin(this.t * 2.3) * 0.5;
    this.h += THREE.MathUtils.clamp(dh + wig * 0.4, -1.3 * dt, 1.3 * dt); // 曲がりすぎるとその場でとぐろを巻く
    const sp = this.speed * (chase ? 1.25 : 1) * (this.segs.length === 0 ? 1.3 : 1);
    // ヘビは進む向き h のまわりに頭をふる。道の上の長さで 1 波（体長 L の 0.4 の波長を、道にそった長さになおして約 1.5 倍）
    const L = Math.max(4, (this.segs.length + 1) * this.sp);
    this.hh = this.snake ? this.h + 1.0 * Math.cos(2 * Math.PI * this.walk / (0.4 * L * 1.5)) : this.h;
    const mx = Math.cos(this.hh) * sp * dt, mz = Math.sin(this.hh) * sp * dt;
    this.x += mx; this.z += mz; this.walk += sp * dt;
    const last = this.hist[this.hist.length - 1];
    if (Math.hypot(last.x - this.x, last.z - this.z) > 0.08) { this.hist.push({ x: this.x, z: this.z }); const cap = (this.segs.length + 3) * this.sp / 0.08 + 20; if (this.hist.length > cap) this.hist.splice(0, this.hist.length - cap); }
    // 跡: 足の左右にひとつずつ
    this.markAcc += sp * dt;
    if (this.snake) { if (this.markAcc > 0.13) { this.markAcc = 0; dropMark(this.x, this.z, -this.hh, now); } } // ヘビは1本のすじ
    else if (this.markAcc > 0.28) {
      this.markAcc = 0; this.side = -this.side;
      const px = -Math.sin(this.h), pz = Math.cos(this.h);
      dropMark(this.x + px * 0.6 * this.side, this.z + pz * 0.6 * this.side, -this.h, now);
    }
    this.head.position.set(this.x, 0, this.z); this.head.rotation.y = -this.hh;
    this.lamp.position.set(this.x + Math.cos(this.h) * 0.6, 2.4, this.z + Math.sin(this.h) * 0.6);
    if (this.lamp.spot) { const c = Math.cos(this.h), sn = Math.sin(this.h); this.lamp.spot.position.set(this.x + c * 0.7, 1.05, this.z + sn * 0.7); this.lamp.spot.target.position.set(this.x + c * 5, 0, this.z + sn * 5); }
    if (this.head.userData.flag) { this.head.userData.flag.rotation.y = Math.sin(this.t * 9) * 0.35; this.head.userData.scarf.rotation.y = Math.sin(this.t * 11) * 0.5; }
    placeAlong(this.hist, this.segs, this.x, this.z, this.sp, this.snake ? 1.6 : 1);
    // 足と体のうねり
    const ph = this.walk * 5;
    const all = [this.head, ...this.segs];
    if (!this.snake) all.forEach((g, i) => {
      const [l, r] = g.userData.legs;
      const a = Math.sin(ph - i * 0.9);
      l.rotation.z = a * 0.6; r.rotation.z = -a * 0.6;
      l.rotation.x = -1.1 + Math.max(0, Math.cos(ph - i * 0.9)) * 0.25; r.rotation.x = 1.1 - Math.max(0, -Math.cos(ph - i * 0.9)) * 0.25;
      g.userData.block.position.y = (i === 0 ? 0.46 : 0.42) + Math.abs(Math.sin(ph - i * 0.9)) * 0.03;
    });
    this.head.userData.ant1.rotation.x = 0.5 + Math.sin(this.t * 6) * 0.15;
    this.head.userData['ant-1'].rotation.x = -0.5 + Math.sin(this.t * 6 + 1) * 0.15;
    this.head.userData.pilot.rotation.y = Math.sin(this.t * 1.3) * 0.4 + (chase ? Math.atan2(player.z - this.z, player.x - this.x) * 0 : 0);
    // 頭だけになったら、しばらくして消え、はしから新しいムカデ
    if (this.segs.length === 0) { this.lonely += dt; if (this.lonely > 9) { this.fade -= dt; this.head.scale.setScalar(Math.max(0.01, this.fade)); if (this.fade <= 0) { scene.remove(this.head); this.dead = true; spawnCentipede(); } } }
    // 小人にかみつく
    if (!warming && !shotFreeze && dp < 0.85 && player.hurt <= 0) player.hit(this);
  }
  cut(i) {
    const off = this.segs.splice(i);
    for (const s of off) loose.push({ g: s, t: 0, tilt: rr(-0.5, 0.5), roll: rr(-0.4, 0.4) });
  }
}
function spawnCentipede() {
  const a = rr(0, 6.28), x = Math.cos(a) * (FIELD - 3), z = Math.sin(a) * (FIELD - 3);
  centipedes.push(new Centipede(x, z, a + Math.PI, Math.floor(rr(7, 11)), R() < (P.snakes || 0) / 4 ? 'snake' : 'centipede'));
}

// ---------- 自分 ----------
const player = {
  x: lamps[0].p.x + 2.2, z: lamps[0].p.y + 1.2, h: 0, mesh: makePerson(P.player), tail: [], hist: [], walk: 0, hurt: 0, blocks: 0,
  hit(c) {
    this.hurt = 1.2;
    const ax = this.x - c.x, az = this.z - c.z, d = Math.hypot(ax, az) || 1;
    this.kx = ax / d * 7; this.kz = az / d * 7;
    if (this.tail.length) { const s = this.tail.pop(); loose.push({ g: s, t: 0, tilt: rr(-0.5, 0.5), roll: rr(-0.4, 0.4), cool: 1.5 }); this.blocks--; }
    flash();
  },
};
player.mesh.scale.setScalar(1.8);
scene.add(player.mesh);
for (let i = 0; i < 5; i++) player.hist.push({ x: player.x - (5 - i) * 0.1, z: player.z });
const plight = new THREE.PointLight(P.player.light, P.player.lightI * 2.5, P.player.lightD + 1.5, 2); scene.add(plight);

// ---------- わな ----------
const traps = [];
function placeTrap() {
  if (traps.filter(t => !t.done).length >= 3) { const old = traps.find(t => !t.done); if (old) removeTrap(old); }
  const g = new THREE.Group();
  const tm = mat(P.trap.color, { metal: P.trap.metal, rough: 0.35 });
  const base = M(new THREE.CylinderGeometry(0.36, 0.4, 0.06, 18), mat('#2a2520', { metal: 0.6, rough: 0.5 })); base.position.y = 0.03; g.add(base);
  const jaws = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(0, 0.06, 0);
    const jaw = outline(M(new THREE.TorusGeometry(0.42, 0.035, 6, 14, Math.PI), tm), 1.1); jaw.rotation.y = s > 0 ? 0 : Math.PI;
    for (let k = 0; k < 6; k++) { const tooth = M(new THREE.ConeGeometry(0.03, 0.12, 4), tm); const a = (k + 0.5) / 6 * Math.PI; tooth.position.set(Math.cos(a) * 0.42, 0.06, Math.sin(a) * 0.42); jaw.add(tooth); }
    piv.add(jaw); piv.rotation.x = s * 1.35; g.add(piv); jaws.push({ piv, s });
  }
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), glow('#ff5a3a', 2)); light.position.y = 0.1; g.add(light);
  g.position.set(player.x + Math.cos(player.h) * 0.2, 0, player.z + Math.sin(player.h) * 0.2);
  g.scale.setScalar(0.01); scene.add(g);
  traps.push({ g, jaws, x: g.position.x, z: g.position.z, t: 0, done: false, snap: 0, arm: 0.6 });
}
placeTrap = actor(placeTrap);
function removeTrap(t) { t.done = true; t.remove = true; }

// ---------- 入力 ----------
const keys = new Set();
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); placeTrap(); }
  const n = { Digit1: 'D', Digit2: 'D1', Digit3: 'D2', Digit4: 'D3', Digit5: 'D4', Digit6: 'D5', Digit7: 'D6' }[e.code]; if (n) go(n);
});
addEventListener('keyup', e => keys.delete(e.code));
let moveTo = null;
const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
renderer.domElement.addEventListener('pointerdown', e => {
  const v = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(v, camera); const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(groundPlane, hit)) moveTo = { x: hit.x, z: hit.z };
});
renderer.domElement.addEventListener('pointermove', e => { if (e.buttons && moveTo) { const v = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(v, camera); const hit = new THREE.Vector3(); if (ray.ray.intersectPlane(groundPlane, hit)) moveTo = { x: hit.x, z: hit.z }; } });
addEventListener('wheel', e => { zoom = THREE.MathUtils.clamp(zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.45, 2.6); }, { passive: true });
document.getElementById('trapBtn').addEventListener('click', placeTrap);
function go(k) { const u = new URL(location.href); u.searchParams.set('p', k); location.href = u.toString(); }
document.querySelectorAll('[data-p]').forEach(b => { b.classList.toggle('on', b.dataset.p === KEY); b.addEventListener('click', () => go(b.dataset.p)); });
document.getElementById('pname').textContent = `${KEY}　${P.name}`;
const countEl = document.getElementById('count');
const flashEl = document.getElementById('flash');
function flash() { flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); }

// ---------- 後処理 ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), P.bloom.strength, P.bloom.radius, P.bloom.threshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: P.post.vignette }, grain: { value: P.post.grain }, tilt: { value: P.post.tilt }, px: { value: new THREE.Vector2(1 / innerWidth, 1 / innerHeight) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vig, grain, tilt; uniform vec2 px; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (tilt > 0.0) {
        float b = smoothstep(0.12, 0.5, abs(vUv.y - 0.5)) * tilt * 5.0;
        vec4 acc = vec4(0.0); float w = 0.0;
        for (int i = -3; i <= 3; i++) for (int j = -3; j <= 3; j++) { float k = 1.0 / (1.0 + float(i*i + j*j)); acc += texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * px * b) * k; w += k; }
        c = mix(c, acc / w, clamp(b, 0.0, 1.0));
      }
      vec2 p = vUv - 0.5; float v = smoothstep(0.85, 0.25, length(p * vec2(1.0, 0.8)) * vig);
      c.rgb *= mix(0.25, 1.0, v);
      c.rgb += (h(vUv * 931.0 + time) - 0.5) * grain;
      gl_FragColor = c;
    }`,
});
composer.addPass(finish);

function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  finish.uniforms.px.value.set(1 / innerWidth, 1 / innerHeight);
}
addEventListener('resize', resize);

// ---------- はじめの配置 ----------
for (let i = 0; i < 4; i++) {
  const l = lamps[(i * 3 + 1) % lamps.length];
  const a = rr(0, 6.28), d = P.lamp.avoid * 1.7;
  centipedes.push(new Centipede(l.p.x + Math.cos(a) * d, l.p.y + Math.sin(a) * d, a + Math.PI / 2, Math.floor(rr(8, 12)), i < (P.snakes || 0) ? 'snake' : 'centipede'));
}
// 跡がはじめから少しあるように、見えない所で少し進めておく
let warming = true;
let shotFreeze = false; // 撮影のときはムカデを止める（同じ形で見くらべる）
{ let t = -TRAIL_LIFE; for (let k = 0; k < 600; k++) { t += 1 / 20; for (const c of centipedes) c.update(1 / 20, t); } }
warming = false;
// 見くらべの撮影用（?shot=1）: 灯りのそばのムカデが画面に入るよう、自分をそこへ置く
if (qs.get('shot')) {
  let best = null;
  for (const c of centipedes.filter(c => qs.get('focus') !== 'snake' || c.snake)) for (const l of lamps) { const t = c.segs[c.segs.length - 1].position; const d = Math.hypot(c.x - l.p.x, c.z - l.p.y) - Math.hypot(c.x - t.x, c.z - t.z) * 0.6; if (!best || d < best.d) best = { c, l, d }; } // 灯りに近く、体がのびているムカデ
  const near = (Number(qs.get('zoom')) || 1.15) < 0.8;
  // 寄りの絵は頭のすぐ横、引きの絵は灯りとムカデのあいだ
  if (near) { player.x = best.c.x - Math.sin(best.c.h) * 1.6 - Math.cos(best.c.h) * 0.3; player.z = best.c.z + Math.cos(best.c.h) * 1.4 - Math.sin(best.c.h) * 0.3; }
  else { player.x = (best.c.x + best.l.p.x) / 2 + 1.5; player.z = (best.c.z + best.l.p.y) / 2 + 1.5; }
  shotFreeze = true;
  player.hist = [{ x: player.x - 0.1, z: player.z }, { x: player.x, z: player.z }];
  document.getElementById('hint').style.display = 'none';
}

// ---------- 毎フレーム ----------
const clock = new THREE.Clock();
let now = 0, trailT = 0;
const camTarget = new THREE.Vector3(player.x, 0, player.z);
if (qs.get('shot')) zoom = Number(qs.get('zoom')) || 1.15;
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30); now += dt;
  // 自分の移動（W はいつも画面の上＝-Z）
  let ix = 0, iz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (ix || iz) moveTo = null;
  if (moveTo) { const dx = moveTo.x - player.x, dz = moveTo.z - player.z, d = Math.hypot(dx, dz); if (d < 0.15) moveTo = null; else { ix = dx / d; iz = dz / d; } }
  const il = Math.hypot(ix, iz);
  const spd = 3.4;
  if (il) { ix /= il; iz /= il; player.x += ix * spd * dt; player.z += iz * spd * dt; player.walk += spd * dt; let dh = Math.atan2(iz, ix) - player.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); player.h += dh * Math.min(1, dt * 14); }
  if (player.hurt > 0) { player.hurt -= dt; player.x += player.kx * dt; player.z += player.kz * dt; player.kx *= 0.9; player.kz *= 0.9; }
  player.x = THREE.MathUtils.clamp(player.x, -FIELD, FIELD); player.z = THREE.MathUtils.clamp(player.z, -FIELD, FIELD);
  const lh = player.hist[player.hist.length - 1];
  if (Math.hypot(lh.x - player.x, lh.z - player.z) > 0.06) { player.hist.push({ x: player.x, z: player.z }); if (player.hist.length > 600) player.hist.shift(); }
  player.mesh.position.set(player.x, il ? Math.abs(Math.sin(player.walk * 6)) * 0.05 : 0, player.z);
  player.mesh.rotation.y = -player.h;
  player.mesh.visible = player.hurt <= 0 || Math.floor(now * 14) % 2 === 0;
  const [la, lb] = player.mesh.userData.legs; la.rotation.z = Math.sin(player.walk * 6) * 0.7 * (il ? 1 : 0); lb.rotation.z = -la.rotation.z;
  plight.position.set(player.x, 1.8, player.z); // 近いと小人が白く飛ぶ
  // 自分のうしろのブロック（拾った分）
  if (player.tail.length) {
    placeAlong(player.hist, player.tail, player.x, player.z, SP * 0.8, 0.75);
    player.tail.forEach((g, i) => { const a = Math.sin(player.walk * 5 - i * 0.9) * (il ? 1 : 0.1); const [l, r] = g.userData.legs; l.rotation.z = a * 0.6; r.rotation.z = -a * 0.6; });
  }

  for (const c of centipedes) c.update(shotFreeze ? 0 : dt, now);
  for (let i = centipedes.length - 1; i >= 0; i--) if (centipedes[i].dead) centipedes.splice(i, 1);

  // わな
  for (const t of traps) {
    t.t += dt;
    if (!t.done) {
      t.g.scale.setScalar(Math.min(1, t.t * 5));
      if (t.t > t.arm) for (const c of centipedes) {
        if (t.done) break;
        for (let i = 0; i < c.segs.length; i++) {
          const s = c.segs[i].position;
          if (Math.hypot(s.x - t.x, s.z - t.z) < 0.55) { c.cut(i); t.done = true; t.snap = 0; break; }
        }
      }
    } else {
      t.snap += dt;
      for (const j of t.jaws) j.piv.rotation.x = j.s * 1.35 * Math.max(0, 1 - t.snap * 12);
      if (t.snap > 1.4 || t.remove) { const k = Math.max(0, 1 - (t.snap - 1.4) * 2); t.g.scale.setScalar(t.remove ? 0 : k); if (k <= 0 || t.remove) { scene.remove(t.g); t.gone = true; } }
    }
  }
  for (let i = traps.length - 1; i >= 0; i--) if (traps[i].gone) traps.splice(i, 1);

  // 切れたブロック: 倒れて、拾えるとかすかに光る
  for (let i = loose.length - 1; i >= 0; i--) {
    const L = loose[i]; L.t += dt; const g = L.g;
    const k = Math.min(1, L.t * 3);
    g.userData.legs.forEach((l, j) => { l.rotation.x = (j ? 1 : -1) * (1.1 + k * 0.4); l.rotation.z = 0; });
    g.userData.block.rotation.z = L.tilt * k; g.userData.block.rotation.x = L.roll * k;
    g.userData.block.position.y = 0.42 - k * 0.12;
    const m = g.userData.block.material;
    if (L.t > 0.6) { const pulse = 0.5 + 0.5 * Math.sin(now * 4 + i); g.userData.block.scale.setScalar(1 + pulse * 0.03); }
    if (L.t > (L.cool || 0.6) && Math.hypot(g.position.x - player.x, g.position.z - player.z) < 1.0 && player.tail.length < 14) {
      loose.splice(i, 1); g.userData.block.rotation.set(0, 0, 0); g.userData.block.position.y = 0.42; g.userData.block.scale.setScalar(1);
      g.scale.setScalar(0.8); player.tail.push(g); player.blocks++;
    }
  }
  countEl.textContent = player.tail.length;

  // 灯りのゆらぎと、影の灯りの付けかえ
  camTarget.lerp(new THREE.Vector3(player.x, 0, player.z), 1 - Math.exp(-dt * 4));
  const order = lamps.map((l, i) => [i, l.p.distanceToSquared(new THREE.Vector2(camTarget.x, camTarget.z))]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(a => a[0]);
  lamps.forEach((l, i) => {
    const f = 1 + Math.sin(now * 9 + l.phase) * 0.04 + Math.sin(now * 23 + l.phase * 2) * 0.03;
    const si = order.indexOf(i);
    l.light.intensity = si >= 0 ? 0 : P.lamp.intensity * f;
    if (si >= 0) { const s = shadowLights[si]; s.position.copy(l.pos3); s.intensity = P.lamp.intensity * f; }
    if (l.flame) l.flame.scale.setScalar(P.lamp.kind === 'mushroom' ? 1 : f);
  });

  trailT += dt; if (trailT > 0.2) { trailT = 0; updateTrail(now); }

  const z = zoom;
  camera.position.set(camTarget.x, P.cam.height * z, camTarget.z + P.cam.back * z);
  camera.lookAt(camTarget.x, 0, camTarget.z - 0.5);
  finish.uniforms.time.value = now % 100;
  composer.render();
  requestAnimationFrame(frame);
}
updateTrail(now);
frame();
setTimeout(() => document.getElementById('hint').classList.add('off'), 6000);
window.__look = { P, KEY, player, centipedes, lamps };
