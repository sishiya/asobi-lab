// うて! テッポウウオ を画面なしで遊ぶボット。node retro-8bit/tools/archerfish-play.mjs <bot|none|mash|sweep> [絵のフォルダ] [たね] [en]
//   bot = とまった虫の下へ行って吹き（ハチはうたない）、落ちた虫へ泳ぐ（RAM を読む）・none = 何もしない
//   mash = 動かずに A を連打・sweep = 左右に泳ぎつづけて A を連打（腕なしの抜け道があるかを見る）
//   絵のフォルダをわたすと、タイトル・あそぶ画面いくつか・おわりを PNG に
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Console8, BTN } from '../js/nes.js';
import { writePng } from './png.mjs';
const G = join(dirname(fileURLToPath(import.meta.url)), '..') + '/';
const mode = process.argv[2] || 'bot', out = process.argv[3] === '-' ? '' : process.argv[3], seed = +(process.argv[4] || 1), lang = process.argv[5] === 'en' ? 1 : 0;
const nes = new Console8(readFileSync(G + 'roms/archerfish.nes'), 44100);
nes.cart.prgRam[0x1fff] = lang;
const R = () => nes.ram;
let f = 0;
const run = (k) => { for (let i = 0; i < k; i++) { nes.runFrame(); nes.apu.take(); f++; } };
const shot = (name) => { if (!out) return; const fb = nes.ppu.frame; writePng(`${out}/${name}.png`, 256, 240, (x, y) => { const c = fb[y * 256 + x]; return ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff); }, 2); };
const tap = (b, k = 2) => { nes.setButton(0, BTN[b], true); run(k); nes.setButton(0, BTN[b], false); run(4); };
let r = seed * 7919;
const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
run(90 + seed * 13); shot('title');
tap('START');
const NI = 6;
const ins = (m, i) => ({ t: m[0x40 + i], st: m[0x46 + i], x: m[0x4c + i], y: m[0x58 + i] });
const cxOf = (b) => b.x + (b.t === 2 && b.st < 5 ? 4 : 8);
let held = { A: false, LEFT: false, RIGHT: false }, stings = 0, lastStun = 0, shots = 0, stolen = 0, lastSpl = 0;
const press = (b, v) => { if (held[b] !== v) { nes.setButton(0, BTN[b], v); held[b] = v; } };
const shotsAt = new Set([60, 600, 1500, 2600]);
let stungShot = false, floatShot = false, jetShot = false, sweepDir = 1, fireCool = 0, maxBugs = 0, g = 0;
for (; g < 60 * 600 && R()[7] === 1; g++) {
  const m = R(), fx = m[0x10], mouth = m[0xbe];
  let goal = -1, fire = false;
  if (mode === 'bot') {
    const bugs = Array.from({ length: NI }, (_, i) => ins(m, i));
    // 1. 浮いている虫（いちばん近い）
    const fl = bugs.filter((b) => b.st === 5).sort((a, b) => Math.abs(cxOf(a) - mouth) - Math.abs(cxOf(b) - mouth));
    const fall = bugs.filter((b) => b.st === 4);
    if (fl.length) goal = cxOf(fl[0]);
    else if (fall.length) goal = cxOf(fall[0]);
    else {
      // 2. とまっている虫（ハチ以外）でいちばん近いもの。下に来たら吹く
      const pr = bugs.filter((b) => b.st === 2 && b.t !== 3).sort((a, b) => Math.abs(cxOf(a) - mouth) - Math.abs(cxOf(b) - mouth));
      if (pr.length) {
        goal = cxOf(pr[0]);
        const wasp = bugs.some((b) => b.st === 2 && b.t === 3 && Math.abs(cxOf(b) - mouth) < 9 && b.y > pr[0].y);
        if (Math.abs(goal - mouth) < 4 && !wasp && !m[0x17]) fire = true;
      }
    }
  } else if (mode === 'mash') {
    fire = fireCool === 0;
  } else if (mode === 'sweep') {
    if (fx > 220) sweepDir = -1; if (fx < 8) sweepDir = 1;
    goal = sweepDir > 0 ? 255 : 0;
    fire = fireCool === 0;
  }
  if (goal >= 0) { const d = goal - mouth; press('RIGHT', d > 2); press('LEFT', d < -2); } else { press('RIGHT', false); press('LEFT', false); }
  if (fire) { press('A', true); fireCool = 2; shots++; } else press('A', false);
  if (fireCool) fireCool--;
  run(1);
  const n = R();
  if (n[0x16] > lastStun) { stings++; if (!stungShot) { stungShot = true; run(6); shot('sting'); } }
  if (!floatShot && g > 300 && [0, 1, 2, 3, 4, 5].some((i) => n[0x46 + i] === 5) && [0, 1].some((i) => n[0x9a + i] === 0)) { floatShot = true; shot('float'); }
  if (!jetShot && n[0x17] && n[0x19] < 80) { jetShot = true; shot('jet'); }
  lastStun = n[0x16];
  if (shotsAt.has(g)) shot('play' + g);
  maxBugs = Math.max(maxBugs, n[0x1a]);
}
for (const b of Object.keys(held)) press(b, false);
run(60); shot('end0');
run(60); shot('end');
console.log(`mode ${mode} たね ${seed}: たべた ${R()[0x1a]} ひき（いちばん多いとき ${maxBugs}）・さされた ${stings}・吹いた ${shots}・${(g / 60).toFixed(0)} 秒・段 ${R()[0x1f]}・state ${R()[7]}`);
