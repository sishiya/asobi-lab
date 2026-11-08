// 少ない回数で育つか: 手本の出発点＋反射から、小さな集団で学習して、何回目の試しで「転ばずに前へ」に届くかを数える
// ブラウザで1頭ずつ見せながら学習するときの目安（1回の試し＝6秒の跳び）
// node fewshot.mjs [集団] [世代] [くり返し]
import R from '@dimforge/rapier3d-compat';
import { trial, score } from '../js/trial.js';
import { PARAMS } from '../js/hare.js';
await R.init();
const enc = o => PARAMS.map(([k, a, b]) => Math.max(0, Math.min(1, ((o[k] ?? (a + b) / 2) - a) / (b - a))));
const A0 = 0.5, SEED = enc({ freq: 3.5, spA: 0.3, spO: 0, spP: 0.5, hipA: A0, hipO: 0, kneeA: A0, kneeO: 0, kneeP: 0.5, ankA: A0, ankO: 0, ankP: 0, shA: A0 * 0.8, shO: 0, shP: 0.5, elA: A0 * 0.5, elO: 0, elP: 0.5, hLR: 0, fLR: 0.1, turn: 0, neck: 0, pK: 0, pD: 0, pKf: 0, rK: 0, aK: -0.7, aD: 0 });
const POP = +(process.argv[2] || 8), GEN = +(process.argv[3] || 25), REP = +(process.argv[4] || 4), ELITE = Math.max(2, POP >> 2);
for (let rep = 0; rep < REP; rep++) {
  let seed = 1000 + rep * 77; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  let mean = SEED.slice(), sd = PARAMS.map(() => 0.12), n = 0, first = { walk: 0, run: 0 }, line = [];
  for (let g = 0; g < GEN; g++) {
    const at = [(rnd() - 0.5) * 18, 0, (rnd() - 0.5) * 18], pop = []; // 世代ごとに、その子がいる地面が変わる見立て
    for (let i = 0; i < POP; i++) {
      const v = mean.map((m, k) => Math.max(0, Math.min(1, m + sd[k] * gauss()))), r = trial(R, v, { dur: 6, at, turn: () => 0 }); r.world.free(); n++;
      const s = score(r, 6, g < GEN / 2 ? 1.5 : 3, 2, g < GEN / 2 ? 1 : 4); pop.push({ v, s, r });
      if (!r.fell && r.dist > 1 && !first.walk) first.walk = n;   // よろよろ: 転ばずに 1m
      if (!r.fell && r.dist > 2.5 && !first.run) first.run = n;   // 走る: 転ばずに 2.5m（秒速 0.4m）
    }
    pop.sort((a, b) => b.s - a.s); const el = pop.slice(0, ELITE);
    mean = mean.map((_, k) => el.reduce((t, e) => t + e.v[k], 0) / ELITE);
    sd = sd.map((_, k) => Math.max(0.03, Math.sqrt(el.reduce((t, e) => t + (e.v[k] - mean[k]) ** 2, 0) / ELITE) * 0.9 + 0.01));
    const ok = pop.filter(p => !p.r.fell).length; if (g % 5 === 4) line.push(`${g + 1}世代: 転ばず ${ok}/${POP} 最良 ${pop[0].r.dist.toFixed(1)}m`);
  }
  console.log(`くり返し${rep + 1}: よろよろ（転ばず1m）は ${first.walk || '—'} 回目、走る（転ばず2.5m）は ${first.run || '—'} 回目 / ${n} 回`); console.log('  ' + line.join(' | '));
}
