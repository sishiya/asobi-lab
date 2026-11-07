// うて! テッポウウオ のドット絵。1文字 = 1ドット（. = 0 すきとおり／背景の色、1・2・3 = パレットの色）。
// 背景は「色の番号の大きな絵」（256×240）を描いて、data.mjs が 16×16 ごとにパレットを決めて 8×8 に切る。光は左上から
const grid = (w, h, f) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => f(x, y)).join(''));
const hash = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dith = (x, y, a) => BAYER[y & 3][x & 3] < a * 16;
const segD = (px, py, x0, y0, x1, y1) => {
  const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L));
  return [Math.hypot(px - x0 - dx * t, py - y0 - dy * t), t];
};
export const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));

// ---------- 背景の色（NES の色の番号） ----------
export const C = { U: 0x0c, SKY: 0x38, LF: 0x1a, LD: 0x0a, BK: 0x17, BD: 0x07, SF: 0x2c, WT: 0x1c, W: 0x30, G2: 0x2a, K: 0x0f };
// 背景のパレット（0 番はどれも U）: 0 葉・1 枝と幹・2 水・3 字
export const BG_PALS = [[C.U, C.SKY, C.LF, C.LD], [C.U, C.SKY, C.BK, C.BD], [C.U, C.SF, C.WT, C.BK], [C.U, C.W, C.G2, C.K]];
export const SURF = 128;     // 水の面の y
// 枝: 上のふちの y（字の行のさかい目にそろえる）・左右のはし・幹のがわ（0 左・1 右）
export const BRANCHES = [
  { y: 56, x0: 156, x1: 240, side: 1 },   // D 高い
  { y: 72, x0: 16, x1: 150, side: 0 },    // A
  { y: 96, x0: 112, x1: 240, side: 1 },   // B
  { y: 112, x0: 16, x1: 132, side: 0 },   // C 低い
];
// 虫がとまる所（16 幅の絵の左の x・枝・向き 0 右・1 左）。低い順（はじめは低い所だけ）
export const PERCHES = [
  [48, 3, 0], [88, 3, 1], [176, 2, 1], [144, 2, 0], [208, 2, 1], [32, 1, 0], [72, 1, 1], [112, 1, 0], [184, 0, 0], [216, 0, 1], [128, 3, 1],
].map(([x, b, f]) => ({ x, y: BRANCHES[b].y - 8, f }));
PERCHES.splice(10, 1); // 低い枝のはしは細すぎるので使わない

