'use strict';
// 生き物: シカ（草を食べる）・オオカミ（シカを食べる）・サカナ（水草を食べる）。
//   1匹ずつ動く。腹（e）・のどのかわき（th）・年（age）。腹がいっぱいで大人なら子を残す。
//   深い水に入ったシカ・オオカミは流され、ふちを越えると滝から落ちる。サカナも速い流れで落ちる。
//   死をむごく見せない: 食べられたら小さなけむり、落ちたら小さくなって消える（fx）。

const KINDS = {   // 時間は秒（1日＝60 秒）
  deer: { name: 'シカ', eMax: 10, cost: 0.08, speed: 2.0, adult: 110, repE: 8, cd: 110, life: 900, cap: 160, childE: 3.5 },
  wolf: { name: 'オオカミ', eMax: 16, cost: 0.05, speed: 2.4, adult: 180, repE: 13, cd: 240, life: 1500, cap: 30, childE: 6 },
  fish: { name: 'サカナ', eMax: 6, cost: 0.05, speed: 1.4, adult: 70, repE: 4.6, cd: 50, life: 800, cap: 360, childE: 2 },
};
const L = { list: [], fx: [], born: 0, eaten: 0, fell: 0, why: {}, counts: { deer: 0, wolf: 0, fish: 0 } };

function resetLife() { L.list = []; L.fx = []; L.born = L.eaten = L.fell = 0; L.why = {}; L.counts = { deer: 0, wolf: 0, fish: 0 }; }

