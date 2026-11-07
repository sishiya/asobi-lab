// 花の小川: 3D の世界（ART.md。斜め見下ろしの箱庭）。花・草は js/flora3d.js、川の水は js/water3d.js、画面のしあげは js/post3d.js。
// 決まり（js/sim.js）の s・x を、奥行き・左右に置きかえて見せるだけ。決まりは変えない。
// makeWorld(three の親要素) → { setCourse(S), update(S, dt, view), finish(grade) ... }
import * as THREE from 'three';
import { RULE, squeezeAt, currentAt } from './sim.js';
import { drawBankFlower, drawGradeFlower } from './flowers.js';
import { floraMaterial, floraMesh, grassMaterial, grassMesh, gradeBouquet } from './flora3d.js';
import { makeRiver } from './water3d.js';
import { makePost } from './post3d.js';
import { makeBlob } from './blob3d.js';
import { makeProps } from './props3d.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const K = 0.04;                    // sim の長さ 1 → 3D の 0.04
const HALF = 1.7;                  // 川はばの半分
const PITCH = 36 * Math.PI / 180;  // 見下ろす角度（ART.md）
export const cxS = s => 3 * Math.sin(s / 380) * Math.cos(s / 1300);
export const P = (s, x = 0) => new THREE.Vector3(cxS(s) + x * HALF * 0.82, 0, -s * K);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const inc = src => src.replace(/#include <(\w+)>/g, '\n#include <$1>\n');
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- 絵の表（花 4種×3段階、しげみ・花びら・光の粒・わら） ----------
const CELL = 128, COLS = 4, ROWS = 5;
const KIND = ['daisy', 'cosmos', 'bell', 'rare'];
function makeAtlas() {
  const R = rng(3), c = document.createElement('canvas'); c.width = CELL * COLS; c.height = CELL * ROWS;
  const g = c.getContext('2d');
  KIND.forEach((k, i) => [0, 1, 2].forEach(st => drawBankFlower(g, k, st, i * CELL + CELL / 2, st * CELL + CELL / 2, CELL * 0.4, 0.3)));
  for (let i = 0; i < 18; i++) {  // しげみ
    const a = R() * 6.283, d = R() * 34, x = CELL / 2 + Math.cos(a) * d, y = 3 * CELL + CELL * 0.62 + Math.sin(a) * d * 0.5;
    const gr = g.createRadialGradient(x, y, 0, x, y, 22); gr.addColorStop(0, 'rgba(140,190,115,0.5)'); gr.addColorStop(1, 'rgba(140,190,115,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 22, 12, a, 0, 6.3); g.fill();
  }
  const blob = (x, y, rx, ry, rot, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, rx); gr.addColorStop(0, col.replace('A', '0.95')); gr.addColorStop(1, col.replace('A', '0')); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 6.3); g.fill(); };
  blob(CELL * 1.5, CELL * 3.5, 40, 22, 0.4, 'rgba(255,180,205,A)');                      // 花びら
  { const gr = g.createRadialGradient(CELL * 2.5, CELL * 3.5, 0, CELL * 2.5, CELL * 3.5, 50); gr.addColorStop(0, 'rgba(255,252,230,1)'); gr.addColorStop(0.3, 'rgba(255,248,210,0.5)'); gr.addColorStop(1, 'rgba(255,248,210,0)'); g.fillStyle = gr; g.fillRect(CELL * 2, CELL * 3, CELL, CELL); }  // 光の粒
  g.strokeStyle = 'rgba(214,184,100,0.95)'; g.lineCap = 'round';                          // わら
  for (const [dy, w] of [[-6, 5], [4, 4], [12, 3]]) { g.lineWidth = w; g.beginPath(); g.moveTo(CELL * 3 + 18, CELL * 3.5 + dy + 8); g.lineTo(CELL * 4 - 18, CELL * 3.5 + dy - 8); g.stroke(); }
  // きらめきの星（行4・列0）: 4本の光の筋＋まん中の光
  { const x = CELL / 2, y = CELL * 4.5, gr = g.createRadialGradient(x, y, 0, x, y, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,250,235,0.6)'); gr.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = gr; g.fillRect(x - 30, y - 30, 60, 60);
    for (const [dx, dy, l] of [[1, 0, 60], [0, 1, 60], [0.7, 0.7, 26], [0.7, -0.7, 26]]) { const lg = g.createLinearGradient(x - dx * l, y - dy * l, x + dx * l, y + dy * l); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.95)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.strokeStyle = lg; g.lineWidth = 3; g.beginPath(); g.moveTo(x - dx * l, y - dy * l); g.lineTo(x + dx * l, y + dy * l); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// カード（立てた絵）の材質: aCell で絵の表のどの絵か、aPhase でそよぎのずれ
function cardMaterial(atlas, additive = false) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: !additive, fog: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { map: { value: atlas }, t: { value: 0 }, wind: { value: 1 }, ...THREE.UniformsLib.fog },
    vertexShader: inc(`attribute vec2 aCell; attribute float aPhase; uniform float t; uniform float wind; varying vec2 vUv; varying float vNear; #include <fog_pars_vertex>
      void main(){
        vec2 u = .04 + uv * .92;   // ふちを少し内側から読む（縮めたとき、となりの絵がにじみ出て四角いふちが見えるので）
        vUv = vec2((u.x + aCell.x) / ${COLS}., 1. - ((1. - u.y) + aCell.y) / ${ROWS}.);
        vec3 p = position; p.x += sin(t * 1.3 * wind + aPhase) * .06 * wind * (p.y + .5);
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mvPosition;
        vNear = smoothstep(3.5, 7.5, -mvPosition.z);   // カメラのすぐ前の大きなカードは、うすく（四角いふちが見えるので）
        #include <fog_vertex> }`),
    fragmentShader: inc(`uniform sampler2D map; varying vec2 vUv; varying float vNear; #include <fog_pars_fragment>
      void main(){ vec4 c = texture2D(map, vUv); c.a *= vNear; if (c.a < .04) discard; gl_FragColor = c; ${additive ? 'gl_FragColor.rgb *= .45;' : ''} #include <fog_fragment> }`),   // 足し合わせる光（光の粒・後光・星）は弱め（光のにじみが足すので）
  });
}
function cards(list, mat, R) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const cell = new Float32Array(list.length * 2), ph = new Float32Array(list.length);
  list.forEach((f, i) => { cell[2 * i] = f.col; cell[2 * i + 1] = f.row; ph[i] = R() * 6.28; });
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  m.frustumCulled = false;
  return m;
}
const TILT = -0.35;   // カードを少しカメラへ傾ける
const _q2 = new THREE.Quaternion(), _Z = new THREE.Vector3(0, 0, 1);
const _open = new THREE.Color('#bff6ff'), _shut = new THREE.Color('#ff5fa0');
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
function place(m, i, x, y, z, size, rx = TILT, ry = 0) {
  _e.set(rx, ry, 0); _q.setFromEuler(_e); _s.setScalar(size); _v.set(x, y + size * 0.42, z);
  _m.compose(_v, _q, _s); m.setMatrixAt(i, _m);
}

