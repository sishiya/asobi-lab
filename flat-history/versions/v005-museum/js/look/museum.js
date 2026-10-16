// 見た目 案2「図鑑の銅版画と標本室」: 線で彫った博物画の大地を、飛べない鳥キーウィが歩く。標本室の石膏像
import * as THREE from 'three';
import { rng, canvasTexture, floorPlane, radialTexture } from './util.js';

const INK = '#4a3320';

// 斜線のハッチング（rect の中を、間隔 gap・角度で）
function hatch(g, x, y, w, h, gap, ang, color, lw = 0.8) {
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

function drawTerrain(g, L, S) {
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
  ammonite(5.5 * S, py(1.4), 9); ammonite(27 * S, py(2.2), 11); ammonite(33.5 * S, py(4.6), 7);
  const bone = (x0, y0, len, ang) => {
    g.save(); g.translate(x0, y0); g.rotate(ang);
    g.fillStyle = '#f6edd6'; g.strokeStyle = INK; g.lineWidth = 1;
    g.beginPath(); g.rect(-len / 2, -2, len, 4); g.fill(); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.arc(s * len / 2, -2.5, 3, 0, 7); g.arc(s * len / 2, 2.5, 3, 0, 7); g.fill(); g.stroke(); }
    g.restore();
  };
  bone(9 * S, py(2.6), 22, 0.3); bone(21 * S, py(1.5), 18, -0.5);
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
  // 家: 土の巣穴
  const hy = py(L.tops[0]);
  g.fillStyle = '#e6d6b2';
  g.beginPath(); g.moveTo(0, hy); g.quadraticCurveTo(6, hy - 30, 30, hy - 28); g.quadraticCurveTo(50, hy - 24, 54, hy); g.fill();
  g.save(); g.clip();
  hatch(g, 0, hy - 30, 54, 30, 2.4, -0.9, 'rgba(74,51,32,.45)');
  g.restore();
  g.strokeStyle = INK; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(0, hy - 2); g.quadraticCurveTo(6, hy - 30, 30, hy - 28); g.quadraticCurveTo(50, hy - 24, 54, hy); g.stroke();
  g.fillStyle = '#2b1d12';
  g.beginPath(); g.ellipse(26, hy, 11, 10, 0, Math.PI, 0); g.fill();
  // ゴール: 小枝の巣と大きな卵
  const gx = L.goal.x * S, gy = py(L.tops[Math.floor(L.goal.x)]);
  g.strokeStyle = INK; g.lineWidth = 1.2;
  for (let i = 0; i < 16; i++) {
    const a = R() * 0.6 - 0.3;
    g.beginPath(); g.moveTo(gx - 6 + R() * 8, gy - R() * 5); g.lineTo(gx + 30 + R() * 10, gy - R() * 7 + a * 6); g.stroke();
  }
  g.fillStyle = '#fbf6e8';
  g.beginPath(); g.ellipse(gx + 16, gy - 15, 10, 13, 0.15, 0, 7); g.fill();
  g.save(); g.clip();
  hatch(g, gx + 16, gy - 28, 12, 26, 2.2, -0.9, 'rgba(74,51,32,.4)');
  g.restore();
  g.beginPath(); g.ellipse(gx + 16, gy - 15, 10, 13, 0.15, 0, 7); g.stroke();
}

function drawBackdrop(g, L, S) {
  // 古い紙のしみと、図版のわく
  const W = L.W * S, H = L.H * S;
  const gr = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(120,85,40,.22)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(74,51,32,.7)'; g.lineWidth = 1; g.strokeRect(5, 5, W - 10, H - 10);
  g.strokeRect(8, 8, W - 16, H - 16);
  g.fillStyle = 'rgba(74,51,32,.75)'; g.font = 'italic 12px Georgia, serif'; g.textAlign = 'right';
  g.fillText('Pl. I — Apteryx', W - 16, 22); g.textAlign = 'left';
}

