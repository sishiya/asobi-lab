// 3D世界の主人公（設定で選ぶ）。ページと重なったところの断面が2D世界に出るので、断面の見え方も考えて作る
//   poly:      多面体の旅人。断面は形の変わる多角形
//   agate:     瑪瑙（めのう）の精。外は石、中は色の層。断面に、しま模様（地層のような輪）が出る
//   hourglass: 砂時計の精。ガラスの中の砂が、いる時間に合わせて落ちていく。断面に砂の形が出る
//   crane:     折り鶴の精。紙を折った体。断面は紙の色とインクの線で、銅版画になじむ
//   star:      星の精。とげ（円すい）を何本も組んだ体。断面は、とげの三角が集まった星の形
//   cloud:     雲の精。いくつもの球を集めた体。断面は、丸がつらなった雲の形
//   wind:      風の精。うずをまく細い筋の体。断面は、銅版画の風の筋のような短い線が弧にならぶ
//   curator:   学芸員（実在の人に近い見た目）
// 断面はメッシュごとの凸包なので、星・雲・風は「小さな凸の部品の集まり」で作る
// userData.sliceHatch: 断面にハッチングの線をのせる（銅版画になじませる）
// userData.animate(dt, s) で動く。s = { speed(0〜), run, grounded, vy, carry, landT }
import * as THREE from 'three';
import { radialTexture } from './util.js?v=20';

const lerp = (a, b, u) => a + (b - a) * u;

