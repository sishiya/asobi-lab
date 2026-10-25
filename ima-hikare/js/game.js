// いま光れ A-1: 30秒＋段0〜2。線をつなぐ・つまみ（管のふちの▼）を動かす・速さを変える。答え合わせはいつもブラウン管の光（柱①）。
import { T, PARTS, compile, makeState, peek, analyze } from './sim.js';
import { STAGES } from './stages.js';
import { makeCRT } from './crt.js';
import { layout, makeSubstrate, drawBoard } from './board.js';
import { routeAll, routeReport } from './route.js';

const $ = s => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const now = () => performance.now();

// 速さの5つの止まり（UX）。tps＝1秒に進むこま、tau＝残光（秒）
const ICON = {
  stop: '<rect x="4" y="4" width="10" height="10" rx="1.5"/>',
  line: '<circle cx="13" cy="9" r="2.4"/><path d="M2 9h7" stroke-dasharray="1.5 2"/>',
  slow: '<circle cx="5.5" cy="9" r="2.2"/><circle cx="12.5" cy="9" r="2.2"/>',
  fast: '<circle cx="3.5" cy="9" r="2"/><circle cx="9" cy="9" r="2"/><circle cx="14.5" cy="9" r="2"/>',
  real: '<rect x="3" y="3" width="12" height="12" rx="1.5"/><path d="M3 7h12M3 11h12"/>',
};
const SPEEDS = [
  { name: '止める', icon: 'stop', tps: 0, tau: Infinity },
  { name: '1行ずつ', icon: 'line', tps: T.W / 0.6, tau: 12 },
  { name: 'ゆっくり', icon: 'slow', tps: T.PER_FRAME / 4, tau: 3 },
  { name: '速い', icon: 'fast', tps: T.PER_FRAME * 4, tau: 0.6 },
  { name: '本当', icon: 'real', tps: T.HZ, tau: 0.15 },
];
const LOOK = { sig: 4, dim: 0.7, grime: 1, refl: 0.05, dot: 2 };

// ---- 状態 ----
const G = {
  si: 0, stage: null, board: null, step: null, S: null, glow: null, L: null, routes: null,
  speed: 1, vals: {}, dutyAt: 0, thread: 0, history: [],
  passNow: false, changeTick: 0, changeAt: 0, expect: 1, shown: false, passedAt: 0, failAt: 0, knobDrag: false, realAt: 0, otherDone: false, otherUntil: 0, zeroAll: false, zeroWarned: false, stageAt: 0,
  idleAt: now(), sel: null, drag: null, armed: null,
  log: { start: now(), firstWire: null, speedTouch: null, passes: [], stops: [], flips: 0 },
};
const tall = () => innerHeight > innerWidth;
const dpr = () => Math.min(2, devicePixelRatio || 1);
const clone = b => JSON.parse(JSON.stringify(b));

function loadStage(i) {
  G.si = i; G.stage = STAGES[i];
  G.board = clone(G.stage.board());
  G.S = makeState(G.board); G.S.v = T.VB;          // ビームは見える所の上から（消す時間で待たせない）
  G.glow = new Float32Array(T.VIS_W * T.VIS_H);
  G.history = []; G.passNow = false; G.shown = false; G.passedAt = 0; G.failAt = 0; G.sel = null; G.drag = null; G.armed = null; G.realAt = 0; G.otherDone = false; G.otherUntil = 0; G.zeroWarned = false; G.stageAt = now();
  setSpeed(G.stage.speed, true);
  rebuild(false);
  $('#stage').textContent = `段${G.stage.id}`;
  $('#line').textContent = G.stage.line;
  $('#next').hidden = true; $('#answer').classList.remove('show'); cheer(null);
  G.idleAt = now();
  syncUndo(); buildRulers();
}

