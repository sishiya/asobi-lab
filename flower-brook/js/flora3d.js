// 花の小川: 立体の花と草（PLAN.md 段階A3。板の絵をやめ、花びら・しべ・茎・葉を形で作る）。
// 花は1つの形（花びら最大12枚＋しべ＋茎＋葉2枚）をインスタンスで何千も描く。花びらの開き（aOpen 0〜1）は頂点シェーダーで角度を変えるだけ。
// 指にさわられると、まわりの花・草がおじぎしてゆれる（touch）。風のそよぎは位置ごとにずれる。
import * as THREE from 'three';

const inc = src => src.replace(/#include <(\w+)>/g, '\n#include <$1>\n');
const NP = 12, PU = 4, CS = 8, SS = 4, LS = 3;   // 花びらの数の上限・花びらの刻み・しべ・茎・葉の刻み
export const HEAD = 0.55;                          // 花の高さ（インスタンスの大きさ 1 のとき）

// 花の種類: [花びらの数, 長さ, 幅, 反り, 色, しべの色]（めずらしい花は 3）
export const FLORA_KINDS = [
  { n: 12, len: 0.30, wid: 0.055, cup: 0.10, col: '#fffaf2', eye: '#ffc93a' },   // 0 ヒナギク
  { n: 8, len: 0.30, wid: 0.10, cup: 0.06, col: '#f78bb5', eye: '#ffd54a' },     // 1 コスモス
  { n: 5, len: 0.22, wid: 0.12, cup: 0.22, col: '#9d8af2', eye: '#fff2b0' },     // 2 スミレ色の小花
  { n: 6, len: 0.34, wid: 0.12, cup: 0.18, col: '#ffcf5e', eye: '#ff7aa8' },     // 3 めずらしい花（金。光る）
  { n: 5, len: 0.26, wid: 0.15, cup: 0.30, col: '#ff7a68', eye: '#5a3a70' },     // 4 ヒナゲシ
  { n: 10, len: 0.24, wid: 0.07, cup: 0.08, col: '#ffe680', eye: '#ffb03a' },    // 5 黄色の小花
];

function flowerGeometry() {
  const pos = [], part = [], idx = [];
  const add = (x, y, z, p) => { pos.push(x, y, z); part.push(p); return part.length - 1; };
  for (let i = 0; i < NP; i++) {   // 花びら: x＝根もとからの長さ 0〜1、y＝横 -1〜1、z＝何枚目
    const base = part.length;
    for (let u = 0; u <= PU; u++) for (let v = -1; v <= 1; v++) add(u / PU, v, i, 0);
    for (let u = 0; u < PU; u++) for (let v = 0; v < 2; v++) { const a = base + u * 3 + v; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4); }
  }
  { const c = add(0, 0, 0, 1); for (let k = 0; k < CS; k++) add(1, 0, k / CS, 1); for (let k = 0; k < CS; k++) idx.push(c, c + 1 + k, c + 1 + (k + 1) % CS); }   // しべ
  { const b = part.length; for (let u = 0; u <= SS; u++) for (const v of [-1, 1]) add(u / SS, v, 0, 2); for (let u = 0; u < SS; u++) { const a = b + u * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }   // 茎
  for (const side of [-1, 1]) { const b = part.length; for (let u = 0; u <= LS; u++) for (const v of [-1, 1]) add(u / LS, v, side, 3); for (let u = 0; u < LS; u++) { const a = b + u * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }   // 葉
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setIndex(idx);
  return g;
}

// 草: 1株に葉 5 枚（それぞれ 4 刻み）
const NB = 5, BU = 4;
function grassGeometry() {
  const pos = [], idx = [];
  for (let b = 0; b < NB; b++) {
    const base = pos.length / 3;
    for (let u = 0; u <= BU; u++) for (const v of [-1, 1]) pos.push(u / BU, v, b);
    for (let u = 0; u < BU; u++) { const a = base + u * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}

const COMMON = `
  uniform float t; uniform float wind; uniform vec4 touch; uniform vec4 touch2;
  float hash(float n){ return fract(sin(n) * 43758.5453); }
  // 風と指: 根もとからの高さ h（0〜1）ほど大きく動く。wp は株の位置
  vec2 sway(vec2 wp, float ph, float h){
    float w = sin(t * 1.4 * wind + wp.x * .55 + wp.y * .35 + ph) * .7 + sin(t * 2.3 * wind + wp.y * 1.1 + ph * 2.) * .3;
    vec2 o = vec2(w * .07 * wind, w * .025 * wind);
    for (int k = 0; k < 2; k++) {
      vec4 tc = k == 0 ? touch : touch2;
      vec2 d = wp - tc.xy; float r = length(d) + 1e-4, s = tc.z * exp(-r * r / (tc.w * tc.w));
      o += d / r * s * (.5 + .25 * sin(t * 11. + r * 4.));
    }
    return o * h * h;
  }`;

// 花の材質。kinds の形・色はユニフォームの表から
// stems: false で茎と葉を描かない（おわりの花束。花の頭だけを形に並べる）
export function floraMaterial(sunDir, stems = true) {
  const K = FLORA_KINDS;
  const vec4s = K.map(k => new THREE.Vector4(k.n, k.len, k.wid, k.cup));
  const eyes = K.map(k => new THREE.Color(k.eye));
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: true,
    uniforms: { t: { value: 0 }, wind: { value: 1 }, touch: { value: new THREE.Vector4(0, 0, 0, 1) }, touch2: { value: new THREE.Vector4(0, 0, 0, 1) }, sun: { value: sunDir }, shape: { value: vec4s }, eye: { value: eyes }, stems: { value: stems ? 1 : 0 }, ...THREE.UniformsLib.fog },
    vertexShader: inc(`attribute float aPart; attribute float aKind; attribute float aOpen; attribute float aPhase; attribute vec3 aCol;
      uniform vec4 shape[${K.length}]; uniform vec3 eye[${K.length}]; uniform float stems;
      varying vec3 vCol; varying vec3 vN; varying vec3 vW; varying float vU; varying float vPart; varying float vGlow; varying float vV;
      ${COMMON}
      #include <fog_pars_vertex>
      void main(){
        int ki = int(aKind + .5); vec4 sh = shape[ki];
        float open = aOpen, H = ${HEAD} * mix(.8, 1., open);
        vec3 head = vec3(0., H, 0.), up = vec3(0., 1., 0.);
        vec3 p; vec3 n = up; vec3 col = aCol; vU = position.x; vV = 0.; vPart = aPart; vGlow = 0.;
        float pale = 1. - smoothstep(0., .6, open);   // つぼみは色がうすい
        if (aPart < .5) {           // 花びら
          float i = position.z, u = position.x, v = position.y;
          float a = i / sh.x * 6.2832 + aPhase * 7.;
          float fold = mix(1.3, .2, open), L = sh.y * mix(.5, 1., open), W = sh.z * mix(.55, 1., open);
          vec3 d = vec3(cos(a), 0., sin(a)), tg = vec3(-sin(a), 0., cos(a));
          float r = u * L, th = fold + sh.w * u * 2.2 * open;
          float w = W * pow(sin(3.1416 * clamp(u * .92 + .08, 0., 1.)), .55);
          p = head + d * (r * cos(th)) + up * (r * sin(th)) + tg * (v * w) - up * abs(v) * w * .3 * open;
          n = normalize(-d * sin(th) + up * cos(th));
          if (i >= sh.x) p = head;    // この種類にない花びらはつぶす
          col = mix(col * mix(.62, 1.1, smoothstep(0., .8, u)), vec3(.94, .95, .9), pale * .3);   // 根もとは濃く、先は明るく
          vV = v;
          vGlow = ki == 3 ? open : 0.;
        } else if (aPart < 1.5) {   // しべ
          float a = position.z * 6.2832, rc = .045 + sh.y * .18 * open;
          p = head + vec3(cos(a), 0., sin(a)) * rc * position.x + up * (.03 * (1. - position.x * position.x) + .01);
          col = mix(eye[ki], vec3(.6, .75, .45), pale);
        } else if (aPart < 2.5) {   // 茎
          p = vec3(position.y * .014, position.x * H, 0.); n = vec3(0., .3, 1.);
          col = vec3(.32, .50, .27);
        } else {                    // 葉
          float u = position.x, s = position.z;
          p = vec3(s * u * .34, .02 + u * .16 - u * u * .1, position.y * .07 * sin(3.1416 * u) + s * .03);
          n = normalize(vec3(-s * .3, 1., 0.));
          col = mix(vec3(.30, .55, .28), vec3(.55, .76, .38), u);
        }
        if (aPart > 1.5 && stems < .5) p = head;   // 茎と葉をつぶす
        // 頭をカメラ（＋z）へ少し向ける
        if (aPart < 1.5) { vec3 q = p - head; float c = cos(.45), s2 = sin(.45); q = vec3(q.x, q.y * c - q.z * s2, q.y * s2 + q.z * c); p = head + q;
          n = vec3(n.x, n.y * c - n.z * s2, n.y * s2 + n.z * c); }
        vec3 wp0 = (instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        p.xz += sway(wp0.xz, aPhase * 6.28, clamp(p.y / ${HEAD}, 0., 1.4)) / max(instanceMatrix[0][0], .1);
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.);
        vW = wp.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n); vCol = col;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`),
    fragmentShader: inc(`uniform vec3 sun; varying vec3 vCol; varying vec3 vN; varying vec3 vW; varying float vU; varying float vPart; varying float vGlow; varying float vV;
      #include <fog_pars_fragment>
      void main(){
        vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
        vec3 V = normalize(cameraPosition - vW);
        float dif = max(dot(N, sun), 0.), back = max(dot(-N, sun), 0.);
        vec3 col0 = vCol;
        if (vPart < .5) col0 *= 1. - .07 * pow(abs(sin(vV * 26.)), 6.) * smoothstep(.1, .5, vU);   // 花びらのうすい筋
        vec3 c = col0 * (.62 + .5 * dif);
        if (vPart < .5) c += col0 * col0 * back * .55 * (.4 + .6 * vU) + vec3(1., .96, .88) * pow(1. - abs(dot(N, V)), 3.) * .14;   // 花びらは光が透ける（先ほど うすいので明るく、色は濃く）・ふちが明るい   // 花びらは光が透ける・ふちが明るい
        c += vCol * vGlow * (.55 + .25 * vU);       // めずらしい花は内から光る（光のにじみが拾う）
        gl_FragColor = vec4(pow(c, vec3(2.2)), 1.);   // 色は画面の色で考え、ここで直線の色へ（OutputPass が画面の色にもどす）
        #include <fog_fragment>
      }`),
  });
}

// list: [{ x, y?, z, size, kind, open, phase, color? }]
export function floraMesh(list, mat) {
  const g = flowerGeometry(), n = list.length;
  const kind = new Float32Array(n), open = new Float32Array(n), ph = new Float32Array(n), col = new Float32Array(n * 3);
  const c = new THREE.Color();
  list.forEach((f, i) => {
    kind[i] = f.kind; open[i] = f.open; ph[i] = f.phase;
    c.set(f.color || FLORA_KINDS[f.kind].col); c.offsetHSL((f.phase - 0.5) * 0.03, 0, (f.phase * 7 % 1 - 0.5) * 0.06);
    col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b;
  });
  g.setAttribute('aKind', new THREE.InstancedBufferAttribute(kind, 1));
  g.setAttribute('aOpen', new THREE.InstancedBufferAttribute(open, 1));
  g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
  g.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 3));
  const m = new THREE.InstancedMesh(g, mat, n);
  const M = new THREE.Matrix4();
  list.forEach((f, i) => { M.makeScale(f.size, f.size, f.size).setPosition(f.x, f.y || 0, f.z); m.setMatrixAt(i, M); });
  m.instanceMatrix.needsUpdate = true;
  return m;
}

