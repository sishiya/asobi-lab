// カエルのよる を組み立てる: ドット絵 → CHR、画面・曲・表 → データ、アセンブリ → PRG、まとめて .nes。
//   node retro-8bit/tools/build.mjs           （roms/frog-night.nes を書く）
//   node retro-8bit/tools/build.mjs --preview （_dev に絵の一覧の PNG も出す）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BG, KANA, FONT, SP } from '../src/art.mjs';
import { assemble } from './asm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- CHR（絵の表 0 = 背景、1 = スプライト） ----------
const chr = new Uint8Array(8192);
const count = [0, 0];
const sym = {};
function tile(table, rows) {
  if (rows.length !== 8 || rows.some((r) => r.length !== 8)) throw new Error('8×8 ではない: ' + JSON.stringify(rows));
  const n = count[table]++;
  if (n > 255) throw new Error('絵の表がいっぱい');
  const o = table * 4096 + n * 16;
  rows.forEach((r, y) => {
    let lo = 0, hi = 0;
    for (let x = 0; x < 8; x++) {
      const c = r[x] === '.' ? 0 : +r[x];
      lo |= (c & 1) << (7 - x); hi |= ((c >> 1) & 1) << (7 - x);
    }
    chr[o + y] = lo; chr[o + 8 + y] = hi;
  });
  return n;
}
// 大きな絵を 8×8 に切る（左上から右へ、行ごと）
function big(table, name, rows) {
  const w = rows[0].length, h = rows.length;
  if (w % 8 || h % 8 || rows.some((r) => r.length !== w)) throw new Error('大きさがそろっていない: ' + name);
  let first = -1;
  for (let ty = 0; ty < h / 8; ty++) for (let tx = 0; tx < w / 8; tx++) {
    const n = tile(table, rows.slice(ty * 8, ty * 8 + 8).map((r) => r.slice(tx * 8, tx * 8 + 8)));
    if (first < 0) first = n;
  }
  sym[(table ? 'S_' : 'T_') + name.toUpperCase()] = first;
  return first;
}
// 影（右下に 3）をつける
function shadow(rows, ink) {
  const h = rows.length, w = rows[0].length;
  const g = rows.map((r) => [...r]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rows[y][x] === '.' && y > 0 && x > 0 && rows[y - 1][x - 1] !== '.') g[y][x] = '3';
  }
  return g.map((r, y) => r.map((c) => (c === '1' ? ink(y) : c)).join(''));
}

// 背景
big(0, 'blank', BG.blank);
const fontStart = count[0];
const CH = {};
for (const [ch, rows] of Object.entries(FONT)) {
  const g = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => {
    if (y > 6 || x > 5) return '.';
    const on = (xx) => xx >= 0 && xx < 5 && rows[y][xx] === '1';
    return on(x) || on(x - 1) ? '1' : '.'; // 右に1ドット太らせる
  }).join(''));
  CH[ch] = tile(0, shadow(g, () => '1'));
}
sym.T_0 = CH['0'];
for (const k of ['star1', 'star2', 'star3', 'reedTop', 'reedMid', 'pads', 'water1', 'water2', 'water3', 'moon']) big(0, k, BG[k]);
for (const [k, rows] of Object.entries(KANA)) big(0, 'k_' + k, shadow(rows, (y) => (y < 7 ? '2' : '1')));

// スプライト
big(1, 'none', BG.blank);
for (const [k, rows] of Object.entries(SP)) big(1, k, rows);

// ---------- 画面（32×30 の絵の番号と、16×16 ごとのパレット） ----------
function screen() {
  return { nt: Array.from({ length: 30 }, () => new Array(32).fill(0)), at: Array.from({ length: 15 }, () => new Array(16).fill(0)) };
}
function put(s, col, row, name, w = 1, h = 1) {
  const first = sym['T_' + name.toUpperCase()];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) s.nt[row + y][col + x] = first + y * w + x;
}
function text(s, col, row, str) { [...str].forEach((c, i) => { s.nt[row][col + i] = c === ' ' ? 0 : CH[c]; }); }
function pal(s, col, row, w, h, p) { for (let y = row; y < row + h; y++) for (let x = col; x < col + w; x++) s.at[y >> 1][x >> 1] = p; }
function scenery(s, keepClear) {
  // 星（決まった並び）
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 40; i++) {
    const c = 2 + Math.floor(rnd() * 28), r = 4 + Math.floor(rnd() * 18);
    if (r >= 3 && r <= 6 && c >= 22 && c <= 27) continue; // 月のまわり
    if ((c <= 3 || c >= 28) && r >= 14) continue;          // 草のパレット
    if (keepClear(c, r)) continue;
    const k = rnd();
    put(s, c, r, k < 0.55 ? 'star2' : k < 0.88 ? 'star1' : 'star3');
  }
  put(s, 24, 4, 'moon', 2, 2); pal(s, 24, 4, 2, 2, 3);
  // 草（左右のふち）
  for (const [col, top] of [[0, 15], [2, 19], [30, 16], [28, 20]]) {
    put(s, col, top, 'reedTop', 2, 1);
    for (let r = top + 1; r < 24; r++) put(s, col, r, 'reedMid', 2, 1);
    pal(s, col, top & ~1, 2, 24 - (top & ~1), 1);
  }
  // ハスの葉と水
  for (let c = 0; c < 32; c += 4) put(s, c, 24, 'pads', 4, 2);
  pal(s, 0, 24, 32, 2, 1);
  for (let r = 26; r < 30; r++) for (let c = 0; c < 32; c++) put(s, c, r, ['water1', 'water2', 'water3'][(c * 7 + r * 3) % 5 % 3]);
  pal(s, 0, 26, 32, 4, 2);
}
function packNt(s) {
  const b = [];
  for (const row of s.nt) b.push(...row);
  for (let ay = 0; ay < 8; ay++) for (let ax = 0; ax < 8; ax++) {
    let v = 0;
    for (let q = 0; q < 4; q++) {
      const qy = ay * 2 + (q >> 1), qx = ax * 2 + (q & 1);
      v |= (qy < 15 ? s.at[qy][qx] : 0) << (((q >> 1) << 2) | ((q & 1) << 1));
    }
    b.push(v);
  }
  return b;
}
const addr = (col, row) => 0x2000 + row * 32 + col;

