// ほって つんで 3D を画面なしで動かし、ボタンを押す台本で確かめる（パッドを押すだけ。RAM は読むだけ）。
//   node retro-32bit/tools/play-dig.mjs [--shots=こま,...]
//   台本: 前へ歩く → 下を見る → B で掘る → X で置く → 跳ぶ → 向きを回す。こまごとの位置・持ち物・描いた面の数を出す
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Console32 } from '../js/psx.js';
import { BTN } from '../js/pad.js';
import { ROOT, buildSoft } from './lib.mjs';
import { writePng } from './png.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=')[1];
const shots = opt('shots', '').split(',').filter(Boolean).map(Number);
const out = join(ROOT, '..', '_dev', 'retro-32bit');
mkdirSync(out, { recursive: true });

const { exe, syms } = await buildSoft('dig32');
const m = new Console32();
m.loadExe(exe);
const vb = (syms.vars & 0x1fffff) >> 2, V = (i) => m.ram32[vb + i];
const inv = () => [...m.ram.slice(syms.inv & 0x1fffff, (syms.inv & 0x1fffff) + 9)].slice(1).join(' ');
// [はじめのこま, おわりのこま, ボタン]
const SCRIPT = [
  [40, 100, 'UP'], [100, 125, 'R'], [130, 175, 'B'], [180, 182, 'X'], [190, 192, 'X'],
  [200, 201, 'A'], [230, 290, 'LEFT'], [290, 330, 'UP'], [330, 334, 'A'], [332, 360, 'UP'],
];
const last = Math.max(400, ...shots);
let blink0 = 0;
for (let f = 1; f <= last; f++) {
  let b = 0;
  for (const [a, z, k] of SCRIPT) if (f >= a && f < z) b |= 1 << BTN[k];
  m.sio.buttons[0] = b;
  m.runFrame(); m.spu.take();
  if (f === 30) blink0 = V(16);
  if (shots.includes(f)) {
    const buf = new Uint8ClampedArray(640 * 480 * 4), { w, h } = m.display(buf);
    writePng(join(out, `dig-${f}.png`), w, h, (x, y) => { const o = (y * w + x) * 4; return (buf[o] << 16) | (buf[o + 1] << 8) | buf[o + 2]; }, 2);
  }
  if (f % 50 === 0 || shots.includes(f)) console.log(`こま ${f}: 位置 ${(V(0) / 256).toFixed(1)},${(V(1) / 256).toFixed(2)},${(V(2) / 256).toFixed(1)} 地面 ${V(6)} ねらい ${V(10)} 持ち物 ${inv()} 選び ${V(15)} 面 ${V(21)} 掘り ${V(13)}/${V(14)}`);
}
console.log(`ゲームの1回 / こま = ${((V(16) - blink0) / (last - 30)).toFixed(2)}`);
