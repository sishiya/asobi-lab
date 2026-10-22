// 夜明けまでの島（段階A）: つまんで火にくべる。輪の外の島は崩れて落ちる。夜明けに何が残ったか
import * as THREE from 'three';
import { rng, H, FIRE } from './util.js';
import { RULE, BURN, lightRadius, stepFire, stepChunk, darkness } from './rules.js';
import { textures } from './tex.js';
import { buildIsland, chunkIdAt } from './island.js';
import { buildVillage } from './village.js';
import { makeRenderer, patchDark, DARK } from './render.js';
import { makeFx } from './fx.js';
import { makeSalamander } from './creature.js';
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
scene.traverse(o => { if (o.isMesh || o.isInstancedMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(patchDark); });
mountAudioPanel();
const fireY = H(FIRE.x, FIRE.z);
DARK.uFire.value.set(FIRE.x, fireY, FIRE.z);
for (const c of isl.chunks) c.dist = Math.max(0, Math.hypot(c.cx - FIRE.x, c.cz - FIRE.z) - 0.45 * c.rad);
const totalArea = isl.chunks.reduce((s, c) => s + c.quads.length, 0);

// ── 状態 ──
const st = { night: 1, t: 0, F: RULE.fuel0, burning: [], out: 0, phase: 'title', shownR: lightRadius(RULE.fuel0), dawnK: 0, burnedAny: false, returns: [] };
let carry = null, hover = null;
const loose = []; // 島の外へ落とした物

// ── 運ぶ物の目じるし（いまやること1つだけ脈打つ） ──
const glint = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,220,160,1)'); gr.addColorStop(0.3, 'rgba(255,150,60,.5)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true })); s.renderOrder = 10; s.visible = false; scene.add(s); return s; })();
// くべる場所の輪（運んでいるあいだだけ）
const dropRing = new THREE.Mesh(new THREE.RingGeometry(RULE.dropR - 0.06, RULE.dropR, 48), new THREE.MeshBasicMaterial({ color: '#ffb060', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
dropRing.rotation.x = -Math.PI / 2; dropRing.position.set(FIRE.x, fireY + 0.08, FIRE.z); dropRing.renderOrder = 9; scene.add(dropRing);

function centerOf(obj) { const b = new THREE.Box3().setFromObject(obj); return b.getCenter(new THREE.Vector3()).setY(b.max.y); }
// はじめの案内: 火から少し離れた乾いた物（運ぶ動きが見えるように。火のすぐそばの物は案内が火に重なる）
function nearestBurnable() { let best = null, bd = 1e9; for (const b of V.burnables) { if (b.burned || b.lost || b.carried || b.house || b.kind !== 'dry') continue; const p = centerOf(b.obj), d = Math.hypot(p.x - FIRE.x, p.z - FIRE.z); if (d > 1.3 && d < bd) { bd = d; best = b; } } return best; }

// ── 入力: 燃える物を押せばつまむ、ほかは島を回す ──
const cv = $('c'), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pointers = new Map();
let rotating = false, idle = 0;
function pickAt(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(scene.children, true);
  for (const h of hits) { const id = h.object.userData.bid; if (id === undefined) { if (h.object.isMesh && !h.object.userData.nopick && !h.object.material.transparent && h.object.visible) break; continue; } const b = V.burnables[id]; if (!b.burned && !b.lost) return b; }
  // 当たらなくても、押した所の近く（指の太さ 40px）にあればつまむ
  let best = null, bd = 40;
  for (const b of V.burnables) { if (b.burned || b.lost || b.carried) continue; const p = centerOf(b.obj).project(camera); if (p.z > 1) continue; const d = Math.hypot((p.x * 0.5 + 0.5) * innerWidth - e.clientX, (-p.y * 0.5 + 0.5) * innerHeight - e.clientY); if (d < bd) { bd = d; best = b; } }
  return best;
}
function groundAt(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -fireY), p);
  for (let i = 0; i < 3; i++) { const y = H(p.x, p.z); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p); } // 地面の高さに合わせて2〜3回やり直す
  return p;
}
cv.addEventListener('pointerdown', e => {
  if (st.phase !== 'play') return;
  cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); idle = 0;
  const b = pointers.size === 1 ? pickAt(e) : null;
  if (b) {
    carry = { b, home: b.obj.parent, p: groundAt(e) }; b.carried = true;
    scene.attach(b.obj); carry.lift = 0;
    const box = new THREE.Box3().setFromObject(b.obj); carry.off = b.obj.position.clone().sub(box.getCenter(new THREE.Vector3())).setY(b.obj.position.y - box.min.y);
    b._off = carry.off;
    sfx('sfx-pick', 0.7, 0.9 + Math.random() * 0.2); cv.classList.add('carry');
  } else rotating = true;
});
cv.addEventListener('pointermove', e => {
  const prev = pointers.get(e.pointerId);
  if (!prev) { if (e.pointerType === 'mouse' && st.phase === 'play') { hover = pickAt(e); cv.style.cursor = hover ? 'grab' : ''; } return; }
  if (pointers.size === 2) { const [a, b] = [...pointers.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); const [c, d] = [...pointers.values()]; view.zoom = THREE.MathUtils.clamp(view.zoom * d0 / Math.max(1, Math.hypot(c.x - d.x, c.y - d.y)), 0.45, 1.5); return; }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (carry) { carry.p = groundAt(e); return; }
  if (rotating) { view.az -= (e.clientX - prev.x) * 0.006; view.el = THREE.MathUtils.clamp(view.el + (e.clientY - prev.y) * 0.004, 0.15, 1.2); }
});
function release(e) {
  pointers.delete(e.pointerId);
  if (pointers.size) return;
  rotating = false; cv.classList.remove('carry');
  if (!carry) return;
  const { b, p } = carry; carry = null; b.carried = false;
  if (st.phase !== 'play') { putDown(b, p); return; }
  if (Math.hypot(p.x - FIRE.x, p.z - FIRE.z) < RULE.dropR) burn(b);
  else putDown(b, p);
}
cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);
cv.addEventListener('wheel', e => { e.preventDefault(); view.zoom = THREE.MathUtils.clamp(view.zoom * Math.exp(e.deltaY * 0.001), 0.45, 1.5); idle = 0; }, { passive: false });

