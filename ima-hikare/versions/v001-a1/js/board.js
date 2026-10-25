// いま光れ: 基板を描く（Canvas 2D）。配置は「ならべた2枚」、質感は「作業机のジオラマ」（PLAN 2章）。
// 横長は論理の大きさ 640×480、たて画面は 344×372 の別の割り付け（UX・アートの採点 2026-10-24、検証 2026-10-25）。信号の 1 は琥珀の1色。
// 出す端子はその段で使うものだけ（1行7こまで）。ほかは「ふた」にたたむ。口を1つも出さないカウンタは描かない。
import { PARTS } from './sim.js';

export const SIZE = { wide: [640, 480], tall: [344, 372] };
const AMBER = [255, 179, 71];
const SILK = 'rgba(232,226,200,0.86)';
const FONT = '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic", sans-serif';

const FIXED = {
  wide: { y: 70, gap: 52, padDy: 58, rowH: 0, scr: [46, 290] },
  tall: { y: 46, gap: 48, padDy: 50, rowH: 104, scr: [28, 232] },
};
const LBL = { H: ['よこを数える', 'IK93-455'], V: ['たてを数える', 'IK93-262'] };
// 置き場（「見えるかたまり9個まで」。A-1 は3つ）。下の段の出口が板のふちから24より内側に入るように
const SLOTS = {
  wide: [[220, 246], [420, 246], [320, 344], [520, 344], [120, 344], [560, 246], [220, 344], [420, 344], [320, 246]],
  tall: [[92, 206], [254, 206], [172, 296], [296, 296], [48, 296], [172, 206]],
};
const BLK = {
  cmp: { w: 96, label: 'くらべる', part: 'IK85' },
  and: { w: 70, label: 'かつ', part: 'IK08' },
  or: { w: 70, label: 'どちらか', part: 'IK32' },
  not: { w: 56, label: 'ちがう', part: 'IK04' },
  ball: { w: 120, label: '玉を数える', part: 'IK93-B' },
  ff: { w: 110, label: '向きを覚える', part: 'IK107' },
  timer: { w: 90, label: 'タイマー', part: 'IK555' },
};
const PADLBL = { count: '数', HBLANK: '消', VBLANK: '消', h: 'よこ', v: 'たて', out: '', t: 'もし', clk: 'とき', set: '→1', reset: '→0', q: '向き', nq: '逆', dirH: 'よこ', dirV: 'たて', trig: '合図' };

