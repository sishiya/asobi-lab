// 操作・画面（タイトル・図版えらび・面・Esc メニュー）・ひとことの導き・くらべて再生
// v009: 主人公が時空の大地を歩く（REDESIGN.md 段階1〜2）。v031: 形は標本台からではなく、パレットから直接置く
import { LEVELS } from './level.js?v=49';
import { simulate, sectionsAt, frameAt, restHeight, canPlace, canPlaceQuick, overlapsWalker, pieceDims, sectionRects } from './sim.js?v=49';
import { drawSheet } from './sheet.js?v=49';
import { createStage, misprintOf, drawPieceIcon } from './stage3d.js?v=49';
import { kindName, look, HERO_LIST, RES_LIST, setHero, setRes } from './look/index.js?v=49';
import { makeHero, stepHero, groundAt, pieceUnder } from './hero.js?v=49';
import { initAudio, startBgm, se, setVolumes, BGM_LIST, bgmId, setBgm, duckBgm } from './audio.js?v=49';

const $ = (id) => document.getElementById(id);

// ---- 進みぐあい（このブラウザだけに覚える） ----
let progress = {};
try { progress = JSON.parse(localStorage.getItem('flat-history.progress') || '{}'); } catch (e) { progress = {}; }
function saveProgress() { try { localStorage.setItem('flat-history.progress', JSON.stringify(progress)); } catch (e) { /* なし */ } }

// ---- 設定（このブラウザだけに覚える） ----
const DEF = { bgmVol: 0.6, seVol: 0.7, bgm: 'minuet', runDefault: true, inset: true, invX: false, invY: false, move: 'tap', hero: 'hourglass', res: 'kiwi' };
let cfg = { ...DEF };
try { cfg = { ...DEF, ...JSON.parse(localStorage.getItem('flat-history.settings2') || '{}') }; } catch (e) { cfg = { ...DEF }; }
function saveCfg() { try { localStorage.setItem('flat-history.settings2', JSON.stringify(cfg)); } catch (e) { /* なし */ } }
// v034: 主人公・住人をしぼった。やめた者を選んでいた人・前の既定（多面体）のままの人は、砂時計とキーウィへ。通り道・透かしの設定はやめた
if (!cfg.v34) { cfg.hero = 'hourglass'; cfg.v34 = true; }
if (!HERO_LIST.some((c) => c.id === cfg.hero)) cfg.hero = 'hourglass';
if (!RES_LIST.some((c) => c.id === cfg.res)) cfg.res = 'kiwi';
delete cfg.showRoute; delete cfg.heroSlice;
saveCfg();
setHero(cfg.hero); setRes(cfg.res);
setVolumes(cfg.bgmVol, cfg.seVol);
setBgm(cfg.bgm);
// 図版の文の「キーウィ」「巣」を、いまの住人に合わせる
// 住人ごとに言葉を入れかえる（日本語は「キーウィ・巣・卵」、英語は kiwi・nest を入れかえる）
const tx = (str) => LANG === 'en'
  ? str.replace(/\bkiwi\b/g, look().who).replace(/\bnest\b/g, look().goalName)
  : str.replaceAll('キーウィ', look().who).replaceAll('巣', look().goalName).replaceAll('卵', look().goalThing);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

let L = LEVELS[0];
const st = {
  lv: 0, pieces: [], nextId: 1, base: null, hist: null,
  hero: null, carry: null, revealT: 0, walked: 0,
  hintIdx: 0, solved: false, lastEnd: '', boundOnce: false, failedOnce: false,
  lock: null, aim: null, hoverPiece: null,
};
const stage = createStage($('view'), L);
// 画面をタップ／クリック: 持っていれば、そこへ置く（指では1回目で場所を決め、ゴーストをもう一度タップで置く）。
// 置いた形をクリックすれば持ち上げる。かんたん操作（タップで歩く）なら、地面をタップしてそこへ歩く
stage.onTap = (x, t, pid) => {
  if (!playing()) return;
  if (st.carry) { if (x !== null) tapAt(x, t); return; }
  const p = pid !== null && st.pieces.find((q) => q.id === pid);
  if (p) { pickUp(p); return; }
  if (tapWalk() && x !== null) walkTo(x, t);
};
// マウスを動かす: 持っていればゴーストがついてくる。置いた形の上なら、その形が光る
stage.onHover = (x, t, pid) => {
  st.hoverPiece = pid;
  if (st.carry && x !== null) { st.aim = { x, t }; st.lock = null; }
};
stage.onRight = () => { if (playing() && st.carry) rotate(); };
stage.setInvert(!!cfg.invX, !!cfg.invY);
// 指での動かし方: タップで歩く（スティックをしまう）／スティック
function applyMove() { document.body.classList.toggle('stickmode', cfg.move === 'stick'); walk.to = null; }
const blockPieces = () => st.pieces;

// ---- 面をはじめる ----
function loadLevel(i) {
  st.lv = i; L = LEVELS[i];
  st.pieces = []; st.nextId = 1; st.carry = null; st.aim = null; st.hoverPiece = null;
  st.base = simulate(L, []); st.hist = st.base;
  st.hero = makeHero(L);
  st.revealT = 3; st.walked = 0;
  st.hintIdx = 0; st.solved = false; st.lastEnd = st.base.end.type; st.failedOnce = false; st.boundOnce = false; st.rotatedOnce = false;
  stage.setLevel(L);
  stage.setHistory(st.hist, st.pieces, 0, false);
  stage.resetCamera();
  st.lock = null; st.dirty = false;
  renderPalette();
  $('lvPlate').textContent = 'Pl. ' + L.plate;
  $('lvName').textContent = L.name;
  closeAll();
}
function showIntro() {
  const el = $('intro');
  el.innerHTML = `<span class="pn">Pl. ${L.plate} ・ ${TX(`${look().who}の ${st.lv + 1}代目`, `${cap(look().who)}, generation ${st.lv + 1}`)}</span><span class="nm">${L.name}</span>`;
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(showIntro.t);
  showIntro.t = setTimeout(() => { el.hidden = true; }, 2900);
}

// ---- 形のパレット: 図版で使える形と、のこりの数。えらぶと手に持ち、画面で置きたい所をクリック ----
const left = (kind) => (L.stock[kind] || 0) - st.pieces.filter((p) => p.kind === kind).length - (st.carry && st.carry.kind === kind ? 1 : 0);
function renderPalette() {
  const box = $('palList');
  box.innerHTML = '';
  Object.keys(L.stock).forEach((kind) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'kind'; b.dataset.kind = kind;
    const cv = document.createElement('canvas'); cv.width = 132; cv.height = 96;
    drawPieceIcon(cv, kind);
    b.append(cv);
    b.title = kindName(kind);
    b.setAttribute('aria-label', kindName(kind));
    b.insertAdjacentHTML('beforeend', '<span class="ct"></span>');
    b.addEventListener('click', () => { initAudio(); startBgm(); if (playing()) choose(kind); });
    box.appendChild(b);
  });
  palKey = '';
}
let palKey = '';
function updatePalette() {
  const k = Object.keys(L.stock).map((kind) => left(kind)).join(',') + '|' + (st.carry ? st.carry.kind : '');
  if (k === palKey) return;
  palKey = k;
  for (const b of $('palList').children) {
    const n = left(b.dataset.kind), sel = !!st.carry && st.carry.kind === b.dataset.kind;
    b.querySelector('.ct').textContent = n;
    b.classList.toggle('sel', sel);
    b.classList.toggle('empty', n <= 0 && !sel);
  }
}
// パレットの形をえらぶ（同じ形をもう一度えらぶと、やめる）
function choose(kind) {
  if (st.carry && st.carry.kind === kind) { cancelCarry(); return; }
  if (left(kind) <= 0) { flashPrompt(TX('この形は、もう全部置いた（置いた形をクリックすると持ち上げられる）', 'All of these are placed (click a placed shape to pick it up)')); se.no(); return; }
  st.carry = { kind, rot: 0 };
  st.lock = null; walk.to = null;
  se.pick();
}
// 持っている形をパレットへもどす
function cancelCarry() { if (!st.carry) return; st.carry = null; st.lock = null; se.click(); }

