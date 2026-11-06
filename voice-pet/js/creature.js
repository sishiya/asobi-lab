// 生き物の絵（Canvas 2D）。形は express() の数だけで決まる。動きの状態は st に持つ
const TAU = Math.PI * 2;
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
const lerp = (a, b, t) => a + (b - a) * t;
const hsl = (h, s, l, a = 1) => `hsla(${h.toFixed(1)},${(s * 100).toFixed(1)}%,${(Math.max(0, Math.min(1, l)) * 100).toFixed(1)}%,${a})`;
// 影はすこし青へ、光はすこし黄へ寄せる（絵の具の陰影）
const toward = (h, to, k) => { let d = ((to - h + 540) % 360) - 180; return (h + d * k + 360) % 360; };

export function makeState() {
  return { t: 0, blink: 0, nextBlink: 2, gaze: { x: 0, y: 0 }, gazeT: { x: 0, y: 0 }, hop: 0, hopV: 0, listen: 0, mouth: 0, happy: 0, pet: 0, tilt: 0, tiltT: 0, earKick: 0, walk: 0, scale: 1 };
}

// 体の形（毎回同じ形になるよう seed で作るでこぼこ）を前もって作る
export function buildShape(ph) {
  const R = rng(ph.seed), N = 120;
  const bumps = [];
  for (let i = 0; i < 4; i++) bumps.push({ k: 2 + i, a: (R() - 0.5) * 0.05, p: R() * TAU });
  const nSp = 5 + Math.floor(R() * 4), spPh = R() * TAU;
  const fur = [];
  for (let i = 0; i < 260; i++) fur.push({ a: R(), len: 0.5 + R() * 0.8, tw: (R() - 0.5) * 0.9, sh: R() });
  const spots = [];
  const nSpots = Math.round(ph.spots * 16);
  for (let i = 0; i < nSpots; i++) {
    const a = R() * TAU, r = Math.sqrt(R()) * 0.85;
    spots.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.9 - 0.1, s: 0.06 + R() * 0.12 * (0.5 + ph.spots), rot: R() * TAU, e: 0.6 + R() * 0.5 });
  }
  return { N, bumps, nSp, spPh, fur, spots, tailSide: R() < 0.5 ? -1 : 1 };
}

// 体のふちの点（ローカル座標、中心 0,0、半径 1 の大きさ）
export function outline(ph, sh, squash) {
  const pts = [];
  const ax = Math.sqrt(ph.aspect) * squash.x, ay = 1 / Math.sqrt(ph.aspect) * squash.y;
  for (let i = 0; i < sh.N; i++) {
    const th = i / sh.N * TAU, c = Math.cos(th), s = Math.sin(th);
    // 下ぶくれ（すわりのよい形）と、つぶれた底
    let r = 1 + 0.1 * s;
    for (const b of sh.bumps) r += b.a * Math.cos(b.k * th + b.p);
    // とがり（キキ）は上半分に、まるさ（ブーバ）は小さなふくらみに
    if (s < 0.25) {
      const up = Math.min(1, (0.25 - s) / 0.9);
      const w = Math.pow(Math.max(0, Math.cos(sh.nSp * th + sh.spPh)), lerp(3, 14, ph.spiky));
      r += up * w * lerp(0.03, 0.26, ph.spiky * ph.spiky);
    }
    let y = s * r * ay;
    if (y > 0.82 * ay) y = 0.82 * ay + (y - 0.82 * ay) * 0.35;
    pts.push([c * r * ax, y]);
  }
  return pts;
}

export function pathPts(ctx, pts, cx, cy, R) {
  ctx.beginPath();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % n];
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    if (i === 0) ctx.moveTo(cx + mx * R, cy + my * R);
    else ctx.quadraticCurveTo(cx + p0[0] * R, cy + p0[1] * R, cx + mx * R, cy + my * R);
  }
  const p0 = pts[0], p1 = pts[1];
  ctx.quadraticCurveTo(cx + p0[0] * R, cy + p0[1] * R, cx + (p0[0] + p1[0]) / 2 * R, cy + (p0[1] + p1[1]) / 2 * R);
  ctx.closePath();
}

