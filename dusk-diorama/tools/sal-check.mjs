// 火トカゲを闇へ連れていく: マウスで火トカゲをつまみ、冷えたかがり台のそばへ放す → 歩いていく・丸くなる・台に灯・帰る
// 使い方: node dusk-diorama/tools/sal-check.mjs
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';

const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  const ctx = await safeContext(browser, server.origin, { width: 960, height: 540 });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${server.origin}/dusk-diorama/?auto=1&night=2&speed=4`); await page.waitForFunction(() => window.__game && window.__game.st.t > 2, null, { timeout: 60000 });
  await page.evaluate(() => { window.__game.st.F = 30; }); // 火種をくわえていけるだけの火
  const a = await page.evaluate(async () => {
    const G = window.__game, T = await import('three'), scr = v => { const p = v.clone().project(G.camera); return [(p.x * .5 + .5) * innerWidth, (-p.y * .5 + .5) * innerHeight]; };
    const b = G.sal.body().clone(); G.sal.group.parent.localToWorld(b);
    const s = G.L.stands.filter(s => s.kind === 'brazier' && s.life <= 0).sort((p, q) => Math.hypot(p.x - G.FIRE.x, p.z - G.FIRE.z) - Math.hypot(q.x - G.FIRE.x, q.z - G.FIRE.z))[0];
    const { H } = await import('./js/util.js'), tgt = new T.Vector3(s.x + 0.3, H(s.x + 0.3, s.z), s.z);
    return { sal: scr(b), tgt: scr(tgt), sid: s.id, F: G.st.F };
  });
  await page.mouse.move(...a.sal); await page.waitForTimeout(200);
  console.log('火トカゲの上: カーソル', await page.evaluate(() => document.getElementById('c').style.cursor || '(ふつう)'), '/ 名札', await page.evaluate(() => document.getElementById('tag').hidden ? '(なし)' : document.getElementById('tag').textContent));
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(a.sal[0] + (a.tgt[0] - a.sal[0]) * i / 10, a.sal[1] + (a.tgt[1] - a.sal[1]) * i / 10); await page.waitForTimeout(40); }
  await page.screenshot({ path: path.join(dir, 'dusk-sal-carry.png') });
  await page.mouse.up();
  const F1 = await page.evaluate(() => window.__game.st.F);
  console.log('送ったとき 燃料', a.F.toFixed(1), '→', F1.toFixed(1));
  const seen = new Set(); let lit = false, t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const r = await page.evaluate(id => ({ m: window.__game.SAL.mode, lit: window.__game.L.stands[id].life > 0 }), a.sid);
    if (!seen.has(r.m)) { seen.add(r.m); console.log('  ', r.m); if (r.m === 'rest') { console.log('   ', await page.evaluate(id => { const G = window.__game, s = G.L.stands[id]; return `台 (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) / 行き先 (${G.SAL.goal.x.toFixed(2)}, ${G.SAL.goal.z.toFixed(2)})`; }, a.sid)); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(dir, 'dusk-sal-rest.png') }); } }
    lit = lit || r.lit; if (seen.has('back') && r.m === 'home') break;
    await page.waitForTimeout(300);
  }
  console.log('台に灯がついた:', lit ? 'はい' : 'いいえ', '/ 帰ってきた:', seen.has('back') && (await page.evaluate(() => window.__game.SAL.mode)) === 'home' ? 'はい' : 'いいえ');
  // 火が消えかけたら、1回だけ自分からおき火に入る
  await page.evaluate(() => { const G = window.__game; G.st.F = 2; G.st.burning = []; });
  await page.waitForTimeout(6000);
  console.log('おき火に入った:', await page.evaluate(() => window.__game.SAL.saved ? 'はい' : 'いいえ'));
  console.log(errors.length ? 'エラー: ' + errors.join(' / ') : 'エラーなし'); console.log(dir);
} finally { await browser.close(); server.close(); }
