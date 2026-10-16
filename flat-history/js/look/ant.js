// 見た目 案1「アリの巣キットと観察者」: 2枚のガラスにはさまれた土の断面を歩くアリ。実験台の上の白衣の観察者
import * as THREE from 'three';
import { rng, canvasTexture, floorPlane, sideShade } from './util.js';

function drawTerrain(g, L, S) {
  const R = rng(11);
  const py = (y) => (L.H - y) * S;
  for (let c = 0; c < L.W; c++) {
    const top = L.tops[c];
    if (top === -Infinity) continue;
    const x = c * S, y0 = py(top), y1 = py(0);
    // 土: 上は明るく乾いて、下ほどしめって濃い
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, '#9b7653'); gr.addColorStop(0.25, '#80603f'); gr.addColorStop(1, '#4e3826');
    g.fillStyle = gr; g.fillRect(x, y0, S, y1 - y0 + 1);
    // 砂つぶ
    for (let i = 0; i < 150; i++) {
      const yy = y0 + R() * (y1 - y0), xx = x + R() * S;
      const r = R();
      g.fillStyle = r < 0.45 ? 'rgba(35,22,12,.45)' : r < 0.85 ? 'rgba(235,205,160,.30)' : 'rgba(255,245,225,.55)';
      g.fillRect(xx, yy, r < 0.9 ? 1 : 1.6, r < 0.9 ? 1 : 1.6);
    }
    // 小石
    for (let i = 0; i < 2; i++) {
      if (R() < 0.45) continue;
      const cx = x + 3 + R() * (S - 6), cy = y0 + 8 + R() * (y1 - y0 - 12), rx = 2 + R() * 2.6, ry = 1.6 + R() * 1.8;
      g.fillStyle = '#8e8a82'; g.beginPath(); g.ellipse(cx, cy, rx, ry, R() * 3, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(cx - rx * 0.3, cy - ry * 0.35, rx * 0.4, ry * 0.3, 0, 0, 7); g.fill();
    }
    // 根っこ
    if (R() < 0.3) {
      g.strokeStyle = 'rgba(214,180,128,.55)'; g.lineWidth = 1;
      let rx = x + R() * S, ry = y0 + 2;
      g.beginPath(); g.moveTo(rx, ry);
      for (let k = 0; k < 6; k++) { rx += (R() - 0.5) * 7; ry += 4 + R() * 6; g.lineTo(rx, ry); }
      g.stroke();
    }
    // 地表のぼろぼろの縁
    g.fillStyle = '#a5805b';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x + R() * S, y0 + 0.5, 1 + R() * 2, 0, 7); g.fill(); }
    // ときどき小さな芽
    if (R() < 0.18) {
      const sx = x + 4 + R() * 12;
      g.strokeStyle = '#6b9a3e'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(sx, y0); g.lineTo(sx, y0 - 6); g.stroke();
      g.fillStyle = '#8cc152';
      g.beginPath(); g.ellipse(sx - 2.5, y0 - 6.5, 2.6, 1.3, -0.5, 0, 7); g.fill();
      g.beginPath(); g.ellipse(sx + 2.5, y0 - 6.5, 2.6, 1.3, 0.5, 0, 7); g.fill();
    }
  }
  sideShade(g, L, S, 'rgba(25,14,6,.55)');
  // 巣の部屋（かざり）: 左の家の地下に卵と幼虫、右の段の中にたくわえた種
  const room = (cx, cy, rx, ry) => {
    g.fillStyle = '#2e2016'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(160,120,80,.5)'; g.lineWidth = 1; g.stroke();
  };
  room(2.6 * S, py(2.0), 30, 11);
  g.strokeStyle = '#2e2016'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(1.2 * S, py(4)); g.quadraticCurveTo(1.0 * S, py(3), 1.9 * S, py(2.2)); g.stroke();
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i % 2 ? '#f4efe2' : '#fffaf0';
    g.beginPath(); g.ellipse(2.0 * S + i * 6, py(1.75), 2.6, 3.6, 0.3, 0, 7); g.fill();
  }
  room(29.5 * S, py(4.6), 34, 10);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? '#c99a4a' : '#e0b867';
    g.beginPath(); g.ellipse(28.3 * S + i * 8, py(4.25), 3.6, 2.4, 0, 0, 7); g.fill();
  }
  // 家: 巣の入り口の土の山
  const hx = 0, hy = py(L.tops[0]);
  g.fillStyle = '#8a6847';
  g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo(hx + 4, hy - 26, hx + 26, hy - 24); g.quadraticCurveTo(hx + 46, hy - 20, hx + 52, hy); g.fill();
  for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? 'rgba(60,40,22,.45)' : 'rgba(230,200,150,.35)'; g.fillRect(hx + 4 + R() * 44, hy - 2 - R() * 20, 1.5, 1.5); }
  g.fillStyle = '#21160e';
  g.beginPath(); g.ellipse(hx + 24, hy - 2, 9, 7, 0, Math.PI, 0); g.fill();
  // ゴール: 大きなパンくず
  const gx = L.goal.x * S - 4, gy = py(L.tops[Math.floor(L.goal.x)]);
  g.fillStyle = '#c8873d';
  g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + 4, gy - 22); g.quadraticCurveTo(gx + 22, gy - 34, gx + 42, gy - 20); g.lineTo(gx + 46, gy); g.fill();
  g.fillStyle = '#efd39a';
  g.beginPath(); g.moveTo(gx + 6, gy); g.lineTo(gx + 8, gy - 18); g.quadraticCurveTo(gx + 22, gy - 28, gx + 38, gy - 17); g.lineTo(gx + 40, gy); g.fill();
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(190,140,70,.7)'; g.beginPath(); g.arc(gx + 10 + R() * 26, gy - 3 - R() * 15, 0.8 + R() * 1.6, 0, 7); g.fill(); }
  // 砂糖のつぶ
  for (let i = 0; i < 5; i++) { g.fillStyle = '#ffffff'; g.fillRect(gx + 48 + i * 4, gy - 3 - (i % 2) * 2, 3, 3); }
}

