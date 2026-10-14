'use strict';
// 世界: 深淵に浮かぶ平らな円盤の大地。N×N の格子のうち、半径 RD の円の中だけが大地。
//   水: 浅い水のパイプのモデル（区画ごとの深さ w と、4方向へ出ていく流れ fL fR fU fD）。
//       ふちの外へ出た水は果ての滝になって深淵へ落ちる（一部は霧になって雲へ）。深淵の水は泉からわく。
//   空: 太陽と月が大地の上をぐるりと回る（沈まない）。太陽に近い所が昼。月の下へ水が寄る（潮）。
//   雲: 太陽に照らされた水と滝のしぶきから生まれ、天といっしょにめぐり、山にぶつかると雨をふらせる。
//   草と水草: うるおい（moist）と光（light）と気温（T）で育つ。
//   季節（v008）: 1年＝YEAR 日（春夏秋冬が4日ずつ）。太陽の道は夏は内がわ（強く照らす）、冬は外がわ。
//     気温 T は季節・日のあたり・高さで決まる。0 度より下で雨は雪 snow になって積もり、水は凍る ice（流れない）。春に雪がとける。

const N = 96, C = (N - 1) / 2, RD = 46;
const DAY = 60;                 // 1日の秒数（×1 のとき）
const RS = 0.6 * RD, HS = 30;   // 太陽・月の道の半径（地の上に落とした所）と高さ
const BINS = 96;                // 滝の向きの区分
const SPRING_MAX = 12;           // 泉の上限は深淵の水（v011）。これは重さとセーブのためだけ
const YEAR = 16;                // 1年の日数（春夏秋冬 4日ずつ）
const SEASONS = TX(['春', '夏', '秋', '冬'], ['spring', 'summer', 'autumn', 'winter']);
const KPL = { deer: TX('シカ', 'deer'), wolf: TX('オオカミ', 'wolves'), fish: TX('サカナ', 'fish'), bird: TX('サギ', 'herons') };   // 英語の文の中の名前（複数）
const STOCK_MAX = { deer: 10, wolf: 4, fish: 12, bird: 3 };
const STOCK_START = { deer: 6, wolf: 3, fish: 8, bird: 2 };   // つぼに命が来たときの数（v011）

