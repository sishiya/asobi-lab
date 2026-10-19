// 段階A（リアルタイム版）を見えないブラウザで台本どおりに遊ばせ、場面ごとに撮る。重さ（1秒あたりのコマ数）も測る。
// 使い方（ゲームのフォルダで）: node pathstones/tools/playtest-rt.mjs [--sizes=1280x720,375x740,812x375]
// 撮った絵は _dev/shots/<日時>-rt/（Git に入れない）。音は消して開く（?mute=1）。
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, safeContext, outDir as makeOut } from '../../tools/playwright/lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const sizes = opt('sizes', '1280x720,375x740,812x375').split(',').map(s => s.split('x').map(Number));
const server = await serve();
const out = makeOut('shots') + '-rt';
fs.mkdirSync(out, { recursive: true });
const browser = await launch();
const report = [];
try {
  for (const [w, h] of sizes) {
    const ctx = await safeContext(browser, server.origin, { width: w, height: h });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message || e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${server.origin}/pathstones/?mute=1`);
    await page.waitForFunction(() => window.__ps && window.__ps.state, null, { timeout: 20000 });
    // 重さ: 3秒間のコマ数
    const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n / 3); })(); }));
    await page.evaluate(() => { __ps.freeze(true); __ps.restart(); });
    const shot = async name => { await page.waitForTimeout(150); await page.screenshot({ path: path.join(out, `${w}x${h}-${name}.png`) }); };
    await shot('0-start');
    // 台本（レベルデザインの最初の30秒）を刻みで流す
    const log = await page.evaluate(() => {
      const L = [], S = () => __ps.state;
      const go = (x, y, max = 900) => { for (let i = 0; i < max; i++) { const s = S(), dx = x - s.me.x, dy = y - s.me.y; if (Math.hypot(dx, dy) < 0.25) return true; __ps.run(1, { dx, dy }); for (const e of s.events) L.push(`${s.time.toFixed(1)} ${e.type}`); } return false; };
      const wait = (n, until) => { for (let i = 0; i < n; i++) { __ps.run(1, {}); const s = S(); for (const e of s.events) L.push(`${s.time.toFixed(1)} ${e.type}${e.got ? e.got : ''}`); if (until && until(s)) return true; } return false; };
      go(8, 18.2); go(8, 15.1);
      __ps.run(1, { trap: true }); L.push(`${S().time.toFixed(1)} trap`);
      wait(60 * 4);
      return L;
    });
    await shot('1-waiting');
    const log2 = await page.evaluate(() => {
      const L = [], S = () => __ps.state;
      for (let i = 0; i < 60 * 12; i++) { __ps.run(1, {}); const s = S(); for (const e of s.events) L.push(`${s.time.toFixed(1)} ${e.type}${e.got ? e.got : ''}`); if (L.some(l => l.includes('cut'))) break; }
      __ps.run(20, {});
      return L;
    });
    await shot('2-cut');
    // 落ちた積み木を拾う（近い順）
    const log3 = await page.evaluate(() => {
      const L = [], S = () => __ps.state;
      for (let k = 0; k < 12 && S().loose.length; k++) {
        const s = S(); const b = s.loose.slice().sort((a, c) => Math.hypot(a.x - s.me.x, a.y - s.me.y) - Math.hypot(c.x - s.me.x, c.y - s.me.y))[0];
        for (let i = 0; i < 600; i++) { const s2 = S(); if (!s2.loose.includes(b)) break; const dx = b.x - s2.me.x, dy = b.y - s2.me.y; __ps.run(1, { dx, dy }); for (const e of s2.events) L.push(`${s2.time.toFixed(1)} ${e.type}`); }
      }
      L.push('節 ' + S().me.n);
      return L;
    });
    await shot('3-picked');
    // 消えた提灯 C へ（灯りの中を通って北から）
    const log4 = await page.evaluate(() => {
      const L = [], S = () => __ps.state;
      const go = (x, y, max = 1500) => { for (let i = 0; i < max; i++) { const s = S(), dx = x - s.me.x, dy = y - s.me.y; if (Math.hypot(dx, dy) < 0.3) return; __ps.run(1, { dx, dy }); for (const e of s.events) L.push(`${s.time.toFixed(1)} ${e.type}`); if (s.lamps[2].lit) return; } };
      go(9.5, 13); go(12, 6); go(15, 4.6);
      for (let i = 0; i < 300 && !S().lamps[2].lit; i++) { __ps.run(1, {}); for (const e of S().events) L.push(`${S().time.toFixed(1)} ${e.type}`); }
      __ps.run(60, {});
      L.push('ともった ' + S().lamps[2].lit + ' 火 ' + S().me.fire);
      return L;
    });
    await shot('4-lit');
    await page.evaluate(() => __ps.run(60 * 3, {}));
    await shot('5-dawn');
    const ok = await page.evaluate(() => ({ won: __ps.state.won, hash: __ps.hash() }));
    report.push({ size: `${w}x${h}`, fps: Math.round(fps), errors, won: ok.won, log: [...log, ...log2, ...log3, ...log4].filter(l => !/stack|pick/.test(l) || l.startsWith('節')).slice(0, 40) });
    await ctx.close();
  }
} finally {
  await browser.close(); server.close?.();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
console.log(out);
