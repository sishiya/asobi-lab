'use strict';
// 画面と操作: ループ、天球を回す・地をなぞる・寄る・動かす、お題、知らせ、記録。
const $ = s => document.querySelector(s);
const GOAL = 30;                         // 陸の生き物がこの数そろえばお題クリア
const STAR_DAYS = [20, 32];              // この日数以内で ★3・★2
const BEST_KEY = 'asobi-lab/heaven-spheres/best-v1';

const canvas = $('#view'), ctx = canvas.getContext('2d');
let Wd, L, view, G;
let speed = 1, tool = 'look', thumbMode = false;

function newGame(seed) {
  Wd = makeWorld(seed || 1);
  L = makeLife(Wd, 60);
  view = { x: CX, y: CY, z: 1 };
  G = { cleared: false, over: false, toastT: 0, lastSpring: false, tsunamiT: 0, deathsSeen: 0, firstLander: false, lastWave: 0 };
}

// ---- 知らせ -------------------------------------------------------------
let toastTimer = 0;
function toast(text, sec = 3) { const t = $('#toast'); t.textContent = text; t.classList.add('on'); toastTimer = sec; }

// ---- 札（はじめ・クリア・全滅） -----------------------------------------------
function panel(html) { $('#panel').innerHTML = html; $('#overlay').hidden = false; }
function closePanel() { $('#overlay').hidden = true; }
function startPanel() {
  panel(`<h2>天をまわす箱庭</h2>
    <p>世界の真ん中に、小さな大地がある。まわりを月・太陽・星の天球がめぐっている。きみは神の手で天球を回し、大地の形を変えられる。</p>
    <p><b>第一のお題:</b> 海の生き物を、陸で暮らせる生き物にしよう（陸の生き物 ${GOAL} 匹）。</p>
    <p class="truth">ヒント: 月は水を引きよせ、潮が満ち引きする。潮が引くと浜に取り残され、乾きに強いものだけが生き残る。天球を回しすぎると津波になる。</p>
    <div class="btns"><button class="tbtn main" data-act="go">はじめる</button></div>`);
}
function clearPanel(days) {
  const stars = days <= STAR_DAYS[0] ? 3 : days <= STAR_DAYS[1] ? 2 : 1;
  let best = null; try { best = JSON.parse(localStorage.getItem(BEST_KEY)); } catch (e) { /* なし */ }
  const isBest = !best || days < best.days;
  if (isBest) try { localStorage.setItem(BEST_KEY, JSON.stringify({ days, stars })); } catch (e) { /* なし */ }
  panel(`<h2>お題クリア</h2>
    <p class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
    <p style="text-align:center">第 ${days} 日に、陸の生き物が ${GOAL} 匹になった（第 ${L.maxGen} 世代）${isBest ? '。いちばんの記録' : `。いちばんは第 ${best.days} 日`}</p>
    <p class="truth"><b>本当は:</b> 潮の満ち引きは月と太陽の引く力で起きる。ただし回っているのは天球ではなく地球のほう。潮が満ち引きする浜や潮だまりが、生き物の上陸を助けたという説がある。</p>
    <div class="btns"><button class="tbtn main" data-act="close">このまま見る</button><button class="tbtn" data-act="reset">最初から</button></div>`);
}
function losePanel() {
  panel(`<h2>生き物がいなくなった</h2>
    <p>海の生き物がすべて死んでしまった。津波が多すぎたか、潮が強すぎたのかもしれない。</p>
    <div class="btns"><button class="tbtn main" data-act="reset">最初から</button></div>`);
}
$('#overlay').addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  Sound.unlock(); Sound.play('click');
  if (act === 'go' || act === 'close') closePanel();
  if (act === 'reset') { newGame((Math.random() * 1e9) | 0); closePanel(); }
});

// ---- 画面の大きさ ---------------------------------------------------------
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
  const [wx, wy] = toWorld(px, py);
  view.z *= f; clampView();
  const [wx2, wy2] = toWorld(px, py);
  view.x += wx - wx2; view.y += wy - wy2; clampView();
}

