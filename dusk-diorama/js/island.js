// 島を崩れる塊に分ける。上の面は細かい極座標の格子から、塊ごとに切り出す。横と下は角ばった岩の柱（まとめて見ると逆さの山になる）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vnoise, fbm, hash, smooth, rng, H, rimRadius, pathDist, POND, HILL, FIRE } from './util.js';
import { planarUV } from './tex.js';

const NR = 56, NS = 200;
const EDGES = [0, 0.36, 0.53, 0.67, 0.79, 0.9, 1.01];
const SEC = [1, 9, 13, 17, 21, 25];

// 格子の点 (t, a) がどの塊か。ふちはノイズでゆがめ、ピザの切り分けに見えないように
function bandOf(t, a) {
  const tj = t + (vnoise(Math.cos(a) * 2.2 + 11, Math.sin(a) * 2.2) - 0.5) * 0.07 + (vnoise(Math.cos(a) * 6 + 3, Math.sin(a) * 6 + 5) - 0.5) * 0.03;
  for (let b = EDGES.length - 2; b >= 0; b--) if (tj >= EDGES[b]) return b;
  return 0;
}
const BASE = SEC.map((_, b) => SEC.slice(0, b).reduce((s, v) => s + v, 0));
function idOf(t, a) {
  const b = bandOf(t, a); if (b === 0) return 0;
  const n = SEC[b], aj = a / (Math.PI * 2) + (vnoise(t * 9 + b * 3.1, a * 1.7) - 0.5) * 0.55 / n + b * 0.37 / n;
  return BASE[b] + ((Math.floor(aj * n) % n) + n) % n;
}
export function chunkIdAt(x, z) {
  const a = Math.atan2(z, x), t = Math.hypot(x, z) / rimRadius(a);
  if (t > 1) return -1;
  return idOf(t, (a + Math.PI * 2) % (Math.PI * 2));
}

const col = h => new THREE.Color(h);
const GRASS_A = col('#232c1c'), GRASS_B = col('#3b4426'), DIRT = col('#4d3f2f'), MUD = col('#231d18'), STONE = col('#4f4c45'), SOIL = col('#2b2119');
const STRATA = ['#4a3b2f', '#6e5a46', '#3a332d', '#8a7258', '#4a443d', '#5a4a3e'].map(col);
function groundColor(x, z, t, c) {
  c.copy(GRASS_A).lerp(GRASS_B, smooth(0.25, 0.7, fbm(x * 0.7, z * 0.7)));
  c.lerp(DIRT, 1 - smooth(0.22, 0.5, pathDist(x, z)));
  const dp = Math.hypot(x - POND.x, z - POND.z); c.lerp(MUD, 1 - smooth(POND.r * 0.9, POND.r * 1.6, dp));
  const dh = Math.hypot(x - HILL.x, z - HILL.z); c.lerp(STONE, (1 - smooth(0.5, 3, dh)) * smooth(0.35, 0.7, fbm(x * 1.6 + 9, z * 1.6)) * 0.8);
  c.lerp(DIRT, 1 - smooth(0.4, 0.9, Math.hypot(x - FIRE.x, z - FIRE.z)));
  if (t > 0.92) c.lerp(SOIL, (t - 0.92) / 0.08);
}
function topY(x, z, t) { return H(x, z) - Math.pow(Math.max(0, t - 0.9) / 0.1, 2) * 0.22; }
function normalAt(x, z) { const e = 0.05, dx = (H(x + e, z) - H(x - e, z)) / (2 * e), dz = (H(x, z + e) - H(x, z - e)) / (2 * e); return new THREE.Vector3(-dx, 1, -dz).normalize(); }

