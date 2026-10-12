'use strict';
// 絵: 深淵に浮かぶ円盤を斜め上から見る。
//   地形は「斜めから見たボクセル」: 画面の列ごとに、手前のふちから奥へ地面をたどり、
//   前より上に出た所だけを塗る（ImageData、半分ほどの解像度）。手前のふちの断面は地層。
//   その上に canvas で、滝・雲・太陽と月・生き物・知らせを描く。

const V = { yaw: -0.5, tilt: 0.56, zoom: 1, cw: 0, ch: 0, s: 8, cx: 0, cy: 0, hf: 0.4, bs: 2 };
const THICK = 7;                       // 大地の厚み（ふちの断面）
const Z = new Float32Array(N * N), CR = new Float32Array(N * N), CG = new Float32Array(N * N), CB = new Float32Array(N * N);
// 大地の外の区画は、いちばん近いふちの区画の値を使う（なめらかに描くため）
const NEAR = new Int32Array(N * N).fill(-1);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const i = y * N + x;
  if (inside[i]) { NEAR[i] = i; continue; }
  const r = Math.hypot(x - C, y - C), k = (RD - 0.7) / r;
  const j = Math.round(C + (y - C) * k) * N + Math.round(C + (x - C) * k);
  NEAR[i] = inside[j] ? j : -1;
}
const STARS = Array.from({ length: 140 }, (_, k) => ({ x: (k * 7919 % 1000) / 1000, y: (k * 104729 % 997) / 997, r: (k % 5 === 0) ? 1.4 : 0.7, tw: k * 1.7 }));
const ROOT = Array.from({ length: 48 }, (_, k) => 0.75 + 0.25 * Math.abs(Math.sin(k * 12.9898) * 43758.5453 % 1));

let buf = null, bctx = null, img = null, d32 = null;

function layout(cw, ch) {
  V.cw = cw; V.ch = ch;
  const el = Math.asin(V.tilt);
  V.hf = Math.cos(el) * 0.5;
  const fitW = cw * 0.9 / (2 * RD), fitH = ch * 0.86 / (2 * RD * V.tilt + (16 + THICK + 10) * V.hf);
  V.s = Math.min(fitW, fitH) * V.zoom;
  V.cx = cw / 2; V.cy = ch * 0.5 - (THICK + 4) * V.s * V.hf * 0.6 + (16 * V.s * V.hf) * 0.25;
  V.bs = Math.max(2, cw / 640);
  const BW = Math.ceil(cw / V.bs), BH = Math.ceil(ch / V.bs);
  if (!buf || buf.width !== BW || buf.height !== BH) {
    buf = document.createElement('canvas'); buf.width = BW; buf.height = BH;
    bctx = buf.getContext('2d'); img = bctx.createImageData(BW, BH); d32 = new Uint32Array(img.data.buffer);
  }
}

function proj(x, y, z) {
  const dx = x - C, dy = y - C, c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  const u = dx * c - dy * s, v = dx * s + dy * c;
  return { x: V.cx + u * V.s, y: V.cy + v * V.s * V.tilt - z * V.s * V.hf, v };
}

// 画面の点 → 大地の点（見えている面）。なければ null
function pick(sx, sy) {
  const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  const u = (sx - V.cx) / V.s;
  if (Math.abs(u) >= RD) return null;
  const ve = Math.sqrt(RD * RD - u * u) - 0.5;
  for (let v = ve; v >= -ve; v -= 0.2) {
    const wx = C + u * c + v * s, wy = C - u * s + v * c;
    const z = heightAt(wx, wy, true);
    const y = V.cy + v * V.s * V.tilt - z * V.s * V.hf;
    if (y <= sy) {
      if (v === ve && sy > y + THICK * V.s * V.hf) return null;
      return { x: wx, y: wy, z };
    }
  }
  return null;
}

const mix = (a, b, t) => a + (b - a) * t;

