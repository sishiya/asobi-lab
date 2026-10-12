'use strict';
// 画風「ボクセル」: 区画ごとの四角い柱（高さはそろえた Zq）。画面の列ごとに、手前のふちから奥へ
//   格子を1区画ずつたどり（DDA）、柱の横の面と上の面を塗る。生き物・木・太陽と月は画素の絵、雲は箱。
//   ぜんぶを低い解像度の板に描いて、ぼかさずに広げる（画素がそろって見える）。

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
  function rootColor(t, row, u, d) {
    const j = 0.85 + hash2(Math.floor(u), d) * 0.3;
    const k = 1 - t * 0.6;
    return rgba(92 * j * k, 76 * j * k, 64 * j * k);
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
              if (water) k *= ((Math.floor(wx * 1.5 + tw * 0.5) + Math.floor(wy * 0.75) * 3) % 5 === 0) ? 1.1 : 0.98;   // さざ波（流れる縞）
              else k *= 0.93 + 0.12 * ih(Math.floor(wx * 4), Math.floor(wy * 4));                                              // 土や草の粒
              let r = OUT[0] * k, g = OUT[1] * k, b = OUT[2] * k;
              if (water && Lm > 0.55 && row === ((ya + yz) >> 1) && ((HASH[i] * 97 + tw) % 9) < 0.6) { r = 250; g = 252; b = 255; }
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

  function drawFalls(t) {
    const BW = buf.width, BH = buf.height, bs = V.bs;
    const fr = Math.floor(t * 10);
    for (const f of fallList()) {
      const bx0 = Math.round((f.top.x - f.wid / 2) / bs), wpx = Math.max(1, Math.round(f.wid / bs));
      const by0 = Math.round(f.top.y / bs), Lp = Math.round(f.L / bs);
      const a0 = Math.min(0.95, 0.45 + f.q * 0.5);
      for (let x = 0; x < wpx; x++) {
        const X = bx0 + x; if (X < 0 || X >= BW) continue;
        const hx = hash2(X, f.b), edge = x === 0 || x === wpx - 1;
        for (let yy = -1; yy < Lp; yy++) {
          const Y = by0 + yy; if (Y < 0) continue; if (Y >= BH) break;
          const fade = 1 - yy / Lp;
          const st = ((yy - t * 32 + hx * 40) % 9 + 9) % 9;
          let r = 182, g = 214, b = 240;
          if (st < 2.5) { r = 246; g = 250; b = 255; } else if (edge) { r = 120; g = 166; b = 208; }
          blend(Y * BW + X, r, g, b, a0 * Math.min(1, fade * 2.2));
        }
      }
      // 落ち口のしぶき
      for (let k = 0; k < Math.min(8, wpx * 2); k++) {
        const X = bx0 + Math.floor(hash2(k, f.b + fr) * wpx), Y = by0 - 1 - Math.floor(hash2(fr, k + f.b) * 3);
        if (X >= 0 && X < BW && Y >= 0 && Y < BH) blend(Y * BW + X, 248, 252, 255, 0.8);
      }
      // 霧（下のほうに、ちらちら）
      const n = Math.min(40, wpx * 5);
      for (let k = 0; k < n; k++) {
        const X = bx0 - wpx + Math.floor(hash2(k + f.b * 31, fr) * wpx * 3), Y = by0 + Math.floor(Lp * (0.45 + 0.55 * hash2(fr, k * 7 + f.b)));
        if (X >= 0 && X < BW && Y >= 0 && Y < BH) blend(Y * BW + X, 230, 240, 252, 0.3 * f.q);
      }
    }
  }

  // ---- 画素の絵 ----
  const SPR = {
    deer: [['......a', '.....a.', '....hhd', 'wbbbbh.', '.BBBBB.', '.l...l.'], ['......a', '.....a.', '....hhd', 'wbbbbh.', '.BBBBB.', '..l.l..']],
    wolf: [['.....e..', '....hhh.', 'tbbbbhhd', 'tBBBBB..', '.l...l..'], ['.....e..', '....hhh.', 'tbbbbhhd', 'tBBBBB..', '..l.l...']],
    fish: [['t.ff.', 'tfffe', 't.ff.'], ['..ff.', 'tfffe', '..ff.']],
    tree: ['..LLL..', '.LLGLL.', 'LLGLLLL', 'LLLLLDL', '.LDLLD.', '...T...', '...T...'],
    pine: ['...L...', '..LGL..', '.LLLLL.', '..LGL..', '.LLLDL.', 'LLLLLDL', '...T...'],
    sap: ['.L.', 'LGL', '.T.'],
  };
  const PAL = {
    deer: { a: [232, 220, 192], h: [176, 122, 68], d: [58, 36, 20], b: [168, 116, 63], B: [138, 92, 48], w: [242, 234, 216], l: [90, 58, 28] },
    wolf: { e: [74, 76, 84], h: [154, 156, 164], d: [42, 42, 48], b: [139, 141, 148], B: [109, 111, 120], t: [125, 127, 136], l: [61, 63, 70] },
    fish: { t: [217, 122, 48], f: [239, 154, 74], e: [42, 26, 16] },
    tree: { L: [90, 160, 67], G: [143, 208, 106], D: [63, 122, 52], T: [107, 74, 42] },
    pine: { L: [63, 127, 74], G: [106, 168, 106], D: [45, 94, 56], T: [107, 74, 42] },
  };
  const cache = {};
  function palAt(name, k) {
    const q = Math.round(k * 10), key = name + q;
    if (cache[key]) return cache[key];
    const o = {}, p = PAL[name];
    for (const ch in p) o[ch] = `rgb(${p[ch][0] * q / 10 | 0},${p[ch][1] * q / 10 | 0},${Math.min(255, p[ch][2] * (q / 10 + 0.1)) | 0})`;
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
      bctx.fillStyle = 'rgba(170,200,235,0.55)';
      for (let k = 0; k < 10; k++) {
        const ox = (hash2(k, cl.seed) - 0.5) * r * 1.4 * V.s / V.bs, oy = ((t * 1.6 + k * 0.37) % 1) * (g.y - p.y);
        bctx.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), 1, 2);
      }
      bctx.fillStyle = 'rgba(220,236,255,0.7)';                      // 地面のはね
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
    for (let k = 0; k < 96; k += 2) { const a = k / 96 * Math.PI * 2; const p = pb(C + RS * Math.cos(a), C + RS * Math.sin(a), HS); bctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    for (const [key, b] of [['sun', W.sun], ['moon', W.moon]]) {
      const p = bodyPos(b), R = Math.max(4, Math.round(V.s * (key === 'sun' ? 1.9 : 1.5) / bs));
      const cx = p.x / bs, cy = p.y / bs;
      // 地へおろした線
      const g = pb(C + RS * Math.cos(b.a), C + RS * Math.sin(b.a), surfAt(C + RS * Math.cos(b.a), C + RS * Math.sin(b.a)));
      bctx.fillStyle = key === 'sun' ? 'rgba(255,220,120,0.35)' : 'rgba(210,220,255,0.25)';
      for (let y = Math.round(cy + R + 2); y < g.y; y += 3) bctx.fillRect(Math.round(cx), y, 1, 1);
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
      } else {
        const { ph, lit: lt } = moonPhase(), sh = 2 * R * lt * (ph < Math.PI ? 1 : -1);
        pixDisk(cx, cy, R, (x, y, d) => {
          if (d > R) return null;
          if (Math.hypot(x - sh, y) <= R) return d > R - 1 ? '#3a4560' : '#2a3350';
          return d > R - 1 ? '#aab3c8' : (hash2(x + 9, y + 3) > 0.85 ? '#cfd5e2' : '#eef1f7');
        });
      }
      if (b.stop) { bctx.fillStyle = '#f4ead0'; bctx.fillRect(Math.round(cx + R), Math.round(cy - R - 4), 5, 5); bctx.fillStyle = '#3a2a1c'; bctx.fillRect(Math.round(cx + R) + 1, Math.round(cy - R - 3), 1, 3); bctx.fillRect(Math.round(cx + R) + 3, Math.round(cy - R - 3), 1, 3); }
      bodyHit[key] = { x: p.x, y: p.y, r: R * bs, v: p.v };
    }
  }

  // 空: 段々の色を市松でつなぎ（ディザ）、星雲も画素で。大きさが変わったときだけ作る
  let bg = null;
  function makeBg() {
    const BW = buf.width, BH = buf.height;
    const c = document.createElement('canvas'); c.width = BW; c.height = BH;
    const x = c.getContext('2d'), im = x.createImageData(BW, BH), d = new Uint32Array(im.data.buffer);
    const STOPS = [[27, 37, 70], [22, 30, 58], [17, 23, 46], [13, 18, 36], [10, 13, 28], [7, 9, 20], [5, 7, 14]];
    const neb = [[0.25, 0.3, 0.22, [70, 52, 110]], [0.75, 0.18, 0.18, [40, 70, 120]], [0.6, 0.75, 0.2, [60, 40, 90]]];
    for (let y = 0; y < BH; y++) for (let xx = 0; xx < BW; xx++) {
      const f = y / BH * (STOPS.length - 1), i = Math.floor(f), fr = f - i;
      const pk = fr > (((xx + y) & 1) ? 0.66 : 0.33) ? Math.min(i + 1, STOPS.length - 1) : i;
      let r = STOPS[pk][0], g = STOPS[pk][1], b = STOPS[pk][2];
      for (const [nx, ny, nr, col] of neb) {
        const dd = Math.hypot(xx / BW - nx, (y / BH - ny) * 0.7) / nr;
        if (dd < 1) { const a = (1 - dd) * 0.35, th = ((xx * 3 + y * 5) % 4) / 4; if (a > th * 0.35) { r = mix(r, col[0], a); g = mix(g, col[1], a); b = mix(b, col[2], a); } }
      }
      d[y * BW + xx] = rgba(r, g, b);
    }
    x.putImageData(im, 0, 0);
    bg = { c, w: BW, h: BH };
  }
  function drawBackground(ctx, t) {
    if (!bg || bg.w !== buf.width || bg.h !== buf.height) makeBg();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg.c, 0, 0, bg.w * V.bs, bg.h * V.bs);
    const bs = V.bs;
    for (let k = 0; k < 160; k++) {
      const x = Math.floor(((((k * 7919 % 1000) / 1000 + V.yaw / 6.283 * 0.5) % 1 + 1) % 1) * V.cw / bs) * bs;
      const y = Math.floor((k * 104729 % 997) / 997 * V.ch / bs) * bs;
      ctx.globalAlpha = 0.3 + 0.4 * (Math.sin(t * 1.3 + k * 1.7) > 0.6 ? 1 : 0.5);
      ctx.fillStyle = k % 9 === 0 ? '#ffe8b0' : '#dfe8ff';
      ctx.fillRect(x, y, bs, bs);
      if (k % 23 === 0) { ctx.globalAlpha *= 0.5; ctx.fillRect(x - bs, y, bs, bs); ctx.fillRect(x + bs, y, bs, bs); ctx.fillRect(x, y - bs, bs, bs); ctx.fillRect(x, y + bs, bs, bs); }
    }
    ctx.globalAlpha = 1;
  }

  let fire = null;
  function draw(ctx, t, hover) {
    renderVoxel(t);
    outline();
    drawFalls(t);
    bctx.putImageData(img, 0, 0);
    // 泉
    for (const sp of W.springs) {
      const p = pb(sp.i % N, sp.i / N | 0, Zq[sp.i]);
      bctx.fillStyle = sp.on ? '#d8f2ff' : '#777';
      bctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 1);
      if (sp.on) { const k = Math.floor(t * 6) % 4; bctx.fillStyle = 'rgba(220,244,255,0.9)'; bctx.fillRect(Math.round(p.x), Math.round(p.y) - 2 - k, 1, 1); bctx.fillRect(Math.round(p.x) + (k % 2 ? 1 : -1), Math.round(p.y) - 1 - (k >> 1), 1, 1); }
    }
    const k = Math.max(1, Math.round(V.s / V.bs / 4.5));
    for (const it of sceneItems()) {
      const bx = it.p.x / V.bs, by = it.p.y / V.bs;
      if (!(it.type === 'animal' && it.a.kind === 'fish')) {         // 足もとの影
        const w = 5 * k;
        bctx.fillStyle = 'rgba(10,14,8,0.28)'; bctx.fillRect(Math.round(bx - w / 2), Math.round(by) - k, w, k);
      }
      if (it.type === 'tree') {
        const L = lumAt(it.i % N, it.i / N | 0);
        if (it.t < 0.4) sprite(SPR.sap, palAt('tree', L), bx, by, k, false);
        else sprite(it.conifer ? SPR.pine : SPR.tree, palAt(it.conifer ? 'pine' : 'tree', L), bx, by, k, it.hi > 0.5);
      } else {
        const a = it.a, fl = (Math.cos(a.dir) * Math.cos(V.yaw) - Math.sin(a.dir) * Math.sin(V.yaw)) < 0;
        const fr = Math.floor(a.phase * 6) % 2;
        sprite(SPR[a.kind][fr], palAt(a.kind, Math.max(0.55, lumAt(a.x, a.y))), bx, by + (a.kind === 'fish' ? 1 : 0), k, fl);
      }
    }
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
    for (const f of L.fx) {
      const p = pb(f.x, f.y, f.z);
      if (f.type === 'born') {                                        // 子が生まれた: 小さなきらめき
        const a = 1 - f.t / 1.2, up = Math.round(f.t * 6), x = Math.round(p.x), y = Math.round(p.y) - 3 - up;
        bctx.fillStyle = 'rgba(255,236,150,' + a + ')';
        bctx.fillRect(x, y - 1, 1, 3); bctx.fillRect(x - 1, y, 3, 1);
        if (f.t > 0.3) { bctx.fillRect(x - 3, y + 2, 1, 1); bctx.fillRect(x + 3, y + 1, 1, 1); }
        continue;
      }
      if (f.type === 'puff') {
        bctx.fillStyle = `rgba(235,235,225,${0.7 * (1 - f.t / 1.2)})`;
        const r = Math.round(1 + f.t * 3);
        for (let q = 0; q < 6; q++) bctx.fillRect(Math.round(p.x + Math.cos(q) * r), Math.round(p.y - 2 + Math.sin(q * 2) * r * 0.6), 1, 1);
      } else {
        bctx.globalAlpha = Math.max(0, 1 - f.t / 2.5);
        sprite(SPR[f.kind][0], palAt(f.kind, 1), p.x, p.y, k, Math.floor(f.t * 4) % 2 === 0);
        bctx.globalAlpha = 1;
      }
    }
    // 足もとの印（画素の輪）
    if (hover) {
      bctx.fillStyle = hover.color || '#fff';
      const n = Math.max(16, Math.round(hover.r * V.s / V.bs * 5));
      for (let q = 0; q < n; q++) {
        const a = q / n * Math.PI * 2, p = pb(hover.x + Math.cos(a) * hover.r, hover.y + Math.sin(a) * hover.r, hover.z + 0.3);
        bctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
    }
    for (const cl of W.clouds) drawCloud(cl, t);
    drawBodies(t);
    drawBackground(ctx, t);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, buf.width * V.bs, buf.height * V.bs);
    return true;
  }

  return { label: 'ボクセル', quant: true, bs: cw => Math.max(2, Math.round(cw / 400)), draw, hover: 'rgba(255,250,230,0.85)' };
})();
STYLES.voxel = VOX;
