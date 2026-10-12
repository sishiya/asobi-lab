'use strict';
// 世界のしくみ（天動説の物理）。大地は真ん中で動かない。まわりを月・太陽・恒星の天球がめぐる。
// 大地を角度で N 区画に分け、区画ごとに地の高さ g と水の深さ h を持つ。
// 水は「自分の場所（地の上）」へ帰ろうとする。これを輪の上の浅水方程式で計算する（区画の境目に流れの速さ u）。
// 月と太陽は水を引きよせ、真下と反対がわがふくらむ（潮）。天球を回すと、ふくらみが大地の上を動く。

const TAU = Math.PI * 2;
const N = 360;                      // 区画の数（1区画＝1度）
const R0 = 230;                     // 大地の基準の半径（世界の単位）
const DX = TAU * R0 / N;            // 1区画の長さ
const GRAV = 1400;                  // 水を自分の場所へ帰す強さ（重力にあたる。ゲームの単位）
const CX = 500, CY = 500, WSIZE = 1000;
const GMIN = -70, GMAX = 90;        // 地の高さの限り
const SOIL_MAX = 600;               // 土ぶくろに入る量
const WET = 0.8;                    // この深さより深ければ「水の中」
const DAY = 24;                     // ふつうの速さで、太陽の天球が1回りする秒数＝1日

// 天球。period は1回りの秒数、tide は水を引きよせる強さ（潮のふくらみの高さ）
const SPHERES = [
  { key: 'moon',  name: '月の天球',   r: 348, period: 24.8,  tide: 5.0, a0: 1.1 },
  { key: 'sun',   name: '太陽の天球', r: 408, period: DAY,   tide: 2.3, a0: -1.2 },
  { key: 'stars', name: '恒星天',     r: 466, period: 23.93, tide: 0,   a0: 0 },
];

// はじめの地形（角度［度］, 高さ）。0度は右、90度は下、270度は上
const PROFILE = [
  [0, -52], [14, -46], [22, -12], [30, -3], [38, 4], [52, 24], [75, 36], [100, 30], [116, 12], [124, -2],
  [132, -40], [150, -56], [168, -40], [175, -6], [180, 6], [185, -6], [192, -40], [210, -54], [222, -14],
  [232, -4], [242, 2], [254, 12], [270, 30], [286, 24], [298, 6], [306, -30], [325, -56], [345, -58], [360, -52],
];

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const wrapA = a => ((a % TAU) + TAU) % TAU;
const idx = th => Math.floor(wrapA(th) / TAU * N) % N;
const cellAngle = i => (i + 0.5) * TAU / N;
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

function makeWorld(seed) {
  const rand = mulberry32(seed || 1);
  const Wd = {
    rand, t: 0,
    g: new Float32Array(N), h: new Float32Array(N), u: new Float32Array(N), F: new Float32Array(N),
    teq: new Float32Array(N), sc: new Float32Array(N),
    sea: new Float32Array(N), grass: new Float32Array(N),
    soil: 300, maxU: 0, waterVol: 0,
    sph: SPHERES.map(s => ({ ...s, a: s.a0, nat: TAU / s.period, v: TAU / s.period, held: false, push: 0 })),
  };
  // 地形: 点のあいだを cos でなめらかにつなぎ、少しだけでこぼこを足す
  for (let i = 0; i < N; i++) {
    const deg = (i + 0.5) * 360 / N;
    let k = 0; while (PROFILE[k + 1][0] < deg) k++;
    const [d0, h0] = PROFILE[k], [d1, h1] = PROFILE[k + 1];
    const f = (1 - Math.cos(Math.PI * (deg - d0) / (d1 - d0))) / 2;
    Wd.g[i] = h0 + (h1 - h0) * f + (rand() - 0.5) * 2;
  }
  // 水: 基準の高さ 0 まで満たす
  for (let i = 0; i < N; i++) {
    Wd.h[i] = Math.max(0, -Wd.g[i]);
    Wd.sea[i] = Wd.h[i] > WET ? 0.5 : 0;
    Wd.grass[i] = Wd.g[i] > -4 ? 1 : 0;
  }
  Wd.waterVol = Wd.h.reduce((a, b) => a + b, 0);
  return Wd;
}

// 天球: つかんでいないときは、ふつうの速さへゆっくりもどる（天球にも勢いがある）
function stepSpheres(Wd, dt) {
  for (const s of Wd.sph) {
    if (s.held) continue;
    if (s.push) s.v += s.push * dt;                       // キーで回している
    else s.v += (s.nat - s.v) * Math.min(1, dt * 0.6);
    s.v = Math.max(-12, Math.min(12, s.v));
    s.a = wrapA(s.a + s.v * dt);
  }
}