// 回路が変わったとき: 組み立て直し・道を引き直し・合格かを先に計算（見せるのはビームがそこを描いてから）
function rebuild(changed = true, light = false) {
  delete G.board._A;
  const c = compile(G.board);
  if (c.errors.length) return false;
  G.step = c.step;
  if (!light) { G.L = layout(G.board, tall() ? 'tall' : 'wide', G.stage.show); G.routes = routeAll(G.L, G.board.wires); }
  if (changed) {
    const s = makeState(G.board); c.step(s, T.PER_FRAME + 1);
    const j = G.stage.judge(s);
    G.passNow = j.pass;
    // 見せるのは、変えたあとにビームが光らせた所が、ねらいの光の半分（多くても400こま）にとどいてから
    G.changeTick = G.S.tick; G.changeAt = now(); G.expect = Math.min(400, Math.max(1, Math.round(j.all * 0.5)));
    G.zeroAll = j.all === 0; G.zeroWarned = false;
  }
  return true;
}

// ---- 線をつなぐ ----
function canIn(key) { const [b, p] = key.split('.'); const B = G.board.blocks.find(x => x.id === b); return B && PARTS[B.type].in.includes(p); }
function isBus(key) { const [b, p] = key.split('.'); const B = G.board.blocks.find(x => x.id === b); const P = PARTS[B.type]; return (P.bus || []).includes(p) || (P.busIn || []).includes(p); }
function compatible(a, b) {
  if (!a || !b || a === b) return false;
  const ai = canIn(a), bi = canIn(b);
  if (ai === bi) return false;
  if (a.split('.')[0] === b.split('.')[0]) return false;
  return isBus(a) === isBus(b);
}
function connect(a, b) {
  if (!compatible(a, b)) return false;
  const [from, to] = canIn(a) ? [b, a] : [a, b];
  const prevWires = clone(G.board.wires), prevParams = clone(G.board.blocks.map(x => x.params || null));
  G.board.wires = G.board.wires.filter(w => w.to !== to && !(w.from === from && w.to === to));
  G.board.wires.push({ from, to });
  if (analyze(G.board).errors.length) { G.board.wires = prevWires; toast('ぐるっと戻る線は、時計で動く部品を通るときだけ'); return false; }
  G.history.push({ wires: prevWires, params: prevParams });
  if (!G.log.firstWire) G.log.firstWire = now() - G.log.start;
  rebuild(); syncUndo(); buildRulers(); touched();
  if (G.speed >= 3 && !G.shown) setSpeed(2);          // 新しくつないだら、ゆっくりに戻す（UX）
  return true;
}
function cut(key) {
  const [from, to] = key.split('>');
  G.history.push({ wires: clone(G.board.wires), params: clone(G.board.blocks.map(x => x.params || null)) });
  G.board.wires = G.board.wires.filter(w => !(w.from === from && w.to === to));
  G.sel = null; rebuild(); syncUndo(); buildRulers(); touched();
}
function undo() {
  const h = G.history.pop(); if (!h) return;
  G.board.wires = h.wires; G.board.blocks.forEach((b, i) => { if (h.params[i]) b.params = h.params[i]; });
  G.sel = null; rebuild(); syncUndo(); buildRulers(); touched();
}
function syncUndo() { $('#undo').disabled = !G.history.length; }
function touched() { G.idleAt = now(); $('#answer').classList.remove('show'); }

// ---- 画面の部品 ----
const tube = $('#tube'), bc = $('#board'), over = $('#over');
const crt = makeCRT(tube, T.VIS_W, T.VIS_H);
const bg = bc.getContext('2d'), og = over.getContext('2d');
let substrate = null, subKey = '';
function fit() { for (const c of [tube, bc, over]) { const r = c.getBoundingClientRect(); c.width = Math.max(1, Math.round(r.width * dpr())); c.height = Math.max(1, Math.round(r.height * dpr())); } }
addEventListener('resize', () => { fit(); if (G.board) { rebuild(false); buildRulers(); } });
function boardXf() { const s = Math.min(bc.width / G.L.W, bc.height / G.L.H); return { s, x: (bc.width - G.L.W * s) / 2, y: (bc.height - G.L.H * s) / 2 }; }
// 画面の点（CSS px）⇄ 基板の論理の座標
function toBoard(cx, cy) { const r = bc.getBoundingClientRect(), X = boardXf(); return [((cx - r.left) * dpr() - X.x) / X.s, ((cy - r.top) * dpr() - X.y) / X.s]; }
function toClient(x, y) { const r = bc.getBoundingClientRect(), X = boardXf(); return [r.left + (X.x + x * X.s) / dpr(), r.top + (X.y + y * X.s) / dpr()]; }
const cssPerUnit = () => boardXf().s / dpr();

