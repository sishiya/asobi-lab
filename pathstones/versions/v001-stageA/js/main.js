// みちいし 段階Aの試作（v001、ver. 0.1）。決まりは rules.js（総当たりの道具と同じ）、絵は view.js。
// 操作と見せ方は PLAN.md 3章・COLORS.md・TEAM の UX の決めごと。
import { loadLevel, legalActions, step, placeCells, stateKey, DIRS, VOID } from './rules.js?v=1';
import { drawBoard, boardSize, cellAt, drawHeld, S } from './view.js?v=1';

const ROOMS = ['r1', 'r2', 'r3a', 'r3', 'r4'];
const MOVE_T = 0.18, WAIT_T = 0.15;
const $ = id => document.getElementById(id);
const board = $('board'), ctx = board.getContext('2d');
const heldCv = $('heldCv'), hctx = heldCv.getContext('2d');

let roomIdx = 0, level = null, hist = [], cur = null, moves = 0, movesHist = []; // moves: いまの挑戦の手数（やり直しで0に）
let mode = 'move', place = null, pendingKey = null;
let anim = null, fx = null, afterglow = null, lit = null, bright = false, busy = false;
let scale = 1, dpr = 1, guideKeys = null;
const GUIDE_ROOMS = ['r1']; // 字なしで「いまやる1つ」を脈打たせる部屋（UX）
const levels = {};

const q = new URLSearchParams(location.search);

async function getLevel(name) {
  if (!levels[name]) levels[name] = await (await fetch(`levels/${name}.json?v=1`)).json();
  return levels[name];
}
async function startRoom(i, keepHist = false) {
  roomIdx = i; level = await getLevel(ROOMS[i]);
  cur = loadLevel(level);
  if (!keepHist) { hist = []; movesHist = []; }
  moves = 0;
  guideKeys = null;
  if (GUIDE_ROOMS.includes(ROOMS[i]) && level.intended) { let g = cur; guideKeys = [stateKey(g)]; for (const a of level.intended) { g = step(g, a); guideKeys.push(stateKey(g)); } }
  mode = 'move'; place = null; afterglow = null; lit = null; fx = null; anim = null;
  $('room').textContent = `部屋 ${i + 1}`;
  layout(); syncUI();
}

// ---- 大きさ: たて持ちで盤全体が入るように、1マス 40〜44px を目安に合わせる ----
function layout() {
  if (!cur) return;
  const st = $('stage').getBoundingClientRect();
  const bs = boardSize(cur);
  const land = matchMedia('(orientation: landscape) and (max-height: 520px)').matches;
  scale = Math.min(document.body.classList.contains('thumb') ? 9 : 44 / S, (st.width - 16) / bs.w, (st.height - (land ? 12 : 32)) / bs.h); // 上下に余白（横持ちは帯を左右へ寄せて高さを空ける）
  dpr = Math.min(3, window.devicePixelRatio || 1);
  board.style.width = `${Math.floor(bs.w * scale)}px`; board.style.height = `${Math.floor(bs.h * scale)}px`;
  board.width = Math.floor(bs.w * scale * dpr); board.height = Math.floor(bs.h * scale * dpr);
}
addEventListener('resize', layout);

// ---- 手 ----
const adjDir = cell => {
  const dx = cell[0] - cur.player[0], dy = cell[1] - cur.player[1];
  for (const k in DIRS) if (DIRS[k][0] === dx && DIRS[k][1] === dy) return k;
  return null;
};
const onMark = s => s.cents.some(c => c.alive && c.mark && c.mark[0] === s.player[0] && c.mark[1] === s.player[1]);

function act(a) {
  if (busy) return false;
  if (!legalActions(cur).includes(a)) { shake(); return false; }
  const next = step(cur, a);
  if (next.lost) { fireOut(next, a); return true; }
  hist.push(cur); movesHist.push(moves); moves++;
  anim = { prev: cur, start: performance.now(), dur: (a === 'w' ? WAIT_T : MOVE_T) * 1000 };
  cur = next; afterglow = afterglow && afterglow.ttl > 0 ? { ...afterglow, ttl: afterglow.ttl - 1 } : null;
  mode = 'move'; place = null; pendingKey = null;
  if (cur.won) win();
  syncUI();
  return true;
}