// タイトル
const title = screen();
scenery(title, (c, r) => (r >= 1 && r <= 3) || (r >= 5 && r <= 14) || r === 17 || r === 21);
['ka', 'e', 'ru', 'no', 'yo', 'ru2'].forEach((k, i) => put(title, 7 + i * 3, 6, 'k_' + k, 2, 2));
pal(title, 6, 6, 20, 2, 1);
text(title, 11, 10, 'FROG NIGHT');
text(title, 10, 13, '10');
text(title, 16, 13, '30');
text(title, 22, 13, 'NO!');
text(title, 11, 17, 'PUSH START');
text(title, 12, 2, 'HI');
text(title, 15, 2, '000000');
text(title, 9, 21, 'ASOBI LAB 2026');
sym.ADDR_HI = addr(15, 2);

// あそぶ画面
const play = screen();
scenery(play, (c, r) => r <= 3 || (r >= 11 && r <= 13) || r === 17);
text(play, 2, 2, 'SCORE');
text(play, 8, 2, '000000');
text(play, 22, 2, 'TIME');
text(play, 27, 2, '90');
sym.ADDR_SCORE = addr(8, 2);
sym.ADDR_TIME = addr(27, 2);

// 画面に書く字（番地・長さ・絵の番号）
function msg(label, col, row, str) {
  const t = [...str].map((c) => (c === ' ' ? 0 : CH[c]));
  const a = addr(col, row);
  return `${label}: .byte ${a >> 8}, ${a & 0xff}, ${t.length}, ${t.join(', ')}`;
}

