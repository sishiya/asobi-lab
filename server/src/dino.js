// 恐竜かけっこ牧場の遺伝子の範囲と体重の計算（サーバーで確かめるため）。
// ゲームの dino-race/js/genome.js の GENES と sim.js の bodyPlan() の重さの部分を写したもの。
// あちらを変えたら、ここも変えて `npm test`（test/check.mjs が、ゲームのコードと同じ体重になるか確かめる）。

// [かぎ, 最小, 最大]（genome.js の GENES と同じ順）
export const GENES = [
  ['legLen', 0.20, 4.5], ['tibRatio', 0.70, 1.45], ['metaRatio', 0.35, 0.95], ['bodyLen', 0.6, 1.5],
  ['bodyThick', 0.30, 0.60], ['neckLen', 0.20, 1.00], ['headLen', 0.15, 0.55], ['tailLen', 0.80, 2.60],
  ['muscle', 0.05, 0.22],
  ['period', 0.6, 3.0], ['split', 0.2, 0.8], ['hipE', -0.3, 1.1], ['kneeE', -1.2, 0.3], ['ankleE', -0.6, 0.9],
  ['hipL', -0.3, 1.1], ['kneeL', -1.2, 0.3], ['ankleL', -0.6, 0.9], ['kneeS', -0.8, 0.3], ['ankleS', -0.6, 0.9],
  ['toeS', -0.4, 0.4], ['toeW', -0.8, 0.4], ['cd', 0, 2.0], ['cv', 0, 1.2], ['lean', -0.3, 0.5],
  ['kPitch', 0.3, 4], ['kRate', 0, 1], ['kp', 4, 40], ['neckC', -0.4, 0.4], ['tailC', -0.3, 0.3],
];

// はじめの種（系統の名前のもと）
export const LINES = ['trex', 'raptor', 'compy', 'struthio'];

// 体重クラス（cups.js の CLASSES と同じ）
export const CLASSES = [['xs', 5], ['s', 50], ['m', 500], ['l', 5000], ['xl', Infinity]];
export const classOf = M => CLASSES.find(([, max]) => M <= max)[0];

const RHO = 1000, SHAPE = 0.52;
// sim.js の bodyPlan() の体重 M
export function massOf(g) {
  const L = g.legLen;
  const tl = L * g.bodyLen, th = tl * g.bodyThick;
  const neck = L * g.neckLen, head = L * g.headLen, tail = L * g.tailLen;
  const t1 = tail * 0.4, t2 = tail * 0.6;
  const thN = th * 0.30, thH = head * 0.36, th1 = th * 0.48, th2 = th * 0.20;
  const vol = (len, t, depth = t) => len * t * depth * SHAPE;
  const core = RHO * vol(tl, th, th * 0.8) + RHO * vol(neck, thN) + RHO * vol(head, thH, thH * 0.7)
    + RHO * vol(t1, th1) + RHO * vol(t2, th2) * 0.6;
  return core / (1 - 2 * (0.035 + g.muscle));
}

// 送られた遺伝子を確かめる。よければ数だけの新しい物（ほかのかぎは捨てる）、だめなら null
export function cleanGenome(g) {
  if (!g || typeof g !== 'object' || Array.isArray(g)) return null;
  const out = {};
  for (const [k, lo, hi] of GENES) {
    const v = g[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo - 1e-9 || v > hi + 1e-9) return null;
    out[k] = v;
  }
  return out;
}
