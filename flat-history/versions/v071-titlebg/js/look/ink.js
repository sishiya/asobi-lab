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