// ---- 画面の切りかえ ----
let screen = 'title';
function showScreen(name) {
  screen = name;
  if (name === 'title') updateTitle();
  $('title').hidden = name !== 'title';
  $('select').hidden = name !== 'select';
  document.body.classList.toggle('menu', name !== 'game');
  closeAll();
  keys.clear();
}
function closeAll() { for (const id of ['menu', 'help', 'replay', 'preview', 'settings', 'ending']) $(id).hidden = true; }
function startGame(i) { stage.openBook(); bindingNow = false; loadLevel(i); showScreen('game'); openPreview(); }
// 図版のはじめに、はじめの歴史（住人が失敗するようす）を見せる。作戦を立ててから Enter ではじめる
const pv = { t: 0, playing: true, g: $('pvCanvas').getContext('2d') };
function openPreview() {
  closeAll();
  lockEnter();
  $('pvPlate').textContent = 'Pl. ' + L.plate;
  $('pvName').textContent = L.name;
  $('pvSeek').max = L.T;
  pv.t = 0; pv.playing = true; $('pvPlay').textContent = '❚❚';
  $('preview').hidden = false;
  keys.clear();
}
function closePreview() { $('preview').hidden = true; showIntro(); lockEnter(400); }
function drawPreview(dt) {
  const lastEv = st.base.events.reduce((m, e) => (e.type === 'plug' || e.type === 'stoneStop' || e.type === 'stoneGone' ? Math.max(m, e.t) : m), 0);
  const endT = Math.min(L.T, Math.max(st.base.end.t, lastEv) + 1.5);
  if (pv.playing) { pv.t += dt * 2; if (pv.t > endT + 1) pv.t = 0; }
  const t = Math.min(pv.t, endT);
  if (t < (pv.lastT || 0)) { pv.lastT = t; pv.walk = 0; }
  replaySounds(st.base, pv, t);
  drawSheet(pv.g, L, t, frameAt(st.base.frames, t), [], { paper: true, label: t.toFixed(1) + TX('秒', 's'), misprintAfter: misprintOf(st.base) });
  $('pvSeek').value = t;
}
$('pvPlay').addEventListener('click', () => { pv.playing = !pv.playing; $('pvPlay').textContent = pv.playing ? '❚❚' : '▶'; });
$('pvSeek').addEventListener('input', (e) => { pv.t = +e.target.value; pv.playing = false; $('pvPlay').textContent = '▶'; });
$('pvStart').addEventListener('click', () => { se.click(); closePreview(); });
// 遊んだ記録があるか（タイトルの「つづきから」）
const hasProgress = () => LEVELS.some((l) => progress[l.id]) && LEVELS.some((l) => !progress[l.id]);
function updateTitle() {
  const c = $('tCont');
  c.hidden = !hasProgress();
  if (!c.hidden) c.textContent = TX(`つづきから（Pl. ${LEVELS[firstUnsolved()].plate}）`, `Continue (Pl. ${LEVELS[firstUnsolved()].plate})`);
}
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
      b.innerHTML = `<span class="pn">Pl. ${l.plate} ・ ${TX(`${i + 1}代目`, `Gen. ${i + 1}`)}</span><span class="nm">${l.name}</span><span class="st">${p ? TX(`正史ずみ・ひながかえった（形 ${p.best} つ）`, `True history ✓ (${p.best} shape${p.best > 1 ? 's' : ''})`) : TX('まだ', 'Not yet')}</span>`;
      b.addEventListener('click', () => { se.click(); startGame(i); });
      box.appendChild(b);
    });
  }
  $('selEnding').hidden = !allSolved();
  showScreen('select');
}
const allSolved = () => LEVELS.every((l) => progress[l.id]);
// ---- エンディング: 全部の図版が正史になったら、代々の住人が一枚のページをいっしょに歩く ----
const ENDL = { id: 'ending', W: 36, H: 14, T: 60, plate: '∞', tops: new Array(36).fill(4), start: { x: 1.6, dir: 1 }, goal: { x: 31 } };
const ed = { t: 0, on: false, g: null };
function openEnding() {
  progress._ending = true; saveProgress();
  closeAll(); $('ending').hidden = false; ed.t = 0; ed.on = true; ed.g = $('edCanvas').getContext('2d');
  duckBgm(false); se.goal();
  lockEnter(1500);
}
function closeEnding() { $('ending').hidden = true; ed.on = false; renderSelect('title'); }
function drawEnding(dt) {
  ed.t += dt;
  const g = ed.g, n = LEVELS.length, t = ed.t;
  drawSheet(g, ENDL, 0, null, [], { paper: true });
  // 代々の住人（先頭が1代目）。巣に着いた者から、よろこぶ
  for (let i = 0; i < n; i++) {
    const x = Math.min(ENDL.goal.x - i * 1.6, 1.6 + (t - i * 0.7) * 1.5);
    if (x < 1.2) continue;
    const arrived = x >= ENDL.goal.x - i * 1.6 - 0.01;
    look().drawWalker(g, ENDL, { x, y: 4, dir: 1, st: arrived ? 'goal' : 'walk', since: arrived ? t : null }, 20);
  }
  // 係（あなた）も、ただ一度だけ、この本に刷られる
  // 係は刷られない。最後のページを光にかざしたときだけ、透かしとして見える
  if (t > 6) { g.save(); g.globalAlpha = 0.5 * Math.min(1, (t - 6) / 2) * (0.85 + 0.15 * Math.sin(t * 1.5)); stage.heroPortrait(g, 33.6, 4); g.restore(); }
  const lines = LANG === 'en'
    ? ['The field guide is now one complete book.', `${n} generations of the ${look().who}’s true history are bound here.`, 'Held up to the light, a strange shape shows as a watermark in the corner.']
    : ['図鑑が、一冊になった。', `${look().who}の ${n}代の正史が、ここに綴じられている。`, '光にかざすと、すみに見なれない形の透かしがひとつ。'];
  lines.forEach((s2, i) => { const a = Math.max(0, Math.min(1, (t - 1.5 - i * 2.2) / 1.2)); g.fillStyle = `rgba(74,51,32,${a})`; g.font = '18px "Yu Mincho", serif'; g.textAlign = 'center'; g.fillText(s2, 360, 46 + i * 28); });
  g.textAlign = 'left';
  $('edClose').hidden = t < 1.5;
}
$('edClose').addEventListener('click', closeEnding);
$('edCanvas').addEventListener('click', () => { if (ed.t > 1.5) closeEnding(); });
$('selEnding').addEventListener('click', () => { se.click(); openEnding(); });

