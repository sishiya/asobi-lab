// 答えのまわりの「ゆとり」を測る（開発用）: node tools/slack.mjs
// 正しい考え方にたどり着いたあと、それぞれの形を何秒・何マスずらしても正史のままか（ほかの形はそのまま）。
// 答えが分からない図版は、形の置き場所をでたらめに試して答えをさがす（見つかった答えのうち、いちばんゆとりのあるものを出す）。
globalThis.TX = (ja) => ja;
const { LEVELS } = await import('../js/level.js');
const { simulate, restHeight, canPlaceQuick, pieceDims } = await import('../js/sim.js');

const mk = (L, kind, rot, x0, t0) => { const p = { kind, rot, x0, t0 }; p.y0 = restHeight(L, p); return p; };
function ok(L, ps) {
  for (let i = 0; i < ps.length; i++) if (canPlaceQuick(L, ps[i], ps.slice(0, i))) return false;
  const h = simulate(L, ps);
  return !h.overlap && h.end.type === 'goal';
}
// 1つの形をずらしたとき、正史のままでいられる秒の幅・マスの幅（いまの所をふくむ、つながった幅）
function slackOf(L, ps) {
  return ps.map((p, i) => {
    const at = (dx, dt) => ok(L, ps.map((o, j) => (j === i ? mk(L, o.kind, o.rot, o.x0 + dx, o.t0 + dt) : o)));
    let a = 0, b = 0; while (a > -30 && at(0, a - 1)) a--; while (b < 30 && at(0, b + 1)) b++;
    let c = 0, d = 0; while (c > -30 && at(c - 1, 0)) c--; while (d < 30 && at(d + 1, 0)) d++;
    return { kind: p.kind, t: b - a + 1, x: d - c + 1 };
  });
}
function search(L, tries) {
  const kinds = Object.entries(L.stock).flatMap(([k, n]) => Array(n).fill(k));
  let best = null, bestScore = -1;
  for (let n = 0; n < tries; n++) {
    // 使う形をえらぶ（使わない形があってもよい）
    const ps = [];
    for (const k of kinds) {
      if (Math.random() < 0.25 && kinds.length > 1) continue;
      const rot = pieceDims({ kind: k, rot: 0 }).noRot ? 0 : Math.random() < 0.5 ? 0 : 1;
      ps.push(mk(L, k, rot, Math.floor(Math.random() * L.W), Math.floor(Math.random() * 40)));
    }
    if (!ps.length || !ok(L, ps)) continue;
    const sl = slackOf(L, ps), score = Math.min(...sl.map((s) => s.t));
    if (score > bestScore) { bestScore = score; best = { ps, sl }; }
  }
  return best;
}
const known = {
  s2: (L) => [mk(L, 'wall', 0, 16, 0), mk(L, 'lift', 0, 7, 2)],
};
const want = process.argv.slice(2);
for (const L of LEVELS) {
  if (want.length && !want.includes(L.id)) continue;
  let r;
  if (known[L.id] && ok(L, known[L.id](L))) { const ps = known[L.id](L); r = { ps, sl: slackOf(L, ps) }; }
  else r = search(L, Number(process.env.TRIES || 60000));
  if (!r) { console.log(L.id, L.plate, L.name, '答えが見つからない'); continue; }
  console.log(`${L.id} ${L.plate} ${L.name}:`, r.ps.map((p, i) => `${p.kind}${p.rot ? '(回す)' : ''} x${p.x0} t${p.t0} → 秒のゆとり ${r.sl[i].t}・マスのゆとり ${r.sl[i].x}`).join(' ／ '));
}
