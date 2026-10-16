// 見た目 案3「切り紙の国と粘土人形」: 色紙を重ねて切った大地を、折り紙の住人が歩く。工作机のカッターマットの上の粘土人形
import * as THREE from 'three';
import { rng, canvasTexture, floorPlane } from './util.js';

// 色紙の層（上から）。d は地表からの深さ（マス）、wav は切り口のゆれ
const LAYERS = [
  { d: 0, col: '#7fb069', hi: '#a5cf86' },
  { d: 0.9, col: '#e6b655', hi: '#f2cf7f' },
  { d: 2.0, col: '#e07a5f', hi: '#eb9c85' },
  { d: 3.3, col: '#3d7c86', hi: '#5b9ba4' },
];

function fiber(g, x, y, w, h, R, n) {
  for (let i = 0; i < n; i++) {
    g.strokeStyle = R() < 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.07)';
    g.lineWidth = 0.6;
    const fx = x + R() * w, fy = y + R() * h, a = R() * 6.28, l = 2 + R() * 4;
    g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.cos(a) * l, fy + Math.sin(a) * l); g.stroke();
  }
}

function drawTerrain(g, L, S) {
  const R = rng(31);
  const py = (y) => (L.H - y) * S;
  const W = L.W * S;
  // 1ピクセル列ずつ、層の切り口を波打たせて塗る（となりの列となめらかにつながる）
  for (let px = 0; px < W; px++) {
    const c = Math.floor(px / S);
    const top = L.tops[c];
    if (top === -Infinity) continue;
    const wobTop = Math.sin(px * 0.07) * 1.2 + Math.sin(px * 0.19 + 1) * 0.6;
    for (let i = 0; i < LAYERS.length; i++) {
      const ly = LAYERS[i];
      const yTop = py(top - ly.d) + (i === 0 ? wobTop : Math.sin(px * (0.045 + i * 0.01) + i * 3) * 3);
      const yNext = i + 1 < LAYERS.length ? py(top - LAYERS[i + 1].d) + Math.sin(px * (0.045 + (i + 1) * 0.01) + (i + 1) * 3) * 3 : py(0) + 1;
      if (yTop >= py(0)) continue;
      g.fillStyle = ly.col;
      g.fillRect(px, yTop, 1, Math.min(py(0), yNext) - yTop + 1);
      // 切り口のふち（明るい線）と、その下の層への影
      g.fillStyle = ly.hi; g.fillRect(px, yTop, 1, 1.5);
      if (i + 1 < LAYERS.length && yNext < py(0)) {
        g.fillStyle = 'rgba(40,25,20,.28)'; g.fillRect(px, yNext, 1, 3);
      }
    }
  }
  // 紙の繊維
  for (let c = 0; c < L.W; c++) {
    const top = L.tops[c];
    if (top === -Infinity) continue;
    fiber(g, c * S, py(top), S, top * S, R, 30);
  }
  // 崖・段の切り口の影
  for (let c = 0; c < L.W; c++) {
    const top = L.tops[c];
    if (top === -Infinity) continue;
    const l = c > 0 ? L.tops[c - 1] : top, r = c < L.W - 1 ? L.tops[c + 1] : top;
    for (const [side, nb] of [[0, l], [1, r]]) {
      if (nb >= top) continue;
      const y0 = py(top), y1 = nb === -Infinity ? py(0) : py(nb);
      const x = side ? (c + 1) * S - 3 : c * S;
      g.fillStyle = 'rgba(40,25,20,.25)'; g.fillRect(x, y0 + 2, 3, y1 - y0);
    }
  }
  // 家: 切り紙の小さな家（2枚重ね）
  const hy = py(L.tops[0]) - 1;
  g.fillStyle = 'rgba(40,25,20,.25)';
  g.beginPath(); g.moveTo(5, hy); g.lineTo(5, hy - 22); g.lineTo(22, hy - 38); g.lineTo(39, hy - 22); g.lineTo(39, hy); g.fill();
  g.fillStyle = '#f3e9d7';
  g.beginPath(); g.moveTo(2, hy); g.lineTo(2, hy - 22); g.lineTo(19, hy - 38); g.lineTo(36, hy - 22); g.lineTo(36, hy); g.fill();
  g.fillStyle = '#d1495b';
  g.beginPath(); g.moveTo(-1, hy - 21); g.lineTo(19, hy - 40); g.lineTo(39, hy - 21); g.lineTo(35, hy - 19); g.lineTo(19, hy - 34); g.lineTo(3, hy - 19); g.fill();
  g.fillStyle = '#3d405b'; g.fillRect(14, hy - 14, 10, 14);
  // ゴール: 紙の星の旗
  const gx = L.goal.x * S, gy = py(L.tops[Math.floor(L.goal.x)]) - 1;
  g.fillStyle = '#6b4f3a'; g.fillRect(gx + 10, gy - 42, 2.5, 42);
  const star = (cx, cy, r, col) => {
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.fill();
  };
  star(gx + 14, gy - 41, 11, 'rgba(40,25,20,.25)');
  star(gx + 11.5, gy - 44, 11, '#f2c14e');
  g.strokeStyle = 'rgba(160,110,20,.6)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(gx + 11.5, gy - 55); g.lineTo(gx + 11.5, gy - 33); g.stroke();
}

