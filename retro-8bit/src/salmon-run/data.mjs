// サケ のぼれ! のデータ（絵・画面・川の行の型・曲・表）。tools/build.mjs が呼ぶ
import { BG, KANA, SP } from './art.mjs';
import { makeChr, shadow, screen, put as put0, text as text0, pal, packNt, addr, msg as msg0, track, periodData, songData, voiceData, compose } from '../../tools/lib.mjs';

export const BATTERY = true; // いちばん多く のぼった段を $6000 に残す

// 背景: 0 岩かべ・1 水と谷・2 滝（1 と 2 の色が入れかわる）・3 字
// スプライト: 0 サケ・1 クマ・2 しるしと しぶき・3 星
export const PALETTES = [
  [0x0c, 0x10, 0x00, 0x1a], [0x0c, 0x30, 0x21, 0x00], [0x0c, 0x30, 0x21, 0x00], [0x0c, 0x30, 0x26, 0x0f],
  [0x0c, 0x0f, 0x16, 0x2a], [0x0c, 0x0f, 0x17, 0x27], [0x0c, 0x30, 0x21, 0x28], [0x0c, 0x30, 0x0f, 0x28],
];

// ---- 川の形（game.s と同じ決まり）----
// 段 j のたなは side = j & 1（1 = 右のたな: 12〜29 列・ふち 12 列・滝 10〜11 列／0 = 左のたな: 2〜19 列・ふち 19 列・滝 20〜21 列）
// たな j の水面の行から上へ h 行で次のたな。帯の o 行め（1〜h）: h 水面・h-1 水・h-2 たなの下の岩・1 しぶき・ほか 谷
export const SPAN = [[2, 19], [12, 29]], LIPC = [19, 12], FALLC = [20, 10];
export const RIVER_ROWS = 6; // はじめの川（0〜4 行 水・5 行め 水面）

