// 操作・画面（タイトル・図版えらび・面）・ひとことの導き・くらべて再生
import { LEVELS, KINDS } from './level.js?v=8';
import { simulate, sectionsAt, frameAt, restHeight, canPlace, section } from './sim.js?v=8';
import { drawSheet } from './sheet.js?v=8';
import { createStage } from './stage3d.js?v=8';
import { look, kindName, kindColor } from './look/index.js?v=8';
import { initAudio, startBgm, se, isMuted, setMuted, BGM_LIST, bgmId, setBgm } from './audio.js?v=8';

const $ = (id) => document.getElementById(id);

// ---- 進みぐあい（このブラウザだけに覚える） ----
let progress = {};
try { progress = JSON.parse(localStorage.getItem('flat-history.progress') || '{}'); } catch (e) { progress = {}; }
function saveProgress() { try { localStorage.setItem('flat-history.progress', JSON.stringify(progress)); } catch (e) { /* なし */ } }

let L = LEVELS[0];
const st = {
  lv: 0, pieces: [], nextId: 1, base: null, hist: null,
  heroX: 4, heroT: 0, heroY: 0, heroVY: 0, facing: { x: 1, z: 0 },
  sel: null, reach: 0, solvedShown: false,
  visited: new Set(), hintIdx: 0, lastEnd: '',
};
const stage = createStage($('view'), L);

// ---- 面をはじめる ----
function loadLevel(i) {
  st.lv = i; L = LEVELS[i];
  st.pieces = []; st.nextId = 1;
  st.base = simulate(L, []); st.hist = st.base;
  st.heroX = L.start.x + 2; st.heroT = 0; st.heroY = 0; st.heroVY = 0;
  st.sel = null; st.solvedShown = false;
  st.visited = new Set([0]); st.hintIdx = 0; st.lastEnd = st.base.end.type;
  stage.setLevel(L);
  stage.setHistory(st.hist, st.pieces, 0, false);
  $('lvPlate').textContent = 'Pl. ' + L.plate;
  $('lvName').textContent = L.name;
  $('win').hidden = true;
  renderTray();
  insetDirty = true;
  showIntro();
}
function showIntro() {
  const el = $('intro');
  el.innerHTML = `<span class="pn">Pl. ${L.plate}</span><span class="nm">${L.name}</span>`;
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(showIntro.t);
  showIntro.t = setTimeout(() => { el.hidden = true; }, 2900);
}

// ---- 画面の切りかえ ----
function showScreen(name) {
  $('title').hidden = name !== 'title';
  $('select').hidden = name !== 'select';
  document.body.classList.toggle('menu', name !== 'game');
  keys.clear();
}
function startGame(i) { loadLevel(i); showScreen('game'); }
function firstUnsolved() {
  const i = LEVELS.findIndex((l) => !progress[l.id]);
  return i < 0 ? 0 : i;
}
function renderSelect() {
  for (const [boxId, tut] of [['selTut', true], ['selMain', false]]) {
    const box = $(boxId);
    box.innerHTML = '';
    LEVELS.forEach((l, i) => {
      if (!!l.tutorial !== tut) return;
      const p = progress[l.id];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'plate' + (p ? ' done' : '');
      b.innerHTML = `<span class="pn">Pl. ${l.plate}</span><span class="nm">${l.name}</span><span class="st">${p ? `正史ずみ（形 ${p.best} つ）` : 'まだ'}</span>`;
      b.addEventListener('click', () => { se.click(); startGame(i); });
      box.appendChild(b);
    });
  }
  showScreen('select');
}

