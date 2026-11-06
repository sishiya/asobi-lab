// ミツバチの おどり のデータ（絵・画面・字・曲・表）。tools/build.mjs が呼ぶ
import { BG, KANA, SP, GRASS_POOL } from './art.mjs';
import { makeChr, shadow, screen, put as put0, text as text0, pal, packNt, addr, msg as msg0, track, periodData, songData, voiceData, compose } from '../../tools/lib.mjs';

export const BATTERY = true; // ハイスコア（いちばん多く集めた みつ）を $6000 に残す
export const HORIZONTAL = false;

// 画面ごとにパレットを入れかえる（巣と花畑）。スプライトはどちらも同じ: 0 ハチ・1 太陽・2 しるし・3 みつのつぶ
const SPR = [[0x0f, 0x0f, 0x28, 0x30], [0x0f, 0x27, 0x38, 0x30], [0x0f, 0x30, 0x0f, 0x28], [0x0f, 0x27, 0x38, 0x30]];
//   巣: 0 巣板（黒・こげ茶のかべ・こはく色のみつ・ふたと照り）。暗めにして、踊るハチ（黄・白）が浮くように・3 字（クリーム・はちみつ・こげ茶の影）
const HIVE = [[0x0f, 0x07, 0x17, 0x27], [0x0f, 0x07, 0x17, 0x27], [0x0f, 0x07, 0x17, 0x27], [0x0f, 0x37, 0x27, 0x07]];
//   花畑: 0 草（こい緑・緑・明るい緑・黄緑）・1 花（白と黄）・2 巣箱（緑・わら・クリーム）・3 字（クリーム・わら・こげ茶）
const FIELD = [[0x09, 0x19, 0x29, 0x39], [0x09, 0x19, 0x30, 0x28], [0x09, 0x19, 0x27, 0x37], [0x09, 0x37, 0x27, 0x07]];
export const PALETTES = [...HIVE, ...SPR]; // build.mjs の --preview 用

// 向き: 0 = 上（北）から時計回りに 16。ux・uy は 16 倍の向きの長さ
const UX = Array.from({ length: 16 }, (_, d) => Math.round(16 * Math.sin((d * Math.PI) / 8)));
const UY = Array.from({ length: 16 }, (_, d) => Math.round(-16 * Math.cos((d * Math.PI) / 8)));
export const RING = [0, 32, 48, 64, 80, 96]; // 輪 1〜5 の半径（巣のまん中から）
export const CX = 128, CY = 128;               // 花畑の巣のまん中

