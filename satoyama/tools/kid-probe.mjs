// 声の子の手本の出発点さがし: 歩き方の型（のっそり歩く・速歩・跳ねる）× 速さ × ひざの位相で、6秒でどれだけ進むか
import R from '@dimforge/rapier3d-compat';
import { trial } from '../js/trial.js';
import { KID_SEED, decodeKid, encodeKid, kidGenes, kidBody } from '../js/kid.js';
import { TANUKI } from '../js/tanuki.js';
await R.init();
const base = decodeKid(KID_SEED);
const TYPES = { 'のっそり（横の順）': { pairP: 0.25, side: 0.8 }, '速歩（対角）': { pairP: 0.5, side: 0.8 }, '跳ねる（そろえる）': { pairP: 0.3, side: 0.2 } };
for (const id of (process.argv[2] || '3,1,8,6').split(',').map(x => (x === 'tanuki' ? x : +x))) {
  const B = id === 'tanuki' ? kidBody({}, TANUKI) : kidBody(kidGenes(id * 7919)), rows = [];
  for (const [tn, T] of Object.entries(TYPES)) for (const freq of [1.0, 1.6, 2.4]) for (const kneeP of [0.75, 0.25]) for (const hipA of [0.3, 0.6]) for (const kneeA of [0.3, 0.7]) {
    const q = { ...base, ...T, freq, kneeP, ankP: (kneeP + 0.5) % 1, hipA, kneeA, ankA: 0.25 };
    const r = trial(R, encodeKid(q), { dur: 6, turn: () => 0, body: B }); r.world.free();
    rows.push([r.fell ? -9 : r.dist - r.slip, `${tn} ${freq}回/秒 ひざ${kneeP}/${kneeA} 振り${hipA}: ${r.dist.toFixed(2)}m すべり${(r.slip * 100).toFixed(0)}${r.fell ? ' 転ぶ' : ''}`]);
  }
  rows.sort((a, b) => b[0] - a[0]); console.log(`子 #${id}:\n  ` + rows.slice(0, 6).map(r => r[1]).join('\n  '));
}
