// ダンゴムシのみち の面を確かめる・候補を作る。
//   node retro-8bit/tools/pillbug-levels.mjs            面ごとに、いちばん少ない石・解の数・道の長さ
//   node retro-8bit/tools/pillbug-levels.mjs --gen=2 --seed=5 --n=8   石 2 つで解ける面の候補（乱数で作って解く）
import { STAGES } from '../src/pillbug-path/stages.mjs';
import { parse, walk, solve, W, H } from '../src/pillbug-path/rules.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? +a.split('=')[1] : d; };

function show(map, stones, path) {
  const on = new Set(path);
  const rows = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      const i = y * W + x, c = map.g[i];
      r += stones.includes(i) ? '@' : c === 1 ? '#' : c === 2 ? 'L' : c === 3 ? 'o' : i === map.start.y * W + map.start.x ? '>v<^'[map.start.h] : on.has(i) ? '+' : '.';
    }
    rows.push('  ' + r);
  }
  return rows.join('\n');
}

if (!opt('gen', 0)) {
  STAGES.forEach((s, n) => {
    const map = parse(s);
    const t0 = performance.now();
    const r = solve(map);
    const best = r.sols.filter((x) => x.length === r.min);
    const w = best.length ? walk(map, best[0]) : null;
    const turns = w ? w.path.length : 0;
    console.log(`${String(n + 1).padStart(2)} ${s.name.padEnd(14)} 石 ${s.stones}・いちばん少ない ${r.min}・解 ${JSON.stringify(r.count)}・歩く ${turns} ます（${(performance.now() - t0).toFixed(0)}ms）`);
    if (r.min < 0) console.log('   ★ 解けない');
    if (r.min >= 0 && s.stones - r.min > 1) console.log('   ★ 石があまりすぎ');
    if (args.includes('--show') && w) console.log(show(map, best[0], w.path));
  });
} else {
  // 候補を作る: 岩とひなたを散らし、葉っぱ 1〜2 枚。いちばん少ない石が gen で、解が少なめ（考えがいがある）で、道が長めのもの
  const need = opt('gen', 2), N = opt('n', 6);
  let seed = opt('seed', 1);
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [];
  for (let tries = 0; tries < 4000 && out.length < N; tries++) {
    const rows = Array.from({ length: H }, () => Array(W).fill('.'));
    // 岩は 1〜4 ますの短い列、ひなたは 2×1・2×2 のかたまり（見てわかる形に）
    const nr = 3 + Math.floor(rnd() * 6), ns = Math.floor(rnd() * (opt('sun', 2) + 1)), nl = 1 + Math.floor(rnd() * opt('leaves', 2));
    const at = () => [Math.floor(rnd() * W), Math.floor(rnd() * H)];
    const set = (x, y, ch) => { if (x >= 0 && y >= 0 && x < W && y < H) rows[y][x] = ch; };
    for (let i = 0; i < nr; i++) { const [x, y] = at(), len = 1 + Math.floor(rnd() * 4), v = rnd() < 0.5; for (let k = 0; k < len; k++) set(x + (v ? 0 : k), y + (v ? k : 0), '#'); }
    for (let i = 0; i < ns; i++) { const [x, y] = at(), t = rnd() < 0.5; set(x, y, 'o'); set(x + 1, y, 'o'); if (t) { set(x, y + 1, 'o'); set(x + 1, y + 1, 'o'); } }
    for (let i = 0; i < nl; i++) { const [x, y] = at(); rows[y][x] = 'L'; }
    const [sx, sy] = at(); rows[sy][sx] = '>v<^'[Math.floor(rnd() * 4)];
    const stage = { name: 'gen', stones: need, map: rows.map((r) => r.join('')) };
    let map;
    try { map = parse(stage); } catch { continue; }
    if (walk(map, []).result === 'clear') continue;
    const r = solve(map, need);
    if (r.min !== need) continue;
    const best = r.sols.filter((x) => x.length === need);
    if (best.length > opt('maxsol', 6)) continue;
    const w = walk(map, best[0]);
    if (w.path.length < opt('minlen', 30) || w.path.length > opt('maxlen', 80)) continue;
    if (out.some((o) => o.map.join() === stage.map.join())) continue;
    out.push(stage);
    console.log(`--- 候補 ${out.length}: 石 ${need}・解 ${best.length}・歩く ${w.path.length} ます`);
    console.log(stage.map.map((r) => `    '${r}',`).join('\n'));
    console.log('  解の一つ:');
    console.log(show(map, best[0], w.path));
  }
}