const inside = new Uint8Array(N * N);
const INS = [];
const edgeBin = new Int16Array(N * N).fill(-1);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const d = Math.hypot(x - C, y - C);
  if (d <= RD) { inside[y * N + x] = 1; INS.push(y * N + x); }
}
for (const i of INS) {
  const x = i % N, y = (i / N) | 0;
  if (!inside[i - 1] || !inside[i + 1] || !inside[i - N] || !inside[i + N]) {
    edgeBin[i] = ((Math.atan2(y - C, x - C) / (2 * Math.PI) + 1) * BINS | 0) % BINS;
  }
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// 値のノイズ（いくつかの細かさを重ねる）。だいたい -1〜1
function makeFbm(rnd) {
  const S = 17, lat = [];
  for (let o = 0; o < 4; o++) { const a = new Float32Array(S * S); for (let k = 0; k < a.length; k++) a[k] = rnd() * 2 - 1; lat.push(a); }
  const sm = t => t * t * (3 - 2 * t);
  function one(a, x, y) {
    x = ((x % (S - 1)) + (S - 1)) % (S - 1); y = ((y % (S - 1)) + (S - 1)) % (S - 1);
    const xi = x | 0, yi = y | 0, fx = sm(x - xi), fy = sm(y - yi);
    const v00 = a[yi * S + xi], v10 = a[yi * S + xi + 1], v01 = a[(yi + 1) * S + xi], v11 = a[(yi + 1) * S + xi + 1];
    return (v00 + (v10 - v00) * fx) * (1 - fy) + (v01 + (v11 - v01) * fx) * fy;
  }
  return (x, y) => { let s = 0, amp = 0.55, f = 1; for (let o = 0; o < 4; o++) { s += amp * one(lat[o], x * f + o * 3.1, y * f + o * 7.7); amp *= 0.5; f *= 2; } return s; };
}

const W = {};

// bare=true: はじめの章のための、岩と土だけの大地（泉・草・木・水草なし。湖の水は深淵へ）。v011
function newWorld(seed, bare) {
  const rnd = rng(seed);
  W.seed = seed; W.rnd = rnd;
  const A = () => new Float32Array(N * N);
  W.g = A(); W.w = A(); W.fL = A(); W.fR = A(); W.fU = A(); W.fD = A();
  W.veg = A(); W.alg = A(); W.moist = A(); W.light = A();
  W.tree = A(); W.tseed = A();          // 木（草がよく茂る所に、ゆっくり育つ）
  W.sown = A();                         // まいたたね（v045）: 少しずつ草になる（stepPlants）
  W.T = A(); W.snow = A(); W.ice = new Uint8Array(N * N);   // 気温・雪・氷
  W.rs = RS; W.sunAmp = 1;
  for (const i of INS) W.tseed[i] = rnd();
  W.fall = new Float32Array(BINS);       // 滝の量（なめらかにしたもの。描く用）
  W.fallNow = new Float32Array(BINS);    // この1秒に落ちた量をためる
  W.mist = new Float32Array(BINS);
  W.t = 0; W.day = 1;
  W.sun = { a: rnd() * Math.PI * 2, v: 2 * Math.PI / DAY, stop: false, drag: false };
  W.moon = { a: W.sun.a + Math.PI * (0.6 + rnd() * 0.8), v: 2 * Math.PI / (DAY * 1.07), stop: false, drag: false };
  W.clouds = []; W.vapor = 0; W.outRate = 0; W.rainRate = 0;
  W.soil = 120; W.stock = { deer: 6, wolf: 2, fish: 8, bird: 1 };
  W.souls = { deer: 0, wolf: 0, fish: 0, bird: 0 };   // 去った命（深淵を通って、少しずつつぼへ戻る。v011）
  W.knob = { winter: 1, tide: 1 };                     // 世界のきびしさ（章で少しずつ上げる。v011）
  W.flags = {};                                        // 一度だけ見つける出来事（観察の記録）
  W.events = [];

  // 地形: ゆるい丸屋根（ふちへ向かって低い）＋ノイズ＋山2つ＋湖のくぼみ＋ふちの岩
  const fbm = makeFbm(rnd);
  const pol = (a, r) => ({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  const a1 = rnd() * Math.PI * 2;
  const m1 = pol(a1, 0.12 + rnd() * 0.1);
  const m2 = pol(a1 + 2 + rnd(), 0.55 + rnd() * 0.15);
  const lk = pol(a1 + Math.PI * (0.75 + rnd() * 0.5), 0.42 + rnd() * 0.1);
  const lk2 = pol(a1 - 1.6 - rnd() * 0.5, 0.62);
  const ph = [rnd() * 7, rnd() * 7, rnd() * 7];
  W.lake = lk;
  for (const i of INS) {
    const nx = (i % N - C) / RD, ny = ((i / N | 0) - C) / RD, r = Math.hypot(nx, ny), ang = Math.atan2(ny, nx);
    const d2 = p => (nx - p.x) ** 2 + (ny - p.y) ** 2;
    let h = 6.2 - 3.6 * r * r + 2.6 * fbm(nx * 2.4 + 5, ny * 2.4 + 5);
    h += 8.5 * Math.exp(-d2(m1) / 0.025);
    h += 4.0 * Math.exp(-d2(m2) / 0.015);
    h -= 6.0 * Math.exp(-d2(lk) / 0.022);
    h -= 3.0 * Math.exp(-d2(lk2) / 0.012);
    if (r > 0.86) {
      const rim = 0.5 + 0.25 * Math.sin(ang * 3 + ph[0]) + 0.2 * Math.sin(ang * 7 + ph[1]) + 0.15 * Math.sin(ang * 13 + ph[2]);
      h += (r - 0.86) / 0.14 * 3.2 * Math.max(0, rim);
    }
    W.g[i] = Math.max(0.8, h);
  }
  // 泉: 大きな山の中腹と、小さな山のそば
  W.springs = [];
  const toI = p => { const x = Math.round(C + p.x * RD), y = Math.round(C + p.y * RD); return y * N + x; };
  W.springs.push({ i: toI(pol(a1 + 0.9, Math.hypot(m1.x, m1.y) + 0.07)), on: true });
  W.springs.push({ i: toI({ x: m2.x * 0.9, y: m2.y * 0.9 }), on: true });
  // 湖にはじめの水
  const lc = toI(lk);
  const level = W.g[lc] + 3.4;
  for (const i of INS) {
    const nx = (i % N - C) / RD, ny = ((i / N | 0) - C) / RD;
    if ((nx - lk.x) ** 2 + (ny - lk.y) ** 2 < 0.05) W.w[i] = Math.max(0, level - W.g[i]);
  }
  W.abyss = 900;
  // 水をなじませてから、草と水草をおく
  for (let k = 0; k < 1400; k++) stepWater(0.05, true);
  for (let k = 0; k < 12; k++) stepMoist(0.25);
  for (const i of INS) {
    if (W.w[i] > 0.1) W.alg[i] = 0.25;
    else if (W.moist[i] > 0.35 && rnd() < 0.5) W.veg[i] = 0.3 + rnd() * 0.3;
    if (W.tseed[i] < 0.07 && W.veg[i] > 0.3 && W.g[i] < 13) W.tree[i] = 0.3 + rnd() * 0.7;
  }
  updateLight(); stepClimate(0, true);
  // いちばん大きな滝の向き（はじめに手前に見せる）
  let bb = 0; for (let b = 1; b < BINS; b++) if (W.mist[b] > W.mist[bb]) bb = b;
  W.bigFall = (bb + 0.5) / BINS * Math.PI * 2;
  W.fall.fill(0); W.mist.fill(0);
  if (bare) {
    W.springs = [];
    for (const i of INS) { W.abyss += W.w[i]; W.w[i] = 0; W.veg[i] = 0; W.tree[i] = 0; W.alg[i] = 0; W.moist[i] = 0; W.fL[i] = W.fR[i] = W.fU[i] = W.fD[i] = 0; }
    W.bigFall = Math.atan2(lk.y, lk.x);        // 湖のくぼみを手前に
    W.soil = 100;                               // はじめの土ぶくろ（v044 で 60 → 100。2026-10-14 ユーザー「土袋を 100 くらいに」）
  }
}

// 季節: 0〜1 の年の進み（はじめは春のなかごろ）、季節の番号、ふだんの気温、暖かさ（冬 0〜夏 1）
const seasonPhase = () => (0.1 + W.t / (DAY * YEAR)) % 1;
const seasonOf = (p = seasonPhase()) => Math.floor(p * 4) % 4;
const warmth = (p = seasonPhase()) => (1 + Math.cos(2 * Math.PI * (p - 0.375))) / 2;
// 冬のなかごろ 1 度（夜と山は凍る）、夏のなかごろ 27 度。冬の章（v011）より前は冬がおだやか（knob.winter が 0 なら冬も 8 度）
const baseTemp = (p = seasonPhase()) => 1 + 26 * warmth(p) + 7 * (1 - (W.knob ? W.knob.winter : 1)) * (1 - warmth(p));
// 太陽の道の半径（夏は内がわ、冬は外がわ）。月はいつも RS
const bodyR = b => b === W.sun ? W.rs : RS;

// 気温・雪どけ・氷（0.25 秒ごと）。now=true はすぐにその気温に
function stepClimate(dt, now) {
  const p = seasonPhase(), wm = warmth(p), Tb = baseTemp(p);
  W.rs = RD * (0.75 - 0.3 * wm); W.sunAmp = 0.78 + 0.22 * wm;
  const T = W.T, w = W.w, sn = W.snow, ice = W.ice;
  const k = now ? 1 : 1 - Math.exp(-dt / 8);
  let sum = 0;
  for (const i of INS) {
    const target = Tb + 9 * (W.light[i] - 0.5) - 0.55 * Math.max(0, W.g[i] - 4);
    T[i] += (target - T[i]) * k; sum += T[i];
    if (sn[i] > 0 && T[i] > 1) { const m = Math.min(sn[i], 0.004 * (T[i] - 1) * dt); sn[i] -= m; w[i] += m; }
    if (w[i] > 0.03 && T[i] < -1) ice[i] = 1; else if (T[i] > 0.5 || w[i] <= 0.03) ice[i] = 0;
  }
  W.Tavg = sum / INS.length;
}
const tempGrow = t => Math.max(0, Math.min(1, (t - 1) / 12)) * (t > 33 ? Math.max(0, 1 - (t - 33) / 8) : 1);   // 草が育つ気温

// 太陽が地の上に落とす所
const sunGround = () => ({ x: C + W.rs * Math.cos(W.sun.a), y: C + W.rs * Math.sin(W.sun.a) });
const moonGround = () => ({ x: C + RS * Math.cos(W.moon.a), y: C + RS * Math.sin(W.moon.a) });

function updateLight() {
  const s = sunGround(), ek = 1 - 0.72 * eclipseK();
  for (const i of INS) {
    const d = Math.hypot(i % N - s.x, (i / N | 0) - s.y);
    W.light[i] = Math.min(1, Math.max(0.06, (1.25 - d / (1.25 * RD)) * W.sunAmp * ek));
  }
}
// 太陽と月の遊び（v020。2026-10-13 ユーザー「太陽と月をつかった遊びを入れる」）
//   月と太陽の向きの差（-π〜π）。0 に近いと同じ側にそろう（潮はもとから月＋少し太陽なので、そろうと大きくなる＝大潮）
const sunMoonGap = () => Math.atan2(Math.sin(W.moon.a - W.sun.a), Math.cos(W.moon.a - W.sun.a));
// 日食: 月が太陽にぴったり重なると、昼が暗くなる（ほうっておいても半月に一度ほど。月をつかんで重ねることもできる）
const eclipseK = () => Math.max(0, 1 - Math.abs(sunMoonGap()) / 0.06);

// 潮: 月（と少し太陽）のほうへ水が寄る。ふちで ±0.9 ほど
let tcx = 0, tcy = 0;
function tideCoef() {
  const k = W.knob ? W.knob.tide : 1;   // はじめの章は潮がおだやか（v011）
  tcx = k * (0.9 * Math.cos(W.moon.a) + 0.35 * Math.cos(W.sun.a)) / RD;
  tcy = k * (0.9 * Math.sin(W.moon.a) + 0.35 * Math.sin(W.sun.a)) / RD;
}
const tideAt = i => tcx * (i % N - C) + tcy * ((i / N | 0) - C);

// 水（パイプのモデル）。prep=true は、はじめになじませるとき（滝の霧・数えを省く）
const K = 8;
// ふちの縁（2026-10-14 ユーザー「水がまだ端に着いていないように見えるのに滝が盛大に流れる」）:
//   ふちのマスの水は、この深さ（水を描くしきい値 0.06 と同じ）を超えた分だけ外へ落ちる。見えない薄い水は落ちない
const RIM_LIP = 0.06;
function stepWater(dt, prep) {
  const g = W.g, w = W.w, fL = W.fL, fR = W.fR, fU = W.fU, fD = W.fD;
  tideCoef();
  // 泉
  for (const s of W.springs) {
    if (!s.on) continue;
    const q = Math.min(W.abyss, 1.3 * dt);
    w[s.i] += q; W.abyss -= q;
  }
  // 出ていく流れ（P＝水面−潮。大地の外は、ふちの地面の高さ＋縁 RIM_LIP。縁より上の水だけ落ちる）
  const P = W.P || (W.P = new Float32Array(N * N));
  for (const i of INS) P[i] = g[i] + w[i] - tideAt(i);
  const kd = dt * K;
  for (const i of INS) {
    const wi = w[i];
    if (wi < 1e-4 || W.ice[i]) { fL[i] = fR[i] = fU[i] = fD[i] = 0; continue; }   // 凍った水は流れない
    const H = P[i], lip = H - wi + RIM_LIP;
    const fr = Math.max(0.2, 1 - dt * (0.35 + 0.12 / (wi + 0.04)));
    let l = fL[i] * fr + kd * (H - (inside[i - 1] ? P[i - 1] : lip)); if (l < 0) l = 0;
    let r = fR[i] * fr + kd * (H - (inside[i + 1] ? P[i + 1] : lip)); if (r < 0) r = 0;
    let u = fU[i] * fr + kd * (H - (inside[i - N] ? P[i - N] : lip)); if (u < 0) u = 0;
    let d = fD[i] * fr + kd * (H - (inside[i + N] ? P[i + N] : lip)); if (d < 0) d = 0;
    const sum = (l + r + u + d) * dt;
    if (sum > wi) { const k = wi / sum; l *= k; r *= k; u *= k; d *= k; }
    fL[i] = l; fR[i] = r; fU[i] = u; fD[i] = d;
  }
  // 深さを更新。ふちの外へ出た分は滝へ
  let out = 0;
  for (const i of INS) {
    const inL = inside[i - 1] ? fR[i - 1] : 0, inR = inside[i + 1] ? fL[i + 1] : 0;
    const inU = inside[i - N] ? fD[i - N] : 0, inD = inside[i + N] ? fU[i + N] : 0;
    w[i] += dt * (inL + inR + inU + inD - fL[i] - fR[i] - fU[i] - fD[i]);
    if (w[i] < 0) w[i] = 0;
    const b = edgeBin[i];
    if (b >= 0) {
      const o = dt * ((inside[i - 1] ? 0 : fL[i]) + (inside[i + 1] ? 0 : fR[i]) + (inside[i - N] ? 0 : fU[i]) + (inside[i + N] ? 0 : fD[i]));
      if (o > 0) { out += o; W.fallNow[b] += o; }
    }
  }
  // 落ちた水: 3割は霧になって雲へ、のこりは深淵へ
  if (prep) { W.abyss += out; for (let b = 0; b < BINS; b++) { W.mist[b] += W.fallNow[b]; W.fallNow[b] = 0; } return; }
  W.abyss += out * 0.7;             // 霧になる3割は stepSky で fallNow から雲へ
  W.outAcc = (W.outAcc || 0) + out;
}

// 蒸発（日の当たる水から）
function stepEvap(dt) {
  const w = W.w, L = W.light;
  for (const i of INS) {
    if (w[i] > 0.02 && L[i] > 0.5 && !W.ice[i]) {
      const e = Math.min(w[i], 0.006 * (L[i] - 0.5) * dt * 2);
      w[i] -= e; W.vapor += e;
    }
  }
}

// うるおい: 水のある所は 1、まわりへしみ出し、ないと乾く
function stepMoist(dt) {
  const m = W.moist, w = W.w;
  const keep = Math.pow(0.97, dt / 0.25);
  for (const i of INS) {
    if (w[i] > 0.03) { m[i] = 1; continue; }
    let nb = 0;
    if (inside[i - 1] && m[i - 1] > nb) nb = m[i - 1];
    if (inside[i + 1] && m[i + 1] > nb) nb = m[i + 1];
    if (inside[i - N] && m[i - N] > nb) nb = m[i - N];
    if (inside[i + N] && m[i + N] > nb) nb = m[i + N];
    m[i] = Math.max(m[i] * keep, nb * 0.86);
  }
}

// 草と水草
function stepPlants(dt) {
  const v = W.veg, a = W.alg, w = W.w, m = W.moist, L = W.light;
  const sw = W.sown, sp = 0.25 / SPROUT * dt;
  for (const i of INS) {
    if (sw[i] > 0) { const d = Math.min(sw[i], sp); sw[i] -= d; if (w[i] <= 0.35) v[i] = Math.min(1, v[i] + d); }   // まいたたねが芽ぶく（水の中では芽ぶかない）
    if (w[i] > 0.35) { v[i] = Math.max(0, v[i] - 0.25 * dt); }
    else {
      let nb = 0;
      if (inside[i - 1]) nb += v[i - 1]; if (inside[i + 1]) nb += v[i + 1];
      if (inside[i - N]) nb += v[i - N]; if (inside[i + N]) nb += v[i + N];
      const tg = tempGrow(W.T[i]);
      const grow = m[i] * L[i] * tg * (0.03 * v[i] * (1 - v[i]) + 0.0012 * nb);
      const wither = (m[i] < 0.12 ? 0.012 : 0) + (W.T[i] < -2 ? 0.0015 : 0);   // 乾くと、凍えると枯れる
      v[i] = Math.min(1, Math.max(0, v[i] + (grow - wither * v[i]) * dt));
    }
    if (W.tseed[i] < 0.07) {          // 木: 草が茂って乾いた所で育ち、草がなくなるか水につかると枯れる
      const tr = W.tree;
      if (v[i] > 0.6 && w[i] < 0.05 && W.g[i] < 13) tr[i] = Math.min(1, tr[i] + 0.004 * tempGrow(W.T[i]) * dt);
      else if (v[i] < 0.15 || w[i] > 0.3) tr[i] = Math.max(0, tr[i] - 0.02 * dt);
    }
    if (w[i] > 0.08) a[i] = Math.min(1, a[i] + (0.035 * L[i] * Math.max(0.15, tempGrow(W.T[i] + 4)) * (a[i] * (1 - a[i]) + 0.01)) * dt);   // 水の中は少し暖かい
    else a[i] = Math.max(0, a[i] - 0.3 * dt);
  }
}

// 雲
function spawnCloud(x, y, water) {
  if (W.clouds.length >= 24) {        // いっぱいなら近い雲に足す
    let best = null, bd = 1e9;
    for (const c of W.clouds) { const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = c; } }
    best.water += water; return;
  }
  W.clouds.push({ x, y, water, age: 0, seed: Math.random() * 100, rain: 0 });
}
function stepSky(dt) {
  // 霧（1秒ぶんずつ）
  W.mistT = (W.mistT || 0) + dt;
  if (W.mistT >= 1) {
    W.mistT -= 1;
    W.outRate = W.outRate * 0.6 + (W.outAcc || 0) * 0.4; W.outAcc = 0;
    for (let b = 0; b < BINS; b++) {
      W.fall[b] = W.fall[b] * 0.5 + W.fallNow[b] * 0.5;
      W.mist[b] += W.fallNow[b] * 0.3; W.fallNow[b] = 0;
      if (W.mist[b] > 8) {
        const an = (b + 0.5) / BINS * 2 * Math.PI;
        spawnCloud(C + Math.cos(an) * (RD - 2), C + Math.sin(an) * (RD - 2), W.mist[b]); W.mist[b] = 0; W.flags.mist = 1;
      }
    }
    if (W.vapor > 5) {             // 太陽の下あたりで雲になる
      const s = sunGround();
      spawnCloud(s.x + (Math.random() - 0.5) * 20, s.y + (Math.random() - 0.5) * 20, W.vapor); W.vapor = 0;
    }
  }
  // 雲は天といっしょに回り、少しずつ内へ。山に当たると雨
  const w = W.w, g = W.g, m = W.moist;
  let rain = 0;
  for (let k = W.clouds.length - 1; k >= 0; k--) {
    const c = W.clouds[k];
    c.age += dt;
    const dx = c.x - C, dy = c.y - C, r = Math.hypot(dx, dy) || 1;
    const om = 0.035;
    c.x += (-dy * om - dx / r * 0.25 + Math.sin(c.seed + c.age * 0.2) * 0.3) * dt;
    c.y += (dx * om - dy / r * 0.25 + Math.cos(c.seed * 1.3 + c.age * 0.17) * 0.3) * dt;
    const cx = Math.round(c.x), cy = Math.round(c.y), ci = cy * N + cx;
    const gh = inside[ci] ? g[ci] : 0;
    const rate = c.water * (0.025 + 0.08 * Math.max(0, Math.min(1, (gh - 6) / 5))) + (c.water > 30 ? 0.05 * c.water : 0);
    const q = Math.min(c.water, rate * dt);
    c.water -= q; c.rain = rate; rain += q;
    if (gh > 9 && q > 0.002) W.flags.mrain = 1;
    // 3×3 にふらせる（大地の外へふったら深淵へ）
    const per = q / 9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const j = (cy + oy * 2) * N + cx + ox * 2;
      if (cx + ox * 2 >= 0 && cx + ox * 2 < N && cy + oy * 2 >= 0 && cy + oy * 2 < N && inside[j]) { if (W.T[j] < 0) W.snow[j] += per; else w[j] += per; m[j] = 1; }   // 寒い所は雪
      else W.abyss += per;
    }
    if (c.water < 0.25) { W.abyss += c.water; W.clouds.splice(k, 1); }
  }
  W.rainRate = W.rainRate * 0.95 + rain / Math.max(dt, 1e-3) * 0.05;
}

// 天: 太陽と月
function stepHeavens(dt) {
  for (const b of [W.sun, W.moon]) if (!b.stop && !b.drag) b.a += b.v * dt;
}

// 盛る・削る（土ぶくろ）。amt>0 で盛る
function sculpt(cx, cy, amt, rad = 3.2) {
  let moved = 0;
  const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(N - 1, Math.ceil(cx + rad));
  const y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(N - 1, Math.ceil(cy + rad));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * N + x; if (!inside[i]) continue;
    const d = Math.hypot(x - cx, y - cy); if (d > rad) continue;
    const k = 0.5 + 0.5 * Math.cos(Math.PI * d / rad);
    let a = amt * k;
    if (a > 0) a = Math.min(a, W.soil - moved > 0 ? a : 0);
    else a = Math.max(a, -(W.g[i] - 0.3));
    if (a > 0 && W.g[i] > 22) a = 0;
    W.g[i] += a; moved += a;
    if (a > 0) W.veg[i] *= 0.7;
  }
  W.soil -= moved;
  if (W.soil < 0) W.soil = 0;
  return moved;
}