// 水: 浅水方程式を1歩すすめる（dt は 1/200 秒くらいまで）
const EPS = 0.02;
function stepWater(Wd, dt) {
  const { g, h, u, F, teq, sc } = Wd;
  const m = Wd.sph[0], s = Wd.sph[1];
  for (let i = 0; i < N; i++) {
    const th = cellAngle(i);
    teq[i] = m.tide * Math.cos(2 * (th - m.a)) + s.tide * Math.cos(2 * (th - s.a));
  }
  let maxU = 0;
  for (let i = 0; i < N; i++) {
    const j = i + 1 === N ? 0 : i + 1;
    const hi = h[i], hj = h[j];
    if (hi < EPS && hj < EPS) { u[i] = 0; F[i] = 0; continue; }
    let v = u[i] - GRAV * ((g[j] + hj - teq[j]) - (g[i] + hi - teq[i])) / DX * dt;
    const hf = Math.max(0.5 * (hi + hj), 0.6);
    v /= 1 + dt * (0.08 + 0.02 * Math.abs(v) / hf);       // 底とのまさつ（浅いほど強い）
    const up = v > 0 ? hi : hj;
    if (up < EPS) v = 0;
    if (v > 400) v = 400; else if (v < -400) v = -400;
    u[i] = v; F[i] = v * up;
    if (up > 1.5 && Math.abs(v) > maxU) maxU = Math.abs(v);
  }
  // 区画の水がマイナスにならないよう、出ていく量をしぼる
  for (let i = 0; i < N; i++) {
    const l = i === 0 ? N - 1 : i - 1;
    const out = (F[i] > 0 ? F[i] : 0) + (F[l] < 0 ? -F[l] : 0);
    const lim = h[i] * DX / dt;
    sc[i] = out > lim ? lim / out : 1;
  }
  for (let i = 0; i < N; i++) {
    const j = i + 1 === N ? 0 : i + 1;
    F[i] *= F[i] > 0 ? sc[i] : sc[j];
  }
  for (let i = 0; i < N; i++) {
    const l = i === 0 ? N - 1 : i - 1;
    h[i] += (F[l] - F[i]) * dt / DX;
    if (h[i] < 0) h[i] = 0;
  }
  Wd.maxU = Math.max(Wd.maxU * (1 - dt * 2), maxU);
}

// 区画の水の流れの速さ（両がわの境目の平均）
function flowAt(Wd, i) { const l = i === 0 ? N - 1 : i - 1; return 0.5 * (Wd.u[i] + Wd.u[l]); }

// 食べもの: 海の小さな生き物（sea）と、浜と陸の草（grass）
function stepFood(Wd, dt) {
  const { g, h, sea, grass } = Wd;
  for (let i = 0; i < N; i++) {
    if (h[i] > WET) sea[i] += 0.07 * (0.6 * Math.min(h[i] / 15, 1) - sea[i]) * dt;
    else sea[i] *= 1 - Math.min(1, 0.5 * dt);
    if (g[i] > -6 && h[i] < 6) grass[i] += 0.1 * (1.5 - grass[i]) * dt;
    else grass[i] *= 1 - Math.min(1, 0.05 * dt);
  }
}

// 地をなぞる: amt > 0 で盛る（土ぶくろから）、< 0 で削る（土ぶくろへ）。水の量は変えない
function sculpt(Wd, th, amt) {
  const c = idx(th);
  for (let k = -4; k <= 4; k++) {
    const i = (c + k + N) % N;
    let d = amt * Math.exp(-k * k / 6);
    if (d > 0) d = Math.min(d, Wd.soil, GMAX - Wd.g[i]);
    else d = Math.max(d, -(Wd.g[i] - GMIN), -(SOIL_MAX - Wd.soil));
    if (d > 0 === amt > 0) { Wd.g[i] += d; Wd.soil -= d; }
  }
}

// 潮の大きさ: 月と太陽が重なるか反対だと大潮（1）、直角だと小潮（0）
function springness(Wd) { return Math.abs(Math.cos(angDiff(Wd.sph[0].a, Wd.sph[1].a))); }

function stepWorld(Wd, dt) {
  const n = Math.max(1, Math.ceil(dt / 0.005)), d = dt / n;
  for (let k = 0; k < n; k++) { stepSpheres(Wd, d); stepWater(Wd, d); }
  stepFood(Wd, dt);
  Wd.t += dt;
}
