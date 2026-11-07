// サケ のぼれ! のドット絵。1文字 = 1ドット（. = 0 すきとおり／背景の色、1・2・3 = パレットの色）。
// 光は左上から。大きな絵は 8×8 に切って使う（tools/lib.mjs の big）
const grid = (w, h, f) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => f(x, y)).join(''));
const hash = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const g8 = (f) => grid(8, 8, f);
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dith = (x, y, a) => BAYER[y & 3][x & 3] < a * 16; // a = 0〜1 の濃さ
const segD = (px, py, x0, y0, x1, y1) => {
  const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L));
  return [Math.hypot(px - x0 - dx * t, py - y0 - dy * t), t];
};
const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));
// 色の地図（0 そと）に、そとがわ 1 ドットの黒いふち（1）をつける
function outline(w, h, col) {
  const m = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => col(x, y)));
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : m[y][x]);
  return m.map((r, y) => r.map((c, x) => {
    if (c) return String(c);
    return at(x - 1, y) > 1 || at(x + 1, y) > 1 || at(x, y - 1) > 1 || at(x, y + 1) > 1 ? '1' : '.';
  }).join(''));
}

// ---------- 背景 ----------
// パレット 0 岩かべ: 0 こい紺・1 明るい岩・2 暗い岩・3 こけ
// パレット 1 水と谷: 0 こい紺（谷のかげ）・1 白いあわ・2 水・3 深い水と谷のすじ（谷の絵は 0 と 3 だけ）
// パレット 2 滝: 1 の色と 2 の色が入れかわる（あわが わきたつ）
// パレット 3 字: 0 こい紺・1 白・2 サケ色（ちからの帯）・3 黒（字の影）

