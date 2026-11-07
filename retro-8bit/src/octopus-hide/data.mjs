// タコの かくれんぼ のデータ（絵・画面・曲）。tools/build.mjs が呼ぶ
import { BG, KANA, SP, FLOOR } from './art.mjs';
import { makeChr, shadow, screen, put as put0, text as text0, pal, packNt, addr, msg as msg0, track, periodData, songData, voiceData, compose } from '../../tools/lib.mjs';

export const BATTERY = true; // さいこうの点を $6000 に残す

// 背景: 0 水・1 海の底（上）・2 字の段と板・3 海の底（深い所）。どれも 0 番は こい青緑 $0C
// スプライト: 0 タコ（ゲームが色を入れかえる）・1 サメ・2 カニとエビ・3 しるし（！・ハート・すみ・点）
export const PALETTES = [
  [0x0c, 0x30, 0x2c, 0x1c], [0x0c, 0x37, 0x10, 0x1a], [0x0c, 0x30, 0x2c, 0x0f], [0x0c, 0x17, 0x00, 0x0a],
  [0x0c, 0x0f, 0x37, 0x27], [0x0c, 0x0f, 0x00, 0x10], [0x0c, 0x0f, 0x16, 0x36], [0x0c, 0x30, 0x16, 0x0f],
];
// タコの色（スプライトのパレット 0 の 1〜3）: 砂・岩・海藻・かえているとちゅう（白っぽく）
const OCT_PAL = [[0x0f, 0x37, 0x27], [0x0f, 0x10, 0x00], [0x0f, 0x1a, 0x2a], [0x0f, 0x30, 0x3c]];

