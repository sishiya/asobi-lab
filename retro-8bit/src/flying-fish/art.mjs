// とべ! トビウオ のドット絵。1文字 = 1ドット（. = 0 すきとおり／背景の色、1・2・3 = パレットの色）。
// 光は左上から。大きな絵は 8×8 に切って使う（tools/lib.mjs の big）
const grid = (w, h, f) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => f(x, y)).join(''));
const hash = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const g8 = (f) => grid(8, 8, f);
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dith = (x, y, a) => BAYER[y & 3][x & 3] < a * 16; // a = 0〜1 の濃さ
// 線分 (x0,y0)-(x1,y1) から点までの近さ
const segD = (px, py, x0, y0, x1, y1) => {
  const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L));
  return [Math.hypot(px - x0 - dx * t, py - y0 - dy * t), t];
};

// ---------- 背景 ----------
// パレット 0 空: 0 こい藍（使わない）・1 白・2 空・3 うすい空
// パレット 1 波: 0 こい藍・1 白い波がしら・2 うすい空・3 海
// パレット 2 海: 0 こい藍（深い海）・1 海・2 光の筋・3 あわ
// パレット 3 字と深い海: 0 こい藍・1 白・2 空・3 黒（字の影）
const sky = g8(() => '2');
const horizon = (a) => g8((x, y) => (dith(x, y, a * (0.6 + y / 16)) ? '3' : '2')); // 下ほどうすく（水平線の空）
// 雲（32×16）: もこもこの丸を重ね、上が白・下のふちはうすい空の影
function cloud(seed, w) {
  const bs = Array.from({ length: 6 }, (_, i) => ({ x: 5 + (i / 5) * (w - 10) + (hash(i, 1, seed) - 0.5) * 4, y: 9 - Math.sin((i / 5) * Math.PI) * 3.2 + hash(i, 2, seed), r: 3 + Math.sin((i / 5) * Math.PI) * 2.4 }));
  const on = (x, y) => y < 14 && bs.some((b) => Math.hypot(x - b.x, (y - b.y) * 1.15) < b.r);
  return grid(w, 16, (x, y) => {
    if (!on(x, y)) return '2';
    if (!on(x, y + 2) || y > 11) return '3';                  // 下のふちの影
    if (!on(x, y + 3) && (x + y) % 2) return '3';
    return '1';
  });
}
// 波（16 ドットで 1 つの波）: 上はうすい空、白い波がしら、下は海。kind 1 は波がしらが大きい
function wave(kind) {
  const ph = kind * 1.7;
  return grid(16, 8, (x, y) => {
    const yw = 3.6 + 1.3 * Math.sin((2 * Math.PI * x) / 16 + ph);
    const c = Math.cos((2 * Math.PI * x) / 16 + ph);
    if (y < yw - 0.6) return '2';
    if (y < yw + 0.6) return c > -0.2 || kind ? '1' : '3';                  // のぼり坂のがわに泡
    if (kind && y < yw + 1.6 && c > 0.5) return '1';
    if (y > yw + 2.2 && y < yw + 3.2 && hash(x, y, kind + 5) < 0.35) return '2'; // 波の下のきらめき
    return '3';
  });
}
// 海の中（パレット 2）: 光の筋（ななめ。上の段ほど濃い）と、深くなるにつれ こい藍へ
const water = g8(() => '1');
// 深さで こい藍へ
const fade = (k) => g8((x, y) => (dith(x, y + 8 * k, Math.min(1, (y + 8 * k) / 44)) ? '.' : '1')); // 空の水平線と同じ網。16〜21 行の 6 行で こい藍へ
const bubble = g8((x, y) => { const d = Math.hypot(x - 3.5, y - 3.5); return d < 1.2 ? '3' : d < 1.9 && x + y < 7 ? '3' : '1'; });
// 深い海（パレット 3）: マリンスノー（うすい空と白の小さな点）
const snow = (s) => g8((x, y) => { const h = hash(x, y, s); return h < 0.025 ? '2' : h < 0.035 ? '1' : '.'; });
// 字の段の下のふち（パレット 3）: こい藍から空へ。ここで 0 番のスプライトが当たり、下だけ横に流す
const hudEdge = g8((x, y) => (y >= 6 || (y >= 4 && dith(x, y, (y - 3) / 3)) ? '2' : '.'));
// 題の板（パレット 3）: こい藍の板に白いふち。すみは丸く、外は空
function plate(part) {
  const R = 5;
  const fx = [0, 1, 2, 0, 2, 0, 1, 2][part], fy = [0, 0, 0, 1, 1, 2, 2, 2][part];
  return g8((x, y) => {
    const px = fx === 0 ? x : fx === 2 ? 7 - x : 9, py = fy === 0 ? y : fy === 2 ? 7 - y : 9; // すみからの近さ
    let d;
    if (fx !== 1 && fy !== 1) d = R - Math.hypot(Math.max(0, R - px - 0.5), Math.max(0, R - py - 0.5));
    else d = Math.min(px, py) + 0.5;
    if (d < 1) return '2';
    if (d < 2) return '1';
    return '.';
  });
}

