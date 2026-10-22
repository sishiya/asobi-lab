// ノイズと島の配置（上から見て。+z が手前）。見くらべのページ look/scene.js から移した
export function rng(seed) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= 0.5; } return s; }
export const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const PATH = [[0.4, 6.0], [0.7, 4.0], [-0.1, 2.1], [0.2, 0.3], [-0.6, -1.4], [-1.0, -2.3]];
export const POND = { x: 3.4, z: 2.4, r: 1.2 };
export const FIRE = { x: 1.75, z: 0.75 };
export const HILL = { x: -0.9, z: -3.3 };

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
export function pathDist(x, z) { let d = 1e9; for (let i = 0; i < PATH.length - 1; i++) d = Math.min(d, segDist(x, z, ...PATH[i], ...PATH[i + 1])); return d; }
export function rimRadius(a) { return 6.0 + (vnoise(Math.cos(a) * 1.4 + 5, Math.sin(a) * 1.4 + 5) - 0.5) * 1.3; }
export function H(x, z) {
  let h = (fbm(x * 0.22 + 3, z * 0.22 + 7) - 0.45) * 1.0;
  h += 1.45 * Math.exp(-((x - HILL.x) ** 2 + (z - HILL.z) ** 2) / 7);
  const dp = Math.hypot(x - POND.x, z - POND.z); h -= 0.6 * Math.exp(-dp * dp / 1.3);
  const pd = pathDist(x, z); h -= 0.06 * (1 - smooth(0, 0.5, pd));
  return h;
}
export function pathPoint(u) {
  const segs = []; let L = 0;
  for (let i = 0; i < PATH.length - 1; i++) { const l = Math.hypot(PATH[i + 1][0] - PATH[i][0], PATH[i + 1][1] - PATH[i][1]); segs.push(l); L += l; }
  let d = u * L;
  for (let i = 0; i < segs.length; i++) { if (d <= segs[i] || i === segs.length - 1) { const t = Math.min(1, d / segs[i]); return { x: PATH[i][0] + (PATH[i + 1][0] - PATH[i][0]) * t, z: PATH[i][1] + (PATH[i + 1][1] - PATH[i][1]) * t }; } d -= segs[i]; }
}
// 島のふちの内側か（rimRadius の t = 半径の割合）
export function polarT(x, z) { const a = Math.atan2(z, x); return Math.hypot(x, z) / rimRadius(a); }
