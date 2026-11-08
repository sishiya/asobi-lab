// 8番の子で覚えた起き上がりの型（js/getup-kid-8-tw.json）が、ほかの体つきの子でもそのまま使えるかを数える（左右×3か所）
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat';
import { makeField } from '../js/trial.js';
import { height } from '../js/ground.js';
import { pose } from '../js/hare.js';
import { kidGenes, kidBody, kidPlan, KID_SEED } from '../js/kid.js';
import { decodeGetup, driveGetup } from '../js/getup.js';
await R.init();
const q = decodeGetup(JSON.parse(fs.readFileSync(new URL('../js/getup-kid-8-tw.json', import.meta.url))).v);
export function tryUp(B, at, d) {
  const stand = B.decode(KID_SEED), world = makeField(R), H = B.build(R, world, at, height, 0); let t = 0;
  for (; t < 0.3; t += 1 / 240) { B.drive(H, stand, t, 0, 0); world.step(); }
  for (const p of Object.values(H.parts)) { const l = p.body.linvel(); p.body.setLinvel({ x: l.x, y: l.y + 0.18, z: l.z + d * 0.6 }, true); }
  for (let k = 0; k < 288; k++) { B.drive(H, stand, t, 0, 0); world.step(); t += 1 / 240; }
  if (pose(H).up > 0.5) { world.free(); return null; }
  const dd = Math.sign(pose(H).roll) || d; let stopAt = null, up = 0, n = 0;
  for (let k = 0, s = 0; k < 240 * 5.5; k++, s += 1 / 240) { if (stopAt == null && s > 0.2 && k % 8 === 0 && pose(H).up > 0.85) stopAt = s; const done = driveGetup(H, q, s, dd, stopAt); if (done) B.drive(H, stand, s, 0, 0); world.step(); if (s > 5 && k % 8 === 0) { up += pose(H).up; n++; } }
  const P = pose(H), ok = up / n > 0.85 && P.y - height(P.x, P.z) > H.fallH; world.free(); return ok;
}
for (const id of process.argv.slice(2).map(Number)) {
  const B = kidBody(kidGenes(id * 7919)), p = kidPlan(kidGenes(id * 7919)); let ok = 0, n = 0;
  for (const at of [[1, 0, -1], [-2, 0, 2], [3, 0, 3]]) for (const d of [1, -1]) { const r = tryUp(B, at, d); if (r != null) { n++; if (r) ok++; } }
  console.log(id, `節${p.seg} 足${p.pairs}対`, `起きた ${ok}/${n}`);
}
