// ボタンを本当に押して、たまご → かえる → つつく → なでる → 声をかける（まねっこ）を通す。声は ?test= の見本
// node voice-pet/tools/playtest.mjs [見本の名前] [--size=375x740]
import path from 'node:path';
import { serve, launch, safeContext, outDir as makeOut } from '../../tools/playwright/lib.mjs';

const args = process.argv.slice(2);
const name = args.find(a => !a.startsWith('--')) || 'high';
const [w, h] = (args.find(a => a.startsWith('--size=')) || '--size=1280x720').slice(7).split('x').map(Number);
const server = await serve();
const out = makeOut('voice-pet-play');
const browser = await launch();
const errors = [], log = [];
const step = (s, ok) => { log.push(`${ok ? 'ok' : 'NG'} ${s}`); if (!ok) errors.push(s); };
try {
  const ctx = await safeContext(browser, server.origin, { width: w, height: h });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
  await page.goto(`${server.origin}/voice-pet/?mute&test=${name}`, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(500);
  const mode = () => page.evaluate(() => __vp.mode);
  step('はじめはたまご', await mode() === 'egg');
  const mic = await page.locator('#mic').boundingBox();
  const mx = mic.x + mic.width / 2, my = mic.y + mic.height / 2;
  // 短く押しただけ（テストの見本はすぐ読むので、押してすぐ離す）
  await page.mouse.move(mx, my); await page.mouse.down(); await page.waitForTimeout(900);
  step('押しているあいだは rec', await mode() === 'rec');
  await page.screenshot({ path: path.join(out, '1-rec.png') });
  await page.mouse.up();
  step('離すとかえりはじめる', await mode() === 'hatch');
  await page.evaluate(() => __vp.advance(3));
  step('かえった', await mode() === 'pet');
  step('遺伝子の表が出る', await page.evaluate(() => !document.getElementById('genes').hidden));
  step('保存は遺伝子の数だけ', await page.evaluate(() => { const s = localStorage.getItem('voicepet.v2'); return !!s && s.length < 4000 && !/samples/.test(s); }));
  await page.evaluate(() => __vp.advance(1));
  await page.screenshot({ path: path.join(out, '2-pet.png') });
  // つつく
  const box = await page.evaluate(() => __vp.box);
  await page.mouse.click(box.cx, box.cy);
  step('つつくと跳ねる', await page.evaluate(() => __vp.st.hop > 0 || __vp.st.hopV !== 0));
  step('体の型が決まっている', !!(await page.evaluate(() => __vp.form())));
  // なでる
  await page.mouse.move(box.cx - box.R * 0.5, box.cy); await page.mouse.down();
  for (let i = 0; i < 30; i++) { await page.mouse.move(box.cx - box.R * 0.5 + (i % 2 ? box.R : 0), box.cy + (i % 3) * 4, { steps: 3 }); await page.evaluate(() => __vp.advance(1 / 30)); }
  step('なでると目を細める', await page.evaluate(() => __vp.st.pet > 0.3));
  await page.screenshot({ path: path.join(out, '3-pet-stroke.png') });
  await page.mouse.up();
  // 声をかける
  await page.mouse.move(mx, my); await page.mouse.down(); await page.waitForTimeout(400);
  step('声をかけると耳をすます', await page.evaluate(() => __vp.st.listen === 1));
  await page.screenshot({ path: path.join(out, '4-listen.png') });
  await page.mouse.up(); await page.waitForTimeout(600); await page.evaluate(() => __vp.advance(0.3));
  step('まねして鳴く（口が動く）', await page.evaluate(() => __vp.st.mouth > 0.02 || __vp.mouthOn));
  await page.screenshot({ path: path.join(out, '5-answer.png') });
  // 読みなおしても同じ子
  const g1 = await page.evaluate(() => JSON.stringify(__vp.gm.genes));
  await page.reload(); await page.waitForTimeout(500);
  step('読みなおすと同じ子', await page.evaluate(() => __vp.mode) === 'pet' && await page.evaluate(() => JSON.stringify(__vp.gm.genes)) === g1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  step('横にはみ出さない', !overflow);
  await ctx.close();
} finally { await browser.close(); server.close(); }
console.log(log.join('\n'));
console.log(errors.length ? 'NG\n' + errors.join('\n') : 'all ok');
console.log(out);
process.exit(errors.length ? 1 : 0);