export function scene() {
  const px = new Uint8Array(256 * 240).fill(C.U);
  const set = (x, y, c) => { if (x >= 0 && x < 256 && y >= 0 && y < 240) px[y * 256 + x] = c; };
  const get = (x, y) => px[y * 256 + x];
  // 空（字の段の下から水の面まで）。上は葉のかげで少し暗い網
  for (let y = 24; y < SURF; y++) for (let x = 0; x < 256; x++) set(x, y, C.SKY);
  // 幹（左右）: 縦のすじの木の皮。左はしは暗い
  const trunk = (xa, xb, s) => {
    for (let y = 24; y < SURF; y++) for (let x = xa; x <= xb; x++) {
      const e = x === xa || x === xb, k = (x - xa) % 5;
      set(x, y, e ? C.BD : k === 0 || (k === 3 && (y >> 3) % 2) ? C.BD : C.BK);
    }
  };
  trunk(0, 13, 0); trunk(242, 255, 1);
  // 枝: 根もとは太く、先は細い。上は明るい皮・下は暗い皮・ふしは 16 ドットごと
  for (const b of BRANCHES) {
    const len = b.x1 - b.x0;
    for (let x = b.x0; x <= b.x1; x++) {
      const t = b.side ? (b.x1 - x) / len : (x - b.x0) / len;   // 幹から 0 → 先 1
      const th = t < 0.45 ? 6 : t < 0.8 ? 5 : 4;
      for (let k = 0; k < th; k++) {
        const y = b.y + k;
        let c = k >= th - 2 ? C.BD : C.BK;
        if (k === 2 && (x & 15) >= 3 && (x & 15) <= 7) c = C.BD;   // 木の皮のすじ
        if (k === 1 && (x & 15) >= 11 && (x & 15) <= 13) c = C.BD;
        set(x, y, c);
      }
      // 先は丸く
    }
    const tip = b.side ? b.x0 : b.x1;
    for (let k = 0; k < 4; k++) set(tip, b.y + k, k === 0 || k === 3 ? C.SKY : C.BD);
    // 小さな枝分かれ（先の近くで上へ）
    const bx = b.side ? b.x0 + 14 : b.x1 - 14;
    for (let k = 1; k < 7; k++) { set(bx + (b.side ? -k >> 1 : k >> 1), b.y - k, C.BD); }
  }
  // 支柱根（タコの足のような根）: 幹から弧をえがいて水へ。水の中は暗くかすむ
  const roots = [[13, 88, 46], [10, 106, 66], [242, 84, 206], [244, 100, 186]];
  for (const [sx, sy, ex] of roots) {
    for (let i = 0; i <= 160; i++) {
      const t = i / 160, u = 1 - t;
      const x = u * u * sx + 2 * u * t * ex + t * t * ex, y = u * u * sy + 2 * u * t * (sy - 14) + t * t * 236;
      const xi = Math.round(x), yi = Math.round(y);
      for (let k = -1; k <= 1; k++) {
        const xx = xi + k;
        if (yi < SURF) set(xx, yi, k === 1 ? C.BD : C.BK);
        else if (yi < 176) { if (!dith(xx, yi, Math.max(0, (yi - 146) / 30))) set(xx, yi, k === 1 ? C.U : C.BK); }
      }
    }
  }
  // 水: 面は明るい線、下ほど こい色へ（208 で 0 番）。底は黒い どろ
  for (let y = SURF; y < 240; y++) for (let x = 0; x < 256; x++) {
    if ((get(x, y) === C.BK || get(x, y) === C.K) && y > SURF + 2) continue;           // 根
    let c;
    if (y === SURF) c = C.SF;
    else if (y < SURF + 3) c = (x + (y - SURF) * 5) % 16 < 4 ? C.SF : C.WT;
    else if (y < SURF + 10) c = dith(x, y, 0.12 * (SURF + 10 - y) / 7) ? C.SF : C.WT;
    else if (y < 208) c = dith(x, y, Math.max(0, (y - 176) / 32)) ? C.U : C.WT;
    else c = C.U;
    const mud = 229 + 3 * Math.sin((2 * Math.PI * x) / 32) + 1.5 * Math.sin((2 * Math.PI * x) / 16 + 1);
    if (y > mud) c = C.K;
    set(x, y, c);
  }
  // 面に映る根のかげ・きらめき
  // 葉のしげみ（上）: だ円の葉を重ねる。下のふちはゆれる。上の明るい葉・下の暗い葉・すきまは こい色
  const cb = (x) => 41 + 4 * Math.sin((2 * Math.PI * x) / 32 + 0.4);
  const leaves = [];
  for (let j = 0; j < 6; j++) for (let i = -1; i < 18; i++) {
    const cx = i * 16 + (j % 2) * 8 + (hash(i & 1, j, 1) - 0.5) * 5, cy = 22 + j * 5 + (hash(i & 1, j, 2) - 0.5) * 2;
    leaves.push({ cx, cy, rx: 7 + hash(i & 1, j, 3) * 2, ry: 3.3, tilt: (hash(i & 1, j, 4) - 0.5) * 0.5 });
  }
  for (let y = 24; y < 52; y++) for (let x = 0; x < 256; x++) {
    let col = -1;
    for (const L of leaves) {
      if (L.cy - y > 6 || y - L.cy > 6) continue;
      for (const ox of [0, 256, -256]) {
        const dx = x + 0.5 - L.cx - ox, dy = y + 0.5 - L.cy - dx * L.tilt;
        const d = (dx / L.rx) ** 2 + (dy / L.ry) ** 2;
        if (d < 1) col = d > 0.72 && dy > 0 ? C.U : dy < -0.8 && dx < L.rx * 0.4 ? C.LF : (Math.abs(dy - dx * 0.1) < 0.5 && Math.abs(dx) < L.rx - 2 ? C.LF : C.LD);
      }
    }
    if (y > cb(x)) { if (col >= 0 && y < cb(x) + 3) set(x, y, col); continue; }
    set(x, y, col < 0 ? C.U : col);
  }
  return px;
}

