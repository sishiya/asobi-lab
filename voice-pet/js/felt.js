// 羊毛フェルトのジオラマの見た目（LOOKDEV.md 6章。2026-11-07 ユーザーが決めた）。ページから使う部品
// feltify＝フェルトの質感（繊維のからまりと殻の毛羽・ぬれたてかり）、makeFeltGround＝草の毛羽の台とぬかるみ、makeFeltBody＝骨から作った皮・耳・目、makeDiorama＝上下のぼけと四すみの影
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { height } from './ground.js';
import { buildSkinData } from './skin.js';
import { mud, PATCHES, MUD_WET, MUD_DRY, COAT_MUD_WET, COAT_MUD_DRY } from './dirt.js';

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
const NO_BREATH = { value: 0 }, NO_FAR = { value: 0 };
// coat＝生き物の毛（泥と年の数を持つ）。泥 mud は点ごと（0..1）、泥の色 uMudCol・年 uAge（0..1）は体ごと
// 泥は毛にしみこませず、毛先の表面にかたまりでつく（ユーザー「表面の起毛部分に付着するように」）: 外の殻ほど濃く、まだらのかたまり
// 年をとると、フェルトが黄ばんでくすみ、ところどころ毛羽がはげる（ユーザーの案）
export function feltify(mat, { shell = 0, len = 0.006, freq = 260, rest = true, breath = NO_BREATH, coat = null, far = NO_FAR } = {}) {
  mat.userData.u = { uShell: { value: shell }, uLen: { value: len }, uFreq: { value: freq }, uWetAll: { value: 0 }, uBreath: breath, uFar: far, ...(coat ? { uMudWet: coat.mudWet, uMudDry: coat.mudDry, uAge: coat.age } : {}) };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, mat.userData.u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      uniform float uShell, uLen, uBreath, uFar; attribute float fluff, wet, breathW; ${rest ? 'attribute vec3 rest;' : ''} varying vec3 vRest; varying float vFluff, vWet; ${coat ? 'attribute float mud, mdry; varying float vMud, vDry;' : ''}`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
      ${coat ? 'vMud = mud; vDry = mdry;' : ''} vFluff = fluff; vWet = wet; vRest = ${rest ? 'rest' : 'position'}; transformed += normalize(objectNormal) * (uShell * uLen * (1.0 + 1.3 * uFar) * fluff + breathW * uBreath);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uShell, uFreq, uWetAll, uFar; varying vec3 vRest; varying float vFluff, vWet; ${coat ? 'uniform vec3 uMudWet, uMudDry; uniform float uAge; varying float vMud, vDry;' : ''} ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float fb = fiber(vRest * uFreq), fb2 = n3(vRest * uFreq * 0.25);
      ${coat ? `float bald = smoothstep(1.0 - uAge * 0.55, 1.04 - uAge * 0.55, n3(vRest * 34.0 + 5.3) * 0.7 + n3(vRest * 90.0) * 0.3); // はげる所: 年とともに広がるまだら` : 'float bald = 0.0;'}
      float tuft = fiber(vRest * uFreq * 0.3 + 3.1), fbF = mix(fb, tuft, uFar); // 遠いと細い毛はつぶれて見えないので、太い房に（テストプレイ「遠目だともふもふしていない」）
      float wf = 0.5 * max(vWet, uWetAll), wc = n3(vRest * uFreq * 0.11 + 2.0); // ぬれた毛は束になる
      if (uShell > 0.0) { if (fbF * (0.55 + 0.6 * fb2) < uShell * 0.55 + 0.12 || vFluff < 0.05 || bald > 0.5 || uShell > mix(1.2, smoothstep(0.3, 0.7, wc) * 0.5 + 0.5, wf * 2.0)) discard; diffuseColor.rgb *= mix(0.78 - 0.2 * uFar, 1.08 + 0.12 * uFar, uShell); }
      else diffuseColor.rgb *= (0.86 + 0.22 * fbF + 0.08 * fb2) * (1.0 - 0.1 * bald);
      diffuseColor.rgb *= mix(1.0, (0.56 + 0.3 * wc), wf); // ぬれると暗く、束の谷はもっと暗い
      ${coat ? `
      vec3 yel = diffuseColor.rgb * vec3(1.0, 0.92, 0.7) + vec3(0.05, 0.035, 0.0); float lum = dot(yel, vec3(0.3, 0.59, 0.11));
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(yel, vec3(lum), 0.25), uAge * 0.8); // 黄ばんで、少しくすむ
      float lump = n3(vRest * uFreq * 0.28 + 11.0) * 0.6 + n3(vRest * uFreq * 0.7 + 3.0) * 0.4, dots = step(0.82, n3(vRest * uFreq * 1.1 + 7.0)); // 泥のかたまりと、はねた小さな粒
      float clump = max(smoothstep(0.62 - 0.32 * vMud, 0.68 - 0.32 * vMud, lump), dots * step(0.25, vMud)); // 泥が多いほど、かたまりが広がってつながる（ついた所の真ん中はほぼ覆う。まだらは足先より細かく）
      float m = min(1.0, vMud * 1.6) * clump * (uShell > 0.0 ? mix(0.75, 1.0, uShell) : 0.9); // 毛の表面（毛先）に。かたまりの外は毛の色のまま
      float crack = smoothstep(0.015, 0.04, abs(n3(vRest * uFreq * 0.22 + 5.0) - 0.5)); // 乾くとひびが入る（ひびから下の毛がのぞく）
      m *= mix(1.0, crack, smoothstep(0.6, 1.0, vDry));
      if (uShell > 0.0 && vDry > 0.7 && m > 0.5 && fb < 0.45) discard; // 乾いた泥は毛羽をかためる（毛先がまばらに）
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(uMudWet, uMudDry, vDry) * (0.85 + 0.3 * fb2), clamp(m, 0.0, 1.0));` : ''}`)
      // ぬれた所（ぬれた毛・ぬれた泥）は毛羽が寝て、てかる
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float wv = 0.5 * max(vWet, uWetAll); roughnessFactor = mix(roughnessFactor, 0.32, wv);`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
      material.sheenColor *= 1.0 - 0.4 * max(vWet, uWetAll);`);
  };
  mat.customProgramCacheKey = () => 'felt' + (shell > 0 ? 's' : 'b') + (rest ? 'r' : '') + (coat ? 'c' : '');
  return mat;
}
const attr1 = (n, v = 0) => new THREE.BufferAttribute(new Float32Array(n).fill(v), 1);
// 網に殻を重ねる（毛羽）。Mesh か SkinnedMesh を作る関数 mk(material) を渡す
export function shells(n, mk, matFn) { const out = []; for (let s = 1; s <= n; s++) out.push(mk(matFn(s / n))); return out; }

// ---- 台: フェルトの草地。ぬかるみは草がなく、こげ茶でぬれて光る ----
// フェルトの玉（たまご・巣のわら・ぽふっと出る毛玉）: 色1つ、毛羽はうすく
// fuzz＝毛羽の層の数（つるっと見せたくない小物に。たまご・ふさ・綿毛）
export function makeFeltBall(color, { r = 0.05, sx = 1, sy = 1, sz = 1, seg = 24, fuzz = 0, len = 0.005 } = {}) {
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)); g.scale(sx, sy, sz);
  const m = feltMesh(g, color);
  for (let k = 1; k <= fuzz; k++) { const sh = new THREE.Mesh(g, feltify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, sheen: 0.9, sheenRoughness: 0.8, sheenColor: 0xf2e6d4 }), { shell: k / fuzz, len, freq: 330, rest: false })); sh.castShadow = false; m.add(sh); }
  return m;
}
// 形を1色のフェルトに（たまごの花びらなど）。色は geometry の color を後から変えてよい
export function feltMesh(g, color = [1, 1, 1], { side = THREE.FrontSide } = {}) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(color, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('wet', attr1(n)); g.setAttribute('fluff', attr1(n, 1));
  const m = new THREE.Mesh(g, feltify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, sheen: 0.8, sheenRoughness: 0.8, sheenColor: 0xf2e6d4, side }), { freq: 330, rest: false }));
  m.castShadow = true; m.receiveShadow = true; return m;
}
export function makeFeltGround(scene, { size = 12, n = 200, cx = 0, cz = 0, shellsN = 5, puddles = [], fade = 0 } = {}) { // puddles＝水たまり、fade＝地面の端を何 m かけて薄くするか（0 なら切りっぱなし）
  const EDGE = (xz) => 'if (uEdge.z > 0.0) { vec2 q = abs(' + xz + ' - uEdge.xy) - vec2(uEdgeH - 2.0); float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 2.0, tE = smoothstep(-uEdge.z, -0.05, sd); if (tE > fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard; }', EDGE_U = () => ({ uEdge: { value: new THREE.Vector3(cx, cz, fade) }, uEdgeH: { value: size / 2 } });
  const geo = new THREE.PlaneGeometry(size, size, n, n); geo.rotateX(-Math.PI / 2); geo.translate(cx, 0, cz);
  const gp = geo.attributes.position, gcol = new Float32Array(gp.count * 3), gfl = new Float32Array(gp.count).fill(1);
  const GRASS = [[0.47, 0.55, 0.30], [0.55, 0.60, 0.33], [0.42, 0.50, 0.28], [0.60, 0.58, 0.36]];
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i), m = mud(x, z); gp.setY(i, height(x, z) - m * 0.006);
    const nn = Math.sin(x * 2.1 + Math.sin(z * 1.7) * 2) * Math.sin(z * 2.6 + Math.sin(x * 1.3) * 2), g = GRASS[Math.max(0, Math.min(3, Math.floor((nn + 1) * 2)))], k = Math.min(1, m * 1.5);
    for (let c = 0; c < 3; c++) gcol[i * 3 + c] = g[c] + 0 * k; // 泥の色は下の muddy でピクセルごとに
  }
  geo.setAttribute('wet', attr1(gp.count)); geo.setAttribute('color', new THREE.BufferAttribute(gcol, 3)); geo.setAttribute('fluff', new THREE.BufferAttribute(gfl, 1)); geo.computeVertexNormals();
  const mat = feltify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, sheen: 0.6, sheenRoughness: 0.9, sheenColor: 0xd8e0b8 }), { freq: 90, rest: false });
  const SOIL = [...PATCHES, ...puddles]; // 草が短くなって土が見える所（水たまりの下も）
  const muddy = M => { const base = M.onBeforeCompile; M.onBeforeCompile = sh => { base(sh); Object.assign(sh.uniforms, EDGE_U()); sh.uniforms.uP = { value: SOIL.map(([x, z, r]) => new THREE.Vector4(x, z, r, 0)) }; sh.uniforms.uMudC = { value: new THREE.Color(...MUD_WET).multiplyScalar(1.2) };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform vec4 uP[${SOIL.length}]; uniform vec3 uMudC, uEdge; uniform float uEdgeH;`).replace('#include <roughnessmap_fragment>', `${EDGE('vRest.xz')}
      float mM = 0.0; for (int i = 0; i < ${SOIL.length}; i++) { float d = length(vRest.xz - uP[i].xy) / uP[i].z; mM = max(mM, 1.0 - d * d); }
      float eN = n3(vec3(vRest.xz * 8.0, 1.0)) * 0.5 + n3(vec3(vRest.xz * 26.0, 4.0)) * 0.3 + n3(vec3(vRest.xz * 75.0, 7.0)) * 0.2, mk = mM * 1.6 + (eN - 0.5) * 0.7; // ふちはぎざぎざ
      float core = smoothstep(0.46, 0.6, mk), rim = smoothstep(0.12, 0.42, mk) * (1.0 - core);
      if (uShell > 0.0 && mk > 0.1 + (1.0 - uShell) * 0.42 + (eN - 0.5) * 0.3) discard; // 草は泥に近づくほど短く、まばらに
      diffuseColor.rgb = mix(diffuseColor.rgb, uMudC * 1.9 + vec3(0.07, 0.055, 0.03), rim * (0.45 + 0.55 * eN)); // 乾いた土の帯
      diffuseColor.rgb = mix(diffuseColor.rgb, uMudC * (0.72 + 0.56 * eN), core);
      #include <roughnessmap_fragment>`); }; M.customProgramCacheKey = () => 'feltG' + (M.userData.u.uShell.value > 0 ? 's' : 'b'); return M; };
  muddy(mat);
  const ground = new THREE.Mesh(geo, mat); ground.receiveShadow = true; scene.add(ground);
  const sh = shells(shellsN, m => { const o = new THREE.Mesh(geo, m); o.receiveShadow = true; scene.add(o); return o; },
    s => muddy(feltify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, sheen: 0.8, sheenRoughness: 0.8, sheenColor: 0xe6ecc4 }), { shell: s, len: 0.012, freq: 90, rest: false })));
  // ぬかるみの水の面（ぬれて光る）
  const mudMat = new THREE.MeshPhysicalMaterial({ color: 0x3a2c1e, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15, transparent: true, opacity: 0.55 });
  const mg = new THREE.PlaneGeometry(size, size, n, n); mg.rotateX(-Math.PI / 2); mg.translate(cx, 0, cz);
  { const p = mg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)) - 0.002); mg.computeVertexNormals(); }
  const water = new THREE.Mesh(mg, mudMat); water.receiveShadow = true; scene.add(water);
  mudMat.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vXZ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvXZ = position.xz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec2 vXZ; uniform vec4 uP[${PATCHES.length}]; uniform vec3 uEdge; uniform float uEdgeH; ${NOISE}`).replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
    float m = 0.0; for (int i = 0; i < ${PATCHES.length}; i++) { float d = length(vXZ - uP[i].xy) / uP[i].z; m = max(m, 1.0 - d * d); } float eN = n3(vec3(vXZ * 8.0, 1.0)) * 0.5 + n3(vec3(vXZ * 26.0, 4.0)) * 0.3 + n3(vec3(vXZ * 75.0, 7.0)) * 0.2, mk = m * 1.6 + (eN - 0.5) * 0.7; ${EDGE('vXZ')} if (mk < 0.62) discard; diffuseColor.a *= smoothstep(0.62, 0.85, mk);`);
    s.uniforms.uP = { value: PATCHES.map(([x, z, r]) => new THREE.Vector4(x, z, r, 0)) }; Object.assign(s.uniforms, EDGE_U()); };
  // 水たまりの面（うすい水の膜。地面の網と同じ点の上にのせる）
  if (puddles.length) { const cell = size / n, ox = cx - size / 2, oz = cz - size / 2, R = 1.3, sn = (f, a) => f((a) / cell), ix0 = sn(Math.floor, Math.min(...puddles.map(p => p[0] - p[2] * R)) - ox), ix1 = sn(Math.ceil, Math.max(...puddles.map(p => p[0] + p[2] * R)) - ox), iz0 = sn(Math.floor, Math.min(...puddles.map(p => p[1] - p[2] * R)) - oz), iz1 = sn(Math.ceil, Math.max(...puddles.map(p => p[1] + p[2] * R)) - oz);
    const pg = new THREE.PlaneGeometry((ix1 - ix0) * cell, (iz1 - iz0) * cell, ix1 - ix0, iz1 - iz0); pg.rotateX(-Math.PI / 2); pg.translate(ox + (ix0 + ix1) / 2 * cell, 0, oz + (iz0 + iz1) / 2 * cell);
    { const p = pg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)) + 0.0015); pg.computeVertexNormals(); }
    const pm = new THREE.MeshPhysicalMaterial({ color: 0x9dbcc6, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.7, depthWrite: false });
    pm.onBeforeCompile = s => { s.uniforms.uP = { value: puddles.map(([x, z, r]) => new THREE.Vector4(x, z, r, 0)) }; s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vXZ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvXZ = position.xz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vXZ; uniform vec4 uP[${puddles.length}]; ${NOISE}`).replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
      float m = 0.0; for (int i = 0; i < ${puddles.length}; i++) { float d = length(vXZ - uP[i].xy) / uP[i].z; m = max(m, 1.0 - d * d); } float eN = n3(vec3(vXZ * 8.0, 1.0)) * 0.5 + n3(vec3(vXZ * 26.0, 4.0)) * 0.3 + n3(vec3(vXZ * 75.0, 7.0)) * 0.2, mk = m * 1.6 + (eN - 0.5) * 0.7; if (mk < 0.62) discard; diffuseColor.a *= smoothstep(0.62, 0.8, mk);`); };
    const pw = new THREE.Mesh(pg, pm); pw.receiveShadow = true; scene.add(pw); }
  return { ground, shells: sh, setWet(w) { mat.color.setScalar(1 - w * 0.3); mat.userData.u.uWetAll.value = w * 0.6; mudMat.opacity = 0.55 + w * 0.12; } };
}

