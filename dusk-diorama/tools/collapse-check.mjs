// なにもせずに夜に呑まれたあと、火の番の岩（まん中の塊）とその上の物のほかに、空中に残る物がないか・上の面の向きが裏返っていないかを確かめる
// 使い方: node dusk-diorama/tools/collapse-check.mjs
import path from 'node:path';
import { serve, launch, safeContext, outDir } from '../../tools/playwright/lib.mjs';

const server = await serve(), browser = await launch(), dir = outDir('shots');
try {
  const ctx = await safeContext(browser, server.origin, { width: 640, height: 480 });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.goto(`${server.origin}/dusk-diorama/?auto=1&speed=20`); await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
  // 上の面の三角形が上を向いているか（裏返った塊の数）
  const flipped = await page.evaluate(() => window.__game.isl.chunks.filter(c => { const g = c.group.children[0].geometry, p = g.attributes.position.array, ix = g.index.array; let s = 0; for (let k = 0; k < ix.length; k += 3) { const a = ix[k] * 3, b = ix[k + 1] * 3, d = ix[k + 2] * 3; const ux = p[b] - p[a], uz = p[b + 2] - p[a + 2], vx = p[d] - p[a], vz = p[d + 2] - p[a + 2]; s += uz * vx - ux * vz; } return s < 0; }).map(c => c.id));
  await page.waitForFunction(() => window.__game.st.phase === 'lost', null, { timeout: 300000 });
  await page.waitForFunction(() => !document.getElementById('result').hidden, null, { timeout: 300000 });
  const left = await page.evaluate(() => {
    const G = window.__game, out = [], v = new (G.camera.position.constructor)();
    const fixed = G.isl.chunks.find(c => c.fixed);
    G.isl.chunks.forEach(c => { if (!c.fallen && !c.fixed) out.push('落ちていない塊 ' + c.id); });
    const scene = G.camera.parent || fixed.group.parent;
    const isOnRock = o => { for (let p = o; p; p = p.parent) if (p === fixed.group) return true; return false; }; // 火の番の岩とその上の物は残ってよい
    scene.traverse(o => { if (!o.isMesh || !o.visible) return; let p = o; while (p && p !== scene) { if (!p.visible) return; p = p.parent; } o.getWorldPosition(v); if (v.y > -60 && !isOnRock(o) && !o.material.isShaderMaterial && !o.material.isMeshBasicMaterial && !(o.material.emissive && o.material.emissiveIntensity > 0.3)) out.push(`${o.geometry.type} (${v.x.toFixed(1)},${v.y.toFixed(1)},${v.z.toFixed(1)}) parent=${o.parent.type}${o.parent === scene ? ':scene' : ''}`); });
    // まとめて描いた物（草・れんがなど）は、ひとつずつの位置で岩から離れていないか
    const m = new (G.camera.matrix.constructor)(), q = new (G.camera.position.constructor)();
    fixed.group.traverse(o => { if (!o.isInstancedMesh) return; for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); q.setFromMatrixPosition(m); if (Math.hypot(q.x, q.z) > fixed.rad * 1.6 + 0.5) { out.push(`岩から離れたまとまりの1つ (${q.x.toFixed(1)},${q.z.toFixed(1)})`); break; } } });
    return out;
  });
  await page.screenshot({ path: path.join(dir, 'dusk-collapse.png') });
  await page.evaluate(() => { document.getElementById('result').hidden = true; const G = window.__game; G.view.zoom = 0.6; });
  await page.waitForTimeout(8000); await page.screenshot({ path: path.join(dir, 'dusk-collapse-later.png') });
  await page.evaluate(() => { const G = window.__game; G.view.el = -0.35; G.view.zoom = 0.55; G.view.target.set(0, -2.5, 0); }); await page.waitForTimeout(3000); await page.screenshot({ path: path.join(dir, 'dusk-collapse-below.png') }); // 下から（岩が透けていないか）
  const late = await page.evaluate(() => { const G = window.__game, out = []; for (const c of G.isl.chunks) if (!c.fixed && c.group.visible) out.push(`${c.id}:y=${c.group.position.y.toFixed(1)}`); return out; });
  console.log('まだ見えている落ちた塊:', late.length, late.slice(0, 12).join(' '));
  console.log('裏返った上の面:', flipped.join(',') || 'なし');
  console.log('空中に残った物:', left.length); left.slice(0, 40).forEach(s => console.log('  ' + s));
  if (errors.length) console.log('エラー:', errors.join(' / '));
  console.log(dir);
  await ctx.close();
} finally { await browser.close(); server.close(); }
