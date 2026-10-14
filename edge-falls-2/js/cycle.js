'use strict';
// めぐり（v2。EXPANSION.md 1章）: 「何も生まれず、何も消えない」を、目で追えるようにする。
//   1) 体は土にかえる（養分のめぐり。本当のこと）: 死んだ生き物とふんは、その場の土を肥やす（W.fert）。肥えた土では草がよく育ち、
//      育つ草は肥えを使う。枯れた草も土にかえる。水は肥えを少しずつ下流へ運び、滝から深淵へ（W.abyssFert）。泉がそれをくみ上げる。
//   2) 命の光（作りごと。図鑑で正直に書く）: 去った命 3 つで光の粒が 1 つ。粒は空へのぼり、ふちへただよって深淵へ落ちる（W.abyssLives）。
//      深淵の命は、滝のしぶきの霧にのって雲になり（雲が命を運ぶ）、雨といっしょに大地へおりて、命のつぼへ帰る。泉からも、ときどき帰る。
//      だから滝をぜんぶ止めると、命はなかなか帰ってこない（全部を止めると、世界はよどむ）。
//   粒は世界の時計で動く（止めると止まる）。記録には、とちゅうの粒も深淵の数として残す（save.js）。

const KINDS4 = ['deer', 'wolf', 'fish', 'bird', 'human'];
const MOTES = [];                       // 光の粒 {k, s: 'rise'|'drift'|'fall'|'down', x, y, z, t, vx, vy}
function resetCycle() { MOTES.length = 0; W.abyssLives = { deer: 0, wolf: 0, fish: 0, bird: 0, human: 0 }; }

// 生き物が去った（life.js の die から）
function bodyReturns(a, how) {
  const i = cellOf(a.x, a.y);
  if (how === 'fall' || !inside[i]) W.abyssFert += 0.6;            // 滝から落ちた体は、深淵の肥えに
  else {                                                            // その場の土（水の中なら水草の肥え）に
    W.fert[i] = Math.min(1.5, W.fert[i] + 0.35);
    for (const d of NB4) if (inside[i + d]) W.fert[i + d] = Math.min(1.5, W.fert[i + d] + 0.12);
    if (how !== 'eaten' && how !== 'caught' && W.w[i] < 0.1) W.flags.bloom = 1;
  }
  W.souls[a.kind] += 1 / 3;
  if (W.souls[a.kind] >= 1) {
    W.souls[a.kind] -= 1;
    const z = heightAt(a.x, a.y, true);
    if (how === 'fall' || !inside[i]) MOTES.push({ k: a.kind, s: 'fall', x: a.x, y: a.y, z, t: 0, vx: 0, vy: 0 });
    else MOTES.push({ k: a.kind, s: 'rise', x: a.x, y: a.y, z, t: 0, vx: 0, vy: 0 });
  }
}

// 肥えのめぐり（0.25 秒ごと。stepPlants のあと）
const FT = new Float32Array(N * N);
function stepFert(dt) {
  const f = W.fert, w = W.w;
  FT.fill(0);
  for (const i of INS) {
    const wi = w[i];
    if (wi < 0.06 || f[i] < 0.01) continue;
    const out = (W.fL[i] + W.fR[i] + W.fU[i] + W.fD[i]) * dt;
    if (out <= 0) continue;
    const mv = f[i] * Math.min(0.25, out / (wi + 0.3)) * 0.35;     // 溶けた分だけ、流れといっしょに
    f[i] -= mv;
    const q = mv / (W.fL[i] + W.fR[i] + W.fU[i] + W.fD[i]);
    const give = (j, fl) => { if (fl <= 0) return; if (inside[j]) FT[j] += fl * q; else W.abyssFert += fl * q; };
    give(i - 1, W.fL[i]); give(i + 1, W.fR[i]); give(i - N, W.fU[i]); give(i + N, W.fD[i]);
  }
  for (const i of INS) if (FT[i]) f[i] = Math.min(1.5, f[i] + FT[i]);
  for (const s of W.springs) {                                       // 泉は深淵の肥えもくみ上げる
    if (!s.on) continue;
    const q = Math.min(W.abyssFert, 0.05 * dt);
    W.abyssFert -= q; f[s.i] = Math.min(1.5, f[s.i] + q);
  }
}
// 草が育つ・枯れるときの肥え（world.js の stepPlants から）
const fertGrow = i => 0.7 + 0.6 * Math.min(1, W.fert[i]);

