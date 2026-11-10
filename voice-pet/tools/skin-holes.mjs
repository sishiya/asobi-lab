// 皮に穴がないかを全部の型で確かめる: 面のふち（三角形が1つしかない辺）が 0 なら閉じている
import R from '@dimforge/rapier3d-compat';
import { makeField } from '../js/trial.js';
import { height } from '../js/ground.js';
import { KID_TYPES, kidGenes, kidBody, kidShapes, blendBody } from '../js/kid.js';
import { buildSkinData } from '../js/skin.js';
await R.init();
let bad = 0;
for (const type of Object.keys(KID_TYPES)) {
  let worst = 0, ms = 0; const N = +(process.env.N || 12);
  for (let id = 1; id <= N; id++) {
    const g = kidGenes(id * 7919); g.type = type; if (id % 2) blendBody(g);
    const world = makeField(R), H = kidBody(g).build(R, world, [0, 0, 0], height), t0 = performance.now(), S = buildSkinData(kidShapes(H), { cell: 0.0055 }); ms += performance.now() - t0;
    const e = new Map(), I = S.index; for (let i = 0; i < I.length; i += 3) for (const [a, b] of [[I[i], I[i + 1]], [I[i + 1], I[i + 2]], [I[i + 2], I[i]]]) { const k = a < b ? a * 1e7 + b : b * 1e7 + a; e.set(k, (e.get(k) || 0) + 1); }
    let open = 0; for (const n of e.values()) if (n === 1) open++; worst = Math.max(worst, open); world.free();
  }
  console.log(type.padEnd(7), 'ふちの辺（最大）', String(worst).padStart(4), ' 作る時間（平均）', Math.round(ms / N), 'ms'); if (worst) bad++;
}
console.log(bad ? `穴のある型 ${bad}` : '全部閉じている');
