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
// 本命はボクセル（2026-10-12 ユーザー）。絵画・銅版画は開発用に ?style=paint / ?style=etch で
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
  const fitW = cw * 0.9 / (2 * RD), fitH = ch * 0.84 / (2 * RD * V.tilt + (16 + THICK + 12) * V.hf);
  V.s = Math.min(fitW, fitH) * V.zoom;
  // 平行移動（panX・panY は画面の画素。大きくずれすぎないように）
  V.panX = Math.max(-cw * 0.9, Math.min(cw * 0.9, V.panX || 0)); V.panY = Math.max(-ch * 0.9, Math.min(ch * 0.9, V.panY || 0));
  V.cx = cw / 2 + V.panX; V.cy = ch * 0.5 - (THICK + 4) * V.s * V.hf * 0.6 + (16 * V.s * V.hf) * 0.25 + V.panY;
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
  for (const i of INS) {
    const h = g[i], jit = 0.95 + HASH[i] * 0.1;
    let slope = 0;
    for (const o of NB4) { const j = i + o; if (inside[j]) slope = Math.max(slope, Math.abs(Zs[j] - Zs[i])); }
    // 土・岩・雪（横の面にも使う）
    let r, gg, b;
    if (h >= 13.5) { r = 236; gg = 238; b = 244; }
    else if (slope > 1.6 || h > 10.5) { const t = Math.min(1, Math.max(0, (h - 8) / 5)); r = mix(132, 150, t); gg = mix(118, 142, t); b = mix(104, 138, t); }
    else if (h < 3.2 || (m[i] > 0.95 && h < 5)) { r = 218; gg = 198; b = 146; }
    else {                                    // 土: 乾いた所は黄土色、しめった所はこげ茶
      const t = Math.min(1, (h - 3) / 8), wet = Math.min(1, m[i] * 1.4);
      r = mix(mix(206, 178, t), mix(150, 124, t), wet); gg = mix(mix(178, 152, t), mix(110, 94, t), wet); b = mix(mix(118, 110, t), mix(72, 70, t), wet);
    }
    r *= jit; gg *= jit; b *= jit;
    SR[i] = r * 0.82; SG[i] = gg * 0.8; SB[i] = b * 0.78;
    // 草・花
    const v = veg[i];
    if (v > 0.03 && h < 13.5 && slope < 2.5) {
      const tone = HASH[i] > 0.5 ? 1 : 0.9, t = Math.min(1, v * 1.4);
      r = mix(r, mix(150, 66, v) * tone, t); gg = mix(gg, mix(188, 132, v) * tone, t); b = mix(b, mix(84, 52, v) * tone, t);
      if (v > 0.6 && HASH[i] > 0.972) { if (HASH[i] > 0.986) { r = 246; gg = 222; b = 92; } else { r = 240; gg = 236; b = 236; } }
    }
    // 水
    const wd = w[i];
    if (wd > 0.06) {
      const t = Math.min(1, wd / 3);
      let wr = mix(92, 22, t), wg = mix(186, 78, t), wb = mix(204, 138, t);
      const a = alg[i] * 0.5; wr = mix(wr, 64, a); wg = mix(wg, 140, a); wb = mix(wb, 96, a);
      const sp = (W.fL[i] + W.fR[i] + W.fU[i] + W.fD[i]) / (wd + 0.15);
      let shore = false;
      for (const o of NB4) { const j = i + o; if (inside[j] && w[j] <= 0.06) shore = true; }
      const foam = Math.min(0.6, Math.max(0, sp - 2.2) * 0.13) + (shore ? 0.22 : 0);
      wr = mix(wr, 236, foam); wg = mix(wg, 246, foam); wb = mix(wb, 250, foam);
      const k = Math.min(1, (wd - 0.06) / 0.2);
      r = mix(r, wr, k); gg = mix(gg, wg, k); b = mix(b, wb, k);
      SR[i] = wr * 0.7; SG[i] = wg * 0.75; SB[i] = wb * 0.85;
    }
    // くぼみの影（まわりが高いほど暗い）
    let ao = 0;
    for (const o of NB4) { const j = i + o; if (inside[j] && Zq[j] > Zq[i]) ao++; }
    const sh = 1 - 0.06 * ao;
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
  for (let d = step; d <= ROOT_D; d += step) {
    const t = d / ROOT_D;
    const r = (RD - 0.6) * Math.pow(1 - t, 0.75) + (hash2(sec, d) - 0.5) * (quant ? 3 : 2.5) + (hash2(Math.floor(sec / 6), 7) - 0.5) * 6 * t;
    if (Math.abs(u) >= r) break;
    const vk = Math.sqrt(r * r - u * u);
    const yk = Math.min(BH, Math.round(cyb + vk * sb * tl + (THICK + d) * hb));
    for (let row = Math.max(prev, 0); row < yk; row++) d32[row * BW + px] = rootColor(t, row, sec, d);
    if (yk > prev) prev = yk;
  }
}

