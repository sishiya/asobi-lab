// 第5夜（岸が近づく）と、岸に着いたときの画面を撮る
// 使い方: node dusk-diorama/tools/ending-shot.mjs [幅x高さ]
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';

const [w, h] = (process.argv[2] || '1280x720').split('x').map(Number);
const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  const ctx = await safeContext(browser, server.origin, { width: w, height: h });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.goto(`${server.origin}/dusk-diorama/?auto=1&night=5&speed=12`); await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
  const bot = page.evaluate(async () => {
    const G = window.__game, dist = b => { const p = b.obj.getWorldPosition(new b.obj.position.constructor()); return Math.hypot(p.x - G.FIRE.x, p.z - G.FIRE.z); };
    while (G.st.phase === 'play') { await new Promise(r => setTimeout(r, 30)); const pend = G.st.burning.reduce((s, b) => s + b.left, 0); if (G.st.F + pend < 24) { const c = G.V.burnables.filter(b => !b.burned && !b.lost && !b.house).sort((a, b) => dist(a) - dist(b))[0]; if (c) G.burn(c); } }
  });
  await page.waitForFunction(() => window.__game.st.t > 125, null, { timeout: 300000 });
  await page.screenshot({ path: path.join(dir, `dusk-night5-${w}x${h}.png`) });
  await bot;
  await page.waitForFunction(() => !document.getElementById('result').hidden, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500); await page.screenshot({ path: path.join(dir, `dusk-ending-${w}x${h}.png`) });
  if (errors.length) console.log('エラー:', errors.join(' / '));
  console.log(dir);
} finally { await browser.close(); server.close(); }
