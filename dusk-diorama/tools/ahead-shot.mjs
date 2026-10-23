// 行く先の見え方を撮る: 第1・4・5夜の灯台、夜の切れ目に見える次の空（第1〜4夜の終わり）、上の5つの玉
// 使い方: node dusk-diorama/tools/ahead-shot.mjs
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';
const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  for (const [n, brk] of [[1, false], [4, false], [5, true], [1, true], [2, true], [3, true], [4, true]]) {
    const ctx = await safeContext(browser, server.origin, { width: 960, height: 540 });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
    await page.goto(`${server.origin}/dusk-diorama/?auto=1&night=${n}`); await page.waitForFunction(() => window.__game && window.__game.st.t > 1, null, { timeout: 60000 });
    if (brk) { await page.evaluate(() => { const G = window.__game; G.st.t = G.RULE.night - 0.2; G.st.F = 30; }); await page.waitForFunction(() => window.__game.st.dawnK > 0.3, null, { timeout: 60000 }); }
    const orbs = await page.evaluate(() => [...document.querySelectorAll('#orbs i')].map(e => e.className || '-').join(' '));
    await page.screenshot({ path: path.join(dir, `dusk-ahead-n${n}${brk ? '-break' : ''}.png`) });
    console.log(`第${n}夜${brk ? 'の終わり' : ''}: 玉 ${orbs}`, errors.length ? 'エラー: ' + errors.join(' / ') : '');
    await ctx.close();
  }
  console.log(dir);
} finally { await browser.close(); server.close(); }
