// ぺらぺら世界の歴史係の紹介動画の素材: ゲームを本物の速さで遊んで、画面を撮る（CDP のスクリーンキャスト）→ out/fh-clips/<名前>.mp4 と .json（場面の時刻）
// ゲームは書き出したコミットずみの版（out/game/flat-history。`git archive HEAD flat-history assets | tar -x -C _dev/promo/out/game`）。
// play1: はじめての図版 I を、タイトルから遊ぶ（W・D で歩いて未来を見る → パレットの板 → 置く → 正史にする → 判定と舞台裏）。
// pl-<id>: その図版に答えを置いて「正史にする」まで（舞台裏＝2Dではこう見えた／3Dではこんな形だった）。
// node _dev/promo/flat-history-clips.mjs [クリップの名前...]（省くと全部）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '../../tools/playwright/node_modules/playwright/index.mjs';
import { serve, safeContext, ROOT } from '../../tools/playwright/lib.mjs';

const GAME = '_dev/promo/out/game/flat-history/';
const OUT = path.join(ROOT, '_dev', 'promo', 'out', 'fh-clips');
const W = 1280, H = 720, SCALE = 1.5;   // PC の横の画面。1.5倍で撮る（1920×1080）
// 図版ごとの答え（[形, 回す, x0, t0]。tools/design.mjs・ゲームの中で確かめたもの）
const SOL = {
  t3: [['lift', 0, 14, 6]], t6: [['slide', 0, 9, 7]], m2: [['slide', 1, 6, 20]], m3: [['beam', 0, 14, 2]],
  g1: [['hump', 0, 20, 3]], g3: [['spiral', 0, 19, 5]], x1: [['plank', 0, 17, 7]], x2: [['plank', 0, 17, 2]],
};
const CLIPS = { play1: {}, ...Object.fromEntries(Object.keys(SOL).map((id) => ['pl-' + id, { id }])) };
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS);
fs.mkdirSync(OUT, { recursive: true });

const srv = await serve();
const browser = await chromium.launch({ args: ['--mute-audio', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
for (const name of names) {
  const c = CLIPS[name];
  const ctx = await safeContext(browser, srv.origin, { width: W, height: H, scale: SCALE });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { localStorage.setItem('manabi-lang', 'ja'); });
  await page.goto(`${srv.origin}/${GAME}?lang=ja&mute`);
  await page.waitForFunction(() => window.__fh, null, { timeout: 30000 });
  await page.waitForTimeout(c.id ? 2500 : 3500);
  const dir = path.join(OUT, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const n = frames.length; frames.push(f.metadata.timestamp);
    fs.writeFileSync(path.join(dir, `f${String(n).padStart(5, '0')}.jpg`), Buffer.from(f.data, 'base64'));
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * SCALE, maxHeight: H * SCALE, everyNthFrame: 1 });
  const marks = {};
  const mark = async (k) => { marks[k] = await page.evaluate(() => Date.now() / 1000); };
  const pos = () => page.evaluate(() => ({ x: +window.__fh.st.hero.x.toFixed(2), t: +window.__fh.st.hero.t.toFixed(2) }));
  const info = {};
  await page.waitForTimeout(300); await mark('start');
  if (!c.id) {
    // タイトル → はじめから → 開始の画面（このままだと、こうなる）→ はじめる
    await page.waitForTimeout(3000); await mark('tStart'); await page.click('#tStart');
    await page.waitForTimeout(8500); await mark('pvStart'); await page.click('#pvStart');
    await page.waitForTimeout(2200);
    // 歩いて未来を見に行く（タップした所へ歩く walkTo。遊ぶ人の操作そのまま。崖のそば・キーウィが落ちる秒のあたりへ）
    info.from = await pos();
    await mark('walk'); await page.evaluate(() => window.__fh.walkTo(15.5, 11));
    await page.waitForTimeout(5200);
    await mark('walked'); info.walked = await pos();
    await page.waitForTimeout(2500);
    // パレットの板 → 置く
    await mark('carry'); await page.click('.palette .kind');
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const f = window.__fh; f.lockTo({ kind: 'plank', rot: 0, x0: 17, t0: 3 }); });
    await page.waitForTimeout(1300);
    await mark('place'); await page.evaluate(() => window.__fh.place());
    await page.waitForTimeout(4000);
    // 正史にする → 再生 → 判定
    await mark('bind'); await page.click('#btnBind');
  } else {
    const i = await page.evaluate((id) => window.__fh.LEVELS.findIndex((l) => l.id === id), c.id);
    await mark('pick'); await page.evaluate((i) => window.__fh.startGame(i), i);
    await page.waitForTimeout(1000); await page.click('#pvStart');
    await page.waitForTimeout(1600); await mark('carry');
    for (const [k, r, x, t] of SOL[c.id]) {
      await page.evaluate(([k, r, x, t]) => { const f = window.__fh; f.choose(k); if (r) f.rotate(); f.lockTo({ kind: k, rot: r, x0: x, t0: t }); }, [k, r, x, t]);
      await page.waitForTimeout(1200);
      await mark('place'); await page.evaluate(() => window.__fh.place());
      await page.waitForTimeout(2600);
    }
    await mark('bind'); await page.click('#btnBind');
  }
  await page.waitForFunction(() => !document.getElementById('rpResult').hidden, null, { timeout: 60000 });
  await mark('result');
  info.result = await page.evaluate(() => document.getElementById('rpResult').innerText.replace(/\s+/g, ' '));
  await page.waitForTimeout(5500);
  await mark('end');
  await cdp.send('Page.stopScreencast');
  await page.waitForTimeout(300);
  await ctx.close();
  const t0 = frames[0];
  const list = frames.map((t, i) => `file 'f${String(i).padStart(5, '0')}.jpg'\nduration ${((frames[i + 1] ?? t + 0.1) - t).toFixed(4)}`).join('\n') + `\nfile 'f${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
  fs.writeFileSync(path.join(dir, 'list.txt'), list);
  const mp4 = path.join(OUT, name + '.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-g', '15', '-movflags', '+faststart', mp4]);
  fs.rmSync(dir, { recursive: true, force: true });
  const rel = (v) => +(v - t0).toFixed(3);
  const meta = { name, id: c.id || 't1', frames: frames.length, dur: rel(frames.at(-1)), marks: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, rel(v)])), ...info, errors };
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify(meta));
}
await browser.close(); srv.close();
