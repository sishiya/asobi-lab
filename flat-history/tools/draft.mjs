// 未確定（v096）の確かめ（開発用）: node tools/draft.mjs [図版のid…]
// 答えを でたらめに探し、「未確定の境」（形にふれて、歴史が形なしのときと分かれた秒）と、巣に着く秒を比べる。5 秒で消えきる
globalThis.TX = (ja) => ja;
const { LEVELS } = await import('../js/level.js');
const { simulate, restHeight, canPlaceQuick, pieceDims, DT } = await import('../js/sim.js');
const mk = (L, kind, rot, x0, t0) => { const p = { kind, rot, x0, t0 }; p.y0 = restHeight(L, p); return p; };
const same = (p, q) => !p === !q && (!p || (Math.abs(p.x - q.x) < 0.02 && Math.abs(p.y - q.y) < 0.02 && p.st === q.st));
function divergeT(a, b) {
  for (let k = 0; k < Math.min(a.frames.length, b.frames.length); k++) {
    const p = a.frames[k], q = b.frames[k];
    if (!same(p, q)) return k * DT;
    const po = p.others || [], qo = q.others || [], ps = p.stones || [], qs = q.stones || [];
    if (po.length !== qo.length || po.some((o, i) => !same(o, qo[i]))) return k * DT;
    if (ps.length !== qs.length || ps.some((o, i) => !same(o, qs[i]))) return k * DT;
  }
  return null;
}
const want = process.argv.slice(2), TRIES = Number(process.env.TRIES || 20000);
for (const L of LEVELS) {
  if (want.length && !want.includes(L.id)) continue;
  const kinds = Object.entries(L.stock).flatMap(([k, n]) => Array(n).fill(k));
  let n = 0, hidden = 0; const gaps = [];
  for (let i = 0; i < TRIES && n < 200; i++) {
    const ps = [];
    for (const k of kinds) {
      if (Math.random() < 0.25 && kinds.length > 1) continue;
      const rot = pieceDims({ kind: k, rot: 0 }).noRot ? 0 : Math.random() < 0.5 ? 0 : 1;
      ps.push(mk(L, k, rot, Math.floor(Math.random() * L.W), Math.floor(Math.random() * L.T)));
    }
    if (!ps.length || ps.some((p, j) => canPlaceQuick(L, p, ps.slice(0, j)))) continue;
    const h = simulate(L, ps);
    if (h.overlap || h.end.type !== 'goal') continue;
    const worst = divergeT(simulate(L, []), h);
    n++; gaps.push(h.end.t - worst); if (h.end.t > worst) hidden++;
  }
  gaps.sort((a, b) => a - b);
  console.log(`${L.id} ${L.plate} ${L.name}: 答え${n} ／ 巣に着くのが未確定の中 ${n ? Math.round(hidden / n * 100) : '-'}% ／ 消えきった中 ${n ? Math.round(gaps.filter((g) => g >= 5).length / n * 100) : '-'}% ／ 着く秒−境 最小${gaps.length ? gaps[0].toFixed(1) : '-'} 中${gaps.length ? gaps[gaps.length >> 1].toFixed(1) : '-'}`);
}
