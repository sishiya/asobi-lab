// ROM づくりの共通の道具: ドット絵 → CHR、画面（32×30 と属性）、字、曲。ゲームごとの data.mjs が使う
import { FONT } from '../src/font.mjs';
import { KANA } from '../src/kana.mjs';

export function makeChr() {
  const chr = new Uint8Array(8192);
  const count = [0, 0];
  const sym = {};
  const CH = {}; // 字 → 背景の絵の番号

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
  // 大きな絵を 8×8 に切る（左上から右へ、行ごと）。T_名前／S_名前 に最初の番号
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
  // 字を背景の表に足す（右に1ドット太らせ、右下に影 3）。ink = 字の色
  function font(ink = '1') {
    for (const [ch, rows] of Object.entries(FONT)) {
      const g = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => {
        if (y > 6 || x > 5) return '.';
        const on = (xx) => xx >= 0 && xx < 5 && rows[y][xx] === '1';
        return on(x) || on(x - 1) ? '1' : '.';
      }).join(''));
      CH[ch] = tile(0, shadow(g, () => ink));
    }
    sym.T_0 = CH['0'];
    sym.T_A = CH.A;
  }
  // かなは使う字だけ、はじめて出てきたときに背景の表へ足す（字の色 1・影 3）
  function kana(ch) {
    if (CH[ch] === undefined) {
      if (!KANA[ch]) return undefined;
      const rows = [...KANA[ch].map((r) => r + '.'), '........'];
      CH[ch] = tile(0, api.kanaShadow ? shadow(rows, () => '1') : rows);
    }
    return CH[ch];
  }
  const api = { chr, count, sym, CH, tile, big, font, kana, kanaShadow: true }; // kanaShadow = false で影なし（恐竜の牧場のように紙に刷った字）
  return api;
}

// 影（右下に 3）をつけ、1 を ink(y) の色にする
export function shadow(rows, ink) {
  const h = rows.length, w = rows[0].length;
  const g = rows.map((r) => [...r]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rows[y][x] === '.' && y > 0 && x > 0 && rows[y - 1][x - 1] !== '.') g[y][x] = '3';
  }
  return g.map((r, y) => r.map((c) => (c === '1' ? ink(y) : c)).join(''));
}

