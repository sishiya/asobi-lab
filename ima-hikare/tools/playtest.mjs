// いま光れ A-1 を画面なしのブラウザで遊んで確かめる。使い方: node ima-hikare/tools/playtest.mjs [--sizes=1280x720,375x740]
// 本物の指（マウスのドラッグ）で、見えている端子と管のふちの▼だけを使って段0→段2まで進める（PLAN 5章・検証の案）。
// あわせて: ビームが0〜5秒で動くか／端子どうしの間（押せる所44px）／横のはみ出し／エラー。絵は _dev/shots/<日時>/。
import path from 'node:path';
import { ROOT, serve, launch, safeContext, outDir as makeOut } from '../../tools/playwright/lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const sizes = opt('sizes', '1280x720,1024x768,375x740,812x375').split(',').map(s => s.split('x').map(Number));

const server = await serve();
const outDir = makeOut('shots');
const browser = await launch();
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'ok ' : 'NG '} ${m}`); if (!c) fails++; };

async function drag(page, a, b) {
  await page.mouse.move(a[0], a[1]); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(a[0] + (b[0] - a[0]) * i / 8, a[1] + (b[1] - a[1]) * i / 8);
  await page.mouse.up();
  await page.waitForTimeout(150);
}
const P = (page, f, ...a) => page.evaluate(([f, a]) => { const fn = new Function('p', 'a', `return (${f})(p, ...a)`); return fn(window.__probe, a); }, [f.toString(), a]);
async function wire(page, from, to) {
  const a = await P(page, (p, k) => p.padXY(k), from), b = await P(page, (p, k) => p.padXY(k), to);
  if (!a || !b) return false;
  await drag(page, a, b);
  return P(page, (p, f, t) => p.wires.some(w => w.from === f && w.to === t), from, to);
}
// 線の道と重なりの検査: 代わりの線・部品の上・板の外が 0、端子が板の内側、下の操作が端子にかぶらない
async function layoutCheck(page, label) {
  const r = await P(page, p => p.routeCheck());
  ok(r.fallback === 0 && r.overPart === 0 && r.outside === 0, `${label}: 線の道（代わりの線 ${r.fallback}・部品の上 ${r.overPart}・板の外 ${r.outside}）`);
  const bx = await P(page, p => p.boxes());
  const [x0, y0, x1, y1] = bx.board;
  const outPads = bx.pads.filter(([, x, y]) => x < x0 + 8 || y < y0 + 8 || x > x1 - 8 || y > y1 - 8).map(q => q[0]);
  ok(!outPads.length, `${label}: 端子は板の内側${outPads.length ? '（はみ出し ' + outPads.join(',') + '）' : ''}`);
  const ui = await page.evaluate(() => ['#undo', '#next', '#answer'].map(s => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return r.width && getComputedStyle(e).display !== 'none' ? [s, r.left, r.top, r.right, r.bottom] : null; }).filter(Boolean));
  const hit = [];
  for (const [s, a, b, c, d] of ui) for (const [k, x, y] of bx.pads) if (x > a - 10 && x < c + 10 && y > b - 10 && y < d + 10) hit.push(`${s}×${k}`);
  ok(!hit.length, `${label}: ボタンが端子にかぶらない${hit.length ? '（' + hit.join(',') + '）' : ''}`);
}
async function waitFor(page, f, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await P(page, f)) return true; await page.waitForTimeout(100); } return false; }

for (const [w, h] of sizes) {
  console.log(`\n== ${w}x${h} ==`);
  const ctx = await safeContext(browser, server.origin, { width: w, height: h });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${server.origin}/ima-hikare/`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const t0 = await P(page, p => p.tick);
  await page.waitForTimeout(1500);
  const t1 = await P(page, p => p.tick);
  ok(t1 > t0, `何もしなくてもビームが動く（1.5秒で ${t1 - t0} こま）`);
  // 端子どうしの間（同じ段で見えている端子）
  const minGap = async () => P(page, p => { const xs = p.pads().map(k => p.padXY(k)); let m = 1e9; for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) m = Math.min(m, Math.hypot(xs[i][0] - xs[j][0], xs[i][1] - xs[j][1])); return Math.round(m); });
  const g0 = await minGap();
  ok(g0 >= 40, `段0 の端子どうしのいちばん近い間 ${g0}px（押せる所 44px がねらい。40 以上で可）`);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  ok(!over, '横のはみ出しなし');
  await page.screenshot({ path: path.join(outDir, `a1-s0-start-${w}x${h}.png`) });

  // 段0: 脈打っている端子を画面へ
  ok(await wire(page, 'H.H64', 'scr.in0'), '段0: 脈打つ 64 → 画面 をドラッグでつなげた');
  ok(await waitFor(page, p => p.passed, 8000), '段0: 光った（ビームが描いたあとに「光った！」）');
  await layoutCheck(page, '段0');
  await page.screenshot({ path: path.join(outDir, `a1-s0-passed-${w}x${h}.png`) });
  await page.click('#speed button:nth-child(5)');
  ok(await waitFor(page, p => p.nextVisible, 3000), '段0: 本当の速さにすると「次へ」が出る');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, `a1-s0-real-${w}x${h}.png`) });
  await page.click('#next');
  await page.waitForTimeout(300);

  // 段1: 横の数 → くらべる → 画面。▼をかぎの中へ
  ok(await P(page, p => p.stage) === 1, '段1 になった');
  const g1 = await minGap();
  ok(g1 >= 40, `段1 の端子どうしのいちばん近い間 ${g1}px`);
  ok(await wire(page, 'H.count', 'k1.in'), '段1: よこの数 → くらべる');
  // 戻すで元に戻る
  await page.click('#undo'); await page.waitForTimeout(150);
  ok(!(await P(page, p => p.wires.length)), '段1: 戻すで線が消える');
  ok(await wire(page, 'H.count', 'k1.in'), '段1: もう一度つなぐ');
  // 2本目はタップ2回でつなぐ
  {
    const a = await P(page, (p, k) => p.padXY(k), 'k1.out'), b = await P(page, (p, k) => p.padXY(k), 'scr.in0');
    await page.mouse.click(a[0], a[1]); await page.waitForTimeout(100); await page.mouse.click(b[0], b[1]); await page.waitForTimeout(150);
    ok(await P(page, p => p.wires.some(w => w.from === 'k1.out' && w.to === 'scr.in0')), '段1: くらべる → 画面（タップ2回）');
  }
  {
    const k = await P(page, (p, id) => p.knobXY(id), 'k1'), dst = await P(page, (p, hh, vv) => p.tubeXY(hh, vv), 33 * 8 + 8, 100);
    ok(!!k, '段1: 管のふちに▼が出た');
    if (k) await drag(page, k, [dst[0], k[1]]);
  }
  ok(await waitFor(page, p => p.passed, 6000), '段1: 線がかぎの中に入った（ゆっくりのまま）');
  await layoutCheck(page, '段1');
  // ずれた▼では合格しない（ねらい33。合格は 29〜37）。速いで左右にゆらしても、札が出たり消えたりしない
  {
    await page.click('#speed button:nth-child(4)');
    const f0 = await P(page, p => p.flips);
    const k = await P(page, (p, id) => p.knobXY(id), 'k1');
    const far = await P(page, (p, hh, vv) => p.tubeXY(hh, vv), 20 * 8 + 8, 100);
    await page.mouse.move(k[0], k[1]); await page.mouse.down();
    for (let i = 0; i < 12; i++) { await page.mouse.move(k[0] + (i % 2 ? 30 : -30), k[1]); await page.waitForTimeout(60); }
    await page.mouse.move(far[0], k[1]); await page.mouse.up(); await page.waitForTimeout(800);
    ok(!(await P(page, p => p.passNow)) && !(await P(page, p => p.passed)), '段1: ▼をはずすと合格が消える');
    const flips = (await P(page, p => p.flips)) - f0;
    ok(flips <= 2, `段1: ゆらしている間に札が出たり消えたりしない（${flips}回）`);
    const k2 = await P(page, (p, id) => p.knobXY(id), 'k1'), dst = await P(page, (p, hh, vv) => p.tubeXY(hh, vv), 33 * 8 + 8, 100);
    await drag(page, k2, [dst[0], k2[1]]);
    ok(await waitFor(page, p => p.passed, 4000), '段1: もどすとまた合格');
  }
  await page.screenshot({ path: path.join(outDir, `a1-s1-passed-${w}x${h}.png`) });
  await page.click('#next'); await page.waitForTimeout(300);

  // 段2: かつ でくらべる2つを合わせる
  ok(await P(page, p => p.stage) === 2, '段2 になった');
  const g2 = await minGap();
  ok(g2 >= 40, `段2 の端子どうしのいちばん近い間 ${g2}px`);
  ok(await wire(page, 'k1.out', 'a1.a'), '段2: くらべる(よこ) → かつ');
  ok(await wire(page, 'k2.out', 'a1.b'), '段2: くらべる(たて) → かつ');
  ok(await wire(page, 'a1.out', 'scr.in0'), '段2: かつ → 画面（前の線と入れかわる）');
  {
    const k1 = await P(page, (p, id) => p.knobXY(id), 'k1'), k2 = await P(page, (p, id) => p.knobXY(id), 'k2');
    const d1 = await P(page, (p, hh, vv) => p.tubeXY(hh, vv), 44 * 8 + 8, 100), d2 = await P(page, (p, hh, vv) => p.tubeXY(hh, vv), 100, 10 * 8 + 8);
    if (k1) await drag(page, k1, [d1[0], k1[1]]);
    if (k2) await drag(page, k2, [k2[0], d2[1]]);
    ok(!!k1 && !!k2, '段2: ▼が横と縦に1つずつ');
  }
  ok(await waitFor(page, p => p.passed, 8000), '段2: 点がかぎの中に入った');
  await layoutCheck(page, '段2');
  await page.screenshot({ path: path.join(outDir, `a1-s2-passed-${w}x${h}.png`) });
  const log = await P(page, p => p.log);
  console.log(`   記録: はじめの線 ${Math.round(log.firstWire / 100) / 10}秒、合格 ${log.passes.map(x => `段${x.stage} ${Math.round(x.at / 100) / 10}秒`).join(' / ')}`);
  ok(errors.length === 0, `エラーなし${errors.length ? ': ' + errors.join(' / ') : ''}`);
  await ctx.close();
}
await browser.close(); server.close();
console.log(`\n${path.relative(ROOT, outDir)}`);
console.log(fails ? `NG が ${fails} 個` : 'ぜんぶ ok');
process.exitCode = fails ? 1 : 0;
