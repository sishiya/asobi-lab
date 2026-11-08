// 起き上がる練習（純粋）: その子の体で、起き上がりの型（js/getup.js）を少しずつ変えて試し、よかったものに寄せる（クロスエントロピー法。tools/getup-learn.mjs と同じ決まり）
// 1回の試し＝横から押して倒し（どちらから押しても背中を下に少し傾いた形で止まる）、型で起きる。起きた瞬間に型をやめて立つ姿勢へ（続けるとまた倒れた）
// 点＝起きていた時間の長さ（いちばん起きた量だけだと、勢いよく転がり抜けるのが得になった）＋最後に立っているか
// 左右どちらに倒れても起きられること。いちばんの型が、ちがう2か所の左右で起きられたら「会得」
import { makeField } from './trial.js';
import { height } from './ground.js';
import { pose } from './hare.js';
import { KID_SEED } from './kid.js';
import { GETUP_SEED, GETUP_UP, decodeGetup, driveGetup } from './getup.js';
export { GETUP_UP };

export function tryGetup(R, B, v, at, d, UP = GETUP_UP) {
  const stand = B.decode(KID_SEED), world = makeField(R), H = B.build(R, world, at, height, 0), q = decodeGetup(v);
  let t = 0;
  for (; t < 0.3; t += 1 / 240) { B.drive(H, stand, t, 0, 0); world.step(); }
  for (const p of Object.values(H.parts)) { const l = p.body.linvel(); p.body.setLinvel({ x: l.x, y: l.y + 0.18, z: l.z + d * 0.6 }, true); }
  for (let k = 0; k < 288; k++) { B.drive(H, stand, t, 0, 0); world.step(); t += 1 / 240; }
  const P0 = pose(H); if (P0.up > 0.5) { world.free(); return null; } // 倒れなかった
  const dd = Math.sign(P0.roll) || d;
  let up = 0, n = 0, tUp = null, spin = 0, s = 0, upMax = -1, stopAt = null, upSum = 0, upN = 0;
  for (let k = 0; k < 240 * 5.5; k++, s += 1 / 240) {
    if (stopAt == null && s > 0.2 && k % 8 === 0 && pose(H).up > UP) stopAt = s;
    const done = driveGetup(H, q, s, dd, stopAt); if (done) B.drive(H, stand, s, 0, 0); world.step();
    if (k % 8 === 0) { const P = pose(H), w = H.parts.pelvis.body.angvel(); spin += Math.hypot(w.x, w.y, w.z); upMax = Math.max(upMax, P.up); upSum += Math.max(0, P.up); upN++; if (tUp == null && P.up > 0.8) tUp = s; if (s > 5) { up += P.up; n++; } }
  }
  const P = pose(H), ok = up / n > 0.85 && P.y - height(P.x, P.z) > H.fallH;
  world.free();
  return { ok, up: up / n, upMax, upAvg: upSum / upN, tUp, spin: spin / 660 };
}
const score = r => (r ? 0.3 * r.upMax + 2 * r.upAvg + r.up + (r.ok ? 2 : 0) - 0.03 * r.spin : 0);

export function makeGetupPractice(R, B, { pop = 16, seed = 1, resume = null } = {}) {
  let s = (seed >>> 0) % 2147483646 + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  let mean = GETUP_SEED.slice(), sd = mean.map(() => 0.2), best = null, gen = 0, tries = 0, learned = false;
  if (resume) ({ s, mean, sd, best, gen, tries, learned } = structuredClone(resume));
  const EL = Math.max(2, pop >> 2);
  return {
    get gen() { return gen; }, get tries() { return tries; }, get best() { return best; }, get learned() { return learned; }, get trying() { return mean; },
    state: () => structuredClone({ s, mean, sd, best, gen, tries, learned }),
    step() {
      const at = [(rnd() - 0.5) * 10, 0, (rnd() - 0.5) * 10], P = [];
      for (let i = 0; i < pop; i++) {
        const v = mean.map((m, k) => Math.max(0, Math.min(1, m + sd[k] * gauss()))), a = tryGetup(R, B, v, at, 1), b = tryGetup(R, B, v, at, -1); tries += 2;
        P.push({ v, s: (score(a) + score(b)) / 2 + 0.5 * Math.min(score(a), score(b)), ok: !!(a?.ok && b?.ok) });
      }
      P.sort((x, y) => y.s - x.s); const el = P.slice(0, EL);
      mean = mean.map((_, k) => el.reduce((t, e) => t + e.v[k], 0) / EL);
      sd = sd.map((_, k) => Math.max(0.03, Math.sqrt(el.reduce((t, e) => t + (e.v[k] - mean[k]) ** 2, 0) / EL) * 0.9 + 0.01));
      if (!best || P[0].s > best.s) best = { v: P[0].v, s: P[0].s, ok: P[0].ok };
      gen++;
      // 会得の確かめ: いちばんの型が、ちがう2か所の左右で起きられる（5世代ごと）
      if (best.ok && gen % 5 === 0) { let okN = 0; for (let k = 0; k < 2; k++) { const a = rnd() * 6.28, at = [Math.cos(a) * 3, 0, Math.sin(a) * 3]; for (const d of [1, -1]) { if (tryGetup(R, B, best.v, at, d)?.ok) okN++; tries++; } } if (okN >= 3) learned = true; }
      return best;
    },
  };
}
