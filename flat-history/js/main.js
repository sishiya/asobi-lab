// 操作・画面（タイトル・図版えらび・面・Esc メニュー）・ひとことの導き・くらべて再生
// v009: 主人公が時空の大地を歩き、形をつかんで運んで置く（REDESIGN.md 段階1〜2）
import { LEVELS } from './level.js?v=11';
import { simulate, sectionsAt, frameAt, restHeight, canPlace, pieceDims } from './sim.js?v=11';
import { drawSheet } from './sheet.js?v=11';
import { createStage } from './stage3d.js?v=11';
import { kindName } from './look/index.js?v=11';
import { makeHero, stepHero, groundAt, tableY } from './hero.js?v=11';
import { initAudio, startBgm, se, isMuted, setMuted, BGM_LIST, bgmId, setBgm } from './audio.js?v=11';

const $ = (id) => document.getElementById(id);

// ---- 進みぐあい（このブラウザだけに覚える） ----
let progress = {};
try { progress = JSON.parse(localStorage.getItem('flat-history.progress') || '{}'); } catch (e) { progress = {}; }
function saveProgress() { try { localStorage.setItem('flat-history.progress', JSON.stringify(progress)); } catch (e) { /* なし */ } }

let L = LEVELS[0];
const st = {
  lv: 0, pieces: [], nextId: 1, base: null, hist: null,
  hero: null, carry: null, revealT: 0, walked: 0,
  hintIdx: 0, solved: false, lastEnd: '', boundOnce: false, failedOnce: false,
};
const stage = createStage($('view'), L);
const inBlock = (p) => p.x0 + pieceDims(p).wx > 0;
const blockPieces = () => st.pieces.filter(inBlock);

