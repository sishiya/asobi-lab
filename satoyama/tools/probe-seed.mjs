// 手本の形から出発点を作って試す（後ろ足は伸ばす向きをそろえて左右同時・背骨は後ろ足が蹴るとき伸ばす・前足は半周ずらして左右を少しずらす）
// 関節の向き（体の左＝+z まわり）: 股＋＝足を前へ、ひざ＋＝のばす、かかと−＝のばす（かかとが上がる）、背骨−＝丸める、肩＋＝前足を前へ
import R from '@dimforge/rapier3d-compat';
import { trial, score } from '../js/trial.js';
import { PARAMS } from '../js/hare.js';
await R.init();
const enc = o => PARAMS.map(([k, a, b]) => Math.max(0, Math.min(1, ((o[k] ?? (a + b) / 2) - a) / (b - a))));
const seedFrom = (A, f, sp) => enc({ freq: f, spA: sp, spO: 0, spP: 0.5, hipA: A, hipO: 0, kneeA: A, kneeO: 0, kneeP: 0.5, ankA: A, ankO: 0, ankP: 0, shA: A * 0.8, shO: 0, shP: 0.5, elA: A * 0.5, elO: 0, elP: 0.5, hLR: 0, fLR: 0.1, turn: 0, neck: 0, pK: 0, pD: 0, pKf: 0, rK: 0 });
let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
for (const A of [0.4, 0.7]) for (const f of [3, 4]) for (const sp of [0.3]) {
  const base = seedFrom(A, f, sp); let mv = 0, best = null; const t0 = Date.now();
  for (let i = 0; i < 6; i++) {
    const v = i === 0 ? base : base.map(m => Math.max(0, Math.min(1, m + 0.08 * gauss())));
    const r = trial(R, v, { dur: 6, turn: () => 0 }); r.world.free();
    if (!r.fell && r.dist > 0.5) mv++;
    const s = score(r, 6, 1.5, 1); if (!best || s > best.s) best = { s, r };
  }
  const r = best.r;
  console.log(`A ${A} f ${f} sp ${sp}: 動けた ${mv}/6  いちばん 進む ${r.dist.toFixed(2)}m 転ぶ ${r.fell ? 'はい' : 'いいえ'} 後ろ着く ${r.hindTD} 手本 ${(r.match * 100).toFixed(0)}% すべり ${(r.slip * 100).toFixed(1)}  ${((Date.now() - t0) / 1000).toFixed(1)}秒`);
}