export function buildIsland(root, TX) {
  // 格子の点と、四角ごとの塊
  const P = [], T = [];
  for (let i = 0; i <= NR; i++) for (let j = 0; j < NS; j++) {
    const a = j / NS * Math.PI * 2, t = i / NR, r = rimRadius(a) * t, x = Math.cos(a) * r, z = Math.sin(a) * r;
    P.push(new THREE.Vector3(x, topY(x, z, t), z)); T.push(t);
  }
  const vid = (i, j) => i * NS + ((j % NS) + NS) % NS;
  const qid = new Int32Array(NR * NS);
  for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) qid[i * NS + j] = idOf((i + 0.5) / NR, (j + 0.5) / NS * Math.PI * 2);
  const q = (i, j) => (i < 0 || i >= NR) ? -1 : qid[i * NS + ((j % NS) + NS) % NS];
  const N = BASE[BASE.length - 1] + SEC[SEC.length - 1];
  const chunks = [];
  for (let k = 0; k < N; k++) chunks.push({ id: k, band: 0, quads: [], neighbors: new Set(), rim: false, cx: 0, cz: 0, tc: 0, s: 1, fixed: false, fallen: false, exposed: false, root: false, dist: 0, rad: 0.5, fall: null, group: new THREE.Group() });
  for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) {
    const c = chunks[qid[i * NS + j]]; c.quads.push([i, j]);
    for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const o = q(i + di, j + dj); if (o >= 0 && o !== c.id) c.neighbors.add(o); }
    if (i === NR - 1) c.rim = true;
  }
  const topMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: TX.ground, bumpMap: TX.ground, bumpScale: 1.5 });
  const sideMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, map: TX.rock, bumpMap: TX.rock, bumpScale: 2.5 });
  const cc = new THREE.Color();
  for (const c of chunks) {
    if (!c.quads.length) continue;
    // 重心と大きさ
    let sx = 0, sz = 0, st = 0;
    for (const [i, j] of c.quads) { const p = P[vid(i, j)]; sx += p.x; sz += p.z; st += (i + 0.5) / NR; }
    c.cx = sx / c.quads.length; c.cz = sz / c.quads.length; c.tc = st / c.quads.length;
    c.band = bandOf(c.tc, Math.atan2(c.cz, c.cx)); c.fixed = c.id === 0;
    // 面積から大きさ（だいたい）
    let area = 0; for (const [i] of c.quads) { const r = 6 * (i + 0.5) / NR; area += (6 / NR) * (r * Math.PI * 2 / NS); } c.rad = Math.sqrt(area / Math.PI);
    // 上の面
    const map = new Map(), pos = [], nor = [], colr = [], uv = [], idx = [];
    const v = (i, j) => { const key = vid(i, j); if (map.has(key)) return map.get(key); const p = P[key], n = normalAt(p.x, p.z); groundColor(p.x, p.z, T[key], cc); pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); colr.push(cc.r, cc.g, cc.b); uv.push(p.x * 0.4, p.z * 0.4); map.set(key, pos.length / 3 - 1); return pos.length / 3 - 1; };
    for (const [i, j] of c.quads) { const A = v(i, j), B = v(i, j + 1), C = v(i + 1, j + 1), D = v(i + 1, j); idx.push(A, D, B, B, D, C); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    // 三角形の向きが上を向くように（法線は地形から与えているので、面の向きだけ）
    // 全部の三角形で足して決める（まん中の塊は最初の三角形がつぶれていて、1つだけでは向きを読みちがえた）
    { let sy = 0; for (let k = 0; k < idx.length; k += 3) { const A = idx[k] * 3, B2 = idx[k + 1] * 3, C2 = idx[k + 2] * 3, ux = pos[B2] - pos[A], uz = pos[B2 + 2] - pos[A + 2], vx = pos[C2] - pos[A], vz = pos[C2 + 2] - pos[A + 2]; sy += uz * vx - ux * vz; }
      if (sy < 0) { const ar = g.index.array; for (let k = 0; k < ar.length; k += 3) { const t2 = ar[k + 1]; ar[k + 1] = ar[k + 2]; ar[k + 2] = t2; } } }
    const top = new THREE.Mesh(g, topMat); top.receiveShadow = true; c.group.add(top);
    // 横と下: ふちの辺ごとに壁 → 中段 → 下の先へ
    const depth = c.fixed ? 8.6 : 1.3 + 7.4 * Math.pow(1 - c.tc, 1.4), avgY = c.quads.reduce((s, [i, j]) => s + P[vid(i, j)].y, 0) / c.quads.length;
    const apex = new THREE.Vector3(c.cx + (hash(c.id, 1) - .5) * 0.4, avgY - depth, c.cz + (hash(c.id, 2) - .5) * 0.4);
    const bot = new Map(), mid = new Map();
    const lower = (key) => {
      if (bot.has(key)) return [bot.get(key), mid.get(key)];
      const p = P[key], wall = 0.45 + 0.55 * vnoise(p.x * 1.3, p.z * 1.3);
      const b = new THREE.Vector3(p.x + (c.cx - p.x) * 0.1 + (hash(key, 3) - .5) * 0.12, p.y - wall, p.z + (c.cz - p.z) * 0.1 + (hash(key, 4) - .5) * 0.12);
      const m = b.clone().lerp(apex, 0.45); m.x += (hash(key, 5) - .5) * 0.5; m.z += (hash(key, 6) - .5) * 0.5; m.y += (hash(key, 7) - .5) * 0.6;
      bot.set(key, b); mid.set(key, m); return [b, m];
    };
    const sp = [], sc = [];
    const tri = (A, B, C, out) => {
      const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A));
      if (n.dot(out) < 0) { const t = B; B = C; C = t; }
      sp.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z);
      const yy = (A.y + B.y + C.y) / 3, band = Math.floor((0.5 - yy) * 1.7 + vnoise(A.x * 0.8, A.z * 0.8) * 1.2);
      const s = STRATA[((band % 6) + 6) % 6].clone().multiplyScalar(0.8 + 0.3 * hash(A.x * 7, A.z * 3)); if (yy > -0.6) s.lerp(SOIL, 0.6);
      for (let k = 0; k < 3; k++) sc.push(s.r, s.g, s.b);
    };
    for (const [i, j] of c.quads) {
      for (const [di, dj, k1, k2] of [[-1, 0, vid(i, j), vid(i, j + 1)], [1, 0, vid(i + 1, j), vid(i + 1, j + 1)], [0, -1, vid(i, j), vid(i + 1, j)], [0, 1, vid(i, j + 1), vid(i + 1, j + 1)]]) {
        if (q(i + di, j + dj) === c.id) continue;
        const A = P[k1], B = P[k2]; if (A.distanceToSquared(B) < 1e-8) continue;
        const [Ab, Am] = lower(k1), [Bb, Bm] = lower(k2);
        const out = new THREE.Vector3((A.x + B.x) / 2 - c.cx, 0, (A.z + B.z) / 2 - c.cz);
        tri(A, B, Bb, out); tri(A, Bb, Ab, out); tri(Ab, Bb, Bm, out); tri(Ab, Bm, Am, out);
        const outD = out.clone().setY(-1.2); tri(Am, Bm, apex, outD);
      }
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
    sg.computeVertexNormals(); planarUV(sg, 0.45);
    const side = new THREE.Mesh(sg, sideMat); side.castShadow = true; side.receiveShadow = true; c.group.add(side);
    c.topY = avgY;
    root.add(c.group);
  }
  for (const c of chunks) c.exposed = c.rim;
  return { chunks: chunks.filter(c => c.quads.length), all: chunks };
}

