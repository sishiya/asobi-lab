// 練習の見わたし: いろいろな子（kidGenes の番号）で、ページと同じ練習（js/practice.js）を終わるまで回し（多くても MAX 世代）、
// はじめて転ばず1m歩けた試し・4か所で転ばずに歩けた（段3へ）世代・歩き方を変えた回数・終わりの歩きを別の8か所で試した結果を1行に
import R from '@dimforge/rapier3d-compat';
import { trial } from '../js/trial.js';
import { kidGenes, kidBody, kidPlan } from '../js/kid.js';
import { makePractice } from '../js/practice.js';
await R.init();
const MAX = +(process.env.MAX || 250);
for (const id of process.argv.slice(2).map(Number)) {
  const g = kidGenes(id * 7919), B = kidBody(g), P = makePractice(R, B, { seed: 5 }), t0 = Date.now();
  let last = null, steadyGen = null; // 段が変わった直後は P.best が空なので、最後に返った歩きで
  while (!P.done && P.gen < MAX) { last = P.step(); if (P.steady && steadyGen == null) steadyGen = P.gen; }
  let ok = 0;
  for (let k = 0; k < 8; k++) { const a = k * 0.785 + 0.3, r = trial(R, last.v, { dur: 6, body: B, at: [Math.cos(a) * 4, 0, Math.sin(a) * 4] }); r.world.free(); if (!r.fell && r.dist > 1) ok++; }
  const p = kidPlan(g);
  console.log(JSON.stringify({ id, seg: p.seg, pairs: p.pairs, firstWalk: P.firstWalk, steadyGen, restarts: P.restarts, gens: P.gen, done: P.done, ok8: ok, min: +((Date.now() - t0) / 60000).toFixed(1) }));
}