function padAt(cx, cy, rCss, filter) {
  let best = null, bd = rCss;
  for (const [key, q] of G.L.pads) {
    if (filter && !filter(key)) continue;
    const [px, py] = toClient(q.x, q.y); const d = Math.hypot(px - cx, py - cy);
    if (d < bd) { bd = d; best = key; }
  }
  return best;
}
function wireAt(cx, cy) {
  const [x, y] = toBoard(cx, cy), tol = 9 / cssPerUnit();
  for (const w of G.board.wires) {
    const pts = G.routes.get(w.from + '>' + w.to); if (!pts) continue;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1)));
      if (Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))) < tol) return { key: w.from + '>' + w.to, at: [ax + t * (bx - ax), ay + t * (by - ay)] };
    }
  }
  return null;
}

// ---- 指・マウス ----
bc.addEventListener('pointerdown', e => {
  bc.setPointerCapture(e.pointerId);
  const pad = padAt(e.clientX, e.clientY, 22);
  if (pad) { G.drag = { from: pad, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, touch: e.pointerType === 'touch', snap: null }; G.sel = null; hideCut(); touched(); return; }
  const w = wireAt(e.clientX, e.clientY);
  if (w) { G.sel = w.key; showCut(w.at); touched(); return; }
  G.sel = null; hideCut();
  if (G.armed) { G.armed = null; }
});
bc.addEventListener('pointermove', e => {
  if (!G.drag) return;
  G.drag.x = e.clientX; G.drag.y = e.clientY;
  G.drag.snap = padAt(e.clientX, e.clientY, 24, k => compatible(G.drag.from, k));
  G.drag.over = G.drag.snap ? null : padAt(e.clientX, e.clientY, 24, k => k !== G.drag.from);
});
// つなげないときの返事
function whyNot(a, b) {
  if (canIn(a) === canIn(b)) return canIn(a) ? '入口どうしはつなげない' : '出口どうしはつなげない';
  if (isBus(a) !== isBus(b)) return '「数」の口は「くらべる」へ';
  return 'そこへはつなげない';
}
bc.addEventListener('pointerup', e => {
  const d = G.drag; G.drag = null; if (!d) return;
  const moved = Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8;
  if (moved) { if (d.snap) connect(d.from, d.snap); else if (d.over) toast(whyNot(d.from, d.over)); return; }
  // タップ2回でもつなげる
  if (G.armed && G.armed !== d.from && compatible(G.armed, d.from)) { connect(G.armed, d.from); G.armed = null; }
  else G.armed = G.armed === d.from ? null : d.from;
});
bc.addEventListener('pointercancel', () => { G.drag = null; });
$('#undo').onclick = () => { undo(); hideCut(); };
$('#cut').onclick = () => { if (G.sel) cut(G.sel); hideCut(); };
function showCut(at) { const [cx, cy] = toClient(at[0], at[1]), r = $('#boardbox').getBoundingClientRect(); const b = $('#cut'); b.style.left = (cx - r.left) + 'px'; b.style.top = (cy - r.top) + 'px'; b.classList.add('show'); }
function hideCut() { $('#cut').classList.remove('show'); }
$('#answer').onclick = () => { for (const h of G.stage.hints) connect(h.from, h.to); applyAnswerKnobs(); };
function applyAnswerKnobs() {
  const ans = G.stage.answer();
  G.history.push({ wires: clone(G.board.wires), params: clone(G.board.blocks.map(x => x.params || null)) }); syncUndo();
  for (const b of ans.blocks) if (b.type === 'cmp') { const mine = G.board.blocks.find(x => x.id === b.id); if (mine) mine.params = { ...b.params }; }
  rebuild(); buildRulers();
}

