'use strict';
// 掘れば昔、積めば未来 — 世界のしくみ（高さ＝年）。企画は ../PLAN.md 1〜3章、仕組みは ../DEVNOTES.md
// 高さ y（マス。上が＋）がそのまま年。0 が家（紀元前1万年）。画面に出るのは、自分の足もとの高さの年の世界だけ。
// その年の、その列の地面の高さが H(列, 年)。g ＝ 1マス上がるあいだに地面が何マス上がるか（PLAN 1章の表）。

const W = 100;                         // 横のマス数
const K = 0.07, U0 = 12026, NOW = 2026; // 1マスの年数 ≒ K ×（2026年からの年数）。U0 は家の年の「2026年からの年数」
// 年の目盛り（PLAN 3章）。2026年からの年数 u が 71年より大きい昔は u = U0·exp(−K·e)、2026年の前後 71年は 1マス 5年、
// その先の未来はふたたび 1マス ≒ K × u。上にも下にも限りはない（v005。ユーザー「いっそ未来や過去にいけてもいい」）
const UMIN = 5 / K;
const E_A = Math.log(U0 / UMIN) / K, E_B = E_A + 2 * UMIN / 5;  // 1955年ごろ・2097年ごろの高さ
function yearsAgo(e) {
  if (e < E_A) return U0 * Math.exp(-K * e);
  if (e <= E_B) return UMIN - (e - E_A) * 5;
  return -UMIN * Math.exp(K * (e - E_B));
}
const yearAt = e => NOW - yearsAgo(e);          // 西暦（0 以下は紀元前）
const perTile = e => (e < E_A || e > E_B) ? K * Math.abs(yearsAgo(e)) : 5;
function eAgo(u) {                              // 何年前 → 高さ（マイナスは未来）
  if (u >= UMIN) return Math.log(U0 / u) / K;
  if (u > -UMIN) return E_A + (UMIN - u) / 5;
  return E_B + Math.log(-u / UMIN) / K;
}
const E_MIN = eAgo(4.6e9);                       // 地球ができたころ（約 −184）
const E_MAGMA = eAgo(4.0e9);                     // これより昔はマグマの海
const E_DEATH = eAgo(4.3e9);                     // ここまで掘ると焼けて家へ戻される
const E_MAX = Infinity;
const ROCK = -Infinity;                          // 掘れない岩はなし（v001〜v004 は −14）
const AGE = { pre: eAgo(5.41e8), paleo: eAgo(2.52e8), meso: eAgo(6.6e7), ceno: eAgo(2.6e6), now: eAgo(0) };

