'use strict';
// 生き物: 大地の上（角度 th）に住む。遺伝子は 0〜1 の4つ。
//   dry  乾きに強い（水から出ても干からびにくい）
//   legs 陸を歩く（陸で速く動ける。ただし泳ぎは少しおそくなる）
//   land 陸へ出たがる（水ぎわで、陸へ出てみるか引き返すか）
//   jaw  アゴのかたさ（陸の草のかたさに合うほどよく食べられる。草のかたさは土地ごとにちがう）
// 体を作るのにエネルギーがかかるので、海の中だけで暮らすなら dry・legs は低いほうが得（トレードオフ）。
// 潮が引くと浜に取り残され、乾きに強いもの・陸を歩けるものだけが生き残る（潮だまり説をゲームにしたもの）。
// 子を残すときは、近くにいる「似た」相手と遺伝子を半分ずつ合わせる。似ていない相手とは子を残せない。
// 似たものの集まりを「種」とよぶ。海や浅瀬で隔てられ、ちがう草に合わせていくと、別の種に分かれる。

const GENES = [
  { k: 'dry',  name: '乾きに強い' },
  { k: 'legs', name: '陸を歩く' },
  { k: 'land', name: '陸へ出たがる' },
  { k: 'jaw',  name: 'アゴのかたさ' },
];
const POP_MAX = 420;
const MATE_D = 0.3;                 // これより似ていれば子を残せる
const MERGE_D = 0.12;               // 種どうしがこれより近づいたら、ひとつに混ざる
const isLander = c => c.dry >= 0.75 && c.legs >= 0.5;      // 「陸の生き物」
const traitDist = (a, b) => Math.hypot(a.jaw - b.jaw, 0.7 * (a.dry - b.dry), 0.7 * (a.legs - b.legs));
const SP_COLORS = ['#7d9aa6', '#a0783e', '#6f8f4e', '#a35f50', '#7a6a9a', '#4f8a86', '#b08a3a', '#8a5a7a', '#5a6f9a', '#8f8f50'];

function makeLife(Wd, n) {
  const L = { list: [], nextId: 1, deaths: { wave: 0, dry: 0, hunger: 0, old: 0, heat: 0, cold: 0 }, maxGen: 1,
    species: [], nextSp: 1, events: [], meets: 0, spT: 0 };
  const r = Wd.rand;
  // はじめは東の大陸の浜（10度あたり）と、島と西の大陸のあいだの浅瀬（205度あたり）の海に
  for (let k = 0; k < n; k++) {
    const base = k % 2 ? 6 : 200;
    const th = (base + r() * 10) * Math.PI / 180;
    L.list.push(newCreature(L, Wd, th, {
      dry: 0.03 + r() * 0.06, legs: 0.02 + r() * 0.06, land: 0.15 + r() * 0.2, jaw: 0.4 + r() * 0.2,
    }, 1, r() * 30));
  }
  const first = addSpecies(L, { dry: 0.06, legs: 0.05, jaw: 0.5 }, 0);
  for (const c of L.list) c.sp = first.id;
  L.events.length = 0;
  return L;
}

function newCreature(L, Wd, th, genes, gen, age) {
  const r = Wd.rand;
  return {
    id: L.nextId++, th, dir: r() < 0.5 ? -1 : 1, e: 0.7 + r() * 0.3, m: 1, age: age || 0,
    life: 55 + r() * 30, gen, dry: genes.dry, legs: genes.legs, land: genes.land, jaw: genes.jaw,
    dead: 0, cause: '', hit: 0, bob: r() * TAU, lander: false, sp: 0, meetT: 0,
  };
}

function gauss(r) { return (r() + r() + r() - 1.5) * 1.15; }
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

// 近い水の向き・近い陸の向き（なければ 0）
function waterDir(Wd, i) {
  for (let k = 1; k < 60; k++) {
    if (Wd.h[(i + k) % N] > WET) return 1;
    if (Wd.h[(i - k + N) % N] > WET) return -1;
  }
  return 0;
}
function dryDir(Wd, i) {
  for (let k = 1; k < 40; k++) {
    if (Wd.h[(i + k) % N] <= WET) return 1;
    if (Wd.h[(i - k + N) % N] <= WET) return -1;
  }
  return 0;
}

// 草を食べる: アゴが草のかたさに合うほど、たくさんとれる
const eatEff = (c, hard) => Math.max(0.15, 1 - 1.8 * Math.abs(c.jaw - hard));

