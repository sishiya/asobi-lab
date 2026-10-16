// 2D世界の住人（設定で選ぶ）。どちらも図鑑の銅版画の線で描く
//   kiwi: 実在の生き物（飛べない鳥キーウィ。巣穴から卵の巣へ）
//   penguin: アデリーペンギン（小石の巣）／snail: カタツムリ（雨つぶの葉）
import { INK, hatch } from './ink.js?v=61';

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
  id: 'kiwi', who: 'キーウィ', goalName: '巣', goalThing: '卵',
  // 卵が光ってゆれるのは、ひなが中から殻をつつく「嘴打ち（はしうち）」のあいだ（本当に、かえる前のひなは殻をつつく）
  windowHint: '卵が光ってゆれるのは、ひなが中から殻をつつく「嘴打ち」のあいだだけ',
  earlyMsg: '巣に着いたけれど、ひなはまだ眠っていた（早すぎた）',
  lateMsg: '巣に着いたけれど、ひなは待ちくたびれて、また眠ってしまった（遅すぎた）', plate: 'Apteryx',
  en: { who: 'kiwi', goalName: 'nest', windowHint: 'The egg glows and wobbles only while the chick is pecking at the shell from inside (pipping)', earlyMsg: 'reached the nest, but the chick was still asleep (too early)', lateMsg: 'reached the nest, but the chick got tired of waiting and fell asleep again (too late)' },
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
  // 時刻の窓のあいだ: 卵が光ってゆれる
  drawGoalReady(g, L, S, t) {
    const ex = L.goal.x * S, ey = py(L, S, L.tops[Math.floor(L.goal.x)]) - 15;
    const gr = g.createRadialGradient(ex, ey, 2, ex, ey, 26);
    gr.addColorStop(0, 'rgba(255,214,120,.95)'); gr.addColorStop(1, 'rgba(255,214,120,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(ex, ey, 26, 0, 7); g.fill();
    g.save(); g.translate(ex, ey); g.rotate(Math.sin(t * 9) * 0.12);
    g.fillStyle = '#fff6dc'; g.strokeStyle = INK; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(0, 0, 10, 13, 0.15, 0, 7); g.fill(); g.stroke();
    g.restore();
    sparkle(g, ex + 13, ey - 12, 3, t * 3); sparkle(g, ex - 12, ey - 6, 2.4, t * 2 + 1);
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

// ---------------- ペンギン（アデリーペンギン。小石を積んだ巣） ----------------
// 卵の光と、ひなが顔を出すのはキーウィと同じ「嘴打ち」（鳥のひなは本当に殻をつつく）
const penguin = {
  id: 'penguin', who: 'ペンギン', goalName: '小石の巣', goalThing: '卵',
  windowHint: '卵が光ってゆれるのは、ひなが中から殻をつつく「嘴打ち」のあいだだけ',
  earlyMsg: '小石の巣に着いたけれど、ひなはまだ眠っていた（早すぎた）',
  lateMsg: '小石の巣に着いたけれど、ひなは待ちくたびれて、また眠ってしまった（遅すぎた）', plate: 'Pygoscelis',
  en: { who: 'penguin', goalName: 'pebble nest', windowHint: 'The egg glows and wobbles only while the chick is pecking at the shell from inside (pipping)', earlyMsg: 'reached the pebble nest, but the chick was still asleep (too early)', lateMsg: 'reached the pebble nest, but the chick got tired of waiting and fell asleep again (too late)' },
  drawHome(g, L, S) {
    // 雪をかぶった岩かげ
    const hy = py(L, S, L.tops[Math.floor(L.start.x)]), x = Math.max(0, L.start.x * S - 26);
    g.fillStyle = '#e4dccb';
    g.beginPath(); g.moveTo(x, hy); g.lineTo(x + 8, hy - 26); g.lineTo(x + 30, hy - 32); g.lineTo(x + 50, hy - 18); g.lineTo(x + 54, hy); g.fill();
    g.save(); g.clip(); hatch(g, x, hy - 34, 56, 34, 2.6, 0.9, 'rgba(74,51,32,.4)'); g.restore();
    g.strokeStyle = INK; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x, hy); g.lineTo(x + 8, hy - 26); g.lineTo(x + 30, hy - 32); g.lineTo(x + 50, hy - 18); g.lineTo(x + 54, hy); g.stroke();
    g.fillStyle = '#fbf8f0'; g.beginPath(); g.moveTo(x + 6, hy - 22); g.lineTo(x + 30, hy - 32); g.lineTo(x + 48, hy - 20); g.quadraticCurveTo(x + 28, hy - 24, x + 6, hy - 22); g.fill(); g.stroke();
  },
  drawGoal(g, L, S, R) {
    const gx = L.goal.x * S, gy = py(L, S, L.tops[Math.floor(L.goal.x)]);
    // 小石を積んだ輪
    g.strokeStyle = INK; g.lineWidth = 0.9;
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + (i / 13) * Math.PI, rx = gx + Math.cos(a) * 18, ry = gy - 3 + Math.sin(a) * -4 - (i % 3) * 2;
      g.fillStyle = i % 2 ? '#bfb4a2' : '#d8cfbf';
      g.beginPath(); g.ellipse(rx, ry, 3.6, 2.6, R() * 2, 0, 7); g.fill(); g.stroke();
    }
    g.fillStyle = '#fbf6e8'; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(gx, gy - 14, 9, 12, 0.1, 0, 7); g.fill();
    g.save(); g.clip(); hatch(g, gx, gy - 26, 10, 24, 2.2, -0.9, 'rgba(74,51,32,.35)'); g.restore();
    g.beginPath(); g.ellipse(gx, gy - 14, 9, 12, 0.1, 0, 7); g.stroke();
  },
  drawGoalReady(g, L, S, t) { kiwi.drawGoalReady(g, L, S, t); },
  drawGoalJoy(g, L, S, since) { kiwi.drawGoalJoy(g, L, S, since); },
  drawWalker(g, L, f, S, scale = 1) {
    const joy = f.since != null;
    const hop = joy ? Math.abs(Math.sin(f.since * 7)) * 4 : 0;
    g.save();
    g.translate(f.x * S, py(L, S, f.y) - hop);
    g.scale(f.dir * scale, scale);
    // よちよち: 体を左右にかたむけて歩く
    const ph = f.st === 'walk' ? Math.sin(f.x * 6) : 0;
    g.rotate(ph * 0.12);
    g.fillStyle = '#e0a23a'; g.strokeStyle = INK; g.lineWidth = 1;
    g.beginPath(); g.ellipse(-2 + ph, 0, 3, 1.3, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(2.5 - ph, 0, 3, 1.3, 0, 0, 7); g.fill(); g.stroke();
    // 黒い背と白い腹
    const bodyP = () => { g.beginPath(); g.ellipse(0, -9, 5.5, 9, 0, 0, 7); };
    bodyP(); g.fillStyle = '#3a2e26'; g.fill();
    g.save(); bodyP(); g.clip(); hatch(g, -6, -19, 12, 20, 1.8, -0.9, 'rgba(255,240,220,.25)'); g.restore();
    g.fillStyle = '#fbf6ea'; g.beginPath(); g.ellipse(1.8, -8, 3.6, 7, 0, 0, 7); g.fill();
    bodyP(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
    // つばさ（ひれ）
    g.fillStyle = '#3a2e26'; g.beginPath(); g.ellipse(-3, -9, 1.6, 5, 0.25 + ph * 0.3, 0, 7); g.fill();
    // 目のまわりの白い輪と、くちばし
    g.fillStyle = '#fff'; g.beginPath(); g.arc(2.5, -14.5, 1.6, 0, 7); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(2.8, -14.5, 0.7, 0, 7); g.fill();
    g.fillStyle = '#3a2e26'; g.beginPath(); g.moveTo(4.8, -13.5); g.lineTo(8.5, -12.6); g.lineTo(4.8, -12); g.fill();
    if (joy) {
      g.fillStyle = INK; g.font = '9px Georgia, serif';
      g.save(); g.scale(f.dir, 1); g.fillText('♪', -4 * f.dir + Math.sin(f.since * 3) * 2, -24 - (f.since * 6) % 6); g.restore();
    }
    g.restore();
  },
};

// ---------------- カタツムリ（葉のかげへ。雨つぶが光るうちに） ----------------
const snail = {
  id: 'snail', who: 'カタツムリ', goalName: '葉のかげ', goalThing: '雨つぶ',
  windowHint: '葉に雨つぶが光っているのは、にわか雨のあとの少しのあいだだけ',
  earlyMsg: '葉のかげに着いたけれど、まだ雨はふっていなかった（早すぎた）',
  lateMsg: '葉のかげに着いたけれど、雨つぶはもう乾いていた（遅すぎた）', plate: 'Euhadra',
  en: { who: 'snail', goalName: 'leaf', windowHint: 'Raindrops sparkle on the leaf only for a short while after a passing shower', earlyMsg: 'reached the leaf, but it had not rained yet (too early)', lateMsg: 'reached the leaf, but the raindrops had already dried (too late)' },
  drawHome(g, L, S) {
    // 古い植木ばち
    const hy = py(L, S, L.tops[Math.floor(L.start.x)]), x = Math.max(2, L.start.x * S - 24);
    const pot = () => { g.beginPath(); g.moveTo(x, hy - 22); g.lineTo(x + 36, hy - 22); g.lineTo(x + 31, hy); g.lineTo(x + 5, hy); g.closePath(); };
    pot(); g.fillStyle = '#c98a5e'; g.fill();
    g.save(); pot(); g.clip(); hatch(g, x, hy - 24, 38, 26, 2.4, -0.9, 'rgba(74,51,32,.45)'); g.restore();
    pot(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = '#d9a073'; g.fillRect(x - 3, hy - 26, 42, 5); g.strokeRect(x - 3, hy - 26, 42, 5);
  },
  drawGoal(g, L, S) {
    // 大きな葉（茎と葉脈）
    const gx = L.goal.x * S, gy = py(L, S, L.tops[Math.floor(L.goal.x)]);
    g.strokeStyle = INK; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(gx + 12, gy); g.quadraticCurveTo(gx + 14, gy - 16, gx + 4, gy - 26); g.stroke();
    const leaf = () => { g.beginPath(); g.moveTo(gx + 4, gy - 26); g.quadraticCurveTo(gx - 18, gy - 40, gx - 30, gy - 22); g.quadraticCurveTo(gx - 12, gy - 14, gx + 4, gy - 26); };
    leaf(); g.fillStyle = '#b9c79a'; g.fill();
    g.save(); leaf(); g.clip(); hatch(g, gx - 32, gy - 42, 40, 30, 2.6, 0.6, 'rgba(74,51,32,.4)'); g.restore();
    leaf(); g.stroke();
    g.lineWidth = 0.8; g.beginPath(); g.moveTo(gx + 4, gy - 26); g.quadraticCurveTo(gx - 12, gy - 28, gx - 28, gy - 23); g.stroke();
  },
  drawGoalReady(g, L, S, t) {
    const gx = L.goal.x * S, gy = py(L, S, L.tops[Math.floor(L.goal.x)]);
    const gr = g.createRadialGradient(gx - 12, gy - 28, 2, gx - 12, gy - 28, 28);
    gr.addColorStop(0, 'rgba(180,220,240,.8)'); gr.addColorStop(1, 'rgba(180,220,240,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(gx - 12, gy - 28, 28, 0, 7); g.fill();
    for (const [dx, dy, r] of [[-20, -26, 2.6], [-8, -31, 2.2], [-14, -20, 1.8]]) {
      g.fillStyle = '#eef8fc'; g.strokeStyle = INK; g.lineWidth = 0.8;
      g.beginPath(); g.arc(gx + dx, gy + dy + Math.sin(t * 4 + dx) * 0.6, r, 0, 7); g.fill(); g.stroke();
    }
    sparkle(g, gx - 2, gy - 38, 2.6, t * 3);
  },
  drawGoalJoy(g, L, S, since) {
    const gx = L.goal.x * S, gy = py(L, S, L.tops[Math.floor(L.goal.x)]);
    sparkles(g, gx - 12, gy - 24, since, 5, 22);
  },
  drawWalker(g, L, f, S, scale = 1) {
    const joy = f.since != null;
    g.save();
    g.translate(f.x * S, py(L, S, f.y));
    g.scale(f.dir * scale, scale);
    const ph = f.st === 'walk' ? Math.sin(f.x * 5) : 0;
    // やわらかい体（のびちぢみ）
    const foot = () => { g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(-10, -3, -4, -3); g.lineTo(6 + ph, -4); g.quadraticCurveTo(10 + ph, -4, 10 + ph, -1); g.lineTo(9 + ph, 0); g.closePath(); };
    foot(); g.fillStyle = '#d8c3a0'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
    // つの（目のある長いほう）
    const up = joy ? Math.sin(f.since * 5) * 1.5 : 0;
    g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(7 + ph, -4); g.lineTo(9 + ph, -11 + up); g.moveTo(5.5 + ph, -4); g.lineTo(6.5 + ph, -10 - up); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(9 + ph, -11 + up, 0.9, 0, 7); g.arc(6.5 + ph, -10 - up, 0.8, 0, 7); g.fill();
    // うずまきの殻
    const cx = -2, cy = -9;
    g.fillStyle = '#c99a5b'; g.beginPath(); g.arc(cx, cy, 6.5, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, 6.5, 0, 7); g.clip(); hatch(g, cx - 7, cy - 7, 14, 14, 2, -0.9, 'rgba(74,51,32,.35)'); g.restore();
    g.strokeStyle = INK; g.lineWidth = 1.1;
    g.beginPath(); for (let a = 0; a < Math.PI * 5; a += 0.2) { const r = 6.5 * (1 - a / (Math.PI * 5.4)); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.stroke();
    g.beginPath(); g.arc(cx, cy, 6.5, 0, 7); g.stroke();
    g.restore();
  },
};

// v034: ダンゴムシ・サンカクはやめた（ユーザー）
export const RESIDENTS = { kiwi, penguin, snail };
