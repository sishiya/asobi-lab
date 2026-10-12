'use strict';
// 画風「銅版画」: 手で色をつけた古い銅版画の地図ふう（天をまわす箱庭と同じ系統）。
//   なめらかな地形を描いたあと、画素ごとに「明るさ」でハッチング（斜めの線・交差線・点）に置きかえ、
//   色は羊皮紙に薄く。水は横線、ふちと稜線はインクの線。生き物・木・雲・太陽と月は線画。

const ETCH = (() => {
  const PAPER = [239, 227, 196], INK = [58, 42, 28], INKW = [44, 62, 92];
  let bg = null;

  function rimColor(row, dz, u) {
    const layer = Math.floor(dz * 0.8 + Math.sin(u * 0.3) * 0.5 + 40);
    const tone = [[196, 160, 112], [170, 128, 88], [206, 178, 130], [150, 112, 80]][layer % 4];
    const k = Math.max(0.5, 0.92 - dz * 0.02);
    return rgba(tone[0] * k, tone[1] * k, tone[2] * k);
  }
  function rootColor(t) { const k = 0.75 - t * 0.45; return rgba(150 * k, 120 * k, 96 * k); }

  // 画素をハッチングに置きかえる
  function engrave() {
    const BW = buf.width, BH = buf.height;
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      const k = y * BW + x, c = d32[k];
      if (!(c >>> 24)) continue;
      const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
      const lum = Math.min(1, (0.3 * r + 0.55 * g + 0.15 * b) / 230 * 1.32);
      const water = b > r + 25 && b > g - 10;
      // 薄く色をつけた紙
      // 水彩の色のせ: 色をうすめて紙にかける
      let R = PAPER[0] * (1 - (255 - r) * 0.5 / 255), G = PAPER[1] * (1 - (255 - g) * 0.5 / 255), B = PAPER[2] * (1 - (255 - b) * 0.55 / 255);
      let ink = false, inkC = INK;
      if (water) {
        inkC = INKW;
        if (y % 4 === 0 && lum < 0.95 && ((x + (y >> 2) * 3) % 9) > 1) ink = true;
        if (y % 4 === 2 && lum < 0.55 && ((x + y) % 7) > 2) ink = true;
      } else {
        if ((x + y) % 6 === 0 && lum < 0.82) ink = true;
        if ((x - y + 12000) % 6 === 0 && lum < 0.46) ink = true;
        if ((x + y) % 6 === 3 && lum < 0.3) ink = true;
        if (lum < 0.14) ink = true;
      }
      // 輪郭（近さがとぶ所）
      const dk = dep[k];
      if (y + 1 < BH && !(d32[k + BW] >>> 24)) ink = true;
      else if (y > 0 && dep[k - BW] < dk - 1.2) ink = true;
      else if (x > 0 && !(d32[k - 1] >>> 24)) ink = true;
      else if (x + 1 < BW && !(d32[k + 1] >>> 24)) ink = true;
      if (ink) { R = mix(R, inkC[0], 0.85); G = mix(G, inkC[1], 0.85); B = mix(B, inkC[2], 0.85); }
      d32[k] = rgba(R, G, B);
    }
  }

  function drawBackground(ctx, t) {
    if (!bg || bg.w !== V.cw || bg.h !== V.ch) {
      const c = document.createElement('canvas'), dpr = devicePixelRatio || 1;
      c.width = Math.round(V.cw * dpr); c.height = Math.round(V.ch * dpr);
      const x = c.getContext('2d'); x.scale(dpr, dpr);
      x.fillStyle = '#ece0bf'; x.fillRect(0, 0, V.cw, V.ch);
      // 紙のしみ
      for (let k = 0; k < 14; k++) {
        const cx = hash2(k, 5) * V.cw, cy = hash2(k, 6) * V.ch, r = (0.1 + hash2(k, 7) * 0.3) * V.cw;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(170,130,70,0.10)'); g.addColorStop(1, 'rgba(170,130,70,0)');
        x.fillStyle = g; x.fillRect(0, 0, V.cw, V.ch);
      }
      // 深淵: 横線のハッチングを下ほど濃く
      x.strokeStyle = 'rgba(58,42,28,0.55)'; x.lineWidth = 0.7;
      for (let y = 0; y < V.ch; y += 3) {
        const dens = y / V.ch;
        x.beginPath();
        for (let xx = 0; xx < V.cw; xx += 6) if (hash2(xx, y) < dens * 0.9) { x.moveTo(xx, y); x.lineTo(xx + 5, y); }
        x.stroke();
      }
      // 星（十字と点）
      x.strokeStyle = '#3a2a1c'; x.fillStyle = '#3a2a1c'; x.lineWidth = 0.8;
      for (let k = 0; k < 70; k++) {
        const px = hash2(k, 31) * V.cw, py = hash2(k, 32) * V.ch * 0.7, r = 1.5 + hash2(k, 33) * 3;
        x.beginPath(); x.moveTo(px - r, py); x.lineTo(px + r, py); x.moveTo(px, py - r); x.lineTo(px, py + r); x.stroke();
      }
      // 外の飾り枠
      x.lineWidth = 2; x.strokeRect(8, 8, V.cw - 16, V.ch - 16); x.lineWidth = 0.8; x.strokeRect(13, 13, V.cw - 26, V.ch - 26);
      bg = { c, w: V.cw, h: V.ch };
    }
    ctx.drawImage(bg.c, 0, 0, V.cw, V.ch);
  }

  function drawFalls(ctx, t) {
    ctx.lineCap = 'round';
    for (const f of fallList()) {
      const { top, wid, L, q, b } = f;
      ctx.fillStyle = 'rgba(239,231,206,0.9)';
      ctx.fillRect(top.x - wid / 2, top.y, wid, L * 0.75);
      const n = Math.max(2, Math.round(wid / 3));
      ctx.strokeStyle = '#2c3e5c'; ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const x = top.x - wid / 2 + wid * k / n;
        for (let y = 0; y < L * 0.9; y += 7) {
          const off = (y + t * 30 + k * 5 + b * 3) % 7;
          if (hash2(k + b * 9, Math.floor((y + t * 30) / 7)) < 0.25 + (1 - y / L) * 0.7) { ctx.moveTo(x + Math.sin((y + off) * 0.3) * 0.6, top.y + y + off); ctx.lineTo(x, top.y + y + off + 4); }
        }
      }
      ctx.stroke();
      // 霧の点描
      ctx.fillStyle = '#3a2a1c';
      for (let k = 0; k < 18 * Math.min(1, q); k++) {
        const x = top.x + (hash2(k, b + Math.floor(t * 4)) - 0.5) * wid * 3, y = top.y + L * (0.6 + 0.4 * hash2(b, k + Math.floor(t * 4)));
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function drawTree(ctx, it) {
    const sz = Math.max(4, V.s * (0.5 + it.t * 0.9)), { x, y } = it.p;
    ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - sz * 0.6); ctx.stroke();
    ctx.fillStyle = it.conifer ? '#a9b58a' : '#b9c48e';
    ctx.beginPath();
    if (it.conifer) { ctx.moveTo(x, y - sz * 1.6); ctx.lineTo(x + sz * 0.4, y - sz * 0.45); ctx.lineTo(x - sz * 0.4, y - sz * 0.45); ctx.closePath(); }
    else { for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; ctx.arc(x + Math.cos(a) * sz * 0.28, y - sz * 0.85 + Math.sin(a) * sz * 0.25, sz * 0.2, a - 1.6, a + 1.6); } ctx.closePath(); }
    ctx.fill(); ctx.stroke();
    // 影のがわにハッチ
    ctx.beginPath();
    for (let k = 1; k < 4; k++) { ctx.moveTo(x + sz * 0.05 * k, y - sz * (it.conifer ? 0.55 : 0.7)); ctx.lineTo(x + sz * (0.1 + 0.08 * k), y - sz * (it.conifer ? 0.85 : 1.0)); }
    ctx.stroke();
  }

  function drawCloud(ctx, cl) {
    const r = cloudR(cl) * V.s, p = proj(cl.x, cl.y, cloudZ(cl)), fade = Math.min(1, cl.age / 3, cl.water / 2);
    ctx.save(); ctx.globalAlpha = fade;
    ctx.fillStyle = '#f2e9cf'; ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 1;
    const n = 7;
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      const a = Math.PI + k / n * Math.PI, bx = p.x + Math.cos(a) * r, by = p.y + Math.sin(a) * r * 0.55;
      if (k === 0) ctx.moveTo(bx, by); else { const pa = Math.PI + (k - 0.5) / n * Math.PI; ctx.quadraticCurveTo(p.x + Math.cos(pa) * r * 1.35, p.y + Math.sin(pa) * r * 0.85, bx, by); }
    }
    ctx.quadraticCurveTo(p.x, p.y + r * 0.35, p.x - r, p.y); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) { ctx.moveTo(p.x + k * r * 0.3, p.y + r * 0.05); ctx.lineTo(p.x + k * r * 0.3 + r * 0.15, p.y - r * 0.12); }
    ctx.lineWidth = 0.6; ctx.stroke();
    if (cl.rain > 0.12) {
      const g = proj(cl.x, cl.y, surfAt(cl.x, cl.y));
      ctx.beginPath();
      for (let k = 0; k < 7; k++) { const x = p.x + (k - 3) * r * 0.22; for (let y = p.y + r * 0.3; y < g.y; y += 9) { ctx.moveTo(x, y); ctx.lineTo(x - 1.5, y + 4); } }
      ctx.lineWidth = 0.6; ctx.stroke();
    }
    ctx.restore();
  }

  function drawBodies(ctx, t) {
    const o = proj(C, C, HS);
    ctx.strokeStyle = 'rgba(58,42,28,0.5)'; ctx.lineWidth = 0.8; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.ellipse(o.x, o.y, RS * V.s, RS * V.s * V.tilt, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    for (const [key, b] of [['sun', W.sun], ['moon', W.moon]]) {
      const p = bodyPos(b), r = Math.max(11, V.s * (key === 'sun' ? 2 : 1.6));
      ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 1.2;
      if (key === 'sun') {
        ctx.fillStyle = '#efc65a';
        ctx.beginPath();
        for (let k = 0; k < 16; k++) {
          const a = k / 16 * Math.PI * 2 + t * 0.1, a2 = a + Math.PI / 16;
          ctx.moveTo(p.x + Math.cos(a - 0.12) * r * 1.1, p.y + Math.sin(a - 0.12) * r * 1.1);
          ctx.lineTo(p.x + Math.cos(a) * r * (k % 2 ? 1.6 : 1.9), p.y + Math.sin(a) * r * (k % 2 ? 1.6 : 1.9));
          ctx.lineTo(p.x + Math.cos(a + 0.12) * r * 1.1, p.y + Math.sin(a + 0.12) * r * 1.1);
          void a2;
        }
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f3d77a'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); ctx.stroke();
        // おだやかな顔
        ctx.beginPath(); ctx.arc(p.x - r * 0.33, p.y - r * 0.15, r * 0.14, Math.PI * 1.1, Math.PI * 1.9); ctx.moveTo(p.x + r * 0.47, p.y - r * 0.15); ctx.arc(p.x + r * 0.33, p.y - r * 0.15, r * 0.14, Math.PI * 1.1 + 0.05, Math.PI * 1.9);
        ctx.moveTo(p.x - r * 0.35, p.y + r * 0.25); ctx.quadraticCurveTo(p.x, p.y + r * 0.55, p.x + r * 0.35, p.y + r * 0.25); ctx.stroke();
      } else {
        const { ph, lit: lt } = moonPhase();
        ctx.fillStyle = '#e8e2cc'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.clip();
        const sx = p.x + r * 2 * lt * (ph < Math.PI ? 1 : -1);
        ctx.beginPath(); ctx.arc(sx, p.y, r * 1.02, 0, 7); ctx.fillStyle = '#d4c8a6'; ctx.fill();
        ctx.beginPath(); for (let y = -r; y < r; y += 2.5) { ctx.moveTo(sx - r, p.y + y); ctx.lineTo(sx + r, p.y + y); } ctx.lineWidth = 0.6; ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.stroke();
      }
      if (b.stop) { ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.arc(p.x + r * 0.95, p.y - r * 0.95, 4, 0, 7); ctx.fill(); }
      bodyHit[key] = { x: p.x, y: p.y, r, v: p.v };
    }
  }

  const PAL = { deer: ['#d9b48a', '#3a2a1c'], wolf: ['#c4c0b4', '#3a2a1c'], fish: ['#e8b67e', '#3a2a1c'], ink: '#3a2a1c', lw: 1 };

  let cnt = 0;
  function draw(ctx, t) {
    if (V.dirty || ++cnt % 3 === 0) {      // 地形はゆっくり変わるので、3コマに1回描き直す
      for (let i = 0; i < NN; i++) LUM[i] = 0.5 + 0.5 * LUM[i];   // 夜は線で見せるので、色はあまり暗くしない
      renderSmooth(rimColor, rootColor);
      engrave();
      bctx.putImageData(img, 0, 0);
    }
    drawBackground(ctx, t);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buf, 0, 0, buf.width * V.bs, buf.height * V.bs);
    drawFalls(ctx, t);
    for (const sp of W.springs) {
      const p = proj(sp.i % N, sp.i / N | 0, Zs[sp.i] + 0.2), k = (t * 0.8) % 1;
      ctx.strokeStyle = sp.on ? `rgba(44,62,92,${1 - k})` : 'rgba(58,42,28,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, V.s * (0.4 + k), V.s * (0.4 + k) * V.tilt, 0, 0, 7); ctx.stroke();
    }
    for (const it of sceneItems()) {
      if (it.type === 'tree') drawTree(ctx, it);
      else drawAnimalVec(ctx, it.a, it.p, Math.max(6, V.s * (it.a.kind === 'fish' ? 0.8 : 1.05)), PAL);
    }
    for (const f of L.fx) {
      const p = proj(f.x, f.y, f.z);
      if (f.type === 'puff') { ctx.strokeStyle = `rgba(58,42,28,${0.7 * (1 - f.t / 1.2)})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(p.x, p.y - V.s * 0.3, V.s * (0.4 + f.t), 0, 7); ctx.stroke(); }
      else if (f.type === 'fall') { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - f.t / 2.5); drawAnimalVec(ctx, { kind: f.kind, dir: f.t * 3, phase: f.t }, p, V.s, PAL); ctx.restore(); }
    }
    for (const cl of W.clouds) drawCloud(ctx, cl);
    drawBodies(ctx, t);
  }

  return { label: '銅版画', quant: false, bs: cw => Math.max(1, cw / 760), draw, hover: 'rgba(58,42,28,0.9)' };
})();
STYLES.etch = ETCH;