// ---- 速さ ----
function setSpeed(i, quiet) {
  if (i >= 3 && G.speed < 3) G.realAt = now();
  G.speed = i;
  document.querySelectorAll('#speed button').forEach((b, k) => b.classList.toggle('on', k === i));
  if (!quiet) { if (G.log.speedTouch == null) G.log.speedTouch = now() - G.log.start; touched(); }
}
SPEEDS.forEach((s, i) => {
  const b = document.createElement('button');
  b.innerHTML = `<svg viewBox="0 0 18 18" width="15" height="15" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${ICON[s.icon]}</svg><span>${s.name}</span>`;
  b.onclick = () => setSpeed(i);
  $('#speed').appendChild(b);
});

// ---- 管のふちのものさし（くらべる部品の数） ----
function cmpAxis(id) { const src = G.board.wires.find(w => w.to === id + '.in')?.from; return src === 'H.count' ? 'h' : src === 'V.count' ? 'v' : null; }
function buildRulers() {
  for (const [el, axis] of [[$('#rulerH'), 'h'], [$('#rulerV'), 'v']]) {
    el.innerHTML = '';
    const n = axis === 'h' ? 47 : 31;
    for (let i = 0; i <= n; i += 4) { const t = document.createElement('span'); t.className = 'tick'; t.style[axis === 'h' ? 'left' : 'top'] = (i / n * 100) + '%'; el.appendChild(t); }
    for (const b of G.board.blocks) if (b.type === 'cmp' && cmpAxis(b.id) === axis) {
      const k = document.createElement('div'); k.className = 'knob'; k.dataset.id = b.id; el.appendChild(k);
      placeKnob(k, b);
      k.addEventListener('pointerdown', e => { k.setPointerCapture(e.pointerId); k.dataset.drag = '1'; G.knobDrag = true; touched(); });
      k.addEventListener('pointermove', e => { if (k.dataset.drag) moveKnob(b, axis, e); });
      k.addEventListener('pointerup', () => { delete k.dataset.drag; G.knobUndo = null; G.knobDrag = false; G.changeAt = now() - 2000; });
    }
  }
}
function placeKnob(k, b) {
  const axis = cmpAxis(b.id), p = b.params;
  const center = (p.n + p.w / 2) * T.CELL;
  if (axis === 'h') { k.style.left = ((center - T.HB) / T.VIS_W * 100) + '%'; k.style.top = '50%'; }
  else { k.style.top = ((center - T.VB) / T.VIS_H * 100) + '%'; k.style.left = '50%'; }
}
function moveKnob(b, axis, e) {
  const r = tube.getBoundingClientRect();
  let n;
  if (axis === 'h') { const h = T.HB + (e.clientX - r.left) / r.width * T.VIS_W; n = Math.round(h / T.CELL - b.params.w / 2); n = Math.max(T.HB / T.CELL, Math.min(56 - b.params.w + 1, n)); }
  else { const v = T.VB + (e.clientY - r.top) / r.height * T.VIS_H; n = Math.round(v / T.CELL - b.params.w / 2); n = Math.max(T.VB / T.CELL, Math.min(32 - b.params.w + 1, n)); }
  if (n === b.params.n) return;
  if (!G.knobUndo || G.knobUndo !== e.pointerId) { G.history.push({ wires: clone(G.board.wires), params: clone(G.board.blocks.map(x => x.params || null)) }); G.knobUndo = e.pointerId; syncUndo(); }
  b.params = { ...b.params, n };
  rebuild(true, true); document.querySelectorAll('.knob').forEach(k => { const bb = G.board.blocks.find(x => x.id === k.dataset.id); if (bb) placeKnob(k, bb); });
}

// ---- 進める ----
function advance(n, dt) {
  const t0 = G.S.tick;
  if (n > 0) G.step(G.S, n);
  const tau = SPEEDS[G.speed].tau;
  const k = tau === Infinity ? 1 : Math.exp(-dt / tau);
  const st = G.S.stamp, gl = G.glow;
  for (let i = 0; i < gl.length; i++) gl[i] = st[i] >= t0 && n > 0 ? 1 : gl[i] * k;
}
function frameDuty() {
  const acc = {}; let n = 0;
  for (let v = 0; v < T.H; v += 11) for (let h = 0; h < T.W; h += 23) {
    const p = peek(G.board, G.S, { h, v }); n++;
    for (const k in p) if (p[k] <= 1) acc[k] = (acc[k] || 0) + p[k];
  }
  for (const k in acc) acc[k] /= n;
  return acc;
}

