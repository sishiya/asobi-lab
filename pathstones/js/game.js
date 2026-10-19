// みちいし 段階A（v002・ver. 0.2）の画面。決まりは js/sim.js（ここは状態を読んで描くだけ）。
// 見た目は look/ の D5「墨と提灯」＋組み直しで決めたこと（PLAN.md 0章）:
//   敵の頭＝弁柄の漆とふちの朱、角ばった木の櫓の操縦席、角提灯の前照灯2つ、とがった頭巾の小人。
//   自分の頭＝藍、丸い提灯の筒の操縦席（内から琥珀に光る＝画面でいちばん目立たせる1つ）、平たい黒い笠の小人。
//   体節は自分も敵も同じ大きさの白い積み木。自分の節は上に藍の帯。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RULE, makeState, step, enemyBody, meBody, hashState, inSafe } from './sim.js';
import { Sound } from './sound.js';

const VERSION = 'ver. 0.4（試作・v004）';
const qs = new URLSearchParams(location.search);
const C = {
  bg: '#0b0b0b', fog: '#0b0b0b',
  ground: { base: '#3e3b36', dark: '#1f1d1a', light: '#5a554c' },
  lamp: '#ffb070', lampI: 16, lampD: 12, lampDecay: 1.1,
  block: ['#ddd6c6', '#d3cbb9', '#e4ddcd'], legs: '#161616', legsMine: '#6b6b6b',
  enemyHead: '#9a3a2a', enemyRim: '#d64a2e', hood: '#1c1c1c',
  meHead: '#3f6496', meBand: '#3c5f8c', hat: '#141414', amber: '#ffc068',
  pilotSkin: '#e8dccb',
  beam: '#fff0d8', beamAlert: '#ff7a4a',
};

// ---------- 画面 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!qs.get('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
scene.fog = new THREE.FogExp2(C.fog, 0.03);
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 200);
const hemi = new THREE.HemisphereLight('#8a8a90', '#202020', 0.3);
scene.add(hemi);

// ---------- 材質（アニメ調の陰影とふちどり） ----------
const gradient = (() => { const d = new Uint8Array([40, 40, 40, 255, 130, 130, 130, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const mat = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradient, emissive: o.emissive || 0, emissiveIntensity: o.ei ?? 1, transparent: !!o.opacity, opacity: o.opacity ?? 1 });
const glow = (color, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.BackSide });
function outline(mesh, s = 1.06) { const o = new THREE.Mesh(mesh.geometry, OUTLINE); o.scale.setScalar(s); mesh.add(o); return mesh; }
// 登場物（頭・体節・わな）は影を落とさない。灯りのすぐそばだと地面に大きな黒い影が出るため。足もとに丸いうすい影を置く
let ACTOR = false;
const BLOB = new THREE.CircleGeometry(0.62, 20), BLOB_M = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.45, depthWrite: false });
function blob(g, s = 1) { const b = new THREE.Mesh(BLOB, BLOB_M); b.rotation.x = -Math.PI / 2; b.position.y = 0.02; b.scale.setScalar(s); g.add(b); }
function M(geo, m, shadow = true) { if (ACTOR) shadow = false; const x = new THREE.Mesh(geo, m); x.castShadow = shadow; x.receiveShadow = true; return x; }
const P3 = (x, y, h = 0) => new THREE.Vector3(x, h, y); // 決まりの (x,y) → 3D の (x, 高さ, z)

// ---------- 地面: 墨のかすれと和紙の繊維（丸いぼけは使わない） ----------
{
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
  x.fillStyle = C.ground.base; x.fillRect(0, 0, 1024, 1024);
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // 細長い筆のかすれ（向きはばらばら）
  for (let i = 0; i < 260; i++) {
    const cx = r() * 1024, cy = r() * 1024, a = r() * Math.PI, len = 40 + r() * 140, w = 6 + r() * 22;
    x.save(); x.translate(cx, cy); x.rotate(a); x.globalAlpha = 0.06 + r() * 0.1; x.fillStyle = r() < 0.6 ? C.ground.dark : C.ground.light;
    for (let k = 0; k < 6; k++) x.fillRect(-len / 2 + r() * 10, -w / 2 + k * w / 6, len * (0.6 + r() * 0.4), w / 9);
    x.restore();
  }
  // 和紙の繊維
  for (let i = 0; i < 1600; i++) { x.strokeStyle = r() < 0.5 ? C.ground.light : C.ground.dark; x.globalAlpha = 0.18; x.lineWidth = 1; x.beginPath(); const a = r() * 1024, b = r() * 1024, t = r() * 7, L = 6 + r() * 16; x.moveTo(a, b); x.quadraticCurveTo(a + Math.cos(t + 0.5) * L * 0.5, b + Math.sin(t + 0.5) * L * 0.5, a + Math.cos(t) * L, b + Math.sin(t) * L); x.stroke(); }
  x.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(5, 5); tex.anisotropy = 8;
  const g = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshToonMaterial({ map: tex, gradientMap: gradient }));
  g.rotation.x = -Math.PI / 2; g.position.set(15, 0, 11.5); g.receiveShadow = true; scene.add(g);
}

// ---------- 状態 ----------
let level = null, S = null;
const view = { lamps: [], enemies: new Map(), me: null, meNodes: [], loose: new Map(), traps: new Map() };

