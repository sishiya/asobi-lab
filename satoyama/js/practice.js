// 練習（純粋）: その子の体で、歩き方のリズムの数を少しずつ変えて試し、よかったものに寄せる（クロスエントロピー法）。GAME.md 9.5
// 段1＝転んでも・すべってもよいからまず前へ（止まって動かない形に逃げないように）→ 段2＝転ばず・すべらず → 段3＝言われた向きへ曲がる（入って走るため）
// 段2→段3 は回数でなく「ちがう場所（傾いた地面）4か所で転ばずに歩けた」ら。歩けるまで練習は止めない
// 段2で長く行きづまったら、別の歩き方（トコトコ・ゆっくり）から始め直す（体に合わない出発点の形に閉じこめられないように）
// いちばんよい歩きは残し、新しい場所でもう一度試す（たまたまの高得点で、下手な歩きにもどらない）
import { trial } from './trial.js';
import { KID_SEED, KID_TROT, KID_SLOW, KID_PARAMS } from './kid.js';

export function makePractice(R, body, { pop = 16, seed = 1, start = KID_SEED, stage1 = 25, minStage2 = 10, stuck = 40, stage3 = 45, resume = null } = {}) {
  let s = (seed >>> 0) % 2147483646 + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const score = (r, st) => st === 1 ? Math.min(r.dist, 1.8) - 0.5 * r.slip - (r.fell ? 0.3 : 0)
    : Math.min(r.dist, 1.8) - 3 * r.slip - (r.fell ? 1 : 0) - 1.5 * r.flight + (st === 3 ? 1.5 * r.yaw - 2 * Math.abs(r.drift) : 0); // 曲がる段: 言われた向きへ曲がる・まっすぐのとき流れない（流れるくせは片足をかばうように見える＝9.7）
  const STARTS = [start, KID_TROT, KID_SLOW];
  let mean = start.slice(), sd = mean.map(() => 0.15), best = null, gen = 0, tries = 0, firstWalk = null, st = 1, inSt = 0, restarts = 0, steady = false, done = false;
  if (resume) ({ s, mean, sd, best, gen, tries, firstWalk, st, inSt, restarts, steady, done } = structuredClone(resume)); // 走りに行って、もどってきたら続きから
  const EL = Math.max(2, pop >> 2);
  // 足の横の振りは、曲がる練習（段3）から使いはじめる（はじめから試すと、まっすぐ歩くのを覚えにくかった）。それまでは出発点の値（0）にとめる
  const LAT = ['abA', 'abP', 'abT'].map(k => KID_PARAMS.findIndex(p => p[0] === k)).filter(i => i >= 0), lock = v => { if (st < 3) for (const i of LAT) v[i] = start[i] ?? 0.5; return v; };
  const run = (v, at, st, turn, dur) => { const r = trial(R, v, { dur, turn, at, body }); r.world.free(); tries++; if (!firstWalk && !r.fell && r.dist > 1) firstWalk = tries; return { v, s: score(r, st), dist: r.dist, fell: r.fell, yaw: r.yaw }; };
  // 4か所（場所ごとに地面の傾きがちがう）で転ばず 1m 歩けるか
  const steadyAt = v => { let ok = 0; for (let k = 0; k < 4; k++) { const a = rnd() * 6.28, d = 2 + rnd() * 5, r = trial(R, v, { dur: 6, body, at: [Math.cos(a) * d, 0, Math.sin(a) * d] }); r.world.free(); tries++; if (!r.fell && r.dist > 1) ok++; } return ok === 4; };
  const toStage = n => { st = n; inSt = 0; if (best) { mean = best.v.slice(); sd = sd.map(() => 0.08); } if (n === 3) for (const i of LAT) sd[i] = 0.15; best = null; }; // 段3で横の振りを広く試しはじめる // 段が変わると点のつけ方が変わるので、いちばんを選びなおす
  return {
    get gen() { return gen; }, get tries() { return tries; }, get best() { return best; }, get firstWalk() { return firstWalk; },
    get trying() { return mean; }, state: () => structuredClone({ s, mean, sd, best, gen, tries, firstWalk, st, inSt, restarts, steady, done }), get stage() { return st; }, get restarts() { return restarts; }, get steady() { return steady; }, get done() { return done; },
    // 1世代: pop 回の試し。返すのはいちばんよい歩き
    step() {
      const at = [(rnd() - 0.5) * 14, 0, (rnd() - 0.5) * 14];
      // 段3は 1.6 秒ごとに 左・まっすぐ・右 がでたらめに変わる指示（遊ぶ人の操作に近い）
      const seq = Array.from({ length: 6 }, () => [-1, 0, 1][Math.floor(rnd() * 3)]), turn = st === 3 ? t => seq[Math.min(5, Math.floor(t / 1.6))] : () => 0, dur = st === 3 ? 8 : 6;
      const P = []; for (let i = 0; i < pop; i++) P.push(run(lock(mean.map((m, k) => Math.max(0, Math.min(1, m + sd[k] * gauss())))), at, st, turn, dur));
      if (best) { const b = run(best.v, at, st, turn, dur); best = { ...best, s: Math.min(best.s, (best.s + b.s) / 2) }; }
      P.sort((a, b) => b.s - a.s); const el = P.slice(0, EL);
      mean = mean.map((_, k) => el.reduce((t, e) => t + e.v[k], 0) / EL);
      sd = sd.map((_, k) => Math.max(0.03, Math.sqrt(el.reduce((t, e) => t + (e.v[k] - mean[k]) ** 2, 0) / EL) * 0.9 + 0.01));
      if (!best || P[0].s > best.s) best = { ...P[0], stage: st };
      const out = best; gen++; inSt++;
      if (st === 1 && inSt >= stage1) toStage(2);
      else if (st === 2 && inSt >= minStage2 && inSt % 5 === 0) {
        if (steadyAt(best.v)) { steady = true; toStage(3); }
        else if (inSt >= stuck) { restarts++; mean = STARTS[restarts % STARTS.length].map(x => Math.max(0, Math.min(1, x + 0.05 * gauss()))); sd = mean.map(() => 0.15); best = null; st = 1; inSt = 0; } // 行きづまり→別の歩き方から
      } else if (st === 3 && inSt >= stage3) { if (steadyAt(best.v)) done = true; else if (inSt >= stage3 * 2) done = true; }
      return out;
    },
  };
}
