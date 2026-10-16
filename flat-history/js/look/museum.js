// 見た目「図鑑の銅版画と標本室」: 線で彫った博物画の大地と、標本室。住人と主人公は residents.js・heroes.js（設定で選ぶ）
import * as THREE from 'three';
import { rng, canvasTexture } from './util.js?v=53';
import { INK, hatch } from './ink.js?v=53';

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
// v037: 舞台。床（図書館・標本室の寄せ木）と真鍮の手すりはやめて、ページの束の下は奈落（ユーザー「図書館的な見た目にしない」）。
// 上は古い紙の光のもや、下へいくほど暗いセピアの深み。奈落には、もやの層と、ゆっくり昇るほこり。
// 左右の見えない壁（主人公が出られない x=0・x=W）は、紙の透かしのような、ほとんど見えない光の幕。近づくと浮かび、ふれると波紋が広がる
// v038: 3D世界の色は、2D世界（紙とセピア）の暖色に、主人公たちの青みの緑を足す。上は金色がかった光、地平は緑がかったもや、奈落は深い青緑
const SKY = [[1, '#f4ead0'], [0.2, '#e3dcb4'], [0.03, '#b9c7a0'], [-0.05, '#4f7a66'], [-0.2, '#173c37'], [-1, '#04110f']];
function skyColor(u) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [a, ca] = SKY[i], [b, cb] = SKY[i + 1];
    if (u <= a && u >= b) return new THREE.Color(ca).lerp(new THREE.Color(cb), (a - u) / (a - b));
  }
  return new THREE.Color(SKY[SKY.length - 1][1]);
}
// 見えない壁の幕: たての細い光の筋（紙の繊維）。上と下はぼかす
function curtainTexture(local = false) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const g = cv.getContext('2d'), R = rng(41);
  for (let i = 0; i < 70; i++) {
    const x = R() * 256, w = 0.6 + R() * 1.6, a = 0.25 + R() * 0.6;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(255,246,222,0)'); gr.addColorStop(0.25 + R() * 0.2, `rgba(255,246,222,${a})`);
    gr.addColorStop(0.6 + R() * 0.2, `rgba(255,246,222,${a * 0.6})`); gr.addColorStop(1, 'rgba(255,246,222,0)');
    g.fillStyle = gr; g.fillRect(x, 0, w, 256);
  }
  if (local) { // まわりへ向かって消える、丸い光のまど
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(128, 128, 10, 128, 128, 126);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  if (!local) { tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(6, 1); }
  return tex;
}
function ringTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 30, 64, 64, 62);
  gr.addColorStop(0, 'rgba(190,250,225,0)'); gr.addColorStop(0.75, 'rgba(210,250,225,.9)'); gr.addColorStop(1, 'rgba(190,250,225,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function makeEnv(L) {
  const grp = new THREE.Group();
  const cx = L.W / 2, cz = -L.T / 2;
  // 空と奈落の球（霧はかけない）
  const dome = new THREE.SphereGeometry(320, 32, 24);
  const col = [], pos = dome.attributes.position;
  for (let i = 0; i < pos.count; i++) { const c = skyColor(pos.getY(i) / 320); col.push(c.r, c.g, c.b); }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.position.set(cx, 0, cz); sky.renderOrder = -10;
  grp.add(sky);
  // 奈落のもやの層（下ほどうすく、暗く）
  const mistTex = canvasTexture(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  [[-6, '#9fc2a6', 0.16, 150], [-16, '#3f7a6c', 0.18, 220], [-30, '#14403a', 0.2, 300]].forEach(([y, c, op, size]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: mistTex, color: c, transparent: true, opacity: op, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, y, cz); grp.add(m);
  });
  // ゆっくり昇るほこり
  const N = 500, dp = new Float32Array(N * 3), R = rng(7);
  for (let i = 0; i < N; i++) { dp[i * 3] = cx + (R() - 0.5) * 120; dp[i * 3 + 1] = -2 - R() * 40; dp[i * 3 + 2] = cz + (R() - 0.5) * (L.T + 60); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#f6dc8e', size: 0.18, transparent: true, opacity: 0.55, depthWrite: false }));
  grp.add(dust);
  // 左右の見えない壁: ふだんは、ふちに細い光の線がうっすら。主人公が近づくと、そのまわりだけ光の幕が浮かぶ
  const edgeMat = new THREE.LineBasicMaterial({ color: '#9ff0d4', transparent: true, opacity: 0.22, depthWrite: false });
  for (const x of [0, L.W]) for (const y of [-0.6, L.H + 0.6]) {
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, 1), new THREE.Vector3(x, y, -L.T - 1)]), edgeMat));
  }
  const ltex = curtainTexture(true);
  const walls = [0, L.W].map((x) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({
      map: ltex, color: '#b8f5dc', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.y = Math.PI / 2; m.position.x = x;
    grp.add(m);
    return m;
  });
  // ふれたときの波紋
  const rtex = ringTexture();
  const ripples = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rtex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.y = Math.PI / 2; m.visible = false; grp.add(m); ripples.push({ m, age: 9 });
  }
  let lastRipple = 0, time = 0;
  grp.userData.update = (dt, h) => {
    time += dt;
    // ほこりは昇って、上まで来たら下へもどる
    for (let i = 0; i < N; i++) { dp[i * 3 + 1] += dt * (0.25 + (i % 7) * 0.05); if (dp[i * 3 + 1] > -1.5) dp[i * 3 + 1] -= 40; }
    dg.attributes.position.needsUpdate = true;
    // 壁は、主人公が近いほど浮かぶ（4マスより遠ければ、ほとんど見えない）
    walls.forEach((w, k) => {
      const d = k ? L.W - h.x : h.x;
      w.position.y = h.y + 1.2; w.position.z = -h.t;
      w.material.opacity = 0.5 * Math.max(0, 1 - d / 2.5) * (0.85 + 0.15 * Math.sin(time * 2.4));
    });
    // ふれたら波紋（ふちから 0.45 以内で、ときどき）
    const near = h.x < 0.45 ? 0 : h.x > L.W - 0.45 ? L.W : null;
    if (near !== null && time - lastRipple > 0.45) {
      lastRipple = time;
      const r = ripples.find((q) => q.age > 1.2) || ripples[0];
      r.age = 0; r.m.visible = true; r.m.position.set(near, h.y + 1.1, -h.t);
    }
    for (const r of ripples) {
      if (!r.m.visible) continue;
      r.age += dt;
      const u = r.age / 1.2;
      if (u >= 1) { r.m.visible = false; continue; }
      r.m.scale.setScalar(0.6 + u * 3.2);
      r.m.material.opacity = 0.8 * (1 - u);
    }
  };
  return grp;
}

