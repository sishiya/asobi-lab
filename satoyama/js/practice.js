// 練習（純粋）: その子の体で、歩き方のリズムの数を少しずつ変えて試し、よかったものに寄せる（クロスエントロピー法）。GAME.md 9.5
// 段1＝転んでも・すべってもよいからまず前へ（止まって動かない形に逃げないように）→ 段2＝転ばず・すべらず → 段3＝言われた向きへ曲がる（入って走るため）
// いちばんよい歩きは残し、新しい場所でもう一度試す（たまたまの高得点で、下手な歩きにもどらない）
import { trial } from './trial.js';
import { KID_SEED } from './kid.js';

export function makePractice(R, body, { pop = 16, seed = 1, start = KID_SEED, stage1 = 25, stage2 = 45 } = {}) {
  let s = (seed >>> 0) % 2147483646 + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const score = (r, st) => st === 1 ? Math.min(r.dist, 1.8) - 0.5 * r.slip - (r.fell ? 0.3 : 0)
    : Math.min(r.dist, 1.8) - 3 * r.slip - (r.fell ? 1 : 0) - 1.5 * r.flight + (st === 3 ? 1.5 * r.yaw - 2 * Math.abs(r.drift) : 0); // 曲がる段: 言われた向きへ曲がる・まっすぐのとき流れない（流れるくせは片足をかばうように見える＝9.7）
  let mean = start.slice(), sd = mean.map(() => 0.15), best = null, gen = 0, tries = 0, firstWalk = null;
  const EL = Math.max(2, pop >> 2);
  const run = (v, at, st, turn, dur) => { const r = trial(R, v, { dur, turn, at, body }); r.world.free(); tries++; if (!firstWalk && !r.fell && r.dist > 1) firstWalk = tries; return { v, s: score(r, st), dist: r.dist, fell: r.fell, yaw: r.yaw }; };
  const stageOf = g => (g < stage1 ? 1 : g < stage2 ? 2 : 3);
  return {
    get gen() { return gen; }, get tries() { return tries; }, get best() { return best; }, get firstWalk() { return firstWalk; },
    get trying() { return mean; }, get stage() { return stageOf(gen); },
    // 1世代: pop 回の試し。返すのはいちばんよい歩き
    step() {
      const st = stageOf(gen), at = [(rnd() - 0.5) * 14, 0, (rnd() - 0.5) * 14];
      // 段3は 1.6 秒ごとに 左・まっすぐ・右 がでたらめに変わる指示（遊ぶ人の操作に近い）
      const seq = Array.from({ length: 6 }, () => [-1, 0, 1][Math.floor(rnd() * 3)]), turn = st === 3 ? t => seq[Math.min(5, Math.floor(t / 1.6))] : () => 0, dur = st === 3 ? 8 : 6;
      if ((gen === stage1 || gen === stage2) && best) { mean = best.v.slice(); sd = sd.map(() => 0.08); best = null; } // 段が変わると点のつけ方が変わるので、いちばんを選びなおす
      const P = []; for (let i = 0; i < pop; i++) P.push(run(mean.map((m, k) => Math.max(0, Math.min(1, m + sd[k] * gauss()))), at, st, turn, dur));
      if (best) { const b = run(best.v, at, st, turn, dur); best = { ...best, s: Math.min(best.s, (best.s + b.s) / 2) }; }
      P.sort((a, b) => b.s - a.s); const el = P.slice(0, EL);
      mean = mean.map((_, k) => el.reduce((t, e) => t + e.v[k], 0) / EL);
      sd = sd.map((_, k) => Math.max(0.03, Math.sqrt(el.reduce((t, e) => t + (e.v[k] - mean[k]) ** 2, 0) / EL) * 0.9 + 0.01));
      if (!best || P[0].s > best.s) best = { ...P[0], stage: st };
      gen++; return best;
    },
  };
}
