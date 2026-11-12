// 画面が固まる瞬間をさがす: ふつうの速さで遊び（くべる・火種）、こまの間が長くあいた所と、そのときに起きたことを書き出す
// 使い方: node dusk-diorama/tools/hitch-check.mjs [--secs=90] [--night=1] [--ms=50]
import { chromium } from '../../tools/playwright/node_modules/playwright/index.mjs';
import { serve, safeContext } from '../../tools/playwright/lib.mjs';

const arg = (k, d) => { const a = process.argv.find(s => s.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const secs = +arg('secs', 90), night = +arg('night', 1), ms = +arg('ms', 50), idle = !!arg('idle', '');
const server = await serve(), browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const ctx = await safeContext(browser, server.origin, { width: 1280, height: 720 });
  const page = await ctx.newPage(); page.on('pageerror', e => console.log('エラー', e.message));
  await page.goto(`${server.origin}/dusk-diorama/?auto=1&night=${night}`);
  await page.waitForFunction(() => window.__game && window.__game.st.phase === 'play', null, { timeout: 60000 });
  const out = await page.evaluate(async ({ secs, ms, idle }) => {
    const G = window.__game, { st, isl, V, L } = G, ev = [], hit = [];
    // できごとの印: 崩れる・くべる・流木
    for (const k of ['fall', 'burn']) { const f = G[k]; G[k] = (...a) => { const t0 = performance.now(); const r = f(...a); ev.push({ t: t0, what: k, ms: performance.now() - t0 }); return r; }; }
    const longs = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) longs.push({ t: e.startTime, d: e.duration }); }).observe({ type: 'longtask', buffered: false }); } catch (e) { }
    const snap = () => ({ fallen: isl.chunks.filter(c => c.fallen).length, drift: isl.chunks.filter(c => c.drift).length, burnables: V.burnables.length, lit: L.stands.filter(s => s.life > 0).length });
    let prev = performance.now(), last = snap(); const end = prev + secs * 1000, gaps = []; let n = 0;
    await new Promise(res => { const f = now => { const d = now - prev; n++;
      const s = snap(); if (d > ms) gaps.push({ t: Math.round(now), d: Math.round(d), F: +st.F.toFixed(1), night: st.night, diff: Object.keys(s).filter(k => s[k] !== last[k]).map(k => `${k} ${last[k]}→${s[k]}`).join(' ') }); last = s; prev = now;
      // 手: 火が細ったら近い物をくべる・火があれば灯せる台へ火種
      if (!idle && st.phase === 'play' && n % 30 === 0) {
        if (st.F + st.burning.reduce((a, b) => a + b.left, 0) < 14) { const c = V.burnables.filter(b => !b.burned && !b.lost && !b.house && !b.board)[0]; if (c) G.burn(c); }
        else { const s2 = L.stands.find(s2 => L.canLight(s2, G.fireLight())); if (s2) G.emberTo(s2); }
      }
      if (now < end && st.phase !== 'title') requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    for (const g of gaps) g.near = ev.filter(e => Math.abs(e.t - g.t) < g.d + 20).map(e => `${e.what}(${e.ms.toFixed(0)}ms)`).join(' ');
    return { frames: n, gaps, longs: longs.length, phase: st.phase, night: st.night };
  }, { secs, ms, idle });
  console.log(`こま ${out.frames}（${(out.frames / secs).toFixed(0)}/秒）・${ms}ms を越えた間 ${out.gaps.length}・long task ${out.longs}・終わり 第${out.night}夜 ${out.phase}`);
  for (const g of out.gaps) console.log(`${(g.t / 1000).toFixed(1)}s ${g.d}ms 第${g.night}夜 F${g.F} ${g.diff} ${g.near}`);
} finally { await browser.close(); server.close(); }
