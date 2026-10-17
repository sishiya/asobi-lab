// 図版ごとに、答えで巣に着く秒を測る（開発用）: node tools/span.mjs
// 形の置き場所をでたらめに試し、巣に着いた答えの「着いた秒」と「形のいちばん奥の秒」を集める。T（ページの数）を決めるのに使う
globalThis.TX = (ja) => ja;
const { LEVELS } = await import('../js/level.js');
const { simulate, restHeight, canPlaceQuick, pieceDims } = await import('../js/sim.js');
const mk = (L, kind, rot, x0, t0) => { const p = { kind, rot, x0, t0 }; p.y0 = restHeight(L, p); return p; };
const want = process.argv.slice(2), TRIES = Number(process.env.TRIES || 40000);
for (const L0 of LEVELS) {
  if (want.length && !want.includes(L0.id)) continue;
  const L = { ...L0, T: 60 };
  const base = simulate(L, []);
  const kinds = Object.entries(L.stock).flatMap(([k, n]) => Array(n).fill(k));
  const goals = [], ends = [];
  for (let n = 0; n < TRIES; n++) {
    const ps = [];
    for (const k of kinds) {
      if (Math.random() < 0.25 && kinds.length > 1) continue;
      const rot = pieceDims({ kind: k, rot: 0 }).noRot ? 0 : Math.random() < 0.5 ? 0 : 1;
      ps.push(mk(L, k, rot, Math.floor(Math.random() * L.W), Math.floor(Math.random() * 55)));
    }
    if (!ps.length || ps.some((p, i) => canPlaceQuick(L, p, ps.slice(0, i)))) continue;
    const h = simulate(L, ps);
    if (h.overlap || h.end.type !== 'goal') continue;
    goals.push(h.end.t); ends.push(Math.max(...ps.map((p) => p.t0 + pieceDims(p).dz)));
  }
  goals.sort((a, b) => a - b); ends.sort((a, b) => a - b);
  const q = (a, f) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * f))].toFixed(1) : '-';
  console.log(`${L.id} ${L.plate} ${L.name}: いまのT ${L0.T} ／ 形なし ${base.end.type} ${base.end.t.toFixed(1)}秒 ／ 答え ${goals.length}件 着く秒 最小${q(goals, 0)} 中${q(goals, 0.5)} 9割${q(goals, 0.9)} 最大${q(goals, 0.999)} ／ 形の奥 中${q(ends, 0.5)} 9割${q(ends, 0.9)}`);
}