// 谷のおく（0 と 3 だけ）: たての岩の柱（柱状の節理）。l・r = 左右のふちの こさ（0〜3）。
//   となりの絵とふちの こさが同じなので、どの行の型を重ねても柱が上下につながる。d = 小さな ひび
function gorge(l, r, d) {
  return g8((x, y) => {
    const a = (l + ((r - l) * (x + 0.5)) / 8) / 3;              // 0〜1
    if (d === 1 && y === 4 && x > 1 && x < 6) return '.';           // 横の ひび
    if (d === 1 && y === 5 && x > 1 && x < 7) return '3';
    if (d === 2 && (x === 3 || x === 4) && y > 0 && y < 6) return x === 3 ? '3' : '.';  // たての すじ
    if (hash(x, 0, l * 4 + r + d) < 0.28) return hash(x, y >> 1, d + 40) < a * 0.9 ? '3' : '.';  // 柱のたての すじ
    return hash(x, y, d * 7 + l * 3 + r) < a * 0.12 ? '3' : '.';
  });
}
// 滝つぼの上のしぶき（下ほど こい）
const mist = (s) => g8((x, y) => {
  const h = hash(x, y, s);
  if (y >= 4 && h < (y - 3) * 0.045) return '2';                     // 水しぶきの つぶ（下ほど多い）
  if (hash(x, 0, s + 3) < 0.25 && hash(x, y >> 1, s + 41) < 0.4) return '3';
  return '.';
});
// 水面: 上のふちに白いさざ波、下は水。v でずらす
const surf = (v) => g8((x, y) => {
  const wv = Math.round(0.8 + 0.8 * Math.sin(((x + v * 3) * 2 * Math.PI) / 8));
  if (y < wv) return '.';
  if (y === wv) return (x + v * 5) % 7 < 4 ? '1' : '2';               // さざ波の光（とぎれとぎれ）
  if (y === wv + 1) return (x + v * 5) % 7 === 5 ? '1' : '2';
  if (y >= 5 && hash(x, y, v + 30) < 0.2) return '3';
  return '2';
});
// 水の中（下ほど深い色の網）
const water = (v) => g8((x, y) => (dith(x, y, Math.max(0, (y - 2) / 9)) && hash(x, y, v) < 0.9 ? '3' : hash(x, y, v + 4) < 0.04 ? '1' : '2'));
// たなの岩（ぬれた岩: 深い色に、上のふちと ところどころ水の光）
const under = (v) => g8((x, y) => {
  if (y === 0) return dith(x, y, 0.5) ? '3' : '2';                  // 水から岩へ
  if (y === 1 && hash(x, 1, v) < 0.5) return '2';
  if (hash(x, y, v + 3) < 0.06) return '.';                          // ひび・くぼみ
  if (hash(x, y, v + 5) < 0.05 && y < 5) return '2';                 // ぬれて光る
  return '3';
});
// たなの いちばん下（でこぼこの岩のふちと、つらら・しずく。岩は上から 1〜3 ドット）
const hang = (v) => g8((x, y) => {
  const edge = 1 + Math.round(hash(x >> 1, 2, v) * 2);
  if (y < edge) return hash(x, y, v + 8) < 0.06 ? '.' : '3';
  if (y === edge && (x + v * 3) % 5 === 1) return '3';               // つらら
  if (y === edge + 1 && (x + v * 3) % 5 === 1 && hash(x, v, 9) < 0.7) return '3';
  if (y === edge + 3 && (x + v * 3) % 5 === 1 && hash(x, v, 7) < 0.5) return '2'; // 落ちる しずく
  return '.';
});
// 滝が落ちる所のあわ（水面）と、わきたつ水
const foam = (v) => g8((x, y) => {
  const top = Math.round(1.2 * Math.sin((x + v * 3) * 1.3)) - 1;
  if (y < top + 1) return hash(x, y, v + 50) < 0.25 ? '1' : '.';
  const b = hash(x, y, v + 60);
  return b < 0.55 - y * 0.05 ? '1' : b < 0.85 ? '2' : '3';
});
const churn = (v) => g8((x, y) => { const b = hash(x, y, v + 70); return b < 0.25 ? '1' : b < 0.7 ? '2' : '3'; });
// 落ちる水（2 まいで 1 本の滝）。白いすじは上下につながり、ふちはぎざぎざ。side 0 = 左の1まい・1 = 右
const fall = (side, v) => g8((x, y) => {
  const X = side * 8 + x;                                        // 0〜15
  const edgeL = 1 + Math.round(hash(0, y + v * 8, 3) * 1.3), edgeR = 14 - Math.round(hash(1, y + v * 8, 4) * 1.3);
  if (X < edgeL || X > edgeR) return X === edgeL - 1 || X === edgeR + 1 ? (hash(X, y + v * 8, 5) < 0.3 ? '2' : '.') : '.';
  if (X === edgeL || X === edgeR) return '3';
  const lane = [2, 5, 8, 11, 13].includes(X) && hash(X, (y + v * 8) >> 2, 6) < 0.8;
  return lane ? '1' : hash(X, y + v * 8, 7) < 0.12 ? '1' : '2';
});
// 滝の口（水面の高さ）。dir: 0 = 右のたなから左へ落ちる（滝は たなの左）・1 = 左のたなから右へ
function fallTop(dir, side) {
  const rows = grid(16, 8, (X, y) => {
    // たなのふち（X=16）から左へ ふくらんで落ちる
    const reach = 16 - Math.min(14, 2 + y * 2.2);                 // 上ほど たなに近い
    if (X < reach - 0.5) return '.';
    if (y === 0) return X > reach + 1 ? '1' : '.';
    if (X < reach + 0.8) return '3';
    return (X + y) % 3 === 0 ? '1' : '2';
  });
  const r = dir ? mirror(rows) : rows;
  return r.map((row) => row.slice(side * 8, side * 8 + 8));
}
// たなのふち（ lip ）: 右のたなの左はし（dir 0）。kind: surf・water・under
function lip(kind, dir) {
  const rows = g8((x, y) => {
    if (kind === 'surf') {
      if (y === 0) return x > 1 ? '1' : '.';
      if (x < 1) return '.';
      if (x === 1) return '3';
      return y === 1 && x < 4 ? '1' : '2';
    }
    if (kind === 'water') { if (x < 1) return '.'; if (x === 1) return '3'; return x === 2 ? '3' : dith(x, y, (y - 2) / 9) ? '3' : '2'; }
    if (kind === 'under') { if (x < 1 + (y > 4 ? (y - 4) * 0.7 : 0)) return '.'; return y === 0 && x > 2 ? '2' : '3'; }
    // hang: まるくすぼまる岩のはし
    const edge = 1 + Math.round(hash(x >> 1, 2, 0) * 2);
    if (x < 3.5 + y * 1.2 || y >= edge + (x > 5 ? 1 : 0)) return '.';
    return '3';
  });
  return dir ? mirror(rows) : rows;
}
// 岩かべ（パレット 0）。side 0 = 左（右に谷）・1 = 右
function wall(side, v) {
  const rows = grid(16, 8, (X, y) => {
    const yy = y + v * 8;
    const face = 13 + Math.round(Math.sin(yy * 0.7 + v) * 1.2 + hash(0, yy, 2));   // 谷がわのふち
    if (X > face) return '.';
    if (X === face) return '2';
    const block = hash(X >> 2, (yy + (X >> 2) * 3) >> 3, 5);
    const seam = (yy + (X >> 2) * 3) % 8 === 0 || (X % 4 === 0 && hash(X, yy >> 3, 9) < 0.5);
    if (seam) return '2';
    if (hash(X, yy, 11) < 0.18 + (X > face - 4 ? 0.2 : 0)) return '3';            // こけ
    return block < 0.45 ? '1' : '2';
  });
  const r = side ? mirror(rows) : rows;
  return r;
}
// 川の深い所（下ほど こい紺）
const deep = (k) => g8((x, y) => (dith(x, y + 8 * k, Math.min(1, (y + 8 * k) / 22)) ? (dith(x + 1, y + 8 * k + 1, Math.min(1, (y + 8 * k) / 30)) ? '.' : '3') : (y + 8 * k < 6 ? '2' : '3')));
const pebble = (s) => g8((x, y) => { const d = Math.hypot(x - 3.5 - hash(1, 1, s) * 2, (y - 5) * 1.6); return d < 2 ? (y < 4 + hash(2, 2, s) ? '2' : '3') : '.'; });
// 字の段の下のふち（0 番のスプライトが当たる）
const hudEdge = g8((x, y) => (y >= 6 ? '3' : '.'));
// ちからの帯（パレット 3: 2 サケ色・1 白いわく・3 黒）。n = 0〜8 ドット
const bar = (n) => g8((x, y) => (y === 0 || y === 7 ? '1' : y === 1 ? '3' : x < n ? (y === 2 ? '1' : '2') : '.'));
// 題の板
function plate(part) {
  const R = 5;
  const fx = [0, 1, 2, 0, 2, 0, 1, 2][part], fy = [0, 0, 0, 1, 1, 2, 2, 2][part];
  return g8((x, y) => {
    const px = fx === 0 ? x : fx === 2 ? 7 - x : 9, py = fy === 0 ? y : fy === 2 ? 7 - y : 9;
    let d;
    if (fx !== 1 && fy !== 1) d = R - Math.hypot(Math.max(0, R - px - 0.5), Math.max(0, R - py - 0.5));
    else d = Math.min(px, py) + 0.5;
    if (d < 0) return '.';
    if (d < 1) return '3';
    if (d < 2) return '1';
    return '.';
  });
}