// ---------- 題の字（16×16。2 ドットの太さの線で書く） ----------
function strokes(segs, dots = []) {
  return grid(16, 16, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    for (const s of segs) if (segD(px, py, ...s)[0] < 1.05) return '1';
    for (const [cx, cy] of dots) if (Math.abs(px - cx) < 1.1 && Math.abs(py - cy) < 1.1) return '1';
    return '.';
  });
}
export const KANA = {
  hto: strokes([[5, 1.5, 6.5, 7.5], [12.5, 3.5, 6, 8], [6, 8, 4, 10.5], [4, 10.5, 4.5, 12.8], [4.5, 12.8, 7.5, 14], [7.5, 14, 13.5, 13.5]]),
  hbe: strokes([[1.5, 10, 5.5, 5], [5.5, 5, 14, 12.5]], [[11.5, 2.5], [14, 3.5]]),
  ex: strokes([[7.5, 1.5, 7.5, 9.5]], [[7.5, 13]]),
  TO: strokes([[6, 1, 6, 14.5], [6.5, 6, 12, 9.5]]),
  BI: strokes([[3.5, 2, 3.5, 12.5], [3.5, 12.5, 12.5, 12.5], [4, 7.5, 11, 5.5]], [[12, 2], [14.5, 3]]),
  U: strokes([[8, 0.5, 8, 3.5], [2.5, 4.5, 2.5, 8], [2.5, 4.5, 13, 4.5], [13, 4.5, 12, 9.5], [12, 9.5, 6.5, 14.5]]),
  O: strokes([[2, 5.5, 14, 5.5], [9.5, 1, 9.5, 14.5], [9.5, 14.5, 7, 13], [8.5, 6.5, 2.5, 12.5]]),
};

export const BG = {
  blank: g8(() => '.'),
  sky, h1: horizon(0.25), h2: horizon(0.5), h3: horizon(0.8),
  cloudA: cloud(3, 32), cloudB: cloud(8, 32),
  waveA: wave(0), waveB: wave(1),
  water, fade0: fade(0), fade1: fade(1), fade2: fade(2), fade3: fade(3), fade4: fade(4), fade5: fade(5), bubble,
  snow0: snow(1), snow1: snow(2), snow2: snow(3),
  hudEdge,
  p0: plate(0), p1: plate(1), p2: plate(2), p3: plate(3), p4: plate(4), p5: plate(5), p6: plate(6), p7: plate(7),
};

