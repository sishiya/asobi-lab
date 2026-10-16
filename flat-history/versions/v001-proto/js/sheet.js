// 1秒のページ（2D世界）の絵。空は透明にして、ページを重ねると地面が奥行きにのびて見えるようにする。
import { KINDS } from './level.js';

export const S = 20; // 1マスのピクセル

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const cache = new Map();

// 動かない地形（どのページでも同じ）を一度だけ描く
export function terrainCanvas(L) {
  if (cache.has(L.id)) return cache.get(L.id);
  const cv = document.createElement('canvas');
  cv.width = L.W * S; cv.height = L.H * S;
  const g = cv.getContext('2d');
  const R = rng(7);
  const py = (y) => (L.H - y) * S;
  const bands = ['#7a5232', '#9a6b3f', '#b5824f', '#a8743f', '#c49660', '#8f603a'];
  for (let c = 0; c < L.W; c++) {
    const top = L.tops[c];
    if (top === -Infinity) continue;
    const x = c * S;
    // 地層のしま（同じ高さは同じ色＝となりの列とつながる）
    for (let r = 0; r < top; r++) {
      g.fillStyle = bands[(r * 7 + 3) % bands.length];
      g.fillRect(x, py(r + 1), S, S + 0.5);
    }
    // つぶつぶ
    for (let i = 0; i < 26; i++) {
      const yy = R() * top;
      g.fillStyle = R() < 0.5 ? 'rgba(60,35,18,.35)' : 'rgba(255,230,190,.22)';
      const sz = 1 + R() * 2.2;
      g.fillRect(x + R() * S, py(yy), sz, sz);
    }
    // 小石
    if (R() < 0.6) {
      g.fillStyle = '#d8c7a8';
      g.beginPath(); g.ellipse(x + 4 + R() * 12, py(0.6 + R() * (top - 1.2)), 3, 2, 0, 0, 7); g.fill();
    }
    // 草の帯
    g.fillStyle = '#5f9a4a';
    g.fillRect(x, py(top), S, 5);
    g.fillStyle = '#7dbb5e';
    g.fillRect(x, py(top), S, 2);
    // 草の葉
    g.strokeStyle = '#4f8a3c'; g.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const gx = x + 2 + R() * (S - 4), h = 3 + R() * 5;
      g.beginPath(); g.moveTo(gx, py(top) + 1); g.quadraticCurveTo(gx + 1, py(top) - h * 0.6, gx + (R() - 0.5) * 4, py(top) - h); g.stroke();
    }
  }
  // 段差の面に影
  for (let c = 0; c < L.W; c++) {
    const top = L.tops[c];
    if (top === -Infinity) continue;
    const l = c > 0 ? L.tops[c - 1] : top, r = c < L.W - 1 ? L.tops[c + 1] : top;
    const grdW = 7;
    if (l < top) {
      const y0 = py(top), y1 = l === -Infinity ? py(0) : py(l);
      const gr = g.createLinearGradient(c * S, 0, c * S + grdW, 0);
      gr.addColorStop(0, 'rgba(40,22,10,.45)'); gr.addColorStop(1, 'rgba(40,22,10,0)');
      g.fillStyle = gr; g.fillRect(c * S, y0 + 4, grdW, y1 - y0);
    }
    if (r < top) {
      const y0 = py(top), y1 = r === -Infinity ? py(0) : py(r);
      const gr = g.createLinearGradient((c + 1) * S, 0, (c + 1) * S - grdW, 0);
      gr.addColorStop(0, 'rgba(40,22,10,.45)'); gr.addColorStop(1, 'rgba(40,22,10,0)');
      g.fillStyle = gr; g.fillRect((c + 1) * S - grdW, y0 + 4, grdW, y1 - y0);
    }
  }
  // 家（左はしのほら穴）
  const gx = 0, gy = py(L.tops[0]);
  g.fillStyle = '#8c8173';
  g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx, gy - 56); g.quadraticCurveTo(gx + 20, gy - 66, gx + 40, gy - 44); g.quadraticCurveTo(gx + 50, gy - 24, gx + 46, gy); g.closePath(); g.fill();
  g.fillStyle = '#a69b8b';
  g.beginPath(); g.moveTo(gx, gy - 56); g.quadraticCurveTo(gx + 20, gy - 66, gx + 40, gy - 44); g.lineTo(gx + 30, gy - 46); g.quadraticCurveTo(gx + 16, gy - 56, gx, gy - 48); g.fill();
  g.fillStyle = '#2d2620';
  g.beginPath(); g.moveTo(gx + 6, gy); g.quadraticCurveTo(gx + 8, gy - 30, gx + 22, gy - 30); g.quadraticCurveTo(gx + 34, gy - 28, gx + 36, gy); g.fill();
  // ゴールの小屋
  const hx = L.goal.x * S - 6, hy = py(L.tops[Math.floor(L.goal.x)]);
  g.fillStyle = '#b07a46'; g.fillRect(hx, hy - 30, 44, 30);
  g.strokeStyle = 'rgba(70,40,20,.5)'; g.lineWidth = 1;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(hx, hy - i * 7.5); g.lineTo(hx + 44, hy - i * 7.5); g.stroke(); }
  g.fillStyle = '#c4553b';
  g.beginPath(); g.moveTo(hx - 6, hy - 28); g.lineTo(hx + 22, hy - 50); g.lineTo(hx + 50, hy - 28); g.closePath(); g.fill();
  g.fillStyle = '#ffd77a'; g.fillRect(hx + 26, hy - 22, 10, 9);
  g.fillStyle = '#5a3a22'; g.fillRect(hx + 8, hy - 20, 10, 20);
  // 旗
  g.strokeStyle = '#5a3a22'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(hx + 52, hy); g.lineTo(hx + 52, hy - 44); g.stroke();
  g.fillStyle = '#ffcf3f';
  g.beginPath(); g.moveTo(hx + 52, hy - 44); g.lineTo(hx + 68, hy - 39); g.lineTo(hx + 52, hy - 34); g.fill();
  cache.set(L.id, cv);
  return cv;
}

