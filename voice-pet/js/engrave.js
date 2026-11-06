// B3 銅版画の調子で、本物の体のつくりに近い形（正面向き）。手元だけの見くらべ
// 体の型: R1 ハネジネズミ型（すわる小さな獣）／R2 シカ型／R3 カエル型／R4 ツル型
// 形と遺伝子: 声の筒が長い → 顔と首が長く体が大きい（シカはのど仏が下がる＝アカシカ。ツルは首＝気管が長い）
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const cl = v => Math.max(0, Math.min(1, v));
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
let INK = '#36210f', PAPER = '#ece3cf';
// 画材: engrave 銅版画 ／ pencil 鉛筆 ／ brush 筆と墨 ／ stone 石の浮き彫り
let STYLE = 'engrave', HA = 1, FILL = '#ece3cf', SHADE_RGB = '52,52,60';
let TH = 30, TS = 0.5, TL = 0.6; // 色鉛筆の色（遺伝子の色あい・明るさ）
function hslRgb(h, s2, l) { const k = n => (n + h / 30) % 12, a = s2 * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return [f(0), f(8), f(4)].map(v => Math.round(v * 255)); }
export function setTint(h, s2, l) { TH = h; TS = s2; TL = l; if (STYLE === 'cpencil') setStyle('cpencil'); }
export function setStyle(v) {
  STYLE = v;
  if (v === 'cpencil') { // 色鉛筆: 輪郭はその色の濃い色、陰の線もその色、塗りはごく淡い色
    const [r, g, b] = hslRgb(TH, Math.min(0.7, TS * 0.9), Math.max(0.22, TL * 0.42)), [r2, g2, b2] = hslRgb(TH, TS * 0.55, 0.5 + TL * 0.2), [r3, g3, b3] = hslRgb(TH, TS * 0.45, 0.86 + TL * 0.08);
    INK = `rgb(${r},${g},${b})`; PAPER = '#f3f1eb'; FILL = `rgb(${r3},${g3},${b3})`; HA = 0.7; SHADE_RGB = `${r2},${g2},${b2}`; return;
  }
  SHADE_RGB = '52,52,60';
  INK = { engrave: '#36210f', pencil: '#34343c', brush: '#1b1816', stone: '#2e2a25', mural: '#5b2416' }[v];
  PAPER = { engrave: '#ece3cf', pencil: '#f3f1eb', brush: '#eee8da', stone: '#aba497', mural: '#e2d0ad' }[v];
  FILL = v === 'mural' ? '#cf9a5c' : PAPER;
  HA = { engrave: 1, pencil: 0.55, brush: 1, stone: 0.3, mural: 0.22 }[v];
}
const EYE = { cpencil: ['#5a4636', '#1d140e'], mural: ['#4a2014', '#1e0c06'], engrave: ['#5a3a22', '#1c1008'], pencil: ['#5c5c64', '#17171b'], brush: ['#3a3633', '#0b0a09'], stone: ['#3e382f', '#15120f'] };
const LX = -0.6, LY = -0.8; // 光は左上