let prev = now();
function tick(t) {
  const dt = Math.min(0.1, (t - prev) / 1000); prev = t;
  advance(Math.round(SPEEDS[G.speed].tps * dt), dt);
  if (G.speed <= 2) G.vals = peek(G.board, G.S);
  else if (t - G.dutyAt > 150) { G.vals = frameDuty(); G.dutyAt = t; }
  G.thread = G.vals['scr.lit'] ? 1 : Math.max(0, G.thread - dt / 0.15);
  flow(t);
  render(t);
  requestAnimationFrame(tick);
}

// 段の流れ: 合格を見せる・速さを促す・助け
function flow(t) {
  const sp = G.speed;
  // 見せるのは、変えたあとにビームが光らせた所が、ねらいの光の半分（多くても400こま）にとどいたとき。
  // 待ちすぎないように上限（1行ずつ3秒・ゆっくり1.5秒）。速い・本当なら すぐ。▼を動かしている間は見せない（出たり消えたりしない。検証）
  let seen = 0;
  if (G.passNow && !G.shown && !G.knobDrag) { const st = G.S.stamp, c = G.changeTick; for (let i = 0; i < st.length; i++) if (st[i] >= c) seen++; }
  const cap = sp === 1 ? 3000 : sp === 2 ? 1500 : 0;
  if (G.passNow && !G.shown && !G.knobDrag && (seen >= G.expect || sp >= 3 || t - G.changeAt > cap)) {
    G.shown = true; G.passedAt = t; G.log.flips++; G.log.passes.push({ stage: G.si, at: t - G.log.start });
    cheer(G.si === 0 ? '光った！' : G.si === 1 ? '線になった' : '点になった');
  }
  // 一度出したら、合格でなくなって0.4秒たってから消す
  if (G.passNow) G.failAt = 0;
  else if (G.shown) { if (!G.failAt) G.failAt = t; if (t - G.failAt > 400) { G.shown = false; G.log.flips++; $('#next').hidden = true; cheer(null); } }
  if (G.shown && !G.knobDrag) {
    // 段0は、速くして縞が「絵」になるのを見てから次へ（最初の見せ場。UX）
    const seenPic = G.si !== 0 || sp >= 3 || t - G.passedAt > 12000;
    if (seenPic && $('#next').hidden) { $('#next').hidden = false; $('#next').textContent = G.si < STAGES.length - 1 ? '次へ' : 'もう一度'; }
  }
  // 段0の 22〜30秒: 本当の速さで3秒たったら、ほかの口を6秒だけ誘う（縞の太さが変わる＝最初の「おれの」）
  if (G.si === 0 && G.shown && G.realAt && sp >= 3 && !G.otherDone && t - G.realAt > 3000) { G.otherDone = true; G.otherUntil = t + 6000; toast('ほかの口だと、縞の太さが変わる'); }
  // 画面へつないだのに、ずっと0（光が来ない）
  if (G.zeroAll && !G.zeroWarned && G.board.wires.some(w => w.to.startsWith('scr.')) && t - G.changeAt > 1500) { G.zeroWarned = true; toast('画面へ光が来ていない（ずっと0）'); }
  const idle = (t - G.idleAt) / 1000;
  if (!G.passNow && (idle > 45 || t - G.stageAt > 120000)) $('#answer').classList.add('show');
  // 速さは次の止まりのボタン1つだけ脈打たせる
  const want = G.shown && G.si === 0 && sp < 4 ? sp + 1 : -1;
  document.querySelectorAll('#speed button').forEach((b, k) => b.classList.toggle('pulse', k === want));
}
// 合格の知らせ: 管の上ふちのまん中に1.5秒
let cheerT = 0;
function cheer(msg) {
  const el = $('#cheer'); clearTimeout(cheerT);
  if (!msg) { el.classList.remove('show'); return; }
  const r = $('#bezel').getBoundingClientRect();
  el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = (r.top - 8) + 'px';
  el.textContent = msg; el.classList.add('show');
  cheerT = setTimeout(() => el.classList.remove('show'), 1500);
}
$('#next').onclick = () => { if (G.si < STAGES.length - 1) loadStage(G.si + 1); else loadStage(0); };

