// 3D世界の主人公（設定で選ぶ）。ページと重なったところの断面が2D世界に出るので、断面の見え方も考えて作る
//   poly:      多面体の旅人。断面は形の変わる多角形
//   agate:     瑪瑙（めのう）の精。外は石、中は色の層。断面に、しま模様（地層のような輪）が出る
//   hourglass: 砂時計の精。ガラスの中の砂が、いる時間に合わせて落ちていく。断面に砂の形が出る
//   crane:     折り鶴の精。紙を折った体。断面は紙の色とインクの線で、銅版画になじむ
//   star:      星の精。とげ（円すい）を何本も組んだ体。断面は、とげの三角が集まった星の形
//   cloud:     雲の精。いくつもの球を集めた体。断面は、丸がつらなった雲の形
//   wind:      風の精。うずをまく細い筋の体。断面は、銅版画の風の筋のような短い線が弧にならぶ
//   jelly:     クラゲの精。かさと細い足。断面は弧と点々
//   top:       こまの精。円すいと円盤。歩くほど速く回る
//   balloon:   紙ふうせんの精。色紙を貼った角ばった玉
//   curator:   学芸員（実在の人に近い見た目）
// 断面はメッシュごとの凸包なので、星・雲・風は「小さな凸の部品の集まり」で作る
// userData.sliceHatch: 断面にハッチングの線をのせる（銅版画になじませる）
// userData.animate(dt, s) で動く。s = { speed(0〜), run, grounded, vy, carry, landT }
import * as THREE from 'three';
import { radialTexture } from './util.js?v=49';

// 言語（index.html の TX(日本語, 英語)。ノードでの試験のときは日本語）
const TX = globalThis.TX || ((ja) => ja);
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

// ---------------- 紙ふうせんの精 ----------------
// 紙を貼りあわせた角ばった玉。ふわふわと浮かぶ。断面は紙の色の多角形
function makeBalloon() {
  const hero = new THREE.Group();
  const body = new THREE.Group();
  hero.add(body);
  const cols = ['#e9c46a', '#e07a5f', '#81b29a', '#f4f1de', '#3d85a8'];
  const ball = new THREE.Group(); ball.position.y = 1.1; body.add(ball);
  const geo = new THREE.IcosahedronGeometry(0.55, 1).toNonIndexed();
  // 面ごとに紙の色を変える（色紙を貼りあわせたように）
  const colors = [];
  for (let i = 0; i < geo.attributes.position.count; i += 3) {
    const c = new THREE.Color(cols[(i / 3) % cols.length]);
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const paper = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
  ball.add(paper);
  ball.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#5a4330', transparent: true, opacity: 0.5 })));
  // 吹き口（小さな穴のふち）
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12), new THREE.MeshStandardMaterial({ color: '#5a4330' }));
  mouth.position.y = 0.55; mouth.rotation.x = Math.PI / 2; ball.add(mouth);
  const eyes = eyesOn(ball, 0.5, 0.05, 0.14, 0.05);
  hero.scale.setScalar(1.2);
  let tm = 0;
  hero.userData = {
    body, sliceHatch: true,
    animate(dt, s) {
      tm += dt;
      const air = !s.grounded, sq = s.landT > 0 ? 1 - s.landT * 0.9 : 1;
      ball.position.y = 1.1 + Math.sin(tm * 1.6) * 0.12 + (air ? 0.15 : 0);
      ball.scale.set(1 + (1 - sq) * 0.5, sq, 1 + (1 - sq) * 0.5);
      ball.rotation.set(Math.sin(tm * 0.9) * 0.2, tm * 0.4 + s.speed * 0.3, -Math.min(0.4, s.speed * 0.2));
      for (const e of eyes) e.scale.y = (tm % 3.8) < 0.12 ? 0.2 : 1;
    },
  };
  return hero;
}

// v034: 雲・風・瑪瑙・クラゲ・こま・学芸員はやめた（ユーザー「シンプル寄りに」）
export const HEROES = { hourglass: makeHourglass, poly: makePoly, star: makeStar, crane: makeCrane, balloon: makeBalloon };
export const HERO_LIST = [
  { id: 'hourglass', name: TX('砂時計の精', 'Hourglass Spirit') },
  { id: 'poly', name: TX('多面体の旅人', 'Polyhedron Traveler') },
  { id: 'star', name: TX('星の精', 'Star Spirit') },
  { id: 'crane', name: TX('折り鶴の精', 'Paper Crane Spirit') },
  { id: 'balloon', name: TX('紙ふうせんの精', 'Paper Balloon Spirit') },
];
