// 起き上がる練習（js/getup.js）が会得できるかの確かめ: 子を横に倒し（左右どちらも）、型で起き上がれるかをクロスエントロピー法で学ぶ
// [TWIST=1] node tools/getup-learn.mjs 番号 [世代=40]（番号は kidGenes(番号×7919)、tanuki でタヌキ）。結果は js/getup-kid-<番号>.json、記録は logs/getup-<番号>.txt
import fs from 'node:fs';
import R from '@dimforge/rapier3d-compat';
import { makeField } from '../js/trial.js';
import { height } from '../js/ground.js';
import { pose } from '../js/hare.js';
import { kidGenes, kidBody, KID_SEED } from '../js/kid.js';
import { TANUKI } from '../js/tanuki.js';
import { GETUP_SEED, decodeGetup, driveGetup } from '../js/getup.js';
await R.init();
const id = process.argv[2] || '8', GENS = +(process.argv[3] || 40), tan = id === 'tanuki', genes = tan ? {} : kidGenes(+id * 7919);
const TW = !!process.env.TWIST, tag = id + (TW ? '-tw' : ''); // TWIST=1 で背にねじりの関節を足した体
const B = kidBody(genes, { ...(tan ? TANUKI : {}), ...(TW ? { twist: true } : {}) }), stand = B.decode(KID_SEED);
const LOG = new URL(`./logs/getup-${tag}.txt`, import.meta.url); fs.writeFileSync(LOG, "");
const say = s => { console.log(s); fs.appendFileSync(LOG, s + '\n'); }; // 1世代ごとに書く（流す書き方だと、練習が止まらずに回るあいだ出ない）

// 1回の試し: at に立たせ、d の向きへ倒して 1.2 秒おちつかせてから、型で起きる。4 秒のうちに起きて 0.5 秒立っていられたか
function tryGetup(v, at, d) {
  const world = makeField(R), H = B.build(R, world, at, height, 0), q = decodeGetup(v);
  let t = 0;
  for (; t < 0.3; t += 1 / 240) { B.drive(H, stand, t, 0, 0); world.step(); }
  for (const p of Object.values(H.parts)) { const l = p.body.linvel(); p.body.setLinvel({ x: l.x, y: l.y + 0.18, z: l.z + d * 0.6 }, true); } // 横から押して倒す（回すだけでは倒れない。tools/getup-topple.mjs）。どちらから押しても、背中を下に少し傾いた形（腰の上向き −0.4）で止まる
  for (let k = 0; k < 288; k++) { B.drive(H, stand, t, 0, 0); world.step(); t += 1 / 240; }
  const P0 = pose(H); if (P0.up > 0.5) { world.free(); return null; } // 倒れなかった
  const dd = Math.sign(P0.roll) || d;
  let up = 0, n = 0, tUp = null, spin = 0, s = 0, upMax = -1;
  for (let k = 0; k < 240 * 4.5; k++, s += 1 / 240) {
    const done = driveGetup(H, q, s, dd); if (done) B.drive(H, stand, s, 0, 0); world.step();
    if (k % 8 === 0) { const P = pose(H), w = H.parts.pelvis.body.angvel(); spin += Math.hypot(w.x, w.y, w.z); upMax = Math.max(upMax, P.up); if (tUp == null && P.up > 0.8) tUp = s; if (s > 4) { up += P.up; n++; } }
  }
  const P = pose(H), ok = up / n > 0.85 && P.y - height(P.x, P.z) > H.fallH;
  world.free();
  return { ok, up: up / n, upMax, tUp, spin: spin / 540 };
}
const score = r => (r ? r.upMax + r.up + (r.ok ? 2 - 0.3 * (r.tUp ?? 4) : 0) - 0.03 * r.spin : 0); // とちゅうでいちばん起きた量にも点（最後に起きたかだけでは、少し起きた動きに点が入らず学べない）

let s0 = 7; const rnd = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
let mean = GETUP_SEED.slice(), sd = mean.map(() => 0.2), best = null;
const POP = 24, EL = 6;
for (let g = 0; g < GENS; g++) {
  const at = [(rnd() - 0.5) * 10, 0, (rnd() - 0.5) * 10];
  const P = [];
  for (let i = 0; i < POP; i++) {
    const v = mean.map((m, k) => Math.max(0, Math.min(1, m + sd[k] * gauss())));
    const a = tryGetup(v, at, 1), b = tryGetup(v, at, -1); // 左右どちらに倒れても起きられること
    P.push({ v, s: (score(a) + score(b)) / 2 + 0.5 * Math.min(score(a), score(b)), a, b });
  }
  P.sort((x, y) => y.s - x.s); const el = P.slice(0, EL);
  mean = mean.map((_, k) => el.reduce((t, e) => t + e.v[k], 0) / EL);
  sd = sd.map((_, k) => Math.max(0.03, Math.sqrt(el.reduce((t, e) => t + (e.v[k] - mean[k]) ** 2, 0) / EL) * 0.9 + 0.01));
  if (!best || P[0].s > best.s) best = P[0];
  const okN = P.filter(p => p.a?.ok && p.b?.ok).length;
  say(`世代 ${g + 1} いちばん ${P[0].s.toFixed(2)} 起きた量 ${P[0].a?.upMax?.toFixed(2)}/${P[0].b?.upMax?.toFixed(2)}（左 ${P[0].a?.ok ? '起きた' : '×'} ${P[0].a?.tUp?.toFixed(1) ?? '-'}秒・右 ${P[0].b?.ok ? '起きた' : '×'} ${P[0].b?.tUp?.toFixed(1) ?? '-'}秒） 両方起きた ${okN}/${POP}`);
}
// 会得できたかを別の6か所で
let okAll = 0; for (let k = 0; k < 6; k++) { const a = k * 1.05, at = [Math.cos(a) * 3, 0, Math.sin(a) * 3]; const r = tryGetup(best.v, at, k % 2 ? 1 : -1); if (r?.ok) okAll++; }
say(`別の6か所で起きた ${okAll}/6`);
fs.writeFileSync(new URL(`../js/getup-kid-${tag}.json`, import.meta.url), JSON.stringify({ v: best.v.map(x => +x.toFixed(4)), okAll }));
