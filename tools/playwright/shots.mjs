// 入口・保管庫・各ゲームを、RULES 4章の幅ごとに撮る（公開しない開発用）。
// 使い方（ゲームのフォルダで）: node tools/playwright/shots.mjs [ページ...] [--sizes=1280x720,375x740] [--query=lang=en] [--wait=1500]
//   ページは index・archive・ゲームのフォルダ名（dino-race など）。省くと全部。
// 撮った絵とエラーの記録は _dev/shots/<日時>/（Git に入れない）。
//
// 情報がうつらないための決まり（RULES 9章）:
// - 毎回まっさらなブラウザ（保存したパスワード・自動入力・Cookie・拡張機能・履歴なし）。ふだんの Chrome の設定は使わない（launchPersistentContext は使わない）
// - 開くのはこのスクリプトが 127.0.0.1 に立てる読むだけのサーバーだけ。外のページへの移動は止める。外から読むのは下の LIBS（フォントと three.js）だけ
// - 撮るのはブラウザの中の画面だけ。音は消す
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SIZES = ['1280x720', '1024x768', '375x740', '812x375'];
const LIBS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];
const NOT_GAMES = new Set(['_dev', 'tools', 'assets', 'thumbs', 'node_modules']);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json' };

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

// 読むだけのサーバー: 127.0.0.1 だけ・GET だけ・フォルダの中だけ・「.」で始まるもの（.private-words.txt・.env・.git）は出さない
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  let file = path.resolve(ROOT, rel);
  const bad = req.method !== 'GET' || !(file === ROOT || file.startsWith(ROOT + path.sep)) || rel.split('/').some(p => p.startsWith('.'));
  if (!bad && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (bad || !fs.existsSync(file)) { res.writeHead(bad ? 403 : 404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const stamp = new Date().toLocaleString('sv-SE').replace(/[: ]/g, '-').slice(0, 16);
const outDir = path.join(ROOT, '_dev', 'shots', stamp);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--mute-audio'] });
const report = [];
try {
  for (const name of pages) {
    const url = `${origin}/${name === 'index' ? '' : name === 'archive' ? 'archive.html' : name + '/'}${query ? '?' + query : ''}`;
    for (const [w, h] of sizes) {
      const phone = w < 768;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone, locale: 'ja-JP' });
      const blocked = [];
      await ctx.route('**/*', route => {
        const req = route.request(), u = new URL(req.url());
        if (u.origin === origin) return route.continue();
        if (req.method() === 'GET' && !req.isNavigationRequest() && LIBS.includes(u.hostname)) return route.continue();
        blocked.push(u.origin + u.pathname);
        return route.abort();
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e.message || e)));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      let loadError = null;
      try { await page.goto(url, { waitUntil: 'load', timeout: 30000 }); await page.waitForTimeout(wait); }
      catch (e) { loadError = String(e.message || e).split('\n')[0]; }
      const file = `${name}-${w}x${h}.png`;
      if (new URL(page.url()).origin === origin) await page.screenshot({ path: path.join(outDir, file) }).catch(() => {});
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1).catch(() => null);
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