// ---------- 題の字（16×16。2 ドットの太さの線） ----------
function strokes(segs, dots = []) {
  return grid(16, 16, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    for (const s of segs) if (segD(px, py, ...s)[0] < 1.05) return '1';
    for (const [cx, cy] of dots) if (Math.abs(px - cx) < 1.1 && Math.abs(py - cy) < 1.1) return '1';
    return '.';
  });
}
// 円弧を線分に
const arc = (cx, cy, rx, ry, a0, a1, n = 10) => Array.from({ length: n }, (_, i) => {
  const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
  return [cx + rx * Math.cos(t0), cy + ry * Math.sin(t0), cx + rx * Math.cos(t1), cy + ry * Math.sin(t1)];
});
export const KANA = {
  SA: strokes([[1.5, 5, 14.5, 5], [5, 1.5, 5, 9], [11, 1.5, 11, 8.5], [11, 8.5, 6, 14.5]]),
  KE: strokes([[6, 1.5, 2, 7.5], [5, 4.5, 14.5, 4.5], [10.5, 4.5, 10, 9.5], [10, 9.5, 6, 14.5]]),
  no: strokes([...arc(8, 8.5, 6, 5.8, -Math.PI * 0.55, Math.PI * 1.25, 16), [8, 3, 6.5, 9], [6.5, 9, 4.5, 13]]),
  bo: strokes([[2.5, 2, 2.5, 13.5], [6, 4.5, 12.5, 4.5], [6.5, 8, 12, 8], [9.5, 2, 9.5, 12], ...arc(8.5, 12, 3, 2, -Math.PI * 0.1, Math.PI * 1.9, 10), [11.5, 12.2, 14, 14]], [[13, 1.5], [15, 2.5]]),
  re: strokes([[3.5, 1.5, 3.5, 14.5], [1, 6, 4, 5], [4, 9.5, 9, 4.5], [9, 4.5, 9.5, 12], [9.5, 12, 11, 13.5], [11, 13.5, 14.5, 12]]),
  ex: strokes([[7.5, 1.5, 7.5, 9.5]], [[7.5, 13]]),
};