// ---------- 画面 ----------
export function screen() {
  return { nt: Array.from({ length: 30 }, () => new Array(32).fill(0)), at: Array.from({ length: 15 }, () => new Array(16).fill(0)) };
}
export function put(c, s, col, row, name, w = 1, h = 1) {
  const first = c.sym['T_' + name.toUpperCase()];
  if (first === undefined) throw new Error('ない絵: ' + name);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) s.nt[row + y][col + x] = first + y * w + x;
}
const glyph = (c, ch) => { if (ch === ' ') return 0; const t = c.CH[ch] ?? c.kana(ch); if (t === undefined) throw new Error('字がない: ' + ch + '（かなは src/kana.mjs に足す）'); return t; };
export function text(c, s, col, row, str) { [...str].forEach((ch, i) => { s.nt[row][col + i] = glyph(c, ch); }); }
export function pal(s, col, row, w, h, p) { for (let y = row; y < row + h; y++) for (let x = col; x < col + w; x++) s.at[y >> 1][x >> 1] = p; }
export function packNt(s) {
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
export const addr = (col, row) => 0x2000 + row * 32 + col;
// 画面に書く字（番地・長さ・絵の番号）のデータの1行
export function msg(c, label, col, row, str) {
  const t = [...str].map((ch) => glyph(c, ch));
  const a = addr(col, row);
  return `${label}: .byte ${a >> 8}, ${a & 0xff}, ${t.length}, ${t.join(', ')}`;
}

// ---------- 曲 ----------
const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (n) => { const m = n.match(/^([A-G])(#?)(\d)$/); if (!m) throw new Error('音の名前: ' + n); return 12 * (+m[3] + 1) + NAMES[m[1]] + (m[2] ? 1 : 0); };
const PBASE = 32; // 表の 1 番 = MIDI 33
export const periods = [];
for (let i = 1; i <= 64; i++) {
  const f = 440 * 2 ** ((i + PBASE - 69) / 12);
  periods.push(Math.min(0x7ff, Math.round(1789773 / (16 * f)) - 1));
}
// "A4 16 C5 16 - 16" → バイト。tri = 三角波（1オクターブ下に鳴るので +12）。end: $FF くり返し・$FE 止める
export function track(str, tri, end) {
  const t = str.trim().split(/\s+/), b = [];
  for (let i = 0; i < t.length; i += 2) {
    const d = +t[i + 1];
    if (!(d > 0 && d < 256)) throw new Error('長さ: ' + t[i + 1]);
    b.push(t[i] === '-' ? 0 : midi(t[i]) + (tri ? 12 : 0) - PBASE, d);
  }
  b.push(end);
  return b.join(', ');
}
export function periodData() {
  return `period_lo: .byte ${periods.map((p) => p & 0xff).join(',')}\nperiod_hi: .byte ${periods.map((p) => p >> 8).join(',')}`;
}
// 曲の表: songs = { 名前: { tracks: [ch0, ch1], duty } } → song_tab・song_duty と SONG_名前
//   duty: 矩形波2の音色 $00 12.5%・$40 25%・$80 50%（やわらかい）
export function songData(songs, sym) {
  Object.keys(songs).forEach((k, i) => { sym['SONG_' + k.toUpperCase()] = i; });
  return `song_tab:\n${Object.keys(songs).map((k) => `  .word song_${k}0, song_${k}1`).join('\n')}\n` +
    `song_duty: .byte ${Object.values(songs).map((s) => s.duty ?? 0x80).join(', ')}\n` +
    Object.entries(songs).map(([k, s]) => `song_${k}0: .byte ${s.tracks[0]}\nsong_${k}1: .byte ${s.tracks[1]}`).join('\n');
}
// メロディの音量の下がり方（env_tab）と、ベースの長さ（TRI_LIN）
export function voiceData(env, triLin, sym) {
  sym.ENV_LEN = env.length; sym.TRI_LIN = triLin;
  return `env_tab: .byte ${env.join(', ')}`;
}

// 小節で書く曲。bars の1つ = 'メロディ | 和音'。メロディは「音:拍」（- は休み。拍は 0.5・1・1.5・2・3・4）
//   beat: 1拍のフレーム数。bass: 小節ごとのベースの形（waltz 3拍・sparse 4拍・march 4拍・gallop 4拍・none）
//   1小節の拍の合計がベースの形とちがうと止める（ずれた曲を作らない）
const CHORDS = { C: ['C3', 'G3'], Dm: ['D3', 'A3'], D: ['D3', 'A3'], Em: ['E3', 'B3'], F: ['F2', 'C3'], G: ['G2', 'D3'], Am: ['A2', 'E3'], A: ['A2', 'E3'], E: ['E2', 'B2'] };
const up = (n) => n.replace(/\d/, (o) => +o + 1);
const STYLE = {
  waltz: (r, f) => [[r, 1], ['-', 1], [f, 1]],
  sparse: (r, f) => [[r, 2], [f, 2]],
  march: (r, f) => [[r, 1], [f, 1], [up(r), 1], [f, 1]],
  gallop: (r, f) => [r, up(r), f, up(r), r, up(r), f, up(r)].map((n) => [n, 0.5]),
};
export function compose({ beat, bars, loop = true }) {
  const mel = [], bas = [];
  bars.forEach((bar, bi) => {
    const [m, rest] = bar.split('|').map((x) => x.trim());
    const [ch, style = 'waltz'] = rest.split(/\s+/);
    let sum = 0;
    for (const tok of m.split(/\s+/)) {
      const [n, b] = tok.split(':');
      sum += +b;
      mel.push(n, Math.round(+b * beat));
    }
    const pat = style === 'none' ? [['-', sum]] : STYLE[style](...(CHORDS[ch] || (() => { throw new Error('和音: ' + ch); })()));
    const need = pat.reduce((a, [, b]) => a + b, 0);
    if (Math.abs(need - sum) > 1e-6) throw new Error(`${bi + 1}小節目の拍が合わない（メロディ ${sum}・ベース ${need}）: ${bar}`);
    for (const [n, b] of pat) bas.push(n, Math.round(b * beat));
  });
  const end = loop ? 0xff : 0xfe;
  return [track(mel.join(' '), false, end), track(bas.join(' '), true, end)];
}