// たねをまく（v045 から、すぐ草にならず、まいた所が SPROUT 秒ほどで少しずつ芽ぶく。2026-10-14 ユーザー「少しだけ時間が立たないと草生えないように」）
const SPROUT = 6;                       // 草 0.25 まで芽ぶくのにかかる世界の秒（×1 で 6 秒）
// 手ざわりの粒（v056。2026-10-14 ユーザー「タネはもう少し上から」「泉も上から水滴」「土をけずる・盛るときも砂や土が散る」。v057 で盛るは土ぼこりに）:
//   粒は {x, y, h0（地面からの高さ）, vx, vy, vz, g, t0, col}。画面の時計で動く（止めていても動く）。地面に着いたら少しのあいだでうすれて消える。ボクセルの絵だけ（style-voxel.js）
const PFX = [];
const PCOL = { seed: ['#e8d48c', '#d8c070'], drop: ['#cfeaff', '#8fc4e2'], dig: ['#8a6238', '#a87a48', '#6e4c2a'], raise: ['#d2c6ae', '#b8aa90', '#e2d8c4'] };   // 盛る: 土ぼこり（土の上で見えるよう、うすい灰みの色）
function burst(kind, cx, cy, n, rad = 1.5) {
  if (PFX.length > 160) return;
  const now = performance.now(), cols = PCOL[kind];
  for (let k = 0; k < n; k++) {
    const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * rad, col = cols[k % cols.length];
    const p = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: 0, vy: 0, vz: 0, h0: 0, g: 16, t0: now + k * 35, col };
    if (kind === 'seed') { p.h0 = 6 + Math.random() * 1.5; }                                       // 上から（指にかくれないように。前は 3.2）
    else if (kind === 'drop') {                                                                      // 泉: 水のしずく。一つめは一回り大きな雫（重く、少し速く落ち、着くと小さくはねる。v058）
      p.h0 = 7 + Math.random() * 2; p.g = 20;
      if (k === 0) { p.x = cx; p.y = cy; p.h0 = 9; p.g = 30; p.big = 1; p.t0 = now + 60; p.col = '#8fc8ee'; }
    }
    else if (kind === 'raise') { const s = 1.6 + Math.random() * 1.6; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.vz = 0.8; p.h0 = 0.2; p.g = 2; p.t0 = now; }   // 盛る: 地面すれすれに土ぼこりが外へ広がる（v057。上から落とすとたねと見分けにくかった）
    else if (kind === 'dig') { const s = 1.5 + Math.random() * 2; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.vz = 4 + Math.random() * 3; p.h0 = 0.3; p.g = 22; p.t0 = now; }   // 削る: 土がはねる
    PFX.push(p);
  }
}
function sow(cx, cy, rad = 3) {
  let n = 0;
  for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
    const i = y * N + x; if (x < 0 || y < 0 || x >= N || y >= N || !inside[i]) continue;
    if (Math.hypot(x - cx, y - cy) > rad || W.w[i] > 0.3) continue;
    if (W.veg[i] + W.sown[i] < 0.25) { W.sown[i] = 0.25 - W.veg[i]; n++; }
  }
  if (n) burst('seed', cx, cy, 5, rad * 0.9);
  return n;
}