// 顔（耳と目）の形: 頭の中心（皮の頭）からの位置と大きさ。耳は 0..2 の玉を size でのばした板（size＝はば・長さ・あつさの半分）
// ノウサギ: 耳は長さ 10cm・はば 2.8cm（本物の耳は 7.6〜8.3cm＋根もと）、少し後ろへ寝かせて外へ開く。先は黒褐色。目は琥珀色で白っぽい輪
// 声の子の目: 糸で留めたボタン（ユーザーが見くらべて決めた）。× は糸の色にせず、よく見るとくぼんでいる程度に
function craftButtonEye(eye, F, s) {
  const R = F.eyeR, K = 1 / 0.12, m = new THREE.MeshPhysicalMaterial({ color: F.iris, roughness: 0.4, clearcoat: 0.6 }), dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(F.iris).multiplyScalar(0.45), roughness: 0.9 }), z = R * 0.4 * s, add = (g, mt, zz, rz = 0) => { const o = new THREE.Mesh(g, mt); o.position.set(0, 0, zz); o.rotation.z = rz; o.scale.z = K; eye.add(o); };
  eye.scale.set(1, 1, 0.12); eye.material.color.set(0);
  const h = R * 0.2, c = R * 0.18, pr = [new THREE.Vector2(0.0001, -h), new THREE.Vector2(R - c, -h)]; for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI; pr.push(new THREE.Vector2(R - c + Math.cos(a) * c, Math.sin(a) * h)); } pr.push(new THREE.Vector2(R - c, h), new THREE.Vector2(0.0001, h)); // まるい角の円ばん
  add(new THREE.LatheGeometry(pr, 32).rotateX(Math.PI / 2), m, z);
  add(new THREE.TorusGeometry(R * 0.72, R * 0.11, 8, 28), m, z + R * 0.2 * K * s * 0.12 * K);
  for (const a of [Math.PI / 4, -Math.PI / 4]) add(new THREE.CapsuleGeometry(R * 0.06, R * 0.66, 4, 8), dark, z + R * 0.185 * K * s * 0.12 * K, a);
}
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
  geo.setAttribute('breathW', new THREE.BufferAttribute(bw, 1)); const mudA = new Float32Array(nv), dryA = new Float32Array(nv).fill(1); geo.setAttribute('mud', new THREE.BufferAttribute(mudA, 1)); geo.setAttribute('mdry', new THREE.BufferAttribute(dryA, 1));
  geo.setAttribute('wet', new THREE.BufferAttribute(wetA, 1)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('fluff', new THREE.BufferAttribute(flf, 1));
  const bones = SK.bodies.map(b => { const bn = new THREE.Bone(), t = b.translation(); bn.position.set(t.x, t.y, t.z); return bn; });
  const rig = new THREE.Group(); bones.forEach(b => rig.add(b)); scene.add(rig); rig.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones), meshes = [];
  const farU = { value: 0 }, breathU = { value: 0 }, coat = { mudWet: { value: new THREE.Color(...COAT_MUD_WET) }, mudDry: { value: new THREE.Color(...COAT_MUD_DRY) }, age: { value: 0 } }, furMat = shell => feltify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, sheen: 0.7, sheenRoughness: 0.8, sheenColor }), { shell, len: 0.007, freq: 330, breath: breathU, coat, far: farU });
  for (let s = 0; s <= shellsN; s++) {
    const m = new THREE.SkinnedMesh(geo, furMat(s / shellsN)); m.bind(skeleton, new THREE.Matrix4()); m.frustumCulled = false;
    m.castShadow = s === 0; m.receiveShadow = true; scene.add(m); meshes.push(m);
  }
  // 耳（薄い板。外は灰褐色・内は白っぽく・先は黒褐色）と目（琥珀色）。頭の骨に付け、耳はばねで遅れてゆれる
  const headBone = bones[SK.bodies.indexOf(H.parts.head.body)], hc = H.parts.head.c.map((v, i) => v + headOff[i]), hbp = headBone.position.clone(), earList = [], eyeList = [];
  if (F.beak) { // 羊毛のくちばし（テストプレイ「モフモフのくちばし」）: 丸みを残して先へ細くなる形に、体と同じ毛羽
    const bg = new THREE.SphereGeometry(1, 18, 12), bp = bg.attributes.position, bc = new Float32Array(bp.count * 3);
    for (let i = 0; i < bp.count; i++) { const u = Math.max(0, bp.getX(i)), k = 1 - 0.32 * u * u, yk = F.beak.duck ? 1 - 0.45 * u * u : k, zk = F.beak.duck ? 1 + 0.15 * u : k; bp.setY(i, bp.getY(i) * yk); bp.setZ(i, bp.getZ(i) * zk); /* duck＝アヒルのように幅広で平たく、先はつぶれて広がる */ bc.set(F.beak.col, i * 3); }
    bg.setAttribute('wet', attr1(bp.count)); bg.setAttribute('color', new THREE.BufferAttribute(bc, 3)); bg.setAttribute('fluff', attr1(bp.count, 1)); bg.computeVertexNormals();
    const mk = shell => new THREE.Mesh(bg, feltify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, sheen: 0.4, sheenRoughness: 0.8, sheenColor: 0xf0dcc8 }), { shell, len: 0.4, freq: 16, rest: false }));
    const beak = mk(0); beak.position.set(hc[0] - hbp.x + F.beak.at[0], hc[1] - hbp.y + F.beak.at[1], hc[2] - hbp.z); beak.scale.set(...F.beak.size); beak.castShadow = true; headBone.add(beak); for (let k = 1; k <= 3; k++) beak.add(mk(k / 3));
  }
  if (ears) for (const s of [1, -1]) {
    const eg = new THREE.SphereGeometry(1, 20, 14), ep = eg.attributes.position, ec = new Float32Array(ep.count * 3), z0 = new Float32Array(ep.count);
    for (let i = 0; i < ep.count; i++) { const y = ep.getY(i), z = ep.getZ(i), tip = y > F.ear.tipAt ? 1 : 0, inner = z * s > 0.3 ? 1 : 0; const c = tip ? F.ear.tip : inner ? F.ear.inner : F.ear.outer; ec.set(c, i * 3); ep.setY(i, y + 1);
      if (F.ear.long) { const t = (y + 1) / 2, k = Math.pow(t, 0.45) * Math.pow(1 - t, 0.35) / 0.578 / Math.max(0.001, Math.sqrt(1 - y * y)), nx = ep.getX(i) * k; z0[i] = z; ep.setX(i, nx); ep.setZ(i, z * k + s * 0.45 * nx * nx); } } // ウサギの耳: 根元が細く、中ほどが広く、先へ細くなる形。内側へ軽くくぼませる
    eg.setAttribute('wet', attr1(ep.count)); eg.setAttribute('color', new THREE.BufferAttribute(ec, 3)); eg.setAttribute('fluff', attr1(ep.count, 1)); eg.computeVertexNormals();
    const ear = new THREE.Mesh(eg, feltify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, sheen: 1, sheenRoughness: 0.7, sheenColor: 0xf0dcc8 }), { freq: 330, rest: false }));
    ear.position.set(hc[0] - hbp.x + F.ear.at[0], hc[1] - hbp.y + F.ear.at[1], hc[2] - hbp.z + F.ear.at[2] * s);
    ear.scale.set(...F.ear.size); ear.rotation.set(F.ear.out * s, 0, F.ear.back); ear.castShadow = true; headBone.add(ear);
    earList.push({ ear, s, a: 0, va: 0, b: 0, vb: 0, eg, ...(F.ear.long ? { long: true, z0, P0: ep.array.slice(), c: 0, vc: 0, d: 0, vd: 0, cz: 9 } : {}) }); if (F.ear.long) { ear.frustumCulled = false; for (let k = 1; k <= 3; k++) { const sh = new THREE.Mesh(eg, feltify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, sheen: 0.3, sheenRoughness: 0.8, sheenColor: 0xf2e6d4 }), { shell: k / 3, len: 0.35, freq: 14, rest: false })); sh.frustumCulled = false; ear.add(sh); } } // 長い耳は面が見えるので、体と同じ毛羽を（耳は縮めた球なので len・freq は球の大きさで）
    // 目: 頭の横の高い所に、まぶたのふちから少しだけ出る（飛び出して見えないよう、平たくして皮にうめる。まわりの毛は短く白っぽい＝下の eyeAt）
    const eye = new THREE.Mesh(new THREE.SphereGeometry(F.eyeR, 16, 12), new THREE.MeshPhysicalMaterial({ color: F.iris, roughness: 0.35, clearcoat: 0.35 }) /* てかりが強いと白目に見えて飛び出して見える */);
    const ea = eyeAt(s); eye.position.set(ea[0] - hbp.x, ea[1] - hbp.y, ea[2] - hbp.z); eye.scale.set(1, 1, 0.5); headBone.add(eye);
    if (F.button) craftButtonEye(eye, F, s); else { const pupil = new THREE.Mesh(new THREE.SphereGeometry(F.eyeR * 0.67, 12, 8), new THREE.MeshBasicMaterial({ color: 0x0e0906 })); pupil.position.set(F.eyeR * 0.11, F.eyeR * 0.05, F.eyeR * 0.56 * s); pupil.scale.set(1, 1, 0.6); eye.add(pupil); }
    // 寝ている目（ユーザー「寝ているときの目を用意して」）: 目の玉をかくして、目のまわりの短い毛の上に、下へふくらむ閉じた線（︶）だけ。
    //   まぶたの玉を重ねると、白っぽいこぶに見えた
    const lid = new THREE.Group(); lid.position.copy(eye.position); lid.visible = false; headBone.add(lid);
    const line = new THREE.Mesh(new THREE.TorusGeometry(F.eyeR * 0.95, F.eyeR * 0.2, 6, 20, Math.PI * 0.9), new THREE.MeshBasicMaterial({ color: 0x24170e }));
    line.rotation.z = Math.PI * 1.05; line.position.set(F.eyeR * 0.05, F.eyeR * 0.45, F.eyeR * 0.42 * s); line.scale.set(1, 0.65, 0.4); lid.add(line);
    eyeList.push({ eye, lid });
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
  // 泥の点: 骨の場所（生まれたとき）から見た網の点の場所 vl。ふれた世界の点は、いまの骨から見た場所に直して点にする
  const bone0 = bones.map(b => b.position.clone()), vl = new Float32Array(nv * 3), boneOfPart = {}, blobsBy = {};
  bodyKey.forEach((k, i) => (boneOfPart[k] = i));
  for (let q = 0; q < nv; q++) { const i = boneOfPart[SK.part[q]] ?? 0; vl[q * 3] = SK.position[q * 3] - bone0[i].x; vl[q * 3 + 1] = SK.position[q * 3 + 1] - bone0[i].y; vl[q * 3 + 2] = SK.position[q * 3 + 2] - bone0[i].z; }
  const _w = new THREE.Vector3();
  const pst = { wk: -1, ver: -1, t: 0 }; // 前にぬったときの、ぬれ・泥の印
  const wp2 = new THREE.Vector3();
  const mud = {
    blobs: [], ver: 0, // ver＝泥がついた・落ちた（ぬり直しの印）
    // hits＝[{part, p:[世界の点], amt, r}]（dirt.js の stepDirt が返す）。近い点は1つにまとめる
    hit(hits) {
      if (hits.length) this.ver++;
      for (const h of hits) {
        const i = boneOfPart[h.part]; if (i == null) continue;
        const l = bones[i].worldToLocal(_w.set(...h.p)), p = [l.x, l.y, l.z];
        const near = this.blobs.find(b => b.part === h.part && Math.hypot(b.p[0] - p[0], b.p[1] - p[1], b.p[2] - p[2]) < Math.max(b.r, h.r) * 0.9);
        if (near) { near.amt = Math.min(1.2, near.amt + h.amt); near.dry *= 1 - Math.min(1, h.amt * 3); near.old = 0; near.r = Math.min(0.06, Math.max(near.r, h.r)); }
        else { const nb = { part: h.part, p, r: h.r, amt: h.amt, dry: 0, old: 0, stain: 0 };
          if (this.blobs.length < 200) this.blobs.push(nb); else { let k = 0; this.blobs.forEach((b, i) => { if (b.amt + b.stain < this.blobs[k].amt + this.blobs[k].stain) k = i; }); this.blobs[k] = nb; } } // 多くても 200。いっぱいなら、いちばん薄い点と入れかえる（新しい点は捨てない）
      }
    },
    // 時間: ぬれた泥は乾いて（30 秒ほど）白っぽくカピカピに → 乾いて 20 秒ほどすると少しずつ落ちる（80 秒ほどで落ちきる）。落ちた分の少しはしみで残る。雨は落とす・ぬらす
    step(dt, rain = 0) {
      for (const b of this.blobs) {
        if (rain > 0) { b.amt = Math.max(0, b.amt - rain * 0.16 * dt); b.stain = Math.max(0, b.stain - rain * 0.05 * dt); b.dry = Math.max(0, b.dry - rain * 0.6 * dt); b.old = 0; continue; } // 雨でしっかり落ちる（テストプレイ）
        b.dry = Math.min(1, b.dry + dt / 30);
        if (b.dry >= 1) { b.old += dt; if (b.old > 20) { const f = Math.min(b.amt, dt * 0.012); b.amt -= f; b.stain = Math.min(0.12, b.stain + f * 0.2); } }
      }
      const n = this.blobs.length; this.blobs = this.blobs.filter(b => b.amt > 0.005 || b.stain > 0.005); if (this.blobs.length !== n) this.ver++;
    },
    wash() { this.blobs = []; this.ver++; }, // 水浴び: 泥もしみも落ちる
    get dirty() { return this.blobs.reduce((t, b) => t + b.amt + b.stain, 0); },
  };
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
        if (e.long) { // しなり（テストプレイ「適度にしなるように」）: 付け根のばねより ゆっくりのばねで、先が遅れてしなる。付け根の動きにも引かれる。ふだんは少し後ろへ反る
          e.vc += (-34 * e.c - 3.5 * e.vc + 0.5 * acc.y + 0.25 * acc.x - 8 * e.va) * h; e.c = Math.max(-0.55, Math.min(0.55, e.c + e.vc * h));
          e.vd += (-40 * e.d - 4 * e.vd + 0.3 * acc.z * e.s - 8 * e.vb) * h; e.d = Math.max(-0.4, Math.min(0.4, e.d + e.vd * h));
          if (Math.abs(e.c - e.cz) + Math.abs(e.d - (e.dz ?? 0)) > 0.002) { e.cz = e.c; e.dz = e.d; const a = e.eg.attributes.position, P = e.P0, L = 2 * e.ear.scale.y, kx = L / e.ear.scale.x * (e.c - 0.16), kz = L / e.ear.scale.z * e.d; for (let i = 0; i < a.count; i++) { const t = P[i * 3 + 1] / 2, t2 = t * t; a.array[i * 3] = P[i * 3] + kx * t2; a.array[i * 3 + 2] = P[i * 3 + 2] + kz * t2; } a.needsUpdate = true; }
        }
      }
    },
    // 泥（点ごと＝ふれた所を中心に）とぬれ（dirt.js の部位ごと）を、毛の色・毛羽の高さ・てかりに
    // 軽くする（2026-11-08 ユーザー「見た目を保ちつつ軽量化」。測ると1回 6ms＝泥の点 200 のとき）: 泥もぬれも変わっていなければ、ぬり直さない。
    //   泥の乾き・落ちはゆっくりなので、新しい泥がつかないあいだは 0.25 秒に1回まで。点から遠い（効きが 1/1000 より小さい）泥の点は計算しない
    paint(D) {
      let wsum = 0; if (D) for (const k in D) wsum += D[k].wet; const wk = Math.round(wsum * 50), now = performance.now();
      if (wk === pst.wk && mud.ver === pst.ver && (!mud.blobs.length ? true : now - pst.t < 250)) return;
      pst.wk = wk; pst.ver = mud.ver; pst.t = now;
      for (const k in blobsBy) blobsBy[k].length = 0; for (const b of mud.blobs) (blobsBy[b.part] ||= []).push(b);
      for (let q = 0; q < nv; q++) {
        const s = D?.[SK.part[q]], wet = s ? s.wet : 0, B = blobsBy[SK.part[q]];
        let m = 0, st = 0, dr = 0;
        if (B && B.length) { const x = vl[q * 3], y = vl[q * 3 + 1], z = vl[q * 3 + 2]; for (const b of B) { const d2 = ((x - b.p[0]) ** 2 + (y - b.p[1]) ** 2 + (z - b.p[2]) ** 2) / (b.r * b.r); if (d2 > 4.4) continue; const k = Math.exp(-d2 * (1.6 + 1.4 * speck[q])); m += b.amt * k; st += b.stain * k; dr += b.dry * b.amt * k; } }
        const mk = Math.min(1, m), wd = 1 - 0.3 * wet;
        for (let c = 0; c < 3; c++) col[q * 3 + c] = fur[q * 3 + c] * wd;
        mudA[q] = Math.min(1, mk + Math.min(0.35, st)); dryA[q] = m > 1e-3 ? Math.min(1, dr / m) : 1; // 残ったしみは乾いた泥の色でうっすら
        flf[q] = baseF[q] * Math.max(0.12, 1 - 0.55 * wet - 0.25 * mk * (1 - dryA[q])); // ぬれた泥は毛を寝かせる（乾くと、かたまって立つ＝shader）
        wetA[q] = Math.min(1, Math.max(wet * 0.7, mk * (1 - dryA[q])));
      }
      geo.attributes.color.needsUpdate = geo.attributes.fluff.needsUpdate = geo.attributes.wet.needsUpdate = geo.attributes.mud.needsUpdate = geo.attributes.mdry.needsUpdate = true;
    },
    // 泥の点（ユーザー「付着したところを中心に汚れがついて、周辺に多少しぶき」「時間でカピカピに乾燥して色も変わる」「乾いたまましばらくたつとパラパラ落ちてきれいに」「ほんの少しは汚れが残り続けるので、水浴びで」）
    // 点＝{部位, 骨から見た場所 p, 広さ r, 量 amt, 乾き dry 0..1, 乾いてからの秒 old, 残るしみ stain}。体の網の作りによらない（ページをまたいで持っていける）
    mud,
    // 起き直した体（同じ作りの新しい剛体）に付けかえる
    rebind(H2, yaw = 0) { if (!bodyKey.every(k => H2.parts[k])) return false; SK.bodies.forEach((_, i) => (SK.bodies[i] = H2.parts[bodyKey[i]].body)); /* 体の作りがちがえば付けかえない（途中まで付けかえると、皮の一部が別の体の骨について崩れた） */ yawQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw); first = true; return true; }, // yaw＝buildHare に渡した向き
    // 待機のしぐさ: 呼吸（休むと1秒に1回ほど、走ったあとは速く深く、だんだん落ち着く）と、止まっているときの耳のぴくつき（音を聞く）
    // effort＝いまの走る強さ 0..1（g）。速さは 2026-11-08 にユーザー「8割に」。数は見立て（ノウサギの安静時の呼吸の数は見つかっていない。飼いウサギは1分に30〜60回）
    breathe(dt, effort = 0) {
      bst.tired = Math.min(1, Math.max(0, bst.tired + (effort > 0.3 ? effort * 0.25 : 0) * dt)) * Math.exp(-(effort > 0.3 ? 0 : dt / 8));
      bst.ph += dt * Math.PI * 2 * 0.8 * (0.9 + 1.8 * bst.tired); breathU.value = (0.003 + 0.003 * bst.tired) * (0.5 - 0.5 * Math.cos(bst.ph));
      if (effort < 0.1 && earList.length && (bst.flick -= dt) < 0) { const e = earList[Math.random() < 0.5 ? 0 : 1]; e.vb += (Math.random() < 0.5 ? -1 : 1) * 9; e.va += (Math.random() - 0.3) * 6; bst.flick = 1.5 + Math.random() * 5; }
    },
    // 目を閉じる／あける（生まれたては寝ている目）
    sleep(on) { eyeList.forEach(e => { e.eye.visible = !on; e.lid.visible = on; }); },
    // 鳴くとき: 両耳がぴんと動いて、ひと息ふくらむ
    perk() { earList.forEach(e => { e.va += 8; e.vb += (Math.random() - 0.5) * 4; }); bst.ph = Math.PI * 0.6; },
    // 見た目を変える（声で育つ）: 新しい毛の色と耳へ、k＝0..1 でなめらかに移る（ぱっと入れかえない）。begin で行き先を決め、blend(k) を毎こま
    look: {
      begin(furColor2, face2) {
        const n = geo.attributes.normal, to = new Float32Array(nv * 3);
        for (let q = 0; q < nv; q++) to.set(furColor2(SK.part[q], [SK.position[q * 3], SK.position[q * 3 + 1], SK.position[q * 3 + 2]], [n.getX(q), n.getY(q), n.getZ(q)]), q * 3);
        this.A = { fur: fur.slice(), ears: earList.map(e => ({ size: e.ear.scale.toArray(), back: e.back ?? F.ear.back, col: e.eg.attributes.color.array.slice() })) };
        this.B = { fur: to, ears: earList.map(e => { const ep = e.eg.attributes.position, c = new Float32Array(ep.count * 3); for (let i = 0; i < ep.count; i++) { const y = ep.getY(i) - 1, z = ep.getZ(i); c.set(y > face2.ear.tipAt ? face2.ear.tip : (e.z0 ? e.z0[i] : z) * e.s > 0.3 ? face2.ear.inner : face2.ear.outer, i * 3); } return { size: face2.ear.size, back: face2.ear.back, col: c }; }) };
      },
      blend(k) {
        const { A, B } = this; if (!A) return; const m = (a, b) => a + (b - a) * k;
        for (let i = 0; i < fur.length; i++) fur[i] = m(A.fur[i], B.fur[i]); pst.wk = -1; // 毛の色だけ移し、塗るのは paint にまかせる（ここで col に毛の色をそのまま書くと、ぬれ・泥で暗くした paint と交互になって点滅して見えた）
        earList.forEach((e, j) => { const a = A.ears[j], b = B.ears[j]; e.ear.scale.set(m(a.size[0], b.size[0]), m(a.size[1], b.size[1]), m(a.size[2], b.size[2])); e.back = m(a.back, b.back); const c = e.eg.attributes.color.array; for (let i = 0; i < c.length; i++) c[i] = m(a.col[i], b.col[i]); e.eg.attributes.color.needsUpdate = true; });
        geo.attributes.color.needsUpdate = true;
      },
    },
    dispose() { meshes.forEach(m => { scene.remove(m); m.material.dispose(); }); scene.remove(rig); geo.dispose(); },
    setAge(a) { coat.age.value = a; }, // 年 0..1（黄ばみ・くすみ・毛羽のはげ）
    lod(camPos, fov, drawH) { headBone.getWorldPosition(wp2); const px = 0.003 * drawH / (2 * wp2.distanceTo(camPos) * Math.tan(fov * Math.PI / 360)); farU.value = Math.max(0, Math.min(1, (3.2 - px) / 2.4)); }, // 毛1本（3mm）が画面で何ピクセルか
    setVisible(b) { meshes.forEach(m => (m.visible = b)); headBone.children.forEach(c => { if (!eyeList.some(e => e.lid === c)) c.visible = b; }); }, // 閉じた目の線は sleep だけが出し入れする
    // 体に物を付ける（ひっつき虫）: part＝部位の名前、local＝その部位の骨から見た場所
    attach(part, obj, local) { const i = boneOfPart[part]; if (i == null) return false; bones[i].add(obj); obj.position.set(...local); return true; },
  };
}

