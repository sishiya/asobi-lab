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
export function topY(x, z) { return (fbm(x * 0.12 + 4, z * 0.12 + 2) - 0.5) * 1.4 + Math.max(0, -z - 6) * 0.12 + 1.6 * Math.exp(-((x + 11) ** 2 + (z - 0.5) ** 2) / 8); }

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
      const out = (vnoise(x * 0.5 + 3, y * 0.25) - 0.5) * 1.6 + strata + t * 6 + (j === 0 ? 0 : 0.2); // 下へ行くほど前へ張り出す（裾が広い）
      pos.push(x, y, coast(x) + out - (j === 0 ? 0 : 0.15));
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1; idx.push(a, b, d, b, e, d); }
    let geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo = geo.toNonIndexed(); geo.computeVertexNormals(); planarUV(geo, 0.5);
    const cl = new THREE.Mesh(geo, M.cliff); cl.receiveShadow = true; g.add(cl);
    // 横とうしろの崖も閉じる（大地の厚み。どの向きから見ても、薄い板に見えないように）
    const wall = pts => { const n = pts.length - 1, ny2 = 24, P = [], I = [];
      for (let j = 0; j <= ny2; j++) for (let i = 0; i <= n; i++) { const [x, z] = pts[i], [ax, az] = pts[Math.max(0, i - 1)], [bx, bz] = pts[Math.min(n, i + 1)], tx = bx - ax, tz = bz - az, L = Math.hypot(tx, tz) || 1, nx = tz / L, nz = -tx / L, t = j / ny2, y = topY(x, z) - 0.1 - t * 46, o = (vnoise(x * 0.5 + z * 0.3, y * 0.25) - 0.5) * 1.4 + t * 5; P.push(x + nx * o, y, z + nz * o); }
      for (let j = 0; j < ny2; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, d = a + n + 1, e = d + 1; I.push(a, b, d, b, e, d); }
      let w = new THREE.BufferGeometry(); w.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); w.setIndex(I); w = w.toNonIndexed(); w.computeVertexNormals(); planarUV(w, 0.5); const m = new THREE.Mesh(w, M.cliff); m.receiveShadow = true; g.add(m); };
    const side = x => Array.from({ length: 25 }, (_, i) => [x, -34 + (coast(x) + 34) * i / 24]);
    // 中身: 崖の壁のすき間から空がのぞかないよう、奥に暗い岩のかたまり
    { const core = new THREE.Mesh(new THREE.BoxGeometry(62, 46, 30), new THREE.MeshStandardMaterial({ color: '#1e1814', roughness: 1 })); core.position.set(0, -23.5, -18); g.add(core); }
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
    t.add(mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.75, 12), glass, 0, 7.2, 0)); // 灯室
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
    // 桟橋の先の灯（島を迎える）
    const lp = new THREE.Group(); lp.position.set(0.6, y, z1 - 0.5); g.add(lp); lp.add(mesh(B(0.06, 1.0, 0.06), M.timber, 0, 0.5, 0)); lp.add(mesh(B(0.3, 0.04, 0.04), M.timber, -0.12, 0.98, 0)); lp.add(mesh(B(0.11, 0.14, 0.11), glass, -0.25, 0.86, 0)); }

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

  g.userData.lamp = lampAt; g.userData.M = M;
  return { group: g, lamp: lampAt, update(t, dt) { for (const s of puffs) { const u = s.userData; u.life = (u.life + dt) % 5; const k = u.life / 5; s.position.set(u.p0.x + k * 0.8 + Math.sin(t * 0.5 + k * 4) * 0.1, u.p0.y + k * 2.4, u.p0.z - k * 0.3); s.scale.setScalar(0.25 + k * 1.2); s.material.opacity = Math.sin(k * Math.PI) * 0.3; } boat.position.y += Math.sin(t * 0.9) * 0.0008; boat.rotation.z = Math.sin(t * 0.6) * 0.02; } };
}