// 区画の色と高さ（毎フレーム）
function cellColors() {
  const g = W.g, w = W.w, veg = W.veg, alg = W.alg, m = W.moist, Lt = W.light;
  for (const i of INS) Z[i] = g[i] + w[i];
  const lx = Math.cos(W.sun.a), ly = Math.sin(W.sun.a);
  for (const i of INS) {
    let r, gg, b;
    const h = g[i];
    // 土の色（高さで）
    if (h < 2.5) { r = 204; gg = 188; b = 138; }
    else if (h < 9) { const t = (h - 2.5) / 6.5; r = mix(170, 142, t); gg = mix(140, 116, t); b = mix(96, 86, t); }
    else if (h < 14) { const t = (h - 9) / 5; r = mix(142, 132, t); gg = mix(116, 126, t); b = mix(86, 122, t); }
    else { r = 236; gg = 236; b = 240; }
    const dm = 1 - 0.18 * m[i]; r *= dm; gg *= dm; b *= dm;
    const v = veg[i];
    if (v > 0.02 && h < 14) { const t = Math.min(1, v * 1.1); r = mix(r, mix(120, 62, v), t); gg = mix(gg, mix(165, 118, v), t); b = mix(b, mix(70, 48, v), t); }
    const wd = w[i];
    if (wd > 0.03) {
      const t = Math.min(1, wd / 3.2);
      let wr = mix(118, 26, t), wg = mix(188, 70, t), wb = mix(204, 128, t);
      const a = alg[i] * 0.45; wr = mix(wr, 70, a); wg = mix(wg, 132, a); wb = mix(wb, 92, a);
      const sp = (W.fL[i] + W.fR[i] + W.fU[i] + W.fD[i]) / (wd + 0.15);
      if (sp > 2.5) { const f = Math.min(0.55, (sp - 2.5) * 0.12); wr = mix(wr, 235, f); wg = mix(wg, 245, f); wb = mix(wb, 250, f); }
      const k = Math.min(1, (wd - 0.03) / 0.25);
      r = mix(r, wr, k); gg = mix(gg, wg, k); b = mix(b, wb, k);
    }
    // 日の向きに向いた坂は明るく
    const gx = (Z[inside[i + 1] ? i + 1 : i] - Z[inside[i - 1] ? i - 1 : i]) * 0.5;
    const gy = (Z[inside[i + N] ? i + N : i] - Z[inside[i - N] ? i - N : i]) * 0.5;
    const sh = Math.max(0.62, Math.min(1.3, 1 - 0.28 * (gx * lx + gy * ly)));
    // 昼と夜
    const lum = 0.28 + 0.72 * Lt[i];
    CR[i] = Math.min(255, r * sh * lum * 0.92); CG[i] = Math.min(255, gg * sh * lum * 0.96); CB[i] = Math.min(255, b * sh * Math.min(1, lum + 0.12));
  }
  for (let i = 0; i < N * N; i++) if (!inside[i]) {
    const j = NEAR[i];
    if (j >= 0) { Z[i] = Z[j]; CR[i] = CR[j]; CG[i] = CG[j]; CB[i] = CB[j]; } else Z[i] = 0;
  }
}

// 地層の色（ふちの断面）
const STRATA = [[96, 70, 46], [168, 132, 92], [138, 102, 70], [188, 156, 112], [118, 92, 68], [158, 124, 88]];
function strata(dz, u) {
  if (dz < 0.6) return STRATA[0];
  const k = Math.floor((dz + Math.sin(u * 0.35) * 0.5 + 0.4) / 1.25);
  return STRATA[1 + ((k % 5) + 5) % 5];
}