// ---- 紙と版 ----
export function plate(ctx, w, h, seed = 12) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, h);
  const R = rng(seed);
  if (STYLE === 'pencil' || STYLE === 'cpencil') { // 画用紙: 紙の目と、うすいすれ
    for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(80,80,90,${R() * 0.05})`; ctx.fillRect(R() * w, R() * h, 1, 1); }
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,60,70,0.12)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    return;
  }
  if (STYLE === 'brush') { // 和紙: 繊維・にじんだ汚れ・朱の印
    for (let i = 0; i < 120; i++) { ctx.strokeStyle = `rgba(255,255,250,${0.2 + R() * 0.3})`; ctx.lineWidth = 0.4 + R() * 0.6; ctx.beginPath(); const x = R() * w, y = R() * h, a = R() * TAU, L = 8 + R() * 30; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + 4, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke(); }
    for (let i = 0; i < 25; i++) { const x = R() * w, y = R() * h, r = 15 + R() * 50, g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(120,100,70,${0.02 + R() * 0.03})`); g.addColorStop(1, 'rgba(120,100,70,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
    ctx.fillStyle = 'rgba(178,48,38,0.85)'; ctx.fillRect(w - 44, h - 46, 14, 14);
    ctx.strokeStyle = 'rgba(238,232,218,0.9)'; ctx.lineWidth = 1; ctx.strokeRect(w - 42, h - 44, 10, 10); ctx.beginPath(); ctx.moveTo(w - 37, h - 44); ctx.lineTo(w - 37, h - 34); ctx.stroke();
    return;
  }
  if (STYLE === 'mural') { // しっくいの壁: ひび・はがれ・すす
    for (let i = 0; i < 60; i++) { const x = R() * w, y = R() * h, r = 10 + R() * 50, g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(150,110,70,${0.04 + R() * 0.06})`); g.addColorStop(1, 'rgba(150,110,70,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 2500; i++) { ctx.fillStyle = `rgba(110,80,50,${R() * 0.08})`; ctx.fillRect(R() * w, R() * h, 1, 1); }
    ctx.strokeStyle = 'rgba(90,60,40,0.3)'; ctx.lineWidth = 0.6; for (let k = 0; k < 4; k++) { let x = R() * w, y = R() * h; ctx.beginPath(); ctx.moveTo(x, y); for (let i = 0; i < 7; i++) { x += (R() - 0.5) * 34; y += (R() - 0.3) * 18; ctx.lineTo(x, y); } ctx.stroke(); }
    // 帯のふちどり（赤い土）
    ctx.fillStyle = 'rgba(140,52,32,0.75)'; ctx.fillRect(0, 10, w, 4); ctx.fillRect(0, h - 14, w, 4);
    return;
  }
  if (STYLE === 'stone') { // 石の板: まだら・ひび・彫った額
    let g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#b4ada0'); g.addColorStop(1, '#948d81'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * h, r = 6 + R() * 40; g = ctx.createRadialGradient(x, y, 0, x, y, r); const d = R() < 0.5; g.addColorStop(0, d ? `rgba(60,55,45,${0.05 + R() * 0.07})` : `rgba(240,235,225,${0.05 + R() * 0.07})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 3000; i++) { ctx.fillStyle = R() < 0.5 ? `rgba(40,35,30,${R() * 0.18})` : `rgba(250,245,235,${R() * 0.15})`; ctx.fillRect(R() * w, R() * h, 1, 1); }
    ctx.strokeStyle = 'rgba(40,35,30,0.35)'; ctx.lineWidth = 0.7; for (let k = 0; k < 2; k++) { let x = R() * w, y = R() * h; ctx.beginPath(); ctx.moveTo(x, y); for (let i = 0; i < 8; i++) { x += (R() - 0.5) * 30; y += R() * 14; ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(40,35,30,0.45)'; ctx.strokeRect(19, 17, w - 36, h - 32); ctx.strokeStyle = 'rgba(250,245,235,0.45)'; ctx.strokeRect(17, 15, w - 36, h - 32);
    return;
  }
  for (let i = 0; i < 50; i++) { const x = R() * w, y = R() * h, r = 10 + R() * 60, g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(140,100,50,${0.02 + R() * 0.04})`); g.addColorStop(1, 'rgba(140,100,50,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 1400; i++) { ctx.fillStyle = `rgba(90,60,30,${R() * 0.06})`; ctx.fillRect(R() * w, R() * h, 1, 1); }
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(90,60,20,0.22)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(90,70,50,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(18, 16, w - 36, h - 32);
  ctx.strokeStyle = 'rgba(255,250,240,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(20, 18, w - 40, h - 36);
}

export function finish(ctx, w, h, seed = 3) {
  const R = rng(seed);
  if (STYLE === 'pencil' || STYLE === 'cpencil') { for (let i = 0; i < 5000; i++) { ctx.fillStyle = `rgba(243,241,235,${0.12 + R() * 0.22})`; ctx.fillRect(R() * w, R() * h, 1, 1); } }
  if (STYLE === 'mural') {
    for (let i = 0; i < 26; i++) { const x = R() * w, y = R() * h, r = 1.5 + R() * 6; ctx.fillStyle = `rgba(226,208,173,${0.55 + R() * 0.4})`; ctx.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, rr = r * (0.6 + R() * 0.6); k ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + rr, y); } ctx.fill(); }
    for (let i = 0; i < 5000; i++) { ctx.fillStyle = `rgba(226,208,173,${R() * 0.28})`; ctx.fillRect(R() * w, R() * h, 1, 1); }
  }
  if (STYLE === 'stone') { for (let i = 0; i < 4000; i++) { ctx.fillStyle = R() < 0.5 ? `rgba(40,35,30,${R() * 0.15})` : `rgba(250,245,235,${R() * 0.12})`; ctx.fillRect(R() * w, R() * h, 1, 1); } }
}

// ---- 描く道具（紙で塗って下を隠し、立体にそう斜線、インクの輪郭）----
function D(ctx, seed) {
  const R = rng(seed);
  const ellPath = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, TAU); return p; };
  const segPath = (x0, y0, x1, y1, r0, r1) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx), d = Math.asin(cl((r0 - r1) / L) * 0.999);
    const p = new Path2D();
    p.arc(x1, y1, r1, a - Math.PI / 2 + d, a + Math.PI / 2 - d);
    p.arc(x0, y0, r0, a + Math.PI / 2 - d, a + 3 * Math.PI / 2 + d);
    p.closePath(); return p;
  };
  // 立体の陰: 楕円の中を、横の等高線（下へふくらむ弧）と、暗い所だけ縦の線で
  function softEll(path, x, y, rx, ry, rot, tone) {
    if (SOFT === 'line') return;
    ctx.save(); ctx.clip(path); ctx.translate(x, y); ctx.rotate(rot);
    if (SOFT === 'wash') {
      const g = ctx.createRadialGradient(-rx * 0.35, -ry * 0.4, Math.min(rx, ry) * 0.2, 0, 0, Math.max(rx, ry) * 1.15);
      g.addColorStop(0, 'rgba(54,33,15,0)'); g.addColorStop(0.55, 'rgba(54,33,15,0)'); g.addColorStop(1, `rgba(54,33,15,${cl(0.22 + tone * 0.5)})`);
      ctx.fillStyle = g; ctx.fillRect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * 2.4);
    } else { // curve: 右下のふちにそって、内側へ短い弧を数本
      ctx.strokeStyle = INK; ctx.lineCap = 'round';
      const n = Math.max(1, Math.round((2 + tone * 4) * Math.min(1, (rx + ry) / 30)));
      for (let k = 1; k <= n; k++) {
        const f = 1 - k * 0.11; ctx.globalAlpha = 0.55 - k * 0.08; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.ellipse(0, 0, rx * f, ry * f, 0, -0.15 + k * 0.12, Math.PI * 0.62 - k * 0.1); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function softSeg(path, x0, y0, x1, y1, r0, r1, tone) {
    if (SOFT === 'line') return;
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const side = nx * LX + ny * LY > 0 ? -1 : 1; // 光と反対の側
    ctx.save(); ctx.clip(path);
    if (SOFT === 'wash') {
      const r = Math.max(r0, r1), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const g = ctx.createLinearGradient(mx - nx * side * r, my - ny * side * r, mx + nx * side * r, my + ny * side * r);
      g.addColorStop(0, 'rgba(54,33,15,0)'); g.addColorStop(0.55, 'rgba(54,33,15,0)'); g.addColorStop(1, `rgba(54,33,15,${cl(0.24 + tone * 0.5)})`);
      ctx.fillStyle = g; ctx.fill(path);
    } else {
      ctx.strokeStyle = INK; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
      const o0 = r0 * 0.55 * side, o1 = r1 * 0.55 * side;
      ctx.beginPath(); ctx.moveTo(x0 + nx * o0 + dx * 0.1, y0 + ny * o0 + dy * 0.1); ctx.lineTo(x1 + nx * o1 - dx * 0.1, y1 + ny * o1 - dy * 0.1); ctx.stroke();
    }
    ctx.restore();
  }
  function shadeGrad(path, x, y, rx, ry, rot, tone, col, a, blur) {
    ctx.save(); ctx.clip(path); ctx.translate(x, y); ctx.rotate(rot);
    if (blur) ctx.filter = `blur(${blur}px)`;
    const g = ctx.createRadialGradient(-rx * 0.35, -ry * 0.45, Math.min(rx, ry) * 0.15, 0, 0, Math.max(rx, ry) * 1.1);
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${cl(a + tone * 0.5)})`);
    ctx.fillStyle = g; ctx.fillRect(-rx * 1.3, -ry * 1.3, rx * 2.6, ry * 2.6);
    ctx.restore();
  }
  function hatchEll(path, x, y, rx, ry, rot, tone, dense = 1) {
    if (SOFT) return softEll(path, x, y, rx, ry, rot, tone);
    if (STYLE === 'brush') return shadeGrad(path, x, y, rx, ry, rot, tone, '27,24,22', 0.34, 1.6);
    if (STYLE === 'pencil' || STYLE === 'cpencil') shadeGrad(path, x, y, rx, ry, rot, tone, SHADE_RGB, STYLE === 'cpencil' ? 0.28 : 0.16, 0);
    if (STYLE === 'mural') shadeGrad(path, x, y, rx, ry, rot, tone, '120,46,24', 0.32, 0.8);
    if (STYLE === 'stone') { shadeGrad(path, x, y, rx, ry, rot, tone, '30,26,22', 0.3, 0); ctx.save(); ctx.clip(path); const g = ctx.createRadialGradient(x - rx * 0.45, y - ry * 0.5, 0, x - rx * 0.45, y - ry * 0.5, Math.max(rx, ry)); g.addColorStop(0, 'rgba(250,246,238,0.35)'); g.addColorStop(1, 'rgba(250,246,238,0)'); ctx.fillStyle = g; ctx.fill(path); ctx.restore(); }
    ctx.save(); ctx.clip(path); ctx.translate(x, y); ctx.rotate(rot);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.55;
    const step = Math.max(1.5, 2.6 / dense);
    for (let v = -ry; v <= ry; v += step) {
      const w = rx * Math.sqrt(Math.max(0, 1 - (v / ry) ** 2));
      for (let u = -w; u < w; u += 2.2) {
        const nu = u / rx, nv = v / ry, nz = Math.sqrt(Math.max(0, 1 - nu * nu - nv * nv));
        const lit = -(nu * LX + nv * LY) * 0.75 + nz * 0.35; // 1=明るい
        const sh = cl(0.5 - lit + tone);
        if (sh < 0.16) continue;
        const bulge = ry * 0.12 * (1 - nu * nu);
        ctx.globalAlpha = Math.min(0.9, sh * 1.1) * HA;
        ctx.beginPath(); ctx.moveTo(u, v + bulge); ctx.lineTo(u + 2.2, v + ry * 0.12 * (1 - ((u + 2.2) / rx) ** 2)); ctx.stroke();
        if (sh > 0.68) { ctx.beginPath(); ctx.moveTo(u + 1, v - step * 0.4); ctx.lineTo(u + 1 + nu * 0.4, v + step * 0.6); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
  function hatchSeg(path, x0, y0, x1, y1, r0, r1, tone) {
    if (SOFT) return softSeg(path, x0, y0, x1, y1, r0, r1, tone);
    if (STYLE === 'brush') { const sv = SOFT; SOFT = 'wash'; ctx.save(); ctx.filter = 'blur(1px)'; softSeg(path, x0, y0, x1, y1, r0, r1, tone + 0.15); ctx.restore(); SOFT = sv; return; }
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, tx = dx / L, ty = dy / L, nx = -ty, ny = tx;
    ctx.save(); ctx.clip(path); ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
    for (let s = -r0; s <= L + r1; s += 2) {
      const t = cl(s / L), r = lerp(r0, r1, t), cx = x0 + tx * s, cy = y0 + ty * s;
      for (let k = -1; k < 1; k += 0.16) {
        const lit = -((nx * k) * LX + (ny * k) * LY) * 0.8 + Math.sqrt(Math.max(0, 1 - k * k)) * 0.3;
        const sh = cl(0.48 - lit + tone);
        if (sh < 0.18) continue;
        ctx.globalAlpha = Math.min(0.9, sh) * HA;
        const b = r * 0.15 * (1 - k * k);
        ctx.beginPath(); ctx.moveTo(cx + nx * r * k + tx * b, cy + ny * r * k + ty * b); ctx.lineTo(cx + nx * r * (k + 0.16) + tx * b, cy + ny * r * (k + 0.16) + ty * b); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function line(path, w = 1) {
    ctx.save(); ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (SOFT) { ctx.lineWidth = 1.5 * w; ctx.stroke(path); ctx.restore(); return; }
    if (STYLE === 'pencil' || STYLE === 'cpencil') { // 少しずつずれた線を重ねる
      const r3 = rng(Math.round(w * 977) + 5);
      for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate((r3() - 0.5) * 1.1, (r3() - 0.5) * 1.1); ctx.globalAlpha = 0.42; ctx.lineWidth = 0.75 * w; ctx.stroke(path); ctx.restore(); }
      ctx.restore(); return;
    }
    if (STYLE === 'brush') { // 筆: 陰の側（右下）が太く、光の側は細い
      ctx.save(); ctx.translate(0.9, 1.1); ctx.globalAlpha = 0.9; ctx.lineWidth = 2.4 * w; ctx.stroke(path); ctx.restore();
      ctx.globalAlpha = 0.95; ctx.lineWidth = 1.1 * w; ctx.stroke(path); ctx.restore(); return;
    }
    if (STYLE === 'mural') { // 太くむらのある土の線
      const r3 = rng(Math.round(w * 311) + 9);
      ctx.globalAlpha = 0.85; ctx.lineWidth = 1.9 * w; ctx.stroke(path);
      ctx.save(); ctx.translate((r3() - 0.5) * 1.4, (r3() - 0.5) * 1.4); ctx.globalAlpha = 0.35; ctx.lineWidth = 1.2 * w; ctx.stroke(path); ctx.restore();
      ctx.restore(); return;
    }
    if (STYLE === 'stone') { // 彫り: 右下に溝の影、左上に光
      ctx.save(); ctx.translate(0.9, 1.1); ctx.strokeStyle = 'rgba(25,22,18,0.6)'; ctx.lineWidth = 2 * w; ctx.stroke(path); ctx.restore();
      ctx.save(); ctx.translate(-0.8, -0.9); ctx.strokeStyle = 'rgba(252,248,240,0.55)'; ctx.lineWidth = 1.2 * w; ctx.stroke(path); ctx.restore();
      ctx.globalAlpha = 0.35; ctx.lineWidth = 0.6 * w; ctx.stroke(path); ctx.restore(); return;
    }
    ctx.lineWidth = 0.9 * w; ctx.stroke(path);
    if (FACE >= 3) { ctx.restore(); return; }
    ctx.translate(0.5, 0.7); ctx.globalAlpha = 0.45; ctx.lineWidth = 0.8 * w; ctx.stroke(path); ctx.restore();
  }
  function fur(x, y, rx, ry, rot, amount, len = 1) { // ふちの毛（下へ流れる短い線）
    if (amount < 0.1) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = INK; ctx.lineWidth = 0.55; ctx.globalAlpha = 0.8;
    const n = Math.round(lerp(14, 70, amount) * (rx + ry) / 50);
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, px = Math.cos(a) * rx, py = Math.sin(a) * ry, L = (2 + 5 * amount) * len * (0.6 + R() * 0.7);
      const na = Math.atan2(py / ry, px / rx) + 0.5 * Math.sign(px) * (py > -ry * 0.3 ? 1 : 0.3);
      ctx.beginPath(); ctx.moveTo(px * 0.96, py * 0.96); ctx.lineTo(px + Math.cos(na) * L, py + Math.sin(na) * L); ctx.stroke();
    }
    ctx.restore();
  }
  function stipple(path, x, y, rx, ry, amount, seed) { // もよう: 点描の斑
    if (amount < 0.08) return;
    const r2 = rng(seed);
    if (SOFT) {
      ctx.save(); ctx.clip(path); ctx.fillStyle = 'rgba(54,33,15,0.16)';
      for (let s = 0; s < Math.round(amount * 9); s++) { ctx.beginPath(); ctx.ellipse(x + (r2() - 0.5) * rx * 1.5, y + (r2() - 0.5) * ry * 1.5, 2.5 + r2() * 4, 2 + r2() * 3, r2() * 3, 0, TAU); ctx.fill(); }
      ctx.restore(); return;
    }
    ctx.save(); ctx.clip(path); ctx.fillStyle = INK;
    const nSp = Math.round(amount * 10);
    for (let s = 0; s < nSp; s++) {
      const sx = x + (r2() - 0.5) * rx * 1.6, sy = y + (r2() - 0.5) * ry * 1.6, sr = 2 + r2() * 5;
      for (let i = 0; i < sr * 6; i++) { const a = r2() * TAU, d = Math.sqrt(r2()) * sr; ctx.globalAlpha = 0.6; ctx.fillRect(sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.8, 0.9, 0.9); }
    }
    ctx.restore();
  }
  function furry(p, x, y, rx, ry, rot, tone, amount, seed) {
    const r2 = rng(seed), k = FUR * (0.55 + amount * 0.45);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    // 中: 毛の流れ（中心から外へ、少し下向き）。陰の側ほど濃く
    ctx.save(); ctx.clip(new Path2D(`M${-rx * 2} ${-ry * 2}h${rx * 4}v${ry * 4}h${-rx * 4}z`)); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.clip();
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    const nIn = Math.round(rx * ry * 0.16 * (0.4 + k));
    for (let i = 0; i < nIn; i++) {
      const a = r2() * TAU, d = Math.sqrt(r2()), px = Math.cos(a) * rx * d, py = Math.sin(a) * ry * d;
      const nu = px / rx, nv = py / ry, lit = -(nu * LX + nv * LY) * 0.75 + Math.sqrt(Math.max(0, 1 - nu * nu - nv * nv)) * 0.35;
      const sh = cl(0.45 - lit + tone);
      if (sh < 0.08 && r2() > 0.25) continue;
      const da = Math.atan2(py + ry * 0.6, px) * 0.6 + Math.PI / 2 * 0.4, L = (2.2 + r2() * 3) * (0.7 + k);
      ctx.globalAlpha = (0.25 + sh * 0.65) * (STYLE === 'engrave' ? 1 : STYLE === 'brush' ? 0.45 : 0.6); ctx.lineWidth = STYLE === 'brush' ? 0.8 : 0.5;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + Math.cos(da) * L * 0.5 + 0.6, py + Math.sin(da) * L * 0.5, px + Math.cos(da) * L, py + Math.sin(da) * L); ctx.stroke();
    }
    ctx.restore();
    // ふち: 丸いふくらみ（雲のふち）を並べ、外向きの弧だけインクで。その上に細くまがった毛すじ
    const sc = Math.min(1.4, (rx + ry) / 28), bump = (1.3 + k * 2.2) * sc;
    const per = Math.PI * (rx + ry), n = Math.round(per / (bump * 1.35));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i + r2() * 0.4) / n * TAU, c = Math.cos(a), s2 = Math.sin(a);
      const nx = c / rx, ny = s2 / ry, nl = Math.hypot(nx, ny);
      const br = bump * (0.75 + r2() * 0.5) * (s2 > 0.3 ? 1.15 : 1);
      pts.push({ x: c * rx, y: s2 * ry, ux: nx / nl, uy: ny / nl, r: br });
    }
    ctx.fillStyle = FILL;
    for (const q of pts) { ctx.beginPath(); ctx.arc(q.x + q.ux * q.r * 0.25, q.y + q.uy * q.r * 0.25, q.r, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    for (const q of pts) {
      const ang = Math.atan2(q.uy, q.ux), lit = -(q.ux * LX + q.uy * LY);
      ctx.globalAlpha = (lit > 0.3 ? 0.5 : 0.8) * (STYLE === 'pencil' || STYLE === 'cpencil' ? 0.7 : 1); ctx.lineWidth = (lit > 0.3 ? 0.55 : 0.75) * (STYLE === 'brush' ? 1.6 : 1);
      ctx.beginPath(); ctx.arc(q.x + q.ux * q.r * 0.25, q.y + q.uy * q.r * 0.25, q.r, ang - 1.1, ang + 1.1); ctx.stroke();
      if (STYLE === 'stone') { ctx.save(); ctx.strokeStyle = 'rgba(252,248,240,0.45)'; ctx.globalAlpha = 1; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(q.x + q.ux * q.r * 0.25 - 0.6, q.y + q.uy * q.r * 0.25 - 0.7, q.r, ang - 1.1, ang + 1.1); ctx.stroke(); ctx.restore(); }
    }
    const nw = Math.round(n * (0.3 + k * 0.5));
    for (let i = 0; i < nw; i++) {
      const q = pts[Math.floor(r2() * pts.length)], side = r2() < 0.5 ? -1 : 1;
      const L = q.r * (1.6 + r2() * 1.4), bx = q.x - q.ux * q.r * 0.6, by = q.y - q.uy * q.r * 0.6;
      const tx = q.x + q.ux * q.r * 0.9 + q.uy * side * L * 0.5, ty = q.y + q.uy * q.r * 0.9 - q.ux * side * L * 0.5 + L * 0.25;
      ctx.globalAlpha = 0.55; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(q.x + q.ux * q.r * 0.8, q.y + q.uy * q.r * 0.8, tx, ty); ctx.stroke();
    }
    ctx.restore();
  }
  // 部品をまとめて描く
  const ell = (x, y, rx, ry, rot = 0, o0 = {}) => {
    const o = { ...o0, tone: (o0.tone || 0) + COAT };
    const p = ellPath(x, y, rx, ry, rot);
    ctx.fillStyle = FILL; ctx.fill(p);
    if (FUR > 0 && o.fur !== undefined) {
      const tone = (o.far ? 0.25 : 0) + (o.tone || 0) - FUR * 0.1;
      if (FUR < 0.99) { ctx.save(); ctx.globalAlpha = 1 - FUR * 0.75; hatchEll(p, x, y, rx, ry, rot, tone, o.dense || 1); ctx.restore(); }
      if (o.spots) stipple(p, x, y, rx, ry, o.spots, o.seed || 1);
      furry(p, x, y, rx, ry, rot, tone, o.fur, (o.seed || 1) + Math.round(x * 7 + y * 3));
      return p;
    }
    hatchEll(p, x, y, rx, ry, rot, (o.far ? 0.25 : 0) + (o.tone || 0), o.dense || 1);
    if (o.spots) stipple(p, x, y, rx, ry, o.spots, o.seed || 1);
    line(p, o.w || 1);
    if (o.fur) fur(x, y, rx, ry, rot, o.fur, o.furLen);
    return p;
  };
  const seg = (x0, y0, x1, y1, r0, r1, o0 = {}) => {
    const o = { ...o0, tone: (o0.tone || 0) + COAT };
    const p = segPath(x0, y0, x1, y1, r0, r1);
    ctx.fillStyle = FILL; ctx.fill(p);
    hatchSeg(p, x0, y0, x1, y1, r0, r1, (o.far ? 0.25 : 0) + (o.tone || 0));
    line(p, o.w || 0.9);
    return p;
  };
  const eye = (x, y, r, blink, look = [0, 0]) => {
    if (FACE >= 1) { // 白目を見せない黒い目（動物の目）。上まぶたの線と、照りを1つ
      ctx.save();
      if (FACE >= 3) y += r * 0.15;
      if (blink) { ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - r * 1.05, y); ctx.quadraticCurveTo(x, y + r * 0.45, x + r * 1.05, y); ctx.stroke(); ctx.restore(); return; }
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.05);
      g.addColorStop(0, EYE[STYLE][0]); g.addColorStop(1, EYE[STYLE][1]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r * 1.02, r * 0.9, 0, 0, TAU); ctx.fill();
      if (STYLE === 'stone') { ctx.strokeStyle = 'rgba(252,248,240,0.5)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(x + 0.5, y + 0.6, r * 1.05, r * 0.95, 0, -0.2, Math.PI * 0.8); ctx.stroke(); }
      ctx.fillStyle = 'rgba(245,236,214,0.95)'; ctx.beginPath(); ctx.ellipse(x - r * 0.34, y - r * 0.32, r * 0.24, r * 0.2, -0.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.ellipse(x, y - r * 0.05, r * 1.25, r * 1.1, 0, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
      ctx.restore(); return;
    }
    ctx.save();
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.ellipse(x, y, r * 1.25, r * 1.05, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke();
    if (blink) { ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - r * 1.2, y); ctx.quadraticCurveTo(x, y + r * 0.5, x + r * 1.2, y); ctx.stroke(); ctx.restore(); return; }
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + look[0] * r * 0.25, y + look[1] * r * 0.2, r * 0.92, 0, TAU); ctx.fill();
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.28, 0, TAU); ctx.fill();
    ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(x, y + r * 0.1, r * 1.45, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); // まぶたのしわ
    ctx.restore();
  };
  const strokes = (fn) => { ctx.save(); ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 0.7; ctx.beginPath(); fn(ctx); ctx.stroke(); ctx.restore(); };
  return { ell, seg, eye, strokes, ctx, R };
}

// しぐさ（10秒で一周）: 息 → 耳ぴくっ → 首をかしげる → においをかぐ → 鳴く → 体をゆらす
export function gesture(st, ph, t) {
  const T = 10, u = ((t % T) + T) % T;
  const ease = (a, b) => { const x = cl((u - a) / (b - a)); return x * x * (3 - 2 * x); };
  const bump = (a, b) => ease(a, a + 0.4) * (1 - ease(b - 0.4, b));
  st.earKick = Math.max(0, 1 - Math.abs(u - 2.3) * 5) + Math.max(0, 1 - Math.abs(u - 2.75) * 5);
  st.tilt = 0.3 * bump(3, 5.2) * (ph.seed % 2 ? 1 : -1);
  st.listen = bump(3, 5.2);
  st.sniff = bump(5.3, 6.6) * Math.sin(u * 24);
  const c = cl((u - 6.9) / 0.9);
  st.mouth = u > 6.9 && u < 7.8 ? Math.max(0, Math.sin(c * Math.PI * (1 + Math.round(ph.legs * 2)))) * 0.9 : 0;
  st.chin = bump(6.6, 8.1);
  st.sway = Math.sin(u * 2.4) * bump(8.2, 10);
  st.breath = Math.sin(t * TAU * 0.3);
  st.blinkNow = (u > 1.3 && u < 1.42) || (u > 9.1 && u < 9.22);
}

// 頭のまとまりを、首のつけ根を中心に回す
let ph0seed = 0;
function headGroup(ctx, px, py, st, fn) {
  ctx.save(); ctx.translate(px, py); ctx.rotate((st.tilt || 0) + (FACE >= 3 ? 0.07 * (ph0seed % 2 ? 1 : -1) : 0)); ctx.translate(-px, -py - (st.chin || 0) * 2); fn(); ctx.restore();
}

// 幼さ J（0=おとな 1=ふ化したて）。ベビースキーマ（Lorenz 1943）: 頭が大きい・目が大きく顔の下寄り・額が広い・鼻先が短い・体が丸い・手足が短く太い
let J = 0, SOFT = false, FACE = 0, FUR = 0, COAT = 0; // FUR: ふさふさ 0..1（ふちを毛の房で、中を毛の流れの線で） // FACE: 0=いまの顔 1=白目なしの黒い目 2=＋顔を明るく・ひげ控えめ 3=＋目を少し下に・輪郭を1本に・少しかしげる
export function setJuv(j) { J = j; }
export function setSoft(v) { SOFT = v; }
export function setFace(v) { FACE = v; }
export function setFur(v) { FUR = v; }
export function setCoat(v) { COAT = v; } // -0.2（淡い）〜 +0.25（濃い）
const HT = () => FACE >= 2 ? -0.32 : 0; // 顔の陰を軽く
// 目は写実の度合いとそろえる（写実の線で目だけ大きくすると不気味＝Seyama & Nagayama 2007）
const eyeK = b => SOFT ? lerp(1, b, J) : 1;
const jx = (adult, baby) => lerp(adult, baby, J);

// ---- R1 ハネジネズミ型（後ろ足ですわる小さな獣。前足は胸の前）----
export const R1 = {
  name: 'R1 すわる小獣（ハネジネズミ型）',
  draw(ctx, ph, st, gx, gy, info) {
    ph0seed = ph.seed;
    const S = lerp(0.75, 1.2, ph.size), d = D(ctx, ph.seed), w = lerp(0.88, 1.2, (ph.aspect - 0.86) / 0.44), b = st.breath * 0.6;
    const x = gx + (st.sway || 0) * 3;
    const sit = lerp(0.9, 1.15, ph.legs) * jx(1, 0.8), TK = jx(1, 1.35);
    // しっぽ（うしろで横へ）
    if (FUR > 0) d.ell(x + 34 * S, gy - 6 * S, 20 * S, 6.5 * S, 0.12, { far: true, fur: 0.6 });
    else d.seg(x + 18 * S, gy - 8 * S, x + jx(66, 42) * S, gy - 2 * S, 4 * S * TK, 1.3 * S * TK, { far: true });
    // うしろ足（長い足先が手前へ）・もも
    for (const s of [-1, 1]) d.ell(x + s * 17 * S * w, gy - 3 * S, 11 * S * jx(1, 0.85), 4.5 * S * TK, s * 0.25, { far: true });
    for (const s of [-1, 1]) d.ell(x + s * 17 * S * w, gy - 16 * S * sit, 13 * S, 14 * S * sit, 0, { far: true, fur: ph.fluff * 0.7 });
    // 胴
    const by = gy - 32 * S * sit, bry = 28 * S * sit * jx(1, 0.95) + b;
    d.ell(x, by, 24 * S * w * jx(1, 1.08), bry, 0, { fur: Math.max(ph.fluff, J * 0.35), spots: ph.spots, seed: ph.seed, tone: -0.1 * J });
    // 前足（胸の前でそろえる）
    for (const s of [-1, 1]) { d.seg(x + s * 9 * S, by - 12 * S, x + s * 7 * S, by + 2 * S, 4 * S * TK, 3.2 * S * TK); d.strokes(c => { for (let k = -1; k <= 1; k++) { c.moveTo(x + s * 7 * S + k * 1.4, by + 3 * S); c.lineTo(x + s * 7 * S + k * 1.6, by + 5 * S); } }); }
    // 頭
    const hr = 15 * S * lerp(1.15, 0.95, ph.size) * jx(1, 1.55), hy = by - bry - hr * jx(0.8, 0.6);
    headGroup(ctx, x, by - bry + 2 * S, st, () => {
      for (const s of [-1, 1]) { // 耳（まるい。かざりで大きく）
        const er = lerp(5, 11, ph.crest) * S * jx(1, 1.25), ex = x + s * hr * 0.85, ey = hy - hr * 0.75;
        const rot = s * (0.5 + (st.earKick || 0) * 0.35 - (st.listen || 0) * 0.25);
        d.ell(ex, ey, er * 0.8, er, rot, { far: true });
        d.strokes(c => { c.ellipse(ex, ey + er * 0.15, er * 0.42, er * 0.6, rot, 0, TAU); });
      }
      d.ell(x, hy, hr * w * jx(0.95, 1.05), hr, 0, { fur: Math.max(ph.fluff * 0.6, J * 0.25), furLen: 0.6, tone: -0.15 * J + HT() });
      // 鼻（声の筒が長いほど長い。正面なので手前へのびて下にたれる）。かぐとき先がふるえる
      const sn = lerp(5, 22, ph.size) * S * jx(1, 0.35), sx = (st.sniff || 0) * 1.6, sy0 = hy + hr * jx(0.15, 0.3);
      d.seg(x, sy0, x + sx, sy0 + sn, 4.2 * S * jx(1, 1.1), 2.6 * S, { tone: -0.1 * J + HT() });
      d.strokes(c => { for (let k = 1; k < 5; k++) { const yy = sy0 + sn * k / 5; c.moveTo(x - 3 * S * (1 - k / 7), yy); c.quadraticCurveTo(x + sx * k / 5, yy + 1.2, x + 3 * S * (1 - k / 7) + sx * k / 5, yy); } });
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x + sx, sy0 + sn + 1.5 * S, 2.4 * S, 1.5 * S, 0, 0, TAU); ctx.fill();
      // 目（小さい子ほど大きい）
      const er = hr * ph.eye * 0.62 * eyeK(1.25);
      for (const s of [-1, 1]) d.eye(x + s * hr * jx(0.5, 0.42), hy + hr * jx(-0.12, 0.04), er, st.blinkNow);
      if (st.mouth > 0.05) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x - 4 * S, sy0 + sn + 5 * S, 2.5 * S, 1 + st.mouth * 3 * S, 0, 0, TAU); ctx.fill(); }
      for (const s of [-1, 1]) d.strokes(c => { if (FACE >= 2) c.globalAlpha = 0.45; for (let k = 0; k < (FACE >= 2 ? 2 : 3); k++) { c.moveTo(x + s * 4 * S, sy0 + sn * 0.6 + k * 1.5); c.lineTo(x + s * (14 + k * 2) * S * jx(1, 0.7), sy0 + sn * 0.5 + k * 3); } }); // ひげ
    });
  },
};

