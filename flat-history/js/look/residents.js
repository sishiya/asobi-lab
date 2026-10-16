// 2D世界の住人（設定で選ぶ）。どちらも図鑑の銅版画の線で描く
//   kiwi: 実在の生き物（飛べない鳥キーウィ。巣穴から卵の巣へ）
//   flat: 低い次元の住人（『フラットランド』のような図形の生き物「サンカク」。五角形の家から家族の家へ）
import { INK, hatch } from './ink.js?v=16';

// 4つの光の星（彫った線の星）
export function sparkle(g, x, y, r, a) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = '#d9a63a'; g.strokeStyle = INK; g.lineWidth = 0.7;
  g.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.3 : r, an = i * Math.PI / 4; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
  g.closePath(); g.fill(); g.stroke();
  g.restore();
}
function sparkles(g, cx, cy, since, n = 5, rad = 20) {
  for (let i = 0; i < n; i++) {
    const a = since * 1.5 + i * (Math.PI * 2 / n), r = rad + Math.sin(since * 3 + i) * 4;
    sparkle(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6, 2.5 + (i % 2) * 1.2, since * 2 + i);
  }
}
const py = (L, S, y) => (L.H - y) * S;

// ---------------- キーウィ ----------------
const kiwi = {
  id: 'kiwi', who: 'キーウィ', goalName: '巣', plate: 'Apteryx',
  drawHome(g, L, S) {
    const hy = py(L, S, L.tops[Math.floor(L.start.x)]);
    g.save(); g.translate(Math.max(0, L.start.x * S - 27), 0);
    g.fillStyle = '#e6d6b2';
    g.beginPath(); g.moveTo(0, hy); g.quadraticCurveTo(6, hy - 30, 30, hy - 28); g.quadraticCurveTo(50, hy - 24, 54, hy); g.fill();
    g.save(); g.clip(); hatch(g, 0, hy - 30, 54, 30, 2.4, -0.9, 'rgba(74,51,32,.45)'); g.restore();
    g.strokeStyle = INK; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(0, hy - 2); g.quadraticCurveTo(6, hy - 30, 30, hy - 28); g.quadraticCurveTo(50, hy - 24, 54, hy); g.stroke();
    g.fillStyle = '#2b1d12';
    g.beginPath(); g.ellipse(26, hy, 11, 10, 0, Math.PI, 0); g.fill();
    g.restore();
  },
  drawGoal(g, L, S, R) {
    const gx = L.goal.x * S - 16, gy = py(L, S, L.tops[Math.floor(L.goal.x)]);
    g.strokeStyle = INK; g.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) {
      const a = R() * 0.6 - 0.3;
      g.beginPath(); g.moveTo(gx - 6 + R() * 8, gy - R() * 5); g.lineTo(gx + 30 + R() * 10, gy - R() * 7 + a * 6); g.stroke();
    }
    g.fillStyle = '#fbf6e8';
    g.beginPath(); g.ellipse(gx + 16, gy - 15, 10, 13, 0.15, 0, 7); g.fill();
    g.save(); g.clip(); hatch(g, gx + 16, gy - 28, 12, 26, 2.2, -0.9, 'rgba(74,51,32,.4)'); g.restore();
    g.beginPath(); g.ellipse(gx + 16, gy - 15, 10, 13, 0.15, 0, 7); g.stroke();
  },
  // 巣に着いてから: 卵にひびが入り、ひなが顔を出す
  drawGoalJoy(g, L, S, since) {
    const ex = L.goal.x * S, gy = py(L, S, L.tops[Math.floor(L.goal.x)]), ey = gy - 15;
    if (since > 0.8) {
      g.strokeStyle = INK; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(ex - 9, ey - 2); g.lineTo(ex - 4, ey + 2); g.lineTo(ex, ey - 3); g.lineTo(ex + 4, ey + 1); g.lineTo(ex + 9, ey - 3); g.stroke();
    }
    if (since > 1.8) {
      g.fillStyle = '#fbf6e8'; g.strokeStyle = INK; g.lineWidth = 1;
      g.beginPath(); g.ellipse(ex + 17, gy - 4, 7, 4, 0.5, Math.PI, 0); g.fill(); g.stroke();
      const bob = Math.sin(since * 6);
      g.fillStyle = '#d8bb8f';
      g.beginPath(); g.arc(ex, ey - 6 + bob, 6, 0, 7); g.fill();
      g.strokeStyle = 'rgba(74,51,32,.7)'; g.lineWidth = 0.6;
      for (let a = -2.6; a < -0.4; a += 0.35) { g.beginPath(); g.moveTo(ex + Math.cos(a) * 4, ey - 6 + bob + Math.sin(a) * 4); g.lineTo(ex + Math.cos(a) * 7, ey - 6 + bob + Math.sin(a) * 7); g.stroke(); }
      g.strokeStyle = INK; g.lineWidth = 1;
      g.beginPath(); g.arc(ex, ey - 6 + bob, 6, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(ex + 5, ey - 6 + bob); g.lineTo(ex + 10, ey - 3 + bob); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.arc(ex + 2, ey - 8 + bob, 0.8, 0, 7); g.fill();
    }
    sparkles(g, ex, ey - 4, since);
  },
  drawWalker(g, L, f, S, scale = 1) {
    const joy = f.since != null;
    const hop = joy ? Math.abs(Math.sin(f.since * 7)) * 5 : 0;
    g.save();
    g.translate(f.x * S, py(L, S, f.y) - hop);
    g.scale(f.dir * scale, scale);
    const ph = f.st === 'walk' ? Math.sin(f.x * 7) : 0;
    g.strokeStyle = INK; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-1, -6); g.lineTo(-1.5 - ph * 2.5, 0); g.lineTo(0.5 - ph * 2.5, 0); g.stroke();
    g.beginPath(); g.moveTo(1.5, -6); g.lineTo(2 + ph * 2.5, 0); g.lineTo(4 + ph * 2.5, 0); g.stroke();
    g.fillStyle = '#c9a77a';
    g.beginPath(); g.ellipse(-0.5, -10, 7, 5.5, -0.15, 0, 7); g.fill();
    g.save(); g.beginPath(); g.ellipse(-0.5, -10, 7, 5.5, -0.15, 0, 7); g.clip();
    g.strokeStyle = 'rgba(74,51,32,.75)'; g.lineWidth = 0.7;
    for (let i = -8; i < 8; i += 1.6) { g.beginPath(); g.moveTo(i, -16); g.quadraticCurveTo(i - 1.5, -10, i - 0.5, -4); g.stroke(); }
    g.restore();
    g.strokeStyle = INK; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(-0.5, -10, 7, 5.5, -0.15, 0, 7); g.stroke();
    g.fillStyle = '#d8bb8f';
    g.beginPath(); g.arc(5, -13.5, 3, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(7.5, -13.5); g.quadraticCurveTo(12, -11, 14.5, -5.5); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(5.8, -14.3, 0.7, 0, 7); g.fill();
    if (joy) {
      g.strokeStyle = INK; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(4.8, -14); g.lineTo(5.8, -15); g.lineTo(6.8, -14); g.stroke();
      g.fillStyle = INK; g.font = '9px Georgia, serif';
      g.save(); g.scale(f.dir, 1); g.fillText('♪', -4 * f.dir + Math.sin(f.since * 3) * 2, -22 - (f.since * 6) % 6); g.restore();
    }
    g.restore();
  },
};

