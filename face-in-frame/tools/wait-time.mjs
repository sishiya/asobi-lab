// 「はじめる」から最初の絵が出るまで（paintingShown）と、時間が動きはじめるまで（timerStarts）の待ち時間を、スマホに近い条件（回線をしぼる・CPU を遅く）で測る。
// node face-in-frame/tools/wait-time.mjs [Mbps（ふつう 10）] [CPU を何倍遅く（ふつう 4）] [タイトルで待つ秒（ふつう 0）]
// タイトルで待つ秒は、遊ぶ人がタイトルを見ているあいだに先読みが進む分（読みはじめてから押すまで）
import { serve, launch, safeContext } from '../../tools/playwright/lib.mjs';

const [mbps = 10, cpu = 4, idle = 0] = process.argv.slice(2).map(Number);
const srv = await serve(), browser = await launch();
const ctx = await safeContext(browser, srv.origin, { width: 390, height: 844 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: mbps * 125000, uploadThroughput: 2 * 125000 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
await page.addInitScript(() => localStorage.setItem('face-in-frame', JSON.stringify({ sound: 0, secs: 5, shots: 3 })));
const t0 = Date.now();
await page.goto(`${srv.origin}/face-in-frame/?test=lizard`, { waitUntil: 'load', timeout: 120000 });
const loaded = (Date.now() - t0) / 1000;
await page.waitForTimeout(idle * 1000);
const t1 = Date.now();
await page.click('#start');
await page.waitForFunction(() => window.__begins && window.__begins.length, null, { timeout: 300000 });
const wait = (Date.now() - t1) / 1000;
// 時間が動きはじめるまで（顔の読み取りが読めて、時間の棒がのびはじめる）
await page.waitForFunction(() => parseFloat(document.querySelector('#timer').style.width) > 0, null, { timeout: 300000, polling: 100 });
const timer = (Date.now() - t1) / 1000;
console.log(JSON.stringify({ mbps, cpu, idle, pageLoad: +loaded.toFixed(1), paintingShown: +wait.toFixed(1), timerStarts: +timer.toFixed(1) }));
await browser.close(); srv.close();
