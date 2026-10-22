// なにもせずに夜に呑まれたあと、空中に残る物がないか・上の面の向きが裏返っていないかを確かめる
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
    scene.traverse(o => { if (!o.isMesh || !o.visible) return; let p = o; while (p && p !== scene) { if (!p.visible) return; p = p.parent; } o.getWorldPosition(v); if (v.y > -6 && !o.material.isShaderMaterial && !o.material.isMeshBasicMaterial && !(o.material.emissive && o.material.emissiveIntensity > 0.3)) out.push(`${o.geometry.type} (${v.x.toFixed(1)},${v.y.toFixed(1)},${v.z.toFixed(1)}) parent=${o.parent.type}${o.parent === scene ? ':scene' : ''}`); });
    return out;
  });
  await page.screenshot({ path: path.join(dir, 'dusk-collapse.png') });
  console.log('裏返った上の面:', flipped.join(',') || 'なし');
  console.log('空中に残った物:', left.length); left.slice(0, 40).forEach(s => console.log('  ' + s));
  if (errors.length) console.log('エラー:', errors.join(' / '));
  console.log(dir);
  await ctx.close();
} finally { await browser.close(); server.close(); }