// おわりに池の奥で咲く花束（段の番号 → 立体の花の並び）。名前は flowers.js の GRADE_NAME と同じ花
// 返すのは floraMesh に渡す並び（池の葉の上が原点）
export function gradeBouquet(grade) {
  const L = [], R = (() => { let a = grade * 977 + 13; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  const add = (x, y, z, kind, size, color, open = 1) => L.push({ x, y: y - size * HEAD * (0.8 + 0.2 * open), z, kind, size, open, phase: R(), color });   // y は花の頭の高さ
  if (grade === 1) {        // スズランの小さな鈴: 白い小さな花が弓なりに
    for (let i = 0; i < 11; i++) { const a = -1 + i / 5; add(a * 0.75, 0.5 - a * a * 0.3, Math.sin(i) * 0.1, 2, 0.65, '#fffdf2', 0.55); }
  } else if (grade === 2) { // アジサイの房: 小花の丸い房
    for (let i = 0; i < 46; i++) { const u = R() * 6.283, v = Math.acos(R()), r = 0.75; add(Math.cos(u) * Math.sin(v) * r, 0.25 + Math.cos(v) * r * 0.8, Math.sin(u) * Math.sin(v) * r, 2, 0.55, R() < 0.5 ? '#8fb2ff' : '#b79cff'); }
  } else if (grade === 3) { // 枝咲きのフジ: たれ下がる房が4本
    for (let c = 0; c < 4; c++) for (let j = 0; j < 8; j++) add((c - 1.5) * 0.45, 1.5 - j * 0.17, (c % 2) * 0.15, 2, 0.6 - j * 0.04, j < 4 ? '#a68bf0' : '#cbb8ff');
  } else if (grade === 4) { // 大輪のシャクヤク: 花びらを重ねた大きな1輪
    [['#f59bbf', 3.2, 0.5], ['#ffb3cf', 2.6, 0.58], ['#ffd0e0', 2.0, 0.66], ['#ffe6ee', 1.4, 0.74]].forEach(([c, s, y]) => add(0, y, 0, 1, s, c));
  } else if (grade === 5) { // 八重の花びら
    [['#fff0f5', 2.6, 0.5], ['#ffd9e6', 2.1, 0.58], ['#ffe7a8', 1.5, 0.66]].forEach(([c, s, y]) => add(0, y, 0, 0, s, c));
    for (let i = 0; i < 5; i++) { const a = i * 1.257; add(Math.cos(a) * 0.9, 0.3, Math.sin(a) * 0.6, 0, 1.0, '#ffe3ee'); }
  } else if (grade === 6) { // タンポポの綿毛: 白い小花の玉
    for (let i = 0; i < 40; i++) { const u = R() * 6.283, v = Math.acos(2 * R() - 1), r = 0.55; add(Math.cos(u) * Math.sin(v) * r, 0.9 + Math.cos(v) * r, Math.sin(u) * Math.sin(v) * r, 5, 0.32, '#ffffff'); }
  } else {                  // 霧の虹: 虹の色の花が弓なりに
    ['#ff8a8a', '#ffb36b', '#ffe27a', '#9ee39a', '#8fd0ff', '#a8a0ff', '#e0a0ff'].forEach((c, i) => { const a = -1 + i / 3; add(a * 1.1, 0.6 - a * a * 0.4, 0, 0, 1.0, c); });
  }
  return L;
}

export function grassMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: true,
    uniforms: { t: { value: 0 }, wind: { value: 1 }, touch: { value: new THREE.Vector4(0, 0, 0, 1) }, touch2: { value: new THREE.Vector4(0, 0, 0, 1) }, sun: { value: sunDir }, ...THREE.UniformsLib.fog },
    vertexShader: inc(`attribute float aPhase; uniform vec3 sun; varying float vU; varying float vT; varying float vL;
      ${COMMON}
      #include <fog_pars_vertex>
      void main(){
        float b = position.z, u = position.x, v = position.y, sd = aPhase * 13. + b * 7.31;
        float a = hash(sd) * 6.2832, h = .3 + .35 * hash(sd + 1.), lean = .1 + .18 * hash(sd + 2.);
        vec3 base = vec3(cos(a), 0., sin(a)) * .07 * hash(sd + 3.);
        vec3 dir = vec3(cos(a + 1.), 0., sin(a + 1.));
        vec3 side = vec3(-dir.z, 0., dir.x);
        vec3 p = base + dir * lean * u * u + vec3(0., h * u, 0.) + side * v * .045 * (1. - u * .85);
        vec3 wp0 = (instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        p.xz += sway(wp0.xz, aPhase * 6.28 + b, u) * 1.4 / max(instanceMatrix[0][0], .1);
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.);
        vU = u; vT = hash(sd + 4.); vL = dot(normalize(vec3(dir.x, 1.2, dir.z)), sun);
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`),
    fragmentShader: inc(`uniform vec3 sun; varying float vU; varying float vT; varying float vL;
      #include <fog_pars_fragment>
      void main(){
        vec3 lo = vec3(.30, .48, .26), hi = mix(vec3(.62, .82, .40), vec3(.86, .88, .52), vT);
        vec3 c = mix(lo, hi, smoothstep(0., 1., vU)) * (.8 + .35 * max(vL, 0.));
        gl_FragColor = vec4(pow(c, vec3(2.2)), 1.);   // 色は画面の色で考え、ここで直線の色へ（OutputPass が画面の色にもどす）
        #include <fog_fragment>
      }`),
  });
}

// list: [{ x, z, size, phase }]
export function grassMesh(list, mat) {
  const g = grassGeometry(), n = list.length, ph = new Float32Array(n);
  list.forEach((f, i) => { ph[i] = f.phase; });
  g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
  const m = new THREE.InstancedMesh(g, mat, n), M = new THREE.Matrix4();
  list.forEach((f, i) => { M.makeScale(f.size, f.size, f.size).setPosition(f.x, 0, f.z); m.setMatrixAt(i, M); });
  m.instanceMatrix.needsUpdate = true;
  return m;
}