export function build() {
  const c = makeChr();
  const { sym } = c;
  const put = (...a) => put0(c, ...a), text = (...a) => text0(c, ...a), msg = (...a) => msg0(c, ...a);

  // 背景
  c.big(0, 'blank', BG.blank);
  c.font();
  const arrow = (rows) => c.tile(0, shadow(rows, () => '1'));
  // かなの表にない字（kana.mjs と同じ 7×7 の形。濁点は右上）
  c.CH['び'] = c.tile(0, shadow([...['11..1.1', '.1...1.', '1.....1', '1.....1', '1.....1', '.1...1.', '..111..'].map((r) => r + '.'), '........'], () => '1'));
  c.CH['←'] = arrow(['..1.....', '.1......', '11111...', '.1......', '..1.....', '........', '........', '........']);
  c.CH['→'] = arrow(['..1.....', '...1....', '11111...', '...1....', '..1.....', '........', '........', '........']);
  for (const [k, rows] of Object.entries(BG)) if (k !== 'blank') c.big(0, k, rows);
  for (const [k, rows] of Object.entries(KANA)) c.big(0, 'k_' + k, shadow(rows, (y) => (y < 10 ? '1' : '2')).map((r, y) => (y === 9 ? [...r].map((ch, x) => (ch === '1' && (x + y) % 2 ? '2' : ch)).join('') : r)));
  // 海の底: 同じ絵は 1 枚にまとめ、表 floor_tab（種類×4 本×8 行）で引く
  const seen = new Map();
  const tileOf = (rows) => { const k = rows.join(''); if (!seen.has(k)) seen.set(k, rows.every((r) => r === '........') ? 0 : c.tile(0, rows)); return seen.get(k); };
  const floorTab = [];
  for (let t = 0; t < 3; t++) for (let q = 0; q < 4; q++) {
    const pic = FLOOR[t][q >> 1], h = q & 1;
    for (let r = 0; r < 8; r++) floorTab.push(tileOf(pic.slice(r * 8, r * 8 + 8).map((s) => s.slice(h * 8, h * 8 + 8))));
  }
  // スプライト
  c.big(1, 'none', BG.blank);
  for (const [k, rows] of Object.entries(SP)) c.big(1, k, rows);

  const rnd = (i, k) => { let n = (i * 2654435761 + k * 40503) >>> 0; n = Math.imul(n ^ (n >>> 15), 2246822507) >>> 0; return ((n ^ (n >>> 13)) >>> 0) / 4294967296; };
  const T = (name) => { const v = c.sym['T_' + name.toUpperCase()]; if (v === undefined) throw new Error('ない絵: ' + name); return v; };

  // 水の画面（4〜21 行。256 ドットで 1 周）。海の底（22〜29 行）はゲームが 1 列ずつ書く
  const WROW = (row) => 'w' + (row - 4);
  function sea(s, { plainRows = [] } = {}) {
    for (let col = 0; col < 32; col++) s.nt[3][col] = T('hudEdge');
    for (let row = 4; row < 22; row++) for (let col = 0; col < 32; col++) {
      let k = WROW(row);
      const h = rnd(row * 32 + col, 7);
      if (!plainRows.includes(row)) {
        if (row === 8) k = h < 0.12 ? 'm40' : h < 0.2 ? 'm41' : k;
        else if (row === 9) k = h < 0.12 ? 'm50' : k;
        else if (row === 12) k = h < 0.05 ? 'bub8' : k;
        else if (row === 16) k = h < 0.12 ? 'm120' : h < 0.2 ? 'm121' : h < 0.24 ? 'bub12' : k;
      }
      s.nt[row][col] = T(k);
    }
    pal(s, 0, 0, 32, 4, 2); pal(s, 0, 4, 32, 18, 0); pal(s, 0, 22, 32, 6, 1); pal(s, 0, 28, 32, 2, 3);
  }
  function board(s, r0, r1, c0, c1) {
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
      const top = row === r0, bot = row === r1, left = col === c0, right = col === c1;
      s.nt[row][col] = T(top ? (left ? 'p0' : right ? 'p2' : 'p1') : bot ? (left ? 'p5' : right ? 'p7' : 'p6') : left ? 'p3' : right ? 'p4' : 'blank');
    }
    pal(s, c0, r0, c1 - c0 + 1, r1 - r0 + 1, 2);
  }
  const len = (s) => [...s].length;
  const center = (s, row, str) => text(s, 16 - Math.ceil(len(str) / 2), row, str);

  const titles = [], plays = [], ends = [];
  for (const en of [false, true]) {
    const L = (ja, e) => (en ? e : ja);
    const t = screen();
    sea(t, { plainRows: [11] });
    for (let col = 0; col < 32; col++) { t.nt[11][col] = T('w4'); t.nt[21][col] = T('blank'); } // 板のあいだは うすい青緑・下の板の下は こい青緑
    board(t, 4, 10, 2, 29);
    [['TA', 4], ['KO', 7], ['no', 10], ['ka', 14], ['ku', 17], ['re', 20], ['n', 23], ['bo', 26]].forEach(([k, col]) => put(t, col, 5, 'k_' + k, 2, 2));
    center(t, 8, 'OCTOPUS HIDE');
    board(t, 12, 20, 2, 29);
    center(t, 13, L('←→ あるく   A いろを かえる', '←→ WALK    A: CHANGE COLOR'));
    center(t, 15, L('さめが きたら ゆかの いろで じっと', 'SHARK! BLEND IN AND FREEZE'));
    center(t, 17, L('かにと えびを たべよう', 'EAT CRABS AND SHRIMP'));
    text(t, 2, 1, 'HI');
    text(t, 16, 1, 'ASOBI LAB 2026');
    titles.push(t);

    const p = screen();
    sea(p);
    text(p, 2, 1, L('   てん', 'SCORE'));
    text(p, 21, 1, 'HI');
    plays.push(p);

    const e = screen();
    sea(e);
    for (let col = 0; col < 32; col++) e.nt[21][col] = T('blank');
    for (const [k, v] of Object.entries(p.nt.slice(0, 3))) e.nt[k] = [...v];
    board(e, 12, 20, 2, 29);
    ends.push(e);
  }
  sym.ADDR_THI = addr(5, 1);
  sym.ADDR_SCORE = addr(8, 1);
  sym.ADDR_PHI = addr(24, 1);
  sym.ADDR_ESCORE = addr(20, 14);
  sym.ADDR_EBEST = addr(20, 15);

  // 字（0 かな・1 英語）。同じ場所に同じ長さで（短いほうを空白でうめる）
  const MSGS = [];
  const bi = (name, col, row, ja, en) => {
    const w = Math.max(len(ja), len(en));
    MSGS.push([name, col, row, ja + ' '.repeat(w - len(ja)), en + ' '.repeat(w - len(en))]);
  };
  const pad = (s, n) => s + ' '.repeat(n - len(s));
  const ctr = (name, row, ja, en, w = Math.max(len(ja), len(en))) => {
    const pj = Math.floor((w - len(ja)) / 2), pe = Math.floor((w - len(en)) / 2);
    bi(name, 16 - Math.ceil(w / 2), row, pad(' '.repeat(pj) + ja, w), pad(' '.repeat(pe) + en, w));
  };
  bi('push', 9, 19, ' START を おしてね', '   PUSH START');
  bi('push_off', 9, 19, ' '.repeat(16), '');
  ctr('hint1', 2, '←→ あるく   A いろを かえる', '←→ WALK    A: CHANGE COLOR', 28);
  ctr('hint2', 2, 'さめ! ゆかの いろで じっと!', 'SHARK! BLEND IN AND FREEZE!', 28);
  ctr('hint0', 2, '', '', 28);
  bi('e_score', 8, 14, pad('てん', 12) + '0000', pad('SCORE', 12) + '0000');
  bi('e_best', 8, 15, pad('さいこう', 12) + '0000', pad('BEST', 12) + '0000');
  ctr('e_new', 17, 'しんきろく!', 'NEW RECORD!');
  MSGS.forEach(([name], i) => { sym['M_' + name.toUpperCase()] = i; });
  sym.MSG_N = MSGS.length;
  sym.S_OC_STEP = 6; // タコの絵 1 枚 = 6 まい（24×16）

  // 曲: 海の底の しのび足のワルツ（ハ長調・3 拍子）と、おわりの短い曲
  const A = ['E5:1 G5:1 E5:1 | C waltz', 'D5:1 F5:1 D5:1 | G waltz', 'C5:1 E5:1 G5:1 | C waltz', 'A5:2 G5:1 | F waltz',
    'E5:1 G5:1 E5:1 | C waltz', 'D5:1 F5:1 A5:1 | Dm waltz', 'G5:1 F5:1 D5:1 | G waltz', 'C5:2 -:1 | C waltz'];
  const B = ['A5:1 C6:1 A5:1 | F waltz', 'G5:1 E5:1 C5:1 | C waltz', 'F5:1 A5:1 F5:1 | Dm waltz', 'E5:2 -:1 | Am waltz',
    'D5:1 E5:1 F5:1 | Dm waltz', 'G5:1 A5:1 B5:1 | G waltz', 'C6:1 G5:1 E5:1 | C waltz', 'C5:2 -:1 | C waltz'];
  const C = ['-:1 E5:0.5 E5:0.5 G5:1 | Am waltz', '-:1 D5:0.5 D5:0.5 F5:1 | Dm waltz', '-:1 C5:0.5 C5:0.5 E5:1 | Am waltz', 'B4:2 -:1 | E waltz',
    '-:1 E5:0.5 E5:0.5 A5:1 | Am waltz', '-:1 F5:0.5 F5:0.5 A5:1 | F waltz', 'G5:1 E5:1 D5:1 | G waltz', 'G5:2 -:1 | G waltz'];
  const Q = 10, H = 20;
  const songs = {
    main: { tracks: compose({ beat: 13, bars: [...A, ...B, ...C, ...A, ...B] }), duty: 0x80 },
    over: { tracks: [track(`E5 ${Q} C5 ${Q} A4 ${Q} B4 ${Q} C5 ${H * 2}`, false, 0xfe), track(`A2 ${H} E2 ${H} A2 ${H * 2}`, true, 0xfe)], duty: 0x80 },
  };
  const hex = (n) => '$' + n.toString(16).toUpperCase().padStart(2, '0');
  // 字を消すときは水の絵にもどす（字の段は こい青緑のまま）
  const data = `
; ---- ここから下はビルドが作ったデータ ----
palette:
  .byte ${PALETTES.flat().map(hex).join(',')}
oct_pal:
  .byte ${OCT_PAL.flat().map(hex).join(',')}
floor_tab:
  .byte ${floorTab.join(',')}
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
