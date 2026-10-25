// 確かめ: カメラのかわりに絵の顔（?test=<id>）で1回遊び、場面ごとに撮る。
// node face-in-frame/tools/playtest.mjs [test の絵の id] [幅] [高さ] [出す絵の id をコンマで]
// 撮った絵は _dev/face-in-frame/<日時>/ へ（Git に入れない）
import path from 'node:path';
import { chromium } from '../../tools/playwright/node_modules/playwright/index.mjs';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';

const [id = 'pearl', w = '1280', h = '720'] = process.argv.slice(2);
// GPU=1 で GPU を使う（筆のタッチは GPU がないと切れる。ふつうの headless は WebGL がソフトウェア）
const srv = await serve(), browser = process.env.GPU ? await chromium.launch({ args: ['--mute-audio', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] }) : await launch();
const ctx = await safeContext(browser, srv.origin, { width: +w, height: +h });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => localStorage.setItem('face-in-frame', JSON.stringify({ sound: 0, secs: 5, shots: 3 })));
await page.goto(`${srv.origin}/face-in-frame/?${process.env.LANG_Q ? 'lang=' + process.env.LANG_Q + '&' : ''}test=${id}${process.argv[5] ? '&pick=' + process.argv[5] : ''}`);
const dir = outDir('face-in-frame');
const shot = name => page.screenshot({ path: path.join(dir, `${w}x${h}-${name}.png`) });
await page.waitForTimeout(800); await shot('0-title');
await page.click('#start');
await page.waitForFunction(() => document.querySelector('#wait').hidden, null, { timeout: 60000 });
await page.waitForTimeout(1000); await shot('1-intro');
await page.waitForTimeout(3500); await shot('2-pose');
await page.waitForSelector('#result.on', { timeout: 60000 });
await page.waitForTimeout(600); await shot('3-result');
console.log(JSON.stringify({ dir, total: await page.textContent('#total'), parts: await page.$$eval('.shot .parts', e => e.map(x => x.textContent)), errors, blocked: ctx.blocked }, null, 1));
await browser.close(); srv.close();