// ---------- 題の字（16×16。2 ドットの太さの線で書く） ----------
function strokes(segs, dots = [], rings = []) {
  return grid(16, 16, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    for (const s of segs) if (segD(px, py, ...s)[0] < 1.05) return '1';
    for (const [cx, cy] of dots) if (Math.abs(px - cx) < 1.1 && Math.abs(py - cy) < 1.1) return '1';
    for (const [cx, cy, r] of rings) if (Math.abs(Math.hypot(px - cx, py - cy) - r) < 0.75) return '1';
    return '.';
  });
}
export const KANA = {
  hu: strokes([[6, 1.5, 10.5, 2.5], [3.5, 7, 9, 5.2], [9, 5.2, 12.5, 7], [12.5, 7, 12.5, 9.5], [12.5, 9.5, 6, 14.5]]),
  hte: strokes([[1.5, 4.5, 14, 3], [14, 3, 8, 7], [8, 7, 6.5, 10.5], [6.5, 10.5, 8, 13.5], [8, 13.5, 12, 14.3]]),
  ex: strokes([[7.5, 1.5, 7.5, 9.5]], [[7.5, 13]]),
  TE: strokes([[3.5, 2.5, 12.5, 2.5], [1.5, 6.5, 14.5, 6.5], [8, 6.5, 8, 10], [8, 10, 5, 14.5]]),
  tsu: strokes([[3.5, 7.5, 4.5, 10], [7, 7, 8, 9.5], [12.5, 7, 11, 11.5], [11, 11.5, 6.5, 14.5]]),
  PO: strokes([[1.5, 6, 12.5, 6], [7, 2, 7, 14.5], [7, 14.5, 5.5, 13.5], [4.5, 9, 2, 12.5], [9.5, 9, 12, 12.5]], [], [[13, 2.6, 1.9]]),
  U: strokes([[8, 0.5, 8, 3.5], [2.5, 4.5, 2.5, 8], [2.5, 4.5, 13, 4.5], [13, 4.5, 12, 9.5], [12, 9.5, 6.5, 14.5]]),
  O: strokes([[2, 5.5, 14, 5.5], [9.5, 1, 9.5, 14.5], [9.5, 14.5, 7, 13], [8.5, 6.5, 2.5, 12.5]]),
};
// 題の板（パレット 3）: こい色の板に白いふち。すみは丸い
export function plate(part) {
  const R = 5;
  const fx = [0, 1, 2, 0, 2, 0, 1, 2][part], fy = [0, 0, 0, 1, 1, 2, 2, 2][part];
  return grid(8, 8, (x, y) => {
    const px = fx === 0 ? x : fx === 2 ? 7 - x : 9, py = fy === 0 ? y : fy === 2 ? 7 - y : 9;
    let d;
    if (fx !== 1 && fy !== 1) d = R - Math.hypot(Math.max(0, R - px - 0.5), Math.max(0, R - py - 0.5));
    else d = Math.min(px, py) + 0.5;
    if (d < 1) return '2';
    if (d < 2) return '1';
    return '.';
  });
}
// 深い水の小さなつぶ（パレット 3）
export const speck = (s) => grid(8, 8, (x, y) => { const h = hash(x, y, s); return h < 0.02 ? '2' : h < 0.03 ? '1' : '.'; });
// 矢印の字（5×7 を 8×8 に。影は lib の shadow がつける）
export const ARROW = {
  '←': ['........', '..1.....', '.11.....', '1111111.', '.11.....', '..1.....', '........', '........'],
  '→': ['........', '....1...', '....11..', '1111111.', '....11..', '....1...', '........', '........'],
};