// ---- ジオラマの見え方: 上下のぼけ（ティルトシフト）と、四すみの影・少しこい色 ----
const Vignette = { uniforms: { tDiffuse: { value: null }, amt: { value: 0.35 }, sat: { value: 1.08 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float amt, sat; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.299, 0.587, 0.114)); c.rgb = mix(vec3(l), c.rgb, sat); vec2 d = vUv - 0.5; c.rgb *= 1.0 - amt * smoothstep(0.25, 0.75, dot(d, d) * 2.2); gl_FragColor = c; }' };
// 水（js/water-blob.js）: 景色を描いたあと、その絵を写しておき、水はそれを屈折させて読む（花の小川 post3d.js の RefractPass と同じ）。水は layer 1、深さは景色のもの
class RefractPass extends Pass {
  constructor(camera) { super(); this.needsSwap = false; this.camera = camera; this.mesh = null; this.copy = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms), vertexShader: CopyShader.vertexShader, fragmentShader: CopyShader.fragmentShader })); this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }); }
  setSize(w, h) { this.rt.setSize(w, h); }
  render(renderer, writeBuffer, readBuffer) {
    const m = this.mesh; if (!m || !m.visible) return;
    this.copy.material.uniforms.tDiffuse.value = readBuffer.texture; renderer.setRenderTarget(this.rt); this.copy.render(renderer);
    m.material.uniforms.tScene.value = this.rt.texture; m.material.uniforms.res.value.set(this.rt.width, this.rt.height);
    m.material.uniforms.vp.value.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.setRenderTarget(readBuffer);
    const L = this.camera.layers.mask; this.camera.layers.set(1); renderer.render(m, this.camera); this.camera.layers.mask = L; renderer.autoClear = ac;
  }
}
export function makeDiorama(renderer, scene, cam) {
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, cam));
  const refract = new RefractPass(cam); composer.addPass(refract);
  const hts = new ShaderPass(HorizontalTiltShiftShader), vts = new ShaderPass(VerticalTiltShiftShader), vig = new ShaderPass(Vignette);
  composer.addPass(hts); composer.addPass(vts); composer.addPass(vig); composer.addPass(new OutputPass());
  return {
    composer, refract, setSize(w, h) { composer.setSize(w, h); },
    // blur＝ぼけの強さ（画面の点）、focus＝ぴんとの合う高さ（0..1、下から）
    render(blur = 2, focus = 0.5, vignette = 0.35) { hts.uniforms.h.value = blur / innerWidth; vts.uniforms.v.value = blur / innerHeight; hts.uniforms.r.value = vts.uniforms.r.value = focus; vig.uniforms.amt.value = vignette; composer.render(); },
  };
}
