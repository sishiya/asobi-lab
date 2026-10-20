// ルックの実験室: どの案でも同じ景色（昼の野原・歩く人・羊・風車・木・鳥）。動く物が多いのは、ルックのちがいが動きで出るから。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const height = (x, z) => 0.6 * Math.sin(x * 0.13) * Math.cos(z * 0.11) + 0.3 * Math.sin(x * 0.31 + z * 0.23);
const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
// 軽くするため、いくつもの部品を1つの形にまとめる（色は頂点の色で）。part(形, 色, 位置, 回転, 大きさ)
const vcol = new THREE.MeshLambertMaterial({ vertexColors: true });
function part(geo, hex, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  let g = geo.index ? geo.toNonIndexed() : geo; g.deleteAttribute('uv');
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scl)));
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const merged = (parts) => new THREE.Mesh(mergeGeometries(parts), vcol);

export function buildScene() {
  const R = rng(1021);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe3ee);
  scene.fog = new THREE.Fog(0xcfe3ee, 30, 70);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xe8f2ff, 0x5a6a3a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1d8, 2.2);
  sun.position.set(12, 20, 8); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 60 });
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // 地面（草地と、黄土色の小道）
  const gg = new THREE.PlaneGeometry(80, 80, 120, 120); gg.rotateX(-Math.PI / 2);
  const pos = gg.attributes.position, col = [], c = new THREE.Color(), cg = new THREE.Color(0x6fa04a), cp = new THREE.Color(0xc9a66b);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, height(x, z));
    const path = Math.exp(-Math.pow((z - 3 * Math.sin(x * 0.12)) * 0.9, 2));
    c.copy(cg).multiplyScalar(0.85 + 0.3 * R()).lerp(cp, path * 0.9); col.push(c.r, c.g, c.b);
  }
  gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); gg.computeVertexNormals();
  const ground = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ vertexColors: true })); ground.receiveShadow = true; scene.add(ground);

  const shadowAll = (o) => o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

  // 木（丸い葉）。幹はぜんぶで1つ、葉は1本ごとに1つ（ゆれるので）
  const trees = [], trunks = [];
  for (let i = 0; i < 34; i++) {
    const x = (R() - 0.5) * 56, z = (R() - 0.5) * 56;
    if (Math.abs(z - 3 * Math.sin(x * 0.12)) < 2.5 || Math.hypot(x - 6, z + 6) < 5) continue;
    const s = 0.7 + R() * 0.8, y = height(x, z);
    trunks.push(part(new THREE.CylinderGeometry(0.15 * s, 0.22 * s, 1.6 * s, 7), 0x7a5236, [x, y + 0.8 * s, z]));
    const blobs = [];
    for (let k = 0; k < 3; k++) blobs.push(part(new THREE.IcosahedronGeometry(0.9 - k * 0.15, 1), k ? 0x4f8a3a : 0x3f7a32, [(R() - 0.5) * 0.8, 0.5 + k * 0.45, (R() - 0.5) * 0.8]));
    const crown = merged(blobs); crown.position.set(x, y + 1.6 * s, z); crown.scale.setScalar(s);
    crown.castShadow = crown.receiveShadow = true; scene.add(crown); trees.push({ crown, ph: R() * 6 });
  }
  const trunkMesh = merged(trunks); trunkMesh.castShadow = trunkMesh.receiveShadow = true; scene.add(trunkMesh);

  // 小屋と風車
  const hut = merged([part(new THREE.BoxGeometry(2.4, 1.6, 2), 0xf0e6d2, [0, 0.8, 0]), part(new THREE.ConeGeometry(2.0, 1.3, 4), 0xb8453a, [0, 2.25, 0], [0, Math.PI / 4, 0])]);
  hut.position.set(6, height(6, -6), -6); shadowAll(hut); scene.add(hut);
  const mill = new THREE.Group(); mill.position.set(-7, height(-7, -8), -8);
  mill.add(merged([part(new THREE.CylinderGeometry(0.5, 0.9, 4.5, 10), 0xe8dcc4, [0, 2.25, 0]), part(new THREE.ConeGeometry(0.75, 0.9, 10), 0x6b4a3a, [0, 4.9, 0])]));
  const arms = []; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; arms.push(part(new THREE.BoxGeometry(0.35, 2.6, 0.05), 0xf6f0e4, [-Math.sin(a) * 1.4, Math.cos(a) * 1.4, 0], [0, 0, a])); }
  const hub = merged(arms); hub.position.set(0, 4.3, 0.7); mill.add(hub);
  shadowAll(mill); scene.add(mill);

  // 羊
  const sheep = [];
  const sheepG = mergeGeometries([part(new THREE.SphereGeometry(0.45, 12, 8), 0xf4f1ea, [0, 0.55, 0], [0, 0, 0], [1.3, 0.9, 0.9]), part(new THREE.SphereGeometry(0.2, 10, 8), 0x2a2522, [0.6, 0.65, 0]),
    ...[[0.3, 0.2], [0.3, -0.2], [-0.3, 0.2], [-0.3, -0.2]].map(([lx, lz]) => part(new THREE.CylinderGeometry(0.05, 0.05, 0.35), 0x2a2522, [lx, 0.17, lz]))]);
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Mesh(sheepG, vcol); g.castShadow = g.receiveShadow = true; scene.add(g);
    sheep.push({ g, x: (R() - 0.5) * 20 - 4, z: (R() - 0.5) * 14 + 6, dir: R() * 6, t: R() * 5 });
  }

  // 鳥（空を回る）
  const birdG = new THREE.BufferGeometry();
  birdG.setAttribute('position', new THREE.Float32BufferAttribute([-0.35, 0, 0, 0, 0, 0.15, 0, 0, -0.15, 0.35, 0, 0, 0, 0, 0.15, 0, 0, -0.15], 3));
  birdG.computeVertexNormals();
  const birds = [];
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(birdG, new THREE.MeshBasicMaterial({ color: 0x2b2b33, side: THREE.DoubleSide })); b.castShadow = true; scene.add(b); birds.push({ b, ph: i * 0.5, r: 5 + (i % 3) }); }

  // 歩く人
  const walker = new THREE.Group(); scene.add(walker);
  const wbody = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 4, 10), lam(0xa8322a)); wbody.position.y = 0.95; walker.add(wbody);
  const whead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), lam(0xf0c9a0)); whead.position.y = 1.62; walker.add(whead);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.35, 12), lam(0xd8a23a)); hat.position.y = 1.9; walker.add(hat);
  const legs = [-0.12, 0.12].map(x => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55), lam(0x3a2f2a)); l.geometry.translate(0, -0.27, 0); l.position.set(x, 0.55, 0); walker.add(l); return l; });
  shadowAll(walker);

  const W = { x: 0, z: 4, dir: 0, speed: 0, walk: 0, idle: 99, auto: 0 };
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(); let first = true;

  function update(t, dt, input) {
    // 歩く（操作がないと、ひとりでに小道を散歩する）
    let ix = input.x, iz = input.z;
    if (Math.hypot(ix, iz) > 0.05) W.idle = 0; else W.idle += dt;
    if (W.idle > 2.5) { W.auto += dt * 0.25; ix = Math.cos(W.auto); iz = Math.sin(W.auto * 1.3) * 0.8; }
    const m = Math.min(1, Math.hypot(ix, iz)), want = m * 3.2;
    W.speed += (want - W.speed) * Math.min(1, dt * 8);
    if (m > 0.05) {
      let d = Math.atan2(ix, iz) - W.dir; d = Math.atan2(Math.sin(d), Math.cos(d)); W.dir += d * Math.min(1, dt * 10);
      W.x += Math.sin(W.dir) * W.speed * dt; W.z += Math.cos(W.dir) * W.speed * dt;
      const r = Math.hypot(W.x, W.z); if (r > 24) { W.x *= 24 / r; W.z *= 24 / r; }
    }
    W.walk += W.speed * dt * 3.4;
    walker.position.set(W.x, height(W.x, W.z), W.z); walker.rotation.y = W.dir;
    legs[0].rotation.x = Math.sin(W.walk) * 0.6 * Math.min(1, W.speed); legs[1].rotation.x = -legs[0].rotation.x;
    wbody.position.y = 0.95 + Math.abs(Math.sin(W.walk)) * 0.05;

    hub.rotation.z = t * 1.4;
    for (const tr of trees) tr.crown.rotation.z = Math.sin(t * 1.3 + tr.ph) * 0.05;
    for (const s of sheep) {
      s.t -= dt; if (s.t < 0) { s.t = 1 + Math.random() * 3; s.go = Math.random() < 0.6; s.dir += (Math.random() - 0.5) * 2; }
      const flee = Math.hypot(s.x - W.x, s.z - W.z) < 2.5;
      if (flee) { s.dir = Math.atan2(s.z - W.z, s.x - W.x); s.go = true; }
      const sp = s.go ? (flee ? 2.4 : 0.8) : 0;
      s.x += Math.cos(s.dir) * sp * dt; s.z += Math.sin(s.dir) * sp * dt;
      const r = Math.hypot(s.x, s.z); if (r > 22) s.dir = Math.atan2(-s.z, -s.x);
      s.g.position.set(s.x, height(s.x, s.z) + (sp ? Math.abs(Math.sin(t * 9 + s.dir)) * 0.06 : 0), s.z); s.g.rotation.y = -s.dir;
    }
    for (const b of birds) {
      const a = t * 0.5 + b.ph;
      b.b.position.set(W.x + Math.cos(a) * b.r, 5 + Math.sin(a * 2) * 0.5, W.z - 4 + Math.sin(a) * b.r * 0.6);
      b.b.rotation.y = -a; b.b.scale.y = 1; b.b.rotation.z = Math.sin(t * 10 + b.ph) * 0.5;
    }

    sun.position.set(W.x + 12, 20, W.z + 8); sun.target.position.set(W.x, 0, W.z);
    const k = Math.min(1.5, Math.max(1, 1.0 / camera.aspect));
    const want3 = new THREE.Vector3(W.x, 13 * k, W.z + 13 * k), lk = new THREE.Vector3(W.x, 0.5, W.z - 1);
    const a = first ? 1 : Math.min(1, dt * 3); first = false;
    camPos.lerp(want3, a); look.lerp(lk, a); camera.position.copy(camPos); camera.lookAt(look);
  }
  return { scene, camera, update, W, walker, ground, sun };
}
