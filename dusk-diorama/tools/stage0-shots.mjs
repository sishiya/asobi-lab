// 段階0の画面を撮る（タイトルのつづきから・火種の手本の影・呑まれた札）。使い方: node dusk-diorama/tools/stage0-shots.mjs [幅x高さ] [出す所]
import path from 'node:path';
import { chromium } from '../../tools/playwright/node_modules/playwright/index.mjs';
import { serve, safeContext, outDir } from '../../tools/playwright/lib.mjs';
const [w, h] = (process.argv[2] || '390x844').split('x').map(Number), dir = process.argv[3] || outDir('shots');
const server = await serve(), browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const ctx = await safeContext(browser, server.origin, { width: w, height: h }), page = await ctx.newPage();
  const ready = () => page.waitForFunction(() => window.__game && window.__game.st, null, { timeout: 60000 });
  await page.goto(`${server.origin}/dusk-diorama/?auto=1`); await ready(); await page.waitForTimeout(500);
  await page.evaluate(() => localStorage.setItem('dusk-diorama-save', JSON.stringify({ night: 3, F: 14, fallen: [], gone: [], drift: 0 })));
  await page.goto(`${server.origin}/dusk-diorama/`); await ready(); await page.waitForTimeout(2500); await page.screenshot({ path: path.join(dir, `title-${w}x${h}.png`) });
  await page.goto(`${server.origin}/dusk-diorama/?auto=1&night=1`); await ready();
  await page.waitForFunction(() => window.__game.st.demoDone, null, { timeout: 60000 });
  await page.evaluate(() => { const g = window.__game, b = g.V.burnables.find(b => !b.house && b.kind === 'dry'); g.burn(b); });
  await page.waitForTimeout(1600); await page.screenshot({ path: path.join(dir, `ghost-${w}x${h}.png`) });
  await page.evaluate(() => { const g = window.__game; g.st.F = 0; g.st.burning = []; });
  await page.waitForFunction(() => !document.getElementById('result').hidden, null, { timeout: 120000 }); await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(dir, `lost-${w}x${h}.png`) });
  console.log(dir);
} finally { await browser.close(); server.close(); }
