'use strict';
// 世界をくずす（v010。2026-10-13 ユーザー「箱庭世界が崩壊するボタンを追加して。物理法則にしたがってすべて崩れ落ちる／
//   外が崩れるが中から何かこの物語の核心となる何かがでてくる」）。
//   見せるだけの演出で、世界（W・L）は書きかえない。「もとにもどす」で、くずす前の世界にそのまま戻る。
//   大地を CS 区画四方のかけら（地面の板と、その下の岩の根を何段か）に分け、かけらは重力で落ち、回り、
//   ぶつかり合いはしない（深淵へ離れていくので）。水は粒になってこぼれ、生き物は光の粒になって空へ（むごく見せない）。
//   fall: ふちから内へひびが進み、すべて深淵へ落ちる。
//   shell: 中から丸い世界（本当の大地＝球）がふくらみ、殻を押しのけて現れる。物語の核心は企画の「大地が丸くなる答え合わせ」
//          （PLAN.md 段階C・DESIGN.md 6章）。言葉は DESIGN.md のもの。

let COL = null;
const CS = 4, LAYER = 18, GRAV = 46;

function buildCollapse(mode) {
  cellColors();
  // 上から見た地図（区画1つ＝1画素。昼夜の明るさをこめる）
  const map = document.createElement('canvas'); map.width = map.height = N;
  const mx = map.getContext('2d'), im = mx.createImageData(N, N), d = new Uint32Array(im.data.buffer);
  for (let i = 0; i < NN; i++) { if (NEAR[i] < 0) continue; const k = 0.55 + 0.45 * LUM[i]; d[i] = rgba(TR[i] * k, TG[i] * k, TB[i] * k); }
  mx.putImageData(im, 0, 0);
  // 横の面（上ほど土、下ほど岩。1 の高さ＝4 画素）
  const ZT = 20, ZB = -THICK - ROOT_D - 4, side = document.createElement('canvas'); side.width = 8; side.height = (ZT - ZB) * 4;
  const sx = side.getContext('2d'), STR = [[170, 128, 84], [142, 104, 70], [188, 152, 104], [124, 94, 70], [160, 120, 80]];
  for (let y = 0; y < side.height; y++) {
    const z = ZT - y / 4;
    let c;
    if (z > -THICK) c = STR[(Math.floor(z + 40)) % 5].map(v => v * 0.9);
    else { const t = (-THICK - z) / ROOT_D; c = [mix(112, 50, t), mix(92, 42, t), mix(74, 46, t)].map(v => v * (0.85 + 0.3 * hash2(y >> 2, 3))); }
    sx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; sx.fillRect(0, y, 8, 1);
  }
  const zpix = z => (ZT - z) * 4;
  const chunks = [];
  const G2 = N / CS;
  for (let by = 0; by < G2; by++) for (let bx = 0; bx < G2; bx++) {
    let zs = 0, ws = 0, n = 0;
    for (let y = by * CS; y < by * CS + CS; y++) for (let x = bx * CS; x < bx * CS + CS; x++) { const i = y * N + x; if (inside[i]) { zs += Zs[i]; ws += W.w[i]; n++; } }
    if (n < CS * CS * 0.35) continue;
    const cx = bx * CS + CS / 2, cy = by * CS + CS / 2, r = Math.hypot(cx - C, cy - C);
    const zt = zs / n, water = ws / n;
    const mk = (z0, z1, top, k) => ({ cx, cy, cz: (z0 + z1) / 2, hz: (z1 - z0) / 2, z0, z1, u0: bx * CS, v0: by * CS, top, r, k, water: top ? water : 0,
      px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, az: 0, wx: 0, wy: 0, wz: 0, on: false, tr: 1e9, gone: false });
    chunks.push(mk(-THICK, Math.max(-THICK + 1, zt), true, 0));
    const rd = ROOT_D * (1 - Math.pow(Math.min(1, r / (RD - 0.6)), 4 / 3));
    for (let k = 0, z = -THICK; k < 8 && z > -THICK - rd + 2; k++, z -= LAYER) chunks.push(mk(Math.max(-THICK - rd, z - LAYER), z, false, k + 1));
  }
  // となりのかけら（まだ落ちていない同じ段のとなりがあれば、そのあいだの面は見えないので描かない）
  const idx = new Map(chunks.map(c => [c.u0 + ',' + c.v0 + ',' + c.k, c]));
  for (const c of chunks) c.nb = [null, [CS, 0], [-CS, 0], [0, CS], [0, -CS], null].map(o => o && idx.get((c.u0 + o[0]) + ',' + (c.v0 + o[1]) + ',' + c.k) || null);
  for (const c of chunks) {
    const nz = hash2(c.u0 * 7 + c.k, c.v0 * 3);
    if (mode === 'fall') c.tr = 1.8 + 6.5 * Math.pow(1 - Math.min(1, c.r / RD), 0.9) + nz * 0.7 + c.k * 0.06;
  }
  // 生き物は光の粒に（むごく見せない）
  const motes = L.list.filter(a => !a.dead).map(a => { const p = { x: a.x, y: a.y, z: surfAt(a.x, a.y) + 0.6 }; return { ...p, x0: p.x, y0: p.y, z0: p.z, d: hash2(a.x * 13, a.y * 7), kind: a.kind }; });
  return { mode, t0: null, map, side, zpix, chunks, motes, drops: [], dust: [], core: { r: 0, z: -THICK - 26, spin: 0 }, said: false, panel: false, shake: 0 };
}

