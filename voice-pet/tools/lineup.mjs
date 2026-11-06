// 声の見本ごとに子をかえして、並べた1枚にする（形が声でどれだけ分かれるかを見る）
// node voice-pet/tools/lineup.mjs [--size=1280x720] [--full]   → _dev/voice-pet/<日時>/sheet.png
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, safeContext, outDir as makeOut } from '../../tools/playwright/lib.mjs';

const args = process.argv.slice(2);
const [w, h] = (args.find(a => a.startsWith('--size=')) || '--size=1280x720').slice(7).split('x').map(Number);
const names = ['low', 'high', 'child', 'breathy', 'rough', 'sing', 'quick'];
const server = await serve();
const out = makeOut('voice-pet');
const browser = await launch();
const errors = [];
const cells = [];
try {
  for (const n of names) {
    const ctx = await safeContext(browser, server.origin, { width: w, height: h });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(n + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(n + ': ' + m.text()); });
    await page.goto(`${server.origin}/voice-pet/?mute&test=${n}`, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.waitForTimeout(400);
    const info = await page.evaluate(n => { __vp.hatch(n); __vp.advance(4); return { ph: __vp.ph, v: __vp.gm.voice, form: __vp.form() }; }, n);
    await page.waitForTimeout(150);
    const file = `${n}.png`;
    if (args.includes('--full')) await page.screenshot({ path: path.join(out, 'full-' + file) });
    const box = await page.evaluate(() => { const L = __vp.layout; return { x: L.gx - L.u * 2.6, y: L.gy - L.u * 3.6, width: L.u * 5.2, height: L.u * 4.2 }; });
    await page.screenshot({ path: path.join(out, file), clip: box });
    cells.push({ n, file, info });
    await ctx.close();
  }
  const html = `<body style="margin:0;background:#111;color:#eee;font:13px sans-serif;display:grid;grid-template-columns:repeat(4,320px);gap:6px;padding:6px">${cells.map(c => `<figure style="margin:0"><img src="${c.file}" style="width:320px;display:block"><figcaption>${c.n} → ${c.info.form} ・ ${c.info.v.f0.toFixed(0)} Hz ・ 筒 ${c.info.v.vtl.toFixed(1)} cm</figcaption></figure>`).join('')}</body>`;
  fs.writeFileSync(path.join(out, 'sheet.html'), html);
  const ctx = await browser.newContext({ viewport: { width: 1310, height: 600 } });
  const page = await ctx.newPage();
  await page.goto('file://' + path.join(out, 'sheet.html').replace(/\\/g, '/'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'sheet.png'), fullPage: true });
  await ctx.close();
} finally { await browser.close(); server.close(); }
console.log(errors.length ? errors.join('\n') : 'エラーなし');
console.log(path.join(out, 'sheet.png'));
