// 段階0の下ごしらえ（PLAN.md 2.12）を確かめる: 呑まれたら同じ夜から・夜の切れ目の記録とつづきから・「はじめから」の確認・
// 火が小さいときの断りの返事・2本目の指で運ぶのを取り消す・崖の火は火種を分けられる大きさまでもどる・崖の帯は減る・手の記録
// 使い方: node dusk-diorama/tools/stage0-check.mjs
import { chromium } from '../../tools/playwright/node_modules/playwright/index.mjs';
import { serve, safeContext } from '../../tools/playwright/lib.mjs';

const server = await serve(), browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
let bad = 0; const ok = (c, s) => { console.log(`${c ? 'ok ' : 'NG '} ${s}`); if (!c) bad++; };
try {
  const ctx = await safeContext(browser, server.origin, { width: 960, height: 540 });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const G = (fn, a) => page.evaluate(fn, a), ready = () => page.waitForFunction(() => window.__game && window.__game.st, null, { timeout: 60000 });
  const btn = id => G(id => { const b = document.getElementById(id); return b.hidden ? null : b.textContent; }, id);
  const fast = until => G(async until => { const g = window.__game; while (!until(g)) await new Promise(r => setTimeout(r, 50)); }, until);

  // 1. 第1夜で何もしない → 呑まれる → 「この夜をもう一度」「岩のまま先へ」・手の記録
  await page.goto(`${server.origin}/dusk-diorama/?auto=1&speed=20&log=1`); await ready();
  await page.waitForFunction(() => !document.getElementById('result').hidden, null, { timeout: 120000 });
  ok(await btn('next') === 'この夜をもう一度' && await btn('again') === '岩のまま先へ', `呑まれた札のボタン: ${await btn('next')} / ${await btn('again')}`);
  const log = await G(() => document.getElementById('log').textContent); ok(/第1夜 呑まれた/.test(log), `手の記録: ${log.split('\n').pop()}`);
  // 2. この夜をもう一度 → 島まるごとの第1夜
  await page.click('#next'); await page.waitForURL(/dusk-diorama/); await ready(); await page.waitForFunction(() => window.__game.st.phase === 'play', null, { timeout: 60000 });
  const r = await G(() => ({ n: window.__game.st.night, fallen: window.__game.isl.chunks.filter(c => c.fallen).length, url: location.search }));
  ok(r.n === 1 && r.fallen === 0 && !/resume/.test(r.url), `もう一度: 第${r.n}夜・落ちた塊 ${r.fallen}・URL ${r.url}`);

  // 3. くべて第1夜を越える → 記録は第2夜。タイトルへ → つづきから（第2夜）→ 同じ島
  await G(async () => { const g = window.__game, d = b => { const p = b.obj.getWorldPosition(b.obj.position.clone()); return Math.hypot(p.x - g.FIRE.x, p.z - g.FIRE.z); };
    while (g.st.phase === 'play') { await new Promise(r => setTimeout(r, 40)); if (g.st.F + g.st.burning.reduce((s, b) => s + b.left, 0) < 20) { const c = g.V.burnables.filter(b => !b.burned && !b.lost && !b.house).sort((a, b) => d(a) - d(b))[0]; if (c) g.burn(c); } } });
  await page.waitForFunction(() => !document.getElementById('result').hidden, null, { timeout: 30000 });
  const s1 = await G(() => JSON.parse(localStorage.getItem('dusk-diorama-save')));
  ok(s1.night === 2, `夜の切れ目の記録: 第${s1.night}夜・落ちた塊 ${s1.fallen.length}・くべた物 ${s1.gone.length}`);
  ok(await btn('next') === '次の夜へ' && await btn('again') === 'タイトルへ', `越えた札のボタン: ${await btn('next')} / ${await btn('again')}`);
  await page.click('#again'); await ready();
  ok(await btn('start') === 'つづきから（第2夜）' && await btn('fresh') === 'はじめから', `タイトル: ${await btn('start')} / ${await btn('fresh')}`);
  await page.click('#start'); await page.waitForFunction(() => window.__game.st.phase === 'play', null, { timeout: 60000 });
  const r2 = await G(() => ({ n: window.__game.st.night, fallen: window.__game.isl.chunks.filter(c => c.fallen).length, gone: window.__game.V.burnables.filter(b => b.burned).length }));
  ok(r2.n === 2 && r2.fallen === s1.fallen.length && r2.gone >= s1.gone.length, `つづきから: 第${r2.n}夜・落ちた塊 ${r2.fallen}・なくなった物 ${r2.gone}`);

  // 4. 火が小さいときに炎を押す → 「火が小さい」の名札（指でも）
  const fire = await G(async () => { const g = window.__game, T = await import('three'); g.st.F = 4; g.st.burning = []; const p = new T.Vector3(g.FIRE.x, 0.35, g.FIRE.z).project(g.camera); return [(p.x * .5 + .5) * innerWidth, (-p.y * .5 + .5) * innerHeight]; });
  await page.mouse.move(...fire); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(150);
  const tag = await G(() => ({ t: document.getElementById('tag').textContent, h: document.getElementById('tag').hidden, r: window.__game.st.refuse }));
  ok(!tag.h && tag.t === '火が小さい', `断りの返事: 名札「${tag.t}」`);

  // 5. 物をつまんで、2本目の指 → 元の所へ（くべない・落とさない）
  const pick = await G(async () => { const g = window.__game, T = await import('three'); g.st.F = 20;
    const b = g.V.burnables.filter(b => !b.burned && !b.lost && !b.house && b.name !== '流木').map(b => ({ b, c: new T.Box3().setFromObject(b.obj).getCenter(new T.Vector3()) })).filter(o => { const p = o.c.clone().project(g.camera); return Math.abs(p.x) < 0.7 && Math.abs(p.y) < 0.7; })[0];
    const p = b.c.clone().project(g.camera); return { id: b.b.id, xy: [(p.x * .5 + .5) * innerWidth, (-p.y * .5 + .5) * innerHeight], w: b.c.toArray() }; });
  const cv = await page.$('#c');
  const pd = (id, x, y, type = 'pointerdown') => cv.dispatchEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1, bubbles: true });
  await pd(1, ...pick.xy); await pd(1, pick.xy[0] + 30, pick.xy[1] + 20, 'pointermove'); await page.waitForTimeout(100);
  const mid = await G(() => !!window.__game.carry()); await pd(2, pick.xy[0] + 120, pick.xy[1]); await page.waitForTimeout(100);
  await pd(2, pick.xy[0] + 120, pick.xy[1], 'pointerup'); await pd(1, pick.xy[0] + 30, pick.xy[1] + 20, 'pointerup'); await page.waitForTimeout(200);
  const back = await G(async ({ id, w }) => { const g = window.__game, T = await import('three'), b = g.V.burnables[id], c = new T.Box3().setFromObject(b.obj).getCenter(new T.Vector3()); return { burned: b.burned, lost: b.lost, carried: b.carried, d: c.distanceTo(new T.Vector3(...w)) }; }, pick);
  ok(mid && !back.burned && !back.lost && !back.carried && back.d < 0.05, `2本目の指で取り消し: つまんだ ${mid}・元の所から ${back.d.toFixed(3)}`);

  // 6. 「はじめから」は2回押して消す
  await page.goto(`${server.origin}/dusk-diorama/`); await ready();
  await page.click('#fresh'); const once = await G(() => ({ t: document.getElementById('fresh').textContent, title: !document.getElementById('title').hidden, save: !!localStorage.getItem('dusk-diorama-save') }));
  ok(once.title && once.save && once.t === '記録を消して はじめから', `はじめから 1回目: 「${once.t}」・記録は残る`);

  // 7. 崖: 火が尽きても、火種を分けられる大きさまでもどる・帯は減る
  await page.goto(`${server.origin}/dusk-diorama/?cliff=1&debug=1`); await ready(); await page.waitForFunction(() => window.__game.st.cliff, null, { timeout: 60000 });
  await G(() => { const g = window.__game; g.st.F = 0; g.st.burning = []; }); await page.waitForTimeout(7000);
  const cf = await G(() => ({ F: window.__game.st.F, bar: document.getElementById('bar').style.transform, save: JSON.parse(localStorage.getItem('dusk-diorama-save')) }));
  ok(cf.F >= 6.9, `崖の火: 0 から 7 秒で ${cf.F.toFixed(1)}`);
  ok(/scaleX\(0\.9/.test(cf.bar), `崖の帯（残り）: ${cf.bar}`);
  ok(cf.save && cf.save.cliff, '崖に着いたときの記録');
  ok(!errors.length, errors.length ? 'エラー: ' + errors.join(' / ') : 'エラーなし');
} finally { await browser.close(); server.close(); }
console.log(bad ? `NG ${bad}` : 'すべて ok');