function drawBackdrop(g, L, S) {
  // ガラスの映りこみ
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.beginPath(); g.moveTo(80, 0); g.lineTo(130, 0); g.lineTo(40, L.H * S); g.lineTo(-10, L.H * S); g.fill();
  g.fillStyle = 'rgba(255,255,255,.18)';
  g.beginPath(); g.moveTo(150, 0); g.lineTo(162, 0); g.lineTo(72, L.H * S); g.lineTo(60, L.H * S); g.fill();
}

function drawSection(g, L, s, S, color) {
  const x = s.x0 * S, y = (L.H - s.y1) * S, w = (s.x1 - s.x0) * S, h = (s.y1 - s.y0) * S;
  const kind = s.p.kind;
  if (kind === 'beam') {
    // 木の定規
    g.fillStyle = '#e8cc95'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, w, 2);
    g.fillStyle = 'rgba(120,80,30,.25)'; g.fillRect(x, y + h - 3, w, 3);
    g.strokeStyle = '#5a3d1c'; g.lineWidth = 1;
    for (let i = 0, xx = x + 3; xx < x + w - 2; i++, xx += 4) {
      g.beginPath(); g.moveTo(xx + 0.5, y); g.lineTo(xx + 0.5, y + (i % 5 === 0 ? 8 : 4)); g.stroke();
    }
    g.fillStyle = '#5a3d1c'; g.font = '7px system-ui';
    for (let i = 0, xx = x + 3; xx < x + w - 10; i++, xx += 20) g.fillText(String(i), xx + 1, y + h - 4);
    g.strokeStyle = 'rgba(90,60,25,.6)'; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  } else if (kind === 'lift') {
    // スライドガラス（厚いガラス板）
    g.fillStyle = 'rgba(176,222,226,.92)'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(x, y + 1, w, 2);
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.5;
    for (let xx = 10; xx < w; xx += 26) { g.beginPath(); g.moveTo(x + xx, y + h - 2); g.lineTo(x + xx + 8, y + 3); g.stroke(); }
    g.strokeStyle = '#4d9aa2'; g.lineWidth = 1.5; g.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  } else {
    // 角砂糖の柱
    const n = Math.round(h / S);
    for (let i = 0; i < n; i++) {
      const cy = y + i * S;
      g.fillStyle = '#fbfaf6'; g.fillRect(x, cy, w, S);
      g.fillStyle = 'rgba(200,205,215,.55)'; g.fillRect(x + w - 4, cy, 4, S); g.fillRect(x, cy + S - 3, w, 3);
      g.fillStyle = 'rgba(170,180,195,.6)';
      for (let k = 0; k < 7; k++) g.fillRect(x + 2 + ((k * 7 + i * 3) % (w - 4)), cy + 2 + ((k * 11) % (S - 4)), 1, 1);
      g.strokeStyle = 'rgba(150,160,175,.8)'; g.lineWidth = 1; g.strokeRect(x + 0.5, cy + 0.5, w - 1, S - 1);
    }
  }
}

