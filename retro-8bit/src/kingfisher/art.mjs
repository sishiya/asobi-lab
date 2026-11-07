// カワセミ ダイブ のドット絵。1文字 = 1ドット（. = 0 すきとおり／背景の色、1・2・3 = パレットの色）。
// 光は左上から。背景は「ことばの色」（U・sky・…）で描き、data.mjs が区画のパレットの番号に直す
import { FONT } from '../font.mjs';

const grid = (w, h, f) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => f(x, y)).join(''));
export const hash = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export const dith = (x, y, a) => BAYER[y & 3][x & 3] < a * 16; // a = 0〜1 の濃さ
const segD = (px, py, x0, y0, x1, y1) => {
  const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L));
  return [Math.hypot(px - x0 - dx * t, py - y0 - dy * t), t];
};
const ell = (px, py, cx, cy, rx, ry) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;

// 形（どの点が中か）と色（中の点の色）から、ふちを黒（1）にした絵を作る
function outlined(w, h, inside, color, extra = () => null) {
  const IN = (x, y) => x >= 0 && y >= 0 && x < w && y < h && inside(x + 0.5, y + 0.5);
  return grid(w, h, (x, y) => {
    const e = extra(x + 0.5, y + 0.5);
    if (e) return e;
    if (!IN(x, y)) return '.';
    if (!IN(x - 1, y) || !IN(x + 1, y) || !IN(x, y - 1) || !IN(x, y + 1)) return '1';
    return color(x + 0.5, y + 0.5);
  });
}

// ---------- カワセミ（パレット: 1 黒・2 青・3 だいだい） ----------
// とまっている（16×24、右むき）。bob = 頭を下げて川をのぞく（カワセミは頭をふって水の中の距離をはかる）
function perch(bob) {
  const hy = 6.5 + bob, bt = bob ? [15.8, 9.6 + bob] : [15.8, 7.6];
  const head = (x, y) => ell(x, y, 8.6, hy, 4.4, 4.2);
  const beak = (x, y) => { const [d, t] = segD(x, y, 11.6, hy + 0.6, bt[0], bt[1]); return d < 1.5 - t * 1.15; };
  const body = (x, y) => ell(x - (y - 15) * -0.18, y, 7.4, 15, 4.3, 5.8);
  const tail = (x, y) => segD(x, y, 4.6, 18.5, 2.6, 23.4)[0] < 1.25;
  const inside = (x, y) => head(x, y) || body(x, y) || tail(x, y);
  return outlined(16, 24, inside, (x, y) => {
    if (head(x, y)) {
      if (Math.hypot(x - 10.4, y - (hy - 0.6)) < 0.8) return '1';                 // 目
      if (y > hy - 0.2 && y < hy + 1.7 && x > 4.8 && x < 11.6) return '3';           // 目をとおる だいだいの すじ
      if (y > hy + 2.3 && x > 7.5) return '3';                                       // のど
      return '2';                                                                    // 青い頭
    }
    if (tail(x, y) && !body(x, y)) return '2';
    // 体: せなか（左）と つばさは青、むね（右）は だいだい
    if (ell(x - (y - 15) * -0.18, y, 6.2, 14.6, 3.1, 4.6)) return (Math.floor(x * 1.3 + y * 0.7) % 4 === 0 && y > 12) ? '1' : '2'; // つばさ（羽のすじ）
    if (x < 6) return '2';
    return '3';
  }, (x, y) => {
    if (beak(x, y)) return '1';                                                       // 長い くちばし
    if (y > 20.6 && y < 23.9 && (Math.abs(x - 8.5) < 0.4 || Math.abs(x - 10.5) < 0.4)) return '3'; // 赤い足
    return null;
  });
}
// とびこむ（16×24、頭が下）。つばさを うしろへ たたみ、くちばしから まっすぐ水へ
function dive(f) {
  const body = (x, y) => ell(x, y, 8, 8.6, 4.4, 6.4);
  const head = (x, y) => ell(x, y, 8, 15.4, 4.1, 3.8);
  const beak = (x, y) => { const [d, t] = segD(x, y, 8, 18.4, 8, 23.9); return d < 1.9 - t * 1.6; };
  const wing = (x, y) => segD(x, y, 10, 6, 12.6 + f, 0.6)[0] < 1.4 || segD(x, y, 6, 6, 3.4 - f, 0.6)[0] < 1.4;
  const inside = (x, y) => body(x, y) || head(x, y) || wing(x, y);
  return outlined(16, 24, inside, (x, y) => {
    if (head(x, y) && y > 12.5) {
      if (Math.hypot(x - 9.8, y - 15.2) < 0.8) return '1';
      if (Math.abs(x - 9.6) < 1 && y > 12.5 && y < 17.5) return '3';                 // 目の すじ
      if (x < 7.2) return '3';
      return '2';
    }
    if (body(x, y) && x < 6.4 && y > 5) return '3';                                   // むね（左）
    if (body(x, y) && x > 9 && (Math.floor(y) % 3 === 0)) return '1';                 // たたんだ つばさの すじ
    return '2';
  }, (x, y) => (beak(x, y) ? '1' : null));
}
// とぶ（24×16、右むき）。up = はねを上げる。水から枝へもどる
function fly(up) {
  const body = (x, y) => ell(x, y, 11, 9.2, 6.2, 3.3);
  const head = (x, y) => ell(x, y, 17, 7.4, 3.6, 3.4);
  const beak = (x, y) => { const [d, t] = segD(x, y, 19.8, 8, 23.9, 9); return d < 1.4 - t * 1.0; };
  const tail = (x, y) => segD(x, y, 5.5, 9, 1, 10.5)[0] < 1.3;
  const wing = up ? (x, y) => { const [d, t] = segD(x, y, 12.5, 7.5, 5, 0.5); return d < 3.3 - t * 2.6 && y < 8.5; }
    : (x, y) => { const [d, t] = segD(x, y, 12.5, 9, 6.5, 15.5); return d < 3.1 - t * 2.4 && y > 8; };
  const inside = (x, y) => body(x, y) || head(x, y) || tail(x, y) || wing(x, y);
  return outlined(24, 16, inside, (x, y) => {
    if (wing(x, y)) return (Math.floor(x) + Math.floor(y)) % 4 === 0 ? '1' : '2';
    if (head(x, y)) {
      if (Math.hypot(x - 18.6, y - 6.6) < 0.8) return '1';
      if (y > 7.3 && y < 9 && x > 14) return '3';
      if (y > 9.2) return '3';
      return '2';
    }
    if (body(x, y) && y > 9.4) return '3';                                            // おなか
    return '2';
  }, (x, y) => (beak(x, y) ? '1' : null));
}

