// 恐竜かけっこ牧場を、ヒントどおりに遊ぶ人のつもりで最初から最後まで遊ぶ。
// node bot.js <seed>  → JSON の行で、お題ごとの手数・かかった時間（計算と操作）を出す
const L = require('./lib');
const SEED = +(process.argv[2] || 1);
const rng = L.makeRng(SEED * 7919 + 13);
const SEC_PER_STEP = +(process.env.SPS || 118e-6); // calib.js で測った 1 恐竜×1ステップ
const BUDGET = +(process.env.BUDGET || 60);        // 1つのお題にかける手（かけ合わせ・練習・おまかせ）の上限

// ---- 時間の見積もり（秒）----
const T = {cupOpen: 12, breed: 20, hatchAnim: 3, train: 6, evolve: 12, raceUi: 10, count: 1.8, start: 60, ending: 60};
const time = {compute: 0, ui: 0, race: 0};
function compute(fn) { const s0 = L.cost.steps; const r = fn(); time.compute += (L.cost.steps - s0) * SEC_PER_STEP; return r; }

// ---- 牧場 ----
let serial = 1;
const pool = [];
const medals = {};
const M = x => L.bodyPlan(x.g).M;
function measure(list) { const res = compute(() => L.measureRobust(list.map(x => x.g))); list.forEach((x, i) => { x.rec = res[i]; }); }
function founder(sp) { return {id: 's-' + sp.id, sp: sp.id, g: {...sp.body, ...sp.gait, from: sp.id}, gen: 0, rec: null}; }
for (const sp of L.SPECIES.filter(s => !s.joins)) pool.push(founder(sp));
measure(pool);
const tierDone = t => L.CUPS.filter(c => c.tier === t).every(c => medals[c.id]);
const tierOpen = t => t <= 1 || tierDone(t - 1);
let joined = false;
function giveJoiners() { if (!joined && tierOpen(2)) { joined = true; const x = founder(L.SPECIES.find(s => s.id === 'struthio')); measure([x]); pool.push(x); } }

// ---- お題の条件 ----
const RIVAL_T = {};
for (const id of ['trex', 'raptor']) RIVAL_T[id] = L.measureRobust([{...L.SPECIES.find(s => s.id === id).body, ...L.SPECIES.find(s => s.id === id).gait}])[0].finishT;
const TINY_M = +(process.env.TINY_M || 3), STOP = process.env.STOP || '';
if (process.env.OST_T) L.CUPS.find(c => c.id === 'ostrich').target = +process.env.OST_T;
if (process.env.TINY_T) L.CUPS.find(c => c.id === 'tiny').target = +process.env.TINY_T;
function massRange(c) { return {tiny: [0, TINY_M], medium: [50, 500], heavy: [500, Infinity], giant: [5000, Infinity]}[c.id] || [0, Infinity]; }
function targetT(c) { return c.target ?? (c.rivals ? Math.min(...c.rivals.map(r => RIVAL_T[r])) : Infinity); }
function eligible(c, x) { if (!c.starterOk && !x.gen) return false; const [lo, hi] = massRange(c), m = M(x); return m >= lo && m <= hi; }
function inRange(c, x) { const [lo, hi] = massRange(c), m = M(x); return m >= lo && m <= hi; }
// 見積もりの勝つ見こみ（カードの「10回中◯回」と幅から、人が読むように）
function pEst(c, x) {
  const r = x.rec; if (!r) return 0;
  const tt = targetT(c);
  if (c.steady) return r.finishT != null && r.finishT < tt ? 1 : 0;
  const {ok, n, lo, hi} = r.rb;
  if (!ok || lo == null || lo >= tt) return 0;
  // 幅の上の端はまれな崩れ（調子のずれの多くは lo の近く）。人は「ふだんのタイムが目標より速い・たいていゴール」なら出てみる
  if (r.finishT == null || r.finishT >= tt) return hi < tt ? ok / n : 0;
  const frac = hi < tt ? 1 : Math.min(1, Math.max(0.3, (tt - lo) / Math.max(0.3, 0.5 * (hi - lo))));
  return (ok / n) * frac;
}
// お題に向いた順（範囲の中で速い順）
function cupKey(c, x) {
  const r = x.rec; if (!r) return 1e9;
  let k = r.finishT != null ? r.finishT : 100 + (100 - r.dist);
  if (!inRange(c, x)) { const [lo, hi] = massRange(c), m = M(x); k += 1000 * Math.abs(Math.log(m < lo ? lo / m : m / hi)); }
  if (r.rb) k -= 0.05 * r.rb.ok;
  return k;
}
function race(c, x) {
  const g = c.steady ? x.g : L.jitter(x.g, (rng() * 1e9) | 0);
  const r = compute(() => L.evaluate([g]))[0];
  const rivals = (c.rivals || []).map(id => RIVAL_T[id]);
  const end = Math.max(r.finishT ?? r.fellT ?? L.LIMIT, ...rivals, ...(c.ghosts || []).map(k => L.REFS[k].t));
  time.race += Math.min(end, L.LIMIT) + T.count; time.ui += T.raceUi;
  const ft = r.finishT;
  const won = ft != null && ft < targetT(c);
  return {won, t: ft, fell: r.fell};
}