const openMenu = () => { closeAll(); $('menu').hidden = false; keys.clear(); se.click(); };
const modalOpen = () => ['menu', 'help', 'replay', 'preview', 'settings', 'ending'].some((id) => !$(id).hidden);
const playing = () => screen === 'game' && !modalOpen() && !bindingNow;

// ---- つかむ・置く・回す ----
function facingAxis() {
  const h = st.hero;
  return Math.abs(h.ft) >= Math.abs(h.fx) ? { ax: 't', s: Math.sign(h.ft) || 1 } : { ax: 'x', s: Math.sign(h.fx) || 1 };
}
// ---- 置き場所: 目の前のあたりで、いちばん「はまる」所（受け口）にゴーストが吸いつく ----
// くぼみ（両がわが壁）・谷にかかる橋（両はしが支え）・となりの地面と面がそろう所ほど強く吸いつく
const colTop = (i) => (i < 0 || i >= L.W ? Infinity : L.tops[i]); // 世界のはしは壁
function fitScore(c) {
  const d = pieceDims(c), x0 = c.x0, x1 = c.x0 + d.wx;
  let s = 0;
  const lw = colTop(x0 - 1) > c.y0 + 0.5, rw = colTop(x1) > c.y0 + 0.5;
  s += lw && rw ? 3 : lw || rw ? 1.2 : 0;
  let gap = false;
  for (let i = x0; i < x1; i++) if (colTop(i) < c.y0 - 0.5) gap = true;
  if (gap && colTop(x0) >= c.y0 - 0.01 && colTop(x1 - 1) >= c.y0 - 0.01) s += 2.5;
  const rise = d.along === 'z' ? d.slope * d.dz : d.slope * d.wx;
  for (const tp of [c.y0 + d.h, c.y0 + d.h + rise]) if (Math.abs(colTop(x0 - 1) - tp) < 0.15 || Math.abs(colTop(x1) - tp) < 0.15) { s += 1; break; }
  return s;
}
// (cx, ct) を中心にした置き場所の候補を、はまりのよい順に（置けるものだけ。住人の検査は上から順に）
let sockCache = { key: '', list: [], base: null };
function socketsAround(cx, ct, R = 4) {
  const c0 = { kind: st.carry.kind, rot: st.carry.rot }, d = pieceDims(c0);
  const bx = Math.round(cx - d.wx / 2), bt = Math.round(ct - d.dz / 2);
  const key = [L.id, c0.kind, c0.rot, bx, bt, R, st.pieces.map((p) => p.id + ':' + p.x0 + ':' + p.t0).join(',')].join('|');
  if (key === sockCache.key) return sockCache.list;
  const all = [];
  for (let dx = -R; dx <= R; dx++) for (let dt = -R; dt <= R; dt++) {
    const c = { ...c0, x0: bx + dx, t0: bt + dt };
    c.y0 = restHeight(L, c);
    if (canPlaceQuick(L, c, st.pieces)) continue;
    c.score = Math.hypot(dx, dt) * 0.75 - fitScore(c);
    all.push(c);
  }
  all.sort((a, b) => a.score - b.score);
  const list = [];
  // Tab で巡る候補は、横の位置がちがうものを（秒は、主人公が奥・手前へ歩いて決める）
  for (const c of all) {
    if (list.some((q) => q.x0 === c.x0)) continue;
    if (!overlapsWalker(L, c, st.pieces)) list.push(c);
    if (list.length >= 5) break;
  }
  const base = { ...c0, x0: bx, t0: bt };
  base.y0 = restHeight(L, base);
  sockCache = { key, list, base };
  return list;
}
// 持っている形を、どこに置くか。マウスが指す所（st.aim）のそばの受け口。矢印・タップで決めた所（錠）は、マウスを動かすまで動かない
let lastPick = '';
function aimCenter(d) {
  const h = st.hero, f = facingAxis();
  return [f.ax === 'x' ? h.x + f.s * (0.8 + d.wx / 2) : h.x, f.ax === 't' ? h.t + f.s * (0.8 + d.dz / 2) : h.t];
}
function candidate() {
  if (!st.carry) return null;
  const h = st.hero;
  const d = pieceDims({ kind: st.carry.kind, rot: st.carry.rot });
  if (st.lock && (st.lock.kind !== st.carry.kind || st.lock.rot !== st.carry.rot)) st.lock = null;
  if (st.lock) {
    const c = { kind: st.carry.kind, rot: st.carry.rot, x0: st.lock.x0, t0: st.lock.t0 };
    c.y0 = restHeight(L, c);
    return c;
  }
  // マウスで指していなければ、主人公の目の前
  const [cx, ct] = st.aim ? [st.aim.x, st.aim.t] : aimCenter(d);
  const list = socketsAround(cx, ct, st.aim ? 2 : 4);
  if (!list.length) return { ...sockCache.base };
  // ちらつかないよう、前に選んだ所がまだ候補でほぼ同じよさなら、それのまま
  const prev = list.find((c) => c.x0 + ',' + c.t0 === lastPick);
  const pick = prev && prev.score <= list[0].score + 0.6 ? prev : list[0];
  lastPick = pick.x0 + ',' + pick.t0;
  return pick;
}
function lockTo(c) {
  st.lock = { kind: c.kind, rot: c.rot, x0: c.x0, t0: c.t0 };
  lastPick = c.x0 + ',' + c.t0;
}
// 矢印: 1マスずつずらす（画面の上＝カメラの奥を、いちばん近い軸にそろえる）
function nudge(k) {
  const yaw = stage.camYaw();
  const f = [-Math.sin(yaw), Math.cos(yaw)], r = [Math.cos(yaw), Math.sin(yaw)];
  const snap = (v) => (Math.abs(v[0]) > Math.abs(v[1]) ? [Math.sign(v[0]), 0] : [0, Math.sign(v[1])]);
  const d = k === 'ArrowUp' ? snap(f) : k === 'ArrowDown' ? snap(f).map((q) => -q) : k === 'ArrowRight' ? snap(r) : snap(r).map((q) => -q);
  const c = candidate();
  lockTo({ ...c, x0: c.x0 + d[0], t0: c.t0 + d[1] });
  se.click();
}
// ---- かんたん操作: タップした所へ歩く（スマホではこれが最初。スティックは設定で選ぶ） ----
const tapWalk = () => isTouch && cfg.move !== 'stick';
const walk = { to: null, best: 0, since: 0, jumped: false };
function walkTo(x, t) {
  walk.to = { x: Math.max(-6.8, Math.min(L.W - 0.2, x)), t: Math.max(-0.8, Math.min(L.T + 0.4, t)) };
  walk.best = Infinity; walk.since = 0; walk.jumped = false;
  se.click();
}
// 行き先へ向かう向き（着いた・進めない・この先が崖なら止まる）。戻り値 [mx, mt, 走るか]
function walkStep(dt) {
  const h = st.hero, w = walk.to;
  const dx = w.x - h.x, dz = w.t - h.t, d = Math.hypot(dx, dz);
  if (d < 0.35) { walk.to = null; return null; }
  const ux = dx / d, uz = dz / d;
  // この先が底なし・高すぎる崖なら、ふちで止まる
  const ax = h.x + ux * 0.7, at = h.t + uz * 0.7, g = groundAt(L, st.pieces, ax, at, h.y + 1.2);
  if (h.grounded && (g === -Infinity || h.y - g > 3.4)) { walk.to = null; flashPrompt(TX('この先は落ちてしまう。ここで止まった', 'You’d fall from here, so you stopped')); return null; }
  // 段が高くて進めないときは、一度だけ跳ぶ（よじ登れる高さなら登る）。それでも進めなければあきらめる
  if (d < walk.best - 0.05) { walk.best = d; walk.since = 0; } else walk.since += dt;
  if (walk.since > 0.3 && !walk.jumped) { jumpQueued = true; walk.jumped = true; walk.since = 0; }
  else if (walk.since > 0.9 && walk.jumped) { walk.to = null; flashPrompt(TX('そこへは歩いて行けない', 'You can’t walk there')); return null; }
  const k = Math.min(1, d / 0.8);
  return [ux * k, uz * k, d > 3];
}
// 画面をタップ／クリック: そこのいちばん近い受け口に置く（遠くても置ける）。
// 指では、1回目のタップでゴーストを動かし、ゴーストの上をもう一度タップすると置く
function tapAt(x, t) {
  if (!playing() || !st.carry) return;
  const before = isTouch ? candidate() : null;
  st.aim = { x, t }; st.lock = null;
  const c = candidate();
  if (isTouch && !(before && before.x0 === c.x0 && before.t0 === c.t0)) { lockTo(c); se.click(); return; }
  useE();
}
// 目の前（または足もと）でつかめる形
function grabbable() {
  if (st.carry) return null;
  const h = st.hero;
  // 目の前の点と、足もとの点（乗っている形もつかめる）
  const pts = [[h.x + h.fx * 1.0, h.t + h.ft * 1.0], [h.x, h.t]];
  let best = null, bd = 9;
  for (const p of st.pieces) {
    const d = pieceDims(p);
    let dist = 9;
    for (const [px, pt] of pts) {
      const dx = Math.max(p.x0 - px, 0, px - (p.x0 + d.wx));
      const dt = Math.max(p.t0 - pt, 0, pt - (p.t0 + d.dz));
      dist = Math.min(dist, Math.hypot(dx, dt));
    }
    // 高さは、形の下から、いちばん高い上の面まで（ななめの板や柱の上でも）
    const top = p.y0 + d.h + Math.max(0, d.along === 'z' ? d.slope * d.dz : d.slope * d.wx);
    if (dist < 0.9 && dist < bd && h.y > p.y0 - 2.5 && h.y < top + 0.6) { best = p; bd = dist; }
  }
  return best;
}
function recompute(fromT) {
  st.solved = false;
  st.dirty = true;
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
    const p = { id: st.nextId++, kind: c.kind, rot: c.rot, x0: c.x0, t0: c.t0, y0: c.y0 };
    st.lock = null;
    st.pieces.push(p);
    st.carry = null;
    se.place();
    recompute(p.t0);
    return;
  }
  const p = grabbable();
  if (p) pickUp(p);
}
// 置いた形を持ち上げる（ゴーストは、いまの場所から）
function pickUp(p) {
  st.pieces = st.pieces.filter((q) => q !== p);
  st.carry = { kind: p.kind, rot: p.rot || 0 };
  lockTo(p);
  st.hoverPiece = null; walk.to = null;
  se.pick();
  recompute(p.t0);
}
function rotate() {
  if (!st.carry) return;
  st.carry = { ...st.carry, rot: st.carry.rot ? 0 : 1 };
  st.lock = null;
  st.rotatedOnce = true;
  se.click();
}
let flashMsg = '', flashUntil = 0;
// Enter の連打で思わぬほうへ進まないよう、画面がかわってすぐは受けつけない
let enterLock = 0;
const lockEnter = (ms = 600) => { enterLock = performance.now() + ms; };
const enterOk = () => performance.now() > enterLock;