function startCollapse(mode) {
  COL = buildCollapse(mode);
  G.sel = null; hover = null; updateCard && updateCard();
  document.body.classList.add('collapsing');
  Sound.play('rumble');
}
function endCollapse() {
  COL = null;
  document.body.classList.remove('collapsing');
  layout(V.cw, V.ch);
  toast('世界がもとにもどった');
  Sound.play('spring');
}

function releaseChunk(c, vx, vy, vz) {
  c.on = true; c.vx = vx; c.vy = vy; c.vz = vz;
  const s = c.top ? 1 : 0.5;
  c.wx = (hash2(c.u0, c.k + 1) - 0.5) * 2.4 * s; c.wy = (hash2(c.v0, c.k + 2) - 0.5) * 2.4 * s; c.wz = (hash2(c.u0 + c.v0, c.k) - 0.5) * 1.2 * s;
  if (c.top && c.water > 0.08) for (let n = 0; n < Math.min(10, 3 + c.water * 6); n++)
    COL.drops.push({ x: c.cx + (Math.random() - 0.5) * CS, y: c.cy + (Math.random() - 0.5) * CS, z: c.z1, vx: vx + (Math.random() - 0.5) * 3, vy: vy + (Math.random() - 0.5) * 3, vz: vz + Math.random() * 3, t: 0 });
  if (c.top) for (let n = 0; n < 4; n++) COL.dust.push({ x: c.cx + (Math.random() - 0.5) * CS, y: c.cy + (Math.random() - 0.5) * CS, z: c.z0 + Math.random() * 3, t: Math.random() * 0.3, s: 0.5 + Math.random() * 0.8, vz: -2 - Math.random() * 4 });
  if (Math.random() < 0.06) Sound.play('crack');
}