// ---------------- 多面体の旅人 ----------------
function makePoly() {
  const hero = new THREE.Group();
  const body = new THREE.Group();
  hero.add(body);
  const gem = new THREE.MeshStandardMaterial({ color: '#1aa39b', roughness: 0.25, metalness: 0.2, flatShading: true, emissive: '#0b4f4a', emissiveIntensity: 0.35 });
  const gem2 = new THREE.MeshStandardMaterial({ color: '#e0a72e', roughness: 0.3, metalness: 0.5, flatShading: true, emissive: '#5a3a08', emissiveIntensity: 0.3 });
  const coreM = new THREE.MeshStandardMaterial({ color: '#fff3c2', emissive: '#ffcf5a', emissiveIntensity: 1.6 });
  const edgeM = new THREE.LineBasicMaterial({ color: '#f6d27a', transparent: true, opacity: 0.85 });
  // 胴: 二十面体と、中の光る芯
  const torso = new THREE.Group(); torso.position.y = 0.95; body.add(torso);
  const icoGeo = new THREE.IcosahedronGeometry(0.5, 0);
  const ico = new THREE.Mesh(icoGeo, gem); torso.add(ico);
  ico.add(new THREE.LineSegments(new THREE.EdgesGeometry(icoGeo), edgeM));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), coreM); torso.add(core);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,215,120,.6)', 'rgba(255,215,120,0)'), transparent: true, depthWrite: false }));
  glow.scale.set(1.3, 1.3, 1); torso.add(glow);
  // 頭: 八面体（胴の上に浮かぶ）
  const head = new THREE.Group(); head.position.y = 1.75; body.add(head);
  const octGeo = new THREE.OctahedronGeometry(0.28, 0);
  const oct = new THREE.Mesh(octGeo, gem2); head.add(oct);
  oct.add(new THREE.LineSegments(new THREE.EdgesGeometry(octGeo), edgeM));
  // 目のかわりの小さな光（向きがわかる）
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), coreM); eye.position.set(0.24, 0.02, 0); head.add(eye);
  // 手: まわりを回る四面体ふたつ
  const hands = [];
  for (let i = 0; i < 2; i++) {
    const tg = new THREE.TetrahedronGeometry(0.15, 0);
    const t = new THREE.Mesh(tg, gem2);
    t.add(new THREE.LineSegments(new THREE.EdgesGeometry(tg), edgeM));
    body.add(t); hands.push(t);
  }
  // 足もとの輪（浮いている感じ）
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 40), new THREE.MeshBasicMaterial({ color: '#f6d27a', transparent: true, opacity: 0.6 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; body.add(ring);
  hero.scale.setScalar(1.25);
  let tm = 0, spin = 0;
  hero.userData = {
    body,
    animate(dt, s) {
      tm += dt;
      spin += dt * (0.6 + s.speed * (s.run ? 4 : 2.5));
      const air = !s.grounded;
      const squash = s.landT > 0 ? 1 - s.landT * 0.8 : 1;
      torso.position.y = 0.95 + Math.sin(tm * 2.2) * 0.05 + (s.speed > 0.1 && !air ? Math.abs(Math.sin(tm * 9)) * 0.08 : 0);
      torso.scale.set(1 + (1 - squash) * 0.6, squash, 1 + (1 - squash) * 0.6);
      ico.rotation.set(spin * 0.7, spin, spin * 0.4);
      head.position.y = torso.position.y + 0.8 + (air ? 0.12 : 0);
      oct.rotation.y = -spin * 1.3; oct.rotation.z = Math.sin(tm * 1.5) * 0.2;
      body.rotation.z = -Math.min(0.35, s.speed * (s.run ? 0.3 : 0.15)); // 進む向きへ前のめり
      core.scale.setScalar(1 + Math.sin(tm * 3) * 0.12);
      ring.scale.setScalar(1 + Math.sin(tm * 2) * 0.08 + (air ? 0.4 : 0));
      ring.material.opacity = air ? 0.25 : 0.6;
      hands.forEach((h, i) => {
        const a = tm * 1.8 + i * Math.PI;
        if (s.carry) { h.position.set(0.25, 2.3 + Math.sin(tm * 4 + i) * 0.05, i ? 0.3 : -0.3); }
        else h.position.set(Math.cos(a) * 0.7, 1.0 + Math.sin(tm * 2.5 + i) * 0.15, Math.sin(a) * 0.7);
        h.rotation.set(tm * 2 + i, tm * 3, 0);
      });
    },
  };
  return hero;
}

// ---------------- 学芸員 ----------------
function makeCurator() {
  const hero = new THREE.Group();
  const body = new THREE.Group();
  hero.add(body);
  const M = (color, r = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: r, ...extra });
  const coat = M('#16708a', 0.55), coatDark = M('#0d4c5f'), scarf = M('#c8322b'), skin = M('#f2c9a0', 0.55);
  const hair = M('#2b1a12'), brass = M('#e0a83a', 0.3, { metalness: 0.85 }), boot = M('#3a2418', 0.5), leather = M('#7a4a26', 0.7);
  // 足（腰から振る）
  const legs = [];
  for (const z of [-0.1, 0.1]) {
    const hip = new THREE.Group(); hip.position.set(0, 0.36, z); body.add(hip);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.2, 4, 8), coatDark); leg.position.y = -0.18; hip.add(leg);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), boot);
    shoe.scale.set(1.5, 0.6, 1); shoe.position.set(0.05, -0.32, 0); hip.add(shoe);
    legs.push(hip);
  }
  // 上半身（ゆれる）
  const torso = new THREE.Group(); body.add(torso);
  const pts = [[0.34, 0.26], [0.3, 0.42], [0.23, 0.8], [0.21, 0.95], [0.13, 1.02], [0, 1.03]].map(([r, y]) => new THREE.Vector2(r, y));
  torso.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 28), coat));
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.025, 8, 28), coatDark);
  belt.rotation.x = Math.PI / 2; belt.position.y = 0.66; torso.add(belt);
  for (let i = 0; i < 3; i++) {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), brass);
    btn.position.set(0.225 - i * 0.004, 0.86 - i * 0.12, 0); torso.add(btn);
  }
  // 肩かけかばん
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.08), leather); bag.position.set(-0.05, 0.58, -0.3); torso.add(bag);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 6, 30, Math.PI), leather); strap.position.set(0, 0.62, -0.02); strap.rotation.set(0, Math.PI / 2, -0.5); torso.add(strap);
  const sc = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 20), scarf);
  sc.rotation.x = Math.PI / 2; sc.position.y = 1.02; torso.add(sc);
  const tailPivot = new THREE.Group(); tailPivot.position.set(-0.13, 1.0, 0.08); torso.add(tailPivot);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.09), scarf); tail.position.y = -0.14; tailPivot.add(tail);
  // 頭（首から）
  const headG = new THREE.Group(); headG.position.y = 1.05; torso.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 28, 20), skin); head.position.y = 0.24; headG.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.275, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
  cap.position.y = 0.26; cap.rotation.z = 0.4; headG.add(cap);
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 14, Math.PI * 1.4), hair); curl.position.set(-0.02, 0.55, 0); curl.rotation.z = 1; headG.add(curl);
  const eyes = [];
  for (const z of [-0.095, 0.095]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), brass);
    ring.rotation.y = Math.PI / 2; ring.position.set(0.25, 0.23, z); headG.add(ring);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), hair); eye.position.set(0.245, 0.23, z); headG.add(eye); eyes.push(eye);
  }
  const cheekM = M('#e8907a', 0.7);
  for (const z of [-0.15, 0.15]) {
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), cheekM); ch.scale.set(0.5, 0.6, 1); ch.position.set(0.225, 0.15, z); headG.add(ch);
  }
  // うで（肩から。z 回転の＋が前）
  const armGeo = new THREE.CapsuleGeometry(0.06, 0.32, 4, 8); armGeo.translate(0, -0.2, 0);
  const armL = new THREE.Mesh(armGeo, coat), armR = new THREE.Mesh(armGeo, coat);
  armL.position.set(0, 0.95, -0.25); armR.position.set(0, 0.95, 0.25);
  torso.add(armL, armR);
  const lamp = new THREE.Group();
  const capTop = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.07, 6), brass); capTop.position.y = 0.115;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.16, 6), M('#fff6d8', 0.1, { transparent: true, opacity: 0.35 }));
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), M('#fff0b8', 0.5, { emissive: '#ffb030', emissiveIntensity: 2.2 }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,190,80,.85)', 'rgba(255,190,80,0)'), transparent: true, depthWrite: false }));
  glow.scale.set(0.6, 0.6, 1);
  lamp.add(capTop, glass, flame, glow); lamp.position.set(0.02, -0.5, 0.02);
  armR.add(lamp);
  hero.scale.setScalar(1.45);
  let tm = 0, phase = 0, blink = 3;
  hero.userData = {
    body,
    animate(dt, s) {
      tm += dt;
      const air = !s.grounded, spd = Math.min(1.6, s.speed * (s.run ? 1.6 : 1));
      phase += dt * (s.run ? 13 : 9) * Math.min(1, s.speed * 1.5);
      const sw = Math.sin(phase) * (air ? 0 : spd * 0.55);
      legs[0].rotation.z = air ? 0.6 : sw; legs[1].rotation.z = air ? -0.3 : -sw;
      const squash = s.landT > 0 ? 1 - s.landT * 0.5 : 1;
      torso.scale.set(1, squash, 1);
      torso.position.y = (!air && s.speed > 0.1 ? Math.abs(Math.cos(phase)) * 0.05 * spd : Math.sin(tm * 2) * 0.012);
      torso.rotation.z = lerp(torso.rotation.z, -spd * 0.18, Math.min(1, dt * 8)); // 走ると前のめり
      if (s.carry) { armL.rotation.z = 2.9; armR.rotation.z = 2.9; }
      else if (air) { armL.rotation.z = lerp(armL.rotation.z, 2.2, dt * 10); armR.rotation.z = lerp(armR.rotation.z, 1.6, dt * 10); }
      else { armL.rotation.z = -sw * 1.1; armR.rotation.z = sw * 1.1; }
      lamp.rotation.z = -armR.rotation.z * 0.7 + Math.sin(tm * 3) * 0.1;
      tailPivot.rotation.z = 0.25 + spd * 0.9 + Math.sin(tm * 6) * 0.12 * (0.3 + spd);
      // 止まっていると、ときどきあたりを見回す。まばたき
      headG.rotation.y = s.speed < 0.05 ? Math.sin(tm * 0.7) * 0.45 : lerp(headG.rotation.y, 0, dt * 6);
      blink -= dt;
      const eyeY = blink < 0.12 ? 0.15 : 1;
      if (blink < 0) blink = 2.5 + Math.random() * 2.5;
      for (const e of eyes) e.scale.y = eyeY;
    },
  };
  return hero;
}

