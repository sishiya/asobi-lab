// ダンゴムシのみち のデータ（絵・画面・面・曲）。tools/build.mjs が呼ぶ
import { BG, KANA, SP, SOIL_POOL, sunTile } from './art.mjs';
import { STAGES } from './stages.mjs';
import { parse, solve, W, H, CELL } from './rules.mjs';
import { makeChr, shadow, screen, put as put0, text as text0, pal, packNt, addr, msg as msg0, track, periodData, songData, voiceData, compose } from '../../tools/lib.mjs';

export const BATTERY = true; // どこまで進んだかを $6000 に残す

// 背景 0 土（こげ茶・土・明るい土）と小石（灰）・1 葉っぱ・2 ひなた・3 字と岩とふち石（v036）。スプライト 0 ダンゴムシ・1 しるし・2 葉のかけら・3 （予備）
// どのパレットも 1 番が土の色（17）か、こげ茶のふち（07）。葉っぱとひなたのますは、ふちを土へぼかせる
export const PALETTES = [[0x07, 0x17, 0x27, 0x10], [0x07, 0x17, 0x29, 0x38], [0x07, 0x17, 0x37, 0x38], [0x07, 0x30, 0x10, 0x17],
  [0x07, 0x0f, 0x00, 0x31], [0x07, 0x0f, 0x30, 0x0f], [0x07, 0x09, 0x2a, 0x30], [0x07, 0x30, 0x10, 0x0f]];

const FIELD_ROW = 4; // 面のいちばん上の行（字の段は 0〜3）