// show: 出す端子のキーの一覧（なければ全部）。mode: 'wide' | 'tall'
export function layout(board, mode, show) {
  const F = FIXED[mode], [W] = SIZE[mode], pads = new Map(), parts = [];
  const want = key => !show || show.includes(key) || board.wires.some(w => w.from === key || w.to === key);
  // カウンタ: 出す口を決めて、横にならべる（入らなければたてに重ねる）
  const ctr = board.blocks.filter(b => b.type === 'H' || b.type === 'V').map(b => {
    const P = PARTS[b.type], outs = P.out.filter(p => want(b.id + '.' + p)), hidden = P.out.length - outs.length;
    const span = outs.length * F.gap + (hidden ? 34 : 0);
    return { b, P, outs, hidden, w: Math.max(120, span + 10) };
  }).filter(c => c.outs.length);
  const total = ctr.reduce((a, c) => a + c.w, 0) + 24 * (ctr.length - 1);
  const stack = total > W - 60;
  let x = (W - total) / 2, row = 0;
  for (const c of ctr) {
    const cx = stack ? W / 2 : x + c.w / 2, cy = F.y + (stack ? row * F.rowH : 0);
    parts.push({ id: c.b.id, type: c.b.type, x: cx, y: cy, w: c.w, h: 40, label: LBL[c.b.type][0], part: LBL[c.b.type][1] });
    const x0 = cx - (c.outs.length * F.gap + (c.hidden ? 34 : 0)) / 2 + F.gap / 2;
    c.outs.forEach((p, i) => pads.set(c.b.id + '.' + p, { x: x0 + i * F.gap, y: cy + F.padDy, dir: 'out', label: PADLBL[p] ?? p.slice(1), bus: (c.P.bus || []).includes(p), led: !(c.P.bus || []).includes(p) }));
    if (c.hidden) parts.push({ id: c.b.id + '.lid', type: 'lid', x: x0 + c.outs.length * F.gap - F.gap / 2 + 8, y: cy + F.padDy, n: c.hidden });
    x += c.w + 24; row++;
  }
  const shift = stack ? (ctr.length - 1) * F.rowH : 0;
  let slot = 0;
  for (const b of board.blocks) {
    const P = PARTS[b.type];
    if (b.type === 'H' || b.type === 'V') continue;
    if (b.type === 'video') {
      const [vx, vy] = F.scr;
      parts.push({ id: b.id, type: 'video', x: vx, y: vy + shift, label: '画面' });
      const used = P.in.filter(p => board.wires.some(w => w.to === b.id + '.' + p));
      const ins = used.length ? used : ['in0'];
      ins.forEach((p, i) => pads.set(b.id + '.' + p, { x: vx + 10, y: vy + shift - 30 * (ins.length - 1) / 2 + i * 30, dir: 'side', label: '' }));
      continue;
    }
    const [cx, cy0] = (mode === 'tall' ? b.atTall : b.at) || SLOTS[mode][slot++ % SLOTS[mode].length];
    const cy = cy0 + shift;
    const d = BLK[b.type];
    parts.push({ id: b.id, type: b.type, x: cx, y: cy, w: d.w, h: 32, label: d.label, part: d.part, params: b.params });
    const ins = P.in, outs = P.out;   // 置いた部品の口はいつも出す（しぼるのはカウンタの口だけ）
    ins.forEach((p, i) => pads.set(b.id + '.' + p, { x: cx + (i - (ins.length - 1) / 2) * 52, y: cy - 46, dir: 'in', label: PADLBL[p] ?? '' }));
    outs.forEach((p, i) => pads.set(b.id + '.' + p, { x: cx + (i - (outs.length - 1) / 2) * 52, y: cy + 34, dir: 'out', label: PADLBL[p] ?? '', led: true }));
  }
  // 板の高さは中身に合わせる（下があくと、背の低い画面で縮みすぎる）
  const bottom = Math.max(...[...pads.values()].map(q => q.y + (q.dir === 'out' ? 30 : 16)), ...parts.filter(p => p.h).map(p => p.y + p.h / 2 + 20));
  // 横長は、幅も中身に合わせて左右を切りつめる（使わない所で縮まないように）
  let Wout = W;
  if (mode === 'wide') {
    const xs = [...[...pads.values()].map(q => q.x), ...parts.map(p => p.x - (p.w || 40) / 2), ...parts.map(p => p.x + (p.w || 40) / 2)];
    const x0 = Math.max(0, Math.min(...xs) - 36), x1 = Math.min(W, Math.max(...xs) + 40);
    if (x1 - x0 < W) { for (const q of pads.values()) q.x -= x0; for (const p of parts) p.x -= x0; Wout = Math.max(420, Math.ceil(x1 - x0)); }
  }
  return { pads, parts, mode, W: Wout, H: Math.max(mode === 'tall' ? 300 : 340, Math.min(SIZE[mode][1] + shift, Math.ceil(bottom + 34))) };
}