// でこぼこの球（瑪瑙の層）
function blob(r, seed, detail = 3) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + 0.12 * Math.sin(x * 7 + seed) * Math.sin(y * 5 + seed * 2) + 0.06 * Math.sin(z * 9 + seed * 3);
    pos.setXYZ(i, x * k, y * k * 1.12, z * k);
  }
  g.computeVertexNormals();
  return g;
}

// ---------------- 瑪瑙の精 ----------------
function makeAgate() {
  const hero = new THREE.Group();
  const body = new THREE.Group();
  hero.add(body);
  const torso = new THREE.Group(); torso.position.y = 0.75; body.add(torso);
  // 外から内へ（断面は外の層から順に塗るので、しまになる）
  const layers = [['#7d6650', 0.62], ['#c4622e', 0.52], ['#f2dfb4', 0.42], ['#d0912e', 0.32], ['#8a3a1c', 0.22], ['#f7ecd0', 0.11]];
  layers.forEach(([c, r], i) => {
    const m = new THREE.Mesh(blob(r, i * 1.7, i === 0 ? 3 : 2), new THREE.MeshStandardMaterial({ color: c, roughness: i === 0 ? 0.95 : 0.5, flatShading: i === 0 }));
    torso.add(m);
  });
  // 目（外の石に埋まった水晶）
  const crystal = new THREE.MeshStandardMaterial({ color: '#e9f6ff', emissive: '#7fd0ff', emissiveIntensity: 0.6, roughness: 0.1, flatShading: true });
  const eyes = [];
  for (const z of [-0.18, 0.18]) { const e = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), crystal); e.position.set(0.55, 0.18, z); torso.add(e); eyes.push(e); }
  const feet = [];
  for (const z of [-0.22, 0.22]) {
    const f = new THREE.Mesh(blob(0.14, z * 9, 1), new THREE.MeshStandardMaterial({ color: '#6c5845', roughness: 0.9, flatShading: true }));
    f.position.set(0.05, 0.12, z); body.add(f); feet.push(f);
  }
  hero.scale.setScalar(1.35);
  let tm = 0, ph = 0;
  hero.userData = {
    body, sliceHatch: true,
    animate(dt, s) {
      tm += dt; ph += dt * (s.run ? 14 : 9) * Math.min(1, s.speed * 1.5);
      const air = !s.grounded, sq = s.landT > 0 ? 1 - s.landT * 0.9 : 1;
      torso.scale.set(1 + (1 - sq) * 0.5, sq, 1 + (1 - sq) * 0.5);
      torso.position.y = 0.75 + (s.speed > 0.1 && !air ? Math.abs(Math.sin(ph)) * 0.1 : Math.sin(tm * 2) * 0.02);
      torso.rotation.x = s.speed > 0.1 ? Math.sin(ph) * 0.12 : 0; // よちよち左右にゆれる
      torso.rotation.z = -Math.min(0.3, s.speed * 0.15);
      feet[0].position.x = 0.05 + Math.sin(ph) * 0.18 * Math.min(1, s.speed); feet[1].position.x = 0.05 - Math.sin(ph) * 0.18 * Math.min(1, s.speed);
      feet.forEach((f) => { f.position.y = air ? 0.2 : 0.12; });
      for (const e of eyes) e.rotation.y = tm * 2;
      if (s.carry) torso.position.y += 0.05;
    },
  };
  return hero;
}

