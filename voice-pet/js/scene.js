// 背景（ランプの下の巣）・たまご・ちり（Canvas 2D）
const TAU = Math.PI * 2;
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

// 背景は大きさが変わったときだけ描いておく
export function paintBackdrop(w, h, dpr) {
  const c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
  const L = layout(w, h);
  // 壁: 藍の闇、ランプのまわりだけ暖かい
  let g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0d1022'); g.addColorStop(0.62, '#141631'); g.addColorStop(1, '#0a0b18');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  g = ctx.createRadialGradient(L.lx, L.ly, 0, L.lx, L.ly, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(255,196,120,0.30)'); g.addColorStop(0.35, 'rgba(220,140,90,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // 床（低い台の天板）: 光のたまり
  const fy = L.gy - L.u * 0.55;
  g = ctx.createLinearGradient(0, fy, 0, h);
  g.addColorStop(0, '#2a2030'); g.addColorStop(1, '#120e18');
  ctx.fillStyle = g; ctx.fillRect(0, fy, w, h - fy);
  ctx.save(); ctx.translate(L.gx, L.gy); ctx.scale(1, 0.24);
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, L.u * 4.2);
  g.addColorStop(0, 'rgba(255,205,140,0.42)'); g.addColorStop(0.45, 'rgba(230,150,100,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, L.u * 4.2, 0, TAU); ctx.fill(); ctx.restore();
  // 天板のふちの線と木目
  ctx.strokeStyle = 'rgba(255,210,160,0.12)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, fy + 0.5); ctx.lineTo(w, fy + 0.5); ctx.stroke();
  const R = rng(11);
  for (let i = 0; i < 26; i++) {
    const y = fy + 4 + Math.pow(R(), 1.6) * (h - fy);
    ctx.strokeStyle = `rgba(0,0,0,${0.08 + R() * 0.1})`; ctx.lineWidth = 0.5 + R();
    ctx.beginPath(); ctx.moveTo(-10, y); ctx.bezierCurveTo(w * 0.3, y + (R() - 0.5) * 6, w * 0.7, y + (R() - 0.5) * 6, w + 10, y + (R() - 0.5) * 4); ctx.stroke();
  }
  // 汚れ・すすけ（なめらかすぎないように）
  for (let i = 0; i < 160; i++) {
    const x = R() * w, y = R() * h, r = 4 + R() * 40;
    g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${0.03 + R() * 0.05})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 巣（うしろ半分）
  nest(ctx, L.gx, L.gy - L.u * 0.08, L.u * 2.05, L.u * 0.55, 'back');
  // 四すみを暗く
  g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.45, Math.max(w, h) * 0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,6,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  return c;
}

