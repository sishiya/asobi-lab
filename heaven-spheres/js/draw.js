'use strict';
// 絵: 古い天文図の銅版画ふう。羊皮紙の地に、インクの線とハッチング。
// 世界の座標は 1000×1000（中心 CX, CY）。view = { x, y, z }（見ている中心と拡大）

const INK = '#3a2a1c', PAPER = '#efe3c4';
let PAT = null;

function makePatterns(ctx) {
  function pat(w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h); return ctx.createPattern(c, 'repeat');
  }
  PAT = {
    water: pat(8, 5, (x, w) => { x.fillStyle = '#a9bfc6'; x.fillRect(0, 0, w, 5); x.fillStyle = 'rgba(38,60,98,.55)'; x.fillRect(0, 1, w, 1); }),
    earth: pat(7, 7, (x, w, h) => {
      x.fillStyle = '#d6bd8f'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(80,52,24,.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(-1, h + 1); x.lineTo(w + 1, -1); x.stroke();
    }),
    deep: pat(6, 6, (x, w, h) => {
      x.fillStyle = '#c8ab7c'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(80,52,24,.45)'; x.beginPath(); x.moveTo(-1, h + 1); x.lineTo(w + 1, -1); x.moveTo(-1, -1); x.lineTo(w + 1, h + 1); x.stroke();
    }),
    sun: pat(4, 4, (x) => { x.fillStyle = '#ecc96c'; x.fillRect(0, 0, 4, 4); x.fillStyle = 'rgba(120,70,10,.35)'; x.fillRect(0, 0, 1, 1); }),
    paper: pat(160, 160, (x, w, h) => {
      x.fillStyle = PAPER; x.fillRect(0, 0, w, h);
      const r = mulberry32(7);
      for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(110,80,40,${r() * 0.07})`; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
    }),
  };
}

// パターンの線の間かくを、拡大しても画面の上で同じにする
function fitPat(p, sc) { if (p.setTransform) p.setTransform(new DOMMatrix().scale(1 / sc)); return p; }

const P = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];

function ringPath(ctx, rad) { // rad(i) の半径で輪を1周
  for (let i = 0; i <= N; i++) {
    const k = i % N, [x, y] = P(rad(k), cellAngle(k));
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function circle(ctx, r) { ctx.beginPath(); ctx.arc(CX, CY, r, 0, TAU); }

function drawWorld(ctx, Wd, L, view, cw, ch, dpr, opt) {
  const base = Math.min(cw, ch) / WSIZE, sc = base * view.z;
  if (!PAT) makePatterns(ctx);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = fitPat(PAT.paper, 1); ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(sc * dpr, 0, 0, sc * dpr, (cw / 2 - view.x * sc) * dpr, (ch / 2 - view.y * sc) * dpr);
  const lw = 1 / sc;   // 画面で 1px の線
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // 天球（外から）
  const [moon, sun, stars] = Wd.sph;
  drawStars(ctx, stars, lw);
  drawBand(ctx, sun, lw, opt.hover === 'sun');
  drawBand(ctx, moon, lw, opt.hover === 'moon');

  // 火の層と空気（月の天球の内がわ）
  ctx.strokeStyle = 'rgba(150,60,20,.45)'; ctx.lineWidth = lw; ctx.setLineDash([6 * lw, 5 * lw]);
  circle(ctx, 318); ctx.stroke(); ctx.setLineDash([]);
  arcLabel(ctx, '火の層', 324, -Math.PI / 2 - 0.5, 11, 'rgba(150,60,20,.75)');
  arcLabel(ctx, '空気', 300, -Math.PI / 2 + 0.5, 11, 'rgba(58,42,28,.5)');

  drawSunMoon(ctx, Wd, lw);

  // 夜: 太陽の反対がわを暗く
  ctx.save(); circle(ctx, 312); ctx.clip();
  const sx = Math.cos(sun.a), sy = Math.sin(sun.a);
  const gr = ctx.createLinearGradient(CX + sx * 60, CY + sy * 60, CX - sx * 60, CY - sy * 60);
  gr.addColorStop(0, 'rgba(30,24,40,0)'); gr.addColorStop(1, 'rgba(30,24,40,.13)');
  ctx.fillStyle = gr; ctx.fillRect(CX - 320, CY - 320, 640, 640); ctx.restore();

  // 水（水面の高さで塗り、その上に地を重ねる）
  const { g, h } = Wd;
  ctx.beginPath(); ringPath(ctx, i => R0 + g[i] + (h[i] > 0.05 ? h[i] : 0));
  ctx.fillStyle = fitPat(PAT.water, sc); ctx.fill();
  // 地
  ctx.beginPath(); ringPath(ctx, i => R0 + g[i]);
  ctx.fillStyle = fitPat(PAT.earth, sc); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6 * lw; ctx.stroke();
  // 地の層（内がわ）
  ctx.save(); ctx.clip();
  ctx.fillStyle = fitPat(PAT.deep, sc); circle(ctx, R0 - 75); ctx.fill();
  ctx.strokeStyle = 'rgba(58,42,28,.35)'; ctx.lineWidth = lw;
  for (const r of [R0 - 75, R0 - 120, R0 - 160]) { circle(ctx, r); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = 'rgba(58,42,28,.75)'; ctx.font = `600 ${16}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('地', CX, CY - 8);
  ctx.font = `${9}px serif`; ctx.fillText('世界の中心', CX, CY + 10);
  ctx.beginPath(); ctx.arc(CX, CY - 30, 2.2, 0, TAU); ctx.fill();

  // 水面の線と、速い流れのしぶき
  ctx.strokeStyle = 'rgba(30,52,82,.85)'; ctx.lineWidth = 1.2 * lw; ctx.beginPath();
  let on = false;
  for (let i = 0; i <= N; i++) {
    const k = i % N;
    if (h[k] > 0.3) { const [x, y] = P(R0 + g[k] + h[k], cellAngle(k)); on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; }
    else on = false;
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(30,52,82,.7)'; ctx.lineWidth = lw;
  for (let i = 0; i < N; i++) {
    const v = flowAt(Wd, i);
    if (h[i] < 1 || Math.abs(v) < 70) continue;
    const a = cellAngle(i), r = R0 + g[i] + h[i], s = Math.min(1, (Math.abs(v) - 70) / 80) * 7;
    const [x, y] = P(r, a), d = Math.sign(v);
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(...P(r + s, a + d * 0.008), ...P(r + s * 0.4, a + d * 0.02)); ctx.stroke();
  }

  // 草
  ctx.strokeStyle = 'rgba(70,90,30,.75)'; ctx.lineWidth = lw;
  ctx.beginPath();
  for (let i = 0; i < N; i += 2) {
    const q = Wd.grass[i]; if (q < 0.25 || h[i] > 4) continue;
    const a = cellAngle(i), r = R0 + g[i] + (h[i] > 0.05 ? 0 : 0), len = 2 + q * 3;
    ctx.moveTo(...P(r, a)); ctx.lineTo(...P(r + len, a - 0.004));
    ctx.moveTo(...P(r, a + 0.006)); ctx.lineTo(...P(r + len * 0.7, a + 0.011));
  }
  ctx.stroke();

  // 生き物
  for (const c of L.list) drawCreature(ctx, Wd, c, lw);

  // なぞっている場所
  if (opt.brush != null) {
    const r = R0 + g[idx(opt.brush)];
    ctx.strokeStyle = opt.tool === 'raise' ? 'rgba(120,70,20,.8)' : 'rgba(40,40,90,.8)';
    ctx.lineWidth = 1.5 * lw; ctx.setLineDash([3 * lw, 3 * lw]);
    ctx.beginPath(); ctx.arc(...P(r, opt.brush), 16, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  return sc;
}

function arcLabel(ctx, text, r, a, size, color) {
  ctx.save(); ctx.fillStyle = color; ctx.font = `${size}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const step = size * 1.05 / r, a0 = a - step * (text.length - 1) / 2;
  for (let k = 0; k < text.length; k++) {
    const t = a0 + k * step; ctx.save(); ctx.translate(...P(r, t)); ctx.rotate(t + Math.PI / 2); ctx.fillText(text[k], 0, 0); ctx.restore();
  }
  ctx.restore();
}

// 天球の帯: 2本の輪と目盛り（天球が回ると目盛りも回る）
function drawBand(ctx, s, lw, hot) {
  ctx.strokeStyle = hot ? 'rgba(140,60,20,.9)' : 'rgba(58,42,28,.7)';
  ctx.lineWidth = (hot ? 1.6 : 1) * lw;
  circle(ctx, s.r - 9); ctx.stroke(); circle(ctx, s.r + 9); ctx.stroke();
  ctx.lineWidth = lw; ctx.beginPath();
  for (let k = 0; k < 72; k++) {
    const a = s.a + k * TAU / 72, long = k % 6 === 0;
    ctx.moveTo(...P(s.r - 9, a)); ctx.lineTo(...P(long ? s.r + 9 : s.r - 3, a));
  }
  ctx.stroke();
  arcLabel(ctx, s.name, s.r, s.a + Math.PI, 10, hot ? 'rgba(140,60,20,.95)' : 'rgba(58,42,28,.75)');
}

function drawStars(ctx, s, lw) {
  ctx.strokeStyle = 'rgba(58,42,28,.55)'; ctx.lineWidth = lw;
  circle(ctx, s.r - 12); ctx.stroke(); circle(ctx, s.r + 12); ctx.stroke();
  const r = mulberry32(3);
  ctx.fillStyle = 'rgba(58,42,28,.75)';
  for (let k = 0; k < 90; k++) {
    const a = s.a + r() * TAU, rr = s.r - 9 + r() * 18, big = r() < 0.15;
    star(ctx, ...P(rr, a), big ? 2.6 : 1.3);
  }
  arcLabel(ctx, '恒星天', s.r, s.a + Math.PI / 2, 10, 'rgba(58,42,28,.7)');
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, q = k % 2 ? r * 0.35 : r; ctx.lineTo(x + q * Math.cos(a), y + q * Math.sin(a)); }
  ctx.fill();
}

function drawSunMoon(ctx, Wd, lw) {
  const [moon, sun] = Wd.sph;
  // 太陽: 光の筋と顔
  const [sx, sy] = P(sun.r, sun.a);
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(sun.a * 3);
  ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.fillStyle = '#e7c35f';
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = k * TAU / 16, a2 = a + TAU / 32;
    ctx.lineTo(24 * Math.cos(a), 24 * Math.sin(a)); ctx.lineTo((k % 2 ? 31 : 36) * Math.cos(a2), (k % 2 ? 31 : 36) * Math.sin(a2));
  }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(sx, sy);
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fillStyle = fitPat(PAT.sun, 1 / lw); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2 * lw; ctx.stroke();
  ctx.lineWidth = 1.1 * lw; ctx.beginPath();
  ctx.arc(-6, -3, 3, Math.PI * 1.15, Math.PI * 1.85); ctx.moveTo(9, -3); ctx.arc(6, -3, 3, Math.PI * 1.15, Math.PI * 1.85);
  ctx.moveTo(-6, 6); ctx.quadraticCurveTo(0, 10, 6, 6); ctx.stroke();
  ctx.restore();

  // 月: 太陽との角度で満ち欠け（明るいがわを太陽に向ける）
  const [mx, my] = P(moon.r, moon.a), rm = 18;
  const phi = angDiff(sun.a, moon.a), k = Math.cos(phi);
  ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.atan2(sy - my, sx - mx));
  ctx.beginPath(); ctx.arc(0, 0, rm, 0, TAU); ctx.fillStyle = '#5e5446'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, rm, -Math.PI / 2, Math.PI / 2);
  if (k > 0) ctx.ellipse(0, 0, rm * k, rm, 0, Math.PI / 2, -Math.PI / 2, true);
  else ctx.ellipse(0, 0, -rm * k, rm, 0, Math.PI / 2, Math.PI * 1.5, false);
  ctx.fillStyle = '#f1ead2'; ctx.fill();
  ctx.fillStyle = 'rgba(90,80,60,.35)';
  for (const [cx, cy, cr] of [[-4, -5, 3], [5, 4, 2.4], [-2, 7, 1.8], [7, -6, 1.5]]) { ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, 0, rm, 0, TAU); ctx.strokeStyle = INK; ctx.lineWidth = 1.2 * lw; ctx.stroke();
  ctx.restore();
}

// 生き物: 魚のような体に、遺伝子で脚・うろこがつく。lw は画面で 1px
function drawCreature(ctx, Wd, c, lw) {
  const i = idx(c.th), wet = Wd.h[i] > WET;
  const ground = R0 + Wd.g[i];
  const r = wet ? ground + Math.min(Wd.h[i] * 0.45, 9) + Math.sin(c.bob) * 0.8 : ground + 2.6 + c.legs * 2;
  const [x, y] = P(r, c.th);
  const fade = c.dead ? Math.max(0, 1 - c.dead / 1.6) : 1;
  if (fade <= 0) return;
  ctx.save(); ctx.globalAlpha = fade;
  ctx.translate(x, y); ctx.rotate(c.th + Math.PI / 2); ctx.scale(c.dir, 1);
  if (!wet && !c.dead) ctx.rotate(Math.sin(c.bob * 2) * 0.08 * (1 - c.legs));   // 陸でばたつく
  const t = c.legs, d = c.dry;
  const col = `rgb(${120 + 40 * t | 0},${150 - 10 * d | 0},${165 - 90 * t | 0})`;
  ctx.lineWidth = 0.7; ctx.strokeStyle = INK;
  // 脚
  if (t > 0.2) {
    const len = 1 + 4 * t;
    ctx.beginPath();
    for (const lx of [-2.5, 2.5]) { ctx.moveTo(lx, 1.2); ctx.lineTo(lx + (c.dead ? 0 : Math.sin(c.bob * 4 + lx) * len * 0.4), 1.2 + len); }
    ctx.stroke();
  }
  // 尾
  ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-9 + t * 2, -2.6 + t); ctx.lineTo(-9 + t * 2, 2.6 - t); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.stroke();
  // 体
  ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.8 - t * 0.4, 0, 0, TAU); ctx.fill(); ctx.stroke();
  // ひれ（海のもの）／うろこ（乾きに強いもの）
  if (t < 0.4) { ctx.beginPath(); ctx.moveTo(-1, -2.4); ctx.lineTo(-3, -4.4); ctx.lineTo(1.5, -2.6); ctx.stroke(); }
  if (d > 0.4) {
    ctx.lineWidth = 0.4; ctx.beginPath();
    for (let k = -3; k <= 2; k += 1.6) { ctx.moveTo(k, -2); ctx.lineTo(k + 1, -0.6); }
    ctx.stroke();
  }
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(3.6, -0.7, 0.7, 0, TAU); ctx.fill();
  if (c.hit > 0 && !c.dead) {   // 波にもまれている
    ctx.strokeStyle = 'rgba(30,52,82,.9)'; ctx.lineWidth = 0.6; ctx.beginPath();
    ctx.arc(0, -5, 3, Math.PI, 0); ctx.arc(-3, -6, 2, Math.PI, 0); ctx.stroke();
  }
  if (c.dead) {                 // 線がほどけて消える
    ctx.strokeStyle = INK; ctx.lineWidth = 0.4; ctx.beginPath();
    const s = c.dead * 6;
    ctx.moveTo(-4, -2 - s); ctx.lineTo(-1, -3 - s); ctx.moveTo(2, -1 - s * 0.8); ctx.lineTo(4, -3 - s * 0.8); ctx.stroke();
  }
  ctx.restore();
}
