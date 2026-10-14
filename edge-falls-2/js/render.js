'use strict';
// 絵の土台（v002）: 見え方 V・投影・画面→大地・区画の色・なめらかな地形の描き方・岩の根。
//   画風は style-voxel.js（ボクセル）・style-paint.js（絵画）・style-etch.js（銅版画）。STYLES から選ぶ。
//   どの画風も、地形はまず低い解像度の画素の板 buf（ImageData d32）に描き、それを画面に広げる。
//   dep は画素ごとの「手前からの近さ v」（生き物や木が山のかげに隠れるかを見る）。

const V = { yaw: -0.5, tilt: 0.56, zoom: 1, cw: 0, ch: 0, s: 8, cx: 0, cy: 0, hf: 0.4, bs: 2 };
const THICK = 8;          // 大地の厚み（ふちの断面）
const ROOT_D = 90;        // 岩の根の深さ（傾けて見ても、ふちのかげから先が出るように深く）
const NN = N * N;
const Zs = new Float32Array(NN), Zq = new Float32Array(NN);       // 地＋水の高さ（なめらか／ボクセル用にそろえたもの）
const TR = new Float32Array(NN), TG = new Float32Array(NN), TB = new Float32Array(NN);   // 上の面の色
const SR = new Float32Array(NN), SG = new Float32Array(NN), SB = new Float32Array(NN);   // 横の面（土）の色
const LUM = new Float32Array(NN);                                  // 明るさ（昼夜・雲のかげ）
const HASH = new Float32Array(NN).map((_, i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); });
const hash2 = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
// 大地の外の区画は、いちばん近いふちの区画の値を使う
const NEAR = new Int32Array(NN).fill(-1);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const i = y * N + x;
  if (inside[i]) { NEAR[i] = i; continue; }
  const r = Math.hypot(x - C, y - C), k = (RD - 0.7) / r;
  const j = Math.round(C + (y - C) * k) * N + Math.round(C + (x - C) * k);
  NEAR[i] = inside[j] ? j : -1;
}

const STYLES = {};
let styleName = 'voxel';
// 本命はボクセル（2026-10-12 ユーザー）。2026-10-13 ユーザー「ルックをかえる実験をしたい」→ 遊ぶ所の左上の
//   「ルック」で切りかえ（ボクセル・銅版画・リアル・サイバー・絵画）。v017 で画面の切りかえはやめて、ボクセルだけ
//   （2026-10-13 ユーザー「てびきの設定項目は消す」）。ほかの画風は ?style= で見られる（試し用。覚えない）
try { styleName = new URLSearchParams(location.search).get('style') || 'voxel'; } catch (e) { /* なし */ }
const style = () => STYLES[styleName] || STYLES.voxel;
function setStyle(n) {
  if (!STYLES[n]) return;
  styleName = n;
  buf = null; layout(V.cw, V.ch);
}

let buf = null, bctx = null, img = null, d32 = null, dep = null;

function layout(cw, ch) {
  V.cw = cw; V.ch = ch;
  const el = Math.asin(V.tilt);
  V.hf = Math.cos(el) * 0.5;
  const fitW = cw * (ch > cw * 1.3 ? 1.0 : 0.9) / (2 * RD), fitH = ch * 0.84 / (2 * RD * V.tilt + (16 + THICK + 12) * V.hf);   // スマホの縦長は少し大きく
  V.s = Math.min(fitW, fitH) * V.zoom;
  // 平行移動（panX・panY は画面の画素。大きくずれすぎないように）
  const pm = 0.9 * Math.max(1, V.zoom);   // 寄っているときは、大地のはしまで動かせるように
  V.panX = Math.max(-cw * pm, Math.min(cw * pm, V.panX || 0)); V.panY = Math.max(-ch * pm, Math.min(ch * pm, V.panY || 0));
  V.cx = cw / 2 + V.panX; V.cy = ch * 0.5 - (THICK + 4) * V.s * V.hf * 0.6 + (16 * V.s * V.hf) * 0.25 + Math.min(36, ch * 0.04) + V.panY;   // 上のお題の文字にかからないよう少し下げる
  V.bs = style().bs(cw);
  const BW = Math.max(1, Math.ceil(cw / V.bs)), BH = Math.max(1, Math.ceil(ch / V.bs));
  if (!buf || buf.width !== BW || buf.height !== BH) {
    buf = document.createElement('canvas'); buf.width = BW; buf.height = BH;
    bctx = buf.getContext('2d'); img = bctx.createImageData(BW, BH); d32 = new Uint32Array(img.data.buffer);
    dep = new Float32Array(BW * BH);
  }
  V.dirty = true;
}

function proj(x, y, z) {
  const dx = x - C, dy = y - C, c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  const u = dx * c - dy * s, v = dx * s + dy * c;
  return { x: V.cx + u * V.s, y: V.cy + v * V.s * V.tilt - z * V.s * V.hf, v };
}
// 板（buf）の座標で
function pb(x, y, z) { const p = proj(x, y, z); p.x /= V.bs; p.y /= V.bs; return p; }

// 見えている面の高さ（ボクセルはそろえた高さ、ほかはなめらか）
function surfAt(x, y) {
  if (style().quant) { const i = NEAR[Math.round(y) * N + Math.round(x)]; return i >= 0 ? Zq[i] : 0; }
  const xi = Math.max(0, Math.min(N - 2, Math.floor(x))), yi = Math.max(0, Math.min(N - 2, Math.floor(y)));
  const fx = x - xi, fy = y - yi, i = yi * N + xi;
  return (Zs[i] * (1 - fx) + Zs[i + 1] * fx) * (1 - fy) + (Zs[i + N] * (1 - fx) + Zs[i + N + 1] * fx) * fy;
}

