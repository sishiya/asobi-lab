'use strict';
// 生き物: シカ（草を食べる）・オオカミ（シカを食べる）・サカナ（水草を食べる）・サギ（サカナを食べる鳥。v007）。
//   1匹ずつ動く。腹（e）・のどのかわき（th）・年（age）。腹がいっぱいで大人なら子を残す。
//   深い水に入ったシカ・オオカミは流され、ふちを越えると滝から落ちる。サカナも速い流れで落ちる。
//   死をむごく見せない: 食べられたら小さなけむり、落ちたら小さくなって消える（fx）。
//   遺伝子（v005）: 種類ごとに3つ（0〜1）。子は親と近くの相手の平均に、少しの変わり（突然変異）。
//     どれも「得」と「損」があり、世界のきびしさ（オオカミ・流れ・干上がり・飢え）で、生き残りやすいものが増える。

const KINDS = {   // 時間は秒（1日＝60 秒）。eMax・cost・speed は遺伝子で上下する（traits）
  deer: { name: 'シカ', eMax: 10, cost: 0.08, speed: 2.0, adult: 75, repE: 0.8, cd: 80, life: 600, cap: 220, childE: 0.35 },
  wolf: { name: 'オオカミ', eMax: 16, cost: 0.05, speed: 2.4, adult: 110, repE: 0.8, cd: 150, life: 900, cap: 40, childE: 0.37 },
  bird: { name: 'サギ', eMax: 12, cost: 0.05, speed: 0.6, adult: 150, repE: 0.8, cd: 200, life: 1200, cap: 30, childE: 0.35 },
  fish: { name: 'サカナ', eMax: 6, cost: 0.05, speed: 1.4, adult: 50, repE: 0.77, cd: 40, life: 500, cap: 360, childE: 0.33 },
};
const GENES = {
  deer: [['speed', 'あしの速さ'], ['size', '体の大きさ'], ['swim', '泳ぐ力']],
  wolf: [['speed', 'あしの速さ'], ['size', '体の大きさ'], ['stamina', 'ねばり強さ']],
  fish: [['strength', '泳ぐ力'], ['size', '体の大きさ'], ['hardy', '浅瀬への強さ']],
  bird: [['wing', 'つばさ'], ['size', '体の大きさ'], ['beak', 'くちばしの長さ']],
};
const MUT = 0.08;   // 突然変異の大きさ（ふつうはこのくらいずれる）
const L = { list: [], fx: [], born: 0, eaten: 0, fell: 0, why: {}, counts: { deer: 0, wolf: 0, fish: 0, bird: 0 } };

