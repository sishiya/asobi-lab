// ダンゴムシのみち のデータ（絵・画面・面・曲）。tools/build.mjs が呼ぶ
import { BG, KANA, SP } from './art.mjs';
import { STAGES } from './stages.mjs';
import { parse, solve, W, H, CELL } from './rules.mjs';
import { makeChr, shadow, screen, put as put0, text as text0, pal, packNt, addr, msg as msg0, track, periodData, songData, voiceData, compose } from '../../tools/lib.mjs';

export const BATTERY = true; // どこまで進んだかを $6000 に残す

// 背景 0 土と岩と石・1 葉っぱ・2 ひなた・3 字。スプライト 0 ダンゴムシ・1 しるし・2 葉のかけら・3 （予備）
export const PALETTES = [[0x07, 0x17, 0x00, 0x10], [0x07, 0x17, 0x0a, 0x2a], [0x07, 0x28, 0x38, 0x27], [0x07, 0x30, 0x10, 0x0f],
  [0x07, 0x0f, 0x00, 0x10], [0x07, 0x0f, 0x30, 0x0f], [0x07, 0x09, 0x2a, 0x30], [0x07, 0x30, 0x10, 0x0f]];

const FIELD_ROW = 4; // 面のいちばん上の行（字の段は 0〜3）