function spawn(kind, x, y, e) {
  const K = KINDS[kind];
  if (L.counts[kind] >= K.cap) return null;
  const a = { kind, x, y, e: e ?? K.eMax * 0.6, th: 0, age: kind === 'fish' ? 0 : 0, cd: K.cd * 0.5, dir: Math.random() * 6.283,
    wander: 0, dead: false, flip: 1, chase: 0, rest: 0, wet: 0, phase: Math.random() * 10 };
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
function nearest(a, kind, rad) {
  let best = null, bd = rad * rad;
  const gx0 = Math.max(0, (a.x - rad) / GS | 0), gx1 = Math.min(GW - 1, (a.x + rad) / GS | 0);
  const gy0 = Math.max(0, (a.y - rad) / GS | 0), gy1 = Math.min(GW - 1, (a.y + rad) / GS | 0);
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) for (const b of grid[gy * GW + gx]) {
    if (b.kind !== kind || b.dead || b === a) continue;
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
  W.events.push({ type: 'die', kind: a.kind, how });
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
  const K = KINDS[a.kind], i = cellOf(a.x, a.y);
  if (!inside[i]) { die(a, 'fall'); return; }
  const w = W.w[i];
  a.age += dt; a.cd -= dt; a.e -= K.cost * dt; a.phase += dt;
  let sp = K.speed, vx = 0, vy = 0;

  if (a.kind === 'fish') {
    if (w < 0.1) {                       // 水がない: 深い方へはねる
      a.wet += dt;
      if (a.wet > 5) { die(a, 'dry'); return; }
      a.dir = pickDir(a, j => W.w[j], 8, 1.5); sp = 1.2;
    } else {
      a.wet = 0;
      const f = flowAt(i);
      const fs = Math.hypot(f.vx, f.vy);
      vx += f.vx * (fs > 2.2 ? 0.9 : 0.35); vy += f.vy * (fs > 2.2 ? 0.9 : 0.35);  // 速い流れには逆らえない
      if (a.e < K.eMax * 0.85) a.dir = pickDir(a, j => W.w[j] > 0.15 ? W.alg[j] + Math.min(W.w[j], 2) * 0.1 : -1, 5, 2);
      else { a.wander -= dt; if (a.wander < 0) { a.dir += (Math.random() - 0.5) * 2; a.wander = 1 + Math.random() * 2; } }
      const take = Math.max(0, Math.min(W.alg[i] - 0.06, 0.1 * dt));   // 根もとは残る
      W.alg[i] -= take; a.e = Math.min(K.eMax, a.e + take * 8);
    }
  } else {
    // シカ・オオカミ
    if (W.moist[i] > 0.9) a.th = 0; else a.th += dt;
    if (w > 0.45) {                       // 深い水: 流される・岸へ泳ぐ
      a.wet += dt;
      const f = flowAt(i);
      vx += f.vx * 0.8; vy += f.vy * 0.8;
      a.dir = pickDir(a, j => -W.w[j] * 2 - (inside[j] ? 0 : 9), 8, 2); sp = 1.0;
      if (a.wet > 25) { die(a, 'drown'); return; }
    } else {
      a.wet = 0;
      const avoid = j => (W.w[j] > 0.4 ? -3 : 0);
      if (a.kind === 'deer') {
        const wolf = nearest(a, 'wolf', 5);
        if (wolf) { a.dir = Math.atan2(a.y - wolf.y, a.x - wolf.x) + (Math.random() - 0.5) * 0.6; sp = 2.7; if (!onDisk(a.x + Math.cos(a.dir) * 2, a.y + Math.sin(a.dir) * 2) || W.w[cellOf(a.x + Math.cos(a.dir) * 2, a.y + Math.sin(a.dir) * 2)] > 0.4) a.dir = pickDir(a, j => avoid(j) + Math.random(), 6, 2); }
        else if (a.th > 30) a.dir = pickDir(a, j => W.moist[j] + avoid(j), 7, 3);
        else if (a.e < K.eMax * 0.8) { a.dir = pickDir(a, j => W.veg[j] + avoid(j), 6, 2.5); sp *= W.veg[i] > 0.4 ? 0.3 : 1; }
        else { a.wander -= dt; if (a.wander < 0) { a.dir = pickDir(a, j => avoid(j) + Math.random() * 0.5, 4, 2); a.wander = 1.5 + Math.random() * 3; } sp *= 0.5; }
        const take = Math.max(0, Math.min(W.veg[i] - 0.06, 0.4 * W.veg[i] * dt));   // 根もとは残る
        if (a.e < K.eMax) { W.veg[i] -= take; a.e = Math.min(K.eMax, a.e + take * 5); }
      } else {
        a.rest -= dt;
        const deer = a.e < K.eMax * 0.6 && a.rest <= 0 ? nearest(a, 'deer', 11) : null;   // 腹がへるまでは狩らない
        if (deer) {
          a.dir = Math.atan2(deer.y - a.y, deer.x - a.x); sp = 3.1; a.chase += dt;
          if ((deer.x - a.x) ** 2 + (deer.y - a.y) ** 2 < 0.5) {
            a.e = Math.min(K.eMax, a.e + 8); L.eaten++; die(deer, 'eaten'); a.chase = 0; a.rest = 30;   // 食べたら半日休む
          } else if (a.chase > 7) { a.chase = 0; a.rest = 5; }
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
  if (a.e > K.repE && a.age > K.adult && a.cd <= 0) {
    const c = spawn(a.kind, a.x + (Math.random() - 0.5), a.y + (Math.random() - 0.5), K.childE);
    if (c) { a.e -= K.childE + 1; a.cd = K.cd * (0.8 + Math.random() * 0.4); L.born++; }
  }
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

// 道具: 生き物を放す（命のつぼから）
function release(kind, x, y) {
  if (W.stock[kind] <= 0) return 'empty';
  const i = cellOf(x, y);
  if (!inside[i]) return 'no';
  if (kind === 'fish' ? W.w[i] < 0.2 : W.w[i] > 0.3) return kind === 'fish' ? 'needwater' : 'needland';
  const a = spawn(kind, x, y, KINDS[kind].eMax * 0.7);
  if (!a) return 'cap';
  a.age = KINDS[kind].adult * 0.8;
  W.stock[kind]--;
  return 'ok';
}