// ふちの下に垂れる根（減らして、木のある塊の下にだけ太く）
export function hangRoots(chunk, R, n, thick) {
  if (!chunk.rim) return;
  const a0 = Math.atan2(chunk.cz, chunk.cx), geos = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (R() - .5) * 0.25, rr = rimRadius(a) * 0.985, p = new THREE.Vector3(Math.cos(a) * rr, H(Math.cos(a) * rr, Math.sin(a) * rr) - 0.35, Math.sin(a) * rr);
    const out = new THREE.Vector3(p.x, 0, p.z).normalize(), L = 0.4 + R() * (thick ? 1.6 : 0.8), rad = (thick ? 0.04 : 0.018) + R() * 0.02;
    const pts = [p, p.clone().addScaledVector(out, 0.08).add(new THREE.Vector3(0, -L * 0.4, 0)), p.clone().addScaledVector(out, 0.12).add(new THREE.Vector3((R() - .5) * .3, -L * 0.75, (R() - .5) * .3)), p.clone().add(new THREE.Vector3((R() - .5) * .4, -L, (R() - .5) * .4))];
    const mid = new THREE.CatmullRomCurve3(pts).getPoints(8);
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mid.slice(0, 5)), 6, rad, 4), new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mid.slice(4)), 6, rad * 0.4, 4));
  }
  const m = new THREE.Mesh(mergeGeometries(geos), ROOT_MAT); m.castShadow = true; chunk.group.add(m);
}
const ROOT_MAT = new THREE.MeshStandardMaterial({ color: '#1e1813', roughness: 1 });
export { rng };
