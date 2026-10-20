// ルックの実験室の確認用（ルートで）: node look-lab/tools/snap.mjs "<query>" 名前 [幅x高さ] [待ち秒] [js]
import path from 'node:path'; import fs from 'node:fs';
import { serve, launch, safeContext } from '../../tools/playwright/lib.mjs';
const [q = '', name = 'a', size = '1280x720', wait = '4', js = ''] = process.argv.slice(2);
fs.mkdirSync('_dev/shots/look-lab', { recursive: true });
const [w, h] = size.split('x').map(Number);
const server = await serve(); const browser = await launch();
const origin = server.origin;
const ctx = await safeContext(browser, origin, { width: w, height: h });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${origin}/look-lab/?${q}`); await page.waitForTimeout(1500);
if (js) await page.evaluate(js);
await page.waitForTimeout(+wait * 1000);
const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
const out = path.join('_dev/shots/look-lab', name + '.png'); await page.screenshot({ path: out }); if (process.env.CLIP) { const [x, y, cw, ch] = process.env.CLIP.split(',').map(Number); await page.screenshot({ path: out.replace('.png', '-crop.png'), clip: { x, y, width: cw, height: ch } }); }
console.log(out, 'fps', fps, errs.join('\n'));
await browser.close(); server.close();
