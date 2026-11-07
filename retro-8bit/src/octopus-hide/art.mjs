// タコの かくれんぼ のドット絵。1文字 = 1ドット（. = 0 すきとおり／背景の色、1・2・3 = パレットの色）。
// 光は上から（海の面から）。大きな絵は 8×8 に切って使う（tools/lib.mjs の big）
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

// ---------- 背景 ----------
// パレット 0 水: 0 こい青緑 $0C・1 白 $30（光・字）・2 うすい青緑 $2C・3 青緑 $1C
// パレット 1 海の底（上）: 0 こい青緑・1 砂 $37・2 岩 $10・3 海藻 $1A
// パレット 2 字の段と題の板: 0 こい青緑・1 白・2 うすい青緑・3 黒
// パレット 3 海の底（深い所）: 0 こい青緑・1 こい砂 $17・2 こい岩 $00・3 こい海藻 $0A（28・29 行）
// 水の明るさ（0 こい青緑・1 青緑・2 うすい青緑・3 白）→ パレットの番号
const LV = ['.', '3', '2', '1'];
const shade = (x, y, v) => { const lo = Math.floor(v), f = v - lo; return LV[Math.min(3, lo + (dith(x, y, f) ? 1 : 0))]; };
// 4〜21 行の明るさ（上ほど明るい。海の面からの光）
export const WATER_V = [2.45, 2.3, 2.15, 2.05, 2.0, 2.0, 1.9, 1.72, 1.52, 1.33, 1.18, 1.06, 1.0, 0.92, 0.75, 0.55, 0.34, 0.14];
const waterRow = (i) => g8((x, y) => { const a = WATER_V[i], b = WATER_V[i + 1] ?? 0; return shade(x, y + i * 8, a + (b - a) * (y / 8)); });
// 光のゆらぎ（上の 3 行）: 白いすじの網
// const caustic = (i, s) => g8((x, y) => { const a = WATER_V[i], b = WATER_V[i + 1]; const v = a + (b - a) * (y / 8); const w = Math.sin((x + s * 3) * 0.8 + Math.sin(y * 0.9 + s) * 1.6); return w > 0.75 && hash(x, y, s + i) < 0.8 ? '1' : shade(x, y + i * 8, v); });
// ただよう粒（マリンスノー）: 同じ明るさの行に重ねる
const mote = (i, s) => g8((x, y) => { const h = hash(x, y, s); const v = WATER_V[i]; const base = shade(x, y + i * 8, v); return h < 0.03 ? '1' : h < 0.05 ? '2' : base; });
const bubble = (i) => g8((x, y) => { const d = Math.hypot(x - 3.5, y - 3.5); const base = shade(x, y + i * 8, WATER_V[i]); return d < 2.6 && d > 1.5 ? '1' : d < 1.0 && x < 4 && y < 4 ? '1' : base; });
// 字の段の下のふち（パレット 2）: こい青緑から うすい青緑へ。ここで 0 番のスプライトが当たる
const hudEdge = g8((x, y) => (y >= 6 || (y >= 4 && dith(x, y, (y - 3) / 3)) ? '2' : '.'));
// 題の板（パレット 2）: こい青緑の板に白いふち。すみは丸く、外は うすい青緑
function plate(part) {
  const R = 5;
  const fx = [0, 1, 2, 0, 2, 0, 1, 2][part], fy = [0, 0, 0, 1, 1, 2, 2, 2][part];
  return g8((x, y) => {
    const px = fx === 0 ? x : fx === 2 ? 7 - x : 9, py = fy === 0 ? y : fy === 2 ? 7 - y : 9;
    let d;
    if (fx !== 1 && fy !== 1) d = R - Math.hypot(Math.max(0, R - px - 0.5), Math.max(0, R - py - 0.5));
    else d = Math.min(px, py) + 0.5;
    if (d < 1) return '2';
    if (d < 2) return '1';
    return '.';
  });
}

