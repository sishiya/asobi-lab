// 花の小川 段階A1: 自動の遊び手で「とりあい」が成り立つかを確かめる（PLAN.md 段階A1）。
// node flower-brook/tools/autoplay.mjs [--seeds=20]
// - 決まった押し方（速さ一定・岸一定）を何通りも、コースの種ごとに走らせ、形の段とめずらしい花の数を出す。
// - くらべる相手は「考える遊び手」（smart）: 水の量を見て、日なたの岸で飲ませるか、まん中を急ぐかを選ぶ。
// ねらい: 決まった押し方では 4段とめずらしい花を両方は取れず、smart は取れること。
import { newState, step, bloomOf, shapeOf } from '../js/sim.js';
import { constant, smart } from './bots.mjs';

const arg = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const SEEDS = +(arg.seeds || 20);
const LIMIT = 600;  // 秒

function run(seed, policy) {
  const S = newState(seed);
  while (!S.done && S.t < LIMIT) step(S, policy(S));
  return { grade: S.done ? S.grade : 1, t: S.t, ...bloomOf(S), ...shapeOf(S), rides: S.log.filter(e => e.ev === 'ride').length };
}

const policies = [];
for (const u of [0, 0.2, 0.4, 0.6, 0.8, 1]) for (const x of [0, 0.5, 0.9]) policies.push({ name: `u${u} x${x}`, fn: constant(u, x) });
policies.push({ name: 'はなしたまま', fn: constant(0, 0, false) });
policies.push({ name: 'smart', fn: smart });

console.log(`種 ${SEEDS} 個。段の数（1〜7）・4段の割合・めずらしい花（平均／全部）・かかった秒`);
const rows = [];
for (const p of policies) {
  const hist = [0, 0, 0, 0, 0, 0, 0, 0];
  let rare = 0, rareAll = 0, t = 0, w = 0;
  for (let s = 1; s <= SEEDS; s++) { const r = run(s, p.fn); hist[r.grade]++; rare += r.rare; rareAll += r.rareAll; t += r.t; w += r.meanW; }
  rows.push({ name: p.name, four: hist[4] / SEEDS, rare: rare / SEEDS });
  console.log(`${p.name.padEnd(10)} 段 ${hist.slice(1).join(' ')}  4段 ${(100 * hist[4] / SEEDS).toFixed(0).padStart(3)}%  めずらしい ${(rare / SEEDS).toFixed(1)}/${(rareAll / SEEDS).toFixed(1)}  ${(t / SEEDS).toFixed(0)}秒  水 ${(w / SEEDS).toFixed(3)}`);
}
const cons = rows.filter(r => r.name !== 'smart' && r.name !== 'はなしたまま');
const best4 = cons.reduce((a, b) => (b.four > a.four ? b : a));
const sm = rows.find(r => r.name === 'smart');
console.log(`\n決まった押し方で 4段がいちばん出たもの: ${best4.name}（${(best4.four * 100).toFixed(0)}%、めずらしい ${best4.rare.toFixed(1)}）`);
console.log(`smart: 4段 ${(sm.four * 100).toFixed(0)}%、めずらしい ${sm.rare.toFixed(1)}`);