// ---------------- 砂時計の精 ----------------
function makeHourglass() {
  const hero = new THREE.Group();
  const body = new THREE.Group();
  hero.add(body);
  const wood = new THREE.MeshStandardMaterial({ color: '#7b4a26', roughness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d9a43a', roughness: 0.3, metalness: 0.8 });
  const glassM = new THREE.MeshStandardMaterial({ color: '#cfe9f2', roughness: 0.05, transparent: true, opacity: 0.32, side: THREE.DoubleSide });
  const sandM = new THREE.MeshStandardMaterial({ color: '#e6b04a', roughness: 0.9 });
  const glass = new THREE.Group(); glass.position.y = 0.95; body.add(glass);
  // ガラス（断面にも出す）
  const bulb = (y, sy) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), glassM); m.scale.set(1, sy, 1); m.position.y = y; m.userData.slice = true; glass.add(m); return m; };
  bulb(0.32, 1.05); bulb(-0.32, 1.05);
  // 砂: 上はいる時間に合わせて減り、下はたまる
  const sandTop = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.3, 20), sandM); sandTop.rotation.x = Math.PI; glass.add(sandTop);
  const sandBot = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 20), sandM); glass.add(sandBot);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), sandM); glass.add(stream);
  // 木の上下のふたと柱
  const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24), wood); capT.position.y = 0.72; glass.add(capT);
  const capB = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24), wood); capB.position.y = -0.72; glass.add(capB);
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + 0.5; const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8), brass); post.position.set(Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36); glass.add(post); }
  // ふたの上の目
  const eyeM = new THREE.MeshStandardMaterial({ color: '#2a1a10' });
  const eyes = [];
  for (const z of [-0.13, 0.13]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), eyeM); e.position.set(0.3, 0.8, z); glass.add(e); eyes.push(e); }
  // 木の足
  const legs = [];
  for (const z of [-0.18, 0.18]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 8), wood); l.position.set(0, 0.12, z); body.add(l); legs.push(l); }
  hero.scale.setScalar(1.3);
  let tm = 0, ph = 0, blink = 3;
  hero.userData = {
    body, sliceHatch: true,
    animate(dt, s) {
      tm += dt; ph += dt * (s.run ? 14 : 9) * Math.min(1, s.speed * 1.5);
      const air = !s.grounded, sq = s.landT > 0 ? 1 - s.landT * 0.6 : 1;
      glass.position.y = 0.95 + (s.speed > 0.1 && !air ? Math.abs(Math.sin(ph)) * 0.12 : 0);
      glass.scale.set(1, sq, 1);
      glass.rotation.z = -Math.min(0.3, s.speed * 0.15) + (s.speed > 0.1 ? Math.sin(ph) * 0.06 : 0);
      legs[0].position.x = Math.sin(ph) * 0.12 * Math.min(1, s.speed); legs[1].position.x = -legs[0].position.x;
      // いる時間（0〜60秒）で砂の量が変わる
      const u = Math.max(0, Math.min(1, (s.t || 0) / 60));
      sandTop.scale.set(1 - u * 0.9, Math.max(0.05, 1 - u), 1 - u * 0.9); sandTop.position.y = 0.12 + 0.15 * (1 - u);
      sandBot.scale.set(0.2 + u * 0.8, Math.max(0.05, u), 0.2 + u * 0.8); sandBot.position.y = -0.62 + 0.15 * u;
      stream.visible = u < 0.98;
      blink -= dt; const ey = blink < 0.12 ? 0.2 : 1; if (blink < 0) blink = 2.5 + Math.random() * 2.5;
      for (const e of eyes) e.scale.y = ey;
    },
  };
  return hero;
}

