// 遺伝子: 体の形（比率と大きさ）と走り方。値はすべて実際の単位か比率で持つ。
// 体の値の範囲は本物の恐竜の少し外まで（出どころを確かめるまでは仮。PLAN.md）。
// 走り方は SIMBICON（Yin ら 2007）に寄せた、半歩ごとに支える脚と振る脚を入れかえるしくみの数値。

function makeRng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
function gauss(rng) { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// kind: body（体）/ gait（走り方）。log: 対数で変える（大きさ）。角度はラジアンで、立った姿勢からのずれ
const GENES = [
  {k:'legLen',    kind:'body', min:0.20, max:4.5,  log:true, label:'脚の長さ', unit:'m'},
  {k:'tibRatio',  kind:'body', min:0.70, max:1.45, label:'すね ÷ 太もも'},
  {k:'metaRatio', kind:'body', min:0.35, max:0.95, label:'足の甲 ÷ 太もも'},
  {k:'bodyLen',   kind:'body', min:0.6,  max:1.5,  label:'胴の長さ ÷ 脚'},
  {k:'bodyThick', kind:'body', min:0.30, max:0.60, label:'胴の太さ ÷ 胴の長さ'},
  {k:'neckLen',   kind:'body', min:0.20, max:1.00, label:'首 ÷ 脚'},
  {k:'headLen',   kind:'body', min:0.15, max:0.55, label:'頭 ÷ 脚'},
  {k:'tailLen',   kind:'body', min:0.80, max:2.60, label:'しっぽ ÷ 脚'},
  {k:'muscle',    kind:'body', min:0.05, max:0.22, label:'脚1本の筋肉 ÷ 体重'},

  {k:'period', kind:'gait', min:0.6, max:3.0, label:'1歩のリズム（大きさで割った値）'},
  {k:'split',  kind:'gait', min:0.2, max:0.8, label:'振りの前半と後半の分かれ目'},
  {k:'hipE',   kind:'gait', min:-0.3, max:1.1, label:'振る脚の股（前半）'},
  {k:'kneeE',  kind:'gait', min:-1.2, max:0.3, label:'振る脚のひざ（前半）'},
  {k:'ankleE', kind:'gait', min:-0.6, max:0.9, label:'振る脚の足首（前半）'},
  {k:'hipL',   kind:'gait', min:-0.3, max:1.1, label:'振る脚の股（後半）'},
  {k:'kneeL',  kind:'gait', min:-1.2, max:0.3, label:'振る脚のひざ（後半）'},
  {k:'ankleL', kind:'gait', min:-0.6, max:0.9, label:'振る脚の足首（後半）'},
  {k:'kneeS',  kind:'gait', min:-0.8, max:0.3, label:'支える脚のひざ'},
  {k:'ankleS', kind:'gait', min:-0.6, max:0.9, label:'支える脚の足首'},
  {k:'toeS',   kind:'gait', min:-0.4, max:0.4, label:'支える脚の指'},
  {k:'toeW',   kind:'gait', min:-0.8, max:0.4, label:'振る脚の指'},
  {k:'cd',     kind:'gait', min:0,   max:2.0, label:'重心が前にあるほど脚を前へ'},
  {k:'cv',     kind:'gait', min:0,   max:1.2, label:'速いほど脚を前へ'},
  {k:'lean',   kind:'gait', min:-0.3, max:0.5, label:'胴の前傾'},
  {k:'kPitch', kind:'gait', min:0.3, max:4,   label:'胴の傾きを直す強さ'},
  {k:'kRate',  kind:'gait', min:0,   max:1,   label:'傾く速さをおさえる強さ'},
  {k:'kp',     kind:'gait', min:4,   max:40,  label:'関節の追いつく速さ'},
  {k:'neckC',  kind:'gait', min:-0.4, max:0.4, label:'首の角度'},
  {k:'tailC',  kind:'gait', min:-0.3, max:0.3, label:'しっぽの角度'},
];
const GENE_BY_KEY = Object.fromEntries(GENES.map(d => [d.k, d]));

// はじめの牧場の恐竜（比率は仮。段階Aの調べもので本物の計測値に置きかえる）。
// gait は、手で決めた走り方から体を固定して GA で育てたもの（2026-10-09。少しずらした2回目もあわせた採点で 40世代。
// 100m: ティラノ 23.7秒・ラプトル 8.7秒・コンピー 9.9秒。少しずらした6通りでゴールできる数: ティラノ 2・ラプトル 6・コンピー 6）
const SPECIES = [
  {id:'trex', name:'ティラノサウルス', body:{legLen:3.6, tibRatio:0.90, metaRatio:0.55, bodyLen:1.05, bodyThick:0.45, neckLen:0.30, headLen:0.40, tailLen:1.55, muscle:0.12},
   gait:{period:1.319707228, split:0.4394224755, hipE:0.2750677277, kneeE:-1.154218699, ankleE:0.2386471198, hipL:-0.03447941698, kneeL:-0.7745107578, ankleL:0.8430022615, kneeS:0.2210138195, ankleS:0.5474676699, toeS:0.03405215867, toeW:-0.6569148754, cd:0.04542699843, cv:0.8461161689, lean:0.3404220944, kPitch:0.3, kRate:0.6865842883, kp:12.79556266, neckC:0.1146410861, tailC:0.01987507635}},
  {id:'raptor', name:'ヴェロキラプトル', body:{legLen:0.55, tibRatio:1.15, metaRatio:0.60, bodyLen:0.95, bodyThick:0.36, neckLen:0.45, headLen:0.38, tailLen:2.10, muscle:0.12},
   gait:{period:0.8660115181, split:0.5575807903, hipE:-0.1438635973, kneeE:-0.753260029, ankleE:0.1281746158, hipL:0.7820562333, kneeL:-0.9293250608, ankleL:0.6912509406, kneeS:0.1847256726, ankleS:-0.1580453278, toeS:-0.09375907542, toeW:-0.4390215262, cd:0.3630147503, cv:0.6435013142, lean:0.2808160921, kPitch:1.676630509, kRate:0.7345836007, kp:12.26937442, neckC:-0.222744808, tailC:0.2928923047}},
  {id:'compy', name:'コンプソグナトゥス', body:{legLen:0.28, tibRatio:1.30, metaRatio:0.75, bodyLen:0.90, bodyThick:0.34, neckLen:0.55, headLen:0.35, tailLen:2.40, muscle:0.12},
   gait:{period:0.6, split:0.3327559061, hipE:0.164757979, kneeE:-1.041675778, ankleE:-0.6, hipL:1.045962316, kneeL:-0.1780119224, ankleL:0.5466434659, kneeS:0.1122870648, ankleS:-0.45871592, toeS:0.06064348761, toeW:-0.7574898676, cd:0.1686839259, cv:0.6797229171, lean:0.4590807438, kPitch:1.626806241, kRate:0.4724434722, kp:25.82704354, neckC:0.2147952934, tailC:0.1333253664}},
  // v004: 中級が開くと仲間入り（joins: 段）。オルニトミムス類。すね・足の甲が長い俊足型（Holtz 1995 の arctometatarsus）。
  // 体重はおよそ 150kg（Paul 2010 などの推定。幅がある）、全長 4.5m、腰の高さ 1.3m。走り方は体を固定して GA で育てた（2026-10-16。ラプトル・ティラノ・コンピーの走り方からはじめて 110世代。100m 10.56秒、少しずらした6通りで6回ゴール）
  {id:'struthio', joins:2, name:'ストルティオミムス', body:{legLen:1.5, tibRatio:1.2, metaRatio:0.9, bodyLen:0.8, bodyThick:0.33, neckLen:0.75, headLen:0.18, tailLen:1.6, muscle:0.12},
   gait:{period:1.093631018, split:0.2913174027, hipE:-0.08739558807, kneeE:-0.6490767518, ankleE:-0.5299485237, hipL:0.4823619578, kneeL:-1.085356992, ankleL:0.9, kneeS:0.2650714066, ankleS:0.04834224664, toeS:-0.03894737732, toeW:0.2275879733, cd:0.4156765102, cv:0.5440227365, lean:0.5, kPitch:2.222672642, kRate:0.919977582, kp:8.387085178, neckC:-0.4, tailC:0.2652450086}},
];

// 手で決めた、ひとまず歩く走り方（GA のはじまり）
function baseGait() {
  return {period:1.6, split:0.4, hipE:0.5, kneeE:-0.9, ankleE:0.4, hipL:0.4, kneeL:-0.2, ankleL:0.1,
    kneeS:-0.1, ankleS:0.0, toeS:0, toeW:-0.3, cd:0.4, cv:0.2, lean:0, kPitch:1.5, kRate:0.3, kp:15, neckC:0, tailC:0};
}

function randomGait(rng, around = baseGait(), spread = 0.25) {
  const g = {};
  for (const d of GENES) if (d.kind === 'gait') g[d.k] = clamp(around[d.k] + gauss(rng) * spread * (d.max - d.min), d.min, d.max);
  return g;
}

function speciesGenome(sp, rng) {
  return {...sp.body, ...(rng ? randomGait(rng, sp.gait || baseGait()) : (sp.gait || baseGait())), from: sp.id};
}

function cloneGenome(g) { return {...g}; }

// 突然変異: 各遺伝子を確率 p で、範囲の幅 × s の正規分布で動かす（大きさは対数で）
function mutate(g, rng, {rate = 1, bodyLock = false} = {}) {
  const c = cloneGenome(g);
  const p = 0.2 * rate, s = 0.06 * rate;
  for (const d of GENES) {
    if (bodyLock && d.kind === 'body') continue;
    if (rng() > p) continue;
    if (d.log) c[d.k] = clamp(c[d.k] * Math.exp(gauss(rng) * s * 1.5), d.min, d.max);
    else c[d.k] = clamp(c[d.k] + gauss(rng) * s * (d.max - d.min), d.min, d.max);
  }
  return c;
}

// 交叉: 体の遺伝子は両親のあいだ（混ざる）、走り方はどちらか一方の親から丸ごと。
// （はじめは関節ごとのまとまりで両親から混ぜていたが、別々に育った走り方はかみ合わず、子の多くが転んだ。
//   丸ごとにすると、ラプトルどうしの子でゴールできる数が 8匹中 2 → 7。2026-10-09）
// gaitFrom: 走り方を受けつぐ親（a か b。v004 でかけ合わせる前に選べるように）。なければくじ
function crossover(a, b, rng, gaitFrom = null) {
  const c = {};
  for (const d of GENES) {
    if (d.kind !== 'body') continue;
    const t = clamp(0.5 + gauss(rng) * 0.25, -0.1, 1.1); // 親の外へ少しはみ出すこともある
    c[d.k] = d.log ? Math.exp(Math.log(a[d.k]) * (1 - t) + Math.log(b[d.k]) * t) : a[d.k] * (1 - t) + b[d.k] * t;
    c[d.k] = clamp(c[d.k], d.min, d.max);
  }
  const src = gaitFrom || (rng() < 0.5 ? a : b);
  for (const d of GENES) if (d.kind === 'gait') c[d.k] = src[d.k];
  c.from = a.from === b.from ? a.from : 'mix';
  return c;
}