// ---------- 魚（パレット: 1 こい灰のふち・2 銀・3 白） ----------
// 右むき。len = 体の長さ、w = 絵のはば。tail = 尾をふる
function fish(w, thick, tail, stripe) {
  const tl = Math.max(2.5, w * 0.22), x0 = tl - 0.6, x1 = w - 0.4, cx = (x0 + x1) / 2, rx = (x1 - x0) / 2, cy = 4;
  const body = (x, y) => ell(x, y, cx, cy - (x > cx ? 0 : 0), rx, thick * (x > cx ? 1 : 0.62 + 0.38 * (x - x0) / rx));
  const tt = tail ? 0.8 : -0.8;
  const fin = (x, y) => x < x0 + 1.2 && x > 0 && Math.abs(y - cy - tt * (x0 + 1.2 - x) * 0.3) < (x0 + 1.2 - x) * 0.95 + 0.3;
  const inside = (x, y) => body(x, y) || fin(x, y);
  return outlined(w, 8, inside, (x, y) => {
    if (Math.hypot(x - (x1 - 2.4), y - (cy - 0.7)) < 0.75) return '1';               // 目
    if (fin(x, y) && !body(x, y)) return '2';
    if (stripe && Math.abs(y - cy - 0.2) < 0.5 && x > x0 + 2 && x < x1 - 4) return '1'; // 横の すじ
    if (y < cy) return '2';                                                           // 銀の せなか
    return '3';                                                                       // 白い はら
  });
}
// ナマズ（パレット: 1 黒・2 こげ茶の せなか・3 うすい はら）。右むき 32×16。ひらたい大きな頭・長い ひげ・長い しりびれ
function catfish(tail) {
  const body = (x, y) => { if (x < 3 || x > 30) return false; const rx = (x - 3) / 27; const half = 1.5 + 4.4 * Math.sin(Math.min(1, rx * 1.25) * Math.PI / 2) - (rx > 0.85 ? (rx - 0.85) * 12 : 0); return Math.abs(y - 9) < half; };
  const tl = (x, y) => x < 5 && x > 0.4 && Math.abs(y - 9 - (tail ? 1 : -1) * (5 - x) * 0.3) < 1.2 + (5 - x) * 0.55;
  const fin = (x, y) => x > 5 && x < 20 && y > 12 && y < 15 - (x - 5) * 0.05 && body(x, y - 2.5);
  const inside = (x, y) => body(x, y) || tl(x, y) || fin(x, y);
  return outlined(32, 16, inside, (x, y) => {
    if (Math.hypot(x - 25.5, y - 7) < 0.7) return '1';                                // 小さな目
    if (x > 27 && Math.abs(y - 10.4) < 0.5) return '1';                               // 大きな口
    if (fin(x, y) && !body(x, y)) return '2';
    if (body(x, y) && y > 10.5) return '3';                                            // うすい はら
    if (hash(Math.floor(x / 2), Math.floor(y / 2), 9) < 0.18 && y < 9) return '1';  // まだら
    return '2';
  }, (x, y) => {
    if (segD(x, y, 29.5, 9.6, 31.8, 4.5 + (tail ? 0.6 : 0))[0] < 0.45) return '1';  // 上の ひげ
    if (segD(x, y, 28.5, 11, 31.6, 15.4 - (tail ? 0.6 : 0))[0] < 0.45) return '1';  // 下の ひげ
    return null;
  });
}

