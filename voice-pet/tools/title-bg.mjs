// タイトルの読みこみ中に出す絵（img/title-bg-wide・square・tall.jpg）を、今の巣で撮り直す。node voice-pet/tools/title-bg.mjs（ゲームのフォルダから）
import path from 'node:path';
import { ROOT, serve, launch, safeContext } from '../../tools/playwright/lib.mjs';
const server = await serve(), browser = await launch();
for (const [name, width, height] of [['wide', 1280, 720], ['square', 900, 900], ['tall', 540, 1170]]) {
  const ctx = await safeContext(browser, server.origin, { width, height }), page = await ctx.newPage();
  await page.goto(`${server.origin}/voice-pet/`, { timeout: 120000 });
  await page.waitForFunction(() => window.__voice && document.body.classList.contains('title'), null, { timeout: 110000 });
  await page.evaluate(() => { document.querySelectorAll('#menu, #title, #gate').forEach(e => (e.style.display = 'none')); });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(ROOT, 'voice-pet', 'img', `title-bg-${name}.jpg`), type: 'jpeg', quality: 78 });
  await ctx.close(); console.log(name);
}
await browser.close(); server.close?.(); process.exit(0);
