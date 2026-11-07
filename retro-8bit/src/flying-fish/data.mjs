// とべ! トビウオ のデータ（絵・画面・曲）。tools/build.mjs が呼ぶ
import { BG, KANA, SP } from './art.mjs';
import { makeChr, shadow, screen, put as put0, text as text0, pal, packNt, addr, msg as msg0, track, periodData, songData, voiceData, compose } from '../../tools/lib.mjs';

export const BATTERY = true; // いちばん遠くまで にげた きょりを $6000 に残す

// 背景: 0 空・1 波・2 海・3 字と深い海（どれも 0 番は深い海の こい藍 $01）
// スプライト: 0 トビウオ・1 マグロ・2 グンカンドリとハート・3 しぶきと しるし
export const PALETTES = [
  [0x01, 0x30, 0x21, 0x31], [0x01, 0x30, 0x31, 0x11], [0x01, 0x11, 0x21, 0x31], [0x01, 0x30, 0x21, 0x0f],
  [0x01, 0x0f, 0x12, 0x30], [0x01, 0x0f, 0x10, 0x28], [0x01, 0x0f, 0x10, 0x16], [0x01, 0x30, 0x31, 0x27],
];

export function build() {
  const c = makeChr();
  const { sym } = c;
  const put = (...a) => put0(c, ...a), text = (...a) => text0(c, ...a), msg = (...a) => msg0(c, ...a);

  // 背景
  c.big(0, 'blank', BG.blank);
  c.font();
  for (const [k, rows] of Object.entries(BG)) if (k !== 'blank') c.big(0, k, rows);
  c.big(0, 'sea1', Array(8).fill('33333333'));   // 波のすぐ下の海（パレット 1 の海の色）
  for (const [k, rows] of Object.entries(KANA)) c.big(0, 'k_' + k, shadow(rows, (y) => (y < 10 ? '1' : '2')).map((r, y) => (y === 9 ? [...r].map((ch, x) => (ch === '1' && (x + y) % 2 ? '2' : ch)).join('') : r))) // 上が白・下のふちに空色（9 行目は網でなじませる）;
  // スプライト
  c.big(1, 'none', BG.blank);
  for (const [k, rows] of Object.entries(SP)) c.big(1, k, rows);

  const rnd = (i, k) => { let n = (i * 2654435761 + k * 40503) >>> 0; n = Math.imul(n ^ (n >>> 15), 2246822507) >>> 0; return ((n ^ (n >>> 13)) >>> 0) / 4294967296; };
  const T = (name) => c.sym['T_' + name.toUpperCase()];

  // 海の画面（256 ドットで 1 周。横に流すと左右がつながる）
  //   0〜2 字の段（こい藍）・3 ふち・4〜13 空（11〜13 は水平線へうすく）・14 波・15〜21 海（下ほど こい藍へ）・22〜29 深い海
  function ocean(s) {
    for (let col = 0; col < 32; col++) s.nt[3][col] = T('hudEdge');
    for (let row = 4; row < 14; row++) for (let col = 0; col < 32; col++) s.nt[row][col] = T(row === 11 ? 'h1' : row === 12 ? 'h2' : row === 13 ? 'h3' : 'sky');
    for (const [col, row, k] of [[2, 5, 'cloudA'], [13, 8, 'cloudB'], [23, 5, 'cloudB'], [28, 9, 'cloudA']]) {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) s.nt[row + y][(col + x) & 31] = T(k) + y * 4 + x;
    }
    for (let col = 0; col < 32; col += 2) { const k = rnd(col, 1) < 0.35 ? 'waveB' : 'waveA'; s.nt[14][col] = T(k); s.nt[14][col + 1] = T(k) + 1; }
    for (let col = 0; col < 32; col++) {
      s.nt[15][col] = T('sea1');
      for (let k = 0; k < 6; k++) s.nt[16 + k][col] = T('fade' + k);
      if (rnd(col, 3) < 0.06) s.nt[16][col] = T('bubble');
      for (let row = 22; row < 30; row++) { const h = rnd(row * 32 + col, 5); s.nt[row][col] = h < 0.06 ? T('snow0') : h < 0.12 ? T('snow1') : h < 0.16 ? T('snow2') : T('blank'); }
    }
    pal(s, 0, 0, 32, 4, 3); pal(s, 0, 4, 32, 10, 0); pal(s, 0, 14, 32, 2, 1); pal(s, 0, 16, 32, 6, 2); pal(s, 0, 22, 32, 8, 3);
  }
  const clearRow = (s, row, c0, c1) => { for (let col = c0; col <= c1; col++) s.nt[row][col] = T('blank'); };

  const titles = [], plays = [], ends = [];
  for (const en of [false, true]) {
    const L = (ja, e) => (en ? e : ja);
    const t = screen();
    ocean(t);
    // 題の板（4〜11 行・2〜29 列）
    for (let row = 4; row < 12; row++) for (let col = 2; col < 30; col++) {
      const top = row === 4, bot = row === 11, left = col === 2, right = col === 29;
      t.nt[row][col] = T(top ? (left ? 'p0' : right ? 'p2' : 'p1') : bot ? (left ? 'p5' : right ? 'p7' : 'p6') : left ? 'p3' : right ? 'p4' : 'blank');
    }
    pal(t, 2, 4, 28, 8, 3);
    [['hto', 5], ['hbe', 8], ['ex', 11], ['TO', 15], ['BI', 18], ['U', 21], ['O', 24]].forEach(([k, col]) => put(t, col, 5, 'k_' + k, 2, 2));
    text(t, 10, 8, 'FLYING FISH');
    text(t, 12, 1, 'HI');
    text(t, 19, 1, 'M');
    for (const row of [22, 24, 26, 28]) clearRow(t, row, 3, 28);
    const center = (row, s) => text(t, 16 - Math.ceil([...s].length / 2), row, s);
    center(22, L('A を おすと のぼって とぶ', 'HOLD A: SWIM UP AND GLIDE'));
    center(24, L('はなすと しずむ', 'LET GO: DIVE'));
    center(26, L('まぐろと とりから にげろ!', 'ESCAPE THE TUNA AND BIRDS!'));
    text(t, 9, 10, 'ASOBI LAB 2026');
    titles.push(t);

    const p = screen();
    ocean(p);
    text(p, 2, 1, L('きょり', 'DIST'));
    text(p, 11, 1, 'M');
    text(p, 21, 1, 'HI');
    text(p, 28, 1, 'M');
    plays.push(p);
    // 結果の画面: 深い海に題と同じ板（22〜29 行・4〜27 列）
    const e = screen();
    ocean(e);
    for (const [k, v] of Object.entries(p.nt.slice(0, 3))) e.nt[k] = [...v];
    for (let row = 22; row < 30; row++) for (let col = 4; col < 28; col++) {
      const top = row === 22, bot = row === 29, left = col === 4, right = col === 27;
      e.nt[row][col] = T(top ? (left ? 'p0' : right ? 'p2' : 'p1') : bot ? (left ? 'p5' : right ? 'p7' : 'p6') : left ? 'p3' : right ? 'p4' : 'blank');
    }
    ends.push(e);
  }
  sym.ADDR_THI = addr(15, 1);   // タイトルの HI の数字（4 けた）
  sym.ADDR_DIST = addr(7, 1);
  sym.ADDR_PHI = addr(24, 1);
  sym.ADDR_EDIST = addr(19, 23);
  sym.ADDR_EBEST = addr(19, 24);

  // 字（0 かな・1 英語）。同じ場所に同じ長さで（短いほうを空白でうめる）
  const MSGS = [];
  const len = (s) => [...s].length;
  const bi = (name, col, row, ja, en) => {
    const w = Math.max(len(ja), len(en));
    MSGS.push([name, col, row, ja + ' '.repeat(w - len(ja)), en + ' '.repeat(w - len(en))]);
  };
  const pad = (s, n) => s + ' '.repeat(n - len(s));
  bi('push', 10, 28, 'START を おしてね', '   PUSH START');
  bi('push_off', 10, 28, ' '.repeat(13), '');
  bi('hint1', 6, 23, 'A を おすと のぼって とぶ', 'HOLD A: SWIM UP AND GLIDE');
  bi('hint2', 6, 24, 'はなすと しずむ', 'LET GO: DIVE');
  bi('hint1_off', 6, 23, ' '.repeat(25), '');
  bi('hint2_off', 6, 24, ' '.repeat(25), '');
  bi('e_dist', 7, 23, pad('にげた きょり', 12) + '0000M', pad('DISTANCE', 12) + '0000M');
  bi('e_best', 7, 24, pad('さいこう', 12) + '0000M', pad('BEST', 12) + '0000M');
  bi('e_new', 10, 26, 'しんきろく!', 'NEW RECORD!');
  MSGS.forEach(([name], i) => { sym['M_' + name.toUpperCase()] = i; });
  sym.MSG_N = MSGS.length;

  // 曲: 波の上の行進曲（ハ長調・4 拍子）と、つかまったときの短い曲
  const A = ['E5:1 G5:1 C6:1 G5:1 | C march', 'A5:1.5 G5:0.5 E5:2 | F march', 'D5:1 E5:1 F5:1 A5:1 | G march', 'G5:3 -:1 | C march',
    'E5:1 G5:1 C6:1 G5:1 | C march', 'A5:1 C6:1 A5:1 F5:1 | F march', 'G5:1 F5:1 E5:1 D5:1 | G march', 'C5:3 -:1 | C march'];
  const B = ['A5:2 G5:1 F5:1 | F march', 'E5:2 D5:1 C5:1 | C march', 'D5:1 E5:1 F5:1 G5:1 | Dm march', 'A5:3 -:1 | Am march',
    'G5:1 E5:1 C5:1 E5:1 | C march', 'F5:1 A5:1 C6:1 A5:1 | F march', 'G5:2 B4:2 | G march', 'C5:3 -:1 | C march'];
  const Q = 12, H = 24;
  const songs = {
    main: { tracks: compose({ beat: 12, bars: [...A, ...B, ...A, ...B] }), duty: 0x40 },
    over: { tracks: [track(`G5 ${Q} E5 ${Q} C5 ${Q} D5 ${Q} C5 ${H * 2}`, false, 0xfe), track(`C3 ${H} G2 ${H} C3 ${H * 2}`, true, 0xfe)], duty: 0x80 },
  };
  const hex = (n) => '$' + n.toString(16).toUpperCase().padStart(2, '0');

  const data = `
; ---- ここから下はビルドが作ったデータ ----
palette:
  .byte ${PALETTES.flat().map(hex).join(',')}
${titles.map((s, i) => `nt_title_${i}:\n  .byte ${packNt(s).join(',')}`).join('\n')}
${plays.map((s, i) => `nt_play_${i}:\n  .byte ${packNt(s).join(',')}`).join('\n')}
${ends.map((s, i) => `nt_end_${i}:\n  .byte ${packNt(s).join(',')}`).join('\n')}
${MSGS.map(([name, col, row, ja, en]) => `${msg(`m_${name}_0`, col, row, ja)}\n${msg(`m_${name}_1`, col, row, en)}`).join('\n')}
msg_lo: .byte ${[0, 1].flatMap((l) => MSGS.map(([n]) => `<m_${n}_${l}`)).join(', ')}
msg_hi: .byte ${[0, 1].flatMap((l) => MSGS.map(([n]) => `>m_${n}_${l}`)).join(', ')}
${periodData()}
${songData(songs, sym)}
${voiceData([7, 7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2], 0x20, sym)}
`;
  return { chr: c.chr, count: c.count, sym, data };
}