// ---- 育てる手 ----
function rbScore(x) { return x.rec && x.rec.rb ? x.rec.rb.ok * 100 - (x.rec.finishT ?? 99) : -1; }
function breed(a, b, src) {
  const kids = [];
  for (let i = 0; i < 3; i++) kids.push({id: 'c' + serial++, sp: a.sp === b.sp ? a.sp : 'mix', g: L.mutate(L.crossover(a.g, b.g, rng, src.g), rng, {rate: 0.3}), gen: Math.max(a.gen, b.gen) + 1, rec: null});
  measure(kids);
  time.ui += T.breed + T.hatchAnim;
  pool.push(...kids);
  return kids;
}
function practice(x) {
  const P = L.makePop([x.g], {size: 10, seed: (rng() * 1e9) | 0, bodyLock: true});
  let best = null;
  compute(() => { for (let i = 0; i < 6; i++) { const h = L.stepGeneration(P); if (!best || h.best > best.score) best = {score: h.best, g: h.bestG, res: h.bestRes}; } });
  x.practiced = (x.practiced || 0) + 1;
  time.ui += T.train;
  if (!x.rec || best.score > L.scoreOf(x.rec) + 0.5) { x.g = best.g; measure([x]); x.plateau = false; return true; }
  x.plateau = true; return false;
}
function evolve(x, gens, body) {
  const P = L.makePop([x.g], {size: 24, seed: (rng() * 1e9) | 0, bodyLock: !body});
  let best = null;
  compute(() => { for (let i = 0; i < gens; i++) { const h = L.stepGeneration(P); if (!best || h.best > best.score) best = {score: h.best, g: h.bestG}; } });
  const k = {id: 'e' + serial++, sp: x.sp, g: best.g, gen: x.gen + gens, rec: null};
  measure([k]); pool.push(k);
  time.ui += T.evolve + T.hatchAnim;
  return k;
}
// 牧場の広さ（8 ＋ メダル）。いちばん役に立たない子から逃がす（はじめの恐竜は残す）
function prune() {
  const slots = 8 + Object.keys(medals).length;
  // 生まれた子の欄に一時的に置けるので、牧場＋3匹まで
  while (pool.length > slots + 3) {
    const open = L.CUPS.filter(c => tierOpen(c.tier));
    const value = x => x.gen === 0 ? 1e9 : Math.max(...open.map(c => (medals[c.id] ? 0.2 : 1) * (inRange(c, x) ? 1 : 0.1) / Math.max(1, cupKey(c, x))));
    pool.sort((a, b) => value(b) - value(a));
    pool.pop();
  }
}

// お題ごとの、ヒントに沿った親の組
function parentsFor(c) {
  const sp = id => pool.find(x => x.id === 's-' + id);
  const byKey = list => [...list].sort((a, b) => cupKey(c, a) - cupKey(c, b));
  if (c.id === 'debut') return [sp('raptor'), sp('compy')];
  if (c.id === 'heavy') { // ストルティオ×ティラノ（ヒント）。範囲に入った子ができたら、それどうしも
    const inr = byKey(pool.filter(x => inRange(c, x) && x.gen > 0 && x.rec.finishT != null));
    if (inr.length >= 2 && rng() < 0.5) return [inr[0], inr[1]];
    return [inr[0] || sp('trex'), sp('struthio')];
  }
  if (c.id === 'medium') {
    const inr = byKey(pool.filter(x => inRange(c, x) && x.rec.finishT != null));
    if (inr.length >= 2) return [inr[0], inr[1]];
    return [sp('struthio'), sp('raptor')];
  }
  const fin = byKey(pool.filter(x => x.rec && x.rec.finishT != null && inRange(c, x)));
  if (fin.length >= 2) return [fin[0], fin[1]];
  const all = byKey(pool.filter(x => x.rec));
  return [all[0], all[1]];
}