// ---- 面をはじめる ----
function loadLevel(i) {
  st.lv = i; L = LEVELS[i];
  st.pieces = []; st.nextId = 1; st.carry = null;
  // 標本台に、持てる形を並べる
  let t = 1;
  for (const [kind, n] of Object.entries(L.stock)) {
    for (let k = 0; k < n; k++) {
      const p = { id: st.nextId++, kind, rot: 0, t0: t, y0: tableY(L) };
      const d = pieceDims(p);
      p.x0 = -7 + Math.floor((7 - d.wx) / 2);
      st.pieces.push(p);
      t += d.dz + 1;
    }
  }
  st.base = simulate(L, []); st.hist = st.base;
  st.hero = makeHero(L);
  st.revealT = 3; st.walked = 0;
  st.hintIdx = 0; st.solved = false; st.lastEnd = st.base.end.type; st.failedOnce = false; st.boundOnce = false;
  stage.setLevel(L);
  stage.setHistory(st.hist, st.pieces, 0, false);
  stage.resetCamera();
  $('lvPlate').textContent = 'Pl. ' + L.plate;
  $('lvName').textContent = L.name;
  closeAll();
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
let screen = 'title';
function showScreen(name) {
  screen = name;
  $('title').hidden = name !== 'title';
  $('select').hidden = name !== 'select';
  document.body.classList.toggle('menu', name !== 'game');
  closeAll();
  keys.clear();
}
function closeAll() { for (const id of ['menu', 'help', 'replay']) $(id).hidden = true; }
function startGame(i) { loadLevel(i); showScreen('game'); }
function firstUnsolved() { const i = LEVELS.findIndex((l) => !progress[l.id]); return i < 0 ? 0 : i; }
let selectFrom = 'title';
function renderSelect(from) {
  selectFrom = from;
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
const openMenu = () => { closeAll(); $('menu').hidden = false; keys.clear(); se.click(); };
const modalOpen = () => !$('menu').hidden || !$('help').hidden || !$('replay').hidden;
const playing = () => screen === 'game' && !modalOpen();

// ---- つかむ・置く・回す ----
function facingAxis() {
  const h = st.hero;
  return Math.abs(h.ft) >= Math.abs(h.fx) ? { ax: 't', s: Math.sign(h.ft) || 1 } : { ax: 'x', s: Math.sign(h.fx) || 1 };
}
// 持っている形を、目の前のどこに置くか
function candidate() {
  if (!st.carry) return null;
  const h = st.hero, f = facingAxis();
  const c = { kind: st.carry.kind, rot: st.carry.rot };
  const d = pieceDims(c);
  if (f.ax === 't') {
    c.x0 = Math.round(h.x - d.wx / 2);
    c.t0 = f.s > 0 ? Math.round(h.t + 0.8) : Math.round(h.t - 0.8 - d.dz);
  } else {
    c.t0 = Math.round(h.t - d.dz / 2);
    c.x0 = f.s > 0 ? Math.round(h.x + 0.8) : Math.round(h.x - 0.8 - d.wx);
  }
  c.y0 = restHeight(L, c, tableY(L));
  return c;
}
// 目の前（または足もと）でつかめる形
function grabbable() {
  if (st.carry) return null;
  const h = st.hero;
  const px = h.x + h.fx * 1.0, pt = h.t + h.ft * 1.0;
  let best = null, bd = 9;
  for (const p of st.pieces) {
    const d = pieceDims(p);
    const dx = Math.max(p.x0 - px, 0, px - (p.x0 + d.wx));
    const dt = Math.max(p.t0 - pt, 0, pt - (p.t0 + d.dz));
    const dist = Math.hypot(dx, dt);
    if (dist < 0.9 && dist < bd && h.y - p.y0 > -2.5 && h.y - p.y0 < 3) { best = p; bd = dist; }
  }
  return best;
}
function recompute(fromT) {
  st.solved = false;
  st.hist = simulate(L, st.pieces);
  stage.setHistory(st.hist, st.pieces, fromT, true);
  se.wave();
  // 書きかえたら、その先の知っていた未来はぼやける（見に行きなおす）
  st.revealT = Math.min(st.revealT, Math.max(st.hero.t + 3, fromT));
  st.lastEnd = st.hist.end.type;
}
function useE() {
  if (st.carry) {
    const c = candidate();
    const why = canPlace(L, c, st.pieces);
    if (why) { flashPrompt(why); se.no(); return; }
    const p = { id: st.nextId++, ...c };
    st.pieces.push(p);
    st.carry = null;
    se.place();
    if (inBlock(p)) recompute(p.t0); else stage.setHistory(st.hist, st.pieces, null, true);
    return;
  }
  const p = grabbable();
  if (!p) return;
  st.pieces = st.pieces.filter((q) => q !== p);
  st.carry = { kind: p.kind, rot: p.rot || 0 };
  se.pick();
  if (inBlock(p)) recompute(p.t0); else stage.setHistory(st.hist, st.pieces, null, false);
}
function rotate() {
  if (!st.carry) return;
  st.carry = { ...st.carry, rot: st.carry.rot ? 0 : 1 };
  se.click();
}
let flashMsg = '', flashUntil = 0;
function flashPrompt(m) { flashMsg = m; flashUntil = performance.now() + 1800; }

// ---- 入力 ----
const keys = new Set();
let jumpQueued = false;
window.addEventListener('keydown', (e) => {
  initAudio(); startBgm();
  const k = e.key;
  if (!$('replay').hidden) {
    if (k === 'Escape') closeReplay();
    else if (k === 'Enter' && rp.judged && st.solved && hasNext()) goNext();
    else if (k === 'Enter' && rp.judged && !st.solved) closeReplay();
    else if (k === ' ' || k === 'p' || k === 'P') { e.preventDefault(); togglePlay(); }
    return;
  }
  if (!$('help').hidden) { if (k === 'Escape' || k === 'Enter') closeHelp(); return; }
  if (!$('menu').hidden) { if (k === 'Escape') $('menu').hidden = true; return; }
  if (screen === 'select') { if (k === 'Escape') closeSelect(); return; }
  if (screen === 'title') { if (k === 'Enter') startGame(firstUnsolved()); return; }
  if (k === 'Escape') { openMenu(); return; }
  keys.add(k.length === 1 ? k.toLowerCase() : k);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  if (k === ' ') jumpQueued = true;
  if (k === 'e' || k === 'E') useE();
  if (k === 'q' || k === 'Q') rotate();
  if (k === 'Enter') { if (st.solved && hasNext()) goNext(); else bind(); }
  if (k === 'm' || k === 'M') nextBgm();
});
window.addEventListener('keyup', (e) => { const k = e.key; keys.delete(k); keys.delete(k.toLowerCase()); keys.delete(k.toUpperCase()); });
// 右クリック・ウィンドウの切りかえで keyup が届かず、押されたままになるのを防ぐ
window.addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => keys.clear());
window.addEventListener('contextmenu', (e) => { keys.clear(); if (e.target.closest('canvas')) e.preventDefault(); });
window.addEventListener('pointerdown', () => { initAudio(); startBgm(); });

// タイトル・図版えらび・メニュー
$('tStart').addEventListener('click', () => { se.click(); startGame(firstUnsolved()); });
$('tSelect').addEventListener('click', () => { se.click(); renderSelect('title'); });
$('tHelp').addEventListener('click', () => { $('help').hidden = false; });
function closeSelect() { if (selectFrom === 'game') { showScreen('game'); openMenu(); } else showScreen('title'); }
function closeHelp() { $('help').hidden = true; if (screen === 'game') $('menu').hidden = false; }
$('selClose').addEventListener('click', closeSelect);
$('mResume').addEventListener('click', () => { $('menu').hidden = true; });
$('mRetry').addEventListener('click', () => { se.click(); startGame(st.lv); });
$('mSelect').addEventListener('click', () => { se.click(); renderSelect('game'); });
$('mHelp').addEventListener('click', () => { $('menu').hidden = true; $('help').hidden = false; });
$('mTitle').addEventListener('click', () => { se.click(); showScreen('title'); });
$('helpClose').addEventListener('click', closeHelp);

// 音
function renderSound() { for (const b of document.querySelectorAll('.sound-btn')) b.textContent = isMuted() ? '音: なし' : '音: あり'; }
for (const b of document.querySelectorAll('.sound-btn')) b.addEventListener('click', () => { initAudio(); setMuted(!isMuted()); renderSound(); });
renderSound();
const bgmSels = [$('bgmSel'), $('mBgm')];
for (const sel of bgmSels) {
  for (const b of BGM_LIST) { const o = document.createElement('option'); o.value = b.id; o.textContent = b.name; sel.appendChild(o); }
  sel.value = bgmId();
  sel.addEventListener('change', () => { initAudio(); setBgm(sel.value); startBgm(); for (const s2 of bgmSels) s2.value = sel.value; sel.blur(); });
}
function nextBgm() {
  const i = BGM_LIST.findIndex((b) => b.id === bgmId());
  const nx = BGM_LIST[(i + 1) % BGM_LIST.length];
  setBgm(nx.id); startBgm();
  for (const s2 of bgmSels) s2.value = nx.id;
  flashPrompt('♪ ' + nx.name);
}

// 時間のしおり: クリック・ドラッグでその秒へ（主人公ごと）
const tl = $('timeline');
let tlDrag = false;
function tlJump(e) {
  const r = tl.getBoundingClientRect();
  const pad = 30;
  const u = (e.clientX - r.left - pad) / (r.width - pad * 2);
  const nt = Math.max(0, Math.min(L.T, Math.round(u * L.T)));
  const h = st.hero;
  const g = groundAt(L, st.pieces, h.x, nt, Infinity);
  if (Number.isFinite(g)) { h.t = nt; h.y = g; h.vy = 0; }
}
tl.addEventListener('pointerdown', (e) => { tlDrag = true; tl.setPointerCapture(e.pointerId); tlJump(e); });
tl.addEventListener('pointermove', (e) => { if (tlDrag) tlJump(e); });
tl.addEventListener('pointerup', () => { tlDrag = false; });
const tg = tl.getContext('2d');
function drawTimeline() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = tl.clientWidth, h = tl.clientHeight;
  if (!w) return;
  if (tl.width !== Math.round(w * dpr)) { tl.width = Math.round(w * dpr); tl.height = Math.round(h * dpr); }
  tg.setTransform(dpr, 0, 0, dpr, 0, 0);
  tg.clearRect(0, 0, w, h);
  const pad = 30, X = (t) => pad + (t / L.T) * (w - pad * 2);
  // 見に行ったところまで、紙を明るく
  tg.fillStyle = 'rgba(255,248,226,.85)';
  tg.fillRect(X(0), 10, X(Math.min(L.T, st.revealT)) - X(0), 14);
  tg.strokeStyle = 'rgba(74,51,32,.55)'; tg.lineWidth = 1;
  tg.beginPath(); tg.moveTo(X(0), 24.5); tg.lineTo(X(L.T), 24.5); tg.stroke();
  tg.fillStyle = '#6b4f33'; tg.font = 'italic 10px Georgia, serif'; tg.textAlign = 'center';
  for (let t = 0; t <= L.T; t++) {
    const big = t % 5 === 0;
    tg.beginPath(); tg.moveTo(X(t), 24.5); tg.lineTo(X(t), big ? 16 : 20); tg.stroke();
    if (big) tg.fillText(t + '', X(t), 36);
  }
  tg.font = '11px "Yu Mincho", serif';
  tg.textAlign = 'left'; tg.fillText('昔', 4, 28); tg.textAlign = 'right'; tg.fillText('未来', w - 2, 28);
  // 結末は、見に行っていれば
  const e = st.hist.end;
  if (e.type !== 'time' && e.t <= st.revealT && !stage.waving()) {
    const x = X(e.t);
    if (e.type === 'goal') { tg.fillStyle = '#c99a4a'; tg.beginPath(); tg.arc(x, 13, 5, 0, 7); tg.fill(); }
    else { tg.fillStyle = '#8f3b2b'; tg.beginPath(); tg.moveTo(x, 7); tg.lineTo(x + 5, 13); tg.lineTo(x, 19); tg.lineTo(x - 5, 13); tg.fill(); }
  }
  tg.fillStyle = '#a8742a';
  const hx = X(Math.max(0, Math.min(L.T, st.hero.t)));
  tg.fillRect(hx - 1.5, 4, 3, 22);
}

