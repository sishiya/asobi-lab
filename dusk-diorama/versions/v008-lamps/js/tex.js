// 細部を上げた形（?detail=1）: なめらかにするのではなく、汚し・崩れ・ほつれで細かさを出す
// 質感はキャンバスで描いた白黒の絵を、色の掛け算（map）と凹凸（bumpMap）の両方に使う
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// くり返してもつなぎ目の出ない値ノイズ（周期 Px, Py）
// 整数の格子の hash（sin より速い。読み込みを短く）
function ph(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function pn(x, y, Px, Py = Px) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  Px = Math.round(Px) || 1; Py = Math.round(Py) || 1;
  const mx = a => ((a % Px) + Px) % Px, my = a => ((a % Py) + Py) % Py;
  const a = ph(mx(xi), my(yi)), b = ph(mx(xi + 1), my(yi)), c = ph(mx(xi), my(yi + 1)), d = ph(mx(xi + 1), my(yi + 1));
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function pf(u, v, Px, Py = Px, o = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * pn(u * Px * f, v * Py * f, Px * f, Py * f); n += a; f *= 2; a *= 0.5; } return s / n; }
const clamp01 = x => Math.max(0, Math.min(1, x));

function makeTex(draw, pix, N = 512) { // 小さく見える質感は 256（読み込みを短く）
  const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, N, N);
  if (draw) draw(g, N);
  if (pix) {
    const im = g.getImageData(0, 0, N, N), d = im.data;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4, v = clamp01(pix(d[i] / 255, x / N, y / N)) * 255; d[i] = d[i + 1] = d[i + 2] = v; }
    g.putImageData(im, 0, 0);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; return t;
}
// 雨だれ: 上から下へ流れた汚れのすじ（周期 1 で縦につながる）
const streak = (u, v) => 1 - 0.28 * Math.pow(pn(u * 48, v * 1.5, 48, 1.5), 3) * (0.6 + 0.4 * pn(u * 6, v * 3, 6, 3));
function cracks(g, N, R, n, col, wdt) {
  g.strokeStyle = col; g.lineWidth = wdt;
  for (let k = 0; k < n; k++) {
    let x = R() * N, y = R() * N, a = R() * 6.28; g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 18; s++) { a += (R() - .5) * 1.2; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); }
    g.stroke();
  }
}