// 折れ線（[年, 高さ] の点を直線でつなぐ。端はそのまま延ばす）
function knots(kn, e) {
  let i = 1;
  while (i < kn.length - 1 && e > kn[i][0]) i++;
  const a = kn[i - 1], b = kn[i];
  return a[1] + (e - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// 場所ごとの地面の歴史（PLAN 4章）。左から: 家の丘 → 手前の平野 → 川 → むこう岸（のちの村・町・ピラミッド）
const HILL_SHAPE = [[0, 8], [3, 8], [6, 1.6], [8, 0.4], [12, 0], [17, 0.3], [20, 0]]; // 丘の形（家の年）。g = 0.12 でゆっくり積もる
const NEAR = [[-400, -357.8], [-16, -12.2], [-14, -11], [-9, -9], [-6, -9], [-3, -2], [1, -0.5], [27, 7.3]];
// 手前の平野: 最終氷期（−9 あたり）は広い河原で、地面は止まっている。氷期のおわり（−6〜−3）に海面が上がって一気に土が積もる（g 2.3）。
// だから、家の年の平野で掘ると、少し掘っただけで「氷期の地面」の上の空中に出て、2万年前の河原まで落ちる。
const FAR = [[-400, -356.4], [-16, -10.8], [-14, -10.4], [-10, -9.6], [-9, -9.4], [-8, -6.8], [-6, -4.5], [4, 5.5], [8, 6.4], [9.5, 12], [13, 14.5], [16, 14.6], [27, 15.7]];
// 深い昔（−16 より前）はどの場所も g 0.9 でつなぐ（v005）。
// むこう岸: 氷期の河原（−10）から 2マス積むと、土がどんどん積もる時代（g > 1）に入って村の時代（6 あたり）まで押し上げられる。
// 村の時代（g 0.2）から 4マス積むと、家を建てなおすたびに町が高くなる「テル」（町の上に町。g 2.5）に入り、都の時代（14 あたり）へ。
const PYR = { c: 90, half: 8, h: 8, e0: 14.8, e1: 15.0 };       // ピラミッド（段々。e0〜e1 の年にできあがる）
const CLAY = [61, 67];                                          // 川べりの粘土の列

const hNear = e => knots(NEAR, e);
const hFar = e => knots(FAR, e);
const riverDepth = e => mix(0.9, 4, smooth(-6, -4.5, e));       // 川の深さ: 氷期は浅い（歩いてわたれる）
const waterLevel = e => hNear(e) - 0.45;

function pyrH(x, e) {
  const d = Math.abs(x - PYR.c);
  if (d > PYR.half) return 0;
  return Math.min(PYR.h, PYR.half - Math.floor(d) + 1) * smooth(PYR.e0, PYR.e1, e);
}

// 列 c（0〜W−1）の、年 e の地面の高さ
function H(c, e) {
  const x = c + 0.5;
  const hill = knots(HILL_SHAPE, x) + 0.12 * Math.max(e, -14) + 0.9 * Math.min(0, e + 14);  // 深い昔は g 0.9（掘ると見える地層の年が、自分の年に近い）
  if (x < 20) return hill;
  const near = hNear(e);
  if (x < 27) return mix(hill, near, smooth(20, 27, x));
  const river = near - riverDepth(e);
  if (x < 52) return near;
  if (x < 55) return mix(near, river, smooth(52, 55, x));
  if (x < 61) return river;
  const far = hFar(e) + pyrH(x, e);
  if (x < 64) return mix(river, far, smooth(61, 64, x));
  return far;
}
const isRiver = c => c >= 50 && c <= 65;

// 地層の色を決める「そのマスが積もった年」（地面がそのマスの真ん中を越えた、いちばん古い年）。列ごとに先に計算しておく
const J_MIN = -200, J_MAX = 220;
const DEP = [];
for (let c = 0; c < W; c++) {   // 年を昔から未来へなめて、地面がそのマスの真ん中をはじめて越えた年を記録する
  const col = new Float32Array(J_MAX - J_MIN + 1).fill(NaN);
  let jn = J_MIN;
  for (let e = J_MIN - 10; e <= J_MAX + 10 && jn <= J_MAX; e += 0.05) {
    const h = H(c, e);
    while (jn <= J_MAX && h >= jn + 0.5) { col[jn - J_MIN] = e; jn++; }
  }
  DEP.push(col);
}
const depEra = (c, j) => (c < 0 || c >= W || j < J_MIN || j > J_MAX) ? NaN : DEP[c][j - J_MIN];

// マスの材料（掘ったときに袋に入る物・地層の見た目）
function material(c, j) {
  if (Math.abs(c + 0.5 - PYR.c) <= PYR.half && j >= Math.floor(hFar(PYR.e1)) && depEra(c, j) < PYR.e1 + 1) return 'stone';
  const d = depEra(c, j);
  if (c >= CLAY[0] && c <= CLAY[1] && d >= -14 && d < 9) return 'clay';
  if (!(d === d)) return j < 0 ? 'rock' : 'soil';
  if (d < E_MAGMA) return 'magma';   // 冥王代（マグマの海が冷えかけたころ）
  if (d < AGE.pre) return 'rock';    // 先カンブリア時代の固い岩
  if (d < AGE.paleo) return 'coal';  // 古生代（石炭の森）
  if (d < AGE.meso) return 'red';    // 中生代（恐竜の時代の赤い砂岩）
  if (d < AGE.ceno) return 'sand';   // 新生代
  if (d < -6) return 'loess';        // 氷河時代の風で運ばれた黄色っぽい土
  if (d < 9 || c < 64) return 'soil';// 草の育つ黒っぽい土
  return 'tell';                     // 町のくずれた土・灰・れんがのかけら
}

// 掘った・積んだマス（年に関係なく、その場所・その高さに残る）
const mods = new Map();
const key = (c, j) => c + ',' + j;

function solid(c, j, e) {
  if (c < 0 || c >= W) return true;
  const m = mods.get(key(c, j));
  if (m) return m.t === 'put';
  return j < Math.floor(H(c, e));
}

// 年の表し方
function yearLabel(e) {
  const u = yearsAgo(e), y = NOW - u, s = perTile(e);
  if (u >= 1e8) return '約 ' + (u / 1e8).toFixed(1) + '億年前';
  if (u >= 1e5) return '約 ' + Math.round(u / 1e4).toLocaleString('ja-JP') + '万年前';
  const step = Math.pow(10, Math.max(0, Math.floor(Math.log10(s / 2))));
  const r = Math.round(Math.abs(y) / step) * step;
  const n = r.toLocaleString('ja-JP');
  return y < 1 ? '紀元前 ' + n + '年' : '西暦 ' + n + '年';
}
function eraName(e) {
  const u = yearsAgo(e), y = NOW - u;
  if (u > 4.0e9) return '冥王代・マグマの海';
  if (u > 5.41e8) return '先カンブリア時代';
  if (u > 2.52e8) return '古生代';
  if (u > 6.6e7) return '中生代・恐竜の時代';
  if (u > 2.6e6) return '新生代・哺乳類の時代';
  if (u > 30000) return '氷河時代・旧石器時代';
  if (y < -11500) return '最終氷期・旧石器時代';
  if (y < -8500) return '氷期のおわり・旧石器時代';
  if (y < -3300) return '新石器時代・農耕のはじまり';
  if (y < -1200) return '青銅器時代・都と文字';
  if (y < 500) return '鉄器時代';
  if (y < 1500) return '中世';
  if (y < 1850) return '近世';
  if (y < 1950) return '近代';
  if (y <= 2026) return '現代';
  return '未来';
}

window.World = { W, K, E_MIN, E_MAX, ROCK, E_MAGMA, E_DEATH, AGE, eAgo, PYR, CLAY, yearsAgo, yearAt, perTile, H, hNear, hFar, waterLevel, riverDepth, isRiver,
  depEra, material, mods, key, solid, yearLabel, eraName, clamp, smooth, mix, knots };
