// いま光れ: 見くらべのページ（look/、手元だけ）を、場面・速さ・幅ごとに撮る。使い方: node ima-hikare/tools/look-shots.mjs [--sizes=1280x720,375x740]
// 撮った絵は _dev/shots/<日時>/（Git に入れない）。止めた絵にするため ?warm=画面数&freeze で先に進めてから撮る。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, launch, safeContext, outDir as makeOut } from '../../tools/playwright/lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const sizes = opt('sizes', '1280x720,1024x768,375x740,812x375').split(',').map(s => s.split('x').map(Number));
const extra = opt('query', '');
// 場面と速さ。warm は先に進める画面数（ゆっくりは 1画面の途中で止めたいので小さく）
const SHOTS = opt('shots', '') ? opt('shots', '').split(';').map(s => s.split('|')) : [
  ['s0-line', 'scene=s0&speed=1&warm=0'],
  ['s0-slow', 'scene=s0&speed=2&warm=0'],
  ['s0-real', 'scene=s0&speed=4&warm=30'],
  ['s2-slow', 'scene=s2&speed=2&warm=0'],
  ['s2-real', 'scene=s2&speed=4&warm=30'],
  ['court-real', 'scene=court&speed=4&warm=200'],
];

const server = await serve();
const outDir = makeOut('shots');
const browser = await launch();
try {
  for (const [name, q] of SHOTS) for (const [w, h] of sizes) {
    const ctx = await safeContext(browser, server.origin, { width: w, height: h });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message || e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    // ゆっくりの場面は、本当に数秒走らせてから止める（ビームの途中が見えるように）
    const live = /warm=0/.test(q);
    await page.goto(`${server.origin}/ima-hikare/look/?${q}${live ? '' : '&freeze'}${extra ? '&' + extra : ''}`, { waitUntil: 'load' });
    await page.waitForTimeout(live ? 3500 : 1200);
    const file = `look-${name}-${w}x${h}.png`;
    await page.screenshot({ path: path.join(outDir, file) });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    console.log(`${errors.length ? 'NG ' : 'ok '} ${file}${overflow ? ' 横はみ出し' : ''}${errors.length ? ' ' + errors.join(' / ') : ''}`);
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
console.log(path.relative(ROOT, outDir));
