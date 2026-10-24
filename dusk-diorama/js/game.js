// 夜明けまでの島（段階A）: つまんで火にくべる。輪の外の島は崩れて落ちる。夜明けに何が残ったか
import * as THREE from 'three';
import { rng, H, FIRE } from './util.js';
import { RULE, BURN, WEATHER, NIGHTS, lightRadius, stepFire, stepChunk, darkness } from './rules.js';
import { textures } from './tex.js';
import { buildIsland, chunkIdAt } from './island.js';
import { buildVillage } from './village.js';
import { makeRenderer, patchDark, DARK, LAMPS } from './render.js';
import { makeFx } from './fx.js';
import { makeSalamander } from './creature.js';
import { makeLamps, LAMP } from './lamps.js';
import { makeShore, coast, PIER_LEN } from './shore.js';
import { mountAudioPanel, startAudio, sfx, tickAudio } from './audio.js';

const $ = id => document.getElementById(id);
const R3 = makeRenderer($('c'));
const { scene, camera, view } = R3;
const TX = textures(rng);
const isl = buildIsland(scene, TX);
const V = buildVillage(scene, isl, TX);
const fx = makeFx(scene);
const C0 = isl.chunks.find(c => c.fixed);
for (const o of fx.fireParts) C0.group.attach(o); // たき火は火の番の岩（まん中の塊）の上
const sal = makeSalamander(C0.group); // 火の番の火トカゲ
const SHORE = makeShore(TX), shore = SHORE.group; shore.visible = false; scene.add(shore); // 夜明けの岸（js/shore.js）。崖の台を灯のしくみに入れるので、先に作る
const L = makeLamps(scene, isl, V, { parent: shore, path: SHORE.path }); // 台と灯（PLAN.md 2.9章）。崖の台（kind 'cliff'）は岸の上
const salLight = new THREE.PointLight('#ff9a4a', 0, 1.4, 2); C0.group.add(salLight); // 闇へ連れていった火トカゲの光
const SAL = { mode: 'home', t: 0, k: 0, saved: false }; // mode: home（火のそば）・go（歩いていく）・rest（丸くなって照らす）・back（帰る）・save（おき火に入る）
// 夜明けの岸（js/shore.js）: 第5夜に行く先の闇の底からせり上がり、夜明けに桟橋が島のふちまで寄ってくる。うしろに朝の光
{ const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: '#ffe8cc', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  glow.scale.set(160, 60, 1); glow.position.set(0, 14, -70); shore.add(glow); shore.userData.glow = glow; }
scene.traverse(o => { if (o.isMesh || o.isInstancedMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(patchDark); });
// 闇に沈めない物（遠くの灯台と次の空）は、このあとで足す
// 行く先の灯台（PLAN.md 2.9章）: 前の地平線の光の点。夜ごとに近く大きく、第4夜から光が回り、第5夜は岸の上に立つ
const AHEAD = { x: -Math.sin(0.85), z: -Math.cos(0.85) }; // 行く先の方角（はじめのカメラの向こう、礼拝堂の塔に重ならないよう少し左）
const softTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#ffe6b8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); scene.add(beacon);
// 回る光の筋（第4夜から）: 灯台から横へのびる細い板
const beamTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 32; const x = c.getContext('2d'), gx = x.createLinearGradient(0, 0, 256, 0); gx.addColorStop(0, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gx; x.fillRect(0, 0, 256, 32); const gy = x.createLinearGradient(0, 0, 0, 32); gy.addColorStop(0, 'rgba(0,0,0,1)'); gy.addColorStop(0.5, 'rgba(0,0,0,0)'); gy.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = gy; x.fillRect(0, 0, 256, 32); return new THREE.CanvasTexture(c); })(); // 根もとが明るく、先へ消える
const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, color: '#ffe0a8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
const beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0), beamMat); scene.add(beam);
// 夜の切れ目に見える、次の空（雨の幕・岩の柱・霧の壁・白い灰）。島はそこへ入っていく
const nextSky = (() => {
  const g = new THREE.Group(); g.position.set(AHEAD.x * 95, -44, AHEAD.z * 95); g.rotation.y = 0.85; scene.add(g);
  const streak = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d'); for (let i = 0; i < 90; i++) { x.strokeStyle = `rgba(200,200,210,${0.1 + Math.random() * 0.25})`; x.lineWidth = 1; const px = Math.random() * 128; x.beginPath(); x.moveTo(px, 0); x.lineTo(px - 6, 256); x.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 2); return t; })(); // 細かい筋に
  const mask = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#888'); gr.addColorStop(1, '#000'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })(); // ふちをぼかす（四角い幕に見えないように）
  const mk = (map, color, blend) => new THREE.MeshBasicMaterial({ map, alphaMap: mask, color, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: blend || THREE.NormalBlending, side: THREE.DoubleSide });
  const rain = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), mk(streak, '#9a9aa8')); g.add(rain);
  const fog = new THREE.Mesh(new THREE.PlaneGeometry(110, 40), mk(softTex, '#d8c8bc')); fog.scale.set(1, 0.6, 1); g.add(fog);
  const snow = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), mk(streak, '#ffffff', THREE.AdditiveBlending)); snow.rotation.z = 0.6; g.add(snow);
  const rockM = new THREE.MeshBasicMaterial({ color: '#3a221c', transparent: true, opacity: 0, fog: true }), pillars = new THREE.Group(); pillars.scale.setScalar(0.45); pillars.position.set(0, -6, -40); g.add(pillars); // 遠くの岩の柱（霧にかすむ）
  for (let i = 0; i < 7; i++) { const h = 30 + Math.random() * 30, p = new THREE.Mesh(new THREE.CylinderGeometry(1.5 + Math.random() * 2, 3 + Math.random() * 3, h, 6), rockM); p.position.set((i - 3) * 11 + Math.random() * 4, h / 2 - 30, (Math.random() - 0.5) * 8); pillars.add(p); }
  const by = { rain: [rain.material], wind: [rockM], fog: [fog.material], snow: [snow.material] };
  return { g, set(id, k) { for (const [key, ms] of Object.entries(by)) for (const m of ms) m.opacity = key === id ? k * (key === 'wind' ? 0.55 : key === 'snow' ? 0.3 : 0.4) : 0; } };
})();
// 先を行く舟島（第1夜だけ）: 村人をのせた小さな浮き島が、灯をともして行く先へ遠ざかる
const leadBoat = (() => {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#1a0e0b', fog: true });
  const rock = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.5, 6), m); rock.rotation.x = Math.PI; rock.position.y = -2.25; g.add(rock);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.2, 0.4, 7), m); g.add(top);
  for (const [x, z, s] of [[-0.6, 0.2, 1], [0.7, -0.3, 0.8]]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.7 * s, 0.7 * s), m); h.position.set(x, 0.55 * s, z); g.add(h); const rf = new THREE.Mesh(new THREE.ConeGeometry(0.75 * s, 0.6 * s, 4), m); rf.position.set(x, 1.2 * s, z); rf.rotation.y = Math.PI / 4; g.add(rf); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#ffb060', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); glow.position.set(0.1, 1, 0.6); glow.scale.setScalar(2.2); g.add(glow);
  g.visible = false; scene.add(g); return { g, glow };
})();
function stepBoat(now) {
  const on = st.night === 1 && st.phase !== 'title'; leadBoat.g.visible = on; if (!on) return;
  const k = Math.min(1, st.t / RULE.night), d = 45 + 50 * k; // 夜のあいだに、少しずつ先へ
  leadBoat.g.position.set(AHEAD.x * d + Math.sin(now / 3000) * 0.5, -0.32 * d + Math.sin(now / 1700) * 0.4, AHEAD.z * d);
  leadBoat.glow.material.opacity = 0.75 + 0.25 * Math.sin(now / 400) * Math.sin(now / 170);
}
// 岸の置き場所: k = 夜の進み（0〜1）、a = 着く動き（0〜1。夜明けの数秒で桟橋の先が島のふちへ）
const ARRIVE = 6.2 + PIER_LEN + coast(0); // 桟橋の先が、島のふち（半径 約6.2）に着く
function placeShore(k, a) {
  // 夜のあいだは小さく遠い影（大きいまま遠くに置くと、霧で黒い壁になって空をふさいだ。日食より手前にも出た）。着くときに原寸へ
  const e = a * a * (3 - 2 * a), dN = 110 - 30 * k, d = dN * (1 - e) + ARRIVE * e, y = -0.4 * dN * (1 - e) + (-0.15) * e;
  shore.position.set(AHEAD.x * d, y, AHEAD.z * d); shore.scale.setScalar((0.3 + 0.25 * k) * (1 - e) + e); SHORE.fade(e); shore.rotation.y = Math.atan2(-AHEAD.x, -AHEAD.z); // 海岸（+z）を島に向ける
}
function stepBeacon(now) {
  const n = st.night, last = n >= NIGHTS;
  if (last && shore.visible) { const p = SHORE.lamp.clone(); shore.localToWorld(p); beacon.position.copy(p); } // 岸の崖の上の灯台
  else { const d = 150 - n * 14; beacon.position.set(AHEAD.x * d, -0.42 * d, AHEAD.z * d); } /* はじめのカメラで、画面の上の方に見える高さ */
  const turn = n >= 4 ? now / 1000 * 0.9 : 0, toCam = Math.atan2(beacon.position.z, -beacon.position.x), flash = n >= 4 ? Math.max(0, Math.cos(turn - toCam)) ** 6 : 0; // こちらを向くと、ぱっと明るい
  beacon.scale.setScalar((0.6 + n * 0.3) * (1 + flash * 1.2) * (0.92 + 0.08 * Math.sin(now / 300)));
  beacon.material.opacity = (0.55 + 0.45 * flash) * (1 - st.dawnK * 0.5);
  const off = n >= NIGHTS ? (st.cliff ? (st.cliff.lit ? 0 : 1) : st.phase === 'dawn' ? st.arrive : 0) : 0; // 岸に着くと灯台の火は尽きる。崖の場面で火トカゲがともし直す
  beacon.material.opacity *= 1 - off; SHORE.setLighthouse(1 - off);
  // 光の筋: 第4夜は遠くで回り、第5夜は夜の終わりに島をとらえる
  beam.visible = n >= 4; if (!beam.visible) return;
  const toIsl = Math.atan2(beacon.position.z, -beacon.position.x), catchK = last && st.cliff && st.cliff.lit ? 1 : last ? Math.min(1, Math.max(0, (st.t / RULE.night - 0.75) / 0.2)) : 0;
  const dA = Math.atan2(Math.sin(toIsl - turn), Math.cos(toIsl - turn)), a = turn + dA * catchK, len = beacon.position.length() * 1.05;
  beam.position.copy(beacon.position); beam.rotation.set(0, 0, 0); beam.rotateY(a); beam.rotateX(Math.PI / 2); beam.rotateZ(0); beam.scale.set(len * (0.6 + 0.4 * catchK), 0.8 + catchK * 2, 1);
  beamMat.opacity = (0.03 + 0.06 * flash + 0.12 * catchK) * (st.cliff && st.cliff.lit ? 1 : 1 - st.dawnK) * (1 - off);
}
mountAudioPanel();
const fireY = H(FIRE.x, FIRE.z);
DARK.uFire.value.set(FIRE.x, fireY, FIRE.z);
for (const c of isl.chunks) c.dist = Math.max(0, Math.hypot(c.cx - FIRE.x, c.cz - FIRE.z) - 0.45 * c.rad);
const totalArea = isl.chunks.reduce((s, c) => s + c.quads.length, 0);

