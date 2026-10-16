// 主人公（3Dの学芸員）の歩き方。1マスまでの段は自動でのぼる（キーウィと同じ）。時空の大地（ページの上のふちが奥行きに並んだ地形）の上を歩く。
// 座標: x＝2D世界の横（マス）、t＝時間（秒。3Dの奥行き）、y＝高さ（マス）。
// 主人公の体はページの間隔（1秒）より薄いので、ページのあいだを歩くかぎり2D世界とは交わらない（REDESIGN 3-1）
import { pieceDims, sectionRects } from './sim.js?v=36';

// 標本台: 2D世界のブロックの左どなり（x<0）。ここに置いた形は、ページと交わらない
export const TABLE = { x0: -7, x1: 0, t0: -1, t1: 34 };
export const tableY = (L) => (Number.isFinite(L.tops[0]) ? L.tops[0] : 4);

export const HERO = { speed: 5.2, run: 1.9, jumpV: 10.5, g: 25, step: 1.05, mantle: 1.9, coyote: 0.12, buffer: 0.14 };

// (x, t) の足もとの高さ。yRef より 1 以上うえにある形の底は、床にしない（頭の上の形）
export function groundAt(L, pieces, x, t, yRef = Infinity) {
  let g = -Infinity;
  if (x >= TABLE.x0 && x < 0 && t >= TABLE.t0 && t <= TABLE.t1) g = tableY(L);
  else if (x >= 0 && x < L.W && t >= -0.6 && t <= L.T + 0.6) g = L.tops[Math.floor(x)];
  for (const p of pieces) {
    const d = pieceDims(p);
    if (x < p.x0 || x > p.x0 + d.wx || t < p.t0 || t > p.t0 + d.dz) continue;
    if (d.vx || d.dia) {
      // すべる足場（平行四辺形）: その秒の断面の上だけが床
      for (const r of sectionRects(p, Math.min(t, p.t0 + d.dz - 1e-3))) if (x >= r.x0 && x <= r.x1 && r.y0 <= yRef + 1.0) g = Math.max(g, r.y1);
      continue;
    }
    const bottom = p.y0 + d.slope * (d.along === 'z' ? t - p.t0 : x - p.x0);
    if (bottom > yRef + 1.0) continue;
    g = Math.max(g, bottom + d.h);
  }
  return g;
}
// 足の大きさぶん、何点かで見る
function footGround(L, pieces, x, t, yRef) {
  let g = -Infinity;
  for (const [dx, dt] of [[0, 0], [0.28, 0], [-0.28, 0], [0, 0.22], [0, -0.22]]) g = Math.max(g, groundAt(L, pieces, x + dx, t + dt, yRef));
  return g;
}

export function makeHero(L) {
  const y = tableY(L);
  return { x: -3.5, t: 2, y, vy: 0, grounded: true, coyote: 0, buffer: 0, safe: { x: -3.5, t: 2, y }, mantle: 0, fx: 1, ft: 0 };
}

// 1フレーム動かす。mx・mt はカメラ基準から直した、世界の向きの入力（-1〜1）
export function stepHero(h, L, pieces, mx, mt, jumpPressed, dt, running = false) {
  const len = Math.hypot(mx, mt);
  if (len > 1) { mx /= len; mt /= len; }
  if (len > 0.05) { h.fx = mx; h.ft = mt; }
  if (jumpPressed) h.buffer = HERO.buffer; else h.buffer = Math.max(0, h.buffer - dt);
  h.mantle = Math.max(0, h.mantle - dt);
  h.landT = Math.max(0, (h.landT || 0) - dt);

  // 横の移動（軸ごとに。壁ならそこで止まる、低い段はのぼる、跳んでいれば よじ登る）
  const tryMove = (nx, nt) => {
    nx = Math.max(TABLE.x0 + 0.3, Math.min(L.W - 0.3, nx));
    nt = Math.max(-0.5, Math.min(L.T + 0.5, nt));
    const g = footGround(L, pieces, nx, nt, h.y);
    if (g - h.y <= HERO.step) { h.x = nx; h.t = nt; if (h.grounded && g > h.y) h.y = g; return; }
    if (!h.grounded && g - h.y <= HERO.mantle) { h.x = nx; h.t = nt; h.y = g; h.vy = 0; h.grounded = true; h.mantle = 0.25; }
  };
  const sp = HERO.speed * (running ? HERO.run : 1);
  tryMove(h.x + mx * sp * dt, h.t);
  tryMove(h.x, h.t + mt * sp * dt);

  // 上下
  const g0 = footGround(L, pieces, h.x, h.t, h.y);
  if (h.grounded) {
    if (g0 < h.y - 0.35 || g0 === -Infinity) { h.grounded = false; h.coyote = HERO.coyote; h.vy = 0; }
    else h.y = g0;
  }
  if ((h.grounded || h.coyote > 0) && h.buffer > 0) {
    h.vy = HERO.jumpV; h.grounded = false; h.coyote = 0; h.buffer = 0;
  }
  if (!h.grounded) {
    h.coyote = Math.max(0, h.coyote - dt);
    h.vy -= HERO.g * dt;
    h.y += h.vy * dt;
    const g1 = footGround(L, pieces, h.x, h.t, h.y - h.vy * dt);
    if (h.vy <= 0 && h.y <= g1) { h.landV = -h.vy; h.y = g1; h.vy = 0; h.grounded = true; h.landT = 0.25; }
  }
  if (h.grounded && Number.isFinite(g0)) h.safe = { x: h.x, t: h.t, y: h.y };
  // 底なしへ落ちたら、さっき立っていた所へ戻す
  if (h.y < -6) { h.x = h.safe.x; h.t = h.safe.t; h.y = h.safe.y + 0.5; h.vy = 0; h.grounded = false; return 'respawn'; }
  return '';
}