function stepLife(Wd, L, dt) {
  const { g, h, sea, grass, hard } = Wd, r = Wd.rand;
  let alive = 0;
  for (const c of L.list) if (!c.dead) alive++;
  const born = [];
  for (const c of L.list) {
    if (c.dead) { c.dead += dt; continue; }
    const i = idx(c.th), wet = h[i] > WET;
    c.age += dt; c.bob += dt * 3;
    if (c.hit > 0) c.hit -= dt;
    if (c.meetT > 0) c.meetT -= dt;

    // 水の流れに運ばれ、速すぎる流れ（津波）にはもまれる
    const flow = wet ? flowAt(Wd, i) : 0;
    const rough = Math.abs(flow) - 90;
    if (rough > 0) { c.e -= rough * 0.03 * dt; c.hit = 0.4; if (c.e <= 0) { die(L, c, 'wave'); continue; } }

    // 暑さ・寒さ（40 度より上、0 度より下で弱る）。凍った水の中では動けない
    const temp = Wd.T[i];
    if (temp > 40) { c.e -= (temp - 40) * 0.02 * dt; if (c.e <= 0) { die(L, c, 'heat'); continue; } }
    if (temp < 0) { c.e -= -temp * 0.06 * dt; if (c.e <= 0) { die(L, c, 'cold'); continue; } }
    const frozen = Wd.ice[i];

    // うるおい: 水の中で満ち、陸で減る
    if (wet) c.m = Math.min(1, c.m + 1.2 * dt);
    else c.m -= dt * 0.32 * (1 - 0.95 * c.dry);

    // 向きを決める
    const jn = (i + c.dir + N) % N, walker = c.legs > 0.5 && c.dry > 0.6;
    if (wet) {
      if (walker && c.m > 0.95) {
        // 陸を歩くものは、水を飲んだら陸へもどる
        const d = dryDir(Wd, i); if (d) c.dir = d;
      } else if (h[jn] <= WET && !c.out) {
        // 水ぎわ: 陸へ出てみるか、引き返すか（1回だけ決める）
        if (r() < c.land * 0.7 && c.m > 0.8) c.out = true; else c.dir = -c.dir;
      } else if (r() < 0.12 * dt) c.dir = -c.dir;
      if (h[jn] > WET) c.out = false;
    } else {
      const thirst = 0.3 + 0.45 * (1 - c.land);
      if (c.m < thirst) { const d = waterDir(Wd, i); if (d) c.dir = d; }
      else {
        if (grass[i] < 0.15 && r() < 0.5 * dt + 0.02) c.dir = -c.dir;
        else if (r() < 0.08 * dt) c.dir = -c.dir;
        // 歩くものは、のどがかわいていなければ水へ入らない（浅瀬でも渡らない）
        if (walker && h[jn] > 2) c.dir = -c.dir;
      }
      // 崖は登れない（歩けるものほど高い段を登れる）
      if (g[jn] - g[i] > 2.5 + 10 * c.legs && h[jn] <= WET) c.dir = -c.dir;
    }

    // 動く（水の中では、歩くものほど泳ぎがおそい）
    const sp = wet ? 24 * (1 - 0.35 * c.legs) : 2 + 24 * c.legs;
    const eating = grass[i] > 0.3 && !wet ? 0.35 : 1;           // 草を食べているあいだはゆっくり
    if (!frozen) c.th = wrapA(c.th + (c.dir * sp * eating + flow * 0.85) * dt / R0);

    // 食べる
    let got = 0, want = 0.6 * dt;
    const eff = eatEff(c, hard[i]);
    if (wet) {
      const a = Math.min(sea[i], want); sea[i] -= a; got += a; want -= a;
      if (h[i] < 6 && want > 0) { const b = Math.min(grass[i], want); grass[i] -= b; got += b * eff; }
    } else { const b = Math.min(grass[i], want); grass[i] -= b; got += b * eff; }
    c.e = Math.min(2, c.e + got);
    c.e -= dt * (0.05 + 0.03 * c.legs + 0.015 * c.dry);

    if (c.m <= 0) { die(L, c, 'dry'); continue; }
    if (c.e <= 0) { die(L, c, 'hunger'); continue; }
    if (c.age > c.life) { die(L, c, 'old'); continue; }

    // 子を残す: 近くの似た相手と遺伝子を合わせる（いなければ自分だけで）。遺伝子は少しずれる
    if (c.e > 1.7 && c.age > 5 && alive + born.length < POP_MAX) {
      c.e -= 0.9;
      let mate = null, best = 14;
      for (const o of L.list) {
        if (o === c || o.dead) continue;
        const d = Math.abs(angDiff(o.th, c.th)) * R0;
        if (d < best && traitDist(c, o) < MATE_D) { best = d; mate = o; }
      }
      const pickG = k => clamp01((mate && r() < 0.5 ? mate[k] : c[k]) + gauss(r) * 0.1);
      const k = newCreature(L, Wd, c.th, { dry: pickG('dry'), legs: pickG('legs'), land: pickG('land'), jaw: pickG('jaw') },
        Math.max(c.gen, mate ? mate.gen : 0) + 1, 0);
      k.e = 0.6; k.m = c.m; k.sp = c.sp;
      born.push(k);
      if (k.gen > L.maxGen) L.maxGen = k.gen;
    }
    c.lander = isLander(c);
  }
  for (const k of born) { k.lander = isLander(k); L.list.push(k); }
  if (L.list.length > 40 && L.list.some(c => c.dead > 1.6)) L.list = L.list.filter(c => !c.dead || c.dead <= 1.6);
  L.spT -= dt;
  if (L.spT <= 0) { updateSpecies(L, Wd); countMeets(L, Wd); L.spT = 0.5; }
}

