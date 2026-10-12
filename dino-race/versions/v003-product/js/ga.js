// おまかせの進化（遺伝的アルゴリズム）。牧場の外で集団を育て、いちばん速い子を連れて帰る。
// 点数 = 100m のかけっこ（走り方を少しずらした2回目もあわせて、悪いほう）。ゴールしたら 100 ＋ 速さ（m/秒 × 10）、転んだら進んだ距離 × (0.5〜1、早く転ぶほど小さい)、打ち切りなら進んだ距離。

function makePop(seedGenomes, {size = 24, seed = 1, bodyLock = false, rate = 1} = {}) {
  const rng = makeRng(seed);
  const members = [];
  for (let i = 0; i < size; i++) {
    const base = seedGenomes[i % seedGenomes.length];
    members.push({g: i < seedGenomes.length ? cloneGenome(base) : mutate(base, rng, {rate: 2, bodyLock}), score: null});
  }
  return {rng, members, gen: 0, history: [], bodyLock, rate, size};
}

function score1(r) {
  if (r.finishT != null) return FINISH + 10 * FINISH / r.finishT;
  return r.fell ? r.dist * (0.5 + 0.5 * Math.min(1, r.fellT / LIMIT)) : r.dist;
}
// 少しずらした走り（alt）もあれば、悪いほうの点
function scoreOf(r) { return r.alt ? Math.min(score1(r), score1(r.alt)) : score1(r); }

function evaluatePop(P) {
  const todo = P.members.filter(m => m.score === null);
  if (!todo.length) return;
  const res = evaluate(todo.map(m => m.g), {robust: true, seed: 1000 + P.gen * 7919});
  todo.forEach((m, i) => { m.res = res[i]; m.score = scoreOf(res[i]); });
}

function tournament(P, k = 3) {
  let best = null;
  for (let i = 0; i < k; i++) { const m = P.members[Math.floor(P.rng() * P.members.length)]; if (!best || m.score > best.score) best = m; }
  return best;
}

// 1世代すすめる: 評価 → 記録 → 上位を残して子を作る
function stepGeneration(P) {
  evaluatePop(P);
  P.members.sort((a, b) => b.score - a.score);
  const s = P.members.map(m => m.score);
  P.history.push({gen: P.gen, best: s[0], median: s[Math.floor(s.length / 2)], bestG: cloneGenome(P.members[0].g), bestRes: P.members[0].res});
  const elite = Math.max(2, Math.round(P.size * 0.15));
  const next = P.members.slice(0, elite).map(m => ({g: m.g, score: null})); // 上位も次の世代でずらし方を変えて採点し直す
  while (next.length < P.size) {
    const a = tournament(P), b = tournament(P);
    let g = P.rng() < 0.7 ? crossover(a.g, b.g, P.rng) : cloneGenome(a.g);
    g = mutate(g, P.rng, {rate: P.rate, bodyLock: P.bodyLock});
    next.push({g, score: null});
  }
  P.members = next;
  P.gen++;
  return P.history[P.history.length - 1];
}
