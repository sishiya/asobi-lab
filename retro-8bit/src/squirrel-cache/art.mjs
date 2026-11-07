// リスの かくしごと のドット絵。1文字 = 1ドット（. = 0 背景の色、1・2・3 = パレットの色）。
// 光は左上から。大きな絵は 8×8 に切って使う（tools/lib.mjs の big）。森の地面を少し上から見て、生き物は横向き
const grid = (w, h, f) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => f(x, y)).join(''));
const hash = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dith = (x, y, a) => BAYER[y & 3][x & 3] < a * 16;
const segD = (px, py, x0, y0, x1, y1) => {
  const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L));
  return [Math.hypot(px - x0 - dx * t, py - y0 - dy * t), t];
};
// かきこみのできる板
const cv = (w, h, c = '.') => Array.from({ length: h }, () => Array(w).fill(c));
const rows = (g) => g.map((r) => r.join(''));
const inE = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
function ell(g, cx, cy, rx, ry, c) { for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (inE(x, y, cx, cy, rx, ry)) g[y][x] = c; }
function line(g, pts, r, c) {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++)
    for (let i = 0; i + 1 < pts.length; i++) if (segD(x + 0.5, y + 0.5, ...pts[i], ...pts[i + 1])[0] < r) { g[y][x] = c; break; }
}
const dot = (g, x, y, c) => { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; };
// まわりに ふち（c）。斜めは見ない
function outline(g, c = '1') {
  const h = g.length, w = g[0].length, o = g.map((r) => [...r]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g[y][x] !== '.') continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const v = g[y + dy]?.[x + dx]; return v !== undefined && v !== '.' && v !== c; });
    if (n) o[y][x] = c;
  }
  return o;
}

// ================= 背景 =================
// パレット 0 地面（秋: 0 こい茶・1 土・2 落ち葉・3 みどり ／ 冬: 0 こい茶・1 青いかげ・2 うすい青・3 白い雪）
// パレット 1 石（秋: 0 こい茶・1 土・2 灰・3 白 ／ 冬: 1 うすい青・3 白）
// パレット 2 木（0 こい茶・1 木の皮と土・2 うすい木の色（冬は雪の白）・3 赤い葉とキノコ）
// パレット 3 字と板（0 こい茶・1 クリーム・2 だいだい・3 黒）