function addSpring(cx, cy) {
  const i = Math.round(cy) * N + Math.round(cx);
  if (!inside[i]) return 'no';
  for (let k = 0; k < W.springs.length; k++) {   // 近くの泉を押すと止める／わかす
    const s = W.springs[k];
    if (Math.hypot(s.i % N - cx, (s.i / N | 0) - cy) < 2.5) { s.on = !s.on; return s.on ? 'on' : 'off'; }
  }
  if (W.springs.length >= SPRING_MAX) return 'max';
  if (W.abyss < 1) return 'dry';
  W.springs.push({ i, on: true });
  return 'new';
}

function waterStats() {
  let land = 0, wet = 0, grass = 0, cells = 0, clouds = 0;
  for (const i of INS) { cells++; land += W.w[i] + W.snow[i]; if (W.w[i] > 0.05) wet++; else if (W.veg[i] > 0.22) grass++; }
  for (const c of W.clouds) clouds += c.water;
  return { land, clouds: clouds + W.vapor, abyss: W.abyss, wet: wet / cells, grass: grass / cells, out: W.outRate };
}

// 地形の高さ（なめらか）と、水面
function heightAt(x, y, withWater) {
  const xi = Math.max(0, Math.min(N - 2, Math.floor(x))), yi = Math.max(0, Math.min(N - 2, Math.floor(y)));
  const fx = Math.max(0, Math.min(1, x - xi)), fy = Math.max(0, Math.min(1, y - yi));
  const z = i => inside[i] ? W.g[i] + (withWater ? W.w[i] : 0) : 0;
  const i = yi * N + xi;
  return (z(i) * (1 - fx) + z(i + 1) * fx) * (1 - fy) + (z(i + N) * (1 - fx) + z(i + N + 1) * fx) * fy;
}

// 水の流れの速さ（区画/秒）
function flowAt(i) {
  const w = Math.max(W.w[i], 0.12);
  const vx = 0.5 * ((W.fR[i] - W.fL[i]) + ((inside[i - 1] ? W.fR[i - 1] : 0) - (inside[i + 1] ? W.fL[i + 1] : 0))) / w;
  const vy = 0.5 * ((W.fD[i] - W.fU[i]) + ((inside[i - N] ? W.fD[i - N] : 0) - (inside[i + N] ? W.fU[i + N] : 0))) / w;
  return { vx, vy };
}
