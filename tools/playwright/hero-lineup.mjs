// ぺらぺら世界の歴史係の主人公の案を、ゲームの中に入れて、ゲームの大きさで並べる（公開しない開発用。RULES 9・10章）
// 使い方: node tools/playwright/hero-lineup.mjs [案.glb ...] [--names=いま,案A,案B] [--level=0]
//   案はフォルダからの道（_dev/blender/traveler-a.glb など）。いまの主人公（多面体の旅人）は「いま」としてかならず先頭に入る
//   「案.glb#outline」で、銅版画のようなインクのふち（部品ごとの裏返しの殻。transparent なので断面には出ない）をつけて見る
//   glb の中の名前で動き: 「spin」で始まる部品は縦の軸で回る、「bob」で始まる部品は上下にゆれる（形を見るための最小の動き）
// 撮るもの: PC 1280×720 とスマホ 375×740（細かさ2倍）の、主人公のまわりを原寸で切りぬいた絵、そのシルエット（黒）、白黒（明暗）。
//   PC は 2D 世界の小窓（主人公のまん中を通るページの断面）と、細かさ3倍の大写し（細部を見るため。決めるのは原寸）も。
// 結果は _dev/lineup/<日時>/sheet.png（並べた1枚）と、ばらの絵。Git に入れない
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, launch, safeContext, outDir as makeOut } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const glbs = args.filter(a => !a.startsWith('--'));
const names = opt('names', ['いま', ...glbs.map(g => path.basename(g))].join(',')).split(',');
const level = Number(opt('level', 0));
const cands = [null, ...glbs];
const SIZES = [{ key: 'pc', width: 1280, height: 720, scale: 1 }, { key: 'phone', width: 375, height: 740, scale: 2 }, { key: 'zoom', width: 1280, height: 720, scale: 3 }];
const CROP = { pc: 260, phone: 160, zoom: 170 };

// ページの中: 主人公を案と入れかえる（ゲームと同じ URL の heroes.js を読むので、同じ HEROES になる）。カメラは描くときに onBeforeRender でもらう
async function swapHero([glb, outline]) {
  const THREE = await import('three');
  const url = performance.getEntriesByType('resource').map(e => e.name).find(n => /\/look\/heroes\.js/.test(n));
  const { HEROES } = await import(url);
  const orig = HEROES.__orig || (HEROES.__orig = HEROES.poly);
  let make = orig;
  if (glb) {
    const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(glb);
    make = () => {
      const hero = new THREE.Group(), body = new THREE.Group(); hero.add(body);
      const m = gltf.scene.clone(true); body.add(m);
      if (outline) {
        // 部品はどれも凸なので、まん中から少し大きくした裏返しの殻がふちになる
        const ink = new THREE.MeshBasicMaterial({ color: '#3a2614', side: THREE.BackSide, transparent: true, opacity: 1 });
        // glb の extras の noInk（three.js では userData。部品のノードか、その親）がついたものにはつけない
        const noInk = o => { for (let p = o; p; p = p.parent) if (p.userData && p.userData.noInk) return true; return false; };
        const meshes = []; m.traverse(o => { if (o.isMesh && !noInk(o)) meshes.push(o); });
        for (const o of meshes) {
          o.geometry.computeBoundingSphere();
          const c = o.geometry.boundingSphere.center, r = o.geometry.boundingSphere.radius;
          const k = 1 + 0.016 / Math.max(r, 0.04);
          const sh = new THREE.Mesh(o.geometry, ink);
          sh.position.copy(c).multiplyScalar(1 - k); sh.scale.setScalar(k);
          o.add(sh);
        }
      }
      const spins = [], bobs = [];
      m.traverse(o => { if (/^spin/.test(o.name)) spins.push([o, o.rotation.y]); if (/^bob/.test(o.name)) bobs.push([o, o.position.y]); });
      hero.scale.setScalar(1.25);
      let tm = 0;
      hero.userData = { body, animate(dt) { tm += dt; spins.forEach(([o, y0], i) => { o.rotation.y = y0 + tm * (0.5 + 0.25 * i) * (i % 2 ? -1 : 1); }); bobs.forEach(([o, y], i) => { o.position.y = y + Math.sin(tm * 2.2 + i * 0.7) * 0.05; }); } };
      return hero;
    };
  }
  HEROES.poly = () => {
    const h = make();
    h.traverse(o => { if (o.isMesh) o.onBeforeRender = (r, s, cam) => { window.__lineupCam = cam; }; });
    window.__lineupHero = h;
    return h;
  };
  window.__fh.stage.applyLook();
  return true;
}

// ページの中: 主人公の外わく（画面の座標）
async function heroBox() {
  const THREE = await import('three');
  const b = new THREE.Box3().setFromObject(window.__lineupHero), cam = window.__lineupCam;
  const pts = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new THREE.Vector3(x, y, z).project(cam));
  const xs = pts.map(p => (p.x + 1) / 2 * innerWidth), ys = pts.map(p => (1 - p.y) / 2 * innerHeight);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