// ---- 基板の地（むらのある緑・透ける銅・穴・汚し・ランプの光）。大きさと汚しが変わったときだけ作る ----
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function makeSubstrate(W, H, scale, grime) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * scale); c.height = Math.round(H * scale);
  const g = c.getContext('2d'); g.scale(scale, scale);
  const R = rng(7 + W);
  const path = new Path2D(); path.moveTo(14, 18); path.lineTo(W - 16, 14); path.lineTo(W - 12, H - 18); path.lineTo(W - 40, H - 14); path.lineTo(W - 46, H - 18); path.lineTo(18, H - 14); path.closePath();
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 18; g.shadowOffsetY = 8;
  g.fillStyle = '#c9c09a'; g.fill(path); g.restore();          // 板の芯（ガラス布の色。4辺のふちに見える）
  g.save(); g.translate(0.5, -2); g.scale((W - 2) / W, (H - 2) / H); g.translate(1, 1.5); g.clip(path);
  const base = g.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, '#24543a'); base.addColorStop(0.55, '#1d4a33'); base.addColorStop(1, '#173d2b');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 220; i++) {                                // レジストのむら
    const x = R() * W, y = R() * H, r = 8 + R() * 46;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.03 + R() * 0.04, light = R() < 0.5;
    gr.addColorStop(0, light ? `rgba(70,120,80,${a})` : `rgba(5,20,12,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.globalAlpha = 0.05; g.strokeStyle = '#9fd0a8'; g.lineWidth = 0.5;   // ガラス布の目
  for (let x = 0; x < W; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 2, H); g.stroke(); }
  g.globalAlpha = 1;
  g.lineCap = 'round';                                           // 透ける銅
  for (let i = 0; i < W / 9; i++) {
    let x = 30 + Math.round(R() * (W - 60) / 10) * 10, y = 30 + Math.round(R() * (H - 60) / 10) * 10;
    g.strokeStyle = `rgba(120,170,110,${0.07 + R() * 0.06})`; g.lineWidth = 2 + R() * 2.5;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 3; k++) { if (R() < 0.5) x += (R() < .5 ? -1 : 1) * (20 + R() * 120); else y += (R() < .5 ? -1 : 1) * (20 + R() * 90); g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < W / 7; i++) {                              // 穴
    const x = 26 + R() * (W - 52), y = 26 + R() * (H - 52);
    g.fillStyle = 'rgba(150,150,140,0.55)'; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill();
    g.fillStyle = '#0b120e'; g.beginPath(); g.arc(x, y, 1.1, 0, 7); g.fill();
  }
  for (const [x, y] of [[30, 32], [W - 30, 30], [30, H - 30], [W - 30, H - 32]]) {
    g.fillStyle = '#9a9c94'; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill();
    g.fillStyle = '#121512'; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill();
  }
  // 汚し: フラックスのしみ（ふちのぎざぎざした細長い形）・ほこり・指のあと
  const G = [0, 1, 2.2][grime];
  for (let i = 0; i < 14 * G; i++) {
    const x = R() * W, y = R() * H, rx = 6 + R() * 18, ry = rx * (0.3 + R() * 0.4), rot = R() * 3;
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = `rgba(150,105,35,${0.03 + R() * 0.03})`;
    g.beginPath();
    for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI * 2, j = 0.75 + R() * 0.4; g.lineTo(Math.cos(a) * rx * j, Math.sin(a) * ry * j); }
    g.fill(); g.restore();
  }
  for (let i = 0; i < W * G; i++) { g.fillStyle = `rgba(210,205,190,${0.05 + R() * 0.16})`; g.fillRect(R() * W, R() * H, 0.6 + R() * 1.1, 0.6 + R() * 1.1); }
  for (let i = 0; i < 2 * G; i++) {
    const x = 80 + R() * (W - 160), y = 80 + R() * (H - 160);
    g.strokeStyle = 'rgba(255,255,255,0.025)'; g.lineWidth = 1;
    for (let k = 0; k < 14; k++) { g.beginPath(); g.ellipse(x, y, 4 + k * 2.2, 3 + k * 1.7, 0.4, 0, 7); g.stroke(); }
  }
  // 机のランプの光（右上の外から）と、左下の暗さ
  const lamp = g.createRadialGradient(W * 0.9, -H * 0.2, 0, W * 0.9, -H * 0.2, Math.hypot(W, H) * 0.9);
  lamp.addColorStop(0, 'rgba(255,200,140,0.10)'); lamp.addColorStop(1, 'rgba(255,200,140,0)');
  g.fillStyle = lamp; g.fillRect(0, 0, W, H);
  const dark = g.createRadialGradient(0, H, 0, 0, H, Math.hypot(W, H) * 0.7);
  dark.addColorStop(0, 'rgba(0,0,0,0.18)'); dark.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = dark; g.fillRect(0, 0, W, H);
  g.restore();
  g.fillStyle = SILK; g.font = '600 9px ui-monospace, Consolas, monospace'; g.textAlign = 'right';
  g.fillText('IKH-1972  REV.B', W - 54, H - 28);
  return c;
}

// ---- 部品 ----
function drawIC(g, p, lit, dim, fs) {
  const x = p.x - p.w / 2, y = p.y - p.h / 2;
  const legs = Math.max(4, Math.round(p.w / 14));
  for (let i = 0; i < legs; i++) {                                // 足（1本ずつ）とはんだ
    const lx = x + 8 + i * (p.w - 16) / (legs - 1);
    for (const [ly, dy] of [[y - 5, 1], [y + p.h + 1, -1]]) {
      const gr = g.createLinearGradient(lx - 2, 0, lx + 2, 0);
      gr.addColorStop(0, '#7d8079'); gr.addColorStop(0.5, '#d7d9d2'); gr.addColorStop(1, '#6d706a');
      g.fillStyle = gr; g.fillRect(lx - 2, ly, 4, 5);
      g.fillStyle = 'rgba(160,165,155,0.9)'; g.beginPath(); g.ellipse(lx, ly + (dy > 0 ? 0 : 5), 3.2, 1.6, 0, 0, 7); g.fill();
    }
  }
  g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 6; g.shadowOffsetX = 2; g.shadowOffsetY = 3;
  g.fillStyle = '#141414'; g.beginPath(); g.roundRect(x, y, p.w, p.h, 2.5); g.fill(); g.restore();
  const top = g.createLinearGradient(0, y, 0, y + p.h); top.addColorStop(0, '#2a2a2a'); top.addColorStop(1, '#141414');
  g.fillStyle = top; g.beginPath(); g.roundRect(x + 1, y + 1, p.w - 2, p.h - 2, 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 3, y + 1.5); g.lineTo(x + p.w - 3, y + 1.5); g.stroke();
  g.fillStyle = '#070707'; g.beginPath(); g.arc(x + 1, p.y, 4, -Math.PI / 2, Math.PI / 2); g.fill();   // 切りかき
  g.textAlign = 'center'; g.fillStyle = '#8a8a84'; g.font = `500 ${Math.max(8, fs * 0.72)}px ui-monospace, Consolas, monospace`;
  g.fillText(p.part || '', p.x + 3, p.y + fs * 0.26);           // 型番だけ（でたらめ）
  if (lit > 0.02) {
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(${AMBER},${0.45 * lit})`; g.lineWidth = 1.2; g.shadowColor = `rgba(${AMBER},${lit})`; g.shadowBlur = 6;
    g.beginPath(); g.roundRect(x, y, p.w, p.h, 2.5); g.stroke(); g.restore();
  }
  if (dim < 1) { g.fillStyle = `rgba(0,0,0,${1 - dim})`; g.beginPath(); g.roundRect(x - 2, y - 6, p.w + 4, p.h + 12, 3); g.fill(); }
  // 名前はシルク印刷（IC の左上の基板）
  g.fillStyle = SILK; g.font = `600 ${fs}px ${FONT}`; g.textAlign = 'left';
  g.fillText(p.label, x, y - 9);
}