// 落ち葉の地面（16×16。くりかえしてもつながる）。こい土に、茶と うす緑の カシの葉。葉のまん中に すじ
function litter(seed) {
  const g = cv(16, 16, '.');
  const wrap = (x) => (x + 16) % 16;
  const n = 3 + Math.floor(hash(seed, 0, 1) * 2);
  for (let i = 0; i < n; i++) {
    const cx = hash(seed, i, 2) * 16, cy = hash(seed, i, 3) * 16, a = hash(seed, i, 4) * Math.PI;
    const col = hash(seed, i, 5) < 0.65 ? '1' : '2';
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const u = x * ca + y * sa, v = -x * sa + y * ca;
      const w = 1.7 * (1 - (u / 3.6) ** 2) + 0.35 * Math.cos(u * 2.6); // ふちが波うつ
      if (Math.abs(u) <= 3.4 && Math.abs(v) <= w) {
        const X = wrap(Math.round(cx + x)), Y = wrap(Math.round(cy + y));
        g[Y][X] = Math.abs(v) < 0.4 && Math.abs(u) < 2.8 && col === '2' ? '1' : col;
      }
    }
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (g[y][x] === '.' && hash(x, y, seed + 9) < 0.04) g[y][x] = '1';   // 土のつぶ
  return rows(g);
}
// 雪の地面: 白に、うすい青の やわらかい でこぼこ
function snow(seed) {
  return grid(16, 16, (x, y) => {
    const v = Math.sin((x + seed * 3) * 0.7) * Math.cos((y + seed) * 0.55) + (hash(x, y, seed) - 0.5) * 0.6;
    const h = hash(x, y, seed + 40);
    if (h < 0.02) return '2';
    return v > 0.75 ? '2' : '3';
  });
}
// 掘ったあと（秋）: 土をかけた小さな山。まわりの葉は よけてある（こい輪）、山の上は ほった土
const mound = (() => {
  const g = litter(5).map((r) => [...r]);
  ell(g, 8, 9, 7, 5.4, '.');
  ell(g, 8, 9, 5.4, 3.9, '2');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (inE(x, y, 8, 9, 5.4, 3.9)) {
    if (!inE(x, y, 7.4, 8.4, 4.6, 3.2) && y > 8) g[y][x] = '1';                      // 下の かげ
    else if (hash(x, y, 7) < 0.16) g[y][x] = '1';                                     // 土のつぶ
  }
  return rows(g);
})();
// 雪の穴（冬に掘ったところ）: こい土の穴、ふちに青いかげ、まわりに はねた雪
const hole = (() => {
  const g = snow(4).map((r) => [...r]);
  ell(g, 8, 8.5, 6.4, 5, '2');
  ell(g, 8, 8.5, 5.4, 4.1, '1');
  ell(g, 8.3, 9, 4.4, 3.2, '.');
  for (const [x, y] of [[2, 3], [13, 4], [14, 12], [1, 13], [8, 15]]) dot(g, x, y, '3');
  return rows(g);
})();
// 石A（大きな丸い石）。秋: まわりは落ち葉・冬: 上に雪
const ground = (seed) => litter(seed).map((r) => [...r].map((c) => (c === '2' ? '1' : c)));  // 石と木の ますの地面（パレット 1・2 は 1 が土の色）
function stoneA(winter) {
  const g = winter ? snow(6).map((r) => [...r].map((c) => (c === '2' ? '1' : c))) : ground(11);
  ell(g, 9, 11, 7, 4, winter ? '1' : '.');
  ell(g, 8, 8.4, 7, 6.2, '.');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!inE(x, y, 8, 8.4, 6.2, 5.4)) continue;
    let c = '2';
    if (!inE(x, y, 7.2, 7.6, 5.6, 4.8)) c = '.';
    else if (inE(x, y, 5.4, 5.2, 2.2, 1.4)) c = '3';
    if (winter && inE(x, y, 7.6, 4.2, 6.4, 3.4) && y < 6) c = '3';
    if (winter && y === 6 && inE(x, y, 7.6, 4.2, 6.6, 3.8) && x % 3 === 1) c = '3';
    g[y][x] = c;
  }
  line(g, [[9.5, 8.5], [11, 10], [10.5, 12]], 0.45, '.');
  return rows(g);
}
// 石B（平たい石が3つ）
function stoneB(winter) {
  const g = winter ? snow(8).map((r) => [...r].map((c) => (c === '2' ? '1' : c))) : ground(13);
  const st = [[5, 5.5, 4, 3], [11, 8.5, 3.6, 2.8], [6.5, 12, 3.4, 2.4]];
  for (const [cx, cy, rx, ry] of st) ell(g, cx + 0.8, cy + 1, rx + 0.6, ry + 0.6, winter ? '1' : '.');
  for (const [cx, cy, rx, ry] of st) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!inE(x, y, cx, cy, rx, ry)) continue;
      let c = inE(x, y, cx - 0.5, cy - 0.6, rx - 0.7, ry - 0.7) ? '2' : (winter && y < cy ? '2' : '.');
      if (inE(x, y, cx - rx * 0.4, cy - ry * 0.45, rx * 0.35, ry * 0.3)) c = '3';
      if (winter && y < cy - 0.2 && inE(x, y, cx, cy - 0.5, rx - 0.3, ry - 0.3)) c = '3';
      g[y][x] = c;
    }
  }
  return rows(g);
}
// 切り株（パレット 2）: 上の年輪の面と、木の皮
function stump(winter) {
  const g = cv(16, 16, winter ? '2' : '1');
  if (!winter) { const L = litter(17); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g[y][x] = L[y][x] === '.' ? '.' : '1'; }
  ell(g, 9, 13.5, 7, 2.4, '.');                                    // 影と根もと
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const inBody = x >= 2 && x <= 13 && y >= 5 && y <= 13 && inE(x, y, 7.9, 9.5, 6.2, 9);
    if (inBody) g[y][x] = (x % 3 === 0 || hash(x, y, 4) < 0.15) ? '.' : '1';   // 皮のすじ

  }
  for (const [rx, x0] of [[1.5, 1], [1.5, 13.5]]) line(g, [[x0, 13], [x0 + (x0 < 5 ? -1 : 1) * rx, 15]], 0.8, '1'); // 根
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!inE(x, y, 7.9, 5.2, 6.2, 3.2)) continue;
    const r = Math.hypot((x + 0.5 - 7.9) / 6.2, (y + 0.5 - 5.2) / 3.2);
    g[y][x] = winter ? (r > 0.92 && y > 5 ? '1' : '2') : (r > 0.86 ? '1' : (Math.round(r * 5) % 2 ? '.' : '2'));
    if (!winter && r < 0.86 && hash(x, y, 8) < 0.12) g[y][x] = '3';
  }
  if (winter) for (let x = 2; x < 14; x++) if (hash(x, 1, 3) < 0.6) dot(g, x, 8, '2');  // 雪がたれる
  return rows(g);
}
// キノコ（パレット 2）: 赤いかさに白い点、白い柄。冬は かさの上に雪
function mush(winter) {
  const g = winter ? cv(16, 16, '2') : ground(19);
  const ms = [[6, 6, 5, 3.4, 6.5], [12, 10, 3, 2.2, 4]];
  for (const [cx, cy, rx, ry, st] of ms) {
    ell(g, cx + 0.5, cy + st, rx * 0.8, 1.3, '.');
    for (let y = Math.floor(cy); y < cy + st; y++) for (let x = Math.round(cx - 1.4); x <= Math.round(cx + 0.6); x++) dot(g, x, y, x === Math.round(cx + 0.6) ? '1' : '2');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!inE(x, y, cx, cy, rx, ry) || y > cy + 0.4) continue;
      let c = '3';
      if (!inE(x, y, cx, cy - 0.3, rx - 0.9, ry - 0.6)) c = '.';
      else if (inE(x, y, cx - rx * 0.45, cy - ry * 0.45, 0.9, 0.8) || inE(x, y, cx + rx * 0.3, cy - ry * 0.55, 0.8, 0.7) || inE(x, y, cx + rx * 0.05, cy - ry * 0.05, 0.7, 0.6)) c = '2';
      if (winter && y < cy - ry * 0.35) c = '2';
      g[y][x] = c;
    }
    for (let x = Math.round(cx - rx + 1); x < cx + rx - 0.5; x++) dot(g, x, Math.round(cy + 0.6), '1');
  }
  return rows(g);
}
// わかい木（忘れたドングリから芽が出た。パレット 0）。秋はカシの葉、冬は雪から小枝
function sapling(winter) {
  const g = winter ? snow(7).map((r) => [...r]) : litter(23).map((r) => [...r]);
  if (!winter) ell(g, 8, 13.5, 4.5, 2, '.');
  line(g, [[8, 14], [8, 6], [9, 3]], 0.55, winter ? '.' : '1');
  if (!winter) {
    for (const [cx, cy, a] of [[5, 6, -0.5], [11, 5.5, 0.5], [5, 10.5, -0.3], [11.5, 10, 0.3], [9, 2.5, 1.4]]) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const u = (x + 0.5 - cx) * Math.cos(a) + (y + 0.5 - cy) * Math.sin(a), v = -(x + 0.5 - cx) * Math.sin(a) + (y + 0.5 - cy) * Math.cos(a);
        if ((u / 3) ** 2 + (v / 1.7) ** 2 <= 1) g[y][x] = v > 0.7 ? '2' : '3';
      }
    }
  } else {
    line(g, [[8, 9], [5, 6]], 0.5, '.'); line(g, [[8, 7], [11, 4.5]], 0.5, '.');
    for (const [x, y] of [[5, 5], [11, 3], [9, 2]]) dot(g, x, y, '3');
    for (const [x, y] of [[5, 6], [11, 4]]) dot(g, x, y, '2');
    ell(g, 8, 14, 3, 1.2, '2');
  }
  return rows(g);
}
// 左右の大きな木の幹（パレット 2）。たてにつながる。こい みぞと茶の皮、森のがわに うすい光
function trunk(right) {
  return grid(16, 16, (x, y) => {
    const xx = right ? 15 - x : x;
    if (xx >= 14) return hash(x, y, 31) < 0.15 ? '1' : '.';
    if (xx === 13) return '.';
    const wob = Math.round(Math.sin((y + xx * 3) * 0.55) * 0.8);
    const groove = ((xx + wob + 8) % 4 === 0) || (hash(xx, y, 32) < 0.08);
    if (groove) return '.';
    return '1';
  });
}
// 下のしげみ（パレット 2）: 秋は赤と茶の葉のかたまり、冬は雪の山
function bush(k, winter) {
  const g = cv(16, 16, '.');
  if (winter) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const top = 5 + 2.5 * Math.sin((x + k * 8) * 0.4);
      g[y][x] = y < top ? (hash(x, y, k) < 0.2 ? '1' : '.') : y < top + 1.2 ? '2' : (dith(x, y, 0.15) ? '1' : '2');
    }
    line(g, [[3 + k * 7, 2], [5 + k * 7, 8]], 0.5, '1');
    return rows(g);
  }
  const blobs = [[3, 7, 4], [10, 5, 4.6], [15, 9, 3.6], [6, 13, 4], [13, 14, 3.4], [-1, 13, 3]];
  for (const [cx, cy, rr] of blobs) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d < rr) g[y][x] = d > rr - 1 && y + 0.5 > cy ? '.' : (hash(x, y, 50 + k) < 0.25 ? '.' : (x + 0.5 - cx) + (y + 0.5 - cy) < -1.5 ? '2' : (hash(x, y, 51) < 0.5 ? '3' : '1'));
  }
  return rows(g);
}
// 上の枝（パレット 2）: カシの枝と葉が上から かかる。冬は雪がつもる
function canopy(k, winter) {
  const g = cv(16, 16, '.');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = 6 + 3 * Math.sin((x + k * 9) * 0.45) + Math.sin((x + k * 4) * 1.3);
    if (y < edge) { const h = hash(x, y, 60 + k); g[y][x] = winter ? (h < 0.25 ? '1' : '.') : (h < 0.4 ? '3' : h < 0.65 ? '1' : '.'); }
    else if (y < edge + 1) g[y][x] = winter ? '2' : (hash(x, y, k) < 0.5 ? '3' : '.');
  }
  // 枝（ジェイがとまる）
  line(g, [[0, 11.5], [16, 12 + (k ? -0.5 : 0.5)]], 1.0, '1');
  for (let x = 0; x < 16; x++) { if (winter || hash(x, 1, k + 3) < 0.3) dot(g, x, 11, '2'); if (hash(x, 0, k + 3) < 0.4) dot(g, x, 13, '.'); }
  if (winter) for (let x = 0; x < 16; x++) dot(g, x, 10, hash(x, 2, k) < 0.7 ? '2' : '.');
  return rows(g);
}

