'use strict';
// 共通の道具: 世界の大きさ、ベクトル、宿主の「気持ち」と寄生者の「引っぱり」を合わせる steer()

const W = 1000, H = 700;          // 世界の大きさ（画面は 10:7 で、これに合わせて縮める）
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function norm(x, y) { const l = Math.hypot(x, y); return l > 1e-6 ? { x: x / l, y: y / l } : { x: 0, y: 0 }; }
function toward(a, b) { return norm(b.x - a.x, b.y - a.y); }
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
function makeRng(seed) { // 背景の飾りを毎回同じにするための乱数
  return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// 寄生者の引っぱりの向き（押さえている所・矢印キー）。なければ null
function pullDir(G) {
  const h = G.host;
  if (G.pointer.on) {
    const dx = G.pointer.x - h.x, dy = G.pointer.y - h.y;
    return Math.hypot(dx, dy) < 12 ? null : norm(dx, dy);
  }
  const k = G.keys;
  const x = (k.ArrowRight || k.d ? 1 : 0) - (k.ArrowLeft || k.a ? 1 : 0);
  const y = (k.ArrowDown || k.s ? 1 : 0) - (k.ArrowUp || k.w ? 1 : 0);
  return x || y ? norm(x, y) : null;
}

// 宿主の気持ち will（向きだけ見る）に、寄生者の引っぱりを足す。
// resist: 気持ちに逆らう引っぱりの重さ（こわいときほど大きい）。逆らうほどあやつり力が減る
function steer(G, will, dt, resist = 1) {
  const h = G.host;
  let w = norm(will.x, will.y);
  if (!w.x && !w.y) w = { x: Math.cos(h.a), y: Math.sin(h.a) };
  G.will = w; G.pulled = false; G.pull = null;
  const p = pullDir(G);
  if (p && !G.tired) {
    const conflict = (1 - (w.x * p.x + w.y * p.y)) / 2; // 0: 同じ向き 〜 1: 正反対
    G.gauge = Math.max(0, G.gauge - (4 + 14 * conflict * resist) * dt);
    if (G.gauge <= 0) { G.tired = true; G.toast('あやつり力が切れた。少し待とう', 'tired'); }
    G.pulled = true; G.pull = p;
    const ww = 0.4 * resist * resist; // 強くいやがっているときは、引っぱりが負ける
    return norm(w.x * ww + p.x * 2, w.y * ww + p.y * 2);
  }
  return w;
}

// 向きを少しずつ変えながら進む
function walk(o, dir, speed, turn, dt, margin = 18) {
  if (dir.x || dir.y) o.a += clamp(angDiff(o.a, Math.atan2(dir.y, dir.x)), -turn * dt, turn * dt);
  o.x += Math.cos(o.a) * speed * dt;
  o.y += Math.sin(o.a) * speed * dt;
  o.x = clamp(o.x, margin, W - margin); o.y = clamp(o.y, margin, H - margin);
}
// ふらふら歩き（いまの向きの近く）
function wander(o, dt, amt = 1) {
  o.wa = clamp((o.wa || 0) + rnd(-1, 1) * amt * dt * 3, -1, 1);
  return { x: Math.cos(o.a + o.wa * 0.9), y: Math.sin(o.a + o.wa * 0.9) };
}
// 端に近づいたら内向きに
function edgePush(o, m = 70) {
  return { x: (o.x < m ? 1 : 0) - (o.x > W - m ? 1 : 0), y: (o.y < m ? 1 : 0) - (o.y > H - m ? 1 : 0) };
}
// 円い障害物から押し出す
function pushOut(o, obs, pad = 0) {
  for (const s of obs) {
    const dx = o.x - s.x, dy = o.y - s.y, d = Math.hypot(dx, dy), r = s.r + pad;
    if (d < r && d > 0.01) { o.x = s.x + dx / d * r; o.y = s.y + dy / d * r; }
  }
}

// 絵の道具
function ellipse(ctx, x, y, rx, ry, rot, fill, stroke, lw) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
function line(ctx, x1, y1, x2, y2, color, lw) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.stroke();
}
// 宿主の気持ちの向き（点線）と、引っぱりの向き（実線）
function drawIntent(ctx, G) {
  const h = G.host;
  if (G.will) {
    ctx.save(); ctx.setLineDash([4, 6]);
    line(ctx, h.x, h.y, h.x + G.will.x * 46, h.y + G.will.y * 46, 'rgba(255,255,255,.55)', 2);
    ctx.restore();
  }
  if (G.pulled && G.pointer.on) {
    ctx.save(); ctx.globalAlpha = 0.8;
    line(ctx, h.x, h.y, G.pointer.x, G.pointer.y, 'rgba(255,170,90,.6)', 2);
    ellipse(ctx, G.pointer.x, G.pointer.y, 9, 9, 0, null, 'rgba(255,170,90,.9)', 2);
    ctx.restore();
  }
}