function playCup(c) {
  const log = {id: c.id, breeds: 0, trains: 0, evolves: 0, races: 0, t0: {...time}};
  time.ui += T.cupOpen;
  let acts = 0, breedFlip = 0;
  const tried = new Map(); // id → 出た回数
  while (true) {
    // 出られる子のうち、見こみがいちばんの子で出る
    const cands = pool.filter(x => eligible(c, x)).map(x => ({x, p: pEst(c, x) / (1 + 0.5 * (tried.get(x.id) || 0))})).sort((a, b) => b.p - a.p);
    if (cands.length && cands[0].p >= 0.2) {
      const x = cands[0].x; tried.set(x.id, (tried.get(x.id) || 0) + 1);
      log.races++;
      const r = race(c, x);
      if (r.won) { medals[c.id] = {t: r.t}; log.win = {t: r.t, M: M(x), gen: x.gen}; break; }
      continue;
    }
    const spent = (time.compute - log.t0.compute) + (time.ui - log.t0.ui) + (time.race - log.t0.race);
    if (acts >= BUDGET || spent > 45 * 60) { log.stuck = true; break; } // 1つのお題に45分（遊ぶ人ならあきらめる長さ）
    acts++;
    // 手を選ぶ: 範囲に入った速い子がいれば練習、練習しきったらおまかせ、ほかはかけ合わせ
    const near = pool.filter(x => inRange(c, x) && x.gen > 0 && !x.plateau && (x.practiced || 0) < 4 && x.rec).sort((a, b) => cupKey(c, a) - cupKey(c, b));
    const top = near[0];
    const bodyOk = tierOpen(3);
    if (c.id === 'debut' || c.id === 'trex' || c.id === 'elephant') {
      if (top && top.rec.finishT == null && log.breeds >= 2) { practice(top); log.trains++; }
      else { const [a, b] = parentsFor(c); breed(a, b, rbScore(a) >= rbScore(b) ? a : b); log.breeds++; }
    } else if ((c.id === 'medium' || c.id === 'giant') && !pool.some(x => inRange(c, x) && x.gen > 0)) {
      // 出られる子がいない: その重さの子を作る（おまかせで走り方だけ。体は変わらない）
      const base = pool.filter(x => inRange(c, x)).sort((a, b) => cupKey(c, a) - cupKey(c, b))[0];
      if (base) { evolve(base, 5, false); log.evolves++; }
      else { const [a, b] = parentsFor(c); breed(a, b, b); log.breeds++; }
    } else if ((c.id === 'raptor' || c.id === 'ostrich') && bodyOk) {
      // ヒント: いちばん速い子を体ごとのおまかせ 30世代。できた子を1回練習
      const fresh = pool.filter(x => x.fromEvo30 && !x.practiced)[0];
      if (fresh) { practice(fresh); log.trains++; }
      else { const base = pool.filter(x => x.rec.finishT != null).sort((a, b) => a.rec.finishT - b.rec.finishT)[0]; const k = evolve(base, 30, true); k.fromEvo30 = true; log.evolves++; }
    } else if (top && (top.practiced || 0) < 2 && cupKey(c, top) < targetT(c) * 1.25) { practice(top); log.trains++; }
    else if (acts % 4 === 0 && pool.some(x => inRange(c, x) && x.rec.finishT != null)) {
      const base = pool.filter(x => inRange(c, x) && x.rec.finishT != null).sort((a, b) => cupKey(c, a) - cupKey(c, b))[0];
      evolve(base, 10, bodyOk && c.id !== 'giant'); log.evolves++;
    } else {
      const [a, b] = parentsFor(c);
      let src = rbScore(a) >= rbScore(b) ? a : b; // シートのおすすめ
      if (c.id === 'heavy') src = b.sp === 'struthio' ? b : a; // ヒント: ストルティオの走り方
      if (breedFlip++ % 3 === 2) src = src === a ? b : a; // ときどきもう一方
      breed(a, b, src); log.breeds++;
    }
    prune();
  }
  log.top = pool.filter(x => eligible(c, x) && x.rec.finishT != null).sort((a, b) => a.rec.finishT - b.rec.finishT).slice(0, 4).map(x => `${x.rec.finishT.toFixed(2)} ${x.rec.rb.ok}/10 ${x.rec.rb.lo?.toFixed(2)}-${x.rec.rb.hi?.toFixed(2)} ${M(x).toFixed(1)}kg`);
  log.time = {compute: time.compute - log.t0.compute, ui: time.ui - log.t0.ui, race: time.race - log.t0.race};
  delete log.t0;
  return log;
}

time.ui += T.start;
if (process.env.GIANT_T) L.CUPS.find(c => c.id === 'giant').target = +process.env.GIANT_T;
if (process.env.ONLY) for (const c of L.CUPS) if (c.id !== process.env.ONLY) medals[c.id] = {t: 0};
const out = [];
for (let guard = 0; guard < 20; guard++) {
  giveJoiners();
  const c = L.CUPS.find(c => !medals[c.id] && tierOpen(c.tier));
  if (!c) break;
  const log = playCup(c);
  out.push(log);
  process.stderr.write(`[${SEED}] ${c.id} ${log.stuck ? 'STUCK' : 'ok'} b${log.breeds} t${log.trains} e${log.evolves} r${log.races} ${(log.time.compute + log.time.ui + log.time.race).toFixed(0)}s\n`);
  if (log.stuck || c.id === STOP) break;
}
time.ui += T.ending;
console.log(JSON.stringify({seed: SEED, cleared: Object.keys(medals).length, total: time, cups: out}));
