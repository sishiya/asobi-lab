// 練習の見わたし（NOTWIST＝背骨のねじりなしの体、NOLAT＝足の横の振りなし）: いろいろな子（kidGenes の番号）で、ページと同じ練習（js/practice.js）を終わるまで回し（多くても MAX 世代）、
// はじめて転ばず1m歩けた試し・4か所で転ばずに歩けた（段3へ）世代・歩き方を変えた回数・終わりの歩きを別の8か所で試した結果を1行に
import R from '@dimforge/rapier3d-compat';
import { trial } from '../js/trial.js';
import { kidGenes, kidBody, kidPlan, decodeKid, driveKid } from '../js/kid.js';
import { pose } from '../js/hare.js';
import { makePractice } from '../js/practice.js';
await R.init();
const MAX = +(process.env.MAX || 250);
for (const id of process.argv.slice(2).map(Number)) {
  const g = kidGenes(id * 7919), B0 = kidBody(g, process.env.NOTWIST ? { twist: false } : null), B = process.env.NOLAT ? { ...B0, drive: (H, q, t, gg, tc) => driveKid(H, { ...q, abA: 0, abT: 0 }, t, gg, tc, pose) } : B0, P = makePractice(R, B, { seed: +(process.env.SEED || 5) }), t0 = Date.now();
  let last = null, steadyGen = null; // 段が変わった直後は P.best が空なので、最後に返った歩きで
  while (!P.done && P.gen < MAX) { last = P.step(); if (P.steady && steadyGen == null) steadyGen = P.gen; }
  let ok = 0;
  for (let k = 0; k < 8; k++) { const a = k * 0.785 + 0.3, r = trial(R, last.v, { dur: 6, body: B, at: [Math.cos(a) * 4, 0, Math.sin(a) * 4] }); r.world.free(); if (!r.fell && r.dist > 1) ok++; }
  // 曲がり方（指示 −1/0/+1 で rad/秒）
  const turn = [-1, 0, 1].map(tc => { let acc = 0, last0 = null; const r = trial(R, last.v, { dur: 5, turn: () => tc, body: B, at: [1, 0, -1], onFrame: (t, H, Q) => { if (t < 1) return; if (last0 != null) { let d = Q.yaw - last0; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; acc += d; } last0 = Q.yaw; } }); r.world.free(); return +(acc / 4).toFixed(2); });
  const p = kidPlan(g), q = decodeKid(last.v);
  console.log(JSON.stringify({ id, seg: p.seg, pairs: p.pairs, firstWalk: P.firstWalk, steadyGen, restarts: P.restarts, gens: P.gen, done: P.done, ok8: ok, turn, lat: [+q.abA.toFixed(2), +q.abT.toFixed(2)], min: +((Date.now() - t0) / 60000).toFixed(1) }));
}
