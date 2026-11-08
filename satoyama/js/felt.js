// 羊毛フェルトのジオラマの見た目（LOOKDEV.md 6章。2026-11-07 ユーザーが決めた）。ページから使う部品
// feltify＝フェルトの質感（繊維のからまりと殻の毛羽・ぬれたてかり）、makeFeltGround＝草の毛羽の台とぬかるみ、makeFeltBody＝骨から作った皮・耳・目、makeDiorama＝上下のぼけと四すみの影
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { height } from './ground.js';
import { buildSkinData } from './skin.js';
import { mud, PATCHES, MUD_WET, MUD_DRY } from './dirt.js';

// ---- フェルトの質感: 繊維のからまり（3Dの雑音の尾根）で色をゆらし、殻（シェル）を重ねて毛羽を出す ----
const NOISE = `
float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
// 繊維: 向きのちがう3つの細い尾根の重なり（ちぢれた毛がからまった感じ）。世界の軸にそろった縞にならないよう、尾根の向きを斜めに
const mat3 RA = mat3(0.36, 0.48, -0.8, -0.8, 0.6, 0.0, 0.48, 0.64, 0.6), RB = mat3(0.6, -0.64, 0.48, 0.0, 0.6, 0.8, -0.8, -0.48, 0.36);
float fiber(vec3 p){ vec3 q = RA * p, r = RB * p; float a = 1.0 - abs(n3(q * vec3(1.0, 1.0, 3.0)) * 2.0 - 1.0), b = 1.0 - abs(n3(r * vec3(1.0, 3.0, 1.0) + 7.1) * 2.0 - 1.0), c = 1.0 - abs(n3((RA * r) * vec3(3.0, 1.0, 1.0) + 3.7) * 2.0 - 1.0);
  return max(max(pow(a, 6.0), pow(b, 6.0)), pow(c, 6.0)); }`;