// 画面の点 → 大地の点（見えている面）。なければ null
function pick(sx, sy) {
  const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  const u = (sx - V.cx) / V.s;
  if (Math.abs(u) >= RD) return null;
  const ve = Math.sqrt(RD * RD - u * u) - 0.5;
  for (let v = ve; v >= -ve; v -= 0.2) {
    const wx = C + u * c + v * s, wy = C - u * s + v * c;
    const z = surfAt(wx, wy);
    const y = V.cy + v * V.s * V.tilt - z * V.s * V.hf;
    if (y <= sy) {
      if (v === ve && sy > y + THICK * V.s * V.hf) return null;
      return { x: wx, y: wy, z };
    }
  }
  return null;
}

const mix = (a, b, t) => a + (b - a) * t;
const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
const rgba = (r, g, b) => (255 << 24) | ((clamp255(b) & 255) << 16) | ((clamp255(g) & 255) << 8) | (clamp255(r) & 255);
function blend(k, r, g, b, a) {           // d32[k] に色を重ねる
  const o = d32[k];
  if (!(o >>> 24)) { d32[k] = (((a * 255) & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255); return; }
  const or = o & 255, og = (o >> 8) & 255, ob = (o >> 16) & 255, oa = o >>> 24;
  d32[k] = (Math.max(oa, (a * 255) | 0) << 24) | ((ob + (b - ob) * a) << 16) | ((og + (g - og) * a) << 8) | (or + (r - or) * a);
}

// 区画の色（土台の自然な色。画風ごとにこれを使って塗り分ける）
const shadeCloud = new Float32Array(NN);
const NB4 = [-1, 1, -N, N];
function cellColors() {
  const g = W.g, w = W.w, veg = W.veg, alg = W.alg, m = W.moist, Lt = W.light;
  for (const i of INS) {
    Zs[i] = g[i] + w[i];
    const gq = Math.round(g[i]);
    Zq[i] = w[i] > 0.06 ? Math.max(gq, Math.round((g[i] + w[i]) * 2) / 2) : gq;
  }
  // 雲のかげ（太陽と反対へ少しずらす）
  shadeCloud.fill(1);
  const sx = Math.cos(W.sun.a), sy = Math.sin(W.sun.a);
  for (const cl of W.clouds) {
    const r = 2 + Math.sqrt(cl.water) * 0.55, cx = cl.x - sx * 4, cy = cl.y - sy * 4, k = Math.min(1, cl.water / 4);
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(N - 1, cy + r); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(N - 1, cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) shadeCloud[y * N + x] *= 1 - 0.18 * k;
  }
  // 季節の色の強さ（秋・冬）
  const sp = seasonPhase(), cdist = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };
  const aut = Math.max(0, 1 - cdist(sp, 0.66) / 0.14), win = Math.max(0, 1 - cdist(sp, 0.9) / 0.16);
  // v023: iPhone の Safari で、開いて少したつと地面の色が紫・緑・黄色・黒にくずれた（土の式のところだけ。岩・砂・岩の根は正しい）。
  //   入れ子の mix（mix の中に mix）と、同じ名前の const（t・k・sp）がブロックごとに並ぶ所を、Safari の JavaScript が
  //   くり返して速い形に作り直したあとに取りちがえているのでは、と見て、ループの中は入れ子の関数を使わず、名前も一つずつにした。
  //   計算の中身は v019 と同じ（PC の Chrome で v019 と同じ色になることを数で確かめた）。v019・v010 の版でも iPhone でくずれていた（v010 は一瞬だけ）。
  //   v011 から、はじめの大地が岩と土だけ（草なし）になり、土の式ばかり通るようになって目立ったのでは、と見ている。ここを直すときは、入れ子の mix・同じ名前の const を足さない
  let r = 0, gg = 0, b = 0, slope = 0, ao = 0, kRock = 0, kSoil = 0, kWet = 0, kVeg = 0, kAut = 0, kWin = 0, kWd = 0, kAlg = 0, kFoam = 0, kMix = 0, kSnow = 0, flow = 0;
  let r0 = 0, g0 = 0, b0 = 0, r1 = 0, g1 = 0, b1 = 0, wr = 0, wg = 0, wb = 0, tone = 1, shore = false, sh = 1;
  for (let n = 0; n < INS.length; n++) {
    const i = INS[n], h = g[i], jit = 0.95 + HASH[i] * 0.1;
    slope = 0;
    for (let q = 0; q < 4; q++) { const j = i + NB4[q]; if (inside[j]) { const dz = Math.abs(Zs[j] - Zs[i]); if (dz > slope) slope = dz; } }
    // 土・岩・雪（横の面にも使う）
    if (h >= 13.5) { r = 236; gg = 238; b = 244; }
    else if (slope > 1.6 || h > 10.5) { kRock = Math.min(1, Math.max(0, (h - 8) / 5)); r = 132 + 18 * kRock; gg = 118 + 24 * kRock; b = 104 + 34 * kRock; }
    else if (h < 3.2 || (m[i] > 0.95 && h < 5)) { r = 218; gg = 198; b = 146; }
    else {                                    // 土: 乾いた所は黄土色、しめった所はこげ茶
      kSoil = Math.min(1, Math.max(0, (h - 3) / 8)); kWet = Math.min(1, Math.max(0, m[i] * 1.4));
      r0 = 206 - 28 * kSoil; g0 = 178 - 26 * kSoil; b0 = 118 - 8 * kSoil;   // 乾いた土
      r1 = 150 - 26 * kSoil; g1 = 110 - 16 * kSoil; b1 = 72 - 2 * kSoil;    // しめった土
      r = r0 + (r1 - r0) * kWet; gg = g0 + (g1 - g0) * kWet; b = b0 + (b1 - b0) * kWet;
    }
    r *= jit; gg *= jit; b *= jit;
    SR[i] = r * 0.82; SG[i] = gg * 0.8; SB[i] = b * 0.78;
    // 草・花
    const v = veg[i];
    if (v > 0.03 && h < 13.5 && slope < 2.5) {
      // 芽ばえを黄みにする色（v020・v024）は、ユーザーの「やっぱり以前の色に」でやめた（v026）
      tone = HASH[i] > 0.5 ? 1 : 0.9; kVeg = Math.min(1, v * 1.4);
      r0 = (150 - 84 * v) * tone; g0 = (188 - 56 * v) * tone; b0 = (84 - 32 * v) * tone;
      r += (r0 - r) * kVeg; gg += (g0 - gg) * kVeg; b += (b0 - b) * kVeg;
      // 花（v2: 肥えた土には多い）
      if (v > 0.5 && HASH[i] > (W.fert && W.fert[i] > 1.15 ? 0.94 : 0.972) && win < 0.3) { if (HASH[i] > 0.986) { r = 246; gg = 222; b = 92; } else { r = 240; gg = 236; b = 236; } }
      if (aut > 0) { kAut = aut * 0.55 * kVeg; r += (196 - r) * kAut; gg += (158 - gg) * kAut; b += (70 - b) * kAut; }   // 秋は黄色く
      if (win > 0) { kWin = win * 0.5 * kVeg; r += (164 - r) * kWin; gg += (150 - gg) * kWin; b += (108 - b) * kWin; }   // 冬は枯れ草色
    }
    // 畑（v2。ヒト）: うねの筋（となりの列と明暗）。若いうちは緑、実ると黄金色
    if (W.farm && W.farm[i] > 0 && w[i] <= 0.06) {
      const fr = W.farm[i], ripe = Math.max(0, (fr - 0.5) * 2), stripe = ((i / N | 0) + (i % N)) % 2 ? 0.86 : 1;
      r0 = 124 + 90 * ripe; g0 = 92 + 60 * Math.min(1, fr * 2) + 40 * ripe - 30 * ripe; b0 = 58 + 10 * ripe;
      r = r0 * stripe; gg = (g0 + 30 * Math.min(1, fr * 2) * (1 - ripe)) * stripe; b = b0 * stripe;
    }
    // 水
    const wd = w[i];
    if (wd > 0.06) {
      kWd = Math.min(1, wd / 3);
      wr = 92 - 70 * kWd; wg = 186 - 108 * kWd; wb = 204 - 66 * kWd;
      kAlg = alg[i] * 0.5; wr += (64 - wr) * kAlg; wg += (140 - wg) * kAlg; wb += (96 - wb) * kAlg;
      flow = (W.fL[i] + W.fR[i] + W.fU[i] + W.fD[i]) / (wd + 0.15);
      shore = false;
      for (let q = 0; q < 4; q++) { const j = i + NB4[q]; if (inside[j] && w[j] <= 0.06) shore = true; }
      kFoam = Math.min(0.6, Math.max(0, flow - 2.2) * 0.13) + (shore ? 0.22 : 0);
      wr += (236 - wr) * kFoam; wg += (246 - wg) * kFoam; wb += (250 - wb) * kFoam;
      kMix = Math.min(1, (wd - 0.06) / 0.2);
      r += (wr - r) * kMix; gg += (wg - gg) * kMix; b += (wb - b) * kMix;
      SR[i] = wr * 0.7; SG[i] = wg * 0.75; SB[i] = wb * 0.85;
    }
    // 氷・雪・霜
    if (W.ice[i]) { r += (206 - r) * 0.8; gg += (228 - gg) * 0.8; b += (242 - b) * 0.8; SR[i] = 170; SG[i] = 196; SB[i] = 214; }
    const snw = W.snow[i];
    if (snw > 0.01) { kSnow = Math.min(1, snw * 5); r += (242 - r) * kSnow; gg += (246 - gg) * kSnow; b += (252 - b) * kSnow; }
    else if (W.T[i] < 0 && wd <= 0.06) { r += (220 - r) * 0.25; gg += (226 - gg) * 0.25; b += (236 - b) * 0.25; }
    else if (W.T[i] > 30 && wd <= 0.06) {                                 // 暑すぎる所: 日にやけて白っぽく乾き、ひびが入る（v2。止めた太陽の下）
      kWd = Math.min(0.55, (W.T[i] - 30) * 0.07); r += (232 - r) * kWd; gg += (214 - gg) * kWd; b += (168 - b) * kWd;
      if (W.T[i] > 33 && HASH[i] > 0.7) { r *= 0.8; gg *= 0.78; b *= 0.74; }
    }
    // くぼみの影（まわりが高いほど暗い）
    ao = 0;
    for (let q = 0; q < 4; q++) { const j = i + NB4[q]; if (inside[j] && Zq[j] > Zq[i]) ao++; }
    sh = 1 - 0.06 * ao;
    TR[i] = r * sh; TG[i] = gg * sh; TB[i] = b * sh;
    LUM[i] = (0.3 + 0.7 * Lt[i]) * shadeCloud[i];
  }
  for (let i = 0; i < NN; i++) if (!inside[i]) {
    const j = NEAR[i];
    if (j >= 0) { Zs[i] = Zs[j]; Zq[i] = Zq[j]; TR[i] = TR[j]; TG[i] = TG[j]; TB[i] = TB[j]; SR[i] = SR[j]; SG[i] = SG[j]; SB[i] = SB[j]; LUM[i] = LUM[j]; }
    else { Zs[i] = Zq[i] = 0; }
  }
}
// 昼夜の色: 夜は青く暗く
function lit(r, g, b, L, out) { out[0] = r * L * 0.95; out[1] = g * L * 0.98; out[2] = b * Math.min(1, L + 0.14); return out; }