// ---------- 提灯 ----------
function makeLamp(l) {
  const g = new THREE.Group(); g.position.copy(P3(l.x, l.y));
  const pole = outline(M(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 6), mat('#1a1a1a'))); pole.position.set(-0.3, 0.85, 0); g.add(pole);
  const arm = M(new THREE.BoxGeometry(0.62, 0.05, 0.05), mat('#1a1a1a'), false); arm.position.set(0, 1.68, 0); g.add(arm);
  const bodyLit = glow(C.lamp, 3.2), bodyOff = mat('#6a5a48', { emissive: '#3a2a18', ei: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 12), l.lit ? bodyLit : bodyOff); body.scale.y = 1.25; body.position.set(0.25, 1.25, 0); outline(body, 1.06); g.add(body);
  for (const y of [0.88, 1.62]) { const ring = M(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12), mat('#1a1a1a'), false); ring.position.set(0.25, y, 0); g.add(ring); }
  // 安全な輪のふち（トゥーンの段のように、うすい線で）
  const ring = new THREE.Mesh(new THREE.RingGeometry(RULE.safeR - 0.06, RULE.safeR + 0.06, 72), new THREE.MeshBasicMaterial({ color: '#ffd9a8', transparent: true, opacity: l.lit ? 0.22 : 0.0 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.015; g.add(ring);
  scene.add(g);
  // 光（数は変えない。消えた提灯は 0 から）
  const light = new THREE.PointLight(C.lamp, l.lit ? C.lampI : 0, C.lampD, C.lampDecay);
  light.position.copy(P3(l.x + 0.25, l.y, 2.3)); // 提灯より上から照らす（すぐそばの積み木が白く飛ばないように） light.castShadow = true; light.shadow.mapSize.set(512, 512); light.shadow.bias = -0.004; light.shadow.radius = 4; light.shadow.camera.far = C.lampD;
  scene.add(light);
  // 消えた提灯: 足もとに「あと○」の空いた枠（数字は出さない）
  const slots = [];
  if (!l.lit) {
    for (let i = 0; i < l.need; i++) {
      const a = -Math.PI / 2 + (i - (l.need - 1) / 2) * 0.42;
      // 空いた枠: 低い黒い台に、うすい白のふち（積むとここに積み木がのる）
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.52), mat('#1c1a17', { emissive: '#4a4236', ei: 0.5 }));
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(fr.geometry), new THREE.LineBasicMaterial({ color: '#b8ae9a' })); fr.add(edge);
      fr.position.set(Math.cos(a) * 1.7, 0.04, Math.sin(a) * 1.7 + 0.2); fr.rotation.y = -a; g.add(fr);
      const fill = outline(M(new RoundedBoxGeometry(0.46, 0.34, 0.46, 2, 0.05), mat(C.block[i % 3])), 1.06); fill.position.copy(fr.position); fill.position.y = 0.17; fill.rotation.y = -a; fill.visible = false; g.add(fill);
      slots.push({ fr, fill });
    }
  }
  return { g, body, bodyLit, bodyOff, light, ring, slots, lit: l.lit, flick: l.x * 1.7 };
}

// ---------- 小人 ----------
function makePilot(kind) {
  const g = new THREE.Group();
  const body = outline(M(new THREE.CylinderGeometry(0.07, 0.11, 0.2, 10), mat(kind === 'me' ? '#2a2f3a' : '#141414')), 1.12); body.position.y = 0.1; g.add(body);
  const head = outline(M(new THREE.SphereGeometry(0.085, 12, 10), mat(C.pilotSkin)), 1.12); head.position.y = 0.28; g.add(head);
  if (kind === 'me') {
    // 平たい黒い笠（上から見ると黒い円盤に白いふち）
    const kasa = M(new THREE.ConeGeometry(0.2, 0.07, 18), mat(C.hat)); kasa.position.y = 0.37; g.add(kasa);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 4, 24), glow('#e8e0d0', 1)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.34; g.add(rim);
  } else {
    // とがった頭巾
    const hood = M(new THREE.ConeGeometry(0.1, 0.24, 10), mat(C.hood)); hood.position.y = 0.42; hood.rotation.z = -0.15; g.add(hood);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), glow('#fff2c8', 1.5)); e.position.set(0.08, 0.29, s * 0.035); g.add(e); }
  }
  g.userData.body = body;
  return g;
}

// ---------- 体節（自分も敵も同じ大きさ） ----------
const BLOCK = new RoundedBoxGeometry(0.86, 0.6, 0.78, 3, 0.1);
const LEG = new THREE.CylinderGeometry(0.035, 0.025, 0.42, 5); LEG.translate(0, -0.21, 0);
const blockMats = C.block.map(c => mat(c));
const legMat = mat(C.legs), legMine = mat(C.legsMine);
let blockN = 0;
function makeNode(mine) {
  ACTOR = true;
  const g = new THREE.Group(); blob(g);
  const b = outline(M(BLOCK, blockMats[blockN++ % blockMats.length]), 1.06); b.position.y = 0.42; g.add(b);
  // 木目（積み木のからくりだとわかるように）
  const grain = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.08 })); grain.rotation.x = -Math.PI / 2; grain.position.y = 0.725; b.add(grain);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.8), mat(C.meBand)); band.position.set(0, 0.32, 0); b.add(band); band.visible = mine;
  const pin = M(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 8), mat('#b08a3a'), false); pin.rotation.x = Math.PI / 2; pin.position.set(-0.47, 0.4, 0); g.add(pin);
  const rope = M(new THREE.TorusGeometry(0.12, 0.03, 6, 12), mat(C.meBand), false); rope.position.set(-0.47, 0.42, 0); rope.rotation.y = Math.PI / 2; g.add(rope);
  pin.visible = !mine; rope.visible = mine;
  const legs = [];
  for (const s of [-1, 1]) { const l = M(LEG, mine ? legMine : legMat, false); l.position.set(0, 0.4, s * 0.38); l.rotation.x = s * 1.0; g.add(l); legs.push(l); }
  g.userData = { b, band, pin, rope, legs, mine };
  ACTOR = false;
  scene.add(g);
  return g;
}
function setMine(g, mine) {
  const u = g.userData; u.mine = mine; u.band.visible = mine; u.rope.visible = mine; u.pin.visible = !mine;
  u.legs.forEach(l => l.material = mine ? legMine : legMat);
}