export function build() {
  const c = makeChr();
  const { sym } = c;
  const put = (...a) => put0(c, ...a), text = (...a) => text0(c, ...a), msg = (...a) => msg0(c, ...a);

  // 背景
  c.big(0, 'blank', BG.blank);
  c.font('1');
  // 矢じるしの字（字の表にないので足す。影は字と同じ）
  const arrow = (rows) => { const t = c.tile(0, shadow(rows, () => '1')); return t; };
  c.CH['↑'] = arrow(['..1.....', '.111....', '1.1.1...', '..1.....', '..1.....', '..1.....', '........', '........']);
  c.CH['↓'] = arrow(['..1.....', '..1.....', '..1.....', '1.1.1...', '.111....', '..1.....', '........', '........']);
  c.CH['←'] = arrow(['..1.....', '.1......', '11111...', '.1......', '..1.....', '........', '........', '........']);
  c.CH['+'] = arrow(['........', '..1.....', '..1.....', '11111...', '..1.....', '..1.....', '........', '........']);
  c.CH['='] = arrow(['........', '........', '11111...', '........', '11111...', '........', '........', '........']);
  c.CH['→'] = arrow(['..1.....', '...1....', '11111...', '...1....', '..1.....', '........', '........', '........']);
  for (const k of ['wall', 'empty', 'honey', 'capped', 'capped2', 'fl0', 'fl1', 'skep', 'bar']) c.big(0, k, BG[k]);
  GRASS_POOL.forEach((rows, i) => c.big(0, 'grass' + i, rows));
  for (const [k, rows] of Object.entries(KANA)) c.big(0, 'k_' + k, shadow(rows, (y) => (y < 7 ? '1' : '2')));
  // スプライト
  c.big(1, 'none', BG.blank);
  for (const [k, rows] of Object.entries(SP)) c.big(1, k, rows);

  const rnd = (i, k) => { let n = (i * 2654435761 + k * 40503) >>> 0; n = Math.imul(n ^ (n >>> 15), 2246822507) >>> 0; return ((n ^ (n >>> 13)) >>> 0) / 4294967296; };

  // 巣板: 16×16 の部屋を、行ごとに 8 ドットずらして並べる。上の段ほど ふた（たまった みつ）、下ほど空。row0 = 巣板のいちばん上の字の行
  function comb(s, row0, row1, k) {
    for (let ry = 0; row0 + ry * 2 < row1; ry++) {
      const row = row0 + ry * 2, odd = ry & 1;
      const depth = (row - row0) / (row1 - row0);
      for (let cx = -1; cx < 17; cx++) {
        const col = cx * 2 + odd;
        const h = rnd(cx * 37 + ry, k);
        const kind = h < 0.55 - depth * 0.8 ? (h < 0.25 ? 'capped2' : 'capped') : h < 0.92 - depth * 0.3 ? 'honey' : 'empty';
        const first = c.sym['T_' + kind.toUpperCase()];
        for (let q = 0; q < 4; q++) {
          const x = col + (q & 1), y = row + (q >> 1);
          if (x < 0 || x > 31 || y >= row1) continue;
          s.nt[y][x] = first + q;
        }
      }
    }
    pal(s, 0, row0, 32, row1 - row0, 0);
  }
  // 字の段（上の 4 行）: こげ茶の帯と下のふち
  const band = (s, row) => { for (let col = 0; col < 32; col++) s.nt[row][col] = c.sym.T_BAR; };

  const T = (en, ja, e) => (en ? e : ja);
  const titles = [], ends = [];
  for (const en of [false, true]) {
    const t = screen();
    comb(t, 18, 30, 3);
    pal(t, 0, 0, 32, 18, 3);
    ['mi', 'tsu', 'ba', 'chi', 'no', 'o', 'do', 'ri'].forEach((k, i) => put(t, 4 + i * 3, 4, 'k_' + k, 2, 2));
    text(t, 12, 8, 'BEE DANCE');
    text(t, 13, 2, 'HI');
    text(t, 16, 2, '000');
    text(t, 9, 14, 'ASOBI LAB 2026');
    band(t, 17);
    titles.push(t);

    const e = screen();
    comb(e, 26, 30, 4);
    pal(e, 0, 0, 32, 26, 3);
    band(e, 25);
    ends.push(e);
  }
  sym.ADDR_HI = addr(16, 2);

  // 巣の画面（字の段 4 行・巣板）
  const hive = screen();
  comb(hive, 4, 30, 1);
  pal(hive, 0, 0, 32, 4, 3);
  band(hive, 3);
  // 花畑（字の段 4 行・草・まん中に巣箱）
  const field = screen();
  pal(field, 0, 0, 32, 4, 3);
  band(field, 3);
  for (let row = 4; row < 30; row++) for (let col = 0; col < 32; col++) {
    const h = rnd(row * 32 + col, 9);
    field.nt[row][col] = c.sym.T_GRASS0 + (h < 0.7 ? Math.floor((h / 0.7) * 4) : h < 0.9 ? 4 + Math.floor(((h - 0.7) / 0.2) * 3) : 7);
  }
  put(field, 14, 14, 'skep', 4, 4);
  pal(field, 14, 14, 4, 4, 2);
  sym.ADDR_FLIGHT = addr(2, 1);
  sym.ADDR_HONEY = addr(29, 1);

  // 字（0 かな・1 英語）。同じ場所に同じ長さで（短いほうを空白でうめる）。M_名前 が番号、game.s の say_ptr がことばで選ぶ
  const MSGS = [];
  const len = (t) => [...t].length;
  const bi = (name, col, row, ja, en) => {
    const w = Math.max(len(ja), len(en));
    MSGS.push([name, col, row, ja + ' '.repeat(w - len(ja)), en + ' '.repeat(w - len(en))]);
  };
  const line = (ja, en) => [ja + ' '.repeat(28 - len(ja)), en + ' '.repeat(28 - len(en))]; // 字の段の 2 行目（28 字）
  bi('push', 9, 11, 'START を おしてね', '  PUSH START');
  bi('push_off', 9, 11, ' '.repeat(16), '');
  bi('flight', 2, 1, '00 かいめ', '00 OF 10');       // 00 に数字（ADDR_FLIGHT）
  bi('honey', 23, 1, 'みつ    000', 'HONEY 000');   // 000 に数字（ADDR_HONEY）
  bi('h_hive', 2, 2, ...line('うえ = たいようの むき   A そとへ', 'UP = TO THE SUN    A: GO OUT'));
  bi('h_wait', 2, 2, ...line('なかまの おどりを よく みて', 'WATCH YOUR SISTER DANCE'));
  bi('h_aim', 2, 2, ...line('←→ むき ↑↓ とおさ A とぶ', '←→ AIM  ↑↓ FAR  A FLY'));
  bi('h_fly', 2, 2, ...line('ぶーん', 'BZZZ...'));
  bi('h_hit', 2, 2, ...line('はなが いっぱい! みつ +10', 'FLOWERS! HONEY +10'));
  bi('h_near', 2, 2, ...line('においで みつけた! みつ +5', 'FOUND BY SMELL! HONEY +5'));
  bi('h_miss', 2, 2, ...line('はなが なかった', 'NO FLOWERS HERE...'));
  // おわり（1日の おわり・本物のしくみ）
  const p17 = (t) => t + ' '.repeat(17 - len(t)) + '000'; // 数字（000）は どちらのことばでも 23 列めから
  const END = {
    ja: [[3, 'ひが くれた。'], [6, p17('きょうの みつ')], [8, p17('いちばん')], [12, 'みつばちは くらい すの なかで'], [14, 'まうえを たいようの むきに して'],
      [16, 'はなの ばしょを おどりで つたえる。'], [18, 'ふる ながさが とおさ。'], [21, 'あそんでくれて ありがとう'], [23, 'START で もういちど']],
    en: [[3, 'THE SUN HAS SET.'], [6, p17('HONEY TODAY')], [8, p17('BEST')], [12, 'IN THE DARK HIVE A HONEYBEE'], [14, 'TELLS WHERE FLOWERS ARE BY'],
      [16, 'DANCING: STRAIGHT UP MEANS'], [18, 'TOWARD THE SUN.'], [21, 'THANK YOU FOR PLAYING'], [23, 'PRESS START']],
  };
  ends.forEach((e, i) => {
    const lines = i ? END.en : END.ja;
    for (const [r, str] of lines) text(e, str.endsWith('000') ? 6 : Math.floor((32 - len(str)) / 2), r, str);
  });
  sym.ADDR_END_TODAY = addr(23, 6);
  sym.ADDR_END_BEST = addr(23, 8);
  MSGS.forEach(([name], i) => { sym['M_' + name.toUpperCase()] = i; });
  sym.MSG_N = MSGS.length;

  // 花畑で、向き d・輪 k の場所（まん中の点）。ハチの絵の左上は −8
  const POSX = [], POSY = [];
  for (let d = 0; d < 16; d++) for (let k = 0; k < 6; k++) { POSX.push(CX + Math.round((UX[d] * RING[k]) / 16)); POSY.push(CY + Math.round((UY[d] * RING[k]) / 16)); }
  sym.CX = CX; sym.CY = CY;

  // 曲: 花畑ののどかなワルツ（ヘの長調）と、1日のおわり
  const A = ['A4:1 C5:1 F5:1 | F', 'E5:2 C5:1 | C', 'D5:1 C5:1 A4:1 | Dm', 'C5:3 | F',
    'A4:1 C5:1 F5:1 | F', 'G5:2 E5:1 | C', 'F5:1 E5:1 D5:1 | Dm', 'C5:3 | C'];
  const B = ['D5:1 F5:1 A5:1 | Dm', 'G5:2 F5:1 | C', 'E5:1 D5:1 C5:1 | F', 'D5:3 | G',
    'C5:1 D5:1 E5:1 | C', 'F5:2 A4:1 | F', 'G4:1 A4:1 B4:1 | G', 'C5:3 | C'];
  const breath = ['-:3 | F', '-:3 | C'];
  const songs = {
    main: { tracks: compose({ beat: 20, bars: [...A, ...B, ...A, ...breath] }), duty: 0x80 },
    end: { tracks: compose({ beat: 26, bars: [...B, ...A], loop: true }), duty: 0x40 },
  };
  const hex = (n) => '$' + n.toString(16).toUpperCase().padStart(2, '0');
  const sb = (v) => v & 0xff;

  const data = `
; ---- ここから下はビルドが作ったデータ ----
palette:
pal_hive:
  .byte ${[...HIVE, ...SPR].flat().map(hex).join(',')}
pal_field:
  .byte ${[...FIELD, ...SPR].flat().map(hex).join(',')}
${titles.map((s, i) => `nt_title_${i}:\n  .byte ${packNt(s).join(',')}`).join('\n')}
${ends.map((s, i) => `nt_end_${i}:\n  .byte ${packNt(s).join(',')}`).join('\n')}
nt_hive:
  .byte ${packNt(hive).join(',')}
nt_field:
  .byte ${packNt(field).join(',')}
${MSGS.map(([name, col, row, ja, en]) => `${msg(`m_${name}_0`, col, row, ja)}\n${msg(`m_${name}_1`, col, row, en)}`).join('\n')}
msg_lo: .byte ${[0, 1].flatMap((l) => MSGS.map(([n]) => `<m_${n}_${l}`)).join(', ')}
msg_hi: .byte ${[0, 1].flatMap((l) => MSGS.map(([n]) => `>m_${n}_${l}`)).join(', ')}
ux: .byte ${UX.map(sb).join(',')}
uy: .byte ${UY.map(sb).join(',')}
pos_x: .byte ${POSX.join(',')}
pos_y: .byte ${POSY.join(',')}
ring_r: .byte ${RING.join(',')}
${periodData()}
${songData(songs, sym)}
${voiceData([7, 7, 6, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3], 0x28, sym)}
`;
  return { chr: c.chr, count: c.count, sym, data };
}
