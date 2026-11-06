// ミツバチの おどり を画面なしで遊ぶボット（RAM のダンスを読む）。node retro-8bit/tools/bee-play.mjs <read|off1|sun|rand> [絵のフォルダ] [たね] [en]
//   read = ダンスを正しく読む・off1 = 向きを 1 ずらす・sun = いつも太陽へ・rand = でたらめ。絵のフォルダをわたすと、タイトル・巣・ねらい・花・おわりを PNG に
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Console8, BTN } from '../js/nes.js';
import { writePng } from './png.mjs';
const G = join(dirname(fileURLToPath(import.meta.url)), '..') + '/';
const mode = process.argv[2] || 'read', out = process.argv[3], seed = +(process.argv[4] || 1), lang = process.argv[5] === 'en' ? 1 : 0;
const nes = new Console8(readFileSync(G + 'roms/bee-dance.nes'), 44100);
nes.cart.prgRam[0x1fff] = lang;
const R = () => nes.ram;
let f = 0; const shots = [];
const run = (k) => { for (let i = 0; i < k; i++) { nes.runFrame(); nes.apu.take(); f++; } };
const shot = (name) => { if (!out) return; const fb = nes.ppu.frame; writePng(`${out}/${name}.png`, 256, 240, (x, y) => { const c = fb[y * 256 + x]; return ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff); }, 2); };
const tap = (b, k = 2) => { nes.setButton(0, BTN[b], true); run(k); nes.setButton(0, BTN[b], false); run(4); };
let r = seed * 7919;
const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
run(60 + seed * 13); shot('title');
tap('START');
const log = [];
for (let trip = 0; trip < 10; trip++) {
  // 巣: 1 回おどるまで待つ
  let g = 0; while (R()[7] === 1 && R()[0x24] < 1 && g++ < 2000) run(1);
  if (trip === 0 || trip === 1) { run(trip ? 20 : 6); shot('hive' + trip); }
  const da = R()[0x20], dn = R()[0x21], sun = R()[0x12];
  tap('A'); run(4);
  if (R()[7] !== 2) { console.log('ねらう画面にならない state', R()[7]); break; }
  let wantD = (da + sun) & 15, wantK = dn;
  if (mode === 'off1') wantD = (wantD + 1) & 15;
  if (mode === 'rand') { wantD = Math.floor(rnd() * 16); wantK = 1 + Math.floor(rnd() * 5); }
  if (mode === 'sun') { wantD = sun; wantK = 3; }
  for (let i = 0; i < 16 && R()[0x13] !== wantD; i++) tap(((wantD - R()[0x13]) & 15) <= 8 ? 'RIGHT' : 'LEFT');
  for (let i = 0; i < 5 && R()[0x14] < wantK; i++) tap('UP');
  for (let i = 0; i < 5 && R()[0x14] > wantK; i++) tap('DOWN');
  if (trip <= 1) shot('aim' + trip);
  tap('A');
  g = 0; while (R()[7] === 3 && g++ < 200) run(1);
  if (trip <= 1) { run(10); shot('flower' + trip); }
  g = 0; while ((R()[7] === 4 || R()[7] === 5) && g++ < 300) run(1);
  log.push(`${trip + 1}: 太陽 ${sun} ダンス ${da}/${dn} → ${wantD}/${wantK} みつ ${R()[0x15]}`);
}
run(30); shot('end');
console.log(log.join('\n'));
console.log(`mode ${mode}: みつ ${R()[0x15]}・HI ${R()[0x16]}・state ${R()[7]}・フレーム ${f}`);