// ── 状態 ──
const st = { W: WEATHER[0], night: 1, t: 0, F: RULE.fuel0, burning: [], out: 0, phase: 'title', shownR: lightRadius(RULE.fuel0), dawnK: 0, burnedAny: false, returns: [] };
let carry = null, hover = null, hoverFlame = false, hoverSal = false, hoverStand = null; // hoverFlame: マウスが炎の上（火種をつまめる）
const loose = []; // 島の外へ落とした物

// ── 運ぶ物の目じるし（いまやること1つだけ脈打つ） ──
const glint = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,220,160,1)'); gr.addColorStop(0.3, 'rgba(255,150,60,.5)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true })); s.renderOrder = 10; s.visible = false; scene.add(s); return s; })();
// くべる場所の輪（運んでいるあいだだけ）
// 火トカゲを運ぶ先の輪（置いたら照らす広さ）
const salRing = new THREE.Mesh(new THREE.RingGeometry(RULE.salR - 0.05, RULE.salR, 48), new THREE.MeshBasicMaterial({ color: '#ffcf70', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
salRing.rotation.x = -Math.PI / 2; salRing.renderOrder = 9; scene.add(salRing);
// 割れ目の輪（崖の場面で物を運んでいるあいだだけ。ここで放すと橋板）
const gullyRing = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.35, 48), new THREE.MeshBasicMaterial({ color: '#ffb060', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
gullyRing.rotation.x = -Math.PI / 2; gullyRing.renderOrder = 9; scene.add(gullyRing);
const dropRing = new THREE.Mesh(new THREE.RingGeometry(RULE.dropR - 0.06, RULE.dropR, 48), new THREE.MeshBasicMaterial({ color: '#ffb060', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
dropRing.rotation.x = -Math.PI / 2; dropRing.position.set(FIRE.x, fireY + 0.08, FIRE.z); dropRing.renderOrder = 9; scene.add(dropRing);

function centerOf(obj) { const b = new THREE.Box3().setFromObject(obj); return b.getCenter(new THREE.Vector3()).setY(b.max.y); }
// はじめの案内: 火から少し離れた乾いた物（運ぶ動きが見えるように。火のすぐそばの物は案内が火に重なる）
function nearestBurnable() { let best = null, bd = 1e9; for (const b of V.burnables) { if (b.burned || b.lost || b.carried || b.house || b.kind !== 'dry') continue; const p = centerOf(b.obj), d = Math.hypot(p.x - FIRE.x, p.z - FIRE.z); if (d > 1.3 && d < bd) { bd = d; best = b; } } return best; }

// ── 入力: 燃える物を押せばつまむ、ほかは島を回す ──
const cv = $('c'), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pointers = new Map();
let rotating = false, idle = 0;
function pickAt(e, near = true) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(scene.children, true);
  for (const h of hits) { const id = h.object.userData.bid; if (id === undefined) { if (h.object.isMesh && !h.object.userData.nopick && !h.object.material.transparent && h.object.visible) break; continue; } const b = V.burnables[id]; if (!b.burned && !b.lost) return b; }
  if (!near) return null;
  // 当たらなくても、押した所の近く（指の太さ 40px）にあればつまむ
  let best = null, bd = st.cliff ? 56 : 40; // 崖の場面は引いた画面なので、指の太さを広めに
  for (const b of V.burnables) { if (b.burned || b.lost || b.carried) continue; const p = centerOf(b.obj).project(camera); if (p.z > 1) continue; const d = Math.hypot((p.x * 0.5 + 0.5) * innerWidth - e.clientX, (-p.y * 0.5 + 0.5) * innerHeight - e.clientY); if (d < bd) { bd = d; best = b; } }
  return best;
}
function groundAt(e) {
  const lift = e.pointerType === 'touch' ? 55 : 0; // 指で隠れないよう、指の少し上に
  ndc.set(e.clientX / innerWidth * 2 - 1, -((e.clientY - lift) / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  // 視線を上（高さ3）から下（-1）へたどり、地面をこえた所を2分して詰める（平面のやり直しでは、丘の上で手前にずれた）
  const o = ray.ray.origin, d = ray.ray.direction, at = t => o.clone().addScaledVector(d, t), above = t => { const q = at(t); return q.y - groundY(q.x, q.z); };
  let t0 = (3 - o.y) / d.y, t1 = (-1 - o.y) / d.y;
  for (let i = 1; i <= 48; i++) { const t = t0 + (t1 - t0) * i / 48; if (above(t) < 0) { t1 = t; break; } t0 = t; }
  for (let i = 0; i < 16; i++) { const t = (t0 + t1) / 2; if (above(t) < 0) t1 = t; else t0 = t; }
  return at(t1);
}
cv.addEventListener('pointerdown', e => {
  if (st.phase !== 'play') return;
  cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); idle = 0;
  // 崖の場面: ともった台からも火種を分ける（前の台から次の台へ、短く運べる。たき火まで戻らなくてよい）
  const ls = pointers.size === 1 && !carry ? litStandAt(e) : null;
  if (ls) { ls.life -= RELAY; carry = { ember: true, p: groundAt(e), from: ls }; L.ember.visible = true; st.tookEmber = true; sfx('sfx-flare2', 0.3, 1.6); cv.classList.add('carry'); return; }
  // 火トカゲをつまむ = 闇へ連れていく（体の 34px）。火のそばにいるときだけ
  if (pointers.size === 1 && !carry && !pickAt(e, false) && nearSal(e)) { carry = { sal: true, p: groundAt(e) }; sfx('sfx-pick', 0.4, 1.4); cv.classList.add('carry'); return; }
  // 炎をつまむ = 火種を分ける（炎の芯の 44px）
  if (pointers.size === 1 && !carry && !pickAt(e, false) && nearFlame(e)) { // 燃える物をじかに押したときは、炎より物
    if (st.F < RULE.emberMin) { fx.crumbs(FIRE.x, fireY + 0.3, FIRE.z, 6, 0.3); sfx('sfx-pick', 0.3, 0.6); return; } // 小さい火は分けられない（すくむ）
    st.F -= RULE.emberCost; carry = { ember: true, p: groundAt(e) }; L.ember.visible = true; st.tookEmber = true;
    sfx('sfx-flare2', 0.35, 1.5); cv.classList.add('carry'); return;
  }
  const b = pointers.size === 1 ? pickAt(e) : null;
  if (b) {
    carry = { b, home: b.obj.parent, p: groundAt(e) }; b.carried = true;
    if (b.boardOf) { b.boardOf.board = null; b.boardOf = null; } // 風よけから外す
    if (b.bridge) { b.bridge = false; st.cliff.bridge = null; } // 橋板を外す
    scene.attach(b.obj); carry.lift = 0;
    const box = new THREE.Box3().setFromObject(b.obj); carry.off = b.obj.position.clone().sub(box.getCenter(new THREE.Vector3())).setY(b.obj.position.y - box.min.y);
    b._off = carry.off;
    sfx('sfx-pick', 0.7, 0.9 + Math.random() * 0.2); cv.classList.add('carry');
  } else rotating = true;
});
cv.addEventListener('pointermove', e => {
  const prev = pointers.get(e.pointerId);
  if (!prev) {
    if (e.pointerType === 'mouse' && st.phase === 'play') { hoverStand = litStandAt(e); hoverSal = !hoverStand && nearSal(e); hover = hoverSal || hoverStand ? null : pickAt(e, false); hoverFlame = !hoverStand && !hoverSal && !hover && nearFlame(e); if (!hoverStand && !hoverSal && !hover && !hoverFlame) hover = pickAt(e); cv.style.cursor = hoverStand || hoverSal || hover || (hoverFlame && st.F >= RULE.emberMin) ? 'grab' : hoverFlame ? 'not-allowed' : ''; } // 押したときと同じ順（じかに当たった物 → 炎 → 近くの物）
    return;
  }
  if (pointers.size === 2) { const [a, b] = [...pointers.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); const [c, d] = [...pointers.values()]; view.zoom = THREE.MathUtils.clamp(view.zoom * d0 / Math.max(1, Math.hypot(c.x - d.x, c.y - d.y)), 0.45, 1.5); return; }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (carry) { carry.p = groundAt(e); carry.e = { clientX: e.clientX, clientY: e.clientY }; return; }
  if (rotating) { view.az -= (e.clientX - prev.x) * 0.006; view.el = THREE.MathUtils.clamp(view.el + (e.clientY - prev.y) * 0.004, 0.15, 1.2); }
});
function release(e) {
  pointers.delete(e.pointerId); hover = null; hoverFlame = false; hoverSal = false; hoverStand = null;
  if (pointers.size) return;
  rotating = false; cv.classList.remove('carry');
  if (!carry) return;
  if (carry.ember) { dropEmber(carry.p, e); carry = null; return; }
  if (carry.sal) { sendSal(carry.p); carry = null; return; }
  const { b, p } = carry; carry = null; b.carried = false;
  if (st.phase !== 'play') { putDown(b, p); return; }
  if (Math.hypot(p.x - FIRE.x, p.z - FIRE.z) < RULE.dropR) burn(b);
  else if (st.cliff && !st.cliff.bridge && !(b.house && b.house.roof === b) && gullyDist(p) < 1.4) placeBridge(b); // 割れ目に渡す橋板（屋根のほかは何でも。梁・荷車・丸太だけでは、つまみまちがえると分からなかった）
  else if (!(b.board && leanBoard(b, standNear(p)))) putDown(b, p);
}
cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);
cv.addEventListener('wheel', e => { e.preventDefault(); view.zoom = THREE.MathUtils.clamp(view.zoom * Math.exp(e.deltaY * 0.001), 0.45, 1.5); idle = 0; }, { passive: false });

function putDown(b, p) {
  const id = chunkIdAt(p.x, p.z), c = id >= 0 ? isl.all[id] : null;
  if ((!c || c.fallen) && st.cliff && onShore(p)) { b.obj.position.set(p.x + carry0(b).x, groundY(p.x, p.z) + carry0(b).y, p.z + carry0(b).z); shore.attach(b.obj); return; } // 崖の場面: 岸の上にも置ける
  if (!c || c.fallen) { b.lost = true; loose.push({ obj: b.obj, v: 0 }); return; } // 島の外 → 奈落へ
  b.obj.position.set(p.x + carry0(b).x, H(p.x, p.z) + carry0(b).y, p.z + carry0(b).z);
  c.group.attach(b.obj); b.obj.userData.chunks = new Set([id]); V.onChunk[id].push(b.obj);
}
const carry0 = b => b._off || (b._off = new THREE.Vector3());
function burn(b) {
  b.burned = true; st.burnedAny = true;
  const B = BURN[b.kind], wet = st.W.wet && !underRoof(b);
  // 雨の夜: 外に出ていた薪はしけて、燃料が少なく、ゆっくりくすぶる
  st.burning.push(wet ? { left: b.fuel * 0.8, total: b.fuel * 0.8, secs: B.secs * 3, smoke: 1 } : { left: b.fuel, total: b.fuel, secs: B.secs, smoke: B.smoke });
  // くべる動き: 火の上で小さくなって消える
  sinking.push({ obj: b.obj, t: 0 });
  fx.burst(Math.min(1.3, b.fuel / 9)); R3.grade.uniforms.flash.value = Math.min(0.12, 0.03 + b.fuel / 200);
  sfx(Math.random() < 0.5 ? 'sfx-flare' : 'sfx-flare2', 0.6 + Math.min(0.4, b.fuel / 40));
  if (b.rootChunk !== undefined) { const c = isl.all[b.rootChunk]; c.root = false; c.s = Math.max(0.05, c.s - RULE.rootShock); shake.push({ c, t: 0.6 }); } // 根がなくなる
  if (b.house && b.house.roof === b) b.house.roofless = true;
  $('hint').hidden = true;
  showToast(wet ? `しけた${b.name}は、くすぶる` : `${b.name}をくべた`);
}
const sinking = [], shake = [];
const scrDist = (v, e) => { const p = v.clone().project(camera); return Math.hypot((p.x * 0.5 + 0.5) * innerWidth - e.clientX, (-p.y * 0.5 + 0.5) * innerHeight - e.clientY); };
const salDist = e => { if (SAL.mode !== 'home' || st.phase !== 'play' || demo) return 1e9; const p = sal.body().clone(); C0.group.localToWorld(p); return scrDist(p, e); };
const flameDist = e => scrDist(new THREE.Vector3(FIRE.x, fireY + 0.35, FIRE.z), e);
// 火トカゲは火のすぐそばにいるので、炎と近いほうを選ぶ
function nearSal(e) { const d = salDist(e); return d < 34 && d < flameDist(e); }
// 火トカゲを送る: たき火から火種をくわえていく（火種と同じだけ火が減る）。島の上で、火から少し離れた所だけ
const salOk = p => { const id = chunkIdAt(p.x, p.z); return (id >= 0 && !isl.all[id].fallen || st.cliff && onShore(p)) && Math.hypot(p.x - FIRE.x, p.z - FIRE.z) >= 1.2; }; // 崖の場面では岸の上へも
function sendSal(p) {
  if (!salOk(p)) return;
  if (st.F < RULE.emberMin) { fx.crumbs(FIRE.x, fireY + 0.3, FIRE.z, 6, 0.3); sfx('sfx-pick', 0.3, 0.6); return; } // 小さい火からは、くわえていけない
  st.F -= RULE.emberCost; st.sentSal = true; goSal(p); sfx('sfx-flare2', 0.3, 1.7);
}
function goSal(p) { SAL.mode = 'go'; SAL.t = 0; SAL.goal = { x: p.x, z: p.z }; SAL.lit = false; SAL.route = salRoute(SAL.goal); sal.ctl.goal = SAL.route.shift(); sal.ctl.curl = false; sal.ctl.speed = SAL.route.length ? 1.6 : 1; }
// 火トカゲの道すじ: 崖の場面で島と岸を行き来するときは、桟橋の先 → 崖の道（台のわき）をたどる（まっすぐ行くと、島と岸のすき間の宙を歩いた）
function shoreWay() { const L0 = SHORE.path.map(p => p.pier ? { x: 0, z: p.z } : { x: p.x, z: p.z - 0.4 }); return [{ x: 0, z: coast(0) + PIER_LEN - 0.15 }, ...L0].map(q => shore.localToWorld(new THREE.Vector3(q.x, 0, q.z))); }
const nearWay = (W, p) => W.reduce((b, q, i) => Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(W[b].x - p.x, W[b].z - p.z) ? i : b, 0);
function salRoute(dest) {
  if (!st.cliff) return [dest];
  const here = salPos(), onIsl = !onShore(here), toIsl = !onShore(dest); if (onIsl && toIsl) return [dest];
  const W = shoreWay(), i0 = onIsl ? 0 : nearWay(W, here), i1 = toIsl ? 0 : nearWay(W, dest), way = [];
  for (let i = i0; i !== i1; i += i1 > i0 ? 1 : -1) way.push(W[i]); way.push(W[i1]);
  return [...way, dest];
}
function salPos() { const p = sal.head().clone(); C0.group.localToWorld(p); return p; }
function stepSal(dt) {
  SAL.t += dt; const lp = salPos();
  if (SAL.mode === 'go') { SAL.k += (0.35 - SAL.k) * Math.min(1, dt * 3); if (sal.arrived && SAL.t > 0.4 && SAL.route.length) { sal.ctl.goal = SAL.route.shift(); SAL.t = 0; } /* 道すじの次へ */ else if ((sal.arrived && SAL.t > 0.4) || SAL.t > 30) { SAL.mode = 'rest'; sal.ctl.speed = 1; /* 出たばかりは、前の場所の「着いた」が残っている */ SAL.t = 0; sal.ctl.curl = true; } }
  else if (SAL.mode === 'rest') {
    SAL.k += ((SAL.t < RULE.salRest - 5 ? 1 : Math.max(0, (RULE.salRest - SAL.t) / 5)) - SAL.k) * Math.min(1, dt * 2); // 終わりの5秒で冷めていく
    if (!SAL.lit && SAL.t > 0.8) { SAL.lit = true; for (const s of L.stands) if (s.life <= 0 && !L.fallen(s) && Math.hypot(s.x - lp.x, s.z - lp.z) < 0.7 && (s.kind !== 'cliff' || prevLit(s) || (st.cliff && st.cliff.salTo === s))) { L.ignite(s); st.litAny = true; sfx('sfx-flare', 0.35, 1.4); fx.crumbs(s.x, H(s.x, s.z) + 0.7, s.z, 6, 0.2); } } // 空の台にふれると灯をともす
    const id = chunkIdAt(lp.x, lp.z); if (id >= 0 && isl.all[id].fallen) SAL.t = RULE.salRest; // 足もとが落ちそうなら、すぐ帰る
    if (SAL.t >= RULE.salRest) { SAL.mode = 'back'; SAL.t = 0; sal.ctl.curl = false; SAL.route = st.cliff && onShore(salPos()) ? salRoute({ x: FIRE.x + 0.66, z: FIRE.z }).slice(0, -1) : []; sal.ctl.goal = SAL.route.length ? SAL.route.shift() : null; sal.ctl.speed = SAL.route.length ? 1.6 : 1; } // 岸からは、来た道をもどる
  } else if (SAL.mode === 'back') { SAL.k += (0 - SAL.k) * Math.min(1, dt * 2); SAL.t += 0; if (sal.ctl.goal && sal.arrived && SAL.t > 0.4) { sal.ctl.goal = SAL.route.length ? SAL.route.shift() : null; SAL.t = 0; if (!sal.ctl.goal) sal.ctl.speed = 1; } if (!sal.away) SAL.mode = 'home'; }
  else if (SAL.mode === 'save') { SAL.k += (0.6 - SAL.k) * Math.min(1, dt * 2); if (SAL.t > 1.2 && !SAL.gave) { SAL.gave = true; st.F += RULE.salSave; fx.burst(0.6); sfx('sfx-flare', 0.5, 0.8); } if (SAL.t > 7) { SAL.mode = 'home'; sal.ctl.rOv = null; sal.ctl.curl = false; } }
  else SAL.k += (0 - SAL.k) * Math.min(1, dt * 2);
  // 火が消えかけると、ひと晩に1回だけ、自分からおき火に入って丸くなる（そばにいるときだけ。闇へ行っているあいだは助けられない）
  if (SAL.mode === 'home' && !SAL.saved && !demo && st.phase === 'play' && st.t > 5 && st.F < 2.5 && !st.burning.length) { SAL.saved = true; SAL.gave = false; SAL.mode = 'save'; SAL.t = 0; sal.ctl.rOv = 0.12; sal.ctl.curl = true; }
  // 光: 歩くあいだは小さく、丸くなると大きく
  const r = RULE.salR * SAL.k, away = SAL.mode === 'go' || SAL.mode === 'rest' || SAL.mode === 'back';
  DARK.uLamp.value[LAMPS - 1].set(lp.x, lp.z, r, away && r > 0.05 ? 1 : 0);
  { const b = sal.body(), dx = b.x - camera.position.x, dz = b.z - camera.position.z, dl = Math.hypot(dx, dz) || 1; salLight.position.set(b.x + dx / dl * 0.2, b.y + 0.15, b.z + dz / dl * 0.2); } salLight.intensity = 6 * SAL.k; /* 光は体の向こう側に。体は逆光の黒い輪、まわりの灰が丸く照らされる */ sal.materials[1].emissiveIntensity = 0.06 + 1.2 * SAL.k;
}
// 闇から塊を守る光: たき火のほかに、灯と、闇で丸くなった火トカゲ
function shelterOf(c) { let d = L.shelter(c); if (SAL.mode === 'go' || SAL.mode === 'rest' || SAL.mode === 'back') { const p = salPos(); d = Math.min(d, Math.hypot(c.cx - p.x, c.cz - p.z) - 0.45 * c.rad - RULE.salR * SAL.k); } return d; }
function nearFlame(e) { const d = flameDist(e); return d < 44 && !(salDist(e) < 34 && salDist(e) < d); }
function fireLight() { return { x: ringC.x || FIRE.x, z: ringC.z || FIRE.z, r: lightRadius(st.F) * (st.W.rMul || 1) }; }
function standNear(p) { let best = null, bd = 0.75; for (const s of L.stands) { const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < bd) { bd = d; best = s; } } return best; }
// 放した所の台: 画面の上で、台の炎に近いもの（台の炎は高いので、地面の点で選ぶと奥にずれた）。なければ地面の近さで
function standAtScreen(e) { let best = null, bd = 46; for (const s of L.stands) { if (s.x > 1e3) continue; const d = scrDist(s.fl.getWorldPosition(new THREE.Vector3()), e); if (d < bd) { bd = d; best = s; } } return best; }
function dropEmber(p, e) {
  L.ember.visible = false; L.emberLight.intensity = 0; cv.classList.remove('carry');
  const s = (e && standAtScreen(e)) || standNear(p);
  if (s && canLightS(s)) { L.ignite(s); st.litAny = true; sfx('sfx-flare', 0.4, 1.3); fx.crumbs(s.x, H(s.x, s.z) + 0.7, s.z, 6, 0.2); return; }
  if (s && s.afterGully && s.life <= 0 && st.cliff && !st.cliff.bridge && prevLit(s)) { handSal(s); return; } // 割れ目の向こう: 火トカゲが火種を受けとって渡る
  if (carry && carry.from && s === carry.from) { s.life += RELAY; return; } // 分けた台にもどす
  if (s && s.life <= 0) { s.nope = 0.5; sfx('sfx-pick', 0.35, 0.5); fx.crumbs(s.x, groundY(s.x, s.z) + 0.8, s.z, 4, 0.15); return; } // 置けない台: じゅっとまたたいて消える
  if (Math.hypot(p.x - FIRE.x, p.z - FIRE.z) < RULE.dropR) { st.F += RULE.emberCost; return; } // 火にもどす
  fx.crumbs(p.x, H(p.x, p.z) + 0.2, p.z, 5, 0.2); // 闇の中で消える
}
// ── 風よけと天気（PLAN.md 2.9章）: 戸板を台のそばで放すと、風上に立つ。家や礼拝堂の陰の灯は風に吹かれない ──
function leanBoard(b, s) {
  if (!s || s.board || L.fallen(s)) return false;
  putDown(b, { x: s.x, z: s.z }); s.board = b; b.boardOf = s; const w = windVec(); b.face = w.s ? { x: w.x, z: w.z } : s.windy ? { x: AHEAD.x, z: AHEAD.z } : { x: s.x - FIRE.x, z: s.z - FIRE.z }; // 崖の岬は海からの風 b.yaw = undefined;
  sfx('sfx-pick', 0.5, 0.7); return true;
}
function stepBoards(dt) {
  const w = windVec();
  for (const s of L.stands) {
    const b = s.board; if (!b) continue;
    if (b.burned || b.lost || b.carried || b.boardOf !== s) { s.board = null; continue; }
    if (w.s) b.face = { x: w.x, z: w.z }; // 風が変わると、戸板も向き直る
    const n = Math.hypot(b.face.x, b.face.z) || 1, fx0 = b.face.x / n, fz0 = b.face.z / n, yaw = Math.atan2(fx0, fz0);
    b.yaw = b.yaw === undefined ? yaw : b.yaw + Math.atan2(Math.sin(yaw - b.yaw), Math.cos(yaw - b.yaw)) * Math.min(1, dt * 2);
    const ux = Math.sin(b.yaw), uz = Math.cos(b.yaw), x = s.x - ux * 0.26, z = s.z - uz * 0.26; // 灯の風上に
    const q = new THREE.Vector3(x, groundY(x, z) + 0.2, z); b.obj.parent.worldToLocal(q); b.obj.position.copy(q); b.obj.rotation.set(0.18, b.yaw, 0, 'YXZ'); b.obj.scale.setScalar(1.2); // 上を灯の側へ少し寄りかからせる
  }
}
function wallsUpwind(s, w) {
  if (s.board) return true;
  const bl = V.houses.filter(h => !h.g.userData.fallen).map(h => ({ x: h.x, z: h.z, r: 0.55 }));
  if (!V.chapel.g.userData.fallen) bl.push({ x: V.chapel.g.position.x, z: V.chapel.g.position.z, r: 1.0 });
  return bl.some(o => { const vx = o.x - s.x, vz = o.z - s.z, along = -(vx * w.x + vz * w.z), perp = Math.abs(vx * w.z - vz * w.x); return along > 0 && along < o.r + 1.4 && perp < o.r + 0.1; });
}
function weatherLamps(dt) {
  const W = st.W, w = windVec();
  for (const s of L.stands) {
    const wet = W.wet && !(s.house && !s.house.roofless); // 軒のランタンは、屋根があればぬれない
    const blown = W.wind && !wallsUpwind(s, w) ? (s.kind === 'lantern' ? 0.5 : 1) : s.windy && !s.board && s.life > 0 ? 1 : 0; // ランタンは風に強い。崖の岬の台は、戸板がなければいつも吹かれる
    s.lean += (blown - s.lean) * Math.min(1, dt * 3); s.wet = wet ? 1 : 0;
    s.ox = w.x * (w.s || 0) * 0.35 * s.lean; s.oz = w.z * (w.s || 0) * 0.35 * s.lean; // 吹かれた灯の輪は風下へ
    s.rMul += ((wet ? 0.72 : 1) - s.rMul) * Math.min(1, dt * 2); s.burnMul = 1 + (wet ? 1.2 : 0) + s.lean * (s.windy ? 2 : 1); // ぬれた灯・吹かれた灯は早く尽きる
  }
}
// 屋根の下の物（雨でぬれない）: 屋根のある家の部品と、そのそばの物
function underRoof(b) {
  if (b.house) return !b.house.roofless || b === b.house.roof;
  const p = centerOf(b.obj);
  return V.houses.some(h => !h.roofless && !h.g.userData.fallen && Math.hypot(p.x - h.x, p.z - h.z) < 1.15);
}
// 光の輪の中心（風の夜は風下へずれる）
const ringC = new THREE.Vector3();
function windVec() { const W = st.W; if (!W.wind) return { x: 0, z: 0 }; const a = st.windAng + (st.t > RULE.night / 2 ? Math.min(1, (st.t - RULE.night / 2) / 6) * 2.2 : 0); return { x: Math.cos(a), z: Math.sin(a), s: W.wind }; }

// ── 塊が落ちる ──
function fall(c) {
  c.fallen = true; c.fall = { v: 0, ax: new THREE.Vector3(Math.random() - .5, 0, Math.random() - .5).normalize(), w: 0.3 + Math.random() * 0.5 };
  for (const o of V.onChunk[c.id]) {
    if (o.userData.fallen) continue;
    const b = o.traverse ? V.burnables.find(x => x.obj === o) : null; if (b && (b.carried || b.burned)) continue;
    o.userData.fallen = true; c.group.attach(o); if (b) b.lost = true;
  }
  for (const n of c.neighbors) { const o = isl.all[n]; if (!o.fallen) o.exposed = true; }
  fx.crumbs(c.cx, c.topY, c.cz, 40, c.rad * 1.4);
  sfx(Math.random() < 0.5 ? 'sfx-crumble' : 'sfx-crumble2', 0.5, 0.85 + Math.random() * 0.3);
}

// ── 画面 ──
let toastT = 0;
function showToast(s) { return; // 字は出さない（PLAN.md 2.9章）。残しておくのは、あとで試すため
 const el = $('toast'); el.textContent = s; el.classList.add('on'); toastT = 1.6; }
function hud() {
  $('bar').style.transform = `scaleX(${Math.min(1, st.cliff ? st.cliff.t / CLIFF.time : st.t / RULE.night)})`; if (st.orbN !== st.night + st.phase) { st.orbN = st.night + st.phase; const o = $('orbs'); o.setAttribute('aria-label', `第${st.night}夜`); [...o.children].forEach((e, i) => { e.className = i + 1 < st.night || (i + 1 === st.night && st.phase === 'dawn') ? 'done' : i + 1 === st.night ? 'now' : ''; }); }
  const hint = $('hint'); hint.hidden = true; // 字の案内はなし。目じるしの光と、火トカゲのしぐさで促す（PLAN.md 2.9章）
  // 目立たせるのは1つ: 手本のあと → 火から少し離れた柵 →（1つくべたら）炎の芯 →（火種を持ったら）ともせる台
  for (const s2 of L.stands) s2.dim = !!(carry && carry.ember && s2.life <= 0 && !canLightS(s2) && !(s2.afterGully && st.cliff && !st.cliff.bridge && prevLit(s2)));
  for (const s2 of L.stands) s2.hint = !!(carry && carry.ember && (canLightS(s2) || (s2.afterGully && st.cliff && !st.cliff.bridge && prevLit(s2) && s2.life <= 0))) || !!(st.cliff && !carry && s2 === nextCliff()); // 崖の場面では、次にともす台がいつも脈打つ
  let gp = null;
  if (st.phase === 'play' && st.demoDone) {
    if (carry && carry.ember) { let best = null, bd = 1e9; for (const s2 of L.stands) if (canLightS(s2)) { const d = Math.hypot(s2.x - carry.p.x, s2.z - carry.p.z); if (d < bd) { bd = d; best = s2; } } if (best && (!st.litAny || st.cliff)) gp = best.fl.getWorldPosition(new THREE.Vector3()); }
    else if (!carry && !st.burnedAny) { const b = nearestBurnable(); if (b) gp = centerOf(b.obj).add(new THREE.Vector3(0, 0.14, 0)); }
    else if (!carry && !st.tookEmber) gp = new THREE.Vector3(FIRE.x, fireY + 0.9, FIRE.z);
    else if (!carry && st.cliff && !st.cliff.done && nextCliff()) { // 崖の場面: 火種を取る所（ひとつ前の台。はじめはたき火）が光り、置く台が脈打つ。割れ目の手前では割れ目が光る
      const n = nextCliff(), k = cliffStands.indexOf(n), src = k > 0 ? cliffStands[k - 1] : null;
      gp = src && src.life > RELAY + 1 ? src.fl.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(FIRE.x, fireY + 0.9, FIRE.z); }
    else if (!carry && hoverFlame) gp = new THREE.Vector3(FIRE.x, fireY + 0.9, FIRE.z);
    else if (!carry && hover) gp = centerOf(hover.obj).add(new THREE.Vector3(0, 0.14, 0));
  }
  glint.visible = !!gp; if (gp) glint.position.copy(gp);
  const tag = $('tag');
  const tagAt = (v, dy) => { const p = v.clone().project(camera); tag.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`; tag.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight - dy}px`; };
  if (carry && carry.sal) { tag.hidden = false; tagAt(salRing.position, 20); tag.textContent = '火トカゲ'; }
  else if (carry && carry.ember) { tag.hidden = false; tagAt(L.ember.position, 30); tag.textContent = '火種'; } // 火種は物ではない（carry.b はない）
  else if (!carry && hoverStand && st.phase === 'play') { tag.hidden = false; tagAt(hoverStand.fl.getWorldPosition(new THREE.Vector3()), 22); tag.textContent = '火種'; }
  else if (!carry && hoverSal && st.phase === 'play') { tag.hidden = false; const p = sal.body().clone(); C0.group.localToWorld(p); tagAt(p, 26); tag.textContent = '火トカゲ'; }
  else if (!carry && hoverFlame && st.phase === 'play') { tag.hidden = false; tagAt(new THREE.Vector3(FIRE.x, fireY + 0.9, FIRE.z), 10); tag.textContent = st.F >= RULE.emberMin ? '火種' : '火種（火が小さい）'; }
  else if (carry) { tag.hidden = false; const p = carry.b.obj.position.clone().project(camera); tag.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`; tag.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight - 40}px`; tag.textContent = `${carry.b.name}　${'▮'.repeat(Math.max(1, Math.round(carry.b.fuel / 4)))}`; }
  else if (hover && st.phase === 'play') { tag.hidden = false; const p = centerOf(hover.obj).project(camera); tag.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`; tag.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight - 34}px`; tag.textContent = `${hover.name}　${'▮'.repeat(Math.max(1, Math.round(hover.fuel / 4)))}`; }
  else tag.hidden = true;
}

function result(won) {
  st.phase = won ? 'dawn' : 'lost';
  const last = won && st.night >= NIGHTS;
  $('next').textContent = won ? '次の夜へ' : '岩から出直す'; $('next').hidden = last;
  if (won && !last) { showResult(true); st.resTimer = setTimeout(() => { $('result').hidden = false; }, 3500); } // 岸に着いた夜は、結果の札のかわりに灯台の崖へ（PLAN.md 2.11）
  // 呑まれたときは、島が崩れきってから（まん中の塊も最後に落ちる）出す
}
function showResult(won) {
  let rows;
  if (won) {
    const area = isl.chunks.filter(c => !c.fallen).reduce((s, c) => s + c.quads.length, 0) / totalArea;
    const roofed = V.houses.filter(h => !h.g.userData.fallen && !h.roofless).length;
    const graves = V.graves.filter(g => !g.g.userData.fallen).length, trees = V.trees.filter(t => !t.burned && !t.lost).length;
    rows = [['島の広さ', `${Math.round(area * 100)}%`], ['屋根のある家', `${roofed} / ${V.houses.length}`], ['礼拝堂', V.chapel.g.userData.fallen ? '落ちた' : '残った'], ['墓', `${graves} / ${V.graves.length}`], ['木', `${trees} / ${V.trees.length}`]];
  } else rows = [['もちこたえた', `${Math.round(st.tEnd)} / ${RULE.night} 秒`], ['くべたもの', `${V.burnables.filter(b => b.burned).length}`]];
  const last = won && st.night >= NIGHTS;
  $('resTitle').textContent = last ? '灯台に火がともった' : won ? `第${st.night}夜を越えた` : `第${st.night}夜、島は夜に呑まれた`;
  $('resLead').textContent = last ? ending() : won ? '月食が、少しだけゆるむ。灯台が近づいた。' : '火の番の岩だけが、おき火を抱いて漂っている。';
  $('resRows').innerHTML = rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  $('resRows').style.gridTemplateColumns = `repeat(${rows.length}, 1fr)`;
}

// ── 確かめ用: ?speed=8 で時間を速く、?auto=1 でタイトルを飛ばす（音なし） ──
const QS = new URLSearchParams(location.search), SPEED = Math.min(20, +QS.get('speed') || 1);
if (QS.get('cliff')) { $('title').hidden = true; setTimeout(loadCliff); cv.addEventListener('pointerdown', () => startAudio(), { once: true }); } // 崖からやり直す（音はさわったときから）
else if (QS.get('auto')) { $('title').hidden = true; setTimeout(() => startNight(+QS.get('night') || 1)); } // ファイルの下の方（手本など）の準備のあとで
// ── はじめる ──
$('start').addEventListener('click', () => { $('title').hidden = true; startNight(1); startAudio(); });
// テスト用: タイトルから好きな夜をはじめる（島はまるごと、その夜の流木つき）
document.querySelector('.pick [data-cliff]').addEventListener('click', () => { try { sessionStorage.removeItem(CLIFF_KEY); } catch (e) { /* 覚えられなくても、島まるごとから */ } location.search = '?cliff=1'; }); // テスト用: 島まるごとで、灯台の崖から
for (const b of document.querySelectorAll('.pick button[data-n]')) b.addEventListener('click', () => { $('title').hidden = true; startNight(+b.dataset.n); startAudio(); });
$('again').addEventListener('click', () => location.reload());
$('next').addEventListener('click', () => { if (st.phase === 'cliffFail') location.search = '?cliff=1'; else startNight(Math.min(NIGHTS, st.night + 1)); }); // 崖で失敗したら、崖に着いたときからやり直す
// 岸に着いたときの言葉（持って着いた物で変わる）
function ending() { // 灯台に火がともったあと。持って着いた物で3段に変わる（PLAN.md 2.11）
  const area = isl.chunks.filter(c => !c.fallen).reduce((s, c) => s + c.quads.length, 0) / totalArea, roofed = V.houses.filter(h => !h.g.userData.fallen && !h.roofless).length;
  if (area > 0.8 && roofed >= 2) return '元の村の形のまま、岸に着いた。灯台の光が、島をむかえる。';
  if (roofed >= 1) return '残した家に灯がともり、岸の村にくわわった。';
  return '灯台に火がともった。火トカゲが、岸で最初の火をおこす。';
}

// ── 次の夜（光で拾う。PLAN.md 2.7章）: 落ちたかけらが闇を漂って浮かび、光の輪がとどけば元の場所にくっつく ──
function startNight(n) {
  const W = WEATHER[Math.min(n, NIGHTS) - 1];
  Object.assign(st, { arrive: 0, W, night: n, t: 0, F: RULE.fuel0, burning: [], out: 0, phase: 'play', dawnK: 0, shown: false, lastT: 0, drift: 0, tEnd: 0, burnMul: W.burnMul || 1, windAng: Math.random() * Math.PI * 2 });
  R3.setWeather({ fog: W.id === 'fog' ? 1 : 0, rain: W.wet ? 1 : 0 });
  shore.visible = n >= NIGHTS; placeShore(0, 0);
  const wx = $('wx'); wx.innerHTML = `<b>${W.name}</b>`; /* 説明の文は出さない（起きたことで知らせる） */ wx.classList.add('on'); clearTimeout(st.wxT); st.wxT = setTimeout(() => wx.classList.remove('on'), 6500);
  C0.group.position.set(0, 0, 0); C0.group.rotation.set(0, 0, 0);
  if (n === 1 && !st.demoDone) startDemo(); else st.demoDone = true;
  for (const s2 of L.stands) s2.life = 0;
  Object.assign(SAL, { mode: 'home', t: 0, k: 0, saved: false }); sal.ctl.goal = null; sal.ctl.curl = false; sal.ctl.rOv = null;
  // その夜の決まりを、はじめから1回見せる（字のかわり）: 雨は軒の下と外に1つずつ、風は戸板つきと戸板なしに1つずつ
  const byFire = k => L.stands.filter(s2 => s2.kind === k && !L.fallen(s2)).sort((a, b) => Math.hypot(a.x - FIRE.x, a.z - FIRE.z) - Math.hypot(b.x - FIRE.x, b.z - FIRE.z));
  if (W.wet) { const a = byFire('lantern').find(s2 => !s2.house.roofless), b = byFire('brazier')[0]; for (const s2 of [a, b]) if (s2) s2.life = LAMP.life; }
  if (W.wind) { const [a, b] = byFire('brazier'); for (const s2 of [a, b]) if (s2) s2.life = LAMP.life;
    if (a && !a.board && !st.boardGiven) { const id = chunkIdAt(a.x, a.z); if (id >= 0) { st.boardGiven = true; const bd = V.addBoard(isl.all[id], a.x, a.z); bd.obj.traverse(o => { if (o.isMesh) patchDark(o.material); }); leanBoard(bd, a); } } }
  clearTimeout(st.resTimer); $('result').hidden = true; R3.setDawn(0); // 前の夜の結果が遅れて出ないように
  // 浮かんでくる時刻（はじめの12秒は崩れを見せるので、そのあと）
  // 流れ着いた流木（立っている塊に。岩だけなら岩に）
  const stand = isl.chunks.filter(c => !c.fallen);
  for (let i = 0; i < (RULE.washUp[Math.min(n, NIGHTS) - 1] || 0); i++) { const c = stand[Math.floor(Math.random() * stand.length)], w = V.addDriftwood(c, RULE.washFuel); w.obj.traverse(o => { if (o.isMesh) patchDark(o.material); }); }
  // 浮かぶかけらの数: 島が小さいほど多い（岩だけからでも巻き返せるように）
  const fallenN = isl.chunks.filter(c => c.fallen).length, nRet = n > 1 ? Math.round((RULE.returns + fallenN * RULE.catchUp) * (W.returnsMul || 1)) : 0;
  st.returns = Array.from({ length: nRet }, (_, i) => 10 + (i + Math.random() * 0.8) * (RULE.night - 30) / Math.max(1, nRet));
}
// 火トカゲの手本: 小枝をくわえて火へ引きずる（はじめの夜に一度だけ。字のかわり）
let demo = null;
const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.32, 5), V.M.bark); twig.rotation.z = Math.PI / 2; twig.visible = false; C0.group.add(twig); patchDark(V.M.bark);
function startDemo() { const a = sal.ang + 0.9; demo = { t: 0, phase: 'walk', a }; twig.visible = true; twig.position.set(FIRE.x + Math.cos(a) * 0.95, H(FIRE.x + Math.cos(a) * 0.95, FIRE.z + Math.sin(a) * 0.95) + 0.02, FIRE.z + Math.sin(a) * 0.95); sal.ctl.rOv = 0.95; sal.goTo(a); }
function stepDemo(dt) {
  if (!demo) return; demo.t += dt;
  if (demo.phase === 'walk' && Math.abs(sal.ang - demo.a) < 0.05) { demo.phase = 'drag'; demo.t = 0; sal.ctl.rOv = 0.3; sal.ctl.walk = true; }
  if (demo.phase === 'drag') { const h = sal.head(); twig.position.set(h.x, h.y - 0.01, h.z); if (demo.t > 1.8) { twig.visible = false; fx.burst(0.4); st.F += 2; sfx('sfx-flare2', 0.3, 1.2); demo.phase = 'back'; demo.t = 0; sal.ctl.rOv = null; sal.ctl.walk = false; } }
  if (demo.phase === 'back' && demo.t > 1) { demo = null; st.demoDone = true; }
  if (demo && demo.t > 9) { twig.visible = false; sal.ctl.rOv = null; sal.ctl.walk = false; demo = null; st.demoDone = true; } // 念のため
}
function exposedOf(c) { return c.rim || [...c.neighbors].some(n => isl.all[n].fallen); }
// 浮かばせるかけら: 島のとなり（立っている塊と接する落ちた塊）から
function surface() {
  const cand = isl.chunks.filter(c => c.fallen && !c.drift && [...c.neighbors].some(n => !isl.all[n].fallen));
  if (!cand.length) return;
  cand.sort((a, b) => a.dist - b.dist + (Math.random() - 0.5) * 2.5);
  const c = cand[0];
  c.drift = { age: 0, mode: 'up', out: new THREE.Vector3(c.cx, 0, c.cz).normalize(), seed: Math.random() * 9 };
  c.group.visible = true; c.group.quaternion.identity();
  // 霧の夜の手本: 火トカゲが一度だけ自分から闇へ行き、浮かんだかけらのそばで丸くなる（連れていけると察する。字のかわり）
  if (st.W.id === 'fog' && !st.salDemo && SAL.mode === 'home') {
    const n = [...c.neighbors].map(i => isl.all[i]).filter(o => !o.fallen && !o.fixed).sort((a, b) => a.dist - b.dist)[0];
    if (n) { st.salDemo = true; goSal({ x: n.cx + (c.cx - n.cx) * 0.35, z: n.cz + (c.cz - n.cz) * 0.35 }); }
  }
}
function dock(c) {
  c.fallen = false; c.fall = null; c.drift = null; c.s = 0.7;
  c.group.position.set(0, 0, 0); c.group.quaternion.identity();
  c.group.traverse(o => { if (o.userData.fallen) o.userData.fallen = false; });
  for (const b of V.burnables) if (b.lost && !b.burned) { let p = b.obj; while (p && p !== c.group) p = p.parent; if (p) b.lost = false; }
  c.exposed = exposedOf(c); for (const n of c.neighbors) isl.all[n].exposed = exposedOf(isl.all[n]);
  const w = V.addDriftwood(c, RULE.driftwood); w.obj.traverse(o => { if (o.isMesh) patchDark(o.material); });
  fx.crumbs(c.cx, c.topY, c.cz, 25, c.rad); sfx('sfx-crumble2', 0.35, 1.4);
  showToast('かけらが島にもどった');
}
function stepDrift(dt, R) {
  for (const c of isl.chunks) {
    const d = c.drift; if (!d) continue;
    d.age += dt;
    const bob = Math.sin(d.age * 1.3 + d.seed) * 0.12, tilt = Math.sin(d.age * 0.7 + d.seed) * 0.05;
    if (d.mode === 'up') {
      const k = Math.min(1, d.age / 4), away = (1.4 + 0.4 * Math.sin(d.age * 0.4 + d.seed)) * (st.W.near || 1);
      c.group.position.set(d.out.x * away, -7 + 6.2 * (1 - (1 - k) ** 3) + bob, d.out.z * away);
      c.group.rotation.set(tilt, Math.sin(d.age * 0.2 + d.seed) * 0.1, tilt * 0.7);
      const near = [...c.neighbors].some(n => !isl.all[n].fallen);
      if (k >= 1 && near && Math.min(darkness(c.dist, R), darkness(shelterOf(c), 0)) < RULE.dockDark) { d.mode = 'dock'; d.age = 0; d.from = c.group.position.clone(); }
      else if (d.age > RULE.driftLife) { d.mode = 'down'; d.age = 0; }
    } else if (d.mode === 'dock') {
      const k = Math.min(1, d.age / 1.6), e = k * k * (3 - 2 * k);
      c.group.position.copy(d.from).multiplyScalar(1 - e); c.group.rotation.set(tilt * (1 - e), 0, 0);
      if (k >= 1) dock(c);
    } else {
      c.group.position.y -= dt * (1 + d.age * 3);
      if (c.group.position.y < -40) { c.group.visible = false; c.drift = null; }
    }
  }
}

// ── 灯台の崖（PLAN.md 2.11）: 岸に着くと灯台の火が尽きている。桟橋から岬まで冷えた台を順にともし、火トカゲが灯台に火を分ける ──
// 月食がもどりきる前に（CLIFF.time 秒）。割れ目の向こうは橋板（梁・荷車・丸太）か火トカゲ、岬の台は戸板がないと早く尽きる。島は崩れない（岸にもやってある）
const CLIFF = { time: 150, azOff: 1.0 }, CLIFF_KEY = 'dusk-diorama-cliff', N0 = V.burnables.length, tmpV = new THREE.Vector3();
const cliffStands = L.stands.filter(s => s.kind === 'cliff');
const prevLit = s => { const k = cliffStands.indexOf(s); return k === 0 || cliffStands[k - 1].life > 0; };
function cliffOk(s) { // 崖の台は順に。ひとつ前の台に灯があって、光がとどくこと（割れ目の向こうは、橋板があるときだけ）。はじめの台（桟橋の先）は島から
  if (!st.cliff || st.cliff.done || s.life > 0) return false;
  const k = cliffStands.indexOf(s); if (k === 0) return true;
  const p = cliffStands[k - 1]; if (p.life <= 0) return false;
  return s.afterGully ? !!st.cliff.bridge : Math.hypot(p.x - s.x, p.z - s.z) < p.r + 0.6;
}
const RELAY = 5; // ともった崖の台から火種を分けると、その台の灯がこれだけ短くなる
function litStandAt(e) { if (!st.cliff || st.cliff.done || st.phase !== 'play') return null; let best = null, bd = 44; for (const s of cliffStands) { if (s.life <= RELAY + 1) continue; const d = scrDist(s.fl.getWorldPosition(new THREE.Vector3()), e); if (d < bd) { bd = d; best = s; } } return best; }
const canLightS = s => s.kind === 'cliff' ? cliffOk(s) : L.canLight(s, fireLight());
const nextCliff = () => { const m = cliffStands.reduce((m, s, i) => s.life > 0 ? i : m, -1), n = cliffStands[m + 1]; return n && n.life <= 0 ? n : null; }; // いちばん先までともった台の次（手前の台の灯が切れても、案内は先頭を指す）
function onShore(p) { const q = shore.worldToLocal(tmpV.set(p.x, 0, p.z)); return SHORE.groundAt(q.x, q.z) !== null; }
// 地面の高さ（島の上は H。崖の場面では、岸と桟橋の上も）
function groundY(x, z) {
  const id = chunkIdAt(x, z);
  if (st.cliff && (id < 0 || isl.all[id].fallen)) { const q = shore.worldToLocal(tmpV.set(x, 0, z)), y = SHORE.groundAt(q.x, q.z); if (y !== null) return y + shore.position.y; }
  return H(x, z);
}
sal.ctl.ground = groundY;
const gullyW = () => shore.localToWorld(new THREE.Vector3(SHORE.gully.x, 0, SHORE.gully.z));
const gullyDist = p => { const g = gullyW(); return Math.hypot(p.x - g.x, p.z - g.z); };
function placeBridge(b) { // 割れ目の上に、道の向きに渡す
  const g = gullyW(), a = cliffStands.find(s => s.afterGully), i = cliffStands.indexOf(a), p = cliffStands[i - 1];
  b.obj.position.set(g.x, groundY(g.x, g.z) + 0.08, g.z); b.obj.rotation.set(0, Math.atan2(a.x - p.x, a.z - p.z), 0); shore.attach(b.obj);
  st.cliff.bridge = b; b.bridge = true; sfx('sfx-pick', 0.6, 0.6); fx.crumbs(g.x, g.y + 0.1, g.z, 10, 0.4);
}
// 橋板がないとき、割れ目の向こうの台に火種を置くと、火トカゲが受けとって割れ目を渡り、台をともす（遅いが必ず届く。決まりを知らなくても進める）
function handSal(s) {
  if (st.cliff.salTo === s && SAL.mode === 'go') return;
  st.cliff.salTo = s; SAL.mode = 'home'; sal.ctl.goal = null; sal.ctl.rOv = null; goSal({ x: s.x + 0.25, z: s.z + 0.1 });
  sfx('sfx-flare2', 0.35, 1.3); const g = gullyW(); fx.crumbs(g.x, groundY(g.x, g.z) + 0.2, g.z, 8, 0.3);
}
function placeCliffStands() { for (const s of cliffStands) { s.g.getWorldPosition(tmpV); s.x = tmpV.x; s.z = tmpV.z; } }
function startCliff() {
  st.phase = 'play'; st.cliff = { t: 0, bridge: null, done: false, lit: false, seq: 0, rise: -1 }; st.dawnK = 0.35; st.burnedAny = st.tookEmber = st.litAny = true;
  clearTimeout(st.resTimer); $('result').hidden = true; placeCliffStands(); for (const s of cliffStands) s.life = 0;
  saveCliff();
  // 手本: 火トカゲが桟橋へ渡り、桟橋の先の台に火をともす（崖の台にも火トカゲが火を運べる、と見せる。字のかわり）
  const s0 = cliffStands[0]; Object.assign(SAL, { mode: 'home' }); goSal({ x: s0.x + 0.25, z: s0.z + 0.1 });
}
function stepCliff(dt) {
  const C = st.cliff; stepFire(st, dt); ringC.set(FIRE.x, fireY, FIRE.z); placeCliffStands();
  scene.fog.near = 26 + 22 * view.zoom; scene.fog.far = 70 + 40 * view.zoom; // 道を見わたすため引くので、霧を遠くへ（近くの霧で影絵になった）
  C.t += dt; if (C.t < 6 && !C.done) cliffView(Math.min(1, dt * 2)); // はじめの数秒で、道を見わたす向きへ
  if (!C.done) {
    st.dawnK = 0.35 * Math.max(0, 1 - C.t / CLIFF.time); // 月食が、だんだんもどってくる
    if (C.t >= CLIFF.time) return cliffFail();
    const last = cliffStands[cliffStands.length - 1];
    if (last.life > 0) { C.done = true; C.seq = 0; sal.ctl.goal = null; SAL.mode = 'home'; goSal(shore.localToWorld(SHORE.towerFoot.clone().add(new THREE.Vector3(1.1, 0, 0.2)))); } // 灯台の下まで火がとどいた → 火トカゲが灯台へ
    return;
  }
  // 火トカゲが灯台の下に着いたら、火が塔をのぼって灯室へ。ともったら本当の夜明け
  C.seq += dt;
  if (C.rise < 0 && ((SAL.mode === 'rest' && C.seq > 1) || C.seq > 40)) C.rise = 0;
  if (C.rise >= 0 && !C.lit) { C.rise = Math.min(1, C.rise + dt / 2.5); SHORE.rise(C.rise); if (C.rise >= 1) lightLighthouse(); }
}
function lightLighthouse() {
  const C = st.cliff; C.lit = true; SHORE.rise(1); st.phase = 'dawn'; fx.burst(1); sfx('sfx-flare', 0.7, 0.7); R3.grade.uniforms.flash.value = 0.15;
  const roofed = V.houses.filter(h => !h.g.userData.fallen && !h.roofless).length; SHORE.showHomes(roofed);
  showResult(true); $('next').hidden = true; st.resTimer = setTimeout(() => { $('result').hidden = false; }, 6000);
}
function cliffFail() {
  st.phase = 'cliffFail'; const lit = cliffStands.filter(s => s.life > 0).length;
  $('resTitle').textContent = '灯台に、火はとどかなかった'; $('resLead').textContent = '月食が、また岸をおおう。';
  $('resRows').innerHTML = [['とどいた台', `${cliffStands.reduce((m, s, i) => s.life > 0 ? i + 1 : m, 0)} / ${cliffStands.length}`], ['橋板', st.cliff.bridge ? 'かけた' : 'なし']].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  $('resRows').style.gridTemplateColumns = 'repeat(2, 1fr)'; $('next').textContent = '崖からやり直す'; $('next').hidden = false; $('result').hidden = false;
}
// やり直し: 崖に着いたときの島（落ちた塊・なくなった物・流木の数・燃料）を覚えておき、読みこみ直して崖から
function saveCliff() { try { sessionStorage.setItem(CLIFF_KEY, JSON.stringify({ F: st.F, fallen: isl.chunks.filter(c => c.fallen).map(c => c.id), gone: V.burnables.filter(b => b.id < N0 && (b.burned || b.lost)).map(b => b.id), drift: V.burnables.filter(b => b.id >= N0 && !b.burned && !b.lost).length })); } catch (e) { /* 覚えられなければ、やり直しは島まるごとから */ } }
function loadCliff() {
  let S = null; try { S = JSON.parse(sessionStorage.getItem(CLIFF_KEY) || 'null'); } catch (e) { /* なければ島まるごと */ }
  startNight(NIGHTS); st.returns = [];
  if (S) {
    for (const id of S.fallen) { const c = isl.all[id]; if (c && !c.fallen && !c.fixed) { fall(c); c.group.visible = false; } }
    for (const id of S.gone) { const b = V.burnables[id]; if (b && !b.burned) { b.burned = true; if (b.house && b.house.roof === b) b.house.roofless = true; b.obj.removeFromParent(); } }
    const extra = V.burnables.filter(b => b.id >= N0 && !b.burned && !b.lost);
    for (const b of extra.slice(S.drift)) { b.burned = true; b.obj.removeFromParent(); }
    const standing = isl.chunks.filter(c => !c.fallen); for (let i = extra.length; i < S.drift; i++) { const w = V.addDriftwood(standing[i % standing.length], RULE.washFuel); w.obj.traverse(o => { if (o.isMesh) patchDark(o.material); }); }
    st.F = S.F;
  }
  st.phase = 'dawn'; st.arrive = 1; shore.visible = true; placeShore(1, 1); startCliff(); cliffView(1);
}
// 崖の場面のカメラ: 島のたき火から灯台の下までの道を、海がわの斜め上から見わたす。f = 寄せる割合
function cliffView(f) {
  const t = shore.localToWorld(SHORE.towerFoot.clone()), vx = t.x - FIRE.x, vz = t.z - FIRE.z, L0 = Math.hypot(vx, vz), tall = innerWidth / innerHeight < 0.8;
  const sea = Math.atan2(-AHEAD.x, -AHEAD.z) + CLIFF.azOff; let nx = Math.sin(sea), nz = Math.cos(sea); // 海がわから、少し灯台のほうへ回りこんで
  if (tall) { nx = -vx / L0; nz = -vz / L0; } // たての画面は、島のうしろから灯台へ向く（道が上下にのびる）
  const pts = [new THREE.Vector3(FIRE.x, fireY, FIRE.z), t, ...cliffStands.map(s2 => new THREE.Vector3(s2.x, 0, s2.z))], frame = [...pts, ...[[5, 0], [-5, 0], [0, 5], [0, -5]].map(([x, z]) => new THREE.Vector3(x, 0, z)), t.clone().setY(t.y + 7)] /* 収める点: 島のふちと灯台の先も */, cx = pts.reduce((a, q) => a + q.x, 0) / pts.length, cz = pts.reduce((a, q) => a + q.z, 0) / pts.length; // 中心は、たき火・台・灯台のまん中
  const A = { x: cx + nx * 0.8, z: cz + nz * 0.8, az: Math.atan2(nx, nz), el: tall ? 1.0 : 0.78, zoom: view.zoom }; // たての画面は上から見下ろす（崖の壁でなく、上の道を見せる）
  // 引き具合: 全部が画面の内側（はしから8%）に入るまで引き、余りすぎたら寄る
  let out = 0, slack = 1; for (const q of frame) { const v = (q === frame[frame.length - 1] ? q.clone() : q.clone().setY(groundY(q.x, q.z) + 0.6)).project(camera); out = Math.max(out, Math.abs(v.x) - 0.84, Math.abs(v.y) - 0.8); slack = Math.min(slack, 0.62 - Math.abs(v.x), 0.6 - Math.abs(v.y)); }
  A.zoom = THREE.MathUtils.clamp(view.zoom * (out > 0 ? 1 + Math.min(0.03, out * 0.3) : slack > 0 ? 1 - Math.min(0.02, slack * 0.1) : 1), 0.6, 1.8); // 毎こま少しずつ（画面は前のこまのカメラで見る）
  view.target.lerp(new THREE.Vector3(A.x, 0.2, A.z), f); view.zoom += (A.zoom - view.zoom) * f; view.el += (A.el - view.el) * f;
  view.az += Math.atan2(Math.sin(A.az - view.az), Math.cos(A.az - view.az)) * f;
}
// 着いたときのカメラ: 横から、島と桟橋と灯台が並ぶ向き（たての画面は、島の向こうに岸が見える向き）。f = 寄せる割合
function arriveView(f) {
  const tall = innerWidth / innerHeight < 0.8, A = tall ? { d: 5, y: -0.5, zoom: 0.95 * view.base / 30, el: 0.3, az: 0.85 } : { d: 8, y: -1.6, zoom: 1.45, el: 0.24, az: 0.85 + 1.3 };
  view.target.lerp(new THREE.Vector3(AHEAD.x * A.d, A.y, AHEAD.z * A.d), f); view.zoom += (A.zoom * 30 / view.base - view.zoom) * f; view.el += (A.el - view.el) * f;
  view.az += Math.atan2(Math.sin(A.az - view.az), Math.cos(A.az - view.az)) * f;
}

// ── 毎こま ──
let last = performance.now();
function frame(now) {
  try { step(now); } catch (err) { if (!frame.warned) { frame.warned = true; console.error(err); } } // 1こま失敗しても、画面は止めない
  requestAnimationFrame(frame);
}
function step(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * SPEED; last = now;
  if (st.phase === 'play' && st.cliff) stepCliff(dt);
  else if (st.phase === 'play') {
    st.t += dt;
    stepFire(st, dt);
    const R = lightRadius(st.F) * (st.W.rMul || 1), w = windVec();
    ringC.set(FIRE.x + w.x * (w.s || 0) * R / RULE.rMax, fireY, FIRE.z + w.z * (w.s || 0) * R / RULE.rMax);
    for (const c of isl.chunks) c.dist = Math.max(0, Math.hypot(c.cx - ringC.x, c.cz - ringC.z) - 0.45 * c.rad);
    for (const c of isl.chunks) { if (!c.drift && stepChunk(c, R, dt, Math.min(darkness(c.dist, R), darkness(shelterOf(c), 0)))) fall(c); }
    if (shore.visible) placeShore(st.t / RULE.night, 0); /* 遠くの闇の底から、だんだんせり上がって近づく */
    while (st.returns.length && st.t >= st.returns[0]) { st.returns.shift(); surface(); }
    stepDrift(dt, R);
    if (st.out > RULE.emberGrace) { st.tEnd = st.t; result(false); }
    else if (st.t >= RULE.night) result(true);
  } else if (st.phase === 'lost') {
    let standing = 0;
    for (const c of isl.chunks) if (!c.fixed && !c.fallen) { standing++; c.s -= dt * (0.15 + Math.random() * 0.4); if (c.s <= 0) fall(c); }
    // 火の番の岩（まん中の塊）だけは呑まれない。おき火を抱いて、ゆっくり漂う（PLAN.md 2.6章）
    if (!standing) { st.lastT = (st.lastT || 0) + dt; if (st.lastT > 2.5 && !st.shown) { st.shown = true; showResult(false); $('result').hidden = false; } }
  }
  if (st.phase === 'lost' && !isl.chunks.some(c => !c.fixed && !c.fallen)) {
    st.drift = (st.drift || 0) + dt; const k = Math.min(1, st.drift / 4);
    C0.group.position.set(0, (Math.sin(st.drift * 0.5) * 0.18 - 0.2) * k, 0); C0.group.rotation.set(Math.sin(st.drift * 0.31) * 0.03 * k, Math.sin(st.drift * 0.2) * 0.05, Math.cos(st.drift * 0.27) * 0.03 * k);
  }
  const Rt = st.phase === 'lost' ? RULE.emberR : lightRadius(st.F) * (st.W.rMul || 1);
  DARK.uFire.value.lerp(st.phase === 'play' ? ringC : new THREE.Vector3(FIRE.x, fireY, FIRE.z), Math.min(1, dt * 2));
  st.shownR += (Rt + fx.flare * 0.4 - st.shownR) * Math.min(1, dt * 3);
  if (st.phase === 'dawn') st.dawnK = Math.min(st.night >= NIGHTS && st.cliff && st.cliff.lit ? 1 : 0.35, st.dawnK + dt / 4); // 本当の夜明けは、灯台に火がともったときだけ // 夜の切れ目は、月食が少しゆるむだけ。本当の夜明けは岸に着いたとき
  nextSky.set(st.phase === 'dawn' && st.night < NIGHTS ? WEATHER[st.night].id : '', Math.min(1, st.dawnK / 0.35));
  stepBeacon(now); stepBoat(now);
  DARK.uR.value = st.shownR; DARK.uDark.value = (1 - st.dawnK) * (st.cliff && !st.cliff.lit ? 0.55 : 1); /* 崖の場面は闇を浅く（岸の上の道と台が見えるように） */ R3.setDawn(st.dawnK);
  R3.grade.uniforms.flash.value *= Math.exp(-dt * 4);
  // ふるえる塊・落ちる塊
  for (const c of isl.chunks) {
    if (c.drift) continue;
    if (c.fallen) { if (c.group.visible) { c.fall.v += 7 * dt; c.group.position.y -= c.fall.v * dt; c.group.rotateOnWorldAxis(c.fall.ax, c.fall.w * dt); if (c.group.position.y < -45) c.group.visible = false; } continue; }
    if (c.fixed && st.drift) continue; // 漂う火の番の岩は上で動かしている
    const k = c.s < 0.45 ? (1 - c.s / 0.45) : 0, sh = shake.find(s => s.c === c);
    const amp = k * 0.025 + (sh ? sh.t * 0.05 : 0);
    c.group.position.set((Math.random() - .5) * amp, (Math.random() - .5) * amp * 0.5, (Math.random() - .5) * amp);
    if (k > 0 && Math.random() < dt * (1 + k * 6)) { const a = Math.atan2(c.cz, c.cx); fx.crumbs(c.cx + Math.cos(a) * c.rad * 0.5, c.topY - 0.3, c.cz + Math.sin(a) * c.rad * 0.5, 3, c.rad); }
  }
  for (const s of shake) s.t -= dt; for (let i = shake.length - 1; i >= 0; i--) if (shake[i].t <= 0) shake.splice(i, 1);
  // 運んでいる物は指の下の少し上に、ゆれながら
  if (carry && carry.ember) { // 置ける台に近づくと火種が台の炎に吸いつき、置けない台の上ではしぼむ
    const q = carry.p, hs = carry.e ? standAtScreen(carry.e) : null, ok = hs && hs.life <= 0 && (canLightS(hs) || (hs.afterGully && st.cliff && !st.cliff.bridge && prevLit(hs)));
    if (ok) { L.ember.position.lerp(hs.fl.getWorldPosition(new THREE.Vector3()), 0.35); L.ember.scale.setScalar(0.5 + 0.08 * Math.sin(now / 70)); L.ember.material.opacity = 1; L.emberLight.intensity = 5; }
    else { L.ember.position.set(q.x, groundY(q.x, q.z) + 0.55, q.z); const no = hs && hs.life <= 0; L.ember.scale.setScalar(no ? 0.16 : 0.3 + 0.05 * Math.sin(now / 90)); L.ember.material.opacity = no ? 0.45 + 0.3 * Math.sin(now / 40) : 1; L.emberLight.intensity = no ? 1 : 3; }
    L.emberLight.position.copy(L.ember.position); }
  else if (carry && carry.sal) { const q = carry.p; salRing.position.set(q.x, H(q.x, q.z) + 0.06, q.z); salRing.material.opacity = salOk(q) ? 0.55 + 0.2 * Math.sin(now / 200) : 0.12; }
  else if (carry) { const b = carry.b; carry.lift = Math.min(1, carry.lift + dt * 6); const tgt = new THREE.Vector3(carry.p.x, H(carry.p.x, carry.p.z) + 0.15 + 0.45 * carry.lift, carry.p.z).add(carry.off); b.obj.position.lerp(tgt, Math.min(1, dt * 14)); b.obj.rotation.z = Math.sin(st.t * 5) * 0.05; }
  if (!(carry && carry.sal)) salRing.material.opacity = 0;
  { const on = carry && carry.b && st.cliff && !st.cliff.bridge && !(carry.b.house && carry.b.house.roof === carry.b), g = on ? gullyW() : null, nearG = on && gullyDist(carry.p) < 1.4;
    gullyRing.material.opacity = on ? (nearG ? 0.9 : 0.4 + 0.2 * Math.sin(now / 200)) : 0; if (g) gullyRing.position.set(g.x, groundY(g.x, g.z) + 0.1, g.z); gullyRing.scale.setScalar(nearG ? 1.08 : 1); }
  const near = carry && !carry.ember && !carry.sal ? Math.hypot(carry.p.x - FIRE.x, carry.p.z - FIRE.z) < RULE.dropR : false;
  dropRing.material.opacity = carry && !carry.ember && !carry.sal ? (near ? 0.9 : 0.35 + 0.15 * Math.sin(now / 200)) : 0; dropRing.scale.setScalar(near ? 1.08 : 1);
  for (let i = sinking.length - 1; i >= 0; i--) { const s = sinking[i]; s.t += dt * 2.5; s.obj.position.lerp(new THREE.Vector3(FIRE.x, fireY + 0.1, FIRE.z), Math.min(1, dt * 8)); s.obj.scale.multiplyScalar(Math.max(0.2, 1 - dt * 3)); if (s.t >= 1) { s.obj.removeFromParent(); sinking.splice(i, 1); } }
  for (const l of loose) { l.v += 7 * dt; l.obj.position.y -= l.v * dt; if (l.obj.position.y < -40) l.obj.visible = false; }
  if (glint.visible) { const p = 0.5 + 0.5 * Math.sin(now / 260); glint.scale.setScalar((0.35 + 0.25 * p) * (st.cliff ? 2.2 : 1)); /* 崖の場面は遠いので大きく */ glint.material.opacity = 0.5 + 0.5 * p; }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
  idle += dt; if (idle > 6 && !pointers.size && st.phase !== 'play') view.az += dt * 0.04;
  const smokeK = st.burning.reduce((s, b) => s + b.smoke * (b.left / b.total), 0);
  const wv = windVec();
  fx.update(now / 1000, dt, { F: st.phase === 'lost' ? 0 : st.F, smokeK: Math.min(1, smokeK), camera, out: st.out, wind: { x: wv.x * (wv.s || 0) * 0.6, z: wv.z * (wv.s || 0) * 0.6 }, rainK: st.W.wet && st.phase === 'play' ? 1 : 0, ashK: st.W.id === 'snow' ? 2.2 : 1 });
  if (shore.visible) {
    shore.userData.glow.material.opacity = 0.1 + 0.3 * st.dawnK; SHORE.update(now / 1000, dt);
    if (st.phase === 'dawn' && st.night >= NIGHTS) { // 着く: 岸が寄り、カメラは少し引いて岸と島を両方おさめる
      st.arrive = Math.min(1, (st.arrive || 0) + dt / 7); placeShore(1, st.arrive); if (st.arrive >= 1 && !st.cliff) startCliff();
      const e = st.arrive * st.arrive * (3 - 2 * st.arrive), f = Math.min(1, dt * 0.8) * e; // 横から、島と桟橋と灯台が並ぶ向きへ（結果の札の上におさまるよう、少し下を見る）
      arriveView(f);
    }
  }
  if (st.phase === 'play') { weatherLamps(dt); stepBoards(dt); }
  L.update(now / 1000, st.phase === 'play' ? dt : 0, DARK.uLamp.value);
  stepDemo(dt); stepSal(st.phase === 'play' ? dt : 0);
  sal.ctl.peek = carry && carry.sal ? carry.p : hoverSal ? { x: camera.position.x, z: camera.position.z } : null; // つまむ手を見上げる
  sal.update(now / 1000, dt, { F: st.phase === 'lost' ? 0 : st.F, flare: fx.flare, lost: st.phase === 'lost' });
  tickAudio({ fire: st.F > 0 ? 0.35 + 0.65 * Math.sqrt(st.F / RULE.fuelMax) : 0.15, walk: carry ? 1 : 0 });
  hud();
  R3.render(now / 1000);
}
requestAnimationFrame(frame);
window.__game = { st, isl, V, view, RULE, camera, fx, burn, fall, FIRE, chunkIdAt, startNight, sal, L, SAL, sendSal, leanBoard, fireLight, shelterOf, cliffStands, placeBridge, CLIFF, SHORE, carry: () => carry, gullyDist, onShore, salPos, emberTo: s => { if (st.F < RULE.emberMin) return false; st.F -= RULE.emberCost; st.tookEmber = true; dropEmber({ x: s.x, z: s.z }); return s.life > 0; } }; // 確かめ用（tools/ と手で）