// ---------- 頭 ----------
const HEAD = new RoundedBoxGeometry(1.0, 0.66, 0.9, 3, 0.14);
const HEAD_ME = new RoundedBoxGeometry(1.0, 0.66, 0.9, 4, 0.3);
function makeEnemyHead() {
  ACTOR = true;
  const g = new THREE.Group(); blob(g, 1.1);
  const b = outline(M(HEAD, mat(C.enemyHead)), 1.06); b.position.y = 0.46; g.add(b);
  const rim = M(new THREE.BoxGeometry(1.02, 0.06, 0.92), mat(C.enemyRim), false); rim.position.y = 0.7; g.add(rim);
  // 角ばった木の櫓（屋根なしの四角い枠に黒い格子）
  const wood = mat('#3a2a1c'), ink = mat('#111');
  const frame = new THREE.Group(); frame.position.set(-0.08, 0.79, 0); g.add(frame);
  for (const [x, z, w, d] of [[0, -0.25, 0.54, 0.05], [0, 0.25, 0.54, 0.05], [-0.25, 0, 0.05, 0.54], [0.25, 0, 0.05, 0.54]]) { const bar = outline(M(new THREE.BoxGeometry(w, 0.18, d), wood), 1.08); bar.position.set(x, 0.09, z); frame.add(bar); }
  for (let i = -1; i <= 1; i++) { const bar = M(new THREE.BoxGeometry(0.02, 0.12, 0.5), ink, false); bar.position.set(i * 0.12, 0.12, -0.0); bar.scale.z = 0.98; bar.position.z = 0; bar.visible = false; frame.add(bar); }
  for (const z of [-0.24, 0.24]) { const lat = M(new THREE.BoxGeometry(0.5, 0.025, 0.025), ink, false); lat.position.set(0, 0.14, z); frame.add(lat); }
  for (const s of [-1, 1]) { const post = M(new THREE.BoxGeometry(0.05, 0.3, 0.05), wood); post.position.set(-0.25, 0.15, s * 0.25); frame.add(post); }
  // 旗はうしろの角
  const pole = M(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), ink, false); pole.position.set(-0.4, 1.05, -0.25); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.13), new THREE.MeshToonMaterial({ color: C.enemyRim, gradientMap: gradient, side: THREE.DoubleSide })); flag.position.set(-0.52, 1.22, -0.25); g.add(flag);
  const pilot = makePilot('enemy'); pilot.position.set(-0.1, 0.8, 0); pilot.scale.setScalar(1.35); g.add(pilot);
  // 角提灯の前照灯2つ
  const lamps = [];
  for (const s of [-1, 1]) { const box = outline(M(new THREE.BoxGeometry(0.13, 0.13, 0.13), glow(C.beam, 2.2), false), 1.15); box.position.set(0.5, 0.82, s * 0.28); g.add(box); lamps.push(box); }
  // あご（短く、こわくなく）と脚
  for (const s of [-1, 1]) { const jaw = outline(M(new THREE.BoxGeometry(0.22, 0.06, 0.06), mat('#1c1612'), false), 1.1); jaw.position.set(0.58, 0.28, s * 0.16); jaw.rotation.y = s * 0.4; g.add(jaw); }
  const legs = [];
  for (const s of [-1, 1]) { const l = M(LEG, legMat, false); l.position.set(0, 0.42, s * 0.44); l.rotation.x = s * 1.0; g.add(l); legs.push(l); }
  // 前照灯の光（扇の向き）
  const beam = new THREE.SpotLight(C.beam, 5, RULE.enemy.fanLen + 1.5, RULE.enemy.fanHalf * 1.15, 0.45, 1.6);
  beam.castShadow = false; scene.add(beam); scene.add(beam.target);
  g.userData = { b, legs, pilot, flag, lamps, beam };
  ACTOR = false;
  g.scale.setScalar(1.15);
  scene.add(g);
  return g;
}
function makeMyHead() {
  ACTOR = true;
  const g = new THREE.Group(); blob(g, 1.1);
  const b = outline(M(HEAD_ME, mat(C.meHead)), 1.06); b.position.y = 0.46; g.add(b);
  // 丸い提灯の筒（和紙のついたてが内から琥珀に光る）
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.17, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.amber).multiplyScalar(1.3), side: THREE.DoubleSide }));
  paper.position.set(-0.05, 0.875, 0); g.add(paper);
  for (const y of [0.79, 0.96]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 4, 24), mat('#111')); r.rotation.x = Math.PI / 2; r.position.set(-0.05, y, 0); g.add(r); }
  const pilot = makePilot('me'); pilot.position.set(-0.05, 0.8, 0); pilot.scale.setScalar(1.35); g.add(pilot);
  // 前の小さな目（向きがわかるように）
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glow('#fff2c8', 1.3)); e.position.set(0.5, 0.56, s * 0.22); g.add(e); }
  const legs = [];
  for (const s of [-1, 1]) { const l = M(LEG, legMine, false); l.position.set(0, 0.42, s * 0.44); l.rotation.x = s * 1.0; g.add(l); legs.push(l); }
  const flagPole = M(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), mat('#111'), false); flagPole.position.set(-0.42, 1.05, 0.25); g.add(flagPole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.13), new THREE.MeshToonMaterial({ color: C.meBand, gradientMap: gradient, side: THREE.DoubleSide })); flag.position.set(-0.54, 1.22, 0.25); g.add(flag);
  // 手提灯の明かり（目立たせる1つ。体に直接当てないよう少し上・前）
  const light = new THREE.PointLight(C.amber, 2.6, 4.2, 2); scene.add(light);
  // 足もとの琥珀の小さな輪（自分だとすぐわかる印）
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.amber).multiplyScalar(1.1), transparent: true, opacity: 0.55, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.03; scene.add(halo); g.userData.halo = halo;
  g.userData = { b, legs, pilot, paper, flag, light, halo: g.userData.halo };
  ACTOR = false;
  g.scale.setScalar(1.15);
  scene.add(g);
  return g;
}

