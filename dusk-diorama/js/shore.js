// 夜明けの岸（PLAN.md 2.9章・ディレクター 2026-10-23）: 第5夜の終わりに島が着く大地
// 見た目の芯: 下に奈落がない（崖は霧の底までつづく＝もう崩れない）・崖の上の灯台・先に着いた舟島と窓の灯（人は出さない）・枯れていない緑
// +z が島の来る側（海岸線は z ≈ 0）。上の面の高さは 0 前後。島の単位と同じ大きさ（島の小屋の幅 1.1）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, vnoise, fbm } from './util.js';
import { texMat, planarUV, lumpyRock, bladeGeo } from './tex.js';

const B = (a, b, c, s = 2.2) => planarUV(new THREE.BoxGeometry(a, b, c), s);
function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; return m; }
// 三角柱の屋根（幅 w・高さ h・奥行き d）
function prism(w, h, d) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return planarUV(g.toNonIndexed(), 2.2); }

export const PIER_LEN = 7; // 桟橋の先（島のふちが着く所）は z = coast(0) + PIER_LEN

// 海岸線: 桟橋の所（x=0）は少し入り江、灯台の岬（x=-11）は前へ出る
export function coast(x) { return 0.9 * Math.sin(x * 0.27 + 1) + 0.6 * (vnoise(x * 0.45 + 9, 3) - 0.5) * 2 + 3.2 * Math.exp(-((x + 11) ** 2) / 10) - 1.2 * Math.exp(-(x * x) / 14); }
// 上の面の高さ（うしろへゆるく上がる丘）
function baseY(x, z) { return (fbm(x * 0.12 + 4, z * 0.12 + 2) - 0.5) * 1.4 + Math.max(0, -z - 6) * 0.12 + 1.6 * Math.exp(-((x + 11) ** 2 + (z - 0.5) ** 2) / 8); }

// 横とうしろのふちは、でこぼこに下がって崖へ（上から見て四角い板に見えないように）
export function topY(x, z) { const e = Math.min(x + 32, 32 - x, z + 34) + (vnoise(x * 0.18 + 7, z * 0.18) - 0.5) * 5; return baseY(x, z) - 9 * (1 - Math.min(1, Math.max(0, e / 6)) ** 2); }

// 崖の下のほうを消す（夜のあいだ、遠くの岸は霧で黒くなり、深い崖が空をふさぐ四角い壁に見えた）。uFade = 1 で元の厚い崖
const FADE = { value: 1 };
function fadeBottom(mat) {
  mat.transparent = true; mat.userData.dark = true; // 闇の色づけ（patchDark）とは組み合わせない。遠くの岸は霧で十分暗い
  mat.onBeforeCompile = sh => {
    sh.uniforms.uFade = FADE;
    sh.vertexShader = 'varying float vLy;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLy = position.y;');
    sh.fragmentShader = 'uniform float uFade; varying float vLy;\n' + sh.fragmentShader.replace('#include <fog_fragment>', '#include <fog_fragment>\n gl_FragColor.a *= mix(smoothstep(-16., -1.5, vLy), 1., uFade);');
  };
  mat.customProgramCacheKey = () => 'shore-fade';
}

