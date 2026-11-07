// カワセミ ダイブ のデータ（絵・画面・曲）。tools/build.mjs が呼ぶ
import { SP, KANA, hash, dith } from './art.mjs';
import { makeChr, shadow, screen, text as text0, pal, packNt, addr, msg as msg0, track, periodData, songData, voiceData, compose } from '../../tools/lib.mjs';

export const BATTERY = true; // いちばん高い点を $6000 に残す

// 背景: 0 空と むこう岸の森・1 木の幹と枝と川底・2 水の面・3 字と深い水（どれも 0 番は こい青緑 $0C）
// スプライト: 0 カワセミ・1 魚・2 ナマズ・3 しぶきと点
const U = 0x0c;
export const PALETTES = [
  [U, 0x21, 0x31, 0x1a], [U, 0x07, 0x17, 0x21], [U, 0x1c, 0x2c, 0x30], [U, 0x30, 0x27, 0x0f],
  [U, 0x0f, 0x11, 0x27], [U, 0x0f, 0x10, 0x30], [U, 0x0f, 0x18, 0x38], [U, 0x30, 0x2c, 0x27],
];
// ことばの色 → パレットごとの番号
const CMAP = [
  { U: 0, sky: 1, cloud: 2, green: 3 },
  { U: 0, dk: 1, br: 2, sky: 3 },
  { U: 0, w1: 1, w2: 2, wh: 3 },
  { U: 0, wh: 1, or: 2, bk: 3 },
];

// 場所（ドット）
const SURF = 128, PERCH = 88, BRANCH_END = 108;
// とびこみの決まり（8.8。game.s と同じ数を使う）: 空では だんだん速く、水に入ると 水の手ごたえで おそくなる
export const DIVE = { DV0: 0x100, AIR_ACC: 0x30, VMAX: 0x480, WATER_DEC: 0x22, UP_W: 0x10000 - 0x180, UP_A: 0x10000 - 0x140, PERCH_Y: 65, BEAKX: 88 };
// くちばしの深さを 1 フレームずつ（game.s の bird_dive と同じ）。はずれて止まるまで
export function diveTrack() {
  let y = DIVE.PERCH_Y * 256, v = DIVE.DV0, wet = false;
  const out = [];
  for (;;) {
    if ((y >> 8) + 23 < SURF) { v = Math.min(DIVE.VMAX, v + DIVE.AIR_ACC); }
    else { wet = true; v -= DIVE.WATER_DEC; if (v < 0) break; }
    y += v;
    out.push({ beak: (y >> 8) + 23, wet });
  }
  return out;
}

// 区画（16×16）のパレット
function attrAt(bx, by) {
  if (by === 0) return 3;                         // 字の段
  if (by <= 7) {
    if (bx <= 1) return 1;                        // 木の幹
    if (by === 5 && bx <= 6) return 1;            // 枝（10〜11 行）
    return 0;
  }
  if (by <= 9) return 2;                          // 水の面（16〜19 行）
  if (by <= 13) return 3;                         // 深い水（20〜27 行）
  return 1;                                       // 川底（28〜29 行）
}

