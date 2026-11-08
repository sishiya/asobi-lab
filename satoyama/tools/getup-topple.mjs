// 起き上がりの試しの「倒し方」を確かめる: 押しの強さごとに、横に倒れた（腰の上向き < 0.5）かを数える
import R from '@dimforge/rapier3d-compat';
import { makeField } from '../js/trial.js';
import { height } from '../js/ground.js';
import { pose } from '../js/hare.js';
import { kidGenes, kidBody, KID_SEED } from '../js/kid.js';
await R.init();
const B = kidBody(kidGenes(8 * 7919)), stand = B.decode(KID_SEED);
for (const [w, v] of [[0, 0.4], [0, 0.6], [0, 0.8], [10, 0.6]]) {
  const res = [];
  for (const d of [1, -1]) { const world = makeField(R), H = B.build(R, world, [1, 0, 1], height, 0); let t = 0;
    for (; t < 0.3; t += 1 / 240) { B.drive(H, stand, t, 0, 0); world.step(); }
    for (const p of Object.values(H.parts)) { const a = p.body.angvel(), l = p.body.linvel(); p.body.setAngvel({ x: a.x + d * w, y: a.y, z: a.z }, true); p.body.setLinvel({ x: l.x, y: l.y + 0.3 * v, z: l.z + d * v }, true); }
    const ups = []; for (let k = 0; k < 288; k++) { B.drive(H, stand, t, 0, 0); world.step(); t += 1 / 240; if (k % 48 === 47) ups.push(pose(H).up.toFixed(2)); }
    res.push(`${d > 0 ? '左' : '右'} ${ups.join(' ')} roll ${pose(H).roll.toFixed(2)}`); world.free(); }
  console.log(`回し ${w} 押し ${v}: ${res.join(' | ')}`);
}