function drawWalker(g, L, f, S, scale = 1) {
  const x = f.x * S, y = (L.H - f.y) * S;
  g.save();
  g.translate(x, y);
  g.scale(f.dir * scale, scale);
  const t = f.x * 9;
  const sp = f.st === 'fall';
  // あし（3対。交互に動く）
  g.strokeStyle = '#2a1610'; g.lineWidth = 1.2; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const ph = Math.sin(t + (i % 2 ? Math.PI : 0)) * (f.st === 'walk' ? 2.4 : 0);
    const bx = -1.5 + i * 2;
    const fx = bx + (i - 1) * 4 + ph, fy = sp ? -2 : 0;
    g.beginPath(); g.moveTo(bx, -5); g.lineTo(bx + (i - 1) * 2 + ph * 0.5, -7.5); g.lineTo(fx, fy); g.stroke();
  }
  // おなか・むね・あたま
  const body = (cx, cy, rx, ry) => {
    g.fillStyle = '#3a1e14'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,220,190,.35)'; g.beginPath(); g.ellipse(cx - rx * 0.2, cy - ry * 0.45, rx * 0.45, ry * 0.25, 0, 0, 7); g.fill();
  };
  body(-6.5, -6.5, 4.6, 3.6);
  g.fillStyle = '#3a1e14'; g.beginPath(); g.ellipse(-2.4, -5.8, 1.2, 1, 0, 0, 7); g.fill();
  body(0.5, -6, 3.2, 2.1);
  body(5.6, -7, 2.7, 2.5);
  g.fillStyle = '#100805'; g.beginPath(); g.arc(6.6, -7.6, 0.8, 0, 7); g.fill();
  // しょっかく（ひじのように曲がる）
  const wave = f.st === 'goal' ? Math.sin(performance.now() / 120) * 2 : 0;
  g.strokeStyle = '#2a1610'; g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(6.8, -9); g.lineTo(8.5, -12.5 + wave); g.lineTo(11.5, -11 + wave); g.stroke();
  g.beginPath(); g.moveTo(6, -9.2); g.lineTo(7, -13 - wave); g.lineTo(10, -12.8 - wave); g.stroke();
  g.restore();
}

