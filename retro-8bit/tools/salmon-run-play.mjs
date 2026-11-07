// サケ のぼれ! を画面なしで遊ぶボット。node retro-8bit/tools/salmon-run-play.mjs <bot|best|none|hold|tap|rand> [絵のフォルダ] [たね] [en]
//   bot = ふちと上の岩のあいだを ねらって ためる（人のように ±9 ドット ずれる）。クマが手をのばし終わるころに はなす
//   best = ずれなし・blind = クマを見ない・none = 何もしない・hold = おしっぱなし・tap = れんだ・rand = でたらめな長さで ためる
//   絵のフォルダをわたすと、タイトル・あそぶ画面いくつか・ためているところ・クマ・おわりを PNG に
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Console8, BTN } from '../js/nes.js';
import { writePng } from './png.mjs';
const G = join(dirname(fileURLToPath(import.meta.url)), '..') + '/';
const mode = process.argv[2] || 'bot', out = process.argv[3], seed = +(process.argv[4] || 1), lang = process.argv[5] === 'en' ? 1 : 0;
const nes = new Console8(readFileSync(G + 'roms/salmon-run.nes'), 44100);
nes.cart.prgRam[0x1fff] = lang;
const R = () => nes.ram;
let f = 0;
const run = (k) => { for (let i = 0; i < k; i++) { nes.runFrame(); nes.apu.take(); f++; } };
const shot = (name) => { if (!out) return; const fb = nes.ppu.frame; writePng(`${out}/${name}.png`, 256, 240, (x, y) => { const c = fb[y * 256 + x]; return ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff); }, 2); };
const tap = (b, k = 2) => { nes.setButton(0, BTN[b], true); run(k); nes.setButton(0, BTN[b], false); run(4); };
let r = seed * 7919;
const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const RATE = [0x140, 0x160, 0x180, 0x1a0, 0x1c0, 0x1e0, 0x200, 0x220];
const A = { state: 7, fst: 0x19, fh: 0x12, pw: 0x1b, steps: 0x1d, stam: 0x23, level: 0x25, scroll: 0x43, liph: 0x45, ceil: 0x46, bst: 0x50, bt: 0x51, bin: 0x52 };
run(150 + seed * 13); shot('title');
run(40); shot('title2');
tap('START');
const steps = () => R().slice(A.steps, A.steps + 3).join('');
let held = false, target = 0, low = 0, high = 0, bear = 0, chargeShot = false, bearShot = false, swipeShot = false, airShot = false, startF = f;
const shotsAt = new Set([20, 400, 1500, 3000]);
let prevFst = 0;
for (let g = 0; g < 60 * 600 && R()[A.state] === 1; g++) {
  const m = R(), fst = m[A.fst];
  let want = false;
  if (mode === 'hold') want = true;
  else if (mode === 'tap') want = (g & 7) < 2;
  else if (mode === 'rand') {
    if (fst === 1 && !m[A.scroll] && rnd() < 0.03) { target = 16 + rnd() * 130; want = true; }
    else if (fst === 2) want = m[A.pw] < target;
  } else if (mode === 'bot' || mode === 'best' || mode === 'blind') {
    const lo = m[A.liph] + 4, hi = m[A.ceil] - 6;
    if (fst === 1 && !m[A.scroll]) {
      target = (lo + hi) / 2 + (mode === 'bot' ? (rnd() * 2 - 1) * 9 : 0);
      const cf = Math.ceil(((target - 16) * 256) / RATE[m[A.level]]);
      const bs = m[A.bst], bt = m[A.bt];
      if (!bs || m[A.bin] || mode === 'blind') want = true;
      else if (bs === 3 && bt <= cf + 2) want = true;
      else if (bs === 1 && bt > cf + 55) want = true;
    } else if (fst === 2) want = m[A.pw] + RATE[m[A.level]] / 256 < target;
  }
  if (want !== held) { nes.setButton(0, BTN.A, want); held = want; }
  run(1);
  const n = R()[A.fst];
  if (prevFst === 3 && n === 4) { const st = R()[A.stam]; if (R()[0x5c] === 0 && R()[A.fh] + 5 >= R()[A.ceil] - 1) high++; else if (R()[A.bst] === 3) bear++; else low++; }
  prevFst = n;
  if (!chargeShot && n === 2 && R()[A.pw] > 50 && g > 600) { chargeShot = true; shot('charge'); }
  if (!bearShot && R()[A.bst] === 2 && !R()[A.bin] && g > 300) { bearShot = true; shot('bear' + R()[A.bst]); }
  if (!swipeShot && R()[A.bst] === 3 && R()[A.bt] < 28 && !R()[A.bin] && g > 300) { swipeShot = true; shot('swipe'); }
  if (!airShot && n === 3 && R()[A.fh] > 40 && g > 900) { airShot = true; shot('air'); }
  if (shotsAt.has(g)) shot('play' + g);
}
const playF = f - startF;
nes.setButton(0, BTN.A, false);
run(60); shot('end0');
run(150); shot('end');
console.log(`mode ${mode} たね ${seed}: ${steps()} 段・とどかない ${low}・ぶつかる ${high}・クマ ${bear}・${(playF / 60).toFixed(0)} 秒・state ${R()[A.state]}`);