// ---- スマホ: 左下のスティックと、右下のボタン ----
const isTouch = window.matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
const joy = { x: 0, y: 0, id: null };
{
  const stick = $('stick'), knob = $('stickKnob');
  const R = 46;
  const move = (e) => {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    joy.x = dx / R; joy.y = dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  stick.addEventListener('pointerdown', (e) => { initAudio(); startBgm(); joy.id = e.pointerId; stick.setPointerCapture(e.pointerId); move(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) move(e); });
  const up = () => { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', up); stick.addEventListener('pointercancel', up);
  const tap = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); initAudio(); startBgm(); if (playing()) fn(); });
  tap('tJump', () => { jumpQueued = true; });
  tap('tGrab', () => useE());
  tap('tRot', () => rotate());
  tap('tCancel', () => cancelCarry());
}
// 案内の帯のボタン（PC）
$('prompt').addEventListener('click', (e) => {
  const b = e.target.closest('.pbtn'); if (!b || !playing()) return;
  const a = b.dataset.act;
  if (a === 'place' || a === 'grab') useE(); else if (a === 'rot') rotate(); else if (a === 'cancel') cancelCarry();
});
function flashPrompt(m) { flashMsg = m; flashUntil = performance.now() + 1800; }

// ---- 入力 ----
const keys = new Set();
let jumpQueued = false;
window.addEventListener('keydown', (e) => {
  initAudio(); startBgm();
  const k = e.key;
  if (!$('replay').hidden) {
    if (k === 'Escape') closeReplay();
    else if (k === 'Enter' && rp.judged && enterOk() && st.solved) goNext();
    else if (k === 'Enter' && rp.judged && enterOk() && !st.solved) closeReplay();
    else if (k === ' ' || k === 'p' || k === 'P') { e.preventDefault(); togglePlay(); }
    return;
  }
  if (!$('ending').hidden) { if ((k === 'Enter' || k === 'Escape') && !$('edClose').hidden && enterOk()) closeEnding(); return; }
  if (!$('preview').hidden) {
    if ((k === 'Enter' || k === ' ') && enterOk()) { e.preventDefault(); closePreview(); }
    else if (k === 'Escape') renderSelect('title');
    return;
  }
  if (!$('settings').hidden) { if (k === 'Escape') closeSettings(); return; }
  if (!$('help').hidden) { if (k === 'Escape' || k === 'Enter') closeHelp(); return; }
  if (!$('menu').hidden) { if (k === 'Escape') $('menu').hidden = true; return; }
  if (screen === 'select') { if (k === 'Escape') closeSelect(); return; }
  if (screen === 'title') { if (k === 'Enter') startGame(hasProgress() ? firstUnsolved() : 0); return; }
  if (k === 'Escape') { if (st.carry) cancelCarry(); else openMenu(); return; }
  keys.add(k.length === 1 ? k.toLowerCase() : k);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
  if (k.startsWith('Arrow') && st.carry) { nudge(k); return; }
  if (e.repeat) return;
  if (k === 'v' || k === 'V') { cfg.inset = !cfg.inset; saveCfg(); applyInset(); }
  if (k === ' ') jumpQueued = true;
  if (k === 'q' || k === 'Q') rotate();
  if (/^[1-9]$/.test(k)) { const kind = Object.keys(L.stock)[+k - 1]; if (kind) choose(kind); }
  if (k === 'Enter' && enterOk()) { if (st.solved) reopenResult(); else bind(); }
  if (k === 'm' || k === 'M') nextBgm();
});
window.addEventListener('keyup', (e) => { const k = e.key; keys.delete(k); keys.delete(k.toLowerCase()); keys.delete(k.toUpperCase()); });
// 右クリック・ウィンドウの切りかえで keyup が届かず、押されたままになるのを防ぐ
window.addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => keys.clear());
window.addEventListener('contextmenu', (e) => { keys.clear(); if (e.target.closest('canvas')) e.preventDefault(); });
// 音はページに触れてからでないと鳴らせない（ブラウザの決まり）。iPhone などは「離した」「クリック」で許されるので、そちらでも始める
for (const ev of ['pointerdown', 'pointerup', 'click', 'touchend']) window.addEventListener(ev, () => { initAudio(); startBgm(); }, { passive: true });