function stepCollapse(dt, T) {
  const K = COL;
  if (K.mode === 'shell') {
    // 丸い世界がふくらみ、上がってくる
    const g = Math.max(0, Math.min(1, (T - 1.6) / 4.2)), e = g * g * (3 - 2 * g);
    K.core.r = RD * 0.5 * e; K.core.z = mix(-THICK - 26, 4, e); K.core.spin += dt * 0.12;
    for (const c of K.chunks) if (!c.on && T > 1.6) {
      const dx = c.cx - C, dy = c.cy - C, dz = c.cz - K.core.z, dd = Math.hypot(dx, dy, dz);
      if (dd < K.core.r + (c.top ? 2 : 6) + c.hz) {
        const sp = 7 + 7 * hash2(c.u0, c.v0) + (c.top ? 3 : 0);
        releaseChunk(c, dx / dd * sp, dy / dd * sp, Math.max(-4, dz / dd * sp) + (c.top ? 4 : 0));
      } else if (T > 5.4 + (c.r / RD) * 3.2 + hash2(c.u0, c.v0) * 0.6) {   // 球が出たあと、のこりの殻も内から外へ崩れ落ちる
        const d = Math.hypot(dx, dy) || 1, sp = 1 + 2 * hash2(c.v0, c.u0);
        releaseChunk(c, dx / d * sp, dy / d * sp, 1);
      }
    }
  } else {
    for (const c of K.chunks) if (!c.on && T >= c.tr) {
      const dx = c.cx - C, dy = c.cy - C, d = Math.hypot(dx, dy) || 1, sp = 0.8 + 2.2 * hash2(c.u0, c.v0 + 9);
      releaseChunk(c, dx / d * sp, dy / d * sp, 1.5 * hash2(c.v0, c.u0));
    }
  }
  for (const c of K.chunks) {
    if (!c.on || c.gone) continue;
    c.vz -= GRAV * dt; c.px += c.vx * dt; c.py += c.vy * dt; c.pz += c.vz * dt;
    c.ax += c.wx * dt; c.ay += c.wy * dt; c.az += c.wz * dt;
    if (c.pz < -260) c.gone = true;
  }
  for (const p of K.drops) { p.vz -= GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.t += dt; }
  K.drops = K.drops.filter(p => p.z > -250 && p.t < 6);
  for (const p of K.dust) p.t += dt;
  K.dust = K.dust.filter(p => p.t < 1.6);
  K.shake = T < 1.6 ? 0.5 + T * 0.6 : Math.max(0, 1.4 - (T - 1.6) * 0.18);
}

// 3D の回転（x→y→z）
function rotM(ax, ay, az) {
  const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay), cc = Math.cos(az), sc = Math.sin(az);
  return [cb * cc, sa * sb * cc - ca * sc, ca * sb * cc + sa * sc, cb * sc, sa * sb * sc + ca * cc, ca * sb * sc - sa * cc, -sb, sa * cb, ca * cb];
}
const FACES = [  // 法線, 角3つ（P0, P1＝u の向き, P2＝v の向き）
  [[0, 0, 1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1]],
  [[1, 0, 0], [1, -1, 1], [1, 1, 1], [1, -1, -1]],
  [[-1, 0, 0], [-1, 1, 1], [-1, -1, 1], [-1, 1, -1]],
  [[0, 1, 0], [1, 1, 1], [-1, 1, 1], [1, 1, -1]],
  [[0, -1, 0], [-1, -1, 1], [1, -1, 1], [-1, -1, -1]],
  [[0, 0, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, -1]],
];

