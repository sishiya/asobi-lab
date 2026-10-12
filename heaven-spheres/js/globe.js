'use strict';
// 地球儀で見る（3D の軽い案。ユーザー 2026-10-12「3Dは軽い案で試してみて」）。
// いまの世界は大地の輪切り（1本の輪）なので、その輪を球の赤道に巻いて、斜めから回して見る。
// 生き物が住むのは赤道にそった帯だけで、まわりは「未知の地」（古い地図の白いところ）。見るだけで、さわる操作は輪切りで。
// canvas 2D に、球を緯度・経度の四角に分けて自分で投影して描く（ライブラリなし）。裏を向いた面は描かず、遠い順に塗る。
// cam = { yaw, pitch, z }。yaw は地軸まわり、pitch は上から見下ろす角度。

const LATS = [-90, -70, -50, -36, -26, -18, -11, -5, 0, 5, 11, 18, 26, 36, 50, 70, 90];   // 赤道のあたりを細かく
const BAND = 13;                          // この緯度（度）までが生き物の帯（地形と海の色）
const RELIEF = 26;                        // この緯度で地形の高さが 0 になる
const LON_STEP = 2;                       // 経度の刻み（度）＝区画 2 つ

function globeLook(cam) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  // 世界の点 → カメラの座標（z が大きいほど手前）
  return (x, y, z) => {
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };
}
const sph3 = (lonRad, latDeg, r) => {
  const la = latDeg * Math.PI / 180, c = Math.cos(la);
  return [r * c * Math.cos(lonRad), r * Math.sin(la), r * c * Math.sin(lonRad)];
};