function renderTerrain() {
  const BW = buf.width, BH = buf.height;
  d32.fill(0);
  const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  const sb = V.s / V.bs, cxb = V.cx / V.bs, cyb = V.cy / V.bs, hb = V.s * V.hf / V.bs, tl = V.tilt;
  const dv = 1 / (sb * tl);
  for (let px = 0; px < BW; px++) {
    const u = (px + 0.5 - cxb) / sb;
    if (Math.abs(u) >= RD - 0.6) continue;
    const ve = Math.sqrt((RD - 0.6) ** 2 - u * u);
    let ybuf = Math.min(BH, Math.ceil(cyb + ve * sb * tl + THICK * hb));
    let first = true;
    for (let v = ve; v >= -ve && ybuf > 0; v -= dv) {
      const wx = C + u * c + v * s, wy = C - u * s + v * c;
      const xi = wx | 0, yi = wy | 0, fx = wx - xi, fy = wy - yi;
      const i = yi * N + xi;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const z = Z[i] * w00 + Z[i + 1] * w10 + Z[i + N] * w01 + Z[i + N + 1] * w11;
      const y = cyb + v * sb * tl - z * hb;
      let yt = Math.floor(y);
      if (yt < ybuf) {
        const r = CR[i] * w00 + CR[i + 1] * w10 + CR[i + N] * w01 + CR[i + N + 1] * w11;
        const g = CG[i] * w00 + CG[i + 1] * w10 + CG[i + N] * w01 + CG[i + N + 1] * w11;
        const b = CB[i] * w00 + CB[i + 1] * w10 + CB[i + N] * w01 + CB[i + N + 1] * w11;
        const top = (255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
        if (yt < 0) yt = 0;
        if (first) {
          d32[yt * BW + px] = top;
          for (let row = yt + 1; row < ybuf; row++) {
            const dz = (row - y) / hb, col = strata(dz, u), k = 0.78 - Math.min(0.3, dz * 0.02);
            d32[row * BW + px] = (255 << 24) | ((col[2] * k) << 16) | ((col[1] * k) << 8) | (col[0] * k);
          }
        } else {
          // 1〜2 画素の段は上の面と同じ色（縞にならないように）。それより高い崖は暗く
          const steep = ybuf - yt > 2;
          d32[yt * BW + px] = top;
          const k = steep ? 0.72 : 1;
          const face = (255 << 24) | (((b * k) & 255) << 16) | (((g * k) & 255) << 8) | ((r * k) & 255);
          for (let row = yt + 1; row < ybuf; row++) d32[row * BW + px] = face;
        }
        ybuf = yt;
      }
      first = false;
    }
  }
  bctx.putImageData(img, 0, 0);
}

function drawBackground(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, V.ch);
  g.addColorStop(0, '#1d2742'); g.addColorStop(0.55, '#0d1222'); g.addColorStop(1, '#04060b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, V.cw, V.ch);
  for (const st of STARS) {
    const x = ((st.x + V.yaw / (Math.PI * 2) * 0.6) % 1 + 1) % 1 * V.cw, y = st.y * V.ch;
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.3 + st.tw);
    ctx.fillStyle = '#e8eefc'; ctx.fillRect(x, y, st.r, st.r);
  }
  ctx.globalAlpha = 1;
}

// 大地の下の岩の根
function drawRoot(ctx) {
  const n = ROOT.length, pts = [];
  for (let k = 0; k <= n; k++) {
    const a = k / n * Math.PI * 2;
    const p = proj(C + Math.cos(a) * (RD - 0.6), C + Math.sin(a) * (RD - 0.6), -THICK);
    if (p.v >= -1) pts.push(p);
  }
  ctx.beginPath();
  // 手前のふち（左から右へ）を下の線として、根の先へ
  pts.sort((a, b) => a.x - b.x);
  if (!pts.length) return;
  const low = Math.max(...pts.map(p => p.y));
  const apex = { x: proj(C, C, 0).x, y: low + RD * V.s * 0.5 };
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    const x = mix(pts[pts.length - 1].x, apex.x, t), y = mix(pts[pts.length - 1].y, apex.y, t * t);
    const j = ROOT[k] * V.s * 2.2 * Math.sin(t * Math.PI);
    ctx.lineTo(x - j * (1 - t), y + (k % 2 ? j * 0.3 : 0));
  }
  for (let k = n - 1; k >= 0; k--) {
    const t = k / (n - 1);
    const x = mix(pts[0].x, apex.x, t), y = mix(pts[0].y, apex.y, t * t);
    const j = ROOT[(k + 17) % n] * V.s * 2.2 * Math.sin(t * Math.PI);
    ctx.lineTo(x + j * (1 - t), y + (k % 2 ? j * 0.3 : 0));
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, pts[0].y, 0, apex.y);
  g.addColorStop(0, '#6b5038'); g.addColorStop(0.45, '#4a3828'); g.addColorStop(1, 'rgba(40,30,24,0)');
  ctx.fillStyle = g; ctx.fill();
}

