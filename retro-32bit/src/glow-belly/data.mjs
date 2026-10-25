// ムネエソの腹あかり: main.s などのうしろにつなぐ表と形（ビルドのときに作る）
import { readFileSync } from 'node:fs';
import { encode } from '../../tools/adpcm.mjs';
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
// ART.md: 昼の 150m #1f5f8f・480m（段 140）#0b2a52・700m（段 67）#050c1e
const PAL = [[0, [0, 1, 4]], [40, [2, 5, 16]], [67, [5, 12, 30]], [140, [11, 42, 82]], [200, [22, 72, 118]], [255, [31, 95, 143]]];
function water(I) {
  for (let i = 0; i + 1 < PAL.length; i++) if (I <= PAL[i + 1][0]) {
    const t = (I - PAL[i][0]) / (PAL[i + 1][0] - PAL[i][0]);
    return PAL[i][1].map((c, k) => lerp(c, PAL[i + 1][1][k], t));
  }
  return PAL.at(-1)[1];
}

// ムネエソ（ART.md: 尾をのぞく高さ ≒ 長さ × 0.9 の手斧の形、腹はとがったキール、尾のつけねは高さの 1/5、上向きの目）。
//   x＝頭が +、y＝下が +、z＝厚み。体は 7 本の輪切り × 4 段（背・上の横腹・銀の横腹・腹のキール）を帯でつなぐ（扇にしない）。
//   段ごとの色をグーローでぬる: 背 #1c2a3a → 横腹 #5a6e88 → 銀 #c8d4e0 → 腹 #7088a0
const COLS = [[46, -3, 6, 2], [36, -11, 32, 6], [22, -15, 52, 9], [8, -16, 56, 11], [-8, -15, 40, 10], [-20, -11, 20, 6], [-30, -5, 5, 2]]; // x・背・腹・厚み（背はまっすぐ、腹は前寄りに深い刃）
const ROWS = [[0, 0, [16, 24, 36]], [0.18, 0.75, [26, 38, 54]], [0.36, 1, [110, 128, 152]], [0.66, 0.85, [200, 212, 224]], [1, 0, [112, 136, 160]]]; // 高さの割合・厚みの割合・色（上の 2 段＝背の暗い帯）
const PHOTO_N = 11;

function fishModel() {
  const v = [], col = [], tris = [];
  const vid = (p, c) => { const k = p.join(); let i = v.findIndex((q) => q.join() === k); if (i < 0) { i = v.length; v.push(p); col.push(c); } return i; };
  const sub = (a, b) => a.map((c, i) => c - b[i]);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // side = -1 は手前（カメラの側, z が −）、+1 は奥。手前は画面で時計回り（GPU の裏の判定と同じ向き）
  const tri = (a, b, c, side) => {
    const P = [a, b, c].map((p) => v[p]);
    const c2 = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0]);
    if (c2 === 0) return;
    if ((side < 0 && c2 < 0) || (side > 0 && c2 > 0)) [b, c] = [c, b];
    const Q = [a, b, c].map((p) => v[p]);
    let n = cross(sub(Q[1], Q[0]), sub(Q[2], Q[0]));
    if (n[2] * side < 0) n = n.map((x) => -x);
    const len = Math.hypot(...n) || 1;
    tris.push({ i: [a, b, c], n: n.map((x) => Math.round(x / len * 4096)) });
  };
  const pt = (c, r, side) => { const [x, t, b, w] = COLS[c], [f, zf, rgb] = ROWS[r]; return vid([x, Math.round(t + (b - t) * f), Math.round(side * w * zf)], rgb); };
  for (const side of [-1, 1]) {
    for (let c = 0; c + 1 < COLS.length; c++) for (let r = 0; r + 1 < ROWS.length; r++) {
      const A = pt(c, r, side), B = pt(c + 1, r, side), C = pt(c, r + 1, side), D = pt(c + 1, r + 1, side);
      tri(A, B, C, side); tri(B, D, C, side);
    }
    // 背びれ
    tri(vid([8, -16, 0], ROWS[0][2]), vid([-8, -15, 0], ROWS[0][2]), vid([-12, -28, side], [60, 76, 96]), side);
    // 尾びれ（すけた灰青。先が明るい）
    const tc = [74, 92, 116], tl = [136, 152, 176];
    const t0 = vid([-30, -5, side], tc), t1 = vid([-30, 5, side], tc), tt = vid([-46, -17, side], tl), tm = vid([-40, 0, side], tc), tb = vid([-46, 17, side], tl);
    tri(t0, tt, tm, side); tri(t0, tm, t1, side); tri(t1, tm, tb, side);
    // 大きな上向きの目（頭の 1/4）: 銀の輪の上に、上前を向いた黒いひとみ
    const ez = side * 6;
    //   ひとみを先に入れる: 並べ表の同じ箱では、あとから入れた面が先に描かれる（＝ひとみが輪の上に描かれる）
    const pz = side * 7;
    const p0 = vid([28, -12, pz], [6, 8, 12]), p1 = vid([33, -12, pz], [6, 8, 12]), p2 = vid([28, -7, pz], [10, 12, 18]), p3 = vid([33, -7, pz], [10, 12, 18]);
    tri(p0, p1, p2, side); tri(p1, p3, p2, side);
    const r0 = vid([24, -13, ez], [176, 190, 206]), r1 = vid([35, -13, ez], [210, 222, 234]), r2 = vid([25, -3, ez], [120, 136, 156]), r3 = vid([34, -3, ez], [150, 166, 184]);
    tri(r0, r1, r2, side); tri(r1, r3, r2, side);
    // 口（上を向いたななめの線）
    tri(vid([46, -2, side * 2], [10, 14, 20]), vid([40, -5, side * 4], [10, 14, 20]), vid([40, -3, side * 4], [10, 14, 20]), side);
  }
  return { v, col, tris };
}
// 腹の発光器: キールの少し上に 11 こ（手前の面）
function photophores() {
  const out = [];
  for (let k = 0; k < PHOTO_N; k++) {
    const x = 34 - k * 5.6;
    let c = 0; while (c + 1 < COLS.length && COLS[c + 1][0] > x) c++;
    const [x0, , b0, w0] = COLS[c], [x1, , b1, w1] = COLS[Math.min(c + 1, COLS.length - 1)];
    const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
    out.push([Math.round(x), Math.round(b0 + (b1 - b0) * t - 5), -Math.round((w0 + (w1 - w0) * t) * 0.45)]); // ふちから内側に
  }
  return out;
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
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'], '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
};
export const GLYPHS = '0123456789ABSTRm^v+-';