// ---- 操作: 天球を回す・地をなぞる・動かす -----------------------------------------
const ptrs = new Map();
// 画面の中の位置（offsetX は拡大表示のときにずれることがあるので、clientX と枠の位置から出す）
const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
let drag = null, pinch = null, hover = null;
function pick(wx, wy) {
  const r = Math.hypot(wx - CX, wy - CY), a = Math.atan2(wy - CY, wx - CX);
  const s = scale(), pad = Math.max(16, 14 / s);
  for (const sp of Wd.sph.slice(0, 2)) if (Math.abs(r - sp.r) < pad) return { type: 'sphere', s: sp };
  if (tool !== 'look' && Math.abs(r - (R0 + Wd.g[idx(a)])) < 70) return { type: 'sculpt' };
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
  drag.x = ox; drag.y = oy; drag.t = performance.now();
  drag.ang = Math.atan2(wy - CY, wx - CX);
  if (drag.type === 'sphere') { drag.s.held = true; Sound.play('grab'); }
  if (drag.type === 'sculpt') drag.brush = drag.ang;
  canvas.classList.add('grabbing');
});
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId), [ox, oy] = local(e);
  if (!p) { const [wx, wy] = toWorld(ox, oy); const k = pick(wx, wy); hover = k.type === 'sphere' ? k.s.key : null; return; }
  p.x = ox; p.y = oy;
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.d); pinch.d = d; return;
  }
  if (!drag) return;
  const [wx, wy] = toWorld(ox, oy);
  if (drag.type === 'sphere') {
    const ang = Math.atan2(wy - CY, wx - CX), d = angDiff(ang, drag.ang), now = performance.now();
    const dt = Math.max(1, now - drag.t) / 1000;
    drag.s.a = wrapA(drag.s.a + d);
    // 回した速さを天球の勢いに（時を速めているときは、手の速さは世界にとってゆっくり）
    const v = d / dt / Math.max(1, speed);
    drag.s.v += (v - drag.s.v) * Math.min(1, dt * 12);
    drag.ang = ang; drag.t = now;
  } else if (drag.type === 'sculpt') {
    drag.brush = Math.atan2(wy - CY, wx - CX);
  } else if (drag.type === 'pan') {
    const s = scale();
    view.x -= (ox - drag.x) / s; view.y -= (oy - drag.y) / s; clampView();
    drag.x = ox; drag.y = oy;
  }
});
function endPtr(e) {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (drag && ptrs.size === 0) {
    if (drag.type === 'sphere') {
      // しばらく止めていたら勢いはなし
      if (performance.now() - drag.t > 120) drag.s.v = drag.s.nat;
      drag.s.held = false; Sound.play('release');
    }
    drag = null; canvas.classList.remove('grabbing');
  }
}
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('pointerleave', () => { hover = null; });
canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(...local(e), Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
$('#zoomIn').onclick = () => { zoomAt(cw / 2, ch / 2, 1.4); };
$('#zoomOut').onclick = () => { zoomAt(cw / 2, ch / 2, 1 / 1.4); };

// キー: ←→ 月、Shift＋←→ 太陽、スペースで止める、1〜3 で道具
const keys = new Set();
addEventListener('keydown', e => {
  if (e.target.closest('dialog')) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { keys.add(e.key); e.preventDefault(); }
  if (e.key === ' ') { e.preventDefault(); setSpeed(speed ? 0 : lastSpeed); }
  if (e.key === '1') setTool('look'); if (e.key === '2') setTool('raise'); if (e.key === '3') setTool('dig');
  keyShift = e.shiftKey;
});
let keyShift = false;
addEventListener('keyup', e => { keys.delete(e.key); keyShift = e.shiftKey; });
function applyKeys() {
  const dir = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
  const [moon, sun] = Wd.sph;
  moon.push = !keyShift ? dir * 3 : 0;
  sun.push = keyShift ? dir * 3 : 0;
}

// ---- 横の操作 -----------------------------------------------------------
let lastSpeed = 1;
function setSpeed(v) {
  if (v) lastSpeed = v;
  speed = v;
  document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.speed === v)));
}
function setTool(t) {
  tool = t;
  document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
}
document.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => { Sound.play('click'); setSpeed(+b.dataset.speed); });
document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { Sound.play('click'); setTool(b.dataset.tool); });
$('#btnReset').onclick = () => { Sound.play('click'); newGame((Math.random() * 1e9) | 0); startPanel(); };
$('#btnAbout').onclick = () => $('#about').showModal();
function soundBtn(id, kind) {
  const b = $(id); b.setAttribute('aria-pressed', String(Sound.get(kind)));
  b.onclick = () => { const v = !Sound.get(kind); Sound.set(kind, v); b.setAttribute('aria-pressed', String(v)); };
}
soundBtn('#btnBgm', 'bgm'); soundBtn('#btnSfx', 'sfx');

$('#genes').innerHTML = GENES.map(g => `<span>${g.name}</span><span class="bar"><i data-gene="${g.k}"></i></span>`).join('');
$('#goal').textContent = GOAL;