export function build() {
  const c = makeChr();
  const { sym } = c;
  const put = (...a) => put0(c, ...a), text = (...a) => text0(c, ...a), msg = (...a) => msg0(c, ...a);

  // 背景（土の4つ・ひなたの2つは続けて並べる。game.s が番号に足して選ぶ）
  c.big(0, 'blank', BG.blank);
  c.font('1');
  for (const k of ['soil1', 'soil2', 'soil3', 'soil4', 'rock', 'stone', 'leaf', 'sun1', 'sun2', 'icon', 'iconOff']) c.big(0, k, BG[k]);
  for (const [k, rows] of Object.entries(KANA)) c.big(0, 'k_' + k, shadow(rows, (y) => (y < 7 ? '2' : '1')));
  // スプライト
  c.big(1, 'none', BG.blank);
  for (const [k, rows] of Object.entries(SP)) c.big(1, k, rows);

  // ます（cx, cy）の絵。土とひなたは場所で選ぶ（game.s の draw_cell と同じ式）
  const soilAt = (cx, cy) => 'soil' + (((cx ^ (cy << 1)) & 3) + 1);
  function cell(s, cx, cy, kind) {
    const col = cx * 2, row = FIELD_ROW + cy * 2;
    const name = kind === CELL.rock ? 'rock' : kind === CELL.leaf ? 'leaf' : kind === CELL.sun ? 'sun' + (((cx ^ cy) & 1) + 1) : soilAt(cx, cy);
    put(s, col, row, name, 2, 2);
    pal(s, col, row, 2, 2, kind === CELL.leaf ? 1 : kind === CELL.sun ? 2 : 0);
  }

  // 面ごとの画面（字の段・面・下の案内まで全部）と、ますの中身
  const stageNt = [], stageCells = [];
  STAGES.forEach((st, n) => {
    const map = parse(st);
    const s = screen();
    pal(s, 0, 0, 32, 4, 3);
    pal(s, 0, 28, 32, 2, 3);
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) cell(s, cx, cy, map.g[cy * W + cx]);
    stageNt.push(packNt(s));
    if (map.stones > 4) throw new Error(st.name + ': 石は 4 つまで（字の段の印）');
    const best = solve(map).min;
    if (best < 0) throw new Error(st.name + ': 解けない');
    stageCells.push([...map.g, map.start.x, map.start.y, map.start.h, map.stones, best]);
  });
  sym.NSTAGE = STAGES.length;
  sym.ADDR_ICONS = addr(25, 1);
  sym.ADDR_HINT = addr(2, 28);

  // タイトル
  const title = screen();
  pal(title, 0, 0, 32, 30, 3);
  ['da', 'n', 'go', 'mu', 'shi', 'no', 'mi', 'chi'].forEach((k, i) => put(title, 4 + i * 3, 5, 'k_' + k, 2, 2));
  text(title, 10, 9, 'PILLBUG PATH');
  text(title, 9, 26, 'ASOBI LAB 2026');
  // 下に土の帯と、岩・葉っぱ（ダンゴムシが歩く地面）
  for (let cx = 0; cx < 16; cx++) {
    put(title, cx * 2, 21, soilAt(cx, 0), 2, 2);
    put(title, cx * 2, 23, soilAt(cx, 1), 2, 2);
  }
  pal(title, 0, 21, 32, 4, 0);
  sym.ADDR_TSTAGE = addr(18, 15);
  sym.ADDR_TSTAGE_JA = addr(14, 15);

  // エンディング（本物のしくみ: 交替性転向反応）。かなと英語で 1 枚ずつ
  const ENDING = {
    ja: [[4, 'はっぱを ぜんぶ たべた!'], [8, 'ダンゴムシは ひだりに まがると'], [10, 'つぎは みぎに まがりやすい。'],
      [13, 'これを こうたいせい てんこう'], [15, 'はんのう という。'], [18, 'じぐざぐに すすんで'], [20, 'ぶつかった ものから'], [22, 'はなれて いけるんだって。'],
      [26, 'あそんでくれて ありがとう']],
    en: [[4, 'ALL THE LEAVES ARE EATEN!'], [8, 'A PILLBUG TURNS LEFT'], [10, 'THEN RIGHT THEN LEFT...'],
      [13, 'SCIENTISTS CALL IT'], [15, 'TURN ALTERNATION.'], [18, 'IT HELPS THE BUG KEEP'], [20, 'GOING ONE WAY - AWAY'], [22, 'FROM WHAT BLOCKED IT.'],
      [26, 'THANK YOU FOR PLAYING']],
  };
  const endNt = {};
  for (const [lang, lines] of Object.entries(ENDING)) {
    const end = screen();
    pal(end, 0, 0, 32, 30, 3);
    for (const [r, str] of lines) text(end, Math.floor((32 - [...str].length) / 2), r, str);
    endNt[lang] = packNt(end);
  }

  // 字（0 かな・1 英語）。同じ場所に同じ長さで書く（短いほうを空白でうめる）。M_名前 が番号、game.s の say がことばで選ぶ
  const MSGS = [];
  const len = (t) => [...t].length;
  const bi = (name, col, row, ja, en) => {
    const w = Math.max(len(ja), len(en));
    MSGS.push([name, col, row, ja + ' '.repeat(w - len(ja)), en + ' '.repeat(w - len(en))]);
  };
  const line = (ja, en) => [ja + ' '.repeat(29 - len(ja)), en + ' '.repeat(29 - len(en))]; // 下の案内は 29 字
  bi('push', 9, 18, 'START を おしてね', ' PUSH START');
  bi('push_off', 9, 18, ' '.repeat(16), '');
  bi('end_push', 9, 28, 'START を おしてね', ' PUSH START');
  bi('tstage', 12, 15, '  00 めん', 'STAGE 00'); // タイトルの面の番号（00 のところに数字を書く: かな ADDR_TSTAGE_JA・英語 ADDR_TSTAGE）
  bi('hint_plan', 2, 28, ...line('A いし  START あるく  SELECT もどす', 'A STONE START GO SELECT CLEAR'));
  bi('hint_watch', 2, 28, ...line('START で あるくよ。まがるのを みてね', 'START GO - WATCH IT TURN'));
  bi('hint_walk', 2, 28, ...line('A ずっと はやく   B とめる', 'HOLD A FAST    B STOP'));
  bi('hint_clear', 2, 28, ...line('むしゃむしゃ!       A つぎへ', 'YUM!           A NEXT'));
  bi('hint_best', 2, 28, ...line('むしゃむしゃ! さいこう! A つぎへ', 'YUM! BEST!     A NEXT'));
  bi('hint_sun', 2, 28, ...line('まぶしい! まるまっちゃった', 'TOO SUNNY! IT CURLED UP.'));
  for (const [name] of MSGS) sym['M_' + name.toUpperCase()] = MSGS.findIndex((m) => m[0] === name);
  sym.M_STAGE = MSGS.length; // 面ごとに 2 つ（番号・名前）: M_STAGE + 面×2
  STAGES.forEach((st, n) => {
    const nn = String(n + 1).padStart(2, '0');
    bi('st' + n, 2, 1, nn + ' めん', 'STAGE ' + nn);
    bi('sn' + n, 2, 2, st.ja, st.name.toUpperCase());
  });
  sym.MSG_N = MSGS.length;
  if (MSGS.length > 127) throw new Error('字が多すぎる（say は 2×MSG_N が 256 まで）');

  // 曲: 庭の土の上をのんびり（4拍子・ドの長調）。A・B・A と息つぎ 2 小節 ＝ 26 小節・約 38 秒で1周
  const A = ['E5:1 D5:1 C5:1 D5:1 | C sparse', 'E5:2 G5:2 | C sparse', 'F5:1 E5:1 D5:1 C5:1 | F sparse', 'D5:3 -:1 | G sparse',
    'E5:1 D5:1 C5:1 D5:1 | Am sparse', 'E5:2 C5:2 | F sparse', 'D5:1 E5:1 D5:1 B4:1 | G sparse', 'C5:3 -:1 | C sparse'];
  const B = ['A4:1 C5:1 E5:2 | Am sparse', 'G5:2 E5:2 | C sparse', 'F5:1 A5:1 G5:1 F5:1 | F sparse', 'E5:3 -:1 | C sparse',
    'D5:1 F5:1 A5:2 | Dm sparse', 'G5:2 E5:1 C5:1 | C sparse', 'D5:2 G4:2 | G sparse', 'G4:3 -:1 | G sparse'];
  const breath = ['-:4 | C sparse', '-:4 | G sparse'];
  const songs = {
    main: { tracks: compose({ beat: 22, bars: [...A, ...B, ...A, ...breath] }), duty: 0x80 },
    clear: { tracks: [track('C5 8 E5 8 G5 8 C6 40', false, 0xfe), track('C3 16 G2 16 C3 32', true, 0xfe)], duty: 0x80 },
    ending: { tracks: compose({ beat: 26, bars: [...B, ...A], loop: true }), duty: 0x40 },
  };
  const hex = (n) => '$' + n.toString(16).toUpperCase().padStart(2, '0');

  const data = `
; ---- ここから下はビルドが作ったデータ ----
palette:
  .byte ${PALETTES.flat().map(hex).join(',')}
nt_title:
  .byte ${packNt(title).join(',')}
nt_end_ja:
  .byte ${endNt.ja.join(',')}
nt_end_en:
  .byte ${endNt.en.join(',')}
${stageNt.map((b, i) => `nt_stage${i}:\n  .byte ${b.join(',')}`).join('\n')}
${stageCells.map((b, i) => `cells${i}:\n  .byte ${b.join(',')}`).join('\n')}
stage_nt_lo: .byte ${stageNt.map((_, i) => `<nt_stage${i}`).join(', ')}
stage_nt_hi: .byte ${stageNt.map((_, i) => `>nt_stage${i}`).join(', ')}
stage_cells_lo: .byte ${stageCells.map((_, i) => `<cells${i}`).join(', ')}
stage_cells_hi: .byte ${stageCells.map((_, i) => `>cells${i}`).join(', ')}
${MSGS.map(([name, col, row, ja, en]) => `${msg(`m_${name}_0`, col, row, ja)}\n${msg(`m_${name}_1`, col, row, en)}`).join('\n')}
msg_lo: .byte ${[0, 1].flatMap((l) => MSGS.map(([n]) => `<m_${n}_${l}`)).join(', ')}
msg_hi: .byte ${[0, 1].flatMap((l) => MSGS.map(([n]) => `>m_${n}_${l}`)).join(', ')}
${periodData()}
${songData(songs, sym)}
${voiceData([6, 6, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2], 0x24, sym)}
`;
  return { chr: c.chr, count: c.count, sym, data };
}
