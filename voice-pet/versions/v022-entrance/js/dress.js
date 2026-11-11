// 世界の端と小物（RELEASE 必須7）: 遠くの丘と雲・足もとの丸い小石と枯れ葉・小屋のわら。どれも見た目だけで、物理の地面は変えない
// 色はフェルトの箱庭に合わせて、遠いほど地の色（0xe9e2d4）に寄せる。fog＝false（霧にまかせると丘も雲も消える）。1つの網にまとめて描く回数をふやさない
import * as THREE from 'three';
import { height } from './ground.js';
import { feltMerged } from './felt.js';

const BG = [0.913, 0.886, 0.831], mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rnd0 = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
function bump(g, seed, amp) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = Math.hypot(x, y, z) || 1, k = 1 + amp * (Math.sin(x / n * 3.1 + seed) * Math.cos(z / n * 2.7 + seed * 1.3) + 0.5 * Math.sin(y / n * 5.3 + x / n * 4.1 + seed * 0.7)); p.setXYZ(i, x * k, y * k, z * k); } g.computeVertexNormals(); return g; }
const noFog = o => { o.traverse(x => { if (x.material) { x.material.fog = false; x.material.needsUpdate = true; } x.castShadow = false; x.receiveShadow = false; }); return o; };

// 遠くの丘（2重の輪）と雲。cx, cz＝箱庭のまんなか、r＝丘の輪の半径
export function makeBackdrop(scene, { cx = 0, cz = 0, r = 12, seed = 11 } = {}) {
  const R = rnd0(seed), hills = [], clouds = [];
  for (const [ring, n, fadeT, col] of [[1.3, 11, 0.8, [0.62, 0.68, 0.56]], [1, 13, 0.62, [0.6, 0.67, 0.45]]]) for (let i = 0; i < n; i++) {
    const a = (i + R() * 0.6) / n * 6.283, d = r * ring * (0.95 + R() * 0.1), w = r * (0.26 + R() * 0.18), h = r * (0.04 + R() * 0.045), g = bump(new THREE.SphereGeometry(1, 28, 16), i * 3.1 + ring, 0.05); g.scale(w, h, w * 0.7); g.rotateY(-a + Math.PI / 2); g.translate(cx + Math.cos(a) * d, -0.15, cz + Math.sin(a) * d);
    const top = h - 0.15, c = mix(col, BG, fadeT); hills.push([g, (x, y) => mix(c, BG, Math.max(0, 0.45 - Math.max(0, y / top) * 0.6))]); } // すそは地の色へとける
  for (let i = 0; i < 9; i++) { const a = R() * 6.283, d = r * (0.85 + R() * 0.75), y = r * (0.32 + R() * 0.2), w = r * (0.1 + R() * 0.06), n = 3 + Math.floor(R() * 3), ux = -Math.sin(a), uz = Math.cos(a);
    for (let k = 0; k < n; k++) { const t = (k / (n - 1) - 0.5) * 2, s = w * (1 - 0.45 * Math.abs(t)) * (0.8 + R() * 0.4), g = bump(new THREE.SphereGeometry(1, 18, 12), i + k * 2.3, 0.08); g.scale(s, s * 0.5, s * 0.8); g.translate(cx + Math.cos(a) * d + ux * t * w * 1.25, y + s * 0.12, cz + Math.sin(a) * d + uz * t * w * 1.25); clouds.push([g, (px, py) => mix([0.985, 0.975, 0.95], [0.86, 0.85, 0.83], Math.max(0, Math.min(1, (y + s * 0.2 - py) / (s * 0.6))))]); } }
  const flat = o => { o.traverse(x => { const n = x.geometry?.attributes.normal; if (n) { for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); n.needsUpdate = true; } }); return o; }; // 法線を上にそろえる＝遠くのものは影のない切り絵に（濃い陰が手前の主役より目立った）
  const H = flat(noFog(feltMerged(hills, { fuzz: 2, len: 0.12, freq: 24 }))), C = flat(noFog(feltMerged(clouds, { fuzz: 2, len: 0.16, freq: 20 }))); scene.add(H, C); return [H, C];
}

