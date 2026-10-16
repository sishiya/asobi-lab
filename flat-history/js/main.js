// 操作・画面・くらべて再生
import { LEVEL as L, KINDS } from './level.js';
import { simulate, sectionsAt, frameAt, restHeight, canPlace, section } from './sim.js';
import { drawSheet } from './sheet.js';
import { createStage } from './stage3d.js';
import { LOOKS, look, setLook, kindName, kindColor } from './look/index.js';

const $ = (id) => document.getElementById(id);

const st = {
  pieces: [], nextId: 1,
  base: null, hist: null,
  heroX: 4, heroT: 0, heroY: 0, heroVY: 0,
  facing: { x: 1, z: 0 },
  sel: 'beam', reach: 0,
  solvedShown: false,
};
st.base = simulate(L, []);
st.hist = st.base;

const stage = createStage($('view'), L);
stage.setHistory(st.hist, st.pieces, 0, false);
stage.applyLook();

// ---- 形のトレイ ----
function kindIcon(kind) {
  const k = { ...KINDS[kind], color: kindColor(kind) };
  // 斜めから見た立体の小さな絵
  const w = k.w * 4.2, h = k.h * 5, d = Math.min(18, k.d * 1.3), rise = k.slope * k.d * 2.2;
  const ox = 4, oy = 30 - h;
  const dx = d * 0.8, dy = -d * 0.45 - rise;
  const f = `M${ox},${oy} h${w} v${h} h${-w}z`;
  const top = `M${ox},${oy} l${dx},${dy} h${w} l${-dx},${-dy}z`;
  const side = `M${ox + w},${oy} l${dx},${dy} v${h} l${-dx},${-dy}z`;
  return `<svg viewBox="0 0 ${ox + w + dx + 4} 34" preserveAspectRatio="xMidYMid meet"><g stroke="rgba(30,30,50,.55)" stroke-width="1" stroke-linejoin="round">
    <path d="${top}" fill="${k.color}" opacity=".75"/><path d="${side}" fill="${k.color}" opacity=".55"/><path d="${f}" fill="${k.color}"/></g></svg>`;
}
const left = (kind) => L.stock[kind] - st.pieces.filter((p) => p.kind === kind).length;
function renderTray() {
  const box = $('kinds');
  box.innerHTML = '';
  Object.keys(KINDS).forEach((kind, i) => {
    const k = KINDS[kind];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kind' + (st.sel === kind ? ' sel' : '') + (left(kind) <= 0 ? ' empty' : '');
    b.innerHTML = `${kindIcon(kind)}<span><span class="nm">${i + 1}. ${kindName(kind)}</span><br><span class="ds">${k.desc}</span></span><span class="ct">×${left(kind)}</span>`;
    b.addEventListener('click', () => select(kind));
    box.appendChild(b);
  });
}
function select(kind) {
  st.sel = st.sel === kind ? null : kind;
  renderTray();
}

// ---- 置く・持ち上げる ----
function candidate() {
  if (!st.sel) return null;
  const k = KINDS[st.sel];
  const x0 = Math.max(0, Math.min(L.W - k.w, Math.round(st.heroX - k.w / 2)));
  const t0 = Math.round(st.heroT);
  return { kind: st.sel, x0, t0, y0: restHeight(L, st.sel, x0) };
}
function recompute(fromT) {
  st.hist = simulate(L, st.pieces);
  stage.setHistory(st.hist, st.pieces, fromT, true);
  renderTray();
  insetDirty = true;
}
function place() {
  const c = candidate();
  if (!c) { flash('形をえらんでください（1〜3）'); return; }
  if (left(c.kind) <= 0) { flash(`${kindName(c.kind)}はもう置いてある（X で持ち上げられる）`); return; }
  const why = canPlace(L, c, st.pieces);
  if (why) { flash('置けない: ' + why); return; }
  st.pieces.push({ id: st.nextId++, ...c });
  if (left(c.kind) <= 0) st.sel = null;
  st.reach = 1;
  recompute(c.t0);
}
function pickUp() {
  const t = Math.round(st.heroT);
  const p = st.pieces.find((p) => {
    const k = KINDS[p.kind];
    return st.heroX >= p.x0 - 0.3 && st.heroX <= p.x0 + k.w + 0.3 && t >= p.t0 && t < p.t0 + k.d;
  });
  if (!p) { flash('足もとに形がない（形の上に立って X）'); return; }
  st.pieces = st.pieces.filter((q) => q !== p);
  st.sel = p.kind;
  st.reach = 1;
  recompute(p.t0);
}
function resetAll() {
  if (!st.pieces.length) return;
  const from = Math.min(...st.pieces.map((p) => p.t0));
  st.pieces = [];
  st.solvedShown = false;
  recompute(from);
}
let flashUntil = 0;
function flash(msg) { $('candMsg').textContent = msg; flashUntil = performance.now() + 2200; }