// つぎにつなぐ線（助け・はじめの脈打ち）
function nextHint() { return G.stage.hints.find(h => !G.board.wires.some(w => w.from === h.from && w.to === h.to)); }

function render(t) {
  const S = G.S, bx = S.h - T.HB, by = S.v - T.VB, visible = bx >= 0 && by >= 0;
  const slow = G.speed > 0 && G.speed <= 2, pp = tube.width / T.VIS_W;
  let bandX = [-1, -1, 0, 0], bandY = [-1, -1, 0, 0];
  for (const b of G.board.blocks) if (b.type === 'cmp') {
    const ax = cmpAxis(b.id); if (!ax) continue;
    const a = b.params.n * T.CELL, z = (b.params.n + b.params.w) * T.CELL;
    if (ax === 'h') { const inb = slow && S.h >= a && S.h < z; bandX = [a - T.HB, z - T.HB, inb ? 0.16 : 0.08, 0.10]; }
    else { const inb = slow && S.v >= a && S.v < z; bandY = [a - T.VB, z - T.VB, inb ? 0.16 : 0.08, 0]; }
  }
  if (bandX[0] < 0 || bandY[0] < 0) bandX[3] = 0;
  let ghost = [0, 0, 0, 0], ghostOn = 0;
  const tg = G.stage.target;
  if (tg && G.stage.id === 2) { ghost = [(tg.c - 4) * 8 - T.HB, (tg.r - 4) * 8 - T.VB, (tg.c + 6) * 8 - T.HB, (tg.r + 6) * 8 - T.VB]; ghostOn = 1; }
  if (tg && G.stage.id === 1) { ghost = [(tg.c - 4) * 8 - T.HB, 0, (tg.c + 6) * 8 - T.HB, T.VIS_H]; ghostOn = 1; }
  crt?.draw(G.glow, {
    curve: 0.045, scan: Math.min(0.75, Math.max(0.15, (tube.height / 262 - 1.5) / 1.5)),
    bloom: 0.55 + 0.2 * (LOOK.dot - 1), refl: LOOK.refl, flick: 1 + (Math.random() - 0.5) * 0.02, dot: 1.2 + LOOK.dot * 0.4,
    beam: [bx, by, visible && slow ? 1 : 0], beamCore: 3 * dpr() / pp, beamHalo: 14 * dpr() / pp, beamTail: 24 * dpr() / pp,
    bandX, bandY, ghost, ghostOn, corner: 10 * dpr() / pp,
    stripe: G.stage.stripe ? [G.stage.stripe, G.board.wires.length ? 0.05 : 0.12] : [0, 0],
    time: t * 0.001 % 100,
  });
  // 基板
  const X = boardXf(), key = `${G.L.mode}|${G.L.H}|${X.s.toFixed(3)}`;
  if (key !== subKey) { substrate = makeSubstrate(G.L.W, G.L.H, X.s, LOOK.grime); subKey = key; }
  bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, bc.width, bc.height);
  bg.setTransform(X.s, 0, 0, X.s, X.x, X.y);
  const idle = (t - G.idleAt) / 1000, h = nextHint();
  const pulse = [];
  if (G.drag) { for (const [k] of G.L.pads) if (compatible(G.drag.from, k) && (h && (k === h.to || k === h.from) || idle > 20)) pulse.push(k); }
  else if (G.armed) pulse.push(G.armed);
  else if (G.si === 0 && G.otherUntil && t < G.otherUntil) pulse.push(G.stage.other);
  else if (h && !G.passNow) pulse.push(h.from);
  // ずっと0のとき: 画面へつないだ部品の空いた入口
  if (G.zeroWarned && G.zeroAll) {
    const w = G.board.wires.find(x => x.to.startsWith('scr.')), id = w?.from.split('.')[0], B = G.board.blocks.find(x => x.id === id);
    if (B) for (const p of PARTS[B.type].in) if (!G.board.wires.some(x => x.to === id + '.' + p) && G.L.pads.has(id + '.' + p)) pulse.push(id + '.' + p);
  }
  drawBoard(bg, G.board, G.L, G.vals, { ...LOOK, substrate, scale: X.s / dpr(), fast: G.speed >= 3, routes: G.routes, selWire: G.sel, pulse, time: t / 1000,
    ghostWire: h && !G.passNow && idle > 40 ? h : null });
  // つまみの脈打ち: 線はつないだが、まだ型紙に入っていないとき
  document.querySelectorAll('.knob').forEach(k => k.classList.toggle('pulse', !G.passNow && !nextHint() && idle > 4));
  drawOverlay(t, X, bx, by, visible, slow);
}

