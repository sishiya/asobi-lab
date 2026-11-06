// 花の小川: 自動の遊び手（tools/autoplay.mjs と、しらべの道具が使う）。手は step() の input と同じ形 { hold, u, x }。
import { RULE, patchAt, squeezeAt } from '../js/sim.js';

export const constant = (u, x, hold = true) => () => ({ hold, u, x });

// 考える遊び手: 水の量を見て、日なたの岸で飲ませるか、まん中を急ぐかを選ぶ
export function smart(S) {
  const B = S.beads;
  const lead = B[0], mid = B[B.length >> 1];
  const meanW = B.reduce((a, b) => a + b.w, 0) / B.length;
  const left = Math.max(0, 1 - lead.s / (RULE.len - RULE.pond.len));
  // 使える水 = いまの水 − 出口でほしい水 − のこりをまん中で急いで下るときに飲まれる分（見こみ）
  const budget = meanW - 0.745 - 0.065 * left;
  // すぼまっているアーチの手前で、雷で締めつけが強いときや乾いてきたときは待つ
  const arch = S.course.arches.find(a => a.s > lead.s && a.s - lead.s < 30);
  const hard = S.thunder?.kind === 'squeeze' || meanW < 0.71;
  if (arch && hard && squeezeAt(arch, S.t) > 0.35) return { hold: false, u: 0, x: 0 };
  // 大きな流れには、使える水が少ないときだけ乗る
  const wave = S.course.waves.find(w => w.front !== null && !w.used && lead.s - w.front < 120);
  if (wave && budget < 0.01) return { hold: true, u: 1, x: 0 };
  // まだ咲いていない日なたの岸に列のまん中がいて、水に余裕があれば、そこでとどまって飲ませる
  if (budget > 0.012) for (const side of [-1, 1]) {
    const p = patchAt(S.course, side, mid.s);
    if (p && p.rare && p.drunk < RULE.patch.rareBloom) return { hold: false, u: 0, x: side };
  }
  // 日なたの岸が近づいてきたら、先にそちらへ寄っておく
  if (budget > 0.012) for (const side of [-1, 1]) {
    const p = patchAt(S.course, side, lead.s + 40);
    if (p && p.rare && p.drunk < RULE.patch.rareBloom) return { hold: true, u: 0.3, x: side };
  }
  // この先に日なたがなく、水があまっていれば、ゆっくり岸寄りで飲ませる
  const sunAhead = S.course.patches.some(p => p.rare && p.drunk < RULE.patch.rareBloom && p.s0 > lead.s && p.s0 - lead.s < 500);
  if (budget > 0.03 && !sunAhead) return { hold: true, u: 0.3, x: 0.6 };
  return { hold: true, u: budget < 0 ? 1 : 0.8, x: 0 };
}
