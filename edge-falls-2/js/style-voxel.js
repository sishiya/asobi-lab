'use strict';
// 画風「ボクセル」: 区画ごとの四角い柱（高さはそろえた Zq）。画面の列ごとに、手前のふちから奥へ
//   格子を1区画ずつたどり（DDA）、柱の横の面と上の面を塗る。生き物・木・太陽と月は画素の絵、雲は箱。
//   ぜんぶを低い解像度の板に描いて、ぼかさずに広げる（画素がそろって見える）。

// ボクセルの細かさ（試験。v010。2026-10-14 ユーザー「ジャギーを和らげる処理を試験的に切り替えられるように。荒いのが味かもしれないので、まず見てみたい」）:
//   0 荒い（これまで）・1 細かい（画素の板を倍細かく。描く画素が約4倍で重くなる）・2 なめらか（細かい＋板をぼかして広げる。木や生き物の画素の絵はそのまま）。
//   設定の「ボクセル（試験）」で切りかえ。localStorage に覚える
const VOXSMOOTH_KEY = 'asobi-lab/edge-falls-2/voxsmooth';
let VOXSMOOTH = 0; try { VOXSMOOTH = Math.max(0, Math.min(2, +(localStorage.getItem(VOXSMOOTH_KEY) || 0))); } catch (e) { /* なし */ }
function setVoxSmooth(n) { VOXSMOOTH = n; try { localStorage.setItem(VOXSMOOTH_KEY, String(n)); } catch (e) { /* なし */ } buf = null; layout(V.cw, V.ch); }
const VOX = (() => {
  const STRATA = [[170, 128, 84], [142, 104, 70], [188, 152, 104], [124, 94, 70], [160, 120, 80]];
  const OUT = [0, 0, 0];
  // 整数のハッシュ（0〜1）。面の細かな模様に
  const ih = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) & 1023) / 1023; };

  function rimColor(i, zabs, dz, L, ix, iy, row) {
    let r, g, b;
    if (dz < 0.35 && W.veg[i] > 0.3) { r = 92; g = 150; b = 62; }                  // 草のふち
    else if (dz < 1) { r = SR[i]; g = SG[i]; b = SB[i]; }
    else {
      const layer = Math.floor(zabs + 40);
      const c = STRATA[layer % 5], j = 0.9 + hash2(ix * 3 + iy * 5, layer) * 0.2;
      r = c[0] * j; g = c[1] * j; b = c[2] * j;
      if ((zabs + 40) % 1 > 0.88) { r *= 0.85; g *= 0.85; b *= 0.85; }            // 段のさかい
    }
    const k = (0.5 + 0.35 * L) * Math.max(0.55, 1 - dz * 0.025);
    return rgba(r * k, g * k, b * k);
  }
  // 岩の根（v008）: 下ほど暗く（深淵へ消えていく）、左から光が当たって丸みが出る。
  //   8 ずつの段で、出っぱりの上は明るく、その下は影。ふちのすぐ下は大地のかげで暗い。
  function rootColor(t, row, sec, d, u) {
    const side = 0.78 + 0.22 * Math.max(-1, Math.min(1, -(u || 0) / (RD * 0.7)));
    // 岩のかたまり: 碁盤の目に並ばないよう、うねる横の筋と、筋ごとにずれる長さのちがう区切り（2026-10-13 ユーザー「規則正しいばんの目状に見えないように」）
    const rw = Math.floor((d + 2.5 * Math.sin(sec * 0.23 + 1.1) + 1.5 * Math.sin(sec * 0.61)) / (4 + (hash2(sec >> 3, 2) * 3 | 0)));
    const cw = 2 + (hash2(rw, 3) * 4 | 0), col = Math.floor((sec + rw * 2.7 + 1.5 * Math.sin(d * 0.17 + rw)) / cw);
    const j = 0.86 + hash2(col, rw) * 0.22 + (hash2(sec, d) - 0.5) * 0.06;
    let k = (1 - 0.82 * Math.pow(t, 0.8)) * side * j;
    // 段は向きの組ごとに間と傾きがちがう（規則的に並ばないように。2026-10-13 ユーザー）
    const g9 = sec / 9 | 0, P = 6 + (hash2(g9, 5) * 8 | 0), tilt = (hash2(g9, 6) - 0.5) * 0.9;
    const dm = ((d + sec * tilt + hash2(g9, 7) * P) % P + P) % P;
    if (dm < 1.6) k *= 1.2; else if (dm < 3.4) k *= 0.7;
    if (hash2(sec, 61) > 0.78 && t > 0.08) k *= 0.72 + 0.12 * hash2(sec, d >> 3);   // しみ出した水の筋（たての汚れ）
    if (d <= 3) k *= 0.6;
    let r = mix(112, 44, t), g = mix(92, 38, t), b = mix(74, 46, t);
    const tone = hash2(sec >> 2, (d >> 4) + 9);                                     // 岩のちがい（赤み・青み）をまだらに
    r *= 0.92 + 0.16 * tone; b *= 1.06 - 0.12 * tone;
    if (t < 0.14 && hash2(sec * 7, 3) > 0.8 && d < 4 + hash2(sec, 8) * 12) return rgba(58 * k + 10, 44 * k + 8, 30 * k + 6);   // 垂れた根
    if (t < 0.3 && hash2(sec * 5, d) > 0.975) return rgba(r * k * 0.95, g * k * 1.04, b * k * 0.92);                            // 苔（ごく淡く）
    if (hash2(sec * 3, d) > 0.97) return rgba(r * k * 1.5, g * k * 1.45, b * k * 1.3);   // ところどころ明るい岩
    return rgba(r * k, g * k, b * k);
  }



  function renderVoxel(t) {
    const BW = buf.width, BH = buf.height;
    d32.fill(0); dep.fill(-1e9);
    const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
    const sb = V.s / V.bs, cxb = V.cx / V.bs, cyb = V.cy / V.bs, hb = V.s * V.hf / V.bs, tl = V.tilt;
    const lx = Math.cos(W.sun.a), ly = Math.sin(W.sun.a);
    const R1 = RD - 0.6;
    const dx = -s, dy = -c, sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = Math.abs(dx) > 1e-9 ? Math.abs(1 / dx) : 1e9, tdy = Math.abs(dy) > 1e-9 ? Math.abs(1 / dy) : 1e9;
    const shX = 0.62 + 0.3 * Math.max(0, -sx * lx), shY = 0.62 + 0.3 * Math.max(0, -sy * ly);
    const tw = Math.floor(t * 3);
    for (let px = 0; px < BW; px++) {
      const u = (px + 0.5 - cxb) / sb;
      if (Math.abs(u) >= R1) continue;
      const ve = Math.sqrt(R1 * R1 - u * u);
      const ybot = Math.min(BH, Math.round(cyb + ve * sb * tl + THICK * hb));
      renderRoot(px, u, ybot, true, rootColor);
      const x0 = C + u * c + ve * s, y0 = C - u * s + ve * c;
      let ix = Math.floor(x0), iy = Math.floor(y0);
      let tmx = dx > 0 ? (ix + 1 - x0) / dx : dx < 0 ? (x0 - ix) / -dx : 1e9;
      let tmy = dy > 0 ? (iy + 1 - y0) / dy : dy < 0 ? (y0 - iy) / -dy : 1e9;
      let tt = 0, ybuf = ybot, first = true, axis = 1;
      const tEnd = 2 * ve;
      while (tt < tEnd && ybuf > 0) {
        const tn = Math.min(tmx, tmy, tEnd);
        const i = iy * N + ix;
        if (ix >= 0 && iy >= 0 && ix < N && iy < N && inside[i]) {
          const z = Zq[i], vF = ve - tt, vB = ve - tn;
          const base = cyb - z * hb;
          const yFr = base + vF * sb * tl;
          const yF = Math.round(yFr), yB = Math.round(base + vB * sb * tl);
          const Lm = LUM[i];
          let step = false;
          if (first) {
            for (let row = Math.max(yF, 0); row < ybuf; row++) {
              const dz = (row - yFr) / hb;
              d32[row * BW + px] = rimColor(i, z - dz, dz, Lm, ix, iy, row); dep[row * BW + px] = vF + 0.5;
            }
            if (yF < ybuf) ybuf = Math.max(yF, 0);
            first = false;
          } else if (yF < ybuf) {
            const k = Lm * (axis === 0 ? shX : shY);
            for (let row = Math.max(yF, 0); row < ybuf; row++) {
              const dz = (row - yF) / hb;
              const seam = Math.floor(dz) !== Math.floor(dz + 1 / hb) ? 0.88 : 1;
              const tex = 0.93 + 0.12 * ih(ix * 31 + iy * 17 + (axis ? 7 : 0), Math.floor((z - dz) * 3));
              const kk = k * seam * tex * (row === yF ? 1.12 : 1);
              d32[row * BW + px] = rgba(SR[i] * kk, SG[i] * kk, SB[i] * kk); dep[row * BW + px] = vF;
            }
            ybuf = Math.max(yF, 0); step = true;
          }
          const ya = Math.max(yB, 0), yz = Math.min(yF, ybuf);
          if (yz > ya) {
            const water = W.w[i] > 0.06;
            lit(TR[i], TG[i], TB[i], Lm, OUT);
            for (let row = ya; row < yz; row++) {
              let k = 1;
              if (row === yz - 1 && step) k = 1.1;                 // 段の角を明るく
              else if (row === ya && !water) k = 0.94;            // 奥のさかい
              const vv = (row + 0.5 - base) / (sb * tl), wx = C + u * c + vv * s, wy = C - u * s + vv * c;
              if (water) k *= ((Math.floor(wx * 1.5 + tw * 0.5) + Math.floor(wy * 0.75) * 3) % 5 === 0) ? 1.05 : 0.99;   // さざ波（流れる縞。強すぎると線のバグに見えるので弱く）
              else k *= 0.93 + 0.12 * ih(Math.floor(wx * 4), Math.floor(wy * 4));                                              // 土や草の粒
              let r = OUT[0] * k, g = OUT[1] * k, b = OUT[2] * k;
              if (water && Lm > 0.65 && row === ((ya + yz) >> 1) && ((HASH[i] * 97 + tw) % 13) < 0.5) { r = mix(r, 226, 0.7); g = mix(g, 238, 0.7); b = mix(b, 248, 0.7); }   // きらめき（まわりの水の色になじませる）
              d32[row * BW + px] = rgba(r, g, b); dep[row * BW + px] = vF;
            }
            ybuf = ya;
          }
        }
        if (tmx < tmy) { ix += sx; tt = tmx; tmx += tdx; axis = 0; } else { iy += sy; tt = tmy; tmy += tdy; axis = 1; }
      }
    }
  }

  // 画素の輪郭: 外がわのふちと、手前の稜線を暗く
  const edgeList = [];
  function outline() {
    const BW = buf.width, BH = buf.height;
    edgeList.length = 0;
    for (let y = 1; y < BH - 1; y++) for (let x = 1; x < BW - 1; x++) {
      const k = y * BW + x;
      if (!(d32[k] >>> 24)) continue;
      if (!(d32[k - 1] >>> 24) || !(d32[k + 1] >>> 24) || !(d32[k - BW] >>> 24) || !(d32[k + BW] >>> 24)) edgeList.push(k, 0.55);
      else if (dep[k - BW] < dep[k] - 4) edgeList.push(k, 0.78);
    }
    for (let n = 0; n < edgeList.length; n += 2) {
      const k = edgeList[n], m = edgeList[n + 1], c = d32[k];
      d32[k] = rgba((c & 255) * m, ((c >> 8) & 255) * m, ((c >> 16) & 255) * m);
    }
  }

  // 滝（v008）: となり合う滝を1枚のすだれにまとめる（柱が並んで見えないように）。明暗の帯が流れ落ち、
  //   下ほど横へ広がって薄くなり、ちぎれて粒になる。落ち口にしぶき、下に霧。
  const FC = { q: null, top: null, len: null, a: null };
  function drawFalls(t) {
    const BW = buf.width, BH = buf.height, bs = V.bs;
    if (!FC.q || FC.q.length !== BW) { FC.q = new Float32Array(BW); FC.top = new Float32Array(BW); FC.len = new Float32Array(BW); FC.a = new Float32Array(BW); FC.u = new Float32Array(BW); }
    const Q = FC.q, TOP = FC.top, LEN = FC.len, AL = FC.a, U = FC.u;
    Q.fill(0); TOP.fill(1e9);
    for (const f of fallList()) {
      const x0 = (f.top.x - f.wid / 2) / bs, x1 = (f.top.x + f.wid / 2) / bs;
      for (let X = Math.max(0, Math.floor(x0)); X <= Math.min(BW - 1, Math.ceil(x1)); X++) {
        const w = Math.max(0, Math.min(1, Math.min(X - x0, x1 - X) + 0.6));
        if (f.q * w > Q[X]) { Q[X] = f.q * w; LEN[X] = f.L / bs; AL[X] = f.a; U[X] = Math.max(0, Math.min(1, (X + 0.5 - x0) / Math.max(1, x1 - x0))); }
        TOP[X] = Math.min(TOP[X], f.top.y / bs);
      }
    }
    const sp = 34, fr = Math.floor(t * 10);
    for (let X = 0; X < BW; X++) {
      const q = Q[X]; if (q < 0.01) continue;
      const top = TOP[X], L = LEN[X], ph = hash2(X, 3) * 30;
      const edge = Q[X - 1] < q * 0.5 || Q[X + 1] < q * 0.5;
      // 厚み（v045。2026-10-14 ユーザー「滝に少し厚みを」）: 幅の中ほどほど明るく濃く（水の柱のまるみ）、右のふちの外に暗い側面
      const cyl = Math.sin(Math.PI * U[X]), shade = 0.78 + 0.3 * cyl, a0 = Math.min(0.97, (0.38 + q * 0.6) * (0.8 + 0.35 * cyl)) * AL[X];
      if (Q[X + 1] < q * 0.5 && X + 1 < BW) {                                            // 側面: 右どなりに水がなければ、暗い青の帯
        for (let yy = 0; yy < L * 0.8; yy++) {
          const f = yy / L, Y = Math.round(top + yy + 1); if (Y < 0) continue; if (Y >= BH) break;
          if (f > 0.3 && hash2((X + 1) * 7 + Math.floor((yy - t * sp) / 2), 11) < (f - 0.3) * 1.5) continue;
          blend(Y * BW + X + 1, 62, 98, 146, a0 * 0.85 * (1 - f));
        }
      }
      for (let yy = -1; yy < L; yy++) {
        const f = yy / L, Y = Math.round(top + yy);
        if (Y < 0) continue; if (Y >= BH) break;
        const flow = yy - t * sp;
        if (f > 0.3 && hash2(X * 7 + Math.floor(flow / 2), 11) < (f - 0.3) * 1.5) continue;       // ちぎれて粒に
        const band = ((flow * 0.9 + ph) % 13 + 13) % 13;
        let r = 150, g = 190, b = 228;
        if (band < 3) { r = 246; g = 250; b = 255; } else if (band < 7) { r = 194; g = 222; b = 246; }
        if (edge && f < 0.4) { r *= 0.8; g *= 0.86; b *= 0.92; }
        r = Math.min(255, r * shade); g = Math.min(255, g * shade); b = Math.min(255, b * (0.9 + 0.12 * cyl));   // 255 をこえると blend で色があふれてピンクの粒になる（v047 で直した）
        if (yy <= 1) { r = 240; g = 248; b = 255; }                                                 // 落ち口のふくらみ
        else if (yy === 2) { r = Math.min(255, r * 1.12); g = Math.min(255, g * 1.08); }            // 落ち口のふちの照り
        const dx = f > 0.15 ? Math.round((hash2(X, Math.floor(flow / 3)) - 0.5) * f * (4 + q * 6)) : 0;
        const XX = X + dx; if (XX < 0 || XX >= BW) continue;
        blend(Y * BW + XX, r, g, b, a0 * (1 - f * 0.75));
      }
      // 落ち口のしぶき・下の霧
      if (hash2(X, fr) < 0.35 * Math.min(1, q) * AL[X]) { const Y = Math.round(top - 1 - hash2(fr, X) * 3); if (Y >= 0) blend(Y * BW + X, 250, 252, 255, 0.85); }
      for (let n = 0; n < 2; n++) {
        const hy = hash2(X + n * 31, fr), Y = Math.round(top + L * (0.7 + 0.3 * hy)), XX = X + Math.round((hash2(fr, X + n) - 0.5) * 10);
        if (Y >= 0 && Y < BH && XX >= 0 && XX < BW) blend(Y * BW + XX, 226, 236, 250, 0.22 * q);
      }
    }
  }

  // ---- 画素の絵 ----
  const SPR = {
    deer: [['......a', '.....a.', '....hhd', 'wbbbbh.', '.BBBBB.', '.l...l.'], ['......a', '.....a.', '....hhd', 'wbbbbh.', '.BBBBB.', '..l.l..']],
    wolf: [['.....e..', '....hhh.', 'tbbbbhhd', 'tBBBBB..', '.l...l..'], ['.....e..', '....hhh.', 'tbbbbhhd', 'tBBBBB..', '..l.l...']],
    fish: [['t.ff.', 'tfffe', 't.ff.'], ['..ff.', 'tfffe', '..ff.']],
    bird: [['....hkk', '....n..', '...n...', '.bbbb..', 'bBBbb..', '..l....', '..l....'], ['....hkk', '....n..', '....n..', '.bbbb..', 'bBBbb..', '..l....', '..l....']],
    human: [['.hh.', '.ff.', 'tTTt', 'fTTf', '.TT.', '.l.l'], ['.hh.', '.ff.', 'tTTt', 'fTTf', '.TT.', '.ll.']],   // ヒト（v2）
    hut: ['...R...', '..RRR..', '.RRrRR.', 'RRRRRRR', '.WWdWW.', '.WWdWW.'],
    hut1: ['.......', '.......', '.......', '.......', '.T...T.', '.T...T.'],                 // 組みかけ: 柱
    hut2: ['.......', '.......', '.T...T.', 'TTTTTTT', '.TW.WT.', '.T...T.'],                 // 骨組みと壁の少し
    hut3: ['...R...', '..R.R..', '.R...R.', 'RRRRRRR', '.WWdWW.', '.WWdWW.'],                 // 屋根のふち
    birdFly: [['ww.....ww', '.wwbbbww.', '...bbbhkk'], ['.........', '..bbbbhkk', '.wwbbbww.', 'ww.....ww']],
    tree: ['..LLL..', '.LLGLL.', 'LLGLLLL', 'LLLLLDL', '.LDLLD.', '...T...', '...T...'],
    pine: ['...L...', '..LGL..', '.LLLLL.', '..LGL..', '.LLLDL.', 'LLLLLDL', '...T...'],
    sap: ['.L.', 'LGL', '.T.'],
    bare: ['..SSS..', '.SttSt.', 'tStuttt', 'tttttut', '.tuttu.', '...T...', '...T...'],   // 冬の木: 夏の木と同じ丸い形を枯れ枝の色にして、上に雪（v020。枝分かれの線だけだとシカの角に見えた。2026-10-13 ユーザー）
  };
  const PAL = {
    deer: { a: [232, 220, 192], h: [176, 122, 68], d: [58, 36, 20], b: [168, 116, 63], B: [138, 92, 48], w: [242, 234, 216], l: [90, 58, 28] },
    wolf: { e: [74, 76, 84], h: [154, 156, 164], d: [42, 42, 48], b: [139, 141, 148], B: [109, 111, 120], t: [125, 127, 136], l: [61, 63, 70] },
    fish: { t: [217, 122, 48], f: [239, 154, 74], e: [42, 26, 16] },
    human: { h: [58, 40, 30], f: [214, 168, 128], t: [188, 128, 64], T: [162, 106, 52], l: [74, 58, 44] },
    hut: { R: [184, 154, 90], r: [212, 182, 112], W: [138, 106, 68], d: [52, 36, 24], T: [112, 80, 48] },
    bird: { h: [242, 242, 236], k: [232, 192, 64], n: [216, 216, 212], b: [154, 164, 174], B: [124, 134, 144], l: [106, 90, 64], w: [200, 208, 216] },
    tree: { L: [90, 160, 67], G: [143, 208, 106], D: [63, 122, 52], T: [107, 74, 42] },
    pine: { L: [63, 127, 74], G: [106, 168, 106], D: [45, 94, 56], T: [107, 74, 42] },
    treeSpring: { L: [104, 172, 76], G: [244, 178, 204], D: [74, 136, 60], T: [107, 74, 42] },
    treeYoung: { L: [138, 196, 98], G: [190, 228, 140], D: [100, 158, 78], T: [107, 74, 42] },
    treeAutumn: { L: [214, 128, 46], G: [242, 194, 72], D: [176, 70, 40], T: [107, 74, 42] },
    bare: { T: [100, 70, 38], t: [142, 110, 60], u: [112, 84, 44], S: [236, 240, 248] },   // 枯れ枝は茶色に（灰色だと palAt の青みで紫に見えた）
    pineWinter: { L: [58, 112, 72], G: [236, 242, 248], D: [44, 88, 56], T: [107, 74, 42] },
  };
  const cache = {};
  function palAt(name, k) {
    const q = Math.round(k * 10), key = name + q;
    if (cache[key]) return cache[key];
    const o = {}, p = PAL[name];
    for (const ch in p) o[ch] = `rgb(${p[ch][0] * q / 10 | 0},${p[ch][1] * q / 10 | 0},${Math.min(255, p[ch][2] * (q / 10 + 0.1)) | 0})`;
    return (cache[key] = o);
  }
  // 遺伝子で色を変えた色見本（5段に丸めて覚えておく）
  //   シカ: 泳ぐ力→青みがかった灰色、大きさ→こい茶。オオカミ: 速さ→砂色、大きさ→こい灰。サカナ: 泳ぐ力→赤
  const TINT = { human: [], deer: [['swim', [112, 132, 150], 'bBh'], ['size', [96, 60, 30], 'bB']], wolf: [['speed', [196, 176, 132], 'bBht'], ['size', [70, 70, 78], 'bB']], fish: [['strength', [214, 64, 44], 'ft']], bird: [['size', [90, 98, 110], 'bBw'], ['beak', [240, 150, 40], 'k']] };
  function palGene(a, L) {
    const q = Math.round(L * 10), parts = TINT[a.kind].map(([g]) => Math.round(Math.max(0, a.g[g] - 0.35) / 0.65 * 4));
    const sp = a.sp || 0, key = a.kind + q + ':' + parts.join(',') + ':' + sp;
    if (cache[key]) return cache[key];
    const base = PAL[a.kind], o = {};
    for (const ch in base) {
      let [r, g, b] = base[ch];
      TINT[a.kind].forEach(([, col, chars], n) => { if (chars.includes(ch)) { const t = parts[n] / 4 * 0.75; r = mix(r, col[0], t); g = mix(g, col[1], t); b = mix(b, col[2], t); } });
      if (sp && SP_TINT[sp] && 'bBhftw'.includes(ch)) { const c = SP_TINT[sp]; r = mix(r, c[0], 0.4); g = mix(g, c[1], 0.4); b = mix(b, c[2], 0.4); }   // 種ごとの色（v2）
      o[ch] = `rgb(${r * q / 10 | 0},${g * q / 10 | 0},${Math.min(255, b * (q / 10 + 0.1)) | 0})`;
    }
    return (cache[key] = o);
  }
  // 遺伝子で形を変えた画素の絵（v2。進化を目に見えるように）: あしの速いシカ・オオカミは足が1段長く、
  //   くちばしの長いサギはくちばしが1画素長く（短いと1画素短く）。体の大きさは描く倍率（sizeK）で
  const formCache = {};
  function geneRows(kind, fr, g) {
    if (kind === 'birdFly' || !g) return kind === 'birdFly' ? SPR.birdFly[fr] : SPR[kind][fr];
    const long = (kind === 'deer' || kind === 'wolf') && g.speed > 0.6, beak = kind === 'bird' ? (g.beak > 0.6 ? 1 : g.beak < 0.4 ? -1 : 0) : 0;
    const key = kind + fr + (long ? 'L' : '') + beak;
    if (formCache[key]) return formCache[key];
    let rows = SPR[kind][fr].slice();
    if (long) rows.splice(rows.length - 1, 0, rows[rows.length - 1]);
    if (beak === 1) { rows = rows.map(r => r + '.'); rows[0] = rows[0].replace('hkk.', 'hkkk'); }
    if (beak === -1) rows[0] = rows[0].replace('hkk', 'hk.');
    return (formCache[key] = rows);
  }
  const sizeK = a => a.kind === 'human' ? 1 : a.kind === 'bird' ? 0.85 + 0.3 * a.g.size : 0.8 + 0.42 * a.g.size;
  // 木の季節（v006。2026-10-14 ユーザー「季節ごとの木の変化にアニメーションを。ぱっと切り替わりすぎないように」）:
  //   木ごとに半日ほどずらした暦（q）で、色をゆっくりまぜる（夏の緑 → 秋に少しずつ紅葉、春は若葉 → 緑、花の木は花 → 緑）。
  //   冬にはだかになるときは、その木から葉が散る（粒）。針葉樹は気温で少しずつ雪をかぶる
  const BARE = new Uint8Array(N * N); let bareInit = false;
  const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  function treeLook(it) {
    if (it.conifer) return { spr: 'pine', a: 'pine', b: 'pineWinter', t: sm((3 - W.T[it.i]) / 5) };
    const q = (seasonPhase() + (it.hi - 0.5) * 0.06 + 1) % 1, bare = q >= 0.77 || q < 0.02;
    if (bare !== !!BARE[it.i]) { if (bare && bareInit && !PRINT) leafFall(it); BARE[it.i] = bare ? 1 : 0; }
    if (bare) return { spr: 'bare', a: 'bare', b: 'bare', t: 0 };
    if (q < 0.25) return it.hi > 0.55 ? { spr: 'tree', a: 'treeSpring', b: 'tree', t: sm((q - 0.14) / 0.1) } : { spr: 'tree', a: 'treeYoung', b: 'tree', t: sm((q - 0.03) / 0.12) };
    if (q < 0.5) return { spr: 'tree', a: 'tree', b: 'tree', t: 0 };
    return { spr: 'tree', a: 'tree', b: 'treeAutumn', t: sm((q - 0.5) / 0.2) };
  }
  function leafFall(it) {
    const x = it.i % N, y = it.i / N | 0, now = performance.now();
    if (PFX.length > 150) return;
    for (let n = 0; n < 5; n++) PFX.push({ x: x + (Math.random() - 0.5) * 0.8, y: y + (Math.random() - 0.5) * 0.8, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, vz: 0, h0: 2.2 + Math.random() * 1.6, g: 1.6, t0: now + n * 180, col: ['#d6802e', '#e8b040', '#b04a28'][n % 3] });
  }
  function palMix(a, b, t, L) {
    const tq = Math.round(t * 6) / 6;
    if (tq <= 0 || a === b) return palAt(a, L);
    if (tq >= 1) return palAt(b, L);
    const q = Math.round(L * 10), key = a + '>' + b + tq + ':' + q;
    if (cache[key]) return cache[key];
    const A = PAL[a], B = PAL[b], o = {};
    for (const ch in A) { const ca = A[ch], cb = B[ch] || ca; const r = mix(ca[0], cb[0], tq), g = mix(ca[1], cb[1], tq), bl = mix(ca[2], cb[2], tq); o[ch] = `rgb(${r * q / 10 | 0},${g * q / 10 | 0},${Math.min(255, bl * (q / 10 + 0.1)) | 0})`; }
    return (cache[key] = o);
  }
  function sprite(rows, pal, cx, by, k, flip) {
    const w = rows[0].length, h = rows.length;
    const x0 = Math.round(cx - w * k / 2), y0 = Math.round(by) - h * k;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const ch = rows[r][flip ? w - 1 - c : c];
      if (ch === '.') continue;
      bctx.fillStyle = pal[ch]; bctx.fillRect(x0 + c * k, y0 + r * k, k, k);
    }
  }
  const lumAt = (x, y) => { const i = NEAR[Math.round(y) * N + Math.round(x)]; return i >= 0 ? LUM[i] : 1; };

  function pixDisk(cx, cy, R, colFn) {
    cx = Math.round(cx); cy = Math.round(cy);
    for (let y = -R - 4; y <= R + 4; y++) for (let x = -R - 4; x <= R + 4; x++) {
      const d = Math.hypot(x, y), c = colFn(x, y, d);
      if (c) { bctx.fillStyle = c; bctx.fillRect(cx + x, cy + y, 1, 1); }
    }
  }

  function drawBox(x, y, a, z0, z1, top, side1, side2) {
    const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
    const P = [[x - a, y - a], [x + a, y - a], [x + a, y + a], [x - a, y + a]];
    const lo = P.map(p => pb(p[0], p[1], z0)), hi = P.map(p => pb(p[0], p[1], z1));
    const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (let k = 0; k < 4; k++) {
      const n = N4[k];
      if (n[0] * s + n[1] * c <= 0) continue;               // 向こう向きの面は描かない
      const j = (k + 1) % 4;
      bctx.fillStyle = (n[0] !== 0) ? side1 : side2;
      bctx.beginPath(); bctx.moveTo(lo[k].x, lo[k].y); bctx.lineTo(lo[j].x, lo[j].y); bctx.lineTo(hi[j].x, hi[j].y); bctx.lineTo(hi[k].x, hi[k].y); bctx.fill();
    }
    bctx.fillStyle = top;
    bctx.beginPath(); hi.forEach((p, k) => k ? bctx.lineTo(p.x, p.y) : bctx.moveTo(p.x, p.y)); bctx.fill();
  }

  function drawCloud(cl, t) {
    const r = cloudR(cl), z = cloudZ(cl), dark = Math.min(0.4, cl.water / 90), fade = Math.min(1, cl.age / 3, cl.water / 2);
    const w = 250 - dark * 110 | 0;
    if (cl.rain > 0.12) {
      const g = pb(cl.x, cl.y, surfAt(cl.x, cl.y)), p = pb(cl.x, cl.y, z);
      bctx.fillStyle = 'rgba(150,178,214,0.38)';
      for (let k = 0; k < 10; k++) {
        const ox = (hash2(k, cl.seed) - 0.5) * r * 1.4 * V.s / V.bs, oy = ((t * 1.6 + k * 0.37) % 1) * (g.y - p.y);
        bctx.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), 1, 2);
      }
      bctx.fillStyle = 'rgba(196,216,240,0.45)';                     // 地面のはね
      for (let k = 0; k < 5; k++) if (hash2(k, Math.floor(t * 8) + cl.seed) > 0.5) {
        const ox = (hash2(k, cl.seed + 3) - 0.5) * r * 1.4 * V.s / V.bs;
        bctx.fillRect(Math.round(g.x + ox) - 1, Math.round(g.y) - 1, 1, 1); bctx.fillRect(Math.round(g.x + ox) + 1, Math.round(g.y) - 1, 1, 1);
      }
    }
    bctx.globalAlpha = 0.93 * fade;
    for (let k = 0; k < 4; k++) {
      const ox = Math.sin(cl.seed + k * 2.1) * r * 0.5, oy = Math.cos(cl.seed * 0.7 + k * 1.7) * r * 0.5;
      const a = r * (0.32 + 0.1 * ((k + cl.seed) % 2));
      drawBox(cl.x + ox, cl.y + oy, a, z + (k % 2) * 0.6, z + 1.6 + (k % 2) * 0.6, `rgb(${w},${w},${w + 4})`, `rgb(${w - 28},${w - 26},${w - 18})`, `rgb(${w - 48},${w - 46},${w - 34})`);
    }
    bctx.globalAlpha = 1;
  }

  function drawBodies(t) {
    const bs = V.bs;
    // 道すじ（点線）
    bctx.fillStyle = 'rgba(240,228,190,0.35)';
    if (!PRINT) for (const R of [RS, W.rs]) for (let k = 0; k < 96; k += 2) { const a = k / 96 * Math.PI * 2; const p = pb(C + R * Math.cos(a), C + R * Math.sin(a), HS); bctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }   // 月の道と、季節で変わる太陽の道
    for (const [key, b] of [['sun', W.sun], ['moon', W.moon]]) {
      const p = bodyPos(b), R = Math.max(4, Math.round(V.s * (key === 'sun' ? 1.9 : 1.5) / bs));
      const cx = p.x / bs, cy = p.y / bs;
      // 地へおろした線
      const OR = bodyR(b), g = pb(C + OR * Math.cos(b.a), C + OR * Math.sin(b.a), surfAt(C + OR * Math.cos(b.a), C + OR * Math.sin(b.a)));
      bctx.fillStyle = key === 'sun' ? 'rgba(255,220,120,0.35)' : 'rgba(210,220,255,0.25)';
      if (!PRINT) for (let y = Math.round(cy + R + 2); y < g.y; y += 3) bctx.fillRect(Math.round(cx), y, 1, 1);
      if (key === 'sun') {
        const ra = t * 0.4;
        pixDisk(cx, cy, R, (x, y, d) => {
          if (d <= R - 1.2) return d < R * 0.45 ? '#fff4b8' : '#ffd650';
          if (d <= R) return '#f0a030';
          if (d <= R + 3 && (x + y) % 2 === 0) return 'rgba(255,224,138,0.35)';
          const an = Math.atan2(y, x) - ra;
          if (d <= R + 4.5 && d > R + 3 && Math.abs(((an / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) < 0.12) return '#ffd650';
          return null;
        });
        const ek = eclipseK();                                        // 日食: 月の影が太陽を横切る
        if (ek > 0) { const off = Math.round(2 * R * (1 - ek)) * (sunMoonGap() < 0 ? -1 : 1); pixDisk(cx, cy, R, (x, y, d) => d <= R && Math.hypot(x - off, y) <= R - 0.6 ? '#22283c' : null); }
      } else {
        const { ph, lit: lt } = moonPhase(), sh = 2 * R * lt * (ph < Math.PI ? 1 : -1);
        pixDisk(cx, cy, R, (x, y, d) => {
          if (d > R) return null;
          if (Math.hypot(x - sh, y) <= R) return d > R - 1 ? '#3a4560' : '#2a3350';
          return d > R - 1 ? '#aab3c8' : (hash2(x + 9, y + 3) > 0.85 ? '#cfd5e2' : '#eef1f7');
        });
      }
      if ((b.stop || b.drag) && !PRINT) drawHold(key, b, g, cx, cy, R, t);       // 止めた・つかんでいる: 地面への効き目をすぐ見せる（v2）
      if (b.stop && !PRINT) { bctx.fillStyle = '#f4ead0'; bctx.fillRect(Math.round(cx + R), Math.round(cy - R - 4), 5, 5); bctx.fillStyle = '#3a2a1c'; bctx.fillRect(Math.round(cx + R) + 1, Math.round(cy - R - 3), 1, 3); bctx.fillRect(Math.round(cx + R) + 3, Math.round(cy - R - 3), 1, 3); }
      bodyHit[key] = { x: p.x, y: p.y, r: R * bs, v: p.v };
    }
  }

  // 命の光（v2。cycle.js）: 光の粒（あたたかい白）、命をのせた雲の中の光、深淵にたまった命（大地の下の暗がりに、ゆっくりただよう光）
  const LIFECOL = { human: [255, 228, 200], deer: [255, 236, 190], wolf: [226, 232, 255], fish: [255, 214, 170], bird: [236, 246, 255] };
  function glowPx(x, y, col, a) {
    x = Math.round(x); y = Math.round(y);
    const c = `${col[0]},${col[1]},${col[2]}`;
    bctx.fillStyle = `rgba(${c},${a * 0.18})`; bctx.fillRect(x - 2, y - 1, 6, 4); bctx.fillRect(x - 1, y - 2, 4, 6);   // やわらかな光のかさ
    bctx.fillStyle = `rgba(${c},${a * 0.45})`; bctx.fillRect(x - 1, y, 4, 2); bctx.fillRect(x, y - 1, 2, 4);
    bctx.fillStyle = `rgba(255,255,250,${a})`; bctx.fillRect(x, y, 2, 2);
  }
  function drawLives(t) {
    const BW = buf.width, BH = buf.height;
    for (const m of MOTES) {
      const p = pb(m.x, m.y, m.z), a = m.s === 'fall' ? Math.max(0, 1 - m.t / 2.4) : m.s === 'down' ? Math.min(1, 0.3 + m.t) : 0.9;
      glowPx(p.x, p.y + Math.sin(t * 3 + m.x) * 0.5, LIFECOL[m.k], a * (0.75 + 0.25 * Math.sin(t * 6 + m.y)));
    }
    for (const cl of W.clouds) if (cl.lives && cl.lives.length) { const p = pb(cl.x, cl.y, cloudZ(cl) + 0.8); glowPx(p.x, p.y, [255, 240, 200], 0.55 + 0.25 * Math.sin(t * 2 + cl.seed)); }
    const n = Math.min(16, abyssLifeCount());
    for (let q = 0; q < n; q++) {
      const an = hash2(q, 5) * 6.283 + t * 0.05 * (q % 2 ? 1 : -1), r = RD * (0.85 + 0.6 * hash2(q, 9)), dz = 18 + 46 * hash2(q, 13) + Math.sin(t * 0.7 + q) * 3;
      const p = pb(C + Math.cos(an) * r, C + Math.sin(an) * r, -dz), X = Math.round(p.x), Y = Math.round(p.y);
      if (X < 1 || Y < 1 || X >= BW - 1 || Y >= BH - 1 || (d32[Y * BW + X] >>> 24)) continue;   // 岩の根のうしろは描かない
      glowPx(X, Y, [255, 236, 200], 0.35 + 0.25 * Math.sin(t * 1.3 + q * 2));
    }
  }

  // 止めた太陽・月の効き目（v2。PLAYTEST #17「止める意味が伝わらない」）: 止めた・つかんだその場で、地面に印を出す。
  //   太陽: 地面まで光の柱がおり、真下に暖かい光の輪がゆっくり広がる（そこは日ざしがたまって暑く乾く）。
  //   月: 真下の地面へ向かって、水を引きよせる青い輪がちぢんでいく（潮）。大潮のときは輪が二重
  function drawHold(key, b, g, cx, cy, R, t) {
    const OR = bodyR(b), gx = C + OR * Math.cos(b.a), gy = C + OR * Math.sin(b.a), gz = surfAt(gx, gy);
    if (key === 'sun') {
      for (let y = Math.round(cy + R + 2); y < g.y; y++) { bctx.fillStyle = `rgba(255,226,140,${0.18 + 0.12 * Math.sin(t * 3 + y * 0.4)})`; bctx.fillRect(Math.round(cx) - 1, y, 3, 1); }
      for (let n = 0; n < 2; n++) {
        const ph = ((t * 0.35 + n * 0.5) % 1), r = 2 + ph * 9, a = 0.85 * (1 - ph), m = Math.max(40, Math.round(r * V.s / V.bs * 7));
        bctx.fillStyle = `rgba(255,222,130,${a})`;
        for (let q = 0; q < m; q++) { const an = q / m * 6.283, x = gx + Math.cos(an) * r, y = gy + Math.sin(an) * r, p = pb(x, y, surfAt(x, y) + 0.4); bctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      }
    } else {
      const rings = springTide() ? 2 : 1;
      for (let n = 0; n < rings; n++) {
        const ph = ((t * 0.3 + n * 0.5) % 1), r = 12 - ph * 10, a = 0.9 * (0.35 + 0.65 * ph), m = Math.max(48, Math.round(r * V.s / V.bs * 7));
        bctx.fillStyle = `rgba(196,232,255,${a})`;
        for (let q = 0; q < m; q++) { const an = q / m * 6.283, x = gx + Math.cos(an) * r, y = gy + Math.sin(an) * r; if ((x - C) ** 2 + (y - C) ** 2 > (RD - 1) ** 2) continue; const p = pb(x, y, surfAt(x, y) + 0.4); bctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      }
    }
  }

  // 遠景（v008。ユーザー「遠景がハリボテっぽい」）: 星の天球と、はるか下に広がる雲海。
  //   見る向き（yaw）と傾き（tilt）で、地平線の高さも星も雲も動く（書き割りに見えないように）。
  //   雲海は平らな雲の層を遠近で描く（遠いほど細かく、地平線でかすむ）。太陽の向きの地平線は少し暖かい色。
  //   ほかの浮島は置かない（ユーザー「チープだし、自分の浮島しかない孤独感が薄れる」）。
  //   板の画素 2 つを 1 つにした粗さで、毎コマ描く。
  const SKYF = 2;
  let sky = null, ctex = null;
  const STARS3 = Array.from({ length: 260 }, (_, k) => ({ az: hash2(k, 1) * Math.PI * 2, alt: Math.asin(hash2(k, 2)) * 0.9 + 0.02, m: hash2(k, 3) }));
  const wrapA = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
  function makeCloudTex() {
    const S = 128, base = new Float32Array(S * S);
    ctex = new Float32Array(S * S);
    for (let o = 0, amp = 0.55, cell = 32; o < 4; o++, amp *= 0.5, cell /= 2) {
      const G = S / cell, lat = Array.from({ length: G * G }, (_, k) => hash2(k + o * 999, 17));
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const gx = x / cell, gy = y / cell, xi = Math.floor(gx), yi = Math.floor(gy), fx = gx - xi, fy = gy - yi;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const v = (k1, k2) => lat[((k2 % G) * G) + (k1 % G)];
        const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
        ctex[y * S + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
    void base;
  }
  function drawSky(ctx, t) {
    const W2 = Math.ceil(buf.width / SKYF), H2 = Math.ceil(buf.height / SKYF);
    if (!sky || sky.c.width !== W2 || sky.c.height !== H2) {
      const c = document.createElement('canvas'); c.width = W2; c.height = H2;
      const x = c.getContext('2d'), im = x.createImageData(W2, H2);
      sky = { c, x, im, d: new Uint32Array(im.data.buffer) };
    }
    if (!ctex) makeCloudTex();
    const f = V.bs * SKYF, ppr = V.cw / 1.25 / f;                 // 空の画素 / ラジアン
    const el = Math.asin(V.tilt), yh = (V.cy - V.panY) / f - el * ppr * 0.9 + V.panY / f * 0.15;
    const cx = V.cw / 2 / f, look = -Math.PI / 2 - V.yaw;
    const sunD = wrapA(W.sun.a - look), wm = warmth();
    const d = sky.d, drift = t * 0.015;
    const HZ = [58 + 20 * wm, 62 + 12 * wm, 104];
    for (let y = 0; y < H2; y++) {
      const below = y >= yh;
      const beta = below ? (y - yh) / ppr + 0.006 : 0, dist = below ? 1 / Math.tan(beta) : 0;
      const alt = below ? 0 : (yh - y) / ppr;
      for (let x = 0; x < W2; x++) {
        const dAz = (x - cx) / ppr;
        const da = wrapA(dAz - sunD), sg = Math.exp(-da * da * 1.6);         // 太陽の向き
        let r, g, b;
        if (!below) {
          const k = Math.min(1, alt * 1.6);
          r = mix(HZ[0], 12, k); g = mix(HZ[1], 16, k); b = mix(HZ[2], 38, k);
          const glow = sg * Math.exp(-alt * 5) * (0.5 + 0.5 * wm);
          r += 90 * glow; g += 52 * glow; b += 18 * glow;
        } else {
          const fw = dist, lw = dAz * dist;
          const wx = fw * Math.cos(look) - lw * Math.sin(look), wy = fw * Math.sin(look) + lw * Math.cos(look);
          const n = ctex[((Math.floor((wy * 0.55) * 32) & 127) << 7) | (Math.floor((wx * 0.55 + drift) * 32) & 127)];
          const dens = Math.max(0, Math.min(1, (n - 0.42) / 0.22));
          const lit = 0.75 + 0.25 * sg;
          r = mix(16, mix(112, 200, n) * lit, dens); g = mix(16, mix(118, 204, n) * lit, dens); b = mix(34, mix(162, 236, n) * lit, dens);
          r += 40 * sg * dens * wm; g += 20 * sg * dens * wm;
          const haze = Math.min(1, dist * 0.09);                    // 遠いほど地平線の色へ
          r = mix(r, HZ[0], haze); g = mix(g, HZ[1], haze); b = mix(b, HZ[2], haze);
        }
        // 色を段に丸めて、市松でならす（画素の絵らしく）
        const dth = ((x + y) & 1) ? 3 : -3;
        d[y * W2 + x] = rgba(Math.round((r + dth) / 7) * 7, Math.round((g + dth) / 7) * 7, Math.round((b + dth) / 7) * 7);
      }
    }
    // 星（地平線より上だけ）
    for (const st of STARS3) {
      const x = Math.round(cx + wrapA(st.az - look) * ppr), y = Math.round(yh - st.alt * ppr);
      if (x < 0 || x >= W2 || y < 0 || y >= yh || y >= H2) continue;
      const tw = Math.sin(t * 1.5 + st.az * 40) > 0.7 ? 0.6 : 1;
      const v = (150 + st.m * 105) * tw;
      d[y * W2 + x] = rgba(v, v, Math.min(255, v + 20));
    }
    sky.x.putImageData(sky.im, 0, 0);
    ctx.imageSmoothingEnabled = VOXSMOOTH === 2;
    ctx.drawImage(sky.c, 0, 0, W2 * f, H2 * f);
  }

  let fire = null;
  function draw(ctx, t, hover) {
    renderVoxel(t);
    outline();
    drawFalls(t);
    bctx.putImageData(img, 0, 0);
    // 泉
    //   v066 で最初の形（v058 まで）にもどした（2026-10-14 ユーザー「最初の案に戻して」）。v059〜v065 は噴き上がり・光・線を広くする などをためした
    if (!PRINT) for (const sp of W.springs) {
      const p = pb(sp.i % N, sp.i / N | 0, Zq[sp.i]);
      bctx.fillStyle = sp.on ? '#8fc4e2' : '#6a6a6a';
      bctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 1);
      if (sp.on) { const k = Math.floor(t * 6) % 4; bctx.fillStyle = 'rgba(178,218,240,0.75)'; bctx.fillRect(Math.round(p.x), Math.round(p.y) - 2 - k, 1, 1); bctx.fillRect(Math.round(p.x) + (k % 2 ? 1 : -1), Math.round(p.y) - 1 - (k >> 1), 1, 1); }
    }
    // 木・生き物の画素の絵は、画面の上にじかに、寄り具合に合わせて途切れなく大きく描く（v030。2026-10-13 ユーザー「ある所を境に急に大きさが変わる」）。
    //   前は板の画素の整数倍（1→2→3 倍）でとんでいた。地形の板をいったん画面に広げ、その上に絵、そのあと雲・太陽と月・ホタル・足もとの輪を2枚目として重ねる
    if (!drawBackdrop(ctx, t)) drawSky(ctx, t);
    ctx.imageSmoothingEnabled = VOXSMOOTH === 2;                   // なめらか（試験）: 地形の板をぼかして広げる
    ctx.drawImage(buf, 0, 0, buf.width * V.bs, buf.height * V.bs);
    ctx.imageSmoothingEnabled = false;
    const board = bctx; bctx = pen(ctx);
    const k = Math.max(1, V.s / V.bs / 3.2);                       // 寄るほど画素の絵も大きく（小数のまま）
    for (const it of sceneItems()) {
      const bx = it.p.x / V.bs, by = it.p.y / V.bs;
      if (!(it.type === 'animal' && (it.a.kind === 'fish' || it.a.alt > 0.5))) {         // 足もとの影（落ちてくる生き物は地面に）
        const w = 5 * k, sy = it.drop ? it.ground.y / V.bs : by;
        bctx.fillStyle = 'rgba(10,14,8,0.28)'; bctx.fillRect(Math.round(bx - w / 2), Math.round(sy) - k, w, k);
      }
      if (it.type === 'hut') {                                        // ヒトの家（組みかけは柱 → 骨組み → 屋根のふち → 家。v006）
        const sp = it.b >= 1 ? SPR.hut : it.b >= 0.75 ? SPR.hut3 : it.b >= 0.5 ? SPR.hut2 : it.b > 0 ? SPR.hut1 : null;
        if (sp) sprite(sp, palAt('hut', lumAt(it.x, it.y)), bx, by, k * 1.2, false);
        continue;
      }
      if (it.type === 'fire') {                                       // 村のまんなかの火（石のかこい。夜は明るく）
        const night = LUM[NEAR[Math.round(it.y) * N + Math.round(it.x)]] < 0.55, fl = Math.floor(t * 9) % 3;
        bctx.fillStyle = '#6a6460'; bctx.fillRect(Math.round(bx) - 2 * k, Math.round(by) - k, 5 * k, k);
        if (night) { bctx.fillStyle = 'rgba(255,200,90,0.22)'; bctx.fillRect(Math.round(bx) - 3 * k, Math.round(by) - 4 * k, 7 * k, 4 * k); }
        bctx.fillStyle = fl ? '#ffb040' : '#ffe080'; bctx.fillRect(Math.round(bx), Math.round(by) - (2 + fl % 2) * k, k, (1 + fl % 2) * k);
        bctx.fillStyle = '#ff8030'; bctx.fillRect(Math.round(bx) - (fl === 1 ? k : 0), Math.round(by) - 2 * k, 2 * k, k);
        continue;
      }
      if (it.type === 'tree') {
        const L = lumAt(it.i % N, it.i / N | 0);
        const lk = treeLook(it);
        if (it.t < 0.4) sprite(SPR.sap, palAt('tree', L), bx, by, k, false);
        else sprite(SPR[lk.spr], palMix(lk.a, lk.b, lk.t, L), bx, by, k, it.hi > 0.5);
      } else {
        const a = it.a, fl = (Math.cos(a.dir) * Math.cos(V.yaw) - Math.sin(a.dir) * Math.sin(V.yaw)) < 0;
        const fr = Math.floor(a.phase * 6) % 2;
        if (a.kind === 'bird' && a.alt > 0.5) {                      // とんでいるサギ: 地面に影
          const gx = it.ground.x / V.bs, gy = it.ground.y / V.bs;
          bctx.fillStyle = 'rgba(10,14,8,0.25)'; bctx.fillRect(Math.round(gx - 3 * k), Math.round(gy) - k, 6 * k, k);
          sprite(SPR.birdFly[Math.floor(a.phase * 5) % 2], palGene(a, 1), bx, by, k * sizeK(a), fl);
        } else sprite(geneRows(a.kind, fr, a.g), palGene(a, Math.max(0.55, lumAt(a.x, a.y))), bx, by + (a.kind === 'fish' ? 1 : 0), k * sizeK(a), fl);
        if (typeof G !== 'undefined' && G.sel === a) {               // 選んだ1匹: 黄色い角かっこ
          const x0 = Math.round(bx) - 5 * k, x1 = Math.round(bx) + 4 * k, y0 = Math.round(by) - 8 * k, y1 = Math.round(by) + k;
          bctx.fillStyle = '#ffe066';
          for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { bctx.fillRect(x, y, 2 * k, k); bctx.fillRect(x + (dx < 0 ? k : 0), y + (dy > 0 ? 0 : -k), k, 2 * k); }
        }
      }
    }
    for (const f of L.fx) {
      if (f.type !== 'fall') continue;
      const p = pb(f.x, f.y, f.z);
      bctx.globalAlpha = Math.max(0, 1 - f.t / 2.5);
      sprite(SPR[f.kind][0], palAt(f.kind, 1), p.x, p.y, k, Math.floor(f.t * 4) % 2 === 0);
      bctx.globalAlpha = 1;
    }
    bctx = board; bareInit = true;
    bctx.clearRect(0, 0, buf.width, buf.height);
    // 夜の草むらにホタル
    if (!fire) { fire = []; for (let n = 0; n < 60; n++) fire.push(INS[Math.floor(hash2(n, 77) * INS.length)]); }
    fire.forEach((i, n) => {
      if (W.veg[i] < 0.5 || LUM[i] > 0.5 || Math.sin(t * 2.3 + n * 1.7) < 0.2) return;
      const x = i % N + Math.sin(t * 0.7 + n) * 0.8, y = (i / N | 0) + Math.cos(t * 0.6 + n * 2) * 0.8;
      const p = pb(x, y, Zq[i] + 1.2 + Math.sin(t * 1.5 + n) * 0.5);
      const bx = Math.round(p.x), by = Math.round(p.y);
      if (bx < 0 || by < 0 || bx >= buf.width || by >= buf.height || dep[by * buf.width + bx] > p.v + 1.5) return;
      bctx.fillStyle = 'rgba(232,255,138,0.9)'; bctx.fillRect(bx, by, 1, 1);
      bctx.fillStyle = 'rgba(232,255,138,0.3)'; bctx.fillRect(bx - 1, by, 3, 1); bctx.fillRect(bx, by - 1, 1, 3);
    });
    // 手ざわりの粒（v056。world.js の PFX）: たね・泉のしずく・削った土・盛る土。地面に着いたら 0.25 秒でうすれる
    const nowMs = performance.now();
    for (let q = PFX.length - 1; q >= 0; q--) {
      const s = PFX[q], e = (nowMs - s.t0) / 1000;
      if (e < 0) continue;
      const disc = s.vz * s.vz + 2 * s.g * s.h0, tl = (s.vz + Math.sqrt(disc)) / s.g;            // 地面に着くまでの秒
      const te = Math.min(e, tl), fade = e > tl ? 1 - (e - tl) / 0.25 : 1;
      if (fade <= 0) { PFX.splice(q, 1); continue; }
      const x = s.x + s.vx * te, y = s.y + s.vy * te, h = Math.max(0, s.h0 + s.vz * te - s.g * te * te / 2);
      const ci = NEAR[Math.round(y) * N + Math.round(x)]; if (ci < 0) { PFX.splice(q, 1); continue; }
      const p = pb(x, y, Zq[ci] + h + 0.2), X = Math.round(p.x), Y = Math.round(p.y);
      bctx.globalAlpha = 0.95 * fade; bctx.fillStyle = s.col;
      if (s.big) {                                                     // 大きな雫: 2×3 のしずく形に光（v058）
        if (e < tl) { bctx.fillRect(X, Y - 2, 1, 1); bctx.fillRect(X - 1, Y - 1, 2, 2); bctx.fillStyle = '#eef9ff'; bctx.fillRect(X - 1, Y - 1, 1, 1); }
        else if (!s.splashed) {                                        // 着いたら小さなしぶき
          s.splashed = 1; const now2 = performance.now();
          for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + Math.random() * 0.6, v = 1.2 + Math.random(); PFX.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 2.2 + Math.random(), h0: 0.1, g: 20, t0: now2, col: '#cfeaff' }); }
        }
      } else bctx.fillRect(X, Y, 1, 1);
    }
    bctx.globalAlpha = 1;
    drawLives(t);
    for (const f of L.fx) {
      const p = pb(f.x, f.y, f.z);
      if (f.type === 'born') {                                        // 子が生まれた: 小さなきらめき
        const a = 1 - f.t / 1.2, up = Math.round(f.t * 6), x = Math.round(p.x), y = Math.round(p.y) - 3 - up;
        bctx.fillStyle = 'rgba(255,236,150,' + a + ')';
        bctx.fillRect(x, y - 1, 1, 3); bctx.fillRect(x - 1, y, 3, 1);
        if (f.t > 0.3) { bctx.fillRect(x - 3, y + 2, 1, 1); bctx.fillRect(x + 3, y + 1, 1, 1); }
        continue;
      }
      if (f.type === 'spawn') {                                       // 満月の産卵: 水面に小さな光の輪（v2）
        const r = 1 + f.t * 2.5, a = 0.75 * (1 - f.t / 1.2);
        bctx.fillStyle = `rgba(214,236,255,${a})`;
        for (let q = 0; q < 8; q++) bctx.fillRect(Math.round(p.x + Math.cos(q * 0.785) * r), Math.round(p.y - 0.5 + Math.sin(q * 0.785) * r * 0.5), 1, 1);
        continue;
      }
      if (f.type === 'puff') {
        bctx.fillStyle = `rgba(235,235,225,${0.7 * (1 - f.t / 1.2)})`;
        const r = Math.round(1 + f.t * 3);
        for (let q = 0; q < 6; q++) bctx.fillRect(Math.round(p.x + Math.cos(q) * r), Math.round(p.y - 2 + Math.sin(q * 2) * r * 0.6), 1, 1);
      }
    }
    // 足もとの印（画素の輪）
    if (hover && !PRINT) {
      bctx.fillStyle = hover.color || '#fff';
      const n = Math.max(16, Math.round(hover.r * V.s / V.bs * 5));
      for (let q = 0; q < n; q++) {
        const a = q / n * Math.PI * 2, p = pb(hover.x + Math.cos(a) * hover.r, hover.y + Math.sin(a) * hover.r, hover.z + 0.3);
        bctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
    }
    for (const cl of W.clouds) drawCloud(cl, t);
    drawBodies(t);
    ctx.imageSmoothingEnabled = VOXSMOOTH === 2;
    ctx.drawImage(buf, 0, 0, buf.width * V.bs, buf.height * V.bs);
    ctx.imageSmoothingEnabled = false;
    return true;
  }
  // 板の座標（画素）で描く命令を、画面の上にじかに描く筆。四角のはしを画面の画素で丸めるので、小数の倍率でも画素の大きさがそろう
  const PEN = { c: null, fillStyle: '#000', globalAlpha: 1,
    fillRect(x, y, w, h) {
      const s = V.bs, X = Math.round(x * s), Y = Math.round(y * s);
      this.c.fillStyle = this.fillStyle; this.c.globalAlpha = this.globalAlpha;
      this.c.fillRect(X, Y, Math.round((x + w) * s) - X, Math.round((y + h) * s) - Y);
    } };
  function pen(ctx) { PEN.c = ctx; PEN.fillStyle = '#000'; PEN.globalAlpha = 1; return PEN; }

  // 札の絵（v2）: 生き物を 2D の ctx に k 倍で描く。ghost=true は「はじめの姿」の影（うすい色）
  function icon(c, a, cx, by, k, ghost) {
    const rows = geneRows(a.kind, 0, a.g), pal = ghost ? null : palGene(a, 1), kk = k * sizeK(a), w = rows[0].length, h = rows.length;
    const x0 = Math.round(cx - w * kk / 2), y0 = Math.round(by - h * kk);
    for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) {
      const ch = rows[r][q]; if (ch === '.') continue;
      c.fillStyle = ghost ? 'rgba(96,72,48,0.3)' : pal[ch]; c.fillRect(x0 + q * kk, y0 + r * kk, Math.ceil(kk), Math.ceil(kk));
    }
  }

  return { label: 'ボクセル', icon, drawsSel: true, quant: true, bs: cw => PRINT || VOXSMOOTH ? Math.max(1, Math.round(cw / 800)) : Math.max(2, Math.round(cw / 400)), draw, hover: 'rgba(255,250,230,0.85)' };
})();
STYLES.voxel = VOX;
