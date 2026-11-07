// 花の小川: 自動の遊び手（tools/autoplay.mjs と、しらべの道具が使う）。手は step() の input と同じ形 { on, fs, fx }。
// 指（せき）は いちばん大きな塊のまん中 S.main から d だけ先に置く（画面の指はカメラといっしょに動き、カメラはこの塊を追うので同じこと）。指に寄った粒は、だいたい d×RULE.herd.k の速さで進む（d＝0 ならとどまる）。
import { RULE, patchAt, squeezeAt } from '../js/sim.js';

const finger = (S, d, x) => ({ on: true, fs: S.main.s + d, fx: x });
export const constant = (d, x) => S => finger(S, d, x);
export const none = () => ({ on: false, fs: 0, fx: 0 });

// 考える遊び手: 水の量を見て、日なたの岸で飲ませるか、まん中を急ぐかを選ぶ
export function smart(S) {
  const B = S.beads, c = S.main.s;
  const meanW = B.reduce((a, b) => a + b.w, 0) / B.length;
  const left = Math.max(0, 1 - c / (RULE.len - RULE.pond.len));
  const budget = meanW - 0.745 - 0.065 * left;
  // すぼまっているアーチの手前で、雷で締めつけが強いときや乾いてきたときは待つ
  const arch = S.course.arches.find(a => a.s > S.front - 10 && a.s - S.front < 30);
  const hard = S.thunder?.kind === 'squeeze' || meanW < 0.71;
  if (arch && hard && squeezeAt(arch, S.t) > 0.35) return finger(S, 0, 0);
  // 大きな流れ: 水があまっていれば岸へよける
  const wave = S.course.waves.find(w => w.front !== null && !w.used && c - w.front < 150);
  if (wave && budget > 0.01) return finger(S, 5, 0.9);
  if (budget > 0.012) for (const side of [-1, 1]) {
    const p = patchAt(S.course, side, c);
    if (p && p.rare && p.drunk < RULE.patch.rareBloom) return finger(S, 0, side * 1.2);   // 日なたの岸でとどまって飲ませる
  }
  if (budget > 0.012) for (const side of [-1, 1]) {
    const p = patchAt(S.course, side, c + 60);
    if (p && p.rare && p.drunk < RULE.patch.rareBloom) return finger(S, 12, side * 0.8);   // 日なたが近づいたら、先にそちらへ
  }
  const sunAhead = S.course.patches.some(p => p.rare && p.drunk < RULE.patch.rareBloom && p.s0 > c && p.s0 - c < 500);
  if (budget > 0.03 && !sunAhead) return finger(S, 14, 0.75);
  return finger(S, budget < 0 ? 40 : 28, 0);
}
