// ルックの見くらべのページを撮る → _dev/voice-pet-look/<日時>/
// node voice-pet/tools/look-shot.mjs [ページ（b.html など）]  しぐさの時刻ごとに撮る（set があるページ）
import path from 'node:path';
import { serve, launch, safeContext, outDir as makeOut } from '../../tools/playwright/lib.mjs';
const pageName = process.argv[2] || '';
const server = await serve(), out = makeOut('voice-pet-look'), browser = await launch(), errors = [];
try {
  const sc = Number((process.argv.find(a => a.startsWith('--scale=')) || '--scale=1').slice(8));
  const ctx = await safeContext(browser, server.origin, { width: 1700, height: 1150, scale: sc });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${server.origin}/voice-pet/look/${pageName}`, { waitUntil: 'load' }); await page.waitForTimeout(1200);
  const hasSet = await page.evaluate(() => !!__look.set);
  const shots = hasSet ? [['1-idle', 0.8], ['2-listen', 3.9], ['3-sniff', 5.6], ['4-cry', 7.25]] : [['look', 1.6], ['look-cry', 3.2]];
  for (const [n, t] of shots) {
    if (hasSet) await page.evaluate(t => { __look.set(t - 0.3); __look.advance(0.3); }, t); else await page.evaluate(t => __look.advance(t), t / 2);
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(out, n + '.png'), fullPage: sc === 1, ...(sc > 1 ? { clip: { x: 110, y: 96, width: 1550, height: 520 } } : {}) });
  }
} finally { await browser.close(); server.close(); }
console.log(errors.length ? errors.join('\n') : 'エラーなし'); console.log(out);