function drawOverlay(t, X, bx, by, visible, slow) {
  og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, over.width, over.height);
  const sx = dpr(), tr = tube.getBoundingClientRect(), bz = $('#bezel').getBoundingClientRect();
  const P = (x, y) => { const [cx, cy] = toClient(x, y); return [cx * sx, cy * sx]; };
  // 画面へのケーブル（基板の口から管の枠へ）
  const scr = [...G.L.pads.entries()].find(([k]) => k.startsWith('scr.'))?.[1];
  if (scr) {
    const [px, py] = P(scr.x - 26, scr.y);
    const tallM = G.L.mode === 'tall';
    const ex = tallM ? (bz.left + bz.width * 0.2) * sx : (bz.right - 6) * sx, ey = tallM ? (bz.bottom - 4) * sx : (bz.bottom - bz.height * 0.18) * sx;
    og.lineCap = 'round'; og.strokeStyle = '#1e1f20'; og.lineWidth = 4 * sx; og.shadowColor = 'rgba(0,0,0,0.6)'; og.shadowBlur = 5 * sx;
    og.beginPath(); og.moveTo(px, py);
    if (tallM) og.bezierCurveTo(px - 10 * sx, py - 60 * sx, ex, ey + 40 * sx, ex, ey); else og.bezierCurveTo(px - 50 * sx, py, ex + 40 * sx, ey + 10 * sx, ex, ey);
    og.stroke(); og.shadowBlur = 0; og.strokeStyle = 'rgba(255,255,255,0.12)'; og.lineWidth = 1 * sx; og.stroke();
  }
  // 糸（画面へ光を送る線と、いまのビーム）
  if (slow && visible) {
    const w = G.board.wires.find(x => x.to.startsWith('scr.') && G.vals[x.from]) || G.board.wires.find(x => x.to.startsWith('scr.'));
    const pad = w && G.L.pads.get(w.to);
    if (pad) {
      const [px, py] = P(pad.x, pad.y);
      const tx = (tr.left + (bx + 0.5) / T.VIS_W * tr.width) * sx, ty = (tr.top + (by + 0.5) / T.VIS_H * tr.height) * sx;
      const th = G.thread;
      og.setLineDash(th > 0.05 ? [] : [3 * sx, 4 * sx]);
      og.strokeStyle = th > 0.05 ? `rgba(255,179,71,${0.2 + 0.6 * th})` : 'rgba(216,236,255,0.18)';
      og.lineWidth = (th > 0.05 ? 2 : 1) * sx; og.shadowColor = 'rgba(255,179,71,0.7)'; og.shadowBlur = 6 * sx * th;
      og.beginPath(); og.moveTo(px, py); og.quadraticCurveTo((px + tx) / 2, Math.min(py, ty) - 30 * sx, tx, ty); og.stroke();
      og.setLineDash([]); og.shadowBlur = 0;
      og.strokeStyle = th > 0.05 ? `rgba(255,179,71,${0.3 + 0.5 * th})` : 'rgba(216,236,255,0.3)'; og.lineWidth = 1.2 * sx;
      og.beginPath(); og.arc(tx, ty, 4 * sx, 0, 7); og.stroke();
    }
  }
  // 引いている線（指についてくる）とルーペ
  const d = G.drag;
  if (d && Math.hypot(d.x - d.x0, d.y - d.y0) > 8) {
    const a = G.L.pads.get(d.from), [ax, ay] = P(a.x, a.y);
    let [ex, ey] = [d.x * sx, d.y * sx];
    if (d.snap) { const q = G.L.pads.get(d.snap); [ex, ey] = P(q.x, q.y); }
    og.lineCap = 'round'; og.strokeStyle = d.snap ? 'rgba(255,179,71,0.9)' : 'rgba(216,236,255,0.7)'; og.lineWidth = 3 * sx;
    og.beginPath(); og.moveTo(ax, ay); og.lineTo(ex, ey); og.stroke();
    if (d.touch) {
      const R = 46 * sx, cx = d.x * sx, cy = d.y * sx - 80 * sx, br = bc.getBoundingClientRect(), z = 1.8;
      og.save(); og.beginPath(); og.arc(cx, cy, R, 0, 7); og.clip();
      og.fillStyle = '#111'; og.fill();
      const srcX = (d.x - br.left) * sx, srcY = (d.y - br.top) * sx, sw = R * 2 / z;
      og.drawImage(bc, srcX - sw / 2, srcY - sw / 2, sw, sw, cx - R, cy - R, R * 2, R * 2);
      og.restore();
      og.strokeStyle = 'rgba(243,239,230,0.85)'; og.lineWidth = 2 * sx; og.beginPath(); og.arc(cx, cy, R, 0, 7); og.stroke();
    }
  }
}

