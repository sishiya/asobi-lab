// 練習（純粋）: その子の体で、歩き方のリズムの数を少しずつ変えて試し、よかったものに寄せる（クロスエントロピー法）。GAME.md 9.5
// 段1＝転んでも・すべってもよいからまず前へ（止まって動かない形に逃げないように）→ 段2＝転ばず・すべらず → 段3＝言われた向きへ曲がる（入って走るため）
// 段2→段3 は回数でなく「ちがう場所（傾いた地面）4か所で転ばずに歩けた」ら。歩けるまで練習は止めない
// 段2で長く行きづまったら、別の歩き方（トコトコ・ゆっくり）から始め直す（体に合わない出発点の形に閉じこめられないように）
// ask＝始め直す前に遊ぶ人に聞く（ユーザー「歩き方をリセットする際は承諾を得るように。このまま様子を見る選択肢も」）。聞いているあいだも練習は続け、「このまま」なら次の stuck 世代まで聞かない
// いちばんよい歩きは残し、新しい場所でもう一度試す（たまたまの高得点で、下手な歩きにもどらない）
import { trial } from './trial.js';
import { KID_SEED, KID_TROT, KID_SLOW, KID_PARAMS } from './kid.js';

export function makePractice(R, body, { pop = 16, seed = 1, start = body.starts?.[0] ?? KID_SEED, stage1 = 25, minStage2 = 10, stuck = 40, stage3 = 45, resume = null, ask = false, places = [], pickWide = body.pickWide ?? false, fall3 = body.fall3 ?? 1, yawRate = body.yawRate ?? 0, robust = body.robust ?? 0 } = {}) {
  let s = (seed >>> 0) % 2147483646 + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const GATE = body.gateDist ?? 1, fW = body.flightW ?? 1.5; // GATE＝歩けたと見なす6秒の道のり（本物の速さが遅い型は短く） // 跳ねる型は、宙に浮いても引かない
  const score = (r, st, cap = Infinity) => st === 1 ? Math.min(r.dist, 1.8) - 0.5 * r.slip - (r.fell ? 0.3 : 0)
    : Math.min(r.dist, 1.8) - 3 * r.slip - (r.fell ? (st === 3 ? fall3 : 1) : 0) - fW * r.flight + (st === 3 ? 1.5 * Math.min(r.yaw, cap) - 2 * Math.abs(r.drift) : 0); // 曲がる段: 言われた向きへ曲がる・まっすぐのとき流れない（流れるくせは片足をかばうように見える＝9.7）
  const STARTS = body.starts ?? [start, KID_TROT, KID_SLOW];
  let mean = start.slice(), sd = mean.map(() => 0.15), best = null, gen = 0, tries = 0, firstWalk = null, st = 1, inSt = 0, restarts = 0, steady = false, done = false, askAt = stuck, asking = false, safe = null, safeN = -1; // safe＝別の場所でも転ばなかった、いちばん新しい歩き（曲がる練習でくずれたら、これにもどす）
  if (resume) ({ s, mean, sd, best, gen, tries, firstWalk, st, inSt, restarts, steady, done, askAt = stuck, asking = false, safe = null, safeN = -1 } = structuredClone(resume)); // 走りに行って、もどってきたら続きから
  const EL = Math.max(2, pop >> 2);
  // 足の横の振りは、曲がる練習（段3）から使いはじめる（はじめから試すと、まっすぐ歩くのを覚えにくかった）。それまでは出発点の値（0）にとめる
  const LAT = ['abA', 'abP', 'abT'].map(k => KID_PARAMS.findIndex(p => p[0] === k)).filter(i => i >= 0), FIX = (body.lock ?? []).map(k => KID_PARAMS.findIndex(p => p[0] === k)).filter(i => i >= 0), LIM = Object.entries(body.limit ?? {}).map(([k, r]) => { const i = KID_PARAMS.findIndex(p => p[0] === k), [, a, b] = KID_PARAMS[i]; return [i, (r[0] - a) / (b - a), (r[1] - a) / (b - a)]; }), lock = v => { if (st < 3) for (const i of LAT) v[i] = start[i] ?? 0.5; for (const i of FIX) v[i] = start[i] ?? 0.5; for (const [i, lo, hi] of LIM) v[i] = Math.max(lo, Math.min(hi, v[i])); return v; }; // limit＝学習で動かしてよい範囲（イタチのももが前向きの上限に張りついて、脚を前へ投げ出す歩きに固まった）
  const run = (v, at, st, turn, dur, cap) => { const r = trial(R, v, { dur, turn, at, body }); r.world.free(); tries++; if (!firstWalk && !r.fell && r.dist > GATE) firstWalk = tries; return { v, s: score(r, st, cap), dist: r.dist, fell: r.fell, yaw: r.yaw }; };
  // 4か所（場所ごとに地面の傾きがちがう）で転ばず 1m 歩けるか
  // 走った地面（ユーザーの目標「でかけた所が家の庭になる」の残り半分）: 走った場所があれば、試しの半分はそこで（その子が本当に歩いた地面で練習する）
  const placeAt = () => { const p = places[Math.floor(rnd() * places.length)]; return [Math.max(-6, Math.min(6, p[0] + (rnd() - 0.5) * 0.6)), 0, Math.max(-6, Math.min(6, p[1] + (rnd() - 0.5) * 0.6))]; };
  const steadyAt = (v, straight = false) => { let ok = 0; for (let k = 0; k < 4; k++) { const a = rnd() * 6.28, d = 2 + rnd() * 5, r = trial(R, v, { dur: 6, body, ...(straight ? { turn: () => 0 } : {}), at: places.length && k % 2 ? placeAt() : [Math.cos(a) * d, 0, Math.sin(a) * d] }); r.world.free(); tries++; if (!r.fell && r.dist > GATE) ok++; } return ok === 4; };
  const wideN = v => { let ok = 0; for (let k = 0; k < 8; k++) { const a = rnd() * 6.28, d = 2 + rnd() * 5, r = trial(R, v, { dur: 6, body, at: [Math.cos(a) * d, 0, Math.sin(a) * d] }); r.world.free(); tries++; if (!r.fell && r.dist > GATE) ok++; } return ok; }, wideOk = v => wideN(v) >= 7;
  const toStage = n => { st = n; inSt = 0; if (best) { mean = best.v.slice(); sd = sd.map(() => 0.08); } if (n === 3) for (const i of LAT) sd[i] = 0.15; best = null; }; // 段3で横の振りを広く試しはじめる // 段が変わると点のつけ方が変わるので、いちばんを選びなおす
  return {
    get gen() { return gen; }, get tries() { return tries; }, get best() { return best; }, get firstWalk() { return firstWalk; },
    setPlaces(p) { places = p; }, get trying() { return mean; }, state: () => structuredClone({ s, mean, sd, best, gen, tries, firstWalk, st, inSt, restarts, steady, done, askAt, asking, safe, safeN }), get asking() { return asking; },
    // 聞いた答え: 始め直す／このまま様子を見る
    restart() { restarts++; mean = STARTS[restarts % STARTS.length].map(x => Math.max(0, Math.min(1, x + 0.05 * gauss()))); sd = mean.map(() => 0.15); best = null; st = 1; inSt = 0; askAt = stuck; asking = false; },
    keep() { asking = false; askAt = inSt + stuck * 3; }, get stage() { return st; }, get restarts() { return restarts; }, get steady() { return steady; }, get done() { return done; },
    // 1世代: pop 回の試し。返すのはいちばんよい歩き
    step() {
      const at = places.length && rnd() < 0.5 ? placeAt() : [(rnd() - 0.5) * 14, 0, (rnd() - 0.5) * 14];
      // 段3は 1.6 秒ごとに 左・まっすぐ・右 がでたらめに変わる指示（遊ぶ人の操作に近い）
      const seq = Array.from({ length: 6 }, () => [-1, 0, 1][Math.floor(rnd() * 3)]), turn = st === 3 ? t => seq[Math.min(5, Math.floor(t / 1.6))] : () => 0, dur = st === 3 ? 8 : 6, capOf = q => st === 3 && yawRate ? yawRate * 1.6 * q.slice(0, 5).filter(Boolean).length : Infinity /* yawRate＝曲がる点の上限（毎秒）。上限がないと、転んでも速く回るほうが得だった */, deep = robust && st === 3 && inSt >= stage3 /* robust＝仕上げは1つの歩きを何か所かで試す（1か所だけだと、その場所に合った歩きが選ばれた） */, tests = [{ at, turn, cap: capOf(seq) }];
      if (deep) { if (inSt === stage3 && best) { mean = best.v.slice(); sd = sd.map(() => 0.06); best = null; } for (let i = 1; i < robust; i++) { const q = Array.from({ length: 6 }, () => [-1, 0, 1][Math.floor(rnd() * 3)]); tests.push({ at: [(rnd() - 0.5) * 14, 0, (rnd() - 0.5) * 14], turn: t => q[Math.min(5, Math.floor(t / 1.6))], cap: capOf(q) }); } } const go = v => { const a = tests.map(T => run(v, T.at, st, T.turn, dur, T.cap)); return a.length === 1 ? a[0] : { ...a[0], s: a.reduce((t, e) => t + e.s, 0) / a.length }; }; const P = []; for (let i = 0; i < pop; i++) P.push(go(lock(mean.map((m, k) => Math.max(0, Math.min(1, m + sd[k] * gauss()))))));
      if (best) { const b = go(best.v); best = { ...best, s: Math.min(best.s, (best.s + b.s) / 2) }; }
      P.sort((a, b) => b.s - a.s); const el = P.slice(0, EL);
      mean = mean.map((_, k) => el.reduce((t, e) => t + e.v[k], 0) / EL);
      sd = sd.map((_, k) => Math.max(0.03, Math.sqrt(el.reduce((t, e) => t + (e.v[k] - mean[k]) ** 2, 0) / EL) * 0.9 + 0.01));
      if (!best || P[0].s > best.s) best = { ...P[0], stage: st };
      let out = best; gen++; inSt++;
      if (st === 1 && inSt >= stage1) toStage(2);
      else if (st === 2 && inSt >= minStage2 && inSt % 5 === 0) {
        if (steadyAt(best.v, body.gateStraight)) { steady = true; safe = best.v.slice(); toStage(3); } // gateStraight＝段2はまっすぐの練習なので、跳ねる型は試験もまっすぐで（曲がりは段3で覚える）
        else if (inSt >= askAt && !asking) { if (ask) asking = true; else this.restart(); } // 行きづまり→別の歩き方から（ask なら聞いてから）
      } else if (st === 3 && inSt % 5 === 0) { // 曲がれるようになっても、別の場所で転ばない歩きだけを残す（曲がる練習のあと、4か所で歩けた子が 8 か所で 0 になった＝2026-11-08 の調査）
        const ok = steadyAt(best.v); if (ok && pickWide) { const n = wideN(best.v); if (n >= safeN) { safeN = n; safe = best.v.slice(); } } else if (ok) safe = best.v.slice();
        if (inSt >= stage3 && ok && (pickWide ? safeN >= 7 : wideOk(best.v))) { done = true; if (safe) out = { ...out, v: safe }; } else if (inSt >= stage3 * (robust ? 2 : 3)) { done = true; if (safe) out = { ...out, v: safe }; } // 卒業は はじめての8か所で試す（4か所だけだと、たまたま通った子が歩けないまま終わった＝2026-11-10 の調査）
      }
      return out;
    },
  };
}
