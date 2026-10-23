// 火トカゲの見た目の採点用: ふだん・火を見上げる・手を見上げる（つまむ前）・火に寄って丸まる・闇で丸くなって照らす を、ふだんの寄りの原寸で撮り、まわりを切り出す
// 使い方: node dusk-diorama/tools/sal-look.mjs [名前]  （_dev/shots/<日時>/sal-<名前>-*.png）
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';

const tag = process.argv[2] || 'now';
const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  for (const [w, h, dev] of [[1280, 720, 'pc'], [375, 740, 'sp']]) {
    const ctx = await safeContext(browser, server.origin, { width: w, height: h });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
    await page.goto(`${server.origin}/dusk-diorama/?auto=1&night=2`); await page.waitForFunction(() => window.__game && window.__game.st.t > 2, null, { timeout: 180000 });
    const shot = async (name, wait = 2500) => {
      await page.evaluate(() => { window.__game.st.F = Math.max(window.__game.st.F, window.__game.__keepF ?? 0); });
      await page.waitForTimeout(wait);
      const p = await page.evaluate(() => { const G = window.__game, b = G.sal.body().clone(); G.sal.group.parent.localToWorld(b); const q = b.project(G.camera); return [(q.x * .5 + .5) * innerWidth, (-q.y * .5 + .5) * innerHeight]; });
      const cw = dev === 'pc' ? 220 : 150, ch = dev === 'pc' ? 140 : 110, x = Math.max(0, Math.min(w - cw, p[0] - cw / 2)), y = Math.max(0, Math.min(h - ch, p[1] - ch / 2));
      await page.screenshot({ path: path.join(dir, `sal-${tag}-${dev}-${name}.png`), clip: { x, y, width: cw, height: ch } });
      if (name === 'home') await page.screenshot({ path: path.join(dir, `sal-${tag}-${dev}-full.png`) });
      // いちばん寄せたとき（ホイール・ピンチの限り 0.45）
      const z0 = await page.evaluate(() => { const v = window.__game.view, z = v.zoom; v.zoom = 0.45; return z; }); await page.waitForTimeout(150);
      const p2 = await page.evaluate(() => { const G = window.__game, b = G.sal.body().clone(); G.sal.group.parent.localToWorld(b); const q = b.project(G.camera); return [(q.x * .5 + .5) * innerWidth, (-q.y * .5 + .5) * innerHeight]; });
      const x2 = Math.max(0, Math.min(w - cw, p2[0] - cw / 2)), y2 = Math.max(0, Math.min(h - ch, p2[1] - ch / 2));
      await page.screenshot({ path: path.join(dir, `sal-${tag}-${dev}-${name}-zoom.png`), clip: { x: x2, y: y2, width: cw, height: ch } });
      await page.evaluate(z => { window.__game.view.zoom = z; }, z0);
    };
    await page.evaluate(() => { const G = window.__game; G.__keepF = 30; G.st.F = 30; });
    await shot('home', 4000);
    await page.evaluate(() => window.__game.fx.burst(0.8)); await shot('flare', 400);
    // 手を見上げる: マウスを火トカゲの上へ（つまめる合図）
    if (dev === 'pc') {
      const p = await page.evaluate(() => { const G = window.__game, b = G.sal.body().clone(); G.sal.group.parent.localToWorld(b); const q = b.project(G.camera); return [(q.x * .5 + .5) * innerWidth, (-q.y * .5 + .5) * innerHeight]; });
      await page.mouse.move(p[0], p[1]); await shot('hover', 1500); await page.mouse.move(5, 5);
    }
    await page.evaluate(() => { const G = window.__game; G.__keepF = 0; G.st.F = 4; }); await shot('curl', 3500);
    await page.evaluate(() => { const G = window.__game; G.__keepF = 30; G.st.F = 30; }); await page.waitForTimeout(2500);
    // 闇へ: 冷えた台のそばへ送って、丸くなるまで待つ
    await page.evaluate(async () => {
      const G = window.__game, s = G.L.stands.filter(s => s.kind === 'brazier' && s.life <= 0).sort((p, q) => Math.hypot(p.x - G.FIRE.x, p.z - G.FIRE.z) - Math.hypot(q.x - G.FIRE.x, q.z - G.FIRE.z))[0];
      G.SAL.mode = 'go'; G.SAL.t = 0; G.SAL.goal = { x: s.x + 0.3, z: s.z }; G.SAL.lit = false; G.sal.ctl.goal = G.SAL.goal; G.sal.ctl.curl = false;
    });
    await page.waitForFunction(() => window.__game.SAL.mode === 'rest', null, { timeout: 240000 }).catch(() => console.log('  rest にならなかった', 'mode')); console.log('  mode', await page.evaluate(() => window.__game.SAL.mode));
    await shot('rest', 3000);
    console.log(dev, errors.length ? 'エラー: ' + errors.join(' / ') : 'エラーなし');
    await ctx.close();
  }
  console.log(dir);
} finally { await browser.close(); server.close(); }