let toastT = 0;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200); }

// ---- はじめる ----
fit();
loadStage(Math.max(0, Math.min(STAGES.length - 1, Number(qs.get('stage') || 0))));
if (qs.has('speed')) setSpeed(Number(qs.get('speed')), true);
// サムネイル（tools/make-thumbs.ps1）: 段2の答えの台を、ビームが点を描き終えた所で見せる
if (qs.has('thumb')) {
  loadStage(2);
  for (const h of G.stage.hints) connect(h.from, h.to);
  applyAnswerKnobs(); setSpeed(2, true);
  G.S.v = T.VB; G.S.h = 0; advance((G.stage.target.r + 9) * 8 * T.W - T.VB * T.W, 0.4);
  $('#toast').style.display = 'none'; document.body.classList.add('thumb');
}
requestAnimationFrame(tick);

// 確かめ（tools/playtest.mjs）から読む
window.__probe = {
  get stage() { return G.si; }, get passed() { return G.shown; }, get passNow() { return G.passNow; }, get speed() { return G.speed; },
  get tick() { return G.S.tick; }, get wires() { return clone(G.board.wires); }, get log() { return G.log; },
  get nextVisible() { return !$('#next').hidden; },
  padXY: key => { const q = G.L.pads.get(key); return q ? toClient(q.x, q.y) : null; },
  knobXY: id => { const k = document.querySelector(`.knob[data-id="${id}"]`); if (!k) return null; const r = k.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
  tubeXY: (h, v) => { const r = tube.getBoundingClientRect(); return [r.left + (h - T.HB) / T.VIS_W * r.width, r.top + (v - T.VB) / T.VIS_H * r.height]; },
  glowSum: () => G.glow.reduce((a, b) => a + b, 0),
  pads: () => [...G.L.pads.keys()],
  knobN: id => G.board.blocks.find(b => b.id === id)?.params?.n,
  get flips() { return G.log.flips; },
  routeCheck: () => routeReport(G.L, G.routes),
  boxes: () => {
    const parts = G.L.parts.filter(p => p.w).map(p => { const [x0, y0] = toClient(p.x - p.w / 2, p.y - p.h / 2), [x1, y1] = toClient(p.x + p.w / 2, p.y + p.h / 2); return [p.id, x0, y0, x1, y1]; });
    const [bx0, by0] = toClient(0, 0), [bx1, by1] = toClient(G.L.W, G.L.H);
    return { board: [bx0, by0, bx1, by1], parts, pads: [...G.L.pads].map(([k, q]) => [k, ...toClient(q.x, q.y)]) };
  },
};