// ---------- 景色（ことばの色を返す） ----------
const trunkR = (y) => Math.min(31.5, 25 + Math.sin(y * 0.09) * 1.2 + Math.max(0, y - 104) * 0.3);
const branchTop = (x) => PERCH - (x < 70 ? (70 - x) * 0.05 : 0);
const branchTh = (x) => Math.max(2.4, 7 - (x - 24) * 0.05);
const canopy = (x) => { const u = x & 63; return 106 - 4 * Math.sin((u / 64) * Math.PI * 2) - 3 * Math.abs(Math.sin((u / 64) * Math.PI * 6)) - (hash(u >> 2, 0, 4) < 0.3 ? 1 : 0); };
const CLOUDS = [[60, 42, 14, 5, 1], [184, 58, 16, 5.5, 2]]; // まん中 x・y・はば・高さ・たね
function cloudAt(x, y) {
  for (const [cx, cy, w, h, s] of CLOUDS) {
    const bumps = [0, 1, 2, 3, 4].map((i) => ({ x: cx - w + (i / 4) * 2 * w, y: cy + 1 - Math.sin((i / 4) * Math.PI) * h * 0.7, r: h * (0.55 + 0.45 * Math.sin((i / 4) * Math.PI)) + hash(i, s, 2) }));
    const on = (xx, yy) => yy < cy + h * 0.6 && bumps.some((b) => Math.hypot(xx - b.x, (yy - b.y) * 1.2) < b.r);
    if (on(x, y)) return on(x, y + 2) && y < cy + h * 0.6 - 2 ? 'cloud' : (dith(x, y, 0.5) ? 'cloud' : 'sky');
  }
  return null;
}
function trunk(x, y) {
  const R = trunkR(y);
  if (x > R) return null;
  if (x > R - 1) return 'dk';                                       // 右のふち（かげ）
  const yy = y & 31;
  const crack = Math.abs(((x + Math.sin(yy * 0.2 + x) * 1.5) % 7) - 3.5) < 0.6;
  if (crack) return y > 108 && hash(x, yy, 3) < 0.4 ? 'U' : 'dk';
  if (x < 6 && dith(x, y, 0.6 - x * 0.08)) return 'dk';            // 左は暗く
  return 'br';
}
function branch(x, y) {
  if (x < 20 || x > BRANCH_END) return null;
  const top = branchTop(x), th = branchTh(x);
  // 小えだ（先から上へ）と葉っぱ（かげ）
  if (x > 94 && x < 107 && Math.abs(y - (top - (x - 94) * 0.55)) < 0.8) return 'dk';
  for (const [lx, ly] of [[104, 80.6], [99, 82.5], [108, 81.5]]) if (Math.hypot((x - lx) * 0.7, y - ly) < 1.4) return 'U';
  if (x > BRANCH_END - 3 && y > top && y < top + 3) return 'dk';
  if (y < top || y > top + th) return null;
  if (y < top + 1) return 'br';                                     // 上の面（光）
  if (y > top + th - 1.6) return 'U';                               // 下のかげ
  if (hash(Math.floor(x / 3), Math.floor(y), 7) < 0.25) return 'dk';
  return y < top + th * 0.5 ? 'br' : 'dk';
}
function scene(x, y) {
  if (y < 16) return 'U';
  const t = trunk(x, y);
  if (t && y < SURF) return t;
  if (y < 32) return dith(x, y, (y - 19) / 13) ? 'sky' : 'U';     // 字の段の下のふち
  if (y < SURF) {
    if (x < 32) return 'sky';                                       // 幹の区画（幹の右の すきまは 空だけ）
    const b = branch(x, y);
    if (b) return b;
    if (y >= 96) {                                                  // むこう岸の森
      const top = canopy(x);
      if (y >= top) {
        if (y > 122) return 'U';                                    // 岸のかげ
        if (y > 114 && dith(x, y, (y - 114) / 9)) return 'U';
        if (y < top + 1.5 && hash(x & 63, y, 1) < 0.5) return 'green';
        if (hash(x & 63, y, 2) < 0.12) return 'U';                  // 葉の すきま
        return 'green';
      }
    }
    return cloudAt(x, y) || 'sky';
  }
  if (y < 224) {                                                    // 水
    if (y === SURF) return (x & 31) < 14 || ((x + 5) & 15) < 3 ? 'wh' : 'w2';
    if (y === SURF + 1) return 'w2';
    if (y < SURF + 8) return (hash(x & 63, y, 6) < 0.06 && (y & 1)) ? 'wh' : 'w2'; // さざ波の光（64 ドットでくり返す）
    if (y < 160) { const l = (y - 136) / 24 * 2; return l < 1 ? (dith(x, y, l) ? 'w1' : 'w2') : (dith(x, y, l - 1) ? 'U' : 'w1'); }
    return 'U';
  }
  // 川底（石: 64 ドットでくり返す）
  const u = x & 63;
  const stones = [[4, 233, 6, 5], [15, 236, 5, 4], [26, 231, 7, 6], [38, 235, 5, 4], [48, 232, 6, 5], [58, 237, 5, 3], [10, 240, 6, 3], [33, 241, 6, 3], [52, 241, 7, 3]];
  for (const [sx, sy, rx, ry] of stones) {
    for (const ox of [-64, 0, 64]) {
      const dx = (u - sx - ox) / rx, dy = (y - sy) / ry;
      if (dx * dx + dy * dy <= 1) {
        if (dx < -0.2 && dy < -0.45) return 'sky';                  // ぬれた光
        if (dx + dy > 0.7) return 'dk';
        return 'br';
      }
    }
  }
  return y > 236 ? 'dk' : 'U';
}