// ---- 形のトレイ ----
function kindIcon(kind) {
  const k = { ...KINDS[kind], color: kindColor(kind) };
  const w = k.w * 4.2, h = k.h * 5, d = Math.min(18, k.d * 1.3), rise = k.slope * k.d * 2.2;
  const ox = 4, oy = 30 - h;
  const dx = d * 0.8, dy = -d * 0.45 - rise;
  const f = `M${ox},${oy} h${w} v${h} h${-w}z`;
  const top = `M${ox},${oy} l${dx},${dy} h${w} l${-dx},${-dy}z`;
  const side = `M${ox + w},${oy} l${dx},${dy} v${h} l${-dx},${-dy}z`;
  return `<svg viewBox="0 0 ${ox + w + dx + 4} 34" preserveAspectRatio="xMidYMid meet"><g stroke="rgba(30,30,50,.55)" stroke-width="1" stroke-linejoin="round">
    <path d="${top}" fill="${k.color}" opacity=".75"/><path d="${side}" fill="${k.color}" opacity=".55"/><path d="${f}" fill="${k.color}"/></g></svg>`;
}
const kindsHere = () => Object.keys(L.stock);
const left = (kind) => L.stock[kind] - st.pieces.filter((p) => p.kind === kind).length;
function renderTray() {
  const box = $('kinds');
  box.innerHTML = '';
  kindsHere().forEach((kind, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kind' + (st.sel === kind ? ' sel' : '') + (left(kind) <= 0 ? ' empty' : '');
    b.innerHTML = `${kindIcon(kind)}<span><span class="nm">${i + 1}. ${kindName(kind)}</span><br><span class="ds">${KINDS[kind].desc}</span></span><span class="ct">×${left(kind)}</span>`;
    b.addEventListener('click', () => select(kind));
    box.appendChild(b);
  });
}
function select(kind) {
  if (!kind) return;
  st.sel = st.sel === kind ? null : kind;
  se.click();
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
  se.wave();
  if (st.hist.end.type !== 'goal' && st.hist.end.type !== 'time' && st.lastEnd === 'goal') se.fall();
  st.lastEnd = st.hist.end.type;
}
function place() {
  const c = candidate();
  if (!c) { flash('形をえらぼう（1〜' + kindsHere().length + '）'); se.no(); return; }
  if (left(c.kind) <= 0) { flash(`${kindName(c.kind)}はもう置いてある（X で持ち上げられる）`); se.no(); return; }
  const why = canPlace(L, c, st.pieces);
  if (why) { flash('置けない: ' + why); se.no(); return; }
  st.pieces.push({ id: st.nextId++, ...c });
  if (left(c.kind) <= 0) st.sel = null;
  st.reach = 1;
  se.place();
  recompute(c.t0);
}
function pickUp() {
  const t = Math.round(st.heroT);
  const p = st.pieces.find((p) => {
    const k = KINDS[p.kind];
    return st.heroX >= p.x0 - 0.3 && st.heroX <= p.x0 + k.w + 0.3 && t >= p.t0 && t < p.t0 + k.d;
  });
  if (!p) { flash('足もとに形がない（形の真上で X）'); se.no(); return; }
  st.pieces = st.pieces.filter((q) => q !== p);
  st.sel = p.kind;
  st.reach = 1;
  se.pick();
  recompute(p.t0);
}
function resetAll() {
  if (!st.pieces.length) return;
  const from = Math.min(...st.pieces.map((p) => p.t0));
  st.pieces = [];
  st.solvedShown = false;
  se.pick();
  recompute(from);
}
let flashUntil = 0;
function flash(msg) { $('candMsg').textContent = msg; flashUntil = performance.now() + 2200; }

// ---- 入力 ----
const keys = new Set();
const inGame = () => !document.body.classList.contains('menu');
const modalOpen = () => !$('help').hidden || !$('replay').hidden;
window.addEventListener('keydown', (e) => {
  initAudio(); startBgm();
  if (e.key === 'Escape') { closeReplay(); $('help').hidden = true; return; }
  if (!$('replay').hidden) {
    if (e.key === ' ' || e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePlay(); }
    return;
  }
  if (modalOpen() || !inGame()) return;
  keys.add(e.key);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (e.repeat) return;
  if (e.key === ' ' && st.heroY <= 0.001) st.heroVY = 7.5;
  if (/^[1-9]$/.test(e.key)) select(kindsHere()[+e.key - 1]);
  if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter') place();
  if (e.key === 'x' || e.key === 'X' || e.key === 'Backspace') pickUp();
  if (e.key === 'p' || e.key === 'P') openReplay();
});
window.addEventListener('keyup', (e) => { keys.delete(e.key); keys.delete(e.key.toLowerCase()); keys.delete(e.key.toUpperCase()); });
// 右クリックのメニュー・ウィンドウの切りかえで keyup が届かず、キーが押されたままになるのを防ぐ
window.addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => keys.clear());
window.addEventListener('contextmenu', (e) => { keys.clear(); if (e.target.closest('canvas')) e.preventDefault(); });
window.addEventListener('pointerdown', () => { initAudio(); startBgm(); });