// 足もとの丸い小石と枯れ葉（地面の汚し）。avoid＝置かない所 [[x, z, 半径]...]。ふれると、石はころがり、葉はふわっと舞う（見た目だけ。子の体の動きには効かない）
// 1つの網のまま、動いている物の点だけ書きかえる
export function makeLitter(scene, { cx = 0, cz = 0, r = 5, n = 150, seed = 5, avoid = [] } = {}) {
  const R = rnd0(seed), list = [], items = []; let v0 = 0;
  for (let i = 0; i < n; i++) { const a = R() * 6.283, d = r * Math.sqrt(R()), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (i % 3 === 2 || avoid.some(q => Math.hypot(q[0] - x, q[1] - z) < q[2])) continue; const y = height(x, z), c = R(); let g, it;
    if (i % 3) { const s = 0.007 + R() ** 2 * 0.009; g = bump(new THREE.SphereGeometry(1, 14, 10), i, 0.035); g.scale(s * (1.05 + R() * 0.25), s * 0.78, s); g.rotateY(R() * 6.28); g.translate(x, y + s * 0.62, z); list.push([g, [0.62 + 0.14 * c, 0.6 + 0.13 * c, 0.54 + 0.12 * c]]); it = { stone: true, r: s, lift: s * 0.62 }; } // 小石（丸くて角のない川の石）
    else { const L = 0.014 + R() * 0.012, yaw = R() * 6.28; g = new THREE.SphereGeometry(1, 9, 6); g.scale(L, 0.0016, L * 0.5); g.rotateZ((R() - 0.5) * 0.3); g.rotateY(yaw); g.translate(x, y + 0.008, z); list.push([g, [0.56 + 0.16 * c, 0.42 + 0.1 * c, 0.2 + 0.07 * c]]); it = { stone: false, r: L, lift: 0.008 }; } // 枯れ葉
    items.push(Object.assign(it, { x, z, v: v0, n: it.n ?? g.attributes.position.count, cool: 0, h: 0, vx: 0, vy: 0, vz: 0, t: 0, q: new THREE.Quaternion() })); v0 += it.n; }
  const m = feltMerged(list, { fuzz: 1, len: 0.002, freq: 300 }); m.castShadow = false; scene.add(m);
  const P = m.geometry.attributes.position, N = m.geometry.attributes.normal, moving = new Set(), p0 = new THREE.Vector3(), q1 = new THREE.Quaternion(), ax = new THREE.Vector3(), e1 = new THREE.Euler();
  P.setUsage(THREE.DynamicDrawUsage); N.setUsage(THREE.DynamicDrawUsage);
  for (const it of items) { it.y0 = height(it.x, it.z) + it.lift; it.p = new Float32Array(it.n * 3); it.nr = new Float32Array(it.n * 3); for (let j = 0; j < it.n; j++) { const k = it.v + j; it.p.set([P.getX(k) - it.x, P.getY(k) - it.y0, P.getZ(k) - it.z], j * 3); it.nr.set([N.getX(k), N.getY(k), N.getZ(k)], j * 3); } }
  const write = it => { const y = height(it.x, it.z) + it.lift + it.h; for (let j = 0; j < it.n; j++) { const k = it.v + j; p0.set(it.p[j * 3], it.p[j * 3 + 1], it.p[j * 3 + 2]).applyQuaternion(it.q); P.setXYZ(k, it.x + p0.x, y + p0.y, it.z + p0.z); p0.set(it.nr[j * 3], it.nr[j * 3 + 1], it.nr[j * 3 + 2]).applyQuaternion(it.q); N.setXYZ(k, p0.x, p0.y, p0.z); } };
  return { mesh: m, items, step(dt, pts) {
    for (const it of items) { if (it.cool > 0) { it.cool -= dt; continue; } if (moving.has(it) && !it.stone) continue; const touch = (it.stone ? 0.03 : 0.045) + it.r; for (const q of pts) { const dx = it.x - q.x, dz = it.z - q.z, d2 = dx * dx + dz * dz; if (d2 > touch * touch || q.y - height(it.x, it.z) > 0.12) continue; const d = Math.sqrt(d2) || 1e-3; it.cool = 0.5; moving.add(it); if (it.stone) { const sp = 0.16 + Math.random() * 0.14; it.vx = dx / d * sp; it.vz = dz / d * sp; } else { it.vy = 0.42 + Math.random() * 0.26; it.vx = dx / d * 0.12; it.vz = dz / d * 0.12; it.h = Math.max(it.h, 0.002); it.t = 0; it.ph = Math.random() < 0.5 ? 0 : Math.PI; it.yaw = Math.random() * 6.28; } break; } }
    for (const it of moving) { if (it.stone) { const sp = Math.hypot(it.vx, it.vz); if (sp < 0.015) { moving.delete(it); continue; } it.x += it.vx * dt; it.z += it.vz * dt; ax.set(it.vz / sp, 0, -it.vx / sp); it.q.premultiply(q1.setFromAxisAngle(ax, -sp * dt / it.r)); const f = Math.exp(-3.5 * dt); it.vx *= f; it.vz *= f; }
      else { it.t += dt; it.vy = Math.max(-0.14, it.vy - 1.7 * dt); const fall = Math.max(0, Math.min(1, -it.vy / 0.14)), w = it.t * 6.4 + it.ph, c1 = Math.cos(w), lat = 0.3 * c1 * fall; it.h += it.vy * (it.vy < 0 ? 0.55 + 0.45 * Math.abs(c1) : 1) * dt; it.x += (it.vx * (1 - fall * 0.8) + Math.sin(it.yaw) * lat) * dt; it.z += (it.vz * (1 - fall * 0.8) + Math.cos(it.yaw) * lat) * dt; if (it.h <= 0) { it.h = 0; it.q.identity(); moving.delete(it); } else { const flat = Math.min(1, it.h / 0.02), roll = (0.15 + 0.75 * fall) * Math.sin(w) * flat; it.q.setFromEuler(e1.set(roll, it.yaw, 0.18 * Math.sin(it.t * 3.1) * flat)); } } // 舞い上がったあと、左右にゆれて（ゆれの端でゆっくり）おりる
      write(it); }
    if (moving.size || m.userData.was) { P.needsUpdate = true; N.needsUpdate = true; m.userData.was = moving.size > 0; }
  } };
}

