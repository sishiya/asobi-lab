// かなの字の見本（_dev/retro-8bit/kana.png）。字の一覧と、ためしの文を、ゲームと同じ影つきで並べる
//   node retro-8bit/tools/kana-preview.mjs "ためしの ぶん" "もう ひとつ"
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KANA } from '../src/kana.mjs';
import { FONT } from '../src/font.mjs';
import { writePng } from './png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(ROOT, '..', '_dev', 'retro-8bit');
mkdirSync(out, { recursive: true });

// 1字 → 8×8（0 なし・1 字・3 影）。英数字は lib.mjs の font() と同じく右へ太らせる
function glyph(ch) {
  let rows;
  if (KANA[ch]) rows = KANA[ch].map((r) => r + '.');
  else if (FONT[ch]) rows = FONT[ch].map((r) => [...r + '...'].map((c, x, a) => (c === '1' || a[x - 1] === '1' ? '1' : '.')).join('').slice(0, 8));
  else if (ch === ' ') rows = Array(7).fill('........');
  else throw new Error('字がない: ' + ch);
  rows = [...rows, '........'];
  return rows.map((r, y) => [...r].map((c, x) => (c === '1' ? 1 : y > 0 && x > 0 && rows[y - 1][x - 1] === '1' ? 3 : 0)));
}
const lines = [];
const all = Object.keys(KANA);
for (let i = 0; i < all.length; i += 16) lines.push(all.slice(i, i + 16).join(''));
lines.push('');
lines.push(...process.argv.slice(2));
const W = 32, Hh = lines.length;
const cells = lines.map((l) => [...l].map(glyph));
writePng(join(out, 'kana.png'), W * 8, Hh * 10, (x, y) => {
  const row = Math.floor(y / 10), yy = y % 10 - 1, col = Math.floor(x / 8);
  const g = cells[row]?.[col];
  if (!g || yy < 0 || yy > 7) return 0x341a00;
  const v = g[yy][x % 8];
  return v === 1 ? 0xffffff : v === 3 ? 0x000000 : 0x5a2a00;
}, 3);
console.log('_dev/retro-8bit/kana.png');
