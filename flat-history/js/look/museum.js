// 見た目「図鑑の銅版画と標本室」: 線で彫った博物画の大地と、標本室。住人と主人公は residents.js・heroes.js（設定で選ぶ）
import * as THREE from 'three';
import { rng, canvasTexture, floorPlane } from './util.js?v=49';
import { INK, hatch } from './ink.js?v=49';

function drawTerrain(g, L, S, res) {
  const R = rng(23);
  const py = (y) => (L.H - y) * S;
  for (let c = 0; c < L.W; c++) {
    const top = L.tops[c];
    if (top === -Infinity) continue;
    const x = c * S, y0 = py(top), y1 = py(0);
    g.fillStyle = '#efe3c6'; g.fillRect(x, y0, S, y1 - y0 + 1);
    // 地層ごとに線の密度を変える（下ほど濃い・交差）
    for (let r = 0; r < top; r++) {
      const ry0 = py(r + 1), depth = top - r;
      hatch(g, x, ry0, S, S, depth < 1.5 ? 4.5 : depth < 3 ? 3.4 : 2.6, -0.9, 'rgba(74,51,32,.55)');
      if (depth >= 3) hatch(g, x, ry0, S, S, 3.6, 0.7, 'rgba(74,51,32,.35)');
    }
  }
  // 地層の境目（波打つインクの線）は横につなげて描く
  g.strokeStyle = 'rgba(74,51,32,.8)'; g.lineWidth = 1;
  for (let r = 1; r < L.H; r++) {
    g.beginPath(); let pen = false;
    for (let px = 0; px <= L.W * S; px += 2) {
      const c = Math.min(L.W - 1, Math.floor(px / S));
      const ok = L.tops[c] !== -Infinity && L.tops[c] > r;
      const yy = py(r) + Math.sin(px * 0.05 + r * 2) * 1.6;
      if (ok) { if (!pen) { g.moveTo(px, yy); pen = true; } else g.lineTo(px, yy); } else pen = false;
    }
    g.stroke();
  }
  // 化石（アンモナイトと骨）
  const ammonite = (cx, cy, r) => {
    g.fillStyle = '#f6edd6'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1;
    g.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.15) { const rr = r * (1 - a / (Math.PI * 6.4)); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.stroke();
    for (let a = 0; a < Math.PI * 2; a += 0.45) { g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); }
  };
  // 化石は、その列の地面の中に収まるときだけ
  const inGround = (xt, yt, rt = 0.6) => [Math.floor(xt - rt), Math.floor(xt + rt)].every((c) => c >= 0 && c < L.W && L.tops[c] > yt + rt);
  for (const [xt, yt, r] of [[5.5, 1.4, 9], [27, 2.2, 11], [33.5, 4.6, 7], [17.5, 2.4, 8]]) if (inGround(xt, yt)) ammonite(xt * S, py(yt), r);
  const bone = (x0, y0, len, ang) => {
    g.save(); g.translate(x0, y0); g.rotate(ang);
    g.fillStyle = '#f6edd6'; g.strokeStyle = INK; g.lineWidth = 1;
    g.beginPath(); g.rect(-len / 2, -2, len, 4); g.fill(); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.arc(s * len / 2, -2.5, 3, 0, 7); g.arc(s * len / 2, 2.5, 3, 0, 7); g.fill(); g.stroke(); }
    g.restore();
  };
  for (const [xt, yt, len, a] of [[9, 2.6, 22, 0.3], [21, 1.5, 18, -0.5], [31, 2.8, 20, 0.2]]) if (inGround(xt, yt, 0.8)) bone(xt * S, py(yt), len, a);
  // 縁どり（地表と崖の面）
  g.strokeStyle = INK; g.lineWidth = 1.8;
  for (let c = 0; c < L.W; c++) {
    const top = L.tops[c];
    if (top === -Infinity) continue;
    g.beginPath(); g.moveTo(c * S, py(top)); g.lineTo((c + 1) * S, py(top)); g.stroke();
    const l = c > 0 ? L.tops[c - 1] : top, r = c < L.W - 1 ? L.tops[c + 1] : top;
    if (l < top) { g.beginPath(); g.moveTo(c * S + 0.9, py(top)); g.lineTo(c * S + 0.9, l === -Infinity ? py(0) : py(l)); g.stroke(); hatch(g, c * S, py(top), 6, (l === -Infinity ? py(0) : py(l)) - py(top), 1.6, -0.9, 'rgba(74,51,32,.6)'); }
    if (r < top) { g.beginPath(); g.moveTo((c + 1) * S - 0.9, py(top)); g.lineTo((c + 1) * S - 0.9, r === -Infinity ? py(0) : py(r)); g.stroke(); hatch(g, (c + 1) * S - 6, py(top), 6, (r === -Infinity ? py(0) : py(r)) - py(top), 1.6, -0.9, 'rgba(74,51,32,.6)'); }
    // 彫った草
    g.lineWidth = 0.9;
    for (let i = 0; i < 5; i++) {
      const gx = c * S + R() * S, h = 3 + R() * 6;
      g.beginPath(); g.moveTo(gx, py(top)); g.quadraticCurveTo(gx + 2, py(top) - h * 0.6, gx + (R() - 0.3) * 5, py(top) - h); g.stroke();
    }
    g.lineWidth = 1.8;
  }
  // 家とゴール（住人ごとにちがう）
  res.drawHome(g, L, S);
  res.drawGoal(g, L, S, R);
}

