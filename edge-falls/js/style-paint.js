'use strict';
// 画風「絵画」: なめらかな地形を下塗りにして、その色を拾った短い筆あとを重ねる（油彩ふう）。
//   筆あとは画面の決まった点に置くので、止まっているときは揺れない。見え方が変わったら全部、
//   ふだんは毎フレーム帯を1本ずつ塗り直す（地形や草の変化が少しずつ絵に入る）。
//   生き物・雲・太陽と月はその上に、やわらかい形で。最後にキャンバス布の目と、まわりを暗く。

const PAINT = (() => {
  let pc = null, pctx = null, band = 0, cnt = 0, cloth = null, sky = null;
  const BANDS = 6, SP = 4.2;               // 帯の数、筆あとの間かく（画面の画素）
  const OUT = [0, 0, 0];

  function rimColor(row, dz, u) {
    const layer = Math.floor(dz * 0.8 + Math.sin(u * 0.3) * 0.6 + 40);
    const tone = [[150, 104, 66], [176, 132, 86], [128, 92, 62], [190, 150, 100]][layer % 4];
    const k = Math.max(0.45, 0.9 - dz * 0.03);
    return rgba(tone[0] * k, tone[1] * k, tone[2] * k);
  }
  function rootColor(t) { const k = 1 - t * 0.7; return rgba(96 * k, 74 * k, 62 * k); }

  function makeCloth() {
    cloth = document.createElement('canvas'); cloth.width = cloth.height = 128;
    const c = cloth.getContext('2d'), im = c.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const v = 128 + ((x % 4 < 2) !== (y % 4 < 2) ? 18 : -18) + (hash2(x, y) - 0.5) * 50;
      const k = (y * 128 + x) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255;
    }
    c.putImageData(im, 0, 0);
  }

  // 筆あと（帯 b を塗り直す。b<0 は全部）
  function repaint(b) {
    const W2 = V.cw, H2 = V.ch, dpr = devicePixelRatio || 1;
    if (!pc || pc.width !== Math.round(W2 * dpr) || pc.height !== Math.round(H2 * dpr)) {
      pc = document.createElement('canvas'); pc.width = Math.round(W2 * dpr); pc.height = Math.round(H2 * dpr);
      pctx = pc.getContext('2d'); b = -1;
    }
    const y0 = b < 0 ? 0 : Math.floor(H2 * b / BANDS), y1 = b < 0 ? H2 : Math.ceil(H2 * (b + 1) / BANDS);
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.save();
    pctx.beginPath(); pctx.rect(0, y0, W2, y1 - y0); pctx.clip();
    pctx.clearRect(0, y0, W2, y1 - y0);
    pctx.imageSmoothingEnabled = true;
    pctx.drawImage(buf, 0, 0, buf.width * V.bs, buf.height * V.bs);
    pctx.lineCap = 'round';
    const BW = buf.width, BH = buf.height, bs = V.bs;
    const lumAt = k => { const c = d32[k]; return (c >>> 24) ? (c & 255) * 0.3 + ((c >> 8) & 255) * 0.55 + ((c >> 16) & 255) * 0.15 : -1; };
    // 2層: 大きな筆（うすく）→ 小さな筆。向きは絵の明るさの境目にそう（線が形をなぞる）
    for (const [sp, wMin, wAdd, lMin, lAdd, al] of [[7, 5, 3, 8, 6, 0.55], [4, 2.6, 1.6, 4, 4, 0.85]]) {
      const r0 = Math.floor((y0 - 10) / sp), r1 = Math.ceil((y1 + 10) / sp);
      for (let r = r0; r <= r1; r++) for (let q = 0; q < W2 / sp; q++) {
        const h = hash2(q + sp * 100, r), x = (q + h) * sp, y = (r + hash2(r, q + sp)) * sp;
        const bx = Math.floor(x / bs), by = Math.floor(y / bs);
        if (bx < 2 || by < 2 || bx >= BW - 2 || by >= BH - 2) continue;
        const k = by * BW + bx, col = d32[k];
        if (!(col >>> 24)) continue;
        // まわりと混ぜた色
        let R = 0, G = 0, B = 0, n = 0;
        for (const o of [0, 1, -1, BW, -BW]) { const c = d32[k + o]; if (c >>> 24) { R += c & 255; G += (c >> 8) & 255; B += (c >> 16) & 255; n++; } }
        R /= n; G /= n; B /= n;
        const m = (R + G + B) / 3, sat = 1.15, j = 0.96 + h * 0.08;
        R = (m + (R - m) * sat) * j; G = (m + (G - m) * sat) * j; B = (m + (B - m) * sat) * j;
        const gx = lumAt(k + 2) - lumAt(k - 2), gy = lumAt(k + 2 * BW) - lumAt(k - 2 * BW);
        const an = Math.abs(gx) + Math.abs(gy) > 12 && lumAt(k + 2) >= 0 && lumAt(k - 2) >= 0 && lumAt(k + 2 * BW) >= 0 && lumAt(k - 2 * BW) >= 0
          ? Math.atan2(gy, gx) + Math.PI / 2 + (h - 0.5) * 0.3 : -0.25 + (h - 0.5) * 0.5;
        const len = lMin + h * lAdd, wd = wMin + hash2(r * 5, q) * wAdd;
        pctx.globalAlpha = al;
        pctx.strokeStyle = `rgb(${R | 0},${G | 0},${B | 0})`; pctx.lineWidth = wd;
        pctx.beginPath(); pctx.moveTo(x - Math.cos(an) * len / 2, y - Math.sin(an) * len / 2); pctx.lineTo(x + Math.cos(an) * len / 2, y + Math.sin(an) * len / 2); pctx.stroke();
      }
    }
    pctx.globalAlpha = 1;
    pctx.restore();
  }

  function drawSky(ctx, t) {
    if (!sky || sky.w !== V.cw || sky.h !== V.ch) {
      const c = document.createElement('canvas'), dpr = devicePixelRatio || 1;
      c.width = Math.round(V.cw * dpr); c.height = Math.round(V.ch * dpr);
      const x = c.getContext('2d'); x.scale(dpr, dpr);
      const g = x.createLinearGradient(0, 0, 0, V.ch);
      g.addColorStop(0, '#2a3566'); g.addColorStop(0.45, '#1a2146'); g.addColorStop(1, '#0a0c1a');
      x.fillStyle = g; x.fillRect(0, 0, V.cw, V.ch);
      // 星雲と、空の筆あと
      for (let k = 0; k < 7; k++) {
        const cx = hash2(k, 1) * V.cw, cy = hash2(k, 2) * V.ch * 0.8, r = (0.2 + hash2(k, 3) * 0.3) * V.cw;
        const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, k % 2 ? 'rgba(120,90,160,0.18)' : 'rgba(70,110,170,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gr; x.fillRect(0, 0, V.cw, V.ch);
      }
      x.lineCap = 'round';
      for (let k = 0; k < 700; k++) {
        const px = hash2(k, 11) * V.cw, py = hash2(k, 12) * V.ch, a = Math.sin(py / V.ch * 9 + px / V.cw * 5) * 1.2;
        x.strokeStyle = `rgba(${90 + hash2(k, 14) * 60 | 0},${100 + hash2(k, 15) * 50 | 0},${170 + hash2(k, 16) * 45 | 0},0.05)`; x.lineWidth = 8 + hash2(k, 17) * 8;
        x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * 18, py + Math.sin(a) * 18, px + Math.cos(a + 0.6) * 34, py + Math.sin(a + 0.6) * 34); x.stroke();
      }
      for (let k = 0; k < 120; k++) {
        const px = hash2(k, 21) * V.cw, py = hash2(k, 22) * V.ch, r = 0.4 + hash2(k, 23) * hash2(k, 24) * 1.4;
        const gr = x.createRadialGradient(px, py, 0, px, py, r * 3);
        gr.addColorStop(0, 'rgba(255,245,220,0.9)'); gr.addColorStop(1, 'rgba(255,245,220,0)');
        x.fillStyle = gr; x.fillRect(px - r * 3, py - r * 3, r * 6, r * 6);
      }
      sky = { c, w: V.cw, h: V.ch };
    }
    ctx.drawImage(sky.c, 0, 0, V.cw, V.ch);
  }

  function drawFalls(ctx, t) {
    for (const f of fallList()) {
      const { top, wid, L, q, b } = f, al = Math.min(0.9, 0.35 + q * 0.45);
      const gr = ctx.createLinearGradient(0, top.y, 0, top.y + L);
      gr.addColorStop(0, `rgba(232,244,255,${al})`); gr.addColorStop(0.5, `rgba(190,214,240,${al * 0.6})`); gr.addColorStop(1, 'rgba(190,214,240,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(top.x - wid / 2, top.y); ctx.quadraticCurveTo(top.x - wid * 0.6, top.y + L * 0.5, top.x - wid * 0.9, top.y + L);
      ctx.lineTo(top.x + wid * 0.9, top.y + L); ctx.quadraticCurveTo(top.x + wid * 0.6, top.y + L * 0.5, top.x + wid / 2, top.y); ctx.fill();
      ctx.lineCap = 'round';
      for (let k = 0; k < 4; k++) {
        const off = ((t * 50 * (0.8 + k * 0.1) + k * 37 + b * 17) % L);
        const x = top.x - wid / 2 + ((k * 0.29 + b * 0.13) % 1) * wid;
        ctx.strokeStyle = `rgba(255,255,255,${al * (1 - off / L)})`; ctx.lineWidth = Math.max(1.5, wid * 0.15);
        ctx.beginPath(); ctx.moveTo(x, top.y + off); ctx.lineTo(x + 1, top.y + off + Math.min(L - off, V.s * 2.5)); ctx.stroke();
      }
      if (q > 0.12) for (let k = 0; k < 3; k++) {
        const ph = (t * 0.25 + k / 3 + b * 0.07) % 1;
        const rr = (wid * 0.6 + V.s * 1.3) * (0.6 + ph);
        const g2 = ctx.createRadialGradient(top.x, top.y + L * (0.4 + 0.55 * ph), 0, top.x, top.y + L * (0.4 + 0.55 * ph), rr);
        g2.addColorStop(0, `rgba(225,236,252,${0.22 * (1 - ph) * Math.min(1, q)})`); g2.addColorStop(1, 'rgba(225,236,252,0)');
        ctx.fillStyle = g2; ctx.fillRect(top.x - rr, top.y + L * (0.4 + 0.55 * ph) - rr, rr * 2, rr * 2);
      }
    }
  }

  // 木: 葉を何本かの筆で
  function drawTree(ctx, it) {
    const sz = Math.max(5, V.s * (0.7 + it.t * 1.2)), { x, y } = it.p;
    const k = 0.45 + 0.55 * LUM[it.i], h0 = it.i * 7.3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgb(${84 * k | 0},${58 * k | 0},${36 * k | 0})`; ctx.lineWidth = Math.max(1.2, sz * 0.14);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - sz * 0.6); ctx.stroke();
    const cols = it.conifer ? [[34, 74, 48], [52, 104, 64], [92, 140, 88]] : [[40, 88, 40], [74, 132, 54], [150, 196, 96]];
    const sx = Math.cos(W.sun.a + V.yaw);
    for (let n = 0; n < 9; n++) {
      const layer = n < 3 ? 0 : n < 7 ? 1 : 2, c = cols[layer];
      const a = hash2(h0, n) * Math.PI * 2, rr = sz * (0.32 - layer * 0.08) * hash2(n, h0);
      const cx = x + Math.cos(a) * rr + sx * sz * 0.08 * layer;
      const cy = y - sz * (it.conifer ? 0.7 + n * 0.09 : 0.85) + Math.sin(a) * rr * (it.conifer ? 0.4 : 0.8) - layer * sz * 0.06;
      const w2 = it.conifer ? sz * (0.5 - n * 0.04) : sz * 0.28;
      ctx.strokeStyle = `rgb(${c[0] * k | 0},${c[1] * k | 0},${c[2] * k | 0})`; ctx.lineWidth = Math.max(1.5, sz * (it.conifer ? 0.16 : 0.26));
      ctx.beginPath(); ctx.moveTo(cx - w2 / 2, cy + 0.5); ctx.lineTo(cx + w2 / 2, cy - 0.5); ctx.stroke();
    }
  }

  // 雲: 白と灰の筆を横に重ねる
  function drawCloud(ctx, cl, t) {
    const r = cloudR(cl), p = proj(cl.x, cl.y, cloudZ(cl)), fade = Math.min(1, cl.age / 3, cl.water / 2);
    const dark = Math.min(0.45, cl.water / 80);
    if (cl.rain > 0.12) {
      const g = proj(cl.x, cl.y, surfAt(cl.x, cl.y));
      ctx.strokeStyle = 'rgba(180,200,230,0.25)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k < 8; k++) { const ox = (hash2(k, cl.seed) - 0.5) * r * V.s * 1.4; ctx.moveTo(p.x + ox, p.y); ctx.lineTo(p.x + ox - 4, g.y); }
      ctx.stroke();
    }
    const sx = Math.cos(W.sun.a + V.yaw);
    ctx.lineCap = 'round';
    for (let n = 0; n < 16; n++) {
      const u = hash2(cl.seed * 10, n) * 2 - 1, v = hash2(n, cl.seed * 10) * 2 - 1;
      if (u * u + v * v > 1) continue;
      const x = p.x + u * r * V.s * 0.9, y = p.y + v * r * V.s * 0.35 - (1 - u * u) * r * V.s * 0.25;
      const lit = 0.5 + 0.5 * (u * sx - v * 0.8);
      const w = (215 + lit * 40 - dark * 100) | 0;
      ctx.strokeStyle = `rgba(${w},${w - 4},${Math.min(255, w + 10 - lit * 20)},${0.55 * fade})`;
      ctx.lineWidth = r * V.s * (0.28 + 0.15 * hash2(n, 3));
      const len = r * V.s * (0.35 + 0.3 * hash2(n, 4));
      ctx.beginPath(); ctx.moveTo(x - len / 2, y + len * 0.05); ctx.lineTo(x + len / 2, y - len * 0.05); ctx.stroke();
    }
  }

  function drawBodies(ctx, t) {
    const o = proj(C, C, HS);
    ctx.strokeStyle = 'rgba(240,226,190,0.18)'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 7]);
    ctx.beginPath(); for (const R of [RS, W.rs]) { ctx.moveTo(o.x + R * V.s, o.y); ctx.ellipse(o.x, o.y, R * V.s, R * V.s * V.tilt, 0, 0, 7); } ctx.stroke(); ctx.setLineDash([]);
    for (const [key, b] of [['sun', W.sun], ['moon', W.moon]]) {
      const p = bodyPos(b), r = Math.max(10, V.s * (key === 'sun' ? 2.1 : 1.6));
      if (key === 'sun') {
        const g = ctx.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r * 4.5);
        g.addColorStop(0, 'rgba(255,236,170,0.75)'); g.addColorStop(0.3, 'rgba(255,200,110,0.25)'); g.addColorStop(1, 'rgba(255,180,90,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 4.5, 0, 7); ctx.fill();
        const g2 = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
        g2.addColorStop(0, '#fffbe0'); g2.addColorStop(0.7, '#ffd25a'); g2.addColorStop(1, '#f2a43a');
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
      } else {
        const g = ctx.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, r * 2.5);
        g.addColorStop(0, 'rgba(200,215,255,0.25)'); g.addColorStop(1, 'rgba(200,215,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#eef0f6'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
        const { ph, lit: lt } = moonPhase();
        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.clip();
        ctx.fillStyle = 'rgba(30,38,70,0.88)'; ctx.beginPath(); ctx.arc(p.x + r * 2 * lt * (ph < Math.PI ? 1 : -1), p.y, r * 1.02, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(160,170,200,0.25)'; ctx.beginPath(); ctx.arc(p.x - r * 0.3, p.y + r * 0.2, r * 0.25, 0, 7); ctx.arc(p.x + r * 0.25, p.y - r * 0.3, r * 0.15, 0, 7); ctx.fill();
        ctx.restore();
      }
      if (b.stop) { ctx.fillStyle = '#f4ead0'; ctx.beginPath(); ctx.arc(p.x + r * 0.9, p.y - r * 0.9, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#3a2a1c'; ctx.fillRect(p.x + r * 0.9 - 2.5, p.y - r * 0.9 - 2.5, 2, 5); ctx.fillRect(p.x + r * 0.9 + 0.5, p.y - r * 0.9 - 2.5, 2, 5); }
      bodyHit[key] = { x: p.x, y: p.y, r, v: p.v };
    }
  }

  const PAL = { deer: ['#b07a44', '#5a3a1c'], wolf: ['#8e9098', '#3d3f46'], fish: ['#f0a050', '#7a3e14'], bird: ['#c4ccd4', '#5a5e66'], shadow: 'rgba(20,20,10,0.25)' };

  function draw(ctx, t) {
    drawSky(ctx, t);
    if (V.dirty || !pc) { renderSmooth(rimColor, rootColor); repaint(-1); }
    else if (++cnt % 2 === 0) {           // 2コマに1回、帯を1本ずつ塗り直す
      if (band === 0) renderSmooth(rimColor, rootColor);
      repaint(band); band = (band + 1) % BANDS;
    }
    ctx.drawImage(pc, 0, 0, V.cw, V.ch);
    drawFalls(ctx, t);
    for (const sp of W.springs) {
      const p = proj(sp.i % N, sp.i / N | 0, Zs[sp.i] + 0.2), k = (t * 0.8) % 1;
      ctx.strokeStyle = sp.on ? `rgba(220,244,255,${1 - k})` : 'rgba(120,120,120,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, V.s * (0.5 + k), V.s * (0.5 + k) * V.tilt, 0, 0, 7); ctx.stroke();
    }
    for (const it of sceneItems()) {
      if (it.type === 'tree') drawTree(ctx, it);
      else drawAnimalVec(ctx, it.a, it.p, Math.max(5, V.s * (it.a.kind === 'fish' ? 0.75 : 1)), PAL);
    }
    for (const f of L.fx) {
      const p = proj(f.x, f.y, f.z);
      if (f.type === 'puff') { ctx.fillStyle = `rgba(235,235,225,${0.6 * (1 - f.t / 1.2)})`; ctx.beginPath(); ctx.arc(p.x, p.y - V.s * 0.3, V.s * (0.4 + f.t), 0, 7); ctx.fill(); }
      else if (f.type === 'fall') { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - f.t / 2.5); drawAnimalVec(ctx, { kind: f.kind, dir: f.t * 3, phase: f.t }, p, V.s, PAL); ctx.restore(); }
    }
    for (const cl of W.clouds) drawCloud(ctx, cl, t);
    drawBodies(ctx, t);
    // 布の目と、まわりを暗く
    if (!cloth) makeCloth();
    ctx.save(); ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(cloth, 'repeat'); ctx.fillRect(0, 0, V.cw, V.ch); ctx.restore();
    const vg = ctx.createRadialGradient(V.cw / 2, V.ch / 2, Math.min(V.cw, V.ch) * 0.35, V.cw / 2, V.ch / 2, Math.max(V.cw, V.ch) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(5,5,15,0.45)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, V.cw, V.ch);
  }

  return { label: '絵画', quant: false, bs: () => 2, draw, hover: 'rgba(255,250,230,0.85)' };
})();
STYLES.paint = PAINT;