export function update(st, dt, ph) {
  st.t += dt;
  const pace = lerp(0.7, 1.6, ph.legs);
  st.nextBlink -= dt;
  if (st.nextBlink < 0) { st.blink = 1; st.nextBlink = 1.5 + Math.random() * 3.5; }
  st.blink = Math.max(0, st.blink - dt * 7);
  // ときどきよそ見
  if (Math.random() < dt * 0.4 * pace && !st.lookAt) st.gazeT = { x: (Math.random() - 0.5) * 1.4, y: (Math.random() - 0.5) * 0.6 };
  if (st.lookAt) st.gazeT = st.lookAt;
  const k = 1 - Math.exp(-dt * 10 * pace);
  st.gaze.x += (st.gazeT.x - st.gaze.x) * k; st.gaze.y += (st.gazeT.y - st.gaze.y) * k;
  // とびはね（ばね）
  st.hopV -= dt * 30; st.hop += st.hopV * dt;
  if (st.hop < 0) { st.hop = 0; st.hopV = st.hopV < -2 ? -st.hopV * 0.25 : 0; }
  st.happy = Math.max(0, st.happy - dt * 0.6);
  st.pet = Math.max(0, st.pet - dt * 1.5);
  st.earKick = Math.max(0, st.earKick - dt * 3);
  st.tilt += (st.tiltT - st.tilt) * (1 - Math.exp(-dt * 6));
}

export function hop(st, h = 6) { if (st.hop < 0.05) st.hopV = h; }

