// 灯台の崖の後半をマウスで確かめる: 台1〜5をリレー → 割れ目の向こう（台6）に橋板なしで置く → 梁を割れ目へ運ぶ → 台6・7・8 へリレー
// 使い方: node dusk-diorama/tools/cliff-gully.mjs [幅x高さ] [--sal]（--sal: 橋板なしで、火トカゲが渡るのを待つ）
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';
const [w, h] = (process.argv.find(a => /^[0-9]+x[0-9]+$/.test(a)) || '960x540').split('x').map(Number), salWay = process.argv.includes('--sal');
const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  const ctx = await safeContext(browser, server.origin, { width: w, height: h });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.goto(`${server.origin}/dusk-diorama/?cliff=1&speed=2`); await page.waitForFunction(() => window.__game && window.__game.st.cliff && window.__game.st.cliff.t > 6 && window.__game.cliffStands[0].life > 0, null, { timeout: 300000 });
  const proj = v => page.evaluate(v => { const G = window.__game, p = G.camera.position.clone().set(...v).project(G.camera); return [(p.x * .5 + .5) * innerWidth, (-p.y * .5 + .5) * innerHeight]; }, v);
  const standXY = k => page.evaluate(k => window.__game.cliffStands[k].fl.getWorldPosition(window.__game.camera.position.clone()).toArray(), k).then(proj);
  const drag = async (a, b) => { await page.mouse.move(...a); await page.mouse.down(); for (let i = 1; i <= 10; i++) { await page.mouse.move(a[0] + (b[0] - a[0]) * i / 10, a[1] + (b[1] - a[1]) * i / 10); await page.waitForTimeout(25); } await page.mouse.up(); await page.waitForTimeout(250); };
  const lit = k => page.evaluate(k => window.__game.cliffStands[k].life > 0, k);
  const relay = async k => { await drag(await standXY(k - 1), await standXY(k)); return lit(k); };
  for (let k = 1; k <= 4; k++) console.log(`台${k + 1}:`, await relay(k) ? 'ともった' : 'ともらない');
  console.log('台6（割れ目の向こう・橋板なし）に火種を置くと:', await relay(5) ? 'ともった' : await page.evaluate(() => `火トカゲ ${window.__game.SAL.mode}`));
  if (salWay) { await page.waitForFunction(() => window.__game.cliffStands[5].life > 0, null, { timeout: 300000 }).catch(() => {}); console.log('火トカゲが渡って台6:', await lit(5) ? `ともった（${await page.evaluate(() => window.__game.st.cliff.t.toFixed(0))}s）` : 'ともらない');
    for (let k = 6; k <= 7; k++) console.log(`台${k + 1}:`, await relay(k) ? 'ともった' : 'ともらない');
  await page.waitForFunction(() => window.__game.st.cliff.lit, null, { timeout: 300000 }).catch(() => {}); console.log('灯台:', await page.evaluate(() => window.__game.st.cliff.lit ? `ともった（${window.__game.st.cliff.t.toFixed(0)}s）` : 'ともらない'));
    console.log(errors.length ? 'エラー: ' + errors.join(' / ') : 'エラーなし'); await browser.close(); server.close(); process.exit(0); }
  // 梁・荷車・丸太を、割れ目へ
  const beam = await page.evaluate(() => { const G = window.__game, on = b => { const p = b.obj.getWorldPosition(G.camera.position.clone()).project(G.camera); return Math.abs(p.x) < 0.85 && Math.abs(p.y) < 0.85 && p.z < 1; };
    const b = G.V.burnables.filter(b => !b.burned && !b.lost && b.kind === 'beam' && !b.house && on(b))[0]; const v = b.obj.getWorldPosition(G.camera.position.clone()); return { name: b.name, at: v.toArray() }; }); // 画面の中の梁・荷車・丸太
  const gw = await page.evaluate(() => { const G = window.__game, v = G.SHORE.group.localToWorld(G.camera.position.clone().set(G.SHORE.gully.x, 0, G.SHORE.gully.z)); return v.toArray(); });
  { const a = await proj(beam.at), b = await proj(gw); console.log('梁の画面', a.map(Math.round), '割れ目の画面', b.map(Math.round)); await page.mouse.move(...a); await page.mouse.down(); console.log('つまんだ:', await page.evaluate(() => { const c = window.__game.carry(); return c ? (c.b ? c.b.name : c.ember ? '火種' : c.sal ? '火トカゲ' : '?') : 'なし'; }));
    for (let i = 1; i <= 10; i++) { await page.mouse.move(a[0] + (b[0] - a[0]) * i / 10, a[1] + (b[1] - a[1]) * i / 10); await page.waitForTimeout(25); }
    console.log('放す所と割れ目の近さ:', await page.evaluate(() => { const c = window.__game.carry(); return c ? window.__game.gullyDist(c.p).toFixed(2) : '-'; })); await page.mouse.up(); await page.waitForTimeout(250); }
  console.log(`橋板（${beam.name}）:`, await page.evaluate(() => window.__game.st.cliff.bridge ? 'かかった' : 'かからない'));
  for (let k = 5; k <= 7; k++) console.log(`台${k + 1}:`, await relay(k) ? 'ともった' : 'ともらない');
  await page.waitForFunction(() => window.__game.st.cliff.lit, null, { timeout: 300000 }).catch(() => {}); console.log('灯台:', await page.evaluate(() => window.__game.st.cliff.lit ? `ともった（${window.__game.st.cliff.t.toFixed(0)}s）` : 'ともらない'));
  await page.screenshot({ path: path.join(dir, `dusk-gully-${w}x${h}.png`) });
  console.log(errors.length ? 'エラー: ' + errors.join(' / ') : 'エラーなし'); console.log(dir);
} finally { await browser.close(); server.close(); }
