'use strict';
// 画風「リアル」（2026-10-13 ユーザー「ルックをかえる実験をしたい」）: なめらかな地形に、太陽の向きの陰影・山のかげ・
//   地肌の細かな模様・水面の空の照り返しと日のきらめき・遠くほどかすむ空気。空は星の天球とはるか下の雲海（なめらかに）。
//   生き物・木・雲は小さく自然な色で、足もとに影。

const REAL = (() => {
  const OUT = [0, 0, 0];
  let E = null, cnt = 0, img0 = false;          // コマごとの値（太陽の向き・見る向き・空の色）

  function frameVals(t) {
    const s = Math.sin(V.yaw), c = Math.cos(V.yaw), el = Math.asin(V.tilt);
    const sR = bodyR(W.sun);
    const day = Math.max(0, Math.min(1, W.sun.light === undefined ? 1 : W.sun.light));
    const wm = warmth();
    E = {
      t, sx: C + sR * Math.cos(W.sun.a), sy: C + sR * Math.sin(W.sun.a),
      vx: s * Math.cos(el), vy: c * Math.cos(el), vz: Math.sin(el), day,
      sky: [128 + 30 * wm, 162 + 16 * wm, 208], haze: [150 + 20 * wm, 166 + 10 * wm, 190],
    };
  }

  // 上の面
  function top(o) {
    const i = o.i, fx = o.fx, fy = o.fy;
    let r = bilin(TR, i, fx, fy), g = bilin(TG, i, fx, fy), b = bilin(TB, i, fx, fy);
    const Lm = bilin(LUM, i, fx, fy), sh = bilin(SHADOW, i, fx, fy), wd = bilin(W.w, i, fx, fy);
    // 地肌の模様（大きい模様と細かい模様）
    const n1 = detailAt(o.wx * 0.35, o.wy * 0.35), n2 = detailAt(o.wx * 2.1 + 17, o.wy * 2.1);
    const tex = 0.84 + 0.2 * n1 + 0.12 * n2;
    // 太陽の向きの陰影
    let lx = E.sx - o.wx, ly = E.sy - o.wy, lz = HS - o.z;
    const ll = Math.sqrt(lx*lx+ly*ly+lz*lz); lx /= ll; ly /= ll; lz /= ll;
    let nx = -o.gx * 0.55, ny = -o.gy * 0.55, nz = 1;
    const nl = Math.sqrt(nx*nx+ny*ny+nz*nz); nx /= nl; ny /= nl; nz /= nl;
    const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
    let k = (0.42 + 0.78 * diff * (0.35 + 0.65 * sh)) * tex;
    if (wd > 0.06) {
      // 水: さざ波で面を少しゆらし、空を映し、日のきらめき
      const t = E.t, rx = detailAt(o.wx * 1.3 + t * 0.35, o.wy * 1.3) - 0.5, ry = detailAt(o.wx * 1.3 + 40, o.wy * 1.3 - t * 0.3) - 0.5;
      let wx = rx * 0.35, wy = ry * 0.35, wz = 1; const wl = Math.sqrt(wx*wx+wy*wy+wz*wz); wx /= wl; wy /= wl; wz /= wl;
      let hx = lx + E.vx, hy = ly + E.vy, hz = lz + E.vz; const hl = Math.sqrt(hx*hx+hy*hy+hz*hz); hx /= hl; hy /= hl; hz /= hl;
      const spec = Math.pow(Math.max(0, wx * hx + wy * hy + wz * hz), 90) * sh;
      const fres = 0.18 + 0.25 * (1 - E.vz);
      const kw = Math.min(1, (wd - 0.06) / 0.25);
      k = mix(k, 0.9 + 0.1 * sh, kw);
      r = mix(r, E.sky[0], fres * kw); g = mix(g, E.sky[1], fres * kw); b = mix(b, E.sky[2], fres * kw);
      r += 330 * spec * kw; g += 310 * spec * kw; b += 280 * spec * kw;
    }
    lit(r * k, g * k, b * k, Lm, OUT);
    // 遠くほどかすむ
    const fog = Math.max(0, Math.min(0.28, (-o.v + RD * 0.2) / (RD * 1.2) * 0.28));
    const hz = E.haze, nightK = Math.min(1, Lm + 0.2);
    return rgba(mix(OUT[0], hz[0] * nightK, fog), mix(OUT[1], hz[1] * nightK, fog), mix(OUT[2], hz[2] * nightK, fog));
  }

  // ふちの断面: 表土・草の根 → 砂と泥の地層（ゆれる）→ 岩
  function rimColor(row, dz, u, i) {
    let r, g, b;
    const n = detailAt(u * 0.8 + 50, dz * 0.9), wav = Math.sin(u * 0.21) * 0.5 + (n - 0.5) * 1.2;
    if (dz < 0.5 && W.veg[i] > 0.3) { r = 74; g = 104; b = 52; }
    else if (dz < 1.3) { r = 108; g = 80; b = 56; }
    else {
      const L = dz + wav, band = Math.floor(L * 0.9);
      const tones = [[168, 140, 108], [142, 116, 92], [186, 162, 128], [124, 104, 88], [156, 132, 110]];
      const tc = tones[((band % 5) + 5) % 5];
      r = tc[0]; g = tc[1]; b = tc[2];
      if ((L * 0.9) % 1 > 0.9) { r *= 0.8; g *= 0.8; b *= 0.8; }
    }
    const side = 0.7 + 0.3 * Math.max(-1, Math.min(1, -u / (RD * 0.7)));
    const k = side * Math.max(0.45, 1 - dz * 0.035) * (0.86 + 0.28 * n) * (0.45 + 0.55 * E.day);
    return rgba(r * k, g * k, b * k);
  }
  function rootColor(t, row, sec, d, u) {
    const side = 0.72 + 0.28 * Math.max(-1, Math.min(1, -(u || 0) / (RD * 0.7)));
    const n = detailAt(sec * 0.31 + (u || 0) * 0.2, d * 0.13);
    const k = (1 - 0.86 * Math.pow(t, 0.7)) * side * (0.72 + 0.5 * n) * (d <= 3 ? 0.55 : 1) * (0.45 + 0.55 * E.day);
    return rgba(mix(118, 40, t) * k, mix(104, 38, t) * k, mix(92, 46, t) * k);
  }

  // 滝: 板に描く。白い筋が流れ落ち、下ほど広がってうすく、霧へ
  function drawFalls(t) {
    const BW = buf.width, BH = buf.height, bs = V.bs;
    const sp = 40 / bs, day = 0.55 + 0.45 * E.day;
    for (const f of fallList()) {
      const x0 = (f.top.x - f.wid / 2) / bs, x1 = (f.top.x + f.wid / 2) / bs, top = f.top.y / bs, L = f.L / bs;
      const a0 = Math.min(0.92, 0.4 + f.q * 0.55) * f.a;
      for (let X = Math.floor(x0); X <= Math.ceil(x1); X++) {
        if (X < 0 || X >= BW) continue;
        const ew = Math.max(0, Math.min(1, Math.min(X - x0, x1 - X) / 1.5 + 0.3)), ph = hash2(X, 3) * 50;
        for (let yy = 0; yy < L; yy++) {
          const fr = yy / L, Y = Math.round(top + yy); if (Y < 0) continue; if (Y >= BH) break;
          const flow = yy - t * sp, st = 0.5 + 0.5 * Math.sin(flow * 0.35 / bs * 2 + ph) * Math.sin(flow * 0.11 + ph * 2);
          const spread = fr > 0.2 ? Math.round((hash2(X, Math.floor(flow / 4)) - 0.5) * fr * (3 + f.q * 6)) : 0;
          const XX = X + spread; if (XX < 0 || XX >= BW) continue;
          const v = (200 + 55 * st) * day;
          blend(Y * BW + XX, v * 0.92, v * 0.96, v, a0 * ew * (1 - fr * 0.85) * (0.6 + 0.4 * st));
        }
      }
    }
  }
  function drawMist(ctx, t) {
    for (const f of fallList()) {
      if (f.q < 0.08) continue;
      const cx = f.top.x, cy = f.top.y + f.L * 0.85, r = f.wid * 0.8 + V.s * 2 * Math.min(1.4, f.q);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const a = 0.28 * Math.min(1, f.q) * f.a * (0.5 + 0.5 * E.day);
      g.addColorStop(0, `rgba(230,238,246,${a})`); g.addColorStop(1, 'rgba(230,238,246,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }

  function drawTree(ctx, it) {
    const sz = Math.max(3, V.s * (0.45 + it.t * 0.85)), { x, y } = it.p;
    const L = Math.max(0.25, LUM[it.i]), se = seasonOf(), cold = W.T[it.i] < 2;
    const sxv = (Math.cos(W.sun.a) * Math.cos(V.yaw) - Math.sin(W.sun.a) * Math.sin(V.yaw));
    const col = (r, g, b, k = 1) => `rgb(${r * L * k | 0},${g * L * k | 0},${Math.min(255, b * (L * k + 0.1)) | 0})`;
    ctx.fillStyle = 'rgba(10,14,8,0.28)';                                        // 影（太陽と反対へ）
    ctx.beginPath(); ctx.ellipse(x - sxv * sz * 0.35, y, sz * 0.42, sz * 0.14, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = col(84, 62, 42); ctx.lineWidth = Math.max(1, sz * 0.1);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - sz * 0.55); ctx.stroke();
    if (it.conifer) {
      const snow = se === 3 || cold;
      for (let k = 0; k < 3; k++) {
        const yy = y - sz * (0.35 + k * 0.32), w = sz * (0.42 - k * 0.1);
        ctx.fillStyle = col(44, 84, 56, 0.8); ctx.beginPath(); ctx.moveTo(x, yy - sz * 0.5); ctx.lineTo(x + w, yy); ctx.lineTo(x - w, yy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = snow ? col(232, 238, 246) : col(70, 118, 76); ctx.beginPath(); ctx.moveTo(x, yy - sz * 0.5); ctx.lineTo(x + w * sxv, yy - sz * 0.08); ctx.lineTo(x + w * sxv * 0.2, yy); ctx.closePath(); ctx.fill();
      }
      return;
    }
    if (se === 3) {                                                               // 冬ははだか
      ctx.lineWidth = Math.max(0.8, sz * 0.05);
      ctx.beginPath();
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.45; ctx.moveTo(x, y - sz * 0.5); ctx.lineTo(x + Math.cos(a) * sz * 0.45, y - sz * 0.5 + Math.sin(a) * sz * 0.5); }
      ctx.stroke();
      return;
    }
    const base = se === 2 ? [190, 104, 40] : [62, 112, 48], hi = se === 2 ? [236, 168, 64] : [112, 164, 74];
    const cy = y - sz * 0.85, h0 = it.i * 3.7;
    for (let k = 0; k < 5; k++) {
      const a = hash2(h0, k) * 6.28, rr = sz * 0.18 * hash2(k, h0);
      ctx.fillStyle = col(base[0], base[1], base[2], 0.85);
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7, sz * 0.3, 0, 7); ctx.fill();
    }
    ctx.fillStyle = col(hi[0], hi[1], hi[2]);
    ctx.beginPath(); ctx.arc(x + sxv * sz * 0.12, cy - sz * 0.1, sz * 0.2, 0, 7); ctx.fill();
    if (se === 0 && it.hi > 0.55) { ctx.fillStyle = col(244, 190, 210); for (let k = 0; k < 4; k++) ctx.fillRect(x + (hash2(k, h0) - 0.5) * sz * 0.6, cy + (hash2(h0, k + 5) - 0.6) * sz * 0.4, Math.max(1, sz * 0.08), Math.max(1, sz * 0.08)); }
  }

  function drawCloud(ctx, cl, t) {
    const r = cloudR(cl) * V.s, p = proj(cl.x, cl.y, cloudZ(cl)), fade = Math.min(1, cl.age / 3, cl.water / 2);
    const dark = Math.min(0.5, cl.water / 70), day = 0.35 + 0.65 * E.day;
    if (cl.rain > 0.12) {
      const g = proj(cl.x, cl.y, surfAt(cl.x, cl.y));
      const gr = ctx.createLinearGradient(0, p.y, 0, g.y);
      gr.addColorStop(0, 'rgba(150,160,180,0.3)'); gr.addColorStop(1, 'rgba(150,160,180,0.05)');
      ctx.fillStyle = gr; ctx.fillRect(p.x - r * 0.6, p.y, r * 1.2, g.y - p.y);
    }
    // 平たい、ふちのやわらかい雲: 下に灰色の層、上に日の当たる白い層。小さなかたまりを多く重ねる
    const w = (248 - dark * 110) * day, wb = (178 - dark * 110) * day;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.5);
    for (const [layer, col, a, dy] of [[0, [wb, wb + 6, wb + 18], 0.5, r * 0.18], [1, [w, w, w + 4], 0.55, -r * 0.12]]) {
      for (let k = 0; k < 11; k++) {
        const ox = (hash2(cl.seed * 3 + k, layer) - 0.5) * r * 1.5, oy = (hash2(k, cl.seed * 3 + layer) - 0.5) * r * 0.7 + dy;
        const rr = r * (0.28 + 0.22 * hash2(k + 7, cl.seed)) * (layer ? 0.85 : 1);
        if (ox * ox / (r * r * 0.7) + oy * oy / (r * r * 0.3) > 1) continue;
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, rr);
        g.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a * fade})`);
        g.addColorStop(0.55, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a * 0.6 * fade})`);
        g.addColorStop(1, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},0)`);
        ctx.fillStyle = g; ctx.fillRect(ox - rr, oy - rr, rr * 2, rr * 2);
      }
    }
    ctx.restore();
  }

  function drawBodies(ctx, t) {
    const o = proj(C, C, HS);
    ctx.strokeStyle = 'rgba(240,230,200,0.14)'; ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
    ctx.beginPath(); for (const R of [RS, W.rs]) { ctx.moveTo(o.x + R * V.s, o.y); ctx.ellipse(o.x, o.y, R * V.s, R * V.s * V.tilt, 0, 0, 7); } ctx.stroke(); ctx.setLineDash([]);
    for (const [key, b] of [['sun', W.sun], ['moon', W.moon]]) {
      const p = bodyPos(b), r = Math.max(9, V.s * (key === 'sun' ? 1.8 : 1.4));
      if (key === 'sun') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(p.x, p.y, r * 0.3, p.x, p.y, r * 6);
        g.addColorStop(0, 'rgba(255,240,200,0.55)'); g.addColorStop(0.25, 'rgba(255,210,140,0.18)'); g.addColorStop(1, 'rgba(255,190,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 6, 0, 7); ctx.fill();
        ctx.restore();
        const g2 = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g2.addColorStop(0, '#fffef6'); g2.addColorStop(0.8, '#fff2c8'); g2.addColorStop(1, '#ffd890');
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
      } else {
        const g = ctx.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, r * 3);
        g.addColorStop(0, 'rgba(200,215,255,0.2)'); g.addColorStop(1, 'rgba(200,215,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#e6e8ee'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(150,156,172,0.45)';
        for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(p.x + (hash2(k, 1) - 0.5) * r * 1.2, p.y + (hash2(k, 2) - 0.5) * r * 1.2, r * (0.1 + hash2(k, 3) * 0.18), 0, 7); ctx.fill(); }
        const { ph, lit: lt } = moonPhase();
        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r + 0.5, 0, 7); ctx.clip();
        ctx.fillStyle = 'rgba(16,20,36,0.9)'; ctx.beginPath(); ctx.arc(p.x + r * 2 * lt * (ph < Math.PI ? 1 : -1), p.y, r * 1.04, 0, 7); ctx.fill();
        ctx.restore();
      }
      if (b.stop) { ctx.fillStyle = '#f4ead0'; ctx.beginPath(); ctx.arc(p.x + r * 0.9, p.y - r * 0.9, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#3a2a1c'; ctx.fillRect(p.x + r * 0.9 - 2.5, p.y - r * 0.9 - 2.5, 2, 5); ctx.fillRect(p.x + r * 0.9 + 0.5, p.y - r * 0.9 - 2.5, 2, 5); }
      bodyHit[key] = { x: p.x, y: p.y, r, v: p.v };
    }
  }

  const PAL = { deer: ['#9c6a3c', '#4a2e18'], wolf: ['#7e8086', '#34363c'], fish: ['#c8884a', '#5a3214'], bird: ['#a8b0b8', '#4e525a'], shadow: 'rgba(10,12,6,0.3)' };

  function draw(ctx, t) {
    frameVals(t);
    // 太陽の明るさは光の強い所で（平らな大地では夜も場所しだい）
    let lsum = 0; for (let k = 0; k < INS.length; k += 37) lsum += W.light[INS[k]]; E.day = Math.min(1, lsum / Math.ceil(INS.length / 37) * 1.6);
    updateShadow(t);
    if (!drawBackdrop(ctx, t)) BACKS.clouds.back(ctx, t);
    if (V.dirty || ++cnt % 2 === 0 || !img0) { renderSurface(rimColor, rootColor, top, 0.78); drawFalls(t); bctx.putImageData(img, 0, 0); img0 = true; }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buf, 0, 0, buf.width * V.bs, buf.height * V.bs);
    drawMist(ctx, t);
    for (const sp of W.springs) {
      const p = proj(sp.i % N, sp.i / N | 0, Zs[sp.i] + 0.1), k = (t * 0.7) % 1;
      ctx.strokeStyle = sp.on ? `rgba(220,240,255,${0.8 * (1 - k)})` : 'rgba(110,110,110,0.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, V.s * (0.3 + k * 0.8), V.s * (0.3 + k * 0.8) * V.tilt, 0, 0, 7); ctx.stroke();
    }
    for (const it of sceneItems()) {
      if (it.type === 'tree') drawTree(ctx, it);
      else {
        if (it.ground) { ctx.fillStyle = 'rgba(10,12,6,0.22)'; ctx.beginPath(); ctx.ellipse(it.ground.x, it.ground.y, V.s * 0.4, V.s * 0.12, 0, 0, 7); ctx.fill(); }
        drawAnimalVec(ctx, it.a, it.p, Math.max(4, V.s * (it.a.kind === 'fish' ? 0.6 : 0.85)), PAL);
      }
    }
    for (const f of L.fx) {
      const p = proj(f.x, f.y, f.z);
      if (f.type === 'puff') { ctx.fillStyle = `rgba(230,230,224,${0.5 * (1 - f.t / 1.2)})`; ctx.beginPath(); ctx.arc(p.x, p.y - V.s * 0.3, V.s * (0.3 + f.t * 0.8), 0, 7); ctx.fill(); }
      else if (f.type === 'fall') { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - f.t / 2.5); drawAnimalVec(ctx, { kind: f.kind, dir: f.t * 3, phase: f.t }, p, V.s * 0.85, PAL); ctx.restore(); }
    }
    for (const cl of W.clouds) drawCloud(ctx, cl, t);
    drawBodies(ctx, t);
    const vg = ctx.createRadialGradient(V.cw / 2, V.ch / 2, Math.min(V.cw, V.ch) * 0.4, V.cw / 2, V.ch / 2, Math.max(V.cw, V.ch) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,0.3)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, V.cw, V.ch);
  }

  return { label: 'リアル', back: 'clouds', quant: false, bs: cw => Math.max(1.2, cw / 500), draw, hover: 'rgba(255,250,230,0.85)' };
})();
STYLES.real = REAL;
