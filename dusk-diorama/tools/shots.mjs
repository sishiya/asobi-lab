// 遊んでいる途中と夜明けの画面を、RULES 4章の幅で撮る（がらくた＋木のやり方で自動で遊ぶ）
// 使い方: node dusk-diorama/tools/shots.mjs   → _dev/shots/<日時>/dusk-*.png
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';

const arg = (process.argv.find(a => a.startsWith('--sizes=')) || '').slice(8);
const SIZES = arg ? arg.split(',').map(s => s.split('x').map(Number)) : [[1280, 720], [375, 740], [812, 375], [1024, 768]];
const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  for (const [w, h] of SIZES) {
    const ctx = await safeContext(browser, server.origin, { width: w, height: h });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
    await page.goto(`${server.origin}/dusk-diorama/`); await page.waitForFunction(() => window.__game, null, { timeout: 60000 }); await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(dir, `dusk-title-${w}x${h}.png`) });
    await page.goto(`${server.origin}/dusk-diorama/?auto=1&speed=8`); await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
    const run = until => page.evaluate(async until => {
      const G = window.__game, dist = b => { const p = b.obj.getWorldPosition(new b.obj.position.constructor()); return Math.hypot(p.x - G.FIRE.x, p.z - G.FIRE.z); };
      while (G.st.phase === 'play' && G.st.t < until) { await new Promise(r => setTimeout(r, 30)); const pend = G.st.burning.reduce((s, b) => s + b.left, 0); if (G.st.F + pend < 24) { const c = G.V.burnables.filter(b => !b.burned && !b.lost && !b.house).sort((a, b) => dist(a) - dist(b))[0]; if (c) G.burn(c); } }
    }, until);
    await run(60); await page.screenshot({ path: path.join(dir, `dusk-mid-${w}x${h}.png`) });
    await run(999); await page.waitForTimeout(5000); await page.screenshot({ path: path.join(dir, `dusk-dawn-${w}x${h}.png`) });
    console.log(`${w}x${h} ${errors.length ? 'エラー: ' + errors.join(' / ') : 'ok'}`);
    await ctx.close();
  }
  console.log(dir);
} finally { await browser.close(); server.close(); }
