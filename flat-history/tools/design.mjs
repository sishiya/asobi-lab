// 新しい図版の案を確かめる（開発用）: node tools/design.mjs 案のファイル.mjs [id…]
// 案のファイルは、図版の配列を export default する（level.js の LEVELS と同じ書き方。tops は [列の高さ×36] で書く）。
// 見るもの: (1) 形なしでは正史にならない (2) 形を1つ抜くと解けない（どの形もいる）＝形1つだけのときは総当たり
//          (3) 答えの数と、いちばんゆとりのある答え（形ごとの秒・マスのゆとり。目安は秒4以上） (4) 巣に着く秒（T を決める）
globalThis.TX = (ja) => ja;
const { simulate, restHeight, canPlaceQuick, pieceDims } = await import('../js/sim.js');
const { pathToFileURL } = await import('node:url');
const path = await import('node:path');
const all = (await import(pathToFileURL(path.resolve(process.argv[2])).href)).default;
const want = process.argv.slice(3), TRIES = Number(process.env.TRIES || 30000);

const mk = (L, kind, rot, x0, t0) => { const p = { kind, rot, x0, t0 }; p.y0 = restHeight(L, p); return p; };
const rots = (k) => (pieceDims({ kind: k, rot: 0 }).noRot ? [0] : [0, 1]);
function ok(L, ps) {
  for (let i = 0; i < ps.length; i++) if (canPlaceQuick(L, ps[i], ps.slice(0, i))) return false;
  const h = simulate(L, ps);
  return !h.overlap && h.end.type === 'goal';
}
// 形1つで置ける所すべて
function spots(L, k) {
  const out = [];
  for (const rot of rots(k)) for (let x0 = 0; x0 < L.W; x0++) for (let t0 = 0; t0 <= L.T; t0++) {
    const p = mk(L, k, rot, x0, t0);
    if (!canPlaceQuick(L, p, [])) out.push(p);
  }
  return out;
}
function slackOf(L, ps) {
  return ps.map((p, i) => {
    const at = (dx, dt) => ok(L, ps.map((o, j) => (j === i ? mk(L, o.kind, o.rot, o.x0 + dx, o.t0 + dt) : o)));
    let a = 0, b = 0; while (a > -30 && at(0, a - 1)) a--; while (b < 30 && at(0, b + 1)) b++;
    let c = 0, d = 0; while (c > -30 && at(c - 1, 0)) c--; while (d < 30 && at(d + 1, 0)) d++;
    return { t: b - a + 1, x: d - c + 1 };
  });
}
const fmt = (L, ps, sl) => ps.map((p, i) => `${p.kind}${p.rot ? '(回す)' : ''} x${p.x0} t${p.t0}` + (sl ? ` 秒${sl[i].t}・マス${sl[i].x}` : '')).join(' ／ ');

for (const L of all) {
  if (want.length && !want.includes(L.id)) continue;
  const kinds = Object.entries(L.stock).flatMap(([k, n]) => Array(n).fill(k));
  const base = simulate(L, []).end;
  const line = [`${L.id} ${L.name}: 形なし ${base.type}@${base.t.toFixed(1)}`];
  // 形を1つだけ使って解けるか（形が2つ以上の図版では、解けてはいけない）
  const solo = {};
  for (const k of new Set(kinds)) { let n = 0; for (const p of spots(L, k)) if (ok(L, [p])) n++; solo[k] = n; }
  line.push('1つだけで解ける数 ' + Object.entries(solo).map(([k, n]) => `${k}:${n}`).join(' '));
  let found = 0, best = null, bestScore = -1;
  const goals = [];
  if (kinds.length === 1) {
    for (const p of spots(L, kinds[0])) if (ok(L, [p])) { found++; goals.push(simulate(L, [p]).end.t); const sl = slackOf(L, [p]), sc = sl[0].t * 10 + sl[0].x; if (sc > bestScore) { bestScore = sc; best = { ps: [p], sl }; } }
  } else {
    const seen = new Set();
    for (let n = 0; n < TRIES; n++) {
      const ps = kinds.map((k) => { const r = L.search?.[k] || {}; const rr = rots(k); return mk(L, k, r.rot ?? rr[Math.floor(Math.random() * rr.length)], r.x ? r.x[0] + Math.floor(Math.random() * (r.x[1] - r.x[0] + 1)) : Math.floor(Math.random() * L.W), r.t ? r.t[0] + Math.floor(Math.random() * (r.t[1] - r.t[0] + 1)) : Math.floor(Math.random() * L.T)); });
      const key = fmt(L, ps); if (seen.has(key)) continue; seen.add(key);
      if (!ok(L, ps)) continue;
      found++; goals.push(simulate(L, ps).end.t);
      if (found > 400 && Math.random() > 0.05) continue; // ゆとりを測るのは重いので、見つかった数が多いときは間引く
      const sl = slackOf(L, ps), sc = Math.min(...sl.map((s) => s.t)) * 10 + Math.min(...sl.map((s) => s.x));
      if (sc > bestScore) { bestScore = sc; best = { ps, sl }; }
    }
  }
  goals.sort((a, b) => a - b);
  line.push(`答え ${found}`);
  if (goals.length) line.push(`着く秒 ${goals[0].toFixed(1)}〜${goals[goals.length - 1].toFixed(1)}（T ${L.T}）`);
  console.log(line.join('・'));
  if (best) console.log('   いちばんゆとりのある答え: ' + fmt(L, best.ps, best.sl));
}
