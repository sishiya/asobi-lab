// 名画の顔ハメの紹介動画の素材: ゲームを本物の速さで遊んで、画面を撮る（CDP のスクリーンキャスト）→ out/fif-clips/<名前>.mp4 と .json（場面の時刻）
// 本物の人の顔は使わない: カメラのかわりに、ゲームの確かめ用 ?test=<絵>&path=align（別の名画の顔が「がんばって穴に合わせる」動き）で遊ぶ。
// ゲームは書き出したコミットずみの版（out/game/face-in-frame。README「別の会話がゲームを書きかえている途中」）。
// node _dev/promo/face-in-frame-clips.mjs [クリップの名前...]（省くと全部）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '../../tools/playwright/node_modules/playwright/index.mjs';
import { serve, safeContext, ROOT } from '../../tools/playwright/lib.mjs';

const GAME = '_dev/promo/out/game/face-in-frame/';
const OUT = path.join(ROOT, '_dev', 'promo', 'out', 'fif-clips');
const W = 540, H = 960, SCALE = 2;   // スマホのたての画面。2倍で撮る（1080×1920）
// 遊ぶ回: test はカメラのかわりの顔、pick は出す絵、st は設定
const CLIPS = {
  title: { test: 'lizard', pick: 'scream', st: { shots: 1 }, title: true },
  play: { test: 'lizard', pick: 'sharaku,monalisa,gogh', st: { shots: 3 } },
  mona: { test: 'pearl', pick: 'monalisa', st: { shots: 1 } },
  plain: { test: 'lizard', pick: 'sharaku', st: { shots: 1, blend: 0, touch: 0 } },   // なじませ・筆のタッチなし（写楽の墨の線とくらべる用）
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS);
fs.mkdirSync(OUT, { recursive: true });

const srv = await serve();
// 筆のタッチは GPU がないと切れるので GPU で（face-in-frame/tools/playtest.mjs の GPU=1 と同じ）
const browser = await chromium.launch({ args: ['--mute-audio', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
for (const name of names) {
  const c = CLIPS[name];
  const ctx = await safeContext(browser, srv.origin, { width: W, height: H, scale: SCALE });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const st = { sound: 0, secs: 5, assist: 0, blend: 2, touch: 2, ...c.st };
  await page.addInitScript(s => { localStorage.setItem('face-in-frame', s); localStorage.setItem('manabi-lang', 'ja'); }, JSON.stringify(st));
  await page.goto(`${srv.origin}/${GAME}?lang=ja&test=${c.test}&path=align&pick=${c.pick}`);
  await page.waitForTimeout(1500);
  // スクリーンキャスト: コマごとの時刻（秒）つき
  const dir = path.join(OUT, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const n = frames.length; frames.push(f.metadata.timestamp);
    fs.writeFileSync(path.join(dir, `f${String(n).padStart(5, '0')}.jpg`), Buffer.from(f.data, 'base64'));
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * SCALE, maxHeight: H * SCALE, everyNthFrame: 1 });
  const marks = {};
  const mark = async k => { marks[k] = await page.evaluate(() => Date.now() / 1000); };
  await page.waitForTimeout(400); await mark('start');
  if (c.title) {
    await page.waitForTimeout(2500); await mark('openSettings');
    await page.click('#openSettings'); await page.waitForTimeout(3500);
    await mark('closeSettings'); await page.click('#closeSettings'); await page.waitForTimeout(1200);
  }
  await mark('tap'); await page.click('#start');
  await page.waitForFunction(() => window.__begins && window.__begins.length, null, { timeout: 120000 });
  const n = c.pick.split(',').length;
  await page.waitForSelector('#result.on', { timeout: 30000 * n });
  await mark('result');
  // けっかは動かないので静止画で（スクリーンキャストは、カメラが止まるとコマが来なくなる）。上と、1枚ずつの写真まで下へ
  await page.waitForTimeout(1500);
  const shotDir = path.join(OUT, name + '-result'); fs.mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: path.join(shotDir, 'top.png') });
  await page.screenshot({ path: path.join(shotDir, 'full.png'), fullPage: true });
  await page.evaluate(() => { const r = document.querySelector('#result'); (r.scrollHeight > r.clientHeight ? r : document.scrollingElement).scrollTo({ top: 99999 }); });
  await page.waitForTimeout(500); await page.screenshot({ path: path.join(shotDir, 'bottom.png') });
  await mark('end');
  const info = await page.evaluate(() => ({ begins: (window.__begins || []).map(t => t / 1000), shots: (window.__shots || []).map(t => t / 1000),
    total: document.querySelector('#total').textContent, parts: [...document.querySelectorAll('.shot .parts')].map(e => e.textContent) }));
  await cdp.send('Page.stopScreencast');
  await page.waitForTimeout(300);
  await ctx.close();
  // 30コマ/秒の mp4 に（スクリーンキャストは変わったときだけコマが来るので、時刻どおりに並べる）
  const t0 = frames[0];
  const list = frames.map((t, i) => `file 'f${String(i).padStart(5, '0')}.jpg'\nduration ${((frames[i + 1] ?? t + 0.1) - t).toFixed(4)}`).join('\n') + `\nfile 'f${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
  fs.writeFileSync(path.join(dir, 'list.txt'), list);
  const mp4 = path.join(OUT, name + '.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'fps=30,scale=1080:1920:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-g', '15', '-movflags', '+faststart', mp4]);
  // 時刻は動画のはじめ（最初のコマ）からの秒に
  const rel = v => +(v - t0).toFixed(3);
  const meta = { name, test: c.test, pick: c.pick, st, frames: frames.length, dur: rel(frames.at(-1)),
    marks: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, rel(v)])), begins: info.begins.map(rel), shots: info.shots.map(rel),
    total: info.total, parts: info.parts, errors, blocked: ctx.blocked };
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify(meta));
}
await browser.close(); srv.close();
