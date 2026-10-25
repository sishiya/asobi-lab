// 恐竜かけっこ牧場 8bit のデータ（絵・画面・曲・表・ライバル）。tools/build.mjs が呼ぶ
import { KANA8, BG, SP } from './art.mjs';
import { makeChr, screen, put as put0, text as text0, pal, packNt, addr, msg as msg0, track, periodData, songData, voiceData, compose } from '../../tools/lib.mjs';
import { FONT } from '../font.mjs';

export const BATTERY = true; // 牧場を $6000 に残す
// 紙 $37、インク $07、セピア $17
export const PALETTES = [[0x37, 0x07, 0x17, 0x27], [0x37, 0x07, 0x17, 0x18], [0x37, 0x07, 0x16, 0x27], [0x37, 0x07, 0x19, 0x29],
  [0x37, 0x07, 0x17, 0x30], [0x37, 0x01, 0x11, 0x30], [0x37, 0x16, 0x27, 0x30], [0x37, 0x0b, 0x1a, 0x30]];

// 能力から走りを決める式（game.s の derive と同じ。ビルドでライバルを選ぶのにも使う）
//   大きい体は歩幅がのびるが、重くて筋肉が足りなくなる（Hutchinson & Garcia 2002 の考え方）
//   脚が長く・足が速いほど転びやすく、しっぽでつり合いをとる
export function derive(s, l, m, t, p) {
  const h = s >> 1;
  const want = 18 + l + p + h, cap = 26 + 2 * m - s - h;
  const kmh = Math.max(8, Math.min(want, cap));
  const need = l + p + h, v = 10 + 2 * t;
  return { kmh, acc: Math.max(3, 8 + m - h), fall: v >= need ? 0 : Math.min(63, (need - v) * 2) };
}

// ライバル: 杯3つ × かけっこ3つ × 3頭の速さ（km/h）。転ばない体から、決まった並びで選ぶ
export const RIVAL_KMH = [[22, 24, 26], [25, 27, 29], [28, 30, 32], [31, 33, 35], [34, 36, 38], [36, 38, 40], [38, 40, 42], [40, 42, 44], [42, 44, 46]];
function pickRivals() {
  const by = {};
  for (let s = 0; s < 16; s++) for (let l = 0; l < 16; l++) for (let m = 0; m < 16; m++) for (let t = 0; t < 16; t++) for (let p = 0; p < 16; p++) {
    const d = derive(s, l, m, t, p);
    if (d.fall || d.kmh !== Math.min(18 + l + p + (s >> 1), 26 + 2 * m - s - (s >> 1))) continue;
    (by[d.kmh] ||= []).push([s, l, m, t, p]);
  }
  let seed = 11;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  return RIVAL_KMH.flat().map((k) => { const list = by[k]; return list[rnd(list.length)]; });
}