function drawBackdrop(g, L, S, res) {
  // 古い紙のしみと、図版のわく
  const W = L.W * S, H = L.H * S;
  const gr = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(120,85,40,.22)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(74,51,32,.7)'; g.lineWidth = 1; g.strokeRect(5, 5, W - 10, H - 10);
  g.strokeRect(8, 8, W - 16, H - 16);
  g.fillStyle = 'rgba(74,51,32,.75)'; g.font = 'italic 12px Georgia, serif'; g.textAlign = 'right';
  g.fillText('Pl. ' + (L.plate || 'I') + ' — ' + res.plate, W - 16, 22); g.textAlign = 'left';
}

// ころがる石（ころがった分だけ線が回る）
function drawStone(g, L, s, S) {
  const cx = s.x * S, cy = (L.H - s.y - 0.6) * S, r = S * 0.58; // 直径1.2マス（sim の STONE_R）
  g.save(); g.translate(cx, cy);
  g.fillStyle = '#cbb894'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.save(); g.clip(); hatch(g, -r, -r * 0.2, r * 2, r * 1.3, 2.2, -0.9, 'rgba(74,51,32,.55)'); g.restore();
  g.rotate(-s.x * 2);
  g.strokeStyle = 'rgba(74,51,32,.7)'; g.lineWidth = 1;
  g.beginPath(); g.arc(0, 0, r * 0.55, 0.3, 2.2); g.stroke();
  g.beginPath(); g.moveTo(-r * 0.2, -r * 0.6); g.lineTo(r * 0.3, -r * 0.2); g.stroke();
  g.restore();
  g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
}

function drawSection(g, L, s, S, color) {
  const x = s.x0 * S, y = (L.H - s.y1) * S, w = (s.x1 - s.x0) * S, h = (s.y1 - s.y0) * S;
  const kind = s.p.kind === 'plank' || s.p.kind === 'short' ? 'beam' : s.p.kind;
  g.fillStyle = kind === 'beam' ? '#d8b483' : kind === 'lift' ? '#dcb85a' : kind === 'slide' ? '#b9c7b0' : kind === 'diamond' ? '#d9c2d4' : '#f4f1e8';
  g.fillRect(x, y, w, h);
  if (kind === 'slide') {
    // すべる向きの山形の線
    g.strokeStyle = 'rgba(74,51,32,.6)'; g.lineWidth = 1;
    const dir = Math.sign(s.vx || 1);
    for (let xx = 8; xx < w - 4; xx += 10) { g.beginPath(); g.moveTo(x + xx, y + 4); g.lineTo(x + xx + 4 * dir, y + h / 2); g.lineTo(x + xx, y + h - 4); g.stroke(); }
  }
  if (kind === 'beam') {
    g.strokeStyle = 'rgba(74,51,32,.65)'; g.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      g.beginPath(); g.moveTo(x, y + 3 + i * 4);
      for (let xx = 0; xx <= w; xx += 6) g.lineTo(x + xx, y + 3 + i * 4 + Math.sin(xx * 0.09 + i) * 1.2);
      g.stroke();
    }
  } else if (kind === 'lift') {
    hatch(g, x, y + h * 0.5, w, h * 0.5, 2, 0, 'rgba(74,51,32,.55)');
    g.fillStyle = 'rgba(255,250,220,.6)'; g.fillRect(x, y + 1, w, 2);
  } else {
    hatch(g, x + w * 0.55, y, w * 0.45, h, 2, -0.9, 'rgba(74,51,32,.5)');
  }
  g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
}