function putDown(b, p) {
  const id = chunkIdAt(p.x, p.z), c = id >= 0 ? isl.all[id] : null;
  if (!c || c.fallen) { b.lost = true; loose.push({ obj: b.obj, v: 0 }); return; } // 島の外 → 奈落へ
  b.obj.position.set(p.x + carry0(b).x, H(p.x, p.z) + carry0(b).y, p.z + carry0(b).z);
  c.group.attach(b.obj); b.obj.userData.chunks = new Set([id]); V.onChunk[id].push(b.obj);
}
const carry0 = b => b._off || (b._off = new THREE.Vector3());
function burn(b) {
  b.burned = true; st.burnedAny = true;
  const B = BURN[b.kind];
  st.burning.push({ left: b.fuel, total: b.fuel, secs: B.secs, smoke: B.smoke });
  // くべる動き: 火の上で小さくなって消える
  sinking.push({ obj: b.obj, t: 0 });
  fx.burst(Math.min(1.3, b.fuel / 9)); R3.grade.uniforms.flash.value = Math.min(0.12, 0.03 + b.fuel / 200);
  sfx(Math.random() < 0.5 ? 'sfx-flare' : 'sfx-flare2', 0.6 + Math.min(0.4, b.fuel / 40));
  if (b.rootChunk !== undefined) { const c = isl.all[b.rootChunk]; c.root = false; c.s = Math.max(0.05, c.s - RULE.rootShock); shake.push({ c, t: 0.6 }); } // 根がなくなる
  if (b.house && b.house.roof === b) b.house.roofless = true;
  $('hint').hidden = true;
  showToast(`${b.name}をくべた`);
}
const sinking = [], shake = [];

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
function showToast(s) { const el = $('toast'); el.textContent = s; el.classList.add('on'); toastT = 1.6; }
function hud() {
  $('bar').style.transform = `scaleX(${Math.min(1, st.t / RULE.night)})`; $('nightNo').textContent = `第${st.night}夜`;
  const hint = $('hint');
  // 目じるしの光は、遊んでいるあいだだけ（どの物にも重ねて描くので、呑まれたあとに残すと岩の向こうに透けて見えた）
  let gl = null;
  if (st.phase === 'play' && !carry) {
    if (!st.burnedAny) { const b = nearestBurnable(); if (b) { gl = b; const p = centerOf(b.obj).project(camera); hint.hidden = false; hint.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`; hint.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight - 30}px`; } else hint.hidden = true; }
    else { hint.hidden = true; if (hover) gl = hover; }
  } else hint.hidden = true;
  glint.visible = !!gl; if (gl) glint.position.copy(centerOf(gl.obj)).add(new THREE.Vector3(0, 0.14, 0));
  const tag = $('tag');
  if (carry) { tag.hidden = false; const p = carry.b.obj.position.clone().project(camera); tag.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`; tag.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight - 40}px`; tag.textContent = `${carry.b.name}　${'▮'.repeat(Math.max(1, Math.round(carry.b.fuel / 4)))}`; }
  else if (hover && st.phase === 'play') { tag.hidden = false; const p = centerOf(hover.obj).project(camera); tag.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`; tag.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight - 34}px`; tag.textContent = `${hover.name}　${'▮'.repeat(Math.max(1, Math.round(hover.fuel / 4)))}`; }
  else tag.hidden = true;
}

