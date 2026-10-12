'use strict';
// 生き物: 大地の上（角度 th）に住む。遺伝子は 0〜1 の3つ。
//   dry  乾きに強い（水から出ても干からびにくい）
//   legs 陸を歩く（陸で速く動ける。ただし泳ぎは少しおそくなる）
//   land 陸へ出たがる（水ぎわで、陸へ出てみるか引き返すか）
// 体を作るのにエネルギーがかかるので、海の中だけで暮らすなら dry・legs は低いほうが得（トレードオフ）。
// 潮が引くと浜に取り残され、乾きに強いもの・陸を歩けるものだけが生き残る（潮だまり説をゲームにしたもの）。

const GENES = [
  { k: 'dry',  name: '乾きに強い' },
  { k: 'legs', name: '陸を歩く' },
  { k: 'land', name: '陸へ出たがる' },
];
const POP_MAX = 420;
const isLander = c => c.dry >= 0.75 && c.legs >= 0.5;      // 「陸の生き物」

function makeLife(Wd, n) {
  const L = { list: [], nextId: 1, deaths: { wave: 0, dry: 0, hunger: 0, old: 0 }, maxGen: 1, firstLander: 0 };
  const r = Wd.rand;
  // はじめは右下の浜（25度あたり）と左上の浜（230度あたり）の近くの海に
  for (let k = 0; k < n; k++) {
    const base = k % 2 ? 10 : 212;
    const th = (base + r() * 10) * Math.PI / 180;
    L.list.push(newCreature(L, Wd, th, {
      dry: 0.03 + r() * 0.06, legs: 0.02 + r() * 0.06, land: 0.15 + r() * 0.2,
    }, 1, r() * 30));
  }
  return L;
}

function newCreature(L, Wd, th, genes, gen, age) {
  const r = Wd.rand;
  return {
    id: L.nextId++, th, dir: r() < 0.5 ? -1 : 1, e: 0.7 + r() * 0.3, m: 1, age: age || 0,
    life: 55 + r() * 30, gen, dry: genes.dry, legs: genes.legs, land: genes.land,
    dead: 0, cause: '', hit: 0, bob: r() * TAU, lander: false,
  };
}

function gauss(r) { return (r() + r() + r() - 1.5) * 1.15; }
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

// 近い水の向き（なければ 0）
function waterDir(Wd, i) {
  for (let k = 1; k < 60; k++) {
    if (Wd.h[(i + k) % N] > WET) return 1;
    if (Wd.h[(i - k + N) % N] > WET) return -1;
  }
  return 0;
}

function stepLife(Wd, L, dt) {
  const { g, h, sea, grass } = Wd, r = Wd.rand;
  let alive = 0;
  for (const c of L.list) if (!c.dead) alive++;
  const born = [];
  for (const c of L.list) {
    if (c.dead) { c.dead += dt; continue; }
    const i = idx(c.th), wet = h[i] > WET;
    c.age += dt; c.bob += dt * 3;
    if (c.hit > 0) c.hit -= dt;

    // 水の流れに運ばれ、速すぎる流れ（津波）にはもまれる
    const flow = wet ? flowAt(Wd, i) : 0;
    const rough = Math.abs(flow) - 90;
    if (rough > 0) { c.e -= rough * 0.03 * dt; c.hit = 0.4; if (c.e <= 0) { die(L, c, 'wave'); continue; } }

    // うるおい: 水の中で満ち、陸で減る
    if (wet) c.m = Math.min(1, c.m + 1.2 * dt);
    else c.m -= dt * 0.32 * (1 - 0.95 * c.dry);

    // 向きを決める
    const jn = (i + c.dir + N) % N;
    if (wet) {
      if (h[jn] <= WET && !c.out) {
        // 水ぎわ: 陸へ出てみるか、引き返すか（1回だけ決める）
        if (r() < c.land * 0.7 && c.m > 0.8) c.out = true; else c.dir = -c.dir;
      } else if (r() < 0.12 * dt) c.dir = -c.dir;
      if (h[jn] > WET) c.out = false;
    } else {
      const thirst = 0.3 + 0.45 * (1 - c.land);
      if (c.m < thirst) { const d = waterDir(Wd, i); if (d) c.dir = d; }
      else if (grass[i] < 0.15 || r() < 0.15 * dt) { if (r() < 0.5 * dt + (grass[i] < 0.15 ? 0.02 : 0)) c.dir = -c.dir; }
      // 崖は登れない（歩けるものほど高い段を登れる）
      if (g[jn] - g[i] > 2.5 + 10 * c.legs && h[jn] <= WET) c.dir = -c.dir;
    }

    // 動く
    const sp = wet ? 24 * (1 - 0.35 * c.legs) : 2 + 24 * c.legs;
    const eat = grass[i] > 0.3 && !wet ? 0.35 : 1;           // 草を食べているあいだはゆっくり
    c.th = wrapA(c.th + (c.dir * sp * eat + flow * 0.85) * dt / R0);

    // 食べる
    let got = 0, want = 0.6 * dt;
    if (wet) {
      const a = Math.min(sea[i], want); sea[i] -= a; got += a; want -= a;
      if (h[i] < 6 && want > 0) { const b = Math.min(grass[i], want); grass[i] -= b; got += b; }
    } else { const b = Math.min(grass[i], want); grass[i] -= b; got += b; }
    c.e = Math.min(2, c.e + got);
    c.e -= dt * (0.05 + 0.03 * c.legs + 0.015 * c.dry);

    if (c.m <= 0) { die(L, c, 'dry'); continue; }
    if (c.e <= 0) { die(L, c, 'hunger'); continue; }
    if (c.age > c.life) { die(L, c, 'old'); continue; }

    // 子を残す（遺伝子は親から少しずれる）
    if (c.e > 1.7 && c.age > 5 && alive + born.length < POP_MAX) {
      c.e -= 0.9;
      const k = newCreature(L, Wd, c.th, {
        dry: clamp01(c.dry + gauss(r) * 0.1), legs: clamp01(c.legs + gauss(r) * 0.1), land: clamp01(c.land + gauss(r) * 0.1),
      }, c.gen + 1, 0);
      k.e = 0.6; k.m = c.m;
      born.push(k);
      if (k.gen > L.maxGen) L.maxGen = k.gen;
    }
    c.lander = isLander(c);
  }
  for (const k of born) { k.lander = isLander(k); L.list.push(k); }
  if (L.list.length > 40 && L.list.some(c => c.dead > 1.6)) L.list = L.list.filter(c => !c.dead || c.dead <= 1.6);
}

function die(L, c, cause) { c.dead = 0.0001; c.cause = cause; L.deaths[cause]++; }

function lifeStats(L) {
  const s = { n: 0, landers: 0, avg: { dry: 0, legs: 0, land: 0 } };
  for (const c of L.list) {
    if (c.dead) continue;
    s.n++; if (c.lander) s.landers++;
    s.avg.dry += c.dry; s.avg.legs += c.legs; s.avg.land += c.land;
  }
  if (s.n) for (const k in s.avg) s.avg[k] /= s.n;
  return s;
}
