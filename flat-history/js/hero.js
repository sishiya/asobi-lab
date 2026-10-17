// 主人公の動き方。時空の大地（ページの上のふちが奥行きに並んだ地形）の上を、浮かんで進む（v038）。
// 座標: x＝2D世界の横（マス）、t＝時間（秒。3Dの奥行き）、y＝高さ（マス）。
// 主人公の体はページの間隔（1秒）より薄いので、ページのあいだを歩くかぎり2D世界とは交わらない（REDESIGN 3-1）
import { pieceDims, sectionRects } from './sim.js?v=72';

// v038: 主人公は浮かんでいる。跳ぶ・よじ登る・落ちるはやめた。足もとの高さへ、ばねのようにふわりと寄る（少しゆれて、ぴたりとは張りつかない）
// 奈落の上では、さっきの高さのまま浮かんでいる（落ちない）
export const HERO = { speed: 5.2, run: 1.9, k: 34, c: 9.5, sink: 0.9, look: 0.4, accel: 7, settle: 4 };

// (x, t) の足もとの高さ。yRef より 1 以上うえにある形の底は、床にしない（頭の上の形）
export function groundAt(L, pieces, x, t, yRef = Infinity) {
  let g = -Infinity;
  if (x >= 0 && x < L.W && t >= -0.6 && t <= L.T + 0.6) g = L.tops[Math.floor(x)];
  for (const p of pieces) {
    const d = pieceDims(p);
    if (x < p.x0 || x > p.x0 + d.wx || t < p.t0 || t > p.t0 + d.dz) continue;
    if (d.vx || d.dia || d.hump || d.comb || d.spiral) {
      // すべる足場・ひし形・しかけの形: その秒の断面の上だけが床
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

// はじめは、住人の立つ所の、1秒目と2秒目のページのあいだ（v031: 標本台はやめた）
// はじめの場所（v077）: 住人の家（スタート）や巣と重ならないよう、スタートから歩く向きへ少し進んだ地面の上。1.5 秒目
export function makeHero(L) {
  const dir = L.start.dir || 1, want = L.start.x + 3.5 * dir;
  let x = L.start.x, best = Infinity;
  for (let c = 1.5; c <= L.W - 1.5; c += 0.5) {
    const g = L.tops[Math.floor(c)];
    if (!Number.isFinite(g) || [L.start, L.goal, ...(L.more || []).flatMap((m) => [m.start, m.goal])].some((q) => Math.abs(c - q.x) < 3)) continue;
    if (Math.abs(c - want) < best) { best = Math.abs(c - want); x = c; }
  }
  const t = 1.5, y = L.tops[Math.floor(x)];
  return { x, t, y, vy: 0, vx: 0, vt: 0, floor: y, grounded: true, fx: 0, ft: 1 };
}

// 1フレーム動かす。mx・mt はカメラ基準から直した、世界の向きの入力（-1〜1）
export function stepHero(h, L, pieces, mx, mt, dt, running = false) {
  const len = Math.hypot(mx, mt);
  if (len > 1) { mx /= len; mt /= len; }
  if (len > 0.05) { h.fx = mx; h.ft = mt; }
  // 横と奥行き: 段や壁でとまらない（浮かんでこえる）。左右の見えない壁と、時間のはしでとまる
  // 速さは、なめらかに上がる。はなしたら、その場で止まる（v041: 体の動きだけを、ゆっくり待機へもどす）
  const sp = HERO.speed * (running ? HERO.run : 1);
  if (len > 0.05) { const rate = Math.min(1, dt * HERO.accel); h.vx += (mx * sp - h.vx) * rate; h.vt += (mt * sp - h.vt) * rate; }
  else { h.vx = 0; h.vt = 0; }
  const nx = h.x + h.vx * dt, nt = h.t + h.vt * dt;
  h.x = Math.max(0.3, Math.min(L.W - 0.3, nx)); if (h.x !== nx) h.vx = 0;
  h.t = Math.max(-0.5, Math.min(L.T + 0.5, nt)); if (h.t !== nt) h.vt = 0;
  // 見た目の動き（ゆれ・前のめり・回り）に使う速さ。止まったあとも、少しずつ落ちていく
  // はなした瞬間から待機へ移りはじめる（v042: 走りの速さぶんを先に落として、待ちが見えないように）
  const real = Math.hypot(h.vx, h.vt) / HERO.speed;
  if (real >= (h.speed || 0)) h.speed = real;
  else { if (len <= 0.05) h.speed = Math.min(h.speed, 1); h.speed += (real - h.speed) * Math.min(1, dt * HERO.settle); }
  // 高さ: 足もと（足の大きさぶん）の面へ、ばねで寄る。奈落なら、さっきの高さのまま
  const g = footGround(L, pieces, h.x, h.t, Infinity);
  if (Number.isFinite(g)) h.floor = g;
  // 進む先の高い面を先読みして、段の手前から浮かび上がる（のぼりで、ぱっと持ち上がらないように）。下りは足もとまで来てから
  let target = h.floor;
  const vl = Math.hypot(h.vx, h.vt);
  const ahead = vl > 0.3 ? Math.max(0.8, vl * HERO.look) : 0;
  for (let u = 0.4; u <= ahead; u += 0.4) {
    const ga = footGround(L, pieces, h.x + (h.vx / vl) * u, h.t + (h.vt / vl) * u, Infinity);
    if (Number.isFinite(ga) && ga > target) target = ga;
  }
  h.vy += (HERO.k * (target - h.y) - HERO.c * h.vy) * dt;
  h.y += h.vy * dt;
  // それでも面に深くめりこむときだけ、ゆっくり押し上げる
  if (h.y < h.floor - HERO.sink) { h.y += (h.floor - HERO.sink - h.y) * Math.min(1, dt * 12); if (h.vy < 0) h.vy = 0; }
  h.grounded = true;
  return '';
}
