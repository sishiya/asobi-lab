// 段階Aの試作をブラウザで確かめる（検証）。意図した解をキーで流す・火が消える・もどす／やり直し・1マスの大きさ。
// 使い方（ゲームのフォルダで）: node pathstones/tools/playtest.mjs
// 開き方は ../tools/playwright/lib.mjs（127.0.0.1 の読むだけのサーバー・まっさらなブラウザ・外へ出ない・音なし）。
import { serve, launch, safeContext } from '../../tools/playwright/lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOMS = ['r1', 'r2', 'r3a', 'r3', 'r4'];
const KEY = { N: 'KeyW', E: 'KeyD', S: 'KeyS', W: 'KeyA' };
const level = n => JSON.parse(fs.readFileSync(path.join(HERE, '..', 'levels', n + '.json'), 'utf8'));

const server = await serve();
const browser = await launch();
const log = [];
const say = s => { console.log(s); log.push(s); };
const idle = page => page.waitForFunction(() => window.__ps && window.__ps.cur && !window.__ps.busy, null, { timeout: 5000 });
const snap = page => page.evaluate(() => { const c = window.__ps.cur; return JSON.stringify([c.player, c.cents.map(x => [x.alive, x.body, x.mark]), c.rows, c.held, c.floor.join('')]); });
const moves = page => page.evaluate(() => document.getElementById('moves').textContent);

async function press(page, a) {
  if (a[0] === 'm') await page.keyboard.press(KEY[a[1]]);
  else if (a === 'w') await page.keyboard.press('Space');
  else if (a[0] === 'c') { await page.keyboard.press('KeyX'); await page.keyboard.press(KEY[a[1]]); }
  else if (a[0] === 'p') {
    await page.keyboard.press('KeyE'); await page.keyboard.press(KEY[a[1]]);
    const pl = await page.evaluate(() => window.__ps.place && { d: window.__ps.place.d, end: window.__ps.place.end });
    if (!pl || pl.d !== a[1]) return `置く影の向きがちがう（${JSON.stringify(pl)}）`;
    if (pl.end !== Number(a[2])) { await page.keyboard.press('Tab'); }
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(60);
  return null;
}

try {
  // 1. autoplay
  {
    const ctx = await safeContext(browser, server.origin, { width: 1280, height: 800 });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`${server.origin}/pathstones/?autoplay=1`);
    await page.waitForFunction(() => window.__autoplay, null, { timeout: 10000 });
    say(`1 autoplay: ${(await page.evaluate(() => window.__autoplay)).join(' / ')}${errs.length ? ' エラー: ' + errs.join(';') : ''}`);
    await ctx.close();
  }
  // 2. 意図した解をキーで（E＋方向の端も記録）
  for (const name of ROOMS) {
    const ctx = await safeContext(browser, server.origin, { width: 1280, height: 800 });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`${server.origin}/pathstones/?room=${name}`); await idle(page);
    const lv = level(name); let note = '', tabs = 0;
    for (const [i, a] of lv.intended.entries()) {
      await idle(page);
      if (a[0] === 'p') {
        // E＋方向を押したときの端（Tab が要ったか）を数える
        await page.keyboard.press('KeyE'); await page.keyboard.press(KEY[a[1]]);
        const pl = await page.evaluate(() => window.__ps.place && { d: window.__ps.place.d, end: window.__ps.place.end, kind: window.__ps.place.kind });
        if (!pl || pl.d !== a[1]) { note = `${i + 1}手目 ${a}: 影の向き ${JSON.stringify(pl)}`; break; }
        if (pl.end !== Number(a[2])) { tabs++; await page.keyboard.press('Tab'); }
        await page.keyboard.press('Enter'); await page.waitForTimeout(60);
      } else { const r = await press(page, a); if (r) { note = `${i + 1}手目 ${a}: ${r}`; break; } }
    }
    const won = await page.evaluate(() => window.__ps.cur.won);
    say(`2 ${name}: ${won ? '着いた' : 'NG'} ${note}${tabs ? `（E＋方向のあと Tab が要った: ${tabs}回）` : ''}${errs.length ? ' エラー: ' + errs.join(';') : ''}`);
    await ctx.close();
  }
  // 3. 火が消える → 1手前／もどす・やり直し・もどす
  for (const name of ['r2', 'r3', 'r4']) {
    const ctx = await safeContext(browser, server.origin, { width: 1280, height: 800 });
    const page = await ctx.newPage();
    await page.goto(`${server.origin}/pathstones/?room=${name}`); await idle(page);
    const lv = level(name); let done = false;
    for (const [i, a] of lv.intended.entries()) {
      await idle(page);
      const into = await page.evaluate(() => { const c = window.__ps.cur; const D = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
        for (const d in D) { const p = [c.player[0] + D[d][0], c.player[1] + D[d][1]]; if (c.cents.some(x => x.alive && x.mark && x.mark[0] === p[0] && x.mark[1] === p[1])) return d; } return null; });
      if (into && !done) {
        const before = await snap(page), mv = await moves(page);
        await page.keyboard.press(KEY[into]);
        const busyNow = await page.evaluate(() => window.__ps.busy);
        await page.waitForTimeout(1300); await idle(page);
        const after = await snap(page), mv2 = await moves(page);
        say(`3 ${name} ${i + 1}手目で印のマスへ: 演出中=${busyNow}、1手前のまま=${before === after && mv === mv2}`);
        done = true;
      }
      await press(page, a);
      if (i === 5) { // もどす・やり直し・もどす
        await idle(page);
        const s0 = await snap(page), m0 = await moves(page);
        await page.keyboard.press('KeyZ'); const m1 = await moves(page); const s1 = await snap(page);
        await page.keyboard.press('KeyD'); await page.keyboard.press('KeyZ'); // 1手してもどす（どれでもよい）
        await page.keyboard.press('KeyR'); const sR = await snap(page), mR = await moves(page);
        await page.keyboard.press('KeyZ'); const sB = await snap(page), mB = await moves(page);
        say(`3 ${name} もどす: ${m0}→${m1}（${s0 !== s1 ? '状態がもどった' : '変わらない'}）／R: ${mR}（${sR !== s1 ? 'はじめに' : '?'}）／もどす: ${mB}（${sB === s1 ? 'R の前にもどった' : 'もどらない'}）`);
        // 続きのためにもとの手順にそろえ直す
        await page.goto(`${server.origin}/pathstones/?room=${name}`); await idle(page);
        for (const b of lv.intended.slice(0, i + 1)) { await idle(page); await press(page, b); }
      }
      if (done && i > 5) break;
    }
    if (!done) say(`3 ${name}: 意図した解の途中に、印のマスへ動ける所がなかった`);
    await ctx.close();
  }
  // 4. 1マスの大きさ
  for (const [w, h] of [[375, 740], [812, 375], [1280, 720]]) {
    const out = [];
    for (const name of ROOMS) {
      const ctx = await safeContext(browser, server.origin, { width: w, height: h });
      const page = await ctx.newPage();
      await page.goto(`${server.origin}/pathstones/?room=${name}`); await idle(page);
      const px = await page.evaluate(() => { const b = document.getElementById('board').getBoundingClientRect(); return (b.width / (window.__ps.cur.w * 42 + 8) * 42).toFixed(1); });
      const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1);
      out.push(`${name} ${px}px${over ? '（はみ出し）' : ''}`);
      await ctx.close();
    }
    say(`4 ${w}x${h}: ${out.join(' / ')}`);
  }
} finally {
  await browser.close();
  server.close();
}
