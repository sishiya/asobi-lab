// 花の小川: 写実の花と草（ver. 0.7、ユーザー「フォトリアリスティックな世界を追求して」）。
// 株は Poly Haven（CC0）の実物のスキャンを tools/build-flora.py で軽くした assets/flora-real.glb。光は同じく CC0 の空の写真（HDRI）から。
// - 花を咲かせる: 株ごとの aOpen（0＝つぼみ〜1＝満開）。頂点シェーダーで、株の上のほう（花）を茎のほうへすぼめ、少し低くする。
//   つぼみのあいだは花びらの色を緑へ寄せる。
// - 華やかさ: 実物は黄・オレンジが多いので、株ごとに花びらの色だけ色相を回す（緑の葉・茎はそのまま。aHue）。
// - 風: 高いところほど、ゆっくりゆれる。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ゲームの花の種類（flora3d の FLORA_KINDS の番号）→ 実物の株の名前の頭。3＝めずらしい花
const FAMILY = { 0: 'gazania', 1: 'celandine', 2: 'dandelion', 3: 'ursinia', 4: 'gazania', 5: 'celandine' };
// 色相を回す量（花びらだけ）。0＝実物の色のまま。ピンク・赤・紫・白っぽい黄へ
const HUES = [0, 0, 0.06, 0.12, 0.18, 0.24, 0.30, 0.36];   // 黄・オレンジ → 赤・ピンク・赤紫・紫（実在する花の色の範囲。明るさは YIQ で保つ）

export async function loadReal(base, renderer, coarse) {
  const [gltf, hdr] = await Promise.all([
    new GLTFLoader().loadAsync(base + 'assets/flora-real.glb'),
    new RGBELoader().loadAsync(base + 'assets/sky-env.hdr'),
  ]);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer), env = pm.fromEquirectangular(hdr).texture; pm.dispose();   // hdr はしずくの映りこみにも使う（js/blob3d.js）
  const parts = {};
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;   // スマホも全部の株（軽い株には花のないものがあった）。数は world3d で減らす
    const g = o.geometry; g.computeBoundingBox();
    parts[o.name] = { geo: g, mat: o.material, h: g.boundingBox.max.y };
  });
  const names = Object.keys(parts);
  const pick = (fam, r) => { const c = names.filter(n => n.startsWith(fam)); return c.length ? c[Math.floor(r * c.length) % c.length] : names.filter(n => !n.startsWith('grass'))[0]; };
  return { env, sky: hdr, parts, pick, names };
}

