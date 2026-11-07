// 練習（純粋）: その子の体で、歩き方のリズムの数を少しずつ変えて試し、よかったものに寄せる（クロスエントロピー法）。GAME.md 9.5
// 段1＝転んでも・すべってもよいからまず前へ（止まって動かない形に逃げないように）→ 段2＝転ばず・すべらず・のっそり
// いちばんよい歩きは残し、新しい場所でもう一度試す（たまたまの高得点で、下手な歩きにもどらない）
import { trial } from './trial.js';
import { KID_SEED } from './kid.js';

export function makePractice(R, body, { pop = 16, seed = 1, start = KID_SEED, stage1 = 25 } = {}) {
  let s = (seed >>> 0) % 2147483646 + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const score = (r, st) => st === 1 ? Math.min(r.dist, 1.8) - 0.5 * r.slip - (r.fell ? 0.3 : 0) : Math.min(r.dist, 1.8) - 3 * r.slip - (r.fell ? 1 : 0) - 1.5 * r.flight;
  let mean = start.slice(), sd = mean.map(() => 0.15), best = null, gen = 0, tries = 0, firstWalk = null;
  const EL = Math.max(2, pop >> 2);
  const run = (v, at, st) => { const r = trial(R, v, { dur: 6, turn: () => 0, at, body }); r.world.free(); tries++; if (!firstWalk && !r.fell && r.dist > 1) firstWalk = tries; return { v, s: score(r, st), dist: r.dist, fell: r.fell }; };
  return {
    get gen() { return gen; }, get tries() { return tries; }, get best() { return best; }, get firstWalk() { return firstWalk; },
    // 1世代: pop 回の試し。返すのはいちばんよい歩き
    step() {
      const st = gen < stage1 ? 1 : 2, at = [(rnd() - 0.5) * 14, 0, (rnd() - 0.5) * 14];
      if (gen === stage1 && best) { mean = best.v.slice(); sd = sd.map(() => 0.08); best = null; } // 段2へ: 点のつけ方が変わるので、いちばんを選びなおす
      const P = []; for (let i = 0; i < pop; i++) P.push(run(mean.map((m, k) => Math.max(0, Math.min(1, m + sd[k] * gauss()))), at, st));
      if (best) { const b = run(best.v, at, st); best = { ...best, s: Math.min(best.s, (best.s + b.s) / 2) }; }
      P.sort((a, b) => b.s - a.s); const el = P.slice(0, EL);
      mean = mean.map((_, k) => el.reduce((t, e) => t + e.v[k], 0) / EL);
      sd = sd.map((_, k) => Math.max(0.03, Math.sqrt(el.reduce((t, e) => t + (e.v[k] - mean[k]) ** 2, 0) / EL) * 0.9 + 0.01));
      if (!best || P[0].s > best.s) best = { ...P[0], stage: st };
      gen++; return best;
    },
  };
}