function die(L, c, cause) { c.dead = 0.0001; c.cause = cause; L.deaths[cause]++; }

// ---- 種 -----------------------------------------------------------------
// 子は親の種を受けつぐ（似ていれば、ちがう種の相手とも子を残せる。そうして混ざっていく）。
// ひとつの種の中が、はっきりちがう2つの集まり（遺伝子のまん中が 0.3 以上はなれ、それぞれ 8 匹以上）に
// 分かれたら、まん中からはずれたほうが新しい種になる。まん中が近く、同じあたりに住む種はひとつに混ざる。
const SPLIT_D = 0.3;

// 名前: アゴ（ヤワ・ナカ・カタ）＋ 体（ウオ・ハマ・アシ）。姿が変われば名前も変わる。
// 生きている種に同じ名前があれば、古いほうから「の一」「の二」…
function spBase(t) {
  const jaw = t.jaw < 0.33 ? 'ヤワ' : t.jaw < 0.66 ? 'ナカ' : 'カタ';
  const body = t.dry >= 0.7 && t.legs >= 0.45 ? 'アシ' : t.dry > 0.4 ? 'ハマ' : 'ウオ';
  return jaw + 'アゴ' + body;
}
function nameSpecies(L) {
  const al = L.species.filter(s => s.alive), cnt = {};
  for (const s of al) cnt[s.base] = (cnt[s.base] || 0) + 1;
  const k = {};
  for (const s of al) s.name = cnt[s.base] > 1 ? s.base + 'の' + '一二三四五六七八九'[Math.min(8, (k[s.base] = (k[s.base] || 0) + 1) - 1)] : s.base;
}

function addSpecies(L, t, day) {
  const base = spBase(t);
  const s = { id: L.nextSp++, base, name: base, c: { dry: t.dry, legs: t.legs, jaw: t.jaw },
    n: 0, landers: 0, alive: true, color: SP_COLORS[(L.nextSp - 2) % SP_COLORS.length], born: day, deg: 0 };
  L.species.push(s);
  nameSpecies(L);
  L.events.push({ type: 'new', sp: s });
  return s;
}

const meanOf = g => {
  const t = { dry: 0, legs: 0, jaw: 0 };
  for (const c of g) { t.dry += c.dry / g.length; t.legs += c.legs / g.length; t.jaw += c.jaw / g.length; }
  return t;
};
function summarize(s, m) {
  s.n = m.length; s.landers = m.filter(c => c.lander).length;
  if (!m.length) return;
  s.c = meanOf(m);
  s.base = spBase(s.c);
  let sx = 0, sy = 0;
  for (const c of m) { sx += Math.cos(c.th); sy += Math.sin(c.th); }
  s.deg = (wrapA(Math.atan2(sy, sx)) * 180 / Math.PI) | 0;
}
// 2つに分けてみる（遺伝子の上で、たがいに遠い2匹から始める k-means を3回）
function twoGroups(m) {
  const t = meanOf(m);
  let A = m[0], B = m[0];
  for (const c of m) if (traitDist(c, t) > traitDist(A, t)) A = c;
  for (const c of m) if (traitDist(c, A) > traitDist(B, A)) B = c;
  let ca = { dry: A.dry, legs: A.legs, jaw: A.jaw }, cb = { dry: B.dry, legs: B.legs, jaw: B.jaw }, ga = [], gb = [];
  for (let it = 0; it < 3; it++) {
    ga = []; gb = [];
    for (const c of m) (traitDist(c, ca) <= traitDist(c, cb) ? ga : gb).push(c);
    if (!ga.length || !gb.length) break;
    ca = meanOf(ga); cb = meanOf(gb);
  }
  return { ga, gb, ca, cb };
}