// なめらかな地形（絵画・銅版画）。rimColor(row,dz,u)→ふちの断面の色、rootColor(t,row,u,d)→岩の根の色
const TMP = [0, 0, 0];
function renderSmooth(rimColor, rootColor) {
  const BW = buf.width, BH = buf.height;
  d32.fill(0); dep.fill(-1e9);
  const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  const sb = V.s / V.bs, cxb = V.cx / V.bs, cyb = V.cy / V.bs, hb = V.s * V.hf / V.bs, tl = V.tilt;
  const dv = 1 / (sb * tl);
  const lx = Math.cos(W.sun.a), ly = Math.sin(W.sun.a);
  for (let px = 0; px < BW; px++) {
    const u = (px + 0.5 - cxb) / sb;
    if (Math.abs(u) >= RD - 0.6) continue;
    const ve = Math.sqrt((RD - 0.6) ** 2 - u * u);
    const ybot = Math.min(BH, Math.ceil(cyb + ve * sb * tl + THICK * hb));
    renderRoot(px, u, ybot, false, rootColor);
    let ybuf = ybot, first = true;
    for (let v = ve; v >= -ve && ybuf > 0; v -= dv) {
      const wx = C + u * c + v * s, wy = C - u * s + v * c;
      const xi = wx | 0, yi = wy | 0, fx = wx - xi, fy = wy - yi, i = yi * N + xi;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const z = Zs[i] * w00 + Zs[i + 1] * w10 + Zs[i + N] * w01 + Zs[i + N + 1] * w11;
      const y = cyb + v * sb * tl - z * hb;
      let yt = Math.floor(y);
      if (yt < ybuf) {
        // 日の向きの坂は明るく
        const gx = (Zs[i + 1] - Zs[i]) * (1 - fy) + (Zs[i + N + 1] - Zs[i + N]) * fy;
        const gy = (Zs[i + N] - Zs[i]) * (1 - fx) + (Zs[i + N + 1] - Zs[i + 1]) * fx;
        const sh = Math.max(0.6, Math.min(1.35, 1 - 0.3 * (gx * lx + gy * ly)));
        const bil = A => A[i] * w00 + A[i + 1] * w10 + A[i + N] * w01 + A[i + N + 1] * w11;
        lit(bil(TR), bil(TG), bil(TB), bil(LUM) * sh, TMP);
        const top = rgba(TMP[0], TMP[1], TMP[2]);
        if (yt < 0) yt = 0;
        if (first) {
          d32[yt * BW + px] = top; dep[yt * BW + px] = v;
          for (let row = yt + 1; row < ybuf; row++) { d32[row * BW + px] = rimColor(row, (row - y) / hb, u); dep[row * BW + px] = v + 0.5; }
        } else {
          const k = ybuf - yt > 2 ? 0.72 : 1;
          const face = rgba(TMP[0] * k, TMP[1] * k, TMP[2] * k);
          d32[yt * BW + px] = top; dep[yt * BW + px] = v;
          for (let row = yt + 1; row < ybuf; row++) { d32[row * BW + px] = face; dep[row * BW + px] = v; }
        }
        ybuf = yt;
      }
      first = false;
    }
  }
}

