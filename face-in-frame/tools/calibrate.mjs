// お手本の合わせ: 絵ごとに、その絵自身の顔を穴にぴったりはめこんで（?test=<絵>&path=align&pick=<絵>）撮り、
// 撮ったときに読んだ口の形と首のかたむき・向きを js/goals.js に書く。絵を足したら・読み方を変えたら走らせる。
// 読めない絵（顔が見つからない）は書かない（paintings.js の手で決めた数のまま）。
// node face-in-frame/tools/calibrate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, safeContext, ROOT } from '../../tools/playwright/lib.mjs';

const ids = (fs.readFileSync(path.join(ROOT, 'face-in-frame', 'js', 'paintings.js'), 'utf8').match(/\{ id: '([\w-]+)'/g) || []).map(s => s.match(/'(.+)'/)[1]);
const srv = await serve(), browser = await launch(), out = {};
const r = v => Math.round(v * 1000) / 1000;
for (const id of ids) {
  const ctx = await safeContext(browser, srv.origin, { width: 1000, height: 800 }), page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('face-in-frame', JSON.stringify({ sound: 0, secs: 5, assist: 0, blend: 0, touch: 0 })));
  await page.goto(`${srv.origin}/face-in-frame/?test=${id}&path=align&pick=${id}`);
  await page.click('#start');
  await page.waitForSelector('#result.on', { timeout: 120000 });
  const f = await page.evaluate(() => window.__shotFaces && window.__shotFaces[0]);
  if (f) out[id] = { goal: { jaw: r(f.ex.jaw), smile: r(f.ex.smile), frown: r(f.ex.frown), round: r(f.ex.round) }, roll: Math.round(f.roll * 10) / 10, yaw: r(f.yaw) };
  console.log(id, f ? JSON.stringify(out[id]) : '顔が見つからない');
  await ctx.close();
}
await browser.close(); srv.close();
fs.writeFileSync(path.join(ROOT, 'face-in-frame', 'js', 'goals.js'), '// tools/calibrate.mjs が書く。手で直さない（その絵自身の顔を、同じしくみで読んだ数）\nexport const CALIBRATED = {\n'
  + Object.entries(out).map(([id, v]) => `  ${id}: ${JSON.stringify(v).replace(/"(\w+)":/g, '$1: ')},`).join('\n') + '\n};\n');
