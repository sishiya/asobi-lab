// ルックの実験室: 同じ景色を、ルックを切りかえて見くらべる。0〜4 のキーか下のボタン。WASD・ドラッグで歩く（さわらないと散歩する）。
import * as THREE from 'three';
import { buildScene } from './scene.js';
import { LOOKS } from './looks.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const world = buildScene();
// ライト（光の当たる所では群れが体をつなぎとめられない。見本は「魚」）。マウスの所を照らす。さわらないと勝手にぐるぐる
const torch = new THREE.SpotLight(0xfff4dc, 0, 40, 0.32, 0.55, 0.6); torch.castShadow = false; world.scene.add(torch, torch.target);
const aim = { x: 0.5, y: 0.5, t: -99 }, ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { aim.x = e.clientX / innerWidth; aim.y = e.clientY / innerHeight; aim.t = performance.now(); } });
function updateTorch(t) {
  const on = !!LOOKS[cur].light; torch.intensity = on ? 900 : 0; if (!on) return;
  let x = aim.x, y = aim.y;
  if (performance.now() - aim.t > 3000) { x = 0.5 + Math.cos(t * 0.6) * 0.18; y = 0.55 + Math.sin(t * 0.9) * 0.15; }
  ray.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), world.camera);
  if (ray.ray.intersectPlane(plane, hit)) { torch.target.position.copy(hit); torch.position.set(hit.x - 2, 12, hit.z + 4); }
}
const ctx = { renderer, scene: world.scene, camera: world.camera, walker: world.walker, ground: world.ground, sun: world.sun };
for (const L of LOOKS) L.init?.(ctx);

// ボタン
const bar = document.getElementById('looks'), note = document.getElementById('note');
let cur = 0;
let grp = null, row;
LOOKS.forEach((L, i) => {
  if (L.group !== grp) { grp = L.group; row = document.createElement('div'); row.className = 'grp'; if (grp) { const h = document.createElement('span'); h.className = 'glabel'; h.textContent = grp; row.appendChild(h); } bar.appendChild(row); }
  const b = document.createElement('button'); b.type = 'button'; b.textContent = L.ja; b.dataset.i = i; b.title = i < 10 ? `キー ${i}` : '';
  b.addEventListener('click', () => pick(i));
  row.appendChild(b);
});
function pick(i) {
  cur = i;
  bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.i === i));
  note.textContent = LOOKS[i].note;
  document.body.dataset.look = i;
  try { localStorage.setItem('look-lab', i); } catch (e) {}
}
const q = new URLSearchParams(location.search);
let start = +(q.get('look') ?? (() => { try { return localStorage.getItem('look-lab'); } catch (e) { return 0; } })() ?? 0) || 0;
pick(Math.min(LOOKS.length - 1, Math.max(0, start)));

// 操作
const keys = new Set(), input = { x: 0, z: 0 };
addEventListener('keydown', (e) => { keys.add(e.code); const n = +e.key; if (e.key >= '0' && e.key <= '9' && n < LOOKS.length) pick(n); });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const drag = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => { drag.id = e.pointerId; drag.ox = e.clientX; drag.oy = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (e.pointerId !== drag.id) return; drag.x = Math.max(-1, Math.min(1, (e.clientX - drag.ox) / 50)); drag.y = Math.max(-1, Math.min(1, (e.clientY - drag.oy) / 50)); });
const up = (e) => { if (e.pointerId === drag.id) { drag.id = null; drag.x = drag.y = 0; } };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
function readInput() {
  input.x = (keys.has('KeyD') || keys.has('ArrowRight')) - (keys.has('KeyA') || keys.has('ArrowLeft')) + drag.x;
  input.z = (keys.has('KeyS') || keys.has('ArrowDown')) - (keys.has('KeyW') || keys.has('ArrowUp')) + drag.y;
}

function onResize() {
  const w = innerWidth, h = innerHeight, dpr = renderer.getPixelRatio();
  renderer.setSize(w, h, false);
  world.camera.aspect = w / h; world.camera.updateProjectionMatrix();
  for (const L of LOOKS) L.resize?.(w * dpr, h * dpr, dpr);
}
addEventListener('resize', onResize); onResize();

let last = performance.now(), t = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  readInput(); world.update(t, dt, input); updateTorch(t);
  LOOKS[cur].render(ctx, t, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__ll = { ctx, LOOKS, pick, world };
