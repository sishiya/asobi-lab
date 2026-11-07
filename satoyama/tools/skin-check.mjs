// 皮の網の確かめ: 作る時間・点と面の数・面の向き（外向きか）・重みの合計
import R from '@dimforge/rapier3d-compat';
import { height } from '../js/ground.js';
import { buildHare } from '../js/hare.js';
import { makeField } from '../js/trial.js';
import { buildSkinData } from '../js/skin.js';
import { hareShapes } from '../js/flesh-hare.js';
await R.init();
const world = makeField(R), H = buildHare(R, world, [0, 0, 0], height);
for (const cell of [0.006, 0.005, 0.004]) {
  const t0 = performance.now(), d = buildSkinData(hareShapes(H), { cell }), ms = performance.now() - t0;
  const P = d.position, I = d.index; let out = 0, tri = I.length / 3, cx = 0, cy = 0, cz = 0, nv = P.length / 3;
  for (let i = 0; i < nv; i++) { cx += P[i * 3]; cy += P[i * 3 + 1]; cz += P[i * 3 + 2]; } cx /= nv; cy /= nv; cz /= nv;
  // 面の法線が、その面をつくる肉の形の軸から外を向いているか（中心からの向きで近似）
  for (let t = 0; t < tri; t++) { const [a, b, c] = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]].map(q => [P[q * 3], P[q * 3 + 1], P[q * 3 + 2]]); const u = b.map((v, i) => v - a[i]), w = c.map((v, i) => v - a[i]); const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const m = a.map((v, i) => (v + b[i] + c[i]) / 3 - [cx, cy, cz][i]); if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] > 0) out++; }
  let wbad = 0; for (let q = 0; q < nv; q++) { const s = d.skinWeight[q * 4] + d.skinWeight[q * 4 + 1] + d.skinWeight[q * 4 + 2] + d.skinWeight[q * 4 + 3]; if (Math.abs(s - 1) > 1e-3) wbad++; }
  console.log(`格子 ${cell * 1000}mm: ${ms.toFixed(0)}ms  点 ${nv}  三角 ${tri}  外向き ${(out / tri * 100).toFixed(0)}%  重みずれ ${wbad}  骨 ${d.bodies.length}  格子 ${d.grid}`);
}
