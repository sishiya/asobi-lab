'use strict';
// 操作とループ: 天球を回す・タップで止める、大地をなぞって盛る／削る（外へなぞると盛る、内へなぞると削る）、
// 寄る・動かす、お題の進み、知らせ、記録。画面のまわりは ui.js。
const canvas = $('#view'), ctx = canvas.getContext('2d');
let Wd, L, view, G, fly = null;
let speed = 1, thumbMode = false;

function newGame(seed) {
  Wd = makeWorld(seed || 1);
  L = makeLife(Wd, 60);
  view = { x: CX, y: CY, z: 1 };
  G = { qi: 0, qStart: 0, meet0: 0, over: false, lastSpring: false, tsunamiT: -99, waveAt: null, firstLander: false, heatT: -99, iceT: -99, histT: 0 };
  hist.length = 0; labels.length = 0;
  $('#epi').value = 0;
  updateQuestBox();
}

$('#overlay').addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  Sound.unlock(); Sound.play('click');
  if (act === 'go' || act === 'close') closePanel();
  if (act === 'reset') { newGame((Math.random() * 1e9) | 0); closePanel(); }
});

// ---- 画面の大きさと視点 ------------------------------------------------------
let cw = 0, ch = 0, dpr = 1;
function resize() {
  const r = canvas.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cw = r.width; ch = r.height;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  if (thumbMode) drawWorld(ctx, Wd, L, view, cw, ch, dpr, {});   // 大きさを変えると絵が消えるので描き直す（サムネイルは rAF で回さない）
}
addEventListener('resize', resize);
const scale = () => Math.max(1, Math.min(cw, ch)) / WSIZE * view.z;   // 枠が見えない（大きさ 0）ときも割り算がこわれないように
const toWorld = (px, py) => { const s = scale(); return [view.x + (px - cw / 2) / s, view.y + (py - ch / 2) / s]; };
function clampView() {
  if (!isFinite(view.x) || !isFinite(view.y)) { view.x = CX; view.y = CY; }
  view.z = Math.max(1, Math.min(4, view.z));
  const lim = 500 - 500 / view.z;
  view.x = Math.max(CX - lim, Math.min(CX + lim, view.x));
  view.y = Math.max(CY - lim, Math.min(CY + lim, view.y));
}
function zoomAt(px, py, f) {
  fly = null;
  const [wx, wy] = toWorld(px, py);
  view.z *= f; clampView();
  const [wx2, wy2] = toWorld(px, py);
  view.x += wx - wx2; view.y += wy - wy2; clampView();
}
function flyTo(x, y, z) { fly = { x, y, z }; }

