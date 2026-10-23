// 五夜の難しさを、いまの遊び方（くべる・火種を台に置く・戸板・火トカゲ）で測る（PLAN.md 2.9章「不安と確かめ」）
// 使い方: node dusk-diorama/tools/lamps-check.mjs [--policy=lamp|burn] [--mode=each|run] [--reps=3] [--target=20] [--speed=10] [--cool=1] [--gmin=1] [--set=rMax:5.6,life:55,washUp:0/5/5/4/4]
//   policy: burn＝くべるだけ（前の nights-check と同じ手）／lamp＝灯と火トカゲと戸板も使う
//   mode:   each＝第1〜5夜をそれぞれ島まるごとから／run＝第1夜から通し（呑まれたら「岩から出直す」と同じく次の夜へ）
// 測るもの: 島の残り％・1分あたりの手数（くべる／火種／火トカゲ／戸板）・火が消えた回数（燃料0で燃えている物もない）・火トカゲの助け
// 手は人の速さに寄せて、ゲームの時間で cool 秒に1手まで（ふつう 1）。どの台・どこへ送るかは「闇から救える塊の量」で選ぶ（くわしくは DEVNOTES.md）
import { chromium } from '../../tools/playwright/node_modules/playwright/index.mjs';
import { serve, safeContext } from '../../tools/playwright/lib.mjs';