// ---------- しるし（パレット: 1 白・2 水色・3 だいだい） ----------
const splash = (f) => grid(16, 8, (x, y) => {
  const drops = f ? [[2, 3], [4, 1], [8, 0.5], [12, 1], [14, 3], [6, 5], [10, 5]] : [[4, 6], [6, 3], [8, 2], [10, 3], [12, 6], [5, 7], [11, 7]];
  for (const [dx, dy] of drops) { const d = Math.hypot(x - dx, (y - dy) * 1.3); if (d < 0.9) return '1'; if (d < 1.6) return '2'; }
  if (!f && y === 7 && x > 1 && x < 15) return x % 3 ? '2' : '1';                    // 水の輪
  return '.';
});
// 点の字（白に だいだいの影）: +・数字
const pop = (rows) => shadowSp(Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => (y < 7 && x < 5 && rows[y][x] === '1') || (y < 7 && x > 0 && x < 6 && rows[y][x - 1] === '1') ? '1' : '.').join('')));
function shadowSp(rows) { return rows.map((r, y) => [...r].map((ch, x) => (ch === '.' && y > 0 && x > 0 && rows[y - 1][x - 1] === '1' ? '3' : ch)).join('')); }
const PLUS = ['00000', '00100', '00100', '11111', '00100', '00100', '00000'];
const stars = grid(16, 8, (x, y) => { for (const [cx, cy] of [[3, 3], [12, 2], [8, 6]]) { const dx = Math.abs(x - cx), dy = Math.abs(y - cy); if ((dx === 0 && dy < 2) || (dy === 0 && dx < 2)) return dx + dy === 0 ? '1' : '3'; } return '.'; });

export const SP = {
  perchA: perch(0), perchB: perch(1), diveA: dive(0), diveB: dive(1), flyA: fly(1), flyB: fly(0),
  fsA: fish(8, 2.3, 0, false), fsB: fish(8, 2.3, 1, false),
  fmA: fish(16, 2.9, 0, false), fmB: fish(16, 2.9, 1, false),
  flA: fish(24, 3.6, 0, true), flB: fish(24, 3.6, 1, true),
  catA: catfish(0), catB: catfish(1),
  splA: splash(0), splB: splash(1), stars,
  plus: pop(PLUS), n1: pop(FONT['1']), n3: pop(FONT['3']), n5: pop(FONT['5']), n0: pop(FONT['0']),
};

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
  KA: strokes([[1.5, 5, 13, 5], [13, 5, 12.5, 11.5], [12.5, 11.5, 10, 14], [7, 1.2, 6.4, 8], [6.4, 8, 2, 14.5]]),
  WA: strokes([[2.5, 3, 2.5, 8], [2.5, 3, 13.5, 3], [13.5, 3, 12.8, 8], [12.8, 8, 7, 14.5]]),
  SE: strokes([[1, 6.5, 14.5, 5], [14.5, 5, 10.5, 9.5], [5.5, 1.2, 5.5, 12], [5.5, 12, 7, 13.8], [7, 13.8, 13.5, 13.8]]),
  MI: strokes([[3.5, 2, 12, 4.2], [4, 7, 11.5, 9], [2.5, 11.5, 13.5, 14.2]]),
  DA: strokes([[6.5, 1.2, 1.8, 8.5], [5.8, 3.8, 11.5, 3.8], [11.5, 3.8, 6.5, 14.5], [4.3, 7.3, 9.6, 10.2]], [[13, 1.5], [15, 3]]),
  I: strokes([[11.5, 1.5, 1.8, 8.8], [7.8, 5.5, 7.8, 14.8]]),
  BU: strokes([[1.8, 4, 11, 4], [11, 4, 10.2, 9], [10.2, 9, 5.5, 14.5]], [[13.2, 1.5], [15, 3.4]]),
};