export function build() {
  const c = makeChr();
  const { sym } = c;
  const put = (...a) => put0(c, ...a), text = (...a) => text0(c, ...a), msg = (...a) => msg0(c, ...a);

  // ---- 背景の絵 ----
  c.big(0, 'blank', BG.blank);
  c.font('1');
  // 字の影は使わない（紙に刷ったように）: 影の 3 を消した字に作り直す
  for (const [ch, n] of Object.entries(c.CH)) {
    const o = n * 16;
    for (let y = 0; y < 8; y++) { const both = c.chr[o + y] & c.chr[o + 8 + y]; c.chr[o + y] &= ~both; c.chr[o + 8 + y] &= ~both; }
  }
  c.kanaShadow = false; // かなも影なし
  for (const k of Object.keys(BG)) if (k !== 'blank') c.big(0, k, BG[k]);
  // 題字のかな: 8×8 を 2 倍にして 16×16（赤 2、右下にインクの影 1）
  for (const [k, rows] of Object.entries(KANA8)) {
    const up = [];
    for (const r of rows) { const line = [...r].map((ch) => (ch === '#' ? '22' : '..')).join(''); up.push(line, line); }
    const g = up.map((r) => [...r]);
    for (let y = 1; y < 16; y++) for (let x = 1; x < 16; x++) if (up[y][x] === '.' && up[y - 1][x - 1] === '2') g[y][x] = '1';
    c.big(0, 'k_' + k, g.map((r) => r.join('')));
  }
  // 遠くの火山と丘（32 枚の横長の絵、4 段）。線の高さを決めて、線と、その下のセピアの点で
  const hills = Array.from({ length: 32 }, () => Array(256).fill('.'));
  const hAt = (x) => {
    const v = 22 - 6 * Math.sin(x / 256 * Math.PI * 4) - 3 * Math.sin(x / 256 * Math.PI * 10 + 1);
    const vol = Math.max(0, 14 - Math.abs(x - 170) * 0.35); // 火山
    return Math.round(Math.max(2, v - vol));
  };
  for (let x = 0; x < 256; x++) {
    const y = hAt(x), y2 = hAt(x + 1);
    for (let yy = Math.min(y, y2); yy <= Math.max(y, y2); yy++) hills[yy][x] = '1';
    for (let yy = y + 2; yy < 32; yy++) if ((x * 3 + yy * 5) % 11 === 0) hills[yy][x] = '2';
  }
  for (let x = 162; x < 179; x++) if (x % 3 === 0) hills[(x * 7) % 3][x] = '2'; // 火山のけむり
  // 同じ絵（空だけ・同じ点の並び）は1枚にまとめる（128 枚 → 53 枚。かなの字を入れる場所をあけるため。v018）。hillAt[段][列] が絵の番号
  const hillAt = [], seen = new Map([['........'.repeat(8), 0]]); // 空は blank（0 番）
  for (let ty = 0; ty < 4; ty++) {
    hillAt.push([]);
    for (let tx = 0; tx < 32; tx++) {
      const rows = hills.slice(ty * 8, ty * 8 + 8).map((r) => r.slice(tx * 8, tx * 8 + 8).join(''));
      const key = rows.join('');
      if (!seen.has(key)) seen.set(key, c.tile(0, rows));
      hillAt[ty].push(seen.get(key));
    }
  }

  sym.T_DOT = c.CH['.']; sym.T_S = c.CH.S; sym.T_DASH = c.CH['-'];
  // ---- スプライトの絵 ----
  for (const [k, rows] of Object.entries(SP)) c.big(1, k, rows);
  // 柱の数字（スプライト。インクだけ）
  sym.S_D0 = c.count[1];
  for (let d = 0; d < 10; d++) {
    const rows = FONT[String(d)];
    c.tile(1, Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => (y < 7 && x < 5 && rows[y][x] === '1' ? '1' : '.')).join('')));
  }

  // ---- 画面 ----
  const frame = (s, c0, r0, w, h) => {
    put(s, c0, r0, 'fTL'); put(s, c0 + w - 1, r0, 'fTR'); put(s, c0, r0 + h - 1, 'fBL'); put(s, c0 + w - 1, r0 + h - 1, 'fBR');
    for (let x = c0 + 1; x < c0 + w - 1; x++) { put(s, x, r0, 'fT'); put(s, x, r0 + h - 1, 'fB'); }
    for (let y = r0 + 1; y < r0 + h - 1; y++) { put(s, c0, y, 'fL'); put(s, c0 + w - 1, y, 'fR'); }
  };
  const kana = (s, col, row, list) => list.forEach((k, i) => put(s, col + i * 2, row, 'k_' + k, 2, 2));

  // タイトル・牧場・卵・かけっこの画面は、ことばごとに1枚ずつ（英語 → かな の順。かなの写しは 4096 バイトあと。game.s の lang_fix）
  const T = (en, ja, lang) => (lang === 'ja' ? ja : en);
  const scr = {};
  for (const lang of ['en', 'ja']) {
    const title = screen();
    frame(title, 1, 1, 30, 28);
    kana(title, 10, 5, ['ki', 'yo_s', 'u', 'ri', 'yu_s', 'u']);
    kana(title, 7, 8, ['ka', 'ke', 'tsu_s', 'ko', 'bo', 'ku', 'ji', 'yo_s', 'u']);
    pal(title, 6, 4, 20, 6, 2);
    text(title, 10, 11, 'DINO RACE RANCH');
    text(title, 14, 13, '8BIT');
    text(title, 7, 25, 'ASOBI LAB 2026');
    // 牧場（2×2 の囲い）
    const ranch = screen();
    text(ranch, 2, 1, T('DINO RANCH', 'ぼくじょう', lang));
    for (let k = 0; k < 4; k++) {
      const c0 = (k & 1) * 16, r0 = 3 + (k >> 1) * 12;
      frame(ranch, c0, r0, 16, 12);
      text(ranch, c0 + 2, r0 + 1, 'NO.' + (k + 1));
      T(['SIZE', 'LEGS', 'MUSC', 'TAIL', 'PACE'], ['からだ', 'あし', 'きんにく', 'しっぽ', 'はやさ'], lang).forEach((t, i) => { text(ranch, c0 + 2, r0 + 5 + i, t); for (let b = 0; b < 4; b++) put(ranch, c0 + 7 + b, r0 + 5 + i, 'bar0'); });
    }
    // 卵（3 つの列）
    const eggs = screen();
    text(eggs, T(6, 7, lang), 2, T('THREE EGGS HATCHED!', 'たまごが 3つ かえった!', lang));
    for (let k = 0; k < 3; k++) {
      const c0 = 1 + k * 10;
      frame(eggs, c0, 5, 10, 17);
      T(['S', 'L', 'M', 'T', 'P'], ['か', 'あ', 'き', 'し', 'は'], lang).forEach((t, i) => { text(eggs, c0 + 1, 13 + i * 1, t); });
    }
    text(eggs, 4, 24, T('A:KEEP THIS ONE', 'A:この こを のこす', lang));
    text(eggs, 4, 26, T('B:LET ALL GO', 'B:ぜんぶ にがす', lang));
    // かけっこ（2 枚の画面に同じ絵: 横に 256 ドットごとにくり返す）
    const race = screen();
    for (let x = 0; x < 32; x++) put(race, x, 3, 'rule');
    for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 32; tx++) race.nt[6 + ty][tx] = hillAt[ty][tx];
    for (const col of [0, 16]) { put(race, col, 10, 'poleTop'); put(race, col, 11, 'pole'); put(race, col, 12, 'pole'); }
    for (let i = 0; i < 4; i++) for (let x = 0; x < 32; x++) put(race, x, 13 + i * 4, 'lane');
    for (let y = 14; y < 30; y++) for (let x = 0; x < 32; x++) if ((y % 4 !== 1) && ((x * 13 + y * 7) % 9 === 0)) put(race, x, y, 'ground');
    pal(race, 0, 6, 32, 4, 1);
    text(race, 2, 1, T('CUP', 'たいかい', lang));
    text(race, T(8, 9, lang), 1, T('RACE', 'しあい', lang));
    text(race, 22, 1, T('TIME', 'じかん', lang));
    scr[lang] = { title, ranch, eggs, race };
  }
  sym.PEN0 = addr(0, 3); sym.PEN1 = addr(16, 3); sym.PEN2 = addr(0, 15); sym.PEN3 = addr(16, 15);
  sym.ADDR_CUP = addr(18, 1);
  sym.ADDR_MENU = addr(2, 28);
  sym.KID0 = addr(1, 5); sym.KID1 = addr(11, 5); sym.KID2 = addr(21, 5);
  sym.ADDR_RCUP = addr(6, 1); sym.ADDR_RRACE = addr(13, 1); sym.ADDR_RTIME = addr(27, 1); sym.ADDR_RMSG = addr(10, 2);
  // 結果・おわり（大きなわくだけ）
  const plain = screen();
  frame(plain, 1, 1, 30, 28);

  // ---- 字 ----
  // [ラベル, 列, 行, 英語, かな]。英語のまとまり（msg_start〜msg_end）のあとに、同じ長さのかなの写し（MSG_SIZE バイトあと）。
  // 長さは長いほうに空白でそろえる。数字を書く場所（CUP 1 RACE 1 の 1 など）と、なにをするの矢印の列（arrow_x）は、かなでも同じ字の位置に
  const pad = (s, n = 28) => s + ' '.repeat(Math.max(0, n - [...s].length));
  const at = (n, words) => { const a = Array(n).fill(' '); for (const [i, w] of words) [...w].forEach((ch, k) => { a[i + k] = ch; }); return a.join(''); };
  const M = [
    ['m_help', 2, 28, pad('A:CHOOSE A DINO'), pad('A:きょうりゅうを えらぶ')],
    ['m_act', 2, 28, pad('   RACE    BREED   LET GO'), pad(at(28, [[3, 'かけっこ'], [11, 'かけあわせ'], [19, 'にがす']]))],
    ['m_partner', 2, 28, pad('CHOOSE A PARTNER    B:BACK'), pad('あいてを えらぶ     B:もどる')],
    ['m_full', 2, 28, pad('NO EMPTY PEN. LET ONE GO.'), pad('かこいが いっぱい。1とう にがして')],
    ['m_letgo', 2, 28, pad('LET IT GO?   A:YES  B:NO'), pad('にがす?      A:はい B:いいえ')],
    ['m_last', 2, 28, pad('KEEP AT LEAST ONE DINO.'), pad('1とうは のこしてね。')],
    ['m_same', 2, 28, pad('CHOOSE ANOTHER DINO.'), pad('ちがう きょうりゅうを えらんで')],
    ['m_cup', 18, 1, 'CUP 1 RACE 1', at(12, [[0, 'たいかい'], [4, '1'], [7, 'しあい'], [11, '1']])],
    ['m_allcups', 18, 1, 'ALL CUPS WON', 'ぜんぶ かった'],
    ['m_empty', 0, 0, 'EMPTY', 'あき'],
    ['m_kmh', 0, 0, 'KM/H', 'KM/H'],
    ['m_wobbly', 0, 0, 'WOBBLY', 'ふらふら'],
    ['m_ready', 10, 2, '   READY   ', '   よーい  '],
    ['m_3', 10, 2, '     3     ', '     3     '],
    ['m_2', 10, 2, '     2     ', '     2     '],
    ['m_1', 10, 2, '     1     ', '     1     '],
    ['m_go', 10, 2, 'GO! PUSH A ', 'いけ! Aを おす'],
    ['m_good', 10, 2, 'GOOD START!', ' いい でだし!'],
    ['m_false', 10, 2, 'FALSE START', '  はやすぎ!'],
    ['m_clear', 10, 2, '           ', '           '],
    ['m_finish', 10, 2, '  FINISH!  ', '   ゴール!  '],
    ['r_title', 12, 4, 'RESULT', ' けっか'],
    ['r_you', 0, 0, 'YOU   ', 'きみ'],
    ['r_blue', 0, 0, 'BLUE  ', 'あお'],
    ['r_green', 0, 0, 'GREEN ', 'みどり'],
    ['r_red', 0, 0, 'RED   ', 'あか'],
    ['r_top', 6, 17, 'TOP SPEED   KM/H', at(16, [[0, 'さいこう そくど'], [12, 'KM/H']])],
    ['r_win', 11, 20, 'YOU WIN!', ' かった!'],
    ['r_lose', 10, 20, 'TRY AGAIN!', 'まけちゃった'],
    ['r_cupwon', 9, 22, 'CUP COMPLETE!', 'たいかい ゆうしょう!'],
    ['r_back', 7, 25, 'A:BACK TO RANCH', 'A:ぼくじょうへ もどる'],
    ['e_1', 11, 6, 'CHAMPION!', 'ゆうしょう!'],
    ['e_2', 5, 10, 'YOUR DINOS WON ALL', 'きみの きょうりゅうが'],
    ['e_3', 5, 12, 'THREE CUPS.', '3つの たいかいで かった。'],
    ['e_4', 5, 15, 'SCIENTISTS ALSO RAN', 'かがくしゃも けいさんきで'],
    ['e_5', 5, 17, 'DINO SKELETONS IN', 'きょうりゅうの ほねを'],
    ['e_6', 5, 19, 'COMPUTERS. 2007', 'はしらせた。2007ねん'],
    ['e_7', 5, 24, 'THANK YOU FOR PLAYING', 'あそんでくれて ありがとう'],
    ['t_new', 8, 18, 'NEW RANCH STARTED', 'あたらしい ぼくじょう'],
    ['t_cont', 11, 18, 'CUP 1 RACE 1', at(12, [[0, 'たいかい'], [4, '1'], [7, 'しあい'], [11, '1']])],
    ['t_push', 9, 22, '  PUSH START', 'START を おしてね'],
  ];
  const fixed = new Set(['m_cup', 't_cont', 'r_top', 'm_act', 'm_empty', 'm_kmh', 'm_wobbly', 'r_you', 'r_blue', 'r_green', 'r_red']); // かなを英語より長くしない
  const enMsgs = [], jaMsgs = [];
  let msgSize = 0;
  for (const [label, col, row, en, ja] of M) {
    const le = [...en].length, lj = [...ja].length;
    if (fixed.has(label) && lj > le) throw new Error(label + ': かなが英語より長い（となりを消してしまう）');
    const w = Math.max(le, lj);
    enMsgs.push(msg(label, col, row, en + ' '.repeat(w - le)));
    jaMsgs.push(msg('ja_' + label, col, row, ja + ' '.repeat(w - lj)));
    msgSize += 3 + w;
  }
  sym.MSG_SIZE = msgSize;
  sym.ADDR_TCUP = addr(15, 18); sym.ADDR_TRACE = addr(22, 18);
  sym.ADDR_RTOP = addr(16, 17);

  // ---- 曲 ----
  // 牧場: ドの長調の、のどかな曲（4拍子）。A・B・A'・息つぎ4小節 ＝ 28 小節・約 30 秒で1周。ベースは2拍ずつ
  const rA = ['C5:1 E5:1 G5:1 E5:1 | C sparse', 'F5:1 A5:1 G5:2 | F sparse', 'E5:1 C5:1 D5:1 E5:1 | C sparse', 'D5:3 -:1 | G sparse',
    'C5:1 E5:1 G5:1 E5:1 | C sparse', 'F5:1 A5:1 G5:1 F5:1 | F sparse', 'E5:1 D5:1 C5:1 D5:1 | G sparse', 'C5:3 -:1 | C sparse'];
  const rB = ['A5:1 G5:1 F5:1 E5:1 | F sparse', 'D5:2 G5:2 | G sparse', 'G5:1 F5:1 E5:1 D5:1 | Em sparse', 'C5:2 E5:2 | Am sparse',
    'F5:1 E5:1 D5:1 C5:1 | Dm sparse', 'B4:1 C5:1 D5:1 E5:1 | G sparse', 'F5:2 D5:1 B4:1 | G sparse', 'G4:3 -:1 | G sparse'];
  const rA2 = ['C5:0.5 D5:0.5 E5:1 G5:1 E5:1 | C sparse', 'F5:1 A5:1 G5:2 | F sparse', 'E5:0.5 F5:0.5 E5:0.5 D5:0.5 C5:1 E5:1 | Am sparse', 'D5:3 -:1 | G sparse',
    'C5:1 E5:1 G5:1 C6:1 | C sparse', 'A5:1 F5:1 G5:1 E5:1 | F sparse', 'D5:1 G5:1 B4:1 D5:1 | G sparse', 'C5:3 -:1 | C sparse'];
  const rBreath = ['-:4 | C sparse', '-:4 | F sparse', '-:4 | G sparse', '-:4 | C sparse'];
  // かけっこ: ラの短調の速い曲（4拍子）。A・B・A ＝ 24 小節・約 16 秒（1レースでほぼ1回）。ベースは8分音符でかけ足
  const cA = ['E5:0.5 E5:0.5 A5:1 E5:0.5 C5:0.5 A4:1 | Am gallop', 'D5:0.5 E5:0.5 F5:1 E5:1 D5:1 | Dm gallop',
    'C5:0.5 D5:0.5 E5:1 C5:0.5 B4:0.5 A4:1 | Am gallop', 'B4:1 E5:1 G#4:2 | E gallop',
    'E5:0.5 E5:0.5 A5:1 E5:0.5 C5:0.5 A4:1 | Am gallop', 'F5:0.5 G5:0.5 A5:1 G5:1 F5:1 | F gallop',
    'E5:1 D5:1 C5:1 B4:1 | G gallop', 'A4:3 -:1 | Am gallop'];
  const cB = ['C6:1 B5:1 A5:1 G5:1 | F gallop', 'A5:1 G5:1 F5:1 E5:1 | C gallop', 'F5:1 E5:1 D5:1 C5:1 | Dm gallop', 'E5:2 B4:2 | E gallop',
    'C5:0.5 D5:0.5 E5:1 A5:1 E5:1 | Am gallop', 'F5:0.5 G5:0.5 A5:1 C6:1 A5:1 | F gallop', 'G5:1 F5:1 E5:1 D5:1 | G gallop', 'E5:2 G#4:2 | E gallop'];
  const E = 6, Q = 12, W = 48;
  const songs = {
    ranch: { tracks: compose({ beat: 16, bars: [...rA, ...rB, ...rA2, ...rBreath] }), duty: 0x80 },
    race: { tracks: compose({ beat: 10, bars: [...cA, ...cB, ...cA] }), duty: 0x40 },
    win: { tracks: [track(`C5 ${E} E5 ${E} G5 ${E} C6 ${Q} G5 ${E} C6 ${W}`, false, 0xfe), track(`C3 ${Q} G2 ${Q} C3 ${Q} C3 ${W}`, true, 0xfe)], duty: 0x40 },
    lose: { tracks: [track(`G4 ${Q} E4 ${Q} C4 ${W}`, false, 0xfe), track(`C3 ${Q} G2 ${Q} C2 ${W}`, true, 0xfe)], duty: 0x80 },
    ending: { tracks: compose({ beat: 22, bars: [...rA, ...rB, ...rBreath] }), duty: 0x80 },
  };

  const rivals = pickRivals();
  const hex = (n) => '$' + n.toString(16).toUpperCase().padStart(2, '0');
  const data = `
; ---- ここから下はビルドが作ったデータ ----
palette:
  .byte ${PALETTES.flat().map(hex).join(',')}
nt_title:
  .byte ${packNt(scr.en.title).join(',')}
nt_ranch:
  .byte ${packNt(scr.en.ranch).join(',')}
nt_eggs:
  .byte ${packNt(scr.en.eggs).join(',')}
nt_race:
  .byte ${packNt(scr.en.race).join(',')}
nt_ja:
${['title', 'ranch', 'eggs', 'race'].map((k) => `  .byte ${packNt(scr.ja[k]).join(',')}`).join('\n')}
nt_plain:
  .byte ${packNt(plain).join(',')}
msg_start:
${enMsgs.join('\n')}
msg_end:
${jaMsgs.join('\n')}
; ライバル: 9 回 × 3 頭 × 5 つの能力（大きさ・脚・筋肉・しっぽ・足の速さ）
rival_genes:
${rivals.map((g, i) => `  .byte ${g.join(', ')}   ; ${Math.floor(i / 9) + 1}-${Math.floor(i / 3) % 3 + 1} ${derive(...g).kmh}km/h`).join('\n')}
${periodData()}
${songData(songs, sym)}
${voiceData([9, 9, 8, 8, 7, 7, 7, 6, 6, 6, 6, 5, 5, 5, 5, 4], 0x24, sym)}
`;
  return { chr: c.chr, count: c.count, sym, data };
}
