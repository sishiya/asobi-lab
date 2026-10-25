// 絵ごとの「スタイルの特徴」を js/styles.js に書く（tools/style-bottlenecks.html をひらいて計算）。絵を足したら走らせる。
// node face-in-frame/tools/style-bottlenecks.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, safeContext, ROOT } from '../../tools/playwright/lib.mjs';

const srv = await serve(), browser = await launch();
const ctx = await safeContext(browser, srv.origin, { width: 800, height: 600 });
const page = await ctx.newPage();
await page.goto(`${srv.origin}/face-in-frame/tools/style-bottlenecks.html`);
await page.waitForFunction(() => document.title.includes('完了'), null, { timeout: 120000 });
const styles = await page.evaluate(() => window.STYLES);
await browser.close(); srv.close();
const body = '// 絵ごとの「スタイルの特徴」（Magenta の任意スタイル変換の 100 の数）。tools/style-bottlenecks.mjs が書く。手で直さない\n'
  + 'export const STYLES = {\n' + Object.entries(styles).map(([id, v]) => `  ${id}: [${v.join(',')}],`).join('\n') + '\n};\n';
fs.writeFileSync(path.join(ROOT, 'face-in-frame', 'js', 'styles.js'), body);
console.log(Object.fromEntries(Object.entries(styles).map(([k, v]) => [k, v.length])));