function updateSpecies(L, Wd) {
  const day = Math.floor(Wd.t / DAY) + 1;
  const by = new Map();
  for (const c of L.list) if (!c.dead) { if (!by.has(c.sp)) by.set(c.sp, []); by.get(c.sp).push(c); }
  for (const s of L.species.filter(x => x.alive)) {
    const m = by.get(s.id) || [];
    if (m.length >= 16) {
      const { ga, gb, ca, cb } = twoGroups(m);
      if (ga.length >= 8 && gb.length >= 8 && traitDist(ca, cb) >= SPLIT_D) {
        // 前のまん中に近いほうが元の種のまま
        const [keep, part, pc] = traitDist(ca, s.c) <= traitDist(cb, s.c) ? [ga, gb, cb] : [gb, ga, ca];
        const ns = addSpecies(L, pc, day);
        for (const c of part) c.sp = ns.id;
        summarize(ns, part);
        by.set(s.id, keep); by.set(ns.id, part);
      }
    }
    summarize(s, by.get(s.id) || []);
    if (!s.n) { s.alive = false; L.events.push({ type: 'gone', sp: s }); }
  }
  // まん中が近く（0.12 より近い）、同じあたり（30 度以内）に住む種はひとつに（数の多いほうに）
  const al = L.species.filter(s => s.alive);
  for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) {
    const A = al[i], B = al[j];
    if (!A.alive || !B.alive || traitDist(A.c, B.c) >= MERGE_D || Math.abs(angDiff(A.deg * Math.PI / 180, B.deg * Math.PI / 180)) > 0.52) continue;
    const [big, small] = A.n >= B.n ? [A, B] : [B, A];
    for (const c of L.list) if (c.sp === small.id) c.sp = big.id;
    big.n += small.n; big.landers += small.landers; small.n = 0; small.alive = false;
    L.events.push({ type: 'merge', sp: small, into: big });
  }
  nameSpecies(L);
}

// ちがう草に合わせた（アゴのかたさが 0.3 以上ちがう）陸の種どうしが、陸の上ですれちがった回数。
// 同じ陸で少しずつちがうだけの種は数えない。1匹ごとに 10 秒に1回まで
function countMeets(L, Wd) {
  const jaw = new Map(L.species.map(s => [s.id, s.c.jaw]));
  const land = L.list.filter(c => !c.dead && c.lander && Wd.h[idx(c.th)] <= WET);
  for (const a of land) {
    if (a.meetT > 0) continue;
    for (const b of land) {
      if (b.sp === a.sp || Math.abs(angDiff(a.th, b.th)) * R0 > 8) continue;
      if (Math.abs(jaw.get(a.sp) - jaw.get(b.sp)) < 0.3) continue;
      L.meets++; a.meetT = 10; b.meetT = Math.max(b.meetT, 10);
      L.events.push({ type: 'meet', a: a.sp, b: b.sp });
      break;
    }
  }
}

function lifeStats(L) {
  const s = { n: 0, landers: 0, avg: { dry: 0, legs: 0, land: 0, jaw: 0 } };
  for (const c of L.list) {
    if (c.dead) continue;
    s.n++; if (c.lander) s.landers++;
    for (const k in s.avg) s.avg[k] += c[k];
  }
  if (s.n) for (const k in s.avg) s.avg[k] /= s.n;
  const alive = L.species.filter(x => x.alive);
  s.species = alive.length;
  s.bigSpecies = alive.filter(x => x.n >= 10).length;
  s.landSpecies = alive.filter(x => x.n >= 10 && x.landers >= x.n / 2).length;
  s.meets = L.meets;
  return s;
}
