// カエルのよる のデータ（絵・画面・曲・表）。tools/build.mjs が呼ぶ
import { BG, KANA, SP } from './art.mjs';
import { makeChr, shadow, screen, put as put0, text as text0, pal, packNt, addr, msg as msg0, track, periodData, songData, voiceData, compose } from '../../tools/lib.mjs';

export const PALETTES = [[0x0f, 0x30, 0x21, 0x01], [0x0f, 0x1a, 0x2a, 0x01], [0x0f, 0x01, 0x11, 0x21], [0x0f, 0x38, 0x28, 0x16],
  [0x0f, 0x09, 0x2a, 0x38], [0x0f, 0x16, 0x25, 0x30], [0x0f, 0x00, 0x31, 0x17], [0x0f, 0x00, 0x28, 0x38]];

export function build() {
  const c = makeChr();
  const { sym } = c;
  const put = (...a) => put0(c, ...a), text = (...a) => text0(c, ...a), msg = (...a) => msg0(c, ...a);

  // 背景
  c.big(0, 'blank', BG.blank);
  c.font();
  for (const k of ['star1', 'star2', 'star3', 'reedTop', 'reedMid', 'pads', 'water1', 'water2', 'water3', 'moon']) c.big(0, k, BG[k]);
  for (const [k, rows] of Object.entries(KANA)) c.big(0, 'k_' + k, shadow(rows, (y) => (y < 7 ? '2' : '1')));
  // スプライト
  c.big(1, 'none', BG.blank);
  for (const [k, rows] of Object.entries(SP)) c.big(1, k, rows);

  function scenery(s, keepClear) {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 40; i++) {
      const col = 2 + Math.floor(rnd() * 28), r = 4 + Math.floor(rnd() * 18);
      if (r >= 3 && r <= 6 && col >= 22 && col <= 27) continue; // 月のまわり
      if ((col <= 3 || col >= 28) && r >= 14) continue;          // 草のパレット
      if (keepClear(col, r)) continue;
      const k = rnd();
      put(s, col, r, k < 0.55 ? 'star2' : k < 0.88 ? 'star1' : 'star3');
    }
    put(s, 24, 4, 'moon', 2, 2); pal(s, 24, 4, 2, 2, 3);
    for (const [col, top] of [[0, 15], [2, 19], [30, 16], [28, 20]]) {
      put(s, col, top, 'reedTop', 2, 1);
      for (let r = top + 1; r < 24; r++) put(s, col, r, 'reedMid', 2, 1);
      pal(s, col, top & ~1, 2, 24 - (top & ~1), 1);
    }
    for (let col = 0; col < 32; col += 4) put(s, col, 24, 'pads', 4, 2);
    pal(s, 0, 24, 32, 2, 1);
    for (let r = 26; r < 30; r++) for (let col = 0; col < 32; col++) put(s, col, r, ['water1', 'water2', 'water3'][(col * 7 + r * 3) % 5 % 3]);
    pal(s, 0, 26, 32, 4, 2);
  }

  const title = screen();
  scenery(title, (col, r) => (r >= 1 && r <= 3) || (r >= 5 && r <= 14) || r === 17 || r === 21);
  ['ka', 'e', 'ru', 'no', 'yo', 'ru2'].forEach((k, i) => put(title, 7 + i * 3, 6, 'k_' + k, 2, 2));
  pal(title, 6, 6, 20, 2, 1);
  text(title, 11, 10, 'FROG NIGHT');
  text(title, 10, 13, '10');
  text(title, 16, 13, '30');
  text(title, 22, 13, 'NO!');
  text(title, 11, 17, 'PUSH START');
  text(title, 12, 2, 'HI');
  text(title, 15, 2, '000000');
  text(title, 9, 21, 'ASOBI LAB 2026');
  sym.ADDR_HI = addr(15, 2);

  const play = screen();
  scenery(play, (col, r) => r <= 3 || (r >= 11 && r <= 13) || r === 17);
  text(play, 2, 2, 'SCORE');
  text(play, 8, 2, '000000');
  text(play, 22, 2, 'TIME');
  text(play, 27, 2, '90');
  sym.ADDR_SCORE = addr(8, 2);
  sym.ADDR_TIME = addr(27, 2);

  // 曲: 夜の池の子守歌（3拍子、ラの短調）。A・A'・B・B'・A と、ベースだけの4小節の息つぎ ＝ 44 小節・約 44 秒で1周
  const A = ['A4:1 C5:1 E5:1 | Am', 'D5:2 C5:1 | F', 'B4:1 C5:1 D5:1 | G', 'E5:3 | E',
    'A4:1 C5:1 E5:1 | Am', 'G5:2 E5:1 | C', 'D5:1 C5:1 B4:1 | G', 'A4:3 | Am'];
  const A2 = ['C5:1 E5:1 A5:1 | Am', 'G5:2 E5:1 | C', 'F5:1 E5:1 D5:1 | Dm', 'E5:3 | E',
    'C5:1 B4:1 A4:1 | Am', 'B4:2 G4:1 | G', 'A4:1 B4:1 C5:1 | F', 'A4:3 | Am'];
  const B = ['G5:2 E5:1 | C', 'F5:2 D5:1 | Dm', 'E5:1 D5:1 C5:1 | Am', 'D5:3 | G',
    'E5:2 C5:1 | Am', 'D5:2 B4:1 | G', 'C5:1 B4:1 A4:1 | F', 'B4:2 -:1 | E'];
  const B2 = ['G5:2 A5:1 | C', 'G5:2 E5:1 | Am', 'F5:1 G5:1 F5:1 | Dm', 'E5:3 | Am',
    'D5:1 E5:1 F5:1 | Dm', 'E5:2 C5:1 | Am', 'B4:1 C5:1 D5:1 | G', 'E5:2 -:1 | E'];
  const breath = ['-:3 | Am', '-:3 | F', '-:3 | G', '-:3 | E'];
  const E = 8, Q = 16, DH = 48, H = 32;
  const songs = {
    main: { tracks: compose({ beat: 20, bars: [...A, ...A2, ...B, ...B2, ...A, ...breath] }), duty: 0x80 },
    morning: { tracks: [track(`C5 ${E} E5 ${E} G5 ${E} C6 ${DH}`, false, 0xfe), track(`C3 ${Q} G2 ${Q} C3 ${Q} C3 ${Q}`, true, 0xfe)], duty: 0x80 },
    over: { tracks: [track(`E5 ${Q} C5 ${Q} A4 ${Q} E4 ${H}`, false, 0xfe), track(`A2 ${Q} E2 ${Q} A2 ${Q} A2 ${H}`, true, 0xfe)], duty: 0x80 },
  };
  const wave = [5, 12, 9].flatMap((A) => Array.from({ length: 64 }, (_, i) => Math.round(A * Math.sin((2 * Math.PI * i) / 64)) & 0xff));
  const hex = (n) => '$' + n.toString(16).toUpperCase().padStart(2, '0');

  const data = `
; ---- ここから下はビルドが作ったデータ ----
palette:
  .byte ${PALETTES.flat().map(hex).join(',')}
nt_title:
  .byte ${packNt(title).join(',')}
nt_play:
  .byte ${packNt(play).join(',')}
${msg('txt_push', 11, 17, 'PUSH START')}
${msg('txt_push_off', 11, 17, '          ')}
${msg('txt_pause', 13, 12, 'PAUSE')}
${msg('txt_pause_off', 13, 12, '     ')}
${msg('txt_morning', 9, 12, 'GOOD MORNING!')}
${msg('txt_over', 11, 12, 'GAME OVER')}
${periodData()}
wave: .byte ${wave.join(',')}
wave_off: .byte 0, 64, 128
${songData(songs, sym)}
${voiceData([7, 7, 6, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3], 0x28, sym)}
`;
  return { chr: c.chr, count: c.count, sym, data };
}