// 白衣の観察者（人形のような頭身）
function makeHero() {
  const hero = new THREE.Group();
  const body = new THREE.Group();
  hero.add(body);
  const coat = new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: '#f0d3b5', roughness: 0.6 });
  const hair = new THREE.MeshStandardMaterial({ color: '#3b2a20', roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2f3a4a', roughness: 0.5 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c99a3c', roughness: 0.3, metalness: 0.8 });
  // 足
  for (const z of [-0.1, 0.1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8), dark);
    leg.position.set(0, 0.16, z); body.add(leg);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), dark);
    shoe.scale.set(1.4, 0.6, 1); shoe.position.set(0.04, 0.04, z); body.add(shoe);
  }
  // 白衣
  const pts = [[0.3, 0.3], [0.27, 0.5], [0.22, 0.85], [0.2, 0.95], [0.12, 1.0], [0, 1.02]].map(([r, y]) => new THREE.Vector2(r, y));
  const cm = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), coat);
  body.add(cm);
  const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.28, 0.12), new THREE.MeshStandardMaterial({ color: '#7a9cc6' }));
  lapel.position.set(0.21, 0.82, 0); body.add(lapel);
  // 頭（大きめ）
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 28, 20), skin);
  head.position.y = 1.27; body.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.285, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  cap.position.y = 1.29; cap.rotation.z = 0.35; body.add(cap);
  // めがね
  for (const z of [-0.1, 0.1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 8, 20), dark);
    ring.rotation.y = Math.PI / 2; ring.position.set(0.26, 1.26, z); body.add(ring);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), dark);
    eye.position.set(0.255, 1.26, z); body.add(eye);
  }
  // うで
  const armGeo = new THREE.CapsuleGeometry(0.055, 0.34, 4, 8);
  armGeo.translate(0, -0.2, 0);
  const armL = new THREE.Mesh(armGeo, coat), armR = new THREE.Mesh(armGeo, coat);
  armL.position.set(0, 0.95, -0.25); armR.position.set(0, 0.95, 0.25);
  body.add(armL, armR);
  // 虫めがね（右手）
  const lens = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 10, 28), brass);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.15, 28), new THREE.MeshStandardMaterial({ color: '#d9f1f5', transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide }));
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.26, 10), new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.6 }));
  handle.position.y = -0.29;
  lens.add(rim, glass, handle);
  lens.position.set(0.05, -0.62, 0.05); lens.rotation.x = Math.PI / 2; lens.rotation.z = 0.3;
  armR.add(lens);
  hero.scale.setScalar(1.45);
  hero.userData = { body, armL, armR, orbMode: 'hold' };
  return hero;
}

// 実験台（木目の天板）
function makeEnv(L) {
  const grp = new THREE.Group();
  const tex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#b98b5e'; g.fillRect(0, 0, w, h);
    const R = rng(5);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${90 + R() * 40},${55 + R() * 25},${30 + R() * 15},${0.15 + R() * 0.25})`;
      g.lineWidth = 1 + R() * 3;
      const y = R() * h;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6);
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.18)';
    for (let k = 1; k < 4; k++) g.fillRect(0, k * h / 4, w, 2);
  }, [4, 6]);
  grp.add(floorPlane(L, tex, -4.5));
  // キットの木のわく（ページの束の下とはし）
  const wood = new THREE.MeshStandardMaterial({ color: '#8d6240', roughness: 0.7 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(L.W + 1.6, 0.8, L.T + 2), wood);
  base.position.set(L.W / 2, -4.1, L.T / 2); grp.add(base);
  for (const x of [-0.5, L.W + 0.5]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, L.H + 4.2, L.T + 2), new THREE.MeshStandardMaterial({ color: '#9a6d48', roughness: 0.6, transparent: true, opacity: 0.55 }));
    post.position.set(x, (L.H - 4.2) / 2 + 0.1, L.T / 2); grp.add(post);
  }
  return grp;
}

export default {
  id: 'ant', name: '案1 アリの巣キット', who: 'アリ',
  kindNames: { beam: '木の定規', lift: 'スライドガラス', wall: '角砂糖の柱' },
  kindColors: { beam: '#e3c58f', lift: '#8fd0d6', wall: '#f4f1ea' },
  bg: 'radial-gradient(120% 90% at 25% 0%, #fbf6ea 0%, #ece6d6 50%, #d8d1bf 100%)',
  fog: '#e6e0cf', paper: ['#eef3ef', '#e9e2cf'], paperTint: '#f4fbf8',
  edge: '#9cc2c6', focus: '#3d9aa5', shelf: '#d6efee', shelfLine: '#8fb9b8',
  light: { sky: '#fffaf0', ground: '#a8865e', sun: '#fff1d6' },
  drawTerrain, drawBackdrop, drawWalker, drawSection, makeHero, makeEnv,
};