// 火が消える: 原因（印と自分のマス）を見せ、火が消え、ともり直して1手前へ（自動）
function fireOut(next, a) {
  busy = true;
  const cause = cur.cents.find(c => c.alive && c.mark && next.player && c.mark[0] === next.player[0] && c.mark[1] === next.player[1]);
  const base = a[0] === 'm' ? { ...cur, player: next.player } : cur;
  // 頭石がそのマスへすべりこむ（最初の0.5秒）
  const showState = { ...base, cents: base.cents.map(c => c === cause ? { ...c, body: [c.mark, ...c.body.slice(0, -1)], dir: c.dir } : c) };
  fx = { start: performance.now(), prev: base, state: showState, mark: cause ? cause.mark : next.player };
  setTimeout(() => {
    fx = null; busy = false;
    afterglow = { cell: (cause ? cause.mark : next.player).slice(), ttl: 1 };
    mode = 'move'; place = null; syncUI();
  }, 1100);
}

function win() {
  busy = true; lit = performance.now();
  toast('灯台がともった');
  setTimeout(() => {
    busy = false;
    if (roomIdx + 1 < ROOMS.length) startRoom(roomIdx + 1);
    else { toast('試作はここまで（ありがとう）'); mode = 'done'; }
  }, 1400);
}

function undo() {
  if (busy || !hist.length) { shake($('undoBtn')); return; }
  cur = hist.pop(); moves = movesHist.pop() ?? 0; anim = null; mode = 'move'; place = null; afterglow = null; lit = null; syncUI();
}
function restart() { // やり直しも「もどす」でもどせる（UX）
  if (busy) return;
  hist.push(cur); movesHist.push(moves); moves = 0; cur = loadLevel(level); mode = 'move'; place = null; afterglow = null; syncUI();
}

// ---- 置く ----
function placeInfo(d, end) {
  const anchor = [cur.player[0] + DIRS[d][0], cur.player[1] + DIRS[d][1]];
  const cells = placeCells(cur.held, anchor, end);
  const ok = legalActions(cur).includes('p' + d + end);
  let kind = null, bad = [];
  if (ok) kind = cells.every(p => cur.floor[p[1] * cur.w + p[0]] === VOID) ? 'bridge' : 'wall';
  else bad = cells.filter(p => p[0] < 0 || p[1] < 0 || p[0] >= cur.w || p[1] >= cur.h || cur.rows.some(r => r.some(c => c[0] === p[0] && c[1] === p[1])) || cur.cents.some(c => c.alive && c.body.some(b => b[0] === p[0] && b[1] === p[1])));
  return { d, end, cells, kind, bad };
}
function aimPlace(d) {
  if (place && place.d === d) place = placeInfo(d, 1 - place.end); // 同じマスをもう一度 → 反対の端
  else {
    const a = placeInfo(d, 0), b = placeInfo(d, 1);
    place = a.kind || !b.kind ? a : b;
  }
  syncUI();
}
function confirmPlace() {
  if (!place) return;
  if (!place.kind) { shake($('placeBtn')); return; }
  act('p' + place.d + place.end);
}
function enterPlace() {
  if (!cur.held) { shake($('placeBtn')); return; }
  mode = 'place'; place = null;
  // となりで置ける所があれば、はじめの影をそこに出す
  for (const d of ['N', 'E', 'S', 'W']) for (const e of [0, 1]) if (!place && legalActions(cur).includes('p' + d + e)) place = placeInfo(d, e);
  syncUI();
}