// タイトル・図版えらび・メニュー
document.querySelectorAll('.langsw [data-lang]').forEach((b) => {
  b.setAttribute('aria-pressed', b.dataset.lang === LANG);
  b.onclick = () => { if (b.dataset.lang !== LANG) setLang(b.dataset.lang); };
});
$('tStart').addEventListener('click', () => { se.click(); startGame(0); });
$('tCont').addEventListener('click', () => { se.click(); startGame(firstUnsolved()); });
$('tSelect').addEventListener('click', () => { se.click(); renderSelect('title'); });
$('tHelp').addEventListener('click', () => { $('help').hidden = false; });
function closeSelect() { if (selectFrom === 'game') { showScreen('game'); openMenu(); } else showScreen('title'); }
function closeHelp() { $('help').hidden = true; if (screen === 'game') $('menu').hidden = false; }
$('selClose').addEventListener('click', closeSelect);
$('mResume').addEventListener('click', () => { $('menu').hidden = true; });
$('btnMenu').addEventListener('click', () => { if (screen === 'game' && !modalOpen()) openMenu(); });
$('mRetry').addEventListener('click', () => { se.click(); startGame(st.lv); });
$('mSelect').addEventListener('click', () => { se.click(); renderSelect('game'); });
$('mHelp').addEventListener('click', () => { $('menu').hidden = true; $('help').hidden = false; });
$('mTitle').addEventListener('click', () => { se.click(); showScreen('title'); });
$('helpClose').addEventListener('click', closeHelp);

// ---- 設定画面 ----
let settingsFrom = 'title';
function openSettings(from) {
  settingsFrom = from;
  closeAll();
  $('sBgmVol').value = Math.round(cfg.bgmVol * 100);
  $('sSeVol').value = Math.round(cfg.seVol * 100);
  $('sBgm').value = cfg.bgm;
  $('sRun').checked = cfg.runDefault;
  $('sInset').checked = cfg.inset;
  $('sInvX').checked = !!cfg.invX; $('sInvY').checked = !!cfg.invY;
  $('sMove').value = cfg.move || 'tap';
  $('sHero').value = cfg.hero;
  $('sRes').value = cfg.res;
  $('settings').hidden = false;
  keys.clear();
}
function closeSettings() { $('settings').hidden = true; if (settingsFrom === 'game') $('menu').hidden = false; }
for (const b of BGM_LIST) { const o = document.createElement('option'); o.value = b.id; o.textContent = b.name; $('sBgm').appendChild(o); }
for (const c of HERO_LIST) { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; $('sHero').appendChild(o); }
for (const c of RES_LIST) { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; $('sRes').appendChild(o); }
$('sBgmVol').addEventListener('input', (e) => { cfg.bgmVol = e.target.value / 100; initAudio(); startBgm(); setVolumes(cfg.bgmVol, cfg.seVol); saveCfg(); });
$('sSeVol').addEventListener('input', (e) => { cfg.seVol = e.target.value / 100; setVolumes(cfg.bgmVol, cfg.seVol); saveCfg(); });
$('sSeVol').addEventListener('change', () => { initAudio(); se.goal(); });
$('sBgm').addEventListener('change', (e) => { cfg.bgm = e.target.value; initAudio(); setBgm(cfg.bgm); startBgm(); saveCfg(); });
$('sRun').addEventListener('change', (e) => { cfg.runDefault = e.target.checked; saveCfg(); });
$('sMove').options[0].textContent = TX('タップで歩く（かんたん）', 'Tap to walk (easy)');
$('sMove').options[1].textContent = TX('スティック', 'Stick');
$('sMove').addEventListener('change', (e) => { cfg.move = e.target.value; saveCfg(); applyMove(); });
$('sInvX').addEventListener('change', (e) => { cfg.invX = e.target.checked; saveCfg(); stage.setInvert(cfg.invX, cfg.invY); });
$('sInvY').addEventListener('change', (e) => { cfg.invY = e.target.checked; saveCfg(); stage.setInvert(cfg.invX, cfg.invY); });
$('sInset').addEventListener('change', (e) => { cfg.inset = e.target.checked; saveCfg(); applyInset(); });
$('sHero').addEventListener('change', (e) => { cfg.hero = e.target.value; saveCfg(); setHero(cfg.hero); stage.applyLook(); });
$('sRes').addEventListener('change', (e) => { cfg.res = e.target.value; saveCfg(); setRes(cfg.res); stage.applyLook(); });
$('sClose').addEventListener('click', closeSettings);
$('tSettings').addEventListener('click', () => { se.click(); openSettings('title'); });
$('mSettings').addEventListener('click', () => { se.click(); openSettings('game'); });
function nextBgm() {
  const i = BGM_LIST.findIndex((b) => b.id === bgmId());
  const nx = BGM_LIST[(i + 1) % BGM_LIST.length];
  cfg.bgm = nx.id; saveCfg();
  setBgm(nx.id); startBgm();
  flashPrompt('♪ ' + nx.name);
}

