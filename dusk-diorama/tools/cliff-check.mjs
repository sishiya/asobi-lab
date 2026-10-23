// 灯台の崖（PLAN.md 2.11）を通して確かめる: 崖の場面に入る → 火トカゲの手本で桟橋の先に灯 → 台を順にともす（橋板・戸板あり／火トカゲだけ）→ 灯台がともる。失敗 → 「崖からやり直す」で同じ島から
// 使い方: node dusk-diorama/tools/cliff-check.mjs [--way=bridge|sal] [--shots]
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';
const arg = (k, d) => { const a = process.argv.find(s => s.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const way = arg('way', 'bridge'), shots = process.argv.includes('--shots');
const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  const ctx = await safeContext(browser, server.origin, { width: 960, height: 540 });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = async n => { if (shots) await page.screenshot({ path: path.join(dir, `dusk-cliff-${way}-${n}.png`) }); };
  await page.goto(`${server.origin}/dusk-diorama/?cliff=1&speed=4`); await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${server.origin}/dusk-diorama/?cliff=1&speed=4`); await page.waitForFunction(() => window.__game && window.__game.st.cliff, null, { timeout: 90000 });
  await page.waitForTimeout(1500); await shot('1-start');
  await page.waitForFunction(() => window.__game.cliffStands[0].life > 0, null, { timeout: 120000 }).catch(() => {});
  console.log('火トカゲの手本で、桟橋の先の台に灯:', await page.evaluate(() => window.__game.cliffStands[0].life > 0 ? 'ついた' : 'つかない'));
  // 手: 次の台に火種（燃料が足りなければくべる）。割れ目は橋板か火トカゲ、岬の台には戸板
  const r = await page.evaluate(async way => {
    const G = window.__game, { st, cliffStands: S, V, RULE, L } = G, wait = ms => new Promise(r => setTimeout(r, ms)), log = [];
    const feed = () => { if (st.F >= RULE.emberMin + 2) return; const b = V.burnables.filter(b => !b.burned && !b.lost && !b.carried && !b.bridge && !b.boardOf && !b.house).sort((a, b) => a.fuel - b.fuel)[0]; if (b) G.burn(b); };
    let guard = 0;
    while (!st.cliff.done && st.phase === 'play' && guard++ < 400) {
      feed(); const k = S.findIndex(s => s.life <= 0 && (S.indexOf(s) === 0 || S[S.indexOf(s) - 1].life > 0)); if (k < 0) { await wait(300); continue; }
      const s = S[k];
      if (s.afterGully && !st.cliff.bridge) {
        if (way === 'bridge') { const b = V.burnables.find(b => !b.burned && !b.lost && b.kind === 'beam' && !b.house); if (b) { G.placeBridge(b); log.push(`橋板（${b.name}）を ${st.cliff.t.toFixed(0)}s`); continue; } }
        if (G.SAL.mode === 'home' && st.F >= RULE.emberMin) { G.sendSal({ x: s.x + 0.2, z: s.z }); log.push(`火トカゲを割れ目の向こうへ ${st.cliff.t.toFixed(0)}s`); }
        await wait(500); continue;
      }
      if (s.windy && !s.board) { const d = V.burnables.find(b => !b.burned && !b.lost && b.board && !b.boardOf); if (d) { G.leanBoard(d, s); log.push(`戸板を岬の台に ${st.cliff.t.toFixed(0)}s`); } }
      if (G.emberTo(s)) log.push(`台${k + 1} ${st.cliff.t.toFixed(0)}s`); else await wait(300);
      await wait(250);
    }
    return { log, done: st.cliff.done, t: +st.cliff.t.toFixed(0), F: +st.F.toFixed(1) };
  }, way);
  console.log(`(${way})`, r.log.join(' / ')); console.log('灯台の下まで:', r.done ? `とどいた（${r.t}s / 燃料 ${r.F}）` : `とどかない（${r.t}s）`);
  await shot('2-done');
  if (r.done) { await page.waitForFunction(() => window.__game.st.cliff.lit, null, { timeout: 120000 }).catch(() => {}); console.log('灯台:', await page.evaluate(() => window.__game.st.cliff.lit ? 'ともった' : 'ともらない')); await page.waitForTimeout(4000); await page.evaluate(() => { document.getElementById('result').hidden = true; }); await shot('3-lit'); await page.waitForTimeout(3000); await shot('4-card'); console.log('結末:', await page.evaluate(() => document.getElementById('resLead').textContent)); }
  // 失敗とやり直し
  const before = await page.evaluate(() => { const G = window.__game; G.isl.chunks.filter(c => !c.fixed).slice(0, 5).forEach(c => { if (!c.fallen) G.fall(c); }); return 0; });
  await page.goto(`${server.origin}/dusk-diorama/?cliff=1&speed=8`); await page.waitForFunction(() => window.__game && window.__game.st.cliff, null, { timeout: 90000 });
  const fallen0 = await page.evaluate(() => window.__game.isl.chunks.filter(c => c.fallen).length);
  await page.evaluate(() => { const G = window.__game; G.st.cliff.t = G.CLIFF.time - 0.5; }); await page.waitForFunction(() => window.__game.st.phase === 'cliffFail', null, { timeout: 60000 });
  await shot('5-fail'); console.log('失敗の札:', await page.evaluate(() => `${document.getElementById('resTitle').textContent} / ボタン「${document.getElementById('next').textContent}」`));
  await page.evaluate(() => { const G = window.__game; G.fall(G.isl.chunks.find(c => !c.fixed && !c.fallen)); }); // やり直しのあとに落ちても、覚えた島にもどるか
  await Promise.all([page.waitForNavigation(), page.click('#next')]); await page.waitForFunction(() => window.__game && window.__game.st.cliff, null, { timeout: 90000 });
  const fallen1 = await page.evaluate(() => window.__game.isl.chunks.filter(c => c.fallen).length);
  console.log('崖からやり直し: 落ちた塊', fallen0, '→', fallen1, fallen0 === fallen1 ? '（崖に着いたときと同じ）' : '（ちがう）');
  console.log(errors.length ? 'エラー: ' + [...new Set(errors)].join(' / ') : 'エラーなし'); if (shots) console.log(dir);
} finally { await browser.close(); server.close(); }
