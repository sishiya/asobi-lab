// 火の番の火トカゲ（2026-10-23 ユーザーが選んだ）。黒に黄色の斑点の小さなサンショウウオ（ファイアサラマンダーの色）
// 伝説の火トカゲ（サラマンダー）は、薪の中で冬眠していたサンショウウオが、火にくべられて這い出したのが始まりとも言われる
// 背骨を節の列にして、横にくねらせて歩く（本物のサンショウウオの歩き方）。火を見る・火が小さいと寄って丸くなる・くべると顔を上げる
import * as THREE from 'three';
import { H, FIRE } from './util.js';

const K = 1.6; // 島の上で見える大きさに（小屋の壁 0.75 に対して、体長 約0.75）
const N = 12, SEG = 0.04 * K; // 背骨の節（頭から尾の先まで）
const RADIUS = [0.034, 0.04, 0.042, 0.046, 0.047, 0.045, 0.04, 0.032, 0.025, 0.018, 0.012, 0.007].map(r => r * K); // 頭→胴→尾
export function makeSalamander(parent) {
  const g = new THREE.Group(); parent.add(g);
  const skin = new THREE.MeshStandardMaterial({ color: '#0d0b0a', roughness: 0.32, metalness: 0.05 });
  const spot = new THREE.MeshStandardMaterial({ color: '#f2b51c', roughness: 0.45, emissive: '#ffa21a', emissiveIntensity: 0.06 });
  const eye = new THREE.MeshStandardMaterial({ color: '#050404', roughness: 0.08 });
  const sph = new THREE.SphereGeometry(1, 16, 12);
  const segs = RADIUS.map((r, i) => { const m = new THREE.Mesh(sph, skin); m.scale.set(r * 1.25, r * 0.78, r); m.castShadow = true; g.add(m); return m; });
  // 斑点: 節ごとに左右へ。ばらつかせる
  const spots = [];
  for (let i = 1; i < N - 2; i++) for (const s of [-1, 1]) { if ((i * 7 + (s > 0 ? 3 : 0)) % 5 === 0) continue; const m = new THREE.Mesh(sph, spot); const r = RADIUS[i]; m.scale.set(r * 0.5, r * 0.22, r * 0.38); m.userData = { i, s, off: 0.35 + ((i * 13) % 5) * 0.06 }; g.add(m); spots.push(m); }
  for (const s of [-1, 1]) { const m = new THREE.Mesh(sph, spot); m.scale.set(0.02 * K, 0.012 * K, 0.018 * K); m.userData = { i: 0, s, off: 0.5, head: true }; g.add(m); spots.push(m); } // 耳の後ろの黄色（耳腺）
  const eyes = [-1, 1].map(s => { const m = new THREE.Mesh(sph, eye); m.scale.setScalar(0.012 * K); g.add(m); return { m, s }; });
  // 足: 前は2節め、後ろは5節め。ひじを曲げた2本の棒
  const leg = new THREE.CylinderGeometry(0.008 * K, 0.01 * K, 1, 6);
  const legs = [[2, -1], [2, 1], [5, -1], [5, 1]].map(([i, s], k) => { const a = new THREE.Mesh(leg, skin), b = new THREE.Mesh(leg, skin); a.castShadow = b.castShadow = true; g.add(a, b); return { i, s, a, b, ph: k === 0 || k === 3 ? 0 : Math.PI }; });

  const P = Array.from({ length: N }, () => new THREE.Vector3());
  const st = { ang: 0.9, target: 0.9, walk: 0, step: 0, look: 0, curl: 0, next: 4 };
  const v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function update(t, dt, { F, flare, lost }) {
    // いる場所: 火のまわりの輪の上。ときどき少し歩いて場所をかえる
    st.next -= dt;
    if (st.next <= 0 && !lost) { st.target = 0.3 + Math.random() * 1.2; /* 火の手前（カメラのはじめの向き）がわ。丸太のいす（2.2・4.1）をよける */ st.next = 6 + Math.random() * 7; }
    const d = st.target - st.ang, moving = Math.abs(d) > 0.02;
    st.walk += ((moving ? 1 : 0) - st.walk) * Math.min(1, dt * 4);
    st.ang += Math.sign(d) * Math.min(Math.abs(d), dt * 0.35);
    st.step += dt * (2 + 7 * st.walk);
    st.look += ((flare > 0.2 ? 1 : 0) - st.look) * Math.min(1, dt * 3);
    st.curl += ((F < 6 || lost ? 1 : 0) - st.curl) * Math.min(1, dt * 1.2);
    const r = 0.66 - 0.16 * st.curl; // 火が小さいと、火に寄る
    const hx = FIRE.x + Math.cos(st.ang) * r, hz = FIRE.z + Math.sin(st.ang) * r;
    // 体の向き: 歩くときは輪にそって、止まると火のほうを向く
    const toFire = Math.atan2(FIRE.z - hz, FIRE.x - hx), along = st.ang + Math.sign(d || 1) * Math.PI / 2;
    const yaw = toFire + (along - toFire) * st.walk * 0.85 + Math.sin(t * 0.4) * 0.15;
    const fx = Math.cos(yaw), fz = Math.sin(yaw), sx = -fz, sz = fx;
    // 背骨: 頭から後ろへ。横のうねり（歩くと大きく）と、火が小さいときの丸まり
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), wave = Math.sin(st.step - i * 0.75) * (0.006 + 0.022 * st.walk) * (0.4 + u);
      const bend = st.curl * u * u * 0.9; // 尾を体の横へ回す
      const back = i * SEG * (1 - st.curl * 0.25 * u);
      const x = hx - fx * back * Math.cos(bend) + sx * (wave + Math.sin(bend) * back * 0.6);
      const z = hz - fz * back * Math.cos(bend) + sz * (wave + Math.sin(bend) * back * 0.6);
      const breath = 1 + 0.04 * Math.sin(t * (1.6 - st.curl * 0.6)) * (i > 1 && i < 6 ? 1 : 0);
      P[i].set(x, H(x, z) + RADIUS[i] * 0.72 + (i === 0 ? (0.012 + st.look * 0.035) * K : 0) + (i === 1 ? st.look * 0.018 * K : 0), z);
      segs[i].position.copy(P[i]); segs[i].scale.set(RADIUS[i] * 1.25 * breath, RADIUS[i] * 0.78 * breath, RADIUS[i] * breath);
    }
    for (let i = 0; i < N; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)]; v.subVectors(a, b); segs[i].rotation.set(0, Math.atan2(-v.z, v.x), Math.atan2(v.y, Math.hypot(v.x, v.z))); }
    for (const m of spots) { const { i, s, off } = m.userData, p = P[i], rr = RADIUS[i]; const q = segs[i].rotation.y; m.position.set(p.x - Math.sin(q) * s * rr * off, p.y + rr * 0.55, p.z - Math.cos(q) * s * rr * off); m.rotation.y = q; }
    for (const { m, s } of eyes) { const p = P[0], q = segs[0].rotation.y; m.position.set(p.x + Math.cos(q) * 0.018 * K - Math.sin(q) * s * 0.022 * K, p.y + 0.02 * K, p.z - Math.sin(q) * 0.018 * K - Math.cos(q) * s * 0.022 * K); }
    // 足: 体のうねりと逆に、交互に前へ
    for (const L of legs) {
      const p = P[L.i], q = segs[L.i].rotation.y, ox = -Math.sin(q) * L.s, oz = -Math.cos(q) * L.s;
      const swing = Math.sin(st.step + L.ph) * 0.03 * K * st.walk, fwdx = Math.cos(q), fwdz = -Math.sin(q);
      const sh = new THREE.Vector3(p.x + ox * RADIUS[L.i] * 0.8, p.y, p.z + oz * RADIUS[L.i] * 0.8);
      const fx2 = sh.x + ox * 0.045 * K + fwdx * swing, fz2 = sh.z + oz * 0.045 * K + fwdz * swing, foot = new THREE.Vector3(fx2, H(fx2, fz2) + 0.004 + Math.max(0, Math.cos(st.step + L.ph)) * 0.012 * K * st.walk, fz2);
      const knee = sh.clone().lerp(foot, 0.5).add(new THREE.Vector3(ox * 0.012 * K, 0.022 * K, oz * 0.012 * K));
      for (const [m, a, b] of [[L.a, sh, knee], [L.b, knee, foot]]) { m.position.copy(a).lerp(b, 0.5); m.scale.set(1, a.distanceTo(b), 1); m.quaternion.setFromUnitVectors(up, v.subVectors(b, a).normalize()); }
    }
  }
  return { group: g, update, materials: [skin, spot, eye] };
}