// 3Dの形の断面
function drawSection(g, L, s) {
  const k = KINDS[s.p.kind];
  const x = s.x0 * S, y = (L.H - s.y1) * S, w = (s.x1 - s.x0) * S, h = (s.y1 - s.y0) * S;
  g.fillStyle = k.color;
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.fillRect(x, y, w, 3);
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.fillRect(x, y + h - 3, w, 3);
  if (s.p.kind === 'beam') {
    g.strokeStyle = 'rgba(110,60,25,.45)'; g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(x + 2, y + 5 + i * 4);
      for (let xx = 0; xx <= w; xx += 10) g.lineTo(x + xx, y + 5 + i * 4 + Math.sin(xx * 0.13 + i * 2) * 1.2);
      g.stroke();
    }
  } else if (s.p.kind === 'lift') {
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 2;
    for (let xx = 8; xx < w; xx += 12) { g.beginPath(); g.moveTo(x + xx, y + h - 3); g.lineTo(x + xx + 6, y + 4); g.stroke(); }
  } else {
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.5;
    for (let yy = 10; yy < h; yy += 12) { g.beginPath(); g.moveTo(x + 3, y + yy); g.lineTo(x + w - 3, y + yy); g.stroke(); }
  }
  g.strokeStyle = 'rgba(30,20,40,.55)'; g.lineWidth = 1.5;
  g.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
}

// 2D人
export function drawWalker(g, L, f, scale = 1) {
  if (!f || f.st === 'dead') return;
  const x = f.x * S, y = (L.H - f.y) * S;
  g.save();
  g.translate(x, y);
  g.scale(f.dir * scale, scale);
  const ph = f.st === 'walk' ? Math.sin(f.x * 7) : 0;
  // 足
  g.strokeStyle = '#26324a'; g.lineWidth = 2.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-1, -7); g.lineTo(-1 - ph * 3, 0); g.moveTo(1, -7); g.lineTo(1 + ph * 3, 0); g.stroke();
  // 体
  g.fillStyle = '#2f3d5c';
  g.beginPath(); g.ellipse(0, -10.5, 3.6, 4.8, 0, 0, 7); g.fill();
  // うで
  g.strokeStyle = '#2f3d5c'; g.lineWidth = 2;
  g.beginPath();
  if (f.st === 'goal' || f.st === 'fall') { g.moveTo(0, -13); g.lineTo(-4, -18); g.moveTo(0, -13); g.lineTo(4, -18); }
  else { g.moveTo(0, -12.5); g.lineTo(3 + ph * 1.5, -8); }
  g.stroke();
  // 頭
  g.fillStyle = '#f0d6b4';
  g.beginPath(); g.arc(0.5, -17.5, 3.4, 0, 7); g.fill();
  g.fillStyle = '#26324a';
  g.beginPath(); g.arc(0.5, -18.4, 3.4, Math.PI * 1.05, Math.PI * 1.95); g.fill();
  g.fillStyle = '#1b2233'; g.fillRect(2, -18, 1.2, 1.4);
  // えりまき（後ろへなびく）
  g.fillStyle = '#e0453a';
  g.beginPath(); g.moveTo(-2.5, -14.5); g.lineTo(2.5, -14.5); g.lineTo(2, -13); g.lineTo(-2.5, -13); g.fill();
  g.beginPath(); g.moveTo(-2.4, -14.5); g.quadraticCurveTo(-7, -14 + ph, -9, -11.5 + ph); g.lineTo(-7.5, -11); g.quadraticCurveTo(-5.5, -12.5, -2.4, -13); g.fill();
  g.restore();
}

// ページを描く。opt.paper: 紙の地を敷く、opt.label: 秒の札
export function drawSheet(g, L, t, frame, secs, opt = {}) {
  const W = L.W * S, H = L.H * S;
  g.clearRect(0, 0, W, H);
  if (opt.paper) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#eef4f8'); gr.addColorStop(1, '#f8f1e3');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  g.drawImage(terrainCanvas(L), 0, 0);
  for (const s of secs) drawSection(g, L, s);
  drawWalker(g, L, frame);
  if (opt.label) {
    g.font = 'bold 15px system-ui, sans-serif';
    g.fillStyle = 'rgba(40,50,70,.75)';
    g.fillText(opt.label, 8, 20);
  }
}