// ---------- スプライト ----------
// トビウオ（パレット 0: 1 黒・2 青い背・3 銀の腹とひれ）。右むき 24×16。swim = ひれをたたむ・glide = 大きな胸びれを広げる
//   胸びれは体の長さの 2/3 ほど。尾の下の葉が長い（トビウオは尾の下の葉で水をたたいて飛び立つ）
function fish(glide) {
  const body = (x, y) => { const dx = (x + 0.5 - 12.5) / 9.2, dy = (y + 0.5 - 9) / (x > 12 ? 3.0 - (x - 12) * 0.12 : 2.8 - (12 - x) * 0.1); return dx * dx + dy * dy <= 1; };
  return grid(24, 16, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    if (body(x, y)) {
      if (!body(x, y - 1) || !body(x + 1, y) || !body(x, y + 1)) return '1';  // ふち
      if (x === 18 && y === 8) return '1';                                     // 目
      if (x === 17 && y === 7) return '3';                                     // 目の光
      if (py < 9.2) return '2';                                                // 青い背
      return '3';                                                              // 銀の腹
    }
    if (segD(px, py, 3.8, 9, 0.6, 5.4)[0] < 0.8 || segD(px, py, 3.8, 9.2, 0.4, 14.6)[0] < 0.85) return '2'; // 尾
    if (glide) {
      // 胸びれ: 肩から後ろ上へ大きく。まくは白、すじは青、ふちは黒
      const inW = (xx, yy) => yy < 7.2 && yy > 1 + (xx - 4) * 0.12 && xx > 4 + (7 - yy) * 0.9 && xx < 16 - (7 - yy) * 0.55;
      if (inW(px, py)) return !inW(px, py - 1) ? '1' : ((px * 0.8 + py) % 3 < 0.9 ? '3' : '2'); // 胸びれは暗くすきとおる（青）に白いすじ
      if (segD(px, py, 9, 11.5, 5, 14.5)[0] < 0.7) return '3';                // 腹びれ
    } else if (y === 8 && x >= 7 && x <= 14) return '3';                     // たたんだ胸びれ
    return '.';
  });
}
// キハダ（マグロ。パレット 1: 1 黒い背・2 灰の腹・3 黄の帯とひれ）。右むき 32×16（トビウオより大きい）。tail = 尾をふる
//   サメに見えないよう、背びれは低く、体の横に黄の帯、尾のがわに小さな黄のひれが並ぶ
function tuna(tail) {
  const body = (x, y) => { const dx = (x + 0.5 - 18) / 13, dy = (y + 0.5 - 8.5) / (5.4 - Math.max(0, 18 - x - 0.5) * 0.17); return dx * dx + dy * dy <= 1 && x >= 6; };
  return grid(32, 16, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    if (body(x, y)) {
      if ((x === 25 || x === 26) && (y === 6 || y === 7)) return x === 26 && y === 7 ? '1' : '2'; // 目（灰の輪に黒い瞳）
      if (x >= 28 && y === 9) return '1';                           // 口
      if (y === 8 && x > 8 && x < 26) return '3';                   // 黄の帯
      if (py < 8.5) return '1';                                     // 黒い背
      return '2';
    }
    const ty = tail ? 1.5 : 0;
    if (segD(px, py, 6.5, 8.5, 1, 2 + ty)[0] < 0.9 || segD(px, py, 6.5, 8.5, 1, 15 + ty * 0.3)[0] < 0.9) return '1'; // 三日月の尾
    for (const fx of [7.5, 9.5, 11.5, 13.5, 15.5]) {                // 小さな黄のひれ
      const t = (fx - 7.5) / 8;
      if (Math.abs(px - fx) < 0.6 && (Math.abs(py - (3.6 - t * 0.6)) < 1.1 || Math.abs(py - (13.4 + t * 0.6)) < 1.1)) return '3';
    }
    if (segD(px, py, 19, 3.4, 16.5, 2.6)[0] < 0.75) return '1';     // 低い背びれ
    if (segD(px, py, 22, 10.5, 18, 12.5)[0] < 0.7) return '3';      // 胸びれ
    return '.';
  });
}
// グンカンドリ（パレット 2: 1 黒・2 灰のくちばしと はねの光・3 赤いのど袋）。右むき 24×16。up = はねを上げる
function bird(up) {
  const elbow = up ? [12, 4.5] : [12, 11], tip = up ? [3, 3] : [3, 12.5];
  return grid(24, 16, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    if (Math.hypot((px - 17.3) / 2.3, (py - 10.3) / 2.0) < 1) return '3';                     // のど袋
    if (Math.hypot((px - 12.5) / 5.8, (py - 8.6) / 2.1) < 1) return '1';                     // 胴
    if (Math.hypot(px - 18.5, py - 7.8) < 1.7) return px > 19 && py < 7.5 ? '2' : '1';       // 頭
    if (segD(px, py, 19.5, 7.6, 22.5, 8.2)[0] < 0.6) return '2';                              // 長いくちばし
    if (Math.abs(px - 22.5) < 0.6 && Math.abs(py - 9) < 0.7) return '2';                      // かぎの先
    if (segD(px, py, 8, 8.4, 2.5, 6.8)[0] < 0.55 || segD(px, py, 8, 8.8, 2.5, 11)[0] < 0.55) return '1'; // ふたまたの尾
    // はね: ほそ長く、とちゅうで折れる
    const [d1, t1] = segD(px, py, 13.5, 8.2, elbow[0], elbow[1]);
    if (d1 < 3.2 - t1 * 0.8) return segD(px, py, 13.5, 8.2, elbow[0], elbow[1])[0] > 2.2 - t1 * 0.8 && py < 8.2 + (elbow[1] - 8.2) * t1 ? '2' : '1'; // 上のふちに灰
    const [d2, t2] = segD(px, py, elbow[0], elbow[1], tip[0], tip[1]);
    if (d2 < 2.6 - t2 * 1.8) return '1';
    return '.';
  });
}
// しぶき（パレット 3: 1 白・2 うすい空）16×8。f = 0 立ち上がり・1 落ちる
const splash = (f) => grid(16, 8, (x, y) => {
  const drops = f ? [[2, 4], [5, 2], [8, 1], [11, 2], [14, 4], [7, 6], [10, 6]] : [[3, 5], [6, 3], [8, 5], [10, 3], [13, 5], [5, 7], [11, 7]];
  for (const [dx, dy] of drops) { const d = Math.hypot(x - dx, (y - dy) * 1.3); if (d < 0.9) return '1'; if (d < 1.5 && x + y < dx + dy) return '2'; }
  return '.';
});
// しるし: ！（パレット 3 の 3 だいだい・1 白）、ハート（パレット 2: 3 赤・1 黒・2 灰）
const warn = ['.11111..', '1333331.', '1333331.', '1333331.', '1333331.', '.13331..', '.13331..', '.13331..', '..131...', '..131...', '..111...', '........', '.11111..', '.13331..', '.13331..', '.11111..']; // 8×16 の太い！（白いふち）
const heart = ['.11.11..', '1321331.', '1333331.', '1333331.', '.13331..', '..131...', '...1....', '........'];
const heartOff = ['.22.22..', '2..2..2.', '2.....2.', '2.....2.', '.2...2..', '..2.2...', '...2....', '........'];
// 0 番のスプライト（字の段の下のふちに当てる 1 ドット。背景のうしろに置くので見えない）
const mark = g8((x, y) => (x === 0 && y === 7 ? '3' : '.'));

export const SP = {
  mark, fishS: fish(false), fishG: fish(true), tunaA: tuna(0), tunaB: tuna(1), birdA: bird(1), birdB: bird(0),
  splA: splash(0), splB: splash(1), warn, heart, heartOff,
};