// ---- 入力 ----
const keys = new Set();
const modalOpen = () => !$('help').hidden || !$('replay').hidden;
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeReplay(); $('help').hidden = true; return; }
  if (!$('replay').hidden) {
    if (e.key === ' ' || e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePlay(); }
    return;
  }
  if (modalOpen()) return;
  keys.add(e.key);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (e.repeat) return;
  if (e.key === ' ' && st.heroY <= 0.001) st.heroVY = 7.5;
  if (e.key === '1') select('beam');
  if (e.key === '2') select('lift');
  if (e.key === '3') select('wall');
  if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter') place();
  if (e.key === 'x' || e.key === 'X' || e.key === 'Backspace') pickUp();
  if (e.key === 'p' || e.key === 'P') openReplay();
});
window.addEventListener('keyup', (e) => { keys.delete(e.key); keys.delete(e.key.toLowerCase()); keys.delete(e.key.toUpperCase()); });
window.addEventListener('blur', () => keys.clear());
$('btnPlace').addEventListener('click', place);
$('btnPick').addEventListener('click', pickUp);
$('btnReset').addEventListener('click', resetAll);
$('btnHelp').addEventListener('click', () => { $('help').hidden = false; });
$('helpClose').addEventListener('click', () => { $('help').hidden = true; });

// 時間の帯: クリック・ドラッグでその秒へ
const tl = $('timeline');
let dragging = false;
function tlJump(e) {
  const r = tl.getBoundingClientRect();
  const pad = 30;
  const u = (e.clientX - r.left - pad) / (r.width - pad * 2);
  st.heroT = Math.max(0, Math.min(L.T, Math.round(u * L.T)));
}
tl.addEventListener('pointerdown', (e) => { dragging = true; tl.setPointerCapture(e.pointerId); tlJump(e); });
tl.addEventListener('pointermove', (e) => { if (dragging) tlJump(e); });
tl.addEventListener('pointerup', () => { dragging = false; });

// ---- 右下の「いまのページ」 ----
const insetG = $('inset').getContext('2d');
let insetDirty = true, insetFocus = -1;
// ふだんは、いまの歴史をはじめから結末まで くりかえし再生。時間を動かしているあいだだけ、そのページを見せる
const ins = { t: 0, hold: 0, browseUntil: 0 };
function insetPlay(dt) {
  const endT = Math.min(L.T, st.hist.end.t + 0.3);
  if (ins.t >= endT) { ins.hold += dt; if (ins.hold > 1.6) { ins.t = 0; ins.hold = 0; } }
  else ins.t = Math.min(endT, ins.t + dt * 2);
  const t = ins.t;
  drawSheet(insetG, L, t, frameAt(st.hist.frames, t), sectionsAt(st.pieces, t), { paper: true, label: t.toFixed(1) + '秒' });
  const e = st.hist.end;
  const tail = e.type === 'goal' ? 'ゴールに着く' : e.type === 'time' ? '着かない' : '落ちてしまう';
  $('insetCap').textContent = `いまの歴史を再生中（${e.type === 'goal' ? Math.round(e.t) : Math.floor(e.t)}秒目に${tail}）・P で大きく`;
}
function drawInset(focus) {
  const fr = st.hist.frames[Math.round(focus / 0.1)];
  drawSheet(insetG, L, focus, fr, sectionsAt(st.pieces, focus), { paper: true, label: focus + '秒' });
  const who = look().who;
  let cap = `${focus}秒目のページ（${who}から見た世界）`;
  if (fr.st === 'dead') cap = `このページには、もう${who}はいない`;
  else if (fr.st === 'goal') cap = `このページでは、${who}はゴールに着いている`;
  $('insetCap').textContent = cap;
}

