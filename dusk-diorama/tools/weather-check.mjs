// 雨と風の夜の灯を確かめる: はじめから灯っている2つの灯の減り方（ぬれた/ぬれない・吹かれた/戸板の陰）と、絵
// 使い方: node dusk-diorama/tools/weather-check.mjs
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';

const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  for (const n of [2, 3]) {
    const ctx = await safeContext(browser, server.origin, { width: 960, height: 540 });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e))); page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
    await page.goto(`${server.origin}/dusk-diorama/?auto=1&night=${n}`); await page.waitForFunction(() => window.__game && window.__game.st.t > 6, null, { timeout: 30000 }).catch(async () => console.log('止まった', errors, await page.evaluate(() => window.__game && window.__game.st.t)));
    const r = await page.evaluate(() => window.__game.L.stands.filter(s => s.life > 0).map(s => ({ kind: s.kind, life: +s.life.toFixed(1), wet: s.wet, lean: +s.lean.toFixed(2), board: !!s.board, rMul: +s.rMul.toFixed(2) })));
    console.log(`第${n}夜（6秒）:`, JSON.stringify(r));
    await page.screenshot({ path: path.join(dir, `dusk-weather-n${n}.png`) });
    console.log(errors.length ? 'エラー: ' + errors.join(' / ') : 'エラーなし');
    await ctx.close();
  }
  console.log(dir);
} finally { await browser.close(); server.close(); }
