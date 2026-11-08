// 立つだけの試し（リズムなし）: 横へ足を出す反射（aK・aD）の向きと強さで、傾いた地面に立てるか
import R from '@dimforge/rapier3d-compat';
import { makeField } from '../js/trial.js';
import { buildHare, drive, pose, PARAMS, setHeadFused } from '../js/hare.js';
if (process.env.HEAD === 'fused') setHeadFused(true);
import { height } from '../js/ground.js';
await R.init();
const q0 = Object.fromEntries(PARAMS.map(([k, a, b]) => [k, (a + b) / 2])); for (const k of PARAMS.map(p => p[0])) if (k.endsWith('A')) q0[k] = 0; q0.freq = 3;
for (const aK of [-1.5, -0.7, 0]) for (const aD of [0]) {
  const w = makeField(R), H = buildHare(R, w, [0, 0, 0], height), q = { ...q0, aK, aD };
  let minUp = 1; for (let k = 0; k < 960; k++) { drive(H, q, k / 240, 0, 0); w.step(); minUp = Math.min(minUp, pose(H).up); }
  const P = pose(H); console.log(`aK ${aK} aD ${aD}: 腰 ${((P.y - height(P.x, P.z)) * 100).toFixed(1)}cm 左右 ${P.roll.toFixed(2)} いちばん低い上向き ${minUp.toFixed(2)}`); w.free();
}
