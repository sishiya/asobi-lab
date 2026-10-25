// ムネエソの腹あかり: main.s などのうしろにつなぐ表と形（ビルドのときに作る）
//   sin の表・光の弱まり（深さ）・空の明るさ（時刻）・水の色（明るさ → 色）・プランクトンの深さ・ムネエソの形・発光器・ドット字

const words = (label, arr, per = 8) => [label + ':', ...chunk(arr, per).map((r) => '  .word ' + r.join(', '))];
const halves = (label, arr, per = 8) => [label + ':', ...chunk(arr, per).map((r) => '  .half ' + r.map((v) => v & 0xffff).join(', '))];
const bytes = (label, arr, per = 16) => [label + ':', ...chunk(arr, per).map((r) => '  .byte ' + r.map((v) => v & 255).join(', '))];
function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
const lerp = (a, b, t) => a + (b - a) * t;
const bgr = (r, g, b) => ((Math.round(b) & 255) << 16) | ((Math.round(g) & 255) << 8) | (Math.round(r) & 255);

// 明るさは「段」（対数）で数える: 24 段で 10 倍（手本の監修: 澄んだ外洋の青い光は 70〜75m ごとに 1/10 → 1 m で 1/3 段、深さの 1 = 4m で 4/3 段）。
// 1日（3分 = 10800 こま）の空の明るさの段。昼 300・夜（月）158（およそ 6 けた暗い）。表は 64 こまごと（169 こ → 192 に）
export const DAY = 10800;
function sky(sec) {
  const k = [[0, 300], [35, 286], [50, 236], [66, 158], [130, 158], [146, 226], [162, 284], [180, 300]];
  for (let i = 0; i + 1 < k.length; i++) if (sec <= k[i + 1][0]) return lerp(k[i][1], k[i + 1][1], (sec - k[i][0]) / (k[i + 1][0] - k[i][0]));
  return 300;
}
// 夜の月と雲のゆれ（ゆっくり）
const night = (sec) => (sec > 64 && sec < 132 ? 4 * Math.sin(sec * 0.31) + 2.5 * Math.sin(sec * 0.83) : 0);
// 腹の光の段 L → 1こまで減るエネルギー（明るさそのものに比例＝段が 24 ふえると 10 倍）
const cost = (L) => (L === 0 ? 0 : Math.min(4000, Math.round(8 * 10 ** ((L - 160) / 24) * 4)) );

// 明るさ（0〜255）→ 水の色。深い所は紺の黒、明るい所は青緑
// 中深層（200〜1000m、たそがれの海）らしく、まん中の段でも暗い青に
const PAL = [[0, [0, 1, 4]], [40, [2, 6, 18]], [100, [5, 22, 52]], [160, [12, 52, 100]], [210, [30, 96, 150]], [255, [70, 150, 196]]];
function water(I) {
  for (let i = 0; i + 1 < PAL.length; i++) if (I <= PAL[i + 1][0]) {
    const t = (I - PAL[i][0]) / (PAL[i + 1][0] - PAL[i][0]);
    return PAL[i][1].map((c, k) => lerp(c, PAL[i + 1][1][k], t));
  }
  return PAL.at(-1)[1];
}

// ムネエソ（横から見ると腹が深くふくらんだ、銀色の手斧の形）。x＝頭が +、y＝下が +、z＝厚み
const OUTLINE = [
  [48, -2], [44, 6], [36, 18], [24, 30], [6, 36], [-12, 30], [-24, 16], [-32, 6],
  [-32, -6], [-20, -14], [-12, -24], [0, -17], [16, -16], [36, -12],
];
const CENTER = [6, 6], THICK = 12; // 本物はもっとうすいが、下から見た影が読めるように少し厚く
const TAIL = [[-32, 6], [-48, 14], [-42, 0], [-48, -14], [-32, -6]];
const EYE = [[30, -8], [37, -5], [33, 1], [26, -2]];
const PHOTO = [[36, 19], [29, 26], [21, 31], [13, 34], [5, 35], [-3, 34], [-11, 30], [-18, 24]];