// ---- 右下の小窓: いま立っているページ（動かない。V で出す・しまう） ----
const insetG = $('inset').getContext('2d');
function applyInset() { $('insetBox').hidden = !cfg.inset; }
let insetKey = '';
function drawInset(focus, cand, ok) {
  if (!cfg.inset) return;
  // 持っているあいだは、ゴーストがかかるページのうち、いちばん近い秒を見せる
  if (cand && Number.isFinite(cand.y0)) { const dz = pieceDims(cand).dz; focus = Math.max(0, Math.min(L.T, Math.max(Math.ceil(cand.t0), Math.min(Math.floor(cand.t0 + dz - 0.01), focus)))); }
  const h = st.hero;
  const k = `${cand ? [cand.x0, cand.t0, cand.rot, ok].join(',') : ''}:${focus}:${st.pieces.length}:${h.x.toFixed(1)}:${h.y.toFixed(1)}:${h.t.toFixed(2)}:${st.hist === st.base}:${stage.waving()}`;
  if (k === insetKey) return;
  insetKey = k;
  const fr = st.hist.frames[Math.round(focus / 0.1)];
  drawSheet(insetG, L, focus, fr, sectionsAt(blockPieces(), focus), { paper: true, label: focus + TX('秒', 's'), goalT: st.hist.end.type === 'goal' ? st.hist.end.t : null, misprintAfter: misprintOf(st.hist) });
  // 持っている形を置いたら、このページに出る断面（点線）
  if (cand && Number.isFinite(cand.y0) && cand.x0 + pieceDims(cand).wx > 0) {
    const S = insetG.canvas.width / L.W;
    insetG.save(); insetG.setLineDash([5, 4]); insetG.lineWidth = 2;
    insetG.strokeStyle = ok ? 'rgba(60,40,20,.85)' : 'rgba(200,50,40,.9)'; insetG.fillStyle = ok ? 'rgba(255,250,235,.45)' : 'rgba(220,80,60,.18)';
    for (const r of sectionRects(cand, focus + 0.001)) { insetG.fillRect(r.x0 * S, (L.H - r.y1) * S, (r.x1 - r.x0) * S, (r.y1 - r.y0) * S); insetG.strokeRect(r.x0 * S, (L.H - r.y1) * S, (r.x1 - r.x0) * S, (r.y1 - r.y0) * S); }
    insetG.restore();
  }
  $('insetCap').textContent = TX(focus + '秒目のページ', `Page at ${focus}s`);
}
applyInset();
applyMove();

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
  const pad = TX(30, 46), X = (t) => pad + (t / L.T) * (w - pad * 2);
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
  tg.textAlign = 'left'; tg.fillText(TX('昔', 'Past'), 4, 28); tg.textAlign = 'right'; tg.fillText(TX('未来', 'Future'), w - 2, 28);
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
  if (st.solved) return TX('正史ができた。もう一度見るなら「結果を見る」', 'A true history! Press “See result” to watch it again');
  if (st.lv === 0 && !st.boundOnce && !st.carry && blockPieces().length && st.hintIdx >= (L.hints || []).length) return tx(TX('これで巣に着くと思ったら、「回答する」で答えよう', 'If you think the kiwi will reach the nest now, press “Answer”'));
  const hs = L.hints || [];
  const c = { walked: st.walked, seenEnd: st.revealT >= st.base.end.t, placed: blockPieces().length > 0, rotated: !!st.rotatedOnce };
  while (st.hintIdx < hs.length && hs[st.hintIdx].when(c)) st.hintIdx++;
  if (st.hintIdx < hs.length) return hs[st.hintIdx].text === '__windowHint__' ? look().windowHint : tx(hs[st.hintIdx].text);
  if (st.failedOnce && L.fail) return tx(L.fail);
  return '';
}
let coachShown = null;
// スマホでは、キーの名前をボタンの名前に言いかえる
function touchText(t) {
  if (!isTouch || !t) return t;
  if (LANG === 'en') return t.replace(tapWalk() ? 'Press W to go forward. ' : 'Press W to go forward', tapWalk() ? 'Tap where you want to go. ' : 'Push the stick up to go forward').replace('then click where you want it', 'then tap where you want it (tap the outline again to place)')
    .replace('click the placed board', 'tap the placed board').replace(' (Enter)', '');
  return t.replace(tapWalk() ? 'W で前へ。' : 'W で前へ', tapWalk() ? '行きたい所をタップすると歩く。' : 'スティックを上へ倒して前へ').replace('置きたい所をクリックしよう', '置きたい所をタップ。点線の形をもう一度タップで置く')
    .replace('置いた板をクリック', '置いた板をタップ').replace(/Q で/g, '「回す」で').replace('（Enter）', '').replace(/Enter で/g, '');
}
function renderCoach() {
  const t = touchText(coachText());
  if (t === coachShown) return;
  coachShown = t;
  const el = $('coach');
  el.classList.add('off');
  setTimeout(() => { el.textContent = coachShown; el.classList.toggle('off', !coachShown); }, 220);
}

// マウスが指している、置いた形
const hovered = () => (st.hoverPiece !== null && !st.carry ? st.pieces.find((p) => p.id === st.hoverPiece) || null : null);
// そのとき使えるキー
function renderPrompt(why) {
  let html = '';
  if (performance.now() < flashUntil) html = flashMsg;
  else if (st.carry) html = `<span>${TX('クリックした所に置く', 'Click to place')}</span><button type="button" class="pbtn" data-act="rot">${TX('回す', 'Rotate')}</button><button type="button" class="pbtn" data-act="cancel">${TX('やめる', 'Cancel')}</button>` + (why ? `<span class="bad">${why}</span>` : '');
  else if (hovered()) html = TX(`クリックで${kindName(hovered().kind)}を持ち上げる`, `Click to pick up the ${kindName(hovered().kind)}`);
  if (isTouch) html = performance.now() < flashUntil ? flashMsg : (st.carry && why ? `<span class="bad">${why}</span>` : '');
  const el = $('prompt');
  if (el.innerHTML !== html) el.innerHTML = html;
}

// 住人（2D世界）の音を、再生の時刻 o.lastT → t のあいだに起きたことだけ鳴らす
function replaySounds(h, o, t) {
  const t0 = o.lastT || 0;
  if (t <= t0) { o.lastT = t; return; }
  const res = cfgRes();
  for (const e of h.events) {
    if (e.t <= t0 || e.t > t) continue;
    if (e.type === 'turn') se.kiwiTurn(res);
    else if (e.type === 'goal') se.kiwiHome();
    else if (e.type === 'abyss' || e.type === 'fall') se.kiwiFall();
    else if (e.type === 'plug' || e.type === 'stoneStop') se.land();
  }
  // 足音: 歩いた横の距離 0.6 マスごと（速く流しても 1秒に8つまで）
  const a = frameAt(h.frames, t0), b = frameAt(h.frames, t);
  if (a.st === 'walk' && b.st === 'walk') {
    o.walk = (o.walk || 0) + Math.abs(b.x - a.x);
    const now = performance.now();
    if (o.walk > 0.6 && now - (o.lastStep || 0) > 120) { o.walk = 0; o.lastStep = now; se.kiwiStep(res); }
  }
  o.lastT = t;
}
const cfgRes = () => cfg.res;

