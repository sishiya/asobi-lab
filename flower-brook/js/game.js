// 花の小川 段階A1 の画面。見た目は丸と線だけ（ルックは look/ で決めてから A2 で）。決まりは js/sim.js。
// 手: 指を置いた位置で決める（左右＝寄る岸、高さ＝速さ。上ほど速い）。はなすと、その場でとどまる。
// キー: ←→ 岸、↑↓ 速さ、スペース（押しているあいだ）進む。?seed=<番号> で川を選ぶ。
import { RULE, newState, step, gradeOf, bloomOf, squeezeAt } from './sim.js';

const cv = document.getElementById('view'), g = cv.getContext('2d');
const $ = id => document.getElementById(id);
const FLOWER = ['', 'スズランの小さな鈴', 'アジサイの房', '枝咲きのフジ', '大輪のシャクヤク', '八重の花びら', 'タンポポの綿毛', '霧の虹'];

let W = 0, H = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize); resize();

const q = new URLSearchParams(location.search);
let seed = +(q.get('seed') || 1 + Math.floor(Math.random() * 9999));
let S = newState(seed), paused = false, acc = 0, last = performance.now();

// ---------- 入力 ----------
const input = { hold: false, u: 0.5, x: 0 };
const keys = new Set();
let pointerId = null;
function fromPointer(e) {
  const lead = S.beads[0];
  const rw = riverW();
  input.x = Math.max(-1, Math.min(1, (e.clientX - cx(lead.s)) / (rw / 2)));
  input.u = Math.max(0, Math.min(1, (H * 0.92 - e.clientY) / (H * 0.8)));
}
cv.addEventListener('pointerdown', e => { pointerId = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch {} input.hold = true; fromPointer(e); });
cv.addEventListener('pointermove', e => { if (e.pointerId === pointerId) fromPointer(e); });
const up = e => { if (e.pointerId === pointerId) { pointerId = null; input.hold = false; } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
addEventListener('keydown', e => { keys.add(e.key); if (e.key === ' ') e.preventDefault(); if (e.key === 'Escape') togglePause(); });
addEventListener('keyup', e => keys.delete(e.key));
function keyInput(dt) {
  if (!keys.size) return;
  if (keys.has('ArrowLeft')) input.x = Math.max(-1, input.x - 1.6 * dt);
  if (keys.has('ArrowRight')) input.x = Math.min(1, input.x + 1.6 * dt);
  if (keys.has('ArrowUp')) input.u = Math.min(1, input.u + 0.8 * dt);
  if (keys.has('ArrowDown')) input.u = Math.max(0, input.u - 0.8 * dt);
  if (pointerId === null) input.hold = keys.has(' ');
}
function togglePause() { paused = !paused; $('pauseBtn').textContent = paused ? '▶' : 'II'; }
$('pauseBtn').onclick = togglePause;
$('again').onclick = () => restart(1 + Math.floor(Math.random() * 9999));
$('same').onclick = () => restart(seed);
function restart(sd) { seed = sd; S = newState(seed); $('overlay').hidden = true; acc = 0; }

// ---------- 川の形（s → 画面） ----------
const scale = () => Math.min(1.4, Math.max(0.7, W / 520));
const riverW = () => Math.min(W - 80, 200 * scale());
function cx(s) { return W / 2 + (W / 2 - riverW() / 2 - 24) * 0.7 * Math.sin(s / 380) * Math.cos(s / 1300); }
let camS = 0;
const LEADY = 0.5;  // 先頭の高さ（列は上へのびる。指は下半分に置くので、列は隠れない）
const sy = s => H * LEADY + (s - camS) * scale();
const px = (s, x) => cx(s) + x * riverW() / 2 * 0.82;

// ---------- 描く ----------
function wcol(w) {  // 水の量 → 色（すき通った水色 → はちみつ色 → 琥珀。茶色にしない）
  const t = Math.max(0, Math.min(1, (RULE.w0 - w) / (RULE.w0 - RULE.wFloor)));
  const a = [150, 220, 240], b = [246, 200, 90], c = [214, 140, 40];
  const m = t < 0.6 ? a.map((v, i) => v + (b[i] - v) * t / 0.6) : b.map((v, i) => v + (c[i] - v) * (t - 0.6) / 0.4);
  return `rgb(${m.map(Math.round).join(',')})`;
}
function draw() {
  const B = S.beads, sc = scale(), rw = riverW();
  camS += (B[0].s - camS) * 0.12;
  if (Math.abs(B[0].s - camS) > H / sc) camS = B[0].s;  // やり直し・飛んだときは、すぐ追いつく
  g.fillStyle = '#3f7a4f'; g.fillRect(0, 0, W, H);
  const s0 = camS - H * LEADY / sc - 40, s1 = camS + H * (1 - LEADY) / sc + 40;

  // 花の区画（岸）
  for (const p of S.course.patches) {
    if (p.s1 < s0 || p.s0 > s1) continue;
    for (let k = 0; k < 3; k++) {
      const s = p.s0 + (k + 0.5) * (p.s1 - p.s0) / 3;
      const x = px(s, p.side * 1.32), y = sy(s);
      if (p.sun) { g.fillStyle = '#e8d77a55'; g.beginPath(); g.arc(x, y, 26 * sc, 0, 7); g.fill(); }
      const need = p.rare ? RULE.patch.rareBloom : RULE.patch.bloom;
      const b = Math.min(1, p.drunk / need);
      g.fillStyle = p.rare ? '#ff7fb0' : '#f4f1e6';
      g.globalAlpha = 0.35 + 0.65 * b;
      g.beginPath(); g.arc(x, y, (3 + 9 * b) * sc * (p.rare ? 1.3 : 1), 0, 7); g.fill();
      g.globalAlpha = 1;
      if (b >= 1) { g.fillStyle = '#ffe07a'; g.beginPath(); g.arc(x, y, 3 * sc, 0, 7); g.fill(); }
    }
  }
  // 川
  g.fillStyle = '#5aa6c8';
  g.beginPath();
  for (let s = s0; s <= s1; s += 12) g.lineTo(cx(s) - rw / 2, sy(s));
  for (let s = s1; s >= s0; s -= 12) g.lineTo(cx(s) + rw / 2, sy(s));
  g.fill();
  // 池
  const pond0 = RULE.len - RULE.pond.len;
  if (s1 > pond0) {
    g.fillStyle = '#4b93b8';
    g.beginPath(); g.ellipse(cx(RULE.len - RULE.pond.len / 2), sy(RULE.len - RULE.pond.len / 2), rw * 0.75, RULE.pond.len / 2 * sc, 0, 0, 7); g.fill();
    g.fillStyle = '#ffb3cf'; g.beginPath(); g.arc(cx(RULE.len), sy(RULE.len) + 14 * sc, 18 * sc, 0, 7); g.fill();
  }
  // 大きな流れ
  for (const wv of S.course.waves) if (wv.front !== null && !wv.used && wv.front > s0 && wv.front < s1) {
    g.strokeStyle = '#ffffffaa'; g.lineWidth = 6 * sc;
    g.beginPath(); g.moveTo(cx(wv.front) - rw / 2, sy(wv.front)); g.lineTo(cx(wv.front) + rw / 2, sy(wv.front)); g.stroke();
  }
  // わら
  g.strokeStyle = '#d9c27a'; g.lineWidth = 3 * sc;
  for (const f of S.course.fibers) if (!f.taken && f.s > s0 && f.s < s1) {
    const x = px(f.s, f.x), y = sy(f.s);
    g.beginPath(); g.moveTo(x - 8 * sc, y - 3 * sc); g.lineTo(x + 8 * sc, y + 3 * sc); g.stroke();
  }
  // アーチ（すぼまると、両岸から花のつるがせり出す）
  const thMul = S.thunder?.kind === 'squeeze' ? RULE.thunder.squeeze : 1;
  for (const a of S.course.arches) {
    if (a.s < s0 || a.s > s1) continue;
    const p = Math.min(1, squeezeAt(a, S.t) * thMul), y = sy(a.s), half = RULE.arch.half * sc;
    g.fillStyle = thMul > 1 ? '#c94f7c' : '#7c5aa6';
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx(a.s) + side * rw / 2, y - half);
      g.quadraticCurveTo(cx(a.s) + side * rw / 2 * (1 - 0.85 * p), y, cx(a.s) + side * rw / 2, y + half);
      g.fill();
    }
  }
  // 玉の列
  for (let i = 0; i < B.length - 1; i++) {
    const L = S.links[i]; if (!L.on) continue;
    const a = B[i], c = B[i + 1];
    g.strokeStyle = wcol((a.w + c.w) / 2); g.lineWidth = (L.clump ? 6 : 12) * sc;
    g.beginPath(); g.moveTo(px(a.s, a.x), sy(a.s)); g.lineTo(px(c.s, c.x), sy(c.s)); g.stroke();
  }
  for (const b of B) {
    const x = px(b.s, b.x), y = sy(b.s), r = (b.pellet ? 6 : 8) * sc;
    g.fillStyle = wcol(b.w); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    if (b.w > 0.74) { g.fillStyle = '#ffffff99'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, 7); g.fill(); }  // つや
    if (b.pellet) { g.strokeStyle = '#8a5a1a'; g.lineWidth = 1.5; g.stroke(); }
  }
  // 指の位置（押しているあいだ）
  if (input.hold && pointerId !== null) {
    g.strokeStyle = '#ffffff66'; g.lineWidth = 2;
    g.beginPath(); g.arc(px(B[0].s, input.x), H * 0.92 - input.u * H * 0.8, 22, 0, 7); g.stroke();
  }
  if (S.thunder && Math.floor(S.t * 4) % 6 === 0) { g.fillStyle = '#ffffff22'; g.fillRect(0, 0, W, H); }

  // 上の文字（A1 はしらべ用に数も出す）
  const bl = bloomOf(S);
  $('time').textContent = `${S.t.toFixed(0)}秒`;
  $('pred').textContent = `いまのまま→${gradeOf(S)}段　めずらしい花 ${bl.rare}/${bl.rareAll}`;
  $('ev').textContent = S.thunder ? (S.thunder.kind === 'squeeze' ? '雷: アーチが強く締まる' : '雷: 流れが急') : S.ride > 0 ? '大きな流れに乗った' : '';
}

// ---------- まわす ----------
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  keyInput(dt);
  if (!paused && !S.done) {
    acc += dt;
    while (acc >= RULE.dt) { step(S, input); acc -= RULE.dt; }
    if (S.done) showResult();
  }
  draw();
  requestAnimationFrame(frame);
}
function showResult() {
  const bl = bloomOf(S);
  $('resName').textContent = FLOWER[S.grade];
  $('resInfo').innerHTML = `${S.grade}段（しらべ用）・${S.t.toFixed(0)}秒<br>めずらしい花 ${bl.rare}/${bl.rareAll}・ふつうの花 ${bl.normal}/${bl.normalAll}<br>川の番号 ${seed}`;
  $('overlay').hidden = false;
}
window.__fb = { get S() { return S; }, input, restart };  // しらべ用
requestAnimationFrame(frame);