// ---------- わな（自分の最後尾の節を置いたもの） ----------
function makeTrap(t) {
  ACTOR = true;
  const g = new THREE.Group();
  blob(g, 0.9);
  const plate = outline(M(new THREE.CylinderGeometry(0.45, 0.5, 0.08, 20), mat('#1a1a1a')), 1.06); plate.position.y = 0.04; g.add(plate);
  const jaws = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(0, 0.06, 0);
    const jaw = outline(M(new THREE.TorusGeometry(0.62, 0.04, 6, 16, Math.PI), mat('#1a1a1a')), 1.15); jaw.rotation.y = s > 0 ? 0 : Math.PI;
    for (let k = 0; k < 7; k++) { const tooth = M(new THREE.ConeGeometry(0.035, 0.12, 4), mat('#e8e0d0'), false); const a = (k + 0.5) / 7 * Math.PI; tooth.position.set(Math.cos(a) * 0.62, 0.06, Math.sin(a) * 0.62); jaw.add(tooth); }
    piv.add(jaw); piv.rotation.x = s * 1.25; g.add(piv); jaws.push({ piv, s });
  }
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glow('#5a2a20', 1)); dot.position.y = 0.8; g.add(dot);
  g.position.copy(P3(t.x, t.y)); g.rotation.y = -t.h;
  ACTOR = false;
  scene.add(g);
  return { g, jaws, dot, t: 0 };
}

// ---------- 跡（灯りの中だけ見える＝光が当たる所だけ色が出る） ----------
const TRAIL_N = 2400;
const trailMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.07), new THREE.MeshToonMaterial({ color: '#5a554a', gradientMap: gradient }), TRAIL_N);
trailMesh.frustumCulled = false; trailMesh.receiveShadow = true; scene.add(trailMesh);
const trailBirth = new Float32Array(TRAIL_N).fill(-999), trailBase = Array.from({ length: TRAIL_N }, () => new THREE.Matrix4());
let trailHead = 0;
{ const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < TRAIL_N; i++) trailMesh.setMatrixAt(i, z); }
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _k = new THREE.Matrix4();
function dropMark(x, y, h, now, salt) {
  _e.set(-Math.PI / 2, 0, -h + Math.sin(salt * 12.9) * 0.3); _q.setFromEuler(_e);
  trailBase[trailHead].compose(_v.set(x, 0.012, y), _q, _s.set(1, 1, 1)); trailBirth[trailHead] = now; trailHead = (trailHead + 1) % TRAIL_N;
}
function updateTrail(now) {
  for (let i = 0; i < TRAIL_N; i++) { const age = now - trailBirth[i]; if (age > 41) continue; const k = Math.max(0, 1 - age / 40); _m.copy(trailBase[i]).multiply(_k.makeScale(k, k, 1)); trailMesh.setMatrixAt(i, _m); }
  trailMesh.instanceMatrix.needsUpdate = true;
}

// ---------- 紙ふぶき ----------
const bits = [];
const BIT = new THREE.PlaneGeometry(0.12, 0.08);
function confetti(x, y, n = 10, color = '#efe8da') {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(BIT, new THREE.MeshBasicMaterial({ color: i % 3 ? color : '#1a1a1a', side: THREE.DoubleSide, transparent: true }));
    m.position.copy(P3(x, y, 0.6)); const a = i / n * Math.PI * 2;
    m.userData = { vx: Math.cos(a) * (1 + (i % 3) * 0.6), vz: Math.sin(a) * (1 + (i % 2) * 0.7), vy: 2.5 + (i % 4) * 0.5, life: 0.9, spin: 6 + i };
    scene.add(m); bits.push(m);
  }
}