// ---- 回答する: 再生して見届けてから、正史かどうかを出す ----
const hasNext = () => st.lv + 1 < LEVELS.length;
function goNext() {
  se.click();
  if (allSolved() && !progress._ending) { openEnding(); return; }
  if (hasNext()) startGame(st.lv + 1); else renderSelect('game');
}
const rp = { t: 0, playing: true, speed: 4, judged: true, endT: 0, gA: $('rpA').getContext('2d'), gB: $('rpB').getContext('2d') };
// 正史のあと: さっきの結果画面をもう一度（判定はしなおさない）
function reopenResult() {
  se.click(); closeAll();
  $('replay').hidden = false;
  rp.t = 0; rp.playing = true; rp.lastT = 0; rp.walk = 0; $('rpPlay').textContent = '❚❚';
  lockEnter(500); keys.clear();
}
function bind() {
  if (bindingNow) return;
  st.dirty = false;
  if (stage.waving()) stage.skipWave();
  st.boundOnce = true;
  se.click();
  closeAll();
  showBindReplay();
}
let bindingNow = false;
function showBindReplay() {
  $('rpTitle').textContent = TX('この歴史で回答する', 'Answering with this history');
  $('rpResult').hidden = true;
  $('rpWhy').hidden = true;
  document.querySelector('.replay-card').classList.remove('with-why');
  $('rpNext').hidden = true;
  $('rpClose').hidden = true;
  $('replay').hidden = false;
  rp.judged = false;
  rp.endT = Math.min(L.T, st.hist.end.t + 1.2);
  rp.t = 0; rp.playing = true; $('rpPlay').textContent = '❚❚';
  rp.pend = 0; rp.lastT = 0; rp.walk = 0;
  duckBgm(true);
  keys.clear();
}
function judge() {
  rp.judged = true;
  lockEnter(700);
  se.stamp();
  setTimeout(() => duckBgm(false), 1800);
  const e = st.hist.end, ok = e.type === 'goal';
  const el = $('rpResult');
  el.className = 'rp-result ' + (ok ? 'ok' : 'ng');
  if (ok) {
    st.solved = true;
    const n = blockPieces().length;
    const prev = progress[L.id];
    progress[L.id] = { best: prev ? Math.min(prev.best, n) : n };
    saveProgress();
    el.innerHTML = `<span class="stamp">${TX('正史', 'True history')}</span><p>` + tx(TX('キーウィは巣に着いた。この歴史が正史になった。', 'The kiwi reached the nest. This history is now the true history.')) + '</p>';
    $('rpTitle').textContent = TX('正史ができた', 'A true history!');
    setTimeout(() => se.goal(), 120);
  } else {
    const np = st.hist.nestPass;
    // 巣を通りすぎたなら、そのことをいちばんに伝える（時刻の窓のヒント）
    const why = np ? (np.early ? look().earlyMsg : look().lateMsg)
      : e.type === 'abyss' ? TX('崖に落ちてしまった', 'fell into the chasm') : e.type === 'fall' ? TX('高い所から落ちてしまった', 'fell from a high place') : TX('巣に着かなかった', 'did not reach the nest');
    el.innerHTML = `<span class="stamp">${TX('まだ', 'Not yet')}</span><p>` + (np ? tx(TX('キーウィは', 'The kiwi ')) + why : tx(TX('キーウィは', 'The kiwi ') + why)) + TX('。考えなおそう。', '. Think again.') + '</p>';
    $('rpTitle').textContent = TX('まだ正史ではない', 'Not the true history yet');
    st.failedOnce = true;
    showWhy(e, np);
    setTimeout(() => se.notyet(), 120);
  }
  if (ok) { $('rpWhy').hidden = true; document.querySelector('.replay-card').classList.remove('with-why'); }
  el.hidden = false;
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  $('rpNext').hidden = !ok;
  $('rpNext').textContent = ok && allSolved() && !progress._ending ? TX('おわりの図版へ', 'To the last plate') : hasNext() ? TX('次の図版へ', 'Next plate') : TX('図版をえらぶ', 'Choose a plate');
  // 正史のあとは「次へ」だけ（もどりたいときは、パネルの外をタッチ）。まだのときは「考えなおす」
  $('rpClose').hidden = ok;
  $('rpClose').textContent = TX('考えなおす', 'Think again');
}
// 「まだ」のわけを2枚の絵で: 住人がつまずいたページと、いちばん近い形の、出ていた（いなかった）ページ
function showWhy(e, np) {
  const inb = blockPieces();
  const tFail = np ? np.t : Math.max(0, Math.min(L.T, e.t - 0.3));
  const draw = (g, t) => drawSheet(g, L, t, frameAt(st.hist.frames, t), sectionsAt(inb, t), { paper: true, label: '' });
  draw($('rpWhyA').getContext('2d'), tFail);
  $('rpWhyCapA').textContent = np ? tx(np.early ? TX('キーウィが巣に着いたとき（卵はまだ）', 'When the kiwi reached the nest (too early)') : TX('キーウィが巣に着いたとき（卵はもう）', 'When the kiwi reached the nest (too late)')) : tx(TX('キーウィがつまずいたとき', 'When the kiwi stumbled'));
  // つまずいた場所にかかる形のうち、時刻がいちばん近いもの
  let best = null, bd = Infinity;
  for (const p of inb) {
    const d = pieceDims(p);
    if (!np && (e.x < p.x0 - 1 || e.x > p.x0 + d.wx + 1)) continue;
    const a = p.t0, b = p.t0 + d.dz;
    const dist = tFail < a ? a - tFail : tFail > b ? tFail - b : 0;
    if (dist < bd) { bd = dist; best = { p, t: tFail < a ? a : tFail > b ? b - 0.05 : tFail, when: tFail < a ? 'before' : tFail > b ? 'after' : 'on' }; }
  }
  const box = $('rpWhy').children[1];
  if (best && best.when !== 'on') {
    draw($('rpWhyB').getContext('2d'), best.t);
    $('rpWhyCapB').textContent = TX(`${kindName(best.p.kind)}が出ていたのは、このころ（そのときは${best.when === 'before' ? 'まだ出ていなかった' : 'もう消えていた'}）`, `The ${kindName(best.p.kind)} was here around this time (at that moment it ${best.when === 'before' ? 'had not appeared yet' : 'was already gone'})`);
    box.hidden = false;
  } else box.hidden = true;
  $('rpWhy').hidden = false;
  document.querySelector('.replay-card').classList.add('with-why');
}

// 回答の再生の最中に Esc → 最後まで早送りして結果を出す
function closeReplay() { if (!rp.judged) { rp.t = rp.endT; return; } $('replay').hidden = true; stage.openBook(); duckBgm(false); }
function togglePlay() { if (rp.t >= L.T) rp.t = 0; rp.playing = !rp.playing; $('rpPlay').textContent = rp.playing ? '❚❚' : '▶'; }
$('rpNext').addEventListener('click', goNext);
$('btnBind').addEventListener('click', () => { if (playing()) { if (st.solved) reopenResult(); else bind(); } });
$('rpClose').addEventListener('click', closeReplay);
$('rpPlay').addEventListener('click', togglePlay);
$('rpSeek').addEventListener('input', (e) => { rp.t = +e.target.value; });
// パネルの外をタッチしても閉じる（判が出たあと）
$('replay').addEventListener('click', (e) => { if (e.target === $('replay') && rp.judged) closeReplay(); });
function drawReplay() {
  // 判定画面には秒数を出さない（ユーザー）
  const t = rp.t, lab = '';
  drawSheet(rp.gA, L, t, frameAt(st.base.frames, t), [], { paper: true, label: lab, misprintAfter: misprintOf(st.base) });
  drawSheet(rp.gB, L, t, frameAt(st.hist.frames, t), sectionsAt(blockPieces(), t), { paper: true, label: lab, goalT: st.hist.end.type === 'goal' ? st.hist.end.t : null, misprintAfter: misprintOf(st.hist) });
  $('rpSeek').value = t;
}