function drawFalls(ctx, t) {
  const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  const L = (THICK + 26) * V.s * V.hf + RD * V.s * 0.25;
  for (let b = 0; b < BINS; b++) {
    const q = W.fall[b];
    if (q < 0.015) continue;
    const a = (b + 0.5) / BINS * Math.PI * 2;
    const ex = C + Math.cos(a) * (RD - 0.8), ey = C + Math.sin(a) * (RD - 0.8);
    const top = proj(ex, ey, heightAt(ex, ey, true));
    if (top.v < -RD * 0.12) continue;      // 向こうがわの滝は大地のかげ
    const tu = -Math.sin(a) * c - Math.cos(a) * s;
    const wid = Math.max(2, (2 * Math.PI * RD / BINS) * V.s * Math.abs(tu) * Math.min(1.1, 0.5 + q * 0.5) + V.s * 0.5);
    const al = Math.min(0.92, 0.3 + q * 0.45);
    const gr = ctx.createLinearGradient(0, top.y, 0, top.y + L);
    gr.addColorStop(0, `rgba(225,240,255,${al})`); gr.addColorStop(0.55, `rgba(190,215,240,${al * 0.55})`); gr.addColorStop(1, 'rgba(190,215,240,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(top.x - wid / 2, top.y, wid, L);
    // 流れ落ちる筋
    ctx.fillStyle = `rgba(255,255,255,${al * 0.7})`;
    const sp = 40 * V.s * V.hf;
    for (let k = 0; k < 3; k++) {
      const off = ((t * sp * (0.8 + k * 0.15) + k * 41 + b * 17) % L);
      const x = top.x - wid / 2 + ((k * 0.37 + b * 0.13) % 1) * wid;
      ctx.globalAlpha = 1 - off / L;
      ctx.fillRect(x, top.y + off, Math.max(1, wid * 0.12), Math.min(L - off, V.s * 2.2));
    }
    ctx.globalAlpha = 1;
    // 霧
    if (q > 0.12) {
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.25 + k / 3 + b * 0.07) % 1;
        const yy = top.y + L * (0.35 + 0.6 * ph), rr = (wid * 0.6 + V.s * 1.2) * (0.6 + ph);
        ctx.fillStyle = `rgba(220,232,250,${0.12 * (1 - ph) * Math.min(1, q)})`;
        ctx.beginPath(); ctx.arc(top.x + Math.sin(t * 0.7 + b + k) * wid * 0.5, yy, rr, 0, 7); ctx.fill();
      }
    }
  }
}

function drawSpring(ctx, sp, t) {
  const x = sp.i % N, y = sp.i / N | 0, p = proj(x, y, Z[sp.i] + 0.2);
  const r = Math.max(3, V.s * 0.7);
  ctx.strokeStyle = sp.on ? 'rgba(200,235,255,0.95)' : 'rgba(120,120,120,0.9)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * V.tilt, 0, 0, 7); ctx.stroke();
  if (sp.on) {
    const k = (t * 0.8) % 1;
    ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * (1 + k * 1.5), r * V.tilt * (1 + k * 1.5), 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  }
}