// なめらかな地形を、画素ごとに色を決めて描く（リアル・サイバー）。
//   top(o) → rgba。o は {i, fx, fy, wx, wy, z, gx, gy, v, px, row}（使い回すので覚えておかない）。
//   段の面は top の色を face 倍に暗くする。描いたあと SURF に画素ごとの世界の点（x,y,z）が残る。
const SO = { i: 0, fx: 0, fy: 0, wx: 0, wy: 0, z: 0, gx: 0, gy: 0, v: 0, px: 0, row: 0 };
let SURF = null;
function renderSurface(rimColor, rootColor, top, face = 0.72) {
  const BW = buf.width, BH = buf.height;
  d32.fill(0); dep.fill(-1e9);
  if (!SURF || SURF.length !== BW * BH * 3) SURF = new Float32Array(BW * BH * 3);
  const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  const sb = V.s / V.bs, cxb = V.cx / V.bs, cyb = V.cy / V.bs, hb = V.s * V.hf / V.bs, tl = V.tilt;
  const dv = 1 / (sb * tl);
  for (let px = 0; px < BW; px++) {
    const u = (px + 0.5 - cxb) / sb;
    if (Math.abs(u) >= RD - 0.6) continue;
    const ve = Math.sqrt((RD - 0.6) ** 2 - u * u);
    const ybot = Math.min(BH, Math.ceil(cyb + ve * sb * tl + THICK * hb));
    renderRoot(px, u, ybot, false, rootColor);
    let ybuf = ybot, first = true;
    for (let v = ve; v >= -ve && ybuf > 0; v -= dv) {
      const wx = C + u * c + v * s, wy = C - u * s + v * c;
      const xi = wx | 0, yi = wy | 0, fx = wx - xi, fy = wy - yi, i = yi * N + xi;
      const z = (Zs[i] * (1 - fx) + Zs[i + 1] * fx) * (1 - fy) + (Zs[i + N] * (1 - fx) + Zs[i + N + 1] * fx) * fy;
      const y = cyb + v * sb * tl - z * hb;
      let yt = Math.floor(y);
      if (yt < ybuf) {
        SO.i = i; SO.fx = fx; SO.fy = fy; SO.wx = wx; SO.wy = wy; SO.z = z; SO.v = v; SO.px = px;
        SO.gx = (Zs[i + 1] - Zs[i]) * (1 - fy) + (Zs[i + N + 1] - Zs[i + N]) * fy;
        SO.gy = (Zs[i + N] - Zs[i]) * (1 - fx) + (Zs[i + N + 1] - Zs[i + 1]) * fx;
        if (yt < 0) yt = 0;
        SO.row = yt;
        const col = top(SO);
        const k0 = yt * BW + px;
        d32[k0] = col; dep[k0] = v; SURF[k0 * 3] = wx; SURF[k0 * 3 + 1] = wy; SURF[k0 * 3 + 2] = z;
        if (first) {
          for (let row = yt + 1; row < ybuf; row++) { d32[row * BW + px] = rimColor(row, (row - y) / hb, u, i); dep[row * BW + px] = v + 0.5; }
        } else {
          const k = ybuf - yt > 2 ? face : 1;
          const fc = k === 1 ? col : rgba((col & 255) * k, ((col >> 8) & 255) * k, ((col >> 16) & 255) * k);
          for (let row = yt + 1; row < ybuf; row++) { const kk = row * BW + px; d32[kk] = fc; dep[kk] = v; SURF[kk * 3] = wx; SURF[kk * 3 + 1] = wy; SURF[kk * 3 + 2] = z - (row - yt) / hb; }
        }
        ybuf = yt;
      }
      first = false;
    }
  }
}