const arg = (k, d) => { const a = process.argv.find(s => s.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const policy = arg('policy', 'lamp'), mode = arg('mode', 'each'), reps = +arg('reps', 3), target = +arg('target', 20), speed = +arg('speed', 10), cool = +arg('cool', 1), gmin = +arg('gmin', 1);
// --set: RULE と LAMP の数を、ファイルを書きかえずに試す（同じモジュールの物を書きかえる。夜をはじめる前に）
const set = Object.fromEntries((arg('set', '') || '').split(',').filter(Boolean).map(kv => { const [k, v] = kv.split(':'); return [k, v.includes('/') ? v.split('/').map(Number) : +v]; }));
// 絵は小さく、GPU で描く（ソフトの描画では 1 秒にゲームの 0.3 秒しか進まなかった）
const server = await serve(), browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

async function playNight(page) {
  return page.evaluate(async ({ policy, target, cool, gmin }) => {
    const G = window.__game, { st, isl, V, L, SAL, RULE, FIRE } = G, { darkness, lightRadius } = await import('./js/rules.js');
    const pos = b => b.obj.getWorldPosition(new b.obj.position.constructor());
    const area = () => Math.round(100 * isl.chunks.filter(c => !c.fallen).reduce((s, c) => s + c.quads.length, 0) / isl.chunks.reduce((s, c) => s + c.quads.length, 0));
    const a0 = area(), n = { burn: 0, ember: 0, sal: 0, board: 0 }; let outs = 0, wasOut = false, last = -9, litSecs = 0, prevT = st.t, minF = 99;
    // 光の源（x, z, r）が、いま闇にさらされた塊をどれだけ救うか（崩れの速さで重みをつけて足す）
    const exposed = () => isl.chunks.filter(c => !c.fallen && !c.fixed && c.exposed && !c.drift);
    const nowDark = c => Math.min(darkness(c.dist, lightRadius(st.F) * (st.W.rMul || 1)), darkness(G.shelterOf(c), 0));
    function gain(x, z, r, list) { let g = 0; for (const c of list) { const d = nowDark(c); if (d <= 0) continue; const d2 = darkness(Math.hypot(c.cx - x, c.cz - z) - 0.45 * c.rad - r, 0); g += Math.max(0, d - d2) * (c.root ? RULE.rootHold : 1) * (1.5 - c.s); } return g; }
    // 漂うかけらを、その光でくっつけられるか
    function docks(x, z, r) { return isl.chunks.filter(c => c.drift && c.drift.mode === 'up' && c.drift.age > 3 && [...c.neighbors].some(i => !isl.all[i].fallen) && darkness(Math.hypot(c.cx - x, c.cz - z) - 0.45 * c.rad - r, 0) < RULE.dockDark).length; }
    const lampGain = (s, list) => (gain(s.x + s.ox, s.z + s.oz, s.r * s.rMul, list) + 2 * docks(s.x, s.z, s.r * s.rMul)) / (s.burnMul || 1);
    function bestMove() {
      const list = exposed(); let best = null;
      if (st.F < RULE.emberMin + RULE.emberCost) return null; // 分けても火が分けられる大きさに残るときだけ
      for (const s of L.stands) { if (!L.canLight(s, G.fireLight())) continue; const g = lampGain(s, list); if (!best || g > best.g) best = { g, kind: 'ember', s }; }
      if (SAL.mode === 'home' && st.demoDone !== false) {
        const cand = [];
        for (const s of L.stands) if (s.life <= 0 && !L.fallen(s)) cand.push({ x: s.x + 0.3, z: s.z, s }); // 空の台へ送れば、台にも灯がつく
        for (const c of list) cand.push({ x: c.cx, z: c.cz });
        for (const c of isl.chunks) if (c.drift && c.drift.mode === 'up') { const m = [...c.neighbors].map(i => isl.all[i]).filter(o => !o.fallen && !o.fixed).sort((a, b) => a.dist - b.dist)[0]; if (m) cand.push({ x: m.cx + (c.cx - m.cx) * 0.35, z: m.cz + (c.cz - m.cz) * 0.35 }); }
        for (const p of cand) {
          const id = G.chunkIdAt(p.x, p.z); if (id < 0 || isl.all[id].fallen || Math.hypot(p.x - FIRE.x, p.z - FIRE.z) < 1.2) continue;
          const g = 0.5 * gain(p.x, p.z, RULE.salR, list) + 2 * docks(p.x, p.z, RULE.salR) + (p.s ? lampGain(p.s, list) : 0); // 火トカゲの光は20秒（灯の半分）
          if (!best || g > best.g) best = { g, kind: 'sal', p };
        }
      }
      return best && best.g >= gmin ? best : null;
    }
    while (st.phase === 'play') {
      await new Promise(r => setTimeout(r, 30));
      const dt = st.t - prevT; prevT = st.t; litSecs += dt * L.stands.filter(s => s.life > 0).length; minF = Math.min(minF, st.F);
      const out = st.F <= 0 && !st.burning.length; if (out && !wasOut) outs++; wasOut = out;
      if (st.t - last < cool || !st.demoDone) continue;
      const pend = st.burning.reduce((s, b) => s + b.left, 0);
      if (st.F + pend < target) { const c = V.burnables.filter(b => !b.burned && !b.lost && !b.house && !b.carried && !b.boardOf).sort((a, b) => Math.hypot(pos(a).x - FIRE.x, pos(a).z - FIRE.z) - Math.hypot(pos(b).x - FIRE.x, pos(b).z - FIRE.z))[0]; if (c) { G.burn(c); n.burn++; last = st.t; continue; } }
      if (policy !== 'lamp') continue;
      if (st.W.wind) { const s = L.stands.find(s => s.life > 8 && s.lean > 0.5 && !s.board && !L.fallen(s)), b = V.burnables.find(b => b.board && !b.burned && !b.lost && !b.carried && !b.boardOf); if (s && b && G.leanBoard(b, s)) { n.board++; last = st.t; continue; } }
      const m = bestMove();
      if (m && m.kind === 'ember') { G.emberTo(m.s); n.ember++; last = st.t; }
      else if (m && m.kind === 'sal') { G.sendSal(m.p); n.sal++; last = st.t; }
    }
    const t = st.phase === 'dawn' ? RULE.night : st.tEnd, all = n.burn + n.ember + n.sal + n.board;
    return { night: st.night, w: st.W.name, won: st.phase === 'dawn', t: Math.round(t), a0, a1: area(), n, apm: +(all / (t / 60)).toFixed(1), lampApm: +((n.ember + n.sal) / (t / 60)).toFixed(1), outs, saved: SAL.saved, litSecs: Math.round(litSecs), minF: +minF.toFixed(1) };
  }, { policy, target, cool, gmin });
}

const rows = [];
try {
  const ctx = await safeContext(browser, server.origin, { width: 320, height: 240 });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
  const open = async night => {
    await page.goto(`${server.origin}/dusk-diorama/?speed=${speed}`); await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
    await page.evaluate(async ({ set, night }) => {
      const G = window.__game, { LAMP } = await import('./js/lamps.js');
      for (const [k, v] of Object.entries(set)) { if (k in G.RULE) G.RULE[k] = v; else if (k in LAMP) LAMP[k] = v; else throw new Error('知らない数: ' + k); }
      for (const s of G.L.stands) s.r = LAMP[s.kind];
      document.getElementById('title').hidden = true; G.startNight(night); // ?auto=1 と同じ
    }, { set, night });
  };
  const show = (rep, r) => { rows.push({ rep, ...r }); console.log(`${rep}回め 第${r.night}夜 ${r.w.padEnd(5, '　')} ${r.won ? '夜明け' : `呑まれた(${r.t}s)`} 島 ${r.a0}→${r.a1}% 手数/分 ${r.apm}（灯 ${r.lampApm}） くべる${r.n.burn} 火種${r.n.ember} 火トカゲ${r.n.sal} 戸板${r.n.board} 火が消えた ${r.outs} 助け ${r.saved ? 'あり' : 'なし'} 灯の秒 ${r.litSecs} 最小の燃料 ${r.minF}`); };
  for (let rep = 1; rep <= reps; rep++) {
    if (mode === 'each') for (let night = 1; night <= 5; night++) { await open(night); show(rep, await playNight(page)); }
    else {
      await open(1);
      for (let night = 1; night <= 5; night++) {
        const r = await playNight(page); show(rep, r);
        if (night < 5) { if (!r.won) await page.waitForFunction(() => !window.__game.isl.chunks.some(c => !c.fixed && !c.fallen), null, { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(500); await page.evaluate(n => window.__game.startNight(n), night + 1); }
      }
    }
  }
  // まとめ: 夜ごとの平均
  console.log(`\n== まとめ（policy=${policy} mode=${mode} reps=${reps} target=${target} cool=${cool} gmin=${gmin} set=${arg('set', '')}）==`);
  console.log('夜 | 夜明け | 島の残り% | 手数/分（うち灯・火トカゲ） | 火が消えた回数 | 助けを使った');
  for (let night = 1; night <= 5; night++) {
    const r = rows.filter(x => x.night === night), av = f => (r.reduce((s, x) => s + f(x), 0) / r.length);
    console.log(`第${night}夜 | ${r.filter(x => x.won).length}/${r.length} | ${av(x => x.a1).toFixed(0)} | ${av(x => x.apm).toFixed(1)}（${av(x => x.lampApm).toFixed(1)}） | ${av(x => x.outs).toFixed(1)} | ${r.filter(x => x.saved).length}/${r.length}`);
  }
  if (errors.length) console.log('エラー:', errors.join(' / '));
} finally { await browser.close(); server.close(); }
