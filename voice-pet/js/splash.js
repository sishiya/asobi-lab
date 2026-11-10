// 水しぶき: 足が水たまりや泥に着いた瞬間の、小さなしずく（ほんの少し。テストプレイ）。出ていないあいだは描かない
import * as THREE from 'three';
export function makeSplash(scene, n = 30) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }), n), P = Array.from({ length: n }, () => ({ t: 1, life: 0 })), M = new THREE.Matrix4(), WATER = new THREE.Color(0.8, 0.87, 0.9), MUD = new THREE.Color(0.17, 0.12, 0.08);
  mesh.frustumCulled = false; mesh.visible = false; for (let i = 0; i < n; i++) { mesh.setMatrixAt(i, M.makeScale(0, 0, 0)); mesh.setColorAt(i, WATER); } scene.add(mesh);
  let at = 0, last = 0;
  return {
    get live() { return P.filter(p => p.t < p.life).length; },
    // k＝強さ 0..1、water＝水（false なら泥）。全部の足あわせて 0.07 秒に1回まで
    emit(x, y, z, k, water) {
      const now = performance.now(); if (now - last < 70) return; last = now;
      for (let c = 3 + Math.round(k * 3); c > 0; c--) { const p = P[at], a = Math.random() * 6.283, s = 0.2 + Math.random() * 0.3; Object.assign(p, { t: 0, life: 0.26 + Math.random() * 0.14, x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 0.45 + Math.random() * 0.45, r: 0.005 + Math.random() * 0.005 }); mesh.setColorAt(at, water ? WATER : MUD); at = (at + 1) % n; }
      mesh.instanceColor.needsUpdate = true; mesh.visible = true;
    },
    step(dt) {
      if (!mesh.visible) return; let any = false;
      P.forEach((p, i) => { if (p.t >= p.life) { mesh.setMatrixAt(i, M.makeScale(0, 0, 0)); return; } any = true; p.t += dt; p.vy -= 6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const s = p.r * Math.max(0, 1 - p.t / p.life * 0.6); M.makeScale(s, s, s).setPosition(p.x, p.y, p.z); mesh.setMatrixAt(i, M); });
      mesh.instanceMatrix.needsUpdate = true; if (!any) mesh.visible = false;
    },
  };
}