// 字の段・板（パレット 3）
const blank = grid(8, 8, () => '.');
// 板: こい茶の中、ふちは外がだいだい・内がクリーム。すみは丸く
function plate(part) {
  const R = 4;
  const fx = [0, 1, 2, 0, 2, 0, 1, 2][part], fy = [0, 0, 0, 1, 1, 2, 2, 2][part];
  return grid(8, 8, (x, y) => {
    const px = fx === 0 ? x : fx === 2 ? 7 - x : 9, py = fy === 0 ? y : fy === 2 ? 7 - y : 9;
    let d;
    if (fx !== 1 && fy !== 1) d = R - Math.hypot(Math.max(0, R - px - 0.5), Math.max(0, R - py - 0.5));
    else d = Math.min(px, py) + 0.5;
    if (d < 0) return '.';
    if (d < 1) return '3';
    if (d < 2) return '2';
    if (d < 3) return '1';
    return '.';
  });
}
// 時間の棒（0〜8 ドットぬる）: 上と下はクリームのふち、中は だいだい、へったところは黒
const bar = (n) => grid(8, 8, (x, y) => (y === 1 || y === 6 ? '1' : y > 1 && y < 6 ? (x < n ? '2' : '3') : '.'));
const barL = grid(8, 8, (x, y) => (x === 7 && y > 0 && y < 7 ? '1' : '.'));
const barR = grid(8, 8, (x, y) => (x === 0 && y > 0 && y < 7 ? '1' : '.'));
const apos = grid(8, 8, (x, y) => ((x === 2 || x === 3) && y < 3 ? '1' : x === 3 && y === 3 ? '3' : (x === 3 || x === 4) && y > 0 && y < 4 && x === 4 ? '3' : '.'));