export const BG = {
  blank: g8(() => '.'),
  ...Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].flatMap((r) => [0, 1, 2].map((d) => ['g' + l + r + d, gorge(l, r, d)])))),
  mistA: mist(0), mistB: mist(1),
  surfA: surf(0), surfB: surf(1),
  waterA: water(0), waterB: water(1),
  underA: under(0), underB: under(1), hangA: hang(0), hangB: hang(1),
  foamA: foam(0), foamB: foam(1), churnA: churn(0), churnB: churn(1),
  // 滝（2 まい × 2 つの段ちがい）
  fallA0: fall(0, 0), fallA1: fall(1, 0), fallB0: fall(0, 1), fallB1: fall(1, 1),
  // 滝の口: 右のたなから（左がわに落ちる）・左のたなから
  ftR0: fallTop(0, 0), ftR1: fallTop(0, 1), ftL0: fallTop(1, 0), ftL1: fallTop(1, 1),
  lipSR: lip('surf', 0), lipWR: lip('water', 0), lipUR: lip('under', 0), lipHR: lip('hang', 0),
  lipSL: lip('surf', 1), lipWL: lip('water', 1), lipUL: lip('under', 1), lipHL: lip('hang', 1),
  wallL0: wall(0, 0), wallL1: wall(0, 1), wallL2: wall(0, 2), wallL3: wall(0, 3),
  wallR0: wall(1, 0), wallR1: wall(1, 1), wallR2: wall(1, 2), wallR3: wall(1, 3),
  deep0: deep(0), deep1: deep(1), deep2: deep(2), pebA: pebble(1), pebB: pebble(2),
  hudEdge,
  bar0: bar(0), bar1: bar(1), bar2: bar(2), bar3: bar(3), bar4: bar(4), bar5: bar(5), bar6: bar(6), bar7: bar(7), bar8: bar(8),
  p0: plate(0), p1: plate(1), p2: plate(2), p3: plate(3), p4: plate(4), p5: plate(5), p6: plate(6), p7: plate(7),
};