// 網には fluff（毛羽の高さ 0..1）と wet（ぬれ 0..1）の点ごとの数がいる。rest＝生まれたときの位置（骨に貼った皮で模様が動かないように）
// breath＝呼吸のふくらみ（m、体ごとに1つの数をすべての殻で分ける）。網の点ごとの重み breathW をかける
const NO_BREATH = { value: 0 };
// coat＝生き物の毛（泥と年の数を持つ）。泥 mud は点ごと（0..1）、泥の色 uMudCol・年 uAge（0..1）は体ごと
// 泥は毛にしみこませず、毛先の表面にかたまりでつく（ユーザー「表面の起毛部分に付着するように」）: 外の殻ほど濃く、まだらのかたまり
// 年をとると、フェルトが黄ばんでくすみ、ところどころ毛羽がはげる（ユーザーの案）
export function feltify(mat, { shell = 0, len = 0.006, freq = 260, rest = true, breath = NO_BREATH, coat = null } = {}) {
  mat.userData.u = { uShell: { value: shell }, uLen: { value: len }, uFreq: { value: freq }, uWetAll: { value: 0 }, uBreath: breath, ...(coat ? { uMudCol: coat.mudCol, uAge: coat.age } : {}) };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, mat.userData.u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      uniform float uShell, uLen, uBreath; attribute float fluff, wet, breathW; ${rest ? 'attribute vec3 rest;' : ''} varying vec3 vRest; varying float vFluff, vWet; ${coat ? 'attribute float mud; varying float vMud;' : ''}`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
      ${coat ? 'vMud = mud;' : ''} vFluff = fluff; vWet = wet; vRest = ${rest ? 'rest' : 'position'}; transformed += normalize(objectNormal) * (uShell * uLen * fluff + breathW * uBreath);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uShell, uFreq, uWetAll; varying vec3 vRest; varying float vFluff, vWet; ${coat ? 'uniform vec3 uMudCol; uniform float uAge; varying float vMud;' : ''} ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float fb = fiber(vRest * uFreq), fb2 = n3(vRest * uFreq * 0.25);
      ${coat ? `float bald = smoothstep(1.0 - uAge * 0.55, 1.04 - uAge * 0.55, n3(vRest * 34.0 + 5.3) * 0.7 + n3(vRest * 90.0) * 0.3); // はげる所: 年とともに広がるまだら` : 'float bald = 0.0;'}
      if (uShell > 0.0) { if (fb * (0.55 + 0.6 * fb2) < uShell * 0.55 + 0.12 || vFluff < 0.05 || bald > 0.5) discard; diffuseColor.rgb *= mix(0.78, 1.08, uShell); }
      else diffuseColor.rgb *= (0.86 + 0.22 * fb + 0.08 * fb2) * (1.0 - 0.1 * bald);
      ${coat ? `
      vec3 yel = diffuseColor.rgb * vec3(1.0, 0.92, 0.7) + vec3(0.05, 0.035, 0.0); float lum = dot(yel, vec3(0.3, 0.59, 0.11));
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(yel, vec3(lum), 0.25), uAge * 0.8); // 黄ばんで、少しくすむ
      float lump = n3(vRest * uFreq * 0.1 + 11.0) * 0.65 + n3(vRest * uFreq * 0.35 + 3.0) * 0.35, dots = step(0.82, n3(vRest * uFreq * 1.1 + 7.0)); // 泥のかたまりと、はねた小さな粒
      float clump = max(smoothstep(0.6 - 0.14 * vMud, 0.66 - 0.14 * vMud, lump), dots * step(0.25, vMud)); // 泥が多いほど、かたまりが広がってつながる
      float m = vMud * clump * (uShell > 0.0 ? mix(0.7, 1.0, uShell) : 0.85); // 毛の表面（毛先）に。かたまりの外は毛の色のまま
      diffuseColor.rgb = mix(diffuseColor.rgb, uMudCol * (0.85 + 0.3 * fb2), clamp(m, 0.0, 1.0));` : ''}`)
      // ぬれた所（ぬれた毛・ぬれた泥）は毛羽が寝て、てかる
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float wv = max(vWet, uWetAll); roughnessFactor = mix(roughnessFactor, 0.32, wv);`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
      material.sheenColor *= 1.0 - 0.8 * max(vWet, uWetAll);`);
  };
  mat.customProgramCacheKey = () => 'felt' + (shell > 0 ? 's' : 'b') + (rest ? 'r' : '') + (coat ? 'c' : '');
  return mat;
}
const attr1 = (n, v = 0) => new THREE.BufferAttribute(new Float32Array(n).fill(v), 1);
// 網に殻を重ねる（毛羽）。Mesh か SkinnedMesh を作る関数 mk(material) を渡す
export function shells(n, mk, matFn) { const out = []; for (let s = 1; s <= n; s++) out.push(mk(matFn(s / n))); return out; }

// ---- 台: フェルトの草地。ぬかるみは草がなく、こげ茶でぬれて光る ----
// フェルトの玉（たまご・巣のわら・ぽふっと出る毛玉）: 色1つ、毛羽はうすく
export function makeFeltBall(color, { r = 0.05, sx = 1, sy = 1, sz = 1, seg = 24 } = {}) {
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(color, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('wet', attr1(n)); g.setAttribute('fluff', attr1(n, 1)); g.scale(sx, sy, sz);
  const m = new THREE.Mesh(g, feltify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, sheen: 0.8, sheenRoughness: 0.8, sheenColor: 0xf2e6d4, transparent: true }), { freq: 330, rest: false }));
  m.castShadow = true; m.receiveShadow = true; return m;
}
export function makeFeltGround(scene, { size = 12, n = 200, cx = 0, cz = 0, shellsN = 5 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, n, n); geo.rotateX(-Math.PI / 2); geo.translate(cx, 0, cz);
  const gp = geo.attributes.position, gcol = new Float32Array(gp.count * 3), gfl = new Float32Array(gp.count).fill(1);
  const GRASS = [[0.47, 0.55, 0.30], [0.55, 0.60, 0.33], [0.42, 0.50, 0.28], [0.60, 0.58, 0.36]];
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i), m = mud(x, z); gp.setY(i, height(x, z) - m * 0.006);
    const nn = Math.sin(x * 2.1 + Math.sin(z * 1.7) * 2) * Math.sin(z * 2.6 + Math.sin(x * 1.3) * 2), g = GRASS[Math.max(0, Math.min(3, Math.floor((nn + 1) * 2)))], k = Math.min(1, m * 1.5);
    for (let c = 0; c < 3; c++) gcol[i * 3 + c] = g[c] + (MUD_WET[c] * 1.2 - g[c]) * k;
    gfl[i] = 1 - k;
  }
  geo.setAttribute('wet', attr1(gp.count)); geo.setAttribute('color', new THREE.BufferAttribute(gcol, 3)); geo.setAttribute('fluff', new THREE.BufferAttribute(gfl, 1)); geo.computeVertexNormals();
  const mat = feltify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, sheen: 0.6, sheenRoughness: 0.9, sheenColor: 0xd8e0b8 }), { freq: 90, rest: false });
  const ground = new THREE.Mesh(geo, mat); ground.receiveShadow = true; scene.add(ground);
  const sh = shells(shellsN, m => { const o = new THREE.Mesh(geo, m); o.receiveShadow = true; scene.add(o); return o; },
    s => feltify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, sheen: 0.8, sheenRoughness: 0.8, sheenColor: 0xe6ecc4 }), { shell: s, len: 0.012, freq: 90, rest: false }));
  // ぬかるみの水の面（ぬれて光る）
  const mudMat = new THREE.MeshPhysicalMaterial({ color: 0x3a2c1e, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15, transparent: true, opacity: 0.55 });
  const mg = new THREE.PlaneGeometry(size, size, n, n); mg.rotateX(-Math.PI / 2); mg.translate(cx, 0, cz);
  { const p = mg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)) - 0.002); mg.computeVertexNormals(); }
  const water = new THREE.Mesh(mg, mudMat); water.receiveShadow = true; scene.add(water);
  mudMat.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vXZ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvXZ = position.xz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec2 vXZ; uniform vec4 uP[${PATCHES.length}];`).replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
    float m = 0.0; for (int i = 0; i < ${PATCHES.length}; i++) { float d = length(vXZ - uP[i].xy) / uP[i].z; m = max(m, 1.0 - d * d); } if (m < 0.35) discard; diffuseColor.a *= smoothstep(0.35, 0.6, m);`);
    s.uniforms.uP = { value: PATCHES.map(([x, z, r]) => new THREE.Vector4(x, z, r, 0)) }; };
  return { ground, shells: sh, setWet(w) { mat.color.setScalar(1 - w * 0.3); mat.userData.u.uWetAll.value = w * 0.6; mudMat.opacity = 0.55 + w * 0.12; } };
}

// 顔（耳と目）の形: 頭の中心（皮の頭）からの位置と大きさ。耳は 0..2 の玉を size でのばした板（size＝はば・長さ・あつさの半分）
// ノウサギ: 耳は長さ 10cm・はば 2.8cm（本物の耳は 7.6〜8.3cm＋根もと）、少し後ろへ寝かせて外へ開く。先は黒褐色。目は琥珀色で白っぽい輪
export const HARE_FACE = { eye: [0.012, 0.012, 0.039], eyeR: 0.009, iris: 0x5a3a16, ring: [0.82, 0.82, 0.82],
  ear: { at: [-0.012, 0.03, 0.016], size: [0.014, 0.05, 0.006], out: 0.18, back: 0.35, tipAt: 0.8, tip: [0.13, 0.10, 0.08], inner: [0.80, 0.72, 0.66], outer: [0.42, 0.33, 0.24] } };
// ---- 体: 肉の形（flesh-*.js）から皮の網を作って骨に貼り、殻の毛羽・耳・目をつける ----
// opt.furColor(part, p, n)＝点ごとの毛の色、opt.headOff＝皮の頭のずらし、opt.bends＝見た目の関節の範囲、opt.ears＝耳を付けるか
export function makeFeltBody(scene, H, shapes, { furColor, headOff = [0, 0, 0], bends = [], ears = true, face = null, cell = 0.0055, shellsN = 6, sheenColor = 0xb9a68c } = {}) {
  const t0 = performance.now(), SK = buildSkinData(shapes, { cell }), ms = performance.now() - t0;
  const bodyKey = SK.bodies.map(b => Object.entries(H.parts).find(([, p]) => p.body === b)[0]); // 骨（剛体）ごとの部位の名前（起き直したときに付けかえる）
  const geo = new THREE.BufferGeometry(), nv = SK.position.length / 3;
  geo.setAttribute('position', new THREE.BufferAttribute(SK.position, 3)); geo.setIndex(SK.index);
  geo.setAttribute('rest', new THREE.BufferAttribute(SK.position.slice(), 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SK.skinIndex, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SK.skinWeight, 4));
  geo.computeVertexNormals();
  const F = face || HARE_FACE, hc0 = H.parts.head.c.map((v, i) => v + headOff[i]), eyeAt = s => [hc0[0] + F.eye[0], hc0[1] + F.eye[1], hc0[2] + F.eye[2] * s]; // 目の場所（生まれたとき）
  const fur = new Float32Array(nv * 3), col = new Float32Array(nv * 3), flf = new Float32Array(nv).fill(1), wetA = new Float32Array(nv), low = new Float32Array(nv), speck = new Float32Array(nv);
  { const n = geo.attributes.normal; for (let q = 0; q < nv; q++) {
    const p = [SK.position[q * 3], SK.position[q * 3 + 1], SK.position[q * 3 + 2]], c = furColor(SK.part[q], p, [n.getX(q), n.getY(q), n.getZ(q)]); fur.set(c, q * 3); col.set(c, q * 3);
    low[q] = p[1] - height(p[0], p[2]); // 生まれたときの地面からの高さ（泥は下から上がる）
    if (ears) for (const s of [1, -1]) { const e = eyeAt(s), d = Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]), R2 = F.eyeR * 2; if (d < R2) { flf[q] = Math.min(flf[q], 0.15 + 0.85 * Math.max(0, (d - F.eyeR) / F.eyeR)); if (F.ring) { const k = Math.max(0, 1 - d / R2) * 0.5; for (let j = 0; j < 3; j++) fur[q * 3 + j] = col[q * 3 + j] = c[j] + (F.ring[j] - c[j]) * k; } } } // 目のまわりは毛が短い（ノウサギは白っぽい輪）
    speck[q] = 0.5 + 0.5 * Math.sin(p[0] * 517 + p[2] * 263) * Math.sin(p[1] * 331 - p[0] * 197); // 泥のはねのまだら
  } }
  const baseF = flf.slice(); // 毛羽のもとの高さ（目のまわりは短い）
  // 呼吸の重み: 胸がいちばん、腰は前ほど。背より脇腹と腹がふくらむ
  const bw = new Float32Array(nv), pa = H.parts.pelvis;
  { const n = geo.attributes.normal; for (let q = 0; q < nv; q++) { const part = SK.part[q], x = SK.position[q * 3];
    const w = part === 'chest' ? 1 : part === 'pelvis' ? Math.max(0, Math.min(1, (x - pa.a[0]) / (pa.b[0] - pa.a[0]))) * 0.7 : 0;
    bw[q] = w * (0.35 + 0.65 * Math.max(0, Math.min(1, 0.5 - 0.6 * n.getY(q)))); } }
  geo.setAttribute('breathW', new THREE.BufferAttribute(bw, 1)); const mudA = new Float32Array(nv); geo.setAttribute('mud', new THREE.BufferAttribute(mudA, 1));
  geo.setAttribute('wet', new THREE.BufferAttribute(wetA, 1)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('fluff', new THREE.BufferAttribute(flf, 1));
  const bones = SK.bodies.map(b => { const bn = new THREE.Bone(), t = b.translation(); bn.position.set(t.x, t.y, t.z); return bn; });
  const rig = new THREE.Group(); bones.forEach(b => rig.add(b)); scene.add(rig); rig.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones), meshes = [];
  const breathU = { value: 0 }, coat = { mudCol: { value: new THREE.Color(...MUD_WET) }, age: { value: 0 } }, furMat = shell => feltify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, sheen: 0.7, sheenRoughness: 0.8, sheenColor }), { shell, len: 0.007, freq: 330, breath: breathU, coat });
  for (let s = 0; s <= shellsN; s++) {
    const m = new THREE.SkinnedMesh(geo, furMat(s / shellsN)); m.bind(skeleton, new THREE.Matrix4()); m.frustumCulled = false;
    m.castShadow = s === 0; m.receiveShadow = true; scene.add(m); meshes.push(m);
  }
  // 耳（薄い板。外は灰褐色・内は白っぽく・先は黒褐色）と目（琥珀色）。頭の骨に付け、耳はばねで遅れてゆれる
  const headBone = bones[SK.bodies.indexOf(H.parts.head.body)], hc = H.parts.head.c.map((v, i) => v + headOff[i]), hbp = headBone.position.clone(), earList = [];
  if (ears) for (const s of [1, -1]) {
    const eg = new THREE.SphereGeometry(1, 20, 14), ep = eg.attributes.position, ec = new Float32Array(ep.count * 3);
    for (let i = 0; i < ep.count; i++) { const y = ep.getY(i), z = ep.getZ(i), tip = y > F.ear.tipAt ? 1 : 0, inner = z * s > 0.3 ? 1 : 0; const c = tip ? F.ear.tip : inner ? F.ear.inner : F.ear.outer; ec.set(c, i * 3); ep.setY(i, y + 1); }
    eg.setAttribute('wet', attr1(ep.count)); eg.setAttribute('color', new THREE.BufferAttribute(ec, 3)); eg.setAttribute('fluff', attr1(ep.count, 1)); eg.computeVertexNormals();
    const ear = new THREE.Mesh(eg, feltify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, sheen: 1, sheenRoughness: 0.7, sheenColor: 0xf0dcc8 }), { freq: 330, rest: false }));
    ear.position.set(hc[0] - hbp.x + F.ear.at[0], hc[1] - hbp.y + F.ear.at[1], hc[2] - hbp.z + F.ear.at[2] * s);
    ear.scale.set(...F.ear.size); ear.rotation.set(F.ear.out * s, 0, F.ear.back); ear.castShadow = true; headBone.add(ear);
    earList.push({ ear, s, a: 0, va: 0, b: 0, vb: 0, eg });
    // 目: 頭の横の高い所に、まぶたのふちから少しだけ出る（飛び出して見えないよう、平たくして皮にうめる。まわりの毛は短く白っぽい＝下の eyeAt）
    const eye = new THREE.Mesh(new THREE.SphereGeometry(F.eyeR, 16, 12), new THREE.MeshPhysicalMaterial({ color: F.iris, roughness: 0.35, clearcoat: 0.35 }) /* てかりが強いと白目に見えて飛び出して見える */);
    const ea = eyeAt(s); eye.position.set(ea[0] - hbp.x, ea[1] - hbp.y, ea[2] - hbp.z); eye.scale.set(1, 1, 0.5); headBone.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(F.eyeR * 0.67, 12, 8), new THREE.MeshBasicMaterial({ color: 0x0e0906 })); pupil.position.set(F.eyeR * 0.11, F.eyeR * 0.05, F.eyeR * 0.56 * s); pupil.scale.set(1, 1, 0.6); eye.add(pupil);
  }
  // 見た目だけの関節の範囲（opt.bends）: 物理の骨がまれに本物では曲がらない向きへ折れても、皮は本物の範囲で描く（GAME.md 9.7。物理と学習はそのまま）
  const bi = part => SK.bodies.indexOf(H.parts[part].body);
  const bendList = bends.map(b => ({ ...b, pi: bi(b.parent), ci: bi(b.child), chain: (b.chain || []).map(bi), piv: new THREE.Vector3(...b.pivot).sub(bones[bi(b.child)].position) }));
  const _q = new THREE.Quaternion(), _r = new THREE.Quaternion(), _rz = new THREE.Quaternion(), _pw = new THREE.Vector3(), _v = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), XA = new THREE.Vector3(1, 0, 0);
  function clampBends() {
    for (const b of bendList) {
      const P = bones[b.pi], C = bones[b.ci], rel = _q.copy(P.quaternion).invert().multiply(C.quaternion);
      const X = b.axis === 'x', th = 2 * Math.atan2(X ? rel.x : rel.z, rel.w), a = Math.atan2(Math.sin(th), Math.cos(th)), c = Math.max(b.min, Math.min(b.max, a));
      if (c === a) continue;
      _pw.copy(b.piv).applyQuaternion(C.quaternion).add(C.position); // 関節の点（世界）
      // z＝前後の曲げ（先の骨のまわり）、x＝横へ開く（親の骨のまわり。股と肩は 横へ開く→前後に振る の順につながっている）
      const qc2 = X ? _rz.setFromAxisAngle(XA, c - a).premultiply(P.quaternion).multiply(_q.copy(P.quaternion).invert()).multiply(C.quaternion) : C.quaternion.clone().multiply(_rz.setFromAxisAngle(Z, c - a));
      const R = _r.copy(qc2).multiply(_q.copy(C.quaternion).invert());
      for (const k of [b.ci, ...b.chain]) { const B = bones[k]; B.position.copy(_v.copy(B.position).sub(_pw).applyQuaternion(R).add(_pw)); if (k !== b.ci) B.quaternion.premultiply(R); }
      C.quaternion.copy(qc2);
    }
  }
  const bst = { ph: 0, tired: 0, flick: 2 }; // 呼吸の位相・息の上がり・次に耳を動かすまでの秒
  const yawQ = new THREE.Quaternion(); // 起き直した体は、向き yaw で作られている（剛体は回っていないが、骨の並びが回っている）
  const lastV = new THREE.Vector3(), lastP = new THREE.Vector3(), wp = new THREE.Vector3(), iq = new THREE.Quaternion(); let first = true;
  return {
    SK, nv, tris: SK.index.length / 3, ms, bones, headBone, meshes,
    // 骨を物理の体に合わせる。dt＝前のこまからの秒（耳のばね）
    pose(dt = 1 / 60) {
      bones.forEach((bn, i) => { const b = SK.bodies[i], p = b.translation(), r = b.rotation(); bn.position.set(p.x, p.y, p.z); bn.quaternion.set(r.x, r.y, r.z, r.w).multiply(yawQ); });
      clampBends(); rig.updateMatrixWorld(true);
      if (!earList.length || dt <= 0) return;
      // 耳のばね: 頭の加速度（頭の向きで見た上下と左右）で、耳が遅れて倒れ・ゆれる
      headBone.getWorldPosition(wp); const v = wp.clone().sub(lastP).divideScalar(dt); if (first) { lastV.copy(v); first = false; }
      const acc = v.clone().sub(lastV).divideScalar(dt).applyQuaternion(iq.copy(headBone.quaternion).invert()); lastP.copy(wp); lastV.copy(v);
      const h = Math.min(dt, 1 / 30);
      for (const e of earList) {
        e.va += (-60 * e.a - 5 * e.va + 0.4 * acc.y) * h; e.a = Math.max(-0.25, Math.min(0.4, e.a + e.va * h)); // 上へ加速すると耳は後ろへ倒れる
        e.vb += (-80 * e.b - 6 * e.vb + 0.3 * acc.z * e.s) * h; e.b = Math.max(-0.3, Math.min(0.3, e.b + e.vb * h));
        e.ear.rotation.set(F.ear.out * e.s + e.b, 0, (e.back ?? F.ear.back) + e.a);
      }
    },
    // 泥とぬれ（dirt.js の部位ごとの数）を、毛の色・毛羽の高さ・てかりに。泥は低い所から上がり、ふちはまだらのはね
    paint(D) {
      let dry = 0, dn = 0; for (const k in D) { if (D[k].mud > 0.01) { dry += D[k].dry; dn++; } }
      dry = dn ? dry / dn : 0; coat.mudCol.value.setRGB(...MUD_WET.map((w, c) => w + (MUD_DRY[c] - w) * dry)); // 泥の色: ぬれた泥 → 乾いた泥
      for (let q = 0; q < nv; q++) {
        const s = D[SK.part[q]]; if (!s) continue;
        const line = 0.03 + 0.2 * s.mud, mk = s.mud > 0.01 ? Math.max(0, Math.min(1, (line - low[q]) / 0.03 + (speck[q] - 0.5) * 1.2)) : 0, wd = 1 - 0.3 * s.wet;
        for (let c = 0; c < 3; c++) col[q * 3 + c] = fur[q * 3 + c] * wd; mudA[q] = mk; // 泥は毛先の表面に（色は shader で）
        flf[q] = baseF[q] * Math.max(0.12, 1 - 0.55 * s.wet - 0.2 * mk * (1 - s.dry)); // ぬれた泥だけ少し毛を寝かせる wetA[q] = Math.min(1, Math.max(s.wet * 0.7, mk * (1 - s.dry)));
      }
      geo.attributes.color.needsUpdate = geo.attributes.fluff.needsUpdate = geo.attributes.wet.needsUpdate = geo.attributes.mud.needsUpdate = true;
    },
    // 起き直した体（同じ作りの新しい剛体）に付けかえる
    rebind(H2, yaw = 0) { SK.bodies.forEach((_, i) => (SK.bodies[i] = H2.parts[bodyKey[i]].body)); yawQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw); first = true; }, // yaw＝buildHare に渡した向き
    // 待機のしぐさ: 呼吸（休むと1秒に1回ほど、走ったあとは速く深く、だんだん落ち着く）と、止まっているときの耳のぴくつき（音を聞く）
    // effort＝いまの走る強さ 0..1（g）。速さは 2026-11-08 にユーザー「8割に」。数は見立て（ノウサギの安静時の呼吸の数は見つかっていない。飼いウサギは1分に30〜60回）
    breathe(dt, effort = 0) {
      bst.tired = Math.min(1, Math.max(0, bst.tired + (effort > 0.3 ? effort * 0.25 : 0) * dt)) * Math.exp(-(effort > 0.3 ? 0 : dt / 8));
      bst.ph += dt * Math.PI * 2 * 0.8 * (0.9 + 1.8 * bst.tired); breathU.value = (0.003 + 0.003 * bst.tired) * (0.5 - 0.5 * Math.cos(bst.ph));
      if (effort < 0.1 && earList.length && (bst.flick -= dt) < 0) { const e = earList[Math.random() < 0.5 ? 0 : 1]; e.vb += (Math.random() < 0.5 ? -1 : 1) * 9; e.va += (Math.random() - 0.3) * 6; bst.flick = 1.5 + Math.random() * 5; }
    },
    // 見た目を変える（声で育つ）: 新しい毛の色と耳へ、k＝0..1 でなめらかに移る（ぱっと入れかえない）。begin で行き先を決め、blend(k) を毎こま
    look: {
      begin(furColor2, face2) {
        const n = geo.attributes.normal, to = new Float32Array(nv * 3);
        for (let q = 0; q < nv; q++) to.set(furColor2(SK.part[q], [SK.position[q * 3], SK.position[q * 3 + 1], SK.position[q * 3 + 2]], [n.getX(q), n.getY(q), n.getZ(q)]), q * 3);
        this.A = { fur: fur.slice(), ears: earList.map(e => ({ size: e.ear.scale.toArray(), back: e.back ?? F.ear.back, col: e.eg.attributes.color.array.slice() })) };
        this.B = { fur: to, ears: earList.map(e => { const ep = e.eg.attributes.position, c = new Float32Array(ep.count * 3); for (let i = 0; i < ep.count; i++) { const y = ep.getY(i) - 1, z = ep.getZ(i); c.set(y > face2.ear.tipAt ? face2.ear.tip : z * e.s > 0.3 ? face2.ear.inner : face2.ear.outer, i * 3); } return { size: face2.ear.size, back: face2.ear.back, col: c }; }) };
      },
      blend(k) {
        const { A, B } = this; if (!A) return; const m = (a, b) => a + (b - a) * k;
        for (let i = 0; i < fur.length; i++) col[i] = fur[i] = m(A.fur[i], B.fur[i]);
        earList.forEach((e, j) => { const a = A.ears[j], b = B.ears[j]; e.ear.scale.set(m(a.size[0], b.size[0]), m(a.size[1], b.size[1]), m(a.size[2], b.size[2])); e.back = m(a.back, b.back); const c = e.eg.attributes.color.array; for (let i = 0; i < c.length; i++) c[i] = m(a.col[i], b.col[i]); e.eg.attributes.color.needsUpdate = true; });
        geo.attributes.color.needsUpdate = true;
      },
    },
    dispose() { meshes.forEach(m => { scene.remove(m); m.material.dispose(); }); scene.remove(rig); geo.dispose(); },
    setAge(a) { coat.age.value = a; }, // 年 0..1（黄ばみ・くすみ・毛羽のはげ）
    setVisible(b) { meshes.forEach(m => (m.visible = b)); headBone.children.forEach(c => (c.visible = b)); },
  };
}

// ---- ジオラマの見え方: 上下のぼけ（ティルトシフト）と、四すみの影・少しこい色 ----
const Vignette = { uniforms: { tDiffuse: { value: null }, amt: { value: 0.35 }, sat: { value: 1.08 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float amt, sat; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.299, 0.587, 0.114)); c.rgb = mix(vec3(l), c.rgb, sat); vec2 d = vUv - 0.5; c.rgb *= 1.0 - amt * smoothstep(0.25, 0.75, dot(d, d) * 2.2); gl_FragColor = c; }' };
export function makeDiorama(renderer, scene, cam) {
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, cam));
  const hts = new ShaderPass(HorizontalTiltShiftShader), vts = new ShaderPass(VerticalTiltShiftShader), vig = new ShaderPass(Vignette);
  composer.addPass(hts); composer.addPass(vts); composer.addPass(vig); composer.addPass(new OutputPass());
  return {
    composer, setSize(w, h) { composer.setSize(w, h); },
    // blur＝ぼけの強さ（画面の点）、focus＝ぴんとの合う高さ（0..1、下から）
    render(blur = 2, focus = 0.5, vignette = 0.35) { hts.uniforms.h.value = blur / innerWidth; vts.uniforms.v.value = blur / innerHeight; hts.uniforms.r.value = vts.uniforms.r.value = focus; vig.uniforms.amt.value = vignette; composer.render(); },
  };
}
