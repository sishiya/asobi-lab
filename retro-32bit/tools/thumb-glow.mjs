// 保管庫のサムネイル: ムネエソの腹あかりを画面なしで動かし、はじめの見上げの 4 秒を撮る
//   → thumbs/retro-32bit.mp4（640×360・4 秒・15 こま／秒・音なし）と、最初のこまの thumbs/retro-32bit.jpg
//   node retro-32bit/tools/thumb-glow.mjs [--from=こま] [--crf=30]
//   場面: 捕食者が上がる → カメラが魚の下へ回りこむ → 黒い影 → A で腹をともして溶ける（終わりの場面は出さない）
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { Console32 } from '../js/psx.js';
import { BTN } from '../js/pad.js';
import { ROOT, buildSoft } from './lib.mjs';
import { writePng } from './png.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=')[1];
const from = +opt('from', 420), crf = opt('crf', '30');
const tmp = join(tmpdir(), 'asobi-glow-thumb');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

const { exe, syms } = await buildSoft('glow-belly');
const m = new Console32();
m.loadExe(exe);
const vb = (syms.vars & 0x1fffff) >> 2, V = (i) => m.ram32[vb + i];
let n = 0;
for (let f = 1; f < from + 240; f++) {
  let b = f === 30 ? 1 << BTN.START : 0;
  // 見上げてから 0.5 秒たって、腹の光を合わせはじめる（はじめは黒い影と見開く目が見える）
  const pst = V(5), L = V(3) >> 4, I = V(16);
  if (pst === 2 && V(6) < 120) { if (L < I - 4) b |= 1 << BTN.A; else if (L > I + 4) b |= 1 << BTN.B; }
  m.sio.buttons[0] = b;
  m.runFrame();
  if (f >= from && (f - from) % 4 === 0) {
    const buf = new Uint8ClampedArray(640 * 480 * 4), { w, h } = m.display(buf);
    // 320×240 を 2 倍にして、まん中の 640×360 を切り出す
    writePng(join(tmp, `f${String(n++).padStart(3, '0')}.png`), 640, 360, (x, y) => {
      const sx = x >> 1, sy = (y + 60) >> 1, o = (sy * w + sx) * 4;
      return (buf[o] << 16) | (buf[o + 1] << 8) | buf[o + 2];
    });
  }
}
const mp4 = join(ROOT, '..', 'thumbs', 'retro-32bit.mp4'), jpg = join(ROOT, '..', 'thumbs', 'retro-32bit.jpg');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '15', '-i', join(tmp, 'f%03d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', crf, '-preset', 'slow', '-an', '-movflags', '+faststart', mp4]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(tmp, 'f000.png'), '-q:v', '4', jpg]);
console.log(`${n} こま → ${mp4}（${(statSync(mp4).size / 1024).toFixed(0)}KB）・${jpg}（${(statSync(jpg).size / 1024).toFixed(0)}KB）`);
console.log(`こまの絵は ${tmp}`);