// ---- 音（SPU の ADPCM。音の RAM の SND_BASE から順に置く。場所は 8 バイト単位の数で asm へ） ----
const SND_BASE = 0x1010;
function readWav(url) {
  const b = readFileSync(url), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let o = 12;
  while (o < b.length) {
    const id = b.toString('latin1', o, o + 4), len = dv.getUint32(o + 4, true);
    if (id === 'data') return Int16Array.from({ length: len / 2 }, (_, i) => dv.getInt16(o + 8 + i * 2, true));
    o += 8 + len + (len & 1);
  }
  throw new Error('wav の data がありません');
}
const synth = (n, f) => Int16Array.from({ length: n }, (_, i) => Math.max(-32767, Math.min(32767, Math.round(f(i)))));
function sounds() {
  const TAU = Math.PI * 2;
  return [
    // 深い海の環境音（Stable Audio。11025Hz。くり返し）
    ['AMB', readWav(new URL('./sound/ambience.wav', import.meta.url)), { loop: true }],
    // 腹の光の音: やわらかい丸い音（基音＋少しの 2 倍音）。448 こに 8 周＝くり返しにぴったり。高さは光の段で変える
    ['HUM', synth(448, (i) => 9000 * Math.sin((i / 56) * TAU) + 2200 * Math.sin((i / 28) * TAU) + 700 * Math.sin((i / 18.667) * TAU)), { loop: true }],
    // 食べた音: 小さな鐘（22050Hz で 880Hz。倍音はずらして金物らしく）。0.7 秒で消える
    ['PLINK', synth(15400, (i) => { const t = i / 22050, e = Math.exp(-t * 6); return 11000 * e * (Math.sin(TAU * 880 * t) + 0.35 * Math.sin(TAU * 2430 * t) * Math.exp(-t * 6) + 0.15 * Math.sin(TAU * 4750 * t) * Math.exp(-t * 12)); }), {}],
    // 鼓動: 低い「どっ」（55Hz のまるい音と、はじめの小さなこすれ）
    ['THUMP', synth(5500, (i) => { const t = i / 22050; return 20000 * Math.exp(-t * 22) * Math.sin(TAU * (70 - 30 * t) * t) + 3000 * Math.exp(-t * 300) * Math.sin(TAU * 400 * t); }), {}],
    // 見つかった: 低く沈む「ぼうん」（80Hz → 30Hz、1.4 秒）
    ['BOOM', synth(30800, (i) => { const t = i / 22050; return 22000 * Math.exp(-t * 2.4) * Math.sin(TAU * (80 * t - 18 * t * t)) + 2500 * Math.exp(-t * 5) * Math.sin(TAU * 161 * t); }), {}],
  ];
}

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
  const f = fishModel(), ph = photophores();
  if (f.v.length > 255) throw new Error('頂点が多すぎます');
  out.push(`NFTRI = ${f.tris.length}`, `NPHOTO = ${ph.length}`);
  out.push('.align 4', 'fvtx:', ...f.v.map((p) => `  .half ${[...p, 0].map((x) => x & 0xffff).join(', ')}`));
  out.push(...words('fcol', f.col.map((c) => bgr(...c))));
  out.push('ftri:', ...f.tris.map((t) => `  .byte ${t.i.join(', ')}, 0\n  .half ${[...t.n, 0].map((x) => x & 0xffff).join(', ')}\n  .word 0`));
  out.push('photo:', ...ph.map((p) => `  .half ${[...p, 0].map((x) => x & 0xffff).join(', ')}`));
  out.push(...bytes('font', GLYPHS.split('').flatMap((c) => FONT[c].map((r) => parseInt(r, 2)))));
  // 音: ADPCM を並べて sndbank に（64 バイトの倍数にそろえる＝DMA のかたまり）。S_〜 は音の RAM の場所（8 バイト単位）
  let addr = SND_BASE; const blobs = [];
  for (const [name, pcm, o] of sounds()) {
    const enc = encode(pcm, o);
    out.push(`S_${name} = ${addr / 8}`);
    blobs.push(enc); addr += enc.length;
  }
  let total = blobs.reduce((a, b) => a + b.length, 0);
  const pad = (64 - (total % 64)) % 64; total += pad;
  out.push(`SNDSIZE = ${total}`, `SNDBASE = ${SND_BASE / 8}`);
  const all = new Uint8Array(total); let o = 0; for (const b of blobs) { all.set(b, o); o += b.length; }
  if (SND_BASE + total > 0x80000 - 0x10000) throw new Error('音が多すぎます（残響の作業場所とぶつかる）');
  out.push('.align 64', ...bytes('sndbank', [...all], 32));
  out.push('.align 4');
  return out.join('\n') + '\n';
}
