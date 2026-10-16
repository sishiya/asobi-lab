// 3D世界の主人公（設定で選ぶ）。どちらも 2D世界のセピアとちがう、はっきりした色
//   poly:    高い次元の存在「多面体の旅人」。宝石のような多面体がゆれながら進む。断面は形の変わる多角形になる
//   curator: 学芸員（実在の人に近い見た目）
// userData.animate(dt, s) で動く。s = { speed(0〜), run, grounded, vy, carry, landT }
import * as THREE from 'three';
import { radialTexture } from './util.js?v=13';

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

export const HEROES = { poly: makePoly, curator: makeCurator };