export function build() {
  const c = makeChr();
  const { sym } = c;
  const text = (...a) => text0(c, ...a), msg = (...a) => msg0(c, ...a);

  // 背景の絵: 0 番は からっぽ・字・題の大きな字
  c.big(0, 'blank', Array(8).fill('........'));
  c.font();
  // kana.mjs にない字（ひ に濁点。lib.mjs の kana() と同じ形で 先に足す）
  c.CH['び'] = c.tile(0, shadow([...['111.1.1', '..1..1.', '.1....1', '1.....1', '1.....1', '.1...1.', '..111..'].map((r) => r + '.'), '........'], () => '1'));
  for (const [k, rows] of Object.entries(KANA)) c.big(0, 'k_' + k, shadow(rows, (y) => (y < 10 ? '1' : '2')));
  // おなかの ぼう（パレット 3: 白い わく・だいだいの中身）。0〜8 ドット
  for (let n = 0; n <= 8; n++) c.big(0, 'bar' + n, Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => (y === 1 || y === 6 ? '1' : y > 1 && y < 6 ? (x < n ? (y === 2 ? '1' : '2') : '.') : y === 7 ? '3' : '.')).join('')));
  c.big(0, 'barL', ['........', '.1111111', '.1......', '.1......', '.1......', '.1......', '.1111111', '..333333']);
  c.big(0, 'barR', ['........', '1111....', '...1....', '...1....', '...1....', '...1....', '1111....', '3333....']);
  // 題の板（パレット 3: 白い わく・だいだいの うちわく）
  const plate = (fx, fy) => Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => {
    const px = fx === 0 ? x : fx === 2 ? 7 - x : 9, py = fy === 0 ? y : fy === 2 ? 7 - y : 9;
    const d = Math.min(px, py);
    return d < 1 ? '1' : d === 2 ? '2' : '.';
  }).join(''));
  [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]].forEach(([fx, fy], i) => c.big(0, 'p' + i, plate(fx, fy)));
  const T = (name) => c.sym['T_' + name.toUpperCase()];

  // 景色を 8×8 に切り、同じ絵は1枚にまとめる
  const seen = new Map();
  const tileOf = (rows) => { const k = rows.join(''); if (!seen.has(k)) seen.set(k, k === '.'.repeat(64) ? T('blank') : c.tile(0, rows)); return seen.get(k); };
  const base = screen();
  for (let row = 0; row < 30; row++) for (let col = 0; col < 32; col++) {
    const p = attrAt(col >> 1, row >> 1);
    const rows = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => {
      const name = scene(col * 8 + x, row * 8 + y), v = CMAP[p][name];
      if (v === undefined) throw new Error(`色 ${name} がパレット ${p} にない（${col * 8 + x}, ${row * 8 + y}）`);
      return v ? String(v) : '.';
    }).join(''));
    base.nt[row][col] = tileOf(rows);
  }
  for (let by = 0; by < 15; by++) for (let bx = 0; bx < 16; bx++) base.at[by][bx] = attrAt(bx, by);
  if (process.env.KF_TILES) { const per = base.nt.map((r) => new Set(r).size); console.log('景色の絵', seen.size, '行ごと', per.join(' ')); }
  const copy = () => ({ nt: base.nt.map((r) => [...r]), at: base.at.map((r) => [...r]) });
  const box = (s, c0, r0, c1, r1) => {
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
      const top = row === r0, bot = row === r1, left = col === c0, right = col === c1;
      s.nt[row][col] = T(top ? (left ? 'p0' : right ? 'p2' : 'p1') : bot ? (left ? 'p5' : right ? 'p7' : 'p6') : left ? 'p3' : right ? 'p4' : 'blank');
    }
    pal(s, c0, r0, c1 - c0 + 1, r1 - r0 + 1, 3);
  };
  const clear = (s, row, c0, c1) => { for (let col = c0; col <= c1; col++) s.nt[row][col] = T('blank'); };

  const titles = [], plays = [], ends = [];
  for (const en of [false, true]) {
    const L = (ja, e) => (en ? e : ja);
    // タイトル: 右上に題の板（4〜11 行・12〜29 列。題の字と英字のあいだを1行あける）
    const t = copy();
    box(t, 12, 4, 29, 11);
    [['KA', 13], ['WA', 15], ['SE', 17], ['MI', 19], ['DA', 23], ['I', 25], ['BU', 27]].forEach(([k, col]) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) t.nt[5 + y][col + x] = T('k_' + k) + y * 2 + x;
    });
    text(t, 14, 8, 'KINGFISHER DIVE');
    text(t, 14, 10, 'ASOBI LAB 2026');
    text(t, 12, 1, 'HI');
    const center = (s, row, str) => text(s, 16 - Math.ceil([...str].length / 2), row, str);
    center(t, 20, L('A で とびこんで さかなを とる', 'PRESS A: DIVE FOR A FISH'));
    center(t, 22, L('おなかが からに なると おしまい', 'EMPTY BELLY MEANS GAME OVER'));
    center(t, 24, L('なまずは おおきすぎて とれない', 'CATFISH ARE TOO BIG TO EAT'));
    titles.push(t);

    // あそぶ: 字の段に てん・おなか・HI
    const p = copy();
    text(p, 1, 1, L('てん', 'SCORE'));
    text(p, L(13, 12), 1, L('おなか', 'FOOD'));
    p.nt[1][16] = T('barL'); p.nt[1][23] = T('barR');
    for (let col = 17; col < 23; col++) p.nt[1][col] = T('bar8');
    text(p, 24, 1, 'HI');
    plays.push(p);
    // 結果: 深い水に板（18〜27 行・6〜25 列）
    const e = copy();
    for (let k = 0; k < 2; k++) e.nt[k] = [...p.nt[k]];
    box(e, 6, 18, 25, 27);
    ends.push(e);
  }
  sym.ADDR_THI = addr(15, 1);
  sym.ADDR_SCORE = addr(7, 1);
  sym.ADDR_BAR = addr(17, 1);   // おなかの ぼう 6 枚（48 まで）
  sym.ADDR_PHI = addr(27, 1);
  sym.ADDR_ESCORE = addr(19, 20);
  sym.ADDR_EBEST = addr(19, 22);
  sym.T_BAR0 = T('bar0');
  for (const [k, v] of Object.entries(DIVE)) sym[k] = v;
  // 見本のとびこみ: 浅い所（138）の魚に くちばしが はじめて とどくフレーム T。魚（1 ドット／フレーム）のまん中が T-1 フレームで 87.5 に来る所
  const tr = diveTrack(), T138 = tr.findIndex((f) => f.wet && Math.abs(f.beak - 138) < 5) + 1;
  sym.DEMO_R = Math.round(87.5 - (T138 - 1) - 3);
  sym.DEMO_L = Math.round(87.5 + (T138 - 1) - 3);

  // 字（0 かな・1 英語）。同じ場所に同じ長さで（短いほうを空白でうめる）
  const MSGS = [];
  const len = (s) => [...s].length;
  const bi = (name, col, row, ja, en) => {
    const w = Math.max(len(ja), len(en));
    MSGS.push([name, col, row, ja + ' '.repeat(w - len(ja)), en + ' '.repeat(w - len(en))]);
  };
  const pad = (s, n) => s + ' '.repeat(n - len(s));
  bi('push', 10, 26, 'START を おしてね', ' PUSH START');
  bi('push_off', 10, 26, ' '.repeat(13), '');
  bi('hint', 8, 22, '   A で とびこむ', 'PRESS A TO DIVE');
  bi('hint_off', 8, 22, ' '.repeat(15), '');
  bi('e_score', 8, 20, pad('てん', 11) + '0000', pad('SCORE', 11) + '0000');
  bi('e_best', 8, 22, pad('さいこう', 11) + '0000', pad('BEST', 11) + '0000');
  bi('e_new', 10, 24, ' しんきろく!', 'NEW RECORD!');
  bi('pause', 12, 22, 'ひとやすみ', '  PAUSE');
  bi('pause_off', 12, 22, ' '.repeat(7), '');
  MSGS.forEach(([name], i) => { sym['M_' + name.toUpperCase()] = i; });
  sym.MSG_N = MSGS.length;

  // スプライト
  c.big(1, 'none', Array(8).fill('........'));
  for (const [k, rows] of Object.entries(SP)) c.big(1, k, rows);

  // 曲: 川辺の 3 拍子（ト長調ふう → ハ長調で書く）と、おなかが すいたときの短い曲
  const A = ['G5:1 E5:1 G5:1 | C waltz', 'A5:2 G5:1 | F waltz', 'E5:1 D5:1 C5:1 | C waltz', 'D5:3 | G waltz',
    'G5:1 E5:1 G5:1 | C waltz', 'C6:2 A5:1 | F waltz', 'G5:1 F5:1 D5:1 | G waltz', 'C5:3 | C waltz'];
  const B = ['E5:1 F5:1 G5:1 | C waltz', 'A5:1.5 G5:0.5 F5:1 | F waltz', 'D5:1 E5:1 F5:1 | Dm waltz', 'E5:3 | Am waltz',
    'C5:1 D5:1 E5:1 | Am waltz', 'F5:2 A5:1 | F waltz', 'G5:2 B4:1 | G waltz', 'C5:2 -:1 | C waltz'];
  const Q = 10, H = 20;
  const songs = {
    main: { tracks: compose({ beat: 14, bars: [...A, ...B, ...A, ...B.slice(0, 6), 'G5:3 | G waltz', 'C5:2 -:1 | C waltz'] }), duty: 0x80 },
    over: { tracks: [track(`E5 ${Q} D5 ${Q} C5 ${Q} G4 ${Q} A4 ${Q} B4 ${Q} C5 ${H * 3}`, false, 0xfe), track(`C3 ${H} G2 ${H} F2 ${H} G2 ${H} C3 ${H * 2}`, true, 0xfe)], duty: 0x80 },
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
${voiceData([6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2], 0x18, sym)}
`;
  return { chr: c.chr, count: c.count, sym, data };
}