$('btnPlace').addEventListener('click', place);
$('btnPick').addEventListener('click', pickUp);
$('btnReset').addEventListener('click', resetAll);
$('btnHelp').addEventListener('click', () => { $('help').hidden = false; keys.clear(); });
$('tHelp').addEventListener('click', () => { $('help').hidden = false; });
$('helpClose').addEventListener('click', () => { $('help').hidden = true; });
$('tStart').addEventListener('click', () => { se.click(); startGame(firstUnsolved()); });
$('tSelect').addEventListener('click', () => { se.click(); renderSelect(); });
$('selClose').addEventListener('click', () => showScreen(document.body.dataset.from === 'game' ? 'game' : 'title'));
$('btnSelect').addEventListener('click', () => { document.body.dataset.from = 'game'; renderSelect(); });
$('btnTitle').addEventListener('click', () => { document.body.dataset.from = 'title'; showScreen('title'); });
function renderSound() {
  for (const b of document.querySelectorAll('.sound-btn')) {
    if (b.classList.contains('icon-btn')) { b.textContent = isMuted() ? '♪̸' : '♪'; b.style.opacity = isMuted() ? 0.5 : 1; }
    else b.textContent = isMuted() ? '音: なし' : '音: あり';
  }
}
for (const b of document.querySelectorAll('.sound-btn')) b.addEventListener('click', () => { initAudio(); setMuted(!isMuted()); renderSound(); });
renderSound();

// 音楽をえらぶ（タイトルのメニュー、遊んでいるあいだは M キー）
const bgmSel = $('bgmSel');
for (const b of BGM_LIST) { const o = document.createElement('option'); o.value = b.id; o.textContent = b.name; bgmSel.appendChild(o); }
bgmSel.value = bgmId();
bgmSel.addEventListener('change', () => { initAudio(); setBgm(bgmSel.value); startBgm(); bgmSel.blur(); });
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 1800);
}
window.addEventListener('keydown', (e) => {
  if ((e.key === 'm' || e.key === 'M') && !e.repeat && inGame() && !modalOpen()) {
    const i = BGM_LIST.findIndex((b) => b.id === bgmId());
    const nx = BGM_LIST[(i + 1) % BGM_LIST.length];
    setBgm(nx.id); startBgm(); bgmSel.value = nx.id;
    toast('♪ ' + nx.name);
  }
});

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
// ふだんは、いまの歴史をはじめから結末まで くりかえし再生。時間を動かしているあいだだけ、そのページ
const ins = { t: 0, hold: 0, browseUntil: 0 };
function insetPlay(dt) {
  const endT = Math.min(L.T, st.hist.end.t + 0.3);
  if (ins.t >= endT) { ins.hold += dt; if (ins.hold > 1.6) { ins.t = 0; ins.hold = 0; } }
  else ins.t = Math.min(endT, ins.t + dt * 2);
  const t = ins.t;
  drawSheet(insetG, L, t, frameAt(st.hist.frames, t), sectionsAt(st.pieces, t), { paper: true, label: t.toFixed(1) + '秒' });
  $('insetCap').textContent = 'いまの歴史 ・ P で大きく';
}
function drawInset(focus) {
  const fr = st.hist.frames[Math.round(focus / 0.1)];
  drawSheet(insetG, L, focus, fr, sectionsAt(st.pieces, focus), { paper: true, label: focus + '秒' });
  $('insetCap').textContent = `${focus}秒目のページ`;
}