function drawChunk(ctx, c, toCam, Ls) {
  const K = COL, R = rotM(c.ax, c.ay, c.az), h = CS / 2;
  const ox = c.cx + c.px, oy = c.cy + c.py, oz = c.cz + c.pz;
  const P = (a, b, e) => { const lx = a * h, ly = b * h, lz = e * c.hz; return proj(ox + R[0] * lx + R[1] * ly + R[2] * lz, oy + R[3] * lx + R[4] * ly + R[5] * lz, oz + R[6] * lx + R[7] * ly + R[8] * lz); };
  for (let f = 0; f < 6; f++) {
    const [n, A, B, D] = FACES[f];
    const nx = R[0] * n[0] + R[1] * n[1] + R[2] * n[2], ny = R[3] * n[0] + R[4] * n[1] + R[5] * n[2], nz = R[6] * n[0] + R[7] * n[1] + R[8] * n[2];
    if (nx * toCam[0] + ny * toCam[1] + nz * toCam[2] <= 0.001) continue;
    if (f === 0 && !c.top) continue;                        // 岩の段の上の面は、上の段にかくれている（落ちたら見える）
    if (!c.on) { const o = c.nb[f]; if (o && !o.on && o.z1 >= c.z1 - 0.3) continue; if (f === 5 && c.k < 0) continue; }
    const p0 = P(...A), p1 = P(...B), p2 = P(...D);
    ctx.save();
    ctx.transform(p1.x - p0.x, p1.y - p0.y, p2.x - p0.x, p2.y - p0.y, p0.x, p0.y);
    if (f === 0) ctx.drawImage(K.map, c.u0, c.v0, CS, CS, -0.08, -0.08, 1.16, 1.16);       // 少し大きく描いて、となりとの継ぎ目をふさぐ
    else if (f === 5) { ctx.fillStyle = '#2a2420'; ctx.fillRect(-0.02, -0.02, 1.04, 1.04); }
    else ctx.drawImage(K.side, 0, K.zpix(c.z1), 8, Math.max(1, (c.z1 - c.z0) * 4), -0.03, -0.02, 1.06, 1.04);
    const lit = Math.max(0, nx * Ls[0] + ny * Ls[1] + nz * Ls[2]);
    const dark = f === 0 ? 0.35 * (1 - Math.max(0, nz)) : 0.5 - 0.35 * lit;
    if (dark > 0.02) { ctx.fillStyle = `rgba(8,6,10,${dark})`; if (f === 0) ctx.fillRect(-0.08, -0.08, 1.16, 1.16); else ctx.fillRect(-0.03, -0.02, 1.06, 1.04); }
    ctx.restore();
  }
}

// 丸い世界（地球）: 海・陸・氷・雲・昼と夜・大気のふち
let globeC = null;
function drawGlobe(ctx, t) {
  const K = COL, cr = K.core.r;
  if (cr < 0.5) return;
  const p = proj(C, C, K.core.z), R = cr * V.s;
  const S = Math.max(16, Math.min(280, Math.round(R * 2)));
  if (!globeC || globeC.width !== S) { globeC = document.createElement('canvas'); globeC.width = globeC.height = S; globeC.im = globeC.getContext('2d').createImageData(S, S); globeC.d = new Uint32Array(globeC.im.data.buffer); }
  const d = globeC.d, dtx = detailTex(), ctex = cloudTex(), spin = K.core.spin;
  const sun = bodyPos(W.sun);
  let lx = sun.x - p.x, ly = sun.y - p.y; const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;
  const Lz = 0.55, Ln = Math.hypot(lx, ly, Lz); const LX = lx / Ln, LY = ly / Ln, LZ = Lz / Ln;
  const tilt = 0.41, ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = (x + 0.5) / S * 2 - 1, ny = (y + 0.5) / S * 2 - 1, q = nx * nx + ny * ny;
    if (q > 1) { d[y * S + x] = 0; continue; }
    const nz = Math.sqrt(1 - q);
    // 地軸を傾けて、経度・緯度
    const rx = nx * ct - ny * st, ry = nx * st + ny * ct;
    const lat = Math.asin(-ry), lon = Math.atan2(rx, nz) + spin;
    const U = ((lon / (Math.PI * 2)) * 256) & 255, Vv = Math.floor((lat / Math.PI + 0.5) * 255) & 255;
    const h = dtx[(Vv << 8) | U], h2 = dtx[(((Vv * 3) & 255) << 8) | ((U * 3 + 77) & 255)];
    let r, g, b;
    if (Math.abs(lat) > 1.22 + (h - 0.5) * 0.3) { r = 236; g = 242; b = 250; }
    else if (h > 0.52) {
      const dry = h2 > 0.55 && Math.abs(lat) < 0.6;
      r = dry ? 196 : 74 + 60 * (h - 0.52); g = dry ? 170 : 128 + 40 * h2; b = dry ? 112 : 64;
    } else { const k = Math.min(1, (0.52 - h) * 5); r = mix(46, 14, k); g = mix(120, 52, k); b = mix(176, 128, k); }
    const cl = ctex[(((Vv >> 1) & 127) << 7) | (((U + Math.floor(t * 3)) >> 1) & 127)];
    if (cl > 0.55) { const a = Math.min(0.85, (cl - 0.55) * 4); r = mix(r, 248, a); g = mix(g, 250, a); b = mix(b, 255, a); }
    const dif = nx * LX + ny * LY + nz * LZ, day = Math.max(0, Math.min(1, dif * 2.2 + 0.25));
    const k = 0.12 + 0.95 * day;
    const rim = Math.pow(1 - nz, 3) * 0.7;
    d[y * S + x] = rgba(r * k + 90 * rim * day, g * k + 140 * rim * day, b * k + 255 * rim * (0.3 + day));
  }
  const gx = globeC.getContext('2d'); gx.putImageData(globeC.im, 0, 0);
  // 大気の光
  const ga = ctx.createRadialGradient(p.x, p.y, R * 0.9, p.x, p.y, R * 1.35);
  ga.addColorStop(0, 'rgba(120,190,255,0.45)'); ga.addColorStop(1, 'rgba(120,190,255,0)');
  ctx.fillStyle = ga; ctx.beginPath(); ctx.arc(p.x, p.y, R * 1.35, 0, 7); ctx.fill();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(globeC, p.x - R, p.y - R, R * 2, R * 2);
}