function drawSection(g, L, s, S, color) {
  const x = s.x0 * S, y = (L.H - s.y1) * S, w = (s.x1 - s.x0) * S, h = (s.y1 - s.y0) * S;
  const kind = s.p.kind;
  g.fillStyle = kind === 'beam' ? '#d8b483' : kind === 'lift' ? '#dcb85a' : '#f4f1e8';
  g.fillRect(x, y, w, h);
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

function drawWalker(g, L, f, S, scale = 1) {
  const x = f.x * S, y = (L.H - f.y) * S;
  g.save();
  g.translate(x, y);
  g.scale(f.dir * scale, scale);
  const ph = f.st === 'walk' ? Math.sin(f.x * 7) : 0;
  // 足（太くてじょうぶ）
  g.strokeStyle = INK; g.lineWidth = 1.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-1, -6); g.lineTo(-1.5 - ph * 2.5, 0); g.lineTo(0.5 - ph * 2.5, 0); g.stroke();
  g.beginPath(); g.moveTo(1.5, -6); g.lineTo(2 + ph * 2.5, 0); g.lineTo(4 + ph * 2.5, 0); g.stroke();
  // 体（洋なし形。毛を線で）
  g.fillStyle = '#c9a77a';
  g.beginPath(); g.ellipse(-0.5, -10, 7, 5.5, -0.15, 0, 7); g.fill();
  g.save(); g.beginPath(); g.ellipse(-0.5, -10, 7, 5.5, -0.15, 0, 7); g.clip();
  g.strokeStyle = 'rgba(74,51,32,.75)'; g.lineWidth = 0.7;
  for (let i = -8; i < 8; i += 1.6) { g.beginPath(); g.moveTo(i, -16); g.quadraticCurveTo(i - 1.5, -10, i - 0.5, -4); g.stroke(); }
  g.restore();
  g.strokeStyle = INK; g.lineWidth = 1.2;
  g.beginPath(); g.ellipse(-0.5, -10, 7, 5.5, -0.15, 0, 7); g.stroke();
  // 頭と長いくちばし
  g.fillStyle = '#d8bb8f';
  g.beginPath(); g.arc(5, -13.5, 3, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(7.5, -13.5); g.quadraticCurveTo(12, -11, 14.5, -5.5); g.stroke();
  g.fillStyle = INK; g.beginPath(); g.arc(5.8, -14.3, 0.7, 0, 7); g.fill();
  g.restore();
}

// 石膏の像
function makeHero() {
  const hero = new THREE.Group();
  const body = new THREE.Group();
  hero.add(body);
  const plaster = new THREE.MeshStandardMaterial({ color: '#f1ede4', roughness: 0.95 });
  // ひだのある衣（回転体をひだの形にゆがめる）
  const pts = [[0.42, 0], [0.4, 0.15], [0.33, 0.6], [0.28, 0.95], [0.24, 1.12], [0.14, 1.22], [0, 1.24]].map(([r, y]) => new THREE.Vector2(r, y));
  const robeGeo = new THREE.LatheGeometry(pts, 48);
  const pos = robeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vz = pos.getZ(i), vy = pos.getY(i);
    const a = Math.atan2(vz, vx), k = 1 + Math.sin(a * 9) * 0.05 * (1 - vy / 1.3);
    pos.setX(i, vx * k); pos.setZ(i, vz * k);
  }
  robeGeo.computeVertexNormals();
  body.add(new THREE.Mesh(robeGeo, plaster));
  // かたにかけた布
  const drape = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 8, 24, Math.PI * 1.2), plaster);
  drape.position.y = 1.05; drape.rotation.set(Math.PI / 2, 0.5, 0.6); body.add(drape);
  // 頭・鼻・まき毛
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 28, 20), plaster);
  head.position.y = 1.44; body.add(head);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 8), plaster);
  nose.rotation.z = -Math.PI / 2; nose.position.set(0.2, 1.43, 0); body.add(nose);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 1.4 - 0.2;
    const curl = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), plaster);
    curl.position.set(Math.cos(a + Math.PI / 2) * 0.16 - 0.03, 1.55 + Math.sin(i) * 0.03, Math.sin(a + Math.PI / 2) * 0.16);
    body.add(curl);
  }
  const armGeo = new THREE.CapsuleGeometry(0.055, 0.4, 4, 8);
  armGeo.translate(0, -0.22, 0);
  const armL = new THREE.Mesh(armGeo, plaster), armR = new THREE.Mesh(armGeo, plaster);
  armL.position.set(0, 1.05, -0.26); armR.position.set(0, 1.05, 0.26);
  body.add(armL, armR);
  // 手もとの小さなランプの火
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10),
    new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffb347', emissiveIntensity: 1.8 }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,190,90,.9)', 'rgba(255,190,90,0)'), transparent: true, depthWrite: false }));
  glow.scale.set(0.8, 0.8, 1); orb.add(glow);
  hero.add(orb);
  hero.scale.setScalar(1.3);
  hero.userData = { body, armL, armR, orb };
  return hero;
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
  for (const x of [-0.4, L.W + 0.4]) for (const y of [-0.2, L.H + 0.15]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, L.T + 2, 12), brass);
    rail.rotation.x = Math.PI / 2; rail.position.set(x, y, L.T / 2); grp.add(rail);
  }
  for (let t = 0; t <= L.T; t += 10) for (const x of [-0.4, L.W + 0.4]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, L.H + 4.4, 10), brass);
    post.position.set(x, (L.H - 4.4) / 2, t); grp.add(post);
  }
  return grp;
}

export default {
  id: 'museum', name: '案2 図鑑の銅版画', who: 'キーウィ',
  kindNames: { beam: '標本の板', lift: '真鍮の板', wall: '石膏の柱' },
  kindColors: { beam: '#c99a63', lift: '#d4ad4a', wall: '#ece8de' },
  bg: 'radial-gradient(120% 90% at 30% 0%, #f5ead2 0%, #e2d2b0 50%, #b9a27c 100%)',
  fog: '#ddcca8', fogNear: 38, fogFar: 100, paper: ['#f4ead2', '#eadcbc'], paperTint: '#f8efd8',
  edge: '#b29a6c', focus: '#a8742a', shelf: '#f0e2c0', shelfLine: '#a88e5e',
  labelColor: 'rgba(74,51,32,.85)',
  ribbon: { line: '#5a3d22', gold: '#c9942e', dead: '#8f3b2b', old: '#a0634f' },
  light: { sky: '#fff2d8', ground: '#7a5a3a', sun: '#ffe2b5' },
  drawTerrain, drawBackdrop, drawWalker, drawSection, makeHero, makeEnv,
};
