// 銅版画のインクとハッチング（見た目の部品どうしで使う）
export const INK = '#4a3320';

// 斜線のハッチング（rect の中を、間隔 gap・角度で）
export function hatch(g, x, y, w, h, gap, ang, color, lw = 0.8) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.strokeStyle = color; g.lineWidth = lw;
  const d = Math.hypot(w, h);
  const cx = x + w / 2, cy = y + h / 2, ca = Math.cos(ang), sa = Math.sin(ang);
  g.beginPath();
  for (let o = -d; o <= d; o += gap) {
    g.moveTo(cx + ca * -d - sa * o, cy + sa * -d + ca * o);
    g.lineTo(cx + ca * d - sa * o, cy + sa * d + ca * o);
  }
  g.stroke();
  g.restore();
}

// 目を回した星（気絶の絵。v074）
export function dizzyStars(g, cx, cy, since, scale = 1) {
  g.save(); g.strokeStyle = '#4a3320'; g.fillStyle = '#e7c35a'; g.lineWidth = 0.9;
  for (let i = 0; i < 3; i++) {
    const a = since * 3 + i * (Math.PI * 2 / 3), x = cx + Math.cos(a) * 9 * scale, y = cy + Math.sin(a) * 3 * scale;
    g.beginPath();
    for (let k = 0; k < 10; k++) { const r = (k % 2 ? 1.4 : 3.2) * scale, b = k * Math.PI / 5 - Math.PI / 2; k ? g.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r) : g.moveTo(x + Math.cos(b) * r, y + Math.sin(b) * r); }
    g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}