// ---------- 海の底（16×64。8 行ぶん: 22・23 行 = 底より上（岩の頭・海藻）、24 行から下 = 底） ----------
// 0〜15 行め（y）は水（こい青緑）、16 から下が底。48 から下は深い所のパレット（色の番号は同じで こい色）
const SURF = 16;
// 砂: うすい砂に、さざ波の すじ（岩の灰で うすく）と、ところどころ こい粒
const sandAt = (x, y, s) => {
  const r = Math.sin(((x + s * 5) * 2 * Math.PI) / 16) * 1.1 + Math.sin(((x + s * 3) * 2 * Math.PI) / 8) * 0.4;
  const k = (y + r + 64) % 6;
  if (y < 48 && k < 1 && (x + y) % 2 === 0) return '2';           // さざ波の影
  if (hash(x, y, s + 40) < 0.025) return '.';                      // こい粒
  if (y >= 44 && y < 48 && dith(x, y, (y - 43) / 10)) return '.'; // 深い所へ
  return '1';
};
function sand(s) {
  return grid(16, 64, (x, y) => {
    const top = SURF + (Math.sin(((x + s * 4) * 2 * Math.PI) / 16) > 0.55 ? -1 : 0);
    if (y < top) return '.';
    return sandAt(x, y, s);
  });
}
// 岩: まるい石が重なる（ボロノイ）。左上が明るく、右下は こい青緑の網でかげ、すきまは こい。上は 底より 14 ドット高く盛り上がる
function rock(s) {
  const pts = (s ? [[3, 4, 5], [12, 7, 4], [6, 13, 4], [14, 18, 5], [3, 24, 4], [10, 28, 4], [15, 35, 5], [5, 38, 5], [11, 46, 4], [2, 52, 4], [9, 58, 5], [15, 60, 4]]
    : [[8, 3, 6], [2, 10, 4], [13, 12, 5], [6, 19, 5], [14, 25, 4], [3, 30, 5], [10, 36, 5], [2, 44, 4], [13, 47, 5], [7, 54, 4], [14, 60, 4], [1, 61, 4]]);
  const P = pts.flatMap(([px, py, r]) => [[px, py, r], [px - 16, py, r], [px + 16, py, r]]);
  const topY = (x) => 2 + 3 * Math.abs(Math.sin(((x + 0.5 + s * 8) * Math.PI) / 16)) * (s ? 1.3 : 1); // 石の頭のならび
  return grid(16, 64, (x, y) => {
    if (y < topY(x)) return '.';
    const px = x + 0.5, py = y + 0.5;
    const ds = P.map(([cx, cy]) => [Math.hypot(px - cx, (py - cy) * 1.1), cx, cy]).sort((a, b) => a[0] - b[0]);
    const [d1, cx, cy] = ds[0], d2 = ds[1][0];
    if (d2 - d1 < 0.9) return '.';                                  // 石と石のすきま
    if (y < topY(x) + 1.2) return '1';                              // 上に砂がのる
    const lx = (px - cx) / 5, ly = (py - cy) / 5;                    // 石の中の場所（右下ほど暗い）
    const dark = lx * 0.6 + ly * 0.8;
    if (dark > 0.55 && dith(x, y, Math.min(1, (dark - 0.55) * 2.2))) return '.';
    if (dark < -0.45 && hash(x, y, s + 3) < 0.35) return '1';        // 光の当たる所に砂の粉
    if (hash(x, y, s + 9) < 0.03) return '.';
    return '2';
  });
}
// 海藻（アマモ）: 底の砂から 細い葉が何本も上へ。ゆれて先が曲がる。根もとは こい緑がまじる
function weed(s) {
  // 葉は根もとが細く、なかほどが広い帯。先は ゆれて横へなびく
  const blades = s ? [[1.5, 0, 0.35], [5.5, 3, -0.3], [9, 1, 0.3], [13, 4, -0.2]] : [[3, 2, 0.3], [7, 0, -0.35], [11, 3, 0.25], [14.5, 1, -0.3]];
  return grid(16, 64, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    for (const [bx, tip, lean] of blades) {
      if (py < tip || py > SURF + 2) continue;
      const k = (SURF + 2 - py) / (SURF + 2 - tip);       // 0 根もと 〜 1 先
      const cx = bx + (Math.sin(k * 3.0) * 0.6 + k * k) * lean * 7;
      const w = 0.55 + Math.sin(k * Math.PI) * 0.75;
      for (const dx of [-16, 0, 16]) {
        const d = px - cx - dx;
        if (Math.abs(d) < w) return d < -w + 0.9 && k > 0.2 && k < 0.85 && (y & 1) ? '1' : '3'; // 光の当たる がわに うすいすじ
      }
    }
    if (y < SURF) return '.';
    if (y < SURF + 3 && hash(x, y, s + 11) < 0.45) return '3';  // 根もと
    return sandAt(x, y, s + 2);
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
export const KANA = {
  TA: strokes([[6.5, 1.5, 2, 8.5], [5.5, 4, 13, 4], [13, 4, 11, 9.5], [11, 9.5, 5, 14.5], [5.5, 7.5, 10.5, 10.5]]),
  KO: strokes([[3, 3.5, 13, 3.5], [13, 3.5, 13, 13], [3, 13, 13, 13]]),
  no: strokes([[8.5, 4.5, 7.5, 9], [7.5, 9, 5.5, 12.5], [5.5, 12.5, 3.5, 11.5], [3.5, 11.5, 2.5, 8.5], [2.5, 8.5, 4.5, 4.5], [4.5, 4.5, 8.5, 3], [8.5, 3, 12, 4], [12, 4, 13.5, 8], [13.5, 8, 12.5, 11.5], [12.5, 11.5, 9.5, 13.5]]),
  ka: strokes([[2, 5.5, 10, 4.5], [10, 4.5, 9.5, 10.5], [9.5, 10.5, 7.5, 12.5], [6, 1.5, 3, 14], [12.5, 4.5, 14.5, 9.5]]),
  ku: strokes([[10.5, 2, 4, 8], [4, 8, 10.5, 14]]),
  re: strokes([[4, 1.5, 4, 14.5], [1.5, 5.5, 6, 4.8], [6, 4.8, 4.2, 9], [4.2, 9, 9.5, 4.5], [9.5, 4.5, 10.5, 12.5], [10.5, 12.5, 14, 11]]),
  n: strokes([[8, 1.5, 2.5, 14], [2.5, 14, 7, 7.5], [7, 7.5, 9, 13], [9, 13, 14, 10]]),
  bo: strokes([[2.5, 2, 2.5, 14], [5.5, 4, 11, 4], [5.5, 8, 11, 8], [8.5, 2, 8.5, 12.5], [8.5, 12.5, 6.5, 11.2], [6.5, 11.2, 7.5, 14], [7.5, 14, 12.5, 13]], [[13.2, 1.6], [15, 3.4]]),
};

export const BG = {
  blank: g8(() => '.'),
  ...Object.fromEntries(WATER_V.map((_, i) => ['w' + i, waterRow(i)])),
  m40: mote(4, 1), m41: mote(4, 2), m50: mote(5, 3), m120: mote(12, 4), m121: mote(12, 5),
  bub8: bubble(8), bub12: bubble(12),
  hudEdge,
  p0: plate(0), p1: plate(1), p2: plate(2), p3: plate(3), p4: plate(4), p5: plate(5), p6: plate(6), p7: plate(7),
};
// 底の柱（種類ごとに 16×64 を 2 枚。左右の半分を順に使う）: 0 砂・1 岩・2 海藻
export const FLOOR = [[sand(0), sand(1)], [rock(0), rock(1)], [weed(0), weed(1)]];

// ---------- スプライト ----------
// タコ（横から。右むき 24×16）。パレット 0 はゲームが入れかえる: 1 黒（ふち・ひとみ）・2 体の色・3 もよう
//   kind: 0 砂（こまかい点）・1 岩（まだら）・2 海藻（たてのすじと、皮ふの とげ＝乳頭突起）・3 色をかえているとちゅう（白っぽい）
//   walk: 0 じっと・1 あるく（うでの先が入れかわる）
function octo(kind, walk) {
  const rot = (x, y, cx, cy, a) => { const c = Math.cos(a), sn = Math.sin(a); const dx = x - cx, dy = y - cy; return [dx * c + dy * sn, -dx * sn + dy * c]; };
  const mant = (x, y) => { const [u, v] = rot(x, y, 6.8, 5.0, -0.72); return Math.hypot(u / 6.6, v / 4.5) < 1; }; // 胴（うしろ上へのびた ふくろ）
  const head = (x, y) => Math.hypot((x - 12.9) / 3.3, (y - 8.9) / 2.5) < 1;                                     // 頭
  const eye = (x, y) => Math.hypot((x - 14.6) / 2.1, (y - 6.9) / 1.8) < 1;                                      // 頭の上に出た目
  // うで（2 次のベジェ）: [根もと, まがり, 先]。walk で先が入れかわる
  const A = walk
    ? [[[9, 10], [2, 13], [0.8, 9.5]], [[11, 11], [8.5, 16.8], [4.5, 15]], [[13.5, 11.2], [14, 16.8], [17.5, 15.2]], [[15.5, 10.2], [22.5, 11.5], [23.2, 7.8]]]
    : [[[9, 10], [1.5, 15], [0.6, 11]], [[11, 11], [9.5, 16.8], [6, 15.4]], [[13.5, 11.2], [15.5, 16.8], [19, 14.8]], [[15.5, 10.2], [23, 13], [22.8, 9.2]]];
  const armSeg = A.map(([p0, p1, p2]) => Array.from({ length: 12 }, (_, i) => { const t = i / 11; return [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1], t]; }));
  const arm = (x, y) => armSeg.some((pts) => pts.some(([ax, ay, t]) => Math.hypot(x - ax, y - ay) < 1.45 - t * 0.8));
  const spike = (x, y) => kind === 2 && [[2.5, 3.2], [5, 0.9], [8.3, 0.2], [11.2, 1.2], [1.2, 6.5]].some(([sx, sy]) => Math.abs(x - sx) < 0.55 && Math.abs(y - sy) < 0.9);
  const inside = (x, y) => mant(x, y) || head(x, y) || eye(x, y) || arm(x, y) || spike(x, y);
  const blot = (x, y) => Math.sin(x * 1.3 + y * 0.4) + Math.sin(y * 1.7 - x * 0.6) * 0.8 + Math.sin(x * 0.5 + y * 2.1) * 0.5; // まだら
  return grid(24, 16, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    if (!inside(px, py)) return '.';
    const body = (xx, yy) => mant(xx, yy) || head(xx, yy) || eye(xx, yy) || spike(xx, yy);
    if (!body(px, py)) return !inside(px, py + 1) || (!inside(px + 1, py) && !inside(px - 1, py)) ? '1' : !inside(px, py - 1) && hash(x, y, 2) < 0.5 ? '3' : '2'; // うで: 下のふちだけ黒
    if (!inside(px, py - 1) || !inside(px + 1, py) || !inside(px - 1, py) || !inside(px, py + 1)) return '1'; // ふち
    if (y === 7 && (x === 14 || x === 15)) return '1';                              // 横に長い ひとみ（タコの目）
    if (y >= 6 && y <= 8 && x >= 13 && x <= 16) return '3';                         // 目のまわり（明るい）
    if (kind === 0) return hash(x, y, 7) < 0.2 ? '3' : '2';
    if (kind === 1) return blot(x, y) > 0.8 ? '3' : '2';
    if (kind === 2) return Math.abs(((x * 0.9 + y * 0.45) % 3.2) - 1.6) < 0.6 ? '3' : '2';
    return hash(x, y, 4) < 0.05 ? '3' : '2';
  });
}
// サメ（横から。右むき 32×16。パレット 1: 1 黒・2 灰の背・3 白い腹）。tail = 尾をふる
function shark(tail) {
  const half = (x) => { // 体の上と下（x の位置の）
    if (x < 6 || x > 31.5) return null;
    const t = (x - 6) / 25.5;
    const th = Math.sin(Math.PI * Math.pow(t, 0.75)) * 4.2 + 0.6;
    return [8.2 - th * 1.05, 8.6 + th * 0.85];
  };
  return grid(32, 16, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    const h = half(px);
    if (h && py >= h[0] && py <= h[1]) {
      if (x === 26 && y === 7) return '1';                                         // 目
      if ((x === 20 || x === 22) && y >= 8 && y <= 10) return '1';                 // えら
      return py > 8.4 + (px > 24 ? -0.6 : 0) ? '3' : '2';                         // 白い腹・灰の背（下から見ると明るく、上から見ると暗い）
    }
    if (px > 13 && px < 19.5 && py < 5 && py > 0.5 + Math.max(0, (16 - px)) * 0.2 + Math.max(0, px - 15.5) * 1.15) return '2'; // 背びれ
    if (segD(px, py, 19, 10.5, 14.5, 14.8)[0] < 1.0) return '2';                 // 胸びれ
    const ty = tail ? 1.2 : -0.6;
    if (segD(px, py, 7, 7, 0.8, 1 + ty)[0] < 1.2 - Math.max(0, 6 - px) * 0.08) return '2'; // 尾（上の葉が長い）
    if (segD(px, py, 7, 9, 2.2, 12.5 + ty * 0.5)[0] < 0.95) return '2';
    return '.';
  });
}
// カニ 16×8（パレット 2: 1 黒・2 赤・3 うすい桃）。f = はさみを上げる
const crab = (f) => grid(16, 8, (x, y) => {
  const px = x + 0.5, py = y + 0.5;
  if (Math.hypot((px - 8) / 4.6, (py - 4.6) / 2.4) < 1) return py < 3.6 ? '3' : '2';   // こうら（上が明るい）
  if ((x === 6 || x === 9) && y === 1) return '1';                                     // 目
  if ((x === 6 || x === 9) && y === 2) return '2';
  const cy = f ? 1.5 : 2.6;
  for (const sx of [-1, 1]) {
    const cx = 8 + sx * 6;
    if (Math.hypot(px - cx, py - cy) < 1.5) return Math.hypot(px - cx, py - cy) < 0.7 ? '3' : '2'; // はさみ
    if (segD(px, py, 8 + sx * 3.5, 4.5, cx, cy + 1)[0] < 0.6) return '2';
    for (const k of [0, 1, 2]) if (segD(px, py, 8 + sx * (2 + k * 1.2), 5.5, 8 + sx * (4.2 + k * 1.3), 7.5 + (f && k === 1 ? -0.5 : 0))[0] < 0.5) return '1'; // あし
  }
  return '.';
});
// エビ 16×8（パレット 2）: まがった体に赤い帯、長いひげ。f = 尾をはねる
const shrimp = (f) => grid(16, 8, (x, y) => {
  const px = x + 0.5, py = y + 0.5;
  // 体: 頭（右）から尾（左下）へ 背をまるめる
  const pts = Array.from({ length: 10 }, (_, i) => { const t = i / 9; return [12.5 - t * 9.5, 3.4 - Math.sin(t * Math.PI) * 1.3 + t * 1.6, 1.7 - t * 0.9]; });
  for (const [cx, cy, r] of pts) if (Math.hypot(px - cx, py - cy) < r + 0.35) return x === 12 && y === 2 ? '1' : (Math.round(px) % 3 === 0 && px < 11 ? '2' : '3'); // 赤い帯
  if (segD(px, py, 13.5, 2.8, 15.8, f ? 0.3 : 1.0)[0] < 0.45 || segD(px, py, 13.8, 3.6, 15.8, 4.6)[0] < 0.4) return '2'; // ひげ
  if (segD(px, py, 3, 5, 0.5, f ? 4 : 5.4)[0] < 0.6 || segD(px, py, 3, 5.2, 1.2, f ? 7.5 : 7)[0] < 0.6) return '2';     // 尾のおうぎ
  for (const lx of [6, 8, 10]) if (segD(px, py, lx, 5, lx + (f ? 0.6 : -0.6), 7.4)[0] < 0.45) return '2';               // あし
  return '.';
});
// すみ（パレット 3 の 3 黒・1 白）16×16。f = 広がる
const ink = (f) => grid(16, 16, (x, y) => {
  const bs = f ? [[5, 6, 4.2], [10, 5, 3.8], [8, 10, 4.5], [3, 11, 2.5], [13, 11, 2.6]] : [[7, 7, 3.5], [10, 9, 3], [6, 10, 2.5]];
  const d = Math.min(...bs.map(([cx, cy, r]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r));
  if (d < -0.5) return hash(x, y, f) < 0.06 ? '.' : '3';
  if (d < 0.5) return (x + y) % 2 ? '3' : '.';
  return '.';
});
// ！（パレット 3: 1 白いふち・2 赤）8×16、ハート（2 赤・3 黒・1 白）
const warn = ['.11111..', '1222221.', '1222221.', '1222221.', '1222221.', '.12221..', '.12221..', '.12221..', '..121...', '..121...', '..111...', '........', '.11111..', '.12221..', '.12221..', '.11111..'];
const heart = ['.33.33..', '3123223.', '3222223.', '3222223.', '.32223..', '..323...', '...3....', '........'];
const heartOff = ['.11.11..', '1..1..1.', '1.....1.', '1.....1.', '.1...1..', '..1.1...', '...1....', '........'];
// 点のしるし（白い字に黒い影）
const dig = (rows) => { const g = rows.map((r) => [...r]); for (let y = 1; y < 8; y++) for (let x = 1; x < 8; x++) if (rows[y][x] === '.' && rows[y - 1][x - 1] === '1') g[y][x] = '3'; return g.map((r) => r.join('')); };
const plus = dig(['........', '..1.....', '..1.....', '11111...', '..1.....', '..1.....', '........', '........']);
const one = dig(['..1.....', '.11.....', '..1.....', '..1.....', '..1.....', '.111....', '........', '........']);
const zero = dig(['.111....', '1...1...', '1..11...', '1.1.1...', '11..1...', '.111....', '........', '........']);
const five = dig(['11111...', '1.......', '1111....', '....1...', '1...1...', '.111....', '........', '........']);
const mark = g8((x, y) => (x === 0 && y === 7 ? '3' : '.'));
// サメのかげ（底の砂に うつる。黒の網で うすく）16×8、色を変えたときの きらきら 8×8
const shadowSp = grid(16, 8, (x, y) => { const d = Math.hypot((x + 0.5 - 8) / 7.5, (y + 0.5 - 3) / 2.6); return d < 1 && (x + y) % 2 === 0 ? '3' : d < 0.6 && hash(x, y, 5) < 0.6 ? '3' : '.'; });
const spark = (f) => g8((x, y) => { const dx = Math.abs(x - 3.5), dy = Math.abs(y - 3.5); const r = f ? 2.6 : 3.6; return (dx < 0.6 && dy < r) || (dy < 0.6 && dx < r) ? '1' : !f && dx < 1.2 && dy < 1.2 ? '1' : '.'; });

export const SP = {
  mark,
  ...Object.fromEntries([0, 1, 2, 3].flatMap((k) => [0, 1].map((w) => [`oc${k}${w}`, octo(k, w)]))),
  sharkA: shark(0), sharkB: shark(1),
  crabA: crab(0), crabB: crab(1), shrA: shrimp(0), shrB: shrimp(1),
  inkA: ink(0), inkB: ink(1),
  warn, heart, heartOff, plus, one, zero, five, shadow: shadowSp, sparkA: spark(0), sparkB: spark(1),
};
