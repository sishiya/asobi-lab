// 保管庫のサムネイル（thumbs/satoyama.jpg、640×360）: 声のみほんで羊毛のたまごを育てて、ほどけて開く瞬間を撮る
// node satoyama/tools/thumb.mjs（ゲームのフォルダから）。撮影は tools/playwright の決まり（まっさらなブラウザ・音なし・手元のサーバーだけ）
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, launch, safeContext } from '../../tools/playwright/lib.mjs';
const server = await serve(), browser = await launch(), ctx = await safeContext(browser, server.origin, { width: 960, height: 540 });
const page = await ctx.newPage();
await page.goto(`${server.origin}/satoyama/test/voice.html#birth`);
await page.waitForFunction(() => window.__voice, null, { timeout: 60000 });
await page.evaluate(() => { document.querySelectorAll('#bar, .tabs, #hud, #msg').forEach(e => (e.style.display = 'none')); });
for (const v of ['high', 'rough', 'low', 'child', 'breathy', 'quick', 'high']) await page.evaluate(v => { __voice.sample(v); __voice.advance(2.6, false); }, v);
await page.evaluate(() => { while (__voice.egg?.phase === 'gather') __voice.advance(0.2, false); while ((__voice.egg?.ht ?? 9) < 5.0) __voice.advance(0.05, false); __voice.advance(0.02); });
await page.waitForTimeout(300);
const out = path.join(ROOT, 'thumbs', 'satoyama.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 85, clip: { x: 0, y: 0, width: 960, height: 540 } });
// 640×360 にちぢめる（ブラウザで読み直して canvas で）
const small = await page.evaluate(async src => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement('canvas'); c.width = 640; c.height = 360; c.getContext('2d').drawImage(im, 0, 0, 640, 360); return c.toDataURL('image/jpeg', 0.85); }, 'data:image/jpeg;base64,' + fs.readFileSync(out).toString('base64'));
fs.writeFileSync(out, Buffer.from(small.split(',')[1], 'base64'));
console.log('thumbs/satoyama.jpg');
await browser.close(); server.close?.();