export default {
  id: 'museum',
  kindNamesEn: { beam: 'long specimen board', plank: 'specimen board', short: 'thin specimen board', lift: 'brass slanted board', wall: 'plaster pillar', slide: 'parallelogram board', diamond: 'diamond board' },
  kindNames: { beam: '長い標本の板', plank: '標本の板', short: 'うすい標本の板', lift: '真鍮のななめ板', wall: '石膏の柱', slide: '平行四辺形の板', diamond: 'ひし形の板' },
  kindColors: { beam: '#c9732f', plank: '#c9732f', short: '#d9893f', lift: '#e8a91c', wall: '#e9eef2', slide: '#4f9a86', diamond: '#a0628f' },
  bg: 'linear-gradient(180deg, #f2e8cc 0%, #b9c7a0 45%, #173c37 100%)',
  fog: '#cfd2ae', fogNear: 38, fogFar: 100, paper: ['#f4ead2', '#eadcbc'], paperTint: '#f8efd8',
  edge: '#8aa98a', focus: '#c9952e',
  labelColor: 'rgba(74,51,32,.85)',
  ribbon: { line: '#5a3d22', gold: '#c9942e', dead: '#8f3b2b', old: '#a0634f' },
  light: { sky: '#fff2d8', ground: '#2f5a4e', sun: '#ffe2b5' },
  drawTerrain, drawBackdrop, drawSection, drawStone, makeEnv,
};