// 地面の (gx, gy) に立つ生き物を描く。scale は画面に合わせた倍率
export function draw(ctx, ph, sh, st, gx, gy, scale) {
  const R = ph.radius * scale * st.scale;
  const t = st.t, pace = lerp(0.7, 1.6, ph.legs);
  const breathe = Math.sin(t * TAU * 0.28 * pace) * 0.018;
  const land = st.hop === 0 && st.hopV === 0 ? 0 : 0;
  const stretch = Math.max(-0.12, Math.min(0.12, st.hopV * 0.012));
  const squash = { x: 1 - breathe * 0.6 - stretch * 0.6 + land, y: 1 + breathe + stretch };
  const legLen = lerp(0.1, 0.42, ph.legs) * R;
  const lift = st.hop * R * 0.55;
  const bodyBottom = gy - legLen * 0.75 - lift;
  const ay = 1 / Math.sqrt(ph.aspect) * squash.y;
  const cy = bodyBottom - 0.84 * ay * R;
  const cx = gx;
  const pts = outline(ph, sh, squash);

  const h = ph.hue, s = ph.sat, l = ph.lum;
  const base = hsl(h, s, l), dark = hsl(toward(h, 250, 0.35), s * 0.85, l * 0.5), lite = hsl(toward(h, 50, 0.2), s * 0.9, l + (1 - l) * 0.38);

  // 地面の影（とぶと小さく薄く）
  const sh0 = 1 / (1 + st.hop * 1.2);
  let g = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 1.15 * sh0);
  g.addColorStop(0, `rgba(8,6,14,${0.55 * sh0})`); g.addColorStop(0.6, `rgba(8,6,14,${0.25 * sh0})`); g.addColorStop(1, 'rgba(8,6,14,0)');
  ctx.save(); ctx.translate(gx, gy); ctx.scale(1, 0.22); ctx.translate(-gx, -gy);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, R * 1.15 * sh0, 0, TAU); ctx.fill(); ctx.restore();

  ctx.save();
  ctx.translate(cx, cy + R * 0.6); ctx.rotate(st.tilt * 0.18); ctx.translate(-cx, -(cy + R * 0.6));

  // しっぽ（うしろ）
  drawTail(ctx, ph, sh, st, cx, cy, R, dark, base);
  // 足（うしろの2本は暗く）
  const step = Math.sin(t * TAU * 1.2 * pace) * (st.walk || 0);
  const legW = lerp(0.2, 0.13, ph.legs) * R;
  const ax = Math.sqrt(ph.aspect) * R;
  for (const [dx, back] of [[-0.42, 1], [0.42, 1], [-0.24, 0], [0.24, 0]]) {
    if (back) drawLeg(ctx, cx + dx * ax * 1.05, bodyBottom - R * 0.08, legLen * 0.92 + lift * 0.0, legW * 0.9, dark, dark, step * (dx < 0 ? 1 : -1));
  }
  // 耳・かざり（体よりうしろ）
  drawEars(ctx, ph, sh, st, cx, cy, R, base, dark, lite);

  // 体
  pathPts(ctx, pts, cx, cy, R);
  g = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.5, R * 0.1, cx + R * 0.1, cy + R * 0.15, R * 1.35);
  g.addColorStop(0, lite); g.addColorStop(0.45, base); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fill();

  ctx.save();
  pathPts(ctx, pts, cx, cy, R); ctx.clip();
  // もよう
  for (const p of sh.spots) {
    ctx.save(); ctx.translate(cx + p.x * ax, cy + p.y * R); ctx.rotate(p.rot);
    ctx.fillStyle = hsl(toward(h, 250, 0.25), s * 0.9, l * 0.62, 0.55);
    ctx.beginPath(); ctx.ellipse(0, 0, p.s * R, p.s * R * p.e, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  // おなか
  g = ctx.createRadialGradient(cx, cy + R * 0.42, 0, cx, cy + R * 0.42, R * 0.62);
  g.addColorStop(0, hsl(toward(h, 50, 0.3), s * 0.5, l + (1 - l) * 0.5, 0.75)); g.addColorStop(1, hsl(h, s * 0.5, l + (1 - l) * 0.5, 0));
  ctx.fillStyle = g; ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
  // 底のかげ（地面の照り返しの前）
  g = ctx.createLinearGradient(0, cy + R * 0.2, 0, cy + R * 0.95);
  g.addColorStop(0, 'rgba(10,8,30,0)'); g.addColorStop(1, 'rgba(10,8,30,0.4)');
  ctx.fillStyle = g; ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
  // 毛の筋（体の中）
  if (ph.fluff > 0.12) {
    ctx.lineCap = 'round';
    for (let i = 0; i < sh.fur.length; i += 2) {
      const f = sh.fur[i], a = f.a * TAU, rr = 0.25 + f.sh * 0.7;
      const x = cx + Math.cos(a) * rr * ax * 0.95, y = cy + Math.sin(a) * rr * R * 0.95;
      const L = R * 0.09 * f.len * ph.fluff;
      const dirx = Math.cos(a) * 0.5 + f.tw * 0.3, diry = 0.8 + Math.sin(a) * 0.3;
      ctx.strokeStyle = f.sh > 0.5 ? hsl(h, s * 0.8, l + (1 - l) * 0.3, 0.22 * ph.fluff) : hsl(toward(h, 250, 0.3), s, l * 0.55, 0.22 * ph.fluff);
      ctx.lineWidth = R * 0.012;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dirx * L, y + diry * L); ctx.stroke();
    }
  }
  // つるつるの照り（毛が少ないほど）
  const gloss = 1 - ph.fluff;
  if (gloss > 0.05) {
    g = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.55, 0, cx - R * 0.42, cy - R * 0.55, R * 0.42);
    g.addColorStop(0, `rgba(255,248,230,${0.42 * gloss})`); g.addColorStop(1, 'rgba(255,248,230,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
  }
  ctx.restore();
  // ふちの光（ランプは左上）
  pathPts(ctx, pts, cx, cy, R);
  g = ctx.createLinearGradient(cx - R, cy - R, cx + R * 0.4, cy + R * 0.4);
  g.addColorStop(0, `rgba(255,226,170,${0.55})`); g.addColorStop(0.5, 'rgba(255,226,170,0)');
  ctx.strokeStyle = g; ctx.lineWidth = R * 0.022; ctx.stroke();
  // 毛のふち（外へはねる毛）
  if (ph.fluff > 0.12) drawFurEdge(ctx, ph, sh, st, pts, cx, cy, R, base, dark, lite);

  // 前足
  for (const [dx] of [[-0.24], [0.24]]) drawLeg(ctx, cx + dx * ax, bodyBottom - R * 0.02, legLen + lift * 0.0, legW, base, dark, step * (dx < 0 ? -1 : 1), lite);

  drawFace(ctx, ph, st, cx, cy, R, h, s, l);
  ctx.restore();
  return { cx, cy, R, ax };
}

