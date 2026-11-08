// 起き上がりの型（js/getup-kid-<tag>.json）で起きたあと、体がどうなるかを 0.25 秒ごとに: 腰の上向き・胴の高さ（fallH との比）・左右のかたむき
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat';
import { makeField } from '../js/trial.js';
import { height } from '../js/ground.js';
import { pose } from '../js/hare.js';
import { kidGenes, kidBody, KID_SEED } from '../js/kid.js';
import { decodeGetup, driveGetup } from '../js/getup.js';
await R.init();
const id = process.argv[2] || '8', tag = process.argv[3] || id + '-tw', B = kidBody(kidGenes(+id * 7919), { twist: true }), stand = B.decode(KID_SEED);
const q = decodeGetup(JSON.parse(fs.readFileSync(new URL(`../js/getup-kid-${tag}.json`, import.meta.url))).v);
for (const d of [1, -1]) {
  const world = makeField(R), H = B.build(R, world, [1, 0, -1], height, 0); let t = 0;
  for (; t < 0.3; t += 1 / 240) { B.drive(H, stand, t, 0, 0); world.step(); }
  for (const p of Object.values(H.parts)) { const l = p.body.linvel(); p.body.setLinvel({ x: l.x, y: l.y + 0.18, z: l.z + d * 0.6 }, true); }
  for (let k = 0; k < 288; k++) { B.drive(H, stand, t, 0, 0); world.step(); t += 1 / 240; }
  const dd = Math.sign(pose(H).roll) || d, row = []; let stopAt = null;
  for (let k = 0, s = 0; k < 240 * 5.5; k++, s += 1 / 240) { if (stopAt == null && s > 0.2 && pose(H).up > 0.85) stopAt = s; const done = driveGetup(H, q, s, dd, stopAt); if (done) B.drive(H, stand, s, 0, 0); world.step(); if (k % 60 === 59) { const P = pose(H); row.push(`${P.up.toFixed(2)}/${((P.y - height(P.x, P.z)) / H.fallH).toFixed(1)}`); } }
  console.log(d > 0 ? '左から' : '右から', 'T合計', (q.T1 + q.T2 + q.T3 + q.T4).toFixed(2), row.join(' ')); world.free();
}
