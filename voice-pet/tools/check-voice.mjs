// 声の見本を作って特徴を取り出し、作ったときの数（高さ・声の筒の長さ）が読めているかを確かめる
// node voice-pet/tools/check-voice.mjs
import { analyze } from '../js/features.js';
import { SAMPLES, sampleVoice } from '../js/synth.js';
import { makeGenome, express } from '../js/genes.js';

let bad = 0;
for (const name of Object.keys(SAMPLES)) {
  const s = SAMPLES[name];
  for (const sr of [48000, 44100]) {
    const t0 = performance.now();
    const r = analyze(sampleVoice(name, sr), sr);
    const ms = Math.round(performance.now() - t0);
    if (!r.ok) { console.log(name, sr, 'NG', r.why); bad++; continue; }
    const sm = [...s.semis].sort((a, b) => a - b), mid = sm.length % 2 ? sm[sm.length >> 1] : (sm[sm.length / 2 - 1] + sm[sm.length / 2]) / 2;
    const want = s.f0 * 2 ** (mid / 12);
    const e0 = r.raw.f0 / want - 1, e1 = r.raw.vtl / s.vtl - 1;
    const ok = Math.abs(e0) < 0.06 && Math.abs(e1) < 0.12;
    if (!ok) bad++;
    if (sr === 48000) {
      const ph = express(makeGenome(r, 1));
      console.log(`${ok ? 'ok' : 'NG'} ${name.padEnd(7)} f0 ${r.raw.f0.toFixed(0)}/${want.toFixed(0)} vtl ${r.raw.vtl.toFixed(1)}/${s.vtl} 息 ${r.raw.breath.toFixed(2)} ゆらぎ ${r.raw.shimmer.toFixed(3)}/${r.raw.jitter.toFixed(4)} 抑揚 ${r.raw.melody.toFixed(1)} 速さ ${r.raw.rate.toFixed(1)} 重心 ${r.raw.centroid.toFixed(0)} ${ms}ms`);
      console.log('   ', Object.entries(r.n).map(([k, v]) => k + ' ' + v.toFixed(2)).join('  '));
      console.log('   ', Object.entries(ph).filter(([, v]) => typeof v === 'number').map(([k, v]) => k + ' ' + v.toFixed(2)).join('  '));
    } else if (!ok) console.log(`NG ${name} @44100 f0 ${r.raw.f0.toFixed(0)} vtl ${r.raw.vtl.toFixed(1)}`);
  }
}
console.log(bad ? `NG ${bad}` : 'all ok');
process.exit(bad ? 1 : 0);