export function build() {
  const c = makeChr();
  const { sym } = c;
  const put = (...a) => put0(c, ...a), text = (...a) => text0(c, ...a), msg = (...a) => msg0(c, ...a);

  c.big(0, 'blank', BG.blank);
  c.font();
  for (const [k, rows] of Object.entries(BG)) if (k !== 'blank') c.big(0, k, rows);
  for (const [k, rows] of Object.entries(KANA)) c.big(0, 'k_' + k, shadow(rows, (y) => (y < 10 ? '1' : '2')).map((r, y) => (y === 9 ? [...r].map((ch, x) => (ch === '1' && (x + y) % 2 ? '2' : ch)).join('') : r)));
  c.big(1, 'none', BG.blank);
  for (const [k, rows] of Object.entries(SP)) c.big(1, k, rows);

  const T = (name) => { const v = c.sym['T_' + name.toUpperCase()]; if (v === undefined) throw new Error('ない絵: ' + name); return v; };
  const rnd = (i, k) => { let n = (i * 2654435761 + k * 40503) >>> 0; n = Math.imul(n ^ (n >>> 15), 2246822507) >>> 0; return ((n ^ (n >>> 13)) >>> 0) / 4294967296; };
  // 谷のおくの岩の柱: 列のさかいごとの こさ（0〜3）。行の型が変わっても柱は上下につながる
  const VB = [0, 1, 3, 2, 0, 1, 2, 3, 1, 0, 2, 3, 3, 1, 0, 0, 2, 3, 1, 0, 1, 3, 2, 2, 0, 1, 3, 1, 0, 2, 3, 1, 0];
  const gorgeAt = (col, k) => T('g' + VB[col] + VB[col + 1] + (rnd(col, k) < 0.18 ? 1 : rnd(col, k + 99) < 0.12 ? 2 : 0));

  // 行の型: kind（air0〜3・mist0/1・under0/1・water0/1・surf）× side → 32 まい
  function rowTiles(kind, side, v) {
    const r = new Array(32);
    const [s0, s1] = SPAN[side], lc = LIPC[side], fc = FALLC[side], oc = FALLC[1 - side];
    const wv = v & 3;
    for (let col = 0; col < 32; col++) {
      let t;
      if (col < 2) t = T('wallL' + wv) + col;
      else if (col >= 30) t = T('wallR' + wv) + col - 30;
      else if (kind === 'mist') t = T(rnd(col, 40 + v) < 0.5 ? 'mistA' : 'mistB');
      else t = gorgeAt(col, 7 + v * 13 + (kind === 'air' ? 0 : 50 + side));
      const inShelf = col >= s0 && col <= s1;
      if (kind === 'air' || kind === 'mist' || kind === 'hang' || kind === 'under' || kind === 'water') {
        if (col === fc || col === fc + 1) t = T((v & 1) ? 'fallB0' : 'fallA0') + (col - fc);
      }
      if (kind === 'hang' && inShelf) t = col === lc ? T(side ? 'lipHR' : 'lipHL') : T((col + v) & 1 ? 'hangA' : 'hangB');
      if (kind === 'under' && inShelf) t = col === lc ? T(side ? 'lipUR' : 'lipUL') : T((col + v) & 1 ? 'underA' : 'underB');
      if (kind === 'water' && inShelf) t = col === lc ? T(side ? 'lipWR' : 'lipWL') : (col === oc || col === oc + 1) ? T((col + v) & 1 ? 'churnA' : 'churnB') : T((col + v) % 3 ? 'waterA' : 'waterB');
      if (kind === 'surf') {
        if (inShelf) t = col === lc ? T(side ? 'lipSR' : 'lipSL') : (col === oc || col === oc + 1) ? T(col & 1 ? 'foamB' : 'foamA') : T(col % 3 ? 'surfA' : 'surfB');
        if (col === fc || col === fc + 1) t = c.sym['T_' + (side ? 'FTR' : 'FTL') + (col - fc)];
      }
      r[col] = t;
    }
    return r;
  }
  // はじめの川（0 行め = いちばん下）
  function riverTiles(w) {
    const r = new Array(32);
    for (let col = 0; col < 32; col++) {
      let t;
      if (col < 2) t = T('wallL' + (w & 3)) + col;
      else if (col >= 30) t = T('wallR' + (w & 3)) + col - 30;
      else if (w === 5) t = col === 10 || col === 11 ? T(col & 1 ? 'foamB' : 'foamA') : T(col % 3 ? 'surfA' : 'surfB');
      else if (w === 4) t = col === 10 || col === 11 ? T(col & 1 ? 'churnA' : 'churnB') : T(col % 3 ? 'waterA' : 'waterB');
      else if (w === 3) t = T('deep0');
      else if (w === 2) t = T('deep1');
      else if (w === 1) t = T('deep2');
      else t = rnd(col, 3) < 0.12 ? T(rnd(col, 4) < 0.5 ? 'pebA' : 'pebB') : T('blank');
      r[col] = t;
    }
    return r;
  }
  const KINDS = [['air', 0], ['air', 1], ['air', 2], ['air', 3], ['mist', 0], ['mist', 1], ['under', 0], ['under', 1], ['water', 0], ['water', 1], ['surf', 0], ['hang', 0], ['hang', 1]];
  const NK = KINDS.length; sym.NK = NK;
  const templates = [];
  for (const side of [0, 1]) for (const [k, v] of KINDS) templates.push(rowTiles(k, side, v));
  for (let w = 0; w < RIVER_ROWS; w++) templates.push(riverTiles(w));
  sym.TM_RIVER = 2 * NK;
  // 帯の o 行め → 行の型（6502 と同じ）
  const kindOf = (o, h, w) => (o === h ? 10 : o === h - 1 ? 8 + (w & 1) : o === h - 2 ? 6 + (w & 1) : o === h - 3 ? 11 + (w & 1) : o === 1 ? 4 + (w & 1) : w & 3);
  // 世界の行（下から）を作る: heights = 段の高さの列
  function world(heights, rows) {
    const out = [];
    for (let w = 0; w < RIVER_ROWS && out.length < rows; w++) out.push(templates[2 * NK + w]);
    let j = 1, o = 0, w = RIVER_ROWS;
    while (out.length < rows) {
      const h = heights[(j - 1) % heights.length];
      o++;
      out.push(templates[(j & 1) * NK + kindOf(o, h, w)]);
      w++;
      if (o === h) { j++; o = 0; }
    }
    return out;
  }

  // ---- 画面 ----
  const L0 = (en) => (ja, e) => (en ? e : ja);
  // 題とおわりの画面: 2〜9 行 題の板・10〜21 行 滝の段（川の水面は 17 行）・22〜29 行 字
  function scene(s) {
    const rows = world([5, 7], 23); // w = 0〜22
    for (let r = 0; r < 30; r++) {
      const w = 22 - r;
      for (let col = 0; col < 32; col++) s.nt[r][col] = w >= 0 && w < rows.length ? rows[w][col] : (col < 2 ? T('wallL' + (w & 3)) + col : col >= 30 ? T('wallR' + (w & 3)) + col - 30 : T('blank'));
    }
    // 上の 2 行は字の段（こい紺）
    for (let r = 0; r < 2; r++) for (let col = 0; col < 32; col++) s.nt[r][col] = T('blank');
    pal(s, 0, 0, 32, 30, 1);
    pal(s, 0, 0, 2, 30, 0); pal(s, 30, 0, 2, 30, 0);
    pal(s, 10, 0, 2, 30, 2); pal(s, 20, 0, 2, 30, 2);
    pal(s, 0, 0, 32, 2, 3);
  }
  function plateAt(s, r0, r1, c0, c1) {
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
      const top = row === r0, bot = row === r1, left = col === c0, right = col === c1;
      s.nt[row][col] = T(top ? (left ? 'p0' : right ? 'p2' : 'p1') : bot ? (left ? 'p5' : right ? 'p7' : 'p6') : left ? 'p3' : right ? 'p4' : 'blank');
    }
    pal(s, c0, r0, c1 - c0 + 1, r1 - r0 + 1, 3);
  }
  const clearRow = (s, row, c0, c1) => { for (let col = c0; col <= c1; col++) s.nt[row][col] = T('blank'); };

  const titles = [], huds = [], ends = [];
  for (const en of [false, true]) {
    const L = L0(en);
    const t = screen();
    scene(t);
    plateAt(t, 2, 9, 2, 29);
    [['SA', 8], ['KE', 11], ['no', 15], ['bo', 18], ['re', 21], ['ex', 23]].forEach(([k, col]) => put(t, col, 3, 'k_' + k, 2, 2));
    text(t, 11, 6, 'SALMON RUN');
    text(t, 9, 8, 'ASOBI LAB 2026');
    text(t, 13, 1, 'HI');
    for (const row of [22, 23, 24, 25, 26, 27, 28]) clearRow(t, row, 2, 29);
    pal(t, 2, 22, 28, 8, 3);
    const center = (row, s) => text(t, 16 - Math.ceil([...s].length / 2), row, s);
    center(22, L('A を ながく おして ちからを ためる', 'HOLD A TO BUILD POWER'));
    center(24, L('はなすと とぶ。 たきの うえへ!', 'LET GO TO LEAP UP THE FALL!'));
    center(26, L('くまの てが でたら まって!', 'WAIT WHILE THE BEAR SWIPES!'));
    titles.push(t);

    // あそぶ画面の字の段（$2000 の 0〜3 行。下は使わない）
    const hd = screen();
    for (let r = 0; r < 30; r++) for (let col = 0; col < 32; col++) hd.nt[r][col] = T('blank');
    for (let col = 0; col < 32; col++) hd.nt[3][col] = T('hudEdge');
    text(hd, en ? 1 : 3, 1, L('だん', 'STEP'));
    text(hd, en ? 10 : 11, 1, L('ちから', 'POWER'));
    text(hd, 25, 1, 'HI');
    for (let col = 16; col < 24; col++) hd.nt[1][col] = T('bar8');
    pal(hd, 0, 0, 32, 30, 3);
    huds.push(hd);

    const e = screen();
    scene(e);
    plateAt(e, 2, 9, 2, 29);
    text(e, 13, 1, 'HI');
    for (const row of [22, 23, 24, 25, 26, 27, 28]) clearRow(e, row, 2, 29);
    pal(e, 2, 22, 28, 8, 3);
    ends.push(e);
  }
  sym.ADDR_THI = addr(16, 1);
  sym.ADDR_STEP = addr(6, 1);
  sym.ADDR_BAR = addr(16, 1);
  sym.ADDR_PHI = addr(28, 1);
  sym.ADDR_ESTEP = addr(21, 4);
  sym.ADDR_EBEST = addr(21, 6);
  sym.T_BAR0 = T('bar0');
  sym.T_FTR0 = T('ftR0');

  // あそぶ画面（$2400）の色の表: 列ごとに同じ（0〜1・30〜31 列 岩かべ、10〜11・20〜21 列 滝、ほか 水と谷）
  const pcol = (col) => (col < 2 || col >= 30 ? 0 : (col >> 1) === 5 || (col >> 1) === 10 ? 2 : 1);
  const attrRow = Array.from({ length: 8 }, (_, ax) => { const a = pcol(ax * 4), b = pcol(ax * 4 + 2); return a | (b << 2) | (a << 4) | (b << 6); });
  const attr1 = Array.from({ length: 8 }, () => attrRow).flat();

  // 字（0 かな・1 英語）
  const MSGS = [];
  const len = (s) => [...s].length;
  const bi = (name, col, row, ja, en) => {
    const w = Math.max(len(ja), len(en));
    MSGS.push([name, col, row, ja + ' '.repeat(w - len(ja)), en + ' '.repeat(w - len(en))]);
  };
  const pad = (s, n) => s + ' '.repeat(n - len(s));
  const mid = (s, n) => { const k = Math.floor((n - len(s)) / 2); return ' '.repeat(k) + s + ' '.repeat(n - len(s) - k); };
  bi('push', 9, 28, mid('START を おしてね', 14), mid('PUSH START', 14));
  bi('push_off', 9, 28, ' '.repeat(14), '');
  // あそぶ画面の 2 行め（字の段）に しばらく出す
  const HW = 22;
  bi('hint', 5, 2, mid('A を ながく おして はなす', HW), mid('HOLD A THEN LET GO', HW));
  bi('low', 5, 2, mid('ちからが たりない!', HW), mid('NOT HIGH ENOUGH!', HW));
  bi('high', 5, 2, mid('つよすぎて いわに ごつん!', HW), mid('TOO HARD! BONK!', HW));
  bi('bear', 5, 2, mid('くまだ! なんとか にげた', HW), mid('BEAR! JUST GOT AWAY', HW));
  bi('tired', 5, 2, mid('ちからが つきた', HW), mid('OUT OF POWER', HW));
  bi('clear', 5, 2, ' '.repeat(HW), '');
  bi('e_step', 6, 4, pad('のぼった だん', 15), pad('STEPS CLIMBED', 15));
  bi('e_best', 6, 6, pad('さいこう', 15), pad('BEST', 15));
  bi('e_new', 10, 8, mid('しんきろく!', 12), mid('NEW RECORD!', 12));
  MSGS.forEach(([name], i) => { sym['M_' + name.toUpperCase()] = i; });
  sym.MSG_N = MSGS.length;

  // ---- とぶ表: P（いちばん高い所、ドット）→ はじめの上の速さ（8.8）と横の速さ（30 ドットで頂上に着く）----
  // game.s と同じ順: 高さ += 速さ、速さ -= G
  const G = 0x40, DX = 30;
  const apex = (v0) => { let h = 0, v = v0, n = 0; while (v > 0) { h += v; v -= G; n++; } return [h, n]; };
  const v0t = [], vxt = [];
  for (let P = 0; P < 256; P++) {
    let v = 0;
    while (apex(v)[0] < P * 256) v++;
    const n = Math.max(1, apex(v)[1]);
    v0t.push(v); vxt.push(Math.min(0x3ff, Math.round((DX * 256) / n)));
  }

  // ---- 曲: 谷をのぼるリール（ニ長調・4 拍子）と、おわりの短い曲 ----
  const e = (s) => s.split(' ').map((n) => n + ':0.5').join(' ');
  const A = [`${e('D5 F#5 A5 F#5 D5 F#5')} A5:1 | D march`, `${e('B5 A5 G5 F#5 E5 F#5')} G5:1 | G march`,
    `${e('A5 F#5 D5 F#5 E5 D5 C#5 E5')} | A march`, `${e('D5 E5 F#5 A5')} B5:1 A5:1 | D march`,
    `${e('D5 F#5 A5 F#5 D5 F#5')} A5:1 | D march`, `${e('B5 D6 B5 A5 G5 F#5')} E5:1 | G march`,
    `${e('F#5 A5 G5 E5 C#5 E5')} A4:1 | A march`, 'D5:1.5 E5:0.5 D5:2 | D march'];
  const B = [`A5:1 ${e('D6 C#6 B5 A5')} B5:1 | D march`, `${e('G5 B5 A5 G5')} F#5:1 E5:1 | Em march`,
    `${e('F#5 G5 A5 B5 A5 F#5')} E5:1 | A march`, `${e('F#5 D5 E5 F#5')} A5:2 | D march`,
    `A5:1 ${e('D6 C#6 B5 A5')} B5:1 | D march`, `${e('B5 A5 G5 B5 A5 G5')} F#5:1 | G march`,
    `${e('E5 F#5 G5 E5 C#5 D5')} E5:1 | A march`, 'D5:2 -:2 | D march'];
  const A2 = [...A.slice(0, 6), `${e('F#5 A5 G5 E5 C#5 E5')} A5:1 | A march`, 'D6:2 -:2 | D march'];
  const Q = 10, H = 20;
  const songs = {
    main: { tracks: compose({ beat: 18, bars: [...A, ...B, ...A2, ...B] }), duty: 0x40 },
    over: { tracks: [track(`A5 ${Q} F#5 ${Q} D5 ${Q} E5 ${Q} C#5 ${H} D5 ${H * 3}`, false, 0xfe), track(`D3 ${H} A2 ${H} A2 ${H} D3 ${H * 3}`, true, 0xfe)], duty: 0x80 },
  };
  const hex = (n) => '$' + n.toString(16).toUpperCase().padStart(2, '0');

  const data = `
; ---- ここから下はビルドが作ったデータ ----
palette:
  .byte ${PALETTES.flat().map(hex).join(',')}
${titles.map((s, i) => `nt_title_${i}:\n  .byte ${packNt(s).join(',')}`).join('\n')}
${huds.map((s, i) => `nt_hud_${i}:\n  .byte ${packNt(s).join(',')}`).join('\n')}
${ends.map((s, i) => `nt_end_${i}:\n  .byte ${packNt(s).join(',')}`).join('\n')}
attr1:
  .byte ${attr1.join(',')}
${templates.map((r, i) => `tm_${i}: .byte ${r.join(',')}`).join('\n')}
tm_lo: .byte ${templates.map((_, i) => `<tm_${i}`).join(', ')}
tm_hi: .byte ${templates.map((_, i) => `>tm_${i}`).join(', ')}
v0_lo: .byte ${v0t.map((v) => v & 0xff).join(',')}
v0_hi: .byte ${v0t.map((v) => v >> 8).join(',')}
vx_lo: .byte ${vxt.map((v) => v & 0xff).join(',')}
vx_hi: .byte ${vxt.map((v) => v >> 8).join(',')}
${MSGS.map(([name, col, row, ja, en]) => `${msg(`m_${name}_0`, col, row, ja)}\n${msg(`m_${name}_1`, col, row, en)}`).join('\n')}
msg_lo: .byte ${[0, 1].flatMap((l) => MSGS.map(([n]) => `<m_${n}_${l}`)).join(', ')}
msg_hi: .byte ${[0, 1].flatMap((l) => MSGS.map(([n]) => `>m_${n}_${l}`)).join(', ')}
${periodData()}
${songData(songs, sym)}
${voiceData([7, 7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2], 0x18, sym)}
`;
  return { chr: c.chr, count: c.count, sym, data };
}
