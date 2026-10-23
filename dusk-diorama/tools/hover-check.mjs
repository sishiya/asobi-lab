// マウスを炎に乗せたとき、つまめると分かるか（カーソルと名札）を確かめる
// 使い方: node dusk-diorama/tools/hover-check.mjs
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';

const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  const ctx = await safeContext(browser, server.origin, { width: 960, height: 540 });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.goto(`${server.origin}/dusk-diorama/?auto=1&night=2`); await page.waitForFunction(() => window.__game && window.__game.st.t > 1, null, { timeout: 60000 });
  const fire = await page.evaluate(async () => { const G = window.__game, T = await import('three'), p = new T.Vector3(G.FIRE.x, 0, G.FIRE.z); p.y = G.camera.position.y * 0 + (await import('./js/util.js')).H(G.FIRE.x, G.FIRE.z) + 0.35; p.project(G.camera); return [(p.x * .5 + .5) * innerWidth, (-p.y * .5 + .5) * innerHeight]; });
  await page.mouse.move(fire[0] + 120, fire[1] + 80); await page.mouse.move(fire[0] + 2, fire[1] + 2); await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({ cursor: document.getElementById('c').style.cursor, tag: document.getElementById('tag').hidden ? '(なし)' : document.getElementById('tag').textContent }));
  console.log('炎の上: カーソル', r.cursor || '(ふつう)', '/ 名札', r.tag);
  await page.screenshot({ path: path.join(dir, 'dusk-hover-flame.png') });
  await page.mouse.down(); for (let i = 1; i <= 6; i++) { await page.mouse.move(fire[0] - i * 20, fire[1] + i * 8); await page.waitForTimeout(50); }
  const c = await page.evaluate(() => document.getElementById('tag').hidden ? '(なし)' : document.getElementById('tag').textContent);
  console.log('火種を運ぶ: 名札', c); await page.screenshot({ path: path.join(dir, 'dusk-carry-ember.png') });
  await page.mouse.up();
  console.log(errors.length ? 'エラー: ' + errors.join(' / ') : 'エラーなし'); console.log(dir);
} finally { await browser.close(); server.close(); }