export function build() {
  const c = makeChr();
  const { sym } = c;
  const put = (...a) => put0(c, ...a), text = (...a) => text0(c, ...a), msg = (...a) => msg0(c, ...a);

  // 背景（v036）: 土の 8×8 を 12 種（続けて並べる）・岩の影・岩 2・小石・葉っぱ 3（続けて）・食べあと・ひなた・ふち石
  c.big(0, 'blank', BG.blank);
  c.font('1');
  SOIL_POOL.forEach((rows, i) => c.big(0, 'soilp' + i, rows));
  for (const k of ['shadeL', 'shadeT', 'shadeTL', 'rock0', 'rock1', 'stone', 'leaf0', 'leaf1', 'leaf2', 'eaten', 'edge0', 'edge1', 'edge2', 'edge3', 'icon', 'iconOff']) c.big(0, k, BG[k]);
  // ひなた: まん中（ふちなし）の 16×16 と、ふちを土へぼかした 8×8（使うものだけ足す）
  const sunc = [0, 1].flatMap((ty) => Array.from({ length: 8 }, (_, y) => sunTile(71 + ty * 2, 0, 0, 0, 0)[y] + sunTile(72 + ty * 2, 0, 0, 0, 0)[y]));
  c.big(0, 'sunc', sunc);
  const sunCache = new Map();
  const sunT = (seed, eL, eR, eT, eB) => {
    const k = [seed, eL, eR, eT, eB].join();
    if (!sunCache.has(k)) sunCache.set(k, c.tile(0, sunTile(seed, eL, eR, eT, eB)));
    return sunCache.get(k);
  };
  for (const [k, rows] of Object.entries(KANA)) c.big(0, 'k_' + k, shadow(rows, (y) => (y < 7 ? '2' : '1')));
  // スプライト
  c.big(1, 'none', BG.blank);
  for (const [k, rows] of Object.entries(SP)) c.big(1, k, rows);

  // 土: ます ci の 4 つの角に、8×8 の土の絵（ふつう 0〜3・しめった所 4〜7）を置く。面ごとに 2 つの表（game.s の draw_cell も同じ表を読む）
  //   soil_q = 角ごとの 2 ビット（左上が下の位）・soil_d = 角ごとに 1 ビット（1 = しめった所）。しめった所は 2〜3 ますの大きさのむらで、面のふちに多い
  const rnd = (i, k) => { let n = (i * 2654435761 + k * 40503) >>> 0; n = Math.imul(n ^ (n >>> 15), 2246822507) >>> 0; return ((n ^ (n >>> 13)) >>> 0) / 4294967296; };
  const smooth = (x, y, k) => { // 3 ますごとの点の値を、なめらかにつなぐ
    const gx = x / 3, gy = y / 3, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const v = (a, b) => rnd(a * 31 + b * 977 + 5, k);
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy;
  };
  const soilTables = (k) => {
    const q = [], d = [];
    for (let ci = 0; ci < W * H; ci++) {
      const cx = ci % W, cy = Math.floor(ci / W);
      const edge = cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1;
      // 角ごと（半ますの細かさ）に決める: さかいが半ますずつぎざぎざになり、ますの四角が見えない
      d.push([0, 1, 2, 3].reduce((b, j) => {
        const qx = cx + (j & 1) * 0.5 + 0.25, qy = cy + (j >> 1) * 0.5 + 0.25;
        const e = edge && rnd(ci * 4 + j, k + 50) < 0.5;
        return b | ((smooth(qx, qy, k) > 0.64 || e ? 1 : 0) << j);
      }, 0));
      q.push([0, 1, 2, 3].reduce((b, j) => b | (Math.floor(rnd(ci * 4 + j, k + 90) * 4) << (j * 2)), 0));
    }
    return { q, d };
  };
  const LEAF_T = Array.from({ length: 192 }, (_, i) => c.sym.T_LEAF0 + 4 * Math.floor(rnd(i, 2) * 3));
  const soilQuads = (g, ci, t) => {
    const cx = ci & 15, cy = ci >> 4;
    const q = [0, 1, 2, 3].map((j) => c.sym.T_SOILP0 + ((t.d[ci] >> j) & 1) * 4 + ((t.q[ci] >> (j * 2)) & 3));
    const L = cx > 0 && g[ci - 1] === CELL.rock, U = cy > 0 && g[ci - 16] === CELL.rock;
    if (L) { q[0] = c.sym.T_SHADEL; q[2] = c.sym.T_SHADEL; }
    if (U) { q[1] = c.sym.T_SHADET; q[0] = q[0] === c.sym.T_SHADEL ? c.sym.T_SHADETL : c.sym.T_SHADET; }
    return q;
  };
  const four = (t) => [t, t + 1, t + 2, t + 3];
  // ます（cx, cy）の絵。動く物（小石・葉っぱ）のますは draw_cell と同じ絵、動かない物（岩・ひなた）はここだけの絵
  function cell(s, g, cx, cy, t) {
    const ci = cy * W + cx, kind = g[ci];
    const col = cx * 2, row = FIELD_ROW + cy * 2;
    let q;
    if (kind === CELL.rock) q = four(c.sym.T_ROCK0 + 4 * (Math.floor(rnd(ci, 7) * 2)));
    else if (kind === CELL.leaf) q = four(LEAF_T[ci]);
    else if (kind === CELL.sun) {
      const sunAt = (x, y) => x < 0 || y < 0 || x >= W || y >= H || g[y * W + x] === CELL.sun;
      const eL = !sunAt(cx - 1, cy), eR = !sunAt(cx + 1, cy), eT = !sunAt(cx, cy - 1), eB = !sunAt(cx, cy + 1);
      const sd = 80 + ((cx + cy) & 1) * 4;
      q = [sunT(sd, eL, 0, eT, 0), sunT(sd + 1, 0, eR, eT, 0), sunT(sd + 2, eL, 0, 0, eB), sunT(sd + 3, 0, eR, 0, eB)];
    } else q = soilQuads(g, ci, t);
    s.nt[row][col] = q[0]; s.nt[row][col + 1] = q[1]; s.nt[row + 1][col] = q[2]; s.nt[row + 1][col + 1] = q[3];
    pal(s, col, row, 2, 2, kind === CELL.leaf ? 1 : kind === CELL.sun ? 2 : kind === CELL.rock ? 3 : 0);
  }
  // 字の段のいちばん下に、花壇のふち石
  const edgeRow = (s, row, gaps = true) => { for (let col = 0; col < 32; col++) s.nt[row][col] = c.sym.T_EDGE0 + Math.floor(rnd(col, row) * (gaps ? 4 : 3)); }; // タイトルはすきまなし

  // 面ごとの画面（字の段・面・下の案内まで全部）と、ますの中身
  const stageNt = [], stageCells = [], stageSoil = [];
  STAGES.forEach((st, n) => {
    const map = parse(st);
    const s = screen();
    pal(s, 0, 0, 32, 4, 3);
    pal(s, 0, 28, 32, 2, 3);
    const t = soilTables(n + 1);
    stageSoil.push(t);
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) cell(s, map.g, cx, cy, t);
    edgeRow(s, FIELD_ROW - 1);
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
  text(title, 9, 28, 'ASOBI LAB 2026');
  // 下に土の帯と、岩・葉っぱ（ダンゴムシが歩く地面）
  // タイトルの下の庭（4 段）: 土に岩 1・葉っぱ 1
  const tg = new Array(W * H).fill(CELL.soil), tt = soilTables(40);
  tg[1 * W + 12] = CELL.rock; tg[0 * W + 3] = CELL.leaf;
  for (let cx = 0; cx < 16; cx++) for (let cy = 0; cy < 3; cy++) {
    const ci = cy * W + cx, col = cx * 2, row = 22 + cy * 2;
    const q = tg[ci] === CELL.rock ? four(c.sym.T_ROCK0) : tg[ci] === CELL.leaf ? four(LEAF_T[ci]) : soilQuads(tg, ci, tt);
    title.nt[row][col] = q[0]; title.nt[row][col + 1] = q[1]; title.nt[row + 1][col] = q[2]; title.nt[row + 1][col + 1] = q[3];
    pal(title, col, row, 2, 2, tg[ci] === CELL.rock ? 3 : tg[ci] === CELL.leaf ? 1 : 0);
  }
  edgeRow(title, 21, false);
  edgeRow(title, 3, false); // 題字の上にも細いふち石（額）
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
  bi('push', 9, 17, 'START を おしてね', ' PUSH START');
  bi('push_off', 9, 17, ' '.repeat(16), '');
  bi('end_push', 9, 28, 'START を おしてね', ' PUSH START');
  bi('tstage', 12, 15, '  00 めん', 'STAGE 00'); // タイトルの面の番号（00 のところに数字を書く: かな ADDR_TSTAGE_JA・英語 ADDR_TSTAGE）
  bi('hint_plan', 2, 28, ...line('A いし  START あるく  SELECT もどす', 'A STONE START GO SELECT CLEAR'));
  bi('hint_watch', 2, 28, ...line('START で あるくよ。まがるのを みてね', 'START GO - WATCH IT TURN'));
  bi('hint_walk', 2, 28, ...line('A ずっと はやく   B とめる', 'HOLD A FAST    B STOP'));
  bi('hint_clear', 2, 28, ...line('むしゃむしゃ!       A つぎへ', 'YUM!           A NEXT'));
  bi('hint_best', 2, 28, ...line('むしゃむしゃ! さいこう! A つぎへ', 'YUM! BEST!     A NEXT'));
  bi('hint_sun', 2, 28, ...line('まぶしい! まるまっちゃった', 'TOO SUNNY! IT CURLED UP.'));
  bi('hint_loop', 2, 28, ...line('ぐるぐる! いしを おきなおそう', 'GOING IN CIRCLES. TRY AGAIN.'));
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
${stageSoil.map((t, i) => `soilq${i}:
  .byte ${t.q.join(',')}
soild${i}:
  .byte ${t.d.join(',')}`).join(String.fromCharCode(10))}
stage_sq_lo: .byte ${stageSoil.map((_, i) => `<soilq${i}`).join(', ')}
stage_sq_hi: .byte ${stageSoil.map((_, i) => `>soilq${i}`).join(', ')}
stage_sd_lo: .byte ${stageSoil.map((_, i) => `<soild${i}`).join(', ')}
stage_sd_hi: .byte ${stageSoil.map((_, i) => `>soild${i}`).join(', ')}
leaf_t: .byte ${LEAF_T.join(',')}
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