function resetLife() { L.list = []; L.fx = []; L.born = L.eaten = L.fell = 0; L.why = {}; L.counts = { deer: 0, wolf: 0, fish: 0, bird: 0 }; }

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.41;
// はじめの遺伝子（命のつぼから）: まん中あたりに少しのばらつき
function newGenes(kind) { const g = {}; for (const [k] of GENES[kind]) g[k] = clamp01(0.5 + (Math.random() - 0.5) * 0.36); return g; }
function childGenes(kind, a, mate) {
  const g = {};
  for (const [k] of GENES[kind]) g[k] = clamp01((mate ? (a.g[k] + mate.g[k]) / 2 : a.g[k]) + gauss() * MUT);
  return g;
}
// 遺伝子 → からだの数字。どれも遺伝子 0.5 で、もとの KINDS の値になる
function traits(kind, g) {
  const K = KINDS[kind];
  if (kind === 'deer') return {
    eMax: K.eMax * (0.7 + 0.6 * g.size),
    cost: K.cost * (0.62 + 0.36 * g.speed + 0.3 * g.size + 0.16 * g.swim),
    walk: K.speed * (0.85 + 0.3 * g.speed - 0.15 * g.size + 0.075),
    flee: 2.5 * (0.7 + 0.6 * g.speed),             // 逃げる速さ（0.5 で 2.5。オオカミと速さの差がそのまま生き死にに）
    carry: 0.8 * (1.35 - 0.7 * g.swim),          // 流されやすさ
    paddle: 0.5 + 1.5 * g.swim,                  // 泳ぐ速さ
    wetMax: 25 * (0.4 + 1.2 * g.swim),            // 深い水にいられる時間
    fear: 3 * (1 - g.swim) * (1 - g.swim) * 4,    // 深い水へ入るのをいやがる強さ（泳ぐ力 0.5 で 3）
    escape: 0.3 * g.size * g.size,                // オオカミにつかまっても逃げきれる見こみ（0.5 で 0.075）
  };
  if (kind === 'wolf') return {
    eMax: K.eMax * (0.8 + 0.4 * g.size),
    cost: K.cost * (0.62 + 0.36 * g.speed + 0.3 * g.size + 0.24 * g.stamina) / 1.06,
    walk: K.speed,
    chase: 3.0 * (0.7 + 0.6 * g.speed),
    give: 4 + 8 * g.stamina,                      // あきらめるまでの秒
    grip: 0.6 + 0.8 * g.size,                     // 大きなシカをしとめる力
  };
  if (kind === 'bird') return {
    eMax: K.eMax * (0.8 + 0.4 * g.size),
    cost: K.cost * (0.62 + 0.3 * g.wing + 0.3 * g.size + 0.3 * g.beak) / 1.07,
    walk: K.speed,
    fly: 4 * (0.7 + 0.6 * g.wing),                // とぶ速さ
    reach: 0.35 + 1.1 * g.beak,                   // 立って魚をとれる水の深さ（0.5 で 0.9）
    grip: 0.6 + 0.8 * g.size,                     // 大きな魚を飲みこめる力
  };
  return {
    eMax: K.eMax * (0.7 + 0.6 * g.size),
    cost: K.cost * (0.62 + 0.4 * g.strength + 0.3 * g.size + 0.16 * g.hardy) / 1.05,
    walk: K.speed * (0.8 + 0.4 * g.strength),
    carry: 1.6 - 1.4 * g.strength,                // 流れに持っていかれる割合（0.5 で 0.9）
    eat: 0.8 + 0.4 * g.size,
    dryMax: 5 * (0.3 + 1.4 * g.hardy),             // 水のない所でたえる秒
  };
}

function spawn(kind, x, y, e, g) {
  const K = KINDS[kind];
  if (L.counts[kind] >= K.cap) return null;
  g = g || newGenes(kind);
  const tr = traits(kind, g);
  const a = { kind, x, y, g, tr, e: e ?? tr.eMax * 0.6, th: 0, age: 0, cd: K.cd * 0.5, dir: Math.random() * 6.283,
    wander: 0, dead: false, flip: 1, chase: 0, rest: 0, wet: 0, phase: Math.random() * 10, gen: 1, fly: false, alt: 0, tx: x, ty: y, wait: 0 };
  L.list.push(a); L.counts[kind]++;
  return a;
}

const cellOf = (x, y) => Math.round(y) * N + Math.round(x);
const onDisk = (x, y) => (x - C) ** 2 + (y - C) ** 2 < (RD - 0.6) ** 2;

