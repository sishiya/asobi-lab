// ページを1こまずつ進めて録画する（公開しない開発用。RULES 9章）
// 使い方: node tools/playwright/record.mjs <ページ> [--query=dist=10] [--fps=30] [--size=1280x720] [--name=motion] [--sheet=0.5,2.5,...]
//   ページは window.__capture = { duration（秒）, step(dt) } と window.__ready を用意する（例 _dev/blender/motion.html。?capture をつけて開く）
//   --sheet: その秒のこまを並べた1枚（こま割り）も作る。動画を見られないときや、タイミングを目で確かめるとき
// 結果は _dev/motion/<日時>/<name>.mp4（と <name>-sheet.png）。Git に入れない。ffmpeg を使う
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, serve, launch, safeContext, outDir as makeOut } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const pagePath = args.find(a => !a.startsWith('--'));
const fps = Number(opt('fps', 30));
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const name = opt('name', 'motion');
const query = opt('query', '');
const sheetTimes = opt('sheet', '').split(',').filter(Boolean).map(Number);

const server = await serve();
const out = makeOut('motion');
const frames = path.join(out, `${name}-frames`);
fs.mkdirSync(frames, { recursive: true });
const browser = await launch();
const errors = [];
try {
  const ctx = await safeContext(browser, server.origin, { width: W, height: H });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${server.origin}/${pagePath}?capture${query ? '&' + query : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
  const duration = await page.evaluate(() => window.__capture.duration);
  const n = Math.round(duration * fps);
  for (let i = 0; i < n; i++) {
    if (i) await page.evaluate(dt => window.__capture.step(dt), 1 / fps);
    await page.screenshot({ path: path.join(frames, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
  }
  await ctx.close();
  const mp4 = path.join(out, `${name}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(frames, '%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', '-map_metadata', '-1', mp4]);
  if (sheetTimes.length) {
    // こま割り: 指定の秒のこまを、4列で並べる（左上に秒）
    const pick = sheetTimes.map(t => Math.min(n - 1, Math.round(t * fps)));
    const list = path.join(out, `${name}-sheet.txt`);
    const tmp = path.join(out, `${name}-sheet-src`); fs.mkdirSync(tmp, { recursive: true });
    pick.forEach((f, i) => fs.copyFileSync(path.join(frames, `${String(f).padStart(5, '0')}.jpg`), path.join(tmp, `${String(i).padStart(3, '0')}.jpg`)));
    const cols = 4, rows = Math.ceil(pick.length / cols);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(tmp, '%03d.jpg'),
      '-vf', `scale=${Math.round(W / 2)}:-1,tile=${cols}x${rows}:padding=6:color=0x0f302b`, '-frames:v', '1', path.join(out, `${name}-sheet.png`)]);
    fs.rmSync(tmp, { recursive: true }); void list;
  }
  fs.rmSync(frames, { recursive: true });
  console.log(`${n} こま ${duration} 秒`);
} finally {
  await browser.close();
  server.close();
}
if (errors.length) console.log('エラー:\n' + errors.join('\n'));
console.log(path.relative(ROOT, out));
