'use strict';
// 画風「サイバー」（2026-10-13 ユーザー「自然感があるのにサイバーとあえて混ぜる」）:
//   地上は自然の色（草・土・水・雪）を少し暗くしたまま、等高線と区画の格子が光る。水辺は光のふち、水面は走査線。
//   夜は草が光る（ホタルのような生物発光）。大地の断面は土の下に光る鉱脈、岩の根は回路の基板。
//   滝は光の粒が流れ落ちる。木と生き物は自然の色に光る輪郭。太陽は白く燃える芯と六角の輪、月は線の球。
//   明るい所だけを広げて重ね、ぼんやり光らせる（ブルーム）。最後に走査線。

const CYBER = (() => {
  const OUT = [0, 0, 0];
  let cnt = 0, E = null, glow = null, gctx = null, gimg = null, g32 = null, small = null, sctx = null, scan = null;

  function top(o) {
    const i = o.i, fx = o.fx, fy = o.fy;
    let r = bilin(TR, i, fx, fy), g = bilin(TG, i, fx, fy), b = bilin(TB, i, fx, fy);
    const Lm = bilin(LUM, i, fx, fy), wd = bilin(W.w, i, fx, fy), veg = bilin(W.veg, i, fx, fy);
    let lx = E.sx - o.wx, ly = E.sy - o.wy, lz = HS - o.z;
    const ll = Math.sqrt(lx*lx+ly*ly+lz*lz);
    let nx = -o.gx * 0.55, ny = -o.gy * 0.55; const nl = Math.sqrt(nx*nx+ny*ny+1*1);
    const diff = Math.max(0, (nx * lx + ny * ly + lz) / (ll * nl));
    const k = (0.36 + 0.5 * diff) * (0.9 + 0.2 * detailAt(o.wx * 0.5, o.wy * 0.5));
    // 自然の色を少し暗く、青みに
    lit(r * k * 0.9, g * k * 0.95, b * k + 6, Lm * 0.85 + 0.15, OUT);
    r = OUT[0]; g = OUT[1]; b = OUT[2];
    const night = Math.max(0, 1 - Lm * 1.6);
    const grad = Math.abs(o.gx) + Math.abs(o.gy);
    if (wd > 0.06) {
      const kw = Math.min(1, (wd - 0.06) / 0.2);
      const sl = ((Math.floor(o.wy * 3 + o.wx * 0.5 - E.t * 1.5) % 5) + 5) % 5 === 0 ? 1 : 0;
      r = mix(r, mix(r, 10, 0.6) + 10 * sl, kw); g = mix(g, mix(g, 60, 0.6) + 40 * sl, kw); b = mix(b, mix(b, 90, 0.6) + 50 * sl, kw);
      if (wd < 0.13) { const e = (1 - (wd - 0.06) / 0.07) * 0.75; r += 30 * e; g += 200 * e; b += 230 * e; }   // 水辺の光る細いふち
    } else {
      // 等高線（高さ 1.5 ごと。低い所は水色、高い所は桃色）
      const zc = o.z / 1.5, fz = zc - Math.floor(zc), w = 0.022 + grad * 0.035;
      if (fz < w) {
        const hk = Math.min(1, o.z / 14), a = Math.floor(zc) % 3 === 0 ? 0.8 : 0.4;
        r = mix(r, mix(40, 255, hk), a); g = mix(g, mix(230, 70, hk), a); b = mix(b, mix(255, 220, hk), a);
      }
      // 区画の格子（8 ごと、うすく）
      const gx = Math.abs((o.wx / 8) % 1 - 0.5), gy = Math.abs((o.wy / 8) % 1 - 0.5);
      if (gx > 0.492 || gy > 0.492) { r += 6; g += 26; b += 34; }
      // 夜の草の生物発光
      if (veg > 0.35 && night > 0) {
        const sp = detailAt(o.wx * 3.1, o.wy * 3.1 + 9);
        if (sp > 0.68) { const e = night * (sp - 0.68) * 5 * (0.6 + 0.4 * Math.sin(E.t * 2 + o.wx)); r += 60 * e; g += 255 * e; b += 140 * e; }
      }
    }
    return rgba(r, g, b);
  }

  function rimColor(row, dz, u, i) {
    if (dz < 0.5 && W.veg[i] > 0.3) return rgba(40, 92, 54);
    if (dz < 1.4) return rgba(70, 52, 40);
    const n = detailAt(u * 0.9 + 70, dz * 1.1);
    // 光る鉱脈
    if (Math.abs(n - 0.5) < 0.006) return rgba(80, 250, 255);
    if (Math.abs(n - 0.62) < 0.004) return rgba(255, 80, 220);
    const band = Math.floor(dz * 0.9 + Math.sin(u * 0.2) * 0.5), tc = [[96, 76, 60], [78, 64, 56], [104, 88, 70], [66, 58, 56]][((band % 4) + 4) % 4];
    const k = Math.max(0.35, 0.8 - dz * 0.02) * (0.8 + 0.4 * n);
    return rgba(tc[0] * k, tc[1] * k, tc[2] * k + 6);
  }
  // 岩の根: 回路の基板（横と縦の配線、節の光）
  function rootColor(t, row, sec, d, u) {
    const fade = 1 - 0.75 * Math.pow(t, 0.8);
    let r = 22 * fade, g = 26 * fade, b = 38 * fade;
    const tr = d % 9 === 0 && d > 12 && hash2(sec >> 2, d) > 0.62;
    const tv = sec % 11 === 0 && d > 10 && hash2(sec, d >> 3) > 0.45;
    if (tr || tv) {
      const pulse = 0.55 + 0.45 * Math.sin(E.t * 3 - d * 0.15 + sec * 0.7);
      r = 30 + 40 * pulse; g = 170 + 85 * pulse; b = 200 + 55 * pulse;
      if (tr && tv) { r = 255; g = 250; b = 255; }                    // 節
      r *= fade; g *= fade; b *= fade;
    }
    if (d <= 3) { r *= 0.5; g *= 0.5; b *= 0.5; }
    return rgba(r, g, b);
  }

  // 滝: 光の粒の流れ
  function drawFalls(t) {
    const BW = buf.width, BH = buf.height, bs = V.bs;
    for (const f of fallList()) {
      const x0 = (f.top.x - f.wid / 2) / bs, x1 = (f.top.x + f.wid / 2) / bs, top = f.top.y / bs, L = f.L / bs;
      const a0 = Math.min(0.9, 0.35 + f.q * 0.55) * f.a;
      for (let X = Math.floor(x0); X <= Math.ceil(x1); X++) {
        if (X < 0 || X >= BW) continue;
        const spd = (30 + hash2(X, 1) * 40) / bs, ph = hash2(X, 2) * 200;
        for (let yy = 0; yy < L; yy++) {
          const fr = yy / L, Y = Math.round(top + yy); if (Y < 0) continue; if (Y >= BH) break;
          const s = ((yy - t * spd + ph) % 24 + 24) % 24;
          let a = a0 * 0.25 * (1 - fr);
          let r = 20, g = 120, b = 200;
          if (s < 5) { a = a0 * (1 - fr * 0.8) * (1 - s / 5); r = 160; g = 255; b = 255; }
          if (fr > 0.35 && hash2(X, Math.floor((yy - t * spd) / 3)) < (fr - 0.35) * 1.4) continue;
          blend(Y * BW + X, r, g, b, a);
        }
      }
    }
  }

  // 明るい所だけ集めて、ぼんやり重ねる
  function bloom(ctx, fresh) {
    const BW = buf.width, BH = buf.height;
    if (!glow || glow.width !== BW || glow.height !== BH) {
      glow = document.createElement('canvas'); glow.width = BW; glow.height = BH;
      gctx = glow.getContext('2d'); gimg = gctx.createImageData(BW, BH); g32 = new Uint32Array(gimg.data.buffer);
      small = document.createElement('canvas'); small.width = Math.max(1, BW >> 2); small.height = Math.max(1, BH >> 2); sctx = small.getContext('2d');
    }
    if (fresh || !small.done) for (let k = 0; k < d32.length; k++) {
      const c = d32[k], r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255, m = Math.max(r, g, b);
      g32[k] = m > 170 && (m - Math.min(r, g, b)) > 70 ? c | 0xff000000 : 0;
    }
    if (fresh || !small.done) {
      gctx.putImageData(gimg, 0, 0);
      sctx.clearRect(0, 0, small.width, small.height);
      sctx.imageSmoothingEnabled = true;
      sctx.drawImage(glow, 0, 0, small.width, small.height); small.done = true;
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.4; ctx.drawImage(small, 0, 0, V.cw, V.ch);
    ctx.globalAlpha = 0.22; ctx.drawImage(small, -V.cw * 0.01, -V.ch * 0.01, V.cw * 1.02, V.ch * 1.02);
    ctx.restore();
  }

  function drawTree(ctx, it) {
    const sz = Math.max(3, V.s * (0.45 + it.t * 0.85)), { x, y } = it.p;
    const se = seasonOf(), L = 0.5 + 0.5 * LUM[it.i];
    const fillC = it.conifer ? `rgba(${30 * L | 0},${70 * L | 0},${52 * L | 0},0.95)` : se === 2 ? `rgba(${150 * L | 0},${80 * L | 0},${36 * L | 0},0.95)` : `rgba(${40 * L | 0},${90 * L | 0},${46 * L | 0},0.95)`;
    ctx.strokeStyle = 'rgba(90,255,200,0.75)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - sz * 0.5); ctx.stroke();
    if (se === 3 && !it.conifer) {
      ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.45; ctx.moveTo(x, y - sz * 0.5); ctx.lineTo(x + Math.cos(a) * sz * 0.45, y - sz * 0.5 + Math.sin(a) * sz * 0.5); } ctx.stroke(); return;
    }
    ctx.fillStyle = fillC; ctx.beginPath();
    if (it.conifer) { ctx.moveTo(x, y - sz * 1.5); ctx.lineTo(x + sz * 0.38, y - sz * 0.4); ctx.lineTo(x - sz * 0.38, y - sz * 0.4); ctx.closePath(); }
    else { for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.5; ctx.lineTo(x + Math.cos(a) * sz * 0.4, y - sz * 0.85 + Math.sin(a) * sz * 0.36); } ctx.closePath(); }
    ctx.fill(); ctx.stroke();
    if (!it.conifer) { ctx.beginPath(); ctx.moveTo(x - sz * 0.35, y - sz * 0.85); ctx.lineTo(x + sz * 0.35, y - sz * 0.85); ctx.moveTo(x, y - sz * 1.2); ctx.lineTo(x, y - sz * 0.5); ctx.strokeStyle = 'rgba(90,255,200,0.3)'; ctx.stroke(); }
  }

  function drawCloud(ctx, cl, t) {
    const r = cloudR(cl) * V.s, p = proj(cl.x, cl.y, cloudZ(cl)), fade = Math.min(1, cl.age / 3, cl.water / 2);
    if (cl.rain > 0.12) {
      const g = proj(cl.x, cl.y, surfAt(cl.x, cl.y));
      ctx.strokeStyle = 'rgba(100,220,255,0.45)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let k = 0; k < 9; k++) { const ox = (hash2(k, cl.seed) - 0.5) * r * 1.3, o2 = ((t * 1.4 + k * 0.37) % 1) * (g.y - p.y); ctx.moveTo(p.x + ox, p.y + o2); ctx.lineTo(p.x + ox, p.y + o2 + 6); }
      ctx.stroke();
    }
    ctx.save(); ctx.globalAlpha = fade;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.42, 0, 0, 7);
    ctx.fillStyle = 'rgba(200,236,255,0.16)'; ctx.fill();
    ctx.strokeStyle = 'rgba(140,240,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.clip();
    ctx.strokeStyle = 'rgba(180,245,255,0.25)';
    ctx.beginPath(); for (let yy = -r * 0.42; yy < r * 0.42; yy += 3) { ctx.moveTo(p.x - r, p.y + yy); ctx.lineTo(p.x + r, p.y + yy); } ctx.stroke();
    ctx.restore();
  }

  function drawBodies(ctx, t) {
    const o = proj(C, C, HS);
    ctx.strokeStyle = 'rgba(120,240,255,0.22)'; ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
    ctx.beginPath(); for (const R of [RS, W.rs]) { ctx.moveTo(o.x + R * V.s, o.y); ctx.ellipse(o.x, o.y, R * V.s, R * V.s * V.tilt, 0, 0, 7); } ctx.stroke(); ctx.setLineDash([]);
    for (const [key, b] of [['sun', W.sun], ['moon', W.moon]]) {
      const p = bodyPos(b), r = Math.max(9, V.s * (key === 'sun' ? 1.7 : 1.4));
      ctx.save(); ctx.translate(p.x, p.y);
      if (key === 'sun') {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 4);
        g.addColorStop(0, 'rgba(255,250,230,0.8)'); g.addColorStop(0.3, 'rgba(255,170,90,0.25)'); g.addColorStop(1, 'rgba(255,90,160,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 4, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, 7); ctx.fill();
        ctx.rotate(t * 0.3); ctx.strokeStyle = 'rgba(255,200,120,0.9)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI * 2; ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); } ctx.stroke();
        ctx.rotate(-t * 0.6); ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      } else {
        const { ph, lit: lt } = moonPhase();
        ctx.fillStyle = 'rgba(10,16,30,0.85)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
        ctx.fillStyle = 'rgba(160,220,255,0.35)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(10,16,30,0.9)'; ctx.beginPath(); ctx.arc(r * 2 * lt * (ph < Math.PI ? 1 : -1), 0, r * 1.02, 0, 7); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(150,235,255,0.85)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
        ctx.beginPath(); for (const k of [-0.5, 0, 0.5]) { ctx.moveTo(-r * Math.sqrt(1 - k * k), r * k); ctx.ellipse(0, r * k, r * Math.sqrt(1 - k * k), r * 0.12, 0, Math.PI, Math.PI * 3); } ctx.stroke();
        ctx.beginPath(); for (const k of [0.35, 0.75]) { ctx.ellipse(0, 0, r * k, r, 0, 0, 7); } ctx.stroke();
      }
      ctx.restore();
      if (b.stop) { ctx.fillStyle = '#5ff'; ctx.fillRect(p.x + r * 0.9 - 2.5, p.y - r * 0.9 - 2.5, 2, 5); ctx.fillRect(p.x + r * 0.9 + 0.5, p.y - r * 0.9 - 2.5, 2, 5); }
      bodyHit[key] = { x: p.x, y: p.y, r, v: p.v };
    }
  }

  const PAL = { deer: ['#7a5232', '#3a2616'], wolf: ['#5e6068', '#2c2e34'], fish: ['#b07038', '#4a2a10'], bird: ['#8a96a2', '#3e444c'], ink: '#6ff6ff', lw: 1 };

  function draw(ctx, t) {
    const sR = bodyR(W.sun);
    E = { t, sx: C + sR * Math.cos(W.sun.a), sy: C + sR * Math.sin(W.sun.a) };
    drawBackdrop(ctx, t);
    const fresh = V.dirty || ++cnt % 2 === 0 || !glow;
    if (fresh) { renderSurface(rimColor, rootColor, top, 0.7); drawFalls(t); bctx.putImageData(img, 0, 0); }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buf, 0, 0, buf.width * V.bs, buf.height * V.bs);
    bloom(ctx, fresh);
    for (const sp of W.springs) {
      const p = proj(sp.i % N, sp.i / N | 0, Zs[sp.i] + 0.1), k = (t * 0.8) % 1;
      ctx.strokeStyle = sp.on ? `rgba(120,250,255,${1 - k})` : 'rgba(120,120,140,0.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, V.s * (0.3 + k), V.s * (0.3 + k) * V.tilt, 0, 0, 7); ctx.stroke();
      if (sp.on) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - V.s * 2 * (1 - k)); ctx.stroke(); }
    }
    for (const it of sceneItems()) {
      if (it.type === 'tree') drawTree(ctx, it);
      else {
        if (it.ground) { ctx.strokeStyle = 'rgba(110,250,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(it.ground.x, it.ground.y, V.s * 0.4, V.s * 0.13, 0, 0, 7); ctx.stroke(); }
        drawAnimalVec(ctx, it.a, it.p, Math.max(5, V.s * (it.a.kind === 'fish' ? 0.7 : 0.95)), PAL);
      }
    }
    for (const f of L.fx) {
      const p = proj(f.x, f.y, f.z);
      if (f.type === 'puff') {                                         // 消えるときは光の粒にほどける
        ctx.fillStyle = `rgba(120,250,255,${0.8 * (1 - f.t / 1.2)})`;
        for (let q = 0; q < 8; q++) ctx.fillRect(p.x + Math.cos(q * 0.8) * V.s * (0.3 + f.t), p.y - V.s * (0.3 + f.t * 1.5) + Math.sin(q * 1.7) * V.s * 0.3, 2, 2);
      } else if (f.type === 'born') {
        ctx.strokeStyle = `rgba(160,255,200,${1 - f.t / 1.2})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, V.s * (0.2 + f.t), V.s * (0.2 + f.t) * V.tilt, 0, 0, 7); ctx.stroke();
      } else if (f.type === 'fall') { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - f.t / 2.5); drawAnimalVec(ctx, { kind: f.kind, dir: f.t * 3, phase: f.t }, p, V.s, PAL); ctx.restore(); }
    }
    for (const cl of W.clouds) drawCloud(ctx, cl, t);
    drawBodies(ctx, t);
    // 走査線
    if (!scan) { scan = document.createElement('canvas'); scan.width = 4; scan.height = 3; const x = scan.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(0, 0, 4, 1); }
    ctx.save(); ctx.fillStyle = ctx.createPattern(scan, 'repeat'); ctx.fillRect(0, 0, V.cw, V.ch); ctx.restore();
    const vg = ctx.createRadialGradient(V.cw / 2, V.ch / 2, Math.min(V.cw, V.ch) * 0.35, V.cw / 2, V.ch / 2, Math.max(V.cw, V.ch) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,0,30,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, V.cw, V.ch);
  }

  return { label: 'サイバー', back: 'neon', quant: false, bs: cw => Math.max(1.2, cw / 500), draw, hover: 'rgba(120,250,255,0.9)', selColor: '#ff5ee0' };
})();
STYLES.cyber = CYBER;