// ---------- 題の字（16×16。2 ドットの太さの線で書く） ----------
function strokes(segs, dots = []) {
  return grid(16, 16, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    for (const s of segs) for (let i = 0; i + 3 < s.length; i += 2) if (segD(px, py, s[i], s[i + 1], s[i + 2], s[i + 3])[0] < 1.05) return '1';
    for (const [cx, cy] of dots) if (Math.abs(px - cx) < 1.1 && Math.abs(py - cy) < 1.1) return '1';
    return '.';
  });
}
export const KANA = {
  RI: strokes([[4, 2.5, 4, 9.5], [11.5, 1.5, 11.5, 8.5, 10, 12, 6.5, 14.5]]),
  SU: strokes([[3, 3, 12, 3, 9.5, 8, 3, 14], [8.6, 9.2, 13.5, 14]]),
  no: strokes([[8.5, 3.5, 7, 9, 5.5, 12.5, 3.5, 12.5, 2.5, 9.5, 3.5, 5.5, 7.5, 3.2, 11.5, 4, 13.5, 7.5, 12.8, 11.5, 9, 14.2]]),
  ka: strokes([[2, 6, 10.5, 5.5, 10.5, 11.5, 8.5, 13.5], [6.5, 1.5, 4, 14.5], [12.8, 4.5, 14.5, 10]]),
  ku: strokes([[11, 1.5, 4, 8, 11, 14.5]]),
  si: strokes([[5, 1.5, 5, 11, 7, 13.5, 10, 13.5, 13.5, 10]]),
  go: strokes([[3, 4.5, 10, 4.5], [3, 11.5, 4.5, 13.5, 11.5, 13.5]], [[12.5, 1.5], [15, 2.5]]),
  to: strokes([[5, 1.5, 6.5, 7.5], [12.5, 3.5, 6, 8, 4, 10.5, 4.5, 12.8, 7.5, 14, 13.5, 13.5]]),
};