// 近くの生き物を探すための粗い格子
const GS = 8, GW = Math.ceil(N / GS);
let grid = [];
function buildGrid() {
  grid = Array.from({ length: GW * GW }, () => []);
  for (const a of L.list) if (!a.dead) {
    const gx = Math.max(0, Math.min(GW - 1, a.x / GS | 0)), gy = Math.max(0, Math.min(GW - 1, a.y / GS | 0));
    grid[gy * GW + gx].push(a);
  }
}
function nearest(a, kind, rad, test) {
  let best = null, bd = rad * rad;
  const gx0 = Math.max(0, (a.x - rad) / GS | 0), gx1 = Math.min(GW - 1, (a.x + rad) / GS | 0);
  const gy0 = Math.max(0, (a.y - rad) / GS | 0), gy1 = Math.min(GW - 1, (a.y + rad) / GS | 0);
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) for (const b of grid[gy * GW + gx]) {
    if (b.kind !== kind || b.dead || b === a || (test && !test(b))) continue;
    const d = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function die(a, how) {
  if (a.dead) return;
  a.dead = true; L.counts[a.kind]--;
  const key = a.kind + ':' + how; L.why[key] = (L.why[key] || 0) + 1;
  if (how === 'fall') {
    L.fell++;
    L.fx.push({ type: 'fall', kind: a.kind, x: a.x, y: a.y, z: heightAt(a.x, a.y, true), vz: 0, t: 0, flip: a.flip });
  } else L.fx.push({ type: 'puff', x: a.x, y: a.y, z: heightAt(a.x, a.y, true), t: 0, kind: a.kind, how });
  W.events.push({ type: 'die', kind: a.kind, how, a });
}

// いくつかの向きをためして、いちばん点の高い向きへ
function pickDir(a, score, n = 7, look = 2.5) {
  let best = a.dir, bs = -1e9;
  for (let k = 0; k < n; k++) {
    const d = k === 0 ? a.dir : a.dir + (Math.random() - 0.5) * Math.PI * 2;
    const tx = a.x + Math.cos(d) * look, ty = a.y + Math.sin(d) * look;
    if (!onDisk(tx, ty)) continue;
    const s = score(cellOf(tx, ty), tx, ty) + (k === 0 ? 0.05 : 0);
    if (s > bs) { bs = s; best = d; }
  }
  return best;
}

function stepAnimal(a, dt) {
  if (a.kind === 'bird') { stepBird(a, dt); return; }
  const K = KINDS[a.kind], T = a.tr, i = cellOf(a.x, a.y);
  if (!inside[i]) { die(a, 'fall'); return; }
  const w = W.w[i];
  a.age += dt; a.cd -= dt; a.e -= T.cost * dt; a.phase += dt;
  let sp = T.walk, vx = 0, vy = 0;

  if (a.kind === 'fish') {
    if (w < 0.1) {                       // 水がない: 深い方へはねる
      a.wet += dt;
      if (a.wet > T.dryMax) { die(a, 'dry'); return; }
      a.dir = pickDir(a, j => W.w[j], 8, 1.5); sp = 1.2;
    } else {
      a.wet = 0;
      const f = flowAt(i);
      const fs = Math.hypot(f.vx, f.vy);
      const k = Math.max(0.05, Math.min(1, (0.2 + 0.35 * fs) * T.carry));   // 流れが速いほど持っていかれる。泳ぐ力が強いほど流されない
      vx += f.vx * k; vy += f.vy * k;
      // 食べものをさがす。泳ぐ力の強いサカナは、食べものを運んでくる流れも好む
      const likeFlow = (a.g.strength - 0.45) * 0.5;
      const heron = nearest(a, 'bird', 3, b => !b.fly);
      if (heron) a.dir = pickDir(a, (j, x, y) => W.w[j] > 0.15 ? Math.min(W.w[j], 3) + Math.hypot(x - heron.x, y - heron.y) * 0.5 : -9, 8, 2);   // サギが来たら深い方へ
      else if (a.e < T.eMax * 0.85) a.dir = pickDir(a, j => W.w[j] > 0.15 ? W.alg[j] + Math.min(W.w[j], 2) * 0.1 + likeFlow * Math.min(2, (W.fL[j] + W.fR[j] + W.fU[j] + W.fD[j]) / (W.w[j] + 0.15)) : -1, 5, 2);
      else { a.wander -= dt; if (a.wander < 0) { a.dir += (Math.random() - 0.5) * 2; a.wander = 1 + Math.random() * 2; } }
      const take = Math.max(0, Math.min(W.alg[i] - 0.06, 0.1 * T.eat * dt));   // 根もとは残る
      W.alg[i] -= take; a.e = Math.min(T.eMax, a.e + take * 8);
      a.e = Math.min(T.eMax, a.e + Math.min(fs, 2.5) * 0.04 * dt);   // 流れが運んでくる食べもの（流れの中にいられるほど得）
    }
  } else {
    // シカ・オオカミ
    if (W.moist[i] > 0.9) a.th = 0; else a.th += dt;
    const fear = a.kind === 'deer' ? T.fear : 3;
    const swimmer = a.kind === 'deer' && a.g.swim > 0.6;
    if (w > 0.45) {                       // 深い水: 流される・泳ぐ
      a.wet += dt;
      const f = flowAt(i), carry = a.kind === 'deer' ? T.carry : 0.8;
      vx += f.vx * carry; vy += f.vy * carry;
      sp = a.kind === 'deer' ? T.paddle : 1.0;
      // 泳ぎのうまいシカは、向こう岸の草をめざして泳ぎつづける。ほかは近い岸へ
      if (swimmer && a.wet < T.wetMax * 0.6) a.dir = pickDir(a, j => (W.w[j] < 0.4 ? W.veg[j] * 2 : 0) - (inside[j] ? 0 : 9), 6, 4);
      else a.dir = pickDir(a, j => -W.w[j] * 2 - (inside[j] ? 0 : 9), 8, 2);
      if (a.wet > (a.kind === 'deer' ? T.wetMax : 25)) { die(a, 'drown'); return; }
    } else {
      a.wet = 0;
      const avoid = j => (W.w[j] > 0.4 ? -fear : 0);
      if (a.kind === 'deer') {
        const wolf = nearest(a, 'wolf', 6);
        if (wolf) {                                    // 逃げる: まっすぐ遠くへ。ふさがっていたら、オオカミからいちばん遠くなる向きへ
          a.dir = Math.atan2(a.y - wolf.y, a.x - wolf.x) + (Math.random() - 0.5) * 0.2; sp = T.flee;
          const tx = a.x + Math.cos(a.dir) * 2, ty = a.y + Math.sin(a.dir) * 2;
          if (!onDisk(tx, ty) || W.w[cellOf(tx, ty)] > 0.4 * (swimmer ? 3 : 1)) a.dir = pickDir(a, (j, x, y) => avoid(j) + Math.hypot(x - wolf.x, y - wolf.y), 10, 2);
        }
        else if (a.th > 30) a.dir = pickDir(a, j => W.moist[j] + avoid(j), 7, 3);
        else if (a.e < T.eMax * 0.8) { a.dir = pickDir(a, j => W.veg[j] + avoid(j), 6, 2.5 + (swimmer ? 2 : 0)); sp *= W.veg[i] > 0.4 ? 0.3 : 1; }
        else { a.wander -= dt; if (a.wander < 0) { a.dir = pickDir(a, j => avoid(j) + Math.random() * 0.5, 4, 2); a.wander = 1.5 + Math.random() * 3; } sp *= 0.5; }
        const take = Math.max(0, Math.min(W.veg[i] - 0.2, 0.4 * W.veg[i] * dt));   // 短い草は残す（そこからまた伸びる）
        if (a.e < T.eMax) { W.veg[i] -= take; a.e = Math.min(T.eMax, a.e + take * 5); }
      } else {
        a.rest -= dt;
        // 腹がへったら1頭にねらいを決めて、つかまえるか、あきらめるまで追う（群れの中で相手を替えない）
        if (a.target && (a.target.dead || (a.target.x - a.x) ** 2 + (a.target.y - a.y) ** 2 > 196)) a.target = null;
        if (!a.target && a.e < T.eMax * 0.6 && a.rest <= 0) a.target = nearest(a, 'deer', 11);
        const deer = a.rest <= 0 ? a.target : null;
        if (deer) {
          a.dir = Math.atan2(deer.y - a.y, deer.x - a.x); sp = T.chase; a.chase += dt;
          if ((deer.x - a.x) ** 2 + (deer.y - a.y) ** 2 < 0.5) {
            // 大きなシカは逃げきることがある（オオカミが大きいほど逃げにくい）
            if (Math.random() < deer.tr.escape / T.grip) { a.chase = 0; a.rest = 8; a.target = null; deer.dir = a.dir; deer.x += Math.cos(a.dir) * 0.8; deer.y += Math.sin(a.dir) * 0.8; }
            else { a.e = Math.min(T.eMax, a.e + 8 * (0.7 + 0.6 * deer.g.size)); L.eaten++; die(deer, 'eaten'); a.chase = 0; a.rest = 30; a.target = null; }   // 食べたら半日休む
          } else if (a.chase > T.give) { a.chase = 0; a.rest = 5; a.target = null; }
        } else if (a.th > 35) a.dir = pickDir(a, j => W.moist[j] + avoid(j), 7, 3);
        else { a.chase = 0; a.wander -= dt; if (a.wander < 0) { a.dir = pickDir(a, j => avoid(j) + Math.random() * 0.5, 4, 3); a.wander = 2 + Math.random() * 3; } sp *= 0.6; }
      }
      if (a.th > 90) { die(a, 'thirst'); return; }
    }
  }
  vx += Math.cos(a.dir) * sp; vy += Math.sin(a.dir) * sp;
  let nx = a.x + vx * dt, ny = a.y + vy * dt;
  const ni = cellOf(nx, ny);
  const carried = a.kind === 'fish' ? W.w[i] > 0.1 : a.wet > 0;
  if (!inside[ni] || !onDisk(nx, ny)) {
    // ふちの外へ: 流されていたら滝から落ちる。歩いていたら止まる
    if (carried && W.w[i] > 0.05 && (vx * (a.x - C) + vy * (a.y - C)) > 0) { a.x = nx; a.y = ny; die(a, 'fall'); return; }
    a.dir += Math.PI * (0.6 + Math.random() * 0.8); nx = a.x; ny = a.y;
  } else if (a.kind === 'fish' && W.w[ni] < 0.1 && W.w[i] >= 0.1) {
    a.dir += Math.PI * (0.5 + Math.random()); nx = a.x; ny = a.y;   // サカナは水から出ない
  }
  if (Math.abs(vx) > 0.05) a.flip = vx > 0 ? 1 : -1;
  a.x = nx; a.y = ny;

  if (a.e <= 0) { die(a, 'hunger'); return; }
  if (a.age > K.life * (0.8 + 0.4 * ((a.phase * 7) % 1))) { die(a, 'old'); return; }
  reproduce(a);
}

function reproduce(a) {
  const K = KINDS[a.kind], T = a.tr;
  if (a.e > K.repE * T.eMax && a.age > K.adult && a.cd <= 0) {
    const mate = nearest(a, a.kind, a.kind === 'bird' ? 12 : 8, b => b.age > K.adult);      // 近くの大人と遺伝子を合わせる（いなければ自分だけ）
    const ce = K.childE * T.eMax;
    const c = spawn(a.kind, a.x + (Math.random() - 0.5), a.y + (Math.random() - 0.5), ce, childGenes(a.kind, a, mate));
    if (c) {
      c.gen = Math.max(a.gen, mate ? mate.gen : 0) + 1;
      a.e -= ce + 1; a.cd = K.cd * (0.8 + Math.random() * 0.4); L.born++;
      L.fx.push({ type: 'born', x: c.x, y: c.y, z: heightAt(c.x, c.y, true), t: 0 });
    }
  }
}

// サギ: とんで水辺へ行き、浅い水に立ってサカナをねらう。くちばしが長いほど深い所まで届く。
//   大きなサカナは飲みこみにくい（サギが大きいほどとれる）。おなかがいっぱいなら岸で休む。滝からは落ちない。
const reachable = (a, f) => W.w[cellOf(f.x, f.y)] <= a.tr.reach;
function flyTo(a, x, y) {
  if (!onDisk(x, y)) return;
  a.fly = true; a.tx = x; a.ty = y; a.wait = 0;
}
function stepBird(a, dt) {
  const K = KINDS.bird, T = a.tr;
  a.age += dt; a.cd -= dt; a.e -= T.cost * (a.fly ? 1.4 : 1) * dt; a.phase += dt; a.rest -= dt; a.chase -= dt; a.wait += dt;
  a.alt += Math.max(-6 * dt, Math.min(6 * dt, (a.fly ? 5 : 0) - a.alt));
  if (a.fly) {
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    if (d < 0.6) { a.fly = false; a.wait = 0; }
    else { a.dir = Math.atan2(dy, dx); const st = Math.min(d, T.fly * dt); a.x += dx / d * st; a.y += dy / d * st; }
  } else {
    const i = cellOf(a.x, a.y), depth = W.w[i];
    if (depth > T.reach) { const f = nearest(a, 'fish', 30, b => reachable(a, b)); flyTo(a, f ? f.x : C + (Math.random() - 0.5) * 40, f ? f.y : C + (Math.random() - 0.5) * 40); }
    else if (a.e < T.eMax * 0.75 && a.rest <= 0) {
      // ねらう: すぐそばの、くちばしが届くサカナを突く
      const f = nearest(a, 'fish', 1.3, b => reachable(a, b));
      if (f && a.chase <= 0) {
        a.chase = 1.2; a.dir = Math.atan2(f.y - a.y, f.x - a.x);
        const p = Math.max(0.05, Math.min(0.9, 0.55 * T.grip / (0.6 + 0.8 * f.g.size)));
        if (Math.random() < p) { a.e = Math.min(T.eMax, a.e + 4 * (0.6 + 0.8 * f.g.size)); die(f, 'caught'); a.rest = 15; a.wait = 0; }
      }
      // 少し歩いて近づく（届く深さの所だけ）
      const g = nearest(a, 'fish', 4, b => reachable(a, b));
      if (g) {
        a.dir = Math.atan2(g.y - a.y, g.x - a.x);
        const nx = a.x + Math.cos(a.dir) * T.walk * dt, ny = a.y + Math.sin(a.dir) * T.walk * dt;
        if (onDisk(nx, ny) && W.w[cellOf(nx, ny)] <= T.reach) { a.x = nx; a.y = ny; }
      } else if (a.wait > 10) {                     // ここにはいない: とれそうなサカナのいる水辺へ
        const far = nearest(a, 'fish', 40, b => reachable(a, b));
        if (far) flyTo(a, far.x + (Math.random() - 0.5) * 2, far.y + (Math.random() - 0.5) * 2);
        else { const j = INS[(Math.random() * INS.length) | 0]; if (W.w[j] > 0.05 && W.w[j] <= T.reach) flyTo(a, j % N, j / N | 0); }
      }
    } else if (a.wait > 25 + (a.phase % 10)) {     // おなかいっぱい: ときどき別の水辺へ
      const j = INS[(Math.random() * INS.length) | 0];
      if (W.moist[j] > 0.9 && W.w[j] <= T.reach) flyTo(a, j % N, j / N | 0);
    }
  }
  if (a.e <= 0) { die(a, 'hunger'); return; }
  if (a.age > K.life * (0.8 + 0.4 * ((a.phase * 7) % 1))) { die(a, 'old'); return; }
  if (!a.fly) reproduce(a);
}

function stepLife(dt) {
  buildGrid();
  for (const a of L.list) if (!a.dead) stepAnimal(a, dt);
  if (L.list.some(a => a.dead)) L.list = L.list.filter(a => !a.dead);
  for (const f of L.fx) {
    f.t += dt;
    if (f.type === 'fall') { f.vz -= 14 * dt; f.z += f.vz * dt; const r = Math.hypot(f.x - C, f.y - C) || 1; f.x += (f.x - C) / r * 1.2 * dt; f.y += (f.y - C) / r * 1.2 * dt; }
  }
  L.fx = L.fx.filter(f => f.t < (f.type === 'fall' ? 2.5 : 1.2));
}

// 遺伝子の平均（種類ごと）と、いちばん新しい世代
function geneStats(kind) {
  const out = { n: 0, gen: 0 };
  for (const [k] of GENES[kind]) out[k] = 0;
  for (const a of L.list) if (a.kind === kind) { out.n++; out.gen = Math.max(out.gen, a.gen); for (const [k] of GENES[kind]) out[k] += a.g[k]; }
  if (out.n) for (const [k] of GENES[kind]) out[k] /= out.n;
  return out;
}

// 道具: 生き物を放す（命のつぼから）
function release(kind, x, y) {
  if (W.stock[kind] <= 0) return 'empty';
  const i = cellOf(x, y);
  if (!inside[i]) return 'no';
  if (kind !== 'bird' && (kind === 'fish' ? W.w[i] < 0.2 : W.w[i] > 0.3)) return kind === 'fish' ? 'needwater' : 'needland';
  const a = spawn(kind, x, y);
  if (!a) return 'cap';
  a.e = a.tr.eMax * 0.7;
  a.age = KINDS[kind].adult * 0.8;
  W.stock[kind]--;
  return 'ok';
}