// ---- 時間の帯 ----
const tg = tl.getContext('2d');
function drawTimeline(focus) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = tl.clientWidth, h = tl.clientHeight;
  if (tl.width !== Math.round(w * dpr)) { tl.width = Math.round(w * dpr); tl.height = Math.round(h * dpr); }
  tg.setTransform(dpr, 0, 0, dpr, 0, 0);
  tg.clearRect(0, 0, w, h);
  const pad = 30, X = (t) => pad + (t / L.T) * (w - pad * 2);
  // 目盛り
  tg.strokeStyle = 'rgba(60,80,110,.35)'; tg.fillStyle = '#5d6b84'; tg.font = '11px system-ui'; tg.textAlign = 'center';
  for (let t = 0; t <= L.T; t++) {
    const big = t % 5 === 0;
    tg.beginPath(); tg.moveTo(X(t), 44); tg.lineTo(X(t), big ? 36 : 40); tg.stroke();
    if (big) tg.fillText(t + '', X(t), 58);
  }
  tg.textAlign = 'left'; tg.fillText('昔', 4, 48); tg.textAlign = 'right'; tg.fillText('未来', w - 2, 48);
  // 置いた形の期間
  st.pieces.forEach((p, i) => {
    const k = KINDS[p.kind];
    tg.fillStyle = kindColor(p.kind);
    const y = 4 + (i % 3) * 9;
    tg.fillRect(X(p.t0), y, X(Math.min(L.T, p.t0 + k.d)) - X(p.t0), 7);
  });
  // 2D人の結末（はじめの歴史はうすく）
  const mark = (e, faint) => {
    if (e.type === 'time') return;
    const x = X(e.t);
    tg.globalAlpha = faint ? 0.35 : 1;
    if (e.type === 'goal') { tg.fillStyle = '#f5b82e'; tg.beginPath(); tg.arc(x, 31, 6, 0, 7); tg.fill(); }
    else { tg.fillStyle = '#e0453a'; tg.beginPath(); tg.moveTo(x, 24); tg.lineTo(x + 6, 31); tg.lineTo(x, 38); tg.lineTo(x - 6, 31); tg.fill(); }
    tg.globalAlpha = 1;
  };
  if (st.hist !== st.base) mark(st.base.end, true);
  mark(st.hist.end, false);
  // 小窓の再生位置
  if (performance.now() >= ins.browseUntil) {
    tg.fillStyle = '#3f7fd6';
    tg.beginPath(); tg.moveTo(X(ins.t), 44); tg.lineTo(X(ins.t) + 5, 50); tg.lineTo(X(ins.t) - 5, 50); tg.fill();
  }
  // 主人公のいる秒
  tg.fillStyle = '#f2a93b';
  tg.fillRect(X(focus) - 1.5, 2, 3, 42);
  tg.beginPath(); tg.moveTo(X(focus) - 6, 0); tg.lineTo(X(focus) + 6, 0); tg.lineTo(X(focus), 7); tg.fill();
}

// ---- 結末の一言 ----
function statusText() {
  const e = st.hist.end, el = $('status');
  el.classList.toggle('goal', e.type === 'goal');
  if (e.type === 'goal') return `${e.t.toFixed(0)}秒目に${look().who}がゴールに着く ― 正史ができた（形 ${st.pieces.length} つ）`;
  if (e.type === 'abyss') return `${Math.floor(e.t)}秒目、崖に落ちてしまう（${e.x.toFixed(0)}マスのあたり）`;
  if (e.type === 'fall') return `${Math.floor(e.t)}秒目、高い所から落ちてしまう（${e.x.toFixed(0)}マスのあたり）`;
  return `${L.T}秒たってもゴールに着かない`;
}

// ---- くらべて再生 ----
const rp = { t: 0, playing: true, speed: 2, gA: $('rpA').getContext('2d'), gB: $('rpB').getContext('2d') };
function openReplay() {
  $('win').hidden = true;
  $('replay').hidden = false;
  rp.t = 0; rp.playing = true; $('rpPlay').textContent = '❚❚';
  keys.clear();
}
function closeReplay() { $('replay').hidden = true; }
function togglePlay() {
  if (rp.t >= L.T) rp.t = 0;
  rp.playing = !rp.playing; $('rpPlay').textContent = rp.playing ? '❚❚' : '▶';
}
$('btnReplay').addEventListener('click', openReplay);
$('winReplay').addEventListener('click', openReplay);
$('winClose').addEventListener('click', () => { $('win').hidden = true; });
$('rpClose').addEventListener('click', closeReplay);
$('rpPlay').addEventListener('click', togglePlay);
$('rpSeek').addEventListener('input', (e) => { rp.t = +e.target.value; });
$('rpSpeed').addEventListener('change', (e) => { rp.speed = +e.target.value; });
function drawReplay() {
  const t = rp.t;
  const lab = t.toFixed(1) + '秒';
  drawSheet(rp.gA, L, t, frameAt(st.base.frames, t), [], { paper: true, label: lab });
  drawSheet(rp.gB, L, t, frameAt(st.hist.frames, t), sectionsAt(st.pieces, t), { paper: true, label: lab });
  $('rpSeek').value = t;
  $('rpTime').textContent = t.toFixed(1) + ' 秒';
}