// ---- R2 シカ型（長い足・首。のど仏の位置が声の筒の長さで下がる）----
export const R2 = {
  name: 'R2 シカ型',
  draw(ctx, ph, st, gx, gy, info) {
    ph0seed = ph.seed;
    const S = lerp(0.68, 1.05, ph.size), d = D(ctx, ph.seed + 1), x = gx + (st.sway || 0) * 3;
    const legH = lerp(38, 66, ph.legs) * S * jx(1, 0.82), w = lerp(0.9, 1.15, (ph.aspect - 0.86) / 0.44), TK = jx(1, 1.25);
    const chestY = gy - legH - 14 * S;
    const spotsW = J > 0.5; // 子ジカの白い斑点（鹿の子模様）
    // うしろの足（内側に見える）
    for (const s of [-1, 1]) { d.seg(x + s * 9 * S, chestY + 4 * S, x + s * 8 * S, gy - 3 * S, 4.2 * S * TK, 1.8 * S * TK, { far: true }); d.ell(x + s * 8 * S, gy - 1.5 * S, 2.6 * S, 2 * S, 0, { far: true }); }
    // 胴（奥）と胸
    d.ell(x, chestY - 4 * S, 22 * S * w * jx(1, 0.9), 18 * S * jx(1, 0.9), 0, { far: true, fur: ph.fluff * 0.6, spots: spotsW ? 0 : ph.spots, seed: ph.seed });
    const chest = d.ell(x, chestY + 2 * S, 15 * S * w, 18 * S * jx(1, 0.88) + st.breath * 0.6, 0, { fur: ph.fluff, spots: spotsW ? 0 : ph.spots * 0.6, seed: ph.seed + 3, tone: -0.1 * J });
    if (spotsW) { const r2 = rng(ph.seed); ctx.save(); ctx.clip(chest); for (let i = 0; i < 6 + ph.spots * 10; i++) { const sx = x + (r2() - 0.5) * 24 * S * w, sy = chestY - 8 * S + r2() * 16 * S; ctx.fillStyle = PAPER; ctx.beginPath(); ctx.ellipse(sx, sy, 1.6 * S, 1.2 * S, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.4; ctx.stroke(); } ctx.restore(); }
    // 前足（ひざ・ひづめ）
    for (const s of [-1, 1]) {
      const fx = x + s * 7 * S * w, kneeY = chestY + 12 * S + legH * 0.45;
      d.seg(fx, chestY + 10 * S, fx + s * 0.5, kneeY, 5 * S * TK, 2.8 * S * TK);
      d.ell(fx + s * 0.5, kneeY, 2.9 * S * TK, 2.4 * S * TK, 0);
      d.seg(fx + s * 0.5, kneeY, fx + s * 0.8, gy - 4 * S, 2.6 * S * TK, 2 * S * TK);
      d.ell(fx + s * 0.8, gy - 2 * S, 3 * S, 2.6 * S, 0, { tone: 0.3 });
      d.strokes(c => { c.moveTo(fx + s * 0.8, gy - 4.5 * S); c.lineTo(fx + s * 0.8, gy); });
    }
    // 首（声の筒が長いほど長い）
    const neckL = lerp(20, 44, ph.size) * S * jx(1, 0.25), headY = chestY - 14 * S - neckL - 4 * S * J, HK = jx(1, 1.9);
    headGroup(ctx, x, chestY - 10 * S, st, () => {
      d.seg(x, chestY - 10 * S, x, headY + 6 * S, 9 * S, 6.5 * S * jx(1, 1.3), { tone: -0.05 });
      // のど仏: 声の筒が長いほど低い位置（アカシカは吠えるときにさらに下げる）
      const lar = lerp(0.3, 0.8, ph.size) + (st.mouth || 0) * 0.12;
      if (J < 0.5) d.ell(x, headY + 6 * S + (chestY - 10 * S - headY - 6 * S) * lar, 3.2 * S, 2.6 * S, 0);
      if (ph.fluff > 0.4 && J < 0.5) d.strokes(c => { for (let i = 0; i < 20 * ph.fluff; i++) { const yy = headY + 8 * S + i * neckL / (20 * ph.fluff); c.moveTo(x - 6 * S, yy); c.lineTo(x - 4 * S + (i % 3), yy + 5 * S); c.moveTo(x + 6 * S, yy); c.lineTo(x + 4 * S - (i % 3), yy + 5 * S); } }); // たてがみ
      // 耳（横へ大きく）
      for (const s of [-1, 1]) {
        const es = lerp(6, 12, ph.crest) * S * jx(1, 1.1), rot = s * (jx(1.15, 0.7) - (st.earKick || 0) * 0.4 - (st.listen || 0) * 0.35);
        d.ell(x + s * 11 * S * HK, headY - 3 * S * HK, es * 0.5, es, rot, { far: true });
      }
      // 角（かざりが大きい子だけ。枝の数もかざりで）
      if (ph.crest > 0.5 && J < 0.5) d.strokes(c => {
        const tines = 1 + Math.round((ph.crest - 0.5) * 6);
        for (const s of [-1, 1]) {
          let bx = x + s * 4 * S, by = headY - 8 * S; c.moveTo(bx, by);
          for (let k = 0; k < tines; k++) { const nx = bx + s * 3 * S, ny = by - 6 * S; c.lineTo(nx, ny); c.moveTo(nx, ny); c.lineTo(nx + s * 4 * S, ny + 1 * S); c.moveTo(nx, ny); bx = nx; by = ny; }
        }
      });
      // 顔（長い顔＝声の筒が長い）
      const faceL = lerp(11, 24, ph.size) * S * jx(1, 0.45), fy = headY + 3 * S * HK;
      d.ell(x, headY - 1 * S, 8.5 * S * HK, 8 * S * HK, 0, { tone: -0.15 * J + HT(), fur: J * 0.5, furLen: 0.5 });
      d.seg(x, headY + 2 * S * HK, x + (st.sniff || 0) * 1.2, fy + faceL, 6 * S * jx(1, 1.15), 4.6 * S, { tone: -0.12 * J + HT() });
      const er = 9 * S * ph.eye * 0.6 * HK * eyeK(1.3);
      for (const s of [-1, 1]) d.eye(x + s * 6.5 * S * HK, headY + jx(1, 2.5) * S, er, st.blinkNow);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x + (st.sniff || 0) * 1.2, fy + faceL + 1 * S, 4 * S, 2.6 * S, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = PAPER; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * 1.6 * S + (st.sniff || 0) * 1.2, fy + faceL + 0.8 * S, 0.9 * S, 0.6 * S, 0, 0, TAU); ctx.fill(); }
      if (st.mouth > 0.05) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, fy + faceL + 5 * S, 3 * S, 1 + st.mouth * 3 * S, 0, 0, TAU); ctx.fill(); }
    });
  },
};