// 小屋のわら: 屋根のてっぺんから軒へおりる短いわらの束。c＝屋根のまんなか、rr＝横の半径、ry＝縦の半径
export function thatchRoof(scene, { x, y, z, rr, ry, seed = 31 } = {}) {
  const R = rnd0(seed), list = [];
  for (let i = 0; i < 1000; i++) { const a = R() * 6.283, t0 = 0.05 + R() * 0.95, len = 0.22 + R() * 0.2, wob = 0.012, v = R(), pts = [];
    for (let j = 0; j <= 4; j++) { const t = Math.min(1.12, t0 + len * j / 4), ph = t * Math.PI / 2, rx = rr * 1.02 * Math.sin(ph) + (t > 1 ? (t - 1) * 0.14 : 0), h = ry * 1.02 * Math.cos(Math.min(ph, Math.PI / 2)) - (t > 1 ? (t - 1) * 0.5 : 0), a2 = a + (R() - 0.5) * 0.05; pts.push(new THREE.Vector3(x + Math.cos(a2) * (rx + (R() - 0.5) * wob), y + h + (R() - 0.5) * wob, z + Math.sin(a2) * (rx + (R() - 0.5) * wob))); }
    list.push([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.0065 + R() * 0.005, 5, false), [0.5 + 0.28 * v, 0.38 + 0.22 * v, 0.18 + 0.15 * v]]); }
  const m = feltMerged(list, { fuzz: 2, len: 0.005, freq: 240 }); m.castShadow = true; scene.add(m); return m;
}