// ---- 操作 ---------------------------------------------------------------
const ptrs = new Map();
let drag = null, pinch = null, hover = null;
// 画面の中の位置（offsetX は拡大表示のときにずれることがあるので、clientX と枠の位置から出す）
const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
function pick(wx, wy) {
  const r = Math.hypot(wx - CX, wy - CY), a = Math.atan2(wy - CY, wx - CX);
  const pad = Math.max(16, 14 / scale());
  for (const sp of Wd.sph) if (Math.abs(r - sp.r) < pad) return { type: 'sphere', s: sp };
  if (Math.abs(r - (R0 + Wd.g[idx(a)] + Wd.h[idx(a)])) < Math.max(30, 26 / scale())) return { type: 'sculpt' };
  return { type: 'pan' };
}
canvas.addEventListener('pointerdown', e => {
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* とれなくても動かせる */ }
  const [ox, oy] = local(e);
  ptrs.set(e.pointerId, { x: ox, y: oy });
  if (ptrs.size === 2) {
    if (drag?.s) drag.s.held = false;
    drag = null;
    const [p, q] = [...ptrs.values()];
    pinch = { d: Math.hypot(p.x - q.x, p.y - q.y) };
    return;
  }
  const [wx, wy] = toWorld(ox, oy);
  drag = pick(wx, wy);
  Object.assign(drag, { x: ox, y: oy, t: performance.now(), t0: performance.now(), moved: 0,
    ang: Math.atan2(wy - CY, wx - CX), r: Math.hypot(wx - CX, wy - CY) });
  if (drag.type === 'sphere') { drag.s.held = true; Sound.play('grab'); }
  if (drag.type === 'sculpt') drag.brush = drag.ang;
  canvas.classList.add('grabbing');
});
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId), [ox, oy] = local(e);
  if (!p) {
    const [wx, wy] = toWorld(ox, oy), k = pick(wx, wy);
    hover = k.type === 'sphere' ? k.s.key : null;
    canvas.style.cursor = k.type === 'sculpt' ? 'ns-resize' : '';
    return;
  }
  p.x = ox; p.y = oy;
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.d); pinch.d = d; return;
  }
  if (!drag) return;
  drag.moved += Math.hypot(ox - drag.x, oy - drag.y);
  const [wx, wy] = toWorld(ox, oy);
  const ang = Math.atan2(wy - CY, wx - CX), r = Math.hypot(wx - CX, wy - CY);
  if (drag.type === 'sphere') {
    const d = angDiff(ang, drag.ang), now = performance.now(), dt = Math.max(1, now - drag.t) / 1000;
    // 回した速さを天球の勢いに（時を速めているときは、手の速さは世界にとってゆっくり）
    const v = d / dt / Math.max(1, speed);
    // 恒星天を回すと、すべての天球がいっしょに回る（いちばん外の天球がほかを動かす）
    const list = drag.s.key === 'stars' ? Wd.sph : [drag.s];
    for (const s of list) { s.a = wrapA(s.a + d); s.v += (v - s.v) * Math.min(1, dt * 12); if (d) s.stopped = false; }
    updateMoon(Wd, 0);
  } else if (drag.type === 'sculpt') {
    // 外へなぞると盛る、内へなぞると削る
    const dr = r - drag.r;
    if (Math.abs(dr) > 0.3) {
      const before = Wd.soil;
      sculpt(Wd, ang, dr * 0.6);
      drag.raise = dr > 0;
      if (before !== Wd.soil && performance.now() - (drag.sfx || 0) > 110) { Sound.play('soil'); drag.sfx = performance.now(); }
      if (before === Wd.soil) toast(dr > 0 ? '土ぶくろが空っぽ。どこかを削ると土がたまる' : '土ぶくろがいっぱい。どこかを盛ると空く', 2);
    }
    drag.brush = ang;
  } else if (drag.type === 'pan') {
    fly = null;
    const s = scale();
    view.x -= (ox - drag.x) / s; view.y -= (oy - drag.y) / s; clampView();
  }
  drag.x = ox; drag.y = oy; drag.ang = ang; drag.r = r; drag.t = performance.now();
});
function endPtr(e) {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (drag && ptrs.size === 0) {
    if (drag.type === 'sphere') {
      const s = drag.s, list = s.key === 'stars' ? Wd.sph : [s];
      const tap = drag.moved < 6 && performance.now() - drag.t0 < 350;
      s.held = false;
      if (tap) {
        // タップ: 止める／また動かす（恒星天はすべての天球）
        const stop = !s.stopped;
        for (const x of list) { x.stopped = stop; x.v = stop ? 0 : x.nat; }
        toast(stop ? `${s.name}を止めた（もう一度タップで動く）` : `${s.name}がまた動きだした`, 2.5);
        Sound.play('pin');
      } else {
        if (performance.now() - drag.t > 120) for (const x of list) x.v = x.stopped ? 0 : x.nat;   // しばらく止めていたら勢いはなし
        Sound.play('release');
      }
    }
    drag = null; canvas.classList.remove('grabbing');
  }
}
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('pointerleave', () => { hover = null; });
canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(...local(e), Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
$('#zoomIn').onclick = () => zoomAt(cw / 2, ch / 2, 1.4);
$('#zoomOut').onclick = () => zoomAt(cw / 2, ch / 2, 1 / 1.4);
$('#epi').oninput = e => { Wd.epi = e.target.value / 100 * EPI_MAX; updateMoon(Wd, 0); };

// キー: ←→ 月、Shift＋←→ 太陽、スペースで止める
const keys = new Set();
let keyShift = false;
addEventListener('keydown', e => {
  if (e.target.closest('dialog, input')) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { keys.add(e.key); e.preventDefault(); }
  if (e.key === ' ') { e.preventDefault(); setSpeed(speed ? 0 : lastSpeed); }
  keyShift = e.shiftKey;
});
addEventListener('keyup', e => { keys.delete(e.key); keyShift = e.shiftKey; });
function applyKeys() {
  const dir = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
  const [moon, sun] = Wd.sph;
  moon.push = !keyShift ? dir * 3 : 0;
  sun.push = keyShift ? dir * 3 : 0;
  if (dir) (keyShift ? sun : moon).stopped = false;
}

// ---- 横の操作 -----------------------------------------------------------
let lastSpeed = 1;
function setSpeed(v) {
  if (v) lastSpeed = v;
  speed = v;
  document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.speed === v)));
}
document.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => { Sound.play('click'); setSpeed(+b.dataset.speed); });
$('#btnReset').onclick = () => { Sound.play('click'); newGame((Math.random() * 1e9) | 0); startPanel(); };
$('#btnAbout').onclick = () => $('#about').showModal();
function soundBtn(sel, kind) {
  const bs = document.querySelectorAll(sel);
  const sync = () => bs.forEach(b => b.setAttribute('aria-pressed', String(Sound.get(kind))));
  bs.forEach(b => b.onclick = () => { Sound.unlock(); Sound.set(kind, !Sound.get(kind)); sync(); });
  sync();
}
soundBtn('.btnBgm', 'bgm'); soundBtn('#btnSfx', 'sfx');

