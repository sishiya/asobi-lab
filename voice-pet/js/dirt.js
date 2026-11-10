// 汚れ（純粋）: 泥のある所と、体の部位ごとの汚れ。PLAN.md 9章（2026-11-07 ユーザー「ドロかぶったら汚れ・雨で洗い流す」）
// 汚れは部位ごとの数（mud＝泥の量 0..1、wet＝ぬれ 0..1）。ふれた所につき、跳ねは近い部位ほど・低い部位ほどかかる
// 体の形によらない（部位の位置と太さだけ見る）ので、声で生まれた子の体にもそのまま使える
import { height } from './ground.js';
import { rotv } from './trial.js';

// 泥: くぼみに水がたまった所（ぬかるみ）。0..1。地面の起伏とは別の、丸い場所の重なり
export const PATCHES = [[1.6, 0.4, 0.55], [3.9, 2.2, 0.7], [2.8, 4.6, 0.5], [0, 4.4, 0.6], [-1.2, 1.8, 0.5], [-4, -2.5, 0.9], [5, -3, 0.8]];
export function mud(x, z, rain = 0) {
  let m = 0;
  for (const [px, pz, r] of PATCHES) { const d = Math.hypot(x - px, z - pz) / (r * (1 + 0.3 * rain)); m = Math.max(m, 1 - d * d); } // 雨のあいだは少し広がる
  return Math.max(0, Math.min(1, m * 1.6 * (1 + 0.2 * Math.sin(x * 9.1 + z * 7.7)))); // ふちは少しまだら
}

// 水たまり（ホームだけ）: 泥はつかず、ふれた所がぬれる。地面の高さは変えない（テストプレイ「浸かるほどにはしない。溺れているように見える」）
export const PUDDLES = [[0.62, -1.2, 0.42], [1.02, -1.48, 0.27]];
export function puddle(x, z) { let m = 0; for (const [px, pz, r] of PUDDLES) { const d = Math.hypot(x - px, z - pz) / r; m = Math.max(m, 1 - d * d); } return Math.max(0, Math.min(1, m * 1.6)); }

// 部位の当たりの両はし（骨の中心から）。玉は中心だけ
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export function makeDirt(H) {
  const S = {};
  for (const [name, p] of Object.entries(H.parts)) {
    if (!p.a && !p.off && p.r <= 0.005) continue; // 節（見えない小さな体）は外す
    const ends = p.off ? [p.off] : p.a ? [sub(p.a, p.c), sub(p.b, p.c)] : [[0, 0, 0]];
    S[name] = { name, body: p.body, r: p.r, ends, mud: 0, wet: 0, dry: 0 };
  }
  return S;
}
// 部位の点（世界の位置）
function points(s) { const t = s.body.translation(), q = s.body.rotation(); return s.ends.map(e => { const d = rotv(q, e); return [t.x + d[0], t.y + d[1], t.z + d[2]]; }); }