// ---- 入力: タップ ----
board.addEventListener('pointerdown', e => {
  if (busy || mode === 'done') return;
  const r = board.getBoundingClientRect();
  const cell = cellAt(cur, (e.clientX - r.left) / scale, (e.clientY - r.top) / scale);
  const d = cell && adjDir(cell);
  if (mode === 'cut') { if (d && legalActions(cur).includes('c' + d)) act('c' + d); else { shake(); mode = 'move'; syncUI(); } return; }
  if (mode === 'place') { if (d) aimPlace(d); else { mode = 'move'; place = null; syncUI(); } return; } // となり以外 → やめる
  if (d) act('m' + d); else shake();
});
$('cutBtn').onclick = () => { if (busy) return; mode = mode === 'cut' ? 'move' : 'cut'; place = null; if (mode === 'cut' && !cutTargets().length) { shake($('cutBtn')); mode = 'move'; } syncUI(); };
$('placeBtn').onclick = () => { if (busy) return; if (mode === 'place') confirmPlace(); else enterPlace(); };
$('heldBtn').onclick = () => { if (busy) return; if (mode === 'place') { mode = 'move'; place = null; syncUI(); } else enterPlace(); };
holdRepeat($('undoBtn'), undo);
holdRepeat($('waitBtn'), () => { if (onMark(cur)) { shake($('waitBtn')); return false; } return act('w'); }); // 長押しで続けて待つ。危ない手で止まる
$('menuBtn').onclick = () => { $('menu').hidden = false; };
$('closeMenu').onclick = () => { $('menu').hidden = true; };
$('brightChk').onchange = e => { bright = e.target.checked; };
ROOMS.forEach((r, i) => { const b = document.createElement('button'); b.textContent = `部屋 ${i + 1}`; b.onclick = () => { $('menu').hidden = true; startRoom(i); }; $('roomList').append(b); });

function holdRepeat(btn, fn) {
  let t1 = null, t2 = null;
  const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); fn(); t1 = setTimeout(() => { t2 = setInterval(() => { if (fn() === false) stop(); }, 170); }, 420); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
}

// ---- 入力: キー（WASD・矢印はいつも上が北） ----
const KEYDIR = { ArrowUp: 'N', KeyW: 'N', ArrowRight: 'E', KeyD: 'E', ArrowDown: 'S', KeyS: 'S', ArrowLeft: 'W', KeyA: 'W' };
addEventListener('keydown', e => {
  if (!$('menu').hidden) { if (e.code === 'Escape') $('menu').hidden = true; return; }
  if (busy || mode === 'done') return;
  const d = KEYDIR[e.code];
  if (d) {
    e.preventDefault();
    if (pendingKey === 'x' || mode === 'cut') { pendingKey = null; mode = 'move'; act('c' + d); syncUI(); return; }
    if (pendingKey === 'e' || mode === 'place') { if (pendingKey === 'e' || !place || place.d !== d) place = null; pendingKey = null; mode = 'place'; aimPlace(d); return; } // キーの E＋方向は端を切りかえず、その向きでよい端を選ぶ（検証）
    act('m' + d); return;
  }
  switch (e.code) {
    case 'KeyX': pendingKey = 'x'; mode = 'cut'; place = null; syncUI(); break;
    case 'KeyE': if (cur.held) { pendingKey = 'e'; enterPlace(); } else shake($('placeBtn')); break;
    case 'Tab': e.preventDefault(); if (place) { place = placeInfo(place.d, 1 - place.end); syncUI(); } break;
    case 'Enter': confirmPlace(); break;
    case 'Space': e.preventDefault(); if (onMark(cur)) shake($('waitBtn')); else act('w'); break;
    case 'KeyZ': undo(); break;
    case 'KeyR': restart(); break;
    case 'Escape': mode = 'move'; place = null; pendingKey = null; syncUI(); break;
  }
});

// ---- 見せ方 ----
function cutTargets() { return ['N', 'E', 'S', 'W'].filter(d => legalActions(cur).includes('c' + d)).map(d => [cur.player[0] + DIRS[d][0], cur.player[1] + DIRS[d][1]]); }
function moveTargets() { return ['N', 'E', 'S', 'W'].filter(d => legalActions(cur).includes('m' + d)).map(d => [cur.player[0] + DIRS[d][0], cur.player[1] + DIRS[d][1]]); }
function syncUI() {
  $('moves').textContent = `${moves}手`;
  $('cutBtn').classList.toggle('on', mode === 'cut');
  $('placeBtn').classList.toggle('on', mode === 'place');
  $('heldBtn').classList.toggle('on', mode === 'place');
  $('placeGlyph').textContent = mode === 'place' ? '✓' : '▣';
  $('placeLbl').textContent = mode === 'place' ? '決める' : '置く';
  $('placeBtn').disabled = !cur.held;
  $('heldBtn').disabled = !cur.held;
  $('undoBtn').disabled = !hist.length;
  drawHeld(hctx, cur.held, heldCv.width, heldCv.height);
}
function shake(el = board) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
let toastT = null;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1600); }