// ---------- 機能停止したムカデ: 前照灯が消え、頭は少し傾いて止まり、操縦士が旗をふって帰る ----------
function syncDown(e, V, dt) {
  const h = V.head, u = h.userData;
  V.nodes.forEach(n => scene.remove(n)); V.nodes = [];
  u.beam.intensity = 0; u.lamps.forEach(b => b.material.color.set('#2a2622'));
  u.b.rotation.z += (0.12 - u.b.rotation.z) * Math.min(1, dt * 4);
  u.legs.forEach((l, j) => { l.rotation.z = 0; l.rotation.x = (j ? 1 : -1) * 1.45; });
  u.pilot.visible = false;
  if (e.pilot) {
    if (!V.pilot) { V.pilot = makePilot('enemy'); V.pilot.scale.setScalar(1.6); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 5), mat('#111')); pole.position.set(-0.05, 0.55, 0.12); V.pilot.add(pole); const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshToonMaterial({ color: '#f0ece0', gradientMap: gradient, side: THREE.DoubleSide })); flag.position.set(-0.16, 0.78, 0.12); V.pilot.add(flag); V.pilot.userData.flag = flag; scene.add(V.pilot); }
    V.pilot.position.copy(P3(e.pilot.x, e.pilot.y, Math.abs(Math.sin(now * 10)) * 0.06)); V.pilot.rotation.y = -e.pilot.h; V.pilot.userData.flag.rotation.y = Math.sin(now * 12) * 0.6;
  } else if (V.pilot) { scene.remove(V.pilot); V.pilot = null; }
  // 新しいムカデが来る少し前から、殻がうすれて沈む
  const left = RULE.enemy.respawn - e.t;
  if (left < 1.5) { const k = Math.max(0, left / 1.5); h.scale.setScalar(1.15 * (0.4 + 0.6 * k)); h.position.y = -(1 - k) * 0.4; }
}
function dropEnemyView(V) { scene.remove(V.head); scene.remove(V.head.userData.beam); scene.remove(V.head.userData.beam.target); V.nodes.forEach(n => scene.remove(n)); if (V.pilot) scene.remove(V.pilot); }

// ---------- 組み立て・やり直し ----------
function clearScene() {
  for (const L of view.lamps) { scene.remove(L.g); scene.remove(L.light); }
  for (const V of view.enemies.values()) dropEnemyView(V);
  if (view.me) { scene.remove(view.me); scene.remove(view.me.userData.light); scene.remove(view.me.userData.halo); }
  view.meNodes.forEach(n => scene.remove(n));
  for (const g of view.loose.values()) scene.remove(g);
  for (const t of view.traps.values()) scene.remove(t.g);
  view.lamps = []; view.enemies = new Map(); view.meNodes = []; view.loose.clear(); view.traps.clear();
}
function build() {
  clearScene();
  S = makeState(level);
  view.lamps = S.lamps.map(makeLamp);
  view.enemies = new Map();
  view.me = makeMyHead();
  trailBirth.fill(-999);
  // 跡がはじめから少しあるように（見回りの道の上に）
  for (let k = 0; k < 600; k++) { const e = S.enemies[0]; if (!e) break; }
  ui.lost = 0; overlay(null); intro = qs.get('shot') || ui.frozen ? 0 : 2.6;
  syncAll(0, true);
}