// ---------------- 折り鶴の精 ----------------
function makeCrane() {
  const hero = new THREE.Group();
  const body = new THREE.Group();
  hero.add(body);
  const paper = new THREE.MeshStandardMaterial({ color: '#f3e7cf', roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
  const paper2 = new THREE.MeshStandardMaterial({ color: '#c8462e', roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
  const ink = new THREE.LineBasicMaterial({ color: '#4a3320' });
  const withEdges = (m) => { m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), ink)); return m; };
  const crane = new THREE.Group(); crane.position.y = 1.0; body.add(crane);
  // 胴: つぶした八面体
  const torso = withEdges(new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), paper)); torso.scale.set(1.3, 0.75, 0.6); crane.add(torso);
  // 首と頭、しっぽ（細い四角すい）
  const neck = withEdges(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.9, 4), paper)); neck.position.set(0.55, 0.38, 0); neck.rotation.z = -0.75; crane.add(neck);
  const headM = withEdges(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 4), paper2)); headM.position.set(0.95, 0.66, 0); headM.rotation.z = -2.1; crane.add(headM);
  const tail = withEdges(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.85, 4), paper)); tail.position.set(-0.6, 0.34, 0); tail.rotation.z = 0.8; crane.add(tail);
  // つばさ（三角の板。羽ばたく）
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.35, 0, 0, 0.35, 0, 0, 0.05, 0, 0.95, -0.35, 0.04, 0, 0.05, 0.04, 0.95, 0.35, 0.04, 0], 3));
  wingGeo.computeVertexNormals();
  const wings = [];
  for (const sgn of [1, -1]) {
    const pivot = new THREE.Group(); pivot.position.set(0, 0.1, 0); crane.add(pivot);
    const w = withEdges(new THREE.Mesh(wingGeo, paper)); w.scale.z = sgn; pivot.add(w);
    wings.push({ pivot, sgn });
  }
  // 細い紙の足
  const legs = [];
  for (const z of [-0.12, 0.12]) { const l = withEdges(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.04), paper2)); l.position.set(0, 0.28, z); body.add(l); legs.push(l); }
  hero.scale.setScalar(1.3);
  let tm = 0, ph = 0;
  hero.userData = {
    body, sliceHatch: true,
    animate(dt, s) {
      tm += dt; ph += dt * (s.run ? 14 : 9) * Math.min(1, s.speed * 1.5);
      const air = !s.grounded;
      const flap = air ? Math.sin(tm * 18) * 0.7 : s.speed > 0.1 ? Math.sin(tm * (s.run ? 12 : 7)) * 0.35 : Math.sin(tm * 1.5) * 0.08;
      for (const w of wings) w.pivot.rotation.x = -w.sgn * (0.25 + flap);
      crane.position.y = 1.0 + (s.speed > 0.1 && !air ? Math.abs(Math.sin(ph)) * 0.08 : Math.sin(tm * 2) * 0.03);
      crane.rotation.z = -Math.min(0.3, s.speed * 0.12);
      neck.rotation.z = -0.75 + Math.sin(tm * 2.2) * 0.06;
      legs[0].rotation.z = Math.sin(ph) * 0.5 * Math.min(1, s.speed); legs[1].rotation.z = -legs[0].rotation.z;
      if (s.landT > 0) crane.scale.set(1, 1 - s.landT * 0.5, 1); else crane.scale.set(1, 1, 1);
    },
  };
  return hero;
}

