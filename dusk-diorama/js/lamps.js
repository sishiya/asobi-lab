// 灯を置く遊び（PLAN.md 2.9章）: 島に最初からある冷えた台（かがり台・軒のランタン掛け）に、たき火から分けた火種を置くと、約70秒ともる
// 灯はつぎ足しなし。置けるのは光のとどく台だけ。台の乗った塊が落ちると、灯ごと落ちる
import * as THREE from 'three';
import { H } from './util.js';
import { chunkIdAt } from './island.js';
import { LAMPS } from './render.js';

export const LAMP = { life: 70, flicker: 5, brazier: 1.9, lantern: 1.3, cliff: 2.7, cliffLife: 35 }; // cliff: 灯台の崖の台（PLAN.md 2.11。輪が大きく、短い） // life: v014 で 40 から（置き直しの手数を減らす。DEVNOTES）

function softTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,230,180,1)'); gr.addColorStop(0.25, 'rgba(255,150,60,.6)'); gr.addColorStop(1, 'rgba(255,100,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }

export function makeLamps(scene, isl, V, cliff = null) { // cliff: { parent（岸）, path（岸の上の台の場所） }
  const iron = V.M.iron, glowTex = softTex(), stands = [];
  const flameMat = () => new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
  // かがり台: 3本脚の鉄の皿
  function brazier(x, z, at) { // at: { parent, y } 岸の上（崖の台）
    const g = new THREE.Group(), y = at ? at.y : H(x, z); g.position.set(x, y, z); if (at) at.parent.add(g);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.62, 5), iron); leg.position.set(Math.cos(a) * 0.08, 0.3, Math.sin(a) * 0.08); leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); leg.castShadow = true; g.add(leg); }
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.1, 10, 1, true), iron); bowl.position.y = 0.62; bowl.material = iron; g.add(bowl);
    const coal = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), new THREE.MeshStandardMaterial({ color: '#1a1410', emissive: '#ff5a1a', emissiveIntensity: 0, roughness: 1 })); coal.rotation.x = -Math.PI / 2; coal.position.y = 0.6; g.add(coal);
    return add(g, x, z, at ? 'cliff' : 'brazier', new THREE.Vector3(0, 0.72, 0), coal);
  }
  // 軒のランタン掛け: 小屋の壁から腕を出して、吊るす
  function lantern(house) {
    const g = new THREE.Group(), arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.22), iron); arm.position.set(0, 0.62, 0.56); g.add(arm);
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.09), new THREE.MeshStandardMaterial({ color: '#1a1410', emissive: '#ff8a3a', emissiveIntensity: 0, roughness: 0.6 })); cage.position.set(0, 0.52, 0.66); g.add(cage);
    house.g.add(g); house.g.updateMatrixWorld(true);
    const p = cage.getWorldPosition(new THREE.Vector3());
    return add(g, p.x, p.z, 'lantern', cage.position.clone().add(new THREE.Vector3(0, 0.02, 0)), cage, house);
  }
  function add(g, x, z, kind, flameAt, glowMesh, house) {
    if (!house && !g.parent) { const c = isl.all[Math.max(0, chunkIdAt(x, z))]; c.group.add(g); }
    const fl = new THREE.Sprite(flameMat()); fl.position.copy(flameAt); fl.scale.setScalar(0.4); g.add(fl);
    const steam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#8a8580', depthWrite: false, transparent: true, opacity: 0 })); steam.position.copy(flameAt); g.add(steam); // 雨でじゅっと上がる湯気
    const s = { id: stands.length, g, x, z, kind, r: LAMP[kind], fl, glowMesh, house, life: 0, slot: stands.length, flameAt: flameAt.clone(), steam, ox: 0, oz: 0, lean: 0, wet: 0, rMul: 1, burnMul: 1 };
    g.traverse(o => { if (o.isMesh) o.userData.stand = s.id; }); stands.push(s); return s;
  }
  brazier(-2.6, 0.2); brazier(0.9, 3.1); brazier(3.0, 0.6); brazier(-0.7, -1.5); brazier(1.6, -2.6);
  for (const h of V.houses) lantern(h);
  if (cliff) for (const p of cliff.path) { const s = brazier(p.x, p.z, { parent: cliff.parent, y: p.y }); Object.assign(s, { x: 1e4, z: 1e4, local: p, afterGully: p.afterGully, windy: p.windy, last: p.last }); } // 崖の場面まで遠くへ（島の台とまちがえない）。場所は game.js が毎こま入れる
  // 灯の光（点の光は数を変えると描き直しになるので、はじめから台の数だけ用意する）
  const lights = stands.map(s => { if (s.kind === 'cliff') return null; /* 崖の台は点の光なし（光の数をふやすと重い） */ const L = new THREE.PointLight('#ff9a4a', 0, 4, 2); L.position.copy(s.fl.position); s.g.add(L); return L; });
  // 運んでいる火種
  const ember = new THREE.Sprite(flameMat()); ember.scale.setScalar(0.35); ember.visible = false; scene.add(ember);
  const emberLight = new THREE.PointLight('#ffa050', 0, 3, 2); scene.add(emberLight);

  // 灯の光の中心と半径（風にあおられると風下へずれ、雨にぬれると小さく。game.js が毎こま ox・oz・rMul・burnMul を入れる）
  const cx = s => s.x + s.ox, cz = s => s.z + s.oz, rad = s => s.r * s.rMul;
  const fallen = s => { let o = s.g; while (o) { if (o.userData.fallen) return true; o = o.parent; } const c = isl.all[Math.max(0, chunkIdAt(s.x, s.z))]; return !s.house && c.fallen || (s.house && s.house.g.userData.fallen); };
  function update(t, dt, U) {
    for (const s of stands) {
      if (s.life > 0) { s.life = Math.max(0, s.life - dt * (s.burnMul || 1)); if (fallen(s)) s.life = 0; }
      const on = s.life > 0, fl = s.life < LAMP.flicker && on ? 0.5 + 0.5 * Math.sin(t * 30 + s.id) * Math.sin(t * 13) : 1, k = on ? fl : 0;
      const blow = s.lean ? 0.75 + 0.25 * Math.sin(t * 23 + s.id * 3) * Math.sin(t * 7) : 1; // 吹かれた灯はばたつく
      s.fl.material.opacity = k * blow * (s.wet ? 0.7 : 1); s.fl.scale.setScalar((s.kind === 'lantern' ? 0.32 : 0.55) * (0.9 + 0.1 * Math.sin(t * 9 + s.id)) * s.rMul);
      // 炎を風下へ寝かせる（台の向きによらず、世界の向きで）
      const base = s.g.localToWorld(s.flameAt.clone()); base.x += s.ox * 0.18; base.z += s.oz * 0.18; base.y -= 0.04 * s.lean; s.fl.position.copy(s.g.worldToLocal(base));
      if (lights[s.id]) { lights[s.id].intensity = (s.kind === 'brazier' ? 9 : 5) * k * blow * s.rMul; lights[s.id].distance = rad(s) * 2.2; }
      // 雨の湯気: ぬれた灯の上に、灰色のもやが上がっては消える
      const sp = (t * 0.7 + s.id * 0.37) % 1; s.steam.material.opacity = on && s.wet ? 0.35 * Math.sin(sp * Math.PI) : 0; s.steam.position.copy(s.flameAt).setY(s.flameAt.y + 0.1 + sp * 0.45); s.steam.scale.setScalar(0.2 + sp * 0.35);
      // 冷えた台も、皿にかすかな火の色（ここに置ける、と分かるように）。火種を運んでいるあいだ、ともせる台は脈打つ
      const cold = 0.12 + 0.08 * Math.sin(t * 2 + s.id) + (s.hint ? 0.5 + 0.4 * Math.sin(t * 6) : 0);
      if (s.glowMesh.material.emissiveIntensity !== undefined) s.glowMesh.material.emissiveIntensity = on ? 1.4 * k : cold;
      if (!on && s.hint) { s.fl.material.opacity = 0.25 + 0.2 * Math.sin(t * 6); }
      if (s.id < LAMPS) U[s.id].set(cx(s), cz(s), rad(s), on ? 1 : 0); // ランタンの g は家の中心にあるので、台の位置（s.x, s.z）で
    }
  }
  // 光のとどく範囲: たき火（cx,cz,R）と、ついている灯
  function lit(x, z, fire) {
    if (Math.hypot(x - fire.x, z - fire.z) < fire.r) return true;
    return stands.some(s => s.life > 0 && Math.hypot(x - cx(s), z - cz(s)) < rad(s));
  }
  function canLight(s, fire) { return s.life <= 0 && !fallen(s) && (lit(s.x, s.z, { ...fire, r: fire.r + 0.8 }) || stands.some(o => o !== s && o.life > 0 && Math.hypot(cx(o) - s.x, cz(o) - s.z) < rad(o) + 0.6)); }
  function ignite(s) { s.life = s.kind === 'cliff' ? LAMP.cliffLife : LAMP.life; }
  // 塊ごとの光までの近さ: 光の中なら負（たき火と灯のうち、いちばん守ってくれるもの）
  function shelter(c) { let best = 1e9; for (const s of stands) if (s.life > 0) best = Math.min(best, Math.hypot(c.cx - cx(s), c.cz - cz(s)) - 0.45 * c.rad - rad(s)); return best; }
  return { stands, update, lit, canLight, ignite, shelter, ember, emberLight, fallen };
}