export function textures(rng) {
  const R = rng(3);
  const block = (rows, wMin, wMax, mortar, lo, hi, rad) => (g, N) => {
    g.fillStyle = mortar; g.fillRect(0, 0, N, N); const rh = N / rows;
    for (let r = 0; r < rows; r++) { let x = -R() * wMax; while (x < N) { const bw = wMin + R() * (wMax - wMin), s = lo + R() * (hi - lo) | 0; g.fillStyle = `rgb(${s},${s},${s})`; for (const ox of [0, N]) { g.beginPath(); g.roundRect(x + 3 - ox, r * rh + 3, bw - 6, rh - 6, rad); g.fill(); } x += bw; } }
    cracks(g, N, R, 10, 'rgba(40,40,40,.6)', 1.4);
  };
  return {
    stone: makeTex(block(6, 60, 150, '#3c3c3c', 150, 235, 7), (v, u, w) => v * (0.68 + 0.42 * pf(u, w, 12)) * streak(u, w) * (ph(u * 512, w * 512) < 0.04 ? 0.8 : 1)),
    plaster: makeTex((g, N) => { cracks(g, N, R, 14, 'rgba(60,60,60,.7)', 1.6); for (let i = 0; i < 9; i++) { const x = R() * N, y = R() * N, s = 30 + R() * 50; g.fillStyle = 'rgba(70,70,70,.85)'; g.beginPath(); for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28, r = s * (0.6 + R() * 0.5); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7); } g.fill(); } }, // はがれて下の石が見える
      (v, u, w) => v * (0.72 + 0.3 * pf(u, w, 5)) * (0.9 + 0.1 * pn(u * 64, w * 64, 64)) * streak(u, w)),
    wood: makeTex((g, N) => { for (let i = 0; i < 8; i++) { const s = 150 + R() * 80 | 0; g.fillStyle = `rgb(${s},${s},${s})`; g.fillRect(i * 64, 0, 64, N); g.fillStyle = '#2a2a2a'; g.fillRect(i * 64, 0, 4, N); } },
      (v, u, w) => v * (0.62 + 0.38 * pf(u, w, 64, 3, 3)) * (0.85 + 0.15 * pn(u * 128, w * 8, 128, 8))),
    bark: makeTex(null, (v, u, w) => { const n = pf(u, w, 20, 2, 3); return 0.45 + 0.55 * (1 - Math.abs(2 * n - 1)); }, 256),
    rock: makeTex((g, N) => { for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + R() * 0.12})`; g.fillRect(0, R() * N, N, 6 + R() * 26); } cracks(g, N, R, 22, 'rgba(20,20,20,.7)', 2); },
      (v, u, w) => v * (0.55 + 0.5 * pf(u, w, 8)) * (0.85 + 0.15 * pn(u * 96, w * 96, 96))),
    ground: makeTex(null, (v, u, w) => (0.72 + 0.3 * pf(u, w, 16)) * (ph(u * 512, w * 512) < 0.06 ? 0.7 : 1), 256),
    tile: makeTex(null, (v, u, w) => (0.7 + 0.3 * pf(u, w, 24)) * (ph(u * 256, w * 256) < 0.05 ? 0.75 : 1), 256),
  };
}

// 面の向きから、世界の大きさに合わせて UV を張りなおす（箱の大きさで模様がのびない）
export function planarUV(geo, s) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [a, b] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = a * s; uv[i * 2 + 1] = b * s;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo;
}
export function texMat(color, t, bump, extra = {}) { return new THREE.MeshStandardMaterial({ color, map: t, bumpMap: t, bumpScale: bump, roughness: 0.95, ...extra }); }

// ゆがんだ岩（なめらかにしすぎず、面は少し残す）
export function lumpyRock(s, seed, vnoise) {
  let g = new THREE.IcosahedronGeometry(s, 1); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (vnoise(x * 6 + seed, z * 6 + y * 3) - 0.5) * 0.55; p.setXYZ(i, x * k, y * k * 0.75, z * k); }
  g = g.toNonIndexed(); g.computeVertexNormals(); return g;
}

// 草の葉: 先が細く、すこし曲がる（3節）
export function bladeGeo() {
  const pos = [], idx = [], W = 0.02;
  for (let i = 0; i <= 3; i++) { const t = i / 3, w = W * (1 - t * 0.9); pos.push(-w, t, t * t * 0.25, w, t, t * t * 0.25); }
  for (let i = 0; i < 3; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// 屋根の板石: 屋根（三角柱 hw×ph×dd）の上にならべる。hole は欠けの割合、gap(z, s, t) が true の所は大きく崩れた穴
export function roofTiles(list, obj, hw, ph_, dd, R, hole, gap) {
  const th = Math.atan2(ph_, hw), L = Math.hypot(hw, ph_), nr = Math.ceil(L / 0.085), nc = Math.ceil(dd / 0.11);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const s of [-1, 1]) for (let r = 0; r < nr; r++) for (let c = 0; c < nc + 1; c++) {
    const t = (r + 0.5) / nr, z = -dd / 2 + (c + (r % 2) * 0.5) * dd / nc;
    if (z > dd / 2 + 0.02 || R() < hole || (gap && gap(z, s, t))) continue;
    const nx = s * ph_ / L, ny = hw / L, off = 0.012 + (r % 2) * 0.004;
    e.set((R() - .5) * 0.06, (R() - .5) * 0.12, -s * th + s * 0.06 + (R() - .5) * 0.05);
    m.compose(new THREE.Vector3(s * hw * (1 - t) + nx * off, ph_ * t + ny * off, z), q.setFromEuler(e), new THREE.Vector3(1, 1, 0.85 + R() * 0.3));
    list.push({ obj, m: m.clone(), c: R() });
  }
}

// 小屋の木組み・窓わく・よろい戸・板戸
export function cottageDetail(g, w, h, d, M, R, y0 = 0.08) {
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(planarUV(geo, 2.2), mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const B = (a, b, c) => new THREE.BoxGeometry(a, b, c), T = M.timber, f = d / 2 + 0.014, sd = w / 2 + 0.014;
  for (const zz of [f, -f]) {
    add(B(w + 0.04, 0.05, 0.035), T, 0, y0 + h - 0.02, zz); add(B(w + 0.02, 0.045, 0.035), T, 0, y0 + 0.04, zz);
    for (const xx of [-w / 4, w / 4]) add(B(0.045, h, 0.035), T, xx, y0 + h / 2, zz);
    for (const s of [-1, 1]) { const dx = w / 4, dy = h * 0.5, L = Math.hypot(dx, dy); add(B(0.04, L, 0.03), T, s * (w / 2 - dx / 2), y0 + dy / 2, zz, 0, 0, Math.atan2(s * dx, dy)); }
  }
  for (const xx of [sd, -sd]) { add(B(0.035, 0.05, d + 0.04), T, xx, y0 + h - 0.02, 0); add(B(0.035, h, 0.045), T, xx, y0 + h / 2, 0); }
  // 窓（前と横）
  const win = (px, py, pz, ry) => {
    const wg = new THREE.Group(); wg.position.set(px, py, pz); wg.rotation.y = ry; g.add(wg);
    const a = (geo, mat, x, y, z, rz = 0) => { const o = new THREE.Mesh(planarUV(geo, 2.2), mat); o.position.set(x, y, z); o.rotation.z = rz; o.castShadow = true; wg.add(o); };
    a(B(0.27, 0.035, 0.04), T, 0, 0.13, 0.01); a(B(0.3, 0.04, 0.06), T, 0, -0.13, 0.02);
    a(B(0.035, 0.26, 0.04), T, -0.12, 0, 0.01); a(B(0.035, 0.26, 0.04), T, 0.12, 0, 0.01);
    a(B(0.016, 0.22, 0.02), T, 0, 0, 0.01); a(B(0.2, 0.016, 0.02), T, 0, 0.01, 0.01);
    a(B(0.1, 0.25, 0.018), T, -0.2, 0, 0.02); // よろい戸（片方は外れかけて傾く）
    if (R() < 0.6) a(B(0.1, 0.25, 0.018), T, 0.205, -0.04, 0.035, -0.35); else a(B(0.1, 0.25, 0.018), T, 0.2, 0, 0.02);
  };
  win(w * 0.22, h * 0.6, d / 2 + 0.01, 0); win(w / 2 + 0.01, h * 0.6, 0.05, Math.PI / 2);
  // 板戸
  for (let i = 0; i < 3; i++) add(B(0.072, 0.42 - (i === 2 ? 0.03 : 0), 0.022), M.wood, -w * 0.22 - 0.075 + i * 0.075, 0.29 - (i === 2 ? 0.015 : 0), d / 2 + 0.018);
  add(B(0.3, 0.045, 0.04), T, -w * 0.22, 0.52, d / 2 + 0.02);
}

// 礼拝堂: 控え壁・鐘の窓・軒の帯・十字・石段・アーチ
export function chapelDetail(g, W, Hh, D, M) {
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(planarUV(geo, 1.6), mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const B = (a, b, c) => new THREE.BoxGeometry(a, b, c), S = M.stone, tz = D / 2 + 0.2;
  for (const sx of [-1, 1]) for (const z of [-0.75, 0.0, 0.7]) { add(B(0.15, 0.9, 0.22), S, sx * (W / 2 + 0.07), 0.55, z); add(B(0.12, 0.25, 0.2), S, sx * (W / 2 + 0.05), 1.05, z, 0, 0, sx * 0.5); }
  add(B(0.86, 0.07, 0.81), S, 0, 2.3, tz); add(B(0.8, 0.05, 0.75), S, 0, 1.45, tz);
  const dark = new THREE.MeshStandardMaterial({ color: '#050404', roughness: 1 });
  for (const [x, z, ry] of [[0, tz + 0.351, 0], [0.376, tz, Math.PI / 2], [-0.376, tz, Math.PI / 2]]) { add(B(0.2, 0.34, 0.02), dark, x, 2.03, z, 0, ry); add(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12, 1, false, 0, Math.PI), dark, x, 2.2, z, Math.PI / 2, ry, Math.PI / 2); }
  const bell = add(new THREE.CylinderGeometry(0.05, 0.1, 0.16, 12, 1, true), M.iron, 0, 2.02, tz); bell.material = M.iron;
  const top = 2.3 + 1.5 + 0.02;
  add(B(0.035, 0.34, 0.035), M.iron, 0, top + 0.15, tz); add(B(0.18, 0.035, 0.035), M.iron, 0, top + 0.21, tz, 0, 0, 0.12); // 傾いた十字
  add(B(0.66, 0.06, 0.28), S, 0, 0.03, tz + 0.48); add(B(0.5, 0.06, 0.18), S, 0, 0.09, tz + 0.42);
  for (const sx of [-1, 1]) for (const z of [-0.5, 0.1]) add(new THREE.CircleGeometry(0.07, 12, 0, Math.PI), M.win, sx * (W / 2 + 0.012), 0.975, z, 0, sx * Math.PI / 2);
  add(new THREE.CircleGeometry(0.15, 14, 0, Math.PI), M.wood, 0, 0.655, tz + 0.357);
  for (const sx of [-1, 1]) for (const z of [-0.5, 0.1]) add(B(0.05, 0.03, 0.2), S, sx * (W / 2 + 0.03), 0.52, z);
}

// 墓地: 形のちがう墓石と、ゆがんだ鉄柵
export function graveyard(group, M, R, groundY, KEEP) {
  const stones = [], iron = [], x0 = -3.55, x1 = -1.9, z0 = -2.85, z1 = -1.05;
  for (let i = 0; i < 14; i++) {
    const x = x0 + 0.2 + R() * (x1 - x0 - 0.4), z = z0 + 0.2 + R() * (z1 - z0 - 0.4), kind = R(), parts = [];
    if (kind < 0.45) { const b = new THREE.BoxGeometry(0.17, 0.24, 0.06); b.translate(0, 0.1, 0); const t = new THREE.CylinderGeometry(0.085, 0.085, 0.06, 12, 1, false, 0, Math.PI); t.rotateX(Math.PI / 2); t.rotateZ(Math.PI / 2); t.translate(0, 0.22, 0); parts.push(b, t); }
    else if (kind < 0.75) { const a = new THREE.BoxGeometry(0.05, 0.36, 0.05); a.translate(0, 0.16, 0); const c = new THREE.BoxGeometry(0.2, 0.05, 0.05); c.translate(0, 0.25, 0); parts.push(a, c); }
    else { const a = new THREE.BoxGeometry(0.1, 0.34, 0.1); a.translate(0, 0.15, 0); const c = new THREE.ConeGeometry(0.075, 0.12, 4); c.rotateY(Math.PI / 4); c.translate(0, 0.38, 0); parts.push(a, c); }
    const broken = R() < 0.2; // 折れて倒れた墓石
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, groundY(x, z) - 0.03, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(broken ? 1.3 : (R() - .5) * 0.4, 0.3 + (R() - .5) * 0.6, (R() - .5) * 0.35)), new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 + R() * 0.5));
    for (const p of parts) { p.deleteAttribute('uv'); p.applyMatrix4(m); stones.push(planarUV(p.index ? p.toNonIndexed() : p, 3)); }
    KEEP.push({ x, z, r: 0.18 });
  }
  const per = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 0.13);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (R() < 0.14) continue;
      const lean = R() < 0.2 ? (R() - .5) * 0.7 : (R() - .5) * 0.1, y = groundY(x, z);
      const p = new THREE.CylinderGeometry(0.008, 0.008, 0.34, 4); p.translate(0, 0.17, 0);
      const s = new THREE.ConeGeometry(0.016, 0.05, 4); s.translate(0, 0.36, 0);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, 0, lean * 0.5)), new THREE.Vector3(1, 1, 1));
      for (const q of [p, s]) { q.applyMatrix4(m); iron.push(q.toNonIndexed()); }
    }
    for (const hy of [0.1, 0.28]) { const r = new THREE.BoxGeometry(L * (R() < 0.3 ? 0.55 : 1), 0.012, 0.012); r.translate(L * 0.0, 0, 0); r.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3((ax + bx) / 2, groundY((ax + bx) / 2, (az + bz) / 2) + hy, (az + bz) / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.atan2(bz - az, bx - ax), (R() - .5) * 0.08)), new THREE.Vector3(1, 1, 1))); iron.push(r.toNonIndexed()); }
  };
  per(x0, z0, x1, z0); per(x1, z0, x1, z1); per(x0, z1, x0 + 0.6, z1); per(x0 + 1.0, z1, x1, z1); per(x0, z0, x0, z1);
  for (const n of iron) { n.deleteAttribute('uv'); }
  const ms = new THREE.Mesh(mergeGeometries(stones), M.stone); ms.castShadow = ms.receiveShadow = true; group.add(ms);
  const mi = new THREE.Mesh(mergeGeometries(iron), M.iron); mi.castShadow = true; group.add(mi);
}

// 折れた柵・踏み石・たる・木箱・薪・こわれた荷車・塔の梁とつた
export function props(group, M, R, groundY, PATH, vnoise) {
  const geoBy = new Map(), put = (mat, geo, m) => { geo.applyMatrix4(m); const k = mat.uuid; if (!geoBy.has(k)) geoBy.set(k, { mat, list: [] }); geoBy.get(k).list.push(geo.index ? geo.toNonIndexed() : geo); };
  const M4 = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
  const box = (a, b, c) => planarUV(new THREE.BoxGeometry(a, b, c), 2.5);
  // 道ぞいの柵（ところどころ倒れている）
  for (let i = 0; i < 3; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 0.42), nx = -(bz - az) / L, nz = (bx - ax) / L, side = i % 2 ? -0.55 : 0.55;
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t + nx * side, z = az + (bz - az) * t + nz * side, y = groundY(x, z);
      if (R() < 0.18) { prev = null; continue; }
      const lean = R() < 0.25 ? (R() - .5) * 0.9 : (R() - .5) * 0.15;
      put(M.wood, box(0.05, 0.42 + R() * 0.1, 0.05), M4(x, y + 0.18, z, lean, R(), lean * 0.4));
      if (prev && R() < 0.75) { const mx = (x + prev[0]) / 2, mz = (z + prev[1]) / 2, l = Math.hypot(x - prev[0], z - prev[1]), ry = -Math.atan2(z - prev[1], x - prev[0]); put(M.wood, box(l * (R() < 0.25 ? 0.6 : 1.02), 0.035, 0.025), M4(mx, groundY(mx, mz) + 0.28 + (R() - .5) * 0.06, mz, 0, ry, (R() - .5) * (R() < 0.3 ? 0.5 : 0.06))); }
      prev = [x, z];
    }
  }
  // 踏み石
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1], n = Math.floor(Math.hypot(bx - ax, bz - az) / 0.3);
    for (let k = 0; k < n; k++) {
      if (R() < 0.45) continue;
      const t = (k + R() * 0.5) / n, x = ax + (bx - ax) * t + (R() - .5) * 0.25, z = az + (bz - az) * t + (R() - .5) * 0.25, s = 0.09 + R() * 0.06;
      const g = new THREE.CylinderGeometry(s, s * 1.1, 0.04, 7); const p = g.attributes.position; for (let j = 0; j < p.count; j++) p.setX(j, p.getX(j) * (0.8 + 0.4 * vnoise(j, i + k)));
      put(M.path, planarUV(g, 3), M4(x, groundY(x, z) - 0.012, z, (R() - .5) * 0.15, R() * 3, (R() - .5) * 0.15));
    }
  }
  // たる・木箱
  const barrel = (x, z, tip) => {
    const g = new THREE.CylinderGeometry(0.1, 0.1, 0.27, 14, 4); const p = g.attributes.position; for (let j = 0; j < p.count; j++) { const k = 1 + 0.13 * Math.cos(p.getY(j) / 0.135 * Math.PI / 2); p.setX(j, p.getX(j) * k); p.setZ(j, p.getZ(j) * k); }
    g.computeVertexNormals(); const y = groundY(x, z), m = tip ? M4(x, y + 0.1, z, Math.PI / 2, R(), 0) : M4(x, y + 0.13, z, 0, R(), 0);
    put(M.wood, planarUV(g, 3), m.clone());
    for (const hy of [-0.08, 0.08]) put(M.iron, new THREE.TorusGeometry(0.108, 0.007, 4, 18).rotateX(Math.PI / 2).translate(0, hy, 0), m.clone());
  };
  barrel(-2.75, 1.55, false); barrel(-2.55, 1.7, true); barrel(3.35, -0.55, false);
  for (const [x, z, s] of [[-2.85, 1.25, 0.2], [3.55, -0.4, 0.18], [3.45, -0.25, 0.14]]) put(M.wood, box(s, s, s), M4(x, groundY(x, z) + s / 2, z, 0, R(), (R() - .5) * 0.1));
  // 薪の山（たき火のそば）
  for (let i = 0; i < 7; i++) { const r = i < 4 ? 0 : 1, x = 2.35 + (i % 4 - 1.5) * 0.09 + r * 0.045, z = 1.25; put(M.bark, new THREE.CylinderGeometry(0.04, 0.04, 0.4, 7).rotateX(Math.PI / 2), M4(x, groundY(x, z) + 0.04 + r * 0.075, z, 0, 0.6, 0)); }
  // こわれた荷車（片方の車輪が外れている）
  { const x = -1.9, z = 2.6, y = groundY(x, z), ry = 0.9, base = M4(x, y, z, 0, ry, 0);
    const local = (geo, mat, lx, ly, lz, rx = 0, ryy = 0, rz = 0) => { geo.applyMatrix4(M4(lx, ly, lz, rx, ryy, rz)); put(mat, geo, base.clone()); };
    local(box(0.7, 0.04, 0.4), M.wood, 0, 0.2, 0, 0, 0, -0.22); local(box(0.7, 0.12, 0.03), M.wood, 0, 0.27, 0.19, 0, 0, -0.22); local(box(0.7, 0.12, 0.03), M.wood, 0, 0.27, -0.19, 0, 0, -0.22);
    local(box(0.6, 0.03, 0.03), M.wood, 0.55, 0.14, 0.12, 0, 0, -0.3); local(box(0.6, 0.03, 0.03), M.wood, 0.55, 0.14, -0.12, 0, 0, -0.3);
    const wheel = () => { const parts = [new THREE.TorusGeometry(0.16, 0.018, 5, 18)]; for (let k = 0; k < 4; k++) parts.push(new THREE.BoxGeometry(0.012, 0.31, 0.012).rotateZ(k * Math.PI / 4)); return mergeGeometries(parts.map(p => { p.deleteAttribute('uv'); return p.index ? p.toNonIndexed() : p; })); };
    local(wheel(), M.wood, -0.08, 0.16, 0.23); local(wheel(), M.wood, 0.3, 0.02, -0.45, Math.PI / 2 - 0.08, 0, 0.3);
  }
  for (const { mat, list } of geoBy.values()) { list.forEach(g => { if (!g.attributes.uv) planarUV(g, 3); }); const o = new THREE.Mesh(mergeGeometries(list), mat); o.castShadow = o.receiveShadow = true; group.add(o); }
}

// 塔のくずれ: まわりのれんがの山、つき出た梁、枯れたつた
export function towerRuin(B, group, M, R, cx, cz, R0, groundY) {
  for (let i = 0; i < 90; i++) {
    const a = R() * Math.PI * 2, d = R0 + 0.05 + Math.pow(R(), 1.6) * 1.1, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const pile = Math.max(0, 1 - (d - R0) / 0.9);
    B.add(x, groundY(x, z) + 0.04 + R() * 0.2 * pile, z, R() * 6, R() * 3, R() * 3);
  }
  const beams = [];
  for (const [a, y, tilt] of [[0.4, 1.9, 0.5], [2.2, 1.7, -0.4], [4.0, 2.0, 0.8]]) { const g = planarUV(new THREE.BoxGeometry(0.06, 0.07, 1.1), 2.5); g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(cx + Math.cos(a) * 0.4, groundY(cx, cz) + y, cz + Math.sin(a) * 0.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, -a, 0.2)), new THREE.Vector3(1, 1, 1))); beams.push(g.toNonIndexed()); }
  { const g = planarUV(new THREE.BoxGeometry(0.07, 0.07, 1.6), 2.5); g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(cx - 0.9, groundY(cx - 0.9, cz + 0.4) + 0.55, cz + 0.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.75, 1.2, 0)), new THREE.Vector3(1, 1, 1))); beams.push(g.toNonIndexed()); }
  const bm = new THREE.Mesh(mergeGeometries(beams), M.wood); bm.castShadow = true; group.add(bm);
  // つた（枯れて黒ずんだ葉）
  const N = 900, im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.06), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, side: THREE.DoubleSide }), N), m = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const a = 3.6 + R() * 2.4 + (R() < 0.3 ? R() * 2 : 0), top = 0.6 + 2.2 * Math.pow(Math.abs(Math.sin(a * 2.3)), 0.7), y = groundY(cx, cz) + R() * top, r = R0 + 0.1;
    m.compose(new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - .5) * 1.2, -a + Math.PI / 2 + (R() - .5), (R() - .5) * 1.2)), new THREE.Vector3(1, 1, 1).multiplyScalar(0.6 + R() * 0.8));
    im.setMatrixAt(i, m); c.set('#2a2c18').lerp(new THREE.Color('#4a3020'), R()); im.setColorAt(i, c);
  }
  im.castShadow = true; group.add(im);
}

// けむり（たき火から）
export function smoke(group, x, y, z) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv), puffs = [];
  for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#6b5d55', transparent: true, depthWrite: false })); s.userData.life = i / 26 * 6; group.add(s); puffs.push(s); }
  return (t, dt, on) => { for (const s of puffs) { s.visible = on; s.userData.life = (s.userData.life + dt) % 6; const k = s.userData.life / 6; const j = s.userData.j ??= Math.random() * 6.28; s.position.set(x + Math.sin(t * 0.4 + k * 4 + j) * (0.15 + k * 0.5) + k * 0.9, y + k * 3.2, z - k * 0.5 + Math.cos(j * 3 + t * 0.3) * k * 0.5); s.scale.setScalar(0.3 + k * 2.2); s.material.opacity = Math.sin(k * Math.PI) * 0.22; } };
}