// ---- お題と知らせ ----------------------------------------------------------
let uiT = 0;
function checkWorld() {
  const S = lifeStats(L);
  updateSide(S);
  if (G.over || thumbMode) return;
  const sp = springness(Wd), calm = Wd.sph.slice(0, 2).every(s => Math.abs(s.v - s.nat) < 0.2);
  const spring = sp > 0.95;
  if (spring && !G.lastSpring && calm) { toast('月と太陽が並んだ。大潮だ'); Sound.play('spring'); }
  G.lastSpring = spring;
  if (Wd.maxU > 110 && Wd.t - G.tsunamiT > 6) { G.tsunamiT = Wd.t; G.waveAt = L.deaths.wave; toast('津波だ！ 天球を回しすぎた', 3.5); Sound.play('tsunami'); }
  if (G.waveAt != null && Wd.t - G.tsunamiT > 5) {
    const n = L.deaths.wave - G.waveAt; G.waveAt = null;
    if (n > 0) toast(`波で ${n} 匹が流された`);
  }
  let tMax = -99, ice = 0;
  for (let i = 0; i < N; i++) { if (Wd.T[i] > tMax) tMax = Wd.T[i]; ice += Wd.ice[i]; }
  if (tMax > 42 && Wd.t - G.heatT > 30) { G.heatT = Wd.t; toast(`日の当たる側が ${Math.round(tMax)} 度に。水が蒸発して雲になる`, 4); }
  if (ice > 3 && Wd.t - G.iceT > 30) { G.iceT = Wd.t; toast('夜の側の海が凍った。凍った海は潮でも動かない', 4); }
  if (!G.firstLander && S.landers > 0) { G.firstLander = true; toast(`はじめて陸の生き物があらわれた（第 ${L.maxGen} 世代）`, 4); Sound.play('lander'); }
  const q = QUESTS[G.qi];
  if (q) {
    const [v, goal] = q.prog(S, Wd, L, G);
    if (v >= goal) {
      const days = Math.max(1, Math.ceil((Wd.t - G.qStart) / DAY));
      Sound.play('win'); questPanel(G.qi, days);
      G.qi++; G.qStart = Wd.t; G.meet0 = L.meets; updateQuestBox();
    }
  }
  if (S.n === 0) { G.over = true; Sound.play('lose'); losePanel(); }
}

// ---- ループ --------------------------------------------------------------
let lastT = performance.now();
function step(realDt) {
  applyKeys();
  const paused = !$('#overlay').hidden;
  const simDt = paused ? 0 : realDt * speed;
  if (simDt > 0) {
    stepWorld(Wd, simDt);
    for (let t = simDt; t > 0; t -= 0.05) stepLife(Wd, L, Math.min(0.05, t));
    handleEvents();
    G.histT -= simDt; if (G.histT <= 0) { recordHistory(); G.histT = DAY / 2; }
  } else {
    updateMoon(Wd, 0);   // 止めていても、つかんだ天球の向きに潮の形を合わせる
    stepWater(Wd, 0.0001);
  }
  if (fly) {
    const k = Math.min(1, realDt * 5);
    view.x += (fly.x - view.x) * k; view.y += (fly.y - view.y) * k; view.z += (fly.z - view.z) * k; clampView();
    if (Math.abs(fly.z - view.z) < 0.01) fly = null;
  }
  for (const lb of labels) lb.t -= realDt;
  while (labels.length && labels[0].t <= 0) labels.shift();
  if (toastTimer > 0 && (toastTimer -= realDt) <= 0) $('#toast').classList.remove('on');
  uiT -= realDt; if (uiT <= 0) { checkWorld(); drawChart(); uiT = 0.25; }
  Sound.update(Wd.maxU, simDt === 0);
}
function render() {
  drawWorld(ctx, Wd, L, view, cw, ch, dpr, { hover: drag?.s?.key || hover, brush: drag?.type === 'sculpt' ? drag.brush : null, raise: drag?.raise, labels });
}
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  step(dt); render();
  requestAnimationFrame(frame);
}

newGame(1);
resize();
// サムネイル撮影（tools/make-thumbs.ps1）: 種がいくつかに分かれた世界を、全体で見せる
if (/[?&]thumb\b/.test(location.search)) {
  thumbMode = true; document.body.classList.add('thumb'); resize();
  for (let k = 0; k < 1300 * 20; k++) { stepWorld(Wd, 0.05); stepLife(Wd, L, 0.05); }
  L.events.length = 0;
  Wd.epi = 0.1; updateMoon(Wd, 0);
  view = { x: CX, y: CY, z: 1.05 };
  drawWorld(ctx, Wd, L, view, cw, ch, dpr, {});
} else {
  startPanel();
  requestAnimationFrame(frame);
}

// デバッグ用（DEVNOTES）。Browser ペインが裏だと rAF が止まるので step で進める
window.__hs = {
  get W() { return Wd; }, get L() { return L; }, get G() { return G; }, get view() { return view; },
  step(sec) { for (let t = sec; t > 0; t -= 0.05) step(Math.min(0.05, t)); render(); },
  setSpeed, newGame, stats: () => lifeStats(L),
};
