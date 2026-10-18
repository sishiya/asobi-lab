// 盤を描く（見た目は 2D・B「からくりの石人形」。ART.md・COLORS.md）。
// 1マス S=42 の座標で描き、呼ぶ側が ctx.scale で原寸（1マス 40〜44px）に合わせる。
// 手本は ../_dev/look/pathstones/look.js の 2D・B。
import { VOID, BRIDGE, CRACK } from './rules.js?v=1';

export const S = 42;
const DIR = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const C = {
  ground: [82, 76, 68], groundLine: [40, 37, 33], amber: [255, 176, 72], green: [150, 230, 120], ice: [176, 214, 255],
  stone: [140, 131, 117], stoneStop: [96, 90, 80], stoneSide: [62, 57, 50], cut: [52, 48, 42], brass: '#c49a45', moss: '#6fae5e',
};
const rgb = (c, k = 1, a = 1) => `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;
const hash = (x, y, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 2246822519) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return (h & 0xffff) / 0xffff; };
const LIFT = h => Math.round(S * h * 0.42); // 65°の見下ろしで、高さ h の側面が見える量
const lerp = (a, b, t) => a + (b - a) * t;

// 盤の大きさ（盤の外わくと、北の壁の高さぶんの余白を足す）
export const boardSize = s => ({ w: s.w * S + 8, h: s.h * S + 8 + LIFT(0.45) });

// opts: { calm 灯台のまたたきを止める, prev 前の状態（動きのあいだ）, t 0〜1, now 秒, hints {move:[], cut:[], place:{cells,kind,end}}, danger [x,y], afterglow [x,y], fireOut 0〜1, lit 0〜1, predict 2手先の状態 }
export function drawBoard(ctx, s, o = {}) {
  const L = o.L || 1, now = o.now || 0;
  const ox = 4, oy = 4 + LIFT(0.45);
  const X = x => ox + x * S, Y = y => oy + y * S;
  const fl = (x, y) => (x < 0 || y < 0 || x >= s.w || y >= s.h) ? VOID : s.floor[y * s.w + x];
  ctx.strokeStyle = rgb(C.ground, L * 0.7); ctx.lineWidth = 2; ctx.strokeRect(ox - 2, oy - 2, s.w * S + 4, s.h * S + 4);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const f = fl(x, y);
    if (f === VOID) {
      ctx.fillStyle = '#020202'; ctx.fillRect(X(x), Y(y), S, S);
      if (fl(x, y - 1) !== VOID) {
        ctx.fillStyle = rgb(C.stoneSide, L * 0.85); ctx.fillRect(X(x), Y(y), S, 8);
        const g = ctx.createLinearGradient(0, Y(y) + 8, 0, Y(y) + 8 + S * 0.35);
        g.addColorStop(0, 'rgba(30,27,24,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(X(x), Y(y) + 8, S, S * 0.35);
      }
      continue;
    }
    const v = 0.92 + hash(x, y) * 0.14;
    ctx.fillStyle = rgb(f === BRIDGE ? C.stoneStop : C.ground, v * L); ctx.fillRect(X(x), Y(y), S, S);
    ctx.fillStyle = rgb(C.groundLine, L); ctx.fillRect(X(x), Y(y), S, 2); ctx.fillRect(X(x), Y(y), 2, S);
    if (f === BRIDGE) { ctx.fillStyle = rgb(C.cut, L); ctx.fillRect(X(x) + S / 2 - 6, Y(y) + S / 2 - 3, 12, 6); }
    if (f === CRACK) crack(ctx, X(x), Y(y), x, y);
  }
  for (const b of s.beacons) beacon(ctx, s, b, X, Y, L, o.calm ? 0 : now, b.goal ? (o.lit || 0) : 1); // 置いているあいだ（calm）は灯台をまたたかせない（脈打つのは1つだけ）
  // 危なかったマスの残光（青白の斜線、1手）
  if (o.afterglow) hatch(ctx, X(o.afterglow[0]), Y(o.afterglow[1]), 0.55);
  // 2手先の予告（約束でない: 青白 35%、細くまばらな点線、矢じりなし）
  if (o.predict) for (const c of o.predict.cents) if (c.alive && c.mark) {
    const h = c.body[0], m = c.mark;
    ctx.strokeStyle = rgb(C.ice, 1, 0.35); ctx.lineWidth = 2; ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.moveTo(X(h[0]) + S / 2, Y(h[1]) + S / 2); ctx.lineTo(X(m[0]) + S / 2, Y(m[1]) + S / 2); ctx.stroke(); ctx.setLineDash([]);
  }
  // 案内（琥珀）: 押せるマスは床の四隅のかぎ印、切れる物は輪郭
  const pulse = 0.55 + 0.45 * Math.sin(now * 5);
  if (o.hints?.move) for (const [x, y] of o.hints.move) hooks(ctx, X(x), Y(y), rgb(C.amber, 1, 0.75), 6, 4);
  const cutHints = o.hints?.cut || [];
  // 上の層（北から南へ）。動きのあいだは前の位置から補間する
  const t = o.prev ? easeOut(o.t ?? 1) : 1;
  const items = [];
  for (const r of s.rows) r.forEach(p => items.push({ p, kind: 'row' }));
  s.cents.forEach((c, ci) => {
    if (!c.alive) return;
    const pc = o.prev?.cents[ci];
    c.body.forEach((p, i) => {
      let q = p;
      if (pc && pc.alive && pc.body[i] && t < 1) q = [lerp(pc.body[i][0], p[0], t), lerp(pc.body[i][1], p[1], t)];
      items.push({ p: q, kind: 'cent', i, c });
    });
  });
  let pp = s.player;
  if (o.prev && t < 1) pp = [lerp(o.prev.player[0], s.player[0], t), lerp(o.prev.player[1], s.player[1], t)];
  items.push({ p: pp, kind: 'player' });
  items.sort((a, b) => a.p[1] - b.p[1] || (a.kind === 'player') - (b.kind === 'player'));
  for (const it of items) {
    const [x, y] = it.p;
    if (it.kind === 'row') stoneStopped(ctx, X(x), Y(y), x, y, L);
    else if (it.kind === 'cent') stoneAlive(ctx, X(x), Y(y), Math.round(x), Math.round(y), it.i === 0, it.c.dir, L);
    else player(ctx, X(x) + S / 2, Y(y) + S / 2, now, o.danger, o.fireOut || 0);
  }
  // 切れる物: 四辺を太くなぞる（物の上の面の高さに合わせる）
  for (const [x, y] of cutHints) {
    const onTop = s.rows.some(r => r.some(c => c[0] === x && c[1] === y)) || s.cents.some(c => c.alive && c.body.some(b => b[0] === x && b[1] === y));
    const lift = onTop ? LIFT(0.45) : 0;
    ctx.strokeStyle = rgb(C.amber, 1, 0.55 + 0.45 * pulse); ctx.lineWidth = 3.5; ctx.strokeRect(X(x) + 2, Y(y) + 2 - lift, S - 4, S - 4);
  }
  // いまやる1つ（はじめの部屋）: 脈打つ琥珀の輪
  if (o.guide) { ctx.strokeStyle = rgb(C.amber, 1, 0.35 + 0.65 * pulse); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X(o.guide[0]) + S / 2, Y(o.guide[1]) + S / 2, S * (0.36 + 0.06 * pulse), 0, 7); ctx.stroke(); }
  // 置く影（置いた後の姿で。つけている端の印が脈打つ）
  if (o.hints?.place) placeShadow(ctx, o.hints.place, X, Y, pulse, L);
  if (t >= 1) for (const c of s.cents) if (c.alive && c.mark) mark(ctx, c, X, Y);
  // ともしごの灯り
  const [px, py] = [X(pp[0]) + S / 2, Y(pp[1]) + S / 2];
  const k = 1 - (o.fireOut || 0);
  if (k > 0) {
    const g = ctx.createRadialGradient(px, py, 4, px, py, S * 1.6);
    g.addColorStop(0, rgb(C.amber, 1, 0.26 * k)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(px - S * 2, py - S * 2, S * 4, S * 4);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (o.fireOut) { ctx.fillStyle = `rgba(0,0,0,${0.35 * o.fireOut})`; ctx.fillRect(0, 0, s.w * S + 8, s.h * S + 8 + LIFT(0.45)); }
  return { X, Y };
}

// 盤の上の点（px）→ マス
export function cellAt(s, px, py) {
  const ox = 4, oy = 4 + LIFT(0.45);
  const x = Math.floor((px - ox) / S), y = Math.floor((py - oy) / S);
  return (x >= 0 && y >= 0 && x < s.w && y < s.h) ? [x, y] : null;
}

// 持っている形のミニ図（1マス 11px）
export function drawHeld(ctx, held, w, h) {
  ctx.clearRect(0, 0, w, h);
  if (!held) { ctx.strokeStyle = 'rgba(141,133,120,.6)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.strokeRect(10, 10, w - 20, h - 20); ctx.setLineDash([]); return; } // 空: 点線の枠
  const xs = held.map(p => p[0]), ys = held.map(p => p[1]);
  const minx = Math.min(...xs), miny = Math.min(...ys), cw = Math.max(...xs) - minx + 1, ch = Math.max(...ys) - miny + 1;
  const u = Math.min(22, Math.floor((w - 8) / cw), Math.floor((h - 8) / ch)); // ボタンいっぱいに
  const bx = (w - cw * u) / 2, by = (h - ch * u) / 2;
  held.forEach(([dx, dy], i) => {
    ctx.fillStyle = rgb(C.stone); ctx.fillRect(bx + (dx - minx) * u, by + (dy - miny) * u, u - 1, u - 1);
    ctx.strokeStyle = rgb(C.amber); ctx.lineWidth = 1.5; ctx.strokeRect(bx + (dx - minx) * u + 0.5, by + (dy - miny) * u + 0.5, u - 2, u - 2);
    if (i === 0) { ctx.fillStyle = C.brass; ctx.fillRect(bx + (dx - minx) * u + 2, by + (dy - miny) * u + u / 2 - 1, u - 5, 2); } // 頭の側の印
  });
}

const easeOut = t => 1 - (1 - t) * (1 - t);

function crack(ctx, x, y, gx, gy) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'miter';
  const vert = hash(gx, gy, 9) > 0.5, pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6, j = (hash(gx, gy, 20 + i) - 0.5) * S * 0.22;
    pts.push(vert ? [x + S * (0.42 + hash(gx, gy, 1) * 0.16) + j, y + S * (0.06 + t * 0.88)] : [x + S * (0.06 + t * 0.88), y + S * (0.42 + hash(gx, gy, 1) * 0.16) + j]);
  }
  const k = 2 + Math.floor(hash(gx, gy, 5) * 3), br = pts[k];
  const tip = [br[0] + (vert ? 1 : -0.4) * S * (0.12 + hash(gx, gy, 6) * 0.1), br[1] + (vert ? -0.3 : 1) * S * (0.1 + hash(gx, gy, 7) * 0.1)];
  const mid = [(br[0] + tip[0]) / 2 + (hash(gx, gy, 8) - 0.5) * 6, (br[1] + tip[1]) / 2 + (hash(gx, gy, 10) - 0.5) * 6];
  for (const [col, lw] of [['rgba(20,18,16,.9)', 5], ['rgba(200,194,180,.85)', 3]]) {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.moveTo(...br); ctx.lineTo(...mid); ctx.lineTo(...tip); ctx.stroke();
  }
  ctx.restore();
}

function beacon(ctx, s, b, X, Y, L, now, lit) {
  const cx = X(b.x) + S / 2, cy = Y(b.y) + S / 2;
  if (b.r > 0) {
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (Math.abs(x - b.x) + Math.abs(y - b.y) <= b.r) { ctx.fillStyle = rgb(C.green, 1, 0.12); ctx.fillRect(X(x), Y(y), S, S); }
  }
  // 消えかけ（目的地）は 2.4秒の周期で ±15% またたく。ともると一定の光
  const blink = b.goal ? lerp(1 + 0.15 * Math.sin(now * Math.PI * 2 / 2.4), 1.15, lit) : 1;
  const a = (b.goal ? lerp(0.45, 0.7, lit) : 0.6) * blink;
  const halo = ctx.createRadialGradient(cx, cy - 6, 2, cx, cy - 6, S * (b.goal ? lerp(0.9, 1.6, lit) : 0.9));
  halo.addColorStop(0, rgb(C.green, 1, a)); halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo; ctx.fillRect(cx - S * 2, cy - S * 2, S * 4, S * 4);
  ctx.fillStyle = rgb(C.stoneSide, L); ctx.fillRect(cx - S * 0.3, cy - 2, S * 0.6, 7);
  ctx.fillStyle = rgb(C.stone, L); ctx.fillRect(cx - S * 0.3, cy - 8, S * 0.6, 7);
  const caps = [[-0.16, 0.02, 0.12], [0.02, -0.06, 0.15], [0.17, 0.03, 0.1], [0.06, 0.1, 0.08]];
  for (const [dx, dy, r] of caps) {
    const bx = cx + dx * S, by = cy - 9 + dy * S;
    ctx.strokeStyle = rgb(C.green, 0.6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, by + 6); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = rgb(C.green, (b.goal ? lerp(0.9, 1.2, lit) : 1.1) * blink); ctx.beginPath(); ctx.ellipse(bx, by, r * S, r * S * 0.38, 0, Math.PI, 0); ctx.fill();
  }
}

function stoneAlive(ctx, x, y, gx, gy, head, dir, L) {
  const lift = LIFT(0.45), size = head ? S * 0.9 : S * 0.8, inset = (S - size) / 2, top = y - lift;
  const gl = ctx.createRadialGradient(x + S / 2, y + S * 0.7, 2, x + S / 2, y + S * 0.7, S * 0.55);
  gl.addColorStop(0, rgb(C.ice, 1, 0.45)); gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl; ctx.fillRect(x - S * 0.1, y + S * 0.1, S * 1.2, S * 1.1);
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x + inset + 3, y + S - inset - 1, size - 2, 6);
  ctx.fillStyle = rgb(C.stoneSide, L); ctx.fillRect(x + inset, top + S - inset, size, lift);
  ctx.fillStyle = rgb(C.stone, L * (0.95 + hash(gx, gy, 7) * 0.08)); ctx.fillRect(x + inset, top + inset, size, size);
  ctx.fillStyle = rgb(C.stone, L * 1.25); ctx.fillRect(x + inset + 2, top + inset + 1, size - 4, 2);
  ctx.strokeStyle = 'rgba(12,11,10,.95)'; ctx.lineWidth = 2.5; ctx.strokeRect(x + inset, top + inset, size, size);
  ctx.fillStyle = C.brass; ctx.fillRect(x + inset - 2, top + S * 0.42, 5, 8); ctx.fillRect(x + S - inset - 3, top + S * 0.42, 5, 8);
  if (head) {
    const d = DIR[dir], cx = x + S / 2, cy = top + S / 2, half = size / 2, nx = -d[1], ny = d[0];
    const f0 = [cx + d[0] * half, cy + d[1] * half], back = 0.38 * size;
    ctx.fillStyle = rgb(C.stone, L * 1.2);
    ctx.beginPath(); ctx.moveTo(f0[0] + nx * half, f0[1] + ny * half); ctx.lineTo(f0[0] - nx * half, f0[1] - ny * half);
    ctx.lineTo(f0[0] - d[0] * back - nx * half, f0[1] - d[1] * back - ny * half); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(12,11,10,.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(f0[0] + nx * half, f0[1] + ny * half); ctx.lineTo(f0[0] - d[0] * back - nx * half, f0[1] - d[1] * back - ny * half); ctx.stroke();
    ctx.fillStyle = C.brass; ctx.fillRect(cx - (d[0] ? 2 : half), cy - (d[1] ? 2 : half), d[0] ? 4 : size, d[1] ? 4 : size);
  }
}

function stoneStopped(ctx, x, y, gx, gy, L) {
  const lift = LIFT(0.4), size = S * 0.84, inset = (S - size) / 2, top = y - lift;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + inset + 3, y + S - inset - 1, size - 2, 5);
  ctx.fillStyle = rgb(C.stoneSide, L * 0.85); ctx.fillRect(x + inset, top + S - inset, size, lift);
  ctx.fillStyle = rgb(C.stoneStop, L * (0.95 + hash(gx, gy, 7) * 0.08)); ctx.fillRect(x + inset, top + inset, size, size);
  ctx.strokeStyle = 'rgba(20,18,16,.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + inset, top + inset, size, size);
  ctx.fillStyle = rgb(C.stoneStop, L * 1.3); ctx.fillRect(x + S * 0.27, top + S * 0.42, 6, 6); ctx.fillRect(x + S * 0.61, top + S * 0.42, 6, 6);
  ctx.fillStyle = C.moss; ctx.fillRect(x + S * 0.7, top + S * 0.7, 3, 3);
}

function mark(ctx, c, X, Y) {
  const h = c.body[0], m = c.mark, d = DIR[c.dir] || [0, 0];
  const x0 = X(h[0]) + S / 2 + d[0] * S * 0.45, y0 = Y(h[1]) + S / 2 - LIFT(0.45) + d[1] * S * 0.45;
  const x1 = X(m[0]) + S / 2, y1 = Y(m[1]) + S / 2;
  ctx.strokeStyle = rgb(C.ice, 1, 0.8); ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.fillStyle = rgb(C.ice, 1, 0.9); ctx.beginPath();
  ctx.moveTo(x1 + Math.cos(a) * 12, y1 + Math.sin(a) * 12);
  ctx.lineTo(x1 + Math.cos(a + 2.5) * 12, y1 + Math.sin(a + 2.5) * 12);
  ctx.lineTo(x1 + Math.cos(a - 2.5) * 12, y1 + Math.sin(a - 2.5) * 12); ctx.fill();
  hooks(ctx, X(m[0]), Y(m[1]), rgb(C.ice, 1, 0.8), 8, 5);
}

function hooks(ctx, mx, my, col, k, q) {
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  for (const [cx, cy, sx, sy] of [[mx + q, my + q, 1, 1], [mx + S - q, my + q, -1, 1], [mx + q, my + S - q, 1, -1], [mx + S - q, my + S - q, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx + sx * k, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * k); ctx.stroke();
  }
}

function hatch(ctx, x, y, a) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, S, S); ctx.clip();
  ctx.strokeStyle = rgb(C.ice, 1, a); ctx.lineWidth = 2;
  for (let i = -S; i < S; i += 8) { ctx.beginPath(); ctx.moveTo(x + i, y + S); ctx.lineTo(x + i + S, y); ctx.stroke(); }
  ctx.restore();
}

function placeShadow(ctx, p, X, Y, pulse, L) {
  const ok = !!p.kind;
  p.cells.forEach(([x, y], i) => {
    if (x < 0 || y < 0) return;
    const px = X(x), py = Y(y);
    if (!ok) { ctx.fillStyle = 'rgba(140,140,140,.35)'; ctx.fillRect(px + 4, py + 4, S - 8, S - 8); }
    else if (p.kind === 'wall') { const lift = LIFT(0.4); ctx.fillStyle = rgb(C.stoneStop, L, 0.55); ctx.fillRect(px + 4, py + 4 - lift, S - 8, S - 8 + lift); }
    else { ctx.fillStyle = rgb(C.stoneStop, L, 0.55); ctx.fillRect(px + 2, py + 2, S - 4, S - 4); }
    ctx.strokeStyle = ok ? rgb(C.amber, 1, 0.9) : 'rgba(170,170,170,.8)'; ctx.lineWidth = 2; ctx.strokeRect(px + 3, py + 3 - (p.kind === 'wall' ? LIFT(0.4) : 0), S - 6, S - 6);
    const anchorIdx = p.end === 0 ? 0 : p.cells.length - 1;
    if (i === anchorIdx) { ctx.fillStyle = rgb(C.amber, 1, 0.4 + 0.6 * pulse); ctx.beginPath(); ctx.arc(px + S / 2, py + S / 2, 6, 0, 7); ctx.fill(); }
  });
  if (!ok && p.bad) for (const [x, y] of p.bad) { // 置けない原因のマスに ×
    ctx.strokeStyle = 'rgba(200,200,200,.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(X(x) + 12, Y(y) + 12); ctx.lineTo(X(x) + S - 12, Y(y) + S - 12); ctx.moveTo(X(x) + S - 12, Y(y) + 12); ctx.lineTo(X(x) + 12, Y(y) + S - 12); ctx.stroke();
  }
}

function player(ctx, cx, cy, now, danger, fireOut) {
  cy -= S * 0.2;
  // 火のゆらぎ（印のマスにいて危ないとき）: 左右にゆれて少し縮む
  let r = S * 0.25, dx = 0;
  if (danger) { dx = Math.sin(now * 18) * 2.5; r *= 0.88 + 0.06 * Math.sin(now * 11); }
  const k = 1 - fireOut;
  const g = ctx.createRadialGradient(cx + dx, cy, 1, cx + dx, cy, r * 1.08);
  g.addColorStop(0, `rgba(255,246,220,${k})`); g.addColorStop(0.35, rgb(C.amber, 1.05, 0.2 + 0.8 * k)); g.addColorStop(1, rgb(C.amber, 0.6, 0.3 + 0.65 * k));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx + dx, cy, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#6b4a24'; ctx.lineWidth = 1.6;
  for (const i of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(cx + i * 6, cy - S * 0.24); ctx.quadraticCurveTo(cx + i * 9, cy, cx + i * 6, cy + S * 0.24); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.25, 0, 7); ctx.stroke();
  ctx.fillStyle = '#3a2410'; ctx.fillRect(cx - 6, cy - 1, 2, 2); ctx.fillRect(cx + 4, cy - 1, 2, 2);
  ctx.beginPath(); ctx.moveTo(cx - 4, cy + S * 0.24); ctx.lineTo(cx - 5, cy + S * 0.36); ctx.moveTo(cx + 4, cy + S * 0.24); ctx.lineTo(cx + 5, cy + S * 0.36); ctx.stroke();
}