export const BG = {
  blank,
  g0: litter(1), g1: litter(2), g2: litter(3), g3: litter(4),
  w0: snow(1), w1: snow(2), w2: snow(3), w3: snow(5),
  mound, hole,
  stoneA: stoneA(false), stoneAw: stoneA(true), stoneB: stoneB(false), stoneBw: stoneB(true),
  stump: stump(false), stumpW: stump(true), mush: mush(false), mushW: mush(true),
  sap: sapling(false), sapW: sapling(true),
  trunkL: trunk(false), trunkR: trunk(true),
  bushA: bush(0, false), bushB: bush(1, false), bushAw: bush(0, true), bushBw: bush(1, true),
  canA: canopy(0, false), canB: canopy(1, false), canAw: canopy(0, true), canBw: canopy(1, true),
  p0: plate(0), p1: plate(1), p2: plate(2), p3: plate(3), p4: plate(4), p5: plate(5), p6: plate(6), p7: plate(7),
  bar0: bar(0), bar1: bar(1), bar2: bar(2), bar3: bar(3), bar4: bar(4), bar5: bar(5), bar6: bar(6), bar7: bar(7), bar8: bar(8),
  barL, barR,
};
export const APOS = apos;

// ================= スプライト =================
// リス（パレット 0: 1 黒・2 だいだい・3 クリームの腹と しっぽの ふち）右むき 16×16
//   ニホンリス: 大きな ふさふさの しっぽを背中にそわせ、耳の先に ふさ毛
function squirrel(pose) {
  const g = cv(16, 16);
  const P = {
    sit: { tail: [[3.5, 12, 2.8], [2.6, 8.5, 3], [3.2, 4.8, 2.9], [5.6, 2.6, 2.2]], body: [8.6, 11, 3.2, 3.8], head: [11.4, 6.6, 2.8, 2.5], ear: [10.6, 3.2], belly: [10.2, 11.6, 1.5, 2.7], feet: [[9.5, 14.5, 2.6, 1]], paw: [12.8, 9.4] },
    sit2: { tail: [[3.5, 12, 2.8], [2.3, 8.2, 3], [2.4, 4.3, 2.8], [4.2, 1.9, 2]], body: [8.6, 11, 3.2, 3.8], head: [11.4, 6.6, 2.8, 2.5], ear: [10.6, 3.2], belly: [10.2, 11.6, 1.5, 2.7], feet: [[9.5, 14.5, 2.6, 1]], paw: [12.8, 9.4] },
    runA: { tail: [[4.2, 9.5, 2.4], [2.8, 6.8, 2.7], [2.6, 3.6, 2.6], [4.4, 1.8, 1.8]], body: [8.6, 10.6, 4.3, 2.8], head: [12.6, 8.4, 2.6, 2.3], ear: [11.6, 5.2], belly: [9, 12.2, 2.6, 1.2], feet: [[5.5, 14, 1.5, 1.4], [12.8, 13.6, 1.4, 1.4]] },
    runB: { tail: [[4.4, 10, 2.4], [2.6, 7.6, 2.8], [2.0, 4.6, 2.5], [3.0, 2.2, 1.8]], body: [8.4, 10.2, 3.8, 3.2], head: [12.2, 7.8, 2.6, 2.3], ear: [11.2, 4.6], belly: [9, 12, 2.2, 1.4], feet: [[8.2, 14.4, 2.6, 1.2]] },
    digA: { tail: [[5.4, 7.4, 2.4], [3.6, 4.8, 2.6], [3.0, 2.4, 2.1]], body: [7.6, 10, 3.8, 3.2], head: [11.8, 11.6, 2.6, 2.4], ear: [10.6, 8.4], belly: [8.4, 12, 2, 1.4], feet: [[4.6, 14.2, 1.8, 1.2], [12.4, 14.6, 1.5, 0.9]], dirt: 0 },
    digB: { tail: [[5.4, 7.0, 2.4], [3.8, 4.2, 2.6], [3.6, 1.9, 2.0]], body: [7.6, 9.6, 3.8, 3.2], head: [12.0, 11.0, 2.6, 2.4], ear: [10.8, 7.8], belly: [8.4, 11.6, 2, 1.4], feet: [[4.6, 14.2, 1.8, 1.2], [11.0, 14.6, 1.5, 0.9]], dirt: 1 },
  }[pose];
  for (const [cx, cy, r] of P.tail) ell(g, cx, cy, r, r, 'T');
  ell(g, ...P.body, '2');
  for (const f of P.feet) ell(g, ...f, '2');
  ell(g, ...P.head, '2');
  ell(g, ...P.belly, '3');
  // しっぽ: ふちに クリームの毛（ふさふさ）、中は だいだい
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (g[y][x] !== 'T') continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (g[y + dy]?.[x + dx] ?? '.') === '.');
    g[y][x] = edge && (x + y) % 2 === 0 ? '3' : '2';
  }
  const [hx, hy, hrx] = P.head;
  dot(g, Math.round(hx + hrx - 0.6), Math.round(hy + 0.4), '3');   // 口もと
  dot(g, Math.round(hx + hrx - 1.6), Math.round(hy + 1.2), '3');
  if (P.paw) { dot(g, Math.round(P.paw[0]), Math.round(P.paw[1]), '3'); dot(g, Math.round(P.paw[0]) - 1, Math.round(P.paw[1]), '2'); }
  let o = outline(g);
  // 耳（ふさ毛は黒い先）
  const [ex, ey] = P.ear;
  const exr = Math.round(ex), eyr = Math.round(ey);
  dot(o, exr, eyr, '2'); dot(o, exr, eyr - 1, '1'); dot(o, exr + 1, eyr - 1, '1'); dot(o, exr, eyr - 2, '1');
  if (o[eyr]?.[exr - 1] === '.') dot(o, exr - 1, eyr, '1');
  if (o[eyr]?.[exr + 1] === '.') dot(o, exr + 1, eyr, '1');
  // 目（黒に光）
  const eX = Math.round(hx + 0.6), eY = Math.round(hy - 0.6);
  dot(o, eX, eY, '1'); dot(o, eX, eY + 1, '1');
  // 鼻
  dot(o, Math.round(hx + hrx), Math.round(hy), '1');
  if (P.dirt !== undefined) { const d = P.dirt ? [[14, 9], [15, 11]] : [[15, 8], [13, 7]]; for (const [x, y] of d) if (o[y][x] === '.') o[y][x] = '1'; }
  return rows(o);
}
// カケス（パレット 2: 1 黒・2 うすい ぶどう色の体・3 青い はね）右むき 16×16
//   黒い ひげの すじ、頭に ごましお、白い腰、黒い尾、はねに 青と黒の しま
function jay(pose) {
  const g = cv(16, 16);
  const fly = pose === 'flyA' || pose === 'flyB';
  const bob = pose === 'perchB' ? 1 : 0;
  ell(g, 7.8, 9.5 + (fly ? -1 : 0), 4.4, 3, '2');               // 体
  ell(g, 11.6, 6.4 + (fly ? -1 : 0) + bob * 0.3, 2.6, 2.4, '2');  // 頭
  // 尾（黒・下へ）
  if (fly) line(g, [[4, 8], [0.8, 8.6]], 1.2, 'K');
  else line(g, [[4.2, 11], [1.4, 14.6 - bob]], 1.1, 'K');
  // はね
  if (!fly) { ell(g, 7, 9.2, 3.6, 2, 'W'); }
  else if (pose === 'flyA') { line(g, [[8.5, 7.5], [5, 2], [2.5, 0.8]], 1.3, 'W'); }
  else { line(g, [[8.5, 9.5], [5, 13], [2.5, 14.6]], 1.3, 'W'); }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (g[y][x] === 'K') g[y][x] = '1';
    if (g[y][x] === 'W') g[y][x] = fly ? (((x + y) % 3) === 0 ? '1' : (x > 6 ? '3' : '1')) : (x >= 8 ? ((x % 2) ? '3' : '1') : (y < 9 ? '2' : '1'));
  }
  let o = outline(g);
  const hy = 6 + (fly ? -1 : 0);
  dot(o, 12, hy, '1');                     // 目
  dot(o, 11, hy - 2 + bob, '1'); dot(o, 10, hy - 2 + bob, '1');       // ごましお
  dot(o, 12, hy + 2, '1'); dot(o, 11, hy + 2, '1');   // ひげのすじ
  dot(o, 14, hy, '1'); dot(o, 15, hy + 1 - bob, '1');  // くちばし
  if (!fly) { dot(o, 8, 13, '1'); dot(o, 9, 13, '1'); dot(o, 8, 14, '1'); dot(o, 10, 14, '1'); } // あし
  return rows(o);
}
// ドングリ（パレット 1: 1 黒・2 茶の ぼうし・3 黄の実）8×8
const acorn = ['..1111..', '.122221.', '12121211', '.133331.', '.133331.', '.133331.', '..1331..', '...11...'];
const acornShadow = ['........', '........', '........', '........', '........', '.1.1.1..', '..1.1.1.', '........'];
// 食べられた あと（ぼうしと からが ちらばる）
const shell = ['........', '.111....', '12221.1.', '.111.131', '......1.', '..1.....', '.131.11.', '..1.1331'];
// しるし（パレット 3: 1 黒・2 灰・3 白）: 見られた！・目
const warn = ['.11111..', '1333331.', '1333331.', '.13331..', '.13331..', '.13331..', '..131...', '..111...', '........', '..111...', '.13331..', '..111...', '........', '........', '........', '........'];
const eye = ['........', '.11111..', '1333331.', '1311131.', '1333331.', '.11111..', '........', '........'];
const sparkle = ['...1....', '...3....', '.1.3.1..', '..333...', '1333331.', '..333...', '.1.3.1..', '...3....'];

export const SP = {
  sqSit: squirrel('sit'), sqSit2: squirrel('sit2'), sqRunA: squirrel('runA'), sqRunB: squirrel('runB'), sqDigA: squirrel('digA'), sqDigB: squirrel('digB'),
  jayA: jay('perchA'), jayB: jay('perchB'), jayFA: jay('flyA'), jayFB: jay('flyB'),
  acorn, acornShadow, shell, warn, eye, sparkle,
};