// わらの巣。前半分は生き物の足もとより手前に描く
export function nest(ctx, x, y, rx, ry, part) {
  const R = rng(part === 'back' ? 5 : 9);
  const n = part === 'back' ? 320 : 220;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    let a = part === 'back' ? Math.PI + R() * Math.PI : R() * Math.PI;
    const rr = 0.78 + R() * 0.32;
    const px = x + Math.cos(a) * rx * rr, py = y + Math.sin(a) * ry * rr - (part === 'back' ? R() * ry * 0.5 : R() * ry * 0.25);
    const len = rx * (0.12 + R() * 0.2), ang = a + Math.PI / 2 + (R() - 0.5) * 0.9;
    const lit = (Math.cos(a + 2.3) * 0.5 + 0.5) * 0.6 + R() * 0.4;
    const hue = 32 + R() * 16, li = 18 + lit * 42 * (part === 'back' ? 0.75 : 1);
    ctx.strokeStyle = `hsl(${hue},${40 + R() * 25}%,${li}%)`;
    ctx.lineWidth = rx * (0.008 + R() * 0.012);
    ctx.beginPath();
    ctx.moveTo(px - Math.cos(ang) * len / 2, py - Math.sin(ang) * len / 2 * 0.5);
    ctx.quadraticCurveTo(px + (R() - 0.5) * len * 0.3, py + (R() - 0.5) * len * 0.2, px + Math.cos(ang) * len / 2, py + Math.sin(ang) * len / 2 * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

// 画面の大きさから、地面の点・基準の大きさ（u）・ランプの位置
export function layout(w, h) {
  const wide = w > h * 1.15 && w >= 760;
  const playW = wide ? w - 300 : w;
  const u = Math.min(playW * (wide ? 0.13 : 0.17), h * 0.12, 120);
  return { gx: playW / 2, gy: wide ? h * 0.66 : h * 0.56, u, lx: playW * 0.3, ly: -h * 0.05, wide, playW };
}

// たまご。glow 0..1（声の大きさ）、crack 0..1（割れ）
export function egg(ctx, x, y, u, t, glow, wob, crack, top) {
  const rx = u * 0.62, ry = u * 0.82;
  ctx.save();
  // 影
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.22);
  let g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.3);
  g.addColorStop(0, 'rgba(8,6,14,0.6)'); g.addColorStop(1, 'rgba(8,6,14,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx * 1.3, 0, TAU); ctx.fill(); ctx.restore();
  ctx.translate(x, y); ctx.rotate(wob);
  // 声に合わせて内側から光る
  if (glow > 0.01) {
    g = ctx.createRadialGradient(0, -ry, 0, 0, -ry, ry * 2.2);
    g.addColorStop(0, `rgba(255,214,150,${0.45 * glow})`); g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -ry, ry * 2.2, 0, TAU); ctx.fill();
  }
  const shape = () => {
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = i / 64 * TAU, s = Math.sin(a), c = Math.cos(a);
      const r = s < 0 ? 1 - 0.12 * -s : 1; // 上が細い
      const px = c * rx * r, py = -ry + s * ry;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
  shape();
  g = ctx.createRadialGradient(-rx * 0.35, -ry * 1.45, rx * 0.1, 0, -ry * 0.8, ry * 1.3);
  g.addColorStop(0, `rgb(${246},${236 + glow * 10},${214})`); g.addColorStop(0.55, '#cdb79a'); g.addColorStop(1, '#5e4a46');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); shape(); ctx.clip();
  // そばかす
  const R = rng(21);
  for (let i = 0; i < 40; i++) {
    const a = R() * TAU, r = Math.sqrt(R());
    ctx.fillStyle = `rgba(92,64,52,${0.15 + R() * 0.25})`;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r * rx, -ry + Math.sin(a) * r * ry, u * (0.012 + R() * 0.03), 0, TAU); ctx.fill();
  }
  // 中の光がすける
  if (glow > 0.01) {
    g = ctx.createRadialGradient(0, -ry * 0.9, 0, 0, -ry * 0.9, ry);
    g.addColorStop(0, `rgba(255,190,110,${0.5 * glow})`); g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g; ctx.fillRect(-rx, -ry * 2, rx * 2, ry * 2);
  }
  ctx.restore();
  // ひび
  if (crack > 0) {
    ctx.strokeStyle = 'rgba(40,24,20,0.9)'; ctx.lineWidth = u * 0.025; ctx.lineJoin = 'round';
    const Rc = rng(4), n = 9, yc = -ry * 1.05;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const fx = -rx + (2 * rx) * i / n, fy = yc + (i % 2 ? -1 : 1) * ry * 0.12 + (Rc() - 0.5) * ry * 0.06;
      if (i / n > crack) break;
      i ? ctx.lineTo(fx, fy) : ctx.moveTo(fx, fy);
    }
    ctx.stroke();
    if (crack > 0.6) {
      ctx.strokeStyle = `rgba(255,220,160,${(crack - 0.6) * 2})`; ctx.lineWidth = u * 0.012; ctx.stroke();
    }
  }
  ctx.restore();
}

// ランプの光の中をただようちり
export function makeMotes(n) {
  const R = rng(77), a = [];
  for (let i = 0; i < n; i++) a.push({ x: R(), y: R(), z: 0.3 + R() * 0.7, p: R() * TAU });
  return a;
}
export function drawMotes(ctx, motes, w, h, t, L) {
  for (const m of motes) {
    const x = ((m.x + t * 0.004 * m.z + Math.sin(t * 0.3 + m.p) * 0.01) % 1) * L.playW;
    const y = ((m.y - t * 0.006 * m.z) % 1 + 1) % 1 * h * 0.8;
    const d = Math.hypot(x - L.lx, y - L.ly - h * 0.2) / h;
    const a = Math.max(0, 0.55 - d) * m.z * (0.6 + 0.4 * Math.sin(t * 1.3 + m.p));
    if (a < 0.02) continue;
    ctx.fillStyle = `rgba(255,220,170,${a})`;
    ctx.beginPath(); ctx.arc(x, y, 0.6 + m.z * 1.2, 0, TAU); ctx.fill();
  }
}