// ---------- 曲 ----------
const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (n) => { const m = n.match(/^([A-G])(#?)(\d)$/); return 12 * (+m[3] + 1) + NAMES[m[1]] + (m[2] ? 1 : 0); };
const PBASE = 32; // 表の 1 番 = MIDI 33
const periods = [];
for (let i = 1; i <= 64; i++) {
  const f = 440 * 2 ** ((i + PBASE - 69) / 12);
  periods.push(Math.min(0x7ff, Math.round(1789773 / (16 * f)) - 1));
}
// "A4 16 C5 16 - 16" → バイト。tri = 三角波（1オクターブ下に鳴るので +12）
function track(str, tri, end) {
  const t = str.trim().split(/\s+/), b = [];
  for (let i = 0; i < t.length; i += 2) {
    const d = +t[i + 1];
    b.push(t[i] === '-' ? 0 : midi(t[i]) + (tri ? 12 : 0) - PBASE, d);
  }
  b.push(end);
  return b.join(', ');
}
const Q = 16, E = 8, H = 32, DH = 48;
const melody = `
A4 ${Q} C5 ${Q} E5 ${Q} D5 ${E} C5 ${E}   A4 ${H} G4 ${Q} - ${Q}
A4 ${Q} C5 ${Q} D5 ${Q} E5 ${E} G5 ${E}   E5 ${DH} - ${Q}
G5 ${Q} E5 ${Q} D5 ${Q} C5 ${E} D5 ${E}   E5 ${H} D5 ${Q} C5 ${Q}
A4 ${Q} C5 ${Q} D5 ${E} C5 ${E} A4 ${Q}   A4 ${DH} - ${Q}`;
const bassBar = (r, f) => `${r} ${Q} ${f} ${Q} ${r.replace(/\d/, (o) => +o + 1)} ${Q} ${f} ${Q}`;
const bass = [['A2', 'E3'], ['G2', 'D3'], ['A2', 'E3'], ['C3', 'G3'], ['C3', 'G3'], ['G2', 'D3'], ['F2', 'C3'], ['A2', 'E3']].map(([r, f]) => bassBar(r, f)).join(' ');
const songs = {
  main: [track(melody, false, 0xff), track(bass, true, 0xff)],
  morning: [track(`C5 ${E} E5 ${E} G5 ${E} C6 ${DH}`, false, 0xfe), track(`C3 ${Q} G2 ${Q} C3 ${Q} C3 ${Q}`, true, 0xfe)],
  over: [track(`E5 ${Q} C5 ${Q} A4 ${Q} E4 ${H}`, false, 0xfe), track(`A2 ${Q} E2 ${Q} A2 ${Q} A2 ${H}`, true, 0xfe)],
};
sym.SONG_MAIN = 0; sym.SONG_MORNING = 1; sym.SONG_OVER = 2;

// ---------- 表 ----------
const wave = [5, 12, 9].flatMap((A) => Array.from({ length: 64 }, (_, i) => Math.round(A * Math.sin((2 * Math.PI * i) / 64)) & 0xff));

const data = `
; ---- ここから下はビルドが作ったデータ ----
palette:
  .byte $0F,$30,$21,$01, $0F,$1A,$2A,$01, $0F,$01,$11,$21, $0F,$38,$28,$16
  .byte $0F,$09,$2A,$38, $0F,$16,$25,$30, $0F,$00,$31,$17, $0F,$00,$28,$38
nt_title:
  .byte ${packNt(title).join(',')}
nt_play:
  .byte ${packNt(play).join(',')}
${msg('txt_push', 11, 17, 'PUSH START')}
${msg('txt_push_off', 11, 17, '          ')}
${msg('txt_pause', 13, 12, 'PAUSE')}
${msg('txt_pause_off', 13, 12, '     ')}
${msg('txt_morning', 9, 12, 'GOOD MORNING!')}
${msg('txt_over', 11, 12, 'GAME OVER')}
period_lo: .byte ${periods.map((p) => p & 0xff).join(',')}
period_hi: .byte ${periods.map((p) => p >> 8).join(',')}
wave: .byte ${wave.join(',')}
wave_off: .byte 0, 64, 128
song_tab:
${Object.keys(songs).map((k) => `  .word song_${k}0, song_${k}1`).join('\n')}
${Object.entries(songs).map(([k, [a, b]]) => `song_${k}0: .byte ${a}\nsong_${k}1: .byte ${b}`).join('\n')}
`;

const consts = Object.entries(sym).map(([k, v]) => `${k} = ${v}`).join('\n');
const game = readFileSync(join(ROOT, 'src/frog-night.s'), 'utf8');
const src = `${consts}\n${game}\n${data}\n.pad $FFFA\n.word nmi, reset, irq\n`;
const { bytes, syms } = assemble(src, { origin: 0x8000, size: 0x8000 });

const header = new Uint8Array([0x4e, 0x45, 0x53, 0x1a, 2, 1, 0x01, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const rom = new Uint8Array(16 + 32768 + 8192);
rom.set(header); rom.set(bytes, 16); rom.set(chr, 16 + 32768);
mkdirSync(join(ROOT, 'roms'), { recursive: true });
writeFileSync(join(ROOT, 'roms/frog-night.nes'), rom);
const used = bytes.findLastIndex((b, i) => i < 0x7ffa && b !== 0xff) + 1;
console.log(`roms/frog-night.nes: プログラム ${syms.palette - 0x8000} バイト・データこみで ${used} / 32762 バイト、背景の絵 ${count[0]}・スプライト ${count[1]} 枚`);

if (process.argv.includes('--preview')) {
  const { writePng } = await import('./png.mjs');
  const { PALETTE_RGB } = await import('../js/palette.js');
  const out = join(ROOT, '..', '_dev', 'retro-8bit');
  mkdirSync(out, { recursive: true });
  const pals = [[0x0f, 0x30, 0x21, 0x01], [0x0f, 0x1a, 0x2a, 0x01], [0x0f, 0x01, 0x11, 0x21], [0x0f, 0x38, 0x28, 0x16], [0x0f, 0x09, 0x2a, 0x38], [0x0f, 0x16, 0x25, 0x30], [0x0f, 0x00, 0x31, 0x17], [0x0f, 0x00, 0x28, 0x38]];
  // 絵の表 2 枚を 16×16 に並べる
  writePng(join(out, 'chr.png'), 256, 128, (x, y) => {
    const t = x >> 7, n = ((y >> 3) << 4) | ((x & 127) >> 3), o = t * 4096 + n * 16 + (y & 7);
    const c = ((chr[o] >> (7 - (x & 7))) & 1) | (((chr[o + 8] >> (7 - (x & 7))) & 1) << 1);
    const p = t ? pals[4 + Math.min(3, Math.floor(n / 16) % 4)] : pals[0];
    return c ? PALETTE_RGB[p[c]] : 0x202020;
  }, 3);
  console.log('絵の一覧: _dev/retro-8bit/chr.png');
}