// ---------- スプライト ----------
// ベニザケ（産卵へ川をのぼるオス。パレット 0: 1 黒・2 赤い体・3 緑の頭）。右むき 24×16
//   せなかが こぶのように もりあがり、あごが かぎのように曲がる（婚姻色: 赤い体に緑の頭）
//   pose: 0 およぐ・1 しっぽをふる・2 ためる（しっぽを高く まげて、頭を上へ）
function salmon(pose) {
  const wag = [-0.5, 1.4, -2.6][pose], lift = pose === 2 ? 0.35 : 0;
  const sy = (x) => 9 + (x < 10 ? (wag * (10 - x)) / 5 : 0) - (x > 14 ? (x - 14) * lift : 0);
  const half = (x) => (x < 4.5 ? 0 : x < 8 ? 0.8 + (x - 4.5) * 0.6 : x < 16 ? 2.9 + Math.sin(((x - 8) / 8) * Math.PI) * 0.4 : 2.9 - (x - 16) * 0.45);
  const hump = (x) => (x >= 9 && x <= 17 ? Math.sin(((x - 9) / 8) * Math.PI) * 1.8 : 0);
  return outline(24, 16, (x, y) => {
    const px = x + 0.5, py = y + 0.5, c = sy(px);
    if (px > 22.6) return 0;
    const top = c - half(px) - hump(px), bot = c + half(px) * 0.9;
    if (py > top && py < bot) {
      if (x === 18 && y === Math.round(c - 1.2)) return 1;                             // 目
      if (px > 20 && Math.abs(py - (c + 0.9)) < 0.5) return 1;                        // 口
      if (px > 14.8 - (py - c) * 0.5) return 3;                                       // 緑の頭（えらぶたのふちは ななめ）
      return 2;
    }
    if (px > 20.6 && px < 22.6 && py > c + 1 && py < c + 2.6) return 3;             // かぎのあご
    const tc = sy(4);
    if (segD(px, py, 5.5, tc, 1.4, tc - 3.8)[0] < 1.05 || segD(px, py, 5.5, tc, 1.4, tc + 3.8)[0] < 1.05) return 2; // 尾びれ（ふたまた）
    if (segD(px, py, 13, c - half(13) - hump(13) + 0.4, 11, c - half(11) - hump(11) - 1.4)[0] < 0.75) return 2; // せびれ
    return 0;
  });
}
// ヒグマ（パレット 1: 1 黒・2 茶・3 うすい茶の鼻づら・つめ・せなかの光）。左むき 24×24、下は水にかくれる
//   pose 0 見はる（頭をさげて滝をのぞく）・1 手をふりあげる（くる合図）・2 手をのばした（手の先は別の絵）
function bear(pose) {
  const hx = pose === 2 ? 7.4 : 8, hy = [13, 9.5, 13.5][pose];
  const inBody = (px, py) => py < 22.5 && (Math.hypot((px - 15.5) / 8, (py - 17.5) / 7.2) < 1 || Math.hypot(px - 14.8, py - 11) < 4.2);
  const inHead = (px, py) => Math.hypot((px - hx) / 4.6, (py - hy) / 4) < 1;
  const inSnout = (px, py) => Math.hypot((px - (hx - 4.8)) / 3.3, (py - (hy + 1.3)) / 1.8) < 1;
  const inEar = (px, py) => Math.hypot(px - (hx + 1.2), py - (hy - 3.9)) < 1.8;
  const arm = (px, py) => pose === 0 ? segD(px, py, 12, 15, 9, 21.8)[0] < 2.1 : pose === 1 ? segD(px, py, 13, 12, 11.5, 2.5)[0] < 2 : segD(px, py, 12, 14, 0.5, 8)[0] < 2.1;
  const any = (px, py) => inBody(px, py) || inHead(px, py) || inSnout(px, py) || inEar(px, py) || arm(px, py);
  return outline(24, 24, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    if (py > 22.5) return 0;                                                        // 水の下
    if (inSnout(px, py)) return px < hx - 7.2 && py < hy + 1.8 ? 1 : 3; // 鼻づら・鼻
    if (Math.abs(px - (hx - 2.2)) < 0.6 && Math.abs(py - (hy - 1.2)) < 0.6) return 1;   // 目
    if (pose === 1 && Math.hypot(px - 11.3, py - 2.2) < 1.6) return 3;               // ふりあげた手のつめ
    if (pose === 0 && Math.hypot(px - 8.6, py - 22) < 1.4) return 3;
    if (inEar(px, py) && !inHead(px, py)) return Math.hypot(px - (hx + 1.2), py - (hy - 4.1)) < 0.8 ? 1 : 2;
    if (inHead(px, py)) {
      if ((!inHead(px + 1, py) || !inHead(px, py - 1)) && (inBody(px + 1, py) || inBody(px, py - 1) || arm(px + 1, py))) return 1; // 頭と体のさかい
      return 2;
    }
    if (arm(px, py) && pose !== 1) return !arm(px - 1, py) && !inHead(px - 1, py) ? 1 : 2;
    if (any(px, py)) return 2;
    return 0;
  });
}
// のばした手（16×16、左むき）: 右のはしから のびるうでと、大きな手、下を向いた つめ
const paw = outline(16, 16, (x, y) => {
  const px = x + 0.5, py = y + 0.5;
  for (const [cx, cy] of [[1.6, 10.6], [3, 12.2], [4.8, 13.2], [6.8, 13.2]]) if (segD(px, py, cx + 0.8, cy - 1.4, cx, cy)[0] < 0.6) return 3; // つめ
  if (segD(px, py, 15.5, 7.5, 8, 8.5)[0] < 2.1) return 2;
  if (Math.hypot((px - 5) / 1.25, py - 9) < 3.1) return 2;
  return 0;
});
// ねらいの しるし（パレット 3: 1 白・2 黒・3 黄）16×8: 滝にかかる太い線と三角（三角の先が とどく高さ）
const marker = ['................', '..........22....', '2222222222332...', '2333333333133322', '2333333333133322', '2222222222332...', '..........22....', '................'];
// しぶき 16×8（パレット 2）
const splash = (f) => grid(16, 8, (x, y) => {
  const drops = f ? [[2, 4], [5, 2], [8, 1], [11, 2], [14, 4], [7, 6], [10, 6]] : [[3, 5], [6, 3], [8, 5], [10, 3], [13, 5], [5, 7], [11, 7]];
  for (const [dx, dy] of drops) { const d = Math.hypot(x - dx, (y - dy) * 1.3); if (d < 0.9) return '1'; if (d < 1.5 && x + y < dx + dy) return '2'; }
  return '.';
});
// ぶつかった星（パレット 2 の 3 黄・1 白）
const star = ['...3....', '...3....', '3.313.3.', '.33133..', '3311133.', '.33133..', '3.313.3.', '...3....'];
// 0 番のスプライト（字の段の下のふちに当てる 1 ドット。背景のうしろ）
const mark = g8((x, y) => (x === 0 && y === 7 ? '3' : '.'));

export const SP = {
  mark,
  salA: salmon(0), salB: salmon(1), salC: salmon(2),
  bearA: bear(0), bearB: bear(1), bearC: bear(2), paw,
  marker, splA: splash(0), splB: splash(1), star,
};
