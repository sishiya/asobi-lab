// みちいし 見くらべページ（舵⑤）。部屋の状態は pathstones/js/rules.js でそのまま作り、絵だけを案ごとに描きかえる。
// 2D（側面を描いた2D）と 3D（Three.js の正投影・固定カメラ）× みちいしの見た目3案。ゲームの画面ではない。
// 第4版: 第3回の採点（アート・UX・調査）で、ひびをぎざぎざの線に・灯台を菌の群生に・3D の生きた石を明るく・3D の頭の三角をやめる・3D の印を太く・3D のともしごを丸く・盤のふちを暗く溶かす・ミニ図を44px以上に。
// 第3版: 第2回の採点で 3D の石のすき間と面取り・頭の三角・真鍮の帯・奈落と盤の外・菌のかさ・床の明るさ、2D・A の角、持っている形のミニ図を直した。
// 第2版（2026-10-19）: アートディレクター役の第1回の採点で直した（生きている／止まった、頭石のくさび、3D の明るさ、
// 奈落と盤の外、印の太さ、C の二重の輪郭、灯台の形）。
import * as THREE from 'three';
import { loadLevel, step, VOID, GROUND, BRIDGE, CRACK } from '../../../pathstones/js/rules.js';

const W = 360, H = 460, S = 42, BOARD_H = 396; // 原寸: 幅360px、1マス42px。下の 64px は親指の帯（持っている形）
const STYLES = [
  { id: 'A', name: '石の連なり', note: '角を落とした四角い切り石。頭は前を斜めに切ったくさび。継ぎ目の下から青白い照り返し。' },
  { id: 'B', name: 'からくりの石人形', note: '切り石を真鍮のちょうつがいでつなぐ。頭は真鍮の帯を巻いたくさび。' },
  { id: 'C', name: '床をまとう敷石', note: '敷石の上の面に、通った床のタイル模様をまとう。高さと影で床から浮く。' },
];
const DIR = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