// 1こま（dt 秒）。rain＝雨の強さ 0..1。返すのは、このこまで泥がついた点（[{part, p:世界の点, amt, r}]。皮の泥の点＝felt.js の mud.hit へ）
export function stepDirt(S, H, dt, rain = 0, onSplash = null, pools = false) { // pools＝水たまりのある場所（ホーム）
  const hits = [], poolHit = new Set();
  // 1) ふれた所: 部位のいちばん低い点が地面に近く、そこがぬかるみなら泥がつく（足はこする分さらに）
  for (const s of Object.values(S)) {
    for (const [x, y, z] of points(s)) {
      const g = y - s.r - height(x, z), m = mud(x, z, rain); if (pools && g < 0.006) { const w = puddle(x, z); if (w > 0.05) { s.wet = Math.min(1, s.wet + w * 3 * dt); s.mud = Math.max(0, s.mud - w * 0.8 * dt); poolHit.add(s.name); } }
      if (g < 0.006 && m > 0.05) { s.mud = Math.min(1, s.mud + m * 2.2 * dt); s.wet = Math.min(1, s.wet + m * 3 * dt); const foot = /ft[LR]$/.test(s.name); hits.push({ part: s.name, p: [x, y - s.r * (foot ? 0.2 : 1), z], amt: m * 2.2 * dt, r: Math.max(0.012, s.r * (foot ? 2.6 : 1.6)) }); } // ふれた所を中心に（足はぬかるみに沈むので、足先から少し上まで）
    }
  }
  // 2) 跳ね: 足がぬかるみに着いた瞬間、落ちる速さに比べて、近い部位ほど・低い部位ほど泥がかかる
  for (const f of H.feet) {
    const v = f.body.linvel(), t = f.body.translation(), m = mud(t.x, t.z, rain), down = t.y - f.r - height(t.x, t.z) < 0.01;
    if (down && !f.dirtDown && m > 0.15) {
      const hit = Math.min(1, Math.max(0, -v.y) * 0.8 + Math.hypot(v.x, v.z) * 0.3) * m;
      for (const s of Object.values(S)) {
        const [x, y, z] = points(s)[0], d = Math.hypot(x - t.x, z - t.z), up = y - height(x, z);
        const w = hit * Math.exp(-d / 0.12) * Math.exp(-up / 0.08);
        s.mud = Math.min(1, s.mud + w * 0.35); s.wet = Math.min(1, s.wet + w * 0.5);
        if (w > 0.02) for (let k = 0; k < 3; k++) { const a = Math.random() * 6.28, rr = s.r * (0.5 + Math.random()); hits.push({ part: s.name, p: [x + Math.cos(a) * rr, y - s.r * Math.random(), z + Math.sin(a) * rr], amt: w * 0.25 * Math.random(), r: 0.008 + 0.006 * Math.random() }); } // しぶき: 小さな点がまわりに
      }
      if (onSplash && hit > 0.05) onSplash(t.x, t.z, hit, f);
    }
    f.dirtDown = down;
  }
  // 2.5) 水たまりの跳ね: 足が水に着いた瞬間、足のまわりの低い部位がぬれる
  if (pools) for (const f of H.feet) {
    const v = f.body.linvel(), t = f.body.translation(), m = puddle(t.x, t.z), down = t.y - f.r - height(t.x, t.z) < 0.01;
    if (down && !f.poolDown && m > 0.15) { const hit = Math.min(1, Math.max(0, -v.y) * 0.8 + Math.hypot(v.x, v.z) * 0.3) * m; for (const s of Object.values(S)) { const [x, y, z] = points(s)[0]; s.wet = Math.min(1, s.wet + hit * Math.exp(-Math.hypot(x - t.x, z - t.z) / 0.12) * Math.exp(-(y - height(x, z)) / 0.08) * 0.5); } if (onSplash && hit > 0.05) onSplash(t.x, t.z, hit, f, true); }
    f.poolDown = down;
  }
  // 3) 乾く・雨で流れる: ぬれは乾き（雨のあいだはぬれる）、泥は雨で少しずつ落ちる。乾いた泥は白っぽくなる（dry）
  for (const s of Object.values(S)) {
    s.wet = rain > 0 ? Math.min(1, s.wet + rain * 0.25 * dt) : Math.max(0, s.wet - 0.04 * dt);
    if (rain > 0) s.mud = Math.max(0, s.mud - rain * 0.06 * (0.5 + s.wet) * dt);
    s.dry = s.mud > 0.01 ? Math.max(0, Math.min(1, s.dry + (s.wet < 0.3 ? 0.08 : -0.3) * dt)) : 0;
  }
  H.poolParts = poolHit; // 水にふれている部位（皮の泥を少し流す）
  return hits;
}
// 部位の色: 毛の色に、ぬれた泥（こい）・乾いた泥（白っぽい）・ぬれ（こい）を重ねる。[r,g,b] 0..1
export const FUR = [0.62, 0.52, 0.40], MUD_WET = [0.17, 0.13, 0.10], MUD_DRY = [0.47, 0.41, 0.33];
// 皮の泥の色（three の色の値＝明るさに対して線形。上の値のままだと、乾いた泥がうすい毛と同じくらい明るく見えなかった）
export const COAT_MUD_WET = [0.045, 0.03, 0.02], COAT_MUD_DRY = [0.2, 0.16, 0.115];
export function dirtColor(s, base = FUR) {
  const mc = MUD_WET.map((c, i) => c + (MUD_DRY[i] - c) * s.dry), k = Math.min(1, s.mud * 1.3), wd = 1 - 0.28 * s.wet;
  return base.map((c, i) => (c + (mc[i] - c) * k) * wd);
}