function eyesOn(group, x, y, gap, r = 0.05) {
  const m = new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.4 });
  const eyes = [];
  for (const z of [-gap, gap]) { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m); e.position.set(x, y, z); group.add(e); eyes.push(e); }
  return eyes;
}

// ---------------- 星の精 ----------------
function makeStar() {
  const hero = new THREE.Group();
  const body = new THREE.Group();
  hero.add(body);
  const gold = new THREE.MeshStandardMaterial({ color: '#e9b63c', roughness: 0.35, metalness: 0.35, emissive: '#7a5410', emissiveIntensity: 0.4, flatShading: true });
  const core = new THREE.Group(); core.position.y = 1.05; body.add(core);
  core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), gold));
  // とげ: 正十二面体の頂点の向き（20本）
  const dirs = new THREE.DodecahedronGeometry(1, 0).attributes.position;
  const seen = new Set();
  for (let i = 0; i < dirs.count; i++) {
    const d = new THREE.Vector3().fromBufferAttribute(dirs, i).normalize();
    const k = d.toArray().map((q) => q.toFixed(2)).join();
    if (seen.has(k)) continue; seen.add(k);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 6), gold);
    cone.position.copy(d.clone().multiplyScalar(0.48));
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    core.add(cone);
  }
  const eyes = eyesOn(core, 0.3, 0.05, 0.11, 0.055);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,220,120,.55)', 'rgba(255,220,120,0)'), transparent: true, depthWrite: false }));
  glow.scale.set(2.2, 2.2, 1); core.add(glow);
  hero.scale.setScalar(1.25);
  let tm = 0, spin = 0;
  hero.userData = {
    body, sliceHatch: true,
    animate(dt, s) {
      tm += dt; spin += dt * (0.5 + s.speed * (s.run ? 4 : 2));
      const air = !s.grounded, sq = s.landT > 0 ? 1 - s.landT * 0.7 : 1;
      core.position.y = 1.05 + Math.sin(tm * 2.4) * 0.07 + (air ? 0.1 : 0);
      core.rotation.set(Math.sin(tm * 0.8) * 0.3, spin, -Math.min(0.4, s.speed * 0.2));
      core.scale.set(1 + (1 - sq) * 0.4, sq, 1 + (1 - sq) * 0.4);
      glow.material.opacity = 0.7 + Math.sin(tm * 5) * 0.3;
      for (const e of eyes) e.scale.y = (tm % 3.2) < 0.12 ? 0.2 : 1;
    },
  };
  return hero;
}

