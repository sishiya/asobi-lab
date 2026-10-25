// 入口のカードの動くサムネイル thumbs/face-in-frame.mp4（640×360・4秒・音なし）と、最初のコマの静止画 thumbs/face-in-frame.jpg。
// カメラのかわりに絵の顔（?test=lizard）を「がんばって穴に合わせる」動き（&path=align。main.js の ALIGN）で動かし、
// 寄せる補正なしでモナ・リザに合わせて、シャッターまでを本物の速さで録る（Playwright の録画）。
// 絵を大きく映すため縦長の窓で録り、穴のまわりを 16:9 に切りぬく。終わりはシャッターの少しあと。
// node face-in-frame/tools/motion-thumb.mjs [シャッターのあとに残す秒（ふつう 0.5）]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve, launch, ROOT } from '../../tools/playwright/lib.mjs';

const tail = Number(process.argv[2] || 0.5), SEC = 4, W = 900, H = 1200;
const tmp = path.join(ROOT, '_dev', 'face-in-frame', 'motion');
fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const srv = await serve(), browser = await launch();
// 録画つきの窓。外へ出るのはフォントだけ（lib.mjs の safeContext と同じ決まり）
const rec = await browser.newContext({ viewport: { width: W, height: H }, locale: 'ja-JP', recordVideo: { dir: tmp, size: { width: W, height: H } } });
await rec.route('**/*', r => { const u = new URL(r.request().url()); return u.origin === srv.origin || /^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname) ? r.continue() : r.abort(); });
const t0 = Date.now();
const page = await rec.newPage();
await page.addInitScript(() => localStorage.setItem('face-in-frame', JSON.stringify({ sound: 0, secs: 5, shots: 1, assist: 0, blend: 2 })));
await page.goto(`${srv.origin}/face-in-frame/?test=lizard&path=align&pick=monalisa`);
await page.waitForTimeout(600);
await page.click('#start');
await page.waitForFunction(() => window.__begins && window.__begins.length, null, { timeout: 90000 });
await page.waitForTimeout(300);
// 切りぬく所: 絵のはばいっぱい、穴のまん中を少し下に
const crop = await page.evaluate(() => {
  const r = document.querySelector('#stage').getBoundingClientRect(), h = window.__hole;
  const w = r.width, hh = w * 9 / 16, cy = r.top + r.height * h.y;
  return { x: r.left, y: Math.max(r.top, Math.min(r.bottom - hh, cy - hh * 0.55)), w, h: hh };
});
await page.waitForFunction(() => window.__shots && window.__shots.length, null, { timeout: 60000 });
const shot = await page.evaluate(() => window.__shots[0]);
await page.waitForTimeout(1500);
const video = page.video();
await page.close(); await rec.close(); await browser.close(); srv.close();
const webm = await video.path();
// 録画の時計はページの時計より少しおくれる（1〜2秒）ので、シャッターの白い光を録画の中でさがして、そこから切る
const stats = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', webm, '-vf', 'fps=20,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-']).toString();
const ys = [...stats.matchAll(/pts_time:([\d.]+)[\s\S]*?YAVG=([\d.]+)/g)].map(m => [+m[1], +m[2]]);
const guess = (shot - t0) / 1000, base = ys.filter(([t]) => t > 2 && t < guess - 0.5).map(([, y]) => y);
const avg = base.reduce((a, b) => a + b, 0) / Math.max(1, base.length);
const flash = (ys.find(([t, y]) => t > guess - 0.5 && y > avg + 40) || [guess])[0];
const end = flash + tail, ss = end - SEC;
const mp4 = path.join(ROOT, 'thumbs', 'face-in-frame.mp4'), jpg = path.join(ROOT, 'thumbs', 'face-in-frame.jpg');
const even = v => Math.round(v / 2) * 2;
const vf = `crop=${even(crop.w)}:${even(crop.h)}:${even(crop.x)}:${even(crop.y)},scale=640:360:flags=lanczos,fps=15`;
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', ss.toFixed(2), '-i', webm, '-t', String(SEC), '-an', '-vf', vf,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mp4, '-frames:v', '1', '-q:v', '3', jpg]);
// 確かめ用: 8コマを並べた絵
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mp4, '-vf', 'fps=2,scale=320:-2,tile=4x2', '-frames:v', '1', path.join(tmp, 'sheet.png')]);
console.log(JSON.stringify({ ss: +ss.toFixed(2), flash, guess: +guess.toFixed(2), crop, kb: Math.round(fs.statSync(mp4).size / 1024), sheet: path.join(tmp, 'sheet.png') }));