function fishModel() {
  const v = [], tris = [];
  const vid = (p) => { const k = p.join(); let i = v.findIndex((q) => q.join() === k); if (i < 0) { i = v.length; v.push(p); } return i; };
  const sub = (a, b) => a.map((c, i) => c - b[i]);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // side = -1 は手前（カメラの側, z が −）、+1 は奥。手前は画面で時計回り（GPU の裏の判定と同じ向き）
  const tri = (a, b, c, side, col) => {
    const P = [a, b, c].map((p) => v[p]);
    const c2 = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0]);
    if ((side < 0 && c2 < 0) || (side > 0 && c2 > 0)) [b, c] = [c, b];
    const Q = [a, b, c].map((p) => v[p]);
    let n = cross(sub(Q[1], Q[0]), sub(Q[2], Q[0]));
    if (n[2] * side < 0) n = n.map((x) => -x);
    const len = Math.hypot(...n) || 1;
    tris.push({ i: [a, b, c], n: n.map((x) => Math.round(x / len * 4096)), col });
  };
  for (const side of [-1, 1]) {
    const c = vid([CENTER[0], CENTER[1], side * THICK]);
    for (let k = 0; k < OUTLINE.length; k++) {
      const p = OUTLINE[k], q = OUTLINE[(k + 1) % OUTLINE.length];
      if (p[0] === -32 && q[0] === -32) continue; // 尾のつけ根は尾びれでふさぐ
      const my = (p[1] + q[1]) / 2;
      // 背は青みの灰、わきは銀、腹は白っぽい銀
      const col = my < -8 ? bgr(70, 86, 112) : my > 16 ? bgr(214, 222, 232) : bgr(176, 186, 204);
      tri(vid([p[0], p[1], 0]), vid([q[0], q[1], 0]), c, side, col);
    }
    // 尾びれ（うすい板。両側に1枚ずつ）
    const t = TAIL.map(([x, y]) => vid([x, y, side * 1]));
    tri(t[0], t[1], t[2], side, bgr(120, 140, 170));
    tri(t[2], t[3], t[4], side, bgr(120, 140, 170));
    tri(t[0], t[2], t[4], side, bgr(120, 140, 170));
    // 大きな目（上を向いた目。黒く光る）
    const e = EYE.map(([x, y]) => vid([x, y, side * (THICK - 2)]));
    tri(e[0], e[1], e[2], side, bgr(18, 20, 30));
    tri(e[0], e[2], e[3], side, bgr(18, 20, 30));
  }
  return { v, tris };
}

// 5×7 のドット字（上の行から。5 ビットの左が 16）
const FONT = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'], m: ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
  '^': ['00100', '01110', '11111', '00000', '00000', '00000', '00000'], v: ['00000', '00000', '00000', '00000', '11111', '01110', '00100'],
};
export const GLYPHS = '0123456789ABSTRm^v';

export function gen() {
  const out = [];
  out.push(`DAY = ${DAY}`);
  out.push('.align 4', ...words('sintab', Array.from({ length: 256 }, (_, i) => Math.round(Math.sin((i / 256) * Math.PI * 2) * 4096))));
  out.push(...halves('sky', Array.from({ length: 192 }, (_, i) => { const s = i * 64 / 60; return Math.round(sky(s) + night(s)); })));
  out.push(...halves('cost', Array.from({ length: 256 }, (_, L) => cost(L))));  // 4 倍で持つ（1こま cost/4）
  out.push('.align 4', ...words('pal', Array.from({ length: 256 }, (_, I) => bgr(...water(I)))));
  // プランクトンの出る深さ（昼は深めでまばら・夜は浅く多い。どちらも浅い所に寄る）
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const spawn = (lo, hi) => Array.from({ length: 64 }, () => Math.round(lo + (hi - lo) * rnd() ** 1.6));
  // 深さの 1 = 4m。昼は 200〜560m・夜は 100〜320m（プランクトンも昼は深く夜は浅い）
  out.push(...bytes('spawnday', spawn(50, 140)), ...bytes('spawnnight', spawn(25, 80)));
  const f = fishModel();
  out.push(`NFTRI = ${f.tris.length}`, `NPHOTO = ${PHOTO.length}`);
  out.push('.align 4', 'fvtx:', ...f.v.map((p) => `  .half ${[...p, 0].map((x) => x & 0xffff).join(', ')}`));
  out.push('ftri:', ...f.tris.map((t) => `  .byte ${t.i.join(', ')}, 0\n  .half ${[...t.n, 0].map((x) => x & 0xffff).join(', ')}\n  .word 0x${(((0x20 << 24) | t.col) >>> 0).toString(16)}`));
  out.push('photo:', ...PHOTO.map(([x, y]) => `  .half ${x & 0xffff}, ${y & 0xffff}, ${-(THICK - 4) & 0xffff}, 0`));
  out.push(...bytes('font', GLYPHS.split('').flatMap((c) => FONT[c].map((r) => parseInt(r, 2)))));
  out.push('.align 4');
  return out.join('\n') + '\n';
}