function drawPad(g, pad, v, key, fs) {
  const r = pad.bus ? 6 : 5.4;
  g.fillStyle = '#8f938a'; g.beginPath(); g.arc(pad.x, pad.y, r + 1.4, 0, 7); g.fill();
  const gr = g.createRadialGradient(pad.x - 1.5, pad.y - 1.5, 0.5, pad.x, pad.y, r);
  gr.addColorStop(0, '#e6e8e0'); gr.addColorStop(0.6, '#a9ada4'); gr.addColorStop(1, '#6f736b');
  g.fillStyle = gr; g.beginPath(); g.arc(pad.x, pad.y, r, 0, 7); g.fill();
  g.fillStyle = '#1a1d1a'; g.beginPath(); g.arc(pad.x, pad.y, 1.6, 0, 7); g.fill();
  if (pad.bus) { g.strokeStyle = SILK; g.lineWidth = 0.9; g.beginPath(); g.arc(pad.x, pad.y, r + 3.4, 0, 7); g.stroke(); }
  // ランプ（パッドのそばの小さな LED のレンズ）。消えているときは暗い琥珀、1 のあいだ琥珀に光る
  if (pad.led) {
    const lx = pad.x, ly = pad.dir === 'in' ? pad.y + 12 : pad.y - 12;
    g.fillStyle = '#3a2a14'; g.beginPath(); g.roundRect(lx - 3.5, ly - 2, 7, 4, 1.5); g.fill();
    if (v > 0.01) {
      g.save();
      g.shadowColor = `rgba(${AMBER},${0.5 * v + 0.2})`; g.shadowBlur = 8;
      g.fillStyle = `rgba(${AMBER},${Math.min(1, 0.25 + v)})`; g.beginPath(); g.roundRect(lx - 3.5, ly - 2, 7, 4, 1.5); g.fill();
      g.restore();
    }
  }
  if (pad.label) {
    g.fillStyle = SILK; g.font = `600 ${fs * 0.92}px ${FONT}`; g.textAlign = 'center';
    g.fillText(pad.label, pad.x, pad.dir === 'in' ? pad.y - 11 : pad.y + 9 + fs);
  }
}

