// ひと晩を自動で遊んで、数の余裕を測る（PLAN.md 2.5章「パズルをピーキーにしない」）
// 使い方（ゲームのフォルダの1つ上で）: node dusk-diorama/tools/playtest.mjs
// やり方ごとに: 夜明けまで行けたか・島の広さ・屋根のある家・木。くべる物は「火から近い順」、燃料が目安を下回ったらくべる
import { serve, launch, safeContext } from '../../tools/playwright/lib.mjs';

const PLANS = [
  { name: 'なにもしない', pick: () => false, target: 0 },
  { name: 'がらくただけ・小さい火', pick: b => !b.house && b.kind !== 'green', target: 10 },
  { name: 'がらくただけ・中くらい', pick: b => !b.house && b.kind !== 'green', target: 18 },
  { name: 'がらくた＋木', pick: b => !b.house, target: 24 },
  { name: 'なんでも・大きい火', pick: () => true, target: 34 },
];
const server = await serve(), browser = await launch();
try {
  for (const plan of PLANS) {
    const ctx = await safeContext(browser, server.origin, { width: 480, height: 320 });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
    await page.goto(`${server.origin}/dusk-diorama/?auto=1&speed=10`);
    await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
    const out = await page.evaluate(async ({ pickSrc, target }) => {
      const G = window.__game, pick = eval(pickSrc), log = [];
      const dist = b => { const p = b.obj.getWorldPosition(new b.obj.position.constructor()); return Math.hypot(p.x - 1.75, p.z - 0.75); };
      let lastLog = -10;
      while (G.st.phase === 'play') {
        await new Promise(r => setTimeout(r, 30));
        const pending = G.st.burning.reduce((s, b) => s + b.left, 0);
        if (G.st.F + pending < target) { const c = G.V.burnables.filter(b => !b.burned && !b.lost && pick(b)).sort((a, b) => dist(a) - dist(b))[0]; if (c) G.burn(c); }
        if (G.st.t - lastLog >= 15) { lastLog = G.st.t; log.push([Math.round(G.st.t), +G.st.F.toFixed(1), G.isl.chunks.filter(c => c.fallen).length]); }
      }
      const area = G.isl.chunks.filter(c => !c.fallen).reduce((s, c) => s + c.quads.length, 0) / G.isl.chunks.reduce((s, c) => s + c.quads.length, 0);
      return { phase: G.st.phase, t: Math.round(G.st.t), area: Math.round(area * 100), roofed: G.V.houses.filter(h => !h.g.userData.fallen && !h.roofless).length, trees: G.V.trees.filter(t => !t.burned && !t.lost).length, burned: G.V.burnables.filter(b => b.burned).length, lost: G.V.burnables.filter(b => b.lost).length, log };
    }, { pickSrc: plan.pick.toString(), target: plan.target });
    console.log(`${plan.name}: ${out.phase === 'dawn' ? '夜明け' : '呑まれた'}(${out.t}s) 島${out.area}% 屋根${out.roofed}/3 木${out.trees}/6 くべた${out.burned} 落ちた物${out.lost}${errors.length ? ' エラー:' + errors[0] : ''}`);
    console.log('   [秒, 燃料, 落ちた塊] ' + out.log.map(l => l.join('/')).join('  '));
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