// 生き物（線と面で。絵画と銅版画）。pal: {deer:[体,こい色], wolf, fish, ink, lw, shadow}
function drawAnimalVec(ctx, a, p, sz, pal) {
  const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  const f = (Math.cos(a.dir) * c - Math.sin(a.dir) * s) >= 0 ? 1 : -1;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(f, 1);
  ctx.lineWidth = pal.lw || Math.max(1, sz * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const [body, dark] = pal[a.kind];
  const ink = pal.ink || dark;
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
  const hidden = p => {
    const bx = Math.round(p.x / V.bs), by = Math.round(p.y / V.bs) - 1;
    if (bx < 0 || by < 0 || bx >= BW || by >= BH) return false;
    return dep[by * BW + bx] > p.v + 1.6;
  };
  for (const a of L.list) {
    const z = a.kind === 'fish' ? surfAt(a.x, a.y) - 0.25 : surfAt(a.x, a.y);
    const p = proj(a.x, a.y, z);
    if (!hidden(p)) items.push({ type: 'animal', a, p });
  }
  for (const i of INS) {
    const t = W.tree[i];
    if (t < 0.08) continue;
    const x = i % N + (HASH[i] - 0.5) * 0.6, y = (i / N | 0) + (HASH[(i * 7) % NN] - 0.5) * 0.6;
    const p = proj(x, y, surfAt(x, y));
    if (!hidden(p)) items.push({ type: 'tree', i, t, p, conifer: W.g[i] > 8.5, hi: HASH[i] });
  }
  items.sort((m, n) => m.p.v - n.p.v);
  return items;
}

// 滝（手前に見えるものだけ）: {b, q, top(画面), wid(画面), L(画面の長さ)}
function fallList() {
  const c = Math.cos(V.yaw), s = Math.sin(V.yaw), out = [];
  const L = (THICK + 26) * V.s * V.hf + RD * V.s * 0.3;
  for (let b = 0; b < BINS; b++) {
    const q = W.fall[b];
    if (q < 0.015) continue;
    const a = (b + 0.5) / BINS * Math.PI * 2;
    const ex = C + Math.cos(a) * (RD - 0.8), ey = C + Math.sin(a) * (RD - 0.8);
    const top = proj(ex, ey, surfAt(ex, ey));
    if (top.v < -RD * 0.12) continue;
    const tu = -Math.sin(a) * c - Math.cos(a) * s;
    const wid = Math.max(2, (2 * Math.PI * RD / BINS) * V.s * Math.abs(tu) * Math.min(1.1, 0.5 + q * 0.5) + V.s * 0.5);
    out.push({ b, q, top, wid, L });
  }
  return out;
}

const bodyHit = { sun: null, moon: null };
const bodyPos = b => proj(C + RS * Math.cos(b.a), C + RS * Math.sin(b.a), HS);
const moonPhase = () => { const ph = ((W.moon.a - W.sun.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); return { ph, lit: (1 - Math.cos(ph)) / 2 }; };
const cloudR = cl => 2 + Math.sqrt(cl.water) * 0.55;
const cloudZ = cl => 19 + (cl.seed % 3);

function drawWorld(ctx, t, hover) {
  cellColors();
  const own = style().draw(ctx, t, hover);   // 画風が足もとの印を描いたら true
  V.dirty = false;
  if (hover && !own) {
    ctx.strokeStyle = styleName === 'etch' ? style().hover : hover.color || style().hover; ctx.lineWidth = 1.5;
    const p = proj(hover.x, hover.y, hover.z);
    ctx.beginPath(); ctx.ellipse(p.x, p.y, hover.r * V.s, hover.r * V.s * V.tilt, 0, 0, 7); ctx.stroke();
  }
}
