// 図版の「解の広さ」を測る（開発用。node tools/solve.mjs [図版のid…]）
// 形が1つの図版は、置ける所をすべて試す。2つ以上の図版は、形ごとに置ける所をしぼってから組み合わせを試す。
// 「ゆとり」: 解のうち、横に±1マス・奥行きに±1秒ずらしても解のままの数（ずれに強い解）
globalThis.TX = (ja) => ja;
const { LEVELS } = await import('../js/level.js');
const { simulate, restHeight, canPlaceQuick, pieceDims } = await import('../js/sim.js');

const want = process.argv.slice(2);
const key = (q) => q.map((p) => `${p.kind}${p.rot}@${p.x0},${p.t0}`).join(' ');

// 形1つぶんの、置ける所（ほかの形と重なるかは、組み合わせのときに見る）
function spots(L, kind) {
  const out = [];
  const rots = pieceDims({ kind, rot: 0 }).noRot ? [0] : [0, 1];
  for (const rot of rots) for (let x0 = 0; x0 < L.W; x0++) for (let t0 = 0; t0 <= L.T; t0++) {
    const p = { kind, rot, x0, t0 };
    p.y0 = restHeight(L, p);
    if (canPlaceQuick(L, p, [])) continue;
    out.push(p);
  }
  return out;
}
function ok(L, ps) {
  for (let i = 0; i < ps.length; i++) if (canPlaceQuick(L, ps[i], ps.slice(0, i))) return false;
  const h = simulate(L, ps);
  return !h.overlap && h.end.type === 'goal';
}

for (const L of LEVELS) {
  if (want.length && !want.includes(L.id)) continue;
  const kinds = Object.entries(L.stock).flatMap(([k, n]) => Array(n).fill(k));
  const sols = [];
  if (kinds.length === 1) {
    for (const p of spots(L, kinds[0])) if (ok(L, [p])) sols.push([p]);
  } else {
    // 組み合わせ: それぞれの形で、住人の歩みを変える所だけにしぼる（変えない所に置いても意味がない）。使わない形があってもよい（null）
    const sig = (h) => h.frames.map((f) => f.x.toFixed(2) + f.st).join('|');
    const baseSig = sig(simulate(L, []));
    const cand = kinds.map((k) => [null, ...spots(L, k).filter((p) => sig(simulate(L, [p])) !== baseSig)]);
    const rec = (i, acc) => {
      if (i === kinds.length) { if (acc.length && ok(L, acc)) sols.push([...acc]); return; }
      for (const p of cand[i]) rec(i + 1, p ? [...acc, p] : acc);
    };
    console.error(L.id, '候補', cand.map((c) => c.length));
    if (cand.reduce((a, c) => a * c.length, 1) > 4e6) { console.log(L.id, L.name, '組み合わせが多すぎる', cand.map((c) => c.length)); continue; }
    rec(0, []);
  }
  const set = new Set(sols.map(key));
  // ゆとり: どの形を ±1 ずらしても解のまま
  const robust = sols.filter((q) => q.every((p, i) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dt]) => {
    const r = q.map((o, j) => (j === i ? { ...o, x0: o.x0 + dx, t0: o.t0 + dt } : o));
    return set.has(key(r));
  })));
  // 時間のゆとり: ほかの形はそのままで、1つの形を何秒ぶん続けてずらしても解か（いちばん長いもの）
  let run = 0;
  for (const q of sols) q.forEach((p, i) => { let k = 0; while (set.has(key(q.map((o, j) => (j === i ? { ...o, t0: o.t0 + k } : o))))) k++; run = Math.max(run, k); });
  console.log(`${L.id} ${L.plate} ${L.name}: 解 ${sols.length}・ゆとりのある解 ${robust.length}・時間のゆとり ${run}秒`, sols.slice(0, 3).map(key).join(' / '));
}
