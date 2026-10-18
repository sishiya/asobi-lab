// 入口・保管庫・各ゲームを、RULES 4章の幅ごとに撮る（公開しない開発用）。
// 使い方（ゲームのフォルダで）: node tools/playwright/shots.mjs [ページ...] [--sizes=1280x720,375x740] [--query=lang=en] [--wait=1500]
//   ページは index・archive・ゲームのフォルダ名（dino-race など）・_dev の下のページ（_dev/blender など）。省くと全部（_dev は入らない）。
// 撮った絵とエラーの記録は _dev/shots/<日時>/（Git に入れない）。
//
// 情報がうつらないための決まり（RULES 9章。くわしくは lib.mjs）:
// - 毎回まっさらなブラウザ（保存したパスワード・自動入力・Cookie・拡張機能・履歴なし）。ふだんの Chrome の設定は使わない（launchPersistentContext は使わない）
// - 開くのは 127.0.0.1 に立てる読むだけのサーバーだけ。外のページへの移動は止める。外から読むのはフォントと three.js だけ
// - 撮るのはブラウザの中の画面だけ。音は消す
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, launch, safeContext, outDir as makeOut } from './lib.mjs';

const SIZES = ['1280x720', '1024x768', '375x740', '812x375'];
const NOT_GAMES = new Set(['_dev', 'tools', 'assets', 'thumbs', 'node_modules']);

const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const sizes = opt('sizes', SIZES.join(',')).split(',').map(s => s.split('x').map(Number));
const query = opt('query', '');
const wait = Number(opt('wait', 1500));
const allPages = ['index', 'archive', ...fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.') && !NOT_GAMES.has(d.name) && fs.existsSync(path.join(ROOT, d.name, 'index.html')))
  .map(d => d.name)];
const named = args.filter(a => !a.startsWith('--'));
const pages = named.length ? named : allPages;

const server = await serve();
const origin = server.origin;
const outDir = makeOut('shots');
const browser = await launch();
const report = [];
try {
  for (const name of pages) {
    const url = `${origin}/${name === 'index' ? '' : name === 'archive' ? 'archive.html' : /\.html$/.test(name) ? name : name + '/'}${query ? '?' + query : ''}`;
    for (const [w, h] of sizes) {
      const ctx = await safeContext(browser, origin, { width: w, height: h });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e.message || e)));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      let loadError = null;
      try { await page.goto(url, { waitUntil: 'load', timeout: 30000 }); await page.waitForTimeout(wait); }
      catch (e) { loadError = String(e.message || e).split('\n')[0]; }
      const file = `${name.replace(/[\\/]/g, '_')}-${w}x${h}.png`;
      if (new URL(page.url()).origin === origin) await page.screenshot({ path: path.join(outDir, file) }).catch(() => {});
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1).catch(() => null);
      const blocked = ctx.blocked;
      report.push({ page: name, size: `${w}x${h}`, file, loadError, errors, blocked, overflowX });
      const flag = loadError || errors.length ? 'NG' : overflowX ? '横はみ出し' : 'ok';
      console.log(`${flag.padEnd(4)} ${name} ${w}x${h}${errors.length ? ` エラー${errors.length}` : ''}${blocked.length ? ` 止めた通信${blocked.length}` : ''}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\n${path.relative(ROOT, outDir)}`);
