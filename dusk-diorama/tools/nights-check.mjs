// 何夜かつづけて自動で遊び、かけらがどれだけ戻るか・島の広さがどう変わるかを見る（PLAN.md 2.7章）
// 使い方: node dusk-diorama/tools/nights-check.mjs [夜の数=3] [燃料の目安=14]
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';

const nights = +process.argv[2] || 3, target = +process.argv[3] || 14;
const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  const ctx = await safeContext(browser, server.origin, { width: 640, height: 480 });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.goto(`${server.origin}/dusk-diorama/?auto=1&speed=10`); await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
  for (let n = 1; n <= nights; n++) {
    const run = page.evaluate(async ({ target }) => {
      const G = window.__game, dist = b => { const p = b.obj.getWorldPosition(new b.obj.position.constructor()); return Math.hypot(p.x - G.FIRE.x, p.z - G.FIRE.z); };
      const area = () => Math.round(100 * G.isl.chunks.filter(c => !c.fallen).reduce((s, c) => s + c.quads.length, 0) / G.isl.chunks.reduce((s, c) => s + c.quads.length, 0));
      const a0 = area(); let docked = 0, surfaced = 0, shot = false; const was = new Set(G.isl.chunks.filter(c => c.fallen).map(c => c.id));
      while (G.st.phase === 'play') {
        await new Promise(r => setTimeout(r, 30));
        const pend = G.st.burning.reduce((s, b) => s + b.left, 0);
        if (G.st.F + pend < target) { const c = G.V.burnables.filter(b => !b.burned && !b.lost && !b.house).sort((a, b) => dist(a) - dist(b))[0]; if (c) G.burn(c); }
        surfaced = Math.max(surfaced, G.isl.chunks.filter(c => c.drift).length);
        if (!shot && G.isl.chunks.some(c => c.drift && c.drift.mode === 'up' && c.drift.age > 4)) { shot = true; window.__shotNow = true; }
      }
      docked = G.isl.chunks.filter(c => was.has(c.id) && !c.fallen).length;
      return { night: G.st.night, phase: G.st.phase, t: Math.round(G.st.t), a0, a1: area(), docked, F: +G.st.F.toFixed(1), fuelLeft: G.V.burnables.filter(b => !b.burned && !b.lost && !b.house).reduce((s, b) => s + b.fuel, 0) };
    }, { target });
    if (n === 2) { // かけらが浮かんでいるところを、遊びを止めずに撮る
      const ok = await page.waitForFunction(() => window.__game.isl.chunks.some(c => c.drift && c.drift.mode === 'up' && c.drift.age > 4), null, { timeout: 200000 }).then(() => true).catch(() => false);
      if (ok) { const keep = await page.evaluate(() => { const G = window.__game, c = G.isl.chunks.find(c => c.drift), v = { ...G.view, target: G.view.target.clone() }; G.view.target.set(c.cx * 0.6, -0.5, c.cz * 0.6); G.view.zoom = 0.6; G.view.az = Math.atan2(c.cx, c.cz); return [v.az, v.zoom]; });
        await page.waitForTimeout(400); await page.screenshot({ path: path.join(dir, 'dusk-drift.png') });
        await page.evaluate(k => { const G = window.__game; G.view.target.set(0, -0.6, 0); G.view.az = k[0]; G.view.zoom = k[1]; }, keep); }
    }
    const out = await run;
    console.log(`第${out.night}夜: ${out.phase === 'dawn' ? '夜明け' : '呑まれた'}(${out.t}s) 島 ${out.a0}%→${out.a1}% もどったかけら ${out.docked} 残りの燃やせる物（家以外）${out.fuelLeft}`);
    await page.waitForTimeout(800);
    if (n < nights) await page.evaluate(n => window.__game.startNight(n + 1), n);
  }
  await page.evaluate(() => { const G = window.__game; G.view.target.set(G.FIRE.x, 0.2, G.FIRE.z); G.view.zoom = 0.18; G.view.el = 0.5; });
  await page.waitForTimeout(800); await page.screenshot({ path: path.join(dir, 'dusk-salamander.png') });
  if (errors.length) console.log('エラー:', errors.join(' / '));
  console.log(dir);
} finally { await browser.close(); server.close(); }