function result(won) {
  st.phase = won ? 'dawn' : 'lost';
  $('next').textContent = won ? '次の夜へ' : '岩から出直す';
  if (won) { showResult(true); st.resTimer = setTimeout(() => { $('result').hidden = false; }, 3500); }
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
  $('resTitle').textContent = won ? `第${st.night}夜が明けた` : `第${st.night}夜、島は夜に呑まれた`;
  $('resLead').textContent = won ? '残ったものに、朝の色がもどる。' : '火の番の岩だけが、おき火を抱いて漂っている。';
  $('resRows').innerHTML = rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  $('resRows').style.gridTemplateColumns = `repeat(${rows.length}, 1fr)`;
}

// ── 確かめ用: ?speed=8 で時間を速く、?auto=1 でタイトルを飛ばす（音なし） ──
const QS = new URLSearchParams(location.search), SPEED = Math.min(20, +QS.get('speed') || 1);
if (QS.get('auto')) { $('title').hidden = true; startNight(+QS.get('night') || 1); }
// ── はじめる ──
$('start').addEventListener('click', () => { $('title').hidden = true; startNight(1); startAudio(); });
$('again').addEventListener('click', () => location.reload());
$('next').addEventListener('click', () => startNight(st.night + 1));

// ── 次の夜（光で拾う。PLAN.md 2.7章）: 落ちたかけらが闇を漂って浮かび、光の輪がとどけば元の場所にくっつく ──
function startNight(n) {
  Object.assign(st, { night: n, t: 0, F: RULE.fuel0, burning: [], out: 0, phase: 'play', dawnK: 0, shown: false, lastT: 0, drift: 0, tEnd: 0 });
  C0.group.position.set(0, 0, 0); C0.group.rotation.set(0, 0, 0);
  clearTimeout(st.resTimer); $('result').hidden = true; R3.setDawn(0); // 前の夜の結果が遅れて出ないように
  // 浮かんでくる時刻（はじめの12秒は崩れを見せるので、そのあと）
  st.returns = Array.from({ length: n > 1 ? RULE.returns : 0 }, (_, i) => 12 + (i + Math.random() * 0.8) * (RULE.night - 40) / RULE.returns);
  showToast(`第${n}夜`);
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
      const k = Math.min(1, d.age / 4), away = 1.4 + 0.4 * Math.sin(d.age * 0.4 + d.seed);
      c.group.position.set(d.out.x * away, -7 + 6.2 * (1 - (1 - k) ** 3) + bob, d.out.z * away);
      c.group.rotation.set(tilt, Math.sin(d.age * 0.2 + d.seed) * 0.1, tilt * 0.7);
      const near = [...c.neighbors].some(n => !isl.all[n].fallen);
      if (k >= 1 && near && darkness(c.dist, R) < RULE.dockDark) { d.mode = 'dock'; d.age = 0; d.from = c.group.position.clone(); }
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

// ── 毎こま ──
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * SPEED; last = now;
  if (st.phase === 'play') {
    st.t += dt;
    stepFire(st, dt);
    const R = lightRadius(st.F);
    for (const c of isl.chunks) { if (!c.drift && stepChunk(c, R, dt)) fall(c); }
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
  const Rt = st.phase === 'lost' ? RULE.emberR : lightRadius(st.F);
  st.shownR += (Rt + fx.flare * 0.4 - st.shownR) * Math.min(1, dt * 3);
  if (st.phase === 'dawn') st.dawnK = Math.min(1, st.dawnK + dt / 4);
  DARK.uR.value = st.shownR; DARK.uDark.value = 1 - st.dawnK; R3.setDawn(st.dawnK);
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
  if (carry) { const b = carry.b; carry.lift = Math.min(1, carry.lift + dt * 6); const tgt = new THREE.Vector3(carry.p.x, H(carry.p.x, carry.p.z) + 0.15 + 0.45 * carry.lift, carry.p.z).add(carry.off); b.obj.position.lerp(tgt, Math.min(1, dt * 14)); b.obj.rotation.z = Math.sin(st.t * 5) * 0.05; }
  const near = carry ? Math.hypot(carry.p.x - FIRE.x, carry.p.z - FIRE.z) < RULE.dropR : false;
  dropRing.material.opacity = carry ? (near ? 0.9 : 0.35 + 0.15 * Math.sin(now / 200)) : 0; dropRing.scale.setScalar(near ? 1.08 : 1);
  for (let i = sinking.length - 1; i >= 0; i--) { const s = sinking[i]; s.t += dt * 2.5; s.obj.position.lerp(new THREE.Vector3(FIRE.x, fireY + 0.1, FIRE.z), Math.min(1, dt * 8)); s.obj.scale.multiplyScalar(Math.max(0.2, 1 - dt * 3)); if (s.t >= 1) { s.obj.removeFromParent(); sinking.splice(i, 1); } }
  for (const l of loose) { l.v += 7 * dt; l.obj.position.y -= l.v * dt; if (l.obj.position.y < -40) l.obj.visible = false; }
  if (glint.visible) { const p = 0.5 + 0.5 * Math.sin(now / 260); glint.scale.setScalar(0.35 + 0.25 * p); glint.material.opacity = 0.5 + 0.5 * p; }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
  idle += dt; if (idle > 6 && !pointers.size && st.phase !== 'play') view.az += dt * 0.04;
  const smokeK = st.burning.reduce((s, b) => s + b.smoke * (b.left / b.total), 0);
  fx.update(now / 1000, dt, { F: st.phase === 'lost' ? 0 : st.F, smokeK: Math.min(1, smokeK), camera, out: st.out });
  sal.update(now / 1000, dt, { F: st.phase === 'lost' ? 0 : st.F, flare: fx.flare, lost: st.phase === 'lost' });
  tickAudio({ fire: st.F > 0 ? 0.35 + 0.65 * Math.sqrt(st.F / RULE.fuelMax) : 0.15, walk: carry ? 1 : 0 });
  hud();
  R3.render(now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__game = { st, isl, V, view, RULE, camera, fx, burn, fall, FIRE, chunkIdAt, startNight, sal }; // 確かめ用（tools/ と手で）