// ---------------- 雲の精 ----------------
function makeCloud() {
  const hero = new THREE.Group();
  const body = new THREE.Group();
  hero.add(body);
  const puffM = new THREE.MeshStandardMaterial({ color: '#f6f1e6', roughness: 0.95 });
  const shadeM = new THREE.MeshStandardMaterial({ color: '#d9d4cb', roughness: 0.95 });
  const cloud = new THREE.Group(); cloud.position.y = 1.0; body.add(cloud);
  const puffs = [];
  const P = [[0, 0, 0, 0.42], [0.35, 0.05, 0.1, 0.32], [-0.36, -0.02, -0.08, 0.34], [0.1, 0.3, -0.15, 0.3], [-0.15, 0.28, 0.18, 0.28],
    [0.2, -0.18, -0.28, 0.26], [-0.2, -0.2, 0.28, 0.26], [0.45, -0.15, -0.2, 0.22], [-0.48, 0.12, 0.2, 0.2], [0, 0.45, 0.05, 0.22], [0.05, -0.05, 0.4, 0.27], [-0.02, 0.0, -0.42, 0.27]];
  P.forEach(([x, y, z, r], i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), i % 4 === 3 ? shadeM : puffM);
    m.position.set(x, y, z); cloud.add(m); puffs.push({ m, r, ph: i * 1.3 });
  });
  const eyes = eyesOn(cloud, 0.4, 0.05, 0.12, 0.045);
  // 雲のひげ（下にたなびく小さな玉）
  const trail = [];
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.12 - i * 0.02, 12, 8), puffM); body.add(m); trail.push(m); }
  hero.scale.setScalar(1.3);
  let tm = 0;
  hero.userData = {
    body, sliceHatch: true,
    animate(dt, s) {
      tm += dt;
      const air = !s.grounded, sq = s.landT > 0 ? 1 - s.landT * 0.8 : 1;
      cloud.position.y = 1.0 + Math.sin(tm * 1.8) * 0.08 + (air ? 0.12 : 0);
      cloud.scale.set(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6);
      cloud.rotation.z = -Math.min(0.35, s.speed * 0.18);
      for (const p of puffs) p.m.scale.setScalar(1 + Math.sin(tm * 2.5 + p.ph) * 0.06 + (s.speed > 0.1 ? Math.sin(tm * 9 + p.ph) * 0.04 : 0));
      trail.forEach((m, i) => m.position.set(-0.45 - i * 0.22 * (0.4 + s.speed), 0.75 - i * 0.06 + Math.sin(tm * 3 + i) * 0.05, Math.sin(tm * 2 + i) * 0.08));
      for (const e of eyes) e.scale.y = (tm % 3.6) < 0.12 ? 0.2 : 1;
    },
  };
  return hero;
}