// 色（COLORS.md / ART.md 6章の明暗の段: 奈落・盤の外 0〜10%／床 30〜40%／石 50〜65%／光 80〜100%）
const C = {
  out: [24, 22, 20], voidTop: [2, 2, 2], ground: [82, 76, 68], groundLine: [40, 37, 33], groundTile: [100, 93, 83],
  quartz: '#ece7da', amber: [255, 176, 72], green: [150, 230, 120], ice: [176, 214, 255],
  stone: [140, 131, 117], stoneStop: [96, 90, 80], stoneSide: [62, 57, 50], cut: [52, 48, 42], brass: '#c49a45', moss: '#6fae5e',
};
let bright = false;
const lum = () => (bright ? 1.4 : 1);
const rgb = (c, k = 1, a = 1) => `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;

// ---- 部屋と手 ----
let level, states = [], stepNo = 0;
async function loadRoom(name) {
  level = await (await fetch(`../../../pathstones/levels/${name}.json`)).json();
  states = [loadLevel(level)];
  for (const a of level.intended || []) states.push(step(states[states.length - 1], a));
  stepNo = Math.min(stepNo, states.length - 1);
  render();
}

// ---- 2D ----
function hash(x, y, k = 0) { let h = (x * 374761393 + y * 668265263 + k * 2246822519) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return (h & 0xffff) / 0xffff; }
function boardOrigin(s) { return [Math.round((W - s.w * S) / 2), Math.round((BOARD_H - s.h * S) / 2) + 14]; }
const LIFT = h => Math.round(S * h * 0.42); // 65°の見下ろしで、高さ h の側面が見える量（高さ0.45→約8px）

function draw2D(ctx, s, style, scale = 1) {
  ctx.save();
  ctx.scale(scale, scale);
  const L = lum();
  ctx.fillStyle = rgb(C.out, L); ctx.fillRect(0, 0, W, H);
  const [ox, oy] = boardOrigin(s);
  const X = x => ox + x * S, Y = y => oy + y * S;
  const fl = (x, y) => (x < 0 || y < 0 || x >= s.w || y >= s.h) ? VOID : s.floor[y * s.w + x];
  // 盤の外わく（2px）
  ctx.strokeStyle = rgb(C.ground, L * 0.7); ctx.lineWidth = 2; ctx.strokeRect(ox - 2, oy - 2, s.w * S + 4, s.h * S + 4);
  // 床
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const f = fl(x, y);
    if (f === VOID) {
      ctx.fillStyle = rgb(C.voidTop); ctx.fillRect(X(x), Y(y), S, S);
      if (fl(x, y - 1) !== VOID) { // 手前のふち: 北の床の、岩の断面の帯（20%・8px）
        ctx.fillStyle = rgb(C.stoneSide, L * 0.85); ctx.fillRect(X(x), Y(y), S, 8);
        const g = ctx.createLinearGradient(0, Y(y) + 8, 0, Y(y) + 8 + S * 0.35);
        g.addColorStop(0, 'rgba(30,27,24,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(X(x), Y(y) + 8, S, S * 0.35);
      }
      continue;
    }
    const v = 0.92 + hash(x, y) * 0.14;
    ctx.fillStyle = rgb(f === BRIDGE ? C.stoneStop : C.ground, v * L); ctx.fillRect(X(x), Y(y), S, S);
    ctx.fillStyle = rgb(C.groundLine, L); ctx.fillRect(X(x), Y(y), S, 2); ctx.fillRect(X(x), Y(y), 2, S); // マスのすき間 2px
    if (f === BRIDGE) { ctx.fillStyle = rgb(C.cut, L); ctx.fillRect(X(x) + S / 2 - 6, Y(y) + S / 2 - 3, 12, 6); } // 敷石: ほぞの凹
    if (f === CRACK) crack2D(ctx, X(x), Y(y), x, y);
  }
  // 灯台
  for (const b of s.beacons) beacon2D(ctx, s, b, X, Y, L);
  // 上の層（北から南へ: 南の物が手前）
  const items = [];
  for (const r of s.rows) r.forEach(p => items.push({ p, kind: 'row' }));
  for (const c of s.cents) if (c.alive) c.body.forEach((p, i) => items.push({ p, kind: 'cent', i, c }));
  items.push({ p: s.player, kind: 'player' });
  items.sort((a, b) => a.p[1] - b.p[1] || (a.kind === 'player') - (b.kind === 'player'));
  for (const it of items) {
    const [x, y] = it.p;
    if (it.kind === 'row') stoneStopped2D(ctx, X(x), Y(y), x, y, L);
    else if (it.kind === 'cent') stoneAlive2D(ctx, X(x), Y(y), x, y, style, it.i === 0, it.c.dir, L);
    else player2D(ctx, X(x) + S / 2, Y(y) + S / 2);
  }
  // 印（約束: 青白の点線 3px と矢じり 12px、先のマスにかぎ印）
  for (const c of s.cents) if (c.alive && c.mark) mark2D(ctx, c, X, Y);
  // ともしごの灯り（琥珀の面の光）
  const [px, py] = [X(s.player[0]) + S / 2, Y(s.player[1]) + S / 2];
  const g = ctx.createRadialGradient(px, py, 4, px, py, S * 1.6);
  g.addColorStop(0, rgb(C.amber, 1, 0.26)); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(px - S * 2, py - S * 2, S * 4, S * 4);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(0, BOARD_H + 14, W, H - BOARD_H - 14); // 親指の帯
  if (s.held) { // 持っている形: 親指の帯のミニ図（1マス 8px、盤にかさねない）
    const xs = s.held.map(p => p[0]), ys = s.held.map(p => p[1]);
    const minx = Math.min(...xs), miny = Math.min(...ys), bw = (Math.max(...xs) - minx + 1) * 12, bh = (Math.max(...ys) - miny + 1) * 12;
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(8, H - 8 - Math.max(44, bh + 12), Math.max(52, bw + 12), Math.max(44, bh + 12));
    for (const [dx, dy] of s.held) { ctx.fillStyle = rgb(C.stone, L); ctx.fillRect(14 + (dx - minx) * 12, H - 2 - Math.max(44, bh + 12) + (dy - miny) * 12, 11, 11); ctx.strokeStyle = rgb(C.amber); ctx.lineWidth = 1.5; ctx.strokeRect(14 + (dx - minx) * 12, H - 2 - Math.max(44, bh + 12) + (dy - miny) * 12, 11, 11); }
  }
  ctx.restore();
}

function crack2D(ctx, x, y, gx, gy) { // 割れ目: 不規則なぎざぎざの線（字やルーンに見せない）、明るさ 70%、光らせない
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'miter';
  const vert = hash(gx, gy, 9) > 0.5, pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6, j = (hash(gx, gy, 20 + i) - 0.5) * S * 0.22;
    pts.push(vert ? [x + S * (0.42 + hash(gx, gy, 1) * 0.16) + j, y + S * (0.06 + t * 0.88)] : [x + S * (0.06 + t * 0.88), y + S * (0.42 + hash(gx, gy, 1) * 0.16) + j]);
  }
  const k = 2 + Math.floor(hash(gx, gy, 5) * 3), br = pts[k];
  const tip = [br[0] + (vert ? 1 : -0.4) * S * (0.12 + hash(gx, gy, 6) * 0.1), br[1] + (vert ? -0.3 : 1) * S * (0.1 + hash(gx, gy, 7) * 0.1)];
  const mid = [(br[0] + tip[0]) / 2 + (hash(gx, gy, 8) - 0.5) * 6, (br[1] + tip[1]) / 2 + (hash(gx, gy, 10) - 0.5) * 6];
  ctx.strokeStyle = 'rgba(20,18,16,.9)'; ctx.lineWidth = 5; // 割れたすきまの暗さ
  ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.moveTo(...br); ctx.lineTo(...mid); ctx.lineTo(...tip); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,194,180,.85)'; ctx.lineWidth = 3; // 石英の脈（70%）
  ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.moveTo(...br); ctx.lineTo(...mid); ctx.lineTo(...tip); ctx.stroke();
  ctx.restore();
}

function beacon2D(ctx, s, b, X, Y, L) {
  const cx = X(b.x) + S / 2, cy = Y(b.y) + S / 2;
  if (b.r > 0) { // ともった灯台の範囲: 床を緑に、さかい線は実線
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (Math.abs(x - b.x) + Math.abs(y - b.y) <= b.r) { ctx.fillStyle = rgb(C.green, 1, 0.12); ctx.fillRect(X(x), Y(y), S, S); }
  }
  const halo = ctx.createRadialGradient(cx, cy - 6, 2, cx, cy - 6, S * 0.9);
  halo.addColorStop(0, rgb(C.green, 1, b.goal ? 0.45 : 0.6)); halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo; ctx.fillRect(cx - S, cy - S - 6, S * 2, S * 2);
  // 低い石の台
  ctx.fillStyle = rgb(C.stoneSide, L); ctx.fillRect(cx - S * 0.3, cy - 2, S * 0.6, 7);
  ctx.fillStyle = rgb(C.stone, L); ctx.fillRect(cx - S * 0.3, cy - 8, S * 0.6, 7);
  // 光る菌の群生: 細い柄に低いかさが3〜4本かたまる（1UP キノコに見せない）
  const caps = [[-0.16, 0.02, 0.12], [0.02, -0.06, 0.15], [0.17, 0.03, 0.1], [0.06, 0.1, 0.08]];
  for (const [dx, dy, r] of caps) {
    const bx = cx + dx * S, by = cy - 9 + dy * S;
    ctx.strokeStyle = rgb(C.green, 0.6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, by + 6); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = rgb(C.green, b.goal ? 0.9 : 1.1); ctx.beginPath(); ctx.ellipse(bx, by, r * S, r * S * 0.38, 0, Math.PI, 0); ctx.fill();
  }
}

function stoneAlive2D(ctx, x, y, gx, gy, style, head, dir, L) {
  const lift = LIFT(0.45);
  const size = head ? S * 0.9 : S * 0.8, inset = (S - size) / 2;
  const top = y - lift;
  // 継ぎ目の下の照り返し（青白 60%・半径 0.3マス）と床に落ちる影
  const gl = ctx.createRadialGradient(x + S / 2, y + S * 0.7, 2, x + S / 2, y + S * 0.7, S * 0.55);
  gl.addColorStop(0, rgb(C.ice, 1, 0.45)); gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl; ctx.fillRect(x - S * 0.1, y + S * 0.1, S * 1.2, S * 1.1);
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x + inset + 3, y + S - inset - 1, size - 2, 6);
  // 側面（高さ 0.45 → 約8px の帯）
  ctx.fillStyle = rgb(C.stoneSide, L); ctx.fillRect(x + inset, top + S - inset, size, lift);
  // 上の面
  const sv = 0.95 + hash(gx, gy, 7) * 0.08;
  ctx.fillStyle = rgb(style === 'C' ? C.ground : C.stone, L * sv * (style === 'C' ? 1.18 : 1));
  roundRect(ctx, x + inset, top + inset, size, size, style === 'A' ? 3 : 2); ctx.fill();
  ctx.fillStyle = rgb(C.stone, L * 1.25); ctx.fillRect(x + inset + 2, top + inset + 1, size - 4, 2); // 上のふちの面取りの光
  if (style === 'C') { // まとった床のタイル模様（床と同じ 2px のすき間）
    ctx.fillStyle = rgb(C.groundLine, L * 1.1);
    ctx.fillRect(x + inset, top + S / 2 - 1, size, 2); ctx.fillRect(x + S / 2 - 1, top + inset, 2, size);
  }
  ctx.strokeStyle = 'rgba(12,11,10,.95)'; ctx.lineWidth = 2.5; roundRect(ctx, x + inset, top + inset, size, size, style === 'A' ? 3 : 2); ctx.stroke();
  if (style === 'B') { // 真鍮のちょうつがい（5px）
    ctx.fillStyle = C.brass; ctx.fillRect(x + inset - 2, top + S * 0.42, 5, 8); ctx.fillRect(x + S - inset - 3, top + S * 0.42, 5, 8);
  }
  if (head) { // 頭石: 前の面を斜めに切ったくさび。切った面は +20% の明るさ
    const d = DIR[dir], cx = x + S / 2, cy = top + S / 2, half = size / 2, nx = -d[1], ny = d[0];
    const f0 = [cx + d[0] * half, cy + d[1] * half], back = 0.38 * size;
    ctx.fillStyle = rgb(style === 'C' ? C.ground : C.stone, L * 1.2 * (style === 'C' ? 1.18 : 1));
    ctx.beginPath();
    ctx.moveTo(f0[0] + nx * half, f0[1] + ny * half);
    ctx.lineTo(f0[0] - nx * half, f0[1] - ny * half);
    ctx.lineTo(f0[0] - d[0] * back - nx * half, f0[1] - d[1] * back - ny * half);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(12,11,10,.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(f0[0] + nx * half, f0[1] + ny * half); ctx.lineTo(f0[0] - d[0] * back - nx * half, f0[1] - d[1] * back - ny * half); ctx.stroke();
    if (style === 'B') { ctx.fillStyle = C.brass; ctx.fillRect(cx - d[1] * 0 - (d[0] ? 2 : half), cy - (d[1] ? 2 : half), d[0] ? 4 : size, d[1] ? 4 : size); }
  }
}

function stoneStopped2D(ctx, x, y, gx, gy, L) { // 止まった石（石垣）: 照り返しなし、床に近い明るさ、ほぞの凸2つ
  const lift = LIFT(0.4), size = S * 0.84, inset = (S - size) / 2, top = y - lift;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + inset + 3, y + S - inset - 1, size - 2, 5);
  ctx.fillStyle = rgb(C.stoneSide, L * 0.85); ctx.fillRect(x + inset, top + S - inset, size, lift);
  ctx.fillStyle = rgb(C.stoneStop, L * (0.95 + hash(gx, gy, 7) * 0.08)); ctx.fillRect(x + inset, top + inset, size, size);
  ctx.strokeStyle = 'rgba(20,18,16,.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + inset, top + inset, size, size);
  ctx.fillStyle = rgb(C.stoneStop, L * 1.3); ctx.fillRect(x + S * 0.27, top + S * 0.42, 6, 6); ctx.fillRect(x + S * 0.61, top + S * 0.42, 6, 6);
  ctx.fillStyle = C.moss; ctx.fillRect(x + S * 0.7, top + S * 0.7, 3, 3);
}

function mark2D(ctx, c, X, Y) {
  const h = c.body[0], m = c.mark, d = DIR[c.dir] || [0, 0];
  const x0 = X(h[0]) + S / 2 + d[0] * S * 0.45, y0 = Y(h[1]) + S / 2 - LIFT(0.45) + d[1] * S * 0.45;
  const x1 = X(m[0]) + S / 2, y1 = Y(m[1]) + S / 2;
  ctx.strokeStyle = rgb(C.ice, 1, 0.8); ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.fillStyle = rgb(C.ice, 1, 0.9); ctx.beginPath();
  ctx.moveTo(x1 + Math.cos(a) * 12, y1 + Math.sin(a) * 12);
  ctx.lineTo(x1 + Math.cos(a + 2.5) * 12, y1 + Math.sin(a + 2.5) * 12);
  ctx.lineTo(x1 + Math.cos(a - 2.5) * 12, y1 + Math.sin(a - 2.5) * 12); ctx.fill();
  // 先のマスのかぎ印
  ctx.strokeStyle = rgb(C.ice, 1, 0.8); ctx.lineWidth = 2;
  const mx = X(m[0]), my = Y(m[1]), k = 8, q = 5;
  for (const [cx, cy, sx, sy] of [[mx + q, my + q, 1, 1], [mx + S - q, my + q, -1, 1], [mx + q, my + S - q, 1, -1], [mx + S - q, my + S - q, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx + sx * k, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * k); ctx.stroke();
  }
}

function player2D(ctx, cx, cy) {
  cy -= S * 0.2;
  const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, S * 0.27);
  g.addColorStop(0, '#fff6dc'); g.addColorStop(0.35, rgb(C.amber, 1.05)); g.addColorStop(1, rgb(C.amber, 0.6, 0.95));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, S * 0.25, 0, 7); ctx.fill();
  ctx.strokeStyle = '#6b4a24'; ctx.lineWidth = 1.6; // 丸い編みかご: 縦の線3本
  for (const i of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(cx + i * 6, cy - S * 0.24); ctx.quadraticCurveTo(cx + i * 9, cy, cx + i * 6, cy + S * 0.24); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.25, 0, 7); ctx.stroke();
  ctx.fillStyle = '#3a2410'; ctx.fillRect(cx - 6, cy - 1, 2, 2); ctx.fillRect(cx + 4, cy - 1, 2, 2); // 顔は点2つ、間を広く
  ctx.strokeStyle = '#6b4a24'; ctx.beginPath(); ctx.moveTo(cx - 4, cy + S * 0.24); ctx.lineTo(cx - 5, cy + S * 0.36); ctx.moveTo(cx + 4, cy + S * 0.24); ctx.lineTo(cx + 5, cy + S * 0.36); ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// ---- 3D（正投影・固定カメラ 65°、北が上） ----
const three = [];
function make3D(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return { renderer };
}
function draw3D(t, s, style) {
  const scene = new THREE.Scene();
  const L = lum();
  scene.background = new THREE.Color(rgb(C.out, L));
  const col = (c, k = 1) => new THREE.Color(rgb(c, k * L));
  const mat = (c, k = 1, extra = {}) => new THREE.MeshStandardMaterial({ color: col(c, k), roughness: 0.9, ...extra });
  const aspect = W / H, view = Math.max(s.h, s.w / aspect) * 1.12;
  const cam = new THREE.OrthographicCamera(-view * aspect / 2, view * aspect / 2, view / 2, -view / 2, 0.1, 100);
  const tilt = 65 * Math.PI / 180, dist = 20, cx = s.w / 2, cz = s.h / 2;
  cam.position.set(cx, Math.sin(tilt) * dist, cz + Math.cos(tilt) * dist); cam.lookAt(cx, 0, cz);
  scene.add(new THREE.HemisphereLight(0xd8d2c4, 0x2a2622, 1.1 * L));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.1 * L); key.position.set(cx - 4, 12, cz + 6); key.castShadow = true;
  key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 8; key.shadow.camera.bottom = -8; key.shadow.mapSize.set(1024, 1024); key.target.position.set(cx, 0, cz); scene.add(key, key.target);
  const box = (w, h, d, m, x, y, z) => { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); g.position.set(x, y, z); g.castShadow = true; g.receiveShadow = true; scene.add(g); return g; };
  const fl = (x, y) => s.floor[y * s.w + x];
  // 奈落は 0%（盤の下に黒い板）、盤の外は 10%、盤の外わく 2px
  const voidPlane = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshBasicMaterial({ color: 0x020202 })); voidPlane.rotation.x = -Math.PI / 2; voidPlane.position.set(cx, -0.62, cz); scene.add(voidPlane);
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(s.w + 0.1, s.h + 0.1)), new THREE.LineBasicMaterial({ color: col(C.ground, 0.9) })); frame.rotation.x = -Math.PI / 2; frame.position.set(cx, 0.01, cz); scene.add(frame);
  const quartz = new THREE.MeshBasicMaterial({ color: 0xa8a294 }); // 明るさ 70%
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const f = fl(x, y);
    if (f === VOID) continue;
    const v = 0.92 + hash(x, y) * 0.14;
    { const top = mat(f === BRIDGE ? C.stoneStop : C.ground, v * 1.35), side = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 1 });
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.6, 0.96), [side, side, top, side, side, side]); t.position.set(x + 0.5, -0.3, y + 0.5); t.receiveShadow = true; scene.add(t); }
    if (f === CRACK) { // ぎざぎざの割れ目（2D と同じ点の並び）
      const vert = hash(x, y, 9) > 0.5, pts = [];
      for (let i = 0; i <= 6; i++) { const t = i / 6, j = (hash(x, y, 20 + i) - 0.5) * 0.22; pts.push(vert ? [0.42 + hash(x, y, 1) * 0.16 + j, 0.06 + t * 0.88] : [0.06 + t * 0.88, 0.42 + hash(x, y, 1) * 0.16 + j]); }
      for (let i = 0; i < 6; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az);
        const seg = box(0.06, 0.02, len, quartz, x + (ax + bx) / 2, 0.01, y + (az + bz) / 2); seg.rotation.y = Math.atan2(bx - ax, bz - az);
      }
    }
  }
  for (const r of s.rows) for (const p of r) {
    box(0.84, 0.4, 0.84, mat(C.stoneStop), p[0] + 0.5, 0.2, p[1] + 0.5);
    box(0.13, 0.05, 0.13, mat(C.stoneStop, 1.3), p[0] + 0.32, 0.42, p[1] + 0.5);
    box(0.13, 0.05, 0.13, mat(C.stoneStop, 1.3), p[0] + 0.68, 0.42, p[1] + 0.5);
  }
  const brass = new THREE.MeshStandardMaterial({ color: 0xc49a45, metalness: 0.8, roughness: 0.35 });
  for (const c of s.cents) if (c.alive) c.body.forEach((p, i) => {
    const head = i === 0, sz = head ? 0.9 : 0.8;
    const m = style === 'C' ? mat(C.ground, 1.45) : mat(C.stone, 1.25);
    box(sz, 0.45, sz, m, p[0] + 0.5, 0.225, p[1] + 0.5);
    const bevel = new THREE.MeshStandardMaterial({ color: col(C.stone, 1.4), roughness: 0.9 }); // 上のふちの面取りの光（石ごとに分かれて見える）
    box(sz, 0.02, 0.05, bevel, p[0] + 0.5, 0.455, p[1] + 0.5 - sz / 2 + 0.025);
    box(0.05, 0.02, sz, bevel, p[0] + 0.5 - sz / 2 + 0.025, 0.455, p[1] + 0.5);
    if (style === 'C') { const g = new THREE.MeshBasicMaterial({ color: col(C.groundLine, 1.1) }); box(sz, 0.01, 0.04, g, p[0] + 0.5, 0.456, p[1] + 0.5); box(0.04, 0.01, sz, g, p[0] + 0.5, 0.456, p[1] + 0.5); }
    if (style === 'B') { box(0.06, 0.12, 0.2, brass, p[0] + 0.5 - sz / 2, 0.28, p[1] + 0.5); box(0.06, 0.12, 0.2, brass, p[0] + 0.5 + sz / 2, 0.28, p[1] + 0.5); }
    const glow = new THREE.PointLight(col(C.ice), 0.5 * L, 0.9, 1.5); glow.position.set(p[0] + 0.5, 0.05, p[1] + 0.5); scene.add(glow); // 継ぎ目の下の照り返し
    if (head) { // くさび: 前の面を斜めに切る（明るい切り口）
      const d = DIR[c.dir];
      const w = new THREE.Mesh(new THREE.BoxGeometry(d[0] ? 0.3 : sz, 0.46, d[1] ? 0.3 : sz), mat(style === 'C' ? C.ground : C.stone, 1.5 * (style === 'C' ? 1.18 : 1)));
      w.position.set(p[0] + 0.5 + d[0] * (sz / 2 - 0.12), 0.24, p[1] + 0.5 + d[1] * (sz / 2 - 0.12));
      if (d[0]) w.rotation.z = -d[0] * 0.5; else w.rotation.x = d[1] * 0.5;
      w.castShadow = true; scene.add(w);
      if (style === 'B') box(d[0] ? 0.06 : sz + 0.02, 0.12, d[1] ? 0.06 : sz + 0.02, brass, p[0] + 0.5 - d[0] * 0.1, 0.3, p[1] + 0.5 - d[1] * 0.1);
    }
  });
  const ice = new THREE.MeshBasicMaterial({ color: col(C.ice, 1.1) });
  for (const c of s.cents) if (c.alive && c.mark) {
    const m = c.mark, h = c.body[0];
    for (let k = 1; k <= 3; k++) { const q = k / 4; box(0.16, 0.03, 0.16, ice, h[0] + 0.5 + (m[0] - h[0]) * q, 0.03, h[1] + 0.5 + (m[1] - h[1]) * q); }
    for (const [ax, az] of [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]]) { box(0.2, 0.03, 0.06, ice, m[0] + ax, 0.03, m[1] + az); box(0.06, 0.03, 0.2, ice, m[0] + ax, 0.03, m[1] + az); }
  }
  // ともしご: 熾きの球と、丸い編みかごの縦の線3本
  const px = s.player[0] + 0.5, pz = s.player[1] + 0.5;
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff0c8 })); ember.position.set(px, 0.3, pz); scene.add(ember);
  const wick = new THREE.MeshStandardMaterial({ color: 0x7a5228, roughness: 1 });
  for (const a of [-0.6, 0, 0.6]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 6, 24), wick); r.position.set(px, 0.3, pz); r.rotation.y = a; r.scale.set(1, 0.8, 1); scene.add(r); }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.02, 6, 28), wick); band.rotation.x = Math.PI / 2; band.position.set(px, 0.3, pz); scene.add(band);
  const fire = new THREE.PointLight(col(C.amber), 3.5 * L, 3.4, 1.4); fire.position.set(px, 0.7, pz); fire.castShadow = true; scene.add(fire);
  for (const b of s.beacons) {
    box(0.5, 0.2, 0.5, mat(C.stone), b.x + 0.5, 0.1, b.y + 0.5);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.18, 8), new THREE.MeshBasicMaterial({ color: col(C.green, 0.8) })); stem.position.set(b.x + 0.5, 0.29, b.y + 0.5); scene.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: col(C.green, b.goal ? 0.95 : 1.15) }));
    cap.scale.set(1, 0.45, 1); cap.position.set(b.x + 0.5, 0.38, b.y + 0.5); cap.rotation.x = 0.35; scene.add(cap);
    for (const [dx, dz, r] of [[-0.18, 0.08, 0.12], [0.18, 0.1, 0.1]]) { const c2 = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap.material); c2.scale.set(1, 0.45, 1); c2.position.set(b.x + 0.5 + dx, 0.28, b.y + 0.5 + dz); c2.rotation.x = 0.3; scene.add(c2); }
    const gl = new THREE.PointLight(col(C.green), 0.9 * L, 1.6, 1.8); gl.position.set(b.x + 0.5, 0.6, b.y + 0.5); scene.add(gl);
  }
  t.renderer.render(scene, cam);
}

// ---- ページ ----
const panels = document.getElementById('panels');
const cv2 = [], cv3 = [];
for (const st of STYLES) {
  const f = document.createElement('figure');
  const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2; c.className = 'panel';
  f.append(c); const cap = document.createElement('figcaption'); cap.textContent = `2D・${st.id} ${st.name}: ${st.note}`; f.append(cap);
  panels.append(f); cv2.push(c);
}
for (const st of STYLES) {
  const f = document.createElement('figure');
  const c = document.createElement('canvas'); c.className = 'panel';
  f.append(c); const cap = document.createElement('figcaption'); cap.textContent = `3D・${st.id} ${st.name}（正投影 65°）`; f.append(cap);
  panels.append(f); cv3.push(c); three.push(make3D(c));
}

function render() {
  const s = states[stepNo];
  document.getElementById('stepNo').textContent = `${stepNo} / ${states.length - 1}${stepNo ? '  (' + level.intended[stepNo - 1] + ')' : ''}`;
  STYLES.forEach((st, i) => { draw2D(cv2[i].getContext('2d'), s, st.id, 2); draw3D(three[i], s, st.id); });
  if (q.get('strip')) renderStrip(q.get('strip'));
}
function renderStrip(style = 'A') {
  const strip = document.getElementById('strip'); strip.innerHTML = '';
  for (let k = stepNo; k < Math.min(states.length, stepNo + 6); k++) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    draw2D(c.getContext('2d'), states[k], style, 1); strip.append(c);
  }
}
const q = new URLSearchParams(location.search);
document.getElementById('prev').onclick = () => { stepNo = Math.max(0, stepNo - 1); render(); };
document.getElementById('next').onclick = () => { stepNo = Math.min(states.length - 1, stepNo + 1); render(); };
document.getElementById('level').onchange = e => { stepNo = 0; loadRoom(e.target.value); };
document.getElementById('gray').onchange = e => document.body.classList.toggle('gray', e.target.checked);
document.getElementById('bright').onchange = e => { bright = e.target.checked; render(); };
document.getElementById('stripBtn').onclick = () => renderStrip('A');
if (q.get('gray')) { document.body.classList.add('gray'); document.getElementById('gray').checked = true; }
if (q.get('step')) stepNo = +q.get('step');
if (q.get('room')) document.getElementById('level').value = q.get('room');
loadRoom(q.get('room') || 'r3');