function drawBackdrop(g, L, S) {
  const R = rng(4);
  fiber(g, 0, 0, L.W * S, L.H * S, R, 260);
  // 遠くの山（うすい色紙）
  g.fillStyle = 'rgba(160,190,200,.35)';
  g.beginPath(); g.moveTo(0, L.H * S * 0.55);
  for (let x = 0; x <= L.W * S; x += 20) g.lineTo(x, L.H * S * 0.5 + Math.sin(x * 0.012) * 26 + Math.sin(x * 0.031) * 10);
  g.lineTo(L.W * S, L.H * S); g.lineTo(0, L.H * S); g.fill();
}

function drawSection(g, L, s, S, color) {
  const x = s.x0 * S, y = (L.H - s.y1) * S, w = (s.x1 - s.x0) * S, h = (s.y1 - s.y0) * S;
  const kind = s.p.kind;
  g.fillStyle = 'rgba(40,25,20,.25)'; g.fillRect(x + 2, y + 2, w, h);
  if (kind === 'beam') {
    // 段ボールの切り口（波の芯が見える）
    g.fillStyle = '#c99a62'; g.fillRect(x, y, w, h);
    g.fillStyle = '#b5864f'; g.fillRect(x, y, w, 3); g.fillRect(x, y + h - 3, w, 3);
    g.strokeStyle = '#8a6237'; g.lineWidth = 1.4;
    g.beginPath();
    for (let xx = 0; xx <= w; xx += 1) g.lineTo(x + xx, y + h / 2 + Math.sin(xx * 0.55) * (h / 2 - 3.5));
    g.stroke();
  } else if (kind === 'lift') {
    // 厚紙（何枚か重ねたふち）
    g.fillStyle = '#5aa6a0'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.3)';
    for (let k = 4; k < h; k += 5) g.fillRect(x, y + k, w, 1);
    g.fillStyle = '#7cc0ba'; g.fillRect(x, y, w, 2);
  } else {
    // 積み木（木目）
    const n = Math.round(h / S);
    const cols = ['#e0b070', '#d9a35e', '#e6bc80'];
    for (let i = 0; i < n; i++) {
      const cy = y + i * S;
      g.fillStyle = cols[i % 3]; g.fillRect(x, cy, w, S);
      g.strokeStyle = 'rgba(140,90,40,.4)'; g.lineWidth = 0.8;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x, cy + 4 + k * 5); g.quadraticCurveTo(x + w / 2, cy + 2 + k * 5, x + w, cy + 5 + k * 5); g.stroke(); }
      g.strokeStyle = 'rgba(110,70,30,.6)'; g.strokeRect(x + 0.5, cy + 0.5, w - 1, S - 1);
    }
  }
}

function drawWalker(g, L, f, S, scale = 1) {
  const x = f.x * S, y = (L.H - f.y) * S;
  g.save();
  g.translate(x, y);
  g.scale(f.dir * scale, scale);
  const ph = f.st === 'walk' ? Math.sin(f.x * 7) : 0;
  const hop = f.st === 'walk' ? Math.abs(Math.sin(f.x * 3.5)) * 1.2 : 0;
  g.translate(0, -hop);
  // 影
  g.fillStyle = 'rgba(40,25,20,.25)';
  g.beginPath(); g.moveTo(-5, -1.5); g.lineTo(8, -1.5); g.lineTo(2.5, -16); g.fill();
  // 足
  g.strokeStyle = '#3d405b'; g.lineWidth = 1.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-1.5, -3); g.lineTo(-1.5 - ph * 2, hop); g.moveTo(2.5, -3); g.lineTo(2.5 + ph * 2, hop); g.stroke();
  // 折り紙の体（三角を折り目で二色に）
  g.fillStyle = '#fbf7ef';
  g.beginPath(); g.moveTo(-6, -3); g.lineTo(7, -3); g.lineTo(1, -18); g.fill();
  g.fillStyle = '#e9dfcf';
  g.beginPath(); g.moveTo(1, -18); g.lineTo(7, -3); g.lineTo(2.5, -3); g.fill();
  g.strokeStyle = 'rgba(60,50,40,.35)'; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(1, -18); g.lineTo(2.5, -3); g.stroke();
  // 耳の先（折りかえし）と目・ほお
  g.fillStyle = '#d1495b';
  g.beginPath(); g.moveTo(1, -18); g.lineTo(-1.5, -14); g.lineTo(2.2, -14.8); g.fill();
  g.fillStyle = '#2b2d42'; g.beginPath(); g.arc(3.4, -10, 1.3, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(3.8, -10.4, 0.45, 0, 7); g.fill();
  g.fillStyle = 'rgba(224,122,95,.55)'; g.beginPath(); g.arc(4.6, -7.3, 1.3, 0, 7); g.fill();
  if (f.st === 'goal' || f.st === 'fall') {
    g.strokeStyle = '#3d405b'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(-3, -8); g.lineTo(-6, -13); g.moveTo(5.5, -8); g.lineTo(8.5, -13); g.stroke();
  }
  g.restore();
}

