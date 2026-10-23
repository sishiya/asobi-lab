// マウスで実際に運んで確かめる: 流木を火のそばへ運ぶ → くべられるか。つづけて炎をつまんで引く → 画面が止まらないか
// 使い方: node dusk-diorama/tools/drag-check.mjs
import { serve, launch, safeContext } from '../../tools/playwright/lib.mjs';

const server = await serve(), browser = await launch();
try {
  const ctx = await safeContext(browser, server.origin, { width: 960, height: 540 });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${server.origin}/dusk-diorama/?auto=1&night=2`); await page.waitForFunction(() => window.__game && window.__game.st.t > 1, null, { timeout: 60000 });
  const at = () => page.evaluate(async () => {
    const G = window.__game, T = await import('three'), scr = v => { const p = v.clone().project(G.camera); return [(p.x * .5 + .5) * innerWidth, (-p.y * .5 + .5) * innerHeight]; };
    const dw = G.V.burnables.filter(b => b.name === '流木' && !b.burned && !b.lost).map(b => ({ b, c: new T.Box3().setFromObject(b.obj).getCenter(new T.Vector3()) })).filter(o => { const p = o.c.clone().project(G.camera); return Math.abs(p.x) < 0.8 && Math.abs(p.y) < 0.8; })[0];
    return { dw: dw && scr(dw.c), id: dw && dw.b.id, fire: scr(new T.Vector3(G.FIRE.x, 0.35, G.FIRE.z)), F: G.st.F };
  });
  const a = await at();
  console.log('流木', a.dw ? 'あり' : 'なし', '燃料', a.F.toFixed(1));
  if (a.dw) {
    await page.mouse.move(...a.dw); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(a.dw[0] + (a.fire[0] + 25 - a.dw[0]) * i / 10, a.dw[1] + (a.fire[1] + 10 - a.dw[1]) * i / 10); await page.waitForTimeout(40); }
    await page.mouse.up(); await page.waitForTimeout(600);
    console.log('火のそば（25px 横）で放した流木は', await page.evaluate(id => window.__game.V.burnables[id].burned ? 'くべられた' : 'くべられなかった', a.id));
  }
  // 炎をつまんで引く（前はここで止まった）
  const t0 = await page.evaluate(() => window.__game.st.t);
  await page.mouse.move(...a.fire); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(a.fire[0] - i * 18, a.fire[1] + i * 6); await page.waitForTimeout(60); }
  await page.waitForTimeout(800); const t1 = await page.evaluate(() => window.__game.st.t);
  await page.mouse.up(); await page.waitForTimeout(300);
  console.log('火種を運んでいるあいだ、時間は', t1 > t0 + 0.3 ? '進んだ（止まっていない）' : '止まった');
  console.log(errors.length ? 'エラー: ' + errors.join(' / ') : 'エラーなし');
} finally { await browser.close(); server.close(); }
