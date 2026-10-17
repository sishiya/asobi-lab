// 形が2つ以上の図版の案を試す（開発用）: node tools/tune2.mjs 案のファイル.mjs
// 案のファイルは、図版の配列を export default する。図版に search: { 形: { x: [a, b], t: [a, b] } } を書くと、その範囲で答えをさがす。
// 出すもの: 見つかった答えの数・いちばんゆとりのある答え（形ごとの、秒のゆとり・マスのゆとり）
globalThis.TX = (ja) => ja;
const { simulate, restHeight, canPlaceQuick, pieceDims } = await import('../js/sim.js');
const { pathToFileURL } = await import('node:url');
const path = await import('node:path');
const variants = (await import(pathToFileURL(path.resolve(process.argv[2])).href)).default;
const TRIES = Number(process.env.TRIES || 20000);

const mk = (L, kind, rot, x0, t0) => { const p = { kind, rot, x0, t0 }; p.y0 = restHeight(L, p); return p; };
function ok(L, ps) {
  for (let i = 0; i < ps.length; i++) if (canPlaceQuick(L, ps[i], ps.slice(0, i))) return false;
  const h = simulate(L, ps);
  return !h.overlap && h.end.type === 'goal';
}
function slackOf(L, ps) {
  return ps.map((p, i) => {
    const at = (dx, dt) => ok(L, ps.map((o, j) => (j === i ? mk(L, o.kind, o.rot, o.x0 + dx, o.t0 + dt) : o)));
    let a = 0, b = 0; while (a > -30 && at(0, a - 1)) a--; while (b < 30 && at(0, b + 1)) b++;
    let c = 0, d = 0; while (c > -30 && at(c - 1, 0)) c--; while (d < 30 && at(d + 1, 0)) d++;
    return { t: b - a + 1, x: d - c + 1 };
  });
}
const ri = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));
for (const L of variants) {
  const kinds = Object.entries(L.stock).flatMap(([k, n]) => Array(n).fill(k));
  let found = 0, best = null, bestScore = -1;
  const seen = new Set();
  for (let n = 0; n < TRIES; n++) {
    const ps = [];
    for (const k of kinds) {
      const r = L.search?.[k] || { x: [0, L.W - 1], t: [0, 40] };
      if (r.optional && Math.random() < 0.3) continue;
      const rot = r.rot != null ? r.rot : pieceDims({ kind: k, rot: 0 }).noRot ? 0 : Math.random() < 0.5 ? 0 : 1;
      ps.push(mk(L, k, rot, ri(r.x), ri(r.t)));
    }
    const key = ps.map((p) => `${p.kind}${p.rot}@${p.x0},${p.t0}`).join(' ');
    if (seen.has(key)) continue; seen.add(key);
    if (!ps.length || !ok(L, ps)) continue;
    found++;
    const sl = slackOf(L, ps), score = Math.min(...sl.map((s) => s.t)) * 10 + Math.min(...sl.map((s) => s.x));
    if (score > bestScore) { bestScore = score; best = { ps, sl }; }
  }
  const base = simulate(L, []).end;
  console.log(`${L.note || L.id}: はじめ ${base.type}@${base.t.toFixed(1)}・答え ${found}`, best ? best.ps.map((p, i) => `${p.kind}${p.rot ? '(回す)' : ''} x${p.x0} t${p.t0} 秒${best.sl[i].t}・マス${best.sl[i].x}`).join(' ／ ') : '');
}