function route(a, b) {
  if (b.dir === 'side') { const yc = a.y + 26 + 18; return [[a.x, a.y], [a.x, yc], [b.x + 30, yc], [b.x + 30, b.y], [b.x, b.y]]; }
  const ym = a.y < b.y ? (a.y + b.y) / 2 : Math.max(a.y, b.y) + 20;
  return [[a.x, a.y], [a.x, ym], [b.x, ym], [b.x, b.y]];
}
function strokePath(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); }

// 線（ジャンパ線は落ち着いた3色、数の線は灰色の平たいリボン）。v は 0〜1
function drawWire(g, pts, v, o, hue, bus) {
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 4; g.shadowOffsetY = 2;
  g.strokeStyle = hue; g.lineWidth = bus ? 7 : 5; strokePath(g, pts); g.restore();
  if (bus) { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.6; for (const d of [-2, 2]) { g.save(); g.translate(d * 0.7, d * 0.7); strokePath(g, pts); g.restore(); } }
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.save(); g.translate(-0.8, -1.2); strokePath(g, pts); g.restore();
  if (v > 0.01) {
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(${AMBER},${Math.min(1, v * 1.05)})`; g.lineWidth = o.sig * 0.5 + 0.6; g.shadowColor = `rgba(${AMBER},${v})`; g.shadowBlur = 6 + o.sig * 1.5;
    strokePath(g, pts); g.restore();
  }
}

// vals: 口ごとの 0〜1。o.fast のときは、線のつながっていない口のランプを 0.15 まで落とす（目立つのは使っている所だけ）
export function drawBoard(g, board, L, vals, o) {
  const { W, H } = L;
  const fs = Math.max(9, 11 / o.scale);           // 画面の上で 11px 以上
  g.clearRect(0, 0, W, H);
  g.drawImage(o.substrate, 0, 0, W, H);
  const hues = ['#4a4a44', '#5b5346', '#3f4650'];
  const used = new Set(board.wires.flatMap(w => [w.from, w.to]));
  const shown = key => { const v = vals[key] || 0; return o.fast && !used.has(key) ? v * 0.15 : v; };
  board.wires.forEach((w, i) => {
    const a = L.pads.get(w.from), b = L.pads.get(w.to); if (!a || !b) return;
    const pts = o.routes?.get(w.from + '>' + w.to) || route(a, b);
    drawWire(g, pts, a.bus ? 0 : (vals[w.from] || 0), o, a.bus ? '#5a5d60' : hues[i % hues.length], a.bus);
    if (o.selWire === w.from + '>' + w.to) { g.save(); g.strokeStyle = 'rgba(216,236,255,0.55)'; g.lineWidth = 1.2; g.setLineDash([4, 4]); g.lineJoin = 'round'; strokePath(g, pts); g.restore(); }
  });
  for (const p of L.parts) {
    if (p.type === 'video') { drawScreenPort(g, p, L, board, vals, fs); continue; }
    if (p.type === 'lid') { drawLid(g, p, fs); continue; }
    const outs = PARTS[p.type].out.filter(q => !(PARTS[p.type].bus || []).includes(q));
    const lit = Math.max(0, ...outs.map(q => shown(p.id + '.' + q)));
    const isUsed = board.wires.some(w => w.from.startsWith(p.id + '.') || w.to.startsWith(p.id + '.'));
    drawIC(g, p, p.type === 'H' || p.type === 'V' ? 0 : lit, isUsed ? 1 : o.dim, fs);
  }
  for (const [key, pad] of L.pads) drawPad(g, pad, shown(key), key, fs);
  // 脈打つ端子（はじめに触るもの・助け）。目立たせるのは1つ
  for (const key of o.pulse || []) {
    const q = L.pads.get(key); if (!q) continue;
    const t = (o.time || 0) % 1.2 / 1.2;
    g.save(); g.strokeStyle = `rgba(216,236,255,${0.9 * (1 - t)})`; g.lineWidth = 3;
    g.beginPath(); g.arc(q.x, q.y, 8 + t * 18, 0, 7); g.stroke(); g.restore();
  }
  // 助けのうすい線（40秒動かないとき）
  if (o.ghostWire) {
    const a = L.pads.get(o.ghostWire.from), b = L.pads.get(o.ghostWire.to);
    if (a && b) { g.save(); g.strokeStyle = 'rgba(216,236,255,0.35)'; g.lineWidth = 2; g.setLineDash([5, 6]); g.lineJoin = 'round'; strokePath(g, route(a, b)); g.restore(); }
  }
}

// 使わない端子をたたんだ「ふた」
function drawLid(g, p, fs) {
  const w = 30, h = 22;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 4; g.shadowOffsetY = 2;
  g.fillStyle = '#2b2f2b'; g.beginPath(); g.roundRect(p.x - 4, p.y - h / 2, w, h, 3); g.fill(); g.restore();
  g.fillStyle = 'rgba(232,226,200,0.55)'; g.font = `600 ${fs * 0.8}px ${FONT}`; g.textAlign = 'center';
  g.fillText('…', p.x + w / 2 - 4, p.y + fs * 0.25);
}

// 画面へのケーブルの口（黒いかたまりに差しこみ口）。光るのは差しこみ口の輪だけ
function drawScreenPort(g, p, L, board, vals, fs) {
  const pads = [...L.pads.entries()].filter(([k]) => k.startsWith(p.id + '.'));
  const y0 = Math.min(...pads.map(([, q]) => q.y)) - 18, y1 = Math.max(...pads.map(([, q]) => q.y)) + 18;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
  g.fillStyle = '#1b1c1d'; g.beginPath(); g.roundRect(p.x - 14, y0, 30, y1 - y0, 4); g.fill(); g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x - 12, y0 + 1.5); g.lineTo(p.x + 14, y0 + 1.5); g.stroke();
  g.fillStyle = SILK; g.font = `600 ${fs}px ${FONT}`; g.textAlign = 'left';
  g.fillText(p.label, p.x - 14, y0 - 7);
  for (const [k, q] of pads) {
    const src = board.wires.find(w => w.to === k)?.from;
    const v = src ? (vals[src] || 0) : 0;
    g.strokeStyle = v > 0.01 ? `rgba(${AMBER},${0.25 + 0.5 * v})` : 'rgba(150,150,140,0.35)'; g.lineWidth = 1.4;
    g.beginPath(); g.arc(q.x, q.y, 9, 0, 7); g.stroke();
  }
}