export function makeShore(TX) {
  const g = new THREE.Group(), R = rng(501);
  const M = {
    ground: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: TX.ground, bumpMap: TX.ground, bumpScale: 1.5 }),
    cliff: texMat('#56524d', TX.rock, 3, { flatShading: true, side: THREE.DoubleSide }), rock: texMat('#6a625a', TX.rock, 2, { flatShading: true }),
    stone: texMat('#8a847a', TX.stone, 2.5), plaster: texMat('#9a8d78', TX.plaster, 2), wood: texMat('#5a4636', TX.wood, 1.5), timber: texMat('#3e3026', TX.wood, 1.5),
    tile: texMat('#5d4f4a', TX.tile, 1.5, { roughness: 0.75 }), leaf: texMat('#2f4a2a', TX.bark, 2, { flatShading: true }), bark: texMat('#3b3029', TX.bark, 3),
    white: texMat('#c9c2b4', TX.plaster, 1.5), iron: new THREE.MeshStandardMaterial({ color: '#1d1b1a', roughness: 0.55, metalness: 0.6 }),
  };
  // 窓・灯台の灯は闇に沈めない（夜のうちから「先に着いた人の灯」が見える）
  const glow = new THREE.MeshBasicMaterial({ color: '#ffb35c', fog: false }); glow.userData.dark = true;
  const glass = new THREE.MeshBasicMaterial({ color: '#ffe2a8', fog: false }); glass.userData.dark = true;
  const lhGlass = new THREE.MeshBasicMaterial({ color: '#ffe2a8', fog: false }); lhGlass.userData.dark = true; // 灯台の灯室（崖の場面では消えていて、火トカゲが火を分けるとともる）

  // ── 上の面: 格子を海岸線まで寄せる ──
  { const nx = 84, nz = 48, x0 = -32, x1 = 32, z0 = -34, pos = [], col = [], idx = [], c = new THREE.Color();
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + (x1 - x0) * i / nx, cz = coast(x), z = z0 + (cz - z0) * Math.pow(j / nz, 0.8), y = topY(x, z) - (j === nz ? 0.15 : 0);
      pos.push(x, y, z);
      const edge = Math.max(0, 1 - (cz - z) / 1.6), dry = vnoise(x * 0.3, z * 0.3); // ふちは土と岩、奥は草
      c.set('#3d4a2c').lerp(new THREE.Color('#5a5a3a'), dry * 0.6).lerp(new THREE.Color('#5a4c40'), edge * 0.8); col.push(c.r, c.g, c.b);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    const uv = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k] * 0.35, pos[k + 2] * 0.35); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
    const top = new THREE.Mesh(geo, M.ground); top.receiveShadow = true; g.add(top); }

  // ── 崖: 海岸線から霧の底まで。層の段とえぐれ（奈落ではなく、大地の壁） ──
  { const nx = 128, ny = 36, pos = [], idx = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const x = -32 + 64 * i / nx, t = j / ny, y = topY(x, coast(x)) - 0.15 - t * 46, strata = Math.sin(y * 1.7 + vnoise(x * 0.2, y * 0.1) * 3) * 0.25;
      const end = Math.min(1, (32 - Math.abs(x)) / 4); // 両はしは横の崖とぴったり合わせる（角にすき間があって空が透けた）
      const out = ((vnoise(x * 0.5 + 3, y * 0.25) - 0.5) * 1.6 + strata + t * 6 + (j === 0 ? 0 : 0.2)) * end; // 下へ行くほど前へ張り出す（裾が広い）
      pos.push(x, y, coast(x) + out - (j === 0 ? 0 : 0.15));
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1; idx.push(a, b, d, b, e, d); }
    let geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo = geo.toNonIndexed(); geo.computeVertexNormals(); planarUV(geo, 0.5);
    const cl = new THREE.Mesh(geo, M.cliff); cl.receiveShadow = true; g.add(cl);
    // 横とうしろの崖も閉じる（大地の厚み。どの向きから見ても、薄い板に見えないように）
    const wall = pts => { const n = pts.length - 1, ny2 = 24, P = [], I = [];
      for (let j = 0; j <= ny2; j++) for (let i = 0; i <= n; i++) { const [x, z] = pts[i], [ax, az] = pts[Math.max(0, i - 1)], [bx, bz] = pts[Math.min(n, i + 1)], tx = bx - ax, tz = bz - az, L = Math.hypot(tx, tz) || 1, nx = tz / L, nz = -tx / L, t = j / ny2, y = topY(x, z) - 0.1 - t * 46, o = ((vnoise(x * 0.5 + z * 0.3, y * 0.25) - 0.5) * 1.4 + t * 5) * Math.min(1, i / 4, (n - i) / 4); P.push(x + nx * o, y, z + nz * o); }
      for (let j = 0; j < ny2; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, d = a + n + 1, e = d + 1; I.push(a, b, d, b, e, d); }
      let w = new THREE.BufferGeometry(); w.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); w.setIndex(I); w = w.toNonIndexed(); w.computeVertexNormals(); planarUV(w, 0.5); const m = new THREE.Mesh(w, M.cliff); m.receiveShadow = true; g.add(m); };
    const side = x => Array.from({ length: 25 }, (_, i) => [x, -34 + (coast(x) + 34) * i / 24]);
    // 中身: 崖の壁のすき間から空がのぞかないよう、奥に暗い岩のかたまり
    { const coreM = new THREE.MeshStandardMaterial({ color: '#1e1814', roughness: 1 }); fadeBottom(coreM); const cg = new THREE.BoxGeometry(62, 46, 30, 1, 12, 1); cg.translate(0, -23.5, -18); g.add(new THREE.Mesh(cg, coreM)); } // 消すのは頂点の高さで見るので、位置はジオメトリに
    wall(side(-32).reverse()); wall(side(32)); wall(Array.from({ length: 41 }, (_, i) => [32 - 64 * i / 40, -34]));
    // 崖のふちの落ちかけた岩
    const rocks = []; for (let i = 0; i < 70; i++) { const x = -30 + R() * 60, z = coast(x) - R() * 1.2, s = 0.15 + R() * 0.5, r = lumpyRock(s, i, vnoise); r.translate(x, topY(x, z) + s * 0.2, z); rocks.push(r); }
    const rm = new THREE.Mesh(mergeGeometries(rocks), M.rock); rm.castShadow = rm.receiveShadow = true; g.add(rm); }

  // ── 草（枯れていない） ──
  { const N = 5000, blade = bladeGeo(), mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, side: THREE.DoubleSide }), im = new THREE.InstancedMesh(blade, mat, N), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    let n = 0;
    for (let i = 0; i < N * 3 && n < N; i++) { const x = -30 + R() * 60, z = -30 + R() * 31; if (z > coast(x) - 0.4 || vnoise(x * 0.4, z * 0.4) < 0.35) continue;
      e.set((R() - .5) * 0.5, R() * 6, (R() - .5) * 0.5); m.compose(new THREE.Vector3(x, topY(x, z) - 0.02, z), q.setFromEuler(e), new THREE.Vector3(1, 0.25 + R() * 0.3, 1)); im.setMatrixAt(n, m);
      c.set('#3e5a2c').lerp(new THREE.Color('#7a7444'), R() * 0.5); im.setColorAt(n++, c); }
    im.count = n; im.receiveShadow = true; g.add(im); }

  // ── 木（葉のある木。島の枯れ木と比べて「朝の残る岸」） ──
  { const leaves = [], trunks = [];
    for (let i = 0; i < 40; i++) { const x = -28 + R() * 56, z = -26 + R() * 20; if (Math.abs(x - 6) < 6 && z > -12) continue; if (Math.abs(x + 11) < 3 && z > -4) continue; const y = topY(x, z), h = 1.2 + R() * 1.3;
      const t = new THREE.CylinderGeometry(0.05, 0.09, h, 6); t.translate(x, y + h / 2, z); trunks.push(t);
      for (let k = 0; k < 4; k++) { const s = 0.45 + R() * 0.4, l = lumpyRock(s, i * 7 + k, vnoise); l.translate(x + (R() - .5) * 0.6, y + h + (R() - .3) * 0.5, z + (R() - .5) * 0.6); leaves.push(l); } }
    for (const [list, mat] of [[trunks, M.bark], [leaves, M.leaf]]) { const geos = list.map(x => x.index ? x.toNonIndexed() : x); geos.forEach(x => { if (!x.attributes.uv) planarUV(x, 2); else planarUV(x, 2); }); const o = new THREE.Mesh(mergeGeometries(geos), mat); o.castShadow = o.receiveShadow = true; g.add(o); } }

  // ── 港の村（先に着いた村人の家。窓に灯。人は出さない） ──
  const chimneys = [];
  { const spots = [[3.5, -5, 0.3], [6.5, -4.2, -0.2], [9.5, -6, 0.5], [5, -8.5, 0.1], [8.5, -9.5, -0.4], [12.5, -7.5, 0.2], [2, -10.5, 0.6], [11, -12, -0.1]];
    for (const [x, z, ry] of spots) {
      const h = new THREE.Group(), y = topY(x, z), w = 1.1 + R() * 0.4, ht = 0.8 + R() * 0.3, d = 0.9; h.position.set(x, y - 0.05, z); h.rotation.y = ry + 0.2; g.add(h);
      h.add(mesh(B(w + 0.1, 0.18, d + 0.1), M.stone, 0, 0.02, 0)); h.add(mesh(B(w, ht, d), M.plaster, 0, ht / 2 + 0.08, 0));
      for (const bx of [-w / 2, w / 2]) for (const bz of [-d / 2, d / 2]) h.add(mesh(B(0.07, ht, 0.07), M.timber, bx, ht / 2 + 0.08, bz));
      h.add(mesh(prism(w + 0.3, 0.7, d + 0.3), M.tile, 0, ht + 0.08, 0));
      h.add(mesh(B(0.2, 0.9, 0.22), M.stone, w * 0.25, ht + 0.5, -d * 0.2)); chimneys.push(h.localToWorld.bind(h, new THREE.Vector3(w * 0.25, ht + 1.0, -d * 0.2)));
      for (const [px, pz, rot] of [[-w * 0.2, d / 2 + 0.005, 0], [w * 0.22, d / 2 + 0.005, 0], [w / 2 + 0.005, 0, Math.PI / 2]]) { if (R() < 0.25) continue; h.add(mesh(new THREE.PlaneGeometry(0.18, 0.2), glow, px, ht * 0.6, pz, 0, rot, 0)); }
      h.add(mesh(B(0.24, 0.42, 0.03), M.wood, w * 0.05, 0.29, d / 2 + 0.02));
    } }

  // ── 灯台（崖の岬の上）: 石の塔・回廊・灯室・とんがり屋根 ──
  const lampAt = new THREE.Vector3();
  { const x = -11, z = 1.2, y = topY(x, z), t = new THREE.Group(); t.position.set(x, y - 0.1, z); g.add(t);
    t.add(mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.5, 10), M.stone, 0, 0.25, 0));
    const tw = planarUV(new THREE.CylinderGeometry(0.62, 0.95, 6.2, 14, 6), 1.2); t.add(mesh(tw, M.white, 0, 3.6, 0));
    for (const yy of [1.6, 3.6, 5.4]) t.add(mesh(new THREE.CylinderGeometry(0.98 - yy * 0.052, 1.0 - yy * 0.052, 0.18, 14), M.stone, 0, yy, 0)); // 石の帯
    for (const [yy, a] of [[2.4, 0.4], [4.4, 2.6]]) t.add(mesh(new THREE.PlaneGeometry(0.16, 0.28), glow, Math.sin(a) * 0.86, yy, Math.cos(a) * 0.86, 0, a, 0)); // 小窓
    t.add(mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 16), M.iron, 0, 6.75, 0)); // 回廊
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; t.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 4), M.iron, Math.cos(a) * 0.92, 6.95, Math.sin(a) * 0.92)); }
    t.add(mesh(new THREE.TorusGeometry(0.92, 0.015, 4, 24), M.iron, 0, 7.12, 0, Math.PI / 2, 0, 0));
    t.add(mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.75, 12), lhGlass, 0, 7.2, 0)); // 灯室
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; t.add(mesh(B(0.04, 0.8, 0.04), M.iron, Math.cos(a) * 0.5, 7.2, Math.sin(a) * 0.5)); }
    t.add(mesh(new THREE.ConeGeometry(0.62, 0.7, 12), M.iron, 0, 7.92, 0)); t.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), M.iron, 0, 8.3, 0));
    lampAt.set(x, y + 7.1, z);
    // 灯台守の小屋
    const hut = new THREE.Group(); hut.position.set(x + 2.2, topY(x + 2.2, z - 1.4), z - 1.4); hut.rotation.y = -0.4; g.add(hut);
    hut.add(mesh(B(1.3, 0.8, 0.9), M.white, 0, 0.45, 0)); hut.add(mesh(prism(1.55, 0.55, 1.15), M.tile, 0, 0.85, 0)); hut.add(mesh(new THREE.PlaneGeometry(0.2, 0.22), glow, 0.25, 0.5, 0.456)); }

  // ── 桟橋: 崖のふちから、島の着く所まで。脚は崖の壁へ斜めにつっぱる ──
  { const z0 = coast(0) - 0.6, z1 = coast(0) + PIER_LEN, y = topY(0, coast(0)) - 0.05, planks = [], posts = [];
    for (let z = z0; z < z1; z += 0.16) { const b = B(1.3 + (R() - .5) * 0.08, 0.05, 0.14, 3); b.rotateY((R() - .5) * 0.04); b.translate((R() - .5) * 0.04, y + (R() - .5) * 0.015, z); planks.push(b.toNonIndexed()); }
    for (const s of [-1, 1]) { const rail = B(0.08, 0.1, z1 - z0, 2.5); rail.translate(s * 0.66, y - 0.07, (z0 + z1) / 2); planks.push(rail.toNonIndexed()); }
    for (let z = coast(0) + 1.5; z < z1 + 0.1; z += 1.8) for (const s of [-1, 1]) {
      const p = B(0.12, 3.6, 0.12, 2.5); p.translate(s * 0.62, y - 1.8, z); posts.push(p.toNonIndexed());
      const br = B(0.08, Math.hypot(1.8, 2.4), 0.08, 2.5); br.rotateX(Math.atan2(1.8, 2.4)); br.translate(s * 0.62, y - 1.5, z - 0.9); posts.push(br.toNonIndexed()); }
    for (const s of [-1, 1]) { const bo = new THREE.CylinderGeometry(0.08, 0.1, 0.3, 8); bo.translate(s * 0.55, y + 0.15, z1 - 0.2); posts.push(planarUV(bo.toNonIndexed(), 2)); } // もやい杭
    const pm = new THREE.Mesh(mergeGeometries(planks), M.wood), qm = new THREE.Mesh(mergeGeometries(posts), M.timber); pm.castShadow = pm.receiveShadow = qm.castShadow = true; g.add(pm, qm);
    // 桟橋の先の灯は、崖の場面の台（lamps.js の cliff）に
  }

  // ── 先に着いた舟島（村人をのせてきた小さな浮き島）: 桟橋のわきに、綱でつないである ──
  const boat = new THREE.Group();
  { const x = 3.6, z = coast(3.6) + 3.2; boat.position.set(x, topY(0, coast(0)) - 0.35, z); g.add(boat);
    const base = new THREE.CylinderGeometry(1.4, 1.1, 0.4, 9); base.scale(1, 1, 0.8); boat.add(mesh(planarUV(base.toNonIndexed(), 1.5), M.cliff, 0, 0, 0));
    const under = lumpyRock(1.2, 77, vnoise); under.scale(1, 2.2, 0.9); under.translate(0, -1.6, 0); boat.add(mesh(under, M.cliff));
    boat.add(mesh(B(0.8, 0.55, 0.6), M.plaster, -0.3, 0.45, 0)); boat.add(mesh(prism(1.0, 0.45, 0.8), M.tile, -0.3, 0.72, 0)); boat.add(mesh(new THREE.PlaneGeometry(0.14, 0.16), glow, -0.15, 0.45, 0.31));
    boat.add(mesh(B(0.05, 0.9, 0.05), M.timber, 0.6, 0.6, 0.2)); boat.add(mesh(B(0.1, 0.12, 0.1), glass, 0.6, 1.05, 0.2)); // 舟島の灯（第1夜に見えた灯）
    const rope = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.6, 0.3, 0.2), new THREE.Vector3(-0.8, -0.1, 0.2), new THREE.Vector3(-3.0, 0.2, -0.4)].map(v => v)), 16, 0.02, 5); boat.add(mesh(rope, texMat('#7a6248', TX.bark, 4))); }

  // 煙突のけむり（朝の空へ、ゆっくり）
  const puffTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const puffs = []; g.updateMatrixWorld(true);
  for (const [k, at] of chimneys.entries()) { if (k % 2) continue; const p0 = g.worldToLocal(at()); for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: '#8a8078', transparent: true, depthWrite: false })); s.userData = { p0, life: i / 8 * 5 }; g.add(s); puffs.push(s); } }

  // ── 灯台の崖（PLAN.md 2.11）: 桟橋の先から岬の灯台の下まで、冷えた台を置く場所。5つめの前に割れ目、7つめは風の通り道 ──
  const yp = topY(0, coast(0)) - 0.05, z1 = coast(0) + PIER_LEN;
  const path = [[0.45, z1 - 0.6, 'pier'], [-0.45, z1 - 3.3, 'pier'], [0.45, 0.8, 'pier'], [-1.2, -1.9], [-3.6, -2.4], [-7.6, -1.2, 'gully'], [-9.0, -0.9, 'windy'], [-9.4, 0.6, 'last']]
    .map(([x, z, tag]) => ({ x, z, y: tag === 'pier' ? yp : topY(x, z), pier: tag === 'pier', afterGully: tag === 'gully', windy: tag === 'windy', last: tag === 'last' }));
  const gully = { x: -5.6, z: -1.8 };
  { const Rg = rng(88), pts = [];
    for (let i = 0; i <= 10; i++) pts.push([-0.45 - Rg() * 0.2, -1.7 + i * 0.34]); for (let i = 10; i >= 0; i--) pts.push([0.45 + Rg() * 0.2, -1.7 + i * 0.34]);
    const sh = new THREE.Shape(); sh.moveTo(...pts[0]); for (const p of pts.slice(1)) sh.lineTo(...p);
    const crack = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: '#020101' })); crack.rotation.x = -Math.PI / 2; crack.position.set(gully.x, topY(gully.x, gully.z) + 0.06, gully.z); g.add(crack); // 道を横切る裂け目
    const lips = []; for (let i = 0; i < 14; i++) { const s = (i % 2 ? 1 : -1), zz = gully.z - 1.6 + (i >> 1) * 0.5, xx = gully.x + s * (0.6 + Rg() * 0.2), r = lumpyRock(0.12 + Rg() * 0.12, 300 + i, vnoise); r.translate(xx, topY(xx, zz) + 0.04, zz); lips.push(r); }
    const lm = new THREE.Mesh(mergeGeometries(lips), M.rock); lm.castShadow = lm.receiveShadow = true; g.add(lm); }
  // 残した家の数だけ、岸の空き地に新しい家（結末の分かれ。はじめは隠しておく）
  const homes = [];
  for (const [x, z, ry] of [[-2.4, -5.6, 0.4], [0.4, -6.8, -0.2], [-4.8, -6.4, 0.1]]) {
    const h = new THREE.Group(), y = topY(x, z); h.position.set(x, y - 0.05, z); h.rotation.y = ry; h.visible = false; g.add(h); homes.push(h);
    h.add(mesh(B(1.2, 0.16, 1.0), M.stone, 0, 0.02, 0)); h.add(mesh(B(1.1, 0.8, 0.9), M.plaster, 0, 0.48, 0)); h.add(mesh(prism(1.4, 0.65, 1.2), M.tile, 0, 0.88, 0));
    h.add(mesh(B(0.24, 0.42, 0.03), M.wood, -0.25, 0.29, 0.47)); h.add(mesh(new THREE.PlaneGeometry(0.18, 0.2), glow, 0.25, 0.5, 0.455));
  }
  fadeBottom(M.cliff);
  // 夜のあいだの遠い岸は、大地を出さず、灯台と港の灯の点だけ（大きさは画面で一定の小さな点）
  const dots = [], dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,220,160,1)'); gr.addColorStop(0.4, 'rgba(255,170,80,.5)'); gr.addColorStop(1, 'rgba(255,140,60,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  g.updateMatrixWorld(true); g.traverse(o => { if (o.isMesh && o.material === glow && R() < 0.6) { const p = g.worldToLocal(o.getWorldPosition(new THREE.Vector3())); const d = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); d.scale.setScalar(0.007 + R() * 0.005); d.position.copy(p); d.userData.ph = R() * 6; dots.push(d); } });
  for (const d of dots) g.add(d);
  const land = []; g.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && o.material !== glow && o.material !== glass) land.push(o); });
  g.userData.lamp = lampAt; g.userData.M = M;
  // 灯台へのぼる火（火トカゲが分けた火が、塔をのぼって灯室へ）
  const riser = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: '#ffb060', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); riser.visible = false; g.add(riser);
  const towerFoot = new THREE.Vector3(-11, topY(-11, 1.2) + 0.5, 1.2);
  const shoreGround = (lx, lz) => { if (Math.abs(lx) < 0.75 && lz > coast(0) - 0.9 && lz < z1 + 0.05) return yp; if (lz <= coast(lx) && Math.abs(lx) < 31 && lz > -33) return topY(lx, lz); return null; };
  return { group: g, lamp: lampAt, path, gully, towerFoot, groundAt: shoreGround,
    setLighthouse(k) { lhGlass.color.set('#2a1a12').lerp(new THREE.Color('#ffe2a8'), k); },
    showHomes(n) { homes.forEach((h, i) => { h.visible = i < n; }); },
    rise(k) { riser.visible = k >= 0 && k < 1; if (!riser.visible) return; riser.position.copy(towerFoot).lerp(lampAt, k); riser.scale.setScalar(0.5 + 0.3 * Math.sin(k * 30)); riser.material.opacity = 0.9; },
    dots, fade(v) { FADE.value = v; for (const o of land) o.visible = v > 0.02; for (const d of dots) d.material.opacity = 1 - Math.min(1, v * 3); }, update(t, dt) { for (const s of puffs) { const u = s.userData; u.life = (u.life + dt) % 5; const k = u.life / 5; s.position.set(u.p0.x + k * 0.8 + Math.sin(t * 0.5 + k * 4) * 0.1, u.p0.y + k * 2.4, u.p0.z - k * 0.3); s.scale.setScalar(0.25 + k * 1.2); s.material.opacity = Math.sin(k * Math.PI) * 0.3; } boat.position.y += Math.sin(t * 0.9) * 0.0008; boat.rotation.z = Math.sin(t * 0.6) * 0.02; } };
}