// 標本室: 寄せ木の床と、真鍮のレール
function makeEnv(L) {
  const grp = new THREE.Group();
  const tex = canvasTexture(512, 512, (g, w, h) => {
    const R = rng(9);
    const n = 8, cw = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 0.85 + R() * 0.25;
      g.fillStyle = `rgb(${Math.round(112 * v)},${Math.round(72 * v)},${Math.round(44 * v)})`;
      g.fillRect(i * cw, j * cw, cw, cw);
      g.strokeStyle = 'rgba(40,22,10,.25)'; g.lineWidth = 1;
      const vert = (i + j) % 2 === 0;
      for (let k = 1; k < 4; k++) {
        g.beginPath();
        if (vert) { g.moveTo(i * cw + k * cw / 4, j * cw); g.lineTo(i * cw + k * cw / 4, (j + 1) * cw); }
        else { g.moveTo(i * cw, j * cw + k * cw / 4); g.lineTo((i + 1) * cw, j * cw + k * cw / 4); }
        g.stroke();
      }
      g.strokeStyle = 'rgba(30,15,5,.5)'; g.strokeRect(i * cw, j * cw, cw, cw);
    }
  }, [6, 8]);
  grp.add(floorPlane(L, tex, -4.5));
  const brass = new THREE.MeshStandardMaterial({ color: '#b98d3f', roughness: 0.35, metalness: 0.85 });
  for (const x of [L.W + 0.4]) for (const y of [-0.2, L.H + 0.15]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, L.T + 2, 12), brass);
    rail.rotation.x = Math.PI / 2; rail.position.set(x, y, -L.T / 2); grp.add(rail);
  }
  for (let t = 0; t <= L.T; t += 10) for (const x of [L.W + 0.4]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, L.H + 4.4, 10), brass);
    post.position.set(x, (L.H - 4.4) / 2, -t); grp.add(post);
  }
  return grp;
}

export default {
  id: 'museum',
  kindNamesEn: { beam: 'long specimen board', plank: 'specimen board', short: 'thin specimen board', lift: 'brass slanted board', wall: 'plaster pillar', slide: 'parallelogram board', diamond: 'diamond board' },
  kindNames: { beam: '長い標本の板', plank: '標本の板', short: 'うすい標本の板', lift: '真鍮のななめ板', wall: '石膏の柱', slide: '平行四辺形の板', diamond: 'ひし形の板' },
  kindColors: { beam: '#c9732f', plank: '#c9732f', short: '#d9893f', lift: '#e8a91c', wall: '#e9eef2', slide: '#4f9a86', diamond: '#a0628f' },
  bg: 'radial-gradient(120% 90% at 30% 0%, #f5ead2 0%, #e2d2b0 50%, #b9a27c 100%)',
  fog: '#ddcca8', fogNear: 38, fogFar: 100, paper: ['#f4ead2', '#eadcbc'], paperTint: '#f8efd8',
  edge: '#b29a6c', focus: '#a8742a',
  labelColor: 'rgba(74,51,32,.85)',
  ribbon: { line: '#5a3d22', gold: '#c9942e', dead: '#8f3b2b', old: '#a0634f' },
  light: { sky: '#fff2d8', ground: '#7a5a3a', sun: '#ffe2b5' },
  drawTerrain, drawBackdrop, drawSection, drawStone, makeEnv,
};