// ---- 時間の帯 ----
const tg = tl.getContext('2d');
function drawTimeline(focus) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = tl.clientWidth, h = tl.clientHeight;
  if (!w) return;
  if (tl.width !== Math.round(w * dpr)) { tl.width = Math.round(w * dpr); tl.height = Math.round(h * dpr); }
  tg.setTransform(dpr, 0, 0, dpr, 0, 0);
  tg.clearRect(0, 0, w, h);
  const pad = 30, X = (t) => pad + (t / L.T) * (w - pad * 2);
  tg.strokeStyle = 'rgba(74,51,32,.55)'; tg.fillStyle = '#6b4f33'; tg.font = 'italic 11px Georgia, serif'; tg.textAlign = 'center';
  tg.lineWidth = 1;
  tg.beginPath(); tg.moveTo(X(0), 44.5); tg.lineTo(X(L.T), 44.5); tg.stroke();
  for (let t = 0; t <= L.T; t++) {
    const big = t % 5 === 0;
    tg.beginPath(); tg.moveTo(X(t), 44.5); tg.lineTo(X(t), big ? 35 : 40); tg.stroke();
    if (big) tg.fillText(t + '', X(t), 58);
  }
  tg.font = '11px "Yu Mincho", serif';
  tg.textAlign = 'left'; tg.fillText('昔', 4, 48); tg.textAlign = 'right'; tg.fillText('未来', w - 2, 48);
  st.pieces.forEach((p, i) => {
    const k = KINDS[p.kind];
    const y = 4 + (i % 3) * 9, x1 = X(Math.min(L.T, p.t0 + k.d));
    tg.fillStyle = kindColor(p.kind);
    tg.fillRect(X(p.t0), y, x1 - X(p.t0), 7);
    tg.strokeStyle = 'rgba(74,51,32,.7)';
    tg.strokeRect(X(p.t0) + 0.5, y + 0.5, x1 - X(p.t0) - 1, 6);
  });
  const mark = (e, faint) => {
    if (e.type === 'time') return;
    const x = X(e.t);
    tg.globalAlpha = faint ? 0.35 : 1;
    if (e.type === 'goal') { tg.fillStyle = '#c99a4a'; tg.strokeStyle = '#4a3320'; tg.beginPath(); tg.arc(x, 31, 6, 0, 7); tg.fill(); tg.stroke(); }
    else { tg.fillStyle = '#8f3b2b'; tg.beginPath(); tg.moveTo(x, 24); tg.lineTo(x + 6, 31); tg.lineTo(x, 38); tg.lineTo(x - 6, 31); tg.fill(); }
    tg.globalAlpha = 1;
  };
  if (st.hist !== st.base) mark(st.base.end, true);
  mark(st.hist.end, false);
  if (performance.now() >= ins.browseUntil) {
    tg.fillStyle = '#4a3320';
    tg.beginPath(); tg.moveTo(X(ins.t), 44); tg.lineTo(X(ins.t) + 5, 50); tg.lineTo(X(ins.t) - 5, 50); tg.fill();
  }
  tg.fillStyle = '#a8742a';
  tg.fillRect(X(focus) - 1.5, 2, 3, 42);
  tg.beginPath(); tg.moveTo(X(focus) - 6, 0); tg.lineTo(X(focus) + 6, 0); tg.lineTo(X(focus), 7); tg.fill();
}

// ---- 結末の一言 ----
function statusText() {
  const e = st.hist.end, el = $('status');
  el.classList.toggle('goal', e.type === 'goal');
  if (e.type === 'goal') return `${e.t.toFixed(0)}秒目に巣に着く ― 正史`;
  if (e.type === 'abyss') return `${Math.floor(e.t)}秒目、崖に落ちてしまう`;
  if (e.type === 'fall') return `${Math.floor(e.t)}秒目、高い所から落ちてしまう`;
  return `${L.T}秒たっても巣に着かない`;
}

// ---- ひとことの導き（チュートリアル） ----
function coachText() {
  if (st.hist.end.type === 'goal') return '';
  const hs = L.hints || [];
  const c = {
    visited: st.visited.size,
    seenEnd: [...st.visited].some((t) => t >= Math.floor(st.base.end.t)),
    placed: st.pieces.length > 0,
  };
  while (st.hintIdx < hs.length && hs[st.hintIdx].when(c)) st.hintIdx++;
  if (st.hintIdx < hs.length) return hs[st.hintIdx].text;
  if (c.placed && L.fail && !stage.waving()) return L.fail;
  return '';
}
let coachShown = '';
function renderCoach() {
  const t = coachText();
  if (t === coachShown) return;
  coachShown = t;
  const el = $('coach');
  el.classList.add('off');
  setTimeout(() => { el.textContent = coachShown; el.classList.toggle('off', !coachShown); }, 250);
}

