// 花の小川: 3D の世界（ART.md。斜め見下ろしの箱庭、水彩の花を立てたカード）。
// 決まり（js/sim.js）の s・x を、奥行き・左右に置きかえて見せるだけ。決まりは変えない。
// makeWorld(three の親要素) → { setCourse(S), update(S, dt, view), finish(grade) ... }
import * as THREE from 'three';
import { RULE, squeezeAt } from './sim.js';
import { drawBankFlower, drawGradeFlower } from './flowers.js';

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
      void main(){ vec4 c = texture2D(map, vUv); c.a *= vNear; if (c.a < .04) discard; gl_FragColor = c; #include <fog_fragment> }`),
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
  const a = [0.66, 0.89, 0.95], b = [1.0, 0.84, 0.42], c = [1.0, 0.74, 0.30];   // 終わりは はちみつの金（茶色に寄せない）
  const m = t < 0.65 ? a.map((v, i) => v + (b[i] - v) * t / 0.65) : b.map((v, i) => v + (c[i] - v) * (t - 0.65) / 0.35);
  return out.setRGB(m[0], m[1], m[2], THREE.SRGBColorSpace);
}

export function makeWorld(parent) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(matchMedia('(pointer: coarse)').matches ? 1.5 : 2, devicePixelRatio));   // スマホは 1.5 まで（重さ）
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  parent.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const PAPER = new THREE.Color('#f3ecdc'), CLOUD = new THREE.Color('#9aa0c0');
  scene.background = PAPER.clone();
  scene.fog = new THREE.Fog(PAPER.clone(), 18, 42);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
  scene.add(new THREE.HemisphereLight('#fff6e6', '#9fb6c8', 1.6));
  const atlas = makeAtlas();
  let course = null, built = null;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let clock = 0, prevLead = 0, speedSm = 0;

  function resize() {
    const w = parent.clientWidth || innerWidth, h = parent.clientHeight || innerHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  // ---------- コースから作る（川・花・アーチ・日なた・わら） ----------
  function setCourse(S) {
    if (built) { scene.remove(built); built.traverse(o => { o.geometry?.dispose(); if (o.material && o.material !== atlas) o.material.dispose?.(); }); }
    built = new THREE.Group(); scene.add(built);
    course = S.course;
    const R = rng(course.seed * 31 + 7), L = RULE.len, pond0 = L - RULE.pond.len;

    // 地面
    const gc = document.createElement('canvas'); gc.width = gc.height = 512; const gg = gc.getContext('2d');
    gg.fillStyle = '#cfdcae'; gg.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      const x = R() * 512, y = R() * 512, r = 20 + R() * 60, col = R() < 0.5 ? '118,170,105' : R() < 0.5 ? '170,200,120' : '220,214,150';
      for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) { const gr = gg.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, `rgba(${col},0.22)`); gr.addColorStop(1, `rgba(${col},0)`); gg.fillStyle = gr; gg.fillRect(x + dx - r, y + dy - r, r * 2, r * 2); }
    }
    const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(6, 40); gt.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, L * K + 60), new THREE.MeshLambertMaterial({ map: gt }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, -L * K / 2); built.add(ground);

    // 川（出口の前で池にふくらみ、奥で閉じる）
    const widthAt = s => s < pond0 - 80 ? 1 : s < L ? 1 + 1.5 * Math.sin(Math.PI * smooth(pond0 - 80, L + 30, s)) : 1 + 1.5 * Math.sin(Math.PI * smooth(pond0 - 80, L + 30, s)) * (1 - smooth(L, L + 60, s));
    const pos = [], uv = [], idx = []; let n = 0;
    for (let s = -400; s <= L + 60; s += 20) {
      const c = P(s), c2 = P(s + 1), d = c2.sub(c).normalize(), nx = -d.z, nz = d.x, hw = HALF * 1.12 * widthAt(s);
      const c0 = P(s);
      for (const side of [-1, 1]) { pos.push(c0.x + nx * side * hw, 0, c0.z + nz * side * hw); uv.push(side < 0 ? 0 : 1, s / 100); }
      if (n) idx.push(2 * n - 2, 2 * n - 1, 2 * n, 2 * n - 1, 2 * n + 1, 2 * n);
      n++;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rg.setIndex(idx);
    const water = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true,
      uniforms: { t: { value: 0 }, ...THREE.UniformsLib.fog },
      vertexShader: inc(`varying vec2 vUv; #include <fog_pars_vertex>
        void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition; #include <fog_vertex> }`),
      fragmentShader: inc(`uniform float t; varying vec2 vUv; #include <fog_pars_fragment>
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          float e = abs(vUv.x - .5) * 2.;
          vec3 col = mix(vec3(.38,.66,.82), vec3(.70,.88,.93), smoothstep(.2, 1., e));
          float r = n(vec2(vUv.x * 6., vUv.y * 3. + t)) * n(vec2(vUv.x * 13. + 3., vUv.y * 7. + t * 1.5));
          col += smoothstep(.45, .7, r) * .12;                                         // 大きな模様は濃淡だけ
          vec2 q = vec2(vUv.x * 46., vUv.y * 30. + t * 2.); float k = h(floor(q) + floor(t * 3.));
          col += step(.965, k) * smoothstep(.22, 0., length(fract(q) - .5)) * 1.2;      // 小さくまたたく光の点
          col = mix(col, col * vec3(.86,.92,1.), smoothstep(.55, .58, n(vUv * vec2(3., 1.5))) * .25);
          gl_FragColor = vec4(col, (1. - smoothstep(.82, 1., e)) * .92);
          #include <fog_fragment>
        }`),
    });
    built.add(new THREE.Mesh(rg, water));

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
    const bankMesh = cards(bank, cardMaterial(atlas), R); built.add(bankMesh);
    bank.forEach((f, i) => place(bankMesh, i, f.x, 0, f.z, f.size));
    // 遠くの花畑（いつも満開）としげみ
    // 川の長さ 200 ごとに分け、カメラに映らない分は描かない（スマホの重さ）
    const meadowMat = cardMaterial(atlas), meadowMeshes = [];
    for (let s0 = -400; s0 < L + 300; s0 += 200) {
      const meadow = [];
      for (let i = 0; i < 230; i++) {
        const s = s0 + R() * 200, side = R() < 0.5 ? -1 : 1, off = 4.6 + R() * 8, leaf = R() < 0.35, c = P(s);
        meadow.push({ x: c.x + side * (HALF * 1.12 * widthAt(s) + off), z: c.z, col: leaf ? 0 : Math.floor(R() * 3), row: leaf ? 3 : 2, size: leaf ? 1.2 + R() * 0.9 : 0.55 + R() * 0.5 });
      }
      const mm = cards(meadow, meadowMat, R); meadow.forEach((f, i) => place(mm, i, f.x, 0, f.z, f.size));
      mm.frustumCulled = true; mm.computeBoundingSphere(); built.add(mm); meadowMeshes.push(mm);
    }
    const meadowMesh = meadowMeshes[0];

    // 日なた: 光の筋と、地面のあたたかい光
    const glow = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,236,160,0.55)'); gr.addColorStop(1, 'rgba(255,236,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    // 光の筋: カメラへ向く板。横はふわっと消え、上ほど濃い（筒にすると、ななめの四角い板に見えた）
    const shaftMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { t: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform float t; varying vec2 vUv; void main(){ float x = 1. - abs(vUv.x * 2. - 1.); float a = pow(x, 2.2) * smoothstep(0., .5, vUv.y) * (.8 + .2 * sin(t * .7 + vUv.x * 9.)); gl_FragColor = vec4(1., .94, .72, a * .24); }` });
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
      grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.06, 6), new THREE.MeshLambertMaterial({ color: '#7d9a62' })));
      const bl = []; for (let i = 0; i < 24; i++) bl.push({ u: i / 23, col: 2, row: 2, size: 0.4 + R() * 0.2 });
      const bm = cards(bl, cardMaterial(atlas), R); grp.add(bm);
      bl.forEach((b, i) => { const p = curve.getPoint(b.u); place(bm, i, p.x, p.y - 0.25, p.z + 0.05, b.size); });
      const cur = []; for (let i = 0; i < 20; i++) cur.push({ side: i < 10 ? -1 : 1, k: i % 10, col: i % 2 === 0 ? 2 : 0, row: i % 2 === 0 ? 2 : 3, size: 0.75 + R() * 0.3 });
      const cm = cards(cur, cardMaterial(atlas), R); grp.add(cm);
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
    const budC = document.createElement('canvas'); budC.width = budC.height = 256;
    const budT = new THREE.CanvasTexture(budC); budT.colorSpace = THREE.SRGBColorSpace;
    const bud = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: budT, transparent: true, depthWrite: false, fog: false }));
    bud.position.set(end.x, 0.6, end.z); bud.rotation.x = TILT; built.add(bud);
    drawBud(budC, 0); budT.needsUpdate = true;
    // 池のハスの葉
    for (let i = 0; i < 7; i++) { const s = pond0 + 40 + R() * (RULE.pond.len - 60), side = R() < 0.5 ? -1 : 1, c = P(s, side * (1.3 + R() * 0.8)); const lp = new THREE.Mesh(new THREE.CircleGeometry(0.35 + R() * 0.25, 18), new THREE.MeshLambertMaterial({ color: '#9cc888', transparent: true, opacity: 0.9 })); lp.rotation.x = -Math.PI / 2; lp.position.set(c.x, 0.015, c.z); built.add(lp); }

    // 舞う花びら・光の粒
    const petals = []; for (let i = 0; i < 160; i++) petals.push({ col: 1, row: 3, size: 0.12 + R() * 0.08, x: 0, y: -1, z: 0, vy: 0.2 + R() * 0.25, ph: R() * 6 });
    const petalMesh = cards(petals, cardMaterial(atlas), R); built.add(petalMesh);
    const motes = []; for (let i = 0; i < 90; i++) motes.push({ col: 2, row: 3, size: 0.25 + R() * 0.3, x: 0, y: 0.4 + R() * 3, z: 99, ph: R() * 6 });
    const moteMesh = cards(motes, cardMaterial(atlas, true), R); built.add(moteMesh);

    // しずく
    const beads = [];
    for (let i = 0; i < S.beads.length; i++) {
      // しずく: すけたまん中・虹色にゆらぐふち・白いつや2つ・内からのほのかな光（ユーザー「もっとキラキラ綺麗な感じに」）
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { col: { value: new THREE.Color() }, t: { value: 0 }, ph: { value: i * 0.7 }, dry: { value: 0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 col; uniform float t; uniform float ph; uniform float dry; varying vec3 vN; varying vec3 vV;
          vec3 hue(float h){ return clamp(abs(fract(h + vec3(0., .333, .667)) * 6. - 3.) - 1., 0., 1.); }
          void main(){ float f = 1. - max(dot(vN, vV), 0.);
            vec3 c = mix(col * 1.15, col * .85, f * f);
            c += (1. - f) * (.12 + .45 * dry) * col;                                       // 内からの光（乾くほど、はちみつのように中が光る）
            c = mix(c, hue(f * 1.4 + t * .15 + ph + vN.x * .3), smoothstep(.45, .95, f) * (.75 - .4 * dry));  // 虹色のふち（湿っているほど強い）
            float sp = pow(max(dot(vN, normalize(vec3(-.45, .6, .65))), 0.), 60.) * 1.4;
            float sp2 = pow(max(dot(vN, normalize(vec3(.35, -.4, .85))), 0.), 18.) * .45;
            gl_FragColor = vec4(c + sp + sp2, mix(.28, .7, dry) + .5 * f + sp); }` });   // 湿っているほど、すけて縁だけ光る
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), m); b.renderOrder = 2; built.add(b); beads.push(b);
    }
    // しずくのまわりの光（うしろの、ほのかな後光）と、きらめきの星
    const halos = S.beads.map(() => ({ col: 2, row: 3, size: 1.0 }));
    const haloMesh = cards(halos, cardMaterial(atlas, true), R); haloMesh.renderOrder = 1; built.add(haloMesh);
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

    Object.assign(state, { water, bank, bankMesh, arches, straws, strawMesh, foam, foamMat, bud, budC, budT, end, petals, petalMesh, motes, moteMesh, beads, pred, predC, predT, predGrade: 0, halos, haloMesh, glints, glintMesh, glintNext: 0, bursts, burstMesh, burstAt: 0, shafts, shaftMat, cardMats: [bankMesh, meadowMesh, burstMesh, petalMesh, moteMesh, strawMesh, haloMesh, glintMesh, ...arches.map(a => a.cm)].map(m => m.material) });
    state.R = R;
    camPos.set(0, 0, 0); camLook.set(0, 0, 0);
    prevLead = S.beads[0].s; speedSm = 0;
    state.finishT = -1;
  }
  const state = {};

  function drawBud(c, open) {  // 池のつぼみ（まだ咲いていない）
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    const x = c.width / 2, y = c.height * 0.58;
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.32 * (1 + open); const gr = g.createRadialGradient(x, y, 0, x, y, 90); gr.addColorStop(0, 'rgba(255,214,228,0.95)'); gr.addColorStop(1, 'rgba(240,150,190,0.15)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x + Math.cos(a) * 26, y + Math.sin(a) * 40, 26, 58, a + Math.PI / 2, 0, 6.3); g.fill(); }
    g.fillStyle = 'rgba(120,170,100,0.9)'; g.beginPath(); g.ellipse(x, y + 52, 46, 16, 0, 0, 6.3); g.fill();
  }

  // ---------- 毎こま ----------
  // view: { showPred: bool, grade: いまの予想 }
  function update(S, dt, view = {}) {
    if (!course) return;
    clock += dt;
    const st = state, B = S.beads, L = RULE.len;
    const thSq = S.thunder?.kind === 'squeeze', thRush = S.thunder?.kind === 'rush';
    for (const m of st.cardMats) { m.uniforms.t.value = clock; m.uniforms.wind.value = S.thunder ? 2.2 : 1; }
    st.water.uniforms.t.value += dt * (thRush ? 2.2 : S.ride > 0 ? 3 : 0.9);

    // 速さ（カメラの引き）
    const sp = (B[0].s - prevLead) / Math.max(dt, 1e-3); prevLead = B[0].s;
    speedSm += (Math.max(0, Math.min(120, sp)) - speedSm) * Math.min(1, dt * 2);

    // しずく
    const col = new THREE.Color();
    const fin = st.finishT >= 0 ? Math.min(1, (clock - st.finishT) / 1.4) : 0;
    B.forEach((b, i) => {
      const p = P(b.s, b.x), m = st.beads[i];
      const r = b.pellet ? 0.72 : 1;
      let y = 0.18 * r + 0.03 * Math.sin(clock * 3 + i * 0.7);
      if (b.s > L - RULE.pond.len) p.x += Math.sin(i * 2.1 + clock * 0.8) * 0.45 * smooth(L - RULE.pond.len, L - RULE.pond.len + 120, b.s);   // 池では、ゆらゆらと左右に広がる
      if (fin > 0) { const e = Math.min(1, fin * 1.3 - i * 0.02); p.lerp(st.end, Math.max(0, e)); y += Math.sin(Math.max(0, e) * Math.PI) * 0.6; m.scale.setScalar(r * (1 - Math.max(0, e))); }
      else m.scale.set(r, 0.75 * r, r);
      m.position.set(p.x, y, p.z);
      m.material.uniforms.col.value.copy(wcol(b.w, col)); m.material.uniforms.t.value = clock; m.material.uniforms.dry.value = Math.max(0, Math.min(1, (RULE.w0 - b.w) / (RULE.w0 - 0.65)));
      const hs = m.scale.x * (0.95 + 0.12 * Math.sin(clock * 2.3 + i));
      _s.setScalar(hs); _v.set(m.position.x, m.position.y, m.position.z - 0.05); _m.compose(_v, camera.quaternion, _s); st.haloMesh.setMatrixAt(i, _m);
    });
    st.haloMesh.instanceMatrix.needsUpdate = true;
    // きらめき: しずくの上にぽっと生まれ、少しうしろへ流れて消える（速いほど多い）
    st.glintNext -= dt * (6 + speedSm * 0.12);
    while (st.glintNext < 0) {
      st.glintNext += 1;
      const g = st.glints.find(q => clock - q.born > q.life); let bi = Math.floor(Math.random() * B.length); if (Math.random() < 0.5) { const j = Math.floor(Math.random() * B.length); if (B[j].w < B[bi].w) bi = j; } const b = st.beads[bi];   // 乾いた（金の）玉ほど、よくきらめく
      if (g && b.scale.x > 0.05) { g.born = clock; g.life = 0.5 + Math.random() * 0.6; g.size = 0.25 + Math.random() * 0.35; g.x = b.position.x + (Math.random() - 0.5) * 0.4; g.y = b.position.y + 0.1 + Math.random() * 0.25; g.z = b.position.z + (Math.random() - 0.5) * 0.3; g.rot = Math.random() * 0.8; }
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
    const cell = st.bankMesh.geometry.attributes.aCell;
    let moved = false, bloomed = 0, rareBloomed = 0;
    const near0 = B[0].s + 500, near1 = B[B.length - 1].s - 200;
    for (let i = 0; i < st.bank.length; i++) {
      const f = st.bank[i];
      if (!f.patch) continue;
      const s = -f.z / K; if (s > near0 || s < near1) { if (f.pop < 0) continue; }
      const frac = f.patch.drunk / need(f.patch);
      const row = frac >= f.need ? 2 : frac >= f.need * 0.45 ? 1 : 0;
      if (row !== f.row) {
        if (row === 2) { f.pop = clock; bloomed++; if (f.col === 3) rareBloomed++; if (Math.abs(f.z - P(B[0].s).z) < 30) burst(f.x, 0.5, f.z, f.col === 3 ? 10 : 3, f.col === 3); }
        f.row = row; cell.setXY(i, f.col, row); cell.needsUpdate = true;
      }
      if (f.pop >= 0) {
        const age = clock - f.pop, k = age < 0.6 ? 1 + 0.35 * Math.sin(age / 0.6 * Math.PI) : 1;
        place(st.bankMesh, i, f.x, 0, f.z, f.size * k); moved = true;
        if (age >= 0.6) f.pop = -1;
      }
    }
    if (moved) st.bankMesh.instanceMatrix.needsUpdate = true;

    // アーチ: すぼまりは決まりと同じ squeezeAt。雷で強く締まるときは色を赤むらさきに
    const tailS = B[B.length - 1].s;
    for (const A of st.arches) {
      A.grp.visible = A.a.s > tailS - 30;   // 列がくぐり終えたアーチは消す（カメラと列のあいだに来て、列を隠すので）
      if (!A.grp.visible) continue;
      const sq = Math.min(1, squeezeAt(A.a, S.t) * (thSq ? RULE.thunder.squeeze : 1)) * (S.ride > 0 ? 0 : 1);
      A.cur.forEach((c, i) => { const y = 0.15 + (c.k % 5) * 0.38, z = (Math.floor(c.k / 5) - 0.5) * 0.4; place(A.cm, i, c.side * (A.hw * 0.98 - sq * A.hw * 0.62 + (c.k % 2) * 0.12), y - 0.35, z, c.size); });
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
    const lz = P(B[0].s).z, R = st.R;
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
      const p = P(B[0].s + 8, B[0].x); st.pred.position.set(p.x, 0.75 + 0.06 * Math.sin(clock * 2), p.z); st.pred.quaternion.copy(camera.quaternion);
    }

    // おわり: しずくがつぼみに吸いこまれて、7段の花が咲く
    if (st.finishT >= 0) {
      const t2 = (clock - st.finishT - 1.2) / 1.6;
      if (t2 > 0 && !st.drawnGrade) { const g = st.budC.getContext('2d'); g.clearRect(0, 0, 256, 256); drawGradeFlower(g, st.grade, 128, 128, 112); st.budT.needsUpdate = true; st.drawnGrade = true; burst(st.end.x, 1.2, st.end.z, 60, true, 2.2); }
      const k = t2 <= 0 ? 1 : 1 + 2.2 * (1 - Math.pow(1 - Math.min(1, t2), 3));
      st.bud.scale.setScalar(k); st.bud.position.y = 0.6 * k;
    }

    // カメラ: 列のうしろ上から川下を見る。たての画面でも両岸が入るまで引く。速いほど少し引く
    const hf = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
    const leadS = Math.min(B[0].s, L - 40), lead = P(leadS, B[0].x * 0.5);
    const dir = P(leadS + 120, B[0].x * 0.3).sub(lead).setY(0).normalize();
    const back = Math.max(12.5, 4.75 / Math.tan(hf / 2)) + speedSm * 0.015 - fin * 2;
    const target = lead.clone().addScaledVector(dir, -1.2);   // 列のまん中より少し前を見る（列が画面のまん中に来る）
    const want = target.clone().addScaledVector(dir, -back * Math.cos(PITCH)).setY(back * Math.sin(PITCH));
    const first = camPos.lengthSq() === 0;
    camPos.lerp(want, first ? 1 : Math.min(1, dt * 3)); camLook.lerp(target, first ? 1 : Math.min(1, dt * 4.5));
    camera.position.copy(camPos); camera.lookAt(camLook);

    // 雷: 一瞬白く、そのあとしばらく青むらさきにくもる
    let bg = PAPER.clone();
    if (S.thunder) { const age = S.t - (S.thunder.until - RULE.thunder.dur); bg = age < 0.15 ? bg.lerp(new THREE.Color('#ffffff'), 0.9) : bg.lerp(CLOUD, 0.42); }
    scene.background.lerp(bg, Math.min(1, dt * 6)); scene.fog.color.copy(scene.background);

    renderer.render(scene, camera);
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
  function finish(grade) { state.finishT = clock; state.grade = grade; state.drawnGrade = false; }
  return { setCourse, update, finish, resize, camera };
}
