// リスの かくしごと のデータ（絵・地図のしかけ・字・曲）。tools/build.mjs が呼ぶ
import { BG, KANA, SP, APOS } from './art.mjs';
import { makeChr, shadow, addr, msg as msg0, track, periodData, songData, voiceData, compose } from '../../tools/lib.mjs';

export const BATTERY = true; // いちばん多く みつけた ドングリの数を $6000 に残す

// 背景: 0 地面・1 石・2 木（切り株・キノコ・幹・枝・しげみ）・3 字と板
// スプライト: 0 リス・1 ドングリ・2 カケス・3 ほかのリスと しるし
const SPR = [[0x07, 0x0f, 0x27, 0x37], [0x07, 0x0f, 0x18, 0x27], [0x07, 0x0f, 0x36, 0x12], [0x07, 0x0f, 0x10, 0x30]];
const AUT = [[0x07, 0x17, 0x18, 0x1a], [0x07, 0x17, 0x10, 0x30], [0x07, 0x17, 0x37, 0x16], [0x07, 0x37, 0x27, 0x0f]];
const WIN = [[0x07, 0x21, 0x31, 0x30], [0x07, 0x31, 0x10, 0x30], [0x07, 0x17, 0x30, 0x16], [0x07, 0x37, 0x27, 0x0f]];
const SPRG = [[0x07, 0x17, 0x18, 0x2a], [0x07, 0x17, 0x10, 0x30], [0x07, 0x17, 0x37, 0x16], [0x07, 0x37, 0x27, 0x0f]];
export const PALETTES = [...AUT, ...SPR];

// 地図のしかけ（16×16 ドット）の番号。地図の1ます = 下の4ビットが種類
//   0 地面・1 石A・2 石B・3 切り株・4 キノコ・5 わかい木・6 左の幹・7 右の幹・8/9 しげみ・10/11 枝・12 字の段
//   13〜15 地面のちがい・16 うめたあと（秋）・17 掘った穴（冬）。冬は +18
const MT_A = ['g0', 'stoneA', 'stoneB', 'stump', 'mush', 'sap', 'trunkL', 'trunkR', 'bushA', 'bushA', 'canA', 'canA', 'hud', 'g1', 'g2', 'g3', 'mound', 'g0'];
const MT_W = ['w0', 'stoneAw', 'stoneBw', 'stumpW', 'mushW', 'sapW', 'trunkL', 'trunkR', 'bushAw', 'bushAw', 'canAw', 'canAw', 'hud', 'w1', 'w2', 'w3', 'w0', 'hole'];
// 地面は 8×8 の絵を くみあわせて 4 とおり（絵の数をへらす）
const quad = (r16, q) => r16.slice((q >> 1) * 8, (q >> 1) * 8 + 8).map((r) => r.slice((q & 1) * 8, (q & 1) * 8 + 8));
const join4 = (t) => [...t[0].map((r, y) => r + t[1][y]), ...t[2].map((r, y) => r + t[3][y])];
const mix = (a, b) => [join4([quad(a, 0), quad(a, 1), quad(a, 2), quad(a, 3)]), join4([quad(b, 0), quad(b, 1), quad(b, 2), quad(b, 3)]),
  join4([quad(b, 1), quad(a, 0), quad(a, 3), quad(b, 2)]), join4([quad(a, 2), quad(b, 3), quad(b, 0), quad(a, 1)])];
const [G0, G1, G2, G3] = mix(BG.g0, BG.g1);
const [W0, W1, W2, W3] = mix(BG.w0, BG.w1);
const MTSRC = { ...BG, g0: G0, g1: G1, g2: G2, g3: G3, w0: W0, w1: W1, w2: W2, w3: W3 };
const MTNAMES = new Set([...MT_A, ...MT_W].filter((n) => n !== 'hud'));
const MT_PAL = [0, 1, 1, 2, 2, 0, 2, 2, 2, 2, 2, 2, 3, 0, 0, 0, 0, 0];

