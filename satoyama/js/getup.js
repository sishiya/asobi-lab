// 起き上がる練習（声の子）: 横に倒れた体を、足と背の動きで起こす。歩き方とは別の「型」を学ぶ（GAME.md 9.5 の練習の1つ）
// 型＝2つの姿勢（足を寄せる → 下の足でふんばり上の足を振る）を順に取り、最後に立つ姿勢へ。左右どちらに倒れても同じ型を鏡に映して使う（左右対称＝9.7）
// 動きはなめらかにつなぐ（ばたつき・ふるえに見せない＝9.7）。起きられなければ見た目の演出で起こす（ページの側）
const cl = v => Math.max(0, Math.min(1, v));
// 値の範囲。D＝下になった側の足、U＝上の側の足。ab は「下の側へ寄せる」向きを＋、h＝後ろの対、f＝前の対（3対の子のまん中は前と後ろの間をとる）
export const GETUP_PARAMS = [];
for (const k of ['1', '2']) for (const [n, a, b] of [['hipDh', -1.2, 1.2], ['hipUh', -1.2, 1.2], ['kneeDh', -1.4, 1.4], ['kneeUh', -1.4, 1.4], ['abDh', -0.9, 0.9], ['abUh', -0.9, 0.9],
  ['hipDf', -1.2, 1.2], ['hipUf', -1.2, 1.2], ['kneeDf', -1.4, 1.4], ['kneeUf', -1.4, 1.4], ['abDf', -0.9, 0.9], ['abUf', -0.9, 0.9], ['sp', -0.5, 0.5], ['tw', -0.8, 0.8]]) GETUP_PARAMS.push([n + k, a, b]);
GETUP_PARAMS.push(['T1', 0.25, 1.2], ['T2', 0.25, 1.2], ['T3', 0.3, 1.2]);
export const decodeGetup = v => Object.fromEntries(GETUP_PARAMS.map(([k, a, b], i) => [k, a + (b - a) * cl(v[i] ?? 0.5)]));
export const GETUP_SEED = GETUP_PARAMS.map(() => 0.5); // まんなか＝すべて 0（立つ姿勢）・各 0.7 秒ほど

// 型で関節を動かす。t＝起き始めてからの秒、d＝倒れた向き（+1＝左が下、-1＝右が下。pose().roll の符号）
export function driveGetup(H, q, t, d) {
  const ss = x => x * x * (3 - 2 * x), T1 = q.T1, T2 = q.T2, T3 = q.T3;
  // 0→姿勢1（T1）→姿勢2（T2）→立つ（T3）。間はなめらかに
  const w = t < T1 ? [ss(t / T1), 0] : t < T1 + T2 ? [1 - ss((t - T1) / T2), ss((t - T1) / T2)] : [0, 1 - ss(Math.min(1, (t - T1 - T2) / T3))];
  const v = name => w[0] * q[name + '1'] + w[1] * q[name + '2'];
  const set = (j, val) => { if (j && Math.abs(val - j.target) > 1e-4) { j.target = val; j.jt.configureMotorPosition(val, j.k, j.d); } };
  for (let i = 1; i < H.plan.seg; i++) { set(H.joints['sp' + i], v('sp')); set(H.joints['tw' + i], d * v('tw')); } // ねじり（背にねじりの関節がある体だけ）。＋で上になった側へ胸を起こす向き
  const n = H.pairNames.length;
  H.pairNames.forEach((pn, pi) => {
    const f = n === 1 ? 0 : pi / (n - 1); // 0＝後ろの対、1＝前の対
    const pick = (base, side) => (1 - f) * v(base + side + 'h') + f * v(base + side + 'f');
    for (const [L, s] of [['L', 1], ['R', -1]]) {
      const side = s === d ? 'D' : 'U', ks = pn === 'h' ? 1 : -1;
      set(H.joints['hip' + pn + L], pick('hip', side));
      set(H.joints['knee' + pn + L], ks * pick('knee', side));
      set(H.joints['ank' + pn + L], 0);
      // ab は＋で足が右（-z）へ。「下の側へ寄せる」を＋にするので、左が下（d=+1）なら符号を変える
      set(H.joints['ab' + pn + L], -d * pick('ab', side));
    }
  });
  return t > T1 + T2 + T3; // 型が終わった
}