// ---------- 状態を絵へ ----------
let now = 0;
function syncNodes(arr, body, mine) {
  while (arr.length < body.length) { const n = makeNode(mine); n.traverse(o => { if (o.isMesh) o.renderOrder = mine ? 2 : 0; }); arr.push(n); }
  while (arr.length > body.length) scene.remove(arr.pop());
  body.forEach((p, i) => { const g = arr[i]; if (g.userData.mine !== mine) setMine(g, mine); g.position.copy(P3(p.x, p.y)); g.rotation.y = -p.h; });
}
function legsWave(g, walk, i, moving) {
  const [l, r] = g.userData.legs; const a = moving ? Math.sin(walk * 5 - i * 0.9) : 0;
  l.rotation.z = a * 0.6; r.rotation.z = -a * 0.6;
}
function syncAll(dt, first = false) {
  // 提灯
  S.lamps.forEach((l, i) => {
    const L = view.lamps[i];
    if (l.lit && !L.lit) { L.lit = true; L.body.material = L.bodyLit; L.litT = 0; L.slots.forEach(s => { s.fr.visible = false; }); }
    if (!l.lit) L.slots.forEach((s, k) => { s.fill.visible = k < l.have; });
    if (L.lit) {
      L.litT = (L.litT ?? 9) + dt;
      const grow = Math.min(1, L.litT / 0.6);
      const f = 1 + Math.sin(now * 9 + L.flick) * 0.04 + Math.sin(now * 23 + L.flick * 2) * 0.03;
      L.light.intensity = C.lampI * f * grow; L.ring.material.opacity = 0.22 * grow;
    }
  });
  // ムカデ
  const alive = new Set();
  S.enemies.forEach((e, i) => {
    alive.add(e.id);
    let V = view.enemies.get(e.id);
    if (!V) { V = { head: makeEnemyHead(), nodes: [], markAcc: 0, side: 1, lastWalk: e.walk, pilot: null, fade: 1 }; view.enemies.set(e.id, V); }
    const h = V.head, u = h.userData;
    if (e.mode === 'down') { syncDown(e, V, dt); return; }
    h.position.copy(P3(e.x, e.y)); h.rotation.y = -e.h;
    const body = enemyBody(e);
    syncNodes(V.nodes, body, false);
    const moving = e.mode !== 'windup' && e.mode !== 'stun';
    legsWave(h, e.walk, 0, moving); V.nodes.forEach((g, k) => legsWave(g, e.walk, k + 1, moving));
    // 操縦士: ためのあいだは立ち上がる、ひるむと縮む
    const up = e.mode === 'windup' ? 0.12 : e.mode === 'chase' ? 0.06 : 0;
    u.pilot.position.y += (0.8 + up - u.pilot.position.y) * Math.min(1, dt * 12);
    u.flag.rotation.y = Math.sin(now * 9 + i) * 0.35;
    // 前照灯（扇）。気づくと赤みの白に
    const alert = e.mode === 'windup' || e.mode === 'chase';
    u.beam.color.set(alert ? C.beamAlert : C.beam); u.beam.intensity = e.mode === 'stun' ? 1.5 : alert ? 9 : 5;
    u.beam.position.copy(P3(e.x + Math.cos(e.h) * 0.6, e.y + Math.sin(e.h) * 0.6, 1.0));
    u.beam.target.position.copy(P3(e.x + Math.cos(e.h) * 4, e.y + Math.sin(e.h) * 4, 0));
    u.lamps.forEach(b => b.material.color.set(alert ? C.beamAlert : C.beam).multiplyScalar(2.2));
    // 跡: 足の左右にひとつずつ
    const dw = e.walk - V.lastWalk; V.lastWalk = e.walk; V.markAcc += dw;
    if (V.markAcc > 0.3) { V.markAcc = 0; V.side = -V.side; const px = -Math.sin(e.h), py = Math.cos(e.h); dropMark(e.x + px * 0.55 * V.side, e.y + py * 0.55 * V.side, e.h, now, e.walk); }
  });
  for (const [id, V] of view.enemies) if (!alive.has(id)) { dropEnemyView(V); view.enemies.delete(id); }
  // 自分
  const me = S.me, H = view.me, mu = H.userData;
  H.position.copy(P3(me.x, me.y)); H.rotation.y = -me.h;
  H.visible = me.inv <= 0 || Math.floor(now * 14) % 2 === 0;
  const mb = meBody(S);
  syncNodes(view.meNodes, mb, true);
  const moving = ui.moving;
  legsWave(H, me.walk, 0, moving); view.meNodes.forEach((g, k) => legsWave(g, me.walk, k + 1, moving));
  mu.flag.rotation.y = Math.sin(now * 8) * 0.3;
  // 火の数で手提灯の明るさが変わる
  const fk = me.fire / RULE.lose.fire;
  mu.light.position.copy(P3(me.x + Math.cos(me.h) * 0.5, me.y + Math.sin(me.h) * 0.5, 2.0));
  mu.light.intensity = 1.8 * ([0.4, 0.4, 0.7, 1.0][me.fire] ?? 1); mu.light.distance = 2.6 + 1.8 * fk;
  const fb = [0.4, 0.4, 0.7, 1.0][me.fire] ?? 1; // 火の数で手提灯の明るさ 100／70／40%
  mu.paper.material.color.set(C.amber).multiplyScalar(1.3 * fb);
  mu.halo.position.copy(P3(me.x, me.y, 0.03)); mu.halo.material.opacity = 0.55 * fb;
  // 落ちている積み木
  const seen = new Set();
  for (const b of S.loose) {
    seen.add(b.id);
    let g = view.loose.get(b.id);
    if (!g) { g = makeNode(false); g.position.copy(P3(b.x, b.y)); g.rotation.y = -b.h; g.userData.tilt = (b.x * 7.3 % 1) - 0.5; g.userData.legs.forEach(l => l.material = legMine); g.userData.pin.visible = false; view.loose.set(b.id, g); }
    const k = Math.min(1, Math.max(0, b.t) * 3), bob = Math.sin(now * 5 + b.x) * 0.03;
    g.userData.b.rotation.z = g.userData.tilt * 0.5 * k; g.userData.b.position.y = 0.42 - 0.1 * k + (b.t > 0.5 ? bob + 0.03 : 0);
    g.userData.legs.forEach((l, j) => { l.rotation.x = (j ? 1 : -1) * (1.0 + 0.4 * k); l.rotation.z = 0; });
    g.userData.b.material = looseMat; // 拾える積み木だけ、ゆっくり明滅（脈打つのはこれ1種類）
  }
  for (const [id, g] of view.loose) if (!seen.has(id)) { scene.remove(g); view.loose.delete(id); }
  // わな
  const seenT = new Set();
  for (const t of S.traps) {
    seenT.add(t.id);
    let T = view.traps.get(t.id); if (!T) { T = makeTrap(t); view.traps.set(t.id, T); }
    const armed = t.t >= RULE.trap.arm;
    T.dot.material.color.set(armed ? '#ffb24a' : '#5a2a20').multiplyScalar(armed ? 1.2 + 0.6 * Math.max(0, Math.sin(now * 6.3)) : 1);
    T.jaws.forEach(j => j.piv.rotation.x = j.s * Math.min(1.25, t.t * 6));
  }
  for (const [id, T] of view.traps) if (!seenT.has(id)) { scene.remove(T.g); view.traps.delete(id); }
}
const looseMat = new THREE.MeshToonMaterial({ color: '#e6dfcf', gradientMap: gradient, emissive: '#ffd9a0', emissiveIntensity: 0.1 });

