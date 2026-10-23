// 風の夜の戸板を寄って撮る（戸板つきの灯と、吹かれた灯）
// 使い方: node dusk-diorama/tools/board-shot.mjs
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';
const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  const ctx = await safeContext(browser, server.origin, { width: 960, height: 540 });
  const page = await ctx.newPage(); page.on('pageerror', e => console.log('err', e.message));
  await page.goto(`${server.origin}/dusk-diorama/?auto=1&night=3`); await page.waitForFunction(() => window.__game && window.__game.st.t > 1.5, null, { timeout: 60000 });
  for (const [i, k] of [[0, 'board'], [1, 'blown']]) {
    await page.evaluate(i => { const G = window.__game, s = G.L.stands.filter(s => s.life > 0)[i]; G.view.target.set(s.x, 0.3, s.z); G.view.zoom = 0.3; }, i);
    await page.waitForTimeout(2500); await page.screenshot({ path: path.join(dir, `dusk-${k}.png`) });
  }
  console.log(dir);
} finally { await browser.close(); server.close(); }