// ---- ひとことの導き ----
function coachText() {
  if (st.solved) return hasNext() ? '正史ができた。Enter で次の図版へ' : '正史ができた';
  if (st.lv === 0 && !st.boundOnce && !st.carry && blockPieces().length && st.hintIdx >= (L.hints || []).length) return 'これで巣に着くと思ったら、Enter で この歴史を綴じよう';
  const hs = L.hints || [];
  const c = { walked: st.walked, seenEnd: st.revealT >= st.base.end.t, placed: blockPieces().length > 0 };
  while (st.hintIdx < hs.length && hs[st.hintIdx].when(c)) st.hintIdx++;
  if (st.hintIdx < hs.length) return hs[st.hintIdx].text;
  if (c.placed && L.fail && st.failedOnce) return L.fail;
  return '';
}
let coachShown = null;
function renderCoach() {
  const t = coachText();
  if (t === coachShown) return;
  coachShown = t;
  const el = $('coach');
  el.classList.add('off');
  setTimeout(() => { el.textContent = coachShown; el.classList.toggle('off', !coachShown); }, 220);
}

// そのとき使えるキー
function renderPrompt(why) {
  let html = '';
  const g = grabbable();
  if (performance.now() < flashUntil) html = flashMsg;
  else if (st.carry) html = `<kbd>E</kbd> 置く　<kbd>Q</kbd> 回す` + (why ? `<span class="bad">${why}</span>` : '');
  else if (g) html = `<kbd>E</kbd> ${kindName(g.kind)}をつかむ` + (blockPieces().length && !st.solved ? '　<kbd>Enter</kbd> 綴じる' : '');
  else if (blockPieces().length && !st.solved) html = '<kbd>Enter</kbd> この歴史を綴じる';
  else if (st.walked < 2 && st.lv === 0) html = `<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 歩く　<kbd>Shift</kbd> 走る　<kbd>Space</kbd> 跳ぶ　ドラッグ 見回す`;
  const el = $('prompt');
  if (el.innerHTML !== html) el.innerHTML = html;
}