function drawCollapse(ctx, t) {
  const K = COL;
  if (K.t0 === null) K.t0 = t;
  const T = t - K.t0, dt = Math.min(0.05, T - (K.lastT || 0)); K.lastT = T;
  stepCollapse(Math.max(0, dt), T);
  if (!drawBackdrop(ctx, t)) BACKS.dark.back(ctx, t);
  const sh = K.shake * Math.max(1, V.s * 0.12);
  ctx.save();
  ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  const s = Math.sin(V.yaw), c = Math.cos(V.yaw);
  const toCam = [s * V.hf, c * V.hf, V.tilt], tn = Math.hypot(...toCam); toCam[0] /= tn; toCam[1] /= tn; toCam[2] /= tn;
  const sx = Math.cos(W.sun.a), sy = Math.sin(W.sun.a), Ls = [sx * 0.5, sy * 0.5, 0.75];
  const depth = (x, y, z) => x * toCam[0] + y * toCam[1] + z * toCam[2];
  const items = [];
  for (const ch of K.chunks) if (!ch.gone) items.push([depth(ch.cx + ch.px, ch.cy + ch.py, ch.cz + ch.pz), ch]);
  if (K.mode === 'shell') items.push([depth(C, C, K.core.z) + K.core.r * 0.3, 'globe']);
  items.sort((a, b) => a[0] - b[0]);
  // 中からもれる光（殻のとき。割れ目のあいだから）
  if (K.mode === 'shell' && T > 0.8) {
    const p = proj(C, C, K.core.z), a = Math.min(1, (T - 0.8) / 2) * Math.max(0.25, 1 - Math.max(0, T - 6) / 4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rr = (RD * 0.7 + K.core.r) * V.s;
    for (let k = 0; k < 14; k++) {
      const an = k / 14 * Math.PI * 2 + T * 0.05, w = 0.05 + 0.04 * hash2(k, 2);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 1.6);
      g.addColorStop(0, `rgba(255,236,180,${0.35 * a})`); g.addColorStop(1, 'rgba(255,236,180,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, rr * 1.6, an - w, an + w); ctx.fill();
    }
    ctx.restore();
  }
  for (const [, it] of items) {
    if (it === 'globe') drawGlobe(ctx, t);
    else drawChunk(ctx, it, toCam, Ls);
  }
  // 水の粒・土けむり
  ctx.fillStyle = 'rgba(150,200,240,0.85)';
  for (const p of K.drops) { const q = proj(p.x, p.y, p.z); ctx.fillRect(q.x - 1, q.y - 1, 2, 3); }
  for (const p of K.dust) {
    const q = proj(p.x, p.y, p.z + p.vz * p.t), r = V.s * (0.25 + p.t * 0.5) * p.s;
    ctx.fillStyle = `rgba(150,128,104,${0.3 * (1 - p.t / 1.6)})`; ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
  }
  // 生き物の光の粒: くずれるときは空へ、殻のときは丸い世界へ
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const m of K.motes) {
    const u = Math.max(0, Math.min(1, (T - 0.4 - m.d * 1.5) / 4));
    if (u <= 0) { const q = proj(m.x0, m.y0, m.z0); ctx.fillStyle = 'rgba(255,240,200,0.6)'; ctx.fillRect(q.x - 1, q.y - 1, 2, 2); continue; }
    let x, y, z, a;
    if (K.mode === 'shell') { const e = u * u * (3 - 2 * u), an = m.d * 40; x = mix(m.x0, C + Math.cos(an) * K.core.r * 0.7, e); y = mix(m.y0, C + Math.sin(an) * K.core.r * 0.7, e); z = mix(m.z0, K.core.z + K.core.r * 0.5, e) + Math.sin(u * Math.PI) * 10; a = 1 - Math.max(0, u - 0.85) / 0.15; }
    else { x = m.x0 + Math.sin(T + m.d * 9) * u * 2; y = m.y0 + Math.cos(T * 0.8 + m.d * 7) * u * 2; z = m.z0 + u * 30; a = 1 - u; }
    const q = proj(x, y, z), r = 2 + 2 * (1 - u);
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 3);
    g.addColorStop(0, `rgba(255,240,190,${0.8 * a})`); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g; ctx.fillRect(q.x - r * 3, q.y - r * 3, r * 6, r * 6);
  }
  ctx.restore();
  ctx.restore();
  // ことば（殻のとき）
  if (K.mode === 'shell' && T > 7) {
    const a = Math.min(1, (T - 7) / 2);
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = `rgba(244,236,214,${a})`;
    ctx.font = `${Math.max(16, Math.min(26, V.cw / 26))}px serif`;
    ctx.fillText('本当の世界には、果てがない。', V.cw / 2, V.ch * 0.12 + 20);
    ctx.globalAlpha = Math.max(0, Math.min(1, (T - 8.5) / 2));
    ctx.font = `${Math.max(12, Math.min(17, V.cw / 40))}px serif`;
    ctx.fillText('落ちていくものは、どこかで、めぐっている。', V.cw / 2, V.ch * 0.12 + 48);
    ctx.restore();
  }
  if (!K.said && K.mode === 'shell' && T > 5) { K.said = true; Sound.play('reveal'); }
  if (!K.said && K.mode === 'fall' && K.chunks.every(c => c.gone)) { K.said = true; Sound.play('extinct'); }
  if (!K.panel && ((K.mode === 'shell' && T > 12) || (K.mode === 'fall' && K.said && T > 4))) { K.panel = true; if (K.ending) endingPanel(); else collapsePanel(K.mode); }
}

function collapsePanel(mode) {
  const body = mode === 'shell'
    ? `<h2>丸い世界</h2><p>平らな大地の殻の中から、丸い世界が出てきた。</p><p class="truth"><b>本当は</b>　大地は丸い球（地球）。重さはどこでも球の中心へ向かってはたらくので、海の水は果てから落ちていかない。どこまで歩いても果てはなく、いつか元の場所へもどってくる。水は海から雲へ、雲から雨へ、川から海へとめぐっている。</p>`
    : `<h2>深淵へ</h2><p>ひびはふちから内へ走り、大地はかけらになって、深淵へ落ちていった。</p><p class="truth"><b>本当は</b>　物はいつも、大地（地球）の中心へ向かって引かれる。だから本当の世界では、どこまで行っても「下の深淵」へ落ちていくことはない。平らな大地のふちの滝は、近ごろの絵や物語でよく描かれる姿。</p>`;
  showPanel(body + '<p class="small">これは見せるだけ。「もとにもどす」で、くずす前の世界にもどる。</p>',
    [{ label: 'もとにもどす', main: true, fn: endCollapse }, { label: 'このまま見る' }]);
}