// ---------------- 風の精 ----------------
function makeWind() {
  const hero = new THREE.Group();
  const body = new THREE.Group();
  hero.add(body);
  const windM = new THREE.MeshStandardMaterial({ color: '#cfe4ea', roughness: 0.6, emissive: '#5c8a96', emissiveIntensity: 0.25 });
  const swirl = new THREE.Group(); swirl.position.y = 0.2; body.add(swirl);
  // うずの筋: 3本のらせんを、細い円柱の粒でつなぐ
  const segs = [];
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 22; i++) {
      const u = i / 22, a = u * Math.PI * 3.2 + k * Math.PI * 2 / 3;
      const r = 0.18 + u * 0.42, y = u * 1.6;
      const u2 = (i + 1) / 22, a2 = u2 * Math.PI * 3.2 + k * Math.PI * 2 / 3, r2 = 0.18 + u2 * 0.42, y2 = u2 * 1.6;
      const p1 = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), p2 = new THREE.Vector3(Math.cos(a2) * r2, y2, Math.sin(a2) * r2);
      const len = p1.distanceTo(p2);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035 + u * 0.02, 0.035 + u * 0.02, len, 6), windM);
      m.position.copy(p1).add(p2).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
      swirl.add(m); segs.push(m);
    }
  }
  // 顔のかわりの、小さな二つの光
  const eyeM = new THREE.MeshStandardMaterial({ color: '#2b3a40' });
  const head = new THREE.Group(); head.position.y = 1.55; body.add(head);
  for (const z of [-0.1, 0.1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), eyeM); e.position.set(0.25, 0, z); head.add(e); }
  // 舞う木の葉
  const leafM = new THREE.MeshStandardMaterial({ color: '#b98a3a', roughness: 0.8, side: THREE.DoubleSide });
  const leaves = [];
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.07, 5), leafM); body.add(l); leaves.push(l); }
  hero.scale.setScalar(1.3);
  let tm = 0, spin = 0;
  hero.userData = {
    body, sliceHatch: false,
    animate(dt, s) {
      tm += dt; spin += dt * (1.5 + s.speed * (s.run ? 7 : 4));
      const air = !s.grounded;
      swirl.rotation.y = spin;
      swirl.rotation.z = -Math.min(0.5, s.speed * 0.25);
      swirl.scale.set(1, s.landT > 0 ? 1 - s.landT * 0.6 : 1 + (air ? 0.15 : 0), 1);
      head.position.y = 1.55 + Math.sin(tm * 2) * 0.05;
      leaves.forEach((l, i) => {
        const a = tm * 3 + i * 2.1, r = 0.55 + Math.sin(tm + i) * 0.1;
        l.position.set(Math.cos(a) * r, 0.5 + i * 0.4 + Math.sin(tm * 2 + i) * 0.1, Math.sin(a) * r);
        l.rotation.set(tm * 4 + i, tm * 3, 0);
      });
    },
  };
  return hero;
}

export const HEROES = { poly: makePoly, star: makeStar, cloud: makeCloud, wind: makeWind, agate: makeAgate, hourglass: makeHourglass, crane: makeCrane, curator: makeCurator };
export const HERO_LIST = [
  { id: 'poly', name: '多面体の旅人' },
  { id: 'star', name: '星の精' },
  { id: 'cloud', name: '雲の精' },
  { id: 'wind', name: '風の精' },
  { id: 'agate', name: '瑪瑙の精' },
  { id: 'hourglass', name: '砂時計の精' },
  { id: 'crane', name: '折り鶴の精' },
  { id: 'curator', name: '学芸員' },
];