// 目じるしの ならび（地図 4 つ。ゲームのはじめに 1 つえらぶ）。石・切り株・キノコを 3 つずつ、ばらけて
const rnd = (s) => { let n = s >>> 0; return () => { n = (Math.imul(n ^ (n >>> 15), 2246822507) + 0x9e3779b9) >>> 0; n = Math.imul(n ^ (n >>> 13), 3266489909) >>> 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }; };
const START = [7, 8];
function layout(seed) {
  for (let tries = 0; tries < 500; tries++) {
    const r = rnd(seed * 1000 + tries);
    const marks = [];
    const kinds = [1, 2, 3, 4, 1, 2, 3, 4, 1, 3, 4, 2];
    for (const k of kinds) {
      for (let t = 0; t < 200; t++) {
        const cx = 1 + Math.floor(r() * 14), cy = 2 + Math.floor(r() * 12);
        if (Math.abs(cx - START[0]) <= 1 && Math.abs(cy - START[1]) <= 1) continue;
        if (marks.some(([x, y]) => Math.max(Math.abs(x - cx), Math.abs(y - cy)) < 3)) continue;
        marks.push([cx, cy, k]); break;
      }
    }
    if (marks.length < kinds.length) continue;
    // 地面がぜんぶ つながっているか
    const blocked = new Set(marks.map(([x, y]) => y * 16 + x));
    const seen = new Set([START[1] * 16 + START[0]]), q = [START];
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy, i = Y * 16 + X; if (X < 1 || X > 14 || Y < 2 || Y > 13 || blocked.has(i) || seen.has(i)) continue; seen.add(i); q.push([X, Y]); } }
    if (seen.size !== 14 * 12 - marks.length) continue;
    return marks;
  }
  throw new Error('地図が作れない');
}
const LAYOUTS = [1, 2, 3, 4].map(layout);
// タイトルの地図: 見える帯（5〜6 行め）に目じるしを少し
const TITLE_MARKS = [[3, 6, 1], [6, 6, 4], [10, 6, 3], [13, 6, 2], [2, 3, 3], [12, 10, 1]];

