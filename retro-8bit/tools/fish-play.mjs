// とべ! トビウオ を画面なしで遊ぶボット。node retro-8bit/tools/fish-play.mjs <bot|none|hold|tap> [絵のフォルダ] [たね] [en]
//   bot = うしろの マグロなら飛び、グンカンドリなら もぐる（RAM を読む）・none = 何もしない・hold = おしっぱなし・tap = でたらめに おす
//   絵のフォルダをわたすと、タイトル・あそぶ画面いくつか・おわりを PNG に
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Console8, BTN } from '../js/nes.js';
import { writePng } from './png.mjs';
const G = join(dirname(fileURLToPath(import.meta.url)), '..') + '/';
const mode = process.argv[2] || 'bot', out = process.argv[3], seed = +(process.argv[4] || 1), lang = process.argv[5] === 'en' ? 1 : 0;
const nes = new Console8(readFileSync(G + 'roms/flying-fish.nes'), 44100);
nes.cart.prgRam[0x1fff] = lang;
const R = () => nes.ram;
let f = 0;
const run = (k) => { for (let i = 0; i < k; i++) { nes.runFrame(); nes.apu.take(); f++; } };
const shot = (name) => { if (!out) return; const fb = nes.ppu.frame; writePng(`${out}/${name}.png`, 256, 240, (x, y) => { const c = fb[y * 256 + x]; return ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff); }, 2); };
const tap = (b, k = 2) => { nes.setButton(0, BTN[b], true); run(k); nes.setButton(0, BTN[b], false); run(4); };
let r = seed * 7919;
const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const FX = 144, SURF = 116;
run(90 + seed * 13); shot('title');
tap('START');
const dist = () => R().slice(0x19, 0x1d).join('');
let warnShot = false, birdShot = false, dive = false, held = false, hits = 0, lastLives = 3, leaps = 0, lastAir = 0;
const shotsAt = new Set([40, 300, 700, 1200, 2000]);
for (let g = 0; g < 60 * 600 && R()[7] === 1; g++) {
  const m = R(), fy = m[0x10], air = m[0x14], vy = (m[0x13] << 24 >> 24) + m[0x12] / 256;
  let want = false;
  if (mode === 'hold') want = true;
  else if (mode === 'tap') want = rnd() < 0.5 ? held : !held;
  else if (mode === 'bot') {
    // いちばん近くの うしろのもの
    let th = 0, best = 999, bx = 0;
    for (let i = 0; i < 4; i++) {
      const t = m[0x40 + i]; if (!t) continue;
      const x = m[0x44 + i] ? m[0x4c + i] : 0;
      if (x > FX + 20) continue;
      const d = FX - x; if (d < best) { best = d; th = t; bx = x; }
    }
    if (th === 1) { if (!air && fy < 150 && vy >= -0.5 && bx < 70) dive = true; if (fy >= 150) dive = false; want = air ? true : !dive; } // マグロ: 少しもぐって勢いをつけて飛ぶ          // マグロ: 深くから勢いをつけて飛ぶ・空では広げる
    else if (th === 2) want = air ? false : fy > 176;                 // グンカンドリ: もぐって深さをたもつ
    else want = air ? true : (vy < 0 ? fy > 140 : fy > 168);          // なにもない: 浅く泳ぐ
  }
  if (want !== held) { nes.setButton(0, BTN.A, want); held = want; }
  run(1);
  if (R()[0x14] && !lastAir) leaps++;
  lastAir = R()[0x14];
  if (R()[0x22] < lastLives) { hits++; lastLives = R()[0x22]; if (process.env.DBG) { const m = R(); console.log(`hit ${dist()}m fy ${m[0x10]} air ${m[0x14]} vy ${m[0x13]}:${m[0x12]}`, [0, 1, 2, 3].map((i) => m[0x40 + i] ? `${m[0x40 + i] === 1 ? 'T' : 'B'}${m[0x44 + i]} x${m[0x4c + i]} y${m[0x54 + i]}` : '-').join(' ')); } }
  if (process.env.TL && g % 8 === 0 && g < +process.env.TL) { const m = R(); console.log(g, 'fy', m[0x10], 'air', m[0x14], 'hold', held ? 1 : 0, [0, 1, 2, 3].map((i) => m[0x40 + i] ? `${m[0x40 + i]}:${m[0x44 + i]} x${m[0x4c + i]} y${m[0x54 + i]}` : '-').join(' ')); }
  if (shotsAt.has(g)) shot('play' + g);
  if (!warnShot && g > 200 && Array.from({ length: 64 }, (_, i) => R()[0x201 + i * 4]).includes(46)) { warnShot = true; run(1); shot('warn'); const o = R().slice(0x200, 0x300); for (let i = 0; i < 64; i++) if (o[i * 4 + 1] === 46) console.log('warn oam', o[i * 4], o[i * 4 + 2], o[i * 4 + 3], 'slot', i); } // ！（スプライトの絵 46）が出ている
  if (!birdShot && [0, 1, 2, 3].some((i) => R()[0x40 + i] === 2 && R()[0x44 + i] && R()[0x4c + i] > 90 && R()[0x4c + i] < 130)) { birdShot = true; shot('bird'); }
}
nes.setButton(0, BTN.A, false);
run(60); shot('end0');
run(60); shot('end');
console.log(`mode ${mode} たね ${seed}: きょり ${dist()}m・つかまった ${hits}・飛んだ ${leaps} 回・${(f / 60).toFixed(0)} 秒・state ${R()[7]}`);