// ---- 毎フレーム ----
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!$('replay').hidden) {
    if (rp.playing) { rp.t = Math.min(L.T, rp.t + dt * rp.speed); if (rp.t >= L.T) { rp.playing = false; $('rpPlay').textContent = '▶'; } }
    drawReplay();
  }
  // 主人公
  const held = (...ks) => ks.some((k) => keys.has(k));
  const ax = (held('ArrowRight', 'd', 'D') ? 1 : 0) - (held('ArrowLeft', 'a', 'A') ? 1 : 0);
  const az = (held('ArrowDown', 's', 'S') ? 1 : 0) - (held('ArrowUp', 'w', 'W') ? 1 : 0);
  const slow = keys.has('Shift');
  st.heroX = Math.max(0, Math.min(L.W, st.heroX + ax * 7 * dt));
  if (az) st.heroT = Math.max(0, Math.min(L.T, st.heroT + az * (slow ? 2.5 : 9) * dt));
  else st.heroT += (Math.round(st.heroT) - st.heroT) * Math.min(1, dt * 12);
  if (ax || az) st.facing = { x: ax, z: az };
  st.heroVY -= 24 * dt;
  st.heroY = Math.max(0, st.heroY + st.heroVY * dt);
  if (st.heroY === 0) st.heroVY = 0;
  st.reach = Math.max(0, st.reach - dt * 2.5);
  const focus = Math.round(st.heroT);

  const cand = candidate();
  let candOk = false;
  if (cand) {
    const why = left(cand.kind) <= 0 ? `${kindName(cand.kind)}はもう置いてある` : canPlace(L, cand, st.pieces);
    candOk = !why;
    if (performance.now() > flashUntil) $('candMsg').textContent = why ? '置けない: ' + why : '';
  } else if (performance.now() > flashUntil) $('candMsg').textContent = '';

  stage.update(dt, {
    heroX: st.heroX, heroT: st.heroT, heroY: st.heroY, focus, facing: st.facing,
    cand, candOk, walking: !!(ax || az), reach: st.reach,
  });

  if (az || dragging) ins.browseUntil = now + 1200;
  if (insetDirty) { ins.t = 0; ins.hold = 0; }
  if (now < ins.browseUntil) {
    if (focus !== insetFocus || insetDirty) { drawInset(focus); insetFocus = focus; }
  } else { insetPlay(dt); insetFocus = -1; }
  insetDirty = false;
  $('clockNum').textContent = focus;
  $('status').textContent = statusText();
  drawTimeline(st.heroT);

  if (st.hist.end.type === 'goal' && !st.solvedShown && !stage.waving()) {
    st.solvedShown = true;
    $('winText').textContent = `${look().who}は ${st.hist.end.t.toFixed(0)} 秒目にゴールに着きます。使った形は ${st.pieces.length} つ。`;
    $('win').hidden = false;
  }
  if (st.hist.end.type !== 'goal') { st.solvedShown = false; $('win').hidden = true; }
  requestAnimationFrame(loop);
}

// ---- 見た目の切りかえ ----
const lookSel = $('lookSel');
for (const lk of LOOKS) {
  const o = document.createElement('option');
  o.value = lk.id; o.textContent = lk.name;
  lookSel.appendChild(o);
}
lookSel.value = look().id;
function changeLook(id) {
  setLook(id);
  lookSel.value = look().id;
  stage.applyLook();
  renderTray();
  insetDirty = true; insetFocus = -1;
  if (st.hist.end.type === 'goal') $('winText').textContent = `${look().who}は ${st.hist.end.t.toFixed(0)} 秒目にゴールに着きます。使った形は ${st.pieces.length} つ。`;
}
lookSel.addEventListener('change', () => { changeLook(lookSel.value); lookSel.blur(); });
window.addEventListener('keydown', (e) => {
  if ((e.key === 'l' || e.key === 'L') && !modalOpen()) {
    const i = LOOKS.indexOf(look());
    changeLook(LOOKS[(i + 1) % LOOKS.length].id);
  }
});

function onResize() { stage.resize(); }
window.addEventListener('resize', onResize);
onResize();
renderTray();
$('help').hidden = false;
requestAnimationFrame(loop);
// 確認用
window.__fh = { st, L, simulate, section, keys };