const mats = new Map();
function realMaterial(src, h, U) {   // U: 花の材質の uniforms（t・wind・touch・touch2 を同じものにして、指のおじぎと風をそろえる）
  const key = src.uuid + ':' + h.toFixed(3);
  if (mats.has(key)) return mats.get(key);
  const m = src.clone();
  m.side = THREE.DoubleSide; m.alphaTest = Math.max(m.alphaTest || 0, 0.4); m.transparent = false; m.envMapIntensity = 2.0;   // 空の写真の光（暗いと実物の葉が茶色く沈む）
  m.onBeforeCompile = sh => {
    for (const k of ['t', 'wind', 'touch', 'touch2']) sh.uniforms[k] = U[k];
    sh.uniforms.uH = { value: h };   // 本文に埋めこむと、プログラムの使い回しで全部の株が最初の株の高さになる（批判役）
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aOpen; attribute float aHue; attribute float aPhase; varying float vOpen; varying float vHue; varying float vUp;
        uniform float t; uniform float wind; uniform vec4 touch; uniform vec4 touch2; uniform float uH;   // uH＝株の高さ（材質ごと）
        // 風と指（js/flora3d.js の sway と同じ式）: 世界の向きで、根もとからの高さ h ほど大きく
        vec2 sway(vec2 wp, float ph, float h){
          float w = sin(t * 1.4 * wind + wp.x * .55 + wp.y * .35 + ph) * .7 + sin(t * 2.3 * wind + wp.y * 1.1 + ph * 2.) * .3;
          vec2 o = vec2(w * .07 * wind, w * .025 * wind);
          for (int k = 0; k < 2; k++) { vec4 tc = k == 0 ? touch : touch2; vec2 d = wp - tc.xy; float r = length(d) + 1e-4, s = tc.z * exp(-r * r / (tc.w * tc.w)); o += d / r * s * (.5 + .25 * sin(t * 11. + r * 4.)); }
          return o * h * h;
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float up = clamp(position.y / uH, 0., 1.), head = smoothstep(.45, .9, up);
        transformed.xz *= mix(1., mix(.3, 1., aOpen), head);   // つぼみ: 花のところを茎へすぼめる
        transformed.y *= mix(1., mix(.82, 1., aOpen), head);
        mat3 iM3 = mat3(instanceMatrix); float isc = length(iM3[0]); vec2 o = sway(instanceMatrix[3].xz, aPhase * 6.28, up);
        transformed += transpose(iM3) * vec3(o.x, 0., o.y) / (isc * isc);   // 世界の向きのずれを、株の向き・大きさへもどす
        vOpen = aOpen; vHue = aHue; vUp = up;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vOpen; varying float vHue; varying float vUp;
        // 色相を回す（YIQ で。明るさを保つ）
        vec3 hueRot(vec3 c, float a){ float y = dot(c, vec3(.299, .587, .114)), i = dot(c, vec3(.596, -.274, -.322)), q = dot(c, vec3(.211, -.523, .312)); float ca = cos(a * 6.2832), sa = sin(a * 6.2832); float i2 = i * ca - q * sa, q2 = i * sa + q * ca; return vec3(y + .956 * i2 + .621 * q2, y - .272 * i2 - .647 * q2, y - 1.106 * i2 + 1.703 * q2); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { vec3 c = diffuseColor.rgb; float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = (mx - mn) / max(mx, 1e-3);
          float petal = smoothstep(.3, .55, sat) * smoothstep(.25, .5, mx) * step(c.g * 1.05, max(c.r, c.b)) * smoothstep(.35, .6, vUp);   // あざやかで明るく、緑でなく、株の上のほう（枯れ葉・がくを外す）
          diffuseColor.rgb = mix(c, max(hueRot(c, vHue), 0.), petal);
          diffuseColor.rgb *= mix(vec3(1.), vec3(.45, .75, .38), petal * (1. - smoothstep(.15, .7, vOpen)));   // つぼみ: 色をかけて緑へ寄せる（ベタ塗りにしない）
          diffuseColor.rgb = max(diffuseColor.rgb, 0.); }`);
  };
  m.customProgramCacheKey = () => 'real-flora';
  m.userData.keep = true;
  mats.set(key, m);
  return m;
}

// list: [{ x, z, kind, size, open, phase, grass? }] → { group, place: [{ m, j }]（list と同じ順）}。
// 花は種類ごとの実物の株、草は grass_*。scale は ゲームの大きさ 1 のときの倍率（実物はメートル）
export function realMesh(real, list, scale, U, rand) {
  const byName = new Map(), place = new Array(list.length);
  list.forEach((f, i) => {
    const name = f.grass ? real.pick('grass', rand()) : real.pick(FAMILY[f.kind] || 'gazania', rand());
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(i);
  });
  const group = new THREE.Group(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  for (const [name, idx] of byName) {
    const pt = real.parts[name], geo = new THREE.BufferGeometry();   // 頂点は元の株と共有（複製しない。批判役）
    geo.setIndex(pt.geo.index); for (const a in pt.geo.attributes) geo.setAttribute(a, pt.geo.attributes[a]);
    const n = idx.length, open = new Float32Array(n), hue = new Float32Array(n), ph = new Float32Array(n);
    const mesh = new THREE.InstancedMesh(geo, realMaterial(pt.mat, pt.h, U), n);
    idx.forEach((i, j) => {
      const f = list[i], k = f.size * scale, sy = 0.9 + rand() * 0.25;
      _e.set(0, rand() * 6.283, 0); _q.setFromEuler(_e); _m.compose(_p.set(f.x, 0, f.z), _q, _s.set(k, k * sy, k)); mesh.setMatrixAt(j, _m);
      open[j] = f.grass ? 1 : f.open; hue[j] = f.grass || f.kind === 3 ? 0 : HUES[Math.floor(rand() * HUES.length)]; ph[j] = f.phase ?? rand();
      place[i] = { m: mesh, j, rot: _q.clone(), k, sy };
    });
    geo.setAttribute('aOpen', new THREE.InstancedBufferAttribute(open, 1));
    geo.setAttribute('aHue', new THREE.InstancedBufferAttribute(hue, 1));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
    mesh.computeBoundingSphere(); mesh.boundingSphere.radius += 1;
    group.add(mesh);
  }
  return { group, place };
}
