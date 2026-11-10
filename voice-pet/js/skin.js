// 皮（純粋、LOOKDEV.md 1章）: 生まれたときに1回だけ、肉の形（骨にそうカプセルと玉）を距離場でなめらかにつないで網を作り、近い骨に貼る
// 骨の数や長さが変わる声の子にもそのまま使えるように、体の形は「どの骨（剛体）に、どんな太さの肉がつくか」の並びだけで渡す
// 返すもの: 位置・面・骨の番号と重み（4つまで）・いちばん近い部位の名前（泥やぬれを引く）。描くのはページ（Three.js の SkinnedMesh）

// 肉の形: { part: 部位の名前, body: 剛体, a, b: 両はし（世界の位置）, ra, rb: 両はしの太さ, k: なめらかにつなぐ幅 }
// 線分にそって太さが変わるカプセル（ももは根もとが太く、ひざで細い）
function shapeDist(s, x, y, z) {
  const ax = s.a[0], ay = s.a[1], az = s.a[2], dx = s.b[0] - ax, dy = s.b[1] - ay, dz = s.b[2] - az, L2 = dx * dx + dy * dy + dz * dz;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / L2)) : 0;
  return Math.hypot(x - ax - dx * t, y - ay - dy * t, z - az - dz * t) - (s.ra + (s.rb - s.ra) * t);
}
// なめらかな合わせ（多項式の smooth min）
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

export function buildSkinData(shapes, { cell = 0.005, wSharp = 0.012 } = {}) {
  // 1) 距離場を格子でとる
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const s of shapes) for (const p of [s.a, s.b]) for (let i = 0; i < 3; i++) { const r = Math.max(s.ra, s.rb) + 0.02 + s.k * 0.4; lo[i] = Math.min(lo[i], p[i] - r); hi[i] = Math.max(hi[i], p[i] + r); }
  const nx = Math.ceil((hi[0] - lo[0]) / cell) + 1, ny = Math.ceil((hi[1] - lo[1]) / cell) + 1, nz = Math.ceil((hi[2] - lo[2]) / cell) + 1;
  const F = new Float32Array(nx * ny * nz), id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = lo[0] + i * cell, y = lo[1] + j * cell, z = lo[2] + k * cell; let d = 1e9;
    for (const s of shapes) { const e = shapeDist(s, x, y, z); d = d > 1e8 ? e : smin(d, e, s.k); }
    F[id(i, j, k)] = d;
  }
  // 2) 面をとる（surface nets: 符号の変わる小部屋ごとに1つの点、符号の変わる辺ごとに四角）
  const cx = nx - 1, cy = ny - 1, cz = nz - 1, cv = new Int32Array(cx * cy * cz).fill(-1), cid = (i, j, k) => i + cx * (j + cy * k);
  const pos = [], idx = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = []; for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) { const x = a ^ b; if (x === 1 || x === 2 || x === 4) E.push([a, b]); }
  const v = new Float32Array(8);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let neg = 0; for (let c = 0; c < 8; c++) { v[c] = F[id(i + C[c][0], j + C[c][1], k + C[c][2])]; if (v[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) { if ((v[a] < 0) === (v[b] < 0)) continue; const t = v[a] / (v[a] - v[b]); sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++; }
    cv[cid(i, j, k)] = pos.length / 3; pos.push(lo[0] + (i + sx / n) * cell, lo[1] + (j + sy / n) * cell, lo[2] + (k + sz / n) * cell);
  }
  const quad = (a, b, c, d, flip) => { if ([a, b, c, d].some(q => q < 0)) return; if (flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c); }; // 外向きの面
  for (let k = 1; k < cz; k++) for (let j = 1; j < cy; j++) for (let i = 1; i < cx; i++) {
    const f0 = F[id(i, j, k)] < 0;
    if (f0 !== (F[id(i + 1, j, k)] < 0)) quad(cv[cid(i, j - 1, k - 1)], cv[cid(i, j, k - 1)], cv[cid(i, j, k)], cv[cid(i, j - 1, k)], f0);
    if (f0 !== (F[id(i, j + 1, k)] < 0)) quad(cv[cid(i - 1, j, k - 1)], cv[cid(i - 1, j, k)], cv[cid(i, j, k)], cv[cid(i, j, k - 1)], f0);
    if (f0 !== (F[id(i, j, k + 1)] < 0)) quad(cv[cid(i - 1, j - 1, k)], cv[cid(i, j - 1, k)], cv[cid(i, j, k)], cv[cid(i - 1, j, k)], f0);
  }
  // 3) 骨に貼る: 近い肉の形ほど強く（距離の差で指数）。同じ剛体の形はまとめ、上位4つ
  const bodies = [...new Set(shapes.map(s => s.body))], nv = pos.length / 3;
  const skinIndex = new Uint16Array(nv * 4), skinWeight = new Float32Array(nv * 4), part = new Array(nv);
  for (let q = 0; q < nv; q++) {
    const x = pos[q * 3], y = pos[q * 3 + 1], z = pos[q * 3 + 2], ds = shapes.map(s => shapeDist(s, x, y, z)), dmin = Math.min(...ds), w = new Map();
    shapes.forEach((s, i) => { const e = Math.exp(-(ds[i] - dmin) / wSharp); w.set(s.body, (w.get(s.body) || 0) + e); if (ds[i] === dmin) part[q] = s.part; });
    const top = [...w.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((t, e) => t + e[1], 0);
    top.forEach(([b, e], m) => { skinIndex[q * 4 + m] = bodies.indexOf(b); skinWeight[q * 4 + m] = e / tot; });
  }
  return { position: new Float32Array(pos), index: idx, skinIndex, skinWeight, part, bodies, grid: [nx, ny, nz] };
}