// ---- 正史の札 ----
function winShow() {
  const n = st.pieces.length;
  const prev = progress[L.id];
  progress[L.id] = { best: prev ? Math.min(prev.best, n) : n };
  saveProgress();
  const next = st.lv + 1 < LEVELS.length;
  $('winText').textContent = `キーウィは ${st.hist.end.t.toFixed(0)} 秒目に巣に着く。使った形は ${n} つ。`;
  $('winNext').hidden = !next;
  $('win').hidden = false;
  se.goal();
}
$('winNext').addEventListener('click', goNext);
$('rpNext').addEventListener('click', goNext);
$('btnNext').addEventListener('click', goNext);

// ---- くらべて再生 ----
const rp = { t: 0, playing: true, speed: 2, gA: $('rpA').getContext('2d'), gB: $('rpB').getContext('2d') };
function openReplay() {
  $('win').hidden = true;
  $('replay').hidden = false;
  rp.t = 0; rp.playing = true; $('rpPlay').textContent = '❚❚';
  $('rpNext').hidden = !(st.hist.end.type === 'goal' && hasNext());
  keys.clear();
}
function closeReplay() {
  if ($('replay').hidden) return;
  $('replay').hidden = true;
  // 正史ができたあとなら、札をもう一度（次へ進めるように）
  if (st.hist.end.type === 'goal') $('win').hidden = false;
}
const hasNext = () => st.lv + 1 < LEVELS.length;
function goNext() { se.click(); $('replay').hidden = true; startGame(st.lv + 1); }
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
  const t = rp.t, lab = t.toFixed(1) + '秒';
  drawSheet(rp.gA, L, t, frameAt(st.base.frames, t), [], { paper: true, label: lab });
  drawSheet(rp.gB, L, t, frameAt(st.hist.frames, t), sectionsAt(st.pieces, t), { paper: true, label: lab });
  $('rpSeek').value = t;
  $('rpTime').textContent = t.toFixed(1) + ' 秒';
}

// ---- 毎フレーム ----
let last = performance.now(), lastFocus = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!$('replay').hidden) {
    if (rp.playing) { rp.t = Math.min(L.T, rp.t + dt * rp.speed); if (rp.t >= L.T) { rp.playing = false; $('rpPlay').textContent = '▶'; } }
    drawReplay();
  }
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
  if (focus !== lastFocus) { st.visited.add(focus); if (inGame()) se.page(); lastFocus = focus; }

  const cand = inGame() ? candidate() : null;
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

  if (inGame()) {
    if (az || dragging) ins.browseUntil = now + 1200;
    if (insetDirty) { ins.t = 0; ins.hold = 0; }
    if (now < ins.browseUntil) {
      if (focus !== insetFocus || insetDirty) { drawInset(focus); insetFocus = focus; }
    } else { insetPlay(dt); insetFocus = -1; }
    insetDirty = false;
    $('clockNum').textContent = focus;
    $('status').textContent = statusText();
    drawTimeline(st.heroT);
    renderCoach();
    if (st.hist.end.type === 'goal' && !st.solvedShown && !stage.waving()) { st.solvedShown = true; winShow(); }
    if (st.hist.end.type !== 'goal') { st.solvedShown = false; $('win').hidden = true; }
    $('btnNext').hidden = !(st.solvedShown && hasNext());
  }
  requestAnimationFrame(loop);
}

function onResize() { stage.resize(); }
window.addEventListener('resize', onResize);
onResize();
stage.applyLook();
loadLevel(firstUnsolved());
showScreen('title');
requestAnimationFrame(loop);
// 確認用
window.__fh = { st, LEVELS, simulate, section, keys, startGame, get L() { return L; } };
