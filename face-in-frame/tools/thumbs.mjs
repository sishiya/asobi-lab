// ヘルプの名画一覧に出す小さな絵（art/thumbs/<id>.jpg、たて 240px）を art/ から作る。絵を足したら走らせる。
// node face-in-frame/tools/thumbs.mjs（ffmpeg を使う。撮影情報や色の付加情報は入れない）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PAINTINGS } from '../js/paintings.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(dir, 'art', 'thumbs'), { recursive: true });
let total = 0;
for (const p of PAINTINGS) {
  const out = path.join(dir, 'art', 'thumbs', p.id + '.jpg');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(dir, p.src), '-vf', 'sidedata=mode=delete:type=ICC_PROFILE,scale=-2:240:flags=lanczos', '-map_metadata', '-1', '-q:v', '5', out]);
  total += fs.statSync(out).size;
}
console.log(PAINTINGS.length, '枚', Math.round(total / 1024), 'KB');
