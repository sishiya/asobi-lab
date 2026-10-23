// 夜明けの岸を撮る: 第5夜のなかば（闇の底からせり上がる岸）・終わり（夜明けに桟橋が島のふちへ寄る）・寄って岸の細部
// 使い方: node dusk-diorama/tools/shore-shot.mjs [幅x高さ]
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';
const [w, h] = (process.argv[2] || '960x540').split('x').map(Number);
const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  const ctx = await safeContext(browser, server.origin, { width: w, height: h });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${server.origin}/dusk-diorama/?auto=1&night=5`); await page.waitForFunction(() => window.__game && window.__game.st.t > 0.5, null, { timeout: 60000 });
  const shot = n => page.screenshot({ path: path.join(dir, `dusk-shore-${n}-${w}x${h}.png`) });
  await page.evaluate(() => { const G = window.__game; G.st.t = G.RULE.night * 0.6; G.st.F = 35; }); await page.waitForTimeout(2500); await shot('1-night');
  await page.evaluate(() => { const G = window.__game; G.st.t = G.RULE.night - 0.2; G.st.F = 35; });
  await page.waitForFunction(() => window.__game.st.arrive >= 1, null, { timeout: 300000 }).catch(async () => console.log('着かない', errors, await page.evaluate(() => JSON.stringify({ p: window.__game.st.phase, a: window.__game.st.arrive, n: window.__game.st.night, dk: window.__game.st.dawnK })))); await page.waitForTimeout(2000);
  await page.evaluate(() => { document.getElementById('result').hidden = true; }); await shot('2-arrive');
  await page.evaluate(() => { const G = window.__game; G.view.zoom = 0.6; G.view.az = 0.85; G.view.el = 0.3; G.view.target.set(-Math.sin(0.85) * 11, 0.5, -Math.cos(0.85) * 11); }); await page.waitForTimeout(2500); await shot('3-close');
  for (const [i, az, el] of [[4, 0.85 + 1.3, 0.25], [5, 0.85 - 1.3, 0.3], [6, 0.85, 0.7], [7, 0.85 + 2.6, 0.4]]) { await page.evaluate(([az, el]) => { const G = window.__game; G.view.zoom = 1.5; G.view.az = az; G.view.el = el; G.view.target.set(-Math.sin(0.85) * 8, 0, -Math.cos(0.85) * 8); }, [az, el]); await page.waitForTimeout(2500); await shot(i + '-angle'); }
  console.log(errors.length ? 'エラー: ' + errors.join(' / ') : 'エラーなし'); console.log(dir);
} finally { await browser.close(); server.close(); }