function drawAnimal(ctx, a, p) {
  const sz = Math.max(5, V.s * (a.kind === 'fish' ? 0.75 : a.kind === 'wolf' ? 1.05 : 1.0));
  const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
  const su = Math.cos(a.dir) * c - Math.sin(a.dir) * s;
  const f = su >= 0 ? 1 : -1;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(f, 1);
  ctx.lineWidth = Math.max(1, sz * 0.12); ctx.lineCap = 'round';
  if (a.kind === 'fish') {
    ctx.globalAlpha = 0.9;
    const wig = Math.sin(a.phase * 9) * 0.2;
    ctx.fillStyle = '#ef9a4a'; ctx.strokeStyle = '#7a3e14';
    ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.5, sz * 0.24, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-sz * 0.42, 0); ctx.lineTo(-sz * 0.75, -sz * (0.22 + wig)); ctx.lineTo(-sz * 0.75, sz * (0.22 - wig)); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    const deer = a.kind === 'deer';
    const body = deer ? '#a8743f' : '#8b8d94', dark = deer ? '#5a3a1c' : '#3d3f46';
    const leg = Math.sin(a.phase * 10) * sz * 0.12;
    ctx.strokeStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.28, 0); ctx.lineTo(-sz * 0.28 + leg, sz * 0.42);
    ctx.moveTo(sz * 0.26, 0); ctx.lineTo(sz * 0.26 - leg, sz * 0.42);
    ctx.stroke();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, -sz * 0.05, sz * 0.42, sz * 0.22, 0, 0, 7); ctx.fill();
    if (deer) {
      ctx.beginPath(); ctx.moveTo(sz * 0.3, -sz * 0.12); ctx.lineTo(sz * 0.5, -sz * 0.5); ctx.lineTo(sz * 0.62, -sz * 0.4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sz * 0.5, -sz * 0.5); ctx.lineTo(sz * 0.46, -sz * 0.75); ctx.moveTo(sz * 0.52, -sz * 0.6); ctx.lineTo(sz * 0.64, -sz * 0.78); ctx.stroke();
      ctx.fillStyle = '#f2ead8'; ctx.beginPath(); ctx.arc(-sz * 0.44, -sz * 0.12, sz * 0.08, 0, 7); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(sz * 0.32, -sz * 0.18); ctx.lineTo(sz * 0.7, -sz * 0.22); ctx.lineTo(sz * 0.45, -sz * 0.42); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sz * 0.42, -sz * 0.36); ctx.lineTo(sz * 0.46, -sz * 0.55); ctx.lineTo(sz * 0.52, -sz * 0.36); ctx.fill();
      ctx.strokeStyle = body; ctx.beginPath(); ctx.moveTo(-sz * 0.4, -sz * 0.1); ctx.quadraticCurveTo(-sz * 0.65, -sz * 0.05, -sz * 0.72, sz * 0.15); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCloud(ctx, cl) {
  const r = 2 + Math.sqrt(cl.water) * 0.55;
  const z = 19 + (cl.seed % 3);
  const gz = heightAt(cl.x, cl.y, true);
  const sh = proj(cl.x, cl.y, gz);
  ctx.fillStyle = `rgba(10,20,30,${0.07 * Math.min(1, cl.water / 4)})`;
  ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r * V.s, r * V.s * V.tilt, 0, 0, 7); ctx.fill();
  const p = proj(cl.x, cl.y, z);
  if (cl.rain > 0.12) {
    ctx.strokeStyle = 'rgba(170,195,225,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const ox = ((k * 0.29 + cl.seed) % 1 - 0.5) * r * V.s * 1.4, oy = ((performance.now() / 300 + k * 0.37) % 1) * (sh.y - p.y);
      ctx.moveTo(p.x + ox, p.y + oy); ctx.lineTo(p.x + ox - 1, p.y + oy + V.s * 1.2);
    }
    ctx.stroke();
  }
  const dark = Math.min(0.45, cl.water / 80);
  const shade = Math.round(250 - dark * 120);
  const fade = Math.min(1, cl.age / 3, cl.water / 2);
  for (let k = 0; k < 5; k++) {
    const ox = Math.sin(cl.seed + k * 2.1) * r * 0.6, oy = Math.cos(cl.seed * 0.7 + k * 1.7) * r * 0.22;
    const rr = r * V.s * (0.5 + 0.12 * Math.sin(cl.seed + k));
    const x = p.x + ox * V.s, y = p.y + oy * V.s - (k === 2 ? rr * 0.3 : 0);
    const gr = ctx.createRadialGradient(x, y - rr * 0.2, rr * 0.1, x, y, rr);
    gr.addColorStop(0, `rgba(${shade + 5},${shade + 5},${shade + 8},${0.75 * fade})`);
    gr.addColorStop(0.7, `rgba(${shade},${shade},${shade + 4},${0.55 * fade})`);
    gr.addColorStop(1, `rgba(${shade},${shade},${shade + 4},0)`);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill();
  }
}