// ---- R3 カエル型（低くすわる。鳴くとのど袋）----
export const R3 = {
  name: 'R3 カエル型',
  draw(ctx, ph, st, gx, gy, info) {
    ph0seed = ph.seed;
    const S = lerp(0.72, 1.12, ph.size), d = D(ctx, ph.seed + 2), x = gx + (st.sway || 0) * 2, w = lerp(0.9, 1.2, (ph.aspect - 0.86) / 0.44);
    const lg = lerp(0.8, 1.25, ph.legs) * jx(1, 0.8);
    if (J > 0.5) d.seg(x - 4 * S, gy - 8 * S, x - 16 * S, gy - 1 * S, 4 * S, 1 * S, { far: true }); // しっぽの名残（子ガエル）
    // うしろ足（たたんだもも・ひろげた足先）
    for (const s of [-1, 1]) {
      d.ell(x + s * 32 * S * w, gy - 11 * S, 14 * S * lg, 10 * S, s * 0.35, { far: true, spots: ph.spots, seed: ph.seed + s });
      d.ell(x + s * 42 * S * w, gy - 2 * S, 13 * S * lg, 3.2 * S, s * 0.12, { far: true });
      d.strokes(c => { for (let k = 0; k < 4; k++) { const tx = x + s * (46 + k * 3) * S * w * lg; c.moveTo(tx - s * 4 * S, gy - 2 * S); c.lineTo(tx + s * 3 * S, gy - 0.5 * S + k * 0.4); } });
    }
    // 体
    const by = gy - 17 * S;
    d.ell(x, by, 33 * S * w * jx(1, 0.85), 17 * S * jx(1, 1.05) + st.breath * 0.5, 0, { spots: ph.spots, seed: ph.seed, tone: -0.08 * J });
    // のど袋（鳴くとふくらむ）
    const sacR = (3 + (st.mouth || 0) * 20) * S;
    headGroup(ctx, x, by, st, () => {
      if (sacR > 4 * S) d.ell(x, by + 3 * S + sacR * 0.3, sacR * 1.15, sacR * 0.85, 0, { tone: -0.35, dense: 0.6 });
      // 頭（体より少し上、口は横いっぱい）
      const hy = by - 11 * S;
      d.ell(x, hy, 29 * S * w * jx(1, 0.9), 13 * S * jx(1, 1.2), 0, { tone: -0.05 - 0.12 * J + HT() });
      const mw = 24 * S * w * jx(1, 0.55);
      d.strokes(c => { c.moveTo(x - mw, hy + 4 * S); c.quadraticCurveTo(x, hy + jx(9, 7) * S, x + mw, hy + 4 * S); }); // 口
      ctx.fillStyle = INK; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 3.5 * S + (st.sniff || 0), hy - 3 * S, 1 * S, 0, TAU); ctx.fill(); } // 鼻の穴
      // 目（頭の上に出っぱる。小さい子ほど大きい）
      const er = lerp(10, 6.5, ph.size) * S * (1 + (st.listen || 0) * 0.08) * jx(1, 1.15) * eyeK(1.25);
      for (const s of [-1, 1]) {
        const ex = x + s * 15 * S * w * jx(1, 0.95), ey = hy - 9 * S * jx(1, 0.8);
        d.ell(ex, ey, er, er * 0.9, 0, { tone: -0.1 });
        ctx.save();
        if (st.blinkNow) { ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ex - er * 0.8, ey); ctx.lineTo(ex + er * 0.8, ey); ctx.stroke(); }
        else if (FACE >= 1) { const g = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.3, er * 0.1, ex, ey, er * 0.85); g.addColorStop(0, EYE[STYLE][0]); g.addColorStop(1, EYE[STYLE][1]); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ex, ey + er * 0.05, er * 0.82, er * 0.74, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(245,236,214,0.95)'; ctx.beginPath(); ctx.ellipse(ex - er * 0.3, ey - er * 0.25, er * 0.2, er * 0.16, -0.5, 0, TAU); ctx.fill(); }
        else { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ex, ey, er * 0.62, er * 0.4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(ex - er * 0.25, ey - er * 0.18, er * 0.15, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
      if (st.mouth > 0.05) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, hy + 7 * S, 10 * S * w, st.mouth * 2.5 * S, 0, 0, TAU); ctx.fill(); }
    });
    // 前足（ひろげて立つ）
    for (const s of [-1, 1]) {
      d.seg(x + s * 16 * S * w, by + 4 * S, x + s * 21 * S * w, gy - 2 * S, 5 * S, 3 * S);
      d.strokes(c => { for (let k = -1.5; k <= 1.5; k++) { c.moveTo(x + s * 21 * S * w, gy - 2 * S); c.lineTo(x + s * 21 * S * w + k * 3 * S, gy + 0.5 * S); } });
    }
    // 背の線（とがりの子はいぼが立つ）
    if (ph.spiky > 0.25) d.strokes(c => { for (let i = 0; i < 9; i++) { const xx = x + (i - 4) * 6 * S * w, yy = by - 15 * S + Math.abs(i - 4) * 1.2; c.moveTo(xx - 2, yy + 1); c.lineTo(xx, yy - ph.spiky * 4 * S); c.lineTo(xx + 2, yy + 1); } });
  },
};