// ---- ようすを横に出す・知らせる ----------------------------------------------
let uiT = 0;
function updateUI() {
  const st = lifeStats(L), day = Math.floor(Wd.t / DAY) + 1;
  $('#day').textContent = `第 ${day} 日`;
  $('#gen').textContent = `第 ${L.maxGen} 世代`;
  $('#pop').textContent = st.n;
  $('#landers').textContent = st.landers;
  $('#questBar').style.width = Math.min(100, st.landers / GOAL * 100) + '%';
  $('#soilBar').style.width = Wd.soil / SOIL_MAX * 100 + '%';
  const sp = springness(Wd);
  $('#tide').textContent = Wd.maxU > 110 ? '津波！' : sp > 0.9 ? '大潮' : sp < 0.35 ? '小潮' : 'ふつう';
  for (const g of GENES) $(`[data-gene=${g.k}]`).style.width = st.avg[g.k] * 100 + '%';

  if (G.over || thumbMode) return;
  // 大潮
  const calm = Wd.sph.slice(0, 2).every(s => Math.abs(s.v - s.nat) < 0.2);   // 回している最中は知らせない
  const spring = sp > 0.95;
  if (spring && !G.lastSpring && calm) { toast('月と太陽が並んだ。大潮だ'); Sound.play('spring'); }
  G.lastSpring = spring;
  // 津波と、流された数
  if (Wd.maxU > 110 && Wd.t - G.tsunamiT > 6) { G.tsunamiT = Wd.t; G.waveAt = L.deaths.wave; toast('津波だ！ 天球を回しすぎた', 3.5); Sound.play('tsunami'); }
  if (G.waveAt != null && Wd.t - G.tsunamiT > 5) {
    const n = L.deaths.wave - G.waveAt; G.waveAt = null;
    if (n > 0) toast(`波で ${n} 匹が流された`);
  }
  if (!G.firstLander && st.landers > 0) { G.firstLander = true; toast(`はじめて陸の生き物があらわれた（第 ${L.maxGen} 世代）`, 4); Sound.play('lander'); }
  if (!G.cleared && st.landers >= GOAL) { G.cleared = true; Sound.play('win'); clearPanel(day); }
  if (st.n === 0) { G.over = true; Sound.play('lose'); losePanel(); }
}

// ---- ループ --------------------------------------------------------------
let lastT = performance.now(), soilSfxT = 0;
function step(realDt) {
  applyKeys();
  // なぞる（時の速さによらず、手の速さで）
  if (drag?.type === 'sculpt') {
    const before = Wd.soil;
    sculpt(Wd, drag.brush, (tool === 'raise' ? 1 : -1) * 30 * realDt);
    soilSfxT -= realDt;
    if (before !== Wd.soil && soilSfxT <= 0) { Sound.play('soil'); soilSfxT = 0.12; }
  }
  const paused = !$('#overlay').hidden && !G.cleared;
  const simDt = paused ? 0 : realDt * speed;
  if (simDt > 0) {
    stepWorld(Wd, simDt);
    for (let t = simDt; t > 0; t -= 0.05) stepLife(Wd, L, Math.min(0.05, t));
  } else {
    // 止めていても、つかんだ天球の向きは変わる。潮の形だけは合わせる
    stepWater(Wd, 0.0001);
  }
  if (toastTimer > 0 && (toastTimer -= realDt) <= 0) $('#toast').classList.remove('on');
  uiT -= realDt; if (uiT <= 0) { updateUI(); uiT = 0.2; }
  const moon = Wd.sph[0];
  Sound.update(Math.abs(moon.v) / moon.nat, Wd.maxU, springness(Wd), simDt === 0);
}
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  step(dt);
  drawWorld(ctx, Wd, L, view, cw, ch, dpr, { hover: drag?.s?.key || hover, brush: drag?.type === 'sculpt' ? drag.brush : null, tool });
  requestAnimationFrame(frame);
}

newGame(1);
resize();
// サムネイル撮影（tools/make-thumbs.ps1）: 進化の途中の浜を、少し寄って見せる
if (/[?&]thumb\b/.test(location.search)) {
  thumbMode = true; document.body.classList.add('thumb'); resize();
  for (const c of L.list) { c.dry = Math.random(); c.legs = Math.random() * 0.9; c.lander = isLander(c); }
  for (let k = 0; k < 400; k++) { stepWorld(Wd, 0.05); stepLife(Wd, L, 0.05); }
  view = { x: CX - 40, y: CY - 70, z: 1.25 }; clampView();
  drawWorld(ctx, Wd, L, view, cw, ch, dpr, {});
} else {
  startPanel();
  requestAnimationFrame(frame);
}

// デバッグ用（DEVNOTES）。Browser ペインが裏だと rAF が止まるので step で進める
window.__hs = {
  get W() { return Wd; }, get L() { return L; }, get G() { return G; }, get view() { return view; },
  step(sec) { for (let t = sec; t > 0; t -= 0.05) step(Math.min(0.05, t)); drawWorld(ctx, Wd, L, view, cw, ch, dpr, {}); },
  setSpeed, setTool, newGame, stats: () => lifeStats(L),
};
