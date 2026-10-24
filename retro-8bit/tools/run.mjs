// ROM を画面なしで動かして、決まったフレームの絵を PNG に出す（確かめ用）。
//   node retro-8bit/tools/run.mjs [rom] --frames=60,200 --press=START@100,A@180-185,RIGHT@190-260
//   絵は _dev/retro-8bit/run-<フレーム>.png（Git に入れない）
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Console8, BTN } from '../js/nes.js';
import { writePng } from './png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=')[1];
const rom = args.find((a) => !a.startsWith('--')) || join(ROOT, 'roms/frog-night.nes');
const shots = opt('frames', '60').split(',').map(Number);
const press = opt('press', '').split(',').filter(Boolean).map((s) => {
  const [b, r] = s.split('@'); const [a, z] = r.split('-').map(Number);
  return { b: BTN[b], a, z: z ?? a + 2 };
});
const out = join(ROOT, '..', '_dev', 'retro-8bit');
mkdirSync(out, { recursive: true });

const nes = new Console8(readFileSync(rom), 44100);
const last = Math.max(...shots);
const t0 = performance.now();
let samples = 0, peak = 0;
// --bot: カエルのよる を自動で遊ぶ（RAM を読んで、ホタルのいない列のいちばん近い虫の下へ行って舌）
const bot = args.includes('--bot');
const stat = { shots: 0, hurt: 0 };
let lastLives = 3;
function botStep(f) {
  const r = nes.ram;
  if (r[7] !== 1) return;
  const fx = r[0x10] + 8;
  let best = null, fire = false;
  for (let i = 0; i < 6; i++) {
    const t = r[0x40 + i]; if (!t || r[0x70 + i]) continue;
    const bx = r[0x46 + i] + 4, d = bx - fx;
    if (t === 3) { // 舌がもどるまでの 40 フレームに、ホタルが通る幅
      const sp = (r[0x64 + i] * 256 + r[0x5e + i]) / 256 * 40, e = r[0x6a + i] ? d - sp : d + sp;
      if (Math.min(d, e) < 10 && Math.max(d, e) > -10) fire = true;
      continue;
    }
    if (!best || Math.abs(d) < Math.abs(best)) best = d;
  }
  nes.setButton(0, BTN.LEFT, best !== null && best < -2);
  nes.setButton(0, BTN.RIGHT, best !== null && best > 2);
  const shoot = best !== null && Math.abs(best) < 6 && !fire && r[0x12] === 0 && f % 2 === 0;
  nes.setButton(0, BTN.A, shoot);
  if (shoot) stat.shots++;
  if (r[0x14] < lastLives) stat.hurt++;
  lastLives = r[0x14];
}
for (let f = 1; f <= last; f++) {
  const held = new Set(press.filter((p) => f >= p.a && f <= p.z).map((p) => p.b));
  for (const p of press) nes.setButton(0, p.b, held.has(p.b));
  if (bot) botStep(f);
  nes.runFrame();
  const s = nes.apu.take(); samples += s.length; for (const v of s) peak = Math.max(peak, Math.abs(v));
  if (shots.includes(f)) {
    const fb = nes.ppu.frame;
    writePng(join(out, `run-${f}.png`), 256, 240, (x, y) => { const c = fb[y * 256 + x]; return ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff); }, 2);
    const ram = nes.ram;
    console.log(`frame ${f}: state=${ram[7]} score=${[...ram.slice(0x18, 0x1e)].join('')} lives=${ram[0x14]} time=${ram[0x16]} pc=${nes.cpu.pc.toString(16)}`);
  }
}
const ms = performance.now() - t0;
if (bot) console.log(`ボット: 舌 ${stat.shots} 回・ホタルを食べた ${stat.hurt} 回`);
console.log(`${last} フレームを ${ms.toFixed(0)}ms（1フレーム ${(ms / last).toFixed(2)}ms）。音 ${samples} サンプル（1フレーム ${(samples / last).toFixed(0)}）・最大 ${peak.toFixed(3)}`);
