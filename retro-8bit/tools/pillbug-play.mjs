// ダンゴムシのみち の ROM を、面ごとに解き方（rules.mjs の solve）どおりに遊ばせて、JS の決まりと同じに歩くかを確かめる。
//   node retro-8bit/tools/pillbug-play.mjs            全部の面
//   node retro-8bit/tools/pillbug-play.mjs 5 --shot   5面だけ。石を置いたところと、食べたあとを PNG に
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Console8, BTN } from '../js/nes.js';
import { writePng } from './png.mjs';
import { STAGES } from '../src/pillbug-path/stages.mjs';
import { parse, walk, solve, W } from '../src/pillbug-path/rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--')).map(Number);
const shot = args.includes('--shot');
const rom = readFileSync(join(ROOT, 'roms/pillbug-path.nes'));
const out = join(ROOT, '..', '_dev', 'retro-8bit');
mkdirSync(out, { recursive: true });
const R = { state: 0x07, bugX: 0x17, bugY: 0x18 };

let bad = 0;
for (let n = 0; n < STAGES.length; n++) {
  if (only.length && !only.includes(n + 1)) continue;
  const map = parse(STAGES[n]);
  const sol = solve(map);
  const stones = args.includes('--none') ? [] : sol.sols.filter((s) => s.length === sol.min)[0] || [];
  const want = walk(map, stones);

  const nes = new Console8(rom, 44100);
  // セーブに「n 面までえらべる」を入れておく → タイトルは n 面がえらばれている
  nes.cart.prgRam.set([0x50, 0x42, 0x30, 0x31, n]);
  const queue = []; // [ボタン, 押すフレーム数]
  const tap = (b) => { queue.push([b, 2], [null, 2]); };
  queue.push([null, 30]); tap('START'); queue.push([null, 20]);
  let cx = map.start.x, cy = map.start.y;
  for (const i of stones) {
    const x = i % W, y = Math.floor(i / W);
    while (cx < x) { tap('RIGHT'); cx++; } while (cx > x) { tap('LEFT'); cx--; }
    while (cy < y) { tap('DOWN'); cy++; } while (cy > y) { tap('UP'); cy--; }
    tap('A');
  }
  tap('START');
  let f = 0, step = null, hold = 0;
  const path = [];
  let lastCell = -1, result = 'timeout';
  for (; f < 4000; f++) {
    if (!hold && queue.length) { const [b, k] = queue.shift(); step = b; hold = k; }
    for (const b of ['A', 'B', 'START', 'SELECT', 'UP', 'DOWN', 'LEFT', 'RIGHT']) nes.setButton(0, BTN[b], step === b && hold > 0);
    if (hold) hold--;
    if (hold === 0 && !queue.length) step = null;
    nes.runFrame();
    const r = nes.ram;
    if (r[R.state] === 2 && !(r[R.bugX] & 15) && !(r[R.bugY] & 15)) {
      const c = (r[R.bugY] >> 4) * W + (r[R.bugX] >> 4);
      if (c !== lastCell) { path.push(c); lastCell = c; }
    }
    if (r[R.state] === 3) { result = 'clear'; break; }
    if (r[R.state] === 4) { result = 'sun'; break; }
  }
  if (r0(nes) === 3 && path[path.length - 1] !== want.path[want.path.length - 1]) path.push(want.path[want.path.length - 1]);
  const same = path.join() === want.path.join();
  const ok = result === want.result && same;
  if (!ok) bad++;
  console.log(`${String(n + 1).padStart(2)} ${STAGES[n].name.padEnd(14)} 石 ${stones.length}: ROM ${result}（${path.length} ます・${f} フレーム）・JS ${want.result}（${want.path.length} ます）${ok ? '' : ' ★ ちがう'}`);
  if (!same && !ok) console.log('   ROM', path.join(' '), '\n   JS ', want.path.join(' '));
  if (shot) {
    for (let k = 0; k < 40; k++) nes.runFrame();
    const fb = nes.ppu.frame;
    writePng(join(out, `pillbug-${n + 1}.png`), 256, 240, (x, y) => { const c = fb[y * 256 + x]; return ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff); }, 2);
  }
}
function r0(nes) { return nes.ram[R.state]; }
console.log(bad ? `★ ${bad} 面がちがう` : 'ぜんぶ JS の決まりと同じに歩いた');