const server = await serve();
const origin = server.origin;
const out = makeOut('lineup');
const browser = await launch();
const cells = [];   // { ci, size, kind, file, w, h, heroH }
const errors = [];
try {
  for (const size of SIZES) {
    for (let ci = 0; ci < cands.length; ci++) {
      const ctx = await safeContext(browser, origin, size);
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(`${names[ci]} ${size.key}: ${e.message}`));
      await page.goto(`${origin}/flat-history/?lang=ja`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__fh && window.__fh.stage);
      // 図版をはじめて、はじめの歴史の画面を閉じる
      await page.evaluate(l => { window.__fh.startGame(l); document.getElementById('pvStart').click(); }, level);
      await page.waitForTimeout(600);
      const [glbPath, flag] = (cands[ci] || '').split('#');
      const ok = await page.evaluate(swapHero, [glbPath ? `${origin}/${glbPath.replace(/\\/g, '/')}` : null, flag === 'outline'])
        .catch(e => { errors.push(`${names[ci]}: ${e.message}`); return false; });
      if (!ok) { await ctx.close(); continue; }
      await page.waitForTimeout(1500);
      const box = await page.evaluate(heroBox);
      const heroH = Math.round(box.y1 - box.y0);
      const cw = CROP[size.key];
      const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
      const clip = { x: Math.max(0, Math.min(size.width - cw, cx - cw / 2)), y: Math.max(0, Math.min(size.height - cw, cy - cw / 2)), width: cw, height: cw };
      const base = `${size.key}-${ci}`;
      const shot = async (kind) => { const file = `${base}-${kind}.png`; await page.screenshot({ path: path.join(out, file), clip }); cells.push({ ci, size: size.key, kind, file, w: size.key === 'zoom' ? 260 : cw, h: size.key === 'zoom' ? 260 : cw, heroH }); };
      await shot('color');
      if (size.key === 'zoom') { await ctx.close(); continue; }
      if (size.key === 'pc') {
        await page.screenshot({ path: path.join(out, `${base}-full.png`) });
        // 2D 世界に出る断面: 主人公を手前から奥へ5枚のページで切ったところ（ゲームの drawHeroOn。2D 世界と同じ 20px／単位を2倍で）
        const png = await page.evaluate(() => {
          const { st, stage, L } = window.__fh, h = st.hero, W = 4, H = 4, S = 20, k = 2, offs = [-0.6, -0.3, 0, 0.3, 0.6];
          const cv = document.createElement('canvas'); cv.width = offs.length * W * S * k; cv.height = H * S * k;
          const g = cv.getContext('2d'); g.fillStyle = '#f3e6c8'; g.fillRect(0, 0, cv.width, cv.height);
          offs.forEach((o, i) => {
            g.save(); g.scale(k, k);
            g.translate((i * W + W / 2 - h.x) * S, ((H - 0.4) - (L.H - h.y)) * S);
            stage.drawHeroOn(g, h.t + o);
            g.restore();
          });
          return cv.toDataURL('image/png');
        });
        const file = `${base}-slice.png`;
        fs.writeFileSync(path.join(out, file), Buffer.from(png.split(',')[1], 'base64'));
        cells.push({ ci, size: 'pc', kind: 'slice', file, w: 260, h: 52 });
      }
      await page.evaluate(() => { document.documentElement.style.filter = 'grayscale(1)'; });
      await shot('gray');
      await page.evaluate(async () => {
        document.documentElement.style.filter = '';
        const THREE = await import('three');
        const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const hide = [];
        // 光の輪・インクのふち・ほとんど見えない殻（断面だけに出すもの）はシルエットに入れない
        window.__lineupHero.traverse(o => { if (o.isSprite || (o.isMesh && (o.material.side === THREE.BackSide || (o.material.transparent && o.material.opacity < 0.5)))) hide.push(o); else if (o.isMesh || o.isLine) o.material = black; });
        hide.forEach(o => { o.visible = false; });
      });
      await page.waitForTimeout(100);
      await shot('silhouette');
      console.log(`${names[ci]} ${size.key}: 主人公の高さ ${heroH}px`);
      await ctx.close();
    }
  }
  // 1枚に並べる: 列＝案
  const rows = [['zoom', 'color', '大写し（3倍）'], ['pc', 'color', 'PC 原寸'], ['pc', 'silhouette', 'シルエット'], ['pc', 'gray', '白黒（明暗）'],
    ['phone', 'color', 'スマホ 原寸'], ['phone', 'silhouette', 'シルエット'], ['pc', 'slice', '2D の断面（小窓）']];
  const td = (c) => c ? `<td><img src="${c.file}" style="width:${c.w}px;height:${c.h}px"></td>` : '<td>—</td>';
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#0f302b;color:#f3e6c8;font:14px sans-serif}
    table{border-collapse:separate;border-spacing:10px}th{font-weight:600;text-align:center;padding:4px}th.r{text-align:right;color:#a9c3bb;font-weight:400;white-space:nowrap}
    td{text-align:center;vertical-align:middle}img{display:block;border:1px solid #2c5a51;margin:0 auto}</style>
    <table><tr><th></th>${cands.map((_, i) => `<th>${names[i] || i}</th>`).join('')}</tr>
    ${rows.map(([s, k, label]) => `<tr><th class="r">${label}</th>${cands.map((_, i) => td(cells.find(c => c.ci === i && c.size === s && c.kind === k))).join('')}</tr>`).join('')}
    <tr><th class="r">高さ（PC／スマホ）</th>${cands.map((_, i) => `<td>${cells.find(c => c.ci === i && c.size === 'pc')?.heroH ?? '—'}px ／ ${cells.find(c => c.ci === i && c.size === 'phone')?.heroH ?? '—'}px</td>`).join('')}</tr></table>`;
  fs.writeFileSync(path.join(out, 'sheet.html'), html);
  const ctx = await safeContext(browser, origin, { width: 300 + cands.length * 280, height: 400 });
  const page = await ctx.newPage();
  await page.goto(`${origin}/${path.relative(ROOT, out).replace(/\\/g, '/')}/sheet.html`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'sheet.png'), fullPage: true });
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}
if (errors.length) console.log('エラー:\n' + errors.join('\n'));
console.log(`\n${path.relative(ROOT, out)}`);