// 光の粒・深淵の命（毎ステップ。world.js の stepSky のあと）
function stepMotes(dt) {
  for (let n = MOTES.length - 1; n >= 0; n--) {
    const m = MOTES[n];
    m.t += dt;
    if (m.s === 'rise') {                                            // ゆっくり空へ
      m.z += 2.4 * dt;
      if (m.t > 1.6) { m.s = 'drift'; m.t = 0; const r = Math.hypot(m.x - C, m.y - C) || 1, sp = 3.2; m.vx = (m.x - C) / r * sp; m.vy = (m.y - C) / r * sp; }
    } else if (m.s === 'drift') {                                    // いちばん近いふちへ
      m.x += m.vx * dt; m.y += m.vy * dt; m.z += Math.sin(m.t * 2 + n) * 0.4 * dt;
      if ((m.x - C) ** 2 + (m.y - C) ** 2 > (RD + 1) ** 2) { m.s = 'fall'; m.t = 0; }
    } else if (m.s === 'fall') {                                     // 深淵へ落ちていく
      const r = Math.hypot(m.x - C, m.y - C) || 1;
      m.x += (m.x - C) / r * 0.8 * dt; m.y += (m.y - C) / r * 0.8 * dt; m.z -= (6 + m.t * 10) * dt;
      if (m.t > 2.4) { W.abyssLives[m.k]++; m.end = 'abyss'; MOTES.splice(n, 1); }
    } else if (m.s === 'down') {                                     // 雨・泉から、命のつぼへ
      m.z += (m.up ? 3 : -5) * dt;
      if (m.t > 1.4) { m.end = homeLife(m.k) ? 'home' : 'abyss'; MOTES.splice(n, 1); }
    }
  }
  // 泉から、ときどき帰る（泉 1 つで 1 日に 0.6 ほど）
  const total = KINDS4.reduce((a, k) => a + W.abyssLives[k], 0);
  if (total > 0) for (const s of W.springs) if (s.on && W.abyss > 1 && Math.random() < 0.01 * dt) {
    const k = pickLife(); if (!k) break;
    W.abyssLives[k]--; MOTES.push({ k, s: 'down', up: 1, x: s.i % N, y: s.i / N | 0, z: W.g[s.i] + W.w[s.i], t: 0 });
  }
}
function pickLife() {
  const ks = KINDS4.filter(k => W.abyssLives[k] > 0 && (G.unlock ? G.unlock[k] : true));
  return ks.length ? ks[(Math.random() * ks.length) | 0] : null;
}
// 霧の雲が生まれた（world.js の stepSky から）: 深淵の命を一つのせる
function mistCarries(cl) {
  const k = pickLife(); if (!k) return;
  W.abyssLives[k]--; (cl.lives = cl.lives || []).push(k); W.flags.mistlife = 1;
}
// 雲が大地に雨をふらせている（stepSky から）。のせた命は雨といっしょにおりる
function rainCarries(cl, dt, onLand) {
  if (!cl.lives || !cl.lives.length) return;
  if (onLand && Math.random() < 0.25 * dt) {
    const k = cl.lives.pop();
    MOTES.push({ k, s: 'down', x: cl.x, y: cl.y, z: cloudZ(cl), t: 0 }); W.flags.rainlife = 1;
  }
}
function cloudGone(cl) {   // 雲が消えた: のせていた命は、そこで雨のようにおりる
  if (!cl.lives) return;
  for (const k of cl.lives) MOTES.push({ k, s: 'down', x: cl.x, y: cl.y, z: cloudZ(cl), t: 0 });
  cl.lives = null;
}
// 命のつぼへ。つぼがいっぱいなら深淵へもどる
function homeLife(k) {
  if (W.stock[k] < STOCK_MAX[k] && (!G.unlock || G.unlock[k])) { W.stock[k]++; W.flags.ret = 1; if (typeof glowHand === 'function') glowHand('deer'); return true; }
  W.abyssLives[k]++; return false;
}
// いなくなった種類は、深淵とつぼに何もなくても、1日に1つは帰る（取り返しがつかないことは起きない。v011 と同じ）
function dailySafety() {
  for (const k of KINDS4) {
    if (G.unlock && !G.unlock[k]) continue;
    const moving = MOTES.some(m => m.k === k) || W.clouds.some(c => c.lives && c.lives.includes(k));
    if (L.counts[k] === 0 && W.stock[k] === 0 && !moving) {
      if (W.abyssLives[k] > 0) W.abyssLives[k]--;
      homeLife(k);
    }
  }
}
// 記録用: とちゅうの命も深淵の数に
function livesForSave() {
  const out = { ...W.abyssLives };
  for (const m of MOTES) out[m.k]++;
  for (const c of W.clouds) if (c.lives) for (const k of c.lives) out[k]++;
  return out;
}
// 光の粒を追う（v2）: 手があいているとき粒を押すと、カメラがその粒について行く。深淵へ落ちるか、つぼへ帰るまで
function pickMote(sx, sy) {
  let best = null, bd = 26 * 26;
  for (const m of MOTES) { const p = proj(m.x, m.y, m.z), d = (p.x - sx) ** 2 + (p.y - sy) ** 2; if (d < bd) { bd = d; best = m; } }
  return best;
}
function stepFollow(dt) {
  const m = G.follow; if (!m) return;
  if (!MOTES.includes(m)) {
    G.follow = null;
    toast(m.end === 'home' ? TX('命の光が、命のつぼへ帰った。また大地へ放たれる日を待っている', 'The light of life went home to the Life Jar. It waits for the day it is released onto the land again')
      : TX('命の光は深淵へ落ちた。いつか滝のしぶきの霧にのって雲になり、雨といっしょに帰ってくる', 'The light of life fell into the Abyss. Someday it will rise with the mist of the falls into a cloud and come back with the rain'), 7);
    return;
  }
  const p = proj(m.x, m.y, m.z), k = Math.min(1, dt * 3);
  V.panX = (V.panX || 0) + (V.cw / 2 - p.x) * k; V.panY = (V.panY || 0) + (V.ch * 0.45 - p.y) * k; layout(V.cw, V.ch);
}
const abyssLifeCount = () => KINDS4.reduce((a, k) => a + W.abyssLives[k], 0);