// 粘土人形（指でこねたでこぼこ）
function lumpy(geo, amt, seed) {
  const R = rng(seed);
  const pos = geo.attributes.position;
  const off = [R() * 9, R() * 9, R() * 9];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = Math.sin(x * 17 + off[0]) * Math.sin(y * 13 + off[1]) * Math.sin(z * 19 + off[2]);
    const k = 1 + n * amt;
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}
function makeHero() {
  const hero = new THREE.Group();
  const body = new THREE.Group();
  hero.add(body);
  const clay = new THREE.MeshStandardMaterial({ color: '#d98b5f', roughness: 1 });
  const clay2 = new THREE.MeshStandardMaterial({ color: '#4f7cac', roughness: 1 });
  const torso = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.36, 28, 20), 0.035, 3), clay2);
  torso.scale.set(1, 1.15, 1); torso.position.y = 0.42; body.add(torso);
  for (const z of [-0.14, 0.14]) {
    const foot = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.12, 14, 10), 0.05, 7), clay);
    foot.scale.set(1.4, 0.7, 1); foot.position.set(0.05, 0.06, z); body.add(foot);
  }
  const head = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.3, 28, 20), 0.03, 5), clay);
  head.position.y = 1.0; body.add(head);
  const eyeM = new THREE.MeshStandardMaterial({ color: '#1f1f28', roughness: 0.4 });
  for (const z of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), eyeM);
    eye.position.set(0.27, 1.04, z); body.add(eye);
  }
  const nose = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.06, 10, 8), 0.06, 2), clay);
  nose.position.set(0.3, 0.97, 0); body.add(nose);
  const armGeo = lumpy(new THREE.CapsuleGeometry(0.07, 0.26, 4, 10), 0.04, 9);
  armGeo.translate(0, -0.17, 0);
  const armL = new THREE.Mesh(armGeo, clay), armR = new THREE.Mesh(armGeo, clay);
  armL.position.set(0, 0.62, -0.34); armR.position.set(0, 0.62, 0.34);
  body.add(armL, armR);
  // 頭の上を回る紙の星
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.05 : 0.12; i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const orb = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: '#f2c14e', emissive: '#b8860b', emissiveIntensity: 0.35, roughness: 0.8 }));
  hero.add(orb);
  hero.scale.setScalar(1.5);
  hero.userData = { body, armL, armR, orb, tick: (tm) => { orb.rotation.y = tm * 2; } };
  return hero;
}

// 工作机: 緑のカッターマット
function makeEnv(L) {
  const grp = new THREE.Group();
  const tex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#2f6b55'; g.fillRect(0, 0, w, h);
    const n = 16, cw = w / n;
    for (let i = 0; i <= n; i++) {
      g.strokeStyle = i % 4 === 0 ? 'rgba(220,240,225,.55)' : 'rgba(220,240,225,.22)';
      g.lineWidth = i % 4 === 0 ? 1.6 : 1;
      g.beginPath(); g.moveTo(i * cw, 0); g.lineTo(i * cw, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * cw); g.lineTo(w, i * cw); g.stroke();
    }
    g.strokeStyle = 'rgba(240,200,120,.35)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, h); g.lineTo(w, 0); g.stroke();
  }, [5, 7]);
  grp.add(floorPlane(L, tex, -4.5));
  // マットの上の小物: 色紙の束と鉛筆
  const pad = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 8), new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.9 }));
  pad.position.set(L.W + 8, -4.3, 12); pad.rotation.y = 0.3; grp.add(pad);
  const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 12, 6), new THREE.MeshStandardMaterial({ color: '#d1495b', roughness: 0.6 }));
  pencil.rotation.set(0, 0.6, Math.PI / 2); pencil.position.set(-7, -4.2, 28); grp.add(pencil);
  return grp;
}

export default {
  id: 'paper', name: '案3 切り紙の国', who: '紙の子',
  kindNames: { beam: '段ボール', lift: '厚紙', wall: '積み木' },
  kindColors: { beam: '#c99a62', lift: '#5aa6a0', wall: '#e0b070' },
  bg: 'radial-gradient(120% 90% at 30% 0%, #fdf7ec 0%, #f1e6d2 50%, #d9cbb2 100%)',
  fog: '#ece2cf', paper: ['#f7f1e6', '#efe4d0'], paperTint: '#fffaf1',
  edge: '#c9b79a', focus: '#d1495b', shelf: '#f6ead6', shelfLine: '#b9a382',
  light: { sky: '#fff8ee', ground: '#9a8466', sun: '#fff0d8' },
  drawTerrain, drawBackdrop, drawWalker, drawSection, makeHero, makeEnv,
};