// ---------- スプライト ----------
// テッポウウオ（パレット 0: 1 黒・2 灰・3 白）。右むき 24×16。背中はまっすぐ（水の面のすぐ下を泳ぐ）、
//   大きな目は前の上・とがった口は上むき・背びれと しりびれは うしろ・背に黒い帯が 4 本
function archer(pose) { // 0 泳ぐ・1 尾をふる・2 水を吹く（口をあけて しぶき）
  // 列ごとの 体の上と下（ふちをふくむ）。背はまっすぐ、口はとがって上むき、腹は深い
  const TOP = { 4: 5, 5: 4 }, BOT = { 4: 9, 5: 10, 6: 11, 7: 12, 8: 12, 15: 12, 16: 12, 17: 11, 18: 10, 19: 9, 20: 8, 21: 7, 22: 6, 23: 5 };
  for (let x = 6; x <= 23; x++) TOP[x] = x <= 20 ? 3 : x <= 22 ? 4 : 5;
  for (let x = 9; x <= 14; x++) BOT[x] = 13;
  const inB = (x, y) => TOP[x] !== undefined && y >= TOP[x] && y <= BOT[x];
  const sh = pose === 1 ? 1 : 0;                                     // 尾をふる
  const tail = { 0: [3 + sh, 12 - sh], 1: [3 + sh, 12], 2: [4, 11], 3: [5, 10] };
  const inT = (x, y) => tail[x] && y >= tail[x][0] && y <= tail[x][1];
  const dors = { 6: [2, 2], 7: [1, 2], 8: [1, 2], 9: [1, 2], 10: [2, 2] };   // 背びれ（うしろ寄り）
  const anal = { 5: [11, 12], 6: [12, 13], 7: [13, 14], 8: [13, 14], 9: [14, 14], 10: [14, 14] }; // しりびれ
  const inF = (m, x, y) => m[x] && y >= m[x][0] && y <= m[x][1];
  return grid(24, 16, (x, y) => {
    if (inB(x, y)) {
      if (!inB(x, y - 1) || !inB(x, y + 1) || !inB(x - 1, y) || !inB(x + 1, y)) {
        if (x <= 5 && inT(x - 1, y)) return '2';
        return '1';
      }
      if ((x === 19 || x === 20) && (y === 4 || y === 5)) return x === 19 && y === 4 ? '3' : '1'; // 大きな目
      if (pose === 2 ? (y === 5 && x >= 21) : (y === 6 && x >= 21)) return '1';                  // 口
      // 背の黒い帯（くさびの形。下ほど細い）
      for (const [bx, d] of [[7, 7], [10, 8], [13, 8], [16, 7]]) if ((x === bx || (x === bx + 1 && y < d - 1)) && y <= d) return '1';
      if (y === 4) return '2';                                         // 背は少し暗い
      if ((x === 16 || x === 17) && y === 9) return '2';               // 胸びれ
      if (y >= BOT[x] - 1 && x >= 8 && x <= 16) return '2';            // 腹の下の かげ
      return '3';
    }
    if (inT(x, y)) return y === tail[x][0] || y === tail[x][1] || x === 0 ? '1' : ((y + x) % 3 === 0 ? '1' : '2');
    if (inF(dors, x, y) || inF(anal, x, y)) return (inF(dors, x, y) && y === dors[x][0]) || (inF(anal, x, y) && y === anal[x][1]) ? '1' : '2';
    if (pose === 2 && ((x === 23 && y === 3) || (x === 22 && y === 1) || (x === 23 && y === 0))) return '3'; // 口からの しぶき
    return '.';
  });
}
// ほかの魚（パレット 3 の 1 黒いかげ）。右むき 24×8。tail = 尾をふる。二またの尾・とがった頭
const rival = (tail) => grid(24, 8, (x, y) => {
  const px = x + 0.5, py = y + 0.5;
  if (((px - 14) / 9.6) ** 2 + ((py - 4.3) / 2.7) ** 2 < 1) return '1';
  const ty = tail ? 0.8 : -0.4;
  if (x <= 5 && (segD(px, py, 5.5, 4.2, 1, 1 + ty)[0] < 0.75 || segD(px, py, 5.5, 4.2, 1, 7.2 + ty)[0] < 0.75)) return '1';
  return '.';
});
// コオロギ（パレット 1: 1 黒・2 茶・3 うすい羽の光）。右むき 16×8。下の行が枝の上
function cricket(pose) { // 0・1 とまる（触角がゆれる）・2・3 飛ぶ（はねを広げる）
  const fly = pose >= 2;
  return grid(16, 8, (x, y) => {
    const px = x + 0.5, py = y + 0.5, by = fly ? 4.2 : 4.6;
    const inBody = ((px - 8) / 4.6) ** 2 + ((py - by) / 1.9) ** 2 < 1;
    const inHead = Math.hypot(px - 13, py - (by - 0.4)) < 1.9;
    if (inBody || inHead) {
      const edge = (xx, yy) => { const a = ((xx + 0.5 - 8) / 4.6) ** 2 + ((yy + 0.5 - by) / 1.9) ** 2 < 1, b = Math.hypot(xx + 0.5 - 13, yy + 0.5 - (by - 0.4)) < 1.9; return a || b; };
      if (!edge(x, y - 1) || !edge(x, y + 1) || !edge(x - 1, y) || !edge(x + 1, y)) return '1';
      if (x === 13 && y === Math.round(by - 1)) return '1';                          // 目
      if (!fly && y === Math.round(by - 1) && x >= 5 && x <= 10) return '3';        // 羽の光
      return '2';
    }
    if (fly) {
      if (py < 3.2 && py > 0.2 + Math.abs(px - 7) * 0.25 && x >= 3 && x <= 11) return pose === 2 ? (y === 0 ? '1' : '3') : y < 2 ? '.' : '3';
      if (segD(px, py, 6, 5.5, 3, 7.5)[0] < 0.6 || segD(px, py, 10, 5.5, 11, 7.5)[0] < 0.6) return '1';
    } else {
      if (segD(px, py, 6.5, 5, 3, 1.5)[0] < 0.75) return '2';                         // 後ろ足のもも（大きい）
      if (segD(px, py, 3, 1.5, 1, 7.5)[0] < 0.55) return '1';
      if (segD(px, py, 9, 6, 8, 7.5)[0] < 0.55 || segD(px, py, 11.5, 6, 12.5, 7.5)[0] < 0.55) return '1';
    }
    const a = pose === 1 ? 0.6 : 0;                                                  // 触角
    if (segD(px, py, 14.2, by - 1.6, 15.6, 0.3 + a)[0] < 0.5) return '1';
    if (segD(px, py, 13, by - 2, 7, 0.4 + a)[0] < 0.5) return '1';
    if (segD(px, py, 3.6, by, 1.2, by - 1)[0] < 0.5) return '1';                    // 尾の毛
    return '.';
  });
}
// ハエ（パレット 1）。右むき 8×8
function fly(pose) { // 0・1 とまる（前足をこする）・2・3 飛ぶ
  return grid(8, 8, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    if (Math.hypot(px - 6.3, py - 4.6) < 1.5) return x === 7 ? '2' : x === 6 && y === 4 ? '2' : '1'; // 頭と赤い目
    if (((px - 3.2) / 2.6) ** 2 + ((py - 5) / 1.6) ** 2 < 1) return '1';
    if (pose < 2) {
      if (y === 3 && x >= 1 && x <= 4) return '3';                                  // たたんだ はね
      if (y === 2 && x >= 1 && x <= 2) return '3';
      if (y === 7 && (x === 2 || x === 4 || x === (pose ? 6 : 7))) return '1';
    } else {
      if (pose === 2 ? (y <= 2 && x >= 2 && x <= 4 && y >= 4 - x * 0.7) : (y === 2 || y === 3) && x >= 0 && x <= 4) return '3';
    }
    return '.';
  });
}
// ハチ（パレット 2: 1 黒・2 だいだい・3 うすい はね）。右むき 16×8。しまの はら・はり
function wasp(pose) { // 0・1 とまる・2・3 飛ぶ
  const fly = pose >= 2;
  return grid(16, 8, (x, y) => {
    const px = x + 0.5, py = y + 0.5, by = fly ? 4 : 4.5;
    if (Math.hypot(px - 13.3, py - (by - 0.5)) < 1.6) return x >= 14 ? '2' : '1';          // 頭
    if (((px - 10.3) / 1.9) ** 2 + ((py - by) / 1.5) ** 2 < 1) return '1';                  // むね
    const ab = ((px - 5) / 3.9) ** 2 + ((py - by - 0.3) / 1.9) ** 2;
    if (ab < 1) return ab > 0.6 && py > by + 1 ? '1' : (x % 3 === 0 ? '1' : '2');           // しまの はら
    if (y === Math.round(by + 0.5) && x <= 1 && x >= 0) return '1';                        // はり
    if (Math.abs(px - 8.3) < 0.6 && Math.abs(py - by) < 0.6) return '1';                   // くびれ
    const wl = fly ? (pose === 2 ? 0 : 1.2) : 1.4;
    if (py < by - 1 + wl && py > 0.2 + wl && px > 6 + (by - py) * 0.3 && px < 12) return y === 0 ? '1' : '3';   // はね
    if (!fly && (segD(px, py, 9.5, 5.5, 9, 7.5)[0] < 0.5 || segD(px, py, 11, 5.5, 12, 7.5)[0] < 0.5)) return '1';
    if (fly && (segD(px, py, 9.5, 5.5, 8, 7.5)[0] < 0.5)) return '2';
    if (segD(px, py, 14.3, 2.6, 15.6, 0.4 + (pose & 1) * 0.5)[0] < 0.5) return '1';          // 触角
    return '.';
  });
}
// 水（パレット 3: 1 黒・2 水色・3 白）。jet = 水のたま（先）、stream = 細い水の すじ
const jet = grid(8, 8, (x, y) => { const d = Math.hypot(x + 0.5 - 4, (y + 0.5 - 4) * 1.1); return d < 1.6 ? '3' : d < 2.8 ? (x + y < 7 ? '3' : '2') : d < 3.4 && (x + y) % 2 ? '2' : '.'; });
const stream = (k) => grid(8, 8, (x, y) => (x === 4 ? '3' : x === 3 || x === 5 ? ((y + k) % 4 < 3 ? '2' : '.') : (x === 2 || x === 6) && hash(x, y, k + 7) < 0.15 ? '2' : '.'));
const splash = (f) => grid(16, 8, (x, y) => {
  const drops = f ? [[2, 4], [5, 2], [8, 1], [11, 2], [14, 4], [7, 6], [10, 6]] : [[4, 5], [6, 3], [8, 4], [10, 3], [12, 5], [6, 7], [10, 7]];
  for (const [dx, dy] of drops) { const d = Math.hypot(x - dx, (y - dy) * 1.3); if (d < 0.9) return '3'; if (d < 1.5 && x + y < dx + dy) return '2'; }
  return '.';
});
// 波紋（虫のまわりの輪。16×8 の下の行）
const ripple = (f) => grid(16, 8, (x, y) => {
  const r = f ? 7.2 : 5.5, d = Math.hypot((x + 0.5 - 8) / r, (y + 0.5 - 5.5) / (r * 0.28));
  return Math.abs(d - 1) < 0.16 ? (y < 5 ? '2' : '3') : '.';
});
// ！（さされた。パレット 2: 1 黒のふち・2 だいだい）
const warn = ['.11111..', '1222221.', '1222221.', '1222221.', '.12221..', '.12221..', '.12221..', '..121...', '..111...', '........', '.11111..', '.12221..', '.11111..', '........', '........', '........'];
const blank = grid(8, 8, () => '.');

