// 立てない原因さがし: 筋の強さ・ねばりを変えて、3秒後の高さと上向き
import R from '@dimforge/rapier3d-compat';
import { makeField } from '../js/trial.js';
import { height } from '../js/ground.js';
import { pose } from '../js/hare.js';
import { kidGenes, kidBody } from '../js/kid.js';
await R.init();
const id = +(process.argv[2] || 3), g = kidGenes(id * 7919), B = kidBody(g);
for (const [kf, df, which] of [[1, 1, 'all'], [3, 1, 'all'], [1, 3, 'all'], [0.3, 1, 'all'], [1, 1, 'noab'], [1, 0.2, 'all']]) {
  const world = makeField(R), H = B.build(R, world, [0, 0, 0], height);
  for (const j of H.list) { const m = which === 'noab' && j.name.startsWith('ab') ? 20 : 1; j.jt.configureMotorPosition(0, j.k * kf * m, j.d * df * m); }
  let minUp = 1; for (let i = 0; i < 720; i++) { world.step(); if (i % 24 === 0) minUp = Math.min(minUp, pose(H).up); }
  const P = pose(H); console.log(`強さ×${kf} ねばり×${df} ${which}: 腰の高さ ${H.parts.pelvis.body.translation().y.toFixed(3)} 上向き ${P.up.toFixed(2)} いちばん傾いた ${minUp.toFixed(2)}`);
  world.free();
}
