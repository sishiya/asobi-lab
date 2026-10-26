// 保管庫のサムネイル: ほって つんで 3D を画面なしで動かし、島を歩いて見回す 4 秒を撮る
//   → thumbs/retro-32bit.mp4（640×360・4 秒・15 こま／秒・音なし）と、最初のこまの thumbs/retro-32bit.jpg
//   node retro-32bit/tools/thumb-dig.mjs [--from=こま] [--crf=30] [--peek=こま,...]（--peek: サムネイルは作らず、そのこまを _dev/retro-32bit/thumb-dig-<こま>.png に）
//   ソースは組まず、公開している discs/dig32.exe をそのまま動かす
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { Console32 } from '../js/psx.js';
import { BTN } from '../js/pad.js';
import { ROOT } from './lib.mjs';
import { writePng } from './png.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=')[1];
const from = +opt('from', 460), crf = opt('crf', '30');
const peek = opt('peek', '').split(',').filter(Boolean).map(Number);
const tmp = join(tmpdir(), 'asobi-dig-thumb'), dev = join(ROOT, '..', '_dev', 'retro-32bit');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(dev, { recursive: true });

const m = new Console32();
m.loadExe(readFileSync(join(ROOT, 'discs', 'dig32.exe')));
// [はじめのこま, おわりのこま, ボタン]: はじめの画面を START でぬけ、その場でゆっくり右へ見回す
const SCRIPT = [[30, 32, 'START'], [60, 62, 'START'], [100, 900, 'RIGHT']];
const grab = (path) => {
  const buf = new Uint8ClampedArray(640 * 480 * 4), { w } = m.display(buf);
  // 320×240 を 2 倍にして、まん中の 640×360 を切り出す
  writePng(path, 640, 360, (x, y) => {
    const sx = x >> 1, sy = (y + 60) >> 1, o = (sy * w + sx) * 4;
    return (buf[o] << 16) | (buf[o + 1] << 8) | buf[o + 2];
  });
};
const last = peek.length ? Math.max(...peek) : from + 240;
let n = 0;
for (let f = 1; f < last + 1; f++) {
  let b = 0;
  for (const [a, z, k] of SCRIPT) if (f >= a && f < z && (k !== 'RIGHT' || f % 6 === 0)) b |= 1 << BTN[k];
  m.sio.buttons[0] = b;
  m.runFrame();
  if (peek.includes(f)) grab(join(dev, `thumb-dig-${f}.png`));
  else if (!peek.length && f >= from && (f - from) % 4 === 0) grab(join(tmp, `f${String(n++).padStart(3, '0')}.png`));
}
if (peek.length) { console.log(`→ ${dev}`); process.exit(0); }
const mp4 = join(ROOT, '..', 'thumbs', 'retro-32bit.mp4'), jpg = join(ROOT, '..', 'thumbs', 'retro-32bit.jpg');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '15', '-i', join(tmp, 'f%03d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', crf, '-preset', 'slow', '-an', '-movflags', '+faststart', mp4]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(tmp, 'f000.png'), '-q:v', '4', jpg]);
console.log(`${n} こま → ${mp4}（${(statSync(mp4).size / 1024).toFixed(0)}KB）・${jpg}（${(statSync(jpg).size / 1024).toFixed(0)}KB）`);
