// ソフトを画面なしで動かして、決まったこまの絵を PNG に出す（確かめ用）。
//   node retro-32bit/tools/run.mjs [discs/〜.exe] --frames=10,60
//   絵は _dev/retro-32bit/run-<こま>.png（Git に入れない）。--vram で VRAM 全体（1024×512）も
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Console32 } from '../js/psx.js';
import { writePng } from './png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=')[1];
const file = args.find((a) => !a.startsWith('--')) || join(ROOT, 'discs/spin-tri.exe');
const shots = opt('frames', '60').split(',').map(Number);
const out = join(ROOT, '..', '_dev', 'retro-32bit');
mkdirSync(out, { recursive: true });

const m = new Console32();
m.loadExe(readFileSync(file));
const last = Math.max(...shots);
const t0 = performance.now();
const rgb = (c) => (((c & 31) * 255 / 31) << 16) | ((((c >> 5) & 31) * 255 / 31) << 8) | (((c >> 10) & 31) * 255 / 31);
for (let f = 1; f <= last; f++) {
  m.runFrame();
  if (shots.includes(f)) {
    const buf = new Uint8ClampedArray(640 * 480 * 4), { w, h } = m.display(buf);
    writePng(join(out, `run-${f}.png`), w, h, (x, y) => { const o = (y * w + x) * 4; return (buf[o] << 16) | (buf[o + 1] << 8) | buf[o + 2]; }, 2);
    if (args.includes('--vram')) writePng(join(out, `vram-${f}.png`), 1024, 512, (x, y) => rgb(m.gpu.vram[y * 1024 + x]));
    console.log(`こま ${f}: pc=${m.cpu.pc.toString(16)} 表示 ${w}×${h} (${m.gpu.dispX},${m.gpu.dispY})${m.tty ? ' 文字: ' + JSON.stringify(m.tty.slice(-80)) : ''}`);
  }
}
const ms = performance.now() - t0;
console.log(`${last} こまを ${ms.toFixed(0)}ms（1こま ${(ms / last).toFixed(2)}ms）`);