function drawLeg(ctx, x, y, len, w, col, dark, swing, lite) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(swing * 0.25);
  const g = ctx.createLinearGradient(-w, 0, w, 0);
  g.addColorStop(0, lite || col); g.addColorStop(0.5, col); g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w * 0.55, 0); ctx.lineTo(-w * 0.5, len - w * 0.4);
  ctx.quadraticCurveTo(-w * 0.9, len + w * 0.05, 0, len + w * 0.08);
  ctx.quadraticCurveTo(w * 0.9, len + w * 0.05, w * 0.5, len - w * 0.4);
  ctx.lineTo(w * 0.55, 0); ctx.closePath(); ctx.fill();
  // 指先の小さな線
  ctx.strokeStyle = 'rgba(20,12,30,0.35)'; ctx.lineWidth = w * 0.08; ctx.lineCap = 'round';
  for (const d of [-0.22, 0.22]) { ctx.beginPath(); ctx.moveTo(d * w, len - w * 0.12); ctx.lineTo(d * w, len + w * 0.02); ctx.stroke(); }
  ctx.restore();
}

function drawTail(ctx, ph, sh, st, cx, cy, R, dark, base) {
  const side = sh.tailSide, wag = Math.sin(st.t * TAU * lerp(0.6, 2.2, ph.legs) * (1 + st.happy * 1.5)) * (0.2 + st.happy * 0.5);
  const len = R * lerp(0.45, 0.8, ph.crest), w = R * lerp(0.12, 0.2, ph.fluff);
  const x0 = cx + side * Math.sqrt(ph.aspect) * R * 0.7, y0 = cy + R * 0.5;
  const a = -Math.PI / 2 + side * (1.05 + wag * 0.5);
  const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
  const mx = x0 + side * len * 0.55, my = y0 + len * 0.05;
  // 根元が太く先が細い（毛の子は先がふさ）
  const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
  const tipW = w * lerp(0.15, 0.9, ph.fluff);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w, y0 + ny * w);
  ctx.quadraticCurveTo(mx + nx * w * 0.6, my + ny * w * 0.6, x1 + nx * tipW, y1 + ny * tipW);
  ctx.quadraticCurveTo(x1 + (x1 - mx) * 0.25, y1 + (y1 - my) * 0.25, x1 - nx * tipW, y1 - ny * tipW);
  ctx.quadraticCurveTo(mx - nx * w * 0.6, my - ny * w * 0.6, x0 - nx * w, y0 - ny * w);
  ctx.closePath(); ctx.fill();
  if (ph.fluff > 0.3) {
    ctx.fillStyle = base; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.ellipse(x1, y1, tipW * 1.2, tipW * 1.5, a + Math.PI / 2, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawEars(ctx, ph, sh, st, cx, cy, R, base, dark, lite) {
  const size = lerp(0.18, 0.62, ph.crest) * R;
  const perk = st.listen * 0.35 + st.earKick * 0.3;
  const ax = Math.sqrt(ph.aspect);
  for (const side of [-1, 1]) {
    const x = cx + side * ax * R * 0.5, y = cy - R / Math.sqrt(ph.aspect) * 0.78;
    const flop = (1 - perk) * lerp(0.55, 0.05, ph.spiky) * side;
    ctx.save(); ctx.translate(x, y); ctx.rotate(side * 0.35 + flop - side * perk * 0.3);
    const pointy = ph.spiky;
    ctx.beginPath();
    ctx.moveTo(-size * 0.42, size * 0.25);
    ctx.quadraticCurveTo(-size * lerp(0.55, 0.25, pointy), -size * 0.7, 0, -size * lerp(1.0, 1.25, pointy));
    ctx.quadraticCurveTo(size * lerp(0.55, 0.25, pointy), -size * 0.7, size * 0.42, size * 0.25);
    ctx.closePath();
    const g = ctx.createLinearGradient(-size * 0.5, -size, size * 0.5, size * 0.3);
    g.addColorStop(0, lite); g.addColorStop(0.6, base); g.addColorStop(1, dark);
    ctx.fillStyle = g; ctx.fill();
    // 耳の内側
    ctx.beginPath();
    ctx.moveTo(-size * 0.2, size * 0.1);
    ctx.quadraticCurveTo(-size * 0.15, -size * 0.5, 0, -size * lerp(0.7, 0.95, pointy));
    ctx.quadraticCurveTo(size * 0.15, -size * 0.5, size * 0.2, size * 0.1);
    ctx.closePath();
    ctx.fillStyle = `hsla(${(ph.hue + 340) % 360},45%,${Math.min(80, ph.lum * 100 + 12)}%,0.55)`; ctx.fill();
    ctx.restore();
  }
  // 抑揚の大きな声の子は、頭のかざり毛（3本）
  if (ph.crest > 0.62) {
    const n = 3, k = (ph.crest - 0.62) / 0.38;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.35 + Math.sin(st.t * 2 + i) * 0.05;
      const L = R * (0.35 + 0.25 * k) * (i === 1 ? 1.15 : 0.85);
      const x0 = cx, y0 = cy - R / Math.sqrt(ph.aspect) * 0.85;
      ctx.strokeStyle = dark; ctx.lineWidth = R * 0.035; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + Math.cos(a) * L * 0.6 + (i - 1) * R * 0.12, y0 + Math.sin(a) * L * 0.6, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L);
      ctx.stroke();
      ctx.fillStyle = lite; ctx.beginPath(); ctx.arc(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L, R * 0.045, 0, TAU); ctx.fill();
    }
  }
}