const both = (name, rows, out) => { out[name] = rows; out[name + 'L'] = mirror(rows); };
export const SP = {};
SP.none = blank;
for (const [k, p] of [['fishA', 0], ['fishB', 1], ['fishC', 2]]) both(k, archer(p), SP);
for (const [k, p] of [['rvA', 0], ['rvB', 1]]) both(k, rival(p), SP);
for (let p = 0; p < 4; p++) both('cr' + p, cricket(p), SP);
for (let p = 0; p < 4; p++) both('wa' + p, wasp(p), SP);
for (let p = 0; p < 4; p++) both('fl' + p, fly(p), SP);
SP.jet = jet; SP.st0 = stream(0); SP.st1 = stream(2);
SP.splA = splash(0); SP.splB = splash(1); SP.ripA = ripple(0); SP.ripB = ripple(1);
SP.warn = warn;

// 水にうかんだ虫（あおむけで足をばたばた・まわりに輪。パレット 1 の 3 = うすい水色）16×8
const vflip = (rows) => [...rows].reverse();
function floating(kind, f) {
  const bug = kind === 'cr' ? vflip(cricket(f ? 1 : 0)) : vflip(fly(f ? 1 : 0)).map((r) => '....' + r + '....');
  const r = f ? 7.6 : 6.4;
  return bug.map((row, y) => [...row].map((ch, x) => {
    if (ch !== '.') return ch;
    const d = Math.hypot((x + 0.5 - 8) / r, (y + 0.5 - 6.5) / (r * 0.2));
    return Math.abs(d - 1) < 0.2 && y >= 5 ? '3' : '.';
  }).join(''));
}
SP.flc0 = floating('cr', 0); SP.flc1 = floating('cr', 1); SP.flf0 = floating('fl', 0); SP.flf1 = floating('fl', 1);
