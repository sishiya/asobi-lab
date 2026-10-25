// なじみ方の確かめ: 部屋の明るさ・照明の色・肌の色・暗いときのざらつきを変えた試験の顔で遊び、穴のまわりを並べた絵にする。
// GPU を使う（筆のタッチを入れるため）。node face-in-frame/tools/light-test.mjs [絵をコンマで] [設定の JSON]
// できた絵は _dev/face-in-frame/light/sheet.png（行＝条件、列＝絵）
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '../../tools/playwright/node_modules/playwright/index.mjs';
import { serve, ROOT } from '../../tools/playwright/lib.mjs';
import { execFileSync } from 'node:child_process';

const pick = process.argv[2] || 'gogh,monalisa,pearl,sharaku';
const cfg = { sound: 0, secs: 5, assist: 3, blend: 2, touch: 2, ...JSON.parse(process.argv[3] || '{}') };
export const LIGHTS = [
  ['ふつう', '1:0:0:0'], ['暗い電球色の部屋', '0.45:0.2:0:0.15'], ['明るい窓', '1.45:-0.08:0:0'],
  ['電球色', '0.9:0.45:0:0.04'], ['濃い肌', '1:0:0.55:0'], ['濃い肌・暗い部屋', '0.55:0.1:0.55:0.12']];
const dir = path.join(ROOT, '_dev', 'face-in-frame', 'light');
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const srv = await serve(), browser = await chromium.launch({ args: ['--mute-audio', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const rows = [];
for (const [name, light] of LIGHTS) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } }), page = await ctx.newPage();
  await page.addInitScript(c => localStorage.setItem('face-in-frame', JSON.stringify(c)), cfg);
  await page.goto(`${srv.origin}/face-in-frame/?test=lizard&path=align&light=${light}&pick=${pick}`);
  await page.click('#start');
  await page.waitForSelector('#result.on', { timeout: 180000 });
  const crops = await page.evaluate(() => window.__crops);
  const files = crops.map((d, i) => { const f = path.join(dir, `${rows.length}-${i}.jpg`); fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); return f; });
  rows.push(files); console.log(name, 'ok');
  await ctx.close();
}
await browser.close(); srv.close();
const n = rows[0].length, inputs = rows.flat().flatMap(f => ['-i', f]);
const layout = rows.flatMap((r, y) => r.map((_, x) => `${x * 300}_${y * 300}`)).join('|');
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', `xstack=inputs=${rows.length * n}:layout=${layout}`, path.join(dir, 'sheet.png')]);
console.log(path.join(dir, 'sheet.png'), LIGHTS.map(l => l[0]).join(' / '));