function drawFurEdge(ctx, ph, sh, st, pts, cx, cy, R, base, dark, lite) {
  // 毛のふさ: 根元が太く先が細い三角を、ふちに重ねる。光の向き（左上）で明るさを分ける
  const n = pts.length, cnt = Math.round(lerp(120, sh.fur.length, ph.fluff));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = pass; i < cnt; i += 2) {
      const f = sh.fur[i], u = f.a * n, i0 = Math.floor(u) % n, i1 = (i0 + 1) % n, fr = u - Math.floor(u);
      const px = lerp(pts[i0][0], pts[i1][0], fr), py = lerp(pts[i0][1], pts[i1][1], fr);
      const len = Math.hypot(px, py) || 1, nx = px / len, ny = py / len;
      const lit = -0.6 * nx - 0.8 * ny;
      const ruffle = st.pet * Math.sin(st.t * 26 + i) * 0.45;
      const ang = Math.atan2(ny, nx) + f.tw * 0.5 + 0.45 * Math.sign(nx) * (0.5 + ny * 0.5) + ruffle;
      const L = R * (0.035 + 0.1 * ph.fluff) * f.len * (pass ? 0.8 : 1);
      const bw = R * (0.03 + 0.02 * ph.fluff);
      const x = cx + px * R * 0.96, y = cy + py * R * 0.96;
      const tx = x + Math.cos(ang) * L, ty = y + Math.sin(ang) * L;
      const ox = -Math.sin(ang) * bw, oy = Math.cos(ang) * bw;
      ctx.fillStyle = pass === 0 ? dark : lit + f.sh * 0.6 - 0.3 > 0.3 ? lite : base;
      ctx.globalAlpha = pass === 0 ? 0.9 : 0.95;
      ctx.beginPath();
      ctx.moveTo(x - ox - Math.cos(ang) * L * 0.3, y - oy - Math.sin(ang) * L * 0.3);
      ctx.quadraticCurveTo(x - ox * 0.4 + Math.cos(ang) * L * 0.5, y - oy * 0.4 + Math.sin(ang) * L * 0.5, tx + Math.cos(ang + f.tw) * L * 0.15, ty + Math.sin(ang + f.tw) * L * 0.15);
      ctx.quadraticCurveTo(x + ox * 0.4 + Math.cos(ang) * L * 0.4, y + oy * 0.4 + Math.sin(ang) * L * 0.4, x + ox - Math.cos(ang) * L * 0.3, y + oy - Math.sin(ang) * L * 0.3);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawFace(ctx, ph, st, cx, cy, R, h, s, l) {
  const ax = Math.sqrt(ph.aspect);
  const eR = R * ph.eye * 0.55 * (1 + st.listen * 0.12);
  const ex = R * lerp(0.3, 0.4, ph.aspect - 0.86) * ax, ey = cy - R * 0.12;
  const gx = st.gaze.x * eR * 0.35, gy = st.gaze.y * eR * 0.3;
  const happy = st.pet > 0.3 || st.happy > 0.6;
  const blink = Math.max(st.blink > 0.5 ? 1 - (st.blink - 0.5) * 2 : st.blink * 2, 0);
  for (const side of [-1, 1]) {
    const x = cx + side * ex + gx, y = ey + gy;
    if (happy) { // にっこりの目（^ ^）
      ctx.strokeStyle = '#1a1220'; ctx.lineWidth = eR * 0.32; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y + eR * 0.25, eR * 0.7, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      continue;
    }
    const ry = eR * (1 - blink * 0.9);
    // 目のまわりのくぼみ
    ctx.fillStyle = hsl(toward(h, 250, 0.3), s, l * 0.6, 0.35);
    ctx.beginPath(); ctx.ellipse(x, y + eR * 0.08, eR * 1.18, ry * 1.18 + eR * 0.04, 0, 0, TAU); ctx.fill();
    // 黒いつぶらな目
    const g = ctx.createRadialGradient(x - eR * 0.3, y - ry * 0.3, eR * 0.1, x, y, eR);
    g.addColorStop(0, '#3a2c48'); g.addColorStop(1, '#0d0912');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, eR, ry, 0, 0, TAU); ctx.fill();
    if (ry > eR * 0.3) { // 照り（ランプの映りこみ。目の動きについていかない）
      ctx.fillStyle = 'rgba(255,246,225,0.95)';
      ctx.beginPath(); ctx.ellipse(x - eR * 0.32 - gx * 0.3, y - ry * 0.38, eR * 0.3, ry * 0.26, -0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,246,225,0.55)';
      ctx.beginPath(); ctx.arc(x + eR * 0.35, y + ry * 0.35, eR * 0.12, 0, TAU); ctx.fill();
    }
  }
  // ほお
  ctx.fillStyle = `hsla(350,70%,70%,${0.22 + st.happy * 0.2})`;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + side * ex * 1.25, ey + eR * 1.3, eR * 0.8, eR * 0.45, 0, 0, TAU); ctx.fill(); }
  // 口
  const my = ey + eR * 1.55, m = st.mouth;
  if (m > 0.05) {
    ctx.fillStyle = '#2a1222';
    ctx.beginPath(); ctx.ellipse(cx + gx * 0.5, my + R * 0.03 * m, R * (0.06 + 0.05 * m), R * (0.02 + 0.09 * m), 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(236,120,140,0.8)';
    ctx.beginPath(); ctx.ellipse(cx + gx * 0.5, my + R * 0.07 * m, R * 0.045 * m + R * 0.01, R * 0.03 * m, 0, 0, TAU); ctx.fill();
  } else {
    ctx.strokeStyle = '#2a1222'; ctx.lineWidth = R * 0.022; ctx.lineCap = 'round';
    const w = R * 0.07;
    ctx.beginPath();
    ctx.moveTo(cx - w + gx * 0.5, my); ctx.quadraticCurveTo(cx - w / 2 + gx * 0.5, my + w * 0.6, cx + gx * 0.5, my);
    ctx.quadraticCurveTo(cx + w / 2 + gx * 0.5, my + w * 0.6, cx + w + gx * 0.5, my);
    ctx.stroke();
  }
}