export function build() {
  const c = makeChr();
  const { sym } = c;
  const msg = (...a) => msg0(c, ...a);

  // 背景の絵
  c.big(0, 'blank', BG.blank);
  c.font();
  c.CH["'"] = c.tile(0, shadow(APOS.map((r) => r.replace(/3/g, '.')), () => '1'));
  // 地図のしかけ: 同じ 8×8 は 1 枚に
  const seen = new Map();
  const tileD = (r8) => { const k = r8.join('/'); if (!seen.has(k)) seen.set(k, c.tile(0, r8)); return seen.get(k); };
  const MT = { hud: [0, 0, 0, 0] };
  for (const n of MTNAMES) MT[n] = [0, 1, 2, 3].map((q) => tileD(quad(MTSRC[n], q)));
  for (const k of ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'bar0', 'bar1', 'bar2', 'bar3', 'bar4', 'bar5', 'bar6', 'bar7', 'bar8', 'barL', 'barR']) c.big(0, k, BG[k]);
  // 題の大きな字: 上がクリーム・下の3行は だいだい、右下に黒い影
  for (const [k, rows] of Object.entries(KANA)) c.big(0, 'k_' + k, shadow(rows, (y) => (y < 11 ? '1' : '2')));
  // スプライト
  c.big(1, 'none', BG.blank);
  for (const [k, rows] of Object.entries(SP)) c.big(1, k, rows);
  const T = (name) => { const v = c.sym['T_' + name.toUpperCase()]; if (v === undefined) throw new Error('ない絵: ' + name); return v; };
  const tabs = [0, 1, 2, 3].map((q) => [...MT_A, ...MT_W].map((n) => MT[n][q]));
  sym.NMT = MT_A.length;
  sym.T_BLANK = 0;

  // ---- 字（0 かな・1 英語）。同じ場所に同じ長さで（短いほうを空白でうめる）。# は数字の場所 ----
  const MSGS = [];
  const len = (s) => [...s].length;
  const pad = (s, n) => s + ' '.repeat(Math.max(0, n - len(s)));
  const bi = (name, col, row, ja, en, w) => {
    w = w ?? Math.max(len(ja), len(en));
    MSGS.push([name, col, row, pad(ja, w), pad(en, w)]);
  };
  const ctr = (name, row, ja, en) => { const w = Math.max(len(ja), len(en)); bi(name, 16 - Math.ceil(w / 2), row, ja + ' '.repeat(w - len(ja)), en + ' '.repeat(w - len(en)), w); };
  // 左よせでなく、ことばごとに まん中へ（同じ幅の中で）
  const ctr2 = (name, row, ja, en) => {
    const w = Math.max(len(ja), len(en));
    const cj = ' '.repeat(Math.floor((w - len(ja)) / 2)) + ja, ce = ' '.repeat(Math.floor((w - len(en)) / 2)) + en;
    bi(name, 16 - Math.ceil(w / 2), row, cj, ce, w);
  };
  // 字の段（1 行め・1〜9 列）
  const ST = 9;
  bi('st_aut', 1, 1, 'あき', 'AUTUMN', ST);
  bi('st_win', 1, 1, 'ふゆ', 'WINTER', ST);
  bi('st_spr', 1, 1, 'はる', 'SPRING', ST);
  bi('st_seen', 1, 1, 'みられた!', 'SEEN!', ST);
  bi('st_miss', 1, 1, 'はずれ', 'NOTHING', ST);
  bi('st_stolen', 1, 1, 'とられた!', 'STOLEN!', ST);
  bi('st_found', 1, 1, 'みつけた!', 'FOUND!', ST);
  bi('st_none', 1, 1, '', '', ST);
  // タイトル
  ctr2('how1', 18, 'どんぐりを ひろって A で うめる', 'GRAB ACORNS. A: BURY');
  ctr2('how2', 20, 'ふゆに おもいだして A で ほる', 'IN WINTER  A: DIG UP');
  ctr2('how3', 22, 'みられると とられるよ!', 'BURY WHEN UNWATCHED!');
  ctr2('push', 25, 'START を おしてね', 'PUSH START');
  bi('push_off', 9, 25, '', '', 14);
  // 季節のはじめの板（12〜19 行）
  ctr2('ia1', 13, '#ねんめの あき', 'YEAR #  AUTUMN');
  ctr2('ia2', 15, 'どんぐりを #こ うめよう', 'BURY # ACORNS');
  ctr2('ia3', 17, 'みられないように!', "DON'T BE SEEN!");
  ctr2('iw1', 13, '#ねんめの ふゆ', 'YEAR #  WINTER');
  ctr2('iw2', 15, 'うめた ばしょを ほろう', 'DIG WHERE YOU BURIED');
  ctr2('iw3', 17, '#こ みつけよう', 'FIND # TO EAT');
  ctr2('is1', 13, 'はる', 'SPRING');
  ctr2('is2', 15, 'わすれた どんぐりから #ほん めが でた', '# ACORNS SPROUTED');
  ctr2('is3a', 17, 'たべものが たりない...', 'NOT ENOUGH FOOD...');
  ctr2('is3b', 17, 'もりが そだった!', 'A FOREST GREW!');
  ctr2('is3c', 17, 'つぎの としへ', 'ON TO NEXT YEAR');
  // 結果の板（4〜15 行）
  ctr2('r_fail', 6, 'ふゆを こせなかった', 'WINTER WAS TOO LONG');
  ctr2('r_win', 6, '5ねん いきぬいた!', 'YOU LIVED 5 YEARS!');
  const RC = 5, RW = 16;
  bi('r_found', RC, 9, pad('みつけた どんぐり', RW) + '0000', pad('ACORNS FOUND', RW) + '0000');
  bi('r_best', RC, 11, pad('さいこう', RW) + '0000', pad('BEST', RW) + '0000');
  bi('r_tree', RC, 13, pad('めが でた かず', RW) + '0000', pad('NEW TREES', RW) + '0000');
  ctr2('r_new', 15, 'しんきろく!', 'NEW RECORD!');
  ctr2('r_push', 17, 'START を おしてね', 'PUSH START');
  bi('r_push_off', 16 - 8, 17, '', '', 16);
  sym.ADDR_EFOUND = addr(RC + RW, 9);
  sym.ADDR_EBEST = addr(RC + RW, 11);
  sym.ADDR_ETREE = addr(RC + RW, 13);
  sym.ADDR_THI = addr(15, 1);
  sym.ADDR_CNT = addr(12, 1);
  sym.ADDR_BAR = addr(17, 1);
  sym.ADDR_BARL = addr(16, 1);
  sym.ADDR_BARR = addr(29, 1);
  sym.T_SLASH = c.CH['/'];
  sym.T_BAR0 = T('bar0');
  MSGS.forEach(([name], i) => { sym['M_' + name.toUpperCase()] = i; });
  sym.MSG_N = MSGS.length;
  const digAddr = (col, row, s) => { const i = [...s].indexOf('#'); return i < 0 ? 0 : addr(col + i, row); };

  // 題の大きな字（2 行）と小さな字
  const title = ['RI', 'SU', 'no', null, 'ka', 'ku', 'si', 'go', 'to'];
  const tcol = 16 - title.length;
  const kTop = title.flatMap((k) => (k ? [T('k_' + k), T('k_' + k) + 1] : [0, 0]));
  const kBot = title.flatMap((k) => (k ? [T('k_' + k) + 2, T('k_' + k) + 3] : [0, 0]));
  const raw = (label, col, row, tiles) => { const a = addr(col, row); return `${label}: .byte ${a >> 8}, ${a & 0xff}, ${tiles.length}, ${tiles.join(', ')}`; };

  // ---- 曲: 森のワルツ（ハ長調・3 拍子）と、おわりの短い曲 ----
  const A = ['E5:2 G5:1 | C', 'C6:2 B5:1 | G', 'A5:2 G5:1 | F', 'E5:3 | C', 'F5:2 A5:1 | F', 'G5:2 E5:1 | C', 'D5:2 E5:1 | G', 'C5:3 | C'];
  const B = ['A4:1 C5:1 E5:1 | Am', 'A5:2 G5:1 | F', 'E5:1 D5:1 C5:1 | C', 'D5:3 | G', 'E5:1 F5:1 G5:1 | C', 'A5:2 F5:1 | F', 'E5:2 D5:1 | G', 'C5:3 | C'];
  const B2 = ['A4:1 C5:1 E5:1 | Am', 'G5:2 E5:1 | C', 'F5:1 E5:1 D5:1 | Dm', 'E5:3 | Am', 'C5:1 D5:1 E5:1 | F', 'G5:2 C6:1 | C', 'B5:2 D5:1 | G', 'C5:2 -:1 | C'];
  const songs = {
    main: { tracks: compose({ beat: 18, bars: [...A, ...B, ...A, ...B2] }), duty: 0x80 },
    over: { tracks: [track('E5 12 G5 12 C6 12 B5 12 G5 12 A5 18 G5 54', false, 0xfe), track('C3 24 G2 24 F2 24 C3 54', true, 0xfe)], duty: 0x80 },
  };
  const hex = (n) => '$' + n.toString(16).toUpperCase().padStart(2, '0');
  const pals = (bgp) => `.byte ${[...bgp, ...SPR].flat().map(hex).join(',')}`;
  const gvar = Array.from({ length: 16 }, (_, i) => [0, 13, 14, 15][(i * 7 + (i >> 2)) & 3]);
  const lay = (m) => `.byte ${m.flatMap(([x, y, k]) => [y * 16 + x, k]).join(', ')}, $FF`;

  const data = `
; ---- ここから下はビルドが作ったデータ ----
palette:
pal_aut: ${pals(AUT)}
pal_win: ${pals(WIN)}
pal_spr: ${pals(SPRG)}
mt_tl: .byte ${tabs[0].join(',')}
mt_tr: .byte ${tabs[1].join(',')}
mt_bl: .byte ${tabs[2].join(',')}
mt_br: .byte ${tabs[3].join(',')}
mt_pal: .byte ${[...MT_PAL, ...MT_PAL].join(',')}
gvar: .byte ${gvar.join(',')}
lay_lo: .byte ${LAYOUTS.map((_, i) => `<lay_${i}`).join(', ')}
lay_hi: .byte ${LAYOUTS.map((_, i) => `>lay_${i}`).join(', ')}
${LAYOUTS.map((m, i) => `lay_${i}: ${lay(m)}`).join('\n')}
lay_title: ${lay(TITLE_MARKS)}
${raw('m_ktop', tcol, 5, kTop)}
${raw('m_kbot', tcol, 6, kBot)}
${msg('m_name', 16 - 8, 8, "SQUIRREL'S STASH")}
${msg('m_lab', 16 - 7, 10, 'ASOBI LAB 2026')}
${msg('m_hi', 12, 1, 'HI')}
${MSGS.map(([name, col, row, ja, en]) => `${msg(`m_${name}_0`, col, row, ja.replace(/#/g, '0'))}\n${msg(`m_${name}_1`, col, row, en.replace(/#/g, '0'))}`).join('\n')}
msg_lo: .byte ${[0, 1].flatMap((l) => MSGS.map(([n]) => `<m_${n}_${l}`)).join(', ')}
msg_hi: .byte ${[0, 1].flatMap((l) => MSGS.map(([n]) => `>m_${n}_${l}`)).join(', ')}
md_lo: .byte ${[3, 4].flatMap((l) => MSGS.map((m) => digAddr(m[1], m[2], m[l]) & 0xff)).join(', ')}
md_hi: .byte ${[3, 4].flatMap((l) => MSGS.map((m) => digAddr(m[1], m[2], m[l]) >> 8)).join(', ')}
${periodData()}
${songData(songs, sym)}
${voiceData([6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2], 0x18, sym)}
`;
  return { chr: c.chr, count: c.count, sym, data };
}
