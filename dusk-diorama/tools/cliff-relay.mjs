// 灯台の崖の火種リレーをマウスで確かめる: ともった台に乗せる（カーソル・名札）→ つまんで次の台へ運ぶ → ともるか。案内の光がどこにあるか
// 使い方: node dusk-diorama/tools/cliff-relay.mjs [幅x高さ]
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';
const [w, h] = (process.argv[2] || '960x540').split('x').map(Number);
const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  const ctx = await safeContext(browser, server.origin, { width: w, height: h });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.goto(`${server.origin}/dusk-diorama/?cliff=1&speed=3`); await page.waitForFunction(() => window.__game && window.__game.st.cliff && window.__game.cliffStands[0].life > 0, null, { timeout: 200000 });
  const scr = k => page.evaluate(k => { const G = window.__game, v = G.cliffStands[k].fl.getWorldPosition(G.camera.position.clone()); v.project(G.camera); return [(v.x * .5 + .5) * innerWidth, (-v.y * .5 + .5) * innerHeight]; }, k);
  for (let k = 1; k <= 4; k++) {
    const a = await scr(k - 1), b = await scr(k); if (k === 1) console.log('台1の画面の位置', a.map(Math.round), '台2', b.map(Math.round), await page.evaluate(() => window.__game.cliffStands[0].life.toFixed(1)));
    await page.mouse.move(a[0] + 30, a[1] + 30); await page.mouse.move(...a); await page.waitForTimeout(150);
    const hov = await page.evaluate(() => [document.getElementById('c').style.cursor || '(ふつう)', document.getElementById('tag').hidden ? '(なし)' : document.getElementById('tag').textContent]);
    const glint = await page.evaluate(() => { const G = window.__game; return G.glintAt ? G.glintAt() : '?'; });
    await page.mouse.down(); for (let i = 1; i <= 8; i++) { await page.mouse.move(a[0] + (b[0] - a[0]) * i / 8, a[1] + (b[1] - a[1]) * i / 8); await page.waitForTimeout(30); }
    if (k === 2) await page.screenshot({ path: path.join(dir, `dusk-relay-carry-${w}x${h}.png`) });
    await page.mouse.up(); await page.waitForTimeout(200);
    console.log(`台${k}→台${k + 1}: 乗せると ${hov.join(' / ')} → 置くと`, await page.evaluate(k => window.__game.cliffStands[k].life > 0 ? 'ともった' : 'ともらない', k));
  }
  await page.screenshot({ path: path.join(dir, `dusk-relay-${w}x${h}.png`) });
  console.log(errors.length ? 'エラー: ' + errors.join(' / ') : 'エラーなし'); console.log(dir);
} finally { await browser.close(); server.close(); }