function drawGlobe(ctx, Wd, L, cam, cw, ch, dpr) {
  if (!PAT) makePatterns(ctx);
  const k = Math.min(cw, ch) / WSIZE * cam.z, ox = cw / 2, oy = ch / 2;
  const look = globeLook(cam);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = fitPat(PAT.paper, 1); ctx.fillRect(0, 0, cw, ch);
  // 遠くの星（動かない飾り）
  const rs = mulberry32(11); ctx.fillStyle = 'rgba(58,42,28,.45)';
  for (let i = 0; i < 70; i++) star(ctx, rs() * cw, rs() * ch, rs() < 0.2 ? 2.4 : 1.2);

  const [moon, sun] = Wd.sph;
  const sunW = [Math.cos(sun.a), 0, Math.sin(sun.a)], Lc = look(...sunW);
  const mp = moonPos(Wd), moonW = [mp.x * 0.78, 0, mp.y * 0.78], sunP = sph3(sun.a, 0, sun.r * 0.78);

  // 天球の輪（赤道の面の円）: 奥の半分 → 球 → 手前の半分
  const orbit = (r, front) => {
    ctx.beginPath(); let on = false;
    for (let d = 0; d <= 360; d += 3) {
      const a = d * Math.PI / 180, [x, y, z] = look(r * Math.cos(a), 0, r * Math.sin(a));
      if ((z >= 0) !== front) { on = false; continue; }
      on ? ctx.lineTo(ox + x * k, oy - y * k) : ctx.moveTo(ox + x * k, oy - y * k); on = true;
    }
    ctx.stroke();
  };
  const bodies = [
    { p: look(...sunP), draw: (x, y, s) => globeSun(ctx, x, y, s) },
    { p: look(...moonW), draw: (x, y, s) => globeMoon(ctx, x, y, s) },
  ];
  ctx.strokeStyle = 'rgba(58,42,28,.55)'; ctx.lineWidth = 1;
  orbit(moon.r * 0.78, false); orbit(sun.r * 0.78, false);
  for (const b of bodies) if (b.p[2] < 0) b.draw(ox + b.p[0] * k, oy - b.p[1] * k, k);

  // 球の頂点（経度ごとの地形の高さ。帯の外は R0）
  const nLon = 360 / LON_STEP, nLat = LATS.length;
  const surf = new Float32Array(nLon), kind = new Uint8Array(nLon);   // 0 陸 1 水 2 氷 3 焼けた地
  for (let j = 0; j < nLon; j++) {
    const i = j * LON_STEP, i2 = (i + 1) % N;
    const h = (Wd.h[i] + Wd.h[i2]) / 2, g = (Wd.g[i] + Wd.g[i2]) / 2;
    surf[j] = g + (h > 0.3 ? h : 0);
    kind[j] = Wd.ice[i] ? 2 : h > 0.3 ? 1 : Wd.T[i] > 38 ? 3 : 0;
  }
  const V = new Array(nLat * (nLon + 1));
  for (let a = 0; a < nLat; a++) {
    const lat = LATS[a], f = Math.max(0, 1 - (lat / RELIEF) ** 2);
    for (let j = 0; j <= nLon; j++) {
      const lon = (j * LON_STEP + LON_STEP / 2) * Math.PI / 180;
      const r = R0 + surf[j % nLon] * f * f * 1.6;      // 高さは見やすく 1.6 倍
      V[a * (nLon + 1) + j] = look(...sph3(lon, lat, r));
    }
  }
  // 面: 裏を向いたものを除いて、遠い順に
  const faces = [];
  for (let a = 0; a < nLat - 1; a++) for (let j = 0; j < nLon; j++) {
    const p0 = V[a * (nLon + 1) + j], p1 = V[a * (nLon + 1) + j + 1], p2 = V[(a + 1) * (nLon + 1) + j + 1], p3 = V[(a + 1) * (nLon + 1) + j];
    const ux = p2[0] - p0[0], uy = p2[1] - p0[1], uz = p2[2] - p0[2], vx = p3[0] - p1[0], vy = p3[1] - p1[1], vz = p3[2] - p1[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const cx = p0[0] + p2[0], cy = p0[1] + p2[1], cz = p0[2] + p2[2];
    if (nx * cx + ny * cy + nz * cz < 0) { nx = -nx; ny = -ny; nz = -nz; }   // 外向きに
    if (nz <= 0) continue;
    const nl = Math.hypot(nx, ny, nz) || 1;
    faces.push({ a, j, p: [p0, p1, p2, p3], z: cz, lit: (nx * Lc[0] + ny * Lc[1] + nz * Lc[2]) / nl });
  }
  faces.sort((A, B) => A.z - B.z);
  const COL = [[196, 168, 120], [120, 150, 165], [232, 238, 242], [200, 110, 60]];
  for (const F of faces) {
    const latMid = (LATS[F.a] + LATS[F.a + 1]) / 2, inBand = Math.abs(latMid) < BAND;
    let c = inBand ? COL[kind[F.j]] : [240, 226, 192];
    if (inBand && kind[F.j] === 0 && Wd.grass[F.j * LON_STEP] > 0.5) c = [168, 160, 105];   // 草の多い陸
    const sh = 0.62 + 0.38 * Math.max(0, F.lit);
    // 夜の側はインクの茶色に寄せる（灰色にしない）
    ctx.fillStyle = `rgb(${c[0] * sh + 40 * (1 - sh) | 0},${c[1] * sh + 26 * (1 - sh) | 0},${c[2] * sh + 14 * (1 - sh) | 0})`;
    ctx.beginPath();
    for (let q = 0; q < 4; q++) { const [x, y] = F.p[q]; q ? ctx.lineTo(ox + x * k, oy - y * k) : ctx.moveTo(ox + x * k, oy - y * k); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.6; ctx.stroke();       // すきまを埋める
    // 経線（30 度ごと）と、帯のふち
    ctx.strokeStyle = 'rgba(58,42,28,.35)'; ctx.lineWidth = 0.7;
    if ((F.j * LON_STEP) % 30 === 0) { ctx.beginPath(); ctx.moveTo(ox + F.p[0][0] * k, oy - F.p[0][1] * k); ctx.lineTo(ox + F.p[3][0] * k, oy - F.p[3][1] * k); ctx.stroke(); }
    if (LATS[F.a + 1] === BAND || LATS[F.a] === -BAND || Math.abs(LATS[F.a]) === 50) {
      const e = LATS[F.a + 1] === BAND ? [3, 2] : [0, 1];
      ctx.beginPath(); ctx.moveTo(ox + F.p[e[0]][0] * k, oy - F.p[e[0]][1] * k); ctx.lineTo(ox + F.p[e[1]][0] * k, oy - F.p[e[1]][1] * k); ctx.stroke();
    }
  }

  // 未知の地の文字（北と南）
  for (const lat of [42, -42]) {
    const [x, y, z] = look(...sph3(Math.PI / 2 - cam.yaw, lat, R0));   // いま正面に見えている経度
    if (z > 0) { ctx.fillStyle = 'rgba(58,42,28,.55)'; ctx.font = `${Math.max(10, 13 * cam.z)}px serif`; ctx.textAlign = 'center'; ctx.fillText('未知の地', ox + x * k, oy - y * k); }
  }

  // 生き物: 帯の上の点（見えている側だけ）。緯度は少しずつずらして重ならないように
  const col = new Map(L.species.map(s => [s.id, s.color]));
  ctx.lineWidth = 0.8; ctx.strokeStyle = INK;
  for (const c of L.list) {
    if (c.dead) continue;
    const i = idx(c.th), lat = ((c.id * 37) % 13 - 6) * 0.9;
    const r = R0 + (Wd.g[i] + (Wd.h[i] > 0.3 ? Wd.h[i] : 0)) * 1.6 * (1 - (lat / RELIEF) ** 2) ** 2 + 3;
    const [x, y, z] = look(...sph3(c.th, lat, r));
    if (z < R0 * 0.15) continue;
    ctx.fillStyle = col.get(c.sp) || '#7d9aa6';
    ctx.beginPath(); ctx.arc(ox + x * k, oy - y * k, Math.max(1.8, 3.2 * cam.z * (c.lander ? 1.15 : 1)), 0, TAU); ctx.fill(); ctx.stroke();
  }

  // 手前の天球の輪と、太陽・月
  ctx.strokeStyle = 'rgba(58,42,28,.7)'; ctx.lineWidth = 1.2;
  orbit(moon.r * 0.78, true); orbit(sun.r * 0.78, true);
  for (const b of bodies) if (b.p[2] >= 0) b.draw(ox + b.p[0] * k, oy - b.p[1] * k, k);
}

function globeSun(ctx, x, y, k) {
  const r = 20 * k * 1.6;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#e7c35f'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16; ctx.lineTo(Math.cos(a) * r * (i % 2 ? 1.25 : 1.55), Math.sin(a) * r * (i % 2 ? 1.25 : 1.55)); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(-r * 0.33, -r * 0.15, r * 0.16, Math.PI * 1.15, Math.PI * 1.85); ctx.moveTo(r * 0.5, -r * 0.15); ctx.arc(r * 0.33, -r * 0.15, r * 0.16, Math.PI * 1.15, Math.PI * 1.85);
  ctx.moveTo(-r * 0.33, r * 0.3); ctx.quadraticCurveTo(0, r * 0.55, r * 0.33, r * 0.3); ctx.stroke();
  ctx.restore();
}
function globeMoon(ctx, x, y, k) {
  const r = 15 * k * 1.6;
  ctx.fillStyle = '#f1ead2'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(90,80,60,.35)';
  for (const [cx, cy, cr] of [[-0.3, -0.3, 0.2], [0.3, 0.25, 0.15], [-0.1, 0.4, 0.1]]) { ctx.beginPath(); ctx.arc(x + cx * r, y + cy * r, cr * r, 0, TAU); ctx.fill(); }
}