// しずくの色（水 w → 水色・はちみつ色・琥珀。茶色にしない）
function wcol(w, out) {
  const t = Math.max(0, Math.min(1, (RULE.w0 - w) / (RULE.w0 - 0.62)));
  const a = [0.42, 0.84, 0.97], b = [1.0, 0.80, 0.36], c = [1.0, 0.68, 0.26];   // 終わりは はちみつの金（茶色に寄せない）
  const m = t < 0.65 ? a.map((v, i) => v + (b[i] - v) * t / 0.65) : b.map((v, i) => v + (c[i] - v) * (t - 0.65) / 0.35);
  return out.setRGB(m[0], m[1], m[2], THREE.SRGBColorSpace);
}

export function makeWorld(parent) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: false });   // ふちのなめらかさは画面のしあげの描き先（MSAA）で
  const DPR = Math.min(coarse ? 1.5 : 2, devicePixelRatio);   // スマホは 1.5 まで（重さ）
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  parent.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const PAPER = new THREE.Color('#f3ecdc'), CLOUD = new THREE.Color('#9aa0c0');
  scene.background = PAPER.clone();
  scene.fog = new THREE.Fog(PAPER.clone(), 18, 42);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 46);
  scene.add(new THREE.HemisphereLight('#fff6e6', '#9fb6c8', 1.3));
  // 太陽は川下の奥の低め（花びらが逆光で透け、遠くの川面に光の道ができる。高いと手前の水面が白くとぶ）
  const SUN = new THREE.Vector3(0.45, 0.42, -0.79).normalize();
  const sunL = new THREE.DirectionalLight('#fff1d6', 1.4); sunL.position.copy(SUN); scene.add(sunL);
  const floraMat = floraMaterial(SUN), grassMat = grassMaterial(SUN), headMat = floraMaterial(SUN, false);
  for (const m of [floraMat, grassMat, headMat]) m.userData.keep = true;
  const post = makePost(renderer, scene, camera, coarse);
  // 空の光（Poly Haven の CC0 の HDRI を縮めた assets/sky-env.hdr）: しずくに本物の空を映す。写実の株（ver. 0.7）はユーザーの判断で外した（ver. 0.8）
  let skyTex = null;
  const props = makeProps();   // 岸の石・アーチの根もと（TripoSG の形。ver. 0.9）
  let propsOn = true, propMeshes = [];
  const ready = Promise.all([new RGBELoader().loadAsync('./assets/sky-env.hdr').then(t => { t.mapping = THREE.EquirectangularReflectionMapping; skyTex = t; }).catch(e => console.warn('空の光を読めなかったので、手作りの空で', e)), props.loaded]);
  const raycaster = new THREE.Raycaster(), ground0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const touches = [floraMat.uniforms.touch.value, grassMat.uniforms.touch.value], touches2 = [floraMat.uniforms.touch2.value, grassMat.uniforms.touch2.value];
  const tch = { x: 0, z: 0, s: 0, r: 1.2 }, hov = { x: 0, z: 0, s: 0, r: 0.9 };
  const fing = { on: false, x: 0, z: 0, held: false, a: 0 };
  const ringMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 }, a: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float t; uniform float a; varying vec2 vUv;
      void main(){ vec2 q = vUv * 2. - 1.; float r = length(q), ang = atan(q.y, q.x);
        float edge = exp(-pow((r - .92) * 22., 2.)) * (.6 + .4 * sin(ang * 6. - t * 2.5));
        float pulse = exp(-pow((r - fract(t * .6)) * 9., 2.)) * (1. - fract(t * .6)) * .5;
        float fill = (1. - smoothstep(.2, .95, r)) * .12;
        gl_FragColor = vec4(vec3(1., .96, .82) * (edge + pulse + fill) * a, 1.); }` });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat); ring.rotation.x = -Math.PI / 2; ring.renderOrder = 1; scene.add(ring);
  ring.scale.setScalar(RULE.herd.R * K * 1.1);
  const atlas = makeAtlas();
  let course = null, built = null;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let clock = 0, prevLead = 0, speedSm = 0, lastS = null, camS = null, camHold = false;   // camS: カメラが見る川の道。指を押しているあいだは流れの速さで進む

  function resize() {
    const w = parent.clientWidth || innerWidth, h = parent.clientHeight || innerHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); post.resize(w, h, DPR);
  }
  addEventListener('resize', resize); resize();

  // ---------- コースから作る（川・花・アーチ・日なた・わら） ----------
  function setCourse(S) {
    if (built) { scene.remove(built); built.traverse(o => { o.geometry?.dispose(); if (o.material && o.material !== atlas && !o.material.userData.keep) o.material.dispose?.(); }); }   // keep＝使い回す材質（もう一度のたびにコンパイルしなおさない）
    built = new THREE.Group(); scene.add(built);
    course = S.course;
    const R = rng(course.seed * 31 + 7), L = RULE.len, pond0 = L - RULE.pond.len;

    // 地面
    const gc = document.createElement('canvas'); gc.width = gc.height = 512; const gg = gc.getContext('2d');
    gg.fillStyle = '#8fae6e'; gg.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      const x = R() * 512, y = R() * 512, r = 20 + R() * 60, col = R() < 0.5 ? '96,140,84' : R() < 0.5 ? '150,180,100' : '190,190,120';
      for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) { const gr = gg.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, `rgba(${col},0.22)`); gr.addColorStop(1, `rgba(${col},0)`); gg.fillStyle = gr; gg.fillRect(x + dx - r, y + dy - r, r * 2, r * 2); }
    }
    const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(6, 40); gt.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, L * K + 60), new THREE.MeshLambertMaterial({ map: gt }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, -L * K / 2); built.add(ground);

    // 川（出口の前で池にふくらみ、奥で閉じる）
    const widthAt = s => s < pond0 - 80 ? 1 : s < L ? 1 + 1.5 * Math.sin(Math.PI * smooth(pond0 - 80, L + 30, s)) : 1 + 1.5 * Math.sin(Math.PI * smooth(pond0 - 80, L + 30, s)) * (1 - smooth(L, L + 60, s));
    const river = makeRiver({ P, HALF, widthAt, L, sun: SUN });
    built.add(river.mesh);
    const water = river.mat;

    // 土手の花: 区画ごと。区画が飲んだ水の割合で、岸に近い花から順に咲く
    const bank = [];
    for (let s = -300; s < L + 200; s += 6) for (const side of [-1, 1]) {
      const pk = Math.floor(s / RULE.patch.every), p = s >= 0 && s < L ? course.patches[(side < 0 ? 0 : 1) * Math.ceil(L / RULE.patch.every) + pk] : null;
      const cnt = 1 + (R() < 0.6);
      for (let j = 0; j < cnt; j++) {
        const off = 1.0 + R() * R() * 4.5, near = off < 4;   // 岸から 4 までの花は、区画が水を飲むと咲く
        const kind = p?.rare && near && R() < 0.65 ? 3 : Math.floor(R() * 3);
        const ss = s + R() * 6, hw = HALF * 1.12 * widthAt(ss);
        const c = P(ss);
        bank.push({ patch: p && near ? p : null, need: Math.min(1, 0.12 + 0.88 * ((off - 1) / 3) * (0.6 + 0.4 * R())), x: c.x + side * (hw + off - 1 + 0.2), z: c.z, col: kind, row: p && near ? 0 : 2, size: 0.7 + R() * 0.45 + (kind === 3 ? 0.25 : 0), pop: -1 });
      }
    }
    // 種類: めずらしい花＝3、ほかは 0・1・2・4・5 から
    const KINDS = [0, 1, 2, 4, 5];
    bank.forEach(f => { f.kind = f.col === 3 ? 3 : KINDS[Math.floor(R() * KINDS.length)]; f.o = f.row === 2 ? 1 : 0.06; f.size = 1.15 + (f.size - 0.7) * 1.1; f.phase = R(); f.open = f.o; });
    // 土手の花も川の長さ 200 ごとに分け、映らない分は描かない。f.m＝その花の入った区切り、f.j＝区切りの中の番号
    const bankMeshes = [];
    for (let s0 = -400; s0 < L + 300; s0 += 200) {
      const part = bank.filter(f => -f.z / K >= s0 && -f.z / K < s0 + 200); if (!part.length) continue;
      const m = floraMesh(part, floraMat); m.computeBoundingSphere(); m.boundingSphere.radius += 1; built.add(m); bankMeshes.push(m);
      part.forEach((f, j) => { f.m = m; f.j = j; });
    }
    // 岸の石: 水ぎわに寄りあった石。乱数は別にして、ほかの置き場所を変えない
    const RS = rng(course.seed * 53 + 11), stoneList = [];
    propMeshes = [];
    for (let s = -200; s < L + 150; s += 22 + RS() * 45) {
      const side = RS() < 0.5 ? -1 : 1, c = P(s), hw = HALF * 1.12 * widthAt(s), sz = 0.6 + RS() * RS() * 0.8;
      stoneList.push({ x: c.x + side * (hw * (0.9 + RS() * 0.14)), z: c.z, y: -0.05 * sz, s: sz, ry: RS() * 6.283 });   // 少し水に入る石も
    }
    const stoneMesh = props.stones(stoneList); if (stoneMesh) { built.add(stoneMesh); propMeshes.push(stoneMesh); }
    // 遠くの花畑（いつも満開）と草。川の長さ 200 ごとに分け、カメラに映らない分は描かない（スマホの重さ）
    const meadowMeshes = [];
    for (let s0 = -400; s0 < L + 300; s0 += 200) {
      const meadow = [], grass = [];
      for (let i = 0; i < 170; i++) {
        const s = s0 + R() * 200, side = R() < 0.5 ? -1 : 1, off = 4.4 + R() * 8.5, c = P(s);
        meadow.push({ x: c.x + side * (HALF * 1.12 * widthAt(s) + off), z: c.z, kind: KINDS[Math.floor(R() * KINDS.length)], size: 1.0 + R() * 0.6, open: 1, phase: R() });
      }
      for (let i = 0, nG = coarse ? 650 : 1300; i < nG; i++) {
        const s = s0 + R() * 200, side = R() < 0.5 ? -1 : 1, off = 0.05 + R() * R() * 13, c = P(s);
        grass.push({ x: c.x + side * (HALF * 1.12 * widthAt(s) + off), z: c.z, size: 0.9 + R() * 0.8 - (off < 0.4 ? 0.4 : 0), phase: R() });
      }
      for (const mm of [floraMesh(meadow, floraMat), grassMesh(grass, grassMat)]) { mm.frustumCulled = true; mm.computeBoundingSphere(); mm.boundingSphere.radius += 1; built.add(mm); meadowMeshes.push(mm); }
    }

    // 日なた: 光の筋と、地面のあたたかい光
    const glow = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,236,160,0.3)'); gr.addColorStop(1, 'rgba(255,236,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    // 光の筋: カメラへ向く板。横はふわっと消え、上ほど濃い（筒にすると、ななめの四角い板に見えた）
    const shaftMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { t: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float t; varying vec2 vUv; varying float vD; void main(){ float x = 1. - abs(vUv.x * 2. - 1.); float a = pow(x, 2.2) * smoothstep(0., .5, vUv.y) * (.8 + .2 * sin(t * .7 + vUv.x * 9.)); a *= 1. - smoothstep(14., 26., vD); gl_FragColor = vec4(1., .94, .72, a * .07); }` });   // 光のにじみが足すので、うすく。遠い（霧の中の）筋は消す
    const shafts = [];
    const rares = course.patches.filter(p => p.rare);
    for (let i = 0; i < rares.length; i += 2) {
      const p = rares[i], side = p.side, c = P(p.s1, side * 1.6);
      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 9), shaftMat);
      shaft.position.set(c.x + side * 1.2, 4.3, c.z); built.add(shaft); shafts.push({ m: shaft, side });
      const pool = new THREE.Mesh(new THREE.CircleGeometry(3.6, 32), new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(c.x + side * 0.8, 0.01, c.z); built.add(pool);
    }

    // アーチ: 川をまたぐ花のつる＋両岸から寄るつるのカーテン
    const arches = [];
    const softBand = (() => {   // ふちがふわっと消える帯（白い四角に見えないように）
      const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
      const gx = g.createLinearGradient(0, 0, 128, 0); gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.25, '#fff'); gx.addColorStop(0.75, '#fff'); gx.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gx; g.fillRect(0, 0, 128, 64);
      g.globalCompositeOperation = 'destination-in';
      const gy = g.createLinearGradient(0, 0, 0, 64); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.5, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gy; g.fillRect(0, 0, 128, 64);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    for (const a of course.arches) {
      const c = P(a.s), grp = new THREE.Group(); grp.position.copy(c); built.add(grp);
      const d = P(a.s + 1).sub(c); grp.rotation.y = Math.atan2(-d.x, -d.z);
      const hw = HALF * 1.2;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-hw, 0, 0), new THREE.Vector3(-hw * 0.95, 1.8, 0), new THREE.Vector3(0, 2.7, 0), new THREE.Vector3(hw * 0.95, 1.8, 0), new THREE.Vector3(hw, 0, 0)]);
      // つる（ver. 0.8）: 1本の管は安っぽかったので、3本のつるがねじれて巻きあう形に。根もとほど太い
      for (let k = 0; k < 3; k++) {
        const pts = []; for (let i = 0; i <= 60; i++) { const u = i / 60, p = curve.getPoint(u), tg = curve.getTangent(u), nrm = new THREE.Vector3(-tg.y, tg.x, 0), ph = u * 9 + k * 2.094, rr = 0.07 + 0.03 * Math.sin(u * 23 + k);
          pts.push(p.clone().addScaledVector(nrm, Math.cos(ph) * rr).add(new THREE.Vector3(0, 0, Math.sin(ph) * rr))); }
        const vine = new THREE.CatmullRomCurve3(pts), tube = new THREE.TubeGeometry(vine, 120, 1, 6);
        const pos = tube.attributes.position, cen = new THREE.Vector3();   // 太さ: 根もと 0.05 → 上 0.028（管は半径 1 で作り、中心からの向きを縮める）
        for (let i = 0; i < pos.count; i++) { const seg = Math.floor(i / 7) / 120; vine.getPointAt(seg, cen); const v = new THREE.Vector3().fromBufferAttribute(pos, i).sub(cen); const r = 0.05 - 0.022 * Math.sin(seg * Math.PI); pos.setXYZ(i, cen.x + v.x * r, cen.y + v.y * r, cen.z + v.z * r); }
        tube.computeVertexNormals();
        grp.add(new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ color: k ? '#5f7f45' : '#6d6a3f', roughness: 0.85 })));
      }
      // つるに咲く花（頭だけ。茎がぶらさがらないように）: 大小まぜて、つるのまわりに
      const bl = []; for (let i = 0; i < 64; i++) { const u = R(), p = curve.getPoint(u), sz = 0.35 + R() * R() * 0.5, ang = R() * 6.283; bl.push({ x: p.x + Math.cos(ang) * 0.1, y: p.y + Math.sin(ang) * 0.1 - 0.55 * sz, z: p.z + (R() - 0.5) * 0.24, kind: [0, 1, 2, 4, 5][Math.floor(R() * 5)], size: sz, open: 0.8 + R() * 0.2, phase: R() }); }
      grp.add(floraMesh(bl, headMat));
      // 根もと: つるが地面に入るところに、土をつかむ株（大きさはつるの束が隠れるくらい）
      const roots = props.roots([-1, 1].map(sd => ({ x: sd * hw, z: 0, y: -0.06, s: 0.6 + RS() * 0.1, ry: RS() * 6.283 })));
      if (roots) { grp.add(roots); propMeshes.push(roots); }
      // カーテン: 両岸から寄る花の房（立体の花。すぼまりで川のまん中へ寄る）
      const cur = []; for (let i = 0; i < 24; i++) cur.push({ side: i < 12 ? -1 : 1, k: i % 12, x: 0, y: 0, z: 0, kind: i % 3 ? 2 : 1, size: 0.55 + R() * 0.2, open: 1, phase: R() });
      const cm = floraMesh(cur, floraMat); cm.frustumCulled = false; grp.add(cm);
      // 水面の光の帯: 通れる幅と色で、アーチの開きぐあいを見せる（開いている＝明るい水色、締まる＝赤むらさき）
      const band = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.4), new THREE.MeshBasicMaterial({ map: softBand, color: '#bff6ff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      band.rotation.x = -Math.PI / 2; band.position.y = 0.025; grp.add(band);
      arches.push({ a, cur, cm, hw, grp, band });
    }

    // わら
    const straws = course.fibers.map(f => ({ f, col: 3, row: 3, size: 0.55 }));
    const strawMesh = cards(straws, cardMaterial(atlas), R); built.add(strawMesh);

    // 大きな流れ（白い泡の帯）
    const foamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { t: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform float t; varying vec2 vUv; void main(){ float y = vUv.y + .12 * sin(vUv.x * 9. + t * 5.); float a = smoothstep(0., .55, y) * (1. - smoothstep(.55, 1., y)); a *= .6 + .4 * sin(vUv.x * 50. + t * 10.); vec3 c = mix(vec3(.75, .95, 1.), vec3(1.), a); gl_FragColor = vec4(c, a * .95); }` });
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2.4, 2.6), foamMat); foam.rotation.x = -Math.PI / 2; foam.visible = false; built.add(foam);

    // 池の奥の大きなつぼみ（おわりに、ここで7段の花が咲く）
    const end = P(L + 6);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(1.1, 28), new THREE.MeshLambertMaterial({ color: '#86b878' }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(end.x, 0.02, end.z); built.add(pad);
    const bud = new THREE.Group(); bud.position.set(end.x, 0, end.z); built.add(bud);
    bud.add(floraMesh([{ x: 0, z: 0, kind: 1, size: 3.2, open: 0.08, phase: 0.3, color: '#ffb3cf' }], floraMat));
    const bouquet = new THREE.Group(); bouquet.position.set(end.x, 0, end.z); bouquet.visible = false; built.add(bouquet);
    // 池のハスの葉
    const padFlowers = [];
    for (let i = 0; i < 9; i++) {
      const s = pond0 + 40 + R() * (RULE.pond.len - 60), side = R() < 0.5 ? -1 : 1, c = P(s, side * (1.3 + R() * 0.8)), r = 0.35 + R() * 0.3;
      const lp = new THREE.Mesh(new THREE.CircleGeometry(r, 28, 0.25, Math.PI * 2 - 0.5), new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(0.27 + R() * 0.05, 0.42, 0.42 + R() * 0.1), emissive: '#1f3a14' }));
      lp.rotation.set(-Math.PI / 2, 0, R() * 6.28); lp.position.set(c.x, 0.02, c.z); built.add(lp);
      if (R() < 0.5) padFlowers.push({ x: c.x, y: -0.12, z: c.z, kind: 1, size: 0.75, open: 1, phase: R(), color: '#ffb3cf' });
    }
    if (padFlowers.length) built.add(floraMesh(padFlowers, floraMat));

    // 舞う花びら・光の粒
    const petals = []; for (let i = 0; i < 160; i++) petals.push({ col: 1, row: 3, size: 0.12 + R() * 0.08, x: 0, y: -1, z: 0, vy: 0.2 + R() * 0.25, ph: R() * 6 });
    const petalMesh = cards(petals, cardMaterial(atlas), R); built.add(petalMesh);
    const motes = []; for (let i = 0; i < 60; i++) motes.push({ col: 2, row: 3, size: 0.18 + R() * 0.22, x: 0, y: 0.8 + R() * 3, z: 99, ph: R() * 6 });
    const moteMesh = cards(motes, cardMaterial(atlas, true), R); built.add(moteMesh);

    // しずく: 同じ塊の粒どうしをなめらかにつないだ、もちもちの形（js/blob3d.js）
    const blob = makeBlob(SUN, coarse, skyTex); built.add(blob.mesh); post.setRefract(blob.mesh);
    const jig = S.beads.map(() => 0);   // くっついた・ちぎれたときの、ぷるん
    const conn = S.beads.map(() => 1);  // つながりぐあい（くっついた直後は 0 から 1 へ）
    const vis = S.beads.map(() => null); // 描く位置: 決まりの位置へ、ばねで遅れてついていく（止まる・放る・締まるときに、もちっと揺れ戻る）
    const glints = []; for (let i = 0; i < 70; i++) glints.push({ col: 0, row: 4, size: 0, born: -9, life: 1, x: 0, y: 0, z: 0, rot: 0 });
    const glintMesh = cards(glints, cardMaterial(atlas, true), R); glintMesh.renderOrder = 4; built.add(glintMesh);
    // 花が咲いたときの、花びらと光のふき出し
    const bursts = []; for (let i = 0; i < 160; i++) bursts.push({ col: 1, row: 3, born: -9, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0.15 });
    const burstMesh = cards(bursts, cardMaterial(atlas, true), R); burstMesh.renderOrder = 4; built.add(burstMesh);
    // 予想のつぼみ（列の先頭の上に、このまま着いたら咲く花をうすく）
    const predC = document.createElement('canvas'); predC.width = predC.height = 128;
    const predT = new THREE.CanvasTexture(predC); predT.colorSpace = THREE.SRGBColorSpace;
    const pred = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), new THREE.MeshBasicMaterial({ map: predT, transparent: true, depthWrite: false, opacity: 0.85 }));
    pred.renderOrder = 3; built.add(pred);

    for (const m of propMeshes) m.visible = propsOn;
    Object.assign(state, { water, river, bank, arches, straws, strawMesh, foam, foamMat, bud, bouquet, end, petals, petalMesh, motes, moteMesh, blob, jig, conn, vis, pos: [], pred, predC, predT, predGrade: 0, glints, glintMesh, glintNext: 0, bursts, burstMesh, burstAt: 0, shafts, shaftMat, cardMats: [burstMesh, petalMesh, moteMesh, strawMesh, glintMesh].map(m => m.material) });
    state.R = R;
    camPos.set(0, 0, 0); camLook.set(0, 0, 0);
    prevLead = S.main.s; speedSm = 0; camS = null; camHold = false;
    state.finishT = -1;
  }
  const state = {};

  function drawBud_unused(c, open) {  // （段階A4 まで: 池のつぼみの絵。いまは立体のつぼみ）
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    const x = c.width / 2, y = c.height * 0.58;
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.32 * (1 + open); const gr = g.createRadialGradient(x, y, 0, x, y, 90); gr.addColorStop(0, 'rgba(255,214,228,0.95)'); gr.addColorStop(1, 'rgba(240,150,190,0.15)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x + Math.cos(a) * 26, y + Math.sin(a) * 40, 26, 58, a + Math.PI / 2, 0, 6.3); g.fill(); }
    g.fillStyle = 'rgba(120,170,100,0.9)'; g.beginPath(); g.ellipse(x, y + 52, 46, 16, 0, 0, 6.3); g.fill();
  }

  // ---------- 毎こま ----------
  // view: { showPred: bool, grade: いまの予想 }
  function update(S, dt, view = {}) {
    if (!course) return;
    clock += dt; lastS = S;
    const st = state, B = S.beads, L = RULE.len;
    const thSq = S.thunder?.kind === 'squeeze', thRush = S.thunder?.kind === 'rush';
    for (const m of [...st.cardMats, floraMat, grassMat, headMat]) { m.uniforms.t.value = clock; m.uniforms.wind.value += ((S.thunder ? 2.2 : 1) - m.uniforms.wind.value) * Math.min(1, dt * 2); }
    st.water.uniforms.t.value = clock; st.water.uniforms.flow.value += dt * (thRush ? 2.6 : 1.1);
    st.water.uniforms.cloud.value += ((S.thunder ? 1 : 0) - st.water.uniforms.cloud.value) * Math.min(1, dt * 2);
    const holding = !!(S.held && S.held.some(Boolean));
    if (holding && !fing.was) fing.snap = 1;   // つかんだ瞬間: 輪がきゅっと締まって明るく
    fing.was = holding && fing.on; fing.snap = Math.max(0, (fing.snap || 0) - dt * 3);
    fing.a += ((fing.on ? (holding ? 0.85 : 0.3) : 0) - fing.a) * Math.min(1, dt * 8);
    ring.visible = fing.a > 0.01; ring.position.set(fing.x, 0.03, fing.z); ringMat.uniforms.t.value = clock; ringMat.uniforms.a.value = fing.a + fing.snap * 0.8;
    ring.scale.setScalar(RULE.herd.R * K * 1.1 * (1 - 0.25 * fing.snap));
    // 指: さわった強さは少しずつ消える。花・草はおじぎし、ゆれがおさまる
    tch.s *= Math.exp(-dt * 1.6); hov.s += ((hov.on ? 0.22 : 0) - hov.s) * Math.min(1, dt * 5);
    for (const v of touches) v.set(tch.x, tch.z, tch.s, tch.r);
    for (const v of touches2) v.set(hov.x, hov.z, hov.s, hov.r);

    // 速さ（カメラの引き）
    const sp = (S.main.s - prevLead) / Math.max(dt, 1e-3); prevLead = S.main.s;
    speedSm += (Math.max(0, Math.min(120, sp)) - speedSm) * Math.min(1, dt * 2);

    // しずく: 粒の位置を 3D へ。池ではゆらゆら広がり、おわりはつぼみへ吸いこまれる
    const fin = st.finishT >= 0 ? Math.min(1, (clock - st.finishT) / 1.4) : 0, K3 = K * RULE.r;
    const list = st.pos;
    B.forEach((b, i) => {
      const p = P(b.s, b.x), dry = Math.max(0, Math.min(1, (RULE.w0 - b.w) / (RULE.w0 - 0.65)));
      let r = (b.pellet ? 1.1 : 1.6) * K3, y = r * 0.7;
      if (b.s > L - RULE.pond.len) p.x += Math.sin(b.g * 2.1 + clock * 0.8) * 0.25 * smooth(L - RULE.pond.len, L - RULE.pond.len + 120, b.s);
      const dx = p.x - tch.x, dz = p.z - tch.z;
      st.jig[i] = Math.max(st.jig[i] * Math.exp(-dt * 3), tch.s * Math.exp(-(dx * dx + dz * dz) / 1.5));   // 指が近いと、ぷるん
      if (fin > 0) { const e = Math.max(0, Math.min(1, fin * 1.3 - i * 0.01)); p.lerp(st.end, e); y += Math.sin(e * Math.PI) * 0.6; r *= 1 - e; }
      // 描く位置のばね（ω≈14、ζ≈0.35。はじめと、遠くへ跳んだときはそのまま置く）
      let v = st.vis[i];
      if (!v || Math.hypot(v.x - p.x, v.z - p.z) > 3) v = st.vis[i] = { x: p.x, z: p.z, vx: 0, vz: 0 };
      const h = Math.min(dt, 0.05), w2 = 196, c2 = 2 * 0.35 * 14;
      v.vx += (w2 * (p.x - v.x) - c2 * v.vx) * h; v.vz += (w2 * (p.z - v.z) - c2 * v.vz) * h; v.x += v.vx * h; v.z += v.vz * h;
      st.conn[i] = Math.min(1, st.conn[i] + dt * 4);
      const sv = Math.min(0.7, Math.hypot(v.vx, v.vz) * 0.12), vl = Math.hypot(v.vx, v.vz) || 1;
      list[i] = Object.assign(list[i] || {}, { x: v.x, y, z: v.z, r, g: b.g, dry, pellet: b.pellet, held: !!(S.held && S.held[i]), jig: st.jig[i], conn: 0.15 + 0.85 * st.conn[i], vx: v.vx / vl * sv, vz: v.vz / vl * sv });
      st.river.setBead(i, list[i].x, list[i].z, r / 0.3, dry);
    });
    st.blob.set(list, clock);
    // きらめき: しずくの上にぽっと生まれ、少しうしろへ流れて消える（速いほど多い）
    st.glintNext -= dt * (1.2 + speedSm * 0.03);   // きらめきの札は少なく（ver. 0.7: 本物の水の光は しずくの形の上で出す）
    while (st.glintNext < 0) {
      st.glintNext += 1;
      const g = st.glints.find(q => clock - q.born > q.life); let bi = Math.floor(Math.random() * B.length); if (Math.random() < 0.5) { const j = Math.floor(Math.random() * B.length); if (B[j].w < B[bi].w) bi = j; } const b = list[bi];   // 乾いた（金の）粒ほど、よくきらめく
      if (g && b.r > 0.05) { g.born = clock; g.life = 0.5 + Math.random() * 0.6; g.size = 0.18 + Math.random() * 0.25; g.x = b.x + (Math.random() - 0.5) * 0.3; g.y = b.y + 0.12 + Math.random() * 0.15; g.z = b.z + (Math.random() - 0.5) * 0.3; g.rot = Math.random() * 0.8; }
    }
    st.glints.forEach((g, i) => {
      const a = (clock - g.born) / g.life;
      const k = a < 0 || a > 1 ? 0 : Math.sin(a * Math.PI);
      _q.copy(camera.quaternion).multiply(_q2.setFromAxisAngle(_Z, g.rot + a * 0.6));
      _s.setScalar(g.size * k + 1e-4); _v.set(g.x, g.y + a * 0.15, g.z + a * 0.5); _m.compose(_v, _q, _s); st.glintMesh.setMatrixAt(i, _m);
    });
    st.glintMesh.instanceMatrix.needsUpdate = true;

    // 土手の花: 区画が飲んだ割合で咲く。咲くとき、ぽんとはずむ
    const need = p => p.rare ? RULE.patch.rareBloom : RULE.patch.bloom;
    let moved = false, bloomed = 0, rareBloomed = 0;
    const near0 = S.front + 500, near1 = S.center - 400;
    for (let i = 0; i < st.bank.length; i++) {
      const f = st.bank[i];
      if (!f.patch) continue;
      const s = -f.z / K; if (s > near0 || s < near1) { if (f.pop < 0) continue; }
      const frac = f.patch.drunk / need(f.patch);
      const row = frac >= f.need ? 2 : frac >= f.need * 0.45 ? 1 : 0;
      if (row !== f.row) {
        if (row === 2) { f.pop = clock; bloomed++; if (f.kind === 3) rareBloomed++; if (Math.abs(f.z - P(S.main.s).z) < 30) burst(f.x, 0.6, f.z, f.kind === 3 ? 10 : 3, f.kind === 3); }
        f.row = row;
      }
      const to = row === 2 ? 1 : row === 1 ? 0.45 : 0.06;   // つぼみ → 半分 → 満開。開きはなめらかに
      // 開きは ばね（ω≈5.5、ζ≈0.45）: 花びらがひらいて少し行きすぎ、そっと戻る。大きさは変えない（ユーザー「たんなる拡縮もうそっぽい」）
      f.ov = f.ov || 0;
      if (Math.abs(f.o - to) > 0.002 || Math.abs(f.ov) > 0.002) { const h = Math.min(dt, 0.05); f.ov += ((to - f.o) * 30 - f.ov * 5) * h; f.o += f.ov * h; const oa = f.m.geometry.attributes.aOpen; oa.array[f.j] = f.o; oa.needsUpdate = true; }
      if (f.pop >= 0 && clock - f.pop > 2) f.pop = -1;   // 遠くても ばねが落ちつくまでは動かす
    }

    // アーチ: すぼまりは決まりと同じ squeezeAt。雷で強く締まるときは色を赤むらさきに
    let tailS = 1e9; for (const b of B) tailS = Math.min(tailS, b.s);
    for (const A of st.arches) {
      A.grp.visible = A.a.s > tailS - 30;   // 列がくぐり終えたアーチは消す（カメラと列のあいだに来て、列を隠すので）
      if (!A.grp.visible) continue;
      const sq = Math.min(1, squeezeAt(A.a, S.t) * (thSq ? RULE.thunder.squeeze : 1));
      A.cur.forEach((c, i) => { const y = (c.k % 6) * 0.3, z = (Math.floor(c.k / 6) - 0.5) * 0.4; _m.makeScale(c.size, c.size, c.size).setPosition(c.side * (A.hw * 0.98 - sq * A.hw * 0.62 + (c.k % 2) * 0.12), y, z); A.cm.setMatrixAt(i, _m); });
      A.cm.instanceMatrix.needsUpdate = true;
      A.band.scale.x = Math.max(0.05, A.hw * 2 * (1 - 0.85 * sq));
      A.band.material.color.copy(_open).lerp(_shut, sq); A.band.material.opacity = 0.35 + 0.35 * sq;
    }

    // わら
    st.straws.forEach((w, i) => {
      if (w.f.taken) { place(st.strawMesh, i, 0, -9, 0, 0.001); return; }
      const p = P(w.f.s, w.f.x); place(st.strawMesh, i, p.x, 0.02 + 0.03 * Math.sin(clock * 2 + i), p.z, w.size, -1.2, i);
    });
    st.strawMesh.instanceMatrix.needsUpdate = true;

    // 大きな流れ
    const wv = course.waves.find(w => w.front !== null && !w.used);
    st.foam.visible = !!wv; st.foamMat.uniforms.t.value = clock;
    if (wv) { const p = P(wv.front), d = P(wv.front + 1).sub(p); st.foam.position.set(p.x, 0.03, p.z); st.foam.rotation.set(-Math.PI / 2, 0, Math.atan2(d.x, -d.z)); }

    // 花びら・光の粒（カメラのまわりに置き直す）
    const lz = P(S.main.s).z, R = st.R;
    st.petals.forEach((p, i) => {
      p.y -= p.vy * dt * (S.thunder ? 2 : 1); p.x += Math.sin(clock + p.ph) * 0.3 * dt; p.z += 0.4 * dt;
      if (p.y < 0 || p.z > lz + 8 || p.z < lz - 34) { p.y = 3 + R() * 3; p.z = lz + 4 - R() * 30; p.x = cxS(-p.z / K) + (R() - 0.5) * 14; }
      _e.set(clock * 0.9 + p.ph, clock * 0.7 + p.ph, 0); _q.setFromEuler(_e); _s.setScalar(p.size); _v.set(p.x, p.y, p.z); _m.compose(_v, _q, _s); st.petalMesh.setMatrixAt(i, _m);
    });
    st.petalMesh.instanceMatrix.needsUpdate = true;
    st.motes.forEach((m, i) => {
      if (m.z > lz + 8 || m.z < lz - 30) { m.z = lz + 4 - R() * 28; m.x = cxS(-m.z / K) + (R() - 0.5) * 12; }
      const tw = 0.6 + 0.4 * Math.sin(clock * 1.7 + m.ph);
      place(st.moteMesh, i, m.x + Math.sin(clock * 0.3 + m.ph) * 0.3, m.y + Math.sin(clock * 0.5 + m.ph) * 0.2, m.z, m.size * tw);
    });
    st.moteMesh.instanceMatrix.needsUpdate = true;

    // ふき出しの花びら
    st.bursts.forEach((b, i) => {
      const a = (clock - b.born) / b.life;
      if (a < 0 || a > 1) { _s.setScalar(1e-4); _v.set(0, -9, 0); _m.compose(_v, camera.quaternion, _s); st.burstMesh.setMatrixAt(i, _m); return; }
      const tt = clock - b.born;
      _q.copy(camera.quaternion).multiply(_q2.setFromAxisAngle(_Z, tt * 3 + i));
      _s.setScalar(b.size * Math.sin(Math.min(1, a * 1.5) * Math.PI * 0.5) * (1 - a * a) + 1e-4); _v.set(b.x + b.vx * tt, b.y + b.vy * tt - 1.6 * tt * tt, b.z + b.vz * tt); _m.compose(_v, _q, _s); st.burstMesh.setMatrixAt(i, _m);
    });
    st.burstMesh.instanceMatrix.needsUpdate = true;
    // 光の筋はカメラへ向ける
    st.shaftMat.uniforms.t.value = clock;
    for (const sh of st.shafts) sh.m.quaternion.copy(camera.quaternion);

    // 予想のつぼみ
    st.pred.visible = !!view.showPred && fin === 0;
    if (st.pred.visible) {
      if (view.grade !== st.predGrade) { st.predGrade = view.grade; const g = st.predC.getContext('2d'); g.clearRect(0, 0, 128, 128); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,250,0.95)'); gr.addColorStop(0.6, 'rgba(255,252,240,0.7)'); gr.addColorStop(1, 'rgba(255,252,240,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); drawGradeFlower(g, view.grade, 64, 64, 40); st.predT.needsUpdate = true; }
      const p = P(S.main.s + 14, S.main.x); st.pred.position.set(p.x, 0.75 + 0.06 * Math.sin(clock * 2), p.z); st.pred.quaternion.copy(camera.quaternion);
    }

    // おわり: しずくがつぼみに吸いこまれて、7段の花が咲く
    if (st.finishT >= 0) {
      const t2 = (clock - st.finishT - 1.2) / 1.6;
      if (t2 > 0 && !st.drawnGrade) {   // つぼみがはじけて、段の花束が咲く
        st.drawnGrade = true; st.bud.visible = false;
        st.bouquet.clear(); st.bouquet.add(floraMesh(gradeBouquet(st.grade), headMat)); st.bouquet.visible = true;
        burst(st.end.x, 1.2, st.end.z, 60, true, 2.2);
      }
      const e = Math.max(0, Math.min(1, (clock - st.finishT) / 1.2));
      st.bud.scale.setScalar(1 + 0.25 * Math.sin(e * Math.PI * 3) * e);   // しずくを吸いこむあいだ、ふくらんではずむ
      const k = t2 <= 0 ? 0.01 : 1.9 * (1 - Math.pow(1 - Math.min(1, t2), 3)) + 0.12 * Math.sin(Math.min(1, t2) * Math.PI) ;
      st.bouquet.scale.setScalar(Math.max(0.01, k));
    }

    // カメラ: 列のうしろ上から川下を見る。たての画面でも両岸が入るまで引く。速いほど少し引く
    const hf = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
    let tl = 1e9; for (const b of B) tl = Math.min(tl, b.s);
    const spread = Math.max(0, Math.min(1, (S.front - tl - 60) / 260));   // なかまが散らばっているほど引いて、群れのまん中へ寄せる
    const followS = Math.min(S.main.s * (1 - spread * 0.5) + (S.front + tl) / 2 * spread * 0.5 + 6, L - 40);   // いちばん大きな塊を追う
    if (camS === null) camS = followS;
    if (camHold && fin <= 0) camS = Math.min(camS + currentAt(S.main.x) * dt, L - 40);   // 押しているあいだ: 流れの速さで（指を止めると、つまんだ塊は流れといっしょに下る）
    else camS += (followS - camS) * Math.min(1, dt * 2.5);
    const leadS = camS, lead = P(leadS, S.main.x * 0.5);
    const dir = P(leadS + 120, S.main.x * 0.3).sub(lead).setY(0).normalize();
    const back = Math.max(12.5, 4.75 / Math.tan(hf / 2)) + speedSm * 0.015 + spread * 6 - fin * 2;
    const wide = Math.max(0, Math.min(1, (camera.aspect - 0.7) / 0.8)), target = lead.clone().addScaledVector(dir, -4 * (1 - wide) - 1.2 * wide);   // たての画面は列のうしろを見る（列が画面の上〜中ほど。下に置いた指で隠れない）。横の画面は列がまん中に
    if (fin > 0) { const e = smooth(0, 1, fin); target.lerp(_v.copy(st.end).addScaledVector(dir, -2.6), e); target.y = 0.6 * e; }   // おわりは池の奥の花へ寄る（花が画面の上のほう＝結果のカードの上に来るよう、少し手前を見る）
    const bk = back + (8.5 - back) * (fin > 0 ? smooth(0, 1, fin) : 0);
    const want = target.clone().addScaledVector(dir, -bk * Math.cos(PITCH)).setY(target.y + bk * Math.sin(PITCH));
    const first = camPos.lengthSq() === 0;
    camPos.lerp(want, first ? 1 : Math.min(1, dt * 3)); camLook.lerp(target, first ? 1 : Math.min(1, dt * 4.5));
    camera.position.copy(camPos); camera.lookAt(camLook);

    // 雷: 一瞬白く、そのあとしばらく青むらさきにくもる
    let bg = PAPER.clone(), flash = 0;
    if (S.thunder) { const age = S.t - (S.thunder.until - RULE.thunder.dur); flash = age < 0.15 ? 0.7 : 0; bg.lerp(CLOUD, 0.42); }
    scene.background.lerp(bg, Math.min(1, dt * 6)); scene.fog.color.copy(scene.background);
    const G = post.grade.uniforms; G.flash.value = flash; G.dim.value += ((S.thunder ? 0.55 : 0) - G.dim.value) * Math.min(1, dt * 3);

    post.render();
    return { bloomed, rareBloomed };
  }

  // 花びら（めずらしい花は星も）を、ふわっとふき出す
  function burst(x, y, z, n, star = false, power = 1) {
    const st = state, cell = st.burstMesh.geometry.attributes.aCell;
    for (let k = 0; k < n; k++) {
      st.burstAt = (st.burstAt + 1) % st.bursts.length;
      const b = st.bursts[st.burstAt], a = Math.random() * 6.283, sp = (0.6 + Math.random() * 0.9) * power, isStar = star && k % 2;
      Object.assign(b, { born: clock, life: 0.9 + Math.random() * 0.7, x, y, z, vx: Math.cos(a) * sp, vy: (1.2 + Math.random()) * power, vz: Math.sin(a) * sp, size: isStar ? 0.45 : 0.18 + Math.random() * 0.1 });
      cell.setXY(st.burstAt, isStar ? 0 : 1, isStar ? 4 : 3);
    }
    cell.needsUpdate = true;
  }
  // ぷるん: その粒の塊ぜんぶ（S は最後に update でもらったもの）。join なら、くっついた2粒のつながりを 0 から
  function wobble(i, k = 1, join = -1) {
    const st = state, B = lastS?.beads; if (!st.jig || !B || i >= B.length) return;
    B.forEach((b, j) => { if (b.g === B[i].g) st.jig[j] = Math.max(st.jig[j], k * (j === i ? 1 : 0.6)); });
    if (join >= 0) { st.conn[i] = 0; st.conn[join] = 0; }
  }
  function finish(grade) { state.finishT = clock; state.grade = grade; state.drawnGrade = false; setFinger(null); }

  // 画面の点 → 地面の点と、川の道 s・左右 x（near のまわりで、いちばん近い道の点をさがす）
  const _nd = new THREE.Vector2();
  function pick(cx, cy, near) {
    const r = renderer.domElement.getBoundingClientRect();
    _nd.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
    raycaster.setFromCamera(_nd, camera);
    const pt = new THREE.Vector3(); if (!raycaster.ray.intersectPlane(ground0, pt)) return null;
    let best = near, bd = 1e9;
    for (let s = near - 200; s <= near + 500; s += 4) { const c = P(s), d = (c.x - pt.x) ** 2 + (c.z - pt.z) ** 2; if (d < bd) { bd = d; best = s; } }
    return { s: best, x: (pt.x - P(best).x) / (HALF * 0.82), point: pt };   // P と同じく、左右は x の向きでずらす
  }
  // さわる: 波紋と、花・草のおじぎ。hover は押していないマウス（弱く、なでるだけ）
  let lastRip = -9;
  function touch(pt, str = 1) {
    tch.x = pt.x; tch.z = pt.z; tch.s = Math.max(tch.s, 0.55 * str);
    if (clock - lastRip > 0.2 && state.river) { lastRip = clock; state.river.ripple(pt.x, pt.z, clock, str); }
  }
  // 押した瞬間: 花の上なら花びらが散る（岸から離れたところ）、水なら強い波紋
  function splash(pt) {
    const c = P(-pt.z / K), off = Math.abs(pt.x - c.x) - HALF * 1.12;
    if (off > 0.1) burst(pt.x, 0.6, pt.z, 5, false, 0.7);
    else if (state.river) { state.river.ripple(pt.x, pt.z, clock, 1.6); lastRip = clock; }
  }
  // 指の輪: 指（せき）がとどく範囲を水面の光の輪で。つかんでいる＝明るい、マウスを乗せただけ＝うすい
  function setFinger(pt, held = false) { fing.on = !!pt; if (pt) { fing.x = pt.x; fing.z = pt.z; fing.held = held; } }
  function setFingerSim(fs, fx) { setFinger(P(fs, fx), true); }
  function holdCam(on) { camHold = !!on; }
  function hover(pt) { hov.on = !!pt; if (pt) { hov.x = pt.x; hov.z = pt.z; } }
  const setProps = on => { propsOn = on; for (const m of propMeshes) m.visible = on; };   // 見くらべ用（ひと休みの画面のボタン）
  return { ready, setCourse, setProps, update, finish, resize, camera, pick, touch, hover, splash, wobble, setFinger, setFingerSim, holdCam, speed: () => speedSm, _state: state };   // _state はしらべ用
}
