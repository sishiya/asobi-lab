// 声の子の練習（端末の中で育つ形の試し）: 手本の出発点から、少ない回数で歩けるようになるか
// node kid-learn.mjs 子の番号 世代 [1頭ずつの数] [段 1/2] [つづきから 1]。いちばんよい走りを残す（忘れない）
// 段1＝転んでも・すべってもよいからまず前へ（止まって動かない形に逃げないように）、段2＝転ばず・すべらず・のっそり
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat';
import { trial, score } from '../js/trial.js';
import { KID_SEED, kidPlan, kidGenes as genesOf, kidBody } from '../js/kid.js';
import { TANUKI } from '../js/tanuki.js';
await R.init();
const id = process.argv[2] === 'tanuki' ? 'tanuki' : +(process.argv[2] || 3), gens = +(process.argv[3] || 20), POP = +(process.argv[4] || 12), EL = Math.max(2, POP >> 2);
const tan = id === 'tanuki', g = tan ? {} : genesOf(id * 7919), B = kidBody(g, tan ? TANUKI : null), K = tan ? { ...kidPlan(g), ...TANUKI } : kidPlan(g); // tanuki＝実在のタヌキの寸法
const stage = +(process.argv[5] || 2), resume = process.argv[6] === '1';
let seed = 999 + (tan ? 77 : id) + stage * 31; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const outURL = () => new URL(`../js/gait-${tan ? 'tanuki' : 'kid-' + id}.json`, import.meta.url);
let mean = resume && fs.existsSync(outURL()) ? JSON.parse(fs.readFileSync(outURL())).v : KID_SEED.slice(), sd = mean.map(() => (resume ? 0.08 : 0.15)), best = null, tries = 0;
// 点: のっそり歩く型＝前へ（秒速 0.3m で頭打ち）− すべり − 転ぶ − 宙に浮く時間（いつも足が2本以上ついている歩き方へ）
const scoreWalk = stage === 1 ? r => Math.min(r.dist, 0.3 * 6) - 0.5 * r.slip - (r.fell ? 0.3 : 0) : r => Math.min(r.dist, 0.3 * 6) - 3 * r.slip - (r.fell ? 1 : 0) - 1.5 * r.flight;
let firstWalk = null; // 「転ばず1m」に届いた試しの回数（ゲームの中の育ちの目安）
const evalV = (v, at) => { const r = trial(R, v, { dur: 6, turn: () => 0, at, body: B }); r.world.free(); tries++; if (!firstWalk && !r.fell && r.dist > 1) firstWalk = tries; return { v, r, s: scoreWalk(r) }; };
console.log(`子 #${id}: 節${K.seg} 足${K.pairs}対`);
for (let it = 0; it < gens; it++) {
  const at = [(rnd() - 0.5) * 14, 0, (rnd() - 0.5) * 14];
  const pop = []; for (let i = 0; i < POP; i++) pop.push(evalV(mean.map((m, k) => Math.max(0, Math.min(1, m + sd[k] * gauss()))), at));
  if (best) { const bb = evalV(best.v, at); if (bb.s < best.s) best = { ...best, s: (best.s + bb.s) / 2 }; } // いちばんよい走りも、新しい場所でもう一度試す（たまたまの高得点を残さない）
  pop.sort((a, b) => b.s - a.s); const el = pop.slice(0, EL);
  mean = mean.map((_, k) => el.reduce((t, e) => t + e.v[k], 0) / EL);
  sd = sd.map((_, k) => Math.max(0.03, Math.sqrt(el.reduce((t, e) => t + (e.v[k] - mean[k]) ** 2, 0) / EL) * 0.9 + 0.01));
  if (!best || pop[0].s > best.s) best = pop[0];
  const b = pop[0].r; console.log(`${String(it).padStart(2)} 試し${tries} 点 ${pop[0].s.toFixed(2)} 進む ${b.dist.toFixed(2)}m ${b.fell ? '転ぶ' : ''} すべり ${(b.slip * 100).toFixed(0)}cm/s 宙 ${(b.flight * 100).toFixed(0)}% ${(b.freq || 0).toFixed(1)}回/秒  いちばん ${best.s.toFixed(2)}`);
}
fs.writeFileSync(new URL(`../js/gait-${tan ? 'tanuki' : 'kid-' + id}.json`, import.meta.url), JSON.stringify({ genes: g, v: best.v.map(x => +x.toFixed(4)), score: +best.s.toFixed(3), firstWalk, tries }));
console.log('転ばず1m に届いた試し', firstWalk ?? 'なし', '/', tries);
