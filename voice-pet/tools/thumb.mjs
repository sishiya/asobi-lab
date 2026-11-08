// 保管庫のサムネイル（thumbs/voice-pet.jpg、640×360）: タイトル画面（ロゴと羊毛のたまご）を撮る。押せない絵なので、ボタンは消す
// node voice-pet/tools/thumb.mjs（ゲームのフォルダから）。撮影は tools/playwright の決まり（まっさらなブラウザ・音なし・手元のサーバーだけ）
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, launch, safeContext } from '../../tools/playwright/lib.mjs';
const server = await serve(), browser = await launch(), ctx = await safeContext(browser, server.origin, { width: 960, height: 540 });
const page = await ctx.newPage();
await page.goto(`${server.origin}/voice-pet/test/voice.html`);
await page.waitForFunction(() => window.__voice && document.body.classList.contains('title'), null, { timeout: 60000 });
await page.evaluate(() => { document.querySelectorAll('#menu, #startBtn').forEach(e => (e.style.display = 'none')); });
await page.waitForTimeout(2500);
const out = path.join(ROOT, 'thumbs', 'voice-pet.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 85, clip: { x: 0, y: 0, width: 960, height: 540 } });
// 640×360 にちぢめる（ブラウザで読み直して canvas で）
const small = await page.evaluate(async src => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement('canvas'); c.width = 640; c.height = 360; c.getContext('2d').drawImage(im, 0, 0, 640, 360); return c.toDataURL('image/jpeg', 0.85); }, 'data:image/jpeg;base64,' + fs.readFileSync(out).toString('base64'));
fs.writeFileSync(out, Buffer.from(small.split(',')[1], 'base64'));
console.log('thumbs/voice-pet.jpg');
await browser.close(); server.close?.();