// ---------------- サンカク（図形の住人） ----------------
// 五角形の家（『フラットランド』の家は五角形）
function pentagonHouse(g, cx, by, r, door = true) {
  const path = () => {
    g.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; g.lineTo(cx + Math.cos(a) * r, by - r * 0.81 + Math.sin(a) * r); }
    g.closePath();
  };
  path(); g.fillStyle = '#efe2c2'; g.fill();
  g.save(); g.clip(); hatch(g, cx - r, by - r * 2, r * 2, r * 2, 2.6, -0.9, 'rgba(74,51,32,.4)'); g.restore();
  path(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
  if (door) { g.fillStyle = '#2b1d12'; g.fillRect(cx - 4, by - 12, 8, 12); }
}
function triangleBody(g, s, tilt = 0) {
  // 前（＋x）へとがった三角。s は大きさ
  g.save(); g.rotate(tilt);
  const tri = () => { g.beginPath(); g.moveTo(8 * s, -6 * s); g.lineTo(-6 * s, -1 * s); g.lineTo(-6 * s, -12 * s); g.closePath(); };
  tri(); g.fillStyle = '#e8c27a'; g.fill();
  g.save(); g.clip(); hatch(g, -8 * s, -14 * s, 18 * s, 14 * s, 1.8, 0.5, 'rgba(74,51,32,.45)'); g.restore();
  tri(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
  // 目（とがった先のほう）
  g.fillStyle = '#fff'; g.beginPath(); g.arc(2.6 * s, -6.6 * s, 2 * s, 0, 7); g.fill();
  g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
  g.fillStyle = INK; g.beginPath(); g.arc(3.2 * s, -6.6 * s, 0.9 * s, 0, 7); g.fill();
  g.restore();
}
const flat = {
  id: 'flat', who: 'サンカク', goalName: '家族の家', plate: 'Trigonum',
  drawHome(g, L, S) {
    const hy = py(L, S, L.tops[Math.floor(L.start.x)]);
    pentagonHouse(g, L.start.x * S - 4, hy, 16);
  },
  drawGoal(g, L, S) {
    const gy = py(L, S, L.tops[Math.floor(L.goal.x)]);
    pentagonHouse(g, L.goal.x * S + 4, gy, 20);
    // 窓に家族の小さな三角
    g.save(); g.translate(L.goal.x * S + 4, gy - 22); g.scale(-0.55, 0.55); triangleBody(g, 1); g.restore();
  },
  drawGoalJoy(g, L, S, since) {
    const gx = L.goal.x * S + 4, gy = py(L, S, L.tops[Math.floor(L.goal.x)]);
    if (since > 1) {
      // 家族が出てきて、くるくる回る
      const hop = Math.abs(Math.sin(since * 6)) * 6;
      g.save(); g.translate(gx + 22, gy - hop); g.scale(-0.7, 0.7); triangleBody(g, 1, Math.sin(since * 5) * 0.3); g.restore();
    }
    sparkles(g, gx, gy - 22, since, 6, 26);
  },
  drawWalker(g, L, f, S, scale = 1) {
    const joy = f.since != null;
    const hop = joy ? Math.abs(Math.sin(f.since * 7)) * 5 : 0;
    g.save();
    g.translate(f.x * S, py(L, S, f.y) - hop);
    g.scale(f.dir * scale, scale);
    // 細い2本の足（すり足で進む）
    const ph = f.st === 'walk' ? Math.sin(f.x * 8) : 0;
    g.strokeStyle = INK; g.lineWidth = 1.3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-3, -2); g.lineTo(-3 - ph * 2, 0); g.moveTo(1.5, -3); g.lineTo(1.5 + ph * 2, 0); g.stroke();
    triangleBody(g, 1, f.st === 'fall' ? -0.4 : joy ? Math.sin(f.since * 6) * 0.25 : 0);
    if (joy) {
      g.fillStyle = INK; g.font = '9px Georgia, serif';
      g.save(); g.scale(f.dir, 1); g.fillText('♪', -2 * f.dir, -18 - (f.since * 6) % 6); g.restore();
    }
    g.restore();
  },
};

export const RESIDENTS = { kiwi, flat };
