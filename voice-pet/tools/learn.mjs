// ノウサギの跳び方を学習する（クロスエントロピー法: 数をばらまいて試し、よかった上位に寄せる）
// node voice-pet/tools/learn.mjs [回数] [つづきから: 1]
// 結果は voice-pet/js/gait-hare.json（リズムの数と、そのときの成績）
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import R from '@dimforge/rapier3d-compat';
import { trial, score } from '../js/trial.js';
import { PARAMS, setHeadFused, setAnatomical } from '../js/hare.js';
await R.init();
const anat = process.env.ANAT === '1'; setAnatomical(anat); // ANAT=1 で関節を本物の向きだけに
const fused = process.env.HEAD !== 'head'; setHeadFused(fused); // いまは頭をまとめた体がふつう。HEAD=head で頭あり
// OUT=名前 で gait-hare-名前.json に書く。FROM=名前 で、つづきを gait-hare-名前.json から始める（8の字の跳び方を手直しするとき）
const here = path.dirname(fileURLToPath(import.meta.url)), gf = n => path.join(here, `../js/gait-hare${n ? '-' + n : ''}.json`), out = gf(process.env.OUT || (fused ? '' : 'head')), src = process.env.FROM ? gf(process.env.FROM) : out;
// 段: straight＝まっすぐ跳ぶ（曲がらない）、turn＝8の字（左回り→右回り）、steer＝でたらめに変わる向き。つづきから: 3つ目に 1
const iters = +(process.argv[2] || 40), stage = process.argv[4] || 'straight', resume = process.argv[3] === '1' && fs.existsSync(src);
// steer＝遊ぶ人の操作に近い形（1.6 秒ごとに 左・まっすぐ・右 がでたらめに変わる。世代ごとに同じ並びで試す）
const opts = stage === 'turn' ? { dur: 8 } : stage === 'steer' ? { dur: 8, turn: () => 0 } : { dur: 6, turn: () => 0 }, slipW = +(process.argv[5] || 8), imit = +(process.argv[6] || 0), fallW = +(process.argv[7] || 0.6), yawW = +(process.argv[8] || 0.25); // 5つ目: すべりの重み、6つ目: 手本に合わせる重み、7つ目: 転ぶ罰、8つ目: 曲がる重み
const D = PARAMS.length, POP = 32, ELITE = 8;
// はじめは手本の形から: 後ろ足は伸ばす向き（股−・ひざ＋・かかと−）をそろえて左右同時、背骨は後ろ足が蹴るときに伸ばす、前足は半周ずらして左右を少しずらす
// 関節の向き（体の左＝+z まわり）: 股＋＝足を前へ、ひざ＋＝のばす、かかと−＝のばす、背骨−＝丸める、肩＋＝前足を前へ
const enc = o => PARAMS.map(([k, a, b]) => Math.max(0, Math.min(1, ((o[k] ?? (a + b) / 2) - a) / (b - a))));
const A0 = 0.5, SEED = enc({ freq: 3.5, spA: 0.3, spO: 0, spP: 0.5, hipA: A0, hipO: 0, kneeA: A0, kneeO: 0, kneeP: 0.5, ankA: A0, ankO: 0, ankP: 0, shA: A0 * 0.8, shO: 0, shP: 0.5, elA: A0 * 0.5, elO: 0, elP: 0.5, hLR: 0, fLR: 0.1, turn: 0, neck: 0, pK: 0, pD: 0, pKf: 0, rK: 0, aK: -0.7, aD: 0 }); // 横へ足を出す反射は、立つ試しで立てた値から
let mean = resume ? PARAMS.map((_, i) => JSON.parse(fs.readFileSync(src, 'utf8')).v[i] ?? SEED[i]) /* 数が増えたときは、増えた分を手本の出発点から */ : SEED, sd = PARAMS.map(() => +(process.env.SD || (resume ? 0.12 : 0.15))); // SD＝ばらまく幅（手直しは小さく）
let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
let best = null;
// 置く場所: 回ごとに起伏のちがう2か所を選び、その回の候補はみな同じ2か所で試して点を平均する（1か所だけで覚えると、はじめての場所で転ぶ）
let spots = [[0, 0, 0]];
const pickSpots = () => {
  spots = [0, 1].map(() => [(rnd() - 0.5) * 18, 0, (rnd() - 0.5) * 18]);
  if (stage === 'steer') { const seq = Array.from({ length: 6 }, () => [-1, 0, 1][Math.floor(rnd() * 3)]); opts.turn = t => seq[Math.min(5, Math.floor(t / 1.6))]; }
};
const evalV = v => { let s = 0, r0 = null; for (const at of spots) { const r = trial(R, v, { ...opts, at }); r.world.free(); s += score(r, opts.dur, slipW, imit, fallW, yawW); if (!r0 || r.fell) r0 = r; } return { v, r: r0, s: s / spots.length }; };
for (let it = 0; it < iters; it++) {
  pickSpots(); const pop = [];
  for (let i = 0; i < POP; i++) pop.push(evalV(mean.map((m, k) => Math.max(0, Math.min(1, m + sd[k] * gauss())))));
  pop.sort((a, b) => b.s - a.s);
  const el = pop.slice(0, ELITE);
  mean = mean.map((_, k) => el.reduce((t, e) => t + e.v[k], 0) / ELITE);
  sd = sd.map((_, k) => Math.max(0.02, Math.sqrt(el.reduce((t, e) => t + (e.v[k] - mean[k]) ** 2, 0) / ELITE) * 0.9 + 0.01));
  if (!best || pop[0].s > best.s) best = pop[0];
  const b = pop[0].r;
  console.log(`${String(it).padStart(3)} 点 ${pop[0].s.toFixed(2)}  進む ${b.dist.toFixed(2)}m  曲がる ${b.yaw.toFixed(2)}  Y字 ${(b.yRatio * 100).toFixed(0)}%(${b.hindTD}) 前後${((b.yLead ?? 0) * 30).toFixed(1)}cm  手本 ${(b.match * 100).toFixed(0)}%[${Object.values(b.parts || {}).map(v => Math.round(v * 9)).join('')}] ${(b.freq || 0).toFixed(1)}回/秒  宙 ${(b.flight * 100).toFixed(0)}%  すべり ${(b.slip * 100).toFixed(1)}cm/秒  転ぶ ${b.fell ? 'はい' : 'いいえ'}`);
  const m = evalV(mean);
  fs.writeFileSync(out, JSON.stringify({ v: (m.s > best.s ? m : best).v.map(x => +x.toFixed(4)), score: +Math.max(m.s, best.s).toFixed(3), anat, at: new Date().toISOString() }, null, 0));
}
console.log('いちばん', best.s.toFixed(2));
