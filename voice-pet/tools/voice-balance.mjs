// 声 → 型 の基準を作る（VOICE.md）。合成の話し声を、たまごと同じく1人3回ぶん平均して、型の点の平均・ばらつき・片寄りの補正を求める
// node tools/voice-balance.mjs fit＝基準を求めて表示 / node tools/voice-balance.mjs check＝別の声で、いまの基準の分かれ方を見る。本物の人の声ではない
import { synthVoice, sylls } from '../js/synth.js';
import { analyze } from '../js/features.js';
import { typeScores, typeOf, VOICE_TYPES } from '../js/voice-founder.js';
const sr = 48000, dur = 2, T = ['aiueo', 'oiaeu', 'aoiue', 'eaoiu'], G = { m: [95, 150, 16, 19], f: [165, 260, 13.5, 16.5], c: [240, 360, 10.5, 13.5] }, mode = process.argv[2] || 'check', N = +(process.argv[3] || 300);
let s = mode === 'fit' ? 7 : 77701; const rnd = (a = 0, b = 1) => a + (b - a) * ((s = (s * 16807) % 2147483647) / 2147483647);
function speaker(i) { const g = Object.keys(G)[i % 3], [a, b, v0, v1] = G[g], f0 = rnd(a, b), vtl = rnd(v0, v1), breath = rnd() ** 2 * 0.75 + 0.02, rough = rnd() ** 1.5 * 0.8 + 0.02, rate = rnd(2.8, 7.5), mel = rnd(0.6, 6), n = {}; let ok = 0;
  for (let k = 0; k < 3; k++) { const m = mel * rnd(0.8, 1.2), semis = [0, m, -m * 0.6, m * 1.4, m * 0.3].map(x => Math.round(x * 10) / 10), { samples } = synthVoice({ sr, dur, f0: f0 * rnd(0.94, 1.06), vtl, breath, rough, attack: rnd(0.003, 0.03), syl: sylls(T[(i + k) % 4].repeat(5), rate * rnd(0.9, 1.1), dur, semis, rnd(0.45, 0.85)), seed: i * 31 + k * 7 + 5 }); for (let j = 0; j < samples.length; j++) samples[j] += (rnd() - 0.5) * 0.006; const r = analyze(samples, sr); if (!r.ok) continue; ok++; for (const q in r.n) n[q] = (n[q] || 0) + r.n[q]; }
  if (!ok) return null; for (const q in n) n[q] /= ok; return { g, n }; }
const P = []; for (let i = 0; i < N; i++) { const v = speaker(i); if (v) P.push(v); }
if (mode === 'fit') {
  const S = P.map(p => typeScores(p.n)), stat = {}; for (const t of VOICE_TYPES) { const a = S.map(x => x[t]), m = a.reduce((x, y) => x + y, 0) / a.length; stat[t] = [m, Math.max(0.03, Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length))]; }
  const b = Object.fromEntries(VOICE_TYPES.map(t => [t, 0])), pick = x => VOICE_TYPES.map(t => [t, (x[t] - stat[t][0]) / stat[t][1] + b[t]]).sort((u, v) => v[1] - u[1])[0][0];
  for (let it = 0; it < 1500; it++) { const c = Object.fromEntries(VOICE_TYPES.map(t => [t, 0])); for (const x of S) c[pick(x)]++; for (const t of VOICE_TYPES) b[t] += 0.1 * (1 / VOICE_TYPES.length - c[t] / S.length); }
  console.log('export const TYPE_NORM = ' + JSON.stringify(Object.fromEntries(VOICE_TYPES.map(t => [t, [+stat[t][0].toFixed(3), +stat[t][1].toFixed(3), +b[t].toFixed(3)]]))) + ';');
} else {
  const c = {}; for (const p of P) { const t = typeOf(p.n, () => Math.random()); c.all ??= {}; c[p.g] ??= {}; c.all[t] = (c.all[t] || 0) + 1; c[p.g][t] = (c[p.g][t] || 0) + 1; }
  console.log('人数', P.length); for (const k of ['all', 'm', 'f', 'c']) { const n = Object.values(c[k]).reduce((x, y) => x + y, 0); console.log(k.padEnd(4), VOICE_TYPES.map(t => `${t} ${Math.round((c[k][t] || 0) / n * 100)}%`).join('  ')); }
}
process.exit(0);
