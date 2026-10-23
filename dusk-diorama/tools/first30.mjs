// 第1夜の最初の30秒（PLAN.md 2.9章）を撮る: 火トカゲの手本 → 柵をくべる → 炎から火種 → 台に灯
// 使い方: node dusk-diorama/tools/first30.mjs [幅x高さ]
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';

const [w, h] = (process.argv[2] || '960x540').split('x').map(Number);
const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  const ctx = await safeContext(browser, server.origin, { width: w, height: h });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.goto(`${server.origin}/dusk-diorama/?auto=1&speed=2`); await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
  const shot = async n => { await page.screenshot({ path: path.join(dir, `dusk-f30-${n}-${w}x${h}.png`) }); };
  await page.waitForFunction(() => window.__game.st.t > 2.5, null, { timeout: 60000 }); await shot('1-demo');
  await page.waitForFunction(() => window.__game.st.demoDone, null, { timeout: 60000 }); await shot('2-fence');
  const log = await page.evaluate(() => { const G = window.__game, f = G.V.burnables.filter(b => b.name === '柵' && !b.burned).sort((a, b) => Math.hypot(a.obj.position.x - G.FIRE.x, a.obj.position.z - G.FIRE.z) - Math.hypot(b.obj.position.x - G.FIRE.x, b.obj.position.z - G.FIRE.z))[0]; const F0 = G.st.F; G.burn(f); return { F0 }; });
  await page.waitForTimeout(1500); await shot('3-flame');
  const lit = await page.evaluate(() => { const G = window.__game; const s = G.L.stands.find(s => s.kind === 'brazier' && G.L.canLight(s, { x: G.FIRE.x, z: G.FIRE.z, r: 0.9 + 5.5 * Math.sqrt(Math.max(0, G.st.F - 4) / 40) })); const F0 = G.st.F, ok = s ? G.emberTo(s) : false; return { stand: s && s.id, ok, F0, F1: G.st.F }; });
  await page.waitForTimeout(1500); await shot('4-lamp');
  console.log('柵の前の燃料', log.F0.toFixed(1), '/ 火種:', JSON.stringify(lit));
  if (errors.length) console.log('エラー:', errors.join(' / '));
  console.log(dir);
} finally { await browser.close(); server.close(); }