// ---- R4 ツル型（細い2本足・長い首＝長い気管。くちばしはこちらへ）----
export const R4 = {
  name: 'R4 ツル型',
  draw(ctx, ph, st, gx, gy, info) {
    ph0seed = ph.seed;
    const S = lerp(0.62, 0.95, ph.size), d = D(ctx, ph.seed + 3), x = gx + (st.sway || 0) * 3;
    const legH = lerp(40, 70, ph.legs) * S * jx(1, 0.4), w = lerp(0.9, 1.15, (ph.aspect - 0.86) / 0.44), TK = jx(1, 2);
    const by = gy - legH - 18 * S * jx(1, 1.1);
    // 足（かかとの関節・指）
    for (const s of [-1, 1]) {
      const lx = x + s * 6 * S, ky = gy - legH * 0.45;
      d.seg(lx, by + 14 * S, lx + s * 0.5, ky, 2.2 * S * TK, 1.5 * S * TK, { tone: 0.2 });
      d.ell(lx + s * 0.5, ky, 1.9 * S * TK, 2.2 * S * TK, 0, { tone: 0.2 });
      d.seg(lx + s * 0.5, ky, lx + s, gy - 1, 1.5 * S * TK, 1.2 * S * TK, { tone: 0.2 });
      const tl = 7 * S * jx(1, 1.3);
      d.strokes(c => { c.lineWidth = jx(0.7, 1.4); c.moveTo(lx + s, gy - 1); c.lineTo(lx + s - tl, gy + 1); c.moveTo(lx + s, gy - 1); c.lineTo(lx + s + tl, gy + 1); c.moveTo(lx + s, gy - 1); c.lineTo(lx + s, gy + 2); });
    }
    // たたんだ羽（両わき）と胸
    for (const s of [-1, 1]) {
      const p = d.ell(x + s * 15 * S * w * jx(1, 1.15), by + 2 * S, 9 * S * jx(1, 0.7), 24 * S * jx(1, 0.35), s * jx(-0.12, -0.6), { far: true, fur: J * 0.6 });
      if (J < 0.5) d.strokes(c => { for (let k = 0; k < 6; k++) { const yy = by + 6 * S + k * 4 * S; c.moveTo(x + s * 10 * S * w, yy); c.quadraticCurveTo(x + s * 17 * S * w, yy + 3 * S, x + s * 21 * S * w, yy + 8 * S); } });
    }
    d.ell(x, by, 18 * S * w * jx(1, 1.25), 25 * S * jx(1, 0.85) + st.breath * 0.6, 0, { spots: ph.spots, seed: ph.seed, fur: Math.max(ph.fluff * 0.5, J * 0.9), furLen: jx(1, 0.55), tone: -0.1 * J });
    // 胸の羽のうろこ（毛の遺伝子＝羽のふかふか）
    if (J < 0.5) d.strokes(c => { const n = Math.round(lerp(6, 26, ph.fluff)), r2 = rng(ph.seed); for (let i = 0; i < n; i++) { const xx = x + (r2() - 0.5) * 24 * S * w, yy = by - 12 * S + r2() * 30 * S; c.moveTo(xx - 3 * S, yy); c.quadraticCurveTo(xx, yy + 3 * S, xx + 3 * S, yy); } });
    // 首（声の筒＝気管が長いほど長い）
    const neckL = lerp(26, 60, ph.size) * S * jx(1, 0.12), hy = by - 22 * S * jx(1, 0.85) - neckL, HK = jx(1, 1.8);
    headGroup(ctx, x, by - 20 * S, st, () => {
      d.seg(x, by - 20 * S, x, hy + 5 * S, 6 * S, 4 * S, { tone: -0.05 });
      // 頭のかざり羽
      if (ph.crest > 0.3) d.strokes(c => { const n = 2 + Math.round(ph.crest * 4); c.translate(0, -(HK - 1) * 6 * S); for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.25; c.moveTo(x, hy - 6 * S); c.quadraticCurveTo(x + Math.cos(a) * 8 * S, hy - 6 * S + Math.sin(a) * 9 * S, x + Math.cos(a) * 14 * S * ph.crest + Math.cos(a) * 6 * S, hy - 6 * S + Math.sin(a) * (14 * ph.crest + 6) * S); } });
      d.ell(x, hy, 8 * S * HK, 7.5 * S * HK, 0, { tone: -0.05 - 0.12 * J + HT(), fur: J * 0.7, furLen: 0.45 });
      const er = 8 * S * ph.eye * 0.55 * HK * eyeK(1.25);
      for (const s of [-1, 1]) d.eye(x + s * 5.5 * S * HK, hy + jx(-1, 0.5) * S * HK, er, st.blinkNow);
      // くちばし（こちらへ向く。開くと上下に分かれる）
      const bl = lerp(7, 14, ph.size) * S * jx(1, 0.4), op = (st.mouth || 0) * 2.5 * S, sx = (st.sniff || 0), by0 = hy + jx(2, 4) * S * HK;
      d.seg(x, by0, x + sx, by0 + bl - op * 0.3, 2.6 * S * jx(1, 1.2), 0.8 * S, { tone: -0.1 });
      if (op > 0.2) d.seg(x, by0 + 2 * S + op, x + sx, by0 + 1 * S + bl + op, 2 * S, 0.6 * S, { tone: 0.1 });
    });
  },
};