// ---------- 入力（W はいつも画面の上。押した所へ進む・なぞれる） ----------
const keys = new Set();
const ui = { moving: false, pointer: null, target: null, trapQ: false, paused: false, lost: 0, frozen: false }; // frozen: 検証の道具が刻みを自分で進めるとき
addEventListener('keydown', e => {
  if (e.repeat && (e.code === 'Space' || e.code === 'KeyE')) return;
  keys.add(e.code);
  if (e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); ui.trapQ = true; }
  if (e.code === 'Escape') togglePause();
});
addEventListener('keyup', e => keys.delete(e.code));
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function groundAt(cx, cy) {
  const v = new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(v, camera);
  const hit = new THREE.Vector3(); return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, y: hit.z } : null;
}
const cv = renderer.domElement;
cv.addEventListener('pointerdown', e => { Sound.unlock(); ui.pointer = { x: e.clientX, y: e.clientY }; ui.target = groundAt(e.clientX, e.clientY); cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if (ui.pointer) { ui.pointer = { x: e.clientX, y: e.clientY }; ui.target = groundAt(e.clientX, e.clientY); } });
const up = () => { ui.pointer = null; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
const trapBtn = document.getElementById('trapBtn');
trapBtn.addEventListener('pointerdown', e => { e.preventDefault(); Sound.unlock(); ui.trapQ = true; });
function readInput() {
  let dx = 0, dy = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  if (dx || dy) ui.target = null;
  else if (ui.target) {
    // 押しているあいだは押した所へ（指が離れても、着くまで進む）
    const ex = ui.target.x - S.me.x, ey = ui.target.y - S.me.y, d = Math.hypot(ex, ey);
    if (d < 0.35 && !ui.pointer) ui.target = null; else if (d > 0.2) { dx = ex / d; dy = ey / d; }
  }
  ui.moving = !!(dx || dy);
  const inp = { dx, dy, trap: ui.trapQ }; ui.trapQ = false;
  return inp;
}

// ---------- 画面のふち ----------
const firesEl = document.getElementById('fires');
const dotsEl = document.getElementById('dots');
const lampMarks = [];
for (let i = 0; i < RULE.me.max; i++) { const b = document.createElement('b'); const a = Math.PI * (0.62 + 1.26 * i / (RULE.me.max - 1)); b.style.left = (42 + Math.cos(a) * 50) + 'px'; b.style.top = (42 + Math.sin(a) * 50) + 'px'; dotsEl.appendChild(b); }
let spotted = false;
function drawHud() {
  const f = S.me.fire;
  dotsEl.querySelectorAll('b').forEach((el, k) => el.classList.toggle('off', k >= S.me.n));
  // 消えた提灯が画面の外なら、画面のふちに印
  const offs = S.lamps.filter(l => !l.lit);
  while (lampMarks.length < offs.length) { const m = document.createElement('div'); m.className = 'toLamp hud'; document.body.appendChild(m); lampMarks.push(m); }
  lampMarks.forEach((m, i) => {
    const off = offs[i];
    if (!off || intro > 0) { m.hidden = true; return; }
    const p = P3(off.x, off.y, 1).project(camera);
    const inside = Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.92 && p.z < 1;
    m.hidden = inside;
    if (!inside) { let x = p.x, y = p.y; if (p.z > 1) { x = -x; y = -y; } const k = 0.88 / Math.max(Math.abs(x), Math.abs(y)); m.style.left = ((x * k + 1) / 2 * innerWidth) + 'px'; m.style.top = ((1 - y * k) / 2 * innerHeight) + 'px'; }
  });
  firesEl.querySelectorAll('i').forEach((el, k) => el.classList.toggle('off', k >= f));
  trapBtn.classList.toggle('off', S.me.n <= 0);
}
const ov = document.getElementById('overlay');
function overlay(kind) {
  ov.className = kind || ''; ov.hidden = !kind;
}

// ---------- 一時停止・メニュー ----------
const menu = document.getElementById('menu');
function togglePause(force) {
  ui.paused = force ?? !ui.paused; menu.hidden = !ui.paused;
}
document.getElementById('menuBtn').addEventListener('click', () => togglePause(true));
document.getElementById('resume').addEventListener('click', () => togglePause(false));
document.getElementById('restart').addEventListener('click', () => { togglePause(false); build(); });
document.getElementById('again').addEventListener('click', () => build());
const soundChk = document.getElementById('soundChk');
soundChk.checked = Sound.on; soundChk.addEventListener('change', () => Sound.set(soundChk.checked));
document.getElementById('ver').textContent = VERSION;
addEventListener('visibilitychange', () => { if (document.hidden) togglePause(true); });

// ---------- 後処理 ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.45, 0.8);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, dawn: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, dawn; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 p = vUv - 0.5; float v = smoothstep(0.85, 0.25, length(p * vec2(1.0, 0.8)) * 1.2);
      c.rgb *= mix(mix(0.25, 1.0, v), 1.0, dawn * 0.6);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.15, 1.05, 0.95) + vec3(0.08, 0.06, 0.05), dawn);
      c.rgb += (h(vUv * 931.0 + time) - 0.5) * 0.06;
      gl_FragColor = c;
    }`,
});
composer.addPass(finish);
function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);

// ---------- カメラ（回さない。たて持ちは引く。体が長くなると少し引く） ----------
const camT = new THREE.Vector3();
let camDist = 18, intro = 0;
const fogAt = () => 0.03 * 18 / camDist; // 霧はカメラの距離に合わせる（遠いと全部が消えるので）
function placeCamera(dt, snap) {
  const me = S.me;
  const aspect = innerWidth / innerHeight;
  const halfV = Math.tan(THREE.MathUtils.degToRad(17));
  // 見える範囲の短いほうが 11 マス以上（UX）。横持ちは横 15 マス。体が長いと少し引く
  const extra = Math.min(4, me.n * 0.25);
  let dist = Math.max((aspect < 1 ? 11 : 15) + extra) / (2 * halfV * aspect);
  dist = Math.max(dist, (11 + extra) / (2 * halfV * 1.25)); // たても 11 マス以上（見下ろしなので地面はたてに約1.25倍のびて見える）
  // たて持ちは自分を画面のまん中より少し上に（指で隠れず、上から来るものが早く見える）
  const tz = me.y + (aspect < 1 ? 0.08 * 2 * halfV * dist : 0);
  // はじめの2秒は野全体を見せてから寄る
  let tgt = P3(me.x, tz);
  if (intro > 0) { const k = Math.min(1, intro / 1.0); const w = S.field.w, h = S.field.h; const fit = Math.max(w / (2 * halfV * aspect), h / (2 * halfV * 0.82)) * 0.95; dist = dist + (fit - dist) * k; tgt = tgt.lerp(P3(w / 2, h / 2), k); }
  camT.lerp(tgt, snap ? 1 : 1 - Math.exp(-dt * (intro > 0 ? 8 : 4)));
  const tilt = 0.82; // 見下ろしの角度
  camera.position.set(camT.x, Math.sin(tilt) * dist, camT.z + Math.cos(tilt) * dist);
  camera.lookAt(camT.x, 0, camT.z - 0.3);
  camDist = dist;
}

// ---------- 音と出来事 ----------
function onEvents(evs) {
  for (const ev of evs) {
    if (ev.type === 'pick') Sound.pick(ev.n);
    else if (ev.type === 'trap') Sound.trap();
    else if (ev.type === 'cut') { Sound.cut(); confetti(ev.x, ev.y, 12); }
    else if (ev.type === 'down') { const e = S.enemies.find(x => x.id === ev.enemy); if (e) confetti(e.x, e.y, 8, '#f0ece0'); Sound.down(); }
    else if (ev.type === 'spot') { Sound.spot(); if (!spotted) { spotted = true; trapBtn.classList.add('pulse'); } }
    else if (ev.type === 'bite') { Sound.bite(); flash(); }
    else if (ev.type === 'stack') Sound.stack(ev.have);
    else if (ev.type === 'lit') { Sound.lit(); const l = S.lamps[ev.lamp]; confetti(l.x, l.y, 16, '#ffd9a0'); }
    else if (ev.type === 'fireBack') Sound.fire();
    else if (ev.type === 'won') { Sound.won(); setTimeout(() => overlay('won'), 2600); }
    else if (ev.type === 'lost') { ui.lost = 0.001; }
  }
}
const flashEl = document.getElementById('flash');
function flash() { flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); }

// ---------- 回す（固定の刻み 1/60 秒。1フレームで最大5刻み） ----------
let acc = 0, last = performance.now(), trailT = 0, dawn = 0;
function frame(t) {
  const real = Math.min(0.25, (t - last) / 1000); last = t;
  if (!ui.paused && S) {
    acc += real;
    let n = 0;
    if (ui.frozen) acc = 0;
    while (acc >= RULE.dt && n < 5) { step(S, readInput()); onEvents(S.events); acc -= RULE.dt; n++; }
    if (n === 5) acc = 0; // 遅れたら時間をゆっくりに
    now += real;
    syncAll(real);
    // 紙ふぶき
    for (let i = bits.length - 1; i >= 0; i--) { const m = bits[i], u = m.userData; u.life -= real; u.vy -= 9 * real; m.position.x += u.vx * real; m.position.z += u.vz * real; m.position.y = Math.max(0.02, m.position.y + u.vy * real); m.rotation.x += u.spin * real; m.material.opacity = Math.min(1, u.life * 2); if (u.life <= 0) { scene.remove(m); bits.splice(i, 1); } }
    trailT += real; if (trailT > 0.2) { trailT = 0; updateTrail(now); }
    // 負け: 1.5秒で暗くなって、その野の最初から
    if (ui.lost > 0) { ui.lost += real; overlay('lost'); if (ui.lost > 1.6) build(); }
    // 夜明け
    if (S.won) { dawn = Math.min(1, dawn + real / 2.5); hemi.intensity = 0.3 + dawn * 1.6; }
    else if (dawn > 0) { dawn = 0; hemi.intensity = 0.3; }
    scene.fog.density = fogAt() * (1 - dawn * 0.7);
    finish.uniforms.dawn.value = dawn;
    drawHud();
  }
  if (!ui.paused && intro > 0) intro -= real;
  placeCamera(real, false);
  finish.uniforms.time.value = (t / 1000) % 100;
  composer.render();
  requestAnimationFrame(frame);
}

// ---------- はじめる ----------
const STAGES = [['field1', 'はじめの野'], ['stage1', 'ふたつの群れの野']];
let lvName = qs.get('level') || 'field1', started = false;
function loadLevel(name) {
  lvName = name;
  return fetch(`levels/${name}.json?v=4`).then(r => r.json()).then(lv => {
    level = lv;
    build();
    placeCamera(0, true);
    nextBtn.hidden = !level.next;
    if (!started) { started = true; requestAnimationFrame(t => { last = t; frame(t); }); }
  });
}
const nextBtn = document.getElementById('next');
nextBtn.addEventListener('click', () => { if (level.next) { const u = new URL(location.href); u.searchParams.set('level', level.next); history.replaceState(null, '', u); loadLevel(level.next); } });
const stageList = document.getElementById('stages');
for (const [id, name] of STAGES) { const b = document.createElement('button'); b.className = 'btn sub'; b.textContent = name; b.addEventListener('click', () => { togglePause(false); const u = new URL(location.href); u.searchParams.set('level', id); history.replaceState(null, '', u); loadLevel(id); }); stageList.appendChild(b); }
loadLevel(lvName);

// デバッグ・検証用の窓（RULES の流儀。検証の道具が読む）
window.__ps = {
  get state() { return S; }, RULE, hash: () => hashState(S), load: name => loadLevel(name),
  step: (n = 1, inp = {}) => { for (let i = 0; i < n; i++) { step(S, inp); onEvents(S.events); } syncAll(0); },
  pause: v => togglePause(v), restart: () => build(), freeze: v => { ui.frozen = v; },
  // 台本の入力で n 刻み進める（見た目の動きも合わせる）
  run: (n, inp) => { for (let i = 0; i < n; i++) { step(S, typeof inp === 'function' ? inp(S) : inp || {}); onEvents(S.events); now += RULE.dt; syncAll(RULE.dt); } updateTrail(now); },
};