// ---- 毎フレーム ----
let onPieceId = 0, last = performance.now(), lastFocus = 0, stepAcc = 0, landed = false, idleT = 0;
const flip = { t: null };
// 主人公の姿ごとの足音
const STEP_KIND = { poly: 'chime', star: 'chime', hourglass: 'wood', crane: 'paper', balloon: 'paper' };
// 置いた形の上を歩く音（形の材質ごと）
const PIECE_STEP = { beam: 'board', plank: 'board', short: 'board', lift: 'brass', wall: 'stone', slide: 'glass', diamond: 'glass' };
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!$('preview').hidden) drawPreview(dt);
  if (ed.on) drawEnding(dt);
  if (!$('replay').hidden) {
    if (rp.playing) { rp.t = Math.min(L.T, rp.t + dt * rp.speed); if (rp.t >= L.T) { rp.playing = false; $('rpPlay').textContent = '▶'; } }
    // 住人の音（再生の時刻が進んだ分だけ）
    replaySounds(st.hist, rp, rp.t);
    // 最後まで来たら、一瞬だまってから判
    if (!rp.judged && rp.t >= rp.endT) { if (!rp.pend) rp.pend = now; else if (now - rp.pend > 380) judge(); }
    drawReplay();
  }
  // カメラ基準の移動（W＝画面の奥）
  let mx = 0, mt = 0;
  const act = playing();
  if (act) {
    let f = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
    let r = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    if (joy.id !== null) { f = -joy.y; r = joy.x; } // スティック（倒した分だけ）
    const yaw = stage.camYaw();
    // 画面の奥＝(x,t) で (-sin yaw, cos yaw)、画面の右＝(cos yaw, sin yaw)
    mx = r * Math.cos(yaw) - f * Math.sin(yaw);
    mt = r * Math.sin(yaw) + f * Math.cos(yaw);
    if (f || r) walk.to = null; // キーやスティックで動いたら、タップの行き先はやめる
  }
  let walkRun = false;
  if (act && walk.to) { const s = walkStep(dt); if (s) { [mx, mt, walkRun] = s; } }
  if (!act && walk.to && screen !== 'game') walk.to = null;
  const h = st.hero;
  const before = h.t, bx = h.x;
  const running = act && (walk.to ? walkRun : joy.id !== null ? Math.hypot(joy.x, joy.y) > 0.8 : cfg.runDefault ? !keys.has('Shift') : keys.has('Shift'));
  if (stepHero(h, L, st.pieces, mx, mt, act && jumpQueued, act ? dt : 0, running) === 'respawn') flashPrompt(TX('底なしに落ちた。さっきの場所へもどる', 'You fell into the abyss. Back to where you were'));
  jumpQueued = false;
  st.walked += Math.abs(h.t - before);
  // 主人公の足音（地面を本当に歩いた距離ごと。壁に押しつけているだけなら鳴らない）と着地
  if (act && h.grounded) {
    stepAcc += Math.hypot(h.x - bx, h.t - before);
    // 置いた形の上なら、その形の音。形に乗った・形から下りたときも、すぐ1歩鳴らす
    const on = pieceUnder(st.pieces, h.x, h.t, h.y);
    const kindNow = on ? PIECE_STEP[on.kind] || 'board' : STEP_KIND[cfg.hero] || 'wood';
    if ((on ? on.id : 0) !== onPieceId) { onPieceId = on ? on.id : 0; if (on) { stepAcc = 0; se.step(kindNow); } }
    if (stepAcc > (running ? 1.3 : 1.0)) { stepAcc = 0; se.step(kindNow); }
  }
  if (h.landT > 0.2 && !landed) { landed = true; se.land(); }
  if (!h.landT) landed = false;
  st.revealT = Math.max(st.revealT, Math.min(L.T, h.t + 3));
  const focus = Math.max(0, Math.min(L.T, Math.round(h.t)));
  if (focus !== lastFocus && act) { se.page(); lastFocus = focus; }

  // 立ち止まって1秒たつと、まわりのページ（−3〜＋3秒）を順にめくって見せる。音は鳴らさない（v034: 裏で住人の足音・落ちる音が鳴って、バグに聞こえた）
  if (act && Math.hypot(mx, mt) < 0.05 && !st.carry) idleT += dt; else { idleT = 0; flip.t = null; }
  if (idleT > 1) {
    if (flip.t === null) { flip.t = Math.max(0, focus - 3); }
    flip.t += dt * 4;
    if (flip.t > Math.min(L.T, focus + 3)) flip.t = Math.max(0, focus - 3);
  }
  const cand = act ? candidate() : null;
  const why = cand ? canPlace(L, cand, st.pieces) : '';
  stage.update(dt, {
    hero: h, walking: Math.hypot(mx, mt) > 0.05, moveX: mx, moveT: mt,
    cand, candOk: !why, revealT: st.revealT, focus, sockets: [],
    running: running && Math.hypot(mx, mt) > 0.05, showRoute: false, grab: act ? hovered() : null,
    groundY: groundAt(L, st.pieces, h.x, h.t, h.y), walkTo: walk.to, heroSlice: false, flip: flip.t === null ? null : Math.round(flip.t),
  });

  if (screen === 'game') {
    drawTimeline();
    renderCoach();
    renderPrompt(why);
    drawInset(focus, cand, !why);
    updatePalette();
    stage.setCursor(st.carry ? 'crosshair' : act && hovered() ? 'pointer' : '');
    if (isTouch) {
      $('tGrab').textContent = st.carry ? TX('置く', 'Place') : TX('つかむ', 'Grab');
      $('tGrab').classList.toggle('dim', !st.carry && !grabbable());
      $('tRot').hidden = !st.carry;
      $('tCancel').hidden = !st.carry;
    }
    const bindHtml = st.solved ? TX('結果を<br>見る', 'See<br>result') : TX('回答<br>する', 'Answer');
    if ($('btnBind').innerHTML !== bindHtml) $('btnBind').innerHTML = bindHtml;
    // 形を置いて歴史が変わったのに、まだ回答していないあいだは、ボタンが脈打つ
    $('btnBind').classList.toggle('ready', !st.solved && st.dirty && blockPieces().length > 0);
    // 正史かどうかは、遊ぶ人が「回答する」（Enter）まで判定しない
  }
  requestAnimationFrame(loop);
}

function onResize() { stage.resize(); }
window.addEventListener('resize', onResize);
onResize();
stage.applyLook();
loadLevel(firstUnsolved());
showScreen('title');
// サムネイル（tools/make-thumbs.ps1 が ?thumb で撮る）: 図版 I に板をかけ、キーウィがページをまたいで崖をわたる場面。画面の飾りはしまう（ネタバレなし）
if (new URLSearchParams(location.search).has('thumb')) {
  document.body.classList.add('thumb');
  cfg.inset = false; applyInset();
  loadLevel(0); showScreen('game');
  st.carry = { kind: 'plank', rot: 0 }; lockTo({ kind: 'plank', rot: 0, x0: 9, t0: 3 }); useE();
  stage.setHistory(st.hist, st.pieces, null, false); stage.skipWave();
  Object.assign(st.hero, { x: 7.2, t: 0.6, y: 4, fx: 0.5, ft: 1 });
  st.revealT = L.T;
}
requestAnimationFrame(loop);
// 確認用
window.__fh = { se, walkTo, get walk() { return walk; }, st, LEVELS, simulate, keys, startGame, useE, rotate, candidate, choose, cancelCarry, pickUp, tapAt, lockTo, socketsAround, bind, judge, rp, stage, showBindReplay, ed, openEnding, get L() { return L; } };