export const PLANS = [R1, R2, R3, R4];

// ---- 本体の場面（鉛筆）: 地面・巣・たまご・紙の目 ----
export function ground(ctx, w, gx, gy, u) {
  const R = rng(4);
  ctx.save(); ctx.strokeStyle = INK; ctx.lineCap = 'round';
  // 地面のうすい影（こすった鉛筆）
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, u * 3.2);
  g.addColorStop(0, 'rgba(52,52,60,0.13)'); g.addColorStop(1, 'rgba(52,52,60,0)');
  ctx.save(); ctx.translate(gx, gy); ctx.scale(1, 0.16); ctx.translate(-gx, -gy); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, u * 3.2, 0, TAU); ctx.fill(); ctx.restore();
  // 草
  for (let i = 0; i < 70; i++) {
    const x = gx + (R() - 0.5) * u * 7, y = gy + (R() - 0.3) * u * 0.25, hgt = (3 + R() * 7) * u / 60;
    ctx.globalAlpha = 0.25 + R() * 0.35; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 1.5, y - hgt * 0.6, x + (R() - 0.5) * 4, y - hgt); ctx.stroke();
  }
  ctx.restore();
}
export function nest(ctx, x, y, rx, ry, part) {
  const R = rng(part === 'back' ? 5 : 9), n = part === 'back' ? 140 : 110;
  ctx.save(); ctx.strokeStyle = INK; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = part === 'back' ? Math.PI + R() * Math.PI : R() * Math.PI, rr = 0.82 + R() * 0.28;
    const px = x + Math.cos(a) * rx * rr, py = y + Math.sin(a) * ry * rr - R() * ry * (part === 'back' ? 0.5 : 0.25);
    const len = rx * (0.12 + R() * 0.2), ang = a + Math.PI / 2 + (R() - 0.5) * 0.9;
    const lit = (Math.cos(a + 2.3) * 0.5 + 0.5);
    ctx.globalAlpha = (part === 'back' ? 0.35 : 0.5) * (0.5 + (1 - lit) * 0.6); ctx.lineWidth = 0.7 + R() * 0.5;
    ctx.beginPath(); ctx.moveTo(px - Math.cos(ang) * len / 2, py - Math.sin(ang) * len / 4);
    ctx.quadraticCurveTo(px + (R() - 0.5) * len * 0.3, py + (R() - 0.5) * len * 0.2, px + Math.cos(ang) * len / 2, py + Math.sin(ang) * len / 4); ctx.stroke();
  }
  ctx.restore();
}
// たまご。level: 声の大きさ（まわりに鉛筆の音の線）、crack: 割れ 0..1、wob: かたむき
export function egg(ctx, x, y, u, t, level, wob, crack) {
  const d = D(ctx, 21), rx = u * 0.6, ry = u * 0.8;
  ctx.save(); ctx.translate(x, y); ctx.rotate(wob); ctx.translate(-x, -y);
  const sv = COAT; COAT = -0.1;
  const p = d.ell(x, y - ry, rx, ry, 0, { tone: -0.1 });
  COAT = sv;
  // そばかす
  const R = rng(21); ctx.save(); ctx.clip(p); ctx.fillStyle = INK;
  for (let i = 0; i < 26; i++) { const a = R() * TAU, r = Math.sqrt(R()); ctx.globalAlpha = 0.15 + R() * 0.25; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * rx, y - ry + Math.sin(a) * r * ry, u * (0.01 + R() * 0.022), u * (0.008 + R() * 0.016), R() * 3, 0, TAU); ctx.fill(); }
  ctx.restore();
  if (crack > 0) {
    ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.lineJoin = 'round';
    const Rc = rng(4), n = 9, yc = y - ry * 1.05; ctx.beginPath();
    for (let i = 0; i <= n; i++) { if (i / n > crack) break; const fx = x - rx + 2 * rx * i / n, fy = yc + (i % 2 ? -1 : 1) * ry * 0.12 + (Rc() - 0.5) * ry * 0.06; i ? ctx.lineTo(fx, fy) : ctx.moveTo(fx, fy); }
    ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  // 声を聞くと、まわりに音の線（鉛筆の短い弧）
  if (level > 0.03) {
    ctx.save(); ctx.strokeStyle = INK; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const ph = (t * 1.4 + k / 3) % 1, rr = u * (1.0 + ph * 0.9);
      ctx.globalAlpha = (1 - ph) * Math.min(1, level * 1.6) * 0.55; ctx.lineWidth = 0.9;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(x, y - ry, rr, sd < 0 ? Math.PI * 0.8 : -Math.PI * 0.2, sd < 0 ? Math.PI * 1.2 : Math.PI * 0.2); ctx.stroke(); }
    }
    ctx.restore();
  }
}
// 殻のかけら（ふ化のあと、手前に）
export function shell(ctx, x, y, u, a) {
  if (a <= 0) return;
  const d = D(ctx, 33); ctx.save(); ctx.globalAlpha = a;
  for (const [dx, rot] of [[-0.9, -0.4], [0.95, 0.5]]) {
    const p = new Path2D(); const cx = x + dx * u, cy = y - u * 0.12;
    p.moveTo(cx - u * 0.3, cy); p.quadraticCurveTo(cx, cy + u * 0.28, cx + u * 0.3, cy); p.lineTo(cx + u * 0.18, cy - u * 0.08); p.lineTo(cx + u * 0.05, cy + u * 0.02); p.lineTo(cx - u * 0.1, cy - u * 0.1); p.closePath();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.translate(-cx, -cy);
    ctx.fillStyle = FILL; ctx.fill(p); ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.globalAlpha = a * 0.8; ctx.stroke(p); ctx.restore();
  }
  ctx.restore();
}
// 紙の目（線をかすれさせる）。決まった模様をくり返し貼る
let grainPat = null;
export function grain(ctx, x, y, w, h) {
  if (STYLE !== 'pencil' && STYLE !== 'cpencil') return;
  if (!grainPat) {
    const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), R = rng(77);
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(243,241,235,${0.12 + R() * 0.22})`; g.fillRect(R() * 160, R() * 160, 1, 1); }
    grainPat = ctx.createPattern(c, 'repeat');
  }
  ctx.save(); ctx.fillStyle = grainPat; ctx.fillRect(x, y, w, h); ctx.restore();
}