// 模様（0〜1、くり返す）: 雲海の雲（128）と、地の細かな模様（256）
let CLOUDTEX = null, DETAIL = null;
function valueNoise(S, cell0, oct, seed) {
  const out = new Float32Array(S * S);
  for (let o = 0, amp = 0.55, cell = cell0; o < oct; o++, amp *= 0.5, cell /= 2) {
    const G = S / cell, lat = Array.from({ length: G * G }, (_, k) => hash2(k + o * 999 + seed, 17));
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const gx = x / cell, gy = y / cell, xi = Math.floor(gx), yi = Math.floor(gy), fx = gx - xi, fy = gy - yi;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const v = (k1, k2) => lat[((k2 % G) * G) + (k1 % G)];
      const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
      out[y * S + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
    }
  }
  return out;
}
const cloudTex = () => CLOUDTEX || (CLOUDTEX = valueNoise(128, 32, 4, 0));
const detailTex = () => DETAIL || (DETAIL = valueNoise(256, 32, 5, 4242));
const DTX = { t: null };
const detailAt = (x, y) => (DTX.t || (DTX.t = detailTex()))[(((y * 9) & 255) << 8) | ((x * 9) & 255)];

// 遠景のドーム（背景）: 地平線より上は sky(o)、下は below(o)（below が null なら下も sky で、alt は負）。
//   o = {alt, sg（太陽の向きの近さ）, dist（下の平面までの遠さ）, wx, wy（下の平面の点）, n（雲の模様）, x, y, dAz, az}
//   F 画素を1つにした粗さで描き、なめらかに広げる。星は star(星, t) が色を返す。
//   空の向き→画面の点に使う値 {yh, ppr, cx, look, F} を返す（月や惑星を ctx に描くとき）。
const DO = { alt: 0, sg: 0, dist: 0, wx: 0, wy: 0, n: 0, x: 0, y: 0, dAz: 0, az: 0 };
const STARS_D = Array.from({ length: 420 }, (_, k) => ({ az: hash2(k, 1) * Math.PI * 2, alt: Math.asin(hash2(k, 2) * 2 - 1) * 0.95, m: hash2(k, 3) }));
let dome = null;
const wrapAng = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
function domePoint(g, az, alt) { return { x: (g.cx + wrapAng(az - g.look) * g.ppr) * g.F, y: (g.yh - alt * g.ppr) * g.F, r: g.ppr * g.F }; }
function drawDome(ctx, t, F, sky, below, star) {
  const W2 = Math.ceil(V.cw / F), H2 = Math.ceil(V.ch / F);
  if (!dome || dome.c.width !== W2 || dome.c.height !== H2) {
    const c = document.createElement('canvas'); c.width = W2; c.height = H2;
    const x = c.getContext('2d'), im = x.createImageData(W2, H2);
    dome = { c, x, im, d: new Uint32Array(im.data.buffer) };
  }
  const ctex = cloudTex();
  const ppr = V.cw / 1.25 / F;
  const el = Math.asin(V.tilt), yh = (V.cy - V.panY) / F - el * ppr * 0.9 + V.panY / F * 0.15;
  const cx = V.cw / 2 / F, look = -Math.PI / 2 - V.yaw, cl = Math.cos(look), sl = Math.sin(look);
  const sunD = wrapAng(W.sun.a - look), drift = t * 0.015, d = dome.d;
  for (let y = 0; y < H2; y++) {
    const isBelow = below && y >= yh;
    const beta = isBelow ? (y - yh) / ppr + 0.006 : 0, dist = isBelow ? 1 / Math.tan(beta) : 0;
    DO.alt = (yh - y) / ppr; DO.dist = dist; DO.y = y;
    for (let x = 0; x < W2; x++) {
      const dAz = (x - cx) / ppr, da = wrapAng(dAz - sunD);
      DO.sg = Math.exp(-da * da * 1.6); DO.x = x; DO.dAz = dAz; DO.az = look + dAz;
      if (!isBelow) d[y * W2 + x] = sky(DO);
      else {
        const lw = dAz * dist;
        DO.wx = dist * cl - lw * sl; DO.wy = dist * sl + lw * cl;
        DO.n = ctex[((Math.floor((DO.wy * 0.55) * 32) & 127) << 7) | (Math.floor((DO.wx * 0.55 + drift) * 32) & 127)];
        d[y * W2 + x] = below(DO);
      }
    }
  }
  if (star) for (const st of STARS_D) {
    const x = Math.round(cx + wrapAng(st.az - look) * ppr), y = Math.round(yh - st.alt * ppr);
    if (x < 0 || x >= W2 || y < 0 || y >= H2 || (below && (st.alt < 0.02 || y >= yh))) continue;
    const c = star(st, t); if (c) d[y * W2 + x] = c;
  }
  dome.x.putImageData(dome.im, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(dome.c, 0, 0, W2 * F, H2 * F);
  return { yh, ppr, cx, look, F };
}

// 山のかげ（区画ごと。太陽へ向かって地形をたどる）。重いので 0.4 秒ごと
const SHADOW = new Float32Array(NN).fill(1);
let shT = -1;
function updateShadow(t) {
  if (shT >= 0 && t - shT < 0.4) return; shT = t;
  const sR = bodyR(W.sun), sx = C + sR * Math.cos(W.sun.a), sy = C + sR * Math.sin(W.sun.a);
  for (const i of INS) {
    const x0 = i % N, y0 = i / N | 0, z0 = Zs[i] + 0.3;
    const dx = sx - x0, dy = sy - y0, len = Math.hypot(dx, dy);
    if (len < 1) { SHADOW[i] = 1; continue; }
    const ux = dx / len, uy = dy / len, slope = (HS - z0) / len;
    let lt = 1;
    for (let d = 1.5; d < 26 && d < len; d += 1.5) {
      const x = Math.round(x0 + ux * d), y = Math.round(y0 + uy * d);
      if (x < 0 || y < 0 || x >= N || y >= N) break;
      const j = y * N + x; if (!inside[j]) break;
      const over = Zs[j] - (z0 + slope * d);
      if (over > 0) { lt = Math.min(lt, Math.max(0, 1 - over * 0.8)); if (lt <= 0) break; }
    }
    SHADOW[i] = SHADOW[i] * 0.3 + lt * 0.7;
  }
  for (let i = 0; i < NN; i++) if (!inside[i]) { const j = NEAR[i]; SHADOW[i] = j >= 0 ? SHADOW[j] : 1; }
}
const bilin = (A, i, fx, fy) => (A[i] * (1 - fx) + A[i + 1] * fx) * (1 - fy) + (A[i + N] * (1 - fx) + A[i + N + 1] * fx) * fy;

// 岩の根（大地の下の、先のとがった岩）。quant=true はボクセルの段々
function renderRoot(px, u, ybot, quant, rootColor) {
  const BW = buf.width, BH = buf.height;
  const sb = V.s / V.bs, cyb = V.cy / V.bs, hb = V.s * V.hf / V.bs, tl = V.tilt;
  let prev = ybot;
  const step = quant ? 2 : 1;
  // でこぼこは世界の向き（ふちの角度）で決める。回すと岩の根もいっしょに回って見える
  const c = Math.cos(V.yaw), s = Math.sin(V.yaw), vf = Math.sqrt(Math.max(0, (RD - 0.6) ** 2 - u * u));
  const ang = Math.atan2(-u * s + vf * c, u * c + vf * s);
  const sec = Math.floor((ang / (Math.PI * 2) + 1) * (quant ? 90 : 60)) % (quant ? 90 : 60);
  // 形は v008 のまま（2026-10-13 ユーザー「不自然に膨らんだりえぐれたりはしないで」）。規則的に見えないようにするのは色の模様（各画風の rootColor）
  for (let d = step; d <= ROOT_D; d += step) {
    const t = d / ROOT_D;
    const r = (RD - 0.6) * Math.pow(1 - t, 0.75) + (hash2(sec, d) - 0.5) * (quant ? 3 : 2.5) + (hash2(Math.floor(sec / 6), 7) - 0.5) * 6 * t;
    if (Math.abs(u) >= r) break;
    const vk = Math.sqrt(r * r - u * u);
    const yk = Math.min(BH, Math.round(cyb + vk * sb * tl + (THICK + d) * hb));
    for (let row = Math.max(prev, 0); row < yk; row++) d32[row * BW + px] = rootColor(t, row, sec, d, u);
    if (yk > prev) prev = yk;
  }
}

// 生き物（線と面で。絵画と銅版画）。pal: {deer:[体,こい色], wolf, fish, ink, lw, shadow}
function drawAnimalVec(ctx, a, p, sz, pal) {
  const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  const f = (Math.cos(a.dir) * c - Math.sin(a.dir) * s) >= 0 ? 1 : -1;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(f, 1);
  ctx.lineWidth = pal.lw || Math.max(1, sz * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const [body, dark] = pal[a.kind] || ['#c8ccd2', '#555a62'];
  const ink = pal.ink || dark;
  if (a.kind === 'bird') {
    ctx.fillStyle = body; ctx.strokeStyle = ink;
    if (a.alt > 0.5) {                                   // とんでいる: 翼をはばたく
      const wg = Math.sin(a.phase * 8) * sz * 0.35;
      ctx.beginPath(); ctx.moveTo(-sz * 0.6, -wg); ctx.quadraticCurveTo(0, sz * 0.15, sz * 0.6, -wg); ctx.lineWidth = Math.max(1.5, sz * 0.14); ctx.strokeStyle = body; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.3, sz * 0.12, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#d8b040'; ctx.lineWidth = Math.max(1, sz * 0.06); ctx.beginPath(); ctx.moveTo(sz * 0.3, 0); ctx.lineTo(sz * 0.6, 0); ctx.stroke();
    } else {
      ctx.strokeStyle = dark; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, sz * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -sz * 0.08, sz * 0.32, sz * 0.18, -0.3, 0, 7); ctx.fill(); if (pal.ink) ctx.stroke();
      ctx.strokeStyle = body; ctx.lineWidth = Math.max(1.5, sz * 0.1); ctx.beginPath(); ctx.moveTo(sz * 0.2, -sz * 0.15); ctx.quadraticCurveTo(sz * 0.15, -sz * 0.55, sz * 0.32, -sz * 0.62); ctx.stroke();
      ctx.strokeStyle = '#d8b040'; ctx.lineWidth = Math.max(1, sz * 0.06); ctx.beginPath(); ctx.moveTo(sz * 0.32, -sz * 0.62); ctx.lineTo(sz * 0.62, -sz * 0.58); ctx.stroke();
    }
    ctx.restore(); return;
  }
  if (a.kind === 'fish') {
    const wig = Math.sin(a.phase * 9) * 0.2;
    ctx.fillStyle = body; ctx.strokeStyle = ink;
    ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.5, sz * 0.24, 0, 0, 7);
    ctx.moveTo(-sz * 0.42, 0); ctx.lineTo(-sz * 0.75, -sz * (0.22 + wig)); ctx.lineTo(-sz * 0.75, sz * (0.22 - wig)); ctx.closePath();
    ctx.fill(); if (pal.ink) ctx.stroke();
  } else {
    const deer = a.kind === 'deer', leg = Math.sin(a.phase * 10) * sz * 0.12;
    if (pal.shadow) { ctx.fillStyle = pal.shadow; ctx.beginPath(); ctx.ellipse(0, sz * 0.42, sz * 0.45, sz * 0.1, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.28, 0); ctx.lineTo(-sz * 0.28 + leg, sz * 0.42); ctx.moveTo(sz * 0.26, 0); ctx.lineTo(sz * 0.26 - leg, sz * 0.42);
    ctx.stroke();
    ctx.fillStyle = body; ctx.strokeStyle = ink;
    ctx.beginPath(); ctx.ellipse(0, -sz * 0.05, sz * 0.42, sz * 0.22, 0, 0, 7);
    if (deer) { ctx.moveTo(sz * 0.3, -sz * 0.12); ctx.lineTo(sz * 0.5, -sz * 0.5); ctx.lineTo(sz * 0.62, -sz * 0.4); ctx.closePath(); }
    else { ctx.moveTo(sz * 0.32, -sz * 0.18); ctx.lineTo(sz * 0.7, -sz * 0.22); ctx.lineTo(sz * 0.45, -sz * 0.42); ctx.lineTo(sz * 0.46, -sz * 0.55); ctx.lineTo(sz * 0.38, -sz * 0.36); ctx.closePath(); }
    ctx.fill(); if (pal.ink) ctx.stroke();
    ctx.strokeStyle = deer ? dark : body;
    ctx.beginPath();
    if (deer) { ctx.moveTo(sz * 0.5, -sz * 0.5); ctx.lineTo(sz * 0.46, -sz * 0.75); ctx.moveTo(sz * 0.52, -sz * 0.6); ctx.lineTo(sz * 0.64, -sz * 0.78); }
    else { ctx.moveTo(-sz * 0.4, -sz * 0.1); ctx.quadraticCurveTo(-sz * 0.65, -sz * 0.05, -sz * 0.72, sz * 0.15); }
    ctx.stroke();
  }
  ctx.restore();
}

// 奥から並べた、描くもの一覧（生き物・木）。山のかげに入ったものは除く
function sceneItems() {
  const items = [], BW = buf.width, BH = buf.height;
  // 山や段のかげにかくれているか: 足もと・胴・頭の高さの3点がどれも手前の地形の下なら（v045。前は足もとの1点だけで、段を歩くたびに消えたり出たりした。2026-10-14 ユーザー）
  const hidden = p => {
    const bx = Math.round(p.x / V.bs); if (bx < 0 || bx >= BW) return false;
    for (const up of [1, 3, 5]) {
      const by = Math.round(p.y / V.bs) - up;
      if (by < 0 || by >= BH || dep[by * BW + bx] <= p.v + 1.6) return false;
    }
    return true;
  };
  for (const a of L.list) {
    const z = a.kind === 'fish' ? surfAt(a.x, a.y) - 0.25 : surfAt(a.x, a.y) + (a.alt || 0);
    const p = proj(a.x, a.y, z);
    if (a.kind === 'bird' && a.alt > 0.5) { items.push({ type: 'animal', a, p, ground: proj(a.x, a.y, surfAt(a.x, a.y)) }); continue; }   // とんでいる鳥は山にかくれない
    a.hidN = hidden(p) ? (a.hidN || 0) + 1 : 0;                       // 何コマか続けてかくれたときだけ消す（ちらつかない）
    if (a.dropT0) {                                                    // 放したばかり: 上から落ちてくる（0.45 秒。影は地面に。v056）
      const e = (performance.now() - a.dropT0) / 450;
      if (e >= 1 || e < 0) {                                           // 着いた: サカナは水しぶき、陸の生き物は土ぼこり（v062）
        a.dropT0 = 0;
        if (e >= 1 && typeof PFX !== 'undefined') {
          const now = performance.now(), fish = a.kind === 'fish';
          for (let k = 0; k < (fish ? 6 : 4); k++) {
            const ang = k / (fish ? 6 : 4) * 6.283 + Math.random() * 0.5, v = (fish ? 1.2 : 1.4) + Math.random() * 0.8;
            PFX.push(fish ? { x: a.x, y: a.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vz: 2.6 + Math.random() * 1.2, h0: 0.1, g: 20, t0: now, col: '#cfeaff' }
                          : { x: a.x, y: a.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vz: 0.6, h0: 0.15, g: 2, t0: now, col: '#d2c6ae' });
          }
        }
      }
      else { items.push({ type: 'animal', a, p: proj(a.x, a.y, z + 8 * (1 - e * e)), ground: p, drop: true }); continue; }
    }
    if (a.hidN < 6) items.push({ type: 'animal', a, p });
  }
  for (const i of INS) {
    const t = W.tree[i];
    if (t < 0.08) continue;
    const x = i % N + (HASH[i] - 0.5) * 0.6, y = (i / N | 0) + (HASH[(i * 7) % NN] - 0.5) * 0.6;
    const p = proj(x, y, surfAt(x, y));
    if (!hidden(p)) items.push({ type: 'tree', i, t, p, conifer: W.g[i] > 8.5, hi: HASH[i] });
  }
  if (typeof hutSpots === 'function') hutSpots().forEach((h, k) => { const p = proj(h.x, h.y, surfAt(h.x, h.y)); if (!hidden(p)) items.push({ type: 'hut', x: h.x, y: h.y, p, fire: k === 0 && knows('fire') }); });   // ヒトの家（v2）
  items.sort((m, n) => m.p.v - n.p.v);
  return items;
}

// 滝（手前に見えるものだけ）: {b, q, a, top(画面), wid(画面), L(画面の長さ)}
//   2026-10-13 ユーザー「滝は水量に応じて増減させて」「パカパカ表示非表示がきりかわるのもおかしい」:
//   W.fall は1秒ごとに段で変わるので、描く用の FV を毎コマなめらかに追わせる（となりの区分とも少しならす）。
//   太さ・長さ・濃さ a を量で決め、少ない滝は消える前にうすくなる。奥へ回りこむ滝もうすくしてから消す。
//   2026-10-14 ユーザー「水がまだ端に着いていないように見えるのに滝が盛大に流れる」:
//   濃さに、ふちの水の見え方 DV をかける。DV は区分のふちの帯（ふちから3マス内側まで）でいちばん深い水を、
//   地面の水の色づき（render の kMix: 0.06〜0.26）と同じ物さしで 0〜1 にしたもの。FV と同じ速さでなめらかに追わせる。
//   ふちのマスそのものは落ちる水で浅くなるので（湖の出口でも 0.12 ほど）、内側の帯で見る。
const FV = new Float32Array(BINS), DV = new Float32Array(BINS), DMAX = new Float32Array(BINS);
const BAND = [], BANDB = [];
for (const i of INS) {
  const x = i % N, y = (i / N) | 0;
  if (Math.hypot(x - C, y - C) > RD - 3) { BAND.push(i); BANDB.push(((Math.atan2(y - C, x - C) / (2 * Math.PI) + 1) * BINS | 0) % BINS); }
}
let fvLast = 0;
function updateFallVis() {
  const now = performance.now(), dt = fvLast ? Math.min(0.5, (now - fvLast) / 1000) : 1; fvLast = now;
  const k = 1 - Math.exp(-dt / 0.9);
  DMAX.fill(0);
  for (let n = 0; n < BAND.length; n++) { const b = BANDB[n], wd = W.w[BAND[n]]; if (wd > DMAX[b]) DMAX[b] = wd; }
  for (let b = 0; b < BINS; b++) {
    const tq = W.fall[b] * 0.6 + (W.fall[(b + 1) % BINS] + W.fall[(b + BINS - 1) % BINS]) * 0.2;
    FV[b] += (tq - FV[b]) * k;
    const td = Math.min(1, Math.max(0, (Math.max(DMAX[b], DMAX[(b + 1) % BINS] * 0.6, DMAX[(b + BINS - 1) % BINS] * 0.6) - RIM_LIP) / 0.2));
    DV[b] += (td - DV[b]) * k;
  }
}
function fallList() {
  const c = Math.cos(V.yaw), s = Math.sin(V.yaw), out = [];
  const L0 = (THICK + 26) * V.s * V.hf + RD * V.s * 0.3;
  for (let b = 0; b < BINS; b++) {
    const q = FV[b];
    if (q < 0.004) continue;
    const a = (b + 0.5) / BINS * Math.PI * 2;
    const ex = C + Math.cos(a) * (RD - 0.8), ey = C + Math.sin(a) * (RD - 0.8);
    const top = proj(ex, ey, surfAt(ex, ey));
    const back = Math.min(1, (top.v + RD * 0.12) / (RD * 0.1));
    if (back <= 0) continue;
    const sq = Math.min(1.5, Math.sqrt(q));
    const tu = -Math.sin(a) * c - Math.cos(a) * s;
    const wid = Math.max(1, (2 * Math.PI * RD / BINS) * V.s * Math.abs(tu) * (0.2 + 0.75 * sq) + V.s * 0.5 * Math.min(1, sq * 1.5));
    const L = L0 * (0.45 + 0.55 * Math.min(1, sq));
    const dv = DV[b] * DV[b] * (3 - 2 * DV[b]);
    if (dv < 0.02) continue;
    out.push({ b, q, a: Math.min(1, q / 0.06) * back * dv, top, wid, L });
  }
  return out;
}

const bodyHit = { sun: null, moon: null };
const bodyPos = b => proj(C + bodyR(b) * Math.cos(b.a), C + bodyR(b) * Math.sin(b.a), HS);
const moonPhase = () => { const ph = ((W.moon.a - W.sun.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); return { ph, lit: (1 - Math.cos(ph)) / 2 }; };
const cloudR = cl => 2 + Math.sqrt(cl.water) * 0.55;
const cloudZ = cl => 19 + (cl.seed % 3);

function drawWorld(ctx, t, hover) {
  if (typeof COL !== 'undefined' && COL) { drawCollapse(ctx, t); V.dirty = false; return; }   // 世界をくずしているあいだ
  cellColors();
  updateFallVis();
  const own = style().draw(ctx, t, hover);   // 画風が足もとの印を描いたら true
  drawBackFront(ctx, t);
  V.dirty = false;
  // 選んだ1匹の角かっこ（自分で描かない画風のとき）
  if (typeof G !== 'undefined' && G.sel && !style().drawsSel && L.list.includes(G.sel)) {
    const a = G.sel, p = proj(a.x, a.y, surfAt(a.x, a.y) + (a.alt || 0)), r = Math.max(6, V.s * 1.1);
    ctx.strokeStyle = style().selColor || '#ffe066'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = p.x + sx * r, y = p.y - r * 0.6 + sy * r; ctx.moveTo(x - sx * r * 0.45, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy * r * 0.45); }
    ctx.stroke();
  }
  if (hover && !own) {
    ctx.strokeStyle = style().fixedHover ? style().hover : hover.color || style().hover; ctx.lineWidth = 1.5;
    const p = proj(hover.x, hover.y, hover.z);
    ctx.beginPath(); ctx.ellipse(p.x, p.y, hover.r * V.s, hover.r * V.s * V.tilt, 0, 0, 7); ctx.stroke();
  }
}
