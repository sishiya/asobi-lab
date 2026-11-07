// カワセミ ダイブ を画面なしで遊ぶボット。node retro-8bit/tools/kingfisher-play.mjs <bot|none|hold|tap|spam> [絵のフォルダ] [たね] [en]
//   bot = とまっているとき、いまとびこむと何に当たるかを決まりどおりに先読みして、魚に当たるなら とびこむ（ナマズなら待つ）
//   none = 何もしない・hold = おしっぱなし・tap = でたらめに おす・spam = 枝にもどるたびに すぐ とびこむ（連打）
//   絵のフォルダをわたすと、タイトル・あそぶ画面いくつか・おわりを PNG に
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Console8, BTN } from '../js/nes.js';
import { writePng } from './png.mjs';
const G = join(dirname(fileURLToPath(import.meta.url)), '..') + '/';
const { diveTrack, DIVE } = await import(pathToFileURL(G + 'src/kingfisher/data.mjs').href);
const mode = process.argv[2] || 'bot', out = process.argv[3], seed = +(process.argv[4] || 1), lang = process.argv[5] === 'en' ? 1 : 0;
const nes = new Console8(readFileSync(G + 'roms/kingfisher.nes'), 44100);
nes.cart.prgRam[0x1fff] = lang;
const R = () => nes.ram;
let f = 0;
const run = (k) => { for (let i = 0; i < k; i++) { nes.runFrame(); nes.apu.take(); f++; } };
const shot = (name) => { if (!out) return; const fb = nes.ppu.frame; writePng(`${out}/${name}.png`, 256, 240, (x, y) => { const c = fb[y * 256 + x]; return ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff); }, 2); };
const tap = (b, k = 2) => { nes.setButton(0, BTN[b], true); run(k); nes.setButton(0, BTN[b], false); run(4); };
let r = seed * 7919;
const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const W = [0, 8, 16, 24, 32], HITW = [0, 13, 21, 29, 36], HH = [0, 5, 5, 5, 7];
const TRACK = diveTrack();

// いまとびこんだら、はじめに当たるもの（0 なし・1〜3 魚・4 ナマズ）
function predict(m) {
  const fish = [];
  for (let i = 0; i < 5; i++) {
    const t = m[0x40 + i]; if (!t) continue;
    const xh = m[0x4a + i] === 0xff ? -1 : m[0x4a + i];
    const x = xh * 256 + m[0x45 + i] + m[0x4f + i] / 256, v = (m[0x5e + i] + m[0x59 + i] / 256) * (m[0x63 + i] ? -1 : 1);
    fish.push({ t, x, v, y: m[0x54 + i] });
  }
  for (let k = 0; k < TRACK.length; k++) {
    const { beak, wet } = TRACK[k];
    if (!wet) continue;
    for (const q of fish) {
      const x = Math.floor(q.x + q.v * k), d = DIVE.BEAKX + 2 - x;
      if (Math.abs(beak - q.y) < HH[q.t] && d >= 0 && d < HITW[q.t]) return q.t;
    }
  }
  return 0;
}

run(150 + seed * 13); shot('title');
// 見本のとびこみを撮る
for (let i = 0; i < 900 && R()[0x14] !== 1; i++) run(1);
run(14); shot('title-dive');
run(seed * 17);
tap('START');
const f0 = f;
let held = false, dives = 0, catches = 0, bonks = 0, lastSt = 0, lastCarry = 0;
const shotsAt = new Set([60, 600, 1800, 3600]);
let maxLevel = 0;
for (let g = 0; g < 60 * 600 && R()[7] === 1; g++) {
  const m = R(), perched = m[0x14] === 0 && m[0x15] === 0;
  let want = false;
  if (mode === 'hold') want = true;
  else if (mode === 'tap') want = rnd() < 0.5 ? held : !held;
  else if (mode === 'spam') want = !held && perched;
  else if (mode === 'bot') want = perched && !held && [1, 2, 3].includes(predict(m));
  if (want !== held) { nes.setButton(0, BTN.A, want); held = want; }
  run(1);
  const st = R()[0x14];
  if (st === 1 && lastSt !== 1) dives++;
  if (R()[0x16] && !lastCarry) catches++;
  if (R()[0x75] === 39) bonks++;
  lastSt = st; lastCarry = R()[0x16];
  maxLevel = Math.max(maxLevel, R()[0x22]);
  if (shotsAt.has(g)) shot('play' + g);
  if (out && !globalThis.catShot && [0, 1, 2, 3, 4].some((i) => R()[0x40 + i] === 4 && R()[0x4a + i] === 0 && R()[0x45 + i] > 50 && R()[0x45 + i] < 180)) { globalThis.catShot = 1; shot('cat'); }
  if (out && g > 300 && st === 2 && R()[0x16] && !globalThis.cShot) { globalThis.cShot = 1; shot('carry'); }
  if (out && g > 300 && st === 3 && !globalThis.eShot) { globalThis.eShot = 1; shot('eat'); }
  if (out && g > 300 && st === 1 && R()[0x17] && !globalThis.dShot) { globalThis.dShot = 1; shot('dive'); }
}
const fEnd = f;
nes.setButton(0, BTN.A, false);
const sc = R().slice(0x18, 0x1c).join('');
run(40); shot('end0');
run(80); shot('end');
console.log(`mode ${mode} たね ${seed}: 点 ${sc}・とびこみ ${dives}・とれた ${catches}・ナマズ ${bonks}・段 ${maxLevel}・あそび ${((fEnd - f0) / 60).toFixed(0)} 秒・state ${R()[7]}`);