function drawBody(ctx, b, isSun, t) {
  const p = proj(C + RS * Math.cos(b.a), C + RS * Math.sin(b.a), HS);
  const r = Math.max(10, V.s * (isSun ? 2.0 : 1.6));
  // 地へおろした線（どこを照らしているか）
  const gp = proj(C + RS * Math.cos(b.a), C + RS * Math.sin(b.a), heightAt(C + RS * Math.cos(b.a), C + RS * Math.sin(b.a), true));
  ctx.strokeStyle = isSun ? 'rgba(255,220,120,0.25)' : 'rgba(210,220,255,0.18)'; ctx.setLineDash([3, 5]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(p.x, p.y + r); ctx.lineTo(gp.x, gp.y); ctx.stroke(); ctx.setLineDash([]);
  if (isSun) {
    const g = ctx.createRadialGradient(p.x, p.y, r * 0.3, p.x, p.y, r * 3);
    g.addColorStop(0, 'rgba(255,225,130,0.55)'); g.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#f6c450'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + t * 0.2; ctx.moveTo(p.x + Math.cos(a) * r * 1.2, p.y + Math.sin(a) * r * 1.2); ctx.lineTo(p.x + Math.cos(a) * r * 1.6, p.y + Math.sin(a) * r * 1.6); }
    ctx.stroke();
    ctx.fillStyle = '#ffd866'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#b8862a'; ctx.lineWidth = 1.5; ctx.stroke();
  } else {
    ctx.fillStyle = '#e9ecf4'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    // 満ち欠け: 太陽から離れるほど満ちる
    const ph = ((W.moon.a - W.sun.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const lit = (1 - Math.cos(ph)) / 2;
    ctx.fillStyle = 'rgba(30,38,60,0.85)';
    ctx.beginPath(); ctx.arc(p.x + r * 2 * lit * (ph < Math.PI ? 1 : -1), p.y, r * 1.02, 0, 7);
    ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.clip();
    ctx.beginPath(); ctx.arc(p.x + r * 2 * lit * (ph < Math.PI ? 1 : -1), p.y, r * 1.02, 0, 7); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#9aa3b8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.stroke();
  }
  if (b.stop) {
    ctx.fillStyle = '#f4ead0'; ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x + r * 0.9, p.y - r * 0.9, 6, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(p.x + r * 0.9 - 2.5, p.y - r * 0.9 - 2.5, 2, 5); ctx.fillRect(p.x + r * 0.9 + 0.5, p.y - r * 0.9 - 2.5, 2, 5);
  }
  return { x: p.x, y: p.y, r, v: p.v };
}

function drawOrbit(ctx) {
  ctx.strokeStyle = 'rgba(230,220,190,0.22)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
  const p = proj(C, C, HS);
  ctx.beginPath(); ctx.ellipse(p.x, p.y, RS * V.s, RS * V.s * V.tilt, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
}

const bodyHit = { sun: null, moon: null };

function drawWorld(ctx, t, hover) {
  cellColors();
  renderTerrain();
  drawBackground(ctx, t);
  drawRoot(ctx);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buf, 0, 0, buf.width * V.bs, buf.height * V.bs);
  drawFalls(ctx, t);
  for (const sp of W.springs) drawSpring(ctx, sp, t);
  // 生き物（奥から）
  const items = [];
  for (const a of L.list) {
    const z = a.kind === 'fish' ? W.g[cellOf(a.x, a.y)] + W.w[cellOf(a.x, a.y)] * 0.7 : heightAt(a.x, a.y, true);
    const p = proj(a.x, a.y, z);
    items.push({ a, p });
  }
  items.sort((m, n) => m.p.v - n.p.v);
  for (const it of items) drawAnimal(ctx, it.a, it.p);
  for (const f of L.fx) {
    const p = proj(f.x, f.y, f.z);
    if (f.type === 'puff') {
      ctx.fillStyle = `rgba(235,235,225,${0.6 * (1 - f.t / 1.2)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y - V.s * 0.3, V.s * (0.4 + f.t), 0, 7); ctx.fill();
    } else {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - f.t / 2.5); ctx.translate(p.x, p.y); ctx.scale(1 - f.t * 0.3, 1 - f.t * 0.3); ctx.rotate(f.t * 2);
      drawAnimal(ctx, { kind: f.kind, dir: 0, phase: f.t }, { x: 0, y: 0 }); ctx.restore();
    }
  }
  // 足もとの印
  if (hover) {
    ctx.strokeStyle = hover.color || 'rgba(255,250,230,0.85)'; ctx.lineWidth = 1.5;
    const p = proj(hover.x, hover.y, hover.z);
    ctx.beginPath(); ctx.ellipse(p.x, p.y, hover.r * V.s, hover.r * V.s * V.tilt, 0, 0, 7); ctx.stroke();
  }
  drawOrbit(ctx);
  for (const cl of W.clouds) drawCloud(ctx, cl);
  bodyHit.sun = drawBody(ctx, W.sun, true, t);
  bodyHit.moon = drawBody(ctx, W.moon, false, t);
}