function frame(ms) {
  requestAnimationFrame(frame);
  if (!cur) return;
  const now = ms / 1000;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.clearRect(0, 0, board.width, board.height);
  const o = { L: bright ? 1.45 : 1, now, calm: mode === 'place' };
  let s = cur;
  if (fx) { // 火が消える演出（0.5秒 原因を見せる → 0.4秒 消える → 0.2秒 ともり直す）
    const e = (ms - fx.start) / 1000;
    s = fx.state; o.danger = true; o.afterglow = fx.mark;
    if (e < 0.5) { o.prev = fx.prev; o.t = e / 0.5; }
    o.fireOut = e < 0.5 ? 0 : e < 0.9 ? (e - 0.5) / 0.4 : Math.max(0, 1 - (e - 0.9) / 0.2);
  } else {
    if (anim) { const t = (ms - anim.start) / anim.dur; if (t >= 1) anim = null; else { o.prev = anim.prev; o.t = t; } }
    o.danger = onMark(cur);
    if (afterglow) o.afterglow = afterglow.cell;
    if (!cur.won && !anim) {
      if (mode === 'move') o.hints = { move: moveTargets() };
      else if (mode === 'cut') o.hints = { cut: cutTargets() };
      else if (mode === 'place' && place) o.hints = { place };
      const p = step(cur, 'w'); if (!p.lost && !p.won) o.predict = p; // 2手先の予告（約束でない）
    }
  }
  if (lit) o.lit = Math.min(1, (ms - lit) / 900);
  // いまやる1つ（r1）: 意図した解の上にいるあいだ、次の手の場所かボタンを脈打たせる
  let gBtn = null;
  if (guideKeys && !fx && !anim && !cur.won) {
    const i = guideKeys.indexOf(stateKey(cur));
    const a = i >= 0 ? level.intended[i] : null;
    if (a) {
      const tgt = a[1] && a[1] !== '' ? [cur.player[0] + (DIRS[a[1]]?.[0] || 0), cur.player[1] + (DIRS[a[1]]?.[1] || 0)] : null;
      if (a[0] === 'm') o.guide = tgt;
      else if (a[0] === 'c') { if (mode === 'cut') o.guide = tgt; else gBtn = 'cutBtn'; }
      else if (a[0] === 'p') { if (mode === 'place') { if (place && place.d === a[1] && place.end === +a[2]) gBtn = 'placeBtn'; else o.guide = tgt; } else gBtn = 'placeBtn'; }
      else if (a === 'w') gBtn = 'waitBtn';
    }
  }
  for (const id of ['cutBtn', 'placeBtn', 'waitBtn']) $(id).classList.toggle('guide', id === gBtn);
  drawBoard(ctx, s, o);
}
requestAnimationFrame(frame);

// ---- 自動で解く（?autoplay=1）: 総当たりの道具の意図した解を、ゲームでも流して通す（決まりの食いちがいの確かめ） ----
async function autoplay() {
  const out = [];
  for (const name of ROOMS) {
    const lv = await getLevel(name);
    let s = loadLevel(lv), ok = true;
    for (const a of lv.intended || []) { if (!legalActions(s).includes(a)) { ok = false; break; } s = step(s, a); if (s.lost) { ok = false; break; } }
    out.push(`${name}: ${ok && s.won ? 'ok' : 'NG'}`);
  }
  console.log('[autoplay]', out.join(' / '));
  window.__autoplay = out;
  toast(out.join(' / '));
}

// ?thumb: 保管庫のサムネイル（tools/thumb.html が 640×360 で撮る）。帯を隠し、山場の部屋3のはじめを大きく
if (q.has('thumb')) document.body.classList.add('thumb');
const startAt = Math.max(0, ROOMS.indexOf(q.get('room') || (q.has('thumb') ? 'r3' : 'r1')));
startRoom(startAt).then(() => { if (q.get('autoplay')) autoplay(); });

// 確かめ用（検証・UX のブラウザでの確かめに使う。ゲームの動きには関係しない）
window.__ps = { get cur() { return cur; }, get place() { return place; }, get mode() { return mode; }, get room() { return ROOMS[roomIdx]; }, get busy() { return busy; } };
