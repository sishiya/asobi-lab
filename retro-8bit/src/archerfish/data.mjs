// うて! テッポウウオ のデータ（絵・画面・曲）。tools/build.mjs が呼ぶ
import { SP, KANA, ARROW, BG_PALS, PERCHES, scene, plate } from './art.mjs';
import { makeChr, shadow, screen, put as put0, text as text0, pal, packNt, addr, msg as msg0, track, periodData, songData, voiceData, compose } from '../../tools/lib.mjs';
import { PALETTE_RGB } from '../../js/palette.js';

export const BATTERY = true; // いちばん多く食べた数を $6000 に残す

// 背景: 0 葉・1 枝と幹・2 水・3 字（0 番はどれも こい水の色 $0C）
// スプライト: 0 テッポウウオ・1 コオロギとハエ・2 ハチと！・3 水としぶきと ほかの魚のかげ
export const PALETTES = [
  ...BG_PALS,
  [0x0c, 0x0f, 0x10, 0x30], [0x0c, 0x0f, 0x17, 0x3c], [0x0c, 0x0f, 0x27, 0x3c], [0x0c, 0x0f, 0x2c, 0x30],
];

export function build() {
  const c = makeChr();
  const { sym } = c;
  const put = (...a) => put0(c, ...a), text = (...a) => text0(c, ...a), msg = (...a) => msg0(c, ...a);

  // ---- 背景の絵 ----
  c.big(0, 'blank', Array(8).fill('........'));
  c.font();
  for (const [ch, rows] of Object.entries(ARROW)) c.CH[ch] = c.tile(0, shadow(rows, () => '1'));
  for (const [k, rows] of Object.entries(KANA)) c.big(0, 'k_' + k, shadow(rows, (y) => (y < 10 ? '1' : '2')).map((r, y) => (y === 9 ? [...r].map((ch, x) => (ch === '1' && (x + y) % 2 ? '2' : ch)).join('') : r)));
  for (let i = 0; i < 8; i++) c.big(0, 'p' + i, plate(i));
  const T = (name) => c.sym['T_' + name.toUpperCase()];

  // 景色: 色の絵 → 16×16 ごとにいちばん近いパレット → 8×8 に切って同じものはまとめる
  const px = scene();
  const rgb = (n) => { const v = PALETTE_RGB[n]; return [v >> 16, (v >> 8) & 255, v & 255]; };
  const dist = (a, b) => { const p = rgb(a), q = rgb(b); return (p[0] - q[0]) ** 2 * 3 + (p[1] - q[1]) ** 2 * 4 + (p[2] - q[2]) ** 2 * 2; };
  const near = (col, p) => { let bi = 0, bd = Infinity; BG_PALS[p].forEach((q, i) => { const d = dist(col, q); if (d < bd) { bd = d; bi = i; } }); return [bi, bd]; };
  const attr = Array.from({ length: 15 }, () => new Array(16).fill(0));
  let bad = 0;
  for (let by = 0; by < 15; by++) for (let bx = 0; bx < 16; bx++) {
    let best = 0, be = Infinity;
    const force = by === 0 || by >= 13 ? 3 : -1;
    for (let p = 0; p < 4; p++) {
      if (force >= 0 && p !== force) continue;
      let e = 0;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) e += near(px[(by * 16 + y) * 256 + bx * 16 + x], p)[1];
      if (e < be) { be = e; best = p; }
    }
    if (be > 0) bad++;
    attr[by][bx] = best;
  }
  const seen = new Map();
  const base = screen();
  for (let row = 0; row < 30; row++) for (let col = 0; col < 32; col++) {
    const p = attr[row >> 1][col >> 1];
    const rows = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => { const i = near(px[(row * 8 + y) * 256 + col * 8 + x], p)[0]; return i ? String(i) : '.'; }).join(''));
    const key = rows.join('');
    if (key === '.'.repeat(64)) { base.nt[row][col] = T('blank'); continue; }
    if (!seen.has(key)) seen.set(key, c.tile(0, rows));
    base.nt[row][col] = seen.get(key);
  }
  base.at = attr.map((r) => [...r]);
  const rnd = (i, k) => { let n = (i * 2654435761 + k * 40503) >>> 0; n = Math.imul(n ^ (n >>> 15), 2246822507) >>> 0; return ((n ^ (n >>> 13)) >>> 0) / 4294967296; };
  sym.SCENE_TILES = seen.size;
  sym.SCENE_BAD = bad;
  const copy = (s) => ({ nt: s.nt.map((r) => [...r]), at: s.at.map((r) => [...r]) });
  const clearRow = (s, row, c0, c1) => { for (let col = c0; col <= c1; col++) s.nt[row][col] = T('blank'); };
  const board = (s, r0, r1, c0, c1) => {
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
      const top = row === r0, bot = row === r1, left = col === c0, right = col === c1;
      s.nt[row][col] = T(top ? (left ? 'p0' : right ? 'p2' : 'p1') : bot ? (left ? 'p5' : right ? 'p7' : 'p6') : left ? 'p3' : right ? 'p4' : 'blank');
    }
    pal(s, c0, r0, c1 - c0 + 1, r1 - r0 + 1, 3);
  };

  const titles = [], plays = [], ends = [];
  for (const en of [false, true]) {
    const L = (ja, e) => (en ? e : ja);
    const t = copy(base);
    board(t, 4, 11, 2, 29);
    [['hu', 4], ['hte', 6], ['ex', 8], ['TE', 11], ['tsu', 13], ['PO', 15], ['U', 17], ['U', 19], ['O', 21]].forEach(([k, col]) => put(t, col + 2, 5, 'k_' + k, 2, 2));
    text(t, 11, 8, 'ARCHERFISH');
    text(t, 9, 10, 'ASOBI LAB 2026');
    text(t, 12, 1, 'HI');
    board(t, 20, 29, 2, 29);
    const center = (row, s) => text(t, 16 - Math.ceil([...s].length / 2), row, s);
    center(22, L('←→ で およぎ  A で みずを ふく', '←→ SWIM    A: SPIT WATER'));
    center(24, L('おちた むしを たべると じかんが ふえる', 'EAT FALLEN BUGS FOR TIME'));
    center(26, L('はちに あてると さされる!', 'NEVER HIT A WASP!'));
    titles.push(t);

    const p = copy(base);
    text(p, en ? 1 : 2, 1, L('たべた', 'BUGS'));
    text(p, en ? 12 : 13, 1, L('のこり', 'TIME'));
    text(p, 23, 1, 'HI');
    plays.push(p);
    const e = copy(p);
    board(e, 20, 29, 2, 29);
    ends.push(e);
  }
  sym.ADDR_THI = addr(15, 1);
  sym.ADDR_SCORE = addr(6, 1);
  sym.ADDR_TIME = addr(17, 1);
  sym.ADDR_PHI = addr(26, 1);
  sym.ADDR_ESCORE = addr(20, 23);
  sym.ADDR_EBEST = addr(20, 24);

  // 字（0 かな・1 英語）。同じ場所に同じ長さで
  const MSGS = [];
  const len = (s) => [...s].length;
  const bi = (name, col, row, ja, en) => {
    const w = Math.max(len(ja), len(en));
    MSGS.push([name, col, row, ja + ' '.repeat(w - len(ja)), en + ' '.repeat(w - len(en))]);
  };
  const padr = (s, n) => s + ' '.repeat(n - len(s));
  bi('push', 10, 28, 'START を おしてね', '   PUSH START');
  bi('push_off', 10, 28, ' '.repeat(13), '');
  bi('e_title', 12, 21, 'おしまい', 'TIME UP');
  bi('e_score', 8, 23, padr('たべた むし', 12) + '000', padr('BUGS EATEN', 12) + '000');
  bi('e_best', 8, 24, padr('さいこう', 12) + '000', padr('BEST', 12) + '000');
  bi('e_new', 11, 26, 'しんきろく!', 'NEW RECORD!');
  MSGS.forEach(([name], i) => { sym['M_' + name.toUpperCase()] = i; });
  sym.MSG_N = MSGS.length;

  // とまる所の表
  sym.N_PERCH = PERCHES.length;

  // 曲: マングローブの水べの 3 拍子（ヘ長調）と、おしまいの短い曲
  const A = ['C5:1 F5:1 A5:1 | F waltz', 'G5:2 F5:1 | C waltz', 'E5:1 G5:1 C6:1 | C waltz', 'A5:2 -:1 | F waltz',
    'F5:1 A5:1 C6:1 | F waltz', 'D6:1 C6:1 A5:1 | Dm waltz', 'G5:1 A5:1 G5:1 | C waltz', 'F5:2 -:1 | F waltz'];
  const B = ['A5:1 G5:1 F5:1 | Dm waltz', 'E5:2 C5:1 | Am waltz', 'D5:1 F5:1 A5:1 | Dm waltz', 'G5:2 -:1 | G waltz',
    'C6:1 A5:1 F5:1 | F waltz', 'G5:1 E5:1 C5:1 | C waltz', 'F5:1 E5:1 G5:1 | C waltz', 'F5:2 -:1 | F waltz'];
  const Q = 12, H = 24;
  const songs = {
    main: { tracks: compose({ beat: 13, bars: [...A, ...B, ...A, ...B] }), duty: 0x80 },
    over: { tracks: [track(`C6 ${Q} A5 ${Q} F5 ${Q} G5 ${Q} F5 ${H * 2}`, false, 0xfe), track(`F2 ${H} C3 ${H} F2 ${H * 2}`, true, 0xfe)], duty: 0x40 },
  };
  const hex = (n) => '$' + n.toString(16).toUpperCase().padStart(2, '0');

  // ---- スプライトの絵 ----
  for (const [k, rows] of Object.entries(SP)) c.big(1, k, rows);

  const data = `
; ---- ここから下はビルドが作ったデータ ----
palette:
  .byte ${PALETTES.flat().map(hex).join(',')}
perch_x: .byte ${PERCHES.map((p) => p.x).join(', ')}
perch_y: .byte ${PERCHES.map((p) => p.y).join(', ')}
perch_f: .byte ${PERCHES.map((p) => p.f).join(', ')}
${titles.map((s, i) => `nt_title_${i}:\n  .byte ${packNt(s).join(',')}`).join('\n')}
${plays.map((s, i) => `nt_play_${i}:\n  .byte ${packNt(s).join(',')}`).join('\n')}
${ends.map((s, i) => `nt_end_${i}:\n  .byte ${packNt(s).join(',')}`).join('\n')}
${MSGS.map(([name, col, row, ja, en]) => `${msg(`m_${name}_0`, col, row, ja)}\n${msg(`m_${name}_1`, col, row, en)}`).join('\n')}
msg_lo: .byte ${[0, 1].flatMap((l) => MSGS.map(([n]) => `<m_${n}_${l}`)).join(', ')}
msg_hi: .byte ${[0, 1].flatMap((l) => MSGS.map(([n]) => `>m_${n}_${l}`)).join(', ')}
${periodData()}
${songData(songs, sym)}
${voiceData([7, 7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2], 0x18, sym)}
`;
  return { chr: c.chr, count: c.count, sym, data };
}
