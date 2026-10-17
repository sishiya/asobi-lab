// 図版の案を試す（開発用）: node tools/tune.mjs 案のファイル.mjs
// 案のファイルは、図版の形（LEVELS と同じ書き方）の配列を export default する。形は1つの図版だけ。
globalThis.TX = (ja) => ja;
const { simulate, restHeight, canPlaceQuick, pieceDims } = await import('../js/sim.js');
const { pathToFileURL } = await import('node:url');
const path = await import('node:path');
const variants = (await import(pathToFileURL(path.resolve(process.argv[2])).href)).default;

export function measure(L) {
  const kind = Object.keys(L.stock)[0];
  const rots = pieceDims({ kind, rot: 0 }).noRot ? [0] : [0, 1];
  const sols = new Set(), list = [];
  for (const rot of rots) for (let x0 = 0; x0 < L.W; x0++) for (let t0 = 0; t0 <= L.T; t0++) {
    const p = { kind, rot, x0, t0 };
    p.y0 = restHeight(L, p);
    if (canPlaceQuick(L, p, [])) continue;
    const h = simulate(L, [p]);
    if (!h.overlap && h.end.type === 'goal') { sols.add(`${rot},${x0},${t0}`); list.push(p); }
  }
  const robust = list.filter((p) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => sols.has(`${p.rot},${p.x0 + a},${p.t0 + b}`)));
  const base = simulate(L, []).end;
  // 時間のゆとり: 同じ横の位置・向きで、何秒ぶん続けて正解か（いちばん長いもの）
  let run = 0, runAt = '';
  for (const p of list) { let k = 0; while (sols.has(`${p.rot},${p.x0},${p.t0 + k}`)) k++; if (k > run) { run = k; runAt = `x${p.x0} t${p.t0}〜${p.t0 + k - 1}${p.rot ? ' 回す' : ''}`; } }
  return { n: list.length, robust: robust.length, run, runAt, base: base.type + '@' + base.t.toFixed(1), xs: [...new Set(list.map((p) => p.x0))].join(',') };
}
for (const L of variants) console.log(L.note || L.id, JSON.stringify(measure(L)));