// ---- 綴じる（答える）: 再生して見届けてから、正史かどうかを出す ----
const hasNext = () => st.lv + 1 < LEVELS.length;
function goNext() { se.click(); startGame(st.lv + 1); }
const rp = { t: 0, playing: true, speed: 4, judged: true, endT: 0, gA: $('rpA').getContext('2d'), gB: $('rpB').getContext('2d') };
function bind() {
  if (stage.waving()) return;
  if (!blockPieces().length) { flashPrompt('まだ何も置いていない'); se.no(); return; }
  st.boundOnce = true;
  se.click();
  closeAll();
  $('rpTitle').textContent = 'この歴史を綴じる';
  $('rpResult').hidden = true;
  $('rpNext').hidden = true;
  $('rpClose').hidden = true;
  $('replay').hidden = false;
  rp.judged = false;
  rp.endT = Math.min(L.T, st.hist.end.t + 1.2);
  rp.t = 0; rp.playing = true; rp.speed = 4; $('rpSpeed').value = '4'; $('rpPlay').textContent = '❚❚';
  keys.clear();
}
function judge() {
  rp.judged = true;
  const e = st.hist.end, ok = e.type === 'goal';
  const el = $('rpResult');
  el.className = 'rp-result ' + (ok ? 'ok' : 'ng');
  if (ok) {
    st.solved = true;
    const n = blockPieces().length;
    const prev = progress[L.id];
    progress[L.id] = { best: prev ? Math.min(prev.best, n) : n };
    saveProgress();
    el.innerHTML = '<span class="stamp">正史</span><p>キーウィは巣に着いた。この歴史を図版に綴じた。</p>';
    $('rpTitle').textContent = '正史ができた';
    se.goal();
  } else {
    const why = e.type === 'abyss' ? '崖に落ちてしまった' : e.type === 'fall' ? '高い所から落ちてしまった' : '巣に着かなかった';
    el.innerHTML = '<span class="stamp">まだ</span><p>キーウィは' + why + '。考えなおそう。</p>';
    $('rpTitle').textContent = 'まだ正史ではない';
    st.failedOnce = true;
    se.fall();
  }
  el.hidden = false;
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  $('rpNext').hidden = !(ok && hasNext());
  $('rpClose').hidden = false;
  $('rpClose').innerHTML = ok ? 'この図版にもどる <kbd>Esc</kbd>' : '考えなおす <kbd>Esc</kbd>';
}
// 綴じている最中に Esc → 最後まで早送りして結果を出す
function closeReplay() { if (!rp.judged) { rp.t = rp.endT; return; } $('replay').hidden = true; }
function togglePlay() { if (rp.t >= L.T) rp.t = 0; rp.playing = !rp.playing; $('rpPlay').textContent = rp.playing ? '❚❚' : '▶'; }
$('rpNext').addEventListener('click', goNext);
$('rpClose').addEventListener('click', closeReplay);
$('rpPlay').addEventListener('click', togglePlay);
$('rpSeek').addEventListener('input', (e) => { rp.t = +e.target.value; });
$('rpSpeed').addEventListener('change', (e) => { rp.speed = +e.target.value; });
function drawReplay() {
  const t = rp.t, lab = t.toFixed(1) + '秒';
  drawSheet(rp.gA, L, t, frameAt(st.base.frames, t), [], { paper: true, label: lab });
  drawSheet(rp.gB, L, t, frameAt(st.hist.frames, t), sectionsAt(blockPieces(), t), { paper: true, label: lab, goalT: st.hist.end.type === 'goal' ? st.hist.end.t : null });
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
    if (!rp.judged && rp.t >= rp.endT) judge();
    drawReplay();
  }
  // カメラ基準の移動（W＝画面の奥）
  let mx = 0, mt = 0;
  const act = playing();
  if (act) {
    const f = (keys.has('w') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('s') || keys.has('ArrowDown') ? 1 : 0);
    const r = (keys.has('d') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('a') || keys.has('ArrowLeft') ? 1 : 0);
    const yaw = stage.camYaw();
    // 画面の奥＝(x,t) で (-sin yaw, cos yaw)、画面の右＝(cos yaw, sin yaw)
    mx = r * Math.cos(yaw) - f * Math.sin(yaw);
    mt = r * Math.sin(yaw) + f * Math.cos(yaw);
  }
  const h = st.hero;
  const before = h.t;
  if (stepHero(h, L, st.pieces, mx, mt, act && jumpQueued, act ? dt : 0, act && keys.has('Shift')) === 'respawn') flashPrompt('底なしに落ちた。さっきの場所へもどる');
  jumpQueued = false;
  st.walked += Math.abs(h.t - before);
  st.revealT = Math.max(st.revealT, Math.min(L.T, h.t + 3));
  const focus = Math.max(0, Math.min(L.T, Math.round(h.t)));
  if (focus !== lastFocus && act) { se.page(); lastFocus = focus; }

  const cand = act ? candidate() : null;
  const why = cand ? canPlace(L, cand, st.pieces) : '';
  stage.update(dt, {
    hero: h, walking: Math.hypot(mx, mt) > 0.05, moveX: mx, moveT: mt,
    carry: st.carry, cand, candOk: !why, revealT: st.revealT, focus,
    groundY: groundAt(L, st.pieces, h.x, h.t, h.y),
  });

  if (screen === 'game') {
    $('clockNum').textContent = focus;
    drawTimeline();
    renderCoach();
    renderPrompt(why);
    // 正史かどうかは、遊ぶ人が「綴じる」（Enter）まで判定しない
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
window.__fh = { st, LEVELS, simulate, keys, startGame, useE, rotate, candidate, bind, judge, rp, stage, get L() { return L; } };
